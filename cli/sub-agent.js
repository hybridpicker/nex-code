/**
 * cli/sub-agent.js — Sub-Agent Runner
 * Spawns parallel sub-agents with their own conversation contexts.
 */

const { callStream, getActiveProviderName, getActiveModelId, getConfiguredProviders, getProvider, getActiveProvider, parseModelSpec } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { filterToolsForModel, getModelTier } = require('./tool-tiers');
const { trackUsage } = require('./costs');
const { MultiProgress, C } = require('./ui');

const MAX_SUB_ITERATIONS = 15;
const MAX_PARALLEL_AGENTS = 5;
const MAX_CHAT_RETRIES = 3;
// Depth-1 agents (reviewers) get fewer iterations to stay lightweight
const MAX_REVIEWER_ITERATIONS = 8;
const MAX_REVIEWER_AGENTS = 2;

// ─── File Locking ─────────────────────────────────────────────
// Map<filePath, {agentId, timestamp}> — allows same agent to re-lock its own files
const lockedFiles = new Map();
const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function acquireLock(filePath, agentId) {
  const entry = lockedFiles.get(filePath);
  if (entry && entry.agentId !== agentId) {
    // Check if lock has expired
    if (Date.now() - entry.timestamp < LOCK_TIMEOUT_MS) return false;
  }
  lockedFiles.set(filePath, { agentId, timestamp: Date.now() });
  return true;
}

function releaseLock(filePath) {
  lockedFiles.delete(filePath);
}

function clearAllLocks() {
  lockedFiles.clear();
}

// ─── Retry Logic ─────────────────────────────────────────────

function isRetryableError(err) {
  const msg = err.message || '';
  const code = err.code || '';
  // Rate limit
  if (msg.includes('429')) return true;
  // Server errors
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
  // Network errors
  if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') return true;
  if (msg.includes('socket disconnected') || msg.includes('TLS') || msg.includes('ECONNRESET')) return true;
  if (msg.includes('fetch failed') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) return true;
  return false;
}

async function callWithRetry(messages, tools, options) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_CHAT_RETRIES; attempt++) {
    try {
      return await callStream(messages, tools, options);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_CHAT_RETRIES && isRetryableError(err)) {
        // Rate limits: full exponential backoff (provider needs recovery time)
        // Server/network errors: shorter delay — callStream already tried the full fallback chain
        const isRateLimit = (err.message || '').includes('429');
        const delay = isRateLimit
          ? Math.min(2000 * Math.pow(2, attempt), 15000)
          : Math.min(500 * Math.pow(2, attempt), 4000);
        await new Promise(r => setTimeout(r, delay).unref());
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Tools that sub-agents should NOT have access to.
// At depth 0-1, spawn_agents is allowed so coders can spawn reviewers.
// At depth >= 2, spawn_agents is blocked to prevent unbounded nesting.
const BASE_EXCLUDED = new Set(['ask_user', 'task_list']);

function getExcludedTools(depth) {
  if (depth >= 2) return new Set([...BASE_EXCLUDED, 'spawn_agents']);
  return BASE_EXCLUDED;
}

// Tools that need file locking
const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'patch_file']);

// ─── Task Classification + Model Routing ──────────────────────

const FAST_PATTERNS = /\b(read|summarize|search|find|list|check|count|inspect|scan)\b/i;
const HEAVY_PATTERNS = /\b(refactor|rewrite|implement|create|architect|design|generate|migrate)\b/i;

/**
 * Classify a task description into a complexity tier.
 * @param {string} taskDesc
 * @returns {'essential'|'standard'|'full'}
 */
function classifyTask(taskDesc) {
  if (HEAVY_PATTERNS.test(taskDesc)) return 'full';
  if (FAST_PATTERNS.test(taskDesc)) return 'essential';
  return 'standard';
}

/**
 * Pick the best available model at a target tier.
 * Prefers the active provider, then falls back to others.
 * @param {string} targetTier
 * @returns {{ provider: string, model: string }|null}
 */
function pickModelForTier(targetTier) {
  const configured = getConfiguredProviders();
  const activeProv = getActiveProviderName();

  const sorted = [...configured].sort((a, b) =>
    (a.name === activeProv ? -1 : 1) - (b.name === activeProv ? -1 : 1)
  );

  for (const p of sorted) {
    for (const m of p.models) {
      if (getModelTier(m.id, p.name) === targetTier) {
        return { provider: p.name, model: m.id };
      }
    }
  }
  return null;
}

// ENV-based model overrides per task tier (e.g. NEX_HEAVY_MODEL=kimi-k2:1t)
// Checked before auto-routing — set in .env to control sub-agent model selection.
const ENV_TIER_MODELS = {
  essential: process.env.NEX_FAST_MODEL || null,
  standard:  process.env.NEX_STANDARD_MODEL || null,
  full:      process.env.NEX_HEAVY_MODEL || null,
};

/**
 * Resolve the model for a sub-agent: explicit override, ENV tier override, or auto-routing.
 * Priority: agentDef.model > NEX_HEAVY/STANDARD/FAST_MODEL > pickModelForTier > active model
 * @param {{ task: string, model?: string }} agentDef
 * @returns {{ provider: string|null, model: string|null, tier: string|null }}
 */
function resolveSubAgentModel(agentDef) {
  // Explicit LLM override: parse "provider:model" format
  if (agentDef.model) {
    const { provider, model } = parseModelSpec(agentDef.model);
    const prov = provider ? getProvider(provider) : getActiveProvider();
    const provName = provider || getActiveProviderName();
    if (prov && prov.isConfigured() && (prov.getModel(model) || provName === 'local')) {
      const tier = getModelTier(model, provName);
      return { provider: provName, model, tier };
    }
    // Invalid spec → fall through to ENV/auto-routing
  }

  // Classify task to determine target tier
  const targetTier = classifyTask(agentDef.task);

  // ENV tier override: NEX_HEAVY_MODEL / NEX_STANDARD_MODEL / NEX_FAST_MODEL
  const envModel = ENV_TIER_MODELS[targetTier];
  if (envModel) {
    const { provider, model } = parseModelSpec(envModel);
    const prov = provider ? getProvider(provider) : getActiveProvider();
    const provName = provider || getActiveProviderName();
    if (prov && prov.isConfigured() && (prov.getModel(model) || provName === 'local')) {
      const tier = getModelTier(model, provName);
      return { provider: provName, model, tier };
    }
    // ENV model not found/configured → fall through to auto-routing
  }

  // Auto-routing: pick best available model at target tier
  const pick = pickModelForTier(targetTier);
  if (pick) {
    const tier = getModelTier(pick.model, pick.provider);
    return { provider: pick.provider, model: pick.model, tier };
  }

  // Ultimate fallback: use global active model
  return { provider: null, model: null, tier: null };
}

/**
 * Run a single sub-agent to completion.
 * @param {{ task: string, context?: string, max_iterations?: number }} agentDef
 * @param {{ onUpdate?: (status: string) => void }} callbacks
 * @returns {{ task: string, status: 'done'|'failed', result: string, toolsUsed: string[], tokensUsed: { input: number, output: number } }}
 */
async function runSubAgent(agentDef, callbacks = {}, _depth = 0) {
  const depthMaxIter = _depth === 0 ? MAX_SUB_ITERATIONS : MAX_REVIEWER_ITERATIONS;
  const maxIter = Math.min(agentDef.max_iterations || 10, depthMaxIter);
  const agentId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const toolsUsed = [];
  const tokensUsed = { input: 0, output: 0 };
  const locksHeld = new Set();

  const systemPrompt = `You are a focused sub-agent. Complete this specific task efficiently.

TASK: ${agentDef.task}
${agentDef.context ? `\nCONTEXT: ${agentDef.context}` : ''}

WORKING DIRECTORY: ${process.cwd()}

RULES:
- Focus only on your assigned task. Be concise and efficient.
- When done, respond with a clear summary of what you did and the result.
- Do not ask questions — make reasonable decisions.
- Use relative paths when possible.

TOOL STRATEGY:
- Use read_file to read files (not bash cat). Use edit_file/patch_file to modify (not bash sed).
- Use glob to find files by name. Use grep to search contents. Only use bash for shell operations.
- ALWAYS read a file with read_file before editing it. edit_file old_text must match exactly.

ERROR RECOVERY:
- If edit_file fails with "old_text not found": read the file again, compare, and retry with exact text.
- If bash fails: read the error, fix the root cause, then retry.
- After 2 failed attempts at the same operation, summarize the issue and stop.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  messages.push({ role: 'user', content: agentDef.task });

  // Resolve model routing
  const routing = resolveSubAgentModel(agentDef);
  const agentProvider = routing.provider;
  const agentModel = routing.model;
  const agentTier = routing.tier;

  // Lazy require to avoid circular dependency (tools.js ↔ sub-agent.js)
  const { TOOL_DEFINITIONS, executeTool } = require('./tools');

  // Filter tools: exclude interactive/meta tools (depth-aware), apply tier override
  const excludedTools = getExcludedTools(_depth);
  const availableTools = filterToolsForModel(
    TOOL_DEFINITIONS.filter(t => !excludedTools.has(t.function.name)),
    agentTier
  );

  // Log sub-agent model selection only when running standalone (not inside executeSpawnAgents)
  // When running via spawn_agents, the model is already shown in the progress bar label.
  if (agentModel && !agentDef._skipLog) {
    const tierLabel = agentTier ? ` (${agentTier})` : '';
    process.stderr.write(`  [sub-agent: ${agentProvider}:${agentModel}${tierLabel}]\n`);
  }

  // Build callChat options for provider/model routing
  const chatOptions = {};
  if (agentProvider) chatOptions.provider = agentProvider;
  if (agentModel) chatOptions.model = agentModel;

  try {
    for (let i = 0; i < maxIter; i++) {
      const result = await callWithRetry(messages, availableTools, chatOptions);

      // Guard against null/undefined responses
      if (!result || typeof result !== 'object') {
        throw new Error('Empty or invalid response from provider');
      }

      // Track tokens
      if (result.usage) {
        const inputT = result.usage.prompt_tokens || 0;
        const outputT = result.usage.completion_tokens || 0;
        tokensUsed.input += inputT;
        tokensUsed.output += outputT;
        const trackProvider = agentProvider || getActiveProviderName();
        const trackModel = agentModel || getActiveModelId();
        trackUsage(trackProvider, trackModel, inputT, outputT);
      }

      const content = result.content || '';
      const tool_calls = result.tool_calls;

      // Build assistant message
      const assistantMsg = { role: 'assistant', content: content || '' };
      if (tool_calls && tool_calls.length > 0) {
        assistantMsg.tool_calls = tool_calls;
      }
      messages.push(assistantMsg);

      // No tool calls → agent is done
      if (!tool_calls || tool_calls.length === 0) {
        // Release all locks
        for (const fp of locksHeld) releaseLock(fp);

        return {
          task: agentDef.task,
          status: 'done',
          result: content || '(no response)',
          toolsUsed,
          tokensUsed,
          modelSpec: agentProvider && agentModel ? `${agentProvider}:${agentModel}` : null,
        };
      }

      // Execute tool calls in parallel — lock acquisition is synchronous so
      // write-tool locking stays atomic even with concurrent execution.
      const toolResultPromises = tool_calls.map(tc => {
        const fnName = tc.function.name;
        const args = parseToolArgs(tc.function.arguments);
        const callId = tc.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (!args) {
          return Promise.resolve({
            role: 'tool',
            content: `ERROR: Malformed tool arguments for ${fnName}`,
            tool_call_id: callId,
          });
        }

        // File locking for write tools (synchronous — runs before any await).
        // Lock is denied even for same agentId if already held, to prevent
        // concurrent writes from parallel tool calls within one iteration batch.
        let lockedFp = null;
        if (WRITE_TOOLS.has(fnName) && args.path) {
          const pathModule = require('path');
          const fp = pathModule.isAbsolute(args.path)
            ? args.path
            : pathModule.resolve(process.cwd(), args.path);
          if (locksHeld.has(fp) || !acquireLock(fp, agentId)) {
            return Promise.resolve({
              role: 'tool',
              content: `ERROR: File '${args.path}' is locked by another operation. Try a different approach or skip this file.`,
              tool_call_id: callId,
            });
          }
          locksHeld.add(fp);
          lockedFp = fp;
        }

        toolsUsed.push(fnName);

        // Intercept nested spawn_agents: call executeSpawnAgents with depth+1
        // instead of going through the generic executeTool dispatch.
        const execToolOrNested = fnName === 'spawn_agents'
          ? executeSpawnAgents(args, _depth + 1)
          : executeTool(fnName, args, { autoConfirm: true, silent: true });

        return execToolOrNested
          .then(toolResult => {
            // Release lock immediately after write completes — don't hold until
            // end-of-iteration so other tool calls in subsequent iterations can proceed.
            if (lockedFp) { releaseLock(lockedFp); locksHeld.delete(lockedFp); }
            const safeResult = String(toolResult ?? '');
            const truncated = safeResult.length > 20000
              ? safeResult.substring(0, 20000) + `\n...(truncated)`
              : safeResult;
            return { role: 'tool', content: truncated, tool_call_id: callId };
          })
          .catch(err => {
            if (lockedFp) { releaseLock(lockedFp); locksHeld.delete(lockedFp); }
            return { role: 'tool', content: `ERROR: ${err.message}`, tool_call_id: callId };
          });
      });

      const toolMessages = await Promise.all(toolResultPromises);
      messages.push(...toolMessages);

      if (callbacks.onUpdate) {
        callbacks.onUpdate(`step ${i + 1}/${maxIter}`);
      }
    }

    // Max iterations reached
    for (const fp of locksHeld) releaseLock(fp);

    return {
      task: agentDef.task,
      status: 'truncated',
      abortReason: 'iteration_limit',
      result: messages[messages.length - 1]?.content || '(max iterations reached)',
      toolsUsed,
      tokensUsed,
      modelSpec: agentProvider && agentModel ? `${agentProvider}:${agentModel}` : null,
    };
  } catch (err) {
    // Release locks on error
    for (const fp of locksHeld) releaseLock(fp);

    return {
      task: agentDef.task,
      status: 'failed',
      result: `Error: ${err.message}`,
      toolsUsed,
      tokensUsed,
      modelSpec: agentProvider && agentModel ? `${agentProvider}:${agentModel}` : null,
    };
  }
}

/**
 * Execute spawn_agents tool: run multiple sub-agents in parallel.
 * @param {{ agents: Array<{ task: string, context?: string, max_iterations?: number }> }} args
 * @param {number} _depth - current nesting depth (0 = top-level, 1 = reviewer level)
 * @returns {string} Formatted results for the parent LLM
 */
async function executeSpawnAgents(args, _depth = 0) {
  // Hard block: no spawning beyond depth 1
  if (_depth >= 2) {
    return 'ERROR: max agent nesting depth (2) reached — reviewer agents cannot spawn further agents.';
  }

  const maxAgents = _depth === 0 ? MAX_PARALLEL_AGENTS : MAX_REVIEWER_AGENTS;
  const maxIter = _depth === 0 ? MAX_SUB_ITERATIONS : MAX_REVIEWER_ITERATIONS;

  // Defensive copy so we can trim without mutating caller args
  let agents = (args.agents || []).slice(0, maxAgents);

  if (agents.length === 0) return 'ERROR: No agents specified';

  // Visual: depth-1 agents are indented with ↳ to show hierarchy in the terminal
  const labelPrefix = _depth > 0 ? '  \u21b3 ' : '';  // '  ↳ '
  const maxTaskLen = _depth > 0 ? 38 : 44;

  // Resolve models upfront so labels can include model info (avoids interleaving with spinner)
  const routings = agents.map(a => resolveSubAgentModel(a));
  const labels = agents.map((a, i) => {
    const r = routings[i];
    const modelTag = r.model ? ` [${r.model}]` : '';
    const task = a.task.substring(0, maxTaskLen - modelTag.length);
    return `${labelPrefix}Agent ${i + 1}${modelTag}: ${task}${a.task.length > task.length ? '...' : ''}`;
  });
  const progress = new MultiProgress(labels);
  progress.start();

  try {
    const promises = agents.map((agentDef, idx) => {
      // Pass pre-resolved model, suppress per-agent stderr log (shown in label already),
      // and cap iterations at the depth-appropriate limit.
      const r = routings[idx];
      const cappedIterations = Math.min(agentDef.max_iterations || maxIter, maxIter);
      const defWithRouting = r.model
        ? { ...agentDef, model: `${r.provider}:${r.model}`, _skipLog: true, max_iterations: cappedIterations }
        : { ...agentDef, _skipLog: true, max_iterations: cappedIterations };
      return runSubAgent(defWithRouting, {
        onUpdate: () => {}, // progress is already showing spinner
      }, _depth).then(result => {
        progress.update(idx, result.status === 'failed' ? 'error' : 'done');
        return result;
      }).catch(err => {
        progress.update(idx, 'error');
        return {
          task: agentDef.task,
          status: 'failed',
          result: `Error: ${err.message}`,
          toolsUsed: [],
          tokensUsed: { input: 0, output: 0 },
        };
      });
    });

    const results = await Promise.all(promises);
    progress.stop();

    // Clear all locks after all agents finish
    clearAllLocks();

    // Format results for the parent LLM
    const lines = ['Sub-agent results:', ''];
    let totalInput = 0;
    let totalOutput = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const statusIcon = r.status === 'done' ? '✓' : r.status === 'truncated' ? '⚠' : '✗';
      const modelLabel = r.modelSpec ? ` [${r.modelSpec}]` : '';
      lines.push(`${statusIcon} Agent ${i + 1}${modelLabel}: ${r.task}`);
      lines.push(`  Status: ${r.status}`);
      lines.push(`  Tools used: ${r.toolsUsed.length > 0 ? r.toolsUsed.join(', ') : 'none'}`);
      lines.push(`  Result: ${r.result}`);
      lines.push('');
      totalInput += r.tokensUsed.input;
      totalOutput += r.tokensUsed.output;
    }

    lines.push(`Total sub-agent tokens: ${totalInput} input + ${totalOutput} output`);

    return lines.join('\n');
  } catch (err) {
    progress.stop();
    clearAllLocks();
    return `ERROR: Sub-agent execution failed: ${err.message}`;
  }
}

module.exports = { runSubAgent, executeSpawnAgents, clearAllLocks, classifyTask, pickModelForTier, resolveSubAgentModel, isRetryableError, callWithRetry, getExcludedTools, LOCK_TIMEOUT_MS };

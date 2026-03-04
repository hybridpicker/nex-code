/**
 * cli/sub-agent.js — Sub-Agent Runner
 * Spawns parallel sub-agents with their own conversation contexts.
 */

const { callChat, getActiveProviderName, getActiveModelId, getConfiguredProviders, getProvider, getActiveProvider, parseModelSpec } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { filterToolsForModel, getModelTier } = require('./tool-tiers');
const { trackUsage } = require('./costs');
const { MultiProgress, C } = require('./ui');

const MAX_SUB_ITERATIONS = 15;
const MAX_PARALLEL_AGENTS = 5;
const MAX_CHAT_RETRIES = 3;

// ─── File Locking ─────────────────────────────────────────────
// Map<filePath, agentId> — allows same agent to re-lock its own files
const lockedFiles = new Map();

function acquireLock(filePath, agentId) {
  const owner = lockedFiles.get(filePath);
  if (owner && owner !== agentId) return false;
  lockedFiles.set(filePath, agentId);
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

async function callChatWithRetry(messages, tools, options) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_CHAT_RETRIES; attempt++) {
    try {
      return await callChat(messages, tools, options);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_CHAT_RETRIES && isRetryableError(err)) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 15000);
        await new Promise(r => setTimeout(r, delay).unref());
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Tools that sub-agents should NOT have access to
const EXCLUDED_TOOLS = new Set(['ask_user', 'task_list', 'spawn_agents']);

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

/**
 * Resolve the model for a sub-agent: explicit override or auto-routing.
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
    // Invalid spec → fall through to auto-routing
  }

  // Auto-routing: classify task → pick model at matching tier
  const targetTier = classifyTask(agentDef.task);
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
async function runSubAgent(agentDef, callbacks = {}) {
  const maxIter = Math.min(agentDef.max_iterations || 10, MAX_SUB_ITERATIONS);
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

  // Filter tools: exclude interactive/meta tools, apply tier override
  const availableTools = filterToolsForModel(
    TOOL_DEFINITIONS.filter(t => !EXCLUDED_TOOLS.has(t.function.name)),
    agentTier
  );

  // Build callChat options for provider/model routing
  const chatOptions = {};
  if (agentProvider) chatOptions.provider = agentProvider;
  if (agentModel) chatOptions.model = agentModel;

  try {
    for (let i = 0; i < maxIter; i++) {
      const result = await callChatWithRetry(messages, availableTools, chatOptions);

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

      // Execute tool calls sequentially within sub-agent
      for (const tc of tool_calls) {
        const fnName = tc.function.name;
        const args = parseToolArgs(tc.function.arguments);
        const callId = tc.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (!args) {
          messages.push({
            role: 'tool',
            content: `ERROR: Malformed tool arguments for ${fnName}`,
            tool_call_id: callId,
          });
          continue;
        }

        // File locking for write tools
        if (WRITE_TOOLS.has(fnName) && args.path) {
          const path = require('path');
          const fp = path.isAbsolute(args.path) ? args.path : path.resolve(process.cwd(), args.path);
          if (!acquireLock(fp, agentId)) {
            messages.push({
              role: 'tool',
              content: `ERROR: File '${args.path}' is locked by another sub-agent. Try a different approach or skip this file.`,
              tool_call_id: callId,
            });
            continue;
          }
          locksHeld.add(fp);
        }

        toolsUsed.push(fnName);

        try {
          const toolResult = await executeTool(fnName, args, { autoConfirm: true, silent: true });
          const safeResult = String(toolResult ?? '');
          const truncated = safeResult.length > 20000
            ? safeResult.substring(0, 20000) + `\n...(truncated)`
            : safeResult;

          messages.push({ role: 'tool', content: truncated, tool_call_id: callId });
        } catch (err) {
          messages.push({
            role: 'tool',
            content: `ERROR: ${err.message}`,
            tool_call_id: callId,
          });
        }
      }

      if (callbacks.onUpdate) {
        callbacks.onUpdate(`step ${i + 1}/${maxIter}`);
      }
    }

    // Max iterations reached
    for (const fp of locksHeld) releaseLock(fp);

    return {
      task: agentDef.task,
      status: 'done',
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
 * @returns {string} Formatted results for the parent LLM
 */
async function executeSpawnAgents(args) {
  const agents = args.agents || [];

  if (agents.length === 0) return 'ERROR: No agents specified';
  if (agents.length > MAX_PARALLEL_AGENTS) {
    return `ERROR: Max ${MAX_PARALLEL_AGENTS} parallel agents allowed, got ${agents.length}`;
  }

  const labels = agents.map((a, i) => `Agent ${i + 1}: ${a.task.substring(0, 50)}${a.task.length > 50 ? '...' : ''}`);
  const progress = new MultiProgress(labels);
  progress.start();

  try {
    const promises = agents.map((agentDef, idx) =>
      runSubAgent(agentDef, {
        onUpdate: () => {}, // progress is already showing spinner
      }).then(result => {
        progress.update(idx, result.status === 'done' ? 'done' : 'error');
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
      })
    );

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
      const statusIcon = r.status === 'done' ? '✓' : '✗';
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

module.exports = { runSubAgent, executeSpawnAgents, clearAllLocks, classifyTask, pickModelForTier, resolveSubAgentModel, isRetryableError, callChatWithRetry };

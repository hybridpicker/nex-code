/**
 * cli/sub-agent.js — Sub-Agent Runner
 * Spawns parallel sub-agents with their own conversation contexts.
 */

const { callChat } = require('./providers/registry');
const { getActiveProviderName, getActiveModelId } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');
const { filterToolsForModel } = require('./tool-tiers');
const { trackUsage } = require('./costs');
const { MultiProgress, C } = require('./ui');

const MAX_SUB_ITERATIONS = 15;
const MAX_PARALLEL_AGENTS = 5;

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

// Tools that sub-agents should NOT have access to
const EXCLUDED_TOOLS = new Set(['ask_user', 'task_list', 'spawn_agents']);

// Tools that need file locking
const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'patch_file']);

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
- Focus only on your assigned task.
- Be concise and efficient. Use minimal tool calls.
- When done, respond with a clear summary of what you did and the result.
- Do not ask questions — make reasonable decisions.
- Use relative paths when possible.`;

  const messages = [{ role: 'system', content: systemPrompt }];
  messages.push({ role: 'user', content: agentDef.task });

  // Filter tools: exclude interactive/meta tools
  const availableTools = filterToolsForModel(
    TOOL_DEFINITIONS.filter(t => !EXCLUDED_TOOLS.has(t.function.name))
  );

  try {
    for (let i = 0; i < maxIter; i++) {
      const result = await callChat(messages, availableTools);

      // Track tokens
      if (result && result.usage) {
        const inputT = result.usage.prompt_tokens || 0;
        const outputT = result.usage.completion_tokens || 0;
        tokensUsed.input += inputT;
        tokensUsed.output += outputT;
        trackUsage(getActiveProviderName(), getActiveModelId(), inputT, outputT);
      }

      const { content, tool_calls } = result;

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
      lines.push(`${statusIcon} Agent ${i + 1}: ${r.task}`);
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

module.exports = { runSubAgent, executeSpawnAgents, clearAllLocks };

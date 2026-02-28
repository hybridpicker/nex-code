/**
 * cli/agent.js — Agentic Loop + Conversation State
 * Hybrid: chat + tool-use in a single conversation.
 */

const { C, Spinner, formatToolCall, formatResult, formatToolSummary } = require('./ui');
const { callStream } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');
const { gatherProjectContext } = require('./context');
const { fitToContext, getUsage } = require('./context-engine');
const { autoSave } = require('./session');
const { getMemoryContext } = require('./memory');
const { checkPermission, setPermission, savePermissions } = require('./permissions');
const { confirm, setAllowAlwaysHandler } = require('./safety');
const { isPlanMode, getPlanModePrompt } = require('./planner');
const { StreamRenderer } = require('./render');
const { runHooks } = require('./hooks');
const { routeMCPCall, getMCPToolDefinitions } = require('./mcp');
const { getSkillInstructions, getSkillToolDefinitions, routeSkillCall } = require('./skills');
const { trackUsage } = require('./costs');
const { validateToolArgs } = require('./tool-validator');
const { filterToolsForModel, getModelTier, PROVIDER_DEFAULT_TIER } = require('./tool-tiers');
const { getConfiguredProviders } = require('./providers/registry');

const MAX_ITERATIONS = 30;

// Tools that can safely run in parallel (read-only, no side effects)
const PARALLEL_SAFE = new Set([
  'read_file', 'list_directory', 'search_files', 'glob', 'grep',
  'web_fetch', 'web_search', 'git_status', 'git_diff', 'git_log',
]);
const MAX_RATE_LIMIT_RETRIES = 5;
const CWD = process.cwd();

// Wire up "a" (always allow) from confirm dialog → permission system
setAllowAlwaysHandler((toolName) => {
  setPermission(toolName, 'allow');
  savePermissions();
  console.log(`${C.green}  ✓ ${toolName}: always allow${C.reset}`);
});

// ─── Tool Call Helpers ────────────────────────────────────────

/**
 * Prepare a tool call: parse args, validate, check permissions.
 * Returns an object ready for execution.
 */
async function prepareToolCall(tc) {
  const fnName = tc.function.name;
  const args = parseToolArgs(tc.function.arguments);
  const callId = tc.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Malformed args
  if (!args) {
    const allToolDefs = [...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()];
    const toolDef = allToolDefs.find(t => t.function.name === fnName);
    const schema = toolDef ? JSON.stringify(toolDef.function.parameters, null, 2) : 'unknown';
    console.log(`${C.yellow}  ⚠ ${fnName}: malformed arguments, sending schema hint${C.reset}`);
    return {
      callId, fnName, args: null, canExecute: false,
      errorResult: {
        role: 'tool',
        content: `ERROR: Malformed tool arguments. Could not parse your arguments as JSON.\n` +
          `Raw input: ${typeof tc.function.arguments === 'string' ? tc.function.arguments.substring(0, 200) : 'N/A'}\n\n` +
          `Expected JSON schema for "${fnName}":\n${schema}\n\n` +
          `Please retry the tool call with valid JSON arguments matching this schema.`,
        tool_call_id: callId,
      },
    };
  }

  // Validate
  const validation = validateToolArgs(fnName, args);
  if (!validation.valid) {
    console.log(`${C.yellow}  ⚠ ${fnName}: ${validation.error.split('\n')[0]}${C.reset}`);
    return {
      callId, fnName, args, canExecute: false,
      errorResult: { role: 'tool', content: validation.error, tool_call_id: callId },
    };
  }

  const finalArgs = validation.corrected || args;

  // Permission check
  const perm = checkPermission(fnName);
  if (perm === 'deny') {
    console.log(`${C.red}  ✗ ${fnName}: denied by permissions${C.reset}`);
    return {
      callId, fnName, args: finalArgs, canExecute: false,
      errorResult: { role: 'tool', content: `DENIED: Tool '${fnName}' is blocked by permissions`, tool_call_id: callId },
    };
  }
  if (perm === 'ask') {
    const ok = await confirm(`  Allow ${fnName}?`, { toolName: fnName });
    if (!ok) {
      return {
        callId, fnName, args: finalArgs, canExecute: false,
        errorResult: { role: 'tool', content: `CANCELLED: User declined ${fnName}`, tool_call_id: callId },
      };
    }
  }

  return { callId, fnName, args: finalArgs, canExecute: true, errorResult: null };
}

/**
 * Execute a single prepared tool call through the routing chain.
 */
async function executeToolRouted(fnName, args, options = {}) {
  const skillResult = await routeSkillCall(fnName, args);
  if (skillResult !== null) return skillResult;
  const mcpResult = await routeMCPCall(fnName, args);
  if (mcpResult !== null) return mcpResult;
  return executeTool(fnName, args, options);
}

/**
 * Short arg preview for spinner labels.
 */
function _argPreview(name, args) {
  switch (name) {
    case 'read_file': case 'write_file': case 'edit_file':
    case 'patch_file': case 'list_directory':
      return args.path || '';
    case 'bash':
      return (args.command || '').substring(0, 60);
    case 'grep': case 'search_files': case 'glob':
      return args.pattern || '';
    case 'web_fetch':
      return (args.url || '').substring(0, 50);
    case 'web_search':
      return (args.query || '').substring(0, 40);
    default:
      return '';
  }
}

/**
 * Execute a single prepared tool and return { msg, summary }.
 * @param {boolean} quiet - suppress formatToolCall/formatResult output
 */
async function executeSingleTool(prep, quiet = false) {
  if (!quiet) {
    console.log(formatToolCall(prep.fnName, prep.args));
  }

  runHooks('pre-tool', { tool_name: prep.fnName });

  const toolResult = await executeToolRouted(prep.fnName, prep.args, { silent: true });
  const safeResult = String(toolResult ?? '');
  const truncated = safeResult.length > 50000
    ? safeResult.substring(0, 50000) + `\n...(truncated ${safeResult.length - 50000} chars)`
    : safeResult;

  if (!quiet) {
    console.log(formatResult(truncated));
  }

  runHooks('post-tool', { tool_name: prep.fnName });

  const isError = truncated.startsWith('ERROR') || truncated.includes('CANCELLED') || truncated.includes('BLOCKED');
  const summary = formatToolSummary(prep.fnName, prep.args, truncated, isError);
  const msg = { role: 'tool', content: truncated, tool_call_id: prep.callId };
  return { msg, summary };
}

/**
 * Execute prepared tool calls with parallel batching.
 * Consecutive PARALLEL_SAFE tools run via Promise.all.
 * @param {boolean} quiet - use spinner + compact summaries instead of verbose output
 */
async function executeBatch(prepared, quiet = false) {
  const results = new Array(prepared.length);
  const summaries = [];
  let batch = [];

  // Quiet mode: show a single spinner for all tools
  let spinner = null;
  if (quiet) {
    const execTools = prepared.filter(p => p.canExecute);
    if (execTools.length > 0) {
      let label;
      if (execTools.length === 1) {
        const p = execTools[0];
        label = `▸ ${p.fnName} ${_argPreview(p.fnName, p.args)}`;
      } else {
        const names = execTools.map(p => p.fnName).join(', ');
        label = `▸ ${execTools.length} tools: ${names.length > 60 ? names.substring(0, 57) + '...' : names}`;
      }
      spinner = new Spinner(label);
      spinner.start();
    }
  }

  async function flushBatch() {
    if (batch.length === 0) return;
    if (batch.length === 1) {
      const idx = batch[0];
      const { msg, summary } = await executeSingleTool(prepared[idx], quiet);
      results[idx] = msg;
      summaries.push(summary);
    } else {
      const promises = batch.map(idx => executeSingleTool(prepared[idx], quiet));
      const batchResults = await Promise.all(promises);
      for (let j = 0; j < batch.length; j++) {
        results[batch[j]] = batchResults[j].msg;
        summaries.push(batchResults[j].summary);
      }
    }
    batch = [];
  }

  for (let i = 0; i < prepared.length; i++) {
    const prep = prepared[i];

    if (!prep.canExecute) {
      await flushBatch();
      results[i] = prep.errorResult;
      summaries.push(formatToolSummary(prep.fnName, prep.args || {}, prep.errorResult.content, true));
      continue;
    }

    if (PARALLEL_SAFE.has(prep.fnName)) {
      batch.push(i);
    } else {
      await flushBatch();
      const { msg, summary } = await executeSingleTool(prep, quiet);
      results[i] = msg;
      summaries.push(summary);
    }
  }

  await flushBatch();

  // Stop spinner and print compact summaries
  if (spinner) spinner.stop();
  if (quiet && summaries.length > 0) {
    for (const s of summaries) console.log(s);
  }

  return results;
}

// Persistent conversation state
let conversationMessages = [];

/**
 * Build dynamic model routing guide for spawn_agents.
 * Only shown when 2+ models are available across configured providers.
 */
function _buildModelRoutingGuide() {
  try {
    const configured = getConfiguredProviders();
    const allModels = configured.flatMap(p =>
      p.models.map(m => ({
        spec: `${p.name}:${m.id}`,
        tier: getModelTier(m.id, p.name),
        name: m.name,
      }))
    );

    if (allModels.length < 2) return '';

    const tierLabels = {
      full: 'complex tasks (refactor, implement, generate)',
      standard: 'regular tasks (edit, fix, analyze)',
      essential: 'simple tasks (read, search, list)',
    };

    let guide = '\n# Sub-Agent Model Routing\n\n';
    guide += 'Sub-agents auto-select models by task complexity. Override with `model: "provider:model"` in agent definition.\n\n';
    guide += '| Model | Tier | Auto-assigned for |\n|---|---|---|\n';
    for (const m of allModels) {
      guide += `| ${m.spec} | ${m.tier} | ${tierLabels[m.tier] || m.tier} |\n`;
    }
    return guide;
  } catch {
    return '';
  }
}

function buildSystemPrompt() {
  const projectContext = gatherProjectContext(CWD);

  const memoryContext = getMemoryContext();
  const skillInstructions = getSkillInstructions();
  const planPrompt = isPlanMode() ? getPlanModePrompt() : '';

  return `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${CWD}
All relative paths resolve from this directory.

PROJECT CONTEXT:
${projectContext}
${memoryContext ? `\n${memoryContext}\n` : ''}${skillInstructions ? `\n${skillInstructions}\n` : ''}${planPrompt ? `\n${planPrompt}\n` : ''}
# Core Behavior

- You can use tools OR respond with text. For simple questions, answer directly.
- For coding tasks, use tools to read files, make changes, run tests, etc.
- IMPORTANT: After gathering information with tools, ALWAYS write a substantive text response presenting your findings, analysis, or summary. Never end a turn with only tool calls and no text. The user cannot see tool results directly — they only see your text responses and 1-line tool summaries.
- When the user asks a question, requests analysis, or says "status", "analyze", "explain", "summarize", etc. — your main job is to RESPOND WITH TEXT. Use tools to gather data, then present a clear, informative answer.
- Be concise but complete. Keep responses focused while ensuring the user gets the information they asked for.
- When referencing code, include file:line (e.g. src/app.js:42) so the user can navigate.
- Do not make up file paths or URLs. Use tools to discover them.

# Doing Tasks

- ALWAYS read code before modifying it. Never propose changes to code you haven't read.
- Prefer edit_file for targeted changes over write_file for full rewrites.
- Do not create new files unless absolutely necessary. Edit existing files instead.
- Use relative paths when possible.
- When blocked, try alternative approaches rather than retrying the same thing.
- Keep solutions simple. Only change what's directly requested or clearly necessary.
  - Don't add features, refactoring, or "improvements" beyond what was asked.
  - Don't add error handling for impossible scenarios. Only validate at system boundaries.
  - Don't add docstrings/comments to code you didn't change.
  - Don't create helpers or abstractions for one-time operations.
  - Three similar lines of code is better than a premature abstraction.

# Tool Strategy

- Use the RIGHT tool for the job:
  - read_file to read files (not bash cat/head/tail)
  - edit_file or patch_file to modify files (not bash sed/awk)
  - glob to find files by name pattern (not bash find/ls)
  - grep or search_files to search file contents (not bash grep)
  - list_directory for directory structure (not bash ls/tree)
  - Only use bash for actual shell operations: running tests, installing packages, git commands, build tools.
- Call multiple tools in parallel when they're independent (e.g. reading multiple files at once).
- For complex tasks with 3+ steps, create a task list with task_list first.
- Use spawn_agents for 2+ independent tasks that can run simultaneously.
  - Good for: reading multiple files, analyzing separate modules.
  - Bad for: tasks that depend on each other or modify the same file.
  - Max 5 parallel agents.
${_buildModelRoutingGuide()}

# Edit Reliability (Critical)

- edit_file's old_text must match the file content EXACTLY — including whitespace, indentation, and newlines.
- Always read the file first (read_file) before editing to see the exact current content.
- If old_text is not found, the edit fails. Common causes:
  - Indentation mismatch (tabs vs spaces, wrong level)
  - Invisible characters or trailing whitespace
  - Content changed since last read — read again before retrying.
- For multiple changes to the same file, prefer patch_file (single operation, atomic).
- Never guess file content. Always read first, then edit with the exact text you saw.

# Error Recovery

When a tool call returns ERROR:
- edit_file/patch_file "old_text not found": Read the file again with read_file. Compare your old_text with the actual content. The most common cause is stale content — the file changed since you last read it.
- bash non-zero exit: Read the error output. Fix the root cause (missing dependency, wrong path, syntax error) rather than retrying the same command.
- "File not found": Use glob or list_directory to find the correct path. Do not guess.
- After 2 failed attempts at the same operation, stop and explain the issue to the user.

# Git Workflow

- Before committing, review changes with git_diff. Write messages that explain WHY, not WHAT.
- Stage specific files rather than git add -A to avoid committing unrelated changes.
- Use conventional commits: type(scope): description (feat, fix, refactor, docs, test, chore).
- Branch naming: feat/, fix/, refactor/, docs/ prefixes with kebab-case.
- NEVER force-push, skip hooks (--no-verify), or amend published commits without explicit permission.
- When asked to commit: review diff, propose message, wait for approval, then execute.

# Safety & Reversibility

- Consider reversibility before acting. File reads and searches are safe. File writes and bash commands may not be.
- For hard-to-reverse actions (deleting files, force-pushing, dropping tables), confirm with the user first.
- NEVER read .env files, credentials, or SSH keys.
- NEVER run destructive commands (rm -rf /, mkfs, dd, etc.).
- Dangerous commands (git push, npm publish, sudo, rm -rf) require user confirmation.
- Prefer creating new git commits over amending. Never force-push without explicit permission.
- If you encounter unexpected state (unfamiliar files, branches), investigate before modifying.`;
}

function clearConversation() {
  conversationMessages = [];
}

function getConversationLength() {
  return conversationMessages.length;
}

function getConversationMessages() {
  return conversationMessages;
}

function setConversationMessages(messages) {
  conversationMessages = messages;
}

/**
 * Print résumé + follow-up suggestions after the agent loop.
 * Only shown for multi-step responses (totalSteps >= 1).
 */
function _printResume(totalSteps, toolCounts, filesModified) {
  if (totalSteps < 1) return;

  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);
  let resume = `── ${totalSteps} ${totalSteps === 1 ? 'step' : 'steps'} · ${totalTools} ${totalTools === 1 ? 'tool' : 'tools'}`;
  if (filesModified.size > 0) {
    resume += ` · ${filesModified.size} ${filesModified.size === 1 ? 'file' : 'files'} modified`;
  }
  resume += ' ──';
  console.log(`\n${C.dim}  ${resume}${C.reset}`);

  // Follow-up suggestions (only when files were modified)
  if (filesModified.size > 0) {
    console.log(`${C.dim}  💡 /diff · /commit · /undo${C.reset}`);
  }
}

/**
 * Process a single user input through the agentic loop.
 * Maintains conversation state across calls.
 */
async function processInput(userInput) {
  conversationMessages.push({ role: 'user', content: userInput });

  const systemPrompt = buildSystemPrompt();
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...conversationMessages];

  // Context-aware compression: fit messages into context window
  const { messages: fittedMessages, compressed, tokensRemoved } = fitToContext(
    fullMessages,
    TOOL_DEFINITIONS
  );

  if (compressed) {
    console.log(`${C.dim}  [context compressed, ~${tokensRemoved} tokens freed]${C.reset}`);
  }

  // Context budget warning
  const usage = getUsage(fullMessages, TOOL_DEFINITIONS);
  if (usage.percentage > 85) {
    console.log(`${C.yellow}  ⚠ Context ${Math.round(usage.percentage)}% full — consider /clear or /save + start fresh${C.reset}`);
  }

  // Use fitted messages for the API call, but keep fullMessages reference for appending
  let apiMessages = fittedMessages;
  let rateLimitRetries = 0;

  // ─── Stats tracking for résumé ───
  let totalSteps = 0;
  const toolCounts = new Map();
  const filesModified = new Set();

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Step indicator for multi-step tasks
    if (i > 0) {
      console.log(`${C.dim}  ⟳ step ${i + 1}${C.reset}`);
    }

    const spinnerText = i > 0 ? `Thinking... (step ${i + 1})` : 'Thinking...';
    const spinner = new Spinner(spinnerText);
    spinner.start();
    let firstToken = true;
    let streamedText = '';
    const stream = new StreamRenderer();

    let result;
    try {
      const allTools = filterToolsForModel([...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()]);
      result = await callStream(apiMessages, allTools, {
        onToken: (text) => {
          if (firstToken) {
            spinner.stop();
            firstToken = false;
          }
          streamedText += text;
          stream.push(text);
        },
      });
    } catch (err) {
      spinner.stop();
      console.log(`${C.red}${err.message}${C.reset}`);

      if (err.message.includes('429')) {
        rateLimitRetries++;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
          console.log(`${C.red}  Rate limit: max retries (${MAX_RATE_LIMIT_RETRIES}) exceeded${C.reset}`);
          _printResume(totalSteps, toolCounts, filesModified);
          autoSave(conversationMessages);
          break;
        }
        const delay = Math.min(10000 * Math.pow(2, rateLimitRetries - 1), 120000);
        console.log(`${C.yellow}  Rate limit — waiting ${Math.round(delay / 1000)}s (retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})...${C.reset}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Auto-save on error so conversation isn't lost
      _printResume(totalSteps, toolCounts, filesModified);
      autoSave(conversationMessages);
      break;
    }

    if (firstToken) {
      spinner.stop();
    }

    // Flush remaining stream buffer
    if (streamedText) {
      stream.flush();
    }

    // Track token usage for cost dashboard
    if (result && result.usage) {
      const { getActiveProviderName, getActiveModelId } = require('./providers/registry');
      trackUsage(
        getActiveProviderName(),
        getActiveModelId(),
        result.usage.prompt_tokens || 0,
        result.usage.completion_tokens || 0
      );
    }

    const { content, tool_calls } = result;

    // Build assistant message for history
    const assistantMsg = { role: 'assistant', content: content || '' };
    if (tool_calls && tool_calls.length > 0) {
      assistantMsg.tool_calls = tool_calls;
    }
    conversationMessages.push(assistantMsg);
    apiMessages.push(assistantMsg);

    // No tool calls → response complete
    if (!tool_calls || tool_calls.length === 0) {
      _printResume(totalSteps, toolCounts, filesModified);
      autoSave(conversationMessages);
      return;
    }

    // ─── Update stats ───
    totalSteps++;
    for (const tc of tool_calls) {
      const name = tc.function.name;
      toolCounts.set(name, (toolCounts.get(name) || 0) + 1);
    }

    // ─── Prepare all tool calls (parse, validate, permissions — sequential) ───
    const prepared = [];
    for (const tc of tool_calls) {
      prepared.push(await prepareToolCall(tc));
    }

    // ─── Execute with parallel batching (quiet mode: spinner + compact summaries) ───
    const toolMessages = await executeBatch(prepared, true);

    // Track modified files
    for (let j = 0; j < prepared.length; j++) {
      const prep = prepared[j];
      if (prep.canExecute && ['write_file', 'edit_file', 'patch_file'].includes(prep.fnName)) {
        const res = toolMessages[j].content;
        if (!res.startsWith('ERROR') && !res.includes('CANCELLED')) {
          if (prep.args && prep.args.path) filesModified.add(prep.args.path);
        }
      }
    }

    for (const toolMsg of toolMessages) {
      conversationMessages.push(toolMsg);
      apiMessages.push(toolMsg);
    }
  }

  _printResume(totalSteps, toolCounts, filesModified);
  autoSave(conversationMessages);
  console.log(`\n${C.yellow}⚠ Max iterations (${MAX_ITERATIONS}) reached.${C.reset}`);
}

module.exports = { processInput, clearConversation, getConversationLength, getConversationMessages, setConversationMessages };

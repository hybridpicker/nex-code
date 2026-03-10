/**
 * cli/agent.js — Agentic Loop + Conversation State
 * Hybrid: chat + tool-use in a single conversation.
 */

const { C, Spinner, TaskProgress, formatToolCall, formatResult, formatToolSummary, setActiveTaskProgress } = require('./ui');
const { callStream } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { executeTool } = require('./tools');
const { gatherProjectContext } = require('./context');
const { fitToContext, forceCompress, getUsage, estimateTokens } = require('./context-engine');
const { autoSave } = require('./session');
const { getMemoryContext } = require('./memory');
const { checkPermission, setPermission, savePermissions } = require('./permissions');
const { confirm, setAllowAlwaysHandler } = require('./safety');
const { isPlanMode, getPlanModePrompt, PLAN_MODE_ALLOWED_TOOLS, setPlanContent } = require('./planner');
const { StreamRenderer } = require('./render');
const { runHooks } = require('./hooks');
const { routeMCPCall, getMCPToolDefinitions } = require('./mcp');
const { getSkillInstructions, getSkillToolDefinitions, routeSkillCall } = require('./skills');
const { trackUsage } = require('./costs');
const { validateToolArgs } = require('./tool-validator');
const { filterToolsForModel, getModelTier, PROVIDER_DEFAULT_TIER } = require('./tool-tiers');
const { getConfiguredProviders } = require('./providers/registry');
const fsSync = require('fs');
const path = require('path');

// ─── Vision / Image Helpers ──────────────────────────────────
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|bmp|tiff?)$/i;
const IMAGE_PATH_RE = /(?:^|\s)((?:~|\.{1,2})?(?:\/[\w.\-@() ]+)+\.(?:png|jpe?g|gif|webp|bmp|tiff?))(?:\s|$)/gi;

function _detectImagePaths(text) {
  const paths = [];
  let m;
  IMAGE_PATH_RE.lastIndex = 0;
  while ((m = IMAGE_PATH_RE.exec(text)) !== null) {
    const raw = m[1].trim();
    const abs = raw.startsWith('~') ? raw.replace('~', process.env.HOME || '') : path.resolve(raw);
    if (fsSync.existsSync(abs)) paths.push({ raw, abs });
  }
  return paths;
}

function _imageToBase64(absPath) {
  const buf = fsSync.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase().replace('.', '');
  const mediaType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'gif' ? 'image/gif'
    : ext === 'webp' ? 'image/webp'
    : 'image/png';
  return { data: buf.toString('base64'), media_type: mediaType };
}

function buildUserContent(text) {
  const imagePaths = _detectImagePaths(text);
  if (imagePaths.length === 0) return text; // No images → plain string (unchanged behaviour)

  const blocks = [{ type: 'text', text }];
  for (const img of imagePaths) {
    try {
      const { data, media_type } = _imageToBase64(img.abs);
      blocks.push({ type: 'image', media_type, data });
    } catch {
      // File unreadable — skip silently
    }
  }
  return blocks.length > 1 ? blocks : text;
}

// ─── Lazy Tool Loading ───────────────────────────────────────
// Cache tool definitions to avoid loading on every call
let cachedToolDefinitions = null;
let cachedSkillToolDefinitions = null;
let cachedMCPToolDefinitions = null;

/**
 * Get all tool definitions with lazy loading and caching.
 * Reduces startup time by ~50-100ms.
 */
function getAllToolDefinitions() {
  if (cachedToolDefinitions === null) {
    const { TOOL_DEFINITIONS } = require('./tools');
    cachedToolDefinitions = TOOL_DEFINITIONS;
  }
  
  if (cachedSkillToolDefinitions === null) {
    cachedSkillToolDefinitions = getSkillToolDefinitions();
  }
  
  if (cachedMCPToolDefinitions === null) {
    cachedMCPToolDefinitions = getMCPToolDefinitions();
  }
  
  return [...cachedToolDefinitions, ...cachedSkillToolDefinitions, ...cachedMCPToolDefinitions];
}

/**
 * Clear tool definition cache (for testing or when tools change)
 */
function clearToolDefinitionsCache() {
  cachedToolDefinitions = null;
  cachedSkillToolDefinitions = null;
  cachedMCPToolDefinitions = null;
}

let MAX_ITERATIONS = 50;
function setMaxIterations(n) { if (Number.isFinite(n) && n > 0) MAX_ITERATIONS = n; }

// Abort signal getter — set by cli/index.js to avoid circular dependency
let _getAbortSignal = () => null;
function setAbortSignalGetter(fn) { _getAbortSignal = fn; }

// ─── System Prompt Cache ─────────────────────────────────────
// Cache system prompt to avoid rebuilding on every turn (saves 100-1000ms)
let cachedSystemPrompt = null;
let cachedContextHash = null;
let cachedModelRoutingGuide = null;

// ─── Tool Filter Cache ───────────────────────────────────────
// Cache filtered tool definitions per model (saves 5-10ms per iteration)
const toolFilterCache = new Map();

// ─── Early Tool Result Compression ───────────────────────────
// Compress large tool results to save context tokens
const TOOL_RESULT_TOKEN_THRESHOLD = 5000;
const TOOL_RESULT_COMPRESS_TARGET = 3000;

/**
 * Compress tool result if it exceeds token threshold.
 * Uses context-engine compression to reduce token count.
 */
function compressToolResultIfNeeded(content) {
  const tokens = estimateTokens(content);
  if (tokens > TOOL_RESULT_TOKEN_THRESHOLD) {
    try {
      const { compressToolResult } = require('./context-engine');
      const compressed = compressToolResult(content, TOOL_RESULT_COMPRESS_TARGET);
      return compressed;
    } catch {
      // Fallback: return original if compression fails
      return content;
    }
  }
  return content;
}

/**
 * Get cached filtered tools for current model.
 * Invalidated when model changes.
 */
function getCachedFilteredTools(allTools) {
  try {
    const { getActiveModel } = require('./providers/registry');
    const model = getActiveModel();
    const modelId = model ? `${model.provider}:${model.id}` : 'default';
    
    if (toolFilterCache.has(modelId)) {
      return toolFilterCache.get(modelId);
    }
    
    const filtered = filterToolsForModel(allTools);
    toolFilterCache.set(modelId, filtered);
    return filtered;
  } catch {
    // Fallback: no caching on error
    return filterToolsForModel(allTools);
  }
}

/**
 * Clear tool filter cache (called on model change)
 */
function clearToolFilterCache() {
  toolFilterCache.clear();
}

/**
 * Quick hash of project context to detect changes.
 * Uses mtime of key files + git HEAD ref.
 */
async function getProjectContextHash() {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const files = [
      path.join(process.cwd(), 'package.json'),
      path.join(process.cwd(), '.git', 'HEAD'),
      path.join(process.cwd(), 'README.md'),
      path.join(process.cwd(), 'NEX.md'),
    ];
    // Run all stat calls in parallel
    const statResults = await Promise.allSettled(files.map(f => fs.stat(f).then(s => `${f}:${s.mtimeMs}`)));
    const hashes = statResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    // Also include memory context hash
    try {
      const { getMemoryContextHash } = require('./memory');
      const memHash = getMemoryContextHash();
      if (memHash) hashes.push(`memory:${memHash}`);
    } catch { /* ignore */ }
    return hashes.join('|');
  } catch {
    return `fallback:${Date.now()}`;
  }
}

/**
 * Invalidate system prompt cache (called on model/provider change)
 */
function invalidateSystemPromptCache() {
  cachedSystemPrompt = null;
  cachedContextHash = null;
  cachedModelRoutingGuide = null;
}

// Tools that can safely run in parallel (read-only, no side effects)
const PARALLEL_SAFE = new Set([
  'read_file', 'list_directory', 'search_files', 'glob', 'grep',
  'web_fetch', 'web_search', 'git_status', 'git_diff', 'git_log',
]);
const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_NETWORK_RETRIES = 3;
const MAX_STALE_RETRIES = 2;
const STALE_WARN_MS = 60000;   // Warn after 60s without tokens
const STALE_ABORT_MS = 120000; // Abort after 120s without tokens
// Use process.cwd() dynamically

/**
 * Save plan text to .nex/plans/current-plan.md
 */
function _savePlanToFile(text) {
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.nex', 'plans');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, 'current-plan.md');
    fs.writeFileSync(filePath, text, 'utf-8');
  } catch { /* non-fatal */ }
}

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
    const allToolDefs = getAllToolDefinitions();
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

  // Log validator corrections so user/LLM can see auto-fixes
  if (validation.corrected) {
    const orig = Object.keys(args);
    const fixed = Object.keys(validation.corrected);
    const renamed = orig.filter(k => !fixed.includes(k));
    if (renamed.length) {
      console.log(`${C.dim}  ✓ ${fnName}: corrected args (${renamed.join(', ')})${C.reset}`);
    }
  }

  // Plan mode hard enforcement — block all non-read-only tools
  if (isPlanMode() && !PLAN_MODE_ALLOWED_TOOLS.has(fnName)) {
    console.log(`${C.yellow}  ✗ ${fnName}: blocked in plan mode${C.reset}`);
    return {
      callId, fnName, args: finalArgs, canExecute: false,
      errorResult: {
        role: 'tool',
        content: `PLAN MODE: '${fnName}' is blocked. Only read-only tools are allowed. Present your plan as text output instead of making changes.`,
        tool_call_id: callId,
      },
    };
  }

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
    let promptText = `  Allow ${fnName}?`;
    if (fnName === 'bash' && finalArgs.command) {
      const preview = finalArgs.command.substring(0, 80);
      promptText = `  bash: \`${preview}${finalArgs.command.length > 80 ? '…' : ''}\`?`;
    }
    const ok = await confirm(promptText, { toolName: fnName });
    if (!ok) {
      return {
        callId, fnName, args: finalArgs, canExecute: false, confirmedByUser: false,
        errorResult: { role: 'tool', content: `CANCELLED: User declined ${fnName}`, tool_call_id: callId },
      };
    }
    return { callId, fnName, args: finalArgs, canExecute: true, confirmedByUser: true, errorResult: null };
  }

  return { callId, fnName, args: finalArgs, canExecute: true, confirmedByUser: true, errorResult: null };
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

  const toolResult = await executeToolRouted(prep.fnName, prep.args, {
    silent: true,
    autoConfirm: prep.confirmedByUser === true,
  });
  const safeResult = String(toolResult ?? '');
  const truncated = safeResult.length > 50000
    ? safeResult.substring(0, 50000) + `\n...(truncated ${safeResult.length - 50000} chars)`
    : safeResult;

  const firstLine = truncated.split('\n')[0];
  const isError = firstLine.startsWith('ERROR') || firstLine.includes('CANCELLED') || firstLine.includes('BLOCKED')
    || (prep.fnName === 'spawn_agents' && !/✓ Agent/.test(truncated) && /✗ Agent/.test(truncated));
  const summary = formatToolSummary(prep.fnName, prep.args, truncated, isError);

  if (!quiet) {
    console.log(formatResult(truncated));
    console.log(summary);
  }

  runHooks('post-tool', { tool_name: prep.fnName });
  
  // Compress large tool results early to save context tokens
  const compressedContent = compressToolResultIfNeeded(truncated);
  const msg = { role: 'tool', content: compressedContent, tool_call_id: prep.callId };
  return { msg, summary };
}

/**
 * Execute prepared tool calls with parallel batching.
 * Consecutive PARALLEL_SAFE tools run via Promise.all.
 * @param {boolean} quiet - use spinner + compact summaries instead of verbose output
 */
async function executeBatch(prepared, quiet = false, options = {}) {
  const results = new Array(prepared.length);
  const summaries = [];
  let batch = [];

  // Quiet mode: show a single spinner for all tools
  let spinner = null;
  if (quiet && !options.skipSpinner) {
    const execTools = prepared.filter(p => p.canExecute);
    if (execTools.length > 0) {
      let label;
      if (execTools.length === 1) {
        const p = execTools[0];
        const preview = _argPreview(p.fnName, p.args);
        label = `⏺ ${p.fnName}${preview ? `(${preview})` : ''}`;
      } else {
        const names = execTools.map(p => p.fnName).join(', ');
        label = `⏺ ${execTools.length} tools: ${names.length > 60 ? names.substring(0, 57) + '…' : names}`;
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
      // spawn_agents manages its own display (MultiProgress) — stop outer spinner
      if (prep.fnName === 'spawn_agents' && spinner) {
        spinner.stop();
        spinner = null;
      }
      const { msg, summary } = await executeSingleTool(prep, quiet);
      results[i] = msg;
      summaries.push(summary);
    }
  }

  await flushBatch();

  // Stop spinner and print compact summaries
  if (spinner) spinner.stop();
  if (quiet && summaries.length > 0 && !options.skipSummaries) {
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
  if (cachedModelRoutingGuide !== null) return cachedModelRoutingGuide;
  try {
    const configured = getConfiguredProviders();
    const allModels = configured.flatMap(p =>
      p.models.map(m => ({
        spec: `${p.name}:${m.id}`,
        tier: getModelTier(m.id, p.name),
        name: m.name,
      }))
    );

    if (allModels.length < 2) {
      cachedModelRoutingGuide = '';
      return '';
    }

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
    cachedModelRoutingGuide = guide;
    return guide;
  } catch {
    cachedModelRoutingGuide = '';
    return '';
  }
}

async function buildSystemPrompt() {
  // Check if context has changed (includes model routing guide cache)
  const currentHash = await getProjectContextHash();
  if (cachedSystemPrompt !== null && currentHash === cachedContextHash) {
    return cachedSystemPrompt;
  }

  // Rebuild system prompt
  // Note: gatherProjectContext is now cached internally (30s TTL + mtime validation)
  const projectContext = await gatherProjectContext(process.cwd());
  const memoryContext = getMemoryContext();
  const skillInstructions = getSkillInstructions();
  const planPrompt = isPlanMode() ? getPlanModePrompt() : '';
  // Model routing guide is also cached internally

  cachedSystemPrompt = `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${process.cwd()}
All relative paths resolve from this directory.

PROJECT CONTEXT:
${projectContext}
${memoryContext ? `\n${memoryContext}\n` : ''}${skillInstructions ? `\n${skillInstructions}\n` : ''}${planPrompt ? `\n${planPrompt}\n` : ''}
# Core Behavior

- You can use tools OR respond with text. For simple questions, answer directly.
- For coding tasks, use tools to read files, make changes, run tests, etc.
- Be concise but complete. Keep responses focused while ensuring the user gets the information they asked for.
- When referencing code, include file:line (e.g. src/app.js:42) so the user can navigate.
- Do not make up file paths or URLs. Use tools to discover them.

# Response Quality (Critical)

⚠ CRITICAL: The user CANNOT see tool output. They only see your text + 1-line summaries like "✓ bash ssh ... → ok".
If you run tools but write NO text → the user sees NOTHING useful. This is the #1 quality failure.

MANDATORY RULE: After ANY tool call that gathers information (bash, read_file, grep, ssh commands, etc.), you MUST write a text response summarizing the findings. NEVER end your response with only tool calls and no text.

- Use markdown formatting: **bold** for key points, headers for sections, bullet lists for multiple items, \`code\` for identifiers. The terminal renders markdown with syntax highlighting.
- Structure longer responses with headers (## Section) so the user can scan quickly.

Response patterns by request type:
- **Questions / analysis / "status" / "explain" / "what is"**: Gather data with tools, then respond with a clear, structured summary. NEVER just run tools and stop.
- **Coding tasks (implement, fix, refactor)**: Brief confirmation of what you'll do, then use tools. After changes, summarize what you did and any important details.
- **Simple questions ("what does X do?")**: Answer directly without tools when you have enough context.
- **Ambiguous requests**: When a request is vague or could be interpreted multiple ways (e.g. "optimize this", "improve performance", "fix the issues", "refactor this"), ALWAYS ask clarifying questions first using ask_user. Do NOT guess scope or intent. Ask about: which specific area, what the expected outcome is, any constraints. Only proceed after the user clarifies.
- **Server/SSH commands**: After running remote commands, ALWAYS present the results: service status, log errors, findings.

After completing multi-step tasks, suggest logical next steps (e.g. "You can run npm test to verify" or "Consider committing with /commit").

# Doing Tasks

- For non-trivial tasks, briefly state your approach before starting (1 sentence). This helps the user know what to expect.
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
- After completing work, give a brief summary of what was done and any important details. Don't just silently finish.

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
- If you encounter unexpected state (unfamiliar files, branches), investigate before modifying.

`;

  cachedContextHash = currentHash;
  return cachedSystemPrompt;
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
function _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime) {
  if (totalSteps < 1) return;

  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);
  let resume = `── ${totalSteps} ${totalSteps === 1 ? 'step' : 'steps'} · ${totalTools} ${totalTools === 1 ? 'tool' : 'tools'}`;
  if (filesModified.size > 0) {
    resume += ` · ${filesModified.size} ${filesModified.size === 1 ? 'file' : 'files'} modified`;
  }
  if (startTime) {
    const elapsed = Date.now() - startTime;
    const secs = Math.round(elapsed / 1000);
    resume += secs >= 60 ? ` · ${Math.floor(secs / 60)}m ${secs % 60}s` : ` · ${secs}s`;
  }
  resume += ' ──';
  console.log(`\n${C.dim}  ${resume}${C.reset}`);

  // Follow-up suggestions based on what happened
  if (filesModified.size > 0) {
    console.log(`${C.dim}  💡 /diff · /commit · /undo${C.reset}`);
  } else if (filesRead.size > 0 && totalSteps >= 2) {
    console.log(`${C.dim}  💡 /save · /clear${C.reset}`);
  }
}

/**
 * Process a single user input through the agentic loop.
 * Maintains conversation state across calls.
 */
async function processInput(userInput) {
  const userContent = buildUserContent(userInput);
  conversationMessages.push({ role: 'user', content: userContent });

  const { setOnChange } = require('./tasks');
  let taskProgress = null;
  let cumulativeTokens = 0;

  // Wire task onChange to create/update live task display
  setOnChange((event, data) => {
    if (event === 'create') {
      if (taskProgress) taskProgress.stop();
      taskProgress = new TaskProgress(data.name, data.tasks);
      taskProgress.setStats({ tokens: cumulativeTokens });
      taskProgress.start();
    } else if (event === 'update' && taskProgress) {
      taskProgress.updateTask(data.id, data.status);
    } else if (event === 'clear') {
      if (taskProgress) {
        taskProgress.stop();
        taskProgress = null;
      }
    }
  });

  const systemPrompt = await buildSystemPrompt();
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...conversationMessages];

  // Pre-spinner: visible activity during fitToContext + getUsage (can take 50–5000ms with LLM compacting)
  const preSpinner = new Spinner('Thinking...');
  preSpinner.start();

  // Context-aware compression: fit messages into context window
  const allTools = getAllToolDefinitions();
  const { messages: fittedMessages, compressed, compacted, tokensRemoved } = await fitToContext(
    fullMessages,
    allTools
  );

  // Context budget warning
  const usage = getUsage(fullMessages, allTools);

  preSpinner.stop();

  if (compacted) {
    console.log(`${C.dim}  [context compacted — summary (~${tokensRemoved} tokens freed)]${C.reset}`);
  } else if (compressed) {
    const pct = usage.limit > 0 ? Math.round((tokensRemoved / usage.limit) * 100) : 0;
    console.log(`${C.dim}  [context compressed — ~${tokensRemoved} tokens freed (${pct}%)]${C.reset}`);
  }
  if (usage.percentage > 85) {
    console.log(`${C.yellow}  ⚠ Context ${Math.round(usage.percentage)}% full — consider /clear or /save + start fresh${C.reset}`);
  }

  // Use fitted messages for the API call, but keep fullMessages reference for appending
  let apiMessages = fittedMessages;
  let rateLimitRetries = 0;
  let networkRetries = 0;
  let staleRetries = 0;
  let contextRetries = 0;

  // ─── Stats tracking for résumé ───
  let totalSteps = 0;
  const toolCounts = new Map();
  const filesModified = new Set();
  const filesRead = new Set();
  const startTime = Date.now();

  let i;
  let iterLimit = MAX_ITERATIONS;
  let autoExtensions = 0;
  const MAX_AUTO_EXTENSIONS = 10; // hard cap: max 10×20 = 200 extra turns
  // eslint-disable-next-line no-constant-condition
  outer: while (true) {
  for (i = 0; i < iterLimit; i++) {
    // Check if aborted (Ctrl+C) at start of each iteration
    const loopSignal = _getAbortSignal();
    if (loopSignal?.aborted) break;

    // Step indicator — deferred, only shown for tool iterations (matches résumé count)
    let stepPrinted = true; // default: no marker (text-only iterations stay silent)
    function printStepIfNeeded() {
      if (!stepPrinted) {
        console.log(`${C.dim}  ── step ${totalSteps} ──${C.reset}`);
        stepPrinted = true;
      }
    }

    let spinner = null;
    if (taskProgress && taskProgress.isActive()) {
      // Resume the live task display instead of a plain spinner
      if (taskProgress._paused) taskProgress.resume();
    } else if (!taskProgress) {
      const spinnerText = totalSteps > 0 ? `Thinking... (step ${totalSteps + 1})` : 'Thinking...';
      spinner = new Spinner(spinnerText);
      spinner.start();
    }
    let firstToken = true;
    let streamedText = '';
    const stream = new StreamRenderer();

    let result;
    // Stale-stream detection: warn/abort if provider stops sending tokens
    let lastTokenTime = Date.now();
    let staleWarned = false;
    const staleAbort = new AbortController();
    const staleTimer = setInterval(() => {
      const elapsed = Date.now() - lastTokenTime;
      if (elapsed >= STALE_ABORT_MS) {
        stream._clearCursorLine();
        console.log(`${C.yellow}  ⚠ Stream stale for ${Math.round(elapsed / 1000)}s — aborting and retrying${C.reset}`);
        staleAbort.abort();
      } else if (elapsed >= STALE_WARN_MS && !staleWarned) {
        staleWarned = true;
        stream._clearCursorLine();
        console.log(`${C.yellow}  ⚠ No tokens received for ${Math.round(elapsed / 1000)}s — waiting...${C.reset}`);
      }
    }, 5000);
    
    // Token batching for streaming optimization
    let tokenBuffer = '';
    let flushTimeout = null;
    
    try {
      const baseTools = getCachedFilteredTools(getAllToolDefinitions());
      const allTools = isPlanMode()
        ? baseTools.filter(t => PLAN_MODE_ALLOWED_TOOLS.has(t.function.name))
        : baseTools;
      const userSignal = _getAbortSignal();
      // Combine user abort (Ctrl+C) and stale abort into one signal
      const combinedAbort = new AbortController();
      if (userSignal) userSignal.addEventListener('abort', () => combinedAbort.abort(), { once: true });
      staleAbort.signal.addEventListener('abort', () => combinedAbort.abort(), { once: true });

      result = await callStream(apiMessages, allTools, {
        signal: combinedAbort.signal,
        onToken: (text) => {
          lastTokenTime = Date.now();
          staleWarned = false;
          
          // In non-TTY (headless) mode: flush immediately — no buffering needed
          // In TTY mode: batch tokens for 100ms to reduce cursor flicker
          tokenBuffer += text;

          if (process.stdout.isTTY) {
            if (!flushTimeout) {
              flushTimeout = setTimeout(() => {
                if (tokenBuffer && stream) {
                  stream.push(tokenBuffer);
                }
                tokenBuffer = '';
                flushTimeout = null;
              }, 100);
            }
          } else {
            stream.push(tokenBuffer);
            tokenBuffer = '';
          }
          
          if (firstToken) {
            if (taskProgress && !taskProgress._paused) {
              taskProgress.pause();
            } else if (spinner) {
              spinner.stop();
            }
            printStepIfNeeded();
            stream.startCursor();
            firstToken = false;
          }
          streamedText += text;
        },
      });
    } catch (err) {
      clearInterval(staleTimer);
      if (taskProgress && !taskProgress._paused) taskProgress.pause();
      if (spinner) spinner.stop();
      stream.stopCursor();

      // Stale abort → progressive retry: 1st=resend, 2nd=compress+resend, exhausted=last-resort compress
      if (staleAbort.signal.aborted && !_getAbortSignal()?.aborted) {
        staleRetries++;
        if (staleRetries > MAX_STALE_RETRIES) {
          // Last-resort: force-compress once, then reset for fresh attempts
          if (contextRetries < 1) {
            contextRetries++;
            console.log(`${C.yellow}  ⚠ Stale retries exhausted — last-resort force-compress...${C.reset}`);
            const allTools = getAllToolDefinitions();
            const { messages: compressedMsgs, tokensRemoved } = forceCompress(apiMessages, allTools);
            apiMessages = compressedMsgs;
            console.log(`${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`);
            staleRetries = 0; // Reset so compressed context gets full retry attempts
            i--;
            continue;
          }
          console.log(`${C.red}  ✗ Stream stale: max retries (${MAX_STALE_RETRIES}) exceeded. The model may be overloaded — try again or switch models.${C.reset}`);
          if (taskProgress) { taskProgress.stop(); taskProgress = null; }
          setOnChange(null);
          _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
          autoSave(conversationMessages);
          break;
        }
        // Progressive delay + optional compress on 2nd retry
        const delay = staleRetries === 1 ? 3000 : 5000;
        if (staleRetries >= 2 && contextRetries < 1) {
          contextRetries++;
          console.log(`${C.yellow}  ⚠ Stale retry ${staleRetries}/${MAX_STALE_RETRIES} — force-compressing before retry...${C.reset}`);
          const allTools = getAllToolDefinitions();
          const { messages: compressedMsgs, tokensRemoved } = forceCompress(apiMessages, allTools);
          apiMessages = compressedMsgs;
          console.log(`${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`);
        } else {
          console.log(`${C.yellow}  ⚠ Stale retry ${staleRetries}/${MAX_STALE_RETRIES} — retrying in ${delay / 1000}s...${C.reset}`);
        }
        const delaySpinner = new Spinner(`Waiting ${delay / 1000}s before retry...`);
        delaySpinner.start();
        await new Promise(r => setTimeout(r, delay));
        delaySpinner.stop();
        i--; // Don't count stale timeouts as iterations
        continue;
      }

      // Abort errors (Ctrl+C) — break silently
      if (err.name === 'AbortError' || err.name === 'CanceledError' ||
        err.message?.includes('canceled') || err.message?.includes('aborted')) {
        if (taskProgress) { taskProgress.stop(); taskProgress = null; }
        setOnChange(null);
        _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
        autoSave(conversationMessages);
        break;
      }

      // User-friendly error message (avoid raw stack traces/cryptic codes)
      let userMessage = err.message;
      if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED')) {
        userMessage = 'Connection refused — please check your internet connection or API endpoint';
      } else if (err.code === 'ENOTFOUND' || err.message.includes('ENOTFOUND')) {
        userMessage = 'Network error — could not reach the API server. Please check your connection';
      } else if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
        userMessage = 'Request timed out — the API server took too long to respond. Please try again';
      } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        userMessage = 'Authentication failed — please check your API key in the .env file';
      } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
        userMessage = 'Access denied — your API key may not have permission for this model';
      } else if (err.message.includes('400')) {
        // Check if this is a context-too-long error before generic 400 handling
        const errLower = (err.message || '').toLowerCase();
        const isContextTooLong = errLower.includes('context') || errLower.includes('token') ||
          errLower.includes('length') || errLower.includes('too long') || errLower.includes('too many') ||
          errLower.includes('prompt') || errLower.includes('size') || errLower.includes('exceeds') ||
          errLower.includes('num_ctx') || errLower.includes('input');
        if (isContextTooLong && contextRetries < 1) {
          contextRetries++;
          console.log(`${C.yellow}  ⚠ Context too long — force-compressing and retrying...${C.reset}`);
          const allTools = getAllToolDefinitions();
          const { messages: compressedMsgs, tokensRemoved } = forceCompress(apiMessages, allTools);
          apiMessages = compressedMsgs;
          console.log(`${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`);
          i--;
          continue;
        }
        if (isContextTooLong) {
          userMessage = 'Context too long — force compression exhausted. Use /clear to start fresh';
        } else {
          userMessage = 'Bad request — the conversation may be too long or contain unsupported content. Try /clear and retry';
        }
      } else if (err.message.includes('500') || err.message.includes('502') || err.message.includes('503') || err.message.includes('504')) {
        userMessage = 'API server error — the provider is experiencing issues. Please try again in a moment';
      } else if (err.message.includes('fetch failed') || err.message.includes('fetch')) {
        userMessage = 'Network request failed — please check your internet connection';
      }
      console.log(`${C.red}  ✗ ${userMessage}${C.reset}`);

      if (err.message.includes('429')) {
        rateLimitRetries++;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
          console.log(`${C.red}  Rate limit: max retries (${MAX_RATE_LIMIT_RETRIES}) exceeded. Try again later or use /budget to check your limits.${C.reset}`);
          if (taskProgress) { taskProgress.stop(); taskProgress = null; }
          setOnChange(null);
          _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
          autoSave(conversationMessages);
          break;
        }
        const delay = Math.min(10000 * Math.pow(2, rateLimitRetries - 1), 120000);
        const waitSpinner = new Spinner(`Rate limit — waiting ${Math.round(delay / 1000)}s (retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})`);
        waitSpinner.start();
        await new Promise((r) => setTimeout(r, delay));
        waitSpinner.stop();
        continue;
      }

      // Network/TLS errors — retry with backoff (don't burn iterations)
      const isNetworkError = err.message.includes('socket disconnected') ||
        err.message.includes('TLS') || err.message.includes('ECONNRESET') ||
        err.message.includes('ECONNABORTED') || err.message.includes('ETIMEDOUT') ||
        err.code === 'ECONNRESET' || err.code === 'ECONNABORTED';
      if (isNetworkError) {
        networkRetries++;
        if (networkRetries > MAX_NETWORK_RETRIES) {
          console.log(`${C.red}  Network error: max retries (${MAX_NETWORK_RETRIES}) exceeded. Check your connection and try again.${C.reset}`);
          if (taskProgress) { taskProgress.stop(); taskProgress = null; }
          setOnChange(null);
          _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
          autoSave(conversationMessages);
          break;
        }
        const delay = Math.min(2000 * Math.pow(2, networkRetries - 1), 30000);
        const waitSpinner = new Spinner(`Network error — retrying in ${Math.round(delay / 1000)}s (${networkRetries}/${MAX_NETWORK_RETRIES})`);
        waitSpinner.start();
        await new Promise((r) => setTimeout(r, delay));
        waitSpinner.stop();
        i--; // Don't count network errors as iterations
        continue;
      }

      // Auto-save on error so conversation isn't lost
      if (taskProgress) { taskProgress.stop(); taskProgress = null; }
      setOnChange(null);
      _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
      autoSave(conversationMessages);
      break;
    }

    clearInterval(staleTimer);

    if (firstToken) {
      if (taskProgress && !taskProgress._paused) taskProgress.pause();
      if (spinner) spinner.stop();
    }

    // Flush remaining token buffer (from batching)
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    if (tokenBuffer && stream) {
      stream.push(tokenBuffer);
      tokenBuffer = '';
    }

    // Flush remaining stream buffer
    if (streamedText) {
      stream.flush();
    }

    // Reset retry counters on success
    networkRetries = 0;
    staleRetries = 0;

    // Track token usage for cost dashboard
    if (result && result.usage) {
      const { getActiveProviderName, getActiveModelId } = require('./providers/registry');
      trackUsage(
        getActiveProviderName(),
        getActiveModelId(),
        result.usage.prompt_tokens || 0,
        result.usage.completion_tokens || 0
      );
      cumulativeTokens += (result.usage.prompt_tokens || 0) + (result.usage.completion_tokens || 0);
      if (taskProgress) taskProgress.setStats({ tokens: cumulativeTokens });
    }

    const { content, tool_calls } = result;

    // Build assistant message for history
    const assistantMsg = { role: 'assistant', content: content || '' };
    if (tool_calls && tool_calls.length > 0) {
      assistantMsg.tool_calls = tool_calls;
    }
    conversationMessages.push(assistantMsg);
    apiMessages.push(assistantMsg);

    // No tool calls → response complete (or nudge if empty after tools)
    if (!tool_calls || tool_calls.length === 0) {
      const hasText = (content || '').trim().length > 0 || streamedText.trim().length > 0;
      // If we just ran tools but the LLM produced no text → nudge it to summarize
      if (!hasText && totalSteps > 0 && i < MAX_ITERATIONS - 1) {
        const nudge = { role: 'user', content: '[SYSTEM] You ran tools but produced no visible output. The user CANNOT see tool results — only your text. Please summarize your findings now.' };
        apiMessages.push(nudge);
        continue; // retry — don't count as a new step
      }
      // In plan mode: save the plan text output to disk
      if (isPlanMode() && hasText) {
        const planText = (content || streamedText || '').trim();
        setPlanContent(planText);
        _savePlanToFile(planText);
        console.log(`\n${C.cyan}${C.bold}Plan ready.${C.reset} ${C.dim}Type ${C.reset}${C.cyan}/plan approve${C.reset}${C.dim} to execute, or ask follow-up questions to refine.${C.reset}`);
      }
      if (taskProgress) { taskProgress.stop(); taskProgress = null; }
      setOnChange(null);
      _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
      autoSave(conversationMessages);
      return;
    }

    // ─── Update stats ───
    totalSteps++;
    if (totalSteps > 1) stepPrinted = false; // enable deferred step marker for steps 2+
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
    const batchOpts = taskProgress ? { skipSpinner: true, skipSummaries: true } : {};
    if (!batchOpts.skipSummaries) printStepIfNeeded();
    // Resume TaskProgress animation during tool execution so the UI never looks frozen
    if (taskProgress && taskProgress._paused) taskProgress.resume();
    const toolMessages = await executeBatch(prepared, true, batchOpts);

    // Track modified and read files
    for (let j = 0; j < prepared.length; j++) {
      const prep = prepared[j];
      if (!prep.canExecute) continue;
      const res = toolMessages[j].content;
      const isOk = !res.startsWith('ERROR') && !res.includes('CANCELLED');
      if (isOk && ['write_file', 'edit_file', 'patch_file'].includes(prep.fnName)) {
        if (prep.args && prep.args.path) filesModified.add(prep.args.path);
      }
      if (isOk && prep.fnName === 'read_file') {
        if (prep.args && prep.args.path) filesRead.add(prep.args.path);
      }
    }

    for (const toolMsg of toolMessages) {
      conversationMessages.push(toolMsg);
      apiMessages.push(toolMsg);
    }
  }

  // Only print résumé + max-iterations warning if the loop actually exhausted (not on break)
  if (i >= iterLimit) {
    if (taskProgress) { taskProgress.stop(); taskProgress = null; }
    setOnChange(null);
    _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
    autoSave(conversationMessages);

    const { getActiveProviderName: _getProviderName } = require('./providers/registry');
    const provider = _getProviderName();
    if (provider === 'ollama' && autoExtensions < MAX_AUTO_EXTENSIONS) {
      // Free provider — auto-extend silently
      autoExtensions++;
      iterLimit += 20;
      console.log(`${C.dim}  ── auto-extending to ${iterLimit} turns ──${C.reset}`);
      continue outer;
    }

    // Paid provider (or hard cap reached) — ask before spending more
    console.log(`\n${C.yellow}⚠ Max iterations (${iterLimit}) reached.${C.reset}`);
    const keepGoing = await confirm(`  Continue for 20 more turns?`);
    if (keepGoing) {
      iterLimit += 20;
      continue outer;
    }

    console.log(`${C.dim}  Tip: set "maxIterations" in .nex/config.json or use --max-turns${C.reset}`);
  }
  break outer;
  } // end outer while
}

module.exports = {
  processInput,
  clearConversation,
  getConversationLength,
  getConversationMessages,
  setConversationMessages,
  setAbortSignalGetter,
  setMaxIterations,
  // Export cache invalidation functions for registry.js
  invalidateSystemPromptCache,
  clearToolFilterCache,
  // Export for benchmarking
  getCachedFilteredTools,
  buildSystemPrompt,
  getProjectContextHash,
  // Export for testing
  buildUserContent,
};

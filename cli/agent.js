/**
 * cli/agent.js — Agentic Loop + Conversation State
 * Hybrid: chat + tool-use in a single conversation.
 */

const { C, Spinner, TaskProgress, formatToolCall, formatResult, formatToolSummary, formatSectionHeader, setActiveTaskProgress } = require('./ui');
const { callStream } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { executeTool } = require('./tools');
const { gatherProjectContext } = require('./context');
const { fitToContext, forceCompress, getUsage, estimateTokens } = require('./context-engine');
const { autoSave, flushAutoSave } = require('./session');

// Save session immediately — used on all terminal paths (break/return) so the
// debounced timeout doesn't race against process exit.
function saveNow(messages) { autoSave(messages); flushAutoSave(); }
const { getMemoryContext } = require('./memory');
const { checkPermission, setPermission, savePermissions } = require('./permissions');
const { confirm, setAllowAlwaysHandler } = require('./safety');
const { isPlanMode, getPlanModePrompt, PLAN_MODE_ALLOWED_TOOLS, setPlanContent, extractStepsFromText, createPlan, getActivePlan, startExecution, advancePlanStep, getPlanStepInfo } = require('./planner');
const { StreamRenderer } = require('./render');
const { runHooks } = require('./hooks');
const { routeMCPCall, getMCPToolDefinitions } = require('./mcp');
const { getSkillInstructions, getSkillToolDefinitions, routeSkillCall } = require('./skills');
const { trackUsage } = require('./costs');
const { validateToolArgs } = require('./tool-validator');
const { filterToolsForModel, getModelTier, PROVIDER_DEFAULT_TIER } = require('./tool-tiers');
const { getConfiguredProviders, getActiveProviderName, getActiveModelId, setActiveModel, MODEL_EQUIVALENTS } = require('./providers/registry');
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
// Threshold raised from 5000 to 10000 — avoids compression overhead on medium outputs
const TOOL_RESULT_TOKEN_THRESHOLD = 10000;
const TOOL_RESULT_COMPRESS_TARGET = 6000;

// ─── Secret Scrubbing ─────────────────────────────────────────
// Redact common secret patterns from tool results before they enter the conversation.
// Matches env-style assignments for well-known secret prefixes (API_KEY, TOKEN, etc.)
const SECRET_SCRUB_RE = /\b((?:API|ACCESS|AUTH|BEARER|CLIENT|GITHUB|GITLAB|SLACK|STRIPE|TWILIO|SENDGRID|AWS|GCP|AZURE|OPENAI|ANTHROPIC|GEMINI|OLLAMA)[_A-Z0-9]*(?:KEY|TOKEN|SECRET|PASS(?:WORD)?|CREDENTIAL)[_A-Z0-9]*)\s*=\s*["']?([A-Za-z0-9\-_.+/=]{10,})["']?/g;

function scrubSecrets(content) {
  if (!content || typeof content !== 'string') return content;
  return content.replace(SECRET_SCRUB_RE, (_, varName) => `${varName}=***REDACTED***`);
}

/**
 * Scrub secrets and compress tool result if it exceeds token threshold.
 * Uses context-engine compression to reduce token count.
 */
function compressToolResultIfNeeded(content) {
  const scrubbed = scrubSecrets(content);
  const tokens = estimateTokens(scrubbed);
  if (tokens > TOOL_RESULT_TOKEN_THRESHOLD) {
    try {
      const { compressToolResult } = require('./context-engine');
      const compressed = compressToolResult(scrubbed, TOOL_RESULT_COMPRESS_TARGET);
      return compressed;
    } catch {
      // Fallback: return scrubbed original if compression fails
      return scrubbed;
    }
  }
  return scrubbed;
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
    // Include brain dir mtime so cache invalidates when brain docs change
    try {
      const brainDir = path.join(process.cwd(), '.nex', 'brain');
      if (fsSync.existsSync(brainDir)) {
        const brainStat = await fs.stat(brainDir);
        hashes.push(`brain:${brainStat.mtimeMs}`);
      }
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
// Kept for reference; execution now uses SEQUENTIAL_ONLY logic instead.
const PARALLEL_SAFE = new Set([
  'read_file', 'list_directory', 'search_files', 'glob', 'grep',
  'web_fetch', 'web_search', 'git_status', 'git_diff', 'git_log',
  'task_list', 'gh_run_list', 'gh_run_view',
  // Read-only container/service queries safe to run in parallel
  'container_list', 'container_logs', 'service_logs',
  // Browser read-only operations (NOT click/fill — those mutate state)
  'browser_open', 'browser_screenshot',
]);
// Tools that MUST run one-at-a-time: manage their own terminal display
// or require strict ordering. ALL other tools run in parallel when the
// LLM returns them in the same response (parallel_tool_calls convention).
const SEQUENTIAL_ONLY = new Set(['spawn_agents']);
const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_NETWORK_RETRIES = 3;
const MAX_STALE_RETRIES = 2;
const STALE_WARN_MS = parseInt(process.env.NEX_STALE_WARN_MS || '60000', 10);    // Warn after 60s without tokens (ENV: NEX_STALE_WARN_MS)
const STALE_ABORT_MS = parseInt(process.env.NEX_STALE_ABORT_MS || '120000', 10); // Abort after 120s without tokens (ENV: NEX_STALE_ABORT_MS)
const STALE_AUTO_SWITCH = process.env.NEX_STALE_AUTO_SWITCH !== '0';             // Auto-switch to fast model on 2nd stale retry (disable: NEX_STALE_AUTO_SWITCH=0)
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

  const preHookResults = runHooks('pre-tool', { tool_name: prep.fnName });
  if (!quiet && preHookResults.length > 0) {
    for (const result of preHookResults) {
      if (result.success) {
        console.log(`${C.dim}  [hook pre-tool] ${result.command} → ${result.output || 'ok'}${C.reset}`);
      } else {
        console.log(`${C.yellow}  [hook pre-tool] ${result.command} → ERROR: ${result.error}${C.reset}`);
      }
    }
  }

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

  const postHookResults = runHooks('post-tool', { tool_name: prep.fnName });
  if (!quiet && postHookResults.length > 0) {
    for (const result of postHookResults) {
      if (result.success) {
        console.log(`${C.dim}  [hook post-tool] ${result.command} → ${result.output || 'ok'}${C.reset}`);
      } else {
        console.log(`${C.yellow}  [hook post-tool] ${result.command} → ERROR: ${result.error}${C.reset}`);
      }
    }
  }
  
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
        label = `● ${p.fnName}${preview ? `(${preview})` : ''}`;
      } else {
        const names = execTools.map(p => p.fnName).join(', ');
        label = `● ${execTools.length} tools: ${names.length > 60 ? names.substring(0, 57) + '…' : names}`;
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

    if (SEQUENTIAL_ONLY.has(prep.fnName)) {
      await flushBatch();
      // spawn_agents manages its own display (MultiProgress) — stop outer spinner
      if (prep.fnName === 'spawn_agents' && spinner) {
        spinner.stop();
        spinner = null;
      }
      const { msg, summary } = await executeSingleTool(prep, quiet);
      results[i] = msg;
      summaries.push(summary);
    } else {
      // All other tools batch together: when the LLM returns them in the same
      // response, they are presumed independent (parallel_tool_calls convention).
      batch.push(i);
    }
  }

  await flushBatch();

  // Stop spinner
  if (spinner) spinner.stop();
  // Print summaries only when not collecting them at the call site
  if (quiet && summaries.length > 0 && !options.skipSummaries) {
    for (const s of summaries) console.log(s);
  }

  return { results, summaries };
}

// Persistent conversation state
let conversationMessages = [];
// Sliding window: oldest messages trimmed beyond this limit to prevent unbounded RAM growth.
// fitToContext() still handles what gets sent to the API — this caps the in-memory store only.
const MAX_CONVERSATION_HISTORY = 300;

// Mid-run user input buffer: notes injected by the user while the agent is running
const _midRunBuffer = [];

/**
 * Inject a user note into the running agent loop.
 * Called by the REPL when input arrives during processing.
 * @param {string} text
 */
function injectMidRunNote(text) {
  _midRunBuffer.push(text.trim());
}

/**
 * Drain and return buffered mid-run notes as a single string, or null if empty.
 */
function _drainMidRunBuffer() {
  if (_midRunBuffer.length === 0) return null;
  const notes = _midRunBuffer.splice(0, _midRunBuffer.length);
  return notes.join('\n');
}

/**
 * Build dynamic model routing guide for spawn_agents.
 * Only shown when 2+ models are available across configured providers.
 */
/**
 * Build language enforcement block for the system prompt.
 * Reads NEX_LANGUAGE, NEX_CODE_LANGUAGE, NEX_COMMIT_LANGUAGE from env.
 * If NEX_LANGUAGE is unset or "auto", the model responds in the user's message language.
 * If only NEX_LANGUAGE is set to a specific language, code comments and commits default to English.
 */
function _buildLanguagePrompt() {
  const uiLangRaw = process.env.NEX_LANGUAGE;
  const codeLang = process.env.NEX_CODE_LANGUAGE;
  const commitLang = process.env.NEX_COMMIT_LANGUAGE;

  // Treat unset and "auto" the same: respond in user's language
  const uiLang = (!uiLangRaw || uiLangRaw === 'auto') ? null : uiLangRaw;

  const lines = ['# Language Rules (CRITICAL — enforce strictly)\n'];

  if (uiLang) {
    lines.push(`RESPONSE LANGUAGE: You MUST always respond in ${uiLang}. This overrides any language defaults from your training. Never output Chinese, Japanese, or any other language in your responses — even when summarizing or thinking. ${uiLang} only.`);
  } else {
    // Auto mode: mirror the user's language
    lines.push('RESPONSE LANGUAGE: Always respond in the same language as the user\'s message. If the user writes in German, respond in German; if in English, respond in English; etc.');
  }

  // Always enforce real code examples
  lines.push('CODE EXAMPLES: Always show actual, working code examples — never pseudocode or placeholder snippets.');
  lines.push('COMPLETENESS RULES:');
  lines.push('  • ALWAYS show actual code when explaining implementations — never describe without showing');
  lines.push('  • Include complete examples with full context (imports, function signatures, error handling)');
  lines.push('  • Show alternative approaches when relevant (e.g., "Alternative: use util.promisify instead")');
  lines.push('  • Include edge cases in explanations (empty input, null values, boundary conditions)');
  lines.push('  • Provide platform-specific guidance when commands differ by OS (Linux/macOS/Windows)');
  lines.push('  • For Makefiles, paste the COMPLETE Makefile code DIRECTLY in your text response — every target, recipe, dependency, and .PHONY line. Writing the Makefile with a tool does NOT count as showing it. The Makefile MUST appear verbatim in your chat text as a code block, even if you also wrote it to a file. Never describe structure without showing the actual code. CRITICAL: use EXACTLY the command specified — if the task says "runs jest", write "jest" in the recipe, NEVER "npm test". npm test is NOT jest. Recipes need real TAB indentation. ONE .PHONY line listing ALL phony targets.');
  lines.push('  • For dataclasses, paste the COMPLETE dataclass code DIRECTLY in your text response — @dataclass decorator, all fields with types and defaults, full __post_init__ validation. Writing the file with a tool does NOT count as showing the code. The code MUST appear verbatim in your chat text, even if you also wrote it to a file.');
  lines.push('  • For cron expressions, re-read the exact time boundaries in the task before writing. If asked for 8-18h, the range is 8,9,...,18 — write exactly what was asked, not an approximation.');
  lines.push('  • When a task explicitly specifies a tool (e.g., "use tsc"), NEVER mention alternatives (e.g., "swc build") — use exactly what was requested.');
  lines.push('  • In Makefile prerequisites, NEVER use shell glob patterns like src/**/*.ts — make does not expand these natively. Keep prerequisite lists explicit or omit them. When a Makefile target says "runs jest", call jest directly in the recipe (not npm test).');
  lines.push('  • For bash in-place text replacements with backups: use ONLY ONE backup method — either sed -i.bak (let sed create the backup) OR cp file file.bak followed by sed -i (no extension). Never use both cp and sed -i.bak together — that produces redundant double backups (file.bak and file.bak.bak).');
  lines.push('  • For iterative array-flattening (flattenDeep): use push() and reverse() at the end — NEVER unshift(). unshift is O(n) per call making the whole function O(n^2). The iterative version MUST use a loop (while/for) and an explicit stack array — zero recursive calls. If a function calls itself, it is recursive regardless of its name. Never label a recursive function as iterative.');
  lines.push('  • FORBIDDEN: when refactoring callbacks to async/await, NEVER write try { ... } catch(e) { throw e } — this is an explicit anti-pattern. WRONG: async function f() { try { const d = await readFile(..); await writeFile(.., d); } catch(e) { throw e; } } — RIGHT: async function f() { const d = await readFile(..); await writeFile(.., d); } — omit the try-catch entirely, let rejections propagate.');
  lines.push('  • Docker HEALTHCHECK: always include --start-period=30s (or appropriate startup time) so the container has time to initialise before failures are counted. Also note that curl may not be available in minimal Node.js images — offer wget or "node -e" as alternatives.');
  lines.push('  • When fixing a bash word-splitting bug like "for f in $(ls *.txt)": replace the entire $(ls *.txt) with a bare glob directly — "for f in *.txt". The fix is eliminating the ls command and $() subshell entirely. Emphasise this in the explanation: the glob in the for loop prevents word splitting because the shell expands the glob into separate words before the loop — there is no subshell output to split. CRITICAL: NEVER suggest "ls -N" or any ls variant as a fix — ls -N outputs filenames one per line, but word splitting still occurs on each line when used in a subshell expansion. The only correct fix is the bare glob pattern.');

  const effectiveCodeLang = codeLang || (uiLang ? 'English' : null);
  if (effectiveCodeLang) {
    lines.push(`CODE LANGUAGE: Write all code comments, docstrings, variable descriptions, and inline documentation in ${effectiveCodeLang}.`);
  }

  const effectiveCommitLang = commitLang || (uiLang ? 'English' : null);
  if (effectiveCommitLang) {
    lines.push(`COMMIT MESSAGES: Write all git commit messages in ${effectiveCommitLang}.`);
  }

  if (uiLang) {
    lines.push(`\nThis is a hard requirement. Do NOT fall back to English or any other language for your responses, even if the user writes in a different language first.`);
  }

  return lines.join('\n') + '\n\n';
}

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
  } catch (err) {
    if (process.env.NEX_DEBUG) console.error('[agent] model routing guide failed:', err.message);
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

  const languagePrompt = _buildLanguagePrompt();
  cachedSystemPrompt = `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${process.cwd()}
All relative paths resolve from this directory.
PROJECT CONTEXT:
${projectContext}
${memoryContext ? `\n${memoryContext}\n` : ''}${skillInstructions ? `\n${skillInstructions}\n` : ''}${planPrompt ? `\n${planPrompt}\n` : ''}
${languagePrompt ? `${languagePrompt}\n` : ''}# Core Behavior

- You can use tools OR respond with text. For simple questions, answer directly.
- For coding tasks, use tools to read files, make changes, run tests, etc.
- Be concise but complete. Keep responses focused while ensuring the user gets the information they asked for.
- When referencing code, include file:line (e.g. src/app.js:42) so the user can navigate.
- Do not make up file paths or URLs. Use tools to discover them.

# Response Quality (Critical)

⚠ CRITICAL: The user CANNOT see tool output. They only see your text + 1-line summaries like "✓ bash ssh ... → ok".
If you run tools but write NO text → the user sees NOTHING useful. This is the #1 quality failure.

MANDATORY RULE: After ANY tool call that gathers information (bash, read_file, grep, ssh commands, etc.), you MUST write a text response summarizing the findings. NEVER end your response with only tool calls and no text.

CODE DISPLAY RULE: Always show actual code examples, not just descriptions. When explaining code:
  • Show the complete code snippet, not just describe it
  • Include file paths and line numbers (e.g., "src/app.js:42")
  • For regex patterns, show both the pattern and example matches. Be precise — test the pattern mentally. When rewriting for readability, use named constants or a commented breakdown (e.g. const OCTET = ...), NOT named capture groups — named group syntax varies by engine and is a frequent source of errors. NEVER claim functional equivalence without verifying edge cases (e.g. leading zeros, boundary values).
  • For Makefiles: (1) Output the COMPLETE Makefile in a fenced \`\`\`makefile code block IN YOUR TEXT first — before any tool calls. (2) Then optionally write it to disk. FORBIDDEN: using write_file for a Makefile and then only describing it in text — the code block in text is mandatory. The user CANNOT see write_file output. (3) Use EXACTLY the command from the description: "runs jest" → recipe is "jest" (NOT "npm test", NOT "npx jest"); "runs tsc" → recipe is "tsc". (4) Never suggest alternatives to the specified tool — if the task says tsc, only tsc appears in the Makefile.
  • For dataclasses, show the COMPLETE implementation — all fields with types, __post_init__ validation, and any defaults. Never describe without showing the code.
  • For cron expressions, quote the exact time constraint from the task verbatim, then write the expression. Verify boundary values (e.g., "8-18h" → hours 8 through 18 inclusive).

- Use markdown formatting: **bold** for key points, headers for sections, bullet lists for multiple items, \`code\` for identifiers. The terminal renders markdown with syntax highlighting.
- Structure longer responses with headers (## Section) so the user can scan quickly.

Response patterns by request type:
- **Questions / analysis / "status" / "explain" / "what is"**: Gather data with tools, then respond with a clear, structured summary. NEVER just run tools and stop.
- **Coding tasks (implement, fix, refactor)**: Brief confirmation of what you'll do, then use tools. After changes, summarize what you did and any important details.
- **Simple questions ("what does X do?")**: Answer directly without tools when you have enough context.
- **Ambiguous requests**: When a request is vague AND lacks sufficient detail to act (e.g. just "optimize this" or "improve performance" with no further context), ask clarifying questions using ask_user. However, if the user's message already contains specific details — file names, concrete steps, exercises, numbers, examples — proceed directly without asking. Only block when you genuinely cannot determine what to do without more information. When the user's request is ambiguous or could be interpreted in multiple ways, call the ask_user tool BEFORE starting work. Provide 2-3 specific, actionable options that cover the most likely intents. Do NOT ask open-ended questions in chat — always use ask_user with concrete options.
- **Server/SSH commands**: After running remote commands, ALWAYS present the results: service status, log errors, findings.
- **Regex explanations**: Show the original pattern, test it with concrete examples, then provide BOTH: (1) a named-constant rewrite (e.g. const OCTET = '...'; const IP_RE = new RegExp(...)) AND (2) a step-by-step validation function that replaces the regex entirely using split/conditions — this is often the most readable alternative. Named groups are engine-specific — prefer named constants or the validation function. Verify the rewrite matches all edge cases of the original before claiming equivalence.
- **Encoding/buffer handling**: When discussing file operations, mention utf8 encoding or buffer considerations. Use correct flags like --zero instead of -0 for null-delimited output.
- **Hook implementations (Git, bash scripts)**: Answer ENTIRELY in text — do NOT use any tools. Write the complete, correct script in your first and only response. Think through ALL edge cases (e.g. console.log in comments or strings vs real calls) before writing — handle them in the initial script, never iterate. Show the full file content and how to install it (chmod +x, correct .git/hooks/ path). For pre-commit hooks that check staged content: always use 'git diff --cached' to get only staged changes — never grep full file content, which would catch unstaged lines. Use '--diff-filter=ACM' to target added/copied/modified files — NEVER use '--diff-filter=D' (that shows ONLY deleted files, opposite of intent). NEVER use 'set -e' in pre-commit hooks — grep exits 1 on no match, which kills the entire script under set -e. Use explicit 'if git diff --cached ... | grep -q ...; then' flow control instead, and check exit codes explicitly. REGEX FALSE POSITIVES: When writing a regex to detect calls like console.log(), the pattern must exclude comment lines — pipe through 'grep -v "^\s*//"' before the pattern match so that lines like "// console.log(x)" do not trigger a false positive. CONSOLE METHODS: When a task asks to block console.log, explicitly address whether console.warn, console.error, console.debug, and console.info should also be blocked — if the intent is "no console output in production", block all console methods with a single pattern like 'console\.\(log\|warn\|error\|debug\|info\)'.
- **Memory leak explanations**: Show the problematic code, then present the primary fix (move emitter.on() outside the loop, registered once) with the original setInterval kept intact for its intended purpose. Then briefly mention 2 alternatives: (1) emitter.once() if only one event needs handling, (2) removeAllListeners() (or emitter.off(event, handler)) BEFORE re-registering inside the loop. CRITICAL for alternative 2: you MUST call removeAllListeners() or off() BEFORE the new emitter.on() — if you call emitter.on() inside an interval without first removing the previous listener, a new listener accumulates on every tick, which is the same leak as the original. Always show the removal step explicitly. Do NOT replace the setInterval body with an empty callback — keep the interval doing its original work.
- **Makefile tasks**: ALWAYS follow this exact order: (1) paste the COMPLETE Makefile in a fenced code block in your text response FIRST, (2) THEN optionally write it to a file with a tool. The user cannot see files you write — your text response is the ONLY output they receive. Never describe the Makefile in prose — paste the actual code. Every target, every recipe, every .PHONY line. Use EXACTLY the tools specified (jest means jest directly, not npm test; tsc means tsc). Never put glob patterns like src/**/*.ts in prerequisites — make does not expand them. MAKEFILE SYNTAX RULES (hard requirements): (a) Recipe lines MUST be indented with a real TAB character — never spaces; a space-indented recipe causes "missing separator" errors. (b) Declare ALL phony targets in a SINGLE .PHONY line at the top — NEVER split .PHONY across multiple declarations. (c) NEVER define the same target name twice — duplicate targets silently override each other and produce contradictory behaviour. (d) Do NOT add @echo lines unless the task explicitly asks for output messages.
- **Dataclass definitions**: Paste the COMPLETE dataclass code directly in your text response — @dataclass decorator, all fields with type annotations and defaults, full __post_init__ validation block. The code must appear verbatim in your chat text. Writing a file with a tool does NOT satisfy this — always also paste the code in text.
- **Cron expressions**: Before writing each expression, quote the exact constraint from the task, then derive the expression. Double-check boundary values match exactly what was asked. NEVER put cron expressions inside markdown tables — asterisks (*) in table cells are consumed as bold/italic markers and disappear. Always present each cron expression in its own fenced code block. For "every N minutes between X-Yh": only present both interpretations (inclusive vs. exclusive endpoint) when the task is genuinely ambiguous about whether the endpoint fires. If the task explicitly states "8-18h" or "until 18h" without qualification, write the expression with 8-18 directly — do NOT second-guess or add a confusing dual-interpretation note that contradicts the explicit request. The note is only appropriate when the task says something like "during business hours" or "until approximately 18h" where intent is unclear.
- **Express/fetch error handling**: When adding error handling to an Express route that fetches by ID: (1) validate the ID parameter first (check it exists and is a valid format), (2) wrap fetch in try-catch, (3) check response.ok and handle 404 specifically, (4) call next(error) to pass errors to Express error-handling middleware — do not just send a raw 500 response.
- **Command suggestions**: Always use correct command flags and syntax. For null-delimited output, use --zero or find/printf instead of non-existent flags like -0.
- **sed -i portability**: When showing 'sed -i' for in-place file editing, always note the macOS/BSD vs GNU difference: on macOS/BSD, '-i' requires an explicit backup suffix argument (e.g. 'sed -i "" "s/old/new/" file' for no backup, or 'sed -i.bak ...' for a backup); on GNU/Linux, 'sed -i "s/old/new/" file' works without the extra argument. When the user's platform is unknown or macOS, show the macOS-compatible form first. For cross-platform scripts, suggest 'perl -i -pe' as a portable alternative.

After completing multi-step tasks, suggest logical next steps (e.g. "You can run npm test to verify" or "Consider committing with /commit").

# Audit & Code Review Output

When performing audits, code reviews, bug hunts, or security reviews:

**1. Context Highlighting — always show WHY you're reading a file:**
  When following a reference found in one file to read another, prefix your explanation with the source:
  "Found reference in \`src/auth.js\`, checking \`lib/token.js\` to verify..."
  "Imported by \`main.js:42\`, reading \`utils/parse.js\` to trace the call..."
  This helps the user follow your investigation chain without seeing raw tool output.

**2. Selective reading — avoid reading large files blindly:**
  For files over 300 lines where relevance is uncertain, read a small range first (lines 1–80) to assess content and structure before committing to a full read. State your intent: "Large file (X lines) — scanning top to assess relevance..."

**3. Audit summary table — end every audit with a findings table:**
  After completing an audit, code review, or bug hunt, ALWAYS append a Markdown table summarizing results:
  | # | Finding | File | Severity | Recommended Fix |
  |---|---------|------|----------|-----------------|
  Severity levels: Critical / High / Medium / Low / Info.
  If nothing was found, write a brief "✓ No issues found" table with the areas checked.

**4. Actionable next steps — offer to apply fixes:**
  After the findings table, list numbered fixes and ask explicitly:
  "Shall I apply **Fix #1** (race condition in auth.js)? Type 'yes' or 'fix 1'."
  If multiple fixes exist, list them all and let the user choose which to apply first.

# Response Content Guidelines

- **Avoid opinionated additions**: Only include what was explicitly requested. Do not add:
  - Unrequested fields (e.g., pagination fields not asked for)
  - Unnecessary patterns or interfaces
  - Opinionated design decisions beyond the scope of the request
  - Extra features or improvements not explicitly requested
- **Preserve existing behavior**: When refactoring or fixing code, maintain the original encoding, error handling, and API behavior unless explicitly instructed to change it.
- **Be complete**: Ensure responses include all necessary information and are not truncated. If a response would be very long, summarize key points and offer to provide more detail if needed.

# Frontend Design

When creating or significantly modifying any frontend file (.html, .vue, .jsx, .tsx, .css, templates, components):

1. **Read existing siblings first.** Before writing any new frontend file, find and read 1-2 existing files of the same type in the project (e.g. a neighboring template, another component in the same directory). This reveals the project's design system: CSS variables, utility class names, layout patterns, and framework conventions. Never invent CSS or layouts from scratch.

2. **Use the project's design tokens.** If the project uses Tailwind, use its utility classes. If it defines CSS variables like --accent or helper classes like .btn-primary, use them. Don't add new custom CSS that duplicates existing abstractions.

3. **Match the framework conventions.** If existing templates use HTMX for server-side updates, use HTMX. If they use Alpine.js v3, use the v3 API (\$el, \$dispatch, x-on:, not this.__x.\$data). If they use plain fetch(), don't mix in HTMX. Be consistent with the surrounding code.

4. **Never create new design patterns when existing ones work.** If the project has a modal pattern, a card pattern, or a list-item pattern — reuse it. Don't invent a new one.

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

# Brain Knowledge Base

You have access to a persistent knowledge base in .nex/brain/.
- Use brain_write to save important discoveries, patterns, or decisions
- Write when you find: architecture insights, recurring error patterns, API quirks, deployment steps
- Do NOT write trivial or session-specific information
- Do NOT duplicate what's already in NEX.md or project memory
- Use descriptive kebab-case names: "auth-flow", "db-migration-steps"
- Include tags in frontmatter for better retrieval
- The user reviews all brain writes via /brain review or git diff

`;

  cachedContextHash = currentHash;
  return cachedSystemPrompt;
}

function clearConversation() {
  conversationMessages = [];
}

function trimConversationHistory() {
  if (conversationMessages.length > MAX_CONVERSATION_HISTORY) {
    conversationMessages.splice(0, conversationMessages.length - MAX_CONVERSATION_HISTORY);
  }
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
/**
 * Quick project pre-scan: file counts + dependency snapshot.
 * Runs concurrently with fitToContext to fill the "Thinking..." gap.
 * Only called on the first user message of a new conversation.
 * Returns a formatted string or null if the project is too small.
 */
async function _runPreScan() {
  const { execFile } = require('child_process');
  const fs = require('fs');
  const cwd = process.cwd();

  const run = (cmd, args) => new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 3000 }, (err, stdout) => {
      resolve(err ? '' : (stdout || '').trim());
    });
  });

  // Find source files (exclude common build/dependency dirs)
  const [filesOut] = await Promise.all([
    run('find', ['.', '-type', 'f',
      '-not', '-path', '*/node_modules/*',
      '-not', '-path', '*/.git/*',
      '-not', '-path', '*/dist/*',
      '-not', '-path', '*/.next/*',
      '-not', '-path', '*/build/*',
      '-not', '-path', '*/__pycache__/*',
      '-not', '-path', '*/vendor/*',
    ]),
  ]);

  const EXTS = new Set(['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'rb', 'java', 'cpp', 'c', 'cs']);
  const files = (filesOut ? filesOut.split('\n') : []).filter(f => {
    const ext = f.split('.').pop();
    return EXTS.has(ext);
  });

  if (files.length < 3) return null;

  // Count by extension
  const counts = {};
  for (const f of files) {
    const ext = f.split('.').pop();
    counts[ext] = (counts[ext] || 0) + 1;
  }

  const fileParts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ext, n]) => `${n} .${ext}`)
    .join(' · ');

  let line = `  📁 ${fileParts}`;

  // Dependencies from package.json if present
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
      if (deps.length > 0) {
        const shown = deps.slice(0, 5).join(' · ');
        const extra = deps.length > 5 ? ` +${deps.length - 5}` : '';
        line += `\n  📦 ${shown}${extra}`;
      }
    } catch { /* ignore malformed package.json */ }
  }

  return line;
}

/**
 * Fire a desktop notification on macOS (non-blocking, best-effort).
 * Only fires when terminal is not focused (background tasks) and elapsed > 30s.
 * @param {string} message
 */
function _notifyDesktop(message) {
  if (process.platform !== 'darwin') return;
  try {
    const { execFileSync } = require('child_process');
    // Use osascript — no extra dependencies needed
    execFileSync('osascript', [
      '-e',
      `display notification "${message.replace(/"/g, '\\"')}" with title "nex-code"`,
    ], { timeout: 3000, stdio: 'ignore' });
  } catch { /* ignore — notification is best-effort */ }
}

function _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime) {
  if (totalSteps < 1) return;

  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);
  let resume = `── ${totalSteps} ${totalSteps === 1 ? 'step' : 'steps'} · ${totalTools} ${totalTools === 1 ? 'tool' : 'tools'}`;
  let elapsedSecs = 0;
  if (startTime) {
    const elapsed = Date.now() - startTime;
    elapsedSecs = Math.round(elapsed / 1000);
    resume += elapsedSecs >= 60
      ? ` · ${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`
      : ` · ${elapsedSecs}s`;
  }
  if (filesModified.size > 0) {
    resume += ` · ${filesModified.size} ${filesModified.size === 1 ? 'file' : 'files'} modified`;
  }
  resume += ' ──';
  console.log(`\n${C.dim}  ${resume}${C.reset}`);

  // Desktop notification for long-running tasks (> 30s)
  if (elapsedSecs >= 30 && process.stdout.isTTY) {
    const summary = filesModified.size > 0
      ? `Done — ${filesModified.size} ${filesModified.size === 1 ? 'file' : 'files'} modified in ${elapsedSecs}s`
      : `Done — ${totalSteps} ${totalSteps === 1 ? 'step' : 'steps'} in ${elapsedSecs}s`;
    _notifyDesktop(summary);
  }

  // Follow-up suggestions based on what happened
  if (filesModified.size > 0) {
    console.log(`${C.dim}  💡 /diff · /commit · /undo${C.reset}`);
  } else if (filesRead.size >= 5 && filesModified.size === 0 && totalSteps >= 3) {
    // Audit / read-heavy session — prompt for applying fixes
    console.log(`${C.dim}  💡 Found issues? Say "fix 1" or "apply all fixes"${C.reset}`);
  } else if (filesRead.size > 0 && totalSteps >= 2) {
    console.log(`${C.dim}  💡 /save · /clear${C.reset}`);
  }
}

/**
 * Interactive recovery prompt shown when stale-stream retries are exhausted.
 * Offers: retry / switch to fast model / switch to reliable model / quit.
 * Returns { action: 'retry' | 'switch' | 'quit', model?: string, provider?: string }
 */
async function _staleRecoveryPrompt() {
  if (!process.stdout.isTTY) return { action: 'quit' };

  const providerName = getActiveProviderName();
  const currentModelId = getActiveModelId();
  const fastModel = MODEL_EQUIVALENTS.fast?.[providerName];
  const reliableModel = MODEL_EQUIVALENTS.strong?.[providerName];

  const hasFastAlt = fastModel && fastModel !== currentModelId;
  const hasReliableAlt = reliableModel && reliableModel !== currentModelId && reliableModel !== fastModel;

  const options = [];
  options.push({ key: 'r', label: `Retry with current model ${C.dim}(${currentModelId})${C.reset}` });
  if (hasFastAlt) {
    options.push({ key: 'f', label: `Switch to ${C.bold}${fastModel}${C.reset} ${C.dim}— fast, low latency${C.reset}`, model: fastModel });
  }
  if (hasReliableAlt) {
    options.push({ key: 's', label: `Switch to ${C.bold}${reliableModel}${C.reset} ${C.dim}— reliable tool-calling, medium speed${C.reset}`, model: reliableModel });
  }
  options.push({ key: 'q', label: `${C.dim}Quit${C.reset}` });

  console.log();
  console.log(`${C.yellow}  Stream stale — all retries exhausted.${C.reset} What would you like to do?`);
  for (const opt of options) {
    console.log(`  ${C.cyan}[${opt.key}]${C.reset} ${opt.label}`);
  }

  process.stdout.write(`  ${C.yellow}> ${C.reset}`);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let handled = false;
    const onKey = (key) => {
      if (handled) return;
      handled = true;
      stdin.removeListener('data', onKey);
      stdin.setRawMode(wasRaw || false);
      stdin.pause();

      const a = key.toLowerCase().trim();
      process.stdout.write(`${a}\n`); // echo the chosen key

      // Ctrl+C → quit
      if (key === '\u0003') return resolve({ action: 'quit' });

      const match = options.find(o => o.key === a);
      if (!match || match.key === 'q' || (!match.model && match.key !== 'r')) {
        resolve({ action: 'quit' });
      } else if (match.key === 'r') {
        resolve({ action: 'retry' });
      } else {
        resolve({ action: 'switch', model: match.model, provider: providerName });
      }
    };

    stdin.on('data', onKey);
  });
}

/**
 * Process a single user input through the agentic loop.
 * Maintains conversation state across calls.
 */
async function processInput(userInput) {
  const userContent = buildUserContent(userInput);
  conversationMessages.push({ role: 'user', content: userContent });
  trimConversationHistory();

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

  // Append brain context (query-dependent, not part of cached system prompt)
  let effectiveSystemPrompt = systemPrompt;
  try {
    const { getBrainContext } = require('./brain');
    const brainContext = await getBrainContext(userInput);
    if (brainContext) {
      effectiveSystemPrompt = systemPrompt + '\n' + brainContext + '\n';
    }
  } catch (err) { /* brain is optional */
    if (process.env.NEX_DEBUG) console.error('[agent] brain context failed:', err.message);
  }

  const fullMessages = [{ role: 'system', content: effectiveSystemPrompt }, ...conversationMessages];

  // Pre-spinner: visible activity during fitToContext + getUsage (can take 50–5000ms with LLM compacting)
  const preSpinner = new Spinner('Thinking...');
  preSpinner.start();

  // Start pre-scan concurrently on the FIRST message of a new conversation.
  // Results fill the "Thinking..." dead time with useful project context.
  const isFirstMessage = conversationMessages.length === 1;
  const preScanPromise = isFirstMessage ? _runPreScan().catch(() => null) : Promise.resolve(null);

  // Context-aware compression: fit messages into context window
  const allTools = getAllToolDefinitions();
  const [{ messages: fittedMessages, compressed, compacted, tokensRemoved }, preScanResult] = await Promise.all([
    fitToContext(fullMessages, allTools),
    preScanPromise,
  ]);

  // Context budget warning
  const usage = getUsage(fullMessages, allTools);

  preSpinner.stop();

  // Show pre-scan snapshot (first message only, non-empty projects)
  if (preScanResult) {
    console.log(`${C.dim}${preScanResult}${C.reset}`);
  }

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
  let contextRetries = 0;    // budget for 400-error context-overflow recovery
  let staleCompressUsed = 0; // separate budget for stale-retry compress (doesn't consume contextRetries)

  // ─── Stats tracking for résumé ───
  let totalSteps = 0;
  const toolCounts = new Map();
  const filesModified = new Set();
  const filesRead = new Set();
  const startTime = Date.now();
  const fileEditCounts = new Map(); // loop detection: edits per file
  const LOOP_WARN_EDITS = 2;  // warn agent after 2 edits to same file (early warning)
  const LOOP_ABORT_EDITS = 5; // abort loop after 5 edits to same file
  const bashCmdCounts = new Map(); // loop detection: repeated bash commands
  const LOOP_WARN_BASH = 5;   // warn after 5 similar bash commands
  const LOOP_ABORT_BASH = 8;  // abort after 8 similar bash commands
  let consecutiveErrors = 0;  // loop detection: consecutive tool failures
  const LOOP_WARN_ERRORS = 6; // warn after 6 consecutive errors
  const LOOP_ABORT_ERRORS = 10; // abort after 10 consecutive errors

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

    // Advance plan step cursor when a new tool iteration starts
    if (totalSteps > 0) advancePlanStep();

    let spinner = null;
    if (taskProgress && taskProgress.isActive()) {
      // Resume the live task display instead of a plain spinner
      if (taskProgress._paused) taskProgress.resume();
    } else if (!taskProgress) {
      let spinnerText;
      const planInfo = getPlanStepInfo();
      if (planInfo && planInfo.total > 1) {
        const label = planInfo.description.length > 40
          ? planInfo.description.slice(0, 37) + '…'
          : planInfo.description;
        spinnerText = `Plan step ${planInfo.current}/${planInfo.total}: ${label}`;
      } else {
        spinnerText = totalSteps > 0 ? `Thinking... (step ${totalSteps + 1})` : 'Thinking...';
      }
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
        const fastModel = MODEL_EQUIVALENTS.fast?.[getActiveProviderName()];
        console.log(`${C.yellow}  ⚠ No tokens received for ${Math.round(elapsed / 1000)}s — waiting...${C.reset}`);
        if (fastModel && fastModel !== getActiveModelId()) {
          console.log(`${C.dim}  💡 Will auto-switch to ${fastModel} if no tokens arrive before abort${C.reset}`);
        } else if (fastModel) {
          console.log(`${C.dim}  💡 Ctrl+C to abort and retry${C.reset}`);
        }
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
        onThinkingToken: () => {
          // Thinking-model reasoning tokens: reset stale timer but don't display
          lastTokenTime = Date.now();
          staleWarned = false;
        },
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
              }, 50);
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
            if (!stepPrinted) { stepPrinted = true; }
            stream.startCursor();
            firstToken = false;
          }
          streamedText += text;
        },
      });
    } catch (err) {
      clearInterval(staleTimer);
      if (flushTimeout) { clearTimeout(flushTimeout); flushTimeout = null; }
      if (tokenBuffer && stream) { stream.push(tokenBuffer); tokenBuffer = ''; }
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
          if (taskProgress) { taskProgress.stop(); taskProgress = null; }
          const recovery = await _staleRecoveryPrompt();
          if (recovery.action === 'quit') {
            setOnChange(null);
            _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
            saveNow(conversationMessages);
            break;
          }
          if (recovery.action === 'switch') {
            setActiveModel(`${recovery.provider}:${recovery.model}`);
            console.log(`${C.green}  ✓ Switched to ${recovery.provider}:${recovery.model}${C.reset}`);
          }
          // 'retry' or 'switch': reset counters and retry
          staleRetries = 0;
          contextRetries = 0;
          i--;
          continue;
        }
        // Progressive delay: 3s on first retry, 5s on subsequent
        const delay = staleRetries === 1 ? 3000 : 5000;
        // Auto-switch to fast model on first stale retry (don't waste another 120s on the same model)
        // Uses staleCompressUsed (not contextRetries) so 400-error recovery budget stays intact.
        // Nuclear compression on stale switch: context is already large enough to cause a timeout,
        // so aggressively trim to 35% to give the (possibly smaller) fast model headroom.
        if (staleRetries >= 1 && staleCompressUsed < 1) {
          staleCompressUsed++;
          console.log(`${C.yellow}  ⚠ Stale retry ${staleRetries}/${MAX_STALE_RETRIES} — force-compressing before retry...${C.reset}`);
          const allTools = getAllToolDefinitions();
          const { messages: compressedMsgs, tokensRemoved } = forceCompress(apiMessages, allTools, true); // nuclear: 35% target
          apiMessages = compressedMsgs;
          if (tokensRemoved > 0) {
            console.log(`${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`);
          }
          if (STALE_AUTO_SWITCH) {
            const fastModel = MODEL_EQUIVALENTS.fast?.[getActiveProviderName()];
            if (fastModel && fastModel !== getActiveModelId()) {
              setActiveModel(`${getActiveProviderName()}:${fastModel}`);
              console.log(`${C.cyan}  ⚡ Auto-switched to ${fastModel} to avoid further stale timeouts${C.reset}`);
              console.log(`${C.dim}  (disable with NEX_STALE_AUTO_SWITCH=0)${C.reset}`);
            }
          }
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
        saveNow(conversationMessages);
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
        // On any 400, always try force-compress first — the most common cause is a context
        // overflow where Ollama returns a bare 400 with no useful message. Token-count
        // heuristics are too unreliable to gate this: just try and retry.
        // If a stale switch already happened (staleCompressUsed > 0), we already did nuclear
        // compression — jump straight to nuclear for 400s too to avoid wasting light attempts.
        if (contextRetries < 3) {
          contextRetries++;
          const nuclear = contextRetries === 3 || staleCompressUsed > 0;
          if (nuclear) {
            console.log(`${C.yellow}  ⚠ Bad request (400) — nuclear compression (attempt ${contextRetries}/3, dropping history)...${C.reset}`);
          } else {
            console.log(`${C.yellow}  ⚠ Bad request (400) — force-compressing and retrying... (attempt ${contextRetries}/3)${C.reset}`);
          }
          const allTools = getAllToolDefinitions();
          const { messages: compressedMsgs, tokensRemoved } = forceCompress(apiMessages, allTools, nuclear);
          apiMessages = compressedMsgs;
          if (tokensRemoved > 0) {
            console.log(`${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`);
          }
          i--;
          continue;
        }
        // All compress retries exhausted — give up with informative message
        userMessage = 'Context too large to compress — use /clear to start fresh';
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
          saveNow(conversationMessages);
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
          saveNow(conversationMessages);
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
      saveNow(conversationMessages);
      break;
    }

    clearInterval(staleTimer);
    // Successful API response — reset per-call retry counters so transient
    // rate-limit or network errors earlier in the session don't eat future retry budget.
    rateLimitRetries = 0;
    networkRetries = 0;

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
        conversationMessages.push(nudge); // keep both arrays in sync (turn-alternation invariant)
        continue; // retry — don't count as a new step
      }
      // In plan mode: save the plan text output to disk and extract structured steps
      if (isPlanMode() && hasText) {
        const planText = (content || streamedText || '').trim();
        setPlanContent(planText);
        _savePlanToFile(planText);
        // Extract structured steps from LLM output so they can be tracked during execution
        const extractedSteps = extractStepsFromText(planText);
        if (extractedSteps.length > 0) {
          // Determine task description from first user message in this session
          const taskMsg = conversationMessages.find((m) => m.role === 'user');
          const taskDesc = typeof taskMsg?.content === 'string'
            ? taskMsg.content.slice(0, 120)
            : 'Task';
          createPlan(taskDesc, extractedSteps);
          const stepWord = extractedSteps.length === 1 ? 'step' : 'steps';
          console.log(`\n${C.cyan}${C.bold}Plan ready${C.reset} ${C.dim}(${extractedSteps.length} ${stepWord} extracted).${C.reset} Type ${C.cyan}/plan approve${C.reset}${C.dim} to execute, or ${C.reset}${C.cyan}/plan edit${C.reset}${C.dim} to review.${C.reset}`);
        } else {
          console.log(`\n${C.cyan}${C.bold}Plan ready.${C.reset} ${C.dim}Type ${C.reset}${C.cyan}/plan approve${C.reset}${C.dim} to execute, or ask follow-up questions to refine.${C.reset}`);
        }
      }
      if (taskProgress) { taskProgress.stop(); taskProgress = null; }
      setOnChange(null);
      _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
      saveNow(conversationMessages);
      return;
    }

    // ─── Update stats ───
    totalSteps++;
    if (totalSteps >= 1) stepPrinted = false; // show step header from first tool call onward
    for (const tc of tool_calls) {
      const name = tc.function.name;
      toolCounts.set(name, (toolCounts.get(name) || 0) + 1);
    }

    // ─── Prepare all tool calls (parse, validate, permissions) ───
    // Run all preparations concurrently. Each call is independent: permission
    // checks and validation are synchronous; only user-confirmation prompts
    // are async, but readline serialises them through stdin automatically.
    const prepared = await Promise.all(tool_calls.map(tc => prepareToolCall(tc)));

    // ─── Execute with parallel batching (quiet mode: spinner + compact summaries) ───
    const batchOpts = taskProgress ? { skipSpinner: true, skipSummaries: true } : {};
    // ask_user renders its own UI — skip the normal section header for it
    const hasAskUser = prepared.some(p => p.fnName === 'ask_user');
    // Print bullet header immediately (before execution) so it appears while working
    const _showStepHeader = !batchOpts.skipSummaries && !stepPrinted;
    let _spinAnim = null;
    if (_showStepHeader && !hasAskUser) {
      stepPrinted = true;
      batchOpts.skipSpinner = true;
      if (process.stdout.isTTY) {
        // Blink the ● via ANSI \x1b[5m while the tool executes — no interval needed,
        // the terminal handles blinking natively so it works even for sub-ms tools
        process.stdout.write(formatSectionHeader(prepared, totalSteps, false, 'blink'));
        _spinAnim = true; // flag: header needs \r\x1b[2K cleanup after execution
      } else {
        process.stdout.write(formatSectionHeader(prepared, totalSteps, false) + '\n');
      }
    } else if (_showStepHeader) {
      stepPrinted = true;
      batchOpts.skipSpinner = true;
    }
    // Resume TaskProgress animation during tool execution so the UI never looks frozen
    if (taskProgress && taskProgress._paused) taskProgress.resume();
    const { results: toolMessages, summaries: batchSummaries } = await executeBatch(prepared, true, { ...batchOpts, skipSummaries: true });

    // Stop blink, finalize header with static dot
    if (_spinAnim) {
      _spinAnim = null;
      process.stdout.write(`\r\x1b[2K${formatSectionHeader(prepared, totalSteps, false)}\n`);
    }

    // Print summaries below the header (skip ask_user — it renders its own UI)
    if (!batchOpts.skipSummaries) {
      for (let si = 0; si < batchSummaries.length; si++) {
        if (prepared[si] && prepared[si].fnName === 'ask_user') continue;
        console.log(batchSummaries[si]);
      }
    }

    // Track modified and read files
    for (let j = 0; j < prepared.length; j++) {
      const prep = prepared[j];
      if (!prep.canExecute) continue;
      const res = toolMessages[j].content;
      // Only inspect the first line — tool output may legitimately contain
      // "ERROR" or "CANCELLED" in matched content (e.g. grep finding log lines).
      const firstLine = res.split('\n')[0];
      const isOk = !firstLine.startsWith('ERROR') && !firstLine.startsWith('CANCELLED');
      if (isOk && ['write_file', 'edit_file', 'patch_file'].includes(prep.fnName)) {
        if (prep.args && prep.args.path) {
          filesModified.add(prep.args.path);
          const count = (fileEditCounts.get(prep.args.path) || 0) + 1;
          fileEditCounts.set(prep.args.path, count);
          const shortPath = prep.args.path.split('/').slice(-2).join('/');
          if (count === LOOP_WARN_EDITS) {
            console.log(`${C.yellow}  ⚠ Loop warning: "${shortPath}" edited ${count}× — possible edit loop${C.reset}`);
            const loopWarning = {
              role: 'user',
              content: `[SYSTEM WARNING] You have edited "${prep.args.path}" ${count} times already. STOP. Do NOT edit this file again unless absolutely necessary. Read it once to verify the current state, make at most ONE more targeted change, then move on or declare the task complete. Further edits to this file will abort the session.`,
            };
            conversationMessages.push(loopWarning);
            apiMessages.push(loopWarning);
          } else if (count >= LOOP_ABORT_EDITS) {
            console.log(`${C.red}  ✖ Loop abort: "${shortPath}" edited ${count}× — aborting to prevent runaway loop${C.reset}`);
            if (taskProgress) { taskProgress.stop(); taskProgress = null; }
            setOnChange(null);
            _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
            saveNow(conversationMessages);
            return;
          }
        }
      }
      // Bash command loop detection
      if (prep.fnName === 'bash_exec' && prep.args && prep.args.command) {
        const cmdKey = prep.args.command.replace(/\s+/g, ' ').trim().slice(0, 100);
        const bashCount = (bashCmdCounts.get(cmdKey) || 0) + 1;
        bashCmdCounts.set(cmdKey, bashCount);
        if (bashCount === LOOP_WARN_BASH) {
          console.log(`${C.yellow}  ⚠ Loop warning: same bash command run ${bashCount}× — possible debug loop${C.reset}`);
          const bashWarning = {
            role: 'user',
            content: `[SYSTEM WARNING] You have run the same or similar bash command ${bashCount} times. This looks like a debug loop. STOP repeating the same command. Try a completely different approach or declare that the current approach is not working and explain why.`,
          };
          conversationMessages.push(bashWarning);
          apiMessages.push(bashWarning);
        } else if (bashCount >= LOOP_ABORT_BASH) {
          console.log(`${C.red}  ✖ Loop abort: same bash command run ${bashCount}× — aborting runaway debug loop${C.reset}`);
          if (taskProgress) { taskProgress.stop(); taskProgress = null; }
          setOnChange(null);
          _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
          saveNow(conversationMessages);
          return;
        }
      }
      // Consecutive error detection
      if (!isOk) {
        consecutiveErrors++;
        if (consecutiveErrors === LOOP_WARN_ERRORS) {
          console.log(`${C.yellow}  ⚠ Loop warning: ${consecutiveErrors} consecutive tool errors — possible stuck loop${C.reset}`);
          const errWarning = {
            role: 'user',
            content: `[SYSTEM WARNING] ${consecutiveErrors} consecutive tool calls have failed. You appear to be stuck. STOP trying variations of the same failing approach. Either try something fundamentally different, acknowledge the limitation, or declare the task complete with what you have.`,
          };
          conversationMessages.push(errWarning);
          apiMessages.push(errWarning);
        } else if (consecutiveErrors >= LOOP_ABORT_ERRORS) {
          console.log(`${C.red}  ✖ Loop abort: ${consecutiveErrors} consecutive errors — aborting stuck loop${C.reset}`);
          if (taskProgress) { taskProgress.stop(); taskProgress = null; }
          setOnChange(null);
          _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
          saveNow(conversationMessages);
          return;
        }
      } else {
        consecutiveErrors = 0; // reset on success
      }
      if (isOk && prep.fnName === 'read_file') {
        if (prep.args && prep.args.path) filesRead.add(prep.args.path);
      }
    }

    for (const toolMsg of toolMessages) {
      conversationMessages.push(toolMsg);
      apiMessages.push(toolMsg);
    }

    // ─── Mid-run user notes ───
    // If the user typed something while the agent was running, inject it now
    // before the next API call so the model can take it into account.
    const midRunNote = _drainMidRunBuffer();
    if (midRunNote) {
      const noteMsg = { role: 'user', content: `[User note mid-run]: ${midRunNote}` };
      conversationMessages.push(noteMsg);
      apiMessages.push(noteMsg);
      console.log(`${C.cyan}  ✎ Kontext hinzugefügt${C.reset}`);
    }
  }

  // Only print résumé + max-iterations warning if the loop actually exhausted (not on break)
  if (i >= iterLimit) {
    if (taskProgress) { taskProgress.stop(); taskProgress = null; }
    setOnChange(null);
    _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
    saveNow(conversationMessages);

    const { getActiveProviderName: _getProviderName } = require('./providers/registry');
    const provider = _getProviderName();
    if (provider === 'ollama' && autoExtensions < MAX_AUTO_EXTENSIONS) {
      // Free provider — auto-extend silently.
      // iterLimit is reset to 20 (not += 20) because continue outer resets i to 0,
      // so the next pass runs exactly 20 more iterations, not the full cumulative sum
      // (which would give 70+90+...+250 = 1650 total instead of the intended 250).
      autoExtensions++;
      iterLimit = 20;
      console.log(`${C.dim}  ── auto-extending (+20 turns, ext ${autoExtensions}/${MAX_AUTO_EXTENSIONS}) ──${C.reset}`);
      continue outer;
    }

    // Paid provider (or hard cap reached) — ask before spending more
    console.log(`\n${C.yellow}⚠ Max iterations reached.${C.reset}`);
    const keepGoing = await confirm(`  Continue for 20 more turns?`);
    if (keepGoing) {
      iterLimit = 20; // continue outer resets i to 0, so set exactly 20 new turns
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
  // Mid-run input injection
  injectMidRunNote,
};

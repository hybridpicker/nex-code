/**
 * cli/hooks.js — Hook System
 * Execute custom scripts in response to CLI events.
 * Hook scripts live in .nex/hooks/ or are configured in .nex/config.json
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Valid hook events
 */
const HOOK_EVENTS = [
  "pre-tool", // Before any tool execution
  "post-tool", // After tool execution
  "pre-commit", // Before git commit
  "post-response", // After LLM response
  "session-start", // When REPL starts
  "session-end", // When REPL exits
];

function getHooksDir() {
  return path.join(process.cwd(), ".nex", "hooks");
}

function getConfigPath() {
  return path.join(process.cwd(), ".nex", "config.json");
}

/**
 * Load hook configuration from .nex/config.json
 * @returns {Object<string, string[]>} — event → array of commands
 */
function loadHookConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config.hooks || {};
  } catch {
    return {};
  }
}

/**
 * Get all hooks for a given event
 * Sources: .nex/hooks/{event} files + .nex/config.json hooks
 * @param {string} event
 * @returns {string[]} — array of commands to execute
 */
function getHooksForEvent(event) {
  if (!HOOK_EVENTS.includes(event)) return [];

  const hooks = [];

  // 1. Check .nex/hooks/{event} script
  const hooksDir = getHooksDir();
  const scriptPath = path.join(hooksDir, event);
  if (fs.existsSync(scriptPath)) {
    hooks.push(scriptPath);
  }

  // 2. Check .nex/config.json hooks
  const config = loadHookConfig();
  if (config[event]) {
    const cmds = Array.isArray(config[event]) ? config[event] : [config[event]];
    hooks.push(...cmds);
  }

  return hooks;
}

/**
 * Execute a single hook command
 * @param {string} command
 * @param {Object} env — additional environment variables
 * @param {number} timeout — ms
 * @returns {{success: boolean, output?: string, error?: string}}
 */
function executeHook(command, env = {}, timeout = 30000) {
  try {
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { success: true, exitCode: 0, output: output.trim() };
  } catch (err) {
    const exitCode = typeof err.status === "number" ? err.status : 1;
    return {
      success: false,
      exitCode,
      // exit code 2 means the hook wants to hard-block the tool call
      blocked: exitCode === 2,
      output: err.stdout ? err.stdout.trim() : "",
      error: err.stderr ? err.stderr.trim() : err.message,
    };
  }
}

/**
 * Run all hooks for an event
 * @param {string} event
 * @param {Object} context — contextual data passed as env vars
 * @returns {{ results: Array, blocked: boolean, blockReason?: string }}
 *
 * Exit code semantics (pre-tool hooks only):
 *   0  → allow (continue normally)
 *   2  → hard-block the tool call; blockReason is returned to the model
 *   other non-zero → warn but continue (same as before)
 */
function runHooks(event, context = {}) {
  const hooks = getHooksForEvent(event);
  if (hooks.length === 0) return { results: [], blocked: false };

  // Convert context to NEX_* env vars
  const env = {};
  for (const [key, value] of Object.entries(context)) {
    env[`NEX_${key.toUpperCase()}`] = String(value);
  }

  const results = [];
  for (const command of hooks) {
    const result = executeHook(command, env);
    results.push({ command, ...result });

    // exit code 2 on pre-* hooks = hard block
    // Prefer stdout output as the reason (script can echo a message), fall
    // back to stderr, then the generic error message.
    if (result.blocked && event.startsWith("pre-")) {
      const reason = result.output || result.error || "hook blocked tool call";
      return { results, blocked: true, blockReason: reason };
    }

    // other failure on pre-* hooks = stop chain but don't block
    if (!result.success && event.startsWith("pre-")) {
      break;
    }
  }

  return { results, blocked: false };
}

/**
 * Check if any hooks are configured for an event
 * @param {string} event
 * @returns {boolean}
 */
function hasHooks(event) {
  return getHooksForEvent(event).length > 0;
}

/**
 * List all configured hooks
 * @returns {Array<{event: string, commands: string[]}>}
 */
function listHooks() {
  const result = [];
  for (const event of HOOK_EVENTS) {
    const commands = getHooksForEvent(event);
    if (commands.length > 0) {
      result.push({ event, commands });
    }
  }
  return result;
}

/**
 * Initialize hooks directory
 */
function initHooksDir() {
  const dir = getHooksDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

module.exports = {
  HOOK_EVENTS,
  loadHookConfig,
  getHooksForEvent,
  executeHook,
  runHooks,
  hasHooks,
  listHooks,
  initHooksDir,
};

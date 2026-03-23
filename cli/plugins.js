/**
 * cli/plugins.js — Plugin API
 * Load plugins from .nex/plugins/*.js and provide registration APIs.
 */

const fs = require("fs");
const path = require("path");

// Plugin registry
const _plugins = [];
const _registeredTools = [];
const _hooks = {};

// Event types
const EVENTS = [
  "onToolResult", // After a tool executes
  "onModelResponse", // After model responds
  "onSessionStart", // When session starts
  "onSessionEnd", // When session ends
  "onFileChange", // When a file is modified
  "beforeToolExec", // Before tool executes (can modify args)
  "afterToolExec", // After tool executes (can modify result)
];

/**
 * Register a custom tool.
 * @param {object} definition - Tool definition (same format as TOOL_DEFINITIONS)
 * @param {Function} handler - Async handler: (args, options) => string
 * @returns {{ ok: boolean, error?: string }}
 */
function registerTool(definition, handler) {
  if (!definition || !definition.function || !definition.function.name) {
    return { ok: false, error: "Tool definition must have function.name" };
  }
  if (typeof handler !== "function") {
    return { ok: false, error: "Handler must be a function" };
  }

  const name = definition.function.name;

  // Check for conflicts
  if (_registeredTools.some((t) => t.definition.function.name === name)) {
    return { ok: false, error: `Tool "${name}" is already registered` };
  }

  _registeredTools.push({
    definition: {
      type: "function",
      ...definition,
    },
    handler,
  });

  return { ok: true };
}

/**
 * Register a hook for an event.
 * @param {string} event - Event name (see EVENTS)
 * @param {Function} handler - Async handler
 * @returns {{ ok: boolean, error?: string }}
 */
function registerHook(event, handler) {
  if (!EVENTS.includes(event)) {
    return {
      ok: false,
      error: `Unknown event "${event}". Available: ${EVENTS.join(", ")}`,
    };
  }
  if (typeof handler !== "function") {
    return { ok: false, error: "Handler must be a function" };
  }

  if (!_hooks[event]) _hooks[event] = [];
  _hooks[event].push(handler);

  return { ok: true };
}

/**
 * Emit an event and call all registered hooks.
 * @param {string} event - Event name
 * @param {object} data - Event data
 * @returns {Promise<object>} Modified data (hooks can modify it)
 */
async function emit(event, data) {
  const handlers = _hooks[event] || [];
  let result = data;

  for (const handler of handlers) {
    try {
      const modified = await handler(result);
      if (modified !== undefined) result = modified;
    } catch (err) {
      if (process.env.NEX_DEBUG) {
        console.error(`[plugin] Hook error on ${event}: ${err.message}`);
      }
    }
  }

  return result;
}

/**
 * Load all plugins from .nex/plugins/*.js
 * Each plugin receives a context object with registerTool and registerHook.
 *
 * @returns {{ loaded: number, errors: string[] }}
 */
function loadPlugins() {
  const pluginsDir = path.join(process.cwd(), ".nex", "plugins");
  const errors = [];

  if (!fs.existsSync(pluginsDir)) {
    return { loaded: 0, errors: [] };
  }

  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith(".js"));

  const context = {
    registerTool,
    registerHook,
    EVENTS,
  };

  for (const file of files) {
    const filePath = path.join(pluginsDir, file);
    try {
      const plugin = require(filePath);

      if (typeof plugin === "function") {
        // Plugin exports a setup function
        plugin(context);
      } else if (typeof plugin.setup === "function") {
        // Plugin exports an object with setup()
        plugin.setup(context);
      } else {
        errors.push(
          `${file}: Plugin must export a function or { setup: function }`,
        );
        continue;
      }

      _plugins.push({
        name: plugin.name || path.basename(file, ".js"),
        filePath,
      });
    } catch (err) {
      errors.push(`${file}: ${err.message}`);
    }
  }

  return { loaded: _plugins.length, errors };
}

/**
 * Get all registered plugin tools (for inclusion in TOOL_DEFINITIONS).
 * @returns {Array} Tool definitions
 */
function getPluginToolDefinitions() {
  return _registeredTools.map((t) => t.definition);
}

/**
 * Execute a plugin tool by name.
 * @param {string} name - Tool name
 * @param {object} args - Tool arguments
 * @param {object} options - Execution options
 * @returns {Promise<string|null>} Result or null if not a plugin tool
 */
async function executePluginTool(name, args, options = {}) {
  const tool = _registeredTools.find(
    (t) => t.definition.function.name === name,
  );
  if (!tool) return null;

  // Emit beforeToolExec
  const modifiedArgs = await emit("beforeToolExec", { name, args, options });

  const result = await tool.handler(modifiedArgs.args || args, options);

  // Emit afterToolExec
  const modifiedResult = await emit("afterToolExec", { name, args, result });

  return modifiedResult.result || result;
}

/**
 * Get loaded plugin info.
 * @returns {Array<{ name: string, filePath: string }>}
 */
function getLoadedPlugins() {
  return [..._plugins];
}

/**
 * Get registered hook count per event.
 * @returns {Object<string, number>}
 */
function getHookCounts() {
  const counts = {};
  for (const event of EVENTS) {
    counts[event] = (_hooks[event] || []).length;
  }
  return counts;
}

/**
 * Clear all plugins and hooks (for testing).
 */
function clearPlugins() {
  _plugins.length = 0;
  _registeredTools.length = 0;
  for (const key of Object.keys(_hooks)) {
    delete _hooks[key];
  }
}

module.exports = {
  registerTool,
  registerHook,
  emit,
  loadPlugins,
  getPluginToolDefinitions,
  executePluginTool,
  getLoadedPlugins,
  getHookCounts,
  clearPlugins,
  EVENTS,
};

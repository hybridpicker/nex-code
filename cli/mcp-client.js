/**
 * cli/mcp-client.js — MCP (Model Context Protocol) Client
 *
 * Lightweight client that reads server configs from .nex/mcp.json (project)
 * or ~/.nex/mcp.json (global), spawns MCP servers as child processes via
 * stdio JSON-RPC transport, discovers their tools, and makes them available
 * to the nex-code tool registry.
 *
 * Config format (.nex/mcp.json):
 * {
 *   "servers": {
 *     "brave-search": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-brave-search"],
 *       "env": { "BRAVE_API_KEY": "${BRAVE_API_KEY}" }
 *     }
 *   }
 * }
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Active server connections: name → { proc, tools, config }
const _servers = new Map();

// ─── Config ───────────────────────────────────────────────────

/**
 * Interpolate ${VAR} references in env values from process.env.
 * @param {string} value
 * @returns {string}
 */
function _interpolateEnv(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, name) => {
    return process.env[name] !== undefined ? process.env[name] : "";
  });
}

/**
 * Read MCP config from the given path or default locations.
 * Default search order:
 *   1. configPath argument (if provided)
 *   2. <cwd>/.nex/mcp.json
 *   3. ~/.nex/mcp.json
 *
 * @param {string} [configPath]
 * @returns {{ servers: Object }}
 */
function _readConfig(configPath) {
  // Allow the --mcp-config CLI flag to override the default search path
  const explicitPath = configPath || process.env.NEX_MCP_CONFIG || null;
  const candidates = explicitPath
    ? [explicitPath]
    : [
        path.join(process.cwd(), ".nex", "mcp.json"),
        path.join(os.homedir(), ".nex", "mcp.json"),
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
        return raw;
      } catch {
        // Invalid JSON — skip
      }
    }
  }
  return { servers: {} };
}

// ─── JSON-RPC over stdio ──────────────────────────────────────

/**
 * Send a JSON-RPC request to a child process and wait for the matching reply.
 * @param {import('child_process').ChildProcess} proc
 * @param {string} method
 * @param {Object} params
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<any>}
 */
function _sendRequest(proc, method, params = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const line = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";

    let buffer = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`MCP request timeout: ${method}`));
    }, timeoutMs);

    function onData(data) {
      buffer += data.toString();
      const lines = buffer.split("\n");
      for (const l of lines) {
        if (!l.trim()) continue;
        try {
          const msg = JSON.parse(l);
          if (msg.id === id) {
            cleanup();
            if (msg.error) {
              reject(
                new Error(
                  `MCP error: ${msg.error.message || JSON.stringify(msg.error)}`,
                ),
              );
            } else {
              resolve(msg.result);
            }
            return;
          }
        } catch {
          // Partial line — keep buffering
        }
      }
      buffer = lines[lines.length - 1] || "";
    }

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.removeListener("data", onData);
    }

    proc.stdout.on("data", onData);
    try {
      proc.stdin.write(line);
    } catch (e) {
      cleanup();
      reject(new Error(`MCP write failed: ${e.message}`));
    }
  });
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Spawn MCP servers and discover their tools.
 * Gracefully skips servers that fail to start or time out.
 *
 * @param {string} [configPath]  Path to mcp.json (optional — defaults to .nex/mcp.json)
 * @returns {Promise<Array<{name: string, tools: number, error?: string}>>}
 */
async function loadMcpServers(configPath) {
  const config = _readConfig(configPath);
  const serverMap = config.servers || {};
  const results = [];

  for (const [name, conf] of Object.entries(serverMap)) {
    if (_servers.has(name)) {
      const existing = _servers.get(name);
      results.push({ name, tools: existing.tools.length });
      continue;
    }

    // Resolve env vars in the server's env block
    const resolvedEnv = {};
    for (const [k, v] of Object.entries(conf.env || {})) {
      resolvedEnv[k] = _interpolateEnv(v);
    }

    // Allowlist safe ambient env vars + server-specific vars
    const SAFE_PASSTHROUGH = [
      "PATH",
      "HOME",
      "USER",
      "SHELL",
      "LANG",
      "TERM",
      "NODE_ENV",
    ];
    const baseEnv = {};
    for (const key of SAFE_PASSTHROUGH) {
      if (process.env[key] !== undefined) baseEnv[key] = process.env[key];
    }

    let proc;
    try {
      proc = spawn(conf.command, conf.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...baseEnv, ...resolvedEnv },
      });
    } catch (err) {
      console.warn(`[mcp-client] Failed to spawn '${name}': ${err.message}`);
      results.push({ name, tools: 0, error: err.message });
      continue;
    }

    try {
      await _sendRequest(proc, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "nex-code", version: "0.4.8" },
      });

      const toolsResult = await _sendRequest(proc, "tools/list", {});
      const tools = (toolsResult && toolsResult.tools) || [];

      _servers.set(name, { name, proc, tools, config: conf });
      results.push({ name, tools: tools.length });
    } catch (err) {
      console.warn(
        `[mcp-client] Server '${name}' failed to initialize: ${err.message}`,
      );
      try {
        proc.kill();
      } catch {
        /* already dead */
      }
      results.push({ name, tools: 0, error: err.message });
    }
  }

  return results;
}

/**
 * Call a tool on a connected MCP server.
 * @param {string} serverName
 * @param {string} toolName
 * @param {Object} [args]
 * @returns {Promise<string>}
 */
async function callMcpTool(serverName, toolName, args = {}) {
  const server = _servers.get(serverName);
  if (!server) {
    throw new Error(`MCP server not connected: ${serverName}`);
  }

  const result = await _sendRequest(server.proc, "tools/call", {
    name: toolName,
    arguments: args,
  });

  // MCP returns a content array — extract text items
  if (result && Array.isArray(result.content)) {
    return result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return JSON.stringify(result);
}

/**
 * Return all discovered tools in nex-code tool-definition format
 * (OpenAI function-calling schema with mcp_<server>_<tool> naming).
 *
 * @returns {Array<{type: string, function: {name: string, description: string, parameters: Object}}>}
 */
function getMcpTools() {
  const defs = [];
  for (const [serverName, server] of _servers) {
    for (const tool of server.tools) {
      defs.push({
        type: "function",
        function: {
          name: `mcp_${serverName}_${tool.name}`,
          description: `[MCP:${serverName}] ${tool.description || ""}`,
          parameters: tool.inputSchema || { type: "object", properties: {} },
        },
      });
    }
  }
  return defs;
}

/**
 * Kill all running MCP server processes.
 */
function shutdownMcpServers() {
  for (const [name, server] of _servers) {
    try {
      server.proc.kill();
    } catch {
      /* already dead */
    }
    _servers.delete(name);
  }
}

/**
 * List all known servers and their connection status.
 * @returns {Array<{name: string, connected: boolean, toolCount: number}>}
 */
function listMcpServers() {
  const result = [];
  for (const [name, server] of _servers) {
    result.push({
      name,
      connected: true,
      toolCount: server.tools.length,
    });
  }
  return result;
}

// ─── Internal helpers exposed for testing ─────────────────────
module.exports = {
  loadMcpServers,
  callMcpTool,
  getMcpTools,
  shutdownMcpServers,
  listMcpServers,
  _interpolateEnv,
  _readConfig,
  _sendRequest,
};

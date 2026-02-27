/**
 * cli/mcp.js — MCP (Model Context Protocol) Client
 * Discovers and invokes tools from external MCP servers via JSON-RPC over stdio.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Active MCP server connections
const activeServers = new Map();

function getConfigPath() {
  return path.join(process.cwd(), '.nex', 'config.json');
}

/**
 * Load MCP server configurations from .nex/config.json
 * @returns {Object<string, {command: string, args?: string[], env?: Object}>}
 */
function loadMCPConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.mcpServers || {};
  } catch {
    return {};
  }
}

/**
 * Send a JSON-RPC request to an MCP server process
 * @param {import('child_process').ChildProcess} proc
 * @param {string} method
 * @param {Object} params
 * @param {number} timeout — ms
 * @returns {Promise<Object>}
 */
function sendRequest(proc, method, params = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const request = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`MCP request timeout: ${method}`));
    }, timeout);

    function onData(data) {
      buffer += data.toString();
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            cleanup();
            if (msg.error) {
              reject(new Error(`MCP error: ${msg.error.message || JSON.stringify(msg.error)}`));
            } else {
              resolve(msg.result);
            }
            return;
          }
        } catch {
          // Not valid JSON yet, continue buffering
        }
      }
      // Keep only the last incomplete line
      buffer = lines[lines.length - 1] || '';
    }

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.removeListener('data', onData);
    }

    proc.stdout.on('data', onData);
    try {
      proc.stdin.write(request);
    } catch (e) {
      cleanup();
      reject(new Error(`MCP write failed: ${e.message}`));
    }
  });
}

/**
 * Connect to an MCP server
 * @param {string} name
 * @param {{command: string, args?: string[], env?: Object}} config
 * @returns {Promise<{name: string, tools: Array}>}
 */
async function connectServer(name, config) {
  if (activeServers.has(name)) {
    return activeServers.get(name);
  }

  // Allowlist safe env vars to prevent API key leakage
  const SAFE_ENV_KEYS = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM', 'NODE_ENV'];
  const filteredEnv = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key]) filteredEnv[key] = process.env[key];
  }
  const proc = spawn(config.command, config.args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...filteredEnv, ...(config.env || {}) },
  });

  const server = { name, proc, tools: [], config };

  // Initialize with JSON-RPC
  try {
    await sendRequest(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nex-code', version: '0.2.0' },
    });

    // Discover tools
    const toolsResult = await sendRequest(proc, 'tools/list', {});
    server.tools = (toolsResult && toolsResult.tools) || [];

    activeServers.set(name, server);
    return server;
  } catch (err) {
    proc.kill();
    throw new Error(`Failed to connect MCP server '${name}': ${err.message}`);
  }
}

/**
 * Disconnect an MCP server
 * @param {string} name
 */
function disconnectServer(name) {
  const server = activeServers.get(name);
  if (!server) return false;
  try {
    server.proc.kill();
  } catch {
    // Process may already be dead
  }
  activeServers.delete(name);
  return true;
}

/**
 * Disconnect all MCP servers
 */
function disconnectAll() {
  for (const [name] of activeServers) {
    disconnectServer(name);
  }
}

/**
 * Call a tool on an MCP server
 * @param {string} serverName
 * @param {string} toolName
 * @param {Object} args
 * @returns {Promise<string>}
 */
async function callTool(serverName, toolName, args = {}) {
  const server = activeServers.get(serverName);
  if (!server) throw new Error(`MCP server not connected: ${serverName}`);

  const result = await sendRequest(server.proc, 'tools/call', {
    name: toolName,
    arguments: args,
  });

  // MCP returns content array — extract text
  if (result && Array.isArray(result.content)) {
    return result.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
  }
  return JSON.stringify(result);
}

/**
 * Get all tools from all connected MCP servers
 * @returns {Array<{server: string, name: string, description: string, inputSchema: Object}>}
 */
function getAllTools() {
  const tools = [];
  for (const [serverName, server] of activeServers) {
    for (const tool of server.tools) {
      tools.push({
        server: serverName,
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || { type: 'object', properties: {} },
      });
    }
  }
  return tools;
}

/**
 * Convert MCP tools to OpenAI-style tool definitions for the LLM
 * @returns {Array}
 */
function getMCPToolDefinitions() {
  return getAllTools().map((t) => ({
    type: 'function',
    function: {
      name: `mcp_${t.server}_${t.name}`,
      description: `[MCP:${t.server}] ${t.description}`,
      parameters: t.inputSchema,
    },
  }));
}

/**
 * Check if a tool call is an MCP tool and route it
 * @param {string} fnName
 * @param {Object} args
 * @returns {Promise<string|null>} — null if not an MCP tool
 */
async function routeMCPCall(fnName, args) {
  if (!fnName.startsWith('mcp_')) return null;

  const parts = fnName.substring(4).split('_');
  if (parts.length < 2) return null;

  const serverName = parts[0];
  const toolName = parts.slice(1).join('_');

  return callTool(serverName, toolName, args);
}

/**
 * List configured MCP servers and their status
 * @returns {Array<{name: string, command: string, connected: boolean, toolCount: number}>}
 */
function listServers() {
  const config = loadMCPConfig();
  return Object.entries(config).map(([name, conf]) => {
    const server = activeServers.get(name);
    return {
      name,
      command: conf.command,
      connected: !!server,
      toolCount: server ? server.tools.length : 0,
    };
  });
}

/**
 * Connect all configured MCP servers
 * @returns {Promise<Array<{name: string, tools: number, error?: string}>>}
 */
async function connectAll() {
  const config = loadMCPConfig();
  const results = [];
  for (const [name, conf] of Object.entries(config)) {
    try {
      const server = await connectServer(name, conf);
      results.push({ name, tools: server.tools.length });
    } catch (err) {
      results.push({ name, tools: 0, error: err.message });
    }
  }
  return results;
}

module.exports = {
  loadMCPConfig,
  sendRequest,
  connectServer,
  disconnectServer,
  disconnectAll,
  callTool,
  getAllTools,
  getMCPToolDefinitions,
  routeMCPCall,
  listServers,
  connectAll,
};

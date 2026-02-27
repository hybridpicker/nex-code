/**
 * Tests for MCP functions that require a connected server.
 * Uses jest.mock to intercept child_process.spawn at import time.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');

// Mock spawn BEFORE require('../cli/mcp')
const mockSpawn = jest.fn();
jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return { ...actual, spawn: (...args) => mockSpawn(...args) };
});

const {
  connectServer,
  disconnectServer,
  disconnectAll,
  callTool,
  getAllTools,
  getMCPToolDefinitions,
  routeMCPCall,
  listServers,
  connectAll,
} = require('../cli/mcp');

function createMockProc() {
  const stdin = { write: jest.fn(), end: jest.fn() };
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = { stdin, stdout, stderr, kill: jest.fn(), on: jest.fn(), pid: 12345 };

  stdin.write.mockImplementation((data) => {
    const request = JSON.parse(data.trim());
    let response;

    if (request.method === 'initialize') {
      response = { jsonrpc: '2.0', id: request.id, result: { capabilities: {} } };
    } else if (request.method === 'tools/list') {
      response = {
        jsonrpc: '2.0', id: request.id,
        result: { tools: [
          { name: 'echo', description: 'Echo input', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
          { name: 'add', description: 'Add numbers', inputSchema: { type: 'object', properties: {} } },
        ] },
      };
    } else if (request.method === 'tools/call') {
      response = {
        jsonrpc: '2.0', id: request.id,
        result: { content: [{ type: 'text', text: `result: ${JSON.stringify(request.params.arguments)}` }] },
      };
    } else {
      response = { jsonrpc: '2.0', id: request.id, result: {} };
    }

    setImmediate(() => stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n')));
  });

  return proc;
}

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-mcp-conn-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  disconnectAll();
  mockSpawn.mockImplementation(() => createMockProc());
});

afterEach(() => {
  disconnectAll();
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('mcp.js (connected server)', () => {
  it('connectServer initializes and discovers tools', async () => {
    const server = await connectServer('mock-srv', { command: 'mock', args: [] });
    expect(server.name).toBe('mock-srv');
    expect(server.tools).toHaveLength(2);
    expect(server.tools[0].name).toBe('echo');
  });

  it('connectServer returns existing server on re-connect', async () => {
    const s1 = await connectServer('mock-srv', { command: 'mock', args: [] });
    const s2 = await connectServer('mock-srv', { command: 'mock', args: [] });
    expect(s1).toBe(s2);
  });

  it('disconnectServer kills and removes server', async () => {
    const server = await connectServer('mock-srv', { command: 'mock', args: [] });
    expect(disconnectServer('mock-srv')).toBe(true);
    expect(server.proc.kill).toHaveBeenCalled();
    expect(disconnectServer('mock-srv')).toBe(false);
  });

  it('disconnectAll removes all servers', async () => {
    await connectServer('srv-a', { command: 'mock', args: [] });
    await connectServer('srv-b', { command: 'mock', args: [] });
    disconnectAll();
    expect(getAllTools()).toEqual([]);
  });

  it('getAllTools returns tools from connected servers', async () => {
    await connectServer('mock-srv', { command: 'mock', args: [] });
    const tools = getAllTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].server).toBe('mock-srv');
    expect(tools[0].name).toBe('echo');
    expect(tools[1].name).toBe('add');
  });

  it('getMCPToolDefinitions returns OpenAI-format definitions', async () => {
    await connectServer('mock-srv', { command: 'mock', args: [] });
    const defs = getMCPToolDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs[0].type).toBe('function');
    expect(defs[0].function.name).toBe('mcp_mock-srv_echo');
    expect(defs[0].function.description).toContain('MCP:mock-srv');
  });

  it('callTool sends request and returns text result', async () => {
    await connectServer('mock-srv', { command: 'mock', args: [] });
    const result = await callTool('mock-srv', 'echo', { text: 'hello' });
    expect(result).toContain('result:');
    expect(result).toContain('hello');
  });

  it('callTool returns JSON for non-content results', async () => {
    const proc = createMockProc();
    proc.stdin.write.mockImplementation((data) => {
      const request = JSON.parse(data.trim());
      let response;
      if (request.method === 'initialize') {
        response = { jsonrpc: '2.0', id: request.id, result: {} };
      } else if (request.method === 'tools/list') {
        response = { jsonrpc: '2.0', id: request.id, result: { tools: [{ name: 'raw' }] } };
      } else if (request.method === 'tools/call') {
        response = { jsonrpc: '2.0', id: request.id, result: { status: 'ok' } };
      }
      setImmediate(() => proc.stdout.emit('data', Buffer.from(JSON.stringify(response) + '\n')));
    });
    mockSpawn.mockReturnValueOnce(proc);

    await connectServer('raw-srv', { command: 'mock', args: [] });
    const result = await callTool('raw-srv', 'raw', {});
    expect(result).toContain('status');
    expect(result).toContain('ok');
  });

  it('routeMCPCall routes to correct server and tool', async () => {
    await connectServer('mock-srv', { command: 'mock', args: [] });
    const result = await routeMCPCall('mcp_mock-srv_echo', { text: 'test' });
    expect(result).toContain('result:');
  });

  it('listServers shows connected status', async () => {
    const configDir = path.join(tmpDir, '.nex');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ mcpServers: { 'mock-srv': { command: 'mock' } } })
    );
    await connectServer('mock-srv', { command: 'mock', args: [] });
    const servers = listServers();
    expect(servers[0].connected).toBe(true);
    expect(servers[0].toolCount).toBe(2);
  });

  it('connectAll connects configured servers', async () => {
    const configDir = path.join(tmpDir, '.nex');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ mcpServers: { 'srv1': { command: 'mock' } } })
    );

    const results = await connectAll();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('srv1');
    expect(results[0].tools).toBe(2);
  });

  it('disconnectServer handles proc.kill() throwing', async () => {
    const server = await connectServer('kill-fail', { command: 'mock', args: [] });
    server.proc.kill.mockImplementation(() => { throw new Error('already dead'); });
    expect(disconnectServer('kill-fail')).toBe(true);
  });
});

const path = require('path');
const fs = require('fs');
const os = require('os');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-mcp-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const {
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
} = require('../cli/mcp');

describe('mcp.js', () => {
  // ─── loadMCPConfig ────────────────────────────────────────
  describe('loadMCPConfig()', () => {
    it('returns empty object when no config file exists', () => {
      expect(loadMCPConfig()).toEqual({});
    });

    it('returns empty object when config has no mcpServers', () => {
      const configDir = path.join(tmpDir, '.nex');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ hooks: {} }));
      expect(loadMCPConfig()).toEqual({});
    });

    it('returns mcpServers from config', () => {
      const configDir = path.join(tmpDir, '.nex');
      fs.mkdirSync(configDir, { recursive: true });
      const config = {
        mcpServers: {
          'test-server': { command: 'node', args: ['server.js'] },
        },
      };
      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));
      const result = loadMCPConfig();
      expect(result['test-server']).toBeDefined();
      expect(result['test-server'].command).toBe('node');
    });

    it('handles corrupt config file', () => {
      const configDir = path.join(tmpDir, '.nex');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'config.json'), 'not json');
      expect(loadMCPConfig()).toEqual({});
    });
  });

  // ─── sendRequest ──────────────────────────────────────────
  describe('sendRequest()', () => {
    it('sends JSON-RPC request and resolves on response', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
      };

      const promise = sendRequest(mockProc, 'test/method', { key: 'value' }, 5000);

      // Simulate response
      const onData = mockProc.stdout.on.mock.calls[0][1];
      const written = mockProc.stdin.write.mock.calls[0][0];
      const requestObj = JSON.parse(written.trim());

      // Reply with matching id
      const response = JSON.stringify({ jsonrpc: '2.0', id: requestObj.id, result: { ok: true } });
      onData(Buffer.from(response + '\n'));

      const result = await promise;
      expect(result).toEqual({ ok: true });
    });

    it('rejects on error response', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
      };

      const promise = sendRequest(mockProc, 'test/fail', {}, 5000);
      const onData = mockProc.stdout.on.mock.calls[0][1];
      const written = mockProc.stdin.write.mock.calls[0][0];
      const requestObj = JSON.parse(written.trim());

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: requestObj.id,
        error: { code: -1, message: 'Something failed' },
      });
      onData(Buffer.from(response + '\n'));

      await expect(promise).rejects.toThrow('MCP error: Something failed');
    });

    it('rejects on timeout', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
      };

      const promise = sendRequest(mockProc, 'test/timeout', {}, 50);
      await expect(promise).rejects.toThrow('MCP request timeout');
    });

    it('handles partial JSON buffering', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: {
          on: jest.fn(),
          removeListener: jest.fn(),
        },
      };

      const promise = sendRequest(mockProc, 'test/partial', {}, 5000);
      const onData = mockProc.stdout.on.mock.calls[0][1];
      const written = mockProc.stdin.write.mock.calls[0][0];
      const requestObj = JSON.parse(written.trim());

      const response = JSON.stringify({ jsonrpc: '2.0', id: requestObj.id, result: { partial: true } });
      // Send in two chunks
      onData(Buffer.from(response.substring(0, 10)));
      onData(Buffer.from(response.substring(10) + '\n'));

      const result = await promise;
      expect(result).toEqual({ partial: true });
    });
  });

  // ─── getAllTools / getMCPToolDefinitions ───────────────────
  describe('getAllTools()', () => {
    it('returns empty array when no servers connected', () => {
      disconnectAll();
      expect(getAllTools()).toEqual([]);
    });
  });

  describe('getMCPToolDefinitions()', () => {
    it('returns empty array when no servers connected', () => {
      disconnectAll();
      expect(getMCPToolDefinitions()).toEqual([]);
    });
  });

  // ─── routeMCPCall ─────────────────────────────────────────
  describe('routeMCPCall()', () => {
    it('returns null for non-MCP tool names', async () => {
      expect(await routeMCPCall('bash', {})).toBeNull();
      expect(await routeMCPCall('read_file', {})).toBeNull();
    });

    it('returns null for malformed MCP tool names', async () => {
      expect(await routeMCPCall('mcp_', {})).toBeNull();
    });

    it('throws when server is not connected', async () => {
      disconnectAll();
      await expect(routeMCPCall('mcp_unknown_tool', {})).rejects.toThrow('not connected');
    });
  });

  // ─── disconnectServer ─────────────────────────────────────
  describe('disconnectServer()', () => {
    it('returns false for non-existent server', () => {
      expect(disconnectServer('nonexistent')).toBe(false);
    });
  });

  // ─── disconnectAll ────────────────────────────────────────
  describe('disconnectAll()', () => {
    it('clears all servers without error', () => {
      expect(() => disconnectAll()).not.toThrow();
    });
  });

  // ─── listServers ──────────────────────────────────────────
  describe('listServers()', () => {
    it('returns empty array when no config', () => {
      expect(listServers()).toEqual([]);
    });

    it('lists configured servers with connection status', () => {
      const configDir = path.join(tmpDir, '.nex');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({
          mcpServers: {
            'my-server': { command: 'node', args: ['test.js'] },
          },
        })
      );

      const servers = listServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('my-server');
      expect(servers[0].connected).toBe(false);
      expect(servers[0].toolCount).toBe(0);
    });
  });

  // ─── callTool ─────────────────────────────────────────────
  describe('callTool()', () => {
    it('throws when server not connected', async () => {
      disconnectAll();
      await expect(callTool('no-server', 'tool', {})).rejects.toThrow('not connected');
    });
  });

  // ─── connectServer ────────────────────────────────────────
  describe('connectServer()', () => {
    it('rejects when process fails to respond', async () => {
      // Use a command that exits immediately without speaking JSON-RPC
      await expect(
        connectServer('failing', { command: 'echo', args: ['bye'] })
      ).rejects.toThrow(/Failed to connect|MCP write failed|MCP request timeout|EPIPE/);
    }, 15000);
  });

  // ─── sendRequest write failure ─────────────────────────────
  describe('sendRequest write failure', () => {
    it('rejects when stdin.write throws', async () => {
      const mockProc = {
        stdin: { write: jest.fn().mockImplementation(() => { throw new Error('write broken'); }) },
        stdout: { on: jest.fn(), removeListener: jest.fn() },
      };
      await expect(sendRequest(mockProc, 'test/write-fail', {}, 5000)).rejects.toThrow('MCP write failed');
    });
  });

  // ─── Integration: sendRequest with error object ───────────
  describe('sendRequest edge cases', () => {
    it('handles error without message field', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn(), removeListener: jest.fn() },
      };

      const promise = sendRequest(mockProc, 'test/err', {}, 5000);
      const onData = mockProc.stdout.on.mock.calls[0][1];
      const written = mockProc.stdin.write.mock.calls[0][0];
      const requestObj = JSON.parse(written.trim());

      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: requestObj.id,
        error: { code: -32600 },
      });
      onData(Buffer.from(response + '\n'));

      await expect(promise).rejects.toThrow('MCP error');
    });

    it('ignores responses with non-matching id', async () => {
      const mockProc = {
        stdin: { write: jest.fn() },
        stdout: { on: jest.fn(), removeListener: jest.fn() },
      };

      const promise = sendRequest(mockProc, 'test/mismatch', {}, 5000);
      const onData = mockProc.stdout.on.mock.calls[0][1];
      const written = mockProc.stdin.write.mock.calls[0][0];
      const requestObj = JSON.parse(written.trim());

      // Send wrong id first, then correct id
      onData(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 'wrong-id', result: { wrong: true } }) + '\n'));
      onData(Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: requestObj.id, result: { correct: true } }) + '\n'));

      const result = await promise;
      expect(result).toEqual({ correct: true });
    });
  });
});

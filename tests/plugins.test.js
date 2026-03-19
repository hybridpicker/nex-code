const { registerTool, registerHook, emit, loadPlugins, getPluginToolDefinitions, executePluginTool, clearPlugins, EVENTS } = require('../cli/plugins');

describe('plugins.js', () => {
  afterEach(() => {
    clearPlugins();
  });

  describe('registerTool', () => {
    test('registers a valid tool', () => {
      const result = registerTool(
        { function: { name: 'my_tool', description: 'test', parameters: { type: 'object', properties: {}, required: [] } } },
        async () => 'ok'
      );
      expect(result.ok).toBe(true);
    });

    test('rejects duplicate tool name', () => {
      registerTool({ function: { name: 'dup', description: 'test', parameters: { type: 'object', properties: {}, required: [] } } }, async () => 'ok');
      const result = registerTool({ function: { name: 'dup', description: 'test2', parameters: { type: 'object', properties: {}, required: [] } } }, async () => 'ok2');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('already registered');
    });

    test('rejects missing function name', () => {
      const result = registerTool({}, async () => 'ok');
      expect(result.ok).toBe(false);
    });

    test('rejects non-function handler', () => {
      const result = registerTool({ function: { name: 'test', description: 'test', parameters: { type: 'object', properties: {}, required: [] } } }, 'not a function');
      expect(result.ok).toBe(false);
    });
  });

  describe('registerHook', () => {
    test('registers a valid hook', () => {
      const result = registerHook('onToolResult', async () => {});
      expect(result.ok).toBe(true);
    });

    test('rejects unknown event', () => {
      const result = registerHook('nonExistent', async () => {});
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown event');
    });
  });

  describe('emit', () => {
    test('calls registered hooks', async () => {
      const fn = jest.fn().mockReturnValue(undefined);
      registerHook('onToolResult', fn);
      await emit('onToolResult', { tool: 'test' });
      expect(fn).toHaveBeenCalledWith({ tool: 'test' });
    });

    test('passes modified data through hooks', async () => {
      registerHook('beforeToolExec', async (data) => ({ ...data, modified: true }));
      const result = await emit('beforeToolExec', { name: 'test' });
      expect(result.modified).toBe(true);
    });
  });

  describe('executePluginTool', () => {
    test('executes a registered plugin tool', async () => {
      registerTool(
        { function: { name: 'hello', description: 'Say hello', parameters: { type: 'object', properties: {}, required: [] } } },
        async () => 'Hello, World!'
      );
      const result = await executePluginTool('hello', {});
      expect(result).toBe('Hello, World!');
    });

    test('returns null for unknown tools', async () => {
      const result = await executePluginTool('nonexistent', {});
      expect(result).toBeNull();
    });
  });

  describe('getPluginToolDefinitions', () => {
    test('returns registered tools', () => {
      registerTool(
        { function: { name: 'custom', description: 'Custom tool', parameters: { type: 'object', properties: {}, required: [] } } },
        async () => 'result'
      );
      const defs = getPluginToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].function.name).toBe('custom');
    });
  });

  describe('EVENTS', () => {
    test('contains expected events', () => {
      expect(EVENTS).toContain('onToolResult');
      expect(EVENTS).toContain('onModelResponse');
      expect(EVENTS).toContain('beforeToolExec');
      expect(EVENTS).toContain('afterToolExec');
    });

    test('contains all 7 event types', () => {
      expect(EVENTS).toHaveLength(7);
      expect(EVENTS).toContain('onSessionStart');
      expect(EVENTS).toContain('onSessionEnd');
      expect(EVENTS).toContain('onFileChange');
    });
  });

  // ─── registerHook - additional ─────────────────────────────
  describe('registerHook - additional', () => {
    test('rejects non-function handler', () => {
      const result = registerHook('onToolResult', 'not a function');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Handler must be a function');
    });

    test('allows multiple hooks for same event', () => {
      registerHook('onToolResult', async () => {});
      const result = registerHook('onToolResult', async () => {});
      expect(result.ok).toBe(true);
    });
  });

  // ─── emit - error handling ─────────────────────────────────
  describe('emit - error handling', () => {
    test('catches hook errors and continues', async () => {
      registerHook('onToolResult', async () => { throw new Error('boom'); });
      registerHook('onToolResult', async (data) => ({ ...data, second: true }));
      const result = await emit('onToolResult', { name: 'test' });
      expect(result.second).toBe(true);
    });

    test('logs hook errors when NEX_DEBUG is set', async () => {
      const origDebug = process.env.NEX_DEBUG;
      process.env.NEX_DEBUG = '1';
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      registerHook('onToolResult', async () => { throw new Error('debug-boom'); });
      await emit('onToolResult', { name: 'test' });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('debug-boom'));
      spy.mockRestore();
      if (origDebug === undefined) delete process.env.NEX_DEBUG;
      else process.env.NEX_DEBUG = origDebug;
    });

    test('returns unmodified data when hooks return undefined', async () => {
      registerHook('onToolResult', async () => undefined);
      const result = await emit('onToolResult', { name: 'test' });
      expect(result).toEqual({ name: 'test' });
    });

    test('returns data unchanged when no hooks registered', async () => {
      const result = await emit('onFileChange', { file: 'test.js' });
      expect(result).toEqual({ file: 'test.js' });
    });
  });

  // ─── loadPlugins ───────────────────────────────────────────
  describe('loadPlugins', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-plugin-test-'));
      jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('returns loaded: 0 when plugins dir does not exist', () => {
      const result = loadPlugins();
      expect(result.loaded).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test('loads plugin that exports a function', () => {
      const pluginsDir = path.join(tmpDir, '.nex', 'plugins');
      fs.mkdirSync(pluginsDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginsDir, 'test-plugin.js'),
        'module.exports = function(ctx) { ctx.registerHook("onSessionStart", async () => {}); };'
      );
      const result = loadPlugins();
      expect(result.loaded).toBe(1);
      expect(result.errors).toEqual([]);
    });

    test('loads plugin that exports { setup }', () => {
      const pluginsDir = path.join(tmpDir, '.nex', 'plugins');
      fs.mkdirSync(pluginsDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginsDir, 'setup-plugin.js'),
        'module.exports = { name: "test", setup: function(ctx) {} };'
      );
      const result = loadPlugins();
      expect(result.loaded).toBe(1);
    });

    test('reports error for plugin with invalid export', () => {
      const pluginsDir = path.join(tmpDir, '.nex', 'plugins');
      fs.mkdirSync(pluginsDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginsDir, 'bad-plugin.js'),
        'module.exports = { notSetup: true };'
      );
      const result = loadPlugins();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('must export a function');
    });

    test('reports error for plugin that throws', () => {
      const pluginsDir = path.join(tmpDir, '.nex', 'plugins');
      fs.mkdirSync(pluginsDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginsDir, 'throw-plugin.js'),
        'throw new Error("plugin init failed");'
      );
      const result = loadPlugins();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('plugin init failed');
    });

    test('only loads .js files', () => {
      const pluginsDir = path.join(tmpDir, '.nex', 'plugins');
      fs.mkdirSync(pluginsDir, { recursive: true });
      fs.writeFileSync(path.join(pluginsDir, 'readme.txt'), 'not a plugin');
      fs.writeFileSync(
        path.join(pluginsDir, 'real.js'),
        'module.exports = function() {};'
      );
      const result = loadPlugins();
      expect(result.loaded).toBe(1);
    });
  });

  // ─── getLoadedPlugins / getHookCounts / clearPlugins ───────
  describe('getLoadedPlugins / getHookCounts', () => {
    const { getLoadedPlugins, getHookCounts } = require('../cli/plugins');

    test('getLoadedPlugins returns empty after clear', () => {
      clearPlugins();
      expect(getLoadedPlugins()).toEqual([]);
    });

    test('getHookCounts returns zero counts after clear', () => {
      clearPlugins();
      const counts = getHookCounts();
      for (const event of EVENTS) {
        expect(counts[event]).toBe(0);
      }
    });

    test('getHookCounts reflects registered hooks', () => {
      clearPlugins();
      registerHook('onToolResult', async () => {});
      registerHook('onToolResult', async () => {});
      registerHook('onSessionStart', async () => {});
      const counts = getHookCounts();
      expect(counts.onToolResult).toBe(2);
      expect(counts.onSessionStart).toBe(1);
    });
  });

  // ─── executePluginTool - with hooks ────────────────────────
  describe('executePluginTool - hooks integration', () => {
    test('beforeToolExec hook can modify args', async () => {
      registerTool(
        { function: { name: 'echo_tool', description: 'echo', parameters: { type: 'object', properties: {}, required: [] } } },
        async (args) => `got: ${args.msg}`
      );
      registerHook('beforeToolExec', async (data) => ({ ...data, args: { msg: 'modified' } }));
      const result = await executePluginTool('echo_tool', { msg: 'original' });
      expect(result).toBe('got: modified');
    });

    test('afterToolExec hook can modify result', async () => {
      registerTool(
        { function: { name: 'mod_tool', description: 'mod', parameters: { type: 'object', properties: {}, required: [] } } },
        async () => 'original'
      );
      registerHook('afterToolExec', async (data) => ({ ...data, result: 'modified' }));
      const result = await executePluginTool('mod_tool', {});
      expect(result).toBe('modified');
    });
  });
});

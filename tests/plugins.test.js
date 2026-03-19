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
  });
});

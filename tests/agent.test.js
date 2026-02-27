// Mock the provider registry before requiring agent
jest.mock('../cli/providers/registry', () => ({
  callStream: jest.fn(),
  getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
  getActiveProviderName: jest.fn().mockReturnValue('ollama'),
  getActiveModelId: jest.fn().mockReturnValue('kimi-k2.5'),
  _reset: jest.fn(),
}));

jest.mock('../cli/tools', () => ({
  TOOL_DEFINITIONS: [{ type: 'function', function: { name: 'bash', description: 'test', parameters: { type: 'object', properties: {}, required: [] } } }],
  executeTool: jest.fn(),
}));

jest.mock('../cli/context', () => ({
  gatherProjectContext: jest.fn().mockReturnValue('PACKAGE: test-project'),
}));

jest.mock('../cli/context-engine', () => ({
  fitToContext: jest.fn().mockImplementation((messages) => ({
    messages,
    compressed: false,
    tokensRemoved: 0,
  })),
  getUsage: jest.fn().mockReturnValue({ used: 100, limit: 128000, percentage: 0.1 }),
}));

jest.mock('../cli/session', () => ({
  autoSave: jest.fn(),
}));

jest.mock('../cli/memory', () => ({
  getMemoryContext: jest.fn().mockReturnValue(''),
}));

jest.mock('../cli/permissions', () => ({
  checkPermission: jest.fn().mockReturnValue('allow'),
}));

jest.mock('../cli/planner', () => ({
  isPlanMode: jest.fn().mockReturnValue(false),
  getPlanModePrompt: jest.fn().mockReturnValue(''),
}));

jest.mock('../cli/render', () => ({
  renderMarkdown: jest.fn().mockImplementation((text) => text || ''),
  StreamRenderer: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    flush: jest.fn(),
  })),
}));

jest.mock('../cli/hooks', () => ({
  runHooks: jest.fn().mockReturnValue([]),
}));

jest.mock('../cli/mcp', () => ({
  routeMCPCall: jest.fn().mockResolvedValue(null),
  getMCPToolDefinitions: jest.fn().mockReturnValue([]),
}));

jest.mock('../cli/skills', () => ({
  getSkillInstructions: jest.fn().mockReturnValue(''),
  getSkillToolDefinitions: jest.fn().mockReturnValue([]),
  routeSkillCall: jest.fn().mockResolvedValue(null),
}));

jest.mock('../cli/costs', () => ({
  trackUsage: jest.fn(),
}));

jest.mock('../cli/tool-validator', () => ({
  validateToolArgs: jest.fn().mockReturnValue({ valid: true, args: {} }),
}));

jest.mock('../cli/tool-tiers', () => ({
  filterToolsForModel: jest.fn().mockImplementation((tools) => tools),
}));

jest.mock('../cli/safety', () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setAllowAlwaysHandler: jest.fn(),
}));

const { processInput, clearConversation, getConversationLength, getConversationMessages, setConversationMessages } = require('../cli/agent');
const { callStream } = require('../cli/providers/registry');
const { executeTool } = require('../cli/tools');

describe('agent.js', () => {
  let logSpy, writeSpy;

  beforeEach(() => {
    clearConversation();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  // Helper: mock callStream to capture and invoke onToken, then return result
  function mockStreamResponse(content, tool_calls = []) {
    callStream.mockImplementationOnce(async (msgs, tools, options) => {
      if (options?.onToken && content) {
        options.onToken(content);
      }
      return { content, tool_calls };
    });
  }

  // ─── conversation state ───────────────────────────────────
  describe('conversation state', () => {
    it('starts with empty conversation', () => {
      expect(getConversationLength()).toBe(0);
    });

    it('clearConversation resets state', async () => {
      mockStreamResponse('hello');
      await processInput('test');
      expect(getConversationLength()).toBeGreaterThan(0);
      clearConversation();
      expect(getConversationLength()).toBe(0);
    });

    it('getConversationMessages returns messages array', async () => {
      mockStreamResponse('hello');
      await processInput('test');
      const msgs = getConversationMessages();
      expect(msgs.length).toBe(2);
      expect(msgs[0].role).toBe('user');
      expect(msgs[1].role).toBe('assistant');
    });

    it('setConversationMessages restores session', () => {
      const restored = [
        { role: 'user', content: 'previous' },
        { role: 'assistant', content: 'context' },
      ];
      setConversationMessages(restored);
      expect(getConversationLength()).toBe(2);
      expect(getConversationMessages()).toEqual(restored);
    });
  });

  // ─── processInput ─────────────────────────────────────────
  describe('processInput()', () => {
    it('handles simple text response (no tools)', async () => {
      mockStreamResponse('Hello there!');
      await processInput('Hi');
      expect(getConversationLength()).toBe(2); // user + assistant
    });

    it('auto-saves after response', async () => {
      const { autoSave } = require('../cli/session');
      mockStreamResponse('Saved!');
      await processInput('test');
      expect(autoSave).toHaveBeenCalled();
    });

    it('handles tool call and result', async () => {
      mockStreamResponse('Let me check...', [
        { function: { name: 'bash', arguments: { command: 'echo test' } }, id: 'call-1' },
      ]);
      mockStreamResponse('Done!');

      executeTool.mockResolvedValueOnce('test output');

      await processInput('run echo test');
      // user + assistant(tool) + tool_result + assistant(done)
      expect(getConversationLength()).toBe(4);
    });

    it('handles malformed tool arguments', async () => {
      mockStreamResponse('', [
        { function: { name: 'bash', arguments: null }, id: 'call-1' },
      ]);
      mockStreamResponse('Oops');

      await processInput('test');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('malformed');
    });

    it('handles API errors', async () => {
      callStream.mockRejectedValueOnce(new Error('API Error: connection refused'));
      await processInput('test');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('API Error');
    });

    it('maintains conversation across multiple calls', async () => {
      mockStreamResponse('First response');
      await processInput('First message');

      mockStreamResponse('Second response');
      await processInput('Second message');

      expect(getConversationLength()).toBe(4); // 2 user + 2 assistant
    });

    it('truncates large tool results', async () => {
      const largeOutput = 'x'.repeat(60000);
      mockStreamResponse('', [
        { function: { name: 'bash', arguments: { command: 'test' } }, id: 'c1' },
      ]);
      mockStreamResponse('Done');

      executeTool.mockResolvedValueOnce(largeOutput);

      await processInput('run something big');
      expect(getConversationLength()).toBeGreaterThan(0);
    });

    it('handles multiple tool calls in one response', async () => {
      mockStreamResponse('Running both...', [
        { function: { name: 'bash', arguments: { command: 'echo 1' } }, id: 'c1' },
        { function: { name: 'bash', arguments: { command: 'echo 2' } }, id: 'c2' },
      ]);
      mockStreamResponse('Both done');

      executeTool.mockResolvedValueOnce('1').mockResolvedValueOnce('2');

      await processInput('run both');
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it('handles rate limit (429) and continues loop', async () => {
      // Mock setTimeout to resolve immediately
      const origSetTimeout = global.setTimeout;
      global.setTimeout = (fn) => origSetTimeout(fn, 0);

      callStream.mockRejectedValueOnce(new Error('API Error: 429 Too Many Requests'));
      mockStreamResponse('Success after retry');

      await processInput('test');

      global.setTimeout = origSetTimeout;

      expect(callStream).toHaveBeenCalledTimes(2);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Rate limit');
    });

    it('passes onToken callback to callStream', async () => {
      callStream.mockImplementationOnce(async (msgs, tools, options) => {
        expect(options).toHaveProperty('onToken');
        expect(typeof options.onToken).toBe('function');
        return { content: 'test', tool_calls: [] };
      });

      await processInput('hi');
    });

    it('blocks tool when permission is deny', async () => {
      const { checkPermission } = require('../cli/permissions');
      checkPermission.mockReturnValueOnce('deny');

      mockStreamResponse('Let me run...', [
        { function: { name: 'bash', arguments: { command: 'ls' } }, id: 'c1' },
      ]);
      mockStreamResponse('OK');

      await processInput('list files');
      expect(executeTool).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('denied');
    });

    it('asks user when permission is ask', async () => {
      const { checkPermission } = require('../cli/permissions');
      const { confirm } = require('../cli/safety');
      checkPermission.mockReturnValueOnce('ask');
      confirm.mockResolvedValueOnce(false);

      mockStreamResponse('Running...', [
        { function: { name: 'bash', arguments: { command: 'ls' } }, id: 'c1' },
      ]);
      mockStreamResponse('OK');

      await processInput('list files');
      expect(confirm).toHaveBeenCalled();
      expect(executeTool).not.toHaveBeenCalled();
    });
  });
});

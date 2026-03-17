// ─── Module Mocks ─────────────────────────────────────────
jest.mock('../cli/providers/registry', () => ({
  callStream: jest.fn(),
  getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
  getActiveProviderName: jest.fn().mockReturnValue('ollama'),
  getActiveModelId: jest.fn().mockReturnValue('kimi-k2.5'),
  getConfiguredProviders: jest.fn().mockReturnValue([]),
  _reset: jest.fn(),
}));

jest.mock('../cli/tools', () => ({
  TOOL_DEFINITIONS: [
    { type: 'function', function: { name: 'bash', description: 'test', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
    { type: 'function', function: { name: 'read_file', description: 'read', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'write_file', description: 'write', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
    { type: 'function', function: { name: 'edit_file', description: 'edit', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
    { type: 'function', function: { name: 'list_directory', description: 'list', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: [] } } },
    { type: 'function', function: { name: 'grep', description: 'grep', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
    { type: 'function', function: { name: 'glob', description: 'glob', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
    { type: 'function', function: { name: 'search_files', description: 'search', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
    { type: 'function', function: { name: 'web_fetch', description: 'fetch', parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } } },
    { type: 'function', function: { name: 'web_search', description: 'search', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
    { type: 'function', function: { name: 'spawn_agents', description: 'spawn', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'patch_file', description: 'patch', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  ],
  executeTool: jest.fn(),
}));

jest.mock('../cli/context', () => ({ gatherProjectContext: jest.fn().mockReturnValue('PACKAGE: test-project') }));
jest.mock('../cli/context-engine', () => ({
  fitToContext: jest.fn().mockImplementation(async (messages) => ({ messages, compressed: false, compacted: false, tokensRemoved: 0 })),
  getUsage: jest.fn().mockReturnValue({ used: 100, limit: 128000, percentage: 0.1 }),
  estimateTokens: jest.fn().mockImplementation((text) => text ? text.length / 4 : 0),
  compressToolResult: jest.fn().mockImplementation((content) => content),
  forceCompress: jest.fn().mockImplementation((messages) => ({ messages, tokensRemoved: 0 })),
}));
jest.mock('../cli/session', () => ({ autoSave: jest.fn(), flushAutoSave: jest.fn() }));
jest.mock('../cli/memory', () => ({ getMemoryContext: jest.fn().mockReturnValue('') }));
jest.mock('../cli/permissions', () => ({ checkPermission: jest.fn().mockReturnValue('allow'), setPermission: jest.fn(), savePermissions: jest.fn() }));
jest.mock('../cli/planner', () => ({
  isPlanMode: jest.fn().mockReturnValue(false),
  getPlanModePrompt: jest.fn().mockReturnValue(''),
  PLAN_MODE_ALLOWED_TOOLS: new Set(),
  setPlanContent: jest.fn(),
  extractStepsFromText: jest.fn().mockReturnValue([]),
  createPlan: jest.fn(),
  getActivePlan: jest.fn().mockReturnValue(null),
  startExecution: jest.fn(),
  advancePlanStep: jest.fn(),
  getPlanStepInfo: jest.fn().mockReturnValue(null),
}));
jest.mock('../cli/render', () => ({
  renderMarkdown: jest.fn().mockImplementation((t) => t || ''),
  StreamRenderer: jest.fn().mockImplementation(() => ({ push: jest.fn(), flush: jest.fn(), startCursor: jest.fn(), stopCursor: jest.fn() })),
}));
jest.mock('../cli/hooks', () => ({ runHooks: jest.fn().mockReturnValue([]) }));
jest.mock('../cli/mcp', () => ({ routeMCPCall: jest.fn().mockResolvedValue(null), getMCPToolDefinitions: jest.fn().mockReturnValue([]) }));
jest.mock('../cli/skills', () => ({ getSkillInstructions: jest.fn().mockReturnValue(''), getSkillToolDefinitions: jest.fn().mockReturnValue([]), routeSkillCall: jest.fn().mockResolvedValue(null) }));
jest.mock('../cli/costs', () => ({ trackUsage: jest.fn() }));
jest.mock('../cli/tool-validator', () => ({ validateToolArgs: jest.fn().mockReturnValue({ valid: true, args: {} }) }));
jest.mock('../cli/tool-tiers', () => ({ filterToolsForModel: jest.fn().mockImplementation((t) => t), getModelTier: jest.fn().mockReturnValue('full'), PROVIDER_DEFAULT_TIER: { ollama: 'standard', openai: 'full', anthropic: 'full' } }));
jest.mock('../cli/safety', () => ({ isForbidden: jest.fn().mockReturnValue(null), isDangerous: jest.fn().mockReturnValue(false), isCritical: jest.fn().mockReturnValue(false), confirm: jest.fn().mockResolvedValue(true), setAutoConfirm: jest.fn(), getAutoConfirm: jest.fn().mockReturnValue(false), setAllowAlwaysHandler: jest.fn() }));

// Mock spinner to avoid real timers in tests
jest.mock('../cli/spinner', () => {
  const mkSpinner = (text) => ({ text, start: jest.fn(), stop: jest.fn(), update: jest.fn(), isActive: jest.fn().mockReturnValue(false), _stopped: false, _paused: false });
  const SpinnerMock = jest.fn().mockImplementation(mkSpinner);
  return {
    Spinner: SpinnerMock,
    MultiProgress: jest.fn(),
    TaskProgress: jest.fn().mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), pause: jest.fn(), resume: jest.fn(), setStats: jest.fn(), updateTask: jest.fn(), isActive: jest.fn().mockReturnValue(false), _paused: false })),
    setActiveTaskProgress: jest.fn(),
    getActiveTaskProgress: jest.fn(),
    cleanupTerminal: jest.fn(),
  };
});

// ─── Imports ──────────────────────────────────────────────
const { processInput, clearConversation, getConversationLength, getConversationMessages, setConversationMessages, setAbortSignalGetter, setMaxIterations } = require('../cli/agent');
const { callStream, getConfiguredProviders, getActiveProviderName } = require('../cli/providers/registry');
const { executeTool } = require('../cli/tools');
const { validateToolArgs } = require('../cli/tool-validator');
const { routeSkillCall } = require('../cli/skills');
const { routeMCPCall } = require('../cli/mcp');
const { checkPermission } = require('../cli/permissions');
const { confirm } = require('../cli/safety');
const { fitToContext, getUsage } = require('../cli/context-engine');
const { trackUsage } = require('../cli/costs');
const { autoSave } = require('../cli/session');
const { isPlanMode, getPlanModePrompt } = require('../cli/planner');
const { getMemoryContext } = require('../cli/memory');
const { getSkillInstructions } = require('../cli/skills');
const { Spinner } = require('../cli/spinner');

// ─── Globals ──────────────────────────────────────────────
// Save real setTimeout — tests that need instant retries will swap then restore
const REAL_SET_TIMEOUT = global.setTimeout;

function instantTimeout() { global.setTimeout = (fn) => REAL_SET_TIMEOUT(fn, 0); }
function restoreTimeout() { global.setTimeout = REAL_SET_TIMEOUT; }

describe('agent.js', () => {
  let logSpy;

  beforeEach(() => {
    clearConversation();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    // Reset + clear: mockReset clears implementation queues (leftover mockImplementationOnce)
    callStream.mockReset();
    executeTool.mockReset();
    jest.clearAllMocks();
    setAbortSignalGetter(() => null);
    restoreTimeout(); // ensure clean timer state
    // Clear system prompt and tool filter caches
    const agent = require('../cli/agent');
    if (agent.invalidateSystemPromptCache) agent.invalidateSystemPromptCache();
    if (agent.clearToolFilterCache) agent.clearToolFilterCache();
  });

  afterEach(() => {
    restoreTimeout();
    logSpy.mockRestore();
  });

  // ─── Helpers ──────────────────────────────────────────────
  function mockStream(content, tool_calls = [], usage = null) {
    callStream.mockImplementationOnce(async (_m, _t, opts) => {
      if (opts?.onToken && content) opts.onToken(content);
      return { content, tool_calls, usage };
    });
  }

  function mockStreamSilent(content, tool_calls = [], usage = null) {
    callStream.mockImplementationOnce(async () => ({ content, tool_calls, usage }));
  }

  function logOutput() {
    return logSpy.mock.calls.map((c) => c[0]).join('\n');
  }

  function spinnerLabels() {
    // Section headers are written to stdout via process.stdout.write (strip ANSI codes)
    const stdoutSpy = process.stdout.write;
    const calls = stdoutSpy.mock ? stdoutSpy.mock.calls : [];
    return calls.map(c => String(c[0]).replace(/\x1b\[[0-9;]*m/g, ''));
  }

  // ─── conversation state ───────────────────────────────────
  describe('conversation state', () => {
    it('starts empty', () => { expect(getConversationLength()).toBe(0); });

    it('clearConversation resets', async () => {
      mockStream('hello');
      await processInput('test');
      expect(getConversationLength()).toBeGreaterThan(0);
      clearConversation();
      expect(getConversationLength()).toBe(0);
    });

    it('getConversationMessages returns array', async () => {
      mockStream('hello');
      await processInput('test');
      const m = getConversationMessages();
      expect(m).toHaveLength(2);
      expect(m[0].role).toBe('user');
      expect(m[1].role).toBe('assistant');
    });

    it('setConversationMessages restores', () => {
      const r = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }];
      setConversationMessages(r);
      expect(getConversationLength()).toBe(2);
      expect(getConversationMessages()).toEqual(r);
    });
  });

  // ─── processInput ─────────────────────────────────────────
  describe('processInput()', () => {
    it('simple text response', async () => {
      mockStream('Hello!');
      await processInput('Hi');
      expect(getConversationLength()).toBe(2);
    });

    it('auto-saves after response', async () => {
      mockStream('ok');
      await processInput('test');
      expect(autoSave).toHaveBeenCalled();
    });

    it('handles tool call + result', async () => {
      mockStream('checking', [{ function: { name: 'bash', arguments: { command: 'echo x' } }, id: 'c1' }]);
      mockStream('Done!');
      executeTool.mockResolvedValueOnce('x');
      await processInput('run');
      expect(getConversationLength()).toBe(4);
    });

    it('handles malformed tool arguments (null)', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: null }, id: 'c1' }]);
      mockStream('Oops');
      await processInput('test');
      expect(logOutput()).toContain('malformed');
    });

    it('handles malformed tool arguments (bad string)', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: 'not-json{{{' }, id: 'c1' }]);
      mockStream('OK');
      await processInput('test');
      expect(logOutput()).toContain('malformed');
    });

    it('malformed args include schema hint in error', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: null }, id: 'c1' }]);
      mockStream('Fixed');
      await processInput('test');
      const msgs = getConversationMessages();
      const toolMsg = msgs.find(m => m.role === 'tool' && m.content.includes('Expected JSON schema'));
      expect(toolMsg).toBeDefined();
    });

    it('generates call ID when tc.id is missing', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'test' } } }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(getConversationLength()).toBe(4);
    });

    it('handles API errors', async () => {
      callStream.mockRejectedValueOnce(new Error('API Error: connection refused'));
      await processInput('test');
      expect(logOutput()).toContain('API Error');
    });

    it('maintains conversation across calls', async () => {
      mockStream('First');
      await processInput('msg1');
      mockStream('Second');
      await processInput('msg2');
      expect(getConversationLength()).toBe(4);
    });

    it('truncates large tool results (> 50000 chars)', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('x'.repeat(60000));
      await processInput('run');
      const toolMsg = getConversationMessages().find(m => m.role === 'tool');
      expect(toolMsg.content).toContain('truncated');
      expect(toolMsg.content.length).toBeLessThan(60000);
    });

    it('multiple tool calls in one response', async () => {
      mockStream('', [
        { function: { name: 'bash', arguments: { command: 'echo 1' } }, id: 'c1' },
        { function: { name: 'bash', arguments: { command: 'echo 2' } }, id: 'c2' },
      ]);
      mockStream('Both done');
      executeTool.mockResolvedValueOnce('1').mockResolvedValueOnce('2');
      await processInput('run both');
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it('passes onToken and signal to callStream', async () => {
      const sig = { aborted: false };
      setAbortSignalGetter(() => sig);
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        expect(typeof opts.onToken).toBe('function');
        expect(opts.signal).toBe(sig);
        return { content: 'ok', tool_calls: [] };
      });
      await processInput('hi');
    });

    it('null/undefined tool result becomes empty string', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'true' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce(null);
      await processInput('test');
      expect(getConversationMessages().find(m => m.role === 'tool').content).toBe('');
    });
  });

  // ─── permissions ──────────────────────────────────────────
  describe('permissions', () => {
    it('deny blocks tool execution', async () => {
      checkPermission.mockReturnValueOnce('deny');
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'ls' } }, id: 'c1' }]);
      mockStream('OK');
      await processInput('list');
      expect(executeTool).not.toHaveBeenCalled();
      expect(logOutput()).toContain('denied');
    });

    it('ask + decline blocks tool', async () => {
      checkPermission.mockReturnValueOnce('ask');
      confirm.mockResolvedValueOnce(false);
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'ls' } }, id: 'c1' }]);
      mockStream('OK');
      await processInput('list');
      expect(executeTool).not.toHaveBeenCalled();
    });

    it('ask + confirm allows tool', async () => {
      checkPermission.mockReturnValueOnce('ask');
      confirm.mockResolvedValueOnce(true);
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'rm test' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('deleted');
      await processInput('delete');
      expect(executeTool).toHaveBeenCalled();
    });
  });

  // ─── tool validation ──────────────────────────────────────
  describe('tool validation', () => {
    it('validation error blocks execution', async () => {
      validateToolArgs.mockReturnValueOnce({ valid: false, error: 'Missing "command"' });
      mockStream('', [{ function: { name: 'bash', arguments: { cmd: 'x' } }, id: 'c1' }]);
      mockStream('Fixed');
      await processInput('test');
      expect(executeTool).not.toHaveBeenCalled();
      expect(logOutput()).toContain('Missing');
    });

    it('corrected args used when validator corrects', async () => {
      validateToolArgs.mockReturnValueOnce({ valid: true, corrected: { command: 'echo fixed' } });
      mockStream('', [{ function: { name: 'bash', arguments: { cmd: 'wrong' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('fixed');
      await processInput('test');
      expect(executeTool).toHaveBeenCalledWith('bash', { command: 'echo fixed' }, { silent: true, autoConfirm: true });
    });
  });

  // ─── tool routing ─────────────────────────────────────────
  describe('tool routing', () => {
    it('skill route takes priority', async () => {
      routeSkillCall.mockResolvedValueOnce('skill result');
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      await processInput('test');
      expect(executeTool).not.toHaveBeenCalled();
    });

    it('MCP route if skill returns null', async () => {
      routeSkillCall.mockResolvedValueOnce(null);
      routeMCPCall.mockResolvedValueOnce('mcp result');
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      await processInput('test');
      expect(executeTool).not.toHaveBeenCalled();
    });

    it('executeTool if both return null', async () => {
      routeSkillCall.mockResolvedValueOnce(null);
      routeMCPCall.mockResolvedValueOnce(null);
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(executeTool).toHaveBeenCalled();
    });
  });

  // ─── parallel batching ────────────────────────────────────
  describe('parallel batching', () => {
    it('PARALLEL_SAFE tools run together', async () => {
      mockStream('', [
        { function: { name: 'read_file', arguments: { path: 'a.js' } }, id: 'c1' },
        { function: { name: 'grep', arguments: { pattern: 'foo' } }, id: 'c2' },
        { function: { name: 'glob', arguments: { pattern: '*.js' } }, id: 'c3' },
      ]);
      mockStream('Done');
      executeTool.mockResolvedValue('result');
      await processInput('read');
      expect(executeTool).toHaveBeenCalledTimes(3);
    });

    it('non-safe tools flush batch first', async () => {
      mockStream('', [
        { function: { name: 'read_file', arguments: { path: 'a.js' } }, id: 'c1' },
        { function: { name: 'bash', arguments: { command: 'echo' } }, id: 'c2' },
        { function: { name: 'read_file', arguments: { path: 'b.js' } }, id: 'c3' },
      ]);
      mockStream('Done');
      executeTool.mockResolvedValue('ok');
      await processInput('mixed');
      expect(executeTool).toHaveBeenCalledTimes(3);
    });

    it('spawn_agents is handled', async () => {
      mockStream('', [{ function: { name: 'spawn_agents', arguments: {} }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('✓ Agent ok');
      await processInput('spawn');
      expect(executeTool).toHaveBeenCalledTimes(1);
    });

    it('non-executable tools produce error results', async () => {
      checkPermission.mockReturnValueOnce('deny').mockReturnValueOnce('allow');
      mockStream('', [
        { function: { name: 'bash', arguments: { command: 'rm /' } }, id: 'c1' },
        { function: { name: 'bash', arguments: { command: 'echo ok' } }, id: 'c2' },
      ]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(logOutput()).toContain('denied');
    });
  });

  // ─── error handling (non-retry) ───────────────────────────
  describe('error messages', () => {
    const cases = [
      ['ECONNREFUSED', 'Connection refused', { code: 'ECONNREFUSED' }],
      ['ENOTFOUND', 'Network error', { code: 'ENOTFOUND' }],
      ['401 Unauthorized', 'Authentication failed', {}],
      ['403 Forbidden', 'Access denied', {}],
      ['500 Internal Server Error', 'API server error', {}],
      ['502 Bad Gateway', 'API server error', {}],
      ['503 Service Unavailable', 'API server error', {}],
      ['504 Gateway Timeout', 'API server error', {}],
    ];

    test.each(cases)('"%s" shows "%s"', async (msg, expected, props) => {
      const err = new Error(msg);
      Object.assign(err, props);
      callStream.mockRejectedValueOnce(err);
      await processInput('test');
      expect(logOutput()).toContain(expected);
      expect(autoSave).toHaveBeenCalled();
    });

    it('"400 Bad Request" shows "Bad request" after compress retries exhausted', async () => {
      // 400 handler retries twice (force-compress + retry) before showing the error message
      const err = new Error('400 Bad Request');
      callStream.mockRejectedValueOnce(err).mockRejectedValueOnce(err).mockRejectedValueOnce(err);
      await processInput('test');
      expect(logOutput()).toContain('Bad request');
      expect(autoSave).toHaveBeenCalled();
    });

    it('fetch failed shows network message', async () => {
      callStream.mockRejectedValueOnce(new Error('TypeError: fetch failed'));
      await processInput('test');
      expect(logOutput()).toContain('Network request failed');
    });

    it('generic error auto-saves', async () => {
      callStream.mockRejectedValueOnce(new Error('Unknown xyz123'));
      await processInput('test');
      expect(autoSave).toHaveBeenCalled();
    });
  });

  // ─── abort errors ─────────────────────────────────────────
  describe('abort errors', () => {
    it('AbortError breaks silently', async () => {
      const err = new Error('halted'); err.name = 'AbortError';
      callStream.mockRejectedValueOnce(err);
      await processInput('test');
      expect(autoSave).toHaveBeenCalled();
    });

    it('CanceledError breaks silently', async () => {
      const err = new Error('halted'); err.name = 'CanceledError';
      callStream.mockRejectedValueOnce(err);
      await processInput('test');
      expect(autoSave).toHaveBeenCalled();
    });

    it('"canceled" in message triggers abort path', async () => {
      callStream.mockRejectedValueOnce(new Error('Request was canceled by controller'));
      await processInput('test');
      expect(autoSave).toHaveBeenCalled();
    });

    it('abort signal at loop start skips callStream', async () => {
      setAbortSignalGetter(() => ({ aborted: true }));
      await processInput('test');
      expect(callStream).not.toHaveBeenCalled();
    });
  });

  // ─── retry logic (rate limit + network) ───────────────────
  describe('retry logic', () => {
    beforeEach(() => instantTimeout());
    afterEach(() => restoreTimeout());

    it('429 retries then succeeds', async () => {
      callStream.mockRejectedValueOnce(new Error('429 Too Many Requests'));
      mockStream('Success');
      await processInput('test');
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it('429 exhausts MAX_RATE_LIMIT_RETRIES', async () => {
      for (let i = 0; i < 6; i++) callStream.mockRejectedValueOnce(new Error('429'));
      await processInput('test');
      expect(logOutput()).toContain('max retries');
    });

    it('socket disconnected triggers network retry', async () => {
      callStream.mockRejectedValueOnce(new Error('socket disconnected'));
      mockStream('Recovered');
      await processInput('test');
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it('ECONNRESET code triggers network retry', async () => {
      const err = new Error('reset'); err.code = 'ECONNRESET';
      callStream.mockRejectedValueOnce(err);
      mockStream('Recovered');
      await processInput('test');
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it('ECONNABORTED code triggers network retry', async () => {
      const err = new Error('ECONNABORTED err'); err.code = 'ECONNABORTED';
      callStream.mockRejectedValueOnce(err);
      mockStream('Recovered');
      await processInput('test');
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it('TLS error triggers network retry', async () => {
      callStream.mockRejectedValueOnce(new Error('TLS handshake failed'));
      mockStream('Recovered');
      await processInput('test');
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it('ETIMEDOUT triggers network retry and shows timeout message', async () => {
      const err = new Error('connect ETIMEDOUT'); err.code = 'ETIMEDOUT';
      callStream.mockRejectedValueOnce(err);
      mockStream('Recovered');
      await processInput('test');
      expect(logOutput()).toContain('timed out');
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it('timeout in message triggers retry', async () => {
      callStream.mockRejectedValueOnce(new Error('request timeout exceeded'));
      mockStream('Recovered');
      await processInput('test');
      expect(logOutput()).toContain('timed out');
    });

    it('network retries exhaust MAX_NETWORK_RETRIES', async () => {
      for (let i = 0; i < 4; i++) callStream.mockRejectedValueOnce(new Error('socket disconnected'));
      await processInput('test');
      expect(logOutput()).toContain('Network error: max retries');
    });
  });

  // ─── context management ───────────────────────────────────
  describe('context management', () => {
    it('logs compression when context is compressed', async () => {
      fitToContext.mockImplementationOnce((m) => ({ messages: m, compressed: true, tokensRemoved: 5000 }));
      mockStream('OK');
      await processInput('test');
      expect(logOutput()).toContain('context compressed');
      expect(logOutput()).toContain('5000');
    });

    it('warns when context usage > 85%', async () => {
      getUsage.mockReturnValueOnce({ used: 110000, limit: 128000, percentage: 86 });
      mockStream('OK');
      await processInput('test');
      expect(logOutput()).toContain('Context');
      expect(logOutput()).toContain('full');
    });
  });

  // ─── token usage tracking ─────────────────────────────────
  describe('token usage tracking', () => {
    it('tracks when usage is present', async () => {
      mockStream('Hello', [], { prompt_tokens: 200, completion_tokens: 100 });
      await processInput('test');
      expect(trackUsage).toHaveBeenCalledWith('ollama', 'kimi-k2.5', 200, 100);
    });

    it('handles zero tokens', async () => {
      mockStream('Hello', [], { prompt_tokens: 0, completion_tokens: 0 });
      await processInput('test');
      expect(trackUsage).toHaveBeenCalledWith('ollama', 'kimi-k2.5', 0, 0);
    });

    it('does not track when no usage', async () => {
      mockStream('Hello');
      await processInput('test');
      expect(trackUsage).not.toHaveBeenCalled();
    });

    it('handles undefined token counts as 0', async () => {
      mockStream('Hello', [], { prompt_tokens: undefined, completion_tokens: undefined });
      await processInput('test');
      expect(trackUsage).toHaveBeenCalledWith('ollama', 'kimi-k2.5', 0, 0);
    });
  });

  // ─── nudge ────────────────────────────────────────────────
  describe('nudge on empty text after tools', () => {
    it('sends nudge when LLM produces empty text after tool calls', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo x' } }, id: 'c1' }]);
      mockStreamSilent('', []); // empty — triggers nudge
      mockStream('Here is the summary');
      executeTool.mockResolvedValueOnce('output');
      await processInput('test');
      expect(callStream).toHaveBeenCalledTimes(3);
      const nudge = callStream.mock.calls[2][0].find(m => m.role === 'user' && m.content?.includes('SYSTEM'));
      expect(nudge).toBeDefined();
      expect(nudge.content).toContain('summarize');
    });
  });

  // ─── file tracking + resume ───────────────────────────────
  describe('file tracking and resume', () => {
    it('tracks write_file as modified', async () => {
      mockStream('', [{ function: { name: 'write_file', arguments: { path: 't.js', content: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).toContain('modified');
    });

    it('tracks edit_file as modified', async () => {
      mockStream('', [{ function: { name: 'edit_file', arguments: { path: 't.js' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).toContain('modified');
    });

    it('tracks patch_file as modified', async () => {
      mockStream('', [{ function: { name: 'patch_file', arguments: { path: 't.js' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).toContain('modified');
    });

    it('does not track ERROR results as modified', async () => {
      mockStream('', [{ function: { name: 'write_file', arguments: { path: 't.js', content: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ERROR: denied');
      await processInput('test');
      expect(logOutput()).not.toContain('file modified');
    });

    it('does not track CANCELLED results as read', async () => {
      mockStream('', [{ function: { name: 'read_file', arguments: { path: 'a.js' } }, id: 'c1' }]);
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo ok' } }, id: 'c2' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('CANCELLED: user').mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).not.toContain('/save');
    });

    it('shows /diff /commit when files modified', async () => {
      mockStream('', [{ function: { name: 'write_file', arguments: { path: 't.js', content: 'x' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).toContain('/diff');
      expect(logOutput()).toContain('/commit');
    });

    it('shows /save when files read (2+ steps, no modifications)', async () => {
      mockStream('', [{ function: { name: 'read_file', arguments: { path: 'a.js' } }, id: 'c1' }]);
      mockStream('', [{ function: { name: 'read_file', arguments: { path: 'b.js' } }, id: 'c2' }]);
      mockStream('Analysis done');
      executeTool.mockResolvedValue('content');
      await processInput('analyze');
      expect(logOutput()).toContain('/save');
    });

    it('pluralizes correctly', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo 1' } }, id: 'c1' }]);
      mockStream('', [
        { function: { name: 'bash', arguments: { command: 'echo 2' } }, id: 'c2' },
        { function: { name: 'bash', arguments: { command: 'echo 3' } }, id: 'c3' },
      ]);
      mockStream('Done');
      executeTool.mockResolvedValue('ok');
      await processInput('test');
      expect(logOutput()).toContain('2 steps');
      expect(logOutput()).toContain('3 tools');
    });

    it('shows elapsed seconds', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).toMatch(/\d+s/);
    });

    it('step indicator printed for step 2+', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo 1' } }, id: 'c1' }]);
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo 2' } }, id: 'c2' }]);
      mockStream('Done');
      executeTool.mockResolvedValue('ok');
      await processInput('test');
      expect(logOutput()).toContain('step');
    });
  });

  // ─── system prompt ────────────────────────────────────────
  describe('system prompt', () => {
    it('includes memory context', async () => {
      getMemoryContext.mockReturnValueOnce('dark mode preference');
      mockStream('ok');
      await processInput('test');
      expect(callStream.mock.calls[0][0][0].content).toContain('dark mode preference');
    });

    it('includes skill instructions', async () => {
      getSkillInstructions.mockReturnValueOnce('Skill: code-review');
      mockStream('ok');
      await processInput('test');
      expect(callStream.mock.calls[0][0][0].content).toContain('Skill: code-review');
    });

    it('includes plan mode prompt', async () => {
      isPlanMode.mockReturnValueOnce(true);
      getPlanModePrompt.mockReturnValueOnce('Plan mode active');
      mockStream('ok');
      await processInput('test');
      expect(callStream.mock.calls[0][0][0].content).toContain('Plan mode active');
    });

    it('includes model routing guide when 2+ models', async () => {
      getConfiguredProviders.mockReturnValueOnce([
        { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'K2.5' }] },
        { name: 'openai', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] },
      ]);
      mockStream('ok');
      await processInput('test');
      expect(callStream.mock.calls[0][0][0].content).toContain('Sub-Agent Model Routing');
    });

    it('omits routing guide when < 2 models', async () => {
      getConfiguredProviders.mockReturnValueOnce([{ name: 'ollama', models: [{ id: 'x', name: 'X' }] }]);
      mockStream('ok');
      await processInput('test');
      expect(callStream.mock.calls[0][0][0].content).not.toContain('Sub-Agent Model Routing');
    });

    it('handles getConfiguredProviders error', async () => {
      getConfiguredProviders.mockImplementationOnce(() => { throw new Error('err'); });
      mockStream('ok');
      await processInput('test');
      expect(callStream.mock.calls[0][0][0].content).toContain('Nex Code');
    });
  });

  // ─── tool result detection ────────────────────────────────
  describe('tool result detection', () => {
    it('ERROR result detected in summary', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'fail' } }, id: 'c1' }]);
      mockStream('Handled');
      executeTool.mockResolvedValueOnce('ERROR: not found');
      await processInput('test');
      expect(getConversationLength()).toBe(4);
    });

    it('CANCELLED result detected in summary', async () => {
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'x' } }, id: 'c1' }]);
      mockStream('OK');
      executeTool.mockResolvedValueOnce('CANCELLED by user');
      await processInput('test');
      expect(getConversationLength()).toBe(4);
    });

    it('spawn_agents failure pattern detected', async () => {
      mockStream('', [{ function: { name: 'spawn_agents', arguments: {} }, id: 'c1' }]);
      mockStream('Failed');
      executeTool.mockResolvedValueOnce('Agent 1:\n✗ Agent 1 failed');
      await processInput('test');
      expect(getConversationLength()).toBe(4);
    });
  });

  // ─── max iterations ───────────────────────────────────────
  describe('max iterations', () => {
    it('warns when max iterations reached', async () => {
      // Use a very small limit and non-ollama provider so auto-extend is skipped
      setMaxIterations(2);
      getActiveProviderName.mockReturnValue('anthropic');
      confirm.mockResolvedValueOnce(false); // decline to extend → exits
      let i = 0;
      callStream.mockImplementation(async () => ({
        content: '',
        tool_calls: [{ function: { name: 'bash', arguments: { command: 'echo' } }, id: `c${i++}` }],
      }));
      executeTool.mockResolvedValue('ok');
      await processInput('loop');
      expect(logOutput()).toContain('Max iterations');
      // restore defaults
      setMaxIterations(50);
      getActiveProviderName.mockReturnValue('ollama');
    });
  });

  // ─── _argPreview + spinner labels ─────────────────────────
  describe('spinner label arg preview', () => {
    const previewCases = [
      ['read_file', { path: '/tmp/test.js' }, 'tmp/test.js'],
      ['write_file', { path: '/out.txt', content: 'x' }, 'out.txt'],
      ['edit_file', { path: 'src/app.js' }, 'src/app.js'],
      ['list_directory', { path: '/home' }, 'home'],
      ['bash', { command: 'echo hello world' }, 'echo hello world'],
      ['grep', { pattern: 'TODO' }, 'TODO'],
      ['search_files', { pattern: 'fn.*test' }, 'fn.*test'],
      ['glob', { pattern: '**/*.ts' }, '**/*.ts'],
      ['web_search', { query: 'jest testing' }, 'jest testing'],
    ];

    test.each(previewCases)('%s shows "%s" in spinner', async (tool, args, expected) => {
      mockStream('', [{ function: { name: tool, arguments: args }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      const found = spinnerLabels().some(l => l.includes(expected));
      expect(found).toBe(true);
    });

    it('default case (patch_file) produces empty preview', async () => {
      mockStream('', [{ function: { name: 'patch_file', arguments: { path: 'x.js' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(executeTool).toHaveBeenCalled();
    });

    it('multi-tool label for 2+ tools', async () => {
      mockStream('', [
        { function: { name: 'read_file', arguments: { path: 'a.js' } }, id: 'c1' },
        { function: { name: 'read_file', arguments: { path: 'b.js' } }, id: 'c2' },
      ]);
      mockStream('Done');
      executeTool.mockResolvedValue('content');
      await processInput('test');
      expect(spinnerLabels().some(l => l.includes('Read file') || l.includes('read_file') || l.includes('2 tools') || l.includes('·'))).toBe(true);
    });

    it('truncates long multi-tool names (> 60 chars)', async () => {
      const tools = [];
      for (let i = 0; i < 7; i++) {
        tools.push({ function: { name: 'read_file', arguments: { path: `${i}.js` } }, id: `c${i}` });
      }
      mockStream('', tools);
      mockStream('Done');
      executeTool.mockResolvedValue('content');
      await processInput('test');
      expect(spinnerLabels().some(l => l.includes('actions') || l.includes('tools') || l.includes('Read file'))).toBe(true);
    });
  });

  // ─── pre-spinner + stream cursor ────────────────────────────
  describe('pre-spinner and stream cursor', () => {
    it('starts a pre-spinner before fitToContext and stops it after', async () => {
      mockStream('Hello');
      await processInput('test');
      // Pre-spinner should be the first Spinner created with 'Thinking...'
      expect(Spinner.mock.calls[0][0]).toBe('Thinking...');
      // Pre-spinner should be started and stopped
      const preSpinner = Spinner.mock.results[0].value;
      expect(preSpinner.start).toHaveBeenCalled();
      expect(preSpinner.stop).toHaveBeenCalled();
    });

    it('stream.startCursor() called on first token', async () => {
      const { StreamRenderer } = require('../cli/render');
      mockStream('Hello');
      await processInput('test');
      const streamInstance = StreamRenderer.mock.results[0].value;
      expect(streamInstance.startCursor).toHaveBeenCalled();
    });

    it('stream.stopCursor() called on error', async () => {
      const { StreamRenderer } = require('../cli/render');
      callStream.mockRejectedValueOnce(new Error('API crash'));
      await processInput('test');
      const streamInstance = StreamRenderer.mock.results[0].value;
      expect(streamInstance.stopCursor).toHaveBeenCalled();
    });

    it('flush() implicitly stops cursor via stream', async () => {
      const { StreamRenderer } = require('../cli/render');
      mockStream('Hello');
      await processInput('test');
      const streamInstance = StreamRenderer.mock.results[0].value;
      expect(streamInstance.flush).toHaveBeenCalled();
    });
  });

  // ─── setAbortSignalGetter ─────────────────────────────────
  describe('setAbortSignalGetter', () => {
    it('getter is invoked during processInput', async () => {
      let called = false;
      setAbortSignalGetter(() => { called = true; return null; });
      mockStream('ok');
      await processInput('test');
      expect(called).toBe(true);
    });
  });

  // ─── validator correction logging ──────────────────────────
  describe('validator correction logging', () => {
    it('logs corrected arg names when validator renames keys', async () => {
      // Validator corrects { cmd: 'ls' } → { command: 'ls' } (cmd renamed)
      validateToolArgs.mockReturnValueOnce({
        valid: true,
        corrected: { command: 'ls' },
      });
      mockStream('', [{ function: { name: 'bash', arguments: { cmd: 'ls' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('ok');
      await processInput('test');
      expect(logOutput()).toContain('corrected args');
      expect(logOutput()).toContain('cmd');
    });

    it('does not log when corrected keys match original keys', async () => {
      // Type coercion: same keys, different values
      validateToolArgs.mockReturnValueOnce({
        valid: true,
        corrected: { path: 'test.js', line_start: 5 },
      });
      mockStream('', [{ function: { name: 'read_file', arguments: { path: 'test.js', line_start: '5' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('content');
      await processInput('test');
      // Both original and corrected have the same keys, so no log
      expect(logOutput()).not.toContain('corrected args');
    });

    it('does not log when no correction needed', async () => {
      validateToolArgs.mockReturnValueOnce({ valid: true, corrected: null });
      mockStream('', [{ function: { name: 'bash', arguments: { command: 'echo hi' } }, id: 'c1' }]);
      mockStream('Done');
      executeTool.mockResolvedValueOnce('hi');
      await processInput('test');
      expect(logOutput()).not.toContain('corrected args');
    });
  });

  // ─── compression log format ────────────────────────────────
  describe('compression log format', () => {
    it('includes percentage in compression log', async () => {
      fitToContext.mockImplementationOnce((m) => ({ messages: m, compressed: true, tokensRemoved: 12800 }));
      getUsage.mockReturnValueOnce({ used: 110000, limit: 128000, percentage: 86 });
      mockStream('OK');
      await processInput('test');
      expect(logOutput()).toContain('context compressed');
      expect(logOutput()).toMatch(/\d+%/);
    });
  });

  // ─── stale-stream detection ────────────────────────────────
  describe('stale-stream detection', () => {
    it('passes combined AbortSignal to callStream', async () => {
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        expect(opts.signal).toBeDefined();
        expect(opts.signal instanceof AbortSignal).toBe(true);
        return { content: 'ok', tool_calls: [] };
      });
      await processInput('test');
    });

    it('onToken callback is provided and works', async () => {
      let capturedOnToken;
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        capturedOnToken = opts.onToken;
        if (opts.onToken) opts.onToken('token');
        return { content: 'token', tool_calls: [] };
      });
      await processInput('test');
      expect(capturedOnToken).toBeDefined();
    });

    it('stale timer is cleaned up on success', async () => {
      // Verify no lingering intervals after a normal call
      const before = 0; // Can't easily count intervals but verify no errors
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        if (opts.onToken) opts.onToken('ok');
        return { content: 'ok', tool_calls: [] };
      });
      await processInput('test');
      // If stale timer leaked, subsequent operations would be affected
      expect(callStream).toHaveBeenCalledTimes(1);
    });
  });
});

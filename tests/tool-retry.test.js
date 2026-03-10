/**
 * tests/tool-retry.test.js — Tool Call Retry with Schema Hints
 */

// Mock the provider registry before requiring agent
jest.mock('../cli/providers/registry', () => ({
  callStream: jest.fn(),
  getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
  getActiveProviderName: jest.fn().mockReturnValue('ollama'),
  getActiveModelId: jest.fn().mockReturnValue('kimi-k2.5'),
  _reset: jest.fn(),
}));

jest.mock('../cli/tools', () => ({
  TOOL_DEFINITIONS: [
    {
      type: 'function',
      function: {
        name: 'bash',
        description: 'Execute a bash command',
        parameters: {
          type: 'object',
          properties: { command: { type: 'string', description: 'The bash command to execute' } },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string', description: 'File path' } },
          required: ['path'],
        },
      },
    },
  ],
  executeTool: jest.fn(),
}));

jest.mock('../cli/context', () => ({
  gatherProjectContext: jest.fn().mockReturnValue('PACKAGE: test-project'),
}));

jest.mock('../cli/context-engine', () => ({
  fitToContext: jest.fn().mockImplementation(async (messages) => ({
    messages,
    compressed: false,
    compacted: false,
    tokensRemoved: 0,
  })),
  getUsage: jest.fn().mockReturnValue({ used: 100, limit: 128000, percentage: 0.1 }),
  estimateTokens: jest.fn().mockImplementation((text) => text ? text.length / 4 : 0),
  compressToolResult: jest.fn().mockImplementation((content) => content),
}));

jest.mock('../cli/session', () => ({ autoSave: jest.fn() }));
jest.mock('../cli/memory', () => ({ getMemoryContext: jest.fn().mockReturnValue('') }));
jest.mock('../cli/permissions', () => ({ checkPermission: jest.fn().mockReturnValue('allow') }));
jest.mock('../cli/planner', () => ({ isPlanMode: jest.fn().mockReturnValue(false), getPlanModePrompt: jest.fn().mockReturnValue('') }));
jest.mock('../cli/render', () => ({
  renderMarkdown: jest.fn().mockImplementation((text) => text || ''),
  StreamRenderer: jest.fn().mockImplementation(() => ({ push: jest.fn(), flush: jest.fn(), startCursor: jest.fn(), stopCursor: jest.fn() })),
}));
jest.mock('../cli/hooks', () => ({ runHooks: jest.fn().mockReturnValue([]) }));
jest.mock('../cli/mcp', () => ({ routeMCPCall: jest.fn().mockResolvedValue(null), getMCPToolDefinitions: jest.fn().mockReturnValue([]) }));
jest.mock('../cli/skills', () => ({
  getSkillInstructions: jest.fn().mockReturnValue(''),
  getSkillToolDefinitions: jest.fn().mockReturnValue([]),
  routeSkillCall: jest.fn().mockResolvedValue(null),
}));
jest.mock('../cli/costs', () => ({ trackUsage: jest.fn() }));
jest.mock('../cli/safety', () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  isCritical: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setAllowAlwaysHandler: jest.fn(),
}));
jest.mock('../cli/tool-tiers', () => ({
  filterToolsForModel: jest.fn().mockImplementation((tools) => tools),
}));
jest.mock('../cli/tool-validator', () => ({
  validateToolArgs: jest.fn().mockReturnValue({ valid: true }),
}));

const { processInput, clearConversation, getConversationMessages } = require('../cli/agent');
const { callStream } = require('../cli/providers/registry');
const { executeTool } = require('../cli/tools');

describe('Tool Call Retry with Schema Hints', () => {
  let logSpy;

  beforeEach(() => {
    clearConversation();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.clearAllMocks();
    // Re-apply default mock for validator
    require('../cli/tool-validator').validateToolArgs.mockReturnValue({ valid: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockStreamResponse(content, tool_calls = []) {
    callStream.mockImplementationOnce(async (msgs, tools, options) => {
      if (options?.onToken && content) options.onToken(content);
      return { content, tool_calls };
    });
  }

  it('sends schema hint when tool args are malformed (null)', async () => {
    // First call: model returns malformed args
    mockStreamResponse('', [
      { function: { name: 'bash', arguments: null }, id: 'call-1' },
    ]);
    // Second call: model gives up
    mockStreamResponse('OK, sorry about that.');

    await processInput('run something');

    const msgs = getConversationMessages();
    const toolMsg = msgs.find(m => m.role === 'tool' && m.content.includes('Expected JSON schema'));
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toContain('Expected JSON schema for "bash"');
    expect(toolMsg.content).toContain('Please retry the tool call');
  });

  it('sends schema hint when tool args are unparseable string', async () => {
    mockStreamResponse('', [
      { function: { name: 'read_file', arguments: '{broken json!!' }, id: 'call-2' },
    ]);
    mockStreamResponse('Fixed now');

    await processInput('read test.js');

    const msgs = getConversationMessages();
    const toolMsg = msgs.find(m => m.role === 'tool' && m.content.includes('Malformed tool arguments'));
    expect(toolMsg).toBeDefined();
    expect(toolMsg.content).toContain('Raw input: {broken json!!');
    expect(toolMsg.content).toContain('read_file');
  });

  it('includes tool_call_id in schema hint message', async () => {
    mockStreamResponse('', [
      { function: { name: 'bash', arguments: null }, id: 'retry-id-42' },
    ]);
    mockStreamResponse('Done');

    await processInput('test');

    const msgs = getConversationMessages();
    const toolMsg = msgs.find(m => m.role === 'tool' && m.content.includes('Expected JSON schema'));
    expect(toolMsg.tool_call_id).toBe('retry-id-42');
  });

  it('shows warning in console output for malformed args', async () => {
    mockStreamResponse('', [
      { function: { name: 'bash', arguments: null }, id: 'call-3' },
    ]);
    mockStreamResponse('OK');

    await processInput('test');

    const output = logSpy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('malformed arguments, sending schema hint');
  });

  it('model can retry successfully after schema hint', async () => {
    // First: malformed args
    mockStreamResponse('', [
      { function: { name: 'bash', arguments: null }, id: 'call-4' },
    ]);
    // Second: correct args this time
    mockStreamResponse('Let me try again', [
      { function: { name: 'bash', arguments: { command: 'echo hello' } }, id: 'call-5' },
    ]);
    // Third: final response
    mockStreamResponse('Done!');

    executeTool.mockResolvedValueOnce('hello');

    await processInput('run echo hello');

    expect(executeTool).toHaveBeenCalledWith('bash', { command: 'echo hello' }, { silent: true, autoConfirm: true });
  });
});

describe('parseToolArgs extended strategies', () => {
  const { parseToolArgs } = require('../cli/ollama');

  it('parses valid JSON directly', () => {
    expect(parseToolArgs('{"command":"ls"}')).toEqual({ command: 'ls' });
  });

  it('returns object input as-is', () => {
    const obj = { command: 'test' };
    expect(parseToolArgs(obj)).toBe(obj);
  });

  it('returns null for null/undefined', () => {
    expect(parseToolArgs(null)).toBeNull();
    expect(parseToolArgs(undefined)).toBeNull();
  });

  it('fixes trailing commas', () => {
    expect(parseToolArgs('{"command":"ls",}')).toEqual({ command: 'ls' });
  });

  it('fixes single quotes', () => {
    expect(parseToolArgs("{'command':'ls'}")).toEqual({ command: 'ls' });
  });

  it('extracts JSON from surrounding text', () => {
    expect(parseToolArgs('sure, here: {"command":"ls"} ok')).toEqual({ command: 'ls' });
  });

  it('fixes unquoted keys (Strategy 4)', () => {
    expect(parseToolArgs('{command: "ls"}')).toEqual({ command: 'ls' });
  });

  it('fixes multiple unquoted keys', () => {
    expect(parseToolArgs('{path: "test.js", line_start: 1}')).toEqual({ path: 'test.js', line_start: 1 });
  });

  it('strips markdown code fences (Strategy 5)', () => {
    const input = '```json\n{"command": "echo hello"}\n```';
    expect(parseToolArgs(input)).toEqual({ command: 'echo hello' });
  });

  it('strips code fences without json language tag', () => {
    const input = '```\n{"path": "test.js"}\n```';
    expect(parseToolArgs(input)).toEqual({ path: 'test.js' });
  });

  it('returns null for completely unparseable input', () => {
    expect(parseToolArgs('this is not json at all')).toBeNull();
  });
});

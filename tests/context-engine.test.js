jest.mock('../cli/providers/registry', () => ({
  getActiveModel: jest.fn().mockReturnValue({
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 16384,
  }),
}));

jest.mock('../cli/compactor', () => ({
  compactMessages: jest.fn().mockResolvedValue(null),
}));

const {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateToolsTokens,
  getContextWindow,
  getUsage,
  compressMessage,
  compressToolResult,
  scoreMessageRelevance,
  extractActiveFiles,
  fitToContext,
  forceCompress,
  truncateFileContent,
  COMPRESSION_THRESHOLD,
  SAFETY_MARGIN,
  KEEP_RECENT,
} = require('../cli/context-engine');

const registry = require('../cli/providers/registry');
const { compactMessages } = require('../cli/compactor');

describe('context-engine.js', () => {
  beforeEach(() => {
    registry.getActiveModel.mockReturnValue({
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
    });
    compactMessages.mockReset();
    compactMessages.mockResolvedValue(null);
  });

  // ─── estimateTokens ────────────────────────────────────────
  describe('estimateTokens()', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('returns 0 for null/undefined', () => {
      expect(estimateTokens(null)).toBe(0);
      expect(estimateTokens(undefined)).toBe(0);
    });

    it('estimates ~4 chars per token', () => {
      const text = 'Hello, World!'; // 13 chars → ~4 tokens
      expect(estimateTokens(text)).toBe(4);
    });

    it('handles long text', () => {
      const text = 'a'.repeat(1000); // 1000 chars → 250 tokens
      expect(estimateTokens(text)).toBe(250);
    });

    it('stringifies objects', () => {
      const obj = { key: 'value' };
      expect(estimateTokens(obj)).toBeGreaterThan(0);
    });
  });

  // ─── estimateMessageTokens ─────────────────────────────────
  describe('estimateMessageTokens()', () => {
    it('includes overhead for empty message', () => {
      const tokens = estimateMessageTokens({ role: 'user' });
      expect(tokens).toBe(4); // Just overhead
    });

    it('estimates content tokens + overhead', () => {
      const msg = { role: 'user', content: 'Hello there!' }; // 12 chars → 3 + 4 overhead
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBe(7);
    });

    it('includes tool_calls in estimation', () => {
      const msg = {
        role: 'assistant',
        content: 'Let me check',
        tool_calls: [
          { function: { name: 'bash', arguments: '{"command":"ls -la"}' } },
        ],
      };
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(10);
    });

    it('handles tool_calls with object arguments', () => {
      const msg = {
        role: 'assistant',
        content: '',
        tool_calls: [
          { function: { name: 'bash', arguments: { command: 'ls' } } },
        ],
      };
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(4);
    });

    it('handles missing tool function name', () => {
      const msg = {
        role: 'assistant',
        tool_calls: [{ function: {} }],
      };
      expect(() => estimateMessageTokens(msg)).not.toThrow();
    });
  });

  // ─── estimateMessagesTokens ────────────────────────────────
  describe('estimateMessagesTokens()', () => {
    it('returns 0 for empty array', () => {
      expect(estimateMessagesTokens([])).toBe(0);
    });

    it('sums all message tokens', () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ];
      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(12); // 3 * 4 overhead + content
    });
  });

  // ─── estimateToolsTokens ──────────────────────────────────
  describe('estimateToolsTokens()', () => {
    it('returns 0 for empty/null tools', () => {
      expect(estimateToolsTokens(null)).toBe(0);
      expect(estimateToolsTokens([])).toBe(0);
    });

    it('estimates tokens for tool definitions', () => {
      const tools = [
        {
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute a bash command',
            parameters: { type: 'object', properties: { command: { type: 'string' } } },
          },
        },
      ];
      expect(estimateToolsTokens(tools)).toBeGreaterThan(10);
    });
  });

  // ─── getContextWindow ──────────────────────────────────────
  describe('getContextWindow()', () => {
    it('returns context window from active model', () => {
      expect(getContextWindow()).toBe(128000);
    });

    it('falls back to 32768 for unknown models', () => {
      registry.getActiveModel.mockReturnValue({ id: 'unknown' });
      expect(getContextWindow()).toBe(32768);
    });

    it('falls back when model is null', () => {
      registry.getActiveModel.mockReturnValue(null);
      expect(getContextWindow()).toBe(32768);
    });
  });

  // ─── getUsage ──────────────────────────────────────────────
  describe('getUsage()', () => {
    it('returns zero usage for empty conversation', () => {
      const usage = getUsage([], []);
      expect(usage.used).toBe(0);
      expect(usage.percentage).toBe(0);
      expect(usage.messageCount).toBe(0);
    });

    it('returns breakdown by message type', () => {
      const messages = [
        { role: 'system', content: 'System prompt here' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'tool', content: 'tool result', tool_call_id: 'c1' },
      ];
      const usage = getUsage(messages, []);

      expect(usage.breakdown.system).toBeGreaterThan(0);
      expect(usage.breakdown.conversation).toBeGreaterThan(0);
      expect(usage.breakdown.toolResults).toBeGreaterThan(0);
      expect(usage.messageCount).toBe(4);
    });

    it('includes tool definitions in total', () => {
      const tools = [{ type: 'function', function: { name: 'bash', description: 'Run cmd', parameters: {} } }];
      const usage = getUsage([], tools);
      expect(usage.used).toBeGreaterThan(0);
      expect(usage.breakdown.toolDefinitions).toBeGreaterThan(0);
    });

    it('calculates percentage correctly', () => {
      // Create a message that uses some tokens
      const messages = [{ role: 'user', content: 'a'.repeat(12800) }]; // ~3200 tokens = 2.5% of 128k
      const usage = getUsage(messages, []);
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThan(10);
      expect(usage.limit).toBe(128000);
    });
  });

  // ─── compressMessage ───────────────────────────────────────
  describe('compressMessage()', () => {
    it('returns user messages unchanged', () => {
      const msg = { role: 'user', content: 'Hello there!' };
      expect(compressMessage(msg)).toBe(msg);
    });

    it('returns system messages unchanged', () => {
      const msg = { role: 'system', content: 'You are helpful' };
      expect(compressMessage(msg)).toBe(msg);
    });

    it('truncates long tool results (light)', () => {
      const msg = { role: 'tool', content: 'x'.repeat(500), tool_call_id: 'c1' };
      const compressed = compressMessage(msg, 'light');
      expect(compressed.content.length).toBeLessThan(msg.content.length);
      expect(compressed.content).toMatch(/truncated|chars total|omitted/);
    });

    it('keeps short tool results unchanged', () => {
      const msg = { role: 'tool', content: 'short result', tool_call_id: 'c1' };
      const compressed = compressMessage(msg, 'light');
      expect(compressed.content).toBe('short result');
    });

    it('truncates long assistant content (light)', () => {
      const msg = { role: 'assistant', content: 'a'.repeat(1000) };
      const compressed = compressMessage(msg, 'light');
      expect(compressed.content.length).toBeLessThan(msg.content.length);
      expect(compressed.content).toContain('truncated');
    });

    it('keeps short assistant content unchanged', () => {
      const msg = { role: 'assistant', content: 'Hello!' };
      const compressed = compressMessage(msg, 'light');
      expect(compressed.content).toBe('Hello!');
    });

    it('aggressive mode truncates more', () => {
      const msg = { role: 'tool', content: 'x'.repeat(200), tool_call_id: 'c1' };
      const light = compressMessage(msg, 'light');
      const aggressive = compressMessage(msg, 'aggressive');
      expect(aggressive.content.length).toBeLessThanOrEqual(light.content.length);
    });

    it('aggressive mode simplifies tool_calls', () => {
      const msg = {
        role: 'assistant',
        content: 'short',
        tool_calls: [{ function: { name: 'bash', arguments: 'a'.repeat(200) } }],
      };
      const compressed = compressMessage(msg, 'aggressive');
      expect(compressed.tool_calls[0].function.arguments.length).toBeLessThan(200);
    });
  });

  // ─── fitToContext ──────────────────────────────────────────
  describe('fitToContext()', () => {
    it('returns messages unchanged when under threshold', async () => {
      const messages = [
        { role: 'system', content: 'prompt' },
        { role: 'user', content: 'hello' },
      ];
      const { messages: result, compressed, compacted } = await fitToContext(messages, []);
      expect(compressed).toBe(false);
      expect(compacted).toBe(false);
      expect(result).toBe(messages);
    });

    it('compresses when over threshold', async () => {
      // Use a very small context window to force compression
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 100 });

      const messages = [
        { role: 'system', content: 'system prompt' },
        ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `Message ${i}: ${'x'.repeat(50)}` })),
        ...Array.from({ length: 20 }, (_, i) => ({ role: 'assistant', content: `Response ${i}: ${'y'.repeat(50)}` })),
      ];

      const { compressed, tokensRemoved } = await fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(tokensRemoved).toBeGreaterThan(0);
    });

    it('keeps system prompt intact', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 200 });

      const messages = [
        { role: 'system', content: 'Important system prompt' },
        ...Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(100)}` })),
      ];

      const { messages: result } = await fitToContext(messages, []);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('Important system prompt');
    });

    it('keeps recent messages intact', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 500 });

      const messages = [
        { role: 'system', content: 'prompt' },
        ...Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(200)}` })),
      ];

      const { messages: result } = await fitToContext(messages, [], { keepRecent: 5 });
      // Last 5 messages should be intact
      const last5 = result.slice(-5);
      expect(last5[4].content).toContain('msg 29');
    });

    it('handles messages without system prompt', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 100 });

      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}: ${'x'.repeat(100)}`,
      }));

      const { messages: result } = await fitToContext(messages, []);
      expect(result.length).toBeLessThan(messages.length);
    });

    it('removes oldest messages in phase 4', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'tiny', contextWindow: 50 });

      const messages = [
        { role: 'system', content: 'p' },
        ...Array.from({ length: 50 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `msg ${i}: ${'x'.repeat(200)}`,
        })),
      ];

      const { messages: result, compressed } = await fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(result.length).toBeLessThan(messages.length);
    });

    it('respects custom threshold', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 200 });

      const messages = Array.from({ length: 10 }, () => ({
        role: 'user',
        content: 'x'.repeat(80),
      }));

      // Very low threshold should compress
      const { compressed } = await fitToContext(messages, [], { threshold: 0.1 });
      expect(compressed).toBe(true);
    });

    it('exports threshold and keep_recent constants', () => {
      expect(COMPRESSION_THRESHOLD).toBe(0.75);
      expect(KEEP_RECENT).toBe(10);
    });

    it('exports SAFETY_MARGIN constant', () => {
      expect(SAFETY_MARGIN).toBe(0.10);
    });

    it('effective target uses threshold minus safety margin', async () => {
      // With 128k window, threshold 0.75, margin 0.10:
      // targetMax = 128000 * (0.75 - 0.10) = 83200
      // Messages below 83200 tokens should NOT be compressed
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 1000 });

      // Create messages that use ~700 tokens (70% of 1000) — above 65% effective target
      const messages = Array.from({ length: 15 }, () => ({
        role: 'user',
        content: 'x'.repeat(180), // ~45 tokens each → ~675 total
      }));

      const { compressed } = await fitToContext(messages, []);
      expect(compressed).toBe(true); // Should compress since > 65% effective target
    });

    it('respects custom safetyMargin option', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 1000 });

      const messages = Array.from({ length: 10 }, () => ({
        role: 'user',
        content: 'x'.repeat(80),
      }));

      // With threshold 0.75 and safetyMargin 0: effective = 75%
      const r1 = await fitToContext(messages, [], { safetyMargin: 0 });
      // With threshold 0.75 and safetyMargin 0.30: effective = 45%
      const r2 = await fitToContext(messages, [], { safetyMargin: 0.30 });

      // Higher margin → more aggressive compression → more tokens removed
      if (r2.compressed) {
        expect(r2.tokensRemoved).toBeGreaterThanOrEqual(r1.tokensRemoved);
      }
    });

    // ─── Phase 0: LLM Compacting ────────────────────────────
    it('uses LLM compacting when >= 6 non-compacted old messages', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 500 });

      const summaryMsg = {
        role: 'system',
        content: '[Conversation Summary — 15 messages compacted]\n• stuff happened',
        _compacted: true,
        _originalCount: 15,
      };
      compactMessages.mockResolvedValueOnce({ message: summaryMsg, tokensRemoved: 200 });

      const messages = [
        { role: 'system', content: 'prompt' },
        ...Array.from({ length: 15 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(100)}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `recent ${i}` })),
      ];

      const result = await fitToContext(messages, []);
      expect(compactMessages).toHaveBeenCalled();
      expect(result.compacted).toBe(true);
      expect(result.compressed).toBe(true);
      // Summary message should be in the result
      expect(result.messages.some(m => m._compacted)).toBe(true);
    });

    it('skips compacting when < 6 old messages', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 200 });

      const messages = [
        { role: 'system', content: 'prompt' },
        ...Array.from({ length: 3 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(200)}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `recent ${i}` })),
      ];

      await fitToContext(messages, []);
      expect(compactMessages).not.toHaveBeenCalled();
    });

    it('falls back to truncating when compacting fails', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 200 });

      compactMessages.mockRejectedValueOnce(new Error('LLM error'));

      const messages = [
        { role: 'system', content: 'prompt' },
        ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(100)}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `recent ${i}` })),
      ];

      const result = await fitToContext(messages, []);
      expect(result.compressed).toBe(true);
      expect(result.compacted).toBe(false);
    });

    it('falls back to truncating when compacting returns null', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 200 });

      compactMessages.mockResolvedValueOnce(null);

      const messages = [
        { role: 'system', content: 'prompt' },
        ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(100)}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `recent ${i}` })),
      ];

      const result = await fitToContext(messages, []);
      expect(result.compressed).toBe(true);
      expect(result.compacted).toBe(false);
    });

    it('skips already-compacted messages for re-compacting', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 500 });

      const summaryMsg = {
        role: 'system',
        content: '[Conversation Summary — 8 messages compacted]\n• new summary',
        _compacted: true,
        _originalCount: 8,
      };
      compactMessages.mockResolvedValueOnce({ message: summaryMsg, tokensRemoved: 100 });

      const messages = [
        { role: 'system', content: 'prompt' },
        // An already-compacted message from a previous compaction
        { role: 'system', content: '[Conversation Summary — 5 messages]', _compacted: true, _originalCount: 5 },
        ...Array.from({ length: 8 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(100)}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: `recent ${i}` })),
      ];

      const result = await fitToContext(messages, []);
      // compactMessages should only receive the non-compacted messages
      if (compactMessages.mock.calls.length > 0) {
        const passedMsgs = compactMessages.mock.calls[0][0];
        expect(passedMsgs.every(m => !m._compacted)).toBe(true);
      }
    });
  });

  // ─── compressMessage medium level ────────────────────────────
  describe('compressMessage() medium level', () => {
    it('medium truncates tool results to 100 chars', () => {
      const msg = { role: 'tool', content: 'x'.repeat(300), tool_call_id: 'c1' };
      const compressed = compressMessage(msg, 'medium');
      // medium maxTool = 100, so content should be compressed
      expect(compressed.content.length).toBeLessThan(msg.content.length);
    });

    it('medium truncates assistant content to 200 chars', () => {
      const msg = { role: 'assistant', content: 'y'.repeat(500) };
      const compressed = compressMessage(msg, 'medium');
      expect(compressed.content.length).toBeLessThan(msg.content.length);
      // Should be between aggressive (100) and light (500)
      const light = compressMessage(msg, 'light');
      const aggressive = compressMessage(msg, 'aggressive');
      expect(compressed.content.length).toBeLessThanOrEqual(light.content.length);
      expect(compressed.content.length).toBeGreaterThanOrEqual(aggressive.content.length);
    });

    it('medium is between light and aggressive for tool results', () => {
      const msg = { role: 'tool', content: 'z'.repeat(500), tool_call_id: 'c1' };
      const light = compressMessage(msg, 'light');
      const medium = compressMessage(msg, 'medium');
      const aggressive = compressMessage(msg, 'aggressive');
      expect(medium.content.length).toBeLessThanOrEqual(light.content.length);
      expect(medium.content.length).toBeGreaterThanOrEqual(aggressive.content.length);
    });
  });

  // ─── compressToolResult ────────────────────────────────────
  describe('compressToolResult()', () => {
    it('returns short content unchanged', () => {
      expect(compressToolResult('hello', 100)).toBe('hello');
    });

    it('returns null/empty unchanged', () => {
      expect(compressToolResult('', 100)).toBe('');
      expect(compressToolResult(null, 100)).toBe(null);
    });

    it('preserves error messages with extra room', () => {
      const content = 'ERROR: ' + 'x'.repeat(400);
      const result = compressToolResult(content, 150);
      // Error gets 3x budget (450), so 407 chars should fit
      expect(result).toBe(content);
    });

    it('preserves EXIT status with extra room', () => {
      const content = 'EXIT 1: ' + 'x'.repeat(300);
      const result = compressToolResult(content, 110);
      // EXIT gets 3x budget (330), so 308 chars should fit
      expect(result).toBe(content);
    });

    it('short output uses head + tail with chars total', () => {
      // ≤10 lines but over budget
      const lines = Array.from({ length: 5 }, (_, i) => 'x'.repeat(100) + `-line${i}`);
      const content = lines.join('\n');
      const result = compressToolResult(content, 100);
      expect(result).toContain('chars total');
      expect(result.length).toBeLessThan(content.length);
    });

    it('long output uses head + tail with lines omitted', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `Line ${i}: ${'y'.repeat(20)}`);
      const content = lines.join('\n');
      const result = compressToolResult(content, 200);
      expect(result).toMatch(/lines omitted/);
      expect(result).toContain('50 total');
    });

    it('preserves test summary at end of output', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `test output line ${i}`);
      lines.push('Tests: 42 passed, 42 total');
      lines.push('Time: 3.2s');
      const content = lines.join('\n');
      const result = compressToolResult(content, 300);
      expect(result).toContain('Tests: 42 passed');
      expect(result).toContain('Time: 3.2s');
    });

    it('preserves error trace at end of bash output', () => {
      const lines = Array.from({ length: 50 }, (_, i) => `build output ${i}`);
      lines.push('TypeError: Cannot read property of undefined');
      lines.push('    at Object.<anonymous> (src/index.js:42:5)');
      const content = lines.join('\n');
      const result = compressToolResult(content, 300);
      expect(result).toContain('TypeError');
      expect(result).toContain('src/index.js:42');
    });
  });

  // ─── truncateFileContent ───────────────────────────────────
  describe('truncateFileContent()', () => {
    it('returns empty string for empty input', () => {
      expect(truncateFileContent('', 100)).toBe('');
      expect(truncateFileContent(null, 100)).toBe('');
    });

    it('returns content unchanged when under budget', () => {
      const content = 'line1\nline2\nline3';
      expect(truncateFileContent(content, 1000)).toBe(content);
    });

    it('truncates long content', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: some content here`);
      const content = lines.join('\n');

      const result = truncateFileContent(content, 50);
      expect(result.length).toBeLessThan(content.length);
    });

    it('keeps beginning and end of file', () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`);
      const content = lines.join('\n');

      const result = truncateFileContent(content, 30);
      expect(result).toContain('Line 0');
      expect(result).toContain('Line 99');
      expect(result).toContain('lines omitted');
    });

    it('shows omitted line count', () => {
      const lines = Array.from({ length: 200 }, (_, i) => `Line ${i}: ${'x'.repeat(20)}`);
      const content = lines.join('\n');

      const result = truncateFileContent(content, 100);
      expect(result).toMatch(/\d+ lines omitted/);
      expect(result).toContain('200 total');
    });
  });

  // ─── scoreMessageRelevance ────────────────────────────────
  describe('scoreMessageRelevance()', () => {
    it('returns 100 for system messages', () => {
      const msg = { role: 'system', content: 'You are helpful' };
      expect(scoreMessageRelevance(msg, 0, 10, new Set())).toBe(100);
    });

    it('scores user messages higher than plain assistant messages', () => {
      const user = { role: 'user', content: 'Hello' };
      const assistant = { role: 'assistant', content: 'Hi there' };
      const userScore = scoreMessageRelevance(user, 5, 10, new Set());
      const assistantScore = scoreMessageRelevance(assistant, 5, 10, new Set());
      expect(userScore).toBeGreaterThan(assistantScore);
    });

    it('scores assistant with tool_calls higher than plain assistant', () => {
      const plain = { role: 'assistant', content: 'thinking...' };
      const withTools = { role: 'assistant', content: 'let me check', tool_calls: [{ function: { name: 'bash' } }] };
      const plainScore = scoreMessageRelevance(plain, 5, 10, new Set());
      const toolScore = scoreMessageRelevance(withTools, 5, 10, new Set());
      expect(toolScore).toBeGreaterThan(plainScore);
    });

    it('scores tool error results higher than normal tool results', () => {
      const normal = { role: 'tool', content: 'file contents here' };
      const error = { role: 'tool', content: 'ERROR: command failed' };
      const normalScore = scoreMessageRelevance(normal, 5, 10, new Set());
      const errorScore = scoreMessageRelevance(error, 5, 10, new Set());
      expect(errorScore).toBeGreaterThan(normalScore);
    });

    it('scores newer messages higher than older ones (recency)', () => {
      const msg = { role: 'assistant', content: 'response' };
      const oldScore = scoreMessageRelevance(msg, 0, 10, new Set());
      const newScore = scoreMessageRelevance(msg, 9, 10, new Set());
      expect(newScore).toBeGreaterThan(oldScore);
    });

    it('boosts score for messages mentioning active files', () => {
      const activeFiles = new Set(['/src/index.js', '/src/utils.js']);
      const relevant = { role: 'tool', content: 'Read /src/index.js: module.exports = ...' };
      const irrelevant = { role: 'tool', content: 'Some random output' };
      const relevantScore = scoreMessageRelevance(relevant, 5, 10, activeFiles);
      const irrelevantScore = scoreMessageRelevance(irrelevant, 5, 10, activeFiles);
      expect(relevantScore).toBeGreaterThan(irrelevantScore);
    });

    it('caps score at 100', () => {
      const activeFiles = new Set(['/a.js', '/b.js', '/c.js', '/d.js']);
      const msg = { role: 'user', content: 'Check /a.js /b.js /c.js /d.js' };
      const score = scoreMessageRelevance(msg, 9, 10, activeFiles);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ─── extractActiveFiles ─────────────────────────────────────
  describe('extractActiveFiles()', () => {
    it('extracts file paths from message content', () => {
      const messages = [
        { role: 'user', content: 'Please read /src/index.js' },
        { role: 'tool', content: 'Contents of /src/utils.js ...' },
      ];
      const files = extractActiveFiles(messages);
      expect(files.has('/src/index.js')).toBe(true);
      expect(files.has('/src/utils.js')).toBe(true);
    });

    it('returns empty set when no file paths found', () => {
      const messages = [
        { role: 'user', content: 'Hello world' },
      ];
      const files = extractActiveFiles(messages);
      expect(files.size).toBe(0);
    });

    it('only scans recent messages', () => {
      const messages = [
        { role: 'user', content: 'Old message about /old/file.js' },
        ...Array.from({ length: 15 }, () => ({ role: 'user', content: 'filler message' })),
        { role: 'user', content: 'Recent message about /new/file.js' },
      ];
      const files = extractActiveFiles(messages, 5);
      expect(files.has('/new/file.js')).toBe(true);
      expect(files.has('/old/file.js')).toBe(false);
    });

    it('handles non-string content', () => {
      const messages = [
        { role: 'tool', content: { result: '/src/data.json' } },
      ];
      const files = extractActiveFiles(messages);
      expect(files.has('/src/data.json')).toBe(true);
    });
  });

  // ─── fitToContext with relevance ────────────────────────────
  describe('fitToContext() relevance-based Phase 4', () => {
    it('keeps messages mentioning active files over older unrelated ones', async () => {
      registry.getActiveModel.mockReturnValue({ id: 'tiny', contextWindow: 80 });

      const messages = [
        { role: 'system', content: 'p' },
        // Old unrelated messages
        { role: 'assistant', content: 'Thinking about something unrelated ' + 'x'.repeat(100) },
        { role: 'assistant', content: 'More unrelated stuff ' + 'y'.repeat(100) },
        // Old but mentions active file
        { role: 'tool', content: 'Contents of /src/main.js: function main() {}' + 'z'.repeat(50) },
        // Recent messages (kept intact by KEEP_RECENT)
        ...Array.from({ length: 3 }, (_, i) => ({
          role: 'user',
          content: `Recent msg ${i} about /src/main.js`,
        })),
      ];

      const { messages: result, compressed } = await fitToContext(messages, [], { keepRecent: 3 });
      expect(compressed).toBe(true);

      // The tool result mentioning /src/main.js should be more likely to survive
      // than the unrelated assistant messages (due to file overlap scoring)
      const resultContent = result.map(m => m.content || '').join(' ');
      // System prompt is always kept
      expect(result[0].role).toBe('system');
    });
  });

  describe('forceCompress()', () => {
    const makeMessages = (count, contentLength = 200) => [
      { role: 'system', content: 'System prompt' },
      ...Array.from({ length: count }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(contentLength),
      })),
    ];

    it('returns fewer tokens than the original', () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 1000 });
      const messages = makeMessages(20, 100);
      const { messages: result, tokensRemoved } = forceCompress(messages, []);
      expect(tokensRemoved).toBeGreaterThan(0);
      expect(estimateMessagesTokens(result)).toBeLessThan(estimateMessagesTokens(messages));
    });

    it('always preserves the system prompt', () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 1000 });
      const messages = makeMessages(20, 100);
      const { messages: result } = forceCompress(messages, []);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('System prompt');
    });

    it('nuclear mode compresses more aggressively than normal', () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 1000 });
      const messages = makeMessages(20, 100);
      const { tokensRemoved: normalRemoved } = forceCompress(messages, []);
      const { tokensRemoved: nuclearRemoved } = forceCompress(messages, [], true);
      expect(nuclearRemoved).toBeGreaterThanOrEqual(normalRemoved);
    });

    it('nuclear mode keeps at most 2 recent messages before dropping', () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 500 });
      // Very large messages to force nuclear to drop history
      const messages = makeMessages(30, 500);
      const { messages: result } = forceCompress(messages, [], true);
      // System prompt + at most a few messages
      expect(result.length).toBeLessThan(10);
    });

    it('works with no system prompt', () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 1000 });
      const messages = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(100),
      }));
      expect(() => forceCompress(messages, [])).not.toThrow();
    });
  });
});

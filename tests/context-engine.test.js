jest.mock('../cli/providers/registry', () => ({
  getActiveModel: jest.fn().mockReturnValue({
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 16384,
  }),
}));

const {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateToolsTokens,
  getContextWindow,
  getUsage,
  compressMessage,
  fitToContext,
  truncateFileContent,
  COMPRESSION_THRESHOLD,
  KEEP_RECENT,
} = require('../cli/context-engine');

const registry = require('../cli/providers/registry');

describe('context-engine.js', () => {
  beforeEach(() => {
    registry.getActiveModel.mockReturnValue({
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
    });
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
      expect(compressed.content).toContain('truncated');
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
    it('returns messages unchanged when under threshold', () => {
      const messages = [
        { role: 'system', content: 'prompt' },
        { role: 'user', content: 'hello' },
      ];
      const { messages: result, compressed } = fitToContext(messages, []);
      expect(compressed).toBe(false);
      expect(result).toBe(messages);
    });

    it('compresses when over threshold', () => {
      // Use a very small context window to force compression
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 100 });

      const messages = [
        { role: 'system', content: 'system prompt' },
        ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `Message ${i}: ${'x'.repeat(50)}` })),
        ...Array.from({ length: 20 }, (_, i) => ({ role: 'assistant', content: `Response ${i}: ${'y'.repeat(50)}` })),
      ];

      const { compressed, tokensRemoved } = fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(tokensRemoved).toBeGreaterThan(0);
    });

    it('keeps system prompt intact', () => {
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 200 });

      const messages = [
        { role: 'system', content: 'Important system prompt' },
        ...Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(100)}` })),
      ];

      const { messages: result } = fitToContext(messages, []);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('Important system prompt');
    });

    it('keeps recent messages intact', () => {
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 500 });

      const messages = [
        { role: 'system', content: 'prompt' },
        ...Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `msg ${i}: ${'x'.repeat(200)}` })),
      ];

      const { messages: result } = fitToContext(messages, [], { keepRecent: 5 });
      // Last 5 messages should be intact
      const last5 = result.slice(-5);
      expect(last5[4].content).toContain('msg 29');
    });

    it('handles messages without system prompt', () => {
      registry.getActiveModel.mockReturnValue({ id: 'small', contextWindow: 100 });

      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}: ${'x'.repeat(100)}`,
      }));

      const { messages: result } = fitToContext(messages, []);
      expect(result.length).toBeLessThan(messages.length);
    });

    it('removes oldest messages in phase 3', () => {
      registry.getActiveModel.mockReturnValue({ id: 'tiny', contextWindow: 50 });

      const messages = [
        { role: 'system', content: 'p' },
        ...Array.from({ length: 50 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `msg ${i}: ${'x'.repeat(200)}`,
        })),
      ];

      const { messages: result, compressed } = fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(result.length).toBeLessThan(messages.length);
    });

    it('respects custom threshold', () => {
      registry.getActiveModel.mockReturnValue({ id: 'test', contextWindow: 200 });

      const messages = Array.from({ length: 10 }, () => ({
        role: 'user',
        content: 'x'.repeat(80),
      }));

      // Very low threshold should compress
      const { compressed } = fitToContext(messages, [], { threshold: 0.1 });
      expect(compressed).toBe(true);
    });

    it('exports threshold and keep_recent constants', () => {
      expect(COMPRESSION_THRESHOLD).toBe(0.7);
      expect(KEEP_RECENT).toBe(10);
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
});

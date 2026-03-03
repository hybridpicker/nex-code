jest.mock('../cli/providers/registry', () => ({
  callChat: jest.fn(),
  getActiveModel: jest.fn().mockReturnValue({
    id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000,
  }),
}));

const { compactMessages, formatMessagesForSummary,
  COMPACTION_ENABLED, COMPACTION_MIN_MESSAGES, COMPACTION_SUMMARY_BUDGET,
} = require('../cli/compactor');
const { callChat } = require('../cli/providers/registry');

describe('compactor.js', () => {
  beforeEach(() => {
    callChat.mockReset();
  });

  // ─── formatMessagesForSummary ────────────────────────────
  describe('formatMessagesForSummary()', () => {
    it('formats messages with role labels', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];
      const result = formatMessagesForSummary(messages);
      expect(result).toContain('[user] Hello');
      expect(result).toContain('[assistant] Hi there');
    });

    it('labels tool messages as tool_result', () => {
      const messages = [
        { role: 'tool', content: 'file contents here', tool_call_id: 'c1' },
      ];
      const result = formatMessagesForSummary(messages);
      expect(result).toContain('[tool_result]');
    });

    it('truncates long content to 500 chars', () => {
      const messages = [
        { role: 'user', content: 'x'.repeat(1000) },
      ];
      const result = formatMessagesForSummary(messages);
      // [user] prefix + 500 chars
      expect(result.length).toBeLessThan(600);
    });

    it('includes tool_calls names', () => {
      const messages = [
        {
          role: 'assistant', content: 'Let me check',
          tool_calls: [
            { function: { name: 'read_file' } },
            { function: { name: 'bash' } },
          ],
        },
      ];
      const result = formatMessagesForSummary(messages);
      expect(result).toContain('tools: read_file, bash');
    });

    it('handles messages with no content', () => {
      const messages = [{ role: 'assistant' }];
      const result = formatMessagesForSummary(messages);
      expect(result).toContain('[assistant]');
    });

    it('separates messages with double newline', () => {
      const messages = [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ];
      const result = formatMessagesForSummary(messages);
      expect(result).toContain('\n\n');
    });
  });

  // ─── compactMessages ─────────────────────────────────────
  describe('compactMessages()', () => {
    it('returns null when messages < COMPACTION_MIN_MESSAGES', async () => {
      const messages = [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ];
      const result = await compactMessages(messages);
      expect(result).toBeNull();
      expect(callChat).not.toHaveBeenCalled();
    });

    it('returns summary message on success', async () => {
      callChat.mockResolvedValueOnce({
        content: '• File app.js was modified\n• Tests pass',
      });

      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with some content: ${'x'.repeat(100)}`,
      }));

      const result = await compactMessages(messages);
      expect(result).not.toBeNull();
      expect(result.message.role).toBe('system');
      expect(result.message.content).toContain('[Conversation Summary — 10 messages compacted]');
      expect(result.message.content).toContain('File app.js was modified');
      expect(result.message._compacted).toBe(true);
      expect(result.message._originalCount).toBe(10);
      expect(result.tokensRemoved).toBeGreaterThan(0);
    });

    it('calls callChat with correct options', async () => {
      callChat.mockResolvedValueOnce({ content: '• summary' });

      const messages = Array.from({ length: 8 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}: ${'y'.repeat(100)}`,
      }));

      await compactMessages(messages);
      expect(callChat).toHaveBeenCalledTimes(1);
      const [msgs, tools, opts] = callChat.mock.calls[0];
      expect(msgs[0].role).toBe('system');
      expect(msgs[1].role).toBe('user');
      expect(tools).toEqual([]);
      expect(opts.temperature).toBe(0);
      expect(opts.maxTokens).toBe(COMPACTION_SUMMARY_BUDGET);
    });

    it('returns null when callChat throws', async () => {
      callChat.mockRejectedValueOnce(new Error('Network error'));

      const messages = Array.from({ length: 8 }, (_, i) => ({
        role: 'user', content: `msg ${i}: ${'z'.repeat(50)}`,
      }));

      const result = await compactMessages(messages);
      expect(result).toBeNull();
    });

    it('returns null when summary is empty', async () => {
      callChat.mockResolvedValueOnce({ content: '' });

      const messages = Array.from({ length: 8 }, (_, i) => ({
        role: 'user', content: `msg ${i}: content`,
      }));

      const result = await compactMessages(messages);
      expect(result).toBeNull();
    });

    it('returns null when summary is whitespace only', async () => {
      callChat.mockResolvedValueOnce({ content: '   \n  ' });

      const messages = Array.from({ length: 8 }, (_, i) => ({
        role: 'user', content: `msg ${i}: content`,
      }));

      const result = await compactMessages(messages);
      expect(result).toBeNull();
    });

    it('returns null when result.content is undefined', async () => {
      callChat.mockResolvedValueOnce({});

      const messages = Array.from({ length: 8 }, (_, i) => ({
        role: 'user', content: `msg ${i}: content`,
      }));

      const result = await compactMessages(messages);
      expect(result).toBeNull();
    });

    it('returns null when summary is not worth it (>= 80% of original)', async () => {
      // Return a summary almost as long as the original
      const messages = Array.from({ length: 6 }, (_, i) => ({
        role: 'user', content: `m${i}`,
      }));

      callChat.mockResolvedValueOnce({
        content: 'x'.repeat(100), // summary bigger than original
      });

      const result = await compactMessages(messages);
      expect(result).toBeNull();
    });

    it('includes tool_calls in original token estimation', async () => {
      callChat.mockResolvedValueOnce({ content: '• summary' });

      const messages = Array.from({ length: 8 }, (_, i) => ({
        role: 'assistant',
        content: `msg ${i}`,
        tool_calls: [{ function: { name: 'bash', arguments: '{"command":"ls"}' } }],
      }));

      const result = await compactMessages(messages);
      expect(result).not.toBeNull();
      expect(result.tokensRemoved).toBeGreaterThan(0);
    });
  });

  // ─── Constants ────────────────────────────────────────────
  describe('exports', () => {
    it('exports COMPACTION_ENABLED as boolean', () => {
      expect(typeof COMPACTION_ENABLED).toBe('boolean');
    });

    it('exports COMPACTION_MIN_MESSAGES as 6', () => {
      expect(COMPACTION_MIN_MESSAGES).toBe(6);
    });

    it('exports COMPACTION_SUMMARY_BUDGET as 500', () => {
      expect(COMPACTION_SUMMARY_BUDGET).toBe(500);
    });
  });
});

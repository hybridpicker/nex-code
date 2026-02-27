const { EventEmitter } = require('events');

jest.mock('axios', () => ({ post: jest.fn() }));
const axios = require('axios');

const { OpenAIProvider, OPENAI_MODELS } = require('../../cli/providers/openai');

describe('providers/openai.js', () => {
  let provider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    process.env.OPENAI_API_KEY = 'sk-test-123';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  // ─── Configuration ──────────────────────────────────────────
  describe('configuration', () => {
    it('has correct provider name', () => {
      expect(provider.name).toBe('openai');
    });

    it('uses correct base URL', () => {
      expect(provider.baseUrl).toBe('https://api.openai.com/v1');
    });

    it('has default models', () => {
      expect(provider.getModelNames()).toContain('gpt-4o');
      expect(provider.getModelNames()).toContain('gpt-4o-mini');
      expect(provider.getModelNames()).toContain('o1');
      expect(provider.getModelNames()).toContain('o3');
    });

    it('defaults to gpt-4o', () => {
      expect(provider.defaultModel).toBe('gpt-4o');
    });

    it('allows custom config', () => {
      const custom = new OpenAIProvider({
        baseUrl: 'https://custom.openai.com/v1',
        defaultModel: 'o3',
      });
      expect(custom.baseUrl).toBe('https://custom.openai.com/v1');
      expect(custom.defaultModel).toBe('o3');
    });
  });

  // ─── isConfigured / getApiKey ──────────────────────────────
  describe('isConfigured()', () => {
    it('returns true when API key is set', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when API key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(provider.isConfigured()).toBe(false);
    });
  });

  // ─── OPENAI_MODELS export ──────────────────────────────────
  describe('OPENAI_MODELS', () => {
    it('exports gpt-4o model info', () => {
      expect(OPENAI_MODELS['gpt-4o']).toMatchObject({
        id: 'gpt-4o',
        name: 'GPT-4o',
        contextWindow: 128000,
      });
    });

    it('exports o3 model info', () => {
      expect(OPENAI_MODELS['o3']).toMatchObject({ id: 'o3', name: 'o3' });
    });
  });

  // ─── formatMessages() ──────────────────────────────────────
  describe('formatMessages()', () => {
    it('passes simple messages through', () => {
      const msgs = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages).toEqual(msgs);
    });

    it('converts assistant tool_calls arguments to strings', () => {
      const msgs = [
        {
          role: 'assistant',
          content: 'Let me check',
          tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: { command: 'ls' } } }],
        },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].tool_calls[0].function.arguments).toBe('{"command":"ls"}');
      expect(messages[0].tool_calls[0].type).toBe('function');
    });

    it('keeps string arguments as-is', () => {
      const msgs = [
        {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: '{"command":"ls"}' } }],
        },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].tool_calls[0].function.arguments).toBe('{"command":"ls"}');
    });

    it('formats tool messages', () => {
      const msgs = [{ role: 'tool', content: 'result', tool_call_id: 'c1' }];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0]).toEqual({ role: 'tool', content: 'result', tool_call_id: 'c1' });
    });

    it('stringifies non-string tool content', () => {
      const msgs = [{ role: 'tool', content: { data: 'test' }, tool_call_id: 'c1' }];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].content).toBe('{"data":"test"}');
    });
  });

  // ─── chat() ─────────────────────────────────────────────────
  describe('chat()', () => {
    it('sends correct request', async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'Hello', tool_calls: [] } }] },
      });

      const result = await provider.chat([{ role: 'user', content: 'Hi' }], []);
      expect(result.content).toBe('Hello');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({ model: 'gpt-4o' }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-123',
          }),
        })
      );
    });

    it('throws when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(provider.chat([], [])).rejects.toThrow('OPENAI_API_KEY not set');
    });

    it('sends tools when provided', async () => {
      const tools = [{ type: 'function', function: { name: 'bash' } }];
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'Ok' } }] },
      });

      await provider.chat([], tools);
      expect(axios.post.mock.calls[0][1].tools).toEqual(tools);
    });

    it('omits tools when empty', async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'Ok' } }] },
      });

      await provider.chat([], []);
      expect(axios.post.mock.calls[0][1].tools).toBeUndefined();
    });
  });

  // ─── stream() ───────────────────────────────────────────────
  describe('stream()', () => {
    function createSSEStream(events) {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        for (const event of events) {
          emitter.emit('data', Buffer.from(`data: ${event}\n\n`));
        }
        emitter.emit('end');
      });
      return emitter;
    }

    it('streams text and calls onToken', async () => {
      const stream = createSSEStream([
        JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
        JSON.stringify({ choices: [{ delta: { content: ' World' } }] }),
        '[DONE]',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const tokens = [];
      const result = await provider.stream([], [], {
        onToken: (t) => tokens.push(t),
      });

      expect(result.content).toBe('Hello World');
      expect(tokens).toEqual(['Hello', ' World']);
    });

    it('collects tool calls from streamed deltas', async () => {
      const stream = createSSEStream([
        JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'bash', arguments: '' } }] } }],
        }),
        JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"command":' } }] } }],
        }),
        JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ' "ls"}' } }] } }],
        }),
        '[DONE]',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe('call_1');
      expect(result.tool_calls[0].function.name).toBe('bash');
      expect(result.tool_calls[0].function.arguments).toBe('{"command": "ls"}');
    });

    it('handles empty stream', async () => {
      const stream = createSSEStream(['[DONE]']);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe('');
      expect(result.tool_calls).toEqual([]);
    });

    it('handles stream errors', async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => emitter.emit('error', new Error('Connection reset')));
      axios.post.mockResolvedValueOnce({ data: emitter });

      await expect(provider.stream([], [])).rejects.toThrow('Stream error');
    });

    it('handles API connection error', async () => {
      axios.post.mockRejectedValueOnce(new Error('Connection refused'));
      await expect(provider.stream([], [])).rejects.toThrow('API Error');
    });

    it('includes error details from API response', async () => {
      const err = new Error('fail');
      err.response = { data: { error: { message: 'Rate limit exceeded' } } };
      axios.post.mockRejectedValueOnce(err);

      await expect(provider.stream([], [])).rejects.toThrow('Rate limit exceeded');
    });

    it('handles malformed SSE data gracefully', async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit('data', Buffer.from('data: not-json\n\n'));
        emitter.emit('data', Buffer.from(`data: ${JSON.stringify({ choices: [{ delta: { content: 'ok' } }] })}\n\n`));
        emitter.emit('data', Buffer.from('data: [DONE]\n\n'));
      });
      axios.post.mockResolvedValueOnce({ data: emitter });

      const result = await provider.stream([], []);
      expect(result.content).toBe('ok');
    });

    it('resolves on stream end without [DONE]', async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit('data', Buffer.from(`data: ${JSON.stringify({ choices: [{ delta: { content: 'partial' } }] })}\n\n`));
        emitter.emit('end');
      });
      axios.post.mockResolvedValueOnce({ data: emitter });

      const result = await provider.stream([], []);
      expect(result.content).toBe('partial');
    });

    it('handles multiple tool calls', async () => {
      const stream = createSSEStream([
        JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, id: 'c1', function: { name: 'bash', arguments: '{"command":"ls"}' } },
                { index: 1, id: 'c2', function: { name: 'read_file', arguments: '{"path":"test.js"}' } },
              ],
            },
          }],
        }),
        '[DONE]',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.tool_calls).toHaveLength(2);
      expect(result.tool_calls[0].function.name).toBe('bash');
      expect(result.tool_calls[1].function.name).toBe('read_file');
    });
  });

  // ─── normalizeResponse ──────────────────────────────────────
  describe('normalizeResponse()', () => {
    it('normalizes message with content', () => {
      const result = provider.normalizeResponse({
        choices: [{ message: { content: 'Hello', tool_calls: [] } }],
      });
      expect(result).toEqual({ content: 'Hello', tool_calls: [] });
    });

    it('normalizes message with tool calls', () => {
      const result = provider.normalizeResponse({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'bash', arguments: '{"command":"ls"}' },
            }],
          },
        }],
      });
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe('call_1');
    });

    it('handles empty choices', () => {
      const result = provider.normalizeResponse({ choices: [{ message: {} }] });
      expect(result).toEqual({ content: '', tool_calls: [] });
    });

    it('handles missing choices', () => {
      const result = provider.normalizeResponse({});
      expect(result).toEqual({ content: '', tool_calls: [] });
    });
  });
});

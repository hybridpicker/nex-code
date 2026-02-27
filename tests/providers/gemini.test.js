const { EventEmitter } = require('events');

jest.mock('axios', () => ({ post: jest.fn() }));
const axios = require('axios');

const { GeminiProvider, GEMINI_MODELS } = require('../../cli/providers/gemini');

describe('providers/gemini.js', () => {
  let provider;

  beforeEach(() => {
    provider = new GeminiProvider();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  // ─── Configuration ──────────────────────────────────────────
  describe('configuration', () => {
    it('has correct provider name', () => {
      expect(provider.name).toBe('gemini');
    });

    it('uses correct base URL', () => {
      expect(provider.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
    });

    it('has default models', () => {
      expect(provider.getModelNames()).toContain('gemini-2.5-pro');
      expect(provider.getModelNames()).toContain('gemini-2.5-flash');
      expect(provider.getModelNames()).toContain('gemini-2.0-flash');
      expect(provider.getModelNames()).toContain('gemini-2.0-flash-lite');
    });

    it('defaults to gemini-2.5-flash', () => {
      expect(provider.defaultModel).toBe('gemini-2.5-flash');
    });

    it('allows custom config', () => {
      const custom = new GeminiProvider({
        baseUrl: 'https://custom.google.com/v1',
        defaultModel: 'gemini-2.5-pro',
      });
      expect(custom.baseUrl).toBe('https://custom.google.com/v1');
      expect(custom.defaultModel).toBe('gemini-2.5-pro');
    });
  });

  // ─── isConfigured / getApiKey ──────────────────────────────
  describe('isConfigured()', () => {
    it('returns true when GEMINI_API_KEY is set', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns true when GOOGLE_API_KEY is set', () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = 'google-key';
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when no API key is set', () => {
      delete process.env.GEMINI_API_KEY;
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('getApiKey()', () => {
    it('prefers GEMINI_API_KEY', () => {
      process.env.GOOGLE_API_KEY = 'google-key';
      expect(provider.getApiKey()).toBe('test-gemini-key');
    });

    it('falls back to GOOGLE_API_KEY', () => {
      delete process.env.GEMINI_API_KEY;
      process.env.GOOGLE_API_KEY = 'google-key';
      expect(provider.getApiKey()).toBe('google-key');
    });

    it('returns null when missing', () => {
      delete process.env.GEMINI_API_KEY;
      expect(provider.getApiKey()).toBeNull();
    });
  });

  // ─── GEMINI_MODELS export ────────────────────────────────────
  describe('GEMINI_MODELS', () => {
    it('exports gemini-2.5-pro model info', () => {
      expect(GEMINI_MODELS['gemini-2.5-pro']).toMatchObject({
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        contextWindow: 1048576,
      });
    });

    it('exports gemini-2.5-flash model info', () => {
      expect(GEMINI_MODELS['gemini-2.5-flash']).toMatchObject({
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
      });
    });

    it('exports gemini-2.0-flash model info', () => {
      expect(GEMINI_MODELS['gemini-2.0-flash']).toMatchObject({
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
      });
    });

    it('exports gemini-2.0-flash-lite model info', () => {
      expect(GEMINI_MODELS['gemini-2.0-flash-lite']).toMatchObject({
        id: 'gemini-2.0-flash-lite',
        name: 'Gemini 2.0 Flash Lite',
      });
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
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        expect.objectContaining({ model: 'gemini-2.5-flash' }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-gemini-key',
          }),
        })
      );
    });

    it('throws when API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      await expect(provider.chat([], [])).rejects.toThrow('GEMINI_API_KEY not set');
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

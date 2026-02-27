const { EventEmitter } = require('events');

jest.mock('axios', () => ({ post: jest.fn() }));
const axios = require('axios');

const { OllamaProvider, OLLAMA_MODELS } = require('../../cli/providers/ollama');

describe('providers/ollama.js', () => {
  let provider;

  beforeEach(() => {
    provider = new OllamaProvider();
    process.env.OLLAMA_API_KEY = 'test-key-123';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.OLLAMA_API_KEY;
  });

  // ─── Configuration ──────────────────────────────────────────
  describe('configuration', () => {
    it('has correct provider name', () => {
      expect(provider.name).toBe('ollama');
    });

    it('uses correct base URL', () => {
      expect(provider.baseUrl).toBe('https://ollama.com');
    });

    it('has default models', () => {
      expect(provider.getModelNames()).toContain('kimi-k2.5');
      expect(provider.getModelNames()).toContain('qwen3-coder');
    });

    it('defaults to kimi-k2.5', () => {
      expect(provider.defaultModel).toBe('kimi-k2.5');
    });

    it('allows custom base URL', () => {
      const custom = new OllamaProvider({ baseUrl: 'https://custom.com' });
      expect(custom.baseUrl).toBe('https://custom.com');
    });

    it('allows custom models', () => {
      const custom = new OllamaProvider({
        models: { 'custom-model': { id: 'custom-model', name: 'Custom' } },
      });
      expect(custom.getModelNames()).toEqual(['custom-model']);
    });
  });

  // ─── isConfigured / getApiKey ──────────────────────────────
  describe('isConfigured()', () => {
    it('returns true when API key is set', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when API key is missing', () => {
      delete process.env.OLLAMA_API_KEY;
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('getApiKey()', () => {
    it('returns API key from env', () => {
      expect(provider.getApiKey()).toBe('test-key-123');
    });

    it('returns null when missing', () => {
      delete process.env.OLLAMA_API_KEY;
      expect(provider.getApiKey()).toBeNull();
    });
  });

  // ─── OLLAMA_MODELS export ───────────────────────────────────
  describe('OLLAMA_MODELS', () => {
    it('exports kimi-k2.5 model info', () => {
      expect(OLLAMA_MODELS['kimi-k2.5']).toMatchObject({
        id: 'kimi-k2.5',
        name: 'Kimi K2.5',
        maxTokens: 16384,
      });
    });

    it('exports qwen3-coder model info', () => {
      expect(OLLAMA_MODELS['qwen3-coder']).toMatchObject({
        id: 'qwen3-coder',
        name: 'Qwen3 Coder',
      });
    });
  });

  // ─── chat() ─────────────────────────────────────────────────
  describe('chat()', () => {
    it('sends non-streaming request', async () => {
      axios.post.mockResolvedValueOnce({
        data: { message: { content: 'Hello', tool_calls: [] } },
      });

      const result = await provider.chat([{ role: 'user', content: 'Hi' }], []);
      expect(result.content).toBe('Hello');
      expect(result.tool_calls).toEqual([]);
      expect(axios.post).toHaveBeenCalledWith(
        'https://ollama.com/api/chat',
        expect.objectContaining({ stream: false, model: 'kimi-k2.5' }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-key-123' },
        })
      );
    });

    it('uses specified model', async () => {
      axios.post.mockResolvedValueOnce({
        data: { message: { content: 'Hi' } },
      });

      await provider.chat([], [], { model: 'qwen3-coder' });
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'qwen3-coder' }),
        expect.any(Object)
      );
    });

    it('throws when API key is missing', async () => {
      delete process.env.OLLAMA_API_KEY;
      await expect(provider.chat([], [])).rejects.toThrow('OLLAMA_API_KEY not set');
    });

    it('sends tools when provided', async () => {
      const tools = [{ type: 'function', function: { name: 'bash' } }];
      axios.post.mockResolvedValueOnce({
        data: { message: { content: 'Ok' } },
      });

      await provider.chat([], tools);
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tools }),
        expect.any(Object)
      );
    });

    it('omits tools when empty', async () => {
      axios.post.mockResolvedValueOnce({
        data: { message: { content: 'Ok' } },
      });

      await provider.chat([], []);
      const body = axios.post.mock.calls[0][1];
      expect(body.tools).toBeUndefined();
    });
  });

  // ─── stream() ───────────────────────────────────────────────
  describe('stream()', () => {
    function createMockStream(chunks) {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        for (const chunk of chunks) {
          emitter.emit('data', Buffer.from(chunk));
        }
        emitter.emit('end');
      });
      return emitter;
    }

    it('streams text and calls onToken', async () => {
      const stream = createMockStream([
        '{"message":{"content":"Hello"},"done":false}\n',
        '{"message":{"content":" World"},"done":false}\n',
        '{"message":{},"done":true}\n',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const tokens = [];
      const result = await provider.stream([], [], {
        onToken: (t) => tokens.push(t),
      });

      expect(result.content).toBe('Hello World');
      expect(tokens).toEqual(['Hello', ' World']);
      expect(result.tool_calls).toEqual([]);
    });

    it('collects tool calls', async () => {
      const tc = { function: { name: 'bash', arguments: { command: 'ls' } } };
      const stream = createMockStream([
        '{"message":{"content":"Checking..."},"done":false}\n',
        `{"message":{"tool_calls":[${JSON.stringify(tc)}]},"done":false}\n`,
        '{"message":{},"done":true}\n',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe('Checking...');
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe('bash');
    });

    it('handles empty stream', async () => {
      const stream = createMockStream(['{"message":{},"done":true}\n']);
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

    it('includes error details from response', async () => {
      const err = new Error('fail');
      err.response = { data: { error: 'Model not found' } };
      axios.post.mockRejectedValueOnce(err);

      await expect(provider.stream([], [])).rejects.toThrow('Model not found');
    });

    it('sends correct request payload', async () => {
      const stream = createMockStream(['{"message":{},"done":true}\n']);
      axios.post.mockResolvedValueOnce({ data: stream });

      const messages = [{ role: 'user', content: 'test' }];
      const tools = [{ type: 'function', function: { name: 'test' } }];
      await provider.stream(messages, tools);

      expect(axios.post).toHaveBeenCalledWith(
        'https://ollama.com/api/chat',
        expect.objectContaining({ model: 'kimi-k2.5', messages, tools, stream: true }),
        expect.objectContaining({
          responseType: 'stream',
          headers: { Authorization: 'Bearer test-key-123' },
        })
      );
    });

    it('handles multiple NDJSON lines in single chunk', async () => {
      const stream = createMockStream([
        '{"message":{"content":"A"},"done":false}\n{"message":{"content":"B"},"done":false}\n{"message":{},"done":true}\n',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe('AB');
    });

    it('handles incomplete NDJSON lines across chunks', async () => {
      const stream = createMockStream([
        '{"message":{"content":"X"},"do',
        'ne":false}\n{"message":{},"done":true}\n',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe('X');
    });

    it('processes remaining buffer on stream end', async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit('data', Buffer.from('{"message":{"content":"buffered"},"done":true}'));
        emitter.emit('end');
      });
      axios.post.mockResolvedValueOnce({ data: emitter });

      const result = await provider.stream([], []);
      expect(result.content).toBe('buffered');
    });

    it('handles malformed JSON in stream gracefully', async () => {
      const stream = createMockStream([
        'not-json\n',
        '{"message":{"content":"ok"},"done":false}\n',
        '{"message":{},"done":true}\n',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe('ok');
    });
  });

  // ─── normalizeResponse ──────────────────────────────────────
  describe('normalizeResponse()', () => {
    it('normalizes message with content', () => {
      const result = provider.normalizeResponse({
        message: { content: 'Hello', tool_calls: [] },
      });
      expect(result).toEqual({ content: 'Hello', tool_calls: [] });
    });

    it('normalizes message with tool calls', () => {
      const result = provider.normalizeResponse({
        message: {
          content: '',
          tool_calls: [{ function: { name: 'bash', arguments: { command: 'ls' } } }],
        },
      });
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe('bash');
      expect(result.tool_calls[0]).toHaveProperty('id');
    });

    it('handles empty message', () => {
      const result = provider.normalizeResponse({ message: {} });
      expect(result).toEqual({ content: '', tool_calls: [] });
    });

    it('handles missing message', () => {
      const result = provider.normalizeResponse({});
      expect(result).toEqual({ content: '', tool_calls: [] });
    });
  });
});

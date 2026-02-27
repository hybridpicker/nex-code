const { EventEmitter } = require('events');

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
const axios = require('axios');

const { LocalProvider, DEFAULT_LOCAL_URL } = require('../../cli/providers/local');

describe('providers/local.js', () => {
  let provider;

  beforeEach(() => {
    provider = new LocalProvider();
    jest.clearAllMocks();
  });

  // ─── Configuration ──────────────────────────────────────────
  describe('configuration', () => {
    it('has correct provider name', () => {
      expect(provider.name).toBe('local');
    });

    it('uses correct default URL', () => {
      expect(provider.baseUrl).toBe('http://localhost:11434');
      expect(DEFAULT_LOCAL_URL).toBe('http://localhost:11434');
    });

    it('reads OLLAMA_LOCAL_URL from env', () => {
      process.env.OLLAMA_LOCAL_URL = 'http://custom:1234';
      const p = new LocalProvider();
      expect(p.baseUrl).toBe('http://custom:1234');
      delete process.env.OLLAMA_LOCAL_URL;
    });

    it('allows custom base URL in config', () => {
      const p = new LocalProvider({ baseUrl: 'http://remote:11434' });
      expect(p.baseUrl).toBe('http://remote:11434');
    });

    it('starts with empty models', () => {
      expect(provider.getModelNames()).toEqual([]);
    });
  });

  // ─── isConfigured ──────────────────────────────────────────
  describe('isConfigured()', () => {
    it('always returns true (no auth needed)', () => {
      expect(provider.isConfigured()).toBe(true);
    });
  });

  // ─── loadModels() ──────────────────────────────────────────
  describe('loadModels()', () => {
    it('loads models from /api/tags', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'llama3:latest', model: 'llama3:latest', details: {} },
            { name: 'codellama:7b', model: 'codellama:7b', details: {} },
          ],
        },
      });

      const models = await provider.loadModels();
      expect(Object.keys(models)).toContain('llama3');
      expect(Object.keys(models)).toContain('codellama:7b');
    });

    it('strips :latest suffix from model names', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [{ name: 'llama3:latest', model: 'llama3:latest' }],
        },
      });

      const models = await provider.loadModels();
      expect(models['llama3']).toBeDefined();
    });

    it('sets default model to first available', async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ name: 'mistral:latest' }] },
      });

      await provider.loadModels();
      expect(provider.defaultModel).toBe('mistral');
    });

    it('caches models after first load', async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ name: 'llama3:latest' }] },
      });

      await provider.loadModels();
      await provider.loadModels(); // Should not call axios again
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('handles server not running', async () => {
      axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const models = await provider.loadModels();
      expect(models).toEqual({});
    });

    it('handles empty model list', async () => {
      axios.get.mockResolvedValueOnce({ data: { models: [] } });

      const models = await provider.loadModels();
      expect(models).toEqual({});
    });

    it('handles missing name gracefully', async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ details: {} }] },
      });

      const models = await provider.loadModels();
      expect(Object.keys(models)).toHaveLength(0);
    });
  });

  // ─── chat() ─────────────────────────────────────────────────
  describe('chat()', () => {
    beforeEach(async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ name: 'llama3:latest' }] },
      });
      await provider.loadModels();
    });

    it('sends non-streaming request', async () => {
      axios.post.mockResolvedValueOnce({
        data: { message: { content: 'Hello', tool_calls: [] } },
      });

      const result = await provider.chat([{ role: 'user', content: 'Hi' }], []);
      expect(result.content).toBe('Hello');
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({ stream: false, model: 'llama3' }),
        expect.objectContaining({ timeout: 300000 })
      );
    });

    it('throws when no model available', async () => {
      const emptyProvider = new LocalProvider();
      emptyProvider.models = {};
      emptyProvider._modelsLoaded = true;
      emptyProvider.defaultModel = null;

      await expect(emptyProvider.chat([], [])).rejects.toThrow('No local model available');
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

    beforeEach(async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ name: 'llama3:latest' }] },
      });
      await provider.loadModels();
    });

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
    });

    it('handles stream errors', async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => emitter.emit('error', new Error('Connection reset')));
      axios.post.mockResolvedValueOnce({ data: emitter });

      await expect(provider.stream([], [])).rejects.toThrow('Stream error');
    });

    it('handles API connection error', async () => {
      axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(provider.stream([], [])).rejects.toThrow('API Error');
    });

    it('throws when no model available', async () => {
      const emptyProvider = new LocalProvider();
      emptyProvider.models = {};
      emptyProvider._modelsLoaded = true;
      emptyProvider.defaultModel = null;

      await expect(emptyProvider.stream([], [])).rejects.toThrow('No local model available');
    });

    it('collects tool calls', async () => {
      const tc = { function: { name: 'bash', arguments: { command: 'pwd' } } };
      const stream = createMockStream([
        `{"message":{"tool_calls":[${JSON.stringify(tc)}]},"done":false}\n`,
        '{"message":{},"done":true}\n',
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe('bash');
    });

    it('processes remaining buffer on end', async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit('data', Buffer.from('{"message":{"content":"buf"},"done":true}'));
        emitter.emit('end');
      });
      axios.post.mockResolvedValueOnce({ data: emitter });

      const result = await provider.stream([], []);
      expect(result.content).toBe('buf');
    });
  });

  // ─── normalizeResponse ──────────────────────────────────────
  describe('normalizeResponse()', () => {
    it('normalizes message with content', () => {
      const result = provider.normalizeResponse({
        message: { content: 'Hello' },
      });
      expect(result.content).toBe('Hello');
      expect(result.tool_calls).toEqual([]);
    });

    it('handles empty message', () => {
      const result = provider.normalizeResponse({});
      expect(result).toEqual({ content: '', tool_calls: [] });
    });
  });
});

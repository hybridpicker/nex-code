/**
 * tests/local-context.test.js — Dynamic Context Window Detection for Local Models
 */

jest.mock('axios');
const axios = require('axios');
const { LocalProvider } = require('../cli/providers/local');

describe('LocalProvider — Dynamic Context Window', () => {
  let provider;

  beforeEach(() => {
    provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
    jest.clearAllMocks();
  });

  describe('loadModels()', () => {
    it('queries /api/show for each model to get context window', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'llama3:latest', model: 'llama3:latest' },
          ],
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          model_info: { 'general.context_length': 131072 },
        },
      });

      const models = await provider.loadModels();
      expect(models['llama3']).toBeDefined();
      expect(models['llama3'].contextWindow).toBe(131072);
      expect(models['llama3'].maxTokens).toBe(8192); // min(8192, 131072*0.1=13107)
    });

    it('uses llama.context_length as fallback key', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [{ name: 'mistral:latest' }],
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          model_info: { 'llama.context_length': 65536 },
        },
      });

      const models = await provider.loadModels();
      expect(models['mistral'].contextWindow).toBe(65536);
    });

    it('parses num_ctx from modelfile when model_info has no context key', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [{ name: 'custom-model:latest' }],
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          model_info: {},
          modelfile: 'FROM llama3\nPARAMETER num_ctx 262144\nPARAMETER temperature 0.7',
        },
      });

      const models = await provider.loadModels();
      expect(models['custom-model'].contextWindow).toBe(262144);
    });

    it('falls back to 32768 when /api/show fails', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [{ name: 'offline-model:latest' }],
        },
      });

      axios.post.mockRejectedValueOnce(new Error('Connection refused'));

      const models = await provider.loadModels();
      expect(models['offline-model'].contextWindow).toBe(32768);
      expect(models['offline-model'].maxTokens).toBe(3276); // min(8192, 32768*0.1)
    });

    it('falls back to 32768 when model_info has no context keys and no modelfile', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [{ name: 'basic:latest' }],
        },
      });

      axios.post.mockResolvedValueOnce({
        data: {
          model_info: {},
        },
      });

      const models = await provider.loadModels();
      expect(models['basic'].contextWindow).toBe(32768);
    });

    it('handles multiple models with different context windows', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'qwen2.5:32b' },
            { name: 'phi3:latest' },
          ],
        },
      });

      // /api/show for qwen2.5:32b
      axios.post.mockResolvedValueOnce({
        data: {
          model_info: { 'general.context_length': 131072 },
        },
      });

      // /api/show for phi3:latest
      axios.post.mockResolvedValueOnce({
        data: {
          model_info: { 'llama.context_length': 4096 },
        },
      });

      const models = await provider.loadModels();
      expect(models['qwen2.5:32b'].contextWindow).toBe(131072);
      expect(models['phi3'].contextWindow).toBe(4096);
      expect(models['phi3'].maxTokens).toBe(409); // min(8192, 4096*0.1)
    });

    it('caches models after first load', async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ name: 'test:latest' }] },
      });
      axios.post.mockResolvedValueOnce({
        data: { model_info: { 'general.context_length': 8192 } },
      });

      await provider.loadModels();
      await provider.loadModels(); // second call should use cache

      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('sets defaultModel to first model when none configured', async () => {
      axios.get.mockResolvedValueOnce({
        data: { models: [{ name: 'first-model:latest' }, { name: 'second:latest' }] },
      });
      axios.post.mockResolvedValue({ data: { model_info: {} } });

      await provider.loadModels();
      expect(provider.defaultModel).toBe('first-model');
    });

    it('handles empty model list', async () => {
      axios.get.mockResolvedValueOnce({ data: { models: [] } });

      const models = await provider.loadModels();
      expect(Object.keys(models)).toHaveLength(0);
    });

    it('handles server not running', async () => {
      axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const models = await provider.loadModels();
      expect(Object.keys(models)).toHaveLength(0);
    });
  });

  describe('_parseContextFromModelfile()', () => {
    it('parses num_ctx from modelfile string', () => {
      const modelfile = 'FROM llama3\nPARAMETER num_ctx 131072\nSYSTEM You are a helpful assistant';
      expect(provider._parseContextFromModelfile(modelfile)).toBe(131072);
    });

    it('handles case-insensitive parameter keyword', () => {
      const modelfile = 'parameter num_ctx 65536';
      expect(provider._parseContextFromModelfile(modelfile)).toBe(65536);
    });

    it('returns null for modelfile without num_ctx', () => {
      const modelfile = 'FROM llama3\nPARAMETER temperature 0.7';
      expect(provider._parseContextFromModelfile(modelfile)).toBeNull();
    });

    it('returns null for null/undefined modelfile', () => {
      expect(provider._parseContextFromModelfile(null)).toBeNull();
      expect(provider._parseContextFromModelfile(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(provider._parseContextFromModelfile('')).toBeNull();
    });
  });
});

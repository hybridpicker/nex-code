jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

const registry = require('../../cli/providers/registry');

describe('providers/registry.js', () => {
  beforeEach(() => {
    registry._reset();
    process.env.OLLAMA_API_KEY = 'test-key';
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEFAULT_PROVIDER;
    delete process.env.DEFAULT_MODEL;
  });

  afterEach(() => {
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DEFAULT_PROVIDER;
    delete process.env.DEFAULT_MODEL;
  });

  // ─── Initialization ─────────────────────────────────────────
  describe('initialization', () => {
    it('auto-initializes with default providers', () => {
      const providers = registry.listProviders();
      expect(providers).toHaveLength(4);
      expect(providers.map((p) => p.provider)).toEqual(['ollama', 'openai', 'anthropic', 'local']);
    });

    it('defaults to ollama provider', () => {
      expect(registry.getActiveProviderName()).toBe('ollama');
    });

    it('defaults to kimi-k2.5 model', () => {
      expect(registry.getActiveModelId()).toBe('kimi-k2.5');
    });

    it('uses DEFAULT_PROVIDER from env', () => {
      registry._reset();
      process.env.DEFAULT_PROVIDER = 'openai';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(registry.getActiveProviderName()).toBe('openai');
      expect(registry.getActiveModelId()).toBe('gpt-4o');
    });

    it('uses DEFAULT_MODEL from env', () => {
      registry._reset();
      process.env.DEFAULT_MODEL = 'qwen3-coder';

      expect(registry.getActiveModelId()).toBe('qwen3-coder');
    });

    it('falls back to ollama when DEFAULT_PROVIDER is invalid', () => {
      registry._reset();
      process.env.DEFAULT_PROVIDER = 'nonexistent';

      expect(registry.getActiveProviderName()).toBe('ollama');
    });
  });

  // ─── getProvider ─────────────────────────────────────────────
  describe('getProvider()', () => {
    it('returns existing provider', () => {
      const p = registry.getProvider('ollama');
      expect(p).toBeDefined();
      expect(p.name).toBe('ollama');
    });

    it('returns null for unknown provider', () => {
      expect(registry.getProvider('nonexistent')).toBeNull();
    });
  });

  // ─── getActiveProvider ──────────────────────────────────────
  describe('getActiveProvider()', () => {
    it('returns the active provider instance', () => {
      const p = registry.getActiveProvider();
      expect(p).toBeDefined();
      expect(p.name).toBe('ollama');
    });
  });

  // ─── getActiveModel ─────────────────────────────────────────
  describe('getActiveModel()', () => {
    it('returns model with provider info', () => {
      const model = registry.getActiveModel();
      expect(model.id).toBe('kimi-k2.5');
      expect(model.name).toBe('Kimi K2.5');
      expect(model.provider).toBe('ollama');
    });

    it('returns basic info for unknown model', () => {
      registry._reset();
      process.env.OLLAMA_API_KEY = 'test';
      registry.setActiveModel('local:custom-model');

      const model = registry.getActiveModel();
      expect(model.id).toBe('custom-model');
      expect(model.provider).toBe('local');
    });
  });

  // ─── parseModelSpec ─────────────────────────────────────────
  describe('parseModelSpec()', () => {
    it('parses provider:model format', () => {
      expect(registry.parseModelSpec('openai:gpt-4o')).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
      });
    });

    it('handles model-only format', () => {
      expect(registry.parseModelSpec('gpt-4o')).toEqual({
        provider: null,
        model: 'gpt-4o',
      });
    });

    it('handles model with colons', () => {
      expect(registry.parseModelSpec('local:llama3:8b')).toEqual({
        provider: 'local',
        model: 'llama3:8b',
      });
    });

    it('returns nulls for empty input', () => {
      expect(registry.parseModelSpec('')).toEqual({ provider: null, model: null });
      expect(registry.parseModelSpec(null)).toEqual({ provider: null, model: null });
    });
  });

  // ─── setActiveModel ─────────────────────────────────────────
  describe('setActiveModel()', () => {
    it('sets model with provider prefix', () => {
      expect(registry.setActiveModel('ollama:qwen3-coder')).toBe(true);
      expect(registry.getActiveProviderName()).toBe('ollama');
      expect(registry.getActiveModelId()).toBe('qwen3-coder');
    });

    it('sets model without prefix (searches active provider)', () => {
      expect(registry.setActiveModel('qwen3-coder')).toBe(true);
      expect(registry.getActiveModelId()).toBe('qwen3-coder');
    });

    it('sets model from different provider (auto-switch)', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      registry._reset();
      process.env.OLLAMA_API_KEY = 'test';
      process.env.OPENAI_API_KEY = 'sk-test';

      expect(registry.setActiveModel('gpt-4o')).toBe(true);
      expect(registry.getActiveProviderName()).toBe('openai');
      expect(registry.getActiveModelId()).toBe('gpt-4o');
    });

    it('returns false for unknown model', () => {
      expect(registry.setActiveModel('nonexistent-model')).toBe(false);
    });

    it('returns false for unknown provider', () => {
      expect(registry.setActiveModel('fakeprovider:model')).toBe(false);
    });

    it('allows unknown models for local provider', () => {
      expect(registry.setActiveModel('local:my-custom-model')).toBe(true);
      expect(registry.getActiveProviderName()).toBe('local');
      expect(registry.getActiveModelId()).toBe('my-custom-model');
    });

    it('sets anthropic model with prefix', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      registry._reset();
      process.env.OLLAMA_API_KEY = 'test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

      expect(registry.setActiveModel('anthropic:claude-sonnet')).toBe(true);
      expect(registry.getActiveProviderName()).toBe('anthropic');
    });
  });

  // ─── getModelNames ──────────────────────────────────────────
  describe('getModelNames()', () => {
    it('returns all model names across providers', () => {
      const names = registry.getModelNames();
      expect(names).toContain('kimi-k2.5');
      expect(names).toContain('qwen3-coder');
      expect(names).toContain('gpt-4o');
      expect(names).toContain('claude-sonnet');
    });

    it('returns unique names', () => {
      const names = registry.getModelNames();
      const unique = [...new Set(names)];
      expect(names.length).toBe(unique.length);
    });
  });

  // ─── listProviders ─────────────────────────────────────────
  describe('listProviders()', () => {
    it('lists all providers with configuration status', () => {
      const list = registry.listProviders();
      const ollama = list.find((p) => p.provider === 'ollama');
      const openai = list.find((p) => p.provider === 'openai');

      expect(ollama.configured).toBe(true);
      expect(openai.configured).toBe(false);
    });

    it('marks active model', () => {
      const list = registry.listProviders();
      const ollama = list.find((p) => p.provider === 'ollama');
      const activeModels = ollama.models.filter((m) => m.active);
      expect(activeModels).toHaveLength(1);
      expect(activeModels[0].id).toBe('kimi-k2.5');
    });

    it('includes models per provider', () => {
      const list = registry.listProviders();
      const openai = list.find((p) => p.provider === 'openai');
      expect(openai.models.length).toBeGreaterThan(0);
      expect(openai.models[0]).toHaveProperty('id');
      expect(openai.models[0]).toHaveProperty('name');
    });
  });

  // ─── listAllModels ─────────────────────────────────────────
  describe('listAllModels()', () => {
    it('returns flat list with specs', () => {
      const models = registry.listAllModels();
      expect(models.length).toBeGreaterThan(5);

      const ollamaModel = models.find((m) => m.spec === 'ollama:kimi-k2.5');
      expect(ollamaModel).toBeDefined();
      expect(ollamaModel.provider).toBe('ollama');
    });

    it('includes configuration status', () => {
      const models = registry.listAllModels();
      const ollamaModel = models.find((m) => m.provider === 'ollama');
      expect(ollamaModel.configured).toBe(true);

      const openaiModel = models.find((m) => m.provider === 'openai');
      expect(openaiModel.configured).toBe(false);
    });
  });

  // ─── callStream ─────────────────────────────────────────────
  describe('callStream()', () => {
    it('throws when no provider available', async () => {
      registry._reset();
      // Force bad state
      const origProvider = process.env.OLLAMA_API_KEY;
      delete process.env.OLLAMA_API_KEY;

      await expect(registry.callStream([], [])).rejects.toThrow();

      process.env.OLLAMA_API_KEY = origProvider;
    });

    it('throws when provider not configured', async () => {
      registry._reset();
      process.env.DEFAULT_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      // Need at least one provider so init doesn't fall back
      process.env.OLLAMA_API_KEY = 'test';

      registry.setActiveModel('openai:gpt-4o');
      await expect(registry.callStream([], [])).rejects.toThrow(/not configured|No configured provider/);
    });
  });

  // ─── callChat ───────────────────────────────────────────────
  describe('callChat()', () => {
    it('throws when provider not configured', async () => {
      registry._reset();
      process.env.OLLAMA_API_KEY = 'test';
      registry.setActiveModel('openai:gpt-4o');

      await expect(registry.callChat([], [])).rejects.toThrow(/not configured|No configured provider/);
    });
  });

  // ─── _reset ─────────────────────────────────────────────────
  describe('_reset()', () => {
    it('clears all state', () => {
      registry._reset();
      // After reset, accessing triggers re-init
      expect(registry.getActiveProviderName()).toBe('ollama');
    });
  });

  // ─── registerProvider ───────────────────────────────────────
  describe('registerProvider()', () => {
    it('adds a custom provider', () => {
      const { BaseProvider } = require('../../cli/providers/base');
      class CustomProvider extends BaseProvider {
        constructor() {
          super({ name: 'custom', models: { 'custom-m': { id: 'custom-m', name: 'Custom Model' } } });
        }
        isConfigured() { return true; }
      }

      registry.registerProvider('custom', new CustomProvider());
      expect(registry.getProvider('custom')).toBeDefined();
      expect(registry.getProvider('custom').name).toBe('custom');
    });
  });
});

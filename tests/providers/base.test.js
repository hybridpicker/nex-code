const { BaseProvider } = require('../../cli/providers/base');

describe('providers/base.js', () => {
  // ─── Constructor ─────────────────────────────────────────────
  describe('constructor', () => {
    it('throws when instantiated directly', () => {
      expect(() => new BaseProvider()).toThrow('BaseProvider is abstract');
    });

    it('allows subclass instantiation', () => {
      class TestProvider extends BaseProvider {
        constructor() {
          super({ name: 'test', baseUrl: 'http://test.com' });
        }
      }
      const p = new TestProvider();
      expect(p.name).toBe('test');
      expect(p.baseUrl).toBe('http://test.com');
    });

    it('uses defaults when no config', () => {
      class TestProvider extends BaseProvider {
        constructor() {
          super();
        }
      }
      const p = new TestProvider();
      expect(p.name).toBe('unknown');
      expect(p.baseUrl).toBe('');
      expect(p.models).toEqual({});
      expect(p.defaultModel).toBeNull();
    });

    it('stores models from config', () => {
      class TestProvider extends BaseProvider {}
      const models = { 'test-model': { id: 'test-model', name: 'Test' } };
      const p = new TestProvider({ name: 'test', models });
      expect(p.models).toBe(models);
    });
  });

  // ─── Abstract Methods ───────────────────────────────────────
  describe('abstract methods', () => {
    class TestProvider extends BaseProvider {
      constructor() {
        super({ name: 'test' });
      }
    }

    let provider;
    beforeEach(() => {
      provider = new TestProvider();
    });

    it('isConfigured throws not implemented', () => {
      expect(() => provider.isConfigured()).toThrow('not implemented');
    });

    it('chat throws not implemented', async () => {
      await expect(provider.chat([], [])).rejects.toThrow('not implemented');
    });

    it('stream throws not implemented', async () => {
      await expect(provider.stream([], [])).rejects.toThrow('not implemented');
    });

    it('normalizeResponse throws not implemented', () => {
      expect(() => provider.normalizeResponse({})).toThrow('not implemented');
    });
  });

  // ─── Default Implementations ────────────────────────────────
  describe('default implementations', () => {
    class TestProvider extends BaseProvider {
      constructor(config) {
        super(config);
      }
    }

    it('getApiKey returns null by default', () => {
      const p = new TestProvider({ name: 'test' });
      expect(p.getApiKey()).toBeNull();
    });

    it('getModels returns configured models', () => {
      const models = { m1: { id: 'm1', name: 'Model 1' } };
      const p = new TestProvider({ name: 'test', models });
      expect(p.getModels()).toEqual(models);
    });

    it('getModelNames returns keys', () => {
      const models = { m1: { id: 'm1' }, m2: { id: 'm2' } };
      const p = new TestProvider({ name: 'test', models });
      expect(p.getModelNames()).toEqual(['m1', 'm2']);
    });

    it('getModel returns model by id', () => {
      const models = { m1: { id: 'm1', name: 'Model 1' } };
      const p = new TestProvider({ name: 'test', models });
      expect(p.getModel('m1')).toEqual({ id: 'm1', name: 'Model 1' });
    });

    it('getModel returns null for unknown model', () => {
      const p = new TestProvider({ name: 'test' });
      expect(p.getModel('nonexistent')).toBeNull();
    });

    it('formatMessages returns messages as-is', () => {
      const p = new TestProvider({ name: 'test' });
      const messages = [{ role: 'user', content: 'hello' }];
      expect(p.formatMessages(messages)).toEqual({ messages });
    });

    it('formatTools returns tools as-is', () => {
      const p = new TestProvider({ name: 'test' });
      const tools = [{ type: 'function', function: { name: 'test' } }];
      expect(p.formatTools(tools)).toEqual(tools);
    });
  });
});

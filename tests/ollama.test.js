/**
 * Tests for cli/ollama.js — backward-compatible wrapper + parseToolArgs utility
 */

// Mock the provider registry
jest.mock('../cli/providers/registry', () => {
  const mockProvider = {
    name: 'ollama',
    getModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', maxTokens: 16384 }),
    getModelNames: jest.fn().mockReturnValue(['kimi-k2.5', 'qwen3-coder']),
  };

  return {
    getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
    setActiveModel: jest.fn().mockImplementation((name) => name === 'qwen3-coder' || name === 'kimi-k2.5'),
    getModelNames: jest.fn().mockReturnValue(['kimi-k2.5', 'qwen3-coder', 'gpt-4o', 'claude-sonnet']),
    callStream: jest.fn(),
    callChat: jest.fn(),
    getActiveProvider: jest.fn().mockReturnValue(mockProvider),
    _reset: jest.fn(),
  };
});

const {
  MODELS,
  getActiveModel,
  setActiveModel,
  getModelNames,
  callOllamaStream,
  callOllama,
  parseToolArgs,
} = require('../cli/ollama');

const registry = require('../cli/providers/registry');

describe('ollama.js (wrapper)', () => {
  let writeSpy;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  // ─── MODELS export ─────────────────────────────────────────
  describe('MODELS', () => {
    it('has kimi-k2.5 model', () => {
      expect(MODELS['kimi-k2.5']).toBeDefined();
      expect(MODELS['kimi-k2.5'].name).toBe('Kimi K2.5');
      expect(MODELS['kimi-k2.5'].max_tokens).toBe(16384);
    });

    it('has qwen3-coder model', () => {
      expect(MODELS['qwen3-coder']).toBeDefined();
      expect(MODELS['qwen3-coder'].name).toBe('Qwen3 Coder');
    });
  });

  // ─── Delegating functions ───────────────────────────────────
  describe('getActiveModel()', () => {
    it('delegates to registry', () => {
      const result = getActiveModel();
      expect(registry.getActiveModel).toHaveBeenCalled();
      expect(result.id).toBe('kimi-k2.5');
    });
  });

  describe('setActiveModel()', () => {
    it('delegates to registry', () => {
      const result = setActiveModel('qwen3-coder');
      expect(registry.setActiveModel).toHaveBeenCalledWith('qwen3-coder');
      expect(result).toBe(true);
    });

    it('returns false for unknown model', () => {
      const result = setActiveModel('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getModelNames()', () => {
    it('delegates to registry', () => {
      const names = getModelNames();
      expect(registry.getModelNames).toHaveBeenCalled();
      expect(names).toContain('kimi-k2.5');
    });
  });

  // ─── callOllamaStream (deprecated wrapper) ─────────────────
  describe('callOllamaStream()', () => {
    it('delegates to registry.callStream', async () => {
      registry.callStream.mockResolvedValueOnce({
        content: 'Hello',
        tool_calls: [],
      });

      const result = await callOllamaStream([{ role: 'user', content: 'Hi' }], []);
      expect(registry.callStream).toHaveBeenCalled();
      expect(result.content).toBe('Hello');
    });

    it('propagates errors', async () => {
      registry.callStream.mockRejectedValueOnce(new Error('API Error: fail'));
      await expect(callOllamaStream([], [])).rejects.toThrow('API Error');
    });
  });

  // ─── callOllama (deprecated wrapper) ────────────────────────
  describe('callOllama()', () => {
    it('delegates to registry.callChat', async () => {
      registry.callChat.mockResolvedValueOnce({
        content: 'Hello',
        tool_calls: [],
      });

      const result = await callOllama([{ role: 'user', content: 'Hi' }], []);
      expect(registry.callChat).toHaveBeenCalled();
      expect(result.content).toBe('Hello');
    });
  });

  // ─── parseToolArgs ──────────────────────────────────────────
  describe('parseToolArgs()', () => {
    it('returns null for null input', () => {
      expect(parseToolArgs(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseToolArgs(undefined)).toBeNull();
    });

    it('returns object as-is', () => {
      const obj = { command: 'ls' };
      expect(parseToolArgs(obj)).toBe(obj);
    });

    it('parses valid JSON string', () => {
      const result = parseToolArgs('{"command": "ls -la"}');
      expect(result).toEqual({ command: 'ls -la' });
    });

    it('fixes trailing commas', () => {
      const result = parseToolArgs('{"command": "ls",}');
      expect(result).toEqual({ command: 'ls' });
    });

    it('fixes single quotes', () => {
      const result = parseToolArgs("{'command': 'ls'}");
      expect(result).toEqual({ command: 'ls' });
    });

    it('extracts JSON from surrounding text', () => {
      const result = parseToolArgs('here is the args: {"path": "test.js"} end');
      expect(result).toEqual({ path: 'test.js' });
    });

    it('returns null for completely unparseable input', () => {
      expect(parseToolArgs('not json at all')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseToolArgs('')).toBeNull();
    });

    it('handles nested objects', () => {
      const result = parseToolArgs('{"a": {"b": 1}}');
      expect(result).toEqual({ a: { b: 1 } });
    });

    it('handles arrays in JSON', () => {
      const result = parseToolArgs('{"files": ["a.js", "b.js"]}');
      expect(result).toEqual({ files: ['a.js', 'b.js'] });
    });
  });
});

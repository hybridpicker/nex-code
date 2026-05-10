/**
 * tests/env.test.ts — Environment Configuration Tests
 *
 * Tests for the env.ts module: env var loading, defaults,
 * Ollama-first provider selection, budget parsing, and
 * config validation.
 */

import { loadEnvConfig, EnvConfig, validateConfig, DEFAULT_CONFIG } from '../src/config/env';

// ─── Reset helpers ───────────────────────────────────────────────────────────

function clearEnvVars() {
  delete process.env.OLLAMA_API_KEY;
  delete process.env.DEFAULT_PROVIDER;
  delete process.env.DEFAULT_MODEL;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.NEX_BUDGET_LIMIT;
  delete process.env.NEX_BUDGET_CURRENCY;
  delete process.env.NEX_FALLBACK_ENABLED;
  delete process.env.NEX_PHASE_ROUTING;
}

describe('EnvConfig — loadEnvConfig', () => {
  beforeEach(() => {
    clearEnvVars();
  });

  afterAll(() => {
    clearEnvVars();
  });

  // ─── Defaults ──────────────────────────────────────────────────────────

  it('should return defaults when no env vars are set', () => {
    const config = loadEnvConfig();
    expect(config.defaultProvider).toBe('ollama');
    expect(config.defaultModel).toBe('qwen3-coder:480b');
    expect(config.fallbackEnabled).toBe(true);
    expect(config.budgetLimit).toBe(0);
    expect(config.budgetCurrency).toBe('USD');
  });

  it('should set Ollama as the default provider', () => {
    const config = loadEnvConfig();
    expect(config.defaultProvider).toBe('ollama');
  });

  it('should default model to qwen3-coder:480b', () => {
    const config = loadEnvConfig();
    expect(config.defaultModel).toBe('qwen3-coder:480b');
  });

  // ─── Ollama API Key ────────────────────────────────────────────────────

  it('should read OLLAMA_API_KEY from env', () => {
    process.env.OLLAMA_API_KEY = 'sk-ollama-test-123';
    const config = loadEnvConfig();
    expect(config.ollamaApiKey).toBe('sk-ollama-test-123');
  });

  it('should return undefined for OLLAMA_API_KEY when not set', () => {
    const config = loadEnvConfig();
    expect(config.ollamaApiKey).toBeUndefined();
  });

  // ─── Premium provider keys ─────────────────────────────────────────────

  it('should read all premium provider keys from env', () => {
    process.env.OPENAI_API_KEY = 'sk-openai-123';
    process.env.ANTHROPIC_API_KEY = 'sk-anthropic-456';
    process.env.GEMINI_API_KEY = 'sk-gemini-789';
    process.env.DEEPSEEK_API_KEY = 'sk-deepseek-000';

    const config = loadEnvConfig();
    expect(config.openaiApiKey).toBe('sk-openai-123');
    expect(config.anthropicApiKey).toBe('sk-anthropic-456');
    expect(config.geminiApiKey).toBe('sk-gemini-789');
    expect(config.deepseekApiKey).toBe('sk-deepseek-000');
  });

  it('should return undefined for premium keys when not set', () => {
    const config = loadEnvConfig();
    expect(config.openaiApiKey).toBeUndefined();
    expect(config.anthropicApiKey).toBeUndefined();
    expect(config.geminiApiKey).toBeUndefined();
    expect(config.deepseekApiKey).toBeUndefined();
  });

  // ─── Provider override ─────────────────────────────────────────────────

  it('should allow overriding DEFAULT_PROVIDER via env', () => {
    process.env.DEFAULT_PROVIDER = 'openai';
    const config = loadEnvConfig();
    expect(config.defaultProvider).toBe('openai');
  });

  it('should allow overriding DEFAULT_MODEL via env', () => {
    process.env.DEFAULT_MODEL = 'gpt-4o';
    const config = loadEnvConfig();
    expect(config.defaultModel).toBe('gpt-4o');
  });

  it('should reject unknown provider in DEFAULT_PROVIDER', () => {
    process.env.DEFAULT_PROVIDER = 'unknown-provider';
    const config = loadEnvConfig();
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Unsupported provider: unknown-provider'
    );
  });

  // ─── Budget ────────────────────────────────────────────────────────────

  it('should parse NEX_BUDGET_LIMIT as a float', () => {
    process.env.NEX_BUDGET_LIMIT = '10.00';
    const config = loadEnvConfig();
    expect(config.budgetLimit).toBe(10.0);
  });

  it('should treat invalid NEX_BUDGET_LIMIT as 0', () => {
    process.env.NEX_BUDGET_LIMIT = 'not-a-number';
    const config = loadEnvConfig();
    expect(config.budgetLimit).toBe(0);
  });

  it('should parse negative NEX_BUDGET_LIMIT as 0', () => {
    process.env.NEX_BUDGET_LIMIT = '-5';
    const config = loadEnvConfig();
    expect(config.budgetLimit).toBe(0);
  });

  it('should read NEX_BUDGET_CURRENCY from env', () => {
    process.env.NEX_BUDGET_CURRENCY = 'EUR';
    const config = loadEnvConfig();
    expect(config.budgetCurrency).toBe('EUR');
  });

  // ─── Fallback and phase routing flags ──────────────────────────────────

  it('should disable fallback when NEX_FALLBACK_ENABLED=0', () => {
    process.env.NEX_FALLBACK_ENABLED = '0';
    const config = loadEnvConfig();
    expect(config.fallbackEnabled).toBe(false);
  });

  it('should enable fallback when NEX_FALLBACK_ENABLED=1', () => {
    process.env.NEX_FALLBACK_ENABLED = '1';
    const config = loadEnvConfig();
    expect(config.fallbackEnabled).toBe(true);
  });

  it('should disable phase routing when NEX_PHASE_ROUTING=0', () => {
    process.env.NEX_PHASE_ROUTING = '0';
    const config = loadEnvConfig();
    expect(config.phaseRoutingEnabled).toBe(false);
  });

  it('should enable phase routing when NEX_PHASE_ROUTING=1', () => {
    process.env.NEX_PHASE_ROUTING = '1';
    const config = loadEnvConfig();
    expect(config.phaseRoutingEnabled).toBe(true);
  });

  it('should default phase routing to true for Ollama provider', () => {
    process.env.DEFAULT_PROVIDER = 'ollama';
    const config = loadEnvConfig();
    expect(config.phaseRoutingEnabled).toBe(true);
  });

  it('should default phase routing to false for non-Ollama provider', () => {
    process.env.DEFAULT_PROVIDER = 'openai';
    const config = loadEnvConfig();
    expect(config.phaseRoutingEnabled).toBe(false);
  });
});

describe('EnvConfig — validateConfig', () => {
  beforeEach(() => {
    clearEnvVars();
  });

  afterAll(() => {
    clearEnvVars();
  });

  it('should pass validation with valid defaults', () => {
    const config = loadEnvConfig();
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      'No Ollama API key configured — Ollama Cloud will be unavailable'
    );
  });

  it('should warn when no premium keys and fallback is enabled', () => {
    process.env.NEX_FALLBACK_ENABLED = '1';
    const config = loadEnvConfig();
    const result = validateConfig(config);
    expect(result.warnings).toContain(
      'Fallback enabled but no premium provider keys configured'
    );
  });

  it('should be valid when Ollama key is set', () => {
    process.env.OLLAMA_API_KEY = 'sk-test';
    const config = loadEnvConfig();
    const result = validateConfig(config);
    expect(result.warnings).not.toContain(
      'No Ollama API key configured — Ollama Cloud will be unavailable'
    );
  });

  it('should error on unsupported provider', () => {
    const config: EnvConfig = {
      ...DEFAULT_CONFIG,
      defaultProvider: 'unknown-provider' as any,
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unsupported provider');
  });

  it('should error on empty model name', () => {
    const config: EnvConfig = {
      ...DEFAULT_CONFIG,
      defaultModel: '',
    };
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('model');
  });

  it('should pass with full valid configuration', () => {
    process.env.OLLAMA_API_KEY = 'sk-ollama';
    process.env.OPENAI_API_KEY = 'sk-openai';
    process.env.ANTHROPIC_API_KEY = 'sk-anthropic';
    process.env.NEX_BUDGET_LIMIT = '50.00';
    const config = loadEnvConfig();
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('EnvConfig — DEFAULT_CONFIG', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_CONFIG.defaultProvider).toBeDefined();
    expect(DEFAULT_CONFIG.defaultModel).toBeDefined();
    expect(DEFAULT_CONFIG.fallbackEnabled).toBeDefined();
    expect(DEFAULT_CONFIG.budgetLimit).toBeDefined();
    expect(DEFAULT_CONFIG.budgetCurrency).toBeDefined();
    expect(DEFAULT_CONFIG.phaseRoutingEnabled).toBeDefined();
  });

  it('should be immutable-like when spread', () => {
    const config1 = { ...DEFAULT_CONFIG, defaultModel: 'custom' };
    const config2 = { ...DEFAULT_CONFIG };
    expect(config1.defaultModel).toBe('custom');
    expect(config2.defaultModel).toBe('qwen3-coder:480b');
  });
});

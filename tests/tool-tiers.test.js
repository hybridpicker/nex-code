/**
 * tests/tool-tiers.test.js — Tool Tier System
 */

jest.mock('../cli/providers/registry', () => ({
  getActiveModel: jest.fn(),
  getActiveProviderName: jest.fn(),
}));

// Mock fs.existsSync and fs.readFileSync for config loading
const mockFs = {
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

const { getActiveModel, getActiveProviderName } = require('../cli/providers/registry');

// We need to require tool-tiers after mocks are set up
let filterToolsForModel, getActiveTier, getModelTier, getEditMode, getTierInfo, TIERS, MODEL_TIERS, PROVIDER_DEFAULT_TIER, loadConfigOverrides;

beforeAll(() => {
  const tiers = require('../cli/tool-tiers');
  filterToolsForModel = tiers.filterToolsForModel;
  getActiveTier = tiers.getActiveTier;
  getModelTier = tiers.getModelTier;
  getEditMode = tiers.getEditMode;
  getTierInfo = tiers.getTierInfo;
  TIERS = tiers.TIERS;
  MODEL_TIERS = tiers.MODEL_TIERS;
  PROVIDER_DEFAULT_TIER = tiers.PROVIDER_DEFAULT_TIER;
  loadConfigOverrides = tiers.loadConfigOverrides;
});

// Sample tool definitions for testing
const SAMPLE_TOOLS = [
  { function: { name: 'bash' } },
  { function: { name: 'read_file' } },
  { function: { name: 'write_file' } },
  { function: { name: 'edit_file' } },
  { function: { name: 'list_directory' } },
  { function: { name: 'search_files' } },
  { function: { name: 'glob' } },
  { function: { name: 'grep' } },
  { function: { name: 'patch_file' } },
  { function: { name: 'web_fetch' } },
  { function: { name: 'web_search' } },
  { function: { name: 'ask_user' } },
];

describe('TIERS definitions', () => {
  it('essential tier has 5 core tools', () => {
    expect(TIERS.essential).toHaveLength(5);
    expect(TIERS.essential).toContain('bash');
    expect(TIERS.essential).toContain('read_file');
    expect(TIERS.essential).toContain('write_file');
    expect(TIERS.essential).toContain('edit_file');
    expect(TIERS.essential).toContain('list_directory');
  });

  it('standard tier has 21 tools', () => {
    expect(TIERS.standard).toHaveLength(21);
    expect(TIERS.standard).toContain('glob');
    expect(TIERS.standard).toContain('grep');
    expect(TIERS.standard).toContain('ask_user');
    expect(TIERS.standard).toContain('git_status');
    expect(TIERS.standard).toContain('git_diff');
    expect(TIERS.standard).toContain('git_log');
  });

  it('full tier is null (all tools)', () => {
    expect(TIERS.full).toBeNull();
  });
});

describe('getActiveTier()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    loadConfigOverrides();
  });

  it('returns full for known full-tier models', () => {
    getActiveModel.mockReturnValue({ id: 'kimi-k2.5' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('full');
  });

  it('returns standard for deepseek-r1', () => {
    getActiveModel.mockReturnValue({ id: 'devstral-small-2:24b' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('standard');
  });

  it('returns essential for qwen3:30b-a3b', () => {
    getActiveModel.mockReturnValue({ id: 'gemma3:4b' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('essential');
  });

  it('returns full for all OpenAI models', () => {
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');
    expect(getActiveTier()).toBe('full');
  });

  it('returns standard for claude-haiku', () => {
    getActiveModel.mockReturnValue({ id: 'claude-haiku' });
    getActiveProviderName.mockReturnValue('anthropic');
    expect(getActiveTier()).toBe('standard');
  });

  it('returns essential for gemini-2.0-flash-lite', () => {
    getActiveModel.mockReturnValue({ id: 'gemini-2.0-flash-lite' });
    getActiveProviderName.mockReturnValue('gemini');
    expect(getActiveTier()).toBe('essential');
  });

  it('returns full for Gemini 3.x preview', () => {
    getActiveModel.mockReturnValue({ id: 'gemini-3.1-pro-preview' });
    getActiveProviderName.mockReturnValue('gemini');
    expect(getActiveTier()).toBe('full');
  });

  it('falls back to provider default for unknown models', () => {
    getActiveModel.mockReturnValue({ id: 'some-unknown-model' });
    getActiveProviderName.mockReturnValue('local');
    expect(getActiveTier()).toBe('essential');
  });

  it('falls back to provider default for unknown ollama model', () => {
    getActiveModel.mockReturnValue({ id: 'custom-finetune' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('full');
  });

  it('returns full as ultimate fallback', () => {
    getActiveModel.mockReturnValue({ id: 'unknown' });
    getActiveProviderName.mockReturnValue('unknown-provider');
    expect(getActiveTier()).toBe('full');
  });

  it('respects config overrides for specific model', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      toolTiers: { 'devstral-small-2:24b': 'essential' },
    }));
    loadConfigOverrides();

    getActiveModel.mockReturnValue({ id: 'devstral-small-2:24b' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('essential');
  });

  it('respects config overrides with provider wildcard', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      toolTiers: { 'local:*': 'full' },
    }));
    loadConfigOverrides();

    getActiveModel.mockReturnValue({ id: 'llama3' });
    getActiveProviderName.mockReturnValue('local');
    expect(getActiveTier()).toBe('full');
  });

  it('handles corrupt config gracefully', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('not json');
    loadConfigOverrides();

    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');
    expect(getActiveTier()).toBe('full');
  });
});

describe('filterToolsForModel()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    loadConfigOverrides();
  });

  it('returns all tools for full tier', () => {
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    expect(filtered).toHaveLength(12);
  });

  it('returns 5 tools for essential tier', () => {
    getActiveModel.mockReturnValue({ id: 'gemma3:4b' });
    getActiveProviderName.mockReturnValue('ollama');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    expect(filtered).toHaveLength(5);
    expect(filtered.map(t => t.function.name)).toEqual(TIERS.essential);
  });

  it('returns 9 tools for standard tier', () => {
    getActiveModel.mockReturnValue({ id: 'devstral-small-2:24b' });
    getActiveProviderName.mockReturnValue('ollama');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    expect(filtered).toHaveLength(9);
  });

  it('preserves tool objects (does not clone)', () => {
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    expect(filtered[0]).toBe(SAMPLE_TOOLS[0]);
  });

  it('filters out non-essential tools correctly', () => {
    getActiveModel.mockReturnValue({ id: 'gemma3:4b' });
    getActiveProviderName.mockReturnValue('ollama');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    const names = filtered.map(t => t.function.name);
    expect(names).not.toContain('web_fetch');
    expect(names).not.toContain('web_search');
    expect(names).not.toContain('patch_file');
    expect(names).not.toContain('grep');
  });
});

describe('getTierInfo()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    loadConfigOverrides();
  });

  it('returns tier name and tool count', () => {
    getActiveModel.mockReturnValue({ id: 'devstral-small-2:24b' });
    getActiveProviderName.mockReturnValue('ollama');

    const info = getTierInfo();
    expect(info.tier).toBe('standard');
    expect(info.toolCount).toBe(21); // 16 + container_list, container_logs, container_exec, container_manage, deploy
  });

  it('returns "all" for full tier', () => {
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');

    const info = getTierInfo();
    expect(info.tier).toBe('full');
    expect(info.toolCount).toBe('all');
  });
});

// ─── getModelTier() ─────────────────────────────────────────────

describe('getModelTier()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    loadConfigOverrides();
  });

  it('returns tier for known models', () => {
    expect(getModelTier('kimi-k2.5', 'ollama')).toBe('full');
    expect(getModelTier('gemma3:4b', 'ollama')).toBe('essential');
    expect(getModelTier('gpt-4o', 'openai')).toBe('full');
    expect(getModelTier('claude-haiku', 'anthropic')).toBe('standard');
  });

  it('falls back to provider default for unknown models', () => {
    expect(getModelTier('unknown-model', 'local')).toBe('essential');
    expect(getModelTier('unknown-model', 'openai')).toBe('full');
    expect(getModelTier('unknown-model', 'ollama')).toBe('full');
    expect(getModelTier('unknown-model', 'gemini')).toBe('full');
  });

  it('returns full as ultimate fallback', () => {
    expect(getModelTier('unknown', 'unknown-provider')).toBe('full');
  });

  it('respects config overrides', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      toolTiers: { 'kimi-k2.5': 'essential' },
    }));
    loadConfigOverrides();

    expect(getModelTier('kimi-k2.5', 'ollama')).toBe('essential');
  });

  it('respects provider wildcard overrides', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      toolTiers: { 'local:*': 'full' },
    }));
    loadConfigOverrides();

    expect(getModelTier('some-local-model', 'local')).toBe('full');
  });
});

// ─── filterToolsForModel() with overrideTier ─────────────────────

describe('filterToolsForModel() with overrideTier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    loadConfigOverrides();
  });

  it('uses overrideTier when provided', () => {
    // Even though active model is full tier, override to essential
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');

    const filtered = filterToolsForModel(SAMPLE_TOOLS, 'essential');
    expect(filtered).toHaveLength(5);
    expect(filtered.map(t => t.function.name)).toEqual(TIERS.essential);
  });

  it('falls back to active tier when overrideTier is undefined', () => {
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    expect(filtered).toHaveLength(12); // full tier = all tools
  });

  it('returns all tools when overrideTier is full', () => {
    getActiveModel.mockReturnValue({ id: 'gemma3:4b' });
    getActiveProviderName.mockReturnValue('ollama');

    const filtered = filterToolsForModel(SAMPLE_TOOLS, 'full');
    expect(filtered).toHaveLength(12);
  });
});

// ─── getEditMode() ──────────────────────────────────────────────

describe('getEditMode()', () => {
  it('returns strict for Claude models', () => {
    expect(getEditMode('claude-sonnet-4', 'anthropic')).toBe('strict');
    expect(getEditMode('claude-opus', 'anthropic')).toBe('strict');
    expect(getEditMode('claude-haiku', 'anthropic')).toBe('strict');
  });

  it('returns strict for claude-* prefix variants', () => {
    expect(getEditMode('claude-sonnet-4-5-20251001', 'anthropic')).toBe('strict');
    expect(getEditMode('claude-unknown-future', 'anthropic')).toBe('strict');
  });

  it('returns strict for GPT-4o', () => {
    expect(getEditMode('gpt-4o', 'openai')).toBe('strict');
  });

  it('returns strict for other strong OpenAI models', () => {
    expect(getEditMode('gpt-4.1', 'openai')).toBe('strict');
    expect(getEditMode('o1', 'openai')).toBe('strict');
    expect(getEditMode('o3', 'openai')).toBe('strict');
    expect(getEditMode('o4-mini', 'openai')).toBe('strict');
  });

  it('returns strict for qwen3-coder:480b', () => {
    expect(getEditMode('qwen3-coder:480b', 'ollama')).toBe('strict');
  });

  it('returns strict for other strong ollama models', () => {
    expect(getEditMode('kimi-k2:1t', 'ollama')).toBe('strict');
    expect(getEditMode('deepseek-v3.2', 'ollama')).toBe('strict');
  });

  it('returns fuzzy for unknown ollama model', () => {
    expect(getEditMode('some-random-model', 'ollama')).toBe('fuzzy');
  });

  it('returns fuzzy for local provider', () => {
    expect(getEditMode('llama3', 'local')).toBe('fuzzy');
  });

  it('returns strict for gemini provider default', () => {
    expect(getEditMode('gemini-2.5-pro', 'gemini')).toBe('strict');
  });

  it('returns fuzzy for completely unknown provider', () => {
    expect(getEditMode('unknown-model', 'unknown-provider')).toBe('fuzzy');
  });
});

// ─── Exported constants ─────────────────────────────────────────

describe('exported constants', () => {
  it('MODEL_TIERS contains known models', () => {
    expect(MODEL_TIERS['kimi-k2.5']).toBe('full');
    expect(MODEL_TIERS['gpt-4o']).toBe('full');
    expect(MODEL_TIERS['claude-haiku']).toBe('standard');
    expect(MODEL_TIERS['gemma3:4b']).toBe('essential');
  });

  it('PROVIDER_DEFAULT_TIER has defaults for all providers', () => {
    expect(PROVIDER_DEFAULT_TIER.ollama).toBe('full');
    expect(PROVIDER_DEFAULT_TIER.openai).toBe('full');
    expect(PROVIDER_DEFAULT_TIER.anthropic).toBe('full');
    expect(PROVIDER_DEFAULT_TIER.gemini).toBe('full');
    expect(PROVIDER_DEFAULT_TIER.local).toBe('essential');
  });
});

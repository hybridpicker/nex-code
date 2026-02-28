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
let filterToolsForModel, getActiveTier, getTierInfo, TIERS, loadConfigOverrides;

beforeAll(() => {
  const tiers = require('../cli/tool-tiers');
  filterToolsForModel = tiers.filterToolsForModel;
  getActiveTier = tiers.getActiveTier;
  getTierInfo = tiers.getTierInfo;
  TIERS = tiers.TIERS;
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

  it('standard tier has 13 tools', () => {
    expect(TIERS.standard).toHaveLength(13);
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
    getActiveModel.mockReturnValue({ id: 'deepseek-r1' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('standard');
  });

  it('returns essential for qwen3-30b-a3b', () => {
    getActiveModel.mockReturnValue({ id: 'qwen3-30b-a3b' });
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

  it('falls back to provider default for unknown models', () => {
    getActiveModel.mockReturnValue({ id: 'some-unknown-model' });
    getActiveProviderName.mockReturnValue('local');
    expect(getActiveTier()).toBe('essential');
  });

  it('falls back to provider default for unknown ollama model', () => {
    getActiveModel.mockReturnValue({ id: 'custom-finetune' });
    getActiveProviderName.mockReturnValue('ollama');
    expect(getActiveTier()).toBe('standard');
  });

  it('returns standard as ultimate fallback', () => {
    getActiveModel.mockReturnValue({ id: 'unknown' });
    getActiveProviderName.mockReturnValue('unknown-provider');
    expect(getActiveTier()).toBe('standard');
  });

  it('respects config overrides for specific model', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      toolTiers: { 'deepseek-r1': 'essential' },
    }));
    loadConfigOverrides();

    getActiveModel.mockReturnValue({ id: 'deepseek-r1' });
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
    getActiveModel.mockReturnValue({ id: 'qwen3-30b-a3b' });
    getActiveProviderName.mockReturnValue('ollama');

    const filtered = filterToolsForModel(SAMPLE_TOOLS);
    expect(filtered).toHaveLength(5);
    expect(filtered.map(t => t.function.name)).toEqual(TIERS.essential);
  });

  it('returns 9 tools for standard tier', () => {
    getActiveModel.mockReturnValue({ id: 'deepseek-r1' });
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
    getActiveModel.mockReturnValue({ id: 'qwen3-30b-a3b' });
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
    getActiveModel.mockReturnValue({ id: 'deepseek-r1' });
    getActiveProviderName.mockReturnValue('ollama');

    const info = getTierInfo();
    expect(info.tier).toBe('standard');
    expect(info.toolCount).toBe(13);
  });

  it('returns "all" for full tier', () => {
    getActiveModel.mockReturnValue({ id: 'gpt-4o' });
    getActiveProviderName.mockReturnValue('openai');

    const info = getTierInfo();
    expect(info.tier).toBe('full');
    expect(info.toolCount).toBe('all');
  });
});

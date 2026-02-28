/**
 * tests/sub-agent-routing.test.js — Sub-Agent Model Routing
 */

jest.mock('../cli/providers/registry', () => {
  const actual = jest.requireActual('../cli/providers/registry');
  return {
    ...actual,
    callChat: jest.fn(),
    getActiveProviderName: jest.fn().mockReturnValue('ollama'),
    getActiveModelId: jest.fn().mockReturnValue('kimi-k2.5'),
    getConfiguredProviders: jest.fn(),
    getProvider: jest.fn(),
    getActiveProvider: jest.fn(),
    parseModelSpec: actual.parseModelSpec,
  };
});

jest.mock('../cli/tool-tiers', () => {
  const actual = jest.requireActual('../cli/tool-tiers');
  return {
    ...actual,
    filterToolsForModel: jest.fn((tools) => tools),
    getModelTier: jest.fn((modelId, providerName) => {
      const tiers = {
        'kimi-k2.5': 'full',
        'qwen3-30b-a3b': 'essential',
        'deepseek-r1': 'standard',
        'claude-haiku': 'standard',
        'gpt-4o': 'full',
      };
      return tiers[modelId] || 'standard';
    }),
  };
});

jest.mock('../cli/costs', () => ({ trackUsage: jest.fn() }));
jest.mock('../cli/ui', () => ({
  MultiProgress: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
  })),
  C: { dim: '', reset: '', red: '', green: '', yellow: '', cyan: '', blue: '', bold: '' },
}));

const {
  classifyTask,
  pickModelForTier,
  resolveSubAgentModel,
  runSubAgent,
  executeSpawnAgents,
} = require('../cli/sub-agent');

const {
  callChat,
  getActiveProviderName,
  getConfiguredProviders,
  getProvider,
  getActiveProvider,
} = require('../cli/providers/registry');

const { filterToolsForModel, getModelTier } = require('../cli/tool-tiers');

// ─── classifyTask() ─────────────────────────────────────────────

describe('classifyTask()', () => {
  it('classifies read-only tasks as essential', () => {
    expect(classifyTask('Read the contents of package.json')).toBe('essential');
    expect(classifyTask('Search for all test files')).toBe('essential');
    expect(classifyTask('Find all imports of lodash')).toBe('essential');
    expect(classifyTask('List all files in src/')).toBe('essential');
    expect(classifyTask('Check if the file exists')).toBe('essential');
  });

  it('classifies complex tasks as full', () => {
    expect(classifyTask('Refactor the authentication module')).toBe('full');
    expect(classifyTask('Implement a new caching layer')).toBe('full');
    expect(classifyTask('Rewrite the parser from scratch')).toBe('full');
    expect(classifyTask('Design the database schema')).toBe('full');
    expect(classifyTask('Generate unit tests for utils')).toBe('full');
    expect(classifyTask('Migrate from Jest to Vitest')).toBe('full');
  });

  it('classifies ambiguous tasks as standard', () => {
    expect(classifyTask('Fix the bug in login')).toBe('standard');
    expect(classifyTask('Update the error message')).toBe('standard');
    expect(classifyTask('Add a comment to the function')).toBe('standard');
  });

  it('handles empty/edge-case input', () => {
    expect(classifyTask('')).toBe('standard');
    expect(classifyTask('xyz')).toBe('standard');
  });

  it('heavy patterns take precedence over fast patterns', () => {
    // "implement" is heavy, even though "search" might also match parts
    expect(classifyTask('implement a search feature')).toBe('full');
  });
});

// ─── pickModelForTier() ─────────────────────────────────────────

describe('pickModelForTier()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
  });

  it('finds a model at the target tier', () => {
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [
        { id: 'kimi-k2.5', name: 'Kimi K2.5' },
        { id: 'qwen3-30b-a3b', name: 'Qwen3 30B' },
      ]},
    ]);

    const result = pickModelForTier('essential');
    expect(result).toEqual({ provider: 'ollama', model: 'qwen3-30b-a3b' });
  });

  it('prefers the active provider', () => {
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'openai', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] },
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);

    const result = pickModelForTier('full');
    expect(result).toEqual({ provider: 'ollama', model: 'kimi-k2.5' });
  });

  it('returns null when no model at tier', () => {
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'deepseek-r1', name: 'DeepSeek R1' }] },
    ]);

    const result = pickModelForTier('essential');
    expect(result).toBeNull();
  });
});

// ─── resolveSubAgentModel() ─────────────────────────────────────

describe('resolveSubAgentModel()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [
        { id: 'kimi-k2.5', name: 'Kimi K2.5' },
        { id: 'qwen3-30b-a3b', name: 'Qwen3 30B' },
      ]},
    ]);
  });

  it('uses explicit valid provider:model spec', () => {
    const mockProv = { isConfigured: () => true, getModel: (id) => id === 'kimi-k2.5' ? { id: 'kimi-k2.5' } : null };
    getProvider.mockReturnValue(mockProv);

    const result = resolveSubAgentModel({ task: 'test', model: 'ollama:kimi-k2.5' });
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('kimi-k2.5');
    expect(result.tier).toBe('full');
  });

  it('falls back to auto-routing on invalid spec', () => {
    getProvider.mockReturnValue(null);

    const result = resolveSubAgentModel({ task: 'Read the file', model: 'fake:nonexistent' });
    // Should auto-route based on task ("Read" → essential)
    expect(result).toBeDefined();
  });

  it('auto-routes heavy task to full-tier model', () => {
    const result = resolveSubAgentModel({ task: 'Refactor the auth module' });
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('kimi-k2.5');
    expect(result.tier).toBe('full');
  });

  it('auto-routes read task to essential-tier model', () => {
    const result = resolveSubAgentModel({ task: 'Read the config file' });
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('qwen3-30b-a3b');
    expect(result.tier).toBe('essential');
  });

  it('returns null fields when no model matches', () => {
    getConfiguredProviders.mockReturnValue([]);

    const result = resolveSubAgentModel({ task: 'Fix the bug' });
    expect(result.provider).toBeNull();
    expect(result.model).toBeNull();
    expect(result.tier).toBeNull();
  });
});

// ─── runSubAgent() ──────────────────────────────────────────────

describe('runSubAgent()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
  });

  it('passes provider+model to callChat when routing resolves', async () => {
    callChat.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Refactor the module' });

    expect(callChat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ provider: 'ollama', model: 'kimi-k2.5' })
    );
  });

  it('uses default when routing returns null', async () => {
    getConfiguredProviders.mockReturnValue([]);
    callChat.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Fix bug' });

    // chatOptions should be empty (no provider/model override)
    expect(callChat).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      {}
    );
  });

  it('includes modelSpec in result when routing resolves', async () => {
    callChat.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    const result = await runSubAgent({ task: 'Refactor the module' });
    expect(result.modelSpec).toBe('ollama:kimi-k2.5');
  });

  it('passes overrideTier to filterToolsForModel', async () => {
    callChat.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Refactor the module' });

    expect(filterToolsForModel).toHaveBeenCalledWith(
      expect.any(Array),
      'full'
    );
  });
});

// ─── executeSpawnAgents() ───────────────────────────────────────

describe('executeSpawnAgents()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
  });

  it('includes model label in output', async () => {
    callChat.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [{ task: 'Refactor the module' }],
    });

    expect(result).toContain('[ollama:kimi-k2.5]');
  });
});

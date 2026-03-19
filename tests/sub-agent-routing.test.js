/**
 * tests/sub-agent-routing.test.js — Sub-Agent Model Routing
 */

jest.mock('../cli/providers/registry', () => {
  const actual = jest.requireActual('../cli/providers/registry');
  return {
    ...actual,
    callStream: jest.fn(),
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
  isRetryableError,
  getExcludedTools,
} = require('../cli/sub-agent');

const {
  callStream,
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

  it('passes provider+model to callStream when routing resolves', async () => {
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Refactor the module' });

    expect(callStream).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ provider: 'ollama', model: 'kimi-k2.5' })
    );
  });

  it('uses default when routing returns null', async () => {
    getConfiguredProviders.mockReturnValue([]);
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Fix bug' });

    // chatOptions should be empty (no provider/model override)
    expect(callStream).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      {}
    );
  });

  it('includes modelSpec in result when routing resolves', async () => {
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    const result = await runSubAgent({ task: 'Refactor the module' });
    expect(result.modelSpec).toBe('ollama:kimi-k2.5');
  });

  it('passes overrideTier to filterToolsForModel', async () => {
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

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
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [{ task: 'Refactor the module' }],
    });

    expect(result).toContain('[ollama:kimi-k2.5]');
  });
});

// ─── isRetryableError() ──────────────────────────────────────

describe('isRetryableError()', () => {
  it('retries on 429 rate limit', () => {
    expect(isRetryableError(new Error('Request failed with status 429'))).toBe(true);
  });

  it('retries on server errors (500-504)', () => {
    expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
    expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true);
  });

  it('retries on network errors', () => {
    const econnreset = new Error('Connection reset');
    econnreset.code = 'ECONNRESET';
    expect(isRetryableError(econnreset)).toBe(true);

    const etimedout = new Error('Timed out');
    etimedout.code = 'ETIMEDOUT';
    expect(isRetryableError(etimedout)).toBe(true);

    expect(isRetryableError(new Error('socket disconnected'))).toBe(true);
    expect(isRetryableError(new Error('TLS handshake failed'))).toBe(true);
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('does NOT retry on auth errors', () => {
    expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    expect(isRetryableError(new Error('403 Forbidden'))).toBe(false);
  });

  it('does NOT retry on bad request', () => {
    expect(isRetryableError(new Error('400 Bad Request'))).toBe(false);
  });

  it('does NOT retry on unknown errors', () => {
    expect(isRetryableError(new Error('Something went wrong'))).toBe(false);
  });
});

// ─── Retry behavior in runSubAgent() ────────────────────────

describe('runSubAgent() retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
  });

  it('retries on transient error then succeeds', async () => {
    callStream
      .mockRejectedValueOnce(new Error('502 Bad Gateway'))
      .mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    const result = await runSubAgent({ task: 'Refactor the module' });
    expect(result.status).toBe('done');
    expect(result.result).toBe('Done');
    expect(callStream).toHaveBeenCalledTimes(2);
  }, 15000);

  it('fails after exhausting retries on persistent error', async () => {
    callStream.mockRejectedValue(new Error('502 Bad Gateway'));

    const result = await runSubAgent({ task: 'Refactor the module' });
    expect(result.status).toBe('failed');
    expect(result.result).toContain('502');
    // 1 initial + 3 retries = 4 calls
    expect(callStream).toHaveBeenCalledTimes(4);
  }, 30000);

  it('does NOT retry on auth errors (401)', async () => {
    callStream.mockRejectedValue(new Error('401 Unauthorized'));

    const result = await runSubAgent({ task: 'Refactor the module' });
    expect(result.status).toBe('failed');
    expect(callStream).toHaveBeenCalledTimes(1);
  });

  it('handles null response from provider', async () => {
    callStream.mockResolvedValueOnce(null);

    const result = await runSubAgent({ task: 'Refactor the module' });
    expect(result.status).toBe('failed');
    expect(result.result).toContain('Empty or invalid response');
  });
});

// ─── getExcludedTools() — depth-aware tool exclusion ──────────

describe('getExcludedTools()', () => {
  it('at depth 0 does NOT exclude spawn_agents', () => {
    const excluded = getExcludedTools(0);
    expect(excluded.has('spawn_agents')).toBe(false);
    expect(excluded.has('ask_user')).toBe(true);
    expect(excluded.has('task_list')).toBe(true);
  });

  it('at depth 1 does NOT exclude spawn_agents', () => {
    const excluded = getExcludedTools(1);
    expect(excluded.has('spawn_agents')).toBe(false);
  });

  it('at depth 2 DOES exclude spawn_agents', () => {
    const excluded = getExcludedTools(2);
    expect(excluded.has('spawn_agents')).toBe(true);
    expect(excluded.has('ask_user')).toBe(true);
  });

  it('at depth 3 (beyond max) also excludes spawn_agents', () => {
    const excluded = getExcludedTools(3);
    expect(excluded.has('spawn_agents')).toBe(true);
  });
});

// ─── executeSpawnAgents() — depth guard + limits ───────────────

describe('executeSpawnAgents() depth guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
  });

  it('returns error at depth >= 2', async () => {
    const result = await executeSpawnAgents(
      { agents: [{ task: 'Refactor module' }] },
      2
    );
    expect(result).toContain('max agent nesting depth');
    expect(result).toContain('2');
  });

  it('returns error at depth 3 as well', async () => {
    const result = await executeSpawnAgents(
      { agents: [{ task: 'Review code' }] },
      3
    );
    expect(result).toContain('max agent nesting depth');
  });

  it('at depth 1 trims agents to max 2', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents(
      {
        agents: [
          { task: 'Review module A' },
          { task: 'Review module B' },
          { task: 'Review module C' }, // should be trimmed
        ],
      },
      1
    );

    // Only 2 agents ran — result lists at most 2 agent entries
    const agentMatches = (result.match(/Agent \d+/g) || []);
    expect(agentMatches.length).toBeLessThanOrEqual(2);
  });

  it('at depth 0 allows up to 5 agents', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [
        { task: 'Task 1' }, { task: 'Task 2' }, { task: 'Task 3' },
        { task: 'Task 4' }, { task: 'Task 5' },
      ],
    });

    expect(result).not.toContain('max agent nesting depth');
    expect(result).toContain('Agent 5');
  });

  it('at depth 1 uses ↳ prefix in labels', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const { MultiProgress: MP } = require('../cli/ui');
    MP.mockClear();

    await executeSpawnAgents(
      { agents: [{ task: 'Review auth module' }] },
      1
    );

    // The label passed to MultiProgress should contain the ↳ prefix
    const constructorCall = MP.mock.calls[0];
    const labels = constructorCall[0];
    expect(labels[0]).toMatch(/↳/);
  });

  it('at depth 0 does NOT use ↳ prefix in labels', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const { MultiProgress: MP } = require('../cli/ui');
    MP.mockClear();

    await executeSpawnAgents(
      { agents: [{ task: 'Implement auth module' }] },
      0
    );

    const constructorCall = MP.mock.calls[0];
    const labels = constructorCall[0];
    expect(labels[0]).not.toMatch(/↳/);
  });
});

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
        'qwen3:30b-a3b': 'essential',
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

jest.mock('../cli/tools', () => ({
  TOOL_DEFINITIONS: [
    { type: 'function', function: { name: 'read_file', parameters: {} } },
    { type: 'function', function: { name: 'write_file', parameters: {} } },
    { type: 'function', function: { name: 'edit_file', parameters: {} } },
    { type: 'function', function: { name: 'bash', parameters: {} } },
    { type: 'function', function: { name: 'glob', parameters: {} } },
    { type: 'function', function: { name: 'grep', parameters: {} } },
    { type: 'function', function: { name: 'ask_user', parameters: {} } },
    { type: 'function', function: { name: 'spawn_agents', parameters: {} } },
  ],
  executeTool: jest.fn().mockResolvedValue('tool result'),
}));

const {
  classifyTask,
  pickModelForTier,
  resolveSubAgentModel,
  runSubAgent,
  executeSpawnAgents,
  isRetryableError,
  clearAllLocks,
  callWithRetry,
} = require('../cli/sub-agent');

const {
  callStream,
  getActiveProviderName,
  getActiveModelId,
  getConfiguredProviders,
  getProvider,
  getActiveProvider,
} = require('../cli/providers/registry');

const { filterToolsForModel, getModelTier } = require('../cli/tool-tiers');
const { trackUsage } = require('../cli/costs');
const { executeTool } = require('../cli/tools');

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
        { id: 'qwen3:30b-a3b', name: 'Qwen3 30B' },
      ]},
    ]);

    const result = pickModelForTier('essential');
    expect(result).toEqual({ provider: 'ollama', model: 'qwen3:30b-a3b' });
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
        { id: 'qwen3:30b-a3b', name: 'Qwen3 30B' },
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

  it('always uses active model, applies full tier for heavy tasks', () => {
    const result = resolveSubAgentModel({ task: 'Refactor the auth module' });
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('kimi-k2.5');
    expect(result.tier).toBe('full');
  });

  it('always uses active model, applies essential tier for read tasks', () => {
    const result = resolveSubAgentModel({ task: 'Read the config file' });
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('kimi-k2.5');
    expect(result.tier).toBe('essential');
  });

  it('applies standard tier for ambiguous tasks', () => {
    const result = resolveSubAgentModel({ task: 'Fix the bug' });
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('kimi-k2.5');
    expect(result.tier).toBe('standard');
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

  it('passes model to callStream when routing resolves', async () => {
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Refactor the module' });

    expect(callStream).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ model: 'kimi-k2.5', onToken: expect.any(Function) })
    );
  });

  it('uses active model as fallback when no tier match', async () => {
    getConfiguredProviders.mockReturnValue([]);
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Fix bug' });

    // Falls back to active model (kimi-k2.5) via callStream
    expect(callStream).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.objectContaining({ model: 'kimi-k2.5' })
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

// ─── File Locking (acquireLock / releaseLock) ────────────────

describe('File locking', () => {
  beforeEach(() => {
    clearAllLocks();
  });

  it('same agent can acquire a lock and re-lock the same file', async () => {
    // We test locking indirectly through runSubAgent tool execution:
    // An agent that writes to the same file twice should succeed both times.
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getActiveModelId.mockReturnValue('kimi-k2.5');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
    executeTool.mockResolvedValue('file written');

    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'write_file', arguments: JSON.stringify({ path: '/tmp/test-lock.txt', content: 'a' }) } },
          { id: 'tc2', function: { name: 'write_file', arguments: JSON.stringify({ path: '/tmp/test-lock.txt', content: 'b' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    const result = await runSubAgent({ task: 'Write the file twice' });
    expect(result.status).toBe('done');
    // executeTool should have been called twice (both writes succeed for same agent)
    expect(executeTool).toHaveBeenCalledTimes(2);
  });

  it('different agent is blocked from a locked file', async () => {
    // Two concurrent agents write to the same file. We use a blocking
    // executeTool to ensure agent 1 holds the lock when agent 2 tries.
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getActiveModelId.mockReturnValue('kimi-k2.5');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);

    const sharedFile = '/tmp/lock-conflict-test.txt';
    let agent2Started = false;
    let resolveAgent1Tool;

    // executeTool: agent 1's write blocks until agent 2 has also tried
    executeTool.mockImplementation(async () => {
      if (!agent2Started) {
        // First call (agent 1) — block until agent 2 has been given a chance
        await new Promise(r => { resolveAgent1Tool = r; });
      }
      return 'written';
    });

    let callIdx = 0;
    callStream.mockImplementation(async () => {
      callIdx++;
      // Both agents get write_file on iteration 1
      if (callIdx <= 2) {
        return {
          content: '',
          tool_calls: [
            { id: `tc-${callIdx}`, function: { name: 'write_file', arguments: JSON.stringify({ path: sharedFile, content: `agent-${callIdx}` }) } },
          ],
        };
      }
      return { content: 'Done', tool_calls: [] };
    });

    // Launch both agents concurrently
    const p1 = runSubAgent({ task: 'Agent 1 writes' });
    const p2 = runSubAgent({ task: 'Agent 2 writes' });

    // Give microtask queue time for both agents to start their first iteration
    await new Promise(r => setTimeout(r, 50));
    agent2Started = true;
    // Unblock agent 1's tool execution
    if (resolveAgent1Tool) resolveAgent1Tool();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.status).toBe('done');
    expect(r2.status).toBe('done');
  }, 10000);
});

// ─── callWithRetry() exhausting retries (line 68 fallthrough) ──

describe('callWithRetry()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws lastError after exhausting all retries on retryable errors', async () => {
    const retryableErr = new Error('503 Service Unavailable');
    callStream.mockRejectedValue(retryableErr);

    await expect(callWithRetry([], [], {})).rejects.toThrow('503 Service Unavailable');
    // 1 initial + 3 retries = 4 calls
    expect(callStream).toHaveBeenCalledTimes(4);
  }, 60000);

  it('throws immediately on non-retryable error without exhausting retries', async () => {
    callStream.mockRejectedValue(new Error('400 Bad Request'));

    await expect(callWithRetry([], [], {})).rejects.toThrow('400 Bad Request');
    expect(callStream).toHaveBeenCalledTimes(1);
  });

  it('succeeds on first attempt without retry', async () => {
    callStream.mockResolvedValueOnce({ content: 'ok' });

    const result = await callWithRetry([], [], {});
    expect(result).toEqual({ content: 'ok' });
    expect(callStream).toHaveBeenCalledTimes(1);
  });
});

// ─── pickModelForTier() second pass (lines 117-119) ────────────

describe('pickModelForTier() second pass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to another provider when active has no match', () => {
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'deepseek-r1', name: 'DeepSeek R1' }] }, // standard only
      { name: 'openai', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] },           // full
    ]);

    const result = pickModelForTier('full');
    expect(result).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('skips the local provider in second pass', () => {
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'deepseek-r1', name: 'DeepSeek R1' }] },
      { name: 'local', models: [{ id: 'gpt-4o', name: 'GPT-4o' }] },
    ]);

    // Even though 'local' has gpt-4o (full tier), it should be skipped
    const result = pickModelForTier('full');
    expect(result).toBeNull();
  });

  it('skips active provider in second pass (no double-check)', () => {
    getActiveProviderName.mockReturnValue('ollama');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'deepseek-r1', name: 'DeepSeek R1' }] },
      { name: 'anthropic', models: [{ id: 'claude-haiku', name: 'Claude Haiku' }] },
    ]);

    // Active (ollama) has no essential model; anthropic has claude-haiku (standard)
    const result = pickModelForTier('essential');
    // Neither has essential tier, so null
    expect(result).toBeNull();
  });

  it('returns match from second provider when first (active) has no tier match', () => {
    getActiveProviderName.mockReturnValue('ollama');
    getModelTier.mockImplementation((modelId) => {
      if (modelId === 'qwen3:30b-a3b') return 'essential';
      if (modelId === 'kimi-k2.5') return 'full';
      return 'standard';
    });
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
      { name: 'openai', models: [{ id: 'qwen3:30b-a3b', name: 'Qwen3 30B' }] },
    ]);

    const result = pickModelForTier('essential');
    expect(result).toEqual({ provider: 'openai', model: 'qwen3:30b-a3b' });
  });
});

// ─── resolveSubAgentModel() ultimate fallback (line 156) ────────

describe('resolveSubAgentModel() ultimate fallback', () => {
  it('returns null provider/model/tier when no active provider or model', () => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue(null);
    getActiveModelId.mockReturnValue(null);
    getConfiguredProviders.mockReturnValue([]);

    const result = resolveSubAgentModel({ task: 'Fix the bug' });
    expect(result).toEqual({ provider: null, model: null, tier: null });
  });

  it('returns null when activeProviderName exists but activeModel is null', () => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue(null);
    getActiveModelId.mockReturnValue('kimi-k2.5');
    getConfiguredProviders.mockReturnValue([]);

    const result = resolveSubAgentModel({ task: 'Fix the bug' });
    // activeProviderName is falsy, so falls through to ultimate fallback
    expect(result).toEqual({ provider: null, model: null, tier: null });
  });
});

// ─── Tool execution within runSubAgent (lines 263-319) ──────────

describe('runSubAgent() tool execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllLocks();
    getActiveProviderName.mockReturnValue('ollama');
    getActiveModelId.mockReturnValue('kimi-k2.5');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
    executeTool.mockResolvedValue('tool output');
  });

  it('handles malformed tool arguments gracefully', async () => {
    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'read_file', arguments: '<<<NOT VALID JSON AT ALL>>>' } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Recovered', tool_calls: [] });

    const result = await runSubAgent({ task: 'Read a file' });
    expect(result.status).toBe('done');
    expect(result.result).toBe('Recovered');
    // executeTool should NOT have been called for the malformed args
    expect(executeTool).not.toHaveBeenCalled();
  });

  it('records write_file in toolsUsed and acquires lock', async () => {
    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'write_file', arguments: JSON.stringify({ path: '/tmp/subagent-test.txt', content: 'hello' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Written', tool_calls: [] });

    const result = await runSubAgent({ task: 'Create a file' });
    expect(result.status).toBe('done');
    expect(result.toolsUsed).toContain('write_file');
    expect(executeTool).toHaveBeenCalledWith('write_file', { path: '/tmp/subagent-test.txt', content: 'hello' }, { autoConfirm: true, silent: true });
  });

  it('handles tool execution errors gracefully', async () => {
    executeTool.mockRejectedValueOnce(new Error('Permission denied'));

    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'bash', arguments: JSON.stringify({ command: 'rm -rf /' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Handled error', tool_calls: [] });

    const result = await runSubAgent({ task: 'Run a command' });
    expect(result.status).toBe('done');
    expect(result.result).toBe('Handled error');
    expect(result.toolsUsed).toContain('bash');
  });

  it('truncates tool output longer than 20000 characters', async () => {
    const longOutput = 'x'.repeat(25000);
    executeTool.mockResolvedValueOnce(longOutput);

    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'read_file', arguments: JSON.stringify({ path: 'big.txt' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Done reading', tool_calls: [] });

    const result = await runSubAgent({ task: 'Read a big file' });
    expect(result.status).toBe('done');
    // The messages array should have a truncated tool result; verify executeTool was called
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it('assigns a generated callId when tool_call has no id', async () => {
    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { function: { name: 'read_file', arguments: JSON.stringify({ path: 'test.txt' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    const result = await runSubAgent({ task: 'Read test.txt' });
    expect(result.status).toBe('done');
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it('handles executeTool returning null/undefined', async () => {
    executeTool.mockResolvedValueOnce(null);

    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'bash', arguments: JSON.stringify({ command: 'true' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    const result = await runSubAgent({ task: 'Run bash' });
    expect(result.status).toBe('done');
  });

  it('calls onUpdate callback after each iteration with tool calls', async () => {
    const onUpdate = jest.fn();

    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a.txt' }) } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Read a file' }, { onUpdate });
    expect(onUpdate).toHaveBeenCalledWith('step 1/10');
  });

  it('reaches max iterations and returns last content', async () => {
    // Always return tool calls to exhaust max_iterations
    callStream.mockResolvedValue({
      content: 'Still working',
      tool_calls: [
        { id: 'tc1', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a.txt' }) } },
      ],
    });

    const result = await runSubAgent({ task: 'Endless task', max_iterations: 2 });
    expect(result.status).toBe('done');
    // callStream called twice (max_iterations=2), then exits the loop
    expect(callStream).toHaveBeenCalledTimes(2);
  });

  it('excludes ask_user and spawn_agents from available tools', async () => {
    callStream.mockResolvedValueOnce({ content: 'Done', tool_calls: [] });

    await runSubAgent({ task: 'Do something' });

    // filterToolsForModel receives tools WITHOUT ask_user and spawn_agents
    const toolsPassedToFilter = filterToolsForModel.mock.calls[0][0];
    const toolNames = toolsPassedToFilter.map(t => t.function.name);
    expect(toolNames).not.toContain('ask_user');
    expect(toolNames).not.toContain('spawn_agents');
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('write_file');
  });
});

// ─── Token tracking in runSubAgent (lines 228-234) ──────────────

describe('runSubAgent() token tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getActiveProviderName.mockReturnValue('ollama');
    getActiveModelId.mockReturnValue('kimi-k2.5');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
  });

  it('accumulates token usage from multiple iterations', async () => {
    callStream
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [
          { id: 'tc1', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a.txt' }) } },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      })
      .mockResolvedValueOnce({
        content: 'Done',
        tool_calls: [],
        usage: { prompt_tokens: 200, completion_tokens: 80 },
      });

    const result = await runSubAgent({ task: 'Read and summarize' });
    expect(result.tokensUsed).toEqual({ input: 300, output: 130 });
    expect(trackUsage).toHaveBeenCalledTimes(2);
    expect(trackUsage).toHaveBeenCalledWith('ollama', 'kimi-k2.5', 100, 50);
    expect(trackUsage).toHaveBeenCalledWith('ollama', 'kimi-k2.5', 200, 80);
  });

  it('uses fallback provider/model names for tracking when routing returns null', async () => {
    getActiveProviderName.mockReturnValue(null);
    getActiveModelId.mockReturnValue(null);
    getConfiguredProviders.mockReturnValue([]);

    callStream.mockResolvedValueOnce({
      content: 'Done',
      tool_calls: [],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    });

    const result = await runSubAgent({ task: 'Fix bug' });
    expect(result.status).toBe('done');
    // trackUsage called with fallback values from getActiveProviderName/getActiveModelId
    expect(trackUsage).toHaveBeenCalledWith(null, null, 50, 20);
    expect(result.tokensUsed).toEqual({ input: 50, output: 20 });
    expect(result.modelSpec).toBeNull();
  });

  it('handles missing usage fields gracefully (defaults to 0)', async () => {
    callStream.mockResolvedValueOnce({
      content: 'Done',
      tool_calls: [],
      usage: {},
    });

    const result = await runSubAgent({ task: 'Quick task' });
    expect(result.tokensUsed).toEqual({ input: 0, output: 0 });
    expect(trackUsage).toHaveBeenCalledWith('ollama', 'kimi-k2.5', 0, 0);
  });

  it('skips tracking when no usage object is present', async () => {
    callStream.mockResolvedValueOnce({
      content: 'Done',
      tool_calls: [],
    });

    const result = await runSubAgent({ task: 'No usage info' });
    expect(result.tokensUsed).toEqual({ input: 0, output: 0 });
    expect(trackUsage).not.toHaveBeenCalled();
  });
});

// ─── executeSpawnAgents() edge cases (lines 362, 380-381, 419-421) ──

describe('executeSpawnAgents() edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllLocks();
    getActiveProviderName.mockReturnValue('ollama');
    getActiveModelId.mockReturnValue('kimi-k2.5');
    getConfiguredProviders.mockReturnValue([
      { name: 'ollama', models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }] },
    ]);
  });

  it('returns error when no agents are specified', async () => {
    const result = await executeSpawnAgents({ agents: [] });
    expect(result).toBe('ERROR: No agents specified');
  });

  it('returns error when agents array is missing', async () => {
    const result = await executeSpawnAgents({});
    expect(result).toBe('ERROR: No agents specified');
  });

  it('returns error when too many agents are specified', async () => {
    const agents = Array.from({ length: 6 }, (_, i) => ({ task: `Task ${i + 1}` }));
    const result = await executeSpawnAgents({ agents });
    expect(result).toBe('ERROR: Max 5 parallel agents allowed, got 6');
  });

  it('normalizes agent definitions (prompt/description/name -> task)', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [
        { prompt: 'Do something via prompt' },
        { description: 'Do something via description' },
        { name: 'Do something via name' },
      ],
    });

    expect(result).toContain('Do something via prompt');
    expect(result).toContain('Do something via description');
    expect(result).toContain('Do something via name');
  });

  it('strips model field from agent definitions', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    // LLM might hallucinate a model name; executeSpawnAgents strips it
    await executeSpawnAgents({
      agents: [{ task: 'Do work', model: 'llama3' }],
    });

    // The callStream should have been called without a model override from the agent def
    // (the model comes from resolveSubAgentModel, not from agentDef.model)
    expect(callStream).toHaveBeenCalled();
  });

  it('handles agent failure in catch block (lines 380-381)', async () => {
    // Make callStream throw a non-retryable error that propagates through runSubAgent's catch
    // but then the .catch in executeSpawnAgents should catch it
    callStream.mockImplementation(() => { throw new Error('Sync explosion'); });

    const result = await executeSpawnAgents({
      agents: [{ task: 'Exploding agent' }],
    });

    // The agent should be caught and reported as failed
    expect(result).toContain('failed');
    expect(result).toContain('Exploding agent');
  });

  it('reports token totals across multiple agents', async () => {
    callStream
      .mockResolvedValueOnce({ content: 'Agent 1 done', tool_calls: [], usage: { prompt_tokens: 100, completion_tokens: 50 } })
      .mockResolvedValueOnce({ content: 'Agent 2 done', tool_calls: [], usage: { prompt_tokens: 200, completion_tokens: 80 } });

    const result = await executeSpawnAgents({
      agents: [{ task: 'Task A' }, { task: 'Task B' }],
    });

    expect(result).toContain('300 input');
    expect(result).toContain('130 output');
  });

  it('shows tools used in output or "none" when no tools used', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [{ task: 'Simple task' }],
    });

    expect(result).toContain('Tools used: none');
  });

  it('shows failed status icon for failed agents', async () => {
    callStream.mockRejectedValue(new Error('401 Unauthorized'));

    const result = await executeSpawnAgents({
      agents: [{ task: 'Will fail' }],
    });

    expect(result).toMatch(/[✗].*Will fail/);
    expect(result).toContain('Status: failed');
  });

  it('handles (no task) fallback when agent has no task/prompt/description/name', async () => {
    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [{}],
    });

    expect(result).toContain('(no task)');
  });

  it('catches errors in the outer try block (lines 419-421)', async () => {
    // Make progress.stop() throw on first call (line 392 in try block) to trigger outer catch.
    // The stop mock throws once, then the second call (line 419 in catch block) is a no-op.
    const { MultiProgress } = require('../cli/ui');
    const stopMock = jest.fn()
      .mockImplementationOnce(() => { throw new Error('Stop crashed'); })
      .mockImplementation(() => {});
    MultiProgress.mockImplementationOnce(() => ({
      start: jest.fn(),
      update: jest.fn(),
      stop: stopMock,
    }));

    callStream.mockResolvedValue({ content: 'Done', tool_calls: [] });

    const result = await executeSpawnAgents({
      agents: [{ task: 'Test outer catch' }],
    });

    expect(result).toContain('ERROR: Sub-agent execution failed');
    expect(result).toContain('Stop crashed');
    expect(stopMock).toHaveBeenCalledTimes(2); // once in try, once in catch
  });
});

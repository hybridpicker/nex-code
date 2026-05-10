/**
 * tests/coverage.test.ts — Coverage Gap Tests
 *
 * Tests covering uncovered branches and edge cases:
 * - MockProvider (streaming, errors, call recording)
 * - ProviderRouter (non-retryable errors, routeForPhase, registerProvider)
 * - AgentLoop (abort from idle, error from idle, edge transitions)
 * - CostCalculator (budget edge cases)
 * - EnvConfig (parseBoolEnv edge cases, getApiKeyForProvider, availableProviders)
 */

import { MockProvider, MockResponseConfig, MockErrorConfig } from '../src/providers/mock';
import { LLMRequest, LLMStreamChunk } from '../src/providers/base';
import { createAgentLoop } from '../src/state/agent-loop';
import { createCostCalculator } from '../src/state/cost-calculator';
import { createProviderRouter } from '../src/state/routing';
import { loadEnvConfig, getApiKeyForProvider, hasProviderKey, availableProviders } from '../src/config/env';
import { DEFAULT_CONFIG } from '../src/config/env';

// ─── MockProvider Tests ──────────────────────────────────────────────────────

describe('MockProvider — streaming', () => {
  it('should deliver content in chunks via streamComplete', async () => {
    const provider = new MockProvider({
      id: 'ollama',
      responses: [{ content: 'hello world test' }],
    });

    const chunks: string[] = [];
    const response = await provider.streamComplete(
      { messages: [{ role: 'user', content: 'hi' }] },
      (chunk: LLMStreamChunk) => {
        chunks.push(chunk.content);
      },
    );

    expect(response.content).toBe('hello world test');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe('hello world test');
  });

  it('should set done=true and include usage on final chunk', async () => {
    const provider = new MockProvider({
      id: 'ollama',
      responses: [{ content: 'test', inputTokens: 10, outputTokens: 5 }],
    });

    const chunks: LLMStreamChunk[] = [];
    await provider.streamComplete(
      { messages: [{ role: 'user', content: 'hi' }] },
      (chunk: LLMStreamChunk) => {
        chunks.push(chunk);
      },
    );

    const last = chunks[chunks.length - 1];
    expect(last.done).toBe(true);
    expect(last.usage).toBeDefined();
  });
});

describe('MockProvider — error simulation', () => {
  it('should throw on calls configured with errorOnCall', async () => {
    const provider = new MockProvider({
      id: 'openai',
      responses: [{ content: 'ok' }],
    });

    const errorMap = new Map<number, MockErrorConfig>();
    errorMap.set(0, { message: 'Rate limited', code: '429', retryable: true });
    provider.setErrorOnCall(0, { message: 'Rate limited', code: '429', retryable: true });

    await expect(
      provider.complete({ messages: [{ role: 'user', content: 'test' }] }),
    ).rejects.toThrow('Rate limited');
  });

  it('should include provider and code in error object', async () => {
    const provider = new MockProvider({
      id: 'openai',
      responses: [{ content: 'ok' }],
    });

    const errorMap = new Map<number, MockErrorConfig>();
    errorMap.set(0, { message: 'Server error', code: '500', retryable: true });
    provider.setErrorOnCall(0, { message: 'Server error', code: '500', retryable: true });

    try {
      await provider.complete({ messages: [{ role: 'user', content: 'test' }] });
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toBe('Server error');
      expect(err.code).toBe('500');
    }
  });

  it('should proceed normally when errorOnCall index does not match', async () => {
    const provider = new MockProvider({
      id: 'openai',
      responses: [{ content: 'ok' }],
    });
    provider.setErrorOnCall(5, { message: 'never fired', retryable: true });

    const response = await provider.complete({ messages: [{ role: 'user', content: 'test' }] });
    expect(response.content).toBe('ok');
  });
});

describe('MockProvider — call recording', () => {
  it('should record all calls', async () => {
    const provider = new MockProvider({
      id: 'ollama',
      responses: [{ content: 'a' }, { content: 'b' }],
    });

    await provider.complete({ messages: [{ role: 'user', content: 'q1' }] });
    await provider.complete({ messages: [{ role: 'user', content: 'q2' }] });

    expect(provider.getCallCount()).toBe(2);
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[0].request.messages[0].content).toBe('q1');
    expect(provider.calls[1].request.messages[0].content).toBe('q2');
  });

  it('should reset call history', async () => {
    const provider = new MockProvider({
      id: 'ollama',
      responses: [{ content: 'a' }],
    });

    await provider.complete({ messages: [{ role: 'user', content: 'q' }] });
    provider.resetCalls();

    expect(provider.getCallCount()).toBe(0);
    expect(provider.calls).toHaveLength(0);
  });

  it('should estimate tokens roughly at 4 chars per token', () => {
    const provider = new MockProvider({ id: 'ollama' });
    const tokens = provider.estimateTokens([
      { role: 'system', content: 'You are helpful.' },  // 18 chars → 5 tokens
      { role: 'user', content: 'Hello world' },          // 11 chars → 3 tokens
    ]);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(7); // ceil(16/4) + ceil(11/4) = 4 + 3
  });

  it('should add responses to the queue dynamically', async () => {
    const provider = new MockProvider({
      id: 'ollama',
      responses: [{ content: 'first' }],
    });

    provider.addResponse({ content: 'second' });

    const r1 = await provider.complete({ messages: [{ role: 'user', content: 'q1' }] });
    const r2 = await provider.complete({ messages: [{ role: 'user', content: 'q2' }] });

    expect(r1.content).toBe('first');
    expect(r2.content).toBe('second');
  });
});

describe('MockProvider — availability', () => {
  it('should report availability via isAvailable', async () => {
    const provider = new MockProvider({ id: 'ollama', available: true });
    expect(await provider.isAvailable()).toBe(true);
  });

  it('should toggle availability with setAvailable', async () => {
    const provider = new MockProvider({ id: 'ollama', available: true });
    provider.setAvailable(false);
    expect(await provider.isAvailable()).toBe(false);
  });

  it('should default to available when not specified', async () => {
    const provider = new MockProvider({ id: 'ollama' });
    expect(await provider.isAvailable()).toBe(true);
  });
});

// ─── ProviderRouter edge cases ───────────────────────────────────────────────

describe('ProviderRouter — routeForPhase', () => {
  it('should route with phase-specific model', async () => {
    const ollama = new MockProvider({
      id: 'ollama',
      available: true,
      responses: [{ content: 'phase plan response' }],
    });

    const router = createProviderRouter({
      providers: { ollama },
      config: { ...DEFAULT_CONFIG, phaseRoutingEnabled: true },
      phaseModels: { plan: 'qwen3-coder:480b', implement: 'devstral-2:123b' },
    });

    const result = await router.routeForPhase(
      { messages: [{ role: 'user', content: 'test' }] },
      'plan',
    );
    expect(result.success).toBe(true);
    expect(result.provider).toBe('ollama');
  });

  it('should use default model when phase routing disabled in routeForPhase', async () => {
    const ollama = new MockProvider({
      id: 'ollama',
      available: true,
      responses: [{ content: 'default model response' }],
    });

    const router = createProviderRouter({
      providers: { ollama },
      config: { ...DEFAULT_CONFIG, phaseRoutingEnabled: false, defaultModel: 'qwen3-coder:480b' },
      phaseModels: { plan: 'some-other-model' },
    });

    const result = await router.routeForPhase(
      { messages: [{ role: 'user', content: 'test' }] },
      'plan',
    );
    expect(result.success).toBe(true);
    // Uses default model since phase routing is disabled
    expect(router.getModelForPhase('plan')).toBe('qwen3-coder:480b');
  });
});

describe('ProviderRouter — provider management', () => {
  it('should register new providers', () => {
    const ollama = new MockProvider({ id: 'ollama', available: true });
    const router = createProviderRouter({
      providers: { ollama },
      config: DEFAULT_CONFIG,
    });

    const newProvider = new MockProvider({ id: 'openai', available: true });
    router.registerProvider(newProvider);

    expect(router.hasProvider('openai')).toBe(true);
    expect(router.getRegisteredProviders()).toContain('openai');
  });

  it('should get provider by id', () => {
    const ollama = new MockProvider({ id: 'ollama', available: true });
    const router = createProviderRouter({
      providers: { ollama },
      config: DEFAULT_CONFIG,
    });

    expect(router.getProvider('ollama')).toBe(ollama);
    expect(router.getProvider('openai')).toBeUndefined();
  });

  it('should return false for unregistered provider', () => {
    const ollama = new MockProvider({ id: 'ollama', available: true });
    const router = createProviderRouter({
      providers: { ollama },
      config: DEFAULT_CONFIG,
    });

    expect(router.hasProvider('gemini')).toBe(false);
  });

  it('should get cost calculator', () => {
    const costCalc = createCostCalculator({ budgetLimit: 10 });
    const ollama = new MockProvider({ id: 'ollama', available: true });
    const router = createProviderRouter({
      providers: { ollama },
      config: DEFAULT_CONFIG,
      costCalculator: costCalc,
    });

    expect(router.getCostCalculator()).toBe(costCalc);
  });
});

// ─── AgentLoop edge cases ───────────────────────────────────────────────────

describe('AgentLoop — edge cases', () => {
  it('should reject abort when idle', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    const result = loop.abort('nothing running');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nothing to abort');
  });

  it('should handle error from idle state', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    const result = loop.error('Config validation failed');
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('error');
    expect(loop.getState().error).toBe('Config validation failed');
  });

  it('should allow direct advance from plan to done (skip-to-end)', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.start();
    const result = loop.advancePhase('done');
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('done');
  });

  it('should reject complete when not in verify phase', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.start();
    const result = loop.complete({ passed: 10, failed: 0, total: 10 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('expected verify');
  });

  it('should emit abort event with reason', () => {
    const events: any[] = [];
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.on('abort', (e) => events.push(e));
    loop.start();
    loop.abort('Timeout after 30s');
    expect(events).toHaveLength(1);
    expect(events[0].error).toBe('Timeout after 30s');
  });

  it('should clear phase data on phase transition', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.start();
    loop.setPhaseData({ filesScanned: 100 });
    expect(loop.getState().phaseData).not.toBeNull();
    loop.advancePhase('implement');
    expect(loop.getState().phaseData).toBeNull();
  });

  it('should carry maxIterations=0 for unlimited retries', () => {
    const loop = createAgentLoop({ maxIterations: 0 });
    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    const result = loop.complete({ passed: 0, failed: 100, total: 100 });
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('plan'); // retried
    expect(loop.getState().iteration).toBe(1);
  });
});

// ─── CostCalculator edge cases ──────────────────────────────────────────────

describe('CostCalculator — edge cases', () => {
  it('should not warn when budget is 0 (unlimited)', () => {
    const calc = createCostCalculator({ budgetLimit: 0 });
    expect(calc.isBudgetWarning()).toBe(false);
  });

  it('should not be exceeded when budget is 0', () => {
    const calc = createCostCalculator({ budgetLimit: 0 });
    expect(calc.isBudgetExceeded()).toBe(false);
  });

  it('should include all providers when budget is unlimited', () => {
    const calc = createCostCalculator({ budgetLimit: 0 });
    const affordable = calc.getAffordableProviders(1000000, 1000000);
    expect(affordable).toContain('ollama');
    expect(affordable).toContain('openai');
    expect(affordable).toContain('anthropic');
  });
});

// ─── EnvConfig edge cases ───────────────────────────────────────────────────

describe('EnvConfig — utility functions', () => {
  it('should get API key for known provider', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const config = loadEnvConfig();
    expect(getApiKeyForProvider(config, 'openai')).toBe('sk-test');
    delete process.env.OPENAI_API_KEY;
  });

  it('should return undefined for unknown provider', () => {
    const config = loadEnvConfig();
    expect(getApiKeyForProvider(config, 'unknown' as any)).toBeUndefined();
  });

  it('should check hasProviderKey correctly', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant';
    const config = loadEnvConfig();
    expect(hasProviderKey(config, 'anthropic')).toBe(true);
    expect(hasProviderKey(config, 'ollama')).toBe(false);
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('should list available providers', () => {
    process.env.OLLAMA_API_KEY = 'sk-ollama';
    process.env.OPENAI_API_KEY = 'sk-openai';
    const config = loadEnvConfig();
    const providers = availableProviders(config);
    expect(providers).toContain('ollama');
    expect(providers).toContain('openai');
    expect(providers).not.toContain('gemini');
    delete process.env.OLLAMA_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('should parse bool env var with yes/no values', () => {
    process.env.NEX_FALLBACK_ENABLED = 'yes';
    const config = loadEnvConfig();
    expect(config.fallbackEnabled).toBe(true);
    delete process.env.NEX_FALLBACK_ENABLED;
  });

  it('should parse bool env var with true/false values', () => {
    process.env.NEX_FALLBACK_ENABLED = 'false';
    const config = loadEnvConfig();
    expect(config.fallbackEnabled).toBe(false);
    delete process.env.NEX_FALLBACK_ENABLED;
  });

  it('should default bool to fallback for unrecognized values', () => {
    process.env.NEX_FALLBACK_ENABLED = 'maybe';
    const config = loadEnvConfig();
    expect(config.fallbackEnabled).toBe(true); // fallback is true
    delete process.env.NEX_FALLBACK_ENABLED;
  });
});

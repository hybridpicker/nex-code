/**
 * tests/routing.test.ts — Provider Routing Layer Tests
 *
 * Rigorous tests for the Ollama-first routing with fallback logic,
 * budget enforcement, phase-based routing, and provider chains.
 */

import { MockProvider } from '../src/providers/mock';
import { LLMProvider, LLMRequest, ChatMessage } from '../src/providers/base';
import {
  ProviderRouter,
  RouteResult,
  createProviderRouter,
  FALLBACK_CHAIN,
} from '../src/state/routing';
import { CostCalculator, createCostCalculator } from '../src/state/cost-calculator';
import { EnvConfig, DEFAULT_CONFIG } from '../src/config/env';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const testRequest: LLMRequest = {
  messages: [{ role: 'user', content: 'Write a function that adds two numbers.' }],
};

function makeProvider(id: string, available: boolean): MockProvider {
  return new MockProvider({
    id: id as any,
    name: id,
    available,
    responses: [{ content: `Response from ${id}` }],
  });
}

// ─── Routing tests ───────────────────────────────────────────────────────────

describe('ProviderRouter — Ollama-first routing', () => {
  let ollama: MockProvider;
  let openai: MockProvider;
  let anthropic: MockProvider;
  let router: ProviderRouter;

  beforeEach(() => {
    ollama = makeProvider('ollama', true);
    openai = makeProvider('openai', true);
    anthropic = makeProvider('anthropic', true);

    router = createProviderRouter({
      providers: { ollama, openai, anthropic },
      config: { ...DEFAULT_CONFIG, defaultProvider: 'ollama' },
    });
  });

  it('should route to Ollama as the default provider', async () => {
    const result = await router.route(testRequest);
    expect(result.success).toBe(true);
    expect(result.provider).toBe('ollama');
    expect(result.fallbackUsed).toBe(false);
  });

  it('should fallback to OpenAI when Ollama is unavailable', async () => {
    ollama.setAvailable(false);
    const result = await router.route(testRequest);
    expect(result.success).toBe(true);
    expect(result.provider).toBe('openai');
    expect(result.fallbackUsed).toBe(true);
  });

  it('should follow fallback chain: Ollama → OpenAI → Anthropic', async () => {
    ollama.setAvailable(false);
    openai.setAvailable(false);
    const result = await router.route(testRequest);
    expect(result.success).toBe(true);
    expect(result.provider).toBe('anthropic');
    expect(result.fallbackUsed).toBe(true);
  });

  it('should fail when all providers are unavailable', async () => {
    ollama.setAvailable(false);
    openai.setAvailable(false);
    anthropic.setAvailable(false);
    const result = await router.route(testRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('No providers available');
  });
});

describe('ProviderRouter — Fallback disabled', () => {
  it('should not fallback when fallbackEnabled is false', async () => {
    const ollama = makeProvider('ollama', false);
    const openai = makeProvider('openai', true);

    const router = createProviderRouter({
      providers: { ollama, openai },
      config: { ...DEFAULT_CONFIG, fallbackEnabled: false },
    });

    const result = await router.route(testRequest);
    expect(result.success).toBe(false);
    expect(result.error!.message).toContain('No providers available');
  });
});

describe('ProviderRouter — Budget enforcement', () => {
  let ollama: MockProvider;
  let openai: MockProvider;
  let costCalc: CostCalculator;

  beforeEach(() => {
    ollama = makeProvider('ollama', true);
    openai = makeProvider('openai', true);
  });

  it('should block premium providers when budget is exceeded', async () => {
    costCalc = createCostCalculator({ budgetLimit: 0.01 });
    costCalc.recordUsage('openai', 50000, 50000); // ~$0.90 — way over

    const router = createProviderRouter({
      providers: { ollama, openai },
      config: { ...DEFAULT_CONFIG, budgetLimit: 0.01 },
      costCalculator: costCalc,
    });

    const result = await router.route(testRequest);
    expect(result.success).toBe(true);
    // Should still use Ollama since premium is blocked
    expect(result.provider).toBe('ollama');
  });

  it('should allow premium when under budget', async () => {
    costCalc = createCostCalculator({ budgetLimit: 50 });

    const router = createProviderRouter({
      providers: { ollama, openai },
      config: { ...DEFAULT_CONFIG, budgetLimit: 50 },
      costCalculator: costCalc,
    });

    ollama.setAvailable(false);
    const result = await router.route(testRequest);
    expect(result.success).toBe(true);
    expect(result.provider).toBe('openai');
  });

  it('should block premium but still allow Ollama when over budget', async () => {
    costCalc = createCostCalculator({ budgetLimit: 0.01 });
    costCalc.recordUsage('openai', 50000, 50000);

    const router = createProviderRouter({
      providers: { ollama, openai },
      config: { ...DEFAULT_CONFIG, budgetLimit: 0.01 },
      costCalculator: costCalc,
    });

    const result = await router.route(testRequest);
    // Ollama should work even when premium is blocked
    expect(result.success).toBe(true);
    expect(result.provider).toBe('ollama');
  });
});

describe('ProviderRouter — Phase-based routing', () => {
  let ollama: MockProvider;
  let openai: MockProvider;

  beforeEach(() => {
    ollama = makeProvider('ollama', true);
    openai = makeProvider('openai', true);
  });

  it('should select phase-specific model when phase routing is enabled', () => {
    const router = createProviderRouter({
      providers: { ollama, openai },
      config: {
        ...DEFAULT_CONFIG,
        defaultProvider: 'ollama',
        defaultModel: 'qwen3-coder:480b',
        phaseRoutingEnabled: true,
      },
      phaseModels: {
        plan: 'qwen3-coder:480b',
        implement: 'devstral-2:123b',
        verify: 'devstral-small-2:24b',
      },
    });

    const model = router.getModelForPhase('plan');
    expect(model).toBe('qwen3-coder:480b');
  });

  it('should fallback to default model when phase has no specific model', () => {
    const router = createProviderRouter({
      providers: { ollama, openai },
      config: {
        ...DEFAULT_CONFIG,
        defaultModel: 'qwen3-coder:480b',
      },
      phaseModels: {
        plan: 'qwen3-coder:480b',
        implement: null,
        verify: 'devstral-small-2:24b',
      },
    });

    const model = router.getModelForPhase('implement');
    expect(model).toBe('qwen3-coder:480b');
  });

  it('should use default model when phase routing is disabled', () => {
    const router = createProviderRouter({
      providers: { ollama, openai },
      config: {
        ...DEFAULT_CONFIG,
        defaultModel: 'qwen3-coder:480b',
        phaseRoutingEnabled: false,
      },
      phaseModels: {
        plan: 'some-other-model',
      },
    });

    const model = router.getModelForPhase('plan');
    expect(model).toBe('qwen3-coder:480b');
  });
});

describe('ProviderRouter — Call recording', () => {
  it('should record successful calls', async () => {
    const ollama = makeProvider('ollama', true);
    const router = createProviderRouter({
      providers: { ollama },
      config: DEFAULT_CONFIG,
    });

    const result = await router.route(testRequest);
    expect(result.success).toBe(true);
    expect(ollama.getCallCount()).toBe(1);
  });

  it('should not record calls to unavailable providers', async () => {
    const ollama = makeProvider('ollama', false);
    const openai = makeProvider('openai', true);

    const router = createProviderRouter({
      providers: { ollama, openai },
      config: DEFAULT_CONFIG,
    });

    await router.route(testRequest);
    expect(ollama.getCallCount()).toBe(0);
    expect(openai.getCallCount()).toBe(1);
  });
});

describe('FALLBACK_CHAIN', () => {
  it('should have Ollama as first in fallback chain', () => {
    expect(FALLBACK_CHAIN[0]).toBe('ollama');
  });

  it('should have all providers in the chain', () => {
    expect(FALLBACK_CHAIN).toContain('ollama');
    expect(FALLBACK_CHAIN).toContain('openai');
    expect(FALLBACK_CHAIN).toContain('anthropic');
    expect(FALLBACK_CHAIN).toContain('gemini');
    expect(FALLBACK_CHAIN).toContain('deepseek');
  });
});

/**
 * tests/cost-calculator.test.ts — Cost Calculator Tests
 *
 * Tests for budget tracking, token cost computation across providers,
 * budget enforcement (warning/block), and session cost accumulation.
 *
 * Pricing model:
 *   - Ollama (local):    $0.00 — completely free
 *   - Ollama Cloud:      $0.00 per call — subscription-based
 *   - Premium providers: Per-1K-token pricing, counts against budget
 */

import {
  CostCalculator,
  ProviderPricing,
  CostSnapshot,
  createCostCalculator,
  DEFAULT_PRICING,
} from '../src/state/cost-calculator';

// ─── Pricing fixtures ────────────────────────────────────────────────────────

const testPricing: ProviderPricing = {
  ollama: { inputPer1k: 0, outputPer1k: 0 },
  openai: { inputPer1k: 0.003, outputPer1k: 0.015 },
  anthropic: { inputPer1k: 0.003, outputPer1k: 0.015 },
  gemini: { inputPer1k: 0.000125, outputPer1k: 0.000375 },
  deepseek: { inputPer1k: 0.00014, outputPer1k: 0.00028 },
};

describe('CostCalculator — Token cost computation', () => {
  let calc: CostCalculator;

  beforeEach(() => {
    calc = createCostCalculator({ pricing: testPricing });
  });

  it('should return $0 for Ollama (local free, cloud subscription)', () => {
    const cost = calc.computeCost('ollama', 500000, 200000);
    expect(cost).toBe(0);
  });

  it('should return $0 for Ollama even with large token counts', () => {
    const cost = calc.computeCost('ollama', 10000000, 5000000);
    expect(cost).toBe(0);
  });

  it('should compute cost for OpenAI (premium)', () => {
    const cost = calc.computeCost('openai', 5000, 2000);
    expect(cost).toBeCloseTo(0.045, 5);
  });

  it('should compute cost for Gemini (near-free premium)', () => {
    const cost = calc.computeCost('gemini', 5000, 2000);
    expect(cost).toBeCloseTo(0.001375, 5);
  });

  it('should compute cost for DeepSeek', () => {
    const cost = calc.computeCost('deepseek', 5000, 2000);
    expect(cost).toBeCloseTo(0.00126, 5);
  });

  it('should return 0 for zero tokens on premium', () => {
    const cost = calc.computeCost('openai', 0, 0);
    expect(cost).toBe(0);
  });

  it('should throw for unknown provider', () => {
    expect(() => calc.computeCost('unknown' as any, 100, 100)).toThrow(
      'No pricing for provider: unknown',
    );
  });
});

describe('CostCalculator — Budget tracking', () => {
  let calc: CostCalculator;

  beforeEach(() => {
    calc = createCostCalculator({
      pricing: testPricing,
      budgetLimit: 10.0,
    });
  });

  it('should start with zero used budget', () => {
    const snapshot = calc.getSnapshot();
    expect(snapshot.used).toBe(0);
    expect(snapshot.remaining).toBe(10.0);
  });

  it('should NOT charge budget for Ollama calls', () => {
    calc.recordUsage('ollama', 1000000, 1000000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.used).toBe(0);
    expect(snapshot.totalInputTokens).toBe(1000000);
    expect(snapshot.usageCount).toBe(1);
  });

  it('should track cumulative premium cost after recording usage', () => {
    calc.recordUsage('openai', 10000, 5000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.used).toBeGreaterThan(0);
    expect(snapshot.usageCount).toBe(1);
  });

  it('should decrease remaining budget after premium usage', () => {
    calc.recordUsage('openai', 10000, 5000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.remaining).toBeCloseTo(10.0 - snapshot.used, 5);
    expect(snapshot.remaining).toBeLessThan(10.0);
  });

  it('should NOT decrease budget after Ollama usage', () => {
    calc.recordUsage('ollama', 10000, 5000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.remaining).toBe(10.0);
    expect(snapshot.used).toBe(0);
  });

  it('should warn when approaching budget limit on premium', () => {
    // Use ~$8.40 of a $10.00 budget
    calc.recordUsage('openai', 200000, 100000);
    calc.recordUsage('openai', 200000, 100000);
    calc.recordUsage('openai', 200000, 100000);
    calc.recordUsage('openai', 200000, 100000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.used).toBeGreaterThan(7.0);
    expect(snapshot.warning).toBe(true);
  });

  it('should NOT warn when heavy Ollama usage but no premium spend', () => {
    calc.recordUsage('ollama', 10000000, 5000000);
    calc.recordUsage('ollama', 10000000, 5000000);
    calc.recordUsage('ollama', 10000000, 5000000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.warning).toBe(false);
    expect(snapshot.blocked).toBe(false);
  });

  it('should block premium when budget is exceeded', () => {
    // 700k input + 700k output = $2.10 + $10.50 = $12.60 > $10 budget
    calc.recordUsage('openai', 700000, 700000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.blocked).toBe(true);
  });

  it('should NOT block Ollama when premium budget is exceeded', () => {
    calc.recordUsage('openai', 700000, 700000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.blocked).toBe(true);
    // But Ollama is still affordable
    const affordable = calc.getAffordableProviders(100000, 50000);
    expect(affordable).toContain('ollama');
  });

  it('should return Ollama as affordable even when budget is exceeded', () => {
    calc.recordUsage('openai', 700000, 700000);
    const affordable = calc.getAffordableProviders(100000, 50000);
    expect(affordable).toContain('ollama');
    expect(affordable).not.toContain('openai');
    expect(affordable).not.toContain('anthropic');
  });

  it('should allow unlimited budget when limit is 0', () => {
    const unlimited = createCostCalculator({
      pricing: testPricing,
      budgetLimit: 0,
    });
    unlimited.recordUsage('openai', 1000000, 1000000);
    const snapshot = unlimited.getSnapshot();
    expect(snapshot.blocked).toBe(false);
    expect(snapshot.warning).toBe(false);
  });
});

describe('CostCalculator — Ollama subscription model', () => {
  it('should default to no subscription (local Ollama)', () => {
    const calc = createCostCalculator({ pricing: testPricing });
    expect(calc.getOllamaSubscription()).toBe(0);
    expect(calc.isCloudSubscription()).toBe(false);
  });

  it('should track Ollama Cloud subscription separately', () => {
    const calc = createCostCalculator({
      pricing: testPricing,
      ollamaSubscription: 25.0,
    });
    expect(calc.getOllamaSubscription()).toBe(25.0);
    expect(calc.isCloudSubscription()).toBe(true);
  });

  it('should include subscription in total cost', () => {
    const calc = createCostCalculator({
      pricing: testPricing,
      budgetLimit: 50,
      ollamaSubscription: 25.0,
    });
    calc.recordUsage('openai', 100000, 50000); // ~$1.05
    expect(calc.getTotalCost()).toBeCloseTo(26.05, 2);
  });

  it('should NOT count subscription against premium budget', () => {
    const calc = createCostCalculator({
      pricing: testPricing,
      budgetLimit: 50,
      ollamaSubscription: 25.0,
    });
    calc.recordUsage('openai', 100000, 50000);
    const snapshot = calc.getSnapshot();
    // Budget used should only reflect premium API calls, not subscription
    expect(snapshot.used).toBeLessThan(5);
    expect(snapshot.ollamaSubscription).toBe(25.0);
  });

  it('should allow changing subscription at runtime', () => {
    const calc = createCostCalculator({ pricing: testPricing });
    expect(calc.isCloudSubscription()).toBe(false);
    calc.setOllamaSubscription(30.0);
    expect(calc.isCloudSubscription()).toBe(true);
    expect(calc.getOllamaSubscription()).toBe(30.0);
  });
});

describe('CostCalculator — Usage statistics', () => {
  let calc: CostCalculator;

  beforeEach(() => {
    calc = createCostCalculator({ pricing: testPricing, budgetLimit: 50 });
  });

  it('should track total input/output tokens', () => {
    calc.recordUsage('ollama', 5000, 2000);
    calc.recordUsage('openai', 3000, 1000);
    const snapshot = calc.getSnapshot();
    expect(snapshot.totalInputTokens).toBe(8000);
    expect(snapshot.totalOutputTokens).toBe(3000);
  });

  it('should track per-provider usage with $0 cost for Ollama', () => {
    calc.recordUsage('ollama', 5000, 2000);
    calc.recordUsage('ollama', 3000, 1000);
    calc.recordUsage('openai', 1000, 500);

    const snapshot = calc.getSnapshot();
    expect(snapshot.providerUsage.ollama?.inputTokens).toBe(8000);
    expect(snapshot.providerUsage.ollama?.outputTokens).toBe(3000);
    expect(snapshot.providerUsage.ollama?.cost).toBe(0); // Always $0
    expect(snapshot.providerUsage.openai?.inputTokens).toBe(1000);
    expect(snapshot.providerUsage.openai?.outputTokens).toBe(500);
    expect(snapshot.providerUsage.openai?.cost).toBeGreaterThan(0);
    expect(snapshot.providerUsage.anthropic).toBeUndefined();
  });

  it('should track usage count', () => {
    calc.recordUsage('ollama', 100, 100);
    calc.recordUsage('ollama', 100, 100);
    calc.recordUsage('openai', 100, 100);
    expect(calc.getSnapshot().usageCount).toBe(3);
  });

  it('should reset all stats', () => {
    calc.recordUsage('ollama', 5000, 2000);
    calc.reset();
    const snapshot = calc.getSnapshot();
    expect(snapshot.used).toBe(0);
    expect(snapshot.totalInputTokens).toBe(0);
    expect(snapshot.usageCount).toBe(0);
  });
});

describe('CostCalculator — DEFAULT_PRICING', () => {
  it('should have pricing for all supported providers', () => {
    expect(DEFAULT_PRICING.ollama).toBeDefined();
    expect(DEFAULT_PRICING.openai).toBeDefined();
    expect(DEFAULT_PRICING.anthropic).toBeDefined();
    expect(DEFAULT_PRICING.gemini).toBeDefined();
    expect(DEFAULT_PRICING.deepseek).toBeDefined();
  });

  it('should have Ollama at $0 for both input and output', () => {
    expect(DEFAULT_PRICING.ollama.inputPer1k).toBe(0);
    expect(DEFAULT_PRICING.ollama.outputPer1k).toBe(0);
  });

  it('should have OpenAI as the most expensive', () => {
    const ollamaInput = DEFAULT_PRICING.ollama.inputPer1k;
    const openaiInput = DEFAULT_PRICING.openai.inputPer1k;
    expect(ollamaInput).toBeLessThan(openaiInput);
  });
});

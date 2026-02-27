const {
  PRICING,
  trackUsage,
  getSessionCosts,
  formatCosts,
  formatCostHint,
  resetCosts,
  getPricing,
} = require('../cli/costs');

describe('costs.js', () => {
  beforeEach(() => {
    resetCosts();
  });

  // ─── PRICING ───────────────────────────────────────────────
  describe('PRICING', () => {
    it('has pricing for openai models', () => {
      expect(PRICING.openai['gpt-4o']).toBeDefined();
      expect(PRICING.openai['gpt-4o'].input).toBe(2.5);
      expect(PRICING.openai['gpt-4o'].output).toBe(10.0);
    });

    it('has pricing for anthropic models', () => {
      expect(PRICING.anthropic['claude-sonnet']).toBeDefined();
      expect(PRICING.anthropic['claude-opus'].input).toBe(15.0);
    });

    it('has zero pricing for ollama models', () => {
      expect(PRICING.ollama['kimi-k2.5'].input).toBe(0);
      expect(PRICING.ollama['kimi-k2.5'].output).toBe(0);
    });

    it('has empty pricing for local provider', () => {
      expect(PRICING.local).toEqual({});
    });
  });

  // ─── getPricing ────────────────────────────────────────────
  describe('getPricing()', () => {
    it('returns correct pricing for known model', () => {
      const p = getPricing('openai', 'gpt-4o');
      expect(p.input).toBe(2.5);
      expect(p.output).toBe(10.0);
    });

    it('returns zero pricing for unknown provider', () => {
      const p = getPricing('unknown-provider', 'some-model');
      expect(p).toEqual({ input: 0, output: 0 });
    });

    it('returns zero pricing for unknown model', () => {
      const p = getPricing('openai', 'unknown-model');
      expect(p).toEqual({ input: 0, output: 0 });
    });

    it('returns zero pricing for local provider models', () => {
      const p = getPricing('local', 'llama3');
      expect(p).toEqual({ input: 0, output: 0 });
    });
  });

  // ─── trackUsage ────────────────────────────────────────────
  describe('trackUsage()', () => {
    it('records usage entry', () => {
      trackUsage('openai', 'gpt-4o', 1000, 500);
      const costs = getSessionCosts();
      expect(costs.totalInput).toBe(1000);
      expect(costs.totalOutput).toBe(500);
    });

    it('accumulates multiple entries', () => {
      trackUsage('openai', 'gpt-4o', 1000, 500);
      trackUsage('openai', 'gpt-4o', 2000, 1000);
      const costs = getSessionCosts();
      expect(costs.totalInput).toBe(3000);
      expect(costs.totalOutput).toBe(1500);
    });

    it('tracks different providers separately', () => {
      trackUsage('openai', 'gpt-4o', 1000, 500);
      trackUsage('anthropic', 'claude-sonnet', 2000, 1000);
      const costs = getSessionCosts();
      expect(costs.breakdown).toHaveLength(2);
    });
  });

  // ─── getSessionCosts ──────────────────────────────────────
  describe('getSessionCosts()', () => {
    it('returns zero totals when no usage', () => {
      const costs = getSessionCosts();
      expect(costs.totalCost).toBe(0);
      expect(costs.totalInput).toBe(0);
      expect(costs.totalOutput).toBe(0);
      expect(costs.breakdown).toEqual([]);
    });

    it('calculates cost correctly for openai', () => {
      trackUsage('openai', 'gpt-4o', 1_000_000, 1_000_000);
      const costs = getSessionCosts();
      // 1M input * $2.50/1M + 1M output * $10.00/1M = $12.50
      expect(costs.totalCost).toBeCloseTo(12.5, 2);
    });

    it('calculates cost correctly for anthropic', () => {
      trackUsage('anthropic', 'claude-opus', 100_000, 50_000);
      const costs = getSessionCosts();
      // 100k * $15/1M + 50k * $75/1M = $1.50 + $3.75 = $5.25
      expect(costs.totalCost).toBeCloseTo(5.25, 2);
    });

    it('returns zero cost for free providers', () => {
      trackUsage('ollama', 'kimi-k2.5', 100_000, 50_000);
      const costs = getSessionCosts();
      expect(costs.totalCost).toBe(0);
    });

    it('aggregates same provider:model entries', () => {
      trackUsage('openai', 'gpt-4o', 500, 200);
      trackUsage('openai', 'gpt-4o', 300, 100);
      const costs = getSessionCosts();
      expect(costs.breakdown).toHaveLength(1);
      expect(costs.breakdown[0].input).toBe(800);
      expect(costs.breakdown[0].output).toBe(300);
    });
  });

  // ─── formatCosts ──────────────────────────────────────────
  describe('formatCosts()', () => {
    it('returns message when no usage', () => {
      expect(formatCosts()).toContain('No token usage');
    });

    it('formats usage with cost', () => {
      trackUsage('openai', 'gpt-4o', 10000, 5000);
      const output = formatCosts();
      expect(output).toContain('openai:gpt-4o');
      expect(output).toContain('Input:');
      expect(output).toContain('Output:');
      expect(output).toContain('$');
      expect(output).toContain('Total:');
    });

    it('shows free for zero-cost models', () => {
      trackUsage('ollama', 'kimi-k2.5', 10000, 5000);
      const output = formatCosts();
      expect(output).toContain('free');
    });
  });

  // ─── formatCostHint ───────────────────────────────────────
  describe('formatCostHint()', () => {
    it('returns cost hint for paid models', () => {
      const hint = formatCostHint('openai', 'gpt-4o', 1000, 500);
      expect(hint).toMatch(/\[~\$[\d.]+\]/);
    });

    it('returns empty string for free models', () => {
      const hint = formatCostHint('ollama', 'kimi-k2.5', 1000, 500);
      expect(hint).toBe('');
    });

    it('returns empty string for unknown models', () => {
      const hint = formatCostHint('local', 'llama3', 1000, 500);
      expect(hint).toBe('');
    });
  });

  // ─── resetCosts ───────────────────────────────────────────
  describe('resetCosts()', () => {
    it('clears all tracked usage', () => {
      trackUsage('openai', 'gpt-4o', 10000, 5000);
      expect(getSessionCosts().totalInput).toBe(10000);
      resetCosts();
      expect(getSessionCosts().totalInput).toBe(0);
      expect(getSessionCosts().breakdown).toEqual([]);
    });
  });
});

const {
  PRICING,
  trackUsage,
  getSessionCosts,
  formatCosts,
  formatCostHint,
  resetCosts,
  getPricing,
  setCostLimit,
  removeCostLimit,
  getCostLimits,
  getProviderSpend,
  checkBudget,
  resetCostLimits,
} = require("../cli/costs");

describe("costs.js", () => {
  beforeEach(() => {
    resetCosts();
    resetCostLimits();
  });

  // ─── PRICING ───────────────────────────────────────────────
  describe("PRICING", () => {
    it("has pricing for openai models", () => {
      expect(PRICING.openai["gpt-4o"]).toBeDefined();
      expect(PRICING.openai["gpt-4o"].input).toBe(2.5);
      expect(PRICING.openai["gpt-4o"].output).toBe(10.0);
    });

    it("has pricing for anthropic models", () => {
      expect(PRICING.anthropic["claude-sonnet"]).toBeDefined();
      expect(PRICING.anthropic["claude-opus"].input).toBe(5.0);
    });

    it("has zero pricing for ollama models", () => {
      expect(PRICING.ollama["kimi-k2.5"].input).toBe(0);
      expect(PRICING.ollama["kimi-k2.5"].output).toBe(0);
    });

    it("has pricing for gemini models", () => {
      expect(PRICING.gemini["gemini-2.5-pro"]).toBeDefined();
      expect(PRICING.gemini["gemini-2.5-pro"].input).toBe(1.25);
      expect(PRICING.gemini["gemini-2.5-pro"].output).toBe(10.0);
      expect(PRICING.gemini["gemini-2.5-flash"].input).toBe(0.15);
      expect(PRICING.gemini["gemini-2.0-flash"].input).toBe(0.1);
      expect(PRICING.gemini["gemini-2.0-flash-lite"].input).toBe(0.075);
    });

    it("has pricing for new openai models", () => {
      expect(PRICING.openai["gpt-4.1"].input).toBe(2.0);
      expect(PRICING.openai["gpt-4.1"].output).toBe(8.0);
      expect(PRICING.openai["gpt-4.1-mini"].input).toBe(0.4);
      expect(PRICING.openai["gpt-4.1-nano"].input).toBe(0.1);
      expect(PRICING.openai["o4-mini"].input).toBe(1.1);
    });

    it("has pricing for new anthropic models", () => {
      expect(PRICING.anthropic["claude-sonnet-4-5"].input).toBe(3.0);
      expect(PRICING.anthropic["claude-sonnet-4"].input).toBe(3.0);
    });

    it("has zero pricing for new ollama models", () => {
      expect(PRICING.ollama["deepseek-v3.2"].input).toBe(0);
      expect(PRICING.ollama["gpt-oss:120b"].input).toBe(0);
      expect(PRICING.ollama["minimax-m2.5"].input).toBe(0);
      expect(PRICING.ollama["devstral-2:123b"].input).toBe(0);
    });

    it("has empty pricing for local provider", () => {
      expect(PRICING.local).toEqual({});
    });
  });

  // ─── getPricing ────────────────────────────────────────────
  describe("getPricing()", () => {
    it("returns correct pricing for known model", () => {
      const p = getPricing("openai", "gpt-4o");
      expect(p.input).toBe(2.5);
      expect(p.output).toBe(10.0);
    });

    it("returns zero pricing for unknown provider", () => {
      const p = getPricing("unknown-provider", "some-model");
      expect(p).toEqual({ input: 0, output: 0 });
    });

    it("returns zero pricing for unknown model", () => {
      const p = getPricing("openai", "unknown-model");
      expect(p).toEqual({ input: 0, output: 0 });
    });

    it("returns zero pricing for local provider models", () => {
      const p = getPricing("local", "llama3");
      expect(p).toEqual({ input: 0, output: 0 });
    });
  });

  // ─── trackUsage ────────────────────────────────────────────
  describe("trackUsage()", () => {
    it("records usage entry", () => {
      trackUsage("openai", "gpt-4o", 1000, 500);
      const costs = getSessionCosts();
      expect(costs.totalInput).toBe(1000);
      expect(costs.totalOutput).toBe(500);
    });

    it("accumulates multiple entries", () => {
      trackUsage("openai", "gpt-4o", 1000, 500);
      trackUsage("openai", "gpt-4o", 2000, 1000);
      const costs = getSessionCosts();
      expect(costs.totalInput).toBe(3000);
      expect(costs.totalOutput).toBe(1500);
    });

    it("tracks different providers separately", () => {
      trackUsage("openai", "gpt-4o", 1000, 500);
      trackUsage("anthropic", "claude-sonnet", 2000, 1000);
      const costs = getSessionCosts();
      expect(costs.breakdown).toHaveLength(2);
    });
  });

  // ─── getSessionCosts ──────────────────────────────────────
  describe("getSessionCosts()", () => {
    it("returns zero totals when no usage", () => {
      const costs = getSessionCosts();
      expect(costs.totalCost).toBe(0);
      expect(costs.totalInput).toBe(0);
      expect(costs.totalOutput).toBe(0);
      expect(costs.breakdown).toEqual([]);
    });

    it("calculates cost correctly for openai", () => {
      trackUsage("openai", "gpt-4o", 1_000_000, 1_000_000);
      const costs = getSessionCosts();
      // 1M input * $2.50/1M + 1M output * $10.00/1M = $12.50
      expect(costs.totalCost).toBeCloseTo(12.5, 2);
    });

    it("calculates cost correctly for anthropic", () => {
      trackUsage("anthropic", "claude-opus", 100_000, 50_000);
      const costs = getSessionCosts();
      // 100k * $5/1M + 50k * $25/1M = $0.50 + $1.25 = $1.75
      expect(costs.totalCost).toBeCloseTo(1.75, 2);
    });

    it("returns zero cost for free providers", () => {
      trackUsage("ollama", "kimi-k2.5", 100_000, 50_000);
      const costs = getSessionCosts();
      expect(costs.totalCost).toBe(0);
    });

    it("aggregates same provider:model entries", () => {
      trackUsage("openai", "gpt-4o", 500, 200);
      trackUsage("openai", "gpt-4o", 300, 100);
      const costs = getSessionCosts();
      expect(costs.breakdown).toHaveLength(1);
      expect(costs.breakdown[0].input).toBe(800);
      expect(costs.breakdown[0].output).toBe(300);
    });
  });

  // ─── formatCosts ──────────────────────────────────────────
  describe("formatCosts()", () => {
    it("returns message when no usage", () => {
      expect(formatCosts()).toContain("No token usage");
    });

    it("formats usage with cost", () => {
      trackUsage("openai", "gpt-4o", 10000, 5000);
      const output = formatCosts();
      expect(output).toContain("openai:gpt-4o");
      expect(output).toContain("Input:");
      expect(output).toContain("Output:");
      expect(output).toContain("$");
      expect(output).toContain("Total:");
    });

    it("shows free for zero-cost models", () => {
      trackUsage("ollama", "kimi-k2.5", 10000, 5000);
      const output = formatCosts();
      expect(output).toContain("free");
    });
  });

  // ─── formatCostHint ───────────────────────────────────────
  describe("formatCostHint()", () => {
    it("returns cost hint for paid models", () => {
      const hint = formatCostHint("openai", "gpt-4o", 1000, 500);
      expect(hint).toMatch(/\[~\$[\d.]+\]/);
    });

    it("returns empty string for free models", () => {
      const hint = formatCostHint("ollama", "kimi-k2.5", 1000, 500);
      expect(hint).toBe("");
    });

    it("returns empty string for unknown models", () => {
      const hint = formatCostHint("local", "llama3", 1000, 500);
      expect(hint).toBe("");
    });
  });

  // ─── resetCosts ───────────────────────────────────────────
  describe("resetCosts()", () => {
    it("clears all tracked usage", () => {
      trackUsage("openai", "gpt-4o", 10000, 5000);
      expect(getSessionCosts().totalInput).toBe(10000);
      resetCosts();
      expect(getSessionCosts().totalInput).toBe(0);
      expect(getSessionCosts().breakdown).toEqual([]);
    });
  });

  // ─── Cost Limits ─────────────────────────────────────────
  describe("setCostLimit()", () => {
    it("sets a cost limit for a provider", () => {
      setCostLimit("anthropic", 5.0);
      const limits = getCostLimits();
      expect(limits.anthropic).toBe(5.0);
    });

    it("overwrites existing limit", () => {
      setCostLimit("anthropic", 5.0);
      setCostLimit("anthropic", 10.0);
      expect(getCostLimits().anthropic).toBe(10.0);
    });
  });

  describe("removeCostLimit()", () => {
    it("removes a cost limit", () => {
      setCostLimit("anthropic", 5.0);
      removeCostLimit("anthropic");
      expect(getCostLimits().anthropic).toBeUndefined();
    });

    it("is a no-op for non-existent limit", () => {
      removeCostLimit("nonexistent");
      expect(getCostLimits().nonexistent).toBeUndefined();
    });
  });

  describe("getCostLimits()", () => {
    it("returns empty object initially", () => {
      expect(getCostLimits()).toEqual({});
    });

    it("returns all set limits", () => {
      setCostLimit("anthropic", 5.0);
      setCostLimit("openai", 10.0);
      const limits = getCostLimits();
      expect(limits).toEqual({ anthropic: 5.0, openai: 10.0 });
    });

    it("returns a copy (not reference)", () => {
      setCostLimit("anthropic", 5.0);
      const limits = getCostLimits();
      limits.anthropic = 999;
      expect(getCostLimits().anthropic).toBe(5.0);
    });
  });

  describe("getProviderSpend()", () => {
    it("returns 0 when no usage", () => {
      expect(getProviderSpend("openai")).toBe(0);
    });

    it("returns total spend for a provider", () => {
      trackUsage("openai", "gpt-4o", 1_000_000, 1_000_000);
      const spend = getProviderSpend("openai");
      // 1M * $2.50/1M + 1M * $10.00/1M = $12.50
      expect(spend).toBeCloseTo(12.5, 2);
    });

    it("only counts specified provider", () => {
      trackUsage("openai", "gpt-4o", 1000, 500);
      trackUsage("anthropic", "claude-sonnet", 2000, 1000);
      const spend = getProviderSpend("openai");
      const anthropicSpend = getProviderSpend("anthropic");
      expect(spend).toBeGreaterThan(0);
      expect(anthropicSpend).toBeGreaterThan(0);
      expect(spend).not.toBe(anthropicSpend);
    });
  });

  describe("checkBudget()", () => {
    it("returns allowed=true when no limit set", () => {
      const budget = checkBudget("openai");
      expect(budget.allowed).toBe(true);
      expect(budget.limit).toBeNull();
      expect(budget.remaining).toBeNull();
    });

    it("returns allowed=true when under budget", () => {
      setCostLimit("openai", 100.0);
      trackUsage("openai", "gpt-4o", 1000, 500);
      const budget = checkBudget("openai");
      expect(budget.allowed).toBe(true);
      expect(budget.limit).toBe(100.0);
      expect(budget.remaining).toBeGreaterThan(0);
    });

    it("returns allowed=false when over budget", () => {
      setCostLimit("openai", 0.001);
      trackUsage("openai", "gpt-4o", 1_000_000, 1_000_000);
      const budget = checkBudget("openai");
      expect(budget.allowed).toBe(false);
      expect(budget.spent).toBeCloseTo(12.5, 2);
      expect(budget.remaining).toBe(0);
    });

    it("returns correct remaining amount", () => {
      setCostLimit("anthropic", 10.0);
      trackUsage("anthropic", "claude-opus", 100_000, 50_000);
      const budget = checkBudget("anthropic");
      // Spent: $0.50 + $1.25 = $1.75
      expect(budget.spent).toBeCloseTo(1.75, 2);
      expect(budget.remaining).toBeCloseTo(8.25, 2);
    });
  });

  describe("resetCostLimits()", () => {
    it("clears all cost limits", () => {
      setCostLimit("anthropic", 5.0);
      setCostLimit("openai", 10.0);
      resetCostLimits();
      expect(getCostLimits()).toEqual({});
    });
  });

  describe("trackUsage() budget warning", () => {
    it("writes warning to stderr when budget exceeded", () => {
      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation();
      setCostLimit("openai", 0.001);
      trackUsage("openai", "gpt-4o", 1_000_000, 1_000_000);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Budget limit reached"),
      );
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("openai"),
      );
      stderrSpy.mockRestore();
    });

    it("does not warn when within budget", () => {
      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation();
      setCostLimit("openai", 100.0);
      trackUsage("openai", "gpt-4o", 1000, 500);
      const budgetCalls = stderrSpy.mock.calls.filter(
        ([msg]) => typeof msg === "string" && msg.includes("Budget limit reached"),
      );
      expect(budgetCalls).toHaveLength(0);
      stderrSpy.mockRestore();
    });
  });
});

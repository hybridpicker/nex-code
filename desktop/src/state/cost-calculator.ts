/**
 * src/state/cost-calculator.ts — Cost Calculator
 *
 * Tracks token usage, computes costs per provider, enforces budget limits,
 * and provides affordability checks for routing decisions.
 *
 * Pricing model:
 *   - Ollama (local):      $0.00 per call — completely free
 *   - Ollama Cloud:         $0.00 per call — subscription-based (flat monthly fee)
 *   - Premium providers:    Per-1K-token pricing, counts against budget
 *
 * Budget only applies to premium providers. Ollama is never blocked.
 * Warning threshold: 80% of budget. Block premium at 100%.
 */

import type { ProviderId } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Per-1K-token pricing for a provider */
export interface ProviderRate {
  /** Cost per 1000 input tokens (USD) */
  inputPer1k: number;
  /** Cost per 1000 output tokens (USD) */
  outputPer1k: number;
}

/** Pricing for all supported providers */
export type ProviderPricing = Record<ProviderId, ProviderRate>;

/** Per-provider usage statistics */
export interface ProviderUsageStats {
  inputTokens: number;
  outputTokens: number;
  /** Per-call cost (0 for Ollama, computed for premium) */
  cost: number;
  calls: number;
}

/** Full cost snapshot for UI rendering */
export interface CostSnapshot {
  /** Total USD spent on premium providers this session */
  used: number;
  /** Remaining budget (0 if unlimited or no budget set) */
  remaining: number;
  /** Budget limit for premium providers (0 = unlimited) */
  limit: number;
  /** Ollama Cloud monthly subscription cost (0 if local-only) */
  ollamaSubscription: number;
  /** Warning flag (≥80% of premium budget used) */
  warning: boolean;
  /** Blocked flag (≥100% of premium budget used — blocks premium only) */
  blocked: boolean;
  /** Total input tokens across all providers */
  totalInputTokens: number;
  /** Total output tokens across all providers */
  totalOutputTokens: number;
  /** Number of API calls */
  usageCount: number;
  /** Per-provider breakdown */
  providerUsage: Partial<Record<ProviderId, ProviderUsageStats>>;
}

/** Cost calculator configuration */
export interface CostConfig {
  pricing: ProviderPricing;
  budgetLimit?: number;
  /** Ollama Cloud monthly subscription cost (0 = local only, no subscription) */
  ollamaSubscription?: number;
  /** Budget warning threshold (0-1), default 0.8 */
  warningThreshold?: number;
}

// ─── Default Pricing ──────────────────────────────────────────────────────────

/**
 * Default per-1K-token pricing (USD).
 *
 * Ollama: $0 — local models are free, Cloud is subscription-based.
 * Premium providers charge per token and count against the budget.
 */
export const DEFAULT_PRICING: ProviderPricing = {
  ollama: { inputPer1k: 0, outputPer1k: 0 },
  openai: { inputPer1k: 0.003, outputPer1k: 0.015 },
  anthropic: { inputPer1k: 0.003, outputPer1k: 0.015 },
  gemini: { inputPer1k: 0.000125, outputPer1k: 0.000375 },
  deepseek: { inputPer1k: 0.00014, outputPer1k: 0.00028 },
};

/** Default Ollama Cloud subscription (monthly, USD). 0 when using local Ollama only. */
export const DEFAULT_OLLAMA_SUBSCRIPTION = 0;

/** Providers that are always free (never blocked by budget) */
const FREE_PROVIDERS: Set<ProviderId> = new Set(['ollama']);

// ─── CostCalculator ───────────────────────────────────────────────────────────

export class CostCalculator {
  private pricing: ProviderPricing;
  private budgetLimit: number;
  private ollamaSubscription: number;
  private warningThreshold: number;
  private used: number;
  private totalInputTokens: number;
  private totalOutputTokens: number;
  private usageCount: number;
  private providerStats: Map<ProviderId, ProviderUsageStats>;

  constructor(config: CostConfig) {
    this.pricing = config.pricing;
    this.budgetLimit = config.budgetLimit ?? 0;
    this.ollamaSubscription = config.ollamaSubscription ?? DEFAULT_OLLAMA_SUBSCRIPTION;
    this.warningThreshold = config.warningThreshold ?? 0.8;
    this.used = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.usageCount = 0;
    this.providerStats = new Map();
  }

  /**
   * Compute the per-call cost for a specific provider and token counts.
   * Ollama always returns 0 (local = free, cloud = subscription).
   */
  computeCost(provider: ProviderId, inputTokens: number, outputTokens: number): number {
    // Ollama is always free per-call (local = $0, cloud = subscription)
    if (FREE_PROVIDERS.has(provider)) {
      return 0;
    }

    const rate = this.pricing[provider];
    if (!rate) {
      throw new Error(`No pricing for provider: ${provider}`);
    }
    return (inputTokens / 1000) * rate.inputPer1k +
           (outputTokens / 1000) * rate.outputPer1k;
  }

  /**
   * Record an API call, updating all counters.
   * Ollama calls add tokens but no cost. Premium calls add both.
   */
  recordUsage(provider: ProviderId, inputTokens: number, outputTokens: number): void {
    const cost = this.computeCost(provider, inputTokens, outputTokens);

    // Only premium provider costs count against the budget
    if (!FREE_PROVIDERS.has(provider)) {
      this.used += cost;
    }

    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
    this.usageCount++;

    // Per-provider stats
    let stats = this.providerStats.get(provider);
    if (!stats) {
      stats = { inputTokens: 0, outputTokens: 0, cost: 0, calls: 0 };
    }
    stats.inputTokens += inputTokens;
    stats.outputTokens += outputTokens;
    stats.cost += cost;
    stats.calls++;
    this.providerStats.set(provider, stats);
  }

  /** Get a full cost snapshot for UI rendering */
  getSnapshot(): CostSnapshot {
    const remaining = this.budgetLimit > 0
      ? Math.max(0, this.budgetLimit - this.used)
      : Infinity;
    const budgetRatio = this.budgetLimit > 0 ? this.used / this.budgetLimit : 0;
    const warning = this.budgetLimit > 0 && budgetRatio >= this.warningThreshold;
    const blocked = this.budgetLimit > 0 && this.used >= this.budgetLimit;

    const providerUsage: Partial<Record<ProviderId, ProviderUsageStats>> = {};
    for (const [provider, stats] of this.providerStats) {
      providerUsage[provider] = { ...stats };
    }

    return {
      used: parseFloat(this.used.toFixed(6)),
      remaining: remaining === Infinity ? 0 : parseFloat(remaining.toFixed(6)),
      limit: this.budgetLimit,
      ollamaSubscription: this.ollamaSubscription,
      warning,
      blocked,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      usageCount: this.usageCount,
      providerUsage,
    };
  }

  /**
   * Check which providers are affordable for a given estimated token usage.
   *
   * Rules:
   *   - Ollama is ALWAYS affordable (local free, cloud subscription)
   *   - Premium providers are excluded when the budget is exceeded
   *   - When budget is 0 (unlimited), all providers are affordable
   */
  getAffordableProviders(estimatedInput: number, estimatedOutput: number): ProviderId[] {
    const affordable: ProviderId[] = [];

    for (const provider of Object.keys(this.pricing) as ProviderId[]) {
      // Ollama is always affordable
      if (FREE_PROVIDERS.has(provider)) {
        affordable.push(provider);
        continue;
      }

      // No budget limit → all providers allowed
      if (this.budgetLimit === 0) {
        affordable.push(provider);
        continue;
      }

      // Budget exceeded → block premium providers
      if (this.used >= this.budgetLimit) {
        continue;
      }

      // Check if estimated cost would fit within remaining budget
      const rate = this.pricing[provider];
      if (!rate) continue;

      const estimatedCost =
        (estimatedInput / 1000) * rate.inputPer1k +
        (estimatedOutput / 1000) * rate.outputPer1k;

      if (this.used + estimatedCost <= this.budgetLimit) {
        affordable.push(provider);
      }
    }

    return affordable;
  }

  /**
   * Check if the budget is exceeded.
   * When true, premium providers should be blocked.
   * Ollama is never affected.
   */
  isBudgetExceeded(): boolean {
    return this.budgetLimit > 0 && this.used >= this.budgetLimit;
  }

  /** Check if the budget warning is active (≥80% used) */
  isBudgetWarning(): boolean {
    return this.budgetLimit > 0 && this.used / this.budgetLimit >= this.warningThreshold;
  }

  /** Set the Ollama Cloud subscription cost */
  setOllamaSubscription(monthlyCost: number): void {
    this.ollamaSubscription = monthlyCost;
  }

  /** Get the Ollama Cloud subscription cost */
  getOllamaSubscription(): number {
    return this.ollamaSubscription;
  }

  /** Check if using Ollama Cloud (subscription > 0) vs local (free) */
  isCloudSubscription(): boolean {
    return this.ollamaSubscription > 0;
  }

  /** Get total cost including subscription */
  getTotalCost(): number {
    return this.used + this.ollamaSubscription;
  }

  /** Reset all counters */
  reset(): void {
    this.used = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.usageCount = 0;
    this.providerStats.clear();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a CostCalculator with default or custom pricing */
export function createCostCalculator(config?: Partial<CostConfig>): CostCalculator {
  return new CostCalculator({
    pricing: DEFAULT_PRICING,
    budgetLimit: 0,
    ollamaSubscription: 0,
    ...config,
  });
}

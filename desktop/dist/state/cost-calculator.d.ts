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
/**
 * Default per-1K-token pricing (USD).
 *
 * Ollama: $0 — local models are free, Cloud is subscription-based.
 * Premium providers charge per token and count against the budget.
 */
export declare const DEFAULT_PRICING: ProviderPricing;
/** Default Ollama Cloud subscription (monthly, USD). 0 when using local Ollama only. */
export declare const DEFAULT_OLLAMA_SUBSCRIPTION = 0;
export declare class CostCalculator {
    private pricing;
    private budgetLimit;
    private ollamaSubscription;
    private warningThreshold;
    private used;
    private totalInputTokens;
    private totalOutputTokens;
    private usageCount;
    private providerStats;
    constructor(config: CostConfig);
    /**
     * Compute the per-call cost for a specific provider and token counts.
     * Ollama always returns 0 (local = free, cloud = subscription).
     */
    computeCost(provider: ProviderId, inputTokens: number, outputTokens: number): number;
    /**
     * Record an API call, updating all counters.
     * Ollama calls add tokens but no cost. Premium calls add both.
     */
    recordUsage(provider: ProviderId, inputTokens: number, outputTokens: number): void;
    /** Get a full cost snapshot for UI rendering */
    getSnapshot(): CostSnapshot;
    /**
     * Check which providers are affordable for a given estimated token usage.
     *
     * Rules:
     *   - Ollama is ALWAYS affordable (local free, cloud subscription)
     *   - Premium providers are excluded when the budget is exceeded
     *   - When budget is 0 (unlimited), all providers are affordable
     */
    getAffordableProviders(estimatedInput: number, estimatedOutput: number): ProviderId[];
    /**
     * Check if the budget is exceeded.
     * When true, premium providers should be blocked.
     * Ollama is never affected.
     */
    isBudgetExceeded(): boolean;
    /** Check if the budget warning is active (≥80% used) */
    isBudgetWarning(): boolean;
    /** Set the Ollama Cloud subscription cost */
    setOllamaSubscription(monthlyCost: number): void;
    /** Get the Ollama Cloud subscription cost */
    getOllamaSubscription(): number;
    /** Check if using Ollama Cloud (subscription > 0) vs local (free) */
    isCloudSubscription(): boolean;
    /** Get total cost including subscription */
    getTotalCost(): number;
    /** Reset all counters */
    reset(): void;
}
/** Create a CostCalculator with default or custom pricing */
export declare function createCostCalculator(config?: Partial<CostConfig>): CostCalculator;

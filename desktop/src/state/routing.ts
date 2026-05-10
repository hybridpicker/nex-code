/**
 * src/state/routing.ts — Provider Routing Layer
 *
 * Handles Ollama-first routing with fallback to premium providers.
 * Implements budget-aware routing, phase-based model selection,
 * and provider availability checks.
 *
 * Routing priority:
 *   1. Default provider (Ollama)
 *   2. FALLBACK_CHAIN: ollama → openai → anthropic → gemini → deepseek
 *   3. Fail if no provider available
 *
 * Budget enforcement:
 *   - Ollama always allowed (open-model-first)
 *   - Premium providers blocked when budget exceeded
 */

import type { ProviderId } from '../config/env';
import type { EnvConfig } from '../config/env';
import { LLMProvider, LLMRequest, LLMResponse, ProviderError } from '../providers/base';
import { CostCalculator } from './cost-calculator';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Phase identifiers for phase-based routing */
export type AgentPhase = 'explore' | 'plan' | 'implement' | 'verify';

/** Phase-model mapping */
export type PhaseModels = Partial<Record<AgentPhase, string | null>>;

/** Result of a routing + call operation */
export interface RouteResult {
  success: boolean;
  response?: LLMResponse;
  error?: ProviderError;
  provider: ProviderId;
  fallbackUsed: boolean;
}

/** Router configuration */
export interface RouterConfig {
  providers: Partial<Record<ProviderId, LLMProvider>>;
  config: EnvConfig;
  costCalculator?: CostCalculator;
  phaseModels?: PhaseModels;
}

/** Default fallback chain: Ollama first, then premium providers */
export const FALLBACK_CHAIN: readonly ProviderId[] = [
  'ollama',
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
] as const;

// ─── ProviderRouter ───────────────────────────────────────────────────────────

export class ProviderRouter {
  private providers: Map<ProviderId, LLMProvider>;
  private config: EnvConfig;
  private costCalculator: CostCalculator | null;
  private phaseModels: PhaseModels;

  constructor(config: RouterConfig) {
    this.providers = new Map();
    for (const [id, provider] of Object.entries(config.providers)) {
      if (provider) {
        this.providers.set(id as ProviderId, provider);
      }
    }
    this.config = config.config;
    this.costCalculator = config.costCalculator || null;
    this.phaseModels = config.phaseModels || {};
  }

  // ─── Route & Call ───────────────────────────────────────────────────────

  /**
   * Route a request through the provider chain.
   * Tries the default provider first, then falls back through the chain.
   */
  async route(request: LLMRequest): Promise<RouteResult> {
    const defaultProvider = this.config.defaultProvider;
    const providersToTry = this.buildFallbackChain(defaultProvider);

    for (const providerId of providersToTry) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      // Check availability
      const available = await provider.isAvailable();
      if (!available) continue;

      // Check budget for premium providers
      if (providerId !== 'ollama' && this.costCalculator?.isBudgetExceeded()) {
        continue;
      }

      // Try the call
      try {
        const response = await provider.complete(request);
        const isFallback = providerId !== defaultProvider;

        // Record usage in cost calculator
        if (this.costCalculator) {
          this.costCalculator.recordUsage(
            providerId,
            response.usage.inputTokens,
            response.usage.outputTokens,
          );
        }

        return {
          success: true,
          response,
          provider: providerId,
          fallbackUsed: isFallback,
        };
      } catch (err: any) {
        // If the error is retryable, continue to next provider
        if (err.retryable !== false) {
          continue;
        }
        // Non-retryable error → fail immediately
        return {
          success: false,
          error: {
            provider: providerId,
            message: err.message || 'Provider error',
            code: err.code,
            retryable: false,
          },
          provider: providerId,
          fallbackUsed: providerId !== defaultProvider,
        };
      }
    }

    // No provider succeeded
    return {
      success: false,
      error: {
        provider: defaultProvider,
        message: 'No providers available',
        retryable: false,
      },
      provider: defaultProvider,
      fallbackUsed: false,
    };
  }

  // ─── Phase-based Model Selection ────────────────────────────────────────

  /**
   * Get the model to use for a given agent phase.
   * Returns the phase-specific model, or the default model if none configured.
   */
  getModelForPhase(phase: AgentPhase): string {
    if (!this.config.phaseRoutingEnabled) {
      return this.config.defaultModel;
    }

    const phaseModel = this.phaseModels[phase];
    return phaseModel || this.config.defaultModel;
  }

  /**
   * Route a request for a specific agent phase.
   * Overrides the request's model field with the phase-specific model.
   */
  async routeForPhase(
    request: LLMRequest,
    phase: AgentPhase,
  ): Promise<RouteResult> {
    const phaseModel = this.getModelForPhase(phase);
    const phasedRequest: LLMRequest = {
      ...request,
      model: request.model || phaseModel,
    };
    return this.route(phasedRequest);
  }

  // ─── Provider Management ────────────────────────────────────────────────

  /** Register a new provider */
  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  /** Get a registered provider */
  getProvider(id: ProviderId): LLMProvider | undefined {
    return this.providers.get(id);
  }

  /** Check if a provider is registered */
  hasProvider(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  /** List all registered provider IDs */
  getRegisteredProviders(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  /** Get the current cost calculator */
  getCostCalculator(): CostCalculator | null {
    return this.costCalculator;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  /**
   * Build the fallback chain starting from the default provider.
   * If fallback is disabled, only the default provider is tried.
   */
  private buildFallbackChain(defaultProvider: ProviderId): ProviderId[] {
    if (!this.config.fallbackEnabled) {
      return [defaultProvider];
    }

    const chain: ProviderId[] = [defaultProvider];

    for (const id of FALLBACK_CHAIN) {
      if (id !== defaultProvider && this.providers.has(id)) {
        chain.push(id);
      }
    }

    return chain;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a ProviderRouter with the given configuration */
export function createProviderRouter(config: RouterConfig): ProviderRouter {
  return new ProviderRouter(config);
}

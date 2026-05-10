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
export declare const FALLBACK_CHAIN: readonly ProviderId[];
export declare class ProviderRouter {
    private providers;
    private config;
    private costCalculator;
    private phaseModels;
    constructor(config: RouterConfig);
    /**
     * Route a request through the provider chain.
     * Tries the default provider first, then falls back through the chain.
     */
    route(request: LLMRequest): Promise<RouteResult>;
    /**
     * Get the model to use for a given agent phase.
     * Returns the phase-specific model, or the default model if none configured.
     */
    getModelForPhase(phase: AgentPhase): string;
    /**
     * Route a request for a specific agent phase.
     * Overrides the request's model field with the phase-specific model.
     */
    routeForPhase(request: LLMRequest, phase: AgentPhase): Promise<RouteResult>;
    /** Register a new provider */
    registerProvider(provider: LLMProvider): void;
    /** Get a registered provider */
    getProvider(id: ProviderId): LLMProvider | undefined;
    /** Check if a provider is registered */
    hasProvider(id: ProviderId): boolean;
    /** List all registered provider IDs */
    getRegisteredProviders(): ProviderId[];
    /** Get the current cost calculator */
    getCostCalculator(): CostCalculator | null;
    /**
     * Build the fallback chain starting from the default provider.
     * If fallback is disabled, only the default provider is tried.
     */
    private buildFallbackChain;
}
/** Create a ProviderRouter with the given configuration */
export declare function createProviderRouter(config: RouterConfig): ProviderRouter;

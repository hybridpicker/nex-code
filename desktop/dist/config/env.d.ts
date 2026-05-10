/**
 * src/config/env.ts — Environment Configuration
 *
 * Loads and validates environment configuration for nex-code.
 * Ollama Cloud is the default provider (open-model-first).
 * Premium providers (OpenAI, Anthropic, Gemini, DeepSeek) are optional fallbacks.
 *
 * Environment variables:
 *   OLLAMA_API_KEY        — Ollama Cloud API key
 *   DEFAULT_PROVIDER      — Override default provider (ollama|openai|anthropic|gemini|deepseek)
 *   DEFAULT_MODEL         — Override default model
 *   DEEPSEEK_API_KEY      — DeepSeek API key
 *   OPENAI_API_KEY        — OpenAI API key
 *   ANTHROPIC_API_KEY     — Anthropic API key
 *   GEMINI_API_KEY        — Gemini API key
 *   NEX_BUDGET_LIMIT      — Monthly budget cap (float, e.g. "10.00")
 *   NEX_BUDGET_CURRENCY   — Budget currency (default: USD)
 *   NEX_FALLBACK_ENABLED  — Enable fallback to premium providers (0|1)
 *   NEX_PHASE_ROUTING     — Enable phase-based model routing (0|1)
 */
/** Supported provider identifiers */
export type ProviderId = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'deepseek';
/** Valid provider list */
export declare const SUPPORTED_PROVIDERS: readonly ProviderId[];
/** Environment configuration shape */
export interface EnvConfig {
    /** Ollama Cloud API key */
    ollamaApiKey: string | undefined;
    /** Default provider for LLM requests */
    defaultProvider: ProviderId;
    /** Default model ID */
    defaultModel: string;
    /** DeepSeek API key */
    deepseekApiKey: string | undefined;
    /** OpenAI API key */
    openaiApiKey: string | undefined;
    /** Anthropic API key */
    anthropicApiKey: string | undefined;
    /** Gemini API key */
    geminiApiKey: string | undefined;
    /** Monthly budget limit (0 = no limit) */
    budgetLimit: number;
    /** Budget currency code */
    budgetCurrency: string;
    /** Whether fallback to premium providers is enabled */
    fallbackEnabled: boolean;
    /** Whether phase-based model routing is enabled */
    phaseRoutingEnabled: boolean;
}
/** Default configuration — Ollama-first */
export declare const DEFAULT_CONFIG: EnvConfig;
/** Validation result */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
/**
 * Load configuration from environment variables.
 * Returns a complete EnvConfig with defaults filled in.
 */
export declare function loadEnvConfig(): EnvConfig;
/**
 * Validate an EnvConfig. Returns errors for misconfiguration and
 * warnings for suboptimal setups.
 */
export declare function validateConfig(config: EnvConfig): ValidationResult;
/**
 * Get the API key for a given provider.
 */
export declare function getApiKeyForProvider(config: EnvConfig, provider: ProviderId): string | undefined;
/**
 * Check if a provider has a configured API key.
 */
export declare function hasProviderKey(config: EnvConfig, provider: ProviderId): boolean;
/**
 * List all providers that have configured API keys.
 */
export declare function availableProviders(config: EnvConfig): ProviderId[];

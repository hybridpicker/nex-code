"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.SUPPORTED_PROVIDERS = void 0;
exports.loadEnvConfig = loadEnvConfig;
exports.validateConfig = validateConfig;
exports.getApiKeyForProvider = getApiKeyForProvider;
exports.hasProviderKey = hasProviderKey;
exports.availableProviders = availableProviders;
/** Valid provider list */
exports.SUPPORTED_PROVIDERS = [
    'ollama',
    'openai',
    'anthropic',
    'gemini',
    'deepseek',
];
/** Default configuration — Ollama-first */
exports.DEFAULT_CONFIG = {
    ollamaApiKey: undefined,
    defaultProvider: 'ollama',
    defaultModel: 'qwen3-coder:480b',
    deepseekApiKey: undefined,
    openaiApiKey: undefined,
    anthropicApiKey: undefined,
    geminiApiKey: undefined,
    budgetLimit: 0,
    budgetCurrency: 'USD',
    fallbackEnabled: true,
    phaseRoutingEnabled: true,
};
/**
 * Parse a numeric env var, returning a default on failure.
 */
function parseNumericEnv(value, fallback) {
    if (value === undefined || value === '')
        return fallback;
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0)
        return fallback;
    return parsed;
}
/**
 * Parse a boolean env var (0/1, true/false, yes/no).
 */
function parseBoolEnv(value, fallback) {
    if (value === undefined || value === '')
        return fallback;
    const lower = value.toLowerCase();
    if (lower === '0' || lower === 'false' || lower === 'no')
        return false;
    if (lower === '1' || lower === 'true' || lower === 'yes')
        return true;
    return fallback;
}
/**
 * Load configuration from environment variables.
 * Returns a complete EnvConfig with defaults filled in.
 */
function loadEnvConfig() {
    const defaultProvider = (process.env.DEFAULT_PROVIDER || 'ollama');
    const isOllama = defaultProvider === 'ollama';
    return {
        ollamaApiKey: process.env.OLLAMA_API_KEY || undefined,
        defaultProvider,
        defaultModel: process.env.DEFAULT_MODEL || 'qwen3-coder:480b',
        deepseekApiKey: process.env.DEEPSEEK_API_KEY || undefined,
        openaiApiKey: process.env.OPENAI_API_KEY || undefined,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
        geminiApiKey: process.env.GEMINI_API_KEY || undefined,
        budgetLimit: parseNumericEnv(process.env.NEX_BUDGET_LIMIT, 0),
        budgetCurrency: process.env.NEX_BUDGET_CURRENCY || 'USD',
        fallbackEnabled: parseBoolEnv(process.env.NEX_FALLBACK_ENABLED, true),
        phaseRoutingEnabled: parseBoolEnv(process.env.NEX_PHASE_ROUTING, isOllama),
    };
}
/**
 * Validate an EnvConfig. Returns errors for misconfiguration and
 * warnings for suboptimal setups.
 */
function validateConfig(config) {
    const errors = [];
    const warnings = [];
    // Provider must be supported
    if (!exports.SUPPORTED_PROVIDERS.includes(config.defaultProvider)) {
        errors.push(`Unsupported provider: ${config.defaultProvider}`);
    }
    // Model must not be empty
    if (!config.defaultModel || config.defaultModel.trim() === '') {
        errors.push('Default model must not be empty');
    }
    // Warn if Ollama key is missing (Ollama Cloud won't work)
    if (!config.ollamaApiKey) {
        warnings.push('No Ollama API key configured — Ollama Cloud will be unavailable');
    }
    // Warn if fallback is enabled but no premium keys exist
    if (config.fallbackEnabled) {
        const hasPremiumKey = !!config.openaiApiKey ||
            !!config.anthropicApiKey ||
            !!config.geminiApiKey ||
            !!config.deepseekApiKey;
        if (!hasPremiumKey) {
            warnings.push('Fallback enabled but no premium provider keys configured');
        }
    }
    // Warn if budget is explicitly 0 (no cap)
    if (config.budgetLimit === 0 && !!config.openaiApiKey) {
        warnings.push('No budget limit set — premium usage is uncapped');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Get the API key for a given provider.
 */
function getApiKeyForProvider(config, provider) {
    switch (provider) {
        case 'ollama':
            return config.ollamaApiKey;
        case 'openai':
            return config.openaiApiKey;
        case 'anthropic':
            return config.anthropicApiKey;
        case 'gemini':
            return config.geminiApiKey;
        case 'deepseek':
            return config.deepseekApiKey;
        default:
            return undefined;
    }
}
/**
 * Check if a provider has a configured API key.
 */
function hasProviderKey(config, provider) {
    return !!getApiKeyForProvider(config, provider);
}
/**
 * List all providers that have configured API keys.
 */
function availableProviders(config) {
    return exports.SUPPORTED_PROVIDERS.filter((p) => hasProviderKey(config, p));
}
//# sourceMappingURL=env.js.map
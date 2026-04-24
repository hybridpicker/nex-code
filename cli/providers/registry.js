/**
 * cli/providers/registry.js — Provider Registry + Model Resolution
 * Central hub for multi-provider model management.
 *
 * Model specs: 'provider:model' (e.g. 'openai:gpt-4o', 'anthropic:claude-sonnet', 'local:llama3')
 * Short specs: 'model' (resolved against active provider)
 */

const { OllamaProvider, getOllamaRecommendations } = require("./ollama");
const { OpenAIProvider } = require("./openai");
const { AnthropicProvider } = require("./anthropic");
const { GeminiProvider } = require("./gemini");
const { LocalProvider } = require("./local");
const { checkBudget } = require("../costs");

// ─── Model Equivalence Map ─────────────────────────────────────
// Maps models across providers by capability tier (top/strong/fast).
// Used during fallback to pick an equivalent model on a different provider.

const MODEL_EQUIVALENTS = {
  top: {
    ollama: "kimi-k2:1t",
    openai: "gpt-4.1",
    anthropic: "claude-sonnet-4-5",
    gemini: "gemini-2.5-pro",
  },
  strong: {
    ollama: "qwen3-coder:480b",
    openai: "gpt-4o",
    anthropic: "claude-sonnet",
    gemini: "gemini-2.5-flash",
  },
  fast: {
    ollama: "devstral-small-2:24b",
    openai: "gpt-4.1-mini",
    anthropic: "claude-haiku",
    gemini: "gemini-2.0-flash",
  },
};

// Intra-provider model fallback for Ollama (tried before jumping to different provider)
const OLLAMA_FALLBACK_MODELS = (process.env.OLLAMA_FALLBACK_CHAIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Reverse lookup: model → tier
const _modelToTier = {};
for (const [tier, mapping] of Object.entries(MODEL_EQUIVALENTS)) {
  for (const model of Object.values(mapping)) {
    _modelToTier[model] = tier;
  }
}

/**
 * Resolve the equivalent model for a target provider.
 * If sourceModel exists in MODEL_EQUIVALENTS, returns the target provider's
 * equivalent. Otherwise returns sourceModel unchanged.
 *
 * @param {string} sourceModel - The model ID to map (e.g. 'kimi-k2.5')
 * @param {string} targetProviderName - Target provider (e.g. 'openai')
 * @returns {string} resolved model ID
 */
function resolveModelForProvider(sourceModel, targetProviderName) {
  const tier = _modelToTier[sourceModel];
  if (!tier) return sourceModel; // Unknown model — pass through unchanged
  const equivalent = MODEL_EQUIVALENTS[tier][targetProviderName];
  return equivalent || sourceModel; // No mapping for this provider — pass through
}

// ─── Registry State ────────────────────────────────────────────

const providers = {};
let activeProviderName = null;
let activeModelId = null;
let fallbackChain = [];

// ─── Initialize Default Providers ──────────────────────────────

function initDefaults() {
  if (Object.keys(providers).length > 0) return;

  registerProvider("ollama", new OllamaProvider());
  registerProvider("openai", new OpenAIProvider());
  registerProvider("anthropic", new AnthropicProvider());
  registerProvider("gemini", new GeminiProvider());
  registerProvider("local", new LocalProvider());

  // Determine active provider from env or default to ollama
  const defaultProvider = process.env.DEFAULT_PROVIDER || "ollama";
  const defaultModel = process.env.DEFAULT_MODEL || null;

  if (providers[defaultProvider]) {
    activeProviderName = defaultProvider;
    activeModelId = defaultModel || providers[defaultProvider].defaultModel;
  } else {
    activeProviderName = "ollama";
    activeModelId = "kimi-k2.5";
  }

  // Initialize fallback chain from env
  const envChain = process.env.FALLBACK_CHAIN;
  if (envChain) {
    fallbackChain = envChain
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

// ─── Provider Management ───────────────────────────────────────

function registerProvider(name, provider) {
  providers[name] = provider;
}

function getProvider(name) {
  initDefaults();
  return providers[name] || null;
}

function getActiveProvider() {
  initDefaults();
  return providers[activeProviderName] || null;
}

function getActiveProviderName() {
  initDefaults();
  return activeProviderName;
}

function getActiveModelId() {
  initDefaults();
  return activeModelId;
}

/**
 * Get active model info (compatible with old getActiveModel format)
 * @returns {{ id: string, name: string, provider: string, maxTokens?: number, contextWindow?: number }}
 */
function getActiveModel() {
  initDefaults();
  const provider = getActiveProvider();
  if (!provider)
    return {
      id: activeModelId,
      name: activeModelId,
      provider: activeProviderName,
    };

  const model = provider.getModel(activeModelId);
  if (model) {
    return { ...model, provider: activeProviderName };
  }

  return {
    id: activeModelId,
    name: activeModelId,
    provider: activeProviderName,
  };
}

// ─── Model Resolution ──────────────────────────────────────────

/**
 * Parse a model spec like 'openai:gpt-4o' or just 'gpt-4o'
 * @param {string} spec
 * @returns {{ provider: string|null, model: string }}
 */
function parseModelSpec(spec) {
  if (!spec) return { provider: null, model: null };
  const colonIdx = spec.indexOf(":");
  if (colonIdx > 0) {
    const prefix = spec.slice(0, colonIdx);
    // Only treat as provider:model if prefix is a known provider name
    if (
      providers[prefix] ||
      ["ollama", "openai", "anthropic", "gemini", "local"].includes(prefix)
    ) {
      return { provider: prefix, model: spec.slice(colonIdx + 1) };
    }
  }
  return { provider: null, model: spec };
}

/**
 * Set active model. Accepts 'provider:model' or just 'model'.
 * @param {string} spec - Model spec (e.g. 'openai:gpt-4o', 'kimi-k2.5')
 * @returns {boolean} true if model was set successfully
 */
function setActiveModel(spec) {
  initDefaults();
  const { provider: providerName, model: modelId } = parseModelSpec(spec);

  if (providerName) {
    const provider = providers[providerName];
    if (!provider) return false;

    const model = provider.getModel(modelId);
    if (!model) {
      // Allow setting model even if not in predefined list:
      // - 'local': custom local models
      // - 'ollama': dynamically discovered cloud models not yet in hardcoded list
      if (providerName === "local" || providerName === "ollama") {
        activeProviderName = providerName;
        activeModelId = modelId;
        // Invalidate caches on model change
        invalidateCaches();
        return true;
      }
      return false;
    }

    activeProviderName = providerName;
    activeModelId = modelId;
    // Invalidate caches on model change
    invalidateCaches();
    return true;
  }

  // No provider prefix — search in active provider first, then all providers
  const active = getActiveProvider();
  if (active && active.getModel(modelId)) {
    activeModelId = modelId;
    // Invalidate caches on model change
    invalidateCaches();
    return true;
  }

  for (const [name, provider] of Object.entries(providers)) {
    if (provider.getModel(modelId)) {
      activeProviderName = name;
      activeModelId = modelId;
      // Invalidate caches on model change
      invalidateCaches();
      return true;
    }
  }

  return false;
}

/**
 * Invalidate all caches when model/provider changes
 */
function invalidateCaches() {
  try {
    const {
      invalidateSystemPromptCache,
      clearToolFilterCache,
    } = require("../agent");
    invalidateSystemPromptCache();
    clearToolFilterCache();
  } catch {
    // Ignore if agent module not loaded yet
  }
  try {
    const { invalidateTokenRatioCache } = require("../context-engine");
    invalidateTokenRatioCache();
  } catch {
    // Ignore if context-engine not loaded yet
  }
}

/**
 * Get all model names across all providers (for tab completion, etc.)
 * Returns just the model ids without provider prefix.
 */
function getModelNames() {
  initDefaults();
  const names = new Set();
  for (const provider of Object.values(providers)) {
    for (const name of provider.getModelNames()) {
      names.add(name);
    }
  }
  return Array.from(names);
}

/**
 * Get all models grouped by provider
 * @returns {Array<{ provider: string, configured: boolean, models: Array }>}
 */
function listProviders() {
  initDefaults();
  return Object.entries(providers).map(([name, provider]) => ({
    provider: name,
    configured: provider.isConfigured(),
    models: Object.values(provider.getModels()).map((m) => ({
      ...m,
      active: name === activeProviderName && m.id === activeModelId,
    })),
  }));
}

/**
 * Get flat list of all models with provider prefix
 * @returns {Array<{ spec: string, name: string, provider: string, configured: boolean }>}
 */
function listAllModels() {
  initDefaults();
  const result = [];
  for (const [provName, provider] of Object.entries(providers)) {
    const configured = provider.isConfigured();
    for (const model of Object.values(provider.getModels())) {
      result.push({
        spec: `${provName}:${model.id}`,
        name: model.name,
        provider: provName,
        configured,
        maxTokens: model.maxTokens,
        contextWindow: model.contextWindow,
        capability: model.capability,
        speed: model.speed,
        quality: model.quality,
        recommendedFor: model.recommendedFor || [],
      });
    }
  }
  return result;
}

/**
 * Recommend configured models for a task use case.
 * Ollama Cloud has curated capability metadata; other providers fall back to
 * their defaults so model picking still works in mixed-provider setups.
 *
 * @param {string} useCase
 * @param {{ limit?: number, configuredOnly?: boolean }} options
 * @returns {Array<{ spec: string, id: string, name: string, provider: string, configured: boolean }>}
 */
function recommendModels(useCase = "coding", options = {}) {
  initDefaults();
  const limit = options.limit || 5;
  const configuredOnly = options.configuredOnly !== false;
  const result = [];

  const ollama = providers.ollama;
  if (ollama && (!configuredOnly || ollama.isConfigured())) {
    for (const model of getOllamaRecommendations(useCase, limit)) {
      result.push({
        ...model,
        spec: `ollama:${model.id}`,
        provider: "ollama",
        configured: ollama.isConfigured(),
      });
    }
  }

  if (result.length >= limit) return result.slice(0, limit);

  for (const [providerName, provider] of Object.entries(providers)) {
    if (providerName === "ollama") continue;
    if (configuredOnly && !provider.isConfigured()) continue;
    const model = provider.getModel(provider.defaultModel);
    if (!model) continue;
    result.push({
      ...model,
      spec: `${providerName}:${model.id}`,
      provider: providerName,
      configured: provider.isConfigured(),
    });
    if (result.length >= limit) break;
  }

  return result;
}

// ─── Fallback Chain ─────────────────────────────────────────────

function setFallbackChain(chain) {
  fallbackChain = Array.isArray(chain) ? chain : [];
}

function getFallbackChain() {
  return [...fallbackChain];
}

// ─── Streaming Call (convenience) ──────────────────────────────

/**
 * Check if an error is retryable (rate limit, server error, or network failure).
 */
function isRetryableError(err) {
  const msg = err.message || "";
  const code = err.code || "";

  // HTTP status errors
  if (
    msg.includes("429") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  )
    return true;

  // Network/TLS/socket errors — transient, retryable
  if (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "EPIPE" ||
    code === "ERR_SOCKET_CONNECTION_TIMEOUT"
  )
    return true;

  if (
    msg.includes("socket disconnected") ||
    msg.includes("TLS") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNABORTED") ||
    msg.includes("network") ||
    msg.includes("ETIMEDOUT")
  )
    return true;

  return false;
}

/**
 * Shared provider-fallback loop.
 * Iterates through the active provider + fallback chain, skipping budget-blocked
 * or unconfigured providers. On retryable errors, advances to the next provider.
 *
 * @param {Function} callFn - async (provider, provName, model) => result
 * @returns {Promise<*>}
 */
async function _tryProviders(callFn) {
  const providersToTry = [
    activeProviderName,
    ...fallbackChain.filter((p) => p !== activeProviderName),
  ];

  let lastError;
  let budgetBlockedCount = 0;
  let configuredCount = 0;
  for (let idx = 0; idx < providersToTry.length; idx++) {
    const provName = providersToTry[idx];
    const provider = providers[provName];
    if (!provider || !provider.isConfigured()) continue;
    configuredCount++;

    // Budget gate: skip providers that are over budget
    const budget = checkBudget(provName);
    if (!budget.allowed) {
      budgetBlockedCount++;
      lastError = new Error(
        `Budget limit reached for ${provName}: $${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)}`,
      );
      continue;
    }

    try {
      const isFallback = idx > 0;
      const model = isFallback
        ? resolveModelForProvider(activeModelId, provName)
        : activeModelId;
      if (isFallback && model !== activeModelId) {
        process.stderr.write(`  [fallback: ${provName}:${model}]\n`);
      }
      return await callFn(provider, provName, model);
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || idx >= providersToTry.length - 1) throw err;

      // Intra-provider fallback: try alternative Ollama models before jumping provider
      if (provName === "ollama" && OLLAMA_FALLBACK_MODELS.length > 0) {
        const tried = isFallback
          ? resolveModelForProvider(activeModelId, provName)
          : activeModelId;
        for (const altModel of OLLAMA_FALLBACK_MODELS) {
          if (altModel === tried) continue;
          try {
            process.stderr.write(`  [ollama fallback: ${altModel}]\n`);
            return await callFn(provider, provName, altModel);
          } catch (altErr) {
            lastError = altErr;
            if (!isRetryableError(altErr)) throw altErr;
          }
        }
      }

      continue;
    }
  }

  if (budgetBlockedCount > 0 && budgetBlockedCount === configuredCount) {
    throw new Error(
      "All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.",
    );
  }
  if (configuredCount === 0) {
    throw new Error("No configured provider available");
  }
  throw lastError || new Error("No configured provider available");
}

/**
 * Make a streaming call through the active provider.
 * Falls back to next provider in chain on retryable errors.
 * Skips providers that are over budget.
 */
async function callStream(messages, tools, options = {}) {
  initDefaults();
  // Strip provider prefix from model spec (e.g. "ollama:qwen3-coder:480b" → "qwen3-coder:480b")
  // so providers only receive the bare model ID they expect.
  const _rawModel = options.model;
  const _strippedModel = _rawModel
    ? (() => {
        const { model: m } = parseModelSpec(_rawModel);
        return m || _rawModel;
      })()
    : undefined;
  const _cleanOpts =
    _strippedModel !== _rawModel
      ? { ...options, model: _strippedModel }
      : options;
  return _tryProviders((provider, _provName, model) =>
    provider.stream(messages, tools, {
      model,
      signal: _cleanOpts.signal,
      ..._cleanOpts,
    }),
  );
}

/**
 * Make a non-streaming call through the active provider.
 * Falls back to next provider in chain on retryable errors.
 * Skips providers that are over budget.
 */
async function callChat(messages, tools, options = {}) {
  initDefaults();

  // Direct provider override: skip fallback chain
  if (options.provider) {
    const provider = providers[options.provider];
    if (!provider || !provider.isConfigured()) {
      throw new Error(`Provider '${options.provider}' is not available`);
    }
    const chatOpts = { model: options.model || activeModelId, ...options };
    try {
      return await provider.chat(messages, tools, chatOpts);
    } catch (chatErr) {
      // Fallback: some providers handle stream:true better than stream:false
      // Use streaming endpoint but collect the full response silently
      if (typeof provider.stream === "function") {
        try {
          return await provider.stream(messages, tools, {
            ...chatOpts,
            onToken: () => {},
          });
        } catch {
          /* stream fallback also failed — throw original error */
        }
      }
      throw chatErr;
    }
  }

  return _tryProviders(async (provider, _provName, model) => {
    try {
      return await provider.chat(messages, tools, { model, ...options });
    } catch (err) {
      // Fallback: try streaming endpoint before giving up on this provider
      if (typeof provider.stream === "function") {
        try {
          return await provider.stream(messages, tools, {
            model,
            ...options,
            onToken: () => {},
          });
        } catch {
          /* stream fallback also failed — rethrow original */
        }
      }
      throw err;
    }
  });
}

/**
 * Get all configured providers with their models.
 * @returns {Array<{ name: string, models: Array<{ id: string, name: string, maxTokens?: number, contextWindow?: number }> }>}
 */
function getConfiguredProviders() {
  initDefaults();
  const result = [];
  for (const [name, provider] of Object.entries(providers)) {
    if (provider.isConfigured()) {
      result.push({ name, models: Object.values(provider.getModels()) });
    }
  }
  return result;
}

// ─── Reset (for testing) ───────────────────────────────────────

function _reset() {
  for (const key of Object.keys(providers)) {
    delete providers[key];
  }
  activeProviderName = null;
  activeModelId = null;
  fallbackChain = [];
}

module.exports = {
  registerProvider,
  getProvider,
  getActiveProvider,
  getActiveProviderName,
  getActiveModelId,
  getActiveModel,
  setActiveModel,
  getModelNames,
  parseModelSpec,
  listProviders,
  listAllModels,
  recommendModels,
  callStream,
  callChat,
  getConfiguredProviders,
  setFallbackChain,
  getFallbackChain,
  resolveModelForProvider,
  MODEL_EQUIVALENTS,
  OLLAMA_FALLBACK_MODELS,
  _reset,
};

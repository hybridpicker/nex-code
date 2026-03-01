/**
 * cli/providers/registry.js — Provider Registry + Model Resolution
 * Central hub for multi-provider model management.
 *
 * Model specs: 'provider:model' (e.g. 'openai:gpt-4o', 'anthropic:claude-sonnet', 'local:llama3')
 * Short specs: 'model' (resolved against active provider)
 */

const { OllamaProvider } = require('./ollama');
const { OpenAIProvider } = require('./openai');
const { AnthropicProvider } = require('./anthropic');
const { GeminiProvider } = require('./gemini');
const { LocalProvider } = require('./local');
const { checkBudget } = require('../costs');

// ─── Registry State ────────────────────────────────────────────

const providers = {};
let activeProviderName = null;
let activeModelId = null;
let fallbackChain = [];

// ─── Initialize Default Providers ──────────────────────────────

function initDefaults() {
  if (Object.keys(providers).length > 0) return;

  registerProvider('ollama', new OllamaProvider());
  registerProvider('openai', new OpenAIProvider());
  registerProvider('anthropic', new AnthropicProvider());
  registerProvider('gemini', new GeminiProvider());
  registerProvider('local', new LocalProvider());

  // Determine active provider from env or default to ollama
  const defaultProvider = process.env.DEFAULT_PROVIDER || 'ollama';
  const defaultModel = process.env.DEFAULT_MODEL || null;

  if (providers[defaultProvider]) {
    activeProviderName = defaultProvider;
    activeModelId = defaultModel || providers[defaultProvider].defaultModel;
  } else {
    activeProviderName = 'ollama';
    activeModelId = 'kimi-k2.5';
  }

  // Initialize fallback chain from env
  const envChain = process.env.FALLBACK_CHAIN;
  if (envChain) {
    fallbackChain = envChain.split(',').map((s) => s.trim()).filter(Boolean);
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
  if (!provider) return { id: activeModelId, name: activeModelId, provider: activeProviderName };

  const model = provider.getModel(activeModelId);
  if (model) {
    return { ...model, provider: activeProviderName };
  }

  return { id: activeModelId, name: activeModelId, provider: activeProviderName };
}

// ─── Model Resolution ──────────────────────────────────────────

/**
 * Parse a model spec like 'openai:gpt-4o' or just 'gpt-4o'
 * @param {string} spec
 * @returns {{ provider: string|null, model: string }}
 */
function parseModelSpec(spec) {
  if (!spec) return { provider: null, model: null };
  const parts = spec.split(':');
  if (parts.length >= 2) {
    return { provider: parts[0], model: parts.slice(1).join(':') };
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
      // Allow setting model even if not in predefined list (for local models)
      if (providerName === 'local') {
        activeProviderName = providerName;
        activeModelId = modelId;
        return true;
      }
      return false;
    }

    activeProviderName = providerName;
    activeModelId = modelId;
    return true;
  }

  // No provider prefix — search in active provider first, then all providers
  const active = getActiveProvider();
  if (active && active.getModel(modelId)) {
    activeModelId = modelId;
    return true;
  }

  for (const [name, provider] of Object.entries(providers)) {
    if (provider.getModel(modelId)) {
      activeProviderName = name;
      activeModelId = modelId;
      return true;
    }
  }

  return false;
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
      });
    }
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
 * Check if an error is retryable (rate limit or server error).
 */
function isRetryableError(err) {
  const msg = err.message || '';
  return msg.includes('429') || msg.includes('500') || msg.includes('502') ||
         msg.includes('503') || msg.includes('504');
}

/**
 * Make a streaming call through the active provider.
 * Falls back to next provider in chain on retryable errors.
 * Skips providers that are over budget.
 */
async function callStream(messages, tools, options = {}) {
  initDefaults();
  const providersToTry = [activeProviderName, ...fallbackChain.filter((p) => p !== activeProviderName)];

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
      lastError = new Error(`Budget limit reached for ${provName}: $${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)}`);
      continue;
    }

    try {
      return await provider.stream(messages, tools, { model: activeModelId, ...options });
    } catch (err) {
      lastError = err;
      if (isRetryableError(err) && idx < providersToTry.length - 1) {
        continue;
      }
      throw err;
    }
  }

  if (budgetBlockedCount > 0 && budgetBlockedCount === configuredCount) {
    throw new Error('All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.');
  }
  throw lastError || new Error('No configured provider available');
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
    return await provider.chat(messages, tools, { model: options.model || activeModelId, ...options });
  }

  const providersToTry = [activeProviderName, ...fallbackChain.filter((p) => p !== activeProviderName)];

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
      lastError = new Error(`Budget limit reached for ${provName}: $${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)}`);
      continue;
    }

    try {
      return await provider.chat(messages, tools, { model: activeModelId, ...options });
    } catch (err) {
      lastError = err;
      if (isRetryableError(err) && idx < providersToTry.length - 1) {
        continue;
      }
      throw err;
    }
  }

  if (budgetBlockedCount > 0 && budgetBlockedCount === configuredCount) {
    throw new Error('All providers are over budget. Use /budget to check limits or /budget <provider> off to remove a limit.');
  }
  throw lastError || new Error('No configured provider available');
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
  callStream,
  callChat,
  getConfiguredProviders,
  setFallbackChain,
  getFallbackChain,
  _reset,
};

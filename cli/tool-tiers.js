/**
 * cli/tool-tiers.js — Dynamic Tool Set Selection
 * Reduces tool count for less capable models to improve reliability.
 */

const { getActiveModel, getActiveProviderName } = require('./providers/registry');

/**
 * Tool tier definitions.
 * - essential: Core tools every model gets (5 tools)
 * - standard: Good set for capable models (12 tools)
 * - full: All tools for the most capable models (15 tools)
 */
const TIERS = {
  essential: ['bash', 'read_file', 'write_file', 'edit_file', 'list_directory'],
  standard: ['bash', 'read_file', 'write_file', 'edit_file', 'list_directory', 'search_files', 'glob', 'grep', 'ask_user', 'git_status', 'git_diff', 'git_log', 'task_list', 'ssh_exec', 'service_manage', 'service_logs', 'container_list', 'container_logs', 'container_exec', 'container_manage', 'deploy'],
  full: null, // null = all tools, no filtering
};

/**
 * Model capability classification.
 * Maps known models to their tier. Unknown models default based on provider.
 */
const MODEL_TIERS = {
  // Ollama Cloud — tier by capability
  'qwen3-coder:480b': 'full',
  'qwen3-coder-next': 'full',
  'kimi-k2.5': 'full',
  'kimi-k2:1t': 'full',
  'kimi-k2-thinking': 'full',
  'deepseek-v3.2': 'full',
  'deepseek-v3.1:671b': 'full',
  'devstral-2:123b': 'full',
  'devstral-small-2:24b': 'standard',
  'cogito-2.1:671b': 'full',
  'qwen3-next:80b': 'full',
  'qwen3.5:397b-cloud': 'full',
  'qwen3.5:397b': 'full',
  'qwen3.5:122b-a10b': 'full',
  'qwen3.5:35b-a3b': 'full',
  'qwen3.5:27b': 'full',
  'qwen3.5:9b': 'standard',
  'qwen3.5:4b': 'essential',
  'qwen3.5:2b': 'essential',
  'qwen3.5:0.8b': 'essential',
  'mistral-large-3:675b': 'full',
  'gpt-oss:120b': 'full',
  'minimax-m2.5': 'full',
  'glm-5': 'full',
  'glm-4.7': 'standard',
  'gemma3:27b': 'standard',
  'gemma3:12b': 'essential',
  'gemma3:4b': 'essential',
  'ministral-3:14b': 'standard',
  'ministral-3:8b': 'essential',

  // OpenAI — all full
  'gpt-4o': 'full',
  'gpt-4.1': 'full',
  'o1': 'full',
  'o3': 'full',
  'o4-mini': 'full',

  // Anthropic — all full
  'claude-sonnet': 'full',
  'claude-sonnet-4-5': 'full',
  'claude-opus': 'full',
  'claude-haiku': 'standard',
  'claude-sonnet-4': 'full',

  // Gemini — all full
  'gemini-3.1-pro-preview': 'full',
  'gemini-3-flash-preview': 'full',
  'gemini-2.5-pro': 'full',
  'gemini-2.5-flash': 'full',
  'gemini-2.0-flash': 'standard',
  'gemini-2.0-flash-lite': 'essential',
};

/**
 * Default tier per provider (for unknown models).
 */
const PROVIDER_DEFAULT_TIER = {
  ollama: 'full',
  openai: 'full',
  anthropic: 'full',
  gemini: 'full',
  local: 'essential',
};

/**
 * Override tiers from config.
 * Loaded once from .nex/config.json at startup.
 */
let configOverrides = {};

function loadConfigOverrides() {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), '.nex', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      configOverrides = config.toolTiers || {};
    }
  } catch {
    configOverrides = {};
  }
}

// Load on require
loadConfigOverrides();

/**
 * Get the tool tier for the active model.
 * Priority: config override > MODEL_TIERS > PROVIDER_DEFAULT_TIER > 'full'
 */
function getActiveTier() {
  const model = getActiveModel();
  const modelId = model?.id;
  const provider = getActiveProviderName();

  // Config override (user can set per-model tiers)
  if (modelId && configOverrides[modelId]) return configOverrides[modelId];
  if (provider && configOverrides[`${provider}:*`]) return configOverrides[`${provider}:*`];

  // Built-in tier mapping
  if (modelId && MODEL_TIERS[modelId]) return MODEL_TIERS[modelId];

  // Provider default
  if (provider && PROVIDER_DEFAULT_TIER[provider]) return PROVIDER_DEFAULT_TIER[provider];

  return 'full';
}

/**
 * Get the tool tier for a specific model.
 * Priority: config override > MODEL_TIERS > PROVIDER_DEFAULT_TIER > 'full'
 * @param {string} modelId
 * @param {string} providerName
 * @returns {string} Tier name ('essential', 'standard', or 'full')
 */
function getModelTier(modelId, providerName) {
  if (modelId && configOverrides[modelId]) return configOverrides[modelId];
  if (providerName && configOverrides[`${providerName}:*`]) return configOverrides[`${providerName}:*`];
  if (modelId && MODEL_TIERS[modelId]) return MODEL_TIERS[modelId];
  if (providerName && PROVIDER_DEFAULT_TIER[providerName]) return PROVIDER_DEFAULT_TIER[providerName];
  return 'full';
}

/**
 * Filter tool definitions based on the active model's tier.
 * @param {Array} tools - Full tool definitions array
 * @param {string} [overrideTier] - Override tier (bypasses active model detection)
 * @returns {Array} Filtered tool definitions
 */
function filterToolsForModel(tools, overrideTier) {
  const tier = overrideTier || getActiveTier();
  if (tier === 'full' || !TIERS[tier]) return tools;

  const allowedNames = new Set(TIERS[tier]);
  return tools.filter(t => allowedNames.has(t.function.name));
}

/**
 * Get the current tier name (for display in /status etc.)
 */
function getTierInfo() {
  const tier = getActiveTier();
  const toolCount = TIERS[tier] ? TIERS[tier].length : 'all';
  return { tier, toolCount };
}

module.exports = { filterToolsForModel, getActiveTier, getModelTier, getTierInfo, TIERS, MODEL_TIERS, PROVIDER_DEFAULT_TIER, loadConfigOverrides };

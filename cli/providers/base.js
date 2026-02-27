/**
 * cli/providers/base.js — Abstract Provider Interface
 * All providers extend this base class.
 */

class BaseProvider {
  /**
   * @param {object} config
   * @param {string} config.name - Provider name (e.g. 'ollama', 'openai')
   * @param {string} [config.baseUrl] - API base URL
   * @param {object} [config.models] - Available models { id: { name, maxTokens, contextWindow } }
   */
  constructor(config = {}) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract — use a concrete provider');
    }
    this.name = config.name || 'unknown';
    this.baseUrl = config.baseUrl || '';
    this.models = config.models || {};
    this.defaultModel = config.defaultModel || null;
  }

  /**
   * Check if the provider is configured (API key set, etc.)
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error(`${this.name}: isConfigured() not implemented`);
  }

  /**
   * Get the API key for this provider
   * @returns {string|null}
   */
  getApiKey() {
    return null;
  }

  /**
   * Get available models for this provider
   * @returns {object} { modelId: { id, name, maxTokens, contextWindow } }
   */
  getModels() {
    return this.models;
  }

  /**
   * Get model names
   * @returns {string[]}
   */
  getModelNames() {
    return Object.keys(this.models);
  }

  /**
   * Get model info by id
   * @param {string} modelId
   * @returns {object|null}
   */
  getModel(modelId) {
    return this.models[modelId] || null;
  }

  /**
   * Non-streaming chat call.
   * @param {Array} messages - Normalized messages [{ role, content, tool_calls?, tool_call_id? }]
   * @param {Array} tools - Tool definitions (OpenAI/Ollama format)
   * @param {object} [options] - { model, temperature, maxTokens }
   * @returns {Promise<{content: string, tool_calls: Array}>}
   */
  async chat(messages, tools, options = {}) {
    throw new Error(`${this.name}: chat() not implemented`);
  }

  /**
   * Streaming chat call.
   * @param {Array} messages - Normalized messages
   * @param {Array} tools - Tool definitions
   * @param {object} [options] - { model, temperature, maxTokens, onToken: (text) => void }
   * @returns {Promise<{content: string, tool_calls: Array}>}
   */
  async stream(messages, tools, options = {}) {
    throw new Error(`${this.name}: stream() not implemented`);
  }

  /**
   * Convert normalized messages to provider-specific format.
   * Override in subclasses if the provider uses a different format.
   * @param {Array} messages
   * @returns {object} { messages, system? } - provider-specific format
   */
  formatMessages(messages) {
    return { messages };
  }

  /**
   * Convert tool definitions to provider-specific format.
   * Override if provider uses a different tool format.
   * @param {Array} tools - OpenAI/Ollama format tools
   * @returns {Array}
   */
  formatTools(tools) {
    return tools;
  }

  /**
   * Normalize provider response to standard format.
   * @param {object} raw - Raw provider response
   * @returns {{content: string, tool_calls: Array}}
   */
  normalizeResponse(raw) {
    throw new Error(`${this.name}: normalizeResponse() not implemented`);
  }
}

module.exports = { BaseProvider };

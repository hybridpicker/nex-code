/**
 * cli/providers/deepseek.js — DeepSeek API Provider
 * Uses DeepSeek's OpenAI-compatible chat completions endpoint.
 */

const { OpenAIProvider } = require("./openai");

const DEEPSEEK_MODELS = {
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    maxTokens: 16384,
    contextWindow: 1048576,
    capability: "fast-coding",
    speed: "fast",
    quality: 90,
    recommendedFor: ["coding", "quick-fix", "fallback"],
  },
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    maxTokens: 16384,
    contextWindow: 1048576,
    capability: "agentic",
    speed: "balanced",
    quality: 96,
    recommendedFor: ["coding", "agentic", "reasoning", "review"],
  },
};

class DeepSeekProvider extends OpenAIProvider {
  constructor(config = {}) {
    super({
      name: "deepseek",
      baseUrl:
        config.baseUrl ||
        process.env.DEEPSEEK_BASE_URL ||
        "https://api.deepseek.com",
      models: config.models || DEEPSEEK_MODELS,
      defaultModel: config.defaultModel || "deepseek-v4-flash",
      ...config,
    });
  }

  getApiKey() {
    return process.env.DEEPSEEK_API_KEY || null;
  }

  _getHeaders() {
    const key = this.getApiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY not set");
    return {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  prepareRequestBody(body, options = {}) {
    const thinkingType = options.thinking || process.env.DEEPSEEK_THINKING;
    return {
      ...body,
      thinking:
        thinkingType !== undefined
          ? { type: thinkingType }
          : { type: "disabled" },
    };
  }
}

module.exports = { DeepSeekProvider, DEEPSEEK_MODELS };

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
    thinking: "enabled", // Default thinking on for agentic reasoning
  },
};

class DeepSeekProvider extends OpenAIProvider {
  constructor(config = {}) {
    super({
      name: "deepseek",
      baseUrl:
        config.baseUrl ||
        process.env.DEEPSEEK_BASE_URL ||
        "https://api.deepseek.com/beta",
      models: config.models || DEEPSEEK_MODELS,
      defaultModel: config.defaultModel || "deepseek-v4-flash",
      ...config,
    });
    this.prefersInlineContext = true; // DeepSeek models perform better with file contents pre-loaded
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
    // Resolve thinking type: explicit option > model-level config > env var > disabled.
    const modelId = body?.model || this.defaultModel;
    const modelConfig = this.getModel(modelId);
    const thinkingType =
      options.thinking ??
      modelConfig?.thinking ??
      process.env.DEEPSEEK_THINKING;
    const normalizedThinking = normalizeThinkingType(thinkingType);
    const next = {
      ...body,
      thinking:
        normalizedThinking !== undefined
          ? { type: normalizedThinking }
          : { type: "disabled" },
    };
    if (next.stream) {
      next.stream_options = {
        ...(next.stream_options || {}),
        include_usage: true,
      };
    }
    const reasoningEffort = normalizeReasoningEffort(
      options.reasoningEffort ??
        options.reasoning_effort ??
        process.env.DEEPSEEK_REASONING_EFFORT ??
        (next.thinking?.type === "enabled" ? "high" : null),
    );
    if (reasoningEffort) {
      next.reasoning_effort = reasoningEffort;
    }
    if (
      next.thinking?.type === "enabled" &&
      requiresReasoningContent(modelId)
    ) {
      sanitizeReasoningReplay(next.messages);
    }
    return next;
  }
}

function normalizeThinkingType(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && value.type)
    return normalizeThinkingType(value.type);
  const normalized = String(value).trim().toLowerCase();
  if (["off", "disabled", "none", "false", "0"].includes(normalized)) {
    return "disabled";
  }
  if (["on", "enabled", "true", "1"].includes(normalized)) {
    return "enabled";
  }
  return normalized || undefined;
}

function normalizeReasoningEffort(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (
    !normalized ||
    ["off", "disabled", "none", "false", "0"].includes(normalized)
  ) {
    return null;
  }
  if (["xhigh", "max", "highest"].includes(normalized)) return "max";
  return "high";
}

function requiresReasoningContent(modelId) {
  const lower = String(modelId || "").toLowerCase();
  return (
    lower.includes("deepseek-v4") ||
    lower.startsWith("deepseek-chat") ||
    lower.startsWith("deepseek-reasoner") ||
    lower.includes("reasoner") ||
    lower.includes("-reasoning") ||
    lower.includes("-thinking") ||
    /\bdeepseek-r\d+\b/.test(lower)
  );
}

function sanitizeReasoningReplay(messages) {
  if (!Array.isArray(messages)) return;
  for (const msg of messages) {
    if (msg?.role !== "assistant" || !Array.isArray(msg.tool_calls)) continue;
    if (!msg.reasoning_content || !String(msg.reasoning_content).trim()) {
      msg.reasoning_content = "(reasoning omitted)";
    }
  }
}

module.exports = { DeepSeekProvider, DEEPSEEK_MODELS };

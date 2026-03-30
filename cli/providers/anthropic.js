/**
 * cli/providers/anthropic.js — Anthropic Claude Provider
 * Supports Claude Sonnet, Opus, Haiku via Anthropic Messages API with SSE streaming.
 */

const axios = require("axios");
const { BaseProvider, readStreamErrorBody } = require("./base");
const { anthropicProtocol } = require("./wire-protocols");

const ANTHROPIC_MODELS = {
  "claude-sonnet": {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    maxTokens: 64000,
    contextWindow: 200000,
  },
  "claude-opus": {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    maxTokens: 128000,
    contextWindow: 200000,
  },
  "claude-haiku": {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    maxTokens: 64000,
    contextWindow: 200000,
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5-20250929",
    name: "Claude Sonnet 4.5",
    maxTokens: 64000,
    contextWindow: 200000,
  },
  "claude-sonnet-4": {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    maxTokens: 64000,
    contextWindow: 200000,
  },
};

const ANTHROPIC_VERSION = "2023-06-01";

class AnthropicProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "anthropic",
      baseUrl: config.baseUrl || "https://api.anthropic.com/v1",
      models: config.models || ANTHROPIC_MODELS,
      defaultModel: config.defaultModel || "claude-sonnet",
      ...config,
    });
    this.timeout = config.timeout || 180000;
    this.temperature = config.temperature ?? 0.2;
    this.apiVersion = config.apiVersion || ANTHROPIC_VERSION;
  }

  isConfigured() {
    return !!this.getApiKey();
  }

  getApiKey() {
    return process.env.ANTHROPIC_API_KEY || null;
  }

  _getHeaders() {
    const key = this.getApiKey();
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    return {
      "x-api-key": key,
      "anthropic-version": this.apiVersion,
      "Content-Type": "application/json",
    };
  }

  // Message format cache (per provider instance)
  _messageFormatCache = new WeakMap();
  _messageStringCache = new Map();
  _maxCacheSize = 200;

  /**
   * Convert normalized messages to Anthropic format.
   * Anthropic uses separate system parameter and different tool_use/tool_result blocks.
   */
  formatMessages(messages) {
    let system = "";
    const formatted = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system += (system ? "\n\n" : "") + msg.content;
        continue;
      }

      // Skip caching for tool messages (they need dynamic merging)
      if (
        msg.role !== "system" &&
        msg.role !== "tool" &&
        this._messageFormatCache.has(msg)
      ) {
        formatted.push(this._messageFormatCache.get(msg));
        continue;
      }

      const formattedMsg = this._formatSingleMessage(msg, formatted);

      // Skip if message was merged (null returned)
      if (!formattedMsg) continue;

      // Cache (limit size) - skip tool messages
      if (
        msg.role !== "system" &&
        msg.role !== "tool" &&
        this._messageStringCache.size < this._maxCacheSize
      ) {
        const cacheKey = this._getMessageCacheKey(msg);
        this._messageStringCache.set(cacheKey, formattedMsg);
        this._messageFormatCache.set(msg, formattedMsg);
      }

      formatted.push(formattedMsg);
    }

    // Anthropic requires strictly alternating user/assistant roles.
    // The super-nuclear recovery path can produce consecutive user messages
    // (task + findings + skip-hint). Insert empty assistant turns to fix.
    for (let i = formatted.length - 1; i > 0; i--) {
      if (formatted[i].role === "user" && formatted[i - 1].role === "user") {
        formatted.splice(i, 0, {
          role: "assistant",
          content: [{ type: "text", text: "[continuing]" }],
        });
      }
    }

    return { messages: formatted, system };
  }

  _getMessageCacheKey(msg) {
    const role = msg.role || "";
    const content =
      typeof msg.content === "string" ? msg.content.substring(0, 100) : "";
    const toolCalls = msg.tool_calls ? msg.tool_calls.length : 0;
    return `${role}:${content.length}:${toolCalls}`;
  }

  _formatSingleMessage(msg, formatted = []) {
    if (msg.role === "assistant") {
      const content = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id || `toolu-${Date.now()}`,
            name: tc.function.name,
            input:
              typeof tc.function.arguments === "string"
                ? JSON.parse(tc.function.arguments || "{}")
                : tc.function.arguments || {},
          });
        }
      }
      return {
        role: "assistant",
        content: content.length > 0 ? content : [{ type: "text", text: "" }],
      };
    }

    if (msg.role === "tool") {
      // Anthropic tool results are sent as user messages with tool_result content blocks
      // Merge consecutive tool results into one user message
      const last = formatted[formatted.length - 1];
      const toolResult = {
        type: "tool_result",
        tool_use_id: msg.tool_call_id,
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      };

      if (
        last &&
        last.role === "user" &&
        Array.isArray(last.content) &&
        last.content[0]?.type === "tool_result"
      ) {
        last.content.push(toolResult);
        return null; // Signal to skip pushing (already merged into last)
      }
      return { role: "user", content: [toolResult] };
    }

    // user messages — handle multimodal content (text + images)
    if (Array.isArray(msg.content)) {
      const blocks = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          blocks.push({ type: "text", text: block.text ?? "" });
        } else if (block.type === "image" && block.data) {
          blocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: block.media_type || "image/png",
              data: block.data,
            },
          });
        }
      }
      return { role: "user", content: blocks };
    }
    return { role: "user", content: msg.content };
  }

  /**
   * Convert OpenAI/Ollama tool format to Anthropic tool format.
   * Delegates to wire protocol for format conversion.
   */
  formatTools(tools) {
    return anthropicProtocol.formatTools(tools);
  }

  _resolveModelId(model) {
    const info = this.getModel(model);
    return info?.id || model;
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelId = this._resolveModelId(model);
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 8192;
    const { messages: formatted, system } = this.formatMessages(messages);

    const formattedTools = this.formatTools(tools);
    const body = anthropicProtocol.buildRequestBody({
      model: modelId,
      messages: formatted,
      tools: formattedTools,
      maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: false,
      extra: { system },
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${anthropicProtocol.getEndpoint()}`,
        body,
        {
          timeout: options.timeout || this.timeout,
          headers: this._getHeaders(),
        },
      );
    } catch (err) {
      if (
        err.name === "CanceledError" ||
        err.name === "AbortError" ||
        err.code === "ERR_CANCELED"
      )
        throw err;
      const status = err.response?.status
        ? ` [HTTP ${err.response.status}]`
        : "";
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.error ||
        err.message;
      throw new Error(`API Error${status}: ${msg}`);
    }

    return anthropicProtocol.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelId = this._resolveModelId(model);
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 8192;
    const onToken = options.onToken || (() => {});
    const { messages: formatted, system } = this.formatMessages(messages);

    const formattedTools = this.formatTools(tools);
    const body = anthropicProtocol.buildRequestBody({
      model: modelId,
      messages: formatted,
      tools: formattedTools,
      maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: true,
      extra: { system },
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${anthropicProtocol.getEndpoint()}`,
        body,
        {
          timeout: options.timeout || this.timeout,
          headers: this._getHeaders(),
          responseType: "stream",
          signal: options.signal,
        },
      );
    } catch (err) {
      if (
        err.name === "CanceledError" ||
        err.name === "AbortError" ||
        err.code === "ERR_CANCELED"
      )
        throw err;
      const status = err.response?.status
        ? ` [HTTP ${err.response.status}]`
        : "";
      const msg = await readStreamErrorBody(
        err,
        (p) => p?.error?.message || p?.error,
      );
      throw new Error(`API Error${status}: ${msg}`);
    }

    const parser = anthropicProtocol.createStreamParser(onToken);

    return new Promise((resolve, reject) => {
      if (options.signal) {
        options.signal.addEventListener(
          "abort",
          () => {
            response.data.destroy();
            reject(new DOMException("The operation was aborted", "AbortError"));
          },
          { once: true },
        );
      }

      response.data.on("data", (chunk) => {
        const { done, result } = parser.feed(chunk.toString());
        if (done) resolve(result);
      });

      response.data.on("error", (err) => {
        if (options.signal?.aborted) return;
        reject(new Error(`Stream error: ${err.message}`));
      });

      response.data.on("end", () => {
        resolve(parser.flush());
      });
    });
  }

  normalizeResponse(data) {
    return anthropicProtocol.normalizeResponse(data);
  }
}

module.exports = { AnthropicProvider, ANTHROPIC_MODELS };

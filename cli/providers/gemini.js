/**
 * cli/providers/gemini.js — Google Gemini Provider
 * Supports Gemini 3.x Preview, 2.5 Pro/Flash/Lite, 2.0 Flash (deprecated) via
 * Google's OpenAI-compatible endpoint with SSE streaming.
 */

const axios = require("axios");
const { BaseProvider, readStreamErrorBody } = require("./base");
const { openaiProtocol } = require("./wire-protocols");

const GEMINI_MODELS = {
  // Preview — Gemini 3.x (latest)
  "gemini-3.1-pro-preview": {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    maxTokens: 65536,
    contextWindow: 1048576,
  },
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    maxTokens: 65536,
    contextWindow: 1048576,
  },
  // Stable — Gemini 2.5 (GA)
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    maxTokens: 65536,
    contextWindow: 1048576,
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    maxTokens: 65536,
    contextWindow: 1048576,
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    maxTokens: 65536,
    contextWindow: 1048576,
  },
  // Gemini 2.0 (GA)
  "gemini-2.0-flash": {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    maxTokens: 8192,
    contextWindow: 1048576,
  },
  "gemini-2.0-flash-lite": {
    id: "gemini-2.0-flash-lite",
    name: "Gemini 2.0 Flash Lite",
    maxTokens: 8192,
    contextWindow: 1048576,
  },
  // Legacy/Flash-Lite
  "gemini-1.5-pro": {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    maxTokens: 8192,
    contextWindow: 1048576,
  },
  "gemini-1.5-flash": {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    maxTokens: 8192,
    contextWindow: 1048576,
  },
};

class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "gemini",
      baseUrl:
        config.baseUrl ||
        "https://generativelanguage.googleapis.com/v1beta/openai",
      models: config.models || GEMINI_MODELS,
      defaultModel: config.defaultModel || "gemini-2.5-flash",
      ...config,
    });
    this.timeout = config.timeout || 180000;
    this.temperature = config.temperature ?? 0.2;
  }

  isConfigured() {
    return !!this.getApiKey();
  }

  getApiKey() {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
  }

  _getHeaders() {
    const key = this.getApiKey();
    if (!key) throw new Error("GEMINI_API_KEY not set");
    return {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
  }

  // Message format cache (per provider instance)
  _messageFormatCache = new WeakMap();
  _messageStringCache = new Map();
  _maxCacheSize = 200;

  formatMessages(messages) {
    const formattedMessages = [];

    for (const msg of messages) {
      // Check WeakMap cache first
      if (this._messageFormatCache.has(msg)) {
        formattedMessages.push(this._messageFormatCache.get(msg));
        continue;
      }

      // Check string cache
      const cacheKey = this._getMessageCacheKey(msg);
      if (this._messageStringCache.has(cacheKey)) {
        const cached = this._messageStringCache.get(cacheKey);
        this._messageFormatCache.set(msg, cached);
        formattedMessages.push(cached);
        continue;
      }

      // Format message
      const formatted = this._formatSingleMessage(msg);

      // Cache (limit size)
      if (this._messageStringCache.size < this._maxCacheSize) {
        this._messageStringCache.set(cacheKey, formatted);
      }
      this._messageFormatCache.set(msg, formatted);

      formattedMessages.push(formatted);
    }

    return { messages: formattedMessages };
  }

  _getMessageCacheKey(msg) {
    const role = msg.role || "";
    const content =
      typeof msg.content === "string" ? msg.content.substring(0, 100) : "";
    const toolCalls = msg.tool_calls ? msg.tool_calls.length : 0;
    return `${role}:${content.length}:${toolCalls}`;
  }

  _formatSingleMessage(msg) {
    if (msg.role === "assistant" && msg.tool_calls) {
      return {
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id || `call-${Date.now()}`,
          type: "function",
          function: {
            name: tc.function.name,
            arguments:
              typeof tc.function.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function.arguments),
          },
        })),
      };
    }
    if (msg.role === "tool") {
      return {
        role: "tool",
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
        tool_call_id: msg.tool_call_id,
      };
    }
    // Handle multimodal content (text + images) for user messages
    if (msg.role === "user" && Array.isArray(msg.content)) {
      const blocks = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          blocks.push({ type: "text", text: block.text ?? "" });
        } else if (block.type === "image" && block.data) {
          const url = block.data.startsWith("data:")
            ? block.data
            : `data:${block.media_type || "image/png"};base64,${block.data}`;
          blocks.push({
            type: "image_url",
            image_url: { url, detail: "auto" },
          });
        }
      }
      return { role: "user", content: blocks };
    }
    return { role: msg.role, content: msg.content };
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 8192;
    const { messages: formatted } = this.formatMessages(messages);

    const body = openaiProtocol.buildRequestBody({
      model,
      messages: formatted,
      tools,
      maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: false,
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${openaiProtocol.getEndpoint()}`,
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

    return openaiProtocol.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 8192;
    const onToken = options.onToken || (() => {});
    const { messages: formatted } = this.formatMessages(messages);

    const body = openaiProtocol.buildRequestBody({
      model,
      messages: formatted,
      tools,
      maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: true,
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${openaiProtocol.getEndpoint()}`,
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

    const parser = openaiProtocol.createStreamParser(onToken);

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
    return openaiProtocol.normalizeResponse(data);
  }
}

module.exports = { GeminiProvider, GEMINI_MODELS };

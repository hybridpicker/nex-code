/**
 * cli/providers/openai.js — OpenAI-compatible Provider
 * Supports GPT-4o, o1, o3, GPT-4o-mini via OpenAI API with SSE streaming.
 * Uses OpenAI-compatible wire protocol for request/response handling.
 */

const axios = require("axios");
const { BaseProvider, readStreamErrorBody } = require("./base");
const { openaiProtocol } = require("./wire-protocols");

const OPENAI_MODELS = {
  "gpt-4o": {
    id: "gpt-4o",
    name: "GPT-4o",
    maxTokens: 16384,
    contextWindow: 128000,
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    maxTokens: 16384,
    contextWindow: 128000,
  },
  "gpt-4.1": {
    id: "gpt-4.1",
    name: "GPT-4.1",
    maxTokens: 32768,
    contextWindow: 128000,
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    maxTokens: 32768,
    contextWindow: 128000,
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    maxTokens: 16384,
    contextWindow: 128000,
  },
  o1: { id: "o1", name: "o1", maxTokens: 100000, contextWindow: 200000 },
  o3: { id: "o3", name: "o3", maxTokens: 100000, contextWindow: 200000 },
  "o3-mini": {
    id: "o3-mini",
    name: "o3 Mini",
    maxTokens: 65536,
    contextWindow: 200000,
  },
  "o4-mini": {
    id: "o4-mini",
    name: "o4 Mini",
    maxTokens: 100000,
    contextWindow: 200000,
  },
};

class OpenAIProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "openai",
      baseUrl: config.baseUrl || "https://api.openai.com/v1",
      models: config.models || OPENAI_MODELS,
      defaultModel: config.defaultModel || "gpt-4o",
      ...config,
    });
    this.timeout = config.timeout || 180000;
    this.temperature = config.temperature ?? 0.2;
  }

  isConfigured() {
    return !!this.getApiKey();
  }

  getApiKey() {
    return process.env.OPENAI_API_KEY || null;
  }

  _getHeaders() {
    const key = this.getApiKey();
    if (!key) throw new Error("OPENAI_API_KEY not set");
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
        content: msg.content || null,
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
      // Extract text from multimodal tool results (images handled separately)
      let content;
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text);
        content = textParts.join("\n") || JSON.stringify(msg.content);
      } else {
        content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
      }
      return {
        role: "tool",
        content,
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

  prepareRequestBody(body, _options = {}) {
    return body;
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;
    const { messages: formatted } = this.formatMessages(messages);

    const body = this.prepareRequestBody(
      openaiProtocol.buildRequestBody({
        model,
        messages: formatted,
        tools,
        maxTokens,
        temperature: options.temperature ?? this.temperature,
        stream: false,
      }),
      options,
    );

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
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;
    const onToken = options.onToken || (() => {});
    const { messages: formatted } = this.formatMessages(messages);

    const body = this.prepareRequestBody(
      openaiProtocol.buildRequestBody({
        model,
        messages: formatted,
        tools,
        maxTokens,
        temperature: options.temperature ?? this.temperature,
        stream: true,
      }),
      options,
    );

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

module.exports = { OpenAIProvider, OPENAI_MODELS };

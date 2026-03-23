/**
 * cli/providers/openai.js — OpenAI-compatible Provider
 * Supports GPT-4o, o1, o3, GPT-4o-mini via OpenAI API with SSE streaming.
 */

const axios = require("axios");
const { BaseProvider, readStreamErrorBody } = require("./base");
const { serializeMessage } = require("../context-engine");

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
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;
    const { messages: formatted } = this.formatMessages(messages);

    const body = {
      model,
      messages: formatted,
      max_tokens: maxTokens,
      temperature: options.temperature ?? this.temperature,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    let response;
    try {
      response = await axios.post(`${this.baseUrl}/chat/completions`, body, {
        timeout: options.timeout || this.timeout,
        headers: this._getHeaders(),
      });
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

    return this.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;
    const onToken = options.onToken || (() => {});
    const { messages: formatted } = this.formatMessages(messages);

    const body = {
      model,
      messages: formatted,
      max_tokens: maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: true,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    let response;
    try {
      response = await axios.post(`${this.baseUrl}/chat/completions`, body, {
        timeout: options.timeout || this.timeout,
        headers: this._getHeaders(),
        responseType: "stream",
        signal: options.signal,
      });
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

    return new Promise((resolve, reject) => {
      let content = "";
      const toolCallsMap = {}; // index -> { id, name, arguments }
      let buffer = "";

      // Abort listener: destroy stream on signal
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
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            resolve({
              content,
              tool_calls: this._buildToolCalls(toolCallsMap),
            });
            return;
          }

          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            onToken(delta.content);
            content += delta.content;
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsMap[idx]) {
                toolCallsMap[idx] = {
                  id: tc.id || "",
                  name: "",
                  arguments: "",
                };
              }
              if (tc.id) toolCallsMap[idx].id = tc.id;
              if (tc.function?.name) toolCallsMap[idx].name += tc.function.name;
              if (tc.function?.arguments)
                toolCallsMap[idx].arguments += tc.function.arguments;
            }
          }
        }
      });

      response.data.on("error", (err) => {
        if (options.signal?.aborted) return; // Ignore errors after abort
        reject(new Error(`Stream error: ${err.message}`));
      });

      response.data.on("end", () => {
        resolve({ content, tool_calls: this._buildToolCalls(toolCallsMap) });
      });
    });
  }

  normalizeResponse(data) {
    const choice = data.choices?.[0]?.message || {};
    const toolCalls = (choice.tool_calls || []).map((tc) => ({
      id: tc.id,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content: choice.content || "",
      tool_calls: toolCalls,
    };
  }

  _buildToolCalls(toolCallsMap) {
    return Object.values(toolCallsMap)
      .filter((tc) => tc.name)
      .map((tc) => ({
        id: tc.id || `openai-${Date.now()}`,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));
  }
}

module.exports = { OpenAIProvider, OPENAI_MODELS };

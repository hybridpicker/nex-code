/**
 * cli/providers/ollama.js — Ollama Cloud Provider
 * Connects to https://ollama.com API with Bearer auth and NDJSON streaming.
 */

const axios = require("axios");
const http = require("http");
const https = require("https");
const { BaseProvider, readStreamErrorBody } = require("./base");
const { ollamaProtocol } = require("./wire-protocols");

// Persistent keep-alive agents — reuse TCP connections across all Ollama Cloud requests.
// Eliminates 50-100ms TLS handshake overhead on every API call.
const _keepAliveHttp = new http.Agent({
  keepAlive: true,
  maxSockets: 6,
  timeout: 60000,
});
const _keepAliveHttps = new https.Agent({
  keepAlive: true,
  maxSockets: 6,
  timeout: 60000,
});

const OLLAMA_MODELS = {
  // Primary: Best coding models for agentic workflows (2026)
  "qwen3-coder:480b": {
    id: "qwen3-coder:480b",
    name: "Qwen3 Coder 480B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "qwen3-coder-next": {
    id: "qwen3-coder-next",
    name: "Qwen3 Coder Next",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  "devstral-2:123b": {
    id: "devstral-2:123b",
    name: "Devstral 2 123B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "devstral-small-2:24b": {
    id: "devstral-small-2:24b",
    name: "Devstral Small 2 24B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "minimax-m2.7:cloud": {
    id: "minimax-m2.7:cloud",
    name: "MiniMax M2.7 Cloud",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  // Large general-purpose models
  "kimi-k2.5": {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    maxTokens: 16384,
    contextWindow: 256000,
  },
  "kimi-k2:1t": {
    id: "kimi-k2:1t",
    name: "Kimi K2 1T",
    maxTokens: 16384,
    contextWindow: 256000,
  },
  "kimi-k2-thinking": {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    maxTokens: 16384,
    contextWindow: 256000,
  },
  "deepseek-v3.2": {
    id: "deepseek-v3.2",
    name: "DeepSeek V3.2",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "deepseek-v3.1:671b": {
    id: "deepseek-v3.1:671b",
    name: "DeepSeek V3.1 671B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "cogito-2.1:671b": {
    id: "cogito-2.1:671b",
    name: "Cogito 2.1 671B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  // Qwen3.5 models - Native vision-language models with 256K context
  "qwen3.5:397b-cloud": {
    id: "qwen3.5:397b-cloud",
    name: "Qwen3.5 397B Cloud",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  "qwen3.5:397b": {
    id: "qwen3.5:397b",
    name: "Qwen3.5 397B",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  "qwen3.5:122b-a10b": {
    id: "qwen3.5:122b-a10b",
    name: "Qwen3.5 122B-A10B",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  "qwen3.5:35b-a3b": {
    id: "qwen3.5:35b-a3b",
    name: "Qwen3.5 35B-A3B",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  "qwen3.5:27b": {
    id: "qwen3.5:27b",
    name: "Qwen3.5 27B",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  // Medium models
  "qwen3-next:80b": {
    id: "qwen3-next:80b",
    name: "Qwen3 Next 80B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "mistral-large-3:675b": {
    id: "mistral-large-3:675b",
    name: "Mistral Large 3 675B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "gpt-oss:120b": {
    id: "gpt-oss:120b",
    name: "GPT-OSS 120B",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "minimax-m2.5": {
    id: "minimax-m2.5",
    name: "MiniMax M2.5",
    maxTokens: 16384,
    contextWindow: 131072,
  },
  "glm-5:cloud": {
    id: "glm-5:cloud",
    name: "GLM 5 Cloud",
    maxTokens: 16384,
    contextWindow: 200000,
  },
  "glm-5": {
    id: "glm-5",
    name: "GLM 5",
    maxTokens: 16384,
    contextWindow: 200000,
  },
  "glm-4.6": {
    id: "glm-4.6",
    name: "GLM 4.6",
    maxTokens: 16384,
    contextWindow: 200000,
  },
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM 4.7",
    maxTokens: 16384,
    contextWindow: 128000,
  },
  "nemotron-3-super:cloud": {
    id: "nemotron-3-super:cloud",
    name: "Nemotron 3 Super Cloud",
    maxTokens: 16384,
    contextWindow: 262144,
  },
  // Small / fast models
  "qwen3.5:9b": {
    id: "qwen3.5:9b",
    name: "Qwen3.5 9B",
    maxTokens: 8192,
    contextWindow: 262144,
  },
  "qwen3.5:4b": {
    id: "qwen3.5:4b",
    name: "Qwen3.5 4B",
    maxTokens: 8192,
    contextWindow: 262144,
  },
  "qwen3.5:2b": {
    id: "qwen3.5:2b",
    name: "Qwen3.5 2B",
    maxTokens: 8192,
    contextWindow: 262144,
  },
  "qwen3.5:0.8b": {
    id: "qwen3.5:0.8b",
    name: "Qwen3.5 0.8B",
    maxTokens: 8192,
    contextWindow: 262144,
  },
  "gemma3:27b": {
    id: "gemma3:27b",
    name: "Gemma 3 27B",
    maxTokens: 8192,
    contextWindow: 131072,
  },
  "gemma3:12b": {
    id: "gemma3:12b",
    name: "Gemma 3 12B",
    maxTokens: 8192,
    contextWindow: 131072,
  },
  "gemma3:4b": {
    id: "gemma3:4b",
    name: "Gemma 3 4B",
    maxTokens: 8192,
    contextWindow: 131072,
  },
  "ministral-3:14b": {
    id: "ministral-3:14b",
    name: "Ministral 3 14B",
    maxTokens: 8192,
    contextWindow: 131072,
  },
  "ministral-3:8b": {
    id: "ministral-3:8b",
    name: "Ministral 3 8B",
    maxTokens: 8192,
    contextWindow: 131072,
  },
  // Special
  "gemini-3-flash-preview": {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    maxTokens: 16384,
    contextWindow: 131072,
  },
};

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "ollama",
      baseUrl: config.baseUrl || "https://ollama.com",
      models: config.models || OLLAMA_MODELS,
      defaultModel: config.defaultModel || "qwen3-coder:480b",
      ...config,
    });
    this.timeout = config.timeout || 180000;
    this.temperature = config.temperature ?? 0.2;
    this._discovered = false;
  }

  /**
   * Discover available models from the Ollama API.
   * Merges discovered models with the hardcoded fallback list.
   * Cached after first call.
   */
  async discoverModels() {
    if (this._discovered) return;
    this._discovered = true;
    // In headless/non-TTY mode: fire-and-forget — don't block the first API call
    if (!process.stdout.isTTY) {
      axios
        .get(`${this.baseUrl}/api/tags`, {
          timeout: 5000,
          headers: this._getHeaders(),
          httpAgent: _keepAliveHttp,
          httpsAgent: _keepAliveHttps,
        })
        .then((resp) => {
          const tags = resp.data?.models || [];
          for (const m of tags) {
            const id = (m.name || m.model || "").replace(/:latest$/, "");
            if (!id || this.models[id]) continue;
            this.models[id] = {
              id,
              name: m.name || id,
              maxTokens: 16384,
              contextWindow: 131072,
            };
          }
        })
        .catch(() => {
          /* API unavailable — use hardcoded list */
        });
      return;
    }
    try {
      const resp = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
        headers: this._getHeaders(),
        httpAgent: _keepAliveHttp,
        httpsAgent: _keepAliveHttps,
      });
      const tags = resp.data?.models || [];
      for (const m of tags) {
        const id = (m.name || m.model || "").replace(/:latest$/, "");
        if (!id || this.models[id]) continue;
        this.models[id] = {
          id,
          name: m.name || id,
          maxTokens: 16384,
          contextWindow: 131072,
        };
      }
    } catch {
      /* API unavailable — use hardcoded list */
    }
  }

  isConfigured() {
    return !!this.getApiKey();
  }

  getApiKey() {
    return process.env.OLLAMA_API_KEY || null;
  }

  _getHeaders() {
    const key = this.getApiKey();
    if (!key) throw new Error("OLLAMA_API_KEY not set");
    return { Authorization: `Bearer ${key}` };
  }

  // Convert internal multimodal messages to Ollama /api/chat format.
  // Ollama vision models use { content: string, images: ['base64...'] } at message level.
  _formatMessages(messages) {
    return messages.map((msg) => {
      if (msg.role === "user" && Array.isArray(msg.content)) {
        const textParts = [];
        const images = [];
        for (const block of msg.content) {
          if (block.type === "text") textParts.push(block.text ?? "");
          else if (block.type === "image" && block.data)
            images.push(block.data);
        }
        const formatted = { role: "user", content: textParts.join("\n") };
        if (images.length > 0) formatted.images = images;
        return formatted;
      }
      return msg;
    });
  }

  async chat(messages, tools, options = {}) {
    await this.discoverModels();
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;

    const body = ollamaProtocol.buildRequestBody({
      model,
      messages: this._formatMessages(messages),
      tools,
      maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: false,
      extra: { repeat_penalty: options.repeat_penalty },
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${ollamaProtocol.getEndpoint()}`,
        body,
        {
          timeout: options.timeout || this.timeout,
          headers: this._getHeaders(),
          httpAgent: _keepAliveHttp,
          httpsAgent: _keepAliveHttps,
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
      const msg = err.response?.data?.error || err.message;
      throw new Error(`API Error${status}: ${msg}`);
    }

    return ollamaProtocol.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    await this.discoverModels();
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;
    const onToken = options.onToken || (() => {});
    const onThinkingToken = options.onThinkingToken || (() => {});

    const body = ollamaProtocol.buildRequestBody({
      model,
      messages: this._formatMessages(messages),
      tools,
      maxTokens,
      temperature: options.temperature ?? this.temperature,
      stream: true,
      extra: { repeat_penalty: options.repeat_penalty },
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${ollamaProtocol.getEndpoint()}`,
        body,
        {
          timeout: options.timeout || this.timeout,
          headers: this._getHeaders(),
          responseType: "stream",
          signal: options.signal,
          httpAgent: _keepAliveHttp,
          httpsAgent: _keepAliveHttps,
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
      const msg = await readStreamErrorBody(err, (p) => p?.error);
      throw new Error(`API Error${status}: ${msg}`);
    }

    const parser = ollamaProtocol.createStreamParser(onToken, {
      onThinkingToken,
    });

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
    return ollamaProtocol.normalizeResponse(data);
  }
}

module.exports = { OllamaProvider, OLLAMA_MODELS };

/**
 * cli/providers/local.js — Local Ollama Server Provider
 * Connects to localhost:11434 (default Ollama install). No auth required.
 * Auto-detects available models via /api/tags.
 */

const axios = require("axios");
const { BaseProvider, readStreamErrorBody } = require("./base");
const { ollamaProtocol } = require("./wire-protocols");

const DEFAULT_LOCAL_URL = "http://localhost:11434";

class LocalProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "local",
      baseUrl:
        config.baseUrl ||
        process.env.OLLAMA_HOST ||
        process.env.OLLAMA_LOCAL_URL ||
        DEFAULT_LOCAL_URL,
      models: config.models || {},
      defaultModel: config.defaultModel || null,
      ...config,
    });
    this.timeout = config.timeout || 300000;
    this.temperature = config.temperature ?? 0.2;
    this._modelsLoaded = false;
  }

  isConfigured() {
    return true; // No API key needed
  }

  /**
   * Fetch available models from local Ollama server.
   * Caches result after first call.
   */
  async loadModels() {
    if (this._modelsLoaded) return this.models;

    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      const tags = response.data?.models || [];

      this.models = {};
      for (const m of tags) {
        const name = m.name || m.model;
        if (!name) continue;
        const id = name.replace(/:latest$/, "");

        // Try to get actual context window from model metadata
        let contextWindow = 32768; // Conservative fallback
        try {
          const showResp = await axios.post(
            `${this.baseUrl}/api/show`,
            { name },
            { timeout: 5000 },
          );
          const params =
            showResp.data?.model_info || showResp.data?.details || {};
          // Ollama exposes context length in model_info
          contextWindow =
            params["general.context_length"] ||
            params["llama.context_length"] ||
            this._parseContextFromModelfile(showResp.data?.modelfile) ||
            32768;
        } catch {
          // /api/show failed — use fallback
        }

        this.models[id] = {
          id,
          name: m.name,
          maxTokens: Math.min(8192, Math.floor(contextWindow * 0.1)),
          contextWindow,
        };
      }

      if (!this.defaultModel && Object.keys(this.models).length > 0) {
        this.defaultModel = Object.keys(this.models)[0];
      }

      this._modelsLoaded = true;
    } catch {
      // Server not running or unreachable
      this.models = {};
      this._modelsLoaded = false;
    }

    return this.models;
  }

  getModels() {
    return this.models;
  }

  getModelNames() {
    return Object.keys(this.models);
  }

  // Convert internal multimodal messages to Ollama /api/chat format.
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
    if (!this._modelsLoaded) await this.loadModels();

    const model = options.model || this.defaultModel;
    if (!model) throw new Error("No local model available. Is Ollama running?");

    const body = ollamaProtocol.buildRequestBody({
      model,
      messages: this._formatMessages(messages),
      tools,
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature ?? this.temperature,
      stream: false,
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${ollamaProtocol.getEndpoint()}`,
        body,
        { timeout: options.timeout || this.timeout },
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
    if (!this._modelsLoaded) await this.loadModels();

    const model = options.model || this.defaultModel;
    if (!model) throw new Error("No local model available. Is Ollama running?");
    const onToken = options.onToken || (() => {});

    const body = ollamaProtocol.buildRequestBody({
      model,
      messages: this._formatMessages(messages),
      tools,
      maxTokens: options.maxTokens || 8192,
      temperature: options.temperature ?? this.temperature,
      stream: true,
    });

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}${ollamaProtocol.getEndpoint()}`,
        body,
        {
          timeout: options.timeout || this.timeout,
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
      const msg = await readStreamErrorBody(err, (p) => p?.error);
      throw new Error(`API Error${status}: ${msg}`);
    }

    const parser = ollamaProtocol.createStreamParser(onToken);

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

  /**
   * Parse num_ctx from Ollama modelfile string.
   * Modelfiles contain lines like: PARAMETER num_ctx 131072
   */
  _parseContextFromModelfile(modelfile) {
    if (!modelfile) return null;
    const match = modelfile.match(/PARAMETER\s+num_ctx\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

}

module.exports = { LocalProvider, DEFAULT_LOCAL_URL };

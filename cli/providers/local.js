/**
 * cli/providers/local.js — Local Ollama Server Provider
 * Connects to localhost:11434 (default Ollama install). No auth required.
 * Auto-detects available models via /api/tags.
 */

const axios = require('axios');
const { BaseProvider } = require('./base');

const DEFAULT_LOCAL_URL = 'http://localhost:11434';

class LocalProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'local',
      baseUrl: config.baseUrl || process.env.OLLAMA_HOST || process.env.OLLAMA_LOCAL_URL || DEFAULT_LOCAL_URL,
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
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      const tags = response.data?.models || [];

      this.models = {};
      for (const m of tags) {
        const name = m.name || m.model;
        if (!name) continue;
        const id = name.replace(/:latest$/, '');

        // Try to get actual context window from model metadata
        let contextWindow = 32768; // Conservative fallback
        try {
          const showResp = await axios.post(
            `${this.baseUrl}/api/show`,
            { name },
            { timeout: 5000 }
          );
          const params = showResp.data?.model_info || showResp.data?.details || {};
          // Ollama exposes context length in model_info
          contextWindow = params['general.context_length']
            || params['llama.context_length']
            || this._parseContextFromModelfile(showResp.data?.modelfile)
            || 32768;
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

  async chat(messages, tools, options = {}) {
    if (!this._modelsLoaded) await this.loadModels();

    const model = options.model || this.defaultModel;
    if (!model) throw new Error('No local model available. Is Ollama running?');

    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        stream: false,
        options: {
          temperature: options.temperature ?? this.temperature,
          num_predict: options.maxTokens || 8192,
        },
      },
      { timeout: options.timeout || this.timeout }
    );

    return this.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    if (!this._modelsLoaded) await this.loadModels();

    const model = options.model || this.defaultModel;
    if (!model) throw new Error('No local model available. Is Ollama running?');
    const onToken = options.onToken || (() => {});

    let response;
    try {
      response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model,
          messages,
          tools: tools && tools.length > 0 ? tools : undefined,
          stream: true,
          options: {
            temperature: options.temperature ?? this.temperature,
            num_predict: options.maxTokens || 8192,
          },
        },
        {
          timeout: options.timeout || this.timeout,
          responseType: 'stream',
          signal: options.signal,
        }
      );
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') throw err;
      const msg = err.response?.data?.error || err.message;
      throw new Error(`API Error: ${msg}`);
    }

    return new Promise((resolve, reject) => {
      let content = '';
      let toolCalls = [];
      let buffer = '';
      const CHUNK_TIMEOUT = 60000; // 60s without data → stall
      let chunkTimer = setTimeout(() => {
        response.data.destroy();
        reject(new Error('Stream stalled: no data received for 60s'));
      }, CHUNK_TIMEOUT);

      const resetChunkTimer = () => {
        clearTimeout(chunkTimer);
        chunkTimer = setTimeout(() => {
          response.data.destroy();
          reject(new Error('Stream stalled: no data received for 60s'));
        }, CHUNK_TIMEOUT);
      };

      // Abort listener: destroy stream on signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(chunkTimer);
          response.data.destroy();
          reject(new DOMException('The operation was aborted', 'AbortError'));
        }, { once: true });
      }

      response.data.on('data', (chunk) => {
        resetChunkTimer();
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }

          if (parsed.message?.content) {
            onToken(parsed.message.content);
            content += parsed.message.content;
          }

          if (parsed.message?.tool_calls) {
            toolCalls = toolCalls.concat(parsed.message.tool_calls);
          }

          if (parsed.done) {
            clearTimeout(chunkTimer);
            resolve({ content, tool_calls: this._normalizeToolCalls(toolCalls) });
            return;
          }
        }
      });

      response.data.on('error', (err) => {
        clearTimeout(chunkTimer);
        if (options.signal?.aborted) return; // Ignore errors after abort
        reject(new Error(`Stream error: ${err.message}`));
      });

      response.data.on('end', () => {
        clearTimeout(chunkTimer);
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.message?.content) {
              onToken(parsed.message.content);
              content += parsed.message.content;
            }
            if (parsed.message?.tool_calls) {
              toolCalls = toolCalls.concat(parsed.message.tool_calls);
            }
          } catch {
            /* ignore */
          }
        }
        resolve({ content, tool_calls: this._normalizeToolCalls(toolCalls) });
      });
    });
  }

  normalizeResponse(data) {
    const msg = data.message || {};
    return {
      content: msg.content || '',
      tool_calls: this._normalizeToolCalls(msg.tool_calls || []),
    };
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

  _normalizeToolCalls(toolCalls) {
    return toolCalls.map((tc, i) => ({
      id: tc.id || `local-${Date.now()}-${i}`,
      function: {
        name: tc.function?.name || tc.name || 'unknown',
        arguments: tc.function?.arguments || tc.arguments || {},
      },
    }));
  }
}

module.exports = { LocalProvider, DEFAULT_LOCAL_URL };

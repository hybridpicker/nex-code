/**
 * cli/providers/ollama.js — Ollama Cloud Provider
 * Connects to https://ollama.com API with Bearer auth and NDJSON streaming.
 */

const axios = require('axios');
const { BaseProvider } = require('./base');

const OLLAMA_MODELS = {
  'kimi-k2.5': { id: 'kimi-k2.5', name: 'Kimi K2.5', maxTokens: 16384, contextWindow: 131072 },
  'qwen3-coder': { id: 'qwen3-coder', name: 'Qwen3 Coder', maxTokens: 16384, contextWindow: 131072 },
};

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'ollama',
      baseUrl: config.baseUrl || 'https://ollama.com',
      models: config.models || OLLAMA_MODELS,
      defaultModel: config.defaultModel || 'kimi-k2.5',
      ...config,
    });
    this.timeout = config.timeout || 180000;
    this.temperature = config.temperature ?? 0.2;
  }

  isConfigured() {
    return !!this.getApiKey();
  }

  getApiKey() {
    return process.env.OLLAMA_API_KEY || null;
  }

  _getHeaders() {
    const key = this.getApiKey();
    if (!key) throw new Error('OLLAMA_API_KEY not set');
    return { Authorization: `Bearer ${key}` };
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;

    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        stream: false,
        options: { temperature: options.temperature ?? this.temperature, num_predict: maxTokens },
      },
      { timeout: options.timeout || this.timeout, headers: this._getHeaders() }
    );

    return this.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 16384;
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
          options: { temperature: options.temperature ?? this.temperature, num_predict: maxTokens },
        },
        {
          timeout: options.timeout || this.timeout,
          headers: this._getHeaders(),
          responseType: 'stream',
        }
      );
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      throw new Error(`API Error: ${msg}`);
    }

    return new Promise((resolve, reject) => {
      let content = '';
      let toolCalls = [];
      let buffer = '';

      response.data.on('data', (chunk) => {
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
            resolve({ content, tool_calls: this._normalizeToolCalls(toolCalls) });
            return;
          }
        }
      });

      response.data.on('error', (err) => {
        reject(new Error(`Stream error: ${err.message}`));
      });

      response.data.on('end', () => {
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

  _normalizeToolCalls(toolCalls) {
    return toolCalls.map((tc, i) => ({
      id: tc.id || `ollama-${Date.now()}-${i}`,
      function: {
        name: tc.function?.name || tc.name || 'unknown',
        arguments: tc.function?.arguments || tc.arguments || {},
      },
    }));
  }
}

module.exports = { OllamaProvider, OLLAMA_MODELS };

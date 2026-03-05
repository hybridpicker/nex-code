/**
 * cli/providers/ollama.js — Ollama Cloud Provider
 * Connects to https://ollama.com API with Bearer auth and NDJSON streaming.
 */

const axios = require('axios');
const { BaseProvider } = require('./base');

const OLLAMA_MODELS = {
  // Primary: Best coding models for agentic workflows
  'qwen3-coder:480b': { id: 'qwen3-coder:480b', name: 'Qwen3 Coder 480B', maxTokens: 16384, contextWindow: 131072 },
  'qwen3-coder-next': { id: 'qwen3-coder-next', name: 'Qwen3 Coder Next', maxTokens: 16384, contextWindow: 131072 },
  'devstral-2:123b': { id: 'devstral-2:123b', name: 'Devstral 2 123B', maxTokens: 16384, contextWindow: 131072 },
  'devstral-small-2:24b': { id: 'devstral-small-2:24b', name: 'Devstral Small 2 24B', maxTokens: 16384, contextWindow: 131072 },
  // Large general-purpose models
  'kimi-k2.5': { id: 'kimi-k2.5', name: 'Kimi K2.5', maxTokens: 16384, contextWindow: 256000 },
  'kimi-k2:1t': { id: 'kimi-k2:1t', name: 'Kimi K2 1T', maxTokens: 16384, contextWindow: 256000 },
  'kimi-k2-thinking': { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking', maxTokens: 16384, contextWindow: 256000 },
  'deepseek-v3.2': { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', maxTokens: 16384, contextWindow: 131072 },
  'deepseek-v3.1:671b': { id: 'deepseek-v3.1:671b', name: 'DeepSeek V3.1 671B', maxTokens: 16384, contextWindow: 131072 },
  'cogito-2.1:671b': { id: 'cogito-2.1:671b', name: 'Cogito 2.1 671B', maxTokens: 16384, contextWindow: 131072 },
  // Qwen3.5 models - Native vision-language models with 256K context
  'qwen3.5:397b-cloud': { id: 'qwen3.5:397b-cloud', name: 'Qwen3.5 397B Cloud', maxTokens: 16384, contextWindow: 262144 },
  'qwen3.5:397b': { id: 'qwen3.5:397b', name: 'Qwen3.5 397B', maxTokens: 16384, contextWindow: 262144 },
  'qwen3.5:122b-a10b': { id: 'qwen3.5:122b-a10b', name: 'Qwen3.5 122B-A10B', maxTokens: 16384, contextWindow: 262144 },
  'qwen3.5:35b-a3b': { id: 'qwen3.5:35b-a3b', name: 'Qwen3.5 35B-A3B', maxTokens: 16384, contextWindow: 262144 },
  'qwen3.5:27b': { id: 'qwen3.5:27b', name: 'Qwen3.5 27B', maxTokens: 16384, contextWindow: 262144 },
  // Medium models
  'qwen3-next:80b': { id: 'qwen3-next:80b', name: 'Qwen3 Next 80B', maxTokens: 16384, contextWindow: 131072 },
  'qwen3.5:397b': { id: 'qwen3.5:397b', name: 'Qwen3.5 397B', maxTokens: 16384, contextWindow: 131072 },
  'mistral-large-3:675b': { id: 'mistral-large-3:675b', name: 'Mistral Large 3 675B', maxTokens: 16384, contextWindow: 131072 },
  'gpt-oss:120b': { id: 'gpt-oss:120b', name: 'GPT-OSS 120B', maxTokens: 16384, contextWindow: 131072 },
  'minimax-m2.5': { id: 'minimax-m2.5', name: 'MiniMax M2.5', maxTokens: 16384, contextWindow: 131072 },
  'glm-5': { id: 'glm-5', name: 'GLM 5', maxTokens: 16384, contextWindow: 128000 },
  'glm-4.7': { id: 'glm-4.7', name: 'GLM 4.7', maxTokens: 16384, contextWindow: 128000 },
  // Small / fast models
  'qwen3.5:9b': { id: 'qwen3.5:9b', name: 'Qwen3.5 9B', maxTokens: 8192, contextWindow: 262144 },
  'qwen3.5:4b': { id: 'qwen3.5:4b', name: 'Qwen3.5 4B', maxTokens: 8192, contextWindow: 262144 },
  'qwen3.5:2b': { id: 'qwen3.5:2b', name: 'Qwen3.5 2B', maxTokens: 8192, contextWindow: 262144 },
  'qwen3.5:0.8b': { id: 'qwen3.5:0.8b', name: 'Qwen3.5 0.8B', maxTokens: 8192, contextWindow: 262144 },
  'gemma3:27b': { id: 'gemma3:27b', name: 'Gemma 3 27B', maxTokens: 8192, contextWindow: 131072 },
  'gemma3:12b': { id: 'gemma3:12b', name: 'Gemma 3 12B', maxTokens: 8192, contextWindow: 131072 },
  'gemma3:4b': { id: 'gemma3:4b', name: 'Gemma 3 4B', maxTokens: 8192, contextWindow: 131072 },
  'ministral-3:14b': { id: 'ministral-3:14b', name: 'Ministral 3 14B', maxTokens: 8192, contextWindow: 131072 },
  'ministral-3:8b': { id: 'ministral-3:8b', name: 'Ministral 3 8B', maxTokens: 8192, contextWindow: 131072 },
  // Special
  'gemini-3-flash-preview': { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', maxTokens: 16384, contextWindow: 131072 },
};

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'ollama',
      baseUrl: config.baseUrl || 'https://ollama.com',
      models: config.models || OLLAMA_MODELS,
      defaultModel: config.defaultModel || 'qwen3-coder:480b',
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
    try {
      const resp = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000, headers: this._getHeaders(),
      });
      const tags = resp.data?.models || [];
      for (const m of tags) {
        const id = (m.name || m.model || '').replace(/:latest$/, '');
        if (!id || this.models[id]) continue;
        this.models[id] = { id, name: m.name || id, maxTokens: 16384, contextWindow: 131072 };
      }
    } catch { /* API unavailable — use hardcoded list */ }
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
    await this.discoverModels();
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
    await this.discoverModels();
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

      // Abort listener: destroy stream on signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          response.data.destroy();
          reject(new DOMException('The operation was aborted', 'AbortError'));
        }, { once: true });
      }

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
        if (options.signal?.aborted) return; // Ignore errors after abort
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

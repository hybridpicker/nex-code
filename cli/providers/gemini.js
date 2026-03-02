/**
 * cli/providers/gemini.js — Google Gemini Provider
 * Supports Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash, 2.0 Flash Lite via
 * Google's OpenAI-compatible endpoint with SSE streaming.
 */

const axios = require('axios');
const { BaseProvider } = require('./base');

const GEMINI_MODELS = {
  'gemini-2.5-pro': { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', maxTokens: 65536, contextWindow: 1048576 },
  'gemini-2.5-flash': { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', maxTokens: 65536, contextWindow: 1048576 },
  'gemini-2.0-flash': { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', maxTokens: 8192, contextWindow: 1048576 },
  'gemini-2.0-flash-lite': { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', maxTokens: 8192, contextWindow: 1048576 },
};

class GeminiProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: 'gemini',
      baseUrl: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: config.models || GEMINI_MODELS,
      defaultModel: config.defaultModel || 'gemini-2.5-flash',
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
    if (!key) throw new Error('GEMINI_API_KEY not set');
    return {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
  }

  formatMessages(messages) {
    return {
      messages: messages.map((msg) => {
        if (msg.role === 'assistant' && msg.tool_calls) {
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls.map((tc) => ({
              id: tc.id || `call-${Date.now()}`,
              type: 'function',
              function: {
                name: tc.function.name,
                arguments:
                  typeof tc.function.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function.arguments),
              },
            })),
          };
        }
        if (msg.role === 'tool') {
          return {
            role: 'tool',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            tool_call_id: msg.tool_call_id,
          };
        }
        return { role: msg.role, content: msg.content };
      }),
    };
  }

  async chat(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 8192;
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

    const response = await axios.post(`${this.baseUrl}/chat/completions`, body, {
      timeout: options.timeout || this.timeout,
      headers: this._getHeaders(),
    });

    return this.normalizeResponse(response.data);
  }

  async stream(messages, tools, options = {}) {
    const model = options.model || this.defaultModel;
    const modelInfo = this.getModel(model);
    const maxTokens = options.maxTokens || modelInfo?.maxTokens || 8192;
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
        responseType: 'stream',
        signal: options.signal,
      });
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') throw err;
      const msg = err.response?.data?.error?.message || err.message;
      throw new Error(`API Error: ${msg}`);
    }

    return new Promise((resolve, reject) => {
      let content = '';
      const toolCallsMap = {}; // index -> { id, name, arguments }
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
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            resolve({ content, tool_calls: this._buildToolCalls(toolCallsMap) });
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
                toolCallsMap[idx] = { id: tc.id || '', name: '', arguments: '' };
              }
              if (tc.id) toolCallsMap[idx].id = tc.id;
              if (tc.function?.name) toolCallsMap[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallsMap[idx].arguments += tc.function.arguments;
            }
          }
        }
      });

      response.data.on('error', (err) => {
        if (options.signal?.aborted) return; // Ignore errors after abort
        reject(new Error(`Stream error: ${err.message}`));
      });

      response.data.on('end', () => {
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
      content: choice.content || '',
      tool_calls: toolCalls,
    };
  }

  _buildToolCalls(toolCallsMap) {
    return Object.values(toolCallsMap)
      .filter((tc) => tc.name)
      .map((tc) => ({
        id: tc.id || `gemini-${Date.now()}`,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));
  }
}

module.exports = { GeminiProvider, GEMINI_MODELS };

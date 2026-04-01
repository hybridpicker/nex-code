/**
 * cli/providers/wire-protocols.js — Wire Protocol Abstraction Layer
 *
 * Three wire protocols covering all 5 providers:
 * 1. OpenAI-compatible (SSE) — used by OpenAI, Gemini
 * 2. Anthropic Messages API (SSE with custom events) — used by Anthropic
 * 3. Ollama Chat API (NDJSON) — used by Ollama Cloud, Local Ollama
 *
 * Each protocol handles: request body building, tool formatting,
 * stream line parsing, tool call accumulation, and response normalization.
 */

// ─── Base Protocol ──────────────────────────────────────────

class WireProtocol {
  /**
   * Build the request body for a chat call.
   * @param {object} params
   * @param {string} params.model
   * @param {Array} params.messages - Already formatted for this protocol
   * @param {Array} params.tools - Already formatted for this protocol
   * @param {number} params.maxTokens
   * @param {number} params.temperature
   * @param {boolean} params.stream
   * @param {object} [params.extra] - Provider-specific extra fields
   * @returns {object} request body
   */
  buildRequestBody(params) {
    throw new Error("buildRequestBody() not implemented");
  }

  /**
   * Get the API endpoint path.
   * @returns {string}
   */
  getEndpoint() {
    throw new Error("getEndpoint() not implemented");
  }

  /**
   * Convert tool definitions from normalized (OpenAI) format to protocol-specific format.
   * @param {Array} tools - OpenAI format: [{ type: "function", function: { name, description, parameters } }]
   * @returns {Array}
   */
  formatTools(tools) {
    return tools; // Default: pass-through (OpenAI format is the norm)
  }

  /**
   * Normalize a non-streaming response to standard format.
   * @param {object} raw - Raw API response data
   * @returns {{ content: string, tool_calls: Array<{ id, function: { name, arguments } }> }}
   */
  normalizeResponse(raw) {
    throw new Error("normalizeResponse() not implemented");
  }

  /**
   * Create a stream parser instance for processing streamed data.
   * @param {Function} onToken - Called with each text token
   * @param {object} [callbacks] - Additional callbacks (e.g. onThinkingToken for Ollama)
   * @returns {StreamParser}
   */
  createStreamParser(onToken, callbacks = {}) {
    throw new Error("createStreamParser() not implemented");
  }
}

// ─── Stream Parser Base ─────────────────────────────────────

class StreamParser {
  constructor(onToken, callbacks = {}) {
    this.onToken = onToken;
    this.callbacks = callbacks;
    this.content = "";
    this.buffer = "";
  }

  /**
   * Feed a chunk of data from the stream.
   * @param {string} chunk
   * @returns {{ done: boolean, result?: { content, tool_calls } }}
   */
  feed(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const result = this.parseLine(line);
      if (result?.done) return result;
    }
    return { done: false };
  }

  /**
   * Flush remaining buffer (called on stream end).
   * @returns {{ content: string, tool_calls: Array }}
   */
  flush() {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer);
      this.buffer = "";
    }
    return this.getResult();
  }

  /** @abstract */
  parseLine(line) {
    throw new Error("parseLine() not implemented");
  }

  /** @abstract */
  getResult() {
    throw new Error("getResult() not implemented");
  }
}

// ─── 1. OpenAI-Compatible Protocol (SSE) ────────────────────

class OpenAIStreamParser extends StreamParser {
  constructor(onToken, callbacks = {}) {
    super(onToken, callbacks);
    this.toolCallsMap = {}; // index -> { id, name, arguments }
  }

  parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) return { done: false };
    const data = trimmed.slice(6);
    if (data === "[DONE]") {
      return { done: true, result: this.getResult() };
    }

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return { done: false };
    }

    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return { done: false };

    if (delta.content) {
      this.onToken(delta.content);
      this.content += delta.content;
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!this.toolCallsMap[idx]) {
          this.toolCallsMap[idx] = { id: tc.id || "", name: "", arguments: "" };
        }
        if (tc.id) this.toolCallsMap[idx].id = tc.id;
        if (tc.function?.name) this.toolCallsMap[idx].name += tc.function.name;
        if (tc.function?.arguments)
          this.toolCallsMap[idx].arguments += tc.function.arguments;
      }
    }

    return { done: false };
  }

  getResult() {
    return {
      content: this.content,
      tool_calls: Object.values(this.toolCallsMap)
        .filter((tc) => tc.name)
        .map((tc) => ({
          id: tc.id || `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          function: { name: tc.name, arguments: tc.arguments },
        })),
    };
  }
}

class OpenAICompatibleProtocol extends WireProtocol {
  getEndpoint() {
    return "/chat/completions";
  }

  buildRequestBody({ model, messages, tools, maxTokens, temperature, stream }) {
    const body = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    if (stream) body.stream = true;
    if (tools && tools.length > 0) body.tools = tools;
    return body;
  }

  normalizeResponse(data) {
    const choice = data.choices?.[0]?.message || {};
    const toolCalls = (choice.tool_calls || []).map((tc) => ({
      id: tc.id,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));
    return { content: choice.content || "", tool_calls: toolCalls };
  }

  createStreamParser(onToken, callbacks = {}) {
    return new OpenAIStreamParser(onToken, callbacks);
  }
}

// ─── 2. Anthropic Messages API Protocol (SSE) ──────────────

class AnthropicStreamParser extends StreamParser {
  constructor(onToken, callbacks = {}) {
    super(onToken, callbacks);
    this.toolUses = []; // { id, name, inputJson }
    this.currentToolIndex = -1;
  }

  parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return { done: false };
    const data = trimmed.slice(6);

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      return { done: false };
    }

    switch (parsed.type) {
      case "content_block_start": {
        const block = parsed.content_block;
        if (block?.type === "tool_use") {
          this.currentToolIndex = this.toolUses.length;
          this.toolUses.push({
            id: block.id,
            name: block.name,
            inputJson: "",
          });
        }
        break;
      }

      case "content_block_delta": {
        const delta = parsed.delta;
        if (delta?.type === "text_delta" && delta.text) {
          this.onToken(delta.text);
          this.content += delta.text;
        }
        if (
          delta?.type === "input_json_delta" &&
          delta.partial_json !== undefined
        ) {
          if (this.currentToolIndex >= 0) {
            this.toolUses[this.currentToolIndex].inputJson += delta.partial_json;
          }
        }
        break;
      }

      case "content_block_stop":
        this.currentToolIndex = -1;
        break;

      case "message_stop":
        return { done: true, result: this.getResult() };
    }

    return { done: false };
  }

  getResult() {
    return {
      content: this.content,
      tool_calls: this.toolUses
        .filter((tu) => tu.name)
        .map((tu) => {
          let args = {};
          if (tu.inputJson) {
            try {
              args = JSON.parse(tu.inputJson);
            } catch {
              args = tu.inputJson;
            }
          }
          return {
            id: tu.id || `anthropic-${Date.now()}`,
            function: { name: tu.name, arguments: args },
          };
        }),
    };
  }
}

/** Marker that splits the system prompt into a dynamic and a static half.
 *  The static half (behavioral rules) is cached via cache_control to avoid
 *  re-paying its tokens on every API call. */
const ANTHROPIC_CACHE_BOUNDARY =
  "<!-- SYSTEM_PROMPT_DYNAMIC_BOUNDARY -->";

class AnthropicProtocol extends WireProtocol {
  getEndpoint() {
    return "/messages";
  }

  buildRequestBody({
    model,
    messages,
    tools,
    maxTokens,
    temperature,
    stream,
    extra,
  }) {
    const body = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    if (stream) body.stream = true;
    if (extra?.system) {
      const sys = extra.system;
      const idx = sys.indexOf(ANTHROPIC_CACHE_BOUNDARY);
      if (idx !== -1) {
        // Split into a per-session dynamic block and a cacheable static block.
        // Anthropic's prompt caching saves the static half across requests.
        const dynamic = sys.slice(0, idx).trimEnd();
        const staticPart = sys
          .slice(idx + ANTHROPIC_CACHE_BOUNDARY.length)
          .trimStart();
        body.system = [
          { type: "text", text: dynamic },
          {
            type: "text",
            text: staticPart,
            cache_control: { type: "ephemeral" },
          },
        ];
      } else {
        body.system = sys;
      }
    }
    if (tools && tools.length > 0) body.tools = tools;
    return body;
  }

  formatTools(tools) {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: t.function.parameters || { type: "object", properties: {} },
    }));
  }

  normalizeResponse(data) {
    let content = "";
    const toolCalls = [];

    for (const block of data.content || []) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          function: { name: block.name, arguments: block.input },
        });
      }
    }

    return { content, tool_calls: toolCalls };
  }

  createStreamParser(onToken, callbacks = {}) {
    return new AnthropicStreamParser(onToken, callbacks);
  }
}

// ─── 3. Ollama Chat API Protocol (NDJSON) ───────────────────

class OllamaStreamParser extends StreamParser {
  constructor(onToken, callbacks = {}) {
    super(onToken, callbacks);
    this.toolCalls = [];
    this.onThinkingToken = callbacks.onThinkingToken || (() => {});
  }

  parseLine(line) {
    if (!line.trim()) return { done: false };

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { done: false };
    }

    // Thinking-model reasoning tokens (e.g. qwen3-coder, kimi-k2-thinking)
    if (parsed.message?.thinking) {
      this.onThinkingToken(parsed.message.thinking);
    }

    if (parsed.message?.content) {
      this.onToken(parsed.message.content);
      this.content += parsed.message.content;
    }

    if (parsed.message?.tool_calls) {
      this.toolCalls = this.toolCalls.concat(parsed.message.tool_calls);
    }

    if (parsed.done) {
      return { done: true, result: this.getResult() };
    }

    return { done: false };
  }

  getResult() {
    return {
      content: this.content,
      tool_calls: this.toolCalls.map((tc, i) => ({
        id: tc.id || `ollama-${Date.now()}-${i}`,
        function: {
          name: tc.function?.name || tc.name || "unknown",
          arguments: tc.function?.arguments || tc.arguments || {},
        },
      })),
    };
  }
}

class OllamaChatProtocol extends WireProtocol {
  getEndpoint() {
    return "/api/chat";
  }

  buildRequestBody({
    model,
    messages,
    tools,
    maxTokens,
    temperature,
    stream,
    extra,
  }) {
    const body = {
      model,
      messages,
      stream,
      options: {
        temperature,
        num_predict: maxTokens,
        repeat_penalty: extra?.repeat_penalty ?? 1.05,
      },
    };
    if (tools && tools.length > 0) body.tools = tools;
    return body;
  }

  normalizeResponse(data) {
    const msg = data.message || {};
    return {
      content: msg.content || "",
      tool_calls: (msg.tool_calls || []).map((tc, i) => ({
        id: tc.id || `ollama-${Date.now()}-${i}`,
        function: {
          name: tc.function?.name || tc.name || "unknown",
          arguments: tc.function?.arguments || tc.arguments || {},
        },
      })),
    };
  }

  createStreamParser(onToken, callbacks = {}) {
    return new OllamaStreamParser(onToken, callbacks);
  }
}

// ─── Singleton instances ────────────────────────────────────

const openaiProtocol = new OpenAICompatibleProtocol();
const anthropicProtocol = new AnthropicProtocol();
const ollamaProtocol = new OllamaChatProtocol();

module.exports = {
  // Constants
  ANTHROPIC_CACHE_BOUNDARY,
  // Base classes (for testing/extension)
  WireProtocol,
  StreamParser,
  // Protocol implementations
  OpenAICompatibleProtocol,
  AnthropicProtocol,
  OllamaChatProtocol,
  // Stream parsers
  OpenAIStreamParser,
  AnthropicStreamParser,
  OllamaStreamParser,
  // Singleton instances
  openaiProtocol,
  anthropicProtocol,
  ollamaProtocol,
};

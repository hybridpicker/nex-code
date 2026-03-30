const {
  OpenAICompatibleProtocol,
  AnthropicProtocol,
  OllamaChatProtocol,
  OpenAIStreamParser,
  AnthropicStreamParser,
  OllamaStreamParser,
  openaiProtocol,
  anthropicProtocol,
  ollamaProtocol,
} = require("../cli/providers/wire-protocols");

describe("wire-protocols.js", () => {
  // ─── OpenAI-Compatible Protocol ─────────────────────────

  describe("OpenAICompatibleProtocol", () => {
    const proto = openaiProtocol;

    it("returns correct endpoint", () => {
      expect(proto.getEndpoint()).toBe("/chat/completions");
    });

    it("builds request body", () => {
      const body = proto.buildRequestBody({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        tools: [{ type: "function", function: { name: "test", parameters: {} } }],
        maxTokens: 4096,
        temperature: 0.5,
        stream: false,
      });
      expect(body.model).toBe("gpt-4o");
      expect(body.messages).toHaveLength(1);
      expect(body.max_tokens).toBe(4096);
      expect(body.temperature).toBe(0.5);
      expect(body.tools).toHaveLength(1);
      expect(body.stream).toBeUndefined();
    });

    it("builds streaming request body", () => {
      const body = proto.buildRequestBody({
        model: "gpt-4o",
        messages: [],
        tools: [],
        maxTokens: 4096,
        temperature: 0.2,
        stream: true,
      });
      expect(body.stream).toBe(true);
    });

    it("omits tools when empty", () => {
      const body = proto.buildRequestBody({
        model: "gpt-4o",
        messages: [],
        tools: [],
        maxTokens: 4096,
        temperature: 0.2,
        stream: false,
      });
      expect(body.tools).toBeUndefined();
    });

    it("normalizes response", () => {
      const result = proto.normalizeResponse({
        choices: [
          {
            message: {
              content: "Hello!",
              tool_calls: [
                {
                  id: "call_1",
                  function: { name: "bash", arguments: '{"cmd":"ls"}' },
                },
              ],
            },
          },
        ],
      });
      expect(result.content).toBe("Hello!");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe("bash");
    });

    it("normalizes empty response", () => {
      const result = proto.normalizeResponse({});
      expect(result.content).toBe("");
      expect(result.tool_calls).toEqual([]);
    });

    it("passes through tools (OpenAI format is default)", () => {
      const tools = [
        { type: "function", function: { name: "test", parameters: {} } },
      ];
      expect(proto.formatTools(tools)).toBe(tools);
    });
  });

  describe("OpenAIStreamParser", () => {
    it("parses SSE text tokens", () => {
      const tokens = [];
      const parser = new OpenAIStreamParser((t) => tokens.push(t));

      parser.feed(
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' +
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
      );

      expect(tokens).toEqual(["Hello", " world"]);
      expect(parser.content).toBe("Hello world");
    });

    it("parses [DONE] signal", () => {
      const parser = new OpenAIStreamParser(() => {});
      const { done, result } = parser.feed("data: [DONE]\n");
      expect(done).toBe(true);
      expect(result.content).toBe("");
      expect(result.tool_calls).toEqual([]);
    });

    it("accumulates tool calls by index", () => {
      const parser = new OpenAIStreamParser(() => {});

      parser.feed(
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"bash"}}]}}]}\n' +
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"cmd\\""}}]}}]}\n' +
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"ls\\"}"}}]}}]}\n',
      );

      const result = parser.getResult();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe("call_1");
      expect(result.tool_calls[0].function.name).toBe("bash");
      expect(result.tool_calls[0].function.arguments).toBe('{"cmd":"ls"}');
    });

    it("handles multiple tool calls", () => {
      const parser = new OpenAIStreamParser(() => {});

      parser.feed(
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read"}}]}}]}\n' +
        'data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"c2","function":{"name":"write"}}]}}]}\n',
      );

      const result = parser.getResult();
      expect(result.tool_calls).toHaveLength(2);
      expect(result.tool_calls[0].function.name).toBe("read");
      expect(result.tool_calls[1].function.name).toBe("write");
    });

    it("skips malformed JSON lines", () => {
      const parser = new OpenAIStreamParser(() => {});
      parser.feed("data: not-json\ndata: {broken\n");
      expect(parser.content).toBe("");
    });

    it("handles buffered chunks across feeds", () => {
      const tokens = [];
      const parser = new OpenAIStreamParser((t) => tokens.push(t));

      // Chunk split in middle of a line
      parser.feed('data: {"choices":[{"delta":{"con');
      parser.feed('tent":"Hi"}}]}\n');

      expect(tokens).toEqual(["Hi"]);
    });

    it("flush handles remaining buffer", () => {
      const tokens = [];
      const parser = new OpenAIStreamParser((t) => tokens.push(t));
      parser.feed('data: {"choices":[{"delta":{"content":"end"}}]}');
      // No newline — still in buffer
      expect(tokens).toEqual([]);
      const result = parser.flush();
      expect(result.content).toBe("end");
    });
  });

  // ─── Anthropic Protocol ─────────────────────────────────

  describe("AnthropicProtocol", () => {
    const proto = anthropicProtocol;

    it("returns correct endpoint", () => {
      expect(proto.getEndpoint()).toBe("/messages");
    });

    it("builds request body with system", () => {
      const body = proto.buildRequestBody({
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: "Hi" }],
        tools: [],
        maxTokens: 8192,
        temperature: 0.2,
        stream: true,
        extra: { system: "You are helpful." },
      });
      expect(body.model).toBe("claude-sonnet-4-6");
      expect(body.system).toBe("You are helpful.");
      expect(body.stream).toBe(true);
    });

    it("converts tools to Anthropic format", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "bash",
            description: "Run a command",
            parameters: { type: "object", properties: { cmd: { type: "string" } } },
          },
        },
      ];
      const formatted = proto.formatTools(tools);
      expect(formatted[0].name).toBe("bash");
      expect(formatted[0].description).toBe("Run a command");
      expect(formatted[0].input_schema).toBeDefined();
      // Should NOT have function wrapper
      expect(formatted[0].function).toBeUndefined();
    });

    it("returns empty array for empty tools", () => {
      expect(proto.formatTools([])).toEqual([]);
      expect(proto.formatTools(null)).toEqual([]);
    });

    it("normalizes response with text and tool_use blocks", () => {
      const result = proto.normalizeResponse({
        content: [
          { type: "text", text: "Let me check." },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "bash",
            input: { cmd: "ls" },
          },
        ],
      });
      expect(result.content).toBe("Let me check.");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe("toolu_1");
      expect(result.tool_calls[0].function.arguments).toEqual({ cmd: "ls" });
    });
  });

  describe("AnthropicStreamParser", () => {
    it("parses text deltas", () => {
      const tokens = [];
      const parser = new AnthropicStreamParser((t) => tokens.push(t));

      parser.feed(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n' +
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n',
      );

      expect(tokens).toEqual(["Hello", " world"]);
    });

    it("parses tool use blocks", () => {
      const parser = new AnthropicStreamParser(() => {});

      parser.feed(
        'data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"t1","name":"bash"}}\n' +
        'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{\\"cmd\\""}}\n' +
        'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":":\\"ls\\"}"}}\n' +
        'data: {"type":"content_block_stop"}\n',
      );

      const result = parser.getResult();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe("t1");
      expect(result.tool_calls[0].function.name).toBe("bash");
      expect(result.tool_calls[0].function.arguments).toEqual({ cmd: "ls" });
    });

    it("handles message_stop", () => {
      const parser = new AnthropicStreamParser(() => {});
      parser.feed('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n');
      const { done, result } = parser.feed('data: {"type":"message_stop"}\n');
      expect(done).toBe(true);
      expect(result.content).toBe("Hi");
    });

    it("handles malformed tool JSON gracefully", () => {
      const parser = new AnthropicStreamParser(() => {});
      parser.feed(
        'data: {"type":"content_block_start","content_block":{"type":"tool_use","id":"t1","name":"test"}}\n' +
        'data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"not-json"}}\n' +
        'data: {"type":"content_block_stop"}\n',
      );
      const result = parser.getResult();
      expect(result.tool_calls[0].function.arguments).toBe("not-json");
    });
  });

  // ─── Ollama Protocol ────────────────────────────────────

  describe("OllamaChatProtocol", () => {
    const proto = ollamaProtocol;

    it("returns correct endpoint", () => {
      expect(proto.getEndpoint()).toBe("/api/chat");
    });

    it("builds request body with options", () => {
      const body = proto.buildRequestBody({
        model: "devstral-2:123b",
        messages: [{ role: "user", content: "Hi" }],
        tools: [],
        maxTokens: 16384,
        temperature: 0.2,
        stream: true,
        extra: { repeat_penalty: 1.1 },
      });
      expect(body.model).toBe("devstral-2:123b");
      expect(body.stream).toBe(true);
      expect(body.options.temperature).toBe(0.2);
      expect(body.options.num_predict).toBe(16384);
      expect(body.options.repeat_penalty).toBe(1.1);
    });

    it("normalizes response", () => {
      const result = proto.normalizeResponse({
        message: {
          content: "Hello!",
          tool_calls: [
            { function: { name: "bash", arguments: { cmd: "ls" } } },
          ],
        },
      });
      expect(result.content).toBe("Hello!");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe("bash");
    });

    it("normalizes empty response", () => {
      const result = proto.normalizeResponse({});
      expect(result.content).toBe("");
      expect(result.tool_calls).toEqual([]);
    });
  });

  describe("OllamaStreamParser", () => {
    it("parses NDJSON content tokens", () => {
      const tokens = [];
      const parser = new OllamaStreamParser((t) => tokens.push(t));

      parser.feed(
        '{"message":{"content":"Hello"}}\n' +
        '{"message":{"content":" world"}}\n',
      );

      expect(tokens).toEqual(["Hello", " world"]);
    });

    it("parses done signal", () => {
      const parser = new OllamaStreamParser(() => {});
      parser.feed('{"message":{"content":"Hi"}}\n');
      const { done, result } = parser.feed('{"done":true}\n');
      expect(done).toBe(true);
      expect(result.content).toBe("Hi");
    });

    it("collects tool calls", () => {
      const parser = new OllamaStreamParser(() => {});
      parser.feed(
        '{"message":{"tool_calls":[{"function":{"name":"bash","arguments":{"cmd":"ls"}}}]}}\n' +
        '{"done":true}\n',
      );
      const result = parser.getResult();
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].function.name).toBe("bash");
    });

    it("calls onThinkingToken for thinking models", () => {
      const thinking = [];
      const parser = new OllamaStreamParser(() => {}, {
        onThinkingToken: (t) => thinking.push(t),
      });

      parser.feed('{"message":{"thinking":"reasoning step..."}}\n');
      expect(thinking).toEqual(["reasoning step..."]);
    });

    it("handles empty lines", () => {
      const parser = new OllamaStreamParser(() => {});
      parser.feed("\n\n\n");
      expect(parser.content).toBe("");
    });

    it("handles malformed JSON", () => {
      const parser = new OllamaStreamParser(() => {});
      parser.feed("not json at all\n");
      expect(parser.content).toBe("");
    });

    it("flush handles remaining buffer", () => {
      const tokens = [];
      const parser = new OllamaStreamParser((t) => tokens.push(t));
      parser.feed('{"message":{"content":"end"}}');
      expect(tokens).toEqual([]);
      const result = parser.flush();
      expect(result.content).toBe("end");
    });
  });

  // ─── Singleton instances ────────────────────────────────

  describe("singleton instances", () => {
    it("exports singleton instances", () => {
      expect(openaiProtocol).toBeInstanceOf(OpenAICompatibleProtocol);
      expect(anthropicProtocol).toBeInstanceOf(AnthropicProtocol);
      expect(ollamaProtocol).toBeInstanceOf(OllamaChatProtocol);
    });
  });
});

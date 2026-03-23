const { EventEmitter } = require("events");

jest.mock("axios", () => ({ post: jest.fn() }));
const axios = require("axios");

const {
  AnthropicProvider,
  ANTHROPIC_MODELS,
} = require("../../cli/providers/anthropic");

describe("providers/anthropic.js", () => {
  let provider;

  beforeEach(() => {
    provider = new AnthropicProvider();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-123";
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  // ─── Configuration ──────────────────────────────────────────
  describe("configuration", () => {
    it("has correct provider name", () => {
      expect(provider.name).toBe("anthropic");
    });

    it("uses correct base URL", () => {
      expect(provider.baseUrl).toBe("https://api.anthropic.com/v1");
    });

    it("has default models", () => {
      expect(provider.getModelNames()).toContain("claude-sonnet");
      expect(provider.getModelNames()).toContain("claude-sonnet-4-5");
      expect(provider.getModelNames()).toContain("claude-opus");
      expect(provider.getModelNames()).toContain("claude-haiku");
      expect(provider.getModelNames()).toContain("claude-sonnet-4");
    });

    it("defaults to claude-sonnet", () => {
      expect(provider.defaultModel).toBe("claude-sonnet");
    });
  });

  // ─── isConfigured / getApiKey ──────────────────────────────
  describe("isConfigured()", () => {
    it("returns true when API key is set", () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it("returns false when API key is missing", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(provider.isConfigured()).toBe(false);
    });
  });

  // ─── ANTHROPIC_MODELS export ───────────────────────────────
  describe("ANTHROPIC_MODELS", () => {
    it("exports claude-sonnet model", () => {
      expect(ANTHROPIC_MODELS["claude-sonnet"]).toMatchObject({
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        contextWindow: 200000,
      });
    });

    it("exports claude-opus model", () => {
      expect(ANTHROPIC_MODELS["claude-opus"]).toMatchObject({
        id: "claude-opus-4-6",
        name: "Claude Opus 4.6",
      });
    });

    it("exports claude-haiku model", () => {
      expect(ANTHROPIC_MODELS["claude-haiku"]).toMatchObject({
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
      });
    });

    it("exports claude-sonnet-4-5 model", () => {
      expect(ANTHROPIC_MODELS["claude-sonnet-4-5"]).toMatchObject({
        id: "claude-sonnet-4-5-20250929",
        name: "Claude Sonnet 4.5",
      });
    });

    it("exports claude-sonnet-4 model", () => {
      expect(ANTHROPIC_MODELS["claude-sonnet-4"]).toMatchObject({
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
      });
    });
  });

  // ─── formatMessages() ──────────────────────────────────────
  describe("formatMessages()", () => {
    it("extracts system messages", () => {
      const msgs = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
      ];
      const { messages, system } = provider.formatMessages(msgs);
      expect(system).toBe("You are helpful");
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: "user", content: "Hi" });
    });

    it("concatenates multiple system messages", () => {
      const msgs = [
        { role: "system", content: "Part 1" },
        { role: "system", content: "Part 2" },
        { role: "user", content: "Hi" },
      ];
      const { system } = provider.formatMessages(msgs);
      expect(system).toBe("Part 1\n\nPart 2");
    });

    it("converts assistant tool_calls to tool_use blocks", () => {
      const msgs = [
        {
          role: "assistant",
          content: "Let me check",
          tool_calls: [
            {
              id: "tc1",
              function: { name: "bash", arguments: { command: "ls" } },
            },
          ],
        },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].content).toHaveLength(2);
      expect(messages[0].content[0]).toEqual({
        type: "text",
        text: "Let me check",
      });
      expect(messages[0].content[1]).toMatchObject({
        type: "tool_use",
        id: "tc1",
        name: "bash",
        input: { command: "ls" },
      });
    });

    it("parses string arguments in tool_calls", () => {
      const msgs = [
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "tc1",
              function: { name: "bash", arguments: '{"command":"ls"}' },
            },
          ],
        },
      ];
      const { messages } = provider.formatMessages(msgs);
      const toolUse = messages[0].content.find((b) => b.type === "tool_use");
      expect(toolUse.input).toEqual({ command: "ls" });
    });

    it("converts tool role to user with tool_result", () => {
      const msgs = [
        { role: "tool", content: "file1.txt\nfile2.txt", tool_call_id: "tc1" },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toEqual([
        {
          type: "tool_result",
          tool_use_id: "tc1",
          content: "file1.txt\nfile2.txt",
        },
      ]);
    });

    it("merges consecutive tool results into one user message", () => {
      const msgs = [
        { role: "tool", content: "result1", tool_call_id: "tc1" },
        { role: "tool", content: "result2", tool_call_id: "tc2" },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toHaveLength(2);
    });

    it("handles assistant without content", () => {
      const msgs = [
        {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "tc1", function: { name: "bash", arguments: {} } },
          ],
        },
      ];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].content).toHaveLength(1);
      expect(messages[0].content[0].type).toBe("tool_use");
    });

    it("handles assistant without tool_calls", () => {
      const msgs = [{ role: "assistant", content: "Hello" }];
      const { messages } = provider.formatMessages(msgs);
      expect(messages[0].content).toEqual([{ type: "text", text: "Hello" }]);
    });
  });

  // ─── formatTools() ─────────────────────────────────────────
  describe("formatTools()", () => {
    it("converts OpenAI format to Anthropic format", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "bash",
            description: "Run a command",
            parameters: {
              type: "object",
              properties: { command: { type: "string" } },
              required: ["command"],
            },
          },
        },
      ];
      const result = provider.formatTools(tools);
      expect(result).toEqual([
        {
          name: "bash",
          description: "Run a command",
          input_schema: {
            type: "object",
            properties: { command: { type: "string" } },
            required: ["command"],
          },
        },
      ]);
    });

    it("returns empty array for null/empty tools", () => {
      expect(provider.formatTools(null)).toEqual([]);
      expect(provider.formatTools([])).toEqual([]);
    });
  });

  // ─── chat() ─────────────────────────────────────────────────
  describe("chat()", () => {
    it("sends correct request", async () => {
      axios.post.mockResolvedValueOnce({
        data: { content: [{ type: "text", text: "Hello!" }] },
      });

      const result = await provider.chat(
        [
          { role: "system", content: "Be helpful" },
          { role: "user", content: "Hi" },
        ],
        [],
      );

      expect(result.content).toBe("Hello!");
      expect(axios.post).toHaveBeenCalledWith(
        "https://api.anthropic.com/v1/messages",
        expect.objectContaining({
          model: "claude-sonnet-4-6",
          system: "Be helpful",
          messages: [{ role: "user", content: "Hi" }],
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-api-key": "sk-ant-test-123",
            "anthropic-version": "2023-06-01",
          }),
        }),
      );
    });

    it("throws when API key is missing", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      await expect(provider.chat([], [])).rejects.toThrow(
        "ANTHROPIC_API_KEY not set",
      );
    });

    it("sends tools in Anthropic format", async () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "bash",
            description: "Run cmd",
            parameters: { type: "object", properties: {} },
          },
        },
      ];
      axios.post.mockResolvedValueOnce({
        data: { content: [{ type: "text", text: "Ok" }] },
      });

      await provider.chat([{ role: "user", content: "test" }], tools);
      expect(axios.post.mock.calls[0][1].tools).toEqual([
        {
          name: "bash",
          description: "Run cmd",
          input_schema: { type: "object", properties: {} },
        },
      ]);
    });

    it("resolves model alias to full model ID", async () => {
      axios.post.mockResolvedValueOnce({
        data: { content: [{ type: "text", text: "Hi" }] },
      });

      await provider.chat([{ role: "user", content: "test" }], [], {
        model: "claude-opus",
      });
      expect(axios.post.mock.calls[0][1].model).toBe("claude-opus-4-6");
    });
  });

  // ─── stream() ───────────────────────────────────────────────
  describe("stream()", () => {
    function createSSEStream(events) {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        for (const event of events) {
          emitter.emit(
            "data",
            Buffer.from(`data: ${JSON.stringify(event)}\n\n`),
          );
        }
        emitter.emit("end");
      });
      return emitter;
    }

    it("streams text and calls onToken", async () => {
      const stream = createSSEStream([
        {
          type: "content_block_start",
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: " World" },
        },
        { type: "content_block_stop" },
        { type: "message_stop" },
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const tokens = [];
      const result = await provider.stream(
        [{ role: "user", content: "Hi" }],
        [],
        { onToken: (t) => tokens.push(t) },
      );

      expect(result.content).toBe("Hello World");
      expect(tokens).toEqual(["Hello", " World"]);
    });

    it("collects tool use from stream", async () => {
      const stream = createSSEStream([
        {
          type: "content_block_start",
          content_block: {
            type: "tool_use",
            id: "toolu_1",
            name: "bash",
            input: {},
          },
        },
        {
          type: "content_block_delta",
          delta: { type: "input_json_delta", partial_json: '{"command":' },
        },
        {
          type: "content_block_delta",
          delta: { type: "input_json_delta", partial_json: ' "ls"}' },
        },
        { type: "content_block_stop" },
        { type: "message_stop" },
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream(
        [{ role: "user", content: "list files" }],
        [],
      );
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0].id).toBe("toolu_1");
      expect(result.tool_calls[0].function.name).toBe("bash");
      expect(result.tool_calls[0].function.arguments).toEqual({
        command: "ls",
      });
    });

    it("handles text + tool use in same response", async () => {
      const stream = createSSEStream([
        {
          type: "content_block_start",
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Let me check." },
        },
        { type: "content_block_stop" },
        {
          type: "content_block_start",
          content_block: {
            type: "tool_use",
            id: "toolu_1",
            name: "bash",
            input: {},
          },
        },
        {
          type: "content_block_delta",
          delta: { type: "input_json_delta", partial_json: '{"command":"ls"}' },
        },
        { type: "content_block_stop" },
        { type: "message_stop" },
      ]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe("Let me check.");
      expect(result.tool_calls).toHaveLength(1);
    });

    it("handles empty stream", async () => {
      const stream = createSSEStream([{ type: "message_stop" }]);
      axios.post.mockResolvedValueOnce({ data: stream });

      const result = await provider.stream([], []);
      expect(result.content).toBe("");
      expect(result.tool_calls).toEqual([]);
    });

    it("handles stream errors", async () => {
      const emitter = new EventEmitter();
      process.nextTick(() =>
        emitter.emit("error", new Error("Connection reset")),
      );
      axios.post.mockResolvedValueOnce({ data: emitter });

      await expect(provider.stream([], [])).rejects.toThrow("Stream error");
    });

    it("handles API connection error", async () => {
      axios.post.mockRejectedValueOnce(new Error("Connection refused"));
      await expect(provider.stream([], [])).rejects.toThrow("API Error");
    });

    it("resolves on stream end without message_stop", async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        const data = JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "partial" },
        });
        emitter.emit("data", Buffer.from(`data: ${data}\n\n`));
        emitter.emit("end");
      });
      axios.post.mockResolvedValueOnce({ data: emitter });

      const result = await provider.stream([], []);
      expect(result.content).toBe("partial");
    });
  });

  // ─── normalizeResponse ──────────────────────────────────────
  describe("normalizeResponse()", () => {
    it("normalizes text response", () => {
      const result = provider.normalizeResponse({
        content: [{ type: "text", text: "Hello" }],
      });
      expect(result).toEqual({ content: "Hello", tool_calls: [] });
    });

    it("normalizes tool_use response", () => {
      const result = provider.normalizeResponse({
        content: [
          { type: "text", text: "Let me check" },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "bash",
            input: { command: "ls" },
          },
        ],
      });
      expect(result.content).toBe("Let me check");
      expect(result.tool_calls).toHaveLength(1);
      expect(result.tool_calls[0]).toEqual({
        id: "toolu_1",
        function: { name: "bash", arguments: { command: "ls" } },
      });
    });

    it("handles empty content", () => {
      const result = provider.normalizeResponse({ content: [] });
      expect(result).toEqual({ content: "", tool_calls: [] });
    });

    it("handles missing content", () => {
      const result = provider.normalizeResponse({});
      expect(result).toEqual({ content: "", tool_calls: [] });
    });
  });
});

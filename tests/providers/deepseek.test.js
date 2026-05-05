const { EventEmitter } = require("events");

jest.mock("axios", () => ({ post: jest.fn() }));
const axios = require("axios");

const {
  DeepSeekProvider,
  DEEPSEEK_MODELS,
} = require("../../cli/providers/deepseek");

describe("providers/deepseek.js", () => {
  let provider;

  beforeEach(() => {
    provider = new DeepSeekProvider();
    process.env.DEEPSEEK_API_KEY = "deepseek-test-key";
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
  });

  describe("configuration", () => {
    it("has correct provider name", () => {
      expect(provider.name).toBe("deepseek");
    });

    it("uses the DeepSeek API base URL", () => {
      expect(provider.baseUrl).toBe("https://api.deepseek.com");
    });

    it("supports overriding the base URL", () => {
      process.env.DEEPSEEK_BASE_URL = "https://proxy.example.com";
      const custom = new DeepSeekProvider();
      expect(custom.baseUrl).toBe("https://proxy.example.com");
    });

    it("has default models", () => {
      expect(provider.getModelNames()).toContain("deepseek-v4-flash");
      expect(provider.getModelNames()).toContain("deepseek-v4-pro");
    });

    it("defaults to deepseek-v4-flash", () => {
      expect(provider.defaultModel).toBe("deepseek-v4-flash");
    });
  });

  describe("isConfigured()", () => {
    it("returns true when API key is set", () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it("returns false when API key is missing", () => {
      delete process.env.DEEPSEEK_API_KEY;
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe("DEEPSEEK_MODELS", () => {
    it("exports V4 Flash model info", () => {
      expect(DEEPSEEK_MODELS["deepseek-v4-flash"]).toMatchObject({
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        contextWindow: 1048576,
      });
    });

    it("exports V4 Pro model info", () => {
      expect(DEEPSEEK_MODELS["deepseek-v4-pro"]).toMatchObject({
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        contextWindow: 1048576,
      });
    });
  });

  describe("chat()", () => {
    it("sends OpenAI-compatible requests to DeepSeek", async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: "OK", tool_calls: [] } }] },
      });

      const result = await provider.chat(
        [{ role: "user", content: "Reply OK" }],
        [],
      );

      expect(result.content).toBe("OK");
      expect(axios.post).toHaveBeenCalledWith(
        "https://api.deepseek.com/chat/completions",
        expect.objectContaining({
          model: "deepseek-v4-flash",
          thinking: { type: "disabled" },
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer deepseek-test-key",
          }),
        }),
      );
    });

    it("throws when API key is missing", async () => {
      delete process.env.DEEPSEEK_API_KEY;
      await expect(provider.chat([], [])).rejects.toThrow(
        "DEEPSEEK_API_KEY not set",
      );
    });

    it("allows enabling thinking mode explicitly", async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: "OK", tool_calls: [] } }] },
      });

      await provider.chat([], [], { thinking: "enabled" });

      expect(axios.post.mock.calls[0][1]).toEqual(
        expect.objectContaining({ thinking: { type: "enabled" } }),
      );
    });
  });

  describe("stream()", () => {
    it("streams text from DeepSeek-compatible SSE", async () => {
      const emitter = new EventEmitter();
      process.nextTick(() => {
        emitter.emit(
          "data",
          Buffer.from(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "O" } }] })}\n\n`,
          ),
        );
        emitter.emit(
          "data",
          Buffer.from(
            `data: ${JSON.stringify({ choices: [{ delta: { content: "K" } }] })}\n\n`,
          ),
        );
        emitter.emit("data", Buffer.from("data: [DONE]\n\n"));
      });
      axios.post.mockResolvedValueOnce({ data: emitter });

      const tokens = [];
      const result = await provider.stream([], [], {
        onToken: (token) => tokens.push(token),
      });

      expect(result.content).toBe("OK");
      expect(tokens).toEqual(["O", "K"]);
    });
  });
});

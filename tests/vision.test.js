/**
 * tests/vision.test.js — Vision input: buildUserContent + provider multimodal formatting
 *
 * Tests:
 * 1. buildUserContent() in agent.js — image path detection + base64 encoding
 * 2. Perplexity grounded search fallback in web_search
 * 3. Anthropic _formatSingleMessage with image content blocks
 * 4. OpenAI _formatSingleMessage with image content blocks
 * 5. Gemini _formatSingleMessage with image content blocks
 * 6. Ollama _formatMessages with image content blocks
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Agent mock setup (minimal, only for buildUserContent) ────
jest.mock("../cli/providers/registry", () => ({
  callStream: jest.fn(),
  getActiveModel: jest
    .fn()
    .mockReturnValue({ id: "test", name: "Test", provider: "ollama" }),
  getActiveProviderName: jest.fn().mockReturnValue("ollama"),
  getActiveModelId: jest.fn().mockReturnValue("test"),
  getConfiguredProviders: jest.fn().mockReturnValue([]),
}));
jest.mock("../cli/tools", () => ({
  TOOL_DEFINITIONS: [],
  executeTool: jest.fn(),
}));
jest.mock("../cli/context", () => ({
  gatherProjectContext: jest.fn().mockReturnValue(""),
}));
jest.mock("../cli/context-engine", () => ({
  fitToContext: jest
    .fn()
    .mockImplementation(async (m) => ({ messages: m, compressed: false })),
  getUsage: jest
    .fn()
    .mockReturnValue({ used: 0, limit: 128000, percentage: 0 }),
  estimateTokens: jest.fn().mockReturnValue(10),
  compressToolResult: jest.fn().mockImplementation((c) => c),
}));
jest.mock("../cli/session", () => ({ autoSave: jest.fn() }));
jest.mock("../cli/memory", () => ({
  getMemoryContext: jest.fn().mockReturnValue(""),
}));
jest.mock("../cli/permissions", () => ({
  checkPermission: jest.fn().mockReturnValue("allow"),
  setPermission: jest.fn(),
  savePermissions: jest.fn(),
}));
jest.mock("../cli/planner", () => ({
  isPlanMode: jest.fn().mockReturnValue(false),
  getPlanModePrompt: jest.fn().mockReturnValue(""),
  PLAN_MODE_ALLOWED_TOOLS: [],
  setPlanContent: jest.fn(),
}));
jest.mock("../cli/render", () => ({
  renderMarkdown: jest.fn().mockImplementation((t) => t || ""),
  StreamRenderer: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    flush: jest.fn(),
    startCursor: jest.fn(),
    stopCursor: jest.fn(),
  })),
}));
jest.mock("../cli/hooks", () => ({ runHooks: jest.fn().mockReturnValue([]) }));
jest.mock("../cli/mcp", () => ({
  routeMCPCall: jest.fn().mockResolvedValue(null),
  getMCPToolDefinitions: jest.fn().mockReturnValue([]),
}));
jest.mock("../cli/skills", () => ({
  getSkillInstructions: jest.fn().mockReturnValue(""),
  getSkillToolDefinitions: jest.fn().mockReturnValue([]),
  routeSkillCall: jest.fn().mockResolvedValue(null),
  matchSkillTriggers: jest.fn().mockReturnValue([]),
}));
jest.mock("../cli/costs", () => ({ trackUsage: jest.fn() }));
jest.mock("../cli/tool-validator", () => ({
  validateToolArgs: jest.fn().mockReturnValue({ valid: true, args: {} }),
}));
jest.mock("../cli/tool-tiers", () => ({
  filterToolsForModel: jest.fn().mockImplementation((t) => t),
  getModelTier: jest.fn().mockReturnValue("full"),
  PROVIDER_DEFAULT_TIER: {},
}));
jest.mock("../cli/safety", () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setAllowAlwaysHandler: jest.fn(),
}));
jest.mock("../cli/tasks", () => ({
  setOnChange: jest.fn(),
  clearTasks: jest.fn(),
}));

// ─── 1. buildUserContent ──────────────────────────────────────
describe("buildUserContent()", () => {
  let buildUserContent;
  let tmpDir;
  let pngPath;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-vision-"));
    // Create a tiny valid PNG (1x1 pixel)
    pngPath = path.join(tmpDir, "test.png");
    const PNG_1x1 = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
        "0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082",
      "hex",
    );
    fs.writeFileSync(pngPath, PNG_1x1);
    ({ buildUserContent } = require("../cli/agent"));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns plain string when no image paths detected", () => {
    const result = buildUserContent("explain this code");
    expect(result).toBe("explain this code");
    expect(typeof result).toBe("string");
  });

  it("returns array when image path is detected", () => {
    const input = `analyze this screenshot: ${pngPath}`;
    const result = buildUserContent(input);
    expect(Array.isArray(result)).toBe(true);
  });

  it("includes text block with original message", () => {
    const input = `what is in ${pngPath}`;
    const result = buildUserContent(input);
    expect(Array.isArray(result)).toBe(true);
    const textBlock = result.find((b) => b.type === "text");
    expect(textBlock).toBeDefined();
    expect(textBlock.text).toBe(input);
  });

  it("includes image block with base64 data", () => {
    const input = `describe ${pngPath}`;
    const result = buildUserContent(input);
    const imageBlock = result.find((b) => b.type === "image");
    expect(imageBlock).toBeDefined();
    expect(imageBlock.data).toBeTruthy();
    expect(imageBlock.media_type).toBe("image/png");
  });

  it("detects jpeg files", () => {
    const jpgPath = path.join(tmpDir, "photo.jpg");
    fs.writeFileSync(jpgPath, Buffer.from("ffd8ffe000104a46494600", "hex")); // JPEG magic bytes
    const result = buildUserContent(`look at ${jpgPath}`);
    if (Array.isArray(result)) {
      const img = result.find((b) => b.type === "image");
      expect(img.media_type).toBe("image/jpeg");
    }
  });

  it("ignores image paths that do not exist", () => {
    const result = buildUserContent("look at /nonexistent/fake.png");
    expect(typeof result).toBe("string"); // falls back to plain string
  });

  it("handles text-only input without overhead", () => {
    const result = buildUserContent("just a normal message");
    expect(result).toBe("just a normal message");
  });
});

// ─── 2. Perplexity grounded search ───────────────────────────
describe("web_search with Perplexity", () => {
  let executeTool;

  beforeAll(() => {
    // Unmock tools.js for this describe block
    jest.unmock("../cli/tools");
    jest.mock("../cli/file-history", () => ({ recordChange: jest.fn() }));
    jest.mock("../cli/diff", () => ({
      showDiff: jest.fn(),
      showNewFile: jest.fn(),
      showEditDiff: jest.fn(),
      confirmFileChange: jest.fn().mockResolvedValue(true),
    }));
    ({ executeTool } = require("../cli/tools"));
  });

  afterEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
    jest.restoreAllMocks();
  });

  it("uses DuckDuckGo when PERPLEXITY_API_KEY is not set", async () => {
    const axios = require("axios");
    const mockHtml =
      '<a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com&rut=x">Test Result</a>';
    jest.spyOn(axios, "get").mockResolvedValueOnce({ data: mockHtml });
    const result = await executeTool("web_search", { query: "test" });
    expect(result).toContain("Test Result");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("duckduckgo"),
      expect.anything(),
    );
  });

  it("uses Perplexity when PERPLEXITY_API_KEY is set", async () => {
    process.env.PERPLEXITY_API_KEY = "test-only-fake-key";
    const axios = require("axios");
    jest.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "AI answer about the query" } }],
        citations: ["https://source1.com", "https://source2.com"],
      },
    });
    const result = await executeTool("web_search", {
      query: "react hooks tutorial",
    });
    expect(result).toContain("Perplexity");
    expect(result).toContain("AI answer about the query");
    expect(result).toContain("source1.com");
    expect(axios.post).toHaveBeenCalledWith(
      "https://api.perplexity.ai/chat/completions",
      expect.objectContaining({ model: "sonar" }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-only-fake-key",
        }),
      }),
    );
  });

  it("falls back to DuckDuckGo when Perplexity fails", async () => {
    process.env.PERPLEXITY_API_KEY = "test-only-fake-key";
    const axios = require("axios");
    jest.spyOn(axios, "post").mockRejectedValueOnce(new Error("API error"));
    const mockHtml =
      '<a class="result__a" href="/l/?uddg=https%3A%2F%2Ffallback.com&rut=x">Fallback Result</a>';
    jest.spyOn(axios, "get").mockResolvedValueOnce({ data: mockHtml });
    const result = await executeTool("web_search", { query: "test" });
    expect(result).toContain("Fallback Result");
  });

  it("includes citations in Perplexity results", async () => {
    process.env.PERPLEXITY_API_KEY = "test-only-fake-key";
    const axios = require("axios");
    jest.spyOn(axios, "post").mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "answer" } }],
        citations: [
          "https://cite1.com",
          "https://cite2.com",
          "https://cite3.com",
        ],
      },
    });
    const result = await executeTool("web_search", {
      query: "test",
      max_results: 2,
    });
    // Should include citations up to max_results
    expect(result).toContain("cite1.com");
    expect(result).toContain("cite2.com");
  });
});

// ─── 3. Anthropic provider — multimodal formatting ────────────
describe("AnthropicProvider._formatSingleMessage() with images", () => {
  const { AnthropicProvider } = require("../cli/providers/anthropic");
  let provider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it("formats plain string user message unchanged", () => {
    const msg = { role: "user", content: "hello" };
    const result = provider._formatSingleMessage(msg);
    expect(result).toEqual({ role: "user", content: "hello" });
  });

  it("formats array content with text block", () => {
    const msg = {
      role: "user",
      content: [{ type: "text", text: "describe this" }],
    };
    const result = provider._formatSingleMessage(msg);
    expect(result.role).toBe("user");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toEqual({ type: "text", text: "describe this" });
  });

  it("formats image block to Anthropic source format", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "describe" },
        { type: "image", media_type: "image/png", data: "base64encodeddata==" },
      ],
    };
    const result = provider._formatSingleMessage(msg);
    const imgBlock = result.content.find((b) => b.type === "image");
    expect(imgBlock).toMatchObject({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "base64encodeddata==",
      },
    });
  });

  it("defaults media_type to image/png when missing", () => {
    const msg = {
      role: "user",
      content: [{ type: "image", data: "somedata" }],
    };
    const result = provider._formatSingleMessage(msg);
    const imgBlock = result.content.find((b) => b.type === "image");
    expect(imgBlock.source.media_type).toBe("image/png");
  });

  it("skips image blocks without data", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "hello" },
        { type: "image" }, // no data field
      ],
    };
    const result = provider._formatSingleMessage(msg);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });
});

// ─── 4. OpenAI provider — multimodal formatting ───────────────
describe("OpenAIProvider._formatSingleMessage() with images", () => {
  jest.mock("axios", () => ({ post: jest.fn(), get: jest.fn() }));
  const { OpenAIProvider } = require("../cli/providers/openai");
  let provider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    process.env.OPENAI_API_KEY = "sk-test";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("formats plain string user message unchanged", () => {
    const msg = { role: "user", content: "hello" };
    const result = provider._formatSingleMessage(msg);
    expect(result).toEqual({ role: "user", content: "hello" });
  });

  it("formats image block to OpenAI image_url format", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "what is this" },
        { type: "image", media_type: "image/jpeg", data: "abc123==" },
      ],
    };
    const result = provider._formatSingleMessage(msg);
    expect(result.role).toBe("user");
    const imgBlock = result.content.find((b) => b.type === "image_url");
    expect(imgBlock).toMatchObject({
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,abc123==",
        detail: "auto",
      },
    });
  });

  it("passes through data: URLs as-is", () => {
    const msg = {
      role: "user",
      content: [
        {
          type: "image",
          media_type: "image/png",
          data: "data:image/png;base64,xyz==",
        },
      ],
    };
    const result = provider._formatSingleMessage(msg);
    const imgBlock = result.content.find((b) => b.type === "image_url");
    expect(imgBlock.image_url.url).toBe("data:image/png;base64,xyz==");
  });
});

// ─── 5. Gemini provider — multimodal formatting ───────────────
describe("GeminiProvider._formatSingleMessage() with images", () => {
  const { GeminiProvider } = require("../cli/providers/gemini");
  let provider;

  beforeEach(() => {
    provider = new GeminiProvider();
    process.env.GEMINI_API_KEY = "test-only-fake";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("formats image block to image_url format (OpenAI-compat)", () => {
    const msg = {
      role: "user",
      content: [
        { type: "text", text: "analyze" },
        { type: "image", media_type: "image/webp", data: "webpdata==" },
      ],
    };
    const result = provider._formatSingleMessage(msg);
    const imgBlock = result.content.find((b) => b.type === "image_url");
    expect(imgBlock.image_url.url).toBe("data:image/webp;base64,webpdata==");
  });
});

// ─── 6. Ollama provider — multimodal formatting ───────────────
describe("OllamaProvider._formatMessages() with images", () => {
  const { OllamaProvider } = require("../cli/providers/ollama");
  let provider;

  beforeEach(() => {
    provider = new OllamaProvider();
    process.env.OLLAMA_API_KEY = "test";
  });

  afterEach(() => {
    delete process.env.OLLAMA_API_KEY;
  });

  it("passes through plain string messages unchanged", () => {
    const msgs = [{ role: "user", content: "hello" }];
    const result = provider._formatMessages(msgs);
    expect(result).toEqual(msgs);
  });

  it("converts image blocks to Ollama images array", () => {
    const msgs = [
      {
        role: "user",
        content: [
          { type: "text", text: "describe this" },
          { type: "image", media_type: "image/png", data: "base64data==" },
        ],
      },
    ];
    const result = provider._formatMessages(msgs);
    expect(result[0].content).toBe("describe this");
    expect(result[0].images).toEqual(["base64data=="]);
  });

  it("concatenates multiple text blocks", () => {
    const msgs = [
      {
        role: "user",
        content: [
          { type: "text", text: "first" },
          { type: "text", text: "second" },
        ],
      },
    ];
    const result = provider._formatMessages(msgs);
    expect(result[0].content).toBe("first\nsecond");
  });

  it("collects multiple images into images array", () => {
    const msgs = [
      {
        role: "user",
        content: [
          { type: "text", text: "compare" },
          { type: "image", data: "img1==" },
          { type: "image", data: "img2==" },
        ],
      },
    ];
    const result = provider._formatMessages(msgs);
    expect(result[0].images).toEqual(["img1==", "img2=="]);
  });

  it("does not add images key when no images", () => {
    const msgs = [
      {
        role: "user",
        content: [{ type: "text", text: "hello" }],
      },
    ];
    const result = provider._formatMessages(msgs);
    expect(result[0].images).toBeUndefined();
  });

  it("leaves non-user messages untouched", () => {
    const msgs = [
      { role: "system", content: "you are helpful" },
      { role: "assistant", content: "hi there" },
    ];
    const result = provider._formatMessages(msgs);
    expect(result).toEqual(msgs);
  });

  it("handles multimodal tool results with images", () => {
    const msgs = [
      {
        role: "tool",
        tool_call_id: "call_1",
        content: [
          { type: "text", text: "Screenshot analysis result" },
          { type: "image", media_type: "image/png", data: "screenshotdata==" },
        ],
      },
    ];
    const result = provider._formatMessages(msgs);
    expect(result[0].role).toBe("tool");
    expect(result[0].content).toBe("Screenshot analysis result");
    expect(result[0].images).toEqual(["screenshotdata=="]);
    expect(result[0].tool_call_id).toBe("call_1");
  });
});

// ─── 7. Remote image URL detection ─────────────────────────────
describe("_detectImageURLs()", () => {
  let _detectImageURLs;

  beforeAll(() => {
    ({ _detectImageURLs } = require("../cli/agent"));
  });

  it("detects HTTPS image URLs", () => {
    const urls = _detectImageURLs("look at https://example.com/photo.png please");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("https://example.com/photo.png");
  });

  it("detects HTTP image URLs", () => {
    const urls = _detectImageURLs("check http://cdn.test.com/img.jpg here");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe("http://cdn.test.com/img.jpg");
  });

  it("detects URLs with query parameters", () => {
    const urls = _detectImageURLs("see https://img.host/pic.webp?w=800&h=600 now");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("pic.webp?w=800");
  });

  it("detects multiple image URLs", () => {
    const urls = _detectImageURLs(
      "compare https://a.com/1.png and https://b.com/2.jpg",
    );
    expect(urls).toHaveLength(2);
  });

  it("ignores non-image URLs", () => {
    const urls = _detectImageURLs("visit https://example.com/page.html");
    expect(urls).toHaveLength(0);
  });

  it("returns empty for text without URLs", () => {
    const urls = _detectImageURLs("no images here");
    expect(urls).toHaveLength(0);
  });
});

// ─── 8. Remote URL download ─────────────────────────────────────
describe("_downloadImageURL()", () => {
  let _downloadImageURL;
  const axios = require("axios");

  beforeAll(() => {
    ({ _downloadImageURL } = require("../cli/agent"));
  });

  it("downloads and base64-encodes a remote image", async () => {
    const fakeImage = Buffer.from("fake-png-data");
    jest.spyOn(axios, "get").mockResolvedValueOnce({
      data: fakeImage,
      headers: { "content-type": "image/png" },
    });
    const result = await _downloadImageURL("https://example.com/test.png");
    expect(result).not.toBeNull();
    expect(result.data).toBe(fakeImage.toString("base64"));
    expect(result.media_type).toBe("image/png");
  });

  it("returns null on network error", async () => {
    jest.spyOn(axios, "get").mockRejectedValueOnce(new Error("timeout"));
    const result = await _downloadImageURL("https://broken.com/img.png");
    expect(result).toBeNull();
  });

  it("guesses media type from URL when content-type is missing", async () => {
    jest.spyOn(axios, "get").mockResolvedValueOnce({
      data: Buffer.from("data"),
      headers: {},
    });
    const result = await _downloadImageURL("https://example.com/photo.jpg");
    expect(result.media_type).toBe("image/jpeg");
  });
});

// ─── 9. Clipboard detection in buildUserContent ─────────────────
describe("buildUserContent() with clipboard keyword", () => {
  let buildUserContent;

  beforeAll(() => {
    ({ buildUserContent } = require("../cli/agent"));
  });

  it("returns a Promise when clipboard keyword is detected", () => {
    const result = buildUserContent("analyze clipboard image");
    // Should return a Promise (async path)
    expect(result && typeof result.then === "function").toBe(true);
  });

  it("returns a Promise when remote URL is detected", () => {
    const result = buildUserContent("look at https://example.com/pic.png");
    expect(result && typeof result.then === "function").toBe(true);
  });
});

// ─── 10. Anthropic multimodal tool results ──────────────────────
describe("Anthropic tool results with embedded images", () => {
  const { AnthropicProvider } = require("../cli/providers/anthropic");
  let provider;

  beforeEach(() => {
    provider = new AnthropicProvider();
  });

  it("formats tool message with image blocks", () => {
    const formatted = [];
    const msg = {
      role: "tool",
      tool_call_id: "call_123",
      content: [
        { type: "text", text: "Visual review result" },
        { type: "image", media_type: "image/png", data: "imgdata==" },
      ],
    };
    const result = provider._formatSingleMessage(msg, formatted);
    expect(result.role).toBe("user");
    expect(result.content[0].type).toBe("tool_result");
    expect(Array.isArray(result.content[0].content)).toBe(true);
    const blocks = result.content[0].content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "text", text: "Visual review result" });
    expect(blocks[1]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "imgdata==" },
    });
  });

  it("formats plain string tool results unchanged", () => {
    const formatted = [];
    const msg = {
      role: "tool",
      tool_call_id: "call_456",
      content: "simple text result",
    };
    const result = provider._formatSingleMessage(msg, formatted);
    expect(result.content[0].content).toBe("simple text result");
  });
});

// ─── 11. OpenAI multimodal tool results ─────────────────────────
describe("OpenAI tool results with embedded images", () => {
  const { OpenAIProvider } = require("../cli/providers/openai");
  let provider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    process.env.OPENAI_API_KEY = "sk-test";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("extracts text from multimodal tool results", () => {
    const msg = {
      role: "tool",
      tool_call_id: "call_789",
      content: [
        { type: "text", text: "Analysis output" },
        { type: "image", media_type: "image/png", data: "base64==" },
      ],
    };
    const result = provider._formatSingleMessage(msg);
    expect(result.role).toBe("tool");
    expect(result.content).toBe("Analysis output");
    expect(result.tool_call_id).toBe("call_789");
  });
});

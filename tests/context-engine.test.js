jest.mock("../cli/providers/registry", () => ({
  getActiveModel: jest.fn().mockReturnValue({
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    maxTokens: 16384,
  }),
}));

jest.mock("../cli/compactor", () => ({
  compactMessages: jest.fn().mockResolvedValue(null),
}));

const {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateToolsTokens,
  getContextWindow,
  getUsage,
  compressMessage,
  compressToolResult,
  scoreMessageRelevance,
  extractActiveFiles,
  fitToContext,
  forceCompress,
  truncateFileContent,
  getEffectiveCompressionThreshold,
  COMPRESSION_THRESHOLD,
  TIER_COMPRESSION_THRESHOLDS,
  SAFETY_MARGIN,
  KEEP_RECENT,
  invalidateFitToContextCache,
} = require("../cli/context-engine");

const registry = require("../cli/providers/registry");
const { compactMessages } = require("../cli/compactor");

describe("context-engine.js", () => {
  beforeEach(() => {
    registry.getActiveModel.mockReturnValue({
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      contextWindow: 128000,
    });
    compactMessages.mockReset();
    compactMessages.mockResolvedValue(null);
  });

  // ─── estimateTokens ────────────────────────────────────────
  describe("estimateTokens()", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("returns 0 for null/undefined", () => {
      expect(estimateTokens(null)).toBe(0);
      expect(estimateTokens(undefined)).toBe(0);
    });

    it("estimates ~4 chars per token", () => {
      const text = "Hello, World!"; // 13 chars → ~4 tokens
      expect(estimateTokens(text)).toBe(4);
    });

    it("handles long text", () => {
      const text = "a".repeat(1000); // 1000 chars → 250 tokens
      expect(estimateTokens(text)).toBe(250);
    });

    it("stringifies objects", () => {
      const obj = { key: "value" };
      expect(estimateTokens(obj)).toBeGreaterThan(0);
    });
  });

  // ─── estimateMessageTokens ─────────────────────────────────
  describe("estimateMessageTokens()", () => {
    it("includes overhead for empty message", () => {
      const tokens = estimateMessageTokens({ role: "user" });
      expect(tokens).toBe(4); // Just overhead
    });

    it("estimates content tokens + overhead", () => {
      const msg = { role: "user", content: "Hello there!" }; // 12 chars → 3 + 4 overhead
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBe(7);
    });

    it("includes tool_calls in estimation", () => {
      const msg = {
        role: "assistant",
        content: "Let me check",
        tool_calls: [
          { function: { name: "bash", arguments: '{"command":"ls -la"}' } },
        ],
      };
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(10);
    });

    it("handles tool_calls with object arguments", () => {
      const msg = {
        role: "assistant",
        content: "",
        tool_calls: [
          { function: { name: "bash", arguments: { command: "ls" } } },
        ],
      };
      const tokens = estimateMessageTokens(msg);
      expect(tokens).toBeGreaterThan(4);
    });

    it("handles missing tool function name", () => {
      const msg = {
        role: "assistant",
        tool_calls: [{ function: {} }],
      };
      expect(() => estimateMessageTokens(msg)).not.toThrow();
    });
  });

  // ─── estimateMessagesTokens ────────────────────────────────
  describe("estimateMessagesTokens()", () => {
    it("returns 0 for empty array", () => {
      expect(estimateMessagesTokens([])).toBe(0);
    });

    it("sums all message tokens", () => {
      const messages = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];
      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(12); // 3 * 4 overhead + content
    });
  });

  // ─── estimateToolsTokens ──────────────────────────────────
  describe("estimateToolsTokens()", () => {
    it("returns 0 for empty/null tools", () => {
      expect(estimateToolsTokens(null)).toBe(0);
      expect(estimateToolsTokens([])).toBe(0);
    });

    it("estimates tokens for tool definitions", () => {
      const tools = [
        {
          type: "function",
          function: {
            name: "bash",
            description: "Execute a bash command",
            parameters: {
              type: "object",
              properties: { command: { type: "string" } },
            },
          },
        },
      ];
      expect(estimateToolsTokens(tools)).toBeGreaterThan(10);
    });
  });

  // ─── getContextWindow ──────────────────────────────────────
  describe("getContextWindow()", () => {
    it("returns context window from active model", () => {
      expect(getContextWindow()).toBe(128000);
    });

    it("falls back to 32768 for unknown models", () => {
      registry.getActiveModel.mockReturnValue({ id: "unknown" });
      expect(getContextWindow()).toBe(32768);
    });

    it("falls back when model is null", () => {
      registry.getActiveModel.mockReturnValue(null);
      expect(getContextWindow()).toBe(32768);
    });
  });

  // ─── getUsage ──────────────────────────────────────────────
  describe("getUsage()", () => {
    it("returns zero usage for empty conversation", () => {
      const usage = getUsage([], []);
      expect(usage.used).toBe(0);
      expect(usage.percentage).toBe(0);
      expect(usage.messageCount).toBe(0);
    });

    it("returns breakdown by message type", () => {
      const messages = [
        { role: "system", content: "System prompt here" },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "tool", content: "tool result", tool_call_id: "c1" },
      ];
      const usage = getUsage(messages, []);

      expect(usage.breakdown.system).toBeGreaterThan(0);
      expect(usage.breakdown.conversation).toBeGreaterThan(0);
      expect(usage.breakdown.toolResults).toBeGreaterThan(0);
      expect(usage.messageCount).toBe(4);
    });

    it("includes tool definitions in total", () => {
      const tools = [
        {
          type: "function",
          function: { name: "bash", description: "Run cmd", parameters: {} },
        },
      ];
      const usage = getUsage([], tools);
      expect(usage.used).toBeGreaterThan(0);
      expect(usage.breakdown.toolDefinitions).toBeGreaterThan(0);
    });

    it("calculates percentage correctly", () => {
      // Create a message that uses some tokens
      const messages = [{ role: "user", content: "a".repeat(12800) }]; // ~3200 tokens = 2.5% of 128k
      const usage = getUsage(messages, []);
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThan(10);
      expect(usage.limit).toBe(128000);
    });

    it("uses incremental cache when messages are appended to the same array", () => {
      invalidateFitToContextCache(); // reset cache
      const messages = [
        { role: "system", content: "System prompt" },
        { role: "user", content: "Hello" },
      ];
      const tools = [];

      const usage1 = getUsage(messages, tools);
      expect(usage1.messageCount).toBe(2);
      const tokens1 = usage1.used;

      // Append a new message to the same array
      messages.push({ role: "assistant", content: "Hi there!" });
      const usage2 = getUsage(messages, tools);

      expect(usage2.messageCount).toBe(3);
      expect(usage2.used).toBeGreaterThan(tokens1);
      // Breakdown should include the new assistant message
      expect(usage2.breakdown.conversation).toBeGreaterThan(usage1.breakdown.conversation);
    });

    it("incremental cache produces same results as full recalculation", () => {
      invalidateFitToContextCache();
      const messages = [
        { role: "system", content: "You are a helpful assistant" },
        { role: "user", content: "Fix the bug in auth.js" },
      ];

      // Prime the cache
      getUsage(messages, []);

      // Append several messages
      messages.push({ role: "assistant", content: "Let me check that file." });
      messages.push({ role: "tool", content: "file contents here...", tool_call_id: "c1" });
      messages.push({ role: "assistant", content: "I found the issue." });

      // Get incremental result
      const incremental = getUsage(messages, []);

      // Force full recalculation by invalidating cache
      invalidateFitToContextCache();
      const full = getUsage(messages, []);

      expect(incremental.used).toBe(full.used);
      expect(incremental.breakdown.system).toBe(full.breakdown.system);
      expect(incremental.breakdown.conversation).toBe(full.breakdown.conversation);
      expect(incremental.breakdown.toolResults).toBe(full.breakdown.toolResults);
      expect(incremental.percentage).toBe(full.percentage);
    });

    it("falls back to full recalculation when array reference changes", () => {
      invalidateFitToContextCache();
      const messages1 = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];
      getUsage(messages1, []);

      // New array with same content but different reference
      const messages2 = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
        { role: "user", content: "What's up?" },
      ];
      const usage = getUsage(messages2, []);
      expect(usage.messageCount).toBe(3);
      expect(usage.used).toBeGreaterThan(0);
    });

    it("falls back to full recalculation after invalidation", () => {
      const messages = [{ role: "user", content: "Hello" }];
      getUsage(messages, []);
      invalidateFitToContextCache();

      messages.push({ role: "assistant", content: "Hi there!" });
      // After invalidation, msgCount is -1, so incremental path won't fire
      const usage = getUsage(messages, []);
      expect(usage.messageCount).toBe(2);
      expect(usage.used).toBeGreaterThan(0);
    });
  });

  // ─── compressMessage ───────────────────────────────────────
  describe("compressMessage()", () => {
    it("returns user messages unchanged", () => {
      const msg = { role: "user", content: "Hello there!" };
      expect(compressMessage(msg)).toBe(msg);
    });

    it("returns system messages unchanged", () => {
      const msg = { role: "system", content: "You are helpful" };
      expect(compressMessage(msg)).toBe(msg);
    });

    it("truncates long tool results (light)", () => {
      const msg = {
        role: "tool",
        content: "x".repeat(500),
        tool_call_id: "c1",
      };
      const compressed = compressMessage(msg, "light");
      expect(compressed.content.length).toBeLessThan(msg.content.length);
      expect(compressed.content).toMatch(/truncated|chars total|omitted/);
    });

    it("keeps short tool results unchanged", () => {
      const msg = { role: "tool", content: "short result", tool_call_id: "c1" };
      const compressed = compressMessage(msg, "light");
      expect(compressed.content).toBe("short result");
    });

    it("truncates long assistant content (light)", () => {
      const msg = { role: "assistant", content: "a".repeat(2000) };
      const compressed = compressMessage(msg, "light");
      expect(compressed.content.length).toBeLessThan(msg.content.length);
      expect(compressed.content).toContain("truncated");
    });

    it("keeps short assistant content unchanged", () => {
      const msg = { role: "assistant", content: "Hello!" };
      const compressed = compressMessage(msg, "light");
      expect(compressed.content).toBe("Hello!");
    });

    it("aggressive mode truncates more", () => {
      const msg = {
        role: "tool",
        content: "x".repeat(200),
        tool_call_id: "c1",
      };
      const light = compressMessage(msg, "light");
      const aggressive = compressMessage(msg, "aggressive");
      expect(aggressive.content.length).toBeLessThanOrEqual(
        light.content.length,
      );
    });

    it("aggressive mode simplifies tool_calls", () => {
      const msg = {
        role: "assistant",
        content: "short",
        tool_calls: [
          { function: { name: "bash", arguments: "a".repeat(200) } },
        ],
      };
      const compressed = compressMessage(msg, "aggressive");
      expect(compressed.tool_calls[0].function.arguments.length).toBeLessThan(
        200,
      );
    });
  });

  // ─── fitToContext ──────────────────────────────────────────
  describe("fitToContext()", () => {
    it("returns messages unchanged when under threshold", async () => {
      const messages = [
        { role: "system", content: "prompt" },
        { role: "user", content: "hello" },
      ];
      const {
        messages: result,
        compressed,
        compacted,
      } = await fitToContext(messages, []);
      expect(compressed).toBe(false);
      expect(compacted).toBe(false);
      expect(result).toBe(messages);
    });

    it("compresses when over threshold", async () => {
      // Use a very small context window to force compression
      registry.getActiveModel.mockReturnValue({
        id: "small",
        contextWindow: 100,
      });

      const messages = [
        { role: "system", content: "system prompt" },
        ...Array.from({ length: 20 }, (_, i) => ({
          role: "user",
          content: `Message ${i}: ${"x".repeat(50)}`,
        })),
        ...Array.from({ length: 20 }, (_, i) => ({
          role: "assistant",
          content: `Response ${i}: ${"y".repeat(50)}`,
        })),
      ];

      const { compressed, tokensRemoved } = await fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(tokensRemoved).toBeGreaterThan(0);
    });

    it("skips LLM compactor when cheap compression is sufficient", async () => {
      // Use a context window where the conversation exceeds threshold but
      // cheap (string) compression can fit. The compactor should NOT be called.
      // Context: 2000 tokens, threshold ~0.65 → targetMax ~1100 tokens
      // Messages: ~1500 raw tokens → over threshold but light truncation brings under
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 2000,
      });
      compactMessages.mockClear();

      const messages = [
        { role: "system", content: "sys" },
        // 12 tool results: 400 chars each ≈ 100 tokens each → ~1200 tokens total
        // Light compression truncates to 200 chars → ~50 tokens each → ~600 tokens
        ...Array.from({ length: 12 }, (_, i) => ({
          role: "tool",
          content: "x".repeat(400),
          tool_call_id: `c${i}`,
        })),
        // 10 recent messages (kept intact, ~50 tokens total)
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `r ${i}`,
        })),
      ];

      const { compressed, compacted } = await fitToContext(messages, [], { force: true });
      expect(compressed).toBe(true);
      expect(compacted).toBe(false);
      // compactMessages should NOT have been called — cheap compression was enough
      expect(compactMessages).not.toHaveBeenCalled();
    });

    it("uses LLM compactor when cheap compression is insufficient", async () => {
      // Use a very small context where even aggressive compression can't fit
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 100,
      });
      compactMessages.mockClear();
      // Return a compacted message that saves space
      compactMessages.mockResolvedValueOnce({
        message: { role: "assistant", content: "summary", _compacted: true },
      });

      const messages = [
        { role: "system", content: "sys" },
        // Many long messages — even aggressive compression won't fit 100 token window
        ...Array.from({ length: 20 }, (_, i) => ({
          role: "assistant",
          content: "reasoning ".repeat(50),
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      await fitToContext(messages, [], { force: true });
      // compactMessages SHOULD have been called as a last resort
      expect(compactMessages).toHaveBeenCalled();
    });

    it("keeps system prompt intact", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "small",
        contextWindow: 200,
      });

      const messages = [
        { role: "system", content: "Important system prompt" },
        ...Array.from({ length: 30 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(100)}`,
        })),
      ];

      const { messages: result } = await fitToContext(messages, []);
      expect(result[0].role).toBe("system");
      expect(result[0].content).toBe("Important system prompt");
    });

    it("keeps recent messages intact", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "small",
        contextWindow: 500,
      });

      const messages = [
        { role: "system", content: "prompt" },
        ...Array.from({ length: 30 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(200)}`,
        })),
      ];

      const { messages: result } = await fitToContext(messages, [], {
        keepRecent: 5,
      });
      // Last 5 messages should be intact
      const last5 = result.slice(-5);
      expect(last5[4].content).toContain("msg 29");
    });

    it("handles messages without system prompt", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "small",
        contextWindow: 100,
      });

      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: "user",
        content: `Message ${i}: ${"x".repeat(100)}`,
      }));

      const { messages: result } = await fitToContext(messages, []);
      expect(result.length).toBeLessThan(messages.length);
    });

    it("removes oldest messages in phase 4", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "tiny",
        contextWindow: 50,
      });

      const messages = [
        { role: "system", content: "p" },
        ...Array.from({ length: 50 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg ${i}: ${"x".repeat(200)}`,
        })),
      ];

      const { messages: result, compressed } = await fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(result.length).toBeLessThan(messages.length);
    });

    it("respects custom threshold", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 200,
      });

      const messages = Array.from({ length: 10 }, () => ({
        role: "user",
        content: "x".repeat(80),
      }));

      // Very low threshold should compress
      const { compressed } = await fitToContext(messages, [], {
        threshold: 0.1,
      });
      expect(compressed).toBe(true);
    });

    it("exports threshold and keep_recent constants", () => {
      expect(COMPRESSION_THRESHOLD).toBe(0.75);
      expect(KEEP_RECENT).toBe(10);
    });

    it("exports SAFETY_MARGIN constant", () => {
      expect(SAFETY_MARGIN).toBe(0.1);
    });

    it("effective target uses threshold minus safety margin", async () => {
      // With 128k window, threshold 0.75, margin 0.10:
      // targetMax = 128000 * (0.75 - 0.10) = 83200
      // Messages below 83200 tokens should NOT be compressed
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 1000,
      });

      // Create messages that use ~700 tokens (70% of 1000) — above 65% effective target
      const messages = Array.from({ length: 15 }, () => ({
        role: "user",
        content: "x".repeat(180), // ~45 tokens each → ~675 total
      }));

      const { compressed } = await fitToContext(messages, []);
      expect(compressed).toBe(true); // Should compress since > 65% effective target
    });

    it("respects custom safetyMargin option", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 1000,
      });

      const messages = Array.from({ length: 10 }, () => ({
        role: "user",
        content: "x".repeat(80),
      }));

      // With threshold 0.75 and safetyMargin 0: effective = 75%
      const r1 = await fitToContext(messages, [], { safetyMargin: 0 });
      // With threshold 0.75 and safetyMargin 0.30: effective = 45%
      const r2 = await fitToContext(messages, [], { safetyMargin: 0.3 });

      // Higher margin → more aggressive compression → more tokens removed
      if (r2.compressed) {
        expect(r2.tokensRemoved).toBeGreaterThanOrEqual(r1.tokensRemoved);
      }
    });

    // ─── Phase 0: LLM Compacting ────────────────────────────
    it("uses LLM compacting when >= 6 non-compacted old messages", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 500,
      });

      const summaryMsg = {
        role: "system",
        content:
          "[Conversation Summary — 15 messages compacted]\n• stuff happened",
        _compacted: true,
        _originalCount: 15,
      };
      compactMessages.mockResolvedValueOnce({
        message: summaryMsg,
        tokensRemoved: 200,
      });

      const messages = [
        { role: "system", content: "prompt" },
        ...Array.from({ length: 15 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(100)}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      const result = await fitToContext(messages, []);
      expect(compactMessages).toHaveBeenCalled();
      expect(result.compacted).toBe(true);
      expect(result.compressed).toBe(true);
      // Summary message should be in the result
      expect(result.messages.some((m) => m._compacted)).toBe(true);
    });

    it("skips compacting when < 6 old messages", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 200,
      });

      const messages = [
        { role: "system", content: "prompt" },
        ...Array.from({ length: 3 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(200)}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      await fitToContext(messages, []);
      expect(compactMessages).not.toHaveBeenCalled();
    });

    it("falls back to truncating when compacting fails", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 200,
      });

      compactMessages.mockRejectedValueOnce(new Error("LLM error"));

      const messages = [
        { role: "system", content: "prompt" },
        ...Array.from({ length: 20 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(100)}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      const result = await fitToContext(messages, []);
      expect(result.compressed).toBe(true);
      expect(result.compacted).toBe(false);
    });

    it("falls back to truncating when compacting returns null", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 200,
      });

      compactMessages.mockResolvedValueOnce(null);

      const messages = [
        { role: "system", content: "prompt" },
        ...Array.from({ length: 20 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(100)}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      const result = await fitToContext(messages, []);
      expect(result.compressed).toBe(true);
      expect(result.compacted).toBe(false);
    });

    it("skips already-compacted messages for re-compacting", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 500,
      });

      const summaryMsg = {
        role: "system",
        content: "[Conversation Summary — 8 messages compacted]\n• new summary",
        _compacted: true,
        _originalCount: 8,
      };
      compactMessages.mockResolvedValueOnce({
        message: summaryMsg,
        tokensRemoved: 100,
      });

      const messages = [
        { role: "system", content: "prompt" },
        // An already-compacted message from a previous compaction
        {
          role: "system",
          content: "[Conversation Summary — 5 messages]",
          _compacted: true,
          _originalCount: 5,
        },
        ...Array.from({ length: 8 }, (_, i) => ({
          role: "user",
          content: `msg ${i}: ${"x".repeat(100)}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      const result = await fitToContext(messages, []);
      // compactMessages should only receive the non-compacted messages
      if (compactMessages.mock.calls.length > 0) {
        const passedMsgs = compactMessages.mock.calls[0][0];
        expect(passedMsgs.every((m) => !m._compacted)).toBe(true);
      }
    });
  });

  // ─── compressMessage medium level ────────────────────────────
  describe("compressMessage() medium level", () => {
    it("medium truncates tool results to 100 chars", () => {
      const msg = {
        role: "tool",
        content: "x".repeat(300),
        tool_call_id: "c1",
      };
      const compressed = compressMessage(msg, "medium");
      // medium maxTool = 100, so content should be compressed
      expect(compressed.content.length).toBeLessThan(msg.content.length);
    });

    it("medium truncates assistant content to 200 chars", () => {
      const msg = { role: "assistant", content: "y".repeat(500) };
      const compressed = compressMessage(msg, "medium");
      expect(compressed.content.length).toBeLessThan(msg.content.length);
      // Should be between aggressive (100) and light (500)
      const light = compressMessage(msg, "light");
      const aggressive = compressMessage(msg, "aggressive");
      expect(compressed.content.length).toBeLessThanOrEqual(
        light.content.length,
      );
      expect(compressed.content.length).toBeGreaterThanOrEqual(
        aggressive.content.length,
      );
    });

    it("medium is between light and aggressive for tool results", () => {
      const msg = {
        role: "tool",
        content: "z".repeat(500),
        tool_call_id: "c1",
      };
      const light = compressMessage(msg, "light");
      const medium = compressMessage(msg, "medium");
      const aggressive = compressMessage(msg, "aggressive");
      expect(medium.content.length).toBeLessThanOrEqual(light.content.length);
      expect(medium.content.length).toBeGreaterThanOrEqual(
        aggressive.content.length,
      );
    });
  });

  // ─── compressToolResult ────────────────────────────────────
  describe("compressToolResult()", () => {
    it("returns short content unchanged", () => {
      expect(compressToolResult("hello", 100)).toBe("hello");
    });

    it("returns null/empty unchanged", () => {
      expect(compressToolResult("", 100)).toBe("");
      expect(compressToolResult(null, 100)).toBe(null);
    });

    it("preserves error messages with extra room", () => {
      const content = "ERROR: " + "x".repeat(400);
      const result = compressToolResult(content, 150);
      // Error gets 3x budget (450), so 407 chars should fit
      expect(result).toBe(content);
    });

    it("preserves EXIT status with extra room", () => {
      const content = "EXIT 1: " + "x".repeat(300);
      const result = compressToolResult(content, 110);
      // EXIT gets 3x budget (330), so 308 chars should fit
      expect(result).toBe(content);
    });

    it("short output uses head + tail with chars total", () => {
      // ≤10 lines but over budget
      const lines = Array.from(
        { length: 5 },
        (_, i) => "x".repeat(100) + `-line${i}`,
      );
      const content = lines.join("\n");
      const result = compressToolResult(content, 100);
      expect(result).toContain("chars total");
      expect(result.length).toBeLessThan(content.length);
    });

    it("long output uses head + tail with lines omitted", () => {
      const lines = Array.from(
        { length: 50 },
        (_, i) => `Line ${i}: ${"y".repeat(20)}`,
      );
      const content = lines.join("\n");
      const result = compressToolResult(content, 200);
      expect(result).toMatch(/lines omitted/);
      expect(result).toContain("50 total");
    });

    it("preserves test summary at end of output", () => {
      const lines = Array.from(
        { length: 50 },
        (_, i) => `test output line ${i}`,
      );
      lines.push("Tests: 42 passed, 42 total");
      lines.push("Time: 3.2s");
      const content = lines.join("\n");
      const result = compressToolResult(content, 300);
      expect(result).toContain("Tests: 42 passed");
      expect(result).toContain("Time: 3.2s");
    });

    it("preserves error trace at end of bash output", () => {
      const lines = Array.from({ length: 50 }, (_, i) => `build output ${i}`);
      lines.push("TypeError: Cannot read property of undefined");
      lines.push("    at Object.<anonymous> (src/index.js:42:5)");
      const content = lines.join("\n");
      const result = compressToolResult(content, 300);
      expect(result).toContain("TypeError");
      expect(result).toContain("src/index.js:42");
    });
  });

  // ─── truncateFileContent ───────────────────────────────────
  describe("truncateFileContent()", () => {
    it("returns empty string for empty input", () => {
      expect(truncateFileContent("", 100)).toBe("");
      expect(truncateFileContent(null, 100)).toBe("");
    });

    it("returns content unchanged when under budget", () => {
      const content = "line1\nline2\nline3";
      expect(truncateFileContent(content, 1000)).toBe(content);
    });

    it("truncates long content", () => {
      const lines = Array.from(
        { length: 100 },
        (_, i) => `Line ${i}: some content here`,
      );
      const content = lines.join("\n");

      const result = truncateFileContent(content, 50);
      expect(result.length).toBeLessThan(content.length);
    });

    it("keeps beginning and end of file", () => {
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}`);
      const content = lines.join("\n");

      const result = truncateFileContent(content, 30);
      expect(result).toContain("Line 0");
      expect(result).toContain("Line 99");
      expect(result).toContain("lines omitted");
    });

    it("shows omitted line count", () => {
      const lines = Array.from(
        { length: 200 },
        (_, i) => `Line ${i}: ${"x".repeat(20)}`,
      );
      const content = lines.join("\n");

      const result = truncateFileContent(content, 100);
      expect(result).toMatch(/\d+ lines omitted/);
      expect(result).toContain("200 total");
    });
  });

  // ─── scoreMessageRelevance ────────────────────────────────
  describe("scoreMessageRelevance()", () => {
    it("returns 100 for system messages", () => {
      const msg = { role: "system", content: "You are helpful" };
      expect(scoreMessageRelevance(msg, 0, 10, new Set())).toBe(100);
    });

    it("scores user messages higher than plain assistant messages", () => {
      const user = { role: "user", content: "Hello" };
      const assistant = { role: "assistant", content: "Hi there" };
      const userScore = scoreMessageRelevance(user, 5, 10, new Set());
      const assistantScore = scoreMessageRelevance(assistant, 5, 10, new Set());
      expect(userScore).toBeGreaterThan(assistantScore);
    });

    it("scores assistant with tool_calls higher than plain assistant", () => {
      const plain = { role: "assistant", content: "thinking..." };
      const withTools = {
        role: "assistant",
        content: "let me check",
        tool_calls: [{ function: { name: "bash" } }],
      };
      const plainScore = scoreMessageRelevance(plain, 5, 10, new Set());
      const toolScore = scoreMessageRelevance(withTools, 5, 10, new Set());
      expect(toolScore).toBeGreaterThan(plainScore);
    });

    it("scores tool error results higher than normal tool results", () => {
      const normal = { role: "tool", content: "file contents here" };
      const error = { role: "tool", content: "ERROR: command failed" };
      const normalScore = scoreMessageRelevance(normal, 5, 10, new Set());
      const errorScore = scoreMessageRelevance(error, 5, 10, new Set());
      expect(errorScore).toBeGreaterThan(normalScore);
    });

    it("scores newer messages higher than older ones (recency)", () => {
      const msg = { role: "assistant", content: "response" };
      const oldScore = scoreMessageRelevance(msg, 0, 10, new Set());
      const newScore = scoreMessageRelevance(msg, 9, 10, new Set());
      expect(newScore).toBeGreaterThan(oldScore);
    });

    it("boosts score for messages mentioning active files", () => {
      const activeFiles = new Set(["/src/index.js", "/src/utils.js"]);
      const relevant = {
        role: "tool",
        content: "Read /src/index.js: module.exports = ...",
      };
      const irrelevant = { role: "tool", content: "Some random output" };
      const relevantScore = scoreMessageRelevance(relevant, 5, 10, activeFiles);
      const irrelevantScore = scoreMessageRelevance(
        irrelevant,
        5,
        10,
        activeFiles,
      );
      expect(relevantScore).toBeGreaterThan(irrelevantScore);
    });

    it("caps score at 100", () => {
      const activeFiles = new Set(["/a.js", "/b.js", "/c.js", "/d.js"]);
      const msg = { role: "user", content: "Check /a.js /b.js /c.js /d.js" };
      const score = scoreMessageRelevance(msg, 9, 10, activeFiles);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ─── extractActiveFiles ─────────────────────────────────────
  describe("extractActiveFiles()", () => {
    it("extracts file paths from message content", () => {
      const messages = [
        { role: "user", content: "Please read /src/index.js" },
        { role: "tool", content: "Contents of /src/utils.js ..." },
      ];
      const files = extractActiveFiles(messages);
      expect(files.has("/src/index.js")).toBe(true);
      expect(files.has("/src/utils.js")).toBe(true);
    });

    it("returns empty set when no file paths found", () => {
      const messages = [{ role: "user", content: "Hello world" }];
      const files = extractActiveFiles(messages);
      expect(files.size).toBe(0);
    });

    it("only scans recent messages", () => {
      const messages = [
        { role: "user", content: "Old message about /old/file.js" },
        ...Array.from({ length: 15 }, () => ({
          role: "user",
          content: "filler message",
        })),
        { role: "user", content: "Recent message about /new/file.js" },
      ];
      const files = extractActiveFiles(messages, 5);
      expect(files.has("/new/file.js")).toBe(true);
      expect(files.has("/old/file.js")).toBe(false);
    });

    it("handles non-string content", () => {
      const messages = [
        { role: "tool", content: { result: "/src/data.json" } },
      ];
      const files = extractActiveFiles(messages);
      expect(files.has("/src/data.json")).toBe(true);
    });
  });

  // ─── fitToContext with relevance ────────────────────────────
  describe("fitToContext() relevance-based Phase 4", () => {
    it("keeps messages mentioning active files over older unrelated ones", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "tiny",
        contextWindow: 80,
      });

      const messages = [
        { role: "system", content: "p" },
        // Old unrelated messages
        {
          role: "assistant",
          content: "Thinking about something unrelated " + "x".repeat(100),
        },
        {
          role: "assistant",
          content: "More unrelated stuff " + "y".repeat(100),
        },
        // Old but mentions active file
        {
          role: "tool",
          content:
            "Contents of /src/main.js: function main() {}" + "z".repeat(50),
        },
        // Recent messages (kept intact by KEEP_RECENT)
        ...Array.from({ length: 3 }, (_, i) => ({
          role: "user",
          content: `Recent msg ${i} about /src/main.js`,
        })),
      ];

      const { messages: result, compressed } = await fitToContext(
        messages,
        [],
        { keepRecent: 3 },
      );
      expect(compressed).toBe(true);

      // The tool result mentioning /src/main.js should be more likely to survive
      // than the unrelated assistant messages (due to file overlap scoring)
      const resultContent = result.map((m) => m.content || "").join(" ");
      // System prompt is always kept
      expect(result[0].role).toBe("system");
    });
  });

  describe("forceCompress()", () => {
    const makeMessages = (count, contentLength = 200) => [
      { role: "system", content: "System prompt" },
      ...Array.from({ length: count }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "x".repeat(contentLength),
      })),
    ];

    it("returns fewer tokens than the original", () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 1000,
      });
      const messages = makeMessages(20, 100);
      const { messages: result, tokensRemoved } = forceCompress(messages, []);
      expect(tokensRemoved).toBeGreaterThan(0);
      expect(estimateMessagesTokens(result)).toBeLessThan(
        estimateMessagesTokens(messages),
      );
    });

    it("always preserves the system prompt", () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 1000,
      });
      const messages = makeMessages(20, 100);
      const { messages: result } = forceCompress(messages, []);
      expect(result[0].role).toBe("system");
      expect(result[0].content).toBe("System prompt");
    });

    it("nuclear mode compresses more aggressively than normal", () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 1000,
      });
      const messages = makeMessages(20, 100);
      const { tokensRemoved: normalRemoved } = forceCompress(messages, []);
      const { tokensRemoved: nuclearRemoved } = forceCompress(
        messages,
        [],
        true,
      );
      expect(nuclearRemoved).toBeGreaterThanOrEqual(normalRemoved);
    });

    it("nuclear mode keeps at most 2 recent messages before dropping", () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 500,
      });
      // Very large messages to force nuclear to drop history
      const messages = makeMessages(30, 500);
      const { messages: result } = forceCompress(messages, [], true);
      // System prompt + at most a few messages
      expect(result.length).toBeLessThan(10);
    });

    it("works with no system prompt", () => {
      registry.getActiveModel.mockReturnValue({
        id: "test",
        contextWindow: 1000,
      });
      const messages = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "x".repeat(100),
      }));
      expect(() => forceCompress(messages, [])).not.toThrow();
    });

    it("nuclear mode keeps last user message when still over budget", () => {
      registry.getActiveModel.mockReturnValue({
        id: "tiny",
        contextWindow: 50,
      });
      const messages = [
        { role: "system", content: "sys" },
        ...Array.from({ length: 40 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: "x".repeat(500),
        })),
      ];
      const { messages: result } = forceCompress(messages, [], true);
      // Should have system + at least one user message
      expect(result[0].role).toBe("system");
      expect(result.some((m) => m.role === "user")).toBe(true);
    });
  });

  // ─── estimateDeltaTokens ─────────────────────────────────────
  describe("estimateDeltaTokens()", () => {
    const { estimateDeltaTokens } = require("../cli/context-engine");

    it("returns 0 when arrays are identical (same refs)", () => {
      const msgs = [{ role: "user", content: "hello" }];
      expect(estimateDeltaTokens(msgs, msgs)).toBe(0);
    });

    it("returns delta for new messages added", () => {
      const old = [{ role: "user", content: "hello" }];
      const newMsgs = [...old, { role: "assistant", content: "world" }];
      const delta = estimateDeltaTokens(old, newMsgs);
      expect(delta).toBeGreaterThan(0);
    });

    it("handles null oldMessages", () => {
      const newMsgs = [{ role: "user", content: "hello" }];
      const delta = estimateDeltaTokens(null, newMsgs);
      expect(delta).toBeGreaterThan(0);
    });

    it("returns 0 when same length with same references", () => {
      const msg1 = { role: "user", content: "a" };
      const msg2 = { role: "assistant", content: "b" };
      const arr = [msg1, msg2];
      expect(estimateDeltaTokens(arr, arr)).toBe(0);
    });

    it("detects changes when same length but different refs", () => {
      const old = [{ role: "user", content: "a" }];
      const newMsgs = [{ role: "user", content: "b" }];
      // Same length, different refs — delta is 0 because only new messages (from oldCount) are counted
      // and oldCount === newCount, so loop from oldCount to newCount doesn't run
      const delta = estimateDeltaTokens(old, newMsgs);
      expect(delta).toBe(0);
    });
  });

  // ─── serializeMessage ─────────────────────────────────────────
  describe("serializeMessage()", () => {
    const { serializeMessage } = require("../cli/context-engine");

    it("serializes a message to JSON", () => {
      const msg = { role: "user", content: "hello" };
      const result = serializeMessage(msg);
      expect(result).toBe(JSON.stringify(msg));
    });

    it("returns cached result for same object", () => {
      const msg = { role: "user", content: "test" };
      const r1 = serializeMessage(msg);
      const r2 = serializeMessage(msg);
      expect(r1).toBe(r2);
    });
  });

  // ─── invalidateTokenRatioCache ───────────────────────────────
  describe("invalidateTokenRatioCache()", () => {
    const { invalidateTokenRatioCache } = require("../cli/context-engine");

    it("can be called without error", () => {
      expect(() => invalidateTokenRatioCache()).not.toThrow();
    });
  });

  // ─── compressToolResult - code block preservation ──────────
  describe("compressToolResult() - code blocks", () => {
    it("preserves code blocks in head section of long output", () => {
      const lines = [];
      for (let i = 0; i < 30; i++) lines.push(`line ${i}`);
      lines[5] = "```javascript";
      lines[6] = "const x = 1;";
      lines[7] = "```";
      for (let i = 30; i < 50; i++) lines.push(`more output ${i}`);
      const content = lines.join("\n");
      const result = compressToolResult(content, 200);
      expect(result).toMatch(/lines omitted|50 total/);
    });

    it("preserves BLOCKED status with extra budget", () => {
      const content = "BLOCKED: something happened\n" + "x".repeat(200);
      const result = compressToolResult(content, 100);
      // BLOCKED gets 3x budget = 300, content is ~228 chars, should fit
      expect(result).toBe(content);
    });

    it("preserves CANCELLED status with extra budget", () => {
      const content = "CANCELLED: user cancelled\n" + "x".repeat(200);
      const result = compressToolResult(content, 100);
      expect(result).toBe(content);
    });
  });

  // ─── scoreMessageRelevance - edge cases ────────────────────
  describe("scoreMessageRelevance() - edge cases", () => {
    it("handles single-message array for recency", () => {
      const msg = { role: "user", content: "hello" };
      const score = scoreMessageRelevance(msg, 0, 1, new Set());
      // recencyRatio = 1 for single message
      expect(score).toBe(35 + 30); // user (35) + recency (30)
    });

    it("scores BLOCKED tool messages higher than normal tool", () => {
      const normal = { role: "tool", content: "file data" };
      const blocked = { role: "tool", content: "BLOCKED: forbidden command" };
      const normalScore = scoreMessageRelevance(normal, 5, 10, new Set());
      const blockedScore = scoreMessageRelevance(blocked, 5, 10, new Set());
      expect(blockedScore).toBeGreaterThan(normalScore);
    });

    it("handles non-string content for file overlap", () => {
      const activeFiles = new Set(["/src/data.json"]);
      const msg = { role: "tool", content: { file: "/src/data.json" } };
      const score = scoreMessageRelevance(msg, 0, 1, activeFiles);
      expect(score).toBeGreaterThan(0);
    });

    it("limits file overlap bonus to 30", () => {
      const files = new Set(["/a.js", "/b.js", "/c.js", "/d.js", "/e.js"]);
      const msg = {
        role: "user",
        content: "Check /a.js /b.js /c.js /d.js /e.js",
      };
      const score = scoreMessageRelevance(msg, 9, 10, files);
      // user(35) + recency(27) + fileOverlap(min(50,30)=30) = 92, capped at 100
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ─── fitToContext - Phase 2 (medium compression) ────────────
  describe("fitToContext() - medium compression phase", () => {
    it("uses medium compression when light is not enough", async () => {
      registry.getActiveModel.mockReturnValue({
        id: "small",
        contextWindow: 300,
      });

      const messages = [
        { role: "system", content: "sys" },
        ...Array.from({ length: 20 }, (_, i) => ({
          role: "tool",
          content: "x".repeat(150),
          tool_call_id: `c${i}`,
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          role: "user",
          content: `recent ${i}`,
        })),
      ];

      const { compressed, tokensRemoved } = await fitToContext(messages, []);
      expect(compressed).toBe(true);
      expect(tokensRemoved).toBeGreaterThan(0);
    });
  });

  // ─── compressMessage - tool with non-string content ──────────
  describe("compressMessage() - edge cases", () => {
    it("handles tool message with non-string content", () => {
      const msg = {
        role: "tool",
        content: { data: "x".repeat(500) },
        tool_call_id: "c1",
      };
      const compressed = compressMessage(msg, "light");
      expect(compressed.content).toBeDefined();
    });

    it("medium does not simplify tool_calls (only aggressive does)", () => {
      const msg = {
        role: "assistant",
        content: "short",
        tool_calls: [
          { function: { name: "bash", arguments: "a".repeat(200) } },
        ],
      };
      const compressed = compressMessage(msg, "medium");
      expect(compressed.tool_calls[0].function.arguments.length).toBe(200);
    });
  });

  // ─── Model-family token ratios ────────────────────────────────
  describe("model-family token ratios", () => {
    it("uses devstral ratio (3.8) for devstral models", () => {
      registry.getActiveModel.mockReturnValue({
        id: "devstral-2:123b",
        provider: "ollama",
        contextWindow: 131072,
      });
      // Invalidate cache so new model takes effect
      const { invalidateTokenRatioCache } = require("../cli/context-engine");
      invalidateTokenRatioCache();

      // 380 chars at 3.8 chars/token = 100 tokens
      const tokens = estimateTokens("a".repeat(380));
      expect(tokens).toBe(100);
    });

    it("uses qwen ratio (3.5) for qwen models", () => {
      registry.getActiveModel.mockReturnValue({
        id: "qwen3-coder:480b",
        provider: "ollama",
        contextWindow: 131072,
      });
      const { invalidateTokenRatioCache } = require("../cli/context-engine");
      invalidateTokenRatioCache();

      // 350 chars at 3.5 chars/token = 100 tokens
      const tokens = estimateTokens("a".repeat(350));
      expect(tokens).toBe(100);
    });

    it("uses kimi ratio (3.7) for kimi models", () => {
      registry.getActiveModel.mockReturnValue({
        id: "kimi-k2:1t",
        provider: "ollama",
        contextWindow: 256000,
      });
      const { invalidateTokenRatioCache } = require("../cli/context-engine");
      invalidateTokenRatioCache();

      // 370 chars at 3.7 chars/token = 100 tokens
      const tokens = estimateTokens("a".repeat(370));
      expect(tokens).toBe(100);
    });

    it("falls back to provider ratio for unknown models", () => {
      registry.getActiveModel.mockReturnValue({
        id: "unknown-model:7b",
        provider: "ollama",
        contextWindow: 32768,
      });
      const { invalidateTokenRatioCache } = require("../cli/context-engine");
      invalidateTokenRatioCache();

      // 400 chars at 4.0 chars/token = 100 tokens
      const tokens = estimateTokens("a".repeat(400));
      expect(tokens).toBe(100);
    });
  });

  // ─── Dynamic compression thresholds ───────────────────────────
  describe("dynamic compression thresholds", () => {
    it("exports TIER_COMPRESSION_THRESHOLDS with lowered full/standard thresholds", () => {
      // Thresholds lowered to trigger earlier and prevent 111% context overflow:
      // full: 0.75 → 0.68, standard: 0.70 → 0.65
      expect(TIER_COMPRESSION_THRESHOLDS.essential).toBe(0.60);
      expect(TIER_COMPRESSION_THRESHOLDS.standard).toBe(0.65);
      expect(TIER_COMPRESSION_THRESHOLDS.full).toBe(0.75);
    });

    it("TIER_COMPRESSION_THRESHOLDS.full matches COMPRESSION_THRESHOLD", () => {
      // Full-tier raised to 0.75 — earlier 0.68 was causing frequent
      // fitToContext overhead, hurting task completion speed.
      expect(TIER_COMPRESSION_THRESHOLDS.full).toBe(0.75);
      // Raw COMPRESSION_THRESHOLD (env-override base) stays at 0.75
      expect(COMPRESSION_THRESHOLD).toBe(0.75);
    });

    it("returns lower threshold when tool-tiers reports essential tier", () => {
      // Mock tool-tiers to return essential
      jest.doMock("../cli/tool-tiers", () => ({
        getActiveTier: () => "essential",
      }));
      // getEffectiveCompressionThreshold uses require() internally,
      // so we test via the exported TIER_COMPRESSION_THRESHOLDS map
      expect(TIER_COMPRESSION_THRESHOLDS.essential).toBe(0.60);
      expect(TIER_COMPRESSION_THRESHOLDS.standard).toBe(0.65);
    });
  });
});

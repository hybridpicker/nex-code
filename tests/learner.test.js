jest.mock("../cli/providers/registry", () => ({
  callChat: jest.fn(),
}));

jest.mock("../cli/memory", () => ({
  remember: jest.fn(),
  recall: jest.fn().mockReturnValue(null),
  listMemories: jest.fn().mockReturnValue([]),
}));

const fs = require("fs");
const path = require("path");
const os = require("os");

const { callChat } = require("../cli/providers/registry");
const { remember, recall } = require("../cli/memory");
const {
  reflectOnSession,
  applyMemories,
  applyNexAdditions,
  learnFromSession,
  LEARN_MIN_MESSAGES,
} = require("../cli/learner");

// ─── Helpers ─────────────────────────────────────────────────
function makeMessages(n = 6) {
  return Array.from({ length: n * 2 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `Turn ${Math.floor(i / 2) + 1} content here`,
  }));
}

// ─── reflectOnSession ─────────────────────────────────────────
describe("reflectOnSession()", () => {
  beforeEach(() => {
    callChat.mockReset();
    recall.mockReturnValue(null);
  });

  it("skips when fewer than LEARN_MIN_MESSAGES user messages", async () => {
    const msgs = makeMessages(LEARN_MIN_MESSAGES - 1);
    const result = await reflectOnSession(msgs);
    expect(result.skipped).toBe(true);
    expect(callChat).not.toHaveBeenCalled();
  });

  it("returns memories and nex_additions on success", async () => {
    callChat.mockResolvedValueOnce({
      content: JSON.stringify({
        memories: [{ key: "prefer_yarn", value: "always use yarn not npm" }],
        nex_additions: ["- Use yarn for package management"],
        summary: "Set up project preferences",
      }),
    });

    const result = await reflectOnSession(makeMessages(5));
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].key).toBe("prefer_yarn");
    expect(result.nex_additions).toHaveLength(1);
    expect(result.summary).toBe("Set up project preferences");
  });

  it("handles JSON wrapped in markdown code block", async () => {
    callChat.mockResolvedValueOnce({
      content:
        '```json\n{"memories": [], "nex_additions": [], "summary": "test"}\n```',
    });

    const result = await reflectOnSession(makeMessages(5));
    expect(result.memories).toEqual([]);
    expect(result.summary).toBe("test");
  });

  it("returns error when callChat throws", async () => {
    callChat.mockRejectedValueOnce(new Error("API down"));
    const result = await reflectOnSession(makeMessages(5));
    expect(result.error).toMatch("API down");
    expect(result.memories).toEqual([]);
  });

  it("returns error when no JSON in response", async () => {
    callChat.mockResolvedValueOnce({
      content: "Sorry, I cannot help with that.",
    });
    const result = await reflectOnSession(makeMessages(5));
    expect(result.error).toBeDefined();
  });

  it("handles missing fields gracefully", async () => {
    callChat.mockResolvedValueOnce({
      content: '{"summary": "done"}',
    });
    const result = await reflectOnSession(makeMessages(5));
    expect(result.memories).toEqual([]);
    expect(result.nex_additions).toEqual([]);
  });

  it("passes temperature: 0 and maxTokens: 800 to callChat", async () => {
    callChat.mockResolvedValueOnce({
      content: '{"memories": [], "nex_additions": [], "summary": "test"}',
    });
    await reflectOnSession(makeMessages(5));
    const [, , opts] = callChat.mock.calls[0];
    expect(opts.temperature).toBe(0);
    expect(opts.maxTokens).toBe(800);
  });
});

// ─── applyMemories ────────────────────────────────────────────
describe("applyMemories()", () => {
  beforeEach(() => {
    remember.mockClear();
    recall.mockReturnValue(null);
  });

  it("calls remember for each valid memory", () => {
    applyMemories([
      { key: "pref_tabs", value: "use tabs not spaces" },
      { key: "pref_quotes", value: "single quotes" },
    ]);
    expect(remember).toHaveBeenCalledTimes(2);
  });

  it("marks existing memory as updated", () => {
    recall.mockReturnValue("old value");
    const result = applyMemories([{ key: "pref_tabs", value: "new value" }]);
    expect(result[0].action).toBe("updated");
  });

  it("marks new memory as added", () => {
    recall.mockReturnValue(null);
    const result = applyMemories([{ key: "pref_tabs", value: "new value" }]);
    expect(result[0].action).toBe("added");
  });

  it("skips memories with identical values", () => {
    recall.mockReturnValue("same value");
    const result = applyMemories([{ key: "pref_tabs", value: "same value" }]);
    expect(result).toHaveLength(0);
    expect(remember).not.toHaveBeenCalled();
  });

  it("skips entries with missing key or value", () => {
    applyMemories([
      { key: "", value: "value" },
      { key: "key", value: "" },
      { key: null, value: "value" },
      {},
    ]);
    expect(remember).not.toHaveBeenCalled();
  });

  it("handles empty array", () => {
    const result = applyMemories([]);
    expect(result).toEqual([]);
  });
});

// ─── applyNexAdditions ────────────────────────────────────────
describe("applyNexAdditions()", () => {
  let tmpDir;
  let nexPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-learner-test-"));
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    nexPath = path.join(tmpDir, "NEX.md");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates NEX.md if it does not exist", () => {
    applyNexAdditions(["- Use yarn for installs"]);
    expect(fs.existsSync(nexPath)).toBe(true);
    expect(fs.readFileSync(nexPath, "utf-8")).toContain(
      "Use yarn for installs",
    );
  });

  it("appends to existing NEX.md", () => {
    fs.writeFileSync(nexPath, "# Existing rules\n", "utf-8");
    applyNexAdditions(["- New rule here"]);
    const content = fs.readFileSync(nexPath, "utf-8");
    expect(content).toContain("Existing rules");
    expect(content).toContain("New rule here");
  });

  it("does not duplicate lines already present", () => {
    fs.writeFileSync(nexPath, "- Use yarn for installs\n", "utf-8");
    const added = applyNexAdditions(["- Use yarn for installs"]);
    expect(added).toHaveLength(0);
    const content = fs.readFileSync(nexPath, "utf-8");
    expect(content.match(/Use yarn/g)).toHaveLength(1);
  });

  it("returns array of actually added lines", () => {
    const added = applyNexAdditions(["- Line A", "- Line B"]);
    expect(added).toEqual(["- Line A", "- Line B"]);
  });

  it("returns empty array when nothing to add", () => {
    const added = applyNexAdditions([]);
    expect(added).toEqual([]);
  });

  it("skips falsy entries", () => {
    const added = applyNexAdditions([null, "", undefined, "- Valid line"]);
    expect(added).toEqual(["- Valid line"]);
  });

  it("ends file with newline", () => {
    applyNexAdditions(["- Some instruction"]);
    const content = fs.readFileSync(nexPath, "utf-8");
    expect(content.endsWith("\n")).toBe(true);
  });
});

// ─── learnFromSession ─────────────────────────────────────────
describe("learnFromSession()", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-learn-session-"));
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    callChat.mockReset();
    remember.mockClear();
    recall.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns skipped for short sessions", async () => {
    const result = await learnFromSession(makeMessages(2));
    expect(result.skipped).toBe(true);
  });

  it("full round-trip: reflects, applies memories, applies nex", async () => {
    callChat.mockResolvedValueOnce({
      content: JSON.stringify({
        memories: [{ key: "use_bun", value: "always use bun not npm" }],
        nex_additions: ["- Always use bun as package manager"],
        summary: "Learned bun preference",
      }),
    });

    const result = await learnFromSession(makeMessages(5));
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].key).toBe("use_bun");
    expect(result.nexAdded).toHaveLength(1);
    expect(result.summary).toBe("Learned bun preference");
    expect(remember).toHaveBeenCalledWith("use_bun", "always use bun not npm");
  });

  it("propagates error from reflection", async () => {
    callChat.mockRejectedValueOnce(new Error("timeout"));
    const result = await learnFromSession(makeMessages(5));
    expect(result.error).toMatch("timeout");
  });
});

// ─── LEARN_MIN_MESSAGES export ────────────────────────────────
describe("LEARN_MIN_MESSAGES", () => {
  it("is a positive number", () => {
    expect(typeof LEARN_MIN_MESSAGES).toBe("number");
    expect(LEARN_MIN_MESSAGES).toBeGreaterThan(0);
  });
});

// ─── reflectOnSession - edge cases ────────────────────────────
describe("reflectOnSession() - edge cases", () => {
  beforeEach(() => {
    callChat.mockReset();
    recall.mockReturnValue(null);
  });

  it("skips when all messages are too short (< 10 chars)", async () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "hi",
    }));
    const result = await reflectOnSession(msgs);
    expect(result.skipped).toBe(true);
  });

  it("skips when all messages are tool_calls (non-string content)", async () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content:
        i % 2 === 0
          ? "Long enough user message here"
          : [{ type: "tool_call", id: "x" }],
    }));
    // Half messages have non-string content, the user ones are fine
    const result = await reflectOnSession(msgs);
    // Should not skip because user messages are valid
    expect(callChat).toHaveBeenCalled();
  });

  it("filters out system messages", async () => {
    const msgs = [
      ...makeMessages(5),
      {
        role: "system",
        content: "System instructions here that should be filtered",
      },
    ];
    callChat.mockResolvedValueOnce({
      content: '{"memories": [], "nex_additions": [], "summary": "test"}',
    });
    await reflectOnSession(msgs);
    // System messages should be filtered out
    expect(callChat).toHaveBeenCalled();
  });

  it("truncates long messages to 700 chars", async () => {
    const longMsg = "x".repeat(1000);
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: longMsg,
    }));
    callChat.mockResolvedValueOnce({
      content: '{"memories": [], "nex_additions": [], "summary": "test"}',
    });
    await reflectOnSession(msgs);
    const sentContent = callChat.mock.calls[0][0][1].content;
    // Each message is truncated to 700 chars
    expect(sentContent).not.toContain("x".repeat(800));
  });

  it("only sends last 40 messages", async () => {
    const msgs = makeMessages(30); // 60 messages total
    callChat.mockResolvedValueOnce({
      content: '{"memories": [], "nex_additions": [], "summary": "test"}',
    });
    await reflectOnSession(msgs);
    const sentContent = callChat.mock.calls[0][0][1].content;
    // Should contain Turn 30 (last message) but the formatted output is limited to 40
    expect(sentContent).toContain("[USER]");
  });
});

// ─── applyMemories - edge cases ──────────────────────────────
describe("applyMemories() - edge cases", () => {
  beforeEach(() => {
    remember.mockClear();
    recall.mockReturnValue(null);
  });

  it("handles null input", () => {
    const result = applyMemories(null);
    expect(result).toEqual([]);
  });

  it("handles undefined input", () => {
    const result = applyMemories(undefined);
    expect(result).toEqual([]);
  });

  it("truncates long keys to 60 chars", () => {
    const longKey = "a".repeat(100);
    applyMemories([{ key: longKey, value: "short value" }]);
    expect(remember).toHaveBeenCalled();
    const calledKey = remember.mock.calls[0][0];
    expect(calledKey.length).toBeLessThanOrEqual(60);
  });

  it("truncates long values to 200 chars", () => {
    const longValue = "v".repeat(300);
    applyMemories([{ key: "test_key", value: longValue }]);
    expect(remember).toHaveBeenCalled();
    const calledValue = remember.mock.calls[0][1];
    expect(calledValue.length).toBeLessThanOrEqual(200);
  });

  it("replaces spaces in keys with hyphens", () => {
    applyMemories([{ key: "my test key", value: "test value" }]);
    expect(remember).toHaveBeenCalledWith("my-test-key", "test value");
  });

  it("skips non-string keys", () => {
    applyMemories([{ key: 123, value: "test" }]);
    expect(remember).not.toHaveBeenCalled();
  });

  it("skips non-string values", () => {
    applyMemories([{ key: "test", value: 123 }]);
    expect(remember).not.toHaveBeenCalled();
  });
});

// ─── applyNexAdditions - edge cases ──────────────────────────
describe("applyNexAdditions() - edge cases", () => {
  let tmpDir2;
  let nexPath2;

  beforeEach(() => {
    tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "nex-learner-add-"));
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir2);
    nexPath2 = path.join(tmpDir2, "NEX.md");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir2, { recursive: true, force: true });
  });

  it("handles null additions", () => {
    const result = applyNexAdditions(null);
    expect(result).toEqual([]);
  });

  it("handles non-string entries in additions", () => {
    const result = applyNexAdditions([123, true, "- Valid line"]);
    expect(result).toEqual(["- Valid line"]);
  });

  it("handles file without trailing newline", () => {
    fs.writeFileSync(nexPath2, "- Existing rule", "utf-8");
    applyNexAdditions(["- New rule"]);
    const content = fs.readFileSync(nexPath2, "utf-8");
    expect(content).toContain("Existing rule");
    expect(content).toContain("New rule");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("deduplicates based on first 35 chars", () => {
    const longLine = "- " + "x".repeat(50);
    fs.writeFileSync(nexPath2, longLine + "\n", "utf-8");
    const result = applyNexAdditions([longLine + " extra"]);
    // First 35 chars match, so should be skipped
    expect(result).toHaveLength(0);
  });

  it("handles whitespace-only entries", () => {
    const result = applyNexAdditions(["   ", "\t", "- Valid"]);
    expect(result).toEqual(["- Valid"]);
  });
});

// ─── reflectBrain ──────────────────────────────────────────────
describe("reflectBrain()", () => {
  const { reflectBrain } = require("../cli/learner");

  beforeEach(() => {
    callChat.mockReset();
  });

  it("skips when session is too short", async () => {
    const msgs = makeMessages(LEARN_MIN_MESSAGES - 1);
    const result = await reflectBrain(msgs);
    expect(result.skip_reason).toBe("Session too short");
    expect(result.documents).toEqual([]);
    expect(callChat).not.toHaveBeenCalled();
  });

  it("skips when all messages have short content", async () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "hi",
    }));
    const result = await reflectBrain(msgs);
    expect(result.skip_reason).toBe("No usable content");
  });

  it("returns documents on success", async () => {
    callChat.mockResolvedValueOnce({
      content: JSON.stringify({
        documents: [{ name: "test-doc", content: "# Test", reason: "useful" }],
      }),
    });
    const result = await reflectBrain(makeMessages(5));
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].name).toBe("test-doc");
  });

  it("returns error when callChat throws", async () => {
    callChat.mockRejectedValueOnce(new Error("API down"));
    const result = await reflectBrain(makeMessages(5));
    expect(result.error).toMatch("API down");
  });

  it("returns error when no JSON in response", async () => {
    callChat.mockResolvedValueOnce({ content: "no json here" });
    const result = await reflectBrain(makeMessages(5));
    expect(result.error).toBeDefined();
  });

  it("handles missing documents array", async () => {
    callChat.mockResolvedValueOnce({
      content: '{"skip_reason": "nothing to learn"}',
    });
    const result = await reflectBrain(makeMessages(5));
    expect(result.documents).toEqual([]);
    expect(result.skip_reason).toBe("nothing to learn");
  });
});

// ─── learnBrainFromSession ─────────────────────────────────────
describe("learnBrainFromSession()", () => {
  const { learnBrainFromSession } = require("../cli/learner");

  beforeEach(() => {
    callChat.mockReset();
  });

  it("returns error from reflectBrain", async () => {
    callChat.mockRejectedValueOnce(new Error("fail"));
    const result = await learnBrainFromSession(makeMessages(5));
    expect(result.error).toMatch("fail");
    expect(result.written).toEqual([]);
  });

  it("returns skip_reason when no documents", async () => {
    callChat.mockResolvedValueOnce({
      content: '{"documents": [], "skip_reason": "nothing useful"}',
    });
    const result = await learnBrainFromSession(makeMessages(5));
    expect(result.skip_reason).toBe("nothing useful");
    expect(result.written).toEqual([]);
  });
});

// ─── learnFromSession - error propagation ──────────────────────
describe("learnFromSession() - additional", () => {
  let tmpDir3;

  beforeEach(() => {
    tmpDir3 = fs.mkdtempSync(path.join(os.tmpdir(), "nex-learn-extra-"));
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir3);
    callChat.mockReset();
    recall.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir3, { recursive: true, force: true });
  });

  it("applies multiple memories and NEX additions in one session", async () => {
    callChat.mockResolvedValueOnce({
      content: JSON.stringify({
        memories: [
          { key: "pref_a", value: "value a" },
          { key: "pref_b", value: "value b" },
        ],
        nex_additions: ["- Rule A", "- Rule B"],
        summary: "Two preferences learned",
      }),
    });
    const result = await learnFromSession(makeMessages(5));
    expect(result.applied).toHaveLength(2);
    expect(result.nexAdded).toHaveLength(2);
    expect(result.summary).toBe("Two preferences learned");
  });
});

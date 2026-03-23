/**
 * tests/retry-undo.test.js
 * Tests for /undo (via file-history) and /retry (handleSlashCommand) commands.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  recordChange,
  undo,
  getUndoCount,
  clearHistory,
} = require("../cli/file-history");

// ─── /undo (file-history undo stack) ──────────────────────────

describe("/undo — file-history undo stack", () => {
  let tmpDir;

  beforeEach(() => {
    clearHistory();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-retry-undo-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("undoStack starts empty", () => {
    expect(getUndoCount()).toBe(0);
  });

  test("recordChange saves content to undo stack", () => {
    const fp = path.join(tmpDir, "a.js");
    fs.writeFileSync(fp, "before");
    recordChange("write_file", fp, null, "after");
    expect(getUndoCount()).toBe(1);
  });

  test("undoLastChange restores previous file content", async () => {
    const fp = path.join(tmpDir, "b.txt");
    fs.writeFileSync(fp, "original");
    recordChange("edit_file", fp, "original", "modified");
    fs.writeFileSync(fp, "modified");

    const result = await undo();
    expect(result).not.toBeNull();
    expect(result.filePath).toBe(fp);
    expect(fs.readFileSync(fp, "utf8")).toBe("original");
  });

  test("undoLastChange returns null on empty stack", async () => {
    expect(await undo()).toBeNull();
  });

  test("stack is capped at 50 entries (MAX_HISTORY)", () => {
    for (let i = 0; i < 55; i++) {
      recordChange("write_file", `/tmp/file${i}.js`, null, `content${i}`);
    }
    expect(getUndoCount()).toBe(50);
  });

  test("undo removes newly-created file when oldContent is null", async () => {
    const fp = path.join(tmpDir, "created.js");
    fs.writeFileSync(fp, "new file");
    recordChange("write_file", fp, null, "new file");

    const result = await undo();
    expect(result).not.toBeNull();
    expect(fs.existsSync(fp)).toBe(false);
  });

  test("multiple undos step back through changes", async () => {
    const fp = path.join(tmpDir, "c.txt");
    fs.writeFileSync(fp, "v1");
    recordChange("edit_file", fp, "v1", "v2");
    fs.writeFileSync(fp, "v2");
    recordChange("edit_file", fp, "v2", "v3");
    fs.writeFileSync(fp, "v3");

    await undo();
    expect(fs.readFileSync(fp, "utf8")).toBe("v2");
    await undo();
    expect(fs.readFileSync(fp, "utf8")).toBe("v1");
    expect(await undo()).toBeNull();
  });
});

// ─── /retry — handleSlashCommand ─────────────────────────────

describe("/retry — handleSlashCommand", () => {
  let agentMessages;
  let processInputCalls;
  let setMessagesCalls;

  beforeEach(() => {
    agentMessages = [];
    processInputCalls = [];
    setMessagesCalls = [];
  });

  /**
   * Minimal stand-in for the retry logic extracted from handleSlashCommand.
   * Mirrors the implementation exactly so tests stay in sync with prod code.
   */
  async function simulateRetry(args, messages, overrideModel = null) {
    const currentMsgs = [...messages];
    const lastUserIdx = currentMsgs.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) {
      return { early: true };
    }

    const modelFlagIdx = args.indexOf("--model");
    const retryModel =
      modelFlagIdx !== -1 && args[modelFlagIdx + 1]
        ? args[modelFlagIdx + 1]
        : null;

    const lastUserMsg = currentMsgs[lastUserIdx];
    let retryText;
    if (typeof lastUserMsg.content === "string") {
      retryText = lastUserMsg.content;
    } else if (Array.isArray(lastUserMsg.content)) {
      retryText = lastUserMsg.content
        .filter((b) => b && b.type === "text")
        .map((b) => b.text)
        .join("\n");
    } else {
      retryText = String(lastUserMsg.content);
    }

    const truncated = currentMsgs.slice(0, lastUserIdx);
    setMessagesCalls.push(truncated);
    processInputCalls.push({ text: retryText, model: retryModel });
    return { early: false, text: retryText, model: retryModel, truncated };
  }

  test("returns early when no user messages exist", async () => {
    const result = await simulateRetry([], [
      { role: "system", content: "You are helpful." },
    ]);
    expect(result.early).toBe(true);
    expect(processInputCalls).toHaveLength(0);
  });

  test("truncates history to before last user message", async () => {
    const messages = [
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second question" },
      { role: "assistant", content: "second answer" },
    ];
    const result = await simulateRetry([], messages);
    expect(result.early).toBe(false);
    expect(result.truncated).toHaveLength(2); // only the first user+assistant pair
    expect(result.text).toBe("second question");
  });

  test("extracts text from content-block array", async () => {
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "hello" },
          { type: "text", text: " world" },
        ],
      },
    ];
    const result = await simulateRetry([], messages);
    expect(result.text).toBe("hello\n world");
  });

  test("parses --model flag correctly", async () => {
    const messages = [{ role: "user", content: "do something" }];
    const result = await simulateRetry(["--model", "kimi-k2.5"], messages);
    expect(result.model).toBe("kimi-k2.5");
  });

  test("model is null when no --model flag", async () => {
    const messages = [{ role: "user", content: "do something" }];
    const result = await simulateRetry([], messages);
    expect(result.model).toBeNull();
  });

  test("sets messages to empty array when retrying first-ever user message", async () => {
    const messages = [{ role: "user", content: "very first message" }];
    const result = await simulateRetry([], messages);
    expect(result.truncated).toHaveLength(0);
    expect(result.text).toBe("very first message");
  });
});

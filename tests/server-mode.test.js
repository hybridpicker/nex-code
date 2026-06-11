/**
 * tests/server-mode.test.js — Unit tests for cli/server-mode.js
 * Tests the JSON-lines IPC server loop: ready signal, message routing, confirm flow.
 */

// Mock safety module
jest.mock("../cli/safety", () => ({
  setConfirmHook: jest.fn(),
  isCritical: jest.fn().mockReturnValue(false),
}));

// Mock agent module
jest.mock("../cli/agent", () => ({
  processInput: jest.fn().mockResolvedValue(undefined),
  clearConversation: jest.fn(),
  getConversationMessages: jest.fn().mockReturnValue([]),
  setAbortSignalGetter: jest.fn(),
}));

jest.mock("../cli/tools", () => ({
  setAskUserHandler: jest.fn(),
}));

let mockLineHandler;

jest.mock("readline", () => ({
  createInterface: jest.fn(() => {
    const MockEmitter = require("events");
    const rl = new MockEmitter();
    rl.close = jest.fn();
    const origOn = rl.on.bind(rl);
    rl.on = jest.fn((event, handler) => {
      if (event === "line") mockLineHandler = handler;
      return origOn(event, handler);
    });
    return rl;
  }),
}));

const { setConfirmHook } = require("../cli/safety");
const {
  processInput,
  clearConversation,
  getConversationMessages,
  setAbortSignalGetter,
} = require("../cli/agent");
const { setAskUserHandler } = require("../cli/tools");

let stdoutWrites;
let stderrWrites;
let stdoutSpy;
let stderrSpy;
let originalEnv;
let originalLog;

beforeEach(() => {
  stdoutWrites = [];
  stderrWrites = [];
  stdoutSpy = jest.spyOn(process.stdout, "write").mockImplementation((data) => {
    stdoutWrites.push(data);
    return true;
  });
  stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation((data) => {
    stderrWrites.push(data);
    return true;
  });
  originalEnv = process.env.NEX_SERVER;
  originalLog = console.log;
  mockLineHandler = null;
  processInput.mockReset().mockResolvedValue(undefined);
  clearConversation.mockReset();
  getConversationMessages.mockReset().mockReturnValue([]);
  setAbortSignalGetter.mockReset();
  setConfirmHook.mockReset();
  setAskUserHandler.mockReset();
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  console.log = originalLog;
  if (originalEnv === undefined) {
    delete process.env.NEX_SERVER;
  } else {
    process.env.NEX_SERVER = originalEnv;
  }
});

function startFresh() {
  const { startServerMode } = require("../cli/server-mode");
  startServerMode();
}

describe("startServerMode", () => {
  test("sets NEX_SERVER env to 1", () => {
    startFresh();
    expect(process.env.NEX_SERVER).toBe("1");
  });

  test("emits ready message on stdout", () => {
    startFresh();
    expect(stdoutWrites.length).toBeGreaterThanOrEqual(1);
    expect(stdoutWrites[0]).toBe('{"type":"ready"}\n');
  });

  test("redirects console.log to stderr", () => {
    startFresh();
    console.log("test message");
    expect(stderrWrites).toEqual(
      expect.arrayContaining([expect.stringContaining("test message")]),
    );
  });

  test("handles chat message and calls processInput", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        { role: "assistant", content: "Implemented the requested change and verified it." },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-1","text":"hello"}');

    expect(processInput).toHaveBeenCalledWith("hello", expect.any(Object), {
      serverMode: true,
    });
    // Should emit done
    const doneMsg = stdoutWrites.find((w) => w.includes('"done"'));
    expect(doneMsg).toBeDefined();
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-1",
      status: "complete",
      success: true,
    });
  });

  test("marks stalled runs as non-success when the assistant reports no work completed", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          role: "assistant",
          content:
            "Implementation stalled before edits.\n\nThe implementation phase exhausted its turn budget without changing files.",
        },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-2","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-2"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-2",
      status: "stalled",
      success: false,
    });
  });

  test("marks blocked-loop stalls as non-success after stale planning text", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          role: "assistant",
          content:
            'I will add the "remaining kcal" field. Let me first read the specific section to understand the current structure:',
        },
        {
          role: "assistant",
          content:
            "Implementation stalled before edits.\n\nThe model kept calling tools that were blocked by loop guards instead of changing files or producing a valid final answer. Stopping without commit or push so the workflow does not falsely report success.",
        },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-blocked-loop","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-blocked-loop"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-blocked-loop",
      status: "stalled",
      success: false,
    });
  });

  test("keeps completed work as success when redundant readbacks stall later", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          role: "assistant",
          content:
            "The src/settings.js file now includes desktopVerification and npm test passed.",
        },
        {
          role: "assistant",
          content:
            "Implementation stalled before edits.\n\nThe model kept calling tools that were blocked by loop guards instead of changing files or producing a valid final answer. Stopping without commit or push so the workflow does not falsely report success.",
        },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-complete-then-blocked","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-complete-then-blocked"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-complete-then-blocked",
      status: "complete",
      success: true,
      summary: expect.stringContaining("desktopVerification"),
    });
  });

  test("marks unfinished transcript-derived investigation text as non-success", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          role: "assistant",
          content:
            'I will add the "remaining kcal" field. Let me first check the current structure of the nutrition ring content section:',
        },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-unfinished-kcal","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-unfinished-kcal"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-unfinished-kcal",
      status: "stalled",
      success: false,
    });
  });

  test("marks unfinished neutral investigation text as non-success", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          role: "assistant",
          content:
            "I will update src/components/ProfileCard.jsx. Let me first inspect the current component structure:",
        },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-unfinished-neutral","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-unfinished-neutral"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-unfinished-neutral",
      status: "stalled",
      success: false,
    });
  });

  test("keeps completed implementation summaries as success", async () => {
    startFresh();
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          role: "assistant",
          content:
            "Updated src/components/ProfileCard.jsx and verified the focused component test passed.",
        },
      ]);

    await mockLineHandler('{"type":"chat","id":"msg-complete-neutral","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-complete-neutral"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-complete-neutral",
      status: "complete",
      success: true,
    });
  });

  test("does not truncate Desktop completion summaries mid-sentence", async () => {
    startFresh();
    const longSummary = [
      "Completed the requested edit.",
      "Changed files: web/templates/fitness/index.html.",
      "Verification: post-edit readback: web/templates/fitness/index.html.",
      "",
      "Additional verification skipped: The verification command npm test --silent could not run because project dependencies are missing or broken in this workspace.",
      "The module '/tmp/example/node_modules/better-sqlite3/build/Release/better_sqlite3.node' was built for a different Node.js version.",
    ].join("\n");
    getConversationMessages
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ role: "assistant", content: longSummary }]);

    await mockLineHandler('{"type":"chat","id":"msg-long-summary","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-long-summary"'));
    const parsed = JSON.parse(doneMsg);
    expect(parsed.summary).toContain("Additional verification skipped");
    expect(parsed.summary).toContain("better_sqlite3.node");
    expect(parsed.summary).not.toMatch(/\bbec$/);
  });

  test("marks missing final assistant output as stalled", async () => {
    startFresh();
    getConversationMessages.mockReturnValueOnce([]).mockReturnValueOnce([]);

    await mockLineHandler('{"type":"chat","id":"msg-3","text":"hello"}');

    const doneMsg = stdoutWrites.find((w) => w.includes('"msg-3"'));
    expect(JSON.parse(doneMsg)).toMatchObject({
      id: "msg-3",
      status: "stalled",
      success: false,
      summary: "The run stopped without a final assistant response.",
    });
  });

  test("handles confirm message and resolves pending confirm", async () => {
    startFresh();

    // Get the confirm hook that was registered
    const hookFn = setConfirmHook.mock.calls[0][0];

    // Simulate a confirm request
    const confirmPromise = hookFn("Allow?", { toolName: "bash" });

    // Find the confirm_request emitted
    const reqMsg = stdoutWrites.find((w) => w.includes("confirm_request"));
    expect(reqMsg).toBeDefined();
    const req = JSON.parse(reqMsg);

    // Send confirm answer
    await mockLineHandler(
      JSON.stringify({ type: "confirm", id: req.id, answer: true }),
    );

    const result = await confirmPromise;
    expect(result).toBe(true);
  });

  test("preserves ask_user text answers from the desktop renderer", async () => {
    startFresh();

    const askHandler = setAskUserHandler.mock.calls[0][0];
    const askPromise = askHandler("Which file should I edit?", []);

    const reqMsg = stdoutWrites.find((w) => w.includes('"ask_user"'));
    expect(reqMsg).toBeDefined();
    const req = JSON.parse(reqMsg);

    await mockLineHandler(
      JSON.stringify({
        type: "confirm",
        id: req.id,
        answer: "desktop/renderer/js/app.js",
      }),
    );

    await expect(askPromise).resolves.toBe("desktop/renderer/js/app.js");
  });

  test("cancel message resolves all pending confirms with false", async () => {
    startFresh();
    const hookFn = setConfirmHook.mock.calls[0][0];

    const p1 = hookFn("Allow 1?", {});
    const p2 = hookFn("Allow 2?", {});

    await mockLineHandler('{"type":"cancel"}');

    expect(await p1).toBe(false);
    expect(await p2).toBe(false);
  });

  test("cancel message aborts an active chat and emits cancelled done once", async () => {
    startFresh();
    let resolveRun;
    processInput.mockImplementationOnce(
      () => new Promise((resolve) => { resolveRun = resolve; }),
    );

    const chatPromise = mockLineHandler(
      '{"type":"chat","id":"msg-cancel","text":"slow"}',
    );
    await Promise.resolve();

    const abortSignal = setAbortSignalGetter.mock.calls[0][0]();
    expect(abortSignal.aborted).toBe(false);

    await mockLineHandler('{"type":"cancel"}');

    expect(abortSignal.aborted).toBe(true);
    const cancelDone = stdoutWrites
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter((msg) => msg && msg.id === "msg-cancel" && msg.type === "done");
    expect(cancelDone).toEqual([
      expect.objectContaining({
        status: "cancelled",
        success: false,
        summary: "Run cancelled by user.",
      }),
    ]);

    resolveRun();
    await chatPromise;

    const allDone = stdoutWrites
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter((msg) => msg && msg.id === "msg-cancel" && msg.type === "done");
    expect(allDone).toHaveLength(1);
  });

  test("clear message calls clearConversation", async () => {
    startFresh();

    await mockLineHandler('{"type":"clear"}');
    expect(clearConversation).toHaveBeenCalled();
  });

  test("malformed JSON is ignored without crash", async () => {
    startFresh();
    expect(() => mockLineHandler("not-json")).not.toThrow();
  });

  test("empty line is ignored without crash", async () => {
    startFresh();
    expect(() => mockLineHandler("")).not.toThrow();
    expect(() => mockLineHandler("   ")).not.toThrow();
  });
});

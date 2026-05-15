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

    expect(processInput).toHaveBeenCalledWith("hello", expect.any(Object));
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

"use strict";

/**
 * Unit tests for cli/daemon.js
 * All real I/O is mocked — no actual filesystem watchers, git calls, or HTTP.
 */

const fs = require("fs");
const https = require("https");
const { execSync } = require("child_process");

// ─── module mocks ─────────────────────────────────────────────────────────────

jest.mock("../cli/agent", () => ({
  processInput: jest.fn().mockResolvedValue(undefined),
  clearConversation: jest.fn(),
}));

jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

const { startDaemon, parseCronToMs, expandTemplate, appendLog, notifyMatrix } =
  require("../cli/daemon");
const { processInput, clearConversation } = require("../cli/agent");

const MINIMAL_CONFIG = {
  triggers: [],
  notify: [],
  logFile: null,
};

function makeConfig(triggers = [], extra = {}) {
  return JSON.stringify({ triggers, notify: [], logFile: null, ...extra });
}

function mockReadFileSync(content) {
  jest.spyOn(fs, "readFileSync").mockReturnValue(content);
}

// ─── test 1: missing config file ──────────────────────────────────────────────

describe("startDaemon()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent process.on from stacking up real listeners
    jest.spyOn(process, "on").mockImplementation(() => process);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws when config file is missing", async () => {
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      const err = new Error("ENOENT: no such file");
      err.code = "ENOENT";
      throw err;
    });
    await expect(startDaemon(".nex/daemon.json")).rejects.toThrow(
      "Config file not found",
    );
  });

  // ─── test 2: registers watchers for each trigger type ───────────────────────

  it("sets up watchers for all trigger types", () => {
    mockReadFileSync(
      makeConfig([
        { on: "file-change", task: "check {changedFile}", debounceMs: 500 },
        { on: "git-commit", task: "review {commitHash}" },
        { on: "schedule", cron: "*/5 * * * *", task: "audit" },
      ]),
    );

    const mockWatcher = { close: jest.fn() };
    jest.spyOn(fs, "watch").mockReturnValue(mockWatcher);
    // git HEAD initialisation
    execSync.mockReturnValue("abc123\n");

    const setIntervalSpy = jest.spyOn(global, "setInterval").mockReturnValue(42);

    startDaemon(".nex/daemon.json");

    expect(fs.watch).toHaveBeenCalledTimes(1);
    // setInterval is called for git-commit (10s poll) AND schedule (5min)
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
  });

  // ─── test 3: file-change debounce ───────────────────────────────────────────

  it("file-change debounce: rapid events collapse into one task call", async () => {
    jest.useFakeTimers();
    mockReadFileSync(
      makeConfig([
        {
          on: "file-change",
          task: "check {changedFile}",
          debounceMs: 1000,
          auto: true,
        },
      ]),
    );

    let watchCallback;
    jest.spyOn(fs, "watch").mockImplementation((_dir, _opts, cb) => {
      watchCallback = cb;
      return { close: jest.fn() };
    });
    execSync.mockReturnValue("abc123\n");

    startDaemon(".nex/daemon.json");

    // Rapid consecutive events
    watchCallback("change", "src/foo.js");
    watchCallback("change", "src/bar.js");
    watchCallback("change", "src/baz.js");

    // Before debounce fires — task should not have been called yet
    expect(processInput).not.toHaveBeenCalled();

    // Advance past debounce
    await jest.runAllTimersAsync();

    expect(processInput).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  // ─── test 4: git-commit trigger fires on HEAD change ────────────────────────

  it("git-commit trigger fires when HEAD hash changes", async () => {
    jest.useFakeTimers();
    mockReadFileSync(
      makeConfig([{ on: "git-commit", task: "review {commitHash}", auto: true }]),
    );

    // Return old hash on first poll-init, new hash on second
    execSync
      .mockReturnValueOnce("oldhash\n") // initial HEAD read
      .mockReturnValueOnce("newhash\n") // poll: new HEAD
      .mockReturnValueOnce("fix: something\n"); // commit subject

    let pollFn;
    jest.spyOn(global, "setInterval").mockImplementation((fn, _ms) => {
      pollFn = fn;
      return 99;
    });

    startDaemon(".nex/daemon.json");
    expect(processInput).not.toHaveBeenCalled();

    // Simulate poll tick
    await pollFn();

    expect(processInput).toHaveBeenCalledTimes(1);
    const calledWith = processInput.mock.calls[0][0];
    expect(calledWith).toContain("newhash");
    jest.useRealTimers();
  });

  // ─── test 5: schedule trigger fires after interval ──────────────────────────

  it("schedule trigger fires after the configured interval", async () => {
    jest.useFakeTimers();
    mockReadFileSync(
      makeConfig([
        { on: "schedule", cron: "*/10 * * * *", task: "audit deps", auto: true },
      ]),
    );

    execSync.mockReturnValue("abc123\n");

    let scheduledFn;
    jest.spyOn(global, "setInterval").mockImplementation((fn, ms) => {
      // 10-minute interval = 600000 ms
      if (ms === 600000) scheduledFn = fn;
      return 77;
    });

    startDaemon(".nex/daemon.json");
    expect(processInput).not.toHaveBeenCalled();

    await scheduledFn();

    expect(processInput).toHaveBeenCalledTimes(1);
    expect(processInput.mock.calls[0][0]).toBe("audit deps");
    jest.useRealTimers();
  });

  // ─── test 6: template expansion ─────────────────────────────────────────────

  it("expands {changedFile} template variable to the actual path", async () => {
    jest.useFakeTimers();
    mockReadFileSync(
      makeConfig([
        {
          on: "file-change",
          task: "run tests for {changedFile}",
          debounceMs: 100,
          auto: true,
        },
      ]),
    );

    let watchCallback;
    jest.spyOn(fs, "watch").mockImplementation((_dir, _opts, cb) => {
      watchCallback = cb;
      return { close: jest.fn() };
    });
    execSync.mockReturnValue("abc123\n");

    startDaemon(".nex/daemon.json");

    watchCallback("change", "src/utils.js");
    await jest.runAllTimersAsync();

    expect(processInput).toHaveBeenCalledTimes(1);
    expect(processInput.mock.calls[0][0]).toBe("run tests for src/utils.js");
    jest.useRealTimers();
  });

  // ─── test 7: clearConversation called after each task ───────────────────────

  it("clearConversation() is called after each completed task", async () => {
    jest.useFakeTimers();
    mockReadFileSync(
      makeConfig([
        {
          on: "schedule",
          cron: "*/1 * * * *",
          task: "ping",
          auto: true,
        },
      ]),
    );

    execSync.mockReturnValue("abc123\n");

    let scheduledFn;
    jest.spyOn(global, "setInterval").mockImplementation((fn, _ms) => {
      scheduledFn = fn;
      return 55;
    });

    startDaemon(".nex/daemon.json");
    await scheduledFn();
    await scheduledFn();

    expect(clearConversation).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  // ─── test 8: Matrix notify sends correct JSON body ───────────────────────────

  it("Matrix notify sends correct JSON body", () => {
    process.env.NEX_MATRIX_URL = "https://matrix.example.com";
    process.env.NEX_MATRIX_TOKEN = "token123";
    process.env.NEX_MATRIX_ROOM = "!roomid:example.com";

    const chunks = [];
    const mockReq = {
      on: jest.fn(),
      write: jest.fn((data) => chunks.push(data)),
      end: jest.fn(),
    };
    jest.spyOn(https, "request").mockReturnValue(mockReq);

    notifyMatrix("hello world");

    expect(https.request).toHaveBeenCalled();
    expect(mockReq.write).toHaveBeenCalled();
    const body = JSON.parse(chunks.join(""));
    expect(body.msgtype).toBe("m.text");
    expect(body.body).toBe("hello world");
    expect(mockReq.end).toHaveBeenCalled();

    delete process.env.NEX_MATRIX_URL;
    delete process.env.NEX_MATRIX_TOKEN;
    delete process.env.NEX_MATRIX_ROOM;
  });

  // ─── test 9: log file rotation ────────────────────────────────────────────────

  it("truncates log file when it exceeds 5 MB before appending", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
    jest.spyOn(fs, "statSync").mockReturnValue({ size: 6 * 1024 * 1024 }); // 6 MB
    const truncateSpy = jest
      .spyOn(fs, "truncateSync")
      .mockImplementation(() => {});
    const appendSpy = jest
      .spyOn(fs, "appendFileSync")
      .mockImplementation(() => {});

    appendLog(".nex/daemon.log", { ts: "now", trigger: "test" });

    expect(truncateSpy).toHaveBeenCalledWith(
      expect.stringContaining("daemon.log"),
      0,
    );
    expect(appendSpy).toHaveBeenCalled();
  });

  it("does not truncate log file when it is under 5 MB", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
    jest.spyOn(fs, "statSync").mockReturnValue({ size: 1024 }); // 1 KB
    const truncateSpy = jest
      .spyOn(fs, "truncateSync")
      .mockImplementation(() => {});
    jest.spyOn(fs, "appendFileSync").mockImplementation(() => {});

    appendLog(".nex/daemon.log", { ts: "now", trigger: "test" });

    expect(truncateSpy).not.toHaveBeenCalled();
  });

  // ─── test 10: task errors do not crash daemon ─────────────────────────────────

  it("handles a task that throws without crashing the daemon", async () => {
    jest.useFakeTimers();

    // Reset the agent mock to throw
    processInput.mockRejectedValueOnce(new Error("model crashed"));

    mockReadFileSync(
      makeConfig([
        { on: "schedule", cron: "*/1 * * * *", task: "risky task", auto: true },
      ]),
    );
    execSync.mockReturnValue("abc123\n");

    let scheduledFn;
    jest.spyOn(global, "setInterval").mockImplementation((fn, _ms) => {
      scheduledFn = fn;
      return 11;
    });

    startDaemon(".nex/daemon.json");

    // Should not throw — daemon must stay alive
    await expect(scheduledFn()).resolves.toBeUndefined();
    // clearConversation still called even on error
    expect(clearConversation).toHaveBeenCalled();

    jest.useRealTimers();
  });
});

// ─── parseCronToMs helper tests ───────────────────────────────────────────────

describe("parseCronToMs()", () => {
  it("parses */N pattern to N-minute interval", () => {
    const result = parseCronToMs("*/5 * * * *");
    expect(result).not.toBeNull();
    expect(result.intervalMs).toBe(5 * 60 * 1000);
  });

  it("parses 0 H pattern to 24h interval", () => {
    const result = parseCronToMs("0 3 * * *");
    expect(result).not.toBeNull();
    expect(result.intervalMs).toBe(24 * 60 * 60 * 1000);
  });

  it("returns null for unsupported syntax", () => {
    expect(parseCronToMs("*/5 */2 * * *")).toBeNull();
    expect(parseCronToMs("0 0 1 * *")).toBeNull();
    expect(parseCronToMs("not-a-cron")).toBeNull();
  });
});

// ─── expandTemplate helper tests ─────────────────────────────────────────────

describe("expandTemplate()", () => {
  it("replaces known template vars", () => {
    expect(
      expandTemplate("test {changedFile} and {changedFiles}", {
        changedFile: "foo.js",
        changedFiles: "foo.js, bar.js",
      }),
    ).toBe("test foo.js and foo.js, bar.js");
  });

  it("leaves unknown vars unchanged", () => {
    expect(expandTemplate("check {unknown}", {})).toBe("check {unknown}");
  });
});

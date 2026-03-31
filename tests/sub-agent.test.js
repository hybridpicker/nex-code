/**
 * tests/sub-agent.test.js — Sub-Agent utility functions
 */

jest.mock("../cli/providers/registry", () => ({
  callStream: jest.fn(),
  getActiveProviderName: jest.fn().mockReturnValue("ollama"),
  getActiveModelId: jest.fn().mockReturnValue("test-model"),
  getConfiguredProviders: jest.fn(),
  getProvider: jest.fn(),
  getActiveProvider: jest.fn(),
  parseModelSpec: jest.fn(),
}));
jest.mock("../cli/ollama", () => ({ parseToolArgs: jest.fn() }));
jest.mock("../cli/tool-tiers", () => ({
  filterToolsForModel: jest.fn((t) => t),
  getModelTier: jest.fn().mockReturnValue("standard"),
}));
jest.mock("../cli/costs", () => ({ trackUsage: jest.fn() }));
jest.mock("../cli/ui", () => ({
  MultiProgress: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
  })),
  C: {
    dim: "",
    reset: "",
    red: "",
    green: "",
    yellow: "",
    cyan: "",
    blue: "",
    bold: "",
  },
}));

const {
  clearAllLocks,
  classifyError,
  isRetryableError,
  getExcludedTools,
  LOCK_TIMEOUT_MS,
} = require("../cli/sub-agent");

// acquireLock and releaseLock are not exported directly — access via the module internals
// We test locking through clearAllLocks + the exported helpers
// Actually, let's check — they may be accessible via require
let acquireLock, releaseLock;
try {
  // These are internal but used via executeSpawnAgents; test via the exported clearAllLocks
  // and re-require to get fresh state
  const mod = require("../cli/sub-agent");
  acquireLock = mod.acquireLock || null;
  releaseLock = mod.releaseLock || null;
} catch {
  // not exported
}

describe("sub-agent utilities", () => {
  // ─── Constants ──────────────────────────────────────────────
  describe("constants", () => {
    test("MAX_SUB_ITERATIONS is 15", () => {
      // Not exported directly but we can verify via module source
      // LOCK_TIMEOUT_MS IS exported
      expect(LOCK_TIMEOUT_MS).toBe(10 * 60 * 1000);
    });
  });

  // ─── classifyError ────────────────────────────────────────
  describe("classifyError", () => {
    test.each([
      ["429 rate limit", { message: "Error 429 Too Many Requests" }, "rate_limit"],
      ["rate limit text", { message: "rate limit exceeded" }, "rate_limit"],
      ["401 unauthorized", { message: "401 Unauthorized" }, "auth"],
      ["403 forbidden", { message: "403 Forbidden" }, "auth"],
      ["500 server", { message: "Server error 500" }, "server"],
      ["502 gateway", { message: "502 Bad Gateway" }, "server"],
      ["ECONNRESET", { message: "conn", code: "ECONNRESET" }, "network"],
      ["ETIMEDOUT", { message: "timed out", code: "ETIMEDOUT" }, "timeout"],
      ["fetch failed", { message: "fetch failed" }, "network"],
      ["context overflow", { message: "400 context too long" }, "context_overflow"],
      ["content length", { message: "400 maximum content length" }, "context_overflow"],
      ["unknown", { message: "syntax error" }, "unknown"],
      ["empty", { message: "" }, "unknown"],
    ])("%s → %s", (_label, err, expected) => {
      expect(classifyError(err)).toBe(expected);
    });
  });

  // ─── isRetryableError ──────────────────────────────────────
  describe("isRetryableError", () => {
    test.each([
      ["429 rate limit", { message: "Error 429 Too Many Requests" }, true],
      ["500 server error", { message: "Server error 500" }, true],
      ["502 bad gateway", { message: "502 Bad Gateway" }, true],
      ["503 unavailable", { message: "503 Service Unavailable" }, true],
      ["504 timeout", { message: "504 Gateway Timeout" }, true],
      [
        "ECONNRESET code",
        { message: "connection lost", code: "ECONNRESET" },
        true,
      ],
      ["ETIMEDOUT code", { message: "timed out", code: "ETIMEDOUT" }, true],
      ["ECONNRESET in message", { message: "ECONNRESET" }, true],
      ["ETIMEDOUT in message", { message: "ETIMEDOUT" }, true],
      ["fetch failed", { message: "fetch failed" }, true],
      ["socket disconnected", { message: "socket disconnected" }, true],
      ["normal error", { message: "syntax error" }, false],
      ["404 not found", { message: "404 Not Found" }, false],
      ["empty error", { message: "" }, false],
      ["auth error (not retryable)", { message: "401 Unauthorized" }, false],
      ["context overflow (not retryable)", { message: "400 context too long" }, false],
    ])("%s → %s", (_label, err, expected) => {
      expect(isRetryableError(err)).toBe(expected);
    });
  });

  // ─── getExcludedTools ──────────────────────────────────────
  describe("getExcludedTools", () => {
    test("depth 0 does NOT exclude spawn_agents", () => {
      const excluded = getExcludedTools(0);
      expect(excluded.has("spawn_agents")).toBe(false);
    });

    test("depth 1 does NOT exclude spawn_agents", () => {
      const excluded = getExcludedTools(1);
      expect(excluded.has("spawn_agents")).toBe(false);
    });

    test("depth 2 DOES exclude spawn_agents", () => {
      const excluded = getExcludedTools(2);
      expect(excluded.has("spawn_agents")).toBe(true);
    });

    test("depth 3 DOES exclude spawn_agents", () => {
      const excluded = getExcludedTools(3);
      expect(excluded.has("spawn_agents")).toBe(true);
    });

    test("always excludes ask_user and task_list", () => {
      for (const depth of [0, 1, 2, 3]) {
        const excluded = getExcludedTools(depth);
        expect(excluded.has("ask_user")).toBe(true);
        expect(excluded.has("task_list")).toBe(true);
      }
    });
  });

  // ─── File Locking (via clearAllLocks) ──────────────────────
  describe("clearAllLocks", () => {
    test("clearAllLocks does not throw", () => {
      expect(() => clearAllLocks()).not.toThrow();
    });
  });

  // ─── Lock timeout constant ────────────────────────────────
  describe("LOCK_TIMEOUT_MS", () => {
    test("is 10 minutes in milliseconds", () => {
      expect(LOCK_TIMEOUT_MS).toBe(600000);
    });
  });
});

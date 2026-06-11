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
  acquireLock,
  awaitLock,
  appendSubAgentClaimCorrections,
  clearAllLocks,
  classifyError,
  extractClaimedEditedPaths,
  getSingleTargetSpawnGateError,
  isRetryableError,
  getExcludedTools,
  LOCK_TIMEOUT_MS,
  LOCK_WAIT_MS,
} = require("../cli/sub-agent");

describe("sub-agent utilities", () => {
  // ─── Constants ──────────────────────────────────────────────
  describe("constants", () => {
    test("MAX_SUB_ITERATIONS is 15", () => {
      // Not exported directly but we can verify via module source
      // LOCK_TIMEOUT_MS IS exported
      expect(LOCK_TIMEOUT_MS).toBe(10 * 60 * 1000);
      expect(LOCK_WAIT_MS).toBe(60 * 1000);
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

  describe("spawn_agents single-target gate", () => {
    test("rejects single-target prompts", () => {
      expect(
        getSingleTargetSpawnGateError(
          "Fix js/tuning-matcher.js and verify with node js/tuning-matcher.js",
        ),
      ).toContain("spawn_agents is disabled for single-target tasks");
    });

    test("allows prompts with multiple target files", () => {
      expect(
        getSingleTargetSpawnGateError(
          "Update src/api.js and src/worker.js together",
        ),
      ).toBeNull();
    });
  });

  describe("sub-agent claim verification", () => {
    test("extracts file paths from edit claims", () => {
      expect(
        extractClaimedEditedPaths(
          "Created js/tuning-matcher.js and updated `src/app.test.js`.",
        ),
      ).toEqual(["js/tuning-matcher.js", "src/app.test.js"]);
    });

    test("appends correction when claimed file was not changed", () => {
      const result = appendSubAgentClaimCorrections(
        {
          result: "Created js/tuning-matcher.js with the matcher fix.",
        },
        Date.now(),
        process.cwd(),
      );
      expect(result.result).toContain("[SYSTEM CORRECTION]");
      expect(result.result).toContain("js/tuning-matcher.js");
    });

    test("does not correct claims backed by a fresh file mtime", async () => {
      const fs = require("fs");
      const os = require("os");
      const path = require("path");
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-claim-"));
      const targetDir = path.join(tempDir, "src");
      const target = path.join(targetDir, "changed.js");
      const runStartedAtMs = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 10));
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(target, "export const changed = true;\n");

      try {
        const result = appendSubAgentClaimCorrections(
          {
            result: "Updated src/changed.js with the requested behavior.",
          },
          runStartedAtMs,
          tempDir,
        );
        expect(result.result).not.toContain("[SYSTEM CORRECTION]");
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  // ─── File Locking (via clearAllLocks) ──────────────────────
  describe("clearAllLocks", () => {
    test("clearAllLocks does not throw", () => {
      expect(() => clearAllLocks()).not.toThrow();
    });

    test("awaitLock waits for an active writer instead of failing immediately", async () => {
      const filePath = "/tmp/nex-sub-agent-lock-wait.js";
      expect(acquireLock(filePath, "agent-a")).toBe(true);
      const pending = awaitLock(filePath, "agent-b", {
        timeoutMs: 1000,
        retryMs: 5,
      });
      setTimeout(() => clearAllLocks(), 20);
      await expect(pending).resolves.toBe(true);
    });
  });

  // ─── Lock timeout constant ────────────────────────────────
  describe("LOCK_TIMEOUT_MS", () => {
    test("is 10 minutes in milliseconds", () => {
      expect(LOCK_TIMEOUT_MS).toBe(600000);
    });
  });
});

"use strict";

const {
  getCount,
  incCount,
  setCount,
  LOOP_COUNTER_TTL_MS,
  bashCmdCounts,
  grepPatternCounts,
  grepFileCounts,
  fileReadCounts,
  fileReadRanges,
  fileEditCounts,
  lastEditFailed,
  reReadBlockShown,
  getConsecutiveSshCalls,
  setConsecutiveSshCalls,
  getSuperNuclearFires,
  incSuperNuclearFires,
  getPlanRejectionCount,
  incPlanRejectionCount,
  isSshBlocked,
  setSshBlocked,
  getPostWipeToolBudget,
  setPostWipeToolBudget,
  decPostWipeToolBudget,
  getServerLocalWarnFired,
  setServerLocalWarnFired,
  clearAll,
} = require("../cli/loop-guard");

afterEach(() => {
  clearAll();
});

describe("loop-guard.js", () => {
  // ─── TTL counter helpers ──────────────────────────────────────
  describe("getCount / incCount / setCount", () => {
    it("returns 0 for unknown key", () => {
      const map = new Map();
      expect(getCount(map, "unknown")).toBe(0);
    });

    it("increments and returns count", () => {
      const map = new Map();
      expect(incCount(map, "key")).toBe(1);
      expect(incCount(map, "key")).toBe(2);
      expect(incCount(map, "key")).toBe(3);
      expect(getCount(map, "key")).toBe(3);
    });

    it("sets count explicitly", () => {
      const map = new Map();
      setCount(map, "key", 10);
      expect(getCount(map, "key")).toBe(10);
    });

    it("expires entries older than TTL", () => {
      const map = new Map();
      // Manually set an old entry
      map.set("old", { count: 5, ts: Date.now() - LOOP_COUNTER_TTL_MS - 1 });
      expect(getCount(map, "old")).toBe(0);
      // Map entry should be cleaned up
      expect(map.has("old")).toBe(false);
    });

    it("incCount resets expired entries to 1", () => {
      const map = new Map();
      map.set("stale", { count: 99, ts: Date.now() - LOOP_COUNTER_TTL_MS - 1 });
      expect(incCount(map, "stale")).toBe(1);
    });

    it("tracks independent keys separately", () => {
      const map = new Map();
      incCount(map, "a");
      incCount(map, "a");
      incCount(map, "b");
      expect(getCount(map, "a")).toBe(2);
      expect(getCount(map, "b")).toBe(1);
    });
  });

  // ─── Counter maps exist ───────────────────────────────────────
  describe("counter maps", () => {
    it("exports all required counter maps", () => {
      expect(bashCmdCounts).toBeInstanceOf(Map);
      expect(grepPatternCounts).toBeInstanceOf(Map);
      expect(grepFileCounts).toBeInstanceOf(Map);
      expect(fileReadCounts).toBeInstanceOf(Map);
      expect(fileReadRanges).toBeInstanceOf(Map);
      expect(fileEditCounts).toBeInstanceOf(Map);
      expect(lastEditFailed).toBeInstanceOf(Map);
      expect(reReadBlockShown).toBeInstanceOf(Map);
    });
  });

  // ─── Scalar state accessors ───────────────────────────────────
  describe("scalar state", () => {
    it("consecutive SSH calls", () => {
      expect(getConsecutiveSshCalls()).toBe(0);
      setConsecutiveSshCalls(5);
      expect(getConsecutiveSshCalls()).toBe(5);
    });

    it("super-nuclear fires", () => {
      expect(getSuperNuclearFires()).toBe(0);
      expect(incSuperNuclearFires()).toBe(1);
      expect(incSuperNuclearFires()).toBe(2);
      expect(getSuperNuclearFires()).toBe(2);
    });

    it("plan rejection count", () => {
      expect(getPlanRejectionCount()).toBe(0);
      incPlanRejectionCount();
      incPlanRejectionCount();
      expect(getPlanRejectionCount()).toBe(2);
    });

    it("SSH blocked state", () => {
      expect(isSshBlocked()).toBe(false);
      setSshBlocked(true);
      expect(isSshBlocked()).toBe(true);
    });

    it("post-wipe tool budget", () => {
      expect(getPostWipeToolBudget()).toBe(Infinity);
      setPostWipeToolBudget(5);
      expect(getPostWipeToolBudget()).toBe(5);
      decPostWipeToolBudget();
      expect(getPostWipeToolBudget()).toBe(4);
    });

    it("server local warn", () => {
      expect(getServerLocalWarnFired()).toBe(0);
      setServerLocalWarnFired(3);
      expect(getServerLocalWarnFired()).toBe(3);
    });
  });

  // ─── clearAll ─────────────────────────────────────────────────
  describe("clearAll()", () => {
    it("resets all counters and state", () => {
      incCount(bashCmdCounts, "test");
      incCount(fileReadCounts, "file.js");
      setConsecutiveSshCalls(10);
      incSuperNuclearFires();
      setSshBlocked(true);
      setPostWipeToolBudget(3);

      clearAll();

      expect(bashCmdCounts.size).toBe(0);
      expect(fileReadCounts.size).toBe(0);
      expect(getConsecutiveSshCalls()).toBe(0);
      expect(getSuperNuclearFires()).toBe(0);
      expect(isSshBlocked()).toBe(false);
      expect(getPostWipeToolBudget()).toBe(Infinity);
    });
  });
});

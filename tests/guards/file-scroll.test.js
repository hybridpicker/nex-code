"use strict";

const { check, detectOverlap } = require("../../cli/guards/file-scroll");

describe("guards/file-scroll.js", () => {
  describe("check", () => {
    function makeState(overrides = {}) {
      return {
        fileReadCounts: new Map(),
        fileReadRanges: new Map(),
        grepFileCounts: new Map(),
        lastGrepResultByPath: new Map(),
        scrollBlockSections: 3,
        scrollWarnSections: 2,
        loopAbortGrepFile: 5,
        deadlockOnFile: null,
        superNuclearFires: 0,
        conversationMessages: [],
        apiMessages: [],
        _deadlockOnFile: undefined,
        ...overrides,
      };
    }

    function makePrep(overrides = {}) {
      return {
        fnName: "read_file",
        args: { path: "src/app.js", line_start: 1, line_end: 30 },
        callId: "call-1",
        ...overrides,
      };
    }

    it("returns blocked=false for non-read_file calls", () => {
      const prep = makePrep({ fnName: "grep" });
      const state = makeState();
      const result = check(prep, state);
      expect(result.blocked).toBe(false);
    });

    it("returns blocked=false when no path in args", () => {
      const prep = makePrep({ args: {} });
      const state = makeState();
      const result = check(prep, state);
      expect(result.blocked).toBe(false);
    });

    it("blocks when section count exceeds scrollBlockSections", () => {
      const state = makeState();
      // Simulate 3 prior reads on the same file
      state.fileReadRanges.set("src/app.js", [
        [1, 30],
        [40, 70],
        [80, 110],
      ]);

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(true);
      expect(result.errorResult.content).toContain("BLOCKED: read_file");
      expect(result.errorResult.content).toContain("file-scroll");
      expect(result.errorResult.content).toContain("Use grep");
    });

    it("does not block when below scrollBlockSections", () => {
      const state = makeState();
      state.fileReadRanges.set("src/app.js", [[1, 30]]);

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(false);
    });

    it("injects deadlock message when grep is also exhausted", () => {
      const state = makeState();
      state.fileReadRanges.set("src/app.js", [
        [1, 30],
        [40, 70],
        [80, 110],
      ]);
      state.grepFileCounts.set("src/app.js", 5); // grep exhausted
      state.loopAbortGrepFile = 5;

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(true);
      expect(result.errorResult.content).toContain("grep is also exhausted");
      expect(result.errorResult.content).toContain("edit_file or patch_file");

      // Deadlock message should be injected into conversation
      const deadlockInjected = state.conversationMessages.some((m) =>
        m.content.includes("Both read_file and grep are now blocked"),
      );
      expect(deadlockInjected).toBe(true);
    });

    it("deadlock escape valve allows one more read after compression", () => {
      const state = makeState();
      state.fileReadRanges.set("src/app.js", [
        [1, 30],
        [40, 70],
        [80, 110],
      ]);
      state.grepFileCounts.set("src/app.js", 5);
      state.loopAbortGrepFile = 5;
      state.deadlockOnFile = "src/app.js";
      state.superNuclearFires = 1;

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      // Should NOT block — deadlock escape valve activated
      expect(result.blocked).toBe(false);
      // Deadlock token should be consumed
      expect(state.deadlockOnFile).toBeNull();
      // Escape message injected
      const escapeInjected = state.conversationMessages.some((m) =>
        m.content.includes("One-time read pass"),
      );
      expect(escapeInjected).toBe(true);
    });

    it("warns at scrollWarnSections without blocking", () => {
      const state = makeState({ scrollBlockSections: 4, scrollWarnSections: 2 });
      state.fileReadRanges.set("src/app.js", [
        [1, 30],
        [40, 70],
      ]);

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(false);
      expect(result._scrollWarn).toBeDefined();
      expect(result._scrollWarn.sectionCount).toBe(3);
    });
  });

  describe("detectOverlap", () => {
    it("detects overlapping ranges", () => {
      const prevRanges = [[1, 50]];
      const result = detectOverlap(prevRanges, 40, 60);
      expect(result.overlap).toBe(true);
      expect(result.overlapRatio).toBeCloseTo(11 / 21, 1);
    });

    it("detects full containment (new inside old)", () => {
      const prevRanges = [[1, 100]];
      const result = detectOverlap(prevRanges, 40, 60);
      expect(result.overlap).toBe(true);
      expect(result.overlapRatio).toBe(1);
    });

    it("detects full containment (old inside new)", () => {
      const prevRanges = [[40, 60]];
      const result = detectOverlap(prevRanges, 1, 100);
      expect(result.overlap).toBe(true);
      expect(result.overlapRatio).toBeCloseTo(21 / 100, 2);
    });

    it("returns no overlap for non-overlapping ranges", () => {
      const prevRanges = [[1, 30]];
      const result = detectOverlap(prevRanges, 40, 70);
      expect(result.overlap).toBe(false);
    });
  });
});
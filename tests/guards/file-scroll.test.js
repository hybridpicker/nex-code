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
      state.grepFileCounts.set("src/app.js", 5);
      state.loopAbortGrepFile = 5;

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(true);
      expect(result.errorResult.content).toContain("grep is also exhausted");
      expect(result.errorResult.content).toContain("edit_file or patch_file");

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

      expect(result.blocked).toBe(false);
      expect(state.deadlockOnFile).toBeNull();
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

    // ─── Regression: deadlock escape + post-compression re-read ──────────────
    // When super-nuclear compression drops context, the model legitimately needs
    // to re-read content that was already in context. The deadlock escape valve
    // must allow this one-time pass — otherwise the overlap detection in agent.js
    // blocks every re-read and the session stalls permanently.

    it("deadlock escape is consumed after one use (one-time pass)", () => {
      const state = makeState();
      state.fileReadRanges.set("src/app.js", [
        [100, 130],
        [140, 170],
        [180, 210],
      ]);
      state.grepFileCounts.set("src/app.js", 5);
      state.deadlockOnFile = "src/app.js";
      state.superNuclearFires = 1;

      const prep1 = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result1 = check(prep1, state);
      expect(result1.blocked).toBe(false);
      expect(state.deadlockOnFile).toBeNull();

      const prep2 = makePrep({
        args: { path: "src/app.js", line_start: 160, line_end: 190 },
      });
      const result2 = check(prep2, state);
      expect(result2.blocked).toBe(true);
    });

    it("deadlock escape does not fire without super-nuclear compression", () => {
      const state = makeState();
      state.fileReadRanges.set("src/app.js", [
        [1, 30],
        [40, 70],
        [80, 110],
      ]);
      state.grepFileCounts.set("src/app.js", 5);
      state.deadlockOnFile = "src/app.js";
      state.superNuclearFires = 0;

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(true);
      expect(state.deadlockOnFile).toBe("src/app.js");
    });

    it("deadlock escape does not fire for a different file", () => {
      const state = makeState();
      state.fileReadRanges.set("src/utils.js", [
        [1, 30],
        [40, 70],
        [80, 110],
      ]);
      state.grepFileCounts.set("src/utils.js", 5);
      state.deadlockOnFile = "src/app.js";
      state.superNuclearFires = 1;

      const prep = makePrep({
        args: { path: "src/utils.js", line_start: 120, line_end: 150 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(true);
      expect(state.deadlockOnFile).toBe("src/app.js");
    });

    it("deadlock escape works with deeply nested file paths", () => {
      const deepPath = "web/templates/fitness/index.html";
      const state = makeState();
      state.fileReadRanges.set(deepPath, [
        [1, 150],
        [500, 650],
        [1000, 1150],
      ]);
      state.grepFileCounts.set(deepPath, 5);
      state.deadlockOnFile = deepPath;
      state.superNuclearFires = 1;

      const prep = makePrep({
        args: { path: deepPath, line_start: 1860, line_end: 1870 },
      });
      const result = check(prep, state);

      expect(result.blocked).toBe(false);
      expect(state.deadlockOnFile).toBeNull();
      const escapeInjected = state.conversationMessages.some((m) =>
        m.content.includes("One-time read pass"),
      );
      expect(escapeInjected).toBe(true);
    });

    it("deadlock escape injects guidance into both conversation and API messages", () => {
      const state = makeState();
      state.fileReadRanges.set("src/app.js", [
        [1, 30],
        [40, 70],
        [80, 110],
      ]);
      state.grepFileCounts.set("src/app.js", 5);
      state.deadlockOnFile = "src/app.js";
      state.superNuclearFires = 1;

      const prep = makePrep({
        args: { path: "src/app.js", line_start: 120, line_end: 150 },
      });
      check(prep, state);

      const inConv = state.conversationMessages.some((m) =>
        m.content.includes("One-time read pass"),
      );
      const inApi = state.apiMessages.some((m) =>
        m.content.includes("One-time read pass"),
      );
      expect(inConv).toBe(true);
      expect(inApi).toBe(true);
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

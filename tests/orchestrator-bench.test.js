"use strict";

jest.mock("../cli/sub-agent", () => ({
  callWithRetry: jest.fn(),
}));

jest.mock("../cli/providers/registry", () => ({
  parseModelSpec: jest.fn((spec) => ({ provider: "ollama", model: spec })),
}));

jest.mock("../cli/orchestrator", () => ({
  extractJSON: jest.fn((str) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }),
  DECOMPOSE_PROMPT: "Decompose: {maxSubTasks} sub-tasks for: {prompt}",
  SYNTHESIZE_PROMPT: "Synthesize: {prompt}\nResults: {results}",
}));

jest.mock("../cli/ui", () => ({
  C: {
    bold: "",
    cyan: "",
    dim: "",
    reset: "",
    green: "",
    yellow: "",
    red: "",
  },
}));

const {
  scoreDecompose,
  scoreSynthesize,
  ORCHESTRATOR_SCENARIOS,
  runScenario,
} = require("../cli/orchestrator-bench");
const { callWithRetry } = require("../cli/sub-agent");

describe("orchestrator-bench.js", () => {
  // ─── ORCHESTRATOR_SCENARIOS structure ──────────────────────────────
  describe("ORCHESTRATOR_SCENARIOS", () => {
    it("has both decompose and synthesize scenarios", () => {
      const types = new Set(ORCHESTRATOR_SCENARIOS.map((s) => s.type));
      expect(types.has("decompose")).toBe(true);
      expect(types.has("synthesize")).toBe(true);
    });

    it("each scenario has id, type, and prompt", () => {
      for (const s of ORCHESTRATOR_SCENARIOS) {
        expect(typeof s.id).toBe("string");
        expect(typeof s.type).toBe("string");
        expect(typeof s.prompt).toBe("string");
      }
    });

    it("decompose scenarios have expectedSubTasks", () => {
      const decompose = ORCHESTRATOR_SCENARIOS.filter(
        (s) => s.type === "decompose",
      );
      for (const s of decompose) {
        expect(typeof s.expectedSubTasks).toBe("number");
        expect(typeof s.maxSubTasks).toBe("number");
      }
    });

    it("synthesize scenarios have subResults and expectedConflicts", () => {
      const synth = ORCHESTRATOR_SCENARIOS.filter(
        (s) => s.type === "synthesize",
      );
      for (const s of synth) {
        expect(Array.isArray(s.subResults)).toBe(true);
        expect(typeof s.expectedConflicts).toBe("number");
      }
    });
  });

  // ─── scoreDecompose ───────────────────────────────────────────────
  describe("scoreDecompose()", () => {
    const scenario = { expectedSubTasks: 3, maxSubTasks: 4 };

    it("returns 0 for non-array input", () => {
      expect(scoreDecompose(null, scenario)).toBe(0);
      expect(scoreDecompose("string", scenario)).toBe(0);
      expect(scoreDecompose({}, scenario)).toBe(0);
    });

    it("gives full score for valid empty array (vacuous truth on checks)", () => {
      // Empty array: 1.5 (valid) + 0 (wrong count) + 2 (vacuous every) + 2 (no scopes) + 1.5 (vacuous estimates) = 7
      expect(scoreDecompose([], scenario)).toBe(7);
    });

    it("gives max score for perfect decomposition", () => {
      const result = [
        { task: "Fix auth", scope: ["auth.js"], estimatedCalls: 5 },
        { task: "Fix search", scope: ["search.js"], estimatedCalls: 3 },
        { task: "Fix config", scope: ["config.js"], estimatedCalls: 2 },
      ];
      expect(scoreDecompose(result, scenario)).toBe(10);
    });

    it("penalizes wrong count (off by 1 = half credit)", () => {
      const result = [
        { task: "Fix auth", scope: ["auth.js"], estimatedCalls: 5 },
        { task: "Fix search", scope: ["search.js"], estimatedCalls: 3 },
      ];
      const score = scoreDecompose(result, scenario);
      // 1.5 (valid) + 1.5 (off by 1) + 2 (required fields) + 2 (unique scopes) + 1.5 (estimates) = 8.5
      expect(score).toBe(8.5);
    });

    it("penalizes missing required fields", () => {
      const result = [
        { task: "Fix auth", scope: ["auth.js"], estimatedCalls: 5 },
        { scope: ["search.js"], estimatedCalls: 3 },
        { task: "Fix config", scope: ["config.js"], estimatedCalls: 2 },
      ];
      const score = scoreDecompose(result, scenario);
      // Missing task field in second entry → no required fields points
      expect(score).toBeLessThan(10);
    });

    it("penalizes overlapping scopes", () => {
      const result = [
        { task: "Fix auth", scope: ["auth.js"], estimatedCalls: 5 },
        { task: "Fix auth2", scope: ["auth.js"], estimatedCalls: 3 },
        { task: "Fix config", scope: ["config.js"], estimatedCalls: 2 },
      ];
      const score = scoreDecompose(result, scenario);
      // auth.js appears twice → scope overlap
      expect(score).toBeLessThan(10);
    });

    it("penalizes missing estimates", () => {
      const result = [
        { task: "Fix auth", scope: ["auth.js"] },
        { task: "Fix search", scope: ["search.js"] },
        { task: "Fix config", scope: ["config.js"] },
      ];
      const score = scoreDecompose(result, scenario);
      // No estimatedCalls → -1.5
      expect(score).toBe(8.5);
    });

    it("accepts estimatedSshCalls as alternative", () => {
      const result = [
        { task: "Fix auth", scope: ["auth.js"], estimatedSshCalls: 5 },
        { task: "Fix search", scope: ["search.js"], estimatedSshCalls: 3 },
        { task: "Fix config", scope: ["config.js"], estimatedSshCalls: 2 },
      ];
      expect(scoreDecompose(result, scenario)).toBe(10);
    });
  });

  // ─── scoreSynthesize ──────────────────────────────────────────────
  describe("scoreSynthesize()", () => {
    it("returns 0 for null input", () => {
      expect(scoreSynthesize(null, {})).toBe(0);
    });

    it("returns 0 for non-object input", () => {
      expect(scoreSynthesize("string", {})).toBe(0);
    });

    it("gives max score for perfect synthesis (no expected conflicts)", () => {
      const result = {
        summary: "Fixed both login and search bugs successfully",
        commitMessage: "fix: resolve login redirect and search index issues",
        conflicts: [],
        filesChanged: ["auth.js", "search.js"],
      };
      const scenario = { expectedConflicts: 0 };
      expect(scoreSynthesize(result, scenario)).toBe(10);
    });

    it("gives max score for correct conflict detection", () => {
      const result = {
        summary: "Fixed config and added validation",
        commitMessage: "fix: config loading and env validation",
        conflicts: ["config.js modified by both agents"],
        filesChanged: ["config.js"],
      };
      const scenario = { expectedConflicts: 1 };
      expect(scoreSynthesize(result, scenario)).toBe(10);
    });

    it("penalizes missing conflict detection", () => {
      const result = {
        summary: "Fixed config and added validation to the system",
        commitMessage: "fix stuff",
        conflicts: [],
        filesChanged: ["config.js"],
      };
      const scenario = { expectedConflicts: 1 };
      // 1.5 (valid) + 2 (summary>10) + 2 (commit>5) + 0 (missed conflicts) + 2 (filesChanged) = 7.5
      expect(scoreSynthesize(result, scenario)).toBe(7.5);
    });

    it("penalizes short summary", () => {
      const result = {
        summary: "Done",
        commitMessage: "fix stuff",
        conflicts: [],
        filesChanged: ["a.js"],
      };
      // 1.5 (valid) + 0 (summary<=10) + 2 (commit>5) + 2.5 (no conflicts correct) + 2 (files) = 8
      expect(scoreSynthesize(result, { expectedConflicts: 0 })).toBe(8);
    });

    it("penalizes missing filesChanged", () => {
      const result = {
        summary: "Fixed the issues in the codebase",
        commitMessage: "fix: resolve issues",
        conflicts: [],
      };
      expect(scoreSynthesize(result, { expectedConflicts: 0 })).toBe(8);
    });
  });

  // ─── runScenario ──────────────────────────────────────────────────
  describe("runScenario()", () => {
    beforeEach(() => {
      callWithRetry.mockReset();
    });

    it("runs decompose scenario and scores result", async () => {
      const tasks = [
        { task: "Fix bug 1", scope: ["a.js"], estimatedCalls: 3 },
        { task: "Fix bug 2", scope: ["b.js"], estimatedCalls: 2 },
        { task: "Fix bug 3", scope: ["c.js"], estimatedCalls: 4 },
        { task: "Fix bug 4", scope: ["d.js"], estimatedCalls: 1 },
      ];
      callWithRetry.mockResolvedValue({
        content: JSON.stringify(tasks),
      });

      const scenario = ORCHESTRATOR_SCENARIOS.find(
        (s) => s.id === "decompose_multi_bug",
      );
      const result = await runScenario(scenario, "test-model");
      expect(result.score).toBeGreaterThan(0);
      expect(typeof result.latencyMs).toBe("number");
    });

    it("runs synthesize scenario and scores result", async () => {
      const synthesis = {
        summary: "Fixed login redirect and search index",
        commitMessage: "fix: login and search bugs",
        conflicts: [],
        filesChanged: ["auth.js", "search.js"],
      };
      callWithRetry.mockResolvedValue({
        content: JSON.stringify(synthesis),
      });

      const scenario = ORCHESTRATOR_SCENARIOS.find(
        (s) => s.id === "synthesize_clean",
      );
      const result = await runScenario(scenario, "test-model");
      expect(result.score).toBeGreaterThan(0);
    });

    it("returns score 0 on error", async () => {
      callWithRetry.mockRejectedValue(new Error("rate limited"));

      const scenario = ORCHESTRATOR_SCENARIOS[0];
      const result = await runScenario(scenario, "test-model");
      expect(result.score).toBe(0);
      expect(result.error).toContain("rate limited");
    });

    it("returns score 0 for unknown scenario type", async () => {
      const result = await runScenario(
        { type: "unknown", prompt: "test" },
        "model",
      );
      expect(result.score).toBe(0);
      expect(result.error).toContain("Unknown scenario type");
    });
  });
});

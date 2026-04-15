"use strict";

const fs = require("fs");
const {
  BENCHMARK_SCRIPT,
  buildFixPrompt,
  checkSafetyBounds,
  classifyScoreDelta,
  clusterFailures,
  getBenchmarkScore,
  summarizeBenchmarkResults,
} = require("../scripts/improve");

describe("scripts/improve.js", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("targets the current real-life benchmark harness", () => {
    expect(BENCHMARK_SCRIPT).toBe("scripts/benchmark-reallife.js");
  });

  it("clusters incomplete tasks by category", () => {
    const cluster = clusterFailures({
      results: [
        {
          id: "bugfix-case",
          category: "bugfix",
          score: 40,
          details: {
            taskCompletion: 20,
            efficiency: 90,
          },
        },
        {
          id: "feature-case",
          category: "feature",
          score: 65,
          details: {
            taskCompletion: 30,
            efficiency: 90,
          },
        },
        {
          id: "bugfix-case-2",
          category: "bugfix",
          score: 55,
          details: {
            taskCompletion: 10,
            efficiency: 80,
          },
        },
      ],
    });

    expect(cluster).toEqual({
      pattern: "task-incomplete",
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: "bugfix-case" }),
        expect.objectContaining({ id: "bugfix-case-2" }),
      ]),
    });
  });

  it("builds fix prompts around the real-life benchmark score", () => {
    const prompt = buildFixPrompt(
      {
        pattern: "bugfix-incomplete",
        tasks: [
          {
            id: "bugfix-case",
            category: "bugfix",
            score: 40,
            details: {
              taskCompletion: 20,
              efficiency: 90,
            },
          },
        ],
      },
      72,
    );

    expect(prompt).toContain("Current real-life benchmark score: 72/100.");
    expect(prompt).toContain('The real-life benchmark shows a failure pattern: "bugfix-incomplete"');
  });

  it("reads scores from both real-life and legacy benchmark result shapes", () => {
    expect(getBenchmarkScore({ finalScore: 81 })).toBe(81);
    expect(getBenchmarkScore({ average: 74 })).toBe(74);
    expect(getBenchmarkScore({})).toBeNull();
  });

  it("includes the score in fix prompts generated for dry runs", () => {
    const prompt = buildFixPrompt(
      {
        pattern: "task-incomplete",
        tasks: [
          {
            id: "bugfix-case",
            category: "bugfix",
            score: 40,
            details: {
              taskCompletion: 20,
              efficiency: 90,
            },
          },
        ],
      },
      88,
    );

    expect(prompt).toContain("Current real-life benchmark score: 88/100.");
  });

  it("summarizes benchmark results with a missing-score guard", () => {
    expect(summarizeBenchmarkResults({ finalScore: 82 })).toEqual({ ok: true, score: 82 });
    expect(summarizeBenchmarkResults({})).toEqual({ ok: false, reason: "missing-score" });
  });

  it("classifies improved, unchanged, and regressed scores", () => {
    expect(classifyScoreDelta(70, 75)).toBe("improved");
    expect(classifyScoreDelta(70, 70)).toBe("no-change");
    expect(classifyScoreDelta(70, 60)).toBe("regressed");
    expect(classifyScoreDelta(70, null)).toBe("missing-score");
  });

  it("flags safety bound violations", () => {
    jest.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (String(filePath).includes("agent.js")) {
        return "const SSH_STORM_WARN = 20;";
      }
      return "";
    });

    expect(checkSafetyBounds()).toEqual({
      ok: false,
      violation: "SSH_STORM_WARN = 20 (bounds: [6, 12])",
    });
  });
});

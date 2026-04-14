"use strict";

const fs = require("fs");
const {
  buildFixPrompt,
  checkSafetyBounds,
  classifyScoreDelta,
  clusterFailures,
  summarizeBenchmarkResults,
} = require("../scripts/improve-reallife");

describe("scripts/improve-reallife.js", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("clusters failures by category-specific incomplete work", () => {
    const cluster = clusterFailures({
      results: [
        {
          id: "bugfix-a",
          category: "bugfix",
          score: 50,
          completionReason: "success",
          details: { taskCompletion: 20, efficiency: 90, quality: 80 },
        },
        {
          id: "bugfix-b",
          category: "bugfix",
          score: 55,
          completionReason: "success",
          details: { taskCompletion: 30, efficiency: 85, quality: 85 },
        },
        {
          id: "docs-a",
          category: "docs",
          score: 45,
          completionReason: "timeout",
          details: { taskCompletion: 60, efficiency: 20, quality: 40 },
        },
      ],
    });

    expect(cluster).toEqual({
      pattern: "bugfix-incomplete",
      tasks: expect.arrayContaining([
        expect.objectContaining({ id: "bugfix-a" }),
        expect.objectContaining({ id: "bugfix-b" }),
      ]),
    });
  });

  it("builds fix prompts with the benchmark score", () => {
    const prompt = buildFixPrompt({
      pattern: "bugfix-incomplete",
      tasks: [
        {
          id: "bugfix-a",
          category: "bugfix",
          score: 50,
          details: { taskCompletion: 20, efficiency: 90 },
        },
      ],
    }, 84);

    expect(prompt).toContain("Current real-life benchmark score: 84/100.");
    expect(prompt).toContain('The benchmark shows a failure cluster: "bugfix-incomplete"');
  });

  it("summarizes benchmark results and guards against missing scores", () => {
    expect(summarizeBenchmarkResults({ finalScore: 88 })).toEqual({ ok: true, score: 88 });
    expect(summarizeBenchmarkResults({})).toEqual({ ok: false, reason: "missing-score" });
  });

  it("classifies rebenchmark outcomes for the loop", () => {
    expect(classifyScoreDelta(75, 80)).toBe("improved");
    expect(classifyScoreDelta(75, 75)).toBe("no-change");
    expect(classifyScoreDelta(75, 70)).toBe("regressed");
    expect(classifyScoreDelta(75, undefined)).toBe("missing-score");
  });

  it("flags safety bound violations for the reallife loop", () => {
    jest.spyOn(fs, "readFileSync").mockImplementation((filePath) => {
      if (String(filePath).includes("agent.js")) {
        return "const POST_WIPE_BUDGET = 40;";
      }
      return "";
    });

    expect(checkSafetyBounds()).toEqual({
      ok: false,
      violation: "POST_WIPE_BUDGET = 40 (bounds: [10, 17])",
    });
  });
});

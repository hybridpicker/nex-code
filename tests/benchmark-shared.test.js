"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  buildBaselineKey,
  computeBenchmarkScore,
  getBaselinePath,
  getBenchmarkScore,
  loadBenchmarkResult,
} = require("../scripts/benchmark-shared");

describe("benchmark-shared", () => {
  it("computes weighted scores while skipping setup errors", () => {
    const summary = computeBenchmarkScore(
      [
        { category: "bugfix", score: 80, elapsed: 1000, completionReason: "success" },
        { category: "feature", score: 60, elapsed: 3000, completionReason: "success" },
        { category: "feature", score: 0, elapsed: 10, completionReason: "setup-error" },
      ],
      { bugfix: 0.6, feature: 0.4 },
    );

    expect(summary).toEqual({
      finalScore: 72,
      categoryScores: {
        bugfix: 80,
        feature: 60,
      },
      categoryMetrics: {
        bugfix: {
          avgScore: 80,
          passRate: 100,
          timeoutRate: 0,
          avgToolCalls: 0,
        },
        feature: {
          avgScore: 60,
          passRate: 0,
          timeoutRate: 0,
          avgToolCalls: 0,
        },
      },
      avgElapsed: 2000,
      totalToolCalls: 0,
      avgToolCalls: 0,
      totalTokens: { input: 0, output: 0 },
      avgTokens: { input: 0, output: 0 },
      statusCounts: {
        success: 2,
        "setup-error": 1,
      },
      timeoutRate: 0,
      errorRate: 33,
      invalidHarnessRate: 0,
      harnessFailureRate: 0,
      validCount: 2,
      skippedCount: 1,
      invalidCount: 0,
    });
  });

  it("excludes invalid harness runs from score aggregation", () => {
    const summary = computeBenchmarkScore(
      [
        { category: "bugfix", score: 90, elapsed: 1000, completionReason: "success" },
        {
          category: "feature",
          score: 100,
          elapsed: 1200,
          completionReason: "harness-failure",
          telemetry: { valid: false },
        },
      ],
      { bugfix: 0.5, feature: 0.5 },
    );

    expect(summary.finalScore).toBe(90);
    expect(summary.categoryScores).toEqual({ bugfix: 90 });
    expect(summary.statusCounts).toEqual({
      success: 1,
      "harness-failure": 1,
    });
    expect(summary.validCount).toBe(1);
    expect(summary.skippedCount).toBe(1);
    expect(summary.invalidCount).toBe(1);
    expect(summary.invalidHarnessRate).toBe(50);
    expect(summary.harnessFailureRate).toBe(50);
  });

  it("reads both modern and legacy benchmark score fields", () => {
    expect(getBenchmarkScore({ finalScore: 91 })).toBe(91);
    expect(getBenchmarkScore({ average: 77 })).toBe(77);
    expect(getBenchmarkScore({})).toBeNull();
  });

  it("keys baselines by harness version and routing signature", () => {
    const key = buildBaselineKey({
      harnessVersion: "2026-04-13.1",
      routingSignature: "bugfix=qwen,feature=glm",
    });

    expect(key).toContain("hv-2026-04-13-1");
    expect(key).toContain("routing-bugfix-qwen-feature-glm");
    expect(getBaselinePath({
      homeDir: "/tmp/home",
      harnessVersion: "2026-04-13.1",
      routingSignature: "bugfix=qwen,feature=glm",
    })).toContain(key);
  });

  it("loads the benchmark result matching the requested run id", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-bench-results-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "reallife-old.json"), JSON.stringify({
        date: "2026-04-13T10:00:00.000Z",
        runId: "old-run",
        finalScore: 70,
      }));
      fs.writeFileSync(path.join(tmpDir, "reallife-new.json"), JSON.stringify({
        date: "2026-04-13T10:05:00.000Z",
        runId: "new-run",
        finalScore: 90,
      }));

      expect(loadBenchmarkResult(tmpDir, { runId: "new-run" })).toEqual(
        expect.objectContaining({ runId: "new-run", finalScore: 90 }),
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

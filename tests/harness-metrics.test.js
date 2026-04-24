"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  analyzeBenchmarkHistory,
  analyzeHarnessAdoption,
  analyzeLoopState,
  estimateRunCost,
  normalizeOutcomeLabel,
} = require("../scripts/harness-metrics");

describe("harness metrics", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-harness-metrics-"));
    fs.mkdirSync(path.join(tempRoot, "tests", "helpers"), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, "scripts", "benchmark-results"), {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("measures adoption against the real CLI-touching pool", () => {
    fs.writeFileSync(
      path.join(tempRoot, "tests", "uses-harness.test.js"),
      'const { runCli } = require("./helpers/cli-harness");\nrunCli(["--help"]);',
    );
    fs.writeFileSync(
      path.join(tempRoot, "tests", "ad-hoc-cli.test.js"),
      'const { execFileSync } = require("child_process");\nexecFileSync(process.execPath, ["bin/nex-code.js", "--version"]);',
    );
    fs.writeFileSync(
      path.join(tempRoot, "tests", "plain-unit.test.js"),
      "expect(1).toBe(1);\n",
    );

    const stats = analyzeHarnessAdoption(tempRoot);

    expect(stats.totalFiles).toBe(3);
    expect(stats.cliTouchingFiles).toBe(2);
    expect(stats.harnessUsers).toEqual(["tests/uses-harness.test.js"]);
    expect(stats.adHocCliUsers).toEqual(["tests/ad-hoc-cli.test.js"]);
    expect(stats.dormantFiles).toBe(1);
    expect(stats.adoptionRate).toBe(0.5);
  });

  it("derives loop outcomes and tokens per pass from structured state", () => {
    const statePath = path.join(
      tempRoot,
      "scripts",
      "benchmark-results",
      "improve-reallife-state.json",
    );
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        {
          pass: 4,
          scores: [70, 72, 72, 74],
          tokensSpent: 840000,
          experiments: [
            { reason: "improved" },
            { reason: "no-change" },
            { reason: "regressed" },
            { reason: "tests-failed" },
          ],
        },
        null,
        2,
      ),
    );

    const summary = analyzeLoopState(statePath);

    expect(summary.pass).toBe(4);
    expect(summary.avgTokensPerPass).toBe(210000);
    expect(summary.outcomeCounts.get("improved")).toBe(1);
    expect(summary.outcomeCounts.get("no-new-high")).toBe(1);
    expect(summary.outcomeCounts.get("regression")).toBe(1);
    expect(summary.outcomeCounts.get("tests failed")).toBe(1);
  });

  it("builds benchmark trends, pass distribution, and top token burners", () => {
    const resultsDir = path.join(tempRoot, "scripts", "benchmark-results");
    fs.writeFileSync(
      path.join(resultsDir, "reallife-history.jsonl"),
      [
        JSON.stringify({
          date: "2026-04-14T00:00:00.000Z",
          model: "gpt-4o-mini",
          finalScore: 60,
          passing: 1,
          taskCount: 6,
          metrics: { timeoutRate: 80 },
          totalTokens: { input: 100000, output: 2000 },
        }),
        JSON.stringify({
          date: "2026-04-15T00:00:00.000Z",
          model: "gpt-4o-mini",
          finalScore: 78,
          passing: 3,
          taskCount: 6,
          metrics: { timeoutRate: 40 },
          totalTokens: { input: 150000, output: 3000 },
        }),
      ].join("\n"),
    );

    fs.writeFileSync(
      path.join(resultsDir, "reallife-latest.json"),
      JSON.stringify(
        {
          date: "2026-04-15T00:00:00.000Z",
          runId: "latest-run",
          model: "gpt-4o-mini",
          finalScore: 78,
          passing: 3,
          taskCount: 6,
          results: [
            {
              id: "heavy-understanding",
              category: "understanding",
              score: 42,
              completionReason: "timeout",
              tokens: { input: 500000, output: 1200 },
            },
            {
              id: "light-bugfix",
              category: "bugfix",
              score: 100,
              completionReason: "success",
              tokens: { input: 20000, output: 300 },
            },
          ],
        },
        null,
        2,
      ),
    );

    const summary = analyzeBenchmarkHistory(tempRoot, { lastRuns: 2 });

    expect(summary.history).toHaveLength(2);
    expect(summary.scoreDelta).toBe(18);
    expect(summary.timeoutDelta).toBe(-40);
    expect(summary.passDistribution.get("1/6")).toBe(1);
    expect(summary.passDistribution.get("3/6")).toBe(1);
    expect(summary.expensiveTasks[0].id).toBe("heavy-understanding");
    expect(summary.completionCounts.get("timeout")).toBe(1);
    expect(summary.avgCostPerRun).toBeGreaterThan(0);
  });

  it("estimates cost only when model pricing is known", () => {
    expect(
      estimateRunCost({
        model: "gpt-4o-mini",
        totalTokens: { input: 1000000, output: 1000000 },
      }),
    ).toBeCloseTo(0.75, 5);
    expect(
      estimateRunCost({
        model: null,
        totalTokens: { input: 1000000, output: 1000000 },
      }),
    ).toBeNull();
  });

  it("normalizes legacy and structured labels", () => {
    expect(normalizeOutcomeLabel("no-change")).toBe("no-new-high");
    expect(normalizeOutcomeLabel("regressed")).toBe("regression");
    expect(normalizeOutcomeLabel("tests-failed")).toBe("tests failed");
  });
});

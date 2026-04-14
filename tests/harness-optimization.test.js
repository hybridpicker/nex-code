"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildOptimizationReport,
  classifyTask,
  getPriorityDir,
  readHistory,
  readLatestResult,
  selectPriorityTasks,
  verifyHarnessOptimization,
} = require("../cli/harness-optimization");

describe("harness optimization", () => {
  let tempRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-harness-"));
    fs.mkdirSync(path.join(tempRoot, "scripts", "benchmark-results"), {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("classifies runaway understanding tasks as over-exploration", () => {
    expect(
      classifyTask({
        category: "understanding",
        completionReason: "timeout",
        toolCalls: 24,
        score: 42,
        tokens: { input: 500000, output: 1200 },
      }),
    ).toBe("over-exploration");
  });

  it("reads the latest result and history, then builds a focused report", () => {
    const resultsDir = path.join(tempRoot, "scripts", "benchmark-results");
    const historyFile = path.join(resultsDir, "reallife-history.jsonl");
    const resultFile = path.join(
      resultsDir,
      "reallife-2026-04-14T15-05-24-2026-04-14T14-23-39-198Z-35728-d8b279.json",
    );

    fs.writeFileSync(
      historyFile,
      [
        JSON.stringify({
          runId: "older-run",
          finalScore: 75,
          metrics: { timeoutRate: 83, avgToolCalls: 7 },
        }),
        JSON.stringify({
          runId: "latest-run",
          finalScore: 70,
          metrics: { timeoutRate: 83, avgToolCalls: 11 },
        }),
      ].join("\n"),
    );

    fs.writeFileSync(
      resultFile,
      JSON.stringify(
        {
          runId: "latest-run",
          finalScore: 70,
          taskCount: 6,
          totalTokens: { input: 1922944, output: 6744 },
          metrics: {
            timeoutRate: 83,
            avgToolCalls: 11,
          },
          categoryMetrics: {
            understanding: {
              avgScore: 28,
              timeoutRate: 100,
              avgToolCalls: 32,
            },
            testing: {
              avgScore: 64,
              timeoutRate: 100,
              avgToolCalls: 14,
            },
          },
          results: [
            {
              id: "understand-project-structure",
              category: "understanding",
              score: 28,
              completionReason: "timeout",
              toolCalls: 32,
              tokens: { input: 782593, output: 1510 },
            },
            {
              id: "test-write-unit-tests",
              category: "testing",
              score: 64,
              completionReason: "timeout",
              toolCalls: 14,
              tokens: { input: 250000, output: 1000 },
            },
          ],
        },
        null,
        2,
      ),
    );

    const history = readHistory(tempRoot);
    const latestRun = readLatestResult(tempRoot);
    const report = buildOptimizationReport({
      latestRun,
      history,
      lastN: 3,
      includePrompt: true,
    });

    expect(history).toHaveLength(2);
    expect(latestRun.runId).toBe("latest-run");
    expect(report).toContain("Harness Optimization Report");
    expect(report).toContain("Top Bottlenecks");
    expect(report).toContain("understand-project-structure");
    expect(report).toContain("over-exploration");
    expect(report).toContain("Weakest Categories");
    expect(report).toContain("Suggested Codex Prompt");
  });

  it("selects priority tasks from the weakest timed-out results", () => {
    const taskIds = selectPriorityTasks({
      results: [
        {
          id: "healthy-feature",
          category: "feature",
          score: 100,
          completionReason: "success",
          toolCalls: 3,
          tokens: { input: 1000, output: 200 },
        },
        {
          id: "docs-api-documentation",
          category: "docs",
          score: 42,
          completionReason: "timeout",
          toolCalls: 7,
          tokens: { input: 200000, output: 500 },
        },
        {
          id: "understand-project-structure",
          category: "understanding",
          score: 56,
          completionReason: "timeout",
          toolCalls: 24,
          tokens: { input: 500000, output: 800 },
        },
      ],
    });

    expect(taskIds).toEqual([
      "docs-api-documentation",
      "understand-project-structure",
      "healthy-feature",
    ]);
  });

  it("writes a verification bundle into the prio directory", async () => {
    const resultsDir = path.join(tempRoot, "scripts", "benchmark-results");
    const existingResultPath = path.join(
      resultsDir,
      "reallife-2026-04-14T13-39-56-2026-04-14T13-12-57-792Z-95134-0d9551.json",
    );
    fs.writeFileSync(
      existingResultPath,
      JSON.stringify({
        runId: "source-run",
        finalScore: 70,
        metrics: { timeoutRate: 83, avgToolCalls: 11 },
        results: [
          {
            id: "understand-project-structure",
            category: "understanding",
            score: 28,
            completionReason: "timeout",
            toolCalls: 32,
            tokens: { input: 782593, output: 1510 },
          },
        ],
      }),
    );

    const runner = jest
      .fn()
      .mockImplementationOnce(() => ({
        status: 0,
        signal: null,
        stdout: "PASS tests/agent.test.js",
        stderr: "",
      }))
      .mockImplementationOnce(() => {
        const newResultPath = path.join(
          resultsDir,
          "reallife-2026-04-14T17-00-00-verify.json",
        );
        fs.writeFileSync(
          newResultPath,
          JSON.stringify({
            runId: "verified-run",
            finalScore: 78,
            taskCount: 1,
            metrics: { timeoutRate: 50, avgToolCalls: 9 },
            totalTokens: { input: 250000, output: 900 },
            results: [],
          }),
        );
        return {
          status: 0,
          signal: null,
          stdout: "Real-Life Benchmark Results",
          stderr: "",
        };
      });

    const progress = [];
    const verification = await verifyHarnessOptimization({
      rootDir: tempRoot,
      latestRun: {
        runId: "source-run",
        finalScore: 70,
        metrics: { timeoutRate: 83, avgToolCalls: 11 },
        results: [
          {
            id: "understand-project-structure",
            category: "understanding",
            score: 28,
            completionReason: "timeout",
            toolCalls: 32,
            tokens: { input: 782593, output: 1510 },
          },
        ],
      },
      runner,
      onProgress(update) {
        progress.push(update);
      },
    });

    expect(runner).toHaveBeenCalledTimes(2);
    expect(verification.summary).toContain("Harness Optimization Verification");
    expect(verification.summary).toContain("verified-run");
    expect(progress.some((entry) => entry.percent === 100)).toBe(true);
    expect(verification.bundleDir.startsWith(getPriorityDir(tempRoot))).toBe(true);
    expect(fs.existsSync(path.join(verification.bundleDir, "SUMMARY.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(verification.bundleDir, "verification.json")),
    ).toBe(true);
  });
});

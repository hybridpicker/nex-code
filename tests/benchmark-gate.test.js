"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  collectConfiguredOllamaModels,
  evaluateGateRegression,
  findPassingHistoryRun,
  findUnavailableOllamaModels,
  findPreviousComparableRun,
  getBaselineContext,
  loadGateEnvironment,
  routingSignature,
  shouldUseGateCache,
  summarizeGateBaseline,
} = require("../scripts/benchmark-gate");

describe("benchmark-gate helpers", () => {
  it("keys baselines by harness version and routing signature", () => {
    const currentRoutingSig = routingSignature({
      feature: "glm-4.6",
      bugfix: "qwen3-next:80b",
    });

    const context = getBaselineContext({
      homeDir: "/tmp/home",
      harnessVersion: "2026-04-13.1",
      routingSignature: currentRoutingSig,
    });

    expect(context.harnessVersion).toBe("2026-04-13.1");
    expect(context.baselineKey).toContain("hv-2026-04-13-1");
    expect(context.baselineKey).toContain(
      "routing-bugfix-qwen3-next-80b-feature-glm-4-6",
    );
    expect(context.baselinePath).toContain(context.baselineKey);
  });

  it("uses cached gate results only for clean committed state", () => {
    expect(
      shouldUseGateCache({
        sha: "abc123",
        updateBaseline: false,
        workingTreeClean: true,
      }),
    ).toBe(true);
    expect(
      shouldUseGateCache({
        sha: "abc123",
        updateBaseline: false,
        workingTreeClean: false,
      }),
    ).toBe(false);
    expect(
      shouldUseGateCache({
        sha: "abc123",
        updateBaseline: true,
        workingTreeClean: true,
      }),
    ).toBe(false);
    expect(
      shouldUseGateCache({
        sha: null,
        updateBaseline: false,
        workingTreeClean: true,
      }),
    ).toBe(false);
  });

  it("collects configured Ollama models from defaults and routing", () => {
    expect(
      collectConfiguredOllamaModels({
        routing: {
          agentic: "ministral-3:14b",
          phases: {
            plan: "ollama:qwen3-coder:480b",
          },
        },
        env: {
          DEFAULT_PROVIDER: "ollama",
          DEFAULT_MODEL: "deepseek-v4-flash:cloud",
          NEX_ROUTE_CODING: "qwen3-coder-next",
        },
      }),
    ).toEqual([
      "deepseek-v4-flash:cloud",
      "ministral-3:14b",
      "qwen3-coder-next",
      "qwen3-coder:480b",
    ]);
  });

  it("loads global gate env with override semantics", () => {
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-gate-env-"));
    const configDir = path.join(homeDir, ".nex-code");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, ".env"),
      "DEFAULT_MODEL=deepseek-v4-flash:cloud\nNEX_ROUTE_CODING=deepseek-v4-flash:cloud\n",
    );
    const env = {
      DEFAULT_MODEL: "stale-model",
      NEX_ROUTE_CODING: "stale-route",
    };

    expect(loadGateEnvironment({ homeDir, env })).toBe(true);
    expect(env.DEFAULT_MODEL).toBe("deepseek-v4-flash:cloud");
    expect(env.NEX_ROUTE_CODING).toBe("deepseek-v4-flash:cloud");
  });

  it("skips global gate env loading when disabled", () => {
    const env = {
      NEX_NO_DOTENV: "1",
      DEFAULT_MODEL: "stale-model",
    };

    expect(loadGateEnvironment({ homeDir: __dirname, env })).toBe(false);
    expect(env.DEFAULT_MODEL).toBe("stale-model");
  });

  it("treats untagged Ollama model names as matching loaded tags", () => {
    expect(
      findUnavailableOllamaModels(
        ["qwen3-coder", "deepseek-v4-flash:cloud", "missing:latest"],
        ["qwen3-coder:480b", "deepseek-v4-flash:cloud"],
      ),
    ).toEqual(["missing:latest"]);
  });

  it("fails when timeout rate regresses sharply even if score is stable", () => {
    const result = evaluateGateRegression(
      {
        finalScore: 90,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 90,
        },
        timeoutRate: 35,
        invalidCount: 0,
        invalidHarnessRate: 0,
      },
      {
        finalScore: 90,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 90,
        },
        metrics: {
          timeoutRate: 10,
        },
      },
    );

    expect(result.pass).toBe(false);
    expect(result.reasons).toContain(
      "Timeout rate increased 25 points (10% -> 35%)",
    );
    expect(result.severity).toBe("severe");
  });

  it("passes when score, speed, category scores, and timeout rate stay within bounds", () => {
    const result = evaluateGateRegression(
      {
        finalScore: 89,
        avgElapsed: 11000,
        categoryScores: {
          bugfix: 88,
          feature: 91,
        },
        timeoutRate: 12,
        invalidCount: 0,
        invalidHarnessRate: 0,
      },
      {
        finalScore: 92,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 90,
          feature: 93,
        },
        metrics: {
          timeoutRate: 5,
        },
      },
    );

    expect(result).toEqual({
      pass: true,
      reasons: [],
      severity: "none",
    });
  });

  it("builds a median baseline from recent gate history", () => {
    const summary = summarizeGateBaseline(
      {
        finalScore: 92,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 90,
          feature: 95,
        },
        metrics: {
          timeoutRate: 5,
        },
      },
      [
        {
          finalScore: 90,
          avgElapsed: 12000,
          timeoutRate: 8,
          categoryScores: {
            bugfix: 88,
            feature: 92,
          },
        },
        {
          finalScore: 94,
          avgElapsed: 9000,
          timeoutRate: 4,
          categoryScores: {
            bugfix: 92,
            feature: 96,
          },
        },
      ],
    );

    expect(summary.finalScore).toBe(92);
    expect(summary.avgElapsed).toBe(10000);
    expect(summary.metrics.timeoutRate).toBe(5);
    expect(summary.categoryScores).toEqual({
      bugfix: 90,
      feature: 95,
    });
    expect(summary.sampleSize).toBe(3);
  });

  it("excludes failed gate runs from the median baseline", () => {
    const summary = summarizeGateBaseline(
      {
        finalScore: 94,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 94,
        },
        metrics: {
          timeoutRate: 5,
        },
      },
      [
        {
          outcome: "fail",
          finalScore: 40,
          avgElapsed: 60000,
          timeoutRate: 100,
          categoryScores: {
            bugfix: 40,
          },
        },
        {
          outcome: "pass",
          finalScore: 96,
          avgElapsed: 12000,
          timeoutRate: 0,
          categoryScores: {
            bugfix: 96,
          },
        },
      ],
    );

    expect(summary.finalScore).toBe(95);
    expect(summary.avgElapsed).toBe(11000);
    expect(summary.metrics.timeoutRate).toBe(3);
    expect(summary.categoryScores).toEqual({ bugfix: 95 });
    expect(summary.sampleSize).toBe(2);
  });

  it("uses only prior runs from the same commit for repeat detection", () => {
    const history = [
      { sha: "old", outcome: "fail", finalScore: 80 },
      { sha: "other", outcome: "fail", finalScore: 81 },
      { sha: "current", outcome: "pass", finalScore: 95 },
    ];

    expect(findPreviousComparableRun(history, "current")).toEqual({
      sha: "current",
      outcome: "pass",
      finalScore: 95,
    });
    expect(findPreviousComparableRun(history, "missing")).toBeNull();
  });

  it("finds a prior passing gate run for the same commit and baseline", () => {
    const history = [
      {
        sha: "current",
        baselineKey: "old-baseline",
        outcome: "pass",
        finalScore: 95,
      },
      {
        sha: "current",
        baselineKey: "baseline",
        outcome: "transient-warning",
        finalScore: 94,
      },
      {
        sha: "other",
        baselineKey: "baseline",
        outcome: "pass",
        finalScore: 99,
      },
    ];

    expect(
      findPassingHistoryRun(history, {
        sha: "current",
        baselineKey: "baseline",
      }),
    ).toEqual({
      sha: "current",
      baselineKey: "baseline",
      outcome: "transient-warning",
      finalScore: 94,
    });
  });

  it("does not reuse history after a failed run for the same commit", () => {
    const history = [
      {
        sha: "current",
        baselineKey: "baseline",
        outcome: "pass",
        finalScore: 95,
      },
      {
        sha: "current",
        baselineKey: "baseline",
        outcome: "fail",
        finalScore: 70,
      },
    ];

    expect(
      findPassingHistoryRun(history, {
        sha: "current",
        baselineKey: "baseline",
      }),
    ).toBeNull();
  });

  it("warns on a single non-severe regression against the median baseline", () => {
    const result = evaluateGateRegression(
      {
        finalScore: 85,
        avgElapsed: 11000,
        categoryScores: {
          bugfix: 79,
          feature: 92,
        },
        timeoutRate: 12,
        invalidCount: 0,
        invalidHarnessRate: 0,
      },
      {
        finalScore: 92,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 90,
          feature: 93,
        },
        metrics: {
          timeoutRate: 5,
        },
        scoreRange: {
          min: 88,
          max: 94,
        },
        avgElapsedRange: {
          min: 9500,
          max: 11000,
        },
        timeoutRange: {
          min: 4,
          max: 10,
        },
        sampleSize: 5,
      },
    );

    expect(result.pass).toBe(true);
    expect(result.severity).toBe("transient");
    expect(result.warning).toContain("5-run median baseline");
    expect(result.warningReasons).toContain(
      'Category "bugfix" dropped 11 points (90 -> 79)',
    );
  });

  it("fails when the same soft regression happens twice in a row", () => {
    const baseline = {
      finalScore: 92,
      avgElapsed: 10000,
      categoryScores: {
        bugfix: 90,
        feature: 93,
      },
      metrics: {
        timeoutRate: 5,
      },
      scoreRange: {
        min: 88,
        max: 94,
      },
      avgElapsedRange: {
        min: 9500,
        max: 11000,
      },
      timeoutRange: {
        min: 4,
        max: 10,
      },
      sampleSize: 5,
    };

    const result = evaluateGateRegression(
      {
        finalScore: 85,
        avgElapsed: 11000,
        categoryScores: {
          bugfix: 79,
          feature: 92,
        },
        timeoutRate: 12,
        invalidCount: 0,
        invalidHarnessRate: 0,
      },
      baseline,
      {
        previous: {
          finalScore: 86,
          avgElapsed: 10800,
          categoryScores: {
            bugfix: 78,
            feature: 92,
          },
          timeoutRate: 11,
          invalidCount: 0,
          invalidHarnessRate: 0,
        },
      },
    );

    expect(result.pass).toBe(false);
    expect(result.severity).toBe("repeat");
    expect(result.reasons).toContain(
      'Category "bugfix" dropped 11 points (90 -> 79)',
    );
  });

  it("fails immediately when the harness telemetry is invalid", () => {
    const result = evaluateGateRegression(
      {
        finalScore: 92,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 92,
        },
        timeoutRate: 0,
        invalidCount: 1,
        invalidHarnessRate: 14,
      },
      {
        finalScore: 92,
        avgElapsed: 10000,
        categoryScores: {
          bugfix: 92,
        },
        metrics: {
          timeoutRate: 0,
        },
      },
    );

    expect(result.pass).toBe(false);
    expect(result.severity).toBe("severe");
    expect(result.reasons).toContain(
      "Harness telemetry failed for 1 task(s) (14% invalid)",
    );
  });
});

"use strict";

const {
  collectConfiguredOllamaModels,
  evaluateGateRegression,
  findUnavailableOllamaModels,
  getBaselineContext,
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

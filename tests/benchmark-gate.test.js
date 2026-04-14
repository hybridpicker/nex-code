"use strict";

const {
  evaluateGateRegression,
  getBaselineContext,
  routingSignature,
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
    expect(context.baselineKey).toContain("routing-bugfix-qwen3-next-80b-feature-glm-4-6");
    expect(context.baselinePath).toContain(context.baselineKey);
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
    expect(result.reasons).toContain("Timeout rate increased 25 points (10% -> 35%)");
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
    });
  });
});

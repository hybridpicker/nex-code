const {
  shouldStopImproving,
  DEFAULTS,
} = require("../scripts/improve-stop-conditions");

describe("shouldStopImproving", () => {
  test("returns null before enough history exists", () => {
    expect(shouldStopImproving([])).toBeNull();
    expect(shouldStopImproving([8])).toBeNull();
    // PLATEAU_COUNT+1 is the minimum: with default count=2 that's 3.
    expect(shouldStopImproving([8, 8])).toBeNull();
  });

  test("detects flat-within-epsilon plateau", () => {
    // last two within 0.3
    const r = shouldStopImproving([5, 9.0, 9.1]);
    expect(r).toMatch(/plateau/);
  });

  test("does NOT treat a genuine improvement as a plateau", () => {
    // 6 → 8 → 10: steady climb, should continue
    expect(shouldStopImproving([6, 8, 10])).toBeNull();
  });

  test("detects regression after an early high (the real-world bug case)", () => {
    // Observed sequence that the old `every(s===last[0])` check missed.
    // After 9 → 10 the loop hit 8.5 → 5.5 → 6.3 — clearly regressing.
    const r = shouldStopImproving([9, 10, 8.5, 5.5, 6.3]);
    expect(r).not.toBeNull();
    expect(r).toMatch(/regression|no new high/);
  });

  test("stops on no-new-high even when drop is below regression threshold", () => {
    // Prior max 10, recent pair 9.5/8.8 — not flat (diff 0.7 > eps 0.3),
    // not a regression (10 - 9.15 = 0.85 < threshold 1.0), but neither
    // beats the prior max. Should still trigger a stop.
    const r = shouldStopImproving([5, 10, 9.5, 8.8]);
    expect(r).toMatch(/no new high/);
  });

  test("continues when recent pass beats the prior max", () => {
    expect(shouldStopImproving([5, 7, 6, 9])).toBeNull();
  });

  test("respects custom thresholds", () => {
    // with a tiny epsilon, 9.0/9.1 is no longer a plateau (diff 0.1 > 0.05)
    const r = shouldStopImproving([5, 9.0, 9.1], { plateauEpsilon: 0.05 });
    if (r !== null) expect(r).not.toMatch(/plateau/);
  });

  test("exports sensible defaults", () => {
    expect(DEFAULTS.plateauCount).toBeGreaterThanOrEqual(2);
    expect(DEFAULTS.plateauEpsilon).toBeGreaterThan(0);
    expect(DEFAULTS.regressionThreshold).toBeGreaterThan(0);
  });
});

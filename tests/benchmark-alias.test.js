"use strict";

const alias = require("../scripts/benchmark-realworld");
const canonical = require("../scripts/benchmark-reallife");

describe("benchmark-realworld alias", () => {
  it("re-exports the canonical real-life benchmark module", () => {
    expect(alias.main).toBe(canonical.main);
    expect(alias.runTask).toBe(canonical.runTask);
    expect(alias.evaluateTask).toBe(canonical.evaluateTask);
    expect(alias.TASKS).toBe(canonical.TASKS);
  });
});

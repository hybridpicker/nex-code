"use strict";

const { getFewShotForInput } = require("../cli/few-shot");

describe("few-shot example injection", () => {
  const originalFewShot = process.env.NEX_FEW_SHOT;

  afterEach(() => {
    if (originalFewShot === undefined) {
      delete process.env.NEX_FEW_SHOT;
    } else {
      process.env.NEX_FEW_SHOT = originalFewShot;
    }
  });

  test("does not inject coding examples into read-only inspection tasks", () => {
    expect(
      getFewShotForInput(
        "Read package.json and tell me the safest validation command. Do not edit files.",
      ),
    ).toBeNull();
    expect(
      getFewShotForInput("Inspect the scripts and summarize how to run tests without changes."),
    ).toBeNull();
  });

  test("still injects coding examples for implementation tasks", () => {
    const fewShot = getFewShotForInput("Fix the request handler crash on empty input.");

    expect(fewShot).toBeTruthy();
    expect(fewShot.user).toMatch(/handler|crash|throws|fix/i);
  });
});

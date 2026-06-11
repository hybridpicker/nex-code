"use strict";

const {
  getFewShotForInput,
  loadExampleForModel,
} = require("../cli/few-shot");

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

  test("does not inject model examples into read-only inspection tasks", () => {
    expect(
      getFewShotForInput(
        "Inspect package.json and summarize the available test scripts without changes.",
        "qwen3-coder:480b",
      ),
    ).toBeNull();
  });

  test("does not inject generic coding examples for catch-all tasks", () => {
    expect(
      getFewShotForInput(
        "bei /fitness bzw ernährung hätte ich gern ein kcal-restfeld",
      ),
    ).toBeNull();
  });

  test("still injects coding examples for implementation tasks", () => {
    const fewShot = getFewShotForInput("Fix the request handler crash on empty input.");

    expect(fewShot).toBeTruthy();
    expect(fewShot.user).toMatch(/handler|crash|throws|fix/i);
  });

  test("uses qwen coder model examples for edit recovery and dev servers", () => {
    const fewShot = getFewShotForInput(
      "Fix the parser crash and verify the related test.",
      "qwen3-coder:480b-cloud",
    );

    expect(fewShot).toBeTruthy();
    expect(fewShot.assistant).toContain("edit_file ambiguity error");
    expect(fewShot.assistant).toContain("run_in_background=true");
    expect(fewShot.assistant).toContain("bash_output");
  });

  test("loads model examples by family key", () => {
    const fewShot = loadExampleForModel("devstral-small-2:24b");

    expect(fewShot).toBeTruthy();
    expect(fewShot.assistant).toContain("longer unique old_text");
  });
});

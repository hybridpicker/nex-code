"use strict";

const { TASKS, PHASE_TASKS, buildCategoryWinners } = require("../cli/benchmark");

function getTask(id) {
  return [...TASKS, ...PHASE_TASKS].find((task) => task.id === id);
}

describe("benchmark task validators", () => {
  it("accepts semantically correct SQL for inactive users", () => {
    const task = getTask("data-sql-query");
    expect(
      task.validateArgs({
        path: "queries/inactive-users.sql",
        content:
          "SELECT id, email FROM users WHERE last_sign_in < NOW() - INTERVAL '30 days';",
      }),
    ).toBe(true);
  });

  it("accepts semantically correct SQL for recent users", () => {
    const task = getTask("data-write-query");
    expect(
      task.validateArgs({
        path: "queries/recent-users.sql",
        content:
          "SELECT * FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';",
      }),
    ).toBe(true);
  });

  it("accepts recent-user SQL using common alternate date expressions", () => {
    const task = getTask("data-write-query");
    expect(
      task.validateArgs({
        path: "queries/recent-users.sql",
        content:
          "SELECT id FROM users WHERE registered_on >= DATEADD(day, -30, CURRENT_DATE);",
      }),
    ).toBe(true);
  });

  it("accepts package.json version edits even when spacing differs", () => {
    const task = getTask("edit-version-bump");
    expect(
      task.validateArgs({
        path: "/repo/package.json",
        patches: [
          {
            old_text: '"version":"1.0.0"',
            new_text: '"version":"1.1.0"',
          },
        ],
      }),
    ).toBe(true);
  });

  it("accepts search-first version inspection flows", () => {
    const task = getTask("multi-step-version");
    expect(
      task.validateArgs({
        query: "package.json version",
        path: ".",
      }),
    ).toBe(true);
  });

  it("accepts list_directory as a fair recovery step for moved helpers", () => {
    const task = getTask("resilience-file-not-found");
    expect(task.expectedTool).toContain("list_directory");
    expect(
      task.validateArgs({
        path: "src/utils",
      }),
    ).toBe(true);
  });

  it("accepts efficient large-file navigation commands beyond grep", () => {
    const task = getTask("resilience-large-file-nav");
    expect(
      task.validateArgs({
        command: "sed -n '/authenticateUser/p' src/api.js",
      }),
    ).toBe(true);
  });

  it("accepts renamed-import recovery via grep/search flows", () => {
    const task = getTask("resilience-broken-import");
    expect(
      task.validateArgs({
        pattern: "config import module",
      }),
    ).toBe(true);
  });

  it("accepts export-discovery recovery commands after grep misses", () => {
    const task = getTask("resilience-grep-no-match");
    expect(
      task.validateArgs({
        command: "rg \"export|module\\.exports|exports\\.\" src/",
      }),
    ).toBe(true);
  });

  it("accepts task_list for verify test, lint, and build first steps", () => {
    expect(
      getTask("phase-verify-test").validateArgs({
        action: "create",
        name: "Verify tests",
        tasks: [{ title: "Run tests first, then inspect failures" }],
      }),
    ).toBe(true);

    expect(
      getTask("phase-verify-lint").validateArgs({
        action: "create",
        name: "Verify lint",
        tasks: [{ title: "Run lint after the Header.tsx changes" }],
      }),
    ).toBe(true);

    expect(
      getTask("phase-verify-build").validateArgs({
        action: "create",
        name: "Verify build",
        tasks: [{ title: "Run build to verify the TypeScript changes compile" }],
      }),
    ).toBe(true);
  });

  it("accepts task_list as a fair first step for agentic test-first flows", () => {
    const task = getTask("agentic-test-first");
    expect(
      task.validateArgs({
        action: "create",
        name: "Run tests",
        tasks: [{ title: "Run the full test suite first" }],
      }),
    ).toBe(true);
  });

  it("accepts search-style args for large-file navigation and grep recovery", () => {
    expect(
      getTask("resilience-large-file-nav").validateArgs({
        query: "authenticateUser src/api.js",
      }),
    ).toBe(true);

    expect(
      getTask("resilience-grep-no-match").validateArgs({
        query: "find exported function names in src via module.exports",
      }),
    ).toBe(true);
  });
});

describe("buildCategoryWinners()", () => {
  it("uses the same conservative winner logic that routing auto-update uses", () => {
    const summary = [
      {
        model: "qwen3-next:80b",
        score: 88,
        avgLatency: 2400,
        categoryScores: { coding: 100 },
        results: new Array(10).fill({ category: "coding" }),
      },
      {
        model: "glm-4.6",
        score: 86,
        avgLatency: 900,
        categoryScores: { coding: 95.5 },
        results: new Array(10).fill({ category: "coding" }),
      },
      {
        model: "devstral-2:123b",
        score: 84,
        avgLatency: 1500,
        categoryScores: { coding: 91 },
        results: new Array(10).fill({ category: "coding" }),
      },
    ];

    const winners = buildCategoryWinners(summary);
    expect(winners.coding).toEqual({
      model: "glm-4.6",
      score: 95.5,
      avgLatency: 900,
    });
  });

  it("ignores raw category leaders that miss the overall score floor", () => {
    const summary = [
      {
        model: "lucky-model",
        score: 60,
        avgLatency: 500,
        categoryScores: { data: 99 },
        results: new Array(5).fill({ category: "data" }),
      },
      {
        model: "stable-model",
        score: 82,
        avgLatency: 1100,
        categoryScores: { data: 92 },
        results: new Array(5).fill({ category: "data" }),
      },
    ];

    const winners = buildCategoryWinners(summary);
    expect(winners.data).toEqual({
      model: "stable-model",
      score: 92,
      avgLatency: 1100,
    });
  });
});

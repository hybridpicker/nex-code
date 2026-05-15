"use strict";

const path = require("path");

const {
  getManagedStatePath,
  getBlockingWorktreeChanges,
  isIgnorableManagedPath,
  isProjectDirectory,
  isWorkspaceContainerDirectory,
  findProjectRoot,
  parseGitStatusEntries,
  selectManagedCheckoutUpdate,
  buildLaunchArgs,
} = require("../bin/nex-code-app.js");

describe("nex-code-app launcher helpers", () => {
  test("writes managed state outside the tracked checkout", () => {
    const rootDir = "/Users/example/.nex-code/app-devel";
    const statePath = getManagedStatePath(rootDir);

    expect(statePath).toContain(path.join(".nex-code", "state"));
    expect(statePath).not.toContain(path.join("app-devel", ".nex-code-app-state.json"));
    expect(statePath.endsWith(".json")).toBe(true);
  });

  test("recognizes only launcher-managed legacy paths as ignorable", () => {
    expect(isIgnorableManagedPath(".nex-code-app-state.json")).toBe(true);
    expect(isIgnorableManagedPath(".git/info/exclude")).toBe(true);
    expect(isIgnorableManagedPath("desktop/main.js")).toBe(false);
  });

  test("parses porcelain output into path entries", () => {
    const entries = parseGitStatusEntries("?? .nex-code-app-state.json\n M desktop/main.js\n");

    expect(entries).toEqual([
      { raw: "?? .nex-code-app-state.json", path: ".nex-code-app-state.json" },
      { raw: " M desktop/main.js", path: "desktop/main.js" },
    ]);
  });

  test("ignores only the legacy launcher state file", () => {
    const blocking = getBlockingWorktreeChanges("?? .nex-code-app-state.json\n");
    expect(blocking).toEqual([]);
  });

  test("still blocks real worktree changes", () => {
    const blocking = getBlockingWorktreeChanges(
      "?? .nex-code-app-state.json\n M desktop/renderer/js/app.js\n?? notes.txt\n",
    );

    expect(blocking).toEqual([
      { raw: " M desktop/renderer/js/app.js", path: "desktop/renderer/js/app.js" },
      { raw: "?? notes.txt", path: "notes.txt" },
    ]);
  });

  test("uses fast-forward when remote descends from local head", () => {
    expect(selectManagedCheckoutUpdate("abc123", "def456", "abc123")).toBe("fast-forward");
  });

  test("uses hard reset when histories are unrelated", () => {
    expect(selectManagedCheckoutUpdate("abc123", "def456", "")).toBe("reset-hard");
  });

  test("uses hard reset when local branch diverged from managed remote", () => {
    expect(selectManagedCheckoutUpdate("abc123", "def456", "999999")).toBe("reset-hard");
  });

  test("detects real project directories from common repo markers", () => {
    expect(isProjectDirectory("/Users/lukasschonsgibl/Coding/nex-code")).toBe(true);
    expect(isProjectDirectory("/Users/lukasschonsgibl/Coding/cookbook")).toBe(true);
  });

  test("recognizes common workspace containers separately from project roots", () => {
    expect(isWorkspaceContainerDirectory("/Users/lukasschonsgibl/Coding")).toBe(true);
    expect(isWorkspaceContainerDirectory("/Users/lukasschonsgibl/Coding/nex-code")).toBe(false);
  });

  test("finds the nearest project root from a nested working directory", () => {
    const nestedDir = "/Users/lukasschonsgibl/Coding/nex-code/desktop/renderer/js";
    expect(findProjectRoot(nestedDir, "/Users/lukasschonsgibl/.nex-code/app-devel")).toBe(
      "/Users/lukasschonsgibl/Coding/nex-code",
    );
  });

  test("does not walk into the managed desktop checkout boundary", () => {
    const boundary = "/Users/lukasschonsgibl/.nex-code/app-devel";
    const nestedManagedDir = `${boundary}/desktop/renderer`;
    expect(findProjectRoot(nestedManagedDir, boundary)).toBe(null);
  });

  test("falls back to the launch directory for unmarked projects", () => {
    const dir = "/Users/lukasschonsgibl/Coding/Python/guitar_tools";
    expect(findProjectRoot(dir, "/Users/lukasschonsgibl/.nex-code/app-devel")).toBe(dir);
  });

  test("auto-adds --open-project for a nested repo cwd", () => {
    const originalArgv = process.argv;
    const originalCwd = process.cwd;

    process.argv = ["node", "nex-code-app"];
    process.cwd = () => "/Users/lukasschonsgibl/Coding/nex-code/desktop/renderer/js";

    try {
      expect(buildLaunchArgs("/Users/lukasschonsgibl/.nex-code/app-devel")).toEqual([
        "--open-project",
        "/Users/lukasschonsgibl/Coding/nex-code",
      ]);
    } finally {
      process.argv = originalArgv;
      process.cwd = originalCwd;
    }
  });

  test("preserves explicit --open-project arguments", () => {
    const originalArgv = process.argv;
    const originalCwd = process.cwd;

    process.argv = [
      "node",
      "nex-code-app",
      "--open-project",
      "/tmp/custom-project",
    ];
    process.cwd = () => "/Users/lukasschonsgibl/Coding/nex-code/desktop";

    try {
      expect(buildLaunchArgs("/Users/lukasschonsgibl/.nex-code/app-devel")).toEqual([
        "--open-project",
        "/tmp/custom-project",
      ]);
    } finally {
      process.argv = originalArgv;
      process.cwd = originalCwd;
    }
  });
});

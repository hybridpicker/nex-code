"use strict";

const path = require("path");

const {
  getManagedStatePath,
  getBlockingWorktreeChanges,
  isIgnorableManagedPath,
  parseGitStatusEntries,
  selectManagedCheckoutUpdate,
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
});

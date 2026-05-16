"use strict";

const fs = require("fs");
const os = require("os");
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
  let tempRoot = null;

  function makeTempDir(...parts) {
    if (!tempRoot) {
      tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-code-app-test-"));
    }
    const dirPath = path.join(tempRoot, ...parts);
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
  }

  afterEach(() => {
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

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
    const gitProject = makeTempDir("nex-code");
    fs.mkdirSync(path.join(gitProject, ".git"));

    const packageProject = makeTempDir("cookbook");
    fs.writeFileSync(path.join(packageProject, "package.json"), "{}\n", "utf8");

    expect(isProjectDirectory(gitProject)).toBe(true);
    expect(isProjectDirectory(packageProject)).toBe(true);
  });

  test("recognizes common workspace containers separately from project roots", () => {
    const codingDir = makeTempDir("Coding");
    const projectDir = makeTempDir("Coding", "nex-code");

    expect(isWorkspaceContainerDirectory(codingDir)).toBe(true);
    expect(isWorkspaceContainerDirectory(projectDir)).toBe(false);
  });

  test("finds the nearest project root from a nested working directory", () => {
    const projectDir = makeTempDir("nex-code");
    fs.writeFileSync(path.join(projectDir, "package.json"), "{}\n", "utf8");
    const nestedDir = makeTempDir("nex-code", "desktop", "renderer", "js");
    const boundary = makeTempDir("app-devel");

    expect(findProjectRoot(nestedDir, boundary)).toBe(projectDir);
  });

  test("does not walk into the managed desktop checkout boundary", () => {
    const boundary = makeTempDir("app-devel");
    const nestedManagedDir = makeTempDir("app-devel", "desktop", "renderer");

    expect(findProjectRoot(nestedManagedDir, boundary)).toBe(null);
  });

  test("falls back to the launch directory for unmarked projects", () => {
    const dir = makeTempDir("guitar_tools");
    const boundary = makeTempDir("app-devel");

    expect(findProjectRoot(dir, boundary)).toBe(dir);
  });

  test("auto-adds --open-project for a nested repo cwd", () => {
    const originalArgv = process.argv;
    const originalCwd = process.cwd;
    const projectDir = makeTempDir("nex-code");
    fs.writeFileSync(path.join(projectDir, "package.json"), "{}\n", "utf8");
    const nestedDir = makeTempDir("nex-code", "desktop", "renderer", "js");
    const boundary = makeTempDir("app-devel");

    process.argv = ["node", "nex-code-app"];
    process.cwd = () => nestedDir;

    try {
      expect(buildLaunchArgs(boundary)).toEqual([
        "--open-project",
        projectDir,
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
    process.cwd = () => makeTempDir("nex-code", "desktop");
    const boundary = makeTempDir("app-devel");

    try {
      expect(buildLaunchArgs(boundary)).toEqual([
        "--open-project",
        "/tmp/custom-project",
      ]);
    } finally {
      process.argv = originalArgv;
      process.cwd = originalCwd;
    }
  });

  test("passes desktop E2E flags through to Electron unchanged", () => {
    const originalArgv = process.argv;
    const originalCwd = process.cwd;
    const promptFile = path.join(os.tmpdir(), "prompt.txt");
    const projectDir = makeTempDir("neutral-project");
    fs.writeFileSync(path.join(projectDir, "package.json"), "{}\n", "utf8");
    const boundary = makeTempDir("app-devel");

    process.argv = [
      "node",
      "nex-code-app",
      "--e2e",
      "--open-project",
      projectDir,
      "--prompt-file",
      promptFile,
      "--model",
      "mock:fast",
      "--timeout-ms",
      "180000",
      "--json",
      "--auto-confirm",
      "--expect-file",
      "src/components/ProfileCard.jsx",
      "--expect-contains",
      "ProfileCard",
      "--expect-not-contains",
      "placeholder",
    ];
    process.cwd = () => makeTempDir("elsewhere");

    try {
      expect(buildLaunchArgs(boundary)).toEqual(process.argv.slice(2));
    } finally {
      process.argv = originalArgv;
      process.cwd = originalCwd;
    }
  });
});

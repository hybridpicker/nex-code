"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

jest.mock("electron", () => ({
  app: {
    isPackaged: false,
    setPath: jest.fn(),
    commandLine: { appendSwitch: jest.fn() },
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
  },
  BrowserWindow: jest.fn(),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  dialog: {},
  Menu: {
    buildFromTemplate: jest.fn(),
    setApplicationMenu: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
    openPath: jest.fn(),
  },
  nativeImage: {
    createFromPath: jest.fn(() => ({ isEmpty: () => true })),
  },
}), { virtual: true });

const {
  buildActiveModelEnv,
  buildDesktopE2EOutput,
  buildFileTree,
  captureGitWorktreeSnapshot,
  classifyDesktopRunStatus,
  createDiffEmissionTracker,
  evaluateExpectations,
  isDesktopE2EPromptAccepted,
  isDesktopE2ERendererReady,
  isSafeExternalUrl,
  isValidProjectPathInput,
  normalizeProjectPath,
  parseDesktopE2EConfirmMode,
  parseDesktopE2EOptions,
  readGitDiffBetweenTrees,
  readProjectFileContent,
  registerIpcHandlers,
  resolveDebugSessionDir,
  selectDesktopE2EFinalAssistantText,
  setDesktopProjectStateForTests,
} = require("../desktop/main");
const { ipcMain } = require("electron");

describe("desktop main process IPC hardening", () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-desktop-main-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    setDesktopProjectStateForTests({
      projectPath: null,
      projectName: null,
      projectBranch: null,
      projectIsGit: false,
    });
    ipcMain.handle.mockClear();
    ipcMain.on.mockClear();
  });

  test("does not register IPC handlers as a module-load side effect", () => {
    expect(ipcMain.handle).not.toHaveBeenCalled();
    expect(ipcMain.on).not.toHaveBeenCalled();
  });

  test("registers only explicit desktop IPC channels during app startup", () => {
    registerIpcHandlers();

    expect(ipcMain.handle.mock.calls.map((call) => call[0])).toEqual([
      "nex:get-state",
      "nex:open-project",
      "nex:open-project-path",
      "nex:open-project-folder",
      "nex:get-model-state",
      "nex:set-active-model",
      "nex:get-file-tree",
      "nex:get-file-content",
      "nex:get-git-diff",
      "nex:select-file",
      "nex:get-git-state",
      "nex:checkout-branch",
      "nex:create-branch",
    ]);
    expect(ipcMain.on.mock.calls.map((call) => call[0])).toEqual([
      "nex:command",
      "nex:confirm-answer",
      "nex:cancel",
      "nex:clear",
      "nex:open-external",
    ]);
  });

  test("allows only browser-safe external URL schemes", () => {
    expect(isSafeExternalUrl("https://ollama.com/download")).toBe(true);
    expect(isSafeExternalUrl("http://localhost:3000")).toBe(true);

    expect(isSafeExternalUrl("file:///Users/example/.ssh/id_rsa")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeExternalUrl("/Applications/Calculator.app")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
  });

  test("rejects invalid project path IPC inputs before filesystem access", () => {
    expect(isValidProjectPathInput("")).toBe(false);
    expect(isValidProjectPathInput("   ")).toBe(false);
    expect(isValidProjectPathInput("project\0name")).toBe(false);
    expect(isValidProjectPathInput(null)).toBe(false);
  });

  test("normalizes project paths to canonical existing directories", () => {
    const projectDir = path.join(tmpRoot, "real-project");
    const nestedDir = path.join(projectDir, "src");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "package.json"), "{}\n");

    const linkDir = path.join(tmpRoot, "project-link");
    fs.symlinkSync(projectDir, linkDir);
    const canonicalProjectDir = fs.realpathSync(projectDir);

    expect(normalizeProjectPath(path.join(nestedDir, ".."))).toBe(canonicalProjectDir);
    expect(normalizeProjectPath(linkDir)).toBe(canonicalProjectDir);
    expect(normalizeProjectPath(path.join(tmpRoot, "missing"))).toBe(null);
    expect(normalizeProjectPath(path.join(projectDir, "package.json"))).toBe(null);
  });

  test("parses Desktop E2E options without normal app state", () => {
    const opts = parseDesktopE2EOptions([
      "--e2e",
      "--open-project",
      "/tmp/project",
      "--prompt-file",
      "/tmp/prompt.txt",
      "--model",
      "mock:fast",
      "--timeout-ms",
      "90000",
      "--json",
      "--auto-confirm",
      "--expect-file",
      "src/components/ProfileCard.jsx",
      "--expect-contains",
      "ProfileCard",
      "--expect-not-contains",
      "placeholder",
    ], {
      NEX_CODE_APP_STATE_DIR: "/tmp/nex-e2e-state",
    });

    expect(opts).toMatchObject({
      enabled: true,
      openProject: "/tmp/project",
      promptFile: "/tmp/prompt.txt",
      model: "mock:fast",
      timeoutMs: 90000,
      json: true,
      confirmMode: "yes",
      autoConfirm: true,
      expectFiles: ["src/components/ProfileCard.jsx"],
      expectContains: ["ProfileCard"],
      expectNotContains: ["placeholder"],
      stateDir: "/tmp/nex-e2e-state",
    });
  });

  test("resolves explicit Desktop debug session directory", () => {
    const debugDir = path.join(tmpRoot, "session-20260517-092246");

    expect(resolveDebugSessionDir({
      NEX_CODE_APP_DEBUG_SESSION_DIR: debugDir,
    })).toBe(path.resolve(debugDir));
  });

  test("infers Desktop debug session directory from debug state dir", () => {
    const debugDir = path.join(tmpRoot, "session-20260517-092246");

    expect(resolveDebugSessionDir({
      NEX_CODE_APP_STATE_DIR: path.join(debugDir, "state"),
    })).toBe(path.resolve(debugDir));
    expect(resolveDebugSessionDir({
      NEX_CODE_APP_STATE_DIR: path.join(tmpRoot, "normal-state"),
    })).toBe(null);
  });

  test("checks expect-contains against expected files instead of assistant text", () => {
    const projectDir = fs.mkdtempSync(path.join(tmpRoot, "e2e-expect-"));
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src/app.js"), "const value = 1;\n");

    const result = evaluateExpectations(
      {
        openProject: projectDir,
        expectFiles: ["src/app.js"],
        expectContains: ["targets.kcal - totals.kcal"],
        expectNotContains: [],
      },
      "I would add targets.kcal - totals.kcal here.",
    );

    expect(result.ok).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "expect-contains",
          value: "targets.kcal - totals.kcal",
          ok: false,
        }),
      ]),
    );
  });

  test("parses explicit Desktop E2E confirmation modes", () => {
    expect(parseDesktopE2EConfirmMode(["--e2e"], {})).toBe("manual");
    expect(parseDesktopE2EConfirmMode(["--e2e", "--auto-confirm"], {})).toBe("yes");
    expect(parseDesktopE2EConfirmMode(["--e2e", "--confirm", "yes"], {})).toBe("yes");
    expect(parseDesktopE2EConfirmMode(["--e2e", "--confirm", "no"], {})).toBe("no");
    expect(parseDesktopE2EConfirmMode(["--e2e"], { NEX_DESKTOP_E2E_AUTO_CONFIRM: "1" })).toBe("yes");
  });

  test("classifies Desktop E2E status into exit code semantics", () => {
    expect(classifyDesktopRunStatus({
      finalSessionState: "complete",
      expectationsOk: true,
    })).toMatchObject({ state: "complete", exitCode: 0 });

    expect(classifyDesktopRunStatus({
      finalSessionState: "complete",
      expectationsOk: false,
      lastAction: "Expected file was not created.",
    })).toMatchObject({ exitCode: 1 });

    expect(classifyDesktopRunStatus({
      finalSessionState: "stalled",
    })).toMatchObject({ state: "stalled", exitCode: 2 });

    expect(classifyDesktopRunStatus({
      timedOut: true,
      lastAction: "Desktop run completion timed out after 240000ms",
    })).toMatchObject({ state: "timeout", exitCode: 124 });
  });

  test("prefers completion evidence over stale renderer failure text", () => {
    const text = selectDesktopE2EFinalAssistantText(
      {
        finalAssistantText: "I cannot write that file.",
        lastAction: "Task complete",
      },
      "I cannot write that file.",
      "Task complete",
    );

    expect(text).toBe("Task complete");
  });

  test("forces explicit Desktop E2E model through server env", () => {
    const env = buildActiveModelEnv(
      { DEFAULT_MODEL: "devstral-small-2:24b-cloud" },
      "ollama:devstral-2:123b-cloud",
    );

    expect(env).toMatchObject({
      DEFAULT_PROVIDER: "ollama",
      DEFAULT_MODEL: "devstral-2:123b-cloud",
      NEX_FORCE_MODEL: "ollama:devstral-2:123b-cloud",
    });
  });

  test("requires wired renderer command controls before Desktop E2E submission", () => {
    expect(isDesktopE2ERendererReady({
      inputPresent: true,
      submitPresent: true,
      inputDisabled: false,
      submitDisabled: false,
      commandInputReady: true,
      projectOpen: true,
      nexApiPresent: true,
    })).toBe(true);

    expect(isDesktopE2ERendererReady({
      inputPresent: true,
      submitPresent: true,
      inputDisabled: false,
      submitDisabled: false,
      commandInputReady: false,
      projectOpen: true,
      nexApiPresent: true,
    })).toBe(false);

    expect(isDesktopE2ERendererReady({
      inputPresent: true,
      submitPresent: true,
      inputDisabled: false,
      submitDisabled: true,
      commandInputReady: true,
      projectOpen: true,
      nexApiPresent: true,
    })).toBe(false);
  });

  test("detects accepted and unaccepted Desktop E2E prompt submissions", () => {
    const before = {
      sessionState: "idle",
      userConversationCount: 0,
      serverCommandCount: 0,
    };

    expect(isDesktopE2EPromptAccepted(before, {
      sessionState: "idle",
      userConversationCount: 1,
      serverCommandCount: 0,
    })).toBe(true);

    expect(isDesktopE2EPromptAccepted(before, {
      sessionState: "running",
      userConversationCount: 0,
      serverCommandCount: 0,
    })).toBe(true);

    expect(isDesktopE2EPromptAccepted(before, {
      sessionState: "idle",
      userConversationCount: 0,
      serverCommandCount: 1,
    })).toBe(true);

    expect(isDesktopE2EPromptAccepted(before, {
      sessionState: "idle",
      userConversationCount: 0,
      serverCommandCount: 0,
    })).toBe(false);
  });

  test("includes failing E2E milestone and renderer diagnostic in JSON output", () => {
    const output = buildDesktopE2EOutput({
      finalSessionState: "error",
      expectationsOk: false,
      milestones: [
        { name: "app-loaded", at: "2026-05-16T00:00:00.000Z" },
        {
          name: "error",
          at: "2026-05-16T00:00:01.000Z",
          details: { stage: "prompt-submission" },
        },
      ],
      rendererSubmissionDiagnostic: {
        stage: "prompt-submission",
        message: "Renderer submission did not change state.",
      },
      errors: ["Renderer submission did not change state."],
    });

    expect(output.exitCode).toBe(1);
    expect(output.milestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "error",
          details: expect.objectContaining({ stage: "prompt-submission" }),
        }),
      ]),
    );
    expect(output.rendererSubmissionDiagnostic).toMatchObject({
      stage: "prompt-submission",
    });
  });

  test("preserves timeout diagnostics in JSON classification", () => {
    const output = buildDesktopE2EOutput({
      finalSessionState: "running",
      timedOut: true,
      lastAction: "Desktop run completion timed out after 240000ms",
      expectationsOk: false,
      milestones: [
        { name: "app-loaded", at: "2026-05-16T00:00:00.000Z" },
        {
          name: "timeout",
          at: "2026-05-16T00:04:00.000Z",
          details: { message: "Timed out after 240000ms" },
        },
      ],
    });

    expect(output.finalSessionState).toBe("timeout");
    expect(output.exitCode).toBe(124);
    expect(output.statusReason).toBe("Desktop run completion timed out after 240000ms");
    expect(output.milestones).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "timeout" })]),
    );
  });

  test("records Desktop E2E confirmation handling in JSON output", () => {
    const output = buildDesktopE2EOutput({
      finalSessionState: "complete",
      expectationsOk: true,
      confirmationMode: "yes",
      confirmations: [
        {
          id: "cfm-1",
          tool: "write_file",
          critical: false,
          mode: "yes",
          answer: true,
          method: "renderer-click",
          handled: true,
        },
      ],
    });

    expect(output.exitCode).toBe(0);
    expect(output.confirmationMode).toBe("yes");
    expect(output.confirmations).toEqual([
      expect.objectContaining({
        tool: "write_file",
        answer: true,
        method: "renderer-click",
        handled: true,
      }),
    ]);
  });

  test("builds a bounded relative file tree and omits ignored folders", () => {
    fs.mkdirSync(path.join(tmpRoot, "src"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, "src", "app.js"), "const value = 1;\n");
    fs.writeFileSync(path.join(tmpRoot, "node_modules", "dep.js"), "module.exports = {};\n");

    const tree = buildFileTree(tmpRoot, 10, 3);

    expect(tree).toMatchObject({ kind: "directory", path: "" });
    expect(tree.children.map((child) => child.name)).toContain("src");
    expect(tree.children.map((child) => child.name)).not.toContain("node_modules");
    expect(tree.children.find((child) => child.name === "src").children[0]).toMatchObject({
      name: "app.js",
      path: path.join("src", "app.js"),
      kind: "file",
      ext: "js",
    });
  });

  test("reads project file content and rejects traversal and symlink escapes", () => {
    const projectDir = path.join(tmpRoot, "project");
    const outsideDir = path.join(tmpRoot, "outside");
    fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "src", "app.js"), "const value = 1;\n");
    fs.writeFileSync(path.join(outsideDir, "secret.txt"), "secret\n");
    fs.symlinkSync(path.join(outsideDir, "secret.txt"), path.join(projectDir, "src", "secret-link.txt"));

    expect(readProjectFileContent(projectDir, path.join("src", "app.js"))).toMatchObject({
      ok: true,
      content: "const value = 1;\n",
      path: path.join("src", "app.js"),
    });
    expect(readProjectFileContent(projectDir, "../outside/secret.txt")).toMatchObject({
      ok: false,
      message: "Access denied.",
    });
    expect(readProjectFileContent(projectDir, path.join("src", "secret-link.txt"))).toMatchObject({
      ok: false,
      message: "Access denied.",
    });
  });

  test("file IPC handlers execute against the active project and preserve get-git-state", async () => {
    const handlers = {};
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
    const projectDir = path.join(tmpRoot, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "README.md"), "# Project\n");
    setDesktopProjectStateForTests({
      projectPath: projectDir,
      projectName: "project",
      projectBranch: "main",
      projectIsGit: false,
    });

    registerIpcHandlers();

    await expect(handlers["nex:get-file-content"](null, "README.md")).resolves.toMatchObject({
      ok: true,
      content: "# Project\n",
    });
    await expect(handlers["nex:get-file-content"](null, "../secret.txt")).resolves.toMatchObject({
      ok: false,
      message: "Access denied.",
    });
    await expect(handlers["nex:get-file-tree"]()).resolves.toMatchObject({
      ok: true,
      tree: expect.objectContaining({ kind: "directory" }),
    });
    await expect(handlers["nex:get-git-state"]()).resolves.toMatchObject({
      isGitRepository: false,
    });
  });

  test("captures tool-specific diffs without attributing pre-existing dirty files", () => {
    const projectDir = path.join(tmpRoot, "repo");
    fs.mkdirSync(projectDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectDir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectDir });
    fs.writeFileSync(path.join(projectDir, "existing.txt"), "before\n");
    fs.writeFileSync(path.join(projectDir, "target.txt"), "old\n");
    execFileSync("git", ["add", "."], { cwd: projectDir });
    execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: projectDir, stdio: "ignore" });
    fs.writeFileSync(path.join(projectDir, "existing.txt"), "dirty before tool\n");

    const before = captureGitWorktreeSnapshot(projectDir);
    fs.writeFileSync(path.join(projectDir, "target.txt"), "new\n");
    const after = captureGitWorktreeSnapshot(projectDir);
    const diff = readGitDiffBetweenTrees(projectDir, before.tree, after.tree);

    expect(diff.diff).toContain("target.txt");
    expect(diff.diff).toContain("+new");
    expect(diff.diff).not.toContain("existing.txt");
    expect(diff.diff).not.toContain("dirty before tool");
  });

  test("deduplicates inline diffs by full content hash instead of stat text", () => {
    const sent = [];
    const snapshots = [
      { ok: true, tree: "before-1" },
      { ok: true, tree: "after-1" },
      { ok: true, tree: "before-2" },
      { ok: true, tree: "after-2" },
      { ok: true, tree: "before-3" },
      { ok: true, tree: "after-3" },
    ];
    const diffs = {
      "before-1..after-1": {
        ok: true,
        stat: "file.txt | 2 +-",
        diff: "diff --git a/file.txt b/file.txt\n-old\n+new",
        hash: "hash-one",
      },
      "before-2..after-2": {
        ok: true,
        stat: "file.txt | 2 +-",
        diff: "diff --git a/file.txt b/file.txt\n-alpha\n+beta",
        hash: "hash-two",
      },
      "before-3..after-3": {
        ok: true,
        stat: "file.txt | 2 +-",
        diff: "diff --git a/file.txt b/file.txt\n-alpha\n+beta",
        hash: "hash-two",
      },
    };
    const tracker = createDiffEmissionTracker({
      send: (channel, payload) => sent.push({ channel, payload }),
      captureSnapshot: () => snapshots.shift(),
      readDiff: (_dir, beforeTree, afterTree) => diffs[`${beforeTree}..${afterTree}`],
    });

    tracker.captureStart({ id: "one", tool: "edit_file" }, tmpRoot);
    tracker.emitAfterTool({ id: "one", tool: "edit_file" }, tmpRoot);
    tracker.captureStart({ id: "two", tool: "edit_file" }, tmpRoot);
    tracker.emitAfterTool({ id: "two", tool: "edit_file" }, tmpRoot);
    tracker.captureStart({ id: "three", tool: "edit_file" }, tmpRoot);
    tracker.emitAfterTool({ id: "three", tool: "edit_file" }, tmpRoot);

    const diffEvents = sent.filter((entry) => entry.channel === "nex:server-diff");
    expect(diffEvents).toHaveLength(2);
    expect(diffEvents[0].payload.stat).toBe(diffEvents[1].payload.stat);
    expect(diffEvents[0].payload.diffHash).toBe("hash-one");
    expect(diffEvents[1].payload.diffHash).toBe("hash-two");
  });

  test("scopes Desktop edit diffs to the requested fitness template path", () => {
    const projectDir = path.join(tmpRoot, "jarvis-agent");
    const templatePath = path.join(projectDir, "web", "templates", "fitness");
    const logsPath = path.join(projectDir, "logs");
    fs.mkdirSync(templatePath, { recursive: true });
    fs.mkdirSync(logsPath, { recursive: true });
    execFileSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectDir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectDir });
    fs.writeFileSync(
      path.join(templatePath, "index.html"),
      '<div class="nutrition-ring-content">kcal</div>\n',
    );
    fs.writeFileSync(path.join(logsPath, ".audit.json"), '{"files":["old"]}\n');
    execFileSync("git", ["add", "."], { cwd: projectDir });
    execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: projectDir, stdio: "ignore" });

    const sent = [];
    const tracker = createDiffEmissionTracker({
      send: (channel, payload) => sent.push({ channel, payload }),
    });
    tracker.captureStart({
      id: "edit-template",
      tool: "edit_file",
      args: { path: "web/templates/fitness/index.html" },
    }, projectDir);
    fs.writeFileSync(
      path.join(templatePath, "index.html"),
      '<div class="nutrition-ring-content">Remaining 850 kcal</div>\n',
    );
    fs.writeFileSync(path.join(logsPath, ".audit.json"), '{"files":["new"]}\n');

    tracker.emitAfterTool({
      id: "edit-template",
      tool: "edit_file",
      ok: true,
      args: { path: "web/templates/fitness/index.html" },
    }, projectDir);

    const diffEvent = sent.find((entry) => entry.channel === "nex:server-diff");
    expect(diffEvent.payload.diff).toContain("web/templates/fitness/index.html");
    expect(diffEvent.payload.diff).toContain("Remaining 850 kcal");
    expect(diffEvent.payload.diff).not.toContain("logs/.audit.json");
  });

  test("scopes Desktop edit diffs to a neutral component path", () => {
    const projectDir = path.join(tmpRoot, "neutral-repo");
    const componentDir = path.join(projectDir, "src", "components");
    const historyDir = path.join(projectDir, ".nex", "history");
    fs.mkdirSync(componentDir, { recursive: true });
    fs.mkdirSync(historyDir, { recursive: true });
    execFileSync("git", ["init"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: projectDir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: projectDir });
    fs.writeFileSync(path.join(componentDir, "ProfileCard.jsx"), "export default function ProfileCard() {}\n");
    fs.writeFileSync(path.join(historyDir, "entry.json"), '{"tool":"edit_file"}\n');
    execFileSync("git", ["add", "."], { cwd: projectDir });
    execFileSync("git", ["commit", "-m", "Initial commit"], { cwd: projectDir, stdio: "ignore" });

    const sent = [];
    const tracker = createDiffEmissionTracker({
      send: (channel, payload) => sent.push({ channel, payload }),
    });
    tracker.captureStart({
      id: "edit-component",
      tool: "edit_file",
      args: { path: "src/components/ProfileCard.jsx" },
    }, projectDir);
    fs.writeFileSync(
      path.join(componentDir, "ProfileCard.jsx"),
      "export default function ProfileCard() { return <section>Ready</section>; }\n",
    );
    fs.writeFileSync(path.join(historyDir, "entry.json"), '{"tool":"edit_file","changed":true}\n');

    tracker.emitAfterTool({
      id: "edit-component",
      tool: "edit_file",
      ok: true,
      args: { path: "src/components/ProfileCard.jsx" },
    }, projectDir);

    const diffEvent = sent.find((entry) => entry.channel === "nex:server-diff");
    expect(diffEvent.payload.diff).toContain("src/components/ProfileCard.jsx");
    expect(diffEvent.payload.diff).toContain("Ready");
    expect(diffEvent.payload.diff).not.toContain(".nex/history/entry.json");
  });
});

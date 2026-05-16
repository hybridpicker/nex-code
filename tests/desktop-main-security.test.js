"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

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
  buildDesktopE2EOutput,
  classifyDesktopRunStatus,
  isDesktopE2EPromptAccepted,
  isDesktopE2ERendererReady,
  isSafeExternalUrl,
  isValidProjectPathInput,
  normalizeProjectPath,
  parseDesktopE2EConfirmMode,
  parseDesktopE2EOptions,
  registerIpcHandlers,
} = require("../desktop/main");
const { ipcMain } = require("electron");

describe("desktop main process IPC hardening", () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-desktop-main-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
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
});

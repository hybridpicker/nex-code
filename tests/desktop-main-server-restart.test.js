"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { PassThrough } = require("stream");

const mockSpawn = jest.fn();

jest.mock("child_process", () => {
  const actual = jest.requireActual("child_process");
  return {
    ...actual,
    spawn: mockSpawn,
  };
});

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
  sendToServer,
  setDesktopProjectStateForTests,
} = require("../desktop/main");

function createMockServerProcess() {
  const proc = new EventEmitter();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.stdin = { write: jest.fn() };
  proc.kill = jest.fn();
  proc.pid = 4242;
  return proc;
}

describe("desktop main process server restart", () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-desktop-restart-"));
    mockSpawn.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    setDesktopProjectStateForTests({
      projectPath: null,
      projectName: null,
      projectBranch: null,
      projectIsGit: false,
      serverProcess: null,
      serverReady: false,
    });
  });

  test("restarts the project server before sending a command", () => {
    const projectDir = path.join(tmpRoot, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    const serverProcess = createMockServerProcess();
    mockSpawn.mockReturnValue(serverProcess);
    setDesktopProjectStateForTests({
      projectPath: projectDir,
      projectName: "project",
      projectBranch: "main",
      projectIsGit: true,
      serverProcess: null,
      serverReady: false,
    });

    sendToServer({ type: "chat", id: "c-test", text: "Implement the change" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "node",
      expect.arrayContaining([expect.stringContaining("nex-code.js"), "--server"]),
      expect.objectContaining({ cwd: projectDir }),
    );
    expect(serverProcess.stdin.write).toHaveBeenCalledWith(
      `${JSON.stringify({ type: "chat", id: "c-test", text: "Implement the change" })}\n`,
    );
  });
});

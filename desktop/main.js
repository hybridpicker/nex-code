/**
 * desktop/main.js — Electron Main Process
 *
 * Manages the application window, spawns the nex-code CLI backend,
 * and bridges IPC between the renderer (Cyber-Obsidian UI) and
 * the nex-code agent logic.
 */

"use strict";

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow = null;
let nexProcess = null;
let sessionState = {
  project: null,
  branch: null,
  model: "auto (GPT-4o / Claude 3.5)",
  budget: { used: 1.42, limit: 10.0 },
  sessionHealth: "Excellent",
  tasks: [],
  activeTask: null,
  agenticNodes: [],
  testResults: { passed: 0, failed: 0, total: 0 },
  toolActions: [],
  costHistory: [],
};

// ─── Window Creation ─────────────────────────────────────────────────────────

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    title: "nex-code",
    backgroundColor: "#0D1117",
    titleBarStyle: "hiddenInset",
    vibrancy: "dark",
    visualEffectState: "active",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (process.argv.includes("--dev")) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Build application menu
  const menuTemplate = buildMenu();
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

function buildMenu() {
  const isMac = process.platform === "darwin";

  return [
    ...(isMac
      ? [
          {
            label: "nex-code",
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open Project...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              openProject(result.filePaths[0]);
            }
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Agent",
      submenu: [
        {
          label: "New Task",
          accelerator: "CmdOrCtrl+T",
          click: () => mainWindow.webContents.send("nex:focus-command"),
        },
        {
          label: "Plan Only",
          click: () => mainWindow.webContents.send("nex:command", "/plan"),
        },
        {
          label: "Implement Only",
          click: () => mainWindow.webContents.send("nex:command", "/impl"),
        },
        {
          label: "Verify Only",
          click: () => mainWindow.webContents.send("nex:command", "/verify"),
        },
        { type: "separator" },
        {
          label: "Start Orchestrator",
          click: () =>
            mainWindow.webContents.send("nex:command", "/orchestrate"),
        },
        {
          label: "Benchmark",
          click: () => mainWindow.webContents.send("nex:command", "/bench"),
        },
      ],
    },
    {
      label: "Git",
      submenu: [
        {
          label: "View Diff",
          accelerator: "CmdOrCtrl+D",
          click: () => mainWindow.webContents.send("nex:command", "/git diff"),
        },
        {
          label: "Show Status",
          click: () =>
            mainWindow.webContents.send("nex:command", "/git status"),
        },
        { type: "separator" },
        {
          label: "Create PR",
          click: () =>
            mainWindow.webContents.send("nex:command", "/deploy"),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () =>
            shell.openExternal("https://github.com/hybridpicker/nex-code"),
        },
        { type: "separator" },
        {
          label: "About nex-code Desktop",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About nex-code Desktop",
              message: "nex-code Desktop v1.0.0",
              detail:
                "Cyber-Obsidian coding assistant.\nOpen-model-first, multi-provider, agentic workflow.",
            });
          },
        },
      ],
    },
  ];
}

// ─── Project Management ──────────────────────────────────────────────────────

async function openProject(dirPath) {
  sessionState.project = path.basename(dirPath);
  process.chdir(dirPath);

  // Detect git branch
  try {
    const { execSync } = require("child_process");
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dirPath,
      encoding: "utf-8",
    }).trim();
    sessionState.branch = branch;
  } catch {
    sessionState.branch = null;
  }

  mainWindow.webContents.send("nex:project-opened", {
    project: sessionState.project,
    branch: sessionState.branch,
    path: dirPath,
  });

  // Scan repository
  try {
    const files = fs
      .readdirSync(dirPath, { recursive: true })
      .filter(
        (f) =>
          !f.startsWith(".git") &&
          !f.startsWith("node_modules") &&
          !f.startsWith("dist")
      )
      .slice(0, 500);
    mainWindow.webContents.send("nex:workspace-scan", {
      fileCount: files.length,
      files,
    });
  } catch {
    // silent
  }
}

// ─── Nex-code Backend Integration ────────────────────────────────────────────

function spawnNexBackend() {
  // In production, use the bundled CLI; in dev, use the local one
  const cliPath = path.join(__dirname, "..", "bin", "nex-code.js");

  if (!fs.existsSync(cliPath)) {
    console.warn("nex-code CLI not found at", cliPath, "— backend disabled");
    return;
  }

  nexProcess = spawn("node", [cliPath, "--server"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NEX_NO_COLOR: "1" },
  });

  let buffer = "";

  nexProcess.stdout.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        mainWindow?.webContents.send("nex:backend-message", msg);
      } catch {
        // non-JSON line (e.g., banner), forward as log
        mainWindow?.webContents.send("nex:backend-log", line);
      }
    }
  });

  nexProcess.stderr.on("data", (data) => {
    mainWindow?.webContents.send("nex:backend-error", data.toString());
  });

  nexProcess.on("close", (code) => {
    mainWindow?.webContents.send("nex:backend-closed", code);
    nexProcess = null;
    // Auto-restart after 1 second
    setTimeout(spawnNexBackend, 1000);
  });
}

function sendToBackend(command) {
  if (nexProcess && nexProcess.stdin.writable) {
    nexProcess.stdin.write(JSON.stringify(command) + "\n");
  } else {
    // Backend not available — notify the renderer so the UI stays responsive
    mainWindow?.webContents.send("nex:backend-log",
      `[nex-code] Command queued (backend unavailable): ${JSON.stringify(command)}`);
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function setupIPC() {
  // Renderer requests initial state
  ipcMain.handle("nex:get-state", () => sessionState);

  // Renderer sends a command
  ipcMain.on("nex:command", (_event, command) => {
    handleCommand(command);
  });

  // Renderer requests project open
  ipcMain.handle("nex:open-project", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // External link handler
  ipcMain.on("nex:open-external", (_event, url) => {
    shell.openExternal(url);
  });

  // Window controls
  ipcMain.on("nex:window-minimize", () => mainWindow?.minimize());
  ipcMain.on("nex:window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("nex:window-close", () => mainWindow?.close());
}

async function handleCommand(command) {
  const cmd = command.trim();
  if (!cmd) return;

  // Always acknowledge the command immediately
  mainWindow?.webContents.send("nex:backend-log", `[nex-code] ${cmd}`);

  if (cmd.startsWith("/")) {
    sendToBackend({ type: "command", command: cmd });
  } else {
    mainWindow?.webContents.send("nex:agent-thinking", { prompt: cmd });
    addAgenticNode("PLAN", `Analyzing: "${cmd}"`, "cyan");
    sendToBackend({ type: "task", prompt: cmd });
  }
}

function addAgenticNode(phase, detail, color) {
  const node = {
    id: Date.now().toString(),
    phase,
    detail,
    color,
    timestamp: new Date().toISOString(),
    status: "active",
  };
  sessionState.agenticNodes.push(node);
  mainWindow?.webContents.send("nex:agentic-node", node);
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  setupIPC();
  createWindow();
  spawnNexBackend();

  // Auto-open last project
  const lastProjectPath = path.join(
    app.getPath("userData"),
    "last-project.json"
  );
  try {
    if (fs.existsSync(lastProjectPath)) {
      const { projectPath } = JSON.parse(
        fs.readFileSync(lastProjectPath, "utf-8")
      );
      if (projectPath && fs.existsSync(projectPath)) {
        openProject(projectPath);
      }
    }
  } catch {
    // silent
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("before-quit", () => {
  if (nexProcess) {
    nexProcess.kill();
    nexProcess = null;
  }

  // Save last project
  if (sessionState.project) {
    const lastProjectPath = path.join(
      app.getPath("userData"),
      "last-project.json"
    );
    try {
      fs.writeFileSync(
        lastProjectPath,
        JSON.stringify({ projectPath: process.cwd() })
      );
    } catch {
      // silent
    }
  }
});

// ─── Simulated Data for UI Demo ──────────────────────────────────────────────

// When backend is not available, provide realistic demo data
ipcMain.handle("nex:get-demo-data", () => {
  return {
    project: "orbit-control",
    branch: "feat/telemetry-refactor",
    model: "auto (GPT-4o / Claude 3.5)",
    sessionHealth: "Excellent",
    budget: { used: 1.42, limit: 10.0 },
    tokens: { used: 312400, limit: 1000000 },
    requests: 158,
    workspaces: [
      "orbit-control",
      "nex-code",
      "api-gateway",
      "dashboard-v2",
    ],
    agenticNodes: [
      {
        id: "n1",
        phase: "PLAN",
        detail: "Repository scan & analysis",
        color: "cyan",
        status: "complete",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        extras: {
          filesScanned: 247,
          diff: { added: 142, modified: 38, removed: 12 },
          relevantFiles: [
            "src/telemetry/collector.ts",
            "src/telemetry/buffer.ts",
            "src/telemetry/exporters/otlp.ts",
          ],
        },
      },
      {
        id: "n2",
        phase: "IMPLEMENT",
        detail: "Telemetry refactor — batch processing",
        color: "emerald",
        status: "complete",
        timestamp: new Date(Date.now() - 180000).toISOString(),
        extras: {
          files: [
            { name: "src/telemetry/collector.ts", progress: 100 },
            { name: "src/telemetry/buffer.ts", progress: 100 },
            { name: "src/telemetry/exporters/otlp.ts", progress: 100 },
            { name: "tests/telemetry.test.ts", progress: 100 },
          ],
          formatters: ["Prettier ✓", "ESLint ✓", "TypeScript ✓"],
        },
      },
      {
        id: "n3",
        phase: "VERIFY",
        detail: "Unit tests & benchmarks",
        color: "teal",
        status: "complete",
        timestamp: new Date(Date.now() - 60000).toISOString(),
        extras: {
          tests: { passed: 109, failed: 0, total: 109 },
          benchmark: { metric: "telemetry throughput", value: 1420, unit: "ops/s" },
        },
      },
    ],
    testResults: { passed: 109, failed: 0, total: 109 },
    branchSafety: { score: 98, status: "Safe to merge" },
    toolActions: [
      { tool: "repo.scan", detail: "Scanned 247 files", time: "2s ago" },
      { tool: "file.read", detail: "src/telemetry/collector.ts", time: "5s ago" },
      { tool: "file.write", detail: "src/telemetry/buffer.ts (+34, -8)", time: "8s ago" },
      { tool: "shell.exec", detail: "npm run test -- --coverage", time: "12s ago" },
      { tool: "git.diff", detail: "3 files changed", time: "15s ago" },
      { tool: "git.status", detail: "feat/telemetry-refactor", time: "18s ago" },
    ],
    costHistory: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      tokens: Math.floor(Math.random() * 15000 + 5000),
      cost: parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)),
    })),
    recentSessions: [
      { name: "telemetry-refactor", tokens: "12.4k", time: "2h ago", model: "claude-3.5" },
      { name: "api-rate-limiting", tokens: "8.1k", time: "5h ago", model: "gpt-4o" },
      { name: "dashboard-perf", tokens: "23.7k", time: "1d ago", model: "devstral-2" },
    ],
    shortcutChips: ["/plan", "/impl", "/verify", "/bench", "/git", "/deploy"],
  };
});

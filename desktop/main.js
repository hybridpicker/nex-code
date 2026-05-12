/**
 * desktop/main.js — Electron Main Process
 *
 * Spawns the real nex-code CLI via --server mode (JSON-lines IPC).
 * No project → welcome screen. Open project → nex-code --server.
 */

"use strict";

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require("electron");
const path = require("path");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const readline = require("readline");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

let mainWindow = null;
let serverProcess = null;
let serverReady = false;
let projectName = null;
let projectBranch = null;
let projectPath = null;
let projectIsGit = false;
let projectIsDeployable = false;
let activeModelSpecOverride = null;

function getNexCliPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, "nex-code-cli", "nex-code.js");
  return path.join(__dirname, "..", "dist", "nex-code.js");
}

function getAppIconPath() {
  return path.join(__dirname, "renderer", "assets", "icon.png");
}

function getInitialProjectPath() {
  const idx = process.argv.indexOf("--open-project");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.NEX_DESKTOP_OPEN_PROJECT || null;
}

function applyAppIcon() {
  const iconPath = getAppIconPath();
  if (!fs.existsSync(iconPath)) return null;

  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === "darwin" && app.dock && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }
  return iconPath;
}

function getProviderRegistry() {
  try {
    return require(path.join(__dirname, "..", "cli", "providers", "registry"));
  } catch (e) {
    return null;
  }
}

function getProviderSetup(providerName) {
  const setup = {
    ollama: {
      label: "Ollama Cloud",
      env: "OLLAMA_API_KEY",
      action: "Run /setup or set OLLAMA_API_KEY.",
    },
    local: {
      label: "Ollama Local",
      env: "Local Ollama daemon",
      action: "Install Ollama, run ollama serve, then pull a coding model.",
      url: "https://ollama.com/download",
    },
    deepseek: {
      label: "DeepSeek",
      env: "DEEPSEEK_API_KEY",
      action: "Set DEEPSEEK_API_KEY or run /setup.",
    },
    gemini: {
      label: "Gemini",
      env: "GEMINI_API_KEY",
      action: "Set GEMINI_API_KEY or run /setup.",
    },
    openai: {
      label: "OpenAI",
      env: "OPENAI_API_KEY",
      action: "Set OPENAI_API_KEY or run /setup.",
    },
    anthropic: {
      label: "Anthropic",
      env: "ANTHROPIC_API_KEY",
      action: "Set ANTHROPIC_API_KEY or run /setup.",
    },
    mock: {
      label: "Mock",
      env: "NEX_MOCK_PROVIDER=1",
      action: "Enable NEX_MOCK_PROVIDER=1 for local development.",
    },
  };
  return setup[providerName] || {
    label: providerName,
    env: "Provider configuration",
    action: "Configure this provider before use.",
  };
}

async function buildModelState() {
  const registry = getProviderRegistry();
  if (!registry) {
    return {
      activeModel: null,
      routerMode: "Unavailable",
      readyModels: [],
      providers: [],
      hasConfiguredModel: false,
      error: "Provider registry is not available in this desktop build.",
    };
  }

  try {
    const localProvider = registry.getProvider("local");
    if (localProvider && typeof localProvider.loadModels === "function") {
      try { await localProvider.loadModels(); } catch (e) {}
    }
  } catch (e) {}

  const activeProvider = registry.getActiveProviderName();
  const activeModelId = registry.getActiveModelId();
  const activeModel = registry.getActiveModel();
  const providerGroups = registry.listProviders();
  const providers = providerGroups.map((group) => {
    const setup = getProviderSetup(group.provider);
    const models = (group.models || []).map((model) => ({
      id: model.id,
      name: model.name || model.id,
      spec: `${group.provider}:${model.id}`,
      active: group.provider === activeProvider && model.id === activeModelId,
      capability: model.capability || "",
      speed: model.speed || "",
      quality: model.quality || "",
      contextWindow: model.contextWindow || model.maxTokens || null,
    }));
    const hasModels = models.length > 0;
    const ready = group.provider === "local"
      ? group.configured && hasModels
      : group.configured && hasModels;
    return {
      name: group.provider,
      label: setup.label,
      configured: !!group.configured,
      ready: !!ready,
      disabledReason: ready ? "" : getProviderDisabledReason(group.provider, group.configured, hasModels),
      env: setup.env,
      setupAction: setup.action,
      setupUrl: setup.url || "",
      models: models,
    };
  });
  const readyModels = providers.flatMap((provider) =>
    provider.ready ? provider.models.map((model) => ({ ...model, provider: provider.name, providerLabel: provider.label })) : [],
  );
  const activeSpec = activeProvider && activeModelId ? `${activeProvider}:${activeModelId}` : null;

  return {
    activeModel: activeModelId ? {
      id: activeModelId,
      name: activeModel && activeModel.name ? activeModel.name : activeModelId,
      provider: activeProvider,
      providerLabel: getProviderSetup(activeProvider).label,
      spec: activeSpec,
      ready: readyModels.some((model) => model.spec === activeSpec),
    } : null,
    routerMode: process.env.NEX_PHASE_ROUTING === "0" ? "Manual model" : "Phase routing",
    readyModels: readyModels,
    providers: providers,
    hasConfiguredModel: readyModels.length > 0,
    setupHint: readyModels.length > 0
      ? ""
      : "Run /setup for the guided provider setup, or install Ollama locally and pull a coding model.",
  };
}

function getProviderDisabledReason(providerName, configured, hasModels) {
  if (providerName === "local") {
    if (!hasModels) return "Ollama Local has no installed models yet.";
    return "Ollama Local is not reachable.";
  }
  if (!configured) return `${getProviderSetup(providerName).env} is not configured.`;
  if (!hasModels) return "No models are available for this provider.";
  return "";
}

function applyActiveModelEnv(env) {
  if (!activeModelSpecOverride) return env;
  const registry = getProviderRegistry();
  if (!registry) return env;
  const parsed = registry.parseModelSpec(activeModelSpecOverride);
  if (!parsed || !parsed.model) return env;
  const next = Object.assign({}, env, { DEFAULT_MODEL: parsed.model });
  if (parsed.provider) next.DEFAULT_PROVIDER = parsed.provider;
  return next;
}

function spawnServer(dirPath) {
  killServer();
  const cliPath = getNexCliPath();
  if (!fs.existsSync(cliPath)) {
    send("nex:server-error", { message: "nex-code CLI not found. Run npm run build in project root." });
    return;
  }
  serverProcess = spawn("node", [cliPath, "--server"], {
    cwd: dirPath, stdio: ["pipe", "pipe", "pipe"],
    env: applyActiveModelEnv(Object.assign({}, process.env, { NEX_SERVER: "1", FORCE_COLOR: "0" })),
  });
  serverReady = false;
  const rl = readline.createInterface({ input: serverProcess.stdout, terminal: false });
  rl.on("line", function (line) {
    try { handleMsg(JSON.parse(line.trim())); } catch (e) {}
  });
  serverProcess.stderr.on("data", function (d) {
    send("nex:server-log", { text: d.toString().trim() });
  });
  serverProcess.on("close", function (code) {
    serverProcess = null; serverReady = false;
    send("nex:server-closed", { code: code });
  });
  serverProcess.on("error", function (e) {
    send("nex:server-error", { message: e.message });
  });
}

function killServer() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
    serverProcess = null;
    serverReady = false;
  }
}

function handleMsg(msg) {
  if (msg.type === "ready") { serverReady = true; send("nex:server-ready", {}); return; }
  if (msg.type === "token") { send("nex:server-token", msg); return; }
  if (msg.type === "tool_start") { send("nex:server-tool-start", msg); return; }
  if (msg.type === "tool_end") { send("nex:server-tool-end", msg); return; }
  if (msg.type === "confirm_request") { send("nex:server-confirm", msg); return; }
  if (msg.type === "done") { send("nex:server-done", msg); return; }
  if (msg.type === "error") { send("nex:server-error", msg); return; }
  
  // Fallback for other message types
  var ch = "nex:server-" + msg.type.replace(/_/g, "-");
  send(ch, msg);
}

function send(ch, data) {
  try { if (mainWindow && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(ch, data); } catch (e) {}
}

function sendToServer(obj) {
  if (!serverProcess) {
    send("nex:server-error", { message: "No project open. Use File → Open Project." });
    return;
  }
  serverProcess.stdin.write(JSON.stringify(obj) + "\n");
}

function createWindow() {
  const iconPath = applyAppIcon();
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 1200, minHeight: 800,
    title: "nex-code", backgroundColor: "#0D1117",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    vibrancy: isMac ? "dark" : undefined,
    visualEffectState: isMac ? "active" : undefined,
    icon: iconPath || undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    show: false,
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.on("did-finish-load", function () {
    mainWindow.webContents.send("nex:platform", { platform: process.platform });
  });
  mainWindow.once("ready-to-show", function () {
    mainWindow.show();
    if (process.argv.includes("--dev")) mainWindow.webContents.openDevTools({ mode: "detach" });
  });
  mainWindow.on("closed", function () { killServer(); mainWindow = null; });

  var template = [];
  if (isMac) template.push({ label: "nex-code", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] });
  template.push({ label: "File", submenu: [{ label: "Open Project...", accelerator: "CmdOrCtrl+O", click: openDialog }, { type: "separator" }, { role: "quit" }] });
  template.push({ label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openDialog() {
  var r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"], title: "Open Project" });
  if (!r.canceled && r.filePaths.length > 0) await openProject(r.filePaths[0]);
}

async function readGitState(dirPath) {
  const state = {
    branch: null,
    isGitRepository: false,
    branches: [],
    dirty: false,
    disabledReason: "",
  };
  if (!dirPath) {
    state.disabledReason = "No project is open.";
    return state;
  }
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: dirPath });
    state.isGitRepository = true;
  } catch (e) {
    state.disabledReason = "The open project is not a Git repository.";
    return state;
  }
  try {
    const current = await execFileAsync("git", ["branch", "--show-current"], { cwd: dirPath });
    state.branch = current.stdout.trim() || "detached";
  } catch (e) {
    state.branch = "unknown";
  }
  try {
    const branches = await execFileAsync("git", ["branch", "--format", "%(refname:short)"], { cwd: dirPath });
    state.branches = branches.stdout.split(/\r?\n/).map((branch) => branch.trim()).filter(Boolean);
  } catch (e) {
    state.branches = [];
  }
  try {
    const status = await execFileAsync("git", ["status", "--short"], { cwd: dirPath });
    state.dirty = status.stdout.trim().length > 0;
  } catch (e) {
    state.dirty = false;
  }
  return state;
}

async function refreshProjectGitState() {
  const state = await readGitState(projectPath);
  projectIsGit = state.isGitRepository;
  projectBranch = state.branch;
  send("nex:git-state", state);
  send("nex:state-updated", {
    branch: projectBranch,
    isGitRepository: projectIsGit,
  });
  return state;
}

async function openProject(dirPath) {
  projectPath = dirPath;
  projectName = path.basename(dirPath);
  projectBranch = null;
  projectIsGit = false;
  projectIsDeployable = false;
  const gitState = await readGitState(dirPath);
  projectIsGit = gitState.isGitRepository;
  projectBranch = gitState.branch;
  try {
    projectIsDeployable = fs.existsSync(path.join(dirPath, ".nex", "deploy.json"));
  } catch (e) {}
  spawnServer(dirPath);
  send("nex:project-opened", {
    project: projectName,
    branch: projectBranch || "unknown",
    path: dirPath,
    isGitRepository: projectIsGit,
    isDeployable: projectIsDeployable,
    gitState: gitState,
  });
}

ipcMain.handle("nex:get-state", async function () {
  return {
    project: projectName,
    branch: projectBranch,
    path: projectPath,
    serverReady: serverReady,
    isGitRepository: projectIsGit,
    isDeployable: projectIsDeployable,
    modelState: await buildModelState(),
    gitState: await readGitState(projectPath),
  };
});
ipcMain.handle("nex:open-project", async function () { await openDialog(); return null; });
ipcMain.handle("nex:open-project-path", async function (_e, dirPath) {
  if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    send("nex:server-error", { message: "Recent project path is not available." });
    return null;
  }
  await openProject(dirPath);
  return null;
});
ipcMain.handle("nex:get-model-state", async function () {
  return await buildModelState();
});
ipcMain.handle("nex:set-active-model", async function (_e, spec) {
  const registry = getProviderRegistry();
  if (!registry || !spec) return { ok: false, message: "Provider registry is not available." };
  const ok = registry.setActiveModel(spec);
  if (!ok) return { ok: false, message: "Model is not available." };
  activeModelSpecOverride = spec;
  const parsed = registry.parseModelSpec(spec);
  if (parsed && parsed.model) {
    process.env.DEFAULT_MODEL = parsed.model;
    if (parsed.provider) process.env.DEFAULT_PROVIDER = parsed.provider;
  }
  if (serverProcess) {
    sendToServer({ type: "chat", id: "model-" + Date.now(), text: `/model ${spec}` });
  }
  const modelState = await buildModelState();
  send("nex:model-state", modelState);
  send("nex:state-updated", { model: modelState.activeModel ? modelState.activeModel.id : null, modelState: modelState });
  return { ok: true, modelState: modelState };
});
ipcMain.handle("nex:get-git-state", async function () {
  return await readGitState(projectPath);
});
ipcMain.handle("nex:checkout-branch", async function (_e, branchName) {
  if (!projectPath) return { ok: false, message: "No project is open." };
  if (!projectIsGit) return { ok: false, message: "The open project is not a Git repository." };
  if (!/^[A-Za-z0-9._/-]+$/.test(branchName || "")) return { ok: false, message: "Invalid branch name." };
  const state = await readGitState(projectPath);
  if (state.dirty) return { ok: false, message: "Commit or stash local changes before switching branches." };
  await execFileAsync("git", ["checkout", branchName], { cwd: projectPath });
  const next = await refreshProjectGitState();
  return { ok: true, gitState: next };
});
ipcMain.handle("nex:create-branch", async function (_e, branchName) {
  if (!projectPath) return { ok: false, message: "No project is open." };
  if (!projectIsGit) return { ok: false, message: "The open project is not a Git repository." };
  if (!/^[A-Za-z0-9._/-]+$/.test(branchName || "")) return { ok: false, message: "Use letters, numbers, dots, slashes, underscores, or hyphens." };
  const state = await readGitState(projectPath);
  if (state.dirty) return { ok: false, message: "Commit or stash local changes before creating a branch." };
  await execFileAsync("git", ["checkout", "-b", branchName], { cwd: projectPath });
  const next = await refreshProjectGitState();
  return { ok: true, gitState: next };
});
ipcMain.on("nex:command", function (_e, cmd) { sendToServer({ type: "chat", id: "c-" + Date.now(), text: cmd.trim() }); });
ipcMain.on("nex:confirm-answer", function (_e, d) { sendToServer({ type: "confirm", id: d.id, answer: d.answer }); });
ipcMain.on("nex:cancel", function () { sendToServer({ type: "cancel" }); });
ipcMain.on("nex:clear", function () { sendToServer({ type: "clear" }); });
ipcMain.on("nex:open-external", function (_e, url) { shell.openExternal(url); });

app.whenReady().then(function () {
  createWindow();
  const initialProject = getInitialProjectPath();
  if (initialProject && fs.existsSync(initialProject) && fs.statSync(initialProject).isDirectory()) {
    openProject(initialProject);
  }
});
app.on("window-all-closed", function () { killServer(); if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", killServer);

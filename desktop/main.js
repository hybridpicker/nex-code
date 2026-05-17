/**
 * desktop/main.js — Electron Main Process
 *
 * Spawns the real nex-code CLI via --server mode (JSON-lines IPC).
 * No project → welcome screen. Open project → nex-code --server.
 */

"use strict";

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require("electron");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const readline = require("readline");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:", "http:"]);

let mainWindow = null;
let serverProcess = null;
let serverReady = false;
let projectName = null;
let projectBranch = null;
let projectPath = null;
let projectIsGit = false;
let projectIsDeployable = false;
let activeModelSpecOverride = null;
let e2eRunStarted = false;

function resolveDebugSessionDir(env) {
  const sourceEnv = env || process.env;
  const explicit = sourceEnv.NEX_CODE_APP_DEBUG_SESSION_DIR
    || sourceEnv.NEX_CODE_DEBUG_SESSION_DIR
    || sourceEnv.NEX_DESKTOP_DEBUG_SESSION_DIR
    || null;
  if (explicit) return path.resolve(explicit);

  const stateDir = sourceEnv.NEX_CODE_APP_STATE_DIR || sourceEnv.NEX_DESKTOP_STATE_DIR || null;
  if (!stateDir) return null;
  const resolvedState = path.resolve(stateDir);
  if (path.basename(resolvedState) !== "state") return null;
  const parent = path.dirname(resolvedState);
  if (!/^session-\d{8}-\d{6}$/.test(path.basename(parent))) return null;
  return parent;
}

const debugSessionDir = resolveDebugSessionDir(process.env);
let debugRunId = null;

function ensureDebugSession() {
  if (!debugSessionDir) return null;
  try {
    fs.mkdirSync(debugSessionDir, { recursive: true });
    if (!debugRunId) debugRunId = new Date().toISOString().replace(/[:.]/g, "-");
    return debugSessionDir;
  } catch (e) {
    return null;
  }
}

function appendDebugJsonl(fileName, entry) {
  const dir = ensureDebugSession();
  if (!dir) return;
  const payload = Object.assign({
    at: new Date().toISOString(),
    runId: debugRunId,
  }, entry || {});
  try {
    fs.appendFileSync(path.join(dir, fileName), `${JSON.stringify(payload)}\n`, "utf8");
  } catch (e) {}
}

function writeDebugSummary(extra) {
  const dir = ensureDebugSession();
  if (!dir) return;
  const summary = Object.assign({
    runId: debugRunId,
    pid: process.pid,
    appDir: path.resolve(__dirname, ".."),
    projectPath: projectPath,
    projectName: projectName,
    projectBranch: projectBranch,
    projectIsGit: projectIsGit,
    projectIsDeployable: projectIsDeployable,
    serverPid: serverProcess ? serverProcess.pid : null,
    serverReady: serverReady,
    updatedAt: new Date().toISOString(),
  }, extra || {});
  try {
    fs.writeFileSync(path.join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  } catch (e) {}
}

function writeDebugExit(reason, code) {
  const dir = ensureDebugSession();
  if (!dir) return;
  const lines = [
    `finished_at=${new Date().toISOString()}`,
    `reason=${reason || "unknown"}`,
    `exit_code=${code === null || code === undefined ? "" : code}`,
    "",
  ];
  try {
    fs.writeFileSync(path.join(dir, "exit.txt"), lines.join("\n"), "utf8");
  } catch (e) {}
}

function recordDebugEvent(type, details) {
  if (!debugSessionDir) return;
  appendDebugJsonl("desktop-events.jsonl", Object.assign({ type: type }, details || {}));
  writeDebugSummary({ lastEvent: type });
}

function getArgValue(argv, name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  const value = argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function getArgValues(argv, name) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      values.push(argv[i + 1]);
      i += 1;
    }
  }
  return values;
}

function parseTimeoutMs(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseDesktopE2EConfirmMode(argv, env) {
  const args = Array.isArray(argv) ? argv : [];
  const sourceEnv = env || {};
  if (args.includes("--auto-confirm") || sourceEnv.NEX_DESKTOP_E2E_AUTO_CONFIRM === "1") {
    return "yes";
  }
  const value = getArgValue(args, "--confirm") || sourceEnv.NEX_DESKTOP_E2E_CONFIRM || "";
  const normalized = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "allow", "approve"].includes(normalized)) return "yes";
  if (["no", "n", "false", "deny", "reject"].includes(normalized)) return "no";
  return "manual";
}

function parseDesktopE2EOptions(argv, env) {
  const args = Array.isArray(argv) ? argv : [];
  const sourceEnv = env || {};
  const enabled = args.includes("--e2e") || sourceEnv.NEX_DESKTOP_E2E === "1";
  if (!enabled) return { enabled: false };

  const promptFile = getArgValue(args, "--prompt-file") || sourceEnv.NEX_DESKTOP_E2E_PROMPT_FILE || null;
  const prompt = getArgValue(args, "--prompt") || sourceEnv.NEX_DESKTOP_E2E_PROMPT || null;
  const openProject = getArgValue(args, "--open-project") || sourceEnv.NEX_DESKTOP_OPEN_PROJECT || null;
  const model = getArgValue(args, "--model") || sourceEnv.NEX_DESKTOP_E2E_MODEL || null;
  const confirmMode = parseDesktopE2EConfirmMode(args, sourceEnv);
  const stateDir = sourceEnv.NEX_CODE_APP_STATE_DIR
    || getArgValue(args, "--state-dir")
    || fs.mkdtempSync(path.join(os.tmpdir(), "nex-code-app-e2e-"));

  return {
    enabled: true,
    openProject: openProject,
    promptFile: promptFile,
    prompt: prompt,
    model: model,
    timeoutMs: parseTimeoutMs(getArgValue(args, "--timeout-ms") || sourceEnv.NEX_DESKTOP_E2E_TIMEOUT_MS, 180000),
    json: args.includes("--json") || sourceEnv.NEX_DESKTOP_E2E_JSON === "1",
    expectFiles: getArgValues(args, "--expect-file").concat(
      sourceEnv.NEX_DESKTOP_E2E_EXPECT_FILE
        ? sourceEnv.NEX_DESKTOP_E2E_EXPECT_FILE.split(path.delimiter).filter(Boolean)
        : [],
    ),
    expectContains: getArgValues(args, "--expect-contains"),
    expectNotContains: getArgValues(args, "--expect-not-contains"),
    confirmMode: confirmMode,
    autoConfirm: confirmMode !== "manual",
    stateDir: stateDir,
  };
}

const desktopE2EOptions = parseDesktopE2EOptions(process.argv.slice(2), process.env);
const desktopE2EResult = {
  logs: [],
  errors: [],
  milestones: [],
  toolActions: [],
  confirmations: [],
  serverCommands: [],
  assistantText: "",
  finalSessionState: "idle",
  lastAction: null,
};

if (desktopE2EOptions.enabled) {
  if (desktopE2EOptions.model) activeModelSpecOverride = desktopE2EOptions.model;
  app.setPath("userData", desktopE2EOptions.stateDir);
  app.commandLine.appendSwitch("disable-gpu");
}

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

function shortenPrompt(prompt) {
  const normalized = String(prompt || "").trim().replace(/\s+/g, " ");
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157)}...`;
}

function hashPrompt(prompt) {
  return crypto.createHash("sha256").update(String(prompt || "")).digest("hex");
}

function getAppBuildInfo() {
  const rootDir = path.resolve(__dirname, "..");
  const pkgPath = path.join(rootDir, "package.json");
  let version = null;
  try {
    version = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version || null;
  } catch (e) {}

  let commit = null;
  try {
    const result = execFileSyncSafe("git", ["rev-parse", "HEAD"], rootDir);
    commit = result.ok ? result.stdout.trim() : null;
  } catch (e) {}

  return {
    version: version,
    commit: commit,
  };
}

function execFileSyncSafe(command, args, cwd) {
  try {
    const result = require("child_process").execFileSync(command, args, {
      cwd: cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout: result, stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ? String(error.stdout) : "",
      stderr: error.stderr ? String(error.stderr) : (error.message || String(error)),
    };
  }
}

function readGitStatusSync(dirPath) {
  if (!dirPath) return { isGitRepository: false, status: null, head: null, error: "No project path." };
  const inside = execFileSyncSafe("git", ["rev-parse", "--is-inside-work-tree"], dirPath);
  if (!inside.ok) return { isGitRepository: false, status: null, head: null, error: inside.stderr.trim() };
  const status = execFileSyncSafe("git", ["status", "--short"], dirPath);
  const head = execFileSyncSafe("git", ["rev-parse", "HEAD"], dirPath);
  const branch = execFileSyncSafe("git", ["branch", "--show-current"], dirPath);
  return {
    isGitRepository: true,
    branch: branch.ok ? branch.stdout.trim() : null,
    head: head.ok ? head.stdout.trim() : null,
    status: status.ok ? status.stdout.trim() : null,
    dirty: status.ok ? status.stdout.trim().length > 0 : null,
    error: status.ok ? null : status.stderr.trim(),
  };
}

function readPromptForE2E(options) {
  if (options.promptFile) return fs.readFileSync(options.promptFile, "utf8").trim();
  if (options.prompt) return String(options.prompt).trim();
  throw new Error("--e2e requires --prompt-file or --prompt.");
}

function classifyDesktopRunStatus(result) {
  if (!result) return { state: "error", exitCode: 1, reason: "No E2E result." };
  if (result.timedOut) return { state: "timeout", exitCode: 124, reason: result.lastAction || "Timed out." };
  if (result.error) return { state: "error", exitCode: 1, reason: result.error };
  if (result.expectationsOk === false) {
    return { state: "error", exitCode: 1, reason: "One or more Desktop E2E expectations failed." };
  }
  if (result.finalSessionState === "complete" && result.expectationsOk !== false) {
    return { state: "complete", exitCode: 0, reason: "Desktop run completed." };
  }
  if (result.finalSessionState === "stalled") return { state: "stalled", exitCode: 2, reason: result.lastAction || "Run stalled." };
  if (result.finalSessionState === "timeout") return { state: "timeout", exitCode: 124, reason: result.lastAction || "Timed out." };
  return { state: result.finalSessionState || "error", exitCode: 1, reason: result.lastAction || "Desktop run failed." };
}

function addDesktopE2EMilestone(name, details) {
  if (!desktopE2EOptions.enabled) return null;
  const entry = {
    name: name,
    at: new Date().toISOString(),
  };
  if (details !== undefined) entry.details = details;
  desktopE2EResult.milestones.push(entry);
  return entry;
}

function hasDesktopE2EMilestone(name) {
  return desktopE2EResult.milestones.some((entry) => entry && entry.name === name);
}

function isDesktopE2ERendererReady(snapshot) {
  if (!snapshot) return false;
  return snapshot.inputPresent === true
    && snapshot.submitPresent === true
    && snapshot.inputDisabled !== true
    && snapshot.submitDisabled !== true
    && snapshot.commandInputReady === true
    && snapshot.projectOpen === true
    && snapshot.nexApiPresent === true;
}

function isDesktopE2EPromptAccepted(before, after) {
  const prior = before || {};
  const next = after || {};
  if (next.serverCommandCount > prior.serverCommandCount) return true;
  if (next.userConversationCount > prior.userConversationCount) return true;
  if (prior.sessionState !== "running" && next.sessionState === "running") return true;
  return false;
}

function isValidProjectPathInput(dirPath) {
  return typeof dirPath === "string" && dirPath.trim() !== "" && !dirPath.includes("\0");
}

function normalizeProjectPath(dirPath) {
  if (!isValidProjectPathInput(dirPath)) return null;
  let resolved;
  try {
    resolved = path.resolve(dirPath);
  } catch (e) {
    return null;
  }
  try {
    const realPath = fs.realpathSync(resolved);
    if (!fs.statSync(realPath).isDirectory()) return null;
    return realPath;
  } catch (e) {
    return null;
  }
}

function isSafeExternalUrl(url) {
  if (typeof url !== "string" || url.trim() === "") return false;
  try {
    const parsed = new URL(url);
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch (e) {
    return false;
  }
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
  recordDebugEvent("server-spawned", { cwd: dirPath, cliPath: cliPath, pid: serverProcess.pid });
  serverReady = false;
  const rl = readline.createInterface({ input: serverProcess.stdout, terminal: false });
  rl.on("line", function (line) {
    try {
      const msg = JSON.parse(line.trim());
      appendDebugJsonl("server-events.jsonl", {
        type: "server-message",
        messageType: msg.type || null,
        message: msg,
      });
      handleMsg(msg);
    } catch (e) {}
  });
  serverProcess.stderr.on("data", function (d) {
    const text = d.toString().trim();
    if (desktopE2EOptions.enabled && text) desktopE2EResult.logs.push(text);
    if (text) appendDebugJsonl("server-events.jsonl", { type: "stderr", text: text });
    send("nex:server-log", { text: text });
  });
  serverProcess.on("close", function (code) {
    serverProcess = null; serverReady = false;
    recordDebugEvent("server-closed", { code: code });
    send("nex:server-closed", { code: code });
  });
  serverProcess.on("error", function (e) {
    recordDebugEvent("server-error", { message: e.message });
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
  recordDesktopE2EServerEvent(msg);
  if (msg.type === "ready") { serverReady = true; addDesktopE2EMilestone("server-ready"); send("nex:server-ready", {}); return; }
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

function recordDesktopE2EServerEvent(msg) {
  if (!desktopE2EOptions.enabled || !msg || !msg.type) return;
  if (msg.type === "token") {
    if (!hasDesktopE2EMilestone("first-token")) addDesktopE2EMilestone("first-token");
    desktopE2EResult.assistantText += String(msg.text || "");
    return;
  }
  if (msg.type === "tool_start") {
    if (!hasDesktopE2EMilestone("tool-start")) addDesktopE2EMilestone("tool-start", { tool: msg.tool || "" });
    desktopE2EResult.toolActions.push({
      tool: msg.tool || "",
      args: msg.args || {},
      status: "running",
    });
    return;
  }
  if (msg.type === "tool_end") {
    const action = {
      tool: msg.tool || "",
      summary: msg.summary || "",
      ok: msg.ok !== false,
      status: msg.ok === false ? "error" : "complete",
    };
    desktopE2EResult.toolActions.push(action);
    return;
  }
  if (msg.type === "confirm_request") {
    recordDesktopE2EConfirmation(msg);
    return;
  }
  if (msg.type === "done") {
    addDesktopE2EMilestone("done");
    desktopE2EResult.finalSessionState = msg.success === false
      ? (msg.status || "stalled")
      : "complete";
    desktopE2EResult.lastAction = msg.summary || null;
    if (!desktopE2EResult.assistantText && msg.response) {
      desktopE2EResult.assistantText = String(msg.response);
    }
    if (!desktopE2EResult.assistantText && msg.summary) {
      desktopE2EResult.assistantText = String(msg.summary);
    }
    return;
  }
  if (msg.type === "error") {
    addDesktopE2EMilestone("error", { message: msg.message || "Server error." });
    desktopE2EResult.finalSessionState = "error";
    desktopE2EResult.lastAction = msg.message || "Server error.";
    desktopE2EResult.errors.push(msg.message || String(msg));
  }
}

function recordDesktopE2EConfirmation(msg) {
  const entry = {
    id: msg.id || null,
    tool: msg.tool || "unknown tool",
    critical: !!msg.critical,
    mode: desktopE2EOptions.confirmMode || "manual",
    answer: null,
    method: null,
    handled: false,
  };
  desktopE2EResult.confirmations.push(entry);
  desktopE2EResult.logs.push(`Confirmation requested: ${entry.tool}`);

  if (!desktopE2EOptions.autoConfirm || entry.tool === "ask_user") {
    entry.method = entry.tool === "ask_user" ? "manual-ask-user" : "manual";
    return;
  }

  entry.answer = desktopE2EOptions.confirmMode === "no" ? false : true;
  setTimeout(() => {
    clickDesktopE2EConfirmation(msg, entry);
  }, 50);
}

function clickDesktopE2EConfirmation(msg, entry) {
  if (!desktopE2EOptions.enabled || !mainWindow || mainWindow.webContents.isDestroyed()) return;
  if (msg && msg.tool === "ask_user") return;
  const allow = entry && entry.answer === false ? "confirm-deny" : "confirm-allow";
  mainWindow.webContents.executeJavaScript(`
    (function () {
      var button = document.getElementById(${JSON.stringify(allow)});
      if (button) {
        button.click();
        return true;
      }
      return false;
    })();
  `).then((clicked) => {
    if (entry) {
      entry.method = clicked ? "renderer-click" : "main-process-fallback";
      entry.handled = true;
    }
    if (!clicked && msg && msg.id) {
      sendToServer({ type: "confirm", id: msg.id, answer: entry ? entry.answer : true });
    }
  }).catch(() => {
    if (entry) {
      entry.method = "main-process-fallback";
      entry.handled = true;
    }
    if (msg && msg.id) sendToServer({ type: "confirm", id: msg.id, answer: entry ? entry.answer : true });
  });
}

function send(ch, data) {
  recordDebugEvent("renderer-send", { channel: ch, data: data });
  try { if (mainWindow && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(ch, data); } catch (e) {}
}

function sendToServer(obj) {
  if (!serverProcess) {
    send("nex:server-error", { message: "No project open. Use File → Open Project." });
    return;
  }
  appendDebugJsonl("commands.jsonl", {
    type: "send-to-server",
    payload: obj,
    textHash: obj && obj.text ? hashPrompt(obj.text) : null,
    length: obj && obj.text ? String(obj.text).length : null,
    projectPath: projectPath,
    branch: projectBranch,
  });
  serverProcess.stdin.write(JSON.stringify(obj) + "\n");
}

function createWindow() {
  recordDebugEvent("window-create", { e2e: desktopE2EOptions.enabled });
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
      offscreen: desktopE2EOptions.enabled,
    },
    show: false,
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.on("did-finish-load", function () {
    recordDebugEvent("renderer-did-finish-load");
    mainWindow.webContents.send("nex:platform", { platform: process.platform });
    if (desktopE2EOptions.enabled) {
      runDesktopE2E();
    }
  });
  mainWindow.once("ready-to-show", function () {
    recordDebugEvent("window-ready-to-show");
    if (desktopE2EOptions.enabled) return;
    mainWindow.show();
    recordDebugEvent("window-shown");
    if (process.argv.includes("--dev")) mainWindow.webContents.openDevTools({ mode: "detach" });
  });
  mainWindow.on("closed", function () {
    recordDebugEvent("window-closed");
    writeDebugExit("window-closed", null);
    killServer(); mainWindow = null;
  });

  var template = [];
  if (isMac) template.push({ label: "nex-code", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] });
  template.push({ label: "File", submenu: [{ label: "Open Project...", accelerator: "CmdOrCtrl+O", click: openDialog }, { type: "separator" }, { role: "quit" }] });
  template.push({
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
  });
  template.push({ label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openDialog() {
  try {
    recordDebugEvent("open-project-dialog-opened");
    var r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"], title: "Open Project" });
    if (r.canceled || r.filePaths.length === 0) {
      recordDebugEvent("open-project-dialog-canceled");
      return { ok: true, canceled: true };
    }
    const normalizedPath = normalizeProjectPath(r.filePaths[0]);
    if (!normalizedPath) {
      const message = "Selected project path is not available.";
      send("nex:server-error", { message: message });
      return { ok: false, message: message };
    }
    await openProject(normalizedPath);
    return { ok: true, path: normalizedPath };
  } catch (e) {
    const message = e && e.message ? e.message : "Open Project failed.";
    send("nex:server-error", { message: message });
    return { ok: false, message: message };
  }
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
  const normalizedPath = normalizeProjectPath(dirPath);
  if (!normalizedPath) throw new Error("Project path is not available.");
  recordDebugEvent("project-open-start", { path: normalizedPath });
  addDesktopE2EMilestone("project-open-requested", { path: normalizedPath });
  projectPath = normalizedPath;
  projectName = path.basename(normalizedPath);
  projectBranch = null;
  projectIsGit = false;
  projectIsDeployable = false;
  const gitState = await readGitState(normalizedPath);
  projectIsGit = gitState.isGitRepository;
  projectBranch = gitState.branch;
  try {
    projectIsDeployable = fs.existsSync(path.join(normalizedPath, ".nex", "deploy.json"));
  } catch (e) {}
  spawnServer(normalizedPath);
  send("nex:project-opened", {
    project: projectName,
    branch: projectBranch || "unknown",
    path: normalizedPath,
    isGitRepository: projectIsGit,
    isDeployable: projectIsDeployable,
    gitState: gitState,
  });
  recordDebugEvent("project-opened", {
    project: projectName,
    branch: projectBranch || "unknown",
    path: normalizedPath,
    isGitRepository: projectIsGit,
    isDeployable: projectIsDeployable,
    gitState: gitState,
  });
  addDesktopE2EMilestone("project-opened", { path: normalizedPath });
}

function waitForCondition(check, timeoutMs, label) {
  const started = Date.now();
  let checking = false;
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        if (await check()) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }
      } catch (error) {
        clearInterval(timer);
        reject(error);
      } finally {
        checking = false;
      }
    }, 100);
  });
}

async function readRendererE2EState() {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) return {};
  try {
    return await mainWindow.webContents.executeJavaScript(`
      (function () {
        var data = window.AppState && window.AppState.data ? window.AppState.data : {};
        var assistant = "";
        if (Array.isArray(data.conversationItems)) {
          for (var i = data.conversationItems.length - 1; i >= 0; i -= 1) {
            var item = data.conversationItems[i];
            if (item && item.kind === "assistant" && item.text) {
              assistant = item.text;
              break;
            }
          }
        }
        return {
          finalSessionState: data.sessionState || "unknown",
          finalAssistantText: assistant,
          lastAction: data.lastAction || null,
          model: data.model || null,
          toolActions: data.toolActions || [],
          gitState: data.gitState || null
        };
      })();
    `);
  } catch (error) {
    desktopE2EResult.errors.push(`Renderer state read failed: ${error.message}`);
    return {};
  }
}

async function readRendererE2EReadiness() {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) return {};
  try {
    return await mainWindow.webContents.executeJavaScript(`
      (function () {
        var input = document.getElementById("cmd-input");
        var submit = document.getElementById("cmd-submit");
        var data = window.AppState && window.AppState.data ? window.AppState.data : {};
        return {
          inputPresent: !!input,
          submitPresent: !!submit,
          inputDisabled: !!(input && input.disabled),
          submitDisabled: !!(submit && submit.disabled),
          commandInputReady: window.__nexCommandInputReady === true,
          projectOpen: !!data.project,
          sessionState: data.sessionState || "unknown",
          userConversationCount: Array.isArray(data.conversationItems)
            ? data.conversationItems.filter(function (item) { return item && item.kind === "user"; }).length
            : 0,
          nexApiPresent: !!(window.nexAPI && window.nexAPI.sendCommand),
          serverCommandCount: ${desktopE2EResult.serverCommands.length}
        };
      })();
    `);
  } catch (error) {
    desktopE2EResult.errors.push(`Renderer readiness read failed: ${error.message}`);
    return {};
  }
}

async function submitPromptThroughRenderer(prompt) {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    throw new Error("Desktop window is not available.");
  }
  const before = await readRendererE2EReadiness();
  const escapedPrompt = JSON.stringify(prompt);
  addDesktopE2EMilestone("prompt-submitted");
  const submitted = await mainWindow.webContents.executeJavaScript(`
    (async function () {
      var input = document.getElementById("cmd-input");
      var submit = document.getElementById("cmd-submit");
      if (!input || !submit) return { ok: false, message: "Command controls are missing." };
      input.focus();
      input.value = ${escapedPrompt};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      submit.click();
      return { ok: true };
    })();
  `);
  if (!submitted || submitted.ok === false) {
    throw new Error(submitted && submitted.message ? submitted.message : "Prompt submission failed.");
  }
  try {
    await waitForCondition(async () => {
      const after = await readRendererE2EReadiness();
      return isDesktopE2EPromptAccepted(before, after);
    }, 5000, "Renderer prompt acceptance");
  } catch (error) {
    const after = await readRendererE2EReadiness();
    addDesktopE2EMilestone("error", { stage: "prompt-submission", message: error.message });
    const diagnostic = {
      stage: "prompt-submission",
      message: "Renderer submission did not produce a user turn, running state, or server chat command.",
      before: before,
      after: after,
      serverReady: serverReady,
      serverCommandCount: desktopE2EResult.serverCommands.length,
    };
    desktopE2EResult.rendererSubmissionDiagnostic = diagnostic;
    throw new Error(`${diagnostic.message} ${error.message}`);
  }
  if (!hasDesktopE2EMilestone("command-accepted")) addDesktopE2EMilestone("command-accepted");
}

function buildExpectationCorpus(options, assistantText) {
  const hasFileExpectations = (options.expectFiles || []).length > 0;
  const parts = hasFileExpectations ? [] : [String(assistantText || "")];
  for (const filePath of options.expectFiles || []) {
    const resolved = path.resolve(options.openProject, filePath);
    try {
      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        parts.push(fs.readFileSync(resolved, "utf8"));
      }
    } catch (e) {}
  }
  const diff = execFileSyncSafe("git", ["diff", "--", "."], options.openProject);
  if (diff.ok) parts.push(diff.stdout);
  return parts.join("\n");
}

function evaluateExpectations(options, assistantText) {
  const checks = [];
  const corpus = buildExpectationCorpus(options, assistantText);
  for (const filePath of options.expectFiles || []) {
    const resolved = path.resolve(options.openProject, filePath);
    checks.push({
      type: "expect-file",
      value: filePath,
      ok: fs.existsSync(resolved),
    });
  }
  for (const expected of options.expectContains || []) {
    checks.push({
      type: "expect-contains",
      value: expected,
      ok: corpus.includes(expected),
    });
  }
  for (const forbidden of options.expectNotContains || []) {
    checks.push({
      type: "expect-not-contains",
      value: forbidden,
      ok: !corpus.includes(forbidden),
    });
  }
  return {
    checks: checks,
    ok: checks.every((check) => check.ok),
  };
}

function emitDesktopE2EResult(result) {
  const classified = classifyDesktopRunStatus(result);
  const output = buildDesktopE2EOutput(result);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return classified.exitCode;
}

function buildDesktopE2EOutput(result) {
  const classified = classifyDesktopRunStatus(result);
  return Object.assign({}, result, {
    finalSessionState: classified.state,
    exitCode: classified.exitCode,
    statusReason: classified.reason,
  });
}

function selectDesktopE2EFinalAssistantText(rendererState, serverText, serverLastAction) {
  const renderer = rendererState || {};
  if (
    renderer.lastAction === "Task complete" &&
    serverLastAction &&
    !/^Task complete$/i.test(String(renderer.finalAssistantText || "").trim())
  ) {
    return String(serverLastAction);
  }
  return renderer.finalAssistantText || serverText || serverLastAction || "";
}

async function runDesktopE2E() {
  if (!desktopE2EOptions.enabled || e2eRunStarted) return;
  e2eRunStarted = true;

  let prompt = "";
  const startedAt = new Date().toISOString();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    desktopE2EResult.finalSessionState = "timeout";
    desktopE2EResult.lastAction = `Timed out after ${desktopE2EOptions.timeoutMs}ms`;
    addDesktopE2EMilestone("timeout", { message: desktopE2EResult.lastAction });
  }, desktopE2EOptions.timeoutMs);

  try {
    addDesktopE2EMilestone("app-loaded");
    if (!desktopE2EOptions.openProject) {
      throw new Error("--e2e requires --open-project or NEX_DESKTOP_OPEN_PROJECT.");
    }
    const normalizedProject = normalizeProjectPath(desktopE2EOptions.openProject);
    if (!normalizedProject) throw new Error("E2E project path is not available.");
    desktopE2EOptions.openProject = normalizedProject;
    prompt = readPromptForE2E(desktopE2EOptions);

    const gitBefore = readGitStatusSync(normalizedProject);
    await waitForCondition(() => serverReady, Math.min(30000, desktopE2EOptions.timeoutMs), "Desktop server readiness");
    await waitForCondition(async () => {
      const readiness = await readRendererE2EReadiness();
      if (isDesktopE2ERendererReady(readiness)) {
        if (!hasDesktopE2EMilestone("renderer-ready")) addDesktopE2EMilestone("renderer-ready", readiness);
        return true;
      }
      return false;
    }, Math.min(30000, desktopE2EOptions.timeoutMs), "Desktop renderer readiness");
    await submitPromptThroughRenderer(prompt);
    await waitForCondition(
      () => timedOut || ["complete", "stalled", "error"].includes(desktopE2EResult.finalSessionState),
      desktopE2EOptions.timeoutMs,
      "Desktop run completion",
    ).catch((error) => {
      timedOut = true;
      desktopE2EResult.finalSessionState = "timeout";
      desktopE2EResult.lastAction = error.message;
    });

    const rendererState = await readRendererE2EState();
    const finalAssistantText = selectDesktopE2EFinalAssistantText(
      rendererState,
      desktopE2EResult.assistantText,
      desktopE2EResult.lastAction,
    );
    const expectations = evaluateExpectations(desktopE2EOptions, finalAssistantText);
    const gitAfter = readGitStatusSync(normalizedProject);
    const result = {
      appBuild: getAppBuildInfo(),
      openedProjectPath: normalizedProject,
      selectedModel: desktopE2EOptions.model || rendererState.model || null,
      promptHash: hashPrompt(prompt),
      prompt: shortenPrompt(prompt),
      finalSessionState: timedOut ? "timeout" : (rendererState.finalSessionState || desktopE2EResult.finalSessionState),
      finalAssistantText: finalAssistantText,
      toolActions: rendererState.toolActions && rendererState.toolActions.length
        ? rendererState.toolActions
        : desktopE2EResult.toolActions,
      confirmationMode: desktopE2EOptions.confirmMode,
      confirmations: desktopE2EResult.confirmations,
      errors: desktopE2EResult.errors,
      logs: desktopE2EResult.logs.slice(-50),
      milestones: desktopE2EResult.milestones,
      serverCommands: desktopE2EResult.serverCommands,
      rendererSubmissionDiagnostic: desktopE2EResult.rendererSubmissionDiagnostic || null,
      gitStatusBefore: gitBefore,
      gitStatusAfter: gitAfter,
      expectations: expectations.checks,
      expectationsOk: expectations.ok,
      stateDir: desktopE2EOptions.stateDir,
      startedAt: startedAt,
      finishedAt: new Date().toISOString(),
      lastAction: rendererState.lastAction || desktopE2EResult.lastAction,
      timedOut: timedOut,
    };
    const exitCode = emitDesktopE2EResult(result);
    clearTimeout(timeout);
    app.exit(exitCode);
  } catch (error) {
    const normalizedProject = normalizeProjectPath(desktopE2EOptions.openProject);
    const result = {
      appBuild: getAppBuildInfo(),
      openedProjectPath: normalizedProject || desktopE2EOptions.openProject || null,
      selectedModel: desktopE2EOptions.model || null,
      promptHash: prompt ? hashPrompt(prompt) : null,
      prompt: prompt ? shortenPrompt(prompt) : "",
      finalSessionState: timedOut ? "timeout" : "error",
      finalAssistantText: desktopE2EResult.assistantText || "",
      toolActions: desktopE2EResult.toolActions,
      confirmationMode: desktopE2EOptions.confirmMode,
      confirmations: desktopE2EResult.confirmations,
      errors: desktopE2EResult.errors.concat(error.message),
      logs: desktopE2EResult.logs.slice(-50),
      milestones: desktopE2EResult.milestones,
      serverCommands: desktopE2EResult.serverCommands,
      rendererSubmissionDiagnostic: desktopE2EResult.rendererSubmissionDiagnostic || null,
      gitStatusBefore: normalizedProject ? readGitStatusSync(normalizedProject) : null,
      gitStatusAfter: normalizedProject ? readGitStatusSync(normalizedProject) : null,
      expectations: [],
      expectationsOk: false,
      stateDir: desktopE2EOptions.stateDir,
      startedAt: startedAt,
      finishedAt: new Date().toISOString(),
      lastAction: error.message,
      timedOut: timedOut,
      error: error.message,
    };
    const exitCode = emitDesktopE2EResult(result);
    clearTimeout(timeout);
    app.exit(exitCode);
  }
}

function registerIpcHandlers() {
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
  ipcMain.handle("nex:open-project", async function () { return await openDialog(); });
  ipcMain.handle("nex:open-project-path", async function (_e, dirPath) {
    const normalizedPath = normalizeProjectPath(dirPath);
    if (!normalizedPath) {
      const message = "Recent project path is not available.";
      send("nex:server-error", { message: message });
      return { ok: false, message: message };
    }
    await openProject(normalizedPath);
    return { ok: true, path: normalizedPath };
  });
  ipcMain.handle("nex:open-project-folder", async function () {
    if (!projectPath) return { ok: false, message: "No project is open." };
    if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
      return { ok: false, message: "Project path is not available." };
    }
    const error = await shell.openPath(projectPath);
    if (error) return { ok: false, message: error };
    return { ok: true, path: projectPath };
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
  ipcMain.on("nex:command", function (_e, cmd) {
    const text = String(cmd || "").trim();
    appendDebugJsonl("commands.jsonl", {
      type: "renderer-command",
      text: text,
      length: text.length,
      textHash: hashPrompt(text),
      projectPath: projectPath,
      branch: projectBranch,
    });
    if (desktopE2EOptions.enabled) {
      desktopE2EResult.serverCommands.push({
        type: "chat",
        textHash: hashPrompt(text),
        length: text.length,
        at: new Date().toISOString(),
      });
      if (!hasDesktopE2EMilestone("command-accepted")) {
        addDesktopE2EMilestone("command-accepted", { source: "server-chat-command" });
      }
    }
    sendToServer({ type: "chat", id: "c-" + Date.now(), text: text });
  });
  ipcMain.on("nex:confirm-answer", function (_e, d) { sendToServer({ type: "confirm", id: d.id, answer: d.answer }); });
  ipcMain.on("nex:cancel", function () { sendToServer({ type: "cancel" }); });
  ipcMain.on("nex:clear", async function () {
    sendToServer({ type: "clear" });
    const gitState = await refreshProjectGitState();
    send("nex:state-updated", {
      sessionState: "idle",
      gitState: gitState,
    });
  });
  ipcMain.on("nex:open-external", function (_e, url) {
    if (!isSafeExternalUrl(url)) {
      send("nex:server-error", { message: "Blocked unsafe external URL." });
      return;
    }
    shell.openExternal(url);
  });
}

if (process.versions && process.versions.electron) {
  app.whenReady().then(function () {
    recordDebugEvent("app-ready", {
      argv: process.argv,
      versions: process.versions,
    });
    registerIpcHandlers();
    createWindow();
    const initialProject = getInitialProjectPath();
    const normalizedProject = normalizeProjectPath(initialProject);
    if (normalizedProject) {
      openProject(normalizedProject);
    }
  });
  app.on("window-all-closed", function () {
    recordDebugEvent("window-all-closed");
    writeDebugExit("window-all-closed", null);
    killServer(); if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", function (_event, code) {
    recordDebugEvent("before-quit");
    writeDebugExit("before-quit", code);
    killServer();
  });
}

module.exports = {
  buildDesktopE2EOutput,
  classifyDesktopRunStatus,
  evaluateExpectations,
  isDesktopE2EPromptAccepted,
  isDesktopE2ERendererReady,
  parseDesktopE2EOptions,
  parseDesktopE2EConfirmMode,
  isSafeExternalUrl,
  isValidProjectPathInput,
  normalizeProjectPath,
  resolveDebugSessionDir,
  selectDesktopE2EFinalAssistantText,
  registerIpcHandlers,
};

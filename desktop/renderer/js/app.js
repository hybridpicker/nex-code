/**
 * desktop/renderer/js/app.js — nex-code Main Application Controller
 *
 * Coordinates all UI components, manages state, and handles IPC
 * communication with the Electron main process.
 */

"use strict";

const AppState = {
  data: {
    // nex-code identity
    project: null,
    branch: null,
    workspace: null,
    isGitRepository: false,
    isDeployable: false,

    // Session
    sessionState: "idle",       // idle | running | complete | stalled | cancelled | error
    sessionConfidence: null,    // High | Medium | Low
    lastAction: null,

    // Model
    model: "qwen3-coder:480b",
    routerMode: "Phase routing",
    availableModels: ["qwen3-coder:480b"],
    modelState: null,
    modelHistory: [],           // [{model, phase, purpose, requests, tokens, status, startTime, endTime}]
    gitState: null,

    // Agentic nodes (timeline)
    agenticNodes: [],
    conversationItems: [],

    // Verification
    testsRun: false,
    testPassed: 0,
    testFailed: 0,
    verificationCommand: null,
    verificationStatus: "not-run",
    fileChanges: 0,

    // Tool actions
    toolActions: [],

    // Usage
    tokens: { used: 0 },
    requests: 0,

    // Shortcuts
    shortcutChips: ["/plan", "/impl", "/verify", "/bench", "/git", "/deploy"],

    // Project history
    recentProjects: [],
  },
  activeNodeId: null,
};

window.AppState = AppState;

let pendingServerConfirm = null;

const ANSI_ESCAPE_RE = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
const SECRET_VALUE_RE = /\b([A-Z][A-Z0-9_]{2,}(?:TOKEN|SECRET|KEY|PASSWORD|PASS|AUTH|CREDENTIAL)[A-Z0-9_]*)\s*=\s*([^\s'"`]{8,})/g;
const SECRET_BEARER_RE = /\b(Bearer|token|api[_-]?key)\s+([A-Za-z0-9._~+/=-]{16,})/gi;

function stripAnsiSequences(text) {
  return String(text || "").replace(ANSI_ESCAPE_RE, "");
}

function redactSensitiveDisplayText(text) {
  return String(text || "")
    .replace(SECRET_VALUE_RE, "$1=[REDACTED]")
    .replace(SECRET_BEARER_RE, "$1 [REDACTED]");
}

function sanitizeDisplayText(text) {
  return redactSensitiveDisplayText(stripAnsiSequences(text));
}

function getLatestConversationItemByKind(kind) {
  for (let i = AppState.data.conversationItems.length - 1; i >= 0; i -= 1) {
    const item = AppState.data.conversationItems[i];
    if (item && item.kind === kind) return item;
  }
  return null;
}

function getActiveAssistantConversation() {
  const activeConversation = getActiveConversation();
  if (activeConversation && activeConversation.kind === "assistant") {
    return activeConversation;
  }
  return getLatestConversationItemByKind("assistant");
}

function settleRunningUserConversations(status, message) {
  AppState.data.conversationItems.forEach((item) => {
    if (!item || item.kind !== "user" || item.status !== "running") return;
    item.status = status;
    if (message && (status === "error" || status === "stopped")) {
      item.error = message;
    }
  });
}

// ─── Initialization ──────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  AppState.data.recentProjects = loadRecentProjects();

  // Fetch initial state from main process
  try {
    const liveState = await window.nexAPI.getState();
    if (liveState) {
      if (liveState.project) {
        AppState.data.project = liveState.project;
        AppState.data.branch = liveState.branch || "unknown";
        AppState.data.workspace = liveState.path || null;
        AppState.data.isGitRepository = !!liveState.isGitRepository;
        AppState.data.isDeployable = !!liveState.isDeployable;
        if (liveState.gitState) applyGitState(liveState.gitState);
        rememberRecentProject(liveState.path, liveState.project);
        showProjectView();
      }
      if (liveState.modelState) applyModelState(liveState.modelState);
    }
  } catch (err) {
    console.warn("Failed to load initial state:", err.message);
  }

  refreshModelState();

  // Initialize all components
  refreshAllComponents();

  // Subscribe to IPC events
  subscribeToEvents();
  setupCommandInput();
  setupGlobalShortcuts();
});

let refreshTimer = null;
function refreshAllComponents() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (typeof initTopBarComponents === "function") initTopBarComponents(AppState.data);
    if (typeof initSidebarComponents === "function") initSidebarComponents(AppState.data);
    if (typeof initTimelineComponents === "function") initTimelineComponents(AppState.data);
    if (typeof initRightPanelComponents === "function") initRightPanelComponents(AppState.data);
    if (typeof initCommandPaletteComponents === "function") initCommandPaletteComponents(AppState.data);
    refreshTimer = null;
  }, 50);
}

// ─── Event Subscriptions ────────────────────────────────────────────────────

function subscribeToEvents() {
  if (!window.nexAPI) return;

  if (window.nexAPI.onPlatform) {
    window.nexAPI.onPlatform((d) => {
      document.body.classList.toggle("platform-macos", d.platform === "darwin");
      document.body.classList.toggle("platform-windows", d.platform === "win32");
      document.body.classList.toggle("platform-linux", d.platform === "linux");
    });
  }

  // Server ready
  window.nexAPI.onServerReady(() => {
    addServerLog("nex-code ready");
  });

  // Project opened
  window.nexAPI.onProjectOpened((d) => {
    AppState.data.project = d.project;
    AppState.data.branch = d.branch;
    AppState.data.workspace = d.path || null;
    AppState.data.isGitRepository = !!d.isGitRepository;
    AppState.data.isDeployable = !!d.isDeployable;
    if (d.gitState) applyGitState(d.gitState);
    AppState.data.sessionState = "idle";
    AppState.data.lastAction = "Project opened";
    resetSessionActivity();
    rememberRecentProject(d.path, d.project);

    showProjectView();
    refreshAllComponents();
    addServerLog(`Project opened: ${d.project} (branch: ${d.branch || "unknown"})`);
  });

  if (window.nexAPI.onModelState) {
    window.nexAPI.onModelState((d) => {
      applyModelState(d);
      refreshAllComponents();
    });
  }

  if (window.nexAPI.onGitState) {
    window.nexAPI.onGitState((d) => {
      applyGitState(d);
      refreshAllComponents();
    });
  }

  // Token streaming
  window.nexAPI.onServerToken((d) => {
    const text = sanitizeDisplayText(d.text);
    const activeAssistant = getActiveAssistantConversation();
    if (activeAssistant) {
      activeAssistant.text = (activeAssistant.text || "") + text;
      activeAssistant.status = "running";
      refreshAllComponents();
    } else {
      addServerLog(text);
    }
    AppState.data.tokens.used += text.length;
  });

  // Tool start
  window.nexAPI.onServerToolStart((d) => {
    AppState.data.sessionState = "running";
    const action = upsertToolActionStart(d);
    applyVerificationFromToolStart(d, action);
    AppState.data.requests += 1;
    AppState.data.lastAction = `${d.tool} started`;

    ensureActivePhaseForTool(d.tool, action.detail);
    addServerLog(`Tool: ${d.tool}`);
    refreshAllComponents();
  });

  // Tool end
  window.nexAPI.onServerToolEnd((d) => {
    const action = completeToolAction(d);
    applyVerificationFromToolEnd(d, action);
    AppState.data.lastAction = `${d.tool} completed`;

    updateActiveNodeWithToolResult(d.tool, action.detail, d.ok !== false);
    refreshAllComponents();
  });

  window.nexAPI.onServerConfirm((d) => {
    if (d.tool === "ask_user") {
      pendingServerConfirm = d;
      attachAskUserPrompt(d);
      refreshCommandInputState();
      refreshAllComponents();
      return;
    }

    const confirmBox = document.getElementById("server-confirm");
    const question = document.getElementById("confirm-question");
    const allow = document.getElementById("confirm-allow");
    const deny = document.getElementById("confirm-deny");
    if (!confirmBox || !question || !allow || !deny) return;

    question.textContent = d.question || "Allow this action?";
    confirmBox.classList.remove("hidden");
    allow.onclick = () => {
      confirmBox.classList.add("hidden");
      window.nexAPI.sendConfirm(d.id, true);
    };
    deny.onclick = () => {
      confirmBox.classList.add("hidden");
      window.nexAPI.sendConfirm(d.id, false);
    };
  });

  // Server done
  window.nexAPI.onServerDone((d) => {
    completeActiveNode();
    const success = d && d.success !== false && d.status !== "stalled";
    const terminalState = getTerminalSessionState(d, success);
    const activeAssistant = getActiveAssistantConversation();
    const finalText = extractFinalAssistantText(d, activeAssistant);
    if (activeAssistant) {
      activeAssistant.text = finalText;
      activeAssistant.status = success ? "complete" : "stopped";
      if (!success && d && d.summary) activeAssistant.error = d.summary;
    }
    AppState.data.sessionState = terminalState;
    AppState.data.sessionConfidence = success ? "High" : "Low";
    AppState.data.lastAction = success
      ? "Task complete"
      : (d.summary || (terminalState === "cancelled" ? "Run cancelled" : "Stopped without completing the task"));

    if (success) {
      showTaskComplete();
      completeActiveConversation();
      settleRunningUserConversations("complete");
    } else {
      hideTaskComplete();
      const stopMessage = d.summary || AppState.data.lastAction;
      markActiveConversationStopped(stopMessage);
      settleRunningUserConversations("stopped", stopMessage);
      markRunningToolsInterrupted(terminalState, stopMessage);
    }
    pendingServerConfirm = null;
    refreshCommandInputState();
    refreshGitState();
    refreshModelState();

    refreshAllComponents();
    addServerLog(success ? "Task complete" : (d.summary || "Run stopped"));
  });

  // Server error
  window.nexAPI.onServerError((d) => {
    AppState.data.sessionState = "error";
    AppState.data.lastAction = `Error: ${d.message}`;
    if (AppState.activeNodeId) {
      const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
      if (node) {
        node.status = "error";
        node.detail += `\nError: ${d.message}`;
      }
      AppState.activeNodeId = null;
    }
    markActiveConversationError(d.message);
    settleRunningUserConversations("error", d.message);
    pendingServerConfirm = null;
    refreshCommandInputState();
    refreshAllComponents();
    addServerLog(`Error: ${d.message}`);
  });

  if (window.nexAPI.onServerClosed) {
    window.nexAPI.onServerClosed((d) => {
      if (AppState.data.sessionState !== "running") return;
      const code = d && typeof d.code === "number" ? d.code : null;
      AppState.data.sessionState = code === 0 ? "stalled" : "error";
      AppState.data.lastAction = code === 0
        ? "Server closed before the run completed"
        : `Server exited before the run completed${code === null ? "" : ` (code ${code})`}`;
      markActiveConversationStopped(AppState.data.lastAction);
      settleRunningUserConversations(AppState.data.sessionState === "error" ? "error" : "stopped", AppState.data.lastAction);
      pendingServerConfirm = null;
      markRunningToolsInterrupted(AppState.data.sessionState === "error" ? "error" : "stalled", AppState.data.lastAction);
      refreshCommandInputState();
      refreshAllComponents();
    });
  }

  // Agentic node event
  window.nexAPI.onAgenticNode((d) => {
    const id = "node-" + Date.now();
    const node = {
      id: id,
      phase: d.phase || "THINK",
      detail: d.detail || "",
      color: d.color || "cyan",
      status: "active",
      tokens: "",
      extras: d.extras || {}
    };
    AppState.data.agenticNodes.push(node);
    attachNodeToActiveConversation(node);
    AppState.activeNodeId = id;
    AppState.data.sessionState = "running";
    AppState.data.lastAction = `${node.phase} phase started`;

    // Record model activity
    if (AppState.data.model) {
      AppState.data.modelHistory.push({
        model: AppState.data.model,
        phase: node.phase,
        purpose: getPhasePurpose(node.phase),
        requests: AppState.data.requests || 1,
        tokens: 0,
        status: "active",
        startTime: new Date().toISOString(),
        endTime: null,
      });
    }

    showProjectView();
    refreshAllComponents();
  });

  // State updated
  window.nexAPI.onStateUpdated((d) => {
    if (d.sessionState) AppState.data.sessionState = d.sessionState;
    if (d.model) AppState.data.model = d.model;
    if (d.modelState) applyModelState(d.modelState);
    if (d.branch) AppState.data.branch = d.branch;
    if (d.isGitRepository !== undefined) AppState.data.isGitRepository = !!d.isGitRepository;
    if (d.gitState) applyGitState(d.gitState);
    refreshAllComponents();
  });
}

function applyModelState(modelState) {
  if (!modelState) return;
  AppState.data.modelState = modelState;
  AppState.data.routerMode = modelState.routerMode || "Phase routing";
  AppState.data.availableModels = (modelState.readyModels || []).map((model) => model.spec);
  if (modelState.activeModel) {
    AppState.data.model = modelState.activeModel.id || modelState.activeModel.spec;
  } else if (!modelState.hasConfiguredModel) {
    AppState.data.model = "No model configured";
  }
}

function applyGitState(gitState) {
  if (!gitState) return;
  AppState.data.gitState = gitState;
  AppState.data.isGitRepository = !!gitState.isGitRepository;
  AppState.data.branch = gitState.branch || AppState.data.branch;
}

function getTerminalSessionState(donePayload, success) {
  if (success) return "complete";
  if (donePayload && donePayload.status === "cancelled") return "cancelled";
  if (donePayload && donePayload.status === "error") return "error";
  return "stalled";
}

async function refreshModelState() {
  if (!window.nexAPI || !window.nexAPI.getModelState) return;
  try {
    const modelState = await window.nexAPI.getModelState();
    applyModelState(modelState);
    refreshAllComponents();
  } catch (err) {
    console.warn("Failed to load model state:", err.message);
  }
}

async function refreshGitState() {
  if (!window.nexAPI || !window.nexAPI.getGitState) return;
  try {
    const gitState = await window.nexAPI.getGitState();
    applyGitState(gitState);
    refreshAllComponents();
  } catch (err) {
    console.warn("Failed to load Git state:", err.message);
  }
}

function getPhasePurpose(phase) {
  const map = {
    "THINK": "Understanding request",
    "PLAN": "Architectural planning",
    "IMPLEMENT": "Code implementation",
    "VERIFY": "Verification & testing",
    "RESPONSE": "Generating response",
  };
  return map[phase] || "General processing";
}

// ─── View Transitions ───────────────────────────────────────────────────────

function showProjectView() {
  document.getElementById("welcome").classList.add("hidden");
  document.getElementById("timeline").classList.remove("hidden");
}

function focusCommandInput(prefill) {
  const input = document.getElementById("cmd-input");
  if (!input) return;
  if (prefill) input.value = prefill;
  input.focus();
}

function logUiMessage(text) {
  const output = document.getElementById("server-output");
  const stream = document.getElementById("server-stream");
  if (!output || !stream) return;
  output.classList.remove("hidden");
  const div = document.createElement("div");
  div.className = "log-line";
  div.textContent = text;
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
}

function resetSessionActivity() {
  AppState.data.agenticNodes = [];
  AppState.data.conversationItems = [];
  AppState.data.toolActions = [];
  AppState.data.modelHistory = [];
  AppState.data.testsRun = false;
  AppState.data.testPassed = 0;
  AppState.data.testFailed = 0;
  AppState.data.verificationCommand = null;
  AppState.data.verificationStatus = "not-run";
  AppState.data.fileChanges = 0;
  AppState.activeNodeId = null;
  AppState.activeConversationId = null;
  pendingServerConfirm = null;
  refreshCommandInputState();
}

function summarizeToolArgs(args) {
  if (!args || typeof args !== "object") return "started";
  const entries = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 2)
    .map(([key, value]) => `${key}=${formatToolArgValue(value)}`);
  return entries.length > 0 ? entries.join(" ") : "started";
}

function formatToolArgValue(value) {
  if (typeof value === "string") {
    const compact = sanitizeDisplayText(value).replace(/\s+/g, " ").trim();
    return compact.length > 48 ? `${compact.slice(0, 45)}...` : compact;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length
      ? `[${formatToolArgValue(value[0])}${value.length > 1 ? ", ..." : ""}]`
      : "[]";
  }
  return "{...}";
}

function normalizeToolCommand(command) {
  return sanitizeDisplayText(command)
    .replace(/\s+/g, " ")
    .replace(/\s*&&\s*/g, " && ")
    .trim();
}

function getToolCommand(toolPayload) {
  const args = toolPayload && toolPayload.args;
  if (!args || typeof args !== "object") return "";
  return normalizeToolCommand(args.command || args.cmd || args.script || "");
}

function isVerificationCommand(command) {
  const normalized = normalizeToolCommand(command);
  if (!normalized) return false;
  return /^(?:npm\s+(?:test|run\s+test(?::[\w.-]+)?)|pytest(?:\s|$)|cargo\s+test(?:\s|$)|go\s+test(?:\s|$)|node\s+src\/main\.js(?:\s|$))/i.test(normalized);
}

function getVerificationCommandFromTool(toolPayload) {
  const tool = String(toolPayload && toolPayload.tool || "").toLowerCase();
  if (!["bash", "shell", "terminal", "exec", "run_command"].includes(tool)) return "";
  const command = getToolCommand(toolPayload);
  return isVerificationCommand(command) ? command : "";
}

function parseVerificationCounts(summary, ok) {
  const text = sanitizeDisplayText(summary);
  let passed = ok === false ? 0 : 1;
  let failed = ok === false ? 1 : 0;
  const testsLine = text.match(/Tests?:[^\n]*(?:(\d+)\s+failed)?[^\n]*(?:(\d+)\s+passed)?/i);
  const passedOnly = text.match(/\b(\d+)\s+(?:tests?\s+)?passed\b/i);
  const failedOnly = text.match(/\b(\d+)\s+(?:tests?\s+)?failed\b/i);
  if (testsLine || passedOnly || failedOnly) {
    passed = passedOnly ? Number(passedOnly[1]) : 0;
    failed = failedOnly ? Number(failedOnly[1]) : 0;
  }
  return { passed: passed, failed: failed };
}

function getToolActionMatchIndex(payload) {
  const callId = payload && (payload.callId || payload.toolCallId || payload.invocationId);
  if (callId) {
    const exact = AppState.data.toolActions.findIndex((action) => action.callId === callId);
    if (exact >= 0) return exact;
  }

  const messageId = payload && payload.id;
  const tool = payload && payload.tool;
  return AppState.data.toolActions.findIndex((action) => {
    return action.status === "running"
      && action.tool === tool
      && (!messageId || action.messageId === messageId);
  });
}

function upsertToolActionStart(payload) {
  const callId = payload && (payload.callId || payload.toolCallId || payload.invocationId || null);
  const action = {
    callId: callId,
    messageId: payload && payload.id,
    tool: sanitizeDisplayText(payload && payload.tool),
    detail: summarizeToolArgs(payload && payload.args),
    command: getToolCommand(payload),
    status: "running",
    ok: null,
    time: new Date().toLocaleTimeString(),
  };

  const existingIndex = getToolActionMatchIndex(payload);
  if (existingIndex >= 0) {
    AppState.data.toolActions[existingIndex] = Object.assign({}, AppState.data.toolActions[existingIndex], action);
    return AppState.data.toolActions[existingIndex];
  }

  AppState.data.toolActions.unshift(action);
  if (AppState.data.toolActions.length > 20) AppState.data.toolActions.pop();
  return action;
}

function completeToolAction(payload) {
  const existingIndex = getToolActionMatchIndex(payload);
  const detail = sanitizeDisplayText(payload && payload.summary)
    || ((payload && payload.ok === false) ? "failed" : "completed");
  const update = {
    callId: payload && (payload.callId || payload.toolCallId || payload.invocationId || null),
    messageId: payload && payload.id,
    tool: sanitizeDisplayText(payload && payload.tool),
    detail: detail,
    status: payload && payload.ok === false ? "error" : "complete",
    ok: !(payload && payload.ok === false),
    time: new Date().toLocaleTimeString(),
  };

  if (existingIndex >= 0) {
    AppState.data.toolActions[existingIndex] = Object.assign({}, AppState.data.toolActions[existingIndex], update);
    return AppState.data.toolActions[existingIndex];
  }

  AppState.data.toolActions.unshift(update);
  if (AppState.data.toolActions.length > 20) AppState.data.toolActions.pop();
  return update;
}

function markRunningToolsInterrupted(status, detail) {
  AppState.data.toolActions.forEach((action) => {
    if (!action || action.status !== "running") return;
    action.status = status;
    action.ok = false;
    action.detail = sanitizeDisplayText(detail || "interrupted");
  });
}

function applyVerificationFromToolStart(payload, action) {
  const command = getVerificationCommandFromTool(payload);
  if (!command) return;
  AppState.data.testsRun = true;
  AppState.data.verificationCommand = command;
  AppState.data.verificationStatus = "running";
  if (action) action.verification = true;
}

function applyVerificationFromToolEnd(payload, action) {
  const command = (action && action.verification && action.command)
    || getVerificationCommandFromTool(payload);
  if (!command) return;
  const ok = !(payload && payload.ok === false);
  const counts = parseVerificationCounts(payload && payload.summary, ok);
  AppState.data.testsRun = true;
  AppState.data.testPassed = counts.passed;
  AppState.data.testFailed = counts.failed;
  AppState.data.verificationCommand = command;
  AppState.data.verificationStatus = ok ? "passed" : "failed";
}

function extractFinalAssistantText(donePayload, activeAssistant) {
  const streamed = activeAssistant && activeAssistant.text
    ? activeAssistant.text.trim()
    : "";
  if (streamed) return streamed;

  const response = donePayload && typeof donePayload.response === "string"
    ? donePayload.response.trim()
    : "";
  if (response) return response;

  const summary = donePayload && typeof donePayload.summary === "string"
    ? donePayload.summary.trim()
    : "";
  if (summary) return summary;

  return activeAssistant && activeAssistant.text ? activeAssistant.text : "";
}

function showTaskComplete() {
  const banner = document.getElementById("task-complete");
  const body = document.getElementById("complete-body");
  const actions = document.getElementById("complete-actions");
  if (!banner || !body || !actions) return;

  banner.classList.remove("hidden");

  const project = AppState.data.project || "this project";
  const branch = AppState.data.branch || "unknown";

  let summary = `<b>Active project:</b> ${escapeHtml(project)}<br>`;
  summary += `<b>Branch:</b> ${escapeHtml(branch)}<br><br>`;

  const nodes = AppState.data.agenticNodes;
  if (nodes.length > 0) {
    summary += `<b>Actions performed:</b><br>`;
    nodes.forEach(n => {
      summary += `&bull; ${escapeHtml(n.phase)}: ${escapeHtml(n.detail || "completed")}<br>`;
    });
  }

  body.innerHTML = summary;

  actions.innerHTML = `
    <button class="btn btn-primary" onclick="App.continueIteration()">Continue Iteration</button>
    <button class="btn btn-success" onclick="App.runVerification()">Run Verification</button>
    <button class="btn btn-ghost" onclick="App.wrapUp()">Wrap Up</button>
  `;
}

function hideTaskComplete() {
  const banner = document.getElementById("task-complete");
  if (banner) banner.classList.add("hidden");
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}

// ─── Markdown Parser ────────────────────────────────────────────────────────

function parseMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text)
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/\*\*(.*)\*\*/gim, "<b>$1</b>")
    .replace(/`(.*)`/gim, "<code>$1</code>")
    .replace(/\n\n/gim, "</p><p>");

  html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/gim, "");

  return `<div class="md"><p>${html}</p></div>`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createConversationItem(kind, text, extra) {
  return Object.assign({
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: kind,
    text: text || "",
    status: "running",
    timestamp: new Date().toLocaleTimeString(),
    phases: [],
    query: null,
    error: null,
  }, extra || {});
}

function appendConversationItem(item) {
  AppState.data.conversationItems.push(item);
  AppState.activeConversationId = item.id;
  showProjectView();
  refreshAllComponents();
  return item;
}

function getActiveConversation() {
  return AppState.data.conversationItems.find((item) => item.id === AppState.activeConversationId) || null;
}

function createUserConversationTurn(text, extra) {
  return appendConversationItem(createConversationItem("user", text, extra));
}

function attachNodeToActiveConversation(node) {
  const activeConversation = getActiveAssistantConversation() || getActiveConversation();
  if (!activeConversation) return;
  activeConversation.phases.push(node);
  activeConversation.status = "running";
}

function attachAskUserPrompt(confirmRequest) {
  const activeConversation = getActiveAssistantConversation() || getActiveConversation();
  if (!activeConversation) {
    appendConversationItem(createConversationItem("assistant", confirmRequest.question, {
      query: {
        id: confirmRequest.id,
        question: confirmRequest.question,
        options: confirmRequest.options || [],
        status: "pending",
      },
    }));
    return;
  }

  activeConversation.query = {
    id: confirmRequest.id,
    question: confirmRequest.question,
    options: confirmRequest.options || [],
    status: "pending",
  };
}

function markActiveConversationError(message) {
  const activeConversation = getActiveAssistantConversation() || getActiveConversation();
  if (!activeConversation) return;
  activeConversation.status = "error";
  activeConversation.error = message;
}

function completeActiveConversation() {
  const activeConversation = getActiveAssistantConversation() || getActiveConversation();
  if (!activeConversation) return;
  activeConversation.status = "complete";
  if (activeConversation.query && activeConversation.query.status === "pending") {
    activeConversation.query.status = "dismissed";
  }
}

function markActiveConversationStopped(message) {
  const activeConversation = getActiveAssistantConversation() || getActiveConversation();
  if (!activeConversation) return;
  activeConversation.status = "stopped";
  if (message) activeConversation.error = message;
  if (activeConversation.query && activeConversation.query.status === "pending") {
    activeConversation.query.status = "dismissed";
  }
}

function refreshCommandInputState() {
  const input = document.getElementById("cmd-input");
  const submit = document.getElementById("cmd-submit");
  const submitLabel = submit ? submit.querySelector(".command-submit-label") : null;
  if (!input) return;

  if (pendingServerConfirm && pendingServerConfirm.tool === "ask_user") {
    input.placeholder = "Reply to nex-code…";
    if (submitLabel) submitLabel.textContent = "Reply";
  } else {
    input.placeholder = "Ask nex-code or enter a command…";
    if (submitLabel) submitLabel.textContent = "Run";
  }
}

function submitAskUserAnswer(answer) {
  if (!pendingServerConfirm || !window.nexAPI) return;

  const trimmed = String(answer || "").trim();
  if (!trimmed) return;

  const activeConversation = getActiveConversation();
  if (activeConversation && activeConversation.query) {
    activeConversation.query.status = "answered";
    activeConversation.query.answer = trimmed;
  }

  createUserConversationTurn(trimmed, { replyTo: pendingServerConfirm.id });
  appendConversationItem(createConversationItem("assistant", "", {
    status: "running",
    replyTo: pendingServerConfirm.id,
  }));
  window.nexAPI.sendConfirm(pendingServerConfirm.id, trimmed);
  pendingServerConfirm = null;
  AppState.data.sessionState = "running";
  AppState.data.lastAction = "Clarification answered";
  refreshCommandInputState();
  refreshAllComponents();
}

// ─── Agentic Phase Management ───────────────────────────────────────────────

function startAgenticPhase(phase, detail, color) {
  hideTaskComplete();
  const id = "node-" + Date.now();
  const node = {
    id: id,
    phase: phase,
    detail: detail,
    color: color || "cyan",
    status: "active",
    tokens: "",
    extras: {}
  };
  AppState.data.agenticNodes.push(node);
  attachNodeToActiveConversation(node);
  AppState.activeNodeId = id;
  AppState.data.sessionState = "running";
  AppState.data.lastAction = `${phase} phase started`;

  showProjectView();
  refreshAllComponents();
}

function updateActiveNode(text) {
  const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
  if (node) {
    node.tokens = (node.tokens || "") + text;
    // Update DOM directly for performance
    const nodeEl = document.getElementById(`node-${node.id}`);
    if (nodeEl) {
      const detailEl = nodeEl.querySelector(".timeline-node-detail");
      if (detailEl) {
        detailEl.textContent = node.detail + "\n" + node.tokens;
      }
    }
  }
}

function updateActiveNodeWithToolResult(toolName, detail, ok) {
  const node = AppState.data.agenticNodes.find((n) => n.id === AppState.activeNodeId);
  if (!node) return;
  const summary = detail ? String(detail).trim() : (ok ? "completed" : "failed");
  node.detail = `${toolName}: ${summary}`;
  if (!ok) node.status = "error";
}

function completeActiveNode() {
  const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
  if (node) {
    node.status = "complete";
    // Update model history entry
    const historyEntry = AppState.data.modelHistory.find(
      h => h.phase === node.phase && h.status === "active"
    );
    if (historyEntry) {
      historyEntry.status = "complete";
      historyEntry.tokens = node.tokens ? node.tokens.length : 0;
      historyEntry.endTime = new Date().toISOString();
    }
  }
  AppState.activeNodeId = null;
  refreshAllComponents();
}

// ─── Server Log ─────────────────────────────────────────────────────────────

function addServerLog(text) {
  const output = document.getElementById("server-output");
  const stream = document.getElementById("server-stream");
  if (!output || !stream) return;
  output.classList.remove("hidden");
  const div = document.createElement("div");
  div.className = "log-line";
  div.textContent = text;
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
}

function loadRecentProjects() {
  try {
    return JSON.parse(localStorage.getItem("nex-code:recent-projects") || "[]");
  } catch (_err) {
    return [];
  }
}

function rememberRecentProject(projectPath, projectName) {
  if (!projectPath) return;
  const entry = { name: projectName || projectPath.split(/[\\/]/).pop(), path: projectPath };
  const next = [entry]
    .concat(loadRecentProjects().filter((p) => p.path !== projectPath))
    .slice(0, 4);
  AppState.data.recentProjects = next;
  try {
    localStorage.setItem("nex-code:recent-projects", JSON.stringify(next));
  } catch (_err) {}
}

// ─── Command Input ──────────────────────────────────────────────────────────

function setupCommandInput() {
  const input = document.getElementById("cmd-input");
  const submit = document.getElementById("cmd-submit");

  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") executeCommand();
    });
  }
  if (submit) {
    submit.addEventListener("click", executeCommand);
  }
}

function setupGlobalShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    if (event.altKey || event.shiftKey) return;
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;

    const target = event.target;
    const isEditable = target instanceof HTMLElement
      && (target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (isEditable && target.id !== "cmd-input") return;

    event.preventDefault();
    focusCommandInput();
  });
}

function classifyToolPhase(toolName) {
  const name = String(toolName || "").toLowerCase();
  if (/test|bench|lint|verify|jest|npm/.test(name)) return "VERIFY";
  if (/edit|write|patch|apply|create/.test(name)) return "IMPLEMENT";
  if (/read|grep|find|search|list/.test(name)) return "PLAN";
  return "WORK";
}

function ensureActivePhaseForTool(toolName, detail) {
  if (AppState.activeNodeId) return;
  const phase = classifyToolPhase(toolName);
  const label = detail && detail !== "started"
    ? `${toolName} — ${detail}`
    : `${toolName} in progress`;
  startAgenticPhase(
    phase,
    label,
    phase === "VERIFY" ? "teal" : phase === "IMPLEMENT" ? "emerald" : "cyan",
  );
}

function executeCommand() {
  const input = document.getElementById("cmd-input");
  const cmd = input.value.trim();
  if (!cmd) return;

  if (pendingServerConfirm && pendingServerConfirm.tool === "ask_user") {
    submitAskUserAnswer(cmd);
    input.value = "";
    return;
  }

  const disabledReason = getCommandDisabledReason(cmd);
  if (disabledReason) {
    logUiMessage(`${cmd.split(/\s+/)[0]} is ${disabledReason}`);
    input.focus();
    return;
  }

  createUserConversationTurn(cmd);
  appendConversationItem(createConversationItem("assistant", "", {
    status: "running",
    sourceCommand: cmd,
  }));

  // Log command
  const output = document.getElementById("server-output");
  const stream = document.getElementById("server-stream");
  if (output && stream) {
    output.classList.remove("hidden");
    const cmdDiv = document.createElement("div");
    cmdDiv.className = "cmd-line";
    cmdDiv.textContent = `nex-code › ${cmd}`;
    stream.appendChild(cmdDiv);
    stream.scrollTop = stream.scrollHeight;
  }

  // Handle slash commands
  if (cmd.startsWith("/plan")) startAgenticPhase("PLAN", "Generating implementation strategy...", "cyan");
  else if (cmd.startsWith("/impl")) startAgenticPhase("IMPLEMENT", "Applying changes to codebase...", "emerald");
  else if (cmd.startsWith("/verify")) startAgenticPhase("VERIFY", "Running tests and verification...", "teal");
  else if (cmd.startsWith("/bench")) startAgenticPhase("VERIFY", "Running benchmarks...", "teal");
  else if (cmd.startsWith("/git")) addServerLog("Git actions — use terminal or open project to access version control.");
  else if (cmd.startsWith("/deploy")) addServerLog("Deploy — deployment workflows require a configured project.");
  else if (!cmd.startsWith("/")) startAgenticPhase("THINK", `Analyzing: ${cmd.substring(0, 60)}...`, "cyan");

  if (window.nexAPI) window.nexAPI.sendCommand(cmd);
  input.value = "";
  refreshCommandInputState();
}

function commandRequiresProject(cmd) {
  return !!getCommandDisabledReason(cmd);
}

function getCommandDisabledReason(cmd) {
  if (!AppState.data.project) {
    if (["/plan", "/impl", "/verify", "/bench"].some((prefix) => cmd.startsWith(prefix))) {
      return "disabled until a project is opened.";
    }
    if (cmd.startsWith("/git")) return "disabled until a Git repository is opened.";
    if (cmd.startsWith("/deploy")) return "disabled until a deployable project is opened.";
  }
  if (cmd.startsWith("/git") && !AppState.data.isGitRepository) {
    return "disabled because the open project is not a Git repository.";
  }
  if (cmd.startsWith("/deploy") && !AppState.data.isDeployable) {
    return "disabled until a deployable project is opened.";
  }
  return "";
}

// ─── Public API (called from HTML onclick handlers) ─────────────────────────

window.App = {
  openProject: async function () {
    if (!window.nexAPI || !window.nexAPI.openProject) {
      logUiMessage("Project picker is not available in this desktop session.");
      return;
    }
    try {
      const result = await window.nexAPI.openProject();
      if (result && result.ok === false) {
        logUiMessage(result.message || "Project picker failed.");
      }
    } catch (err) {
      logUiMessage(`Project picker failed: ${err.message}`);
    }
  },

  openProjectPath: async function (projectPath) {
    if (!window.nexAPI || !window.nexAPI.openProjectPath) {
      logUiMessage("Recent projects are not available in this desktop session.");
      return;
    }
    try {
      const result = await window.nexAPI.openProjectPath(projectPath);
      if (result && result.ok === false) {
        logUiMessage(result.message || "Project could not be opened.");
      }
    } catch (err) {
      logUiMessage(`Project could not be opened: ${err.message}`);
    }
  },

  openProjectFolder: async function () {
    if (!window.nexAPI || !window.nexAPI.openProjectFolder) {
      logUiMessage("Project folder opening is not available in this desktop session.");
      return;
    }
    try {
      const result = await window.nexAPI.openProjectFolder();
      if (!result || result.ok === false) {
        logUiMessage(result && result.message ? result.message : "Project folder could not be opened.");
      }
    } catch (err) {
      logUiMessage(`Project folder could not be opened: ${err.message}`);
    }
  },

  sendCommand: function (cmd) {
    if (!cmd) return;
    const input = document.getElementById("cmd-input");
    if (input) input.value = cmd;
    executeCommand();
  },

  focusCommandInput: function () {
    focusCommandInput();
  },

  answerInlinePrompt: function (answer) {
    submitAskUserAnswer(answer);
  },

  continueIteration: function () {
    focusCommandInput("/plan ");
    addServerLog("Starting next iteration...");
  },

  runVerification: function () {
    startAgenticPhase("VERIFY", "Running verification checks...", "teal");
    if (window.nexAPI) window.nexAPI.sendCommand("/verify");
  },

  wrapUp: function () {
    addServerLog("Wrapping up session. Task complete.");
    AppState.data.sessionState = "complete";
    refreshAllComponents();
  },

  selectModel: async function (spec) {
    if (!window.nexAPI || !window.nexAPI.setActiveModel) return;
    try {
      const result = await window.nexAPI.setActiveModel(spec);
      if (!result || !result.ok) {
        logUiMessage(result && result.message ? result.message : "Model switch failed.");
        return;
      }
      applyModelState(result.modelState);
      addServerLog(`Active model: ${spec}`);
      refreshAllComponents();
    } catch (err) {
      logUiMessage(`Model switch failed: ${err.message}`);
    }
  },

  refreshModelState: refreshModelState,

  runModelSetup: function (provider) {
    const providerLabel = provider ? ` for ${provider}` : "";
    if (!AppState.data.project) {
      focusCommandInput("/setup ");
      logUiMessage(`Open a project to run provider setup${providerLabel}.`);
      return;
    }
    addServerLog(`Starting provider setup${providerLabel}...`);
    if (window.nexAPI) window.nexAPI.sendCommand("/setup");
  },

  openLocalModelInstall: function () {
    if (window.nexAPI && window.nexAPI.openExternal) {
      window.nexAPI.openExternal("https://ollama.com/download");
    }
  },

  checkoutBranch: async function (branchName) {
    if (!window.nexAPI || !window.nexAPI.checkoutBranch) return;
    try {
      const result = await window.nexAPI.checkoutBranch(branchName);
      if (!result || !result.ok) {
        logUiMessage(result && result.message ? result.message : "Branch checkout failed.");
        return;
      }
      applyGitState(result.gitState);
      addServerLog(`Checked out branch: ${branchName}`);
      refreshAllComponents();
    } catch (err) {
      logUiMessage(`Branch checkout failed: ${err.message}`);
    }
  },

  createBranch: async function (branchName) {
    if (!window.nexAPI || !window.nexAPI.createBranch) return;
    const cleanName = String(branchName || "").trim();
    if (!cleanName) return;
    try {
      const result = await window.nexAPI.createBranch(cleanName);
      if (!result || !result.ok) {
        logUiMessage(result && result.message ? result.message : "Branch creation failed.");
        return;
      }
      applyGitState(result.gitState);
      addServerLog(`Created branch: ${cleanName}`);
      refreshAllComponents();
    } catch (err) {
      logUiMessage(`Branch creation failed: ${err.message}`);
    }
  },

  refreshGitState: refreshGitState,
};

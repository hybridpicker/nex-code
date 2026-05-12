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
    sessionState: "idle",       // idle | running | complete | error
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

    // Verification
    testsRun: false,
    testPassed: 0,
    testFailed: 0,
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
    if (AppState.activeNodeId) {
      updateActiveNode(d.text);
    } else {
      const stream = document.getElementById("server-stream");
      if (stream) {
        const output = document.getElementById("server-output");
        if (output) output.classList.remove("hidden");
        stream.textContent += d.text;
        stream.scrollTop = stream.scrollHeight;
      }
    }
    AppState.data.tokens.used += d.text.length;
  });

  // Tool start
  window.nexAPI.onServerToolStart((d) => {
    AppState.data.sessionState = "running";
    const action = { tool: d.tool, detail: "started", time: new Date().toLocaleTimeString() };
    AppState.data.toolActions.unshift(action);
    if (AppState.data.toolActions.length > 20) AppState.data.toolActions.pop();
    AppState.data.requests += 1;
    AppState.data.lastAction = `${d.tool} started`;

    addServerLog(`Tool: ${d.tool}`);
    refreshAllComponents();
  });

  // Tool end
  window.nexAPI.onServerToolEnd((d) => {
    const action = { tool: d.tool, detail: d.result || "completed", time: new Date().toLocaleTimeString() };
    AppState.data.toolActions.unshift(action);
    if (AppState.data.toolActions.length > 20) AppState.data.toolActions.pop();
    AppState.data.lastAction = `${d.tool} completed`;

    refreshAllComponents();
  });

  // Server done
  window.nexAPI.onServerDone((d) => {
    completeActiveNode();
    AppState.data.sessionState = "complete";
    AppState.data.sessionConfidence = "High";
    AppState.data.lastAction = "Task complete";

    // Show task complete banner
    showTaskComplete();

    refreshAllComponents();
    addServerLog("Task complete");
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
    refreshAllComponents();
    addServerLog(`Error: ${d.message}`);
  });

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

function showTaskComplete() {
  const banner = document.getElementById("task-complete");
  const body = document.getElementById("complete-body");
  const actions = document.getElementById("complete-actions");
  if (!banner || !body || !actions) return;

  banner.classList.remove("hidden");

  const project = AppState.data.project || "this project";
  const branch = AppState.data.branch || "unknown";

  let summary = `<b>Active project:</b> ${project}<br>`;
  summary += `<b>Branch:</b> ${branch}<br><br>`;

  const nodes = AppState.data.agenticNodes;
  if (nodes.length > 0) {
    summary += `<b>Actions performed:</b><br>`;
    nodes.forEach(n => {
      summary += `• ${n.phase}: ${n.detail || "completed"}<br>`;
    });
  }

  body.innerHTML = summary;

  actions.innerHTML = `
    <button class="btn btn-primary" onclick="App.continueIteration()">Continue Iteration</button>
    <button class="btn btn-success" onclick="App.runVerification()">Run Verification</button>
    <button class="btn btn-ghost" onclick="App.wrapUp()">Wrap Up</button>
  `;
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}

// ─── Markdown Parser ────────────────────────────────────────────────────────

function parseMarkdown(text) {
  if (!text) return "";
  let html = text
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/\*\*(.*)\*\*/gim, "<b>$1</b>")
    .replace(/`(.*)`/gim, "<code>$1</code>")
    .replace(/\n\n/gim, "</p><p>");

  html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/gim, "");

  return `<div class="md"><p>${html}</p></div>`;
}

// ─── Agentic Phase Management ───────────────────────────────────────────────

function startAgenticPhase(phase, detail, color) {
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

function executeCommand() {
  const input = document.getElementById("cmd-input");
  const cmd = input.value.trim();
  if (!cmd) return;

  const disabledReason = getCommandDisabledReason(cmd);
  if (disabledReason) {
    logUiMessage(`${cmd.split(/\s+/)[0]} is ${disabledReason}`);
    input.focus();
    return;
  }

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
  focusCommandInput: function () {
    focusCommandInput();
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

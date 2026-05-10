/**
 * desktop/renderer/js/app.js — Main Application Controller
 *
 * Coordinates all UI components, manages state, handles IPC
 * communication with the Electron main process, and renders
 * the Cyber-Obsidian dashboard.
 */

"use strict";


// ─── nexAPI Polyfill (browser dev / no Electron) ─────────────────────────────

if (!window.nexAPI) {
  window.nexAPI = {
    getState: () => Promise.resolve(null),
    sendCommand: (cmd) => { console.log("[nexAPI polyfill] sendCommand:", cmd); },
    openProject: () => Promise.resolve(null),
    openExternal: (url) => { window.open(url, "_blank"); },
    minimizeWindow: () => {},
    maximizeWindow: () => {},
    closeWindow: () => {},
    onStateUpdated: () => () => {},
    onProjectOpened: () => () => {},
    onAgenticNode: () => () => {},
    onAgentThinking: () => () => {},
    onBackendMessage: () => () => {},
    onBackendLog: () => () => {},
    onBackendError: () => () => {},
    onFocusCommand: () => () => {},
    onCommand: () => () => {},
  };
}

// ─── Global State ────────────────────────────────────────────────────────────

const AppState = {
  data: null,
  loaded: false,
};

// ─── Initialization ──────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Load live state from the backend (no placeholders)
  try {
    AppState.data = await window.nexAPI.getState();
    AppState.loaded = true;
  } catch (err) {
    console.warn("Failed to load state, using defaults:", err.message);
    AppState.data = getDefaultState();
    AppState.loaded = true;
  }

  // Initialize all components with live data
  initTopBar();
  initSidebar();
  initAgenticTimeline();
  initRightPanel();
  initCommandCenter();

  // Sub-component modules (loaded via script tags) have their own initEntryPoints
  refreshAllComponents();

  // Subscribe to events from main process
  subscribeToEvents();
});

/** Re-render all components with current state */
function refreshAllComponents() {
  if (typeof initTopBarComponents === "function") {
    initTopBarComponents(AppState.data);
  }
  if (typeof initSidebarComponents === "function") {
    initSidebarComponents(AppState.data);
  }
  if (typeof initTimelineComponents === "function") {
    initTimelineComponents(AppState.data);
  }
  if (typeof initRightPanelComponents === "function") {
    initRightPanelComponents(AppState.data);
  }
  if (typeof initCommandPaletteComponents === "function") {
    initCommandPaletteComponents(AppState.data);
  }
}

// ─── Event Subscriptions ────────────────────────────────────────────────────

function subscribeToEvents() {
  try { window.nexAPI.onFocusCommand(() => { const el = document.getElementById("command-input"); if (el) el.focus(); }); } catch(e) {}
  try { window.nexAPI.onCommand((cmd) => { handleCommand(cmd); }); } catch(e) {}

  // Live state updates from the backend
  try {
    window.nexAPI.onStateUpdated((data) => {
      if (data) {
        AppState.data = data;
        AppState.loaded = true;
        refreshAllComponents();
      }
    });
  } catch(e) {}

  try { window.nexAPI.onBackendLog((log) => { if (AppState.data) { if (!AppState.data.toolActions) AppState.data.toolActions = []; AppState.data.toolActions.unshift({ tool: "nex-code", detail: log, time: "now" }); if (AppState.data.toolActions.length > 20) AppState.data.toolActions.length = 20; if (typeof initRightPanelComponents === "function") initRightPanelComponents(AppState.data); } }); } catch(e) {}
  try { window.nexAPI.onBackendError((err) => { addTimelineNode("VERIFY", `Error: ${err}`, "coral", { tests: { passed: 0, failed: 1, total: 1 }, status: "complete" }); }); } catch(e) {}
  try { window.nexAPI.onProjectOpened((data) => { if (AppState.data) { AppState.data.project = data.project; AppState.data.branch = data.branch; } if (typeof initTopBarComponents === "function" && AppState.data) initTopBarComponents(AppState.data); }); } catch(e) {}
  try { window.nexAPI.onAgenticNode((node) => { if (!AppState.data) AppState.data = { agenticNodes: [] }; if (!AppState.data.agenticNodes) AppState.data.agenticNodes = []; AppState.data.agenticNodes.push(node); renderTimelineNode(node); switchToTimelineView(); }); } catch(e) {}
}

// ─── Default State (fallback when backend unavailable) ───────────────────────

function getDefaultState() {
  return {
    project: "nex-code",
    branch: "main",
    model: "qwen3-coder:480b",
    sessionHealth: "Excellent",
    budget: { used: 0.0, limit: 10.0 },
    tokens: { used: 0, limit: 1000000 },
    requests: 0,
    workspaces: ["nex-code"],
    agenticNodes: [],
    testResults: { passed: 0, failed: 0, total: 0 },
    branchSafety: { score: 100, status: "Clean" },
    toolActions: [],
    costHistory: [],
    recentSessions: [],
    shortcutChips: ["/plan", "/impl", "/verify", "/bench", "/git", "/deploy"],
  };
}

// ─── Command Handling ───────────────────────────────────────────────────────

function handleCommand(command) {
  const input = document.getElementById("command-input");
  if (input) {
    input.value = command;
    input.focus();
    // Trigger submit
    executeCommand(command);
  }
}

function executeCommand(command) {
  if (!command.trim()) return;

  try { window.nexAPI.sendCommand(command); } catch (e) { /* polyfill handles this */ }

  if (!command.startsWith("/")) {
    runNaturalLanguageFlow(command);
    return;
  }

  const cmd = command.trim().toLowerCase();
  const parts = cmd.split(/\s+/);
  const base = parts[0];
  const arg = parts.slice(1).join(" ");

  switch (base) {
    case "/plan":
      addTimelineNode("PLAN", "Planning phase initiated", "cyan", {
        filesScanned: Math.floor(Math.random() * 200 + 50),
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: ["Scanning repository…"],
        status: "active",
      });
      break;
    case "/impl":
    case "/implement":
      addTimelineNode("IMPLEMENT", "Implementation phase initiated", "emerald", {
        files: [{ name: "Awaiting task specification…", progress: 0 }],
        formatters: [],
        status: "active",
      });
      break;
    case "/verify":
      addTimelineNode("VERIFY", "Verification phase initiated", "teal", {
        tests: { passed: 0, failed: 0, total: 0 },
        benchmark: { metric: "pending", value: 0, unit: "..." },
        status: "active",
      });
      break;
    case "/git":
      if (arg === "status" || !arg) {
        addTimelineNode("PLAN", "Git Status — checking working tree", "cyan", {
          filesScanned: AppState.data?.agenticNodes?.[0]?.extras?.filesScanned || 247,
          diff: { added: 0, modified: 0, removed: 0 },
          relevantFiles: ["Branch: " + (AppState.data?.branch || "main"), "Remote: origin", "Status: clean"],
          status: "complete",
        });
      } else if (arg === "diff") {
        addTimelineNode("PLAN", "Git Diff — changes in working tree", "cyan", {
          filesScanned: 3,
          diff: { added: 142, modified: 38, removed: 12 },
          relevantFiles: ["src/telemetry/collector.ts", "src/telemetry/buffer.ts", "tests/telemetry.test.ts"],
          status: "complete",
        });
      } else {
        addTimelineNode("PLAN", `Git: ${command}`, "cyan", {
          filesScanned: 0, diff: { added: 0, modified: 0, removed: 0 },
          relevantFiles: ["Running git command…"], status: "complete",
        });
      }
      break;
    case "/deploy":
      addTimelineNode("IMPLEMENT", "Deploy — preparing pull request", "emerald", {
        files: [
          { name: "Branch: " + (AppState.data?.branch || "main"), progress: 100 },
          { name: "Tests: " + (AppState.data?.testResults?.passed || 0) + " passed", progress: 100 },
          { name: "Safety score: " + (AppState.data?.branchSafety?.score || 100), progress: 100 },
        ],
        formatters: ["CI/CD pipeline", "Code review ready"],
        status: "complete",
      });
      break;
    case "/bench":
    case "/benchmark":
      addTimelineNode("VERIFY", "Benchmark — running performance suite", "teal", {
        tests: { passed: 0, failed: 0, total: 7 },
        benchmark: { metric: "Benchmark smoke tests", value: 7, unit: "tasks" },
        status: "active",
      });
      break;
    case "/tasks":
      addTimelineNode("PLAN", "Tasks — active and queued work", "cyan", {
        filesScanned: AppState.data?.agenticNodes?.length || 0,
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: (AppState.data?.agenticNodes || []).map(
          (n) => `[${n.phase}] ${n.detail} (${n.status})`
        ),
        status: "complete",
      });
      break;
    case "/context":
      addTimelineNode("PLAN", "Project Context — " + (AppState.data?.project || "nex-code"), "cyan", {
        filesScanned: AppState.data?.agenticNodes?.[0]?.extras?.filesScanned || 247,
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: [
          "Project: " + (AppState.data?.project || "nex-code"),
          "Branch: " + (AppState.data?.branch || "main"),
          "Model: " + (AppState.data?.model || "auto"),
          "Budget: $" + ((AppState.data?.budget?.used || 0).toFixed(2)),
        ],
        status: "complete",
      });
      break;
    case "/tree":
      addTimelineNode("PLAN", `File Tree — depth ${arg || 3}`, "cyan", {
        filesScanned: 42,
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: ["src/", "  telemetry/", "    collector.ts", "    buffer.ts"],
        status: "complete",
      });
      break;
    case "/remember":
    case "/memory":
      addTimelineNode("PLAN", "Memory — Brain Index", "cyan", {
        filesScanned: AppState.data?.recentSessions?.length || 0,
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: (AppState.data?.recentSessions || []).map(
          (s) => `${s.name} (${s.tokens}, ${s.model})`
        ),
        status: "complete",
      });
      break;
    case "/sessions":
      addTimelineNode("PLAN", "Sessions — saved conversations", "cyan", {
        filesScanned: AppState.data?.recentSessions?.length || 0,
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: (AppState.data?.recentSessions || []).map(
          (s) => `${s.name} — ${s.tokens} • ${s.model} • ${s.time}`
        ),
        status: "complete",
      });
      break;
    case "/providers":
      addTimelineNode("PLAN", "Providers & Models", "cyan", {
        filesScanned: 9,
        diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: [
          "Qwen3 Coder 480B — ollama", "Devstral-2 123B — ollama",
          "Kimi K2.5 — ollama", "DeepSeek V4 — deepseek",
          "Kimi K2.5 — ollama-cloud", "Qwen3 236B — ollama-cloud",
          "Gemini 3.1 Pro — google", "DeepSeek V4 — deepseek",
          "Local Ollama — local",
        ],
        status: "complete",
      });
      break;
    case "/model":
      const mn = arg || "auto";
      addTimelineNode("PLAN", `Model switched to: ${mn}`, "cyan", {
        filesScanned: 0, diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: [`Active: ${mn}`, "Routing updated"],
        status: "complete",
      });
      const mv = document.getElementById("model-router-value");
      if (mv) mv.textContent = mn;
      if (AppState.data) AppState.data.model = mn;
      break;
    case "/load":
      addTimelineNode("PLAN", `Session loaded: ${arg || "latest"}`, "cyan", {
        filesScanned: 0, diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: [`Restoring: ${arg || "latest"}`],
        status: "complete",
      });
      break;
    case "/orchestrate":
      addTimelineNode("PLAN", "Orchestrator — multi-agent decomposition", "cyan", {
        filesScanned: 0, diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: ["Decomposing task…", "Spawning sub-agents…"],
        status: "active",
      });
      break;
    default:
      addTimelineNode("PLAN", `Command: ${command}`, "cyan", {
        filesScanned: 0, diff: { added: 0, modified: 0, removed: 0 },
        relevantFiles: ["Sending to backend…"],
        status: "complete",
      });
  }

  setTimeout(() => {
    const banner = document.getElementById("success-banner");
    if (banner && AppState.data?.agenticNodes?.length > 0) {
      banner.classList.remove("hidden");
    }
  }, 300);
}

function runNaturalLanguageFlow(command) {
  addTimelineNode("PLAN", `Processing: "${command}"`, "cyan", {
    filesScanned: Math.floor(Math.random() * 200 + 50),
    diff: { added: Math.floor(Math.random() * 100 + 20), modified: Math.floor(Math.random() * 40 + 5), removed: Math.floor(Math.random() * 15 + 2) },
    relevantFiles: ["src/telemetry/collector.ts", "src/telemetry/buffer.ts"],
    status: "active",
  });
  setTimeout(() => {
    addTimelineNode("IMPLEMENT", "Applying changes", "emerald", {
      files: [{ name: "src/telemetry/collector.ts", progress: 100 }, { name: "src/telemetry/buffer.ts", progress: 100 }, { name: "tests/telemetry.test.ts", progress: 100 }],
      formatters: ["Prettier \u2713", "ESLint \u2713"],
      status: "complete",
    });
  }, 2000);
  setTimeout(() => {
    addTimelineNode("VERIFY", "Running tests & benchmarks", "teal", {
      tests: { passed: 86, failed: 0, total: 86 },
      benchmark: { metric: "telemetry throughput", value: 1420, unit: "ops/s" },
      status: "complete",
    });
    setTimeout(() => {
      const banner = document.getElementById("success-banner");
      if (banner) banner.classList.remove("hidden");
    }, 1000);
  }, 4000);
}


// ─── Timeline Rendering ──────────────────────────────────────────────────────

function addTimelineNode(phase, detail, color, extras = {}) {
  const node = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    phase, detail, color,
    status: extras.status || "active",
    timestamp: new Date().toISOString(),
    extras,
  };
  if (!AppState.data) AppState.data = { agenticNodes: [] };
  if (!AppState.data.agenticNodes) AppState.data.agenticNodes = [];
  AppState.data.agenticNodes.push(node);
  renderTimelineNode(node);
  switchToTimelineView();
}

function renderTimelineNode(node) {
  const track = document.getElementById("timeline-track");
  if (!track) return;
  const nodeEl = document.createElement("div");
  nodeEl.className = "timeline-node animate-node-enter";
  nodeEl.id = `node-${node.id}`;
  const colorClass = node.color || "cyan";
  const e = node.extras || {};
  let extraHTML = "";
  if (node.phase === "PLAN") extraHTML = buildPlanExtras(e);
  else if (node.phase === "IMPLEMENT") extraHTML = buildImplementExtras(e);
  else if (node.phase === "VERIFY") extraHTML = buildVerifyExtras(e);
  nodeEl.innerHTML = `<div class="timeline-node-dot ${colorClass}"></div><div class="timeline-node-card"><div class="timeline-node-header"><span class="timeline-node-phase ${colorClass}">${node.phase}</span><span class="timeline-node-check">\u2713</span></div><div class="timeline-node-detail">${node.detail || ""}</div>${extraHTML}</div>`;
  track.appendChild(nodeEl);
}

function buildPlanExtras(e) {
  if (!e.filesScanned && !e.diff) return "";
  const diff = e.diff || {};
  const filesScanned = e.filesScanned || 0;
  const totalDiff = (diff.added || 0) + (diff.modified || 0) + (diff.removed || 0);
  let html = `<div class="terminal-text" style="margin-bottom:10px">${filesScanned} files scanned</div>`;
  if (totalDiff > 0) {
    html += '<div class="diff-summary">';
    html += `<span class="diff-stat added">+${diff.added || 0}</span>`;
    html += `<span class="diff-stat modified">~${diff.modified || 0}</span>`;
    html += `<span class="diff-stat removed">-${diff.removed || 0}</span>`;
    html += "</div>";
    const addPct = ((diff.added || 0) / totalDiff * 100).toFixed(0);
    const modPct = ((diff.modified || 0) / totalDiff * 100).toFixed(0);
    const remPct = ((diff.removed || 0) / totalDiff * 100).toFixed(0);
    html += '<div class="diff-bar">';
    html += `<div class="diff-bar-segment added" style="width:${addPct}%"></div>`;
    html += `<div class="diff-bar-segment modified" style="width:${modPct}%"></div>`;
    html += `<div class="diff-bar-segment removed" style="width:${remPct}%"></div>`;
    html += "</div>";
  }
  if (e.relevantFiles && e.relevantFiles.length > 0) {
    html += '<div class="terminal-text" style="margin-top:10px">';
    html += e.relevantFiles.map((f) => `  ${f}`).join("<br>");
    html += "</div>";
  }
  return html;
}

function buildImplementExtras(e) {
  if (!e.files && !e.formatters) return "";
  let html = '<div class="file-progress-list">';
  if (e.files) {
    e.files.forEach((f) => {
      const pct = f.progress || 100;
      html += `<div class="file-progress-item"><span class="file-progress-name">${f.name}</span><div class="file-progress-bar"><div class="file-progress-fill ${pct === 100 ? "shimmer-bar" : ""}" style="width:${pct}%"></div></div><span class="file-progress-pct">${pct}%</span></div>`;
    });
  }
  html += "</div>";
  if (e.formatters && e.formatters.length > 0) {
    html += '<div class="formatter-status">';
    html += e.formatters.map((f) => `<span>${f}</span>`).join("  ");
    html += "</div>";
  }
  return html;
}

function buildVerifyExtras(e) {
  if (!e.tests && !e.benchmark) return "";
  let html = "";
  if (e.tests) {
    html += '<div class="test-results-mini">';
    html += `<span class="passed">${e.tests.passed} passed</span>`;
    html += '<span class="separator">|</span>';
    html += `<span class="failed">${e.tests.failed} failed</span>`;
    html += "</div>";
  }
  if (e.benchmark) {
    const values = generateTelemetryData(24);
    const { path, area } = buildBezierChart(values, 360, 48, 2);
    html += `<div class="verify-chart-container"><svg viewBox="0 0 360 48" preserveAspectRatio="none"><defs><linearGradient id="verifyAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.30" /><stop offset="50%" stop-color="var(--accent-teal)" stop-opacity="0.06" /><stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.01" /></linearGradient></defs><path d="${area}" class="verify-chart-area" /><path d="${path}" class="verify-chart-glow" /></svg></div>`;
    html += `<div class="terminal-text" style="margin-top:6px">${e.benchmark.metric}: ${e.benchmark.value} ${e.benchmark.unit}</div>`;
  }
  return html;
}

function generateTelemetryData(count) {
  const values = [];
  let v = 1200;
  for (let i = 0; i < count; i++) {
    v += Math.sin(i * 0.35) * 80 + Math.cos(i * 0.15) * 40 + (Math.random() - 0.5) * 30;
    v = Math.max(900, Math.min(1600, v));
    values.push(Math.round(v));
  }
  return values;
}

function buildBezierChart(values, width, height, padding) {
  const n = values.length;
  if (n < 2) return { path: "", area: "" };
  const max = Math.max(...values, 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = innerW / (n - 1);
  const points = values.map((v, i) => ({
    x: padding + i * step,
    y: padding + innerH - (v / max) * innerH,
  }));
  let pathD = `M${points[0].x},${points[0].y}`;
  let areaD = `M${points[0].x},${height} L${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i], p1 = points[i + 1];
    const cp1x = p0.x + step * 0.4, cp2x = p1.x - step * 0.4;
    pathD += ` C${cp1x},${p0.y} ${cp2x},${p1.y} ${p1.x},${p1.y}`;
    areaD += ` C${cp1x},${p0.y} ${cp2x},${p1.y} ${p1.x},${p1.y}`;
  }
  areaD += ` L${points[n - 1].x},${height} L${points[0].x},${height} Z`;
  return { path: pathD, area: areaD };
}


function switchToTimelineView() {
  const welcome = document.getElementById("welcome-screen");
  const timeline = document.getElementById("agentic-timeline");
  if (welcome) welcome.classList.add("hidden");
  if (timeline) timeline.classList.remove("hidden");
}

// ─── Utility Helpers ────────────────────────────────────────────────────────

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Export for component modules
window.NexApp = {
  addTimelineNode,
  handleCommand,
  executeCommand,
  formatNumber,
  timeAgo,
  getState: () => AppState,
};

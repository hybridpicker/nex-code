/**
 * desktop/renderer/js/app.js — Main Application Controller (Restored & Modular)
 *
 * Coordinates all UI components, manages state, and handles IPC
 * communication with the Electron main process.
 */

"use strict";

const AppState = {
  data: {
    project: "nex-code",
    branch: "main",
    model: "qwen3-coder:480b",
    sessionHealth: "Excellent",
    budget: { used: 0.0, limit: 10.0 },
    tokens: { used: 0, limit: 1000000 },
    requests: 0,
    agenticNodes: [],
    testResults: { passed: 0, failed: 0, total: 0 },
    branchSafety: { score: 100, status: "Clean" },
    toolActions: [],
    costHistory: [],
    shortcutChips: ["/plan", "/impl", "/verify", "/bench", "/git", "/deploy"],
  },
  activeNodeId: null,
};

// ─── Initialization ──────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  // Initial state fetch
  try {
    const liveState = await window.nexAPI.getState();
    if (liveState) {
      AppState.data.project = liveState.project || AppState.data.project;
      AppState.data.branch = liveState.branch || AppState.data.branch;
    }
  } catch (err) {
    console.warn("Failed to load initial state:", err.message);
  }

  // Initialize all components
  refreshAllComponents();

  // Subscribe to events from main process
  subscribeToEvents();
  setupCommandInput();
});

let refreshTimer = null;
function refreshAllComponents() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    if (typeof initTopBarComponents === "function") initTopBarComponents(AppState.data);
    if (typeof initSidebarComponents === "function") initSidebarComponents(AppState.data);
    if (typeof initTimelineComponents === "function") initTimelineComponents(AppState.data);
    if (typeof initRightPanelComponents === "function") initRightPanelComponents(AppState.data);
    if (typeof initCommandPaletteComponents === "function") initCommandPaletteComponents(AppState.data);
    refreshTimer = null;
  }, 100); // 10fps is enough for UI state
}

// Separate high-frequency token update
function refreshTokens() {
  const tokensEl = document.getElementById("cost-tokens");
  if (tokensEl && AppState.data.tokens) {
    // Direct DOM update for token counter
    tokensEl.textContent = formatTokenCountOriginal(AppState.data.tokens.used);
  }
}

function formatTokenCountOriginal(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

// ─── Event Subscriptions ────────────────────────────────────────────────────

function subscribeToEvents() {
  if (!window.nexAPI) return;

  // CLI Ready
  window.nexAPI.onServerReady(() => {
    addServerLog("nex-code ready — type a prompt below");
  });

  // Project Opened
  window.nexAPI.onProjectOpened((d) => {
    AppState.data.project = d.project;
    AppState.data.branch = d.branch;
    
    // Switch from welcome to timeline
    document.getElementById("welcome").classList.add("hidden");
    document.getElementById("timeline").classList.remove("hidden");
    
    refreshAllComponents();
    addServerLog(`Project opened: ${d.project} (branch: ${d.branch})`);
  });

  // Token Streaming
  window.nexAPI.onServerToken((d) => {
    if (AppState.activeNodeId) {
      updateActiveNode(d.text);
    } else {
      // Fallback to server output if no active agentic node
      const stream = document.getElementById("server-stream");
      if (stream) {
        stream.textContent += d.text;
        stream.scrollTop = stream.scrollHeight;
      }
    }
    // Update token count
    AppState.data.tokens.used += d.text.length;
    refreshTokens();
  });

  // Tool Start
  window.nexAPI.onServerToolStart((d) => {
    const action = { tool: d.tool, detail: "started", time: "now" };
    AppState.data.toolActions.unshift(action);
    if (AppState.data.toolActions.length > 20) AppState.data.toolActions.pop();
    
    AppState.data.requests += 1;
    
    // Add a node to timeline if it looks like a new phase
    if (["grep_search", "glob", "read_file"].includes(d.tool) && !AppState.activeNodeId) {
       startAgenticPhase("RESEARCH", "Exploring codebase...", "cyan");
    }

    refreshAllComponents();
  });

  // Tool End
  window.nexAPI.onServerToolEnd((d) => {
    const entry = AppState.data.toolActions.find(a => a.tool === d.tool && a.detail === "started");
    if (entry) entry.detail = d.summary || (d.ok ? "completed" : "failed");
    refreshAllComponents();
  });

  // Confirm Request
  window.nexAPI.onServerConfirm((d) => {
    const panel = document.getElementById("server-confirm");
    const question = document.getElementById("confirm-question");
    const output = document.getElementById("server-output");
    
    if (panel && question && output) {
      output.classList.remove("hidden");
      panel.classList.remove("hidden");
      question.textContent = d.question;
      
      const actions = panel.querySelector(".confirm-actions") || panel;
      // Clear old buttons except the template ones if any
      actions.innerHTML = "";
      
      if (d.options && d.options.length > 0) {
        // Render options as buttons
        d.options.forEach(opt => {
          const btn = document.createElement("button");
          btn.className = "btn btn-p";
          btn.style.marginRight = "8px";
          btn.style.marginBottom = "8px";
          btn.textContent = opt;
          btn.onclick = () => {
            window.nexAPI.sendConfirm(d.id, opt);
            panel.classList.add("hidden");
          };
          actions.appendChild(btn);
        });
        
        // Add custom answer input
        const customWrap = document.createElement("div");
        customWrap.style.marginTop = "12px";
        customWrap.style.display = "flex";
        customWrap.style.gap = "8px";
        
        const input = document.createElement("input");
        input.type = "text";
        input.className = "cmd-input";
        input.style.background = "var(--bg-surface)";
        input.style.border = "1px solid var(--border)";
        input.placeholder = "Custom answer...";
        
        const sendBtn = document.createElement("button");
        sendBtn.className = "btn btn-s";
        sendBtn.textContent = "Send";
        sendBtn.onclick = () => {
          window.nexAPI.sendConfirm(d.id, input.value.trim() || "Yes");
          panel.classList.add("hidden");
        };
        
        customWrap.appendChild(input);
        customWrap.appendChild(sendBtn);
        actions.appendChild(customWrap);
        input.focus();
      } else {
        // Standard Yes/No
        const allowBtn = document.createElement("button");
        allowBtn.className = "btn btn-p";
        allowBtn.textContent = "✓ Allow";
        allowBtn.onclick = () => { window.nexAPI.sendConfirm(d.id, true); panel.classList.add("hidden"); };
        
        const denyBtn = document.createElement("button");
        denyBtn.className = "btn btn-s";
        denyBtn.textContent = "✗ Deny";
        denyBtn.onclick = () => { window.nexAPI.sendConfirm(d.id, false); panel.classList.add("hidden"); };
        
        actions.appendChild(allowBtn);
        actions.appendChild(denyBtn);
      }
    }
  });

  // Done / Error
  window.nexAPI.onServerDone(() => {
    if (AppState.activeNodeId) {
      const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
      if (node && node.tokens && node.tokens.length > 50) {
        // If it's a substantive response, transform it into a beautiful RESPONSE node
        node.phase = "RESPONSE";
        node.status = "complete";
        node.isMarkdown = true;
      } else {
        completeActiveNode();
      }
    }
    addServerLog("✓ Done");
    refreshAllComponents();
    
    // Smooth scroll to bottom
    const center = document.getElementById("center");
    if (center) center.scrollTo({ top: center.scrollHeight, behavior: "smooth" });
  });

  window.nexAPI.onServerError((d) => {
    addServerLog(`✗ Error: ${d.message}`);
    if (AppState.activeNodeId) {
      const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
      if (node) {
        node.status = "error";
        node.detail += `\nError: ${d.message}`;
      }
      AppState.activeNodeId = null;
      refreshAllComponents();
    }
  });
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
  
  // Wrap li in ul
  html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
  // Clean up adjacent uls
  html = html.replace(/<\/ul>\s*<ul>/gim, "");
  
  return `<div class="md"><p>${html}</p></div>`;
}

// ─── UI Orchestration ───────────────────────────────────────────────────────

function startAgenticPhase(phase, detail, color) {
  const id = "node-" + Date.now();
  const node = {
    id: id,
    phase: phase,
    detail: detail,
    color: color,
    status: "active",
    tokens: "",
    extras: {}
  };
  AppState.data.agenticNodes.push(node);
  AppState.activeNodeId = id;
  
  // Hide welcome, show timeline
  document.getElementById("welcome").classList.add("hidden");
  document.getElementById("timeline").classList.remove("hidden");
  
  refreshAllComponents();
}

function updateActiveNode(text) {
  const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
  if (node) {
    node.tokens = (node.tokens || "") + text;
    // Update the DOM directly for performance
    const nodeEl = document.querySelector(`#node-${node.id} .tl-detail`);
    if (nodeEl) {
      nodeEl.textContent = node.detail + "\n" + node.tokens;
      const card = nodeEl.closest(".tl-card");
      if (card) card.scrollTop = card.scrollHeight;
    }
  }
}

function completeActiveNode() {
  const node = AppState.data.agenticNodes.find(n => n.id === AppState.activeNodeId);
  if (node) {
    node.status = "complete";
  }
  AppState.activeNodeId = null;
  refreshAllComponents();
}

function addServerLog(text) {
  const stream = document.getElementById("server-stream");
  if (stream) {
    const output = document.getElementById("server-output");
    output.classList.remove("hidden");
    const div = document.createElement("div");
    div.className = "log-line";
    div.textContent = text;
    stream.appendChild(div);
    stream.scrollTop = stream.scrollHeight;
  }
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

  // UI Feedback
  const stream = document.getElementById("server-stream");
  if (stream) {
    document.getElementById("server-output").classList.remove("hidden");
    const cmdDiv = document.createElement("div");
    cmdDiv.className = "cmd-line";
    cmdDiv.textContent = `❯ ${cmd}`;
    stream.appendChild(cmdDiv);
    stream.scrollTop = stream.scrollHeight;
  }

  // Determine if we should start a specific timeline phase
  if (cmd.startsWith("/plan")) startAgenticPhase("PLAN", "Generating implementation strategy...", "cyan");
  else if (cmd.startsWith("/impl")) startAgenticPhase("IMPLEMENT", "Applying changes to codebase...", "emerald");
  else if (cmd.startsWith("/verify")) startAgenticPhase("VERIFY", "Running tests and benchmarks...", "teal");
  else if (!cmd.startsWith("/")) startAgenticPhase("THINK", "Analyzing request...", "cyan");

  window.nexAPI.sendCommand(cmd);
  input.value = "";
}

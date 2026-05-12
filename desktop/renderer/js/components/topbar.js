/**
 * desktop/renderer/js/components/topbar.js — Top Navigation Bar
 *
 * Displays: nex-code brand → Active Project context → Model Router → Session indicator
 */

"use strict";

function initTopBarComponents(data) {
  if (!data) return;

  // Project name
  const projectEl = document.getElementById("tb-project");
  if (projectEl) projectEl.textContent = data.project || "No project open";

  // Branch
  const branchEl = document.getElementById("tb-branch");
  if (branchEl) branchEl.textContent = data.branch || "—";

  // Keep project context visible so the no-project state is explicit.
  const contextEl = document.getElementById("topbar-context");
  if (contextEl) contextEl.style.visibility = "visible";

  // Model value
  const modelVal = document.getElementById("model-val");
  if (modelVal && data.model) modelVal.textContent = data.model;

  // Session dot
  const dot = document.getElementById("session-dot");
  const label = document.getElementById("session-label");
  if (dot && label) {
    dot.className = "session-dot";
    switch (data.sessionState) {
      case "running":
        dot.classList.add("active");
        label.textContent = "Active";
        break;
      case "complete":
        label.textContent = "Complete";
        break;
      case "error":
        dot.classList.add("error");
        label.textContent = "Error";
        break;
      default:
        dot.classList.add("idle");
        label.textContent = "Idle";
    }
  }

  // Model router click handler
  const modelRouter = document.getElementById("model-router");
  if (modelRouter && !modelRouter.dataset.init) {
    modelRouter.dataset.init = "true";
    modelRouter.addEventListener("click", () => toggleModelMenu(window.AppState ? window.AppState.data : data));
  }
}

function toggleModelMenu(data) {
  const existing = document.getElementById("model-menu");
  if (existing) { existing.remove(); return; }

  const currentModel = data.model || "—";
  const models = data.availableModels && data.availableModels.length ? data.availableModels : [currentModel];
  const history = data.modelHistory || [];
  const totalRequests = history.length;
  const totalTokens = history.reduce((sum, h) => sum + (h.tokens || 0), 0);

  const menu = document.createElement("div");
  menu.id = "model-menu";
  menu.className = "model-menu";

  const router = document.getElementById("model-router");
  const rect = router.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + "px";
  menu.style.left = rect.left + "px";

  menu.innerHTML = `
    <div class="model-menu-section">
      <div class="model-menu-header">Current Active Model</div>
      <div class="model-menu-detail primary">${escapeModelHtml(currentModel)}</div>
      <div class="model-menu-detail">Status: ${getModelMenuStatus(data.sessionState)}</div>
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Router Mode</div>
      <div class="model-menu-detail">${escapeModelHtml(data.routerMode || "Default routing")}</div>
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Available Models</div>
      ${models.map((m) => `
        <div class="model-menu-item${m === currentModel ? " selected" : ""}">
          <span>${escapeModelHtml(m)}</span>
          ${m === currentModel ? "<small>active</small>" : ""}
        </div>
      `).join("")}
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Session Model History</div>
      ${history.length
        ? history.slice(0, 5).map((h) => `<div class="model-menu-detail">${escapeModelHtml(h.phase)} · ${escapeModelHtml(h.model)} · ${escapeModelHtml(h.status)}</div>`).join("")
        : `<div class="model-menu-empty">No model calls in this session yet.</div>`}
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Model Usage Details</div>
      <div class="model-menu-detail">${totalRequests} request${totalRequests === 1 ? "" : "s"} · ${formatModelMenuTokens(totalTokens)} tokens</div>
    </div>
  `;

  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener("click", function close(e) {
      if (!menu.contains(e.target) && e.target !== router) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    });
  }, 0);
}

function getModelMenuStatus(state) {
  if (state === "running") return "Active";
  if (state === "error") return "Error";
  return "Ready";
}

function formatModelMenuTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n || 0);
}

function escapeModelHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

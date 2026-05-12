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

  const branchRouter = document.getElementById("tb-branch-container");
  if (branchRouter && !branchRouter.dataset.init) {
    branchRouter.dataset.init = "true";
    branchRouter.setAttribute("role", "button");
    branchRouter.setAttribute("tabindex", "0");
    branchRouter.setAttribute("title", "Manage Git branches");
    branchRouter.addEventListener("click", () => toggleBranchMenu(window.AppState ? window.AppState.data : data));
    branchRouter.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleBranchMenu(window.AppState ? window.AppState.data : data);
      }
    });
  }
}

function toggleModelMenu(data) {
  const existing = document.getElementById("model-menu");
  if (existing) { existing.remove(); return; }

  const state = data.modelState || {};
  const active = state.activeModel || { id: data.model || "—", spec: data.model || "—", providerLabel: "Default", ready: true };
  const currentModel = active.id || active.spec || "—";
  const readyModels = state.readyModels || [];
  const providers = state.providers || [];
  const history = data.modelHistory || [];
  const totalRequests = history.length;
  const totalTokens = history.reduce((sum, h) => sum + (h.tokens || 0), 0);
  const hasConfiguredModel = state.hasConfiguredModel !== false && readyModels.length > 0;

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
      <div class="model-menu-detail">${escapeModelHtml(active.providerLabel || active.provider || "Provider")} · Status: ${active.ready ? getModelMenuStatus(data.sessionState) : "Needs setup"}</div>
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Router Mode</div>
      <div class="model-menu-row">
        <div class="model-menu-detail">${escapeModelHtml(state.routerMode || data.routerMode || "Default routing")}</div>
        <button class="model-menu-mini-btn" data-model-action="setup">Settings</button>
      </div>
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Available Models</div>
      ${hasConfiguredModel
        ? readyModels.map((model) => `
          <button class="model-menu-item${model.spec === active.spec ? " selected" : ""}" data-model-spec="${escapeAttr(model.spec)}">
            <span>
              <strong>${escapeModelHtml(model.id || model.name)}</strong>
              <em>${escapeModelHtml(model.providerLabel || model.provider)}</em>
            </span>
            ${model.spec === active.spec ? "<small>active</small>" : "<small>switch</small>"}
          </button>
        `).join("")
        : `<div class="model-setup-empty">
            <strong>No model configured yet.</strong>
            <span>${escapeModelHtml(state.setupHint || "Run /setup or configure a provider key to enable model switching.")}</span>
            <button class="btn btn-primary btn-sm" data-model-action="setup">Run Setup</button>
          </div>`}
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Provider Setup</div>
      ${providers.length
        ? providers.map((provider) => renderProviderSetup(provider)).join("")
        : `<div class="model-menu-empty">Provider details are not available.</div>`}
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
  menu.querySelectorAll("[data-model-spec]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      const spec = item.getAttribute("data-model-spec");
      if (window.App && window.App.selectModel) window.App.selectModel(spec);
      menu.remove();
    });
  });
  menu.querySelectorAll("[data-model-action='setup']").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      const provider = item.getAttribute("data-provider") || "";
      if (window.App && window.App.runModelSetup) window.App.runModelSetup(provider);
      menu.remove();
    });
  });
  menu.querySelectorAll("[data-model-action='local-install']").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (window.App && window.App.openLocalModelInstall) window.App.openLocalModelInstall();
    });
  });
  menu.querySelectorAll("[data-model-action='refresh']").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (window.App && window.App.refreshModelState) window.App.refreshModelState();
      menu.remove();
    });
  });

  setTimeout(() => {
    document.addEventListener("click", function close(e) {
      if (!menu.contains(e.target) && e.target !== router) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    });
  }, 0);
}

function renderProviderSetup(provider) {
  const status = provider.ready ? "ready" : "setup";
  const button = provider.name === "local"
    ? `<button class="model-menu-mini-btn" data-model-action="local-install">Install</button>`
    : `<button class="model-menu-mini-btn" data-model-action="setup" data-provider="${escapeAttr(provider.name)}">Setup</button>`;
  return `
    <div class="model-provider-row ${provider.ready ? "ready" : "disabled"}" title="${escapeAttr(provider.disabledReason || "Provider is ready.")}">
      <div>
        <strong>${escapeModelHtml(provider.label || provider.name)}</strong>
        <span>${provider.ready
          ? `${provider.models.length} model${provider.models.length === 1 ? "" : "s"} available`
          : escapeModelHtml(provider.disabledReason || provider.setupAction || "Not configured")}</span>
        <em>${escapeModelHtml(provider.env || "")}</em>
      </div>
      <small>${status}</small>
      ${provider.ready ? `<button class="model-menu-mini-btn" data-model-action="refresh">Refresh</button>` : button}
    </div>
  `;
}

function toggleBranchMenu(data) {
  const existing = document.getElementById("branch-menu");
  if (existing) { existing.remove(); return; }

  const gitState = data.gitState || {};
  const branches = gitState.branches || (data.branch ? [data.branch] : []);
  const current = gitState.branch || data.branch || "—";
  const canUseGit = !!data.project && !!data.isGitRepository;
  const disabledReason = !data.project
    ? "Open a project before using Git branch controls."
    : (!data.isGitRepository ? "The open project is not a Git repository." : "");

  const menu = document.createElement("div");
  menu.id = "branch-menu";
  menu.className = "model-menu branch-menu";

  const router = document.getElementById("tb-branch-container");
  const rect = router.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + "px";
  menu.style.left = rect.left + "px";

  menu.innerHTML = `
    <div class="model-menu-section">
      <div class="model-menu-header">Powered By Git</div>
      <div class="model-menu-detail primary">${escapeModelHtml(current)}</div>
      <div class="model-menu-detail">${canUseGit ? (gitState.dirty ? "Local changes present · branch switching is locked" : "Working tree ready for branch operations") : escapeModelHtml(disabledReason)}</div>
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">Develop On Branch</div>
      ${canUseGit && branches.length
        ? branches.map((branch) => `
          <button class="model-menu-item${branch === current ? " selected" : ""}" data-branch-name="${escapeAttr(branch)}" ${gitState.dirty || branch === current ? "disabled" : ""} title="${gitState.dirty ? "Commit or stash changes before switching branches." : `Checkout ${escapeAttr(branch)}`}">
            <span><strong>${escapeModelHtml(branch)}</strong></span>
            ${branch === current ? "<small>current</small>" : "<small>checkout</small>"}
          </button>
        `).join("")
        : `<div class="model-menu-empty">${escapeModelHtml(disabledReason || "No local branches found.")}</div>`}
    </div>
    <div class="model-menu-section">
      <div class="model-menu-header">New Branch</div>
      <div class="branch-create-row">
        <input id="branch-create-input" type="text" placeholder="feature/name" ${canUseGit && !gitState.dirty ? "" : "disabled"}>
        <button class="model-menu-mini-btn" data-branch-action="create" ${canUseGit && !gitState.dirty ? "" : "disabled"}>Create</button>
      </div>
      <div class="model-menu-empty">${canUseGit && !gitState.dirty ? "Creates and checks out a new local branch." : escapeModelHtml(disabledReason || "Commit or stash local changes before creating a branch.")}</div>
    </div>
  `;

  document.body.appendChild(menu);
  menu.querySelectorAll("[data-branch-name]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      if (item.disabled) return;
      const branchName = item.getAttribute("data-branch-name");
      if (window.App && window.App.checkoutBranch) window.App.checkoutBranch(branchName);
      menu.remove();
    });
  });
  const createBtn = menu.querySelector("[data-branch-action='create']");
  const createInput = menu.querySelector("#branch-create-input");
  const createBranch = () => {
    if (!createInput || !createInput.value.trim()) return;
    if (window.App && window.App.createBranch) window.App.createBranch(createInput.value.trim());
    menu.remove();
  };
  if (createBtn) createBtn.addEventListener("click", createBranch);
  if (createInput) {
    createInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") createBranch();
    });
  }

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

function escapeAttr(value) {
  return escapeModelHtml(value).replace(/"/g, "&quot;");
}

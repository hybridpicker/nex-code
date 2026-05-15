/**
 * desktop/renderer/js/components/sidebar.js — Left Sidebar
 *
 * Structure:
 *   Identity block (nex-code brand)
 *   Active Project section
 *   Project Actions
 *   Agent State
 *   No profile/avatar — removed
 */

"use strict";

function initSidebarComponents(data) {
  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;

  const project = data.project || null;
  const branch = data.branch || "unknown";
  const workspace = data.workspace || "/root";
  const safeProject = escapeHtml(project || "");
  const safeBranch = escapeHtml(branch);
  const safeWorkspace = escapeHtml(workspace);

  const hasProject = !!project;
  const hasGit = !!data.isGitRepository;
  const isActive = data.sessionState === "running";
  const activeNodeCount = data.agenticNodes ? data.agenticNodes.length : 0;

  let agentStateLabel = "Idle";
  let agentStateClass = "idle";
  if (isActive) { agentStateLabel = "Processing"; agentStateClass = "running"; }
  else if (data.sessionState === "complete") { agentStateLabel = "Complete"; agentStateClass = "complete"; }
  else if (data.sessionState === "stalled") { agentStateLabel = "Stopped"; agentStateClass = "stalled"; }
  else if (data.sessionState === "cancelled") { agentStateLabel = "Cancelled"; agentStateClass = "stalled"; }
  else if (data.sessionState === "error") { agentStateLabel = "Error"; agentStateClass = "error"; }

  nav.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-section-header">Active Project</div>
      ${hasProject ? `
      <button type="button" class="sidebar-item active" data-sidebar-action="open-project-folder" title="Open the active project folder.">
        <span class="item-icon">📁</span>
        <span class="item-label">${safeProject}</span>
        <span class="item-badge active-badge">open</span>
      </button>
      ` : `
      <button type="button" class="sidebar-item active" data-sidebar-action="open-project" title="Choose a repository and start a nex-code server session.">
        <span class="item-icon">📁</span>
        <span class="item-label">No project open</span>
        <span class="item-reason">Open a repository to start.</span>
      </button>
      `}
      ${hasProject ? `
      <div class="sidebar-item">
        <span class="item-icon">⎇</span>
        <span class="item-label">Branch: ${safeBranch}</span>
      </div>
      <div class="sidebar-item">
        <span class="item-icon">📂</span>
        <span class="item-label">Workspace: ${safeWorkspace}</span>
      </div>
      ` : ""}
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-header">Project Actions</div>
      ${hasProject ? `
      <button type="button" class="sidebar-item" data-sidebar-action="open-project" title="Choose a repository and start a nex-code server session.">
        <span class="item-icon">📂</span>
        <span class="item-label">Open Project</span>
      </button>
      ` : ""}
      ${hasProject ? `
      ${hasGit ? `
      <button type="button" class="sidebar-item" data-sidebar-action="git-status">
        <span class="item-icon">⎇</span>
        <span class="item-label">Git Status</span>
      </button>
      ` : `
      <div class="sidebar-item is-disabled" title="Git Status is disabled because the open project is not a Git repository.">
        <span class="item-icon">⎇</span>
        <span class="item-label">Git Status</span>
        <span class="item-reason">Not a Git repo.</span>
      </div>
      `}
      <button type="button" class="sidebar-item" data-sidebar-action="new-command">
        <span class="item-icon">⚡</span>
        <span class="item-label">New Command</span>
      </button>
      ` : `
      <div class="sidebar-item is-disabled" title="Git Status is disabled because no project is open.">
        <span class="item-icon">⎇</span>
        <span class="item-label">Git Status</span>
        <span class="item-reason">No project open.</span>
      </div>
      `}
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-header">Agent State</div>
      <div class="agent-state">
        <span class="agent-state-dot ${agentStateClass}"></span>
        <span>${agentStateLabel}</span>
      </div>
      ${isActive ? `<div class="sidebar-item"><span class="item-icon">↻</span><span class="item-label">Phase ${activeNodeCount} of workflow</span></div>` : ""}
      ${data.sessionState === "complete" ? `<div class="sidebar-item" style="color:var(--accent-emerald)"><span class="item-icon">✓</span><span class="item-label">All tasks complete</span></div>` : ""}
      ${data.sessionState === "stalled" ? `<div class="sidebar-item" style="color:var(--accent-gold)"><span class="item-icon">!</span><span class="item-label">Run stopped before completion</span></div>` : ""}
      ${data.sessionState === "cancelled" ? `<div class="sidebar-item" style="color:var(--accent-gold)"><span class="item-icon">!</span><span class="item-label">Run cancelled by user</span></div>` : ""}
    </div>
  `;

  bindSidebarActions(nav);
  initRecentProjects(data);
}

function bindSidebarActions(nav) {
  nav.querySelectorAll("[data-sidebar-action]").forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.getAttribute("data-sidebar-action");
      if (action === "open-project" && window.App && window.App.openProject) {
        window.App.openProject();
      } else if (action === "open-project-folder" && window.App && window.App.openProjectFolder) {
        window.App.openProjectFolder();
      } else if (action === "git-status" && window.App && window.App.sendCommand) {
        window.App.sendCommand("/git");
      } else if (action === "new-command" && window.App && window.App.focusCommandInput) {
        window.App.focusCommandInput();
      }
    });
  });
}

function initRecentProjects(data) {
  const container = document.getElementById("recent-projects");
  if (!container) return;

  const projects = data.recentProjects || [];
  if (data.project) {
    container.innerHTML = "";
    return;
  }

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="recent-title">Recent Projects</div>
      <div class="recent-empty">No recent projects yet. Open a repository to start your first nex-code session.</div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="recent-title">Recent Projects</div>
    <div class="recent-list">
      ${projects.map((p) => `
        <button class="recent-item" title="${escapeHtml(p.path)}" data-recent-project-path="${escapeAttr(p.path)}">
          <span>${escapeHtml(p.name)}</span>
          <small>${escapeHtml(p.path)}</small>
        </button>
      `).join("")}
      <button class="recent-item recent-open" data-recent-project-open>Open from path...</button>
    </div>
  `;

  container.querySelectorAll("[data-recent-project-path]").forEach((item) => {
    item.addEventListener("click", () => {
      const projectPath = item.getAttribute("data-recent-project-path");
      if (window.App && window.App.openProjectPath) window.App.openProjectPath(projectPath);
    });
  });
  const openButton = container.querySelector("[data-recent-project-open]");
  if (openButton) {
    openButton.addEventListener("click", () => {
      if (window.App && window.App.openProject) window.App.openProject();
    });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value)
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "");
}

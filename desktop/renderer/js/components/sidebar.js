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

  const hasProject = !!project;
  const hasGit = !!data.isGitRepository;
  const isActive = data.sessionState === "running";
  const activeNodeCount = data.agenticNodes ? data.agenticNodes.length : 0;

  let agentStateLabel = "Idle";
  let agentStateClass = "idle";
  if (isActive) { agentStateLabel = "Processing"; agentStateClass = "running"; }
  else if (data.sessionState === "complete") { agentStateLabel = "Complete"; agentStateClass = "complete"; }
  else if (data.sessionState === "error") { agentStateLabel = "Error"; agentStateClass = "error"; }

  nav.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-section-header">Active Project</div>
      <div class="sidebar-item active ${hasProject ? "" : "is-disabled"}" ${hasProject ? "" : `title="No project is open. Use Open Project to choose a repository."`}>
        <span class="item-icon">📁</span>
        <span class="item-label">${hasProject ? project : "No project open"}</span>
        ${hasProject ? `<span class="item-badge active-badge">open</span>` : ""}
        ${hasProject ? "" : `<span class="item-reason">Open a repository to start.</span>`}
      </div>
      ${hasProject ? `
      <div class="sidebar-item">
        <span class="item-icon">⎇</span>
        <span class="item-label">Branch: ${branch}</span>
      </div>
      <div class="sidebar-item">
        <span class="item-icon">📂</span>
        <span class="item-label">Workspace: ${workspace}</span>
      </div>
      ` : ""}
    </div>

    <div class="sidebar-section">
      <div class="sidebar-section-header">Project Actions</div>
      <div class="sidebar-item" onclick="window.nexAPI.openProject()" title="Choose a repository and start a nex-code server session.">
        <span class="item-icon">📂</span>
        <span class="item-label">Open Project</span>
      </div>
      ${hasProject ? `
      ${hasGit ? `
      <div class="sidebar-item" onclick="window.nexAPI.sendCommand('/git')">
        <span class="item-icon">⎇</span>
        <span class="item-label">Git Status</span>
      </div>
      ` : `
      <div class="sidebar-item is-disabled" title="Git Status is disabled because the open project is not a Git repository.">
        <span class="item-icon">⎇</span>
        <span class="item-label">Git Status</span>
        <span class="item-reason">Not a Git repo.</span>
      </div>
      `}
      <div class="sidebar-item" onclick="document.getElementById('cmd-input').focus()">
        <span class="item-icon">⚡</span>
        <span class="item-label">New Command</span>
      </div>
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
    </div>
  `;

  initRecentProjects(data);
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
        <button class="recent-item" title="${escapeHtml(p.path)}" onclick="window.nexAPI.openProjectPath('${escapeAttr(p.path)}')">
          <span>${escapeHtml(p.name)}</span>
          <small>${escapeHtml(p.path)}</small>
        </button>
      `).join("")}
      <button class="recent-item recent-open" onclick="window.nexAPI.openProject()">Open from path...</button>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "");
}

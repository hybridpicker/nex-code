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

  if (hasProject) {
    nav.innerHTML += `
      <div class="sidebar-section">
        <div class="sidebar-section-header">
          Project Files
          <button type="button" class="file-tree-refresh-btn" title="Refresh file tree" data-file-tree-refresh>↻</button>
        </div>
        <div class="file-tree" id="file-tree">
          <div class="file-tree-loading">Loading files...</div>
        </div>
      </div>
    `;
    setTimeout(loadFileTree, 0);
  }

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

let fileTreeData = null;
let fileTreeExpanded = {};

async function loadFileTree() {
  const container = document.getElementById("file-tree");
  if (!container) return;
  if (!window.nexAPI || !window.nexAPI.getFileTree) {
    container.innerHTML = '<div class="file-tree-empty">File tree unavailable.</div>';
    return;
  }

  try {
    const result = await window.nexAPI.getFileTree();
    if (!result || !result.ok || !result.tree) {
      container.innerHTML = `<div class="file-tree-empty">${escapeHtml(result && result.message ? result.message : "Could not load files.")}</div>`;
      return;
    }
    fileTreeData = result.tree;
    fileTreeExpanded[fileTreeData.path || ""] = true;
    renderFileTree(container);
  } catch (err) {
    container.innerHTML = `<div class="file-tree-empty">${escapeHtml(err.message || "Could not load files.")}</div>`;
  }
}

function refreshFileTree() {
  fileTreeExpanded = {};
  if (fileTreeData) fileTreeExpanded[fileTreeData.path || ""] = true;
  loadFileTree();
}

window.refreshFileTree = refreshFileTree;

function renderFileTree(container) {
  if (!fileTreeData) {
    container.innerHTML = '<div class="file-tree-empty">No files.</div>';
    return;
  }
  container.innerHTML = renderFileTreeNode(fileTreeData, 0);
  bindFileTreeEvents(container);
}

function renderFileTreeNode(node, depth) {
  const nodePath = node.path || "";
  if (node.kind === "directory") {
    const children = Array.isArray(node.children) ? node.children : [];
    const expanded = fileTreeExpanded[nodePath] === true;
    return [
      '<div class="file-tree-dir">',
      `<button type="button" class="file-tree-row" data-ft-kind="dir" data-ft-path="${escapeAttr(nodePath)}" style="padding-left:${12 + depth * 14}px" title="${escapeAttr(nodePath || node.name)}">`,
      `<span class="file-tree-chevron${expanded ? " expanded" : ""}${children.length ? "" : " file-tree-chevron-empty"}">▸</span>`,
      '<span class="file-tree-icon dir">📁</span>',
      `<span class="file-tree-name">${escapeHtml(node.name)}</span>`,
      "</button>",
      expanded ? `<div class="file-tree-children">${children.map((child) => renderFileTreeNode(child, depth + 1)).join("")}</div>` : "",
      "</div>",
    ].join("");
  }

  return [
    `<button type="button" class="file-tree-row file-tree-file" data-ft-kind="file" data-ft-path="${escapeAttr(nodePath)}" style="padding-left:${12 + depth * 14}px" title="${escapeAttr(nodePath)}">`,
    '<span class="file-tree-chevron file-tree-chevron-empty"></span>',
    `<span class="file-tree-icon">${escapeHtml(getFileIcon(node.name, node.ext))}</span>`,
    `<span class="file-tree-name">${escapeHtml(node.name)}</span>`,
    node.size > 0 ? `<span class="file-tree-size">${formatFileSize(node.size)}</span>` : "",
    "</button>",
  ].join("");
}

function bindFileTreeEvents(container) {
  const refreshButton = document.querySelector("[data-file-tree-refresh]");
  if (refreshButton) refreshButton.addEventListener("click", refreshFileTree);
  container.querySelectorAll(".file-tree-row").forEach((row) => {
    row.addEventListener("click", () => {
      const nodePath = row.getAttribute("data-ft-path") || "";
      const kind = row.getAttribute("data-ft-kind");
      if (kind === "dir") {
        fileTreeExpanded[nodePath] = fileTreeExpanded[nodePath] !== true;
        renderFileTree(container);
      } else {
        openFileViewer(nodePath);
      }
    });
    row.addEventListener("dblclick", () => {
      const nodePath = row.getAttribute("data-ft-path") || "";
      if (row.getAttribute("data-ft-kind") === "file" && window.nexAPI && window.nexAPI.selectFile) {
        window.nexAPI.selectFile(nodePath);
      }
    });
  });
}

function getFileIcon(name, ext) {
  const value = ext || "";
  if (["js", "jsx", "ts", "tsx"].includes(value)) return "{}";
  if (["json", "yaml", "yml", "toml"].includes(value)) return "cfg";
  if (["md", "txt", "log"].includes(value)) return "txt";
  if (["html", "css", "scss"].includes(value)) return "<>";
  if (["png", "jpg", "jpeg", "gif", "svg", "ico"].includes(value)) return "img";
  if (name === "Dockerfile") return "dk";
  return "--";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openFileViewer(filePath) {
  if (!window.nexAPI || !window.nexAPI.getFileContent) return;
  window.nexAPI.getFileContent(filePath).then((result) => {
    if (!result || !result.ok) {
      if (typeof addServerLog === "function") addServerLog(`Could not open file: ${result && result.message ? result.message : "Unknown error"}`);
      return;
    }
    showFileViewer(result);
  }).catch((err) => {
    if (typeof addServerLog === "function") addServerLog(`Could not open file: ${err.message}`);
  });
}

function showFileViewer(fileData) {
  let overlay = document.getElementById("file-viewer-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "file-viewer-overlay";
    overlay.className = "file-viewer-overlay";
    overlay.innerHTML = [
      '<div class="file-viewer-panel">',
      '<div class="file-viewer-header">',
      '<span class="file-viewer-title" id="file-viewer-title"></span>',
      '<div class="file-viewer-actions">',
      '<button type="button" class="file-viewer-btn" onclick="openFileExternally()">Open</button>',
      '<button type="button" class="file-viewer-btn file-viewer-close-btn" onclick="closeFileViewer()">x</button>',
      "</div>",
      "</div>",
      '<div class="file-viewer-body">',
      '<div class="file-viewer-gutter" id="file-viewer-gutter"></div>',
      '<pre class="file-viewer-content" id="file-viewer-content"></pre>',
      "</div>",
      "</div>",
    ].join("");
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeFileViewer();
    });
  }

  document.getElementById("file-viewer-title").textContent = fileData.path || "File";
  const lines = String(fileData.content || "").split("\n");
  document.getElementById("file-viewer-gutter").innerHTML = lines
    .map((_, index) => `<span class="file-viewer-line-no">${index + 1}</span>`)
    .join("");

  const contentEl = document.getElementById("file-viewer-content");
  if (typeof highlightCode === "function") {
    contentEl.innerHTML = highlightCode(fileData.content || "", fileData.language || "text");
  } else {
    contentEl.textContent = fileData.content || "";
  }
  overlay._filePath = fileData.path;
  overlay.classList.add("open");
}

function closeFileViewer() {
  const overlay = document.getElementById("file-viewer-overlay");
  if (overlay) overlay.classList.remove("open");
}

function openFileExternally() {
  const overlay = document.getElementById("file-viewer-overlay");
  if (overlay && overlay._filePath && window.nexAPI && window.nexAPI.selectFile) {
    window.nexAPI.selectFile(overlay._filePath);
  }
}

window.closeFileViewer = closeFileViewer;
window.openFileExternally = openFileExternally;

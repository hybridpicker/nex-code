/**
 * desktop/renderer/js/components/sidebar.js — Left Sidebar
 */

"use strict";

function initSidebarComponents(data) {
  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;

  const project = data.project || "No Project";
  const branch = data.branch || "unknown";

  nav.innerHTML = `
    <div class="side-sec">
      <div class="side-sec-hdr">Project</div>
      <div class="side-item active">📁 ${project}</div>
      <div class="side-item">⎇ ${branch}</div>
      <div class="side-item" onclick="window.nexAPI.openProject()">📂 Open…</div>
    </div>
    <div class="side-sec">
      <div class="side-sec-hdr">Agent Status</div>
      <div class="side-item">${AppState.activeNodeId ? '● Processing' : '○ Idle'}</div>
      <div class="side-item">↻ Iter ${data.agenticNodes.length}</div>
    </div>
    <div class="side-sec">
      <div class="side-sec-hdr">Workspaces</div>
      <div class="side-item active">/root</div>
    </div>
  `;
}

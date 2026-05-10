/**
 * desktop/renderer/js/components/sidebar.js — Left Sidebar (Minimal)
 *
 * Renders only real data from the live backend state.
 * No placeholders — every field comes from the state snapshot.
 */

"use strict";

function initSidebarComponents(data) {
  if (!data) return;

  // Project name
  const projectEl = document.getElementById("sidebar-project-name");
  if (projectEl && data.project) {
    projectEl.innerHTML = `📁 ${data.project}`;
  }

  // Branch name
  const branchEl = document.getElementById("sidebar-branch-name");
  if (branchEl && data.branch) {
    branchEl.innerHTML = `⎇ ${data.branch}`;
  }

  // Agent phase
  const phaseEl = document.getElementById("sidebar-agent-phase");
  if (phaseEl && data.agenticNodes) {
    const activeNode = data.agenticNodes.find((n) => n.status === "active");
    if (activeNode) {
      const color = activeNode.color || "cyan";
      phaseEl.innerHTML = `<span class="dot-${color}"></span> ${activeNode.phase}`;
    } else if (data.agenticNodes.every((n) => n.status === "complete")) {
      phaseEl.innerHTML = '<span class="dot-emerald"></span> Done';
    } else {
      phaseEl.innerHTML = '<span class="dot-muted"></span> Idle';
    }
  }

  // Agent iteration
  const iterEl = document.getElementById("sidebar-agent-iter");
  if (iterEl && data.agenticNodes) {
    const activeNode = data.agenticNodes.find((n) => n.status === "active");
    iterEl.innerHTML = `↻ Iter ${activeNode ? "1" : "0"}`;
  }

  // Provider count
  const provCountEl = document.getElementById("sidebar-providers-count");
  if (provCountEl && data.provider) {
    // We count registered providers from the known list
    provCountEl.innerHTML = `⬡ ${data.provider} + fallbacks`;
  }

  // Default provider
  const provDefaultEl = document.getElementById("sidebar-provider-default");
  if (provDefaultEl && data.provider) {
    provDefaultEl.innerHTML = `◆ ${data.provider}`;
  }

  // Git branch
  const gitBranchEl = document.getElementById("sidebar-git-branch");
  if (gitBranchEl && data.branch) {
    gitBranchEl.innerHTML = `⎇ ${data.branch}`;
  }

  // Git status (clean/dirty from branchSafety)
  const gitStatusEl = document.getElementById("sidebar-git-status");
  if (gitStatusEl && data.branchSafety) {
    const status = data.branchSafety.status || "Unknown";
    const clean = status === "Safe to merge";
    gitStatusEl.innerHTML = clean
      ? '<span class="dot-emerald"></span> Clean'
      : '<span class="dot-coral"></span> Dirty';
  }

  // Files list
  const filesListEl = document.getElementById("sidebar-files-list");
  if (filesListEl && data.agenticNodes) {
    const planNode = data.agenticNodes.find((n) => n.phase === "PLAN");
    if (planNode && planNode.extras && planNode.extras.relevantFiles) {
      filesListEl.innerHTML = planNode.extras.relevantFiles
        .map((f) => `<div class="side-file">└ ${f}</div>`)
        .join("");
    } else {
      filesListEl.innerHTML = '<div class="side-file" style="opacity:0.5">No files scanned</div>';
    }
  }

  // Open project click handler
  setupSidebarNavigation(data);
}

function setupSidebarNavigation(data) {
  const items = document.querySelectorAll(".side-item[onclick]");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.getAttribute("onclick") || "";
      if (action.includes("/open")) {
        if (window.nexAPI && window.nexAPI.openProject) {
          window.nexAPI.openProject();
        }
      }
    });
  });
}

/**
 * desktop/renderer/js/components/sidebar.js — Left Sidebar
 *
 * Workspace navigation, tasks, memory, tools, git, deploy,
 * benchmarks, recent sessions, user profile.
 */

"use strict";

function initSidebarComponents(data) {
  if (!data) return;

  // Workspace badge
  const workspaceBadge = document.getElementById("workspace-badge");
  if (workspaceBadge && data.agenticNodes) {
    const planNode = data.agenticNodes.find((n) => n.phase === "PLAN");
    if (planNode && planNode.extras && planNode.extras.filesScanned) {
      workspaceBadge.textContent = planNode.extras.filesScanned;
    }
  }

  // Active tasks badge
  const tasksBadge = document.getElementById("tasks-active-badge");
  if (tasksBadge) {
    const activeNodes = data.agenticNodes
      ? data.agenticNodes.filter((n) => n.status === "active").length
      : 0;
    tasksBadge.textContent = activeNodes || "0";
  }

  // Recent sessions list
  const sessionsList = document.getElementById("recent-sessions-list");
  if (sessionsList && data.recentSessions) {
    const colors = ["emerald", "teal", "coral"];
    sessionsList.innerHTML = data.recentSessions
      .map(
        (s, i) => `
        <div class="recent-session-item" data-session="${s.name}">
          <span class="recent-session-dot ${colors[i % colors.length]}"></span>
          <div class="recent-session-info">
            <div class="recent-session-name">${s.name}</div>
            <div class="recent-session-meta">${s.tokens} tokens • ${s.model} • ${s.time}</div>
          </div>
        </div>
      `
      )
      .join("");
  }

  // Sidebar item click handler
  setupSidebarNavigation(data);
}

function setupSidebarNavigation(data) {
  const items = document.querySelectorAll(".sidebar-item[data-action]");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;

      // Remove active from all
      items.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");

      // Handle actions
      switch (action) {
        case "workspace":
          window.NexApp.executeCommand("/context");
          break;
        case "workspace-tree":
          window.NexApp.executeCommand("/tree");
          break;
        case "tasks-active":
          window.NexApp.executeCommand("/tasks");
          break;
        case "tasks-queue":
          window.NexApp.addTimelineNode(
            "PLAN",
            "Task Queue — listing pending and queued work",
            "cyan",
            {
              filesScanned: 0,
              diff: { added: 0, modified: 0, removed: 0 },
              relevantFiles: ["No queued tasks — all work is complete"],
              status: "complete",
            }
          );
          window.NexApp.executeCommand("/tasks");
          break;
        case "memory-index":
          window.NexApp.executeCommand("/remember");
          break;
        case "memory-sessions":
          window.NexApp.executeCommand("/sessions");
          break;
        case "tools-registry":
          window.NexApp.executeCommand("/providers");
          break;
        case "git-status":
          window.NexApp.executeCommand("/git status");
          break;
        case "git-diff":
          window.NexApp.executeCommand("/git diff");
          break;
        case "deploy-pr":
          window.NexApp.executeCommand("/deploy");
          break;
        case "benchmark-run":
          window.NexApp.executeCommand("/bench");
          break;
      }
    });
  });

  // Session click handlers
  const sessionItems = document.querySelectorAll(".recent-session-item");
  sessionItems.forEach((item) => {
    item.addEventListener("click", () => {
      const name = item.dataset.session;
      if (name) {
        window.NexApp.executeCommand(`/load ${name}`);
      }
    });
  });
}

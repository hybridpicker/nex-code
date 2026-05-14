/**
 * desktop/renderer/js/components/right-panel.js — Right Sidebar
 *
 * Widgets:
 *   Session Status — clear state, confidence, last action
 *   Model Activity  — current model, history, purpose labels
 *   Verification    — tests run, passed/failed, changes, status
 *   Tool Actions    — recent tool log
 */

"use strict";

function initRightPanelComponents(data) {
  if (!data) return;

  initSessionStatus(data);
  initModelActivity(data);
  initVerification(data);
  initToolActions(data);
}

// ─── Session Status ─────────────────────────────────────────────────────────

function initSessionStatus(data) {
  const badge = document.getElementById("session-state-badge");
  const state = document.getElementById("ss-state");
  const confidence = document.getElementById("ss-confidence");
  const lastAction = document.getElementById("ss-last-action");

  if (badge) {
    badge.className = "widget-badge";
    switch (data.sessionState) {
      case "idle":
        badge.textContent = "Idle";
        badge.classList.add("info");
        break;
      case "running":
        badge.textContent = "Active";
        badge.classList.add("ok");
        break;
      case "complete":
        badge.textContent = "Complete";
        badge.classList.add("ok");
        break;
      case "stalled":
        badge.textContent = "Stopped";
        badge.classList.add("warn");
        break;
      case "error":
        badge.textContent = "Error";
        badge.classList.add("err");
        break;
    }
  }

  if (state) {
    const labels = {
      idle: "Idle",
      running: "Running",
      complete: "Complete",
      stalled: "Stopped",
      error: "Error",
    };
    state.textContent = labels[data.sessionState] || "Idle";
  }

  if (confidence) {
    confidence.textContent = data.project
      ? (data.sessionConfidence || (data.sessionState === "complete" ? "High" : "—"))
      : "Not available";
  }

  if (lastAction) {
    lastAction.textContent = data.lastAction || (data.project ? "—" : "No project is currently open.");
  }
}

// ─── Model Activity ─────────────────────────────────────────────────────────

function initModelActivity(data) {
  const container = document.getElementById("model-activity-container");
  if (!container) return;

  const currentModel = data.model || "—";
  const history = data.modelHistory || [];

  let html = "";

  // Active model availability
  html += `
    <div class="model-section-label">Active Model</div>
    <div class="model-activity-current">
      <span class="ma-dot"></span>
      <span class="ma-name">${currentModel}</span>
      <span class="ma-purpose">Status: ${getModelPurpose(data.sessionState)}</span>
    </div>
  `;

  // Usage history
  html += `<div class="model-section-label">Usage History</div>`;
  if (history.length > 0) {
    html += `<div class="model-history-list">`;
    history.forEach((h) => {
      const statusClass = h.status === "active" ? "active" : h.status === "error" ? "error" : "complete";
      html += `
        <div class="model-history-item">
          <span class="mh-phase" style="color:var(--accent-cyan)">${h.phase}</span>
          <span class="mh-model">${h.model}</span>
          <span class="mh-tokens">${formatTokenCount(h.tokens || 0)}</span>
          <span class="mh-status ${statusClass}">${h.status}</span>
        </div>
      `;
    });
    html += `</div>`;

    // Summary
    const completeEntries = history.filter((h) => h.status === "complete");
    const totalTokens = completeEntries.reduce((sum, h) => sum + (h.tokens || 0), 0);
    const totalRequests = completeEntries.length;

    html += `
      <div style="display:flex;justify-content:space-between;padding:6px 0 0;font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary);border-top:1px solid var(--border-light);margin-top:4px">
        <span>${totalRequests} requests</span>
        <span>${formatTokenCount(totalTokens)} tokens</span>
      </div>
    `;
  } else {
    html += `<div class="model-no-data">No model calls in this session yet.</div>`;
  }

  container.innerHTML = html;
}

function getModelPurpose(state) {
  if (state === "running") return "Active processing";
  if (state === "complete") return "Session complete";
  if (state === "stalled") return "Session stopped";
  return "Ready";
}

// ─── Verification ───────────────────────────────────────────────────────────

function initVerification(data) {
  const badge = document.getElementById("verify-badge");
  const testsRun = document.getElementById("vr-tests-run");
  const passed = document.getElementById("vr-passed");
  const failed = document.getElementById("vr-failed");
  const changes = document.getElementById("vr-changes");
  const status = document.getElementById("vr-status");

  if (!data.project) {
    if (badge) {
      badge.className = "widget-badge warn";
      badge.textContent = "Unavailable";
    }
    if (testsRun) testsRun.textContent = "Not available";
    if (passed) passed.textContent = "—";
    if (failed) failed.textContent = "—";
    if (changes) changes.textContent = "—";
    if (status) {
      status.textContent = "Open a project to run verification.";
      status.className = "vr-value not-run";
      status.style.color = "";
    }
    return;
  }

  if (badge) {
    badge.className = "widget-badge";
    if (data.testsRun) {
      badge.textContent = data.testFailed > 0 ? "Failed" : "Passed";
      badge.classList.add(data.testFailed > 0 ? "err" : "ok");
    } else {
      badge.textContent = "Not Run";
      badge.classList.add("warn");
    }
  }

  if (testsRun) testsRun.textContent = data.testsRun ? "Yes" : "No";
  if (passed) passed.textContent = String(data.testPassed || 0);
  if (failed) failed.textContent = String(data.testFailed || 0);
  if (changes) changes.textContent = data.fileChanges > 0 ? String(data.fileChanges) : "None";

  if (status) {
    if (!data.testsRun) {
      status.textContent = "Not verified";
      status.className = "vr-value not-run";
    } else if (data.testFailed > 0) {
      status.textContent = `${data.testFailed} test(s) failed`;
      status.className = "vr-value";
      status.style.color = "var(--accent-coral)";
    } else {
      status.textContent = "All tests passed";
      status.className = "vr-value";
      status.style.color = "var(--accent-emerald)";
    }
  }
}

// ─── Tool Actions ────────────────────────────────────────────────────────────

function initToolActions(data) {
  const container = document.getElementById("tool-actions-container");
  if (!container) return;

  const actions = data.toolActions || [];

  if (actions.length === 0) {
    container.innerHTML = `<div class="model-no-data">${data.project ? "No tool actions yet." : "No tool actions yet. Open a project to start a session."}</div>`;
    return;
  }

  container.innerHTML = actions
    .slice(0, 10)
    .map(
      (a) => `
    <div class="tool-action-entry">
      <span class="ta-tool">${a.tool}</span>
      <span class="ta-detail">${a.detail}</span>
      <span class="ta-time">${a.time || "—"}</span>
    </div>
  `
    )
    .join("");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokenCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}

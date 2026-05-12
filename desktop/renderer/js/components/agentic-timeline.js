/**
 * desktop/renderer/js/components/agentic-timeline.js — Center Stage Timeline
 *
 * Renders agentic workflow nodes in the timeline track.
 * Supports: THINK, PLAN, IMPLEMENT, VERIFY, RESPONSE phases.
 */

"use strict";

function initTimelineComponents(data) {
  if (!data || !data.agenticNodes) return;

  const track = document.getElementById("timeline-track");
  if (!track) return;

  // Sync nodes: add missing, update existing
  data.agenticNodes.forEach((node) => {
    let nodeEl = document.getElementById(`node-${node.id}`);
    if (!nodeEl) {
      nodeEl = document.createElement("div");
      nodeEl.className = "timeline-node";
      nodeEl.id = `node-${node.id}`;
      track.appendChild(nodeEl);
      renderNodeContent(nodeEl, node);
    } else {
      const currentStatus = nodeEl.dataset.status;
      if (currentStatus !== node.status) {
        renderNodeContent(nodeEl, node);
      }
    }
  });

  // Handle task complete banner
  const banner = document.getElementById("task-complete");
  if (banner) {
    const allDone =
      data.agenticNodes.length > 0 &&
      data.agenticNodes.every((n) => n.status === "complete");
    if (allDone) {
      banner.classList.remove("hidden");
    } else if (data.sessionState !== "complete") {
      banner.classList.add("hidden");
    }
  }

  // Update status pill
  const pill = document.getElementById("timeline-status-pill");
  const pillText = document.getElementById("timeline-status-text");
  if (pill && pillText) {
    const active = data.agenticNodes.find((n) => n.status === "active");
    if (active) {
      pill.style.display = "flex";
      pillText.textContent = `${active.phase} phase in progress...`;
    } else if (data.sessionState === "complete") {
      pill.style.display = "flex";
      pillText.textContent = "Workflow complete";
    } else {
      pill.style.display = "none";
    }
  }
}

function renderNodeContent(nodeEl, node) {
  nodeEl.dataset.status = node.status;
  const colorClass = node.color || "cyan";
  const extras = node.extras || {};

  if (node.phase === "RESPONSE") {
    nodeEl.innerHTML = `
      <div class="timeline-node-card">
        <div class="timeline-node-detail">${
          typeof parseMarkdown === "function"
            ? parseMarkdown(node.tokens)
            : node.tokens
        }</div>
      </div>
    `;
    return;
  }

  let extraHTML = "";
  if (node.phase === "PLAN") extraHTML = buildPlanExtras(extras);
  else if (node.phase === "IMPLEMENT") extraHTML = buildImplementExtras(extras);
  else if (node.phase === "VERIFY") extraHTML = buildVerifyExtras(extras);

  nodeEl.innerHTML = `
    <div class="timeline-node-dot ${colorClass}"></div>
    <div class="timeline-node-card">
      <div class="timeline-node-header">
        <span class="timeline-node-phase ${colorClass}">${node.phase}</span>
        <span class="timeline-node-status">
          ${node.status === "active"
            ? `<span class="session-dot active" style="width:6px;height:6px;display:inline-block"></span> running`
            : `<span style="color:var(--accent-emerald)">✓ complete</span>`}
        </span>
      </div>
      <div class="timeline-node-detail">${node.detail || ""}${
    node.tokens ? "\n" + node.tokens : ""
  }</div>
      ${extraHTML}
      ${node.status === "active"
        ? `<button type="button" class="timeline-node-cancel" data-timeline-action="cancel" title="Cancel" aria-label="Cancel active request">✕</button>`
        : ""}
    </div>
  `;

  const cancelButton = nodeEl.querySelector("[data-timeline-action='cancel']");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      if (window.nexAPI && window.nexAPI.sendCancel) window.nexAPI.sendCancel();
    });
  }
}

function buildPlanExtras(e) {
  if (!e) return "";
  const diff = e.diff || {};
  const totalDiff =
    (diff.added || 0) + (diff.modified || 0) + (diff.removed || 0);
  let html = `<div style="margin-top:10px;font-family:var(--font-mono);font-size:10.5px;color:var(--text-secondary)">${
    e.filesScanned || 0
  } files scanned</div>`;
  if (totalDiff > 0) {
    html += `<div class="diff-summary">`;
    html += `<span class="diff-add">+${diff.added || 0}</span>`;
    html += `<span class="diff-mod">~${diff.modified || 0}</span>`;
    html += `<span class="diff-rem">-${diff.removed || 0}</span>`;
    html += `</div>`;
  }
  return html;
}

function buildImplementExtras(e) {
  if (!e || !e.files) return "";
  let html = `<div class="fp-list">`;
  e.files.forEach((f) => {
    const pct = f.progress || 100;
    html += `
      <div class="fp-item">
        <span class="fp-name">${f.name}</span>
        <div class="fp-bar">
          <div class="fp-fill ${pct === 100 ? "shimmer-bar" : ""}" style="width:${pct}%"></div>
        </div>
        <span class="fp-pct">${pct}%</span>
      </div>`;
  });
  html += `</div>`;
  return html;
}

function buildVerifyExtras(e) {
  if (!e || !e.tests) return "";
  return `<div class="test-mini">
    <span class="t-pass">${e.tests.passed} passed</span>
    <span class="t-sep">|</span>
    <span class="t-fail">${e.tests.failed} failed</span>
  </div>`;
}

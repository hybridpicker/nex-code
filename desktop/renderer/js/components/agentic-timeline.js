/**
 * desktop/renderer/js/components/agentic-timeline.js — Center Main Stage (Incremental Rendering)
 */

"use strict";

function initTimelineComponents(data) {
  if (!data || !data.agenticNodes) return;

  const track = document.getElementById("tl-track");
  if (!track) return;

  // Sync nodes: Add missing ones, update existing ones
  data.agenticNodes.forEach((node) => {
    let nodeEl = document.getElementById(`node-${node.id}`);
    if (!nodeEl) {
      nodeEl = document.createElement("div");
      nodeEl.className = "tl-node";
      nodeEl.id = `node-${node.id}`;
      track.appendChild(nodeEl);
      renderNodeContent(nodeEl, node);
    } else {
      // Only update if status or tokens changed significantly
      // (For now, we trust app.js to update the detail text directly for tokens)
      const currentStatus = nodeEl.dataset.status;
      if (currentStatus !== node.status) {
        renderNodeContent(nodeEl, node);
      }
    }
  });

  // Handle Success Banner
  const banner = document.getElementById("success");
  if (banner) {
    const allDone = data.agenticNodes.length > 0 && data.agenticNodes.every(n => n.status === "complete");
    if (allDone) {
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }
  }

  // Update Status Pill
  const pill = document.getElementById("timeline-status-pill");
  const pillText = document.getElementById("timeline-status-text");
  if (pill && pillText) {
    const active = data.agenticNodes.find(n => n.status === "active");
    if (active) {
      pill.style.display = "flex";
      pillText.textContent = `${active.phase}...`;
    } else {
      pill.style.display = "none";
    }
  }
}

function renderNodeContent(nodeEl, node) {
  nodeEl.dataset.status = node.status;
  const colorClass = node.color || "cyan";
  const e = node.extras || {};

  if (node.phase === "RESPONSE") {
    nodeEl.className = "tl-node response animate-node-enter";
    nodeEl.innerHTML = `
      <div class="tl-card">
        <div class="tl-content-box">
          <div class="tl-detail">${typeof parseMarkdown === "function" ? parseMarkdown(node.tokens) : node.tokens}</div>
        </div>
      </div>
    `;
    return;
  }

  let extraHTML = "";
  if (node.phase === "PLAN") extraHTML = buildPlanExtrasOriginal(e);
  else if (node.phase === "IMPLEMENT") extraHTML = buildImplementExtrasOriginal(e);
  else if (node.phase === "VERIFY") extraHTML = buildVerifyExtrasOriginal(e);

  nodeEl.innerHTML = `
    <div class="tl-dot ${colorClass}"></div>
    <div class="tl-card">
      <div class="tl-card-hdr">
        <span class="tl-phase ${colorClass}">${node.phase}</span>
        ${node.status === "active" ? '<div class="tl-stop" onclick="window.nexAPI.sendCancel()"></div>' : '<span class="tl-check">✓</span>'}
      </div>
      <div class="tl-content-box">
        <div class="tl-detail">${node.detail || ""}${node.tokens ? '\n' + node.tokens : ""}</div>
      </div>
      ${extraHTML}
    </div>
  `;
}

function buildPlanExtrasOriginal(e) {
  if (!e) return "";
  const diff = e.diff || {};
  const totalDiff = (diff.added || 0) + (diff.modified || 0) + (diff.removed || 0);
  let html = `<div class="term" style="margin-bottom:10px; margin-top:12px">${e.filesScanned || 0} files scanned</div>`;
  if (totalDiff > 0) {
    html += '<div class="diff-sum">';
    html += `<span class="add">+${diff.added || 0}</span>`;
    html += `<span class="mod">~${diff.modified || 0}</span>`;
    html += `<span class="rem">-${diff.removed || 0}</span>`;
    html += "</div>";
    const addPct = ((diff.added || 0) / totalDiff * 100).toFixed(0);
    const modPct = ((diff.modified || 0) / totalDiff * 100).toFixed(0);
    const remPct = ((diff.removed || 0) / totalDiff * 100).toFixed(0);
    html += '<div class="diff-bar">';
    html += `<div class="diff-bar-s add" style="width:${addPct}%"></div>`;
    html += `<div class="diff-bar-s mod" style="width:${modPct}%"></div>`;
    html += `<div class="diff-bar-s rem" style="width:${remPct}%"></div>`;
    html += "</div>";
  }
  return html;
}

function buildImplementExtrasOriginal(e) {
  if (!e || !e.files) return "";
  let html = '<div class="fp-list" style="margin-top:12px">';
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
  html += "</div>";
  return html;
}

function buildVerifyExtrasOriginal(e) {
  if (!e || !e.tests) return "";
  return `<div class="test-mini" style="margin-top:12px"><span class="pass">${e.tests.passed} passed</span><span class="sep">|</span><span class="fail">${e.tests.failed} failed</span></div>`;
}

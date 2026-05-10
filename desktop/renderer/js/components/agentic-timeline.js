/**
 * desktop/renderer/js/components/agentic-timeline.js — Center Main Stage (Refined)
 *
 * Plan → Implement → Verify agentic loop with Bezier curve area charts
 * in VERIFY node. Cinematic SUCCESS banner.
 */

"use strict";

// ─── Bezier Curve Utility ────────────────────────────────────────────────────

function bezierPathTimeline(values, width, height, padding) {
  const n = values.length;
  if (n < 2) return { path: "", area: "" };
  const max = Math.max(...values, 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = innerW / (n - 1);

  const points = values.map((v, i) => ({
    x: padding + i * step,
    y: padding + innerH - (v / max) * innerH,
  }));

  let pathD = `M${points[0].x},${points[0].y}`;
  let areaD = `M${points[0].x},${height} L${points[0].x},${points[0].y}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + step * 0.4;
    const cp1y = p0.y;
    const cp2x = p1.x - step * 0.4;
    const cp2y = p1.y;
    pathD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
    areaD += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }

  areaD += ` L${points[n - 1].x},${height} L${points[0].x},${height} Z`;
  return { path: pathD, area: areaD };
}

// ─── Component Init ──────────────────────────────────────────────────────────

function initTimelineComponents(data) {
  if (!data) return;

  if (data.agenticNodes && data.agenticNodes.length > 0) {
    const track = document.getElementById("timeline-track");
    if (track) {
      data.agenticNodes.forEach((node) => {
        if (!document.getElementById(`node-${node.id}`)) {
          renderExistingNode(node);
        }
      });
    }

    const welcome = document.getElementById("welcome-screen");
    const timeline = document.getElementById("agentic-timeline");
    if (welcome) welcome.classList.add("hidden");
    if (timeline) timeline.classList.remove("hidden");

    if (data.agenticNodes.every((n) => n.status === "complete")) {
      const banner = document.getElementById("success-banner");
      if (banner) banner.classList.remove("hidden");

      const status = document.getElementById("timeline-status");
      if (status) {
        status.textContent = "● Complete";
        status.classList.add("complete");
      }

      const detail = document.querySelector(".success-detail");
      if (detail && data.testResults) {
        detail.textContent = `All phases completed — ${data.testResults.passed} tests passed, ${data.testResults.failed} failures`;
      }
    }
  }

  setupSuccessBanner();
}

function renderExistingNode(node) {
  const track = document.getElementById("timeline-track");
  if (!track) return;

  const nodeEl = document.createElement("div");
  nodeEl.className = "timeline-node animate-node-enter";
  nodeEl.id = `node-${node.id}`;

  const colorClass = node.color || "cyan";
  const e = node.extras || {};

  let extraHTML = "";
  if (node.phase === "PLAN") {
    extraHTML = buildPlanExtrasStatic(e);
  } else if (node.phase === "IMPLEMENT") {
    extraHTML = buildImplementExtrasStatic(e);
  } else if (node.phase === "VERIFY") {
    extraHTML = buildVerifyExtrasStatic(e);
  }

  nodeEl.innerHTML = `
    <div class="timeline-node-dot ${colorClass}"></div>
    <div class="timeline-node-card">
      <div class="timeline-node-header">
        <span class="timeline-node-phase ${colorClass}">${node.phase}</span>
        <span class="timeline-node-check">✓</span>
      </div>
      <div class="timeline-node-detail">${node.detail || ""}</div>
      ${extraHTML}
    </div>
  `;

  track.appendChild(nodeEl);
}

function buildPlanExtrasStatic(e) {
  if (!e.filesScanned && !e.diff) return "";
  const diff = e.diff || {};
  const filesScanned = e.filesScanned || 0;
  const totalDiff = (diff.added || 0) + (diff.modified || 0) + (diff.removed || 0);

  let html = `<div class="terminal-text" style="margin-bottom:10px">${filesScanned} files scanned</div>`;
  if (totalDiff > 0) {
    html += '<div class="diff-summary">';
    html += `<span class="diff-stat added">+${diff.added || 0}</span>`;
    html += `<span class="diff-stat modified">~${diff.modified || 0}</span>`;
    html += `<span class="diff-stat removed">-${diff.removed || 0}</span>`;
    html += "</div>";
    const addPct = ((diff.added || 0) / totalDiff * 100).toFixed(0);
    const modPct = ((diff.modified || 0) / totalDiff * 100).toFixed(0);
    const remPct = ((diff.removed || 0) / totalDiff * 100).toFixed(0);
    html += '<div class="diff-bar">';
    html += `<div class="diff-bar-segment added" style="width:${addPct}%"></div>`;
    html += `<div class="diff-bar-segment modified" style="width:${modPct}%"></div>`;
    html += `<div class="diff-bar-segment removed" style="width:${remPct}%"></div>`;
    html += "</div>";
  }
  if (e.relevantFiles && e.relevantFiles.length > 0) {
    html += '<div class="terminal-text" style="margin-top:10px">';
    html += e.relevantFiles.map((f) => `  ${f}`).join("<br>");
    html += "</div>";
  }
  return html;
}

function buildImplementExtrasStatic(e) {
  if (!e.files && !e.formatters) return "";
  let html = '<div class="file-progress-list">';
  if (e.files) {
    e.files.forEach((f) => {
      const pct = f.progress || 100;
      html += `
        <div class="file-progress-item">
          <span class="file-progress-name">${f.name}</span>
          <div class="file-progress-bar">
            <div class="file-progress-fill ${pct === 100 ? "shimmer-bar" : ""}" style="width:${pct}%"></div>
          </div>
          <span class="file-progress-pct">${pct}%</span>
        </div>`;
    });
  }
  html += "</div>";
  if (e.formatters && e.formatters.length > 0) {
    html += '<div class="formatter-status">Running formatters: ';
    html += e.formatters.map((f) => `<span>${f}</span>`).join("  ");
    html += "</div>";
  }
  return html;
}

// ─── VERIFY Node — Bezier curve area chart with neon glow ──────────────────

function buildVerifyExtrasStatic(e) {
  if (!e.tests && !e.benchmark) return "";
  let html = "";
  if (e.tests) {
    html += '<div class="test-results-mini">';
    html += `<span class="passed">${e.tests.passed} passed</span>`;
    html += '<span class="separator">|</span>';
    html += `<span class="failed">${e.tests.failed} failed</span>`;
    html += "</div>";
  }
  if (e.benchmark) {
    // Generate 24 data points for a smooth telemetry curve
    const values = generateTelemetryData(24);
    const width = 360;
    const height = 48;
    const padding = 2;
    const { path, area } = bezierPathTimeline(values, width, height, padding);

    html += `
      <div class="verify-chart-container">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="verifyAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.30" />
              <stop offset="50%" stop-color="var(--accent-teal)" stop-opacity="0.06" />
              <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.01" />
            </linearGradient>
          </defs>
          <path d="${area}" class="verify-chart-area" />
          <path d="${path}" class="verify-chart-glow" />
        </svg>
      </div>`;
    html += `<div class="terminal-text" style="margin-top:6px">${e.benchmark.metric}: ${e.benchmark.value} ${e.benchmark.unit}</div>`;
  }
  return html;
}

function generateTelemetryData(count) {
  const values = [];
  let v = 1200;
  for (let i = 0; i < count; i++) {
    v += Math.sin(i * 0.35) * 80 + Math.cos(i * 0.15) * 40 + (Math.random() - 0.5) * 30;
    v = Math.max(900, Math.min(1600, v));
    values.push(Math.round(v));
  }
  return values;
}

function setupSuccessBanner() {
  const btnOpenPR = document.getElementById("btn-open-pr");
  const btnIterate = document.getElementById("btn-keep-iterating");
  if (btnOpenPR) {
    btnOpenPR.addEventListener("click", () => {
      window.NexApp.executeCommand("/deploy");
    });
  }
  if (btnIterate) {
    btnIterate.addEventListener("click", () => {
      document.getElementById("command-input")?.focus();
    });
  }
}

/**
 * desktop/renderer/js/components/right-panel.js — Right Sidebar (Refined)
 *
 * Branch safety gauge (Swiss-watch, 2px stroke),
 * Test donut chart (thin ring), Cost & usage Bezier curve area chart,
 * Tool actions terminal log.
 */

"use strict";

// ─── Bezier Curve Utility ────────────────────────────────────────────────────

/**
 * Generate smooth SVG path data using cubic Bezier curves.
 * @param {number[]} values — data points
 * @param {number} width — SVG viewBox width
 * @param {number} height — SVG viewBox height
 * @param {number} padding — edge padding
 * @returns {{ path: string, area: string }} — path d-strings for line and filled area
 */
function bezierPath(values, width, height, padding) {
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

  // Build smooth cubic Bezier path
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

  // Close area path
  areaD += ` L${points[n - 1].x},${height} L${points[0].x},${height} Z`;

  return { path: pathD, area: areaD };
}

// ─── Component Init ──────────────────────────────────────────────────────────

function initRightPanelComponents(data) {
  if (!data) return;

  initSafetyGauge(data.branchSafety);
  initTestDonut(data.testResults);
  initCostSparkline(data);
  initToolLog(data.toolActions);
}

// ─── Safety Gauge (Swiss-watch, 2px stroke) ──────────────────────────────────

function initSafetyGauge(safety) {
  if (!safety) return;

  const gaugeValue = document.getElementById("gauge-value");
  const gaugeArc = document.getElementById("gauge-arc");
  const safetyStatus = document.getElementById("safety-status");

  const score = safety.score || 100;
  const circumference = 2 * Math.PI * 52; // ~326.7
  const offset = circumference * (1 - score / 100);

  if (gaugeValue) {
    gaugeValue.textContent = score;
    if (score >= 90) {
      gaugeValue.style.color = "var(--accent-emerald)";
    } else if (score >= 70) {
      gaugeValue.style.color = "var(--accent-gold)";
    } else {
      gaugeValue.style.color = "var(--accent-coral)";
    }
  }

  if (gaugeArc) {
    gaugeArc.style.strokeDashoffset = offset;
    gaugeArc.style.transition = "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)";
  }

  if (safetyStatus && safety.status) {
    safetyStatus.textContent = safety.status;
    if (safety.status === "Safe to merge") {
      safetyStatus.className = "widget-status safe";
    } else {
      safetyStatus.className = "widget-status";
    }
  }
}

// ─── Test Donut Chart (thin ring) ────────────────────────────────────────────

function initTestDonut(results) {
  if (!results) return;

  const donutPassed = document.getElementById("donut-passed");
  const statPassed = document.getElementById("stat-passed");
  const statFailed = document.getElementById("stat-failed");
  const donutArc = document.getElementById("donut-arc");

  const passed = results.passed || 0;
  const failed = results.failed || 0;
  const total = results.total || passed + failed;

  if (donutPassed) donutPassed.textContent = passed;
  if (statPassed) statPassed.textContent = passed;
  if (statFailed) statFailed.textContent = failed;

  if (donutArc && total > 0) {
    const circumference = 2 * Math.PI * 40; // ~251.3
    const passedRatio = passed / total;
    const offset = circumference * (1 - passedRatio);
    donutArc.style.strokeDashoffset = offset;
    donutArc.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)";

    if (failed > 0) {
      donutArc.style.stroke = "var(--accent-coral)";
    }
  }
}

// ─── Cost & Usage — Bezier curve area chart ──────────────────────────────────

function initCostSparkline(data) {
  const tokensEl = document.getElementById("cost-tokens");
  const requestsEl = document.getElementById("cost-requests");

  if (tokensEl && data.tokens) {
    tokensEl.textContent = formatTokenCount(data.tokens.used);
  }

  if (requestsEl && data.requests !== undefined) {
    requestsEl.textContent = data.requests;
  }

  const container = document.getElementById("sparkline-container");
  if (!container || !data.costHistory) return;

  const history = data.costHistory;
  const values = history.map((h) => h.tokens || 0);
  const width = 260;
  const height = 56;
  const padding = 4;

  const { path, area } = bezierPath(values, width, height, padding);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="costAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.35" />
          <stop offset="50%" stop-color="var(--accent-teal)" stop-opacity="0.08" />
          <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      <path d="${area}" class="cost-chart-area" />
      <path d="${path}" class="cost-chart-glow" />
    </svg>
  `;
}

// ─── Tool Actions Log (brighter text) ────────────────────────────────────────

function initToolLog(actions) {
  const log = document.getElementById("tool-log");
  if (!log || !actions) return;

  log.innerHTML = actions
    .map(
      (a) => `
    <div class="tool-log-entry">
      <span class="tool-log-tool">${a.tool}</span>
      <span class="tool-log-detail">${a.detail}</span>
      <span class="tool-log-time">${a.time || ""}</span>
    </div>
  `
    )
    .join("");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokenCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

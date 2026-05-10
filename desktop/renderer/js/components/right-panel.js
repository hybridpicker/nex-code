/**
 * desktop/renderer/js/components/right-panel.js — Right Sidebar (Restored Design)
 */

"use strict";

function initRightPanelComponents(data) {
  if (!data) return;

  initSafetyGaugeOriginal(data.branchSafety);
  initTestDonutOriginal(data.testResults);
  initCostSparklineOriginal(data);
  initToolLogOriginal(data.toolActions);
}

function initSafetyGaugeOriginal(safety) {
  if (!safety) return;
  const val = document.getElementById("gauge-val");
  const arc = document.getElementById("gauge-arc");
  const score = safety.score || 100;
  if (val) val.textContent = score;
  if (arc) {
    const circ = 2 * Math.PI * 52;
    arc.style.strokeDashoffset = circ * (1 - score / 100);
  }
}

function initTestDonutOriginal(results) {
  if (!results) return;
  const passedVal = document.getElementById("donut-passed");
  const statPassed = document.getElementById("stat-passed");
  const statFailed = document.getElementById("stat-failed");
  const arc = document.getElementById("donut-arc");

  const passed = results.passed || 0;
  const failed = results.failed || 0;
  const total = results.total || (passed + failed) || 1;

  if (passedVal) passedVal.textContent = passed;
  if (statPassed) statPassed.textContent = passed;
  if (statFailed) statFailed.textContent = failed;

  if (arc) {
    const circ = 2 * Math.PI * 40;
    arc.style.strokeDashoffset = circ * (1 - passed / total);
    arc.style.stroke = failed > 0 ? "var(--accent-coral)" : "var(--accent-emerald)";
  }
}

function initCostSparklineOriginal(data) {
  const tokensEl = document.getElementById("cost-tokens");
  const requestsEl = document.getElementById("cost-requests");
  if (tokensEl && data.tokens) tokensEl.textContent = formatTokenCountOriginal(data.tokens.used);
  if (requestsEl) requestsEl.textContent = data.requests || 0;

  const box = document.getElementById("spark-box");
  if (!box) return;

  // Render a smooth sparkline
  const vals = data.costHistory && data.costHistory.length > 1 
    ? data.costHistory.map(h => h.tokens) 
    : [5000, 8000, 4000, 9000, 6000, 12000, 7000, 10000]; // Mock if empty
    
  const p = bezierPathOriginal(vals, 260, 56, 4);
  box.innerHTML = `<svg viewBox="0 0 260 56" preserveAspectRatio="none"><defs><linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.35"/><stop offset="50%" stop-color="var(--accent-teal)" stop-opacity="0.08"/><stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.01"/></linearGradient></defs><path d="${p.area}" class="cost-area"/><path d="${p.path}" class="cost-glow"/></svg>`;
}

function initToolLogOriginal(actions) {
  const log = document.getElementById("tool-log");
  if (!log || !actions) return;
  log.innerHTML = actions.map(a => `
    <div class="tl-entry">
      <span class="tl-tool">${a.tool}</span>
      <span class="tl-dtl">${a.detail}</span>
      <span class="tl-time">${a.time || "now"}</span>
    </div>
  `).join("");
}

function formatTokenCountOriginal(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

function bezierPathOriginal(values, w, h, pad) {
  const n = values.length;
  if (n < 2) return {path:'',area:''};
  const max = Math.max(...values, 1);
  const iw = w - pad*2, ih = h - pad*2, step = iw/(n-1);
  const pts = values.map((v,i) => ({x:pad+i*step, y:pad+ih-(v/max)*ih}));
  let pathD = 'M'+pts[0].x+','+pts[0].y;
  let areaD = 'M'+pts[0].x+','+h+' L'+pts[0].x+','+pts[0].y;
  for (let i=0; i<n-1; i++) {
    const p0=pts[i], p1=pts[i+1];
    const cx1=p0.x+step*.4, cx2=p1.x-step*.4;
    pathD += ' C'+cx1+','+p0.y+' '+cx2+','+p1.y+' '+p1.x+','+p1.y;
    areaD += ' C'+cx1+','+p0.y+' '+cx2+','+p1.y+' '+p1.x+','+p1.y;
  }
  areaD += ' L'+pts[n-1].x+','+h+' L'+pts[0].x+','+h+' Z';
  return {path:pathD, area:areaD};
}

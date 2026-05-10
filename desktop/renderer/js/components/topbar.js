/**
 * desktop/renderer/js/components/topbar.js — Top Navigation Bar (Restored)
 */

"use strict";

function initTopBarComponents(data) {
  if (!data) return;

  const projectEl = document.getElementById("tb-project");
  if (projectEl && data.project) projectEl.textContent = data.project;

  const branchEl = document.getElementById("tb-branch");
  if (branchEl && data.branch) branchEl.textContent = data.branch;

  const modelValueEl = document.getElementById("model-val");
  if (modelValueEl && data.model) modelValueEl.textContent = data.model;

  const healthTextEl = document.getElementById("health-text");
  if (healthTextEl && data.sessionHealth) healthTextEl.textContent = `Session Health: ${data.sessionHealth}`;

  const budgetValueEl = document.getElementById("budget-val");
  const budgetBarFillEl = document.getElementById("budget-fill");
  if (budgetValueEl && data.budget) {
    budgetValueEl.textContent = `$${data.budget.used.toFixed(2)} / $${data.budget.limit.toFixed(2)}`;
    const pct = (data.budget.used / data.budget.limit) * 100;
    if (budgetBarFillEl) budgetBarFillEl.style.width = `${Math.min(pct, 100)}%`;
  }

  const modelRouter = document.getElementById("model-rtr");
  if (modelRouter && !modelRouter.dataset.init) {
    modelRouter.dataset.init = "true";
    modelRouter.addEventListener("click", () => toggleModelMenu(data.model));
  }
}

function toggleModelMenu(currentModel) {
  const existing = document.getElementById("model-menu");
  if (existing) { existing.remove(); return; }
  
  const models = ['Qwen3 Coder 480B','Devstral-2 123B','Kimi K2.5','DeepSeek V4','Gemini 3.1 Pro','GPT-4o','Claude 3.5 Sonnet'];
  const menu = document.createElement('div');
  menu.id = 'model-menu';
  menu.style.cssText = 'position:fixed;min-width:280px;background:var(--bg-elevated);border:1px solid var(--border-active);border-radius:var(--radius-md);box-shadow:0 8px 32px rgba(0,0,0,.6);z-index:1000;overflow:hidden';
  const rtr = document.getElementById('model-rtr');
  const rect = rtr.getBoundingClientRect();
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.left = rect.left + 'px';
  menu.innerHTML = '<div style="padding:10px 14px;font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-tertiary);text-transform:uppercase;border-bottom:1px solid var(--border)">Select Model</div>' +
    models.map(m => `<div style="display:flex;justify-content:space-between;padding:9px 14px;cursor:pointer;font-family:var(--font-mono);font-size:12px;color:var(--text-primary)${m===currentModel?';background:rgba(57,255,20,.06);border-left:2px solid var(--accent-emerald)':''}" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='${m===currentModel?'rgba(57,255,20,.06)':'transparent'}'" onclick="selectModel('${m}')">${m}</div>`).join('');
  document.body.appendChild(menu);
  
  setTimeout(() => {
    document.addEventListener('click', function close(e) {
      if (!menu.contains(e.target) && e.target !== rtr) { menu.remove(); document.removeEventListener('click', close); }
    });
  }, 0);
}

function selectModel(m) {
  const val = document.getElementById('model-val');
  if (val) val.textContent = m;
  AppState.data.model = m;
  const menu = document.getElementById('model-menu');
  if (menu) menu.remove();
}

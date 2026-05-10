/**
 * desktop/renderer/js/components/topbar.js — Top Navigation Bar
 *
 * Breadcrumbs, model router dropdown, session health, budget meter.
 */

"use strict";

function initTopBarComponents(data) {
  if (!data) return;

  // Project name in breadcrumbs
  const projectEl = document.getElementById("topbar-project");
  if (projectEl && data.project) {
    projectEl.textContent = data.project;
  }

  // Branch name in breadcrumbs
  const branchEl = document.getElementById("topbar-branch");
  if (branchEl && data.branch) {
    branchEl.innerHTML = `
      <svg class="git-icon" viewBox="0 0 16 16" width="14" height="14">
        <path fill="currentColor" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.49 2.49 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/>
      </svg>
      ${data.branch}
    `;
  }

  // Model router value
  const modelValueEl = document.getElementById("model-router-value");
  if (modelValueEl && data.model) {
    modelValueEl.textContent = data.model;
  }

  // Session health text
  const healthTextEl = document.getElementById("health-text");
  if (healthTextEl && data.sessionHealth) {
    healthTextEl.textContent = `Session Health: ${data.sessionHealth}`;
  }

  // Budget value
  const budgetValueEl = document.getElementById("budget-value");
  const budgetBarFillEl = document.getElementById("budget-bar-fill");
  if (budgetValueEl && data.budget) {
    budgetValueEl.textContent = `$${data.budget.used.toFixed(2)} / $${data.budget.limit.toFixed(2)}`;
    const pct = (data.budget.used / data.budget.limit) * 100;
    if (budgetBarFillEl) {
      budgetBarFillEl.style.width = `${Math.min(pct, 100)}%`;
      if (pct > 80) {
        budgetBarFillEl.style.background = "var(--accent-coral)";
      } else if (pct > 50) {
        budgetBarFillEl.style.background = "linear-gradient(90deg, var(--accent-gold), var(--accent-coral))";
      }
    }
  }

  // Model router click — show model selector
  const modelRouter = document.getElementById("model-router");
  if (modelRouter) {
    modelRouter.addEventListener("click", () => {
      showModelSelector(data.model || "auto (GPT-4o / Claude 3.5)");
    });
  }
}

// ─── Model Selector Dropdown ─────────────────────────────────────────────────

function showModelSelector(currentModel) {
  // Remove existing dropdown if any
  const existing = document.querySelector(".model-selector-dropdown");
  if (existing) {
    existing.remove();
    return;
  }

  const models = [
    { id: "auto", label: "auto (GPT-4o / Claude 3.5)", provider: "auto" },
    { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
    { id: "claude-3.5", label: "Claude 3.5 Sonnet", provider: "anthropic" },
    { id: "devstral-2", label: "Devstral-2 123B", provider: "ollama-cloud" },
    { id: "kimi-k2.5", label: "Kimi K2.5", provider: "ollama-cloud" },
    { id: "qwen3", label: "Qwen3 236B", provider: "ollama-cloud" },
    { id: "gemini-pro", label: "Gemini 3.1 Pro", provider: "google" },
    { id: "deepseek-v4", label: "DeepSeek V4", provider: "deepseek" },
    { id: "local", label: "Local Ollama", provider: "local" },
  ];

  const dropdown = document.createElement("div");
  dropdown.className = "model-selector-dropdown";
  dropdown.innerHTML = `
    <div class="model-selector-header">Select Model</div>
    ${models
      .map(
        (m) => `
      <div class="model-selector-item ${m.label === currentModel ? "active" : ""}" data-model="${m.label}">
        <span class="model-selector-name">${m.label}</span>
        <span class="model-selector-provider">${m.provider}</span>
      </div>
    `
      )
      .join("")}
  `;

  // Position relative to model router
  const router = document.getElementById("model-router");
  const rect = router.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;

  document.body.appendChild(dropdown);

  // Click outside to close
  const closeHandler = (e) => {
    if (!dropdown.contains(e.target) && e.target !== router) {
      dropdown.remove();
      document.removeEventListener("click", closeHandler);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler), 0);

  // Handle selection
  dropdown.querySelectorAll(".model-selector-item").forEach((item) => {
    item.addEventListener("click", () => {
      const selected = item.dataset.model;
      const modelValueEl = document.getElementById("model-router-value");
      if (modelValueEl) modelValueEl.textContent = selected;
      window.NexApp.executeCommand(`/model ${selected}`);
      dropdown.remove();
    });
  });
}

// ─── Dropdown Styles (injected dynamically) ──────────────────────────────────

const modelSelectorStyles = document.createElement("style");
modelSelectorStyles.textContent = `
  .model-selector-dropdown {
    position: fixed;
    min-width: 280px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-active);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg), 0 0 30px rgba(0, 229, 255, 0.08);
    z-index: 1000;
    overflow: hidden;
    animation: fade-in 0.15s ease-out;
  }
  .model-selector-header {
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid var(--border);
  }
  .model-selector-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .model-selector-item:hover {
    background: var(--bg-hover);
  }
  .model-selector-item.active {
    background: rgba(0, 255, 136, 0.06);
    border-left: 2px solid var(--accent-emerald);
  }
  .model-selector-name {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-primary);
  }
  .model-selector-provider {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-tertiary);
    text-transform: uppercase;
  }
`;
document.head.appendChild(modelSelectorStyles);

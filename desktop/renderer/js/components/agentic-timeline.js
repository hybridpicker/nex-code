/**
 * desktop/renderer/js/components/agentic-timeline.js — Center Stage Conversation
 *
 * Renders the chat-first center pane while preserving inline agent workflow
 * details for each user turn.
 */

"use strict";

function initTimelineComponents(data) {
  if (!data) return;

  const track = document.getElementById("timeline-track");
  if (!track) return;

  const items = data.conversationItems || [];
  track.innerHTML = items.length > 0
    ? items.map(renderConversationItem).join("")
    : renderEmptyConversation();

  const banner = document.getElementById("task-complete");
  if (banner) {
    const allDone =
      data.agenticNodes &&
      data.agenticNodes.length > 0 &&
      data.agenticNodes.every((n) => n.status === "complete");
    if (allDone) {
      banner.classList.remove("hidden");
    } else if (data.sessionState !== "complete") {
      banner.classList.add("hidden");
    }
  }

  const pill = document.getElementById("timeline-status-pill");
  const pillText = document.getElementById("timeline-status-text");
  if (pill && pillText) {
    const active = (data.agenticNodes || []).find((n) => n.status === "active");
    if (active) {
      pill.style.display = "flex";
      pillText.textContent = `${active.phase} phase in progress...`;
    } else if (data.sessionState === "complete" && items.length > 0) {
      pill.style.display = "flex";
      pillText.textContent = "Conversation complete";
    } else {
      pill.style.display = "none";
    }
  }
}

function renderEmptyConversation() {
  return `
    <div class="conversation-empty-state">
      <div class="conversation-empty-title">Start a conversation</div>
      <div class="conversation-empty-copy">
        Your prompt will stay visible here as the session unfolds, with
        clarifications and progress attached to the same thread.
      </div>
    </div>
  `;
}

function renderConversationItem(item) {
  const kindClass = item.kind === "assistant" ? "assistant" : "user";
  const statusClass = item.status || "running";
  return `
    <div class="conversation-turn ${kindClass} ${statusClass}">
      <div class="conversation-turn-meta">
        <span class="conversation-turn-role">${item.kind === "assistant" ? "nex-code" : "You"}</span>
        <span class="conversation-turn-time">${item.timestamp || ""}</span>
        <span class="conversation-turn-state">${formatConversationState(item.status)}</span>
      </div>
      <div class="conversation-turn-card">
        <div class="conversation-turn-text">${formatConversationText(item.text)}</div>
      </div>
      ${renderAskUserCard(item.query)}
      ${renderPhaseStack(item.phases || [])}
      ${item.error ? `<div class="conversation-inline-error">${escapeConversationHtml(item.error)}</div>` : ""}
    </div>
  `;
}

function renderAskUserCard(query) {
  if (!query || (query.status !== "pending" && query.status !== "answered")) return "";

  const options = Array.isArray(query.options) ? query.options : [];
  const buttons = query.status === "pending"
    ? options.map((option) => `
      <button
        type="button"
        class="conversation-option-btn"
        onclick="App.answerInlinePrompt(${JSON.stringify(option)})"
      >${escapeConversationHtml(option)}</button>
    `).join("")
    : "";

  return `
    <div class="conversation-assistant-card">
      <div class="conversation-assistant-label">nex-code needs clarification</div>
      <div class="conversation-assistant-text">${formatConversationText(query.question)}</div>
      ${query.answer ? `<div class="conversation-assistant-answer">Answered: ${escapeConversationHtml(query.answer)}</div>` : ""}
      ${buttons ? `<div class="conversation-option-row">${buttons}</div>` : ""}
    </div>
  `;
}

function renderPhaseStack(phases) {
  if (!Array.isArray(phases) || phases.length === 0) return "";
  return `
    <div class="conversation-phase-stack">
      ${phases.map(renderPhaseCard).join("")}
    </div>
  `;
}

function renderPhaseCard(node) {
  const colorClass = node.color || "cyan";
  const statusText = node.status === "active" ? "running" : "complete";
  const extras = renderPhaseExtras(node.phase, node.extras || {});
  const content = node.tokens || "";
  const detail = node.detail || "";

  return `
    <div class="conversation-phase-card ${colorClass}">
      <div class="conversation-phase-header">
        <span class="conversation-phase-label ${colorClass}">${escapeConversationHtml(node.phase)}</span>
        <span class="conversation-phase-status">${statusText}</span>
      </div>
      <div class="conversation-phase-detail">${formatConversationText(detail)}</div>
      ${content ? `<div class="conversation-phase-output">${formatConversationText(content)}</div>` : ""}
      ${extras}
    </div>
  `;
}

function renderPhaseExtras(phase, extras) {
  if (phase === "PLAN") return buildPlanExtras(extras);
  if (phase === "IMPLEMENT") return buildImplementExtras(extras);
  if (phase === "VERIFY") return buildVerifyExtras(extras);
  return "";
}

function buildPlanExtras(e) {
  if (!e) return "";
  const diff = e.diff || {};
  const totalDiff =
    (diff.added || 0) + (diff.modified || 0) + (diff.removed || 0);
  let html = `<div class="conversation-phase-mini">${e.filesScanned || 0} files scanned</div>`;
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
        <span class="fp-name">${escapeConversationHtml(f.name)}</span>
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

function formatConversationState(status) {
  const map = {
    running: "active",
    complete: "complete",
    error: "error",
  };
  return map[status] || "active";
}

function formatConversationText(text) {
  if (!text) return "";
  if (typeof parseMarkdown === "function") return parseMarkdown(text);
  return escapeConversationHtml(text);
}

function escapeConversationHtml(text) {
  if (typeof escapeHtml === "function") return escapeHtml(text);
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

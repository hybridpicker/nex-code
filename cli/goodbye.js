/**
 * cli/goodbye.js — Session Goodbye Screen
 *
 * Renders a rich summary screen when the interactive REPL exits:
 *   - Session stats (tool calls, success rate, files touched)
 *   - Token usage table per model with cost estimate
 *   - Top tools bar chart
 *   - Modified files list
 *   - Resume hint
 */

"use strict";

const { C } = require("./ui");

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(ms) {
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins < 60) return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins < 10 ? "0" : ""}${remainMins}m ${secs < 10 ? "0" : ""}${secs}s`;
}

function fmtNum(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function padR(str, w) {
  const s = String(str);
  return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);
}

function padL(str, w) {
  const s = String(str);
  return s.length >= w ? s.slice(0, w) : " ".repeat(w - s.length) + s;
}

function bar(value, max, width = 18) {
  if (max === 0) return "░".repeat(width);
  const filled = Math.round((value / max) * width);
  return C.primary + "█".repeat(filled) + C.dim + "░".repeat(width - filled) + C.reset;
}

// ─── Main render ────────────────────────────────────────────────

/**
 * Render and print the goodbye screen.
 *
 * @param {object} opts
 * @param {number}  opts.startTime  — Date.now() at REPL start
 * @param {string}  opts.sessionId  — Short random session ID (e.g. "a3f9e12b")
 * @param {Array}   opts.messages   — Conversation messages from getConversationMessages()
 */
function showGoodbyeScreen({ startTime, sessionId, messages }) {
  if (!process.stdout.isTTY) return;

  const { extractSessionStats } = require("./dream");
  const { getSessionCosts } = require("./costs");

  const stats = extractSessionStats(messages);
  const costs = getSessionCosts();
  const wallMs = startTime ? Date.now() - startTime : 0;

  // Nothing meaningful to show for very short sessions
  const hasStats = stats !== null;
  const hasTokens = costs.breakdown.length > 0;
  if (!hasStats && !hasTokens && wallMs < 5000) return;

  const W = Math.min(process.stdout.columns || 72, 80);
  const inner = W - 4; // usable width inside 2-space indent

  const out = (s = "") => process.stdout.write(s + "\n");
  const ruler = (w = inner) => `  ${C.dim}${"─".repeat(w)}${C.reset}`;
  const section = (title) => {
    out("");
    out(`  ${C.bold}${C.white}${title}${C.reset}`);
    out(ruler());
  };

  // Clear the terminal
  process.stdout.write("\x1b[r\x1b[H\x1b[2J\x1b[3J");

  // ── Header ──────────────────────────────────────────────────
  out("");
  out(ruler());
  out(
    `  ${C.bold}${C.primary}  Agent powering down. Goodbye!${C.reset}` +
    (wallMs > 0 ? `  ${C.dim}${formatDuration(wallMs)}${C.reset}` : ""),
  );
  out(ruler());

  // ── Interaction Summary ─────────────────────────────────────
  section("Interaction Summary");

  const row = (label, value, extra = "") => {
    const lw = 24;
    out(`  ${C.dim}${padR(label + ":", lw)}${C.reset}  ${C.white}${value}${C.reset}${extra}`);
  };

  row("Session ID", sessionId);

  if (hasStats) {
    const ok = stats.totalToolCalls - stats.totalErrors;
    const rate = stats.totalToolCalls > 0
      ? ((ok / stats.totalToolCalls) * 100).toFixed(1)
      : "—";

    const callsStr =
      `${stats.totalToolCalls}` +
      `  ${C.dim}(${C.success}✓ ${ok}${C.reset}` +
      (stats.totalErrors > 0
        ? `${C.dim}  ${C.error}✗ ${stats.totalErrors}${C.reset}${C.dim}`
        : "") +
      `${C.dim})${C.reset}`;

    row("Tool Calls", callsStr);
    row("Success Rate", `${rate}%`);
    row("User Messages", String(stats.userMessages));

    const modFiles = Object.keys(stats.filesModified || {});
    const readFiles = Object.keys(stats.filesAccessed || {});
    if (modFiles.length > 0) {
      const preview = modFiles.slice(0, 2).map((f) => {
        const base = f.split("/").pop();
        return `${C.dim}${base}${C.reset}`;
      }).join(`  ${C.dim}·${C.reset}  `);
      const more = modFiles.length > 2 ? `  ${C.dim}+${modFiles.length - 2} more${C.reset}` : "";
      row("Files Modified", String(modFiles.length), `  ${C.dim}·${C.reset}  ${preview}${more}`);
    }
    if (readFiles.length > 0) {
      row("Files Read", String(readFiles.length));
    }
  }

  // ── Performance ─────────────────────────────────────────────
  if (hasStats && wallMs > 0) {
    section("Performance");
    row("Wall Time", formatDuration(wallMs));
    row("Turns (user / assistant)", `${stats.userMessages}  ${C.dim}/${C.reset}  ${stats.assistantMessages}`);

    // Tool call efficiency
    if (stats.userMessages > 0 && stats.totalToolCalls > 0) {
      const tpu = (stats.totalToolCalls / stats.userMessages).toFixed(1);
      row("Tools per User Message", tpu);
    }
  }

  // ── Token Usage ─────────────────────────────────────────────
  if (hasTokens) {
    section("Token Usage");

    const COL_MODEL = 34;
    const COL_REQS  = 6;
    const COL_TOK   = 10;
    const COL_COST  = 9;

    // Table header
    out(
      `  ${C.dim}` +
      padR("Model", COL_MODEL) +
      padL("Reqs", COL_REQS) +
      padL("Input", COL_TOK) +
      padL("Output", COL_TOK) +
      padL("Cost", COL_COST) +
      C.reset,
    );
    out(ruler());

    let totReqs = 0;
    let totIn = 0;
    let totOut = 0;
    let totCost = 0;

    for (const b of costs.breakdown) {
      const name = `${b.provider} · ${b.model}`;
      const nameStr = name.length > COL_MODEL - 1 ? name.slice(0, COL_MODEL - 2) + "…" : name;
      const costStr = b.cost > 0 ? `$${b.cost.toFixed(4)}` : "free";
      totReqs  += b.requests || 0;
      totIn    += b.input;
      totOut   += b.output;
      totCost  += b.cost;

      out(
        `  ${C.cyan}${padR(nameStr, COL_MODEL)}${C.reset}` +
        `${C.dim}${padL(b.requests || "—", COL_REQS)}${C.reset}` +
        `  ${C.dim}${padL(fmtNum(b.input), COL_TOK - 2)}${C.reset}` +
        `  ${C.dim}${padL(fmtNum(b.output), COL_TOK - 2)}${C.reset}` +
        `  ${b.cost > 0 ? C.yellow : C.success}${padL(costStr, COL_COST - 2)}${C.reset}`,
      );
    }

    if (costs.breakdown.length > 1) {
      out(ruler());
      const totalCostStr = totCost > 0 ? `$${totCost.toFixed(4)}` : "free";
      out(
        `  ${C.bold}${padR("Total", COL_MODEL)}${C.reset}` +
        `${C.dim}${padL(totReqs || "—", COL_REQS)}${C.reset}` +
        `  ${C.dim}${padL(fmtNum(totIn), COL_TOK - 2)}${C.reset}` +
        `  ${C.dim}${padL(fmtNum(totOut), COL_TOK - 2)}${C.reset}` +
        `  ${totCost > 0 ? C.yellow : C.success}${C.bold}${padL(totalCostStr, COL_COST - 2)}${C.reset}`,
      );
    }

    // Cache savings highlight
    if (hasTokens && totIn > 0) {
      const cacheReads = costs.breakdown.reduce((s, b) => s + (b.cacheRead || 0), 0);
      if (cacheReads > 0) {
        const pct = ((cacheReads / (totIn + cacheReads)) * 100).toFixed(1);
        out("");
        out(`  ${C.dim}Cache savings: ${C.success}${fmtNum(cacheReads)}${C.reset}${C.dim} tokens (${pct}%) served from cache${C.reset}`);
      }
    }
  }

  // ── Top Tools ───────────────────────────────────────────────
  if (hasStats && stats.totalToolCalls > 0) {
    const sorted = Object.entries(stats.toolCalls)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    if (sorted.length > 0) {
      section("Top Tools");
      const maxCount = sorted[0][1];
      const totalCalls = stats.totalToolCalls;

      for (const [tool, count] of sorted) {
        const pct = ((count / totalCalls) * 100).toFixed(0);
        const toolStr = padR(tool, 22);
        const countStr = padL(String(count), 4);
        const pctStr  = padL(`${pct}%`, 5);
        out(
          `  ${C.cyan}${toolStr}${C.reset}  ` +
          `${bar(count, maxCount, 16)}  ` +
          `${C.white}${countStr}${C.reset}  ${C.dim}${pctStr}${C.reset}`,
        );
      }
    }
  }

  // ── Modified Files ─────────────────────────────────────────
  if (hasStats) {
    const modEntries = Object.entries(stats.filesModified || {});
    if (modEntries.length > 0) {
      section("Modified Files");
      for (const [file, count] of modEntries.slice(0, 5)) {
        const maxLen = inner - 6;
        const display = file.length > maxLen ? "…" + file.slice(-(maxLen - 1)) : file;
        const times = count > 1 ? `  ${C.dim}(${count}×)${C.reset}` : "";
        out(`  ${C.success}✎${C.reset}  ${C.white}${display}${C.reset}${times}`);
      }
      if (modEntries.length > 5) {
        out(`  ${C.dim}  … and ${modEntries.length - 5} more${C.reset}`);
      }
    }
  }

  // ── Footer ──────────────────────────────────────────────────
  out("");
  out(ruler());
  out(
    `  ${C.dim}Resume last session:${C.reset}  ${C.cyan}nex-code --resume${C.reset}`,
  );
  out(ruler());
  out("");
}

module.exports = { showGoodbyeScreen, formatDuration };

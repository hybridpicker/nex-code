"use strict";

/**
 * cli/guards/file-scroll.js — File Scroll Detection Guard
 *
 * Detects when the model is scrolling through a file section-by-section
 * instead of using grep or editing. Tracks read ranges per file and
 * blocks further reads after the scroll threshold is exceeded.
 *
 * Extracted from agent.js as part of the guard topology decomposition.
 * Interface:
 *   check(prep, state) → { blocked, errorResult?, injectMessages? }
 *
 * The guard is stateless — all counters and ranges live in the state
 * object passed by the agent loop. This makes the guard independently
 * testable with synthetic tool call sequences.
 */

const { debugLog } = require("../debug");
const C = require("../ui").C;

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Check a read_file tool call for file-scroll patterns.
 *
 * @param {object} prep - prepared tool call (fnName, args, canExecute, etc.)
 * @param {object} state - agent session state
 * @param {Map<string,number>} state.fileReadCounts - per-file read counts
 * @param {Map<string,Array<[number,number]>>} state.fileReadRanges - per-file read ranges
 * @param {Map<string,number>} state.grepFileCounts - per-file grep counts
 * @param {Map<string,string>} state.lastGrepResultByPath - last grep results per file
 * @param {number} state.scrollBlockSections - threshold for hard-blocking reads
 * @param {number} state.scrollWarnSections - threshold for warning
 * @param {number} state.loopAbortGrepFile - threshold for grep abort
 * @param {string|null} state.deadlockOnFile - file currently in deadlock state (escape valve)
 * @param {number} state.superNuclearFires - number of super-nuclear compressions
 * @param {Array<object>} state.conversationMessages - conversation array for injection
 * @param {Array<object>} state.apiMessages - API messages array for injection
 * @returns {{ blocked: boolean, errorResult?: object }}
 */
function check(prep, state) {
  if (prep.fnName !== "read_file") return { blocked: false };
  if (!prep.args?.path) return { blocked: false };

  const path = prep.args.path;
  const prevRanges = state.fileReadRanges?.get(path) || [];
  const sectionCount = prevRanges.length;

  // Deadlock escape valve: after super-nuclear compression, allow ONE more
  // targeted read of the deadlocked file to break the compression → deadlock cycle.
  const isDeadlockEscape =
    state.deadlockOnFile === path && (state.superNuclearFires || 0) >= 1;

  if (isDeadlockEscape) {
    state.deadlockOnFile = null; // one-time escape consumed
    state._deadlockEscaped = true;
    debugLog(
      `${C.yellow}  ⚠ Deadlock escape: allowing targeted read of "${path.split("/").slice(-2).join("/")}" — one-time pass after context wipe${C.reset}`,
    );
    const escapeMsg = {
      role: "user",
      content:
        `[SYSTEM] One-time read pass for "${path}" after context wipe. ` +
        "Gather the exact lines you need, then edit immediately. " +
        "Do not re-read or grep this file again.",
    };
    if (state.conversationMessages) state.conversationMessages.push(escapeMsg);
    if (state.apiMessages) state.apiMessages.push(escapeMsg);
    return { blocked: false };
  }

  const scrollBlockSections = state.scrollBlockSections ?? 3;
  const scrollWarnSections = state.scrollWarnSections ?? 2;

  if (sectionCount >= scrollBlockSections && !prep._boundedBacklogPostGrepRead) {
    const shortPath = path.split("/").slice(-2).join("/");
    debugLog(
      `${C.red}  ✖ Blocked file-scroll: "${shortPath}" — ${sectionCount} sections already read. Use grep to find specific content.${C.reset}`,
    );

    const grepCount = state.grepFileCounts?.get(path) || 0;
    const loopAbortGrepFile = state.loopAbortGrepFile ?? 5;
    const grepAlsoExhausted = grepCount >= loopAbortGrepFile;

    if (grepAlsoExhausted) {
      const lastGrepEvidence = state.lastGrepResultByPath?.get(path) || "";
      const deadlockMsg = {
        role: "user",
        content:
          `[SYSTEM] Both read_file and grep are now blocked for "${path}". ` +
          `You have already read ${sectionCount} sections and exhausted grep on this file. ` +
          (lastGrepEvidence ? `Recent grep evidence to edit from:\n${lastGrepEvidence}\n` : "") +
          "Your next tool call must be edit_file or patch_file using the exact lines already shown in the conversation. " +
          "If you cannot edit from that evidence, stop and state the blocker plainly.",
      };
      if (state.conversationMessages) state.conversationMessages.push(deadlockMsg);
      if (state.apiMessages) state.apiMessages.push(deadlockMsg);
      if (state._deadlockOnFile !== undefined) state._deadlockOnFile = path;
      debugLog(
        `${C.red}  ✖ Deadlock detected: "${shortPath}" — file-scroll and grep exhausted, requiring edit${C.reset}`,
      );
    }

    return {
      blocked: true,
      errorResult: {
        role: "tool",
        content: grepAlsoExhausted
          ? `BLOCKED: read_file("${path}") denied — you have already read ${sectionCount} different sections of this file (file-scroll pattern), and grep is also exhausted. Use edit_file or patch_file with the exact lines already in context.`
          : `BLOCKED: read_file("${path}") denied — you have already read ${sectionCount} different sections of this file (file-scroll pattern). You have seen most of this file. Use grep to find the exact lines you need instead of continuing to scroll.`,
        tool_call_id: prep.callId,
      },
    };
  }

  // Warn (but don't block) at the warn threshold
  if (sectionCount >= scrollWarnSections) {
    return { blocked: false, _scrollWarn: { sectionCount: sectionCount + 1, path } };
  }

  return { blocked: false };
}

/**
 * Compute whether a new read range overlaps significantly with any previous range.
 * Used by the agent loop before calling check() to update the ranges.
 *
 * @param {Array<[number,number]>} prevRanges - previously read ranges
 * @param {number} newStart - new range start line
 * @param {number} newEnd - new range end line
 * @returns {{ overlap: boolean, overlapRatio: number, matchedRange: [number,number]|null }}
 */
function detectOverlap(prevRanges, newStart, newEnd) {
  for (const [ps, pe] of prevRanges) {
    const overlapStart = Math.max(ps, newStart);
    const overlapEnd = Math.min(pe, newEnd);
    if (overlapStart <= overlapEnd) {
      const overlapLen = overlapEnd - overlapStart + 1;
      const newLen = newEnd - newStart + 1;
      const ratio = newLen > 0 ? overlapLen / newLen : 0;
      return { overlap: true, overlapRatio: ratio, matchedRange: [ps, pe] };
    }
  }
  return { overlap: false, overlapRatio: 0, matchedRange: null };
}

module.exports = { check, detectOverlap };
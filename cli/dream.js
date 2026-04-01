/**
 * cli/dream.js — Dream Memory Consolidation
 *
 * Post-session memory consolidation. Runs in two phases:
 *
 * Phase 1 (sync, on session end): Write a lightweight dream log with session
 *   statistics — tool call counts, error patterns, frequently accessed files.
 *
 * Phase 2 (async, on next startup): Read unprocessed dream logs, consolidate
 *   patterns across sessions, and write durable insights to .nex/memory/.
 *
 * The consolidation is read-only with respect to the project — it only writes
 * to .nex/dream-logs/ and .nex/memory/.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { atomicWrite } = require("./filelock");

// ─── Constants ──────────────────────────────────────────────────

const MAX_DREAM_LOGS = 20;
const MIN_TOOL_CALLS_TO_LOG = 3;
const MIN_SESSIONS_TO_CONSOLIDATE = 3;
const CONSOLIDATION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

// ─── Paths ──────────────────────────────────────────────────────

function getDreamDir() {
  return path.join(process.cwd(), ".nex", "dream-logs");
}

function getConsolidationMeta() {
  return path.join(getDreamDir(), "_meta.json");
}

function ensureDreamDir() {
  const dir = getDreamDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Phase 1: Session Log (synchronous, called on exit) ─────────

/**
 * Extract session statistics from conversation messages.
 * @param {Array} messages — conversation message array
 * @returns {object} — session stats
 */
function extractSessionStats(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const toolCalls = {};
  const toolErrors = {};
  const filesAccessed = {};
  const filesModified = {};
  let totalToolCalls = 0;
  let totalErrors = 0;
  let userMessageCount = 0;
  let assistantMessageCount = 0;

  for (const msg of messages) {
    if (msg.role === "user") userMessageCount++;
    if (msg.role === "assistant") assistantMessageCount++;

    // Count tool calls (Anthropic-style content blocks)
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block && block.type === "tool_use") {
          const name = block.name || "unknown";
          toolCalls[name] = (toolCalls[name] || 0) + 1;
          totalToolCalls++;

          // Track file access patterns
          const input = block.input || {};
          const filePath = input.path || input.file_path || input.filePath || "";
          if (filePath) {
            if (name === "read_file" || name === "glob" || name === "grep" || name === "search_files") {
              filesAccessed[filePath] = (filesAccessed[filePath] || 0) + 1;
            }
            if (name === "write_file" || name === "edit_file" || name === "patch_file") {
              filesModified[filePath] = (filesModified[filePath] || 0) + 1;
            }
          }
        }
      }
    }

    // Count tool calls (OpenAI-style tool_calls array)
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        const name = tc.function?.name || tc.name || "unknown";
        toolCalls[name] = (toolCalls[name] || 0) + 1;
        totalToolCalls++;
      }
    }

    // Track tool errors from results
    if (msg.role === "tool") {
      const content = typeof msg.content === "string" ? msg.content : "";
      if (content.includes("Error") || content.includes("error") ||
          content.includes("FAILED") || content.includes("failed") ||
          content.includes("not found") || content.includes("permission denied")) {
        const toolName = msg.name || "unknown";
        toolErrors[toolName] = (toolErrors[toolName] || 0) + 1;
        totalErrors++;
      }
    }
  }

  if (totalToolCalls < MIN_TOOL_CALLS_TO_LOG) {
    return null; // too short to be meaningful
  }

  return {
    timestamp: new Date().toISOString(),
    userMessages: userMessageCount,
    assistantMessages: assistantMessageCount,
    totalToolCalls,
    totalErrors,
    toolCalls,
    toolErrors,
    filesAccessed: sortByCount(filesAccessed, 10),
    filesModified: sortByCount(filesModified, 10),
  };
}

/**
 * Write a dream log for the current session. Call this synchronously on exit.
 * @param {Array} messages — conversation messages
 * @returns {string|null} — path to the log file, or null if nothing to log
 */
function writeDreamLog(messages) {
  const stats = extractSessionStats(messages);
  if (!stats) return null;

  const dir = ensureDreamDir();
  const filename = `dream-${Date.now()}.json`;
  const filePath = path.join(dir, filename);

  try {
    atomicWrite(filePath, JSON.stringify(stats, null, 2));
    pruneOldLogs(dir);
    return filePath;
  } catch {
    return null;
  }
}

// ─── Phase 2: Consolidation (async, called on startup) ──────────

/**
 * Check whether consolidation should run.
 * Gates: cooldown timer + minimum unprocessed log count.
 * @returns {boolean}
 */
function shouldConsolidate() {
  const metaPath = getConsolidationMeta();
  if (!fs.existsSync(metaPath)) return true;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    const lastRun = new Date(meta.lastConsolidation || 0).getTime();
    if (Date.now() - lastRun < CONSOLIDATION_COOLDOWN_MS) return false;
  } catch {
    return true;
  }

  // Check if there are enough unprocessed logs
  const logs = listDreamLogs();
  const metaData = readMeta();
  const unprocessed = logs.filter((l) => !metaData.processed?.includes(l));
  return unprocessed.length >= MIN_SESSIONS_TO_CONSOLIDATE;
}

/**
 * Run dream consolidation: analyze unprocessed logs and extract patterns.
 * Writes insights to .nex/memory/ via the memory module.
 * @returns {{ insights: string[], memoriesWritten: number }}
 */
function consolidate() {
  const logs = listDreamLogs();
  const meta = readMeta();
  const unprocessed = logs.filter((l) => !meta.processed?.includes(l));

  if (unprocessed.length < MIN_SESSIONS_TO_CONSOLIDATE) {
    return { insights: [], memoriesWritten: 0 };
  }

  // Load all unprocessed logs
  const sessions = [];
  for (const logFile of unprocessed) {
    try {
      const data = JSON.parse(
        fs.readFileSync(path.join(getDreamDir(), logFile), "utf-8"),
      );
      sessions.push(data);
    } catch {
      // skip corrupt logs
    }
  }

  if (sessions.length === 0) {
    return { insights: [], memoriesWritten: 0 };
  }

  // ─── Pattern extraction ────────────────────────────────────

  const insights = [];
  let memoriesWritten = 0;

  // 1. Aggregate tool usage across sessions
  const aggToolCalls = {};
  const aggToolErrors = {};
  const aggFiles = {};

  for (const s of sessions) {
    for (const [tool, count] of Object.entries(s.toolCalls || {})) {
      aggToolCalls[tool] = (aggToolCalls[tool] || 0) + count;
    }
    for (const [tool, count] of Object.entries(s.toolErrors || {})) {
      aggToolErrors[tool] = (aggToolErrors[tool] || 0) + count;
    }
    for (const [file, count] of Object.entries(s.filesAccessed || {})) {
      aggFiles[file] = (aggFiles[file] || 0) + count;
    }
  }

  // 2. Detect high-error tools (error rate > 30%)
  const errorProneTools = [];
  for (const [tool, errors] of Object.entries(aggToolErrors)) {
    const calls = aggToolCalls[tool] || errors;
    const rate = errors / calls;
    if (rate > 0.3 && errors >= 3) {
      errorProneTools.push({ tool, errors, calls, rate: Math.round(rate * 100) });
    }
  }

  if (errorProneTools.length > 0) {
    const lines = errorProneTools
      .sort((a, b) => b.rate - a.rate)
      .map((t) => `- ${t.tool}: ${t.rate}% error rate (${t.errors}/${t.calls} calls)`)
      .join("\n");
    const insight = `High-error tools detected across ${sessions.length} sessions:\n${lines}`;
    insights.push(insight);

    const written = writeInsightMemory(
      "dream-error-prone-tools",
      "Tools with high error rates across recent sessions",
      insight,
    );
    if (written) memoriesWritten++;
  }

  // 3. Detect hot files (accessed in >50% of sessions, >5 total reads)
  const sessionCount = sessions.length;
  const fileSessionCounts = {};
  for (const s of sessions) {
    const seen = new Set();
    for (const file of Object.keys(s.filesAccessed || {})) {
      if (!seen.has(file)) {
        fileSessionCounts[file] = (fileSessionCounts[file] || 0) + 1;
        seen.add(file);
      }
    }
  }

  const hotFiles = Object.entries(fileSessionCounts)
    .filter(([file, count]) => count > sessionCount * 0.5 && (aggFiles[file] || 0) > 5)
    .map(([file, sessCount]) => ({ file, sessions: sessCount, reads: aggFiles[file] || 0 }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  if (hotFiles.length > 0) {
    const lines = hotFiles
      .map((f) => `- ${f.file}: accessed in ${f.sessions}/${sessionCount} sessions (${f.reads} total reads)`)
      .join("\n");
    const insight = `Frequently accessed files across ${sessionCount} sessions:\n${lines}`;
    insights.push(insight);

    const written = writeInsightMemory(
      "dream-hot-files",
      "Files accessed frequently across multiple sessions",
      insight,
    );
    if (written) memoriesWritten++;
  }

  // 4. Session efficiency: avg tool calls per user message
  const efficiencies = sessions.map((s) => {
    if (s.userMessages === 0) return null;
    return s.totalToolCalls / s.userMessages;
  }).filter(Boolean);

  if (efficiencies.length >= 3) {
    const avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
    const avgErrors = sessions.reduce((a, s) => a + (s.totalErrors || 0), 0) / sessions.length;

    if (avgEfficiency > 15) {
      const insight = `High tool-call density: avg ${avgEfficiency.toFixed(1)} tool calls per user message across ${sessions.length} sessions. Consider more targeted investigation.`;
      insights.push(insight);
    }
    if (avgErrors > 5) {
      const insight = `High error rate: avg ${avgErrors.toFixed(1)} errors per session across ${sessions.length} sessions.`;
      insights.push(insight);
    }
  }

  // Mark logs as processed
  writeMeta({
    lastConsolidation: new Date().toISOString(),
    processed: [...(meta.processed || []), ...unprocessed],
    totalConsolidations: (meta.totalConsolidations || 0) + 1,
  });

  return { insights, memoriesWritten };
}

// ─── Helpers ────────────────────────────────────────────────────

function sortByCount(obj, limit = 10) {
  return Object.fromEntries(
    Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit),
  );
}

function listDreamLogs() {
  const dir = getDreamDir();
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith("dream-") && f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

function pruneOldLogs(dir) {
  try {
    const logs = fs.readdirSync(dir)
      .filter((f) => f.startsWith("dream-") && f.endsWith(".json"))
      .sort();
    while (logs.length > MAX_DREAM_LOGS) {
      const oldest = logs.shift();
      fs.unlinkSync(path.join(dir, oldest));
    }
  } catch {
    // non-critical
  }
}

function readMeta() {
  const metaPath = getConsolidationMeta();
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeMeta(data) {
  try {
    atomicWrite(getConsolidationMeta(), JSON.stringify(data, null, 2));
  } catch {
    // non-critical
  }
}

/**
 * Write a dream insight to .nex/memory/ using the memory module.
 * @param {string} slug — memory file slug
 * @param {string} description — one-line description
 * @param {string} content — full insight content
 * @returns {boolean}
 */
function writeInsightMemory(slug, description, content) {
  try {
    const { saveMemory } = require("./memory");
    const result = saveMemory("feedback", slug, content, description);
    return result.ok;
  } catch {
    return false;
  }
}

module.exports = {
  extractSessionStats,
  writeDreamLog,
  shouldConsolidate,
  consolidate,
  // Exported for testing
  _getDreamDir: getDreamDir,
  _listDreamLogs: listDreamLogs,
  _readMeta: readMeta,
  _writeMeta: writeMeta,
};

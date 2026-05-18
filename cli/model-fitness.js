"use strict";

/**
 * cli/model-fitness.js — Session Outcome Tracking & Fitness-Weighted Routing
 *
 * Logs every session outcome to ~/.nex-code/session-outcomes.jsonl and
 * provides success-rate lookups for the task router. Over time, this
 * data feeds back into model selection so tasks are routed to models
 * with proven success rates for that category and project size.
 *
 * Data model:
 *   { model, category, phase, projectFiles, success, score, durationMs, ts }
 *
 * Privacy: no task text, no file content, no repo path. Only aggregate
 * statistics (model + category + size bucket + outcome).
 */

const os = require("os");
const path = require("path");
const fs = require("fs");
const { debugLog } = require("./debug");

const OUTCOMES_PATH = path.join(os.homedir(), ".nex-code", "session-outcomes.jsonl");
const MAX_OUTCOMES = 500; // rolling window — oldest entries trimmed
const MIN_SESSIONS_FOR_ROUTING = 5; // need at least 5 sessions before fitness routing activates
const SUCCESS_THRESHOLD = 0.60; // switch away from models below 60% success rate
const ALTERNATIVE_THRESHOLD = 0.75; // switch to models above 75% success rate
const MIN_ALTERNATIVE_SESSIONS = 3; // need at least 3 sessions from the alternative model

// ─── Outcome Logging ──────────────────────────────────────────────────────

/**
 * Append a session outcome to the rolling log.
 *
 * @param {object} outcome
 * @param {string} outcome.model - model ID used (e.g. "devstral-small-2:24b")
 * @param {string} outcome.category - task category from detectCategory()
 * @param {string} outcome.phase - phase if phase routing was active, else null
 * @param {number} outcome.projectFiles - approximate file count in project
 * @param {boolean} outcome.success - whether the session succeeded
 * @param {number} outcome.score - session score from session-scorer
 * @param {number} outcome.durationMs - session duration in milliseconds
 */
function logSessionOutcome(outcome) {
  try {
    const dir = path.dirname(OUTCOMES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const entry = {
      model: outcome.model || "unknown",
      category: outcome.category || "coding",
      phase: outcome.phase || null,
      projectFiles: outcome.projectFiles || 0,
      success: !!outcome.success,
      score: typeof outcome.score === "number" ? outcome.score : 0,
      durationMs: typeof outcome.durationMs === "number" ? outcome.durationMs : 0,
      ts: Date.now(),
    };

    let entries = [];
    if (fs.existsSync(OUTCOMES_PATH)) {
      const raw = fs.readFileSync(OUTCOMES_PATH, "utf-8").trim();
      if (raw) {
        entries = raw.split("\n").map((line) => {
          try { return JSON.parse(line); } catch { return null; }
        }).filter(Boolean);
      }
    }

    entries.push(entry);

    // Trim to rolling window
    if (entries.length > MAX_OUTCOMES) {
      entries = entries.slice(entries.length - MAX_OUTCOMES);
    }

    fs.writeFileSync(OUTCOMES_PATH, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");

    debugLog(`  📊 Session outcome logged: ${entry.model} / ${entry.category} / ${entry.success ? "pass" : "fail"} (${entry.score.toFixed(1)})`);
  } catch (err) {
    // Non-fatal — outcome logging must never crash the session
    debugLog(`  ⚠ Session outcome logging failed: ${err.message}`);
  }
}

// ─── Success Rate Computation ─────────────────────────────────────────────

/**
 * Read the outcome log and compute success rates per (model, category).
 * Groups by model and task category, returns sorted by success rate.
 *
 * @returns {Array<{ model: string, category: string, sessions: number, successRate: number }>}
 */
function computeFitnessScores() {
  try {
    if (!fs.existsSync(OUTCOMES_PATH)) return [];

    const raw = fs.readFileSync(OUTCOMES_PATH, "utf-8").trim();
    if (!raw) return [];

    const entries = raw.split("\n")
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter((e) => e && e.model && e.category);

    // Group by model + category
    const groups = new Map();
    for (const e of entries) {
      const key = `${e.model}::${e.category}`;
      if (!groups.has(key)) {
        groups.set(key, { model: e.model, category: e.category, success: 0, total: 0 });
      }
      const g = groups.get(key);
      g.total++;
      if (e.success) g.success++;
    }

    return [...groups.values()]
      .map((g) => ({
        model: g.model,
        category: g.category,
        sessions: g.total,
        successRate: g.total > 0 ? g.success / g.total : 0,
      }))
      .sort((a, b) => b.successRate - a.successRate);
  } catch {
    return [];
  }
}

/**
 * Get project size bucket for coarse-grained routing.
 * @param {number} fileCount
 * @returns {'small'|'medium'|'large'}
 */
function getProjectSizeBucket(fileCount) {
  if (fileCount <= 50) return "small";
  if (fileCount <= 500) return "medium";
  return "large";
}

/**
 * Get the best model for a task category based on historical success rates.
 * Returns null if insufficient data is available — caller should fall back
 * to the default model.
 *
 * @param {string} categoryId - task category (e.g. "frontend", "bug-fix")
 * @param {string} defaultModel - the model that would be used by default
 * @param {'small'|'medium'|'large'} [projectSize] - project size bucket
 * @returns {string|null} - recommended model, or null if no switch is warranted
 */
function getFitnessRecommendedModel(categoryId, defaultModel, projectSize = null) {
  const scores = computeFitnessScores();

  if (scores.length < MIN_SESSIONS_FOR_ROUTING) return null;

  // Find the default model's success rate for this category
  const defaultScore = scores.find(
    (s) => s.model === defaultModel && s.category === categoryId,
  );

  // If default model is doing fine (≥60%), no switch needed
  if (defaultScore && defaultScore.sessions >= MIN_ALTERNATIVE_SESSIONS && defaultScore.successRate >= SUCCESS_THRESHOLD) {
    return null;
  }

  // Find alternatives for this category with enough sessions and good success rates
  const alternatives = scores.filter(
    (s) =>
      s.category === categoryId &&
      s.model !== defaultModel &&
      s.sessions >= MIN_ALTERNATIVE_SESSIONS &&
      s.successRate >= ALTERNATIVE_THRESHOLD,
  );

  if (alternatives.length === 0) return null;

  // Pick the alternative with the best success rate
  const best = alternatives[0];

  debugLog(
    `  📊 Fitness routing: ${defaultModel} → ${best.model} ` +
    `(${categoryId}: ${(best.successRate * 100).toFixed(0)}% vs ${defaultScore ? (defaultScore.successRate * 100).toFixed(0) + "%" : "no data"})`,
  );

  return best.model;
}

/**
 * Check if fitness-based routing has enough data to be active.
 * @returns {boolean}
 */
function isFitnessRoutingActive() {
  if (process.env.NEX_FITNESS_ROUTING === "0") return false;
  const scores = computeFitnessScores();
  return scores.length >= MIN_SESSIONS_FOR_ROUTING;
}

module.exports = {
  logSessionOutcome,
  computeFitnessScores,
  getFitnessRecommendedModel,
  getProjectSizeBucket,
  isFitnessRoutingActive,
  OUTCOMES_PATH,
  MIN_SESSIONS_FOR_ROUTING,
};
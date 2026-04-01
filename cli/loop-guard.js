"use strict";

/**
 * cli/loop-guard.js — Session-scoped loop detection counters
 *
 * Tracks per-tool-call repetition across REPL turns to detect and break
 * runaway loops (repeated edits, bash commands, grep patterns, file reads).
 *
 * Each counter entry stores { count, ts }. Entries older than TTL are
 * treated as expired so stale counters don't block valid work.
 */

const LOOP_COUNTER_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── TTL-aware counter helpers ──────────────────────────────────────────────

function getCount(map, key) {
  const entry = map.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.ts > LOOP_COUNTER_TTL_MS) {
    map.delete(key);
    return 0;
  }
  return entry.count;
}

function incCount(map, key) {
  const entry = map.get(key);
  const count =
    entry && Date.now() - entry.ts <= LOOP_COUNTER_TTL_MS
      ? entry.count + 1
      : 1;
  map.set(key, { count, ts: Date.now() });
  return count;
}

function setCount(map, key, count) {
  map.set(key, { count, ts: Date.now() });
}

// ─── Session-level counters ─────────────────────────────────────────────────
// Persist across REPL turns; reset on /clear.

const bashCmdCounts = new Map();
const grepPatternCounts = new Map();
const grepFileCounts = new Map();
const fileReadCounts = new Map();
const fileReadRanges = new Map(); // path → Array<[start, end]>
const globSearchCounts = new Map();
const fileEditCounts = new Map();
const lastEditFailed = new Map(); // path → true
const reReadBlockShown = new Map(); // path → count of block messages shown
let consecutiveSshCalls = 0;
let superNuclearFires = 0;
let planRejectionCount = 0;
let sshBlockedAfterStorm = false;
let postWipeToolBudget = Infinity;
let serverLocalWarnFired = 0;

function clearAll() {
  bashCmdCounts.clear();
  grepPatternCounts.clear();
  grepFileCounts.clear();
  fileReadCounts.clear();
  fileReadRanges.clear();
  globSearchCounts.clear();
  fileEditCounts.clear();
  lastEditFailed.clear();
  reReadBlockShown.clear();
  consecutiveSshCalls = 0;
  superNuclearFires = 0;
  planRejectionCount = 0;
  sshBlockedAfterStorm = false;
  postWipeToolBudget = Infinity;
  serverLocalWarnFired = 0;
}

// ─── Accessors (avoid direct mutation from outside) ─────────────────────────

function getConsecutiveSshCalls() {
  return consecutiveSshCalls;
}
function setConsecutiveSshCalls(n) {
  consecutiveSshCalls = n;
}
function getSuperNuclearFires() {
  return superNuclearFires;
}
function incSuperNuclearFires() {
  return ++superNuclearFires;
}
function getPlanRejectionCount() {
  return planRejectionCount;
}
function incPlanRejectionCount() {
  return ++planRejectionCount;
}
function isSshBlocked() {
  return sshBlockedAfterStorm;
}
function setSshBlocked(val) {
  sshBlockedAfterStorm = val;
}
function getPostWipeToolBudget() {
  return postWipeToolBudget;
}
function setPostWipeToolBudget(n) {
  postWipeToolBudget = n;
}
function decPostWipeToolBudget() {
  if (postWipeToolBudget !== Infinity) postWipeToolBudget--;
  return postWipeToolBudget;
}
function getServerLocalWarnFired() {
  return serverLocalWarnFired;
}
function setServerLocalWarnFired(n) {
  serverLocalWarnFired = n;
}


module.exports = {
  // TTL helpers
  getCount,
  incCount,
  setCount,
  LOOP_COUNTER_TTL_MS,
  // Counter maps (direct access for iteration in super-nuclear)
  bashCmdCounts,
  grepPatternCounts,
  grepFileCounts,
  fileReadCounts,
  fileReadRanges,
  globSearchCounts,
  fileEditCounts,
  lastEditFailed,
  reReadBlockShown,
  // Scalar state
  getConsecutiveSshCalls,
  setConsecutiveSshCalls,
  getSuperNuclearFires,
  incSuperNuclearFires,
  getPlanRejectionCount,
  incPlanRejectionCount,
  isSshBlocked,
  setSshBlocked,
  getPostWipeToolBudget,
  setPostWipeToolBudget,
  decPostWipeToolBudget,
  getServerLocalWarnFired,
  setServerLocalWarnFired,
  // Reset
  clearAll,
};

#!/usr/bin/env node
/**
 * improve-daemon-server.js — nex-code 24/7 Worker (AlmaLinux 9 Server)
 *
 * Proactive improvement loop:
 *   - Every N minutes: benchmark analysis + implement fix + test + commit + push
 *   - Commits to `auto-improve` branch (supervisor merges good ones to devel)
 *   - Uses nex-code --auto (Ollama Cloud, free)
 *
 * Config: ~/.nex-code/improvement-config.json (written by supervisor)
 * Activity log: ~/.nex-code/worker-activity.json (read by supervisor)
 *
 * Deployed as: systemd user service (nex-worker.service)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

// ── Paths ─────────────────────────────────────────────────────────────────
const HOME = process.env.HOME || "/home/jarvis";
const NEX_DIR = path.join(HOME, "Coding/nex-code");
const CONFIG_FILE = path.join(HOME, ".nex-code/improvement-config.json");
const ACTIVITY_LOG = path.join(HOME, ".nex-code/worker-activity.json");
const STATE_FILE = path.join(HOME, ".nex-code/worker-state.json");
const BRANCH = "auto-improve";

// Find nex-code binary — global install or local dist
const NEX_CODE_BIN = (() => {
  try {
    return execSync("which nex-code", { encoding: "utf8" }).trim();
  } catch {
    return path.join(NEX_DIR, "dist/nex-code.js");
  }
})();

// ── Defaults (overridden by config) ───────────────────────────────────────
const DEFAULTS = {
  proactive_interval_min: 45,
  max_commits_per_day: 20,
  cooldown_after_fail_min: 15,
};

const PASS_TIMEOUT_MS = 900_000; // 15 min per pass

// ── Config ────────────────────────────────────────────────────────────────
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { return {}; }
}
function getWorkerConfig() {
  return { ...DEFAULTS, ...(readConfig().worker || {}) };
}
function getFocusAreas() { return readConfig().focus_areas || []; }
function getPriorityIssues() { return readConfig().priority_issues || []; }
function getWorkerPromptAdditions() { return readConfig().worker_prompt_additions || ""; }
function getBlockedFiles() { return readConfig().blocked_files || []; }
function getSupervisorNotes() { return readConfig().supervisor_notes || ""; }

// ── State ─────────────────────────────────────────────────────────────────
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); }
  catch {
    return {
      dailyCommits: 0,
      dailyDate: new Date().toISOString().slice(0, 10),
      consecutiveFailures: 0,
      totalPasses: 0,
      totalCommits: 0,
    };
  }
}
function writeState(s) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function getDailyCommits(state) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.dailyDate !== today) { state.dailyDate = today; state.dailyCommits = 0; }
  return state.dailyCommits;
}

// ── Activity log ──────────────────────────────────────────────────────────
function logActivity(entry) {
  let acts = [];
  try { acts = JSON.parse(fs.readFileSync(ACTIVITY_LOG, "utf8")); } catch {}
  acts.push({ timestamp: new Date().toISOString(), ...entry });
  if (acts.length > 200) acts = acts.slice(-200);
  fs.writeFileSync(ACTIVITY_LOG, JSON.stringify(acts, null, 2));
}

// ── Logging ───────────────────────────────────────────────────────────────
function log(...args) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(`[${ts}]`, ...args);
}

// ── Git helpers ───────────────────────────────────────────────────────────
function ensureBranch() {
  try {
    const branch = execSync(`cd ${NEX_DIR} && git branch --show-current`, { encoding: "utf8" }).trim();
    if (branch !== BRANCH) {
      log(`Switching to ${BRANCH} branch...`);
      execSync(`cd ${NEX_DIR} && git checkout ${BRANCH} && git pull origin ${BRANCH}`, { timeout: 30_000 });
    } else {
      execSync(`cd ${NEX_DIR} && git pull origin ${BRANCH}`, { timeout: 30_000 });
    }
  } catch (e) {
    log(`Git branch error: ${e.message}`);
  }
}

function getRecentCommits(n = 10) {
  try {
    return execSync(`cd ${NEX_DIR} && git log --oneline -${n}`, { encoding: "utf8", timeout: 10_000 }).trim();
  } catch { return ""; }
}

function getCommitCount() {
  try {
    return parseInt(execSync(
      `cd ${NEX_DIR} && git log --oneline --since="midnight" --format="%H" | wc -l`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim(), 10) || 0;
  } catch { return 0; }
}

// ── Build improvement prompt ──────────────────────────────────────────────
function buildPrompt() {
  const focus = getFocusAreas();
  const priorities = getPriorityIssues();
  const additions = getWorkerPromptAdditions();
  const blocked = getBlockedFiles();
  const notes = getSupervisorNotes();
  const recentCommits = getRecentCommits(10);

  let prompt = `You are the nex-code auto-improvement worker. Your job is to make nex-code a better coding assistant.

CURRENT STATE:
- Branch: ${BRANCH}
- Recent commits:\n${recentCommits || "(none)"}
- Focus areas: ${focus.join(", ") || "general improvement"}
- Supervisor notes: ${notes || "(none)"}`;

  if (priorities.length) {
    prompt += `\n- Priority issues:\n${priorities.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}`;
  }
  if (blocked.length) {
    prompt += `\n\nDO NOT modify: ${blocked.join(", ")}`;
  }
  if (additions) {
    prompt += `\n\nSupervisor instructions:\n${additions}`;
  }

  prompt += `

YOUR TASK:
1. Read specific files in cli/ to find a concrete improvement opportunity.
   Start with these high-value targets:
   - cli/agent.js — the main agentic loop (look for error handling gaps, edge cases, guard thresholds)
   - cli/providers/ollama.js — HTTP error handling, status code preservation, retry logic
   - cli/context-engine.js — token estimation accuracy, compression efficiency
   - cli/tools/index.js — tool execution reliability, path resolution
   - cli/sub-agent.js — error classification, retry logic
   Read the actual code. Grep for patterns like: catch(e), .catch(, "error", TODO, FIXME, HACK
2. Pick ONE concrete bug or improvement. Write the fix.
3. Run tests: npx jest --forceExit --maxWorkers=50%
4. If tests pass: git add the changed files, commit with a descriptive message, and run: git push origin ${BRANCH}
5. If tests fail: revert your changes with git checkout -- . and report what went wrong.

RULES:
- ONE fix per pass. No unrelated cleanups.
- Always run npx jest before committing (not npm test — jest may not be in PATH).
- Commit messages in English, imperative mood, ≤72 chars subject.
- Never modify files in scripts/ directory.
- Push to ${BRANCH} only — never to main or devel.
- If you genuinely cannot find anything to improve after reading the code, say "NO_IMPROVEMENT_NEEDED" and stop.`;

  return prompt;
}

// ── Run improvement pass ──────────────────────────────────────────────────
function runPass() {
  const state = readState();
  const config = getWorkerConfig();

  // Daily cap
  const daily = getDailyCommits(state);
  if (daily >= config.max_commits_per_day) {
    log(`Daily cap reached (${daily}/${config.max_commits_per_day}). Skipping.`);
    logActivity({ type: "proactive", result: "skipped", reason: "daily_cap" });
    return;
  }

  // Consecutive failure pause
  if ((state.consecutiveFailures || 0) >= 5) {
    log("5 consecutive failures — pausing until supervisor reset.");
    logActivity({ type: "proactive", result: "paused", reason: "consecutive_failures" });
    return;
  }

  // Ensure correct branch + pull latest
  ensureBranch();

  const prompt = buildPrompt();
  const tmpFile = `/tmp/nex-improve-${Date.now()}.txt`;
  fs.writeFileSync(tmpFile, prompt);

  log("─── Improvement pass starting ───");
  const beforeCount = getCommitCount();
  const startTime = Date.now();

  const res = spawnSync(
    NEX_CODE_BIN,
    ["--prompt-file", tmpFile, "--auto"],
    {
      cwd: NEX_DIR,
      stdio: "inherit",
      timeout: PASS_TIMEOUT_MS,
      env: {
        ...process.env,
        HOME,
        NEX_SKIP_BENCHMARK: "1",
        NEX_SKIP_COMPACTOR: "1",
      },
    },
  );

  try { fs.unlinkSync(tmpFile); } catch {}

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const afterCount = getCommitCount();
  const committed = afterCount > beforeCount;

  state.totalPasses = (state.totalPasses || 0) + 1;

  if (committed) {
    state.dailyCommits = (state.dailyCommits || 0) + 1;
    state.totalCommits = (state.totalCommits || 0) + 1;
    state.consecutiveFailures = 0;
    writeState(state);
    log(`Pass complete (${elapsed}s). Commit pushed to ${BRANCH}.`);
    logActivity({ type: "proactive", result: "committed", elapsed_s: elapsed, daily: state.dailyCommits });
  } else if (res.status === 0) {
    state.consecutiveFailures = 0;
    writeState(state);
    log(`Pass complete (${elapsed}s). No commit (nothing to improve).`);
    logActivity({ type: "proactive", result: "no_change", elapsed_s: elapsed });
  } else {
    state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
    writeState(state);
    log(`Pass failed (${elapsed}s, exit ${res.status}). Failures: ${state.consecutiveFailures}`);
    logActivity({ type: "proactive", result: "failed", exit_code: res.status, elapsed_s: elapsed });
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────
const config = getWorkerConfig();
const intervalMs = config.proactive_interval_min * 60_000;

log("═══════════════════════════════════════════════════");
log("nex-code 24/7 worker daemon (server)");
log(`Branch:    ${BRANCH}`);
log(`Interval:  ${config.proactive_interval_min} min`);
log(`Daily cap: ${config.max_commits_per_day}`);
log(`nex-code:  ${NEX_CODE_BIN}`);
log(`Config:    ${CONFIG_FILE}`);
log("═══════════════════════════════════════════════════");

// First pass after 2 min warmup, then every N min
setTimeout(() => {
  runPass();
  setInterval(runPass, intervalMs);
}, 2 * 60_000);

log(`First pass in 2 min, then every ${config.proactive_interval_min} min.`);

// Graceful shutdown
process.on("SIGTERM", () => { log("SIGTERM — shutting down."); process.exit(0); });
process.on("SIGINT", () => { log("SIGINT — shutting down."); process.exit(0); });

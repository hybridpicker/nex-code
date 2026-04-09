#!/usr/bin/env node
/**
 * supervisor-server.js — nex-code Daily Supervisor (AlmaLinux 9 Server)
 *
 * Runs once per day via systemd timer. Uses Claude Code (Sonnet) to:
 *   1. Review all worker commits on auto-improve branch
 *   2. Check test status
 *   3. Analyze worker activity
 *   4. Update improvement-config.json
 *   5. Cherry-pick/merge good commits to devel
 *   6. Matrix notification with summary
 *
 * Deployed as: systemd timer (nex-supervisor.timer)
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
const SUPERVISOR_LOG = path.join(HOME, ".nex-code/supervisor-log.json");

// Claude Code binary — installed via npm or direct install
const CLAUDE_BIN = (() => {
  for (const p of [
    path.join(HOME, ".local/bin/claude"),
    path.join(HOME, ".npm-global/bin/claude"),
    "/usr/local/bin/claude",
  ]) {
    if (fs.existsSync(p)) return p;
  }
  try { return execSync("which claude", { encoding: "utf8" }).trim(); }
  catch { return null; }
})();

const SERVER_SSH = process.env.JARVIS_SSH_HOST;

// ── Logging ───────────────────────────────────────────────────────────────
function log(...args) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(`[${ts}]`, ...args);
}

// ── Matrix notification ───────────────────────────────────────────────────
function sendMatrix(message) {
  // On the server itself, we can call the API directly
  try {
    execSync(
      `curl -sf -X POST http://localhost:3000/matrix/notify ` +
        `-H 'Content-Type: application/json' ` +
        `-d ${JSON.stringify(JSON.stringify({ message }))}`,
      { timeout: 10_000 },
    );
    log("Matrix sent.");
  } catch (e) {
    log(`Matrix failed: ${e.message}`);
  }
}

// ── Gather context ────────────────────────────────────────────────────────
function gatherContext() {
  const ctx = {};

  // Commits on auto-improve not yet in devel
  try {
    ctx.newCommits = execSync(
      `cd ${NEX_DIR} && git fetch origin && git log --oneline origin/devel..origin/auto-improve 2>/dev/null`,
      { encoding: "utf8", timeout: 30_000 },
    ).trim();
  } catch {
    ctx.newCommits = "(error)";
  }

  // Recent worker commits (last 24h)
  try {
    ctx.recentCommits = execSync(
      `cd ${NEX_DIR} && git log --oneline --since="24 hours ago" origin/auto-improve 2>/dev/null`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
  } catch {
    ctx.recentCommits = "(none)";
  }

  // Diff stat of new commits
  try {
    ctx.diffStat = execSync(
      `cd ${NEX_DIR} && git diff origin/devel..origin/auto-improve --stat 2>/dev/null`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
  } catch {
    ctx.diffStat = "(none)";
  }

  // Detailed diff (limited)
  try {
    ctx.diff = execSync(
      `cd ${NEX_DIR} && git diff origin/devel..origin/auto-improve 2>/dev/null | head -500`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
  } catch {
    ctx.diff = "";
  }

  // Test status on auto-improve
  try {
    execSync(
      `cd ${NEX_DIR} && git checkout auto-improve -q && npm test -- --forceExit --maxWorkers=50% 2>&1`,
      { timeout: 180_000, encoding: "utf8" },
    );
    ctx.testStatus = "ALL PASSING";
  } catch (e) {
    ctx.testStatus = `FAILURES:\n${(e.stdout || "").slice(-800)}`;
  }

  // Current config
  try { ctx.currentConfig = fs.readFileSync(CONFIG_FILE, "utf8"); }
  catch { ctx.currentConfig = "{}"; }

  // Worker activity
  try {
    const acts = JSON.parse(fs.readFileSync(ACTIVITY_LOG, "utf8"));
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    ctx.workerActivity = acts
      .filter((a) => new Date(a.timestamp).getTime() > dayAgo)
      .map((a) => `${a.timestamp.slice(11, 19)} ${a.type}: ${a.result}${a.reason ? ` (${a.reason})` : ""}`)
      .join("\n") || "(no activity)";
  } catch {
    ctx.workerActivity = "(no log)";
  }

  return ctx;
}

// ── Build supervisor prompt ───────────────────────────────────────────────
function buildPrompt(ctx) {
  return `You are the nex-code SUPERVISOR. You run once per day to review the automated worker's output.

The worker daemon runs every 45 min on this server, using nex-code (Ollama Cloud) to make small improvements. It commits to the \`auto-improve\` branch. Your job is to:

1. REVIEW the worker's commits — are they good, harmful, or pointless?
2. MERGE good commits to devel (or cherry-pick specific ones)
3. REVERT any commits that broke tests
4. UPDATE the worker config with new priorities for tomorrow
5. Provide a summary

═══ NEW COMMITS (auto-improve ahead of devel) ═══
${ctx.newCommits || "(none — worker hasn't committed anything new)"}

═══ COMMITS LAST 24H ═══
${ctx.recentCommits || "(none)"}

═══ DIFF STAT ═══
${ctx.diffStat || "(none)"}

═══ ACTUAL DIFF (first 500 lines) ═══
${ctx.diff || "(empty)"}

═══ TEST STATUS (on auto-improve) ═══
${ctx.testStatus}

═══ WORKER ACTIVITY ═══
${ctx.workerActivity}

═══ CURRENT CONFIG ═══
${ctx.currentConfig}

═══ YOUR ACTIONS ═══

**If tests pass AND commits look good:**
\`\`\`bash
cd ${NEX_DIR}
git checkout devel
git merge origin/auto-improve --no-ff -m "chore: merge auto-improve — worker improvements"
git push origin devel
git checkout auto-improve
git merge devel
git push origin auto-improve
\`\`\`

**If specific commits are bad, revert them on auto-improve:**
\`\`\`bash
git checkout auto-improve
git revert <bad-hash> --no-edit
git push origin auto-improve
\`\`\`

**If no new commits:** Just update the config with better instructions for the worker.

**Always update the config file** at ~/.nex-code/improvement-config.json with:
- New focus_areas based on what you see
- Specific priority_issues if you spotted bugs in the diff
- Updated supervisor_notes with your assessment
- Adjust worker.proactive_interval_min if the worker is producing too many/few commits

Write the config with: write_file("${CONFIG_FILE}", <json content>)

RULES:
- Be specific in priority_issues — file paths, line numbers, function names.
- The worker is a small Ollama model — simple, concrete instructions work best.
- Only merge to devel if tests pass.
- Write everything in English.
- End with a 3-5 sentence summary of today's assessment.`;
}

// ── Run supervisor ────────────────────────────────────────────────────────
function run() {
  log("═══════════════════════════════════════════════════");
  log("nex-code supervisor — daily review");
  log("═══════════════════════════════════════════════════");

  if (!CLAUDE_BIN) {
    log("ERROR: Claude Code not found. Install with: npm install -g @anthropic-ai/claude-code");
    sendMatrix("❌ nex-code supervisor: Claude Code not installed on server.");
    return;
  }

  log("Gathering context...");
  const ctx = gatherContext();
  const newCount = (ctx.newCommits || "").split("\n").filter(Boolean).length;
  log(`New commits: ${newCount}, Tests: ${ctx.testStatus.startsWith("ALL") ? "passing" : "FAILING"}`);

  const prompt = buildPrompt(ctx);

  log(`Running Claude Code (Sonnet) supervisor...`);
  const startTime = Date.now();

  const res = spawnSync(
    CLAUDE_BIN,
    ["--print", "--dangerously-skip-permissions", "--model", "sonnet", "-p", prompt],
    {
      cwd: NEX_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 600_000,
      env: { ...process.env, HOME },
    },
  );

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const output = (res.stdout || "").toString("utf8");

  if (res.status !== 0) {
    const stderr = (res.stderr || "").toString("utf8").slice(-300);
    log(`Supervisor failed (exit ${res.status}, ${elapsed}s). ${stderr}`);
    sendMatrix(`❌ nex-code supervisor failed (exit ${res.status}).`);
    logRun({ status: "failed", elapsed_s: elapsed });
    return;
  }

  log(`Supervisor complete (${elapsed}s).`);

  const summary = output.trim().split("\n").filter(Boolean).slice(-5).join("\n");

  logRun({
    status: "ok",
    elapsed_s: elapsed,
    new_commits: newCount,
    tests: ctx.testStatus.startsWith("ALL") ? "passing" : "failing",
    summary: summary.slice(0, 500),
  });

  sendMatrix(
    `🧠 nex-code supervisor review complete.\n` +
      `New commits: ${newCount} | Tests: ${ctx.testStatus.startsWith("ALL") ? "✅" : "❌"}\n` +
      `${summary.slice(0, 300)}`,
  );

  log("Done.");
}

function logRun(entry) {
  let runs = [];
  try { runs = JSON.parse(fs.readFileSync(SUPERVISOR_LOG, "utf8")); } catch {}
  runs.push({ timestamp: new Date().toISOString(), ...entry });
  if (runs.length > 100) runs = runs.slice(-100);
  fs.writeFileSync(SUPERVISOR_LOG, JSON.stringify(runs, null, 2));
}

run();

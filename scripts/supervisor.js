#!/usr/bin/env node
/**
 * supervisor.js — nex-code Daily Supervisor (runs on MacBook)
 *
 * Runs once per day via LaunchAgent. Uses Claude Code (Sonnet) locally.
 * SSHs to AlmaLinux server to gather context and execute git commands.
 *
 * Flow:
 *   1. SSH to server: gather worker commits, test status, activity log
 *   2. Run Claude Sonnet locally to analyze + decide
 *   3. Claude SSHs to server to merge/revert/update config
 *   4. Matrix notification with summary
 *
 * LaunchAgent: com.nex-code.supervisor.plist (daily 10:00)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

// ── Config ────────────────────────────────────────────────────────────────
const HOME = process.env.HOME;
const NEX_DIR = path.join(HOME, "Coding/nex-code");
const SUPERVISOR_LOG = path.join(HOME, ".nex-code/supervisor-log.json");
const CLAUDE_BIN = path.join(HOME, ".local/bin/claude");
const SERVER = "jarvis@94.130.37.43";
const SERVER_NEX_DIR = "/home/jarvis/Coding/nex-code";
const SERVER_CONFIG = "/home/jarvis/.nex-code/improvement-config.json";
const SERVER_ACTIVITY = "/home/jarvis/.nex-code/worker-activity.json";

// ── Logging ───────────────────────────────────────────────────────────────
function log(...args) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(`[${ts}]`, ...args);
}

// ── SSH helper (with retry) ───────────────────────────────────────────────
function ssh(cmd, timeout = 30_000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return execSync(
        `ssh -o ConnectTimeout=15 -o BatchMode=yes -o ServerAliveInterval=10 ${SERVER} "${cmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$')}"`,
        { encoding: "utf8", timeout },
      ).trim();
    } catch (e) {
      const isConnError = e.message.includes("Connection refused") ||
        e.message.includes("Operation timed out") ||
        e.message.includes("No route to host");
      if (isConnError && attempt < retries) {
        log(`SSH attempt ${attempt + 1} failed, retrying in 10s...`);
        spawnSync("sleep", ["10"]);
        continue;
      }
      return `(error: ${e.message.slice(0, 100)})`;
    }
  }
}

// ── Gather context from server via SSH ────────────────────────────────────
function gatherContext() {
  const ctx = {};

  log("Fetching context from server...");

  // Connectivity check — abort early if server is unreachable
  const ping = ssh("echo ok", 15_000, 3);
  if (ping.startsWith("(error:")) {
    log(`Server unreachable: ${ping}`);
    ctx._unreachable = true;
    return ctx;
  }

  // New commits on auto-improve not yet in devel
  ctx.newCommits = ssh(
    `cd ${SERVER_NEX_DIR} && git fetch origin -q && git log --oneline origin/devel..origin/auto-improve`,
  );

  // Recent worker commits (last 24h)
  ctx.recentCommits = ssh(
    `cd ${SERVER_NEX_DIR} && git log --oneline --since='24 hours ago' origin/auto-improve`,
  );

  // Diff stat
  ctx.diffStat = ssh(
    `cd ${SERVER_NEX_DIR} && git diff origin/devel..origin/auto-improve --stat`,
  );

  // Actual diff (limited)
  ctx.diff = ssh(
    `cd ${SERVER_NEX_DIR} && git diff origin/devel..origin/auto-improve | head -500`,
    60_000,
  );

  // Test status on auto-improve
  ctx.testStatus = ssh(
    `cd ${SERVER_NEX_DIR} && git checkout auto-improve -q 2>/dev/null && npm test -- --forceExit --maxWorkers=50% 2>&1 | tail -20`,
    180_000,
  );

  // Current config
  ctx.currentConfig = ssh(`cat ${SERVER_CONFIG}`);

  // Worker activity (last 24h)
  ctx.workerActivity = ssh(
    `cat ${SERVER_ACTIVITY} 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const ago=Date.now()-24*60*60*1000;
      d.filter(a=>new Date(a.timestamp).getTime()>ago)
       .forEach(a=>console.log(a.timestamp.slice(11,19)+' '+a.type+': '+a.result+(a.reason?' ('+a.reason+')':'')))
    " 2>/dev/null`,
  );

  // Worker state
  ctx.workerState = ssh(`cat /home/jarvis/.nex-code/worker-state.json 2>/dev/null`);

  return ctx;
}

// ── Build supervisor prompt ───────────────────────────────────────────────
function buildPrompt(ctx) {
  return `You are the nex-code SUPERVISOR. You run once per day on Lukas' MacBook to review what the automated worker daemon on the AlmaLinux server has done.

The worker runs every 45 min on the server using nex-code + Ollama Cloud (free). It commits improvements to the \`auto-improve\` branch. Your job:
1. Review worker commits — are they good, harmful, or pointless?
2. Merge good commits to devel (or cherry-pick)
3. Revert bad commits
4. Update the worker config with new priorities for tomorrow

SERVER ACCESS: You can run commands on the server via the bash tool using:
  ssh -o BatchMode=yes ${SERVER} "<command>"

Server paths:
  - Repo: ${SERVER_NEX_DIR} (on auto-improve branch)
  - Config: ${SERVER_CONFIG}
  - Activity: ${SERVER_ACTIVITY}
  - Worker state: /home/jarvis/.nex-code/worker-state.json
  - Worker log: /home/jarvis/.nex-code/worker.log

═══ NEW COMMITS (auto-improve ahead of devel) ═══
${ctx.newCommits || "(none — worker hasn't committed anything new)"}

═══ COMMITS LAST 24H ═══
${ctx.recentCommits || "(none)"}

═══ DIFF STAT ═══
${ctx.diffStat || "(none)"}

═══ ACTUAL DIFF (first 500 lines) ═══
${ctx.diff || "(empty)"}

═══ TEST STATUS (on auto-improve) ═══
${ctx.testStatus || "(unknown)"}

═══ WORKER ACTIVITY ═══
${ctx.workerActivity || "(no activity)"}

═══ WORKER STATE ═══
${ctx.workerState || "{}"}

═══ CURRENT CONFIG ═══
${ctx.currentConfig || "{}"}

═══ YOUR ACTIONS ═══

**If tests pass AND commits look good — merge to devel WITH post-merge regression test:**
\`\`\`bash
# Step 1: Merge
ssh -o BatchMode=yes ${SERVER} "cd ${SERVER_NEX_DIR} && git checkout devel && git pull origin devel && git merge origin/auto-improve --no-ff -m 'chore: merge auto-improve — worker improvements'"
# Step 2: Post-merge regression test on devel
ssh -o BatchMode=yes ${SERVER} "cd ${SERVER_NEX_DIR} && npx jest --forceExit --maxWorkers=50% 2>&1 | tail -20"
# Step 3: If tests PASS → push. If tests FAIL → revert the merge:
#   PASS: ssh -o BatchMode=yes ${SERVER} "cd ${SERVER_NEX_DIR} && git push origin devel && git checkout auto-improve && git merge devel && git push origin auto-improve"
#   FAIL: ssh -o BatchMode=yes ${SERVER} "cd ${SERVER_NEX_DIR} && git reset --hard HEAD~1 && git checkout auto-improve"
\`\`\`
IMPORTANT: You MUST run the post-merge regression test. If tests fail after merging, revert the merge immediately.

**If specific commits are bad — revert on auto-improve:**
\`\`\`bash
ssh -o BatchMode=yes ${SERVER} "cd ${SERVER_NEX_DIR} && git checkout auto-improve && git revert <hash> --no-edit && git push origin auto-improve"
\`\`\`

**Always update the config** — write new JSON to the server:
\`\`\`bash
ssh -o BatchMode=yes ${SERVER} "cat > ${SERVER_CONFIG}" << 'CONFIGEOF'
{ ... new config JSON ... }
CONFIGEOF
\`\`\`

**Reset worker failures** if you've fixed the cause:
\`\`\`bash
ssh -o BatchMode=yes ${SERVER} "node -e \\"
  const f='/home/jarvis/.nex-code/worker-state.json';
  const s=JSON.parse(require('fs').readFileSync(f,'utf8'));
  s.consecutiveFailures=0;
  require('fs').writeFileSync(f,JSON.stringify(s,null,2));
\\""
\`\`\`

RULES:
- Be specific in priority_issues — file paths, line numbers, function names.
- The worker uses Gemma 4 (31B) — it understands code well. Give specific file+line targets.
- Only merge to devel if tests pass on auto-improve AND after post-merge regression test.
- ALWAYS run the post-merge regression test after merging to devel. If it fails, revert immediately.
- ALWAYS include "updated_at": "${new Date().toISOString()}" in the config update — the worker uses this to detect supervisor staleness.
- Write everything in English.
- End with a 3-5 sentence summary of today's assessment.`;
}

// ── Matrix notification (via server) ──────────────────────────────────────
function sendMatrix(message) {
  try {
    ssh(
      `curl -sf -X POST http://localhost:3000/matrix/notify -H 'Content-Type: application/json' -d '${JSON.stringify({ message }).replace(/'/g, "'\\''")}'`,
      10_000,
    );
    log("Matrix sent.");
  } catch (e) {
    log(`Matrix failed: ${e.message}`);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────
function run() {
  log("═══════════════════════════════════════════════════");
  log("nex-code supervisor — daily review");
  log("═══════════════════════════════════════════════════");

  const ctx = gatherContext();

  // Abort if server is unreachable
  if (ctx._unreachable) {
    log("Aborting — server unreachable. Will retry next run.");
    sendMatrix("⚠️ nex-code supervisor: server unreachable, skipping today's review.");
    logRun({ status: "skipped", reason: "server_unreachable" });
    return;
  }

  const newCount = (ctx.newCommits || "").split("\n").filter(Boolean).length;
  const testsOk = ctx.testStatus && (ctx.testStatus.includes("passed") && !ctx.testStatus.includes("failed"));
  log(`New commits: ${newCount}, Tests: ${testsOk ? "passing" : "check needed"}`);

  // Skip if no new commits and no issues to address
  if (newCount === 0) {
    log("No new commits — updating config only.");
    // Still update config to steer worker, but skip the full Claude review
  }

  const prompt = buildPrompt(ctx);

  log("Running Claude Code (Sonnet)...");
  const startTime = Date.now();

  // Use --dangerously-skip-permissions so Claude can actually execute SSH commands
  // Pipe prompt via stdin with -p (print mode)
  const res = spawnSync(
    CLAUDE_BIN,
    ["--dangerously-skip-permissions", "--model", "sonnet", "-p"],
    {
      cwd: NEX_DIR,
      input: prompt,
      stdio: ["pipe", "pipe", "pipe"],
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

  log(`Complete (${elapsed}s).`);
  const summary = output.trim().split("\n").filter(Boolean).slice(-5).join("\n");

  logRun({
    status: "ok",
    elapsed_s: elapsed,
    new_commits: newCount,
    summary: summary.slice(0, 500),
  });

  sendMatrix(
    `🧠 nex-code supervisor review.\n` +
      `Commits: ${newCount} | Tests: ${testsOk ? "✅" : "⚠️"}\n` +
      `${summary.slice(0, 300)}`,
  );

  // Always sync devel back into auto-improve so the worker stays current.
  // Claude's prompt asks it to do this, but it sometimes skips the step.
  log("Syncing devel → auto-improve on server...");
  const syncResult = ssh(
    `cd ${SERVER_NEX_DIR} && git fetch origin devel -q && git checkout auto-improve -q && git merge origin/devel --no-edit -q && git push origin auto-improve -q && echo "synced"`,
    60_000,
  );
  if (syncResult.includes("synced")) {
    log("auto-improve synced with devel.");
  } else {
    log(`auto-improve sync skipped or failed: ${syncResult.slice(0, 100)}`);
  }

  log("Done.");
}

function logRun(entry) {
  let runs = [];
  try { runs = JSON.parse(fs.readFileSync(SUPERVISOR_LOG, "utf8")); } catch {}
  runs.push({ timestamp: new Date().toISOString(), ...entry });
  if (runs.length > 100) runs = runs.slice(-100);
  fs.mkdirSync(path.dirname(SUPERVISOR_LOG), { recursive: true });
  fs.writeFileSync(SUPERVISOR_LOG, JSON.stringify(runs, null, 2));
}

run();

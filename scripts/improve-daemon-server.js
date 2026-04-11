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
const FINDINGS_FILE = path.join(HOME, ".nex-code/worker-findings.json");
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
function getConfigAge() {
  try {
    const cfg = readConfig();
    if (!cfg.updated_at) return Infinity;
    return (Date.now() - new Date(cfg.updated_at).getTime()) / 3600_000; // hours
  } catch { return Infinity; }
}

// ── Worker findings (cross-pass memory) ──────────────────────────────────
function readFindings() {
  try { return JSON.parse(fs.readFileSync(FINDINGS_FILE, "utf8")); }
  catch { return { targets: [], fixed: [], discovered_at: {} }; }
}
function writeFindings(f) {
  // Keep last 100 targets, 200 fixed
  if (f.targets.length > 100) f.targets = f.targets.slice(-100);
  if (f.fixed.length > 200) f.fixed = f.fixed.slice(-200);
  fs.writeFileSync(FINDINGS_FILE, JSON.stringify(f, null, 2));
}
function recordFinding(file, lineNum, type) {
  const findings = readFindings();
  const key = `${file}:${lineNum}`;
  if (!findings.targets.includes(key)) {
    findings.targets.push(key);
    findings.discovered_at[key] = new Date().toISOString();
  }
  writeFindings(findings);
}
function markFixed(file, lineNum) {
  const findings = readFindings();
  const key = `${file}:${lineNum}`;
  findings.targets = findings.targets.filter((t) => t !== key);
  if (!findings.fixed.includes(key)) findings.fixed.push(key);
  delete findings.discovered_at[key];
  writeFindings(findings);
}
function isAlreadyFixed(file, lineNum) {
  const findings = readFindings();
  return findings.fixed.includes(`${file}:${lineNum}`);
}

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

// ── Paths that must never be touched by the worker ───────────────────────
const DEFAULT_BLOCKED_PATHS = [
  "scripts/", "docs/", "dist/", ".github/", "vscode/", "types/",
  "package.json", "package-lock.json", ".gitignore", ".npmignore",
  "CLAUDE.md", "README.md", "LICENSE",
];

// ── File importance weights (core files score higher) ────────────────────
const FILE_IMPORTANCE = {
  "cli/agent.js": 10,         // core agentic loop
  "cli/orchestrator.js": 9,   // multi-agent pipeline
  "cli/context-engine.js": 9, // token management
  "cli/sub-agent.js": 8,      // sub-agent runner
  "cli/tools/index.js": 8,    // tool system
  "cli/index-engine.js": 7,   // file search
  "cli/ssh.js": 7,            // remote operations
  "cli/session-tree.js": 6,   // session branching
  "cli/browser.js": 5,        // browser automation
  "cli/visual.js": 4,         // visual dev tools
  "cli/footer.js": 2,         // UI footer
};
function getFileImportance(file) {
  if (FILE_IMPORTANCE[file]) return FILE_IMPORTANCE[file];
  if (file.startsWith("cli/providers/")) return 8;
  if (file.startsWith("cli/skills/")) return 6;
  if (file.startsWith("cli/tools/")) return 7;
  return 5; // default
}

// ── Find a concrete improvement target ───────────────────────────────────
function findTarget() {
  const targets = [];

  // 1. Empty catch blocks (highest value)
  try {
    const out = execSync(
      `cd ${NEX_DIR} && grep -rn 'catch' cli/ --include='*.js' 2>/dev/null | grep -v 'test/' | grep -v 'node_modules'`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
    for (const line of out.split("\n").filter(Boolean)) {
      if (line.match(/catch\s*(\([^)]*\))?\s*\{\s*\}\s*$/)) {
        targets.push({ type: "empty_catch", line, priority: 10 });
      }
    }
  } catch {}

  // 2. TODO/FIXME/HACK markers (additive only)
  try {
    const out = execSync(
      `cd ${NEX_DIR} && grep -rn 'TODO\\|FIXME\\|HACK\\|BUG\\|XXX' cli/ --include='*.js' 2>/dev/null | grep -v 'test/' | grep -v 'node_modules' | head -20`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
    for (const line of out.split("\n").filter(Boolean)) {
      const lower = line.toLowerCase();
      if (lower.includes("remove") || lower.includes("simplify") || lower.includes("clean up") || lower.includes("refactor")) continue;
      targets.push({ type: "todo", line, priority: 6 });
    }
  } catch {}

  // 3. Failing tests — parse jest output for failing test names + files
  try {
    const out = execSync(
      `cd ${NEX_DIR} && npx jest --forceExit --maxWorkers=50% 2>&1 | grep -E '(FAIL|●)' | head -15`,
      { encoding: "utf8", timeout: 120_000 },
    ).trim();
    for (const line of out.split("\n").filter(Boolean)) {
      const failMatch = line.match(/FAIL\s+(cli\/\S+)/);
      if (failMatch) {
        targets.push({ type: "failing_test", line: `${failMatch[1]}:1:Test suite fails`, priority: 9 });
      }
    }
  } catch {}

  // 4. Hot files — recently changed files have more bug risk
  try {
    const out = execSync(
      `cd ${NEX_DIR} && git log --since='7 days ago' --diff-filter=M --name-only --format='' -- 'cli/*.js' | sort | uniq -c | sort -rn | head -5`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
    for (const line of out.split("\n").filter(Boolean)) {
      const match = line.trim().match(/^\d+\s+(cli\/\S+)/);
      if (match && !match[1].includes("test/")) {
        // Check for missing error handling in hot file
        try {
          const content = execSync(
            `cd ${NEX_DIR} && grep -n 'catch' "${match[1]}" 2>/dev/null | grep '\\{\\s*\\}' | head -3`,
            { encoding: "utf8", timeout: 5_000 },
          ).trim();
          if (content) {
            for (const cLine of content.split("\n").filter(Boolean)) {
              targets.push({ type: "hot_file_catch", line: `${match[1]}:${cLine}`, priority: 8 });
            }
          }
        } catch {}
      }
    }
  } catch {}

  // 5. Inconsistency scan — find functions with error handling in one place but not another
  try {
    const out = execSync(
      `cd ${NEX_DIR} && grep -rn 'function\\|async function\\|exports\\.' cli/ --include='*.js' 2>/dev/null | grep -v 'test/' | grep -v 'node_modules' | head -50`,
      { encoding: "utf8", timeout: 10_000 },
    ).trim();
    // Look for async functions without try/catch
    const asyncFns = out.split("\n").filter((l) => l.includes("async "));
    for (const line of asyncFns.slice(0, 10)) {
      const m = line.match(/^([^:]+):(\d+):/);
      if (!m) continue;
      const [, file, lineStr] = m;
      const lineNum = parseInt(lineStr, 10);
      try {
        // Check if there's a try/catch within 20 lines
        const nearby = execSync(
          `cd ${NEX_DIR} && awk 'NR>=${lineNum} && NR<=${lineNum + 20}' "${file}" 2>/dev/null`,
          { encoding: "utf8", timeout: 5_000 },
        );
        if (!nearby.includes("try") && !nearby.includes("catch") && nearby.includes("await")) {
          targets.push({ type: "missing_error_handling", line, priority: 7 });
        }
      } catch {}
    }
  } catch {}

  // 6. Worker findings from previous passes (cross-pass memory)
  const findings = readFindings();
  for (const key of findings.targets) {
    const [file, lineStr] = key.split(":");
    if (file && lineStr && !isAlreadyFixed(file, parseInt(lineStr, 10))) {
      targets.push({ type: "remembered", line: `${key}: (from previous discovery)`, priority: 7 });
    }
  }

  // Filter out already-fixed targets
  const filtered = targets.filter((t) => {
    const m = t.line.match(/^([^:]+):(\d+):/);
    if (!m) return true;
    return !isAlreadyFixed(m[1], parseInt(m[2], 10));
  });

  if (!filtered.length) return null;

  // Weight by priority × file importance, then pick weighted random
  const weighted = filtered.map((t) => {
    const m = t.line.match(/^([^:]+):(\d+):/);
    const importance = m ? getFileImportance(m[1]) : 5;
    return { ...t, weight: (t.priority || 5) * importance };
  });
  const totalWeight = weighted.reduce((s, t) => s + t.weight, 0);
  let roll = Math.random() * totalWeight;
  let target = weighted[0];
  for (const t of weighted) {
    roll -= t.weight;
    if (roll <= 0) { target = t; break; }
  }

  const match = target.line.match(/^([^:]+):(\d+):(.*)/);
  if (!match) return null;

  const [, file, lineStr, content] = match;
  const lineNum = parseInt(lineStr, 10);
  const start = Math.max(1, lineNum - 5);
  const end = lineNum + 10;

  let context = "";
  try {
    const lines = execSync(
      `cd ${NEX_DIR} && awk 'NR>=${start} && NR<=${end} { printf "%d: %s\\n", NR, $0 }' "${file}" 2>/dev/null`,
      { encoding: "utf8", timeout: 5_000 },
    ).trim();
    context = lines;
  } catch {}

  // Record this finding for future passes
  recordFinding(file, lineNum, target.type);

  return { ...target, file, lineNum, content: content.trim(), context };
}

// ── Build improvement prompt ──────────────────────────────────────────────
function buildPrompt(target) {
  const blocked = [...new Set([...DEFAULT_BLOCKED_PATHS, ...getBlockedFiles()])];
  const recentCommits = getRecentCommits(10);

  let prompt;

  if (target) {
    // SPECIFIC TARGET MODE — give the model exact code to fix
    prompt = `You have ONE task: fix the bug shown below in ${target.file} at line ${target.lineNum}.

BUG TYPE: ${target.type === "empty_catch" ? "Empty catch block silently swallows errors" : "TODO/FIXME marker needs addressing"}
FILE: ${target.file}
LINE: ${target.lineNum}
CONTENT: ${target.content}

SURROUNDING CODE (with line numbers):
\`\`\`javascript
${target.context}
\`\`\`

${target.type === "empty_catch" ? `FIX: Replace the empty catch block with error logging. Example:
  Before: } catch (e) {}
  After:  } catch (e) { console.error("functionName failed:", e.message); }
  Or if the catch has no parameter:
  Before: } catch {}
  After:  } catch (e) { console.error("operation failed:", e.message); }` :
`FIX: Address the TODO/FIXME comment. Read the surrounding code to understand what needs to be done, then implement it.`}

STEPS:
1. Read the file with read_file to see the full context around line ${target.lineNum}
2. Apply the fix using bash. Use this exact pattern:
   node -e "
     const fs = require('fs');
     let code = fs.readFileSync('${target.file}', 'utf8');
     code = code.replace(
       'EXACT_OLD_STRING',
       'EXACT_NEW_STRING'
     );
     fs.writeFileSync('${target.file}', code);
     console.log('Fix applied');
   "
3. Verify syntax: node -c ${target.file}
4. Run tests: npx jest --forceExit --maxWorkers=50%
   Pre-existing failures in context-engine, providers/local, providers/registry, registry.test are OK.

ALLOWED FILES — you may ONLY modify files matching: cli/*.js, cli/**/*.js (excluding cli/test/)
ANY other file (scripts/, docs/, package.json, tests/, etc.) will be auto-reverted. Do not waste time on them.
Recent commits: ${recentCommits || "(none)"}

RULES — STRICTLY ENFORCED:
- Fixes must be ADDITIVE: add error handling, add logging, add validation, add missing checks.
- NEVER remove existing code (guards, checks, typeof checks, conditionals) unless replacing with strictly better logic.
- NEVER simplify existing boolean expressions or conditions — they are written that way for a reason.
- NEVER change behavior of working code. A "fix" that changes what valid inputs do is a BUG, not a fix.
- If a TODO/FIXME says to remove something, SKIP it — only address TODOs that ask to ADD something.

CRITICAL: Use bash with node -e to write the fix. Do NOT use write_file or edit_file — use bash instead.`;
  } else {
    // FALLBACK: no pre-found target, let the model search
    prompt = `You are the nex-code auto-improvement worker. Find and fix ONE concrete bug in cli/ source code.

STEPS:
1. Search for bugs: grep -rn 'catch.*{}' cli/ --include='*.js'
2. Read the file with the bug using read_file
3. Fix it using bash with node -e:
   node -e "const fs=require('fs'); let c=fs.readFileSync('FILE','utf8'); c=c.replace('OLD','NEW'); fs.writeFileSync('FILE',c); console.log('done')"
4. Verify syntax: node -c <file>
5. Run: npx jest --forceExit --maxWorkers=50%

ALLOWED FILES — you may ONLY modify files matching: cli/*.js, cli/**/*.js (excluding cli/test/)
ANY other file will be auto-reverted. Do not waste time on them.
Recent commits: ${recentCommits || "(none)"}

RULES — STRICTLY ENFORCED:
- Fixes must be ADDITIVE: add error handling, add logging, add validation.
- NEVER remove existing guards, typeof checks, or conditionals.
- NEVER simplify boolean expressions or change behavior of working code.

CRITICAL: Use bash with node -e to write the fix. Do NOT use write_file or edit_file.`;
  }

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

  // Supervisor staleness check — warn if config not updated in >36h
  const configAgeHours = getConfigAge();
  if (configAgeHours > 36) {
    log(`WARNING: Supervisor config is ${Math.round(configAgeHours)}h old (>36h). Supervisor may be down.`);
    logActivity({ type: "alert", result: "supervisor_stale", config_age_hours: Math.round(configAgeHours) });
    // Auto-pause after 72h without supervisor contact
    if (configAgeHours > 72) {
      log("PAUSED: Config >72h stale — supervisor offline. Waiting for manual intervention.");
      logActivity({ type: "proactive", result: "paused", reason: "supervisor_stale_72h" });
      return;
    }
  }

  // Ensure correct branch + pull latest
  ensureBranch();

  // Find a concrete target before invoking nex-code
  const target = findTarget();
  if (target) {
    log(`Target: ${target.type} in ${target.file}:${target.lineNum} — ${target.content.slice(0, 60)}`);
  } else {
    log("No grep targets found — model will search on its own.");
  }

  const prompt = buildPrompt(target);
  const tmpFile = `/tmp/nex-improve-${Date.now()}.txt`;
  fs.writeFileSync(tmpFile, prompt);

  log("─── Improvement pass starting ───");
  const beforeCount = getCommitCount();
  const startTime = Date.now();

  const res = spawnSync(
    NEX_CODE_BIN,
    ["--prompt-file", tmpFile, "--auto", "--no-auto-orchestrate"],
    {
      cwd: NEX_DIR,
      stdio: "inherit",
      timeout: PASS_TIMEOUT_MS,
      env: {
        ...process.env,
        HOME,
        NEX_MODEL: "gemma4:31b",
        NEX_SKIP_BENCHMARK: "1",
        NEX_SKIP_COMPACTOR: "1",
      },
    },
  );

  try { fs.unlinkSync(tmpFile); } catch {}

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  let afterCount = getCommitCount();
  let committed = afterCount > beforeCount;

  // Fallback: if nex-code modified cli/ files but didn't commit, auto-commit
  if (!committed) {
    try {
      const uncommitted = execSync(
        `cd ${NEX_DIR} && git diff --name-only -- 'cli/*.js'`,
        { encoding: "utf8", timeout: 10_000 },
      ).trim();

      if (uncommitted) {
        const files = uncommitted.split("\n").filter(Boolean);
        const allInCli = files.every((f) => f.startsWith("cli/") && !f.startsWith("cli/test/"));

        if (allInCli && files.length > 0 && files.length <= 5) {
          // Run a quick syntax check before committing
          let syntaxOk = true;
          for (const f of files) {
            try {
              execSync(`cd ${NEX_DIR} && node -c "${f}"`, { timeout: 5_000 });
            } catch {
              syntaxOk = false;
              break;
            }
          }

          if (syntaxOk) {
            // Analyze the diff before committing
            let diffOut = "";
            let added = [];
            let removed = [];
            try {
              diffOut = execSync(
                `cd ${NEX_DIR} && git diff -- ${files.join(" ")}`,
                { encoding: "utf8", timeout: 10_000 },
              );
              added = diffOut.split("\n")
                .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
                .map((l) => l.slice(1).trim())
                .filter((l) => l && !l.startsWith("//") && !l.startsWith("*"));
              removed = diffOut.split("\n")
                .filter((l) => l.startsWith("-") && !l.startsWith("---"))
                .map((l) => l.slice(1).trim())
                .filter((l) => l && !l.startsWith("//") && !l.startsWith("*"));
            } catch {}

            // GUARD: reject subtractive changes (more removed than added)
            const isSubtractive = removed.length > 0 && added.length < removed.length;
            const removesGuards = removed.some((l) =>
              /typeof\s+\w+/.test(l) ||           // removes typeof checks
              /instanceof\s+/.test(l) ||           // removes instanceof checks
              /===\s*["']/.test(l) && !added.some((a) => /===\s*["']/.test(a)) || // removes strict equality without replacement
              /if\s*\(!?\w+\)\s*return/.test(l),   // removes early-return guards
            );

            if (isSubtractive || removesGuards) {
              log(`Auto-commit REJECTED: subtractive change (${removed.length} removed, ${added.length} added, removesGuards=${removesGuards})`);
              execSync(`cd ${NEX_DIR} && git checkout -- .`, { timeout: 10_000 });
              logActivity({ type: "proactive", result: "rejected", reason: "subtractive_change", elapsed_s: elapsed });
              writeState(state);
              return;
            }

            log(`Auto-commit fallback: ${files.join(", ")}`);

            // Build a descriptive commit message from the actual diff
            let commitMsg = `fix: improve ${files[0].replace("cli/", "")}`;

            if (removed.some((l) => /catch\s*(\([^)]*\))?\s*\{\s*\}/.test(l))) {
              commitMsg = `fix: add error logging to empty catch block in ${files[0].replace("cli/", "")}`;
            } else if (added.some((l) => /console\.error/.test(l))) {
              commitMsg = `fix: add error logging in ${files[0].replace("cli/", "")}`;
            } else if (removed.length && added.length) {
              const what = added[0].slice(0, 50).replace(/["`]/g, "'");
              commitMsg = `fix: ${files[0].replace("cli/", "")} — add ${what}`;
            }
            if (commitMsg.length > 72) commitMsg = commitMsg.slice(0, 69) + "...";

            execSync(
              `cd ${NEX_DIR} && git add ${files.join(" ")} && git commit -m "${commitMsg.replace(/"/g, '\\"')}" && git push origin ${BRANCH}`,
              { timeout: 30_000 },
            );
            committed = true;
          } else {
            log("Auto-commit skipped: syntax errors in modified files.");
            execSync(`cd ${NEX_DIR} && git checkout -- .`, { timeout: 10_000 });
          }
        } else if (!allInCli) {
          log(`Auto-commit skipped: files outside cli/ modified: ${files.join(", ")}`);
          execSync(`cd ${NEX_DIR} && git checkout -- .`, { timeout: 10_000 });
        }
      }
    } catch (e) {
      log(`Auto-commit fallback error: ${e.message.slice(0, 200)}`);
      try { execSync(`cd ${NEX_DIR} && git checkout -- .`, { timeout: 10_000 }); } catch {}
    }
  }

  state.totalPasses = (state.totalPasses || 0) + 1;

  // Post-commit validation: revert if files outside cli/ were touched
  if (committed) {
    try {
      const changedFiles = execSync(
        `cd ${NEX_DIR} && git diff HEAD~1 --name-only`,
        { encoding: "utf8", timeout: 10_000 },
      ).trim().split("\n").filter(Boolean);

      const forbidden = changedFiles.filter(
        (f) => !f.startsWith("cli/") || f.startsWith("cli/test/"),
      );
      if (forbidden.length > 0) {
        log(`BLOCKED: commit touched forbidden files: ${forbidden.join(", ")}`);
        log("Reverting last commit...");
        execSync(`cd ${NEX_DIR} && git reset --hard HEAD~1`, { timeout: 10_000 });
        execSync(`cd ${NEX_DIR} && git push origin ${BRANCH} --force-with-lease`, { timeout: 30_000 });
        logActivity({ type: "proactive", result: "reverted", reason: "forbidden_files", files: forbidden, elapsed_s: elapsed });
        writeState(state);
        return;
      }
    } catch (e) {
      log(`Post-commit validation error: ${e.message}`);
    }
  }

  if (committed) {
    state.dailyCommits = (state.dailyCommits || 0) + 1;
    state.totalCommits = (state.totalCommits || 0) + 1;
    state.consecutiveFailures = 0;
    writeState(state);
    // Mark target as fixed in worker memory
    if (target) markFixed(target.file, target.lineNum);
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

// ── Practice run (Nex-Code-Playground) ───────────────────────────────────────────
const PRACTICE_RUNNER = path.join(__dirname, "practice-runner.js");

function runPractice() {
  if (!fs.existsSync(PRACTICE_RUNNER)) {
    log("Practice runner not found — skipping.");
    return;
  }

  log("─── Nex-Code-Playground: practice run ───");
  const startTime = Date.now();

  const res = spawnSync(
    process.execPath,
    [PRACTICE_RUNNER],
    {
      cwd: NEX_DIR,
      stdio: "inherit",
      timeout: PASS_TIMEOUT_MS,
      env: {
        ...process.env,
        HOME,
        NEX_MODEL: "gemma4:31b",
        NEX_SKIP_BENCHMARK: "1",
        NEX_SKIP_COMPACTOR: "1",
      },
    },
  );

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const success = res.status === 0;

  log(`Practice run complete (${elapsed}s, ${success ? "passed" : "needs improvement"}).`);
  logActivity({
    type: "practice",
    result: success ? "passed" : "needs_work",
    elapsed_s: elapsed,
  });

  // Read practice results and feed weak areas into improvement config
  try {
    const results = JSON.parse(fs.readFileSync(
      path.join(HOME, ".nex-code/practice-results.json"), "utf8",
    ));
    const recent = results.slice(-5);
    const weakAreas = recent
      .filter((r) => r.score.total <= 4)
      .map((r) => `${r.project} (${r.task.category}): ${r.score.total}/10`);

    if (weakAreas.length) {
      log(`Weak practice areas: ${weakAreas.join("; ")}`);
    }
  } catch {}
}

// ── Combined pass (improvement OR practice) ───────────────────────────────
let passCounter = 0;

function combinedPass() {
  passCounter++;
  // Every 5th pass: practice run (was 3rd — reduced to prioritize real improvements)
  if (passCounter % 5 === 0 && fs.existsSync(PRACTICE_RUNNER)) {
    runPractice();
  } else {
    runPass();
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
log(`Practice:  every 5th pass (Nex-Code-Playground)`);
log("═══════════════════════════════════════════════════");

// First pass after 2 min warmup, then every N min
setTimeout(() => {
  combinedPass();
  setInterval(combinedPass, intervalMs);
}, 2 * 60_000);

log(`First pass in 2 min, then every ${config.proactive_interval_min} min.`);

// Graceful shutdown
process.on("SIGTERM", () => { log("SIGTERM — shutting down."); process.exit(0); });
process.on("SIGINT", () => { log("SIGINT — shutting down."); process.exit(0); });

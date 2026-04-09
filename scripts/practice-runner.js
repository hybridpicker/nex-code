#!/usr/bin/env node
/**
 * practice-runner.js — nex-code Nex-Code-Playground
 *
 * Safe sandbox where nex-code practices real tasks on real projects.
 * Uses git worktrees for isolation — production code is never touched.
 *
 * Flow:
 *   1. Pick a project + task (round-robin or random)
 *   2. Create git worktree in ~/playground/<project>-<timestamp>
 *   3. Set up environment (npm install / pip install)
 *   4. Run nex-code --auto with the task
 *   5. Score the result (build? tests? diff quality?)
 *   6. Log results + insights
 *   7. Clean up worktree
 *
 * Safety:
 *   - All work happens in ~/playground/ worktrees (production untouched)
 *   - Disk quota: 10 GB max for all playground worktrees
 *   - Blocked: systemctl, nginx, certbot, database writes, rm -rf /
 *   - Time limit: 10 min per task
 *   - Cleanup: worktrees deleted after scoring
 *
 * Usage:
 *   node scripts/practice-runner.js                    # run one random task
 *   node scripts/practice-runner.js --project pro-tuner  # specific project
 *   node scripts/practice-runner.js --list              # list available tasks
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync, execSync } = require("child_process");

// ── Config ────────────────────────────────────────────────────────────────
const HOME = process.env.HOME || "/home/jarvis";
const PLAYGROUND_DIR = path.join(HOME, "playground");
const RESULTS_FILE = path.join(HOME, ".nex-code/practice-results.json");
const TASKS_FILE = path.join(__dirname, "practice-tasks.json");
const PRACTICE_BRANCH = "nex-practice";
const MAX_PLAYGROUND_MB = 10_000; // 10 GB disk quota
const TASK_TIMEOUT_MS = 600_000; // 10 min per task
const NEX_CODE_BIN = (() => {
  try { return execSync("which nex-code", { encoding: "utf8" }).trim(); }
  catch { return path.join(HOME, "Coding/nex-code/dist/nex-code.js"); }
})();

// ── Blocked commands (safety) ─────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  "systemctl", "nginx", "certbot", "firewall-cmd",
  "rm -rf /", "rm -rf ~", "DROP TABLE", "DELETE FROM",
  "shutdown", "reboot", "mkfs", "fdisk",
  "podman rm", "podman stop",
];

// ── Project registry ──────────────────────────────────────────────────────
// Maps project names to their git repo paths on the server
const PROJECTS = {
  "pro-tuner":      { path: path.join(HOME, "apps/pro-tuner"),         type: "node" },
  "games-project":  { path: path.join(HOME, "apps/games-project"),     type: "django" },
  "homemusic":      { path: path.join(HOME, "apps/homemusic"),         type: "django" },
  "chord-library":  { path: path.join(HOME, "apps/chord-library"),     type: "node" },
  "cookbook":        { path: path.join(HOME, "apps/cookbook"),           type: "django" },
  "vocabulary":     { path: path.join(HOME, "apps/vocabulary"),        type: "django" },
  "biohonig":       { path: path.join(HOME, "apps/biohonig"),          type: "django" },
  "schoensgibl":    { path: path.join(HOME, "apps/schoensgibl/schoensgibl"), type: "django" },
  "jarvis-agent":   { path: path.join(HOME, "jarvis-agent"),           type: "node" },
  "nex-code":       { path: path.join(HOME, "Coding/nex-code"),        type: "node" },
};

// ── Logging ───────────────────────────────────────────────────────────────
function log(...args) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(`[${ts}]`, ...args);
}

// ── Disk quota check ──────────────────────────────────────────────────────
function checkDiskQuota() {
  try {
    const out = execSync(`du -sm ${PLAYGROUND_DIR} 2>/dev/null || echo "0"`, {
      encoding: "utf8",
      timeout: 10_000,
    });
    const mb = parseInt(out.trim().split(/\s/)[0], 10) || 0;
    return { mb, ok: mb < MAX_PLAYGROUND_MB };
  } catch {
    return { mb: 0, ok: true };
  }
}

// ── Load tasks ────────────────────────────────────────────────────────────
function loadTasks() {
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));
  } catch (e) {
    log(`Cannot load tasks: ${e.message}`);
    return {};
  }
}

// ── Pick a task ───────────────────────────────────────────────────────────
function pickTask(projectFilter) {
  const allTasks = loadTasks();
  const available = [];

  for (const [project, tasks] of Object.entries(allTasks)) {
    if (projectFilter && project !== projectFilter) continue;
    if (!PROJECTS[project]) continue;
    if (!fs.existsSync(PROJECTS[project].path)) continue;

    for (const task of tasks) {
      available.push({ project, ...task });
    }
  }

  if (!available.length) {
    log("No tasks available.");
    return null;
  }

  // Weighted random — prefer tasks that haven't been run recently
  const results = loadResults();
  const recentProjects = new Set(
    results.slice(-10).map((r) => r.project),
  );

  // Prefer projects not recently practiced
  const fresh = available.filter((t) => !recentProjects.has(t.project));
  const pool = fresh.length ? fresh : available;

  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Create worktree ───────────────────────────────────────────────────────
function createWorktree(project) {
  const info = PROJECTS[project];
  if (!info) return null;

  const timestamp = Date.now();
  const worktreePath = path.join(PLAYGROUND_DIR, `${project}-${timestamp}`);

  try {
    fs.mkdirSync(PLAYGROUND_DIR, { recursive: true });

    // Create practice branch if it doesn't exist
    execSync(
      `cd "${info.path}" && git branch ${PRACTICE_BRANCH} 2>/dev/null || true`,
      { timeout: 10_000 },
    );

    // Create worktree
    execSync(
      `cd "${info.path}" && git worktree add "${worktreePath}" ${PRACTICE_BRANCH} 2>&1`,
      { timeout: 30_000, encoding: "utf8" },
    );

    log(`Worktree created: ${worktreePath}`);
    return worktreePath;
  } catch (e) {
    log(`Worktree creation failed: ${e.message}`);

    // If branch already has a worktree, remove old one first
    if (e.message.includes("already checked out")) {
      try {
        execSync(`cd "${info.path}" && git worktree prune`, { timeout: 10_000 });
        execSync(
          `cd "${info.path}" && git worktree add "${worktreePath}" ${PRACTICE_BRANCH} 2>&1`,
          { timeout: 30_000 },
        );
        return worktreePath;
      } catch (e2) {
        log(`Retry failed: ${e2.message}`);
      }
    }
    return null;
  }
}

// ── Setup environment ─────────────────────────────────────────────────────
function setupEnvironment(worktreePath, projectType) {
  try {
    if (projectType === "node") {
      if (fs.existsSync(path.join(worktreePath, "package.json"))) {
        log("Installing Node dependencies...");
        execSync(`cd "${worktreePath}" && npm install --production 2>&1`, {
          timeout: 120_000,
          encoding: "utf8",
        });
      }
    } else if (projectType === "django") {
      // Create venv if requirements.txt exists
      const reqFile = path.join(worktreePath, "requirements.txt");
      if (fs.existsSync(reqFile)) {
        log("Setting up Python venv...");
        execSync(
          `cd "${worktreePath}" && python3 -m venv .practice-venv && ` +
            `.practice-venv/bin/pip install -r requirements.txt 2>&1 | tail -3`,
          { timeout: 180_000, encoding: "utf8" },
        );
      }
    }
    return true;
  } catch (e) {
    log(`Environment setup failed: ${e.message.slice(0, 200)}`);
    return false;
  }
}

// ── Run task ──────────────────────────────────────────────────────────────
function runTask(worktreePath, task, projectType) {
  const safetyBlock = BLOCKED_PATTERNS.map((p) => `- NEVER run: ${p}`).join("\n");

  const envHint = projectType === "django"
    ? `\nPython venv is at .practice-venv/. Activate with: source .practice-venv/bin/activate`
    : "";

  const testCmd = projectType === "node"
    ? "npx jest --forceExit --maxWorkers=50% 2>&1 || npm test 2>&1"
    : "source .practice-venv/bin/activate && python manage.py test 2>&1";

  const prompt = `You are practicing a real coding task. This is a SAFE PLAYGROUND — you can make any changes you want to the code in this directory. The changes will be scored and then discarded.

PROJECT: ${task.project}
TYPE: ${projectType}
TASK: ${task.description}
CATEGORY: ${task.category}
DIFFICULTY: ${task.difficulty || "medium"}
${envHint}

INSTRUCTIONS:
1. Read the relevant source files to understand the codebase.
2. Implement the task described above.
3. Run tests if available: ${testCmd}
4. When done, summarize what you changed and why.

SAFETY RULES:
${safetyBlock}
- This is an isolated worktree — changes here don't affect production.
- Do NOT modify any system configuration.
- Do NOT access databases or external services.
- Work ONLY within this directory: ${worktreePath}

SCORING CRITERIA:
- Does the code compile/run? (build passes)
- Do tests pass?
- Is the diff reasonable and focused?
- Is the code professional quality?
- Did you complete the actual task?`;

  const tmpFile = `/tmp/nex-practice-${Date.now()}.txt`;
  fs.writeFileSync(tmpFile, prompt);

  log(`Running task: ${task.description.slice(0, 80)}...`);
  const startTime = Date.now();

  const res = spawnSync(
    NEX_CODE_BIN,
    ["--prompt-file", tmpFile, "--auto"],
    {
      cwd: worktreePath,
      stdio: "inherit",
      timeout: TASK_TIMEOUT_MS,
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
  return { exitCode: res.status, elapsed };
}

// ── Score result ──────────────────────────────────────────────────────────
function scoreResult(worktreePath, task, projectType, runResult) {
  const score = { total: 0, max: 10, breakdown: {} };

  // 1. Did nex-code exit cleanly? (1 point)
  score.breakdown.clean_exit = runResult.exitCode === 0 ? 1 : 0;
  score.total += score.breakdown.clean_exit;

  // 2. Were files actually modified? (2 points)
  try {
    const diff = execSync(`cd "${worktreePath}" && git diff --stat`, {
      encoding: "utf8",
      timeout: 10_000,
    }).trim();
    const filesChanged = (diff.match(/\d+ file/)?.[0] || "0").replace(/ file/, "");
    score.breakdown.files_changed = parseInt(filesChanged, 10) > 0 ? 2 : 0;
    score.breakdown.diff_stat = diff.slice(0, 300);
  } catch {
    score.breakdown.files_changed = 0;
  }
  score.total += score.breakdown.files_changed;

  // 3. Build/syntax check (2 points)
  try {
    if (projectType === "node") {
      execSync(`cd "${worktreePath}" && node -e "require('./package.json')" 2>&1`, {
        timeout: 10_000,
      });
      // Check for syntax errors in changed JS files
      const changedFiles = execSync(
        `cd "${worktreePath}" && git diff --name-only -- '*.js' '*.mjs'`,
        { encoding: "utf8", timeout: 5_000 },
      ).trim().split("\n").filter(Boolean);

      let syntaxOk = true;
      for (const f of changedFiles.slice(0, 10)) {
        try {
          execSync(`cd "${worktreePath}" && node -c "${f}" 2>&1`, { timeout: 5_000 });
        } catch {
          syntaxOk = false;
          break;
        }
      }
      score.breakdown.build = syntaxOk ? 2 : 1;
    } else if (projectType === "django") {
      execSync(
        `cd "${worktreePath}" && source .practice-venv/bin/activate 2>/dev/null && python -m py_compile $(git diff --name-only -- '*.py' | head -5 | tr '\\n' ' ') 2>&1`,
        { timeout: 15_000, shell: "/bin/bash" },
      );
      score.breakdown.build = 2;
    }
  } catch {
    score.breakdown.build = 0;
  }
  score.total += score.breakdown.build || 0;

  // 4. Tests pass (3 points)
  try {
    if (projectType === "node") {
      execSync(
        `cd "${worktreePath}" && npx jest --forceExit --maxWorkers=50% 2>&1`,
        { timeout: 120_000 },
      );
      score.breakdown.tests = 3;
    } else if (projectType === "django") {
      execSync(
        `cd "${worktreePath}" && source .practice-venv/bin/activate && python manage.py test --failfast 2>&1`,
        { timeout: 120_000, shell: "/bin/bash" },
      );
      score.breakdown.tests = 3;
    }
  } catch {
    score.breakdown.tests = 0;
  }
  score.total += score.breakdown.tests || 0;

  // 5. Reasonable diff size (2 points) — not too big, not empty
  try {
    const diffLines = execSync(
      `cd "${worktreePath}" && git diff --shortstat`,
      { encoding: "utf8", timeout: 5_000 },
    ).trim();
    const insertions = parseInt((diffLines.match(/(\d+) insertion/)?.[1]) || "0", 10);
    const deletions = parseInt((diffLines.match(/(\d+) deletion/)?.[1]) || "0", 10);
    const totalChanges = insertions + deletions;

    if (totalChanges > 0 && totalChanges < 500) {
      score.breakdown.diff_quality = 2; // focused change
    } else if (totalChanges >= 500) {
      score.breakdown.diff_quality = 1; // too large but tried
    } else {
      score.breakdown.diff_quality = 0; // no changes
    }
  } catch {
    score.breakdown.diff_quality = 0;
  }
  score.total += score.breakdown.diff_quality || 0;

  // Grade
  if (score.total >= 9) score.grade = "A";
  else if (score.total >= 7) score.grade = "B";
  else if (score.total >= 5) score.grade = "C";
  else if (score.total >= 3) score.grade = "D";
  else score.grade = "F";

  return score;
}

// ── Clean up worktree ─────────────────────────────────────────────────────
function cleanupWorktree(worktreePath, project) {
  try {
    const info = PROJECTS[project];
    execSync(`rm -rf "${worktreePath}"`, { timeout: 30_000 });
    if (info) {
      execSync(`cd "${info.path}" && git worktree prune 2>/dev/null`, { timeout: 10_000 });
    }
    log("Worktree cleaned up.");
  } catch (e) {
    log(`Cleanup warning: ${e.message}`);
  }
}

// ── Results log ───────────────────────────────────────────────────────────
function loadResults() {
  try { return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")); }
  catch { return []; }
}

function saveResult(result) {
  const results = loadResults();
  results.push(result);
  // Keep last 500 entries
  const trimmed = results.slice(-500);
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(trimmed, null, 2));
}

// ── Extract insights for worker config ────────────────────────────────────
function extractInsights(result) {
  const insights = [];

  if (result.score.total <= 3) {
    insights.push(`nex-code scored ${result.score.total}/10 on ${result.project} (${result.task.category})`);

    if (!result.score.breakdown.files_changed) {
      insights.push(`Failed to make any changes on ${result.project} — may struggle with ${result.projectType} projects`);
    }
    if (!result.score.breakdown.tests) {
      insights.push(`Tests failed after changes on ${result.project}`);
    }
    if (!result.score.breakdown.build) {
      insights.push(`Syntax errors introduced on ${result.project}`);
    }
  }

  return insights;
}

// ── Main ──────────────────────────────────────────────────────────────────
function run(args) {
  // Parse args
  const projectFilter = args.includes("--project")
    ? args[args.indexOf("--project") + 1]
    : null;

  if (args.includes("--list")) {
    const tasks = loadTasks();
    for (const [project, taskList] of Object.entries(tasks)) {
      const exists = PROJECTS[project] && fs.existsSync(PROJECTS[project]?.path);
      console.log(`\n${project} ${exists ? "✓" : "✗ (not found)"}:`);
      for (const t of taskList) {
        console.log(`  [${t.category}] ${t.description} (${t.difficulty || "medium"})`);
      }
    }
    return null;
  }

  // Disk quota
  const quota = checkDiskQuota();
  if (!quota.ok) {
    log(`Disk quota exceeded: ${quota.mb}MB / ${MAX_PLAYGROUND_MB}MB. Run cleanup.`);
    return null;
  }

  // Pick task
  const task = pickTask(projectFilter);
  if (!task) return null;

  const project = task.project;
  const info = PROJECTS[project];

  log("═══════════════════════════════════════════════════");
  log(`Nex-Code-Playground — Practice Run`);
  log(`Project:  ${project} (${info.type})`);
  log(`Task:     ${task.description}`);
  log(`Category: ${task.category} | Difficulty: ${task.difficulty || "medium"}`);
  log("═══════════════════════════════════════════════════");

  // Create worktree
  const worktreePath = createWorktree(project);
  if (!worktreePath) {
    const result = {
      timestamp: new Date().toISOString(),
      project,
      projectType: info.type,
      task: { description: task.description, category: task.category },
      score: { total: 0, max: 10, grade: "F", breakdown: { error: "worktree_failed" } },
      elapsed_s: 0,
    };
    saveResult(result);
    return result;
  }

  // Setup environment
  setupEnvironment(worktreePath, info.type);

  // Run task
  const runResult = runTask(worktreePath, task, info.type);

  // Score
  const score = scoreResult(worktreePath, task, info.type, runResult);
  log(`Score: ${score.total}/${score.max} (${score.grade})`);
  log(`Breakdown: ${JSON.stringify(score.breakdown)}`);

  // Save result
  const result = {
    timestamp: new Date().toISOString(),
    project,
    projectType: info.type,
    task: { description: task.description, category: task.category, difficulty: task.difficulty },
    score,
    elapsed_s: runResult.elapsed,
  };
  saveResult(result);

  // Extract insights
  const insights = extractInsights(result);
  if (insights.length) {
    log("Insights for worker:", insights.join("; "));
  }

  // Cleanup
  cleanupWorktree(worktreePath, project);

  log("Practice run complete.");
  return result;
}

// ── CLI entry point ───────────────────────────────────────────────────────
const result = run(process.argv.slice(2));
if (result) {
  process.exit(result.score.total >= 5 ? 0 : 1);
}

#!/usr/bin/env node
/**
 * Real-task suite — runs nex-code headlessly against copies of real projects
 * and scores ARTIFACTS AND TESTS, never session tidiness.
 *
 * A run is a FULL PASS only when:
 *   1. the project copy has file changes vs the baseline commit, AND
 *   2. the task's verification command exits successfully.
 * It additionally flags OVERCLAIMING: the final assistant message claims
 * success while the verification command failed.
 *
 * Task definitions live in .nex/real-tasks/*.json (gitignored — they reference
 * machine-local projects). Schema:
 *   {
 *     "id": "my-task",
 *     "name": "human readable",
 *     "project": "/abs/path/to/project",
 *     "prompt": "task prompt text",
 *     "verify": { "command": "npx vitest run x.test.js",
 *                 "mode": "exit0" | "pass-lines", "timeoutMs": 180000 },
 *     "maxTurns": 15,
 *     "timeoutMs": 600000
 *   }
 *
 * verify.mode:
 *   exit0       — verification passes when the command exits 0.
 *   pass-lines  — exits 0 AND prints at least one line, every non-empty
 *                 stdout line starting with "PASS".
 *
 * Each task runs in two variants by default:
 *   default — flags as a real user would run them (auto-orchestrate allowed)
 *   single  — with --no-auto-orchestrate
 *
 * Usage:
 *   node scripts/real-task-suite.js [--task=id1,id2] [--variant=default,single]
 *     [--parallel=2] [--keep] [--max-turns=15] [--model=provider:model]
 *     [--label=baseline]
 */

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const NEX_CODE = path.join(ROOT, "dist", "nex-code.js");
const TASKS_DIR = path.join(ROOT, ".nex", "real-tasks");
const RESULTS_DIR = path.join(TASKS_DIR, "results");

// ─── CLI args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argValue(name, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
}
const onlyTasks = argValue("task", "").split(",").filter(Boolean);
const variants = argValue("variant", "default,single").split(",").filter(Boolean);
const parallel = Math.max(1, parseInt(argValue("parallel", "2"), 10) || 2);
const keepDirs = argv.includes("--keep");
const maxTurnsOverride = argValue("max-turns", null);
const modelOverride = argValue("model", null);
const label = argValue("label", "run");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadTasks() {
  if (!fs.existsSync(TASKS_DIR)) {
    console.error(`No task definitions found in ${TASKS_DIR}`);
    console.error("Create .nex/real-tasks/*.json first (see header of this script).");
    process.exit(1);
  }
  const tasks = fs
    .readdirSync(TASKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), "utf8"));
      } catch (e) {
        console.error(`Skipping unparseable task file ${f}: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean)
    .filter((t) => t.id && t.project && t.prompt && t.verify?.command);
  return onlyTasks.length ? tasks.filter((t) => onlyTasks.includes(t.id)) : tasks;
}

function sh(cmd, opts = {}) {
  return spawnSync("/bin/sh", ["-c", cmd], {
    encoding: "utf8",
    timeout: opts.timeoutMs || 120000,
    cwd: opts.cwd,
    env: opts.env || process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function safeEnv(extra = {}) {
  const base = {};
  for (const k of ["PATH", "HOME", "USER", "SHELL", "TERM", "TMPDIR", "LANG", "NODE_PATH"]) {
    if (process.env[k]) base[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(NEX_|OLLAMA_)/.test(k)) base[k] = v;
  }
  // Reduce variance: no builtin skills, no LLM compactor during benchmarks.
  base.NEX_SKIP_BUILTIN_SKILLS = "1";
  base.NEX_SKIP_COMPACTOR = "1";
  return { ...base, ...extra };
}

/** Copy project to a temp dir (with .git), symlink node_modules, commit baseline. */
function prepareCopy(task, variant) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `nex-real-${task.id}-${variant}-`));
  const rsync = sh(
    `rsync -a --exclude /node_modules "${task.project}/" "${dir}/"`,
    { timeoutMs: 300000 },
  );
  if (rsync.status !== 0) {
    throw new Error(`rsync failed for ${task.id}: ${rsync.stderr}`);
  }
  const srcModules = path.join(task.project, "node_modules");
  if (fs.existsSync(srcModules)) {
    fs.symlinkSync(srcModules, path.join(dir, "node_modules"));
  }
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "real-task-suite",
    GIT_AUTHOR_EMAIL: "suite@localhost",
    GIT_COMMITTER_NAME: "real-task-suite",
    GIT_COMMITTER_EMAIL: "suite@localhost",
  };
  if (!fs.existsSync(path.join(dir, ".git"))) {
    sh(`git init -q`, { cwd: dir, env: gitEnv });
  }
  const commit = sh(
    `git -c core.hooksPath=/dev/null add -A && ` +
      `git -c core.hooksPath=/dev/null commit -q --allow-empty -m "real-task-suite baseline"`,
    { cwd: dir, env: gitEnv },
  );
  if (commit.status !== 0) {
    throw new Error(`baseline commit failed for ${task.id}: ${commit.stderr}`);
  }
  const sha = sh(`git rev-parse HEAD`, { cwd: dir, env: gitEnv }).stdout.trim();
  return { dir, baselineSha: sha };
}

function parseJsonEvents(text) {
  const events = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      /* interleaved non-JSON output */
    }
  }
  return events;
}

function changedFiles(dir, baselineSha) {
  const status = sh(`git status --porcelain`, { cwd: dir });
  const fromStatus = status.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim());
  const diff = sh(`git diff --name-only ${baselineSha}..HEAD 2>/dev/null`, { cwd: dir });
  const fromCommits = (diff.stdout || "").split("\n").filter(Boolean);
  return [...new Set([...fromStatus, ...fromCommits])].filter(
    (f) => f && !f.startsWith("node_modules"),
  );
}

function runVerification(task, dir) {
  const v = task.verify;
  const res = sh(v.command, {
    cwd: dir,
    timeoutMs: v.timeoutMs || 180000,
    env: { ...process.env, CI: "true" },
  });
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  let ok = res.status === 0;
  if (ok && v.mode === "pass-lines") {
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    ok = lines.length > 0 && lines.every((l) => l.startsWith("PASS"));
  }
  return { ok, exitCode: res.status, stdout: stdout.slice(-3000), stderr: stderr.slice(-2000) };
}

const SUCCESS_CLAIM_RE =
  /\b(done|complete(?:d)?|success(?:ful|fully)?|fixed|implemented|all tests pass(?:ing|ed)?|tests? (?:are )?passing|verified)\b/i;

function runAgent(task, variant, copy) {
  return new Promise((resolve) => {
    const promptFile = path.join(
      os.tmpdir(),
      `nex-real-prompt-${task.id}-${variant}-${process.pid}.txt`,
    );
    fs.writeFileSync(promptFile, task.prompt);
    const args = [
      NEX_CODE,
      "--prompt-file", promptFile,
      "--auto",
      "--json",
      "--max-turns", String(maxTurnsOverride || task.maxTurns || 15),
    ];
    if (variant === "single") args.push("--no-auto-orchestrate");
    if (modelOverride) args.push("--model", modelOverride);

    const started = Date.now();
    const proc = spawn(process.execPath, args, { cwd: copy.dir, env: safeEnv() });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    const timeoutMs = task.timeoutMs || 600000;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch { /* already gone */ }
      }, 5000);
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      try { fs.unlinkSync(promptFile); } catch { /* gone */ }
      const events = parseJsonEvents(stdout);
      const doneEvent = events.findLast?.((e) => e.type === "done" || e.type === "error") ||
        events.filter((e) => e.type === "done" || e.type === "error").pop();
      resolve({
        exitCode: code,
        timedOut,
        elapsedMs: Date.now() - started,
        finalResponse: doneEvent?.response || doneEvent?.error || "",
        agentSuccess: doneEvent?.type === "done" && doneEvent?.success !== false,
        toolCalls: doneEvent?.toolCalls ?? null,
        usedOrchestrator: /Auto-orchestrate/.test(stdout + stderr),
        stderrTail: stderr.slice(-2000),
      });
    });
  });
}

async function runOne(task, variant) {
  let copy;
  try {
    copy = prepareCopy(task, variant);
  } catch (e) {
    return { task: task.id, variant, error: e.message, fullPass: false };
  }
  const agent = await runAgent(task, variant, copy);
  const changed = changedFiles(copy.dir, copy.baselineSha);
  const verify = runVerification(task, copy.dir);
  const claimsSuccess = SUCCESS_CLAIM_RE.test(agent.finalResponse || "");
  const result = {
    task: task.id,
    variant,
    fullPass: changed.length > 0 && verify.ok,
    filesChanged: changed,
    verifyOk: verify.ok,
    verifyExit: verify.exitCode,
    overclaimed: claimsSuccess && !verify.ok,
    claimsSuccess,
    agentExit: agent.exitCode,
    agentSuccess: agent.agentSuccess,
    timedOut: agent.timedOut,
    elapsedSec: Math.round(agent.elapsedMs / 1000),
    toolCalls: agent.toolCalls,
    usedOrchestrator: agent.usedOrchestrator,
    finalResponse: (agent.finalResponse || "").slice(0, 1500),
    verifyOutput: verify.stdout.slice(-1500),
    stderrTail: agent.stderrTail,
    copyDir: keepDirs ? copy.dir : undefined,
  };
  if (!keepDirs) {
    try { fs.rmSync(copy.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  return result;
}

async function main() {
  if (!fs.existsSync(NEX_CODE)) {
    console.error(`Missing ${NEX_CODE} — run: npm run build`);
    process.exit(1);
  }
  const tasks = loadTasks();
  if (!tasks.length) {
    console.error("No matching tasks.");
    process.exit(1);
  }
  const jobs = [];
  for (const t of tasks) for (const v of variants) jobs.push({ t, v });
  console.log(
    `real-task-suite: ${tasks.length} tasks x ${variants.length} variants ` +
      `(parallel=${parallel}, label=${label})`,
  );

  const results = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const tag = `${job.t.id} [${job.v}]`;
      console.log(`▶ start  ${tag}`);
      const r = await runOne(job.t, job.v);
      results.push(r);
      const mark = r.fullPass ? "PASS" : r.error ? "ERROR" : "FAIL";
      console.log(
        `■ ${mark.padEnd(5)} ${tag} — changed=${r.filesChanged?.length ?? 0} ` +
          `verify=${r.verifyOk ? "ok" : "fail"} overclaim=${r.overclaimed ? "YES" : "no"} ` +
          `${r.timedOut ? "TIMEOUT " : ""}${r.elapsedSec ?? "?"}s` +
          (r.error ? ` (${r.error})` : ""),
      );
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = path.join(RESULTS_DIR, `${label}-${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ label, stamp, results }, null, 2));

  // Summary table
  console.log("\n=== real-task-suite summary ===");
  const byTask = {};
  for (const r of results) {
    byTask[r.task] = byTask[r.task] || {};
    byTask[r.task][r.variant] = r;
  }
  for (const [id, vs] of Object.entries(byTask)) {
    const cells = variants.map((v) => {
      const r = vs[v];
      if (!r) return `${v}:—`;
      return `${v}:${r.fullPass ? "PASS" : "FAIL"}${r.overclaimed ? "+overclaim" : ""}`;
    });
    console.log(`  ${id.padEnd(36)} ${cells.join("  ")}`);
  }
  const passes = results.filter((r) => r.fullPass).length;
  console.log(`\nFull passes: ${passes}/${results.length}`);
  console.log(`Results: ${outFile}`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { detectOverclaim: (text) => SUCCESS_CLAIM_RE.test(text || "") };

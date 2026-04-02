#!/usr/bin/env node
/**
 * scripts/benchmark-reallife.js — Real-Life Task Benchmark
 *
 * 28 tasks across 7 categories sourced from real ~/Coding/ projects.
 * Runs nex-code headless, evaluates results with category-weighted scoring.
 *
 * Usage:
 *   node scripts/benchmark-reallife.js [--dry-run] [--model <id>] [--tasks <id1,id2>] [--category <cat>]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

const { TASKS, CATEGORY_WEIGHTS } = require("./benchmark-reallife-tasks");

const NEX_CODE = path.join(__dirname, "..", "dist", "nex-code.js");
const RESULTS_DIR = path.join(__dirname, "benchmark-results");

// ─── Task Runner ────────────────────────────────────────────────

function runTask(task, model) {
  return new Promise((resolve) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `nex-reallife-${task.id}-`));

    // Setup the task environment
    try {
      task.setupFn(tmpDir);
    } catch (err) {
      resolve({
        id: task.id,
        category: task.category,
        score: 0,
        elapsed: 0,
        completionReason: "setup-error",
        error: err.message,
        details: {},
      });
      return;
    }

    const args = [
      NEX_CODE,
      "--task", task.description,
      "--auto",
      "--json",
      "--max-turns", String(task.maxTurns || 20),
    ];
    if (model) args.push("--model", model);

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Restrict env to safe vars only — prevent secret leakage to subprocesses
    const safeEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USER: process.env.USER,
      SHELL: process.env.SHELL,
      TERM: process.env.TERM,
      TMPDIR: process.env.TMPDIR,
      LANG: process.env.LANG,
      NODE_PATH: process.env.NODE_PATH,
      NEX_SKIP_BUILTIN_SKILLS: "1",
      NEX_AUTO_ORCHESTRATE: "false",
      NEX_SKIP_COMPACTOR: "1",
    };
    // Forward only NEX_* and OLLAMA_* vars (non-secret config)
    for (const [k, v] of Object.entries(process.env)) {
      if (/^(NEX_|OLLAMA_)/.test(k)) safeEnv[k] = v;
    }
    safeEnv.NEX_SKIP_BUILTIN_SKILLS = "1";
    safeEnv.NEX_AUTO_ORCHESTRATE = "false";
    safeEnv.NEX_SKIP_COMPACTOR = "1";

    const proc = spawn("node", args, {
      cwd: tmpDir,
      env: safeEnv,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, task.timeoutMs || 180000);

    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const elapsed = Date.now() - startTime;
      const completionReason = timedOut ? "timeout" : code === 0 ? "success" : "error";
      const result = evaluateTask(task, tmpDir, stdout, stderr, elapsed, completionReason);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      resolve(result);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      resolve({
        id: task.id,
        category: task.category,
        score: 0,
        elapsed: Date.now() - startTime,
        completionReason: "error",
        error: err.message,
        details: {},
      });
    });
  });
}

// ─── Evaluation ─────────────────────────────────────────────────

function countToolCalls(stdout, stderr) {
  let count = 0;
  const stderrMarkers = (stderr || "").match(/✓\s+\w+\(/g);
  if (stderrMarkers) count = stderrMarkers.length;
  if (count === 0) {
    const toolUseMatches = (stdout || "").match(/"type"\s*:\s*"function"|"tool_use"|"tool_call"/g);
    if (toolUseMatches) count = toolUseMatches.length;
  }
  if (count === 0) {
    const spinnerLines = (stderr || "").match(/^\s*\[.*?\]/gm);
    if (spinnerLines) count = spinnerLines.length;
  }
  return count;
}

function extractTokens(stdout) {
  try {
    // nex-code --json outputs a final summary with token counts
    const lines = stdout.split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj.inputTokens || obj.outputTokens || obj.usage) {
          return {
            input: obj.inputTokens || obj.usage?.input_tokens || 0,
            output: obj.outputTokens || obj.usage?.output_tokens || 0,
          };
        }
      } catch { /* not JSON */ }
    }
  } catch { /* ignore */ }
  return { input: 0, output: 0 };
}

function evaluateTask(task, tmpDir, stdout, stderr, elapsed, completionReason) {
  const toolCalls = countToolCalls(stdout, stderr);
  const tokens = extractTokens(stdout);

  // Run task-specific evaluation
  let evalResult = { taskCompletion: 0, editPrecision: 100, quality: 100 };
  try {
    evalResult = task.evaluateFn(tmpDir, stdout, stderr);
  } catch (err) {
    evalResult = { taskCompletion: 0, editPrecision: 0, quality: 0, error: err.message };
  }

  // Efficiency: time-based when tool counting is unavailable (0 tools reported),
  // otherwise tool calls vs budget. Time-based: full marks under 70% of timeout,
  // linear decay from 100% to 50% between 70%-100% of timeout.
  const timeoutMs = task.timeoutMs || 180000;
  let efficiency;
  if (toolCalls > 0) {
    efficiency = Math.max(0, 1 - Math.max(0, toolCalls - task.maxToolCalls) / task.maxToolCalls);
  } else {
    const timeRatio = elapsed / timeoutMs;
    if (timeRatio <= 0.7) {
      efficiency = 1.0;
    } else {
      efficiency = 1.0 - ((timeRatio - 0.7) / 0.3) * 0.5;
    }
  }

  // Composite score: completion(40%) + precision(25%) + efficiency(20%) + quality(15%)
  let score = Math.round(
    (evalResult.taskCompletion || 0) * 0.40 +
    (evalResult.editPrecision || 0) * 0.25 +
    efficiency * 100 * 0.20 +
    (evalResult.quality || 0) * 0.15
  );

  // Penalty: proportional reduction for timeout (not hard cap)
  // Tasks that completed the work but timed out still get credit for completion
  if (completionReason === "timeout") {
    score = Math.round(score * 0.7);
  }

  return {
    id: task.id,
    category: task.category,
    score,
    elapsed,
    completionReason,
    toolCalls,
    tokens,
    details: {
      taskCompletion: evalResult.taskCompletion || 0,
      editPrecision: evalResult.editPrecision || 0,
      efficiency: Math.round(efficiency * 100),
      quality: evalResult.quality || 0,
      error: evalResult.error,
    },
  };
}

// ─── Reporting ──────────────────────────────────────────────────

function printReport(results, elapsed) {
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  // Per-category averages
  const categoryScores = {};
  for (const [cat, tasks] of Object.entries(byCategory)) {
    const avg = Math.round(tasks.reduce((s, t) => s + t.score, 0) / tasks.length);
    categoryScores[cat] = avg;
  }

  // Weighted total
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const [cat, avg] of Object.entries(categoryScores)) {
    const weight = CATEGORY_WEIGHTS[cat] || 0;
    weightedTotal += avg * weight;
    totalWeight += weight;
  }
  const finalScore = totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0;

  // Token totals
  const totalTokens = results.reduce((s, r) => ({
    input: s.input + (r.tokens?.input || 0),
    output: s.output + (r.tokens?.output || 0),
  }), { input: 0, output: 0 });

  console.log("\n  ══════════════════════════════════════════════════");
  console.log("  Real-Life Benchmark Results");
  console.log("  ══════════════════════════════════════════════════\n");

  // Per-task results
  for (const [cat, tasks] of Object.entries(byCategory)) {
    const weight = CATEGORY_WEIGHTS[cat] || 0;
    const avg = categoryScores[cat];
    console.log(`  ── ${cat} (weight: ${(weight * 100).toFixed(0)}%, avg: ${avg}/100) ──`);
    for (const t of tasks) {
      const status = t.score >= 80 ? "✓" : t.score >= 50 ? "~" : "✗";
      const time = (t.elapsed / 1000).toFixed(1);
      console.log(`    ${status} ${t.id}: ${t.score}/100 (${time}s, ${t.toolCalls} tools)`);
      if (t.score < 80 && t.details.error) {
        console.log(`      Error: ${t.details.error}`);
      }
    }
    console.log();
  }

  console.log("  ── Summary ──");
  console.log(`  Final Weighted Score: ${finalScore}/100`);
  console.log(`  Total Tasks: ${results.length}`);
  console.log(`  Passing (>=80): ${results.filter(r => r.score >= 80).length}`);
  console.log(`  Partial (50-79): ${results.filter(r => r.score >= 50 && r.score < 80).length}`);
  console.log(`  Failing (<50): ${results.filter(r => r.score < 50).length}`);
  console.log(`  Total Time: ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`  Tokens: ${totalTokens.input} in / ${totalTokens.output} out`);
  console.log();

  return { finalScore, categoryScores, totalTokens };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;
  const tasksIdx = args.indexOf("--tasks");
  const taskFilter = tasksIdx !== -1 ? args[tasksIdx + 1].split(",") : null;
  const catIdx = args.indexOf("--category");
  const catFilter = catIdx !== -1 ? args[catIdx + 1] : null;

  let tasks = TASKS;
  if (taskFilter) tasks = tasks.filter((t) => taskFilter.includes(t.id));
  if (catFilter) tasks = tasks.filter((t) => t.category === catFilter);

  console.log(`\n  Real-Life Benchmark: ${tasks.length} tasks${model ? ` (model: ${model})` : ""}`);
  console.log(`  Categories: ${[...new Set(tasks.map(t => t.category))].join(", ")}\n`);

  if (dryRun) {
    console.log("  Tasks:");
    for (const t of tasks) {
      console.log(`    [${t.category}] ${t.id} — ${t.description.slice(0, 70)}...`);
    }
    console.log("\n  --dry-run: no tasks executed\n");
    return;
  }

  // Check dist exists
  if (!fs.existsSync(NEX_CODE)) {
    console.error("  ERROR: dist/nex-code.js not found. Run: npm run build\n");
    process.exit(1);
  }

  const startTime = Date.now();
  const results = [];

  for (const task of tasks) {
    process.stdout.write(`  Running ${task.id}... `);
    const result = await runTask(task, model);
    results.push(result);
    const status = result.score >= 80 ? "✓" : result.score >= 50 ? "~" : "✗";
    console.log(`${status} ${result.score}/100 (${(result.elapsed / 1000).toFixed(1)}s)`);
  }

  const totalElapsed = Date.now() - startTime;
  const { finalScore, categoryScores, totalTokens } = printReport(results, totalElapsed);

  // Save results
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outPath = path.join(RESULTS_DIR, `reallife-${timestamp}.json`);

  const resultData = {
    date: new Date().toISOString(),
    model,
    finalScore,
    categoryScores,
    totalTokens,
    totalElapsed,
    taskCount: results.length,
    passing: results.filter(r => r.score >= 80).length,
    results,
  };

  fs.writeFileSync(outPath, JSON.stringify(resultData, null, 2));

  // Append to history
  const historyPath = path.join(RESULTS_DIR, "reallife-history.jsonl");
  const historyLine = JSON.stringify({
    date: resultData.date,
    model,
    finalScore,
    categoryScores,
    taskCount: results.length,
    passing: resultData.passing,
    totalTokens,
  }) + "\n";
  fs.appendFileSync(historyPath, historyLine);

  console.log(`  Results: ${outPath}`);
  console.log(`  History: ${historyPath}\n`);
}

// Only run main() when executed directly, not when required as a module
if (require.main === module) {
  main().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
  });
}

module.exports = { runTask, evaluateTask, TASKS };

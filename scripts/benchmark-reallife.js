#!/usr/bin/env node
/**
 * scripts/benchmark-reallife.js — Real-Life Task Benchmark
 *
 * 35 tasks across 7 categories sourced from real ~/Coding/ projects.
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
const { computeBenchmarkScore, makeRunId } = require("./benchmark-shared");

const { HARNESS_VERSION, TASKS, CATEGORY_WEIGHTS } = require("./benchmark-reallife-tasks");

const NEX_CODE = path.join(__dirname, "..", "dist", "nex-code.js");

// ─── Load Ollama cloud config if not set in environment ──────────
// Needed when running from git hooks or non-interactive shells that
// don't source ~/.zshrc where OLLAMA_HOST / OLLAMA_API_KEY are set.
if (!process.env.OLLAMA_HOST) {
  const modelsEnv = path.join(os.homedir(), ".nex-code", "models.env");
  if (fs.existsSync(modelsEnv)) {
    for (const line of fs.readFileSync(modelsEnv, "utf8").split("\n")) {
      if (line.startsWith("#") || !line.includes("=")) continue;
      const eqIdx = line.indexOf("=");
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).split("#")[0].trim();
      if ((key === "OLLAMA_HOST" || key === "OLLAMA_API_KEY") && val) {
        process.env[key] = val;
      }
    }
  }
}
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
        taskVersion: task.taskVersion,
        determinism: task.determinism,
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
    safeEnv.NEX_TASK_TIMEOUT_MS = String(task.timeoutMs || 180000);

    const proc = spawn(process.execPath, args, {
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
        taskVersion: task.taskVersion,
        determinism: task.determinism,
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

function parseJsonEventStream(stdout) {
  const events = [];
  for (const line of String(stdout || "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") events.push(parsed);
    } catch {
      // Ignore non-JSON lines for backward compatibility.
    }
  }
  return events;
}

function extractUsageFromDoneEvent(doneEvent) {
  if (!doneEvent || typeof doneEvent !== "object") {
    return { input: 0, output: 0 };
  }
  const usage = doneEvent.usage || {};
  return {
    input:
      doneEvent.inputTokens ||
      usage.input ||
      usage.input_tokens ||
      usage.prompt_tokens ||
      0,
    output:
      doneEvent.outputTokens ||
      usage.output ||
      usage.output_tokens ||
      usage.completion_tokens ||
      0,
  };
}

function extractBenchmarkMetrics(stdout, stderr) {
  const events = parseJsonEventStream(stdout);
  const toolStartCount = events.filter((event) => event.type === "tool_start").length;
  const doneEvent = [...events].reverse().find((event) => event.type === "done");
  const usage = extractUsageFromDoneEvent(doneEvent);
  const diagnostics = {
    jsonEventCount: events.length,
    toolStartCount,
    hasDoneEvent: Boolean(doneEvent),
    stdoutBytes: Buffer.byteLength(String(stdout || ""), "utf8"),
    stderrBytes: Buffer.byteLength(String(stderr || ""), "utf8"),
  };

  if (toolStartCount > 0 || usage.input > 0 || usage.output > 0) {
    return {
      toolCalls: toolStartCount > 0 ? toolStartCount : Number(doneEvent?.toolCalls) || 0,
      tokens: usage,
      telemetry: {
        valid: Boolean(doneEvent),
        source: "json",
        reason: doneEvent ? null : "missing-done-event",
      },
      harnessDiagnostics: diagnostics,
    };
  }

  let fallbackToolCalls = 0;
  const stderrMarkers = (stderr || "").match(/✓\s+\w+\(/g);
  if (stderrMarkers) fallbackToolCalls = stderrMarkers.length;
  if (fallbackToolCalls === 0) {
    const toolUseMatches = (stdout || "").match(/"type"\s*:\s*"function"|"tool_use"|"tool_call"/g);
    if (toolUseMatches) fallbackToolCalls = toolUseMatches.length;
  }
  if (fallbackToolCalls === 0) {
    const spinnerLines = (stderr || "").match(/^\s*\[.*?\]/gm);
    if (spinnerLines) fallbackToolCalls = spinnerLines.length;
  }

  return {
    toolCalls: fallbackToolCalls,
    tokens: usage,
    telemetry: {
      valid: false,
      source: fallbackToolCalls > 0 ? "legacy-fallback" : "missing",
      reason: events.length > 0 ? "missing-done-event" : "missing-json-events",
    },
    harnessDiagnostics: {
      ...diagnostics,
      usedLegacyFallback: fallbackToolCalls > 0,
    },
  };
}

function evaluateTask(task, tmpDir, stdout, stderr, elapsed, completionReason) {
  const { toolCalls, tokens, telemetry, harnessDiagnostics } = extractBenchmarkMetrics(stdout, stderr);
  const measuredCompletionReason =
    completionReason === "success" && telemetry?.valid === false
      ? "harness-failure"
      : completionReason;

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
  if (measuredCompletionReason === "timeout") {
    score = Math.round(score * 0.7);
  }

  return {
    id: task.id,
    category: task.category,
    taskVersion: task.taskVersion,
    determinism: task.determinism,
    score,
    elapsed,
    completionReason: measuredCompletionReason,
    toolCalls,
    tokens,
    telemetry,
    harnessDiagnostics: {
      ...harnessDiagnostics,
      exitCompletionReason: completionReason,
      measuredCompletionReason,
      elapsed,
    },
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
  const summary = computeBenchmarkScore(results, CATEGORY_WEIGHTS);
  const { finalScore, categoryMetrics, categoryScores, totalTokens } = summary;

  console.log("\n  ══════════════════════════════════════════════════");
  console.log("  Real-Life Benchmark Results");
  console.log("  ══════════════════════════════════════════════════\n");

  // Per-task results
  for (const cat of Object.keys(byCategory).sort((a, b) => a.localeCompare(b))) {
    const tasks = [...byCategory[cat]].sort((a, b) => a.id.localeCompare(b.id));
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
  console.log(`  Avg Tool Calls: ${summary.avgToolCalls}`);
  console.log(`  Timeout Rate: ${summary.timeoutRate}%`);
  console.log(`  Error Rate: ${summary.errorRate}%`);
  console.log(`  Invalid Harness Rate: ${summary.invalidHarnessRate}%`);
  console.log(`  Tokens: ${totalTokens.input} in / ${totalTokens.output} out`);
  console.log("  Category Metrics:");
  for (const cat of Object.keys(categoryMetrics).sort((a, b) => a.localeCompare(b))) {
    const metrics = categoryMetrics[cat];
    console.log(
      `    ${cat}: pass ${metrics.passRate}% | timeout ${metrics.timeoutRate}% | avg tools ${metrics.avgToolCalls}`,
    );
  }
  console.log();

  return summary;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;
  const runIdIdx = args.indexOf("--run-id");
  const runId = process.env.NEX_BENCHMARK_RUN_ID || (runIdIdx !== -1 ? args[runIdIdx + 1] : null) || makeRunId();
  const tasksIdx = args.indexOf("--tasks");
  const taskFilter = tasksIdx !== -1 ? args[tasksIdx + 1].split(",") : null;
  const catIdx = args.indexOf("--category");
  const catFilter = catIdx !== -1 ? args[catIdx + 1] : null;

  let tasks = TASKS;
  if (taskFilter) tasks = tasks.filter((t) => taskFilter.includes(t.id));
  if (catFilter) tasks = tasks.filter((t) => t.category === catFilter);
  tasks = [...tasks].sort((a, b) => a.ordinal - b.ordinal);

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
  const summary = printReport(results, totalElapsed);
  const { finalScore, categoryScores, categoryMetrics, totalTokens } = summary;

  // Save results
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeRunId = runId.replace(/[^a-zA-Z0-9-]/g, "-");
  const outPath = path.join(RESULTS_DIR, `reallife-${timestamp}-${safeRunId}.json`);

  const resultData = {
    date: new Date().toISOString(),
    runId,
    harnessVersion: HARNESS_VERSION,
    model,
    finalScore,
    categoryScores,
    categoryMetrics,
    metrics: {
      avgElapsed: summary.avgElapsed,
      avgToolCalls: summary.avgToolCalls,
      timeoutRate: summary.timeoutRate,
      errorRate: summary.errorRate,
      invalidHarnessRate: summary.invalidHarnessRate,
      statusCounts: summary.statusCounts,
      avgTokens: summary.avgTokens,
      totalToolCalls: summary.totalToolCalls,
    },
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
    runId,
    harnessVersion: HARNESS_VERSION,
    model,
    finalScore,
    categoryScores,
    categoryMetrics,
    taskCount: results.length,
    passing: resultData.passing,
    metrics: resultData.metrics,
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

module.exports = {
  main,
  runTask,
  evaluateTask,
  TASKS,
  parseJsonEventStream,
  extractUsageFromDoneEvent,
  extractBenchmarkMetrics,
};

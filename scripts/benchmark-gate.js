#!/usr/bin/env node
/**
 * scripts/benchmark-gate.js — Pre-push quality & speed gate
 *
 * Runs a fast smoke-test subset (7 tasks, one per category) and compares
 * against the stored baseline. Blocks push if quality drops >5 points
 * or average speed regresses >40%.
 *
 * Usage:
 *   node scripts/benchmark-gate.js [--update-baseline] [--model <id>] [--full]
 *
 * Exit codes:
 *   0 = pass (score and speed within tolerance)
 *   1 = regression detected
 *   2 = no baseline yet (first run saves baseline automatically)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const { runTask } = require("./benchmark-reallife");
const { TASKS, CATEGORY_WEIGHTS } = require("./benchmark-reallife-tasks");

const BASELINE_PATH = path.join(__dirname, "..", ".nex", "benchmark-baseline.json");
const CACHE_DIR = path.join(__dirname, "..", ".nex", "gate-cache");
const NEX_CODE = path.join(__dirname, "..", "dist", "nex-code.js");

// Smoke-test tasks: one fast, reliable task per category
const SMOKE_TASK_IDS = [
  "bugfix-wrong-destructure",       // bugfix    ~69s, score 90
  "feat-add-export-csv",            // feature   ~58s, score 90
  "understand-project-structure",    // understanding ~68s, score 90
  "devops-nginx-reverse-proxy",     // devops    ~33s, score 90
  "refactor-fix-broken-import-paths", // refactor ~70s, score 90
  "test-write-unit-tests",          // testing   ~72s, score 90
  "docs-write-setup-guide",         // docs      ~50s, score 90
];

// Thresholds
const SCORE_DROP_THRESHOLD = 5;     // block if score drops more than 5 points
const SPEED_REGRESSION_FACTOR = 1.4; // block if avg time increases >40%

// ─── Helpers ───────────────────────────────────────────────────

function getCurrentCommit() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function getCachePath(sha) {
  return path.join(CACHE_DIR, `${sha}.json`);
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveBaseline(data) {
  const dir = path.dirname(BASELINE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(data, null, 2));
}

function loadCache(sha) {
  const p = getCachePath(sha);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function saveCache(sha, data) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(getCachePath(sha), JSON.stringify(data, null, 2));
}

function cleanOldCache() {
  if (!fs.existsSync(CACHE_DIR)) return;
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();
  for (const f of fs.readdirSync(CACHE_DIR)) {
    const fp = path.join(CACHE_DIR, f);
    try {
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > maxAge) fs.unlinkSync(fp);
    } catch { /* ignore */ }
  }
}

function computeScore(results) {
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  const categoryScores = {};
  for (const [cat, tasks] of Object.entries(byCategory)) {
    categoryScores[cat] = Math.round(
      tasks.reduce((s, t) => s + t.score, 0) / tasks.length
    );
  }

  let weightedTotal = 0;
  let totalWeight = 0;
  for (const [cat, avg] of Object.entries(categoryScores)) {
    const weight = CATEGORY_WEIGHTS[cat] || 0;
    weightedTotal += avg * weight;
    totalWeight += weight;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0;
  const avgElapsed = Math.round(
    results.reduce((s, r) => s + r.elapsed, 0) / results.length
  );

  return { finalScore, categoryScores, avgElapsed };
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const updateBaseline = args.includes("--update-baseline");
  const fullRun = args.includes("--full");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;

  // Check dist exists
  if (!fs.existsSync(NEX_CODE)) {
    console.error("\n  ERROR: dist/nex-code.js not found. Run: npm run build\n");
    process.exit(1);
  }

  // Check cache for current commit
  const sha = getCurrentCommit();
  if (sha && !updateBaseline) {
    const cached = loadCache(sha);
    if (cached && cached.pass) {
      console.log(`\n  Gate: PASS (cached for ${sha.slice(0, 8)})`);
      console.log(`  Score: ${cached.finalScore}/100, Avg: ${(cached.avgElapsed / 1000).toFixed(1)}s\n`);
      process.exit(0);
    }
  }

  // Select tasks
  const taskIds = fullRun ? TASKS.map(t => t.id) : SMOKE_TASK_IDS;
  const tasks = TASKS.filter(t => taskIds.includes(t.id));

  if (tasks.length === 0) {
    console.error("\n  ERROR: No matching smoke-test tasks found\n");
    process.exit(1);
  }

  console.log(`\n  Benchmark Gate: ${tasks.length} tasks${model ? ` (model: ${model})` : ""}`);
  console.log(`  Mode: ${fullRun ? "FULL (all tasks)" : "SMOKE (one per category)"}\n`);

  // Run tasks
  const startTime = Date.now();
  const results = [];

  for (const task of tasks) {
    process.stdout.write(`  Running ${task.id}... `);
    const result = await runTask(task, model);
    results.push(result);
    const status = result.score >= 80 ? "\x1b[32m\u2713\x1b[0m" : result.score >= 50 ? "\x1b[33m~\x1b[0m" : "\x1b[31m\u2717\x1b[0m";
    console.log(`${status} ${result.score}/100 (${(result.elapsed / 1000).toFixed(1)}s)`);
  }

  const totalElapsed = Date.now() - startTime;
  const current = computeScore(results);

  // Load baseline
  const baseline = loadBaseline();

  // Print summary
  console.log("\n  \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log(`  Score:    ${current.finalScore}/100${baseline ? ` (baseline: ${baseline.finalScore}/100)` : ""}`);
  console.log(`  Avg Time: ${(current.avgElapsed / 1000).toFixed(1)}s${baseline ? ` (baseline: ${(baseline.avgElapsed / 1000).toFixed(1)}s)` : ""}`);
  console.log(`  Total:    ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(`  Passing:  ${results.filter(r => r.score >= 80).length}/${results.length}`);

  // Per-category comparison
  if (baseline) {
    console.log("\n  Per-category:");
    for (const [cat, score] of Object.entries(current.categoryScores)) {
      const bScore = baseline.categoryScores[cat];
      const delta = bScore != null ? score - bScore : null;
      const indicator = delta == null ? "" : delta >= 0 ? ` \x1b[32m(+${delta})\x1b[0m` : ` \x1b[31m(${delta})\x1b[0m`;
      console.log(`    ${cat.padEnd(15)} ${score}/100${indicator}`);
    }
  }

  // Decision
  let pass = true;
  const reasons = [];

  if (baseline && !updateBaseline) {
    const scoreDrop = baseline.finalScore - current.finalScore;
    if (scoreDrop > SCORE_DROP_THRESHOLD) {
      pass = false;
      reasons.push(`Score dropped ${scoreDrop} points (${baseline.finalScore} -> ${current.finalScore}, threshold: ${SCORE_DROP_THRESHOLD})`);
    }

    const speedRatio = current.avgElapsed / baseline.avgElapsed;
    if (speedRatio > SPEED_REGRESSION_FACTOR) {
      pass = false;
      const pct = Math.round((speedRatio - 1) * 100);
      reasons.push(`Speed regressed ${pct}% (avg ${(current.avgElapsed / 1000).toFixed(1)}s vs baseline ${(baseline.avgElapsed / 1000).toFixed(1)}s, threshold: ${Math.round((SPEED_REGRESSION_FACTOR - 1) * 100)}%)`);
    }

    // Per-category: flag any category that dropped >10 points
    for (const [cat, score] of Object.entries(current.categoryScores)) {
      const bScore = baseline.categoryScores[cat];
      if (bScore != null && bScore - score > 10) {
        pass = false;
        reasons.push(`Category "${cat}" dropped ${bScore - score} points (${bScore} -> ${score})`);
      }
    }
  }

  // Helper: cache this commit as passing
  function cachePass() {
    if (sha) {
      saveCache(sha, {
        date: new Date().toISOString(),
        pass: true,
        finalScore: current.finalScore,
        avgElapsed: current.avgElapsed,
      });
      cleanOldCache();
    }
  }

  // No baseline yet — save one automatically
  if (!baseline) {
    saveBaseline({
      date: new Date().toISOString(),
      sha,
      finalScore: current.finalScore,
      categoryScores: current.categoryScores,
      avgElapsed: current.avgElapsed,
      perTask: results.map(r => ({ id: r.id, score: r.score, elapsed: r.elapsed })),
    });
    cachePass();
    console.log("\n  \x1b[33mNo baseline found — saved current run as baseline.\x1b[0m");
    console.log(`  Baseline: ${BASELINE_PATH}\n`);
    process.exit(0);
  }

  if (updateBaseline) {
    saveBaseline({
      date: new Date().toISOString(),
      sha,
      finalScore: current.finalScore,
      categoryScores: current.categoryScores,
      avgElapsed: current.avgElapsed,
      perTask: results.map(r => ({ id: r.id, score: r.score, elapsed: r.elapsed })),
    });
    cachePass();
    console.log("\n  \x1b[32mBaseline updated.\x1b[0m\n");
    process.exit(0);
  }

  if (pass) {
    console.log("\n  \x1b[32m\u2714 Gate: PASS — no quality or speed regression detected.\x1b[0m\n");
    cachePass();
    process.exit(0);
  } else {
    console.log("\n  \x1b[31m\u2718 Gate: FAIL — regression detected:\x1b[0m");
    for (const r of reasons) {
      console.log(`    \x1b[31m\u2022 ${r}\x1b[0m`);
    }
    console.log("\n  To investigate, review failing tasks above.");
    console.log("  To update baseline after intentional changes: npm run benchmark:gate -- --update-baseline");
    console.log("  To bypass: NEX_SKIP_BENCHMARK=1 git push\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Gate failed:", err);
  process.exit(1);
});

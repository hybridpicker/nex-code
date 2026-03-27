#!/usr/bin/env node
/**
 * scripts/improve.js — Proactive Improvement Loop
 *
 * Runs benchmark-realworld.js → clusters failures → implements ONE fix →
 * rebuilds → re-benchmarks → commits if improved, reverts if regressed.
 * Stops after 3 consecutive plateaus, score >= 95, or 8 max passes.
 *
 * Usage:
 *   npm run improve [-- --dry-run] [-- --model <id>] [-- --max-passes <n>]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const RESULTS_DIR = path.join(__dirname, "benchmark-results");
const STATE_FILE = path.join(RESULTS_DIR, "improve-state.json");
const NEX_CODE = path.join(ROOT, "dist", "nex-code.js");

// ─── Safety Bounds ──────────────────────────────────────────────
// Guard constants must stay within these ranges after any fix.
const SAFETY_BOUNDS = {
  SSH_STORM_WARN: [6, 12],
  SSH_STORM_ABORT: [8, 18],
  INVESTIGATION_CAP: [10, 18],
  POST_WIPE_BUDGET: [10, 17],
};

const MAX_PASSES_DEFAULT = 8;
const MAX_PLATEAUS = 3;
const SCORE_TARGET = 95;

// ─── Helpers ────────────────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { pass: 0, scores: [], plateaus: 0 };
  }
}

function writeState(state) {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function runBenchmark(model) {
  const args = ["scripts/benchmark-realworld.js"];
  if (model) args.push("--model", model);
  const result = spawnSync("node", args, {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 600000, // 10 min max
    env: { ...process.env },
  });
  const stdout = (result.stdout || "").toString();
  const stderr = (result.stderr || "").toString();

  // Parse the latest results file
  const date = new Date().toISOString().split("T")[0];
  const resultsFile = path.join(RESULTS_DIR, `${date}.json`);
  if (!fs.existsSync(resultsFile)) {
    console.error("  Benchmark did not produce results file");
    console.error("  stdout:", stdout.slice(-500));
    console.error("  stderr:", stderr.slice(-500));
    return null;
  }
  return JSON.parse(fs.readFileSync(resultsFile, "utf-8"));
}

function clusterFailures(results) {
  const clusters = {
    "excessive-reads": [],
    "wrong-tool": [],
    "task-incomplete": [],
    "low-efficiency": [],
  };

  for (const r of results.results || []) {
    if (r.score >= 80) continue; // passing

    const d = r.details || {};
    if (d.efficiency < 50) {
      clusters["low-efficiency"].push(r);
    }
    if (d.taskCompletion < 70) {
      clusters["task-incomplete"].push(r);
    }
    if (d.editsMissing && d.editsMissing.length > 0) {
      clusters["wrong-tool"].push(r);
    }
    if (d.toolCalls > 15) {
      clusters["excessive-reads"].push(r);
    }
  }

  // Sort by cluster size, return top-1
  const sorted = Object.entries(clusters)
    .filter(([, v]) => v.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return sorted.length > 0 ? { pattern: sorted[0][0], tasks: sorted[0][1] } : null;
}

function buildFixPrompt(cluster) {
  const taskList = cluster.tasks
    .slice(0, 5)
    .map((t) => `  - ${t.id} (score: ${t.score}): ${JSON.stringify(t.details)}`)
    .join("\n");

  return `You are improving nex-code (an agentic coding CLI).

The real-world benchmark shows a failure pattern: "${cluster.pattern}"

Failing tasks:
${taskList}

Implement exactly ONE fix in the cli/ directory that addresses this pattern generically.
Do NOT add project-specific patches. Do NOT add text-only prompt changes.
The fix must be in code logic (guard thresholds, tool routing, etc).

After your fix, the following safety bounds must hold in cli/agent.js:
${Object.entries(SAFETY_BOUNDS).map(([k, [lo, hi]]) => `  ${k}: [${lo}, ${hi}]`).join("\n")}

Make the minimal change needed. Read the relevant file first, then edit.`;
}

function checkSafetyBounds() {
  const agentPath = path.join(ROOT, "cli", "agent.js");
  const content = fs.readFileSync(agentPath, "utf-8");

  // Also check model-profiles.js since investigationCap lives there now
  let profileContent = "";
  const profilePath = path.join(ROOT, "cli", "model-profiles.js");
  try { profileContent = fs.readFileSync(profilePath, "utf-8"); } catch { /* ignore */ }
  const combined = content + "\n" + profileContent;

  for (const [name, [lo, hi]] of Object.entries(SAFETY_BOUNDS)) {
    // Match multiple patterns: const X = 10, X = 10, X: 10 (object property)
    const patterns = [
      new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(\\d+)`, "g"),
      new RegExp(`${name}\\s*:\\s*(\\d+)`, "g"),
    ];
    for (const re of patterns) {
      let match;
      while ((match = re.exec(combined)) !== null) {
        const val = parseInt(match[1], 10);
        if (val < lo || val > hi) {
          return { ok: false, violation: `${name} = ${val} (bounds: [${lo}, ${hi}])` };
        }
      }
    }
  }
  return { ok: true };
}

function build() {
  try {
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    return true;
  } catch (err) {
    console.error("  Build failed:", err.message);
    return false;
  }
}

function test() {
  try {
    execSync("npm test", { cwd: ROOT, stdio: "pipe", timeout: 300000 });
    return true;
  } catch {
    console.error("  Tests failed");
    return false;
  }
}

function revert() {
  try {
    execSync("git checkout -- cli/", { cwd: ROOT, stdio: "pipe" });
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    console.log("  Reverted cli/ changes");
  } catch (err) {
    console.error("  Revert failed:", err.message);
  }
}

function commit(pattern, oldScore, newScore) {
  try {
    execSync("git add cli/", { cwd: ROOT, stdio: "pipe" });
    const msg = `improve: address ${pattern} pattern (${oldScore} → ${newScore})`;
    execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: "pipe" });
    console.log(`  Committed: ${msg}`);
    return true;
  } catch (err) {
    console.error("  Commit failed:", err.message);
    return false;
  }
}

function runClaudeCodeFix(prompt) {
  // Use nex-code itself in headless mode to implement the fix
  const result = spawnSync("node", [
    NEX_CODE,
    "--task", prompt,
    "--auto",
    "--max-turns", "30",
  ], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 300000, // 5 min
    env: { ...process.env, NEX_AUTO_ORCHESTRATE: "false" },
  });

  const stderr = (result.stderr || "").toString();
  if (result.status !== 0) {
    console.error("  Fix attempt failed (exit code:", result.status, ")");
    if (stderr) console.error("  stderr:", stderr.slice(-300));
    return { ok: false, reason: "exit-code" };
  }

  // Validate: check git diff to verify actual code changes were made
  try {
    const diff = execSync("git diff cli/", { cwd: ROOT, encoding: "utf-8" });
    if (!diff || !diff.includes("@@")) {
      return { ok: false, reason: "no-changes" };
    }
    // Count added/removed lines (exclude comments-only changes)
    const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
    const removedLines = (diff.match(/^-[^-]/gm) || []).length;
    const totalChanged = addedLines + removedLines;

    if (totalChanged === 0) return { ok: false, reason: "no-changes" };
    if (totalChanged > 200) return { ok: false, reason: "too-large" };

    console.log(`  Fix applied: +${addedLines}/-${removedLines} lines`);
    return { ok: true, linesChanged: totalChanged };
  } catch {
    return { ok: false, reason: "diff-failed" };
  }
}

// ─── Main Loop ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;
  const maxPassesIdx = args.indexOf("--max-passes");
  const maxPasses = maxPassesIdx !== -1 ? parseInt(args[maxPassesIdx + 1], 10) : MAX_PASSES_DEFAULT;

  console.log("\n  nex-code Improvement Loop");
  console.log(`  max-passes: ${maxPasses}, target: ${SCORE_TARGET}, model: ${model || "default"}\n`);

  if (dryRun) {
    console.log("  --dry-run: running benchmark once without fixes\n");
    const results = runBenchmark(model);
    if (results) {
      console.log(`\n  Benchmark average: ${results.average}/100`);
      const cluster = clusterFailures(results);
      if (cluster) {
        console.log(`  Top failure pattern: ${cluster.pattern} (${cluster.tasks.length} tasks)`);
        console.log(`\n  Fix prompt would be:\n${buildFixPrompt(cluster)}\n`);
      } else {
        console.log("  No failure clusters found — all tasks passing!\n");
      }
    }
    return;
  }

  // Check prerequisites
  if (!fs.existsSync(NEX_CODE)) {
    console.error("  ERROR: dist/nex-code.js not found. Run: npm run build\n");
    process.exit(1);
  }

  const state = readState();

  for (let pass = state.pass; pass < maxPasses; pass++) {
    console.log(`\n  ── Pass ${pass + 1}/${maxPasses} ──`);

    // 1. Run benchmark
    console.log("  Running benchmark...");
    const results = runBenchmark(model);
    if (!results) {
      console.error("  Benchmark failed, stopping");
      break;
    }
    const score = results.average;
    console.log(`  Score: ${score}/100`);

    // Check stop conditions
    if (score >= SCORE_TARGET) {
      console.log(`  Target reached (${SCORE_TARGET})! Stopping.`);
      state.scores.push(score);
      state.pass = pass + 1;
      writeState(state);
      break;
    }

    // 2. Cluster failures
    const cluster = clusterFailures(results);
    if (!cluster) {
      console.log("  No failure clusters — all tasks adequate. Stopping.");
      break;
    }
    console.log(`  Top pattern: ${cluster.pattern} (${cluster.tasks.length} tasks)`);

    // 3. Implement fix
    console.log("  Running fix...");
    const fixPrompt = buildFixPrompt(cluster);
    const fixResult = runClaudeCodeFix(fixPrompt);
    if (!fixResult.ok) {
      console.log(`  Fix failed: ${fixResult.reason} — reverting`);
      revert();
      state.plateaus++;
      if (state.plateaus >= MAX_PLATEAUS) {
        console.log(`  ${MAX_PLATEAUS} plateaus reached, stopping`);
        break;
      }
      continue;
    }

    // 4. Safety check
    const safety = checkSafetyBounds();
    if (!safety.ok) {
      console.log(`  Safety violation: ${safety.violation} — reverting`);
      revert();
      state.plateaus++;
      continue;
    }

    // 5. Build + test
    console.log("  Building...");
    if (!build()) { revert(); state.plateaus++; continue; }
    console.log("  Testing...");
    if (!test()) { revert(); state.plateaus++; continue; }

    // 6. Re-benchmark
    console.log("  Re-benchmarking...");
    const newResults = runBenchmark(model);
    if (!newResults) { revert(); state.plateaus++; continue; }
    const newScore = newResults.average;
    console.log(`  New score: ${newScore}/100 (was ${score})`);

    if (newScore > score) {
      // Improved — commit
      commit(cluster.pattern, score, newScore);
      state.plateaus = 0;
    } else {
      // Regressed or no change — revert
      console.log("  No improvement, reverting");
      revert();
      state.plateaus++;
    }

    state.scores.push(newScore > score ? newScore : score);
    state.pass = pass + 1;
    writeState(state);

    if (state.plateaus >= MAX_PLATEAUS) {
      console.log(`\n  ${MAX_PLATEAUS} consecutive plateaus — stopping`);
      break;
    }
  }

  console.log("\n  Improvement loop complete.");
  console.log(`  Passes: ${state.pass}, Scores: [${state.scores.join(", ")}]\n`);
}

main().catch((err) => {
  console.error("Improvement loop failed:", err);
  process.exit(1);
});

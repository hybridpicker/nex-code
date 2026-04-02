#!/usr/bin/env node
/**
 * scripts/improve-reallife.js — Autoresearch-Style Improvement Loop
 *
 * Runs the real-life benchmark, clusters failures, implements ONE targeted fix,
 * re-benchmarks, keeps if improved or reverts. Inspired by Karpathy's autoresearch.
 *
 * Usage:
 *   node scripts/improve-reallife.js [--dry-run] [--model <id>] [--max-passes <n>] [--budget <tokens>]
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const RESULTS_DIR = path.join(__dirname, "benchmark-results");
const STATE_FILE = path.join(RESULTS_DIR, "improve-reallife-state.json");
const EXPERIMENTS_FILE = path.join(ROOT, ".nex", "autoresearch", "reallife-experiments.json");
const NEX_CODE = path.join(ROOT, "dist", "nex-code.js");

// ─── Configuration ──────────────────────────────────────────────

const MAX_PASSES_DEFAULT = 12;
const MAX_PLATEAUS = 3;
const SCORE_TARGET = 90;
const DEFAULT_TOKEN_BUDGET = 500000;

// Guard constants must stay within these ranges after any fix.
const SAFETY_BOUNDS = {
  SSH_STORM_WARN: [6, 12],
  SSH_STORM_ABORT: [8, 18],
  INVESTIGATION_CAP: [10, 18],
  POST_WIPE_BUDGET: [10, 17],
};

// ─── State Management ───────────────────────────────────────────

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { pass: 0, scores: [], plateaus: 0, tokensSpent: 0, experiments: [] };
  }
}

function writeState(state) {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function logExperiment(experiment) {
  const dir = path.dirname(EXPERIMENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let experiments = [];
  try { experiments = JSON.parse(fs.readFileSync(EXPERIMENTS_FILE, "utf-8")); } catch { /* new */ }
  experiments.push(experiment);
  fs.writeFileSync(EXPERIMENTS_FILE, JSON.stringify(experiments, null, 2));
}

// ─── Benchmark Runner ───────────────────────────────────────────

function runBenchmark(model) {
  console.log("    Running real-life benchmark...");
  const args = ["scripts/benchmark-reallife.js"];
  if (model) args.push("--model", model);

  const result = spawnSync("node", args, {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 1800000, // 30 min max (28 tasks)
    env: { ...process.env },
  });

  const stdout = (result.stdout || "").toString();
  const stderr = (result.stderr || "").toString();

  // Find the latest results file
  if (!fs.existsSync(RESULTS_DIR)) return null;
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith("reallife-") && f.endsWith(".json") && !f.includes("state") && !f.includes("history"))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error("    Benchmark did not produce results file");
    if (stderr) console.error("    stderr:", stderr.slice(-300));
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, files[0]), "utf-8"));
  } catch {
    console.error("    Failed to parse results file");
    return null;
  }
}

// ─── Failure Clustering ─────────────────────────────────────────

function clusterFailures(results) {
  const clusters = {
    "bugfix-incomplete": [],
    "feature-incomplete": [],
    "understanding-incomplete": [],
    "devops-incomplete": [],
    "refactor-incomplete": [],
    "testing-incomplete": [],
    "docs-incomplete": [],
    "low-efficiency": [],
    "low-quality": [],
    "timeout": [],
  };

  for (const r of results.results || []) {
    if (r.score >= 80) continue; // passing

    const d = r.details || {};

    // Category-specific clustering
    if (d.taskCompletion < 70) {
      const key = `${r.category}-incomplete`;
      if (clusters[key]) clusters[key].push(r);
    }

    if (d.efficiency < 50) clusters["low-efficiency"].push(r);
    if (d.quality < 50) clusters["low-quality"].push(r);
    if (r.completionReason === "timeout") clusters["timeout"].push(r);
  }

  // Return the largest cluster
  const sorted = Object.entries(clusters)
    .filter(([, v]) => v.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return sorted.length > 0 ? { pattern: sorted[0][0], tasks: sorted[0][1] } : null;
}

// ─── Fix Prompt Generation ──────────────────────────────────────

const CATEGORY_HINTS = {
  bugfix: "Improve the agent's ability to diagnose bugs: better error message parsing, smarter use of grep/read_file to find root causes, or improved edit_file argument generation.",
  feature: "Improve the agent's ability to implement features: better understanding of existing code structure before writing, or improved multi-file coordination.",
  understanding: "Improve the agent's ability to analyze codebases: more thorough file scanning, better synthesis of findings into structured output.",
  devops: "Improve the agent's ability to generate infrastructure files: better templates for nginx, systemd, Dockerfiles, or deploy scripts.",
  refactor: "Improve the agent's ability to refactor across files: better tracking of references, smarter rename propagation, or improved import path resolution.",
  testing: "Improve the agent's ability to write tests: better detection of test frameworks, edge case generation, or test file structure.",
  docs: "Improve the agent's ability to generate documentation: better code analysis for docs, structured output formatting.",
};

function buildFixPrompt(cluster, benchmarkScore) {
  const category = cluster.tasks[0]?.category || "unknown";
  const hint = CATEGORY_HINTS[category] || "Improve the agent's general task completion.";

  const taskList = cluster.tasks
    .slice(0, 5)
    .map((t) => `  - ${t.id} (score: ${t.score}/100, completion: ${t.details?.taskCompletion || 0}%, efficiency: ${t.details?.efficiency || 0}%)`)
    .join("\n");

  return `You are improving nex-code (an agentic coding CLI). Current real-life benchmark score: ${benchmarkScore}/100.

The benchmark shows a failure cluster: "${cluster.pattern}" (${cluster.tasks.length} tasks failing)

Failing tasks:
${taskList}

${hint}

Implement exactly ONE targeted fix in the cli/ directory. Focus on:
1. System prompt improvements that help the model approach this task type better
2. Tool selection logic or argument generation improvements
3. Loop detection or context management adjustments

Do NOT:
- Add project-specific patches or hardcoded task solutions
- Make changes larger than 200 lines
- Change test files or benchmark files

After your fix, these safety bounds must hold in cli/agent.js:
${Object.entries(SAFETY_BOUNDS).map(([k, [lo, hi]]) => `  ${k}: [${lo}, ${hi}]`).join("\n")}

Read the relevant file(s) first, then make the minimal change needed.`;
}

// ─── Safety & Validation ────────────────────────────────────────

function checkSafetyBounds() {
  const agentPath = path.join(ROOT, "cli", "agent.js");
  const content = fs.readFileSync(agentPath, "utf-8");

  let profileContent = "";
  try { profileContent = fs.readFileSync(path.join(ROOT, "cli", "model-profiles.js"), "utf-8"); } catch { /* ignore */ }
  const combined = content + "\n" + profileContent;

  for (const [name, [lo, hi]] of Object.entries(SAFETY_BOUNDS)) {
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
    console.error("    Build failed:", err.message);
    return false;
  }
}

function test() {
  try {
    execSync("npm test", { cwd: ROOT, stdio: "pipe", timeout: 300000 });
    return true;
  } catch {
    console.error("    Tests failed");
    return false;
  }
}

function revert() {
  try {
    execSync("git checkout -- cli/", { cwd: ROOT, stdio: "pipe" });
    execSync("npm run build", { cwd: ROOT, stdio: "pipe" });
    console.log("    Reverted cli/ changes");
  } catch (err) {
    console.error("    Revert failed:", err.message);
  }
}

function commit(pattern, oldScore, newScore) {
  try {
    // Sanitize pattern to prevent shell injection
    const safePattern = pattern.replace(/[^a-zA-Z0-9_-]/g, "_");
    spawnSync("git", ["add", "cli/"], { cwd: ROOT, stdio: "pipe" });
    const msg = `improve(reallife): address ${safePattern} (${oldScore} -> ${newScore})`;
    const result = spawnSync("git", ["commit", "-m", msg], { cwd: ROOT, stdio: "pipe" });
    if (result.status !== 0) throw new Error("git commit failed");
    console.log(`    Committed: ${msg}`);
    return true;
  } catch (err) {
    console.error("    Commit failed:", err.message);
    return false;
  }
}

function runHeadlessFix(prompt) {
  const result = spawnSync("node", [
    NEX_CODE,
    "--task", prompt,
    "--auto",
    "--max-turns", "30",
  ], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 300000,
    env: { ...process.env, NEX_AUTO_ORCHESTRATE: "false" },
  });

  const stderr = (result.stderr || "").toString();
  if (result.status !== 0) {
    console.error("    Fix attempt failed (exit code:", result.status, ")");
    if (stderr) console.error("    stderr:", stderr.slice(-300));
    return { ok: false, reason: "exit-code" };
  }

  try {
    const diff = execSync("git diff cli/", { cwd: ROOT, encoding: "utf-8" });
    if (!diff || !diff.includes("@@")) return { ok: false, reason: "no-changes" };

    const addedLines = (diff.match(/^\+[^+]/gm) || []).length;
    const removedLines = (diff.match(/^-[^-]/gm) || []).length;
    const totalChanged = addedLines + removedLines;

    if (totalChanged === 0) return { ok: false, reason: "no-changes" };
    if (totalChanged > 200) return { ok: false, reason: "too-large" };

    console.log(`    Fix applied: +${addedLines}/-${removedLines} lines`);
    return { ok: true, linesChanged: totalChanged };
  } catch {
    return { ok: false, reason: "diff-failed" };
  }
}

// ─── Branch Management ──────────────────────────────────────────

function setupBranch() {
  const date = new Date().toISOString().split("T")[0];
  const branchName = `autoresearch/reallife-${date}`;

  try {
    // Check if we're already on this branch
    const current = execSync("git branch --show-current", { cwd: ROOT, encoding: "utf-8" }).trim();
    if (current === branchName) return branchName;

    // Check if branch exists (use array form to prevent injection)
    try {
      spawnSync("git", ["rev-parse", "--verify", branchName], { cwd: ROOT, stdio: "pipe" });
      spawnSync("git", ["checkout", branchName], { cwd: ROOT, stdio: "pipe" });
    } catch {
      spawnSync("git", ["checkout", "-b", branchName], { cwd: ROOT, stdio: "pipe" });
    }
    return branchName;
  } catch (err) {
    console.error("  Failed to setup branch:", err.message);
    return null;
  }
}

// ─── Summary Report ─────────────────────────────────────────────

function generateReport(state, startBranch) {
  const report = [];
  report.push("# Real-Life Improvement Report");
  report.push(`\nDate: ${new Date().toISOString()}`);
  report.push(`Branch: ${startBranch || "unknown"}`);
  report.push(`Passes: ${state.pass}`);
  report.push(`Tokens spent: ${state.tokensSpent.toLocaleString()}`);
  report.push("");

  if (state.scores.length > 0) {
    report.push("## Score Progression");
    report.push("```");
    for (let i = 0; i < state.scores.length; i++) {
      const bar = "█".repeat(Math.round(state.scores[i] / 2));
      report.push(`  Pass ${i + 1}: ${state.scores[i]}/100 ${bar}`);
    }
    report.push("```");
    report.push("");
  }

  if (state.experiments && state.experiments.length > 0) {
    report.push("## Experiments");
    for (const exp of state.experiments) {
      const icon = exp.kept ? "✓" : "✗";
      report.push(`- ${icon} **${exp.pattern}**: ${exp.oldScore} → ${exp.newScore} (${exp.reason})`);
    }
  }

  const reportPath = path.join(RESULTS_DIR, `reallife-report-${new Date().toISOString().split("T")[0]}.md`);
  fs.writeFileSync(reportPath, report.join("\n"));
  console.log(`\n  Report saved: ${reportPath}`);
}

// ─── Main Loop ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;
  const maxPassesIdx = args.indexOf("--max-passes");
  const maxPasses = maxPassesIdx !== -1 ? (parseInt(args[maxPassesIdx + 1], 10) || MAX_PASSES_DEFAULT) : MAX_PASSES_DEFAULT;
  const budgetIdx = args.indexOf("--budget");
  const tokenBudget = budgetIdx !== -1 ? (parseInt(args[budgetIdx + 1], 10) || DEFAULT_TOKEN_BUDGET) : DEFAULT_TOKEN_BUDGET;

  console.log("\n  ══════════════════════════════════════════════════");
  console.log("  nex-code Real-Life Improvement Loop");
  console.log("  ══════════════════════════════════════════════════");
  console.log(`  max-passes: ${maxPasses}, target: ${SCORE_TARGET}, budget: ${tokenBudget.toLocaleString()} tokens`);
  console.log(`  model: ${model || "default"}\n`);

  if (dryRun) {
    console.log("  --dry-run: running benchmark once without fixes\n");
    const results = runBenchmark(model);
    if (results) {
      console.log(`\n  Final score: ${results.finalScore}/100`);
      const cluster = clusterFailures(results);
      if (cluster) {
        console.log(`  Top failure pattern: ${cluster.pattern} (${cluster.tasks.length} tasks)`);
        console.log(`\n  Fix prompt would be:\n${buildFixPrompt(cluster, results.finalScore)}\n`);
      } else {
        console.log("  No failure clusters — all tasks passing!\n");
      }
    }
    return;
  }

  // Prerequisites
  if (!fs.existsSync(NEX_CODE)) {
    console.error("  ERROR: dist/nex-code.js not found. Run: npm run build\n");
    process.exit(1);
  }

  // Setup autoresearch branch
  const branch = setupBranch();
  if (!branch) {
    console.error("  ERROR: Could not setup autoresearch branch\n");
    process.exit(1);
  }
  console.log(`  Branch: ${branch}\n`);

  const state = readState();

  for (let pass = state.pass; pass < maxPasses; pass++) {
    console.log(`\n  ── Pass ${pass + 1}/${maxPasses} ──`);

    // Check token budget
    if (state.tokensSpent >= tokenBudget) {
      console.log(`  Token budget exhausted (${state.tokensSpent.toLocaleString()} / ${tokenBudget.toLocaleString()})`);
      break;
    }

    // 1. Run benchmark
    const results = runBenchmark(model);
    if (!results) {
      console.error("    Benchmark failed, stopping");
      break;
    }
    const score = results.finalScore;
    console.log(`    Score: ${score}/100`);

    // Track tokens
    const tokensUsed = (results.totalTokens?.input || 0) + (results.totalTokens?.output || 0);
    state.tokensSpent += tokensUsed;

    // Check score target
    if (score >= SCORE_TARGET) {
      console.log(`    Target reached (${SCORE_TARGET})!`);
      state.scores.push(score);
      state.pass = pass + 1;
      writeState(state);
      break;
    }

    // 2. Cluster failures
    const cluster = clusterFailures(results);
    if (!cluster) {
      console.log("    No failure clusters — all tasks adequate. Stopping.");
      break;
    }
    console.log(`    Top pattern: ${cluster.pattern} (${cluster.tasks.length} tasks)`);

    // 3. Implement fix
    console.log("    Implementing fix...");
    const fixPrompt = buildFixPrompt(cluster, score);
    const fixResult = runHeadlessFix(fixPrompt);

    const experiment = {
      pass: pass + 1,
      date: new Date().toISOString(),
      pattern: cluster.pattern,
      oldScore: score,
      newScore: null,
      kept: false,
      reason: "",
    };

    if (!fixResult.ok) {
      console.log(`    Fix failed: ${fixResult.reason} — skipping`);
      experiment.reason = `fix-failed: ${fixResult.reason}`;
      state.plateaus++;
      logExperiment(experiment);
      state.experiments = state.experiments || [];
      state.experiments.push(experiment);
      if (state.plateaus >= MAX_PLATEAUS) {
        console.log(`    ${MAX_PLATEAUS} plateaus reached, stopping`);
        break;
      }
      continue;
    }

    // 4. Safety check
    const safety = checkSafetyBounds();
    if (!safety.ok) {
      console.log(`    Safety violation: ${safety.violation} — reverting`);
      revert();
      experiment.reason = `safety: ${safety.violation}`;
      state.plateaus++;
      logExperiment(experiment);
      state.experiments = state.experiments || [];
      state.experiments.push(experiment);
      continue;
    }

    // 5. Build + test
    console.log("    Building...");
    if (!build()) {
      revert();
      experiment.reason = "build-failed";
      state.plateaus++;
      logExperiment(experiment);
      state.experiments = state.experiments || [];
      state.experiments.push(experiment);
      continue;
    }

    console.log("    Testing...");
    if (!test()) {
      revert();
      experiment.reason = "tests-failed";
      state.plateaus++;
      logExperiment(experiment);
      state.experiments = state.experiments || [];
      state.experiments.push(experiment);
      continue;
    }

    // 6. Re-benchmark
    console.log("    Re-benchmarking...");
    const newResults = runBenchmark(model);
    if (!newResults) {
      revert();
      experiment.reason = "rebenchmark-failed";
      state.plateaus++;
      logExperiment(experiment);
      state.experiments = state.experiments || [];
      state.experiments.push(experiment);
      continue;
    }

    const newScore = newResults.finalScore;
    state.tokensSpent += (newResults.totalTokens?.input || 0) + (newResults.totalTokens?.output || 0);
    experiment.newScore = newScore;

    console.log(`    New score: ${newScore}/100 (was ${score})`);

    if (newScore > score) {
      commit(cluster.pattern, score, newScore);
      experiment.kept = true;
      experiment.reason = "improved";
      state.plateaus = 0;
    } else {
      console.log("    No improvement, reverting");
      revert();
      experiment.reason = newScore === score ? "no-change" : "regressed";
      state.plateaus++;
    }

    logExperiment(experiment);
    state.experiments = state.experiments || [];
    state.experiments.push(experiment);
    state.scores.push(newScore > score ? newScore : score);
    state.pass = pass + 1;
    writeState(state);

    if (state.plateaus >= MAX_PLATEAUS) {
      console.log(`\n    ${MAX_PLATEAUS} consecutive plateaus — stopping`);
      break;
    }
  }

  generateReport(state, branch);

  console.log("\n  ══════════════════════════════════════════════════");
  console.log("  Improvement loop complete.");
  console.log(`  Passes: ${state.pass}, Scores: [${state.scores.join(", ")}]`);
  console.log(`  Tokens spent: ${state.tokensSpent.toLocaleString()}`);
  console.log("  ══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Improvement loop failed:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * harness-metrics.js — read-only telemetry for:
 *   1. CLI harness adoption across the test suite
 *   2. Improvement loop outcomes from structured state/activity files
 *   3. Benchmark trends, token load, estimated cost, and pass distribution
 *
 * Usage: node scripts/harness-metrics.js
 */

const fs = require("fs");
const path = require("path");
const { PRICING } = require("../cli/costs");

const ROOT = path.resolve(__dirname, "..");
const RESULTS_DIR = path.join(ROOT, "scripts", "benchmark-results");
const DAEMON_LOG = path.join(ROOT, "scripts", "improve-daemon.log");
const LOOP_STATE =
  process.env.NEX_LOOP_STATE ||
  path.join(RESULTS_DIR, "improve-reallife-state.json");
const ACTIVITY_LOG =
  process.env.NEX_ACTIVITY_LOG ||
  (process.env.HOME
    ? path.join(process.env.HOME, ".nex-code", "worker-activity.json")
    : null);

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...collectTestFiles(full));
    else if (name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function toPct(value, total) {
  if (!total) return "  0%";
  return `${Math.round((value / total) * 100)}%`.padStart(4);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatUsd(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  if (value === 0) return "$0.0000";
  return `$${value.toFixed(4)}`;
}

function formatDateShort(iso) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function detectProviderForModel(model) {
  if (!model) return null;
  for (const [provider, models] of Object.entries(PRICING)) {
    if (Object.prototype.hasOwnProperty.call(models, model)) return provider;
  }
  return null;
}

function estimateRunCost(run, modelOverride = null) {
  const model = run?.model || modelOverride || process.env.NEX_HARNESS_MODEL || null;
  const provider = detectProviderForModel(model);
  if (!provider || !model) return null;
  const pricing = PRICING[provider]?.[model];
  if (!pricing) return null;
  const input = run?.totalTokens?.input || 0;
  const output = run?.totalTokens?.output || 0;
  return (input * pricing.input + output * pricing.output) / 1_000_000;
}

function analyzeHarnessAdoption(root = ROOT) {
  const testsDir = path.join(root, "tests");
  const files = collectTestFiles(testsDir);
  const harnessUsers = [];
  const adHocCliUsers = [];

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    const usesHarness =
      /helpers\/cli-harness/.test(src) ||
      /runCli\s*\(/.test(src) ||
      /spawnCli\s*\(/.test(src) ||
      /CliSession/.test(src);
    const touchesCliBinary =
      /bin\/nex-code\.js/.test(src) ||
      /nex-code\.js/.test(src) ||
      /--version/.test(src) ||
      /--help/.test(src);

    if (usesHarness) harnessUsers.push(rel);
    else if (touchesCliBinary) adHocCliUsers.push(rel);
  }

  const cliTouchingFiles = harnessUsers.length + adHocCliUsers.length;
  return {
    totalFiles: files.length,
    harnessUsers,
    adHocCliUsers,
    cliTouchingFiles,
    dormantFiles: files.length - cliTouchingFiles,
    adoptionRate: cliTouchingFiles === 0 ? 0 : harnessUsers.length / cliTouchingFiles,
  };
}

function listDetailedRuns(resultsDir = RESULTS_DIR) {
  if (!fs.existsSync(resultsDir)) return [];
  return fs
    .readdirSync(resultsDir)
    .filter((name) => name.startsWith("reallife-") && name.endsWith(".json"))
    .map((name) => readJson(path.join(resultsDir, name)))
    .filter((run) => run && typeof run.finalScore === "number")
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
}

function normalizeOutcomeLabel(reason) {
  const value = String(reason || "").toLowerCase();
  if (!value) return "unknown";
  if (value.includes("improved")) return "improved";
  if (value.includes("regress")) return "regression";
  if (value.includes("no-new-high") || value.includes("no change") || value.includes("no-change")) {
    return "no-new-high";
  }
  if (value.includes("plateau")) return "plateau";
  if (value.includes("max passes")) return "max passes";
  if (value.includes("target")) return "target score";
  if (value.includes("build-failed")) return "build failed";
  if (value.includes("tests-failed")) return "tests failed";
  if (value.includes("rebenchmark-failed")) return "rebenchmark failed";
  if (value.includes("missing-score")) return "missing score";
  if (value.includes("fix-failed")) return "fix failed";
  if (value.includes("safety:")) return "safety revert";
  return value;
}

function countLabels(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function analyzeLoopState(loopStatePath = LOOP_STATE) {
  const state = readJson(loopStatePath);
  if (!state) return null;

  const experiments = Array.isArray(state.experiments) ? state.experiments : [];
  const outcomeCounts = countLabels(
    experiments.map((exp) => normalizeOutcomeLabel(exp.reason)),
  );

  return {
    pass: state.pass || 0,
    scores: Array.isArray(state.scores) ? state.scores : [],
    tokensSpent: state.tokensSpent || 0,
    experiments,
    outcomeCounts,
    avgTokensPerPass:
      state.pass > 0 && state.tokensSpent > 0 ? state.tokensSpent / state.pass : null,
  };
}

function analyzeActivityLog(activityLogPath = ACTIVITY_LOG) {
  if (!activityLogPath) return null;
  const entries = readJson(activityLogPath);
  if (!Array.isArray(entries)) return null;

  const proactive = entries.filter((entry) => entry && entry.type === "proactive");
  const resultCounts = countLabels(
    proactive.map((entry) =>
      entry.reason ? `${entry.result}:${entry.reason}` : entry.result || "unknown",
    ),
  );

  return {
    proactiveCount: proactive.length,
    resultCounts,
  };
}

function analyzeDaemonLog(logPath = DAEMON_LOG) {
  if (!fs.existsSync(logPath)) return null;
  const lines = fs.readFileSync(logPath, "utf8").split("\n");
  const matching = lines.filter((line) =>
    /Stopping improvement loop|Max passes reached|Score plateau|Target score reached/i.test(line),
  );

  const counts = countLabels(
    matching.map((line) => {
      if (/Target score reached|SCORE_TARGET/i.test(line)) return "target score";
      if (/Max passes reached/i.test(line)) return "max passes";
      if (/plateau/i.test(line)) return "plateau";
      return "other";
    }),
  );

  return { matchingCount: matching.length, counts };
}

function analyzeBenchmarkHistory(root = ROOT, options = {}) {
  const resultsDir = path.join(root, "scripts", "benchmark-results");
  const historyFile = path.join(resultsDir, "reallife-history.jsonl");
  const history = readJsonLines(historyFile).filter(
    (run) => typeof run?.finalScore === "number",
  );
  const detailedRuns = listDetailedRuns(resultsDir);
  const latestRun = detailedRuns[detailedRuns.length - 1] || null;
  const recentRuns = history.slice(-(options.lastRuns || 5));

  const passDistribution = countLabels(
    history.map((run) => `${run.passing || 0}/${run.taskCount || 0}`),
  );

  const latestTasks = Array.isArray(latestRun?.results) ? latestRun.results : [];
  const completionCounts = countLabels(
    latestTasks.map((task) => task.completionReason || "unknown"),
  );
  const expensiveTasks = latestTasks
    .map((task) => ({
      id: task.id,
      category: task.category,
      completionReason: task.completionReason,
      score: task.score,
      inputTokens: task.tokens?.input || 0,
      outputTokens: task.tokens?.output || 0,
      totalTokens: (task.tokens?.input || 0) + (task.tokens?.output || 0),
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 3);

  const scoreDelta =
    recentRuns.length >= 2
      ? recentRuns[recentRuns.length - 1].finalScore - recentRuns[0].finalScore
      : null;
  const timeoutDelta =
    recentRuns.length >= 2
      ? (recentRuns[recentRuns.length - 1].metrics?.timeoutRate || 0) -
        (recentRuns[0].metrics?.timeoutRate || 0)
      : null;
  const avgTokensPerRun =
    recentRuns.length === 0
      ? null
      : recentRuns.reduce(
          (sum, run) => sum + (run.totalTokens?.input || 0) + (run.totalTokens?.output || 0),
          0,
        ) / recentRuns.length;

  const costSamples = recentRuns
    .map((run) => estimateRunCost(run, options.modelOverride || null))
    .filter((value) => typeof value === "number");

  return {
    history,
    recentRuns,
    latestRun,
    passDistribution,
    completionCounts,
    expensiveTasks,
    scoreDelta,
    timeoutDelta,
    avgTokensPerRun,
    avgCostPerRun:
      costSamples.length > 0
        ? costSamples.reduce((sum, value) => sum + value, 0) / costSamples.length
        : null,
  };
}

function printCounts(title, counts) {
  console.log(title);
  if (!counts || counts.size === 0) {
    console.log("  (no data)");
    console.log();
    return;
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  for (const [label, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(24)} ${String(count).padStart(3)} (${toPct(count, total)})`);
  }
  console.log(`  ${"total".padEnd(24)} ${String(total).padStart(3)}`);
  console.log();
}

function reportAdoption(root = ROOT) {
  const stats = analyzeHarnessAdoption(root);
  console.log("CLI harness adoption");
  console.log(`  test files total:           ${stats.totalFiles}`);
  console.log(`  real CLI touch-points:      ${stats.cliTouchingFiles}`);
  console.log(`  using cli-harness helpers:  ${stats.harnessUsers.length}`);
  console.log(`  still ad-hoc:               ${stats.adHocCliUsers.length}`);
  console.log(`  dormant (no CLI at all):    ${stats.dormantFiles}`);
  console.log(`  adoption inside pool:       ${Math.round(stats.adoptionRate * 100)}%`);
  if (stats.adHocCliUsers.length > 0) {
    console.log("  migration pool:");
    for (const file of stats.adHocCliUsers) console.log(`    - ${file}`);
  }
  console.log();
}

function reportImproveLoop() {
  const loopState = analyzeLoopState();
  if (loopState) {
    console.log("Improve loop outcomes");
    console.log(`  passes:                     ${loopState.pass}`);
    console.log(`  scores:                     [${loopState.scores.join(", ")}]`);
    console.log(`  tokens spent:               ${formatNumber(loopState.tokensSpent)}`);
    if (loopState.avgTokensPerPass != null) {
      console.log(`  avg tokens / pass:          ${formatNumber(Math.round(loopState.avgTokensPerPass))}`);
    }
    console.log();
    printCounts("Structured experiment outcomes", loopState.outcomeCounts);
  }

  const activity = analyzeActivityLog();
  if (activity) {
    printCounts("Daemon activity outcomes", activity.resultCounts);
    return;
  }

  const logSummary = analyzeDaemonLog();
  if (logSummary) {
    printCounts("Daemon log fallback", logSummary.counts);
  } else if (!loopState) {
    console.log("Improve loop outcomes");
    console.log("  (no loop state, activity log, or daemon log found)");
    console.log();
  }
}

function reportBenchmarkHistory(root = ROOT) {
  const summary = analyzeBenchmarkHistory(root);

  console.log("Benchmark trend");
  if (summary.history.length === 0) {
    console.log("  (no benchmark history found)");
    console.log();
    return;
  }

  console.log(`  history runs:               ${summary.history.length}`);
  console.log(`  recent window:              ${summary.recentRuns.length}`);
  if (summary.scoreDelta != null) {
    console.log(`  score delta:                ${summary.scoreDelta >= 0 ? "+" : ""}${summary.scoreDelta}`);
  }
  if (summary.timeoutDelta != null) {
    console.log(`  timeout delta:              ${summary.timeoutDelta >= 0 ? "+" : ""}${summary.timeoutDelta} pts`);
  }
  if (summary.avgTokensPerRun != null) {
    console.log(`  avg tokens / run:           ${formatNumber(Math.round(summary.avgTokensPerRun))}`);
  }
  console.log(`  avg cost / run:             ${formatUsd(summary.avgCostPerRun)}`);
  console.log();

  console.log("Recent runs");
  for (const run of summary.recentRuns) {
    const tokens = (run.totalTokens?.input || 0) + (run.totalTokens?.output || 0);
    const passes = `${run.passing || 0}/${run.taskCount || 0}`;
    console.log(
      `  ${formatDateShort(run.date)}  score ${String(run.finalScore).padStart(3)}  pass ${passes.padEnd(5)}  timeout ${String(run.metrics?.timeoutRate || 0).padStart(3)}%  tokens ${formatNumber(tokens)}`,
    );
  }
  console.log();

  printCounts("Pass-count distribution", summary.passDistribution);

  if (summary.latestRun) {
    printCounts("Latest run completion reasons", summary.completionCounts);

    console.log("Latest run top token burners");
    if (summary.expensiveTasks.length === 0) {
      console.log("  (no task-level data)");
    } else {
      for (const task of summary.expensiveTasks) {
        console.log(
          `  ${task.id}  ${formatNumber(task.totalTokens)} tokens  score ${task.score}  ${task.completionReason}`,
        );
      }
    }
    console.log();
  }
}

function main() {
  reportAdoption();
  reportImproveLoop();
  reportBenchmarkHistory();
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeActivityLog,
  analyzeBenchmarkHistory,
  analyzeDaemonLog,
  analyzeHarnessAdoption,
  analyzeLoopState,
  collectTestFiles,
  estimateRunCost,
  normalizeOutcomeLabel,
};

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const BENCHMARK_SCRIPT = "scripts/benchmark-reallife.js";
const REALLIFE_RESULTS_PREFIX = "reallife-";
const BASELINE_FILENAME_PREFIX = "benchmark-baseline";
const DEFAULT_HARNESS_VERSION = "2026-04-13.1";
const SAFETY_BOUNDS = {
  SSH_STORM_WARN: [6, 12],
  SSH_STORM_ABORT: [8, 18],
  INVESTIGATION_CAP: [10, 18],
  POST_WIPE_BUDGET: [10, 17],
};

function getResultsDir(root) {
  return path.join(root, "scripts", "benchmark-results");
}

function listBenchmarkResultFiles(resultsDir) {
  if (!fs.existsSync(resultsDir)) return [];
  return fs.readdirSync(resultsDir)
    .filter((file) =>
      file.startsWith(REALLIFE_RESULTS_PREFIX) &&
      file.endsWith(".json") &&
      !file.includes("state") &&
      !file.includes("history") &&
      !file.includes("report"))
    .sort()
    .reverse();
}

function makeRunId(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const nonce = crypto.randomBytes(3).toString("hex");
  return `${stamp}-${process.pid}-${nonce}`;
}

function sanitizeKeyPart(value, fallback = "default") {
  const input = typeof value === "string" ? value : "";
  const sanitized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return sanitized || fallback;
}

function getHarnessVersion(results) {
  return results?.harnessVersion || DEFAULT_HARNESS_VERSION;
}

function buildBaselineKey({ harnessVersion = DEFAULT_HARNESS_VERSION, routingSignature } = {}) {
  return [
    `hv-${sanitizeKeyPart(harnessVersion, "unknown")}`,
    `routing-${sanitizeKeyPart(routingSignature || "unrouted", "unrouted")}`,
  ].join("__");
}

function getBaselinePath({ homeDir, harnessVersion = DEFAULT_HARNESS_VERSION, routingSignature } = {}) {
  const dir = path.join(homeDir, ".nex-code");
  return path.join(dir, `${BASELINE_FILENAME_PREFIX}-${buildBaselineKey({ harnessVersion, routingSignature })}.json`);
}

function loadBenchmarkResult(resultsDir, { runId, startedAt } = {}) {
  const files = listBenchmarkResultFiles(resultsDir);
  if (files.length === 0) return null;

  const parsed = files
    .map((file) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(resultsDir, file), "utf-8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (runId) {
    const exact = parsed.find((entry) => entry.runId === runId);
    if (exact) return exact;
  }

  if (startedAt) {
    const startedAtMs = Number(startedAt);
    const recent = parsed.find((entry) => {
      const dateMs = Date.parse(entry.date || "");
      return Number.isFinite(dateMs) && dateMs >= startedAtMs - 5000;
    });
    if (recent) return recent;
  }

  return parsed[0] || null;
}

function runBenchmarkScript({
  root,
  model,
  timeoutMs = 600000,
  env = process.env,
} = {}) {
  const runId = makeRunId();
  const startedAt = Date.now();
  const args = [BENCHMARK_SCRIPT];
  if (model) args.push("--model", model);

  const result = spawnSync("node", args, {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: timeoutMs,
    env: {
      ...env,
      NEX_BENCHMARK_RUN_ID: runId,
      NEX_BENCHMARK_STARTED_AT: String(startedAt),
    },
  });

  const stdout = (result.stdout || "").toString();
  const stderr = (result.stderr || "").toString();
  const data = loadBenchmarkResult(getResultsDir(root), { runId, startedAt });

  return {
    data,
    result,
    runId,
    startedAt,
    stderr,
    stdout,
  };
}

function getBenchmarkScore(results) {
  if (typeof results?.finalScore === "number") return results.finalScore;
  if (typeof results?.average === "number") return results.average;
  return null;
}

function computeBenchmarkScore(results, categoryWeights) {
  const valid = results.filter((entry) =>
    entry.completionReason !== "setup-error" &&
    entry.completionReason !== "harness-failure" &&
    entry.completionReason !== "invalid-harness" &&
    entry.telemetry?.valid !== false,
  );

  const byCategory = {};
  for (const result of valid) {
    if (!byCategory[result.category]) byCategory[result.category] = [];
    byCategory[result.category].push(result);
  }

  const categoryScores = {};
  const categoryMetrics = {};
  for (const [category, tasks] of Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b))) {
    categoryScores[category] = Math.round(
      tasks.reduce((sum, task) => sum + task.score, 0) / tasks.length,
    );
    categoryMetrics[category] = {
      avgScore: categoryScores[category],
      passRate: Math.round((tasks.filter((task) => task.score >= 80).length / tasks.length) * 100),
      timeoutRate: Math.round((tasks.filter((task) => task.completionReason === "timeout").length / tasks.length) * 100),
      avgToolCalls: Math.round(tasks.reduce((sum, task) => sum + (task.toolCalls || 0), 0) / tasks.length),
    };
  }

  let weightedTotal = 0;
  let totalWeight = 0;
  for (const [category, avg] of Object.entries(categoryScores)) {
    const weight = categoryWeights[category] || 0;
    weightedTotal += avg * weight;
    totalWeight += weight;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedTotal / totalWeight) : 0;
  const avgElapsed = valid.length > 0
    ? Math.round(valid.reduce((sum, result) => sum + result.elapsed, 0) / valid.length)
    : 0;
  const totalToolCalls = valid.reduce((sum, result) => sum + (result.toolCalls || 0), 0);
  const totalTokens = valid.reduce((sum, result) => ({
    input: sum.input + (result.tokens?.input || 0),
    output: sum.output + (result.tokens?.output || 0),
  }), { input: 0, output: 0 });
  const statusCounts = results.reduce((counts, result) => {
    counts[result.completionReason] = (counts[result.completionReason] || 0) + 1;
    return counts;
  }, {});
  const timeoutCount = statusCounts.timeout || 0;
  const errorCount =
    (statusCounts.error || 0) +
    (statusCounts["setup-error"] || 0) +
    (statusCounts["harness-failure"] || 0) +
    (statusCounts["invalid-harness"] || 0);
  const invalidCount =
    (statusCounts["harness-failure"] || 0) +
    (statusCounts["invalid-harness"] || 0);

  return {
    finalScore,
    categoryScores,
    categoryMetrics,
    avgElapsed,
    totalToolCalls,
    avgToolCalls: valid.length > 0 ? Math.round(totalToolCalls / valid.length) : 0,
    totalTokens,
    avgTokens: valid.length > 0
      ? {
        input: Math.round(totalTokens.input / valid.length),
        output: Math.round(totalTokens.output / valid.length),
      }
      : { input: 0, output: 0 },
    statusCounts,
    timeoutRate: valid.length > 0 ? Math.round((timeoutCount / valid.length) * 100) : 0,
    errorRate: results.length > 0 ? Math.round((errorCount / results.length) * 100) : 0,
    invalidHarnessRate: results.length > 0 ? Math.round((invalidCount / results.length) * 100) : 0,
    harnessFailureRate: results.length > 0 ? Math.round((invalidCount / results.length) * 100) : 0,
    validCount: valid.length,
    skippedCount: results.length - valid.length,
    invalidCount,
  };
}

function checkSafetyBounds(root) {
  const agentPath = path.join(root, "cli", "agent.js");
  const content = fs.readFileSync(agentPath, "utf-8");

  let profileContent = "";
  try {
    profileContent = fs.readFileSync(path.join(root, "cli", "model-profiles.js"), "utf-8");
  } catch {
    // ignore missing model profiles
  }
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

module.exports = {
  BENCHMARK_SCRIPT,
  DEFAULT_HARNESS_VERSION,
  SAFETY_BOUNDS,
  buildBaselineKey,
  checkSafetyBounds,
  computeBenchmarkScore,
  getBaselinePath,
  getBenchmarkScore,
  getHarnessVersion,
  getResultsDir,
  listBenchmarkResultFiles,
  loadBenchmarkResult,
  makeRunId,
  runBenchmarkScript,
  sanitizeKeyPart,
};

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
const crypto = require("crypto");
const os = require("os");
const { execSync } = require("child_process");
const {
  DEFAULT_HARNESS_VERSION,
  buildBaselineKey,
  computeBenchmarkScore,
  getBaselinePath,
} = require("./benchmark-shared");

const { runTask } = require("./benchmark-reallife");

// Returns local Ollama model names when the daemon is reachable.
async function getOllamaModelNames() {
  try {
    const http = require("http");
    return await new Promise((resolve) => {
      const req = http.get(
        "http://localhost:11434/api/tags",
        { timeout: 3000 },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              resolve(
                Array.isArray(json.models)
                  ? json.models
                      .map((entry) => entry?.name || entry?.model)
                      .filter(Boolean)
                  : [],
              );
            } catch {
              resolve([]);
            }
          });
        },
      );
      req.on("error", () => resolve([]));
      req.on("timeout", () => {
        req.destroy();
        resolve([]);
      });
    });
  } catch {
    return [];
  }
}

// Returns true if Ollama is reachable and has at least one model loaded.
async function ollamaHasModels() {
  return (await getOllamaModelNames()).length > 0;
}
const {
  HARNESS_VERSION,
  TASKS,
  CATEGORY_WEIGHTS,
} = require("./benchmark-reallife-tasks");
const CACHE_DIR = path.join(__dirname, "..", ".nex", "gate-cache");
const NEX_CODE = path.join(__dirname, "..", "dist", "nex-code.js");
const ROUTING_PATH = path.join(os.homedir(), ".nex-code", "model-routing.json");
const GATE_HISTORY_FILENAME_PREFIX = "benchmark-gate-history";

// Parallelism: run this many tasks simultaneously
const CONCURRENCY = 3;
const GATE_HISTORY_LIMIT = 20;
const GATE_BASELINE_WINDOW = 5;

// Smoke-test tasks: one fast, reliable task per category
const SMOKE_TASK_IDS = [
  "bugfix-wrong-destructure", // bugfix        ~69s, score 90
  "feat-add-volume-control", // feature       single-file, clear spec
  "understand-project-structure", // understanding ~68s, score 90
  "devops-nginx-reverse-proxy", // devops        ~33s, score 90
  "refactor-fix-broken-import-paths", // refactor      ~70s, score 90
  "test-write-unit-tests", // testing       ~72s, score 90
  "docs-write-setup-guide", // docs          ~50s, score 90
];

// Thresholds
const SCORE_DROP_THRESHOLD = 5; // block if score drops more than 5 points
const SPEED_REGRESSION_FACTOR = 1.4; // block if avg time increases >40%

// --- Helpers ----------------------------------------------------------

function getCurrentCommit() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function isWorkingTreeClean() {
  try {
    return (
      execSync("git status --porcelain --untracked-files=no", {
        encoding: "utf8",
      }).trim() === ""
    );
  } catch {
    return false;
  }
}

function shouldUseGateCache({ sha, updateBaseline, workingTreeClean }) {
  return Boolean(sha && !updateBaseline && workingTreeClean);
}

function getCachePath(sha) {
  return path.join(CACHE_DIR, `${sha}.json`);
}

// Short hash of the baseline file — used to detect baseline changes in cache
function hashBaseline(baselinePath) {
  if (!baselinePath || !fs.existsSync(baselinePath)) return null;
  try {
    return crypto
      .createHash("sha1")
      .update(fs.readFileSync(baselinePath))
      .digest("hex")
      .slice(0, 12);
  } catch {
    return null;
  }
}

function loadBaseline(baselinePath) {
  if (!baselinePath || !fs.existsSync(baselinePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  } catch {
    return null;
  }
}

function saveBaseline(baselinePath, data) {
  const dir = path.dirname(baselinePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(baselinePath, JSON.stringify(data, null, 2));
}

function getGateHistoryPath({ homeDir, baselineKey }) {
  return path.join(
    homeDir,
    ".nex-code",
    `${GATE_HISTORY_FILENAME_PREFIX}-${baselineKey}.jsonl`,
  );
}

function loadGateHistory(historyPath) {
  if (!historyPath || !fs.existsSync(historyPath)) return [];
  return fs
    .readFileSync(historyPath, "utf8")
    .split("\n")
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

function appendGateHistory(historyPath, entry) {
  const dir = path.dirname(historyPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const history = loadGateHistory(historyPath);
  history.push(entry);
  const trimmed = history.slice(-GATE_HISTORY_LIMIT);
  fs.writeFileSync(
    historyPath,
    trimmed.map((item) => JSON.stringify(item)).join("\n") + "\n",
  );
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
    } catch {
      /* ignore */
    }
  }
}

function loadRouting() {
  if (!fs.existsSync(ROUTING_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(ROUTING_PATH, "utf8"));
  } catch {
    return null;
  }
}

function loadGateEnvironment({
  homeDir = os.homedir(),
  env = process.env,
  dotenv = require("dotenv"),
} = {}) {
  if (env.NEX_NO_DOTENV === "1") return false;
  const envPath = path.join(homeDir, ".nex-code", ".env");
  if (!fs.existsSync(envPath)) return false;

  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    env[key] = value;
  }
  return true;
}

function normalizeOllamaModelName(model) {
  if (typeof model !== "string") return null;
  const trimmed = model.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("ollama:")
    ? trimmed.slice("ollama:".length)
    : trimmed;
}

function collectConfiguredOllamaModels({
  model,
  routing,
  env = process.env,
} = {}) {
  const candidates = new Set();
  const add = (value) => {
    const normalized = normalizeOllamaModelName(value);
    if (normalized) candidates.add(normalized);
  };

  if (model) {
    add(model);
    return [...candidates];
  }

  if ((env.DEFAULT_PROVIDER || "ollama").toLowerCase() !== "ollama") {
    return [];
  }

  add(env.DEFAULT_MODEL);
  for (const key of [
    "NEX_FAST_MODEL",
    "NEX_STANDARD_MODEL",
    "NEX_HEAVY_MODEL",
    "NEX_LARGE_REPO_MODEL",
    "NEX_ROUTE_AGENTIC",
    "NEX_ROUTE_CODING",
    "NEX_ROUTE_DATA",
    "NEX_ROUTE_FRONTEND",
    "NEX_ROUTE_SYSADMIN",
  ]) {
    add(env[key]);
  }

  for (const value of Object.values(routing || {})) {
    if (typeof value === "string") add(value);
  }
  for (const value of Object.values(routing?.phases || {})) {
    if (typeof value === "string") add(value);
  }

  return [...candidates].sort((a, b) => a.localeCompare(b));
}

function findUnavailableOllamaModels(configuredModels, loadedModels) {
  const loaded = new Set(loadedModels);
  return configuredModels.filter((model) => {
    if (loaded.has(model)) return false;
    if (!model.includes(":")) {
      return !loadedModels.some((loadedModel) =>
        loadedModel.startsWith(`${model}:`),
      );
    }
    return true;
  });
}

// Compact string of top-level category->model assignments for comparison
function routingSignature(routing) {
  if (!routing) return null;
  return Object.entries(routing)
    .filter(([, v]) => typeof v === "string")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function getBaselineContext({
  homeDir,
  harnessVersion,
  routingSignature: currentRoutingSig,
}) {
  const resolvedHarnessVersion = harnessVersion || DEFAULT_HARNESS_VERSION;
  const baselineKey = buildBaselineKey({
    harnessVersion: resolvedHarnessVersion,
    routingSignature: currentRoutingSig,
  });
  const baselinePath = getBaselinePath({
    homeDir,
    harnessVersion: resolvedHarnessVersion,
    routingSignature: currentRoutingSig,
  });
  return {
    baselineKey,
    baselinePath,
    harnessVersion: resolvedHarnessVersion,
  };
}

function median(values) {
  const valid = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[middle];
  return (valid[middle - 1] + valid[middle]) / 2;
}

function summarizeGateBaseline(
  baseline,
  history = [],
  windowSize = GATE_BASELINE_WINDOW,
) {
  const seedEntry = baseline
    ? {
        finalScore: baseline.finalScore,
        avgElapsed: baseline.avgElapsed,
        timeoutRate: baseline.metrics?.timeoutRate || 0,
        categoryScores: baseline.categoryScores || {},
      }
    : null;
  const comparableHistory = history.filter((entry) =>
    !entry.outcome ||
    ["baseline", "baseline-update", "pass", "transient-warning"].includes(
      entry.outcome,
    ),
  );
  const recent = comparableHistory.slice(
    -Math.max(0, windowSize - (seedEntry ? 1 : 0)),
  );
  const entries = [...(seedEntry ? [seedEntry] : []), ...recent].filter(
    Boolean,
  );

  const allCategories = new Set();
  for (const entry of entries) {
    for (const category of Object.keys(entry.categoryScores || {})) {
      allCategories.add(category);
    }
  }

  const categoryScores = {};
  const categoryRanges = {};
  for (const category of allCategories) {
    const values = entries
      .map((entry) => entry.categoryScores?.[category])
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) continue;
    categoryScores[category] = Math.round(median(values));
    categoryRanges[category] = {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  const scoreValues = entries
    .map((entry) => entry.finalScore)
    .filter(Number.isFinite);
  const avgElapsedValues = entries
    .map((entry) => entry.avgElapsed)
    .filter(Number.isFinite);
  const timeoutValues = entries
    .map((entry) => entry.timeoutRate)
    .filter(Number.isFinite);

  return {
    finalScore: Math.round(median(scoreValues) || 0),
    avgElapsed: Math.round(median(avgElapsedValues) || 0),
    metrics: {
      timeoutRate: Math.round(median(timeoutValues) || 0),
    },
    categoryScores,
    sampleSize: entries.length,
    scoreRange: {
      min: scoreValues.length > 0 ? Math.min(...scoreValues) : null,
      max: scoreValues.length > 0 ? Math.max(...scoreValues) : null,
    },
    avgElapsedRange: {
      min: avgElapsedValues.length > 0 ? Math.min(...avgElapsedValues) : null,
      max: avgElapsedValues.length > 0 ? Math.max(...avgElapsedValues) : null,
    },
    timeoutRange: {
      min: timeoutValues.length > 0 ? Math.min(...timeoutValues) : null,
      max: timeoutValues.length > 0 ? Math.max(...timeoutValues) : null,
    },
    categoryRanges,
    windowSize: entries.length,
  };
}

function findPreviousComparableRun(history = [], sha = null) {
  if (!sha) return null;
  for (let index = history.length - 1; index >= 0; index--) {
    const entry = history[index];
    if (entry?.sha === sha) return entry;
  }
  return null;
}

function findPassingHistoryRun(history = [], { sha = null, baselineKey = null } = {}) {
  if (!sha || !baselineKey) return null;
  for (let index = history.length - 1; index >= 0; index--) {
    const entry = history[index];
    if (entry?.sha !== sha || entry?.baselineKey !== baselineKey) continue;
    if (
      ["baseline", "baseline-update", "pass", "transient-warning"].includes(
        entry.outcome,
      )
    ) {
      return entry;
    }
    return null;
  }
  return null;
}

function classifyRegressionSeverity(current, baselineSummary, reasons = []) {
  if (reasons.length === 0) return { severe: false, repeated: false };
  const scoreFloor = Math.max(
    0,
    (baselineSummary.scoreRange?.min ?? baselineSummary.finalScore) -
      SCORE_DROP_THRESHOLD,
  );
  const speedCeiling = Math.max(
    baselineSummary.avgElapsed * SPEED_REGRESSION_FACTOR,
    (baselineSummary.avgElapsedRange?.max || baselineSummary.avgElapsed) * 1.15,
  );
  const timeoutCeiling = Math.max(
    (baselineSummary.timeoutRange?.max ||
      baselineSummary.metrics?.timeoutRate ||
      0) + 10,
    (baselineSummary.metrics?.timeoutRate || 0) + 20,
  );

  return {
    severe:
      current.finalScore < scoreFloor ||
      current.avgElapsed > speedCeiling ||
      current.timeoutRate > timeoutCeiling,
  };
}

function collectRegressionReasons(current, baseline) {
  let pass = true;
  const reasons = [];

  if (
    (current.invalidCount || 0) > 0 ||
    (current.invalidHarnessRate || 0) > 0
  ) {
    pass = false;
    reasons.push(
      `Harness telemetry failed for ${current.invalidCount || 0} task(s) (${current.invalidHarnessRate || 0}% invalid)`,
    );
  }

  const scoreDrop = baseline.finalScore - current.finalScore;
  if (scoreDrop > SCORE_DROP_THRESHOLD) {
    pass = false;
    reasons.push(
      `Score dropped ${scoreDrop} points (${baseline.finalScore} -> ${current.finalScore}, threshold: ${SCORE_DROP_THRESHOLD})`,
    );
  }

  const speedRatio = current.avgElapsed / baseline.avgElapsed;
  if (speedRatio > SPEED_REGRESSION_FACTOR) {
    pass = false;
    const pct = Math.round((speedRatio - 1) * 100);
    reasons.push(
      `Speed regressed ${pct}% (avg ${(current.avgElapsed / 1000).toFixed(1)}s vs baseline ${(baseline.avgElapsed / 1000).toFixed(1)}s, threshold: ${Math.round((SPEED_REGRESSION_FACTOR - 1) * 100)}%)`,
    );
  }

  for (const [cat, score] of Object.entries(current.categoryScores)) {
    const bScore = baseline.categoryScores[cat];
    if (bScore != null && bScore - score > 10) {
      pass = false;
      reasons.push(
        `Category "${cat}" dropped ${bScore - score} points (${bScore} -> ${score})`,
      );
    }
  }

  const baselineTimeoutRate = baseline.metrics?.timeoutRate || 0;
  if (current.timeoutRate > baselineTimeoutRate + 20) {
    pass = false;
    reasons.push(
      `Timeout rate increased ${current.timeoutRate - baselineTimeoutRate} points (${baselineTimeoutRate}% -> ${current.timeoutRate}%)`,
    );
  }

  return { pass, reasons };
}

function evaluateGateRegression(current, baseline, options = {}) {
  const previous = options.previous || null;
  const { pass, reasons } = collectRegressionReasons(current, baseline);

  if (pass) {
    return { pass: true, reasons: [], severity: "none" };
  }

  const { severe } = classifyRegressionSeverity(current, baseline, reasons);
  if (
    severe ||
    (current.invalidCount || 0) > 0 ||
    (current.invalidHarnessRate || 0) > 0
  ) {
    return { pass: false, reasons, severity: "severe" };
  }

  if (previous) {
    const previousRegression = collectRegressionReasons(previous, baseline);
    if (!previousRegression.pass) {
      return {
        pass: false,
        reasons,
        severity: "repeat",
      };
    }
  }

  return {
    pass: true,
    reasons: [],
    severity: "transient",
    warning: `Single-run regression detected against a ${baseline.sampleSize || 1}-run median baseline; re-run before blocking.`,
    warningReasons: reasons,
  };
}

// Run tasks with a bounded concurrency pool, printing results as they arrive
async function runParallel(tasks, model, concurrency) {
  if (tasks.length === 0) return [];

  const results = [];
  const queue = [...tasks];
  const inFlight = new Set();

  return new Promise((resolve) => {
    function dispatch() {
      while (inFlight.size < concurrency && queue.length > 0) {
        const task = queue.shift();
        process.stdout.write(`  Running ${task.id}... `);
        const promise = runTask(task, model).then((result) => {
          inFlight.delete(promise);
          results.push(result);
          if (result.completionReason === "setup-error") {
            console.log(`\x1b[33m! SKIP\x1b[0m (setup error: ${result.error})`);
          } else {
            const icon =
              result.score >= 80
                ? "\x1b[32m\u2713\x1b[0m"
                : result.score >= 50
                  ? "\x1b[33m~\x1b[0m"
                  : "\x1b[31m\u2717\x1b[0m";
            console.log(
              `${icon} ${result.score}/100 (${(result.elapsed / 1000).toFixed(1)}s)`,
            );
          }
          dispatch();
          if (inFlight.size === 0 && queue.length === 0) resolve(results);
        });
        inFlight.add(promise);
      }
    }
    dispatch();
  });
}

// --- Main -------------------------------------------------------------

async function main() {
  loadGateEnvironment();

  const args = process.argv.slice(2);
  const updateBaseline = args.includes("--update-baseline");
  const fullRun = args.includes("--full");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;

  // Check dist exists
  if (!fs.existsSync(NEX_CODE)) {
    console.error(
      "\n  ERROR: dist/nex-code.js not found. Run: npm run build\n",
    );
    process.exit(1);
  }

  const currentRouting = loadRouting();
  const loadedOllamaModels = await getOllamaModelNames();

  // Pre-flight: skip gate if the configured Ollama path is unavailable. This
  // avoids false regressions from instant-fail or hung provider runs.
  if (!updateBaseline && loadedOllamaModels.length === 0) {
    console.log(
      "\n  \x1b[33m⚠ Gate skipped: Ollama has no models loaded.\x1b[0m",
    );
    console.log("  Start Ollama and pull a model to enable quality checks.\n");
    process.exit(0);
  }

  const configuredOllamaModels = collectConfiguredOllamaModels({
    model,
    routing: currentRouting,
    env: process.env,
  });
  const unavailableOllamaModels = findUnavailableOllamaModels(
    configuredOllamaModels,
    loadedOllamaModels,
  );
  if (!updateBaseline && unavailableOllamaModels.length > 0) {
    console.log(
      "\n  \x1b[33m⚠ Gate skipped: configured Ollama model is not loaded.\x1b[0m",
    );
    console.log(
      `  Missing: ${unavailableOllamaModels.slice(0, 5).join(", ")}${unavailableOllamaModels.length > 5 ? ", ..." : ""}`,
    );
    console.log(`  Loaded:  ${loadedOllamaModels.join(", ")}`);
    console.log(
      "  Pull the missing model or update ~/.nex-code/model-routing.json before measuring quality.\n",
    );
    process.exit(0);
  }

  const sha = getCurrentCommit();
  const workingTreeClean = isWorkingTreeClean();

  // Load model routing and warn if it differs from the baseline snapshot
  const currentRoutingSig = routingSignature(currentRouting);
  const requestedHarnessVersion = HARNESS_VERSION || DEFAULT_HARNESS_VERSION;
  const { baselineKey, baselinePath, harnessVersion } = getBaselineContext({
    homeDir: os.homedir(),
    harnessVersion: requestedHarnessVersion,
    routingSignature: currentRoutingSig,
  });
  const currentBaselineHash = hashBaseline(baselinePath);
  const historyPath = getGateHistoryPath({
    homeDir: os.homedir(),
    baselineKey,
  });

  // Check cache for current commit — only valid if baseline hasn't changed since caching
  if (shouldUseGateCache({ sha, updateBaseline, workingTreeClean })) {
    const cached = loadCache(sha);
    if (cached && cached.pass && cached.baselineKey === baselineKey) {
      if (cached.baselineHash && cached.baselineHash !== currentBaselineHash) {
        console.log(
          `  Gate: cache invalidated (baseline changed since ${sha.slice(0, 8)}), re-running...`,
        );
      } else {
        console.log(`\n  Gate: PASS (cached for ${sha.slice(0, 8)})`);
        console.log(
          `  Score: ${cached.finalScore}/100, Avg: ${(cached.avgElapsed / 1000).toFixed(1)}s\n`,
        );
        process.exit(0);
      }
    }
  } else if (sha && !updateBaseline && !workingTreeClean) {
    console.log(
      "  Gate: working tree has tracked changes, ignoring cached results...",
    );
  }

  const baseline = loadBaseline(baselinePath);
  const gateHistory = loadGateHistory(historyPath);
  const baselineSummary = baseline
    ? summarizeGateBaseline(baseline, gateHistory)
    : null;
  const previousComparableRun = findPreviousComparableRun(gateHistory, sha);
  if (shouldUseGateCache({ sha, updateBaseline, workingTreeClean })) {
    const historyPass = findPassingHistoryRun(gateHistory, {
      sha,
      baselineKey,
    });
    if (historyPass) {
      console.log(`\n  Gate: PASS (history cached for ${sha.slice(0, 8)})`);
      console.log(
        `  Score: ${historyPass.finalScore}/100, Avg: ${(historyPass.avgElapsed / 1000).toFixed(1)}s\n`,
      );
      process.exit(0);
    }
  }

  // Select tasks
  const taskIds = fullRun ? TASKS.map((t) => t.id) : SMOKE_TASK_IDS;
  const tasks = TASKS.filter((t) => taskIds.includes(t.id));

  if (tasks.length === 0) {
    console.error("\n  ERROR: No matching smoke-test tasks found\n");
    process.exit(1);
  }

  console.log(
    `\n  Benchmark Gate: ${tasks.length} tasks (concurrency: ${Math.min(CONCURRENCY, tasks.length)})${model ? ` [model: ${model}]` : ""}`,
  );
  console.log(
    `  Mode: ${fullRun ? "FULL (all tasks)" : "SMOKE (one per category)"}\n`,
  );

  const startTime = Date.now();
  const results = await runParallel(tasks, model, CONCURRENCY);
  const totalElapsed = Date.now() - startTime;

  const current = computeBenchmarkScore(results, CATEGORY_WEIGHTS);

  // Print summary
  console.log("\n  " + "=".repeat(50));
  console.log(
    `  Score:    ${current.finalScore}/100${baselineSummary ? ` (baseline median: ${baselineSummary.finalScore}/100)` : ""}`,
  );
  console.log(
    `  Avg Time: ${(current.avgElapsed / 1000).toFixed(1)}s${baselineSummary ? ` (baseline median: ${(baselineSummary.avgElapsed / 1000).toFixed(1)}s)` : ""}`,
  );
  console.log(`  Total:    ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(
    `  Passing:  ${results.filter((r) => r.score >= 80).length}/${results.length}` +
      (current.skippedCount > 0
        ? ` \x1b[33m(${current.skippedCount} skipped — setup error)\x1b[0m`
        : ""),
  );

  // Per-category comparison
  if (baselineSummary) {
    console.log(
      `  Baseline Window: ${baselineSummary.sampleSize} run${baselineSummary.sampleSize === 1 ? "" : "s"}`,
    );
    console.log("\n  Per-category:");
    for (const [cat, score] of Object.entries(current.categoryScores)) {
      const bScore = baselineSummary.categoryScores[cat];
      const delta = bScore != null ? score - bScore : null;
      const indicator =
        delta == null
          ? ""
          : delta >= 0
            ? ` \x1b[32m(+${delta})\x1b[0m`
            : ` \x1b[31m(${delta})\x1b[0m`;
      console.log(`    ${cat.padEnd(15)} ${score}/100${indicator}`);
    }
  }

  // Helper: cache this commit as passing
  function cachePass() {
    if (shouldUseGateCache({ sha, updateBaseline, workingTreeClean })) {
      saveCache(sha, {
        date: new Date().toISOString(),
        pass: true,
        finalScore: current.finalScore,
        avgElapsed: current.avgElapsed,
        baselineKey,
        baselineHash: currentBaselineHash,
      });
      cleanOldCache();
    }
  }

  function recordGateRun(outcome) {
    appendGateHistory(historyPath, {
      date: new Date().toISOString(),
      sha,
      baselineKey,
      harnessVersion,
      outcome,
      finalScore: current.finalScore,
      avgElapsed: current.avgElapsed,
      timeoutRate: current.timeoutRate,
      categoryScores: current.categoryScores,
    });
  }

  // No baseline yet — save one automatically
  if (!baseline) {
    saveBaseline(baselinePath, {
      date: new Date().toISOString(),
      sha,
      baselineKey,
      harnessVersion,
      finalScore: current.finalScore,
      categoryScores: current.categoryScores,
      categoryMetrics: current.categoryMetrics,
      avgElapsed: current.avgElapsed,
      routingSignature: currentRoutingSig,
      metrics: {
        avgToolCalls: current.avgToolCalls,
        timeoutRate: current.timeoutRate,
        errorRate: current.errorRate,
        avgTokens: current.avgTokens,
      },
      perTask: results
        .filter((r) => r.completionReason !== "setup-error")
        .map((r) => ({ id: r.id, score: r.score, elapsed: r.elapsed })),
    });
    recordGateRun("baseline");
    cachePass();
    console.log(
      "\n  \x1b[33mNo baseline found — saved current run as baseline.\x1b[0m",
    );
    console.log(`  Baseline: ${baselinePath}\n`);
    process.exit(0);
  }

  if (updateBaseline) {
    saveBaseline(baselinePath, {
      date: new Date().toISOString(),
      sha,
      baselineKey,
      harnessVersion,
      finalScore: current.finalScore,
      categoryScores: current.categoryScores,
      categoryMetrics: current.categoryMetrics,
      avgElapsed: current.avgElapsed,
      routingSignature: currentRoutingSig,
      metrics: {
        avgToolCalls: current.avgToolCalls,
        timeoutRate: current.timeoutRate,
        errorRate: current.errorRate,
        avgTokens: current.avgTokens,
      },
      perTask: results
        .filter((r) => r.completionReason !== "setup-error")
        .map((r) => ({ id: r.id, score: r.score, elapsed: r.elapsed })),
    });
    recordGateRun("baseline-update");
    cachePass();
    console.log("\n  \x1b[32mBaseline updated.\x1b[0m\n");
    process.exit(0);
  }

  // Sanity check: if all tasks finished in <2s the model never ran (instant failures)
  // Don't let fake scores block a push — skip instead.
  if (current.validCount > 0 && current.avgElapsed < 2000) {
    console.log(
      "\n  \x1b[33m⚠ Gate skipped: tasks completed too fast (avg " +
        (current.avgElapsed / 1000).toFixed(2) +
        "s) — model likely unreachable.\x1b[0m",
    );
    console.log(
      "  Scores are unreliable; skipping gate to avoid false regressions.\n",
    );
    process.exit(0);
  }

  // Decision
  const decision = evaluateGateRegression(current, baselineSummary, {
    previous: previousComparableRun,
  });
  const { pass, reasons } = decision;

  if (pass) {
    recordGateRun(
      decision.severity === "transient" ? "transient-warning" : "pass",
    );
    if (decision.warning) {
      console.log(`\n  \x1b[33m⚠ Gate: WARN — ${decision.warning}\x1b[0m`);
      for (const reason of decision.warningReasons || []) {
        console.log(`    \x1b[33m• ${reason}\x1b[0m`);
      }
      console.log();
    } else {
      console.log(
        "\n  \x1b[32m\u2714 Gate: PASS — no quality or speed regression detected.\x1b[0m\n",
      );
    }
    cachePass();
    process.exit(0);
  } else {
    recordGateRun(decision.severity === "repeat" ? "repeat-fail" : "fail");
    console.log("\n  \x1b[31m\u2718 Gate: FAIL — regression detected:\x1b[0m");
    for (const r of reasons) {
      console.log(`    \x1b[31m\u2022 ${r}\x1b[0m`);
    }
    console.log("\n  To investigate, review failing tasks above.");
    console.log(
      "  To update baseline after intentional changes: npm run benchmark:gate -- --update-baseline",
    );
    console.log("  To bypass: NEX_SKIP_BENCHMARK=1 git push\n");
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Gate failed:", err);
    process.exit(1);
  });
}

module.exports = {
  evaluateGateRegression,
  collectConfiguredOllamaModels,
  findUnavailableOllamaModels,
  getBaselineContext,
  getGateHistoryPath,
  hashBaseline,
  findPassingHistoryRun,
  findPreviousComparableRun,
  loadGateEnvironment,
  loadGateHistory,
  main,
  routingSignature,
  shouldUseGateCache,
  summarizeGateBaseline,
};

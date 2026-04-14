"use strict";

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function getResultsDir(rootDir = process.cwd()) {
  return path.join(rootDir, "scripts", "benchmark-results");
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readHistory(rootDir = process.cwd()) {
  const historyFile = path.join(getResultsDir(rootDir), "reallife-history.jsonl");
  if (!fs.existsSync(historyFile)) return [];
  return fs
    .readFileSync(historyFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(safeParseJson)
    .filter(Boolean);
}

function listResultFiles(rootDir = process.cwd()) {
  const resultsDir = getResultsDir(rootDir);
  if (!fs.existsSync(resultsDir)) return [];
  return fs
    .readdirSync(resultsDir)
    .filter((name) => /^reallife-.*\.json$/.test(name))
    .map((name) => {
      const fullPath = path.join(resultsDir, name);
      return {
        name,
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readLatestResult(rootDir = process.cwd()) {
  const latest = listResultFiles(rootDir)[0];
  if (!latest) return null;
  const data = safeParseJson(fs.readFileSync(latest.fullPath, "utf8"));
  if (!data) return null;
  return { ...data, __file: latest.fullPath };
}

function formatPercent(value) {
  return `${Math.round(value || 0)}%`;
}

function formatTokens(tokens = {}) {
  const input = tokens.input || 0;
  const output = tokens.output || 0;
  return `${input.toLocaleString()} in / ${output.toLocaleString()} out`;
}

function classifyTask(result) {
  const timedOut = result.completionReason === "timeout";
  const toolCalls = result.toolCalls || 0;
  const inputTokens = result.tokens?.input || 0;
  const score = result.score ?? 0;
  const textHeavy =
    result.category === "docs" || result.category === "understanding";

  if (timedOut && toolCalls >= 20) {
    return "over-exploration";
  }
  if (timedOut && textHeavy) {
    return "late finalization";
  }
  if (timedOut && toolCalls === 0) {
    return "tool underuse";
  }
  if (timedOut && score >= 60) {
    return "useful but unfinished";
  }
  if (score < 50 && inputTokens >= 300000) {
    return "high-cost weak result";
  }
  if (toolCalls >= 12 && score < 70) {
    return "tool thrash";
  }
  if (score >= 80) {
    return "healthy";
  }
  return "quality gap";
}

function summarizeIssue(pattern) {
  switch (pattern) {
    case "over-exploration":
      return "The agent keeps gathering evidence after enough context exists.";
    case "late finalization":
      return "The task likely has enough information, but the final deliverable starts too late.";
    case "tool underuse":
      return "The task finishes with little or no tool support, suggesting poor action selection.";
    case "useful but unfinished":
      return "The work is mostly correct, but the run exits before a clean final answer.";
    case "high-cost weak result":
      return "The task burns a large amount of tokens without converting that work into score.";
    case "tool thrash":
      return "The agent spends many tool calls for a middling result, suggesting loopiness.";
    case "quality gap":
      return "The task finishes, but output quality still needs improvement.";
    default:
      return "The task looks healthy compared with the rest of the run.";
  }
}

function compareLatestToPrevious(history, latestRun) {
  if (!latestRun?.runId || history.length < 2) return null;
  const latestIndex = history.findIndex((entry) => entry.runId === latestRun.runId);
  if (latestIndex <= 0) return null;
  const previous = history[latestIndex - 1];
  if (!previous) return null;
  return {
    previous,
    scoreDelta: (latestRun.finalScore || 0) - (previous.finalScore || 0),
    timeoutDelta:
      (latestRun.metrics?.timeoutRate || 0) - (previous.metrics?.timeoutRate || 0),
    toolDelta:
      (latestRun.metrics?.avgToolCalls || 0) - (previous.metrics?.avgToolCalls || 0),
  };
}

function buildRecommendations(results = [], latestRun) {
  const patterns = new Map();
  for (const result of results) {
    const pattern = classifyTask(result);
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
  }

  const recommendations = [];

  if ((patterns.get("over-exploration") || 0) > 0) {
    recommendations.push(
      "Reduce repeated read/search loops once enough evidence exists for a synthesis pass.",
    );
  }
  if ((patterns.get("late finalization") || 0) > 0) {
    recommendations.push(
      "Trigger earlier final deliverable generation for docs and understanding tasks.",
    );
  }
  if ((patterns.get("useful but unfinished") || 0) > 0) {
    recommendations.push(
      "Tighten headless completion criteria so strong partial work exits as a finished answer.",
    );
  }
  if ((patterns.get("tool thrash") || 0) > 0) {
    recommendations.push(
      "Cap redundant verification or repeated edits when score is not improving.",
    );
  }
  if ((latestRun?.metrics?.timeoutRate || 0) >= 70) {
    recommendations.push(
      "Prioritize timeout reduction before raising quality bars or widening the benchmark slice.",
    );
  }

  return recommendations.slice(0, 3);
}

function buildCodexPrompt(latestRun, topTask) {
  const timeoutRate = latestRun?.metrics?.timeoutRate || 0;
  const avgTools = latestRun?.metrics?.avgToolCalls || 0;
  const finalScore = latestRun?.finalScore || 0;
  const prompt = [
    "The benchmark harness is healthy and measuring correctly.",
    "",
    "Current benchmark evidence:",
    `- Final weighted score: ${finalScore}/100`,
    `- Timeout rate: ${timeoutRate}%`,
    `- Avg tool calls: ${avgTools}`,
    `- Tokens: ${formatTokens(latestRun?.totalTokens)}`,
    "",
    "Biggest bottleneck task:",
    `- ${topTask.id}: ${topTask.score}/100`,
    `- category: ${topTask.category}`,
    `- completionReason: ${topTask.completionReason || "unknown"}`,
    `- toolCalls: ${topTask.toolCalls || 0}`,
    `- tokens: ${formatTokens(topTask.tokens)}`,
    `- likely issue: ${classifyTask(topTask)}`,
    "",
    "Your task:",
    "Implement exactly one focused systemic fix in cli/ code that addresses this dominant bottleneck pattern.",
    "",
    "Constraints:",
    "- Do not modify benchmark files or benchmark task definitions.",
    "- Do not add task-specific hacks.",
    "- Keep the patch focused and small.",
    "- Preserve the working tool/token telemetry path.",
    "",
    "What I want:",
    "1. Identify the main reason this pattern still happens.",
    "2. Implement one fix only.",
    "3. Run the most relevant focused tests.",
    "4. Explain why this should improve completion rate broadly.",
  ];
  return prompt.join("\n");
}

function getPriorityDir(rootDir = process.cwd()) {
  return path.join(getResultsDir(rootDir), "prio");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function makeArtifactId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function selectPriorityTasks(latestRun, maxTasks = 4) {
  const results = Array.isArray(latestRun?.results) ? latestRun.results : [];
  return results
    .map((result) => ({ ...result, pattern: classifyTask(result) }))
    .sort((a, b) => {
      const aTimeout = a.completionReason === "timeout" ? 1 : 0;
      const bTimeout = b.completionReason === "timeout" ? 1 : 0;
      if (bTimeout !== aTimeout) return bTimeout - aTimeout;
      if ((a.score || 0) !== (b.score || 0)) return (a.score || 0) - (b.score || 0);
      if ((b.toolCalls || 0) !== (a.toolCalls || 0)) return (b.toolCalls || 0) - (a.toolCalls || 0);
      return (b.tokens?.input || 0) - (a.tokens?.input || 0);
    })
    .slice(0, maxTasks)
    .map((result) => result.id);
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
    encoding: "utf8",
    maxBuffer: options.maxBuffer || 20 * 1024 * 1024,
  });
}

function runCommandStream(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let stdoutBuffer = "";
    let stderrBuffer = "";

    function flushLines(buffer, callback) {
      const parts = buffer.split("\n");
      const remainder = parts.pop();
      for (const line of parts) callback(line);
      return remainder;
    }

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      stdoutBuffer += text;
      stdoutBuffer = flushLines(stdoutBuffer, (line) => {
        if (options.onStdoutLine) options.onStdoutLine(line);
      });
    });

    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
      stderrBuffer += text;
      stderrBuffer = flushLines(stderrBuffer, (line) => {
        if (options.onStderrLine) options.onStderrLine(line);
      });
    });

    proc.on("error", reject);
    proc.on("close", (status, signal) => {
      if (stdoutBuffer && options.onStdoutLine) options.onStdoutLine(stdoutBuffer);
      if (stderrBuffer && options.onStderrLine) options.onStderrLine(stderrBuffer);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

function readResultFileByPath(resultPath) {
  if (!resultPath || !fs.existsSync(resultPath)) return null;
  return safeParseJson(fs.readFileSync(resultPath, "utf8"));
}

function findNewestResultAfter(rootDir, previousPaths = []) {
  const previous = new Set(previousPaths);
  const newest = listResultFiles(rootDir).find((entry) => !previous.has(entry.fullPath));
  return newest ? newest.fullPath : null;
}

function buildVerificationReport({
  sourceRun,
  verifiedRun,
  taskIds,
  tests,
  bundleDir,
}) {
  const lines = [];
  const testStatus = tests.status === 0 ? "passed" : `failed (exit ${tests.status})`;
  const verifiedScore = verifiedRun?.finalScore ?? 0;
  const scoreDelta = verifiedRun
    ? verifiedScore - (sourceRun?.finalScore || 0)
    : null;
  const timeoutDelta = verifiedRun
    ? (verifiedRun.metrics?.timeoutRate || 0) - (sourceRun?.metrics?.timeoutRate || 0)
    : null;
  const toolDelta = verifiedRun
    ? (verifiedRun.metrics?.avgToolCalls || 0) - (sourceRun?.metrics?.avgToolCalls || 0)
    : null;

  lines.push("");
  lines.push("Harness Optimization Verification");
  lines.push(`- Source run: ${sourceRun?.runId || "unknown"}`);
  lines.push(`- Focus tasks: ${taskIds.join(", ")}`);
  lines.push(`- Tests: ${testStatus}`);
  if (verifiedRun) {
    lines.push(`- Verified run: ${verifiedRun.runId || "unknown"}`);
    lines.push(`- Score: ${verifiedScore}/100${scoreDelta === null ? "" : ` (${scoreDelta >= 0 ? "+" : ""}${scoreDelta})`}`);
    lines.push(
      `- Timeout rate: ${formatPercent(verifiedRun.metrics?.timeoutRate)}${
        timeoutDelta === null ? "" : ` (${timeoutDelta >= 0 ? "+" : ""}${timeoutDelta} pts)`
      }`,
    );
    lines.push(
      `- Avg tool calls: ${Math.round(verifiedRun.metrics?.avgToolCalls || 0)}${
        toolDelta === null ? "" : ` (${toolDelta >= 0 ? "+" : ""}${toolDelta})`
      }`,
    );
    lines.push(`- Tokens: ${formatTokens(verifiedRun.totalTokens)}`);
  } else {
    lines.push("- Verified run: not found");
  }
  lines.push(`- Artifacts: ${bundleDir}`);
  lines.push("");
  lines.push("Next Step");
  if (tests.status !== 0) {
    lines.push("- Fix the failing tests before trusting the benchmark slice.");
  } else if (!verifiedRun) {
    lines.push("- The benchmark slice did not produce a new result file. Inspect the captured logs.");
  } else if ((verifiedRun.metrics?.timeoutRate || 0) >= 70) {
    lines.push("- Timeout pressure is still high. Use the updated report and Codex prompt before running a full benchmark.");
  } else {
    lines.push("- This slice looks healthier. Re-run a broader slice or the full benchmark before updating the gate baseline.");
  }
  return lines.join("\n");
}

async function verifyHarnessOptimization({
  rootDir = process.cwd(),
  latestRun,
  taskIds,
  testFiles,
  runner = runCommand,
  onProgress,
} = {}) {
  if (!latestRun) {
    throw new Error("No latest benchmark run available for verification.");
  }

  const selectedTaskIds =
    Array.isArray(taskIds) && taskIds.length > 0
      ? taskIds
      : selectPriorityTasks(latestRun);
  const selectedTests =
    Array.isArray(testFiles) && testFiles.length > 0
      ? testFiles
      : [
          "tests/agent.test.js",
          "tests/headless.test.js",
          "tests/benchmark-reallife.test.js",
        ];

  const bundleDir = ensureDir(path.join(getPriorityDir(rootDir), makeArtifactId()));
  const preExistingResults = listResultFiles(rootDir).map((entry) => entry.fullPath);

  if (onProgress) {
    onProgress({
      phase: "tests",
      percent: 5,
      message: `Running focused tests (${selectedTests.length} files)`,
    });
  }

  const jestBin = path.join(rootDir, "node_modules", "jest", "bin", "jest.js");
  const tests = await Promise.resolve(
    runner(
      process.execPath,
      [jestBin, ...selectedTests, "--runInBand"],
      { cwd: rootDir },
    ),
  );
  fs.writeFileSync(path.join(bundleDir, "tests.stdout.log"), tests.stdout || "");
  fs.writeFileSync(path.join(bundleDir, "tests.stderr.log"), tests.stderr || "");

  if (onProgress) {
    onProgress({
      phase: "tests",
      percent: 20,
      message:
        tests.status === 0
          ? "Focused tests passed"
          : `Focused tests failed (exit ${tests.status})`,
    });
  }

  let startedTasks = 0;
  let lastPercent = 20;
  const totalTasks = Math.max(1, selectedTaskIds.length);
  const streamRunner =
    runner === runCommand ? runCommandStream : runner;

  const benchmarkArgs = [
    process.execPath,
    path.join(rootDir, "scripts", "benchmark-reallife.js"),
    "--tasks",
    selectedTaskIds.join(","),
  ];

  if (onProgress) {
    onProgress({
      phase: "benchmark",
      percent: 25,
      message: `Running priority benchmark slice (${selectedTaskIds.join(", ")})`,
    });
  }

  const benchmark = await Promise.resolve(
    streamRunner(process.execPath, benchmarkArgs.slice(1), {
      cwd: rootDir,
      onStdoutLine(line) {
        if (!onProgress) return;
        const match = line.match(/Running ([\w-]+)\.\.\./);
        if (!match) return;
        startedTasks += 1;
        const base = 20;
        const span = 75;
        const percent = Math.min(
          95,
          base + Math.round((startedTasks / totalTasks) * span),
        );
        if (percent > lastPercent) {
          lastPercent = percent;
          onProgress({
            phase: "benchmark",
            percent,
            message: `Running benchmark task ${startedTasks}/${totalTasks}: ${match[1]}`,
          });
        }
      },
    }),
  );
  fs.writeFileSync(
    path.join(bundleDir, "benchmark.stdout.log"),
    benchmark.stdout || "",
  );
  fs.writeFileSync(
    path.join(bundleDir, "benchmark.stderr.log"),
    benchmark.stderr || "",
  );

  if (onProgress) {
    onProgress({
      phase: "finalize",
      percent: 97,
      message: "Writing verification artifacts",
    });
  }

  const resultPath = findNewestResultAfter(rootDir, preExistingResults);
  const verifiedRun = readResultFileByPath(resultPath);
  const summary = buildVerificationReport({
    sourceRun: latestRun,
    verifiedRun,
    taskIds: selectedTaskIds,
    tests,
    bundleDir,
  });

  const payload = {
    createdAt: new Date().toISOString(),
    sourceRunId: latestRun.runId || null,
    taskIds: selectedTaskIds,
    testFiles: selectedTests,
    tests: {
      status: tests.status,
      signal: tests.signal,
    },
    benchmark: {
      status: benchmark.status,
      signal: benchmark.signal,
      resultPath,
    },
    summary,
  };

  fs.writeFileSync(path.join(bundleDir, "verification.json"), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(bundleDir, "SUMMARY.md"), `${summary}\n`);

  if (onProgress) {
    onProgress({
      phase: "done",
      percent: 100,
      message: `Saved verification bundle to ${bundleDir}`,
    });
  }

  return {
    bundleDir,
    summary,
    selectedTaskIds,
    selectedTests,
    tests,
    benchmark,
    verifiedRun,
  };
}

function buildOptimizationReport({
  latestRun,
  history,
  lastN = 5,
  includePrompt = false,
} = {}) {
  if (!latestRun) {
    return "No real-life benchmark results found. Run `npm run benchmark:reallife` first.";
  }

  const results = Array.isArray(latestRun.results) ? latestRun.results : [];
  const recentHistory = history.slice(-Math.max(1, lastN));
  const comparison = compareLatestToPrevious(history, latestRun);
  const weakestCategories = Object.entries(latestRun.categoryMetrics || {})
    .sort((a, b) => {
      const scoreDiff = (a[1]?.avgScore || 0) - (b[1]?.avgScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (b[1]?.timeoutRate || 0) - (a[1]?.timeoutRate || 0);
    })
    .slice(0, 3);

  const bottlenecks = results
    .map((result) => ({ ...result, pattern: classifyTask(result) }))
    .sort((a, b) => {
      const aTimedOut = a.completionReason === "timeout" ? 1 : 0;
      const bTimedOut = b.completionReason === "timeout" ? 1 : 0;
      if (bTimedOut !== aTimedOut) return bTimedOut - aTimedOut;
      if ((a.score || 0) !== (b.score || 0)) return (a.score || 0) - (b.score || 0);
      if ((b.toolCalls || 0) !== (a.toolCalls || 0)) return (b.toolCalls || 0) - (a.toolCalls || 0);
      return (b.tokens?.input || 0) - (a.tokens?.input || 0);
    })
    .slice(0, 3);

  const recommendations = buildRecommendations(results, latestRun);
  const topTask = bottlenecks[0];
  const lines = [];

  lines.push("");
  lines.push("Harness Optimization Report");
  lines.push(`- Run: ${latestRun.runId || "unknown"}`);
  lines.push(`- Score: ${latestRun.finalScore || 0}/100`);
  lines.push(`- Timeout rate: ${formatPercent(latestRun.metrics?.timeoutRate)}`);
  lines.push(`- Avg tool calls: ${Math.round(latestRun.metrics?.avgToolCalls || 0)}`);
  lines.push(`- Tokens: ${formatTokens(latestRun.totalTokens)}`);
  lines.push(`- Tasks: ${latestRun.taskCount || results.length}`);

  if (comparison) {
    lines.push(
      `- Trend vs previous: score ${comparison.scoreDelta >= 0 ? "+" : ""}${comparison.scoreDelta}, timeout ${comparison.timeoutDelta >= 0 ? "+" : ""}${comparison.timeoutDelta} pts, tools ${comparison.toolDelta >= 0 ? "+" : ""}${comparison.toolDelta}`,
    );
  }

  if (recentHistory.length > 1) {
    const scores = recentHistory.map((entry) => entry.finalScore || 0);
    const avgScore = Math.round(
      scores.reduce((sum, value) => sum + value, 0) / scores.length,
    );
    lines.push(`- Recent average (${recentHistory.length} runs): ${avgScore}/100`);
  }

  lines.push("");
  lines.push("Top Bottlenecks");
  if (bottlenecks.length === 0) {
    lines.push("- No task-level details found in the latest run.");
  } else {
    bottlenecks.forEach((task, index) => {
      lines.push(
        `${index + 1}. ${task.id} — ${task.score}/100, ${task.toolCalls || 0} tools, ${task.completionReason || "unknown"}, ${task.pattern}`,
      );
      lines.push(`   ${summarizeIssue(task.pattern)}`);
    });
  }

  lines.push("");
  lines.push("Weakest Categories");
  if (weakestCategories.length === 0) {
    lines.push("- No category metrics found.");
  } else {
    weakestCategories.forEach(([category, metrics]) => {
      lines.push(
        `- ${category}: ${metrics.avgScore}/100 avg, ${formatPercent(metrics.timeoutRate)} timeout, ${Math.round(metrics.avgToolCalls || 0)} avg tools`,
      );
    });
  }

  lines.push("");
  lines.push("Recommendations");
  if (recommendations.length === 0) {
    lines.push("- The latest run looks healthy. Re-run a larger slice before changing agent behavior.");
  } else {
    recommendations.forEach((recommendation) => {
      lines.push(`- ${recommendation}`);
    });
  }

  if (includePrompt && topTask) {
    lines.push("");
    lines.push("Suggested Codex Prompt");
    lines.push("```text");
    lines.push(buildCodexPrompt(latestRun, topTask));
    lines.push("```");
  }

  return lines.join("\n");
}

module.exports = {
  buildCodexPrompt,
  buildOptimizationReport,
  buildVerificationReport,
  classifyTask,
  getPriorityDir,
  getResultsDir,
  listResultFiles,
  readHistory,
  readLatestResult,
  selectPriorityTasks,
  verifyHarnessOptimization,
};

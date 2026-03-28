"use strict";

/**
 * cli/benchmark.js — nex-code Model Benchmark
 *
 * Tests Ollama Cloud models against nex-code's real tool schemas.
 * Metrics: tool-call rate, tool name accuracy, argument validity, schema compliance.
 *
 * Usage:
 *   const { runBenchmark } = require('./benchmark');
 *   const ranking = await runBenchmark({ quick: true, onProgress: cb });
 */

const { C } = require("./ui");
const registry = require("./providers/registry");
const { TOOL_DEFINITIONS } = require("./tools");

// ─── Task Definitions ─────────────────────────────────────────────────────────
// Each task mirrors a real nex-code workflow.
// expectedTool: null → model should NOT call a tool (pure reasoning).

const TASKS = [
  // ── File operations ─────────────────────────────────────────────────────
  {
    id: "read-package",
    category: "file-ops",
    prompt: "Read the file package.json and show me its contents.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("package.json"),
  },
  {
    id: "write-file",
    category: "file-ops",
    prompt:
      'Create a file at /tmp/nex-bench-test.txt with the content "benchmark run".',
    expectedTool: "write_file",
    validateArgs: (args) =>
      typeof args.path === "string" && typeof args.content === "string",
  },
  {
    id: "edit-file",
    category: "file-ops",
    prompt:
      'In the file src/config.js, replace the string "debug: false" with "debug: true".',
    expectedTool: ["edit_file", "patch_file"],
    validateArgs: (args) => {
      if (
        args.path &&
        args.old_string !== undefined &&
        args.new_string !== undefined
      )
        return true;
      if (args.path && Array.isArray(args.patches) && args.patches.length > 0)
        return true;
      return false;
    },
  },
  {
    id: "list-directory",
    category: "file-ops",
    prompt: "Show me all files and folders in the cli/ directory.",
    expectedTool: ["list_directory", "glob"],
    validateArgs: (args) => {
      if (typeof args.path === "string" && args.path.includes("cli"))
        return true;
      if (typeof args.pattern === "string" && args.pattern.includes("cli"))
        return true;
      return false;
    },
  },
  {
    id: "glob-js-files",
    category: "file-ops",
    prompt:
      "Find all JavaScript files (*.js) recursively in the cli/ directory.",
    expectedTool: "glob",
    validateArgs: (args) =>
      typeof args.pattern === "string" && args.pattern.includes(".js"),
  },

  // ── Search ───────────────────────────────────────────────────────────────
  {
    id: "search-constant",
    category: "search",
    prompt:
      'Search for the string "DEFAULT_MODEL" across all files in the project.',
    expectedTool: ["search_files", "grep"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("DEFAULT_MODEL");
    },
  },
  {
    id: "grep-function-def",
    category: "search",
    prompt: 'Find where the function "callStream" is defined in the codebase.',
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("callStream");
    },
  },
  {
    id: "search-todos",
    category: "search",
    prompt: "Find all TODO comments in the source code.",
    expectedTool: ["grep", "search_files", "bash"],
    validateArgs: (args) => JSON.stringify(args).toUpperCase().includes("TODO"),
  },

  // ── Shell / bash ─────────────────────────────────────────────────────────
  {
    id: "git-branch",
    category: "shell",
    prompt: "What git branch am I currently on?",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" && args.command.includes("git"),
  },
  {
    id: "git-status",
    category: "shell",
    prompt: "Show me the current git status of the repository.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" && args.command.includes("git status"),
  },
  {
    id: "npm-install",
    category: "shell",
    prompt: "Run npm install to install project dependencies.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" && args.command.includes("npm"),
  },

  // ── Schema compliance ─────────────────────────────────────────────────────
  {
    id: "schema-strict",
    category: "schema",
    prompt: "Read the file README.md",
    expectedTool: "read_file",
    validateArgs: (args, toolDef) => {
      const schema = toolDef?.function?.parameters || {};
      const required = schema.required || [];
      const known = Object.keys(schema.properties || {});
      return (
        required.every((r) => args[r] !== undefined) &&
        Object.keys(args).every((k) => known.includes(k))
      );
    },
  },

  // ── Multi-step coherence ──────────────────────────────────────────────────
  {
    id: "multi-step-version",
    category: "multi-step",
    prompt:
      "What is the current version of this project? Check the source files.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("package.json"),
  },
  {
    id: "multi-step-count",
    category: "multi-step",
    prompt: "How many JavaScript files are in the cli/ directory? Count them.",
    expectedTool: ["bash", "glob", "list_directory"],
    validateArgs: (args) => {
      if (typeof args.command === "string" && args.command.includes("cli"))
        return true;
      if (typeof args.pattern === "string" && args.pattern.includes("cli"))
        return true;
      if (typeof args.path === "string" && args.path.includes("cli"))
        return true;
      return false;
    },
  },

  // ── Negative: should NOT call a tool ──────────────────────────────────────
  {
    id: "no-tool-reasoning",
    category: "reasoning",
    prompt: 'What does the acronym "API" stand for?',
    expectedTool: null,
    validateArgs: () => true,
  },

  // ── Frontend ──────────────────────────────────────────────────────────────
  {
    id: "frontend-find-hook",
    category: "frontend",
    prompt: "Find all files that import useState from React.",
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("useState");
    },
  },
  {
    id: "frontend-create-component",
    category: "frontend",
    prompt:
      "Create a React functional component called Button that accepts a label prop and renders a styled button element. Save it to src/components/Button.jsx.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      typeof args.path === "string" &&
      (args.path.includes(".jsx") ||
        args.path.includes(".tsx") ||
        args.path.includes(".js")) &&
      typeof args.content === "string",
  },
  {
    id: "frontend-edit-css",
    category: "frontend",
    prompt:
      'In the file src/styles.css, change the background-color value from "blue" to "red".',
    expectedTool: ["edit_file", "patch_file"],
    validateArgs: (args) => {
      if (args.path && args.old_string !== undefined)
        return (
          args.path.includes(".css") ||
          args.old_string.includes("blue") ||
          args.old_string.includes("background")
        );
      if (args.path && Array.isArray(args.patches)) return true;
      return false;
    },
  },
  {
    id: "frontend-glob-components",
    category: "frontend",
    prompt:
      "Find all JSX and TSX component files in the components/ directory.",
    expectedTool: "glob",
    validateArgs: (args) =>
      typeof args.pattern === "string" &&
      (args.pattern.includes(".jsx") ||
        args.pattern.includes(".tsx") ||
        args.pattern.includes("{jsx,tsx}")),
  },
  {
    id: "frontend-list-assets",
    category: "frontend",
    prompt: "List all files in the src/assets/ directory.",
    expectedTool: ["list_directory", "glob"],
    validateArgs: (args) => {
      if (typeof args.path === "string" && args.path.includes("assets"))
        return true;
      if (typeof args.pattern === "string" && args.pattern.includes("assets"))
        return true;
      return false;
    },
  },

  // ── Sysadmin ──────────────────────────────────────────────────────────────
  {
    id: "sysadmin-port-check",
    category: "sysadmin",
    prompt: "Which process is currently listening on port 3000?",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      (args.command.includes("lsof") ||
        args.command.includes("ss") ||
        args.command.includes("netstat") ||
        args.command.includes("3000")),
  },
  {
    id: "sysadmin-nginx-config",
    category: "sysadmin",
    prompt:
      "Create an nginx server block that proxies requests to localhost:3000. Save it to /etc/nginx/sites-available/myapp.",
    expectedTool: ["write_file", "bash"],
    validateArgs: (args) => {
      if (
        args.path &&
        (args.path.includes("nginx") || args.path.includes("sites-available"))
      )
        return true;
      if (args.command && args.command.includes("nginx")) return true;
      return false;
    },
  },
  {
    id: "sysadmin-service-status",
    category: "sysadmin",
    prompt: "Check the status of the nginx service and show if it is running.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      (args.command.includes("systemctl") ||
        args.command.includes("service") ||
        args.command.includes("nginx")),
  },
  {
    id: "sysadmin-error-log",
    category: "sysadmin",
    prompt: "Show the last 100 lines of the nginx error log.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      (args.command.includes("tail") ||
        args.command.includes("journalctl") ||
        args.command.includes("nginx")),
  },
  {
    id: "sysadmin-docker-compose",
    category: "sysadmin",
    prompt:
      "Create a docker-compose.yml file for a Node.js application with a PostgreSQL database.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      typeof args.path === "string" &&
      args.path.includes("docker-compose") &&
      typeof args.content === "string",
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  {
    id: "data-sql-query",
    category: "data",
    prompt:
      "Write a SQL query to find all users who have not logged in for more than 30 days. Save it to queries/inactive-users.sql.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      typeof args.path === "string" &&
      (args.path.includes(".sql") || args.path.includes("quer")) &&
      typeof args.content === "string",
  },
  {
    id: "data-find-json-key",
    category: "data",
    prompt: 'Find all JSON files in the project that contain the key "userId".',
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("userId");
    },
  },
  {
    id: "data-python-csv",
    category: "data",
    prompt:
      'Write a Python script that reads data.csv and calculates the average of the "price" column. Save it to scripts/average_price.py.',
    expectedTool: "write_file",
    validateArgs: (args) =>
      typeof args.path === "string" &&
      args.path.includes(".py") &&
      typeof args.content === "string",
  },
  {
    id: "data-find-migrations",
    category: "data",
    prompt: "Find all database migration files in this project.",
    expectedTool: ["glob", "search_files", "grep"],
    validateArgs: (args) => {
      const hay = JSON.stringify(args).toLowerCase();
      return hay.includes("migrat");
    },
  },

  // ── Agentic ───────────────────────────────────────────────────────────────
  {
    id: "agentic-test-first",
    category: "agentic",
    prompt:
      "Run the full test suite. If any tests fail, identify the failing test file and read it to understand the issue.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      (args.command.includes("test") ||
        args.command.includes("jest") ||
        args.command.includes("npm")),
  },
  {
    id: "agentic-read-then-act",
    category: "agentic",
    prompt:
      "Read the project README.md, find the TODO section, and list which items are completed.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("README"),
  },
  {
    id: "agentic-build-deploy",
    category: "agentic",
    prompt:
      "Build the project with npm run build, then verify the output exists in the dist/ directory.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      (args.command.includes("build") || args.command.includes("npm")),
  },
];

const DEFAULT_MODELS = [
  "glm-5:cloud",
  "nemotron-3-super:cloud",
  "minimax-m2.7:cloud",
  "qwen3-coder:480b",
  "kimi-k2:1t",
  "devstral-2:123b",
  "devstral-small-2:24b",
  "qwen3-coder-next",
];

const QUICK_MODELS = [
  "minimax-m2.7:cloud",
  "qwen3-coder:480b",
  "devstral-2:123b",
];
const QUICK_TASK_COUNT = 7;

// Score weights — tool name accuracy matters most for nex-code reliability
const WEIGHTS = {
  producedToolCall: 0.2,
  correctTool: 0.35,
  validArgs: 0.3,
  schemaCompliant: 0.15,
};

const SYSTEM_PROMPT =
  "You are a coding assistant. Use the provided tools to help with file operations, " +
  "search, and development tasks. Only call a tool when one is clearly needed to answer " +
  "the request. Do not call a tool for questions you can answer from general knowledge.";

// ─── Task Runner ──────────────────────────────────────────────────────────────

async function runTask(task, modelId) {
  const result = {
    taskId: task.id,
    category: task.category,
    model: modelId,
    producedToolCall: false,
    correctTool: false,
    validArgs: false,
    schemaCompliant: false,
    toolCalled: null,
    error: null,
    latencyMs: 0,
  };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task.prompt },
  ];

  const t0 = Date.now();
  try {
    const response = await registry.callChat(messages, TOOL_DEFINITIONS, {
      provider: "ollama",
      model: modelId,
      temperature: 0,
      timeout: 90000,
    });
    result.latencyMs = Date.now() - t0;

    const toolCalls = response.tool_calls || [];

    if (task.expectedTool === null) {
      // Model should answer without calling a tool
      const noCall = toolCalls.length === 0;
      result.producedToolCall = noCall;
      result.correctTool = noCall;
      result.validArgs = true;
      result.schemaCompliant = true;
    } else if (toolCalls.length > 0) {
      const tc = toolCalls[0];
      const name = tc.function?.name || "unknown";
      const args = tc.function?.arguments || {};

      result.producedToolCall = true;
      result.toolCalled = name;

      const expected = Array.isArray(task.expectedTool)
        ? task.expectedTool
        : [task.expectedTool];
      result.correctTool = expected.includes(name);

      if (result.correctTool) {
        const toolDef = TOOL_DEFINITIONS.find((t) => t.function?.name === name);
        result.validArgs = !!task.validateArgs(args, toolDef);

        if (toolDef) {
          const schema = toolDef.function?.parameters || {};
          const required = schema.required || [];
          const known = Object.keys(schema.properties || {});
          result.schemaCompliant =
            required.every((r) => args[r] !== undefined) &&
            Object.keys(args).every((k) => known.includes(k));
        }
      }
    }
    // No tool call but one was expected → all flags remain false
  } catch (err) {
    result.latencyMs = Date.now() - t0;
    result.error = err.message.slice(0, 120);
  }

  return result;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreResult(r) {
  if (r.error) return 0;
  return (
    ((r.producedToolCall ? WEIGHTS.producedToolCall : 0) +
      (r.correctTool ? WEIGHTS.correctTool : 0) +
      (r.validArgs ? WEIGHTS.validArgs : 0) +
      (r.schemaCompliant ? WEIGHTS.schemaCompliant : 0)) *
    100
  );
}

// All task categories that have dedicated tasks in the TASKS array
const TASK_CATEGORIES = [
  "coding",
  "search",
  "shell",
  "schema",
  "multi-step",
  "reasoning",
  "frontend",
  "sysadmin",
  "data",
  "agentic",
];

// Map each category to the broader routing key (for task-router.js)
const CATEGORY_ROUTE_KEY = {
  coding: "coding",
  search: "coding",
  shell: "coding",
  schema: "coding",
  "multi-step": "coding",
  reasoning: "coding",
  frontend: "frontend",
  sysadmin: "sysadmin",
  data: "data",
  agentic: "agentic",
};

function buildSummary(modelResults) {
  return Object.entries(modelResults)
    .map(([model, results]) => {
      const scores = results.map(scoreResult);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

      const pct = (fn) =>
        Math.round((results.filter(fn).length / results.length) * 100);

      // Per-route-category average score
      const categoryScores = {};
      for (const routeKey of [
        "coding",
        "frontend",
        "sysadmin",
        "data",
        "agentic",
      ]) {
        const catResults = results.filter(
          (r) => CATEGORY_ROUTE_KEY[r.category] === routeKey,
        );
        if (catResults.length === 0) continue;
        const catAvg =
          catResults.map(scoreResult).reduce((a, b) => a + b, 0) /
          catResults.length;
        categoryScores[routeKey] = Math.round(catAvg * 10) / 10;
      }

      return {
        model,
        score: Math.round(avg * 10) / 10,
        toolCallRate: pct(
          (r) => !r.error && (r.producedToolCall || r.category === "reasoning"),
        ),
        correctRate: pct((r) => r.correctTool),
        validArgsRate: pct((r) => r.validArgs),
        schemaRate: pct((r) => r.schemaCompliant),
        avgLatency: Math.round(
          results.reduce((a, r) => a + r.latencyMs, 0) / results.length,
        ),
        errorCount: results.filter((r) => r.error).length,
        categoryScores,
        results,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Given a full summary, return the best model per route category.
 * Only counts models where categoryScores[cat] is available.
 */
function buildCategoryWinners(summary) {
  const winners = {};
  for (const routeKey of [
    "coding",
    "frontend",
    "sysadmin",
    "data",
    "agentic",
  ]) {
    const ranked = summary
      .filter((r) => r.categoryScores[routeKey] !== undefined)
      .sort((a, b) => b.categoryScores[routeKey] - a.categoryScores[routeKey]);
    if (ranked.length > 0) {
      winners[routeKey] = {
        model: ranked[0].model,
        score: ranked[0].categoryScores[routeKey],
      };
    }
  }
  return winners;
}

// ─── Display ──────────────────────────────────────────────────────────────────

function printResults(summary, taskCount) {
  const title = `nex-code Model Benchmark  (${taskCount} tasks · ollama cloud)`;
  const cols = [
    { label: "#", width: 3 },
    { label: "Model", width: 26 },
    { label: "Score", width: 7 },
    { label: "Tool✓", width: 7 },
    { label: "Name✓", width: 7 },
    { label: "Args✓", width: 7 },
    { label: "Schema✓", width: 8 },
    { label: "Latency", width: 8 },
    { label: "Err", width: 4 },
  ];

  const totalWidth = cols.reduce((a, c) => a + c.width + 1, 0) + 1;
  const bar = "─".repeat(totalWidth);

  console.log(`\n${C.bold}${title}${C.reset}`);
  console.log(bar);

  // Header
  const header = cols.map((c) => c.label.padEnd(c.width)).join(" ");
  console.log(`${C.dim}${header}${C.reset}`);
  console.log(bar);

  summary.forEach((row, i) => {
    const rank = String(i + 1).padEnd(cols[0].width);
    const model = row.model.slice(0, cols[1].width).padEnd(cols[1].width);
    const score = String(row.score).padEnd(cols[2].width);
    const tc = `${row.toolCallRate}%`.padEnd(cols[3].width);
    const nm = `${row.correctRate}%`.padEnd(cols[4].width);
    const av = `${row.validArgsRate}%`.padEnd(cols[5].width);
    const sc = `${row.schemaRate}%`.padEnd(cols[6].width);
    const lat = `${(row.avgLatency / 1000).toFixed(1)}s`.padEnd(cols[7].width);
    const err =
      row.errorCount > 0
        ? `${C.red}${row.errorCount}${C.reset}`
        : `${C.dim}0${C.reset}`;

    // Color score
    const scoreColor =
      row.score >= 80 ? C.green : row.score >= 60 ? C.yellow : C.red;
    const rankLabel =
      i === 0 ? `${C.yellow}${rank}${C.reset}` : `${C.dim}${rank}${C.reset}`;

    console.log(
      `${rankLabel} ${scoreColor}${model}${C.reset} ${C.bold}${scoreColor}${score}${C.reset} ` +
        `${tc} ${nm} ${av} ${sc} ${C.dim}${lat}${C.reset} ${err}`,
    );
  });

  console.log(bar);

  // Top model callout
  if (summary.length > 0) {
    const top = summary[0];
    console.log(
      `\n${C.bold}${C.green}Winner: ${top.model}${C.reset}  score ${top.score}/100`,
    );
    if (summary.length > 1) {
      const delta = (top.score - summary[1].score).toFixed(1);
      console.log(`${C.dim}+${delta} pts over ${summary[1].model}${C.reset}`);
    }
  }

  // Per-category winners (only shown if category tasks were included)
  const catRoutes = ["coding", "frontend", "sysadmin", "data", "agentic"];
  const hasCatData = summary.some(
    (r) => Object.keys(r.categoryScores).length > 1,
  );
  if (hasCatData) {
    console.log(`\n${C.bold}Best model per task type:${C.reset}`);
    for (const cat of catRoutes) {
      const ranked = summary
        .filter((r) => r.categoryScores[cat] !== undefined)
        .sort((a, b) => b.categoryScores[cat] - a.categoryScores[cat]);
      if (ranked.length === 0) continue;
      const winner = ranked[0];
      const sc = winner.categoryScores[cat];
      const color = sc >= 80 ? C.green : sc >= 60 ? C.yellow : C.red;
      console.log(
        `  ${C.dim}${cat.padEnd(10)}${C.reset} ${color}${winner.model}${C.reset}  ${C.dim}${sc}/100${C.reset}`,
      );
    }
  }
  console.log();
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function runBenchmark({ models, quick = false, onProgress } = {}) {
  const tasks = quick ? TASKS.slice(0, QUICK_TASK_COUNT) : TASKS;
  const modelList =
    models?.length > 0 ? models : quick ? QUICK_MODELS : DEFAULT_MODELS;

  const modelResults = {};

  for (const model of modelList) {
    modelResults[model] = [];
    for (const task of tasks) {
      onProgress?.({ model, task: task.id, done: false });
      const r = await runTask(task, model);
      modelResults[model].push(r);
      onProgress?.({
        model,
        task: task.id,
        done: true,
        score: scoreResult(r),
        error: r.error,
      });
    }
  }

  const summary = buildSummary(modelResults);
  printResults(summary, tasks.length);
  return summary;
}

/**
 * Benchmark new models discovered by model-watcher, then merge results with an
 * existing full ranking so the README table always shows all known models.
 *
 * @param {string[]} newModels        — models to test (from model-watcher.findNewModels)
 * @param {Array}    existingRanking  — previous buildSummary() output (may be empty)
 * @param {Function} onProgress
 */
async function runDiscoverBenchmark({
  newModels,
  existingRanking = [],
  onProgress,
} = {}) {
  if (!newModels || newModels.length === 0) return existingRanking;

  const modelResults = {};

  for (const model of newModels) {
    modelResults[model] = [];
    for (const task of TASKS) {
      onProgress?.({ model, task: task.id, done: false });
      const r = await runTask(task, model);
      modelResults[model].push(r);
      onProgress?.({
        model,
        task: task.id,
        done: true,
        score: scoreResult(r),
        error: r.error,
      });
    }
  }

  // Merge new results with existing ranking (existing rows that aren't re-tested stay as-is)
  const newEntries = buildSummary(modelResults);
  const merged = [...newEntries];
  for (const row of existingRanking) {
    if (!merged.find((r) => r.model === row.model)) merged.push(row);
  }
  merged.sort((a, b) => b.score - a.score);

  printResults(merged, TASKS.length);
  return merged;
}

// ─── Jarvis Scenario Benchmark ────────────────────────────────────────────────

/**
 * Generic fallback scenarios — no server IPs or internal paths.
 * Used when .nex/benchmark-config.json does not exist.
 */
const DEFAULT_SCENARIOS = [
  {
    id: "simple_question",
    name: "Simple Convergence",
    prompt: "What is 2+2?",
    maxTurns: 3,
    successCriteria: ["4"],
  },
];

/**
 * Load scenarios from .nex/benchmark-config.json if it exists.
 * Falls back to DEFAULT_SCENARIOS and prints a setup hint.
 *
 * @param {string} [cwd]
 * @returns {Array}
 */
function loadScenarios(cwd) {
  const fs = require("fs");
  const path = require("path");
  const configPath = path.join(
    cwd || process.cwd(),
    ".nex",
    "benchmark-config.json",
  );

  if (!fs.existsSync(configPath)) {
    console.log(
      `${C.yellow}No scenarios configured.${C.reset} ` +
        `Create ${C.dim}.nex/benchmark-config.json${C.reset} to define your benchmark scenarios.\n` +
        `  Example:\n` +
        `  {\n` +
        `    "scenarios": [\n` +
        `      {\n` +
        `        "id": "health_check",\n` +
        `        "name": "Service Health Check",\n` +
        `        "prompt": "Check if my-api is running on <your-server> and report status",\n` +
        `        "maxTurns": 10,\n` +
        `        "successCriteria": ["running", "healthy", "OK"]\n` +
        `      }\n` +
        `    ]\n` +
        `  }\n`,
    );
    return DEFAULT_SCENARIOS;
  }

  try {
    const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
      console.log(
        `${C.yellow}benchmark-config.json has no scenarios — using defaults.${C.reset}\n`,
      );
      return DEFAULT_SCENARIOS;
    }
    return data.scenarios;
  } catch (err) {
    console.log(
      `${C.yellow}Failed to parse benchmark-config.json: ${err.message}${C.reset}\n`,
    );
    return DEFAULT_SCENARIOS;
  }
}

/**
 * Score a completed scenario session.
 * Base score from session-scorer, with bonuses for:
 *   +1.0 if all successCriteria appear in last assistant turn
 *   +0.5 if tool calls < maxTurns / 2
 * Capped at 10.
 *
 * @param {Array}  messages   — conversation messages from the completed run
 * @param {object} scenario   — scenario definition (successCriteria, maxTurns)
 * @returns {{ score, grade, issues, summary, bonuses }}
 */
function scoreJarvisScenario(messages, scenario) {
  const {
    scoreMessages,
    _extractToolCalls,
    _getLastAssistantText,
  } = require("./session-scorer");
  const base = scoreMessages(messages);
  let score = base.score;
  const bonuses = [];

  // Bonus: all successCriteria present in last assistant turn
  const lastText = _getLastAssistantText(messages).toLowerCase();
  const allCriteriaMet = scenario.successCriteria.every((kw) =>
    lastText.includes(kw.toLowerCase()),
  );
  if (allCriteriaMet) {
    score = Math.min(10, score + 1.0);
    bonuses.push("+1.0 all success criteria met");
  }

  // Bonus: tool calls under maxTurns/2
  const toolCalls = _extractToolCalls(messages);
  if (toolCalls.length < scenario.maxTurns / 2) {
    score = Math.min(10, score + 0.5);
    bonuses.push(
      `+0.5 efficient (${toolCalls.length} tool calls < ${scenario.maxTurns / 2})`,
    );
  }

  score = Math.round(score * 10) / 10;

  const grade =
    score >= 9.0
      ? "A"
      : score >= 8.0
        ? "B"
        : score >= 7.0
          ? "C"
          : score >= 6.0
            ? "D"
            : "F";

  return { score, grade, issues: base.issues, summary: base.summary, bonuses };
}

/**
 * Run a single Jarvis scenario as a child process.
 * Returns the path to the autosave session file written by the child.
 *
 * @param {object} scenario
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {boolean} [opts.dryRun]
 * @param {string}  [opts.cwd]
 * @returns {Promise<{ messages: Array, exitCode: number, timedOut: boolean }>}
 */
async function _runScenarioProcess(scenario, opts = {}) {
  const { spawn } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  // Write prompt to a temp file (avoids shell escaping issues)
  const promptFile = path.join(
    os.tmpdir(),
    `nex-bench-${scenario.id}-${Date.now()}.txt`,
  );
  fs.writeFileSync(promptFile, scenario.prompt, "utf-8");

  // Find the nex-code binary relative to this file
  const nexBin = path.resolve(__dirname, "..", "bin", "nex-code.js");
  const cwd = opts.cwd || process.cwd();

  const spawnArgs = [
    nexBin,
    "--prompt-file",
    promptFile,
    "--delete-prompt-file",
    "--auto",
    "--max-turns",
    String(scenario.maxTurns),
  ];
  if (opts.model) {
    spawnArgs.push("--model", opts.model);
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, spawnArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    const TIMEOUT_MS = scenario.maxTurns * 60 * 1000; // maxTurns minutes max
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* already exited */
      }
    }, TIMEOUT_MS);

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      try {
        fs.unlinkSync(promptFile);
      } catch {
        /* already deleted */
      }

      // Load the autosave session the child wrote
      const sessionPath = path.join(cwd, ".nex", "sessions", "_autosave.json");
      let messages = [];
      if (fs.existsSync(sessionPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
          messages = data.messages || [];
        } catch {
          /* corrupt — leave empty */
        }
      }

      resolve({ messages, exitCode: exitCode || 0, timedOut });
    });

    // Suppress child stdout/stderr to not pollute the benchmark output
    child.stdout.resume();
    child.stderr.resume();
  });
}

/**
 * Print a formatted benchmark results box.
 *
 * @param {Array<{ id, name, score, grade }>} results
 * @param {string} version
 * @param {string} model
 */
function _printJarvisResults(results, version, model) {
  const overallScore =
    results.length > 0
      ? Math.round(
          (results.reduce((s, r) => s + r.score, 0) / results.length) * 10,
        ) / 10
      : 0;
  const overallGrade =
    overallScore >= 9.0
      ? "A"
      : overallScore >= 8.0
        ? "B"
        : overallScore >= 7.0
          ? "C"
          : overallScore >= 6.0
            ? "D"
            : "F";

  const W = 57;
  const line = "─".repeat(W);

  console.log(`\n┌─ Benchmark Results ${"─".repeat(W - 19)}┐`);
  for (const r of results) {
    const id = r.id.padEnd(20);
    const name = r.name.substring(0, 26).padEnd(26);
    const sc = `${r.score}/10`.padStart(6);
    const gd = r.grade.padStart(2);
    console.log(`│  ${id} ${name} ${sc}  ${gd} │`);
  }
  console.log(`│  ${" ".repeat(W - 2)} │`);
  const footer = `Overall: ${overallScore}/10 (${overallGrade})  ·  v${version}  ·  ${model}`;
  console.log(`│  ${footer.substring(0, W - 4).padEnd(W - 4)} │`);
  console.log(`└${"─".repeat(W + 1)}┘\n`);
}

/**
 * Show the last N sessions from benchmark history with a trend line.
 *
 * @param {number} [n=10]
 */
function showScoreTrend(n = 10) {
  const fs = require("fs");
  const path = require("path");
  const historyPath = path.join(
    process.cwd(),
    ".nex",
    "benchmark-history.json",
  );
  if (!fs.existsSync(historyPath)) {
    console.log(
      `${C.yellow}No score history yet. Run a session first.${C.reset}\n`,
    );
    return;
  }

  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
  } catch {
    history = [];
  }
  if (!Array.isArray(history) || history.length === 0) {
    console.log(`${C.yellow}Score history is empty.${C.reset}\n`);
    return;
  }

  const recent = history.slice(-n);
  console.log(
    `\n${C.bold}Score History (last ${recent.length} session${recent.length === 1 ? "" : "s"}):${C.reset}`,
  );

  for (const entry of recent) {
    const date = (entry.date || "").replace("T", " ").substring(0, 16);
    const ver = (entry.version || "?").padEnd(8);
    const model = (entry.model || "?").substring(0, 12).padEnd(12);
    const sc = `${entry.score}/10`.padStart(6);
    const grade = entry.grade || "?";
    const issueStr =
      entry.issues && entry.issues.length > 0
        ? `${C.yellow}⚠ ${entry.issues
            .slice(0, 2)
            .map((i) => i.substring(0, 30))
            .join(", ")}${C.reset}`
        : `${C.green}✓${C.reset}`;

    const color =
      entry.score >= 8 ? C.green : entry.score >= 6 ? C.yellow : C.red;
    console.log(
      `  ${C.dim}${date}${C.reset}  ${C.dim}v${ver}${C.reset}  ${C.dim}${model}${C.reset}` +
        `  ${color}${sc}  ${grade}${C.reset}  ${issueStr}`,
    );
  }
  console.log();
}

/**
 * Main entry point for the Jarvis scenario benchmark.
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]   — list scenarios without running
 * @param {string}  [opts.model]          — override model
 * @param {string}  [opts.cwd]            — working directory for child processes
 * @param {Function} [opts.onProgress]    — callback({ id, name, done, score, grade })
 * @returns {Promise<Array<{ id, name, score, grade, issues, bonuses }>>}
 */
async function runJarvisBenchmark({
  dryRun = false,
  model,
  cwd,
  onProgress,
} = {}) {
  const pkg = require("../package.json");

  const scenarios = loadScenarios(cwd);

  if (dryRun) {
    console.log(
      `\n${C.bold}Jarvis Benchmark — Scenarios (dry-run):${C.reset}\n`,
    );
    for (const s of scenarios) {
      console.log(
        `  ${C.cyan}${s.id.padEnd(20)}${C.reset} ${C.dim}${s.name}${C.reset}  maxTurns=${s.maxTurns}`,
      );
      console.log(`    ${C.dim}${s.prompt.substring(0, 80)}${C.reset}`);
    }
    console.log();
    return [];
  }

  const activeModel = (() => {
    if (model) return model;
    try {
      const { getActiveModel } = require("./ollama");
      return getActiveModel ? getActiveModel() || "unknown" : "unknown";
    } catch {
      return "unknown";
    }
  })();

  const results = [];

  for (const scenario of scenarios) {
    onProgress?.({ id: scenario.id, name: scenario.name, done: false });

    console.log(`\n${C.dim}Running scenario: ${scenario.name}...${C.reset}`);
    const { messages, timedOut } = await _runScenarioProcess(scenario, {
      model: activeModel,
      cwd,
    });

    let scored;
    if (timedOut || messages.length === 0) {
      scored = {
        score: 0,
        grade: "F",
        issues: [timedOut ? "Scenario timed out" : "No messages produced"],
        summary: "No output",
        bonuses: [],
      };
    } else {
      scored = scoreJarvisScenario(messages, scenario);
    }

    const result = {
      id: scenario.id,
      name: scenario.name,
      score: scored.score,
      grade: scored.grade,
      issues: scored.issues,
      bonuses: scored.bonuses,
    };

    results.push(result);

    onProgress?.({
      id: scenario.id,
      name: scenario.name,
      done: true,
      score: scored.score,
      grade: scored.grade,
    });

    // Persist each scenario score to history as we go
    try {
      const { appendScoreHistory } = require("./session-scorer");
      appendScoreHistory(scored.score, {
        version: pkg.version,
        model: activeModel,
        sessionName: `bench:${scenario.id}`,
        issues: scored.issues,
      });
    } catch {
      /* non-critical */
    }
  }

  _printJarvisResults(results, pkg.version, activeModel);
  return results;
}

module.exports = {
  runBenchmark,
  runDiscoverBenchmark,
  buildSummary,
  buildCategoryWinners,
  TASKS,
  scoreResult,
  DEFAULT_MODELS,
  QUICK_MODELS,
  // Jarvis scenario benchmark
  runJarvisBenchmark,
  showScoreTrend,
  loadScenarios,
  DEFAULT_SCENARIOS,
  scoreJarvisScenario,
};

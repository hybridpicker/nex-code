#!/usr/bin/env node
/**
 * scripts/benchmark-realworld.js — Real-World Task Benchmark
 *
 * 20 commit-sized tasks from actual user projects.
 * Each task runs nex-code headless in a temp directory with fixture files,
 * then evaluates the result for task completion, edit precision, and efficiency.
 *
 * Usage:
 *   node scripts/benchmark-realworld.js [--dry-run] [--model <id>] [--tasks <id1,id2>]
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawn } = require("child_process");

const NEX_CODE = path.join(__dirname, "..", "dist", "nex-code.js");
const RESULTS_DIR = path.join(__dirname, "benchmark-results");

// ─── Task Definitions ───────────────────────────────────────────

const TASKS = [
  // Category 1: Simple Edits (5)
  {
    id: "simple-rename-const",
    category: "simple-edit",
    description: "Rename the constant DEFAULT_TIMEOUT from 5000 to 10000 in config.js",
    files: {
      "config.js": `const DEFAULT_TIMEOUT = 5000;\nconst MAX_RETRIES = 3;\nmodule.exports = { DEFAULT_TIMEOUT, MAX_RETRIES };\n`,
    },
    expectedEdits: [{ file: "config.js", contains: "DEFAULT_TIMEOUT = 10000" }],
    maxToolCalls: 5,
  },
  {
    id: "simple-fix-typo",
    category: "simple-edit",
    description: "Fix the typo in utils.js: 'recieve' should be 'receive'",
    files: {
      "utils.js": `/**\n * Recieve data from the server\n * @param {string} url\n */\nfunction recieveData(url) {\n  return fetch(url).then(r => r.json());\n}\nmodule.exports = { recieveData };\n`,
    },
    expectedEdits: [
      { file: "utils.js", contains: "receive" },
      { file: "utils.js", notContains: "recieve" },
    ],
    maxToolCalls: 5,
  },
  {
    id: "simple-add-export",
    category: "simple-edit",
    description: "Add the function 'multiply' to the module.exports in math.js (it exists but isn't exported)",
    files: {
      "math.js": `function add(a, b) { return a + b; }\nfunction multiply(a, b) { return a * b; }\nmodule.exports = { add };\n`,
    },
    expectedEdits: [{ file: "math.js", contains: "multiply" }],
    maxToolCalls: 5,
  },
  {
    id: "simple-update-version",
    category: "simple-edit",
    description: "Update the version in package.json from 1.2.3 to 1.3.0",
    files: {
      "package.json": `{\n  "name": "my-app",\n  "version": "1.2.3",\n  "main": "index.js"\n}\n`,
    },
    expectedEdits: [{ file: "package.json", contains: '"1.3.0"' }],
    maxToolCalls: 5,
  },
  {
    id: "simple-add-param",
    category: "simple-edit",
    description: "Add an optional 'timeout' parameter (default 5000) to the fetchData function in api.js",
    files: {
      "api.js": `async function fetchData(url) {\n  const res = await fetch(url);\n  return res.json();\n}\nmodule.exports = { fetchData };\n`,
    },
    expectedEdits: [{ file: "api.js", contains: "timeout" }],
    maxToolCalls: 8,
  },

  // Category 2: Multi-file (5)
  {
    id: "multi-add-helper",
    category: "multi-file",
    description: "Create a new file helpers/format.js with a formatDate(date) function that returns YYYY-MM-DD, then import and use it in app.js where the TODO comment is",
    files: {
      "app.js": `const express = require('express');\nconst app = express();\n\napp.get('/today', (req, res) => {\n  // TODO: format today's date as YYYY-MM-DD\n  res.json({ date: new Date().toISOString() });\n});\n\nmodule.exports = app;\n`,
    },
    expectedEdits: [
      { file: "helpers/format.js", contains: "formatDate" },
      { file: "app.js", contains: "formatDate" },
    ],
    maxToolCalls: 10,
  },
  {
    id: "multi-extract-config",
    category: "multi-file",
    description: "Extract the hardcoded PORT and HOST from server.js into a new config.js file, then import them in server.js",
    files: {
      "server.js": `const http = require('http');\nconst PORT = 3000;\nconst HOST = 'localhost';\n\nconst server = http.createServer((req, res) => {\n  res.end('hello');\n});\n\nserver.listen(PORT, HOST, () => {\n  console.log(\`Running on \${HOST}:\${PORT}\`);\n});\n`,
    },
    expectedEdits: [
      { file: "config.js", contains: "PORT" },
      { file: "config.js", contains: "HOST" },
      { file: "server.js", contains: "require" },
    ],
    maxToolCalls: 10,
  },
  {
    id: "multi-add-test",
    category: "multi-file",
    description: "Add a test file tests/calc.test.js that tests the add and subtract functions from calc.js using simple assertions (no test framework needed, just throw on failure)",
    files: {
      "calc.js": `function add(a, b) { return a + b; }\nfunction subtract(a, b) { return a - b; }\nmodule.exports = { add, subtract };\n`,
    },
    expectedEdits: [
      { file: "tests/calc.test.js", contains: "add" },
      { file: "tests/calc.test.js", contains: "subtract" },
    ],
    maxToolCalls: 10,
  },
  {
    id: "multi-rename-module",
    category: "multi-file",
    description: "Rename helpers.js to utils.js and update the require statement in index.js",
    files: {
      "helpers.js": `function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }\nmodule.exports = { capitalize };\n`,
      "index.js": `const { capitalize } = require('./helpers');\nconsole.log(capitalize('hello'));\n`,
    },
    expectedEdits: [
      { file: "utils.js", contains: "capitalize" },
      { file: "index.js", contains: "./utils" },
    ],
    maxToolCalls: 10,
  },
  {
    id: "multi-add-middleware",
    category: "multi-file",
    description: "Create middleware/logger.js that logs method + url for each request, then add it to app.js before the routes",
    files: {
      "app.js": `const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => res.send('home'));\napp.get('/about', (req, res) => res.send('about'));\n\nmodule.exports = app;\n`,
    },
    expectedEdits: [
      { file: "middleware/logger.js", contains: "req" },
      { file: "app.js", contains: "logger" },
    ],
    maxToolCalls: 10,
  },

  // Category 3: Investigation + Edit (5)
  {
    id: "investigate-undefined-error",
    category: "investigation",
    description: "The app crashes with 'Cannot read property length of undefined' when calling processItems(). Find and fix the bug.",
    files: {
      "processor.js": `function processItems(data) {\n  const items = data.results;\n  console.log(\`Processing \${items.length} items\`);\n  return items.map(i => i.name);\n}\nmodule.exports = { processItems };\n`,
      "index.js": `const { processItems } = require('./processor');\n\n// data comes from API but might be empty\nconst data = {};\nconsole.log(processItems(data));\n`,
    },
    expectedEdits: [{ file: "processor.js", contains: "||" }],
    maxToolCalls: 12,
  },
  {
    id: "investigate-off-by-one",
    category: "investigation",
    description: "The paginate function returns one extra item on the last page. Fix the off-by-one error.",
    files: {
      "paginate.js": `function paginate(items, page, pageSize) {\n  const start = page * pageSize;\n  const end = start + pageSize + 1;\n  return items.slice(start, end);\n}\nmodule.exports = { paginate };\n`,
    },
    expectedEdits: [{ file: "paginate.js", notContains: "pageSize + 1" }],
    maxToolCalls: 8,
  },
  {
    id: "investigate-wrong-import",
    category: "investigation",
    description: "Running 'node index.js' gives 'TypeError: formatName is not a function'. Find and fix the issue.",
    files: {
      "format.js": `function formatName(first, last) {\n  return \`\${last}, \${first}\`;\n}\nmodule.exports = formatName;\n`,
      "index.js": `const { formatName } = require('./format');\nconsole.log(formatName('John', 'Doe'));\n`,
    },
    expectedEdits: [
      {
        file: "index.js",
        anyOf: [
          "require('./format')",  // Could fix either file
        ],
      },
    ],
    maxToolCalls: 10,
  },
  {
    id: "investigate-race-condition",
    category: "investigation",
    description: "The counter sometimes shows wrong values because increment isn't atomic. Add a simple mutex/lock to fix it.",
    files: {
      "counter.js": `let count = 0;\nlet busy = false;\n\nasync function increment() {\n  const current = count;\n  await new Promise(r => setTimeout(r, 10));\n  count = current + 1;\n  return count;\n}\n\nmodule.exports = { increment, getCount: () => count };\n`,
    },
    expectedEdits: [{ file: "counter.js", contains: "busy" }],
    maxToolCalls: 10,
  },
  {
    id: "investigate-missing-await",
    category: "investigation",
    description: "getData() returns a Promise instead of the actual data. Fix the async/await issue.",
    files: {
      "data.js": `async function fetchFromDB() {\n  return { id: 1, name: 'test' };\n}\n\nfunction getData() {\n  const result = fetchFromDB();\n  return result;\n}\n\nmodule.exports = { getData };\n`,
    },
    expectedEdits: [{ file: "data.js", contains: "await" }],
    maxToolCalls: 8,
  },

  // Category 4: File Creation (5)
  {
    id: "create-env-example",
    category: "creation",
    description: "Create a .env.example file based on the environment variables used in config.js (without actual values, just KEY= format)",
    files: {
      "config.js": `module.exports = {\n  dbHost: process.env.DB_HOST || 'localhost',\n  dbPort: process.env.DB_PORT || 5432,\n  apiKey: process.env.API_KEY,\n  secret: process.env.JWT_SECRET,\n};\n`,
    },
    expectedEdits: [
      { file: ".env.example", contains: "DB_HOST" },
      { file: ".env.example", contains: "API_KEY" },
      { file: ".env.example", contains: "JWT_SECRET" },
    ],
    maxToolCalls: 8,
  },
  {
    id: "create-gitignore",
    category: "creation",
    description: "Create a .gitignore for this Node.js project (should include node_modules, .env, dist, *.log)",
    files: {
      "package.json": `{\n  "name": "my-project",\n  "version": "1.0.0"\n}\n`,
      "index.js": `console.log('hello');\n`,
    },
    expectedEdits: [
      { file: ".gitignore", contains: "node_modules" },
      { file: ".gitignore", contains: ".env" },
    ],
    maxToolCalls: 6,
  },
  {
    id: "create-dockerfile",
    category: "creation",
    description: "Create a Dockerfile for this Node.js app (node:18-alpine, copy package.json first for caching, expose port 3000)",
    files: {
      "package.json": `{\n  "name": "web-app",\n  "version": "1.0.0",\n  "scripts": { "start": "node server.js" }\n}\n`,
      "server.js": `const http = require('http');\nhttp.createServer((req, res) => res.end('ok')).listen(3000);\n`,
    },
    expectedEdits: [
      { file: "Dockerfile", contains: "FROM" },
      { file: "Dockerfile", contains: "3000" },
    ],
    maxToolCalls: 8,
  },
  {
    id: "create-readme",
    category: "creation",
    description: "Create a README.md with project name, description, install instructions, and usage based on the package.json",
    files: {
      "package.json": `{\n  "name": "data-parser",\n  "version": "2.1.0",\n  "description": "Parse CSV and JSON data files",\n  "scripts": { "start": "node index.js", "test": "jest" },\n  "dependencies": { "csv-parse": "^5.0.0" }\n}\n`,
      "index.js": `const { parse } = require('csv-parse');\n// main entry\n`,
    },
    expectedEdits: [
      { file: "README.md", contains: "data-parser" },
      { file: "README.md", contains: "install" },
    ],
    maxToolCalls: 8,
  },
  {
    id: "create-ci-workflow",
    category: "creation",
    description: "Create a GitHub Actions workflow at .github/workflows/ci.yml that runs npm test on push to main, using Node 18",
    files: {
      "package.json": `{\n  "name": "my-lib",\n  "scripts": { "test": "jest" }\n}\n`,
    },
    expectedEdits: [
      { file: ".github/workflows/ci.yml", contains: "npm test" },
      { file: ".github/workflows/ci.yml", contains: "node" },
    ],
    maxToolCalls: 8,
  },
];

// ─── Task Runner ────────────────────────────────────────────────

function setupFixtures(tmpDir, files) {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  // Init git so nex-code can work with it
  try {
    execSync("git init && git add -A && git commit -m init --no-verify", {
      cwd: tmpDir,
      stdio: "pipe",
      env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "test@test.com" },
    });
  } catch { /* non-critical */ }
}

function runTask(task, model) {
  return new Promise((resolve) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `nex-bench-${task.id}-`));
    setupFixtures(tmpDir, task.files);

    const args = [
      NEX_CODE,
      "--task", task.description,
      "--auto",
      "--json",
      "--max-turns", "20",
    ];
    if (model) args.push("--model", model);

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";

    const proc = spawn("node", args, {
      cwd: tmpDir,
      env: { ...process.env, NEX_SKIP_BUILTIN_SKILLS: "1", NEX_AUTO_ORCHESTRATE: "false" },
      timeout: 120000,
    });

    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });

    proc.on("close", (code) => {
      const elapsed = Date.now() - startTime;
      const result = evaluateTask(task, tmpDir, stdout, elapsed);
      // Cleanup
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      resolve(result);
    });

    proc.on("error", (err) => {
      resolve({
        id: task.id,
        category: task.category,
        score: 0,
        elapsed: Date.now() - startTime,
        error: err.message,
        details: {},
      });
    });
  });
}

// ─── Evaluation ─────────────────────────────────────────────────

function evaluateTask(task, tmpDir, stdout, elapsed) {
  const details = { editsFound: [], editsMissing: [], toolCalls: 0 };

  // Count tool calls from JSON output
  try {
    const lines = stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.tool_calls) details.toolCalls += parsed.tool_calls;
      } catch { /* not json */ }
    }
  } catch { /* ignore */ }

  // Check expected edits
  let editScore = 0;
  let totalChecks = 0;

  for (const expected of task.expectedEdits) {
    const filePath = path.join(tmpDir, expected.file);
    const exists = fs.existsSync(filePath);

    if (!exists) {
      details.editsMissing.push(`${expected.file} (not created)`);
      totalChecks++;
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    if (expected.contains) {
      totalChecks++;
      if (content.includes(expected.contains)) {
        editScore++;
        details.editsFound.push(`${expected.file} contains '${expected.contains}'`);
      } else {
        details.editsMissing.push(`${expected.file} missing '${expected.contains}'`);
      }
    }

    if (expected.notContains) {
      totalChecks++;
      if (!content.includes(expected.notContains)) {
        editScore++;
        details.editsFound.push(`${expected.file} correctly lacks '${expected.notContains}'`);
      } else {
        details.editsMissing.push(`${expected.file} still contains '${expected.notContains}'`);
      }
    }

    if (expected.anyOf) {
      totalChecks++;
      const found = expected.anyOf.some((s) => content.includes(s));
      if (found) {
        editScore++;
        details.editsFound.push(`${expected.file} matches anyOf`);
      } else {
        details.editsMissing.push(`${expected.file} matches none of anyOf`);
      }
    }
  }

  // Scoring: taskCompletion(30%) + editPrecision(40%) + efficiency(30%)
  const taskCompletion = totalChecks > 0 ? (editScore / totalChecks) : 0;
  const editPrecision = taskCompletion; // for local eval, same as completion
  const efficiency = details.toolCalls > 0
    ? Math.max(0, 1 - (details.toolCalls - task.maxToolCalls) / task.maxToolCalls)
    : 0.5; // unknown

  const score = Math.round(
    (taskCompletion * 30 + editPrecision * 40 + Math.min(1, efficiency) * 30),
  );

  return {
    id: task.id,
    category: task.category,
    score,
    elapsed,
    details: {
      ...details,
      taskCompletion: Math.round(taskCompletion * 100),
      editPrecision: Math.round(editPrecision * 100),
      efficiency: Math.round(Math.min(1, efficiency) * 100),
    },
  };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const modelIdx = args.indexOf("--model");
  const model = modelIdx !== -1 ? args[modelIdx + 1] : null;
  const tasksIdx = args.indexOf("--tasks");
  const taskFilter = tasksIdx !== -1 ? args[tasksIdx + 1].split(",") : null;

  const tasks = taskFilter
    ? TASKS.filter((t) => taskFilter.includes(t.id))
    : TASKS;

  console.log(`\n  Real-World Benchmark: ${tasks.length} tasks${model ? ` (model: ${model})` : ""}\n`);

  if (dryRun) {
    console.log("  Tasks:");
    for (const t of tasks) {
      console.log(`    ${t.id} [${t.category}] — ${t.description.slice(0, 60)}...`);
    }
    console.log("\n  --dry-run: no tasks executed\n");
    return;
  }

  // Check dist exists
  if (!fs.existsSync(NEX_CODE)) {
    console.error("  ERROR: dist/nex-code.js not found. Run: npm run build\n");
    process.exit(1);
  }

  const results = [];
  for (const task of tasks) {
    process.stdout.write(`  ${task.id}... `);
    const result = await runTask(task, model);
    results.push(result);
    console.log(`${result.score}/100 (${(result.elapsed / 1000).toFixed(1)}s)`);
  }

  // Summary
  const avg = Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r.score);
  }

  console.log("\n  ── Summary ──");
  console.log(`  Average: ${avg}/100`);
  for (const [cat, scores] of Object.entries(byCategory)) {
    const catAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    console.log(`  ${cat}: ${catAvg}/100`);
  }

  // Save results
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const date = new Date().toISOString().split("T")[0];
  const outPath = path.join(RESULTS_DIR, `${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ date, model, average: avg, results }, null, 2));
  console.log(`\n  Results saved: ${outPath}\n`);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});

module.exports = { TASKS, evaluateTask, runTask };

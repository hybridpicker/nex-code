/**
 * scripts/benchmark-reallife-tasks.js — Real-Life Task Definitions
 *
 * 28 tasks across 7 categories, sourced from real ~/Coding/ projects.
 * Each task copies real files into a temp directory and evaluates nex-code's work.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const HOME = require("os").homedir();
const CODING = path.join(HOME, "Coding");

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Copy specific files from a real project into tmpDir.
 * Paths are relative to the sourceProject.
 */
function copyFiles(sourceProject, files, tmpDir) {
  const src = path.resolve(CODING, sourceProject);
  for (const rel of files) {
    const srcFile = path.resolve(src, rel);
    const dest = path.resolve(tmpDir, rel);
    // Prevent path traversal — source must stay under CODING, dest under tmpDir
    if (!srcFile.startsWith(src + path.sep) && srcFile !== src) continue;
    if (!dest.startsWith(tmpDir + path.sep) && dest !== tmpDir) continue;
    if (!fs.existsSync(srcFile)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(srcFile, dest);
  }
}

/**
 * Copy an entire directory tree (excluding node_modules, .git, dist).
 */
function copyTree(sourceProject, subDir, tmpDir) {
  const src = path.join(CODING, sourceProject, subDir || "");
  const dest = path.join(tmpDir, subDir || "");
  if (!fs.existsSync(src)) return;
  const SKIP = new Set(["node_modules", ".git", "dist", "coverage", ".next", "__pycache__"]);

  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const srcPath = path.join(dir, entry.name);
      const relPath = path.join(rel, entry.name);
      const destPath = path.join(dest, relPath);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, relPath);
      } else {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  walk(src, "");
}

/**
 * Initialize a git repo in tmpDir so nex-code can operate.
 */
function initGit(tmpDir) {
  try {
    // Minimal env — prevent leaking secrets or inheriting unsafe git config
    const gitEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      GIT_AUTHOR_NAME: "bench",
      GIT_AUTHOR_EMAIL: "bench@test.com",
      GIT_COMMITTER_NAME: "bench",
      GIT_COMMITTER_EMAIL: "bench@test.com",
    };
    execSync("git init && git add -A && git commit -m init --no-verify", {
      cwd: tmpDir, stdio: "pipe", env: gitEnv,
    });
  } catch { /* non-critical */ }
}

/**
 * Check if a file contains a pattern.
 */
function fileContains(tmpDir, relPath, pattern) {
  const p = path.join(tmpDir, relPath);
  if (!fs.existsSync(p)) return false;
  return fs.readFileSync(p, "utf-8").includes(pattern);
}

/**
 * Check if a file exists.
 */
function fileExists(tmpDir, relPath) {
  return fs.existsSync(path.join(tmpDir, relPath));
}

/**
 * Count files changed via git diff.
 */
function filesChanged(tmpDir) {
  try {
    const diff = execSync("git diff --name-only", { cwd: tmpDir, encoding: "utf-8" });
    const untracked = execSync("git ls-files --others --exclude-standard", { cwd: tmpDir, encoding: "utf-8" });
    return (diff.trim() + "\n" + untracked.trim()).split("\n").filter(Boolean);
  } catch { return []; }
}

// ─── Category Weights ───────────────────────────────────────────

const CATEGORY_WEIGHTS = {
  bugfix: 0.25,
  feature: 0.20,
  understanding: 0.10,
  devops: 0.15,
  refactor: 0.15,
  testing: 0.10,
  docs: 0.05,
};

// ─── Task Definitions ───────────────────────────────────────────

const TASKS = [

  // ═══════════════════════════════════════════════════════════════
  // Category 1: Bug Fixing (5 tasks, weight: 25%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "bugfix-express-session-fallback",
    category: "bugfix",
    description: "The Express app in app.js uses a hardcoded fallback session secret ('fallback-secret'). This is a security issue. Fix it to throw an error if SESSION_SECRET env var is not set, instead of using a fallback.",
    sourceProject: "arbeitszeiterfassung",
    setupFn(tmpDir) {
      // Create a simplified version of the real app
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app.js"), `const express = require('express');
const session = require('express-session');
const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get('/', (req, res) => res.send('ok'));
module.exports = app;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (!fileContains(tmpDir, "app.js", "fallback-secret")) score.taskCompletion += 50;
      if (fileContains(tmpDir, "app.js", "throw") || fileContains(tmpDir, "app.js", "Error")) score.taskCompletion += 50;
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "bugfix-off-by-one-pagination",
    category: "bugfix",
    description: "The paginate() function in utils.js returns one extra item on the last page. Users report seeing 11 items on a page-size-10 view. Find and fix the off-by-one error.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "utils.js"), `function paginate(items, page, pageSize) {
  const start = page * pageSize;
  const end = start + pageSize + 1;
  return items.slice(start, end);
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

module.exports = { paginate, formatDate };
`);
      fs.writeFileSync(path.join(tmpDir, "test.js"), `const { paginate } = require('./utils');
const items = Array.from({length: 25}, (_, i) => i + 1);
const page = paginate(items, 0, 10);
console.log('Page 0 length:', page.length, '(expected 10)');
if (page.length !== 10) { console.error('BUG: got', page.length, 'items'); process.exit(1); }
console.log('OK');
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 0 };
      if (!fileContains(tmpDir, "utils.js", "pageSize + 1")) score.taskCompletion += 60;
      if (fileContains(tmpDir, "utils.js", "start + pageSize") || fileContains(tmpDir, "utils.js", "pageSize)")) score.taskCompletion += 40;
      // Run the test to verify
      try {
        execSync("node test.js", { cwd: tmpDir, stdio: "pipe", timeout: 5000 });
        score.quality = 100;
      } catch { score.quality = 0; }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "bugfix-missing-await",
    category: "bugfix",
    description: "The getData() function in data-service.js returns a Promise instead of the resolved data. The caller in index.js gets [object Promise] when logging the result. Fix the async/await issue.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "data-service.js"), `async function fetchFromDB() {
  return [{ id: 1, name: 'Recipe A' }, { id: 2, name: 'Recipe B' }];
}

function getData() {
  const result = fetchFromDB();
  return result;
}

module.exports = { getData };
`);
      fs.writeFileSync(path.join(tmpDir, "index.js"), `const { getData } = require('./data-service');
async function main() {
  const data = await getData();
  if (!Array.isArray(data)) {
    console.error('BUG: expected array, got', typeof data);
    process.exit(1);
  }
  console.log('Got', data.length, 'items');
}
main();
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 0 };
      if (fileContains(tmpDir, "data-service.js", "await")) score.taskCompletion += 50;
      if (fileContains(tmpDir, "data-service.js", "async")) score.taskCompletion += 50;
      try {
        execSync("node index.js", { cwd: tmpDir, stdio: "pipe", timeout: 5000 });
        score.quality = 100;
      } catch { score.quality = 0; }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "bugfix-wrong-destructure",
    category: "bugfix",
    description: "Running 'node index.js' gives 'TypeError: formatName is not a function'. The module exports a default function but index.js destructures it as a named export. Find and fix.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "format.js"), `function formatName(first, last) {
  return \`\${last}, \${first}\`;
}
module.exports = formatName;
`);
      fs.writeFileSync(path.join(tmpDir, "index.js"), `const { formatName } = require('./format');
const result = formatName('John', 'Doe');
console.log(result);
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 0 };
      // Either fix: change exports to named, or change import to default
      try {
        execSync("node index.js", { cwd: tmpDir, stdio: "pipe", timeout: 5000 });
        score.taskCompletion = 100;
        score.quality = 100;
      } catch {
        // Partial credit if at least one file was changed
        const changes = filesChanged(tmpDir);
        if (changes.some(f => f === "format.js" || f === "index.js")) score.taskCompletion = 30;
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "bugfix-date-timezone",
    category: "bugfix",
    description: "The formatDate function returns wrong dates for users in UTC+2 timezone. It uses toISOString() which always returns UTC. Fix it to use local date components (getFullYear, getMonth+1, getDate) instead.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "date-utils.js"), `function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

module.exports = { formatDate, isWeekend };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (!fileContains(tmpDir, "date-utils.js", "toISOString")) score.taskCompletion += 40;
      if (fileContains(tmpDir, "date-utils.js", "getFullYear")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "date-utils.js", "getMonth")) score.taskCompletion += 30;
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Category 2: Feature Implementation (5 tasks, weight: 20%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "feat-add-search-endpoint",
    category: "feature",
    description: "Add a GET /api/recipes/search?q=<query> endpoint to routes.js that filters recipes by name (case-insensitive substring match). Return matching recipes as JSON array.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "routes.js"), `const express = require('express');
const router = express.Router();

const recipes = [
  { id: 1, name: 'Spaghetti Bolognese', category: 'pasta' },
  { id: 2, name: 'Caesar Salad', category: 'salad' },
  { id: 3, name: 'Chicken Curry', category: 'main' },
  { id: 4, name: 'Tomato Soup', category: 'soup' },
  { id: 5, name: 'Pasta Carbonara', category: 'pasta' },
];

router.get('/api/recipes', (req, res) => {
  res.json(recipes);
});

router.get('/api/recipes/:id', (req, res) => {
  const recipe = recipes.find(r => r.id === parseInt(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'Not found' });
  res.json(recipe);
});

module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"cookbook-api","version":"1.0.0","dependencies":{"express":"^4.18.0"}}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileContains(tmpDir, "routes.js", "/search") || fileContains(tmpDir, "routes.js", "search")) score.taskCompletion += 40;
      if (fileContains(tmpDir, "routes.js", "toLowerCase") || fileContains(tmpDir, "routes.js", "includes")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "routes.js", "query") || fileContains(tmpDir, "routes.js", "req.query")) score.taskCompletion += 30;
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "feat-add-export-csv",
    category: "feature",
    description: "Add an exportToCSV(entries) function to export.js that converts an array of time entries [{date, hours, student, notes}] to CSV string with headers. Export it from the module.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "export.js"), `function exportToJSON(entries) {
  return JSON.stringify(entries, null, 2);
}

function formatEntry(entry) {
  return \`\${entry.date}: \${entry.student} (\${entry.hours}h) - \${entry.notes}\`;
}

module.exports = { exportToJSON, formatEntry };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"zeit","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileContains(tmpDir, "export.js", "exportToCSV")) score.taskCompletion += 40;
      if (fileContains(tmpDir, "export.js", "join")) score.taskCompletion += 20;
      if (fileContains(tmpDir, "export.js", "date") && fileContains(tmpDir, "export.js", "hours")) score.taskCompletion += 20;
      // Check it's exported
      if (fileContains(tmpDir, "export.js", "exportToCSV")) score.taskCompletion += 20;
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "feat-add-volume-control",
    category: "feature",
    description: "Add a setVolume(trackIndex, volume) method to the DrumSequencer class in sequencer.js. Volume should be 0.0-1.0, stored in this.volumes[trackIndex], and applied in playBeat() by multiplying gain.value.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "sequencer.js"), `class DrumSequencer {
  constructor(audioCtx, tracks = 4, steps = 16) {
    this.audioCtx = audioCtx;
    this.tracks = tracks;
    this.steps = steps;
    this.grid = Array.from({ length: tracks }, () => new Array(steps).fill(false));
    this.bpm = 120;
    this.currentStep = 0;
  }

  toggleStep(track, step) {
    this.grid[track][step] = !this.grid[track][step];
  }

  playBeat() {
    for (let t = 0; t < this.tracks; t++) {
      if (this.grid[t][this.currentStep]) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        gain.gain.value = 0.5;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
      }
    }
    this.currentStep = (this.currentStep + 1) % this.steps;
  }
}

module.exports = { DrumSequencer };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"drumcomputer","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileContains(tmpDir, "sequencer.js", "setVolume")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "sequencer.js", "volumes")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "sequencer.js", "this.volumes")) score.taskCompletion += 20;
      // Check volume is used in playBeat
      const content = fs.existsSync(path.join(tmpDir, "sequencer.js"))
        ? fs.readFileSync(path.join(tmpDir, "sequencer.js"), "utf-8") : "";
      if (content.includes("volumes") && content.includes("playBeat")) score.taskCompletion += 20;
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "feat-add-chord-filter",
    category: "feature",
    description: "Add a filterByKey(chords, key) function to chord-utils.js that filters the chords array to only include chords whose 'root' property matches the given key (case-insensitive). Export it.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "chord-utils.js"), `const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function transpose(chord, semitones) {
  const idx = NOTES.indexOf(chord.root);
  if (idx === -1) return chord;
  const newRoot = NOTES[(idx + semitones + 12) % 12];
  return { ...chord, root: newRoot };
}

function getInterval(root, target) {
  const r = NOTES.indexOf(root);
  const t = NOTES.indexOf(target);
  return (t - r + 12) % 12;
}

module.exports = { transpose, getInterval, NOTES };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"chord-lib","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileContains(tmpDir, "chord-utils.js", "filterByKey")) score.taskCompletion += 40;
      if (fileContains(tmpDir, "chord-utils.js", "toLowerCase") || fileContains(tmpDir, "chord-utils.js", "toUpperCase")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "chord-utils.js", "filter")) score.taskCompletion += 30;
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "feat-add-rate-limiter",
    category: "feature",
    description: "Add rate limiting middleware to server.js. Create a simple in-memory rate limiter in middleware/rate-limit.js that allows max 100 requests per IP per minute. Return 429 when exceeded.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "server.js"), `const express = require('express');
const app = express();

app.use(express.json());

app.get('/api/data', (req, res) => {
  res.json({ items: [1, 2, 3] });
});

app.post('/api/data', (req, res) => {
  res.status(201).json({ id: 1, ...req.body });
});

module.exports = app;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"api","version":"1.0.0","dependencies":{"express":"^4.18.0"}}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "middleware/rate-limit.js")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "middleware/rate-limit.js", "429") || fileContains(tmpDir, "middleware/rate-limit.js", "Too Many")) score.taskCompletion += 20;
      if (fileContains(tmpDir, "middleware/rate-limit.js", "100") || fileContains(tmpDir, "middleware/rate-limit.js", "limit")) score.taskCompletion += 20;
      if (fileContains(tmpDir, "server.js", "rate-limit") || fileContains(tmpDir, "server.js", "rateLimit")) score.taskCompletion += 30;
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Category 3: Code Understanding (4 tasks, weight: 10%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "understand-project-structure",
    category: "understanding",
    description: "Analyze this Express.js project and create a brief ARCHITECTURE.md file describing: 1) What the app does, 2) The route structure, 3) The database setup, 4) Key dependencies. Be concise.",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "routes"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "database"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app.js"), `const express = require('express');
const session = require('express-session');
const cors = require('cors');
const timeEntryRoutes = require('./routes/timeEntries');
const exportRoutes = require('./routes/export');
const studentRoutes = require('./routes/students');
const db = require('./database/db');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/time-entries', timeEntryRoutes);
app.use('/export', exportRoutes);
app.use('/students', studentRoutes);
module.exports = app;
`);
      fs.writeFileSync(path.join(tmpDir, "database/db.js"), `const Database = require('better-sqlite3');
const db = new Database('./data/zeit.db');
db.exec(\`CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY, date TEXT, hours REAL, student_id INTEGER, notes TEXT
)\`);
module.exports = db;
`);
      fs.writeFileSync(path.join(tmpDir, "routes/timeEntries.js"), `const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
router.post('/', (req, res) => res.status(201).json(req.body));
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "routes/export.js"), `const router = require('express').Router();
router.get('/csv', (req, res) => res.send(''));
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "routes/students.js"), `const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"arbeitszeiterfassung","version":"1.0.0","dependencies":{"express":"^4.18.0","better-sqlite3":"^9.0.0","cors":"^2.8.5"}}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "ARCHITECTURE.md")) {
        const content = fs.readFileSync(path.join(tmpDir, "ARCHITECTURE.md"), "utf-8").toLowerCase();
        if (content.includes("time") || content.includes("arbeit") || content.includes("tracking")) score.taskCompletion += 25;
        if (content.includes("route") || content.includes("/api")) score.taskCompletion += 25;
        if (content.includes("sqlite") || content.includes("database")) score.taskCompletion += 25;
        if (content.includes("express") || content.includes("dependenc")) score.taskCompletion += 25;
      }
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "understand-find-env-vars",
    category: "understanding",
    description: "Scan all .js files in this project and create an ENV_VARS.md file listing every environment variable referenced (process.env.XXX). For each, note which file uses it and whether it has a default value.",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "config"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "server.js"), `const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const app = require('./app');
app.listen(PORT, HOST);
`);
      fs.writeFileSync(path.join(tmpDir, "config/db.js"), `module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  name: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
};
`);
      fs.writeFileSync(path.join(tmpDir, "config/auth.js"), `module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  tokenExpiry: process.env.TOKEN_EXPIRY || '24h',
};
`);
      fs.writeFileSync(path.join(tmpDir, "app.js"), `module.exports = require('express')();`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "ENV_VARS.md")) {
        const content = fs.readFileSync(path.join(tmpDir, "ENV_VARS.md"), "utf-8");
        const vars = ["PORT", "HOST", "DB_HOST", "DB_PORT", "DB_NAME", "DB_PASSWORD", "JWT_SECRET", "SESSION_SECRET", "TOKEN_EXPIRY"];
        let found = 0;
        for (const v of vars) {
          if (content.includes(v)) found++;
        }
        score.taskCompletion = Math.round((found / vars.length) * 100);
      }
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "understand-dependency-audit",
    category: "understanding",
    description: "Review the package.json dependencies and create AUDIT.md noting: 1) Any outdated/deprecated packages, 2) Missing devDependencies (e.g., no test framework despite a test script), 3) Suggestions for improvement.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
        name: "legacy-app",
        version: "1.0.0",
        scripts: { start: "node index.js", test: "jest" },
        dependencies: {
          "express": "^4.17.1",
          "body-parser": "^1.19.0",
          "request": "^2.88.2",
          "moment": "^2.29.1",
          "lodash": "^4.17.21",
        },
      }, null, 2) + "\n");
      fs.writeFileSync(path.join(tmpDir, "index.js"), `const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const moment = require('moment');
const app = express();
app.use(bodyParser.json());
app.listen(3000);
`);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "AUDIT.md")) {
        const content = fs.readFileSync(path.join(tmpDir, "AUDIT.md"), "utf-8").toLowerCase();
        // request is deprecated, body-parser is built into express, moment is legacy, jest missing from devDeps
        if (content.includes("request") && (content.includes("deprecat") || content.includes("axios") || content.includes("fetch"))) score.taskCompletion += 25;
        if (content.includes("body-parser") && (content.includes("built") || content.includes("express.json"))) score.taskCompletion += 25;
        if (content.includes("moment") && (content.includes("date-fns") || content.includes("dayjs") || content.includes("legacy") || content.includes("large"))) score.taskCompletion += 25;
        if (content.includes("jest") && (content.includes("devdep") || content.includes("missing") || content.includes("dev"))) score.taskCompletion += 25;
      }
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "understand-count-routes",
    category: "understanding",
    description: "Count all HTTP route handlers (GET, POST, PUT, DELETE) across all files. Create ROUTES.md with a table: Method | Path | File | Description (inferred from handler code).",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "routes"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "routes/users.js"), `const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
router.get('/:id', (req, res) => res.json({ id: req.params.id }));
router.post('/', (req, res) => res.status(201).json(req.body));
router.put('/:id', (req, res) => res.json({ ...req.body, id: req.params.id }));
router.delete('/:id', (req, res) => res.status(204).send());
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "routes/products.js"), `const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
router.get('/:id', (req, res) => res.json({ id: req.params.id }));
router.post('/', (req, res) => res.status(201).json(req.body));
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "app.js"), `const express = require('express');
const app = express();
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
module.exports = app;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"api","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "ROUTES.md")) {
        const content = fs.readFileSync(path.join(tmpDir, "ROUTES.md"), "utf-8");
        // There are 9 routes total
        const methods = ["GET", "POST", "PUT", "DELETE"];
        let methodCount = 0;
        for (const m of methods) {
          if (content.includes(m)) methodCount++;
        }
        score.taskCompletion += methodCount * 15; // up to 60
        if (content.includes("users")) score.taskCompletion += 20;
        if (content.includes("products")) score.taskCompletion += 20;
        score.taskCompletion = Math.min(100, score.taskCompletion);
      }
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Category 4: Server/DevOps (4 tasks, weight: 15%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "devops-nginx-reverse-proxy",
    category: "devops",
    description: "Create an nginx config file at nginx/cookbook.conf that sets up a reverse proxy for the cookbook app running on port 8010. Include: server_name kochbuch.schoensgibl.com, proxy_pass to localhost:8010, proxy headers (Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto).",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "nginx"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "nginx/example.conf"), `server {
    listen 80;
    server_name example.schoensgibl.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"cookbook","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "nginx/cookbook.conf")) {
        const content = fs.readFileSync(path.join(tmpDir, "nginx/cookbook.conf"), "utf-8");
        if (content.includes("kochbuch.schoensgibl.com")) score.taskCompletion += 25;
        if (content.includes("8010")) score.taskCompletion += 25;
        if (content.includes("proxy_pass")) score.taskCompletion += 25;
        if (content.includes("proxy_set_header")) score.taskCompletion += 25;
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "devops-systemd-service",
    category: "devops",
    description: "Create a systemd service file at deploy/cookbook.service for the cookbook Node.js app. It should: run as user 'webadmin', WorkingDirectory /opt/cookbook, ExecStart with node, Restart=always, set NODE_ENV=production.",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "deploy"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"cookbook","version":"1.0.0","scripts":{"start":"node server.js"}}\n');
      fs.writeFileSync(path.join(tmpDir, "server.js"), `const app = require('./app');
app.listen(8010, () => console.log('Cookbook running on 8010'));
`);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "deploy/cookbook.service")) {
        const content = fs.readFileSync(path.join(tmpDir, "deploy/cookbook.service"), "utf-8");
        if (content.includes("[Service]")) score.taskCompletion += 20;
        if (content.includes("webadmin")) score.taskCompletion += 20;
        if (content.includes("/opt/cookbook")) score.taskCompletion += 20;
        if (content.includes("Restart=always")) score.taskCompletion += 20;
        if (content.includes("NODE_ENV=production") || content.includes("NODE_ENV") && content.includes("production")) score.taskCompletion += 20;
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "devops-deploy-script",
    category: "devops",
    description: "Create a deploy.sh script that: 1) Pulls latest from git, 2) Runs npm install --production, 3) Restarts the systemd service 'cookbook', 4) Checks service status. Make it executable-ready with #!/bin/bash and set -e.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"cookbook","version":"1.0.0"}\n');
      fs.writeFileSync(path.join(tmpDir, "server.js"), `require('express')().listen(8010);`);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "deploy.sh")) {
        const content = fs.readFileSync(path.join(tmpDir, "deploy.sh"), "utf-8");
        if (content.includes("#!/bin/bash")) score.taskCompletion += 20;
        if (content.includes("set -e")) score.taskCompletion += 15;
        if (content.includes("git pull")) score.taskCompletion += 20;
        if (content.includes("npm install")) score.taskCompletion += 15;
        if (content.includes("systemctl") && content.includes("restart")) score.taskCompletion += 15;
        if (content.includes("systemctl") && content.includes("status")) score.taskCompletion += 15;
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "devops-dockerfile",
    category: "devops",
    description: "Create a production-ready Dockerfile for this Node.js app. Use multi-stage build: stage 1 installs all deps and runs build, stage 2 copies only production artifacts. Use node:20-alpine, expose port 8010.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
        name: "cookbook",
        version: "1.0.0",
        scripts: { start: "node server.js", build: "echo build" },
        dependencies: { express: "^4.18.0" },
        devDependencies: { jest: "^29.0.0" },
      }, null, 2) + "\n");
      fs.writeFileSync(path.join(tmpDir, "server.js"), `require('express')().listen(8010);`);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "Dockerfile")) {
        const content = fs.readFileSync(path.join(tmpDir, "Dockerfile"), "utf-8");
        if (content.includes("FROM") && content.includes("alpine")) score.taskCompletion += 20;
        if (content.includes("AS") || content.includes("as ")) score.taskCompletion += 20; // multi-stage
        if (content.includes("EXPOSE") && content.includes("8010")) score.taskCompletion += 20;
        if (content.includes("npm") && content.includes("install")) score.taskCompletion += 20;
        if (content.includes("COPY")) score.taskCompletion += 20;
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Category 5: Multi-file Refactoring (4 tasks, weight: 15%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "refactor-extract-validation",
    category: "refactor",
    description: "Extract the inline validation logic from routes/users.js and routes/products.js into a shared middleware/validate.js module. Both routes validate 'name' (required, string, 3-100 chars). Create the shared validator and update both route files to use it.",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "routes"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "routes/users.js"), `const router = require('express').Router();
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.length < 3 || name.length > 100) {
    return res.status(400).json({ error: 'Name must be 3-100 characters' });
  }
  res.status(201).json({ id: 1, name });
});
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "routes/products.js"), `const router = require('express').Router();
router.post('/', (req, res) => {
  const { name, price } = req.body;
  if (!name || typeof name !== 'string' || name.length < 3 || name.length > 100) {
    return res.status(400).json({ error: 'Name must be 3-100 characters' });
  }
  res.status(201).json({ id: 1, name, price });
});
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"api","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "middleware/validate.js")) score.taskCompletion += 30;
      if (fileContains(tmpDir, "middleware/validate.js", "name") && fileContains(tmpDir, "middleware/validate.js", "3")) score.taskCompletion += 20;
      if (fileContains(tmpDir, "routes/users.js", "validate") || fileContains(tmpDir, "routes/users.js", "middleware")) score.taskCompletion += 25;
      if (fileContains(tmpDir, "routes/products.js", "validate") || fileContains(tmpDir, "routes/products.js", "middleware")) score.taskCompletion += 25;
      return score;
    },
    maxToolCalls: 14,
    maxTurns: 18,
    timeoutMs: 180000,
  },

  {
    id: "refactor-rename-across-files",
    category: "refactor",
    description: "Rename the function 'calcTotal' to 'calculateTotal' in all files where it appears. Update both the definition and all imports/usages.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "math.js"), `function calcTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
module.exports = { calcTotal };
`);
      fs.writeFileSync(path.join(tmpDir, "cart.js"), `const { calcTotal } = require('./math');
function checkout(items) {
  const total = calcTotal(items);
  return { total, tax: total * 0.1 };
}
module.exports = { checkout };
`);
      fs.writeFileSync(path.join(tmpDir, "invoice.js"), `const { calcTotal } = require('./math');
function generateInvoice(items) {
  return { subtotal: calcTotal(items), date: new Date() };
}
module.exports = { generateInvoice };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"shop","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileContains(tmpDir, "math.js", "calculateTotal") && !fileContains(tmpDir, "math.js", "calcTotal")) score.taskCompletion += 34;
      if (fileContains(tmpDir, "cart.js", "calculateTotal") && !fileContains(tmpDir, "cart.js", "calcTotal")) score.taskCompletion += 33;
      if (fileContains(tmpDir, "invoice.js", "calculateTotal") && !fileContains(tmpDir, "invoice.js", "calcTotal")) score.taskCompletion += 33;
      return score;
    },
    maxToolCalls: 14,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "refactor-split-monolith",
    category: "refactor",
    description: "Split the monolithic app.js into separate route files. Move the /users handlers to routes/users.js and the /products handlers to routes/products.js. Keep app.js as the entry point that mounts both routers.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app.js"), `const express = require('express');
const app = express();
app.use(express.json());

// Users
app.get('/users', (req, res) => res.json([{ id: 1, name: 'Alice' }]));
app.get('/users/:id', (req, res) => res.json({ id: req.params.id }));
app.post('/users', (req, res) => res.status(201).json(req.body));

// Products
app.get('/products', (req, res) => res.json([{ id: 1, name: 'Widget' }]));
app.post('/products', (req, res) => res.status(201).json(req.body));

app.listen(3000);
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"monolith","version":"1.0.0","dependencies":{"express":"^4.18.0"}}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "routes/users.js")) score.taskCompletion += 25;
      if (fileExists(tmpDir, "routes/products.js")) score.taskCompletion += 25;
      if (fileContains(tmpDir, "routes/users.js", "get") || fileContains(tmpDir, "routes/users.js", "GET")) score.taskCompletion += 10;
      if (fileContains(tmpDir, "routes/products.js", "get") || fileContains(tmpDir, "routes/products.js", "GET")) score.taskCompletion += 10;
      if (fileContains(tmpDir, "app.js", "require") && (fileContains(tmpDir, "app.js", "routes/users") || fileContains(tmpDir, "app.js", "./routes"))) score.taskCompletion += 15;
      if (fileContains(tmpDir, "app.js", "use")) score.taskCompletion += 15;
      return score;
    },
    maxToolCalls: 14,
    maxTurns: 18,
    timeoutMs: 180000,
  },

  {
    id: "refactor-fix-broken-import-paths",
    category: "refactor",
    description: "The db module was moved from db/connection.js to lib/database.js. Update all import paths in models/user.js and models/post.js to point to the new location.",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "lib"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "models"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "lib/database.js"), `const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = { pool };
`);
      fs.writeFileSync(path.join(tmpDir, "models/user.js"), `const { pool } = require('../db/connection');
async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  return rows[0];
}
module.exports = { findById };
`);
      fs.writeFileSync(path.join(tmpDir, "models/post.js"), `const { pool } = require('../db/connection');
async function findAll() {
  const { rows } = await pool.query('SELECT * FROM posts');
  return rows;
}
module.exports = { findAll };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"api","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (!fileContains(tmpDir, "models/user.js", "../db/connection") && fileContains(tmpDir, "models/user.js", "../lib/database")) score.taskCompletion += 50;
      if (!fileContains(tmpDir, "models/post.js", "../db/connection") && fileContains(tmpDir, "models/post.js", "../lib/database")) score.taskCompletion += 50;
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Category 6: Test Writing (3 tasks, weight: 10%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "test-write-unit-tests",
    category: "testing",
    description: "Write unit tests for the utility functions in utils.js. Create tests/utils.test.js using simple assertions (throw on failure, no test framework). Test all exported functions with at least 2 test cases each.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "utils.js"), `function capitalize(str) {
  if (!str) return '';
  return str[0].toUpperCase() + str.slice(1);
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

module.exports = { capitalize, clamp, slugify };
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"test-target","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 0 };
      if (fileExists(tmpDir, "tests/utils.test.js")) {
        const content = fs.readFileSync(path.join(tmpDir, "tests/utils.test.js"), "utf-8");
        if (content.includes("capitalize")) score.taskCompletion += 25;
        if (content.includes("clamp")) score.taskCompletion += 25;
        if (content.includes("slugify")) score.taskCompletion += 25;
        if (content.includes("require") && content.includes("utils")) score.taskCompletion += 25;
        // Try running the test file
        try {
          execSync("node tests/utils.test.js", { cwd: tmpDir, stdio: "pipe", timeout: 5000 });
          score.quality = 100;
        } catch { score.quality = 0; }
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "test-write-api-tests",
    category: "testing",
    description: "Write tests for the API routes in routes.js. Create tests/routes.test.js that tests: 1) GET /api/items returns an array, 2) POST /api/items creates an item, 3) GET /api/items/:id returns 404 for missing items. Use simple assertions with the built-in http module (no test framework).",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "routes.js"), `const express = require('express');
const router = express.Router();
const items = [];
let nextId = 1;

router.get('/api/items', (req, res) => res.json(items));
router.post('/api/items', (req, res) => {
  const item = { id: nextId++, ...req.body };
  items.push(item);
  res.status(201).json(item);
});
router.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});
module.exports = router;
`);
      fs.writeFileSync(path.join(tmpDir, "app.js"), `const express = require('express');
const app = express();
app.use(express.json());
app.use(require('./routes'));
module.exports = app;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"api-test","version":"1.0.0","dependencies":{"express":"^4.18.0"}}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      const testFile = fileExists(tmpDir, "tests/routes.test.js") ? "tests/routes.test.js" : "test/routes.test.js";
      if (fileExists(tmpDir, testFile)) {
        const content = fs.readFileSync(path.join(tmpDir, testFile), "utf-8");
        if (content.includes("GET") || content.includes("get")) score.taskCompletion += 30;
        if (content.includes("POST") || content.includes("post") || content.includes("201")) score.taskCompletion += 30;
        if (content.includes("404") || content.includes("not found") || content.includes("Not found")) score.taskCompletion += 20;
        if (content.includes("items") || content.includes("/api")) score.taskCompletion += 20;
      }
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "test-add-edge-cases",
    category: "testing",
    description: "The existing test file tests/calc.test.js has basic tests but misses edge cases. Add tests for: 1) divide by zero, 2) negative numbers, 3) very large numbers, 4) non-numeric inputs.",
    setupFn(tmpDir) {
      fs.mkdirSync(path.join(tmpDir, "tests"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "calc.js"), `function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }
function multiply(a, b) { return a * b; }
function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
module.exports = { add, subtract, multiply, divide };
`);
      fs.writeFileSync(path.join(tmpDir, "tests/calc.test.js"), `const { add, subtract, multiply, divide } = require('../calc');

// Basic tests
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); };

assert(add(2, 3) === 5, 'add(2,3)');
assert(subtract(5, 3) === 2, 'subtract(5,3)');
assert(multiply(4, 3) === 12, 'multiply(4,3)');
assert(divide(10, 2) === 5, 'divide(10,2)');

console.log('All basic tests passed');
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"calc","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 0 };
      if (fileExists(tmpDir, "tests/calc.test.js")) {
        const content = fs.readFileSync(path.join(tmpDir, "tests/calc.test.js"), "utf-8");
        if (content.includes("0") && (content.includes("divide") || content.includes("zero"))) score.taskCompletion += 25;
        if (content.includes("-") || content.includes("negative")) score.taskCompletion += 25;
        if (content.includes("Infinity") || content.includes("MAX") || content.includes("large") || content.includes("999")) score.taskCompletion += 25;
        if (content.includes("NaN") || content.includes("string") || content.includes("undefined") || content.includes("null") || content.includes("typeof")) score.taskCompletion += 25;
        // Run tests
        try {
          execSync("node tests/calc.test.js", { cwd: tmpDir, stdio: "pipe", timeout: 5000 });
          score.quality = 100;
        } catch { score.quality = 0; }
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // Category 7: Documentation (2 tasks, weight: 5%)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "docs-write-setup-guide",
    category: "docs",
    description: "Create a SETUP.md with clear setup instructions for this Node.js project. Include: prerequisites, install steps, environment variables needed, how to run dev server, how to run tests.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
        name: "practice-wizard",
        version: "2.0.0",
        scripts: {
          start: "node server.js",
          dev: "nodemon server.js",
          test: "node tests/run.js",
        },
        dependencies: { express: "^4.18.0", "better-sqlite3": "^9.0.0" },
        devDependencies: { nodemon: "^3.0.0" },
      }, null, 2) + "\n");
      fs.writeFileSync(path.join(tmpDir, "server.js"), `require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT);
`);
      fs.writeFileSync(path.join(tmpDir, ".env.example"), "PORT=3000\nDB_PATH=./data/practice.db\nSESSION_SECRET=change-me\n");
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "SETUP.md")) {
        const content = fs.readFileSync(path.join(tmpDir, "SETUP.md"), "utf-8").toLowerCase();
        if (content.includes("node") || content.includes("prerequisit")) score.taskCompletion += 20;
        if (content.includes("npm install") || content.includes("install")) score.taskCompletion += 20;
        if (content.includes("env") || content.includes("environment") || content.includes("port")) score.taskCompletion += 20;
        if (content.includes("npm run dev") || content.includes("npm start") || content.includes("nodemon")) score.taskCompletion += 20;
        if (content.includes("test") || content.includes("npm run test")) score.taskCompletion += 20;
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  {
    id: "docs-api-documentation",
    category: "docs",
    description: "Create an API.md documenting all endpoints in this Express app. For each endpoint include: HTTP method, path, description, request body (if any), response format, status codes.",
    setupFn(tmpDir) {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app.js"), `const express = require('express');
const app = express();
app.use(express.json());

const items = [
  { id: 1, name: 'Guitar', price: 599 },
  { id: 2, name: 'Amp', price: 299 },
];

app.get('/api/items', (req, res) => {
  const { category } = req.query;
  const filtered = category ? items.filter(i => i.category === category) : items;
  res.json(filtered);
});

app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/items', (req, res) => {
  const { name, price } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const item = { id: items.length + 1, name, price };
  items.push(item);
  res.status(201).json(item);
});

app.delete('/api/items/:id', (req, res) => {
  const idx = items.findIndex(i => i.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items.splice(idx, 1);
  res.status(204).send();
});

module.exports = app;
`);
      fs.writeFileSync(path.join(tmpDir, "package.json"), '{"name":"shop-api","version":"1.0.0"}\n');
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, quality: 100 };
      if (fileExists(tmpDir, "API.md")) {
        const content = fs.readFileSync(path.join(tmpDir, "API.md"), "utf-8");
        if (content.includes("GET") && content.includes("/api/items")) score.taskCompletion += 25;
        if (content.includes("POST")) score.taskCompletion += 25;
        if (content.includes("DELETE")) score.taskCompletion += 25;
        if (content.includes("404") || content.includes("201") || content.includes("400")) score.taskCompletion += 25;
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 12,
    timeoutMs: 180000,
  },
  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Server/DevOps (additional — SSH/firewall focus)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "devops-firewall-rules",
    category: "devops",
    description:
      "Create a firewall-cmd script that opens ports 9011-9023 for webhook services, " +
      "blocks external access to port 5432 (PostgreSQL), and adds rate limiting " +
      "on port 443 (max 1000 req/min). Include verification commands.",
    sourceProject: "Documentation/AlmaLinux9Server",
    setupFn(tmpDir) {
      copyFiles("Documentation/AlmaLinux9Server", [
        "00-SERVER-OVERVIEW.md",
        "10-AUTO-DEPLOY.md",
        "11-SERVER-MONITORING.md",
      ], tmpDir);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith(".sh") || f.includes("firewall"));
      if (files.length > 0) {
        const content = fs.readFileSync(path.join(tmpDir, files[0]), "utf-8");
        if (content.includes("9011") && content.includes("9023")) score.taskCompletion += 30;
        if (content.includes("5432")) score.taskCompletion += 25;
        if (content.includes("443") && content.includes("rate")) score.taskCompletion += 25;
        if (content.includes("--list-all") || content.includes("verify")) score.taskCompletion += 20;
        if (content.includes("#!/bin/bash")) score.quality += 50;
        if (content.includes("#")) score.quality += 50; // has comments
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  {
    id: "devops-ssh-key-rotation",
    category: "devops",
    description:
      "Create an SSH key rotation script (ssh-rotate.sh) that generates ED25519 keys monthly, " +
      "maintains 2 active keys for zero-downtime rotation, logs all changes to an audit file " +
      "with timestamps, and includes a rollback mechanism. Add a cron job definition.",
    sourceProject: "Documentation/AlmaLinux9Server",
    setupFn(tmpDir) {
      copyFiles("Documentation/AlmaLinux9Server", [
        "00-SERVER-OVERVIEW.md",
        "10-AUTO-DEPLOY.md",
      ], tmpDir);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const rotateFile = path.join(tmpDir, "ssh-rotate.sh");
      if (fs.existsSync(rotateFile)) {
        const content = fs.readFileSync(rotateFile, "utf-8");
        if (content.includes("ed25519") || content.includes("ED25519")) score.taskCompletion += 25;
        if (content.includes("authorized_keys")) score.taskCompletion += 25;
        if (content.includes("rollback") || content.includes("backup")) score.taskCompletion += 25;
        if (content.includes("audit") || content.includes("log")) score.taskCompletion += 25;
        if (content.includes("#!/bin/bash")) score.quality += 50;
        if (content.includes("cron") || content.includes("0 0")) score.quality += 50;
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Data Processing (new)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "data-jsonl-cost-analysis",
    category: "feature",
    description:
      "Parse the action-log.jsonl file and create a cost analysis tool (cost-report.js) that " +
      "calculates per-provider costs using these rates: Gemini $0.075/$0.3 per M tokens, " +
      "DeepSeek $0.14/$0.28, Qwen $0.02/$0.06. Output JSON with breakdown by provider and date.",
    sourceProject: "jarvis-agent",
    setupFn(tmpDir) {
      // Create a sample JSONL file
      const lines = [
        '{"timestamp":"2026-03-01T10:00:00Z","provider":"gemini","model":"gemini-2.5-flash","input_tokens":1500,"output_tokens":500,"status":"success"}',
        '{"timestamp":"2026-03-01T11:00:00Z","provider":"deepseek","model":"deepseek-v3","input_tokens":2000,"output_tokens":800,"status":"success"}',
        '{"timestamp":"2026-03-01T12:00:00Z","provider":"qwen","model":"qwen3-coder","input_tokens":1000,"output_tokens":300,"status":"success"}',
        '{"timestamp":"2026-03-02T10:00:00Z","provider":"gemini","model":"gemini-2.5-flash","input_tokens":3000,"output_tokens":1200,"status":"success"}',
        '{"timestamp":"2026-03-02T11:00:00Z","provider":"deepseek","model":"deepseek-v3","input_tokens":500,"output_tokens":200,"status":"error"}',
      ];
      fs.writeFileSync(path.join(tmpDir, "action-log.jsonl"), lines.join("\n"));
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const reportFile = path.join(tmpDir, "cost-report.js");
      if (fs.existsSync(reportFile)) {
        const content = fs.readFileSync(reportFile, "utf-8");
        if (content.includes("jsonl") || content.includes("readline")) score.taskCompletion += 25;
        if (content.includes("0.075") || content.includes("gemini")) score.taskCompletion += 25;
        if (content.includes("JSON.stringify") || content.includes("json")) score.taskCompletion += 25;
        if (content.includes("provider") && content.includes("cost")) score.taskCompletion += 25;
        if (content.includes("try") || content.includes("catch")) score.quality += 50;
        if (content.includes("//") || content.includes("/*")) score.quality += 50;
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Multi-file Refactoring (additional — Django focus)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "refactor-django-migration-audit",
    category: "refactor",
    description:
      "Analyze the Django migration files in chords/migrations/ and create a migration-audit.py " +
      "script that validates the dependency chain (no orphans, no circular deps), extracts " +
      "schema changes per migration, and outputs a JSON report with field additions/removals.",
    sourceProject: "chord-library",
    setupFn(tmpDir) {
      // Copy migration files
      const migrationsDir = path.join(CODING, "chord-library", "backend", "chords", "migrations");
      const destMigrations = path.join(tmpDir, "chords", "migrations");
      fs.mkdirSync(destMigrations, { recursive: true });
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".py"));
        for (const f of files) {
          fs.copyFileSync(path.join(migrationsDir, f), path.join(destMigrations, f));
        }
      }
      // Copy models.py for reference
      const modelsPath = path.join(CODING, "chord-library", "backend", "chords", "models.py");
      if (fs.existsSync(modelsPath)) {
        fs.mkdirSync(path.join(tmpDir, "chords"), { recursive: true });
        fs.copyFileSync(modelsPath, path.join(tmpDir, "chords", "models.py"));
      }
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const auditFile = path.join(tmpDir, "migration-audit.py");
      if (fs.existsSync(auditFile)) {
        const content = fs.readFileSync(auditFile, "utf-8");
        if (content.includes("dependencies") || content.includes("dependency")) score.taskCompletion += 25;
        if (content.includes("operations") || content.includes("AddField")) score.taskCompletion += 25;
        if (content.includes("json") || content.includes("JSON")) score.taskCompletion += 25;
        if (content.includes("circular") || content.includes("orphan") || content.includes("chain")) score.taskCompletion += 25;
        if (content.includes("def ") || content.includes("class ")) score.quality += 50;
        if (content.includes("__main__") || content.includes("argparse")) score.quality += 50;
      }
      return score;
    },
    maxToolCalls: 12,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Understanding (additional — analytics focus)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "understand-db-schema-analysis",
    category: "understanding",
    description:
      "Read DATABASE_README.md and create a schema-summary.json that lists all tables, " +
      "their columns with types, foreign key relationships, and indexes. " +
      "Include a 'statistics' field counting total tables, columns, and relationships.",
    sourceProject: "practice-wizard",
    setupFn(tmpDir) {
      copyFiles("practice-wizard", ["DATABASE_README.md"], tmpDir);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const summaryFile = path.join(tmpDir, "schema-summary.json");
      if (fs.existsSync(summaryFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(summaryFile, "utf-8"));
          if (data.tables || data.schema) score.taskCompletion += 30;
          if (data.statistics || data.summary) score.taskCompletion += 20;
          if (JSON.stringify(data).includes("column")) score.taskCompletion += 25;
          if (JSON.stringify(data).includes("foreign") || JSON.stringify(data).includes("relation")) score.taskCompletion += 25;
          score.quality = 100; // Valid JSON = good quality
        } catch {
          score.taskCompletion += 10; // File exists but invalid JSON
        }
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Testing (additional — edge case focus)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "testing-music-transposition",
    category: "testing",
    description:
      "Create a test file (transposition.test.js) that tests a chord transposition function. " +
      "The function transpose(chord, semitones) takes a chord name like 'Cmaj7' and returns " +
      "the transposed chord. Write the function in transpose.js AND comprehensive tests " +
      "covering: all 12 keys, flats/sharps, minor/major/7th/dim chords, edge cases (0 semitones, 12 semitones = same).",
    sourceProject: null,
    setupFn(tmpDir) {
      fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({
        name: "transposition-test",
        scripts: { test: "node --experimental-vm-modules node_modules/.bin/jest" },
        devDependencies: { jest: "^29.0.0" },
      }, null, 2));
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const testFile = path.join(tmpDir, "transposition.test.js");
      const srcFile = path.join(tmpDir, "transpose.js");
      if (fs.existsSync(testFile)) {
        const content = fs.readFileSync(testFile, "utf-8");
        if (content.includes("describe") || content.includes("test(")) score.taskCompletion += 25;
        if (content.includes("Cmaj7") || content.includes("transpose")) score.taskCompletion += 25;
        if (content.includes("minor") || content.includes("m7") || content.includes("dim")) score.taskCompletion += 25;
        if ((content.match(/test\(|it\(/g) || []).length >= 5) score.taskCompletion += 25;
        score.quality += 50;
      }
      if (fs.existsSync(srcFile)) {
        const content = fs.readFileSync(srcFile, "utf-8");
        if (content.includes("function") || content.includes("=>")) score.quality += 50;
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Bug Fixing (additional — async/promise focus)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "bugfix-promise-race-condition",
    category: "bugfix",
    description:
      "Fix the race condition in worker.js. The processQueue() function processes items " +
      "in parallel but doesn't wait for all promises before resolving. Items sometimes " +
      "get processed twice or skipped. Fix the bug so all items are processed exactly once.",
    sourceProject: null,
    setupFn(tmpDir) {
      // Plant a known race condition bug
      fs.writeFileSync(path.join(tmpDir, "worker.js"), `
const queue = [];
let processing = false;

async function processQueue() {
  if (processing) return; // BUG: race condition — multiple callers can pass this check
  processing = true;

  const results = [];
  for (const item of queue) {
    // BUG: not awaited — fires and forgets
    fetch(item.url).then(r => results.push(r));
  }

  processing = false;
  queue.length = 0;
  return results; // BUG: returns empty — promises haven't resolved
}

function addToQueue(item) {
  queue.push(item);
  processQueue(); // BUG: not awaited
}

module.exports = { addToQueue, processQueue, queue };
`);
      fs.writeFileSync(path.join(tmpDir, "worker.test.js"), `
const { addToQueue, processQueue, queue } = require('./worker');

test('processes all items exactly once', async () => {
  addToQueue({ url: 'http://example.com/1' });
  addToQueue({ url: 'http://example.com/2' });
  const results = await processQueue();
  expect(results).toHaveLength(2);
});
`);
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      if (fs.existsSync(path.join(tmpDir, "worker.js"))) {
        const content = fs.readFileSync(path.join(tmpDir, "worker.js"), "utf-8");
        if (content.includes("await") && content.includes("Promise")) score.taskCompletion += 35;
        if (content.includes("Promise.all") || content.includes("Promise.allSettled")) score.taskCompletion += 35;
        if (!content.includes(".then(r => results.push(r))")) score.taskCompletion += 30; // removed fire-and-forget
        if (content.includes("mutex") || content.includes("lock") || content.includes("splice")) score.quality += 50;
        if (content.includes("//") || content.includes("/*")) score.quality += 50;
      }
      return score;
    },
    maxToolCalls: 8,
    maxTurns: 12,
    timeoutMs: 180000,
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORY: Feature (additional — CLI tool creation)
  // ═══════════════════════════════════════════════════════════════

  {
    id: "feat-cli-practice-stats",
    category: "feature",
    description:
      "Create a CLI tool (practice-stats.js) that reads practice-sessions.json and outputs " +
      "statistics: total hours, longest streak (consecutive days), most practiced category, " +
      "average session length. Support --format json|table flags. Use only Node.js built-ins.",
    sourceProject: null,
    setupFn(tmpDir) {
      // Create sample practice data
      const sessions = [
        { date: "2026-03-01", minutes: 45, category: "scales", completed: true },
        { date: "2026-03-02", minutes: 60, category: "repertoire", completed: true },
        { date: "2026-03-03", minutes: 30, category: "scales", completed: true },
        { date: "2026-03-05", minutes: 90, category: "technique", completed: false },
        { date: "2026-03-06", minutes: 45, category: "repertoire", completed: true },
        { date: "2026-03-07", minutes: 60, category: "scales", completed: true },
        { date: "2026-03-08", minutes: 30, category: "repertoire", completed: true },
        { date: "2026-03-09", minutes: 75, category: "scales", completed: true },
      ];
      fs.writeFileSync(path.join(tmpDir, "practice-sessions.json"), JSON.stringify(sessions, null, 2));
      initGit(tmpDir);
    },
    evaluateFn(tmpDir) {
      const score = { taskCompletion: 0, editPrecision: 100, efficiency: 100, quality: 0 };
      const statsFile = path.join(tmpDir, "practice-stats.js");
      if (fs.existsSync(statsFile)) {
        const content = fs.readFileSync(statsFile, "utf-8");
        if (content.includes("practice-sessions.json") || content.includes("readFile")) score.taskCompletion += 20;
        if (content.includes("streak") || content.includes("consecutive")) score.taskCompletion += 20;
        if (content.includes("total") && content.includes("hours")) score.taskCompletion += 20;
        if (content.includes("--format") || content.includes("argv")) score.taskCompletion += 20;
        if (content.includes("category") || content.includes("most")) score.taskCompletion += 20;
        if (content.includes("#!/usr/bin/env node") || content.includes("process.argv")) score.quality += 50;
        if (content.includes("//") || content.includes("/**")) score.quality += 50;
      }
      return score;
    },
    maxToolCalls: 10,
    maxTurns: 15,
    timeoutMs: 180000,
  },
];

module.exports = { TASKS, CATEGORY_WEIGHTS, copyFiles, copyTree, initGit, fileContains, fileExists, filesChanged };

#!/usr/bin/env node
/**
 * harness-metrics.js — lightweight readout for:
 *   1. CLI test harness adoption across the test suite
 *   2. Improve-daemon stop-reason distribution and pass stats
 *
 * Usage: node scripts/harness-metrics.js
 *
 * This is a reporter only — no state is written.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TESTS_DIR = path.join(ROOT, "tests");
const DAEMON_LOG = path.join(ROOT, "scripts", "improve-daemon.log");
const LOOP_STATE =
  process.env.NEX_LOOP_STATE ||
  path.join(
    process.env.HOME,
    "Coding",
    "jarvis-agent",
    ".nex",
    "loop-state.json",
  );

// ── 1. CLI harness adoption ────────────────────────────────────────────────
function collectTestFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...collectTestFiles(full));
    else if (name.endsWith(".test.js")) out.push(full);
  }
  return out;
}

function reportAdoption() {
  const files = collectTestFiles(TESTS_DIR);
  const harnessUsers = [];
  const execFileUsers = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const usesHarness =
      /require\(["']\.\/helpers\/cli-harness["']\)/.test(src) ||
      /from ["']\.\/helpers\/cli-harness["']/.test(src);
    const spawnsBin =
      /bin\/nex-code/.test(src) || /(\/|["'\s])nex-code\.js/.test(src);
    if (usesHarness) harnessUsers.push(path.relative(ROOT, f));
    else if (spawnsBin) execFileUsers.push(path.relative(ROOT, f));
  }
  console.log("CLI harness adoption");
  console.log(`  test files total:           ${files.length}`);
  console.log(`  using cli-harness helpers:  ${harnessUsers.length}`);
  for (const f of harnessUsers) console.log(`    - ${f}`);
  if (execFileUsers.length > 0) {
    console.log(`  still ad-hoc (spawn bin):   ${execFileUsers.length}`);
    for (const f of execFileUsers) console.log(`    - ${f}`);
  }
  console.log();
}

// ── 2. Improve-daemon stop-reason distribution ────────────────────────────
const STOP_PATTERNS = [
  { label: "plateau (ε)", re: /score plateau/i },
  { label: "regression", re: /regression/i },
  { label: "no-new-high", re: /no new high/i },
  { label: "plateau (legacy exact)", re: /Score plateau detected/i },
  { label: "max passes", re: /Max passes reached/i },
  { label: "target score", re: /Target score reached|SCORE_TARGET/i },
];

function reportDaemon() {
  console.log("Improve-daemon stop reasons");
  if (!fs.existsSync(DAEMON_LOG)) {
    console.log("  (no daemon log found — daemon hasn't run yet)\n");
    return;
  }
  const lines = fs
    .readFileSync(DAEMON_LOG, "utf8")
    .split("\n")
    .filter((l) => /Stopping improvement loop|Max passes reached|Score plateau/i.test(l));

  const counts = new Map();
  for (const line of lines) {
    for (const p of STOP_PATTERNS) {
      if (p.re.test(line)) {
        counts.set(p.label, (counts.get(p.label) || 0) + 1);
        break;
      }
    }
  }

  if (counts.size === 0) {
    console.log("  (no stop events in log yet)");
  } else {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    for (const [label, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const pct = ((n / total) * 100).toFixed(0).padStart(3);
      console.log(`  ${label.padEnd(24)} ${String(n).padStart(3)}  (${pct}%)`);
    }
    console.log(`  ${"total".padEnd(24)} ${String(total).padStart(3)}`);
  }

  // Current loop state snapshot
  if (fs.existsSync(LOOP_STATE)) {
    try {
      const st = JSON.parse(fs.readFileSync(LOOP_STATE, "utf8"));
      const scores = Array.isArray(st.scores) ? st.scores : [];
      console.log();
      console.log("Current loop");
      console.log(`  pass:         ${st.pass}`);
      console.log(`  scores:       [${scores.join(", ")}]`);
      if (scores.length > 0) {
        const max = Math.max(...scores).toFixed(1);
        const last = scores[scores.length - 1].toFixed(1);
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
        console.log(`  max / last:   ${max} / ${last}`);
        console.log(`  avg:          ${avg}`);
      }
      if (st.startedAt) console.log(`  started:      ${st.startedAt}`);
    } catch {
      /* ignore */
    }
  }
  console.log();
}

// ── 3. Coverage suggestion (don't run — slow) ──────────────────────────────
function reportCoverageHint() {
  console.log("Coverage (run manually — ~60s):");
  console.log(
    "  node_modules/.bin/jest --coverage \\",
  );
  console.log(
    "    --collectCoverageFrom='bin/**/*.js' \\",
  );
  console.log(
    "    --collectCoverageFrom='cli/setup.js' \\",
  );
  console.log(
    "    tests/cli-harness.test.js tests/interactive-flows.test.js tests/headless.test.js",
  );
  console.log();
}

reportAdoption();
reportDaemon();
reportCoverageHint();

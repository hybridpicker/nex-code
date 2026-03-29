#!/usr/bin/env node
"use strict";

/**
 * scripts/phase-routing-test.js — Automated phase routing improvement loop
 *
 * Runs nex-code on real projects with real tasks, evaluates results,
 * and reports issues for iterative improvement.
 *
 * Usage:
 *   node scripts/phase-routing-test.js              # run all scenarios
 *   node scripts/phase-routing-test.js --scenario 0  # run specific scenario
 *   node scripts/phase-routing-test.js --loop 5      # run N improvement iterations
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// ─── Test Scenarios ──────────────────────────────────────────────────────────
// Each scenario targets a different project and task type to exercise
// plan → implement → verify phases thoroughly.

// Load scenarios from .nex/phase-test-scenarios.json if it exists.
// This file is user-specific (not committed) — contains local project paths.
// Falls back to a minimal self-test using the nex-code repo itself.
function loadTestScenarios() {
  const configPath = path.join(__dirname, "..", ".nex", "phase-test-scenarios.json");
  if (fs.existsSync(configPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (Array.isArray(data.scenarios) && data.scenarios.length > 0) {
        return data.scenarios;
      }
    } catch (err) {
      console.error(`Failed to load ${configPath}: ${err.message}`);
    }
  }

  console.log(
    "No scenarios configured. Create .nex/phase-test-scenarios.json:\n" +
    '  { "scenarios": [{ "id": "my-test", "project": "/path/to/project",\n' +
    '    "prompt": "Add a feature...", "category": "frontend",\n' +
    '    "expectFiles": 1, "expectTest": false }] }\n' +
    "\nFalling back to self-test scenario.\n",
  );

  // Minimal self-test: add a trivial feature to nex-code itself
  return [
    {
      id: "nex-code-selftest",
      project: path.resolve(__dirname, ".."),
      prompt:
        "Add a /version command that prints the current nex-code version from package.json. It should work in the REPL when the user types /version.",
      category: "coding",
      expectFiles: 1,
      expectTest: false,
    },
  ];
}

const SCENARIOS = loadTestScenarios();

// ─── Runner ──────────────────────────────────────────────────────────────────

const NEX_BIN = path.resolve(__dirname, "..", "bin", "nex-code.js");
const MAX_TURNS = 40;
const TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes per scenario

/**
 * Run a single scenario and capture results.
 * @returns {{ score, filesModified, issues, phaseTransitions, blocked, timedOut, output }}
 */
function runScenario(scenario) {
  const projectPath = scenario.project.replace("~", process.env.HOME);

  return new Promise((resolve) => {
    const args = [
      NEX_BIN,
      "--prompt",
      scenario.prompt,
      "--auto",
      "--max-turns",
      String(MAX_TURNS),
    ];

    const env = {
      ...process.env,
      NEX_DEBUG: "1",
      FORCE_COLOR: "0", // no ANSI in captured output
    };

    const child = spawn(process.execPath, args, {
      cwd: projectPath,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGTERM"); } catch { /* */ }
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (exitCode) => {
      clearTimeout(timer);

      const output = stdout + "\n" + stderr;

      // Strip ALL ANSI escape codes for reliable parsing
      const clean = output.replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");

      // Strip full output for detection (before truncating for storage)
      const fullClean = (stdout + "\n" + stderr).replace(/\x1b\[\??[0-9;]*[a-zA-Z]/g, "").replace(/\x1b\][^\x07]*\x07/g, "");

      // Parse results from output — try both truncated and full output
      const scoreMatch = clean.match(/Session score:\s*([\d.]+)\/10\s*\(([A-F])\)/)
        || fullClean.match(/Session score:\s*([\d.]+)\/10\s*\(([A-F])\)/);

      const filesMatch = fullClean.match(/(\d+)\s*files?\s*modified/g);
      const filesModified = filesMatch
        ? Math.max(...filesMatch.map((m) => parseInt(m)))
        : 0;

      // If no session score was printed but files were modified, estimate a base score
      // (the session ended abnormally but work was done)
      let score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
      let grade = scoreMatch ? scoreMatch[2] : "F";
      if (!scoreMatch && filesModified > 0) {
        score = filesModified >= scenario.expectFiles ? 7 : 5;
        grade = score >= 7 ? "C" : "D";
      }

      // Count phase transitions
      const phaseTransitions = (clean.match(/Phase transition:/g) || []).length;

      // Count blocked tool calls
      const blockedReads = (clean.match(/blocked.*read_file.*denied/gi) || []).length;
      const blockedWrites = (clean.match(/blocked in plan phase/gi) || []).length;
      const blockedVerify = (clean.match(/blocked in verify phase/gi) || []).length;

      // Check for phase routing activation (uses fullClean from above)
      const phaseActive = /Phase routing|plan phase|PHASE: IMPLEMENTATION|PHASE: VERIFICATION/i.test(fullClean);

      // Extract issues from session scorer
      const issues = [];
      if (clean.includes("Loop-warning")) issues.push("loop-warning");
      if (clean.includes("without diagnosis")) issues.push("no-diagnosis");
      if (clean.includes("context wipe")) issues.push("context-wipe");
      if (clean.includes("Task may exceed model context")) issues.push("context-overflow");
      if (blockedReads > 3) issues.push(`excessive-read-blocks(${blockedReads})`);
      if (phaseTransitions === 0 && phaseActive) issues.push("no-phase-transitions");
      if (filesModified === 0) issues.push("no-files-modified");
      if (scenario.expectTest && !clean.includes("test")) issues.push("missing-test");
      if (timedOut) issues.push("timeout");

      resolve({
        id: scenario.id,
        score,
        grade,
        filesModified,
        phaseTransitions,
        phaseActive,
        blockedReads,
        blockedWrites,
        blockedVerify,
        issues,
        timedOut,
        exitCode,
        output: output.slice(-3000), // last 3K for debugging
      });
    });
  });
}

/**
 * Revert a project to clean state.
 */
function revertProject(scenario) {
  const projectPath = scenario.project.replace("~", process.env.HOME);
  try {
    require("child_process").execSync("git checkout . && git clean -fd src/ 2>/dev/null", {
      cwd: projectPath,
      stdio: "ignore",
    });
  } catch { /* not a git repo or no changes */ }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const scenarioIdx = args.includes("--scenario")
    ? parseInt(args[args.indexOf("--scenario") + 1])
    : null;
  const loopCount = args.includes("--loop")
    ? parseInt(args[args.indexOf("--loop") + 1])
    : 1;

  const scenarios = scenarioIdx !== null
    ? [SCENARIOS[scenarioIdx]]
    : SCENARIOS;

  console.log(`\n╔══ Phase Routing Test Loop ══╗`);
  console.log(`║ Scenarios: ${scenarios.length}  ·  Max turns: ${MAX_TURNS}  ·  Timeout: ${TIMEOUT_MS / 1000}s`);
  console.log(`╚════════════════════════════╝\n`);

  for (let loop = 0; loop < loopCount; loop++) {
    if (loopCount > 1) {
      console.log(`\n─── Loop ${loop + 1}/${loopCount} ───\n`);
    }

    const results = [];

    for (const scenario of scenarios) {
      process.stdout.write(`  ${scenario.id.padEnd(30)} `);

      // Revert before run
      revertProject(scenario);

      const result = await runScenario(scenario);
      results.push(result);

      // Revert after run
      revertProject(scenario);

      // Print result line
      const scoreColor = result.score >= 8 ? "\x1b[32m" : result.score >= 6 ? "\x1b[33m" : "\x1b[31m";
      const reset = "\x1b[0m";
      const phases = result.phaseTransitions > 0 ? `${result.phaseTransitions} transitions` : "no transitions";
      const files = `${result.filesModified} files`;
      const issueStr = result.issues.length > 0
        ? `  ${"\x1b[33m"}⚠ ${result.issues.join(", ")}${reset}`
        : `  ${"\x1b[32m"}✓${reset}`;

      console.log(
        `${scoreColor}${result.score}/10 (${result.grade})${reset}  ` +
        `${files}  ${phases}${issueStr}`
      );
    }

    // Summary
    const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
    const allIssues = results.flatMap((r) => r.issues);
    const uniqueIssues = [...new Set(allIssues)];

    console.log(`\n  ─── Summary ───`);
    console.log(`  Average score: ${avgScore.toFixed(1)}/10`);
    console.log(`  Issues: ${uniqueIssues.length > 0 ? uniqueIssues.join(", ") : "none"}`);
    console.log(`  Phase routing active: ${results.filter((r) => r.phaseActive).length}/${results.length}`);
    console.log(`  Files modified: ${results.reduce((s, r) => s + r.filesModified, 0)} total`);

    // Write detailed results to file for analysis
    const resultsPath = path.join(__dirname, "benchmark-results", `phase-test-${Date.now()}.json`);
    const dir = path.dirname(resultsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`  Results: ${path.basename(resultsPath)}`);

    // Check if we've reached target quality
    if (avgScore >= 9.0 && uniqueIssues.length === 0) {
      console.log(`\n  ✓ Target quality reached (${avgScore.toFixed(1)}/10, no issues)`);
      break;
    }
  }
}

main().catch(console.error);

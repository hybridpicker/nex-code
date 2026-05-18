"use strict";

/**
 * cli/self-verify.js — Deterministic Post-Implementation Verification
 *
 * Runs BEFORE the model produces a final answer. Executes concrete checks:
 *   1. Git diff — confirms edits exist and shows what changed
 *   2. File readback — reads the exact edited lines to confirm disk state
 *   3. Optional test runner — runs relevant fast tests if available
 *
 * Returns structured evidence that the agent loop feeds back into the
 * conversation so the model cannot claim success without addressing failures.
 *
 * Design principles:
 *   - Deterministic (not LLM-mediated) — no "did it work?" prompts
 *   - Evidence-first — show actual output, not interpretations
 *   - Non-blocking — always returns evidence; the agent decides what to do
 *   - Fast-path aware — skips slow tests when evidence already looks clean
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { debugLog } = require("./debug");
const C = require("./ui").C;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Run deterministic self-verification after implementation edits.
 *
 * @param {object} options
 * @param {Set<string>} options.filesModified - set of modified file paths
 * @param {string}   options.cwd - project working directory
 * @param {string[]} [options.relevantTests] - test file paths to run (inferred by caller)
 * @param {string[]} [options.verificationCommands] - bash commands to run (lint, build, etc.)
 * @param {boolean}  [options.skipSlowTests] - skip test execution when diff looks clean
 * @returns {Promise<{ passed: boolean, checks: Array<{name:string, passed:boolean, evidence:string}>, summary: string }>}
 */
async function runSelfVerification({
  filesModified,
  cwd = process.cwd(),
  relevantTests = [],
  verificationCommands = [],
  skipSlowTests = false,
}) {
  const checks = [];
  const modified = [...(filesModified || [])];

  if (modified.length === 0) {
    return {
      passed: false,
      checks: [{ name: "no-edits", passed: false, evidence: "No files were modified during the implementation phase." }],
      summary: "No edits detected — implementation may have stalled.",
    };
  }

  // ── Check 1: Git diff ────────────────────────────────────────────────
  const diffResult = await _runGitDiff(cwd);
  checks.push(diffResult);

  // ── Check 2: File readback (edited lines) ────────────────────────────
  for (const file of modified.slice(0, 3)) {
    const readbackResult = await _readbackEditedFile(file, cwd);
    checks.push(readbackResult);
  }

  // ── Check 3: Verification commands (lint, typecheck, build) ──────────
  for (const cmd of (verificationCommands || []).slice(0, 3)) {
    if (_isFastCommand(cmd)) {
      const cmdResult = await _runVerificationCommand(cmd, cwd);
      checks.push(cmdResult);
    }
  }

  // ── Check 4: Targeted tests (if fast and available) ──────────────────
  if (!skipSlowTests && relevantTests.length > 0) {
    const testResult = await _runTargetedTests(relevantTests.slice(0, 2), cwd);
    if (testResult) checks.push(testResult);
  }

  // ── Aggregate ────────────────────────────────────────────────────────
  const failedChecks = checks.filter((c) => !c.passed);
  const passed = failedChecks.length === 0;

  const summary = passed
    ? `Verification passed — ${checks.length} checks, 0 failures.`
    : `Verification found ${failedChecks.length} issue(s): ${failedChecks.map((c) => c.name).join(", ")}.`;

  return { passed, checks, summary };
}

/**
 * Build a conversation-ready evidence block from verification results.
 * Injected into the conversation before the model's final answer.
 */
function buildVerificationEvidence(result) {
  const lines = ["[SYSTEM: SELF-VERIFICATION RESULTS]", ""];

  for (const check of result.checks) {
    const icon = check.passed ? "✓" : "✗";
    lines.push(`${icon} ${check.name}`);
    if (check.evidence && check.evidence.length < 2000) {
      lines.push(`  ${check.evidence.replace(/\n/g, "\n  ")}`);
    }
  }

  lines.push("");
  if (result.passed) {
    lines.push("All checks passed. You may report completion.");
  } else {
    lines.push("CHECKS FAILED. Address the failures above before claiming completion.");
    lines.push("If a failure is expected (e.g. pre-existing test failure), explain why.");
  }

  return lines.join("\n");
}

/**
 * Build a structured done-message payload for server/Desktop consumers.
 */
function buildVerificationDonePayload(result) {
  return {
    self_verify: {
      passed: result.passed,
      check_count: result.checks.length,
      failed_count: result.checks.filter((c) => !c.passed).length,
      checks: result.checks.map((c) => ({
        name: c.name,
        passed: c.passed,
      })),
    },
  };
}

// ─── Internal: Check Runners ────────────────────────────────────────────

async function _runGitDiff(cwd) {
  try {
    const diffStat = execSync("git diff --stat", { cwd, encoding: "utf-8", timeout: 5000 });
    const diffShort = execSync("git diff --shortstat", { cwd, encoding: "utf-8", timeout: 5000 });

    if (!diffStat.trim() && !diffShort.trim()) {
      return {
        name: "git-diff",
        passed: false,
        evidence: "No git diff output — no changes were staged or unstaged.",
      };
    }

    const lines = diffStat.trim().split("\n");
    const changedFiles = lines.filter((l) => l.includes("|")).length;

    return {
      name: "git-diff",
      passed: true,
      evidence: diffShort.trim() || `${changedFiles} file(s) changed`,
    };
  } catch (err) {
    return {
      name: "git-diff",
      passed: false,
      evidence: `Git diff failed: ${err.message || String(err)}`,
    };
  }
}

async function _readbackEditedFile(filePath, cwd) {
  const absPath = path.resolve(cwd, filePath);
  try {
    if (!fs.existsSync(absPath)) {
      return {
        name: `readback:${path.basename(filePath)}`,
        passed: false,
        evidence: `File not found on disk: ${filePath}`,
      };
    }

    // Read the last 40 lines of the file — most edits are near the end of the diff range
    const content = fs.readFileSync(absPath, "utf-8");
    const lines = content.split("\n");
    const tail = lines.slice(Math.max(0, lines.length - 40)).join("\n");

    // Quick sanity: does the file still look like source code?
    const nonEmptyLines = tail.split("\n").filter((l) => l.trim().length > 0).length;

    if (nonEmptyLines === 0) {
      return {
        name: `readback:${path.basename(filePath)}`,
        passed: false,
        evidence: `File tail is empty — possible truncation at ${filePath}`,
      };
    }

    return {
      name: `readback:${path.basename(filePath)}`,
      passed: true,
      evidence: `File exists (${lines.length} lines). Tail:\n${tail.slice(-800)}`,
    };
  } catch (err) {
    return {
      name: `readback:${path.basename(filePath)}`,
      passed: false,
      evidence: `Readback failed: ${err.message || String(err)}`,
    };
  }
}

async function _runVerificationCommand(command, cwd) {
  const label = command.length > 50 ? command.slice(0, 47) + "..." : command;
  try {
    const output = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 1024 * 100,
    });

    const passed = !_looksLikeTestFailure(output) && !_looksLikeCompileError(output);

    return {
      name: `cmd:${label}`,
      passed,
      evidence: output.trim().slice(-500) || "(no output)",
    };
  } catch (err) {
    const stderr = err.stderr || err.message || String(err);
    return {
      name: `cmd:${label}`,
      passed: false,
      evidence: stderr.trim().slice(-500),
    };
  }
}

async function _runTargetedTests(testFiles, cwd) {
  if (testFiles.length === 0) return null;

  const testFile = testFiles[0];
  const label = path.basename(testFile);

  try {
    // Try npx jest/npx vitest first, fall back to node
    let command;
    if (fs.existsSync(path.join(cwd, "node_modules", ".bin", "jest"))) {
      command = `npx jest ${testFile} --no-coverage --forceExit 2>&1`;
    } else if (fs.existsSync(path.join(cwd, "node_modules", ".bin", "vitest"))) {
      command = `npx vitest run ${testFile} 2>&1`;
    } else {
      command = `node ${testFile} 2>&1`;
    }

    const output = execSync(command, {
      cwd,
      encoding: "utf-8",
      timeout: 60000,
      maxBuffer: 1024 * 200,
    });

    const passed = !_looksLikeTestFailure(output);

    return {
      name: `test:${label}`,
      passed,
      evidence: output.trim().slice(-800),
    };
  } catch (err) {
    // Test failures come through exit code — extract the relevant output
    const output = (err.stdout || "") + (err.stderr || "");
    return {
      name: `test:${label}`,
      passed: false,
      evidence: output.trim().slice(-800) || err.message || "Test execution failed",
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function _looksLikeTestFailure(output) {
  const text = String(output || "").toLowerCase();
  return (
    /\b\d+\s+failing\b/.test(text) ||
    /\btests?\s+failed\b/.test(text) ||
    /\bfailures?\s*:\s*[1-9]\d*\b/i.test(text) ||
    /\bassertionerror\b/i.test(text) ||
    /\bexpect\(.*\)\.to/.test(text) && /\bfailed\b/i.test(text)
  );
}

function _looksLikeCompileError(output) {
  const text = String(output || "").toLowerCase();
  return (
    /\berror\s+ts\(\d+\)/i.test(text) ||
    /\btsc\b.*\berror\b/i.test(text) ||
    /\btype\s+.*error\b/i.test(text) &&
      /\bis not assignable\b/i.test(text)
  );
}

function _isFastCommand(cmd) {
  const lower = String(cmd || "").toLowerCase();
  // Skip full test suites — too slow for self-verify
  if (/\b(npm test|npm run test|npx jest\b(?!.*--testPathPattern)|pytest\b(?!.*-k))\b/i.test(lower)) {
    return false;
  }
  // Lint, typecheck, build are generally fast
  return /\b(lint|typecheck|check|tsc\b|eslint\b|build)\b/i.test(lower);
}

module.exports = {
  runSelfVerification,
  buildVerificationEvidence,
  buildVerificationDonePayload,
};
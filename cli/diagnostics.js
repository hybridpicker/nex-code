/**
 * cli/diagnostics.js — Built-in Lints and Diagnostics
 * Scans content for secrets, TODOs, and other issues.
 */

const { C } = require("./ui");
const { SECRET_PATTERNS } = require("../scripts/secret-scan");

const ISSUE_PATTERNS = [
  { name: "TODO", regex: /\bTODO\b/i, severity: "warn" },
  { name: "FIXME", regex: /\bFIXME\b/i, severity: "warn" },
  {
    name: "Debugger",
    regex: /\bdebugger\b/,
    severity: "error",
    ext: [".js", ".ts", ".jsx", ".tsx"],
  },
  {
    name: "eval()",
    regex: /\beval\s*\(/,
    severity: "warn",
    ext: [".js", ".ts", ".jsx", ".tsx"],
  },
  {
    name: "Console Log",
    regex: /\bconsole\.log\(/,
    severity: "info",
    ext: [".js", ".ts", ".jsx", ".tsx"],
  },
  {
    name: "ANSI Code",
    regex: /\\x1b\[[0-9;]*m/,
    severity: "warn",
    message: "Avoid hardcoded ANSI codes; use cli/ui.js instead.",
  },
];

/**
 * Run diagnostics on file content.
 * @param {string} filePath
 * @param {string} content
 * @returns {Array<{line: number, message: string, severity: 'error'|'warn'|'info'}>}
 */
function runDiagnostics(filePath, content) {
  const lines = content.split("\n");
  const diagnostics = [];
  const ext = filePath ? `.${filePath.split(".").pop()}` : "";

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    const lineNumber = i + 1;

    // Check secrets (always error)
    for (const p of SECRET_PATTERNS) {
      if (p.regex.test(lineContent)) {
        diagnostics.push({
          line: lineNumber,
          message: `Potential secret detected: ${p.category}`,
          severity: "error",
        });
      }
    }

    // Check other issues
    for (const p of ISSUE_PATTERNS) {
      // Filter by extension if specified
      if (p.ext && !p.ext.includes(ext)) continue;

      if (p.regex.test(lineContent)) {
        diagnostics.push({
          line: lineNumber,
          message: p.message || `Found ${p.name}`,
          severity: p.severity || "warn",
        });
      }
    }
  }

  // File-level diagnostics
  if (lines.length > 500) {
    diagnostics.push({
      line: 0,
      message: `Large file detected (${lines.length} lines). Consider refactoring.`,
      severity: "info",
    });
  }

  return diagnostics;
}

/**
 * Get current process memory usage in MB.
 * @returns {Object} Memory usage with rss (Resident Set Size) and heapUsed in MB.
 */
function getMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  return {
    rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
    heapUsed: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
  };
}

module.exports = { runDiagnostics, getMemoryUsage };

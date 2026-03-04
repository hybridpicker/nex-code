/**
 * cli/diagnostics.js — Built-in Lints and Diagnostics
 * Scans content for secrets, TODOs, and other issues.
 */

const { C } = require('./ui');

const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{20,}/i },
  { name: 'Anthropic API Key', regex: /sk-ant-api03-[a-zA-Z0-9-]{90,}/i },
  { name: 'Google Gemini API Key', regex: /AIzaSy[a-zA-Z0-9_-]{30,45}/i },
  { name: 'Slack Token', regex: /xox[bpors]-[a-zA-Z0-9-]+/i },
  { name: 'AWS Access Key', regex: /AKIA[A-Z0-9]{16}/i },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/i },
  { name: 'Private Key', regex: /BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY/i },
  { name: 'Database URL', regex: /\b(postgres|mongodb|mysql|redis):\/\/[^"'\s]+/i },
  { name: 'Hardcoded Secret', regex: /(password|secret|token|api_key|apikey|api_secret|access_token|auth_token|credentials)\s*[:=]\s*['"'][^'"']{8,}/i }
];

const ISSUE_PATTERNS = [
  { name: 'TODO', regex: /\bTODO\b/i, severity: 'warn' },
  { name: 'FIXME', regex: /\bFIXME\b/i, severity: 'warn' },
  { name: 'Debugger', regex: /\bdebugger\b/, severity: 'error', ext: ['.js', '.ts', '.jsx', '.tsx'] },
  { name: 'eval()', regex: /\beval\s*\(/, severity: 'warn', ext: ['.js', '.ts', '.jsx', '.tsx'] },
  { name: 'Console Log', regex: /\bconsole\.log\(/, severity: 'info', ext: ['.js', '.ts', '.jsx', '.tsx'] },
  { name: 'ANSI Code', regex: /\\x1b\[[0-9;]*m/, severity: 'warn', message: 'Avoid hardcoded ANSI codes; use cli/ui.js instead.' }
];

/**
 * Run diagnostics on file content.
 * @param {string} filePath 
 * @param {string} content 
 * @returns {Array<{line: number, message: string, severity: 'error'|'warn'|'info'}>}
 */
function runDiagnostics(filePath, content) {
  const lines = content.split('\n');
  const diagnostics = [];
  const ext = filePath ? `.${filePath.split('.').pop()}` : '';

  for (let i = 0; i < lines.length; i++) {
    const lineContent = lines[i];
    const lineNumber = i + 1;

    // Check secrets (always error)
    for (const p of SECRET_PATTERNS) {
      if (p.regex.test(lineContent)) {
        diagnostics.push({
          line: lineNumber,
          message: `Potential secret detected: ${p.name}`,
          severity: 'error'
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
          severity: p.severity || 'warn'
        });
      }
    }
  }

  // File-level diagnostics
  if (lines.length > 500) {
    diagnostics.push({
      line: 0,
      message: `Large file detected (${lines.length} lines). Consider refactoring.`,
      severity: 'info'
    });
  }

  return diagnostics;
}

module.exports = { runDiagnostics };

/**
 * cli/diagnostics.js — Built-in Lints and Diagnostics
 * Scans content for secrets, TODOs, and other issues.
 */

const { C } = require('./ui');

// Secret patterns (adapted from hooks/pre-push)
const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{20,}/i },
  { name: 'AWS Access Key', regex: /AKIA[A-Z0-9]{16}/i },
  { name: 'GitHub Token', regex: /ghp_[a-zA-Z0-9]{36}/i },
  { name: 'GitHub OAuth', regex: /gho_[a-zA-Z0-9]{36}/i },
  { name: 'Private Key', regex: /BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY/i },
  { name: 'Hardcoded Secret', regex: /(password|secret|token|api_key|apikey|api_secret|access_token|auth_token|credentials)\s*[:=]\s*['"'][^'"']{8,}/i }
];

const ISSUE_PATTERNS = [
  { name: 'TODO', regex: /\bTODO\b/i, severity: 'warn' },
  { name: 'FIXME', regex: /\bFIXME\b/i, severity: 'warn' },
  { name: 'Console Log', regex: /\bconsole\.log\(/, severity: 'info' }
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
      if (p.regex.test(lineContent)) {
        diagnostics.push({
          line: lineNumber,
          message: `Found ${p.name}`,
          severity: p.severity || 'warn'
        });
      }
    }
  }

  return diagnostics;
}

module.exports = { runDiagnostics };

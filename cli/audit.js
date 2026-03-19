/**
 * cli/audit.js — Tool Execution Audit Logging
 * Logs all tool executions to .nex/audit/YYYY-MM-DD.jsonl
 */

const fs = require('fs');
const path = require('path');

let _auditEnabled = process.env.NEX_AUDIT !== 'false';
let _auditDir = null;

/**
 * Get the audit directory, creating it if needed.
 */
function getAuditDir() {
  if (_auditDir) return _auditDir;
  _auditDir = path.join(process.cwd(), '.nex', 'audit');
  if (!fs.existsSync(_auditDir)) {
    fs.mkdirSync(_auditDir, { recursive: true });
  }
  return _auditDir;
}

/**
 * Get today's audit log file path.
 */
function getAuditLogPath() {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(getAuditDir(), `${date}.jsonl`);
}

/**
 * Log a tool execution.
 * @param {object} entry
 * @param {string} entry.tool - Tool name
 * @param {object} entry.args - Tool arguments (sanitized)
 * @param {string} entry.result - Truncated result
 * @param {number} entry.duration - Execution time in ms
 * @param {boolean} entry.success - Whether the tool succeeded
 * @param {string} [entry.model] - Active model ID
 * @param {string} [entry.provider] - Active provider
 */
function logToolExecution(entry) {
  if (!_auditEnabled) return;

  try {
    const record = {
      timestamp: new Date().toISOString(),
      tool: entry.tool,
      args: sanitizeArgs(entry.args),
      resultLength: typeof entry.result === 'string' ? entry.result.length : 0,
      resultPreview: typeof entry.result === 'string' ? entry.result.substring(0, 200) : '',
      duration: entry.duration || 0,
      success: entry.success !== false,
      model: entry.model || null,
      provider: entry.provider || null,
    };

    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(getAuditLogPath(), line, 'utf-8');
  } catch {
    // Audit logging should never break the tool
  }
}

/**
 * Sanitize tool arguments to avoid logging sensitive data.
 */
function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return {};

  const sanitized = {};
  for (const [key, value] of Object.entries(args)) {
    // Mask potential secrets
    if (/key|token|password|secret|credential/i.test(key)) {
      sanitized[key] = '***';
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = value.substring(0, 500) + `... (${value.length} chars)`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Read audit log entries for a given date range.
 * @param {object} [options]
 * @param {string} [options.date] - Specific date (YYYY-MM-DD)
 * @param {number} [options.days] - Number of days back (default: 1)
 * @param {string} [options.tool] - Filter by tool name
 * @returns {Array<object>}
 */
function readAuditLog(options = {}) {
  const dir = getAuditDir();
  const days = options.days || 1;
  const entries = [];

  for (let i = 0; i < days; i++) {
    const date = options.date || new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const logPath = path.join(dir, `${date}.jsonl`);

    if (!fs.existsSync(logPath)) continue;

    const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (options.tool && entry.tool !== options.tool) continue;
        entries.push(entry);
      } catch {
        // skip corrupt entries
      }
    }

    // Only read one day if specific date provided
    if (options.date) break;
  }

  return entries;
}

/**
 * Get audit summary statistics.
 * @param {number} [days=1]
 * @returns {{ totalCalls: number, byTool: Object, avgDuration: number, successRate: number }}
 */
function getAuditSummary(days = 1) {
  const entries = readAuditLog({ days });

  if (entries.length === 0) {
    return { totalCalls: 0, byTool: {}, avgDuration: 0, successRate: 1 };
  }

  const byTool = {};
  let totalDuration = 0;
  let successCount = 0;

  for (const entry of entries) {
    byTool[entry.tool] = (byTool[entry.tool] || 0) + 1;
    totalDuration += entry.duration || 0;
    if (entry.success) successCount++;
  }

  return {
    totalCalls: entries.length,
    byTool,
    avgDuration: Math.round(totalDuration / entries.length),
    successRate: successCount / entries.length,
  };
}

/**
 * Enable or disable audit logging.
 */
function setAuditEnabled(enabled) {
  _auditEnabled = enabled;
}

function isAuditEnabled() {
  return _auditEnabled;
}

/**
 * Reset internal state (for testing).
 */
function _reset() {
  _auditDir = null;
}

module.exports = {
  logToolExecution,
  sanitizeArgs,
  readAuditLog,
  getAuditSummary,
  setAuditEnabled,
  isAuditEnabled,
  getAuditLogPath,
  _reset,
};

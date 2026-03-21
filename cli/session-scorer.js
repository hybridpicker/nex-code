/**
 * cli/session-scorer.js — Session Quality Scorer
 * Analyzes a saved nex-code session and returns a quality score 0-10.
 *
 * Usage:
 *   const { scoreSession, scoreMessages } = require('./session-scorer');
 *   const result = scoreSession('my-session');
 *   // => { score: 8.5, issues: ['sed -n used (line 42)'], summary: '...' }
 *
 *   // Or score a messages array directly (without loading from disk):
 *   const result = scoreMessages(messages);
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract all tool calls from a messages array.
 * Handles both Anthropic-style (content blocks with type:'tool_use') and
 * OpenAI-style (tool_calls array on assistant messages).
 * @param {Array} messages
 * @returns {Array<{ name: string, input: object, index: number }>}
 */
function extractToolCalls(messages) {
  const calls = [];
  messages.forEach((msg, msgIndex) => {
    if (msg.role !== 'assistant') return;

    // Anthropic style: content is an array of blocks
    if (Array.isArray(msg.content)) {
      msg.content.forEach((block) => {
        if (block && block.type === 'tool_use') {
          calls.push({ name: block.name || '', input: block.input || {}, index: msgIndex });
        }
      });
    }

    // OpenAI style: tool_calls array
    if (Array.isArray(msg.tool_calls)) {
      msg.tool_calls.forEach((tc) => {
        const name = tc.function?.name || tc.name || '';
        let input = {};
        try {
          input = typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.function?.arguments || tc.input || {});
        } catch { /* unparseable args — leave empty */ }
        calls.push({ name, input, index: msgIndex });
      });
    }
  });
  return calls;
}

/**
 * Extract tool results from a messages array.
 * @param {Array} messages
 * @returns {Array<{ content: string, index: number }>}
 */
function extractToolResults(messages) {
  const results = [];
  messages.forEach((msg, msgIndex) => {
    // OpenAI-style: role:'user' with content array containing type:'tool_result' blocks
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      msg.content.forEach((block) => {
        if (block && block.type === 'tool_result') {
          const content = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((b) => (typeof b === 'string' ? b : b.text || '')).join('')
              : JSON.stringify(block.content || '');
          results.push({ content, index: msgIndex });
        }
      });
    }
    // Anthropic-style: role:'tool' with string content
    if (msg.role === 'tool') {
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content || '');
      results.push({ content, index: msgIndex });
    }
  });
  return results;
}

/**
 * Get the last assistant text response from a messages array.
 * Returns the trimmed text, or '' if there is none.
 * @param {Array} messages
 * @returns {string}
 */
function getLastAssistantText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    // String content
    if (typeof msg.content === 'string') {
      return msg.content.trim();
    }

    // Array of content blocks — join text blocks
    if (Array.isArray(msg.content)) {
      const text = msg.content
        .filter((b) => b && (b.type === 'text' || typeof b === 'string'))
        .map((b) => (typeof b === 'string' ? b : b.text || ''))
        .join('')
        .trim();
      if (text) return text;
    }
  }
  return '';
}

/**
 * Count how many times each tool-call "signature" appears.
 * Signature = name + JSON-serialized input (normalised).
 * @param {Array} toolCalls
 * @returns {Map<string, number>}
 */
function countDuplicateToolCalls(toolCalls) {
  const counts = new Map();
  for (const tc of toolCalls) {
    let inputKey;
    try {
      inputKey = JSON.stringify(tc.input);
    } catch {
      inputKey = String(tc.input);
    }
    const key = `${tc.name}|${inputKey}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

// ─── Core Scorer ─────────────────────────────────────────────────────────────

/**
 * Analyse a messages array and return a quality score + issues list.
 *
 * @param {Array} messages — Array of { role, content, ... } message objects
 * @returns {{ score: number, issues: string[], summary: string }}
 */
function scoreMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      score: 0,
      issues: ['Empty or invalid session — no messages to analyse'],
      summary: 'No messages found',
    };
  }

  let score = 10.0;
  const issues = [];

  const toolCalls = extractToolCalls(messages);
  const toolResults = extractToolResults(messages);
  const totalToolCalls = toolCalls.length;

  // ── 1. Loop-warning injected (-2.0) ───────────────────────────────────────
  // Detect the SYSTEM WARNING messages injected by agent.js loop detection.
  const loopWarningInjected = messages.some(
    (msg) =>
      msg.role === 'user' &&
      typeof msg.content === 'string' &&
      msg.content.startsWith('[SYSTEM WARNING]') &&
      (msg.content.includes('edited') || msg.content.includes('bash command') || msg.content.includes('grep pattern'))
  );
  if (loopWarningInjected) {
    score -= 2.0;
    issues.push('Loop-warning was fired during session (repeated file edits or bash commands)');
  }

  // ── 2. sed -n used (-1.5) ─────────────────────────────────────────────────
  const sedNCall = toolCalls.find((tc) => {
    const cmd = tc.input?.command || tc.input?.cmd || '';
    return /\bsed\s+-n\b/.test(cmd);
  });
  if (sedNCall) {
    const cmd = (sedNCall.input?.command || sedNCall.input?.cmd || '').slice(0, 80);
    score -= 1.5;
    issues.push(`sed -n anti-pattern used: ${cmd}`);
  }

  // ── 3. grep with >20 context lines (-1.0) ─────────────────────────────────
  const heavyGrepCall = toolCalls.find((tc) => {
    if (tc.name !== 'grep' && tc.name !== 'bash' && tc.name !== 'ssh_exec') return false;
    // Detect -C / -A / -B flags with values > 20
    const cmd = tc.input?.command || tc.input?.cmd || '';
    const pattern = tc.input?.pattern || '';
    const combined = `${cmd} ${pattern}`;
    return /(?:-[CAB]|--context|--after|--before)\s*[=\s]?([2-9][1-9]|\d{3,})/.test(combined) ||
           /grep.*-[CAB]\s*([2-9][1-9]|\d{3,})/.test(combined);
  });
  if (heavyGrepCall) {
    score -= 1.0;
    issues.push('grep used with >20 context lines (context flood risk)');
  }

  // ── 4. Session ends without diagnosis (-2.0) ──────────────────────────────
  const lastAssistantText = getLastAssistantText(messages);
  const endsWithoutDiagnosis =
    lastAssistantText.length < 50 ||
    // Ends with a bare question (nothing substantive before the "?")
    /^[^.!]{0,40}\?$/.test(lastAssistantText);
  if (endsWithoutDiagnosis) {
    score -= 2.0;
    const snippet = lastAssistantText.length > 0
      ? `"${lastAssistantText.slice(0, 60)}..."`
      : '(no assistant text found)';
    issues.push(`Session ends without diagnosis — last response too short or is only a question: ${snippet}`);
  }

  // ── 5. More than 40 tool calls (-1.5), more than 25 (-0.5) ───────────────
  if (totalToolCalls > 40) {
    score -= 1.5;
    issues.push(`Excessive tool calls: ${totalToolCalls} (>40 threshold)`);
  } else if (totalToolCalls > 25) {
    score -= 0.5;
    issues.push(`High tool call count: ${totalToolCalls} (>25 threshold)`);
  }

  // ── 6. Auto-compress triggered (-0.5) ─────────────────────────────────────
  // The agent logs "[auto-compressed" or "[context compacted" into the assistant stream.
  // The session messages may also contain injected system messages about compression.
  const autoCompressDetected = messages.some((msg) => {
    const text = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map((b) => (typeof b === 'string' ? b : b.text || '')).join('')
        : '';
    return /\[auto-compressed|context compacted|force-compressed/.test(text);
  });
  if (autoCompressDetected) {
    score -= 0.5;
    issues.push('Auto-compress triggered (context flood indicator)');
  }

  // ── 7. Repeated identical tool call (3+ times) (-1.0) ────────────────────
  const dupCounts = countDuplicateToolCalls(toolCalls);
  let worstDupCount = 0;
  let worstDupKey = '';
  for (const [key, count] of dupCounts) {
    if (count > worstDupCount) {
      worstDupCount = count;
      worstDupKey = key;
    }
  }
  if (worstDupCount >= 3) {
    const [dupName] = worstDupKey.split('|');
    score -= 1.0;
    issues.push(`Same tool call repeated ${worstDupCount}× (tool: ${dupName})`);
  }

  // ── 8. Stop-trigger ignored (-1.5) ────────────────────────────────────────
  // Detect: a tool result contained {"valid":true} but the session continued
  // (more tool calls appeared after the result index).
  let stopTriggerIgnored = false;
  for (const tr of toolResults) {
    if (tr.content && tr.content.includes('"valid":true')) {
      // Check whether tool calls continued after this message index
      const callsAfter = toolCalls.filter((tc) => tc.index > tr.index);
      if (callsAfter.length > 0) {
        stopTriggerIgnored = true;
        break;
      }
    }
  }
  if (stopTriggerIgnored) {
    score -= 1.5;
    issues.push('Stop-trigger ignored: tool result contained "valid":true but session continued with more tool calls');
  }

  // ── 9. SSH reconnect storm (-0.5) ─────────────────────────────────────────
  // ssh_exec calls in rapid succession (5+)
  const sshCalls = toolCalls.filter((tc) => tc.name === 'ssh_exec');
  if (sshCalls.length >= 5) {
    // Check if 5+ consecutive ssh calls exist (adjacent message indices)
    let maxConsecutive = 0;
    let current = 1;
    for (let i = 1; i < sshCalls.length; i++) {
      if (sshCalls[i].index <= sshCalls[i - 1].index + 2) {
        current++;
      } else {
        maxConsecutive = Math.max(maxConsecutive, current);
        current = 1;
      }
    }
    maxConsecutive = Math.max(maxConsecutive, current);
    if (maxConsecutive >= 5) {
      score -= 0.5;
      issues.push(`SSH reconnect storm: ${maxConsecutive} consecutive SSH calls`);
    }
  }

  // ── 10. Repeated read_file on same file (-1.0) ────────────────────────────
  // Detect read loops: same file read 3+ times (agent ignores context).
  const readFileCounts = new Map();
  for (const tc of toolCalls) {
    if (tc.name === 'read_file' && tc.input?.path) {
      const p = tc.input.path;
      readFileCounts.set(p, (readFileCounts.get(p) || 0) + 1);
    }
  }
  let worstReadCount = 0;
  let worstReadPath = '';
  for (const [p, count] of readFileCounts) {
    if (count > worstReadCount) { worstReadCount = count; worstReadPath = p; }
  }
  if (worstReadCount >= 3) {
    score -= 1.0;
    const shortPath = worstReadPath.split('/').slice(-2).join('/');
    issues.push(`read_file loop: "${shortPath}" read ${worstReadCount}× (file already in context)`);
  }

  // ── 11. Bash EXIT-error storm (-1.0) ──────────────────────────────────────
  // Count tool results starting with "EXIT" (non-zero bash exit codes).
  // 10+ EXIT errors in a session indicates repeated failed commands.
  const exitErrorCount = toolResults.filter((tr) => tr.content.startsWith('EXIT')).length;
  if (exitErrorCount >= 10) {
    score -= 1.0;
    issues.push(`Bash exit-error storm: ${exitErrorCount} tool results started with EXIT (repeated failing commands)`);
  } else if (exitErrorCount >= 5) {
    score -= 0.5;
    issues.push(`Repeated bash errors: ${exitErrorCount} tool results with non-zero exit code`);
  }

  // ── Clamp to [0, 10] ──────────────────────────────────────────────────────
  score = Math.max(0, Math.min(10, score));
  score = Math.round(score * 10) / 10; // 1 decimal place

  // ── Build summary ─────────────────────────────────────────────────────────
  const grade =
    score >= 9.0 ? 'A' :
    score >= 8.0 ? 'B' :
    score >= 7.0 ? 'C' :
    score >= 6.0 ? 'D' : 'F';

  const summary = issues.length === 0
    ? `Clean session — no quality issues detected (${totalToolCalls} tool calls)`
    : `${issues.length} issue${issues.length === 1 ? '' : 's'} found — ${totalToolCalls} tool calls`;

  return { score, grade, issues, summary };
}

// ─── File-based Entry Point ───────────────────────────────────────────────────

/**
 * Load a saved session and score it.
 *
 * @param {string} name — Session name (matches .nex/sessions/<name>.json)
 * @returns {{ score: number, grade: string, issues: string[], summary: string } | null}
 *   Returns null if the session file cannot be found/parsed.
 */
function scoreSession(name) {
  try {
    const { loadSession } = require('./session');
    const session = loadSession(name);
    if (!session) return null;
    const result = scoreMessages(session.messages || []);
    return result;
  } catch (err) {
    return null;
  }
}

// ─── Format helpers for CLI output ───────────────────────────────────────────

/**
 * Format a score result for terminal output.
 * Assumes the C colour object is available from ui.js.
 * @param {{ score, grade, issues, summary }} result
 * @param {object} [C] — colour strings from ui.js (optional, falls back to plain text)
 * @returns {string}
 */
function formatScore(result, C = null) {
  const { score, grade, issues, summary } = result;
  const dim = C?.dim || '';
  const reset = C?.reset || '';
  const green = C?.green || '';
  const yellow = C?.yellow || '';
  const red = C?.red || '';
  const cyan = C?.cyan || '';
  const bold = C?.bold || '';

  const color = score >= 8 ? green : score >= 6 ? yellow : red;
  let out = `\n${dim}  Session score: ${reset}${bold}${color}${score}/10 (${grade})${reset}`;
  if (summary) out += `  ${dim}${summary}${reset}`;
  if (issues.length > 0) {
    for (const issue of issues) {
      out += `\n  ${yellow}⚠${reset} ${dim}${issue}${reset}`;
    }
  }
  return out;
}

// ─── Score History ────────────────────────────────────────────────────────────

/**
 * Append a score entry to .nex/benchmark-history.json.
 * Creates the file (and .nex/ dir) if it doesn't exist.
 * Caps history at 100 entries (oldest dropped first).
 *
 * @param {number} score
 * @param {{ version?: string, model?: string, sessionName?: string, issues?: string[] }} meta
 */
function appendScoreHistory(score, meta = {}) {
  try {
    const nexDir = path.join(process.cwd(), '.nex');
    if (!fs.existsSync(nexDir)) fs.mkdirSync(nexDir, { recursive: true });

    const historyPath = path.join(nexDir, 'benchmark-history.json');
    let history = [];
    if (fs.existsSync(historyPath)) {
      try { history = JSON.parse(fs.readFileSync(historyPath, 'utf-8')); } catch { history = []; }
    }
    if (!Array.isArray(history)) history = [];

    const grade =
      score >= 9.0 ? 'A' :
      score >= 8.0 ? 'B' :
      score >= 7.0 ? 'C' :
      score >= 6.0 ? 'D' : 'F';

    const entry = {
      date: new Date().toISOString(),
      version: meta.version || null,
      model: meta.model || null,
      score,
      grade,
      sessionName: meta.sessionName || null,
      issues: Array.isArray(meta.issues) ? meta.issues : [],
    };

    history.push(entry);

    // Keep latest 100 entries
    if (history.length > 100) history = history.slice(history.length - 100);

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  } catch { /* non-critical — never crash the caller */ }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  scoreMessages,
  scoreSession,
  formatScore,
  appendScoreHistory,
  // exported for testing
  _extractToolCalls: extractToolCalls,
  _extractToolResults: extractToolResults,
  _getLastAssistantText: getLastAssistantText,
  _countDuplicateToolCalls: countDuplicateToolCalls,
};

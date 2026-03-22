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
 * Get text content from up to N last assistant messages.
 * Returns an array of non-empty trimmed strings (newest first).
 * @param {Array} messages
 * @param {number} n
 * @returns {string[]}
 */
function getLastNAssistantTexts(messages, n) {
  const texts = [];
  for (let i = messages.length - 1; i >= 0 && texts.length < n; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content.trim();
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter((b) => b && (b.type === 'text' || typeof b === 'string'))
        .map((b) => (typeof b === 'string' ? b : b.text || ''))
        .join('')
        .trim();
    }
    if (text) texts.push(text);
  }
  return texts;
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
      (msg.content.includes('edited') || msg.content.includes('bash command') || msg.content.includes('grep pattern') ||
       msg.content.includes('re-read') || msg.content.includes('already in your context'))
  );
  if (loopWarningInjected) {
    score -= 2.0;
    issues.push('Loop-warning was fired during session (repeated file edits, bash commands, or re-reads)');
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
  // Check the last 3 assistant turns — if ANY of them contains a substantive
  // diagnosis (>100 chars, not ending with a bare question), the session is
  // considered properly concluded. This prevents false positives for valid
  // short closings like "Done." or "Verstanden." after a full explanation.
  //
  // Skip this check entirely when there are no assistant messages at all.
  // A session with only a user message is an incomplete/aborted capture (the
  // autosave was written before the first LLM response), not a bad session.
  // Penalising it as "no diagnosis" would be a false positive.
  const hasAnyAssistantMsg = messages.some((m) => m.role === 'assistant');
  const lastAssistantText = getLastAssistantText(messages);
  const lastThreeTexts = getLastNAssistantTexts(messages, 3);
  const hasSubstantiveDiagnosis = lastThreeTexts.some(
    (t) => t.length > 100 && !/^[^.!]{0,40}\?$/.test(t)
  );
  const endsWithoutDiagnosis =
    hasAnyAssistantMsg &&
    !hasSubstantiveDiagnosis && (
      lastAssistantText.length < 50 ||
      /^[^.!]{0,40}\?$/.test(lastAssistantText)
    );
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
  // ssh_exec calls in rapid succession (8+) — threshold raised from 7 to 8
  // because complex Jarvis debugging legitimately needs 5-7 SSH calls
  // (api.log + api-error.log + grep for each error + targeted search + verify)
  const sshCalls = toolCalls.filter((tc) => tc.name === 'ssh_exec');
  if (sshCalls.length >= 8) {
    // Check if 8+ consecutive ssh calls exist (adjacent message indices)
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
    if (maxConsecutive >= 8) {
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

  // ── 11. Per-file grep flood (-0.75) ───────────────────────────────────────
  // Detect when the agent greps the same target file 3+ times with different
  // patterns instead of using the file content already in context.
  const grepFilePatterns = new Map(); // file → Set of distinct patterns
  for (const tc of toolCalls) {
    if (tc.name === 'grep' && tc.input?.path && tc.input?.pattern) {
      const f = tc.input.path;
      if (!grepFilePatterns.has(f)) grepFilePatterns.set(f, new Set());
      grepFilePatterns.get(f).add(tc.input.pattern);
    }
  }
  let worstGrepFileCount = 0;
  let worstGrepFile = '';
  for (const [f, patterns] of grepFilePatterns) {
    if (patterns.size > worstGrepFileCount) {
      worstGrepFileCount = patterns.size;
      worstGrepFile = f;
    }
  }
  if (worstGrepFileCount >= 3) {
    score -= 0.75;
    const shortPath = worstGrepFile.split('/').slice(-2).join('/');
    issues.push(`grep flood on single file: "${shortPath}" searched ${worstGrepFileCount}× with different patterns (file already in context)`);
  }

  // ── 12. Bash EXIT-error storm (-1.0) ──────────────────────────────────────
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

  // ── 13. LLM output loop: repeated content in assistant message (-1.5) ────
  // Detect when a single assistant message is very long AND contains a high
  // proportion of repeated content (same sliding-window block seen 3+ times).
  // Mirrors the detectAndTruncateRepetition logic in agent.js.
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter((b) => b && (b.type === 'text' || typeof b === 'string'))
        .map((b) => (typeof b === 'string' ? b : b.text || ''))
        .join('');
    }
    if (text.length <= 5000) continue;

    // Build sliding windows of 3 sentences and count occurrences
    const sentences = text.split(/(?<=\. )/).filter((s) => s.trim().length > 0);
    if (sentences.length < 6) continue;

    const windowCounts = new Map();
    for (let wi = 0; wi <= sentences.length - 3; wi++) {
      const window = sentences.slice(wi, wi + 3).join('').trim();
      if (window.length > 30) windowCounts.set(window, (windowCounts.get(window) || 0) + 1);
    }

    let maxWinCount = 0;
    let maxWinKey = '';
    for (const [key, count] of windowCounts) {
      if (count > maxWinCount) { maxWinCount = count; maxWinKey = key; }
    }

    if (maxWinCount < 3) continue;

    // Estimate repeated-content ratio: repeated window * count / total length
    const repeatedChars = maxWinKey.length * maxWinCount;
    const ratio = repeatedChars / text.length;
    // Trigger on high ratio OR clearly excessive repetition count (≥10)
    if (ratio >= 0.4 || maxWinCount >= 10) {
      score -= 1.5;
      issues.push(`llm output loop: assistant message repeated content detected (${maxWinCount}× same paragraph, ${Math.round(ratio * 100)}% repeated)`);
      break; // Only penalise once
    }
  }

  // ── 14a. Plan written without reading files (-2.0) ───────────────────────
  // Detect when a plan was presented without any prior tool calls (totalToolCalls
  // near zero). This means the LLM invented data structures, routes, and db types
  // from training knowledge rather than reading the actual codebase.
  {
    const readToolNames = new Set(['read_file', 'list_directory', 'search_files', 'glob', 'grep']);
    const hasReadCalls = messages.some(m => {
      if (Array.isArray(m.tool_calls)) return m.tool_calls.some(tc => readToolNames.has(tc.function?.name));
      if (Array.isArray(m.content)) return m.content.some(b => b.type === 'tool_use' && readToolNames.has(b.name));
      return false;
    });
    const hasPlanText = messages.some(m =>
      m.role === 'assistant' && typeof m.content === 'string' &&
      (m.content.includes('## Steps') || m.content.includes('/plan approve'))
    );
    if (hasPlanText && !hasReadCalls) {
      score -= 2.0;
      issues.push('plan written without reading any files — LLM invented data structures from training knowledge (hallucination risk)');
    }
  }

  // ── 14. BLOCKED tool calls (-0.5 per, max -1.5) ─────────────────────────
  // A BLOCKED message means the agent attempted something it shouldn't have.
  const blockedResults = toolResults.filter((tr) => tr.content.startsWith('BLOCKED:'));
  if (blockedResults.length > 0) {
    const penalty = Math.min(blockedResults.length * 0.5, 1.5);
    score -= penalty;
    issues.push(`${blockedResults.length} tool call${blockedResults.length === 1 ? '' : 's'} blocked (agent attempted denied actions)`);
  }

  // ── 15. Super-nuclear context wipes (-1.0 per wipe, max -2.0) ─────────────
  // Super-nuclear fires indicate the session collapsed under context pressure.
  // Detected via the warning messages injected after each wipe.
  const superNuclearCount = messages.filter((msg) => {
    const text = typeof msg.content === 'string' ? msg.content : '';
    return /\[SYSTEM WARNING\] Context wiped \d+×/.test(text);
  }).length;
  if (superNuclearCount > 0) {
    const penalty = Math.min(superNuclearCount * 1.0, 2.0);
    score -= penalty;
    issues.push(`Super-nuclear context wipe fired ${superNuclearCount}× (context collapse — task too large or read loops)`);
  }

  // ── 16. Bash used instead of dedicated tool (cat/ls/find) (-0.25 per type, max -0.75) ──
  // The system prompt explicitly instructs: read_file (not bash cat/head/tail),
  // list_directory (not bash ls), glob (not bash find).
  // Penalise sessions where the LLM ignores this — each violation type counts once.
  {
    let catViaBash = false;
    let lsViaBash  = false;
    let findViaBash = false;
    for (const tc of toolCalls) {
      if (tc.name !== 'bash') continue;
      const cmd = (tc.input?.command || tc.input?.cmd || '').trim();
      // Skip: write redirects (cat > file, cat >> file), heredocs (<<), and remote SSH usage
      const isWrite = /cat\s*>/.test(cmd) || /<</.test(cmd);
      if (!isWrite && /\bcat\s+\S/.test(cmd)) catViaBash = true;
      // ls used for directory listing (not piped into grep/wc for file-type filtering,
      // and not part of a build/test command)
      if (/^\s*ls(\s|$)/.test(cmd) && !/npm|yarn|pnpm|make|git\b/.test(cmd)) lsViaBash = true;
      // find used for file discovery (not -exec or complex pipeline)
      if (/\bfind\s+\S/.test(cmd) && !/git\b|npm\b|-exec\b/.test(cmd)) findViaBash = true;
    }
    const bashToolViolations = [catViaBash, lsViaBash, findViaBash].filter(Boolean).length;
    if (bashToolViolations > 0) {
      const penalty = Math.min(bashToolViolations * 0.25, 0.75);
      score -= penalty;
      const types = [];
      if (catViaBash)  types.push('cat (use read_file)');
      if (lsViaBash)   types.push('ls (use list_directory)');
      if (findViaBash) types.push('find (use glob)');
      issues.push(`bash used instead of dedicated tool: ${types.join(', ')}`);
    }
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
  _getLastNAssistantTexts: getLastNAssistantTexts,
  _countDuplicateToolCalls: countDuplicateToolCalls,
};

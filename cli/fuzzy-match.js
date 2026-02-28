/**
 * cli/fuzzy-match.js — Fuzzy Text Matching for Edit Operations
 * Handles whitespace normalization and approximate string matching
 * to recover from common LLM edit failures.
 */

const { levenshtein } = require('./tool-validator');

/**
 * Normalize whitespace for comparison:
 * - Tabs → 2 spaces
 * - Trim trailing whitespace per line
 * - Collapse multiple inline spaces to one (except leading indentation)
 * - Normalize line endings to \n
 */
function normalizeWhitespace(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .split('\n')
    .map(line => {
      // Trim trailing whitespace
      line = line.replace(/\s+$/, '');
      // Collapse multiple inline spaces (preserve leading indentation)
      const match = line.match(/^(\s*)(.*)/);
      if (!match) return line;
      const indent = match[1];
      const rest = match[2].replace(/ {2,}/g, ' ');
      return indent + rest;
    })
    .join('\n');
}

/**
 * Try to find `needle` in `haystack` with whitespace normalization.
 * Returns the ACTUAL text from haystack (not the normalized version),
 * or null if not found.
 *
 * Strategy:
 * 1. Exact match (fast path — caller should check this first)
 * 2. Normalize both and find the match, then map back to original positions
 */
function fuzzyFindText(haystack, needle) {
  // Fast path: exact match
  if (haystack.includes(needle)) return needle;

  const normHaystack = normalizeWhitespace(haystack);
  const normNeedle = normalizeWhitespace(needle);

  if (!normHaystack.includes(normNeedle)) return null;

  // Map normalized position back to original text using line-based matching
  const haystackLines = haystack.split('\n');
  const normHaystackLines = normHaystack.split('\n');
  const normNeedleLines = normNeedle.split('\n');

  // Find which normalized line the match starts on
  const needleFirstLine = normNeedleLines[0];
  const needleLastLine = normNeedleLines[normNeedleLines.length - 1];

  for (let i = 0; i <= normHaystackLines.length - normNeedleLines.length; i++) {
    // Check if this position matches in normalized form
    let matches = true;
    for (let j = 0; j < normNeedleLines.length; j++) {
      if (normHaystackLines[i + j] !== normNeedleLines[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      // Return the original lines from haystack
      return haystackLines.slice(i, i + normNeedleLines.length).join('\n');
    }
  }

  // Fallback: single-line needle within a line
  if (normNeedleLines.length === 1) {
    for (let i = 0; i < normHaystackLines.length; i++) {
      const idx = normHaystackLines[i].indexOf(normNeedle);
      if (idx !== -1) {
        // Map character position back — this is approximate for single-line matches
        // Return the full original line's content at the approximate position
        return haystackLines[i];
      }
    }
  }

  return null;
}

/**
 * Sliding-window Levenshtein search to find the most similar substring.
 * Used for error messages when fuzzyFindText also fails.
 *
 * @param {string} content - The file content to search in
 * @param {string} target - The text we're looking for
 * @returns {{ text: string, distance: number, line: number } | null}
 */
function findMostSimilar(content, target) {
  if (!content || !target) return null;

  const contentLines = content.split('\n');
  const targetLines = target.split('\n');
  const targetLineCount = targetLines.length;

  if (contentLines.length === 0 || targetLineCount === 0) return null;

  // For single-line targets, search line by line
  if (targetLineCount === 1) {
    let best = null;
    let bestDist = Infinity;

    // Sample lines if too many (max 200 candidates)
    const step = Math.max(1, Math.floor(contentLines.length / 200));
    for (let i = 0; i < contentLines.length; i += step) {
      const line = contentLines[i];
      if (!line.trim()) continue;
      const dist = levenshtein(line.trim(), target.trim());
      if (dist < bestDist) {
        bestDist = dist;
        best = { text: line, distance: dist, line: i + 1 };
      }
    }

    // Refine: check neighbors of best match
    if (best && step > 1) {
      const center = best.line - 1;
      const lo = Math.max(0, center - step);
      const hi = Math.min(contentLines.length - 1, center + step);
      for (let i = lo; i <= hi; i++) {
        const line = contentLines[i];
        if (!line.trim()) continue;
        const dist = levenshtein(line.trim(), target.trim());
        if (dist < bestDist) {
          bestDist = dist;
          best = { text: line, distance: dist, line: i + 1 };
        }
      }
    }

    // Reject if too different (> 30% of target length)
    if (!best || bestDist > Math.ceil(target.length * 0.3)) return null;
    return best;
  }

  // Multi-line: sliding window of targetLineCount lines
  let best = null;
  let bestDist = Infinity;
  const maxWindows = contentLines.length - targetLineCount + 1;
  if (maxWindows <= 0) return null;

  const step = Math.max(1, Math.floor(maxWindows / 200));

  for (let i = 0; i < maxWindows; i += step) {
    const window = contentLines.slice(i, i + targetLineCount).join('\n');
    const dist = levenshtein(window, target);
    if (dist < bestDist) {
      bestDist = dist;
      best = { text: window, distance: dist, line: i + 1 };
    }
  }

  // Refine around best match
  if (best && step > 1) {
    const center = best.line - 1;
    const lo = Math.max(0, center - step);
    const hi = Math.min(maxWindows - 1, center + step);
    for (let i = lo; i <= hi; i++) {
      const window = contentLines.slice(i, i + targetLineCount).join('\n');
      const dist = levenshtein(window, target);
      if (dist < bestDist) {
        bestDist = dist;
        best = { text: window, distance: dist, line: i + 1 };
      }
    }
  }

  // Reject if too different (> 30% of target length)
  if (!best || bestDist > Math.ceil(target.length * 0.3)) return null;
  return best;
}

module.exports = { normalizeWhitespace, fuzzyFindText, findMostSimilar };

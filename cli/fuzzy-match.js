/**
 * cli/fuzzy-match.js — Fuzzy Text Matching for Edit Operations
 * Handles whitespace normalization and approximate string matching
 * to recover from common LLM edit failures.
 */

const { levenshtein } = require('./tool-validator');

// Constants for fuzzy matching
const MAX_CANDIDATES = 200;
const SIMILARITY_THRESHOLD = 0.3;  // Reject if distance > 30% of target length
const TAB_SPACES = 2;

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
    .replace(/\t/g, ' '.repeat(TAB_SPACES))
    .split('\n')
    .map(line => {
      const trimmed = line.replace(/\s+$/, '');
      const match = trimmed.match(/^(\s*)(.*)/);
      if (!match) return trimmed;
      const [, indent, rest] = match;
      return indent + rest.replace(/ {2,}/g, ' ');
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
    return findBestSingleLineMatch(contentLines, target);
  }

  // Multi-line: sliding window search
  return findBestMultiLineMatch(contentLines, target, targetLineCount);
}

/**
 * Calculate sampling step size for large files
 * @param {number} totalItems - Total items to search
 * @returns {number} Step size (at least 1)
 */
function calculateStep(totalItems) {
  return Math.max(1, Math.floor(totalItems / MAX_CANDIDATES));
}

/**
 * Check if distance is within acceptable threshold
 * @param {number} distance - Levenshtein distance
 * @param {number} targetLength - Length of target string
 * @returns {boolean}
 */
function isWithinThreshold(distance, targetLength) {
  return distance <= Math.ceil(targetLength * SIMILARITY_THRESHOLD);
}

/**
 * Find best matching single line
 * @param {string[]} contentLines - File content split by lines
 * @param {string} target - Target text to find
 * @returns {{text: string, distance: number, line: number}|null}
 */
function findBestSingleLineMatch(contentLines, target) {
  const targetTrimmed = target.trim();
  const step = calculateStep(contentLines.length);
  
  let best = null;
  let bestDist = Infinity;

  // Coarse search with sampling
  for (let i = 0; i < contentLines.length; i += step) {
    const line = contentLines[i];
    if (!line.trim()) continue;
    
    const dist = levenshtein(line.trim(), targetTrimmed);
    if (dist < bestDist) {
      bestDist = dist;
      best = { text: line, distance: dist, line: i + 1 };
    }
  }

  // Refine around best match
  if (best && step > 1) {
    const refined = refineSingleLineSearch(contentLines, targetTrimmed, best, step);
    best = refined || best;
    bestDist = best.distance;
  }

  return isWithinThreshold(bestDist, target.length) ? best : null;
}

/**
 * Refine search by checking neighbors of best match
 * @param {string[]} contentLines - File content lines
 * @param {string} targetTrimmed - Trimmed target
 * @param {Object} best - Current best match
 * @param {number} step - Sampling step
 * @returns {Object|null} Refined match or null
 */
function refineSingleLineSearch(contentLines, targetTrimmed, best, step) {
  const center = best.line - 1;
  const lo = Math.max(0, center - step);
  const hi = Math.min(contentLines.length - 1, center + step);
  
  let bestDist = best.distance;
  let result = null;

  for (let i = lo; i <= hi; i++) {
    const line = contentLines[i];
    if (!line.trim()) continue;
    
    const dist = levenshtein(line.trim(), targetTrimmed);
    if (dist < bestDist) {
      bestDist = dist;
      result = { text: line, distance: dist, line: i + 1 };
    }
  }

  return result;
}

/**
 * Find best matching multi-line window
 * @param {string[]} contentLines - File content split by lines
 * @param {string} target - Target text to find
 * @param {number} windowSize - Number of lines in window
 * @returns {{text: string, distance: number, line: number}|null}
 */
function findBestMultiLineMatch(contentLines, target, windowSize) {
  const maxWindows = contentLines.length - windowSize + 1;
  if (maxWindows <= 0) return null;

  const step = calculateStep(maxWindows);
  
  let best = null;
  let bestDist = Infinity;

  // Coarse search with sampling
  for (let i = 0; i < maxWindows; i += step) {
    const window = contentLines.slice(i, i + windowSize).join('\n');
    const dist = levenshtein(window, target);
    if (dist < bestDist) {
      bestDist = dist;
      best = { text: window, distance: dist, line: i + 1 };
    }
  }

  // Refine around best match
  if (best && step > 1) {
    const refined = refineMultiLineSearch(contentLines, target, best, step, windowSize, maxWindows);
    best = refined || best;
    bestDist = best.distance;
  }

  return isWithinThreshold(bestDist, target.length) ? best : null;
}

/**
 * Refine multi-line search around best match
 * @param {string[]} contentLines - File content lines
 * @param {string} target - Target text
 * @param {Object} best - Current best match
 * @param {number} step - Sampling step
 * @param {number} windowSize - Window size in lines
 * @param {number} maxWindows - Maximum window positions
 * @returns {Object|null} Refined match or null
 */
function refineMultiLineSearch(contentLines, target, best, step, windowSize, maxWindows) {
  const center = best.line - 1;
  const lo = Math.max(0, center - step);
  const hi = Math.min(maxWindows - 1, center + step);
  
  let bestDist = best.distance;
  let result = null;

  for (let i = lo; i <= hi; i++) {
    const window = contentLines.slice(i, i + windowSize).join('\n');
    const dist = levenshtein(window, target);
    if (dist < bestDist) {
      bestDist = dist;
      result = { text: window, distance: dist, line: i + 1 };
    }
  }

  return result;
}

module.exports = { normalizeWhitespace, fuzzyFindText, findMostSimilar };

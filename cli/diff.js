/**
 * cli/diff.js — Diff Display + Confirmation
 * Minimal Myers-diff-lite for line-by-line comparison.
 */

const { C } = require('./ui');
const { confirm, getAutoConfirm } = require('./safety');

/**
 * Simple LCS-based line diff (no external deps)
 * Returns array of { type: 'same'|'add'|'remove', line: string }
 */
function diffLines(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result = [];

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  let i = m,
    j = n;
  const ops = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'same', line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', line: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'remove', line: oldLines[i - 1] });
      i--;
    }
  }

  return ops;
}

/**
 * Show colored diff for edit_file (old_text → new_text) with context lines
 */
function showEditDiff(filePath, oldText, newText, contextLines = 3) {
  console.log(`\n${C.bold}${C.cyan}  Diff: ${filePath}${C.reset}`);
  const ops = diffLines(oldText, newText);

  // Find changed regions and show with context
  const changed = [];
  ops.forEach((op, idx) => {
    if (op.type !== 'same') changed.push(idx);
  });

  if (changed.length === 0) {
    console.log(`${C.gray}    (no changes)${C.reset}`);
    return;
  }

  const showFrom = Math.max(0, changed[0] - contextLines);
  const showTo = Math.min(ops.length, changed[changed.length - 1] + contextLines + 1);

  if (showFrom > 0) console.log(`${C.gray}    ...${C.reset}`);

  for (let k = showFrom; k < showTo; k++) {
    const op = ops[k];
    switch (op.type) {
      case 'remove':
        console.log(`${C.red}  - ${op.line}${C.reset}`);
        break;
      case 'add':
        console.log(`${C.green}  + ${op.line}${C.reset}`);
        break;
      default:
        console.log(`${C.gray}    ${op.line}${C.reset}`);
    }
  }

  if (showTo < ops.length) console.log(`${C.gray}    ...${C.reset}`);
  console.log();
}

/**
 * Show diff for write_file when file already exists
 */
function showWriteDiff(filePath, oldContent, newContent) {
  console.log(`\n${C.bold}${C.cyan}  File exists — showing changes: ${filePath}${C.reset}`);
  const ops = diffLines(oldContent, newContent);

  let changes = 0;
  for (const op of ops) {
    if (op.type !== 'same') changes++;
  }

  if (changes === 0) {
    console.log(`${C.gray}    (identical content)${C.reset}`);
    return;
  }

  // Show up to 30 diff lines
  let shown = 0;
  for (const op of ops) {
    if (shown >= 30) {
      console.log(`${C.gray}    ...(${changes - shown} more changes)${C.reset}`);
      break;
    }
    switch (op.type) {
      case 'remove':
        console.log(`${C.red}  - ${op.line}${C.reset}`);
        shown++;
        break;
      case 'add':
        console.log(`${C.green}  + ${op.line}${C.reset}`);
        shown++;
        break;
      default:
        if (shown > 0) {
          // Only show context around changes
          console.log(`${C.gray}    ${op.line}${C.reset}`);
        }
    }
  }
  console.log();
}

/**
 * Show preview for new file creation
 */
function showNewFilePreview(filePath, content) {
  console.log(`\n${C.bold}${C.cyan}  New file: ${filePath}${C.reset}`);
  const lines = content.split('\n');
  const preview = lines.slice(0, 20);
  for (const line of preview) {
    console.log(`${C.green}  + ${line}${C.reset}`);
  }
  if (lines.length > 20) {
    console.log(`${C.gray}    ...+${lines.length - 20} more lines${C.reset}`);
  }
  console.log();
}

/**
 * Confirm file change (edit or write)
 */
async function confirmFileChange(action) {
  if (getAutoConfirm()) return true;
  return confirm(`  ${action}?`);
}

module.exports = { diffLines, showEditDiff, showWriteDiff, showNewFilePreview, confirmFileChange };

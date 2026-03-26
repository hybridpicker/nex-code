/**
 * cli/diff.js — Diff Display + Confirmation
 * Minimal Myers-diff-lite for line-by-line comparison.
 */

const path = require("path");
const { C } = require("./ui");
const { T, isDark } = require("./theme");
const { confirm, getAutoConfirm } = require("./safety");

/**
 * Simple LCS-based line diff (no external deps)
 * Returns array of { type: 'same'|'add'|'remove', line: string }
 */
const DIFF_LINE_LIMIT = 2000;

function diffLines(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result = [];

  // Guard against OOM on huge files — fall back to simple summary
  const m = oldLines.length;
  const n = newLines.length;
  if (m > DIFF_LINE_LIMIT || n > DIFF_LINE_LIMIT) {
    // Produce a simplified diff: all old lines removed, all new lines added
    for (const line of oldLines) result.push({ type: "remove", line });
    for (const line of newLines) result.push({ type: "add", line });
    return result;
  }
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
      ops.unshift({ type: "same", line: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "add", line: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: "remove", line: oldLines[i - 1] });
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
    if (op.type !== "same") changed.push(idx);
  });

  if (changed.length === 0) {
    console.log(`${C.gray}    (no changes)${C.reset}`);
    return;
  }

  const showFrom = Math.max(0, changed[0] - contextLines);
  const showTo = Math.min(
    ops.length,
    changed[changed.length - 1] + contextLines + 1,
  );

  if (showFrom > 0) console.log(`${C.gray}    ...${C.reset}`);

  for (let k = showFrom; k < showTo; k++) {
    const op = ops[k];
    switch (op.type) {
      case "remove":
        console.log(`${C.red}  - ${op.line}${C.reset}`);
        break;
      case "add":
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
  console.log(
    `\n${C.bold}${C.cyan}  File exists — showing changes: ${filePath}${C.reset}`,
  );
  const ops = diffLines(oldContent, newContent);

  let changes = 0;
  for (const op of ops) {
    if (op.type !== "same") changes++;
  }

  if (changes === 0) {
    console.log(`${C.gray}    (identical content)${C.reset}`);
    return;
  }

  // Show up to 30 diff lines
  let shown = 0;
  for (const op of ops) {
    if (shown >= 30) {
      console.log(
        `${C.gray}    ...(${changes - shown} more changes)${C.reset}`,
      );
      break;
    }
    switch (op.type) {
      case "remove":
        console.log(`${C.red}  - ${op.line}${C.reset}`);
        shown++;
        break;
      case "add":
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
  const lines = content.split("\n");
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

/**
 * Show side-by-side diff view for two texts
 * @param {string} filePath
 * @param {string} oldText
 * @param {string} newText
 * @param {number} width - total terminal width (default: 80)
 */
function showSideBySideDiff(filePath, oldText, newText, width) {
  const termWidth = width || process.stdout.columns || 80;
  const colWidth = Math.floor((termWidth - 3) / 2); // 3 for separator "│"

  console.log(`\n${C.bold}${C.cyan}  Side-by-side: ${filePath}${C.reset}`);
  console.log(
    `  ${C.dim}${"─".repeat(colWidth)}┬${"─".repeat(colWidth)}${C.reset}`,
  );

  const ops = diffLines(oldText, newText);

  // Pair up removals and additions
  const pairs = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].type === "same") {
      pairs.push({ left: ops[i].line, right: ops[i].line, type: "same" });
      i++;
    } else if (ops[i].type === "remove") {
      // Collect consecutive removes, then matching adds
      const removes = [];
      while (i < ops.length && ops[i].type === "remove") {
        removes.push(ops[i].line);
        i++;
      }
      const adds = [];
      while (i < ops.length && ops[i].type === "add") {
        adds.push(ops[i].line);
        i++;
      }
      const maxLen = Math.max(removes.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        pairs.push({
          left: j < removes.length ? removes[j] : "",
          right: j < adds.length ? adds[j] : "",
          type: "changed",
        });
      }
    } else if (ops[i].type === "add") {
      pairs.push({ left: "", right: ops[i].line, type: "changed" });
      i++;
    }
  }

  // Show max 40 pairs around changes
  const changedIdxs = pairs
    .map((p, idx) => (p.type !== "same" ? idx : -1))
    .filter((x) => x >= 0);
  if (changedIdxs.length === 0) {
    console.log(`  ${C.gray}(no changes)${C.reset}`);
    return;
  }

  const showFrom = Math.max(0, changedIdxs[0] - 2);
  const showTo = Math.min(
    pairs.length,
    changedIdxs[changedIdxs.length - 1] + 3,
  );

  const pad = (s, w) => {
    const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
    return visible.length >= w
      ? s.substring(0, w)
      : s + " ".repeat(w - visible.length);
  };

  if (showFrom > 0)
    console.log(
      `  ${C.dim}${"·".repeat(colWidth)}┊${"·".repeat(colWidth)}${C.reset}`,
    );

  for (let k = showFrom; k < showTo; k++) {
    const p = pairs[k];
    if (p.type === "same") {
      console.log(
        `  ${C.gray}${pad(p.left, colWidth)}${C.reset}│${C.gray}${pad(p.right, colWidth)}${C.reset}`,
      );
    } else {
      const leftCol = p.left
        ? `${C.red}${pad(p.left, colWidth)}${C.reset}`
        : `${pad("", colWidth)}`;
      const rightCol = p.right
        ? `${C.green}${pad(p.right, colWidth)}${C.reset}`
        : `${pad("", colWidth)}`;
      console.log(`  ${leftCol}│${rightCol}`);
    }
  }

  if (showTo < pairs.length)
    console.log(
      `  ${C.dim}${"·".repeat(colWidth)}┊${"·".repeat(colWidth)}${C.reset}`,
    );
  console.log(
    `  ${C.dim}${"─".repeat(colWidth)}┴${"─".repeat(colWidth)}${C.reset}\n`,
  );
}

/**
 * Claude Code-style diff display
 * Header: ⏺ Update(relPath) or ⏺ Create(relPath)
 * Summary: ⎿  Added N lines, removed M lines
 * Numbered context/change lines with ···  hunk separators
 */
function showClaudeDiff(filePath, oldContent, newContent, options = {}) {
  const label = options.label || "Update";
  const contextSize = options.context || 3;
  const annotations = options.annotations || []; // Array of { line, message, severity }
  const relPath = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;

  const ops = diffLines(oldContent, newContent);

  // Assign line numbers to each op
  let oldLine = 1,
    newLine = 1;
  for (const op of ops) {
    if (op.type === "same") {
      op.oldLine = oldLine++;
      op.newLine = newLine++;
    } else if (op.type === "remove") {
      op.oldLine = oldLine++;
      op.newLine = null;
    } else {
      op.oldLine = null;
      op.newLine = newLine++;
    }
  }

  // Count additions and removals
  let added = 0,
    removed = 0;
  for (const op of ops) {
    if (op.type === "add") added++;
    else if (op.type === "remove") removed++;
  }

  // Header
  console.log(
    `\n${C.green}⏺${C.reset} ${C.bold}${label}(${relPath})${C.reset}`,
  );

  if (added === 0 && removed === 0) {
    console.log(`  ${C.dim}⎿  (no changes)${C.reset}\n`);
    return;
  }

  // Summary
  const parts = [];
  if (added > 0) parts.push(`Added ${added} line${added !== 1 ? "s" : ""}`);
  if (removed > 0)
    parts.push(`removed ${removed} line${removed !== 1 ? "s" : ""}`);

  const issueCount = annotations.length;
  if (issueCount > 0) {
    const errors = annotations.filter((a) => a.severity === "error").length;
    const warns = annotations.filter((a) => a.severity === "warn").length;
    const info = annotations.filter((a) => a.severity === "info").length;
    const issueParts = [];
    if (errors > 0)
      issueParts.push(
        `${C.red}${errors} error${errors !== 1 ? "s" : ""}${C.dim}`,
      );
    if (warns > 0)
      issueParts.push(
        `${C.yellow}${warns} warning${warns !== 1 ? "s" : ""}${C.dim}`,
      );
    if (info > 0)
      issueParts.push(`${C.cyan}${info} info${info !== 1 ? "s" : ""}${C.dim}`);
    parts.push(`found ${issueParts.join(", ")}`);
  }

  console.log(`  ${C.dim}⎿  ${parts.join(", ")}${C.reset}`);

  // Build hunks: groups of changes with surrounding context
  const changeIndices = [];
  ops.forEach((op, i) => {
    if (op.type !== "same") changeIndices.push(i);
  });

  const hunks = [];
  let hunkStart = null,
    hunkEnd = null;
  for (const ci of changeIndices) {
    const start = Math.max(0, ci - contextSize);
    const end = Math.min(ops.length - 1, ci + contextSize);
    if (hunkStart === null) {
      hunkStart = start;
      hunkEnd = end;
    } else if (start <= hunkEnd + 1) {
      hunkEnd = end;
    } else {
      hunks.push([hunkStart, hunkEnd]);
      hunkStart = start;
      hunkEnd = end;
    }
  }
  if (hunkStart !== null) hunks.push([hunkStart, hunkEnd]);

  const PAD = "      "; // 6-char left padding
  const termWidth = process.stdout.columns || 120;

  // Pad a plain-text string (no ANSI) to terminal width, then wrap with bg+fg
  function diffLine(bg, fg, text) {
    const visible = text.replace(/\x1b\[[0-9;]*m/g, "");
    const padded = text + " ".repeat(Math.max(0, termWidth - visible.length));
    return `${bg}${fg}${padded}${C.reset}`;
  }

  for (let h = 0; h < hunks.length; h++) {
    if (h > 0) console.log(`${PAD}${C.dim}···${C.reset}`);
    const [from, to] = hunks[h];
    for (let i = from; i <= to; i++) {
      const op = ops[i];
      const lineNum = op.newLine != null ? op.newLine : op.oldLine;
      const numStr = String(lineNum).padStart(4);

      // Check for annotations on this line (only for additions or unchanged context)
      const lineAnnotations =
        op.type !== "remove"
          ? annotations.filter((a) => a.line === op.newLine)
          : [];

      if (op.type === "remove") {
        console.log(
          diffLine(T.diff_rem_bg, C.red, `${PAD}${numStr} - ${op.line}`),
        );
      } else if (op.type === "add") {
        console.log(
          diffLine(T.diff_add_bg, C.green, `${PAD}${numStr} + ${op.line}`),
        );
      } else {
        console.log(`${PAD}${C.dim}${numStr}  ${C.reset}${op.line}`);
      }

      // Render annotations
      for (const ann of lineAnnotations) {
        let color = C.cyan;
        let prefix = "ℹ";
        if (ann.severity === "error") {
          color = C.red;
          prefix = "✖";
        } else if (ann.severity === "warn") {
          color = C.yellow;
          prefix = "⚠";
        }

        console.log(`${PAD}     ${color}${prefix} ${ann.message}${C.reset}`);
      }
    }
  }
  console.log();
}

/**
 * Claude Code-style new file display
 */
function showClaudeNewFile(filePath, content, options = {}) {
  const relPath = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;
  const lines = content.split("\n");
  const annotations = options.annotations || [];

  console.log(`\n${C.green}⏺${C.reset} ${C.bold}Create(${relPath})${C.reset}`);

  const parts = [`${lines.length} line${lines.length !== 1 ? "s" : ""}`];
  const issueCount = annotations.length;
  if (issueCount > 0) {
    const errors = annotations.filter((a) => a.severity === "error").length;
    const warns = annotations.filter((a) => a.severity === "warn").length;
    const info = annotations.filter((a) => a.severity === "info").length;
    const issueParts = [];
    if (errors > 0)
      issueParts.push(
        `${C.red}${errors} error${errors !== 1 ? "s" : ""}${C.dim}`,
      );
    if (warns > 0)
      issueParts.push(
        `${C.yellow}${warns} warning${warns !== 1 ? "s" : ""}${C.dim}`,
      );
    if (info > 0)
      issueParts.push(`${C.cyan}${info} info${info !== 1 ? "s" : ""}${C.dim}`);
    parts.push(`found ${issueParts.join(", ")}`);
  }
  console.log(`  ${C.dim}⎿  ${parts.join(", ")}${C.reset}`);

  const PAD = "      ";
  const termWidth = process.stdout.columns || 120;
  const show = Math.min(lines.length, 20);
  for (let i = 0; i < show; i++) {
    const numStr = String(i + 1).padStart(4);
    const lineNum = i + 1;
    const lineAnnotations = annotations.filter((a) => a.line === lineNum);

    const text = `${PAD}${numStr} + ${lines[i]}`;
    const visible = text.replace(/\x1b\[[0-9;]*m/g, "");
    const padded = text + " ".repeat(Math.max(0, termWidth - visible.length));
    console.log(`${T.diff_add_bg}${C.green}${padded}${C.reset}`);

    // Render annotations
    for (const ann of lineAnnotations) {
      let color = C.cyan;
      let prefix = "ℹ";
      if (ann.severity === "error") {
        color = C.red;
        prefix = "✖";
      } else if (ann.severity === "warn") {
        color = C.yellow;
        prefix = "⚠";
      }
      console.log(`${PAD}     ${color}${prefix} ${ann.message}${C.reset}`);
    }
  }
  if (lines.length > 20) {
    console.log(
      `${PAD}${C.dim}   ...+${lines.length - 20} more lines${C.reset}`,
    );
  }
  console.log();
}

module.exports = {
  diffLines,
  showEditDiff,
  showWriteDiff,
  showNewFilePreview,
  confirmFileChange,
  showSideBySideDiff,
  showClaudeDiff,
  showClaudeNewFile,
};

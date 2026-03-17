/**
 * cli/file-history.js — In-session undo/redo for file changes + named git snapshots
 */

const fs = require('fs').promises;
const { execSync } = require('child_process');

const MAX_HISTORY = 50;

const undoStack = [];
const redoStack = [];

/**
 * Record a file change for undo/redo support.
 * @param {string} tool - Tool that made the change (write_file, edit_file, patch_file)
 * @param {string} filePath - Absolute path to the file
 * @param {string|null} oldContent - Previous content (null if file was newly created)
 * @param {string} newContent - New content after the change
 */
function recordChange(tool, filePath, oldContent, newContent) {
  undoStack.push({
    tool,
    filePath,
    oldContent,
    newContent,
    timestamp: Date.now(),
  });
  // Trim to max history
  while (undoStack.length > MAX_HISTORY) undoStack.shift();
  // New edit clears redo stack
  redoStack.length = 0;
}

/**
 * Undo the last file change.
 * @returns {Promise<{ tool: string, filePath: string, wasCreated: boolean }|null>} Info about what was undone, or null if nothing to undo
 */
async function undo() {
  if (undoStack.length === 0) return null;
  const entry = undoStack.pop();

  if (entry.oldContent === null) {
    // File was newly created — delete it
    try { await fs.unlink(entry.filePath); } catch { /* ignore */ }
  } else {
    await fs.writeFile(entry.filePath, entry.oldContent, 'utf-8');
  }

  redoStack.push(entry);
  return {
    tool: entry.tool,
    filePath: entry.filePath,
    wasCreated: entry.oldContent === null,
  };
}

/**
 * Redo the last undone change.
 * @returns {Promise<{ tool: string, filePath: string }|null>} Info about what was redone, or null if nothing to redo
 */
async function redo() {
  if (redoStack.length === 0) return null;
  const entry = redoStack.pop();

  await fs.writeFile(entry.filePath, entry.newContent, 'utf-8');
  undoStack.push(entry);

  return {
    tool: entry.tool,
    filePath: entry.filePath,
  };
}

/**
 * Get change history.
 * @param {number} [limit=10] - Max entries to return
 * @returns {Array<{ tool: string, filePath: string, timestamp: number }>}
 */
function getHistory(limit = 10) {
  return undoStack.slice(-limit).reverse().map((e) => ({
    tool: e.tool,
    filePath: e.filePath,
    timestamp: e.timestamp,
  }));
}

function getUndoCount() { return undoStack.length; }
function getRedoCount() { return redoStack.length; }

function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
}

// ─── Named Git Snapshots ──────────────────────────────────────────────────────

const SNAPSHOT_PREFIX = 'nex-snapshot';

/**
 * Create a named git snapshot using git stash.
 * The snapshot captures all current working-tree changes.
 *
 * @param {string} [name] - Optional label; auto-generated if omitted
 * @param {string} [cwd] - Working directory (defaults to process.cwd())
 * @returns {{ name: string, label: string, ok: boolean, error?: string }}
 */
function createSnapshot(name, cwd = process.cwd()) {
  const label = name
    ? `${SNAPSHOT_PREFIX}-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}`
    : `${SNAPSHOT_PREFIX}-${Date.now()}`;
  try {
    // Check if there's anything to stash
    const status = execSync('git status --porcelain', { cwd, timeout: 10000 }).toString().trim();
    if (!status) {
      return { name: label, label, ok: false, error: 'No changes to snapshot (working tree clean)' };
    }
    execSync(`git stash push -u -m "${label}"`, { cwd, timeout: 15000 });
    // Immediately pop so working tree is restored (we're just tagging the state)
    execSync('git stash pop', { cwd, timeout: 10000 });
    return { name: label, label, ok: true };
  } catch (err) {
    return { name: label, label, ok: false, error: err.message };
  }
}

/**
 * List all nex snapshots from git stash.
 *
 * @param {string} [cwd]
 * @returns {Array<{ index: number, label: string, shortName: string, date: string }>}
 */
function listSnapshots(cwd = process.cwd()) {
  try {
    const out = execSync('git stash list', { cwd, timeout: 10000 }).toString().trim();
    if (!out) return [];
    return out
      .split('\n')
      .map((line) => {
        // Format: stash@{N}: On branch: label
        const m = line.match(/^stash@\{(\d+)\}:\s+(?:WIP on [^:]+:\s+\S+\s+|On \S+:\s+)(.*)/);
        if (!m) return null;
        const raw = m[2].trim();
        if (!raw.startsWith(SNAPSHOT_PREFIX)) return null;
        return {
          index: parseInt(m[1], 10),
          label: raw,
          shortName: raw.replace(`${SNAPSHOT_PREFIX}-`, ''),
          date: line,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Restore a named snapshot (applies the stash onto the working tree).
 * Uses `git stash apply` to keep the stash entry around.
 *
 * @param {string|number} [target] - Snapshot label/shortName or stash index. Defaults to most recent.
 * @param {string} [cwd]
 * @returns {{ ok: boolean, label?: string, error?: string }}
 */
function restoreSnapshot(target, cwd = process.cwd()) {
  try {
    const snapshots = listSnapshots(cwd);
    if (snapshots.length === 0) {
      return { ok: false, error: 'No snapshots found' };
    }

    let entry;
    if (target === undefined || target === 'last') {
      entry = snapshots[0]; // most recent
    } else if (typeof target === 'number') {
      entry = snapshots.find((s) => s.index === target);
    } else {
      entry = snapshots.find(
        (s) => s.label === target || s.shortName === target || s.shortName.includes(String(target))
      );
    }

    if (!entry) {
      return { ok: false, error: `Snapshot not found: ${target}` };
    }

    execSync(`git stash apply stash@{${entry.index}}`, { cwd, timeout: 15000 });
    return { ok: true, label: entry.label };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  recordChange, undo, redo, getHistory, getUndoCount, getRedoCount, clearHistory,
  createSnapshot, listSnapshots, restoreSnapshot,
};

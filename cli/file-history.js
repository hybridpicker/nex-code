/**
 * cli/file-history.js — In-session undo/redo for file changes + named git snapshots
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const BLOB_THRESHOLD = 100 * 1024; // 100 KB

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
  // Persist to disk (fire-and-forget)
  persistEntry(undoStack[undoStack.length - 1]).catch(() => {});
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

function clearHistory({ diskToo = true } = {}) {
  undoStack.length = 0;
  redoStack.length = 0;
  // Also wipe persisted entries so they don't reload on next startup
  if (diskToo) {
    const dir = historyDir();
    fs.readdir(dir).then(files => {
      for (const f of files) {
        if (f.endsWith('.json')) fs.unlink(path.join(dir, f)).catch(() => {});
      }
    }).catch(() => {});
  }
}

// ─── Persistent History ───────────────────────────────────────────────────────

function historyDir() {
  return path.join(process.cwd(), '.nex', 'history');
}

function blobDir() {
  return path.join(historyDir(), 'blobs');
}

/**
 * Store content as a blob if it exceeds BLOB_THRESHOLD.
 * Returns { inline: true, content } or { inline: false, hash }.
 */
async function maybeStoreBlob(content, dir) {
  if (content === null || content === undefined) return { inline: true, content };
  if (Buffer.byteLength(content, 'utf-8') <= BLOB_THRESHOLD) {
    return { inline: true, content };
  }
  const hash = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  const bDir = path.join(dir, 'blobs');
  await fs.mkdir(bDir, { recursive: true });
  await fs.writeFile(path.join(bDir, hash), content, 'utf-8');
  return { inline: false, hash };
}

/**
 * Persist a single undo entry to .nex/history/{timestamp}-{basename}.json.
 * Fire-and-forget — errors are silently ignored by the caller.
 */
async function persistEntry(entry) {
  const dir = historyDir();
  await fs.mkdir(dir, { recursive: true });

  const safeName = path.basename(entry.filePath).replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `${entry.timestamp}-${safeName}.json`;

  const oldRef = await maybeStoreBlob(entry.oldContent, dir);
  const newRef = await maybeStoreBlob(entry.newContent, dir);

  const record = {
    tool: entry.tool,
    filePath: entry.filePath,
    timestamp: entry.timestamp,
    oldContent: oldRef.inline ? { inline: true, content: oldRef.content } : { inline: false, hash: oldRef.hash },
    newContent: newRef.inline ? { inline: true, content: newRef.content } : { inline: false, hash: newRef.hash },
  };

  await fs.writeFile(path.join(dir, filename), JSON.stringify(record), 'utf-8');
}

/**
 * Resolve a content reference — inline or blob.
 */
async function resolveContent(ref, dir) {
  if (!ref) return null;
  if (ref.inline) return ref.content;
  // Read from blob
  const blobPath = path.join(dir, 'blobs', ref.hash);
  return fs.readFile(blobPath, 'utf-8');
}

/**
 * Load persisted history entries from .nex/history/*.json into undoStack.
 * @returns {Promise<number>} Number of entries loaded.
 */
async function loadPersistedHistory() {
  const dir = historyDir();
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return 0; // directory doesn't exist yet
  }

  const jsonFiles = files.filter(f => f.endsWith('.json')).sort(); // ascending by timestamp prefix
  let count = 0;

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8');
      const record = JSON.parse(raw);
      const oldContent = await resolveContent(record.oldContent, dir);
      const newContent = await resolveContent(record.newContent, dir);
      undoStack.push({
        tool: record.tool,
        filePath: record.filePath,
        timestamp: record.timestamp,
        oldContent,
        newContent,
      });
      count++;
    } catch {
      // skip corrupt entries
    }
  }

  // Trim to MAX_HISTORY
  while (undoStack.length > MAX_HISTORY) undoStack.shift();
  return count;
}

/**
 * Prune history entries older than maxAgeDays.
 * Also removes orphaned blobs no longer referenced by any entry.
 * @param {number} [maxAgeDays=7]
 * @returns {Promise<number>} Number of pruned entries.
 */
async function pruneHistory(maxAgeDays = 7) {
  const dir = historyDir();
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return 0;
  }

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  let pruned = 0;
  const referencedHashes = new Set();
  const toDelete = [];

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8');
      const record = JSON.parse(raw);
      if (record.timestamp < cutoff) {
        toDelete.push(file);
        pruned++;
      } else {
        // Track referenced blobs
        if (record.oldContent && !record.oldContent.inline && record.oldContent.hash) {
          referencedHashes.add(record.oldContent.hash);
        }
        if (record.newContent && !record.newContent.inline && record.newContent.hash) {
          referencedHashes.add(record.newContent.hash);
        }
      }
    } catch {
      // skip corrupt
    }
  }

  // Delete old entries
  for (const file of toDelete) {
    try { await fs.unlink(path.join(dir, file)); } catch { /* ignore */ }
  }

  // Delete orphaned blobs
  const bDir = path.join(dir, 'blobs');
  try {
    const blobs = await fs.readdir(bDir);
    for (const blob of blobs) {
      if (!referencedHashes.has(blob)) {
        try { await fs.unlink(path.join(bDir, blob)); } catch { /* ignore */ }
      }
    }
  } catch {
    // blobs dir doesn't exist
  }

  return pruned;
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
  persistEntry, loadPersistedHistory, pruneHistory,
  createSnapshot, listSnapshots, restoreSnapshot,
};

/**
 * cli/file-history.js — In-session undo/redo for file changes
 */

const fs = require('fs').promises;

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

module.exports = { recordChange, undo, redo, getHistory, getUndoCount, getRedoCount, clearHistory };

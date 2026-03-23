/**
 * cli/session.js — Session Persistence
 * Save/load conversation sessions to .nex/sessions/
 */

const fs = require("fs");
const path = require("path");
const { atomicWrite } = require("./filelock");

function getSessionsDir() {
  return path.join(process.cwd(), ".nex", "sessions");
}

function ensureDir() {
  const dir = getSessionsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a session filename from a name or timestamp
 */
function sessionPath(name) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 100);
  return path.join(getSessionsDir(), `${safe}.json`);
}

/**
 * Save a session to disk
 * @param {string} name — Session name
 * @param {Array} messages — Conversation messages
 * @param {object} [meta] — Additional metadata (model, provider, etc.)
 * @returns {{ path: string, name: string }}
 */
function saveSession(name, messages, meta = {}) {
  ensureDir();
  const filePath = sessionPath(name);
  const session = {
    name,
    createdAt: meta.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
    model: meta.model || null,
    provider: meta.provider || null,
    messages,
  };
  atomicWrite(filePath, JSON.stringify(session, null, 2));
  return { path: filePath, name };
}

/**
 * Load a session from disk
 * @param {string} name — Session name
 * @returns {object|null} — Session data or null if not found
 */
function loadSession(name) {
  const filePath = sessionPath(name);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * List all saved sessions, sorted by updatedAt (newest first)
 * @returns {Array<{ name, createdAt, updatedAt, messageCount }>}
 */
function listSessions() {
  ensureDir();
  const dir = getSessionsDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const sessions = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
      sessions.push({
        name: data.name || f.replace(".json", ""),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        messageCount: data.messageCount || 0,
        model: data.model,
        provider: data.provider,
        score: data.score != null ? data.score : null,
        scoreGrade: data.scoreGrade || null,
      });
    } catch {
      // skip corrupt files
    }
  }
  return sessions.sort((a, b) =>
    (b.updatedAt || "").localeCompare(a.updatedAt || ""),
  );
}

/**
 * Delete a session
 * @param {string} name
 * @returns {boolean}
 */
function deleteSession(name) {
  const filePath = sessionPath(name);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Get the most recent session (for /resume)
 * @returns {object|null}
 */
function getLastSession() {
  const sessions = listSessions();
  if (sessions.length === 0) return null;
  return loadSession(sessions[0].name);
}

/**
 * Auto-save the current session (called after each turn)
 * Uses a fixed name '_autosave' that gets overwritten each time
 * Implements debouncing to avoid excessive I/O during active conversations
 */
let autoSaveTimeout = null;
let pendingMessages = null;
let pendingMeta = null;

function autoSave(messages, meta = {}) {
  if (messages.length === 0) return;

  // Clear any pending save
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  // Store messages for debounced save
  pendingMessages = messages;
  pendingMeta = meta || {};

  // Debounce: save after 5 seconds of inactivity
  autoSaveTimeout = setTimeout(() => {
    if (pendingMessages && pendingMessages.length > 0) {
      saveSession("_autosave", pendingMessages, pendingMeta);
    }
    autoSaveTimeout = null;
    pendingMessages = null;
    pendingMeta = null;
  }, 5000);
}

/**
 * Force immediate auto-save (bypasses debounce)
 * Called on session end or process exit
 */
function flushAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  if (pendingMessages && pendingMessages.length > 0) {
    saveSession("_autosave", pendingMessages, pendingMeta);
    pendingMessages = null;
    pendingMeta = null;
  }
}

module.exports = {
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
  getLastSession,
  autoSave,
  flushAutoSave,
  // exported for testing
  _getSessionsDir: getSessionsDir,
};

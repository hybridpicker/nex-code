/**
 * cli/memory.js — Project Memory
 * Persistent key-value memory stored in .nex/memory/
 * Also loads NEX.md from project root for project-level instructions
 */

const fs = require('fs');
const path = require('path');

function getMemoryDir() {
  return path.join(process.cwd(), '.nex', 'memory');
}

function getMemoryFile() {
  return path.join(getMemoryDir(), 'memory.json');
}

function getNexMdPath() {
  return path.join(process.cwd(), 'NEX.md');
}

function ensureDir() {
  const dir = getMemoryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readMemoryFile() {
  const file = getMemoryFile();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function writeMemoryFile(data) {
  ensureDir();
  fs.writeFileSync(getMemoryFile(), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Remember a key-value pair
 * @param {string} key
 * @param {string} value
 */
function remember(key, value) {
  const data = readMemoryFile();
  data[key] = {
    value,
    updatedAt: new Date().toISOString(),
  };
  writeMemoryFile(data);
}

/**
 * Recall a value by key
 * @param {string} key
 * @returns {string|null}
 */
function recall(key) {
  const data = readMemoryFile();
  if (data[key]) return data[key].value;
  return null;
}

/**
 * Forget (delete) a memory
 * @param {string} key
 * @returns {boolean}
 */
function forget(key) {
  const data = readMemoryFile();
  if (!(key in data)) return false;
  delete data[key];
  writeMemoryFile(data);
  return true;
}

/**
 * List all memories
 * @returns {Array<{ key, value, updatedAt }>}
 */
function listMemories() {
  const data = readMemoryFile();
  return Object.entries(data).map(([key, entry]) => ({
    key,
    value: entry.value,
    updatedAt: entry.updatedAt,
  }));
}

/**
 * Load NEX.md from project root (if it exists)
 * @returns {string} — Contents of NEX.md or empty string
 */
function loadProjectInstructions() {
  const nexMd = getNexMdPath();
  if (!fs.existsSync(nexMd)) return '';
  try {
    return fs.readFileSync(nexMd, 'utf-8').trim();
  } catch {
    return '';
  }
}

/**
 * Get memory context for system prompt inclusion
 * Returns formatted string with memories + NEX.md content
 * @returns {string}
 */
function getMemoryContext() {
  const parts = [];

  // Load NEX.md
  const instructions = loadProjectInstructions();
  if (instructions) {
    parts.push(`PROJECT INSTRUCTIONS (NEX.md):\n${instructions}`);
  }

  // Load memories
  const memories = listMemories();
  if (memories.length > 0) {
    const memStr = memories.map((m) => `  ${m.key}: ${m.value}`).join('\n');
    parts.push(`PROJECT MEMORY:\n${memStr}`);
  }

  return parts.join('\n\n');
}

module.exports = {
  remember,
  recall,
  forget,
  listMemories,
  loadProjectInstructions,
  getMemoryContext,
  // exported for testing
  _getMemoryDir: getMemoryDir,
  _getMemoryFile: getMemoryFile,
};

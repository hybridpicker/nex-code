/**
 * cli/memory.js — Typed Project Memory
 * Persistent memory stored as individual .md files in .nex/memory/{type}/
 * with an auto-generated MEMORY.md index for system prompt injection.
 * Also loads NEX.md from project root and ~/.nex/ for instructions.
 *
 * Memory types: user, feedback, project, reference
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { atomicWrite, withFileLockSync } = require("./filelock");

const VALID_TYPES = ["user", "feedback", "project", "reference"];
const MAX_INDEX_LINES = 50;

function getMemoryDir() {
  return path.join(process.cwd(), ".nex", "memory");
}

function getMemoryFile() {
  return path.join(getMemoryDir(), "memory.json");
}

function getIndexPath() {
  return path.join(getMemoryDir(), "MEMORY.md");
}

function getNexMdPath() {
  return path.join(process.cwd(), "NEX.md");
}

function getGlobalNexMdPath() {
  return path.join(os.homedir(), ".nex", "NEX.md");
}

function ensureDir() {
  const dir = getMemoryDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureTypeDir(type) {
  const dir = path.join(getMemoryDir(), type);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Legacy JSON support (migration) ────────────────────────────

function readMemoryFile() {
  const file = getMemoryFile();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

function writeMemoryFile(data) {
  ensureDir();
  atomicWrite(getMemoryFile(), JSON.stringify(data, null, 2));
}

/**
 * Migrate legacy memory.json entries to typed .md files.
 * Runs once — renames memory.json to memory.json.bak after migration.
 */
function migrateIfNeeded() {
  const jsonFile = getMemoryFile();
  if (!fs.existsSync(jsonFile)) return;
  const data = readMemoryFile();
  const keys = Object.keys(data);
  if (keys.length === 0) {
    // empty file — just rename
    try {
      fs.renameSync(jsonFile, jsonFile + ".bak");
    } catch {
      /* ignore */
    }
    return;
  }
  for (const key of keys) {
    const entry = data[key];
    const value = entry.value || String(entry);
    const slug = key
      .replace(/[^a-z0-9_-]/gi, "-")
      .toLowerCase()
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) continue;
    // Write directly to bypass validation (legacy entries can be short)
    const dir = ensureTypeDir("project");
    const filePath = path.join(dir, `${slug}.md`);
    const desc = value.split("\n")[0].slice(0, 100);
    const md = `---\nname: ${key}\ndescription: ${desc}\ntype: project\n---\n\n${value}\n`;
    atomicWrite(filePath, md);
  }
  rebuildIndex();
  try {
    fs.renameSync(jsonFile, jsonFile + ".bak");
  } catch {
    /* ignore */
  }
}

// ─── Typed .md file memory ──────────────────────────────────────

/**
 * Save a typed memory as an individual .md file with YAML frontmatter.
 * @param {string} type — one of: user, feedback, project, reference
 * @param {string} name — slug identifier (used as filename)
 * @param {string} content — markdown body
 * @param {string} [description] — one-line description for the index
 * @returns {{ ok: boolean, path: string, error?: string }}
 */
function saveMemory(type, name, content, description) {
  if (!VALID_TYPES.includes(type)) {
    return {
      ok: false,
      path: "",
      error: `Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}`,
    };
  }
  if (!name || typeof name !== "string") {
    return { ok: false, path: "", error: "name must be a non-empty string" };
  }
  if (!content || typeof content !== "string" || content.trim().length < 5) {
    return {
      ok: false,
      path: "",
      error: "content must be at least 5 characters",
    };
  }
  // Sanitize slug: only ASCII alphanumeric, dashes, underscores
  const slug = name
    .replace(/[^a-z0-9_-]/gi, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    return {
      ok: false,
      path: "",
      error: "name produces empty slug after sanitization",
    };
  }
  const dir = ensureTypeDir(type);
  const filePath = path.join(dir, `${slug}.md`);

  // Dedup check: if file exists with similar content (first 200 chars match), update instead of duplicate
  if (fs.existsSync(filePath)) {
    try {
      const existing = parseMemoryFile(fs.readFileSync(filePath, "utf-8"));
      if (existing.body.slice(0, 200) === content.slice(0, 200)) {
        return { ok: true, path: filePath, updated: false };
      }
    } catch {
      /* overwrite on parse error */
    }
  }

  const desc = description || content.split("\n")[0].slice(0, 100);
  const md = `---\nname: ${name}\ndescription: ${desc}\ntype: ${type}\n---\n\n${content}\n`;
  atomicWrite(filePath, md);
  rebuildIndex();
  return { ok: true, path: filePath, updated: true };
}

/**
 * Delete a typed memory file.
 * @param {string} type
 * @param {string} name — slug identifier
 * @returns {boolean}
 */
function deleteMemory(type, name) {
  if (!VALID_TYPES.includes(type)) return false;
  const slug = name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const filePath = path.join(getMemoryDir(), type, `${slug}.md`);
  if (!fs.existsSync(filePath)) return false;
  try {
    fs.unlinkSync(filePath);
    rebuildIndex();
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse frontmatter from a memory .md file.
 * @param {string} raw
 * @returns {{ name: string, description: string, type: string, body: string }}
 */
function parseMemoryFile(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { name: "", description: "", type: "", body: raw.trim() };
  const fm = match[1];
  const body = (match[2] || "").trim();
  const get = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : "";
  };
  return {
    name: get("name"),
    description: get("description"),
    type: get("type"),
    body,
  };
}

/**
 * Scan all typed memory files and return metadata.
 * @returns {Array<{ type: string, name: string, description: string, filePath: string }>}
 */
function scanMemoryEntries({ includeBody = false } = {}) {
  const entries = [];
  const baseDir = getMemoryDir();
  for (const type of VALID_TYPES) {
    const dir = path.join(baseDir, type);
    if (!fs.existsSync(dir)) continue;
    let files;
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = parseMemoryFile(raw);
        let stat = null;
        try {
          stat = fs.statSync(filePath);
        } catch {
          stat = null;
        }
        const entry = {
          type,
          name: parsed.name || path.basename(file, ".md"),
          description: parsed.description,
          filePath,
          updatedAt: stat ? stat.mtimeMs : 0,
        };
        if (includeBody) entry.body = parsed.body;
        entries.push(entry);
      } catch {
        /* skip unreadable files */
      }
    }
  }
  return entries;
}

function scanMemories() {
  return scanMemoryEntries();
}

function normalizeMemoryBody(body) {
  return String(body || "")
    .replace(/\s+/g, " ")
    .trim();
}

function clipMemoryText(text, maxChars) {
  const normalized = normalizeMemoryBody(text);
  if (normalized.length <= maxChars) return normalized;
  return (
    normalized.slice(0, Math.max(0, maxChars - 15)).trimEnd() + " [truncated]"
  );
}

function appendWithinBudget(lines, line, budget) {
  const current = lines.join("\n").length;
  if (current + line.length + 1 > budget) return false;
  lines.push(line);
  return true;
}

function buildMemoryPromptSection(memoryBudget) {
  if (memoryBudget <= 200) return "";

  const index = loadMemoryIndex();
  const typedEntries = scanMemoryEntries({ includeBody: true });

  if (!index && typedEntries.length === 0) {
    const memories = listMemories();
    if (memories.length === 0) return "";
    const lines = ["PROJECT MEMORY:"];
    for (const m of memories) {
      if (!appendWithinBudget(lines, `  ${m.key}: ${m.value}`, memoryBudget)) {
        lines.push(
          "[Memory truncated - use delete_memory to prune old entries]",
        );
        break;
      }
    }
    return lines.join("\n");
  }

  const lines = [];
  if (index) {
    const indexBudget = Math.max(350, Math.floor(memoryBudget * 0.45));
    const indexLines = index.split("\n");
    for (const line of indexLines) {
      if (!appendWithinBudget(lines, line, indexBudget)) {
        lines.push(
          "[Memory index truncated - use delete_memory to prune old entries]",
        );
        break;
      }
    }
  }

  const entriesWithBody = typedEntries
    .filter((entry) => normalizeMemoryBody(entry.body).length > 0)
    .sort((a, b) => {
      const typeRank =
        VALID_TYPES.indexOf(a.type) - VALID_TYPES.indexOf(b.type);
      if (typeRank !== 0) return typeRank;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  if (
    entriesWithBody.length > 0 &&
    lines.join("\n").length < memoryBudget - 220
  ) {
    if (lines.length > 0) lines.push("");
    lines.push("ACTIVE MEMORY EXCERPTS:");
    for (const entry of entriesWithBody) {
      const remaining = memoryBudget - lines.join("\n").length - 1;
      if (remaining < 180) break;
      const excerptBudget = Math.min(520, Math.max(120, remaining - 90));
      const label = `${entry.type}/${path.basename(entry.filePath)}`;
      const desc = entry.description ? ` - ${entry.description}` : "";
      const body = clipMemoryText(entry.body, excerptBudget);
      const line = `- ${entry.name} (${label})${desc}: ${body}`;
      if (!appendWithinBudget(lines, line, memoryBudget)) break;
    }
  }

  if (lines.length === 0) return "";
  return lines.join("\n");
}

/**
 * Rebuild the MEMORY.md index from all typed memory files.
 * One-liner per entry, capped at MAX_INDEX_LINES.
 */
function rebuildIndex() {
  const entries = scanMemories();
  const lines = ["# Project Memory Index", ""];
  for (const e of entries) {
    if (lines.length >= MAX_INDEX_LINES + 2) break; // +2 for header
    const relPath = `${e.type}/${path.basename(e.filePath)}`;
    lines.push(
      `- [${e.name}](${relPath}) — ${e.description || "(no description)"}`,
    );
  }
  ensureDir();
  atomicWrite(getIndexPath(), lines.join("\n") + "\n");
}

/**
 * Load the MEMORY.md index content (for system prompt injection).
 * @returns {string}
 */
function loadMemoryIndex() {
  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) return "";
  try {
    return fs.readFileSync(indexPath, "utf-8").trim();
  } catch {
    return "";
  }
}

// ─── Legacy API (backward-compatible wrappers) ──────────────────

/**
 * Remember a key-value pair (legacy API → saves as project memory)
 * @param {string} key
 * @param {string} value
 */
function remember(key, value) {
  ensureDir();
  // Still write to memory.json for backward compatibility with existing tools
  withFileLockSync(getMemoryFile(), () => {
    const data = readMemoryFile();
    data[key] = {
      value,
      updatedAt: new Date().toISOString(),
    };
    writeMemoryFile(data);
  });
}

/**
 * Recall a value by key (legacy API — reads from memory.json)
 * @param {string} key
 * @returns {string|null}
 */
function recall(key) {
  const data = readMemoryFile();
  if (data[key]) return data[key].value;
  return null;
}

/**
 * Forget (delete) a memory (legacy API)
 * @param {string} key
 * @returns {boolean}
 */
function forget(key) {
  ensureDir();
  return withFileLockSync(getMemoryFile(), () => {
    const data = readMemoryFile();
    if (!(key in data)) return false;
    delete data[key];
    writeMemoryFile(data);
    return true;
  });
}

/**
 * List all memories (legacy API — reads from memory.json)
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

// ─── NEX.md instructions ────────────────────────────────────────

function loadGlobalInstructions() {
  const globalMd = getGlobalNexMdPath();
  if (!fs.existsSync(globalMd)) return "";
  try {
    return fs.readFileSync(globalMd, "utf-8").trim();
  } catch {
    return "";
  }
}

function loadProjectInstructions() {
  const nexMd = getNexMdPath();
  if (!fs.existsSync(nexMd)) return "";
  try {
    return fs.readFileSync(nexMd, "utf-8").trim();
  } catch {
    return "";
  }
}

/**
 * Get memory context for system prompt inclusion.
 * Returns NEX.md instructions + MEMORY.md index (typed files).
 * Falls back to legacy memory.json if no typed files exist yet.
 * @returns {string}
 */
function getMemoryContext() {
  // Run migration on first call
  migrateIfNeeded();

  // Build instructions (high priority — never truncated)
  const instructionParts = [];

  const globalInstructions = loadGlobalInstructions();
  if (globalInstructions) {
    instructionParts.push(
      `GLOBAL INSTRUCTIONS (~/.nex/NEX.md):\n${globalInstructions}`,
    );
  }

  const instructions = loadProjectInstructions();
  if (instructions) {
    instructionParts.push(`PROJECT INSTRUCTIONS (NEX.md):\n${instructions}`);
  }

  const instructionText = instructionParts.join("\n\n");
  const hint =
    "You can save insights with save_memory(type, name, content) and remove them with delete_memory(type, name).";

  // Budget: memory index always gets at least 1500 chars (even with large NEX.md)
  const MIN_MEMORY_BUDGET = 1500;
  const MAX_TOTAL = 16000;
  const memoryBudget = Math.max(
    MIN_MEMORY_BUDGET,
    MAX_TOTAL - instructionText.length - hint.length - 10,
  );
  const memorySection = buildMemoryPromptSection(memoryBudget);

  const parts = [...instructionParts];
  if (memorySection) parts.push(memorySection);
  if (parts.length > 0) parts.push(hint);

  return parts.join("\n\n");
}

module.exports = {
  // Typed memory API
  saveMemory,
  deleteMemory,
  scanMemories,
  rebuildIndex,
  loadMemoryIndex,
  // Legacy API
  remember,
  recall,
  forget,
  listMemories,
  // NEX.md
  loadGlobalInstructions,
  loadProjectInstructions,
  // System prompt
  getMemoryContext,
  // Exported for testing
  _getMemoryDir: getMemoryDir,
  _getMemoryFile: getMemoryFile,
  _getGlobalNexMdPath: getGlobalNexMdPath,
  _parseMemoryFile: parseMemoryFile,
  _buildMemoryPromptSection: buildMemoryPromptSection,
  _migrateIfNeeded: migrateIfNeeded,
  VALID_TYPES,
};

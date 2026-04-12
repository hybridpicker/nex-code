/**
 * cli/index-engine.js — In-memory file index
 * Used for fast path discovery and autocompletion.
 */

const fs = require("fs").promises;
const path = require("path");
const { exec } = require("util").promisify(require("child_process").exec);

let _fileIndex = [];
let _indexedCwd = null;
let _isIndexing = false;
let _lastIndexTime = 0;
const INDEX_TTL_MS = 60000; // Index valid for 60 seconds

/**
 * Check if index is still valid (not expired)
 */
function isIndexValid(cwd) {
  if (_fileIndex.length === 0) return false;
  if (_indexedCwd !== cwd) return false;
  if (Date.now() - _lastIndexTime > INDEX_TTL_MS) return false;
  return true;
}

async function refreshIndex(cwd) {
  if (_isIndexing) return;

  // Skip if index is still valid
  if (isIndexValid(cwd)) return;

  _isIndexing = true;
  _indexedCwd = cwd;

  try {
    // Strategy 1: Use ripgrep if available (very fast)
    try {
      const { stdout } = await exec("rg --files", { cwd, timeout: 5000 });
      _fileIndex = stdout.split("\n").filter(Boolean);
      _lastIndexTime = Date.now();
      _isIndexing = false;
      return;
    } catch {
      // rg failed or not found, fall back to Node.js walker
    }

    // Strategy 2: Node.js recursive walker
    const matches = [];
    const walk = async (dir, rel) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (
          e.name === "node_modules" ||
          e.name === ".git" ||
          e.name.startsWith(".")
        )
          continue;
        const relPath = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          await walk(path.join(dir, e.name), relPath);
        } else {
          matches.push(relPath);
        }
      }
    };
    await walk(cwd, "");
    _fileIndex = matches;
    _lastIndexTime = Date.now();
  } catch (err) {
    console.error(`Index error: ${err.message}`);
  } finally {
    _isIndexing = false;
  }
}

function getFileIndex() {
  return _fileIndex;
}

function getIndexedCwd() {
  return _indexedCwd;
}

function findFileInIndex(basename) {
  return _fileIndex.filter((f) => path.basename(f) === basename);
}

function searchIndex(query) {
  const q = query.toLowerCase();
  return _fileIndex.filter((f) => f.toLowerCase().includes(q)).slice(0, 20);
}

// ─── Smart Fuzzy Search ──────────────────────────────────────

/**
 * Lightweight Levenshtein distance for short strings (file/path segments).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function pathLevenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Optimisation: single-row DP
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let corner = i - 1;
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = a[i - 1] === b[j - 1]
        ? corner
        : 1 + Math.min(prev[j], prev[j - 1], corner);
      corner = prev[j];
      prev[j] = cur;
    }
  }
  return prev[n];
}

/**
 * Score how well a candidate file path matches a query path.
 * Higher = better match. Returns 0 for no meaningful match.
 *
 * Scoring dimensions:
 * 1. Exact full-path match → 1000
 * 2. Trailing segment match (last N path segments identical) → 500 + 100*N
 * 3. Basename exact match (case-insensitive) → 80
 * 4. Basename Levenshtein similarity (≥60%) → 0-50
 * 5. Substring containment bonus → 20
 * 6. Path segment overlap bonus → 10 * overlapping segments
 * 7. Trailing segment partial bonus → 30 * N
 *
 * @param {string} candidate - File path from index (relative)
 * @param {string} query - User-provided path
 * @returns {number} Score (0 = no match)
 */
function scorePathMatch(candidate, query) {
  const cLower = candidate.toLowerCase();
  const qLower = query.toLowerCase();

  // Exact match
  if (cLower === qLower) return 1000;

  // Trailing segment match: check if last N segments of query match candidate's tail
  const cSegs = cLower.split("/").filter(Boolean);
  const qSegs = qLower.split("/").filter(Boolean);
  let trailingMatch = 0;
  for (let i = 1; i <= Math.min(cSegs.length, qSegs.length); i++) {
    if (cSegs[cSegs.length - i] === qSegs[qSegs.length - i]) {
      trailingMatch = i;
    } else break;
  }
  if (trailingMatch > 0 && trailingMatch === qSegs.length) {
    // Full query is a trailing portion of candidate — strong match
    return 500 + trailingMatch * 100;
  }

  const cBase = path.basename(candidate).toLowerCase();
  const qBase = path.basename(query).toLowerCase();

  let score = 0;

  // Basename exact match (case-insensitive)
  if (cBase === qBase) {
    score += 80;
  } else {
    // Basename Levenshtein (only for reasonably similar names)
    const maxLen = Math.max(cBase.length, qBase.length);
    if (maxLen > 0 && maxLen < 100) {
      const dist = pathLevenshtein(cBase, qBase);
      const similarity = 1 - dist / maxLen;
      if (similarity >= 0.6) {
        score += Math.round(similarity * 50);
      }
    }
  }

  // Substring containment
  if (cLower.includes(qLower) || qLower.includes(cLower)) {
    score += 20;
  }

  // Path segment overlap (how many directory segments match)
  if (qSegs.length > 1) {
    const cSegSet = new Set(cSegs);
    let overlap = 0;
    for (const seg of qSegs) {
      if (cSegSet.has(seg)) overlap++;
    }
    score += overlap * 10;
  }

  // Trailing segment partial bonus
  if (trailingMatch > 0) {
    score += trailingMatch * 30;
  }

  return score;
}

/**
 * Smart search: find files matching a query path with fuzzy scoring.
 * Handles typos, wrong parent directories, missing extensions, case mismatches.
 *
 * @param {string} query - Path or filename to search for
 * @param {Object} [opts]
 * @param {number} [opts.limit=10] - Max results
 * @param {number} [opts.minScore=15] - Minimum score threshold
 * @returns {Array<{ file: string, score: number }>} Sorted by score descending
 */
function smartSearch(query, { limit = 10, minScore = 15 } = {}) {
  if (!query || _fileIndex.length === 0) return [];

  const scored = [];
  for (const f of _fileIndex) {
    const s = scorePathMatch(f, query);
    if (s >= minScore) scored.push({ file: f, score: s });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ─── Content Index ─────────────────────────────────────────────
// Extracts function/class/import definitions from source files

let _contentIndex = null;
let _contentIndexTime = 0;
let _contentIndexCwd = null;
const CONTENT_INDEX_TTL_MS = 120000; // 2 minutes
let _importGraph = null;
let _importGraphTime = 0;
let _importGraphCwd = null;

const INDEXABLE_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
]);

/**
 * Extract definitions from a source file.
 * @param {string} content - File content
 * @param {string} ext - File extension
 * @returns {Array<{ type: string, name: string, line: number }>}
 */
function extractDefinitions(content, ext) {
  const defs = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // JavaScript/TypeScript patterns
    if ([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"].includes(ext)) {
      // function declarations
      const funcMatch = line.match(
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      );
      if (funcMatch)
        defs.push({ type: "function", name: funcMatch[1], line: lineNum });

      // class declarations
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch)
        defs.push({ type: "class", name: classMatch[1], line: lineNum });

      // const arrow functions (only top-level-looking ones)
      const arrowMatch = line.match(
        /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/,
      );
      if (arrowMatch)
        defs.push({ type: "function", name: arrowMatch[1], line: lineNum });

      // module.exports assignments
      const exportsMatch = line.match(/module\.exports\s*=\s*\{([^}]+)\}/);
      if (exportsMatch) {
        const names = exportsMatch[1]
          .split(",")
          .map((n) => n.trim().split(":")[0].trim())
          .filter(Boolean);
        for (const name of names) {
          if (/^\w+$/.test(name))
            defs.push({ type: "export", name, line: lineNum });
        }
      }

      // imports
      const importMatch = line.match(
        /(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"])/,
      );
      if (importMatch) {
        const mod = importMatch[1] || importMatch[2];
        defs.push({ type: "import", name: mod, line: lineNum });
      }
    }

    // Python patterns
    if (ext === ".py") {
      const pyFuncMatch = line.match(/^(?:async\s+)?def\s+(\w+)/);
      if (pyFuncMatch)
        defs.push({ type: "function", name: pyFuncMatch[1], line: lineNum });

      const pyClassMatch = line.match(/^class\s+(\w+)/);
      if (pyClassMatch)
        defs.push({ type: "class", name: pyClassMatch[1], line: lineNum });

      const pyImportMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(\S+)/);
      if (pyImportMatch)
        defs.push({
          type: "import",
          name: pyImportMatch[1] || pyImportMatch[2],
          line: lineNum,
        });
    }

    // Go patterns
    if (ext === ".go") {
      const goFuncMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)/);
      if (goFuncMatch)
        defs.push({ type: "function", name: goFuncMatch[1], line: lineNum });

      const goTypeMatch = line.match(/^type\s+(\w+)\s+struct/);
      if (goTypeMatch)
        defs.push({ type: "class", name: goTypeMatch[1], line: lineNum });
    }
  }

  return defs;
}

/**
 * Build a content index of all source files in the project.
 * Extracts function, class, and import definitions.
 * Re-indexes files whose mtime has changed.
 *
 * @param {string} [cwd] - Project root
 * @returns {Promise<Object>} Index: { files: { [path]: { defs: [...], mtime: number } } }
 */
async function buildContentIndex(cwd) {
  cwd = cwd || process.cwd();
  const indexPath = path.join(cwd, ".nex", "index", "content-index.json");

  // Load existing index if valid
  let existing = {};
  if (
    _contentIndex &&
    _contentIndexCwd === cwd &&
    Date.now() - _contentIndexTime < CONTENT_INDEX_TTL_MS
  ) {
    return _contentIndex;
  }

  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    existing = { files: {} };
  }

  // Get all files
  let allFiles = getFileIndex();
  if (!isIndexValid(cwd) || allFiles.length === 0) {
    await refreshIndex(cwd);
    allFiles = getFileIndex();
  }

  const updated = { files: {} };
  let changed = false;

  for (const relPath of getFileIndex()) {
    const ext = path.extname(relPath);
    if (!INDEXABLE_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(cwd, relPath);
    try {
      const stat = await fs.stat(fullPath);
      const mtime = stat.mtimeMs;

      // Skip if unchanged
      if (existing.files[relPath] && existing.files[relPath].mtime === mtime) {
        updated.files[relPath] = existing.files[relPath];
        continue;
      }

      // Re-index this file
      const content = await fs.readFile(fullPath, "utf-8");
      const defs = extractDefinitions(content, ext);
      updated.files[relPath] = { defs, mtime };
      changed = true;
    } catch {
      // skip unreadable files
    }
  }

  // Save if changed
  if (changed) {
    const indexDir = path.join(cwd, ".nex", "index");
    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(updated), "utf-8");
  }

  _contentIndex = updated;
  _contentIndexTime = Date.now();
  _contentIndexCwd = cwd;
  return updated;
}

/**
 * Search the content index for a definition.
 * @param {string} query - Name to search for (function, class, etc.)
 * @param {string} [type] - Optional type filter ('function', 'class', 'import', 'export')
 * @returns {Promise<Array<{ file: string, type: string, name: string, line: number }>>}
 */
async function searchContentIndex(query, type, cwd) {
  const index = await buildContentIndex(cwd);
  const results = [];
  const q = query.toLowerCase();

  for (const [file, data] of Object.entries(index.files)) {
    for (const def of data.defs) {
      if (type && def.type !== type) continue;
      if (def.name.toLowerCase().includes(q)) {
        results.push({ file, type: def.type, name: def.name, line: def.line });
      }
    }
  }

  // Sort by relevance (exact match first, then prefix, then contains)
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase() === q ? 0 : 1;
    const bExact = b.name.toLowerCase() === q ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    return aPrefix - bPrefix;
  });

  return results.slice(0, 50);
}

function _resolveRelativeImport(fromFile, specifier, fileSet) {
  if (!specifier || !specifier.startsWith(".")) return null;

  const fromDir = path.posix.dirname(fromFile.replace(/\\/g, "/"));
  const normalizedBase = path.posix.normalize(
    path.posix.join(fromDir === "." ? "" : fromDir, specifier),
  );
  const candidates = [];
  const ext = path.posix.extname(normalizedBase);

  if (ext) {
    candidates.push(normalizedBase);
  } else {
    for (const candidateExt of INDEXABLE_EXTENSIONS) {
      candidates.push(`${normalizedBase}${candidateExt}`);
      candidates.push(path.posix.join(normalizedBase, `index${candidateExt}`));
    }
  }

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

async function buildImportGraph(cwd) {
  cwd = cwd || process.cwd();
  if (
    _importGraph &&
    _importGraphCwd === cwd &&
    Date.now() - _importGraphTime < CONTENT_INDEX_TTL_MS
  ) {
    return _importGraph;
  }

  const index = await buildContentIndex(cwd);
  const allFiles = getFileIndex();
  const fileSet = new Set(allFiles.map((file) => file.replace(/\\/g, "/")));
  const importsByFile = {};
  const importedByFile = {};

  for (const file of Object.keys(index.files || {})) {
    const relFile = file.replace(/\\/g, "/");
    const defs = Array.isArray(index.files[file]?.defs) ? index.files[file].defs : [];
    const resolved = [];
    const seen = new Set();

    for (const def of defs) {
      if (def.type !== "import") continue;
      const target = _resolveRelativeImport(relFile, def.name, fileSet);
      if (!target || target === relFile || seen.has(target)) continue;
      seen.add(target);
      resolved.push(target);
      if (!importedByFile[target]) importedByFile[target] = [];
      importedByFile[target].push(relFile);
    }

    importsByFile[relFile] = resolved;
  }

  for (const [file, importers] of Object.entries(importedByFile)) {
    importedByFile[file] = [...new Set(importers)].sort();
  }

  _importGraph = { importsByFile, importedByFile };
  _importGraphTime = Date.now();
  _importGraphCwd = cwd;
  return _importGraph;
}

async function getRelatedFiles(file, cwd, limit = 6) {
  if (!file) return [];
  const graph = await buildImportGraph(cwd);
  const relFile = String(file).replace(/\\/g, "/");
  const neighbors = [
    ...(graph.importsByFile[relFile] || []),
    ...(graph.importedByFile[relFile] || []),
  ];
  return [...new Set(neighbors)].filter((entry) => entry !== relFile).slice(0, limit);
}

async function summarizeModuleHubs(cwd, limit = 4) {
  const graph = await buildImportGraph(cwd);
  const degree = new Map();

  for (const [file, imports] of Object.entries(graph.importsByFile || {})) {
    degree.set(file, (degree.get(file) || 0) + imports.length);
  }
  for (const [file, importers] of Object.entries(graph.importedByFile || {})) {
    degree.set(file, (degree.get(file) || 0) + importers.length);
  }

  return [...degree.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([file, count]) => `${file} (${count} links)`);
}

function _escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _looksLikeDefinitionLine(line, symbolName) {
  const escaped = _escapeRegex(symbolName);
  const patterns = [
    new RegExp(`\\bfunction\\s+${escaped}\\b`),
    new RegExp(`\\bclass\\s+${escaped}\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\b\\s*=`),
    new RegExp(`\\bdef\\s+${escaped}\\b`),
    new RegExp(`\\btype\\s+${escaped}\\b\\s+struct\\b`),
    new RegExp(`\\bmodule\\.exports\\b[^\\n]*\\b${escaped}\\b`),
    new RegExp(`\\bexport\\b[^\\n]*\\b${escaped}\\b`),
  ];
  return patterns.some((pattern) => pattern.test(line));
}

async function findSymbolReferences(symbolName, cwd, opts = {}) {
  cwd = cwd || process.cwd();
  const {
    excludeFile = null,
    excludeLine = null,
    limit = 6,
  } = opts;
  if (!symbolName || typeof symbolName !== "string") return [];

  const index = await buildContentIndex(cwd);
  const escaped = _escapeRegex(symbolName);
  const callPattern = new RegExp(`\\b${escaped}\\s*\\(`);
  const wordPattern = new RegExp(`\\b${escaped}\\b`);
  const references = [];

  for (const file of Object.keys(index.files || {})) {
    const relFile = file.replace(/\\/g, "/");
    try {
      const fullPath = path.join(cwd, relFile);
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        if (!wordPattern.test(line)) continue;
        if (excludeFile && relFile === excludeFile && excludeLine === lineNum) continue;
        if (_looksLikeDefinitionLine(line, symbolName)) continue;

        const score =
          (relFile === excludeFile ? 0 : 4) +
          (callPattern.test(line) ? 3 : 1);
        references.push({
          file: relFile,
          line: lineNum,
          context: line.trim(),
          score,
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  references.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file.localeCompare(b.file) || a.line - b.line;
  });

  return references.slice(0, limit);
}

module.exports = {
  refreshIndex,
  getFileIndex,
  getIndexedCwd,
  findFileInIndex,
  searchIndex,
  isIndexValid,
  buildContentIndex,
  searchContentIndex,
  extractDefinitions,
  buildImportGraph,
  getRelatedFiles,
  summarizeModuleHubs,
  findSymbolReferences,
  smartSearch,
  scorePathMatch,
  pathLevenshtein,
};

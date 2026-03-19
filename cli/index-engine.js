/**
 * cli/index-engine.js — In-memory file index
 * Used for fast path discovery and autocompletion.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('util').promisify(require('child_process').exec);

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
            const { stdout } = await exec('rg --files', { cwd, timeout: 5000 });
            _fileIndex = stdout.split('\n').filter(Boolean);
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
            try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
            for (const e of entries) {
                if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
                const relPath = rel ? `${rel}/${e.name}` : e.name;
                if (e.isDirectory()) {
                    await walk(path.join(dir, e.name), relPath);
                } else {
                    matches.push(relPath);
                }
            }
        };
        await walk(cwd, '');
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
    return _fileIndex.filter(f => path.basename(f) === basename);
}

function searchIndex(query) {
    const q = query.toLowerCase();
    return _fileIndex.filter(f => f.toLowerCase().includes(q)).slice(0, 20);
}

// ─── Content Index ─────────────────────────────────────────────
// Extracts function/class/import definitions from source files

let _contentIndex = null;
let _contentIndexTime = 0;
const CONTENT_INDEX_TTL_MS = 120000; // 2 minutes

const INDEXABLE_EXTENSIONS = new Set(['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.rb']);

/**
 * Extract definitions from a source file.
 * @param {string} content - File content
 * @param {string} ext - File extension
 * @returns {Array<{ type: string, name: string, line: number }>}
 */
function extractDefinitions(content, ext) {
  const defs = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // JavaScript/TypeScript patterns
    if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
      // function declarations
      const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) defs.push({ type: 'function', name: funcMatch[1], line: lineNum });

      // class declarations
      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) defs.push({ type: 'class', name: classMatch[1], line: lineNum });

      // const arrow functions (only top-level-looking ones)
      const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/);
      if (arrowMatch) defs.push({ type: 'function', name: arrowMatch[1], line: lineNum });

      // module.exports assignments
      const exportsMatch = line.match(/module\.exports\s*=\s*\{([^}]+)\}/);
      if (exportsMatch) {
        const names = exportsMatch[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean);
        for (const name of names) {
          if (/^\w+$/.test(name)) defs.push({ type: 'export', name, line: lineNum });
        }
      }

      // imports
      const importMatch = line.match(/(?:require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"])/);
      if (importMatch) {
        const mod = importMatch[1] || importMatch[2];
        defs.push({ type: 'import', name: mod, line: lineNum });
      }
    }

    // Python patterns
    if (ext === '.py') {
      const pyFuncMatch = line.match(/^(?:async\s+)?def\s+(\w+)/);
      if (pyFuncMatch) defs.push({ type: 'function', name: pyFuncMatch[1], line: lineNum });

      const pyClassMatch = line.match(/^class\s+(\w+)/);
      if (pyClassMatch) defs.push({ type: 'class', name: pyClassMatch[1], line: lineNum });

      const pyImportMatch = line.match(/^(?:from\s+(\S+)\s+)?import\s+(\S+)/);
      if (pyImportMatch) defs.push({ type: 'import', name: pyImportMatch[1] || pyImportMatch[2], line: lineNum });
    }

    // Go patterns
    if (ext === '.go') {
      const goFuncMatch = line.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)/);
      if (goFuncMatch) defs.push({ type: 'function', name: goFuncMatch[1], line: lineNum });

      const goTypeMatch = line.match(/^type\s+(\w+)\s+struct/);
      if (goTypeMatch) defs.push({ type: 'class', name: goTypeMatch[1], line: lineNum });
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
  const indexPath = path.join(cwd, '.nex', 'index', 'content-index.json');

  // Load existing index if valid
  let existing = {};
  if (_contentIndex && Date.now() - _contentIndexTime < CONTENT_INDEX_TTL_MS) {
    return _contentIndex;
  }

  try {
    const raw = await fs.readFile(indexPath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    existing = { files: {} };
  }

  // Get all files
  const allFiles = getFileIndex();
  if (allFiles.length === 0) {
    await refreshIndex(cwd);
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
      const content = await fs.readFile(fullPath, 'utf-8');
      const defs = extractDefinitions(content, ext);
      updated.files[relPath] = { defs, mtime };
      changed = true;
    } catch {
      // skip unreadable files
    }
  }

  // Save if changed
  if (changed) {
    const indexDir = path.join(cwd, '.nex', 'index');
    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(updated), 'utf-8');
  }

  _contentIndex = updated;
  _contentIndexTime = Date.now();
  return updated;
}

/**
 * Search the content index for a definition.
 * @param {string} query - Name to search for (function, class, etc.)
 * @param {string} [type] - Optional type filter ('function', 'class', 'import', 'export')
 * @returns {Promise<Array<{ file: string, type: string, name: string, line: number }>>}
 */
async function searchContentIndex(query, type) {
  const index = await buildContentIndex();
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

module.exports = { refreshIndex, getFileIndex, getIndexedCwd, findFileInIndex, searchIndex, isIndexValid, buildContentIndex, searchContentIndex, extractDefinitions };

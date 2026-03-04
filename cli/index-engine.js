/**
 * cli/index-engine.js — In-memory file index
 * Used for fast path discovery and autocompletion.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('util').promisify(require('child_process').exec);

let _fileIndex = [];
let _isIndexing = false;
let _lastIndexTime = 0;

async function refreshIndex(cwd) {
    if (_isIndexing) return;
    _isIndexing = true;

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

function findFileInIndex(basename) {
    return _fileIndex.filter(f => path.basename(f) === basename);
}

function searchIndex(query) {
    const q = query.toLowerCase();
    return _fileIndex.filter(f => f.toLowerCase().includes(q)).slice(0, 20);
}

module.exports = { refreshIndex, getFileIndex, findFileInIndex, searchIndex };

/**
 * cli/brain.js — Knowledge Brain
 * File-based knowledge base with keyword (+ optional embedding) retrieval.
 * Docs live in .nex/brain/*.md, auto-indexed and injected into system prompt.
 */

const fs = require('fs');
const path = require('path');

// ─── Stop Words ───────────────────────────────────────────────
const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'and', 'or', 'but', 'in', 'on', 'at',
  'to', 'for', 'of', 'with', 'this', 'that', 'it', 'as', 'be', 'by',
  'from', 'was', 'were', 'has', 'have', 'had', 'not', 'do', 'does',
  'did', 'so', 'if', 'its', 'my', 'me', 'we', 'you', 'he', 'she',
  'they', 'our', 'your', 'their', 'can', 'will', 'would', 'could',
  'should', 'may', 'might', 'then', 'than', 'also', 'which', 'when',
  'where', 'how', 'what', 'who', 'all', 'any', 'each', 'more', 'most',
  'use', 'used', 'using', 'get', 'set', 'new', 'add', 'make',
  // German
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen',
  'einem', 'eines', 'und', 'oder', 'aber', 'von', 'zu', 'mit', 'auf',
  'bei', 'nach', 'aus', 'vor', 'ist', 'sind', 'war', 'hat', 'haben',
  'wird', 'kann', 'soll', 'muss', 'nicht', 'auch', 'als', 'durch',
]);

// ─── Storage ──────────────────────────────────────────────────

function getBrainDir() {
  const dir = path.join(process.cwd(), '.nex', 'brain');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getIndexPath() {
  return path.join(getBrainDir(), '.brain-index.json');
}

function getEmbeddingCachePath() {
  return path.join(getBrainDir(), '.embeddings.json');
}

/**
 * List all .md documents in brain dir (excluding dot files).
 * @returns {Array<{ name, path, size, modified }>}
 */
function listDocuments() {
  const dir = path.join(process.cwd(), '.nex', 'brain');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md') && !f.startsWith('.'))
      .map(f => {
        const filePath = path.join(dir, f);
        const stat = fs.statSync(filePath);
        return {
          name: f.replace(/\.md$/, ''),
          path: filePath,
          size: stat.size,
          modified: new Date(stat.mtimeMs),
        };
      })
      .sort((a, b) => b.modified - a.modified);
  } catch {
    return [];
  }
}

/**
 * Parse optional YAML frontmatter from markdown.
 * @param {string} content
 * @returns {{ frontmatter: Object, body: string }}
 */
function parseFrontmatter(content) {
  const fm = {};
  let body = content;
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = m[2].trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        fm[key] = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else {
        fm[key] = val;
      }
    }
    body = match[2];
  }
  return { frontmatter: fm, body };
}

/**
 * Read a document from brain dir.
 * @param {string} name - Document name (without .md)
 * @returns {{ name, content, body, frontmatter }}
 */
function readDocument(name) {
  const filePath = path.join(getBrainDir(), `${name}.md`);
  if (!fs.existsSync(filePath)) {
    return { name, content: '', body: '', frontmatter: {} };
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(raw);
  return { name, content: raw, body, frontmatter };
}

/**
 * Write a document to brain dir and update the index.
 * Also triggers embedding index rebuild in background if cache exists.
 * @param {string} name
 * @param {string} content
 */
function writeDocument(name, content) {
  const filePath = path.join(getBrainDir(), `${name}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
  _updateDocumentInIndex(name, content);
  _autoRebuildEmbeddings();
}

/**
 * Rebuild embeddings in the background — only if cache already exists
 * (meaning the user has opted in by running /brain embed at least once).
 * Non-blocking: errors are silently swallowed.
 */
function _autoRebuildEmbeddings() {
  if (process.env.NEX_BRAIN_EMBEDDINGS === 'false') return;
  const cachePath = getEmbeddingCachePath();
  if (!fs.existsSync(cachePath)) return; // not opted in yet
  setImmediate(async () => {
    try {
      await buildEmbeddingIndex();
    } catch { /* non-fatal, runs silently in background */ }
  });
}

/**
 * Remove a document and update the index.
 * @param {string} name
 * @returns {boolean}
 */
function removeDocument(name) {
  const filePath = path.join(getBrainDir(), `${name}.md`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  _removeDocumentFromIndex(name);
  return true;
}

// ─── Indexing ─────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function _extractKeywords(content) {
  const scores = {};
  const { frontmatter, body } = parseFrontmatter(content);

  // Tags from frontmatter: 5x weight
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  for (const tag of tags) {
    const w = tag.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (w.length > 1) scores[w] = (scores[w] || 0) + 5;
  }

  // Headings (lines starting with #): 3x weight
  const lines = (body || content).split('\n');
  for (const line of lines) {
    if (line.startsWith('#')) {
      const headingText = line.replace(/^#+\s*/, '');
      for (const w of tokenize(headingText)) {
        scores[w] = (scores[w] || 0) + 3;
      }
    }
  }

  // Body words: 1x weight
  for (const w of tokenize(body || content)) {
    scores[w] = (scores[w] || 0) + 1;
  }

  return scores;
}

function _readIndex() {
  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) return { documents: {} };
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return { documents: {} };
  }
}

function _writeIndex(index) {
  fs.writeFileSync(getIndexPath(), JSON.stringify(index, null, 2), 'utf-8');
}

function _updateDocumentInIndex(name, content) {
  const index = _readIndex();
  const { frontmatter } = parseFrontmatter(content);
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  index.documents[name] = {
    keywords: _extractKeywords(content),
    tags,
    modified: new Date().toISOString(),
  };
  _writeIndex(index);
}

function _removeDocumentFromIndex(name) {
  const index = _readIndex();
  delete index.documents[name];
  _writeIndex(index);
}

/**
 * Rebuild the full keyword index from all .md files in brain dir.
 * @returns {Object} The new index
 */
function buildIndex() {
  const docs = listDocuments();
  const index = { documents: {} };
  for (const doc of docs) {
    const content = fs.readFileSync(doc.path, 'utf-8');
    const { frontmatter } = parseFrontmatter(content);
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    index.documents[doc.name] = {
      keywords: _extractKeywords(content),
      tags,
      modified: doc.modified.toISOString(),
    };
  }
  _writeIndex(index);
  return index;
}

/**
 * Load the index, rebuilding if stale (new/deleted/modified docs).
 * @returns {Object}
 */
function getIndex() {
  const index = _readIndex();
  const docs = listDocuments();

  // Check if any doc is newer than its index entry
  for (const doc of docs) {
    const entry = index.documents[doc.name];
    if (!entry || new Date(entry.modified) < doc.modified) {
      return buildIndex();
    }
  }
  // Check if any indexed doc was deleted
  for (const name of Object.keys(index.documents)) {
    if (!docs.some(d => d.name === name)) {
      return buildIndex();
    }
  }
  return index;
}

// ─── Keyword Retrieval ────────────────────────────────────────

function _keywordQuery(userQuery, options = {}) {
  const { topK = 3, minScore = 0.1 } = options;
  const queryTokens = tokenize(userQuery);
  if (queryTokens.length === 0) return [];

  const index = getIndex();
  const results = [];

  for (const [name, entry] of Object.entries(index.documents)) {
    let score = 0;
    for (const token of queryTokens) {
      if (entry.keywords[token]) {
        score += entry.keywords[token];
      }
      // Partial match for compound terms
      for (const [kw, kwScore] of Object.entries(entry.keywords)) {
        if (kw !== token && kw.length > 3 && token.length > 3 &&
            (kw.includes(token) || token.includes(kw))) {
          score += kwScore * 0.3;
        }
      }
    }
    if (score >= minScore) {
      results.push({ name, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ─── Embeddings (Optional) ────────────────────────────────────

const EMBED_MODEL = process.env.NEX_EMBED_MODEL || 'nomic-embed-text';
const CHUNK_WORDS = 400;
const CHUNK_OVERLAP = 50;

async function isEmbeddingAvailable() {
  if (process.env.NEX_BRAIN_EMBEDDINGS === 'false') return false;
  try {
    const baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const http = require('http');
    const https = require('https');
    const url = new URL(`${baseUrl}/api/tags`);
    const client = url.protocol === 'https:' ? https : http;
    const tags = await new Promise((resolve, reject) => {
      const req = client.get(url.toString(), { timeout: 2000 }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('bad json')); } });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
    const models = (tags.models || []).map(m => m.name);
    return models.some(m => m.startsWith(EMBED_MODEL.split(':')[0]));
  } catch {
    return false;
  }
}

async function generateEmbedding(text) {
  const baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const http = require('http');
  const https = require('https');
  const url = new URL(`${baseUrl}/api/embeddings`);
  const client = url.protocol === 'https:' ? https : http;
  const body = JSON.stringify({ model: EMBED_MODEL, prompt: text });
  return new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).embedding || []); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('embedding timeout')); });
    req.write(body);
    req.end();
  });
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function _chunkText(text) {
  const words = text.split(/\s+/);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + CHUNK_WORDS).join(' ');
    chunks.push({ text: chunk, offset: i });
    if (i + CHUNK_WORDS >= words.length) break;
    i += CHUNK_WORDS - CHUNK_OVERLAP;
  }
  return chunks;
}

async function buildEmbeddingIndex() {
  const docs = listDocuments();
  let cache = { documents: {} };
  const cachePath = getEmbeddingCachePath();
  if (fs.existsSync(cachePath)) {
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch { /* ignore */ }
  }

  for (const doc of docs) {
    const existing = cache.documents[doc.name];
    if (existing && new Date(existing.modified) >= doc.modified) continue;

    const content = fs.readFileSync(doc.path, 'utf-8');
    const chunks = _chunkText(content);
    const embeddedChunks = [];
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      embeddedChunks.push({ text: chunk.text, embedding, offset: chunk.offset });
    }
    cache.documents[doc.name] = {
      chunks: embeddedChunks,
      modified: doc.modified.toISOString(),
    };
  }

  // Remove deleted docs from cache
  for (const name of Object.keys(cache.documents)) {
    if (!docs.some(d => d.name === name)) {
      delete cache.documents[name];
    }
  }

  fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');
  return cache;
}

async function semanticQuery(userQuery, options = {}) {
  const { topK = 3, minSimilarity = 0.3 } = options;
  const cachePath = getEmbeddingCachePath();
  if (!fs.existsSync(cachePath)) return [];

  let cache;
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  } catch {
    return [];
  }

  const queryEmbedding = await generateEmbedding(userQuery);
  const results = [];

  for (const [name, entry] of Object.entries(cache.documents || {})) {
    let bestScore = 0;
    let bestChunk = '';
    for (const chunk of (entry.chunks || [])) {
      const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (sim > bestScore) {
        bestScore = sim;
        bestChunk = chunk.text;
      }
    }
    if (bestScore >= minSimilarity) {
      results.push({ name, score: bestScore, bestChunk });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

function _fuseResults(keywordResults, semanticResults, options = {}) {
  const { k = 60, topK = 3 } = options;
  const scores = {};
  keywordResults.forEach((r, i) => {
    scores[r.name] = (scores[r.name] || 0) + 1 / (k + i + 1);
  });
  semanticResults.forEach((r, i) => {
    scores[r.name] = (scores[r.name] || 0) + 1 / (k + i + 1);
  });
  return Object.entries(scores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ─── Main Query API ───────────────────────────────────────────

/**
 * Query the brain for documents relevant to the user query.
 * Uses keyword retrieval with optional semantic hybrid via Ollama embeddings.
 * @param {string} userQuery
 * @param {Object} options - { topK, minScore }
 * @returns {Promise<Array<{ name, score, content, excerpt }>>}
 */
async function query(userQuery, options = {}) {
  const { topK = 3, minScore = 0.1 } = options;
  const keywordResults = _keywordQuery(userQuery, { topK, minScore });
  let ranked = keywordResults;

  // Hybrid retrieval if embeddings are available
  if (process.env.NEX_BRAIN_EMBEDDINGS !== 'false') {
    try {
      const embAvail = await isEmbeddingAvailable();
      if (embAvail) {
        const semResults = await semanticQuery(userQuery, { topK });
        ranked = _fuseResults(keywordResults, semResults, { topK });
      }
    } catch { /* fall back to keyword only */ }
  }

  return ranked.map(r => {
    const doc = readDocument(r.name);
    const excerpt = (doc.body || doc.content || '').slice(0, 300).replace(/\n+/g, ' ') + '...';
    return { name: r.name, score: r.score, content: doc.content, excerpt };
  });
}

/**
 * Get brain context string for system prompt injection (query-dependent).
 * @param {string} userQuery
 * @returns {Promise<string>}
 */
async function getBrainContext(userQuery) {
  if (!userQuery || !userQuery.trim()) return '';

  // Skip if no brain dir or no docs
  const brainDir = path.join(process.cwd(), '.nex', 'brain');
  if (!fs.existsSync(brainDir)) return '';
  const docs = listDocuments();
  if (docs.length === 0) return '';

  let results;
  try {
    results = await query(userQuery, { topK: 3 });
  } catch {
    return '';
  }
  if (!results || results.length === 0) return '';

  // Token budget: max 25% of context window (~25k tokens of ~100k)
  let estimateTokens;
  try {
    estimateTokens = require('./context-engine').estimateTokens;
  } catch {
    estimateTokens = (text) => Math.ceil(text.length / 4);
  }

  const MAX_BRAIN_TOKENS = 25000;
  const parts = [];
  let totalTokens = 0;

  for (const r of results) {
    let content = r.content || '';
    const docTokens = estimateTokens(content);
    if (totalTokens + docTokens > MAX_BRAIN_TOKENS) {
      const remaining = MAX_BRAIN_TOKENS - totalTokens;
      if (remaining < 100) break;
      const ratio = remaining / docTokens;
      content = content.slice(0, Math.floor(content.length * ratio)) + '\n...(truncated)';
    }
    const scoreStr = typeof r.score === 'number' ? r.score.toFixed(2) : String(r.score);
    parts.push(`--- ${r.name} (relevance: ${scoreStr}) ---\n${content}`);
    totalTokens += estimateTokens(content);
    if (totalTokens >= MAX_BRAIN_TOKENS) break;
  }

  if (parts.length === 0) return '';
  return `KNOWLEDGE BASE (auto-selected):\n\n${parts.join('\n\n')}`;
}

// ─── Exports ──────────────────────────────────────────────────

module.exports = {
  getBrainDir,
  listDocuments,
  readDocument,
  writeDocument,
  removeDocument,
  buildIndex,
  getIndex,
  query,
  getBrainContext,
  // Embeddings
  isEmbeddingAvailable,
  generateEmbedding,
  buildEmbeddingIndex,
  semanticQuery,
  cosineSimilarity,
  // Internals (for testing)
  _keywordQuery,
  _extractKeywords,
  _chunkText,
  parseFrontmatter,
  tokenize,
  _fuseResults,
};

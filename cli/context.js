/**
 * cli/context.js — Auto-Context: package.json, git, README
 */

const fs = require('fs').promises;
const path = require('path');
const exec = require('util').promisify(require('child_process').exec);
const { C } = require('./ui');
const { getMergeConflicts } = require('./git');
const { getServerContext } = require('./server-context');

// Context cache to avoid redundant file I/O on every turn
const contextCache = new Map();
const contextMtimes = new Map();
let contextCacheExpiry = null;
const CACHE_TTL_MS = 30000; // Cache valid for 30 seconds

async function safe(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/**
 * Check if cached context is still valid by comparing file mtimes
 */
async function isContextCacheValid() {
  if (!contextCacheExpiry || Date.now() > contextCacheExpiry) {
    return false;
  }
  
  const filesToCheck = [
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'README.md'),
    path.join(process.cwd(), '.gitignore'),
  ];
  
  for (const file of filesToCheck) {
    try {
      const stat = await fs.stat(file);
      const cachedMtime = contextMtimes.get(file);
      if (!cachedMtime || stat.mtimeMs !== cachedMtime) {
        return false;
      }
    } catch {
      // File doesn't exist - check if it was cached
      if (contextMtimes.has(file)) {
        return false;
      }
    }
  }
  
  // Also check git HEAD for changes
  try {
    const headPath = path.join(process.cwd(), '.git', 'HEAD');
    const stat = await fs.stat(headPath);
    const cachedMtime = contextMtimes.get(headPath);
    if (!cachedMtime || stat.mtimeMs !== cachedMtime) {
      return false;
    }
  } catch {
    // Git not available
  }
  
  return true;
}

/**
 * Update cache mtimes for tracked files
 */
async function updateContextMtimes() {
  const filesToTrack = [
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'README.md'),
    path.join(process.cwd(), '.gitignore'),
    path.join(process.cwd(), '.git', 'HEAD'),
  ];
  
  for (const file of filesToTrack) {
    try {
      const stat = await fs.stat(file);
      contextMtimes.set(file, stat.mtimeMs);
    } catch {
      contextMtimes.delete(file);
    }
  }
}

async function gatherProjectContext(cwd) {
  // Check if cache is valid (only for file-based context, not git info)
  // Git info (log, status, branch) is always fetched fresh
  const fileContextCacheKey = 'fileContext';
  
  let fileContext = contextCache.get(fileContextCacheKey);
  let cacheValid = false;
  
  if (fileContext && await isContextCacheValid()) {
    cacheValid = true;
  }
  
  if (!cacheValid) {
    const parts = [];

    // package.json
    const pkgPath = path.join(cwd, 'package.json');
    const pkgExists = await safe(() => fs.access(pkgPath).then(() => true).catch(() => false));

    if (pkgExists) {
      try {
        const pkgContent = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgContent);
        const info = { name: pkg.name, version: pkg.version };
        if (pkg.scripts) info.scripts = Object.keys(pkg.scripts).slice(0, 15);
        if (pkg.dependencies) info.deps = Object.keys(pkg.dependencies).length;
        if (pkg.devDependencies) info.devDeps = Object.keys(pkg.devDependencies).length;
        parts.push(`PACKAGE: ${JSON.stringify(info)}`);
      } catch { /* ignore corrupt package.json */ }
    }

    // README (first 50 lines)
    const readmePath = path.join(cwd, 'README.md');
    const readmeExists = await safe(() => fs.access(readmePath).then(() => true).catch(() => false));

    if (readmeExists) {
      const readmeContent = await fs.readFile(readmePath, 'utf-8');
      const lines = readmeContent.split('\n').slice(0, 50);
      parts.push(`README (first 50 lines):\n${lines.join('\n')}`);
    }

    // .gitignore
    const giPath = path.join(cwd, '.gitignore');
    const giExists = await safe(() => fs.access(giPath).then(() => true).catch(() => false));

    if (giExists) {
      const content = await fs.readFile(giPath, 'utf-8');
      parts.push(`GITIGNORE:\n${content.trim()}`);
    }

    fileContext = parts.join('\n\n');
    contextCache.set(fileContextCacheKey, fileContext);
    contextCacheExpiry = Date.now() + CACHE_TTL_MS;
    await updateContextMtimes();
  }
  
  // Always fetch fresh git info (changes frequently)
  // Run all git operations in parallel for maximum performance
  const gitParts = [fileContext];
  
  const [branch, status, log, conflicts] = await Promise.all([
    // Git branch
    safe(async () => {
      const { stdout } = await exec('git branch --show-current', { cwd, timeout: 5000 });
      return stdout.trim();
    }),
    
    // Git status
    safe(async () => {
      const { stdout } = await exec('git status --short', { cwd, timeout: 5000 });
      return stdout.trim();
    }),
    
    // Git log
    safe(async () => {
      const { stdout } = await exec('git log --oneline -5', { cwd, timeout: 5000 });
      return stdout.trim();
    }),
    
    // Merge conflicts
    getMergeConflicts(),
  ]);
  
  if (branch) gitParts.push(`GIT BRANCH: ${branch}`);
  if (status) gitParts.push(`GIT STATUS:\n${status}`);
  if (log) gitParts.push(`RECENT COMMITS:\n${log}`);
  
  if (conflicts && conflicts.length > 0) {
    const conflictFiles = conflicts.map(c => `  ${c.file}`).join('\n');
    gitParts.push(`MERGE CONFLICTS (resolve before editing these files):\n${conflictFiles}`);
  }

  // Server context from .nex/servers.json (injected once, not cached — file rarely changes)
  try {
    const serverCtx = getServerContext();
    if (serverCtx) gitParts.push(serverCtx);
  } catch { /* servers.json missing or malformed — skip silently */ }

  return gitParts.join('\n\n');
}

async function printContext(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  let project = '';
  const pkgExists = await safe(() => fs.access(pkgPath).then(() => true).catch(() => false));

  if (pkgExists) {
    try {
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      project = `${pkg.name || '?'} v${pkg.version || '?'}`;
    } catch { /* ignore corrupt package.json */ }
  }

  const [branch, conflicts] = await Promise.all([
    safe(async () => {
      const { stdout } = await exec('git branch --show-current', { cwd, timeout: 5000 });
      return stdout.trim();
    }),
    getMergeConflicts(),
  ]);

  if (project) console.log(`${C.dim}  project: ${project}${C.reset}`);
  if (branch) console.log(`${C.dim}  branch: ${branch}${C.reset}`);

  if (conflicts && conflicts.length > 0) {
    console.log(`${C.red}  ⚠ ${conflicts.length} unresolved merge conflict(s):${C.reset}`);
    for (const c of conflicts) {
      console.log(`${C.red}    ${c.file}${C.reset}`);
    }
    console.log(`${C.yellow}  → Resolve conflicts before starting tasks${C.reset}`);
  }

  console.log();
}

module.exports = { 
  gatherProjectContext, 
  printContext,
  // Export for testing
  _clearContextCache: () => {
    contextCache.clear();
    contextMtimes.clear();
    contextCacheExpiry = null;
  },
};

/**
 * cli/context.js — Auto-Context: package.json, git, README
 */

const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const { C } = require("./ui");
const { getMergeConflicts } = require("./git");
const { getServerContext } = require("./server-context");

// Directories/files always excluded from the file tree
const TREE_EXCLUDE = new Set([
  "node_modules",
  ".git",
  ".svn",
  "dist",
  "build",
  "coverage",
  ".nyc_output",
  "__pycache__",
  ".DS_Store",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "vendor",
  "tmp",
  "temp",
]);

/**
 * Parse a .gitignore file and return a list of simple pattern strings.
 * Only handles the most common patterns (no complex glob negations).
 */
function parseGitignorePatterns(giPath) {
  try {
    const content = fsSync.readFileSync(giPath, "utf-8");
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"))
      .map((l) => l.replace(/\/$/, "")); // strip trailing slash
  } catch {
    return [];
  }
}

/**
 * Check if a name matches any gitignore pattern (basic wildcard support).
 */
function matchesGitignore(name, patterns) {
  for (const pattern of patterns) {
    if (pattern === name) return true;
    if (pattern.includes("*")) {
      // Simple glob: *.ext → matches any name ending with .ext
      const re = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      );
      if (re.test(name)) return true;
    }
  }
  return false;
}

/**
 * Generate an ASCII file tree for the given directory.
 *
 * @param {string} rootDir - Absolute path to root
 * @param {object} [opts]
 * @param {number} [opts.maxDepth=3] - Maximum folder depth
 * @param {number} [opts.maxFiles=200] - Hard cap on total entries
 * @param {string[]} [opts.giPatterns=[]] - Extra gitignore patterns
 * @returns {string} Rendered tree (multi-line string)
 */
function generateFileTree(
  rootDir,
  { maxDepth = 3, maxFiles = 200, giPatterns = [] } = {},
) {
  const giPath = path.join(rootDir, ".gitignore");
  const patterns = [...giPatterns, ...parseGitignorePatterns(giPath)];

  let totalEntries = 0;
  const lines = [path.basename(rootDir) + "/"];

  function walk(dir, prefix, depth) {
    if (depth > maxDepth || totalEntries >= maxFiles) return;
    let entries;
    try {
      entries = fsSync.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Sort: dirs first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Filter excluded
    const visible = entries.filter((e) => {
      if (TREE_EXCLUDE.has(e.name)) return false;
      if (e.name.startsWith(".") && e.name !== ".env.example") return false;
      if (matchesGitignore(e.name, patterns)) return false;
      return true;
    });

    for (let i = 0; i < visible.length; i++) {
      if (totalEntries >= maxFiles) {
        lines.push(`${prefix}└── … (truncated)`);
        break;
      }
      const entry = visible[i];
      const isLast = i === visible.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = prefix + (isLast ? "    " : "│   ");
      const name = entry.isDirectory() ? entry.name + "/" : entry.name;
      lines.push(`${prefix}${connector}${name}`);
      totalEntries++;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), childPrefix, depth + 1);
      }
    }
  }

  walk(rootDir, "", 1);
  return lines.join("\n");
}

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
    path.join(process.cwd(), "package.json"),
    path.join(process.cwd(), "README.md"),
    path.join(process.cwd(), ".gitignore"),
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
    const headPath = path.join(process.cwd(), ".git", "HEAD");
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
    path.join(process.cwd(), "package.json"),
    path.join(process.cwd(), "README.md"),
    path.join(process.cwd(), ".gitignore"),
    path.join(process.cwd(), ".git", "HEAD"),
    path.join(process.cwd(), "CLAUDE.md"),
    path.join(process.cwd(), ".nex", "CLAUDE.md"),
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
  const fileContextCacheKey = "fileContext";

  let fileContext = contextCache.get(fileContextCacheKey);
  let cacheValid = false;

  if (fileContext && (await isContextCacheValid())) {
    cacheValid = true;
  }

  if (!cacheValid) {
    const parts = [];

    // package.json
    const pkgPath = path.join(cwd, "package.json");
    const pkgExists = await safe(() =>
      fs
        .access(pkgPath)
        .then(() => true)
        .catch(() => false),
    );

    if (pkgExists) {
      try {
        const pkgContent = await fs.readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(pkgContent);
        const info = { name: pkg.name, version: pkg.version };
        if (pkg.scripts) info.scripts = Object.keys(pkg.scripts).slice(0, 15);
        if (pkg.dependencies) info.deps = Object.keys(pkg.dependencies).length;
        if (pkg.devDependencies)
          info.devDeps = Object.keys(pkg.devDependencies).length;
        parts.push(`PACKAGE: ${JSON.stringify(info)}`);
      } catch {
        /* ignore corrupt package.json */
      }
    }

    // README (first 50 lines)
    const readmePath = path.join(cwd, "README.md");
    const readmeExists = await safe(() =>
      fs
        .access(readmePath)
        .then(() => true)
        .catch(() => false),
    );

    if (readmeExists) {
      const readmeContent = await fs.readFile(readmePath, "utf-8");
      const lines = readmeContent.split("\n").slice(0, 50);
      parts.push(`README (first 50 lines):\n${lines.join("\n")}`);
    }

    // .gitignore
    const giPath = path.join(cwd, ".gitignore");
    const giExists = await safe(() =>
      fs
        .access(giPath)
        .then(() => true)
        .catch(() => false),
    );

    if (giExists) {
      const content = await fs.readFile(giPath, "utf-8");
      parts.push(`GITIGNORE:\n${content.trim()}`);
    }

    // CLAUDE.md — project-level instructions (Claude Code compatible, gitignored)
    const claudeMdPath = path.join(cwd, "CLAUDE.md");
    const claudeMdExists = await safe(() =>
      fs
        .access(claudeMdPath)
        .then(() => true)
        .catch(() => false),
    );
    if (claudeMdExists) {
      const content = await fs.readFile(claudeMdPath, "utf-8");
      if (content.trim())
        parts.push(`PROJECT INSTRUCTIONS (CLAUDE.md):\n${content.trim()}`);
    }

    // .nex/CLAUDE.md — private project instructions (gitignored, never committed)
    const nexClaudeMdPath = path.join(cwd, ".nex", "CLAUDE.md");
    const nexClaudeMdExists = await safe(() =>
      fs
        .access(nexClaudeMdPath)
        .then(() => true)
        .catch(() => false),
    );
    if (nexClaudeMdExists) {
      const content = await fs.readFile(nexClaudeMdPath, "utf-8");
      if (content.trim())
        parts.push(
          `PRIVATE PROJECT INSTRUCTIONS (.nex/CLAUDE.md):\n${content.trim()}`,
        );
    }

    fileContext = parts.join("\n\n");
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
      const { stdout } = await exec("git branch --show-current", {
        cwd,
        timeout: 5000,
      });
      return stdout.trim();
    }),

    // Git status
    safe(async () => {
      const { stdout } = await exec("git status --short", {
        cwd,
        timeout: 5000,
      });
      return stdout.trim();
    }),

    // Git log
    safe(async () => {
      const { stdout } = await exec("git log --oneline -5", {
        cwd,
        timeout: 5000,
      });
      return stdout.trim();
    }),

    // Merge conflicts
    getMergeConflicts(),
  ]);

  if (branch) gitParts.push(`GIT BRANCH: ${branch}`);
  if (status) gitParts.push(`GIT STATUS:\n${status}`);
  if (log) gitParts.push(`RECENT COMMITS:\n${log}`);

  if (conflicts && conflicts.length > 0) {
    const conflictFiles = conflicts.map((c) => `  ${c.file}`).join("\n");
    gitParts.push(
      `MERGE CONFLICTS (resolve before editing these files):\n${conflictFiles}`,
    );
  }

  // Server context from .nex/servers.json (injected once, not cached — file rarely changes)
  try {
    const serverCtx = getServerContext();
    if (serverCtx) gitParts.push(serverCtx);
  } catch {
    /* servers.json missing or malformed — skip silently */
  }

  return gitParts.join("\n\n");
}

async function printContext(cwd) {
  const pkgPath = path.join(cwd, "package.json");
  let project = "";
  const pkgExists = await safe(() =>
    fs
      .access(pkgPath)
      .then(() => true)
      .catch(() => false),
  );

  if (pkgExists) {
    try {
      const pkgContent = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgContent);
      project = `${pkg.name || "?"} v${pkg.version || "?"}`;
    } catch {
      /* ignore corrupt package.json */
    }
  }

  const [branch, conflicts] = await Promise.all([
    safe(async () => {
      const { stdout } = await exec("git branch --show-current", {
        cwd,
        timeout: 5000,
      });
      return stdout.trim();
    }),
    getMergeConflicts(),
  ]);

  // project and branch are shown in the sticky footer status bar — skip here

  if (conflicts && conflicts.length > 0) {
    console.log(
      `${C.red}  ⚠ ${conflicts.length} unresolved merge conflict(s):${C.reset}`,
    );
    for (const c of conflicts) {
      console.log(`${C.red}    ${c.file}${C.reset}`);
    }
    console.log(
      `${C.yellow}  → Resolve conflicts before starting tasks${C.reset}`,
    );
  }

  console.log();
}

module.exports = {
  gatherProjectContext,
  printContext,
  generateFileTree,
  // Export for testing
  _clearContextCache: () => {
    contextCache.clear();
    contextMtimes.clear();
    contextCacheExpiry = null;
  },
};

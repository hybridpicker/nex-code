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
const {
  refreshIndex,
  getFileIndex,
  buildContentIndex,
  summarizeModuleHubs,
} = require("./index-engine");

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

const FRAMEWORK_SIGNALS = [
  { file: "tsconfig.json", label: "TypeScript" },
  { file: "jest.config.js", label: "Jest" },
  { file: "jest.config.cjs", label: "Jest" },
  { file: "jest.config.mjs", label: "Jest" },
  { file: "vitest.config.js", label: "Vitest" },
  { file: "vitest.config.ts", label: "Vitest" },
  { file: "vite.config.js", label: "Vite" },
  { file: "vite.config.ts", label: "Vite" },
  { file: "next.config.js", label: "Next.js" },
  { file: "next.config.mjs", label: "Next.js" },
  { file: "tailwind.config.js", label: "Tailwind" },
  { file: "tailwind.config.ts", label: "Tailwind" },
  { file: "docker-compose.yml", label: "Docker Compose" },
  { file: "docker-compose.yaml", label: "Docker Compose" },
  { file: ".github/workflows", label: "GitHub Actions" },
];

function summarizeTopDirectories(files, limit = 6) {
  const counts = new Map();
  for (const relPath of files) {
    const seg = relPath.includes("/") ? relPath.split("/")[0] : "(root)";
    if (!seg || seg.startsWith(".")) continue;
    counts.set(seg, (counts.get(seg) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([dir, count]) => `${dir} (${count})`);
}

function detectFrameworks(files) {
  const fileSet = new Set(files);
  const frameworks = new Set();
  for (const signal of FRAMEWORK_SIGNALS) {
    if (fileSet.has(signal.file) || [...fileSet].some((f) => f.startsWith(`${signal.file}/`))) {
      frameworks.add(signal.label);
    }
  }

  if (fileSet.has("package.json")) frameworks.add("Node.js");
  if ([...fileSet].some((f) => /^tests?\//.test(f) || /\.test\./.test(f) || /\.spec\./.test(f))) {
    frameworks.add("Tests");
  }
  if ([...fileSet].some((f) => f.startsWith("vscode/"))) frameworks.add("VS Code Extension");

  return [...frameworks];
}

function guessEntryPoints(files) {
  const priorities = [
    "package.json",
    "cli/index.js",
    "src/index.ts",
    "src/index.js",
    "index.ts",
    "index.js",
    "bin/nex-code.js",
    "dist/nex-code.js",
    "README.md",
  ];
  const picks = [];
  for (const candidate of priorities) {
    if (files.includes(candidate)) picks.push(candidate);
    if (picks.length >= 5) break;
  }
  return picks;
}

function buildTestMap(files, limit = 6) {
  const testFiles = files.filter(
    (f) => /^tests?\//.test(f) || /\.test\./.test(f) || /\.spec\./.test(f),
  );
  if (testFiles.length === 0) return [];

  const sourceFiles = files.filter(
    (f) =>
      !/^tests?\//.test(f) &&
      !/\.test\./.test(f) &&
      !/\.spec\./.test(f) &&
      /\.(js|jsx|ts|tsx|py|go|rs|java)$/.test(f),
  );

  const mapped = [];
  for (const src of sourceFiles) {
    const base = path.basename(src).replace(/\.[^.]+$/, "");
    if (base.length < 3) continue;
    const matches = testFiles.filter((testFile) => testFile.includes(base));
    if (matches.length > 0) {
      mapped.push(`${src} -> ${matches.slice(0, 2).join(", ")}`);
    }
    if (mapped.length >= limit) break;
  }
  return mapped;
}

function detectWorkspaces(pkg) {
  if (!pkg || !pkg.workspaces) return [];
  if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
  if (Array.isArray(pkg.workspaces.packages)) return pkg.workspaces.packages;
  return [];
}

async function buildRepoIntelligence(cwd) {
  try {
    await refreshIndex(cwd);
    const files = getFileIndex();
    if (!files || files.length === 0) return "";

    const frameworks = detectFrameworks(files);
    const topDirs = summarizeTopDirectories(files);
    const entryPoints = guessEntryPoints(files);
    const testCount = files.filter(
      (f) => /^tests?\//.test(f) || /\.test\./.test(f) || /\.spec\./.test(f),
    ).length;
    const testMap = buildTestMap(files);
    let workspaces = [];
    try {
      const pkgPath = path.join(cwd, "package.json");
      if (fsSync.existsSync(pkgPath)) {
        const pkg = JSON.parse(fsSync.readFileSync(pkgPath, "utf-8"));
        workspaces = detectWorkspaces(pkg);
      }
    } catch {
      /* optional */
    }

    let hotspotLine = "";
    let moduleHubLine = "";
    try {
      const contentIndex = await buildContentIndex(cwd);
      const hotspots = Object.entries(contentIndex.files || {})
        .map(([file, data]) => ({
          file,
          defs: Array.isArray(data.defs) ? data.defs.length : 0,
        }))
        .filter((entry) => entry.defs > 0)
        .sort((a, b) => b.defs - a.defs || a.file.localeCompare(b.file))
        .slice(0, 4)
        .map((entry) => `${entry.file} (${entry.defs} defs)`);
      if (hotspots.length > 0) {
        hotspotLine = `CODE HOTSPOTS: ${hotspots.join(", ")}`;
      }
    } catch {
      /* content index is optional */
    }
    try {
      const hubs = await summarizeModuleHubs(cwd, 4);
      if (hubs.length > 0) {
        moduleHubLine = `MODULE HUBS: ${hubs.join(", ")}`;
      }
    } catch {
      /* import graph is optional */
    }

    const lines = [
      `REPO MAP: ${files.length} indexed files${frameworks.length ? ` | stack: ${frameworks.join(", ")}` : ""}`,
    ];
    if (topDirs.length > 0) lines.push(`WORK AREAS: ${topDirs.join(", ")}`);
    if (entryPoints.length > 0) lines.push(`LIKELY ENTRY POINTS: ${entryPoints.join(", ")}`);
    if (workspaces.length > 0) lines.push(`WORKSPACES: ${workspaces.join(", ")}`);
    if (testCount > 0) lines.push(`TEST FOOTPRINT: ${testCount} test files detected`);
    if (testMap.length > 0) lines.push(`TEST MAP: ${testMap.join(" | ")}`);
    if (hotspotLine) lines.push(hotspotLine);
    if (moduleHubLine) lines.push(moduleHubLine);
    lines.push(
      "RETRIEVAL RULE: Prefer the smallest verified path set first — identify likely files, then read only the exact symbols/sections you need before editing.",
    );
    return lines.join("\n");
  } catch {
    return "";
  }
}

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

// Git info cache — same TTL as file context
let _gitCache = { result: null, expiry: 0, cwd: null };

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

    const repoIntelligence = await buildRepoIntelligence(cwd);
    if (repoIntelligence) parts.push(repoIntelligence);

    fileContext = parts.join("\n\n");
    contextCache.set(fileContextCacheKey, fileContext);
    contextCacheExpiry = Date.now() + CACHE_TTL_MS;
    await updateContextMtimes();
  }

  // Git info cache — 30s TTL matching file context cache.
  // Git state rarely changes between loop iterations (same session),
  // and the 4 exec() calls add 200-800ms per uncached call.
  const gitParts = [fileContext];
  let branch, status, log, conflicts;

  if (_gitCache.result && Date.now() < _gitCache.expiry && _gitCache.cwd === cwd) {
    ({ branch, status, log, conflicts } = _gitCache.result);
  } else {
    // Run all git operations in parallel for maximum performance
    [branch, status, log, conflicts] = await Promise.all([
      safe(async () => {
        const { stdout } = await exec("git branch --show-current", {
          cwd,
          timeout: 5000,
        });
        return stdout.trim();
      }),

      safe(async () => {
        const { stdout } = await exec("git status --short", {
          cwd,
          timeout: 5000,
        });
        return stdout.trim();
      }),

      safe(async () => {
        const { stdout } = await exec("git log --oneline -5", {
          cwd,
          timeout: 5000,
        });
        return stdout.trim();
      }),

      getMergeConflicts(),
    ]);
    _gitCache = { result: { branch, status, log, conflicts }, expiry: Date.now() + CACHE_TTL_MS, cwd };
  }

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
    _gitCache = { result: null, expiry: 0, cwd: null };
  },
};

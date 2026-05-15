#!/usr/bin/env node
/**
 * Launch the latest nex-code Electron app from the devel branch.
 *
 * The npm package only ships the CLI bundle, so this command keeps a managed
 * source checkout in ~/.nex-code/app-devel and starts desktop/ from there.
 */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const DEFAULT_REPO_URL = "https://github.com/hybridpicker/nex-code.git";
const APP_BRANCH = process.env.NEX_CODE_APP_BRANCH || "devel";
const APP_REPO_URL = process.env.NEX_CODE_APP_REPO_URL || DEFAULT_REPO_URL;
const APP_DIR =
  process.env.NEX_CODE_APP_DIR ||
  path.join(os.homedir(), ".nex-code", "app-devel");
const LEGACY_STATE_FILE = ".nex-code-app-state.json";
const MANAGED_STATE_DIR =
  process.env.NEX_CODE_APP_STATE_DIR ||
  path.join(os.homedir(), ".nex-code", "state");

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function log(message) {
  process.stderr.write(`[nex-code-app] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[nex-code-app] ERROR: ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = options.capture ? result.stderr || result.stdout || "" : "";
    fail(`${command} ${args.join(" ")} failed${detail ? `\n${detail.trim()}` : ""}`);
  }

  return options.capture ? result.stdout.trim() : "";
}

function runResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    fail(`${command} failed to start: ${result.error.message}`);
  }

  return result;
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function isProjectDirectory(dirPath) {
  if (!dirPath) return false;
  if (!exists(dirPath)) return false;
  try {
    if (!fs.statSync(dirPath).isDirectory()) return false;
  } catch {
    return false;
  }

  const markers = [
    ".git",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    ".nex",
  ];

  return markers.some((marker) => exists(path.join(dirPath, marker)));
}

function hasStrongProjectMarker(dirPath) {
  const markers = [
    ".git",
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
  ];
  return markers.some((marker) => exists(path.join(dirPath, marker)));
}

function isWorkspaceContainerDirectory(dirPath) {
  const base = path.basename(path.resolve(dirPath)).toLowerCase();
  return [
    "code",
    "coding",
    "dev",
    "development",
    "projects",
    "repos",
    "repositories",
    "src",
    "workspace",
    "workspaces",
  ].includes(base);
}

function findProjectRoot(startDir, boundaryDir) {
  if (!startDir) return null;

  let currentDir;
  try {
    currentDir = path.resolve(startDir);
  } catch {
    return null;
  }
  try {
    if (!fs.statSync(currentDir).isDirectory()) return null;
  } catch {
    return null;
  }
  const resolvedBoundary = boundaryDir ? path.resolve(boundaryDir) : null;
  let fallbackProject = null;
  const startProject = currentDir;

  while (true) {
    if (resolvedBoundary && currentDir === resolvedBoundary) return null;
    if (exists(path.join(currentDir, ".git"))) return currentDir;
    if (
      !fallbackProject &&
      (hasStrongProjectMarker(currentDir) ||
        (currentDir === startProject && isProjectDirectory(currentDir))) &&
      !isWorkspaceContainerDirectory(currentDir)
    ) {
      fallbackProject = currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return fallbackProject || startProject;
    currentDir = parentDir;
  }
}

function getManagedStatePath(rootDir) {
  const scope = crypto
    .createHash("sha1")
    .update(path.resolve(rootDir))
    .digest("hex")
    .slice(0, 12);
  const base = path.basename(path.resolve(rootDir)) || "app-devel";
  return path.join(MANAGED_STATE_DIR, `${base}-${scope}.json`);
}

function getLegacyStatePath(rootDir) {
  return path.join(rootDir, LEGACY_STATE_FILE);
}

function readState(rootDir) {
  const statePath = getManagedStatePath(rootDir);
  if (!exists(statePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function writeState(rootDir, state) {
  fs.mkdirSync(MANAGED_STATE_DIR, { recursive: true });
  fs.writeFileSync(
    getManagedStatePath(rootDir),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

function parseGitStatusEntries(statusOutput) {
  return String(statusOutput || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => ({
      raw: line,
      path: line.slice(3).trim(),
    }));
}

function isIgnorableManagedPath(filePath) {
  return (
    filePath === LEGACY_STATE_FILE ||
    filePath === `.git/info/exclude`
  );
}

function getBlockingWorktreeChanges(statusOutput) {
  return parseGitStatusEntries(statusOutput).filter(
    (entry) => !isIgnorableManagedPath(entry.path),
  );
}

function selectManagedCheckoutUpdate(localHead, remoteHead, mergeBase) {
  if (localHead === remoteHead) return "noop";
  if (mergeBase && mergeBase === localHead) return "fast-forward";
  return "reset-hard";
}

function cleanupLegacyStateFile(rootDir) {
  const legacyPath = getLegacyStatePath(rootDir);
  if (!exists(legacyPath)) return;
  try {
    fs.unlinkSync(legacyPath);
  } catch (error) {
    fail(`failed to remove legacy state file ${legacyPath}: ${error.message}`);
  }
}

function ensureLegacyStateIgnored(rootDir) {
  const excludePath = path.join(rootDir, ".git", "info", "exclude");
  const rule = LEGACY_STATE_FILE;
  const current = exists(excludePath)
    ? fs.readFileSync(excludePath, "utf8")
    : "";
  const lines = current.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(rule)) return;
  const next = current.endsWith("\n") || current.length === 0
    ? `${current}${rule}\n`
    : `${current}\n${rule}\n`;
  fs.writeFileSync(excludePath, next, "utf8");
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function ensureManagedCheckout() {
  const parentDir = path.dirname(APP_DIR);
  fs.mkdirSync(parentDir, { recursive: true });

  if (!exists(APP_DIR)) {
    log(`Cloning ${APP_BRANCH} into ${APP_DIR}`);
    run("git", ["clone", "--branch", APP_BRANCH, "--single-branch", APP_REPO_URL, APP_DIR]);
    return;
  }

  if (!exists(path.join(APP_DIR, ".git"))) {
    fail(`${APP_DIR} exists but is not a git checkout`);
  }

  cleanupLegacyStateFile(APP_DIR);
  ensureLegacyStateIgnored(APP_DIR);

  const dirty = run("git", ["status", "--porcelain"], { cwd: APP_DIR, capture: true });
  if (getBlockingWorktreeChanges(dirty).length > 0) {
    fail(`${APP_DIR} has local changes. Commit, stash, or remove it before launching.`);
  }

  const currentBranch = run("git", ["branch", "--show-current"], {
    cwd: APP_DIR,
    capture: true,
  });
  if (currentBranch !== APP_BRANCH) {
    log(`Switching checkout to ${APP_BRANCH}`);
    run("git", ["switch", APP_BRANCH], { cwd: APP_DIR });
  }

  log(`Fetching latest ${APP_BRANCH}`);
  run("git", ["fetch", "origin", APP_BRANCH, "--quiet"], { cwd: APP_DIR });

  const localHead = run("git", ["rev-parse", "HEAD"], { cwd: APP_DIR, capture: true });
  const remoteHead = run("git", ["rev-parse", `origin/${APP_BRANCH}`], {
    cwd: APP_DIR,
    capture: true,
  });
  const mergeBaseResult = runResult(
    "git",
    ["merge-base", "HEAD", `origin/${APP_BRANCH}`],
    { cwd: APP_DIR, capture: true },
  );
  const mergeBase = mergeBaseResult.status === 0
    ? String(mergeBaseResult.stdout || "").trim()
    : "";
  const updateStrategy = selectManagedCheckoutUpdate(localHead, remoteHead, mergeBase);

  if (updateStrategy === "noop") {
    log(`Already on latest ${APP_BRANCH} (${localHead.slice(0, 7)})`);
    return;
  }

  if (updateStrategy === "fast-forward") {
    log(`Updating ${APP_BRANCH} ${localHead.slice(0, 7)} -> ${remoteHead.slice(0, 7)}`);
    run("git", ["merge", "--ff-only", `origin/${APP_BRANCH}`], { cwd: APP_DIR });
    return;
  }

  log(
    `Resetting managed ${APP_BRANCH} checkout ${localHead.slice(0, 7)} -> ${remoteHead.slice(0, 7)} ` +
    `(non-fast-forward history)`,
  );
  run("git", ["reset", "--hard", `origin/${APP_BRANCH}`], { cwd: APP_DIR });
}

function ensureDependencies(rootDir, state) {
  const npm = commandName("npm");
  const rootLock = path.join(rootDir, "package-lock.json");
  const desktopLock = path.join(rootDir, "desktop", "package-lock.json");
  const rootLockHash = hashFile(rootLock);
  const desktopLockHash = hashFile(desktopLock);

  if (!exists(path.join(rootDir, "node_modules")) || state.rootLockHash !== rootLockHash) {
    log("Installing root dependencies");
    run(npm, ["ci"], { cwd: rootDir });
    state.rootLockHash = rootLockHash;
  }

  if (
    !exists(path.join(rootDir, "desktop", "node_modules", "electron")) ||
    state.desktopLockHash !== desktopLockHash
  ) {
    log("Installing desktop dependencies");
    run(npm, ["ci"], { cwd: path.join(rootDir, "desktop") });
    state.desktopLockHash = desktopLockHash;
  }
}

function ensureBuild(rootDir, state) {
  const npm = commandName("npm");
  const head = run("git", ["rev-parse", "HEAD"], { cwd: rootDir, capture: true });
  const cliBundle = path.join(rootDir, "dist", "nex-code.js");

  if (exists(cliBundle) && state.builtHead === head) {
    return;
  }

  log("Building CLI bundle for desktop server mode");
  run(npm, ["run", "build"], { cwd: rootDir });
  state.builtHead = head;
}

function buildLaunchArgs(rootDir) {
  const forwardArgs = process.argv.slice(2);
  if (forwardArgs.includes("--open-project")) return forwardArgs;

  const resolvedRoot = path.resolve(rootDir);
  const launchProject = findProjectRoot(process.cwd(), resolvedRoot);
  if (launchProject && launchProject !== resolvedRoot) {
    return forwardArgs.concat(["--open-project", launchProject]);
  }

  return forwardArgs;
}

function launchDesktop(rootDir) {
  const npm = commandName("npm");
  const args = ["run", "start", "--", ...buildLaunchArgs(rootDir)];
  const desktopDir = path.join(rootDir, "desktop");

  log("Starting Electron app");
  const child = spawn(npm, args, {
    cwd: desktopDir,
    stdio: "inherit",
    env: Object.assign({}, process.env, {
      NEX_CODE_APP_DIR: rootDir,
      NEX_CODE_APP_BRANCH: APP_BRANCH,
    }),
  });

  child.on("error", (error) => fail(`failed to start Electron: ${error.message}`));
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code || 0);
  });
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(`Usage: nex-code-app [electron args]

Updates a managed nex-code checkout to origin/${APP_BRANCH}, builds the CLI
bundle, and starts the Electron app from desktop/.

Environment:
  NEX_CODE_APP_DIR       Managed checkout path (default: ${APP_DIR})
  NEX_CODE_APP_REPO_URL  Git repository URL (default: ${DEFAULT_REPO_URL})
  NEX_CODE_APP_BRANCH    Branch to track (default: devel)
`);
    process.exit(0);
  }

  ensureManagedCheckout();

  const state = readState(APP_DIR);
  ensureDependencies(APP_DIR, state);
  ensureBuild(APP_DIR, state);
  writeState(APP_DIR, state);
  launchDesktop(APP_DIR);
}

if (require.main === module) {
  main();
}

module.exports = {
  getManagedStatePath,
  getBlockingWorktreeChanges,
  isIgnorableManagedPath,
  isProjectDirectory,
  isWorkspaceContainerDirectory,
  findProjectRoot,
  hasStrongProjectMarker,
  parseGitStatusEntries,
  selectManagedCheckoutUpdate,
  buildLaunchArgs,
};

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
const STATE_FILE = ".nex-code-app-state.json";

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

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readState(rootDir) {
  const statePath = path.join(rootDir, STATE_FILE);
  if (!exists(statePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {};
  }
}

function writeState(rootDir, state) {
  fs.writeFileSync(
    path.join(rootDir, STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
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

  const dirty = run("git", ["status", "--porcelain"], { cwd: APP_DIR, capture: true });
  if (dirty) {
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

  if (localHead === remoteHead) {
    log(`Already on latest ${APP_BRANCH} (${localHead.slice(0, 7)})`);
    return;
  }

  log(`Updating ${APP_BRANCH} ${localHead.slice(0, 7)} -> ${remoteHead.slice(0, 7)}`);
  run("git", ["pull", "--ff-only", "origin", APP_BRANCH], { cwd: APP_DIR });
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

function launchDesktop(rootDir) {
  const npm = commandName("npm");
  const args = ["run", "start", "--", ...process.argv.slice(2)];
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

main();

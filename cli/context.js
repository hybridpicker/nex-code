/**
 * cli/context.js — Auto-Context: package.json, git, README
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { C } = require('./ui');

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function gatherProjectContext(cwd) {
  const parts = [];

  // package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const info = { name: pkg.name, version: pkg.version };
    if (pkg.scripts) info.scripts = Object.keys(pkg.scripts).slice(0, 15);
    if (pkg.dependencies) info.deps = Object.keys(pkg.dependencies).length;
    if (pkg.devDependencies) info.devDeps = Object.keys(pkg.devDependencies).length;
    parts.push(`PACKAGE: ${JSON.stringify(info)}`);
  }

  // README (first 50 lines)
  const readmePath = path.join(cwd, 'README.md');
  if (fs.existsSync(readmePath)) {
    const lines = fs.readFileSync(readmePath, 'utf-8').split('\n').slice(0, 50);
    parts.push(`README (first 50 lines):\n${lines.join('\n')}`);
  }

  // Git info
  const branch = safe(() => execSync('git branch --show-current', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim());
  if (branch) parts.push(`GIT BRANCH: ${branch}`);

  const status = safe(() => execSync('git status --short', { cwd, encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim());
  if (status) parts.push(`GIT STATUS:\n${status}`);

  const log = safe(() =>
    execSync('git log --oneline -5', { cwd, encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim()
  );
  if (log) parts.push(`RECENT COMMITS:\n${log}`);

  // .gitignore
  const giPath = path.join(cwd, '.gitignore');
  if (fs.existsSync(giPath)) {
    const content = fs.readFileSync(giPath, 'utf-8').trim();
    parts.push(`GITIGNORE:\n${content}`);
  }

  return parts.join('\n\n');
}

function printContext(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  let project = '';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    project = `${pkg.name || '?'} v${pkg.version || '?'}`;
  }

  const branch = safe(() => execSync('git branch --show-current', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim());

  console.log(`${C.dim}  cwd: ${cwd}${C.reset}`);
  if (project) console.log(`${C.dim}  project: ${project}${C.reset}`);
  if (branch) console.log(`${C.dim}  branch: ${branch}${C.reset}`);
  console.log();
}

module.exports = { gatherProjectContext, printContext };

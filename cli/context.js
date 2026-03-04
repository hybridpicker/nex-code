/**
 * cli/context.js — Auto-Context: package.json, git, README
 */

const fs = require('fs').promises;
const path = require('path');
const exec = require('util').promisify(require('child_process').exec);
const { C } = require('./ui');
const { getMergeConflicts } = require('./git');

async function safe(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function gatherProjectContext(cwd) {
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

  // Git info
  const branch = await safe(async () => {
    const { stdout } = await exec('git branch --show-current', { cwd, timeout: 5000 });
    return stdout.trim();
  });
  if (branch) parts.push(`GIT BRANCH: ${branch}`);

  const status = await safe(async () => {
    const { stdout } = await exec('git status --short', { cwd, timeout: 5000 });
    return stdout.trim();
  });
  if (status) parts.push(`GIT STATUS:\n${status}`);

  const log = await safe(async () => {
    const { stdout } = await exec('git log --oneline -5', { cwd, timeout: 5000 });
    return stdout.trim();
  });
  if (log) parts.push(`RECENT COMMITS:\n${log}`);

  // Merge conflicts (git.js currently has getMergeConflicts as sync, we might leave it or update later)
  const conflicts = await getMergeConflicts();
  if (conflicts.length > 0) {
    const conflictFiles = conflicts.map(c => `  ${c.file}`).join('\n');
    parts.push(`MERGE CONFLICTS (resolve before editing these files):\n${conflictFiles}`);
  }

  // .gitignore
  const giPath = path.join(cwd, '.gitignore');
  const giExists = await safe(() => fs.access(giPath).then(() => true).catch(() => false));

  if (giExists) {
    const content = await fs.readFile(giPath, 'utf-8');
    parts.push(`GITIGNORE:\n${content.trim()}`);
  }

  return parts.join('\n\n');
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

  const branch = await safe(async () => {
    const { stdout } = await exec('git branch --show-current', { cwd, timeout: 5000 });
    return stdout.trim();
  });

  if (project) console.log(`${C.dim}  project: ${project}${C.reset}`);
  if (branch) console.log(`${C.dim}  branch: ${branch}${C.reset}`);

  const conflicts = await getMergeConflicts();
  if (conflicts.length > 0) {
    console.log(`${C.red}  ⚠ ${conflicts.length} unresolved merge conflict(s):${C.reset}`);
    for (const c of conflicts) {
      console.log(`${C.red}    ${c.file}${C.reset}`);
    }
    console.log(`${C.yellow}  → Resolve conflicts before starting tasks${C.reset}`);
  }

  console.log();
}

module.exports = { gatherProjectContext, printContext };

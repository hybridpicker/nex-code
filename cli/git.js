/**
 * cli/git.js — Git Intelligence
 * Smart commits, PR creation, branch management, diff-aware context
 */

const exec = require('util').promisify(require('child_process').exec);
const execFile = require('util').promisify(require('child_process').execFile);
const { C } = require('./ui');

async function safeExec(cmd) {
  try {
    const { stdout } = await exec(cmd, { cwd: process.cwd(), timeout: 30000 });
    return stdout.trim();
  } catch (e) {
    return null;
  }
}

async function safeExecGit(...args) {
  try {
    const { stdout } = await execFile('git', args, { cwd: process.cwd(), timeout: 30000 });
    return stdout.trim();
  } catch (e) {
    return null;
  }
}

/**
 * Check if we're in a git repository
 */
async function isGitRepo() {
  const result = await safeExec('git rev-parse --is-inside-work-tree');
  return result === 'true';
}

/**
 * Get current branch name
 */
async function getCurrentBranch() {
  return await safeExec('git branch --show-current');
}

/**
 * Get git status (short format)
 */
async function getStatus() {
  try {
    const { stdout } = await exec('git status --porcelain', { cwd: process.cwd(), timeout: 30000 });
    if (!stdout || !stdout.trim()) return [];
    return stdout.split('\n').filter(Boolean).map((line) => {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);
      return { status, file };
    });
  } catch {
    return [];
  }
}

/**
 * Get the diff for staged + unstaged changes
 * @param {boolean} staged — only staged changes
 */
async function getDiff(staged = false) {
  const flag = staged ? '--cached' : '';
  return (await safeExec(`git diff ${flag}`)) || '';
}

/**
 * Get list of changed files (staged + unstaged)
 */
async function getChangedFiles() {
  const status = await getStatus();
  return status.map((s) => s.file);
}

/**
 * Analyze diff and generate a commit message suggestion
 * @returns {Promise<{ summary: string, files: string[], stats: { additions: number, deletions: number } }|null>}
 */
async function analyzeDiff() {
  const files = await getChangedFiles();
  if (files.length === 0) return null;

  const diff = await getDiff();
  const stagedDiff = await getDiff(true);
  const fullDiff = stagedDiff || diff;

  // Count additions/deletions from diff (if available)
  let additions = 0;
  let deletions = 0;
  if (fullDiff) {
    const lines = fullDiff.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }
  } else {
    // Untracked files: count as additions
    additions = files.length;
  }

  // Determine type based on files and content
  let type = 'chore';
  const fileNames = files.join(' ').toLowerCase();
  if (fileNames.includes('test')) type = 'test';
  else if (fileNames.includes('readme') || fileNames.includes('doc')) type = 'docs';
  else if (additions > deletions * 2) type = 'feat';
  else if (deletions > additions) type = 'refactor';
  else type = 'fix';

  // Generate summary from file names
  const shortFiles = files.slice(0, 3).map((f) => f.split('/').pop());
  const summary = `${type}: update ${shortFiles.join(', ')}${files.length > 3 ? ` (+${files.length - 3} more)` : ''}`;

  return {
    summary,
    type,
    files,
    stats: { additions, deletions },
  };
}

/**
 * Create a branch from a task description
 * @param {string} description
 * @returns {Promise<string|null>} branch name or null on error
 */
async function createBranch(description) {
  const name = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  const branchName = `feat/${name}`;
  const result = await safeExecGit('checkout', '-b', branchName);
  return result !== null ? branchName : null;
}

/**
 * Stage all changes and commit
 * @param {string} message
 * @returns {Promise<string|null>} commit hash or null
 */
async function commit(message) {
  await safeExecGit('add', '-A');
  const result = await safeExecGit('commit', '-m', message);
  if (!result) return null;
  return await safeExecGit('rev-parse', '--short', 'HEAD');
}

/**
 * Show a formatted diff summary
 */
async function formatDiffSummary() {
  const analysis = await analyzeDiff();
  if (!analysis) return `${C.dim}No changes${C.reset}`;

  const lines = [];
  lines.push(`\n${C.bold}${C.cyan}Git Diff Summary:${C.reset}`);
  lines.push(`  ${C.green}+${analysis.stats.additions}${C.reset} ${C.red}-${analysis.stats.deletions}${C.reset} in ${analysis.files.length} file(s)`);
  lines.push(`\n${C.bold}${C.cyan}Files:${C.reset}`);
  for (const f of analysis.files.slice(0, 20)) {
    lines.push(`  ${C.dim}${f}${C.reset}`);
  }
  if (analysis.files.length > 20) {
    lines.push(`  ${C.dim}...+${analysis.files.length - 20} more${C.reset}`);
  }
  lines.push(`\n${C.bold}${C.cyan}Suggested message:${C.reset}`);
  lines.push(`  ${C.cyan}${analysis.summary}${C.reset}\n`);
  return lines.join('\n');
}

/**
 * Get files with unresolved merge conflicts (UU, AA, DD)
 */
async function getMergeConflicts() {
  const status = await getStatus();
  return status.filter(s => s.status === 'UU' || s.status === 'AA' || s.status === 'DD');
}

/**
 * Get diff-aware context (only changed files' content)
 * For use when the user is working on git-related tasks
 */
async function getDiffContext() {
  const files = await getChangedFiles();
  if (files.length === 0) return '';

  const parts = [`CHANGED FILES (${files.length}):`];
  for (const f of files.slice(0, 10)) {
    parts.push(`  ${f}`);
  }
  const diff = await getDiff();
  if (diff) {
    const truncated = diff.length > 5000 ? diff.substring(0, 5000) + '\n...(truncated)' : diff;
    parts.push(`\nDIFF:\n${truncated}`);
  }
  return parts.join('\n');
}

module.exports = {
  isGitRepo,
  getCurrentBranch,
  getStatus,
  getDiff,
  getChangedFiles,
  analyzeDiff,
  createBranch,
  commit,
  formatDiffSummary,
  getDiffContext,
  getMergeConflicts,
};

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('git.js', () => {
  let git;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-git-'));
    // Initialize a git repo in temp dir
    execSync('git init', { cwd: tmpDir });
    execSync('git config user.email "test@test.com"', { cwd: tmpDir });
    execSync('git config user.name "Test"', { cwd: tmpDir });
    // Create initial commit
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test\n', 'utf-8');
    execSync('git add . && git commit -m "init"', { cwd: tmpDir });

    jest.resetModules();
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    git = require('../cli/git');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  describe('isGitRepo()', () => {
    it('returns true in git repo', async () => {
      expect(await git.isGitRepo()).toBe(true);
    });
  });

  describe('getCurrentBranch()', () => {
    it('returns current branch name', async () => {
      const branch = await git.getCurrentBranch();
      // Could be main or master depending on git config
      expect(typeof branch).toBe('string');
      expect(branch.length).toBeGreaterThan(0);
    });
  });

  describe('getStatus()', () => {
    it('returns empty array for clean repo', async () => {
      expect(await git.getStatus()).toEqual([]);
    });

    it('detects new files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'hello', 'utf-8');
      const status = await git.getStatus();
      expect(status.length).toBe(1);
      expect(status[0].file).toBe('new.txt');
    });

    it('detects modified files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Updated\n', 'utf-8');
      const status = await git.getStatus();
      expect(status.length).toBe(1);
      expect(status[0].file).toBe('README.md');
    });
  });

  describe('getDiff()', () => {
    it('returns empty string for no changes', async () => {
      expect(await git.getDiff()).toBe('');
    });

    it('returns diff for modified file', async () => {
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Updated\nNew line\n', 'utf-8');
      const diff = await git.getDiff();
      expect(diff).toContain('Updated');
      expect(diff).toContain('+');
    });

    it('returns staged diff', async () => {
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Staged\n', 'utf-8');
      execSync('git add README.md', { cwd: tmpDir });
      const diff = await git.getDiff(true);
      expect(diff).toContain('Staged');
    });
  });

  describe('getChangedFiles()', () => {
    it('returns empty array for clean repo', async () => {
      expect(await git.getChangedFiles()).toEqual([]);
    });

    it('lists changed files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'a.js'), 'console.log(1)', 'utf-8');
      fs.writeFileSync(path.join(tmpDir, 'b.js'), 'console.log(2)', 'utf-8');
      const files = await git.getChangedFiles();
      expect(files).toContain('a.js');
      expect(files).toContain('b.js');
    });
  });

  describe('analyzeDiff()', () => {
    it('returns null for no changes', async () => {
      expect(await git.analyzeDiff()).toBeNull();
    });

    it('analyzes changes and generates summary', async () => {
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'const x = 1;\nconst y = 2;\n', 'utf-8');
      const analysis = await git.analyzeDiff();
      expect(analysis).not.toBeNull();
      expect(analysis.files).toContain('index.js');
      expect(analysis.stats.additions).toBeGreaterThan(0);
      expect(analysis.summary).toBeDefined();
      expect(analysis.type).toBeDefined();
    });

    it('detects test type', async () => {
      fs.writeFileSync(path.join(tmpDir, 'test.js'), 'test("x", () => {})', 'utf-8');
      const analysis = await git.analyzeDiff();
      expect(analysis.type).toBe('test');
    });

    it('detects docs type', async () => {
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Updated docs\nMore info\n', 'utf-8');
      const analysis = await git.analyzeDiff();
      expect(analysis.type).toBe('docs');
    });
  });

  describe('createBranch()', () => {
    it('creates feature branch', async () => {
      const name = await git.createBranch('add user auth');
      expect(name).toBe('feat/add-user-auth');
      expect(await git.getCurrentBranch()).toBe('feat/add-user-auth');
    });

    it('sanitizes branch name', async () => {
      const name = await git.createBranch('Fix Bug #123!');
      expect(name).toBe('feat/fix-bug-123');
    });
  });

  describe('commit()', () => {
    it('commits staged changes', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'content', 'utf-8');
      const hash = await git.commit('test commit');
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('returns null when nothing to commit', async () => {
      // Already clean - but commit() does git add -A first, so it might find nothing
      const hash = await git.commit('empty');
      expect(hash).toBeNull();
    });
  });

  describe('formatDiffSummary()', () => {
    it('shows no changes for clean repo', async () => {
      const output = await git.formatDiffSummary();
      expect(output).toContain('No changes');
    });

    it('formats diff summary', async () => {
      fs.writeFileSync(path.join(tmpDir, 'code.js'), 'const a = 1;\n', 'utf-8');
      const output = await git.formatDiffSummary();
      expect(output).toContain('Diff Summary');
      expect(output).toContain('code.js');
    });
  });

  describe('getMergeConflicts()', () => {
    it('returns empty array when no conflicts', async () => {
      expect(await git.getMergeConflicts()).toEqual([]);
    });

     it('detects merge conflicts (UU)', async () => {
       // Create a conflict: modify same file on two branches
       fs.writeFileSync(path.join(tmpDir, 'conflict.txt'), 'line1\n', 'utf-8');
       execSync('git add conflict.txt && git commit -m "add conflict.txt"', { cwd: tmpDir });

       execSync('git checkout -b feature', { cwd: tmpDir });
       fs.writeFileSync(path.join(tmpDir, 'conflict.txt'), 'feature-change\n', 'utf-8');
       execSync('git add conflict.txt && git commit -m "feature change"', { cwd: tmpDir });

       execSync('git checkout main', { cwd: tmpDir });
       fs.writeFileSync(path.join(tmpDir, 'conflict.txt'), 'main-change\n', 'utf-8');
       execSync('git add conflict.txt && git commit -m "main change"', { cwd: tmpDir });

      // Merge will fail with conflict
      try { execSync('git merge feature', { cwd: tmpDir, stdio: 'pipe' }); } catch { }

      const conflicts = await git.getMergeConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0].status).toBe('UU');
      expect(conflicts[0].file).toBe('conflict.txt');
    });

    it('returns empty when modified files exist but no conflicts', async () => {
      fs.writeFileSync(path.join(tmpDir, 'normal.txt'), 'changed', 'utf-8');
      expect(await git.getMergeConflicts()).toEqual([]);
    });
  });

  describe('getDiffContext()', () => {
    it('returns empty for clean repo', async () => {
      expect(await git.getDiffContext()).toBe('');
    });

    it('returns context with changed files and diff', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file.js'), 'hello', 'utf-8');
      const ctx = await git.getDiffContext();
      expect(ctx).toContain('CHANGED FILES');
      expect(ctx).toContain('file.js');
    });
  });
});

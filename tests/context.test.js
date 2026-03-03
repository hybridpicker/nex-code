const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Must require after mocking
const { gatherProjectContext, printContext } = require('../cli/context');

describe('context.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'jc-test-'));
    execSync.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── gatherProjectContext ─────────────────────────────────
  describe('gatherProjectContext()', () => {
    it('includes package.json info when present', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'test-proj',
          version: '1.0.0',
          scripts: { test: 'jest', build: 'tsc' },
          dependencies: { axios: '^1.0.0' },
          devDependencies: { jest: '^29.0.0' },
        })
      );
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('test-proj');
      expect(ctx).toContain('1.0.0');
      expect(ctx).toContain('PACKAGE');
    });

    it('includes script names from package.json', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'x', scripts: { test: 'jest', build: 'tsc', lint: 'eslint' } })
      );
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('test');
      expect(ctx).toContain('build');
      expect(ctx).toContain('lint');
    });

    it('skips package.json when missing', () => {
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).not.toContain('PACKAGE');
    });

    it('includes README first 50 lines', () => {
      const lines = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`);
      fs.writeFileSync(path.join(tmpDir, 'README.md'), lines.join('\n'));
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('Line 1');
      expect(ctx).toContain('Line 50');
      expect(ctx).not.toContain('Line 51');
    });

    it('skips README when missing', () => {
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).not.toContain('README');
    });

    it('includes git branch', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('branch')) return 'main\n';
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('GIT BRANCH: main');
    });

    it('includes git status', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('status')) return 'M file.js\n';
        if (cmd.includes('branch')) return 'main\n';
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('M file.js');
    });

    it('includes git log', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('log')) return 'abc1234 initial commit\n';
        if (cmd.includes('branch')) return 'main\n';
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('abc1234 initial commit');
    });

    it('includes .gitignore', () => {
      fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n.env\n');
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const ctx = gatherProjectContext(tmpDir);
      expect(ctx).toContain('node_modules/');
      expect(ctx).toContain('.env');
    });

    it('handles all git commands failing gracefully', () => {
      execSync.mockImplementation(() => {
        throw new Error('not a git repo');
      });

      expect(() => gatherProjectContext(tmpDir)).not.toThrow();
    });
  });

  // ─── printContext ─────────────────────────────────────────
  describe('printContext()', () => {
    it('prints project info to console', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ name: 'my-app', version: '2.0.0' })
      );
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('branch')) return 'develop\n';
        throw new Error('no git');
      });

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      printContext(tmpDir);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('my-app');
      expect(output).toContain('2.0.0');
      expect(output).toContain('develop');
      logSpy.mockRestore();
    });

    it('prints only empty line without package.json or git', () => {
      execSync.mockImplementation(() => {
        throw new Error('no git');
      });

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      printContext(tmpDir);
      // No project info, no branch — only the trailing empty line
      expect(logSpy).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });
  });
});

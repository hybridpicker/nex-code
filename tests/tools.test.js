const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock safety and diff modules
jest.mock('../cli/safety', () => ({
  isForbidden: jest.requireActual('../cli/safety').isForbidden,
  isDangerous: jest.requireActual('../cli/safety').isDangerous,
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));

jest.mock('../cli/diff', () => ({
  showEditDiff: jest.fn(),
  showWriteDiff: jest.fn(),
  showNewFilePreview: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

const { TOOL_DEFINITIONS, executeTool, resolvePath } = require('../cli/tools');
const { confirmFileChange } = require('../cli/diff');

describe('tools.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-tools-'));
    confirmFileChange.mockResolvedValue(true);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── TOOL_DEFINITIONS ─────────────────────────────────────
  describe('TOOL_DEFINITIONS', () => {
    it('defines 12 tools', () => {
      expect(TOOL_DEFINITIONS).toHaveLength(12);
    });

    it('each tool has proper structure', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.type).toBe('function');
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe('object');
      }
    });

    const expectedTools = ['bash', 'read_file', 'write_file', 'edit_file', 'list_directory', 'search_files'];
    it.each(expectedTools)('includes %s tool', (name) => {
      expect(TOOL_DEFINITIONS.some((t) => t.function.name === name)).toBe(true);
    });
  });

  // ─── resolvePath ──────────────────────────────────────────
  describe('resolvePath()', () => {
    it('returns absolute path unchanged', () => {
      expect(resolvePath('/tmp/test.js')).toBe('/tmp/test.js');
    });

    it('resolves relative path from CWD', () => {
      const result = resolvePath('test.js');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('test.js');
    });
  });

  // ─── bash tool ──────────────────────────────────────────────
  describe('executeTool("bash")', () => {
    it('executes command and returns output', async () => {
      const result = await executeTool('bash', { command: 'echo hello' });
      expect(result.trim()).toBe('hello');
    });

    it('returns exit code on failure', async () => {
      const result = await executeTool('bash', { command: 'exit 42' });
      expect(result).toContain('EXIT');
    });

    it('blocks forbidden commands', async () => {
      const result = await executeTool('bash', { command: 'rm -rf / ' });
      expect(result).toContain('BLOCKED');
    });

    it('blocks cat .env', async () => {
      const result = await executeTool('bash', { command: 'cat .env' });
      expect(result).toContain('BLOCKED');
    });
  });

  // ─── read_file tool ─────────────────────────────────────────
  describe('executeTool("read_file")', () => {
    it('reads existing file', async () => {
      const fp = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(fp, 'line1\nline2\nline3\n');
      const result = await executeTool('read_file', { path: fp });
      expect(result).toContain('1: line1');
      expect(result).toContain('2: line2');
      expect(result).toContain('3: line3');
    });

    it('reads with line range', async () => {
      const fp = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(fp, 'line1\nline2\nline3\nline4\nline5\n');
      const result = await executeTool('read_file', { path: fp, line_start: 2, line_end: 4 });
      expect(result).toContain('2: line2');
      expect(result).toContain('4: line4');
      expect(result).not.toContain('1: line1');
      expect(result).not.toContain('5: line5');
    });

    it('returns error for missing file', async () => {
      const result = await executeTool('read_file', { path: '/nonexistent/file.txt' });
      expect(result).toContain('ERROR');
      expect(result).toContain('not found');
    });
  });

  // ─── write_file tool ────────────────────────────────────────
  describe('executeTool("write_file")', () => {
    it('creates new file', async () => {
      const fp = path.join(tmpDir, 'new.txt');
      const result = await executeTool('write_file', { path: fp, content: 'hello world' });
      expect(result).toContain('Written');
      expect(fs.readFileSync(fp, 'utf-8')).toBe('hello world');
    });

    it('creates nested directories', async () => {
      const fp = path.join(tmpDir, 'sub', 'dir', 'new.txt');
      const result = await executeTool('write_file', { path: fp, content: 'deep' });
      expect(result).toContain('Written');
      expect(fs.existsSync(fp)).toBe(true);
    });

    it('returns CANCELLED when user declines', async () => {
      const fp = path.join(tmpDir, 'decline.txt');
      confirmFileChange.mockResolvedValueOnce(false);
      const result = await executeTool('write_file', { path: fp, content: 'test' });
      expect(result).toContain('CANCELLED');
    });

    it('overwrites existing file after confirmation', async () => {
      const fp = path.join(tmpDir, 'existing.txt');
      fs.writeFileSync(fp, 'old');
      const result = await executeTool('write_file', { path: fp, content: 'new' });
      expect(result).toContain('Written');
      expect(fs.readFileSync(fp, 'utf-8')).toBe('new');
    });
  });

  // ─── edit_file tool ─────────────────────────────────────────
  describe('executeTool("edit_file")', () => {
    it('replaces text in file', async () => {
      const fp = path.join(tmpDir, 'edit.txt');
      fs.writeFileSync(fp, 'hello world');
      const result = await executeTool('edit_file', {
        path: fp,
        old_text: 'world',
        new_text: 'nex',
      });
      expect(result).toContain('Edited');
      expect(fs.readFileSync(fp, 'utf-8')).toBe('hello nex');
    });

    it('returns error when old_text not found', async () => {
      const fp = path.join(tmpDir, 'edit.txt');
      fs.writeFileSync(fp, 'hello world');
      const result = await executeTool('edit_file', {
        path: fp,
        old_text: 'nonexistent',
        new_text: 'replacement',
      });
      expect(result).toContain('ERROR');
      expect(result).toContain('not found');
    });

    it('returns error for missing file', async () => {
      const result = await executeTool('edit_file', {
        path: '/nonexistent/file.txt',
        old_text: 'a',
        new_text: 'b',
      });
      expect(result).toContain('ERROR');
    });

    it('returns CANCELLED when user declines', async () => {
      const fp = path.join(tmpDir, 'edit.txt');
      fs.writeFileSync(fp, 'hello world');
      confirmFileChange.mockResolvedValueOnce(false);
      const result = await executeTool('edit_file', {
        path: fp,
        old_text: 'world',
        new_text: 'nex',
      });
      expect(result).toContain('CANCELLED');
      // File unchanged
      expect(fs.readFileSync(fp, 'utf-8')).toBe('hello world');
    });
  });

  // ─── list_directory tool ──────────────────────────────────
  describe('executeTool("list_directory")', () => {
    it('lists directory contents', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file1.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'file2.txt'), '');
      const result = await executeTool('list_directory', { path: tmpDir });
      expect(result).toContain('file1.js');
      expect(result).toContain('file2.txt');
    });

    it('shows directories with / suffix', async () => {
      fs.mkdirSync(path.join(tmpDir, 'subdir'));
      const result = await executeTool('list_directory', { path: tmpDir });
      expect(result).toContain('subdir/');
    });

    it('skips hidden files', async () => {
      fs.writeFileSync(path.join(tmpDir, '.hidden'), '');
      fs.writeFileSync(path.join(tmpDir, 'visible.js'), '');
      const result = await executeTool('list_directory', { path: tmpDir });
      expect(result).not.toContain('.hidden');
      expect(result).toContain('visible.js');
    });

    it('skips node_modules', async () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.writeFileSync(path.join(tmpDir, 'index.js'), '');
      const result = await executeTool('list_directory', { path: tmpDir });
      expect(result).not.toContain('node_modules');
    });

    it('returns error for missing directory', async () => {
      const result = await executeTool('list_directory', { path: '/nonexistent/dir' });
      expect(result).toContain('ERROR');
    });

    it('filters by pattern', async () => {
      fs.writeFileSync(path.join(tmpDir, 'app.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'style.css'), '');
      const result = await executeTool('list_directory', { path: tmpDir, pattern: '*.js' });
      expect(result).toContain('app.js');
      expect(result).not.toContain('style.css');
    });

    it('returns (empty) for empty directory', async () => {
      const emptyDir = path.join(tmpDir, 'empty');
      fs.mkdirSync(emptyDir);
      const result = await executeTool('list_directory', { path: emptyDir });
      expect(result).toBe('(empty)');
    });
  });

  // ─── search_files tool ──────────────────────────────────────
  describe('executeTool("search_files")', () => {
    it('finds pattern in files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'search.js'), 'const hello = "world";\n');
      const result = await executeTool('search_files', { path: tmpDir, pattern: 'hello' });
      expect(result).toContain('hello');
    });

    it('returns no matches when not found', async () => {
      fs.writeFileSync(path.join(tmpDir, 'search.js'), 'const x = 1;\n');
      const result = await executeTool('search_files', { path: tmpDir, pattern: 'nonexistent_pattern_xyz' });
      expect(result).toContain('no matches');
    });
  });

  // ─── unknown tool ───────────────────────────────────────────
  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await executeTool('unknown_tool', {});
      expect(result).toContain('ERROR');
      expect(result).toContain('Unknown tool');
    });
  });
});

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

jest.mock('../cli/file-history', () => ({
  recordChange: jest.fn(),
}));

jest.mock('../cli/diff', () => ({
  showClaudeDiff: jest.fn(),
  showClaudeNewFile: jest.fn(),
  showEditDiff: jest.fn(),
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
    it('defines 17 tools', () => {
      expect(TOOL_DEFINITIONS).toHaveLength(17);
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

    it('blocks sensitive paths', () => {
      expect(resolvePath('/home/user/.ssh/id_rsa')).toBeNull();
      expect(resolvePath('/etc/passwd')).toBeNull();
      expect(resolvePath('/home/user/.aws/credentials')).toBeNull();
      expect(resolvePath('.env')).toBeNull();
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

    it('passes file_pattern as --include', async () => {
      fs.writeFileSync(path.join(tmpDir, 'app.js'), 'const hello = 1;\n');
      fs.writeFileSync(path.join(tmpDir, 'app.css'), 'hello { color: red; }\n');
      const result = await executeTool('search_files', { path: tmpDir, pattern: 'hello', file_pattern: '*.js' });
      expect(result).toContain('hello');
      expect(result).toContain('.js');
    });
  });

  // ─── glob tool ──────────────────────────────────────────────
  describe('executeTool("glob")', () => {
    it('finds files matching glob pattern', async () => {
      fs.writeFileSync(path.join(tmpDir, 'app.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'style.css'), '');
      const result = await executeTool('glob', { pattern: '*.js', path: tmpDir });
      expect(result).toContain('app.js');
      expect(result).not.toContain('style.css');
    });

    it('finds files recursively with **', async () => {
      const sub = path.join(tmpDir, 'src');
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(sub, 'index.js'), '');
      fs.writeFileSync(path.join(tmpDir, 'root.js'), '');
      const result = await executeTool('glob', { pattern: '**/*.js', path: tmpDir });
      expect(result).toContain('index.js');
      expect(result).toContain('root.js');
    });

    it('returns no matches for unmatched pattern', async () => {
      fs.writeFileSync(path.join(tmpDir, 'file.txt'), '');
      const result = await executeTool('glob', { pattern: '*.py', path: tmpDir });
      expect(result).toBe('(no matches)');
    });

    it('uses CWD when no path specified', async () => {
      const result = await executeTool('glob', { pattern: 'package.json' });
      expect(result).toContain('package.json');
    });

    it('skips node_modules and .git', async () => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'));
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.js'), '');
      fs.mkdirSync(path.join(tmpDir, '.git'));
      fs.writeFileSync(path.join(tmpDir, '.git', 'HEAD'), '');
      fs.writeFileSync(path.join(tmpDir, 'app.js'), '');
      const result = await executeTool('glob', { pattern: '**/*.js', path: tmpDir });
      expect(result).toContain('app.js');
      expect(result).not.toContain('node_modules');
      expect(result).not.toContain('.git');
    });
  });

  // ─── grep tool ──────────────────────────────────────────────
  describe('executeTool("grep")', () => {
    it('finds pattern in files', async () => {
      fs.writeFileSync(path.join(tmpDir, 'code.js'), 'const foo = "bar";\n');
      const result = await executeTool('grep', { pattern: 'foo', path: tmpDir });
      expect(result).toContain('foo');
    });

    it('supports case-insensitive search', async () => {
      fs.writeFileSync(path.join(tmpDir, 'code.js'), 'const FOO = 1;\n');
      const result = await executeTool('grep', { pattern: 'foo', path: tmpDir, ignore_case: true });
      expect(result).toContain('FOO');
    });

    it('filters by include pattern', async () => {
      fs.writeFileSync(path.join(tmpDir, 'code.js'), 'hello\n');
      fs.writeFileSync(path.join(tmpDir, 'code.py'), 'hello\n');
      const result = await executeTool('grep', { pattern: 'hello', path: tmpDir, include: '*.js' });
      expect(result).toContain('.js');
    });

    it('returns no matches for unmatched pattern', async () => {
      fs.writeFileSync(path.join(tmpDir, 'code.js'), 'const x = 1;\n');
      const result = await executeTool('grep', { pattern: 'nonexistent_xyz_abc', path: tmpDir });
      expect(result).toBe('(no matches)');
    });

    it('uses CWD when no path specified', async () => {
      const result = await executeTool('grep', { pattern: 'nex-code' });
      // Should find it in package.json
      expect(result).toContain('nex-code');
    });
  });

  // ─── patch_file tool ───────────────────────────────────────
  describe('executeTool("patch_file")', () => {
    it('applies multiple patches', async () => {
      const fp = path.join(tmpDir, 'patch.txt');
      fs.writeFileSync(fp, 'hello world\nfoo bar\n');
      const result = await executeTool('patch_file', {
        path: fp,
        patches: [
          { old_text: 'hello', new_text: 'hi' },
          { old_text: 'foo', new_text: 'baz' },
        ],
      });
      expect(result).toContain('Patched');
      expect(result).toContain('2 replacements');
      const content = fs.readFileSync(fp, 'utf-8');
      expect(content).toContain('hi world');
      expect(content).toContain('baz bar');
    });

    it('returns error for missing file', async () => {
      const result = await executeTool('patch_file', {
        path: '/nonexistent/file.txt',
        patches: [{ old_text: 'a', new_text: 'b' }],
      });
      expect(result).toContain('ERROR');
    });

    it('returns error for empty patches', async () => {
      const fp = path.join(tmpDir, 'patch.txt');
      fs.writeFileSync(fp, 'hello');
      const result = await executeTool('patch_file', { path: fp, patches: [] });
      expect(result).toContain('ERROR');
      expect(result).toContain('No patches');
    });

    it('returns error when old_text not found', async () => {
      const fp = path.join(tmpDir, 'patch.txt');
      fs.writeFileSync(fp, 'hello world');
      const result = await executeTool('patch_file', {
        path: fp,
        patches: [{ old_text: 'nonexistent', new_text: 'replacement' }],
      });
      expect(result).toContain('ERROR');
      expect(result).toContain('not found');
    });

    it('returns CANCELLED when user declines', async () => {
      const fp = path.join(tmpDir, 'patch.txt');
      fs.writeFileSync(fp, 'hello world');
      confirmFileChange.mockResolvedValueOnce(false);
      const result = await executeTool('patch_file', {
        path: fp,
        patches: [{ old_text: 'hello', new_text: 'hi' }],
      });
      expect(result).toContain('CANCELLED');
      expect(fs.readFileSync(fp, 'utf-8')).toBe('hello world');
    });
  });

  // ─── web_fetch tool ────────────────────────────────────────
  describe('executeTool("web_fetch")', () => {
    const axios = require('axios');

    it('fetches URL and strips HTML', async () => {
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: '<html><body><p>Hello World</p></body></html>',
      });
      const result = await executeTool('web_fetch', { url: 'https://example.com' });
      expect(result).toContain('Hello World');
      expect(result).not.toContain('<p>');
      axios.get.mockRestore();
    });

    it('handles JSON response', async () => {
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: { key: 'value' },
      });
      const result = await executeTool('web_fetch', { url: 'https://api.example.com/data' });
      expect(result).toContain('key');
      expect(result).toContain('value');
      axios.get.mockRestore();
    });

    it('respects max_length', async () => {
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: 'a'.repeat(20000),
      });
      const result = await executeTool('web_fetch', { url: 'https://example.com', max_length: 100 });
      expect(result.length).toBeLessThanOrEqual(100);
      axios.get.mockRestore();
    });

    it('returns error on fetch failure', async () => {
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('Network error'));
      const result = await executeTool('web_fetch', { url: 'https://fail.example.com' });
      expect(result).toContain('ERROR');
      expect(result).toContain('Network error');
      axios.get.mockRestore();
    });

    it('strips script and style tags', async () => {
      jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: '<html><script>alert("xss")</script><style>.a{}</style><p>Content</p></html>',
      });
      const result = await executeTool('web_fetch', { url: 'https://example.com' });
      expect(result).toContain('Content');
      expect(result).not.toContain('alert');
      expect(result).not.toContain('.a{}');
      axios.get.mockRestore();
    });

    it('returns (empty response) for empty data', async () => {
      jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: '' });
      const result = await executeTool('web_fetch', { url: 'https://example.com' });
      expect(result).toBe('(empty response)');
      axios.get.mockRestore();
    });
  });

  // ─── web_search tool ──────────────────────────────────────
  describe('executeTool("web_search")', () => {
    const axios = require('axios');

    it('parses DuckDuckGo HTML results', async () => {
      const mockHtml = `
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&rut=abc">
          Example Page Title
        </a>
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fother.com&rut=def">
          Other Result
        </a>
      `;
      jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockHtml });
      const result = await executeTool('web_search', { query: 'test query' });
      expect(result).toContain('Example Page Title');
      expect(result).toContain('example.com');
      axios.get.mockRestore();
    });

    it('returns (no results) when no matches', async () => {
      jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: '<html><body></body></html>' });
      const result = await executeTool('web_search', { query: 'test' });
      expect(result).toBe('(no results)');
      axios.get.mockRestore();
    });

    it('returns error on search failure', async () => {
      jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('timeout'));
      const result = await executeTool('web_search', { query: 'test' });
      expect(result).toContain('ERROR');
      axios.get.mockRestore();
    });

    it('respects max_results', async () => {
      const mockHtml = Array.from({ length: 10 }, (_, i) =>
        `<a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample${i}.com&rut=x">Result ${i}</a>`
      ).join('\n');
      jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockHtml });
      const result = await executeTool('web_search', { query: 'test', max_results: 2 });
      const lines = result.split('\n\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      axios.get.mockRestore();
    });
  });

  // ─── ask_user tool ─────────────────────────────────────────
  describe('executeTool("ask_user")', () => {
    it('prompts user and returns response', async () => {
      const rl = require('readline');
      const mockRl = {
        question: jest.fn((q, cb) => cb('yes')),
        close: jest.fn(),
      };
      jest.spyOn(rl, 'createInterface').mockReturnValueOnce(mockRl);
      const result = await executeTool('ask_user', { question: 'Continue?' });
      expect(result).toBe('yes');
      rl.createInterface.mockRestore();
    });

    it('returns (no response) for empty input', async () => {
      const rl = require('readline');
      const mockRl = {
        question: jest.fn((q, cb) => cb('')),
        close: jest.fn(),
      };
      jest.spyOn(rl, 'createInterface').mockReturnValueOnce(mockRl);
      const result = await executeTool('ask_user', { question: 'Continue?' });
      expect(result).toBe('(no response)');
      rl.createInterface.mockRestore();
    });
  });

  // ─── bash dangerous command ────────────────────────────────
  describe('executeTool("bash") dangerous commands', () => {
    it('allows dangerous command when confirm returns true', async () => {
      const result = await executeTool('bash', { command: 'echo dangerous && git push' });
      // confirm is mocked to return true, so it should execute
      // The command will likely fail with exit code but won't be BLOCKED
      expect(result).not.toContain('BLOCKED');
    });

    it('returns CANCELLED when confirm returns false for dangerous command', async () => {
      const { confirm } = require('../cli/safety');
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool('bash', { command: 'git push origin main' });
      expect(result).toContain('CANCELLED');
    });

    it('returns (no output) for empty stdout', async () => {
      const result = await executeTool('bash', { command: 'true' });
      expect(result).toBe('(no output)');
    });
  });

  // ─── read_file binary detection ──────────────────────────────
  describe('executeTool("read_file") binary detection', () => {
    it('detects binary files via null bytes', async () => {
      const fp = path.join(tmpDir, 'binary.dat');
      const buf = Buffer.alloc(100);
      buf[50] = 0; // null byte
      buf.write('text', 0);
      fs.writeFileSync(fp, buf);
      const result = await executeTool('read_file', { path: fp });
      expect(result).toContain('binary file');
    });
  });

  // ─── git tools ──────────────────────────────────────────────
  describe('git tools', () => {
    describe('executeTool("git_status")', () => {
      it('includes git_status in tool definitions', () => {
        expect(TOOL_DEFINITIONS.some((t) => t.function.name === 'git_status')).toBe(true);
      });

      it('returns branch and status info', async () => {
        const result = await executeTool('git_status', {});
        expect(result).toContain('Branch:');
      });
    });

    describe('executeTool("git_diff")', () => {
      it('includes git_diff in tool definitions', () => {
        expect(TOOL_DEFINITIONS.some((t) => t.function.name === 'git_diff')).toBe(true);
      });

      it('returns diff or no diff', async () => {
        const result = await executeTool('git_diff', {});
        expect(typeof result).toBe('string');
      });

      it('returns diff for specific file', async () => {
        const result = await executeTool('git_diff', { file: 'nonexistent-file-xyz.js' });
        expect(result).toBe('(no diff)');
      });

      it('supports staged flag', async () => {
        const result = await executeTool('git_diff', { staged: true });
        expect(typeof result).toBe('string');
      });
    });

    describe('executeTool("git_log")', () => {
      it('includes git_log in tool definitions', () => {
        expect(TOOL_DEFINITIONS.some((t) => t.function.name === 'git_log')).toBe(true);
      });

      it('returns recent commits', async () => {
        const result = await executeTool('git_log', {});
        expect(result.length).toBeGreaterThan(0);
      });

      it('respects count parameter', async () => {
        const result = await executeTool('git_log', { count: 3 });
        const lines = result.split('\n').filter(Boolean);
        expect(lines.length).toBeLessThanOrEqual(3);
      });

      it('caps count at 50', async () => {
        const result = await executeTool('git_log', { count: 100 });
        const lines = result.split('\n').filter(Boolean);
        expect(lines.length).toBeLessThanOrEqual(50);
      });

      it('supports file parameter', async () => {
        const result = await executeTool('git_log', { file: 'package.json' });
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── web_search URL decoding fallback ─────────────────────
  describe('web_search URL decoding fallback', () => {
    const axios = require('axios');

    it('handles malformed URL encoding gracefully', async () => {
      // %ZZ is invalid percent-encoding that causes decodeURIComponent to throw
      const mockHtml = `
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage%ZZ&rut=abc">
          Valid Title
        </a>
      `;
      jest.spyOn(axios, 'get').mockResolvedValueOnce({ data: mockHtml });
      const result = await executeTool('web_search', { query: 'test' });
      // Should not throw, should return a result
      expect(result).toContain('Valid Title');
      axios.get.mockRestore();
    });
  });

  // ─── glob truncation ──────────────────────────────────────
  describe('glob truncation warning', () => {
    it('shows truncation warning at 200 results', async () => {
      // Create 210 files
      for (let i = 0; i < 210; i++) {
        fs.writeFileSync(path.join(tmpDir, `file${String(i).padStart(3, '0')}.txt`), '');
      }
      const result = await executeTool('glob', { pattern: '*.txt', path: tmpDir });
      expect(result).toContain('truncated');
      expect(result).toContain('200');
    });
  });

  // ─── recordChange calls for file operations ────────────────
  describe('recordChange integration', () => {
    it('records change after write_file (new file)', async () => {
      const { recordChange } = require('../cli/file-history');
      recordChange.mockClear();
      const fp = path.join(tmpDir, 'recorded-new.txt');
      await executeTool('write_file', { path: fp, content: 'hello' });
      expect(recordChange).toHaveBeenCalledWith('write_file', fp, null, 'hello');
    });

    it('records change after write_file (overwrite)', async () => {
      const { recordChange } = require('../cli/file-history');
      recordChange.mockClear();
      const fp = path.join(tmpDir, 'recorded-ow.txt');
      fs.writeFileSync(fp, 'old');
      await executeTool('write_file', { path: fp, content: 'new' });
      expect(recordChange).toHaveBeenCalledWith('write_file', fp, 'old', 'new');
    });

    it('records change after edit_file', async () => {
      const { recordChange } = require('../cli/file-history');
      recordChange.mockClear();
      const fp = path.join(tmpDir, 'recorded-edit.txt');
      fs.writeFileSync(fp, 'hello world');
      await executeTool('edit_file', { path: fp, old_text: 'world', new_text: 'nex' });
      expect(recordChange).toHaveBeenCalledWith('edit_file', fp, 'hello world', 'hello nex');
    });

    it('records change after patch_file', async () => {
      const { recordChange } = require('../cli/file-history');
      recordChange.mockClear();
      const fp = path.join(tmpDir, 'recorded-patch.txt');
      fs.writeFileSync(fp, 'hello world');
      await executeTool('patch_file', { path: fp, patches: [{ old_text: 'hello', new_text: 'hi' }] });
      expect(recordChange).toHaveBeenCalledWith('patch_file', fp, 'hello world', 'hi world');
    });
  });

  // ─── spinner wrapper for non-interactive tools ─────────────
  describe('spinner wrapper', () => {
    it('shows spinner for read_file', async () => {
      const fp = path.join(tmpDir, 'spinner-test.txt');
      fs.writeFileSync(fp, 'hello');
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
      await executeTool('read_file', { path: fp });
      const output = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('Reading:');
      writeSpy.mockRestore();
    });

    it('shows spinner for grep', async () => {
      fs.writeFileSync(path.join(tmpDir, 'g.js'), 'const x = 1;\n');
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
      await executeTool('grep', { pattern: 'const', path: tmpDir });
      const output = writeSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('Grep:');
      writeSpy.mockRestore();
    });

    it('does not show spinner for bash (has own)', async () => {
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
      await executeTool('bash', { command: 'echo hi' });
      const output = writeSpy.mock.calls.map((c) => c[0]).join('');
      // bash has its own spinner with "Running:" prefix, not our wrapper
      expect(output).toContain('Running:');
      writeSpy.mockRestore();
    });
  });

  // ─── edit_file fuzzy matching ──────────────────────────────
  describe('edit_file fuzzy matching', () => {
    it('succeeds with whitespace mismatch (tabs vs spaces)', async () => {
      const fp = path.join(tmpDir, 'fuzzy-edit.txt');
      fs.writeFileSync(fp, '\tconst x = 1;\n\tconst y = 2;\n');
      const result = await executeTool('edit_file', {
        path: fp,
        old_text: '  const x = 1;\n  const y = 2;',
        new_text: '  const x = 10;\n  const y = 20;',
      });
      expect(result).toContain('Edited');
      expect(result).toContain('fuzzy match');
      const content = fs.readFileSync(fp, 'utf-8');
      expect(content).toContain('const x = 10;');
    });

    it('auto-fixes close typo mismatch (≤5% distance)', async () => {
      const fp = path.join(tmpDir, 'fuzzy-error.txt');
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool('edit_file', {
        path: fp,
        old_text: 'const helo = "world";',
        new_text: 'const hello = "earth";',
      });
      expect(result).toContain('auto-fixed');
      expect(result).toContain('Edited');
      const content = fs.readFileSync(fp, 'utf-8');
      expect(content).toContain('const hello = "earth"');
    });

    it('shows "Most similar text" on moderate mismatch', async () => {
      const fp = path.join(tmpDir, 'fuzzy-error-large.txt');
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool('edit_file', {
        path: fp,
        // ~30% different — above auto-fix threshold but within findMostSimilar range
        old_text: 'const xyz = "world";',
        new_text: 'const hello = "earth";',
      });
      expect(result).toContain('Most similar text');
      expect(result).toContain('line');
    });
  });

  // ─── patch_file fuzzy matching ─────────────────────────────
  describe('patch_file fuzzy matching', () => {
    it('succeeds with whitespace mismatch', async () => {
      const fp = path.join(tmpDir, 'fuzzy-patch.txt');
      fs.writeFileSync(fp, '\tconst a = 1;\n\tconst b = 2;\n');
      const result = await executeTool('patch_file', {
        path: fp,
        patches: [
          { old_text: '  const a = 1;', new_text: '  const a = 10;' },
        ],
      });
      expect(result).toContain('Patched');
      expect(result).toContain('fuzzy match');
      const content = fs.readFileSync(fp, 'utf-8');
      expect(content).toContain('const a = 10;');
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

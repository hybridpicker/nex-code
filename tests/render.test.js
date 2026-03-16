const {
  renderMarkdown,
  renderInline,
  highlightCode,
  highlightJS,
  highlightBash,
  highlightJSON,
  highlightPython,
  highlightGo,
  highlightRust,
  highlightCSS,
  highlightHTML,
  renderTable,
  renderProgress,
  StreamRenderer,
} = require('../cli/render');
const { C } = require('../cli/ui');

describe('render.js', () => {
  // ─── renderInline ──────────────────────────────────────────
  describe('renderInline()', () => {
    it('returns empty string for falsy input', () => {
      expect(renderInline('')).toBe('');
      expect(renderInline(null)).toBe('');
      expect(renderInline(undefined)).toBe('');
    });

    it('renders inline code with backticks', () => {
      const result = renderInline('Use `npm install` here');
      expect(result).toContain(C.cyan);
      expect(result).toContain('npm install');
    });

    it('renders bold text with **', () => {
      const result = renderInline('This is **bold** text');
      expect(result).toContain(C.bold);
      expect(result).toContain('bold');
    });

    it('renders italic text with *', () => {
      const result = renderInline('This is *italic* text');
      expect(result).toContain(C.dim);
      expect(result).toContain('italic');
    });

    it('renders links [text](url)', () => {
      const result = renderInline('See [docs](https://example.com)');
      expect(result).toContain('docs');
      expect(result).toContain('https://example.com');
    });

    it('passes plain text through', () => {
      const result = renderInline('plain text');
      expect(result).toBe('plain text');
    });
  });

  // ─── renderMarkdown ───────────────────────────────────────
  describe('renderMarkdown()', () => {
    it('returns empty string for falsy input', () => {
      expect(renderMarkdown('')).toBe('');
      expect(renderMarkdown(null)).toBe('');
    });

    it('renders h1 headers', () => {
      const result = renderMarkdown('# Title');
      expect(result).toContain(C.bold);
      expect(result).toContain('Title');
    });

    it('renders h2 headers', () => {
      const result = renderMarkdown('## Subtitle');
      expect(result).toContain(C.bold);
      expect(result).toContain('Subtitle');
    });

    it('renders h3 headers', () => {
      const result = renderMarkdown('### Section');
      expect(result).toContain(C.bold);
      expect(result).toContain('Section');
    });

    it('renders unordered lists with bullet', () => {
      const result = renderMarkdown('- item one\n- item two');
      expect(result).toContain('•');
      expect(result).toContain('item one');
      expect(result).toContain('item two');
    });

    it('renders * lists with bullet', () => {
      const result = renderMarkdown('* item one');
      expect(result).toContain('•');
      expect(result).toContain('item one');
    });

    it('renders numbered lists', () => {
      const result = renderMarkdown('1. first\n2. second');
      expect(result).toContain('1.');
      expect(result).toContain('first');
      expect(result).toContain('2.');
      expect(result).toContain('second');
    });

    it('renders code blocks with language label', () => {
      const result = renderMarkdown('```js\nconst x = 1;\n```');
      expect(result).toContain('js');
      expect(result).toContain('─');
    });

    it('renders code blocks without language', () => {
      const result = renderMarkdown('```\nhello\n```');
      expect(result).toContain('─');
      expect(result).toContain('hello');
    });

    it('applies syntax highlighting inside code blocks', () => {
      const result = renderMarkdown('```js\nconst x = 1;\n```');
      // Should contain keyword coloring for 'const'
      expect(result).toContain(C.magenta);
    });

    it('renders inline formatting within lines', () => {
      const result = renderMarkdown('This is **bold** and `code`');
      expect(result).toContain(C.bold);
      expect(result).toContain(C.cyan);
    });

    it('handles mixed content', () => {
      const md = `# Title
Some text with **bold**.

- List item
- Another item

\`\`\`bash
npm install
\`\`\``;
      const result = renderMarkdown(md);
      expect(result).toContain('Title');
      expect(result).toContain('bold');
      expect(result).toContain('•');
      expect(result).toContain('npm');
    });

    it('preserves indentation for nested lists', () => {
      const result = renderMarkdown('  - nested item');
      expect(result).toContain('  ');
      expect(result).toContain('•');
    });
  });

  // ─── highlightCode ────────────────────────────────────────
  describe('highlightCode()', () => {
    it('returns empty string for empty line', () => {
      expect(highlightCode('', 'js')).toBe('');
    });

    it('dispatches to JS highlighter for js/ts/jsx/tsx', () => {
      for (const lang of ['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx']) {
        const result = highlightCode('const x = 1;', lang);
        expect(result).toContain(C.magenta); // keyword color
      }
    });

    it('dispatches to bash highlighter', () => {
      for (const lang of ['bash', 'sh', 'shell']) {
        const result = highlightCode('npm install --save', lang);
        expect(result).toContain(C.cyan); // flag color
      }
    });

    it('dispatches to JSON highlighter', () => {
      const result = highlightCode('"key": "value"', 'json');
      expect(result).toContain(C.cyan); // key color
    });

    it('returns plain text for unknown languages', () => {
      const result = highlightCode('some code', 'python');
      expect(result).toBe('some code');
    });

    it('uses JS highlighting when no lang specified', () => {
      const result = highlightCode('const x = 1;', '');
      expect(result).toContain(C.magenta);
    });
  });

  // ─── highlightJS ──────────────────────────────────────────
  describe('highlightJS()', () => {
    it('highlights keywords', () => {
      const result = highlightJS('const x = function() {}');
      expect(result).toContain(C.magenta);
    });

    it('highlights strings', () => {
      const result = highlightJS('const s = "hello"');
      expect(result).toContain(C.green);
    });

    it('highlights comments', () => {
      const result = highlightJS('// this is a comment');
      expect(result).toContain(C.dim);
    });

    it('highlights numbers', () => {
      const result = highlightJS('const n = 42');
      expect(result).toContain(C.yellow);
    });

    it('handles line with multiple elements', () => {
      const result = highlightJS('const arr = [1, 2, 3]; // array');
      expect(result).toContain(C.magenta); // const
      expect(result).toContain(C.dim); // comment
    });
  });

  // ─── highlightBash ────────────────────────────────────────
  describe('highlightBash()', () => {
    it('highlights commands', () => {
      const result = highlightBash('npm install');
      expect(result).toContain(C.green);
    });

    it('highlights flags', () => {
      const result = highlightBash('npm install --save-dev');
      expect(result).toContain(C.cyan);
    });

    it('highlights strings', () => {
      const result = highlightBash('echo "hello world"');
      expect(result).toContain(C.yellow);
    });

    it('highlights comments', () => {
      const result = highlightBash('# this is a comment');
      expect(result).toContain(C.dim);
    });
  });

  // ─── highlightJSON ────────────────────────────────────────
  describe('highlightJSON()', () => {
    it('highlights keys', () => {
      const result = highlightJSON('  "name": "test"');
      expect(result).toContain(C.cyan);
    });

    it('highlights string values', () => {
      const result = highlightJSON('  "name": "test"');
      expect(result).toContain(C.green);
    });

    it('highlights number values', () => {
      const result = highlightJSON('  "count": 42');
      expect(result).toContain(C.yellow);
    });

    it('highlights booleans and null', () => {
      const result = highlightJSON('  "active": true');
      expect(result).toContain(C.magenta);
    });
  });

  // ─── renderTable ──────────────────────────────────────────
  describe('renderTable()', () => {
    it('returns empty string for empty headers', () => {
      expect(renderTable([], [])).toBe('');
      expect(renderTable(null, [])).toBe('');
    });

    it('renders a table with headers and rows', () => {
      const result = renderTable(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]);
      expect(result).toContain('Name');
      expect(result).toContain('Age');
      expect(result).toContain('Alice');
      expect(result).toContain('30');
      expect(result).toContain('Bob');
      expect(result).toContain('25');
    });

    it('renders box-drawing characters', () => {
      const result = renderTable(['A'], [['1']]);
      expect(result).toContain('┌');
      expect(result).toContain('┐');
      expect(result).toContain('└');
      expect(result).toContain('┘');
      expect(result).toContain('─');
      expect(result).toContain('│');
    });

    it('aligns columns properly', () => {
      const result = renderTable(['Short', 'LongerHeader'], [['x', 'y']]);
      // Headers should be padded
      expect(result).toContain('Short');
      expect(result).toContain('LongerHeader');
    });

    it('handles missing row data gracefully', () => {
      const result = renderTable(['A', 'B'], [['only-a']]);
      expect(result).toContain('only-a');
      // Second column should still render (empty)
      expect(result).toContain('│');
    });

    it('renders separator between header and body', () => {
      const result = renderTable(['X'], [['1']]);
      expect(result).toContain('├');
      expect(result).toContain('┤');
    });
  });

  // ─── renderProgress ───────────────────────────────────────
  describe('renderProgress()', () => {
    it('renders 0% progress', () => {
      const result = renderProgress('Test', 0, 100);
      expect(result).toContain('0%');
      expect(result).toContain('0/100');
      expect(result).toContain('Test');
    });

    it('renders 50% progress', () => {
      const result = renderProgress('Build', 50, 100);
      expect(result).toContain('50%');
      expect(result).toContain('50/100');
      expect(result).toContain('█');
      expect(result).toContain('░');
    });

    it('renders 100% progress', () => {
      const result = renderProgress('Done', 10, 10);
      expect(result).toContain('100%');
      expect(result).toContain(C.green); // green at 100%
    });

    it('uses yellow for >50%', () => {
      const result = renderProgress('Mid', 70, 100);
      expect(result).toContain(C.yellow);
    });

    it('uses cyan for <=50%', () => {
      const result = renderProgress('Low', 30, 100);
      expect(result).toContain(C.cyan);
    });

    it('handles total of 0', () => {
      const result = renderProgress('Empty', 0, 0);
      expect(result).toContain('0%');
    });

    it('respects custom width', () => {
      const result = renderProgress('Custom', 5, 10, 10);
      expect(result).toContain('50%');
    });
  });

  // ─── highlightPython ────────────────────────────────────────
  describe('highlightPython()', () => {
    it('highlights keywords', () => {
      const result = highlightPython('def foo(self):');
      expect(result).toContain(C.magenta);
    });

    it('highlights strings', () => {
      const result = highlightPython('x = "hello"');
      expect(result).toContain(C.green);
    });

    it('highlights comments', () => {
      const result = highlightPython('# comment');
      expect(result).toContain(C.dim);
    });

    it('highlights numbers', () => {
      const result = highlightPython('x = 42');
      expect(result).toContain(C.yellow);
    });

    it('highlights decorators', () => {
      const result = highlightPython('@staticmethod');
      expect(result).toContain(C.cyan);
    });

    it('highlights None/True/False', () => {
      const result = highlightPython('return None');
      expect(result).toContain(C.magenta);
    });
  });

  // ─── highlightGo ───────────────────────────────────────────
  describe('highlightGo()', () => {
    it('highlights keywords', () => {
      const result = highlightGo('func main() {');
      expect(result).toContain(C.magenta);
    });

    it('highlights types', () => {
      const result = highlightGo('var x string');
      expect(result).toContain(C.cyan);
    });

    it('highlights strings', () => {
      const result = highlightGo('s := "hello"');
      expect(result).toContain(C.green);
    });

    it('highlights comments', () => {
      const result = highlightGo('// comment');
      expect(result).toContain(C.dim);
    });

    it('highlights numbers', () => {
      const result = highlightGo('x := 42');
      expect(result).toContain(C.yellow);
    });
  });

  // ─── highlightRust ─────────────────────────────────────────
  describe('highlightRust()', () => {
    it('highlights keywords', () => {
      const result = highlightRust('fn main() {');
      expect(result).toContain(C.magenta);
    });

    it('highlights types', () => {
      const result = highlightRust('let x: i32 = 5;');
      expect(result).toContain(C.cyan);
    });

    it('highlights strings', () => {
      const result = highlightRust('let s = "hello";');
      expect(result).toContain(C.green);
    });

    it('highlights comments', () => {
      const result = highlightRust('// comment');
      expect(result).toContain(C.dim);
    });

    it('highlights macros', () => {
      const result = highlightRust('println!("test")');
      expect(result).toContain(C.yellow);
    });

    it('highlights numbers', () => {
      const result = highlightRust('let x = 42;');
      expect(result).toContain(C.yellow);
    });
  });

  // ─── highlightCSS ──────────────────────────────────────────
  describe('highlightCSS()', () => {
    it('highlights properties', () => {
      const result = highlightCSS('  color: red;');
      expect(result).toContain(C.cyan);
    });

    it('highlights selectors', () => {
      const result = highlightCSS('.container {');
      expect(result).toContain(C.magenta);
    });

    it('highlights numbers with units', () => {
      const result = highlightCSS('  width: 100px;');
      expect(result).toContain(C.yellow);
    });

    it('highlights hex colors', () => {
      const result = highlightCSS('  color: #ff0000;');
      expect(result).toContain(C.yellow);
    });

    it('highlights comments', () => {
      const result = highlightCSS('/* comment */');
      expect(result).toContain(C.dim);
    });
  });

  // ─── highlightHTML ─────────────────────────────────────────
  describe('highlightHTML()', () => {
    it('highlights tags', () => {
      const result = highlightHTML('<div>');
      expect(result).toContain(C.magenta);
    });

    it('highlights attributes', () => {
      const result = highlightHTML('<div class="test">');
      expect(result).toContain(C.cyan);
    });

    it('highlights string values', () => {
      const result = highlightHTML('<a href="url">');
      expect(result).toContain(C.green);
    });

    it('highlights comments', () => {
      const result = highlightHTML('<!-- comment -->');
      expect(result).toContain(C.dim);
    });

    it('highlights entities', () => {
      const result = highlightHTML('&amp;');
      expect(result).toContain(C.yellow);
    });
  });

  // ─── highlightCode extended dispatch ───────────────────────
  describe('highlightCode() extended languages', () => {
    it('dispatches to Python highlighter', () => {
      for (const lang of ['python', 'py']) {
        const result = highlightCode('def foo():', lang);
        expect(result).toContain(C.magenta);
      }
    });

    it('dispatches to Go highlighter', () => {
      for (const lang of ['go', 'golang']) {
        const result = highlightCode('func main() {', lang);
        expect(result).toContain(C.magenta);
      }
    });

    it('dispatches to Rust highlighter', () => {
      for (const lang of ['rust', 'rs']) {
        const result = highlightCode('fn main() {', lang);
        expect(result).toContain(C.magenta);
      }
    });

    it('dispatches to CSS highlighter', () => {
      for (const lang of ['css', 'scss', 'less']) {
        const result = highlightCode('  color: red;', lang);
        expect(result).toContain(C.cyan);
      }
    });

    it('dispatches to HTML highlighter', () => {
      for (const lang of ['html', 'xml', 'svg', 'htm']) {
        const result = highlightCode('<div>', lang);
        expect(result).toContain(C.magenta);
      }
    });

    it('dispatches bash for zsh', () => {
      const result = highlightCode('npm install --save', 'zsh');
      expect(result).toContain(C.cyan);
    });

    it('dispatches JSON for jsonc', () => {
      const result = highlightCode('"key": "value"', 'jsonc');
      expect(result).toContain(C.cyan);
    });
  });

  // ─── StreamRenderer ────────────────────────────────────────
  describe('StreamRenderer', () => {
    let writeSpy;

    beforeEach(() => {
      writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it('renders complete lines immediately', () => {
      const sr = new StreamRenderer();
      sr.push('hello world\n');
      expect(writeSpy).toHaveBeenCalledWith('hello world\n');
    });

    it('buffers partial lines until newline', () => {
      const sr = new StreamRenderer();
      sr.push('hello');
      expect(writeSpy).not.toHaveBeenCalled();
      sr.push(' world\n');
      expect(writeSpy).toHaveBeenCalledWith('hello world\n');
    });

    it('flush() outputs remaining buffer', () => {
      const sr = new StreamRenderer();
      sr.push('partial');
      expect(writeSpy).not.toHaveBeenCalled();
      sr.flush();
      expect(writeSpy).toHaveBeenCalledWith('partial\n');
    });

    it('renders headers in stream', () => {
      const sr = new StreamRenderer();
      sr.push('# Title\n');
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain(C.bold);
      expect(output).toContain('Title');
    });

    it('renders code blocks with highlighting', () => {
      const sr = new StreamRenderer();
      sr.push('```js\n');
      sr.push('const x = 1;\n');
      sr.push('```\n');
      // First call: code block header
      expect(writeSpy.mock.calls[0][0]).toContain('─');
      expect(writeSpy.mock.calls[0][0]).toContain('js');
      // Second call: highlighted code
      expect(writeSpy.mock.calls[1][0]).toContain(C.magenta);
      // Third call: code block footer
      expect(writeSpy.mock.calls[2][0]).toContain('─');
    });

    it('renders lists in stream', () => {
      const sr = new StreamRenderer();
      sr.push('- item one\n');
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain('•');
      expect(output).toContain('item one');
    });

    it('renders numbered lists in stream', () => {
      const sr = new StreamRenderer();
      sr.push('1. first\n');
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain('1.');
      expect(output).toContain('first');
    });

    it('handles multiple lines in one push', () => {
      const sr = new StreamRenderer();
      sr.push('line one\nline two\nline three\n');
      expect(writeSpy).toHaveBeenCalledTimes(3);
    });

    it('flush closes unclosed code blocks', () => {
      const sr = new StreamRenderer();
      sr.push('```js\nconst x = 1;');
      sr.flush();
      // Should have rendered code block header + code + closing separator
      const allOutput = writeSpy.mock.calls.map(c => c[0]).join('');
      expect(allOutput).toContain('─');
    });

    it('handles empty push', () => {
      const sr = new StreamRenderer();
      sr.push('');
      sr.push(null);
      sr.push(undefined);
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  // ─── StreamCursor ─────────────────────────────────────────
  describe('StreamCursor', () => {
    let writeSpy, stderrSpy, origIsTTY;

    beforeEach(() => {
      origIsTTY = process.stderr.isTTY;
      process.stderr.isTTY = true;
      jest.useFakeTimers();
      writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
      stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.useRealTimers();
      writeSpy.mockRestore();
      stderrSpy.mockRestore();
      process.stderr.isTTY = origIsTTY;
    });

    it('startCursor hides terminal cursor and renders first bouncing ball frame', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      expect(sr._cursorActive).toBe(true);
      expect(sr._cursorTimer).not.toBeNull();
      // First write: hide terminal cursor (on stderr)
      expect(stderrSpy.mock.calls[0][0]).toBe('\x1b[?25l');
      // Second write: frame 0 (● in cyan)
      expect(stderrSpy.mock.calls[1][0]).toContain('●');
      expect(stderrSpy.mock.calls[1][0]).toContain('\x1b[36m');
      sr.stopCursor();
    });

    it('cursor advances bouncing ball frame on each interval tick', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      // calls[0] = hide cursor, calls[1] = first frame
      expect(stderrSpy.mock.calls[1][0]).toContain('●');
      // Advance one interval tick (100ms) — next frame should appear
      jest.advanceTimersByTime(100);
      expect(stderrSpy.mock.calls[2][0]).toContain('●');
      sr.stopCursor();
    });

    it('stopCursor shows terminal cursor again', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      stderrSpy.mockClear();
      sr.stopCursor();
      const all = stderrSpy.mock.calls.map(c => c[0]).join('');
      expect(all).toContain('\x1b[?25h'); // show cursor
    });

    it('push clears cursor line and reshows cursor after rendering', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      writeSpy.mockClear();
      stderrSpy.mockClear();

      sr.push('hello\n');
      // Cursor escapes go to stderr, content to stdout
      const stderrCalls = stderrSpy.mock.calls.map(c => c[0]);
      const stdoutCalls = writeSpy.mock.calls.map(c => c[0]);
      // First stderr call: clear cursor line (\x1b[2K\r)
      expect(stderrCalls[0]).toBe('\x1b[2K\r');
      // Content rendered on stdout
      expect(stdoutCalls.some(c => c.includes('hello'))).toBe(true);
      // Last stderr: cursor reappears (bouncing ball continues)
      const lastStderr = stderrCalls[stderrCalls.length - 1];
      expect(lastStderr).toContain('●');
      sr.stopCursor();
    });

    it('flush stops cursor', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      sr.push('partial');
      sr.flush();
      expect(sr._cursorActive).toBe(false);
      expect(sr._cursorTimer).toBeNull();
    });

    it('stopCursor is idempotent', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      sr.stopCursor();
      sr.stopCursor(); // second call should not throw
      expect(sr._cursorActive).toBe(false);
      expect(sr._cursorTimer).toBeNull();
    });

    it('stopCursor clears cursor line and shows terminal cursor', () => {
      const sr = new StreamRenderer();
      sr.startCursor();
      stderrSpy.mockClear();
      sr.stopCursor();
      const all = stderrSpy.mock.calls.map(c => c[0]).join('');
      expect(all).toContain('\x1b[2K\r');
      expect(all).toContain('\x1b[?25h');
    });

    it('push without active cursor does not write cursor escapes', () => {
      const sr = new StreamRenderer();
      sr.push('hello\n');
      const calls = writeSpy.mock.calls.map(c => c[0]);
      // Should only have the rendered line, no cursor escape sequences
      expect(calls).toEqual(['hello\n']);
    });
  });
});

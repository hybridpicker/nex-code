const {
  renderMarkdown,
  renderInline,
  highlightCode,
  highlightJS,
  highlightBash,
  highlightJSON,
  renderTable,
  renderProgress,
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
});

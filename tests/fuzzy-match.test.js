const { normalizeWhitespace, fuzzyFindText, findMostSimilar } = require('../cli/fuzzy-match');

describe('fuzzy-match.js', () => {
  // ─── normalizeWhitespace ────────────────────────────────────
  describe('normalizeWhitespace()', () => {
    it('converts tabs to 2 spaces', () => {
      expect(normalizeWhitespace('\tindented')).toBe('  indented');
      expect(normalizeWhitespace('\t\tdouble')).toBe('    double');
    });

    it('trims trailing whitespace per line', () => {
      expect(normalizeWhitespace('hello   \nworld  ')).toBe('hello\nworld');
    });

    it('collapses multiple inline spaces', () => {
      expect(normalizeWhitespace('hello    world')).toBe('hello world');
    });

    it('preserves leading indentation', () => {
      expect(normalizeWhitespace('    indented')).toBe('    indented');
    });

    it('normalizes CRLF to LF', () => {
      expect(normalizeWhitespace('line1\r\nline2\r\n')).toBe('line1\nline2\n');
    });

    it('normalizes CR to LF', () => {
      expect(normalizeWhitespace('line1\rline2')).toBe('line1\nline2');
    });

    it('handles empty string', () => {
      expect(normalizeWhitespace('')).toBe('');
    });

    it('handles mixed whitespace issues', () => {
      const input = '\thello    world  \r\n\t\tindented  ';
      const expected = '  hello world\n    indented';
      expect(normalizeWhitespace(input)).toBe(expected);
    });
  });

  // ─── fuzzyFindText ─────────────────────────────────────────
  describe('fuzzyFindText()', () => {
    it('returns needle on exact match', () => {
      const haystack = 'const x = 1;\nconst y = 2;';
      const needle = 'const x = 1;';
      expect(fuzzyFindText(haystack, needle)).toBe(needle);
    });

    it('matches tabs vs spaces', () => {
      const haystack = '\tconst x = 1;\n\tconst y = 2;';
      const needle = '  const x = 1;\n  const y = 2;';
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe('\tconst x = 1;\n\tconst y = 2;');
    });

    it('matches despite trailing whitespace', () => {
      const haystack = 'hello world   \nfoo bar   ';
      const needle = 'hello world\nfoo bar';
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe('hello world   \nfoo bar   ');
    });

    it('returns original text, not needle', () => {
      const haystack = '\treal\tcode';
      const needle = '  real  code';
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe('\treal\tcode');
    });

    it('handles multi-line matching', () => {
      const haystack = 'line1\n\tline2\n\tline3\nline4';
      const needle = '  line2\n  line3';
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe('\tline2\n\tline3');
    });

    it('handles CRLF in haystack with LF in needle', () => {
      const haystack = 'hello\r\nworld';
      const needle = 'hello\nworld';
      const result = fuzzyFindText(haystack, needle);
      // Exact match fails, but normalized match succeeds
      expect(result).not.toBeNull();
    });

    it('returns null when no match exists', () => {
      const haystack = 'const x = 1;';
      const needle = 'completely different text';
      expect(fuzzyFindText(haystack, needle)).toBeNull();
    });

    it('matches with collapsed inline spaces', () => {
      const haystack = 'const  x  =  1;';
      const needle = 'const x = 1;';
      const result = fuzzyFindText(haystack, needle);
      expect(result).not.toBeNull();
    });
  });

  // ─── findMostSimilar ───────────────────────────────────────
  describe('findMostSimilar()', () => {
    it('finds similar single-line text', () => {
      const content = 'const x = 1;\nconst y = 2;\nconst z = 3;';
      const target = 'const y = 3;'; // close to "const y = 2;"
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.text.trim()).toBe('const y = 2;');
    });

    it('returns correct line number', () => {
      const content = 'aaa\nbbb\nccc\nddd';
      const target = 'ccd'; // close to "ccc"
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.line).toBe(3);
    });

    it('returns null for very different text', () => {
      const content = 'const x = 1;';
      const target = 'this is completely and utterly different from anything in the file';
      expect(findMostSimilar(content, target)).toBeNull();
    });

    it('returns null for empty content', () => {
      expect(findMostSimilar('', 'target')).toBeNull();
    });

    it('returns null for empty target', () => {
      expect(findMostSimilar('content', '')).toBeNull();
    });

    it('returns null for null inputs', () => {
      expect(findMostSimilar(null, 'target')).toBeNull();
      expect(findMostSimilar('content', null)).toBeNull();
    });

    it('finds similar multi-line text', () => {
      const content = 'function foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}';
      const target = 'function bar() {\n  return 3;\n}'; // close to bar block
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.text).toContain('function bar');
    });

    it('includes distance in result', () => {
      const content = 'hello world';
      const target = 'hello worl'; // 1 char different
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.distance).toBe(1);
    });
  });
});

const {
  normalizeWhitespace,
  fuzzyFindText,
  findMostSimilar,
} = require("../cli/fuzzy-match");

describe("fuzzy-match.js", () => {
  // ─── normalizeWhitespace ────────────────────────────────────
  describe("normalizeWhitespace()", () => {
    it("converts tabs to 2 spaces", () => {
      expect(normalizeWhitespace("\tindented")).toBe("  indented");
      expect(normalizeWhitespace("\t\tdouble")).toBe("    double");
    });

    it("trims trailing whitespace per line", () => {
      expect(normalizeWhitespace("hello   \nworld  ")).toBe("hello\nworld");
    });

    it("collapses multiple inline spaces", () => {
      expect(normalizeWhitespace("hello    world")).toBe("hello world");
    });

    it("preserves leading indentation", () => {
      expect(normalizeWhitespace("    indented")).toBe("    indented");
    });

    it("normalizes CRLF to LF", () => {
      expect(normalizeWhitespace("line1\r\nline2\r\n")).toBe("line1\nline2\n");
    });

    it("normalizes CR to LF", () => {
      expect(normalizeWhitespace("line1\rline2")).toBe("line1\nline2");
    });

    it("handles empty string", () => {
      expect(normalizeWhitespace("")).toBe("");
    });

    it("handles mixed whitespace issues", () => {
      const input = "\thello    world  \r\n\t\tindented  ";
      const expected = "  hello world\n    indented";
      expect(normalizeWhitespace(input)).toBe(expected);
    });
  });

  // ─── fuzzyFindText ─────────────────────────────────────────
  describe("fuzzyFindText()", () => {
    it("returns needle on exact match", () => {
      const haystack = "const x = 1;\nconst y = 2;";
      const needle = "const x = 1;";
      expect(fuzzyFindText(haystack, needle)).toBe(needle);
    });

    it("matches tabs vs spaces", () => {
      const haystack = "\tconst x = 1;\n\tconst y = 2;";
      const needle = "  const x = 1;\n  const y = 2;";
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe("\tconst x = 1;\n\tconst y = 2;");
    });

    it("matches despite trailing whitespace", () => {
      const haystack = "hello world   \nfoo bar   ";
      const needle = "hello world\nfoo bar";
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe("hello world   \nfoo bar   ");
    });

    it("returns original text, not needle", () => {
      const haystack = "\treal\tcode";
      const needle = "  real  code";
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe("\treal\tcode");
    });

    it("handles multi-line matching", () => {
      const haystack = "line1\n\tline2\n\tline3\nline4";
      const needle = "  line2\n  line3";
      const result = fuzzyFindText(haystack, needle);
      expect(result).toBe("\tline2\n\tline3");
    });

    it("handles CRLF in haystack with LF in needle", () => {
      const haystack = "hello\r\nworld";
      const needle = "hello\nworld";
      const result = fuzzyFindText(haystack, needle);
      // Exact match fails, but normalized match succeeds
      expect(result).not.toBeNull();
    });

    it("returns null when no match exists", () => {
      const haystack = "const x = 1;";
      const needle = "completely different text";
      expect(fuzzyFindText(haystack, needle)).toBeNull();
    });

    it("matches with collapsed inline spaces", () => {
      const haystack = "const  x  =  1;";
      const needle = "const x = 1;";
      const result = fuzzyFindText(haystack, needle);
      expect(result).not.toBeNull();
    });
  });

  // ─── findMostSimilar ───────────────────────────────────────
  describe("findMostSimilar()", () => {
    it("finds similar single-line text", () => {
      const content = "const x = 1;\nconst y = 2;\nconst z = 3;";
      const target = "const y = 3;"; // close to "const y = 2;"
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.text.trim()).toBe("const y = 2;");
    });

    it("returns correct line number", () => {
      const content = "aaa\nbbb\nccc\nddd";
      const target = "ccd"; // close to "ccc"
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.line).toBe(3);
    });

    it("returns null for very different text", () => {
      const content = "const x = 1;";
      const target =
        "this is completely and utterly different from anything in the file";
      expect(findMostSimilar(content, target)).toBeNull();
    });

    it("returns null for empty content", () => {
      expect(findMostSimilar("", "target")).toBeNull();
    });

    it("returns null for empty target", () => {
      expect(findMostSimilar("content", "")).toBeNull();
    });

    it("returns null for null inputs", () => {
      expect(findMostSimilar(null, "target")).toBeNull();
      expect(findMostSimilar("content", null)).toBeNull();
    });

    it("finds similar multi-line text", () => {
      const content =
        "function foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}";
      const target = "function bar() {\n  return 3;\n}"; // close to bar block
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.text).toContain("function bar");
    });

    it("includes distance in result", () => {
      const content = "hello world";
      const target = "hello worl"; // 1 char different
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.distance).toBe(1);
    });

    it("single-line refinement finds target skipped by sampling step", () => {
      // 501 lines → step=2. Target at odd index 251 is skipped by sampling.
      // Nearby sampled lines (250, 252) score best → refinement around them finds 251.
      const lines = Array.from(
        { length: 501 },
        (_, i) => `row_${String(i).padStart(3, "0")}_data`,
      );
      lines[251] = "row_251_datX";
      const content = lines.join("\n");
      const result = findMostSimilar(content, "row_251_datX");
      expect(result).not.toBeNull();
      expect(result.text.trim()).toBe("row_251_datX");
      expect(result.distance).toBe(0);
    });

    it("multi-line refinement finds target skipped by sampling step", () => {
      // 501 lines, 2-line target at odd position 251. step=2 skips it.
      // Nearby windows (250, 252) score best → refinement finds exact match at 251.
      const lines = Array.from(
        { length: 501 },
        (_, i) => `row_${String(i).padStart(3, "0")}_data`,
      );
      lines[251] = "row_251_datX";
      lines[252] = "row_252_datX";
      const content = lines.join("\n");
      const target = "row_251_datX\nrow_252_datX";
      const result = findMostSimilar(content, target);
      expect(result).not.toBeNull();
      expect(result.text).toContain("row_251_datX");
      expect(result.text).toContain("row_252_datX");
      expect(result.distance).toBe(0);
    });
  });

  // ─── fuzzyFindText: single-line fallback ────────────────────
  describe("fuzzyFindText() single-line fallback", () => {
    it("finds needle as substring of a normalized line via indexOf fallback", () => {
      // Needle with different whitespace is a substring of (not equal to) a normalized haystack line.
      // The exact match fails, the line-equality loop fails (needle is shorter than line),
      // so it falls through to the indexOf fallback at lines 78-87.
      const haystack = "  prefix  const  x  =  1  suffix  ";
      const needle = "prefix const x = 1 suffix";
      // Exact match fails (whitespace differs). Normalized haystack line =
      // "  prefix const x = 1 suffix" which contains normalized needle "prefix const x = 1 suffix"
      // but is NOT equal to it (leading spaces). → indexOf fallback triggers.
      const result = fuzzyFindText(haystack, needle);
      expect(result).not.toBeNull();
      // Returns the full original line
      expect(result).toBe("  prefix  const  x  =  1  suffix  ");
    });

    it("returns full line when needle matches a substring with different whitespace", () => {
      // Tabs in haystack, needle without tabs — only matches after normalization as substring
      const haystack = "\tprefix\tconst  x  =  1\tsuffix\nother line";
      const needle = "prefix const x = 1 suffix";
      const result = fuzzyFindText(haystack, needle);
      expect(result).not.toBeNull();
    });
  });
});

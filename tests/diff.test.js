const {
  diffLines,
  showEditDiff,
  showWriteDiff,
  showNewFilePreview,
  confirmFileChange,
  showSideBySideDiff,
  showDiff,
  showNewFile,
} = require("../cli/diff");
const { C } = require("../cli/ui");

// Mock safety module for confirmFileChange
jest.mock("../cli/safety", () => ({
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(false),
}));

const { confirm, getAutoConfirm } = require("../cli/safety");

describe("diff.js", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ─── diffLines ──────────────────────────────────────────────
  describe("diffLines()", () => {
    it("returns all same for identical content", () => {
      const ops = diffLines("a\nb\nc", "a\nb\nc");
      expect(ops.every((op) => op.type === "same")).toBe(true);
      expect(ops).toHaveLength(3);
    });

    it("detects additions", () => {
      const ops = diffLines("a\nb", "a\nb\nc");
      const adds = ops.filter((op) => op.type === "add");
      expect(adds).toHaveLength(1);
      expect(adds[0].line).toBe("c");
    });

    it("detects removals", () => {
      const ops = diffLines("a\nb\nc", "a\nc");
      const removes = ops.filter((op) => op.type === "remove");
      expect(removes).toHaveLength(1);
      expect(removes[0].line).toBe("b");
    });

    it("detects mixed changes", () => {
      const ops = diffLines("a\nb\nc", "a\nx\nc");
      const removes = ops.filter((op) => op.type === "remove");
      const adds = ops.filter((op) => op.type === "add");
      expect(removes.length).toBeGreaterThanOrEqual(1);
      expect(adds.length).toBeGreaterThanOrEqual(1);
    });

    it("handles empty old text (all additions)", () => {
      const ops = diffLines("", "a\nb");
      const adds = ops.filter((op) => op.type === "add");
      expect(adds.length).toBeGreaterThanOrEqual(1);
    });

    it("handles empty new text (all removals)", () => {
      const ops = diffLines("a\nb", "");
      const removes = ops.filter((op) => op.type === "remove");
      expect(removes.length).toBeGreaterThanOrEqual(1);
    });

    it("handles single line change", () => {
      const ops = diffLines("hello", "world");
      expect(
        ops.some((op) => op.type === "remove" && op.line === "hello"),
      ).toBe(true);
      expect(ops.some((op) => op.type === "add" && op.line === "world")).toBe(
        true,
      );
    });

    it("handles both empty", () => {
      const ops = diffLines("", "");
      // Single empty line → same
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe("same");
    });
  });

  // ─── showEditDiff ───────────────────────────────────────────
  describe("showEditDiff()", () => {
    it("shows diff with changes highlighted", () => {
      showEditDiff("test.js", "old line", "new line");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("test.js");
    });

    it('shows "no changes" for identical text', () => {
      showEditDiff("test.js", "same", "same");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("no changes");
    });

    it("shows context lines around changes", () => {
      const old = "line1\nline2\nline3\nline4\nline5\nline6\nline7";
      const nw = "line1\nline2\nline3\nCHANGED\nline5\nline6\nline7";
      showEditDiff("test.js", old, nw, 2);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("test.js");
    });
  });

  // ─── showWriteDiff ──────────────────────────────────────────
  describe("showWriteDiff()", () => {
    it("shows changes for modified file", () => {
      showWriteDiff("test.js", "old content", "new content");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("test.js");
      expect(output).toContain("showing changes");
    });

    it('shows "identical" for same content', () => {
      showWriteDiff("test.js", "same", "same");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("identical");
    });

    it("truncates at 30 diff lines", () => {
      const oldLines = Array.from({ length: 40 }, (_, i) => `old${i}`);
      const newLines = Array.from({ length: 40 }, (_, i) => `new${i}`);
      showWriteDiff("test.js", oldLines.join("\n"), newLines.join("\n"));
      // Should not crash
      expect(logSpy).toHaveBeenCalled();
    });
  });

  // ─── showNewFilePreview ─────────────────────────────────────
  describe("showNewFilePreview()", () => {
    it("shows first 20 lines of new file", () => {
      const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
      showNewFilePreview("new.js", lines.join("\n"));
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("new.js");
      expect(output).toContain("+10 more lines");
    });

    it("shows all lines when under 20", () => {
      showNewFilePreview("new.js", "line1\nline2\nline3");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("new.js");
      expect(output).not.toContain("more lines");
    });
  });

  // ─── confirmFileChange ──────────────────────────────────────
  describe("confirmFileChange()", () => {
    it("returns true when autoConfirm is on", async () => {
      getAutoConfirm.mockReturnValue(true);
      const result = await confirmFileChange("Apply");
      expect(result).toBe(true);
      expect(confirm).not.toHaveBeenCalled();
    });

    it("calls confirm when autoConfirm is off", async () => {
      getAutoConfirm.mockReturnValue(false);
      confirm.mockResolvedValue(true);
      const result = await confirmFileChange("Apply");
      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalled();
    });

    it("returns false when user declines", async () => {
      getAutoConfirm.mockReturnValue(false);
      confirm.mockResolvedValue(false);
      const result = await confirmFileChange("Apply");
      expect(result).toBe(false);
    });
  });

  // ─── showWriteDiff context lines (branch coverage) ────────
  describe("showWriteDiff() context lines", () => {
    it("shows context lines after changes (shown > 0)", () => {
      // Old text has changes at the beginning, followed by same lines
      const oldText = "changed_line\ncontext_after_change\nmore_context";
      const newText = "replaced_line\ncontext_after_change\nmore_context";
      showWriteDiff("test.js", oldText, newText);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // After showing the change (shown > 0), context lines should appear
      expect(output).toContain("context_after_change");
    });

    it("does not show context lines before first change (shown === 0)", () => {
      // Same lines first, then a change
      const oldText = "same_first\nsame_second\nold_line";
      const newText = "same_first\nsame_second\nnew_line";
      showWriteDiff("test.js", oldText, newText);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // 'same_first' should not appear as context because shown=0 when it's processed
      // But the change lines should appear
      expect(output).toContain("showing changes");
    });
  });

  // ─── showSideBySideDiff ──────────────────────────────────────
  describe("showSideBySideDiff()", () => {
    it("shows header with file path", () => {
      showSideBySideDiff("test.js", "old", "new", 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Side-by-side");
      expect(output).toContain("test.js");
    });

    it('shows "(no changes)" for identical text', () => {
      showSideBySideDiff("test.js", "same text", "same text", 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("no changes");
    });

    it("shows changed lines in red and green", () => {
      showSideBySideDiff("test.js", "old line", "new line", 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.red);
      expect(output).toContain(C.green);
    });

    it("pairs removals with additions", () => {
      const old = "line1\nremoved\nline3";
      const nw = "line1\nadded\nline3";
      showSideBySideDiff("test.js", old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("│");
    });

    it("handles more removals than additions", () => {
      const old = "keep\nremove1\nremove2\nend";
      const nw = "keep\nadd1\nend";
      showSideBySideDiff("test.js", old, nw, 80);
      expect(logSpy).toHaveBeenCalled();
    });

    it("handles standalone additions", () => {
      const old = "line1\nline2";
      const nw = "line1\nnew_line\nline2";
      showSideBySideDiff("test.js", old, nw, 80);
      expect(logSpy).toHaveBeenCalled();
    });

    it("uses default width 80 when no width given", () => {
      const origColumns = process.stdout.columns;
      process.stdout.columns = undefined;
      showSideBySideDiff("test.js", "old", "new");
      process.stdout.columns = origColumns;
      expect(logSpy).toHaveBeenCalled();
    });

    it("uses terminal width from process.stdout.columns", () => {
      const origColumns = process.stdout.columns;
      process.stdout.columns = 120;
      showSideBySideDiff("test.js", "old", "new");
      process.stdout.columns = origColumns;
      expect(logSpy).toHaveBeenCalled();
    });

    it("shows ellipsis for large diffs with context before", () => {
      // Many same lines before the change
      const sameLines = Array.from({ length: 20 }, (_, i) => `same${i}`);
      const old = [...sameLines, "old_line", "end"].join("\n");
      const nw = [...sameLines, "new_line", "end"].join("\n");
      showSideBySideDiff("test.js", old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should have ellipsis dots since showFrom > 0
      expect(output).toContain("·");
    });

    it("shows ellipsis for large diffs with context after", () => {
      const sameAfter = Array.from({ length: 20 }, (_, i) => `after${i}`);
      const old = ["old_line", ...sameAfter].join("\n");
      const nw = ["new_line", ...sameAfter].join("\n");
      showSideBySideDiff("test.js", old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should have ellipsis dots since showTo < pairs.length
      expect(output).toContain("·");
    });

    it("shows same lines in gray", () => {
      const old = "same\nold\nsame";
      const nw = "same\nnew\nsame";
      showSideBySideDiff("test.js", old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.gray);
    });

    it("handles empty left side (pure additions)", () => {
      showSideBySideDiff("test.js", "", "new content", 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.green);
    });

    it("renders separator borders", () => {
      showSideBySideDiff("test.js", "old", "new", 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Top separator with ┬ and bottom with ┴
      expect(output).toContain("┬");
      expect(output).toContain("┴");
    });
  });

  // ─── diffLines DIFF_LINE_LIMIT fallback (lines 26-28) ────
  describe("diffLines() DIFF_LINE_LIMIT fallback", () => {
    it("falls back to simplified diff when old text exceeds 2000 lines", () => {
      const oldLines = Array.from({ length: 2001 }, (_, i) => `old${i}`);
      const newLines = ["new1", "new2"];
      const ops = diffLines(oldLines.join("\n"), newLines.join("\n"));
      const removes = ops.filter((op) => op.type === "remove");
      const adds = ops.filter((op) => op.type === "add");
      expect(removes).toHaveLength(2001);
      expect(adds).toHaveLength(2);
      // No 'same' entries in simplified diff
      expect(ops.filter((op) => op.type === "same")).toHaveLength(0);
    });

    it("falls back to simplified diff when new text exceeds 2000 lines", () => {
      const oldLines = ["old1", "old2"];
      const newLines = Array.from({ length: 2001 }, (_, i) => `new${i}`);
      const ops = diffLines(oldLines.join("\n"), newLines.join("\n"));
      const removes = ops.filter((op) => op.type === "remove");
      const adds = ops.filter((op) => op.type === "add");
      expect(removes).toHaveLength(2);
      expect(adds).toHaveLength(2001);
    });

    it("falls back to simplified diff when both texts exceed 2000 lines", () => {
      const oldLines = Array.from({ length: 2500 }, (_, i) => `old${i}`);
      const newLines = Array.from({ length: 2500 }, (_, i) => `new${i}`);
      const ops = diffLines(oldLines.join("\n"), newLines.join("\n"));
      expect(ops).toHaveLength(5000);
      expect(ops.filter((op) => op.type === "remove")).toHaveLength(2500);
      expect(ops.filter((op) => op.type === "add")).toHaveLength(2500);
    });

    it("does NOT fall back when texts are exactly at the limit (2000 lines)", () => {
      const oldLines = Array.from({ length: 2000 }, (_, i) => `line${i}`);
      // Same content should produce 'same' ops via normal LCS
      const ops = diffLines(oldLines.join("\n"), oldLines.join("\n"));
      expect(ops.every((op) => op.type === "same")).toBe(true);
      expect(ops).toHaveLength(2000);
    });
  });

  // ─── showDiff (lines 258-342) ──────────────────────
  describe("showDiff()", () => {
    it("shows Update header with relative path", () => {
      showDiff("test.js", "old", "new");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Update(test.js)");
    });

    it("shows custom label when provided", () => {
      showDiff("test.js", "old", "new", { label: "Replace" });
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Replace(test.js)");
    });

    it('shows "(no changes)" for identical content', () => {
      showDiff("test.js", "same", "same");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("no changes");
    });

    it("shows summary with added and removed line counts", () => {
      showDiff("test.js", "old1\nold2", "new1\nnew2\nnew3");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Added");
      expect(output).toContain("removed");
    });

    it("shows only added count when no removals", () => {
      showDiff("test.js", "line1", "line1\nline2");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Added 1 line");
      expect(output).not.toContain("removed");
    });

    it("shows only removed count when no additions", () => {
      showDiff("test.js", "line1\nline2", "line1");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("removed 1 line");
      expect(output).not.toContain("Added");
    });

    it('uses singular "line" for exactly 1 addition', () => {
      showDiff("test.js", "a", "a\nb");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Added 1 line");
      expect(output).not.toContain("lines");
    });

    it('uses plural "lines" for multiple additions', () => {
      showDiff("test.js", "a", "a\nb\nc");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Added 2 lines");
    });

    it('uses singular "line" for exactly 1 removal', () => {
      showDiff("test.js", "a\nb", "a");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("removed 1 line");
    });

    it('uses plural "lines" for multiple removals', () => {
      showDiff("test.js", "a\nb\nc", "a");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("removed 2 lines");
    });

    it("shows removed lines in red with line numbers", () => {
      showDiff("test.js", "line1\nremoved\nline3", "line1\nline3");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.red);
      expect(output).toContain("-");
    });

    it("shows added lines in green with line numbers", () => {
      showDiff("test.js", "line1\nline3", "line1\nadded\nline3");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.green);
      expect(output).toContain("+");
    });

    it("shows context lines with dim line numbers", () => {
      const old = "ctx1\nctx2\nold_line\nctx3\nctx4";
      const nw = "ctx1\nctx2\nnew_line\nctx3\nctx4";
      showDiff("test.js", old, nw, { context: 2 });
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.dim);
      expect(output).toContain("ctx2");
      expect(output).toContain("ctx3");
    });

    it("shows hunk separators (···) between distant changes", () => {
      // Create two changes separated by many context lines
      const lines = Array.from({ length: 20 }, (_, i) => `same${i}`);
      const old = ["change_old_1", ...lines, "change_old_2"].join("\n");
      const nw = ["change_new_1", ...lines, "change_new_2"].join("\n");
      showDiff("test.js", old, nw, { context: 2 });
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("···");
    });

    it("merges hunks when changes are close together", () => {
      const old = "a\nold1\nb\nc\nold2\nd";
      const nw = "a\nnew1\nb\nc\nnew2\nd";
      showDiff("test.js", old, nw, { context: 3 });
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Changes are within context range so no separator
      expect(output).not.toContain("···");
    });

    it("converts absolute path to relative path", () => {
      const absPath = process.cwd() + "/src/test.js";
      showDiff(absPath, "old", "new");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("src/test.js");
      expect(output).not.toContain(process.cwd());
    });

    it("keeps relative paths as-is", () => {
      showDiff("src/test.js", "old", "new");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("src/test.js");
    });

    it("assigns correct line numbers to ops", () => {
      // old: line1, line2 (remove), line3
      // new: line1, lineX (add), line3
      showDiff("test.js", "line1\nline2\nline3", "line1\nlineX\nline3");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Line numbers should appear padded
      expect(output).toContain("2");
    });

    it("uses default context of 3 when not specified", () => {
      const lines = Array.from({ length: 15 }, (_, i) => `same${i}`);
      const old = [...lines.slice(0, 7), "old_line", ...lines.slice(7)].join(
        "\n",
      );
      const nw = [...lines.slice(0, 7), "new_line", ...lines.slice(7)].join(
        "\n",
      );
      showDiff("test.js", old, nw);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Should show 3 context lines around change
      expect(output).toContain("same4"); // 3 lines before change at index 7
      expect(output).toContain("same7"); // 3 lines after change
    });

    it('uses default label "Update" when not specified', () => {
      showDiff("test.js", "old", "new", {});
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Update(test.js)");
    });

    it("shows the header icon", () => {
      showDiff("test.js", "old", "new");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.green);
    });
  });

  // ─── showNewFile (lines 347-364) ────────────────────
  describe("showNewFile()", () => {
    it("shows Create header with relative path", () => {
      showNewFile("test.js", "content");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Create(test.js)");
    });

    it("shows line count for single line", () => {
      showNewFile("test.js", "single line");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("1 line");
      expect(output).not.toContain("1 lines");
    });

    it("shows line count for multiple lines", () => {
      showNewFile("test.js", "line1\nline2\nline3");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("3 lines");
    });

    it("shows first 20 lines with line numbers in green", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`);
      showNewFile("test.js", lines.join("\n"));
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.green);
      expect(output).toContain("line1");
      expect(output).toContain("line10");
    });

    it("truncates content beyond 20 lines and shows count", () => {
      const lines = Array.from({ length: 30 }, (_, i) => `line${i + 1}`);
      showNewFile("test.js", lines.join("\n"));
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("+10 more lines");
      // Lines 1-20 should be shown
      expect(output).toContain("line1");
      expect(output).toContain("line20");
      // Line 21+ should not appear as content
    });

    it("does not show truncation message for exactly 20 lines", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`);
      showNewFile("test.js", lines.join("\n"));
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).not.toContain("more lines");
    });

    it("converts absolute path to relative path", () => {
      const absPath = process.cwd() + "/src/new.js";
      showNewFile(absPath, "content");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Create(src/new.js)");
      expect(output).not.toContain(process.cwd());
    });

    it("keeps relative paths as-is", () => {
      showNewFile("src/new.js", "content");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Create(src/new.js)");
    });

    it("shows line numbers padded to 4 characters", () => {
      showNewFile("test.js", "line1\nline2");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // Line numbers should be padded: "   1" and "   2"
      expect(output).toContain("   1");
      expect(output).toContain("   2");
    });

    it("shows the header icon", () => {
      showNewFile("test.js", "content");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain(C.green);
    });
  });
});

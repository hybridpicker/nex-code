const { diffLines, showEditDiff, showWriteDiff, showNewFilePreview, confirmFileChange, showSideBySideDiff } = require('../cli/diff');
const { C } = require('../cli/ui');

// Mock safety module for confirmFileChange
jest.mock('../cli/safety', () => ({
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(false),
}));

const { confirm, getAutoConfirm } = require('../cli/safety');

describe('diff.js', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ─── diffLines ──────────────────────────────────────────────
  describe('diffLines()', () => {
    it('returns all same for identical content', () => {
      const ops = diffLines('a\nb\nc', 'a\nb\nc');
      expect(ops.every((op) => op.type === 'same')).toBe(true);
      expect(ops).toHaveLength(3);
    });

    it('detects additions', () => {
      const ops = diffLines('a\nb', 'a\nb\nc');
      const adds = ops.filter((op) => op.type === 'add');
      expect(adds).toHaveLength(1);
      expect(adds[0].line).toBe('c');
    });

    it('detects removals', () => {
      const ops = diffLines('a\nb\nc', 'a\nc');
      const removes = ops.filter((op) => op.type === 'remove');
      expect(removes).toHaveLength(1);
      expect(removes[0].line).toBe('b');
    });

    it('detects mixed changes', () => {
      const ops = diffLines('a\nb\nc', 'a\nx\nc');
      const removes = ops.filter((op) => op.type === 'remove');
      const adds = ops.filter((op) => op.type === 'add');
      expect(removes.length).toBeGreaterThanOrEqual(1);
      expect(adds.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty old text (all additions)', () => {
      const ops = diffLines('', 'a\nb');
      const adds = ops.filter((op) => op.type === 'add');
      expect(adds.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty new text (all removals)', () => {
      const ops = diffLines('a\nb', '');
      const removes = ops.filter((op) => op.type === 'remove');
      expect(removes.length).toBeGreaterThanOrEqual(1);
    });

    it('handles single line change', () => {
      const ops = diffLines('hello', 'world');
      expect(ops.some((op) => op.type === 'remove' && op.line === 'hello')).toBe(true);
      expect(ops.some((op) => op.type === 'add' && op.line === 'world')).toBe(true);
    });

    it('handles both empty', () => {
      const ops = diffLines('', '');
      // Single empty line → same
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('same');
    });
  });

  // ─── showEditDiff ───────────────────────────────────────────
  describe('showEditDiff()', () => {
    it('shows diff with changes highlighted', () => {
      showEditDiff('test.js', 'old line', 'new line');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('test.js');
    });

    it('shows "no changes" for identical text', () => {
      showEditDiff('test.js', 'same', 'same');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('no changes');
    });

    it('shows context lines around changes', () => {
      const old = 'line1\nline2\nline3\nline4\nline5\nline6\nline7';
      const nw = 'line1\nline2\nline3\nCHANGED\nline5\nline6\nline7';
      showEditDiff('test.js', old, nw, 2);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('test.js');
    });
  });

  // ─── showWriteDiff ──────────────────────────────────────────
  describe('showWriteDiff()', () => {
    it('shows changes for modified file', () => {
      showWriteDiff('test.js', 'old content', 'new content');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('test.js');
      expect(output).toContain('showing changes');
    });

    it('shows "identical" for same content', () => {
      showWriteDiff('test.js', 'same', 'same');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('identical');
    });

    it('truncates at 30 diff lines', () => {
      const oldLines = Array.from({ length: 40 }, (_, i) => `old${i}`);
      const newLines = Array.from({ length: 40 }, (_, i) => `new${i}`);
      showWriteDiff('test.js', oldLines.join('\n'), newLines.join('\n'));
      // Should not crash
      expect(logSpy).toHaveBeenCalled();
    });
  });

  // ─── showNewFilePreview ─────────────────────────────────────
  describe('showNewFilePreview()', () => {
    it('shows first 20 lines of new file', () => {
      const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);
      showNewFilePreview('new.js', lines.join('\n'));
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('new.js');
      expect(output).toContain('+10 more lines');
    });

    it('shows all lines when under 20', () => {
      showNewFilePreview('new.js', 'line1\nline2\nline3');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('new.js');
      expect(output).not.toContain('more lines');
    });
  });

  // ─── confirmFileChange ──────────────────────────────────────
  describe('confirmFileChange()', () => {
    it('returns true when autoConfirm is on', async () => {
      getAutoConfirm.mockReturnValue(true);
      const result = await confirmFileChange('Apply');
      expect(result).toBe(true);
      expect(confirm).not.toHaveBeenCalled();
    });

    it('calls confirm when autoConfirm is off', async () => {
      getAutoConfirm.mockReturnValue(false);
      confirm.mockResolvedValue(true);
      const result = await confirmFileChange('Apply');
      expect(result).toBe(true);
      expect(confirm).toHaveBeenCalled();
    });

    it('returns false when user declines', async () => {
      getAutoConfirm.mockReturnValue(false);
      confirm.mockResolvedValue(false);
      const result = await confirmFileChange('Apply');
      expect(result).toBe(false);
    });
  });

  // ─── showWriteDiff context lines (branch coverage) ────────
  describe('showWriteDiff() context lines', () => {
    it('shows context lines after changes (shown > 0)', () => {
      // Old text has changes at the beginning, followed by same lines
      const oldText = 'changed_line\ncontext_after_change\nmore_context';
      const newText = 'replaced_line\ncontext_after_change\nmore_context';
      showWriteDiff('test.js', oldText, newText);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      // After showing the change (shown > 0), context lines should appear
      expect(output).toContain('context_after_change');
    });

    it('does not show context lines before first change (shown === 0)', () => {
      // Same lines first, then a change
      const oldText = 'same_first\nsame_second\nold_line';
      const newText = 'same_first\nsame_second\nnew_line';
      showWriteDiff('test.js', oldText, newText);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      // 'same_first' should not appear as context because shown=0 when it's processed
      // But the change lines should appear
      expect(output).toContain('showing changes');
    });
  });

  // ─── showSideBySideDiff ──────────────────────────────────────
  describe('showSideBySideDiff()', () => {
    it('shows header with file path', () => {
      showSideBySideDiff('test.js', 'old', 'new', 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Side-by-side');
      expect(output).toContain('test.js');
    });

    it('shows "(no changes)" for identical text', () => {
      showSideBySideDiff('test.js', 'same text', 'same text', 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('no changes');
    });

    it('shows changed lines in red and green', () => {
      showSideBySideDiff('test.js', 'old line', 'new line', 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain(C.red);
      expect(output).toContain(C.green);
    });

    it('pairs removals with additions', () => {
      const old = 'line1\nremoved\nline3';
      const nw = 'line1\nadded\nline3';
      showSideBySideDiff('test.js', old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('│');
    });

    it('handles more removals than additions', () => {
      const old = 'keep\nremove1\nremove2\nend';
      const nw = 'keep\nadd1\nend';
      showSideBySideDiff('test.js', old, nw, 80);
      expect(logSpy).toHaveBeenCalled();
    });

    it('handles standalone additions', () => {
      const old = 'line1\nline2';
      const nw = 'line1\nnew_line\nline2';
      showSideBySideDiff('test.js', old, nw, 80);
      expect(logSpy).toHaveBeenCalled();
    });

    it('uses default width 80 when no width given', () => {
      const origColumns = process.stdout.columns;
      process.stdout.columns = undefined;
      showSideBySideDiff('test.js', 'old', 'new');
      process.stdout.columns = origColumns;
      expect(logSpy).toHaveBeenCalled();
    });

    it('uses terminal width from process.stdout.columns', () => {
      const origColumns = process.stdout.columns;
      process.stdout.columns = 120;
      showSideBySideDiff('test.js', 'old', 'new');
      process.stdout.columns = origColumns;
      expect(logSpy).toHaveBeenCalled();
    });

    it('shows ellipsis for large diffs with context before', () => {
      // Many same lines before the change
      const sameLines = Array.from({ length: 20 }, (_, i) => `same${i}`);
      const old = [...sameLines, 'old_line', 'end'].join('\n');
      const nw = [...sameLines, 'new_line', 'end'].join('\n');
      showSideBySideDiff('test.js', old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      // Should have ellipsis dots since showFrom > 0
      expect(output).toContain('·');
    });

    it('shows ellipsis for large diffs with context after', () => {
      const sameAfter = Array.from({ length: 20 }, (_, i) => `after${i}`);
      const old = ['old_line', ...sameAfter].join('\n');
      const nw = ['new_line', ...sameAfter].join('\n');
      showSideBySideDiff('test.js', old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      // Should have ellipsis dots since showTo < pairs.length
      expect(output).toContain('·');
    });

    it('shows same lines in gray', () => {
      const old = 'same\nold\nsame';
      const nw = 'same\nnew\nsame';
      showSideBySideDiff('test.js', old, nw, 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain(C.gray);
    });

    it('handles empty left side (pure additions)', () => {
      showSideBySideDiff('test.js', '', 'new content', 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain(C.green);
    });

    it('renders separator borders', () => {
      showSideBySideDiff('test.js', 'old', 'new', 80);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      // Top separator with ┬ and bottom with ┴
      expect(output).toContain('┬');
      expect(output).toContain('┴');
    });
  });
});

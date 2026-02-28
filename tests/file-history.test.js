const fs = require('fs');
const path = require('path');
const os = require('os');

const { recordChange, undo, redo, getHistory, getUndoCount, getRedoCount, clearHistory } = require('../cli/file-history');

describe('file-history.js', () => {
  let tmpDir;

  beforeEach(() => {
    clearHistory();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-fh-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── recordChange ─────────────────────────────────────────
  describe('recordChange()', () => {
    it('adds entry to undo stack', () => {
      recordChange('write_file', '/tmp/a.js', null, 'content');
      expect(getUndoCount()).toBe(1);
    });

    it('clears redo stack on new change', () => {
      const fp = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(fp, 'original');
      recordChange('edit_file', fp, 'original', 'edited');
      undo();
      expect(getRedoCount()).toBe(1);
      recordChange('write_file', fp, 'original', 'new content');
      expect(getRedoCount()).toBe(0);
    });

    it('trims stack beyond max history', () => {
      for (let i = 0; i < 55; i++) {
        recordChange('write_file', `/tmp/file${i}.js`, null, `content${i}`);
      }
      expect(getUndoCount()).toBe(50);
    });
  });

  // ─── undo ─────────────────────────────────────────────────
  describe('undo()', () => {
    it('returns null when nothing to undo', () => {
      expect(undo()).toBeNull();
    });

    it('restores previous content on undo', () => {
      const fp = path.join(tmpDir, 'undo.txt');
      fs.writeFileSync(fp, 'edited');
      recordChange('edit_file', fp, 'original', 'edited');
      const result = undo();
      expect(result).not.toBeNull();
      expect(result.tool).toBe('edit_file');
      expect(result.filePath).toBe(fp);
      expect(fs.readFileSync(fp, 'utf-8')).toBe('original');
    });

    it('deletes newly created file on undo', () => {
      const fp = path.join(tmpDir, 'new.txt');
      fs.writeFileSync(fp, 'new content');
      recordChange('write_file', fp, null, 'new content');
      const result = undo();
      expect(result.wasCreated).toBe(true);
      expect(fs.existsSync(fp)).toBe(false);
    });

    it('adds to redo stack', () => {
      const fp = path.join(tmpDir, 'redo-test.txt');
      fs.writeFileSync(fp, 'edited');
      recordChange('edit_file', fp, 'original', 'edited');
      undo();
      expect(getRedoCount()).toBe(1);
    });

    it('handles multiple undos', () => {
      const fp = path.join(tmpDir, 'multi.txt');
      fs.writeFileSync(fp, 'v2');
      recordChange('edit_file', fp, 'v1', 'v2');
      recordChange('edit_file', fp, 'v2', 'v3');
      fs.writeFileSync(fp, 'v3');

      undo();
      expect(fs.readFileSync(fp, 'utf-8')).toBe('v2');
      undo();
      expect(fs.readFileSync(fp, 'utf-8')).toBe('v1');
    });

    it('handles delete of already-deleted file gracefully', () => {
      const fp = path.join(tmpDir, 'gone.txt');
      recordChange('write_file', fp, null, 'content');
      // File doesn't exist — unlinkSync should not throw
      expect(() => undo()).not.toThrow();
    });
  });

  // ─── redo ─────────────────────────────────────────────────
  describe('redo()', () => {
    it('returns null when nothing to redo', () => {
      expect(redo()).toBeNull();
    });

    it('restores undone change', () => {
      const fp = path.join(tmpDir, 'redo.txt');
      fs.writeFileSync(fp, 'edited');
      recordChange('edit_file', fp, 'original', 'edited');
      undo();
      expect(fs.readFileSync(fp, 'utf-8')).toBe('original');

      const result = redo();
      expect(result).not.toBeNull();
      expect(result.tool).toBe('edit_file');
      expect(fs.readFileSync(fp, 'utf-8')).toBe('edited');
    });

    it('moves entry back to undo stack', () => {
      const fp = path.join(tmpDir, 'redo2.txt');
      fs.writeFileSync(fp, 'edited');
      recordChange('edit_file', fp, 'original', 'edited');
      undo();
      expect(getUndoCount()).toBe(0);
      redo();
      expect(getUndoCount()).toBe(1);
      expect(getRedoCount()).toBe(0);
    });
  });

  // ─── getHistory ────────────────────────────────────────────
  describe('getHistory()', () => {
    it('returns empty array when no changes', () => {
      expect(getHistory()).toEqual([]);
    });

    it('returns entries in reverse order (most recent first)', () => {
      recordChange('write_file', '/a.js', null, 'a');
      recordChange('edit_file', '/b.js', 'old', 'new');
      const history = getHistory();
      expect(history.length).toBe(2);
      expect(history[0].tool).toBe('edit_file');
      expect(history[1].tool).toBe('write_file');
    });

    it('respects limit', () => {
      for (let i = 0; i < 15; i++) {
        recordChange('write_file', `/file${i}.js`, null, `c${i}`);
      }
      const history = getHistory(5);
      expect(history.length).toBe(5);
    });

    it('each entry has tool, filePath, and timestamp', () => {
      recordChange('patch_file', '/x.js', 'old', 'new');
      const history = getHistory();
      expect(history[0].tool).toBe('patch_file');
      expect(history[0].filePath).toBe('/x.js');
      expect(typeof history[0].timestamp).toBe('number');
    });
  });

  // ─── clearHistory ──────────────────────────────────────────
  describe('clearHistory()', () => {
    it('clears both stacks', () => {
      const fp = path.join(tmpDir, 'clear.txt');
      fs.writeFileSync(fp, 'content');
      recordChange('write_file', fp, null, 'content');
      undo();
      expect(getUndoCount()).toBe(0);
      expect(getRedoCount()).toBe(1);

      recordChange('write_file', '/b.js', null, 'b');
      clearHistory();
      expect(getUndoCount()).toBe(0);
      expect(getRedoCount()).toBe(0);
    });
  });

  // ─── getUndoCount / getRedoCount ──────────────────────────
  describe('counts', () => {
    it('getUndoCount returns correct count', () => {
      expect(getUndoCount()).toBe(0);
      recordChange('write_file', '/a.js', null, 'a');
      expect(getUndoCount()).toBe(1);
      recordChange('write_file', '/b.js', null, 'b');
      expect(getUndoCount()).toBe(2);
    });

    it('getRedoCount returns correct count', () => {
      const fp = path.join(tmpDir, 'count.txt');
      fs.writeFileSync(fp, 'c');
      recordChange('write_file', fp, null, 'c');
      expect(getRedoCount()).toBe(0);
      undo();
      expect(getRedoCount()).toBe(1);
    });
  });
});

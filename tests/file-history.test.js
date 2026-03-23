const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  recordChange,
  undo,
  redo,
  getHistory,
  getUndoCount,
  getRedoCount,
  clearHistory,
  persistEntry,
  loadPersistedHistory,
  pruneHistory,
} = require("../cli/file-history");

describe("file-history.js", () => {
  let tmpDir;

  beforeEach(() => {
    clearHistory();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-fh-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── recordChange ─────────────────────────────────────────
  describe("recordChange()", () => {
    it("adds entry to undo stack", () => {
      recordChange("write_file", "/tmp/a.js", null, "content");
      expect(getUndoCount()).toBe(1);
    });

    it("clears redo stack on new change", async () => {
      const fp = path.join(tmpDir, "test.txt");
      fs.writeFileSync(fp, "original");
      recordChange("edit_file", fp, "original", "edited");
      await undo();
      expect(getRedoCount()).toBe(1);
      recordChange("write_file", fp, "original", "new content");
      expect(getRedoCount()).toBe(0);
    });

    it("trims stack beyond max history", () => {
      for (let i = 0; i < 55; i++) {
        recordChange("write_file", `/tmp/file${i}.js`, null, `content${i}`);
      }
      expect(getUndoCount()).toBe(50);
    });
  });

  // ─── undo ─────────────────────────────────────────────────
  describe("undo()", () => {
    it("returns null when nothing to undo", async () => {
      expect(await undo()).toBeNull();
    });

    it("restores previous content on undo", async () => {
      const fp = path.join(tmpDir, "undo.txt");
      fs.writeFileSync(fp, "edited");
      recordChange("edit_file", fp, "original", "edited");
      const result = await undo();
      expect(result).not.toBeNull();
      expect(result.tool).toBe("edit_file");
      expect(result.filePath).toBe(fp);
      expect(fs.readFileSync(fp, "utf-8")).toBe("original");
    });

    it("deletes newly created file on undo", async () => {
      const fp = path.join(tmpDir, "new.txt");
      fs.writeFileSync(fp, "new content");
      recordChange("write_file", fp, null, "new content");
      const result = await undo();
      expect(result.wasCreated).toBe(true);
      expect(fs.existsSync(fp)).toBe(false);
    });

    it("adds to redo stack", async () => {
      const fp = path.join(tmpDir, "redo-test.txt");
      fs.writeFileSync(fp, "edited");
      recordChange("edit_file", fp, "original", "edited");
      await undo();
      expect(getRedoCount()).toBe(1);
    });

    it("handles multiple undos", async () => {
      const fp = path.join(tmpDir, "multi.txt");
      fs.writeFileSync(fp, "v2");
      recordChange("edit_file", fp, "v1", "v2");
      recordChange("edit_file", fp, "v2", "v3");
      fs.writeFileSync(fp, "v3");

      await undo();
      expect(fs.readFileSync(fp, "utf-8")).toBe("v2");
      await undo();
      expect(fs.readFileSync(fp, "utf-8")).toBe("v1");
    });

    it("handles delete of already-deleted file gracefully", async () => {
      const fp = path.join(tmpDir, "gone.txt");
      recordChange("write_file", fp, null, "content");
      // File doesn't exist — unlinkSync should not throw
      await expect(undo()).resolves.not.toThrow();
    });
  });

  // ─── redo ─────────────────────────────────────────────────
  describe("redo()", () => {
    it("returns null when nothing to redo", async () => {
      expect(await redo()).toBeNull();
    });

    it("restores undone change", async () => {
      const fp = path.join(tmpDir, "redo.txt");
      fs.writeFileSync(fp, "edited");
      recordChange("edit_file", fp, "original", "edited");
      await undo();
      expect(fs.readFileSync(fp, "utf-8")).toBe("original");

      const result = await redo();
      expect(result).not.toBeNull();
      expect(result.tool).toBe("edit_file");
      expect(fs.readFileSync(fp, "utf-8")).toBe("edited");
    });

    it("moves entry back to undo stack", async () => {
      const fp = path.join(tmpDir, "redo2.txt");
      fs.writeFileSync(fp, "edited");
      recordChange("edit_file", fp, "original", "edited");
      await undo();
      expect(getUndoCount()).toBe(0);
      await redo();
      expect(getUndoCount()).toBe(1);
      expect(getRedoCount()).toBe(0);
    });
  });

  // ─── getHistory ────────────────────────────────────────────
  describe("getHistory()", () => {
    it("returns empty array when no changes", () => {
      expect(getHistory()).toEqual([]);
    });

    it("returns entries in reverse order (most recent first)", () => {
      recordChange("write_file", "/a.js", null, "a");
      recordChange("edit_file", "/b.js", "old", "new");
      const history = getHistory();
      expect(history.length).toBe(2);
      expect(history[0].tool).toBe("edit_file");
      expect(history[1].tool).toBe("write_file");
    });

    it("respects limit", () => {
      for (let i = 0; i < 15; i++) {
        recordChange("write_file", `/file${i}.js`, null, `c${i}`);
      }
      const history = getHistory(5);
      expect(history.length).toBe(5);
    });

    it("each entry has tool, filePath, and timestamp", () => {
      recordChange("patch_file", "/x.js", "old", "new");
      const history = getHistory();
      expect(history[0].tool).toBe("patch_file");
      expect(history[0].filePath).toBe("/x.js");
      expect(typeof history[0].timestamp).toBe("number");
    });
  });

  // ─── clearHistory ──────────────────────────────────────────
  describe("clearHistory()", () => {
    it("clears both stacks", async () => {
      const fp = path.join(tmpDir, "clear.txt");
      fs.writeFileSync(fp, "content");
      recordChange("write_file", fp, null, "content");
      await undo();
      expect(getUndoCount()).toBe(0);
      expect(getRedoCount()).toBe(1);

      recordChange("write_file", "/b.js", null, "b");
      clearHistory();
      expect(getUndoCount()).toBe(0);
      expect(getRedoCount()).toBe(0);
    });
  });

  // ─── getUndoCount / getRedoCount ──────────────────────────
  describe("counts", () => {
    it("getUndoCount returns correct count", () => {
      expect(getUndoCount()).toBe(0);
      recordChange("write_file", "/a.js", null, "a");
      expect(getUndoCount()).toBe(1);
      recordChange("write_file", "/b.js", null, "b");
      expect(getUndoCount()).toBe(2);
    });

    it("getRedoCount returns correct count", async () => {
      const fp = path.join(tmpDir, "count.txt");
      fs.writeFileSync(fp, "c");
      recordChange("write_file", fp, null, "c");
      expect(getRedoCount()).toBe(0);
      await undo();
      expect(getRedoCount()).toBe(1);
    });
  });

  // ─── Persistent History ──────────────────────────────────
  describe("persistEntry()", () => {
    let cwdSpy;

    beforeEach(() => {
      cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    });

    afterEach(() => {
      cwdSpy.mockRestore();
    });

    it("writes JSON to .nex/history/", async () => {
      const entry = {
        tool: "write_file",
        filePath: "/tmp/test.js",
        oldContent: null,
        newContent: 'console.log("hi")',
        timestamp: 1700000000000,
      };
      await persistEntry(entry);

      const histDir = path.join(tmpDir, ".nex", "history");
      const files = fs.readdirSync(histDir).filter((f) => f.endsWith(".json"));
      expect(files.length).toBe(1);
      expect(files[0]).toBe("1700000000000-test-js.json");

      const record = JSON.parse(
        fs.readFileSync(path.join(histDir, files[0]), "utf-8"),
      );
      expect(record.tool).toBe("write_file");
      expect(record.filePath).toBe("/tmp/test.js");
      expect(record.newContent.inline).toBe(true);
      expect(record.newContent.content).toBe('console.log("hi")');
    });

    it("stores large content as blob reference", async () => {
      const largeContent = "x".repeat(200 * 1024); // 200 KB
      const entry = {
        tool: "edit_file",
        filePath: "/tmp/big.txt",
        oldContent: "small",
        newContent: largeContent,
        timestamp: 1700000000001,
      };
      await persistEntry(entry);

      const histDir = path.join(tmpDir, ".nex", "history");
      const files = fs.readdirSync(histDir).filter((f) => f.endsWith(".json"));
      const record = JSON.parse(
        fs.readFileSync(path.join(histDir, files[0]), "utf-8"),
      );

      // oldContent is small, should be inline
      expect(record.oldContent.inline).toBe(true);
      expect(record.oldContent.content).toBe("small");

      // newContent is large, should be a blob reference
      expect(record.newContent.inline).toBe(false);
      expect(record.newContent.hash).toBeDefined();
      expect(record.newContent.hash.length).toBe(64); // sha256 hex

      // Blob file should exist
      const blobPath = path.join(histDir, "blobs", record.newContent.hash);
      expect(fs.existsSync(blobPath)).toBe(true);
      expect(fs.readFileSync(blobPath, "utf-8")).toBe(largeContent);
    });
  });

  describe("loadPersistedHistory()", () => {
    let cwdSpy;

    beforeEach(() => {
      cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    });

    afterEach(() => {
      cwdSpy.mockRestore();
    });

    it("restores entries from disk", async () => {
      // Persist two entries
      const entry1 = {
        tool: "write_file",
        filePath: "/tmp/a.js",
        oldContent: null,
        newContent: "aaa",
        timestamp: 1700000000010,
      };
      const entry2 = {
        tool: "edit_file",
        filePath: "/tmp/b.js",
        oldContent: "old",
        newContent: "new",
        timestamp: 1700000000020,
      };
      await persistEntry(entry1);
      await persistEntry(entry2);

      // Clear in-memory stack only (don't wipe disk — that's what we're testing can reload)
      clearHistory({ diskToo: false });
      expect(getUndoCount()).toBe(0);

      // Load from disk
      const count = await loadPersistedHistory();
      expect(count).toBe(2);
      expect(getUndoCount()).toBe(2);

      // Verify order (ascending by timestamp)
      const history = getHistory(10);
      expect(history[0].filePath).toBe("/tmp/b.js"); // most recent first in getHistory
      expect(history[1].filePath).toBe("/tmp/a.js");
    });

    it("returns 0 when no history directory exists", async () => {
      const count = await loadPersistedHistory();
      expect(count).toBe(0);
    });
  });

  describe("pruneHistory()", () => {
    let cwdSpy;

    beforeEach(() => {
      cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    });

    afterEach(() => {
      cwdSpy.mockRestore();
    });

    it("removes old entries and orphaned blobs", async () => {
      const now = Date.now();
      const oldTimestamp = now - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const recentTimestamp = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

      // Create an old entry with a blob
      const largeOld = "y".repeat(200 * 1024);
      const oldEntry = {
        tool: "write_file",
        filePath: "/tmp/old.js",
        oldContent: null,
        newContent: largeOld,
        timestamp: oldTimestamp,
      };
      await persistEntry(oldEntry);

      // Create a recent entry
      const recentEntry = {
        tool: "write_file",
        filePath: "/tmp/recent.js",
        oldContent: null,
        newContent: "recent",
        timestamp: recentTimestamp,
      };
      await persistEntry(recentEntry);

      const histDir = path.join(tmpDir, ".nex", "history");
      expect(
        fs.readdirSync(histDir).filter((f) => f.endsWith(".json")).length,
      ).toBe(2);

      const pruned = await pruneHistory(7);
      expect(pruned).toBe(1);

      // Only recent entry should remain
      const remaining = fs
        .readdirSync(histDir)
        .filter((f) => f.endsWith(".json"));
      expect(remaining.length).toBe(1);
      expect(remaining[0]).toContain(String(recentTimestamp));

      // Orphaned blob from old entry should be deleted
      const blobsDir = path.join(histDir, "blobs");
      if (fs.existsSync(blobsDir)) {
        expect(fs.readdirSync(blobsDir).length).toBe(0);
      }
    });

    it("returns 0 when no history exists", async () => {
      const pruned = await pruneHistory();
      expect(pruned).toBe(0);
    });
  });

  describe("round-trip: record → persist → clear → load → undo", () => {
    let cwdSpy;

    beforeEach(() => {
      cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    });

    afterEach(() => {
      cwdSpy.mockRestore();
    });

    it("works end-to-end", async () => {
      const fp = path.join(tmpDir, "roundtrip.txt");
      fs.writeFileSync(fp, "edited");

      // Record a change (this also persists via fire-and-forget)
      recordChange("edit_file", fp, "original", "edited");

      // Wait for fire-and-forget persist to complete
      await new Promise((r) => setTimeout(r, 100));

      // Verify persisted file exists
      const histDir = path.join(tmpDir, ".nex", "history");
      const files = fs.readdirSync(histDir).filter((f) => f.endsWith(".json"));
      expect(files.length).toBe(1);

      // Clear in-memory history only (don't wipe disk — that's what we're testing can reload)
      clearHistory({ diskToo: false });
      expect(getUndoCount()).toBe(0);

      // Load from disk
      const count = await loadPersistedHistory();
      expect(count).toBe(1);
      expect(getUndoCount()).toBe(1);

      // Undo should restore original content
      const result = await undo();
      expect(result).not.toBeNull();
      expect(result.tool).toBe("edit_file");
      expect(fs.readFileSync(fp, "utf-8")).toBe("original");
    });
  });
});

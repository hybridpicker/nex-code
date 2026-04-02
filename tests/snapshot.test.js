/**
 * tests/snapshot.test.js
 * Tests for createSnapshot, listSnapshots, restoreSnapshot in file-history.js
 */

const {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
} = require("../cli/file-history");
const { execSync, execFileSync } = require("child_process");

jest.mock("child_process", () => ({
  execSync: jest.fn(),
  execFileSync: jest.fn(),
}));

describe("snapshot functions", () => {
  beforeEach(() => {
    execSync.mockReset();
    execFileSync.mockReset();
  });

  // ─── createSnapshot ───────────────────────────────────────────────────────
  describe("createSnapshot()", () => {
    it("returns ok:true when stash succeeds", () => {
      execSync
        .mockReturnValueOnce(Buffer.from("M some-file.js")) // git status --porcelain
        .mockReturnValueOnce(Buffer.from("")); // git stash pop
      execFileSync.mockReturnValueOnce(Buffer.from("")); // git stash push (execFileSync)
      const result = createSnapshot("my-snap", "/tmp");
      expect(result.ok).toBe(true);
      expect(result.label).toContain("nex-snapshot-my-snap");
    });

    it("returns ok:false when working tree is clean", () => {
      execSync.mockReturnValueOnce(Buffer.from("")); // git status --porcelain returns empty
      const result = createSnapshot(undefined, "/tmp");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/clean/i);
    });

    it("returns ok:false when git stash throws", () => {
      execSync
        .mockReturnValueOnce(Buffer.from("M file.js"));
      execFileSync.mockImplementationOnce(() => {
          throw new Error("git error");
        });
      const result = createSnapshot("fail", "/tmp");
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("sanitizes snapshot name", () => {
      execSync
        .mockReturnValueOnce(Buffer.from("M file.js"))
        .mockReturnValue(Buffer.from(""));
      const result = createSnapshot("my snapshot/name!", "/tmp");
      expect(result.label).not.toMatch(/[ !/]/);
    });

    it("generates a timestamp name when no name given", () => {
      execSync
        .mockReturnValueOnce(Buffer.from("M file.js"))
        .mockReturnValue(Buffer.from(""));
      const result = createSnapshot(undefined, "/tmp");
      expect(result.label).toMatch(/^nex-snapshot-\d+$/);
    });
  });

  // ─── listSnapshots ────────────────────────────────────────────────────────
  describe("listSnapshots()", () => {
    it("returns empty array when stash is empty", () => {
      execSync.mockReturnValueOnce(Buffer.from(""));
      expect(listSnapshots("/tmp")).toEqual([]);
    });

    it("returns empty array when no nex snapshots in stash", () => {
      execSync.mockReturnValueOnce(
        Buffer.from("stash@{0}: WIP on main: abc123 Some other commit\n"),
      );
      expect(listSnapshots("/tmp")).toEqual([]);
    });

    it("returns snapshots with correct shape", () => {
      execSync.mockReturnValueOnce(
        Buffer.from(
          "stash@{0}: On main: nex-snapshot-my-snap\n" +
            "stash@{1}: On main: nex-snapshot-1234567890\n",
        ),
      );
      const snaps = listSnapshots("/tmp");
      expect(snaps).toHaveLength(2);
      expect(snaps[0]).toMatchObject({
        index: 0,
        label: "nex-snapshot-my-snap",
        shortName: "my-snap",
      });
      expect(snaps[1].index).toBe(1);
    });

    it("returns empty array on execSync error", () => {
      execSync.mockImplementationOnce(() => {
        throw new Error("git not found");
      });
      expect(listSnapshots("/tmp")).toEqual([]);
    });
  });

  // ─── restoreSnapshot ──────────────────────────────────────────────────────
  describe("restoreSnapshot()", () => {
    it("returns error when no snapshots exist", () => {
      execSync.mockReturnValueOnce(Buffer.from("")); // listSnapshots → empty stash
      const result = restoreSnapshot("last", "/tmp");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/no snapshots/i);
    });

    it('restores the most recent snapshot with "last"', () => {
      execSync
        .mockReturnValueOnce(
          Buffer.from("stash@{0}: On main: nex-snapshot-recent\n"),
        ) // listSnapshots
        .mockReturnValueOnce(Buffer.from("")); // git stash apply
      const result = restoreSnapshot("last", "/tmp");
      expect(result.ok).toBe(true);
      expect(result.label).toBe("nex-snapshot-recent");
    });

    it("restores by shortName", () => {
      execSync
        .mockReturnValueOnce(
          Buffer.from("stash@{0}: On main: nex-snapshot-my-snap\n"),
        ) // list
        .mockReturnValueOnce(Buffer.from("")); // apply
      const result = restoreSnapshot("my-snap", "/tmp");
      expect(result.ok).toBe(true);
    });

    it("returns error when target not found", () => {
      execSync.mockReturnValueOnce(
        Buffer.from("stash@{0}: On main: nex-snapshot-other\n"),
      );
      const result = restoreSnapshot("nonexistent", "/tmp");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it("returns error when git stash apply fails", () => {
      execSync
        .mockReturnValueOnce(
          Buffer.from("stash@{0}: On main: nex-snapshot-bad\n"),
        )
        .mockImplementationOnce(() => {
          throw new Error("conflict");
        });
      const result = restoreSnapshot("last", "/tmp");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("conflict");
    });
  });
});

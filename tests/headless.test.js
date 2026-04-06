const { execFileSync } = require("child_process");
const path = require("path");

const BIN = path.join(__dirname, "..", "bin", "nex-code.js");
const NODE = process.execPath;

describe("headless mode (bin/nex-code.js)", () => {
  // ─── --version ──────────────────────────────────────────────
  describe("--version", () => {
    it("prints version and exits", () => {
      const out = execFileSync(NODE, [BIN, "--version"], {
        encoding: "utf-8",
      });
      expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("short flag -v works", () => {
      const out = execFileSync(NODE, [BIN, "-v"], { encoding: "utf-8" });
      expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  // ─── --help ─────────────────────────────────────────────────
  describe("--help", () => {
    it("prints usage text and exits", () => {
      const out = execFileSync(NODE, [BIN, "--help"], { encoding: "utf-8" });
      expect(out).toContain("Usage:");
      expect(out).toContain("--task");
      expect(out).toContain("--auto");
      expect(out).toContain("--model");
      expect(out).toContain("--json");
    });

    it("short flag -h works", () => {
      const out = execFileSync(NODE, [BIN, "-h"], { encoding: "utf-8" });
      expect(out).toContain("Usage:");
    });
  });

  // ─── --daemon in --help ─────────────────────────────────────
  describe("--daemon flag", () => {
    it("--help output mentions --daemon", () => {
      const out = execFileSync(NODE, [BIN, "--help"], { encoding: "utf-8" });
      expect(out).toContain("--daemon");
    });
  });

  // ─── --task validation ──────────────────────────────────────
  describe("--task validation", () => {
    it("exits with error when --task has no prompt", () => {
      try {
        execFileSync(NODE, [BIN, "--task"], {
          encoding: "utf-8",
          stdio: "pipe",
        });
        throw new Error("Should have exited with error");
      } catch (e) {
        expect(e.status).toBe(1);
        expect(e.stderr).toContain("requires a prompt");
      }
    });

    it("exits with error when --task is followed by another flag", () => {
      try {
        execFileSync(NODE, [BIN, "--task", "--json"], {
          encoding: "utf-8",
          stdio: "pipe",
        });
        throw new Error("Should have exited with error");
      } catch (e) {
        expect(e.status).toBe(1);
      }
    });
  });
});

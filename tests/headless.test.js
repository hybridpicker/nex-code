const { runCli } = require("./helpers/cli-harness");

describe("headless mode (bin/nex-code.js)", () => {
  // ─── --version ──────────────────────────────────────────────
  describe("--version", () => {
    it("prints version and exits", () => {
      const r = runCli(["--version"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("short flag -v works", () => {
      const r = runCli(["-v"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  // ─── --help ─────────────────────────────────────────────────
  describe("--help", () => {
    it("prints usage text and exits", () => {
      const r = runCli(["--help"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped).toContain("Usage:");
      for (const flag of ["--task", "--auto", "--model", "--json"])
        expect(r.stdoutStripped).toContain(flag);
    });

    it("short flag -h works", () => {
      const r = runCli(["-h"]);
      expect(r.exitCode).toBe(0);
      expect(r.stdoutStripped).toContain("Usage:");
    });
  });

  // ─── --daemon in --help ─────────────────────────────────────
  describe("--daemon flag", () => {
    it("--help output mentions --daemon", () => {
      const r = runCli(["--help"]);
      expect(r.stdoutStripped).toContain("--daemon");
    });
  });

  // ─── --task validation ──────────────────────────────────────
  describe("--task validation", () => {
    it("exits with error when --task has no prompt", () => {
      const r = runCli(["--task"], { expectError: true });
      expect(r.exitCode).toBe(1);
      expect(r.stderrStripped).toContain("requires a prompt");
    });

    it("exits with error when --task is followed by another flag", () => {
      const r = runCli(["--task", "--json"], { expectError: true });
      expect(r.exitCode).toBe(1);
    });
  });
});

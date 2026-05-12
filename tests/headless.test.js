const { runCli } = require("./helpers/cli-harness");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

  describe("headless fail-closed behavior", () => {
    it("exits non-zero when the run ends without a final assistant response", () => {
      const r = runCli(
        ["--auto", "--json", "--task", "Trigger null provider response."],
        {
          expectError: true,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_NULL_RESPONSE: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      const lines = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      expect(lines.length).toBeGreaterThan(0);
      const last = JSON.parse(lines[lines.length - 1]);
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain("without a final assistant response");
    });

    it("exits non-zero when writes occur without a final summary", () => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "nex-headless-"));
      const r = runCli(
        ["--auto", "--json", "--task", "Write a file and then stop."],
        {
          expectError: true,
          cwd,
          env: {
            NEX_NO_DOTENV: "1",
            NEX_MOCK_PROVIDER: "1",
            NEX_MOCK_WRITE_THEN_NULL: "1",
            HEADLESS_MODEL: "mock:mock-model",
            NEX_NO_FLATRATE: "1",
            OLLAMA_API_KEY: "",
            NEX_PHASE_ROUTING: "0",
          },
        },
      );
      expect(r.exitCode).toBe(1);
      expect(fs.readFileSync(path.join(cwd, "write-null.txt"), "utf-8")).toBe(
        "changed\n",
      );
      const lines = r.stdoutStripped
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const last = JSON.parse(lines[lines.length - 1]);
      expect(last.type).toBe("error");
      expect(last.success).toBe(false);
      expect(last.error).toContain("modified files");
    });
  });
});

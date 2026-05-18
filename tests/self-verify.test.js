"use strict";

const {
  runSelfVerification,
  buildVerificationEvidence,
  buildVerificationDonePayload,
} = require("../cli/self-verify");

// Mock child_process
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

describe("self-verify.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("runSelfVerification", () => {
    it("returns no-edits failure when filesModified is empty", async () => {
      const result = await runSelfVerification({
        filesModified: new Set(),
        cwd: "/tmp/test",
      });

      expect(result.passed).toBe(false);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].name).toBe("no-edits");
      expect(result.summary).toContain("No edits detected");
    });

    it("runs git diff and readback for modified files", async () => {
      execSync
        .mockReturnValueOnce("file.js | 5 +++--") // git diff --stat
        .mockReturnValueOnce("1 file changed, 5 insertions(+), 2 deletions(-)"); // git diff --shortstat

      // Mock file existence
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue("line1\nline2\nline3\nline4\nline5\n");

      const result = await runSelfVerification({
        filesModified: new Set(["file.js"]),
        cwd: "/tmp/test",
      });

      expect(result.checks.length).toBeGreaterThanOrEqual(2);
      const diffCheck = result.checks.find((c) => c.name === "git-diff");
      expect(diffCheck.passed).toBe(true);
    });

    it("reports git-diff failure when no diff output", async () => {
      execSync
        .mockReturnValueOnce("") // empty git diff --stat
        .mockReturnValueOnce(""); // empty git diff --shortstat

      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue("content");

      const result = await runSelfVerification({
        filesModified: new Set(["file.js"]),
        cwd: "/tmp/test",
      });

      const diffCheck = result.checks.find((c) => c.name === "git-diff");
      expect(diffCheck.passed).toBe(false);
      expect(diffCheck.evidence).toContain("No git diff");
    });

    it("reports readback failure when file not found", async () => {
      execSync
        .mockReturnValueOnce("file.js | 1 +")
        .mockReturnValueOnce("1 file changed");

      jest.spyOn(fs, "existsSync").mockReturnValue(false);

      const result = await runSelfVerification({
        filesModified: new Set(["missing.js"]),
        cwd: "/tmp/test",
      });

      const readbackCheck = result.checks.find((c) => c.name === "readback:missing.js");
      expect(readbackCheck.passed).toBe(false);
      expect(readbackCheck.evidence).toContain("not found");
    });

    it("limits readback to first 3 files", async () => {
      execSync
        .mockReturnValueOnce("a.js | 1 +\nb.js | 1 +\nc.js | 1 +\nd.js | 1 +")
        .mockReturnValueOnce("4 files changed");

      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue("content");

      const result = await runSelfVerification({
        filesModified: new Set(["a.js", "b.js", "c.js", "d.js"]),
        cwd: "/tmp/test",
      });

      const readbackChecks = result.checks.filter((c) => c.name.startsWith("readback:"));
      expect(readbackChecks.length).toBeLessThanOrEqual(3);
    });

    it("runs fast verification commands when provided", async () => {
      execSync
        .mockReturnValueOnce("src/file.ts | 3 +++")
        .mockReturnValueOnce("1 file changed");

      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue("content");

      // The tsc command should be recognized as fast
      const result = await runSelfVerification({
        filesModified: new Set(["src/file.ts"]),
        cwd: "/tmp/test",
        verificationCommands: ["npx tsc --noEmit"],
      });

      // tsc is recognized as fast command → should be executed
      const cmdChecks = result.checks.filter((c) => c.name.startsWith("cmd:"));
      expect(cmdChecks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("buildVerificationEvidence", () => {
    it("produces passed message when all checks pass", () => {
      const result = {
        passed: true,
        checks: [
          { name: "git-diff", passed: true, evidence: "1 file changed" },
          { name: "readback:file.js", passed: true, evidence: "File exists" },
        ],
      };

      const evidence = buildVerificationEvidence(result);
      expect(evidence).toContain("✓ git-diff");
      expect(evidence).toContain("All checks passed");
    });

    it("produces failed message with failure details", () => {
      const result = {
        passed: false,
        checks: [
          { name: "git-diff", passed: false, evidence: "No git diff" },
          { name: "readback:file.js", passed: true, evidence: "File exists" },
        ],
      };

      const evidence = buildVerificationEvidence(result);
      expect(evidence).toContain("✗ git-diff");
      expect(evidence).toContain("CHECKS FAILED");
    });

    it("includes evidence text for each check", () => {
      const result = {
        passed: true,
        checks: [
          { name: "git-diff", passed: true, evidence: "1 file changed, 5 insertions(+)" },
        ],
      };

      const evidence = buildVerificationEvidence(result);
      expect(evidence).toContain("1 file changed");
    });
  });

  describe("buildVerificationDonePayload", () => {
    it("builds structured payload for server consumers", () => {
      const result = {
        passed: true,
        checks: [
          { name: "git-diff", passed: true, evidence: "ok" },
          { name: "readback:file.js", passed: false, evidence: "missing" },
        ],
      };

      const payload = buildVerificationDonePayload(result);
      expect(payload.self_verify.passed).toBe(true);
      expect(payload.self_verify.check_count).toBe(2);
      expect(payload.self_verify.failed_count).toBe(1);
      expect(payload.self_verify.checks[0].name).toBe("git-diff");
    });
  });
});
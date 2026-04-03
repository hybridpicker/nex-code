const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Tests for hooks/pre-push secret detection.
 *
 * Strategy: instead of setting up real git repos with remotes,
 * we test the pattern-matching logic by extracting the grep patterns
 * from the hook and running them against sample diffs.
 */

const HOOK_PATH = path.resolve(__dirname, "..", "hooks", "pre-push");
const hookSource = fs.readFileSync(HOOK_PATH, "utf-8");

// Helper: run a pattern against sample text, return true if it matches
function matchesPattern(pattern, text) {
  try {
    execSync(
      `echo ${JSON.stringify(text)} | grep -Ei ${JSON.stringify(pattern)}`,
      {
        stdio: "pipe",
      },
    );
    return true;
  } catch {
    return false;
  }
}

// Helper: create a temp dir with a minimal git repo and test the full hook
function runHookWithDiff(diffContent, opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-hook-test-"));
  // Always skip tests and benchmark gate — integration tests only exercise secret detection
  const env = {
    ...process.env,
    NEX_SKIP_TESTS: "1",
    NEX_SKIP_BENCHMARK: "1",
    ...(opts.env || {}),
  };

  try {
    // Set up a git repo
    execSync("git init", { cwd: tmpDir, stdio: "pipe" });
    execSync('git config user.email "test@test.com"', {
      cwd: tmpDir,
      stdio: "pipe",
    });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: "pipe" });

    // Initial commit
    fs.writeFileSync(path.join(tmpDir, "init.txt"), "init");
    execSync('git add . && git commit -m "init"', {
      cwd: tmpDir,
      stdio: "pipe",
    });
    const baseHash = execSync("git rev-parse HEAD", {
      cwd: tmpDir,
      stdio: "pipe",
    })
      .toString()
      .trim();

    // Add file with potential secret
    fs.writeFileSync(path.join(tmpDir, "test-file.txt"), diffContent);
    execSync('git add . && git commit -m "add test file"', {
      cwd: tmpDir,
      stdio: "pipe",
    });
    const headHash = execSync("git rev-parse HEAD", {
      cwd: tmpDir,
      stdio: "pipe",
    })
      .toString()
      .trim();

    // Write allowlist if provided
    if (opts.allowlist) {
      const nexDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(nexDir, { recursive: true });
      fs.writeFileSync(path.join(nexDir, "push-allowlist"), opts.allowlist);
    }

    // Copy hook to temp repo
    const hookDest = path.join(tmpDir, ".git", "hooks", "pre-push");
    fs.copyFileSync(HOOK_PATH, hookDest);
    fs.chmodSync(hookDest, "755");

    // Simulate what git passes to pre-push: stdin with ref info
    // Format: <local ref> <local sha> <remote ref> <remote sha>
    const stdinData = `refs/heads/main ${headHash} refs/heads/main ${baseHash}\n`;

    const result = execSync(
      "bash .git/hooks/pre-push origin https://example.com",
      {
        cwd: tmpDir,
        input: stdinData,
        stdio: ["pipe", "pipe", "pipe"],
        env,
      },
    );
    return { exitCode: 0, output: result.toString() };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      output: (err.stdout || "").toString() + (err.stderr || "").toString(),
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("hooks/pre-push", () => {
  // ─── Hook file basics ──────────────────────────────────────
  describe("hook file", () => {
    it("exists and is executable", () => {
      expect(fs.existsSync(HOOK_PATH)).toBe(true);
      const stats = fs.statSync(HOOK_PATH);
      // Check owner execute bit
      expect(stats.mode & 0o100).toBeTruthy();
    });

    it("starts with bash shebang", () => {
      expect(hookSource.startsWith("#!/bin/bash")).toBe(true);
    });

    it("contains set -euo pipefail", () => {
      expect(hookSource).toContain("set -euo pipefail");
    });
  });

  // ─── Pattern matching (unit-level) ─────────────────────────
  describe("pattern matching", () => {
    // API Keys
    describe("API Keys", () => {
      it("detects OpenAI sk- keys", () => {
        expect(
          matchesPattern(
            "sk-[a-zA-Z0-9]{20,}",
            "sk-abc123def456ghi789jkl012mno",
          ),
        ).toBe(true);
      });

      it("ignores short sk- strings", () => {
        expect(matchesPattern("sk-[a-zA-Z0-9]{20,}", "sk-short")).toBe(false);
      });

      it("detects AWS access keys", () => {
        expect(matchesPattern("AKIA[A-Z0-9]{16}", "AKIAIOSFODNN7EXAMPLE")).toBe(
          true,
        );
      });

      it("ignores non-AWS strings starting with AKIA", () => {
        expect(matchesPattern("AKIA[A-Z0-9]{16}", "AKIA_short")).toBe(false);
      });

      it("detects GitHub personal access tokens", () => {
        expect(
          matchesPattern(
            "ghp_[a-zA-Z0-9]{36}",
            "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
          ),
        ).toBe(true);
      });

      it("detects GitHub OAuth tokens", () => {
        expect(
          matchesPattern(
            "gho_[a-zA-Z0-9]{36}",
            "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
          ),
        ).toBe(true);
      });

      it("detects GitHub App tokens", () => {
        expect(
          matchesPattern(
            "ghs_[a-zA-Z0-9]{36}",
            "ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
          ),
        ).toBe(true);
      });

      it("detects Slack tokens", () => {
        expect(
          matchesPattern("xox[bpors]-[a-zA-Z0-9-]+", "xoxb-123-456-abc"),
        ).toBe(true);
      });
    });

    // Private Keys
    describe("Private Keys", () => {
      it("detects RSA private key headers", () => {
        expect(
          matchesPattern(
            "BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY",
            "-----BEGIN RSA PRIVATE KEY-----",
          ),
        ).toBe(true);
      });

      it("detects EC private key headers", () => {
        expect(
          matchesPattern(
            "BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY",
            "-----BEGIN EC PRIVATE KEY-----",
          ),
        ).toBe(true);
      });

      it("detects OPENSSH private key headers", () => {
        expect(
          matchesPattern(
            "BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY",
            "-----BEGIN OPENSSH PRIVATE KEY-----",
          ),
        ).toBe(true);
      });

      it("does not match public keys", () => {
        expect(
          matchesPattern(
            "BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY",
            "-----BEGIN PUBLIC KEY-----",
          ),
        ).toBe(false);
      });
    });

    // Hardcoded secrets
    describe("Hardcoded Secrets", () => {
      const pattern =
        "(password|secret|token|api_key|apikey|api_secret|access_token|auth_token|credentials)\\s*[:=]\\s*['\"][^'\"]{8,}";

      it('detects password = "longvalue"', () => {
        expect(
          matchesPattern(pattern, 'password = "mysecretpassword123"'),
        ).toBe(true);
      });

      it('detects token: "longvalue"', () => {
        expect(matchesPattern(pattern, "token: 'abcdefghijk123456'")).toBe(
          true,
        );
      });

      it('detects api_key="longvalue"', () => {
        expect(matchesPattern(pattern, 'api_key="a1b2c3d4e5f6g7h8"')).toBe(
          true,
        );
      });

      it("ignores short values", () => {
        expect(matchesPattern(pattern, 'password = "short"')).toBe(false);
      });

      it("ignores unquoted values", () => {
        expect(matchesPattern(pattern, "password = mysecretpassword123")).toBe(
          false,
        );
      });
    });

    // SSH + IP
    describe("SSH + IP", () => {
      it("detects ssh user@ip", () => {
        expect(
          matchesPattern(
            "ssh\\s+.*@[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+",
            "ssh root@192.168.1.100",
          ),
        ).toBe(true);
      });

      it("detects ssh -i key user@ip", () => {
        expect(
          matchesPattern(
            "ssh\\s+.*@[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+",
            "ssh -i mykey.pem admin@10.0.0.1",
          ),
        ).toBe(true);
      });

      it("does not match ssh with hostname", () => {
        expect(
          matchesPattern(
            "ssh\\s+.*@[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+",
            "ssh user@example.com",
          ),
        ).toBe(false);
      });
    });

    // .env leaks
    describe(".env Leaks", () => {
      const pattern =
        "^[+].*\\b(API_KEY|SECRET_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|AUTH_TOKEN|DB_PASSWORD|DATABASE_URL)\\s*=";

      it("detects added API_KEY line", () => {
        expect(matchesPattern(pattern, "+API_KEY=sk-abc123")).toBe(true);
      });

      it("detects added SECRET_KEY line", () => {
        expect(matchesPattern(pattern, "+SECRET_KEY=myvalue")).toBe(true);
      });

      it("detects added DB_PASSWORD line", () => {
        expect(matchesPattern(pattern, "+DB_PASSWORD=hunter2")).toBe(true);
      });

      it("ignores removed lines (- prefix)", () => {
        expect(matchesPattern(pattern, "-API_KEY=oldvalue")).toBe(false);
      });

      it("ignores non-secret env vars", () => {
        expect(matchesPattern(pattern, "+NODE_ENV=production")).toBe(false);
      });
    });
  });

  // ─── Integration: full hook execution ──────────────────────
  describe("integration", () => {
    it("passes clean files without secrets", () => {
      const result = runHookWithDiff(
        "Hello, this is a normal file.\nNo secrets here.\n",
      );
      expect(result.exitCode).toBe(0);
    });

    it("blocks files containing an OpenAI key", () => {
      const result = runHookWithDiff(
        'const key = "sk-abcdefghijklmnopqrstuvwxyz1234567890";\n',
      );
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("SECRET DETECTED");
    });

    it("blocks files containing a private key header", () => {
      const result = runHookWithDiff(
        "-----BEGIN RSA PRIVATE KEY-----\nMIIEpA...\n-----END RSA PRIVATE KEY-----\n",
      );
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("SECRET DETECTED");
    });

    it("blocks files with hardcoded passwords", () => {
      const result = runHookWithDiff(
        'const config = { password: "superSecretPass123!" };\n',
      );
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("SECRET DETECTED");
    });

    it("blocks files with AWS keys", () => {
      const result = runHookWithDiff("AWS_KEY=AKIAIOSFODNN7EXAMPLE\n");
      expect(result.exitCode).toBe(1);
    });

    it("allows bypass with NEX_SKIP_SECRET_CHECK=1", () => {
      const result = runHookWithDiff(
        'const key = "sk-abcdefghijklmnopqrstuvwxyz1234567890";\n',
        { env: { NEX_SKIP_SECRET_CHECK: "1" } },
      );
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("skipped");
    });

    it("respects allowlist entries", () => {
      const result = runHookWithDiff(
        'const key = "sk-abcdefghijklmnopqrstuvwxyz1234567890";\n',
        { allowlist: "sk-abcdefghijklmnopqrstuvwxyz1234567890" },
      );
      expect(result.exitCode).toBe(0);
    });

    it("blocks non-allowlisted secrets even with allowlist present", () => {
      const result = runHookWithDiff(
        'const key = "sk-abcdefghijklmnopqrstuvwxyz1234567890";\npassword: "anothersecretvalue123"\n',
        { allowlist: "sk-abcdefghijklmnopqrstuvwxyz1234567890" },
      );
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain("SECRET DETECTED");
    });
  });

  // ─── install-hooks script ──────────────────────────────────
  describe("install-hooks npm script", () => {
    it("package.json contains install-hooks script", () => {
      const pkg = require("../package.json");
      expect(pkg.scripts["install-hooks"]).toBeDefined();
      expect(pkg.scripts["install-hooks"]).toContain("ln -sf");
      expect(pkg.scripts["install-hooks"]).toContain("pre-push");
    });
  });
});

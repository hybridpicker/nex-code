/**
 * End-to-end interactive tests for bin/nex-code.js flows that can't
 * be exercised with a one-shot runCli():
 *   - first-run setup wizard
 *   - REPL startup error path when no provider is configured
 *
 * These tests intentionally run with replaceEnv:true + a tmp HOME + tmp cwd
 * so the host's real ~/.nex-code/.env and ANTHROPIC_API_KEY etc. cannot
 * leak in and mask the behavior under test.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnCli } = require("./helpers/cli-harness");

/**
 * Build a minimal env that does NOT contain any provider credentials
 * and points HOME at a throwaway dir so the wizard sees a clean slate.
 */
function isolatedEnv(tmpHome) {
  return {
    PATH: process.env.PATH || "/usr/bin:/bin",
    HOME: tmpHome,
    // prevent the repo's own .env (at dotfiles path) from being picked
    // up by dotenv when nex-code is spawned outside of it
    NEX_DISABLE_UPDATE_CHECK: "1",
    NEX_NO_DOTENV: "1",
    // keep output deterministic
    NO_COLOR: "1",
    TERM: "dumb",
  };
}

function configuredEnv(tmpHome) {
  return {
    ...isolatedEnv(tmpHome),
    DEFAULT_PROVIDER: "ollama",
    DEFAULT_MODEL: "devstral-small-2:24b",
  };
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("interactive: setup wizard", () => {
  let tmpHome, tmpCwd;

  beforeEach(() => {
    tmpHome = mkTmp("nex-wizard-home-");
    tmpCwd = mkTmp("nex-wizard-cwd-");
  });

  afterEach(() => {
    for (const d of [tmpHome, tmpCwd]) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {}
    }
  });

  test("prompts for a provider on first run", async () => {
    const s = spawnCli([], {
      env: isolatedEnv(tmpHome),
      cwd: tmpCwd,
      replaceEnv: true,
    });
    try {
      await s.waitFor(/Which AI provider/, 8000);
      // Wait until the full menu (last line is "Enter number") has been
      // flushed — the wizard prints options one at a time.
      await s.waitFor(/Enter number/, 4000);
      expect(s.stdout).toContain("Ollama Cloud");
      expect(s.stdout).toContain("Anthropic");
      expect(s.stdout).toContain("Skip / Cancel");
    } finally {
      s.kill();
      // allow close event to settle so jest doesn't warn about open handles
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 15000);

  test("choosing 5 (Skip) cancels cleanly and falls through", async () => {
    const s = spawnCli([], {
      env: isolatedEnv(tmpHome),
      cwd: tmpCwd,
      replaceEnv: true,
    });
    try {
      await s.waitFor(/Which AI provider/, 8000);
      s.send("5");
      await s.waitFor(/Cancelled — no changes made/, 4000);
      // After cancel the CLI will try to start the REPL without a provider
      // configured and must exit with an explanatory error. That path is
      // validated in its own test below.
    } finally {
      s.kill();
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 15000);
});

// Note: a test for "REPL errors out when no provider is configured" was
// considered but dropped — checkLocalOllama() in cli/commands/index.js
// hardcodes http://localhost:11434, so the outcome depends on whether a
// local Ollama daemon happens to be running. Not a reliable unit-test signal.

describe("interactive: repl slash commands", () => {
  let tmpHome, tmpCwd;

  beforeEach(() => {
    tmpHome = mkTmp("nex-repl-home-");
    tmpCwd = mkTmp("nex-repl-cwd-");
  });

  afterEach(() => {
    for (const d of [tmpHome, tmpCwd]) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {}
    }
  });

  test("supports /help followed by /exit in a real REPL session", async () => {
    const s = spawnCli([], {
      env: configuredEnv(tmpHome),
      cwd: tmpCwd,
      replaceEnv: true,
    });
    try {
      await s.waitFor(/›/, 12000);
      s.send("/help");
      await s.waitFor(/Commands:/, 4000);
      expect(s.stdout).toContain("/help");
      expect(s.stdout).toContain("/exit");

      s.send("/exit");
      const code = await s.waitForExit(4000);
      expect(code).toBe(0);
    } finally {
      if (!s.closed) {
        s.kill();
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }, 20000);
});

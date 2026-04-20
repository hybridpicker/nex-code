/**
 * Tests for tests/helpers/cli-harness.js
 *
 * Split into:
 *  1. Unit tests for the harness itself, using a fixture REPL (fast, no real CLI)
 *  2. Smoke tests against bin/nex-code.js --version/--help to prove it works
 *     end-to-end on the real CLI.
 */

const path = require("path");
const { spawn } = require("child_process");
const {
  runCli,
  spawnCli,
  stripAnsi,
  CliSession,
} = require("./helpers/cli-harness");

const FIXTURE = path.join(
  __dirname,
  "helpers",
  "cli-harness-fixtures",
  "echo-repl.js",
);

function spawnFixture() {
  const child = spawn(process.execPath, [FIXTURE], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  return new CliSession(child);
}

describe("cli-harness / stripAnsi", () => {
  test("removes color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });
  test("leaves plain strings alone", () => {
    expect(stripAnsi("hello")).toBe("hello");
  });
  test("coerces non-strings", () => {
    expect(stripAnsi(42)).toBe("42");
  });
});

describe("cli-harness / CliSession (interactive)", () => {
  test("waitFor resolves on first matching output", async () => {
    const s = spawnFixture();
    await s.waitFor(/ready>/, 3000);
    expect(s.stdout).toContain("ready>");
    await s.close();
  });

  test("send + waitFor roundtrip", async () => {
    const s = spawnFixture();
    await s.waitFor(/ready>/, 3000);
    s.send("hello");
    await s.waitFor(/echo: hello/, 3000);
    expect(s.stdout).toMatch(/echo: hello/);
    await s.close();
  });

  test("multiple sends are handled in order", async () => {
    const s = spawnFixture();
    await s.waitFor(/ready>/, 3000);
    s.send("one");
    await s.waitFor(/echo: one/, 3000);
    s.send("two");
    await s.waitFor(/echo: two/, 3000);
    expect(s.stdout).toMatch(/echo: one[\s\S]*echo: two/);
    await s.close();
  });

  test("waitFor rejects on timeout with diagnostic message", async () => {
    const s = spawnFixture();
    await s.waitFor(/ready>/, 3000);
    await expect(s.waitFor(/never-appears/, 200)).rejects.toThrow(
      /waitFor timeout/,
    );
    await s.close();
  });

  test("close resolves with exit code", async () => {
    const s = spawnFixture();
    await s.waitFor(/ready>/, 3000);
    s.send("quit");
    const code = await s.close();
    expect(code).toBe(0);
  });

  test("send after close throws", async () => {
    const s = spawnFixture();
    await s.waitFor(/ready>/, 3000);
    s.send("quit");
    await s.close();
    expect(() => s.send("x")).toThrow(/session closed/);
  });
});

describe("cli-harness / runCli (smoke against real CLI)", () => {
  test("--version prints semver and exits 0", () => {
    const r = runCli(["--version"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdoutStripped.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("--help mentions key flags", () => {
    const r = runCli(["--help"]);
    expect(r.exitCode).toBe(0);
    for (const flag of ["--task", "--auto", "--model", "--json"])
      expect(r.stdoutStripped).toContain(flag);
  });

  test("--task with no prompt exits non-zero with explanatory stderr", () => {
    const r = runCli(["--task"], { expectError: true });
    expect(r.exitCode).toBe(1);
    expect(r.stderrStripped).toMatch(/requires a prompt/i);
  });
});

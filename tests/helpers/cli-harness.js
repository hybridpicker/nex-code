/**
 * CLI Test Harness
 *
 * Shared helpers for testing bin/nex-code.js. Replaces ad-hoc execFileSync
 * usage across ~14 test files and adds interactive session support.
 *
 * - runCli(args, opts)    → one-shot: run to completion, return captured output
 * - spawnCli(args, opts)  → interactive CliSession: send/waitFor/expect/close
 * - stripAnsi(str)        → remove ANSI color codes for stable assertions
 */

const { spawn, execFileSync } = require("child_process");
const path = require("path");

const BIN = path.join(__dirname, "..", "..", "bin", "nex-code.js");
const NODE = process.execPath;

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;

function stripAnsi(str) {
  return String(str).replace(ANSI_RE, "");
}

/**
 * Run the CLI to completion and capture output.
 *
 * @param {string[]} args - CLI arguments (do NOT include node or bin path)
 * @param {{
 *   input?: string,        - stdin content piped in
 *   env?: object,          - extra env vars merged into process.env
 *   cwd?: string,          - working directory
 *   timeout?: number,      - kill after N ms (default 10000)
 *   expectError?: boolean, - if true, non-zero exit does not throw
 * }} [opts]
 * @returns {{ stdout: string, stderr: string, exitCode: number,
 *             stdoutStripped: string, stderrStripped: string }}
 */
function runCli(args, opts = {}) {
  const {
    input,
    env = {},
    cwd,
    timeout = 10000,
    expectError = false,
  } = opts;

  try {
    const stdout = execFileSync(NODE, [BIN, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      input,
      env: { ...process.env, ...env },
      cwd,
      timeout,
    });
    return {
      stdout,
      stderr: "",
      exitCode: 0,
      stdoutStripped: stripAnsi(stdout),
      stderrStripped: "",
    };
  } catch (e) {
    if (!expectError && typeof e.status !== "number") throw e;
    const stdout = e.stdout ? String(e.stdout) : "";
    const stderr = e.stderr ? String(e.stderr) : "";
    return {
      stdout,
      stderr,
      exitCode: typeof e.status === "number" ? e.status : -1,
      stdoutStripped: stripAnsi(stdout),
      stderrStripped: stripAnsi(stderr),
      signal: e.signal,
    };
  }
}

/**
 * Represents a running interactive CLI process.
 *
 * Use for flows that require sending input and reacting to prompts
 * (wizard, confirm dialogs, chat REPL).
 */
class CliSession {
  constructor(child) {
    this.child = child;
    this.stdoutBuf = "";
    this.stderrBuf = "";
    this.closed = false;
    this.exitCode = null;
    this.signal = null;
    this._waiters = [];

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (d) => this._onData("stdout", d));
    child.stderr.on("data", (d) => this._onData("stderr", d));
    child.on("close", (code, signal) => {
      this.closed = true;
      this.exitCode = code;
      this.signal = signal;
      for (const w of this._waiters) w.reject(new Error("process closed"));
      this._waiters = [];
    });
  }

  _onData(stream, chunk) {
    if (stream === "stdout") this.stdoutBuf += chunk;
    else this.stderrBuf += chunk;
    // Re-evaluate waiters against the stripped combined buffer
    const combined = stripAnsi(this.stdoutBuf + this.stderrBuf);
    const remaining = [];
    for (const w of this._waiters) {
      if (w.re.test(combined)) w.resolve(combined);
      else remaining.push(w);
    }
    this._waiters = remaining;
  }

  /**
   * Send a string to stdin. Appends "\n" unless raw=true.
   */
  send(str, { raw = false } = {}) {
    if (this.closed) throw new Error("session closed");
    this.child.stdin.write(raw ? str : str + "\n");
    return this;
  }

  /**
   * Wait until the stripped combined output matches `pattern`.
   * Rejects on timeout or process close.
   */
  waitFor(pattern, timeoutMs = 5000) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const combined = stripAnsi(this.stdoutBuf + this.stderrBuf);
    if (re.test(combined)) return Promise.resolve(combined);

    return new Promise((resolve, reject) => {
      const waiter = { re, resolve, reject };
      this._waiters.push(waiter);
      setTimeout(() => {
        const i = this._waiters.indexOf(waiter);
        if (i >= 0) {
          this._waiters.splice(i, 1);
          reject(
            new Error(
              `waitFor timeout after ${timeoutMs}ms looking for ${re}.\n` +
                `--- stdout ---\n${stripAnsi(this.stdoutBuf)}\n` +
                `--- stderr ---\n${stripAnsi(this.stderrBuf)}`,
            ),
          );
        }
      }, timeoutMs);
    });
  }

  /** Close stdin and wait for process exit. */
  close(timeoutMs = 5000) {
    if (this.closed) return Promise.resolve(this.exitCode);
    try {
      this.child.stdin.end();
    } catch {}
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        try {
          this.child.kill("SIGTERM");
        } catch {}
        reject(new Error(`close timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      this.child.once("close", (code) => {
        clearTimeout(to);
        resolve(code);
      });
    });
  }

  /** Force-kill with SIGKILL. */
  kill() {
    try {
      this.child.kill("SIGKILL");
    } catch {}
  }

  get stdout() {
    return stripAnsi(this.stdoutBuf);
  }
  get stderr() {
    return stripAnsi(this.stderrBuf);
  }
  get rawStdout() {
    return this.stdoutBuf;
  }
  get rawStderr() {
    return this.stderrBuf;
  }
}

/**
 * Spawn the CLI as an interactive session.
 *
 * @param {string[]} args
 * @param {{ env?: object, cwd?: string }} [opts]
 * @returns {CliSession}
 */
function spawnCli(args, opts = {}) {
  const { env = {}, cwd } = opts;
  const child = spawn(NODE, [BIN, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
    cwd,
  });
  return new CliSession(child);
}

module.exports = {
  BIN,
  NODE,
  runCli,
  spawnCli,
  stripAnsi,
  CliSession,
};

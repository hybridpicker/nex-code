/**
 * CLI Test Harness
 *
 * Shared helpers for testing bin/nex-code.js.
 *
 *   runCli(args, opts)     → one-shot: run to completion, return captured output
 *   spawnCli(args, opts)   → interactive CliSession (pipes): send/waitFor/close
 *   spawnCliPty(args, opts)→ interactive CliSession over a real PTY (needs node-pty)
 *   stripAnsi(str)         → remove ANSI color codes for stable assertions
 *
 * CliSession exposes waitFor (combined), waitForStdout, waitForStderr, send,
 * waitForExit, close, kill. Set NEX_HARNESS_DEBUG=1 to stream child output to
 * the parent's stderr for live diagnosis of timeouts.
 */

const { spawn, execFileSync } = require("child_process");
const path = require("path");

const BIN = path.join(__dirname, "..", "..", "bin", "nex-code.js");
const NODE = process.execPath;

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const DEBUG = !!process.env.NEX_HARNESS_DEBUG;

function stripAnsi(str) {
  return String(str).replace(ANSI_RE, "");
}

function debugLog(tag, chunk) {
  if (!DEBUG) return;
  const prefix = `[harness:${tag}] `;
  const text = String(chunk).replace(/\n(?!$)/g, "\n" + prefix);
  process.stderr.write(prefix + text);
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
 * Works with both pipe-based child_process.spawn and node-pty PTY handles.
 * The PTY adapter is passed in via the `pty` option and must expose
 * { onData(cb), onExit(cb), write(str), kill(sig) }.
 */
class CliSession {
  constructor(child, opts = {}) {
    this.child = child;
    this.pty = opts.pty || null;
    this.stdoutBuf = "";
    this.stderrBuf = "";
    this.closed = false;
    this.exitCode = null;
    this.signal = null;
    this._waiters = [];

    if (this.pty) {
      // node-pty merges stdout/stderr — route everything to stdoutBuf.
      this.pty.onData((d) => this._onData("stdout", d));
      this.pty.onExit(({ exitCode, signal }) => {
        this.closed = true;
        this.exitCode = exitCode;
        this.signal = signal || null;
        this._rejectAll(new Error("process closed"));
      });
    } else {
      child.stdout.setEncoding("utf-8");
      child.stderr.setEncoding("utf-8");
      child.stdout.on("data", (d) => this._onData("stdout", d));
      child.stderr.on("data", (d) => this._onData("stderr", d));
      child.on("close", (code, signal) => {
        this.closed = true;
        this.exitCode = code;
        this.signal = signal;
        this._rejectAll(new Error("process closed"));
      });
    }
  }

  _rejectAll(err) {
    for (const w of this._waiters) w.reject(err);
    this._waiters = [];
  }

  _onData(stream, chunk) {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    if (stream === "stdout") this.stdoutBuf += text;
    else this.stderrBuf += text;
    debugLog(stream, text);

    const combined = stripAnsi(this.stdoutBuf + this.stderrBuf);
    const outOnly = stripAnsi(this.stdoutBuf);
    const errOnly = stripAnsi(this.stderrBuf);
    const remaining = [];
    for (const w of this._waiters) {
      const source =
        w.stream === "stdout"
          ? outOnly
          : w.stream === "stderr"
            ? errOnly
            : combined;
      if (w.re.test(source)) w.resolve(source);
      else remaining.push(w);
    }
    this._waiters = remaining;
  }

  /**
   * Send a string to stdin. Appends "\n" unless raw=true.
   */
  send(str, { raw = false } = {}) {
    if (this.closed) throw new Error("session closed");
    const payload = raw ? str : str + "\n";
    if (this.pty) this.pty.write(payload);
    else this.child.stdin.write(payload);
    return this;
  }

  _waitForStream(stream, pattern, timeoutMs) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const source =
      stream === "stdout"
        ? stripAnsi(this.stdoutBuf)
        : stream === "stderr"
          ? stripAnsi(this.stderrBuf)
          : stripAnsi(this.stdoutBuf + this.stderrBuf);
    if (re.test(source)) return Promise.resolve(source);
    if (this.closed)
      return Promise.reject(
        new Error(
          `waitFor[${stream}] ${re} — process already closed.\n` +
            this._dump(),
        ),
      );

    return new Promise((resolve, reject) => {
      const waiter = { re, resolve, reject, stream };
      this._waiters.push(waiter);
      const to = setTimeout(() => {
        const i = this._waiters.indexOf(waiter);
        if (i >= 0) {
          this._waiters.splice(i, 1);
          reject(
            new Error(
              `waitFor[${stream}] timeout after ${timeoutMs}ms looking for ${re}.\n` +
                this._dump(),
            ),
          );
        }
      }, timeoutMs);
      // Clear the timeout as soon as we resolve — do not leak timers.
      const origResolve = waiter.resolve;
      waiter.resolve = (v) => {
        clearTimeout(to);
        origResolve(v);
      };
      const origReject = waiter.reject;
      waiter.reject = (e) => {
        clearTimeout(to);
        origReject(e);
      };
    });
  }

  /** Wait until the combined (stdout+stderr) stripped output matches pattern. */
  waitFor(pattern, timeoutMs = 5000) {
    return this._waitForStream("combined", pattern, timeoutMs);
  }

  /** Wait until the stdout stripped output matches pattern. */
  waitForStdout(pattern, timeoutMs = 5000) {
    return this._waitForStream("stdout", pattern, timeoutMs);
  }

  /** Wait until the stderr stripped output matches pattern. */
  waitForStderr(pattern, timeoutMs = 5000) {
    return this._waitForStream("stderr", pattern, timeoutMs);
  }

  _dump() {
    return (
      `--- stdout ---\n${stripAnsi(this.stdoutBuf)}\n` +
      `--- stderr ---\n${stripAnsi(this.stderrBuf)}`
    );
  }

  /** Wait for process exit without touching stdin. */
  waitForExit(timeoutMs = 5000) {
    if (this.closed) return Promise.resolve(this.exitCode);
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        reject(new Error(`waitForExit timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const onExit = (code) => {
        clearTimeout(to);
        resolve(typeof code === "number" ? code : this.exitCode);
      };
      if (this.pty) this.pty.onExit(({ exitCode }) => onExit(exitCode));
      else this.child.once("close", onExit);
    });
  }

  /** Close stdin (pipes) or send EOF (PTY) and wait for exit. */
  close(timeoutMs = 5000) {
    if (this.closed) return Promise.resolve(this.exitCode);
    try {
      if (this.pty) this.pty.write("\x04"); // EOT
      else this.child.stdin.end();
    } catch {}
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => {
        try {
          if (this.pty) this.pty.kill();
          else this.child.kill("SIGTERM");
        } catch {}
        reject(new Error(`close timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const onExit = (code) => {
        clearTimeout(to);
        resolve(typeof code === "number" ? code : this.exitCode);
      };
      if (this.pty) this.pty.onExit(({ exitCode }) => onExit(exitCode));
      else this.child.once("close", onExit);
    });
  }

  /** Force-kill with SIGKILL. */
  kill() {
    try {
      if (this.pty) this.pty.kill("SIGKILL");
      else this.child.kill("SIGKILL");
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
 * Spawn the CLI as an interactive session using pipes.
 *
 * @param {string[]} args
 * @param {{
 *   env?: object,         - extra env vars (merged into process.env)
 *   cwd?: string,         - working directory
 *   replaceEnv?: boolean, - when true, env REPLACES process.env instead of
 *                          extending it. Useful for wizard/setup tests that
 *                          must not inherit the host's API keys.
 * }} [opts]
 * @returns {CliSession}
 */
function spawnCli(args, opts = {}) {
  const { env = {}, cwd, replaceEnv = false } = opts;
  const finalEnv = replaceEnv ? { ...env } : { ...process.env, ...env };
  const child = spawn(NODE, [BIN, ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    env: finalEnv,
    cwd,
  });
  return new CliSession(child);
}

let _ptyMod = null;
let _ptyTried = false;
function loadPty() {
  if (_ptyTried) return _ptyMod;
  _ptyTried = true;
  try {
    _ptyMod = require("node-pty");
  } catch (e) {
    _ptyMod = null;
  }
  return _ptyMod;
}

/** True if node-pty is installed and usable in this environment. */
function hasPty() {
  return !!loadPty();
}

/**
 * Spawn the CLI under a real pseudo-TTY. Use for tests that need TTY
 * behavior (raw mode, keypress, color autodetection).
 *
 * Requires the optional `node-pty` dependency. Throws with a clear message
 * if it is not installed — callers should guard with `hasPty()` or skip the
 * test when unavailable.
 *
 * @param {string[]} args
 * @param {{
 *   env?: object, cwd?: string, replaceEnv?: boolean,
 *   cols?: number, rows?: number,
 * }} [opts]
 * @returns {CliSession}
 */
function spawnCliPty(args, opts = {}) {
  const pty = loadPty();
  if (!pty)
    throw new Error(
      "spawnCliPty requires the optional 'node-pty' dependency. " +
        "Install it with: npm install --no-save node-pty",
    );
  const {
    env = {},
    cwd,
    replaceEnv = false,
    cols = 80,
    rows = 24,
  } = opts;
  const finalEnv = replaceEnv ? { ...env } : { ...process.env, ...env };
  const proc = pty.spawn(NODE, [BIN, ...args], {
    name: "xterm-256color",
    cols,
    rows,
    cwd,
    env: finalEnv,
  });
  return new CliSession(null, { pty: proc });
}

module.exports = {
  BIN,
  NODE,
  runCli,
  spawnCli,
  spawnCliPty,
  hasPty,
  stripAnsi,
  CliSession,
};

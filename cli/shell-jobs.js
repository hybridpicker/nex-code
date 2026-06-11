/**
 * cli/shell-jobs.js — Background Shell Registry
 *
 * Manages long-running shell processes started via bash with
 * run_in_background. Output is buffered in memory (capped per shell);
 * the model polls new output with bash_output and terminates shells
 * with kill_shell. All running shells are killed when the CLI exits
 * so no orphan processes survive the session.
 */

const { spawn } = require("child_process");

// Max concurrently running background shells. Completed shells do not
// count — they are kept so their remaining output can still be read.
const MAX_RUNNING_SHELLS = 8;
// Per-shell output cap. When exceeded, the oldest output is dropped and
// the shell is flagged truncated.
const MAX_BUFFER_BYTES = 2 * 1024 * 1024;
// Grace period between SIGTERM and SIGKILL when killing a shell.
const KILL_GRACE_MS = 1500;

let _seq = 0;
/** @type {Map<string, object>} */
const shells = new Map();

/**
 * Append a chunk to a shell's output buffer, enforcing the byte cap.
 * @param {object} job
 * @param {string} text
 */
function _append(job, text) {
  job.output += text;
  if (job.output.length > MAX_BUFFER_BYTES) {
    const drop = job.output.length - MAX_BUFFER_BYTES;
    job.output = job.output.slice(drop);
    job.dropped += drop;
    job.truncated = true;
  }
}

/**
 * Kill a child's whole process group (the shell plus anything it spawned).
 * Falls back to killing just the child when group signaling fails.
 * @param {import('child_process').ChildProcess} child
 * @param {string} signal
 */
function _killGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // already gone
    }
  }
}

/**
 * Start a background shell.
 * @param {string} command - Shell command to run via `sh -c`.
 * @param {{ cwd?: string }} [opts]
 * @returns {{ id?: string, error?: string }}
 */
function startShell(command, opts = {}) {
  const running = [...shells.values()].filter((s) => s.status === "running");
  if (running.length >= MAX_RUNNING_SHELLS) {
    return {
      error:
        `Too many background shells running (${running.length}/${MAX_RUNNING_SHELLS}). ` +
        `Terminate one with kill_shell first. Running: ${running.map((s) => s.id).join(", ")}`,
    };
  }

  const id = `shell-${++_seq}`;
  let child;
  try {
    child = spawn("sh", ["-c", command], {
      cwd: opts.cwd || process.cwd(),
      // Own process group so kill_shell can terminate spawned children too
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    return { error: `Failed to start background shell: ${e.message}` };
  }

  const job = {
    id,
    command,
    child,
    output: "",
    dropped: 0, // bytes removed from the front of the buffer (cap overflow)
    readOffset: 0, // absolute offset already delivered via readShellOutput
    truncated: false,
    status: "running", // running | completed | failed | killed
    exitCode: null,
    killRequested: false,
    startedAt: Date.now(),
    endedAt: null,
  };

  child.stdout.on("data", (d) => _append(job, d.toString()));
  child.stderr.on("data", (d) => _append(job, d.toString()));
  child.on("error", (e) => {
    job.status = "failed";
    job.endedAt = Date.now();
    _append(job, `\n[spawn error: ${e.message}]\n`);
  });
  child.on("exit", (code, signal) => {
    if (job.status !== "failed") {
      job.status = job.killRequested
        ? "killed"
        : code === 0
          ? "completed"
          : "failed";
    }
    job.exitCode = code;
    if (signal) _append(job, `\n[terminated by ${signal}]\n`);
    job.endedAt = Date.now();
  });

  // Don't let background shells keep the event loop (and the CLI) alive
  try {
    child.unref();
    child.stdout.unref?.();
    child.stderr.unref?.();
  } catch {
    // unref is best-effort
  }

  shells.set(id, job);
  return { id };
}

/**
 * Format a one-line status header for a shell.
 * @param {object} job
 * @returns {string}
 */
function _statusLine(job) {
  const runtime = Math.round(((job.endedAt || Date.now()) - job.startedAt) / 1000);
  const state =
    job.status === "running"
      ? `running, ${runtime}s`
      : `${job.status}, exit ${job.exitCode === null ? "?" : job.exitCode}, ${runtime}s`;
  const cmd = job.command.length > 80 ? job.command.slice(0, 77) + "..." : job.command;
  return `Shell ${job.id} (${state}): ${cmd}`;
}

/**
 * Read new output from a background shell (since the previous read).
 * Returns a formatted string ready to use as a tool result.
 * @param {string} shellId
 * @param {{ filter?: string }} [opts] - Optional per-line regex filter.
 * @returns {string}
 */
function readShellOutput(shellId, opts = {}) {
  const job = shells.get(shellId);
  if (!job) {
    const known = [...shells.keys()];
    return `ERROR: No background shell with id "${shellId}".${known.length ? ` Known shells: ${known.join(", ")}` : " No background shells have been started."}`;
  }

  const localStart = Math.max(0, job.readOffset - job.dropped);
  let fresh = job.output.slice(localStart);
  const skippedNote =
    job.readOffset < job.dropped
      ? `\n[note: ${job.dropped - job.readOffset} bytes of output were dropped before this read (buffer cap)]`
      : "";
  job.readOffset = job.dropped + job.output.length;

  if (opts.filter) {
    let re;
    try {
      re = new RegExp(opts.filter);
    } catch (e) {
      return `ERROR: Invalid filter regex: ${e.message}`;
    }
    fresh = fresh
      .split("\n")
      .filter((l) => re.test(l))
      .join("\n");
  }

  const body = fresh.trim() ? fresh : "(no new output)";
  const hint =
    job.status === "running"
      ? "\n[still running — call bash_output again later for more output, or kill_shell to terminate]"
      : "";
  return `${_statusLine(job)}${skippedNote}\n---\n${body}${hint}`;
}

/**
 * Terminate a background shell (SIGTERM, then SIGKILL after a grace period).
 * @param {string} shellId
 * @returns {string}
 */
function killShell(shellId) {
  const job = shells.get(shellId);
  if (!job) {
    const known = [...shells.keys()];
    return `ERROR: No background shell with id "${shellId}".${known.length ? ` Known shells: ${known.join(", ")}` : ""}`;
  }
  if (job.status !== "running") {
    return `Shell ${shellId} already finished (${job.status}, exit ${job.exitCode}). Unread output can still be fetched with bash_output.`;
  }

  job.killRequested = true;
  _killGroup(job.child, "SIGTERM");
  const escalation = setTimeout(() => {
    if (job.status === "running") _killGroup(job.child, "SIGKILL");
  }, KILL_GRACE_MS);
  escalation.unref?.();

  return `Terminating shell ${shellId} (SIGTERM sent, SIGKILL after ${KILL_GRACE_MS}ms if needed). Fetch final output with bash_output.`;
}

/**
 * List all known background shells (running and finished).
 * @returns {Array<{ id: string, command: string, status: string, exitCode: number|null, runtimeMs: number }>}
 */
function listShells() {
  return [...shells.values()].map((j) => ({
    id: j.id,
    command: j.command,
    status: j.status,
    exitCode: j.exitCode,
    runtimeMs: (j.endedAt || Date.now()) - j.startedAt,
  }));
}

/**
 * Kill every running background shell. Used on session clear and process
 * exit — must stay synchronous so it works inside an "exit" handler.
 */
function killAllShells() {
  for (const job of shells.values()) {
    if (job.status !== "running") continue;
    job.killRequested = true;
    _killGroup(job.child, "SIGKILL");
    job.status = "killed";
    job.endedAt = Date.now();
  }
}

/**
 * Remove all shell records (after killing running ones). Test helper and
 * session-clear companion so stale ids don't leak into a new conversation.
 */
function clearShells() {
  killAllShells();
  shells.clear();
}

process.on("exit", killAllShells);

module.exports = {
  startShell,
  readShellOutput,
  killShell,
  listShells,
  killAllShells,
  clearShells,
};

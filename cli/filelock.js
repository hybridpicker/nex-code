/**
 * cli/filelock.js — Inter-process file locking utilities
 *
 * Provides two primitives for safe parallel nex-code sessions:
 *
 *   atomicWrite(filePath, content)
 *     Writes to a PID-unique temp file then renames it into place.
 *     Prevents other processes from reading half-written content.
 *
 *   withFileLockSync(filePath, fn, opts)
 *     Acquires an exclusive advisory lock (adjacent .lock file, O_EXCL),
 *     runs fn() in the critical section, then releases the lock.
 *     Stale locks from dead processes are automatically reclaimed.
 *     Safe to call from the Node.js main thread (uses Atomics.wait for sleep).
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Check whether a process is alive by sending signal 0.
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessRunning(pid) {
  if (!pid || isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means the process exists but we cannot signal it — still alive
    return err.code === "EPERM";
  }
}

/**
 * Synchronous sleep using Atomics.wait (Node 18+ main-thread compatible).
 * Falls back to a CPU-yield busy-wait if SharedArrayBuffer is unavailable.
 * @param {number} ms
 */
function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // Fallback: yield CPU for a short busy-wait
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* busy yield */
    }
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Write a file atomically via a PID-unique temp file + rename.
 * On POSIX, rename(2) is atomic within the same filesystem, so readers
 * always see either the old or the new content — never a partial write.
 *
 * @param {string} filePath — Destination file path
 * @param {string} content  — UTF-8 content to write
 */
function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.nex-tmp.${process.pid}.${Date.now()}`);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmp, content, "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

/**
 * Acquire an exclusive advisory lock on filePath, run fn(), release the lock.
 *
 * Lock mechanism:
 *   - Lock file = filePath + '.lock'
 *   - Created with O_EXCL (atomic creation, only one process succeeds)
 *   - Contains the holder's PID for stale-lock detection
 *   - Stale locks (PID no longer running) are reclaimed automatically
 *   - On timeout, the lock is force-removed and fn() runs anyway to avoid
 *     deadlocks (trade safety for liveness under extreme conditions)
 *
 * @param {string}   filePath         — File to lock (lock file adjacent)
 * @param {Function} fn               — Synchronous critical section
 * @param {object}   [opts]
 * @param {number}   [opts.timeout]   — Max wait ms before force-continue (default 5000)
 * @param {number}   [opts.retryMs]   — Sleep between retries (default 50)
 * @returns {*} Return value of fn()
 */
function withFileLockSync(filePath, fn, { timeout = 5000, retryMs = 50 } = {}) {
  const lockPath = filePath + ".lock";
  const deadline = Date.now() + timeout;

  while (true) {
    let fd = -1;
    try {
      // O_WRONLY | O_CREAT | O_EXCL — fails with EEXIST if lock already held
      fd = fs.openSync(lockPath, "wx");
      fs.writeSync(fd, Buffer.from(String(process.pid)));
      fs.closeSync(fd);
      fd = -1;

      // Lock acquired — execute critical section
      try {
        return fn();
      } finally {
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* best-effort */
        }
      }
    } catch (err) {
      if (fd !== -1) {
        try {
          fs.closeSync(fd);
        } catch {
          /* ignore */
        }
      }

      if (err.code !== "EEXIST") throw err;

      // Lock exists — check for stale lock (dead process)
      try {
        const raw = fs.readFileSync(lockPath, "utf-8").trim();
        const pid = parseInt(raw, 10);
        if (!isProcessRunning(pid)) {
          try {
            fs.unlinkSync(lockPath);
          } catch {
            /* may already be gone */
          }
          continue; // retry immediately
        }
      } catch (readErr) {
        // EISDIR / EACCES: the lock "file" is actually a directory or unreadable — propagate
        if (readErr.code && readErr.code !== "ENOENT") throw readErr;
        // ENOENT: lock file disappeared between EEXIST and readFileSync — retry
        continue;
      }

      if (Date.now() >= deadline) {
        // Timeout: force-remove stale lock and proceed to avoid deadlock
        try {
          fs.unlinkSync(lockPath);
        } catch {
          /* ignore */
        }
        return fn();
      }

      sleepSync(retryMs);
    }
  }
}

module.exports = { atomicWrite, withFileLockSync };

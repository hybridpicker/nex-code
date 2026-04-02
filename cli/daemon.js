"use strict";

/**
 * Daemon / watch mode for nex-code.
 * Watches the project for filesystem events and triggers tasks automatically.
 * Supports trigger types: file-change, git-commit, schedule.
 * No external dependencies — uses only Node.js built-ins.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── cron parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a limited cron subset to { intervalMs, initialDelayMs }.
 * Supported patterns:
 *   "* /N * * * *"  → every N minutes (no space before slash — shown here to avoid JSDoc confusion)
 *   "0 H * * *"    → daily at hour H (align initial fire, then 24h interval)
 * Returns null for unsupported syntax.
 */
function parseCronToMs(cron) {
  // Every N minutes: */N * * * *
  const everyN = cron.match(/^\*\/(\d+) \* \* \* \*$/);
  if (everyN) {
    const n = parseInt(everyN[1], 10);
    if (n > 0) return { intervalMs: n * 60 * 1000, initialDelayMs: 0 };
  }
  // Daily at hour H: 0 H * * *
  const dailyAt = cron.match(/^0 (\d+) \* \* \*$/);
  if (dailyAt) {
    const hour = parseInt(dailyAt[1], 10);
    const now = new Date();
    const next = new Date();
    next.setHours(hour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return {
      intervalMs: 24 * 60 * 60 * 1000,
      initialDelayMs: next.getTime() - now.getTime(),
    };
  }
  return null;
}

// ─── template expansion ───────────────────────────────────────────────────────

function expandTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] !== undefined ? vars[key] : match,
  );
}

// ─── logging ──────────────────────────────────────────────────────────────────

function appendLog(logFile, entry) {
  if (!logFile) return;
  try {
    const absLog = path.resolve(logFile);
    const dir = path.dirname(absLog);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Rotate when log exceeds 5 MB — truncate, don't delete
    try {
      const stat = fs.statSync(absLog);
      if (stat.size > MAX_LOG_SIZE) {
        fs.truncateSync(absLog, 0);
      }
    } catch {
      // File does not exist yet — that's fine
    }

    fs.appendFileSync(absLog, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    process.stderr.write(`[daemon] log write error: ${err.message}\n`);
  }
}

// ─── notifications ────────────────────────────────────────────────────────────

function notifyDesktop(title, message) {
  if (process.platform !== "darwin") return;
  try {
    const safeMsg = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safeTitle = title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    execSync(
      `osascript -e 'display notification "${safeMsg}" with title "${safeTitle}"'`,
      { stdio: "ignore" },
    );
  } catch {
    // Non-critical — desktop notify is best-effort
  }
}

function notifyMatrix(message) {
  const url = process.env.NEX_MATRIX_URL;
  const token = process.env.NEX_MATRIX_TOKEN;
  const room = process.env.NEX_MATRIX_ROOM;
  if (!url || !token || !room) return;

  try {
    const body = JSON.stringify({ msgtype: "m.text", body: message });
    const txnId = Date.now();
    const endpoint = `${url}/_matrix/client/r0/rooms/${encodeURIComponent(room)}/send/m.room.message/${txnId}`;
    const urlObj = new URL(endpoint);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options);
    req.on("error", () => {}); // silent — Matrix notify is best-effort
    req.write(body);
    req.end();
  } catch {
    // Non-critical
  }
}

function notify(channels, title, message) {
  if (!Array.isArray(channels)) return;
  if (channels.includes("desktop")) notifyDesktop(title, message);
  if (channels.includes("matrix"))
    notifyMatrix(`[nex daemon] ${title}: ${message}`);
}

// ─── task runner ──────────────────────────────────────────────────────────────

async function runTask(taskStr, autoConfirm, logFile, notifyChannels, triggerType) {
  const { processInput, clearConversation } = require("./agent");
  const startTime = Date.now();
  let status = "ok";
  let error = null;

  try {
    await processInput(taskStr, null, { autoConfirm });
  } catch (err) {
    status = "error";
    error = err.message;
    process.stderr.write(
      `[daemon] task error (${triggerType}): ${err.message}\n`,
    );
  } finally {
    clearConversation();
  }

  const durationMs = Date.now() - startTime;
  appendLog(logFile, {
    ts: new Date().toISOString(),
    trigger: triggerType,
    task: taskStr.slice(0, 200),
    status,
    error,
    durationMs,
  });

  const msg =
    status === "ok"
      ? `Task completed in ${durationMs}ms`
      : `Task failed: ${error}`;
  notify(notifyChannels, `nex daemon (${triggerType})`, msg);
}

// ─── ignore-pattern matching ──────────────────────────────────────────────────

function isIgnored(relPath, ignorePatterns) {
  const normalized = relPath.replace(/\\/g, "/");
  return ignorePatterns.some((pattern) => {
    // Strip leading "./" if present
    const p = pattern.replace(/^\.\//, "");
    if (p.endsWith("/**")) {
      const prefix = p.slice(0, -3);
      return normalized === prefix || normalized.startsWith(prefix + "/");
    }
    if (p.startsWith("**/")) {
      const suffix = p.slice(3);
      return normalized === suffix || normalized.endsWith("/" + suffix);
    }
    // Exact match or simple glob (no wildcards left)
    return normalized === p;
  });
}

// ─── trigger: file-change ─────────────────────────────────────────────────────

function setupFileChangeTrigger(trigger, config, cwd) {
  const { ignore = [], task, debounceMs = 2000, auto = true } = trigger;

  const pending = new Set();
  let debounceTimer = null;

  const fire = async () => {
    const files = [...pending];
    pending.clear();
    const expanded = expandTemplate(task, {
      changedFile: files[0] || "",
      changedFiles: files.join(", "),
    });
    await runTask(expanded, auto, config.logFile, config.notify, "file-change");
  };

  const onEvent = (_eventType, filename) => {
    if (!filename) return;
    const rel = filename.replace(/\\/g, "/");
    if (isIgnored(rel, ignore)) return;
    pending.add(rel);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fire, debounceMs);
  };

  try {
    return fs.watch(cwd, { recursive: true }, onEvent);
  } catch (err) {
    process.stderr.write(
      `[daemon] file-change watcher error: ${err.message}\n`,
    );
    return null;
  }
}

// ─── trigger: git-commit ──────────────────────────────────────────────────────

function setupGitCommitTrigger(trigger, config, cwd) {
  const { task, debounceMs = 0, auto = true } = trigger;

  const getHead = () => {
    try {
      return execSync("git log --format=%H -1", {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
    } catch {
      return null;
    }
  };

  const getSubject = () => {
    try {
      return execSync("git log --format=%s -1", {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
    } catch {
      return "";
    }
  };

  let lastHash = getHead();

  const poll = async () => {
    const current = getHead();
    if (!current || current === lastHash) return;
    const commitMessage = getSubject();
    lastHash = current;

    const fire = async () => {
      const expanded = expandTemplate(task, {
        commitHash: current,
        commitMessage,
      });
      await runTask(expanded, auto, config.logFile, config.notify, "git-commit");
    };

    if (debounceMs > 0) {
      setTimeout(fire, debounceMs);
    } else {
      await fire();
    }
  };

  return setInterval(poll, 10000);
}

// ─── trigger: schedule ────────────────────────────────────────────────────────

function setupScheduleTrigger(trigger, config) {
  const { cron, task, auto = true } = trigger;

  const parsed = parseCronToMs(cron);
  if (!parsed) {
    process.stderr.write(
      `[daemon] unsupported cron syntax: "${cron}" — skipping\n`,
    );
    return null;
  }

  const { intervalMs, initialDelayMs } = parsed;

  const fire = async () => {
    await runTask(task, auto, config.logFile, config.notify, "schedule");
  };

  if (initialDelayMs > 0) {
    // Fire at the aligned time, then every intervalMs
    return setTimeout(() => {
      fire();
      setInterval(fire, intervalMs);
    }, initialDelayMs);
  }
  return setInterval(fire, intervalMs);
}

// ─── main entry point ─────────────────────────────────────────────────────────

async function startDaemon(configPath, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const absConfigPath = path.resolve(cwd, configPath);

  // Load and validate config
  let config;
  try {
    const raw = fs.readFileSync(absConfigPath, "utf-8");
    config = JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      const example = JSON.stringify(
        {
          triggers: [
            {
              on: "file-change",
              glob: "**/*.{js,ts}",
              ignore: ["dist/**", "node_modules/**"],
              task: "run npm test -- --testPathPattern={changedFile} and report results",
              debounceMs: 2000,
              auto: true,
            },
          ],
          notify: ["desktop"],
          logFile: ".nex/daemon.log",
        },
        null,
        2,
      );
      process.stderr.write(
        `[daemon] config file not found: ${absConfigPath}\n\n` +
          `Create .nex/daemon.json with this example:\n${example}\n`,
      );
      throw new Error(`Config file not found: ${absConfigPath}`);
    }
    throw new Error(`Failed to load daemon config: ${err.message}`);
  }

  if (!config.triggers || !Array.isArray(config.triggers)) {
    throw new Error("daemon.json must have a 'triggers' array");
  }

  // Count triggers by type for startup banner
  const counts = { "file-change": 0, "git-commit": 0, "schedule": 0 };
  for (const t of config.triggers) {
    if (t.on in counts) counts[t.on]++;
  }

  const parts = [];
  if (counts["file-change"] > 0)
    parts.push(
      `${counts["file-change"]} file-change trigger${counts["file-change"] > 1 ? "s" : ""}`,
    );
  if (counts["git-commit"] > 0)
    parts.push(
      `${counts["git-commit"]} git-commit trigger${counts["git-commit"] > 1 ? "s" : ""}`,
    );
  if (counts["schedule"] > 0)
    parts.push(
      `${counts["schedule"]} schedule trigger${counts["schedule"] > 1 ? "s" : ""}`,
    );

  process.stdout.write(
    `nex daemon started  ·  config: ${configPath}\n` +
      `watching: ${parts.join(", ") || "no triggers"}\n` +
      `press Ctrl+C to stop\n`,
  );

  // Set up watchers / intervals
  const handles = [];
  for (const trigger of config.triggers) {
    let handle = null;
    switch (trigger.on) {
      case "file-change":
        handle = setupFileChangeTrigger(trigger, config, cwd);
        break;
      case "git-commit":
        handle = setupGitCommitTrigger(trigger, config, cwd);
        break;
      case "schedule":
        handle = setupScheduleTrigger(trigger, config);
        break;
      default:
        process.stderr.write(`[daemon] unknown trigger type: ${trigger.on}\n`);
    }
    if (handle) handles.push(handle);
  }

  // Graceful shutdown
  const shutdown = () => {
    process.stdout.write("\n[daemon] shutting down...\n");
    for (const h of handles) {
      try {
        if (h && typeof h.close === "function") h.close();
        else if (h) clearInterval(h);
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep the process alive — daemon runs until killed
  return new Promise(() => {});
}

module.exports = { startDaemon, parseCronToMs, expandTemplate, appendLog, notifyMatrix };

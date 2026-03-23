/**
 * server-mode.js — JSON-lines IPC server for the VS Code extension.
 *
 * Spawned by the extension as `nex-code --server`.
 * Reads newline-delimited JSON from stdin, writes newline-delimited JSON to stdout.
 * All TTY output (spinners, ANSI, etc.) is suppressed via NEX_SERVER=1.
 *
 * Protocol:
 *   stdin  → { type: "chat",    id, text }
 *           { type: "confirm",  id, answer }
 *           { type: "cancel" }
 *           { type: "clear" }
 *
 *   stdout → { type: "ready" }
 *           { type: "token",           id, text }
 *           { type: "tool_start",      id, tool, args }
 *           { type: "tool_end",        id, tool, summary, ok }
 *           { type: "confirm_request", id, question, tool, critical }
 *           { type: "done",            id }
 *           { type: "error",           id, message }
 */

"use strict";

const readline = require("readline");

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

/**
 * Start the JSON-lines server loop.
 * Does not return — keeps the process alive via readline.
 */
function startServerMode() {
  // Suppress TTY rendering (spinners, ANSI colors, footer, etc.)
  process.env.NEX_SERVER = "1";

  // Redirect console.log/warn/error to stderr so they don't corrupt the JSON-lines stdout protocol.
  // The extension reads stderr into its Output channel where these are still visible for debugging.
  const toStderr = (...args) =>
    process.stderr.write(args.map(String).join(" ") + "\n");
  console.log = toStderr;
  console.warn = toStderr;
  console.info = toStderr;
  // Keep console.error on stderr (it already goes there)

  // Override confirm() so critical tool confirmations are routed through the extension
  const { setConfirmHook } = require("./safety");

  // Map of pending confirmations: confirm-id → resolve function
  const pendingConfirms = new Map();
  let confirmSeq = 0;

  setConfirmHook((question, opts) => {
    const id = "cfm-" + ++confirmSeq;
    const toolName = opts?.toolName || "";

    // Determine if this is a critical confirmation (matches CRITICAL_BASH patterns)
    let critical = false;
    try {
      const { isCritical } = require("./safety");
      critical = isCritical(question);
    } catch {
      /* ignore */
    }

    emit({ type: "confirm_request", id, question, tool: toolName, critical });

    return new Promise((resolve) => {
      pendingConfirms.set(id, resolve);
    });
  });

  // Current active message id (for token/tool events)
  let activeMsgId = null;

  // Build server hooks passed to processInput
  const serverHooks = {
    onToken(text) {
      if (activeMsgId) {
        emit({ type: "token", id: activeMsgId, text });
      }
    },
    onThinkingToken() {
      // Thinking tokens are not forwarded to the webview (no display value)
    },
    onToolStart(toolName, args) {
      if (activeMsgId) {
        emit({
          type: "tool_start",
          id: activeMsgId,
          tool: toolName,
          args: args || {},
        });
      }
    },
    onToolEnd(toolName, summary, ok) {
      if (activeMsgId) {
        emit({
          type: "tool_end",
          id: activeMsgId,
          tool: toolName,
          summary: summary || "",
          ok: !!ok,
        });
      }
    },
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: null,
    terminal: false,
  });

  // Signal ready after setting up readline
  emit({ type: "ready" });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch {
      return; // ignore malformed lines
    }

    switch (msg.type) {
      case "chat": {
        const msgId = msg.id || "msg-" + Date.now();
        activeMsgId = msgId;

        const { processInput } = require("./agent");
        try {
          await processInput(msg.text, serverHooks);
          emit({ type: "done", id: msgId });
        } catch (err) {
          emit({
            type: "error",
            id: msgId,
            message: err?.message || String(err),
          });
        } finally {
          activeMsgId = null;
        }
        break;
      }

      case "confirm": {
        const resolve = pendingConfirms.get(msg.id);
        if (resolve) {
          pendingConfirms.delete(msg.id);
          resolve(!!msg.answer);
        }
        break;
      }

      case "cancel": {
        // Resolve all pending confirmations with false
        for (const [id, resolve] of pendingConfirms) {
          pendingConfirms.delete(id);
          resolve(false);
        }
        break;
      }

      case "clear": {
        const { clearConversation } = require("./agent");
        clearConversation();
        // Also reject any pending confirms
        for (const [id, resolve] of pendingConfirms) {
          pendingConfirms.delete(id);
          resolve(false);
        }
        break;
      }

      default:
        break;
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

module.exports = { startServerMode };

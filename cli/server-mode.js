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

function summarizeAssistantText(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  const firstParagraph = normalized.split(/\n\s*\n/)[0].trim();
  return firstParagraph.slice(0, 2000);
}

function looksLikeUnfinishedInvestigation(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized) return false;

  const claimsCompletion =
    /\b(done|complete|completed|fixed|implemented|updated|verified|changed|added|created|wrote|passed|successfully)\b/i.test(
      normalized,
    );
  if (claimsCompletion) return false;

  return (
    /\b(?:i'll|i will|let me|i need to)\b.{0,120}\b(?:check|inspect|read|search|find|look at|understand)\b/i.test(
      normalized,
    ) &&
    /(?:first|current|specific|actual|structure|section|file|content|:)\s*$/i.test(
      normalized,
    )
  );
}

function looksLikeCompletedWork(text) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (/\b(not verified|not run|could not|failed|stalled|stopping without)\b/i.test(normalized)) {
    return false;
  }
  return (
    /\b(updated|changed|added|created|implemented|fixed|wrote|includes|contains)\b/i.test(normalized) &&
    /\b(verified|passed|complete|completed|done|successfully|now includes|now contains)\b/i.test(normalized)
  );
}

function classifyTurnOutcome(turnMessages) {
  const assistantMessages = Array.isArray(turnMessages)
    ? turnMessages
        .filter(
          (msg) => msg && msg.role === "assistant" && typeof msg.content === "string",
        )
        .map((msg) => String(msg.content).trim())
        .filter(Boolean)
    : [];

  const lastAssistant = assistantMessages[assistantMessages.length - 1] || "";
  if (!lastAssistant) {
    return {
      status: "stalled",
      success: false,
      summary: "The run stopped without a final assistant response.",
    };
  }

  const explicitStall =
    /\b(implementation stalled before edits|stopping without|no safe task found|not verified|could not find the target|no actionable items|nothing actionable found)\b/i.test(
      lastAssistant,
    );
  if (explicitStall) {
    const priorCompletion = assistantMessages
      .slice(0, -1)
      .reverse()
      .find(looksLikeCompletedWork);
    if (priorCompletion) {
      return {
        status: "complete",
        success: true,
        summary: summarizeAssistantText(priorCompletion),
      };
    }
    return {
      status: "stalled",
      success: false,
      summary: summarizeAssistantText(lastAssistant),
    };
  }

  if (looksLikeUnfinishedInvestigation(lastAssistant)) {
    return {
      status: "stalled",
      success: false,
      summary: summarizeAssistantText(lastAssistant),
    };
  }

  return {
    status: "complete",
    success: true,
    summary: summarizeAssistantText(lastAssistant),
  };
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
  let activeRun = null;

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

  // ─── ask_user handler for server mode ──────────────────────────────────────
  const { setAskUserHandler } = require("./tools");
  const { setAbortSignalGetter } = require("./agent");
  if (typeof setAbortSignalGetter === "function") {
    setAbortSignalGetter(() => activeRun?.controller?.signal || null);
  }
  setAskUserHandler(async (question, options) => {
    const id = "ask-" + ++confirmSeq;
    emit({
      type: "confirm_request",
      id,
      question,
      options: options || [],
      tool: "ask_user",
    });

    return new Promise((resolve) => {
      pendingConfirms.set(id, (answer) => {
        // If answer is a boolean from a confirm dialog, map it to options or just return it as string
        if (typeof answer === "boolean") {
          resolve(answer ? (options?.[0] || "Yes") : (options?.[1] || "No"));
        } else {
          resolve(String(answer));
        }
      });
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
        if (activeRun) {
          emit({
            type: "error",
            id: msg.id || "msg-" + Date.now(),
            message: "A run is already active.",
          });
          break;
        }
        const msgId = msg.id || "msg-" + Date.now();
        activeMsgId = msgId;
        activeRun = {
          id: msgId,
          controller: new AbortController(),
          cancelEmitted: false,
        };

        const {
          processInput,
          getConversationMessages,
        } = require("./agent");
        try {
          const beforeSnapshot = getConversationMessages?.();
          const beforeMessages = Array.isArray(beforeSnapshot)
            ? beforeSnapshot
            : [];
          const beforeCount = beforeMessages.length;
          await processInput(msg.text, serverHooks, { serverMode: true });
          const afterSnapshot = getConversationMessages?.();
          const afterMessages = Array.isArray(afterSnapshot)
            ? afterSnapshot
            : [];
          const outcome = classifyTurnOutcome(afterMessages.slice(beforeCount));
          if (!activeRun?.cancelEmitted) {
            emit({ type: "done", id: msgId, ...outcome });
          }
        } catch (err) {
          if (!activeRun?.cancelEmitted) {
            emit({
              type: "error",
              id: msgId,
              message: err?.message || String(err),
            });
          }
        } finally {
          activeMsgId = null;
          activeRun = null;
        }
        break;
      }

      case "confirm": {
        const resolve = pendingConfirms.get(msg.id);
        if (resolve) {
          pendingConfirms.delete(msg.id);
          resolve(msg.answer);
        }
        break;
      }

      case "cancel": {
        // Resolve all pending confirmations with false
        for (const [id, resolve] of pendingConfirms) {
          pendingConfirms.delete(id);
          resolve(false);
        }
        if (activeRun && !activeRun.cancelEmitted) {
          activeRun.cancelEmitted = true;
          activeRun.controller.abort();
          emit({
            type: "done",
            id: activeRun.id,
            status: "cancelled",
            success: false,
            summary: "Run cancelled by user.",
          });
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

module.exports = {
  startServerMode,
  classifyTurnOutcome,
  summarizeAssistantText,
  looksLikeUnfinishedInvestigation,
};

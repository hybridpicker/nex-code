#!/usr/bin/env node
/**
 * Nex Code — Agentic Coding CLI
 * Entrypoint: loads .env, parses CLI flags, starts REPL or headless mode.
 */

const path = require("path");
const os = require("os");

// Load .env from CLI install dir (fallback) and project dir.
// NEX_NO_DOTENV=1 skips all .env loading — used by interactive tests that
// need a clean environment without host config leaking in.
if (process.env.NEX_NO_DOTENV !== "1") {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
  // Load from global ~/.nex-code/.env (benchmark routing, API keys).
  // override:true because this file is the authoritative nex-code config —
  // without it, a stale OLLAMA_API_KEY inherited from a long-running systemd
  // parent silently wins over a freshly-rotated key in the config file.
  require("dotenv").config({
    path: path.join(os.homedir(), ".nex-code", ".env"),
    override: true,
  });
  require("dotenv").config(); // Also check CWD (non-override — user project wins)
}

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");

// ─── --help / -h ──────────────────────────────────────────────
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: nex-code [options]

Options:
  --task <prompt>          Run a single task and exit (headless mode)
  --prompt <prompt>        Alias for --task
  --prompt-file <path>     Read prompt from file and run headless (avoids shell escaping)
  --delete-prompt-file     Delete the prompt file after reading (use with --prompt-file)
  --auto                   Skip all confirmations (implies --task / --prompt-file)
  --flatrate               Flatrate mode: 100 turns, 6 parallel agents, 5 retries (auto on with OLLAMA_API_KEY)
  --yolo, -yolo            Skip all confirmations (interactive YOLO mode)
  --gemini, -gemini        Local Gemini test mode — uses Google Gemini provider
                           (default model: gemini-3.1-pro-preview, requires GEMINI_API_KEY)
  --gemini-model <id>      Override the Gemini model (implies --gemini)
  --server                 Start JSON-lines IPC server (used by VS Code extension)
  --daemon [config]        Run as background watcher (reads .nex/daemon.json)
  --watch [config]         Alias for --daemon
  --model <spec>           Set model (e.g. openai:gpt-4o)
  --max-turns <n>          Max agentic loop iterations (default: 50)
  --scope <files>          Restrict file edits to these files/dirs (comma-separated, globs ok)
                           e.g. --scope 'src/index.js,src/components/*.tsx'
  --decompose              Shell alias hint: multi-file tasks work best as
                           sequential single-file runs. Use a shell loop:
                           for f in a.js b.js; do nex-code --scope "$f" --task "..." --auto; done
  --orchestrate            Use multi-agent orchestrator (with --task)
  --no-auto-orchestrate    Disable auto-orchestration for multi-goal prompts (on by default)
  --orchestrator-model <m> Model for orchestrator (default: kimi-k2.5)
  --resume                 Resume last session (explicit only — no auto-resume)
  --debug                  Show internal diagnostic messages (compression, loop detection, guards)
  --json                   Output result as JSON (for CI parsing)
  --mcp-config <path>      Path to MCP server config (default: .nex/mcp.json)
  -h, --help               Show this help
  -v, --version            Show version
`);
  process.exit(0);
}

// ─── --version / -v ───────────────────────────────────────────
if (args.includes("-v") || args.includes("--version")) {
  const pkg = require("../package.json");
  console.log(pkg.version);
  process.exit(0);
}

// ─── --server (Desktop / VS Code extension IPC mode) ─────────
// Must run before any interactive/headless startup side effects. Desktop
// expects stdout to contain only JSON-lines protocol messages.
if (args.includes("--server")) {
  process.env.NEX_SERVER = "1";
  const { setAutoConfirm } = require("../cli/safety");
  setAutoConfirm(true); // non-critical tools auto-confirm in server mode
  require("../cli/server-mode").startServerMode();
  return; // event loop keeps process alive — no further code should run
}

// ─── --yolo / -yolo ──────────────────────────────────────────
const yoloMode = args.includes("--yolo") || args.includes("-yolo");
if (yoloMode) {
  const { setAutoConfirm } = require("../cli/safety");
  setAutoConfirm(true);
}

// ─── .nex/config.json yolo fallback ──────────────────────────
if (!yoloMode) {
  try {
    const fs = require("fs");
    const configPath = path.join(process.cwd(), ".nex", "config.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg.yolo === true) {
        const { setAutoConfirm } = require("../cli/safety");
        setAutoConfirm(true);
      }
    }
  } catch {
    /* ignore malformed config */
  }
}

// ─── Detect --gemini early so other modes can skip Ollama-specific tuning ──
const _geminiModelIdxEarly = args.indexOf("--gemini-model");
const _geminiModeEarly =
  args.includes("--gemini") ||
  args.includes("-gemini") ||
  _geminiModelIdxEarly !== -1;
const _modelIdxEarly = args.indexOf("--model");
const _modelSpecEarly =
  _modelIdxEarly !== -1 && args[_modelIdxEarly + 1]
    ? args[_modelIdxEarly + 1]
    : "";
const _modelProviderEarly = (() => {
  const prefix = _modelSpecEarly.split(":")[0];
  const known = ["ollama", "openai", "deepseek", "anthropic", "gemini", "local", "mock"];
  // Direct match (e.g. "ollama:qwen3-coder" → "ollama")
  if (known.includes(prefix)) return prefix;
  // Fuzzy match for un-prefixed model IDs (e.g. "deepseek-v4-pro" → "deepseek")
  for (const k of known) {
    if (_modelSpecEarly.startsWith(k)) return k;
  }
  return null;
})();
const _defaultProviderEarly = process.env.DEFAULT_PROVIDER || "ollama";
const _autoFlatrateAllowed =
  _modelProviderEarly !== null
    ? _modelProviderEarly === "ollama"
    : _defaultProviderEarly === "ollama";

// ─── Flatrate mode ────────────────────────────────────────────
// Auto-activates when OLLAMA_API_KEY is set (Ollama Cloud flatrate plan)
// or via explicit --flatrate flag. Shifts optimization from "minimize tokens"
// to "maximize correctness": more iterations, more parallel agents, more retries.
// Skipped under non-Ollama providers since flatrate is an Ollama-Cloud-specific plan.
const flatrateMode =
  !_geminiModeEarly &&
  (args.includes("--flatrate") ||
    (!!process.env.OLLAMA_API_KEY &&
      !process.env.NEX_NO_FLATRATE &&
      _autoFlatrateAllowed));
if (flatrateMode) {
  // Set env vars before any module loads — sub-agent.js and orchestrator.js
  // read these at require-time to configure their constants.
  if (!process.env.NEX_MAX_PARALLEL) process.env.NEX_MAX_PARALLEL = "6";
  if (!process.env.NEX_MAX_SUBTASKS) process.env.NEX_MAX_SUBTASKS = "10";
  if (!process.env.NEX_MAX_CHAT_RETRIES) process.env.NEX_MAX_CHAT_RETRIES = "5";
  // Prefer other Ollama Cloud models before falling back to external providers
  if (!process.env.OLLAMA_FALLBACK_CHAIN) {
    process.env.OLLAMA_FALLBACK_CHAIN = "ministral-3:8b,qwen3-vl:235b-instruct,devstral-small-2:24b";
  }
  if (!jsonMode) {
    process.stderr.write(
      "\x1b[38;2;80;210;120m◆\x1b[0m \x1b[1mFlatrate mode\x1b[0m\x1b[2m — 100 turns · 6 parallel agents · 5 retries · verify-on\x1b[0m\n",
    );
  }
}

// ─── --model ──────────────────────────────────────────────────
const modelIdx = args.indexOf("--model");
if (modelIdx !== -1 && args[modelIdx + 1]) {
  const { setActiveModel } = require("../cli/providers/registry");
  const modelSpec = args[modelIdx + 1];
  const ok = setActiveModel(modelSpec);
  if (!ok) {
    console.error(`\x1b[31mError:\x1b[0m Unknown model '${modelSpec}'.`);
    process.exit(1);
  }
  const parsedProvider = (() => {
    const prefix = modelSpec.split(":")[0];
    return [
      "ollama",
      "openai",
      "deepseek",
      "anthropic",
      "gemini",
      "local",
      "mock",
    ].includes(prefix)
      ? prefix
      : null;
  })();
  const bareModel = parsedProvider
    ? modelSpec.slice(parsedProvider.length + 1)
    : modelSpec;
  process.env.NEX_FORCE_MODEL = bareModel;
  process.env.NEX_PHASE_ROUTING = "0";
  process.env.DEFAULT_MODEL = bareModel;
  if (parsedProvider) process.env.DEFAULT_PROVIDER = parsedProvider;
}

// ─── --gemini / -gemini (local Gemini test mode) ─────────────
// Switches the active provider to Google Gemini and uses the latest preview
// model by default. Intended for trying the newest Gemini on this machine
// without touching the project's normal model routing.
const geminiModelIdx = args.indexOf("--gemini-model");
const geminiMode =
  args.includes("--gemini") ||
  args.includes("-gemini") ||
  geminiModelIdx !== -1;
if (geminiMode) {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error(
      "\x1b[31mError:\x1b[0m --gemini requires GEMINI_API_KEY (or GOOGLE_API_KEY) to be set.",
    );
    process.exit(1);
  }
  const geminiModel =
    geminiModelIdx !== -1 && args[geminiModelIdx + 1]
      ? args[geminiModelIdx + 1]
      : "gemini-3.1-pro-preview";
  // Hard-override every routing source so the agent cannot fall back to an
  // Ollama-only model ID and POST it against Gemini's endpoint (would 404).
  // task-router.js short-circuits getModelForCategory/Phase on NEX_FORCE_MODEL.
  process.env.NEX_FORCE_MODEL = geminiModel;
  process.env.NEX_PHASE_ROUTING = "0";
  process.env.DEFAULT_PROVIDER = "gemini";
  process.env.DEFAULT_MODEL = geminiModel;
  process.env.NEX_FALLBACK_MODEL = geminiModel;
  // Drop conflicting per-category env vars inherited from ~/.nex-code/.env
  for (const k of [
    "NEX_ROUTE_CODING",
    "NEX_ROUTE_FRONTEND",
    "NEX_ROUTE_SYSADMIN",
    "NEX_ROUTE_DATA",
    "NEX_ROUTE_AGENTIC",
    "NEX_PHASE_PLAN_MODEL",
    "NEX_PHASE_IMPLEMENT_MODEL",
    "NEX_PHASE_VERIFY_MODEL",
    "OLLAMA_FALLBACK_CHAIN",
  ]) {
    delete process.env[k];
  }
  const { setActiveModel } = require("../cli/providers/registry");
  const ok = setActiveModel(`gemini:${geminiModel}`);
  if (!ok) {
    console.error(
      `\x1b[31mError:\x1b[0m Unknown Gemini model '${geminiModel}'.`,
    );
    process.exit(1);
  }
  if (!jsonMode) {
    process.stderr.write(
      `\x1b[38;2;138;180;248m◆\x1b[0m \x1b[1mGemini mode\x1b[0m\x1b[2m — provider=gemini · model=${geminiModel} · routing locked\x1b[0m\n`,
    );
  }
}

// ─── --scope (restrict file edits to specific files) ──────────
// Set NEX_SCOPE env var so agent.js prepareToolCall can enforce it.
// Supports comma-separated paths and globs, e.g. --scope 'src/index.js,src/*.tsx'
const scopeIdx = args.indexOf("--scope");
if (scopeIdx !== -1 && args[scopeIdx + 1] && !args[scopeIdx + 1].startsWith("--")) {
  process.env.NEX_SCOPE = args[scopeIdx + 1];
}

// ─── --max-turns (flag or .nex/config.json) ──────────────────
const maxTurnsIdx = args.indexOf("--max-turns");
if (maxTurnsIdx !== -1 && args[maxTurnsIdx + 1]) {
  const n = parseInt(args[maxTurnsIdx + 1], 10);
  if (n > 0) {
    const { setMaxIterations } = require("../cli/agent");
    setMaxIterations(n);
  }
} else {
  // Fall back to .nex/config.json { "maxIterations": N }
  try {
    const fs = require("fs");
    const configPath = path.join(process.cwd(), ".nex", "config.json");
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const n = parseInt(cfg.maxIterations, 10);
      if (n > 0) {
        const { setMaxIterations } = require("../cli/agent");
        setMaxIterations(n);
      }
    }
  } catch {
    /* ignore malformed config */
  }
}

// ─── --mcp-config ─────────────────────────────────────────────
const mcpConfigIdx = args.indexOf("--mcp-config");
if (mcpConfigIdx !== -1 && args[mcpConfigIdx + 1]) {
  // Store path in env so mcp-client can pick it up without extra wiring
  process.env.NEX_MCP_CONFIG = args[mcpConfigIdx + 1];
}

// ─── macOS: prevent sleep while running ──────────────────────
function preventSleep() {
  if (process.platform !== "darwin") return;
  try {
    const { spawn } = require("child_process");
    // -i: prevent idle sleep, -m: prevent disk sleep
    const child = spawn("caffeinate", ["-i", "-m"], {
      stdio: "ignore",
      detached: false,
    });
    child.unref();
    const kill = () => {
      try {
        child.kill();
      } catch {
        /* already dead */
      }
    };
    process.on("exit", kill);
    process.on("SIGINT", kill);
    process.on("SIGTERM", kill);
  } catch {
    /* caffeinate unavailable, no-op */
  }
}

// ─── first-run interactive setup ─────────────────────────────
async function checkSetup() {
  const { runSetupWizard } = require("../cli/setup");
  await runSetupWizard();
}

function emitJsonLine(obj, write = process.stdout.write.bind(process.stdout)) {
  write(JSON.stringify(obj) + "\n");
}

function emitJsonLineSync(obj) {
  const fs = require("fs");
  fs.writeSync(1, JSON.stringify(obj) + "\n");
}

function stripAnsi(text) {
  const { stripAnsiControlSequences } = require("../cli/format");
  return stripAnsiControlSequences(text);
}

function getAssistantText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block) return "";
      if (typeof block === "string") return block;
      if (block.type === "text") return block.text || "";
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function hasAssistantToolCalls(message) {
  if (!message || message.role !== "assistant") return false;
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    return true;
  }
  return Array.isArray(message.content) &&
    message.content.some((block) => block && block.type === "tool_use");
}

function looksLikeFailedHeadlessConclusion(text) {
  const sample = String(text || "").trim();
  if (!sample) return false;
  return (
    /stopping without reporting success/i.test(sample) ||
    /^verification incomplete\./i.test(sample) ||
    /^implementation incomplete\./i.test(sample)
  );
}

function cleanToolSummary(summary) {
  const lines = stripAnsi(summary || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  return lines[0]
    .replace(/^[│↩]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countToolCalls(messages) {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((total, msg) => {
    if (!msg || msg.role !== "assistant") return total;
    if (Array.isArray(msg.tool_calls)) return total + msg.tool_calls.length;
    if (Array.isArray(msg.content)) {
      return (
        total +
        msg.content.filter((block) => block && block.type === "tool_use").length
      );
    }
    return total;
  }, 0);
}

function countWriteToolCalls(messages) {
  if (!Array.isArray(messages)) return 0;
  const writeTools = new Set(["write_file", "edit_file", "patch_file"]);
  return messages.reduce((total, msg) => {
    if (!msg || msg.role !== "assistant") return total;
    const toolCalls =
      msg.tool_calls ||
      (Array.isArray(msg.content)
        ? msg.content.filter((block) => block && block.type === "tool_use")
        : []);
    return (
      total +
      toolCalls.filter((tc) => {
        const name = tc?.function?.name || tc?.name || "";
        return writeTools.has(name);
      }).length
    );
  }, 0);
}

function createJsonModeHooks() {
  process.env.NEX_SERVER = "1";
  let streamedText = "";
  // Track pending tool calls with per-call sequence numbers so
  // onToolEnd can remove the exact entry, not the last match.
  let _toolSeq = 0;
  const _toolIds = new Map(); // callId → pendingTools index
  const pendingTools = [];
  let terminalEventEmitted = false;
  let lastJsonEventType = "";
  let restored = false;

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    info: console.info,
    error: console.error,
  };
  const originalExit = process.exit.bind(process);
  const passthroughStdout = process.stdout.write;
  const passthroughStderr = process.stderr.write;

  function swallowWrite(_chunk, encoding, cb) {
    let callback = cb;
    if (typeof encoding === "function") callback = encoding;
    if (typeof callback === "function") callback();
    return true;
  }

  process.stdout.write = swallowWrite;
  process.stderr.write = swallowWrite;
  process.exit = (code = 0) => {
    // Intercept ALL exit codes. If no terminal event has been emitted,
    // tools are still pending, OR the last event was a dangling tool_start,
    // force a fail-closed error so JSON consumers never see an incomplete
    // stream without a terminal done/error event.
    if (
      !isTerminalJsonEvent() ||
      pendingTools.length > 0 ||
      lastJsonEventType === "tool_start"
    ) {
      emitFailClosedLifecycleError(
        lastJsonEventType === "tool_start" && pendingTools.length === 0
          ? `Last event was a dangling tool_start with no matching tool_end.`
          : "",
      );
      return originalExit(process.exitCode || 1);
    }
    return originalExit(code);
  };

  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.error = () => {};

  function restore() {
    if (restored) return;
    restored = true;
    process.stdout.write = passthroughStdout;
    process.stderr.write = passthroughStderr;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
    console.error = originalConsole.error;
    // Keep the process.exit override active — it is the
    // authoritative gate for terminal JSON events. Without it,
    // process.exit(0) from finishSuccess/finishError can bypass
    // the pending-tool check and leave a dangling tool_start.
    process.removeListener("beforeExit", failClosedBeforeExit);
    process.removeListener("uncaughtException", failClosedOnFatal);
    process.removeListener("unhandledRejection", failClosedOnFatal);
  }

  function buildFailClosedError(detail = "") {
    const names = pendingTools.map((entry) => entry.tool).join(", ");
    if (names) {
      return (
        `Headless run ended with unfinished tool call(s): ${names}. ` +
        "Stopping to avoid a false success." +
        (detail ? ` ${detail}` : "")
      );
    }
    return (
      "Headless JSON run ended before emitting a final done/error event. " +
      "Stopping to avoid a false success." +
      (detail ? ` ${detail}` : "")
    );
  }

  function isTerminalJsonEvent() {
    return lastJsonEventType === "done" || lastJsonEventType === "error";
  }

  function emitTerminalJsonEventSync(event) {
    if (terminalEventEmitted) return;
    terminalEventEmitted = true;
    lastJsonEventType = event?.type || "";
    process.exitCode =
      event?.type === "done" && event.success !== false ? 0 : 1;
    emitJsonLineSync(event);
  }

  // ─── Pending-tools watchdog ────────────────────────────────────
  // If the agent loop exits or stalls while tools are still pending,
  // this timer forces a fail-closed terminal error so JSON consumers
  // never see a dangling tool_start without a matching done/error.
  // Default 60s — generous enough for slow npm install/lint runs in
  // sandboxes, but still catches genuinely stalled tool executions.
  const PENDING_TOOLS_WATCHDOG_MS = Math.max(
    5000,
    parseInt(process.env.NEX_PENDING_TOOLS_WATCHDOG_MS, 10) || 60000,
  );
  let _pendingWatchdogTimer = null;
  const _pendingToolStartTimes = new Map(); // callId → Date.now()

  function _startPendingWatchdog() {
    if (_pendingWatchdogTimer) return;
    _pendingWatchdogTimer = setInterval(() => {
      if (terminalEventEmitted || restored) {
        _stopPendingWatchdog();
        return;
      }
      if (pendingTools.length === 0) {
        // No pending tools — nothing to watchdog.
        return;
      }
      // Only fire when at least one pending tool has been stuck for
      // the full watchdog duration. Tools that were just started
      // (e.g. a slow npm command) get their full timeout before we
      // sound the alarm.
      const now = Date.now();
      let oldestStuckMs = 0;
      for (const entry of pendingTools) {
        const started = _pendingToolStartTimes.get(entry.callId);
        if (started != null) {
          const stuck = now - started;
          if (stuck > oldestStuckMs) oldestStuckMs = stuck;
        }
      }
      if (oldestStuckMs < PENDING_TOOLS_WATCHDOG_MS) return;
      // Force-stop: emit terminal error and kill the process.
      // After this the agent loop must not continue.
      emitFailClosedLifecycleError(
        `Pending tool call(s) unresolved for >${PENDING_TOOLS_WATCHDOG_MS / 1000}s: ` +
          pendingTools.map((e) => e.tool).join(", "),
      );
      // emitFailClosedLifecycleError restores process.exit to
      // the real exit. Call it now so the process stops.
      originalExit(process.exitCode || 1);
    }, 2000);
  }

  function _stopPendingWatchdog() {
    if (_pendingWatchdogTimer) {
      clearInterval(_pendingWatchdogTimer);
      _pendingWatchdogTimer = null;
    }
  }

  function emitFailClosedLifecycleError(detail = "") {
    if (terminalEventEmitted) return;
    const error = buildFailClosedError(detail);
    restore();
    emitTerminalJsonEventSync({
      type: "error",
      success: false,
      error,
    });
  }

  function failClosedBeforeExit() {
    // beforeExit fires when the event loop empties — which can happen
    // between API calls in the agent loop. Do NOT force-fail here;
    // the exit listener, process.exit override, and watchdog timer
    // are the authoritative fail-closed paths. Only clean up timer
    // resources.
    _stopPendingWatchdog();
  }

  function failClosedOnExit(code) {
    if (isTerminalJsonEvent()) return;
    // Emit terminal error synchronously — the exit handler runs in a
    // sync-only context, so use the sync emit path.
    emitTerminalJsonEventSync({
      type: "error",
      success: false,
      error: buildFailClosedError(
        code ? `Process exited with code ${code}.` : "",
      ),
      pendingTools: pendingTools.length > 0 ? pendingTools.map((e) => e.tool) : undefined,
    });
  }

  function failClosedOnFatal(err) {
    const message = err?.message || String(err || "");
    _stopPendingWatchdog();
    emitFailClosedLifecycleError(message ? `Fatal error: ${message}` : "");
    originalExit(1);
  }

  process.once("beforeExit", failClosedBeforeExit);
  process.prependListener("exit", failClosedOnExit);
  process.once("uncaughtException", failClosedOnFatal);
  process.once("unhandledRejection", failClosedOnFatal);

  // ─── Last-resort JSON health gate ───────────────────────────
  // Registered with process.on (not prependListener) so it fires AFTER
  // all other exit handlers. This is the authoritative check: if any
  // earlier handler failed to enforce the correct exit code, this one
  // inspects the JSON stream health directly and overrides.
  process.on("exit", () => {
    // If a terminal event was already emitted, trust its exit code
    // (emitTerminalJsonEventSync sets process.exitCode accordingly).
    if (terminalEventEmitted) return;

    // No terminal event emitted — JSON stream is incomplete.
    const danglingCount = pendingTools.length;

    if (danglingCount > 0 || lastJsonEventType === "tool_start" || _toolSeq === 0) {
      process.exitCode = 1;
      // Write the terminal error event using originalStdoutWrite (bound
      // reference to real stdout.write, captured before swallowing).
      // passthroughStdout is unbound — would fail with wrong 'this'.
      try {
        originalStdoutWrite(
          JSON.stringify({
            type: "error",
            success: false,
            error: buildFailClosedError(
              danglingCount > 0
                ? `Stream ended with ${danglingCount} unfinished tool call(s)` +
                  (lastJsonEventType === "tool_start"
                    ? " and a dangling tool_start with no matching tool_end."
                    : ".")
                : "Stream ended without a terminal done/error event — JSON is unhealthy.",
            ),
            pendingTools:
              danglingCount > 0
                ? pendingTools.map((e) => e.tool)
                : undefined,
          }) + "\n",
        );
      } catch {
        /* best effort — exit code is the authoritative signal */
      }
    }
  });

  return {
    _startPendingWatchdog: () => _startPendingWatchdog(),
    hooks: {
      onToken(text) {
        streamedText += text || "";
        lastJsonEventType = "token";
        emitJsonLine({ type: "token", text }, originalStdoutWrite);
      },
      onThinkingToken() {
        lastJsonEventType = "thinking";
        emitJsonLine({ type: "thinking" }, originalStdoutWrite);
      },
      onToolStart(toolName, args) {
        process.exitCode = 1;
        const callId = ++_toolSeq;
        const entry = { tool: toolName, args: args || {}, callId };
        pendingTools.push(entry);
        _toolIds.set(callId, pendingTools.length - 1);
        _pendingToolStartTimes.set(callId, Date.now());
        _startPendingWatchdog();
        lastJsonEventType = "tool_start";
        emitJsonLine({
          type: "tool_start",
          tool: toolName,
          args: args || {},
          callId,
        }, originalStdoutWrite);
      },
      onToolEnd(toolName, summary, ok) {
        // Remove the FIRST matching tool entry (FIFO — tools complete in order).
        const idx = pendingTools
          .map((entry) => entry.tool)
          .lastIndexOf(toolName);
        if (idx !== -1) {
          const removed = pendingTools.splice(idx, 1)[0];
          if (removed && removed.callId != null) {
            _pendingToolStartTimes.delete(removed.callId);
          }
        }
        if (pendingTools.length === 0) _stopPendingWatchdog();
        lastJsonEventType = "tool_end";
        emitJsonLine({
          type: "tool_end",
          tool: toolName,
          summary: cleanToolSummary(summary || ""),
          ok: !!ok,
        }, originalStdoutWrite);
      },
    },
    getStreamedText() {
      return streamedText;
    },
    getPendingTools() {
      return pendingTools.slice();
    },
    hasTerminalEvent() {
      return terminalEventEmitted || isTerminalJsonEvent();
    },
    emitTerminal(event) {
      emitTerminalJsonEventSync(event);
    },
    restore() {
      restore();
      _stopPendingWatchdog();
    },
  };
}

function createPlainHeadlessHooks() {
  process.env.NEX_SERVER = "1";
  let streamedText = "";

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    info: console.info,
    error: console.error,
  };
  const passthroughStdout = process.stdout.write;
  const passthroughStderr = process.stderr.write;

  function swallowWrite(_chunk, encoding, cb) {
    let callback = cb;
    if (typeof encoding === "function") callback = encoding;
    if (typeof callback === "function") callback();
    return true;
  }

  process.stdout.write = swallowWrite;
  // Keep stderr alive for debug output in headless mode
  // process.stderr.write = swallowWrite;
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.error = () => {};

  return {
    hooks: {
      onToken(text) {
        streamedText += text || "";
      },
      onThinkingToken() {},
      onToolStart() {},
      onToolEnd() {},
    },
    getStreamedText() {
      return streamedText;
    },
    restore() {
      process.stdout.write = passthroughStdout;
      process.stderr.write = passthroughStderr;
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      console.error = originalConsole.error;
    },
  };
}

// ─── helper: run headless task ───────────────────────────────
async function runHeadlessTask(task) {
  // ─── --decompose: split multi-file scope into sequential single-file runs ──
  if (args.includes("--decompose") && process.env.NEX_SCOPE) {
    const files = process.env.NEX_SCOPE.split(",").map((s) => s.trim()).filter(Boolean);
    if (files.length > 1) {
      const { execSync } = require("child_process");
      const binPath = process.argv[1];
      const allFlags = process.argv.slice(2)
        .filter(f => f !== "--decompose" && f !== process.env.NEX_SCOPE)
        .join(" ");
      console.error(`Decomposing into ${files.length} sequential tasks...`);
      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        console.error(`  [${fi + 1}/${files.length}] ${file}`);
        try {
          execSync(
            `${process.execPath} ${binPath} ${allFlags} --scope '${file}' --task "${task.replace(/"/g, '\\"')}"`,
            { stdio: "inherit", timeout: 600000 },
          );
        } catch (e) {
          console.error(`  ⚠ Subtask ${fi + 1} failed (exit ${e.status})`);
        }
      }
      console.error(`All ${files.length} subtasks complete.`);
      process.exit(0);
    }
  }

  if (args.includes("--auto")) {
    const { setAutoConfirm } = require("../cli/safety");
    setAutoConfirm(true);
  }
  // Flatrate: raise the iteration cap after agent.js is loaded.
  // Skip if --max-turns was explicitly passed — explicit flag takes priority.
  if (flatrateMode && maxTurnsIdx === -1) {
    const { setMaxIterations } = require("../cli/agent");
    setMaxIterations(100);
  }
  // In headless mode, default to a fast model unless --model (or --gemini)
  // was explicitly set — both count as an explicit choice the user made.
  const hasExplicitModel = args.includes("--model") || geminiMode;
  if (!hasExplicitModel) {
    const { setActiveModel } = require("../cli/providers/registry");
    const fastHeadlessModel =
      process.env.HEADLESS_MODEL || "devstral-2:123b";
    setActiveModel(fastHeadlessModel);
  }
  const autoOrchestrate = !args.includes("--no-auto-orchestrate") &&
    process.env.NEX_AUTO_ORCHESTRATE !== "false";
  const orchModelIdx = args.indexOf("--orchestrator-model");
  const orchestratorModel =
    orchModelIdx !== -1 ? args[orchModelIdx + 1] : undefined;
  const jsonModeState = jsonMode ? createJsonModeHooks() : null;
  let plainModeState = null;
  let agentHooks = jsonModeState ? jsonModeState.hooks : null;

  // ─── Outer exit safety net ────────────────────────────────────
  // The inner createJsonModeHooks registers its own exit listener,
  // but to guard against edge cases (listener removal, premature
  // beforeExit, silent crashes) we add one more last-resort exit
  // handler here. It fires only if no terminal event was emitted
  // by any other path.
  if (jsonModeState) {
    const outerExitHandler = (code) => {
      const pending = jsonModeState.getPendingTools();
      if (!jsonModeState.hasTerminalEvent() || pending.length > 0) {
        const names = pending.map((e) => e.tool).join(", ");
        jsonModeState.emitTerminal({
          type: "error",
          success: false,
          error: pending.length > 0
            ? `Headless run ended with unfinished tool call(s): ${names}. Stopping to avoid a false success.`
            : "Headless JSON run ended before emitting a final done/error event. Stopping to avoid a false success.",
          exitCode: code,
        });
        process.exitCode = 1;
      }
    };
    process.prependListener("exit", outerExitHandler);
  }

  function finishSuccess(getMessages) {
    const { sanitizeFinalAnswer } = require("../cli/format");
    const msgs = getMessages();
    const pendingTools = jsonModeState?.getPendingTools?.() || [];
    if (pendingTools.length > 0) {
      const names = pendingTools.map((entry) => entry.tool).join(", ");
      const errorMessage =
        `Headless run ended with unfinished tool call(s): ${names}. ` +
        "Stopping to avoid a false success.";

      if (!jsonModeState) {
        if (plainModeState) plainModeState.restore();
        console.error(errorMessage);
        process.exit(1);
        return;
      }

      const { getSessionCosts } = require("../cli/costs");
      const costs = getSessionCosts();
      jsonModeState.restore();
      jsonModeState.emitTerminal({
        type: "error",
        success: false,
        error: errorMessage,
        usage: {
          input: costs.totalInput || 0,
          output: costs.totalOutput || 0,
          cacheRead: costs.totalCacheRead || 0,
        },
        toolCalls: countToolCalls(msgs),
      });
      process.exit(1);
      return;
    }

    // Walk backwards through assistant messages to find one with text content.
    // When the model makes edits and verifies but its last turn produces only
    // tool calls (read-back, lint), the headless runner would previously fail
    // with "no final assistant response" even though the task was completed.
    let response = "";
    let hasTerminalAssistantMessage = false;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === "assistant") {
        if (hasAssistantToolCalls(m)) continue;
        hasTerminalAssistantMessage = true;
        const text = sanitizeFinalAnswer(getAssistantText(m.content));
        if (text && text.trim().length > 0) {
          response = text;
          break;
        }
      }
    }
    const streamedResponse = String(
      jsonModeState?.getStreamedText?.() || plainModeState?.getStreamedText?.() || "",
    ).trim();
    const finalResponse =
      typeof response === "string" && response.trim().length > 0
        ? response
        : hasTerminalAssistantMessage
          ? streamedResponse
          : "";
    const hasFinalResponse =
      typeof finalResponse === "string" && finalResponse.trim().length > 0;

    if (!hasFinalResponse) {
      const writeCount = countWriteToolCalls(msgs);
      const errorMessage = writeCount > 0
        ? "Headless run modified files but ended without a final assistant response. Stopping to avoid a false success."
        : "Headless run ended without a final assistant response. Stopping to avoid a false success.";

      if (!jsonModeState) {
        if (plainModeState) plainModeState.restore();
        console.error(errorMessage);
        process.exit(1);
        return;
      }

      const { getSessionCosts } = require("../cli/costs");
      const costs = getSessionCosts();
      jsonModeState.restore();
      jsonModeState.emitTerminal({
        type: "error",
        success: false,
        error: errorMessage,
        usage: {
          input: costs.totalInput || 0,
          output: costs.totalOutput || 0,
          cacheRead: costs.totalCacheRead || 0,
        },
        toolCalls: countToolCalls(msgs),
      });
      process.exit(1);
      return;
    }

    if (!jsonModeState) {
      if (plainModeState) {
        plainModeState.restore();
        if (finalResponse) process.stdout.write(finalResponse + "\n");
      }
      process.exit(looksLikeFailedHeadlessConclusion(finalResponse) ? 1 : 0);
      return;
    }

    const { getSessionCosts } = require("../cli/costs");
    const costs = getSessionCosts();
    jsonModeState.restore();
    if (looksLikeFailedHeadlessConclusion(finalResponse)) {
      jsonModeState.emitTerminal({
        type: "error",
        success: false,
        error: finalResponse,
        usage: {
          input: costs.totalInput || 0,
          output: costs.totalOutput || 0,
          cacheRead: costs.totalCacheRead || 0,
        },
        toolCalls: countToolCalls(msgs),
      });
      process.exit(1);
      return;
    }
    jsonModeState.emitTerminal({
      type: "done",
      success: true,
      response: finalResponse,
      usage: {
        input: costs.totalInput || 0,
        output: costs.totalOutput || 0,
        cacheRead: costs.totalCacheRead || 0,
      },
      toolCalls: countToolCalls(msgs),
    });
    process.exit(0);
  }

  function finishError(err) {
    if (!jsonModeState) {
      if (plainModeState) plainModeState.restore();
      console.error(err.message);
      process.exit(1);
      return;
    }

    jsonModeState.restore();
    jsonModeState.emitTerminal({
      type: "error",
      success: false,
      error: err?.message || String(err),
    });
    process.exit(1);
  }

  // Slash commands (e.g. /bench, /benchmark, /trend) must be routed to the
  // command handler, not sent to the model as a prompt.
  if (task.startsWith("/")) {
    // Load skills so skill commands (e.g. /ar-self-improve) are recognized
    const { loadAllSkills, handleSkillCommand } = require("../cli/skills");
    loadAllSkills();
    const skillResult = handleSkillCommand(task);
    if (skillResult && skillResult.agentPrompt) {
      // Skill returned an agent prompt — run it through processInput
      const { processInput, getConversationMessages } = require("../cli/agent");
      return processInput(skillResult.agentPrompt, agentHooks, {
        autoOrchestrate,
        orchestratorModel,
      })
        .then(() => finishSuccess(getConversationMessages))
        .catch((err) => finishError(err));
    }
    const { handleSlashCommand } = require("../cli/commands/index");
    handleSlashCommand(task, null)
      .then(() => {
        if (jsonModeState) {
          jsonModeState.restore();
          jsonModeState.emitTerminal({ type: "done", success: true, response: "" });
        }
        process.exit(0);
      })
      .catch((err) => finishError(err));
    return;
  }

  const { processInput, getConversationMessages } = require("../cli/agent");
  if (!jsonModeState) {
    plainModeState = createPlainHeadlessHooks();
    agentHooks = plainModeState.hooks;
  }
  processInput(task, agentHooks, { autoOrchestrate, orchestratorModel })
    .then(() => {
      // Write dream log for session consolidation
      try {
        const { writeDreamLog } = require("../cli/dream");
        writeDreamLog(getConversationMessages());
      } catch { /* non-critical */ }
      finishSuccess(getConversationMessages);
    })
    .catch((err) => finishError(err));
}

// ─── --daemon / --watch (background watcher mode) ────────────
if (args.includes("--daemon") || args.includes("--watch")) {
  const flagIdx = args.includes("--daemon")
    ? args.indexOf("--daemon")
    : args.indexOf("--watch");
  const next = args[flagIdx + 1];
  // next might be a config path or another flag (or undefined)
  const resolvedCfg =
    next && !next.startsWith("--") ? next : ".nex/daemon.json";
  const { startDaemon } = require("../cli/daemon");
  startDaemon(resolvedCfg).catch((e) => {
    console.error("Daemon error:", e.message);
    process.exit(1);
  });
  return; // daemon handles SIGINT itself — keep process alive
}

// ─── --prompt-file (headless mode from file) ─────────────────
const promptFileIdx = args.indexOf("--prompt-file");
if (promptFileIdx !== -1) {
  const filePath = args[promptFileIdx + 1];
  if (!filePath || filePath.startsWith("--")) {
    console.error("--prompt-file requires a file path");
    process.exit(1);
  }

  const fs = require("fs");
  let task;
  try {
    task = fs.readFileSync(filePath, "utf-8").trim();
  } catch (err) {
    console.error(`--prompt-file: cannot read file: ${err.message}`);
    process.exit(1);
  }

  if (!task) {
    console.error("--prompt-file: file is empty");
    process.exit(1);
  }

  if (args.includes("--delete-prompt-file")) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }

  preventSleep();
  runHeadlessTask(task);
} else {
  // ─── --task / --prompt (headless mode) ──────────────────────
  // --prompt is an alias for --task (shorter, easier to type in one-liners)
  const taskIdx =
    args.indexOf("--task") !== -1
      ? args.indexOf("--task")
      : args.indexOf("--prompt");
  if (taskIdx !== -1) {
    const task = args[taskIdx + 1];
    if (!task || task.startsWith("--")) {
      console.error("--task/--prompt requires a prompt");
      process.exit(1);
    }
    preventSleep();
    if (args.includes("--orchestrate")) {
      const orchModelIdx = args.indexOf("--orchestrator-model");
      const orchModel =
        orchModelIdx !== -1 ? args[orchModelIdx + 1] : undefined;
      const { runOrchestrated } = require("../cli/orchestrator");
      runOrchestrated(task, { orchestratorModel: orchModel })
        .then(() => {
          process.exit(0);
        })
        .catch((err) => {
          console.error(`Orchestrator error: ${err.message}`);
          process.exit(1);
        });
    } else {
      runHeadlessTask(task);
    }
  } else {
    // Normal REPL mode — run interactive setup if needed, then start REPL
    checkSetup().then(async () => {
      preventSleep();
      // Flatrate: apply iteration cap for interactive sessions too
      if (flatrateMode) {
        const { setMaxIterations } = require("../cli/agent");
        setMaxIterations(100);
      }

      // ─── --resume: load last autosave session explicitly ──────
      if (args.includes("--resume")) {
        const { loadSession } = require("../cli/session");
        const { setConversationMessages } = require("../cli/agent");
        const lastSession = loadSession("_autosave");
        if (lastSession && lastSession.messages && lastSession.messages.length > 0) {
          const MAX_RESTORE = 20;
          const msgs = lastSession.messages;
          const trimmed = msgs.length > MAX_RESTORE ? msgs.slice(-MAX_RESTORE) : msgs;
          setConversationMessages(trimmed);
          const { getUsage, forceCompress } = require("../cli/context-engine");
          const usage = getUsage(trimmed, []);
          if (usage.percentage >= 30) {
            const { messages: compressed } = forceCompress(trimmed, []);
            setConversationMessages(compressed);
          }
          const { C } = require("../cli/ui");
          process.stdout.write(`${C.dim}Session restored (${trimmed.length} messages)${C.reset}\n`);
        } else {
          const { C } = require("../cli/ui");
          process.stdout.write(`${C.yellow}No previous session found.${C.reset}\n`);
        }
      }

      const { startREPL } = require("../cli/index");
      startREPL();
      // Background: check for new Ollama Cloud models once per week (non-blocking)
      setTimeout(async () => {
        try {
          const { loadKnownModels, findNewModels } = require("../cli/model-watcher");
          const store = loadKnownModels();
          const lastChecked = store.lastChecked ? new Date(store.lastChecked) : null;
          const daysSince = lastChecked
            ? (Date.now() - lastChecked.getTime()) / 86400000
            : 999;
          if (daysSince < 7) return; // checked recently
          if (!process.env.OLLAMA_API_KEY) return; // no key — skip silently
          const { newModels } = await findNewModels();
          if (newModels.length > 0) {
            const { C } = require("../cli/ui");
            process.stdout.write(
              `\n${C.dim}💡 ${newModels.length} new Ollama Cloud model(s) available — /benchmark --discover to test them${C.reset}\n`,
            );
          }
        } catch {
          /* silent — never break startup */
        }
      }, 3000); // 3s delay so REPL output settles first
    });
  }
}

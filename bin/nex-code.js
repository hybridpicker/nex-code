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
  return ["ollama", "openai", "deepseek", "anthropic", "gemini", "local"].includes(
    prefix,
  )
    ? prefix
    : null;
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

function createJsonModeHooks() {
  process.env.NEX_SERVER = "1";

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
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
  process.stderr.write = swallowWrite;

  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.error = () => {};

  return {
    hooks: {
      onToken(text) {
        emitJsonLine({ type: "token", text }, originalStdoutWrite);
      },
      onThinkingToken() {
        emitJsonLine({ type: "thinking" }, originalStdoutWrite);
      },
      onToolStart(toolName, args) {
        emitJsonLine({
          type: "tool_start",
          tool: toolName,
          args: args || {},
        }, originalStdoutWrite);
      },
      onToolEnd(toolName, summary, ok) {
        emitJsonLine({
          type: "tool_end",
          tool: toolName,
          summary: cleanToolSummary(summary || ""),
          ok: !!ok,
        }, originalStdoutWrite);
      },
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

function createPlainHeadlessHooks() {
  process.env.NEX_SERVER = "1";

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
  process.stderr.write = swallowWrite;
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.error = () => {};

  return {
    hooks: {
      onToken() {},
      onThinkingToken() {},
      onToolStart() {},
      onToolEnd() {},
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
function runHeadlessTask(task) {
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
      process.env.HEADLESS_MODEL || "devstral-small-2:24b";
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

  function finishSuccess(getMessages) {
    const { sanitizeFinalAnswer } = require("../cli/format");
    const msgs = getMessages();
    const lastAssistant = msgs.filter((m) => m.role === "assistant").pop();
    const response = sanitizeFinalAnswer(getAssistantText(lastAssistant?.content));

    if (!jsonModeState) {
      if (plainModeState) {
        plainModeState.restore();
        if (response) process.stdout.write(response + "\n");
      }
      process.exit(0);
      return;
    }

    const { getSessionCosts } = require("../cli/costs");
    const costs = getSessionCosts();
    jsonModeState.restore();
    emitJsonLine({
      type: "done",
      success: true,
      response,
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
    emitJsonLine({
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
      processInput(skillResult.agentPrompt, agentHooks, {
        autoOrchestrate,
        orchestratorModel,
      })
        .then(() => finishSuccess(getConversationMessages))
        .catch((err) => finishError(err));
      return;
    }
    const { handleSlashCommand } = require("../cli/commands/index");
    handleSlashCommand(task, null)
      .then(() => {
        if (jsonModeState) {
          jsonModeState.restore();
          emitJsonLine({ type: "done", success: true, response: "" });
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

// ─── --server (VS Code extension IPC mode) ───────────────────
if (args.includes("--server")) {
  const { setAutoConfirm } = require("../cli/safety");
  setAutoConfirm(true); // non-critical tools auto-confirm in server mode
  require("../cli/server-mode").startServerMode();
  return; // event loop keeps process alive — no further code should run
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

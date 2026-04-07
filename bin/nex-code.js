#!/usr/bin/env node
/**
 * Nex Code — Agentic Coding CLI
 * Entrypoint: loads .env, parses CLI flags, starts REPL or headless mode.
 */

const path = require("path");
const os = require("os");

// Load .env from CLI install dir (fallback) and project dir
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
// Load from global ~/.nex-code/.env (benchmark routing etc)
require("dotenv").config({ path: path.join(os.homedir(), ".nex-code", ".env") });
require("dotenv").config(); // Also check CWD

const args = process.argv.slice(2);

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

// ─── Flatrate mode ────────────────────────────────────────────
// Auto-activates when OLLAMA_API_KEY is set (Ollama Cloud flatrate plan)
// or via explicit --flatrate flag. Shifts optimization from "minimize tokens"
// to "maximize correctness": more iterations, more parallel agents, more retries.
const flatrateMode =
  args.includes("--flatrate") ||
  (!!process.env.OLLAMA_API_KEY && !process.env.NEX_NO_FLATRATE);
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
  // Print badge on stderr so it shows even in --json mode
  process.stderr.write(
    "\x1b[38;2;80;210;120m◆\x1b[0m \x1b[1mFlatrate mode\x1b[0m\x1b[2m — 100 turns · 6 parallel agents · 5 retries · verify-on\x1b[0m\n",
  );
}

// ─── --model ──────────────────────────────────────────────────
const modelIdx = args.indexOf("--model");
if (modelIdx !== -1 && args[modelIdx + 1]) {
  const { setActiveModel } = require("../cli/providers/registry");
  setActiveModel(args[modelIdx + 1]);
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
  // In headless mode, default to a fast model unless --model was explicitly set
  const hasExplicitModel = args.includes("--model");
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
      processInput(skillResult.agentPrompt, null, { autoOrchestrate, orchestratorModel })
        .then(() => process.exit(0))
        .catch((err) => { console.error(err.message); process.exit(1); });
      return;
    }
    const { handleSlashCommand } = require("../cli/commands/index");
    handleSlashCommand(task, null)
      .then(() => process.exit(0))
      .catch((err) => { console.error(err.message); process.exit(1); });
    return;
  }

  const { processInput, getConversationMessages } = require("../cli/agent");
  processInput(task, null, { autoOrchestrate, orchestratorModel })
    .then(() => {
      // Write dream log for session consolidation
      try {
        const { writeDreamLog } = require("../cli/dream");
        writeDreamLog(getConversationMessages());
      } catch { /* non-critical */ }
      if (args.includes("--json")) {
        const msgs = getConversationMessages();
        const lastAssistant = msgs.filter((m) => m.role === "assistant").pop();
        console.log(
          JSON.stringify({
            success: true,
            response: lastAssistant?.content || "",
          }),
        );
      }
      process.exit(0);
    })
    .catch((err) => {
      if (args.includes("--json")) {
        console.log(JSON.stringify({ success: false, error: err.message }));
      } else {
        console.error(err.message);
      }
      process.exit(1);
    });
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

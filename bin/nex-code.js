#!/usr/bin/env node
/**
 * Nex Code — Agentic Coding CLI
 * Entrypoint: loads .env, parses CLI flags, starts REPL or headless mode.
 */

const path = require('path');

// Load .env from CLI install dir (fallback) and project dir
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // Also check CWD

const args = process.argv.slice(2);

// ─── --help / -h ──────────────────────────────────────────────
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: nex-code [options]

Options:
  --task <prompt>          Run a single task and exit (headless mode)
  --prompt-file <path>     Read prompt from file and run headless (avoids shell escaping)
  --delete-prompt-file     Delete the prompt file after reading (use with --prompt-file)
  --auto                   Skip all confirmations (implies --task / --prompt-file)
  --yolo, -yolo            Skip all confirmations (interactive YOLO mode)
  --model <spec>           Set model (e.g. openai:gpt-4o)
  --max-turns <n>          Max agentic loop iterations (default: 50)
  --json                   Output result as JSON (for CI parsing)
  -h, --help               Show this help
  -v, --version            Show version
`);
  process.exit(0);
}

// ─── --version / -v ───────────────────────────────────────────
if (args.includes('-v') || args.includes('--version')) {
  const pkg = require('../package.json');
  console.log(pkg.version);
  process.exit(0);
}

// ─── --yolo / -yolo ──────────────────────────────────────────
const yoloMode = args.includes('--yolo') || args.includes('-yolo');
if (yoloMode) {
  const { setAutoConfirm } = require('../cli/safety');
  setAutoConfirm(true);
}

// ─── --model ──────────────────────────────────────────────────
const modelIdx = args.indexOf('--model');
if (modelIdx !== -1 && args[modelIdx + 1]) {
  const { setActiveModel } = require('../cli/providers/registry');
  setActiveModel(args[modelIdx + 1]);
}

// ─── --max-turns (flag or .nex/config.json) ──────────────────
const maxTurnsIdx = args.indexOf('--max-turns');
if (maxTurnsIdx !== -1 && args[maxTurnsIdx + 1]) {
  const n = parseInt(args[maxTurnsIdx + 1], 10);
  if (n > 0) {
    const { setMaxIterations } = require('../cli/agent');
    setMaxIterations(n);
  }
} else {
  // Fall back to .nex/config.json { "maxIterations": N }
  try {
    const fs = require('fs');
    const configPath = path.join(process.cwd(), '.nex', 'config.json');
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const n = parseInt(cfg.maxIterations, 10);
      if (n > 0) {
        const { setMaxIterations } = require('../cli/agent');
        setMaxIterations(n);
      }
    }
  } catch { /* ignore malformed config */ }
}

// ─── macOS: prevent sleep while running ──────────────────────
function preventSleep() {
  if (process.platform !== 'darwin') return;
  try {
    const { spawn } = require('child_process');
    // -i: prevent idle sleep, -m: prevent disk sleep
    const child = spawn('caffeinate', ['-i', '-m'], {
      stdio: 'ignore',
      detached: false,
    });
    child.unref();
    const kill = () => { try { child.kill(); } catch { /* already dead */ } };
    process.on('exit', kill);
    process.on('SIGINT', kill);
    process.on('SIGTERM', kill);
  } catch { /* caffeinate unavailable, no-op */ }
}

// ─── first-run setup check ───────────────────────────────────
function checkSetup() {
  const fs = require('fs');
  const hasEnvFile =
    fs.existsSync(path.join(__dirname, '..', '.env')) ||
    fs.existsSync(path.join(process.cwd(), '.env'));
  const hasApiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENROUTER_API_KEY;
  const hasExplicitProvider = process.env.DEFAULT_PROVIDER || process.env.DEFAULT_MODEL;

  if (hasEnvFile || hasApiKey || hasExplicitProvider) return; // configured — skip

  const R = '\x1b[0m';
  const B = '\x1b[1m';
  const D = '\x1b[2m';
  const Y = '\x1b[33m';
  const C = '\x1b[36m';
  const G = '\x1b[32m';

  console.log();
  console.log(`${Y}${B}  ✦ No configuration found — quick setup guide${R}`);
  console.log(`${D}  ─────────────────────────────────────────────────────────${R}`);
  console.log();
  console.log(`  Create a ${B}.env${R} file in your project directory with one of:`);
  console.log();
  console.log(`${G}  ┌─ Ollama (local or cloud, no API key required) ─────────┐${R}`);
  console.log(`${G}  │${R}  Works out of the box if Ollama is running locally.     ${G}│${R}`);
  console.log(`${G}  │${R}                                                         ${G}│${R}`);
  console.log(`${G}  │${R}  ${D}# .env${R}                                               ${G}│${R}`);
  console.log(`${G}  │${R}  ${C}DEFAULT_PROVIDER${R}=ollama                               ${G}│${R}`);
  console.log(`${G}  │${R}  ${C}DEFAULT_MODEL${R}=qwen3-coder                             ${G}│${R}`);
  console.log(`${G}  │${R}  ${C}OLLAMA_HOST${R}=http://localhost:11434                    ${G}│${R}`);
  console.log(`${G}  └─────────────────────────────────────────────────────────┘${R}`);
  console.log();
  console.log(`${C}  ┌─ Anthropic (Claude) ───────────────────────────────────┐${R}`);
  console.log(`${C}  │${R}  ${C}DEFAULT_PROVIDER${R}=anthropic                             ${C}│${R}`);
  console.log(`${C}  │${R}  ${C}ANTHROPIC_API_KEY${R}=sk-ant-...                           ${C}│${R}`);
  console.log(`${C}  └─────────────────────────────────────────────────────────┘${R}`);
  console.log();
  console.log(`${D}  ┌─ OpenAI ───────────────────────────────────────────────┐${R}`);
  console.log(`${D}  │${R}  ${C}DEFAULT_PROVIDER${R}=openai                                ${D}│${R}`);
  console.log(`${D}  │${R}  ${C}OPENAI_API_KEY${R}=sk-...                                  ${D}│${R}`);
  console.log(`${D}  └─────────────────────────────────────────────────────────┘${R}`);
  console.log();
  console.log(`  Run ${B}/init${R} inside nex-code for an interactive setup wizard.`);
  console.log(`  Docs: ${D}https://github.com/hybridpicker/nex-code${R}`);
  console.log();
  console.log(`${D}  Continuing with Ollama defaults (localhost:11434)...${R}`);
  console.log();
}

// ─── helper: run headless task ───────────────────────────────
function runHeadlessTask(task) {
  if (args.includes('--auto')) {
    const { setAutoConfirm } = require('../cli/safety');
    setAutoConfirm(true);
  }
  // In headless mode, default to a fast model unless --model was explicitly set
  const hasExplicitModel = args.includes('--model');
  if (!hasExplicitModel) {
    const { setActiveModel } = require('../cli/providers/registry');
    const fastHeadlessModel = process.env.HEADLESS_MODEL || 'devstral-small-2:24b';
    setActiveModel(fastHeadlessModel);
  }
  const { processInput, getConversationMessages } = require('../cli/agent');
  processInput(task).then(() => {
    if (args.includes('--json')) {
      const msgs = getConversationMessages();
      const lastAssistant = msgs.filter((m) => m.role === 'assistant').pop();
      console.log(JSON.stringify({ success: true, response: lastAssistant?.content || '' }));
    }
    process.exit(0);
  }).catch((err) => {
    if (args.includes('--json')) {
      console.log(JSON.stringify({ success: false, error: err.message }));
    } else {
      console.error(err.message);
    }
    process.exit(1);
  });
}

// ─── --prompt-file (headless mode from file) ─────────────────
const promptFileIdx = args.indexOf('--prompt-file');
if (promptFileIdx !== -1) {
  const filePath = args[promptFileIdx + 1];
  if (!filePath || filePath.startsWith('--')) {
    console.error('--prompt-file requires a file path');
    process.exit(1);
  }

  const fs = require('fs');
  let task;
  try {
    task = fs.readFileSync(filePath, 'utf-8').trim();
  } catch (err) {
    console.error(`--prompt-file: cannot read file: ${err.message}`);
    process.exit(1);
  }

  if (!task) {
    console.error('--prompt-file: file is empty');
    process.exit(1);
  }

  if (args.includes('--delete-prompt-file')) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }

  preventSleep();
  runHeadlessTask(task);
} else {
  // ─── --task (headless mode) ──────────────────────────────────
  const taskIdx = args.indexOf('--task');
  if (taskIdx !== -1) {
    const task = args[taskIdx + 1];
    if (!task || task.startsWith('--')) {
      console.error('--task requires a prompt');
      process.exit(1);
    }
    preventSleep();
    runHeadlessTask(task);
  } else {
    // Normal REPL mode
    checkSetup(); // show onboarding screen if no config found
    preventSleep();
    const { startREPL } = require('../cli/index');
    startREPL();
  }
}

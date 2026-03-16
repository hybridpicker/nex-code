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

// ─── first-run interactive setup ─────────────────────────────
async function checkSetup() {
  const fs = require('fs');
  const readline = require('readline');

  const hasEnvFile =
    fs.existsSync(path.join(__dirname, '..', '.env')) ||
    fs.existsSync(path.join(process.cwd(), '.env'));
  const hasApiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENROUTER_API_KEY;
  const hasExplicitProvider = process.env.DEFAULT_PROVIDER || process.env.DEFAULT_MODEL;

  if (hasEnvFile || hasApiKey || hasExplicitProvider) return; // already configured

  const R = '\x1b[0m'; const B = '\x1b[1m'; const D = '\x1b[2m';
  const Y = '\x1b[33m'; const CY = '\x1b[36m'; const G = '\x1b[32m';

  // ─── tiny readline helpers (no REPL open yet) ───
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const ask = (q, def = '') => new Promise((res) => {
    const hint = def ? ` ${D}[${def}]${R}` : '';
    rl.question(`  ${CY}${q}${hint}${R}: `, (a) => res(a.trim() || def));
  });
  // Masked input (API keys) — hides characters while typing
  const askSecret = (q) => new Promise((res) => {
    process.stdout.write(`  ${CY}${q}${R}: `);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    let input = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(wasRaw || false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        res(input);
      } else if (ch === '\u0003') { // Ctrl+C
        process.stdout.write('\n');
        process.exit(0);
      } else if (ch === '\u007f') { // backspace
        if (input.length > 0) { input = input.slice(0, -1); process.stdout.write('\b \b'); }
      } else {
        input += ch;
        process.stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });

  console.log();
  console.log(`${Y}${B}  ✦ Welcome to nex-code! No configuration found.${R}`);
  console.log(`${D}  ─────────────────────────────────────────────────────────${R}`);
  console.log(`  Let's set you up in 60 seconds.`);
  console.log();
  console.log(`  ${B}Which AI provider do you want to use?${R}`);
  console.log();
  console.log(`  ${G}1)${R} Ollama        ${D}local/cloud — no API key needed${R}`);
  console.log(`  ${CY}2)${R} Anthropic     ${D}Claude (claude-sonnet-4-6 etc.)${R}`);
  console.log(`  ${CY}3)${R} OpenAI        ${D}GPT-4o, GPT-4.1 etc.${R}`);
  console.log(`  ${CY}4)${R} Gemini        ${D}Google Gemini 2.x${R}`);
  console.log(`  ${D}5)  Skip          continue with Ollama defaults${R}`);
  console.log();

  const choice = await ask('Enter number', '1');
  const envLines = [];

  if (choice === '5') {
    rl.close();
    console.log(`\n${D}  Skipping — using Ollama defaults. Run /init anytime to configure.${R}\n`);
    return;
  }

  if (choice === '1') {
    // ── Ollama ──────────────────────────────────────────────
    console.log();
    const host = await ask('Ollama host', 'http://localhost:11434');
    const model = await ask('Default model', 'qwen3-coder');
    envLines.push('DEFAULT_PROVIDER=ollama', `DEFAULT_MODEL=${model}`, `OLLAMA_HOST=${host}`);
    // apply immediately for this session
    process.env.DEFAULT_PROVIDER = 'ollama';
    process.env.DEFAULT_MODEL = model;
    process.env.OLLAMA_HOST = host;

  } else if (choice === '2') {
    // ── Anthropic ───────────────────────────────────────────
    console.log();
    console.log(`  ${D}Get your key at: https://console.anthropic.com/settings/keys${R}`);
    const key = await askSecret('ANTHROPIC_API_KEY');
    if (!key) { rl.close(); console.log(`\n${Y}  No key entered — skipping.${R}\n`); return; }
    const model = await ask('Default model', 'claude-sonnet-4-6');
    envLines.push('DEFAULT_PROVIDER=anthropic', `DEFAULT_MODEL=${model}`, `ANTHROPIC_API_KEY=${key}`);
    process.env.DEFAULT_PROVIDER = 'anthropic';
    process.env.DEFAULT_MODEL = model;
    process.env.ANTHROPIC_API_KEY = key;

  } else if (choice === '3') {
    // ── OpenAI ──────────────────────────────────────────────
    console.log();
    console.log(`  ${D}Get your key at: https://platform.openai.com/api-keys${R}`);
    const key = await askSecret('OPENAI_API_KEY');
    if (!key) { rl.close(); console.log(`\n${Y}  No key entered — skipping.${R}\n`); return; }
    const model = await ask('Default model', 'gpt-4o');
    envLines.push('DEFAULT_PROVIDER=openai', `DEFAULT_MODEL=${model}`, `OPENAI_API_KEY=${key}`);
    process.env.DEFAULT_PROVIDER = 'openai';
    process.env.DEFAULT_MODEL = model;
    process.env.OPENAI_API_KEY = key;

  } else if (choice === '4') {
    // ── Gemini ──────────────────────────────────────────────
    console.log();
    console.log(`  ${D}Get your key at: https://aistudio.google.com/app/apikey${R}`);
    const key = await askSecret('GEMINI_API_KEY');
    if (!key) { rl.close(); console.log(`\n${Y}  No key entered — skipping.${R}\n`); return; }
    const model = await ask('Default model', 'gemini-2.0-flash');
    envLines.push('DEFAULT_PROVIDER=gemini', `DEFAULT_MODEL=${model}`, `GEMINI_API_KEY=${key}`);
    process.env.DEFAULT_PROVIDER = 'gemini';
    process.env.DEFAULT_MODEL = model;
    process.env.GEMINI_API_KEY = key;
  }

  // ── Optional Perplexity key (grounded web search) ───────
  console.log();
  const addPerplexity = await ask('Add Perplexity API key for web search? (y/N)', 'n');
  if (addPerplexity.toLowerCase() === 'y') {
    console.log(`  ${D}Get your key at: https://www.perplexity.ai/settings/api${R}`);
    const pKey = await askSecret('PERPLEXITY_API_KEY');
    if (pKey) {
      envLines.push(`PERPLEXITY_API_KEY=${pKey}`);
      process.env.PERPLEXITY_API_KEY = pKey;
    }
  }

  // ── Save .env ────────────────────────────────────────────
  console.log();
  const save = await ask('Save settings to .env in current directory? (Y/n)', 'y');
  rl.close();

  if (save.toLowerCase() !== 'n') {
    const envPath = path.join(process.cwd(), '.env');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') + '\n' : '';
    fs.writeFileSync(envPath, existing + envLines.join('\n') + '\n');
    // ensure .gitignore has .env
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gi = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gi.includes('.env')) fs.appendFileSync(gitignorePath, '\n.env\n');
    }
    console.log(`\n${G}  ✓ Saved to ${envPath}${R}`);
  }

  console.log(`\n${G}  ✓ Setup complete — starting nex-code...${R}\n`);
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
    // Normal REPL mode — run interactive setup if needed, then start REPL
    checkSetup().then(() => {
      preventSleep();
      const { startREPL } = require('../cli/index');
      startREPL();
    });
  }
}

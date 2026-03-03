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
  --task <prompt>     Run a single task and exit (headless mode)
  --auto              Skip all confirmations (implies --task)
  --yolo, -yolo       Skip all confirmations (interactive YOLO mode)
  --model <spec>      Set model (e.g. openai:gpt-4o)
  --max-turns <n>     Max agentic loop iterations (default: 30)
  --json              Output result as JSON (for CI parsing)
  -h, --help          Show this help
  -v, --version       Show version
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

// ─── --max-turns ─────────────────────────────────────────────
const maxTurnsIdx = args.indexOf('--max-turns');
if (maxTurnsIdx !== -1 && args[maxTurnsIdx + 1]) {
  const n = parseInt(args[maxTurnsIdx + 1], 10);
  if (n > 0) {
    const { setMaxIterations } = require('../cli/agent');
    setMaxIterations(n);
  }
}

// ─── --task (headless mode) ──────────────────────────────────
const taskIdx = args.indexOf('--task');
if (taskIdx !== -1) {
  const task = args[taskIdx + 1];
  if (!task || task.startsWith('--')) {
    console.error('--task requires a prompt');
    process.exit(1);
  }

  // Auto-confirm when --auto
  if (args.includes('--auto')) {
    const { setAutoConfirm } = require('../cli/safety');
    setAutoConfirm(true);
  }

  // Execute task
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
} else {
  // Normal REPL mode
  const { startREPL } = require('../cli/index');
  startREPL();
}

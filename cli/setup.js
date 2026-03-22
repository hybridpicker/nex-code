/**
 * cli/setup.js — Interactive provider/API-key setup wizard
 *
 * Called on first run (no config found) and via /setup or /settings commands.
 * Accepts an optional readline interface from the REPL; creates a temporary
 * one when run before the REPL starts (first-run flow).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const R  = '\x1b[0m'; const B  = '\x1b[1m'; const D  = '\x1b[2m';
const Y  = '\x1b[33m'; const CY = '\x1b[36m'; const G  = '\x1b[32m';

// ─── helpers ─────────────────────────────────────────────────

function makeAsk(rl) {
  return (q, def = '') => new Promise((res) => {
    const hint = def ? ` ${D}[${def}]${R}` : '';
    rl.question(`  ${CY}${q}${hint}${R}: `, (a) => res(a.trim() || def));
  });
}

/** Masked input — shows * while typing. Pauses/resumes REPL rl if provided. */
function askSecret(q, replRL) {
  return new Promise((res) => {
    // Pause REPL readline so it doesn't eat our raw keystrokes
    if (replRL) replRL.pause();
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
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        if (replRL) replRL.resume();
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
}

// ─── main wizard ─────────────────────────────────────────────

/**
 * Run the interactive setup wizard.
 * @param {object} [opts]
 * @param {object} [opts.rl]       - Active REPL readline interface (optional)
 * @param {boolean} [opts.force]   - Skip the "already configured" early-return check
 */
async function runSetupWizard({ rl: replRL = null, force = false } = {}) {
  if (!force) {
    const hasEnvFile =
      fs.existsSync(path.join(process.cwd(), '.env')) ||
      fs.existsSync(path.join(__dirname, '..', '.env'));
    const hasApiKey =
      process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY    || process.env.OPENROUTER_API_KEY;
    const hasExplicitProvider = process.env.DEFAULT_PROVIDER || process.env.DEFAULT_MODEL;
    if (hasEnvFile || hasApiKey || hasExplicitProvider) return;
  }

  // Create a temporary rl if we're not inside the REPL yet
  const ownRL = !replRL;
  const rl = replRL || readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const ask = makeAsk(rl);

  const isFirstRun = !force;
  console.log();
  if (isFirstRun) {
    console.log(`${Y}${B}  ✦ Welcome to nex-code! No configuration found.${R}`);
  } else {
    console.log(`${CY}${B}  ✦ nex-code — Provider & API Key Setup${R}`);
  }
  console.log(`${D}  ─────────────────────────────────────────────────────────${R}`);
  if (isFirstRun) console.log(`  Let's set you up in 60 seconds.\n`);

  console.log(`  ${B}Which AI provider do you want to use?${R}\n`);
  console.log(`  ${G}1)${R} ${B}Ollama Cloud${R}  ${D}recommended — devstral-2:123b, no API key needed${R}`);
  console.log(`  ${D}   (also works with a local Ollama server)${R}`);
  console.log(`  ${D}2)  Anthropic     Claude (claude-sonnet-4-6 etc.)${R}`);
  console.log(`  ${D}3)  OpenAI        GPT-4o, GPT-4.1 etc.${R}`);
  console.log(`  ${D}4)  Gemini        Google Gemini 2.x${R}`);
  console.log(`  ${D}5)  Skip / Cancel${R}`);
  console.log();

  const choice = await ask('Enter number', '1');
  const envLines = [];

  if (choice === '5') {
    if (ownRL) rl.close();
    console.log(`\n${D}  Cancelled — no changes made.${R}\n`);
    return;
  }

  if (choice === '1') {
    console.log();
    console.log(`\n  ${G}Ollama Cloud${R} ${D}(recommended): uses ollama.com API — flat-rate, 47+ models.${R}`);
    console.log(`  ${D}Get your API key at: https://ollama.com/settings/api-keys${R}\n`);
    const cloudKey = await askSecret('OLLAMA_API_KEY (leave blank for local)', replRL);
    const host  = cloudKey ? 'https://ollama.com' : await ask('Ollama host', 'http://localhost:11434');
    const model = await ask('Default model', cloudKey ? 'devstral-2:123b' : 'qwen3-coder');
    envLines.push('DEFAULT_PROVIDER=ollama', `DEFAULT_MODEL=${model}`, `OLLAMA_HOST=${host}`);
    if (cloudKey) envLines.push(`OLLAMA_API_KEY=${cloudKey}`);
    process.env.DEFAULT_PROVIDER = 'ollama';
    process.env.DEFAULT_MODEL    = model;
    process.env.OLLAMA_HOST      = host;
    if (cloudKey) process.env.OLLAMA_API_KEY = cloudKey;

  } else if (choice === '2') {
    console.log();
    console.log(`  ${D}Get your key: https://console.anthropic.com/settings/keys${R}`);
    const key = await askSecret('ANTHROPIC_API_KEY', replRL);
    if (!key) { if (ownRL) rl.close(); console.log(`\n${Y}  No key entered — cancelled.${R}\n`); return; }
    const model = await ask('Default model', 'claude-sonnet-4-6');
    envLines.push('DEFAULT_PROVIDER=anthropic', `DEFAULT_MODEL=${model}`, `ANTHROPIC_API_KEY=${key}`);
    process.env.DEFAULT_PROVIDER   = 'anthropic';
    process.env.DEFAULT_MODEL      = model;
    process.env.ANTHROPIC_API_KEY  = key;

  } else if (choice === '3') {
    console.log();
    console.log(`  ${D}Get your key: https://platform.openai.com/api-keys${R}`);
    const key = await askSecret('OPENAI_API_KEY', replRL);
    if (!key) { if (ownRL) rl.close(); console.log(`\n${Y}  No key entered — cancelled.${R}\n`); return; }
    const model = await ask('Default model', 'gpt-4o');
    envLines.push('DEFAULT_PROVIDER=openai', `DEFAULT_MODEL=${model}`, `OPENAI_API_KEY=${key}`);
    process.env.DEFAULT_PROVIDER = 'openai';
    process.env.DEFAULT_MODEL    = model;
    process.env.OPENAI_API_KEY   = key;

  } else if (choice === '4') {
    console.log();
    console.log(`  ${D}Get your key: https://aistudio.google.com/app/apikey${R}`);
    const key = await askSecret('GEMINI_API_KEY', replRL);
    if (!key) { if (ownRL) rl.close(); console.log(`\n${Y}  No key entered — cancelled.${R}\n`); return; }
    const model = await ask('Default model', 'gemini-2.0-flash');
    envLines.push('DEFAULT_PROVIDER=gemini', `DEFAULT_MODEL=${model}`, `GEMINI_API_KEY=${key}`);
    process.env.DEFAULT_PROVIDER = 'gemini';
    process.env.DEFAULT_MODEL    = model;
    process.env.GEMINI_API_KEY   = key;
  }

  // ── Optional: Perplexity for grounded web search ─────────
  console.log();
  const addPerplexity = await ask('Add Perplexity key for grounded web search? (y/N)', 'n');
  if (addPerplexity.toLowerCase() === 'y') {
    console.log(`  ${D}Get your key: https://www.perplexity.ai/settings/api${R}`);
    const pKey = await askSecret('PERPLEXITY_API_KEY', replRL);
    if (pKey) {
      envLines.push(`PERPLEXITY_API_KEY=${pKey}`);
      process.env.PERPLEXITY_API_KEY = pKey;
    }
  }

  // ── Save to .env ──────────────────────────────────────────
  console.log();
  const envPath = path.join(process.cwd(), '.env');
  const saveDefault = fs.existsSync(envPath) ? 'y' : 'y';
  const save = await ask(`Save to ${envPath}? (Y/n)`, saveDefault);
  if (ownRL) rl.close();

  if (save.toLowerCase() !== 'n') {
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8').trimEnd() + '\n\n' : '';
    fs.writeFileSync(envPath, existing + envLines.join('\n') + '\n');
    // auto-add .env to .gitignore
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gi = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gi.split('\n').some(l => l.trim() === '.env')) {
        fs.appendFileSync(gitignorePath, '\n.env\n');
      }
    }
    console.log(`\n${G}  ✓ Saved to ${envPath}${R}`);
    if (envLines.some(l => l.includes('API_KEY'))) {
      console.log(`${D}  (key stored locally — never committed)${R}`);
    }
  }

  // Apply new model/provider for this session
  if (process.env.DEFAULT_PROVIDER) {
    try {
      const { setActiveModel } = require('./providers/registry');
      const spec = process.env.DEFAULT_MODEL
        ? `${process.env.DEFAULT_PROVIDER}:${process.env.DEFAULT_MODEL}`
        : process.env.DEFAULT_PROVIDER;
      setActiveModel(spec);
      console.log(`${G}  ✓ Switched to ${spec} for this session${R}`);
    } catch { /* registry not yet initialised (first-run) — will pick up env on init */ }
  }

  console.log(`\n${G}  ✓ Setup complete!${R}\n`);
}

module.exports = { runSetupWizard };

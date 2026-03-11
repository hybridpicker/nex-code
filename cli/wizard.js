/**
 * cli/wizard.js — Interactive Setup Wizard
 *
 * Guides users through creating .nex/servers.json and .nex/deploy.json.
 * Uses the active readline interface from the REPL if available,
 * or creates a temporary one.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { C } = require('./ui');

const NEX_DIR = '.nex';

// ─── Readline helper ──────────────────────────────────────────

let _rl = null;

/** Set the active readline interface (called from index.js REPL setup). */
function setWizardRL(rl) { _rl = rl; }

/**
 * Prompt for a value with optional default.
 * @param {string} question
 * @param {string} [defaultVal]
 * @returns {Promise<string>}
 */
function ask(question, defaultVal = '') {
  const hint = defaultVal ? ` ${C.dim}[${defaultVal}]${C.reset}` : '';
  const prompt = `  ${C.cyan}${question}${hint}${C.reset}: `;
  return new Promise((resolve) => {
    const handler = (answer) => {
      const val = answer.trim() || defaultVal;
      resolve(val);
    };
    if (_rl) {
      _rl.question(prompt, handler);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, (a) => { rl.close(); handler(a); });
    }
  });
}

/**
 * Prompt for a yes/no answer.
 * @param {string} question
 * @param {boolean} [defaultYes=true]
 * @returns {Promise<boolean>}
 */
function askBool(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  return ask(`${question} (${hint})`, defaultYes ? 'y' : 'n')
    .then((v) => v.toLowerCase() !== 'n' && v.toLowerCase() !== 'no');
}

/**
 * Prompt for a selection from a list.
 * @param {string} question
 * @param {string[]} options
 * @param {string} [defaultVal]
 * @returns {Promise<string>}
 */
async function askChoice(question, options, defaultVal) {
  const optStr = options.map((o, i) => `${C.dim}${i + 1})${C.reset} ${o}`).join('  ');
  console.log(`  ${C.cyan}${question}${C.reset}`);
  console.log(`  ${optStr}`);
  const defaultIdx = defaultVal ? options.indexOf(defaultVal) + 1 : 1;
  const raw = await ask('Enter number', String(defaultIdx));
  const idx = parseInt(raw, 10) - 1;
  return options[Math.max(0, Math.min(idx, options.length - 1))];
}

// ─── Wizard Flows ─────────────────────────────────────────────

/**
 * Interactive wizard: create/update .nex/servers.json
 * @returns {Promise<void>}
 */
async function runServerWizard() {
  const nexDir = path.join(process.cwd(), NEX_DIR);
  const serversPath = path.join(nexDir, 'servers.json');

  // Load existing configs
  let existing = {};
  if (fs.existsSync(serversPath)) {
    try { existing = JSON.parse(fs.readFileSync(serversPath, 'utf-8')); } catch { /* ignore */ }
  }

  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   nex-code Server Setup Wizard       ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════╝${C.reset}\n`);

  const existingNames = Object.keys(existing);
  if (existingNames.length > 0) {
    console.log(`${C.dim}Existing profiles: ${existingNames.join(', ')}${C.reset}`);
    const addMore = await askBool('Add or update a server profile?', true);
    if (!addMore) { console.log(`${C.dim}No changes made.${C.reset}\n`); return; }
  }

  const profiles = { ...existing };
  let addAnother = true;

  while (addAnother) {
    console.log(`\n${C.bold}─── New Server Profile ───${C.reset}`);

    const name = await ask('Profile name (e.g. prod, staging, macbook)');
    if (!name) { console.log(`${C.red}  Name is required.${C.reset}`); continue; }

    const host = await ask('Host / IP address');
    if (!host) { console.log(`${C.red}  Host is required.${C.reset}`); continue; }

    const user = await ask('SSH user', 'root');
    const portStr = await ask('SSH port', '22');
    const port = parseInt(portStr, 10) || 22;
    const key = await ask('SSH key path (leave empty for SSH agent)', '');
    const osType = await askChoice('Operating system', ['almalinux9', 'macos', 'ubuntu', 'debian', 'other'], 'almalinux9');
    const sudo = await askBool('Allow sudo commands?', true);

    const profile = { host, user };
    if (port !== 22) profile.port = port;
    if (key) profile.key = key;
    if (osType !== 'other') profile.os = osType;
    if (sudo) profile.sudo = true;

    profiles[name] = profile;
    console.log(`\n  ${C.green}✓${C.reset} Profile "${name}" added: ${user}@${host}${port !== 22 ? `:${port}` : ''}${osType !== 'other' ? ` [${osType}]` : ''}`);

    addAnother = await askBool('\nAdd another server?', false);
  }

  // Save servers.json
  if (!fs.existsSync(nexDir)) fs.mkdirSync(nexDir, { recursive: true });
  fs.writeFileSync(serversPath, JSON.stringify(profiles, null, 2) + '\n', 'utf-8');
  console.log(`\n${C.green}✓ Saved .nex/servers.json (${Object.keys(profiles).length} profile${Object.keys(profiles).length !== 1 ? 's' : ''})${C.reset}`);

  // Offer .gitignore update
  const giPath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(giPath)) {
    const gi = fs.readFileSync(giPath, 'utf-8');
    if (!gi.includes('.nex/')) {
      const addGi = await askBool('Add .nex/ to .gitignore?', true);
      if (addGi) {
        fs.appendFileSync(giPath, '\n# nex-code server profiles\n.nex/\n');
        console.log(`${C.green}✓ Added .nex/ to .gitignore${C.reset}`);
      }
    }
  }

  // Offer deploy config wizard
  const setupDeploy = await askBool('\nSet up deploy configs (.nex/deploy.json)?', false);
  if (setupDeploy) await runDeployWizard(profiles, nexDir);

  console.log(`\n${C.dim}Use /servers to list profiles, /servers ping to check connectivity.${C.reset}\n`);
}

/**
 * Interactive wizard: create/update .nex/deploy.json
 * @param {Object} [serverProfiles] - Already loaded server profiles for autocomplete
 * @param {string} [nexDir] - Path to .nex directory
 * @returns {Promise<void>}
 */
async function runDeployWizard(serverProfiles, nexDir) {
  const dir = nexDir || path.join(process.cwd(), NEX_DIR);
  const deployPath = path.join(dir, 'deploy.json');

  let existing = {};
  if (fs.existsSync(deployPath)) {
    try { existing = JSON.parse(fs.readFileSync(deployPath, 'utf-8')); } catch { /* ignore */ }
  }

  if (!serverProfiles) {
    const serversPath = path.join(dir, 'servers.json');
    if (fs.existsSync(serversPath)) {
      try { serverProfiles = JSON.parse(fs.readFileSync(serversPath, 'utf-8')); } catch { serverProfiles = {}; }
    } else {
      serverProfiles = {};
    }
  }

  const serverNames = Object.keys(serverProfiles);

  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   Deploy Config Wizard               ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════╝${C.reset}\n`);

  const existingNames = Object.keys(existing);
  if (existingNames.length > 0) {
    console.log(`${C.dim}Existing deploy configs: ${existingNames.join(', ')}${C.reset}`);
  }

  const configs = { ...existing };
  let addAnother = true;

  while (addAnother) {
    console.log(`\n${C.bold}─── New Deploy Config ───${C.reset}`);

    const name = await ask('Config name (e.g. prod, staging)');
    if (!name) { console.log(`${C.red}  Name is required.${C.reset}`); continue; }

    let server;
    if (serverNames.length > 0) {
      server = await askChoice('Target server', serverNames, serverNames[0]);
    } else {
      server = await ask('Target server (profile name or user@host)');
    }

    const localPath = await ask('Local path to sync (e.g. dist/ or ./build)', 'dist/');
    const remotePath = await ask('Remote destination path (e.g. /var/www/app)');
    if (!remotePath) { console.log(`${C.red}  Remote path is required.${C.reset}`); continue; }

    const deployScript = await ask('Deploy script to run after sync (leave empty to skip)', '');
    const excludeStr = await ask('Exclude paths (comma-separated, e.g. node_modules,.env)', 'node_modules,.env');
    const exclude = excludeStr ? excludeStr.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const config = { server, local_path: localPath, remote_path: remotePath };
    if (deployScript) config.deploy_script = deployScript;
    if (exclude.length > 0) config.exclude = exclude;

    configs[name] = config;

    const localDisp = localPath.endsWith('/') ? localPath : `${localPath}/`;
    console.log(`\n  ${C.green}✓${C.reset} Deploy config "${name}": ${localDisp} → ${server}:${remotePath}`);
    if (deployScript) console.log(`  ${C.dim}  Then: ${deployScript}${C.reset}`);

    addAnother = await askBool('\nAdd another deploy config?', false);
  }

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(deployPath, JSON.stringify(configs, null, 2) + '\n', 'utf-8');
  console.log(`\n${C.green}✓ Saved .nex/deploy.json (${Object.keys(configs).length} config${Object.keys(configs).length !== 1 ? 's' : ''})${C.reset}`);
  console.log(`${C.dim}Use: deploy prod  (or with explicit params)${C.reset}\n`);
}

module.exports = { runServerWizard, runDeployWizard, setWizardRL };

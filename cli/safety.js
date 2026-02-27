/**
 * cli/safety.js — Forbidden Patterns, Dangerous Commands, Confirm Logic
 */

const readline = require('readline');
const { C } = require('./ui');

const FORBIDDEN_PATTERNS = [
  /rm\s+-rf\s+\/(?:\s|$)/,
  /rm\s+-rf\s+~(?:\/|\s|$)/,
  /rm\s+-rf\s+\.(?:\/|\s|$)/,
  /rm\s+-rf\s+\*(?:\s|$)/,
  /mkfs/,
  /dd\s+if=/,
  /:\(\)\s*\{/,
  />\/dev\/sd/,
  /curl.*\|\s*(?:ba)?sh/,
  /wget.*\|\s*(?:ba)?sh/,
  /cat\s+.*\.env\b/,
  /cat\s+.*credentials/i,
  /chmod\s+777/,
  /chown\s+root/,
  /passwd/,
  /userdel/,
  /useradd/,
  /\beval\s*\(/,
  /base64.*\|.*bash/,
  // Environment variable exposure
  /\bprintenv\b/,
  // SSH key access
  /cat\s+.*\.ssh\/id_/,
  /cat\s+.*\.ssh\/config/,
  // Reverse shells
  /\bnc\s+-[el]/,
  /\bncat\b/,
  /\bsocat\b/,
  // Indirect code execution
  /python3?\s+-c\s/,
  /node\s+-e\s/,
  /perl\s+-e\s/,
  /ruby\s+-e\s/,
  // History access
  /\bhistory\b/,
  // Data exfiltration via POST
  /curl.*-X\s*POST/,
  /curl.*--data/,
];

const DANGEROUS_BASH = [
  /git\s+push/,
  /npm\s+publish/,
  /npx\s+.*publish/,
  /rm\s+-rf\s/,
  /docker\s+rm/,
  /docker\s+system\s+prune/,
  /kubectl\s+delete/,
  /sudo\s/,
  /ssh\s/,
  /wget\s/,
  /curl\s.*-o\s/,
  /pip\s+install/,
  /npm\s+install\s+-g/,
];

let autoConfirm = false;
let _rl = null;

function setAutoConfirm(val) {
  autoConfirm = val;
}

function getAutoConfirm() {
  return autoConfirm;
}

function setReadlineInterface(rl) {
  _rl = rl;
}

function isForbidden(command) {
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(command)) return pat;
  }
  return null;
}

function isDangerous(command) {
  for (const pat of DANGEROUS_BASH) {
    if (pat.test(command)) return true;
  }
  return false;
}

/**
 * @param {string} question
 * @param {{ toolName?: string }} [opts]
 * @returns {Promise<boolean>}
 *
 * Accepts: y / Enter (default yes) / a (always allow tool) / n
 */
function confirm(question, opts = {}) {
  if (autoConfirm) return Promise.resolve(true);
  const hint = opts.toolName ? '[Y/n/a] ' : '[Y/n] ';
  return new Promise((resolve) => {
    const handler = (answer) => {
      const a = answer.trim().toLowerCase();
      if (a === 'a' && opts.toolName) {
        _onAllowAlways(opts.toolName);
        resolve(true);
      } else {
        resolve(a !== 'n');
      }
    };
    if (_rl) {
      _rl.question(`${C.yellow}${question} ${hint}${C.reset}`, handler);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`${C.yellow}${question} ${hint}${C.reset}`, (answer) => {
        rl.close();
        handler(answer);
      });
    }
  });
}

let _onAllowAlways = () => {}; // set from outside
function setAllowAlwaysHandler(fn) { _onAllowAlways = fn; }

module.exports = {
  FORBIDDEN_PATTERNS,
  DANGEROUS_BASH,
  isForbidden,
  isDangerous,
  confirm,
  setAutoConfirm,
  getAutoConfirm,
  setReadlineInterface,
  setAllowAlwaysHandler,
};

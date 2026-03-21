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
  // History access — only standalone `history` command (not `dnf history`, `git log --history`, etc.)
  /(?:^|[;&|]\s*)history(?:\s|$)/,
  // Data exfiltration via POST
  /curl.*-X\s*POST/,
  /curl.*--data/,
];

// Paths protected from destructive bash operations (rm, mv, truncate, etc.)
// Mirrors SENSITIVE_PATHS from tools.js but applies to bash commands.
const BASH_PROTECTED_PATHS = [
  /\.env\b/,
  /credentials\b/i,
  /\.ssh\b/,
  /\.gnupg\b/,
  /\.aws\b/,
  /\.npmrc\b/,
  /\.docker\/config/,
  /\.kube\/config/,
  /venv\b/,
  /\.venv\b/,
  /\.sqlite3\b/,
  /\.git\/(?!hooks)/,
];

// Destructive command prefixes that target file paths
const DESTRUCTIVE_CMDS = /\b(?:rm|rmdir|unlink|truncate|shred|mv|cp)\b/;

// Read-only SSH patterns that are safe (no confirmation needed)
const SSH_SAFE_PATTERNS = [
  /systemctl\s+(status|is-active|is-enabled|list-units|show)/,
  /journalctl\b/,
  /\btail\s/,
  /\bcat\s/,
  /\bhead\s/,
  /\bls\b/,
  /\bfind\s/,
  /\bgrep\s/,
  /\bwc\s/,
  /\bdf\b/,
  /\bfree\b/,
  /\buptime\b/,
  /\bwho\b/,
  /\bps\s/,
  /\bgit\s+(status|log|diff|branch|fetch)\b/,
  /\bgit\s+pull\b/,
  // Server diagnostics
  /\bss\s+-[tlnp]/,
  /\bnetstat\s/,
  /\bdu\s/,
  /\blscpu\b/,
  /\bnproc\b/,
  /\buname\b/,
  /\bhostname\b/,
  /\bgetent\b/,
  /\bid\b/,
  // Database read-only
  /psql\s.*-c\s/,
  /\bmysql\s.*-e\s/,
  // Package manager read-only
  /\bdnf\s+(check-update|list|info|history|repolist|updateinfo)\b/,
  /\brpm\s+-q/,
  /\bapt\s+list\b/,
  // SSL / Certificates
  /\bopenssl\s+s_client\b/,
  /\bopenssl\s+x509\b/,
  /\bcertbot\s+certificates\b/,
  // Networking read-only
  /\bcurl\s+-[sIkv]|curl\s+--head/,
  /\bdig\s/,
  /\bnslookup\s/,
  /\bping\s/,
  // System info
  /\bgetenforce\b/,
  /\bsesearch\b/,
  /\bausearch\b/,
  /\bsealert\b/,
  /\bcrontab\s+-l\b/,
  /\btimedatectl\b/,
  /\bfirewall-cmd\s+--list/,
  /\bfirewall-cmd\s+--state/,
];

function isSSHReadOnly(command) {
  // Extract the remote command from ssh ... "remote command"
  const remoteCmd = command.match(/ssh\s+[^"]*"([^"]+)"/)?.[1] ||
                    command.match(/ssh\s+[^']*'([^']+)'/)?.[1];
  if (!remoteCmd) return false;

  // Collapse for/while loops into single tokens before splitting on && ;
  // This prevents "for x in a; do cmd; done" from being split incorrectly
  const collapsed = remoteCmd.replace(/\bfor\s[\s\S]*?\bdone\b/g, m => m.replace(/;/g, '\x00'))
                             .replace(/\bwhile\s[\s\S]*?\bdone\b/g, m => m.replace(/;/g, '\x00'));

  // Split compound commands on && ; and check each part
  const parts = collapsed.split(/\s*(?:&&|;)\s*/)
    .map(s => s.replace(/\x00/g, ';').trim())
    .filter(Boolean);

  // If there are no parts, not safe
  if (parts.length === 0) return false;

  const isSafePart = (part) => {
    // Strip sudo prefix: -u/-g/-C/-D take an argument, other flags don't
    const cleaned = part.replace(/^sudo\s+(?:-[ugCD]\s+\S+\s+|-[A-Za-z]+\s+)*/, '');
    // Allow echo/printf (output helpers)
    if (/^\s*(?:echo|printf)\s/.test(cleaned)) return true;
    // Allow for/while loops — check the loop body
    if (/^\s*for\s/.test(part) || /^\s*while\s/.test(part)) {
      // Extract the do...done body and check inner commands
      const body = part.match(/\bdo\s+([\s\S]*?)\s*(?:done|$)/)?.[1];
      if (body) {
        const innerParts = body.split(/\s*;\s*/).map(s => s.trim()).filter(Boolean);
        return innerParts.every(ip => isSafePart(ip));
      }
      // If we can't parse the body, check if any safe pattern matches anywhere in the loop
      return SSH_SAFE_PATTERNS.some(pat => pat.test(part));
    }
    // Allow variable assignments
    if (/^\w+=\$?\(/.test(cleaned) || /^\w+=["']/.test(cleaned) || /^\w+=\S/.test(cleaned)) return true;
    return SSH_SAFE_PATTERNS.some(pat => pat.test(cleaned));
  };

  return parts.every(isSafePart);
}

// Always re-prompt even after prior confirmation (bash='allow')
const CRITICAL_BASH = [
  /rm\s+-rf\s/,
  /docker\s+system\s+prune/,
  /kubectl\s+delete/,
  /sudo\s/,
  // Hook bypass — CLAUDE.md: NEVER use --no-verify
  /--no-verify\b/,
  // Destructive git operations — discard local work
  /git\s+reset\s+--hard\b/,
  /git\s+clean\s+-[a-z]*f/,      // git clean -f, -fd, -ffd, etc.
  /git\s+checkout\s+--\s/,        // git checkout -- <path> (discard changes)
  /git\s+push\s+(?:--force\b|-f\b)/, // force push (overwrites remote history)
];

// Show in first-confirmation preview only — no second blocking prompt
const NOTABLE_BASH = [
  /git\s+push/,
  /npm\s+publish/,
  // Hook bypass via env — equivalent to --no-verify
  /\bHUSKY=0\b/,
  /\bSKIP_HUSKY=1\b/,
  /\bSKIP_PREFLIGHT_CHECK=true\b/,
  /npx\s+.*publish/,
  /docker\s+rm/,
  /ssh\s/,
  /wget\s/,
  /curl\s.*-o\s/,
  /pip\s+install/,
  /npm\s+install\s+-g/,
];

const DANGEROUS_BASH = [...CRITICAL_BASH, ...NOTABLE_BASH];

let autoConfirm = false;
let _rl = null;
let _confirmHook = null;

function setAutoConfirm(val) {
  autoConfirm = val;
}

/**
 * Override the confirm() function with a custom hook (used by server mode).
 * @param {((question: string, opts: object) => Promise<boolean>) | null} fn
 */
function setConfirmHook(fn) {
  _confirmHook = fn;
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
  // SSH read-only commands are safe — skip confirmation
  if (/ssh\s/.test(command) && isSSHReadOnly(command)) return false;
  for (const pat of DANGEROUS_BASH) {
    if (pat.test(command)) return true;
  }
  return false;
}

function isCritical(command) {
  for (const pat of CRITICAL_BASH) {
    if (pat.test(command)) return true;
  }
  return false;
}

/**
 * Check if a bash command performs a destructive operation on a protected path.
 * Returns the matched path pattern or null.
 */
function isBashPathForbidden(command) {
  if (process.env.NEX_UNPROTECT === '1') return null;
  if (!DESTRUCTIVE_CMDS.test(command)) return null;
  for (const pat of BASH_PROTECTED_PATHS) {
    if (pat.test(command)) return pat;
  }
  return null;
}

/**
 * @param {string} question
 * @param {{ toolName?: string }} [opts]
 * @returns {Promise<boolean>}
 *
 * Interactive cursor menu (arrow keys + Enter). Shortcuts y/n/a still work.
 * Falls back to readline text input when stdin/stdout is not a TTY (tests, pipes).
 */
function confirm(question, opts = {}) {
  if (autoConfirm) return Promise.resolve(true);
  if (_confirmHook) return _confirmHook(question, opts);

  // Non-TTY fallback (piped input, test environment)
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return _confirmText(question, opts);
  }

  const options = opts.toolName
    ? ['Yes', 'No', 'Always allow']
    : ['Yes', 'No'];

  return new Promise((resolve) => {
    let selected = 0;
    let drawn = false;

    if (_rl) _rl.pause();

    const raw = global._nexRawWrite || ((d) => process.stdout.write(d));
    const render = () => {
      if (drawn) raw(`\x1b[${options.length + 1}A`);
      drawn = true;
      raw(`\r\x1b[K${C.yellow}${question}${C.reset}\n`);
      for (let i = 0; i < options.length; i++) {
        const sel = i === selected;
        const cursor = sel ? `${C.yellow}❯${C.reset}` : ' ';
        const label = sel ? `${C.yellow}${options[i]}${C.reset}` : options[i];
        raw(`\r\x1b[K  ${cursor} ${label}\n`);
      }
    };

    const cleanup = (result) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onKey);
      // Erase menu lines via rawWrite so the footer's row tracker is not
      // inflated by the \n characters in the erase sequence.
      const raw = global._nexRawWrite || ((d) => process.stdout.write(d));
      raw(`\x1b[${options.length + 1}A`);
      for (let i = 0; i < options.length + 1; i++) {
        raw(`\r\x1b[K\n`);
      }
      raw(`\x1b[${options.length + 1}A`);
      if (_rl) _rl.resume();
      resolve(result);
    };

    const choose = (idx) => {
      if (idx === 1) { cleanup(false); return; }
      if (idx === 2 && opts.toolName) _onAllowAlways(opts.toolName);
      cleanup(true);
    };

    const onKey = (key) => {
      if (key[0] === 0x03) { cleanup(false); return; } // Ctrl+C → No
      const str = key.toString();
      if (str === '\r' || str === '\n') { choose(selected); return; }
      if (str === '\x1b[A') { selected = (selected - 1 + options.length) % options.length; render(); return; } // ↑
      if (str === '\x1b[B') { selected = (selected + 1) % options.length; render(); return; } // ↓
      // Keyboard shortcuts
      const a = str.toLowerCase().trim();
      if (a === 'y') { cleanup(true); return; }
      if (a === 'n') { cleanup(false); return; }
      if (a === 'a' && opts.toolName) { _onAllowAlways(opts.toolName); cleanup(true); return; }
    };

    render();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onKey);
  });
}

/** Text-input fallback for non-TTY environments */
function _confirmText(question, opts) {
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
  BASH_PROTECTED_PATHS,
  SSH_SAFE_PATTERNS,
  isSSHReadOnly,
  DANGEROUS_BASH,
  CRITICAL_BASH,
  NOTABLE_BASH,
  isForbidden,
  isDangerous,
  isCritical,
  isBashPathForbidden,
  confirm,
  setAutoConfirm,
  getAutoConfirm,
  setConfirmHook,
  setReadlineInterface,
  setAllowAlwaysHandler,
};

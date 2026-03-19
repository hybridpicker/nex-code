/**
 * cli/theme.js — Adaptive Terminal Color Theme
 *
 * Auto-detects dark/light terminal background and provides a cohesive,
 * terminal-background-independent color palette for both modes.
 *
 * Detection priority:
 *   1. NEX_THEME=light|dark   — explicit override (env var)
 *   2. COLORFGBG env var      — "fg;bg": bg 0-6 = dark, 7+ = light
 *   3. OSC 11 query + cache   — queries actual terminal background colour
 *      Cached per TERM_SESSION_ID in ~/.nex-code/.theme_cache.json
 *   4. Default → dark
 */

'use strict';

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';

function rgb(r, g, b) { return `\x1b[38;2;${r};${g};${b}m`; }

// ── OSC 11 background-colour query ───────────────────────────────────────────

function _queryBgViaPython() {
  if (!process.stdout.isTTY) return null;
  try {
    const { execFileSync } = require('child_process');
    // Python3 script: set raw mode, send OSC 11 query, read response with 0.1 s timeout.
    // Uses bytes() literals to avoid any escape-sequence confusion inside the -c string.
    const script = [
      'import sys,os,tty,termios,select',
      "f=open('/dev/tty','r+b',buffering=0)",
      'fd=f.fileno()',
      's=termios.tcgetattr(fd)',
      'try:',
      ' tty.setraw(fd)',
      // ESC ] 1 1 ; ? ESC \
      ' f.write(bytes([0x1b,0x5d,0x31,0x31,0x3b,0x3f,0x1b,0x5c]))',
      ' r=select.select([fd],[],[],0.1)[0]',
      " d=b''",
      ' if r:',
      '  while True:',
      '   r2=select.select([fd],[],[],0.05)[0]',
      '   if not r2:break',
      '   c=os.read(fd,1)',
      '   d+=c',
      // stop at BEL (0x07) or ST (ESC \)
      '   if d[-1:]==bytes([0x07]) or d[-2:]==bytes([0x1b,0x5c]):break',
      ' sys.stdout.buffer.write(d)',
      'finally:',
      ' termios.tcsetattr(fd,termios.TCSADRAIN,s)',
      ' f.close()',
    ].join('\n');

    const out = execFileSync('python3', ['-c', script], {
      encoding: 'buffer',
      timeout: 400,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const text = out.toString('utf8');
    // Response format: rgb:RRRR/GGGG/BBBB  (4 hex digits each, first 2 = 8-bit value)
    const m = text.match(/rgb:([0-9a-fA-F]+)\/([0-9a-fA-F]+)\/([0-9a-fA-F]+)/);
    if (m) {
      const r = parseInt(m[1].slice(0, 2), 16);
      const g = parseInt(m[2].slice(0, 2), 16);
      const b = parseInt(m[3].slice(0, 2), 16);
      // Relative luminance: < 128 → dark background
      return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
    }
  } catch (e) { /* python3 not available or terminal doesn't support OSC 11 */ }
  return null;
}

// ── File cache keyed by TERM_SESSION_ID ──────────────────────────────────────

function _cacheFile() {
  const os   = require('os');
  const path = require('path');
  return path.join(os.homedir(), '.nex-code', '.theme_cache.json');
}

function _readCache(key) {
  try {
    const fs  = require('fs');
    const raw = fs.readFileSync(_cacheFile(), 'utf8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj[key] === 'boolean') return obj[key];
  } catch (e) {}
  return null;
}

function _writeCache(key, value) {
  try {
    const fs   = require('fs');
    const path = require('path');
    const file = _cacheFile();
    const dir  = path.dirname(file);
    let obj = {};
    try { obj = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
    obj[key] = value;
    // Keep the cache small — drop oldest entries when > 50 keys
    const keys = Object.keys(obj);
    if (keys.length > 50) keys.slice(0, keys.length - 50).forEach(k => delete obj[k]);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
  } catch (e) {}
}

// ── Main detection ────────────────────────────────────────────────────────────

function detectDarkBackground() {
  // 1. Explicit user override
  const nex = (process.env.NEX_THEME || '').toLowerCase();
  if (nex === 'light') return false;
  if (nex === 'dark')  return true;

  // 2. COLORFGBG ("foreground;background" — last segment is bg index)
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(';');
    const bg = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(bg)) return bg < 8;
  }

  // 3. OSC 11 query — cached per terminal session (TERM_SESSION_ID is unique
  //    per Apple Terminal window/tab; use 'default' for other terminals).
  const sessionKey = process.env.TERM_SESSION_ID || 'default';
  const cached = _readCache(sessionKey);
  if (cached !== null) return cached;

  // Cache miss → query the terminal directly
  const queried = _queryBgViaPython();
  const result  = queried !== null ? queried : true; // fallback: dark
  _writeCache(sessionKey, result);
  return result;
}

const isDark = detectDarkBackground();

// ── Dark Theme ───────────────────────────────────────────────────────────────
const DARK = {
  reset: RESET,
  bold:  BOLD,
  dim:   DIM,

  // Semantic
  primary:   rgb(80,  190, 255),  // sky blue
  secondary: rgb(60,  170, 190),  // teal
  success:   rgb(80,  210, 120),  // soft green
  warning:   rgb(245, 175,  50),  // amber
  error:     rgb(230,  80,  80),  // soft red
  muted:     DIM,
  subtle:    rgb(130, 130, 145),

  // Tool categories — RGB avoids terminal-background conflicts
  tool_read:     rgb(80,  190, 255),  // blue
  tool_write:    rgb(245, 165,  55),  // amber
  tool_exec:     rgb(185, 100, 235),  // purple
  tool_search:   rgb(70,  185, 190),  // teal
  tool_git:      rgb(90,  210, 100),  // green
  tool_web:      rgb(100, 215, 250),  // bright blue
  tool_sysadmin: rgb(225, 150,  75),  // orange
  tool_default:  rgb(100, 205, 115),  // fallback green

  // Syntax highlighting
  syn_keyword: rgb(185, 100, 235),
  syn_string:  rgb(90,  210, 120),
  syn_number:  rgb(245, 175,  50),
  syn_comment: DIM,
  syn_key:     rgb(80,  190, 255),

  // Diff
  diff_add: rgb(80,  210, 120),
  diff_rem: rgb(230,  80,  80),

  // Banner
  banner_logo:    rgb(80,  200, 255),
  banner_name:    rgb(80,  200, 255),
  banner_version: DIM,
  banner_model:   DIM,
  banner_yolo:    rgb(245, 175,  50),

  // Footer status bar
  footer_sep:     DIM,
  footer_model:   rgb(80,  175, 235),
  footer_branch:  rgb(80,  210, 100),
  footer_project: rgb(130, 130, 145),
  footer_divider: rgb(80,   80,  95),

  // Backward-compat raw ANSI keys (referenced directly in callers)
  white:         '\x1b[37m',
  red:           '\x1b[31m',
  green:         '\x1b[32m',
  yellow:        '\x1b[33m',
  blue:          '\x1b[34m',
  magenta:       '\x1b[35m',
  cyan:          '\x1b[36m',
  gray:          '\x1b[90m',
  bgRed:         '\x1b[41m',
  bgGreen:       '\x1b[42m',
  diff_add_bg:   '\x1b[48;2;10;46;20m',
  diff_rem_bg:   '\x1b[48;2;58;16;16m',
  brightCyan:    '\x1b[96m',
  brightMagenta: '\x1b[95m',
  brightBlue:    '\x1b[94m',
};

// ── Light Theme ──────────────────────────────────────────────────────────────
const LIGHT = {
  reset: RESET,
  bold:  BOLD,
  // CRITICAL: \x1b[2m (dim) is nearly invisible on white — use explicit grey
  dim:   rgb(110, 110, 120),

  primary:   rgb(0,  110, 190),
  secondary: rgb(0,  125, 148),
  success:   rgb(0,  148,  62),
  warning:   rgb(168,  92,   0),
  error:     rgb(188,  32,  32),
  muted:     rgb(110, 110, 120),
  subtle:    rgb(155, 155, 165),

  tool_read:     rgb(0,  110, 190),
  tool_write:    rgb(168,  92,   0),
  tool_exec:     rgb(128,  42, 188),
  tool_search:   rgb(0,  122, 148),
  tool_git:      rgb(0,  138,  62),
  tool_web:      rgb(0,  112, 178),
  tool_sysadmin: rgb(168,  82,   0),
  tool_default:  rgb(0,  138,  62),

  syn_keyword: rgb(128,  42, 188),
  syn_string:  rgb(0,  138,  62),
  syn_number:  rgb(168,  92,   0),
  syn_comment: rgb(135, 135, 148),
  syn_key:     rgb(0,  110, 190),

  diff_add: rgb(0,  148,  62),
  diff_rem: rgb(188,  32,  32),

  banner_logo:    rgb(0,  122, 205),
  banner_name:    rgb(0,  122, 205),
  banner_version: rgb(100, 100, 118),
  banner_model:   rgb(100, 100, 118),
  banner_yolo:    rgb(168,  62,   0),

  footer_sep:     rgb(168, 168, 178),
  footer_model:   rgb(0,  102, 175),
  footer_branch:  rgb(0,  138,  62),
  footer_project: rgb(135, 135, 148),
  footer_divider: rgb(168, 168, 178),

  // Backward-compat — darker variants readable on white backgrounds
  white:         rgb(40,  40,  52),
  red:           rgb(188,  32,  32),
  green:         rgb(0,  148,  62),
  yellow:        rgb(168,  92,   0),
  blue:          rgb(0,  110, 190),
  magenta:       rgb(128,  42, 188),
  cyan:          rgb(0,  125, 148),
  gray:          rgb(132, 132, 142),
  bgRed:         '\x1b[41m',
  bgGreen:       '\x1b[42m',
  diff_add_bg:   '\x1b[48;2;215;245;220m',
  diff_rem_bg:   '\x1b[48;2;255;215;215m',
  brightCyan:    rgb(0,  158, 182),
  brightMagenta: rgb(158,  52, 208),
  brightBlue:    rgb(0,  112, 208),
};

const T = isDark ? DARK : LIGHT;

module.exports = { T, isDark, DARK, LIGHT };

/**
 * cli/theme.js — Adaptive Terminal Color Theme
 *
 * Auto-detects dark/light terminal background and provides a cohesive,
 * terminal-background-independent color palette for both modes.
 *
 * Detection priority:
 *   1. COLORFGBG env var ("fg;bg") — bg 0-6 = dark, 7+ = light
 *   2. TERM_PROGRAM = Apple_Terminal → light (macOS default white bg)
 *   3. Default → dark (iTerm2, Ghostty, WezTerm, Alacritty, Hyper, etc.)
 */

'use strict';

const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';

function rgb(r, g, b) { return `\x1b[38;2;${r};${g};${b}m`; }

function detectDarkBackground() {
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(';');
    const bg = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(bg)) return bg < 8;
  }
  if (process.env.TERM_PROGRAM === 'Apple_Terminal') return false;
  return true;
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
  brightCyan:    rgb(0,  158, 182),
  brightMagenta: rgb(158,  52, 208),
  brightBlue:    rgb(0,  112, 208),
};

const T = isDark ? DARK : LIGHT;

module.exports = { T, isDark, DARK, LIGHT };

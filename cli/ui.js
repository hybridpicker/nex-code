/**
 * cli/ui.js — ANSI Colors, Banner, and Terminal Utilities
 * Rich terminal output with markdown rendering support
 */

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  white: '\x1b[37m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  brightCyan: '\x1b[96m',
  brightMagenta: '\x1b[95m',
  brightBlue: '\x1b[94m',
};

function colorLine(text, rgb) {
  // Color all visible chars in a line with a single RGB color
  return [...text].map(ch => {
    if (ch === ' ') return ch;
    return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${ch}`;
  }).join('') + C.reset;
}

function lerpColor(stops, t) {
  const seg = (stops.length - 1) * t;
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  return [
    Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f),
    Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f),
    Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f),
  ];
}

function banner(modelName, cwd, opts = {}) {
  const B = C.bold;
  const d = C.dim;
  const r = C.reset;

  const raw = [
    '███╗   ██╗███████╗██╗  ██╗  ━   ██████╗ ██████╗ ██████╗ ███████╗',
    '████╗  ██║██╔════╝╚██╗██╔╝  ━  ██╔════╝██╔═══██╗██╔══██╗██╔════╝',
    '██╔██╗ ██║█████╗   ╚███╔╝   ━  ██║     ██║   ██║██║  ██║█████╗',
    '██║╚██╗██║██╔══╝   ██╔██╗   ━  ██║     ██║   ██║██║  ██║██╔══╝',
    '██║ ╚████║███████╗██╔╝ ██╗  ━  ╚██████╗╚██████╔╝██████╔╝███████╗',
    '╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝  ━   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝',
  ];

  // Vertical gradient: Ice — White → Cyan → Deep Blue
  const stops = [[220, 240, 255], [80, 200, 255], [40, 100, 220]];
  const logo = raw.map((line, i) => {
    const t = i / (raw.length - 1 || 1);
    return colorLine(line, lerpColor(stops, t));
  }).join('\n');

  const yoloTag = opts.yolo ? `  ${B}${C.yellow}⚡ YOLO${r}` : '';

  console.log(`
${logo}
              ${d}Agentic Coding CLI  v${require('../package.json').version}${r}
              ${d}Model: ${modelName}${r}  ${d}·  /help${r}${yoloTag}
`);
}

// Re-exports from spinner.js and format.js for backward compatibility
const { Spinner, MultiProgress, TaskProgress, setActiveTaskProgress, getActiveTaskProgress, cleanupTerminal } = require('./spinner');
const { formatToolCall, formatResult, getToolSpinnerText, formatToolSummary } = require('./format');

module.exports = {
  C,
  banner,
  // Re-exported from spinner.js
  Spinner,
  MultiProgress,
  TaskProgress,
  setActiveTaskProgress,
  getActiveTaskProgress,
  cleanupTerminal,
  // Re-exported from format.js
  formatToolCall,
  formatResult,
  getToolSpinnerText,
  formatToolSummary,
};

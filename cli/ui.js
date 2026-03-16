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

// Dog mascot — compact 14×9 pixel art (1 = filled, 0 = background)
// Renders to 5 half-block rows
const DOG_MATRIX = [
  '00110000001100',  // ear tips
  '01111000011110',  // ear bases
  '01111111111110',  // top of head
  '01100111100110',  // face — eye gaps at cols 2-3 and 10-11
  '01111111111110',  // muzzle
  '00111111111100',  // upper body
  '00111111111100',  // body
  '00001100110000',  // legs
  '00001100110000',  // paws
];

function renderDog(matrix) {
  const color = '\x1b[38;2;80;200;255m'; // solid mid-cyan
  const lines = [];
  for (let r = 0; r < matrix.length; r += 2) {
    let line = '';
    for (let c = 0; c < matrix[0].length; c++) {
      const top = matrix[r][c] === '1';
      const bot = r + 1 < matrix.length && matrix[r + 1][c] === '1';
      if (top && bot)       line += `${color}█\x1b[0m`;
      else if (top && !bot) line += `${color}▀\x1b[0m`;
      else if (!top && bot) line += `${color}▄\x1b[0m`;
      else                  line += ' ';
    }
    lines.push(line);
  }
  return lines;
}

function banner(modelName, cwd, opts = {}) {
  const B = C.bold;
  const d = C.dim;
  const r = C.reset;
  const accent = '\x1b[38;2;80;200;255m'; // mid-gradient cyan

  const dogLines = renderDog(DOG_MATRIX);
  const yoloTag = opts.yolo ? `  ${B}${C.yellow}⚡ YOLO${r}` : '';
  const version = require('../package.json').version;

  // 5 text lines matching dog height — vertically centered
  const subtitles = [
    '',
    `   ${accent}${B}nex-code${r}`,
    `   ${d}Agentic Coding CLI  v${version}${r}`,
    `   ${d}${modelName}  ·  /help${r}${yoloTag}`,
    '',
  ];

  const total = Math.max(dogLines.length, subtitles.length);
  const dogOff  = Math.floor((total - dogLines.length) / 2);
  const textOff = Math.floor((total - subtitles.length) / 2);
  const dogWidth = DOG_MATRIX[0].length;

  const lines = [];
  for (let i = 0; i < total; i++) {
    const dog  = dogLines[i - dogOff]   ?? ' '.repeat(dogWidth);
    const text = subtitles[i - textOff] ?? '';
    lines.push(dog + text);
  }

  console.log('\n' + lines.join('\n') + '\n');
}

// Re-exports from spinner.js and format.js for backward compatibility
const { Spinner, MultiProgress, TaskProgress, setActiveTaskProgress, getActiveTaskProgress, cleanupTerminal } = require('./spinner');
const { formatToolCall, formatResult, getToolSpinnerText, formatToolSummary, formatSectionHeader } = require('./format');

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
  formatSectionHeader,
};

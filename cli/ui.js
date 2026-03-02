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

function banner(modelName, cwd, opts = {}) {
  const bc = C.brightCyan;
  const bm = C.brightMagenta;
  const bb = C.brightBlue;
  const B = C.bold;
  const d = C.dim;
  const r = C.reset;

  const logo = [
    `${bb}                    ${bc}⬢${bb} ━━━━━ ${bc}⬢${bb} ━━━━━ ${bm}⬢`,
    `${bb}              ⣀⠤⠒⠊⠁                     ⠈⠑⠒⠤⣀`,
    `${bm}        ⬢${bb}⡠⠊         ${bc}╭────────────────╮${bb}         ⠑⢄${bc}⬢`,
    `${bb}        ⡇           ${bc}│${bb} ───${B}${bc}≫${r}${bc}    ◉─┬─◉  │${bb}           ⢸`,
    `${bb}        ⡇           ${bc}│${bb} ──${B}${bc}≫≫${r}${bc}  ◉──┼──◉  │${bb}           ⢸`,
    `${bb}        ⡇           ${bc}│${bb} ──${B}${bc}≫≫${r}${bc}  ═══╪════  │${bb}           ⢸`,
    `${bb}        ⡇           ${bc}│${bb} ──${B}${bc}≫≫${r}${bc}  ◉──┼──◉  │${bb}           ⢸`,
    `${bb}        ⡇           ${bc}│${bb} ───${B}${bc}≫${r}${bc}    ◉─┴─◉  │${bb}           ⢸`,
    `${bm}        ⬢${bb}⢄⡀         ${bc}╰────────────────╯${bb}         ⢀⡠${bc}⬢`,
    `${bb}              ⠈⠑⠒⠤⣀                     ⣀⠤⠒⠑⠁`,
    `${bb}                    ${bm}⬢${bb} ━━━━━ ${bc}⬢${bb} ━━━━━ ${bm}⬢${r}`,
  ].join('\n');

  const yoloTag = opts.yolo ? `  ${B}${C.yellow}⚡ YOLO${r}` : '';

  console.log(`
${logo}
                 ${B}${bc}N E X   C O D E${r}  ${d}v0.3.0${r}
                 ${d}Agentic Coding CLI${r}
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

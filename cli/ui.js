/**
 * cli/ui.js — ANSI Colors, Spinner, Formatting
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

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

class Spinner {
  constructor(text = 'Thinking...') {
    this.text = text;
    this.frame = 0;
    this.interval = null;
  }

  start() {
    this.interval = setInterval(() => {
      const f = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
      process.stdout.write(`\r${C.cyan}${f}${C.reset} ${C.gray}${this.text}${C.reset}`);
      this.frame++;
    }, 80);
  }

  update(text) {
    this.text = text;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write('\r\x1b[K');
    }
  }
}

function banner(modelName, cwd) {
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

  console.log(`
${logo}
                 ${B}${bc}N E X   C O D E${r}  ${d}v0.3.0${r}
                 ${d}Agentic Coding CLI${r}
                 ${d}Model: ${modelName}${r}  ${d}·  /help${r}
`);
}

function formatToolCall(name, args) {
  let preview;
  switch (name) {
    case 'write_file':
      preview = `path=${args.path} (${(args.content || '').length} chars)`;
      break;
    case 'edit_file':
      preview = `path=${args.path}`;
      break;
    case 'bash':
      preview = args.command?.substring(0, 100) || '';
      break;
    default:
      preview = JSON.stringify(args).substring(0, 120);
  }
  return `${C.yellow}  ▸ ${name}${C.reset} ${C.dim}${preview}${C.reset}`;
}

function formatResult(text, maxLines = 8) {
  const lines = text.split('\n');
  const shown = lines.slice(0, maxLines);
  const more = lines.length - maxLines;
  let out = shown.map((l) => `${C.green}    ${l}${C.reset}`).join('\n');
  if (more > 0) out += `\n${C.gray}    ...+${more} more lines${C.reset}`;
  return out;
}

module.exports = { C, Spinner, banner, formatToolCall, formatResult };

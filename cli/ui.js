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
    this.startTime = null;
  }

  _render() {
    const f = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
    let elapsed = '';
    if (this.startTime) {
      const secs = Math.floor((Date.now() - this.startTime) / 1000);
      if (secs >= 1) elapsed = ` ${C.dim}${secs}s${C.reset}`;
    }
    process.stderr.write(`\x1b[2K\r${C.cyan}${f}${C.reset} ${C.dim}${this.text}${C.reset}${elapsed}`);
    this.frame++;
  }

  start() {
    this.startTime = Date.now();
    process.stderr.write('\x1b[?25l'); // hide cursor
    this._render(); // render first frame immediately
    this.interval = setInterval(() => this._render(), 80);
  }

  update(text) {
    this.text = text;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stderr.write('\x1b[2K\r'); // clear line
    process.stderr.write('\x1b[?25h'); // show cursor
    this.startTime = null;
  }
}

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

/**
 * Returns spinner text for a tool execution, or null if the tool
 * should not show a spinner (interactive or has its own spinner).
 */
function getToolSpinnerText(name, args) {
  switch (name) {
    // Tools with their own spinner or interactive UI — skip
    case 'bash':
    case 'ask_user':
    case 'write_file':
    case 'edit_file':
    case 'patch_file':
      return null;

    case 'read_file':
      return `Reading: ${args.path || 'file'}`;
    case 'list_directory':
      return `Listing: ${args.path || '.'}`;
    case 'search_files':
      return `Searching: ${args.pattern || '...'}`;
    case 'glob':
      return `Glob: ${args.pattern || '...'}`;
    case 'grep':
      return `Grep: ${args.pattern || '...'}`;
    case 'web_fetch':
      return `Fetching: ${(args.url || '').substring(0, 60)}`;
    case 'web_search':
      return `Searching web: ${(args.query || '').substring(0, 50)}`;
    case 'git_status':
      return 'Git status...';
    case 'git_diff':
      return `Git diff${args.file ? `: ${args.file}` : ''}...`;
    case 'git_log':
      return `Git log${args.file ? `: ${args.file}` : ''}...`;
    default:
      return `Running: ${name}`;
  }
}

module.exports = { C, Spinner, banner, formatToolCall, formatResult, getToolSpinnerText };

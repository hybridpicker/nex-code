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
const TASK_FRAMES = ['✽', '✦', '✧', '✦'];

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
    case 'task_list':
    case 'spawn_agents':
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

// ─── MultiProgress ────────────────────────────────────────────
const MULTI_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

class MultiProgress {
  /**
   * @param {string[]} labels - Labels for each parallel task
   */
  constructor(labels) {
    this.labels = labels;
    this.statuses = labels.map(() => 'running'); // 'running' | 'done' | 'error'
    this.frame = 0;
    this.interval = null;
    this.lineCount = labels.length;
  }

  _render() {
    const f = MULTI_FRAMES[this.frame % MULTI_FRAMES.length];
    let buf = '';

    for (let i = 0; i < this.labels.length; i++) {
      let icon, color;
      switch (this.statuses[i]) {
        case 'done':
          icon = `${C.green}✓${C.reset}`;
          color = C.dim;
          break;
        case 'error':
          icon = `${C.red}✗${C.reset}`;
          color = C.dim;
          break;
        default:
          icon = `${C.cyan}${f}${C.reset}`;
          color = '';
      }
      buf += `\x1b[2K  ${icon} ${color}${this.labels[i]}${C.reset}\n`;
    }

    // Move cursor back up to start of our block
    if (this.lineCount > 0) {
      buf += `\x1b[${this.lineCount}A`;
    }

    process.stderr.write(buf);
    this.frame++;
  }

  start() {
    process.stderr.write('\x1b[?25l'); // hide cursor
    // Write initial blank lines so we have room
    for (let i = 0; i < this.lineCount; i++) {
      process.stderr.write('\n');
    }
    if (this.lineCount > 0) {
      process.stderr.write(`\x1b[${this.lineCount}A`);
    }
    this._render();
    this.interval = setInterval(() => this._render(), 80);
  }

  /**
   * @param {number} index - Index of the task to update
   * @param {'running'|'done'|'error'} status
   */
  update(index, status) {
    if (index >= 0 && index < this.statuses.length) {
      this.statuses[index] = status;
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Final render to show final states
    this._renderFinal();
    process.stderr.write('\x1b[?25h'); // show cursor
  }

  _renderFinal() {
    let buf = '';
    for (let i = 0; i < this.labels.length; i++) {
      let icon;
      switch (this.statuses[i]) {
        case 'done':
          icon = `${C.green}✓${C.reset}`;
          break;
        case 'error':
          icon = `${C.red}✗${C.reset}`;
          break;
        default:
          icon = `${C.yellow}○${C.reset}`;
      }
      buf += `\x1b[2K  ${icon} ${C.dim}${this.labels[i]}${C.reset}\n`;
    }
    process.stderr.write(buf);
  }
}

// ─── TaskProgress ────────────────────────────────────────────
const TASK_ICONS = { done: '✔', in_progress: '◼', pending: '◻', failed: '✗' };
const TASK_COLORS = { done: C.green, in_progress: C.cyan, pending: C.dim, failed: C.red };

let _activeTaskProgress = null;

class TaskProgress {
  /**
   * @param {string} name - Header label for the task list
   * @param {Array<{id: string, description: string, status: string}>} tasks
   */
  constructor(name, tasks) {
    this.name = name;
    this.tasks = tasks.map(t => ({ id: t.id, description: t.description, status: t.status || 'pending' }));
    this.frame = 0;
    this.interval = null;
    this.startTime = null;
    this.tokens = 0;
    this.lineCount = 1 + this.tasks.length; // header + task lines
    this._paused = false;
  }

  _formatElapsed() {
    if (!this.startTime) return '';
    const totalSecs = Math.floor((Date.now() - this.startTime) / 1000);
    if (totalSecs < 1) return '';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
  }

  _formatTokens() {
    if (this.tokens <= 0) return '';
    if (this.tokens >= 1000) return `${(this.tokens / 1000).toFixed(1)}k`;
    return String(this.tokens);
  }

  _render() {
    const f = TASK_FRAMES[this.frame % TASK_FRAMES.length];
    const elapsed = this._formatElapsed();
    const tokStr = this._formatTokens();
    const stats = [elapsed, tokStr ? `↓ ${tokStr} tokens` : ''].filter(Boolean).join(' · ');
    const statsStr = stats ? ` ${C.dim}(${stats})${C.reset}` : '';

    let buf = `\x1b[2K${C.cyan}${f}${C.reset} ${this.name}…${statsStr}\n`;

    for (let i = 0; i < this.tasks.length; i++) {
      const t = this.tasks[i];
      const connector = i === 0 ? '⎿' : ' ';
      const icon = TASK_ICONS[t.status] || TASK_ICONS.pending;
      const color = TASK_COLORS[t.status] || TASK_COLORS.pending;
      const desc = t.description.length > 55 ? t.description.substring(0, 52) + '...' : t.description;
      buf += `\x1b[2K  ${C.dim}${connector}${C.reset}  ${color}${icon}${C.reset} ${desc}\n`;
    }

    // Move cursor back up
    buf += `\x1b[${this.lineCount}A`;
    process.stderr.write(buf);
    this.frame++;
  }

  start() {
    this.startTime = Date.now();
    this._paused = false;
    process.stderr.write('\x1b[?25l');
    // Reserve lines
    for (let i = 0; i < this.lineCount; i++) process.stderr.write('\n');
    process.stderr.write(`\x1b[${this.lineCount}A`);
    this._render();
    this.interval = setInterval(() => this._render(), 120);
    _activeTaskProgress = this;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (!this._paused) {
      this._renderFinal();
    }
    process.stderr.write('\x1b[?25h');
    this._paused = false;
    if (_activeTaskProgress === this) _activeTaskProgress = null;
  }

  /** Erase the block from stderr so text streaming can happen cleanly */
  pause() {
    if (this._paused) return;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Clear the lines we occupied
    for (let i = 0; i < this.lineCount; i++) {
      process.stderr.write('\x1b[2K\n');
    }
    process.stderr.write(`\x1b[${this.lineCount}A`);
    this._paused = true;
  }

  /** Re-reserve lines and restart animation after a pause */
  resume() {
    if (!this._paused) return;
    this._paused = false;
    process.stderr.write('\x1b[?25l');
    for (let i = 0; i < this.lineCount; i++) process.stderr.write('\n');
    process.stderr.write(`\x1b[${this.lineCount}A`);
    this._render();
    this.interval = setInterval(() => this._render(), 120);
  }

  /**
   * @param {string} id - Task ID
   * @param {string} status - 'pending' | 'in_progress' | 'done' | 'failed'
   */
  updateTask(id, status) {
    const t = this.tasks.find(task => task.id === id);
    if (t) t.status = status;
  }

  setStats({ tokens }) {
    if (tokens !== undefined) this.tokens = tokens;
  }

  isActive() {
    return this.interval !== null || this._paused;
  }

  _renderFinal() {
    const elapsed = this._formatElapsed();
    const done = this.tasks.filter(t => t.status === 'done').length;
    const failed = this.tasks.filter(t => t.status === 'failed').length;
    const total = this.tasks.length;
    const summary = failed > 0 ? `${done}/${total} done, ${failed} failed` : `${done}/${total} done`;

    let buf = `\x1b[2K${C.green}✔${C.reset} ${this.name} ${C.dim}(${elapsed} · ${summary})${C.reset}\n`;
    for (let i = 0; i < this.tasks.length; i++) {
      const t = this.tasks[i];
      const connector = i === 0 ? '⎿' : ' ';
      const icon = TASK_ICONS[t.status] || TASK_ICONS.pending;
      const color = TASK_COLORS[t.status] || TASK_COLORS.pending;
      const desc = t.description.length > 55 ? t.description.substring(0, 52) + '...' : t.description;
      buf += `\x1b[2K  ${C.dim}${connector}${C.reset}  ${color}${icon}${C.reset} ${C.dim}${desc}${C.reset}\n`;
    }
    process.stderr.write(buf);
  }
}

function setActiveTaskProgress(tp) {
  _activeTaskProgress = tp;
}

function getActiveTaskProgress() {
  return _activeTaskProgress;
}

/**
 * Restore terminal to a clean state (show cursor, clear spinner line).
 * Call this on SIGINT or unexpected exit to avoid broken terminal.
 */
function cleanupTerminal() {
  if (_activeTaskProgress) {
    _activeTaskProgress.stop();
    _activeTaskProgress = null;
  }
  process.stderr.write('\x1b[?25h');  // show cursor
  process.stderr.write('\x1b[2K\r'); // clear line
}

/**
 * Compact 1-line summary for a tool execution result.
 * Used by the agent loop in quiet mode.
 */
function formatToolSummary(name, args, result, isError) {
  const r = String(result || '');
  const icon = isError ? `${C.red}✗${C.reset}` : `${C.green}✓${C.reset}`;

  if (isError) {
    const errMsg = r.split('\n')[0].replace(/^ERROR:\s*/i, '').substring(0, 60);
    return `  ${icon} ${C.dim}${name}${C.reset} ${C.red}→ ${errMsg}${C.reset}`;
  }

  let detail;
  switch (name) {
    case 'read_file': {
      const lines = r.split('\n').filter(Boolean).length;
      detail = `${args.path || 'file'} (${lines} lines)`;
      break;
    }
    case 'write_file': {
      const chars = (args.content || '').length;
      detail = `${args.path || 'file'} (${chars} chars)`;
      break;
    }
    case 'edit_file':
      detail = `${args.path || 'file'} → edited`;
      break;
    case 'patch_file': {
      const n = (args.patches || []).length;
      detail = `${args.path || 'file'} (${n} patches)`;
      break;
    }
    case 'bash': {
      const cmd = (args.command || '').substring(0, 40);
      const suffix = (args.command || '').length > 40 ? '...' : '';
      if (r.includes('EXIT')) {
        const code = (r.match(/EXIT (\d+)/) || [])[1] || '?';
        detail = `${cmd}${suffix} → exit ${code}`;
      } else {
        detail = `${cmd}${suffix} → ok`;
      }
      break;
    }
    case 'grep':
    case 'search_files': {
      if (r.includes('(no matches)') || r === 'no matches') {
        detail = `${args.pattern || '...'} → no matches`;
      } else {
        const lines = r.split('\n').filter(Boolean).length;
        detail = `${args.pattern || '...'} → ${lines} matches`;
      }
      break;
    }
    case 'glob': {
      if (r === '(no matches)') {
        detail = `${args.pattern || '...'} → no matches`;
      } else {
        const files = r.split('\n').filter(Boolean).length;
        detail = `${args.pattern || '...'} → ${files} files`;
      }
      break;
    }
    case 'list_directory': {
      const entries = r === '(empty)' ? 0 : r.split('\n').filter(Boolean).length;
      detail = `${args.path || '.'} → ${entries} entries`;
      break;
    }
    case 'git_status': {
      const branchMatch = r.match(/Branch:\s*(\S+)/);
      const changeLines = r.split('\n').filter(l => /^\s*[MADRCU?!]/.test(l)).length;
      detail = branchMatch ? `${branchMatch[1]}, ${changeLines} changes` : 'done';
      break;
    }
    case 'git_diff':
    case 'git_log':
      detail = 'done';
      break;
    case 'web_fetch':
      detail = `${(args.url || '').substring(0, 50)} → fetched`;
      break;
    case 'web_search': {
      const blocks = r.split('\n\n').filter(Boolean).length;
      detail = `${(args.query || '').substring(0, 40)} → ${blocks} results`;
      break;
    }
    case 'task_list':
      detail = `${args.action || 'list'} → done`;
      break;
    case 'spawn_agents': {
      const n = (args.agents || []).length;
      detail = `${n} agents → done`;
      break;
    }
    default:
      detail = 'done';
  }

  return `  ${icon} ${C.dim}${name} ${detail}${C.reset}`;
}

module.exports = { C, Spinner, MultiProgress, TaskProgress, banner, formatToolCall, formatResult, formatToolSummary, getToolSpinnerText, cleanupTerminal, setActiveTaskProgress, getActiveTaskProgress };

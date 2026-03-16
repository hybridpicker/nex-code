/**
 * cli/spinner.js — Terminal Spinner and Progress Components
 * Spinner, MultiProgress, TaskProgress classes for animated terminal output
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

// Bouncing ball: positions 0→4→0 ping-pong along a fixed-width track
const BOUNCE_WIDTH = 5;
const BOUNCE_POSITIONS = (() => {
  const p = [];
  for (let i = 0; i < BOUNCE_WIDTH; i++) p.push(i);
  for (let i = BOUNCE_WIDTH - 2; i >= 1; i--) p.push(i);
  return p; // [0,1,2,3,4,3,2,1]
})();

const TASK_FRAMES = ['✽', '✦', '✧', '✦'];

class Spinner {
  constructor(text = 'Thinking...') {
    this.text = text;
    this.frame = 0;
    this.interval = null;
    this.startTime = null;
  }

  _render() {
    if (this._stopped) return;
    const pos = BOUNCE_POSITIONS[this.frame % BOUNCE_POSITIONS.length];
    // Build track: dim dots with a cyan ball at current position
    let track = '';
    for (let i = 0; i < BOUNCE_WIDTH; i++) {
      track += i === pos ? `${C.cyan}●${C.reset}` : ' ';
    }
    let elapsed = '';
    if (this.startTime) {
      const totalSecs = Math.floor((Date.now() - this.startTime) / 1000);
      if (totalSecs >= 60) {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        elapsed = ` ${C.dim}${mins}m ${String(secs).padStart(2, '0')}s${C.reset}`;
      } else if (totalSecs >= 1) {
        elapsed = ` ${C.dim}${totalSecs}s${C.reset}`;
      }
    }
    process.stderr.write(`\x1b[2K\r${track} ${C.dim}${this.text}${C.reset}${elapsed}`);
    this.frame++;
  }

  start() {
    this._stopped = false;
    this.startTime = Date.now();
    // Skip animation in non-TTY (headless) mode — no visual benefit, just overhead
    if (!process.stderr.isTTY) return;
    process.stderr.write('\x1b[?25l'); // hide cursor
    this._render(); // render first frame immediately
    this.interval = setInterval(() => this._render(), 300);
  }

  update(text) {
    this.text = text;
  }

  stop() {
    this._stopped = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (process.stderr.isTTY) {
      // Single write: clear line + show cursor (avoids flicker)
      process.stderr.write('\x1b[2K\r\x1b[?25h');
    }
    this.startTime = null;
  }
}

// ─── MultiProgress ────────────────────────────────────────────
// MultiProgress reuses the same bounce positions as the main Spinner

class MultiProgress {
  /**
   * @param {string[]} labels - Labels for each parallel task
   */
  constructor(labels) {
    this.labels = labels;
    this.statuses = labels.map(() => 'running'); // 'running' | 'done' | 'error'
    this.frame = 0;
    this.interval = null;
    this.startTime = null;
    this.lineCount = labels.length;
  }

  _formatElapsed() {
    if (!this.startTime) return '';
    const totalSecs = Math.floor((Date.now() - this.startTime) / 1000);
    if (totalSecs < 1) return '';
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
  }

  _render() {
    if (this._stopped) return;
    const pos = BOUNCE_POSITIONS[this.frame % BOUNCE_POSITIONS.length];
    const ball = `${C.cyan}●${C.reset}`;
    const empty = `${C.dim}○${C.reset}`;
    const elapsed = this._formatElapsed();
    const elapsedStr = elapsed ? ` ${C.dim}${elapsed}${C.reset}` : '';
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
          icon = i === pos ? ball : ' ';
          color = '';
      }
      // Show elapsed on last line only
      const suffix = (i === this.labels.length - 1) ? elapsedStr : '';
      buf += `\x1b[2K  ${icon} ${color}${this.labels[i]}${C.reset}${suffix}\n`;
    }

    // Move cursor back up to start of our block
    if (this.lineCount > 0) {
      buf += `\x1b[${this.lineCount}A`;
    }

    process.stderr.write(buf);
    this.frame++;
  }

  start() {
    this._stopped = false;
    this.startTime = Date.now();
    // Single buffered write: hide cursor + reserve lines + move back up
    let buf = '\x1b[?25l';
    for (let i = 0; i < this.lineCount; i++) buf += '\n';
    if (this.lineCount > 0) buf += `\x1b[${this.lineCount}A`;
    process.stderr.write(buf);
    this._render();
    this.interval = setInterval(() => this._render(), 300);
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
    this._stopped = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Final render to show final states
    this._renderFinal();
    process.stderr.write('\x1b[?25h'); // show cursor
  }

  _renderFinal() {
    const elapsed = this._formatElapsed();
    const elapsedStr = elapsed ? ` ${C.dim}${elapsed}${C.reset}` : '';
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
      const suffix = (i === this.labels.length - 1) ? elapsedStr : '';
      buf += `\x1b[2K  ${icon} ${C.dim}${this.labels[i]}${C.reset}${suffix}\n`;
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
    if (this._stopped) return;
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
    this._stopped = false;
    this.startTime = Date.now();
    this._paused = false;
    // Single buffered write: hide cursor + reserve lines + move back up
    let buf = '\x1b[?25l';
    for (let i = 0; i < this.lineCount; i++) buf += '\n';
    buf += `\x1b[${this.lineCount}A`;
    process.stderr.write(buf);
    this._render();
    this.interval = setInterval(() => this._render(), 120);
    _activeTaskProgress = this;
  }

  stop() {
    this._stopped = true;
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
    // Single buffered write: clear all occupied lines + move back up
    let buf = '';
    for (let i = 0; i < this.lineCount; i++) buf += '\x1b[2K\n';
    buf += `\x1b[${this.lineCount}A`;
    process.stderr.write(buf);
    this._paused = true;
  }

  /** Re-reserve lines and restart animation after a pause */
  resume() {
    if (!this._paused) return;
    this._paused = false;
    // Single buffered write: hide cursor + reserve lines + move back up
    let buf = '\x1b[?25l';
    for (let i = 0; i < this.lineCount; i++) buf += '\n';
    buf += `\x1b[${this.lineCount}A`;
    process.stderr.write(buf);
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
  // NOTE: do NOT removeAllListeners('keypress') — that kills readline's
  // internal Ctrl+C handler and breaks subsequent Ctrl+C presses.
  // picker.js cleans up its own listener; index.js adds only one.
  // Single write: show cursor + clear line (avoids flicker)
  process.stderr.write('\x1b[?25h\x1b[2K\r');
}

module.exports = { C, Spinner, MultiProgress, TaskProgress, setActiveTaskProgress, getActiveTaskProgress, cleanupTerminal };

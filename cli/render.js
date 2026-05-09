/**
 * cli/render.js — Rich Terminal Rendering
 * Markdown rendering, syntax highlighting, table formatting
 * Zero dependencies — uses ANSI escape codes directly
 */

const { C } = require("./ui");

// Terminal capability detection — UTF-8 support for box-drawing glyphs
let _unicodeOk = null;
function hasUnicode() {
  if (_unicodeOk !== null) return _unicodeOk;
  // Check locale environment variables for UTF-8
  const lang = (process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE || "").toLowerCase();
  if (lang.includes("utf-8") || lang.includes("utf8")) {
    _unicodeOk = true;
  } else {
    // Fallback: test if stdout handles multi-byte by writing a test char
    // (non-invasive — only when locale doesn't advertise UTF-8)
    try {
      if (process.stdout.isTTY && process.stdout.columns > 0) {
        _unicodeOk = true; // modern TTYs are overwhelmingly UTF-8
      } else {
        _unicodeOk = process.env.TERM ? !/^(vt100|vt220|ansi|xterm)$/.test(process.env.TERM) : true;
      }
    } catch {
      _unicodeOk = false;
    }
  }
  return _unicodeOk;
}

// Glyph helpers — return Unicode or ASCII fallback based on terminal capability
const G = {
  // Box-drawing
  tl: () => hasUnicode() ? "┌" : "+",
  tr: () => hasUnicode() ? "┐" : "+",
  bl: () => hasUnicode() ? "└" : "+",
  br: () => hasUnicode() ? "┘" : "+",
  h:  () => hasUnicode() ? "─" : "-",
  v:  () => hasUnicode() ? "│" : "|",
  // Blockquote
  bq: () => hasUnicode() ? "▎" : "|",
  // Icons
  dot:   () => hasUnicode() ? "●" : "*",
  error: () => hasUnicode() ? "✖" : "x",
  diamond: () => hasUnicode() ? "◆" : "#",
  doutline: () => hasUnicode() ? "◇" : "o",
  dcircle: () => hasUnicode() ? "◎" : "@",
  circle: () => hasUnicode() ? "○" : "o",
  bullet: () => hasUnicode() ? "•" : "-",
};

function getTerminalWidth() {
  return Math.max(10, (process.stdout.columns || 80) - 2);
}

/**
 * Render markdown-like text for terminal output
 * Supports: headers, bold, italic, code, code blocks, lists, links
 * @param {string} text
 * @returns {string}
 */
function renderMarkdown(text) {
  if (!text) return "";

  const lines = text.split("\n");
  const rendered = [];
  let inCodeBlock = false;
  let codeBlockLang = "";

  for (const line of lines) {
    const cols = getTerminalWidth();
    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        const bar = G.h().repeat(Math.min(cols - 1, 50));
        rendered.push(`${C.dim}${G.bl()}${bar}${C.reset}`);
        inCodeBlock = false;
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3).trim();
        const label = codeBlockLang ? ` ${codeBlockLang} ` : " code ";
        const bar = G.h().repeat(Math.max(0, Math.min(cols - label.length - 2, 50)));
        rendered.push(`${C.dim}${G.tl()}${label}${bar}${C.reset}`);
      }
      continue;
    }

    if (inCodeBlock) {
      rendered.push(`${C.dim}${G.v()}${C.reset} ${highlightCode(line, codeBlockLang)}`);
      continue;
    }

    // Headers (check longer prefixes first)
    if (line.startsWith("###### ")) {
      rendered.push(
        `${C.dim}${C.cyan}      ${stripHeadingMarkers(line.substring(7))}${C.reset}`,
      );
      continue;
    }
    if (line.startsWith("##### ")) {
      rendered.push(
        `${C.dim}${C.cyan}     ${stripHeadingMarkers(line.substring(6))}${C.reset}`,
      );
      continue;
    }
    if (line.startsWith("#### ")) {
      rendered.push(
        `${C.dim}${C.bold}    ${stripHeadingMarkers(line.substring(5))}${C.reset}`,
      );
      continue;
    }
    if (line.startsWith("### ")) {
      rendered.push(
        `${C.bold}${C.cyan}   ${stripHeadingMarkers(line.substring(4))}${C.reset}`,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      rendered.push(
        `${C.bold}${C.primary}  ${stripHeadingMarkers(line.substring(3))}${C.reset}`,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      const text = stripHeadingMarkers(line.substring(2));
      const bar = G.h().repeat(Math.min(text.length + 2, cols - 2));
      rendered.push(
        `\n${C.bold}${C.primary}  ${text}${C.reset}\n${C.dim}  ${bar}${C.reset}`,
      );
      continue;
    }

    // Horizontal rule
    if (/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      rendered.push(`${C.dim}${G.h().repeat(Math.min(cols, 50))}${C.reset}`);
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const indent = line.match(/^(\s*)/)[1];
      const content = line.replace(/^\s*>\s?/, "");
      const formatted = `${indent}${C.dim}${G.bq()}${C.reset} ${C.dim}${renderInline(content)}${C.reset}`;
      rendered.push(wrapAnsi(formatted, cols, indent + "  "));
      continue;
    }

    // Lists
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)[1];
      const content = line.replace(/^\s*[-*]\s/, "");
      const formatted = `${indent}${C.cyan}${G.bullet()}${C.reset} ${renderInline(content)}`;
      rendered.push(wrapAnsi(formatted, cols, indent + "  "));
      continue;
    }

    // Numbered lists
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)/);
      if (match) {
        const indent = match[1];
        const num = match[2];
        const content = match[3];
        const formatted = `${indent}${C.cyan}${num}.${C.reset} ${renderInline(content)}`;
        const hang = indent + " ".repeat(num.length + 2);
        rendered.push(wrapAnsi(formatted, cols, hang));
        continue;
      }
    }

    // Regular line
    rendered.push(wrapAnsi(renderInline(line), cols));
  }

  return rendered.join("\n");
}

/**
 * Strip inline markdown markers from heading text.
 * Headings are already bold+colored, so **bold** and *italic* markers
 * are redundant and look like noise in the terminal.
 */
function stripHeadingMarkers(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/**
 * Render inline markdown (bold, italic, code, links)
 * @param {string} text
 * @returns {string}
 */
function renderInline(text) {
  if (!text) return "";

  return (
    text
      // Inline code `code`
      .replace(/`([^`]+)`/g, `${C.cyan}$1${C.reset}`)
      // Bold **text**
      .replace(/\*\*([^*]+)\*\*/g, `${C.bold}$1${C.reset}`)
      // Italic *text*
      .replace(/\*([^*]+)\*/g, `${C.dim}$1${C.reset}`)
      // Links [text](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        `${C.cyan}$1${C.reset} ${C.dim}($2)${C.reset}`,
      )
  );
}

/**
 * Basic syntax highlighting for code
 * @param {string} line
 * @param {string} lang
 * @returns {string}
 */
function highlightCode(line, lang) {
  if (!line) return "";

  const jsLangs = ["js", "javascript", "ts", "typescript", "jsx", "tsx"];
  if (jsLangs.includes(lang) || !lang) {
    return highlightJS(line);
  }
  if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "zsh") {
    return highlightBash(line);
  }
  if (lang === "json" || lang === "jsonc") {
    return highlightJSON(line);
  }
  if (lang === "python" || lang === "py") {
    return highlightPython(line);
  }
  if (lang === "go" || lang === "golang") {
    return highlightGo(line);
  }
  if (lang === "rust" || lang === "rs") {
    return highlightRust(line);
  }
  if (lang === "css" || lang === "scss" || lang === "less") {
    return highlightCSS(line);
  }
  if (lang === "html" || lang === "xml" || lang === "svg" || lang === "htm") {
    return highlightHTML(line);
  }

  // Default: no highlighting
  return line;
}

function highlightJS(line) {
  const keywords =
    /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|require|async|await|new|this|throw|try|catch|switch|case|break|default|typeof|instanceof)\b/g;
  const strings = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(\/\/.*$)/;
  const numbers = /\b(\d+\.?\d*)\b/g;

  let result = line;
  // Order matters: comments last (they override everything)
  result = result.replace(numbers, `${C.yellow}$1${C.reset}`);
  result = result.replace(keywords, `${C.magenta}$1${C.reset}`);
  result = result.replace(strings, `${C.green}$&${C.reset}`);
  result = result.replace(comments, `${C.dim}$1${C.reset}`);

  return result;
}

function highlightBash(line) {
  const commands = /^(\s*)([\w-]+)/;
  const flags = /(--?\w[\w-]*)/g;
  const strings = /(["'])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(#.*$)/;

  let result = line;
  result = result.replace(flags, `${C.cyan}$1${C.reset}`);
  result = result.replace(commands, `$1${C.green}$2${C.reset}`);
  result = result.replace(strings, `${C.yellow}$&${C.reset}`);
  result = result.replace(comments, `${C.dim}$1${C.reset}`);

  return result;
}

function highlightJSON(line) {
  const keys = /("[\w-]+")\s*:/g;
  const strings = /:\s*("(?:[^"\\]|\\.)*")/g;
  const numbers = /:\s*(\d+\.?\d*)/g;
  const booleans = /:\s*(true|false|null)/g;

  let result = line;
  result = result.replace(keys, `${C.cyan}$1${C.reset}:`);
  result = result.replace(strings, `: ${C.green}$1${C.reset}`);
  result = result.replace(numbers, `: ${C.yellow}$1${C.reset}`);
  result = result.replace(booleans, `: ${C.magenta}$1${C.reset}`);

  return result;
}

function highlightPython(line) {
  const keywords =
    /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|async|await|nonlocal|global)\b/g;
  const strings =
    /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  const comments = /(#.*$)/;
  const numbers = /\b(\d+\.?\d*)\b/g;
  const decorators = /^(\s*@\w+)/;

  let result = line;
  result = result.replace(numbers, `${C.yellow}$1${C.reset}`);
  result = result.replace(keywords, `${C.magenta}$1${C.reset}`);
  result = result.replace(decorators, `${C.cyan}$1${C.reset}`);
  result = result.replace(strings, `${C.green}$&${C.reset}`);
  result = result.replace(comments, `${C.dim}$1${C.reset}`);

  return result;
}

function highlightGo(line) {
  const keywords =
    /\b(func|package|import|var|const|type|struct|interface|map|chan|go|defer|return|if|else|for|range|switch|case|default|break|continue|select|fallthrough|nil|true|false|make|new|len|cap|append|copy|delete|panic|recover)\b/g;
  const types =
    /\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error|any)\b/g;
  const strings = /(["'`])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(\/\/.*$)/;
  const numbers = /\b(\d+\.?\d*)\b/g;

  let result = line;
  result = result.replace(numbers, `${C.yellow}$1${C.reset}`);
  result = result.replace(types, `${C.cyan}$1${C.reset}`);
  result = result.replace(keywords, `${C.magenta}$1${C.reset}`);
  result = result.replace(strings, `${C.green}$&${C.reset}`);
  result = result.replace(comments, `${C.dim}$1${C.reset}`);

  return result;
}

function highlightRust(line) {
  const keywords =
    /\b(fn|let|mut|const|struct|enum|impl|trait|pub|use|mod|crate|self|super|match|if|else|for|while|loop|return|break|continue|where|as|in|ref|move|async|await|unsafe|extern|type|static|dyn|macro_rules)\b/g;
  const types =
    /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc|Self|Some|None|Ok|Err|true|false)\b/g;
  const strings = /(["'])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(\/\/.*$)/;
  const numbers = /\b(\d+\.?\d*)\b/g;
  const macros = /\b(\w+!)/g;

  let result = line;
  result = result.replace(numbers, `${C.yellow}$1${C.reset}`);
  result = result.replace(types, `${C.cyan}$1${C.reset}`);
  result = result.replace(keywords, `${C.magenta}$1${C.reset}`);
  result = result.replace(macros, `${C.yellow}$1${C.reset}`);
  result = result.replace(strings, `${C.green}$&${C.reset}`);
  result = result.replace(comments, `${C.dim}$1${C.reset}`);

  return result;
}

function highlightCSS(line) {
  const properties = /^(\s*)([\w-]+)\s*:/;
  const values = /:\s*([^;]+)/;
  const selectors = /^(\s*[.#@][\w-]+)/;
  const numbers = /\b(\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg|fr)?)\b/g;
  const comments = /(\/\*.*?\*\/|\/\/.*$)/;
  const colors = /(#[0-9a-fA-F]{3,8})\b/g;

  let result = line;
  result = result.replace(colors, `${C.yellow}$1${C.reset}`);
  result = result.replace(numbers, `${C.yellow}$1${C.reset}`);
  result = result.replace(properties, `$1${C.cyan}$2${C.reset}:`);
  result = result.replace(selectors, `$1${C.magenta}$&${C.reset}`);
  result = result.replace(comments, `${C.dim}$1${C.reset}`);

  return result;
}

function highlightHTML(line) {
  const tags = /<\/?(\w[\w-]*)/g;
  const attrs = /\s([\w-]+)=/g;
  const strings = /(["'])(?:(?=(\\?))\2.)*?\1/g;
  const comments = /(<!--.*?-->)/g;
  const entities = /(&\w+;)/g;

  let result = line;
  result = result.replace(comments, `${C.dim}$1${C.reset}`);
  result = result.replace(strings, `${C.green}$&${C.reset}`);
  result = result.replace(tags, `<${C.magenta}$1${C.reset}`);
  result = result.replace(attrs, ` ${C.cyan}$1${C.reset}=`);
  result = result.replace(entities, `${C.yellow}$1${C.reset}`);

  return result;
}

/**
 * Word-wrap a string containing ANSI escape codes.
 * Respects terminal width.
 * @param {string} str
 * @param {number} cols
 * @param {string} hangingIndent
 * @returns {string}
 */
function wrapAnsi(str, cols, hangingIndent = "") {
  if (!cols || cols < 10) return str;
  let out = "";
  let lineLen = 0;
  let lastSpaceIdx = -1;
  let i = 0;
  let lineStart = 0;
  const len = str.length;

  while (i < len) {
    if (str[i] === "\x1b") {
      let j = i + 1;
      if (j < len && str[j] === "[") {
        j++;
        while (j < len && !/[a-zA-Z]/.test(str[j])) j++;
        if (j < len) j++;
      }
      i = j;
      continue;
    }

    if (str[i] === " ") {
      lastSpaceIdx = i;
    }

    lineLen++;

    if (lineLen > cols && lastSpaceIdx !== -1) {
      out += str.slice(lineStart, lastSpaceIdx) + "\n" + hangingIndent;
      lineStart = lastSpaceIdx + 1; // skip space
      i = lineStart;
      lineLen = hangingIndent.length;
      lastSpaceIdx = -1;
      continue;
    }

    // Hard wrap if a single word is longer than cols
    if (lineLen > cols && lastSpaceIdx === -1) {
      out += str.slice(lineStart, i) + "\n" + hangingIndent;
      lineStart = i;
      lineLen = hangingIndent.length + 1;
    }

    i++;
  }

  out += str.slice(lineStart);
  return out;
}

/**
 * Render a table in the terminal
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
function renderTable(headers, rows) {
  if (!headers || headers.length === 0) return "";

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce(
      (max, row) => Math.max(max, (row[i] || "").length),
      0,
    );
    return Math.max(h.length, maxRow);
  });

  const V = G.v();
  const H = G.h();
  const CROSS = hasUnicode() ? "┼" : "+";
  const T_DOWN = hasUnicode() ? "┬" : "+";
  const T_UP = hasUnicode() ? "┴" : "+";
  const sep = widths.map((w) => H.repeat(w + 2)).join(CROSS);
  const headerLine = headers
    .map((h, i) => ` ${C.bold}${h.padEnd(widths[i])}${C.reset} `)
    .join(V);

  const lines = [];
  lines.push(`${C.dim}${G.tl()}${sep.replace(/\+/g, T_DOWN)}${G.tr()}${C.reset}`);
  lines.push(`${C.dim}${V}${C.reset}${headerLine}${C.dim}${V}${C.reset}`);
  lines.push(`${C.dim}${hasUnicode() ? "├" : "+"}${sep}${hasUnicode() ? "┤" : "+"}${C.reset}`);

  for (const row of rows) {
    const rowLine = headers
      .map((_, i) => ` ${(row[i] || "").padEnd(widths[i])} `)
      .join(`${C.dim}${V}${C.reset}`);
    lines.push(`${C.dim}${V}${C.reset}${rowLine}${C.dim}${V}${C.reset}`);
  }

  lines.push(`${C.dim}${G.bl()}${sep.replace(/\+/g, T_UP)}${G.br()}${C.reset}`);
  return lines.join("\n");
}

/**
 * Render a progress bar
 * @param {string} label
 * @param {number} current
 * @param {number} total
 * @param {number} width
 * @returns {string}
 */
function renderProgress(label, current, total, width = 30) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 100 ? C.green : pct > 50 ? C.yellow : C.cyan;

  return `  ${label} ${color}${"█".repeat(filled)}${C.dim}${"░".repeat(empty)}${C.reset} ${pct}% (${current}/${total})`;
}

/**
 * StreamRenderer — renders markdown line-by-line as tokens arrive.
 * Buffers partial lines, flushes complete lines with rendering.
 */
class StreamRenderer {
  constructor() {
    this.buffer = "";
    this.inCodeBlock = false;
    this.codeBlockLang = "";
    this.lineCount = 0;
    // Streaming cursor state
    this._cursorTimer = null;
    this._cursorFrame = 0;
    this._cursorActive = false;
  }

  /** Write to stdout, silently ignoring EPIPE errors after abort */
  _safeWrite(data) {
    try {
      this.lineCount += (data.match(/\n/g) || []).length;
      process.stdout.write(data);
    } catch (e) {
      if (e.code !== "EPIPE") throw e;
    }
  }

  /** Write to stderr (same stream as Spinner) for cursor animation */
  _cursorWrite(data) {
    try {
      process.stderr.write(data);
    } catch (e) {
      if (e.code !== "EPIPE") throw e;
    }
  }

  startCursor() {
    // Skip cursor animation in non-TTY (headless) mode
    if (!process.stderr.isTTY) return;
    this._cursorActive = true;
    this._cursorFrame = 0;
    this._cursorWrite("\x1b[?25l"); // hide terminal cursor
    this._renderCursor();
    this._cursorTimer = setInterval(() => this._renderCursor(), 100);
  }

  _renderCursor() {
    // Bouncing ball — matches the Thinking... spinner style
    const BOUNCE_WIDTH = 5;
    const BOUNCE_POSITIONS = [0, 1, 2, 3, 4, 3, 2, 1];
    const pos = BOUNCE_POSITIONS[this._cursorFrame % BOUNCE_POSITIONS.length];
    let track = "";
    for (let i = 0; i < BOUNCE_WIDTH; i++) {
      track += i === pos ? `${require("./theme").T.cyan}●${require("./theme").T.reset}` : " ";
    }
    this._cursorWrite(`\x1b[2K\r${track}`);
    this._cursorFrame++;
  }

  _clearCursorLine() {
    if (this._cursorActive) {
      this._cursorWrite("\x1b[2K\r");
    }
  }

  stopCursor() {
    if (this._cursorTimer) {
      clearInterval(this._cursorTimer);
      this._cursorTimer = null;
    }
    if (this._cursorActive) {
      this._cursorWrite("\x1b[2K\r\x1b[?25h"); // clear line + show terminal cursor
      this._cursorActive = false;
    }
  }

  /**
   * Push a token chunk into the stream renderer.
   * Renders complete lines immediately; buffers partial lines.
   */
  push(text) {
    if (!text) return;
    this._clearCursorLine();
    this.buffer += text;

    // Process all complete lines
    let nlIdx;
    while ((nlIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.substring(0, nlIdx);
      this.buffer = this.buffer.substring(nlIdx + 1);
      this._renderLine(line);
    }

    if (this._cursorActive) {
      this._renderCursor();
      if (this._cursorTimer) clearInterval(this._cursorTimer);
      this._cursorTimer = setInterval(() => this._renderCursor(), 100);
    }
  }

  /**
   * Flush remaining buffer content (call at end of stream).
   */
  flush() {
    this.stopCursor();
    if (this.buffer) {
      this._renderLine(this.buffer);
      this.buffer = "";
    }
    // Reset state
    if (this.inCodeBlock) {
      const cols = getTerminalWidth();
      this._safeWrite(`${C.dim}${G.bl()}${G.h().repeat(Math.min(cols - 1, 50))}${C.reset}\n`);
      this.inCodeBlock = false;
      this.codeBlockLang = "";
    }
  }

  _renderLine(line) {
    const cols = getTerminalWidth();

    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (this.inCodeBlock) {
        const bar = G.h().repeat(Math.min(cols - 1, 50));
        this._safeWrite(`${C.dim}${G.bl()}${bar}${C.reset}\n`);
        this.inCodeBlock = false;
        this.codeBlockLang = "";
      } else {
        this.inCodeBlock = true;
        this.codeBlockLang = line.trim().substring(3).trim();
        const label = this.codeBlockLang ? ` ${this.codeBlockLang} ` : " code ";
        const bar = G.h().repeat(Math.max(0, Math.min(cols - label.length - 2, 50)));
        this._safeWrite(`${C.dim}${G.tl()}${label}${bar}${C.reset}\n`);
      }
      return;
    }

    if (this.inCodeBlock) {
      this._safeWrite(`${C.dim}${G.v()}${C.reset} ${highlightCode(line, this.codeBlockLang)}\n`);
      return;
    }

    // Headers (check longer prefixes first)
    if (line.startsWith("###### ")) {
      this._safeWrite(
        `${C.dim}${C.cyan}      ${stripHeadingMarkers(line.substring(7))}${C.reset}\n`,
      );
      return;
    }
    if (line.startsWith("##### ")) {
      this._safeWrite(
        `${C.dim}${C.cyan}     ${stripHeadingMarkers(line.substring(6))}${C.reset}\n`,
      );
      return;
    }
    if (line.startsWith("#### ")) {
      this._safeWrite(
        `${C.dim}${C.bold}    ${stripHeadingMarkers(line.substring(5))}${C.reset}\n`,
      );
      return;
    }
    if (line.startsWith("### ")) {
      this._safeWrite(
        `${C.bold}${C.cyan}   ${stripHeadingMarkers(line.substring(4))}${C.reset}\n`,
      );
      return;
    }
    if (line.startsWith("## ")) {
      this._safeWrite(
        `${C.bold}${C.primary}  ${stripHeadingMarkers(line.substring(3))}${C.reset}\n`,
      );
      return;
    }
    if (line.startsWith("# ")) {
      const text = stripHeadingMarkers(line.substring(2));
      const bar = G.h().repeat(Math.min(text.length + 2, cols - 2));
      this._safeWrite(
        `\n${C.bold}${C.primary}  ${text}${C.reset}\n${C.dim}  ${bar}${C.reset}\n`,
      );
      return;
    }

    // Horizontal rule
    if (/^(\s*)(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      this._safeWrite(`${C.dim}${G.h().repeat(Math.min(cols, 50))}${C.reset}\n`);
      return;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const indent = line.match(/^(\s*)/)[1];
      const content = line.replace(/^\s*>\s?/, "");
      const formatted = `${indent}${C.dim}${G.bq()}${C.reset} ${C.dim}${renderInline(content)}${C.reset}`;
      const wrapped = wrapAnsi(formatted, cols, indent + "  ");
      this._safeWrite(`${wrapped}\n`);
      return;
    }

    // Lists
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)[1];
      const content = line.replace(/^\s*[-*]\s/, "");
      const formatted = `${indent}${C.cyan}•${C.reset} ${renderInline(content)}`;
      const wrapped = wrapAnsi(formatted, cols, indent + "  ");
      this._safeWrite(`${wrapped}\n`);
      return;
    }

    // Numbered lists
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)/);
      if (match) {
        const indent = match[1];
        const num = match[2];
        const content = match[3];
        const formatted = `${indent}${C.cyan}${num}.${C.reset} ${renderInline(content)}`;
        const hang = indent + " ".repeat(num.length + 2);
        const wrapped = wrapAnsi(formatted, cols, hang);
        this._safeWrite(`${wrapped}\n`);
        return;
      }
    }

    // Regular line
    const wrapped = wrapAnsi(renderInline(line), cols);
    this._safeWrite(`${wrapped}\n`);
  }
}


/**
 * Render a directory tree with colored entries.
 * @param {string} rootPath - absolute path to root
 * @param {object} options
 * @param {number} [options.maxDepth=4] - max directory depth
 * @param {number} [options.maxFiles=60] - max total entries
 * @param {Set<string>} [options.highlight] - files to highlight (e.g. modified)
 * @param {Set<string>} [options.dim] - files to dim (e.g. already scanned)
 * @param {boolean} [options.icons=true] - show file-type icons
 * @returns {string}
 */
function renderTree(rootPath, options = {}) {
  const { maxDepth = 4, maxFiles = 60, highlight = new Set(), dim = new Set(), icons = true } = options;
  const fs = require("fs");
  const path = require("path");
  
  // Patterns to skip
  const SKIP = new Set([
    ".git", "node_modules", ".next", "__pycache__", ".venv", "venv",
    ".cache", "dist", ".nex", "coverage", ".DS_Store", "target",
  ]);
  
  // Icon + color by extension
  function fileIcon(name, isDir) {
    if (!icons) return "";
    if (isDir) return "📁 ";
    const ext = path.extname(name).toLowerCase();
    const map = {
      ".js": "📜 ", ".ts": "🔷 ", ".jsx": "⚛ ", ".tsx": "🔶 ",
      ".py": "🐍 ", ".rs": "🦀 ", ".go": "🔵 ",
      ".css": "🎨 ", ".scss": "🎨 ", ".html": "🌐 ",
      ".md": "📝 ", ".json": "📋 ", ".toml": "⚙ ", ".yml": "⚙ ", ".yaml": "⚙ ",
      ".sh": "⚡ ", ".env": "🔒 ", ".svg": "🖼 ",
      ".test.js": "🧪 ", ".test.ts": "🧪 ", ".spec.js": "🧪 ",
    };
    return map[ext] || map[name] || "📄 ";
  }
  
  function colorByExt(name, isDir) {
    if (isDir) return C.cyan;
    const ext = path.extname(name).toLowerCase();
    if (/\.(js|ts|jsx|tsx)$/.test(ext)) return C.yellow;
    if (/\.(py|rs|go|java|rb)$/.test(ext)) return C.green;
    if (/\.(css|scss|less)$/.test(ext)) return C.magenta;
    if (/\.(html|xml|svg)$/.test(ext)) return C.primary;
    if (/\.(md|txt|rst)$/.test(ext)) return C.white;
    if (/\.(json|toml|yml|yaml)$/.test(ext)) return C.subtle;
    if (/\.(sh|bash|zsh)$/.test(ext)) return C.success;
    return C.reset;
  }
  
  const lines = [];
  let count = 0;
  const h = hasUnicode();
  const BRANCH = h ? "├── " : "|-- ";
  const LAST = h ? "└── " : "`-- ";
  const PIPE = h ? "│   " : "|   ";
  const SPACE = "    ";
  
  const relRoot = path.relative(process.cwd(), rootPath) || ".";
  lines.push(`${C.bold}${C.cyan}${relRoot}${C.reset}`);
  
  function walk(dir, depth, prefix) {
    if (depth > maxDepth || count >= maxFiles) return;
    
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      lines.push(`${prefix}${BRANCH}${C.dim}(unreadable)${C.reset}`);
      return;
    }
    
    // Sort: dirs first, then alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    
    // Filter skip patterns
    entries = entries.filter(e => !SKIP.has(e.name) && !e.name.startsWith("."));
    
    // Limit entries per directory
    const MAX_PER_DIR = 20;
    const overflow = entries.length - MAX_PER_DIR;
    if (overflow > 0) entries = entries.slice(0, MAX_PER_DIR);
    
    for (let i = 0; i < entries.length; i++) {
      if (count >= maxFiles) {
        lines.push(`${prefix}${BRANCH}${C.dim}… +${overflow} more${C.reset}`);
        return;
      }
      
      const entry = entries[i];
      const isLast = i === entries.length - 1 && overflow <= 0;
      const conn = isLast ? LAST : BRANCH;
      const nextPrefix = prefix + (isLast ? SPACE : PIPE);
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(process.cwd(), fullPath);
      
      let style = C.reset;
      if (highlight.has(relPath)) style = C.yellow;
      else if (dim.has(relPath)) style = C.dim;
      else style = colorByExt(entry.name, entry.isDirectory());
      
      const icon = fileIcon(entry.name, entry.isDirectory());
      const name = entry.isDirectory() ? `${C.bold}${entry.name}/${C.reset}` : entry.name;
      
      lines.push(`${prefix}${conn}${style}${icon}${name}${C.reset}`);
      count++;
      
      if (entry.isDirectory()) {
        walk(fullPath, depth + 1, nextPrefix);
      }
    }
    
    if (overflow > 0) {
      lines.push(`${prefix}${BRANCH}${C.dim}… +${overflow} more${C.reset}`);
    }
  }
  
  walk(rootPath, 1, "");
  return lines.join("\n");
}

module.exports = {
  hasUnicode,
  G,
  renderTree,
  renderMarkdown,
  renderInline,
  stripHeadingMarkers,
  highlightCode,
  highlightJS,
  highlightBash,
  highlightJSON,
  highlightPython,
  highlightGo,
  highlightRust,
  highlightCSS,
  highlightHTML,
  renderTable,
  renderProgress,
  wrapAnsi,
  StreamRenderer,
};

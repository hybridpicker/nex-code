/**
 * cli/render.js — Rich Terminal Rendering
 * Markdown rendering, syntax highlighting, table formatting
 * Zero dependencies — uses ANSI escape codes directly
 */

const { C } = require('./ui');

/**
 * Render markdown-like text for terminal output
 * Supports: headers, bold, italic, code, code blocks, lists, links
 * @param {string} text
 * @returns {string}
 */
function renderMarkdown(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const rendered = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  for (const line of lines) {
    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        rendered.push(`${C.dim}${'─'.repeat(40)}${C.reset}`);
        inCodeBlock = false;
        codeBlockLang = '';
      } else {
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3).trim();
        const label = codeBlockLang ? ` ${codeBlockLang} ` : '';
        rendered.push(`${C.dim}${'─'.repeat(3)}${label}${'─'.repeat(Math.max(0, 37 - label.length))}${C.reset}`);
      }
      continue;
    }

    if (inCodeBlock) {
      rendered.push(`  ${highlightCode(line, codeBlockLang)}`);
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      rendered.push(`${C.bold}${C.cyan}   ${line.substring(4)}${C.reset}`);
      continue;
    }
    if (line.startsWith('## ')) {
      rendered.push(`${C.bold}${C.cyan}  ${line.substring(3)}${C.reset}`);
      continue;
    }
    if (line.startsWith('# ')) {
      rendered.push(`${C.bold}${C.cyan}${line.substring(2)}${C.reset}`);
      continue;
    }

    // Lists
    if (/^\s*[-*]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)[1];
      const content = line.replace(/^\s*[-*]\s/, '');
      rendered.push(`${indent}${C.cyan}•${C.reset} ${renderInline(content)}`);
      continue;
    }

    // Numbered lists
    if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+)\.\s(.*)/);
      if (match) {
        rendered.push(`${match[1]}${C.cyan}${match[2]}.${C.reset} ${renderInline(match[3])}`);
        continue;
      }
    }

    // Regular line
    rendered.push(renderInline(line));
  }

  return rendered.join('\n');
}

/**
 * Render inline markdown (bold, italic, code, links)
 * @param {string} text
 * @returns {string}
 */
function renderInline(text) {
  if (!text) return '';

  return text
    // Inline code `code`
    .replace(/`([^`]+)`/g, `${C.cyan}$1${C.reset}`)
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, `${C.bold}$1${C.reset}`)
    // Italic *text*
    .replace(/\*([^*]+)\*/g, `${C.dim}$1${C.reset}`)
    // Links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${C.cyan}$1${C.reset} ${C.dim}($2)${C.reset}`);
}

/**
 * Basic syntax highlighting for code
 * @param {string} line
 * @param {string} lang
 * @returns {string}
 */
function highlightCode(line, lang) {
  if (!line) return '';

  const jsLangs = ['js', 'javascript', 'ts', 'typescript', 'jsx', 'tsx'];
  if (jsLangs.includes(lang) || !lang) {
    return highlightJS(line);
  }
  if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
    return highlightBash(line);
  }
  if (lang === 'json') {
    return highlightJSON(line);
  }

  // Default: no highlighting
  return line;
}

function highlightJS(line) {
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|require|async|await|new|this|throw|try|catch|switch|case|break|default|typeof|instanceof)\b/g;
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

/**
 * Render a table in the terminal
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
function renderTable(headers, rows) {
  if (!headers || headers.length === 0) return '';

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const headerLine = headers.map((h, i) => ` ${C.bold}${h.padEnd(widths[i])}${C.reset} `).join('│');

  const lines = [];
  lines.push(`${C.dim}┌${sep.replace(/┼/g, '┬')}┐${C.reset}`);
  lines.push(`${C.dim}│${C.reset}${headerLine}${C.dim}│${C.reset}`);
  lines.push(`${C.dim}├${sep}┤${C.reset}`);

  for (const row of rows) {
    const rowLine = headers.map((_, i) => ` ${(row[i] || '').padEnd(widths[i])} `).join(`${C.dim}│${C.reset}`);
    lines.push(`${C.dim}│${C.reset}${rowLine}${C.dim}│${C.reset}`);
  }

  lines.push(`${C.dim}└${sep.replace(/┼/g, '┴')}┘${C.reset}`);
  return lines.join('\n');
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

  return `  ${label} ${color}${'█'.repeat(filled)}${C.dim}${'░'.repeat(empty)}${C.reset} ${pct}% (${current}/${total})`;
}

module.exports = {
  renderMarkdown,
  renderInline,
  highlightCode,
  highlightJS,
  highlightBash,
  highlightJSON,
  renderTable,
  renderProgress,
};

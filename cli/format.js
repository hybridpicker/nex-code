/**
 * cli/format.js — Terminal Formatting Functions
 * Tool summaries, result formatting, and color utilities
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
      const resultLines = r.split('\n').filter(Boolean);
      const count = resultLines.length;
      // Detect partial reads: last line number tells us total file size
      const lastLine = resultLines[resultLines.length - 1];
      const lastLineNum = lastLine ? parseInt(lastLine.match(/^(\d+):/)?.[1] || '0') : 0;
      const isPartial = args.line_start || args.line_end;
      if (isPartial && lastLineNum > count) {
        detail = `${args.path || 'file'} (lines ${args.line_start || 1}-${lastLineNum})`;
      } else {
        detail = `${args.path || 'file'} (${count} lines)`;
      }
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
      // Only match EXIT at the very start of the output (our error format)
      const exitMatch = r.match(/^EXIT (\d+)/);
      if (exitMatch) {
        detail = `${cmd}${suffix} → exit ${exitMatch[1]}`;
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

module.exports = { C, formatToolCall, formatResult, getToolSpinnerText, formatToolSummary };

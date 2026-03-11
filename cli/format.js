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
  let primary;
  switch (name) {
    case 'write_file': case 'edit_file': case 'patch_file':
    case 'read_file': case 'list_directory':
      primary = args.path || '';
      break;
    case 'bash':
      primary = (args.command || '').substring(0, 80);
      break;
    case 'grep': case 'search_files':
      primary = args.pattern
        ? `"${args.pattern}"${args.path ? ` in ${args.path}` : ''}`
        : '';
      break;
    case 'glob':
      primary = args.pattern || '';
      break;
    case 'web_fetch':
      primary = (args.url || '').substring(0, 60);
      break;
    case 'web_search':
      primary = (args.query || '').substring(0, 50);
      break;
    default:
      primary = JSON.stringify(args).substring(0, 80);
  }
  const argStr = primary ? `${C.dim}(${primary})${C.reset}` : '';
  return `${C.cyan}⏺${C.reset} ${C.bold}${name}${C.reset}${argStr}`;
}

function formatResult(text, maxLines = 8) {
  const lines = text.split('\n');
  const shown = lines.slice(0, maxLines);
  const more = lines.length - maxLines;
  const prefix0 = `${C.dim}  ⎿  ${C.reset}`;
  const prefixN = `     `;
  let out = shown.map((l, i) => `${i === 0 ? prefix0 : prefixN}${C.green}${l}${C.reset}`).join('\n');
  if (more > 0) out += `\n${C.gray}     …+${more} more lines${C.reset}`;
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
    case 'gh_run_list':
      return `GitHub Actions: listing runs${args.workflow ? ` (${args.workflow})` : ''}...`;
    case 'gh_run_view':
      return `GitHub Actions: run ${args.run_id}...`;
    case 'gh_workflow_trigger':
      return `GitHub Actions: trigger ${args.workflow}...`;
    case 'browser_open':
      return `Browser: opening ${(args.url || '').substring(0, 60)}...`;
    case 'browser_screenshot':
      return `Browser: screenshot ${(args.url || '').substring(0, 60)}...`;
    case 'browser_click':
      return `Browser: clicking ${args.text || args.selector || 'element'}...`;
    case 'browser_fill':
      return `Browser: filling ${args.selector || 'field'}...`;
    default:
      return `Running: ${name}`;
  }
}

/**
 * Compact 1-line summary for a tool execution result.
 * Displayed below the tool-call header as:  ⎿  Human-readable summary
 */
function formatToolSummary(name, args, result, isError) {
  const r = String(result || '');

  if (isError) {
    const errMsg = r.split('\n')[0].replace(/^ERROR:\s*/i, '').substring(0, 80);
    const hintMatch = r.match(/\nHINT: (.+)/);
    const hintStr = hintMatch ? `\n     ${C.dim}${hintMatch[1].substring(0, 100)}${C.reset}` : '';
    return `  ${C.red}⎿  ${errMsg}${C.reset}${hintStr}`;
  }

  let summary;
  switch (name) {
    case 'read_file': {
      const resultLines = r.split('\n').filter(Boolean);
      const count = resultLines.length;
      const lastLine = resultLines[resultLines.length - 1];
      const lastLineNum = lastLine ? parseInt(lastLine.match(/^(\d+):/)?.[1] || '0') : 0;
      const isPartial = args.line_start || args.line_end;
      if (isPartial && lastLineNum > count) {
        summary = `Read lines ${args.line_start || 1}–${lastLineNum}`;
      } else {
        summary = `Read ${count} line${count !== 1 ? 's' : ''}`;
      }
      break;
    }
    case 'write_file': {
      const lines = (args.content || '').split('\n').length;
      summary = `Wrote ${lines} line${lines !== 1 ? 's' : ''}`;
      break;
    }
    case 'edit_file':
      summary = 'Edited successfully';
      break;
    case 'patch_file': {
      const n = (args.patches || []).length;
      summary = `Applied ${n} patch${n !== 1 ? 'es' : ''}`;
      break;
    }
    case 'bash': {
      const exitMatch = r.match(/^EXIT (\d+)/);
      if (exitMatch) {
        const hintMatch = r.match(/\nHINT: (.+)/);
        summary = `Exit ${exitMatch[1]}${hintMatch ? ` — ${hintMatch[1].substring(0, 60)}` : ''}`;
      } else {
        const lines = r.split('\n').filter(Boolean);
        summary = lines.length > 1
          ? `${lines.length} lines output`
          : (lines[0] || '').substring(0, 70) || 'Done';
      }
      break;
    }
    case 'grep':
    case 'search_files': {
      if (r.includes('(no matches)') || r === 'no matches') {
        summary = 'No matches';
      } else {
        const count = r.split('\n').filter(Boolean).length;
        summary = `${count} match${count !== 1 ? 'es' : ''}`;
      }
      break;
    }
    case 'glob': {
      if (r === '(no matches)') {
        summary = 'No files found';
      } else {
        const count = r.split('\n').filter(Boolean).length;
        summary = `${count} file${count !== 1 ? 's' : ''} found`;
      }
      break;
    }
    case 'list_directory': {
      const count = r === '(empty)' ? 0 : r.split('\n').filter(Boolean).length;
      summary = `${count} entr${count !== 1 ? 'ies' : 'y'}`;
      break;
    }
    case 'git_status': {
      const branchMatch = r.match(/Branch:\s*(\S+)/);
      const changes = r.split('\n').filter(l => /^\s*[MADRCU?!]/.test(l)).length;
      summary = branchMatch
        ? `${branchMatch[1]} · ${changes} change${changes !== 1 ? 's' : ''}`
        : 'Done';
      break;
    }
    case 'git_diff': {
      const addLines = (r.match(/^\+[^+]/gm) || []).length;
      const delLines = (r.match(/^-[^-]/gm) || []).length;
      summary = addLines || delLines ? `+${addLines} −${delLines} lines` : 'No diff';
      break;
    }
    case 'git_log': {
      const commits = r.split('\n').filter(l => /^commit\s+[0-9a-f]{7}/.test(l)).length;
      summary = commits > 0 ? `${commits} commit${commits !== 1 ? 's' : ''}` : 'Log retrieved';
      break;
    }
    case 'web_fetch':
      summary = 'Fetched';
      break;
    case 'web_search': {
      const count = r.split('\n\n').filter(Boolean).length;
      summary = `${count} result${count !== 1 ? 's' : ''}`;
      break;
    }
    case 'task_list':
      summary = 'Done';
      break;
    case 'spawn_agents': {
      const doneCount = (r.match(/✓ Agent/g) || []).length;
      const failCount = (r.match(/✗ Agent/g) || []).length;
      summary = failCount > 0
        ? `${doneCount} done, ${failCount} failed`
        : `${doneCount} agent${doneCount !== 1 ? 's' : ''} done`;
      break;
    }
    case 'switch_model': {
      // Result is e.g. "Switched to ollama:devstral-small-2:24b"
      const switchMatch = r.match(/Switched to (.+)/);
      summary = switchMatch ? `→ ${switchMatch[1]}` : 'Done';
      break;
    }
    default:
      summary = 'Done';
  }

  return `  ${C.dim}⎿  ${summary}${C.reset}`;
}

module.exports = { C, formatToolCall, formatResult, getToolSpinnerText, formatToolSummary };

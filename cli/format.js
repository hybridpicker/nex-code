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

// Last 1-2 path segments for compact display: "src/utils/helper.js"
function _shortPath(p) {
  if (!p) return '';
  const parts = p.replace(/^\.\//, '').split('/');
  return parts.length > 1 ? parts.slice(-2).join('/') : parts[0];
}

// Bullet color per tool category
const TOOL_DOT_COLOR = {
  read_file:    '\x1b[36m',  // cyan
  list_directory:'\x1b[36m', // cyan
  write_file:   '\x1b[33m',  // yellow
  edit_file:    '\x1b[33m',  // yellow
  patch_file:   '\x1b[33m',  // yellow
  bash:         '\x1b[35m',  // magenta
  grep:         '\x1b[34m',  // blue
  search_files: '\x1b[34m',  // blue
  glob:         '\x1b[34m',  // blue
  git_commit:   '\x1b[32m',  // green
  git_push:     '\x1b[32m',  // green
  git_pull:     '\x1b[32m',  // green
  git_status:   '\x1b[32m',  // green
  git_diff:     '\x1b[32m',  // green
  git_log:      '\x1b[32m',  // green
  git_branch:   '\x1b[32m',  // green
  git_stash:    '\x1b[32m',  // green
  web_fetch:    '\x1b[96m',  // bright cyan
  web_search:   '\x1b[96m',  // bright cyan
};

// Human-readable labels for tool names
const TOOL_LABELS = {
  read_file:          'Read file',
  write_file:         'Write',
  edit_file:          'Update',
  patch_file:         'Update',
  list_directory:     'List directory',
  bash:               'Run command',
  grep:               'Search code',
  search_files:       'Search files',
  glob:               'Find files',
  web_fetch:          'Fetch URL',
  web_search:         'Web search',
  git_status:         'Git status',
  git_diff:           'Git diff',
  git_log:            'Git log',
  git_commit:         'Git commit',
  git_push:           'Git push',
  git_pull:           'Git pull',
  git_branch:         'Git branch',
  git_stash:          'Git stash',
  task_list:          'Task list',
  spawn_agents:       'Spawn agents',
  ask_user:           'Ask user',
  switch_model:       'Switch model',
  gh_run_list:        'GH Actions',
  gh_run_view:        'GH Actions',
  gh_workflow_trigger:'GH trigger',
  browser_open:       'Browser open',
  browser_screenshot: 'Screenshot',
  browser_click:      'Browser click',
  browser_fill:       'Browser fill',
  ssh_exec:           'SSH exec',
  ssh_upload:         'SSH upload',
  ssh_download:       'SSH download',
  service_manage:     'Service',
  service_logs:       'Service logs',
  container_list:     'Containers',
  container_logs:     'Container logs',
  container_exec:     'Container exec',
  brain_write:        'Brain write',
  deploy:             'Deploy',
  frontend_recon:     'Frontend recon',
};

// Section descriptions used in step headers (grouped action phrases)
const STEP_DESCRIPTIONS = {
  read_file:          'Reading file',
  write_file:         'Writing file',
  edit_file:          'Editing file',
  patch_file:         'Patching file',
  list_directory:     'Listing directory',
  bash:               'Running command',
  grep:               'Searching code',
  search_files:       'Searching files',
  glob:               'Finding files',
  web_fetch:          'Fetching content',
  web_search:         'Searching the web',
  git_status:         'Checking repository',
  git_diff:           'Analyzing changes',
  git_log:            'Reading git history',
  git_commit:         'Creating commit',
  git_push:           'Pushing changes',
  git_pull:           'Pulling changes',
  git_branch:         'Managing branches',
  git_stash:          'Stashing changes',
  task_list:          'Managing tasks',
  spawn_agents:       'Delegating to agents',
  ask_user:           'Awaiting input',
  switch_model:       'Switching model',
  gh_run_list:        'GitHub Actions',
  gh_run_view:        'GitHub Actions',
  gh_workflow_trigger:'Triggering workflow',
  browser_open:       'Opening browser',
  browser_screenshot: 'Taking screenshot',
  browser_click:      'Clicking element',
  browser_fill:       'Filling form',
  ssh_exec:           'Running on server',
  ssh_upload:         'Uploading to server',
  ssh_download:       'Downloading from server',
  service_manage:     'Managing service',
  service_logs:       'Reading service logs',
  container_list:     'Listing containers',
  container_logs:     'Reading container logs',
  container_exec:     'Running in container',
  brain_write:        'Saving to memory',
  deploy:             'Deploying',
  frontend_recon:     'Scanning design system',
};

/**
 * Build a meaningful section header from a list of prepared tool calls.
 * Falls back to "Step N" if no tools or no mapping found.
 */
function _dot(fnName, isError = false, frame = null) {
  if (isError) return `${C.red}●${C.reset}`;
  const col = TOOL_DOT_COLOR[fnName] || C.green;
  if (frame === 'blink') return `${col}\x1b[5m●\x1b[25m${C.reset}`;
  const char = frame !== null ? frame : '●';
  return `${col}${char}${C.reset}`;
}

function formatSectionHeader(prepared, stepNum, isError = false, frame = null) {
  const tools = (prepared || []).filter(p => p && p.canExecute !== false);

  if (tools.length === 0) {
    return `${_dot('', isError, frame)} Step ${stepNum}`;
  }

  if (tools.length === 1) {
    const t = tools[0];
    const a = t.args || {};
    const label = TOOL_LABELS[t.fnName] || t.fnName.replace(/_/g, ' ');
    let arg = '';
    if (a.path)         arg = _shortPath(a.path);
    else if (a.command) arg = String(a.command).substring(0, 60);
    else if (a.query)   arg = String(a.query).substring(0, 50);
    else if (a.pattern) arg = String(a.pattern).substring(0, 50);
    const argStr = arg ? `${C.dim}(${arg})${C.reset}` : '';
    return `${_dot(t.fnName, isError, frame)} ${C.bold}${label}${C.reset} ${argStr}`;
  }

  // Multi-tool: use first tool's color
  const firstFn = tools[0].fnName;
  const labels = [...new Set(tools.map(t => TOOL_LABELS[t.fnName] || t.fnName.replace(/_/g, ' ')))];
  const title = labels.length <= 3 ? labels.join(' · ') : `${tools.length} actions`;
  return `${_dot(firstFn, isError, frame)} ${title}`;
}

function formatToolCall(name, args) {
  let primary;
  switch (name) {
    case 'write_file': case 'edit_file': case 'patch_file':
    case 'read_file': case 'list_directory':
      primary = _shortPath(args.path);
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
  const label = TOOL_LABELS[name] || name.replace(/_/g, ' ');
  const argStr = primary ? ` ${C.dim}(${primary})${C.reset}` : '';
  return `${_dot(name)} ${C.bold}${label}${C.reset}${argStr}`;
}

function formatResult(text, maxLines = 8) {
  const lines = text.split('\n');
  const shown = lines.slice(0, maxLines);
  const more = lines.length - maxLines;
  const prefix0 = `${C.dim}  └  ${C.reset}`;
  const prefixN = `     `;
  let out = shown.map((l, i) => `${i === 0 ? prefix0 : prefixN}${C.green}${l}${C.reset}`).join('\n');
  if (more > 0) out += `\n${C.gray}     … +${more} lines${C.reset}`;
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
 * Displayed below the tool-call header as:  └ Human-readable summary
 */
function formatToolSummary(name, args, result, isError) {
  const r = String(result || '');

  if (isError) {
    const errMsg = r.split('\n')[0].replace(/^ERROR:\s*/i, '').substring(0, 80);
    const hintMatch = r.match(/\nHINT: (.+)/);
    const hintStr = hintMatch ? `\n     ${C.dim}${hintMatch[1].substring(0, 100)}${C.reset}` : '';
    return `  ${C.red}└ ${errMsg}${C.reset}${hintStr}`;
  }

  let summary;
  switch (name) {
    case 'read_file': {
      const resultLines = r.split('\n').filter(Boolean);
      const count = resultLines.length;
      const lastLine = resultLines[resultLines.length - 1];
      const lastLineNum = lastLine ? parseInt(lastLine.match(/^(\d+):/)?.[1] || '0') : 0;
      const isPartial = args.line_start || args.line_end;
      // First content line, strip line-number prefix (e.g. "42: code")
      const firstContent = (resultLines[0] || '').replace(/^\d+:\s*/, '').trim();
      const hint = firstContent ? ` ${C.dim}— ${firstContent.substring(0, 60)}${firstContent.length > 60 ? '…' : ''}${C.reset}` : '';
      if (isPartial && lastLineNum > count) {
        summary = `Read lines ${args.line_start || 1}–${lastLineNum}${hint}`;
      } else {
        summary = `Read ${count} line${count !== 1 ? 's' : ''}${hint}`;
      }
      break;
    }
    case 'write_file': {
      const lines = (args.content || '').split('\n').length;
      summary = `Wrote ${lines} line${lines !== 1 ? 's' : ''}`;
      break;
    }
    case 'edit_file': {
      const oldLines = (args.old_text || '').split('\n');
      const newLines = (args.new_text || '').split('\n');
      const removed = oldLines.length;
      const added = newLines.length;
      const PREVIEW = 3;
      const showOld = oldLines.slice(0, PREVIEW).filter(l => l.trim());
      const showNew = newLines.slice(0, PREVIEW).filter(l => l.trim());
      const diffLines = [];
      for (const l of showOld) diffLines.push(`${C.red}     - ${C.reset}${C.dim}${l.trimEnd().substring(0, 72)}${C.reset}`);
      if (oldLines.length > PREVIEW) diffLines.push(`${C.dim}     … +${oldLines.length - PREVIEW}${C.reset}`);
      for (const l of showNew) diffLines.push(`${C.green}     + ${C.reset}${C.dim}${l.trimEnd().substring(0, 72)}${C.reset}`);
      if (newLines.length > PREVIEW) diffLines.push(`${C.dim}     … +${newLines.length - PREVIEW}${C.reset}`);
      summary = `${C.reset}${C.red}−${removed}${C.reset}  ${C.green}+${added}${C.reset}` +
        (diffLines.length > 0 ? '\n' + diffLines.join('\n') : '');
      break;
    }
    case 'patch_file': {
      const patches = args.patches || [];
      const totalRemoved = patches.reduce((s, p) => s + (p.old_text || '').split('\n').length, 0);
      const totalAdded = patches.reduce((s, p) => s + (p.new_text || '').split('\n').length, 0);
      summary = `${C.reset}${patches.length} patch${patches.length !== 1 ? 'es' : ''}  ${C.red}−${totalRemoved}${C.reset}  ${C.green}+${totalAdded}${C.reset}`;
      break;
    }
    case 'bash': {
      const exitMatch = r.match(/^EXIT (\d+)/);
      if (exitMatch) {
        const code = exitMatch[1];
        const hintMatch = r.match(/\nHINT: (.+)/);
        if (hintMatch) {
          const icon2 = code === '0' ? `${C.green}✓${C.reset}` : `${C.red}✗ Exit ${code}${C.reset}`;
          summary = `${icon2} ${C.dim}— ${hintMatch[1].substring(0, 60)}${C.reset}`;
        } else {
          const outputLines = r.split('\n').filter(l => l && !l.startsWith('EXIT ') && l.trim());
          const firstOut = outputLines[0] ? ` ${C.dim}· ${outputLines[0].substring(0, 70)}${C.reset}` : '';
          const moreCount = outputLines.length > 1 ? ` ${C.dim}+${outputLines.length - 1}${C.reset}` : '';
          const icon = code === '0' ? `${C.green}✓${C.reset}` : `${C.red}✗ Exit ${code}${C.reset}`;
          summary = `${icon}${firstOut}${moreCount}`;
        }
      } else {
        const lines = r.split('\n').filter(Boolean);
        summary = lines.length > 1
          ? `${lines[0].substring(0, 60)} ${C.dim}+${lines.length - 1} more${C.reset}`
          : (lines[0] || '').substring(0, 70) || 'Done';
      }
      break;
    }
    case 'grep':
    case 'search_files': {
      if (r.includes('(no matches)') || r === 'no matches') {
        summary = 'No matches';
      } else {
        const lines = r.split('\n').filter(Boolean);
        const matchCount = lines.length;
        const files = new Set(lines.map(l => l.split(':')[0]).filter(Boolean));
        const fileCount = files.size;
        summary = fileCount > 1
          ? `${matchCount} match${matchCount !== 1 ? 'es' : ''} in ${fileCount} files`
          : `${matchCount} match${matchCount !== 1 ? 'es' : ''}`;
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
    case 'git_commit': {
      const hashMatch = r.match(/\[[\w./\-]+ ([0-9a-f]{7,})\]/);
      const msgMatch = r.match(/\[[\w./\-]+ [0-9a-f]+\]\s+(.+)/);
      summary = hashMatch
        ? `${hashMatch[1]}${msgMatch ? ` — ${msgMatch[1].substring(0, 55)}` : ''}`
        : 'Committed';
      break;
    }
    case 'git_push': {
      const branchMatch = r.match(/(?:->|→)\s*(\S+)/);
      summary = branchMatch ? `→ ${branchMatch[1]}` : 'Pushed';
      break;
    }
    case 'git_pull': {
      if (/Already up.to.date/i.test(r)) {
        summary = 'Already up to date';
      } else {
        const addLines = (r.match(/^\+/gm) || []).length;
        summary = addLines > 0 ? `Pulled · +${addLines} lines` : 'Pulled';
      }
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
      const switchMatch = r.match(/Switched to (.+)/);
      summary = switchMatch ? `→ ${switchMatch[1]}` : 'Done';
      break;
    }
    default:
      summary = 'Done';
  }

  return `  ${C.dim}└ ${summary}${C.reset}`;
}

module.exports = { C, formatToolCall, formatResult, getToolSpinnerText, formatToolSummary, formatSectionHeader };

/**
 * cli/format.js — Terminal Formatting Functions
 * Tool summaries, result formatting, and color utilities
 */

const { T } = require('./theme');
const C = T;

// Last 1-2 path segments for compact display: "src/utils/helper.js"
function _shortPath(p) {
  if (!p) return '';
  const parts = p.replace(/^\.\//, '').split('/');
  return parts.length > 1 ? parts.slice(-2).join('/') : parts[0];
}

// Bullet color per tool category — uses theme RGB values for terminal-bg independence
const TOOL_DOT_COLOR = {
  read_file:      T.tool_read,
  list_directory: T.tool_read,
  write_file:     T.tool_write,
  edit_file:      T.tool_write,
  patch_file:     T.tool_write,
  bash:           T.tool_exec,
  grep:           T.tool_search,
  search_files:   T.tool_search,
  glob:           T.tool_search,
  git_commit:     T.tool_git,
  git_push:       T.tool_git,
  git_pull:       T.tool_git,
  git_status:     T.tool_git,
  git_diff:       T.tool_git,
  git_log:        T.tool_git,
  git_branch:     T.tool_git,
  git_stash:      T.tool_git,
  web_fetch:      T.tool_web,
  web_search:     T.tool_web,
  sysadmin:       T.tool_sysadmin,
  ssh_exec:       T.tool_sysadmin,
  ssh_upload:     T.tool_sysadmin,
  ssh_download:   T.tool_sysadmin,
  deploy:         T.tool_sysadmin,
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
  if (isError) return `${T.error}●${T.reset}`;
  const col = TOOL_DOT_COLOR[fnName] || T.tool_default;
  if (frame === 'blink') return `${col}\x1b[5m●\x1b[25m${T.reset}`;
  const char = frame !== null ? frame : '●';
  return `${col}${char}${T.reset}`;
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
  const prefix0 = `${T.muted}  └  ${T.reset}`;
  const prefixN = `     `;
  let out = shown.map((l, i) => `${i === 0 ? prefix0 : prefixN}${T.success}${l}${T.reset}`).join('\n');
  if (more > 0) out += `\n${T.subtle}     … +${more} lines${T.reset}`;
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
    case 'sysadmin': {
      const srv = args.server && args.server !== 'local' ? ` [${args.server}]` : '';
      switch (args.action) {
        case 'audit':        return `Sysadmin${srv}: full audit...`;
        case 'disk_usage':   return `Sysadmin${srv}: disk usage ${args.path || '/'}...`;
        case 'process_list': return `Sysadmin${srv}: top processes (${args.sort_by || 'cpu'})...`;
        case 'network_status': return `Sysadmin${srv}: network status...`;
        case 'ssl_check':    return `Sysadmin${srv}: SSL check ${args.domain || args.cert_path || ''}...`;
        case 'log_tail':     return `Sysadmin${srv}: tail ${args.path || 'log'}...`;
        case 'find_large':   return `Sysadmin${srv}: find large files in ${args.path || '/'}...`;
        case 'service':      return `Sysadmin${srv}: service ${args.service_action || ''} ${args.service_name || ''}...`;
        case 'kill_process': return `Sysadmin${srv}: kill PID ${args.pid || args.process_name || '?'}...`;
        case 'journalctl':   return `Sysadmin${srv}: journal ${args.unit ? `[${args.unit}]` : ''}${args.since ? ` since ${args.since}` : ''}...`;
        case 'package':      return `Sysadmin${srv}: package ${args.package_action || ''} ${(args.packages || []).join(' ')}...`;
        case 'firewall':     return `Sysadmin${srv}: firewall ${args.firewall_action || ''}...`;
        case 'user_manage':  return `Sysadmin${srv}: user ${args.user_action || ''} ${args.user || ''}...`;
        case 'cron':         return `Sysadmin${srv}: cron ${args.cron_action || ''}...`;
        default:             return `Sysadmin${srv}: ${args.action}...`;
      }
    }
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
    const hintStr = hintMatch ? `\n     ${T.muted}${hintMatch[1].substring(0, 100)}${T.reset}` : '';
    return `  ${T.error}└ ${errMsg}${T.reset}${hintStr}`;
  }

  let summary;
  switch (name) {
    case 'read_file': {
      const resultLines = r.split('\n').filter(Boolean);
      const count = resultLines.length;
      const lastLine = resultLines[resultLines.length - 1];
      const lastLineNum = lastLine ? parseInt(lastLine.match(/^(\d+):/)?.[1] || '0') : 0;
      const isPartial = args.line_start || args.line_end;
      const fname = args.path ? require('path').basename(args.path) : null;
      const fileHint = fname ? ` ${T.muted}from ${fname}${T.reset}` : '';
      // First actual code line — skip the tool metadata header ("File: path (N lines, N bytes)")
      const codeLines = resultLines.filter(l => !/^File:\s/.test(l));
      const firstContent = (codeLines[0] || '').replace(/^\d+:\s*/, '').trim();
      const contentHint = firstContent ? ` ${C.dim}— ${firstContent.substring(0, 70)}${firstContent.length > 70 ? '…' : ''}${C.reset}` : '';
      if (isPartial && lastLineNum > count) {
        summary = `Read lines ${args.line_start || 1}–${lastLineNum}${fileHint}${contentHint}`;
      } else {
        summary = `Read ${count} line${count !== 1 ? 's' : ''}${fileHint}${contentHint}`;
      }
      break;
    }
    case 'write_file': {
      const lines = (args.content || '').split('\n').length;
      const fname = args.path ? require('path').basename(args.path) : null;
      summary = fname
        ? `Wrote ${fname} · ${lines} line${lines !== 1 ? 's' : ''}`
        : `Wrote ${lines} line${lines !== 1 ? 's' : ''}`;
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
      for (const l of showOld) diffLines.push(`${T.diff_rem}     - ${T.reset}${T.muted}${l.trimEnd().substring(0, 72)}${T.reset}`);
      if (oldLines.length > PREVIEW) diffLines.push(`${T.muted}     … +${oldLines.length - PREVIEW}${T.reset}`);
      for (const l of showNew) diffLines.push(`${T.diff_add}     + ${T.reset}${T.muted}${l.trimEnd().substring(0, 72)}${T.reset}`);
      if (newLines.length > PREVIEW) diffLines.push(`${T.muted}     … +${newLines.length - PREVIEW}${T.reset}`);
      summary = `${T.reset}${T.diff_rem}−${removed}${T.reset}  ${T.diff_add}+${added}${T.reset}` +
        (diffLines.length > 0 ? '\n' + diffLines.join('\n') : '');
      break;
    }
    case 'patch_file': {
      const patches = args.patches || [];
      const totalRemoved = patches.reduce((s, p) => s + (p.old_text || '').split('\n').length, 0);
      const totalAdded = patches.reduce((s, p) => s + (p.new_text || '').split('\n').length, 0);
      summary = `${T.reset}${patches.length} patch${patches.length !== 1 ? 'es' : ''}  ${T.diff_rem}−${totalRemoved}${T.reset}  ${T.diff_add}+${totalAdded}${T.reset}`;
      break;
    }
    case 'bash': {
      const BASH_PREVIEW = 6;
      const exitMatch = r.match(/^EXIT (\d+)/);
      const outputLines = r.split('\n').filter(l => l && !l.startsWith('EXIT ') && !l.startsWith('HINT:') && l.trim());
      const icon = exitMatch
        ? (exitMatch[1] === '0' ? `${T.success}✓${T.reset}` : `${T.error}✗ Exit ${exitMatch[1]}${T.reset}`)
        : `${T.success}✓${T.reset}`;
      const hintMatch = r.match(/\nHINT: (.+)/);
      if (hintMatch) {
        summary = `${icon} ${T.muted}— ${hintMatch[1].substring(0, 100)}${T.reset}`;
      } else if (outputLines.length === 0) {
        summary = icon;
      } else {
        const shown = outputLines.slice(0, BASH_PREVIEW);
        const more = outputLines.length - BASH_PREVIEW;
        const lines = shown.map((l, i) =>
          i === 0
            ? `${icon} ${T.muted}${l.substring(0, 120)}${T.reset}`
            : `     ${T.muted}${l.substring(0, 120)}${T.reset}`
        );
        if (more > 0) lines.push(`     ${T.subtle}… +${more} lines${T.reset}`);
        summary = lines.join('\n');
      }
      break;
    }
    case 'grep':
    case 'search_files': {
      if (r.includes('(no matches)') || r === 'no matches') {
        const patternHint = args.pattern ? ` ${T.muted}"${String(args.pattern).substring(0, 40)}"${T.reset}` : '';
        summary = `No matches${patternHint}`;
      } else {
        const lines = r.split('\n').filter(Boolean);
        const matchCount = lines.length;
        const files = new Set(lines.map(l => l.split(':')[0]).filter(Boolean));
        const fileCount = files.size;
        const patternHint = args.pattern ? ` ${T.muted}"${String(args.pattern).substring(0, 40)}"${T.reset}` : '';
        const header = fileCount > 1
          ? `${matchCount} match${matchCount !== 1 ? 'es' : ''} in ${fileCount} files${patternHint}`
          : `${matchCount} match${matchCount !== 1 ? 'es' : ''}${patternHint}`;
        const preview = lines.slice(0, 4).map((l, i) =>
          i === 0 ? `${header}\n     ${T.muted}${l.substring(0, 110)}${T.reset}`
                  : `     ${T.muted}${l.substring(0, 110)}${T.reset}`
        );
        const more = lines.length - 4;
        if (more > 0) preview.push(`     ${T.subtle}… +${more} lines${T.reset}`);
        summary = preview.join('\n');
      }
      break;
    }
    case 'glob': {
      const globPatternHint = args.pattern ? ` ${T.muted}${String(args.pattern).substring(0, 50)}${T.reset}` : '';
      if (r === '(no matches)') {
        summary = `No files found${globPatternHint}`;
      } else {
        const path = require('path');
        const allFiles = r.split('\n').filter(Boolean);
        const count = allFiles.length;
        const shown = allFiles.slice(0, 5).map(f => path.basename(f));
        const more = count - shown.length;
        const names = shown.join(', ') + (more > 0 ? `, +${more} more` : '');
        summary = `${count} file${count !== 1 ? 's' : ''}${globPatternHint} — ${T.muted}${names}${T.reset}`;
      }
      break;
    }
    case 'list_directory': {
      if (r === '(empty)') {
        summary = '0 entries';
      } else {
        const entries = r.split('\n').filter(Boolean);
        const count = entries.length;
        const shown = entries.slice(0, 6).join(', ');
        const more = count - 6;
        summary = more > 0
          ? `${count} entries — ${T.muted}${shown}, +${more} more${T.reset}`
          : `${count} entr${count !== 1 ? 'ies' : 'y'} — ${T.muted}${shown}${T.reset}`;
      }
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
      const commitLines = r.split('\n').filter(l => /^commit\s+[0-9a-f]{7}/.test(l));
      const commits = commitLines.length;
      const firstHash = commitLines[0] ? commitLines[0].replace(/^commit\s+/, '').substring(0, 7) : null;
      // Find the subject line of the first commit (first non-empty line after "commit <hash>")
      const firstSubject = (() => {
        const idx = r.indexOf(commitLines[0] || '\0');
        if (idx === -1) return null;
        const after = r.substring(idx).split('\n');
        return after.find((l, i) => i > 0 && l.trim() && !l.startsWith('Author:') && !l.startsWith('Date:') && !l.startsWith('Merge:'));
      })();
      if (commits === 0) {
        summary = 'Log retrieved';
      } else if (firstHash && firstSubject) {
        const more = commits > 1 ? ` ${T.muted}+${commits - 1} more${T.reset}` : '';
        summary = `${firstHash} ${T.muted}${firstSubject.trim().substring(0, 60)}${T.reset}${more}`;
      } else {
        summary = `${commits} commit${commits !== 1 ? 's' : ''}`;
      }
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
    case 'web_fetch': {
      const titleMatch = r.match(/<title[^>]*>([^<]{1,80})<\/title>/i);
      const h1Match = r.match(/^#\s+(.{1,80})/m);
      const url = args.url || '';
      let fetchDesc = '';
      try { fetchDesc = new URL(url).hostname; } catch (_) { fetchDesc = url.substring(0, 60); }
      const pageTitle = titleMatch ? titleMatch[1].trim() : (h1Match ? h1Match[1].trim() : null);
      summary = pageTitle
        ? `${fetchDesc} — ${T.muted}${pageTitle.substring(0, 70)}${T.reset}`
        : `Fetched ${fetchDesc}`;
      break;
    }
    case 'web_search': {
      const blocks = r.split('\n\n').filter(Boolean);
      const count = blocks.length;
      const firstTitle = blocks[0] ? blocks[0].split('\n')[0].replace(/^\d+\.\s*/, '').trim() : null;
      const titleHint = firstTitle ? ` ${T.muted}— ${firstTitle.substring(0, 70)}${T.reset}` : '';
      summary = `${count} result${count !== 1 ? 's' : ''}${titleHint}`;
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
    default: {
      // Show first meaningful output line instead of generic "Done"
      const meaningfulLines = r.split('\n').filter(l => l.trim() && !l.startsWith('EXIT ') && !l.startsWith('HINT:'));
      if (meaningfulLines.length > 0) {
        const first = meaningfulLines[0].trim().substring(0, 90);
        const more = meaningfulLines.length > 1 ? ` ${T.subtle}+${meaningfulLines.length - 1}${T.reset}` : '';
        summary = `${T.muted}${first}${T.reset}${more}`;
      } else {
        summary = 'Done';
      }
    }
  }

  return `  ${T.muted}└ ${summary}${T.reset}`;
}

module.exports = { C, formatToolCall, formatResult, getToolSpinnerText, formatToolSummary, formatSectionHeader };

/**
 * tests/format.test.js — Tests for cli/format.js
 * Formatting functions: formatToolCall, formatResult, getToolSpinnerText,
 * formatToolSummary, formatSectionHeader
 */

'use strict';

jest.mock('../cli/theme', () => {
  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const theme = {
    reset: RESET,
    bold: BOLD,
    dim: DIM,
    muted: DIM,
    subtle: DIM,
    error: '\x1b[31m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    tool_read: '\x1b[34m',
    tool_write: '\x1b[33m',
    tool_exec: '\x1b[35m',
    tool_search: '\x1b[36m',
    tool_git: '\x1b[32m',
    tool_web: '\x1b[34m',
    tool_sysadmin: '\x1b[33m',
    tool_default: '\x1b[32m',
    diff_add: '\x1b[32m',
    diff_rem: '\x1b[31m',
  };
  return { T: theme, isDark: true };
});

const { formatToolCall, formatResult, getToolSpinnerText, formatToolSummary, formatSectionHeader } = require('../cli/format');

// ─── formatToolCall ──────────────────────────────────────────
describe('formatToolCall()', () => {
  it('formats read_file with path', () => {
    const out = formatToolCall('read_file', { path: 'src/utils/helper.js' });
    expect(out).toContain('Read file');
    expect(out).toContain('utils/helper.js');
  });

  it('formats write_file with path', () => {
    const out = formatToolCall('write_file', { path: '/tmp/output.txt' });
    expect(out).toContain('Write');
    expect(out).toContain('output.txt');
  });

  it('formats edit_file with path', () => {
    const out = formatToolCall('edit_file', { path: 'deep/nested/file.js' });
    expect(out).toContain('Update');
    expect(out).toContain('nested/file.js');
  });

  it('formats bash with command', () => {
    const out = formatToolCall('bash', { command: 'npm test' });
    expect(out).toContain('Run command');
    expect(out).toContain('npm test');
  });

  it('truncates long bash commands', () => {
    const longCmd = 'x'.repeat(100);
    const out = formatToolCall('bash', { command: longCmd });
    expect(out.length).toBeLessThan(200);
  });

  it('formats grep with pattern and path', () => {
    const out = formatToolCall('grep', { pattern: 'TODO', path: 'src/' });
    expect(out).toContain('Search code');
    expect(out).toContain('"TODO"');
    expect(out).toContain('in src/');
  });

  it('formats grep with pattern only', () => {
    const out = formatToolCall('grep', { pattern: 'fixme' });
    expect(out).toContain('"fixme"');
  });

  it('formats glob with pattern', () => {
    const out = formatToolCall('glob', { pattern: '**/*.ts' });
    expect(out).toContain('Find files');
    expect(out).toContain('**/*.ts');
  });

  it('formats web_fetch with URL', () => {
    const out = formatToolCall('web_fetch', { url: 'https://example.com/api' });
    expect(out).toContain('Fetch URL');
    expect(out).toContain('example.com');
  });

  it('formats web_search with query', () => {
    const out = formatToolCall('web_search', { query: 'node.js streams' });
    expect(out).toContain('Web search');
    expect(out).toContain('node.js streams');
  });

  it('formats list_directory with path', () => {
    const out = formatToolCall('list_directory', { path: 'src/' });
    expect(out).toContain('List directory');
  });

  it('formats unknown tool with JSON args', () => {
    const out = formatToolCall('custom_tool', { foo: 'bar' });
    expect(out).toContain('custom tool');
    expect(out).toContain('foo');
  });

  it('formats patch_file with path', () => {
    const out = formatToolCall('patch_file', { path: 'lib/main.js' });
    expect(out).toContain('Update');
  });

  it('handles empty args for grep', () => {
    const out = formatToolCall('grep', {});
    expect(out).toContain('Search code');
  });
});

// ─── formatResult ────────────────────────────────────────────
describe('formatResult()', () => {
  it('formats single line result', () => {
    const out = formatResult('Success');
    expect(out).toContain('Success');
    expect(out).toContain('\u2514'); // └
  });

  it('formats multiple lines', () => {
    const out = formatResult('line1\nline2\nline3');
    expect(out).toContain('line1');
    expect(out).toContain('line2');
    expect(out).toContain('line3');
  });

  it('truncates after maxLines', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    const out = formatResult(lines, 5);
    expect(out).toContain('line 1');
    expect(out).toContain('line 5');
    expect(out).toContain('+15 lines');
  });

  it('uses default maxLines of 8', () => {
    const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join('\n');
    const out = formatResult(lines);
    expect(out).toContain('+7 lines');
  });

  it('does not show +N lines when all fit', () => {
    const out = formatResult('a\nb\nc');
    expect(out).not.toContain('+');
  });
});

// ─── getToolSpinnerText ──────────────────────────────────────
describe('getToolSpinnerText()', () => {
  it('returns null for bash (interactive)', () => {
    expect(getToolSpinnerText('bash', {})).toBeNull();
  });

  it('returns null for ask_user', () => {
    expect(getToolSpinnerText('ask_user', {})).toBeNull();
  });

  it('returns null for write_file', () => {
    expect(getToolSpinnerText('write_file', {})).toBeNull();
  });

  it('returns null for edit_file', () => {
    expect(getToolSpinnerText('edit_file', {})).toBeNull();
  });

  it('returns null for patch_file', () => {
    expect(getToolSpinnerText('patch_file', {})).toBeNull();
  });

  it('returns null for task_list', () => {
    expect(getToolSpinnerText('task_list', {})).toBeNull();
  });

  it('returns null for spawn_agents', () => {
    expect(getToolSpinnerText('spawn_agents', {})).toBeNull();
  });

  it('returns reading text for read_file', () => {
    expect(getToolSpinnerText('read_file', { path: 'src/index.js' })).toBe('Reading: src/index.js');
  });

  it('returns listing text for list_directory', () => {
    expect(getToolSpinnerText('list_directory', { path: 'src/' })).toBe('Listing: src/');
  });

  it('returns listing text with default path', () => {
    expect(getToolSpinnerText('list_directory', {})).toBe('Listing: .');
  });

  it('returns search text for search_files', () => {
    expect(getToolSpinnerText('search_files', { pattern: 'TODO' })).toBe('Searching: TODO');
  });

  it('returns glob text', () => {
    expect(getToolSpinnerText('glob', { pattern: '*.ts' })).toBe('Glob: *.ts');
  });

  it('returns grep text', () => {
    expect(getToolSpinnerText('grep', { pattern: 'error' })).toBe('Grep: error');
  });

  it('returns web_fetch text', () => {
    expect(getToolSpinnerText('web_fetch', { url: 'https://api.example.com' })).toContain('Fetching:');
  });

  it('returns web_search text', () => {
    expect(getToolSpinnerText('web_search', { query: 'node streams' })).toContain('Searching web:');
  });

  it('returns git_status text', () => {
    expect(getToolSpinnerText('git_status', {})).toBe('Git status...');
  });

  it('returns git_diff text with file', () => {
    expect(getToolSpinnerText('git_diff', { file: 'main.js' })).toBe('Git diff: main.js...');
  });

  it('returns git_diff text without file', () => {
    expect(getToolSpinnerText('git_diff', {})).toBe('Git diff...');
  });

  it('returns git_log text', () => {
    expect(getToolSpinnerText('git_log', {})).toBe('Git log...');
  });

  it('returns gh_run_list text', () => {
    expect(getToolSpinnerText('gh_run_list', {})).toContain('GitHub Actions');
  });

  it('returns gh_run_view text', () => {
    expect(getToolSpinnerText('gh_run_view', { run_id: '123' })).toContain('run 123');
  });

  it('returns gh_workflow_trigger text', () => {
    expect(getToolSpinnerText('gh_workflow_trigger', { workflow: 'ci.yml' })).toContain('trigger ci.yml');
  });

  it('returns browser_open text', () => {
    expect(getToolSpinnerText('browser_open', { url: 'https://test.com' })).toContain('opening');
  });

  it('returns browser_screenshot text', () => {
    expect(getToolSpinnerText('browser_screenshot', { url: 'https://test.com' })).toContain('screenshot');
  });

  it('returns browser_click text', () => {
    expect(getToolSpinnerText('browser_click', { text: 'Submit' })).toContain('clicking Submit');
  });

  it('returns browser_fill text', () => {
    expect(getToolSpinnerText('browser_fill', { selector: '#email' })).toContain('filling #email');
  });

  it('returns sysadmin audit text', () => {
    const text = getToolSpinnerText('sysadmin', { action: 'audit', server: 'prod' });
    expect(text).toContain('audit');
    expect(text).toContain('[prod]');
  });

  it('returns sysadmin disk_usage text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'disk_usage', path: '/home' })).toContain('disk usage');
  });

  it('returns sysadmin process_list text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'process_list' })).toContain('top processes');
  });

  it('returns sysadmin network_status text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'network_status' })).toContain('network');
  });

  it('returns sysadmin ssl_check text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'ssl_check', domain: 'example.com' })).toContain('SSL check');
  });

  it('returns sysadmin log_tail text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'log_tail', path: '/var/log/syslog' })).toContain('tail');
  });

  it('returns sysadmin find_large text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'find_large' })).toContain('find large');
  });

  it('returns sysadmin service text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'service', service_action: 'restart', service_name: 'nginx' })).toContain('service');
  });

  it('returns sysadmin kill_process text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'kill_process', pid: 1234 })).toContain('kill');
  });

  it('returns sysadmin journalctl text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'journalctl', unit: 'nginx' })).toContain('journal');
  });

  it('returns sysadmin package text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'package', package_action: 'install', packages: ['nginx'] })).toContain('package');
  });

  it('returns sysadmin firewall text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'firewall', firewall_action: 'list' })).toContain('firewall');
  });

  it('returns sysadmin user_manage text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'user_manage', user_action: 'add', user: 'bob' })).toContain('user');
  });

  it('returns sysadmin cron text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'cron', cron_action: 'list' })).toContain('cron');
  });

  it('returns sysadmin unknown action text', () => {
    expect(getToolSpinnerText('sysadmin', { action: 'custom_check' })).toContain('custom_check');
  });

  it('returns sysadmin text without server suffix for local', () => {
    const text = getToolSpinnerText('sysadmin', { action: 'audit', server: 'local' });
    expect(text).not.toContain('[local]');
  });

  it('returns default text for unknown tool', () => {
    expect(getToolSpinnerText('some_random_tool', {})).toBe('Running: some_random_tool');
  });
});

// ─── formatToolSummary ───────────────────────────────────────
describe('formatToolSummary()', () => {
  it('formats error with first line and hint', () => {
    const out = formatToolSummary('bash', {}, 'ERROR: Permission denied\nHINT: Try running with sudo', true);
    expect(out).toContain('Permission denied');
    expect(out).toContain('sudo');
  });

  it('formats error without hint', () => {
    const out = formatToolSummary('bash', {}, 'ERROR: File not found', true);
    expect(out).toContain('File not found');
  });

  it('formats read_file summary with line count', () => {
    const result = '1: const x = 1;\n2: const y = 2;\n3: const z = 3;';
    const out = formatToolSummary('read_file', {}, result, false);
    expect(out).toContain('Read 3 line');
  });

  it('formats read_file partial read', () => {
    const result = '10: foo\n11: bar\n12: baz';
    const out = formatToolSummary('read_file', { line_start: 10, line_end: 12 }, result, false);
    expect(out).toContain('lines 10');
  });

  it('formats write_file summary', () => {
    const out = formatToolSummary('write_file', { content: 'a\nb\nc' }, 'OK', false);
    expect(out).toContain('Wrote 3 line');
  });

  it('formats edit_file summary with diff counts', () => {
    const out = formatToolSummary('edit_file', { old_text: 'old\nold2', new_text: 'new\nnew2\nnew3' }, 'OK', false);
    // Should show removed and added counts
    expect(out).toMatch(/[−-]2/); // removed 2
    expect(out).toMatch(/\+3/); // added 3
  });

  it('formats patch_file summary', () => {
    const out = formatToolSummary('patch_file', {
      patches: [
        { old_text: 'a', new_text: 'b\nc' },
        { old_text: 'x', new_text: 'y' },
      ],
    }, 'OK', false);
    expect(out).toContain('2 patches');
  });

  it('formats bash with exit 0', () => {
    const out = formatToolSummary('bash', {}, 'EXIT 0\noutput line 1\noutput line 2', false);
    expect(out).toContain('output line 1');
  });

  it('formats bash with exit non-zero', () => {
    const out = formatToolSummary('bash', {}, 'EXIT 1\nerror message', false);
    expect(out).toContain('Exit 1');
  });

  it('formats bash with exit 0 and hint', () => {
    const out = formatToolSummary('bash', {}, 'EXIT 0\nHINT: All tests passed', false);
    expect(out).toContain('All tests passed');
  });

  it('formats bash without EXIT line', () => {
    const out = formatToolSummary('bash', {}, 'some output\nanother line', false);
    expect(out).toContain('some output');
  });

  it('formats grep with no matches', () => {
    const out = formatToolSummary('grep', {}, '(no matches)', false);
    expect(out).toContain('No matches');
  });

  it('formats grep with matches', () => {
    const out = formatToolSummary('grep', {}, 'src/a.js:10:match\nsrc/b.js:20:match', false);
    expect(out).toContain('2 matches');
    expect(out).toContain('2 files');
  });

  it('formats grep with matches in single file', () => {
    const out = formatToolSummary('grep', {}, 'src/a.js:10:match\nsrc/a.js:20:match', false);
    expect(out).toContain('2 matches');
    expect(out).not.toContain('files');
  });

  it('formats glob with no files', () => {
    const out = formatToolSummary('glob', {}, '(no matches)', false);
    expect(out).toContain('No files found');
  });

  it('formats glob with files', () => {
    const out = formatToolSummary('glob', {}, 'src/a.js\nsrc/b.js', false);
    expect(out).toContain('2 files found');
  });

  it('formats list_directory', () => {
    const out = formatToolSummary('list_directory', {}, 'file1\nfile2\nfile3', false);
    expect(out).toContain('3 entries');
  });

  it('formats list_directory empty', () => {
    const out = formatToolSummary('list_directory', {}, '(empty)', false);
    expect(out).toContain('0 entr');
  });

  it('formats git_status', () => {
    const out = formatToolSummary('git_status', {}, 'Branch: main\n M file.js\n A new.js', false);
    expect(out).toContain('main');
    expect(out).toContain('2 change');
  });

  it('formats git_diff with changes', () => {
    const out = formatToolSummary('git_diff', {}, '+added line\n-removed line\n+another add', false);
    expect(out).toContain('+2');
  });

  it('formats git_diff with no changes', () => {
    const out = formatToolSummary('git_diff', {}, '', false);
    expect(out).toContain('No diff');
  });

  it('formats git_log', () => {
    const out = formatToolSummary('git_log', {}, 'commit abc1234 msg\ncommit def5678 msg2', false);
    expect(out).toContain('2 commits');
  });

  it('formats git_commit', () => {
    const out = formatToolSummary('git_commit', {}, '[main abc1234] Fix bug', false);
    expect(out).toContain('abc1234');
    expect(out).toContain('Fix bug');
  });

  it('formats git_push', () => {
    const out = formatToolSummary('git_push', {}, '-> origin/main', false);
    expect(out).toContain('origin/main');
  });

  it('formats git_pull already up to date', () => {
    const out = formatToolSummary('git_pull', {}, 'Already up to date.', false);
    expect(out).toContain('Already up to date');
  });

  it('formats web_fetch', () => {
    const out = formatToolSummary('web_fetch', {}, 'content', false);
    expect(out).toContain('Fetched');
  });

  it('formats web_search', () => {
    const out = formatToolSummary('web_search', {}, 'result 1\n\nresult 2', false);
    expect(out).toContain('2 result');
  });

  it('formats task_list', () => {
    const out = formatToolSummary('task_list', {}, 'task', false);
    expect(out).toContain('Done');
  });

  it('formats spawn_agents', () => {
    const out = formatToolSummary('spawn_agents', {}, '\u2713 Agent 1 done\n\u2713 Agent 2 done', false);
    expect(out).toContain('2 agents done');
  });

  it('formats spawn_agents with failures', () => {
    const out = formatToolSummary('spawn_agents', {}, '\u2713 Agent 1 done\n\u2717 Agent 2 failed', false);
    expect(out).toContain('1 done');
    expect(out).toContain('1 failed');
  });

  it('formats switch_model', () => {
    const out = formatToolSummary('switch_model', {}, 'Switched to gpt-4', false);
    expect(out).toContain('gpt-4');
  });

  it('formats unknown tool as Done', () => {
    const out = formatToolSummary('custom_tool', {}, 'any result', false);
    expect(out).toContain('Done');
  });
});

// ─── formatSectionHeader ─────────────────────────────────────
describe('formatSectionHeader()', () => {
  it('returns step N for empty tools', () => {
    const out = formatSectionHeader([], 1);
    expect(out).toContain('Step 1');
  });

  it('returns step N for null tools', () => {
    const out = formatSectionHeader(null, 3);
    expect(out).toContain('Step 3');
  });

  it('formats single tool with label and arg', () => {
    const out = formatSectionHeader([{ fnName: 'read_file', args: { path: 'src/index.js' }, canExecute: true }], 1);
    expect(out).toContain('Read file');
    expect(out).toContain('index.js');
  });

  it('formats single tool with command arg', () => {
    const out = formatSectionHeader([{ fnName: 'bash', args: { command: 'npm test' }, canExecute: true }], 1);
    expect(out).toContain('Run command');
    expect(out).toContain('npm test');
  });

  it('formats single tool with query arg', () => {
    const out = formatSectionHeader([{ fnName: 'web_search', args: { query: 'node js' }, canExecute: true }], 1);
    expect(out).toContain('Web search');
  });

  it('formats single tool with pattern arg', () => {
    const out = formatSectionHeader([{ fnName: 'grep', args: { pattern: 'TODO' }, canExecute: true }], 1);
    expect(out).toContain('Search code');
  });

  it('formats multi-tool with labels', () => {
    const out = formatSectionHeader([
      { fnName: 'read_file', args: { path: 'a.js' }, canExecute: true },
      { fnName: 'read_file', args: { path: 'b.js' }, canExecute: true },
    ], 1);
    expect(out).toContain('Read file');
  });

  it('formats multi-tool with different labels', () => {
    const out = formatSectionHeader([
      { fnName: 'read_file', args: { path: 'a.js' }, canExecute: true },
      { fnName: 'bash', args: { command: 'ls' }, canExecute: true },
    ], 1);
    // Multiple different labels joined with '·'
    expect(out).toContain('Read file');
  });

  it('shows N actions for > 3 unique labels', () => {
    const out = formatSectionHeader([
      { fnName: 'read_file', args: {}, canExecute: true },
      { fnName: 'bash', args: {}, canExecute: true },
      { fnName: 'grep', args: {}, canExecute: true },
      { fnName: 'glob', args: {}, canExecute: true },
    ], 1);
    expect(out).toContain('4 actions');
  });

  it('filters out tools with canExecute=false', () => {
    const out = formatSectionHeader([
      { fnName: 'read_file', args: {}, canExecute: false },
    ], 1);
    expect(out).toContain('Step 1');
  });

  it('applies error styling', () => {
    const out = formatSectionHeader([{ fnName: 'bash', args: {}, canExecute: true }], 1, true);
    expect(out).toContain('\x1b[31m'); // error color (red)
  });

  it('handles unknown tool name gracefully', () => {
    const out = formatSectionHeader([{ fnName: 'custom_thing', args: {}, canExecute: true }], 1);
    expect(out).toContain('custom thing');
  });
});

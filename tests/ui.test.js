const { C, Spinner, TaskProgress, banner, formatToolCall, formatResult, getToolSpinnerText, getActiveTaskProgress, setActiveTaskProgress } = require('../cli/ui');

describe('ui.js', () => {
  // ─── Color constants ────────────────────────────────────────
  describe('C (colors)', () => {
    it('has all required color codes', () => {
      expect(C.reset).toBe('\x1b[0m');
      expect(C.bold).toBe('\x1b[1m');
      expect(C.dim).toBe('\x1b[2m');
      expect(C.red).toBe('\x1b[31m');
      expect(C.green).toBe('\x1b[32m');
      expect(C.yellow).toBe('\x1b[33m');
      expect(C.blue).toBe('\x1b[34m');
      expect(C.magenta).toBe('\x1b[35m');
      expect(C.cyan).toBe('\x1b[36m');
      expect(C.gray).toBe('\x1b[90m');
    });
  });

  // ─── Spinner ────────────────────────────────────────────────
  describe('Spinner', () => {
    let spinner;

    afterEach(() => {
      if (spinner) spinner.stop();
    });

    it('creates with default text', () => {
      spinner = new Spinner();
      expect(spinner.text).toBe('Thinking...');
    });

    it('creates with custom text', () => {
      spinner = new Spinner('Loading...');
      expect(spinner.text).toBe('Loading...');
    });

    it('starts and writes to stderr', () => {
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
      spinner = new Spinner('test');
      spinner.start();
      expect(spinner.interval).not.toBeNull();

      spinner.stop();
      writeSpy.mockRestore();
    });

    it('stop clears interval and writes clear sequence', () => {
      const writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
      spinner = new Spinner('test');
      spinner.start();
      spinner.stop();
      expect(spinner.interval).toBeNull();
      // Should write single combined clear line + show cursor to stderr
      expect(writeSpy).toHaveBeenCalledWith('\x1b[2K\r\x1b[?25h');
      writeSpy.mockRestore();
    });

    it('stop is safe to call without start', () => {
      spinner = new Spinner('test');
      expect(() => spinner.stop()).not.toThrow();
    });

    it('update changes text', () => {
      spinner = new Spinner('old');
      spinner.update('new');
      expect(spinner.text).toBe('new');
    });
  });

  // ─── banner ─────────────────────────────────────────────────
  describe('banner()', () => {
    it('prints banner to stdout', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      banner();
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('N E X   C O D E');
      expect(output).toContain('v0.3.0');
      logSpy.mockRestore();
    });
  });

  // ─── formatToolCall ─────────────────────────────────────────
  describe('formatToolCall()', () => {
    it('formats write_file with path and char count', () => {
      const result = formatToolCall('write_file', { path: 'test.js', content: 'hello' });
      expect(result).toContain('write_file');
      expect(result).toContain('test.js');
      expect(result).toContain('5 chars');
    });

    it('formats edit_file with path only', () => {
      const result = formatToolCall('edit_file', { path: 'test.js', old_text: 'a', new_text: 'b' });
      expect(result).toContain('edit_file');
      expect(result).toContain('test.js');
    });

    it('formats bash with command preview', () => {
      const result = formatToolCall('bash', { command: 'ls -la' });
      expect(result).toContain('bash');
      expect(result).toContain('ls -la');
    });

    it('formats bash with long command truncated', () => {
      const longCmd = 'a'.repeat(200);
      const result = formatToolCall('bash', { command: longCmd });
      expect(result).toContain('bash');
      expect(result.length).toBeLessThan(250);
    });

    it('formats unknown tool as JSON', () => {
      const result = formatToolCall('search_files', { path: '.', pattern: 'test' });
      expect(result).toContain('search_files');
      expect(result).toContain('test');
    });

    it('handles write_file with no content', () => {
      const result = formatToolCall('write_file', { path: 'x.js' });
      expect(result).toContain('0 chars');
    });
  });

  // ─── getToolSpinnerText ────────────────────────────────────
  describe('getToolSpinnerText()', () => {
    it('returns null for bash (has own spinner)', () => {
      expect(getToolSpinnerText('bash', { command: 'ls' })).toBeNull();
    });

    it('returns null for ask_user (interactive)', () => {
      expect(getToolSpinnerText('ask_user', { question: 'hi' })).toBeNull();
    });

    it('returns null for write_file (interactive)', () => {
      expect(getToolSpinnerText('write_file', { path: 'x.js', content: '' })).toBeNull();
    });

    it('returns null for edit_file (interactive)', () => {
      expect(getToolSpinnerText('edit_file', { path: 'x.js' })).toBeNull();
    });

    it('returns null for patch_file (interactive)', () => {
      expect(getToolSpinnerText('patch_file', { path: 'x.js', patches: [] })).toBeNull();
    });

    it('returns Reading: text for read_file', () => {
      expect(getToolSpinnerText('read_file', { path: 'src/app.js' })).toBe('Reading: src/app.js');
    });

    it('returns Listing: text for list_directory', () => {
      expect(getToolSpinnerText('list_directory', { path: 'src' })).toBe('Listing: src');
    });

    it('returns Searching: text for search_files', () => {
      expect(getToolSpinnerText('search_files', { path: '.', pattern: 'TODO' })).toBe('Searching: TODO');
    });

    it('returns Glob: text for glob', () => {
      expect(getToolSpinnerText('glob', { pattern: '**/*.js' })).toBe('Glob: **/*.js');
    });

    it('returns Grep: text for grep', () => {
      expect(getToolSpinnerText('grep', { pattern: 'import' })).toBe('Grep: import');
    });

    it('returns Fetching: text for web_fetch', () => {
      expect(getToolSpinnerText('web_fetch', { url: 'https://example.com' })).toBe('Fetching: https://example.com');
    });

    it('truncates long URLs for web_fetch', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(100);
      const result = getToolSpinnerText('web_fetch', { url: longUrl });
      expect(result.length).toBeLessThan(80);
    });

    it('returns Searching web: text for web_search', () => {
      expect(getToolSpinnerText('web_search', { query: 'node.js tutorial' })).toBe('Searching web: node.js tutorial');
    });

    it('returns Git status... for git_status', () => {
      expect(getToolSpinnerText('git_status', {})).toBe('Git status...');
    });

    it('returns Git diff... for git_diff without file', () => {
      expect(getToolSpinnerText('git_diff', {})).toBe('Git diff...');
    });

    it('returns Git diff: file for git_diff with file', () => {
      expect(getToolSpinnerText('git_diff', { file: 'index.js' })).toBe('Git diff: index.js...');
    });

    it('returns Git log... for git_log', () => {
      expect(getToolSpinnerText('git_log', {})).toBe('Git log...');
    });

    it('returns Running: name for unknown tools', () => {
      expect(getToolSpinnerText('custom_tool', {})).toBe('Running: custom_tool');
    });

    it('handles missing args gracefully', () => {
      expect(getToolSpinnerText('read_file', {})).toBe('Reading: file');
      expect(getToolSpinnerText('grep', {})).toBe('Grep: ...');
      expect(getToolSpinnerText('web_fetch', {})).toBe('Fetching: ');
    });
  });

  // ─── formatResult ───────────────────────────────────────────
  describe('formatResult()', () => {
    it('shows all lines when under limit', () => {
      const text = 'line1\nline2\nline3';
      const result = formatResult(text);
      expect(result).toContain('line1');
      expect(result).toContain('line3');
      expect(result).not.toContain('more lines');
    });

    it('truncates when over default limit (8 lines)', () => {
      const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`);
      const result = formatResult(lines.join('\n'));
      expect(result).toContain('line1');
      expect(result).toContain('line8');
      expect(result).toContain('+7 more lines');
    });

    it('respects custom maxLines', () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`);
      const result = formatResult(lines.join('\n'), 3);
      expect(result).toContain('line1');
      expect(result).toContain('line3');
      expect(result).toContain('+7 more lines');
    });

    it('handles single line', () => {
      const result = formatResult('only line');
      expect(result).toContain('only line');
      expect(result).not.toContain('more lines');
    });

    it('handles empty string', () => {
      const result = formatResult('');
      expect(result).toContain('');
    });
  });

  // ─── TaskProgress ──────────────────────────────────────────
  describe('TaskProgress', () => {
    let tp;
    let writeSpy;

    const sampleTasks = [
      { id: 't1', description: 'Create picker module', status: 'done' },
      { id: 't2', description: 'Add cost limits', status: 'in_progress' },
      { id: 't3', description: 'Update CLI entry', status: 'pending' },
    ];

    beforeEach(() => {
      writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
    });

    afterEach(() => {
      if (tp) tp.stop();
      tp = null;
      writeSpy.mockRestore();
    });

    it('creates with name and tasks', () => {
      tp = new TaskProgress('Adding features', sampleTasks);
      expect(tp.name).toBe('Adding features');
      expect(tp.tasks).toHaveLength(3);
      expect(tp.tasks[0].status).toBe('done');
      expect(tp.tasks[1].status).toBe('in_progress');
      expect(tp.tasks[2].status).toBe('pending');
    });

    it('defaults task status to pending', () => {
      tp = new TaskProgress('Test', [{ id: 't1', description: 'task' }]);
      expect(tp.tasks[0].status).toBe('pending');
    });

    it('start/stop lifecycle', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.start();
      expect(tp.interval).not.toBeNull();
      expect(tp.isActive()).toBe(true);
      tp.stop();
      expect(tp.interval).toBeNull();
      expect(tp.isActive()).toBe(false);
    });

    it('updateTask changes task status', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.updateTask('t3', 'done');
      expect(tp.tasks[2].status).toBe('done');
    });

    it('updateTask ignores unknown ids', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.updateTask('t99', 'done');
      expect(tp.tasks[0].status).toBe('done');
    });

    it('setStats updates token count', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.setStats({ tokens: 2600 });
      expect(tp.tokens).toBe(2600);
    });

    it('formats tokens as k for >= 1000', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.setStats({ tokens: 2600 });
      expect(tp._formatTokens()).toBe('2.6k');
    });

    it('formats tokens as raw number for < 1000', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.setStats({ tokens: 500 });
      expect(tp._formatTokens()).toBe('500');
    });

    it('formats elapsed time', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.startTime = Date.now() - 95000; // 1m 35s
      const elapsed = tp._formatElapsed();
      expect(elapsed).toMatch(/1m \d+s/);
    });

    it('pause/resume lifecycle', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.start();
      expect(tp.isActive()).toBe(true);

      tp.pause();
      expect(tp._paused).toBe(true);
      expect(tp.interval).toBeNull();
      expect(tp.isActive()).toBe(true);

      tp.resume();
      expect(tp._paused).toBe(false);
      expect(tp.interval).not.toBeNull();
      expect(tp.isActive()).toBe(true);

      tp.stop();
    });

    it('pause is idempotent', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.start();
      tp.pause();
      tp.pause();
      expect(tp._paused).toBe(true);
      tp.stop();
    });

    it('resume is idempotent when not paused', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.start();
      tp.resume();
      expect(tp.isActive()).toBe(true);
      tp.stop();
    });

    it('sets and clears active task progress', () => {
      tp = new TaskProgress('Test', sampleTasks);
      tp.start();
      expect(getActiveTaskProgress()).toBe(tp);
      tp.stop();
      expect(getActiveTaskProgress()).toBeNull();
    });
  });
});

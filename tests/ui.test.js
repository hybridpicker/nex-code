const { C, Spinner, banner, formatToolCall, formatResult } = require('../cli/ui');

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
      // Should write clear line + show cursor to stderr
      expect(writeSpy).toHaveBeenCalledWith('\x1b[2K\r');
      expect(writeSpy).toHaveBeenCalledWith('\x1b[?25h');
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
});

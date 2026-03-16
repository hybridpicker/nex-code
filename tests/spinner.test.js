const {
  C,
  Spinner,
  MultiProgress,
  TaskProgress,
  setActiveTaskProgress,
  getActiveTaskProgress,
  cleanupTerminal,
} = require('../cli/spinner');

describe('spinner.js', () => {
  let writeSpy;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    writeSpy.mockRestore();
    // Ensure no lingering active task progress
    setActiveTaskProgress(null);
  });

  // ─── Spinner elapsed time formatting ─────────────────────────
  describe('Spinner elapsed time', () => {
    let spinner;

    afterEach(() => {
      if (spinner) spinner.stop();
      spinner = null;
    });

    it('shows no elapsed text when less than 1 second', () => {
      spinner = new Spinner('Working...');
      spinner.start();
      // Advance < 1s
      jest.advanceTimersByTime(500);
      writeSpy.mockClear();
      spinner._render();
      const output = writeSpy.mock.calls[0][0];
      // Should not contain any elapsed time indicator
      expect(output).not.toMatch(/\d+s/);
    });

    it('shows seconds when elapsed >= 1s and < 60s', () => {
      spinner = new Spinner('Working...');
      spinner.start();
      // Advance 5 seconds
      jest.advanceTimersByTime(5000);
      writeSpy.mockClear();
      spinner._render();
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain('5s');
    });

    it('shows minutes and seconds when elapsed >= 60s', () => {
      spinner = new Spinner('Working...');
      spinner.start();
      // Advance 95 seconds = 1m 35s
      jest.advanceTimersByTime(95000);
      writeSpy.mockClear();
      spinner._render();
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain('1m');
      expect(output).toContain('35s');
    });

    it('zero-pads seconds in minutes+seconds display', () => {
      spinner = new Spinner('Working...');
      spinner.start();
      // Advance 63 seconds = 1m 03s
      jest.advanceTimersByTime(63000);
      writeSpy.mockClear();
      spinner._render();
      const output = writeSpy.mock.calls[0][0];
      expect(output).toContain('1m');
      expect(output).toContain('03s');
    });

    it('does not render when _stopped is true', () => {
      spinner = new Spinner('Working...');
      spinner._stopped = true;
      writeSpy.mockClear();
      spinner._render();
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  // ─── MultiProgress ──────────────────────────────────────────
  describe('MultiProgress', () => {
    let mp;

    afterEach(() => {
      if (mp && mp.interval) mp.stop();
      mp = null;
    });

    it('constructs with labels and initializes statuses to running', () => {
      mp = new MultiProgress(['Task A', 'Task B', 'Task C']);
      expect(mp.labels).toEqual(['Task A', 'Task B', 'Task C']);
      expect(mp.statuses).toEqual(['running', 'running', 'running']);
      expect(mp.frame).toBe(0);
      expect(mp.interval).toBeNull();
      expect(mp.startTime).toBeNull();
      expect(mp.lineCount).toBe(3);
    });

    describe('_formatElapsed', () => {
      it('returns empty string when startTime is null', () => {
        mp = new MultiProgress(['A']);
        expect(mp._formatElapsed()).toBe('');
      });

      it('returns empty string when less than 1 second elapsed', () => {
        mp = new MultiProgress(['A']);
        mp.startTime = Date.now();
        jest.advanceTimersByTime(500);
        expect(mp._formatElapsed()).toBe('');
      });

      it('returns seconds string when < 60s', () => {
        mp = new MultiProgress(['A']);
        mp.startTime = Date.now();
        jest.advanceTimersByTime(15000);
        expect(mp._formatElapsed()).toBe('15s');
      });

      it('returns minutes+seconds when >= 60s', () => {
        mp = new MultiProgress(['A']);
        mp.startTime = Date.now();
        jest.advanceTimersByTime(125000); // 2m 05s
        expect(mp._formatElapsed()).toBe('2m 05s');
      });

      it('zero-pads seconds in minutes display', () => {
        mp = new MultiProgress(['A']);
        mp.startTime = Date.now();
        jest.advanceTimersByTime(62000); // 1m 02s
        expect(mp._formatElapsed()).toBe('1m 02s');
      });
    });

    describe('_render', () => {
      it('does not render when _stopped is true', () => {
        mp = new MultiProgress(['A', 'B']);
        mp._stopped = true;
        writeSpy.mockClear();
        mp._render();
        expect(writeSpy).not.toHaveBeenCalled();
      });

      it('renders running tasks with spinner frames', () => {
        mp = new MultiProgress(['Task A', 'Task B']);
        mp.startTime = Date.now();
        writeSpy.mockClear();
        mp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('Task A');
        expect(output).toContain('Task B');
        // Should contain cursor-move-up escape
        expect(output).toContain('\x1b[2A');
      });

      it('renders done tasks with green checkmark', () => {
        mp = new MultiProgress(['Task A']);
        mp.statuses[0] = 'done';
        mp.startTime = Date.now();
        writeSpy.mockClear();
        mp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain(C.green);
        // Check for the checkmark character
        expect(output).toContain('\u2713');
      });

      it('renders error tasks with red X', () => {
        mp = new MultiProgress(['Task A']);
        mp.statuses[0] = 'error';
        mp.startTime = Date.now();
        writeSpy.mockClear();
        mp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain(C.red);
        expect(output).toContain('\u2717');
      });

      it('shows elapsed on the last line only', () => {
        mp = new MultiProgress(['Task A', 'Task B']);
        mp.startTime = Date.now();
        jest.advanceTimersByTime(5000);
        writeSpy.mockClear();
        mp._render();
        const output = writeSpy.mock.calls[0][0];
        // Elapsed should appear after Task B (last label), not after Task A
        const lines = output.split('\n');
        // Line for Task A should not have elapsed
        const taskALine = lines.find(l => l.includes('Task A'));
        expect(taskALine).not.toContain('5s');
        // Line for Task B should have elapsed
        const taskBLine = lines.find(l => l.includes('Task B'));
        expect(taskBLine).toContain('5s');
      });

      it('increments frame counter', () => {
        mp = new MultiProgress(['A']);
        mp.startTime = Date.now();
        expect(mp.frame).toBe(0);
        mp._render();
        expect(mp.frame).toBe(1);
        mp._render();
        expect(mp.frame).toBe(2);
      });
    });

    describe('start', () => {
      it('initializes startTime, sets interval, hides cursor and reserves lines', () => {
        mp = new MultiProgress(['A', 'B']);
        mp.start();
        expect(mp._stopped).toBe(false);
        expect(mp.startTime).not.toBeNull();
        expect(mp.interval).not.toBeNull();
        // First call should be the setup buffer (hide cursor + newlines + move up)
        const setupCall = writeSpy.mock.calls[0][0];
        expect(setupCall).toContain('\x1b[?25l'); // hide cursor
      });

      it('starts rendering with interval', () => {
        mp = new MultiProgress(['A']);
        mp.start();
        const initialFrame = mp.frame;
        jest.advanceTimersByTime(100);
        expect(mp.frame).toBeGreaterThan(initialFrame);
      });
    });

    describe('update', () => {
      it('updates status for valid index', () => {
        mp = new MultiProgress(['A', 'B', 'C']);
        mp.update(1, 'done');
        expect(mp.statuses[1]).toBe('done');
      });

      it('updates status to error', () => {
        mp = new MultiProgress(['A', 'B']);
        mp.update(0, 'error');
        expect(mp.statuses[0]).toBe('error');
      });

      it('ignores negative index', () => {
        mp = new MultiProgress(['A', 'B']);
        mp.update(-1, 'done');
        expect(mp.statuses).toEqual(['running', 'running']);
      });

      it('ignores out-of-bounds index', () => {
        mp = new MultiProgress(['A', 'B']);
        mp.update(5, 'done');
        expect(mp.statuses).toEqual(['running', 'running']);
      });
    });

    describe('stop', () => {
      it('clears interval and calls _renderFinal', () => {
        mp = new MultiProgress(['A', 'B']);
        mp.start();
        const renderFinalSpy = jest.spyOn(mp, '_renderFinal');
        mp.stop();
        expect(mp._stopped).toBe(true);
        expect(mp.interval).toBeNull();
        expect(renderFinalSpy).toHaveBeenCalled();
        renderFinalSpy.mockRestore();
      });

      it('shows cursor after stop', () => {
        mp = new MultiProgress(['A']);
        mp.start();
        writeSpy.mockClear();
        mp.stop();
        const allOutput = writeSpy.mock.calls.map(c => c[0]).join('');
        expect(allOutput).toContain('\x1b[?25h');
      });
    });

    describe('_renderFinal', () => {
      it('renders done tasks with green checkmark', () => {
        mp = new MultiProgress(['Task A', 'Task B']);
        mp.statuses = ['done', 'done'];
        mp.startTime = Date.now();
        jest.advanceTimersByTime(5000);
        writeSpy.mockClear();
        mp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain(C.green);
        expect(output).toContain('\u2713');
      });

      it('renders error tasks with red X', () => {
        mp = new MultiProgress(['Task A']);
        mp.statuses = ['error'];
        mp.startTime = Date.now();
        writeSpy.mockClear();
        mp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain(C.red);
        expect(output).toContain('\u2717');
      });

      it('renders running tasks with yellow circle in final state', () => {
        mp = new MultiProgress(['Task A']);
        mp.statuses = ['running'];
        mp.startTime = Date.now();
        writeSpy.mockClear();
        mp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain(C.yellow);
        expect(output).toContain('\u25CB'); // ○
      });

      it('shows elapsed time on last line', () => {
        mp = new MultiProgress(['Task A', 'Task B']);
        mp.statuses = ['done', 'done'];
        mp.startTime = Date.now();
        jest.advanceTimersByTime(10000);
        writeSpy.mockClear();
        mp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('10s');
      });

      it('does not show elapsed if startTime is null', () => {
        mp = new MultiProgress(['Task A']);
        mp.statuses = ['done'];
        writeSpy.mockClear();
        mp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        // Should not have any elapsed time suffix
        expect(output).not.toMatch(/\d+s/);
      });
    });
  });

  // ─── cleanupTerminal with active TaskProgress ───────────────
  describe('cleanupTerminal', () => {
    it('writes show cursor + clear line escape sequence', () => {
      writeSpy.mockClear();
      cleanupTerminal();
      const allOutput = writeSpy.mock.calls.map(c => c[0]).join('');
      expect(allOutput).toContain('\x1b[?25h');
      expect(allOutput).toContain('\x1b[2K\r');
    });

    it('stops active TaskProgress and clears the reference', () => {
      const tp = new TaskProgress('Test', [
        { id: 't1', description: 'task one', status: 'in_progress' },
      ]);
      tp.start();
      expect(getActiveTaskProgress()).toBe(tp);

      writeSpy.mockClear();
      cleanupTerminal();

      // After cleanup, the active TaskProgress should be null
      expect(getActiveTaskProgress()).toBeNull();
      // The TaskProgress should have been stopped
      expect(tp.interval).toBeNull();
      expect(tp._stopped).toBe(true);
    });

    it('does not remove keypress listeners (readline safety)', () => {
      // cleanupTerminal no longer removes keypress listeners —
      // doing so would break readline's Ctrl+C handler
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', { value: true, writable: true });
      
      const mockListener = jest.fn();
      process.stdin.on('keypress', mockListener);
      const before = process.stdin.listeners('keypress').length;
      
      cleanupTerminal();
      
      const after = process.stdin.listeners('keypress').length;
      expect(after).toBe(before); // listeners preserved
      
      process.stdin.removeListener('keypress', mockListener);
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, writable: true });
    });

    it('works when no active TaskProgress exists', () => {
      setActiveTaskProgress(null);
      expect(() => cleanupTerminal()).not.toThrow();
    });
  });

  // ─── TaskProgress cleanup paths ─────────────────────────────
  describe('TaskProgress cleanup paths', () => {
    let tp;

    afterEach(() => {
      if (tp && tp.interval) {
        tp.stop();
      }
      tp = null;
    });

    it('stop while paused skips _renderFinal', () => {
      tp = new TaskProgress('Test', [
        { id: 't1', description: 'task one', status: 'pending' },
      ]);
      tp.start();
      tp.pause();
      expect(tp._paused).toBe(true);

      const renderFinalSpy = jest.spyOn(tp, '_renderFinal');
      writeSpy.mockClear();
      tp.stop();

      // _renderFinal should NOT be called when paused
      expect(renderFinalSpy).not.toHaveBeenCalled();
      expect(tp._paused).toBe(false);
      expect(tp._stopped).toBe(true);
      renderFinalSpy.mockRestore();
    });

    it('stop calls _renderFinal when not paused', () => {
      tp = new TaskProgress('Test', [
        { id: 't1', description: 'task one', status: 'done' },
      ]);
      tp.start();
      const renderFinalSpy = jest.spyOn(tp, '_renderFinal');
      tp.stop();
      expect(renderFinalSpy).toHaveBeenCalled();
      renderFinalSpy.mockRestore();
    });

    it('stop clears _activeTaskProgress when it matches this instance', () => {
      tp = new TaskProgress('Test', [
        { id: 't1', description: 'task', status: 'pending' },
      ]);
      tp.start();
      expect(getActiveTaskProgress()).toBe(tp);
      tp.stop();
      expect(getActiveTaskProgress()).toBeNull();
    });

    it('stop does not clear _activeTaskProgress if another instance is active', () => {
      tp = new TaskProgress('First', [
        { id: 't1', description: 'task', status: 'pending' },
      ]);
      tp.start();

      const tp2 = new TaskProgress('Second', [
        { id: 't2', description: 'other task', status: 'pending' },
      ]);
      tp2.start();
      // tp2.start() sets _activeTaskProgress to tp2

      // Now stop tp (not the currently active one)
      tp.stop();
      // _activeTaskProgress should still be tp2 because tp != tp2
      expect(getActiveTaskProgress()).toBe(tp2);

      tp2.stop();
    });

    it('stop resets _paused to false', () => {
      tp = new TaskProgress('Test', [
        { id: 't1', description: 'task', status: 'pending' },
      ]);
      tp.start();
      tp.pause();
      expect(tp._paused).toBe(true);
      tp.stop();
      expect(tp._paused).toBe(false);
    });

    it('stop shows cursor', () => {
      tp = new TaskProgress('Test', [
        { id: 't1', description: 'task', status: 'pending' },
      ]);
      tp.start();
      writeSpy.mockClear();
      tp.stop();
      const allOutput = writeSpy.mock.calls.map(c => c[0]).join('');
      expect(allOutput).toContain('\x1b[?25h');
    });
  });

  // ─── Spinner.update ──────────────────────────────────────────
  describe('Spinner.update', () => {
    it('changes the spinner text', () => {
      const spinner = new Spinner('old text');
      spinner.update('new text');
      expect(spinner.text).toBe('new text');
      // no need to stop since never started
    });
  });

  // ─── TaskProgress full coverage ─────────────────────────────
  describe('TaskProgress', () => {
    let tp;

    const sampleTasks = [
      { id: 't1', description: 'Create module', status: 'done' },
      { id: 't2', description: 'Add tests', status: 'in_progress' },
      { id: 't3', description: 'Update docs', status: 'pending' },
    ];

    afterEach(() => {
      if (tp) {
        if (tp.interval) tp.stop();
        else tp._stopped = true; // ensure no dangling state
      }
      tp = null;
    });

    describe('_formatElapsed', () => {
      it('returns empty string when startTime is null', () => {
        tp = new TaskProgress('Test', sampleTasks);
        expect(tp._formatElapsed()).toBe('');
      });

      it('returns empty string when less than 1 second elapsed', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(500);
        expect(tp._formatElapsed()).toBe('');
      });

      it('returns seconds string when < 60s', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(30000);
        expect(tp._formatElapsed()).toBe('30s');
      });

      it('returns minutes+seconds when >= 60s', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(90000); // 1m 30s
        expect(tp._formatElapsed()).toBe('1m 30s');
      });

      it('zero-pads seconds in minutes display', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(61000); // 1m 01s
        expect(tp._formatElapsed()).toBe('1m 01s');
      });
    });

    describe('_formatTokens', () => {
      it('returns empty string when tokens is 0', () => {
        tp = new TaskProgress('Test', sampleTasks);
        expect(tp._formatTokens()).toBe('');
      });

      it('returns empty string when tokens is negative', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.tokens = -5;
        expect(tp._formatTokens()).toBe('');
      });

      it('returns raw number for tokens < 1000', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.tokens = 500;
        expect(tp._formatTokens()).toBe('500');
      });

      it('returns k-formatted string for tokens >= 1000', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.tokens = 2500;
        expect(tp._formatTokens()).toBe('2.5k');
      });

      it('returns 1.0k for exactly 1000 tokens', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.tokens = 1000;
        expect(tp._formatTokens()).toBe('1.0k');
      });
    });

    describe('_render', () => {
      it('does not render when _stopped is true', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp._stopped = true;
        writeSpy.mockClear();
        tp._render();
        expect(writeSpy).not.toHaveBeenCalled();
      });

      it('renders header with task name and spinner frame', () => {
        tp = new TaskProgress('Building', sampleTasks);
        tp.startTime = Date.now();
        writeSpy.mockClear();
        tp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('Building');
      });

      it('renders tasks with correct icons for each status', () => {
        tp = new TaskProgress('Test', [
          { id: 't1', description: 'Done task', status: 'done' },
          { id: 't2', description: 'Progress task', status: 'in_progress' },
          { id: 't3', description: 'Pending task', status: 'pending' },
          { id: 't4', description: 'Failed task', status: 'failed' },
        ]);
        tp.startTime = Date.now();
        writeSpy.mockClear();
        tp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('\u2714'); // done icon
        expect(output).toContain('\u25FC'); // in_progress icon
        expect(output).toContain('\u25FB'); // pending icon
        expect(output).toContain('\u2717'); // failed icon
      });

      it('shows elapsed and tokens in stats', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        tp.tokens = 3000;
        jest.advanceTimersByTime(5000);
        writeSpy.mockClear();
        tp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('5s');
        expect(output).toContain('3.0k tokens');
      });

      it('truncates long descriptions to 55 chars', () => {
        const longDesc = 'A'.repeat(60);
        tp = new TaskProgress('Test', [{ id: 't1', description: longDesc, status: 'pending' }]);
        tp.startTime = Date.now();
        writeSpy.mockClear();
        tp._render();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('...');
        expect(output).not.toContain(longDesc);
      });

      it('uses first connector for first task and space for others', () => {
        tp = new TaskProgress('Test', [
          { id: 't1', description: 'first', status: 'pending' },
          { id: 't2', description: 'second', status: 'pending' },
        ]);
        tp.startTime = Date.now();
        writeSpy.mockClear();
        tp._render();
        const output = writeSpy.mock.calls[0][0];
        // First task uses ⎿ connector
        expect(output).toContain('\u23BF');
      });

      it('increments frame counter', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        expect(tp.frame).toBe(0);
        tp._render();
        expect(tp.frame).toBe(1);
      });

      it('moves cursor back up by lineCount', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.startTime = Date.now();
        writeSpy.mockClear();
        tp._render();
        const output = writeSpy.mock.calls[0][0];
        // lineCount = 1 + 3 tasks = 4
        expect(output).toContain(`\x1b[${tp.lineCount}A`);
      });
    });

    describe('pause', () => {
      it('clears interval and sets _paused to true', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        expect(tp.interval).not.toBeNull();
        tp.pause();
        expect(tp.interval).toBeNull();
        expect(tp._paused).toBe(true);
        tp.stop();
      });

      it('writes clear-line escapes for all occupied lines', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        writeSpy.mockClear();
        tp.pause();
        const output = writeSpy.mock.calls[0][0];
        // Should have \x1b[2K\n for each line and then cursor move up
        const clearCount = (output.match(/\x1b\[2K\n/g) || []).length;
        expect(clearCount).toBe(tp.lineCount);
        tp.stop();
      });

      it('is idempotent - second call is a no-op', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        tp.pause();
        writeSpy.mockClear();
        tp.pause();
        // No writes should happen on second pause call
        expect(writeSpy).not.toHaveBeenCalled();
        tp.stop();
      });
    });

    describe('resume', () => {
      it('restores interval and clears _paused flag', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        tp.pause();
        expect(tp._paused).toBe(true);
        expect(tp.interval).toBeNull();
        tp.resume();
        expect(tp._paused).toBe(false);
        expect(tp.interval).not.toBeNull();
        tp.stop();
      });

      it('hides cursor and reserves lines on resume', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        tp.pause();
        writeSpy.mockClear();
        tp.resume();
        const allOutput = writeSpy.mock.calls.map(c => c[0]).join('');
        expect(allOutput).toContain('\x1b[?25l');
        tp.stop();
      });

      it('is a no-op when not paused', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        writeSpy.mockClear();
        tp.resume();
        // Should not write anything since not paused
        expect(writeSpy).not.toHaveBeenCalled();
        tp.stop();
      });

      it('resumes rendering after pause', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        tp.pause();
        const frameBefore = tp.frame;
        tp.resume();
        // resume calls _render once immediately
        expect(tp.frame).toBeGreaterThan(frameBefore);
        tp.stop();
      });
    });

    describe('updateTask', () => {
      it('changes task status by id', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.updateTask('t3', 'done');
        expect(tp.tasks[2].status).toBe('done');
      });

      it('ignores unknown task ids', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.updateTask('nonexistent', 'done');
        // All statuses remain unchanged
        expect(tp.tasks[0].status).toBe('done');
        expect(tp.tasks[1].status).toBe('in_progress');
        expect(tp.tasks[2].status).toBe('pending');
      });
    });

    describe('setStats', () => {
      it('updates token count', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.setStats({ tokens: 1500 });
        expect(tp.tokens).toBe(1500);
      });

      it('does not update tokens when undefined', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.tokens = 500;
        tp.setStats({});
        expect(tp.tokens).toBe(500);
      });
    });

    describe('isActive', () => {
      it('returns true when interval is running', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        expect(tp.isActive()).toBe(true);
        tp.stop();
      });

      it('returns true when paused', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        tp.pause();
        expect(tp.isActive()).toBe(true);
        tp.stop();
      });

      it('returns false when stopped', () => {
        tp = new TaskProgress('Test', sampleTasks);
        tp.start();
        tp.stop();
        expect(tp.isActive()).toBe(false);
      });
    });

    describe('_renderFinal', () => {
      it('shows summary with done and total counts', () => {
        tp = new TaskProgress('Build', [
          { id: 't1', description: 'Step 1', status: 'done' },
          { id: 't2', description: 'Step 2', status: 'done' },
          { id: 't3', description: 'Step 3', status: 'pending' },
        ]);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(5000);
        writeSpy.mockClear();
        tp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('Build');
        expect(output).toContain('2/3 done');
        expect(output).toContain('5s');
      });

      it('shows failed count when tasks have failed', () => {
        tp = new TaskProgress('Build', [
          { id: 't1', description: 'Step 1', status: 'done' },
          { id: 't2', description: 'Step 2', status: 'failed' },
          { id: 't3', description: 'Step 3', status: 'failed' },
        ]);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(3000);
        writeSpy.mockClear();
        tp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('1/3 done');
        expect(output).toContain('2 failed');
      });

      it('renders correct icons for each task status in final render', () => {
        tp = new TaskProgress('Build', [
          { id: 't1', description: 'Done', status: 'done' },
          { id: 't2', description: 'Failed', status: 'failed' },
          { id: 't3', description: 'Pending', status: 'pending' },
        ]);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(1000);
        writeSpy.mockClear();
        tp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain(C.green);
        expect(output).toContain(C.red);
        expect(output).toContain(C.dim);
      });

      it('truncates long descriptions in final render', () => {
        const longDesc = 'B'.repeat(60);
        tp = new TaskProgress('Build', [{ id: 't1', description: longDesc, status: 'done' }]);
        tp.startTime = Date.now();
        jest.advanceTimersByTime(1000);
        writeSpy.mockClear();
        tp._renderFinal();
        const output = writeSpy.mock.calls[0][0];
        expect(output).toContain('...');
        expect(output).not.toContain(longDesc);
      });
    });
  });

  // ─── setActiveTaskProgress / getActiveTaskProgress ──────────
  describe('setActiveTaskProgress / getActiveTaskProgress', () => {
    it('sets and gets the active task progress', () => {
      const tp = new TaskProgress('Test', [{ id: 't1', description: 'task' }]);
      setActiveTaskProgress(tp);
      expect(getActiveTaskProgress()).toBe(tp);
      setActiveTaskProgress(null);
      expect(getActiveTaskProgress()).toBeNull();
    });
  });
});

/**
 * cli/footer.js — Sticky Status Bar
 *
 * Reserves the bottom 2 terminal rows:
 *   Row N-1 : status bar (model / mode info + separator line) — never scrolls
 *   Row N   : readline prompt + input — operates naturally, no special patching
 *
 * The scroll region covers rows 1..N-2 so agent output never overwrites the
 * status bar or the readline input area.
 *
 * The key insight: we do NOT intercept readline's internal cursor management.
 * We only ensure readline is positioned on row N before each prompt call, and
 * that agent output stays in rows 1..N-2.
 *
 * Integration:
 *   const { StickyFooter } = require('./footer');
 *   const footer = new StickyFooter();
 *   footer.activate(rl);        // after readline.createInterface()
 *   footer.deactivate();        // on exit / graceful shutdown
 */

'use strict';

const C_DIM   = '\x1b[2m';
const C_RESET = '\x1b[0m';

/** Strip ANSI escape sequences to measure the true visible character width. */
function visibleLen(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '').length;
}

class StickyFooter {
  constructor() {
    this._active            = false;
    this._rl                = null;
    this._origWrite         = null;   // original process.stdout.write (pre-patch)
    this._origPrompt        = null;
    this._origSetPr         = null;
    this._origRefreshLine   = null;   // original rl._refreshLine
    this._origLog           = null;
    this._origError         = null;
    this._origStderrWrite   = null;
    this._drawing           = false;
    this._offResize         = null;
    this._cursorOnInputRow  = false;  // true when readline owns cursor (row N)
    this._lastOutputRow     = 1;      // cursor row after last stdout write (tracks \n)
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  get _rows()       { return process.stdout.rows    || 24; }
  get _cols()       { return process.stdout.columns || 80; }

  /** Last row of the scrolling zone (everything above status bar). */
  get _scrollEnd()  { return this._rows - 2; }

  /** Row of the status bar (separator + prompt info). */
  get _rowStatus()  { return this._rows - 1; }

  /** Row of the readline input line. */
  get _rowInput()   { return this._rows; }

  // ── Low-level helpers ─────────────────────────────────────────────────────

  _goto(row, col = 1) { return `\x1b[${row};${col}H`; }

  /** Build the status bar: a plain dim separator line. */
  _statusLine() {
    return C_DIM + '─'.repeat(this._cols) + C_RESET;
  }

  // ── Status bar draw ───────────────────────────────────────────────────────

  drawFooter(promptOverride) {
    if (!this._origWrite || this._drawing) return;
    this._drawing = true;
    // Use DECSC/DECRC (7/8) — more reliable than \x1b[s/\x1b[u across scroll regions
    this._origWrite(
      '\x1b7' +                                                    // save cursor (DECSC)
      this._goto(this._rowStatus) + '\x1b[2K' +                   // clear status row
      this._statusLine(promptOverride) +                           // draw separator
      '\x1b8'                                                      // restore cursor (DECRC)
    );
    this._drawing = false;
  }

  _setScrollRegion() {
    const end = Math.max(1, this._scrollEnd);
    this._origWrite(`\x1b[1;${end}r`);
  }

  _clearScrollRegion() {
    if (this._origWrite) this._origWrite('\x1b[r');
  }

  _eraseStatus() {
    if (!this._origWrite) return;
    this._origWrite(
      '\x1b7' +
      this._goto(this._rowStatus) + '\x1b[2K' +
      '\x1b8'
    );
  }

  // ── Activate / Deactivate ─────────────────────────────────────────────────

  activate(rl) {
    if (!process.stdout.isTTY) return; // no-op in pipes / CI
    this._rl        = rl;
    this._origWrite = process.stdout.write.bind(process.stdout);
    this._active    = true;

    // 1. Set scroll region — rows 1..N-2, leaving status bar + input outside.
    //    Most terminals (macOS Terminal, iTerm2) reset cursor to (1,1) on DECSTBM.
    this._setScrollRegion();
    this._lastOutputRow = 1;

    // 2. Draw initial status bar
    this.drawFooter();

    const self = this;

    // 3. Patch process.stdout.write to track \n and advance _lastOutputRow.
    //    When the cursor is on the input row (row N, outside the scroll region),
    //    strip any \n from the write so readline's "Enter → \r\n" doesn't cause
    //    the terminal to scroll the entire screen (which would break the footer).
    const rawWrite = process.stdout.write.bind(process.stdout);
    this._origWrite = rawWrite;  // low-level write that bypasses our patch
    process.stdout.write = function(data, ...rest) {
      if (self._active && typeof data === 'string') {
        if (self._cursorOnInputRow) {
          // --- streaming agent output (contains \n, longer than a readline sequence) ---
          // Move cursor back to scroll region so it renders there, not on row N.
          // Exclude readline's own output: readline always includes \r (for line refresh
          // or completion list), while agent/console output does not contain \r.
          if (data.includes('\n') && data.length > 4 && !data.includes('\r')) {
            self._cursorOnInputRow = false;
            rawWrite(self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)));
            // fall through to normal row-tracking + write below

          // --- single printable char echo from readline (end-of-line fast path) ---
          // readline skips _refreshLine when typing at end-of-line and just echoes
          // the char directly.  If the char lands at column N it auto-wraps to col 0
          // of row N and overwrites the prompt.  Fix: since the char is already
          // appended to rl.line before the echo, redirect through _refreshLine so
          // the truncated/scrolled view is redrawn cleanly instead.
          // Detection: ≤4 bytes (covers multi-byte UTF-8), no control chars, no \n/\r.
          } else if (
            data.length <= 4 &&
            !data.includes('\n') &&
            !data.includes('\r') &&
            !/[\x00-\x1f\x7f]/.test(data) &&
            self._rl && self._rl._refreshLine
          ) {
            self._rl._refreshLine();
            return true;

          // --- all other writes on input row (ANSI escapes, \r, short sequences) ---
          // Suppress any stray \n to protect the scroll region boundary.
          } else {
            const stripped = data.replace(/\n/g, '');
            if (!stripped) return true;
            return rawWrite(stripped, ...rest);
          }
        }
        // Count explicit newlines AND soft-wrap rows caused by long lines.
        // Without soft-wrap counting, _lastOutputRow drifts low and subsequent
        // writes overwrite previous lines instead of advancing past them.
        const cols = self._cols || 80;
        let extraRows = 0;
        // Split on \n to examine each logical line for soft-wrap
        const parts = data.split('\n');
        for (let p = 0; p < parts.length; p++) {
          const visLen = visibleLen(parts[p]);
          if (visLen > 0) extraRows += Math.floor((visLen - 1) / cols);
        }
        const nl = parts.length - 1; // number of \n chars
        const rowAdvance = nl + extraRows;
        if (rowAdvance > 0) {
          self._lastOutputRow = Math.min(self._lastOutputRow + rowAdvance, self._scrollEnd);
        }
      }
      return rawWrite(data, ...rest);
    };

    this._cursorOnInputRow = false;

    // 4. Patch process.stderr.write — anchor spinner/cursor animation.
    //    Use _lastOutputRow+1 so spinner appears right after current content,
    //    capped at scrollEnd to protect footer rows.
    //    When cursor is on the input row, save/restore cursor (DECSC/DECRC) so
    //    the spinner animation doesn't displace readline's input row position.
    this._origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = function(data, ...rest) {
      if (!self._active) return self._origStderrWrite(data, ...rest);
      if (typeof data === 'string' && data.includes('\r')) {
        const anchorRow = Math.min(self._lastOutputRow + 1, self._scrollEnd);
        if (self._cursorOnInputRow) {
          // Cursor is on input row — save it, render spinner, restore it.
          // This keeps readline's cursor position intact (same approach as drawFooter).
          self._origWrite('\x1b7');                   // DECSC: save cursor
          self._origWrite(self._goto(anchorRow));
          const result = self._origStderrWrite(data, ...rest);
          self._origWrite('\x1b8');                   // DECRC: restore to input row
          return result;
        }
        self._origWrite(self._goto(anchorRow));
      }
      return self._origStderrWrite(data, ...rest);
    };

    // 5. Patch console.log / console.error — keep output in scroll region
    this._origLog   = console.log;
    this._origError = console.error;

    function wrappedLog(...args) {
      if (!self._active) { self._origLog(...args); return; }
      // Always position cursor at the next available row — handles cursor drift
      // from spinners or other writes that don't go through this path.
      self._origWrite(self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)));
      self._cursorOnInputRow = false;
      self._origLog(...args);
      self.drawFooter();
      // Re-anchor readline to input row so the user can type while the agent runs.
      // Use the patched rl.prompt() which correctly resets _prevPos, positions
      // cursor at rowN via _origWrite, calls origPrompt (which calls _refreshLine),
      // and sets _cursorOnInputRow = true — all in one safe, well-ordered step.
      if (self._rl) self._rl.prompt();
    }

    function wrappedError(...args) {
      if (!self._active) { self._origError(...args); return; }
      self._origWrite(self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)));
      self._cursorOnInputRow = false;
      self._origError(...args);
      self.drawFooter();
      if (self._rl) self._rl.prompt();
    }

    console.log   = wrappedLog;
    console.error = wrappedError;

    // 6. Patch rl.setPrompt — update status bar when prompt text changes
    this._origSetPr = rl.setPrompt.bind(rl);
    rl.setPrompt = function(prompt) {
      self._origSetPr(prompt);
      if (self._active) self.drawFooter(prompt);
    };

    // 7. Patch rl.prompt — anchor readline to the input row (N) before writing
    //    so readline's clearScreenDown only clears row N, never the status bar.
    //    Reset _prevPos so readline never moves UP into the separator row.
    this._origPrompt = rl.prompt.bind(rl);
    rl.prompt = function(preserveCursor) {
      if (!self._active) { return self._origPrompt(preserveCursor); }
      // Reset readline's row-tracking so it doesn't cursor-up into the separator
      rl._prevPos = null;
      // Position cursor on input row so readline writes there
      self._origWrite(self._goto(self._rowInput));
      self._origPrompt(preserveCursor);
      // Mark that cursor is now on the input row
      self._cursorOnInputRow = true;
    };

    // 7b. Patch rl.question — anchor confirm prompts to the input row like rl.prompt.
    //     Without this, rl.question writes its prompt at the current cursor position
    //     (often mid-scroll-region), causing the typed answer to appear above the
    //     question and leaving the question text on screen after Enter.
    const origQuestion = rl.question.bind(rl);
    rl.question = function(prompt, callback) {
      if (!self._active) { return origQuestion(prompt, callback); }
      // Clear input row and position cursor there before writing the question
      self._origWrite(self._goto(self._rowInput) + '\x1b[2K');
      rl._prevPos = null;
      self._cursorOnInputRow = true;
      origQuestion(prompt, (answer) => {
        // After answer: clear input row, return cursor to scroll region
        self._origWrite(self._goto(self._rowInput) + '\x1b[2K');
        self._cursorOnInputRow = false;
        self.drawFooter();
        callback(answer);
      });
    };

    // 8. Patch rl._refreshLine to prevent long input lines from wrapping.
    //    When prompt + line exceeds terminal width, readline would wrap to the
    //    next row — but row N is the last row outside the scroll region, so
    //    wrapping corrupts the separator and prompt label via terminal auto-wrap.
    //    Fix: always re-anchor to row N first (in case a character echo caused
    //    an auto-wrap to row N+1), then show a truncated "scrolled" view for
    //    lines that are too long.  The full rl.line is preserved for submission.
    const origRefreshLine = rl._refreshLine ? rl._refreshLine.bind(rl) : null;
    this._origRefreshLine = origRefreshLine;
    if (origRefreshLine) {
      rl._refreshLine = function() {
        if (!self._active) { return origRefreshLine(); }

        // Always re-anchor cursor to the input row before rendering.
        // A character echo at the last column can auto-wrap the cursor to the
        // row below row N; without this, origRefreshLine's \r would operate on
        // the wrong row and the prompt would be drawn outside the input area.
        // Reset _prevPos so readline doesn't try to move UP from row N —
        // inline completion hints in Node.js v22+ can set _prevPos.rows > 0
        // (hint renders below the line), which causes each subsequent refresh
        // to move the cursor one row higher, drifting the input toward row 1.
        rl._prevPos = null;
        self._origWrite(self._goto(self._rowInput));

        const cols        = self._cols;
        const promptVis   = visibleLen(rl._prompt || '');
        const maxLineLen  = cols - promptVis - 1;   // chars available for line text

        if (rl.line.length <= maxLineLen) {
          // Line fits — render normally
          return origRefreshLine();
        }

        // Line is too long: show a horizontally-scrolled view.
        // Keep the characters near the cursor visible; prefix with a dim «.
        const savedLine   = rl.line;
        const savedCursor = rl.cursor;

        const viewLen   = Math.max(1, maxLineLen - 1);  // 1 char for « prefix
        const cursorEnd = savedCursor;
        const start     = Math.max(0, cursorEnd - viewLen);
        const truncated = (start > 0 ? '«' : '') + savedLine.slice(start, start + viewLen + (start > 0 ? 0 : 1));

        rl.line   = truncated;
        rl.cursor = truncated.length;
        origRefreshLine();

        // Restore actual content (never modified for submission)
        rl.line   = savedLine;
        rl.cursor = savedCursor;
      };
    }

    // 9. After user submits input (Enter), move cursor into scroll zone.
    //    readline's \r\n is now suppressed (by the stdout patch above) so the
    //    terminal won't scroll outside the scroll region.  We echo the typed
    //    input into the scroll region so it's visible before the response.
    rl.on('line', (line) => {
      if (self._active) {
        self._cursorOnInputRow = false;  // unlock patched stdout (re-enable \n tracking)
        // Clear the input row so the typed text doesn't linger
        self._origWrite(self._goto(self._rowInput) + '\x1b[2K');
        // Position cursor at next available row in scroll region
        self._origWrite(self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)));
        // Input echo is handled by index.js after paste resolution (full content).
        self.drawFooter();
      }
    });

    // 9. Handle terminal resize
    const onResize = () => {
      this._setScrollRegion();
      this.drawFooter();
      // Re-anchor readline to the new input row (row count may have changed).
      // _lastOutputRow is still valid — existing content rows are preserved.
      if (this._rl) this._rl.prompt();
    };
    process.stdout.on('resize', onResize);
    this._offResize = () => process.stdout.off('resize', onResize);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;

    if (this._offResize) { this._offResize(); this._offResize = null; }

    // Restore stderr
    if (this._origStderrWrite) {
      process.stderr.write = this._origStderrWrite;
      this._origStderrWrite = null;
    }

    // Restore console
    if (this._origLog)   { console.log   = this._origLog;   this._origLog   = null; }
    if (this._origError) { console.error = this._origError; this._origError = null; }

    // Restore process.stdout.write
    if (this._origWrite) { process.stdout.write = this._origWrite; }

    // Restore readline methods
    if (this._rl) {
      if (this._origPrompt)      { this._rl.prompt        = this._origPrompt;      this._origPrompt      = null; }
      if (this._origSetPr)       { this._rl.setPrompt     = this._origSetPr;       this._origSetPr       = null; }
      if (this._origRefreshLine) { this._rl._refreshLine  = this._origRefreshLine; this._origRefreshLine = null; }
    }

    // Clear status bar and restore full scroll region
    this._eraseStatus();
    this._clearScrollRegion();
    this._origWrite = null;
  }
}

module.exports = { StickyFooter };

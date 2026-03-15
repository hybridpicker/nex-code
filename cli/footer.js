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
          // Suppress \n while cursor is on input row — prevents terminal scroll
          // outside the scroll region when readline emits \r\n for Enter.
          const stripped = data.replace(/\n/g, '');
          if (!stripped) return true;
          return rawWrite(stripped, ...rest);
        }
        const nl = (data.match(/\n/g) || []).length;
        if (nl > 0) {
          self._lastOutputRow = Math.min(self._lastOutputRow + nl, self._scrollEnd);
        }
      }
      return rawWrite(data, ...rest);
    };

    this._cursorOnInputRow = false;

    // 4. Patch process.stderr.write — anchor spinner/cursor animation.
    //    Use _lastOutputRow+1 so spinner appears right after current content,
    //    capped at scrollEnd to protect footer rows.
    this._origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = function(data, ...rest) {
      if (!self._active) return self._origStderrWrite(data, ...rest);
      if (typeof data === 'string' && data.includes('\r')) {
        const anchorRow = Math.min(self._lastOutputRow + 1, self._scrollEnd);
        self._origWrite(self._goto(anchorRow));  // write anchor to stdout
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
    }

    function wrappedError(...args) {
      if (!self._active) { self._origError(...args); return; }
      self._origWrite(self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)));
      self._cursorOnInputRow = false;
      self._origError(...args);
      self.drawFooter();
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

    // 8. Patch rl._refreshLine to prevent long input lines from wrapping.
    //    When prompt + line exceeds terminal width, readline would wrap to the
    //    next row — but row N is the last row outside the scroll region, so
    //    wrapping corrupts the separator and prompt label via terminal auto-wrap.
    //    Fix: temporarily replace rl.line with a truncated "scrolled" view
    //    so _refreshLine always renders a single row.  The full content of
    //    rl.line is preserved for actual submission.
    const origRefreshLine = rl._refreshLine ? rl._refreshLine.bind(rl) : null;
    this._origRefreshLine = origRefreshLine;
    if (origRefreshLine) {
      rl._refreshLine = function() {
        if (!self._active) { return origRefreshLine(); }

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

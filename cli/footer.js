/**
 * cli/footer.js — Sticky Bottom Input Bar
 *
 * Reserves the bottom 3 terminal lines for a bordered input area using
 * ANSI scroll regions. The scrolling region (rows 1..rows-3) receives all
 * normal output; the footer zone (top-border / prompt / bottom-border)
 * stays fixed via absolute cursor positioning.
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

class StickyFooter {
  constructor() {
    this._active      = false;
    this._rl          = null;
    this._origWrite   = null;
    this._origPrompt  = null;
    this._origSetPr   = null;
    this._origLog     = null;
    this._origError   = null;
    this._drawing     = false;
    this._offResize   = null;
  }

  // ── Geometry ──────────────────────────────────────────────────────────────

  get _rows() { return process.stdout.rows    || 24; }
  get _cols() { return process.stdout.columns || 80; }

  /** Last row of the scrolling zone (everything above footer). */
  get _scrollEnd()  { return this._rows - 3; }

  /** Row numbers of the three footer lines (1-based). */
  get _rowBorder1() { return this._rows - 2; }
  get _rowPrompt()  { return this._rows - 1; }
  get _rowBorder2() { return this._rows;     }

  // ── Low-level helpers ─────────────────────────────────────────────────────

  _goto(row, col = 1) { return `\x1b[${row};${col}H`; }
  _border()           { return C_DIM + '─'.repeat(this._cols) + C_RESET; }

  // ── Footer draw / erase ───────────────────────────────────────────────────

  /**
   * Draw (or refresh) the three footer lines without disturbing the scroll
   * zone or readline's cursor position.
   */
  drawFooter(promptOverride) {
    if (!this._origWrite || this._drawing) return;
    this._drawing = true;

    const border = this._border();
    const prompt = promptOverride !== undefined
      ? promptOverride
      : (this._rl ? this._rl._prompt : '');

    this._origWrite(
      '\x1b[s'  +                                           // save cursor
      this._goto(this._rowBorder1) + '\x1b[2K' + border +  // top border
      this._goto(this._rowPrompt)  + '\x1b[2K' + prompt  + // prompt line
      this._goto(this._rowBorder2) + '\x1b[2K' + border +  // bottom border
      '\x1b[u'                                              // restore cursor
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

  _eraseFooter() {
    if (!this._origWrite) return;
    this._origWrite(
      '\x1b[s' +
      this._goto(this._rowBorder1) + '\x1b[2K' +
      this._goto(this._rowPrompt)  + '\x1b[2K' +
      this._goto(this._rowBorder2) + '\x1b[2K' +
      '\x1b[u'
    );
  }

  // ── Activate / Deactivate ─────────────────────────────────────────────────

  activate(rl) {
    if (!process.stdout.isTTY) return; // no-op in pipes / CI
    this._rl        = rl;
    this._origWrite = process.stdout.write.bind(process.stdout);
    this._active    = true;

    // 1. Set scroll region — leaves bottom 3 rows outside the scroll zone
    this._setScrollRegion();

    // 2. Draw initial footer
    this.drawFooter();

    // 3. Patch console.log / console.error — redraw footer after each line
    const self = this;
    this._origLog = console.log;
    this._origError = console.error;

    function wrappedLog(...args) {
      if (!self._active) { self._origLog(...args); return; }
      // Temporarily go into scroll region before printing
      self._origWrite(self._goto(self._scrollEnd) + '\n');
      self._origLog(...args);
      // Restore footer in case output overwrote it
      self.drawFooter();
    }

    function wrappedError(...args) {
      if (!self._active) { self._origError(...args); return; }
      self._origWrite(self._goto(self._scrollEnd) + '\n');
      self._origError(...args);
      self.drawFooter();
    }

    console.log   = wrappedLog;
    console.error = wrappedError;

    // 4. Patch rl.setPrompt — reflect prompt text changes in footer
    this._origSetPr = rl.setPrompt.bind(rl);
    rl.setPrompt = function(prompt) {
      self._origSetPr(prompt);
      if (self._active) self.drawFooter(prompt);
    };

    // 5. Patch rl.prompt — position cursor inside footer, then let readline write
    this._origPrompt = rl.prompt.bind(rl);
    rl.prompt = function(preserveCursor) {
      if (!self._active) { return self._origPrompt(preserveCursor); }
      // Move to the prompt row so readline writes there
      self._origWrite(self._goto(self._rowPrompt) + '\x1b[2K');
      self._origPrompt(preserveCursor);
      // Ensure borders are still intact (readline writes only cleared the prompt line)
      self._origWrite(
        '\x1b[s' +
        self._goto(self._rowBorder1) + '\x1b[2K' + self._border() +
        self._goto(self._rowBorder2) + '\x1b[2K' + self._border() +
        '\x1b[u'
      );
    };

    // 6. After user submits input (Enter), move cursor back into scroll zone
    //    so that streaming LLM output lands in the scrolling region, not the footer.
    rl.on('line', () => {
      if (self._active) {
        self._origWrite(self._goto(self._scrollEnd));
      }
    });

    // 7. Handle terminal resize
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

    // Restore console
    if (this._origLog)   { console.log   = this._origLog;   this._origLog   = null; }
    if (this._origError) { console.error = this._origError; this._origError = null; }

    // Restore readline methods
    if (this._rl) {
      if (this._origPrompt) { this._rl.prompt    = this._origPrompt; this._origPrompt = null; }
      if (this._origSetPr)  { this._rl.setPrompt = this._origSetPr;  this._origSetPr  = null; }
    }

    // Clear footer lines and restore full scroll region
    this._eraseFooter();
    this._clearScrollRegion();
    this._origWrite = null;
  }
}

module.exports = { StickyFooter };

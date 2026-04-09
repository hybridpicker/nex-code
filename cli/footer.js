/**
 * cli/footer.js — Sticky Status Bar
 *
 * Reserves the bottom 2 terminal rows:
 *   Row N-1 : status bar (separator line) — never scrolls
 *   Row N   : readline prompt + input
 *
 * Scroll region = rows 1..N-2.  Agent output stays in the scroll region.
 * readline draws on row N.  The stdout patch ensures that when the cursor
 * is on row N, no \n can escape and break the layout.
 *
 * Debug: set FOOTER_DEBUG=1 to write trace log to /tmp/footer-debug.log
 */

"use strict";

const fs = require("fs");
const { T, isDark } = require("./theme");

const C_RESET = "\x1b[0m";

// Apple Terminal (light mode) darkens all rows outside the DECSTBM scroll
// region at the OS level — no ANSI escape can override this. Detect it once
// so we can skip _setScrollRegion() on that terminal.
const _noScrollRegion = !isDark;

// ── Debug logger ────────────────────────────────────────────────────────────
const DEBUG =
  process.env.FOOTER_DEBUG && process.env.FOOTER_DEBUG !== "0";
const DEBUG_ANSI = process.env.FOOTER_DEBUG === "2"; // full ANSI trace
let _dbgFd = null;
function _dbg(...args) {
  if (!DEBUG) return;
  if (!_dbgFd) _dbgFd = fs.openSync("/tmp/footer-debug.log", "w", 0o600);
  fs.writeSync(_dbgFd, args.join(" ") + "\n");
}
function _dbgAnsi(label, data) {
  if (!DEBUG_ANSI) return;
  if (!_dbgFd) _dbgFd = fs.openSync("/tmp/footer-debug.log", "w", 0o600);
  const readable = data
    .replace(/\x1b\[([^a-zA-Z]*)([a-zA-Z])/g, (_, p, cmd) => `<ESC[${p}${cmd}>`)
    .replace(/\x1b([^[])/g, (_, c) => `<ESC${c}>`)
    .replace(/\r/g, "<CR>")
    .replace(/\n/g, "<LF>\n")
    .replace(
      /[\x00-\x08\x0b-\x1f\x7f]/g,
      (c) => `<${c.charCodeAt(0).toString(16).padStart(2, "0")}>`,
    );
  fs.writeSync(_dbgFd, `${label}: ${readable}\n`);
}

function visibleLen(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "").length;
}

class StickyFooter {
  constructor() {
    this._active = false;
    this._rl = null;
    this._origWrite = null;
    this._origPrompt = null;
    this._origSetPr = null;
    this._origRefreshLine = null;
    this._origLog = null;
    this._origError = null;
    this._origStderrWrite = null;
    this._drawing = false;
    this._offResize = null;
    this._cursorOnInputRow = false;
    this._inRefreshLine = false;
    this._lastOutputRow = 1;
    this._prevTermRows = 0;
    this._prevTermCols = 0;
    this._consistencyTimer = null;
    this._dirty = false; // set when layout might be stale
    // Status bar info (set via setStatusInfo)
    this._statusModel = "";
    this._statusBranch = "";
    this._statusProject = "";
    this._statusMode = ""; // e.g. 'plan · semi' or 'always'
  }

  /**
   * Set content shown in the status bar.
   * Call after footer.activate() once model/project info is known.
   */
  setStatusInfo({ model, branch, project, mode } = {}) {
    if (model !== undefined) this._statusModel = model;
    if (branch !== undefined) this._statusBranch = branch;
    if (project !== undefined) this._statusProject = project;
    if (mode !== undefined) this._statusMode = mode;
    if (this._active) this.drawFooter();
  }

  get _rows() {
    return process.stdout.rows || 24;
  }
  get _cols() {
    return process.stdout.columns || 80;
  }
  get _scrollEnd() {
    return this._rows - 2;
  }
  get _rowStatus() {
    return this._rows - 1;
  }
  get _rowInput() {
    return this._rows;
  }

  _goto(row, col = 1) {
    return `\x1b[${row};${col}H`;
  }

  _statusLine() {
    const cols = this._cols;
    const model = this._statusModel;
    const branch = this._statusBranch;
    const project = this._statusProject;
    const mode = this._statusMode;

    if (!model) {
      return T.footer_sep + "─".repeat(cols) + C_RESET;
    }

    // Build colored left info segment
    const divider = ` ${T.footer_divider}·${C_RESET} `;
    const parts = [];
    if (model) parts.push(`${T.footer_model}${model}${C_RESET}`);
    if (branch) parts.push(`${T.footer_branch}${branch}${C_RESET}`);
    if (project) parts.push(`${T.footer_project}${project}${C_RESET}`);
    const info = parts.join(divider);
    const visibleInfo = [model, branch, project]
      .filter(Boolean)
      .join(" · ").length;
    const prefix = "─ ";

    if (mode) {
      // Right-aligned mode badge: ── info ───── mode ──
      const visibleMode = mode.length;
      const trailLen = Math.max(
        0,
        cols - prefix.length - visibleInfo - 1 - 1 - visibleMode - 3,
      );
      const trail = "─".repeat(trailLen);
      return (
        `${T.footer_sep}${prefix}${C_RESET}` +
        `${info}${T.footer_sep} ${trail} ${C_RESET}` +
        `${T.footer_mode}${mode}${C_RESET}` +
        `${T.footer_sep} ──${C_RESET}`
      );
    }

    const trailLen = Math.max(0, cols - prefix.length - visibleInfo - 2);
    const trail = "─".repeat(trailLen);
    return `${T.footer_sep}${prefix}${C_RESET}${info}${T.footer_sep} ${trail}${C_RESET}`;
  }

  drawFooter(promptOverride) {
    if (!this._origWrite || this._drawing) return;
    this._drawing = true;
    this._origWrite(
      "\x1b7" +
        this._goto(this._rowStatus) +
        "\x1b[2K" +
        this._statusLine(promptOverride) +
        "\x1b8",
    );
    this._drawing = false;
  }

  _setScrollRegion() {
    if (_noScrollRegion) return; // light terminal: skip — avoids dark row artifact
    const end = Math.max(1, this._scrollEnd);
    this._origWrite(`\x1b[1;${end}r`);
  }

  _clearScrollRegion() {
    // Always clear — even on light terminals we must wipe any stale region
    // left by a previous run that did set DECSTBM.
    if (this._origWrite) this._origWrite("\x1b[r");
  }

  _eraseStatus() {
    if (!this._origWrite) return;
    this._origWrite(
      "\x1b7" + this._goto(this._rowStatus) + "\x1b[2K" + "\x1b8",
    );
  }

  /** Write directly to stdout, bypassing the patch. */
  rawWrite(data) {
    _dbgAnsi("RAW", data);
    if (this._origWrite) return this._origWrite(data);
    return process.stdout.write(data);
  }

  /**
   * Full relayout: clear footer area, set scroll region, redraw footer + prompt.
   * Called by resize handler, consistency check, and any explicit layout fix.
   */
  _relayout(reason) {
    if (!this._origWrite) return;
    const rawWrite = this._origWrite;
    const rows = this._rows;
    const cols = this._cols;
    const scrollEnd = Math.max(1, rows - 2);

    _dbg(
      "RELAYOUT:",
      reason,
      "rows=" + rows,
      "cols=" + cols,
      "scrollEnd=" + scrollEnd,
      "cursorOnInput=" + this._cursorOnInputRow,
    );

    this._prevTermRows = rows;
    this._prevTermCols = cols;

    // 1. Clear everything from last content row+1 to the bottom of the screen.
    //    This catches ghost separators that wrapped when the terminal width shrank.
    //    Use absolute positioning — no DECSC/DECRC to avoid stale saves.
    const clearFrom = Math.min(this._lastOutputRow + 1, scrollEnd + 1);
    let clearBuf = "";
    for (let r = clearFrom; r <= rows; r++) {
      clearBuf += this._goto(r) + "\x1b[2K";
    }
    rawWrite(clearBuf);

    // 2. Set scroll region (resets cursor to 1,1 on many terminals).
    this._setScrollRegion();
    this._lastOutputRow = Math.min(this._lastOutputRow, scrollEnd);

    // 3. Redraw status bar using DECSC/DECRC (cursor is at 1,1 after DECSTBM,
    //    and DECRC restores to 1,1 — that's fine, step 4 repositions).
    this.drawFooter();

    // 4. Re-anchor prompt to input row.
    if (this._cursorOnInputRow && this._rl) {
      this._rl.prompt(true); // preserveCursor — keeps typed text
    }

    this._dirty = false;
  }

  activate(rl) {
    if (!process.stdout.isTTY) return;
    this._rl = rl;
    this._origWrite = process.stdout.write.bind(process.stdout);
    this._active = true;
    this._prevTermRows = this._rows;
    this._prevTermCols = this._cols;

    // Clear any stale scroll region left by a previous run before setting ours.
    this._origWrite("\x1b[r");
    this._setScrollRegion();
    this._lastOutputRow = 1;
    this.drawFooter();

    const self = this;

    // ── stdout patch ──────────────────────────────────────────────────────
    const rawWrite = process.stdout.write.bind(process.stdout);
    this._origWrite = rawWrite;

    process.stdout.write = function (data, ...rest) {
      _dbgAnsi("PATCH", data);
      if (!self._active || typeof data !== "string") {
        return rawWrite(data, ...rest);
      }

      // While origRefreshLine executes, just strip \n and pass through.
      if (self._inRefreshLine) {
        const stripped = data.replace(/\n/g, "");
        if (!stripped) return true;
        return rawWrite(stripped, ...rest);
      }

      if (self._cursorOnInputRow) {
        // Short write with no newline or carriage return: treat as readline
        // input-row activity regardless of whether it contains control chars.
        // This covers both the printable-char fast-path echo AND single control
        // chars like \x7f (Backspace), \x08 (BS), \x12 (Ctrl+R reverse-search),
        // and short ANSI cursor-movement sequences (\x1b[C, \x1b[D, …).
        // Without this, control chars fail the old !/[\x00-\x1f\x7f]/ check and
        // fall through to the "anchor to workspace" path, writing raw ^R/^H etc.
        // to the scroll region (visible as "k^RRRRRRR" artefacts).
        // Agent output is always longer than 4 chars OR contains \n/\r so it
        // is not affected.
        if (data.length <= 4 && !data.includes("\n") && !data.includes("\r")) {
          _dbg("STDOUT: input-row intercept:", JSON.stringify(data));
          if (self._origRefreshLine) {
            self._doRefreshLine();
          }
          return true;
        }
        // Longer write or write with \n/\r: agent output, section headers,
        // \r-based animations, token streams. Anchor to the workspace so
        // nothing lands on the input/status rows.
        _dbg(
          "STDOUT: non-echo on input row, anchoring to workspace, data=" +
            JSON.stringify(data).slice(0, 100),
        );
        self._cursorOnInputRow = false;
        rawWrite(
          self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)),
        );
        // fall through to row-tracking
      }

      // Row tracking for scroll-region content.
      const cols = self._cols || 80;
      let extraRows = 0;
      const parts = data.split("\n");
      for (let p = 0; p < parts.length; p++) {
        const vl = visibleLen(parts[p]);
        if (vl > 0) extraRows += Math.floor((vl - 1) / cols);
      }
      const nl = parts.length - 1;
      if (nl + extraRows > 0) {
        self._lastOutputRow = Math.min(
          self._lastOutputRow + nl + extraRows,
          self._scrollEnd,
        );
      }
      return rawWrite(data, ...rest);
    };

    this._cursorOnInputRow = false;

    // ── stderr patch (spinner) ────────────────────────────────────────────
    this._origStderrWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = function (data, ...rest) {
      if (!self._active) return self._origStderrWrite(data, ...rest);
      if (typeof data === "string" && data.includes("\r")) {
        const anchorRow = Math.min(self._lastOutputRow + 1, self._scrollEnd);
        if (self._cursorOnInputRow) {
          self._origWrite("\x1b7");
          self._origWrite(self._goto(anchorRow));
          const result = self._origStderrWrite(data, ...rest);
          self._origWrite("\x1b8");
          return result;
        }
        self._origWrite(self._goto(anchorRow));
      }
      const result = self._origStderrWrite(data, ...rest);
      // Animation frames (_render) always end with a cursor-up sequence
      // (\x1b[NА) to restore position for the next frame. Final renders
      // (_renderFinal, _renderFinal-like) do not — they end with \n and
      // leave the cursor wherever the last task line landed. If that happens
      // to be the input row (because _cursorOnInputRow was true when the
      // frame fired), the last task line bleeds into the prompt area.
      // Fix: after any multi-line stderr write that lacks a cursor-up,
      // redraw the footer and clear the input row.
      if (
        typeof data === "string" &&
        data.includes("\n") &&
        !/\x1b\[\d+A/.test(data) &&
        self._cursorOnInputRow
      ) {
        self.drawFooter();
        self._origWrite(self._goto(self._rowInput) + "\x1b[2K");
      }
      return result;
    };

    // ── console.log / console.error ───────────────────────────────────────
    this._origLog = console.log;
    this._origError = console.error;

    function wrappedLog(...args) {
      if (!self._active) {
        self._origLog(...args);
        return;
      }
      self._origWrite(
        self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)),
      );
      self._cursorOnInputRow = false;
      self._origLog(...args);
      self.drawFooter();
      // Reposition cursor to the input row so keypresses land there, but do NOT
      // call rl.prompt() — that triggers _doRefreshLine on every tool line, which
      // clears+rewrites the input row and causes visual corruption during agent runs.
      // Clear the input row (\x1b[2K) so residual SSH/tool output doesn't bleed
      // into the prompt area between tool calls.
      rawWrite(self._goto(self._rowInput) + "\x1b[2K");
      self._cursorOnInputRow = true;
    }

    function wrappedError(...args) {
      if (!self._active) {
        self._origError(...args);
        return;
      }
      self._origWrite(
        self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)),
      );
      self._cursorOnInputRow = false;
      self._origError(...args);
      self.drawFooter();
      rawWrite(self._goto(self._rowInput) + "\x1b[2K");
      self._cursorOnInputRow = true;
    }

    console.log = wrappedLog;
    console.error = wrappedError;

    // ── rl.setPrompt ──────────────────────────────────────────────────────
    this._origSetPr = rl.setPrompt.bind(rl);
    rl.setPrompt = function (prompt) {
      self._origSetPr(prompt);
      if (self._active) self.drawFooter(prompt);
    };

    // ── rl.prompt ─────────────────────────────────────────────────────────
    this._origPrompt = rl.prompt.bind(rl);
    rl.prompt = function (preserveCursor) {
      if (!self._active) {
        return self._origPrompt(preserveCursor);
      }
      _dbg("PROMPT: goto rowInput=" + self._rowInput);
      rl.prevRows = 0;
      rawWrite(self._goto(self._rowInput) + C_RESET + "\x1b[2K");
      self._cursorOnInputRow = true;
      self._origPrompt(preserveCursor);
    };

    // ── rl.question ───────────────────────────────────────────────────────
    const origQuestion = rl.question.bind(rl);
    rl.question = function (prompt, callback) {
      if (!self._active) {
        return origQuestion(prompt, callback);
      }
      rawWrite(self._goto(self._rowInput) + "\x1b[2K");
      rl.prevRows = 0;
      self._cursorOnInputRow = true;
      origQuestion(prompt, (answer) => {
        rawWrite(self._goto(self._rowInput) + "\x1b[2K");
        self._cursorOnInputRow = false;
        self.drawFooter();
        callback(answer);
      });
    };

    // ── _refreshLine patch (via Symbol) ───────────────────────────────────
    const proto = Object.getPrototypeOf(rl);
    const kRefreshLineSym = Object.getOwnPropertySymbols(proto).find(
      (s) => s.toString() === "Symbol(_refreshLine)",
    );
    const origRefreshLine = kRefreshLineSym
      ? proto[kRefreshLineSym].bind(rl)
      : rl._refreshLine
        ? rl._refreshLine.bind(rl)
        : null;
    this._origRefreshLine = origRefreshLine;

    this._doRefreshLine = function () {
      if (!self._active || !origRefreshLine) return;

      // During resize drag, suppress per-pixel redraws — mark dirty instead.
      if (
        self._rows !== self._prevTermRows ||
        self._cols !== self._prevTermCols
      ) {
        self._dirty = true;
        return;
      }

      rl.prevRows = 0;
      rawWrite(self._goto(self._rowInput) + C_RESET + "\x1b[2K");

      const cols = self._cols;
      const promptStr = rl._prompt || "";
      const promptVis = visibleLen(promptStr);
      const maxLineLen = cols - promptVis - 1;

      self._inRefreshLine = true;
      try {
        if (rl.line.length <= maxLineLen) {
          _dbg("REFRESH: short line, len=" + rl.line.length);
          origRefreshLine();
          return;
        }

        _dbg(
          "REFRESH: long line, len=" + rl.line.length + ", max=" + maxLineLen,
        );
        const savedLine = rl.line;
        const savedCursor = rl.cursor;
        const viewLen = Math.max(1, maxLineLen - 1);
        const start = Math.max(0, savedCursor - viewLen);
        const truncated =
          (start > 0 ? "«" : "") +
          savedLine.slice(start, start + viewLen + (start > 0 ? 0 : 1));
        rl.line = truncated;
        rl.cursor = truncated.length;
        origRefreshLine();
        rl.line = savedLine;
        rl.cursor = savedCursor;
      } finally {
        self._inRefreshLine = false;
      }
    };

    if (origRefreshLine) {
      const doRefresh = this._doRefreshLine;
      if (kRefreshLineSym) {
        Object.defineProperty(rl, kRefreshLineSym, {
          value: doRefresh,
          writable: true,
          configurable: true,
        });
      }
      rl._refreshLine = doRefresh;
    }

    // ── 'line' event ──────────────────────────────────────────────────────
    rl.on("line", () => {
      if (self._active) {
        _dbg("LINE: leaving input row");
        self._cursorOnInputRow = false;
        rawWrite(self._goto(self._rowInput) + "\x1b[2K");
        rawWrite(
          self._goto(Math.min(self._lastOutputRow + 1, self._scrollEnd)),
        );
        self.drawFooter();
      }
    });

    // ── resize handler (debounced 80ms) ───────────────────────────────────
    let _resizeTimer = null;
    let _resizeCleanup = null;
    const doResize = () => {
      _resizeTimer = null;
      self._relayout("resize");
      // Schedule a second cleanup pass — terminals sometimes reflow content
      // AFTER the resize event settles, leaving new ghost artifacts.
      if (_resizeCleanup) clearTimeout(_resizeCleanup);
      _resizeCleanup = setTimeout(() => {
        _resizeCleanup = null;
        self._relayout("resize-cleanup");
      }, 300);
    };
    const onResize = () => {
      self._dirty = true;
      if (_resizeTimer) clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(doResize, 80);
    };
    process.stdout.on("resize", onResize);
    this._offResize = () => {
      process.stdout.off("resize", onResize);
      if (_resizeTimer) {
        clearTimeout(_resizeTimer);
        _resizeTimer = null;
      }
      if (_resizeCleanup) {
        clearTimeout(_resizeCleanup);
        _resizeCleanup = null;
      }
    };

    // ── Periodic consistency check (every 800ms) ──────────────────────────
    // Catches ghost lines and layout drift that escape the resize handler.
    this._consistencyTimer = setInterval(() => {
      if (!self._active) return;
      const rowsNow = self._rows;
      const colsNow = self._cols;

      // Detect if terminal size changed without a resize event, or if dirty.
      if (
        self._dirty ||
        rowsNow !== self._prevTermRows ||
        colsNow !== self._prevTermCols
      ) {
        _dbg(
          "CONSISTENCY: dirty=" +
            self._dirty +
            " rows=" +
            rowsNow +
            "/" +
            self._prevTermRows +
            " cols=" +
            colsNow +
            "/" +
            self._prevTermCols,
        );
        self._relayout("consistency");
      }
    }, 800);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;

    if (this._offResize) {
      this._offResize();
      this._offResize = null;
    }
    if (this._consistencyTimer) {
      clearInterval(this._consistencyTimer);
      this._consistencyTimer = null;
    }

    if (this._origStderrWrite) {
      process.stderr.write = this._origStderrWrite;
      this._origStderrWrite = null;
    }

    if (this._origLog) {
      console.log = this._origLog;
      this._origLog = null;
    }
    if (this._origError) {
      console.error = this._origError;
      this._origError = null;
    }

    if (this._origWrite) {
      process.stdout.write = this._origWrite;
    }

    if (this._rl) {
      if (this._origPrompt) {
        this._rl.prompt = this._origPrompt;
        this._origPrompt = null;
      }
      if (this._origSetPr) {
        this._rl.setPrompt = this._origSetPr;
        this._origSetPr = null;
      }
      if (this._origRefreshLine) {
        const kSym = Object.getOwnPropertySymbols(
          Object.getPrototypeOf(this._rl),
        ).find((s) => s.toString() === "Symbol(_refreshLine)");
        if (kSym) delete this._rl[kSym];
        delete this._rl._refreshLine;
        this._origRefreshLine = null;
      }
    }

    this._eraseStatus();
    this._clearScrollRegion();
    this._origWrite = null;
  }
}

module.exports = { StickyFooter };

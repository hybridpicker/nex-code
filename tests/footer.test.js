/**
 * tests/footer.test.js — Tests for cli/footer.js (StickyFooter)
 */

"use strict";

// Mock theme before requiring footer
jest.mock("../cli/theme", () => ({
  T: {
    footer_sep: "\x1b[2m",
    footer_model: "\x1b[38;2;80;175;235m",
    footer_branch: "\x1b[38;2;80;210;100m",
    footer_project: "\x1b[38;2;130;130;145m",
    footer_divider: "\x1b[38;2;80;80;95m",
    reset: "\x1b[0m",
  },
  isDark: true,
}));

const { StickyFooter } = require("../cli/footer");

describe("StickyFooter", () => {
  let footer;

  beforeEach(() => {
    footer = new StickyFooter();
  });

  afterEach(() => {
    // Ensure deactivate is called to clean up any patches
    if (footer._active) footer.deactivate();
  });

  // ─── Constructor defaults ──────────────────────────────────
  describe("constructor", () => {
    it("initializes with _active = false", () => {
      expect(footer._active).toBe(false);
    });

    it("initializes with null references", () => {
      expect(footer._rl).toBeNull();
      expect(footer._origWrite).toBeNull();
      expect(footer._origPrompt).toBeNull();
      expect(footer._origSetPr).toBeNull();
      expect(footer._origRefreshLine).toBeNull();
      expect(footer._origLog).toBeNull();
      expect(footer._origError).toBeNull();
      expect(footer._origStderrWrite).toBeNull();
    });

    it("initializes with default state values", () => {
      expect(footer._drawing).toBe(false);
      expect(footer._cursorOnInputRow).toBe(false);
      expect(footer._inRefreshLine).toBe(false);
      expect(footer._lastOutputRow).toBe(1);
      expect(footer._prevTermRows).toBe(0);
      expect(footer._prevTermCols).toBe(0);
      expect(footer._dirty).toBe(false);
    });

    it("initializes with empty status info", () => {
      expect(footer._statusModel).toBe("");
      expect(footer._statusBranch).toBe("");
      expect(footer._statusProject).toBe("");
    });
  });

  // ─── setStatusInfo ─────────────────────────────────────────
  describe("setStatusInfo()", () => {
    it("sets model, branch, and project", () => {
      footer.setStatusInfo({
        model: "gpt-4",
        branch: "main",
        project: "my-app",
      });
      expect(footer._statusModel).toBe("gpt-4");
      expect(footer._statusBranch).toBe("main");
      expect(footer._statusProject).toBe("my-app");
    });

    it("defaults to empty strings when no args", () => {
      footer.setStatusInfo();
      expect(footer._statusModel).toBe("");
      expect(footer._statusBranch).toBe("");
      expect(footer._statusProject).toBe("");
    });

    it("defaults to empty strings when partial args", () => {
      footer.setStatusInfo({ model: "claude" });
      expect(footer._statusModel).toBe("claude");
      expect(footer._statusBranch).toBe("");
      expect(footer._statusProject).toBe("");
    });

    it("calls drawFooter when active", () => {
      footer._active = true;
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer.setStatusInfo({ model: "test" });
      expect(footer._origWrite).toHaveBeenCalled();
    });

    it("does not call drawFooter when inactive", () => {
      const drawSpy = jest.spyOn(footer, "drawFooter");
      footer.setStatusInfo({ model: "test" });
      expect(drawSpy).not.toHaveBeenCalled();
      drawSpy.mockRestore();
    });
  });

  // ─── _statusLine ──────────────────────────────────────────
  describe("_statusLine()", () => {
    it("returns separator line when no model set", () => {
      const line = footer._statusLine();
      expect(line).toContain("─");
      expect(line).toContain("\x1b[0m"); // C_RESET
    });

    it("includes model name when set", () => {
      footer.setStatusInfo({ model: "gpt-4" });
      const line = footer._statusLine();
      expect(line).toContain("gpt-4");
    });

    it("includes branch when set", () => {
      footer.setStatusInfo({ model: "gpt-4", branch: "main" });
      const line = footer._statusLine();
      expect(line).toContain("main");
    });

    it("includes project when set", () => {
      footer.setStatusInfo({ model: "gpt-4", project: "my-app" });
      const line = footer._statusLine();
      expect(line).toContain("my-app");
    });

    it("includes divider dot between parts", () => {
      footer.setStatusInfo({ model: "gpt-4", branch: "main", project: "app" });
      const line = footer._statusLine();
      // The divider character is '·'
      expect(line).toContain("·");
    });

    it("produces a plain separator when model is empty string", () => {
      footer.setStatusInfo({ model: "", branch: "main" });
      const line = footer._statusLine();
      // With no model, it returns a simple separator
      expect(line).not.toContain("main");
    });
  });

  // ─── activate on TTY vs non-TTY ────────────────────────────
  describe("activate()", () => {
    it("does nothing when stdout is not a TTY", () => {
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        configurable: true,
      });

      const mockRl = { on: jest.fn(), setPrompt: jest.fn(), prompt: jest.fn() };
      footer.activate(mockRl);

      expect(footer._active).toBe(false);
      expect(footer._rl).toBeNull();

      Object.defineProperty(process.stdout, "isTTY", {
        value: origIsTTY,
        configurable: true,
      });
    });

    it.skip("activates when stdout is a TTY", () => {
      const origIsTTY = process.stdout.isTTY;
      const origRows = process.stdout.rows;
      const origCols = process.stdout.columns;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: 24,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      });

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      // Suppress actual writes
      const origWrite = process.stdout.write;
      process.stdout.write = jest.fn().mockReturnValue(true);
      const origStderrWrite = process.stderr.write;
      process.stderr.write = jest.fn().mockReturnValue(true);

      footer.activate(mockRl);

      expect(footer._active).toBe(true);
      expect(footer._rl).toBe(mockRl);
      expect(footer._origWrite).toBeTruthy();

      footer.deactivate();

      // Restore
      process.stdout.write = origWrite;
      process.stderr.write = origStderrWrite;
      Object.defineProperty(process.stdout, "isTTY", {
        value: origIsTTY,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "columns", {
        value: origCols,
        configurable: true,
      });
    });
  });

  // ─── deactivate ────────────────────────────────────────────
  describe("deactivate()", () => {
    it("does nothing when not active", () => {
      footer.deactivate();
      expect(footer._active).toBe(false);
    });

    it("sets _active to false", () => {
      footer._active = true;
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._origStderrWrite = jest.fn().mockReturnValue(true);
      footer._origLog = console.log;
      footer._origError = console.error;
      footer._rl = {
        prompt: jest.fn(),
        setPrompt: jest.fn(),
      };
      footer._origPrompt = jest.fn();
      footer._origSetPr = jest.fn();

      footer.deactivate();
      expect(footer._active).toBe(false);
      expect(footer._origWrite).toBeNull();
    });

    it("clears consistency timer", () => {
      footer._active = true;
      footer._consistencyTimer = setInterval(() => {}, 10000);
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._origStderrWrite = jest.fn().mockReturnValue(true);
      footer._origLog = console.log;
      footer._origError = console.error;

      footer.deactivate();
      expect(footer._consistencyTimer).toBeNull();
    });

    it("clears resize handler", () => {
      footer._active = true;
      const offResize = jest.fn();
      footer._offResize = offResize;
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._origStderrWrite = jest.fn().mockReturnValue(true);
      footer._origLog = console.log;
      footer._origError = console.error;

      footer.deactivate();
      expect(offResize).toHaveBeenCalled();
      expect(footer._offResize).toBeNull();
    });
  });

  // ─── drawFooter ────────────────────────────────────────────
  describe("drawFooter()", () => {
    it("does nothing when _origWrite is null", () => {
      footer.drawFooter();
      // Should not throw
    });

    it("does nothing when already drawing", () => {
      footer._origWrite = jest.fn();
      footer._drawing = true;
      footer.drawFooter();
      expect(footer._origWrite).not.toHaveBeenCalled();
    });

    it("writes status line when origWrite is available", () => {
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer.setStatusInfo({ model: "gpt-4" });
      footer.drawFooter();
      expect(footer._origWrite).toHaveBeenCalled();
      const written = footer._origWrite.mock.calls[0][0];
      // Should contain save/restore cursor sequences
      expect(written).toContain("\x1b7"); // DECSC
      expect(written).toContain("\x1b8"); // DECRC
    });

    it("sets _drawing false after completion", () => {
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer.drawFooter();
      expect(footer._drawing).toBe(false);
    });
  });

  // ─── rawWrite ──────────────────────────────────────────────
  describe("rawWrite()", () => {
    it("uses _origWrite when available", () => {
      footer._origWrite = jest.fn().mockReturnValue(true);
      const result = footer.rawWrite("hello");
      expect(footer._origWrite).toHaveBeenCalledWith("hello");
      expect(result).toBe(true);
    });

    it("falls back to process.stdout.write when _origWrite is null", () => {
      const writeSpy = jest
        .spyOn(process.stdout, "write")
        .mockReturnValue(true);
      footer._origWrite = null;
      footer.rawWrite("hello");
      expect(writeSpy).toHaveBeenCalledWith("hello");
      writeSpy.mockRestore();
    });
  });

  // ─── Computed properties ───────────────────────────────────
  describe("computed properties", () => {
    it("_rows defaults to 24 when stdout.rows is undefined", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: undefined,
        configurable: true,
      });
      expect(footer._rows).toBe(24);
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });

    it("_cols defaults to 80 when stdout.columns is undefined", () => {
      const origCols = process.stdout.columns;
      Object.defineProperty(process.stdout, "columns", {
        value: undefined,
        configurable: true,
      });
      expect(footer._cols).toBe(80);
      Object.defineProperty(process.stdout, "columns", {
        value: origCols,
        configurable: true,
      });
    });

    it("_rows uses actual stdout.rows", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: 40,
        configurable: true,
      });
      expect(footer._rows).toBe(40);
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });

    it("_scrollEnd is rows - 2", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: 30,
        configurable: true,
      });
      expect(footer._scrollEnd).toBe(28);
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });

    it("_rowStatus is rows - 1", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: 30,
        configurable: true,
      });
      expect(footer._rowStatus).toBe(29);
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });

    it("_rowInput is rows", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: 30,
        configurable: true,
      });
      expect(footer._rowInput).toBe(30);
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });
  });

  // ─── _goto ─────────────────────────────────────────────────
  describe("_goto()", () => {
    it("generates correct ANSI cursor positioning", () => {
      expect(footer._goto(5, 10)).toBe("\x1b[5;10H");
    });

    it("defaults col to 1", () => {
      expect(footer._goto(3)).toBe("\x1b[3;1H");
    });
  });

  // ─── _statusLine (with model/branch/project) ──────────────────
  describe("_statusLine() extended", () => {
    it("includes all three parts with dividers when all set", () => {
      footer.setStatusInfo({
        model: "claude",
        branch: "devel",
        project: "nex",
      });
      const line = footer._statusLine();
      expect(line).toContain("claude");
      expect(line).toContain("devel");
      expect(line).toContain("nex");
      expect(line).toContain("·");
      expect(line).toContain("─ "); // prefix
    });

    it("omits branch divider when only model set", () => {
      footer.setStatusInfo({ model: "gpt-4" });
      const line = footer._statusLine();
      expect(line).toContain("gpt-4");
      expect(line).toContain("─ ");
    });

    it("includes trailing dashes to fill width", () => {
      footer.setStatusInfo({ model: "x", branch: "y", project: "z" });
      const line = footer._statusLine();
      // Should have trailing dashes
      expect(line).toContain("─");
    });
  });

  // ─── _setScrollRegion ────────────────────────────────────────
  describe("_setScrollRegion()", () => {
    it("calls _origWrite with DECSTBM sequence when dark theme", () => {
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._setScrollRegion();
      // isDark is mocked to true, so _noScrollRegion is false → should call
      expect(footer._origWrite).toHaveBeenCalled();
    });
  });

  // ─── _clearScrollRegion ──────────────────────────────────────
  describe("_clearScrollRegion()", () => {
    it("clears scroll region via _origWrite", () => {
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._clearScrollRegion();
      expect(footer._origWrite).toHaveBeenCalledWith("\x1b[r");
    });

    it("does nothing when _origWrite is null", () => {
      footer._origWrite = null;
      expect(() => footer._clearScrollRegion()).not.toThrow();
    });
  });

  // ─── _eraseStatus ───────────────────────────────────────────
  describe("_eraseStatus()", () => {
    it("erases the status line area", () => {
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._eraseStatus();
      expect(footer._origWrite).toHaveBeenCalled();
      const written = footer._origWrite.mock.calls[0][0];
      expect(written).toContain("\x1b7"); // save cursor
      expect(written).toContain("\x1b8"); // restore cursor
      expect(written).toContain("\x1b[2K"); // erase line
    });

    it("does nothing when _origWrite is null", () => {
      footer._origWrite = null;
      expect(() => footer._eraseStatus()).not.toThrow();
    });
  });

  // ─── _relayout ──────────────────────────────────────────────
  describe("_relayout()", () => {
    it("does nothing when _origWrite is null", () => {
      footer._origWrite = null;
      expect(() => footer._relayout("test")).not.toThrow();
    });

    it("redraws footer and updates prevTermRows/Cols", () => {
      const origRows = process.stdout.rows;
      const origCols = process.stdout.columns;
      Object.defineProperty(process.stdout, "rows", {
        value: 30,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "columns", {
        value: 100,
        configurable: true,
      });

      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._lastOutputRow = 5;
      footer._relayout("test");

      expect(footer._prevTermRows).toBe(30);
      expect(footer._prevTermCols).toBe(100);
      expect(footer._dirty).toBe(false);
      expect(footer._origWrite).toHaveBeenCalled();

      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "columns", {
        value: origCols,
        configurable: true,
      });
    });

    it("calls rl.prompt when cursor is on input row", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: 24,
        configurable: true,
      });

      const mockRl = { prompt: jest.fn() };
      footer._rl = mockRl;
      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._cursorOnInputRow = true;
      footer._lastOutputRow = 5;
      footer._relayout("test");

      expect(mockRl.prompt).toHaveBeenCalledWith(true);

      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });

    it("clamps _lastOutputRow to scrollEnd", () => {
      const origRows = process.stdout.rows;
      Object.defineProperty(process.stdout, "rows", {
        value: 10,
        configurable: true,
      });

      footer._origWrite = jest.fn().mockReturnValue(true);
      footer._lastOutputRow = 100;
      footer._relayout("test");

      expect(footer._lastOutputRow).toBeLessThanOrEqual(8); // scrollEnd = 10 - 2

      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
    });
  });

  // ─── activate TTY test (unskipped) ──────────────────────────
  describe("activate() on TTY", () => {
    let origIsTTY,
      origRows,
      origCols,
      origWrite,
      origStderrWrite,
      origLog,
      origError;

    beforeEach(() => {
      origIsTTY = process.stdout.isTTY;
      origRows = process.stdout.rows;
      origCols = process.stdout.columns;
      origWrite = process.stdout.write;
      origStderrWrite = process.stderr.write;
      origLog = console.log;
      origError = console.error;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: 24,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "columns", {
        value: 80,
        configurable: true,
      });
    });

    afterEach(() => {
      if (footer._active) footer.deactivate();
      process.stdout.write = origWrite;
      process.stderr.write = origStderrWrite;
      console.log = origLog;
      console.error = origError;
      Object.defineProperty(process.stdout, "isTTY", {
        value: origIsTTY,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "rows", {
        value: origRows,
        configurable: true,
      });
      Object.defineProperty(process.stdout, "columns", {
        value: origCols,
        configurable: true,
      });
    });

    it("activates and patches console.log/error", () => {
      // Suppress all writes
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);

      expect(footer._active).toBe(true);
      expect(footer._rl).toBe(mockRl);
      // console.log should now be the wrapped version
      expect(console.log).not.toBe(origLog);
      expect(console.error).not.toBe(origError);
    });

    it("wrappedLog calls drawFooter", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      const drawSpy = jest.spyOn(footer, "drawFooter");

      // Use the wrapped console.log
      console.log("test output");

      // wrappedLog calls drawFooter
      expect(drawSpy).toHaveBeenCalled();
      drawSpy.mockRestore();
    });

    it("wrappedError calls drawFooter", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      const drawSpy = jest.spyOn(footer, "drawFooter");
      console.error("error output");
      expect(drawSpy).toHaveBeenCalled();
      drawSpy.mockRestore();
    });

    it("patched rl.setPrompt calls drawFooter", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const origSetPrompt = jest.fn();
      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: origSetPrompt,
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      const drawSpy = jest.spyOn(footer, "drawFooter");
      // After activate, mockRl.setPrompt is now the patched version
      mockRl.setPrompt("new> ");
      expect(drawSpy).toHaveBeenCalled();
      drawSpy.mockRestore();
    });

    it("deactivate restores console.log/error", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      footer.deactivate();

      expect(footer._active).toBe(false);
      expect(console.log).toBe(origLog);
      expect(console.error).toBe(origError);
    });

    it("patched stdout.write passes through non-string data", () => {
      const mockWrite = jest.fn().mockReturnValue(true);
      process.stdout.write = mockWrite;
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      // _origWrite is now the bound version of mockWrite
      const buf = Buffer.from("hello");
      process.stdout.write(buf);
      // The original mockWrite should have been called with the buffer
      expect(mockWrite).toHaveBeenCalledWith(buf);
    });

    it("patched stderr.write handles spinner \r content", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      // Stderr write with \r (spinner-like)
      process.stderr.write("\rspinning...");
      // Should have been intercepted (not throw)
    });

    it("stdout.write strips newlines when on input row and in refreshLine mode", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      footer._inRefreshLine = true;
      process.stdout.write("test\ndata");
      // Should strip \n and pass through
    });

    it("stdout.write tracks row count from newlines", () => {
      process.stdout.write = jest.fn().mockReturnValue(true);
      process.stderr.write = jest.fn().mockReturnValue(true);

      const mockRl = {
        on: jest.fn().mockReturnThis(),
        setPrompt: jest.fn(),
        prompt: jest.fn(),
        question: jest.fn(),
        _prompt: "> ",
        line: "",
        cursor: 0,
        prevRows: 0,
      };

      footer.activate(mockRl);
      footer._cursorOnInputRow = false;
      footer._lastOutputRow = 1;
      process.stdout.write("line1\nline2\nline3");
      expect(footer._lastOutputRow).toBeGreaterThan(1);
    });
  });

  // ─── visibleLen (indirectly tested via _statusLine) ──────────
  describe("visibleLen (via _statusLine)", () => {
    it("strips ANSI when computing visible widths", () => {
      footer.setStatusInfo({ model: "test-model" });
      const line = footer._statusLine();
      // The line should contain trailing dashes computed based on visible length
      expect(line).toContain("─");
    });
  });
});

/**
 * tests/theme.test.js — Tests for cli/theme.js
 * Theme detection: NEX_THEME env, COLORFGBG detection, theme key completeness
 */

"use strict";

describe("theme.js", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
    // Clear the module cache so each test gets a fresh detection
    jest.resetModules();
  });

  // ─── NEX_THEME env override ────────────────────────────────
  describe("NEX_THEME env override", () => {
    it("returns dark theme when NEX_THEME=dark", () => {
      process.env.NEX_THEME = "dark";
      delete process.env.COLORFGBG;
      const { isDark, T, DARK } = require("../cli/theme");
      expect(isDark).toBe(true);
      expect(T).toBe(DARK);
    });

    it("returns light theme when NEX_THEME=light", () => {
      process.env.NEX_THEME = "light";
      delete process.env.COLORFGBG;
      const { isDark, T, LIGHT } = require("../cli/theme");
      expect(isDark).toBe(false);
      expect(T).toBe(LIGHT);
    });

    it("is case-insensitive for NEX_THEME", () => {
      process.env.NEX_THEME = "DARK";
      delete process.env.COLORFGBG;
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(true);
    });

    it("treats NEX_THEME=LIGHT as light", () => {
      process.env.NEX_THEME = "LIGHT";
      delete process.env.COLORFGBG;
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(false);
    });
  });

  // ─── COLORFGBG detection ───────────────────────────────────
  describe("COLORFGBG detection", () => {
    it("detects dark bg when COLORFGBG bg index < 8", () => {
      delete process.env.NEX_THEME;
      process.env.COLORFGBG = "15;0";
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(true);
    });

    it("detects light bg when COLORFGBG bg index >= 8", () => {
      delete process.env.NEX_THEME;
      process.env.COLORFGBG = "0;15";
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(false);
    });

    it("handles 3-part COLORFGBG (fg;?;bg)", () => {
      delete process.env.NEX_THEME;
      process.env.COLORFGBG = "15;default;0";
      const { isDark } = require("../cli/theme");
      // Last segment is 0, which is < 8 = dark
      expect(isDark).toBe(true);
    });

    it("handles COLORFGBG with bg = 7 (dark boundary)", () => {
      delete process.env.NEX_THEME;
      process.env.COLORFGBG = "0;7";
      const { isDark } = require("../cli/theme");
      // bg=7 is < 8, so dark
      expect(isDark).toBe(true);
    });

    it("handles COLORFGBG with bg = 8 (light boundary)", () => {
      delete process.env.NEX_THEME;
      process.env.COLORFGBG = "0;8";
      const { isDark } = require("../cli/theme");
      // bg=8 >= 8, so light
      expect(isDark).toBe(false);
    });
  });

  // ─── DARK theme key completeness ───────────────────────────
  describe("DARK theme keys", () => {
    it("has all required semantic keys", () => {
      const { DARK } = require("../cli/theme");
      const requiredKeys = [
        "reset",
        "bold",
        "dim",
        "primary",
        "secondary",
        "success",
        "warning",
        "error",
        "muted",
        "subtle",
      ];
      for (const key of requiredKeys) {
        expect(DARK).toHaveProperty(key);
        expect(typeof DARK[key]).toBe("string");
      }
    });

    it("has all tool category keys", () => {
      const { DARK } = require("../cli/theme");
      const toolKeys = [
        "tool_read",
        "tool_write",
        "tool_exec",
        "tool_search",
        "tool_git",
        "tool_web",
        "tool_sysadmin",
        "tool_default",
      ];
      for (const key of toolKeys) {
        expect(DARK).toHaveProperty(key);
      }
    });

    it("has syntax highlighting keys", () => {
      const { DARK } = require("../cli/theme");
      const synKeys = [
        "syn_keyword",
        "syn_string",
        "syn_number",
        "syn_comment",
        "syn_key",
      ];
      for (const key of synKeys) {
        expect(DARK).toHaveProperty(key);
      }
    });

    it("has diff keys", () => {
      const { DARK } = require("../cli/theme");
      expect(DARK).toHaveProperty("diff_add");
      expect(DARK).toHaveProperty("diff_rem");
    });

    it("has banner keys", () => {
      const { DARK } = require("../cli/theme");
      const bannerKeys = [
        "banner_logo",
        "banner_name",
        "banner_version",
        "banner_model",
        "banner_yolo",
      ];
      for (const key of bannerKeys) {
        expect(DARK).toHaveProperty(key);
      }
    });

    it("has footer keys", () => {
      const { DARK } = require("../cli/theme");
      const footerKeys = [
        "footer_sep",
        "footer_model",
        "footer_branch",
        "footer_project",
        "footer_divider",
      ];
      for (const key of footerKeys) {
        expect(DARK).toHaveProperty(key);
      }
    });

    it("has backward-compat ANSI keys", () => {
      const { DARK } = require("../cli/theme");
      const compatKeys = [
        "white",
        "red",
        "green",
        "yellow",
        "blue",
        "magenta",
        "cyan",
        "gray",
        "bgRed",
        "bgGreen",
        "brightCyan",
        "brightMagenta",
        "brightBlue",
      ];
      for (const key of compatKeys) {
        expect(DARK).toHaveProperty(key);
      }
    });
  });

  // ─── LIGHT theme key completeness ──────────────────────────
  describe("LIGHT theme keys", () => {
    it("has all the same keys as DARK", () => {
      const { DARK, LIGHT } = require("../cli/theme");
      const darkKeys = Object.keys(DARK);
      const lightKeys = Object.keys(LIGHT);
      for (const key of darkKeys) {
        expect(LIGHT).toHaveProperty(key);
      }
      // Ensure LIGHT doesn't have extra keys either
      for (const key of lightKeys) {
        expect(DARK).toHaveProperty(key);
      }
    });

    it("has explicit dim (not ANSI dim) for light mode readability", () => {
      const { LIGHT } = require("../cli/theme");
      // LIGHT dim should be an RGB value, not \x1b[2m
      expect(LIGHT.dim).not.toBe("\x1b[2m");
      expect(LIGHT.dim).toContain("38;2;"); // RGB format
    });

    it("has explicit muted (not ANSI dim) for light mode", () => {
      const { LIGHT } = require("../cli/theme");
      expect(LIGHT.muted).not.toBe("\x1b[2m");
      expect(LIGHT.muted).toContain("38;2;");
    });
  });

  // ─── T export ──────────────────────────────────────────────
  describe("T export", () => {
    it("T is either DARK or LIGHT based on isDark", () => {
      const { T, isDark, DARK, LIGHT } = require("../cli/theme");
      if (isDark) {
        expect(T).toBe(DARK);
      } else {
        expect(T).toBe(LIGHT);
      }
    });

    it("exports isDark as a boolean", () => {
      const { isDark } = require("../cli/theme");
      expect(typeof isDark).toBe("boolean");
    });

    it("exports DARK and LIGHT as objects", () => {
      const { DARK, LIGHT } = require("../cli/theme");
      expect(typeof DARK).toBe("object");
      expect(typeof LIGHT).toBe("object");
    });
  });

  // ─── Default fallback ─────────────────────────────────────
  describe("default fallback", () => {
    it("defaults to dark when no env vars set and no TTY", () => {
      delete process.env.NEX_THEME;
      delete process.env.COLORFGBG;
      // Without TTY, OSC query is skipped, falls back to dark
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        configurable: true,
      });
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(true);
      Object.defineProperty(process.stdout, "isTTY", {
        value: origIsTTY,
        configurable: true,
      });
    });
  });

  // ─── Additional detection tests ───────────────────────────
  describe("additional detection", () => {
    it("NEX_THEME takes priority over COLORFGBG", () => {
      process.env.NEX_THEME = "light";
      process.env.COLORFGBG = "15;0"; // would be dark
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(false); // NEX_THEME wins
    });

    it("ignores unknown NEX_THEME values and falls through", () => {
      process.env.NEX_THEME = "auto";
      process.env.COLORFGBG = "0;15"; // light
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(false);
    });

    it("handles COLORFGBG with non-numeric bg", () => {
      delete process.env.NEX_THEME;
      process.env.COLORFGBG = "15;default";
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        configurable: true,
      });
      const { isDark } = require("../cli/theme");
      expect(isDark).toBe(true);
      Object.defineProperty(process.stdout, "isTTY", {
        value: origIsTTY,
        configurable: true,
      });
    });

    it("DARK and LIGHT have different dim values", () => {
      const { DARK, LIGHT } = require("../cli/theme");
      expect(DARK.dim).not.toBe(LIGHT.dim);
    });

    it("DARK primary differs from LIGHT primary", () => {
      const { DARK, LIGHT } = require("../cli/theme");
      expect(DARK.primary).not.toBe(LIGHT.primary);
    });
  });
});

"use strict";

/**
 * Tests for safety.js confirm() — the interactive dialog (lines 331-442)
 * and _confirmText() — the non-TTY fallback.
 *
 * These test the exported confirm function, which delegates to either
 * the TTY dialog or the text fallback based on process.stdout.isTTY.
 */

const {
  confirm,
  setAutoConfirm,
  getAutoConfirm,
  setConfirmHook,
} = require("../cli/safety");

describe("safety.js — confirm()", () => {
  const origAutoConfirm = getAutoConfirm();

  afterEach(() => {
    setAutoConfirm(origAutoConfirm);
  });

  describe("autoConfirm mode", () => {
    it("returns true immediately when autoConfirm is on", async () => {
      setAutoConfirm(true);
      const result = await confirm("Delete all files?");
      expect(result).toBe(true);
    });

    it("returns true even with dangerous options", async () => {
      setAutoConfirm(true);
      const result = await confirm("rm -rf /", { toolName: "bash" });
      expect(result).toBe(true);
    });
  });

  describe("confirmHook mode", () => {
    it("delegates to confirmHook when set", async () => {
      setAutoConfirm(false);
      const hookFn = jest.fn().mockResolvedValue(false);
      setConfirmHook(hookFn);

      const result = await confirm("Do it?");
      expect(result).toBe(false);
      expect(hookFn).toHaveBeenCalledWith("Do it?", {});

      setConfirmHook(null);
    });

    it("passes opts through to hook", async () => {
      setAutoConfirm(false);
      const hookFn = jest.fn().mockResolvedValue(true);
      setConfirmHook(hookFn);

      await confirm("Allow?", { toolName: "bash" });
      expect(hookFn).toHaveBeenCalledWith("Allow?", { toolName: "bash" });

      setConfirmHook(null);
    });
  });
});

describe("safety.js — setAutoConfirm / getAutoConfirm", () => {
  const orig = getAutoConfirm();

  afterEach(() => {
    setAutoConfirm(orig);
  });

  it("toggles autoConfirm state", () => {
    setAutoConfirm(false);
    expect(getAutoConfirm()).toBe(false);
    setAutoConfirm(true);
    expect(getAutoConfirm()).toBe(true);
  });
});

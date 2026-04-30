/**
 * tests/setup.test.js — Setup wizard
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock readline before requiring setup.js
jest.mock("readline", () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn(),
    close: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  })),
}));

const { runSetupWizard } = require("../cli/setup");

let tmpDir;
let origCwd;
const savedEnv = {};

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-setup-"));
  origCwd = process.cwd();
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Save and clear relevant env vars
  for (const key of [
    "ANTHROPIC_API_KEY",
    "OLLAMA_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "DEFAULT_PROVIDER",
    "DEFAULT_MODEL",
  ]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
  // Clean .env from tmpDir if it exists
  const envPath = path.join(tmpDir, ".env");
  if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
});

afterEach(() => {
  // Restore env vars
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  process.cwd.mockRestore();
});

describe("runSetupWizard", () => {
  test("early return when .env exists", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "FOO=bar\n");
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    await runSetupWizard();
    // Should return without printing wizard output
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Welcome to nex-code"),
    );
    consoleSpy.mockRestore();
  });

  test("early return when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-123";
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    await runSetupWizard();
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Welcome to nex-code"),
    );
    consoleSpy.mockRestore();
  });

  test("early return when OLLAMA_API_KEY is set", async () => {
    process.env.OLLAMA_API_KEY = "ollama-test-key";
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    await runSetupWizard();
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Welcome to nex-code"),
    );
    consoleSpy.mockRestore();
  });

  test("early return when DEFAULT_PROVIDER is set", async () => {
    process.env.DEFAULT_PROVIDER = "ollama";
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    await runSetupWizard();
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Welcome to nex-code"),
    );
    consoleSpy.mockRestore();
  });

  test("cancel choice (5) writes no .env", async () => {
    const readline = require("readline");
    readline.createInterface.mockReturnValue({
      question: jest.fn((prompt, cb) => cb("5")),
      close: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    await runSetupWizard();
    consoleSpy.mockRestore();

    const envPath = path.join(tmpDir, ".env");
    expect(fs.existsSync(envPath)).toBe(false);
  });

  test("force flag bypasses early return with .env present", async () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "FOO=bar\n");

    // Mock readline to answer '5' (cancel) so wizard doesn't hang
    const readline = require("readline");
    readline.createInterface.mockReturnValue({
      question: jest.fn((prompt, cb) => cb("5")),
      close: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    await runSetupWizard({ force: true });

    // With force, the wizard should have printed output (not early-returned)
    const allCalls = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(allCalls).toContain("Provider");
    consoleSpy.mockRestore();
  });
});

/**
 * tests/diagnostics.test.js — Unit tests for cli/diagnostics.js
 * Tests secret detection, issue patterns, extension filtering, and file-level diagnostics.
 */

const { runDiagnostics } = require("../cli/diagnostics");

describe("runDiagnostics", () => {
  // --- Secret detection ---

  test("detects OpenAI API key", () => {
    const result = runDiagnostics(
      "config.js",
      'const key = "sk-abcdefghijklmnopqrstuvwx";',
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("OpenAI API Key"),
        }),
      ]),
    );
  });

  test("detects Anthropic API key", () => {
    const fakeKey = "sk-ant-api03-" + "a".repeat(95);
    const result = runDiagnostics("env.txt", `ANTHROPIC_KEY=${fakeKey}`);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("Anthropic API Key"),
        }),
      ]),
    );
  });

  test("detects GitHub token", () => {
    const token = "ghp_" + "A".repeat(36);
    const result = runDiagnostics(".env", `GITHUB_TOKEN=${token}`);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("GitHub Token"),
        }),
      ]),
    );
  });

  test("detects AWS access key", () => {
    const result = runDiagnostics(
      "creds.yml",
      "aws_access_key_id: AKIAIOSFODNN7EXAMPLE",
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("AWS Access Key"),
        }),
      ]),
    );
  });

  test("detects private key header", () => {
    const result = runDiagnostics("key.pem", "-----BEGIN RSA PRIVATE KEY-----");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("Private Key"),
        }),
      ]),
    );
  });

  test("detects database URL", () => {
    const result = runDiagnostics(
      "config.js",
      'const db = "postgres://user:pass@localhost:5432/mydb";',
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("Database URL"),
        }),
      ]),
    );
  });

  test("detects hardcoded secret", () => {
    const result = runDiagnostics(
      "app.js",
      "password = 'supersecretpassword123';",
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("Hardcoded Secret"),
        }),
      ]),
    );
  });

  // --- Issue patterns ---

  test("detects TODO with warn severity", () => {
    const result = runDiagnostics("main.js", "// TODO: fix this later");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warn", message: "Found TODO" }),
      ]),
    );
  });

  test("detects FIXME with warn severity", () => {
    const result = runDiagnostics("main.js", "// FIXME: broken");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warn", message: "Found FIXME" }),
      ]),
    );
  });

  test("detects debugger statement with error severity in .js", () => {
    const result = runDiagnostics("app.js", "debugger;");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          message: "Found Debugger",
        }),
      ]),
    );
  });

  test("detects eval() with warn severity in .ts", () => {
    const result = runDiagnostics("util.ts", 'eval("code")');
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: "warn", message: "Found eval()" }),
      ]),
    );
  });

  test("detects console.log() with info severity", () => {
    const result = runDiagnostics("index.js", 'console.log("debug");');
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "info",
          message: "Found Console Log",
        }),
      ]),
    );
  });

  test("detects ANSI codes with custom message", () => {
    const result = runDiagnostics("format.js", 'const red = "\\x1b[31m";');
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "warn",
          message: expect.stringContaining("Avoid hardcoded ANSI"),
        }),
      ]),
    );
  });

  // --- Extension filtering ---

  test("debugger does NOT match in .py files", () => {
    const result = runDiagnostics("script.py", "debugger");
    const debuggerHits = result.filter((d) => d.message.includes("Debugger"));
    expect(debuggerHits).toHaveLength(0);
  });

  test("eval() does NOT match in .md files", () => {
    const result = runDiagnostics("notes.md", 'eval("test")');
    const evalHits = result.filter((d) => d.message.includes("eval()"));
    expect(evalHits).toHaveLength(0);
  });

  test("debugger matches in .tsx files", () => {
    const result = runDiagnostics("component.tsx", "debugger;");
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Found Debugger" }),
      ]),
    );
  });

  // --- Large file warning ---

  test("large file (>500 lines) triggers info diagnostic at line 0", () => {
    const lines = Array(501).fill("const x = 1;");
    const result = runDiagnostics("big.js", lines.join("\n"));
    const largeFileHit = result.find(
      (d) => d.line === 0 && d.message.includes("Large file"),
    );
    expect(largeFileHit).toBeDefined();
    expect(largeFileHit.severity).toBe("info");
    expect(largeFileHit.message).toContain("501 lines");
  });

  test("file with exactly 500 lines does NOT trigger large file warning", () => {
    const lines = Array(500).fill("const x = 1;");
    const result = runDiagnostics("ok.js", lines.join("\n"));
    const largeFileHit = result.find(
      (d) => d.line === 0 && d.message.includes("Large file"),
    );
    expect(largeFileHit).toBeUndefined();
  });

  // --- Clean file ---

  test("clean file returns no diagnostics", () => {
    const result = runDiagnostics(
      "clean.js",
      "function add(a, b) { return a + b; }",
    );
    expect(result).toHaveLength(0);
  });

  // --- Multiple findings ---

  test("file with secrets and TODOs returns all diagnostics", () => {
    const content = [
      'const key = "sk-abcdefghijklmnopqrstuvwx";',
      "// TODO: remove hardcoded key",
    ].join("\n");
    const result = runDiagnostics("app.js", content);
    const secrets = result.filter((d) => d.message.includes("OpenAI"));
    const todos = result.filter((d) => d.message.includes("TODO"));
    expect(secrets.length).toBeGreaterThanOrEqual(1);
    expect(todos.length).toBeGreaterThanOrEqual(1);
  });

  // --- Line numbers ---

  test("reports correct line numbers (1-based)", () => {
    const content = "line1\nline2\n// TODO here\nline4";
    const result = runDiagnostics("file.js", content);
    const todo = result.find((d) => d.message.includes("TODO"));
    expect(todo).toBeDefined();
    expect(todo.line).toBe(3);
  });
});

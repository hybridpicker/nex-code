/**
 * tests/auto-fix.test.js — Auto-Fix Logic Tests
 * Tests for autoFixPath, autoFixEdit, enrichBashError, and integrated auto-fix behavior.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

jest.mock("../cli/tool-tiers", () => ({
  ...jest.requireActual("../cli/tool-tiers"),
  getEditMode: jest.fn().mockReturnValue("fuzzy"),
}));

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-jc-autofix-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const {
  autoFixPath,
  autoFixEdit,
  enrichBashError,
  executeTool,
} = require("../cli/tools");

// ─── autoFixPath ─────────────────────────────────────────────
describe("autoFixPath()", () => {
  let srcDir;

  beforeAll(() => {
    srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(path.join(srcDir, "components"), { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "components", "Button.tsx"),
      "export const Button = () => {};",
    );
    fs.writeFileSync(path.join(srcDir, "index.js"), 'console.log("hello");');
    fs.writeFileSync(path.join(srcDir, "utils.ts"), "export const foo = 1;");
  });

  it("returns null for empty path", async () => {
    const result = await autoFixPath("");
    expect(result.fixedPath).toBeNull();
  });

  it("returns null for unfixable path", async () => {
    const result = await autoFixPath(
      path.join(tmpDir, "totally", "nonexistent", "xyz123.abc"),
    );
    expect(result.fixedPath).toBeNull();
  });

  it("fixes double slashes in path", async () => {
    // Use absolute path with double slash
    const result = await autoFixPath(srcDir + "//index.js");
    expect(result.fixedPath).not.toBeNull();
    expect(result.message).toContain("auto-fixed");
  });

  it("adds missing extension (.js)", async () => {
    const result = await autoFixPath(path.join(srcDir, "index"));
    expect(result.fixedPath).not.toBeNull();
    expect(result.fixedPath).toContain("index.js");
    expect(result.message).toContain("auto-fixed");
  });

  it("tries alternative extensions (.ts when .js not found)", async () => {
    const result = await autoFixPath(path.join(srcDir, "utils"));
    expect(result.fixedPath).not.toBeNull();
    expect(result.fixedPath).toContain("utils.ts");
  });

  it("tries swapping extension (.js → .ts)", async () => {
    const result = await autoFixPath(path.join(srcDir, "utils.js"));
    expect(result.fixedPath).not.toBeNull();
    expect(result.fixedPath).toContain("utils.ts");
    expect(result.message).toContain("auto-fixed");
  });
});

// ─── autoFixEdit ─────────────────────────────────────────────
describe("autoFixEdit()", () => {
  it("returns null when content is empty", () => {
    const result = autoFixEdit("", "hello", "world");
    expect(result).toBeNull();
  });

  it("returns null when old_text is empty", () => {
    const result = autoFixEdit("hello world", "", "new");
    expect(result).toBeNull();
  });

  it("auto-fixes single character typo", () => {
    const content = 'const hello = "world";';
    const result = autoFixEdit(
      content,
      'const helo = "world";',
      'const hello = "earth";',
    );
    expect(result).not.toBeNull();
    expect(result.autoFixed).toBe(true);
    expect(result.distance).toBe(1);
    expect(result.content).toContain('const hello = "earth"');
  });

  it("auto-fixes minor whitespace + typo within threshold", () => {
    const content = "function doSomething() {\n  return true;\n}";
    const result = autoFixEdit(
      content,
      "function doSomethng() {",
      "function doNothing() {",
    );
    expect(result).not.toBeNull();
    expect(result.autoFixed).toBe(true);
    expect(result.content).toContain("function doNothing() {");
  });

  it("returns null for large mismatch (>5% distance)", () => {
    const content = 'const hello = "world";';
    const result = autoFixEdit(
      content,
      'let goodbye = "moon";',
      "something else",
    );
    expect(result).toBeNull();
  });

  it("respects max(3, 5%) threshold for short strings", () => {
    const content = "hello";
    const result = autoFixEdit(content, "helo", "world");
    expect(result).not.toBeNull();
    expect(result.distance).toBeLessThanOrEqual(3);
  });

  it("preserves multi-line context in auto-fix", () => {
    const content = 'line 1\nconst foo = "bar";\nline 3';
    const result = autoFixEdit(
      content,
      'const fo = "bar";',
      'const foo = "baz";',
    );
    expect(result).not.toBeNull();
    expect(result.content).toContain('const foo = "baz"');
    expect(result.content).toContain("line 1");
    expect(result.content).toContain("line 3");
  });
});

// ─── enrichBashError ─────────────────────────────────────────
describe("enrichBashError()", () => {
  it("returns original error when no pattern matches", () => {
    const result = enrichBashError("Some random error output", "echo test");
    expect(result).toBe("Some random error output");
  });

  it('adds hint for "command not found"', () => {
    const result = enrichBashError(
      "bash: foo: command not found",
      "foo --version",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("not installed");
  });

  it("adds hint for Node.js not found", () => {
    const result = enrichBashError("bash: node: command not found", "node -v");
    expect(result).toContain("HINT");
    expect(result).toContain("Node.js");
  });

  it("adds hint for Python not found", () => {
    const result = enrichBashError(
      "bash: python3: command not found",
      "python3 --version",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("Python");
  });

  it("adds hint for MODULE_NOT_FOUND", () => {
    const result = enrichBashError(
      "Cannot find module 'express'",
      "node app.js",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("npm install express");
  });

  it("adds hint for relative module not found", () => {
    const result = enrichBashError(
      "Cannot find module './missing'",
      "node app.js",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("import path");
  });

  it("adds hint for permission denied", () => {
    const result = enrichBashError(
      "Error: EACCES: permission denied, open /etc/test",
      "cat /etc/test",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("Permission denied");
  });

  it("adds hint for port in use", () => {
    const result = enrichBashError(
      "Error: listen EADDRINUSE: address already in use :::3000",
      "node server.js",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("already in use");
  });

  it("adds hint for SyntaxError", () => {
    const result = enrichBashError(
      "SyntaxError: Unexpected token ;",
      "node app.js",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("Syntax error");
  });

  it("adds hint for TypeScript errors", () => {
    const result = enrichBashError(
      "src/app.ts(42,5): error TS2345: Argument of type 'string' is not assignable",
      "npx tsc",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("TypeScript");
  });

  it("adds hint for Jest test failures", () => {
    const result = enrichBashError(
      "Test Suites: 2 failed, 10 passed, 12 total\nTests: 5 failed",
      "npm test",
    );
    expect(result).toContain("HINT");
    expect(result).toContain("Test failures");
  });

  it("adds hint for not a git repository", () => {
    const result = enrichBashError("fatal: not a git repository", "git status");
    expect(result).toContain("HINT");
    expect(result).toContain("git repository");
  });
});

// ─── Integrated auto-fix in tools ────────────────────────────
describe("Integrated auto-fix in tools", () => {
  let toolDir;

  beforeEach(() => {
    toolDir = fs.mkdtempSync(path.join(tmpDir, "tools-"));
  });

  describe("read_file auto-fix path", () => {
    it("auto-finds file when path has wrong extension", async () => {
      fs.writeFileSync(path.join(toolDir, "config.ts"), "export default {}");
      const result = await executeTool(
        "read_file",
        { path: path.join(toolDir, "config.js") },
        { autoConfirm: true, silent: true },
      );
      expect(result).toContain("export default {}");
    });
  });

  describe("edit_file auto-fix", () => {
    it("auto-applies edit with 1-char typo in old_text", async () => {
      const fp = path.join(toolDir, "auto-edit.js");
      fs.writeFileSync(fp, "const value = 42;\nconst other = 100;\n");
      const result = await executeTool(
        "edit_file",
        {
          path: fp,
          old_text: "const vlue = 42;",
          new_text: "const value = 99;",
        },
        { autoConfirm: true, silent: true },
      );
      expect(result).toContain("auto-fixed");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("const value = 99;");
    });

    it("still fails on large mismatch", async () => {
      const fp = path.join(toolDir, "no-autofix.js");
      fs.writeFileSync(fp, "const value = 42;\n");
      const result = await executeTool(
        "edit_file",
        {
          path: fp,
          old_text: 'let completely_different = "text";',
          new_text: "replaced",
        },
        { autoConfirm: true, silent: true },
      );
      expect(result).toContain("ERROR");
    });

    it("auto-fixes path with wrong extension", async () => {
      const fp = path.join(toolDir, "component.tsx");
      fs.writeFileSync(fp, "const App = () => <div />;");
      const result = await executeTool(
        "edit_file",
        {
          path: path.join(toolDir, "component.js"),
          old_text: "const App = () => <div />;",
          new_text: "const App = () => <span />;",
        },
        { autoConfirm: true, silent: true },
      );
      expect(result).toContain("Edited");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("<span />");
    });
  });

  describe("patch_file auto-fix", () => {
    it("auto-applies patch with close match", async () => {
      const fp = path.join(toolDir, "auto-patch.js");
      fs.writeFileSync(fp, "const a = 1;\nconst b = 2;\nconst c = 3;\n");
      const result = await executeTool(
        "patch_file",
        {
          path: fp,
          patches: [
            { old_text: "const a = 1;", new_text: "const a = 10;" },
            { old_text: "const c = 3", new_text: "const c = 30;" },
          ],
        },
        { autoConfirm: true, silent: true },
      );
      expect(result).toContain("Patched");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("const a = 10;");
      expect(content).toContain("const c = 30;");
    });
  });
});

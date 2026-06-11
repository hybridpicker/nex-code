/**
 * tests/post-write-syntax.test.js — syntax feedback appended to
 * write_file/edit_file/patch_file results.
 */

const fs = require("fs");
const path = require("path");

jest.mock("../cli/safety", () => ({
  ...jest.requireActual("../cli/safety"),
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));

jest.mock("../cli/file-history", () => ({
  recordChange: jest.fn(),
}));

jest.mock("../cli/tool-tiers", () => ({
  ...jest.requireActual("../cli/tool-tiers"),
  getEditMode: jest.fn().mockReturnValue("fuzzy"),
}));

jest.mock("../cli/diff", () => ({
  showDiff: jest.fn(),
  showNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

const { executeTool } = require("../cli/tools");

const OPTS = { autoConfirm: true, silent: true };

describe("post-write syntax check", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-jc-syntax-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("write_file flags a JS syntax error in the result", async () => {
    const result = await executeTool(
      "write_file",
      {
        path: path.join(tmpDir, "broken.js"),
        content: "function broken( {\n  return 1;\n}\n",
      },
      OPTS,
    );
    expect(result).toContain("Written:");
    expect(result).toContain("WARNING: syntax error in broken.js");
  });

  test("write_file stays silent for valid JS", async () => {
    const result = await executeTool(
      "write_file",
      {
        path: path.join(tmpDir, "ok.js"),
        content: "function ok() {\n  return 1;\n}\nmodule.exports = { ok };\n",
      },
      OPTS,
    );
    expect(result).toContain("Written:");
    expect(result).not.toContain("WARNING");
  });

  test("write_file flags invalid JSON", async () => {
    const result = await executeTool(
      "write_file",
      {
        path: path.join(tmpDir, "broken.json"),
        content: '{ "a": 1, }',
      },
      OPTS,
    );
    expect(result).toContain("not valid JSON");
  });

  test("edit_file flags a syntax error it introduced", async () => {
    const fp = path.join(tmpDir, "edit.js");
    fs.writeFileSync(fp, "function f() {\n  return 1;\n}\n");
    const result = await executeTool(
      "edit_file",
      { path: fp, old_text: "return 1;", new_text: "return 1;;; ((" },
      OPTS,
    );
    expect(result).toContain("Edited:");
    expect(result).toContain("WARNING: syntax error in edit.js");
  });

  test("patch_file flags a syntax error it introduced", async () => {
    const fp = path.join(tmpDir, "patch.js");
    fs.writeFileSync(fp, "const a = 1;\nconst b = 2;\n");
    const result = await executeTool(
      "patch_file",
      {
        path: fp,
        patches: [{ old_text: "const b = 2;", new_text: "const b = ((;" }],
      },
      OPTS,
    );
    expect(result).toContain("Patched:");
    expect(result).toContain("WARNING: syntax error in patch.js");
  });

  test("JSX-looking files are skipped (node cannot parse JSX)", async () => {
    const result = await executeTool(
      "write_file",
      {
        path: path.join(tmpDir, "component.js"),
        content:
          'import React from "react";\nexport function App() {\n  return <Main prop={1} />;\n}\n',
      },
      OPTS,
    );
    expect(result).toContain("Written:");
    expect(result).not.toContain("WARNING");
  });

  test("non-JS files are not syntax-checked", async () => {
    const result = await executeTool(
      "write_file",
      {
        path: path.join(tmpDir, "notes.md"),
        content: "# Notes\nfunction broken( {\n",
      },
      OPTS,
    );
    expect(result).toContain("Written:");
    expect(result).not.toContain("WARNING");
  });
});

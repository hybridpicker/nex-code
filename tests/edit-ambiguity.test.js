/**
 * tests/edit-ambiguity.test.js — edit_file/patch_file uniqueness guard and
 * bash run_in_background / bash_output / kill_shell tool integration.
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

const { executeTool, TOOL_DEFINITIONS } = require("../cli/tools");
const { clearShells } = require("../cli/shell-jobs");

const OPTS = { autoConfirm: true, silent: true };

async function waitFor(cond, timeoutMs = 5000, stepMs = 50) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return cond();
}

describe("edit_file uniqueness guard", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-jc-ambig-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("fails when old_text matches multiple locations", async () => {
    const fp = path.join(tmpDir, "multi.js");
    fs.writeFileSync(fp, "let x = 1;\nfoo();\nlet x = 1;\n");

    const result = await executeTool(
      "edit_file",
      { path: fp, old_text: "let x = 1;", new_text: "let y = 2;" },
      OPTS,
    );

    expect(result).toMatch(/^ERROR: old_text matches 2 locations/);
    expect(result).toContain("lines 1, 3");
    expect(result).toContain("replace_all");
    // File must be unchanged
    expect(fs.readFileSync(fp, "utf-8")).toBe("let x = 1;\nfoo();\nlet x = 1;\n");
  });

  test("replace_all=true replaces every occurrence and reports the count", async () => {
    const fp = path.join(tmpDir, "all.js");
    fs.writeFileSync(fp, "oldName();\nbar();\noldName();\noldName();\n");

    const result = await executeTool(
      "edit_file",
      {
        path: fp,
        old_text: "oldName();",
        new_text: "newName();",
        replace_all: true,
      },
      OPTS,
    );

    expect(result).toContain("replaced 3 occurrences");
    expect(fs.readFileSync(fp, "utf-8")).toBe("newName();\nbar();\nnewName();\nnewName();\n");
  });

  test("unique old_text edits normally without occurrence note", async () => {
    const fp = path.join(tmpDir, "unique.js");
    fs.writeFileSync(fp, "const a = 1;\nconst b = 2;\n");

    const result = await executeTool(
      "edit_file",
      { path: fp, old_text: "const b = 2;", new_text: "const b = 3;" },
      OPTS,
    );

    expect(result).toMatch(/^Edited:/);
    expect(result).not.toContain("occurrences");
    expect(fs.readFileSync(fp, "utf-8")).toBe("const a = 1;\nconst b = 3;\n");
  });

  test("schema exposes replace_all on edit_file and patch items", () => {
    const edit = TOOL_DEFINITIONS.find((t) => t.function.name === "edit_file");
    expect(edit.function.parameters.properties.replace_all).toBeDefined();
    const patch = TOOL_DEFINITIONS.find((t) => t.function.name === "patch_file");
    expect(
      patch.function.parameters.properties.patches.items.properties.replace_all,
    ).toBeDefined();
  });
});

describe("patch_file uniqueness guard", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-jc-ambig-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("ambiguous patch fails atomically — no patches applied", async () => {
    const fp = path.join(tmpDir, "patch.js");
    const original = "dup();\nunique();\ndup();\n";
    fs.writeFileSync(fp, original);

    const result = await executeTool(
      "patch_file",
      {
        path: fp,
        patches: [
          { old_text: "unique();", new_text: "changed();" },
          { old_text: "dup();", new_text: "renamed();" },
        ],
      },
      OPTS,
    );

    expect(result).toMatch(/ERROR: Patch 2 old_text matches 2 locations/);
    expect(fs.readFileSync(fp, "utf-8")).toBe(original);
  });

  test("replace_all on a patch replaces every occurrence", async () => {
    const fp = path.join(tmpDir, "patch-all.js");
    fs.writeFileSync(fp, "dup();\nunique();\ndup();\n");

    const result = await executeTool(
      "patch_file",
      {
        path: fp,
        patches: [
          { old_text: "unique();", new_text: "changed();" },
          { old_text: "dup();", new_text: "renamed();", replace_all: true },
        ],
      },
      OPTS,
    );

    expect(result).toMatch(/^Patched:/);
    expect(fs.readFileSync(fp, "utf-8")).toBe("renamed();\nchanged();\nrenamed();\n");
  });
});

describe("bash run_in_background integration", () => {
  afterEach(() => {
    clearShells();
  });

  test("returns a shell id immediately and bash_output reads the result", async () => {
    const started = await executeTool(
      "bash",
      { command: "echo bg-tool-test", run_in_background: true },
      OPTS,
    );
    expect(started).toMatch(/^Started background shell shell-\d+/);

    const shellId = started.match(/shell-\d+/)[0];
    await waitFor(async () => {
      const out = await executeTool("bash_output", { shell_id: shellId }, OPTS);
      return /completed|bg-tool-test/.test(out);
    });
    // All output may already be consumed by the polling above; verify status line
    const final = await executeTool("bash_output", { shell_id: shellId }, OPTS);
    expect(final).toContain(`Shell ${shellId}`);
  });

  test("kill_shell terminates a background command via the tool", async () => {
    const started = await executeTool(
      "bash",
      { command: "sleep 30", run_in_background: true },
      OPTS,
    );
    const shellId = started.match(/shell-\d+/)[0];

    const killMsg = await executeTool("kill_shell", { shell_id: shellId }, OPTS);
    expect(killMsg).toContain("SIGTERM");

    await waitFor(async () => {
      const out = await executeTool("bash_output", { shell_id: shellId }, OPTS);
      return out.includes("killed");
    });
  });

  test("interactive commands cannot run in background", async () => {
    const result = await executeTool(
      "bash",
      { command: "vim file.txt", run_in_background: true },
      OPTS,
    );
    expect(result).toMatch(/^ERROR: Interactive commands cannot run in the background/);
  });

  test("forbidden commands stay blocked in background mode", async () => {
    const result = await executeTool(
      "bash",
      { command: "cat .env", run_in_background: true },
      OPTS,
    );
    expect(result).toMatch(/^BLOCKED/);
  });

  test("bash_output for unknown shell returns ERROR", async () => {
    const out = await executeTool("bash_output", { shell_id: "shell-404" }, OPTS);
    expect(out).toMatch(/^ERROR: No background shell/);
  });
});

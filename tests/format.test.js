/**
 * tests/format.test.js — Tests for cli/format.js
 * Formatting functions: formatToolCall, formatResult, getToolSpinnerText,
 * formatToolSummary, formatSectionHeader
 */

"use strict";

jest.mock("../cli/theme", () => {
  const RESET = "\x1b[0m";
  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";
  const theme = {
    reset: RESET,
    bold: BOLD,
    dim: DIM,
    muted: DIM,
    subtle: DIM,
    error: "\x1b[31m",
    success: "\x1b[32m",
    warning: "\x1b[33m",
    tool_read: "\x1b[34m",
    tool_write: "\x1b[33m",
    tool_exec: "\x1b[35m",
    tool_search: "\x1b[36m",
    tool_git: "\x1b[32m",
    tool_web: "\x1b[34m",
    tool_sysadmin: "\x1b[33m",
    tool_default: "\x1b[32m",
    diff_add: "\x1b[32m",
    diff_rem: "\x1b[31m",
  };
  return { T: theme, isDark: true };
});

const {
  formatToolCall,
  formatResult,
  getToolSpinnerText,
  formatToolSummary,
  formatSectionHeader,
  formatMilestone,
} = require("../cli/format");

// ─── formatToolCall ──────────────────────────────────────────
describe("formatToolCall()", () => {
  it("formats read_file with path", () => {
    const out = formatToolCall("read_file", { path: "src/utils/helper.js" });
    expect(out).toContain("Read");
    expect(out).toContain("utils/helper.js");
  });

  it("formats write_file with path", () => {
    const out = formatToolCall("write_file", { path: "/tmp/output.txt" });
    expect(out).toContain("Write");
    expect(out).toContain("output.txt");
  });

  it("formats edit_file with path", () => {
    const out = formatToolCall("edit_file", {
      path: "deep/nested/file.js",
      old_text: "const oldValue = true;",
      new_text: "const newValue = false;",
    });
    expect(out).toContain("Edit");
    expect(out).toContain("nested/file.js");
    expect(out).toContain("before");
    expect(out).toContain("after");
  });

  it("formats bash with command", () => {
    const out = formatToolCall("bash", { command: "npm test" });
    expect(out).toContain("Bash");
    expect(out).toContain("npm test");
    expect(out).toContain("$");
  });

  it("truncates long bash commands", () => {
    const longCmd = "x".repeat(100);
    const out = formatToolCall("bash", { command: longCmd });
    expect(out.length).toBeLessThan(300);
  });

  it("formats grep with pattern and path", () => {
    const out = formatToolCall("grep", { pattern: "TODO", path: "src/" });
    expect(out).toContain("Grep");
    expect(out).toContain('"TODO"');
    expect(out).toContain("in src/");
  });

  it("formats grep with pattern only", () => {
    const out = formatToolCall("grep", { pattern: "fixme" });
    expect(out).toContain('"fixme"');
  });

  it("formats glob with pattern", () => {
    const out = formatToolCall("glob", { pattern: "**/*.ts" });
    expect(out).toContain("Glob");
    expect(out).toContain("**/*.ts");
  });

  it("formats web_fetch with URL", () => {
    const out = formatToolCall("web_fetch", { url: "https://example.com/api" });
    expect(out).toContain("WebFetch");
    expect(out).toContain("example.com");
  });

  it("formats web_search with query", () => {
    const out = formatToolCall("web_search", { query: "node.js streams" });
    expect(out).toContain("WebSearch");
    expect(out).toContain("node.js streams");
  });

  it("formats list_directory with path", () => {
    const out = formatToolCall("list_directory", { path: "src/" });
    expect(out).toContain("List");
  });

  it("formats unknown tool with JSON args", () => {
    const out = formatToolCall("custom_tool", { foo: "bar" });
    expect(out).toContain("custom tool");
    expect(out).toContain("foo");
  });

  it("formats patch_file with path", () => {
    const out = formatToolCall("patch_file", {
      path: "lib/main.js",
      patches: [{ old_text: "oldThing()", new_text: "newThing()" }],
    });
    expect(out).toContain("Edit");
    expect(out).toContain("patch 1");
  });

  it("handles empty args for grep", () => {
    const out = formatToolCall("grep", {});
    expect(out).toContain("Grep");
  });
});

// ─── formatResult ────────────────────────────────────────────
describe("formatResult()", () => {
  it("formats single line result", () => {
    const out = formatResult("Success");
    expect(out).toContain("Success");
    expect(out).toContain("⎿");
  });

  it("formats multiple lines", () => {
    const out = formatResult("line1\nline2\nline3");
    expect(out).toContain("line1");
    expect(out).toContain("line2");
    expect(out).toContain("line3");
  });

  it("truncates after maxLines", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join(
      "\n",
    );
    const out = formatResult(lines, 5);
    expect(out).toContain("line 1");
    expect(out).toContain("line 5");
    expect(out).toContain("+15 lines");
  });

  it("uses default maxLines of 8", () => {
    const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join(
      "\n",
    );
    const out = formatResult(lines);
    expect(out).toContain("+7 lines");
  });

  it("does not show +N lines when all fit", () => {
    const out = formatResult("a\nb\nc");
    expect(out).not.toContain("+");
  });
});

// ─── getToolSpinnerText ──────────────────────────────────────
describe("getToolSpinnerText()", () => {
  it("returns null for bash (interactive)", () => {
    expect(getToolSpinnerText("bash", {})).toBeNull();
  });

  it("returns null for ask_user", () => {
    expect(getToolSpinnerText("ask_user", {})).toBeNull();
  });

  it("returns null for write_file", () => {
    expect(getToolSpinnerText("write_file", {})).toBeNull();
  });

  it("returns null for edit_file", () => {
    expect(getToolSpinnerText("edit_file", {})).toBeNull();
  });

  it("returns null for patch_file", () => {
    expect(getToolSpinnerText("patch_file", {})).toBeNull();
  });

  it("returns null for task_list", () => {
    expect(getToolSpinnerText("task_list", {})).toBeNull();
  });

  it("returns null for spawn_agents", () => {
    expect(getToolSpinnerText("spawn_agents", {})).toBeNull();
  });

  it("returns reading text for read_file", () => {
    expect(getToolSpinnerText("read_file", { path: "src/index.js" })).toBe(
      "Reading src/index.js",
    );
  });

  it("returns listing text for list_directory", () => {
    expect(getToolSpinnerText("list_directory", { path: "src/" })).toBe(
      "Listing src/",
    );
  });

  it("returns listing text with default path", () => {
    expect(getToolSpinnerText("list_directory", {})).toBe("Listing .");
  });

  it("returns search text for search_files", () => {
    expect(getToolSpinnerText("search_files", { pattern: "TODO" })).toBe(
      "Searching TODO",
    );
  });

  it("returns glob text", () => {
    expect(getToolSpinnerText("glob", { pattern: "*.ts" })).toBe("Searching *.ts");
  });

  it("returns grep text", () => {
    expect(getToolSpinnerText("grep", { pattern: "error" })).toBe(
      "Searching error",
    );
  });

  it("returns web_fetch text", () => {
    expect(
      getToolSpinnerText("web_fetch", { url: "https://api.example.com" }),
    ).toContain("Fetching");
  });

  it("returns web_search text", () => {
    expect(
      getToolSpinnerText("web_search", { query: "node streams" }),
    ).toContain("Searching web:");
  });

  it("returns git_status text", () => {
    expect(getToolSpinnerText("git_status", {})).toBe(
      "Analyzing repository status",
    );
  });

  it("returns git_diff text with file", () => {
    expect(getToolSpinnerText("git_diff", { file: "main.js" })).toBe(
      "Diffing main.js",
    );
  });

  it("returns git_diff text without file", () => {
    expect(getToolSpinnerText("git_diff", {})).toBe("Diffing");
  });

  it("returns git_log text", () => {
    expect(getToolSpinnerText("git_log", {})).toBe("Reading git log");
  });

  it("returns gh_run_list text", () => {
    expect(getToolSpinnerText("gh_run_list", {})).toContain("GitHub Actions");
  });

  it("returns gh_run_view text", () => {
    expect(getToolSpinnerText("gh_run_view", { run_id: "123" })).toContain(
      "run 123",
    );
  });

  it("returns gh_workflow_trigger text", () => {
    expect(
      getToolSpinnerText("gh_workflow_trigger", { workflow: "ci.yml" }),
    ).toContain("trigger ci.yml");
  });

  it("returns browser_open text", () => {
    expect(
      getToolSpinnerText("browser_open", { url: "https://test.com" }),
    ).toContain("opening");
  });

  it("returns browser_screenshot text", () => {
    expect(
      getToolSpinnerText("browser_screenshot", { url: "https://test.com" }),
    ).toContain("screenshot");
  });

  it("returns browser_click text", () => {
    expect(getToolSpinnerText("browser_click", { text: "Submit" })).toContain(
      "clicking Submit",
    );
  });

  it("returns browser_fill text", () => {
    expect(
      getToolSpinnerText("browser_fill", { selector: "#email" }),
    ).toContain("filling #email");
  });

  it("returns sysadmin audit text", () => {
    const text = getToolSpinnerText("sysadmin", {
      action: "audit",
      server: "prod",
    });
    expect(text).toContain("audit");
    expect(text).toContain("[prod]");
  });

  it("returns sysadmin disk_usage text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "disk_usage", path: "/home" }),
    ).toContain("disk usage");
  });

  it("returns sysadmin process_list text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "process_list" }),
    ).toContain("top processes");
  });

  it("returns sysadmin network_status text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "network_status" }),
    ).toContain("network");
  });

  it("returns sysadmin ssl_check text", () => {
    expect(
      getToolSpinnerText("sysadmin", {
        action: "ssl_check",
        domain: "example.com",
      }),
    ).toContain("SSL check");
  });

  it("returns sysadmin log_tail text", () => {
    expect(
      getToolSpinnerText("sysadmin", {
        action: "log_tail",
        path: "/var/log/syslog",
      }),
    ).toContain("tail");
  });

  it("returns sysadmin find_large text", () => {
    expect(getToolSpinnerText("sysadmin", { action: "find_large" })).toContain(
      "find large",
    );
  });

  it("returns sysadmin service text", () => {
    expect(
      getToolSpinnerText("sysadmin", {
        action: "service",
        service_action: "restart",
        service_name: "nginx",
      }),
    ).toContain("service");
  });

  it("returns sysadmin kill_process text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "kill_process", pid: 1234 }),
    ).toContain("kill");
  });

  it("returns sysadmin journalctl text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "journalctl", unit: "nginx" }),
    ).toContain("journal");
  });

  it("returns sysadmin package text", () => {
    expect(
      getToolSpinnerText("sysadmin", {
        action: "package",
        package_action: "install",
        packages: ["nginx"],
      }),
    ).toContain("package");
  });

  it("returns sysadmin firewall text", () => {
    expect(
      getToolSpinnerText("sysadmin", {
        action: "firewall",
        firewall_action: "list",
      }),
    ).toContain("firewall");
  });

  it("returns sysadmin user_manage text", () => {
    expect(
      getToolSpinnerText("sysadmin", {
        action: "user_manage",
        user_action: "add",
        user: "bob",
      }),
    ).toContain("user");
  });

  it("returns sysadmin cron text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "cron", cron_action: "list" }),
    ).toContain("cron");
  });

  it("returns sysadmin unknown action text", () => {
    expect(
      getToolSpinnerText("sysadmin", { action: "custom_check" }),
    ).toContain("custom_check");
  });

  it("returns sysadmin text without server suffix for local", () => {
    const text = getToolSpinnerText("sysadmin", {
      action: "audit",
      server: "local",
    });
    expect(text).not.toContain("[local]");
  });

  it("returns default text for unknown tool", () => {
    expect(getToolSpinnerText("some_random_tool", {})).toBe(
      "Running: some_random_tool",
    );
  });
});

// ─── formatToolSummary ───────────────────────────────────────
describe("formatToolSummary()", () => {
  it("formats error with first line and hint", () => {
    const out = formatToolSummary(
      "bash",
      {},
      "ERROR: Permission denied\nHINT: Try running with sudo",
      true,
    );
    expect(out).toContain("Permission denied");
    expect(out).toContain("sudo");
  });

  it("formats error without hint", () => {
    const out = formatToolSummary("bash", {}, "ERROR: File not found", true);
    expect(out).toContain("File not found");
  });

  it("formats read_file summary with line count", () => {
    const result = "1: const x = 1;\n2: const y = 2;\n3: const z = 3;";
    const out = formatToolSummary("read_file", {}, result, false);
    expect(out).toContain("Read 3 line");
    expect(out).toContain("const x = 1");
  });

  it("formats read_file partial read", () => {
    const result = "10: foo\n11: bar\n12: baz";
    const out = formatToolSummary(
      "read_file",
      { line_start: 10, line_end: 12 },
      result,
      false,
    );
    expect(out).toContain("lines 10");
  });

  it("formats write_file summary", () => {
    const out = formatToolSummary(
      "write_file",
      { content: "a\nb\nc" },
      "OK",
      false,
    );
    expect(out).toContain("Wrote 3 line");
  });

  it("formats edit_file summary with diff counts", () => {
    const out = formatToolSummary(
      "edit_file",
      {
        path: "src/components/panel.js",
        old_text: "old\nold2",
        new_text: "new\nnew2\nnew3",
      },
      "OK",
      false,
    );
    // Should show removed and added counts
    expect(out).toMatch(/[−-]2/); // removed 2
    expect(out).toMatch(/\+3/); // added 3
    expect(out).toContain("components/panel.js");
    expect(out).toContain("before");
    expect(out).toContain("after");
    expect(out).toContain("old2");
    expect(out).toContain("new3");
  });

  it("formats patch_file summary", () => {
    const out = formatToolSummary(
      "patch_file",
      {
        patches: [
          { old_text: "a", new_text: "b\nc" },
          { old_text: "x", new_text: "y" },
        ],
      },
      "OK",
      false,
    );
    expect(out).toContain("2 patches");
    expect(out).toContain("patch 1");
    expect(out).toContain("b");
  });

  it("formats bash with exit 0", () => {
    const out = formatToolSummary(
      "bash",
      { command: "npm test -- --runInBand" },
      "EXIT 0\noutput line 1\noutput line 2",
      false,
    );
    expect(out).toContain("npm test -- --runInBand");
    expect(out).toContain("output line 1");
  });

  it("formats bash with exit non-zero", () => {
    const out = formatToolSummary("bash", {}, "EXIT 1\nerror message", false);
    expect(out).toContain("Exit 1");
  });

  it("formats bash with exit 0 and hint", () => {
    const out = formatToolSummary(
      "bash",
      {},
      "EXIT 0\nHINT: All tests passed",
      false,
    );
    expect(out).toContain("All tests passed");
  });

  it("formats bash without EXIT line", () => {
    const out = formatToolSummary(
      "bash",
      {},
      "some output\nanother line",
      false,
    );
    expect(out).toContain("some output");
  });

  it("formats grep with no matches", () => {
    const out = formatToolSummary("grep", {}, "(no matches)", false);
    expect(out).toContain("No matches");
  });

  it("formats grep with matches", () => {
    const out = formatToolSummary(
      "grep",
      { path: "src" },
      "src/a.js:10:match\nsrc/b.js:20:match",
      false,
    );
    expect(out).toContain("2 matches");
    expect(out).toContain("2 files");
    expect(out).toContain("path:");
    expect(out).toContain("a.js:10");
  });

  it("formats grep with matches in single file", () => {
    const out = formatToolSummary(
      "grep",
      {},
      "src/a.js:10:match\nsrc/a.js:20:match",
      false,
    );
    expect(out).toContain("2 matches");
    expect(out).not.toContain("files");
  });

  it("formats glob with no files", () => {
    const out = formatToolSummary("glob", {}, "(no matches)", false);
    expect(out).toContain("No files found");
  });

  it("formats glob with files", () => {
    const out = formatToolSummary("glob", {}, "src/a.js\nsrc/b.js", false);
    expect(out).toContain("2 files");
    expect(out).toContain("src/a.js");
  });

  it("formats list_directory", () => {
    const out = formatToolSummary(
      "list_directory",
      {},
      "file1\nfile2\nfile3",
      false,
    );
    expect(out).toContain("3 entries");
  });

  it("formats list_directory empty", () => {
    const out = formatToolSummary("list_directory", {}, "(empty)", false);
    expect(out).toContain("0 entr");
  });

  it("formats git_status", () => {
    const out = formatToolSummary(
      "git_status",
      {},
      "Branch: main\n M file.js\n A new.js",
      false,
    );
    expect(out).toContain("main");
    expect(out).toContain("2 change");
  });

  it("formats git_diff with changes", () => {
    const out = formatToolSummary(
      "git_diff",
      {},
      "+added line\n-removed line\n+another add",
      false,
    );
    expect(out).toContain("+2");
  });

  it("formats git_diff with no changes", () => {
    const out = formatToolSummary("git_diff", {}, "", false);
    expect(out).toContain("No diff");
  });

  it("formats git_log", () => {
    const out = formatToolSummary(
      "git_log",
      {},
      "commit abc1234 msg\ncommit def5678 msg2",
      false,
    );
    expect(out).toContain("abc1234");
  });

  it("formats git_commit", () => {
    const out = formatToolSummary(
      "git_commit",
      {},
      "[main abc1234] Fix bug",
      false,
    );
    expect(out).toContain("abc1234");
    expect(out).toContain("Fix bug");
  });

  it("formats git_push", () => {
    const out = formatToolSummary("git_push", {}, "-> origin/main", false);
    expect(out).toContain("origin/main");
  });

  it("formats git_pull already up to date", () => {
    const out = formatToolSummary("git_pull", {}, "Already up to date.", false);
    expect(out).toContain("Already up to date");
  });

  it("formats web_fetch", () => {
    const out = formatToolSummary("web_fetch", {}, "content", false);
    expect(out).toContain("Fetched");
  });

  it("formats web_search", () => {
    const out = formatToolSummary(
      "web_search",
      {},
      "result 1\n\nresult 2",
      false,
    );
    expect(out).toContain("2 result");
  });

  it("formats task_list", () => {
    const out = formatToolSummary("task_list", {}, "task", false);
    expect(out).toContain("Done");
  });

  it("formats spawn_agents", () => {
    const out = formatToolSummary(
      "spawn_agents",
      {},
      "\u2713 Agent 1 done\n\u2713 Agent 2 done",
      false,
    );
    expect(out).toContain("2 agents done");
  });

  it("formats spawn_agents with failures", () => {
    const out = formatToolSummary(
      "spawn_agents",
      {},
      "\u2713 Agent 1 done\n\u2717 Agent 2 failed",
      false,
    );
    expect(out).toContain("1 done");
    expect(out).toContain("1 failed");
  });

  it("formats switch_model", () => {
    const out = formatToolSummary(
      "switch_model",
      {},
      "Switched to gpt-4",
      false,
    );
    expect(out).toContain("gpt-4");
  });

  it("formats unknown tool — shows first result line", () => {
    const out = formatToolSummary("custom_tool", {}, "any result", false);
    expect(out).toContain("any result");
  });

  it("formats unknown tool with empty result as Done", () => {
    const out = formatToolSummary("custom_tool", {}, "", false);
    expect(out).toContain("Run complete");
  });
});

// ─── formatSectionHeader ─────────────────────────────────────
describe("formatSectionHeader()", () => {
  it("returns step N for empty tools", () => {
    const out = formatSectionHeader([], 1);
    expect(out).toContain("Step 1");
  });

  it("returns step N for null tools", () => {
    const out = formatSectionHeader(null, 3);
    expect(out).toContain("Step 3");
  });

  it("formats single tool with label and arg", () => {
    const out = formatSectionHeader(
      [
        {
          fnName: "read_file",
          args: { path: "src/index.js" },
          canExecute: true,
        },
      ],
      1,
    );
    expect(out).toContain("INSPECT");
    expect(out).toContain("src/index.js");
  });

  it("formats single tool with command arg", () => {
    const out = formatSectionHeader(
      [{ fnName: "bash", args: { command: "npm test" }, canExecute: true }],
      1,
    );
    expect(out).toContain("EXECUTE");
    expect(out).toContain("npm test");
  });

  it("formats single tool with query arg", () => {
    const out = formatSectionHeader(
      [{ fnName: "web_search", args: { query: "node js" }, canExecute: true }],
      1,
    );
    expect(out).toContain("EXPLORE");
    expect(out).toContain("node js");
  });

  it("formats single tool with pattern arg", () => {
    const out = formatSectionHeader(
      [{ fnName: "grep", args: { pattern: "TODO" }, canExecute: true }],
      1,
    );
    expect(out).toContain("INSPECT");
    expect(out).toContain("TODO");
  });

  it("formats multi-tool with semantic flow", () => {
    const out = formatSectionHeader(
      [
        { fnName: "read_file", args: { path: "a.js" }, canExecute: true },
        { fnName: "read_file", args: { path: "b.js" }, canExecute: true },
      ],
      1,
    );
    expect(out).toContain("Inspect");
    expect(out).toContain("a.js");
  });

  it("formats multi-tool with different semantic stages", () => {
    const out = formatSectionHeader(
      [
        { fnName: "read_file", args: { path: "a.js" }, canExecute: true },
        { fnName: "bash", args: { command: "ls" }, canExecute: true },
      ],
      1,
    );
    expect(out).toContain("Inspect");
    expect(out).toContain("Execute");
  });

  it("compresses long multi-stage flows", () => {
    const out = formatSectionHeader(
      [
        { fnName: "read_file", args: {}, canExecute: true },
        { fnName: "bash", args: {}, canExecute: true },
        { fnName: "grep", args: {}, canExecute: true },
        { fnName: "write_file", args: {}, canExecute: true },
        { fnName: "git_diff", args: {}, canExecute: true },
      ],
      1,
    );
    expect(out).toContain("+1");
  });

  it("filters out tools with canExecute=false", () => {
    const out = formatSectionHeader(
      [{ fnName: "read_file", args: {}, canExecute: false }],
      1,
    );
    expect(out).toContain("Step 1");
  });

  it("applies error styling", () => {
    const out = formatSectionHeader(
      [{ fnName: "bash", args: {}, canExecute: true }],
      1,
      true,
    );
    expect(out).toContain("\x1b[31m"); // error color (red)
  });

  it("supports animated frame variants", () => {
    const out = formatSectionHeader(
      [{ fnName: "bash", args: {}, canExecute: true }],
      1,
      false,
      2,
    );
    expect(out).toContain("◎");
  });

  it("handles unknown tool name gracefully", () => {
    const out = formatSectionHeader(
      [{ fnName: "custom_thing", args: {}, canExecute: true }],
      1,
    );
    expect(out).toContain("Custom Thing");
  });
});

// ─── formatMilestone ─────────────────────────────────────────
describe("formatMilestone()", () => {
  const counts = (obj) => new Map(Object.entries(obj));

  it("contains phaseName", () => {
    const out = formatMilestone(
      "Exploration",
      5,
      counts({ read_file: 5 }),
      3000,
      new Set(),
      new Set(),
    );
    expect(out).toContain("Exploration");
  });

  it("includes scanned file count when files were read", () => {
    const out = formatMilestone(
      "Exploration",
      5,
      counts({ read_file: 5 }),
      3000,
      new Set(["a.js", "b.js"]),
      new Set(),
    );
    expect(out).toContain("2 scanned");
  });

  it("does not expose step or tool counts", () => {
    const out = formatMilestone(
      "Research",
      3,
      counts({ web_search: 3 }),
      2000,
      new Set(),
      new Set(),
    );
    expect(out).not.toContain("3 steps");
    expect(out).not.toContain("3 tools");
  });

  it("contains elapsed time in seconds", () => {
    const out = formatMilestone(
      "Phase 1",
      1,
      counts({ bash: 1 }),
      7000,
      new Set(),
      new Set(),
    );
    expect(out).toContain("7s");
  });

  it("formats elapsed time in minutes when >= 60s", () => {
    const out = formatMilestone(
      "Phase 1",
      1,
      counts({ bash: 1 }),
      95000,
      new Set(),
      new Set(),
    );
    expect(out).toContain("1m");
    expect(out).toContain("35s");
  });

  it("omits modified files when set is empty", () => {
    const out = formatMilestone(
      "Verification",
      5,
      counts({ bash: 5 }),
      4000,
      new Set(),
      new Set(),
    );
    expect(out).not.toContain("modified");
  });

  it("includes modified file count when present", () => {
    const out = formatMilestone(
      "Implementation",
      5,
      counts({ write_file: 5 }),
      4000,
      new Set(),
      new Set(["a.js", "b.js"]),
    );
    expect(out).toContain("2 files modified");
  });

  it('uses singular "file modified" for one modification', () => {
    const out = formatMilestone(
      "Phase 1",
      1,
      counts({ write_file: 1 }),
      1000,
      new Set(),
      new Set(["x.js"]),
    );
    expect(out).toContain("1 file modified");
    expect(out).not.toContain("1 files");
  });
});

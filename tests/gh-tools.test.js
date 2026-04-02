/**
 * tests/gh-tools.test.js — GitHub Actions native tools
 * Tests gh_run_list, gh_run_view, gh_workflow_trigger
 */

const { EventEmitter } = require("events");

// ─── Mocks ────────────────────────────────────────────────────
jest.mock("../cli/safety", () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));

jest.mock("../cli/file-history", () => ({ recordChange: jest.fn() }));
jest.mock("../cli/diff", () => ({
  showDiff: jest.fn(),
  showNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

// Mock child_process.exec and execFile at util.promisify level
const mockExec = jest.fn();
jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  exec: (cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    mockExec(cmd, opts, resolve);
  },
  execFile: (file, args, opts, cb) => {
    // util.promisify signature: execFile(file, args, opts, cb)
    const resolve = typeof opts === "function" ? opts : cb;
    const cmd = `${file} ${(args || []).join(" ")}`;
    mockExec(cmd, typeof opts === "function" ? {} : opts, resolve);
  },
  spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
}));

const { executeTool } = require("../cli/tools");
const { confirm } = require("../cli/safety");

// ─── Helper: runs that gh returns ─────────────────────────────
const MOCK_RUNS = [
  {
    databaseId: 123456,
    status: "completed",
    conclusion: "success",
    name: "CI",
    headBranch: "main",
    createdAt: "2026-03-10T12:00:00Z",
    updatedAt: "2026-03-10T12:05:00Z",
    event: "push",
  },
  {
    databaseId: 123457,
    status: "completed",
    conclusion: "failure",
    name: "Release",
    headBranch: "main",
    createdAt: "2026-03-10T11:00:00Z",
    updatedAt: "2026-03-10T11:03:00Z",
    event: "push",
  },
];

const MOCK_RUN_VIEW = {
  name: "CI",
  headBranch: "main",
  status: "completed",
  conclusion: "success",
  createdAt: "2026-03-10T12:00:00Z",
  updatedAt: "2026-03-10T12:05:00Z",
  jobs: [
    {
      name: "test",
      status: "completed",
      conclusion: "success",
      steps: [
        { name: "Checkout", conclusion: "success" },
        { name: "Run tests", conclusion: "success" },
      ],
    },
  ],
};

// Helper: resolve exec mock with stdout
function resolveExec(stdout) {
  mockExec.mockImplementationOnce((cmd, opts, cb) => {
    if (typeof opts === "function") opts(null, { stdout, stderr: "" });
    else if (typeof cb === "function") cb(null, { stdout, stderr: "" });
  });
}

// Helper: reject exec mock with error
function rejectExec(message) {
  mockExec.mockImplementationOnce((cmd, opts, cb) => {
    const err = new Error(message);
    err.stderr = message;
    if (typeof opts === "function") opts(err, null);
    else if (typeof cb === "function") cb(err, null);
  });
}

describe("GitHub Actions tools", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Tool Definitions ────────────────────────────────────────
  describe("tool definitions", () => {
    const { TOOL_DEFINITIONS } = require("../cli/tools");

    it("includes gh_run_list", () => {
      expect(
        TOOL_DEFINITIONS.some((t) => t.function.name === "gh_run_list"),
      ).toBe(true);
    });

    it("includes gh_run_view", () => {
      expect(
        TOOL_DEFINITIONS.some((t) => t.function.name === "gh_run_view"),
      ).toBe(true);
    });

    it("includes gh_workflow_trigger", () => {
      expect(
        TOOL_DEFINITIONS.some((t) => t.function.name === "gh_workflow_trigger"),
      ).toBe(true);
    });

    it("gh_run_list has no required params", () => {
      const def = TOOL_DEFINITIONS.find(
        (t) => t.function.name === "gh_run_list",
      );
      expect(def.function.parameters.required).toEqual([]);
    });

    it("gh_run_view requires run_id", () => {
      const def = TOOL_DEFINITIONS.find(
        (t) => t.function.name === "gh_run_view",
      );
      expect(def.function.parameters.required).toContain("run_id");
    });

    it("gh_workflow_trigger requires workflow", () => {
      const def = TOOL_DEFINITIONS.find(
        (t) => t.function.name === "gh_workflow_trigger",
      );
      expect(def.function.parameters.required).toContain("workflow");
    });
  });

  // ─── gh_run_list ─────────────────────────────────────────────
  describe('executeTool("gh_run_list")', () => {
    it("returns formatted list of runs", async () => {
      resolveExec(JSON.stringify(MOCK_RUNS));
      const result = await executeTool("gh_run_list", {});
      expect(result).toContain("123456");
      expect(result).toContain("CI");
      expect(result).toContain("success");
      expect(result).toContain("main");
    });

    it("shows ✓ for success, ✗ for failure", async () => {
      resolveExec(JSON.stringify(MOCK_RUNS));
      const result = await executeTool("gh_run_list", {});
      expect(result).toContain("✓");
      expect(result).toContain("✗");
    });

    it('returns "No workflow runs found" for empty list', async () => {
      resolveExec(JSON.stringify([]));
      const result = await executeTool("gh_run_list", {});
      expect(result).toBe("No workflow runs found.");
    });

    it("respects limit (max 30)", async () => {
      resolveExec(JSON.stringify(MOCK_RUNS));
      await executeTool("gh_run_list", { limit: 50 });
      // Should have capped at 30
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("--limit 30"),
        expect.anything(),
        expect.anything(),
      );
    });

    it("passes workflow filter when provided", async () => {
      resolveExec(JSON.stringify(MOCK_RUNS));
      await executeTool("gh_run_list", { workflow: "ci.yml" });
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("--workflow ci.yml"),
        expect.anything(),
        expect.anything(),
      );
    });

    it("passes branch filter when provided", async () => {
      resolveExec(JSON.stringify(MOCK_RUNS));
      await executeTool("gh_run_list", { branch: "devel" });
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("--branch devel"),
        expect.anything(),
        expect.anything(),
      );
    });

    it("returns helpful error when gh not found", async () => {
      rejectExec("gh: command not found");
      const result = await executeTool("gh_run_list", {});
      expect(result).toContain("ERROR");
    });
  });

  // ─── gh_run_view ─────────────────────────────────────────────
  describe('executeTool("gh_run_view")', () => {
    it("returns run summary with jobs", async () => {
      resolveExec(JSON.stringify(MOCK_RUN_VIEW));
      const result = await executeTool("gh_run_view", { run_id: "123456" });
      expect(result).toContain("CI");
      expect(result).toContain("main");
      expect(result).toContain("success");
      expect(result).toContain("test"); // job name
    });

    it("shows job steps", async () => {
      resolveExec(JSON.stringify(MOCK_RUN_VIEW));
      const result = await executeTool("gh_run_view", { run_id: "123456" });
      expect(result).toContain("Checkout");
      expect(result).toContain("Run tests");
    });

    it("passes --log flag when log:true", async () => {
      resolveExec("some log output here");
      await executeTool("gh_run_view", { run_id: "123456", log: true });
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("--log"),
        expect.anything(),
        expect.anything(),
      );
    });

    it("truncates long log output", async () => {
      resolveExec("x".repeat(20000));
      const result = await executeTool("gh_run_view", {
        run_id: "123456",
        log: true,
      });
      expect(result.length).toBeLessThanOrEqual(8100); // 8000 + '...(truncated)'
      expect(result).toContain("truncated");
    });

    it("returns error for missing run_id", async () => {
      const result = await executeTool("gh_run_view", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("run_id");
    });

    it("returns error on gh failure", async () => {
      rejectExec("Run 999 not found");
      const result = await executeTool("gh_run_view", { run_id: "999" });
      expect(result).toContain("ERROR");
    });
  });

  // ─── gh_workflow_trigger ─────────────────────────────────────
  describe('executeTool("gh_workflow_trigger")', () => {
    it("triggers workflow after confirmation", async () => {
      confirm.mockResolvedValueOnce(true);
      resolveExec("");
      const result = await executeTool("gh_workflow_trigger", {
        workflow: "ci.yml",
        branch: "main",
      });
      expect(result).toContain("triggered");
      expect(result).toContain("ci.yml");
    });

    it("cancels when user declines", async () => {
      confirm.mockResolvedValueOnce(false);
      // provide branch so getCurrentBranch() exec is not called
      const result = await executeTool("gh_workflow_trigger", {
        workflow: "ci.yml",
        branch: "main",
      });
      expect(result).toContain("CANCELLED");
    });

    it("returns error for missing workflow", async () => {
      const result = await executeTool("gh_workflow_trigger", {});
      expect(result).toContain("ERROR");
      expect(result).toContain("workflow");
    });

    it("includes inputs in command when provided", async () => {
      confirm.mockResolvedValueOnce(true);
      resolveExec("");
      await executeTool("gh_workflow_trigger", {
        workflow: "deploy.yml",
        branch: "main",
        inputs: { env: "production" },
      });
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining("env=production"),
        expect.anything(),
        expect.anything(),
      );
    });

    it("returns error on gh failure", async () => {
      confirm.mockResolvedValueOnce(true);
      rejectExec("workflow not found: ci.yml");
      const result = await executeTool("gh_workflow_trigger", {
        workflow: "ci.yml",
        branch: "main",
      });
      expect(result).toContain("ERROR");
    });
  });
});

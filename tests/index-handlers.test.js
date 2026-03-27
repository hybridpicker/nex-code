/**
 * tests/index-handlers.test.js — Additional handler tests for cli/index.js
 *
 * Covers slash command handlers and code paths NOT covered in tests/index.test.js.
 * Focuses on: /benchmark with data, /docker -a flag, /deploy --dry-run paths,
 * /servers ping specifics, /brain review/undo, /plan edit with editor,
 * /optimize edge cases, /learn edge cases, getPrompt variations, and
 * budget display with limits set.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Mocks (same pattern as index.test.js) ───────────────────
jest.mock("../cli/agent", () => ({
  processInput: jest.fn().mockResolvedValue(undefined),
  clearConversation: jest.fn(),
  getConversationLength: jest.fn().mockReturnValue(0),
  getConversationMessages: jest.fn().mockReturnValue([]),
  setConversationMessages: jest.fn(),
  setAbortSignalGetter: jest.fn(),
  invalidateSystemPromptCache: jest.fn(),
  setMaxIterations: jest.fn(),
}));

jest.mock("../cli/ollama", () => ({
  getActiveModel: jest.fn().mockReturnValue({
    id: "qwen3-coder:480b",
    name: "Qwen3 Coder",
    provider: "ollama",
    contextWindow: 131072,
  }),
  setActiveModel: jest.fn(),
  getModelNames: jest.fn().mockReturnValue(["qwen3-coder:480b"]),
}));

jest.mock("../cli/picker", () => ({
  showModelPicker: jest.fn().mockResolvedValue(true),
}));

jest.mock("../cli/providers/registry", () => ({
  listProviders: jest.fn().mockReturnValue([
    {
      provider: "ollama",
      configured: true,
      models: [{ id: "qwen3-coder:480b", name: "Qwen3 Coder", active: true }],
    },
    {
      provider: "anthropic",
      configured: true,
      models: [{ id: "claude-sonnet", name: "Sonnet" }],
    },
  ]),
  getActiveProviderName: jest.fn().mockReturnValue("ollama"),
  getActiveModelId: jest.fn().mockReturnValue("qwen3-coder:480b"),
  getActiveModel: jest.fn().mockReturnValue({
    id: "qwen3-coder:480b",
    name: "Qwen3 Coder",
    provider: "ollama",
  }),
  setActiveModel: jest.fn().mockReturnValue(true),
  listAllModels: jest.fn().mockReturnValue([]),
  setFallbackChain: jest.fn(),
  getFallbackChain: jest.fn().mockReturnValue([]),
  getProvider: jest.fn().mockReturnValue(null),
}));

jest.mock("../cli/context", () => ({
  printContext: jest.fn(),
  gatherProjectContext: jest.fn().mockReturnValue(""),
  generateFileTree: jest.fn().mockReturnValue("src/\n  index.js"),
}));

jest.mock("../cli/safety", () => ({
  confirm: jest.fn().mockResolvedValue(true),
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setReadlineInterface: jest.fn(),
}));

jest.mock("../cli/context-engine", () => ({
  getUsage: jest.fn().mockReturnValue({
    used: 95000,
    limit: 128000,
    percentage: 74.2,
    breakdown: {
      system: 500,
      conversation: 90000,
      toolResults: 4000,
      toolDefinitions: 500,
    },
    messageCount: 50,
  }),
}));

jest.mock("../cli/tools", () => ({
  TOOL_DEFINITIONS: [],
  setAskUserHandler: jest.fn(),
  cancelPendingAskUser: jest.fn(),
  executeTool: jest.fn().mockResolvedValue("Deploy output"),
}));

jest.mock("../cli/audit", () => ({
  getAuditSummary: jest.fn().mockReturnValue({
    totalCalls: 42,
    avgDuration: 150,
    successRate: 0.97,
    byTool: { bash: 20, read_file: 15, write_file: 7 },
  }),
  isAuditEnabled: jest.fn().mockReturnValue(true),
}));

jest.mock("../cli/ssh", () => ({
  loadServerProfiles: jest.fn().mockReturnValue({}),
  resolveProfile: jest.fn(),
  sshExec: jest
    .fn()
    .mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 }),
  formatProfile: jest.fn().mockReturnValue("user@host:22"),
}));

jest.mock("../cli/deploy-config", () => ({
  loadDeployConfigs: jest.fn().mockReturnValue({}),
}));

jest.mock("../cli/wizard", () => ({
  runServerWizard: jest.fn().mockResolvedValue(undefined),
  runDeployWizard: jest.fn().mockResolvedValue(undefined),
  setWizardRL: jest.fn(),
}));

jest.mock("../cli/setup", () => ({
  runSetupWizard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../cli/tasks", () => ({
  renderTaskList: jest.fn().mockReturnValue("No tasks"),
  clearTasks: jest.fn(),
}));

jest.mock("../cli/learner", () => ({
  learnFromSession: jest
    .fn()
    .mockResolvedValue({ skipped: true, applied: [], nexAdded: [] }),
  learnBrainFromSession: jest.fn().mockResolvedValue({ written: [] }),
}));

jest.mock("../cli/brain", () => ({
  listDocuments: jest.fn().mockReturnValue([]),
  readDocument: jest.fn().mockReturnValue({ content: "", frontmatter: {} }),
  writeDocument: jest.fn(),
  removeDocument: jest.fn().mockReturnValue(false),
  buildIndex: jest.fn().mockReturnValue({ documents: {} }),
  buildEmbeddingIndex: jest.fn().mockResolvedValue({ documents: {} }),
  isEmbeddingAvailable: jest.fn().mockResolvedValue(false),
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock("../cli/session", () => ({
  saveSession: jest
    .fn()
    .mockReturnValue({ path: "/tmp/test.json", name: "test" }),
  loadSession: jest.fn().mockReturnValue(null),
  listSessions: jest.fn().mockReturnValue([]),
  getLastSession: jest.fn().mockReturnValue(null),
  flushAutoSave: jest.fn(),
}));

jest.mock("../cli/memory", () => ({
  remember: jest.fn(),
  forget: jest.fn().mockReturnValue(false),
  listMemories: jest.fn().mockReturnValue([]),
}));

jest.mock("../cli/permissions", () => ({
  listPermissions: jest.fn().mockReturnValue([]),
  setPermission: jest.fn().mockReturnValue(true),
  savePermissions: jest.fn(),
}));

jest.mock("../cli/planner", () => ({
  createPlan: jest.fn(),
  getActivePlan: jest.fn().mockReturnValue(null),
  setPlanMode: jest.fn(),
  isPlanMode: jest.fn().mockReturnValue(false),
  approvePlan: jest.fn().mockReturnValue(false),
  startExecution: jest.fn(),
  formatPlan: jest.fn().mockReturnValue("No active plan"),
  savePlan: jest.fn(),
  listPlans: jest.fn().mockReturnValue([]),
  clearPlan: jest.fn(),
  setAutonomyLevel: jest.fn().mockReturnValue(true),
  getAutonomyLevel: jest.fn().mockReturnValue("interactive"),
  AUTONOMY_LEVELS: ["interactive", "semi-auto", "autonomous"],
  getPlanContent: jest.fn().mockReturnValue(null),
  setPlanContent: jest.fn(),
  extractStepsFromText: jest.fn().mockReturnValue([]),
}));

jest.mock("../cli/git", () => ({
  isGitRepo: jest.fn().mockReturnValue(true),
  getCurrentBranch: jest.fn().mockReturnValue("devel"),
  formatDiffSummary: jest.fn().mockReturnValue("No changes"),
  analyzeDiff: jest.fn().mockReturnValue(null),
  commit: jest.fn().mockReturnValue(null),
  createBranch: jest.fn().mockReturnValue("feat/test"),
  getDiff: jest.fn().mockResolvedValue(""),
}));

jest.mock("../cli/mcp", () => ({
  listServers: jest.fn().mockReturnValue([]),
  connectAll: jest.fn().mockResolvedValue([]),
  disconnectAll: jest.fn(),
}));

jest.mock("../cli/hooks", () => ({
  listHooks: jest.fn().mockReturnValue([]),
  runHooks: jest.fn().mockReturnValue([]),
  HOOK_EVENTS: ["pre-tool", "post-tool"],
}));

jest.mock("../cli/costs", () => ({
  formatCosts: jest.fn().mockReturnValue("$1.50 total"),
  resetCosts: jest.fn(),
  getCostLimits: jest.fn().mockReturnValue({}),
  getProviderSpend: jest.fn().mockReturnValue(0),
  checkBudget: jest
    .fn()
    .mockReturnValue({ limit: null, spent: 0, remaining: 0 }),
  removeCostLimit: jest.fn(),
  saveCostLimits: jest.fn(),
  setCostLimit: jest.fn(),
}));

jest.mock("../cli/file-history", () => ({
  undo: jest.fn().mockReturnValue(null),
  redo: jest.fn().mockReturnValue(null),
  getHistory: jest.fn().mockReturnValue([]),
  getUndoCount: jest.fn().mockReturnValue(0),
  getRedoCount: jest.fn().mockReturnValue(0),
  clearHistory: jest.fn(),
  loadPersistedHistory: jest.fn().mockResolvedValue(0),
  pruneHistory: jest.fn().mockResolvedValue(0),
  createSnapshot: jest.fn().mockReturnValue({ ok: true, label: "snap-001" }),
  restoreSnapshot: jest.fn().mockReturnValue({ ok: true, label: "snap-001" }),
  listSnapshots: jest.fn().mockReturnValue([]),
}));

jest.mock("../cli/skills", () => ({
  loadAllSkills: jest.fn().mockReturnValue([]),
  listSkills: jest.fn().mockReturnValue([]),
  enableSkill: jest.fn().mockReturnValue(false),
  disableSkill: jest.fn().mockReturnValue(false),
  getSkillCommands: jest.fn().mockReturnValue([]),
  handleSkillCommand: jest.fn().mockReturnValue(false),
  installSkill: jest.fn().mockResolvedValue({ ok: true, name: "test-skill" }),
  searchSkills: jest.fn().mockResolvedValue([]),
  removeSkill: jest.fn().mockReturnValue({ ok: true }),
  matchSkillTriggers: jest.fn().mockReturnValue([]),
}));

const { handleSlashCommand, getPrompt } = require("../cli/index");

describe("index-handlers.test.js — additional handler coverage", () => {
  let logSpy, writeSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
    writeSpy.mockRestore();
  });

  // ─── /benchmark with actual data ──────────────────────────
  describe("/benchmark", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-bench-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("shows benchmark data when results exist", async () => {
      // Create a fake results dir at the expected path
      const resultsDir = path.join(
        os.homedir(),
        "Coding",
        "nex-code-benchmarks",
        "results",
      );
      const needsCleanup = !fs.existsSync(resultsDir);

      if (needsCleanup) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      // Write test result files
      const today = new Date().toISOString().slice(0, 10);
      const resultFile = path.join(resultsDir, `${today}.json`);
      const hadFile = fs.existsSync(resultFile);
      let origContent;
      if (hadFile) origContent = fs.readFileSync(resultFile, "utf-8");

      fs.writeFileSync(
        resultFile,
        JSON.stringify({
          model: "qwen3-coder:480b",
          tasks: [
            { passed: true, score: 0.9 },
            { passed: true, score: 0.8 },
          ],
          score: 85,
        }),
      );

      await handleSlashCommand("/benchmark --history");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Nightly Results");
      expect(output).toContain("qwen3-coder");

      // Cleanup
      if (hadFile) {
        fs.writeFileSync(resultFile, origContent);
      } else {
        fs.unlinkSync(resultFile);
      }
      if (needsCleanup) {
        // Only remove if we created it and it's now empty
        try {
          const remaining = fs.readdirSync(resultsDir);
          if (remaining.length === 0) fs.rmdirSync(resultsDir);
        } catch {
          /* ignore */
        }
      }
    });

    it("shows trend arrow for multiple days", async () => {
      const resultsDir = path.join(
        os.homedir(),
        "Coding",
        "nex-code-benchmarks",
        "results",
      );
      const needsCleanup = !fs.existsSync(resultsDir);
      if (needsCleanup) fs.mkdirSync(resultsDir, { recursive: true });

      // Clean up any existing result files to ensure a clean state
      try {
        const existingFiles = fs
          .readdirSync(resultsDir)
          .filter((f) => f.endsWith(".json"));
        for (const file of existingFiles) {
          fs.unlinkSync(path.join(resultsDir, file));
        }
      } catch {
        /* ignore */
      }

      const files = [];
      for (let i = 0; i < 3; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        const filePath = path.join(resultsDir, `${dateStr}.json`);
        const existed = fs.existsSync(filePath);
        files.push({
          path: filePath,
          existed,
          orig: existed ? fs.readFileSync(filePath, "utf-8") : null,
        });
        fs.writeFileSync(
          filePath,
          JSON.stringify({ model: "test", score: 80 + i * 5 }),
        );
      }

      await handleSlashCommand("/benchmark --history");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Trend");

      // Cleanup
      for (const f of files) {
        if (f.existed) {
          fs.writeFileSync(f.path, f.orig);
        } else {
          try {
            fs.unlinkSync(f.path);
          } catch {
            /* ignore */
          }
        }
      }
      if (needsCleanup) {
        try {
          const remaining = fs.readdirSync(resultsDir);
          if (remaining.length === 0) fs.rmdirSync(resultsDir);
        } catch {
          /* ignore */
        }
      }
    });
  });

  // ─── /budget with active limits and display ────────────────
  describe("/budget display with limits", () => {
    it("shows bar chart when limits are set", async () => {
      const costs = require("../cli/costs");
      costs.getCostLimits.mockReturnValueOnce({ anthropic: 20 });
      costs.getProviderSpend.mockReturnValue(15);
      await handleSlashCommand("/budget");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Cost Limits");
      expect(output).toContain("anthropic");
    });

    it("shows free provider without limit", async () => {
      const costs = require("../cli/costs");
      costs.getCostLimits.mockReturnValueOnce({});
      costs.getProviderSpend.mockReturnValue(0);
      await handleSlashCommand("/budget");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("free");
    });
  });

  // ─── /plan edit with content ───────────────────────────────
  describe("/plan edit", () => {
    it("opens editor when plan content exists", async () => {
      const planner = require("../cli/planner");
      planner.getPlanContent.mockReturnValueOnce("## Step 1\nDo something");

      // Mock child_process.spawnSync to simulate editor
      const cp = require("child_process");
      const origSpawnSync = cp.spawnSync;
      cp.spawnSync = jest.fn().mockReturnValue({ status: 0 });

      await handleSlashCommand("/plan edit");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Opening plan");

      cp.spawnSync = origSpawnSync;
    });

    it("handles editor failure", async () => {
      const planner = require("../cli/planner");
      planner.getPlanContent.mockReturnValueOnce("## Step 1\nDo something");

      const cp = require("child_process");
      const origSpawnSync = cp.spawnSync;
      cp.spawnSync = jest.fn().mockReturnValue({ status: 1 });

      await handleSlashCommand("/plan edit");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("error");

      cp.spawnSync = origSpawnSync;
    });
  });

  // ─── /auto with various levels ─────────────────────────────
  describe("/auto", () => {
    it("shows current level when no arg", async () => {
      await handleSlashCommand("/auto");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("interactive");
      expect(output).toContain("Levels");
    });

    it("sets autonomous level", async () => {
      const planner = require("../cli/planner");
      await handleSlashCommand("/auto autonomous");
      expect(planner.setAutonomyLevel).toHaveBeenCalledWith("autonomous");
    });
  });

  // ─── /tree with edge cases ─────────────────────────────────
  describe("/tree", () => {
    it("caps depth at 8", async () => {
      const context = require("../cli/context");
      await handleSlashCommand("/tree 20");
      // Should cap at 8
      expect(context.generateFileTree).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ maxDepth: 8 }),
      );
    });

    it("defaults to depth 3 for invalid input", async () => {
      const context = require("../cli/context");
      await handleSlashCommand("/tree abc");
      expect(context.generateFileTree).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ maxDepth: 3 }),
      );
    });
  });

  // ─── /optimize edge cases ─────────────────────────────────
  describe("/optimize", () => {
    it("shows high context warning when > 75%", async () => {
      const ctxEngine = require("../cli/context-engine");
      ctxEngine.getUsage.mockReturnValueOnce({
        used: 105000,
        limit: 128000,
        percentage: 82,
        breakdown: {
          system: 500,
          conversation: 100000,
          toolResults: 4000,
          toolDefinitions: 500,
        },
        messageCount: 80,
      });
      await handleSlashCommand("/optimize");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Tip");
      expect(output).toContain("/clear");
    });

    it("shows filling up warning when 50-75%", async () => {
      const ctxEngine = require("../cli/context-engine");
      ctxEngine.getUsage.mockReturnValueOnce({
        used: 80000,
        limit: 128000,
        percentage: 62.5,
        breakdown: {
          system: 500,
          conversation: 75000,
          toolResults: 4000,
          toolDefinitions: 500,
        },
        messageCount: 40,
      });
      await handleSlashCommand("/optimize");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("filling up");
    });

    it("shows healthy context when < 50%", async () => {
      const ctxEngine = require("../cli/context-engine");
      ctxEngine.getUsage.mockReturnValueOnce({
        used: 5000,
        limit: 128000,
        percentage: 3.9,
        breakdown: {
          system: 500,
          conversation: 4000,
          toolResults: 400,
          toolDefinitions: 100,
        },
        messageCount: 5,
      });
      await handleSlashCommand("/optimize");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("healthy");
    });

    it("shows memory count", async () => {
      const memory = require("../cli/memory");
      memory.listMemories.mockReturnValueOnce([
        { key: "a", value: "b", updatedAt: new Date().toISOString() },
        { key: "c", value: "d", updatedAt: new Date().toISOString() },
      ]);
      await handleSlashCommand("/optimize");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("2 entries");
    });

    it("shows pruning tip for many memories", async () => {
      const memory = require("../cli/memory");
      const manyMemories = Array.from({ length: 35 }, (_, i) => ({
        key: `k${i}`,
        value: `v${i}`,
        updatedAt: new Date().toISOString(),
      }));
      memory.listMemories.mockReturnValueOnce(manyMemories);
      await handleSlashCommand("/optimize");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("pruning");
    });
  });

  // ─── /learn with updated memory (action: 'updated') ────────
  describe("/learn", () => {
    it("handles learn with brain-only results", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce(
        Array.from({ length: 8 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg${i}`,
        })),
      );
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: false,
        applied: [],
        nexAdded: [],
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({
        written: [
          {
            name: "patterns",
            reason: "code patterns found",
            action: "created",
          },
        ],
      });
      await handleSlashCommand("/learn");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Brain documents");
      expect(output).toContain("patterns");
    });

    it("handles learn with summary but no learnings", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce(
        Array.from({ length: 8 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg${i}`,
        })),
      );
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: false,
        applied: [],
        nexAdded: [],
        summary: "Quick debug session",
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({ written: [] });
      await handleSlashCommand("/learn");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Quick debug session");
      expect(output).toContain("No new learnings");
    });
  });

  // ─── /brain subcommands ────────────────────────────────────
  describe("/brain subcommands", () => {
    it("/brain status with documents shows total size", async () => {
      const brain = require("../cli/brain");
      brain.listDocuments.mockReturnValueOnce([
        { name: "doc1", size: 2048, modified: new Date() },
        { name: "doc2", size: 512, modified: new Date() },
      ]);
      await handleSlashCommand("/brain status");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("2");
      expect(output).toContain("Total size");
    });

    it("/brain list with docs shows table headers", async () => {
      const brain = require("../cli/brain");
      brain.listDocuments.mockReturnValueOnce([
        { name: "api-guide", size: 4096, modified: new Date() },
      ]);
      brain.readDocument.mockReturnValueOnce({
        content: "# API Guide",
        frontmatter: { tags: ["api", "rest"] },
      });
      await handleSlashCommand("/brain list");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Brain Documents");
      expect(output).toContain("Name");
      expect(output).toContain("api-guide");
    });
  });

  // ─── /deploy with named deploy ─────────────────────────────
  describe("/deploy", () => {
    it("runs deploy with -n flag", async () => {
      const dc = require("../cli/deploy-config");
      dc.loadDeployConfigs.mockReturnValueOnce({
        staging: { method: "rsync", server: "prod", remote_path: "/app" },
      });
      const tools = require("../cli/tools");
      await handleSlashCommand("/deploy staging -n");
      expect(tools.executeTool).toHaveBeenCalledWith(
        "deploy",
        expect.objectContaining({ dry_run: true }),
      );
    });
  });

  // ─── /servers listing ──────────────────────────────────────
  describe("/servers", () => {
    it("lists multiple servers with formatting", async () => {
      const ssh = require("../cli/ssh");
      ssh.loadServerProfiles.mockReturnValueOnce({
        prod: { host: "1.2.3.4", user: "admin" },
        staging: { host: "5.6.7.8", user: "deploy" },
      });
      await handleSlashCommand("/servers");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("prod");
      expect(output).toContain("staging");
      expect(output).toContain("Configured servers (2)");
    });
  });

  // ─── /init and /setup ──────────────────────────────────────
  describe("/init and /setup", () => {
    it("/init calls setWizardRL and runServerWizard", async () => {
      const wizard = require("../cli/wizard");
      await handleSlashCommand("/init", null);
      expect(wizard.setWizardRL).toHaveBeenCalled();
      expect(wizard.runServerWizard).toHaveBeenCalled();
    });

    it("/init deploy calls runDeployWizard", async () => {
      const wizard = require("../cli/wizard");
      await handleSlashCommand("/init deploy", null);
      expect(wizard.runDeployWizard).toHaveBeenCalled();
    });

    it("/setup calls runSetupWizard with force", async () => {
      const setup = require("../cli/setup");
      await handleSlashCommand("/setup", null);
      expect(setup.runSetupWizard).toHaveBeenCalledWith(
        expect.objectContaining({ force: true }),
      );
    });
  });

  // ─── getPrompt variations ──────────────────────────────────
  // Mode indicators (plan / autonomy / always) moved to the sticky footer
  // status bar — getPrompt() always returns the clean "> " arrow prompt.
  describe("getPrompt()", () => {
    it("always returns plain arrow prompt regardless of mode", () => {
      const planner = require("../cli/planner");
      planner.isPlanMode.mockReturnValue(false);
      planner.getAutonomyLevel.mockReturnValue("interactive");
      const prompt = getPrompt();
      expect(prompt).toContain(">");
      expect(prompt).not.toContain("plan");
      expect(prompt).not.toContain("semi-auto");
      expect(prompt).not.toContain("autonomous");
    });

    it("does not embed plan tag even in plan mode", () => {
      const planner = require("../cli/planner");
      planner.isPlanMode.mockReturnValueOnce(true);
      planner.getAutonomyLevel.mockReturnValueOnce("interactive");
      const prompt = getPrompt();
      expect(prompt).toContain(">");
      expect(prompt).not.toContain("plan");
    });

    it("does not embed autonomy tag when not interactive", () => {
      const planner = require("../cli/planner");
      planner.isPlanMode.mockReturnValueOnce(false);
      planner.getAutonomyLevel.mockReturnValueOnce("autonomous");
      const prompt = getPrompt();
      expect(prompt).toContain(">");
      expect(prompt).not.toContain("autonomous");
    });

    it("is always a short single-line prompt", () => {
      const prompt = getPrompt();
      expect(prompt).not.toContain("\n");
      expect(prompt.length).toBeLessThan(30);
    });
  });

  // ─── /install-skill, /search-skill, /remove-skill ──────────
  describe("skill management commands", () => {
    it("/install-skill calls installSkill", async () => {
      const skills = require("../cli/skills");
      await handleSlashCommand("/install-skill github.com/user/repo");
      expect(skills.installSkill).toHaveBeenCalledWith("github.com/user/repo");
    });

    it("/search-skill calls searchSkills", async () => {
      const skills = require("../cli/skills");
      await handleSlashCommand("/search-skill lint");
      expect(skills.searchSkills).toHaveBeenCalledWith("lint");
    });

    it("/remove-skill calls removeSkill", async () => {
      const skills = require("../cli/skills");
      await handleSlashCommand("/remove-skill old-skill");
      expect(skills.removeSkill).toHaveBeenCalledWith("old-skill");
    });

    it("/install-skill without URL shows usage", async () => {
      await handleSlashCommand("/install-skill");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/search-skill without query shows usage", async () => {
      await handleSlashCommand("/search-skill");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/remove-skill without name shows usage", async () => {
      await handleSlashCommand("/remove-skill");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });
  });

  // ─── /audit ────────────────────────────────────────────────
  describe("/audit", () => {
    it("shows audit summary", async () => {
      await handleSlashCommand("/audit");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Audit Summary");
      expect(output).toContain("42");
    });

    it("passes days argument", async () => {
      const audit = require("../cli/audit");
      await handleSlashCommand("/audit 14");
      expect(audit.getAuditSummary).toHaveBeenCalledWith(14);
    });

    it("shows disabled message", async () => {
      const audit = require("../cli/audit");
      audit.isAuditEnabled.mockReturnValueOnce(false);
      await handleSlashCommand("/audit");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("disabled");
    });
  });

  // ─── /docker ───────────────────────────────────────────────
  describe("/docker", () => {
    it("shows Docker Containers header", async () => {
      await handleSlashCommand("/docker");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Docker Containers");
    });
  });
});

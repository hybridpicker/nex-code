const fs = require("fs");
const path = require("path");

// Test the REPL command handling logic
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
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "ollama",
  }),
  setActiveModel: jest.fn(),
  getModelNames: jest.fn().mockReturnValue(["kimi-k2.5", "qwen3-coder:480b"]),
}));

jest.mock("../cli/picker", () => ({
  showModelPicker: jest.fn().mockResolvedValue(true),
}));

jest.mock("../cli/providers/registry", () => ({
  listProviders: jest.fn().mockReturnValue([
    {
      provider: "ollama",
      configured: true,
      models: [
        { id: "kimi-k2.5", name: "Kimi K2.5", active: true },
        { id: "qwen3-coder:480b", name: "Qwen3 Coder", active: false },
      ],
    },
    {
      provider: "openai",
      configured: false,
      models: [{ id: "gpt-4o", name: "GPT-4o", active: false }],
    },
  ]),
  getActiveProviderName: jest.fn().mockReturnValue("ollama"),
  getActiveModelId: jest.fn().mockReturnValue("kimi-k2.5"),
  getActiveModel: jest.fn().mockReturnValue({
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "ollama",
  }),
  setActiveModel: jest.fn().mockReturnValue(true),
  listAllModels: jest.fn().mockReturnValue([
    {
      spec: "ollama:kimi-k2.5",
      name: "Kimi K2.5",
      provider: "ollama",
      configured: true,
    },
  ]),
  setFallbackChain: jest.fn(),
  getFallbackChain: jest.fn().mockReturnValue([]),
  getProvider: jest.fn().mockReturnValue(null),
}));

jest.mock("../cli/context", () => ({
  printContext: jest.fn(),
  gatherProjectContext: jest.fn().mockReturnValue(""),
}));

jest.mock("../cli/safety", () => ({
  confirm: jest.fn().mockResolvedValue(true),
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setReadlineInterface: jest.fn(),
  setAllowAlwaysHandler: jest.fn(),
}));

jest.mock("../cli/context-engine", () => ({
  getUsage: jest.fn().mockReturnValue({
    used: 1500,
    limit: 128000,
    percentage: 1.2,
    breakdown: {
      system: 500,
      conversation: 800,
      toolResults: 100,
      toolDefinitions: 100,
    },
    messageCount: 5,
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
  deleteSession: jest.fn().mockReturnValue(true),
}));

jest.mock("../cli/memory", () => ({
  remember: jest.fn(),
  forget: jest.fn().mockReturnValue(false),
  listMemories: jest.fn().mockReturnValue([]),
}));

jest.mock("../cli/permissions", () => ({
  listPermissions: jest.fn().mockReturnValue([
    { tool: "bash", mode: "ask" },
    { tool: "read_file", mode: "allow" },
  ]),
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
  getCurrentBranch: jest.fn().mockReturnValue("main"),
  formatDiffSummary: jest.fn().mockReturnValue("No changes"),
  analyzeDiff: jest.fn().mockReturnValue(null),
  commit: jest.fn().mockReturnValue(null),
  createBranch: jest.fn().mockReturnValue("feat/test-branch"),
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
  HOOK_EVENTS: [
    "pre-tool",
    "post-tool",
    "pre-commit",
    "post-response",
    "session-start",
    "session-end",
  ],
}));

jest.mock("../cli/costs", () => ({
  formatCosts: jest
    .fn()
    .mockReturnValue("No token usage recorded this session."),
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

const {
  showCommandList,
  completer,
  completeFilePath,
  showProviders,
  showHelp,
  renderBar,
  hasPasteStart,
  hasPasteEnd,
  stripPasteSequences,
  handleSlashCommand,
  getPrompt,
  loadHistory,
  appendHistory,
  getHistoryPath,
  getAbortSignal,
} = require("../cli/index");

describe("index.js (REPL commands)", () => {
  let logSpy, writeSpy, exitSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    logSpy.errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    writeSpy = jest.spyOn(process.stdout, "write").mockImplementation(() => {});
    exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    logSpy.errorSpy.mockRestore();
    writeSpy.mockRestore();
    exitSpy.mockRestore();
    jest.clearAllMocks();
  });

  // ─── showCommandList ──────────────────────────────────────
  describe("showCommandList()", () => {
    it("lists all slash commands", () => {
      showCommandList();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/help");
      expect(output).toContain("/model");
      expect(output).toContain("/exit");
    });

    it("includes skill commands when available", () => {
      const skills = require("../cli/skills");
      skills.getSkillCommands.mockReturnValueOnce([
        { cmd: "/custom-skill", desc: "A custom skill" },
      ]);
      showCommandList();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/custom-skill");
      expect(output).toContain("[skill]");
    });
  });

  // ─── completer ────────────────────────────────────────────
  describe("completer()", () => {
    it("returns matching commands for partial input", () => {
      const [hits, line] = completer("/he");
      expect(hits).toContain("/help");
      expect(line).toBe("/he");
    });

    it("returns all commands when no match", () => {
      const [hits, line] = completer("/zzz");
      expect(hits.length).toBeGreaterThan(1);
      expect(line).toBe("/zzz");
    });

    it("returns empty for non-slash input without path", () => {
      const [hits, line] = completer("hello");
      expect(hits).toEqual([]);
      expect(line).toBe("hello");
    });

    it("completes file paths when last token contains /", () => {
      // cli/ exists in this project
      const [hits, lastToken] = completer("read cli/");
      expect(lastToken).toBe("cli/");
      expect(hits.length).toBeGreaterThan(0);
      // Should find cli/index.js etc.
      expect(hits.some((h) => h.includes("index.js"))).toBe(true);
    });

    it("completes file paths starting with ./", () => {
      const [hits, lastToken] = completer("read ./cli/");
      expect(lastToken).toBe("./cli/");
      expect(hits.length).toBeGreaterThan(0);
    });
  });

  // ─── completeFilePath ──────────────────────────────────────
  describe("completeFilePath()", () => {
    const os = require("os");
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-complete-"));
      fs.writeFileSync(path.join(tmpDir, "app.js"), "");
      fs.writeFileSync(path.join(tmpDir, "style.css"), "");
      fs.mkdirSync(path.join(tmpDir, "src"));
      fs.writeFileSync(path.join(tmpDir, "src", "main.js"), "");
      fs.writeFileSync(path.join(tmpDir, ".hidden"), "");
      fs.mkdirSync(path.join(tmpDir, "node_modules"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("lists files in a directory", () => {
      const matches = completeFilePath(tmpDir + "/");
      expect(matches.some((m) => m.includes("app.js"))).toBe(true);
      expect(matches.some((m) => m.includes("style.css"))).toBe(true);
    });

    it("adds / suffix to directories", () => {
      const matches = completeFilePath(tmpDir + "/");
      const srcMatch = matches.find((m) => m.includes("src"));
      expect(srcMatch).toBeDefined();
      expect(srcMatch.endsWith("/")).toBe(true);
    });

    it("filters hidden files", () => {
      const matches = completeFilePath(tmpDir + "/");
      expect(matches.some((m) => m.includes(".hidden"))).toBe(false);
    });

    it("filters node_modules", () => {
      const matches = completeFilePath(tmpDir + "/");
      expect(matches.some((m) => m.includes("node_modules"))).toBe(false);
    });

    it("matches partial file name", () => {
      const matches = completeFilePath(tmpDir + "/app");
      expect(matches.length).toBe(1);
      expect(matches[0]).toContain("app.js");
    });

    it("returns empty for non-existent directory", () => {
      const matches = completeFilePath("/nonexistent/dir/");
      expect(matches).toEqual([]);
    });

    it("returns empty for file path (not directory)", () => {
      const matches = completeFilePath(tmpDir + "/app.js/foo");
      expect(matches).toEqual([]);
    });

    it("completes subdirectory contents", () => {
      const matches = completeFilePath(tmpDir + "/src/");
      expect(matches.some((m) => m.includes("main.js"))).toBe(true);
    });
  });

  // ─── showProviders ────────────────────────────────────────
  describe("showProviders()", () => {
    it("shows active provider with marker", () => {
      showProviders();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ollama");
      expect(output).toContain("active");
      expect(output).toContain("kimi-k2.5");
    });
  });

  // ─── showHelp ─────────────────────────────────────────────
  describe("showHelp()", () => {
    it("outputs help text with all sections", () => {
      showHelp();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Commands");
      expect(output).toContain("Sessions");
      expect(output).toContain("Memory");
      expect(output).toContain("Planning");
      expect(output).toContain("Git");
    });
  });

  // ─── renderBar ────────────────────────────────────────────
  describe("renderBar()", () => {
    it("renders green bar for low percentage", () => {
      const bar = renderBar(20);
      expect(bar).toContain("20%");
      expect(bar).toContain("█");
    });

    it("renders yellow bar for medium percentage", () => {
      const bar = renderBar(60);
      expect(bar).toContain("60%");
    });

    it("renders red bar for high percentage", () => {
      const bar = renderBar(90);
      expect(bar).toContain("90%");
    });
  });

  describe("startREPL()", () => {
    it("exits with error when no provider is configured", async () => {
      // Reset modules to get fresh instance with no configured providers
      jest.resetModules();
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
      jest.mock("../cli/context-engine", () => ({
        getUsage: jest.fn().mockReturnValue({
          used: 1500,
          limit: 128000,
          percentage: 1.2,
          breakdown: {
            system: 500,
            conversation: 800,
            toolResults: 100,
            toolDefinitions: 100,
          },
          messageCount: 5,
        }),
      }));
      jest.mock("../cli/tools", () => ({
        TOOL_DEFINITIONS: [],
        setAskUserHandler: jest.fn(),
        cancelPendingAskUser: jest.fn(),
      }));
      jest.mock("../cli/session", () => ({
        saveSession: jest
          .fn()
          .mockReturnValue({ path: "/tmp/test.json", name: "test" }),
        loadSession: jest.fn().mockReturnValue(null),
        listSessions: jest.fn().mockReturnValue([]),
        getLastSession: jest.fn().mockReturnValue(null),
        deleteSession: jest.fn().mockReturnValue(true),
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
      }));
      jest.mock("../cli/git", () => ({
        isGitRepo: jest.fn().mockReturnValue(true),
        getCurrentBranch: jest.fn().mockReturnValue("main"),
        formatDiffSummary: jest.fn().mockReturnValue("No changes"),
        analyzeDiff: jest.fn().mockReturnValue(null),
        commit: jest.fn().mockReturnValue(null),
        createBranch: jest.fn().mockReturnValue("feat/test-branch"),
      }));
      jest.mock("../cli/mcp", () => ({
        listServers: jest.fn().mockReturnValue([]),
        connectAll: jest.fn().mockResolvedValue([]),
        disconnectAll: jest.fn(),
      }));
      jest.mock("../cli/hooks", () => ({
        listHooks: jest.fn().mockReturnValue([]),
        runHooks: jest.fn().mockReturnValue([]),
        HOOK_EVENTS: [
          "pre-tool",
          "post-tool",
          "pre-commit",
          "post-response",
          "session-start",
          "session-end",
        ],
      }));
      jest.mock("../cli/ollama", () => ({
        getActiveModel: jest
          .fn()
          .mockReturnValue({ id: "kimi-k2.5", name: "Kimi K2.5" }),
        setActiveModel: jest.fn(),
        getModelNames: jest.fn().mockReturnValue([]),
      }));
      jest.mock("../cli/providers/registry", () => ({
        listProviders: jest.fn().mockReturnValue([
          { provider: "ollama", configured: false, models: [] },
          { provider: "openai", configured: false, models: [] },
        ]),
        getActiveProviderName: jest.fn().mockReturnValue("ollama"),
        getActiveModel: jest
          .fn()
          .mockReturnValue({ id: "kimi-k2.5", name: "Kimi K2.5" }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock("../cli/context", () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn().mockReturnValue(""),
      }));
      jest.mock("../cli/safety", () => ({
        confirm: jest.fn().mockResolvedValue(true),
        setAutoConfirm: jest.fn(),
        getAutoConfirm: jest.fn().mockReturnValue(false),
        setReadlineInterface: jest.fn(),
        setAllowAlwaysHandler: jest.fn(),
      }));
      jest.mock("../cli/costs", () => ({
        formatCosts: jest
          .fn()
          .mockReturnValue("No token usage recorded this session."),
        resetCosts: jest.fn(),
      }));
      jest.mock("../cli/skills", () => ({
        loadAllSkills: jest.fn().mockReturnValue([]),
        listSkills: jest.fn().mockReturnValue([]),
        enableSkill: jest.fn().mockReturnValue(false),
        disableSkill: jest.fn().mockReturnValue(false),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn().mockReturnValue(false),
        matchSkillTriggers: jest.fn().mockReturnValue([]),
      }));

      const { startREPL } = require("../cli/index");
      await startREPL();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("starts REPL when a provider is configured", () => {
      jest.resetModules();
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
      jest.mock("../cli/context-engine", () => ({
        getUsage: jest.fn().mockReturnValue({
          used: 1500,
          limit: 128000,
          percentage: 1.2,
          breakdown: {
            system: 500,
            conversation: 800,
            toolResults: 100,
            toolDefinitions: 100,
          },
          messageCount: 5,
        }),
      }));
      jest.mock("../cli/tools", () => ({
        TOOL_DEFINITIONS: [],
        setAskUserHandler: jest.fn(),
        cancelPendingAskUser: jest.fn(),
      }));
      jest.mock("../cli/session", () => ({
        saveSession: jest
          .fn()
          .mockReturnValue({ path: "/tmp/test.json", name: "test" }),
        loadSession: jest.fn().mockReturnValue(null),
        listSessions: jest.fn().mockReturnValue([]),
        getLastSession: jest.fn().mockReturnValue(null),
        deleteSession: jest.fn().mockReturnValue(true),
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
      }));
      jest.mock("../cli/git", () => ({
        isGitRepo: jest.fn().mockReturnValue(true),
        getCurrentBranch: jest.fn().mockReturnValue("main"),
        formatDiffSummary: jest.fn().mockReturnValue("No changes"),
        analyzeDiff: jest.fn().mockReturnValue(null),
        commit: jest.fn().mockReturnValue(null),
        createBranch: jest.fn().mockReturnValue("feat/test-branch"),
      }));
      jest.mock("../cli/mcp", () => ({
        listServers: jest.fn().mockReturnValue([]),
        connectAll: jest.fn().mockResolvedValue([]),
        disconnectAll: jest.fn(),
      }));
      jest.mock("../cli/hooks", () => ({
        listHooks: jest.fn().mockReturnValue([]),
        runHooks: jest.fn().mockReturnValue([]),
        HOOK_EVENTS: [
          "pre-tool",
          "post-tool",
          "pre-commit",
          "post-response",
          "session-start",
          "session-end",
        ],
      }));
      jest.mock("../cli/ollama", () => ({
        getActiveModel: jest.fn().mockReturnValue({
          id: "kimi-k2.5",
          name: "Kimi K2.5",
          provider: "ollama",
        }),
        setActiveModel: jest.fn(),
        getModelNames: jest
          .fn()
          .mockReturnValue(["kimi-k2.5", "qwen3-coder:480b"]),
      }));
      jest.mock("../cli/providers/registry", () => ({
        listProviders: jest.fn().mockReturnValue([
          {
            provider: "ollama",
            configured: true,
            models: [{ id: "kimi-k2.5", name: "Kimi K2.5", active: true }],
          },
        ]),
        getActiveProviderName: jest.fn().mockReturnValue("ollama"),
        getActiveModel: jest.fn().mockReturnValue({
          id: "kimi-k2.5",
          name: "Kimi K2.5",
          provider: "ollama",
        }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock("../cli/context", () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn().mockReturnValue(""),
      }));
      jest.mock("../cli/safety", () => ({
        confirm: jest.fn().mockResolvedValue(true),
        setAutoConfirm: jest.fn(),
        getAutoConfirm: jest.fn().mockReturnValue(false),
        setReadlineInterface: jest.fn(),
        setAllowAlwaysHandler: jest.fn(),
      }));
      jest.mock("../cli/costs", () => ({
        formatCosts: jest
          .fn()
          .mockReturnValue("No token usage recorded this session."),
        resetCosts: jest.fn(),
      }));
      jest.mock("../cli/skills", () => ({
        loadAllSkills: jest.fn().mockReturnValue([]),
        listSkills: jest.fn().mockReturnValue([]),
        enableSkill: jest.fn().mockReturnValue(false),
        disableSkill: jest.fn().mockReturnValue(false),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn().mockReturnValue(false),
        matchSkillTriggers: jest.fn().mockReturnValue([]),
      }));

      const mockRl = {
        prompt: jest.fn(),
        setPrompt: jest.fn(),
        on: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };
      jest
        .spyOn(require("readline"), "createInterface")
        .mockReturnValueOnce(mockRl);

      const { startREPL } = require("../cli/index");
      startREPL();

      expect(exitSpy).not.toHaveBeenCalledWith(1);
    });
  });

  describe("slash commands via readline", () => {
    let lineHandler, closeHandler, mockRl;

    beforeEach(() => {
      mockRl = {
        prompt: jest.fn(),
        setPrompt: jest.fn(),
        on: jest.fn(function (event, handler) {
          if (event === "line") lineHandler = handler;
          if (event === "close") closeHandler = handler;
          return this;
        }),
        close: jest.fn(),
      };
      jest
        .spyOn(require("readline"), "createInterface")
        .mockReturnValueOnce(mockRl);

      // Clear module cache to get fresh instance
      jest.resetModules();
      jest.mock("../cli/agent", () => ({
        processInput: jest.fn().mockResolvedValue(undefined),
        clearConversation: jest.fn(),
        getConversationLength: jest.fn().mockReturnValue(0),
        getConversationMessages: jest.fn().mockReturnValue([
          { role: "user", content: "test" },
          { role: "assistant", content: "reply" },
        ]),
        setConversationMessages: jest.fn(),
        setAbortSignalGetter: jest.fn(),
        invalidateSystemPromptCache: jest.fn(),
        setMaxIterations: jest.fn(),
      }));
      jest.mock("../cli/context-engine", () => ({
        getUsage: jest.fn().mockReturnValue({
          used: 1500,
          limit: 128000,
          percentage: 1.2,
          breakdown: {
            system: 500,
            conversation: 800,
            toolResults: 100,
            toolDefinitions: 100,
          },
          messageCount: 5,
        }),
      }));
      jest.mock("../cli/tools", () => ({
        TOOL_DEFINITIONS: [],
        setAskUserHandler: jest.fn(),
        cancelPendingAskUser: jest.fn(),
      }));
      jest.mock("../cli/session", () => ({
        saveSession: jest
          .fn()
          .mockReturnValue({ path: "/tmp/test.json", name: "test" }),
        loadSession: jest.fn().mockImplementation((name) => {
          if (name === "my-session")
            return {
              name: "my-session",
              messageCount: 3,
              messages: [{ role: "user", content: "hi" }],
            };
          return null;
        }),
        listSessions: jest.fn().mockReturnValue([
          {
            name: "session-1",
            updatedAt: "2025-06-01T00:00:00Z",
            messageCount: 5,
          },
          {
            name: "_autosave",
            updatedAt: "2025-06-02T00:00:00Z",
            messageCount: 8,
          },
        ]),
        getLastSession: jest.fn().mockReturnValue({
          name: "_autosave",
          messageCount: 8,
          messages: [{ role: "user", content: "last" }],
        }),
        deleteSession: jest.fn().mockReturnValue(true),
      }));
      jest.mock("../cli/memory", () => ({
        remember: jest.fn(),
        forget: jest.fn().mockImplementation((key) => key === "existing-key"),
        listMemories: jest.fn().mockReturnValue([
          {
            key: "lang",
            value: "TypeScript",
            updatedAt: "2025-06-01T00:00:00Z",
          },
        ]),
      }));
      jest.mock("../cli/permissions", () => ({
        listPermissions: jest.fn().mockReturnValue([
          { tool: "bash", mode: "ask" },
          { tool: "read_file", mode: "allow" },
        ]),
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
      }));
      jest.mock("../cli/git", () => ({
        isGitRepo: jest.fn().mockReturnValue(true),
        getCurrentBranch: jest.fn().mockReturnValue("main"),
        formatDiffSummary: jest.fn().mockReturnValue("No changes"),
        analyzeDiff: jest.fn().mockReturnValue(null),
        commit: jest.fn().mockReturnValue(null),
        createBranch: jest.fn().mockReturnValue("feat/test-branch"),
      }));
      jest.mock("../cli/mcp", () => ({
        listServers: jest.fn().mockReturnValue([]),
        connectAll: jest.fn().mockResolvedValue([]),
        disconnectAll: jest.fn(),
      }));
      jest.mock("../cli/hooks", () => ({
        listHooks: jest.fn().mockReturnValue([]),
        runHooks: jest.fn().mockReturnValue([]),
        HOOK_EVENTS: [
          "pre-tool",
          "post-tool",
          "pre-commit",
          "post-response",
          "session-start",
          "session-end",
        ],
      }));
      jest.mock("../cli/ollama", () => ({
        getActiveModel: jest.fn().mockReturnValue({
          id: "kimi-k2.5",
          name: "Kimi K2.5",
          provider: "ollama",
        }),
        setActiveModel: jest
          .fn()
          .mockImplementation(
            (name) => name === "qwen3-coder:480b" || name === "openai:gpt-4o",
          ),
        getModelNames: jest
          .fn()
          .mockReturnValue(["kimi-k2.5", "qwen3-coder:480b"]),
      }));
      jest.mock("../cli/providers/registry", () => ({
        listProviders: jest.fn().mockReturnValue([
          {
            provider: "ollama",
            configured: true,
            models: [
              { id: "kimi-k2.5", name: "Kimi K2.5", active: true },
              { id: "qwen3-coder:480b", name: "Qwen3 Coder", active: false },
            ],
          },
          {
            provider: "openai",
            configured: false,
            models: [{ id: "gpt-4o", name: "GPT-4o", active: false }],
          },
        ]),
        getActiveProviderName: jest.fn().mockReturnValue("ollama"),
        getActiveModel: jest.fn().mockReturnValue({
          id: "kimi-k2.5",
          name: "Kimi K2.5",
          provider: "ollama",
        }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock("../cli/costs", () => ({
        formatCosts: jest
          .fn()
          .mockReturnValue("No token usage recorded this session."),
        resetCosts: jest.fn(),
      }));
      jest.mock("../cli/context", () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn().mockReturnValue(""),
      }));
      jest.mock("../cli/safety", () => ({
        confirm: jest.fn().mockResolvedValue(true),
        setAutoConfirm: jest.fn(),
        getAutoConfirm: jest.fn().mockReturnValue(false),
        setReadlineInterface: jest.fn(),
        setAllowAlwaysHandler: jest.fn(),
      }));
      jest.mock("../cli/skills", () => ({
        loadAllSkills: jest.fn().mockReturnValue([]),
        listSkills: jest.fn().mockReturnValue([]),
        enableSkill: jest.fn().mockReturnValue(false),
        disableSkill: jest.fn().mockReturnValue(false),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn().mockReturnValue(false),
        matchSkillTriggers: jest.fn().mockReturnValue([]),
      }));

      const { startREPL } = require("../cli/index");
      startREPL();
    });

    afterEach(() => {
      delete process.env.OLLAMA_API_KEY;
    });

    it("handles /help command", async () => {
      await lineHandler("/help");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("/help");
      expect(output).toContain("/model");
      expect(output).toContain("/clear");
      expect(output).toContain("/providers");
    });

    it("handles /model without args (shows picker)", async () => {
      await lineHandler("/model");
      const { showModelPicker } = require("../cli/picker");
      expect(showModelPicker).toHaveBeenCalled();
    });

    it("handles /model with valid name", async () => {
      const { setActiveModel } = require("../cli/ollama");
      setActiveModel.mockReturnValueOnce(true);
      await lineHandler("/model qwen3-coder:480b");
      expect(setActiveModel).toHaveBeenCalledWith("qwen3-coder:480b");
    });

    it("handles /model with provider:model format", async () => {
      const { setActiveModel } = require("../cli/ollama");
      setActiveModel.mockReturnValueOnce(true);
      await lineHandler("/model openai:gpt-4o");
      expect(setActiveModel).toHaveBeenCalledWith("openai:gpt-4o");
    });

    it("handles /model with invalid name", async () => {
      const { setActiveModel } = require("../cli/ollama");
      setActiveModel.mockReturnValueOnce(false);
      await lineHandler("/model invalid");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Unknown model");
    });

    it("handles /model list", async () => {
      await lineHandler("/model list");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ollama");
    });

    it("handles /providers command", async () => {
      await lineHandler("/providers");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("ollama");
      expect(output).toContain("openai");
    });

    it("handles /tokens command", async () => {
      await lineHandler("/tokens");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Token Usage");
      expect(output).toContain("128k context");
    });

    it("handles /clear command and clears history", async () => {
      const { clearConversation } = require("../cli/agent");
      const { clearHistory } = require("../cli/file-history");
      await lineHandler("/clear");
      expect(clearConversation).toHaveBeenCalled();
      expect(clearHistory).toHaveBeenCalled();
    });

    it("handles /undo with nothing to undo", async () => {
      await lineHandler("/undo");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Nothing to undo");
    });

    it("handles /undo with successful undo", async () => {
      const fh = require("../cli/file-history");
      fh.undo.mockReturnValueOnce({
        tool: "edit_file",
        filePath: "/tmp/x.js",
        wasCreated: false,
      });
      fh.getUndoCount.mockReturnValueOnce(2);
      await lineHandler("/undo");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Undone");
      expect(output).toContain("restored");
      expect(output).toContain("/tmp/x.js");
    });

    it("handles /undo for newly created file", async () => {
      const fh = require("../cli/file-history");
      fh.undo.mockReturnValueOnce({
        tool: "write_file",
        filePath: "/tmp/new.js",
        wasCreated: true,
      });
      await lineHandler("/undo");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("deleted");
    });

    it("handles /redo with nothing to redo", async () => {
      await lineHandler("/redo");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Nothing to redo");
    });

    it("handles /redo with successful redo", async () => {
      const fh = require("../cli/file-history");
      fh.redo.mockReturnValueOnce({ tool: "edit_file", filePath: "/tmp/x.js" });
      fh.getRedoCount.mockReturnValueOnce(1);
      await lineHandler("/redo");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Redone");
    });

    it("handles /history with no changes", async () => {
      await lineHandler("/history");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No file changes");
    });

    it("handles /history with entries", async () => {
      const fh = require("../cli/file-history");
      fh.getHistory.mockReturnValueOnce([
        { tool: "edit_file", filePath: "/tmp/a.js", timestamp: Date.now() },
        { tool: "write_file", filePath: "/tmp/b.js", timestamp: Date.now() },
      ]);
      fh.getUndoCount.mockReturnValueOnce(2);
      fh.getRedoCount.mockReturnValueOnce(0);
      await lineHandler("/history");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("File Change History");
      expect(output).toContain("edit_file");
      expect(output).toContain("write_file");
    });

    it("handles /context command", async () => {
      const { printContext } = require("../cli/context");
      await lineHandler("/context");
      expect(printContext).toHaveBeenCalled();
    });

    it("handles /autoconfirm toggle", async () => {
      const { setAutoConfirm } = require("../cli/safety");
      await lineHandler("/autoconfirm");
      expect(setAutoConfirm).toHaveBeenCalled();
    });

    it("handles /exit command", async () => {
      await lineHandler("/exit");
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("handles /quit command", async () => {
      await lineHandler("/quit");
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("handles unknown slash command", async () => {
      await lineHandler("/unknown");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Unknown command");
    });

    it("skips empty input", async () => {
      const { processInput } = require("../cli/agent");
      await lineHandler("");
      expect(processInput).not.toHaveBeenCalled();
    });

    it("sends non-command input to agent", async () => {
      const { processInput } = require("../cli/agent");
      await lineHandler("write a function");
      expect(processInput).toHaveBeenCalledWith("write a function");
    });

    it("handles readline close", () => {
      closeHandler();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    // ─── Session commands ───────────────────────────────
    it("handles /save command", async () => {
      const { saveSession } = require("../cli/session");
      await lineHandler("/save my-backup");
      expect(saveSession).toHaveBeenCalledWith(
        "my-backup",
        expect.any(Array),
        expect.objectContaining({ model: "kimi-k2.5", provider: "ollama" }),
      );
    });

    it("handles /save without name (generates timestamp)", async () => {
      const { saveSession } = require("../cli/session");
      await lineHandler("/save");
      expect(saveSession).toHaveBeenCalled();
      const name = saveSession.mock.calls[0][0];
      expect(name).toMatch(/^session-\d+$/);
    });

    it("handles /save with empty conversation", async () => {
      // Override getConversationMessages to return empty
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([]);
      await lineHandler("/save test");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No conversation");
    });

    it("handles /load with valid session", async () => {
      const { setConversationMessages } = require("../cli/agent");
      await lineHandler("/load my-session");
      expect(setConversationMessages).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Loaded session");
    });

    it("handles /load with non-existent session", async () => {
      await lineHandler("/load nonexistent");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Session not found");
    });

    it("handles /load without name", async () => {
      await lineHandler("/load");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("handles /sessions command", async () => {
      await lineHandler("/sessions");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("session-1");
      expect(output).toContain("_autosave");
    });

    it("handles /resume command", async () => {
      const { setConversationMessages } = require("../cli/agent");
      await lineHandler("/resume");
      expect(setConversationMessages).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Resumed");
    });

    // ─── Memory commands ────────────────────────────────
    it("handles /remember with key=value", async () => {
      const { remember } = require("../cli/memory");
      await lineHandler("/remember lang=TypeScript");
      expect(remember).toHaveBeenCalledWith("lang", "TypeScript");
    });

    it("handles /remember with freeform text", async () => {
      const { remember } = require("../cli/memory");
      await lineHandler("/remember always use yarn");
      expect(remember).toHaveBeenCalled();
      const [key, value] = remember.mock.calls[0];
      expect(value).toBe("always use yarn");
    });

    it("handles /remember without text", async () => {
      await lineHandler("/remember");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("handles /forget with existing key", async () => {
      await lineHandler("/forget existing-key");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Forgotten");
    });

    it("handles /forget with non-existent key", async () => {
      await lineHandler("/forget nope");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not found");
    });

    it("handles /forget without key", async () => {
      await lineHandler("/forget");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("handles /memory command", async () => {
      await lineHandler("/memory");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("lang");
      expect(output).toContain("TypeScript");
    });

    // ─── Permission commands ────────────────────────────
    it("handles /permissions command", async () => {
      await lineHandler("/permissions");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("bash");
      expect(output).toContain("ask");
    });

    it("handles /allow command", async () => {
      const { setPermission, savePermissions } = require("../cli/permissions");
      await lineHandler("/allow bash");
      expect(setPermission).toHaveBeenCalledWith("bash", "allow");
      expect(savePermissions).toHaveBeenCalled();
    });

    it("handles /deny command", async () => {
      const { setPermission, savePermissions } = require("../cli/permissions");
      await lineHandler("/deny bash");
      expect(setPermission).toHaveBeenCalledWith("bash", "deny");
      expect(savePermissions).toHaveBeenCalled();
    });

    it("handles /allow without tool name", async () => {
      await lineHandler("/allow");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("handles /deny without tool name", async () => {
      await lineHandler("/deny");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    // ─── Plan commands ──────────────────────────────────
    it("handles /plan command (enter plan mode)", async () => {
      const { setPlanMode } = require("../cli/planner");
      await lineHandler("/plan");
      expect(setPlanMode).toHaveBeenCalledWith(true);
    });

    it("handles /plan with task description", async () => {
      const { setPlanMode } = require("../cli/planner");
      await lineHandler("/plan refactor auth module");
      expect(setPlanMode).toHaveBeenCalledWith(true);
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("PLAN MODE");
    });

    it("handles /plan status", async () => {
      const { formatPlan } = require("../cli/planner");
      await lineHandler("/plan status");
      expect(formatPlan).toHaveBeenCalled();
    });

    it("handles /plan approve with no plan", async () => {
      await lineHandler("/plan approve");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No plan");
    });

    it("handles /plans command", async () => {
      await lineHandler("/plans");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No saved plans");
    });

    it("handles /auto without level", async () => {
      await lineHandler("/auto");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("interactive");
    });

    it("handles /auto with valid level", async () => {
      const { setAutonomyLevel } = require("../cli/planner");
      await lineHandler("/auto semi-auto");
      expect(setAutonomyLevel).toHaveBeenCalledWith("semi-auto");
    });

    it("handles /auto with invalid level", async () => {
      const { setAutonomyLevel } = require("../cli/planner");
      setAutonomyLevel.mockReturnValueOnce(false);
      await lineHandler("/auto invalid");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Unknown level");
    });

    // ─── Git commands ───────────────────────────────────
    it("handles /diff command", async () => {
      const { formatDiffSummary } = require("../cli/git");
      await lineHandler("/diff");
      expect(formatDiffSummary).toHaveBeenCalled();
    });

    it("handles /branch without name", async () => {
      await lineHandler("/branch");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("main");
    });

    it("handles /branch with name", async () => {
      const { createBranch } = require("../cli/git");
      await lineHandler("/branch add new feature");
      expect(createBranch).toHaveBeenCalledWith("add new feature");
    });

    it("handles /commit without changes", async () => {
      await lineHandler("/commit");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No changes");
    });

    it("handles /commit with message", async () => {
      const { commit } = require("../cli/git");
      commit.mockReturnValueOnce("abc1234");
      await lineHandler("/commit fix: bug fix");
      expect(commit).toHaveBeenCalledWith("fix: bug fix");
    });

    // ─── MCP commands ──────────────────────────────────
    it("handles /mcp command (no servers)", async () => {
      await lineHandler("/mcp");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No MCP servers configured");
    });

    it("handles /mcp disconnect", async () => {
      const { disconnectAll } = require("../cli/mcp");
      await lineHandler("/mcp disconnect");
      expect(disconnectAll).toHaveBeenCalled();
    });

    // ─── Hooks commands ────────────────────────────────
    it("handles /hooks command (no hooks)", async () => {
      await lineHandler("/hooks");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No hooks configured");
    });

    // ─── Costs commands ─────────────────────────────────
    it("handles /costs command", async () => {
      await lineHandler("/costs");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No token usage");
    });

    it("handles /costs reset", async () => {
      const { resetCosts } = require("../cli/costs");
      await lineHandler("/costs reset");
      expect(resetCosts).toHaveBeenCalled();
    });

    // ─── Fallback commands ──────────────────────────────
    it("handles /fallback without args (no chain)", async () => {
      await lineHandler("/fallback");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No fallback chain");
    });

    it("handles /fallback with chain", async () => {
      const { setFallbackChain } = require("../cli/providers/registry");
      await lineHandler("/fallback anthropic,openai,local");
      expect(setFallbackChain).toHaveBeenCalledWith([
        "anthropic",
        "openai",
        "local",
      ]);
    });

    // ─── Additional session commands ────────────────────
    it("handles /sessions with empty list", async () => {
      const session = require("../cli/session");
      session.listSessions.mockReturnValueOnce([]);
      await lineHandler("/sessions");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No saved sessions");
    });

    it("handles /resume with no session", async () => {
      const session = require("../cli/session");
      session.getLastSession.mockReturnValueOnce(null);
      await lineHandler("/resume");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No session");
    });

    // ─── Additional memory commands ─────────────────────
    it("handles /memory with empty list", async () => {
      const memory = require("../cli/memory");
      memory.listMemories.mockReturnValueOnce([]);
      await lineHandler("/memory");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No memories");
    });

    // ─── Additional plan commands ───────────────────────
    it("handles /plan approve with active plan", async () => {
      const planner = require("../cli/planner");
      planner.approvePlan.mockReturnValueOnce(true);
      await lineHandler("/plan approve");
      expect(planner.startExecution).toHaveBeenCalled();
      expect(planner.setPlanMode).toHaveBeenCalledWith(false);
    });

    it("handles /plans with saved plans", async () => {
      const planner = require("../cli/planner");
      planner.listPlans.mockReturnValueOnce([
        { name: "plan-1", task: "refactor", steps: 3, status: "completed" },
        { name: "plan-2", task: "feature", steps: 5, status: "executing" },
      ]);
      await lineHandler("/plans");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("plan-1");
      expect(output).toContain("plan-2");
    });

    // ─── Additional git commands ────────────────────────
    it("handles /commit when commit succeeds", async () => {
      const git = require("../cli/git");
      git.commit.mockReturnValueOnce("abc1234");
      await lineHandler("/commit feat: add feature");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("abc1234");
    });

    it("handles /commit when commit fails", async () => {
      const git = require("../cli/git");
      git.commit.mockReturnValueOnce(null);
      await lineHandler("/commit test message");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Commit failed");
    });

    it("handles /branch creation failure", async () => {
      const git = require("../cli/git");
      git.createBranch.mockReturnValueOnce(null);
      await lineHandler("/branch broken-branch");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Failed to create branch");
    });

    it("handles /diff not in git repo", async () => {
      const git = require("../cli/git");
      git.isGitRepo.mockReturnValueOnce(false);
      await lineHandler("/diff");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Not a git repository");
    });

    it("handles /commit not in git repo", async () => {
      const git = require("../cli/git");
      git.isGitRepo.mockReturnValueOnce(false);
      await lineHandler("/commit test");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Not a git repository");
    });

    it("handles /branch not in git repo", async () => {
      const git = require("../cli/git");
      git.isGitRepo.mockReturnValueOnce(false);
      await lineHandler("/branch test");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Not a git repository");
    });

    // ─── MCP commands extended ──────────────────────────
    it("handles /mcp connect", async () => {
      const mcp = require("../cli/mcp");
      mcp.connectAll.mockResolvedValueOnce([
        { name: "server1", tools: 3 },
        { name: "server2", tools: 0, error: "Connection failed" },
      ]);
      await lineHandler("/mcp connect");
      // Need to wait for async .then()
      await new Promise((r) => setTimeout(r, 10));
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("server1");
    });

    it("handles /mcp with servers configured", async () => {
      const mcp = require("../cli/mcp");
      mcp.listServers.mockReturnValueOnce([
        { name: "test-srv", command: "node", connected: true, toolCount: 5 },
      ]);
      await lineHandler("/mcp");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("test-srv");
      expect(output).toContain("connected");
    });

    // ─── Hooks with hooks configured ────────────────────
    it("handles /hooks with hooks configured", async () => {
      const hooks = require("../cli/hooks");
      hooks.listHooks.mockReturnValueOnce([
        { event: "pre-tool", commands: ['echo "before"'] },
        { event: "post-tool", commands: ['echo "after"'] },
      ]);
      await lineHandler("/hooks");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("pre-tool");
      expect(output).toContain("post-tool");
    });

    // ─── Agent error handling ───────────────────────────
    it("handles agent processInput error", async () => {
      const agent = require("../cli/agent");
      agent.processInput.mockRejectedValueOnce(new Error("Provider error"));
      await lineHandler("do something");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Provider error");
    });

    // ─── /commit with smart commit flow ─────────────────
    it("handles /commit smart commit with changes", async () => {
      const git = require("../cli/git");
      git.analyzeDiff.mockReturnValueOnce({
        files: 3,
        additions: 10,
        deletions: 5,
      });
      git.formatDiffSummary.mockReturnValueOnce("3 files changed");
      await lineHandler("/commit");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("3 files changed");
    });

    // ─── Skills commands ─────────────────────────────────
    it("handles /skills with no skills loaded", async () => {
      await lineHandler("/skills");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No skills loaded");
    });

    it("handles /skills with skills loaded", async () => {
      const skills = require("../cli/skills");
      skills.listSkills.mockReturnValueOnce([
        {
          name: "test-skill",
          enabled: true,
          type: "prompt",
          commands: 2,
          tools: 0,
        },
        {
          name: "other-skill",
          enabled: false,
          type: "script",
          commands: 0,
          tools: 3,
        },
      ]);
      await lineHandler("/skills");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("test-skill");
      expect(output).toContain("other-skill");
      expect(output).toContain("prompt");
      expect(output).toContain("script");
    });

    it("handles /skills enable with found skill", async () => {
      const skills = require("../cli/skills");
      skills.enableSkill.mockReturnValueOnce(true);
      await lineHandler("/skills enable my-skill");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Skill enabled");
      expect(output).toContain("my-skill");
    });

    it("handles /skills enable with not found skill", async () => {
      const skills = require("../cli/skills");
      skills.enableSkill.mockReturnValueOnce(false);
      await lineHandler("/skills enable nonexistent");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Skill not found");
    });

    it("handles /skills disable with found skill", async () => {
      const skills = require("../cli/skills");
      skills.disableSkill.mockReturnValueOnce(true);
      await lineHandler("/skills disable my-skill");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Skill disabled");
    });

    it("handles /skills disable with not found skill", async () => {
      const skills = require("../cli/skills");
      skills.disableSkill.mockReturnValueOnce(false);
      await lineHandler("/skills disable nonexistent");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Skill not found");
    });

    // ─── Fallback with chain ─────────────────────────────
    it("handles /fallback with existing chain", async () => {
      const registry = require("../cli/providers/registry");
      registry.getFallbackChain.mockReturnValueOnce(["anthropic", "openai"]);
      await lineHandler("/fallback");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Fallback chain");
      expect(output).toContain("→");
    });

    // ─── MCP connect empty results ──────────────────────
    it("handles /mcp connect with no servers configured", async () => {
      const mcp = require("../cli/mcp");
      mcp.connectAll.mockResolvedValueOnce([]);
      await lineHandler("/mcp connect");
      await new Promise((r) => setTimeout(r, 10));
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No MCP servers configured");
    });

    // ─── Unknown command / skill fallback ────────────────
    it("handles unknown command with skill fallback", async () => {
      const skills = require("../cli/skills");
      skills.handleSkillCommand.mockReturnValueOnce(false);
      await lineHandler("/unknowncmd");
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Unknown command");
    });

    it("handles unknown command delegated to skill", async () => {
      const skills = require("../cli/skills");
      skills.handleSkillCommand.mockReturnValueOnce(true);
      await lineHandler("/customskill");
      // No "Unknown command" output since skill handled it
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).not.toContain("Unknown command");
    });

    // ─── Message count display ───────────────────────────
    it("shows message count after agent interaction", async () => {
      const agent = require("../cli/agent");
      agent.getConversationLength.mockReturnValue(5);
      await lineHandler("test input");
      const output = writeSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("5 messages");
    });
  });

  // ─── Exported utility functions ─────────────────────────────
  describe("getPrompt()", () => {
    it("includes provider and model", () => {
      jest.resetModules();
      jest.mock("../cli/planner", () => ({
        createPlan: jest.fn(),
        getActivePlan: jest.fn(),
        setPlanMode: jest.fn(),
        isPlanMode: jest.fn().mockReturnValue(false),
        approvePlan: jest.fn(),
        startExecution: jest.fn(),
        formatPlan: jest.fn(),
        savePlan: jest.fn(),
        listPlans: jest.fn(),
        clearPlan: jest.fn(),
        setAutonomyLevel: jest.fn(),
        getAutonomyLevel: jest.fn().mockReturnValue("interactive"),
        AUTONOMY_LEVELS: ["interactive", "semi-auto", "autonomous"],
      }));
      jest.mock("../cli/providers/registry", () => ({
        listProviders: jest.fn().mockReturnValue([]),
        getActiveProviderName: jest.fn().mockReturnValue("ollama"),
        getActiveModel: jest.fn().mockReturnValue({
          id: "kimi-k2.5",
          name: "Kimi K2.5",
          provider: "ollama",
        }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock("../cli/ollama", () => ({
        getActiveModel: jest.fn().mockReturnValue({ id: "kimi-k2.5" }),
        setActiveModel: jest.fn(),
        getModelNames: jest.fn().mockReturnValue([]),
      }));
      jest.mock("../cli/agent", () => ({
        processInput: jest.fn(),
        clearConversation: jest.fn(),
        getConversationLength: jest.fn().mockReturnValue(0),
        getConversationMessages: jest.fn().mockReturnValue([]),
        setConversationMessages: jest.fn(),
        setAbortSignalGetter: jest.fn(),
        invalidateSystemPromptCache: jest.fn(),
        setMaxIterations: jest.fn(),
      }));
      jest.mock("../cli/context-engine", () => ({ getUsage: jest.fn() }));
      jest.mock("../cli/tools", () => ({
        TOOL_DEFINITIONS: [],
        setAskUserHandler: jest.fn(),
        cancelPendingAskUser: jest.fn(),
      }));
      jest.mock("../cli/session", () => ({
        saveSession: jest.fn(),
        loadSession: jest.fn(),
        listSessions: jest.fn(),
        getLastSession: jest.fn(),
        deleteSession: jest.fn(),
      }));
      jest.mock("../cli/memory", () => ({
        remember: jest.fn(),
        forget: jest.fn(),
        listMemories: jest.fn(),
      }));
      jest.mock("../cli/permissions", () => ({
        listPermissions: jest.fn(),
        setPermission: jest.fn(),
        savePermissions: jest.fn(),
      }));
      jest.mock("../cli/git", () => ({
        isGitRepo: jest.fn(),
        getCurrentBranch: jest.fn(),
        formatDiffSummary: jest.fn(),
        analyzeDiff: jest.fn(),
        commit: jest.fn(),
        createBranch: jest.fn(),
      }));
      jest.mock("../cli/mcp", () => ({
        listServers: jest.fn(),
        connectAll: jest.fn(),
        disconnectAll: jest.fn(),
      }));
      jest.mock("../cli/hooks", () => ({
        listHooks: jest.fn(),
        runHooks: jest.fn(),
        HOOK_EVENTS: [],
      }));
      jest.mock("../cli/costs", () => ({
        formatCosts: jest.fn(),
        resetCosts: jest.fn(),
      }));
      jest.mock("../cli/context", () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn(),
      }));
      // safety mock removed - using top-level mock
      jest.mock("../cli/skills", () => ({
        loadAllSkills: jest.fn(),
        listSkills: jest.fn(),
        enableSkill: jest.fn(),
        disableSkill: jest.fn(),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn(),
        matchSkillTriggers: jest.fn().mockReturnValue([]),
      }));

      const { getPrompt } = require("../cli/index");
      const prompt = getPrompt();
      // Model is now shown in footer status bar, not in prompt
      expect(prompt).toContain("›");
    });
  });

  // ─── Bracketed Paste Helpers ───────────────────────────────
  describe("hasPasteStart()", () => {
    it("detects paste start sequence", () => {
      expect(hasPasteStart("\x1b[200~hello")).toBe(true);
    });

    it("returns false for normal text", () => {
      expect(hasPasteStart("hello world")).toBe(false);
    });

    it("returns false for non-string", () => {
      expect(hasPasteStart(null)).toBe(false);
      expect(hasPasteStart(undefined)).toBe(false);
      expect(hasPasteStart(42)).toBe(false);
    });
  });

  describe("hasPasteEnd()", () => {
    it("detects paste end sequence", () => {
      expect(hasPasteEnd("hello\x1b[201~")).toBe(true);
    });

    it("returns false for normal text", () => {
      expect(hasPasteEnd("hello world")).toBe(false);
    });

    it("returns false for non-string", () => {
      expect(hasPasteEnd(null)).toBe(false);
      expect(hasPasteEnd(undefined)).toBe(false);
    });
  });

  describe("stripPasteSequences()", () => {
    it("strips paste start sequence", () => {
      expect(stripPasteSequences("\x1b[200~hello")).toBe("hello");
    });

    it("strips paste end sequence", () => {
      expect(stripPasteSequences("hello\x1b[201~")).toBe("hello");
    });

    it("strips both sequences", () => {
      expect(stripPasteSequences("\x1b[200~hello world\x1b[201~")).toBe(
        "hello world",
      );
    });

    it("returns original string when no sequences", () => {
      expect(stripPasteSequences("normal text")).toBe("normal text");
    });

    it("returns non-string input unchanged", () => {
      expect(stripPasteSequences(null)).toBe(null);
      expect(stripPasteSequences(42)).toBe(42);
    });

    it("handles empty string", () => {
      expect(stripPasteSequences("")).toBe("");
    });

    it("handles multiple paste sequences", () => {
      const input = "\x1b[200~line1\x1b[201~\x1b[200~line2\x1b[201~";
      expect(stripPasteSequences(input)).toBe("line1line2");
    });
  });

  // ─── handleSlashCommand direct tests ──────────────────────────
  describe("handleSlashCommand() — direct", () => {
    let logSpy2, writeSpy2;

    beforeEach(() => {
      logSpy2 = jest.spyOn(console, "log").mockImplementation(() => {});
      writeSpy2 = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => {});

      // After jest.resetModules() in previous test blocks, module caches are cleared.
      // Patch missing functions directly on lazy-required mock modules.
      const costs = require("../cli/costs");
      costs.getCostLimits =
        costs.getCostLimits || jest.fn().mockReturnValue({});
      costs.getProviderSpend =
        costs.getProviderSpend || jest.fn().mockReturnValue(0);
      costs.checkBudget =
        costs.checkBudget ||
        jest.fn().mockReturnValue({ limit: null, spent: 0, remaining: 0 });
      costs.removeCostLimit = costs.removeCostLimit || jest.fn();
      costs.saveCostLimits = costs.saveCostLimits || jest.fn();
      costs.setCostLimit = costs.setCostLimit || jest.fn();
      if (costs.getCostLimits.mockReturnValue)
        costs.getCostLimits.mockReturnValue({});
      if (costs.getProviderSpend.mockReturnValue)
        costs.getProviderSpend.mockReturnValue(0);
      if (costs.checkBudget.mockReturnValue)
        costs.checkBudget.mockReturnValue({
          limit: null,
          spent: 0,
          remaining: 0,
        });

      const skills = require("../cli/skills");
      skills.installSkill =
        skills.installSkill ||
        jest.fn().mockResolvedValue({ ok: true, name: "test-skill" });
      skills.searchSkills =
        skills.searchSkills || jest.fn().mockResolvedValue([]);
      skills.removeSkill =
        skills.removeSkill || jest.fn().mockReturnValue({ ok: true });
      if (skills.installSkill.mockResolvedValue)
        skills.installSkill.mockResolvedValue({ ok: true, name: "test-skill" });
      if (skills.searchSkills.mockResolvedValue)
        skills.searchSkills.mockResolvedValue([]);
      if (skills.removeSkill.mockReturnValue)
        skills.removeSkill.mockReturnValue({ ok: true });

      const planner = require("../cli/planner");
      planner.setPlanContent = planner.setPlanContent || jest.fn();
      planner.getPlanContent =
        planner.getPlanContent || jest.fn().mockReturnValue(null);
      planner.extractStepsFromText =
        planner.extractStepsFromText || jest.fn().mockReturnValue([]);

      const contextEngine = require("../cli/context-engine");
      contextEngine.getUsage = contextEngine.getUsage || jest.fn();
      contextEngine.getUsage.mockReturnValue({
        used: 1500,
        limit: 128000,
        percentage: 1.2,
        breakdown: {
          system: 500,
          conversation: 800,
          toolResults: 100,
          toolDefinitions: 100,
        },
        messageCount: 5,
      });

      const git = require("../cli/git");
      git.getDiff = git.getDiff || jest.fn().mockResolvedValue("");
      if (git.getDiff.mockResolvedValue) git.getDiff.mockResolvedValue("");

      const tools = require("../cli/tools");
      tools.executeTool =
        tools.executeTool || jest.fn().mockResolvedValue("Deploy output");

      const context = require("../cli/context");
      context.generateFileTree =
        context.generateFileTree ||
        jest.fn().mockReturnValue("src/\n  index.js\n  app.js");

      const memory = require("../cli/memory");
      memory.listMemories =
        memory.listMemories || jest.fn().mockReturnValue([]);
      if (memory.listMemories.mockReturnValue)
        memory.listMemories.mockReturnValue([]);
    });

    afterEach(() => {
      logSpy2.mockRestore();
      writeSpy2.mockRestore();
      jest.clearAllMocks();
    });

    // ─── /audit ───────────────────────────────────────────
    it("/audit shows audit summary when enabled", async () => {
      await handleSlashCommand("/audit");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Audit Summary");
      expect(output).toContain("42");
      expect(output).toContain("150");
      expect(output).toContain("bash");
    });

    it("/audit with days argument", async () => {
      await handleSlashCommand("/audit 7");
      const { getAuditSummary } = require("../cli/audit");
      expect(getAuditSummary).toHaveBeenCalledWith(7);
    });

    it("/audit shows disabled message when audit is off", async () => {
      const audit = require("../cli/audit");
      audit.isAuditEnabled.mockReturnValueOnce(false);
      await handleSlashCommand("/audit");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("disabled");
    });

    // ─── /benchmark ───────────────────────────────────────
    it("/benchmark --history runs without throwing", async () => {
      // The output depends on whether the results dir exists on the current machine.
      // We just verify the command completes and prints something to the console.
      await expect(
        handleSlashCommand("/benchmark --history"),
      ).resolves.not.toThrow();
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output.length).toBeGreaterThan(0);
    });

    // ─── /install-skill ───────────────────────────────────
    it("/install-skill without URL shows usage", async () => {
      await handleSlashCommand("/install-skill");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/install-skill with URL installs skill", async () => {
      await handleSlashCommand("/install-skill https://github.com/user/skill");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("installed successfully");
      expect(output).toContain("test-skill");
    });

    it("/install-skill shows error on failure", async () => {
      const skills = require("../cli/skills");
      skills.installSkill.mockResolvedValueOnce({
        ok: false,
        error: "clone failed",
      });
      await handleSlashCommand("/install-skill bad-url");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Failed");
      expect(output).toContain("clone failed");
    });

    // ─── /search-skill ────────────────────────────────────
    it("/search-skill without query shows usage", async () => {
      await handleSlashCommand("/search-skill");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/search-skill with no results", async () => {
      await handleSlashCommand("/search-skill foobar");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No skills found");
    });

    it("/search-skill with results", async () => {
      const skills = require("../cli/skills");
      skills.searchSkills.mockResolvedValueOnce([
        {
          name: "cool-skill",
          owner: "user1",
          stars: 42,
          description: "A cool skill",
          url: "https://github.com/user1/cool-skill",
        },
      ]);
      await handleSlashCommand("/search-skill cool");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("cool-skill");
      expect(output).toContain("user1");
      expect(output).toContain("42");
    });

    it("/search-skill with error result", async () => {
      const skills = require("../cli/skills");
      skills.searchSkills.mockResolvedValueOnce([
        { name: "error", description: "GitHub API rate limit exceeded" },
      ]);
      await handleSlashCommand("/search-skill test");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("GitHub API rate limit exceeded");
    });

    // ─── /remove-skill ────────────────────────────────────
    it("/remove-skill without name shows usage", async () => {
      await handleSlashCommand("/remove-skill");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/remove-skill with valid name", async () => {
      await handleSlashCommand("/remove-skill my-skill");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("removed");
    });

    it("/remove-skill with invalid name", async () => {
      const skills = require("../cli/skills");
      skills.removeSkill.mockReturnValueOnce({
        ok: false,
        error: "Skill not found",
      });
      await handleSlashCommand("/remove-skill nonexist");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Skill not found");
    });

    // ─── /servers ─────────────────────────────────────────
    it("/servers with no servers configured", async () => {
      await handleSlashCommand("/servers");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No servers configured");
    });

    it("/servers lists configured servers", async () => {
      const ssh = require("../cli/ssh");
      ssh.loadServerProfiles.mockReturnValueOnce({
        prod: { host: "1.2.3.4", user: "admin", os: "ubuntu" },
      });
      await handleSlashCommand("/servers");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("prod");
      expect(output).toContain("Configured servers");
    });

    it("/servers ping checks connectivity", async () => {
      const ssh = require("../cli/ssh");
      ssh.loadServerProfiles.mockReturnValueOnce({
        prod: { host: "1.2.3.4", user: "admin" },
      });
      ssh.sshExec.mockResolvedValueOnce({
        stdout: "ok",
        stderr: "",
        exitCode: 0,
      });
      await handleSlashCommand("/servers ping");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Server connectivity");
    });

    it("/servers ping with unknown profile", async () => {
      const ssh = require("../cli/ssh");
      ssh.loadServerProfiles.mockReturnValueOnce({
        prod: { host: "1.2.3.4", user: "admin" },
      });
      await handleSlashCommand("/servers ping unknown");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("unknown profile");
    });

    it("/servers ping with SSH failure", async () => {
      const ssh = require("../cli/ssh");
      ssh.loadServerProfiles.mockReturnValueOnce({
        prod: { host: "1.2.3.4", user: "admin" },
      });
      ssh.sshExec.mockResolvedValueOnce({
        stdout: "",
        stderr: "err",
        exitCode: 1,
      });
      await handleSlashCommand("/servers ping prod");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("SSH failed");
    });

    it("/servers ping with SSH exception", async () => {
      const ssh = require("../cli/ssh");
      ssh.loadServerProfiles.mockReturnValueOnce({
        prod: { host: "1.2.3.4", user: "admin" },
      });
      ssh.sshExec.mockRejectedValueOnce(new Error("Connection refused"));
      await handleSlashCommand("/servers ping prod");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Connection refused");
    });

    // ─── /deploy ──────────────────────────────────────────
    it("/deploy with no configs", async () => {
      await handleSlashCommand("/deploy");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No deploy configs");
    });

    it("/deploy lists configs", async () => {
      const dc = require("../cli/deploy-config");
      dc.loadDeployConfigs.mockReturnValueOnce({
        staging: {
          method: "rsync",
          server: "prod",
          remote_path: "/app",
          local_path: "./dist",
        },
        production: {
          method: "git",
          server: "prod",
          remote_path: "/app",
          branch: "main",
        },
      });
      await handleSlashCommand("/deploy");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("staging");
      expect(output).toContain("production");
      expect(output).toContain("Deploy configs");
    });

    it("/deploy runs named deploy", async () => {
      const dc = require("../cli/deploy-config");
      dc.loadDeployConfigs.mockReturnValueOnce({
        staging: {
          method: "rsync",
          server: "prod",
          remote_path: "/app",
          local_path: "./dist",
        },
      });
      await handleSlashCommand("/deploy staging");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Running deploy");
    });

    it("/deploy runs named deploy with --dry-run", async () => {
      const dc = require("../cli/deploy-config");
      dc.loadDeployConfigs.mockReturnValueOnce({
        staging: { method: "rsync", server: "prod", remote_path: "/app" },
      });
      const tools = require("../cli/tools");
      await handleSlashCommand("/deploy staging --dry-run");
      expect(tools.executeTool).toHaveBeenCalledWith(
        "deploy",
        expect.objectContaining({ dry_run: true }),
      );
    });

    it("/deploy with deploy_script and health_check", async () => {
      const dc = require("../cli/deploy-config");
      dc.loadDeployConfigs.mockReturnValueOnce({
        staging: {
          method: "rsync",
          server: "prod",
          remote_path: "/app",
          deploy_script: "restart.sh",
          health_check: "https://example.com/health",
        },
      });
      await handleSlashCommand("/deploy");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("restart.sh");
      expect(output).toContain("health");
    });

    // ─── /docker ──────────────────────────────────────────
    it("/docker lists containers", async () => {
      // This uses child_process exec internally, which we can't easily mock
      // when called via require. The handler catches errors, so it should not throw.
      await handleSlashCommand("/docker");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Docker Containers");
    });

    // ─── /init ────────────────────────────────────────────
    it("/init runs server wizard", async () => {
      const wizard = require("../cli/wizard");
      await handleSlashCommand("/init", null);
      expect(wizard.setWizardRL).toHaveBeenCalled();
      expect(wizard.runServerWizard).toHaveBeenCalled();
    });

    it("/init deploy runs deploy wizard", async () => {
      const wizard = require("../cli/wizard");
      await handleSlashCommand("/init deploy", null);
      expect(wizard.runDeployWizard).toHaveBeenCalled();
    });

    // ─── /setup ───────────────────────────────────────────
    it("/setup runs setup wizard", async () => {
      const setup = require("../cli/setup");
      await handleSlashCommand("/setup", null);
      expect(setup.runSetupWizard).toHaveBeenCalled();
    });

    // ─── /tasks ───────────────────────────────────────────
    it("/tasks renders task list", async () => {
      await handleSlashCommand("/tasks");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No tasks");
    });

    it("/tasks clear clears tasks", async () => {
      const tasks = require("../cli/tasks");
      await handleSlashCommand("/tasks clear");
      expect(tasks.clearTasks).toHaveBeenCalled();
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Tasks cleared");
    });

    // ─── /snapshot ────────────────────────────────────────
    it("/snapshot creates a snapshot", async () => {
      await handleSlashCommand("/snapshot my-snap");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Snapshot created");
      expect(output).toContain("snap-001");
    });

    it("/snapshot without name creates unnamed snapshot", async () => {
      const fh = require("../cli/file-history");
      await handleSlashCommand("/snapshot");
      expect(fh.createSnapshot).toHaveBeenCalledWith(
        undefined,
        expect.any(String),
      );
    });

    it("/snapshot handles failure", async () => {
      const fh = require("../cli/file-history");
      fh.createSnapshot.mockReturnValueOnce({
        ok: false,
        error: "No changes to snapshot",
      });
      await handleSlashCommand("/snapshot");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No changes to snapshot");
    });

    it("/snapshot list shows snapshots", async () => {
      const fh = require("../cli/file-history");
      fh.listSnapshots.mockReturnValueOnce([
        { index: 1, shortName: "snap-001" },
        { index: 2, shortName: "snap-002" },
      ]);
      await handleSlashCommand("/snapshot list");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("snap-001");
      expect(output).toContain("snap-002");
    });

    it("/snapshot list with no snapshots", async () => {
      await handleSlashCommand("/snapshot list");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No snapshots found");
    });

    // ─── /restore ─────────────────────────────────────────
    it("/restore restores last snapshot", async () => {
      await handleSlashCommand("/restore");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Restored snapshot");
    });

    it("/restore with named snapshot", async () => {
      const fh = require("../cli/file-history");
      await handleSlashCommand("/restore my-snap");
      expect(fh.restoreSnapshot).toHaveBeenCalledWith(
        "my-snap",
        expect.any(String),
      );
    });

    it("/restore handles failure", async () => {
      const fh = require("../cli/file-history");
      fh.restoreSnapshot.mockReturnValueOnce({
        ok: false,
        error: "Snapshot not found",
      });
      await handleSlashCommand("/restore nonexistent");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Restore failed");
      expect(output).toContain("Snapshot not found");
    });

    it("/restore list shows available snapshots", async () => {
      const fh = require("../cli/file-history");
      fh.listSnapshots.mockReturnValueOnce([
        { index: 1, shortName: "snap-001" },
      ]);
      await handleSlashCommand("/restore list");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Available snapshots");
      expect(output).toContain("snap-001");
    });

    it("/restore list with no snapshots", async () => {
      await handleSlashCommand("/restore list");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No snapshots available");
    });

    // ─── /budget ──────────────────────────────────────────
    it("/budget with no limits shows overview", async () => {
      await handleSlashCommand("/budget");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Cost Limits");
    });

    it("/budget with provider shows single budget", async () => {
      const costs = require("../cli/costs");
      costs.checkBudget.mockReturnValueOnce({
        limit: 10,
        spent: 2.5,
        remaining: 7.5,
      });
      await handleSlashCommand("/budget openai");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("openai");
      expect(output).toContain("remaining");
    });

    it("/budget with provider and no limit", async () => {
      const costs = require("../cli/costs");
      costs.checkBudget.mockReturnValueOnce({
        limit: null,
        spent: 1.5,
        remaining: 0,
      });
      await handleSlashCommand("/budget openai");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("no limit");
    });

    it("/budget sets limit", async () => {
      const costs = require("../cli/costs");
      await handleSlashCommand("/budget openai 50");
      expect(costs.setCostLimit).toHaveBeenCalledWith("openai", 50);
      expect(costs.saveCostLimits).toHaveBeenCalled();
    });

    it("/budget with invalid amount", async () => {
      await handleSlashCommand("/budget openai abc");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Invalid amount");
    });

    it("/budget off removes limit", async () => {
      const costs = require("../cli/costs");
      await handleSlashCommand("/budget openai off");
      expect(costs.removeCostLimit).toHaveBeenCalledWith("openai");
    });

    it("/budget remove removes limit", async () => {
      const costs = require("../cli/costs");
      await handleSlashCommand("/budget openai remove");
      expect(costs.removeCostLimit).toHaveBeenCalledWith("openai");
    });

    it("/budget clear removes limit", async () => {
      const costs = require("../cli/costs");
      await handleSlashCommand("/budget openai clear");
      expect(costs.removeCostLimit).toHaveBeenCalledWith("openai");
    });

    it("/budget with negative amount is invalid", async () => {
      await handleSlashCommand("/budget openai -5");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Invalid amount");
    });

    it("/budget shows limits with spend", async () => {
      const costs = require("../cli/costs");
      costs.getCostLimits.mockReturnValueOnce({ anthropic: 20 });
      costs.getProviderSpend.mockReturnValue(5);
      await handleSlashCommand("/budget");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Cost Limits");
    });

    // ─── /plan edit ───────────────────────────────────────
    it("/plan edit with no plan shows message", async () => {
      await handleSlashCommand("/plan edit");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No plan to edit");
    });

    // ─── /tree ────────────────────────────────────────────
    it("/tree shows project tree", async () => {
      await handleSlashCommand("/tree");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Project tree");
    });

    it("/tree with depth argument", async () => {
      await handleSlashCommand("/tree 5");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("depth 5");
    });

    // ─── /review ──────────────────────────────────────────
    it("/review with file argument", async () => {
      const agent = require("../cli/agent");
      await handleSlashCommand("/review src/index.js");
      expect(agent.processInput).toHaveBeenCalledWith(
        expect.stringContaining("src/index.js"),
      );
    });

    it("/review not in git repo without file", async () => {
      const git = require("../cli/git");
      git.isGitRepo.mockReturnValueOnce(false);
      await handleSlashCommand("/review");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Not a git repository");
    });

    it("/review with no changes", async () => {
      const git = require("../cli/git");
      git.isGitRepo.mockReturnValue(true);
      git.getDiff.mockResolvedValue("");
      await handleSlashCommand("/review");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No changes to review");
    });

    it("/review with --strict flag", async () => {
      const agent = require("../cli/agent");
      await handleSlashCommand("/review --strict src/app.js");
      expect(agent.processInput).toHaveBeenCalledWith(
        expect.stringContaining("STRICT MODE"),
      );
    });

    it("/review with diff available", async () => {
      const git = require("../cli/git");
      const agent = require("../cli/agent");
      git.isGitRepo.mockReturnValue(true);
      git.getDiff.mockImplementation((staged) => {
        return staged ? Promise.resolve("+ new line") : Promise.resolve("");
      });
      await handleSlashCommand("/review");
      expect(agent.processInput).toHaveBeenCalledWith(
        expect.stringContaining("Review"),
      );
    });

    // ─── /brain ───────────────────────────────────────────
    it("/brain shows empty brain", async () => {
      await handleSlashCommand("/brain");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Brain Knowledge Base");
      expect(output).toContain("No documents yet");
    });

    it("/brain with documents", async () => {
      const brain = require("../cli/brain");
      brain.listDocuments.mockReturnValueOnce([
        { name: "api-notes", size: 512, modified: new Date() },
      ]);
      brain.readDocument.mockReturnValueOnce({
        content: "# API",
        frontmatter: { tags: ["api"] },
      });
      await handleSlashCommand("/brain");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("api-notes");
      expect(output).toContain("api");
    });

    it("/brain add without arg shows usage", async () => {
      await handleSlashCommand("/brain add");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/brain add creates empty doc", async () => {
      const brain = require("../cli/brain");
      await handleSlashCommand("/brain add api-notes");
      expect(brain.writeDocument).toHaveBeenCalledWith(
        "api-notes",
        expect.stringContaining("# api-notes"),
      );
    });

    it("/brain add with content writes content", async () => {
      const brain = require("../cli/brain");
      await handleSlashCommand("/brain add api-notes Some content here");
      expect(brain.writeDocument).toHaveBeenCalledWith(
        "api-notes",
        "Some content here",
      );
    });

    it("/brain list with no docs", async () => {
      await handleSlashCommand("/brain list");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No brain documents yet");
    });

    it("/brain list with docs", async () => {
      const brain = require("../cli/brain");
      brain.listDocuments.mockReturnValueOnce([
        { name: "api-notes", size: 512, modified: new Date() },
      ]);
      brain.readDocument.mockReturnValueOnce({
        content: "# API",
        frontmatter: { tags: ["api", "rest"] },
      });
      await handleSlashCommand("/brain list");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Brain Documents");
      expect(output).toContain("api-notes");
    });

    it("/brain search without query shows usage", async () => {
      await handleSlashCommand("/brain search");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/brain search with no results", async () => {
      await handleSlashCommand("/brain search foobar");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No matching");
    });

    it("/brain search with results", async () => {
      const brain = require("../cli/brain");
      brain.query.mockResolvedValueOnce([
        {
          name: "api-notes",
          score: 0.85,
          excerpt: "REST API documentation...",
        },
      ]);
      await handleSlashCommand("/brain search api");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("api-notes");
      expect(output).toContain("0.85");
    });

    it("/brain show without arg shows usage", async () => {
      await handleSlashCommand("/brain show");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/brain show with valid doc", async () => {
      const brain = require("../cli/brain");
      brain.readDocument.mockReturnValueOnce({
        content: "# My Doc\nSome content",
        frontmatter: {},
      });
      await handleSlashCommand("/brain show my-doc");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("my-doc.md");
      expect(output).toContain("# My Doc");
    });

    it("/brain show with missing doc", async () => {
      const brain = require("../cli/brain");
      brain.readDocument.mockReturnValueOnce({ content: "", frontmatter: {} });
      await handleSlashCommand("/brain show nonexist");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Document not found");
    });

    it("/brain remove without arg shows usage", async () => {
      await handleSlashCommand("/brain remove");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Usage");
    });

    it("/brain rebuild rebuilds index", async () => {
      const brain = require("../cli/brain");
      brain.buildIndex.mockReturnValueOnce({
        documents: { doc1: {}, doc2: {} },
      });
      await handleSlashCommand("/brain rebuild");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Index rebuilt");
      expect(output).toContain("2");
    });

    it("/brain embed when not available", async () => {
      await handleSlashCommand("/brain embed");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("not available");
    });

    it("/brain embed when available", async () => {
      const brain = require("../cli/brain");
      brain.isEmbeddingAvailable.mockResolvedValueOnce(true);
      brain.buildEmbeddingIndex.mockResolvedValueOnce({
        documents: { doc1: {} },
      });
      await handleSlashCommand("/brain embed");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Embedding index built");
    });

    it("/brain embed catches errors", async () => {
      const brain = require("../cli/brain");
      brain.isEmbeddingAvailable.mockResolvedValueOnce(true);
      brain.buildEmbeddingIndex.mockRejectedValueOnce(
        new Error("Model not found"),
      );
      await handleSlashCommand("/brain embed");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Embedding failed");
      expect(output).toContain("Model not found");
    });

    // ─── /learn ───────────────────────────────────────────
    it("/learn with too short session", async () => {
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("too short");
    });

    it("/learn with enough messages", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
        { role: "assistant", content: "6" },
        { role: "user", content: "7" },
        { role: "assistant", content: "8" },
      ]);
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: false,
        applied: [{ key: "test", value: "val", action: "added" }],
        nexAdded: ["Some rule"],
        summary: "Tested learning",
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({
        written: [{ name: "api", reason: "new findings", action: "created" }],
      });
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Memory updates");
      expect(output).toContain("Added to NEX.md");
      expect(output).toContain("Brain documents");
    });

    it("/learn with error", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
        { role: "assistant", content: "6" },
        { role: "user", content: "7" },
        { role: "assistant", content: "8" },
      ]);
      const learner = require("../cli/learner");
      learner.learnFromSession.mockRejectedValueOnce(new Error("API failure"));
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Learn failed");
    });

    it("/learn with skipped result and no brain", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
        { role: "assistant", content: "6" },
        { role: "user", content: "7" },
        { role: "assistant", content: "8" },
      ]);
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: true,
        applied: [],
        nexAdded: [],
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({ written: [] });
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("too short");
    });

    it("/learn with error in result", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
        { role: "assistant", content: "6" },
        { role: "user", content: "7" },
        { role: "assistant", content: "8" },
      ]);
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: false,
        error: "Parse error",
        applied: [],
        nexAdded: [],
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({ written: [] });
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Reflection error");
    });

    it("/learn with no new learnings", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
        { role: "assistant", content: "6" },
        { role: "user", content: "7" },
        { role: "assistant", content: "8" },
      ]);
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: false,
        applied: [],
        nexAdded: [],
        summary: "Nothing much",
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({ written: [] });
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No new learnings");
    });

    it("/learn with updated memory entry", async () => {
      const agent = require("../cli/agent");
      agent.getConversationMessages.mockReturnValueOnce([
        { role: "user", content: "1" },
        { role: "assistant", content: "2" },
        { role: "user", content: "3" },
        { role: "assistant", content: "4" },
        { role: "user", content: "5" },
        { role: "assistant", content: "6" },
        { role: "user", content: "7" },
        { role: "assistant", content: "8" },
      ]);
      const learner = require("../cli/learner");
      learner.learnFromSession.mockResolvedValueOnce({
        skipped: false,
        applied: [{ key: "pref", value: "dark", action: "updated" }],
        nexAdded: [],
      });
      learner.learnBrainFromSession.mockResolvedValueOnce({
        written: [{ name: "config", reason: "update", action: "updated" }],
      });
      await handleSlashCommand("/learn");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Memory updates");
    });

    // ─── /optimize ────────────────────────────────────────
    it("/optimize shows report", async () => {
      await handleSlashCommand("/optimize");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Optimization Report");
      expect(output).toContain("Context Window");
      expect(output).toContain("Memory");
      expect(output).toContain("Session");
    });

    // ─── /model without rl ────────────────────────────────
    it("/model without rl shows current model", async () => {
      await handleSlashCommand("/model");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Active model");
    });

    // ─── getPrompt ────────────────────────────────────────
    // Mode indicators moved to the sticky footer — getPrompt() is always plain.
    it("getPrompt is plain arrow regardless of plan mode", () => {
      const planner = require("../cli/planner");
      planner.isPlanMode.mockReturnValueOnce(true);
      const prompt = getPrompt();
      expect(prompt).toContain("›");
      expect(prompt).not.toContain("plan");
    });

    it("getPrompt is plain arrow regardless of autonomy level", () => {
      const planner = require("../cli/planner");
      planner.getAutonomyLevel.mockReturnValueOnce("semi-auto");
      const prompt = getPrompt();
      expect(prompt).toContain("›");
      expect(prompt).not.toContain("semi-auto");
    });

    it("getPrompt is plain arrow even with plan + autonomy active", () => {
      const planner = require("../cli/planner");
      planner.isPlanMode.mockReturnValueOnce(true);
      planner.getAutonomyLevel.mockReturnValueOnce("autonomous");
      const prompt = getPrompt();
      expect(prompt).toContain("›");
      expect(prompt).not.toContain("plan");
      expect(prompt).not.toContain("autonomous");
    });

    // ─── getAbortSignal ───────────────────────────────────
    it("getAbortSignal returns null when no controller", () => {
      expect(getAbortSignal()).toBeNull();
    });

    // ─── loadHistory / appendHistory / getHistoryPath ─────
    it("getHistoryPath returns path in .nex", () => {
      const histPath = getHistoryPath();
      expect(histPath).toContain(".nex");
      expect(histPath).toContain("repl_history");
    });

    it("loadHistory returns empty array for non-existent file", () => {
      const history = loadHistory();
      // May or may not exist depending on test env, but should not throw
      expect(Array.isArray(history)).toBe(true);
    });

    // ─── /brain status ────────────────────────────────────
    it("/brain status shows status", async () => {
      await handleSlashCommand("/brain status");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Brain Status");
      expect(output).toContain("Documents");
    });

    // ─── /brain remove with confirm ───────────────────────
    it("/brain remove with confirm=true and found doc", async () => {
      const safety = require("../cli/safety");
      const brain = require("../cli/brain");
      safety.confirm.mockResolvedValueOnce(true);
      brain.removeDocument.mockReturnValueOnce(true);
      await handleSlashCommand("/brain remove old-doc");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Removed");
    });

    it("/brain remove with confirm=false", async () => {
      const safety = require("../cli/safety");
      safety.confirm.mockResolvedValueOnce(false);
      await handleSlashCommand("/brain remove old-doc");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Cancelled");
    });

    it("/brain remove with confirm=true and not found", async () => {
      const safety = require("../cli/safety");
      const brain = require("../cli/brain");
      safety.confirm.mockResolvedValueOnce(true);
      brain.removeDocument.mockReturnValueOnce(false);
      await handleSlashCommand("/brain remove nonexist");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Document not found");
    });

    // ─── /k8s ─────────────────────────────────────────────
    it("/k8s shows kubernetes overview header", async () => {
      await handleSlashCommand("/k8s");
      const output = logSpy2.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Kubernetes Overview");
    });

    // ─── slash command that returns true ───────────────────
    it("handleSlashCommand returns true for known commands", async () => {
      const result = await handleSlashCommand("/help");
      expect(result).toBe(true);
    });

    it("handleSlashCommand returns true for unknown commands", async () => {
      const result = await handleSlashCommand("/unknowncmd");
      expect(result).toBe(true);
    });
  });
});

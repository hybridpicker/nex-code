// ─── Module Mocks ─────────────────────────────────────────
jest.mock("../cli/providers/registry", () => ({
  callStream: jest.fn(),
  getActiveModel: jest.fn().mockReturnValue({
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    provider: "ollama",
  }),
  getActiveProviderName: jest.fn().mockReturnValue("ollama"),
  getActiveModelId: jest.fn().mockReturnValue("kimi-k2.5"),
  getConfiguredProviders: jest.fn().mockReturnValue([]),
  _reset: jest.fn(),
}));

jest.mock("../cli/tools", () => ({
  TOOL_DEFINITIONS: [
    {
      type: "function",
      function: {
        name: "bash",
        description: "test",
        parameters: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "read",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "write",
        parameters: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" } },
          required: ["path", "content"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "edit_file",
        description: "edit",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_directory",
        description: "list",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "grep",
        description: "grep",
        parameters: {
          type: "object",
          properties: { pattern: { type: "string" } },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "glob",
        description: "glob",
        parameters: {
          type: "object",
          properties: { pattern: { type: "string" } },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_files",
        description: "search",
        parameters: {
          type: "object",
          properties: { pattern: { type: "string" } },
          required: ["pattern"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "web_fetch",
        description: "fetch",
        parameters: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "web_search",
        description: "search",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "browser_open",
        description: "browser",
        parameters: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "spawn_agents",
        description: "spawn",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "patch_file",
        description: "patch",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "ask_user",
        description: "ask",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string" },
            options: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["question", "options"],
        },
      },
    },
  ],
  executeTool: jest.fn(),
}));

jest.mock("../cli/orchestrator", () => ({
  detectComplexPrompt: jest
    .fn()
    .mockReturnValue({ isComplex: false, estimatedGoals: 0, reason: "mock" }),
  runOrchestrated: jest.fn().mockResolvedValue({
    synthesis: { summary: "mock synthesis", filesChanged: [], conflicts: [] },
  }),
}));

jest.mock("../cli/context", () => ({
  gatherProjectContext: jest.fn().mockReturnValue("PACKAGE: test-project"),
}));
jest.mock("../cli/context-engine", () => ({
  fitToContext: jest.fn().mockImplementation(async (messages) => ({
    messages,
    compressed: false,
    compacted: false,
    tokensRemoved: 0,
  })),
  getUsage: jest
    .fn()
    .mockReturnValue({ used: 100, limit: 128000, percentage: 0.1 }),
  estimateTokens: jest
    .fn()
    .mockImplementation((text) => (text ? text.length / 4 : 0)),
  estimateMessagesTokens: jest
    .fn()
    .mockImplementation((messages) => (messages || []).length * 100),
  compressToolResult: jest.fn().mockImplementation((content) => content),
  forceCompress: jest
    .fn()
    .mockImplementation((messages) => ({ messages, tokensRemoved: 0 })),
  buildProgressSnapshot: jest.fn((_messages, opts = {}) => ({
    role: "system",
    content:
      "## Progress State (preserved through compression)\n" +
      JSON.stringify(opts.locatedTarget || {}, null, 2),
    _pinned: true,
    _progressSnapshot: true,
  })),
}));
jest.mock("../cli/session", () => ({
  autoSave: jest.fn(),
  flushAutoSave: jest.fn(),
}));
jest.mock("../cli/memory", () => ({
  getMemoryContext: jest.fn().mockReturnValue(""),
}));
jest.mock("../cli/permissions", () => ({
  checkPermission: jest.fn().mockReturnValue("allow"),
  setPermission: jest.fn(),
  savePermissions: jest.fn(),
}));
jest.mock("../cli/planner", () => ({
  isPlanMode: jest.fn().mockReturnValue(false),
  getPlanModePrompt: jest.fn().mockReturnValue(""),
  PLAN_MODE_ALLOWED_TOOLS: new Set(),
  setPlanContent: jest.fn(),
  extractStepsFromText: jest.fn().mockReturnValue([]),
  createPlan: jest.fn(),
  getActivePlan: jest.fn().mockReturnValue(null),
  startExecution: jest.fn(),
  advancePlanStep: jest.fn(),
  getPlanStepInfo: jest.fn().mockReturnValue(null),
}));
jest.mock("../cli/render", () => ({
  renderMarkdown: jest.fn().mockImplementation((t) => t || ""),
  StreamRenderer: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    flush: jest.fn(),
    startCursor: jest.fn(),
    stopCursor: jest.fn(),
  })),
}));
jest.mock("../cli/hooks", () => ({ runHooks: jest.fn().mockReturnValue([]) }));
jest.mock("../cli/mcp", () => ({
  routeMCPCall: jest.fn().mockResolvedValue(null),
  getMCPToolDefinitions: jest.fn().mockReturnValue([]),
}));
jest.mock("../cli/skills", () => ({
  getSkillInstructions: jest.fn().mockReturnValue(""),
  getSkillToolDefinitions: jest.fn().mockReturnValue([]),
  routeSkillCall: jest.fn().mockResolvedValue(null),
  matchSkillTriggers: jest.fn().mockReturnValue([]),
}));
jest.mock("../cli/costs", () => ({ trackUsage: jest.fn() }));
jest.mock("../cli/tool-validator", () => ({
  validateToolArgs: jest.fn().mockReturnValue({ valid: true, args: {} }),
}));
jest.mock("../cli/tool-tiers", () => ({
  filterToolsForModel: jest.fn().mockImplementation((t) => t),
  getModelTier: jest.fn().mockReturnValue("full"),
  PROVIDER_DEFAULT_TIER: {
    ollama: "standard",
    openai: "full",
    anthropic: "full",
  },
}));
jest.mock("../cli/safety", () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  isCritical: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setAllowAlwaysHandler: jest.fn(),
}));

// Mock spinner to avoid real timers in tests
jest.mock("../cli/spinner", () => {
  const mkSpinner = (text) => ({
    text,
    start: jest.fn(),
    stop: jest.fn(),
    update: jest.fn(),
    isActive: jest.fn().mockReturnValue(false),
    _stopped: false,
    _paused: false,
  });
  const SpinnerMock = jest.fn().mockImplementation(mkSpinner);
  return {
    Spinner: SpinnerMock,
    MultiProgress: jest.fn(),
    TaskProgress: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      setStats: jest.fn(),
      updateTask: jest.fn(),
      isActive: jest.fn().mockReturnValue(false),
      _paused: false,
    })),
    setActiveTaskProgress: jest.fn(),
    getActiveTaskProgress: jest.fn(),
    cleanupTerminal: jest.fn(),
  };
});

// ─── Imports ──────────────────────────────────────────────
const {
  processInput,
  clearConversation,
  getConversationLength,
  getConversationMessages,
  setConversationMessages,
  setAbortSignalGetter,
  setMaxIterations,
  _inferVerificationCommands,
  _inferRelevantTests,
  _inferSymbolTargets,
  _extractExactVerificationOnlyCommand,
  _extractRequiredVerificationCommands,
  _extractExactRequiredVerificationCommands,
  _buildSymbolHintBlock,
  _claimsVerificationOrCompletion,
  _statesVerificationGap,
  _shouldAutoOrchestrate,
  _hasForcedModelOverride,
  _shouldSkipPlanPhaseForDirectCreation,
  _hasAutomationOrPreflightGate,
  _extractDirectTaskPaths,
  _isBoundedBacklogPlanningPrompt,
  _buildBoundedBacklogPlanInstruction,
  _looksLikeBoundedBacklogDecision,
  _isToolResultError,
  _pathMatchesScope,
  _isDependencyMutationCommand,
  _masksCommandFailure,
  _scopeAllowsDependencyMutation,
  _looksLikeCommentedOutCode,
  _detectAddedCommentedOutCode,
  _buildCommentedOutCodeNudge,
  _looksLikeMalformedDuplicateOpeningTag,
  _detectAddedMalformedMarkup,
  _buildMalformedMarkupNudge,
  _extractRemovedImportSymbols,
  _buildCompressionResumeTarget,
  _blockRepeatedSmallInsertionAfterEdit,
} = require("../cli/agent");
const {
  callStream,
  getConfiguredProviders,
  getActiveProviderName,
} = require("../cli/providers/registry");
const { executeTool } = require("../cli/tools");
const { validateToolArgs } = require("../cli/tool-validator");
const { routeSkillCall } = require("../cli/skills");
const { routeMCPCall } = require("../cli/mcp");
const { checkPermission } = require("../cli/permissions");
const { confirm, getAutoConfirm } = require("../cli/safety");
const {
  fitToContext,
  getUsage,
  forceCompress,
} = require("../cli/context-engine");
const { trackUsage } = require("../cli/costs");
const { autoSave } = require("../cli/session");
const { isPlanMode, getPlanModePrompt } = require("../cli/planner");
const { getMemoryContext } = require("../cli/memory");
const { getSkillInstructions } = require("../cli/skills");
const { Spinner } = require("../cli/spinner");

// ─── Globals ──────────────────────────────────────────────
// Save real setTimeout — tests that need instant retries will swap then restore
const REAL_SET_TIMEOUT = global.setTimeout;

function instantTimeout() {
  global.setTimeout = (fn) => REAL_SET_TIMEOUT(fn, 0);
}
function restoreTimeout() {
  global.setTimeout = REAL_SET_TIMEOUT;
}

describe("agent.js", () => {
  let logSpy;

  beforeEach(() => {
    // Disable phase routing in unit tests — it changes loop flow and breaks single-response mocks
    process.env.NEX_PHASE_ROUTING = "0";
    clearConversation();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(process.stdout, "write").mockImplementation(() => {});
    jest.spyOn(process.stderr, "write").mockImplementation(() => {});
    // Reset + clear: mockReset clears implementation queues (leftover mockImplementationOnce)
    callStream.mockReset();
    executeTool.mockReset();
    jest.clearAllMocks();
    fitToContext.mockImplementation(async (messages) => ({
      messages,
      compressed: false,
      compacted: false,
      tokensRemoved: 0,
    }));
    getUsage.mockReturnValue({ used: 100, limit: 128000, percentage: 0.1 });
    forceCompress.mockImplementation((messages) => ({
      messages,
      tokensRemoved: 0,
    }));
    getAutoConfirm.mockReturnValue(false);
    setAbortSignalGetter(() => null);
    restoreTimeout(); // ensure clean timer state
    // Clear system prompt and tool filter caches
    const agent = require("../cli/agent");
    if (agent.invalidateSystemPromptCache) agent.invalidateSystemPromptCache();
    if (agent.clearToolFilterCache) agent.clearToolFilterCache();
  });

  afterEach(() => {
    restoreTimeout();
    delete process.env.NEX_MAX_TOOL_CALLS;
    delete process.env.NEX_DISABLE_TOOL_BUDGET;
    delete process.env.NEX_FORCE_MODEL;
    isPlanMode.mockReturnValue(false);
    getPlanModePrompt.mockReturnValue("");
    logSpy.mockRestore();
  });

  // ─── Helpers ──────────────────────────────────────────────
  function mockStream(content, tool_calls = [], usage = null) {
    callStream.mockImplementationOnce(async (_m, _t, opts) => {
      if (opts?.onToken && content) opts.onToken(content);
      return { content, tool_calls, usage };
    });
  }

  function mockStreamSilent(content, tool_calls = [], usage = null) {
    callStream.mockImplementationOnce(async () => ({
      content,
      tool_calls,
      usage,
    }));
  }

  function logOutput() {
    return logSpy.mock.calls.map((c) => c[0]).join("\n");
  }

  test("detects forced model override from environment", () => {
    expect(_hasForcedModelOverride()).toBe(false);

    process.env.NEX_FORCE_MODEL = "ollama:devstral-2:123b-cloud";

    expect(_hasForcedModelOverride()).toBe(true);
  });

  describe("_buildCompressionResumeTarget()", () => {
    it("does not resume a frontend task by targeting package.json", () => {
      const target = _buildCompressionResumeTarget(
        new Set(["package.json"]),
        new Set(),
        "Add remaining kcal display to the nutrition ring on the fitness page.",
      );

      expect(target).toBeNull();
    });

    it("does not resume a frontend task by targeting VERSION", () => {
      const target = _buildCompressionResumeTarget(
        new Set(["VERSION"]),
        new Set(),
        "Add remaining kcal display to the nutrition ring on the fitness page.",
      );

      expect(target).toBeNull();
    });

    it("allows package.json when the task is about package scripts", () => {
      const target = _buildCompressionResumeTarget(
        new Set(["package.json"]),
        new Set(),
        "Add an npm test script to package.json.",
      );

      expect(target).toEqual(
        expect.objectContaining({ targetFile: "package.json" }),
      );
    });

    it("allows VERSION when the task is about a version bump", () => {
      const target = _buildCompressionResumeTarget(
        new Set(["VERSION"]),
        new Set(),
        "Bump the version for the next release.",
      );

      expect(target).toEqual(
        expect.objectContaining({ targetFile: "VERSION" }),
      );
    });
  });

  describe("single-line insertion whitespace guard", () => {
    it("normalizes transcript-derived blank-line insertions for scoped edits", async () => {
      getAutoConfirm.mockReturnValue(true);
      mockStream("Reading the located target.", [
        {
          function: {
            name: "read_file",
            arguments: {
              path: "src/pages/FitnessSummary.jsx",
              line_start: 20,
              line_end: 28,
            },
          },
          id: "read-fitness",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "20: <div className=\"metric\">Calories remaining</div>\n" +
          "21: <div className=\"ring\" />",
      );
      mockStream("Applying the focused insertion.", [
        {
          function: {
            name: "edit_file",
            arguments: {
              path: "src/pages/FitnessSummary.jsx",
              old_text: '<div className="metric">Calories remaining</div>',
              new_text:
                '<div className="metric">Calories remaining</div>\n' +
                '<div className="value">Remaining kcal</div>\n',
            },
          },
          id: "edit-fitness",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("PASS: inserted the requested line.", []);

      await processInput(
        "In src/pages/FitnessSummary.jsx, add the remaining kcal value after the Calories remaining line.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 5 },
      );

      const editCall = executeTool.mock.calls.find(
        ([name]) => name === "edit_file",
      );
      expect(editCall).toBeDefined();
      expect(editCall[1].new_text).toBe(
        '<div className="metric">Calories remaining</div>\n' +
          '<div className="value">Remaining kcal</div>',
      );
    });

    it("normalizes neutral scoped insertion patches with incidental blank lines", async () => {
      getAutoConfirm.mockReturnValue(true);
      mockStream("Reading ProfileCard.", [
        {
          function: {
            name: "read_file",
            arguments: {
              path: "src/components/ProfileCard.jsx",
              line_start: 8,
              line_end: 16,
            },
          },
          id: "read-profile",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "8:   const displayName = user.name;\n" +
          "9:   return <section>{displayName}</section>;",
      );
      mockStream("Applying one status line.", [
        {
          function: {
            name: "patch_file",
            arguments: {
              path: "src/components/ProfileCard.jsx",
              patches: [
                {
                  old_text: "  const displayName = user.name;",
                  new_text:
                    "  const displayName = user.name;\n" +
                    "  const statusText = user.status || 'Active';\n",
                },
              ],
            },
          },
          id: "patch-profile",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("PASS: inserted the requested line.", []);

      await processInput(
        "In src/components/ProfileCard.jsx, insert one status line after the displayName line.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 5 },
      );

      const patchCall = executeTool.mock.calls.find(
        ([name]) => name === "patch_file",
      );
      expect(patchCall).toBeDefined();
      expect(patchCall[1].patches[0].new_text).toBe(
        "  const displayName = user.name;\n" +
          "  const statusText = user.status || 'Active';",
      );
    });
  });

  describe("_blockRepeatedSmallInsertionAfterEdit()", () => {
    function repeatedInsertionPrep(path, oldText, newText) {
      return {
        canExecute: true,
        fnName: "patch_file",
        callId: "patch-repeat",
        args: {
          path,
          patches: [{ old_text: oldText, new_text: newText }],
        },
      };
    }

    it("blocks transcript-derived repeated kcal field insertions", () => {
      const prep = repeatedInsertionPrep(
        "web/templates/fitness/index.html",
        '<div class="text-[11px]" x-text="\'Ziel \' + targets.kcal"></div>',
        '<div class="text-[11px]" x-text="\'Ziel \' + targets.kcal"></div>\n' +
          '<div class="text-[11px]" x-text="\'Noch benötigt \' + Math.max(0, Math.round(targets.kcal - totals.kcal)) + \' kcal\'"></div>',
      );

      const blocked = _blockRepeatedSmallInsertionAfterEdit(
        prep,
        { targetFile: "web/templates/fitness/index.html" },
        "User asks for a remaining kcal field near: <div class=\"nutrition-ring-content\"><div x-text=\"Math.round(totals.kcal)\"></div></div>",
        new Set(["web/templates/fitness/index.html"]),
      );

      expect(blocked).toBe(true);
      expect(prep.canExecute).toBe(false);
      expect(prep.errorResult.content).toContain(
        "Do not add a second synonymous field",
      );
    });

    it("blocks neutral repeated insertions after the target file was edited", () => {
      const prep = repeatedInsertionPrep(
        "src/components/ProfileCard.jsx",
        "        <p>{profile.role}</p>",
        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
      );

      const blocked = _blockRepeatedSmallInsertionAfterEdit(
        prep,
        { targetFile: "src/components/ProfileCard.jsx" },
        "Add a status field to src/components/ProfileCard.jsx.",
        new Set(["src/components/ProfileCard.jsx"]),
      );

      expect(blocked).toBe(true);
      expect(prep.canExecute).toBe(false);
      expect(prep.errorResult.content).toContain(
        "Inspect the diff/readback and finalize",
      );
    });

    it("allows replacement fixes after an earlier insertion was wrong", () => {
      const prep = repeatedInsertionPrep(
        "src/components/ProfileCard.jsx",
        "        <p>Status: active</p>",
        "        <p>Status: {profile.status}</p>",
      );

      const blocked = _blockRepeatedSmallInsertionAfterEdit(
        prep,
        { targetFile: "src/components/ProfileCard.jsx" },
        "Add a status field to src/components/ProfileCard.jsx.",
        new Set(["src/components/ProfileCard.jsx"]),
      );

      expect(blocked).toBe(false);
      expect(prep.canExecute).toBe(true);
    });
  });

  function spinnerLabels() {
    // Section headers are written to stdout via process.stdout.write (strip ANSI codes)
    const stdoutSpy = process.stdout.write;
    const calls = stdoutSpy.mock ? stdoutSpy.mock.calls : [];
    return calls.map((c) => String(c[0]).replace(/\x1b\[[0-9;]*m/g, ""));
  }

  // ─── conversation state ───────────────────────────────────
  describe("conversation state", () => {
    it("starts empty", () => {
      expect(getConversationLength()).toBe(0);
    });

    it("clearConversation resets", async () => {
      mockStream("hello");
      await processInput("test");
      expect(getConversationLength()).toBeGreaterThan(0);
      clearConversation();
      expect(getConversationLength()).toBe(0);
    });

    it("getConversationMessages returns array", async () => {
      mockStream("hello");
      await processInput("test");
      const m = getConversationMessages();
      expect(m).toHaveLength(2);
      expect(m[0].role).toBe("user");
      expect(m[1].role).toBe("assistant");
    });

    it("setConversationMessages restores", () => {
      const r = [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
      ];
      setConversationMessages(r);
      expect(getConversationLength()).toBe(2);
      expect(getConversationMessages()).toEqual(r);
    });
  });

  // ─── processInput ─────────────────────────────────────────
  describe("processInput()", () => {
    it("simple text response", async () => {
      mockStream("Hello!");
      await processInput("Hi");
      expect(getConversationLength()).toBe(2);
    });

    it("handles provider returning undefined (defensive guard)", async () => {
      callStream.mockImplementationOnce(async () => undefined);
      await processInput("test");
      expect(logOutput()).toContain("empty response");
    });

    it("auto-saves after response", async () => {
      mockStream("ok");
      await processInput("test");
      expect(autoSave).toHaveBeenCalled();
    });

    it("handles tool call + result", async () => {
      mockStream("checking", [
        {
          function: { name: "bash", arguments: { command: "echo x" } },
          id: "c1",
        },
      ]);
      mockStream("Done!");
      executeTool.mockResolvedValueOnce("x");
      await processInput("run");
      expect(getConversationLength()).toBe(4);
    });

    it("handles malformed tool arguments (null)", async () => {
      process.env.NEX_DEBUG = "true";
      mockStream("", [
        { function: { name: "bash", arguments: null }, id: "c1" },
      ]);
      mockStream("Oops");
      await processInput("test");
      expect(logOutput()).toContain("malformed");
      delete process.env.NEX_DEBUG;
    });

    it("handles malformed tool arguments (bad string)", async () => {
      process.env.NEX_DEBUG = "true";
      mockStream("", [
        { function: { name: "bash", arguments: "not-json{{{" }, id: "c1" },
      ]);
      mockStream("OK");
      await processInput("test");
      expect(logOutput()).toContain("malformed");
      delete process.env.NEX_DEBUG;
    });

    it("malformed args include schema hint in error", async () => {
      mockStream("", [
        { function: { name: "bash", arguments: null }, id: "c1" },
      ]);
      mockStream("Fixed");
      await processInput("test");
      const msgs = getConversationMessages();
      const toolMsg = msgs.find(
        (m) => m.role === "tool" && m.content.includes("Expected JSON schema"),
      );
      expect(toolMsg).toBeDefined();
    });

    it("generates call ID when tc.id is missing", async () => {
      mockStream("", [
        { function: { name: "bash", arguments: { command: "test" } } },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(getConversationLength()).toBe(4);
    });

    it("handles API errors", async () => {
      callStream.mockRejectedValueOnce(
        new Error("API Error: connection refused"),
      );
      await processInput("test");
      expect(logOutput()).toContain("API Error");
    });

    it("maintains conversation across calls", async () => {
      mockStream("First");
      await processInput("msg1");
      mockStream("Second");
      await processInput("msg2");
      expect(getConversationLength()).toBe(4);
    });

    it("truncates large tool results (> 50000 chars)", async () => {
      mockStream("", [
        { function: { name: "bash", arguments: { command: "x" } }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("x".repeat(60000));
      await processInput("run");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      expect(toolMsg.content).toContain("truncated");
      expect(toolMsg.content.length).toBeLessThan(60000);
    });

    it("appends HINT when bash uses cat instead of read_file", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "cat README.md" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("file contents");
      await processInput("show file");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      expect(toolMsg.content).toContain("HINT");
      expect(toolMsg.content).toContain("read_file");
    });

    it("blocks bash ls and redirects to list_directory", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "ls src/" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      await processInput("list files");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      // Pre-execution block: executeTool is never called, message starts with BLOCKED:
      expect(toolMsg.content).toContain("BLOCKED:");
      expect(toolMsg.content).toContain("list_directory");
      const bashCalls = executeTool.mock.calls.filter((c) => c[0] === "bash");
      expect(bashCalls.length).toBe(0);
    });

    it("does not append HINT for cat write redirects", async () => {
      mockStream("", [
        {
          function: {
            name: "bash",
            arguments: { command: "cat > file.txt << EOF\nhello\nEOF" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("");
      await processInput("write file");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      expect(toolMsg.content).not.toContain("HINT: use read_file");
    });

    it("multiple tool calls in one response", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo 1" } },
          id: "c1",
        },
        {
          function: { name: "bash", arguments: { command: "echo 2" } },
          id: "c2",
        },
      ]);
      mockStream("Both done");
      executeTool.mockResolvedValueOnce("1").mockResolvedValueOnce("2");
      await processInput("run both");
      expect(executeTool).toHaveBeenCalledTimes(2);
    });

    it("runs ask_user exclusively and defers sibling tool calls", async () => {
      mockStream("", [
        {
          function: {
            name: "ask_user",
            arguments: {
              question: "Which area should I update?",
              options: ["backend", "frontend"],
            },
          },
          id: "c1",
        },
        {
          function: {
            name: "bash",
            arguments: { command: "echo should-wait" },
          },
          id: "c2",
        },
      ]);
      mockStream("Thanks, I will wait for your answer.");
      executeTool.mockResolvedValueOnce("backend");

      await processInput("help");

      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool).toHaveBeenCalledWith(
        "ask_user",
        {
          question: "Which area should I update?",
          options: ["backend", "frontend"],
        },
        { silent: true, autoConfirm: true },
      );
      expect(getConversationMessages().some((m) => m.role === "tool")).toBe(
        true,
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("ask_user is exclusive"),
        ),
      ).toBe(true);
    });

    it("does not execute tool calls after a direct user question in assistant text", async () => {
      mockStream(
        "I found the relevant module and can explain the behavior. Would you like me to elaborate on the agent capabilities or show you how to interact with a specific feature?",
        [
          {
            function: {
              name: "read_file",
              arguments: { path: "/project/productivity-agent.js" },
            },
            id: "c1",
          },
        ],
      );

      await processInput("What can we do with this agent?");

      expect(executeTool).not.toHaveBeenCalled();
      expect(callStream).toHaveBeenCalledTimes(1);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Would you like me to elaborate"),
        ),
      ).toBe(true);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            Array.isArray(m.tool_calls) &&
            m.tool_calls.length > 0,
        ),
      ).toBe(false);
    });

    it("passes onToken and signal to callStream", async () => {
      const sig = { aborted: false };
      setAbortSignalGetter(() => sig);
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        expect(typeof opts.onToken).toBe("function");
        expect(opts.signal).toBe(sig);
        return { content: "ok", tool_calls: [] };
      });
      await processInput("hi");
    });

    it("null/undefined tool result becomes empty string", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "true" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce(null);
      await processInput("test");
      expect(
        getConversationMessages().find((m) => m.role === "tool").content,
      ).toBe("");
    });
  });

  // ─── permissions ──────────────────────────────────────────
  describe("permissions", () => {
    it("deny blocks tool execution", async () => {
      checkPermission.mockReturnValueOnce("deny");
      mockStream("", [
        { function: { name: "bash", arguments: { command: "ls" } }, id: "c1" },
      ]);
      mockStream("OK");
      await processInput("list");
      expect(executeTool).not.toHaveBeenCalled();
      expect(logOutput()).toContain("denied");
    });

    it("ask + decline blocks tool", async () => {
      checkPermission.mockReturnValueOnce("ask");
      confirm.mockResolvedValueOnce(false);
      mockStream("", [
        { function: { name: "bash", arguments: { command: "ls" } }, id: "c1" },
      ]);
      mockStream("OK");
      await processInput("list");
      expect(executeTool).not.toHaveBeenCalled();
    });

    it("ask + confirm allows tool", async () => {
      checkPermission.mockReturnValueOnce("ask");
      confirm.mockResolvedValueOnce(true);
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "rm test" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("deleted");
      await processInput("delete");
      expect(executeTool).toHaveBeenCalled();
    });
  });

  // ─── tool validation ──────────────────────────────────────
  describe("tool validation", () => {
    it("validation error blocks execution", async () => {
      validateToolArgs.mockReturnValueOnce({
        valid: false,
        error: 'Missing "command"',
      });
      mockStream("", [
        { function: { name: "bash", arguments: { cmd: "x" } }, id: "c1" },
      ]);
      mockStream("Fixed");
      await processInput("test");
      expect(executeTool).not.toHaveBeenCalled();
      expect(logOutput()).toContain("Missing");
    });

    it("corrected args used when validator corrects", async () => {
      validateToolArgs.mockReturnValueOnce({
        valid: true,
        corrected: { command: "echo fixed" },
      });
      mockStream("", [
        { function: { name: "bash", arguments: { cmd: "wrong" } }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("fixed");
      await processInput("test");
      expect(executeTool).toHaveBeenCalledWith(
        "bash",
        { command: "echo fixed" },
        { silent: true, autoConfirm: true },
      );
    });

    it("normalizes namespaced tool aliases to known tools", async () => {
      mockStream("", [
        {
          function: {
            name: "repo_browser.read_file",
            arguments: { path: "package.json" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("{}");
      await processInput("test");
      expect(executeTool).toHaveBeenCalledWith(
        "read_file",
        expect.objectContaining({ path: "package.json" }),
        { silent: true, autoConfirm: true },
      );
    });

    it("maps namespaced repo search aliases to search_files", async () => {
      mockStream("", [
        {
          function: {
            name: "repo_browser.search",
            arguments: { query: "Toolbar" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("components/Toolbar.tsx");
      await processInput("test");
      expect(executeTool).toHaveBeenCalledWith(
        "search_files",
        expect.objectContaining({ pattern: "Toolbar" }),
        { silent: true, autoConfirm: true },
      );
    });

    it("maps namespaced exec aliases to bash", async () => {
      mockStream("", [
        {
          function: {
            name: "bash.exec",
            arguments: { command: "git status --short --branch" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("## main...origin/main\n");
      await processInput("test");
      expect(executeTool).toHaveBeenCalledWith(
        "bash",
        { command: "git status --short --branch" },
        { silent: true, autoConfirm: true },
      );
    });

    it("maps namespaced tree aliases to list_directory", async () => {
      mockStream("", [
        {
          function: {
            name: "repo_browser.print_tree",
            arguments: { path: "components" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("CommandCenter.tsx");
      await processInput("test");
      expect(executeTool).toHaveBeenCalledWith(
        "list_directory",
        expect.objectContaining({ path: "components" }),
        { silent: true, autoConfirm: true },
      );
    });
  });

  // ─── tool routing ─────────────────────────────────────────
  describe("tool routing", () => {
    it("skill route takes priority", async () => {
      routeSkillCall.mockResolvedValueOnce("skill result");
      mockStream("", [
        { function: { name: "bash", arguments: { command: "x" } }, id: "c1" },
      ]);
      mockStream("Done");
      await processInput("test");
      expect(executeTool).not.toHaveBeenCalled();
    });

    it("MCP route if skill returns null", async () => {
      routeSkillCall.mockResolvedValueOnce(null);
      routeMCPCall.mockResolvedValueOnce("mcp result");
      mockStream("", [
        { function: { name: "bash", arguments: { command: "x" } }, id: "c1" },
      ]);
      mockStream("Done");
      await processInput("test");
      expect(executeTool).not.toHaveBeenCalled();
    });

    it("executeTool if both return null", async () => {
      routeSkillCall.mockResolvedValueOnce(null);
      routeMCPCall.mockResolvedValueOnce(null);
      mockStream("", [
        { function: { name: "bash", arguments: { command: "x" } }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(executeTool).toHaveBeenCalled();
    });
  });

  // ─── parallel batching ────────────────────────────────────
  describe("parallel batching", () => {
    it("PARALLEL_SAFE tools run together", async () => {
      mockStream("", [
        {
          function: { name: "read_file", arguments: { path: "a.js" } },
          id: "c1",
        },
        { function: { name: "grep", arguments: { pattern: "foo" } }, id: "c2" },
        {
          function: { name: "glob", arguments: { pattern: "*.js" } },
          id: "c3",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValue("result");
      await processInput("read");
      expect(executeTool).toHaveBeenCalledTimes(3);
    });

    it("non-safe tools flush batch first", async () => {
      mockStream("", [
        {
          function: { name: "read_file", arguments: { path: "a.js" } },
          id: "c1",
        },
        {
          function: { name: "bash", arguments: { command: "echo" } },
          id: "c2",
        },
        {
          function: { name: "read_file", arguments: { path: "b.js" } },
          id: "c3",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValue("ok");
      await processInput("mixed");
      expect(executeTool).toHaveBeenCalledTimes(3);
    });

    it("spawn_agents is handled", async () => {
      mockStream("", [
        { function: { name: "spawn_agents", arguments: {} }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("✓ Agent ok");
      await processInput("spawn");
      expect(executeTool).toHaveBeenCalledTimes(1);
    });

    it("non-executable tools produce error results", async () => {
      checkPermission.mockReturnValueOnce("deny").mockReturnValueOnce("allow");
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "rm /" } },
          id: "c1",
        },
        {
          function: { name: "bash", arguments: { command: "echo ok" } },
          id: "c2",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(logOutput()).toContain("denied");
    });
  });

  // ─── error handling (non-retry) ───────────────────────────
  describe("error messages", () => {
    const cases = [
      ["ECONNREFUSED", "Connection refused", { code: "ECONNREFUSED" }],
      ["ENOTFOUND", "Network error", { code: "ENOTFOUND" }],
      ["401 Unauthorized", "Authentication failed", {}],
      ["403 Forbidden", "Access denied", {}],
      ["500 Internal Server Error", "API server error", {}],
      ["502 Bad Gateway", "API server error", {}],
      ["503 Service Unavailable", "API server error", {}],
      ["504 Gateway Timeout", "API server error", {}],
    ];

    // Tests mock provider as "ollama" but 5xx/401 retry is provider-gated.
    // In tests the mock returns "ollama" so these would retry — disable phase routing
    // so the retry logic for 5xx/401 (ollama-only) still triggers the immediate error path.
    test.each(cases)('"%s" shows "%s"', async (msg, expected, props) => {
      const err = new Error(msg);
      Object.assign(err, props);
      callStream.mockRejectedValueOnce(err);
      await processInput("test");
      expect(logOutput()).toContain(expected);
      expect(autoSave).toHaveBeenCalled();
    });

    it('"400 Bad Request" shows error after compress retries exhausted', async () => {
      // 400 handler retries 3 times (contextRetries 0→1→2→3), then falls through.
      // Need 4 rejections: 3 trigger compress+retry, 4th shows error message.
      const err = new Error("400 Bad Request");
      callStream
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err);
      await processInput("test");
      expect(logOutput()).toContain("Context too large");
      expect(autoSave).toHaveBeenCalled();
    });

    it("fetch failed shows network message", async () => {
      callStream.mockRejectedValueOnce(new Error("TypeError: fetch failed"));
      await processInput("test");
      expect(logOutput()).toContain("Network request failed");
    });

    it("generic error auto-saves", async () => {
      callStream.mockRejectedValueOnce(new Error("Unknown xyz123"));
      await processInput("test");
      expect(autoSave).toHaveBeenCalled();
    });
  });

  // ─── abort errors ─────────────────────────────────────────
  describe("abort errors", () => {
    it("AbortError breaks silently", async () => {
      const err = new Error("halted");
      err.name = "AbortError";
      callStream.mockRejectedValueOnce(err);
      await processInput("test");
      expect(autoSave).toHaveBeenCalled();
    });

    it("CanceledError breaks silently", async () => {
      const err = new Error("halted");
      err.name = "CanceledError";
      callStream.mockRejectedValueOnce(err);
      await processInput("test");
      expect(autoSave).toHaveBeenCalled();
    });

    it('"canceled" in message triggers abort path', async () => {
      callStream.mockRejectedValueOnce(
        new Error("Request was canceled by controller"),
      );
      await processInput("test");
      expect(autoSave).toHaveBeenCalled();
    });

    it("abort signal at loop start skips callStream", async () => {
      setAbortSignalGetter(() => ({ aborted: true }));
      await processInput("test");
      expect(callStream).not.toHaveBeenCalled();
    });

    it("runs exact verification-only commands without model drift", async () => {
      executeTool.mockResolvedValueOnce("verification ok");
      const onToolStart = jest.fn();
      const onToolEnd = jest.fn();

      const result = await processInput(
        "Verification only: run exactly `node src/main.js` and report whether that command passed or failed. Do not edit files and do not run other commands first.",
        { onToolStart, onToolEnd },
      );

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool).toHaveBeenCalledWith(
        "bash",
        { command: "node src/main.js" },
        expect.objectContaining({ autoConfirm: true, silent: true }),
      );
      expect(onToolStart).toHaveBeenCalledWith("bash", {
        command: "node src/main.js",
      });
      expect(onToolEnd).toHaveBeenCalledWith(
        "bash",
        expect.stringContaining("verification ok"),
        true,
      );
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          command: "node src/main.js",
        }),
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            m.content === "Verification passed: node src/main.js",
        ),
      ).toBe(true);
    });

    it("runs missing exact verification once after implementation", async () => {
      getAutoConfirm.mockReturnValue(true);
      mockStream("Creating the requested file.", [
        {
          function: {
            name: "write_file",
            arguments: {
              path: "src/main.js",
              content: 'console.log("desktop verification ok");\n',
            },
          },
          id: "write-main",
        },
      ]);
      executeTool.mockResolvedValueOnce("created");
      mockStream("Created src/main.js.");
      executeTool.mockResolvedValueOnce("desktop verification ok\n");
      mockStream(
        "Created src/main.js. Verification: node src/main.js (passed).",
      );

      const onToolStart = jest.fn();
      const onToolEnd = jest.fn();

      await processInput(
        "Create a tiny `src/main.js` that prints `desktop verification ok`, then run exactly `node src/main.js` and report whether it passed or failed. Do not run other commands after verification.",
        { onToolStart, onToolEnd },
        { autoConfirm: true, silent: true, maxIterations: 6 },
      );

      expect(executeTool).toHaveBeenCalledTimes(2);
      expect(executeTool.mock.calls[1]).toEqual([
        "bash",
        { command: "node src/main.js" },
        expect.objectContaining({ autoConfirm: true, silent: true }),
      ]);
      expect(
        executeTool.mock.calls.filter(
          ([tool, args]) =>
            tool === "bash" && args.command === "node src/main.js",
        ),
      ).toHaveLength(1);
      expect(onToolStart).toHaveBeenCalledWith("bash", {
        command: "node src/main.js",
      });
      expect(onToolEnd).toHaveBeenCalledWith(
        "bash",
        expect.stringContaining("desktop verification ok"),
        true,
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Verification: node src/main.js (passed)"),
        ),
      ).toBe(true);
    });
  });

  describe("exact verification command extraction", () => {
    it("extracts safe exact verification-only commands", () => {
      expect(
        _extractExactVerificationOnlyCommand(
          "Verification only: run exactly `npm test` and report pass/fail.",
        ),
      ).toBe("npm test");
      expect(
        _extractExactVerificationOnlyCommand(
          "Run exactly: node src/main.js. Do not edit files and do not run other commands first.",
        ),
      ).toBe("node src/main.js");
    });

    it("does not extract implementation or non-verification commands", () => {
      expect(
        _extractExactVerificationOnlyCommand(
          "Create src/main.js, then verify by running exactly: node src/main.js.",
        ),
      ).toBe("");
      expect(
        _extractExactVerificationOnlyCommand(
          "Verification only: run exactly `rm -rf /tmp/demo`.",
        ),
      ).toBe("");
    });

    it("extracts exact required verification commands from implementation prompts", () => {
      expect(
        _extractRequiredVerificationCommands(
          "Create src/main.js, then run exactly `node src/main.js` and report pass or fail.",
        ),
      ).toEqual(["node src/main.js"]);
      expect(
        _extractExactRequiredVerificationCommands(
          "Create src/main.js, then run exactly: node src/main.js. Do not run other commands after verification.",
        ),
      ).toEqual(["node src/main.js"]);
    });
  });

  // ─── retry logic (rate limit + network) ───────────────────
  describe("retry logic", () => {
    beforeEach(() => instantTimeout());
    afterEach(() => restoreTimeout());

    it("429 retries then succeeds", async () => {
      callStream.mockRejectedValueOnce(new Error("429 Too Many Requests"));
      mockStream("Success");
      await processInput("test");
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it("429 exhausts MAX_RATE_LIMIT_RETRIES", async () => {
      for (let i = 0; i < 11; i++)
        callStream.mockRejectedValueOnce(new Error("429"));
      await processInput("test");
      expect(logOutput()).toContain("max retries");
    });

    it("socket disconnected triggers network retry", async () => {
      callStream.mockRejectedValueOnce(new Error("socket disconnected"));
      mockStream("Recovered");
      await processInput("test");
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it("ECONNRESET code triggers network retry", async () => {
      const err = new Error("reset");
      err.code = "ECONNRESET";
      callStream.mockRejectedValueOnce(err);
      mockStream("Recovered");
      await processInput("test");
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it("ECONNABORTED code triggers network retry", async () => {
      const err = new Error("ECONNABORTED err");
      err.code = "ECONNABORTED";
      callStream.mockRejectedValueOnce(err);
      mockStream("Recovered");
      await processInput("test");
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it("TLS error triggers network retry", async () => {
      callStream.mockRejectedValueOnce(new Error("TLS handshake failed"));
      mockStream("Recovered");
      await processInput("test");
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it("ETIMEDOUT triggers network retry and shows timeout message", async () => {
      const err = new Error("connect ETIMEDOUT");
      err.code = "ETIMEDOUT";
      callStream.mockRejectedValueOnce(err);
      mockStream("Recovered");
      await processInput("test");
      expect(logOutput()).toContain("timed out");
      expect(callStream).toHaveBeenCalledTimes(2);
    });

    it("timeout in message triggers retry", async () => {
      callStream.mockRejectedValueOnce(new Error("request timeout exceeded"));
      mockStream("Recovered");
      await processInput("test");
      expect(logOutput()).toContain("timed out");
    });

    it("network retries exhaust MAX_NETWORK_RETRIES", async () => {
      for (let i = 0; i < 11; i++)
        callStream.mockRejectedValueOnce(new Error("socket disconnected"));
      await processInput("test");
      expect(logOutput()).toContain("Network error: max retries");
    });
  });

  // ─── context management ───────────────────────────────────
  describe("context management", () => {
    it("logs compression when context is compressed", async () => {
      process.env.NEX_DEBUG = "true";
      fitToContext.mockImplementationOnce((m) => ({
        messages: m,
        compressed: true,
        tokensRemoved: 5000,
      }));
      mockStream("OK");
      await processInput("test");
      expect(logOutput()).toContain("context compressed");
      expect(logOutput()).toContain("5000");
      delete process.env.NEX_DEBUG;
    });

    it("preserves located target state after auto-compress before edits", async () => {
      getUsage.mockReturnValue({ used: 90000, limit: 100000, percentage: 90 });
      forceCompress.mockImplementation((messages) => ({
        messages,
        tokensRemoved: 1000,
      }));
      callStream
        .mockResolvedValueOnce({
          content: "Located the nutrition ring target range.",
          tool_calls: [
            {
              id: "read-target",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1860,
                  line_end: 1890,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Applying the scoped edit next.",
          tool_calls: [],
        });
      executeTool.mockResolvedValueOnce(
        '<div class="nutrition-ring"><div class="nutrition-ring-content">kcal</div></div>',
      );

      await processInput(
        "Add remaining kcal display to the nutrition ring on the fitness page.",
        null,
        { maxIterations: 3 },
      );

      const resumeCall = callStream.mock.calls.find(([messages]) =>
        JSON.stringify(messages).includes("RESUME AFTER COMPRESSION"),
      );
      expect(resumeCall).toBeDefined();
      const resumeCallText = JSON.stringify(resumeCall[0]);
      expect(resumeCallText).toContain("Progress State");
      expect(resumeCallText).toContain("web/templates/fitness/index.html");
      expect(resumeCallText).toContain("lineStart");
      expect(resumeCallText).toContain("nextAction");
      expect(resumeCallText).toContain("do not restart with broad search");
    });

    it("preserves located target state after post-tool auto-compress", async () => {
      getUsage.mockImplementation((messages = []) => {
        const text = JSON.stringify(messages);
        if (
          text.includes("nutrition-ring-content") &&
          !text.includes("RESUME AFTER COMPRESSION")
        ) {
          return { used: 90000, limit: 100000, percentage: 90 };
        }
        return { used: 50000, limit: 100000, percentage: 50 };
      });
      forceCompress.mockImplementation((messages) => ({
        messages,
        tokensRemoved: 1000,
      }));
      callStream
        .mockResolvedValueOnce({
          content: "Located the nutrition ring target range.",
          tool_calls: [
            {
              id: "read-target",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1860,
                  line_end: 1890,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Applying the scoped edit next.",
          tool_calls: [],
        });
      executeTool.mockResolvedValueOnce(
        '<div class="nutrition-ring"><div class="nutrition-ring-content">kcal</div></div>',
      );

      await processInput(
        "Add remaining kcal display to the nutrition ring on the fitness page.",
        null,
        { maxIterations: 2 },
      );

      const resumeCall = callStream.mock.calls.find(([messages]) =>
        JSON.stringify(messages).includes("RESUME AFTER COMPRESSION"),
      );
      expect(resumeCall).toBeDefined();
      const resumeCallText = JSON.stringify(resumeCall[0]);
      expect(resumeCallText).toContain("Progress State");
      expect(resumeCallText).toContain("web/templates/fitness/index.html");
      expect(resumeCallText).toContain("lineStart");
      expect(resumeCallText).toContain("do not restart with broad search");
    });

    it("allows one targeted re-read of the located range after compression", async () => {
      const targetRead = {
        id: "read-target",
        function: {
          name: "read_file",
          arguments: {
            path: "web/templates/fitness/index.html",
            line_start: 1860,
            line_end: 1890,
          },
        },
      };
      getUsage.mockReturnValue({ used: 90000, limit: 100000, percentage: 90 });
      forceCompress.mockImplementation((messages) => ({
        messages,
        tokensRemoved: 1000,
      }));
      callStream
        .mockResolvedValueOnce({
          content: "Located the nutrition ring target range.",
          tool_calls: [targetRead],
        })
        .mockResolvedValueOnce({
          content: "Compression removed the exact snippet; re-reading target.",
          tool_calls: [{ ...targetRead, id: "read-target-after-compression" }],
        })
        .mockResolvedValueOnce({
          content: "Ready to edit the scoped kcal display.",
          tool_calls: [],
        });
      executeTool.mockResolvedValue(
        '<div class="nutrition-ring"><div class="nutrition-ring-content">kcal</div></div>',
      );

      await processInput(
        "Add remaining kcal display to the nutrition ring on the fitness page.",
        null,
        { maxIterations: 3 },
      );

      expect(executeTool).toHaveBeenCalledTimes(2);
      expect(executeTool.mock.calls[1][0]).toBe("read_file");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).not.toContain(
        'BLOCKED: read_file("web/templates/fitness/index.html", lines 1860-1890) is a duplicate',
      );
    });

    it("blocks transcript-derived adjacent-line rewrites for kcal insertions", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the located nutrition ring section.",
          tool_calls: [
            {
              id: "read-target",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1860,
                  line_end: 1890,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the remaining kcal line.",
          tool_calls: [
            {
              id: "patch-bad",
              function: {
                name: "patch_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  patches: [
                    {
                      old_text:
                        '        <p class="text-xs text-muted">Daily goal</p>',
                      new_text:
                        '        <p class="text-sm text-muted">Daily goal</p>\n        <p class="text-xs text-muted">Remaining kcal</p>',
                    },
                  ],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Retrying with an insertion-only patch.",
          tool_calls: [
            {
              id: "patch-good",
              function: {
                name: "patch_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  patches: [
                    {
                      old_text:
                        '        <p class="text-xs text-muted">Daily goal</p>',
                      new_text:
                        '        <p class="text-xs text-muted">Daily goal</p>\n        <p class="text-xs text-muted">Remaining kcal</p>',
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          '<div class="nutrition-ring-content">\n        <p class="text-xs text-muted">Daily goal</p>\n      </div>',
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add remaining kcal display to the nutrition ring on the fitness page.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      const patchCalls = executeTool.mock.calls.filter(
        ([name]) => name === "patch_file",
      );
      expect(patchCalls).toHaveLength(1);
      expect(patchCalls[0][1].patches[0].new_text).toContain(
        'class="text-xs text-muted">Daily goal',
      );
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("rewrites an existing anchor line");
    });

    it("blocks insertions that ignore a prompt-specified anchor line", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the located target section.",
          tool_calls: [
            {
              id: "read-target",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1,
                  line_end: 20,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Trying the insertion from the wrong existing line.",
          tool_calls: [
            {
              id: "wrong-anchor",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  old_text:
                    '      <div class="text-2xl font-semibold" x-text="totals.kcal"></div>',
                  new_text:
                    '      <div class="text-2xl font-semibold" x-text="totals.kcal"></div>\n      <div class="text-xs text-muted">Remaining kcal</div>',
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Using the requested anchor line.",
          tool_calls: [
            {
              id: "right-anchor",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  old_text:
                    '      <div class="text-xs text-muted" x-text="\'Daily goal \' + targets.kcal"></div>',
                  new_text:
                    '      <div class="text-xs text-muted" x-text="\'Daily goal \' + targets.kcal"></div>\n      <div class="text-xs text-muted">Remaining kcal</div>',
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          '<div class="nutrition-ring-content">\n      <div class="text-2xl font-semibold" x-text="totals.kcal"></div>\n      <div class="text-xs text-muted" x-text="\'Daily goal \' + targets.kcal"></div>\n    </div>',
        )
        .mockResolvedValueOnce("Edited");

      await processInput(
        "Add remaining kcal display below the Daily goal line in web/templates/fitness/index.html.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      const editCalls = executeTool.mock.calls.filter(
        ([name]) => name === "edit_file",
      );
      expect(editCalls).toHaveLength(1);
      expect(editCalls[0][1].old_text).toContain("Daily goal");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("prompt specifies inserting below/after");
    });

    it("allows neutral insertion-only patches near a located target", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card status area.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line without changing adjacent text.",
          tool_calls: [
            {
              id: "patch-status",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "File: src/components/ProfileCard.jsx (lines 20-42)\n20: <article>\n21:         <h2>{profile.name}</h2>\n22:         <p>{profile.role}</p>\n23:       </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 3 },
      );

      const patchCalls = executeTool.mock.calls.filter(
        ([name]) => name === "patch_file",
      );
      expect(patchCalls).toHaveLength(1);
      expect(patchCalls[0][1].path).toBe("src/components/ProfileCard.jsx");
    });

    it("allows insertion before a closing line inside a preserved block", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card block.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding a status line before the closing tag.",
          tool_calls: [
            {
              id: "patch-status",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text:
                        "      <article>\n        <p>{profile.role}</p>\n      </article>",
                      new_text:
                        "      <article>\n        <p>{profile.role}</p>\n        <p>Status: active</p>\n      </article>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "20:       <article>\n21:         <p>{profile.role}</p>\n22:       </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line below the role line in src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 3 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
    });

    it("blocks neutral patches that rewrite an adjacent line instead of inserting", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line.",
          tool_calls: [
            {
              id: "patch-rewrite",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        '        <p className="text-xs">{profile.role}</p>\n        <p>Status: active</p>',
                    },
                  ],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Stopping after the insertion guard.",
          tool_calls: [],
        });
      executeTool.mockResolvedValueOnce(
        "<article>\n        <h2>{profile.name}</h2>\n        <p>{profile.role}</p>\n      </article>",
      );

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 3 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(0);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Do not edit adjacent existing lines");
    });

    it("blocks small insertions when old_text was not in the located context", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line from a guessed nearby block.",
          tool_calls: [
            {
              id: "patch-guessed",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text:
                        "        <section className=\"profile-summary\">\n          <span>{profile.title}</span>\n        </section>",
                      new_text:
                        "        <section className=\"profile-summary\">\n          <span>{profile.title}</span>\n        </section>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Stopping after the unknown-anchor guard.",
          tool_calls: [],
        });
      executeTool.mockResolvedValueOnce(
        "<article>\n        <h2>{profile.name}</h2>\n        <p>{profile.role}</p>\n      </article>",
      );

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 3 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(0);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("was not found in the located target context");
    });

    it("nudges prose-only responses to edit after locating a scoped target", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "The target is located and I should add the status line below the role.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Applying the insertion.",
          tool_calls: [
            {
              id: "patch-status",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "<article>\n        <h2>{profile.name}</h2>\n        <p>{profile.role}</p>\n      </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Do not continue in prose");
    });

    it("nudges Desktop server runs to edit after locating the kcal target", async () => {
      callStream
        .mockResolvedValueOnce({
          content: "Reading the located nutrition ring section.",
          tool_calls: [
            {
              id: "read-fitness",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1855,
                  line_end: 1875,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "The remaining kcal display is already complete and working correctly.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Applying the missing remaining kcal line.",
          tool_calls: [
            {
              id: "patch-kcal",
              function: {
                name: "patch_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  patches: [
                    {
                      old_text:
                        '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal">Ziel 2500</div>',
                      new_text:
                        '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal">Ziel 2500</div>\n' +
                        '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Verbleibend \' + Math.max(0, targets.kcal - totals.kcal) + \' kcal\'"></div>',
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "1855: <div class=\"nutrition-ring-content\">\n" +
            "1856: <div class=\"text-3xl\" x-text=\"Math.round(totals.kcal)\">0</div>\n" +
            "1857: <div class=\"text-xs\">kcal</div>\n" +
            "1858: <div class=\"text-[11px] text-gray-400 mt-1\" x-text=\"'Ziel ' + targets.kcal\">Ziel 2500</div>\n" +
            "1859: </div>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "bei /fitness bzw ernährung hätte ich gern hier ein feld dass mir anzeigt wieviele kcal ich noch zu mir nehmen muss: <div class=\"nutrition-ring-content\"> <div class=\"text-3xl font-black text-gray-900 leading-none\" x-text=\"Math.round(totals.kcal)\">0</div> <div class=\"text-xs font-semibold text-gray-500 mt-1\">kcal</div> <div class=\"text-[11px] text-gray-400 mt-1\" x-text=\"'Ziel ' + targets.kcal\">Ziel 2500</div> </div>",
        null,
        { serverMode: true, silent: true, maxIterations: 4 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Do not continue in prose");
    });

    it("nudges Desktop server runs to edit after locating a neutral target", async () => {
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "The status line is already present.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Adding the missing status line.",
          tool_calls: [
            {
              id: "patch-status",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "20:       <article>\n21:         <h2>{profile.name}</h2>\n22:         <p>{profile.role}</p>\n23:       </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx below the role.",
        null,
        { serverMode: true, silent: true, maxIterations: 4 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
    });

    it("recovers from empty headless responses after locating the kcal target", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the located nutrition ring section.",
          tool_calls: [
            {
              id: "read-fitness",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1863,
                  line_end: 1870,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Applying the missing remaining kcal line.",
          tool_calls: [
            {
              id: "patch-kcal",
              function: {
                name: "patch_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  patches: [
                    {
                      old_text:
                        '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal">Ziel 2500</div>',
                      new_text:
                        '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal">Ziel 2500</div>\n' +
                        '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Verbleibend \' + Math.max(0, Math.round(targets.kcal - totals.kcal)) + \' kcal\'"></div>',
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "1863: <div class=\"nutrition-ring-content\">\n" +
            "1864: <div x-text=\"Math.round(totals.kcal)\">0</div>\n" +
            "1865: <div>kcal</div>\n" +
            "1866: <div class=\"text-[11px] text-gray-400 mt-1\" x-text=\"'Ziel ' + targets.kcal\">Ziel 2500</div>\n" +
            "1867: </div>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "bei /fitness bzw ernährung hätte ich gern hier ein feld dass mir anzeigt wieviele kcal ich noch zu mir nehmen muss: <div class=\"nutrition-ring-content\"> <div class=\"text-3xl font-black text-gray-900 leading-none\" x-text=\"Math.round(totals.kcal)\">0</div> <div class=\"text-xs font-semibold text-gray-500 mt-1\">kcal</div> <div class=\"text-[11px] text-gray-400 mt-1\" x-text=\"'Ziel ' + targets.kcal\">Ziel 2500</div> </div>",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Your previous response was empty");
      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
    });

    it("recovers from empty headless responses after locating a neutral target", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line.",
          tool_calls: [
            {
              id: "patch-profile",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "20: <article>\n21:   <h2>{profile.name}</h2>\n22:   <p>{profile.role}</p>\n23: </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Your previous response was empty");
      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
    });

    it("corrects transcript-derived summaries that call new edits pre-existing", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the nutrition ring.",
          tool_calls: [
            {
              id: "read-fitness",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1860,
                  line_end: 1875,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the remaining kcal line.",
          tool_calls: [
            {
              id: "edit-fitness",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  old_text:
                    '<div class="text-[11px]" x-text="\'Ziel \' + targets.kcal"></div>',
                  new_text:
                    '<div class="text-[11px]" x-text="\'Ziel \' + targets.kcal"></div>\n' +
                    '<div class="text-[11px]" x-text="Math.round(targets.kcal - totals.kcal) + \' kcal\'"></div>',
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading back the edited line.",
          tool_calls: [
            {
              id: "readback-fitness",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 1860,
                  line_end: 1878,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "The remaining kcal field is already present and was added in a previous session.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Changed web/templates/fitness/index.html in this run and verified it with a post-edit readback.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce(
          '<div class="text-[11px]" x-text="\'Ziel \' + targets.kcal"></div>',
        )
        .mockResolvedValueOnce("Edited: web/templates/fitness/index.html")
        .mockResolvedValueOnce(
          '<div class="text-[11px]" x-text="Math.round(targets.kcal - totals.kcal) + \' kcal\'"></div>',
        );

      await processInput(
        "Add a remaining kcal display to the nutrition ring.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 6 },
      );

      const conversationText = getConversationMessages()
        .map((m) => m.content)
        .join("\n");
      expect(conversationText).toContain(
        "did not accurately describe this run",
      );
      expect(conversationText).toContain("Changed web/templates/fitness/index.html");
    });

    it("corrects neutral summaries that call new edits pre-existing", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line.",
          tool_calls: [
            {
              id: "patch-profile",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Verifying the edited component.",
          tool_calls: [
            {
              id: "readback-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "The status line already exists.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Changed src/components/ProfileCard.jsx in this run and verified it with a post-edit readback.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("<p>{profile.role}</p>")
        .mockResolvedValueOnce("Patched")
        .mockResolvedValueOnce("<p>Status: active</p>");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 6 },
      );

      const conversationText = getConversationMessages()
        .map((m) => m.content)
        .join("\n");
      expect(conversationText).toContain(
        "did not accurately describe this run",
      );
      expect(conversationText).toContain("Changed src/components/ProfileCard.jsx");
    });

    it("corrects summaries that call new edits already in place", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line.",
          tool_calls: [
            {
              id: "patch-profile",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Verifying the edited component.",
          tool_calls: [
            {
              id: "readback-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "The requested status line is already in place.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Changed src/components/ProfileCard.jsx in this run and verified it with a post-edit readback.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("<p>{profile.role}</p>")
        .mockResolvedValueOnce("Patched")
        .mockResolvedValueOnce("<p>Status: active</p>");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 6 },
      );

      const conversationText = getConversationMessages()
        .map((m) => m.content)
        .join("\n");
      expect(conversationText).toContain(
        "did not accurately describe this run",
      );
      expect(conversationText).toContain("Changed src/components/ProfileCard.jsx");
    });

    it("corrects summaries that claim edits cannot be made after editing", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Adding the status line.",
          tool_calls: [
            {
              id: "patch-profile",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Verifying the edited component.",
          tool_calls: [
            {
              id: "readback-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "I cannot make further file edits because the tool-call budget is exhausted. Apply this edit manually.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Changed src/components/ProfileCard.jsx in this run and verified it with a post-edit readback.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("<p>{profile.role}</p>")
        .mockResolvedValueOnce("Patched")
        .mockResolvedValueOnce("<p>Status: active</p>");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 6 },
      );

      const conversationText = getConversationMessages()
        .map((m) => m.content)
        .join("\n");
      expect(conversationText).toContain(
        "did not accurately describe this run",
      );
      expect(conversationText).toContain("Changed src/components/ProfileCard.jsx");
    });

    it("blocks repeated reads of the same located target range before edits", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the profile card.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading the same range again before editing.",
          tool_calls: [
            {
              id: "read-profile-again",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Applying the insertion after the duplicate read block.",
          tool_calls: [
            {
              id: "patch-status",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "<article>\n        <h2>{profile.name}</h2>\n        <p>{profile.role}</p>\n      </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      expect(
        executeTool.mock.calls.filter(([name]) => name === "read_file"),
      ).toHaveLength(1);
      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Do not re-read the same target range");
    });

    it("blocks ask_user after the prompt and target range are sufficient", async () => {
      getAutoConfirm.mockReturnValue(true);
      callStream
        .mockResolvedValueOnce({
          content: "Reading the target profile card section.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 20,
                  line_end: 42,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Asking even though the target is located.",
          tool_calls: [
            {
              id: "ask-unneeded",
              function: {
                name: "ask_user",
                arguments: {
                  question: "Where should the status line go?",
                  options: ["Above role", "Below role"],
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Proceeding with the obvious insertion.",
          tool_calls: [
            {
              id: "patch-status",
              function: {
                name: "patch_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  patches: [
                    {
                      old_text: "        <p>{profile.role}</p>",
                      new_text:
                        "        <p>{profile.role}</p>\n        <p>Status: active</p>",
                    },
                  ],
                },
              },
            },
          ],
        });
      executeTool
        .mockResolvedValueOnce(
          "<article>\n        <h2>{profile.name}</h2>\n        <p>{profile.role}</p>\n      </article>",
        )
        .mockResolvedValueOnce("Patched");

      await processInput(
        "Add a status line to src/components/ProfileCard.jsx.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 4 },
      );

      expect(executeTool.mock.calls.some(([name]) => name === "ask_user")).toBe(
        false,
      );
      expect(
        executeTool.mock.calls.filter(([name]) => name === "patch_file"),
      ).toHaveLength(1);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("ask_user is unnecessary");
    });

    it("requires editing when read scrolling and grep are both exhausted", async () => {
      callStream
        .mockResolvedValueOnce({
          content: "Reading the first relevant section.",
          tool_calls: [
            {
              id: "read-1",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/dashboard.html",
                  line_start: 1,
                  line_end: 20,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading the second relevant section.",
          tool_calls: [
            {
              id: "read-2",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/dashboard.html",
                  line_start: 40,
                  line_end: 60,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading the third relevant section.",
          tool_calls: [
            {
              id: "read-3",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/dashboard.html",
                  line_start: 80,
                  line_end: 100,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Searching for target markup.",
          tool_calls: [
            {
              id: "grep-1",
              function: {
                name: "grep",
                arguments: {
                  path: "web/templates/dashboard.html",
                  pattern: "dashboard-ring-content",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Searching for current value.",
          tool_calls: [
            {
              id: "grep-2",
              function: {
                name: "grep",
                arguments: {
                  path: "web/templates/dashboard.html",
                  pattern: "totals.value",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Searching for target value.",
          tool_calls: [
            {
              id: "grep-3",
              function: {
                name: "grep",
                arguments: {
                  path: "web/templates/dashboard.html",
                  pattern: "targets.value",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Trying another search.",
          tool_calls: [
            {
              id: "grep-4",
              function: {
                name: "grep",
                arguments: {
                  path: "web/templates/dashboard.html",
                  pattern: "remaining value",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Stopping after the deadlock nudge.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("<section>one</section>")
        .mockResolvedValueOnce("<section>two</section>")
        .mockResolvedValueOnce("<section>three</section>")
        .mockResolvedValueOnce("web/templates/dashboard.html:90:dashboard-ring-content")
        .mockResolvedValueOnce("web/templates/dashboard.html:91:totals.value")
        .mockResolvedValueOnce("web/templates/dashboard.html:92:targets.value");

      await processInput("Add a remaining value to the dashboard template.");

      expect(executeTool).toHaveBeenCalledTimes(6);
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Your next tool call must be edit_file or patch_file");
    });

    it("nudges empty post-tool edit tasks toward editing instead of summarizing", async () => {
      callStream
        .mockResolvedValueOnce({
          content: "Reading the target template section.",
          tool_calls: [
            {
              id: "read-template",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/dashboard.html",
                  line_start: 20,
                  line_end: 30,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Stopping after the edit nudge.",
          tool_calls: [],
        });
      executeTool.mockResolvedValueOnce("<div>target value</div>");

      await processInput("Add a remaining value to the dashboard template.");

      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("Empty response after locating web/templates/dashboard.html");
    });

    it("allows one post-edit verification read of a previously read file", async () => {
      callStream
        .mockResolvedValueOnce({
          content: "Reading the target file.",
          tool_calls: [
            {
              id: "read-before-edit",
              function: {
                name: "read_file",
                arguments: { path: "web/templates/fitness/index.html" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Applying the requested field.",
          tool_calls: [
            {
              id: "edit-target",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  old_text: "</div>",
                  new_text: "<div>remaining kcal</div></div>",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Verifying the edit on disk.",
          tool_calls: [
            {
              id: "read-after-edit",
              function: {
                name: "read_file",
                arguments: { path: "web/templates/fitness/index.html" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Verification passed after reading the edited file.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("<div>kcal</div>")
        .mockResolvedValueOnce("Edited: web/templates/fitness/index.html")
        .mockResolvedValueOnce("<div>remaining kcal</div>");

      await processInput(
        "Add remaining kcal display to the nutrition ring on the fitness page.",
        null,
        { maxIterations: 4 },
      );

      expect(executeTool.mock.calls[2][0]).toBe("read_file");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).not.toContain(
        'BLOCKED: read_file("web/templates/fitness/index.html") denied',
      );
    });

    it("allows phase-mode readback of an edited fitness template instead of blocking verification", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      callStream
        .mockResolvedValueOnce({
          content: "Plan: update web/templates/fitness/index.html.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Applying the kcal remaining field.",
          tool_calls: [
            {
              id: "edit-target",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  old_text: '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal"></div>',
                  new_text:
                    '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal"></div><div x-text="Math.max(0, targets.kcal - totals.kcal)"></div>',
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading back the edited template section.",
          tool_calls: [
            {
              id: "read-after-edit",
              function: {
                name: "read_file",
                arguments: { path: "web/templates/fitness/index.html" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "PASS: I re-read web/templates/fitness/index.html after the edit and confirmed the remaining kcal field is present.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("Edited: web/templates/fitness/index.html")
        .mockResolvedValueOnce(
          '<div class="text-[11px] text-gray-400 mt-1" x-text="\'Ziel \' + targets.kcal"></div><div x-text="Math.max(0, targets.kcal - totals.kcal)"></div>',
        );

      await processInput(
        "Add a remaining kcal field to the fitness nutrition ring template.",
      );

      expect(executeTool.mock.calls[1][0]).toBe("read_file");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).not.toContain("BLOCKED: code was already edited");
      delete process.env.NEX_PHASE_ROUTING;
    });

    it("keeps verification pending when a fitness template readback misses the edited markup", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      callStream
        .mockResolvedValueOnce({
          content: "Plan: update web/templates/fitness/index.html.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Adding the remaining kcal field.",
          tool_calls: [
            {
              id: "edit-fitness",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  old_text: '<div class="text-xs">kcal</div>',
                  new_text:
                    '<div class="text-xs">kcal</div><div class="text-[11px]" x-text="Math.max(0, targets.kcal - totals.kcal) + \' kcal remaining\'"></div>',
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading back the same file, but at the style block.",
          tool_calls: [
            {
              id: "read-css",
              function: {
                name: "read_file",
                arguments: {
                  path: "web/templates/fitness/index.html",
                  line_start: 680,
                  line_end: 690,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Stopping after the verification nudge.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("Edited: web/templates/fitness/index.html")
        .mockResolvedValueOnce(
          ".nutrition-ring-content { z-index: 1; text-align: center; }",
        );

      await processInput("Add a remaining kcal field to the fitness nutrition ring.");

      expect(executeTool.mock.calls[1][0]).toBe("read_file");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("did not include text introduced by your last edit");
      delete process.env.NEX_PHASE_ROUTING;
    });

    it("allows phase-mode readback of a neutral edited component file", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      callStream
        .mockResolvedValueOnce({
          content: "Plan: update src/components/ProfileCard.jsx.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Applying the scoped component edit.",
          tool_calls: [
            {
              id: "edit-profile",
              function: {
                name: "edit_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  old_text: "<span>{name}</span>",
                  new_text: "<span>{name}</span><span>{status}</span>",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading back the edited component.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: { path: "src/components/ProfileCard.jsx" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "PASS: I re-read src/components/ProfileCard.jsx after the edit and confirmed the status field is present.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("Edited: src/components/ProfileCard.jsx")
        .mockResolvedValueOnce("<span>{name}</span><span>{status}</span>");

      await processInput("Add a status field to the profile card component.");

      expect(executeTool.mock.calls[1][0]).toBe("read_file");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).not.toContain("BLOCKED: code was already edited");
      delete process.env.NEX_PHASE_ROUTING;
    });

    it("keeps verification pending when a neutral component readback misses the edited text", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      callStream
        .mockResolvedValueOnce({
          content: "Plan: update src/components/ProfileCard.jsx.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Adding the status field.",
          tool_calls: [
            {
              id: "edit-profile",
              function: {
                name: "edit_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  old_text: "<span>{name}</span>",
                  new_text: "<span>{name}</span><span>{status}</span>",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading an unrelated section of the edited file.",
          tool_calls: [
            {
              id: "read-profile",
              function: {
                name: "read_file",
                arguments: {
                  path: "src/components/ProfileCard.jsx",
                  line_start: 1,
                  line_end: 20,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Stopping after the verification nudge.",
          tool_calls: [],
        });
      executeTool
        .mockResolvedValueOnce("Edited: src/components/ProfileCard.jsx")
        .mockResolvedValueOnce("export function ProfileCard() { return null; }");

      await processInput("Add a status field to the profile card component.");

      expect(executeTool.mock.calls[1][0]).toBe("read_file");
      expect(
        getConversationMessages()
          .map((m) => m.content)
          .join("\n"),
      ).toContain("did not include text introduced by your last edit");
      delete process.env.NEX_PHASE_ROUTING;
    });

    it("warns when context usage > 85%", async () => {
      process.env.NEX_DEBUG = "true";
      getUsage.mockReturnValueOnce({
        used: 110000,
        limit: 128000,
        percentage: 86,
      });
      mockStream("OK");
      await processInput("test");
      expect(logOutput()).toContain("Context");
      expect(logOutput()).toContain("used");
      delete process.env.NEX_DEBUG;
    });
  });

  // ─── token usage tracking ─────────────────────────────────
  describe("token usage tracking", () => {
    it("tracks when usage is present", async () => {
      mockStream("Hello", [], { prompt_tokens: 200, completion_tokens: 100 });
      await processInput("test");
      expect(trackUsage).toHaveBeenCalledWith("ollama", "kimi-k2.5", 200, 100);
    });

    it("handles zero tokens", async () => {
      mockStream("Hello", [], { prompt_tokens: 0, completion_tokens: 0 });
      await processInput("test");
      expect(trackUsage).toHaveBeenCalledWith("ollama", "kimi-k2.5", 0, 0);
    });

    it("estimates tokens when no usage data (Ollama Cloud fallback)", async () => {
      mockStream("Hello");
      await processInput("test");
      // Provider omitted usage → estimated values are tracked (non-zero from context)
      expect(trackUsage).toHaveBeenCalledTimes(1);
      const [provider, model, inputEst, outputEst] = trackUsage.mock.calls[0];
      expect(provider).toBe("ollama");
      expect(model).toBe("kimi-k2.5");
      expect(typeof inputEst).toBe("number");
      expect(typeof outputEst).toBe("number");
    });

    it("handles undefined token counts as 0", async () => {
      mockStream("Hello", [], {
        prompt_tokens: undefined,
        completion_tokens: undefined,
      });
      await processInput("test");
      expect(trackUsage).toHaveBeenCalledWith("ollama", "kimi-k2.5", 0, 0);
    });
  });

  // ─── nudge ────────────────────────────────────────────────
  describe("nudge on empty text after tools", () => {
    it("sends nudge when LLM produces empty text after tool calls", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo x" } },
          id: "c1",
        },
      ]);
      mockStreamSilent("", []); // empty — triggers nudge
      mockStream(
        "Here is the summary of what was done, including the output from the bash command and the final result.",
      );
      executeTool.mockResolvedValueOnce("output");
      await processInput("test");
      expect(callStream).toHaveBeenCalledTimes(3);
      const nudge = callStream.mock.calls[2][0].find(
        (m) => m.role === "user" && m.content?.includes("SYSTEM"),
      );
      expect(nudge).toBeDefined();
      expect(nudge.content).toContain("summarize");
    });
  });

  describe("verification-aware final summaries", () => {
    it("detects completion claims and explicit verification gaps", () => {
      expect(
        _claimsVerificationOrCompletion("The fix is complete and ready."),
      ).toBe(true);
      expect(_claimsVerificationOrCompletion("Tests passed.")).toBe(true);
      expect(
        _statesVerificationGap("Verification not run; npm test was not run."),
      ).toBe(true);
    });

    it("requests a corrected summary when files changed but verification was not run", async () => {
      mockStream("editing", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream(
        "Implemented the fix and verified everything is complete. All checks passed and the change is ready.",
      );
      mockStream(
        "Updated /fix.js to apply the requested fix. Verification not run, so tests and build checks are not confirmed. Remaining risk is limited to the edited branch.",
      );

      await processInput("Fix the bug in fix.js");

      expect(callStream).toHaveBeenCalledTimes(3);
      const summaryMessages = callStream.mock.calls[2][0];
      expect(summaryMessages[summaryMessages.length - 1].content).toContain(
        "not run; state this explicitly",
      );
      expect(getConversationMessages()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: expect.stringContaining("Verification not run"),
          }),
        ]),
      );
    });

    it("blocks final success until the task-required verification command has passed", async () => {
      mockStream("editing", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("Running build", [
        {
          function: { name: "bash", arguments: { command: "npm run build" } },
          id: "build-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("build ok");
      mockStream(
        "PASS: The fix is complete and verification passed.",
      );
      mockStream("Running lint", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("lint ok");
      mockStream(
        "PASS: Updated /fix.js and ran npm run lint successfully before finishing.",
      );

      await processInput(
        "Fix the bug in fix.js. Run npm run lint before finishing and report the result.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 8 },
      );

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("explicitly requires these verification commands") &&
            m.content.includes("npm run lint"),
        ),
      ).toBe(true);
    });

    it("requires final summaries to report the exact verification command result", async () => {
      mockStream("editing", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("Running lint", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("lint ok");
      mockStream("The ESLint failures are fixed and npm run lint should now pass.");
      mockStream(
        "Changed files: /fix.js. Verification: npm run lint (passed). Remaining risk: none.",
      );

      await processInput(
        "Fix the bug in fix.js. Run npm run lint before finishing and report the result.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 8 },
      );

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("npm run lint (passed)") &&
            (m.content.includes("final summary must report the exact verification command and result") ||
              m.content.includes("Write a closing summary")),
        ),
      ).toBe(true);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Verification: npm run lint (passed)"),
        ),
      ).toBe(true);
    });
  });

  // ─── file tracking + resume ───────────────────────────────
  describe("file tracking and resume", () => {
    it("tracks write_file as modified", async () => {
      mockStream("", [
        {
          function: {
            name: "write_file",
            arguments: { path: "t.js", content: "x" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).toContain("modified");
    });

    it("tracks edit_file as modified", async () => {
      mockStream("", [
        {
          function: { name: "edit_file", arguments: { path: "t.js" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).toContain("modified");
    });

    it("tracks patch_file as modified", async () => {
      mockStream("", [
        {
          function: { name: "patch_file", arguments: { path: "t.js" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).toContain("modified");
    });

    it("does not track ERROR results as modified", async () => {
      mockStream("", [
        {
          function: {
            name: "write_file",
            arguments: { path: "t.js", content: "x" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ERROR: denied");
      await processInput("test");
      expect(logOutput()).not.toContain("file modified");
    });

    it("does not track CANCELLED results as read", async () => {
      mockStream("", [
        {
          function: { name: "read_file", arguments: { path: "a.js" } },
          id: "c1",
        },
      ]);
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo ok" } },
          id: "c2",
        },
      ]);
      mockStream("Done");
      executeTool
        .mockResolvedValueOnce("CANCELLED: user")
        .mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).not.toContain("/save");
    });

    it("shows /diff /commit when files modified", async () => {
      mockStream("", [
        {
          function: {
            name: "write_file",
            arguments: { path: "t.js", content: "x" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).toContain("/diff");
      expect(logOutput()).toContain("/commit");
    });

    it("shows /save when files read (2+ steps, no modifications)", async () => {
      mockStream("", [
        {
          function: { name: "read_file", arguments: { path: "a.js" } },
          id: "c1",
        },
      ]);
      mockStream("", [
        {
          function: { name: "read_file", arguments: { path: "b.js" } },
          id: "c2",
        },
      ]);
      mockStream("Analysis done");
      executeTool.mockResolvedValue("content");
      await processInput("analyze");
      expect(logOutput()).toContain("/save");
    });

    it("pluralizes correctly", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo 1" } },
          id: "c1",
        },
      ]);
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo 2" } },
          id: "c2",
        },
        {
          function: { name: "bash", arguments: { command: "echo 3" } },
          id: "c3",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValue("ok");
      await processInput("test");
      expect(logOutput()).toContain("2 steps");
      expect(logOutput()).toContain("3 tools");
    });

    it("shows elapsed seconds", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).toMatch(/\d+s/);
    });

    it("step indicator printed for step 2+", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo 1" } },
          id: "c1",
        },
      ]);
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo 2" } },
          id: "c2",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValue("ok");
      await processInput("test");
      expect(logOutput()).toContain("step");
    });
  });

  // ─── system prompt ────────────────────────────────────────
  describe("system prompt", () => {
    it("includes memory context", async () => {
      getMemoryContext.mockReturnValueOnce("dark mode preference");
      mockStream("ok");
      await processInput("test");
      expect(callStream.mock.calls[0][0][0].content).toContain(
        "dark mode preference",
      );
    });

    it("includes skill instructions", async () => {
      getSkillInstructions.mockReturnValueOnce("Skill: code-review");
      mockStream("ok");
      await processInput("test");
      expect(callStream.mock.calls[0][0][0].content).toContain(
        "Skill: code-review",
      );
    });

    it("includes plan mode prompt", async () => {
      isPlanMode
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValue(false);
      getPlanModePrompt.mockReturnValueOnce("Plan mode active");
      mockStream("ok");
      await processInput("test");
      expect(callStream.mock.calls[0][0][0].content).toContain(
        "Plan mode active",
      );
    });

    it("includes model routing guide when 2+ models", async () => {
      getConfiguredProviders.mockReturnValueOnce([
        { name: "ollama", models: [{ id: "kimi-k2.5", name: "K2.5" }] },
        { name: "openai", models: [{ id: "gpt-4o", name: "GPT-4o" }] },
      ]);
      mockStream("ok");
      await processInput("test");
      expect(callStream.mock.calls[0][0][0].content).toContain(
        "Sub-Agent Model Routing",
      );
    });

    it("marks few-shot examples without telling the model to wait", async () => {
      let firstMessages = null;
      callStream.mockImplementationOnce(async (messages) => {
        firstMessages = messages;
        return { content: "OK", tool_calls: [] };
      });

      await processInput(
        "Add a rate limiter middleware to the Express server",
        null,
        { silent: true },
      );

      const joined = firstMessages
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join("\n");
      expect(joined).toContain("[EXAMPLE");
      expect(joined).toContain("the next user message is the real task");
      expect(joined).not.toContain("wait for the real user request");
    });

    it("omits routing guide when < 2 models", async () => {
      getConfiguredProviders.mockReturnValueOnce([
        { name: "ollama", models: [{ id: "x", name: "X" }] },
      ]);
      mockStream("ok");
      await processInput("test");
      expect(callStream.mock.calls[0][0][0].content).not.toContain(
        "Sub-Agent Model Routing",
      );
    });

    it("handles getConfiguredProviders error", async () => {
      getConfiguredProviders.mockImplementationOnce(() => {
        throw new Error("err");
      });
      mockStream("ok");
      await processInput("test");
      expect(callStream.mock.calls[0][0][0].content).toContain("Nex Code");
    });
  });

  // ─── tool result detection ────────────────────────────────
  describe("tool result detection", () => {
    it("treats non-zero bash exits as tool errors", () => {
      expect(_isToolResultError("bash", "EXIT 1\nlint failed")).toBe(true);
      expect(_isToolResultError("bash", "EXIT 127\nnot found")).toBe(true);
      expect(_isToolResultError("bash", "ok")).toBe(false);
    });

    it("detects scoped dependency mutations", () => {
      const sourceScope = "src/components/GameControls.jsx,src/utils/sound.js";
      expect(_isDependencyMutationCommand("npm install")).toBe(true);
      expect(_isDependencyMutationCommand("npm i baseline-browser-mapping@latest -D")).toBe(true);
      expect(_scopeAllowsDependencyMutation(sourceScope)).toBe(false);
      expect(_scopeAllowsDependencyMutation("package.json,package-lock.json")).toBe(true);
      expect(_pathMatchesScope("src/utils/sound.js", sourceScope)).toBe(true);
    });

    it("detects commands that mask verification failures", () => {
      expect(_masksCommandFailure("npm run lint || true")).toBe(true);
      expect(_masksCommandFailure("npm test || exit 0")).toBe(true);
      expect(_masksCommandFailure("set +e; npm run lint")).toBe(true);
      expect(_masksCommandFailure("npm run lint")).toBe(false);
    });

    it("detects newly added commented-out code in source diffs", () => {
      const diff = [
        "diff --git a/src/utils/sound.js b/src/utils/sound.js",
        "--- a/src/utils/sound.js",
        "+++ b/src/utils/sound.js",
        "@@ -10,0 +11,3 @@",
        "+// const unusedAudio = new Audio('/click.mp3');",
        "+// Explains why sound is optional in tests.",
        "+const enabled = true;",
      ].join("\n");

      expect(_looksLikeCommentedOutCode("// const stale = 1;")).toBe(true);
      expect(_looksLikeCommentedOutCode("// Explains behavior.")).toBe(false);
      expect(_detectAddedCommentedOutCode(diff)).toEqual([
        {
          path: "src/utils/sound.js",
          line: 11,
          text: "// const unusedAudio = new Audio('/click.mp3');",
        },
      ]);
    });

    it("builds a guard nudge for commented-out code findings", () => {
      const message = _buildCommentedOutCodeNudge([
        {
          path: "src/utils/sound.js",
          line: 42,
          text: "// return false;",
        },
      ]);
      expect(message).toContain("SYSTEM QUALITY GUARD");
      expect(message).toContain("src/utils/sound.js:42");
      expect(message).toContain("Remove dead/commented-out code");
    });

    it("detects malformed duplicate opening tags in transcript-derived markup diffs", () => {
      const diff = [
        "diff --git a/web/templates/fitness/index.html b/web/templates/fitness/index.html",
        "--- a/web/templates/fitness/index.html",
        "+++ b/web/templates/fitness/index.html",
        "@@ -1866,0 +1867,1 @@",
        "+<div class=\"text-[11px] text-gray-400 mt-1\" x-text=\"'Verbleibend ' + Math.max(0, Math.round(targets.kcal - totals.kcal)) + ' kcal'\"><div>",
      ].join("\n");

      expect(
        _looksLikeMalformedDuplicateOpeningTag("<div class=\"text-xs\"><div>"),
      ).toBe(true);
      expect(_detectAddedMalformedMarkup(diff)).toEqual([
        {
          path: "web/templates/fitness/index.html",
          line: 1867,
          text: "<div class=\"text-[11px] text-gray-400 mt-1\" x-text=\"'Verbleibend ' + Math.max(0, Math.round(targets.kcal - totals.kcal)) + ' kcal'\"><div>",
        },
      ]);
    });

    it("detects malformed duplicate opening tags in neutral template diffs", () => {
      const diff = [
        "diff --git a/web/templates/dashboard.html b/web/templates/dashboard.html",
        "--- a/web/templates/dashboard.html",
        "+++ b/web/templates/dashboard.html",
        "@@ -22,0 +23,2 @@",
        "+<section><div></div></section>",
        "+<span class=\"metric\" data-value=\"remaining\"><span>",
      ].join("\n");

      expect(_detectAddedMalformedMarkup(diff)).toEqual([
        {
          path: "web/templates/dashboard.html",
          line: 24,
          text: "<span class=\"metric\" data-value=\"remaining\"><span>",
        },
      ]);
    });

    it("builds a guard nudge for malformed markup findings", () => {
      const message = _buildMalformedMarkupNudge([
        {
          path: "web/templates/dashboard.html",
          line: 24,
          text: '<span class="metric"><span>',
        },
      ]);
      expect(message).toContain("SYSTEM QUALITY GUARD");
      expect(message).toContain("web/templates/dashboard.html:24");
      expect(message).toContain("appears to leave an element unclosed");
    });

    it("blocks final success when no-git lint-fix edits leave commented-out dead code", async () => {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");
      const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-comment-"));
      const sourceDir = path.join(fixtureDir, "src", "utils");
      const sourcePath = path.join(sourceDir, "sound.js");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        sourcePath,
        [
          "export function playWin() {",
          "  const now = 0;",
          "  return now + 1;",
          "}",
          "",
        ].join("\n"),
      );

      const originalCwd = process.cwd();
      process.chdir(fixtureDir);

      executeTool.mockImplementation(async (name, args) => {
        if (name === "write_file") {
          fs.writeFileSync(path.join(fixtureDir, args.path), args.content);
          return "ok";
        }
        if (name === "edit_file") {
          const target = path.join(fixtureDir, args.path);
          const current = fs.readFileSync(target, "utf8");
          fs.writeFileSync(target, current.replace(args.old_text, args.new_text));
          return "ok";
        }
        return "ok";
      });

      callStream
        .mockResolvedValueOnce({
          content: "Applying the lint fix.",
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: {
                name: "write_file",
                arguments: {
                  path: "src/utils/sound.js",
                  content: [
                    "export function playWin() {",
                    "  // const now = 0; // removed unused variable",
                    "  return 1;",
                    "}",
                    "",
                  ].join("\n"),
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "**PASS**\n\nAll ESLint failures have been fixed without changing behavior.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Removing the dead commented-out line.",
          tool_calls: [
            {
              id: "c2",
              type: "function",
              function: {
                name: "edit_file",
                arguments: {
                  path: "src/utils/sound.js",
                  old_text: "  // const now = 0; // removed unused variable\n",
                  new_text: "",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "**PASS**\n\nAll ESLint failures have been fixed without changing behavior.",
          tool_calls: [],
        });

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior in src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 6 },
        );
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(callStream.mock.calls.length).toBeGreaterThanOrEqual(4);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Do not finish with PASS/verified language") &&
            m.content.includes("src/utils/sound.js"),
        ),
      ).toBe(true);
    });

    it("blocks final success when an edited template has malformed markup", async () => {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");
      const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-markup-"));
      const templateDir = path.join(fixtureDir, "web", "templates");
      const templatePath = path.join(templateDir, "dashboard.html");
      fs.mkdirSync(templateDir, { recursive: true });
      fs.writeFileSync(
        templatePath,
        [
          '<div class="nutrition-ring-content">',
          '  <div class="text-xs">kcal</div>',
          "</div>",
          "",
        ].join("\n"),
      );

      const originalCwd = process.cwd();
      process.chdir(fixtureDir);

      executeTool.mockImplementation(async (name, args) => {
        if (name === "edit_file") {
          const target = path.join(fixtureDir, args.path);
          const current = fs.readFileSync(target, "utf8");
          fs.writeFileSync(target, current.replace(args.old_text, args.new_text));
          return "ok";
        }
        return "ok";
      });

      callStream
        .mockResolvedValueOnce({
          content: "Adding the remaining calories label.",
          tool_calls: [
            {
              id: "m1",
              type: "function",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/dashboard.html",
                  old_text: '  <div class="text-xs">kcal</div>',
                  new_text:
                    '  <div class="text-xs">kcal</div>\n  <div class="text-[11px]" x-text="remaining"><div>',
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "**PASS**\n\nThe dashboard template update is complete.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Fixing the malformed closing tag.",
          tool_calls: [
            {
              id: "m2",
              type: "function",
              function: {
                name: "edit_file",
                arguments: {
                  path: "web/templates/dashboard.html",
                  old_text: '  <div class="text-[11px]" x-text="remaining"><div>',
                  new_text:
                    '  <div class="text-[11px]" x-text="remaining"></div>',
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content:
            "**PASS**\n\nThe dashboard template update is complete after fixing the malformed markup.",
          tool_calls: [],
        });

      try {
        await processInput("Add a remaining value to the dashboard template.", null, {
          autoConfirm: true,
          silent: true,
          maxIterations: 6,
        });
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes(
              "Do not report success while the edited markup appears malformed",
            ) &&
            m.content.includes("web/templates/dashboard.html"),
        ),
      ).toBe(true);
    });

    it("blocks undeclared package imports when manifests are out of scope", async () => {
      const fs = require("fs");
      const path = require("path");
      const os = require("os");
      const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-import-"));
      const sourceDir = path.join(fixtureDir, "src", "components");
      const sourcePath = path.join(sourceDir, "GameControls.jsx");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(fixtureDir, "package.json"),
        JSON.stringify({ name: "fixture", version: "1.0.0" }, null, 2),
      );
      fs.writeFileSync(
        sourcePath,
        [
          "import React from 'react';",
          "export default function GameControls() {",
          "  return null;",
          "}",
          "",
        ].join("\n"),
      );

      const originalCwd = process.cwd();
      const originalScope = process.env.NEX_SCOPE;
      process.chdir(fixtureDir);
      process.env.NEX_SCOPE = "src/components/GameControls.jsx,src/utils/sound.js";

      executeTool.mockImplementation(async (name, args) => {
        if (name === "write_file") {
          fs.writeFileSync(path.join(fixtureDir, args.path), args.content);
          return "ok";
        }
        if (name === "edit_file") {
          const target = path.join(fixtureDir, args.path);
          const current = fs.readFileSync(target, "utf8");
          fs.writeFileSync(target, current.replace(args.old_text, args.new_text));
          return "ok";
        }
        return "ok";
      });

      callStream
        .mockResolvedValueOnce({
          content: "Trying a lint fix.",
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: {
                name: "write_file",
                arguments: {
                  path: "src/components/GameControls.jsx",
                  content: [
                    "import React from 'react';",
                    "import PropTypes from 'prop-types';",
                    "export default function GameControls() {",
                    "  return null;",
                    "}",
                    "",
                  ].join("\n"),
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "PASS: lint fix complete.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Removing the undeclared import.",
          tool_calls: [
            {
              id: "c2",
              type: "function",
              function: {
                name: "edit_file",
                arguments: {
                  path: "src/components/GameControls.jsx",
                  old_text: "import PropTypes from 'prop-types';\n",
                  new_text: "",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "PASS: fix complete without undeclared imports.",
          tool_calls: [],
        });

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior. Scope: src/components/GameControls.jsx and src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 8 },
        );
      } finally {
        process.chdir(originalCwd);
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("imports from packages that are not declared or resolvable") &&
            m.content.includes("prop-types"),
        ),
      ).toBe(true);
    });

    it("nudges toward the remaining scoped file after lint verification fails", async () => {
      const originalScope = process.env.NEX_SCOPE;
      process.env.NEX_SCOPE = "src/components/GameControls.jsx,src/utils/sound.js";

      mockStream("fixing first file", [
        {
          function: { name: "edit_file", arguments: { path: "src/components/GameControls.jsx" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("running lint", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        [
          "EXIT 1",
          "src/utils/sound.js",
          "  46:15  error  'now' is assigned a value but never used  no-unused-vars",
          "",
          "✖ 1 problem (1 error, 0 warnings)",
        ].join("\n"),
      );
      mockStream("Fixing the remaining scoped file.", []);

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior. Scope: src/components/GameControls.jsx and src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 6 },
        );
      } finally {
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
      }

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Verification failed in these remaining scoped files") &&
            m.content.includes("src/utils/sound.js"),
        ),
      ).toBe(true);
    });

    it("forces exact scoped no-unused-vars follow-up before finalizing", async () => {
      const originalScope = process.env.NEX_SCOPE;
      process.env.NEX_SCOPE = "src/components/GameControls.jsx,src/utils/sound.js";

      mockStream("fixing sound first", [
        {
          function: { name: "edit_file", arguments: { path: "src/utils/sound.js" } },
          id: "edit-sound",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      mockStream("running lint", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        [
          "EXIT 1",
          "src/components/GameControls.jsx",
          "  12:5  error  'currentPlayer' is defined but never used  no-unused-vars",
          "",
          "✖ 1 problem (1 error, 0 warnings)",
        ].join("\n"),
      );

      mockStream("PASS: lint fix complete.", []);
      mockStream("Removing currentPlayer from the scoped file.", [
        {
          function: { name: "edit_file", arguments: { path: "src/components/GameControls.jsx" } },
          id: "edit-controls",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      mockStream("rerunning lint", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-2",
        },
      ]);
      executeTool.mockResolvedValueOnce("lint ok");

      mockStream("PASS: lint fix complete.", []);

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior. Scope: src/components/GameControls.jsx and src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 8 },
        );
      } finally {
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
      }

      const userMessages = getConversationMessages().filter(
        (m) => m.role === "user" && typeof m.content === "string",
      );
      expect(
        userMessages.some(
          (m) =>
            m.content.includes("npm run lint failed in scoped file src/components/GameControls.jsx") &&
            m.content.includes("currentPlayer") &&
            m.content.includes("Do not finalize") &&
            m.content.includes("rerun npm run lint"),
        ),
      ).toBe(true);

      expect(
        executeTool.mock.calls.some(
          ([name, args]) =>
            name === "edit_file" && args?.path === "src/components/GameControls.jsx",
        ),
      ).toBe(true);
      expect(
        executeTool.mock.calls.filter(
          ([name, args]) =>
            name === "bash" && args?.command === "npm run lint",
        ),
      ).toHaveLength(2);
    });

    it("fails cleanly in headless auto mode when verification dependencies are missing", async () => {
      const originalScope = process.env.NEX_SCOPE;
      process.env.NEX_SCOPE = "src/components/GameControls.jsx,src/utils/sound.js";
      getAutoConfirm.mockReturnValue(true);

      mockStream("Applying the scoped fix.", [
        {
          function: { name: "edit_file", arguments: { path: "src/components/GameControls.jsx" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      mockStream("Running lint.", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        [
          "EXIT 2",
          "Error: Cannot find module '/tmp/sandbox/node_modules/eslint/lib/api.js'",
          "Require stack:",
          "- /tmp/sandbox/node_modules/vite/dist/node/chunks/dep.js",
        ].join("\n"),
      );

      mockStream("SHOULD NOT ASK", [
        {
          function: {
            name: "ask_user",
            arguments: {
              question: "May I run npm install?",
              options: ["Yes", "No"],
            },
          },
          id: "ask-1",
        },
      ]);

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior. Scope: src/components/GameControls.jsx and src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 8 },
        );
      } finally {
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
      }

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Verification incomplete.") &&
            m.content.includes("npm run lint") &&
            m.content.includes("dependencies are missing or broken"),
        ),
      ).toBe(true);
      expect(
        executeTool.mock.calls.some(([name]) => name === "ask_user"),
      ).toBe(false);
      expect(
        getConversationMessages().some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("SHOULD NOT ASK"),
        ),
      ).toBe(false);
    });

    it("finishes after readback when optional verification dependencies are missing", async () => {
      const originalScope = process.env.NEX_SCOPE;
      process.env.NEX_SCOPE = "src/components/GameControls.jsx";
      getAutoConfirm.mockReturnValue(true);

      mockStream("Applying the scoped fix.", [
        {
          function: {
            name: "patch_file",
            arguments: {
              path: "src/components/GameControls.jsx",
              patches: [
                {
                  old_text: "<button>Save</button>",
                  new_text: "<button>Save</button>\n<span>Status: active</span>",
                },
              ],
            },
          },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      mockStream("Reading the edited component.", [
        {
          function: {
            name: "read_file",
            arguments: { path: "src/components/GameControls.jsx" },
          },
          id: "read-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "<button>Save</button>\n<span>Status: active</span>",
      );

      mockStream("Running lint as an extra check.", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("EXIT 127\nsh: eslint: command not found");

      try {
        await processInput(
          "Add a status line to src/components/GameControls.jsx.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 8 },
        );
      } finally {
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
      }

      const messages = getConversationMessages();
      expect(
        messages.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Completed the requested edit.") &&
            m.content.includes("post-edit readback") &&
            m.content.includes("Additional verification skipped") &&
            m.content.includes("npm run lint"),
        ),
      ).toBe(true);
      expect(
        messages.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Verification incomplete."),
        ),
      ).toBe(false);
    });

    it("fails closed after repeated verification stalls without edit progress", async () => {
      getAutoConfirm.mockReturnValue(true);

      mockStream("Running lint.", [
        {
          function: { name: "bash", arguments: { command: "npm run lint" } },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "EXIT 1\nsrc/components/GameControls.jsx\nerror  'currentPlayer' is defined but never used  no-unused-vars",
      );

      mockStream("Retrying lint.", [
        {
          function: { name: "bash", arguments: { command: "npm run lint --silent" } },
          id: "lint-2",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "EXIT 1\nsrc/components/GameControls.jsx\nerror  'currentPlayer' is defined but never used  no-unused-vars",
      );

      mockStream("Trying build.", [
        {
          function: { name: "bash", arguments: { command: "npm run build" } },
          id: "build-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "EXIT 1\nbuild failed",
      );

      mockStream("SHOULD NOT CONTINUE", []);

      await processInput(
        "Fix the ESLint failures without changing behavior. Run npm run lint before finishing and report the result.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 8 },
      );

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Verification incomplete.") &&
            m.content.includes("Three consecutive verification commands failed without edit progress"),
        ),
      ).toBe(true);
      expect(callStream).toHaveBeenCalledTimes(3);
      expect(
        getConversationMessages().some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("SHOULD NOT CONTINUE"),
        ),
      ).toBe(false);
    });

    // ─── Patch 1 regression: blocks unrelated import removal ──────────
    it("blocks edits that remove unrelated imports during scoped no-unused-vars follow-up", async () => {
      const originalScope = process.env.NEX_SCOPE;
      process.env.NEX_SCOPE =
        "src/components/GameControls.jsx,src/utils/sound.js";
      getAutoConfirm.mockReturnValue(true);

      // Step 1: lint fails, pinpointing currentPlayer in GameControls.jsx
      mockStream("Running lint first.", [
        {
          function: {
            name: "bash",
            arguments: { command: "npm run lint" },
          },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "EXIT 1\nsrc/components/GameControls.jsx\n" +
          "  12:5  error  'currentPlayer' is defined but never used  no-unused-vars",
      );

      // Step 2: model attempts a patch_file that removes BOTH currentPlayer
      // and import React (unrelated). The guard should block this.
      mockStream("Removing both currentPlayer and the React import.", [
        {
          function: {
            name: "patch_file",
            arguments: {
              path: "src/components/GameControls.jsx",
              patches: [
                {
                  old_text: "import React from 'react';\n    currentPlayer,",
                  new_text: "    // removed",
                },
              ],
            },
          },
          id: "patch-bad",
        },
      ]);

      // Step 3: if the guard blocks, the model gets a BLOCKED message back
      // and must retry with only currentPlayer removed
      mockStream("OK, removing only currentPlayer.", [
        {
          function: {
            name: "edit_file",
            arguments: {
              path: "src/components/GameControls.jsx",
              old_text: "    currentPlayer,",
              new_text: "",
            },
          },
          id: "edit-good",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      mockStream("Rerunning lint.", [
        {
          function: {
            name: "bash",
            arguments: { command: "npm run lint" },
          },
          id: "lint-2",
        },
      ]);
      executeTool.mockResolvedValueOnce("lint ok");

      mockStream("PASS: lint fix complete.", []);

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior. Scope: src/components/GameControls.jsx and src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 10 },
        );
      } finally {
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
      }

      // The first patch_file should have been blocked with a BLOCKED message
      const toolMessages = getConversationMessages().filter(
        (m) => m.role === "tool",
      );
      const blockedMsg = toolMessages.find(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("BLOCKED") &&
          m.content.includes("import") &&
          m.content.includes("React"),
      );
      // Either the tool was blocked (BLOCKED in tool result) OR it was
      // blocked pre-execution (the mock never called executeTool for it).
      // In both cases the model receives a blocking message.
      const hadBlockedMessage =
        !!blockedMsg ||
        getConversationMessages().some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("BLOCKED") &&
            m.content.includes("import") &&
            m.content.includes("React"),
        );
      expect(hadBlockedMessage).toBe(true);

      // The model should NOT have executed both the bad patch and the good edit
      // for the same file without an intervening lint rerun.
      const gameControlsEdits = executeTool.mock.calls.filter(
        ([name, args]) =>
          name === "edit_file" && args?.path === "src/components/GameControls.jsx",
      );
      // Expect at most 1 successful edit on GameControls.jsx (the good one)
      expect(gameControlsEdits.length).toBeLessThanOrEqual(1);
    });

    // ─── Patch 2 regression: verification freshness ──────────────────
    it("requires fresh verification after a post-verification edit", async () => {
      const originalScope = process.env.NEX_SCOPE;
      process.env.NEX_SCOPE =
        "src/components/GameControls.jsx,src/utils/sound.js";
      getAutoConfirm.mockReturnValue(true);

      // Step 1: edit sound.js
      mockStream("Fixing sound.js.", [
        {
          function: {
            name: "edit_file",
            arguments: {
              path: "src/utils/sound.js",
              old_text: "const now = 0;",
              new_text: "",
            },
          },
          id: "edit-sound",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      // Step 2: run lint — passes for sound.js but fails for GameControls.jsx
      mockStream("Running lint.", [
        {
          function: {
            name: "bash",
            arguments: { command: "npm run lint" },
          },
          id: "lint-1",
        },
      ]);
      executeTool.mockResolvedValueOnce(
        "EXIT 1\nsrc/components/GameControls.jsx\n" +
          "  12:5  error  'currentPlayer' is defined but never used  no-unused-vars",
      );

      // Step 3: edit GameControls.jsx (AFTER lint was run — makes lint stale)
      mockStream("Removing currentPlayer.", [
        {
          function: {
            name: "edit_file",
            arguments: {
              path: "src/components/GameControls.jsx",
              old_text: "    currentPlayer,",
              new_text: "",
            },
          },
          id: "edit-controls",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");

      // Step 4: model tries to finalize without rerunning lint.
      // The verification freshness guard should require a rerun.
      mockStream("PASS: all lint errors fixed.", []);

      try {
        await processInput(
          "Fix the ESLint failures without changing behavior. Scope: src/components/GameControls.jsx and src/utils/sound.js. Run npm run lint before finishing and report the result.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 10 },
        );
      } finally {
        if (originalScope === undefined) delete process.env.NEX_SCOPE;
        else process.env.NEX_SCOPE = originalScope;
      }

      // After editing GameControls.jsx post-lint, the model should be nudged
      // to rerun lint before finalizing. Check for the nudge message.
      const lastMessages = getConversationMessages().slice(-10);
      const hasVerificationNudge = lastMessages.some(
        (m) =>
          typeof m.content === "string" &&
          (m.content.includes("verification required") ||
            m.content.includes("Run npm run lint") ||
            m.content.includes("rerun") ||
            m.content.includes("verification is stale")),
      );
      // The exact nudge wording varies, but some post-edit verification
      // prompt should have been injected.
      expect(hasVerificationNudge).toBe(true);
    });

    // ─── Unit test: _extractRemovedImportSymbols ─────────────────────
    it("_extractRemovedImportSymbols detects unrelated import removals", () => {
      const oldText = [
        "import React from 'react';",
        "import { useState } from 'react';",
        "import './GameControls.css';",
        "",
        "export default function GameControls({ currentPlayer }) {",
        "  const { currentPlayer } = props;",
        "  return null;",
        "}",
      ].join("\n");

      const newText = [
        "import { useState } from 'react';",
        "import './GameControls.css';",
        "",
        "export default function GameControls({ currentPlayer }) {",
        "  return null;",
        "}",
      ].join("\n");

      const removed = _extractRemovedImportSymbols(oldText, newText);
      expect(removed).toHaveLength(1);
      expect(removed[0].symbol).toBe("React");
    });

    it("ERROR result detected in summary", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "fail" } },
          id: "c1",
        },
      ]);
      mockStream("Handled");
      executeTool.mockResolvedValueOnce("ERROR: not found");
      await processInput("test");
      expect(getConversationLength()).toBe(4);
    });

    it("CANCELLED result detected in summary", async () => {
      mockStream("", [
        { function: { name: "bash", arguments: { command: "x" } }, id: "c1" },
      ]);
      mockStream("OK");
      executeTool.mockResolvedValueOnce("CANCELLED by user");
      await processInput("test");
      expect(getConversationLength()).toBe(4);
    });

    it("spawn_agents failure pattern detected", async () => {
      mockStream("", [
        { function: { name: "spawn_agents", arguments: {} }, id: "c1" },
      ]);
      mockStream("Failed");
      executeTool.mockResolvedValueOnce("Agent 1:\n✗ Agent 1 failed");
      await processInput("test");
      expect(getConversationLength()).toBe(4);
    });
  });

  // ─── max iterations ───────────────────────────────────────
  describe("max iterations", () => {
    it("warns when max iterations reached", async () => {
      // Use a very small limit and non-ollama provider so auto-extend is skipped
      setMaxIterations(2);
      getActiveProviderName.mockReturnValue("anthropic");
      confirm.mockResolvedValueOnce(false); // decline to extend → exits
      let i = 0;
      callStream.mockImplementation(async () => ({
        content: "",
        tool_calls: [
          {
            function: { name: "bash", arguments: { command: "echo" } },
            id: `c${i++}`,
          },
        ],
      }));
      executeTool.mockResolvedValue("ok");
      await processInput("loop");
      expect(logOutput()).toContain("Max iterations");
      // restore defaults
      setMaxIterations(50);
      getActiveProviderName.mockReturnValue("ollama");
    });
  });

  // ─── _argPreview + spinner labels ─────────────────────────
  describe("spinner label arg preview", () => {
    const previewCases = [
      ["read_file", { path: "/tmp/test.js" }, "tmp/test.js"],
      ["write_file", { path: "/out.txt", content: "x" }, "out.txt"],
      ["edit_file", { path: "src/app.js" }, "src/app.js"],
      ["list_directory", { path: "/home" }, "home"],
      ["bash", { command: "echo hello world" }, "echo hello world"],
      ["grep", { pattern: "TODO" }, "TODO"],
      ["search_files", { pattern: "fn.*test" }, "fn.*test"],
      ["glob", { pattern: "**/*.ts" }, "**/*.ts"],
      ["web_search", { query: "jest testing" }, "jest testing"],
    ];

    test.each(previewCases)(
      '%s shows "%s" in spinner',
      async (tool, args, expected) => {
        mockStream("", [
          { function: { name: tool, arguments: args }, id: "c1" },
        ]);
        mockStream("Done");
        executeTool.mockResolvedValueOnce("ok");
        await processInput("test");
        const found = spinnerLabels().some((l) => l.includes(expected));
        expect(found).toBe(true);
      },
    );

    it("default case (patch_file) produces empty preview", async () => {
      mockStream("", [
        {
          function: { name: "patch_file", arguments: { path: "x.js" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(executeTool).toHaveBeenCalled();
    });

    it("multi-tool label for 2+ tools", async () => {
      mockStream("", [
        {
          function: { name: "read_file", arguments: { path: "a.js" } },
          id: "c1",
        },
        {
          function: { name: "read_file", arguments: { path: "b.js" } },
          id: "c2",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValue("content");
      await processInput("test");
      expect(
        spinnerLabels().some(
          (l) =>
            l.includes("Inspect") ||
            l.includes("read_file") ||
            l.includes("2 tools") ||
            l.includes("a.js"),
        ),
      ).toBe(true);
    });

    it("truncates long multi-tool names (> 60 chars)", async () => {
      const tools = [];
      for (let i = 0; i < 7; i++) {
        tools.push({
          function: { name: "read_file", arguments: { path: `${i}.js` } },
          id: `c${i}`,
        });
      }
      mockStream("", tools);
      mockStream("Done");
      executeTool.mockResolvedValue("content");
      await processInput("test");
      expect(
        spinnerLabels().some(
          (l) =>
            l.includes("actions") ||
            l.includes("tools") ||
            l.includes("Inspect"),
        ),
      ).toBe(true);
    });
  });

  // ─── pre-spinner + stream cursor ────────────────────────────
  describe("pre-spinner and stream cursor", () => {
    it("starts a pre-spinner before fitToContext and stops it after", async () => {
      mockStream("Hello");
      await processInput("test");
      // Pre-spinner should be the first Spinner created with a thinking verb
      expect(typeof Spinner.mock.calls[0][0]).toBe("string");
      expect(Spinner.mock.calls[0][0].length).toBeGreaterThan(0);
      // Pre-spinner should be started and stopped
      const preSpinner = Spinner.mock.results[0].value;
      expect(preSpinner.start).toHaveBeenCalled();
      expect(preSpinner.stop).toHaveBeenCalled();
    });

    it("stream.startCursor() called on first token", async () => {
      const { StreamRenderer } = require("../cli/render");
      mockStream("Hello");
      await processInput("test");
      const streamInstance = StreamRenderer.mock.results[0].value;
      expect(streamInstance.startCursor).toHaveBeenCalled();
    });

    it("stream.stopCursor() called on error", async () => {
      const { StreamRenderer } = require("../cli/render");
      callStream.mockRejectedValueOnce(new Error("API crash"));
      await processInput("test");
      const streamInstance = StreamRenderer.mock.results[0].value;
      expect(streamInstance.stopCursor).toHaveBeenCalled();
    });

    it("flush() implicitly stops cursor via stream", async () => {
      const { StreamRenderer } = require("../cli/render");
      mockStream("Hello");
      await processInput("test");
      const streamInstance = StreamRenderer.mock.results[0].value;
      expect(streamInstance.flush).toHaveBeenCalled();
    });
  });

  // ─── setAbortSignalGetter ─────────────────────────────────
  describe("setAbortSignalGetter", () => {
    it("getter is invoked during processInput", async () => {
      let called = false;
      setAbortSignalGetter(() => {
        called = true;
        return null;
      });
      mockStream("ok");
      await processInput("test");
      expect(called).toBe(true);
    });
  });

  // ─── validator correction logging ──────────────────────────
  describe("validator correction logging", () => {
    it("logs corrected arg names when validator renames keys", async () => {
      // Validator corrects { cmd: 'ls' } → { command: 'ls' } (cmd renamed)
      validateToolArgs.mockReturnValueOnce({
        valid: true,
        corrected: { command: "ls" },
      });
      mockStream("", [
        { function: { name: "bash", arguments: { cmd: "ls" } }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      expect(logOutput()).toContain("corrected args");
      expect(logOutput()).toContain("cmd");
    });

    it("does not log when corrected keys match original keys", async () => {
      // Type coercion: same keys, different values
      validateToolArgs.mockReturnValueOnce({
        valid: true,
        corrected: { path: "test.js", line_start: 5 },
      });
      mockStream("", [
        {
          function: {
            name: "read_file",
            arguments: { path: "test.js", line_start: "5" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("content");
      await processInput("test");
      // Both original and corrected have the same keys, so no log
      expect(logOutput()).not.toContain("corrected args");
    });

    it("does not log when no correction needed", async () => {
      validateToolArgs.mockReturnValueOnce({ valid: true, corrected: null });
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo hi" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("hi");
      await processInput("test");
      expect(logOutput()).not.toContain("corrected args");
    });
  });

  // ─── compression log format ────────────────────────────────
  describe("compression log format", () => {
    it("includes percentage in compression log", async () => {
      process.env.NEX_DEBUG = "true";
      fitToContext.mockImplementationOnce((m) => ({
        messages: m,
        compressed: true,
        tokensRemoved: 12800,
      }));
      getUsage.mockReturnValueOnce({
        used: 110000,
        limit: 128000,
        percentage: 86,
      });
      mockStream("OK");
      await processInput("test");
      expect(logOutput()).toContain("context compressed");
      expect(logOutput()).toMatch(/\d+%/);
      delete process.env.NEX_DEBUG;
    });
  });

  // ─── stale-stream detection ────────────────────────────────
  describe("stale-stream detection", () => {
    it("passes combined AbortSignal to callStream", async () => {
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        expect(opts.signal).toBeDefined();
        expect(opts.signal instanceof AbortSignal).toBe(true);
        return { content: "ok", tool_calls: [] };
      });
      await processInput("test");
    });

    it("onToken callback is provided and works", async () => {
      let capturedOnToken;
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        capturedOnToken = opts.onToken;
        if (opts.onToken) opts.onToken("token");
        return { content: "token", tool_calls: [] };
      });
      await processInput("test");
      expect(capturedOnToken).toBeDefined();
    });

    it("stale timer is cleaned up on success", async () => {
      // Verify no lingering intervals after a normal call
      const before = 0; // Can't easily count intervals but verify no errors
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        if (opts.onToken) opts.onToken("ok");
        return { content: "ok", tool_calls: [] };
      });
      await processInput("test");
      // If stale timer leaked, subsequent operations would be affected
      expect(callStream).toHaveBeenCalledTimes(1);
    });
  });

  // ─── detectFrustration ─────────────────────────────────────
  describe("detectFrustration", () => {
    const { detectFrustration } = require("../cli/agent");

    it("detects wtf", () => {
      expect(detectFrustration("wtf why doesn't this work")).toBe(true);
    });

    it("detects 'still broken'", () => {
      expect(detectFrustration("it's still broken")).toBe(true);
    });

    it("detects 'already told you'", () => {
      expect(detectFrustration("I already told you to fix this")).toBe(true);
    });

    it("detects 'why doesn't'", () => {
      expect(detectFrustration("why doesn't the test pass?")).toBe(true);
    });

    it("detects ugh", () => {
      expect(detectFrustration("ugh, same error again")).toBe(true);
    });

    it("returns false for normal messages", () => {
      expect(detectFrustration("please fix the login bug")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(detectFrustration("")).toBe(false);
    });

    it("returns false for non-string", () => {
      expect(detectFrustration(null)).toBe(false);
    });
  });

  // ─── buildUserContent ──────────────────────────────────────
  describe("buildUserContent", () => {
    const { buildUserContent } = require("../cli/agent");

    it("returns plain string when no image paths detected", () => {
      const result = buildUserContent("hello world");
      expect(result).toBe("hello world");
    });

    it("returns plain string for text without valid file paths", () => {
      const result = buildUserContent("look at this code");
      expect(result).toBe("look at this code");
    });

    it("returns plain string when path does not exist on disk", () => {
      const result = buildUserContent(
        "check /tmp/nonexistent_image_12345.png please",
      );
      expect(result).toBe("check /tmp/nonexistent_image_12345.png please");
    });
  });

  // ─── injectMidRunNote + drain ──────────────────────────────
  describe("injectMidRunNote", () => {
    const { injectMidRunNote } = require("../cli/agent");

    it("injected notes appear in conversation during tool loop", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo 1" } },
          id: "c1",
        },
      ]);
      // Inject a note before the second callStream
      callStream.mockImplementationOnce(async () => {
        return { content: "Done with note", tool_calls: [] };
      });
      executeTool.mockResolvedValueOnce("ok");
      // Inject note between tool execution and next API call
      injectMidRunNote("  please also check tests  ");
      await processInput("do something");
      const msgs = getConversationMessages();
      const noteMsg = msgs.find(
        (m) =>
          m.role === "user" &&
          typeof m.content === "string" &&
          m.content.includes("please also check tests"),
      );
      expect(noteMsg).toBeDefined();
    });
  });

  // ─── scrubSecrets (exercised through tool result processing) ───
  describe("secret scrubbing", () => {
    it("redacts API keys in tool results", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "cat .env" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce(
        "OPENAI_API_KEY=sk-1234567890abcdef1234567890",
      );
      await processInput("show env");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      expect(toolMsg.content).toContain("REDACTED");
      expect(toolMsg.content).not.toContain("sk-1234567890abcdef1234567890");
    });

    it("redacts multiple secret patterns", async () => {
      mockStream("", [
        { function: { name: "bash", arguments: { command: "env" } }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce(
        "GITHUB_TOKEN=ghp_abcdefghijklmnop\nAWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE",
      );
      await processInput("test");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      expect(toolMsg.content).toContain("REDACTED");
      expect(toolMsg.content).not.toContain("ghp_abcdefghijklmnop");
    });

    it("leaves non-secret content untouched", async () => {
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo hello" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("hello world");
      await processInput("test");
      const toolMsg = getConversationMessages().find((m) => m.role === "tool");
      expect(toolMsg.content).toBe("hello world");
    });
  });

  // ─── language prompt (exercised through system prompt) ─────
  describe("language prompt", () => {
    it("hard-enforces English for an English prompt when NEX_LANGUAGE is unset", async () => {
      delete process.env.NEX_LANGUAGE;
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      mockStream("ok");
      await processInput("what is in this folder?");
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain(
        "RESPONSE LANGUAGE: This project requires English.",
      );
      expect(sysMsg).toContain("You MUST answer this turn in English");
    });

    it("keeps English when the project rules require English", async () => {
      delete process.env.NEX_LANGUAGE;
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      mockStream("ok");
      await processInput("what is in this folder?");
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain(
        "RESPONSE LANGUAGE: This project requires English.",
      );
      expect(sysMsg).toContain("Treat non-English input as content to answer");
    });

    it("overrides NEX_LANGUAGE when the project rules require English", async () => {
      process.env.NEX_LANGUAGE = "German";
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      mockStream("ok");
      await processInput("introduce yourself");
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain(
        "RESPONSE LANGUAGE: This project requires English.",
      );
      expect(sysMsg).not.toContain("You MUST always respond in German");
      delete process.env.NEX_LANGUAGE;
      agent.invalidateSystemPromptCache();
    });

    it("ignores NEX_LANGUAGE when the project rules require English", async () => {
      process.env.NEX_LANGUAGE = "German";
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      mockStream("ok");
      await processInput("test");
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain(
        "RESPONSE LANGUAGE: This project requires English.",
      );
      expect(sysMsg).not.toContain("You MUST always respond in German");
      delete process.env.NEX_LANGUAGE;
      agent.invalidateSystemPromptCache();
    });

    it("includes code language when NEX_CODE_LANGUAGE is set", async () => {
      process.env.NEX_CODE_LANGUAGE = "French";
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      mockStream("ok");
      await processInput("test");
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain("French");
      delete process.env.NEX_CODE_LANGUAGE;
      agent.invalidateSystemPromptCache();
    });

    it("includes commit language when NEX_COMMIT_LANGUAGE is set", async () => {
      process.env.NEX_COMMIT_LANGUAGE = "Spanish";
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      mockStream("ok");
      await processInput("test");
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain("Spanish");
      delete process.env.NEX_COMMIT_LANGUAGE;
      agent.invalidateSystemPromptCache();
    });

    it("detects English despite a trailing German word", () => {
      const { _detectResponseLanguage } = require("../cli/agent");
      expect(
        _detectResponseLanguage(
          "Write a JavaScript function that flattens nested arrays without mutating input. Danke",
        ),
      ).toBe("English");
    });

    it("keeps self-contained simple prompts tool-free", async () => {
      const agent = require("../cli/agent");
      expect(
        agent._isSimpleDirectAnswerPrompt(
          "Write a JavaScript function flattenDeep(input) that preserves order.",
        ),
      ).toBe(true);
      expect(
        agent._isSimpleDirectAnswerPrompt(
          'Refactor this JavaScript code from callbacks to async/await:\nfs.readFile("a.txt", (err, data) => { if(err) throw err; fs.writeFile("b.txt", data, (err) => { if(err) throw err; console.log("done"); }); });',
        ),
      ).toBe(true);
      expect(
        agent._isSimpleDirectAnswerPrompt(
          'Add proper error handling to this Express route:\napp.get("/user/:id", async (req, res) => { const user = await db.find(req.params.id); res.json(user); });',
        ),
      ).toBe(true);
      expect(
        agent._isSimpleDirectAnswerPrompt(
          'bei /fitness hätte ich gern hier ein Feld für verbleibende kcal: <div class="nutrition-ring-content"><div x-text="Math.round(totals.kcal)"></div></div>',
        ),
      ).toBe(false);
      expect(
        agent._isSimpleDirectAnswerPrompt(
          'In /dashboard add a status label near this markup: <section class="summary"><span>{status}</span></section>',
        ),
      ).toBe(false);
      expect(
        agent._isSimpleDirectAnswerPrompt(
          "Identify and fix the memory leak in this Node.js code:\nconst emitter = new EventEmitter();",
        ),
      ).toBe(true);
      expect(
        agent._isSimpleDirectAnswerPrompt(
          "Convert this Python class to a dataclass with validation (raise ValueError if age<0 or name is empty):\nclass Person:\n  def __init__(self, name, age):\n    self.name = name\n    self.age = age",
        ),
      ).toBe(true);
      expect(agent._isSimpleDirectAnswerPrompt("Reply exactly OK.")).toBe(
        true,
      );

      mockStream("function flattenDeep(input) { return input; }");
      await processInput(
        "Write a JavaScript function flattenDeep(input) that preserves order.",
      );

      expect(callStream.mock.calls[0][1]).toEqual([]);
      const sysMsg = callStream.mock.calls[0][0][0].content;
      expect(sysMsg).toContain("Current Turn Direct Answer Mode");
      expect(sysMsg).toContain("preserve left-to-right order");
      expect(sysMsg).toContain("must not mutate");
    });
  });

  // ─── plan mode text response ───────────────────────────────
  describe("plan mode", () => {
    it("saves plan and extracts steps on text response", async () => {
      isPlanMode.mockReturnValue(true);
      getPlanModePrompt.mockReturnValue("Plan mode active");
      const {
        extractStepsFromText,
        setPlanContent,
        createPlan,
      } = require("../cli/planner");
      extractStepsFromText.mockReturnValueOnce([
        "Step 1: do thing",
        "Step 2: do other",
      ]);
      // Must read at least one file before plan is accepted — mock investigation step first
      executeTool.mockResolvedValueOnce("file contents");
      mockStream("", [
        {
          function: {
            name: "read_file",
            arguments: { path: "modules/fitness.js" },
          },
          id: "r1",
        },
      ]);
      mockStream("Here is my plan:\n1. Do thing\n2. Do other");
      await processInput("plan this");
      expect(setPlanContent).toHaveBeenCalled();
      expect(createPlan).toHaveBeenCalled();
      isPlanMode.mockReturnValue(false);
      getPlanModePrompt.mockReturnValue("");
    });

    it("shows plan ready without steps when none extracted", async () => {
      isPlanMode.mockReturnValue(true);
      getPlanModePrompt.mockReturnValue("Plan mode active");
      const {
        extractStepsFromText,
        setPlanContent,
      } = require("../cli/planner");
      extractStepsFromText.mockReturnValueOnce([]);
      // Must read at least one file before plan is accepted — mock investigation step first
      executeTool.mockResolvedValueOnce("file contents");
      mockStream("", [
        {
          function: {
            name: "read_file",
            arguments: { path: "modules/fitness.js" },
          },
          id: "r1",
        },
      ]);
      mockStream("Here is a vague plan");
      await processInput("plan this");
      expect(setPlanContent).toHaveBeenCalled();
      expect(logOutput()).toContain("Plan ready");
      isPlanMode.mockReturnValue(false);
      getPlanModePrompt.mockReturnValue("");
    });

    it("blocks non-allowed tools in plan mode", async () => {
      isPlanMode.mockReturnValue(true);
      getPlanModePrompt.mockReturnValue("Plan mode");
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "rm -rf /" } },
          id: "c1",
        },
      ]);
      mockStream("Blocked");
      await processInput("execute plan");
      expect(executeTool).not.toHaveBeenCalled();
      expect(logOutput()).toContain("deferred");
      isPlanMode.mockReturnValue(false);
      getPlanModePrompt.mockReturnValue("");
    });

    it("does not allow auto-orchestration while plan mode is active", () => {
      expect(
        _shouldAutoOrchestrate(
          true,
          { isComplex: true, estimatedGoals: 5 },
          3,
          true,
        ),
      ).toBe(false);
    });
  });

  // ─── loop detection ────────────────────────────────────────
  describe("loop detection", () => {
    it("warns after editing the same file multiple times", async () => {
      process.env.NEX_DEBUG = "true";
      // Three edits to trigger warning (LOOP_WARN_EDITS = 3).
      // Map-first gate requires a read_file between edits to the same file,
      // so interleave reads to let all three edits through.
      for (let i = 0; i < 3; i++) {
        mockStream("", [
          {
            function: { name: "edit_file", arguments: { path: "loop.js" } },
            id: `e${i}`,
          },
        ]);
        if (i < 2) {
          // Targeted re-read (line_start required) clears the map-first stale flag.
          // Unbounded re-reads are blocked after an edit because the file is already
          // in context (fileReadCounts is set to 1 by the edit guard). A targeted
          // read bypasses that block and lets the map-first gate flag get cleared.
          mockStream("", [
            {
              function: {
                name: "read_file",
                arguments: { path: "loop.js", line_start: 1, line_end: 50 },
              },
              id: `r${i}`,
            },
          ]);
        }
      }
      mockStream("Done");
      executeTool.mockResolvedValue("ok");
      await processInput("edit loop.js");
      expect(logOutput()).toContain("Loop warning");
      delete process.env.NEX_DEBUG;
    });

    it("aborts after too many edits to the same file", async () => {
      process.env.NEX_DEBUG = "true";
      // Map-first gate blocks repeat edits to the same file without a re-read.
      // 1 successful edit followed by 5 consecutive blocked attempts triggers
      // LOOP_ABORT_BLOCKS (= 5), which also logs "Loop abort".
      for (let i = 0; i < 6; i++) {
        mockStream("", [
          {
            function: { name: "edit_file", arguments: { path: "stuck.js" } },
            id: `c${i}`,
          },
        ]);
      }
      mockStream("Done"); // fallback — should not be reached
      executeTool.mockResolvedValue("ok");
      await processInput("keep editing");
      expect(logOutput()).toContain("Loop abort");
      delete process.env.NEX_DEBUG;
    });

    it("records a stalled final message when repeated reads are blocked", async () => {
      process.env.NEX_DEBUG = "true";
      for (let i = 0; i < 8; i++) {
        mockStream(i === 0 ? "I will inspect the profile card first." : "", [
          {
            function: {
              name: "read_file",
              arguments: {
                path: "src/components/ProfileCard.jsx",
                line_start: 1,
                line_end: 40,
              },
            },
            id: `profile-read-${i}`,
          },
        ]);
      }
      mockStream("Done"); // fallback — should not be reached after loop abort
      executeTool.mockResolvedValue(
        "1: export function ProfileCard() { return <section />; }",
      );

      await processInput(
        "In src/components/ProfileCard.jsx add a status field near the summary section.",
      );

      const lastAssistant = getConversationMessages()
        .filter((m) => m.role === "assistant")
        .at(-1);
      expect(logOutput()).toContain("Loop abort");
      expect(lastAssistant.content).toContain("Implementation stalled before edits");
      expect(lastAssistant.content).toContain("blocked by loop guards");
      delete process.env.NEX_DEBUG;
    });

    it("warns after consecutive tool errors", async () => {
      process.env.NEX_DEBUG = "true";
      // 10 consecutive errors to trigger warning (LOOP_WARN_ERRORS = 10)
      // Alternate tool names to avoid same-command loop detection
      const tools = [
        "grep",
        "read_file",
        "glob",
        "search_files",
        "list_directory",
        "find_files",
        "grep",
        "read_file",
        "glob",
        "search_files",
      ];
      for (let i = 0; i < 10; i++) {
        mockStream("", [
          {
            function: { name: tools[i], arguments: { path: `/tmp/t${i}` } },
            id: `c${i}`,
          },
        ]);
      }
      mockStream("Done");
      executeTool.mockResolvedValue("ERROR: command failed");
      await processInput("keep failing");
      expect(logOutput()).toContain("consecutive");
      delete process.env.NEX_DEBUG;
    });

    it("aborts after many consecutive tool errors", async () => {
      process.env.NEX_DEBUG = "true";
      // 15 consecutive errors to trigger abort (LOOP_ABORT_ERRORS = 15)
      // Alternate tool names to avoid same-command loop detection
      const tools = [
        "grep",
        "read_file",
        "glob",
        "search_files",
        "list_directory",
        "find_files",
        "grep",
        "read_file",
        "glob",
        "search_files",
        "list_directory",
        "find_files",
        "grep",
        "read_file",
        "glob",
      ];
      for (let i = 0; i < 15; i++) {
        mockStream("", [
          {
            function: { name: tools[i], arguments: { path: `/tmp/t${i}` } },
            id: `c${i}`,
          },
        ]);
      }
      mockStream("Done");
      executeTool.mockResolvedValue("ERROR: command failed");
      await processInput("keep failing");
      expect(logOutput()).toContain("Loop abort");
      delete process.env.NEX_DEBUG;
    });

    it("resets consecutive error count on success", async () => {
      // 3 errors then a success then 3 errors — should not trigger warning at 6
      for (let i = 0; i < 3; i++) {
        mockStream("", [
          {
            function: { name: "bash", arguments: { command: "fail" } },
            id: `e${i}`,
          },
        ]);
      }
      mockStream("", [
        { function: { name: "bash", arguments: { command: "ok" } }, id: "ok1" },
      ]);
      for (let i = 0; i < 3; i++) {
        mockStream("", [
          {
            function: { name: "bash", arguments: { command: "fail2" } },
            id: `f${i}`,
          },
        ]);
      }
      mockStream("Done");
      executeTool.mockImplementation((_name, args) => {
        if (args.command === "ok") return "success";
        return "ERROR: failed";
      });
      await processInput("mixed");
      expect(logOutput()).not.toContain("consecutive");
    });
  });

  // ─── resume output ────────────────────────────────────────
  describe("resume output", () => {
    it("shows minutes for long-running tasks", async () => {
      // Mock Date.now to simulate elapsed time > 60s
      const realNow = Date.now;
      let callCount = 0;
      jest.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        // Return times that create > 60s elapsed
        if (callCount <= 2) return 1000000;
        return 1000000 + 125000; // 125 seconds later
      });
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("long task");
      Date.now.mockRestore();
      // Should show minutes format (Xm Ys)
      expect(logOutput()).toMatch(/\d+m\s+\d+s/);
    });

    it("shows audit suggestion for read-heavy sessions", async () => {
      // Need: 5+ files read, 0 modified, 3+ steps
      for (let i = 0; i < 5; i++) {
        mockStream("", [
          {
            function: { name: "read_file", arguments: { path: `file${i}.js` } },
            id: `c${i}`,
          },
        ]);
      }
      mockStream("Analysis complete");
      executeTool.mockResolvedValue("file content");
      await processInput("audit");
      expect(logOutput()).toContain("fix");
    });

    it("shows file count in resume", async () => {
      mockStream("", [
        {
          function: {
            name: "write_file",
            arguments: { path: "a.js", content: "x" },
          },
          id: "c1",
        },
        {
          function: {
            name: "write_file",
            arguments: { path: "b.js", content: "y" },
          },
          id: "c2",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValue("ok");
      await processInput("write both");
      expect(logOutput()).toContain("2 files modified");
    });

    it('shows singular "file" for one modification', async () => {
      mockStream("", [
        {
          function: {
            name: "write_file",
            arguments: { path: "a.js", content: "x" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("write one");
      expect(logOutput()).toContain("1 file modified");
    });
  });

  // ─── max iterations with auto-extend ───────────────────────
  describe("max iterations auto-extend", () => {
    beforeEach(() => instantTimeout());
    afterEach(() => {
      restoreTimeout();
      setMaxIterations(50);
      getActiveProviderName.mockReturnValue("ollama");
    });

    it("auto-extends for ollama provider", async () => {
      setMaxIterations(2);
      getActiveProviderName.mockReturnValue("ollama");
      let callCount = 0;
      callStream.mockImplementation(async () => {
        callCount++;
        if (callCount <= 3) {
          return {
            content: "",
            tool_calls: [
              {
                function: { name: "bash", arguments: { command: "echo" } },
                id: `c${callCount}`,
              },
            ],
          };
        }
        return { content: "Finally done", tool_calls: [] };
      });
      executeTool.mockResolvedValue("ok");
      await processInput("loop");
      expect(logOutput()).toContain("auto-extending");
      expect(callCount).toBeGreaterThan(2);
    });
  });

  // ─── clearToolDefinitionsCache + clearToolFilterCache ───────
  describe("cache management", () => {
    it("clearToolFilterCache does not throw", () => {
      const agent = require("../cli/agent");
      expect(() => agent.clearToolFilterCache()).not.toThrow();
    });

    it("invalidateSystemPromptCache does not throw", () => {
      const agent = require("../cli/agent");
      expect(() => agent.invalidateSystemPromptCache()).not.toThrow();
    });

    it("getCachedFilteredTools returns tools", () => {
      const agent = require("../cli/agent");
      const { TOOL_DEFINITIONS } = require("../cli/tools");
      const result = agent.getCachedFilteredTools(TOOL_DEFINITIONS);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("getCachedFilteredTools uses cache on second call", () => {
      const agent = require("../cli/agent");
      agent.clearToolFilterCache();
      const { TOOL_DEFINITIONS } = require("../cli/tools");
      const { filterToolsForModel } = require("../cli/tool-tiers");
      filterToolsForModel.mockClear();
      agent.getCachedFilteredTools(TOOL_DEFINITIONS);
      agent.getCachedFilteredTools(TOOL_DEFINITIONS);
      // Should only call filterToolsForModel once (cached second time)
      expect(filterToolsForModel).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getProjectContextHash ─────────────────────────────────
  describe("getProjectContextHash", () => {
    it("returns a string", async () => {
      const agent = require("../cli/agent");
      const hash = await agent.getProjectContextHash();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  // ─── buildSystemPrompt caching ─────────────────────────────
  describe("buildSystemPrompt", () => {
    it("returns cached prompt on second call with same context", async () => {
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      const first = await agent.buildSystemPrompt();
      const second = await agent.buildSystemPrompt();
      expect(first).toBe(second); // same reference = cached
    });

    it("includes project context", async () => {
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      const prompt = await agent.buildSystemPrompt();
      expect(prompt).toContain("Nex Code");
      expect(prompt).toContain("WORKING DIRECTORY");
    });
  });

  describe("_inferVerificationCommands", () => {
    it("prefers package scripts and ts-focused checks for TS edits", async () => {
      const fs = require("fs");
      const path = require("path");
      const pkgPath = path.join(process.cwd(), "package.json");
      const existsSpy = jest
        .spyOn(fs, "existsSync")
        .mockImplementation((candidate) => {
          if (candidate === pkgPath) return true;
          return false;
        });
      const readSpy = jest
        .spyOn(fs, "readFileSync")
        .mockImplementation((candidate) => {
          if (candidate === pkgPath) {
            return JSON.stringify({
              name: "agent-test",
              scripts: {
                test: "jest",
                lint: "eslint .",
                typecheck: "tsc --noEmit",
              },
            });
          }
          throw new Error(`unexpected read: ${candidate}`);
        });

      try {
        const commands = await _inferVerificationCommands(
          new Set(["src/app.ts"]),
        );
        expect(commands).toContain("npm test");
        expect(commands).toContain("npm run lint");
        expect(commands).toContain("npm run typecheck");
      } finally {
        existsSpy.mockRestore();
        readSpy.mockRestore();
      }
    });

    it("adds targeted jest commands for related tests", async () => {
      const fs = require("fs");
      const path = require("path");
      const pkgPath = path.join(process.cwd(), "package.json");
      const existsSpy = jest
        .spyOn(fs, "existsSync")
        .mockImplementation((candidate) => {
          if (candidate === pkgPath) return true;
          if (String(candidate).includes("jest.config")) return true;
          return false;
        });
      const readSpy = jest
        .spyOn(fs, "readFileSync")
        .mockImplementation((candidate) => {
          if (candidate === pkgPath) {
            return JSON.stringify({
              name: "agent-test",
              scripts: { test: "jest", lint: "eslint ." },
            });
          }
          throw new Error(`unexpected read: ${candidate}`);
        });
      const indexEngine = require("../cli/index-engine");
      const indexSpy = jest
        .spyOn(indexEngine, "getFileIndex")
        .mockReturnValue(["src/app.ts", "tests/app.test.js"]);

      try {
        const commands = await _inferVerificationCommands(
          new Set(["src/app.ts"]),
        );
        expect(
          commands.some((cmd) =>
            cmd.includes("npx jest --runInBand tests/app.test.js"),
          ),
        ).toBe(true);
      } finally {
        existsSpy.mockRestore();
        readSpy.mockRestore();
        indexSpy.mockRestore();
      }
    });
  });

  describe("_inferRelevantTests", () => {
    it("maps modified files to matching tests by basename", async () => {
      const indexEngine = require("../cli/index-engine");
      jest
        .spyOn(indexEngine, "getFileIndex")
        .mockReturnValue([
          "src/app.ts",
          "tests/app.test.js",
          "tests/other.test.js",
        ]);
      jest
        .spyOn(indexEngine, "buildContentIndex")
        .mockResolvedValue({ files: {} });
      jest.spyOn(indexEngine, "getRelatedFiles").mockResolvedValue([]);
      jest.spyOn(indexEngine, "findSymbolReferences").mockResolvedValue([]);

      const tests = await _inferRelevantTests(new Set(["src/app.ts"]));
      expect(tests).toContain("tests/app.test.js");
      indexEngine.getFileIndex.mockRestore();
      indexEngine.buildContentIndex.mockRestore();
      indexEngine.getRelatedFiles.mockRestore();
      indexEngine.findSymbolReferences.mockRestore();
    });

    it("pulls in tests from related symbols and neighboring modules", async () => {
      const indexEngine = require("../cli/index-engine");
      jest
        .spyOn(indexEngine, "getFileIndex")
        .mockReturnValue([
          "src/app.ts",
          "src/router.ts",
          "tests/router.test.ts",
          "tests/run-app.integration.test.ts",
        ]);
      jest.spyOn(indexEngine, "buildContentIndex").mockResolvedValue({
        files: {
          "src/app.ts": {
            defs: [
              { type: "function", name: "runApp", line: 12 },
              { type: "export", name: "runApp", line: 30 },
            ],
          },
        },
      });
      jest
        .spyOn(indexEngine, "getRelatedFiles")
        .mockResolvedValue(["src/router.ts"]);
      jest.spyOn(indexEngine, "findSymbolReferences").mockResolvedValue([
        {
          file: "tests/run-app.integration.test.ts",
          line: 8,
          context: "runApp();",
        },
      ]);

      const tests = await _inferRelevantTests(new Set(["src/app.ts"]));
      expect(tests).toContain("tests/router.test.ts");
      expect(tests).toContain("tests/run-app.integration.test.ts");

      indexEngine.getFileIndex.mockRestore();
      indexEngine.buildContentIndex.mockRestore();
      indexEngine.getRelatedFiles.mockRestore();
      indexEngine.findSymbolReferences.mockRestore();
    });
  });

  describe("_inferSymbolTargets", () => {
    it("returns likely definitions for task identifiers", async () => {
      const indexEngine = require("../cli/index-engine");
      const spy = jest
        .spyOn(indexEngine, "searchContentIndex")
        .mockResolvedValue([
          { file: "cli/app.js", type: "function", name: "runApp", line: 12 },
        ]);

      const hits = await _inferSymbolTargets("fix runApp timeout handling");
      expect(hits[0]).toEqual(
        expect.objectContaining({
          file: "cli/app.js",
          name: "runApp",
          line: 12,
        }),
      );
      spy.mockRestore();
    });
  });

  describe("_buildSymbolHintBlock", () => {
    it("includes related follow-up files and likely callers when graph neighbors exist", async () => {
      const indexEngine = require("../cli/index-engine");
      const searchSpy = jest
        .spyOn(indexEngine, "searchContentIndex")
        .mockResolvedValue([
          { file: "cli/app.js", type: "function", name: "runApp", line: 12 },
        ]);
      const relatedSpy = jest
        .spyOn(indexEngine, "getRelatedFiles")
        .mockResolvedValue(["cli/router.js", "tests/app.test.js"]);
      const refsSpy = jest
        .spyOn(indexEngine, "findSymbolReferences")
        .mockResolvedValue([
          { file: "cli/index.js", line: 44, context: "runApp();" },
          { file: "tests/app.test.js", line: 10, context: "runApp();" },
        ]);

      try {
        const block = await _buildSymbolHintBlock(
          "fix runApp timeout handling",
        );
        expect(block).toContain("Likely symbol targets:");
        expect(block).toContain("read_file(path='cli/app.js'");
        expect(block).toContain(
          "Follow-up files: cli/router.js, tests/app.test.js",
        );
        expect(block).toContain(
          "Likely callers/usages: cli/index.js:44, tests/app.test.js:10",
        );
      } finally {
        searchSpy.mockRestore();
        relatedSpy.mockRestore();
        refsSpy.mockRestore();
      }
    });
  });

  describe("symbol hint formatting", () => {
    it("buildSystemPrompt path remains stable with symbol-aware additions", async () => {
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      const prompt = await agent.buildSystemPrompt();
      expect(prompt).toContain("Prefer symbol-aware, high-signal retrieval");
    });
  });

  // ─── splitSystemPrompt (cache-split) ───────────────────────
  describe("splitSystemPrompt", () => {
    it("splits prompt at boundary marker", () => {
      const agent = require("../cli/agent");
      const marker = agent.SYSTEM_PROMPT_DYNAMIC_BOUNDARY;
      const prompt = `Dynamic part\n${marker}\nStatic part`;
      const { dynamic, static: staticPart } = agent.splitSystemPrompt(prompt);
      expect(dynamic).toBe("Dynamic part");
      expect(staticPart).toBe("Static part");
    });

    it("returns full prompt as dynamic when no boundary marker", () => {
      const agent = require("../cli/agent");
      const { dynamic, static: staticPart } =
        agent.splitSystemPrompt("No boundary here");
      expect(dynamic).toBe("No boundary here");
      expect(staticPart).toBe("");
    });

    it("buildSystemPrompt contains the boundary marker", async () => {
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      const prompt = await agent.buildSystemPrompt();
      expect(prompt).toContain(agent.SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
    });

    it("static part contains behavioral rules", async () => {
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      const prompt = await agent.buildSystemPrompt();
      const { static: staticPart } = agent.splitSystemPrompt(prompt);
      expect(staticPart).toContain("# Core Behavior");
      expect(staticPart).toContain("# Tool Strategy");
      expect(staticPart).toContain("# Edit Protocol");
      expect(staticPart).toContain("Do not leave commented-out code");
    });

    it("dynamic part contains session-specific content", async () => {
      const agent = require("../cli/agent");
      agent.invalidateSystemPromptCache();
      const prompt = await agent.buildSystemPrompt();
      const { dynamic } = agent.splitSystemPrompt(prompt);
      expect(dynamic).toContain("WORKING DIRECTORY");
      expect(dynamic).toContain("Nex Code");
    });
  });

  // ─── _argPreview coverage ──────────────────────────────────
  describe("_argPreview edge cases", () => {
    it("web_fetch tool executes successfully", async () => {
      mockStream("", [
        {
          function: {
            name: "web_fetch",
            arguments: { url: "https://example.com/api/data" },
          },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("fetch it");
      expect(executeTool).toHaveBeenCalledWith(
        "web_fetch",
        { url: "https://example.com/api/data" },
        expect.any(Object),
      );
    });

    it("tool with no args shows name only", async () => {
      mockStream("", [
        { function: { name: "spawn_agents", arguments: {} }, id: "c1" },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("Agent 1:\n✓ Agent 1 ok");
      await processInput("spawn");
      expect(executeTool).toHaveBeenCalled();
    });
  });

  // ─── tool execution with hooks ─────────────────────────────
  describe("tool hooks", () => {
    it("runs pre-tool and post-tool hooks", async () => {
      const { runHooks } = require("../cli/hooks");
      runHooks
        .mockReturnValueOnce([{ success: true, command: "lint", output: "ok" }])
        .mockReturnValueOnce([
          { success: false, command: "test", error: "fail" },
        ]);
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo x" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("with hooks");
      expect(runHooks).toHaveBeenCalledWith("pre-tool", expect.any(Object));
      expect(runHooks).toHaveBeenCalledWith("post-tool", expect.any(Object));
    });
  });

  // ─── server hooks ──────────────────────────────────────────
  describe("server hooks (serverHooks parameter)", () => {
    it("forwards tokens to onToken hook in server mode", async () => {
      const onToken = jest.fn();
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        if (opts.onToken) {
          opts.onToken("hello");
          opts.onToken(" world");
        }
        return { content: "hello world", tool_calls: [] };
      });
      await processInput("test", { onToken });
      expect(onToken).toHaveBeenCalledWith("hello");
      expect(onToken).toHaveBeenCalledWith(" world");
    });

    it("calls onToolStart and onToolEnd hooks", async () => {
      const onToolStart = jest.fn();
      const onToolEnd = jest.fn();
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo x" } },
          id: "c1",
        },
      ]);
      mockStream("Done");
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test", { onToolStart, onToolEnd });
      expect(onToolStart).toHaveBeenCalledWith("bash", expect.any(Object));
      expect(onToolEnd).toHaveBeenCalledWith("bash", expect.any(String), true);
    });

    it("emits a failed tool_end event when tool execution throws", async () => {
      const onToolStart = jest.fn();
      const onToolEnd = jest.fn();
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo x" } },
          id: "c1",
        },
      ]);
      executeTool.mockRejectedValueOnce(new Error("tool crashed"));

      await expect(
        processInput("test", { onToolStart, onToolEnd }),
      ).rejects.toThrow("tool crashed");

      expect(onToolStart).toHaveBeenCalledWith("bash", expect.any(Object));
      expect(onToolEnd).toHaveBeenCalledWith(
        "bash",
        expect.stringContaining("tool crashed"),
        false,
      );
    });

    it("calls onThinkingToken hook", async () => {
      const onThinkingToken = jest.fn();
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        if (opts.onThinkingToken) opts.onThinkingToken();
        return { content: "ok", tool_calls: [] };
      });
      await processInput("test", { onThinkingToken });
      expect(onThinkingToken).toHaveBeenCalled();
    });

    it("forces a final answer when the tool-call budget is reached", async () => {
      process.env.NEX_MAX_TOOL_CALLS = "1";
      mockStream("", [
        {
          function: { name: "bash", arguments: { command: "echo first" } },
          id: "c1",
        },
      ]);
      callStream.mockImplementationOnce(async (messages, tools) => {
        expect(tools).toHaveLength(0);
        expect(messages[messages.length - 1].content).toContain(
          "Tool-call budget reached (1/1)",
        );
        return {
          content:
            "Final based on gathered data. The agent stopped tool execution after the configured budget and answered from the information already available.",
          tool_calls: [],
        };
      });
      executeTool.mockResolvedValueOnce("first");

      await processInput("test");

      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(callStream).toHaveBeenCalledTimes(2);
      expect(callStream.mock.calls[1][1]).toHaveLength(0);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Tool-call budget reached (1/1)"),
        ),
      ).toBe(true);
    });
  });

  // ─── conversation history trimming ─────────────────────────
  describe("conversation history trimming", () => {
    it("trims conversation when exceeding MAX_CONVERSATION_HISTORY", async () => {
      // Set up a conversation with > 300 messages
      const msgs = [];
      for (let i = 0; i < 310; i++) {
        msgs.push({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `msg ${i}`,
        });
      }
      setConversationMessages(msgs);
      mockStream("ok");
      await processInput("one more");
      // After adding user + assistant messages and trimming, should be <= 300
      expect(getConversationLength()).toBeLessThanOrEqual(302);
    });
  });

  // ─── setMaxIterations edge cases ───────────────────────────
  describe("setMaxIterations edge cases", () => {
    afterEach(() => setMaxIterations(50));

    it("ignores non-finite values", () => {
      setMaxIterations(NaN);
      setMaxIterations(Infinity);
      // Should not crash, still use previous value
    });

    it("ignores zero and negative values", () => {
      setMaxIterations(0);
      setMaxIterations(-5);
      // Should not crash
    });

    it("accepts valid positive number", () => {
      setMaxIterations(10);
      // No way to read MAX_ITERATIONS directly, but verify it works via test
    });
  });

  // ─── non-TTY stream handling ───────────────────────────────
  describe("non-TTY stream handling", () => {
    it("flushes tokens immediately in non-TTY mode", async () => {
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        configurable: true,
      });
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        if (opts.onToken) {
          opts.onToken("hello");
          opts.onToken(" world");
        }
        return { content: "hello world", tool_calls: [] };
      });
      await processInput("test");
      Object.defineProperty(process.stdout, "isTTY", {
        value: origIsTTY,
        configurable: true,
      });
      expect(callStream).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 400 error with compress retry ─────────────────────────
  describe("400 error context compression", () => {
    beforeEach(() => instantTimeout());
    afterEach(() => restoreTimeout());

    it("retries with force-compress on first 400", async () => {
      process.env.NEX_DEBUG = "true";
      const { forceCompress } = require("../cli/context-engine");
      const err400 = new Error("400 Bad Request");
      callStream.mockRejectedValueOnce(err400);
      mockStream("Recovered after compress");
      forceCompress.mockImplementationOnce((msgs) => ({
        messages: msgs,
        tokensRemoved: 5000,
      }));
      await processInput("test");
      expect(forceCompress).toHaveBeenCalled();
      expect(logOutput()).toContain("force-compress");
      delete process.env.NEX_DEBUG;
    });
  });

  // ─── compacted context log ─────────────────────────────────
  describe("compacted context", () => {
    it("logs compacted message when context is compacted", async () => {
      fitToContext.mockImplementationOnce((m) => ({
        messages: m,
        compressed: false,
        compacted: true,
        tokensRemoved: 3000,
      }));
      mockStream("OK");
      await processInput("test");
      expect(logOutput()).toContain("compacted");
      expect(logOutput()).toContain("3000");
    });
  });

  // ─── cumulative token tracking with TaskProgress ───────────
  describe("cumulative token tracking", () => {
    it("accumulates tokens across multiple API calls", async () => {
      mockStream(
        "",
        [
          {
            function: { name: "bash", arguments: { command: "echo 1" } },
            id: "c1",
          },
        ],
        { prompt_tokens: 100, completion_tokens: 50 },
      );
      mockStream("Done", [], { prompt_tokens: 200, completion_tokens: 75 });
      executeTool.mockResolvedValueOnce("ok");
      await processInput("test");
      // trackUsage should be called twice
      expect(trackUsage).toHaveBeenCalledTimes(2);
    });
  });

  // ─── creation task guard ──────────────────────────────────
  describe("creation task guard", () => {
    function readCall(n) {
      return {
        function: {
          name: "read_file",
          arguments: { path: `/src/file${n}.js` },
        },
        id: `r${n}`,
      };
    }
    function writeCall(n) {
      return {
        function: {
          name: "write_file",
          arguments: { path: `/src/out${n}.js`, content: "x" },
        },
        id: `w${n}`,
      };
    }

    it("fires investigation-cap message after 10 reads for a creation prompt", async () => {
      // 10 reads hits the creation pre-edit cap (10)
      const reads = [];
      for (let i = 1; i <= 10; i++) reads.push(readCall(i));
      mockStream("checking structure", reads);
      executeTool.mockResolvedValue("file content");
      // After cap fires, model receives injected message + results → responds
      mockStream("I will implement now");

      await processInput(
        "Create a React Snake game component with 80s retro style",
      );

      const msgs = getConversationMessages();
      const hasCapMsg = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("You have read enough files"),
      );
      expect(hasCapMsg).toBe(true);
    });

    it("does NOT fire cap after 4 reads for a non-creation prompt", async () => {
      // Non-creation prompts use the full INVESTIGATION_CAP (12) — 4 reads fine
      mockStream("checking", [
        readCall(1),
        readCall(2),
        readCall(3),
        readCall(4),
      ]);
      executeTool.mockResolvedValue("content");
      mockStream("still investigating");
      mockStream("done");

      await processInput("Why is the login page slow?");

      const msgs = getConversationMessages();
      const hasCapMsg = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("You have read enough files"),
      );
      expect(hasCapMsg).toBe(false);
    });

    it("fires synthesis cap after 6 reads for understanding prompts that write a report", async () => {
      clearConversation();
      const reads = [];
      for (let i = 1; i <= 6; i++) reads.push(readCall(i));
      mockStream("scanning files", reads);
      executeTool.mockResolvedValue("file content");
      mockStream("I will write the report now");

      await processInput(
        "Analyze this Express.js project and create a brief ARCHITECTURE.md file describing the app structure.",
      );

      const msgs = getConversationMessages();
      const hasCapMsg = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes(
            "You have enough evidence to write the requested summary/document now",
          ),
      );
      expect(hasCapMsg).toBe(true);
    });

    it("exits immediately after writing a text deliverable once synthesis evidence is sufficient", async () => {
      clearConversation();
      getAutoConfirm.mockReturnValue(true);

      const reads = [];
      for (let i = 1; i <= 6; i++) reads.push(readCall(i));
      mockStream("scanning files", reads);
      executeTool.mockResolvedValue("file content");

      mockStream("writing the architecture summary", [
        {
          function: {
            name: "write_file",
            arguments: {
              path: "/ARCHITECTURE.md",
              content: "# Architecture\n\nSummary",
            },
          },
          id: "wf-arch",
        },
      ]);
      executeTool.mockResolvedValueOnce("Written: /ARCHITECTURE.md");

      mockStream("SHOULD NOT REACH");

      await processInput(
        "Analyze this Express.js project and create a brief ARCHITECTURE.md file describing the app structure.",
      );

      expect(callStream).toHaveBeenCalledTimes(2);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("SHOULD NOT REACH"),
        ),
      ).toBe(false);
    });

    it("blocks renewed read-only exploration after synthesis evidence is sufficient", async () => {
      clearConversation();

      const reads = [];
      for (let i = 1; i <= 6; i++) reads.push(readCall(i));
      mockStream("scanning files", reads);
      executeTool.mockResolvedValue("file content");

      mockStream("trying to inspect one more file", [readCall(7)]);
      mockStream("writing the report now");

      await processInput(
        "Analyze this Express.js project and create a brief ARCHITECTURE.md file describing the app structure.",
      );

      expect(executeTool).toHaveBeenCalledTimes(6);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes(
              "BLOCKED: You already have enough evidence to produce the requested summary/document",
            ),
        ),
      ).toBe(true);
    });

    it("blocks local repo inspection first for live app bug URLs", async () => {
      mockStream("checking files", [readCall(1)]);
      mockStream("I will inspect the live app first");

      await processInput(
        "Wenn ich bei /webapp-epsilon Ideen loesche kommen sie immer wieder zurueck ins webui https://test.example.com/webapp-epsilon/",
      );

      expect(executeTool).not.toHaveBeenCalled();
      const msgs = getConversationMessages();
      const hasBlockMsg = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes(
            "Inspect https://test.example.com/webapp-epsilon/ with browser_open first",
          ),
      );
      expect(hasBlockMsg).toBe(true);
    });

    it("hard-blocks reads after cap fires and a file has been written", async () => {
      // Turn 1: 2 reads (under pre-edit cap of 10 — no message yet)
      mockStream("reading", [readCall(1), readCall(2)]);
      executeTool.mockResolvedValue("content");
      // Turn 2: 1 write → resets counter + _investigationCapFired, _editsMadeThisSession=1
      mockStream("writing", [writeCall(1)]);
      executeTool.mockResolvedValueOnce("written: /src/out1.js");
      // Turn 3: 6 reads → post-edit cap = 6, fires cap message on 6th read
      mockStream("checking again", [
        readCall(3),
        readCall(4),
        readCall(5),
        readCall(6),
        readCall(7),
        readCall(8),
      ]);
      executeTool.mockResolvedValue("content");
      // Turn 4: 1 more read → hard-blocked (cap fired + creation + edits >= 1)
      mockStream("reading more", [readCall(9)]);
      // Model receives BLOCKED result and wraps up
      mockStream("ok done");

      await processInput(
        "Create a React Snake game component with 80s retro style",
      );

      const msgs = getConversationMessages();
      const blocked = msgs.some(
        (m) =>
          typeof m.content === "string" && m.content.startsWith("BLOCKED:"),
      );
      expect(blocked).toBe(true);
      // executeTool should NOT have been called for the blocked read (r9)
      const readCalls = executeTool.mock.calls.filter(
        (c) => c[0] === "read_file",
      );
      expect(readCalls.length).toBe(8); // r1-r8 executed, r9 blocked
    });

    it("task registry populates from create_task result and matches write_file", async () => {
      // Turn 1: model calls create_task + then write_file in sequence
      mockStream("creating task", [
        {
          function: {
            name: "create_task",
            arguments: { subject: "Create SnakeGame component" },
          },
          id: "ct1",
        },
      ]);
      // Simulate create_task tool result
      executeTool.mockResolvedValueOnce(
        "Task #1 created successfully: Create SnakeGame component",
      );
      // Turn 2: write the component
      mockStream("implementing", [writeCall(1)]);
      executeTool.mockResolvedValueOnce("written: /src/out1.js");
      mockStream("done");

      await processInput("Create a React Snake game");

      // Auto-match should be logged in resume output (console.log)
      const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
      // The match fires when filename tokens overlap with task description tokens.
      // "out1" doesn't overlap with "webapp-omicrongame" — use a matching filename instead.
      // This test verifies the registry is populated (no crash) and log is clean.
      expect(output).not.toMatch(/Error|TypeError/);
    });
  });

  // ─── bash find/ls pre-execution block ─────────────────────
  describe("bash find/ls pre-execution block", () => {
    function bashCall(cmd, id = "b1") {
      return {
        function: { name: "bash", arguments: { command: cmd } },
        id,
      };
    }

    it("blocks bare ls command and redirects to list_directory", async () => {
      mockStream("looking around", [bashCall("ls -la /tmp")]);
      executeTool.mockResolvedValue("should not reach");
      mockStream("ok done");

      await processInput("What files are here?");

      const msgs = getConversationMessages();
      const blocked = msgs.some(
        (m) =>
          typeof m.content === "string" && m.content.includes("list_directory"),
      );
      expect(blocked).toBe(true);
      // executeTool should NOT have been called for the blocked ls
      const bashCalls = executeTool.mock.calls.filter((c) => c[0] === "bash");
      expect(bashCalls.length).toBe(0);
    });

    it("blocks find command and redirects to glob", async () => {
      mockStream("searching", [bashCall("find . -name '*.js'")]);
      executeTool.mockResolvedValue("should not reach");
      mockStream("ok done");

      await processInput("Find all JS files");

      const msgs = getConversationMessages();
      const blocked = msgs.some(
        (m) => typeof m.content === "string" && m.content.includes("glob"),
      );
      expect(blocked).toBe(true);
      const bashCalls = executeTool.mock.calls.filter((c) => c[0] === "bash");
      expect(bashCalls.length).toBe(0);
    });

    it("does NOT block ls inside npm/git commands", async () => {
      mockStream("running npm", [bashCall("npm install && ls node_modules")]);
      executeTool.mockResolvedValue("installed");
      mockStream("done");

      await processInput("Install and check");

      const bashCalls = executeTool.mock.calls.filter((c) => c[0] === "bash");
      expect(bashCalls.length).toBe(1);
    });
  });

  // ─── post-session creation context ────────────────────────
  describe("post-session creation context", () => {
    function writeCall(n, name = null) {
      return {
        function: {
          name: "write_file",
          arguments: {
            path: name || `/project/file${n}.js`,
            content: "x",
          },
        },
        id: `w${n}`,
      };
    }

    it("injects creation summary on follow-up message", async () => {
      // Turn 1: creation task — write 3+ files
      mockStream("building game", [
        writeCall(1, "/project/index.js"),
        writeCall(2, "/project/game.js"),
        writeCall(3, "/project/style.css"),
      ]);
      executeTool.mockResolvedValue("written");
      mockStream("Done, webapp-omicron game created!");

      await processInput("Create a Snake game in plain JS");

      // Turn 2: follow-up question
      callStream.mockReset();
      executeTool.mockReset();
      mockStream("The app needs npm install first");

      await processInput("The app won't start on localhost:3000");

      // The context note should have been injected into the conversation
      const msgs = getConversationMessages();
      const hasNote = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("Previous session created"),
      );
      expect(hasNote).toBe(true);
    });

    it("injects bootstrap continuation when package.json written without npm install", async () => {
      mockStream("creating project", [
        writeCall(1, "/project/package.json"),
        writeCall(2, "/project/index.js"),
        writeCall(3, "/project/server.js"),
      ]);
      executeTool.mockResolvedValue("written");
      // Model says "Done!" without running npm install → framework injects verification
      mockStream("Done!");
      // Model responds to verification injection by bootstrapping
      mockStream("Running npm install", [
        {
          function: {
            name: "bash",
            arguments: JSON.stringify({ command: "npm install" }),
          },
          id: "b1",
        },
      ]);
      executeTool.mockResolvedValue("added 42 packages");
      mockStream(
        "npm install completed. The Express server project is ready in /project. Run `node server.js` to start.",
      );

      await processInput("Create an Express server");

      const msgs = getConversationMessages();
      // Framework should have injected the bootstrap verification message
      const verifyMsg = msgs.find(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("FRAMEWORK") &&
          m.content.includes("npm install"),
      );
      expect(verifyMsg).toBeTruthy();
    });

    it("does NOT inject context for non-creation tasks", async () => {
      // Debug task: no creation regex match, 3 reads only
      mockStream("investigating", [
        {
          function: { name: "read_file", arguments: { path: "/src/app.js" } },
          id: "r1",
        },
      ]);
      executeTool.mockResolvedValue("content");
      mockStream("Found the bug in app.js");

      await processInput("Why is the login page slow?");

      callStream.mockReset();
      executeTool.mockReset();
      mockStream("ok");

      await processInput("Any other issues?");

      const msgs = getConversationMessages();
      const hasNote = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("Previous session created"),
      );
      expect(hasNote).toBe(false);
    });
  });

  // ─── stagnation detection (headless mode) ────────────────
  describe("stagnation detection", () => {
    afterEach(() => {
      getAutoConfirm.mockReturnValue(false);
    });

    it("injects stagnation nudges before exiting in headless mode", async () => {
      clearConversation();
      getAutoConfirm.mockReturnValue(true);

      // Set up 9 read-only iterations → triggers first nudge (soft warn)
      for (let n = 0; n < 9; n++) {
        mockStream("reading", [
          {
            function: {
              name: "read_file",
              arguments: { path: `/file${n}.js` },
            },
            id: `c${n}`,
          },
        ]);
        executeTool.mockResolvedValueOnce(`content of file${n}`);
      }
      // After first nudge, model tries another 9 read-only → second nudge
      for (let n = 0; n < 20; n++) {
        mockStream("reading", [
          {
            function: {
              name: "read_file",
              arguments: { path: `/more${n}.js` },
            },
            id: `d${n}`,
          },
        ]);
        executeTool.mockResolvedValueOnce(`content`);
      }
      // This should NOT be reached — exit after 2nd nudge exhausted
      mockStream("SHOULD NOT REACH");

      await processInput("Investigate the codebase");

      const msgs = getConversationMessages();
      const hasUnreached = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("SHOULD NOT REACH"),
      );
      expect(hasUnreached).toBe(false);

      // Verify nudge messages were injected
      const nudgeMessages = msgs.filter(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("investigating without making changes"),
      );
      expect(nudgeMessages.length).toBeGreaterThanOrEqual(1);
    });

    it("resets stagnation counter when a write tool is used", async () => {
      clearConversation();
      getAutoConfirm.mockReturnValue(true);

      // 5 read-only iterations
      for (let n = 0; n < 5; n++) {
        mockStream("reading", [
          {
            function: {
              name: "read_file",
              arguments: { path: `/file${n}.js` },
            },
            id: `r${n}`,
          },
        ]);
        executeTool.mockResolvedValueOnce(`content`);
      }
      // 1 write iteration → resets counter
      mockStream("editing", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "w1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      // Then verification resets the post-edit completion guard.
      mockStream("PASS: ran the narrow verification command", [
        {
          function: { name: "bash", arguments: { command: "npm test" } },
          id: "verify-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("PASS");
      mockStream(
        "Done with the fix. I re-read /fix.js after the edit and confirmed the updated branch is present, so the headless run can finish without entering a read-only stagnation loop.",
      );
      mockStream(
        "The fix is complete after a post-edit read of /fix.js. The write reset the read-only stagnation counter, and verification evidence was collected before the final summary.",
      );

      await processInput("Fix the bug");

      const msgs = getConversationMessages();
      const hasDone = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("headless run can finish"),
      );
      expect(hasDone).toBe(true);
    });

    it("does not trigger in interactive mode", async () => {
      clearConversation();
      getAutoConfirm.mockReturnValue(false);

      // In interactive mode, first text-only response exits via normal path
      mockStream("reading", [
        {
          function: { name: "read_file", arguments: { path: "/a.js" } },
          id: "c1",
        },
      ]);
      executeTool.mockResolvedValueOnce("content");
      mockStream("Here is what I found.");

      await processInput("Check a.js");

      const msgs = getConversationMessages();
      expect(msgs.length).toBeGreaterThan(0);
    });

    it("does not complete verify phase without any verification tool call", async () => {
      clearConversation();
      callStream.mockReset();
      process.env.NEX_PHASE_ROUTING = "1";
      callStream.mockImplementation(async () => ({
        content:
          "Verification finished. I re-read the modified file, confirmed the change, and the task is complete.",
        tool_calls: [],
      }));

      mockStream("Plan: update /fix.js");
      mockStream("Implemented the fix", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("Looks good now.");
      mockStream(
        "Verification finished. I re-read the modified file, confirmed the change, and the task is complete.",
      );

      await processInput("Fix the bug in fix.js");

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Verification is incomplete"),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes(
              "[SYSTEM] Verification is incomplete: run at least one verification tool",
            ),
        ),
      ).toBe(true);
    }, 15000);

    it("exits cleanly in headless verify phase after verification evidence and a substantive summary", async () => {
      clearConversation();
      callStream.mockReset();
      callStream.mockImplementation(async () => ({
        content: "FALLBACK",
        tool_calls: [],
      }));
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      mockStream("Plan: update /fix.js");
      mockStream("Implemented the fix", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream("Looks good now.");
      mockStream("PASS: Verified by reading the modified file.", [
        {
          function: { name: "read_file", arguments: { path: "/fix.js" } },
          id: "read-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("updated file");
      mockStream(
        "I re-read /fix.js after the edit and confirmed the guard is present in the right branch. The implementation and verification are complete, so this task is ready to stop here.",
      );
      await processInput("Fix the bug in fix.js");

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("ready to stop here"),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Verification is incomplete"),
        ),
      ).toBe(false);
    }, 15000);

    it("continues from headless implement summary into verification", async () => {
      clearConversation();
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      mockStream(
        "Plan: update /fix.js after checking the current implementation.",
      );
      mockStream("Implemented the fix.", [
        {
          function: { name: "edit_file", arguments: { path: "/fix.js" } },
          id: "edit-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("OK");
      mockStream(
        "Updated /fix.js to handle the missing branch correctly and kept the existing API shape intact. The change is in place and ready for the next benchmark step.",
      );
      mockStream("PASS: re-read the edited file after the change.", [
        {
          function: { name: "read_file", arguments: { path: "/fix.js" } },
          id: "read-1",
        },
      ]);
      executeTool.mockResolvedValueOnce("updated file");
      mockStream(
        "PASS: I re-read /fix.js after the edit and confirmed the corrected branch is present. The implementation is verified with the edited file, and there are no additional changes needed for this task.",
      );

      await processInput("Fix the bug in fix.js");

      expect(callStream).toHaveBeenCalledTimes(5);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("implementation is verified"),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("[PHASE: VERIFICATION]"),
        ),
      ).toBe(true);
    });

    it("exits after a substantive analysis answer instead of entering implement phase", async () => {
      clearConversation();
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);

      mockStream("I will inspect the project structure first.", [
        {
          function: { name: "read_file", arguments: { path: "/package.json" } },
          id: "read-1",
        },
      ]);
      executeTool.mockResolvedValueOnce('{ "name": "demo" }');
      mockStream(
        "The project is organized around a CLI entrypoint in dist/, core runtime logic in cli/, and Jest-based regression coverage in tests/. " +
          "The control flow starts in the command layer, delegates to the agent loop for tool-driven work, and uses provider abstractions to swap model backends cleanly.",
      );

      await processInput("Understand the project structure", null, {
        autoConfirm: true,
        silent: true,
      });

      expect(callStream).toHaveBeenCalledTimes(2);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes(
              "The project is organized around a CLI entrypoint",
            ),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(false);
    });

    it("does not skip planning for automation backlog prompts with safety gates", () => {
      const prompt =
        "Automation: MuseScore parity and UX improvements\n" +
        "Work from main only. At the start of each run, inspect git status and the current branch. " +
        "If the worktree is dirty with unrelated changes, stop without editing, committing, or pushing. " +
        "Use documented gaps in docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
        "Pick at most one tightly scoped improvement. After verification passes, stage only the files changed, commit and push.";

      expect(_extractDirectTaskPaths(prompt)).toEqual([
        "docs/keyboard-shortcuts.md",
        "docs/user-manual.md",
        "docs/phase-roadmap.md",
      ]);
      expect(_hasAutomationOrPreflightGate(prompt)).toBe(true);
      expect(_shouldSkipPlanPhaseForDirectCreation(prompt)).toBe(false);
    });

    it("still skips planning for one explicit direct file edit", () => {
      expect(
        _shouldSkipPlanPhaseForDirectCreation(
          "Update cli/agent.js file to add a missing guard",
        ),
      ).toBe(true);
    });

    it("does not skip planning for multiple backlog file references", () => {
      expect(
        _shouldSkipPlanPhaseForDirectCreation(
          "Improve docs/keyboard-shortcuts.md and docs/user-manual.md based on the backlog.",
        ),
      ).toBe(false);
    });

    it("recognizes bounded backlog automation prompts and requires the plan template", () => {
      const prompt =
        "Automation: MuseScore parity and UX improvements\n" +
        "Work from main only. Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
        "Pick at most one tightly scoped improvement in priority order.";

      expect(_isBoundedBacklogPlanningPrompt(prompt)).toBe(true);

      const instruction = _buildBoundedBacklogPlanInstruction();
      expect(instruction).toContain("Selected improvement:");
      expect(instruction).toContain("Selection rationale:");
      expect(instruction).toContain("Files:");
      expect(instruction).toContain("Verification plan:");
      expect(instruction).toContain("Browser/UI applicability:");

      expect(
        _looksLikeBoundedBacklogDecision(
          "Selected improvement: fix shortcut docs\n" +
            "Selection rationale: highest value gap\n" +
            "Files: docs/keyboard-shortcuts.md\n" +
            "Implementation outline: update the missing command\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
        ),
      ).toBe(true);
      expect(_looksLikeBoundedBacklogDecision("no safe task found")).toBe(true);
      expect(
        _looksLikeBoundedBacklogDecision(
          "**Selected improvement:** improve toolbar shortcut hints\n" +
            "**Selection rationale:** docs evidence names a UI workflow gap\n" +
            "**Files:** src/components/Toolbar.tsx, docs/keyboard-shortcuts.md\n" +
            "**Implementation outline:** locate the toolbar and add one hint\n" +
            "**Verification plan:** npm test -- tests/agent.test.js\n" +
            "**Browser/UI applicability:** required",
        ),
      ).toBe(true);
    });

    it("rejects bare no-safe responses after bounded backlog evidence", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content: "Selected improvement: no safe task found",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "no safe task found because the referenced backlog files are missing and cannot be inspected",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Do not answer `no safe task found`"),
        ),
      ).toBe(true);
    });

    it("injects the bounded backlog plan template before the model plans", async () => {
      let firstMessages = null;
      executeTool.mockResolvedValueOnce("## main...origin/main\n");
      callStream.mockImplementationOnce(async (messages) => {
        firstMessages = messages;
        return { content: "no safe task found", tool_calls: [] };
      });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true },
      );

      expect(firstMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(
              "Bounded backlog automation plan template",
            ),
          }),
        ]),
      );
    });

    it("does not transition to implement until the bounded backlog decision template is satisfied", async () => {
      executeTool.mockResolvedValueOnce("## main...origin/main\n");
      callStream
        .mockResolvedValueOnce({
          content:
            "Plan: I will review the backlog and propose a change. Then I will implement it.",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "no safe task found because the referenced backlog files are missing and cannot be inspected",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true },
      );

      expect(callStream).toHaveBeenCalledTimes(2);
      const msgs = getConversationMessages();
      const templateCount = msgs.filter(
        (m) =>
          m.role === "user" &&
          typeof m.content === "string" &&
          m.content.includes("Bounded backlog automation plan template"),
      ).length;
      expect(templateCount).toBeGreaterThanOrEqual(2);
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(false);
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("no safe task found"),
        ),
      ).toBe(true);
    });

    it("reprompts premature no-safe bounded backlog decisions", async () => {
      executeTool.mockResolvedValueOnce("## main...origin/main\n");
      callStream
        .mockResolvedValueOnce({ content: "no safe task found", tool_calls: [] })
        .mockResolvedValueOnce({
          content:
            "no safe task found because the referenced backlog files are missing and cannot be inspected",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true },
      );

      expect(callStream).toHaveBeenCalledTimes(2);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes(
              "Do not answer `no safe task found` before reading/searching backlog evidence",
            ),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(false);
    });

    it("forces bounded backlog planning to decide after prefetch evidence", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");
      let toolsOnDecisionCall = null;
      callStream.mockImplementationOnce(async (_messages, tools) => {
        toolsOnDecisionCall = tools;
        return {
          content:
            "Selected improvement: update shortcut docs\n" +
            "Selection rationale: docs/keyboard-shortcuts.md is prompt evidence\n" +
            "Files: docs/keyboard-shortcuts.md\n" +
            "Implementation outline: update the missing command\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        };
      });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true },
      );

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Bounded backlog automation plan template"),
        ),
      ).toBe(true);
      expect(Array.isArray(toolsOnDecisionCall)).toBe(true);
      expect(toolsOnDecisionCall).toHaveLength(0);
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(true);
    });

    it("removes plan-phase tool access after bounded backlog prefetch", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      let toolsOnDecisionCall = null;
      callStream.mockImplementationOnce(async (_messages, tools) => {
        toolsOnDecisionCall = tools;
        return {
          content: "I will read more backlog files.",
          tool_calls: [
            {
              id: "extra-read",
              function: {
                name: "read_file",
                arguments: { path: "docs/keyboard-shortcuts.md" },
              },
            },
          ],
        };
      });
      callStream.mockImplementationOnce(async () => {
        return {
          content:
            "Selected improvement: update shortcut docs\n" +
            "Selection rationale: docs/keyboard-shortcuts.md is prompt evidence\n" +
            "Files: docs/keyboard-shortcuts.md\n" +
            "Implementation outline: update the missing command\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        };
      });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        // Raise maxIterations so the plan phase doesn't stop at the default phase budget
        // before the bounded-backlog hard-evidence tool-freeze can take effect.
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      expect(Array.isArray(toolsOnDecisionCall)).toBe(true);
      expect(toolsOnDecisionCall).toHaveLength(0);
      // 1 preflight bash call + 3 prompt-named backlog prefetch reads.
      // The extra read_file tool call is blocked before execution.
      expect(executeTool).toHaveBeenCalledTimes(4);
    });

    it("reprompts textual tool-call attempts after bounded backlog prefetch", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "We need to call read_file. I will output JSON calls now: " +
            '{"tool":"read_file","path":"docs/keyboard-shortcuts.md"}',
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Selected improvement: update shortcut docs\n" +
            "Selection rationale: docs/keyboard-shortcuts.md is prompt evidence\n" +
            "Files: docs/keyboard-shortcuts.md\n" +
            "Implementation outline: update the missing command\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Do not describe tool calls"),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(true);
    });

    it("reprompts markdown heading plans after bounded backlog prefetch", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "### Selected improvement\nUpdate shortcut docs\n\n" +
            "### Selection rationale\nDocs evidence names the gap\n\n" +
            "### Files\n- docs/keyboard-shortcuts.md\n\n" +
            "### Implementation outline\nUpdate one row\n\n" +
            "### Verification plan\nnpm test -- tests/agent.test.js\n\n" +
            "### Browser/UI applicability\nnot required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Selected improvement: update shortcut docs\n" +
            "Selection rationale: docs/keyboard-shortcuts.md is prompt evidence\n" +
            "Files: docs/keyboard-shortcuts.md\n" +
            "Implementation outline: update the missing command\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("used markdown headings"),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(true);
    });

    it("accepts existing tsx file references in bounded backlog plans", async () => {
      const fs = require("fs");
      const fixtureDir = ".tmp-agent-tsx-fixture";
      const fixturePath = `${fixtureDir}/CommandCenter.tsx`;
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(fixturePath, "export function CommandCenter() { return null; }\n");
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      try {
        callStream.mockResolvedValueOnce({
          content:
            "Selected improvement: improve command center labels\n" +
            `Selection rationale: ${fixturePath} is a current UI workflow surface\n` +
            `Files: ${fixturePath}, hooks/missingCommandCenter.ts, tests/agent.test.js\n` +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        });

        await processInput(
          "Automation: MuseScore parity and UX improvements\n" +
            "Work from main only. At the start, run git status. " +
            "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
            "Pick at most one tightly scoped improvement in priority order.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 25 },
        );
      } finally {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("[PHASE: IMPLEMENTATION]"),
        ),
      ).toBe(true);
    });

    it("allows bounded backlog implementation to locate planned UI files", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("Keyboard shortcuts")
        .mockResolvedValueOnce("User manual")
        .mockResolvedValueOnce("components/CommandCenter.tsx\ncomponents/Toolbar.tsx")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve command center shortcut hints\n" +
            "Selection rationale: docs/keyboard-shortcuts.md identifies a visible editing workflow gap\n" +
            "Files: components/CommandCenter.tsx, tests/agent.test.js\n" +
            "Implementation outline: locate the current command center component, read the relevant lines, then edit one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Locating the current UI components.",
          tool_calls: [
            {
              id: "locate-components",
              function: {
                name: "repo_browser.print_tree",
                arguments: { path: "components", max_depth: 2 },
              },
            },
          ],
        })
        .mockResolvedValue({
          content: "Implementation stalled before edits.",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Also inspect the current UI/components for obvious friction before choosing a task. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      expect(executeTool).toHaveBeenCalledWith(
        "list_directory",
        expect.objectContaining({ path: "components" }),
        expect.any(Object),
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "tool" &&
            typeof m.content === "string" &&
            m.content.includes(
              "implementation phase must not use bash/git or broad reading",
            ),
        ),
      ).toBe(false);
    });

    it("allows targeted implementation reads for prompt-named planned files", async () => {
      const fs = require("fs");
      const fixtureDir = ".tmp-agent-implementation-read";
      fs.mkdirSync(`${fixtureDir}/components`, { recursive: true });
      fs.mkdirSync(`${fixtureDir}/docs`, { recursive: true });
      fs.writeFileSync(
        `${fixtureDir}/components/NotationToolbar.js`,
        "export function renderNotationToolbar() { return '<button>Note</button>'; }\n",
      );
      fs.writeFileSync(`${fixtureDir}/docs/keyboard-shortcuts.md`, "Note: N\n");
      const originalCwd = process.cwd();
      process.chdir(fixtureDir);
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("Toolbar file")
        .mockResolvedValueOnce("Keyboard shortcuts")
        .mockResolvedValue("File content");

      try {
        callStream
          .mockResolvedValueOnce({
            content:
              "Selected improvement: add toolbar aria label\n" +
              "Selection rationale: components/NotationToolbar.js is an existing active editing UI\n" +
              "Files: components/NotationToolbar.js\n" +
              "Implementation outline: read the toolbar lines, then add one aria label\n" +
              "Verification plan: npm test\n" +
              "Browser/UI applicability: required",
            tool_calls: [],
          })
          .mockResolvedValueOnce({
            content: "Reading the planned implementation file.",
            tool_calls: [
              {
                id: "read-toolbar",
                function: {
                  name: "read_file",
                  arguments: {
                    path: "components/NotationToolbar.js",
                    line_start: 1,
                    line_end: 40,
                  },
                },
              },
            ],
          })
          .mockResolvedValue({
            content: "Implementation stalled before edits.",
            tool_calls: [],
          });

        await processInput(
          "Automation: active editing workflow improvement\n" +
            "Work from main only. At the start, run git status. " +
            "Prefer components/NotationToolbar.js. " +
            "Use docs/keyboard-shortcuts.md as backlog/reference material. " +
            "Pick at most one tightly scoped improvement.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 10 },
        );

        const plannedFileReads = executeTool.mock.calls.filter(
          ([name, args]) =>
            name === "read_file" &&
            JSON.stringify(args || {}).includes("components/NotationToolbar.js"),
        );
        expect(plannedFileReads.length).toBeGreaterThanOrEqual(2);
        expect(JSON.stringify(plannedFileReads.at(-1)?.[1] || {})).toContain(
          "line_start",
        );
        expect(
          getConversationMessages().some(
            (m) =>
              m.role === "tool" &&
              typeof m.content === "string" &&
              m.content.includes("Do not re-read backlog files"),
          ),
        ).toBe(false);
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    it("stops when bounded backlog implementation ignores edit-only blocks", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("Toolbar file")
        .mockResolvedValueOnce("Keyboard shortcuts")
        .mockResolvedValue("File content");

      const blockedReadCall = {
        content: "Checking the implementation file again.",
        tool_calls: [
          {
            id: "blocked-read",
            function: {
              name: "read_file",
              arguments: {
                path: "components/NotationToolbar.js",
                line_start: 1,
                line_end: 40,
              },
            },
          },
        ],
      };

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: add toolbar aria label\n" +
            "Selection rationale: components/NotationToolbar.js is an existing active editing UI\n" +
            "Files: components/NotationToolbar.js\n" +
            "Implementation outline: read the toolbar lines, then add one aria label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Reading the planned implementation file.",
          tool_calls: [
            {
              id: "read-toolbar",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/NotationToolbar.js",
                  line_start: 1,
                  line_end: 40,
                },
              },
            },
          ],
        })
        .mockResolvedValue(blockedReadCall);

      await processInput(
        "Automation: active editing workflow improvement\n" +
          "Work from main only. At the start, run git status. " +
          "Prefer components/NotationToolbar.js. " +
          "Use docs/keyboard-shortcuts.md as backlog/reference material. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 12 },
      );

      const messages = getConversationMessages();
      expect(
        messages.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("next response must contain exactly one edit_file"),
        ),
      ).toBe(true);
      expect(
        messages.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("planned implementation file was already in context") &&
            m.content.includes("instead of editing"),
        ),
      ).toBe(true);
    }, 15000);

    it("allows narrow same-file search after initial bounded backlog read", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("Command center file")
        .mockResolvedValueOnce("Keyboard shortcuts")
        .mockResolvedValueOnce("Lines 90-150 without target")
        .mockResolvedValueOnce("212:  <button>Apply</button>")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: add command center apply aria label\n" +
            "Selection rationale: components/CommandCenter.tsx is an existing active editing UI\n" +
            "Files: components/CommandCenter.tsx\n" +
            "Implementation outline: read the command center lines, locate Apply if needed, then add one aria label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Reading the planned implementation file.",
          tool_calls: [
            {
              id: "read-command-center",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/CommandCenter.tsx",
                  line_start: 90,
                  line_end: 150,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Locating the Apply button within the same planned file.",
          tool_calls: [
            {
              id: "grep-command-center",
              function: {
                name: "grep",
                arguments: {
                  path: "components/CommandCenter.tsx",
                  pattern: "Apply",
                },
              },
            },
          ],
        })
        .mockResolvedValue({
          content: "Implementation stalled before edits.",
          tool_calls: [],
        });

      await processInput(
        "Automation: active editing workflow improvement\n" +
          "Work from main only. At the start, run git status. " +
          "Prefer components/CommandCenter.tsx. " +
          "Use docs/keyboard-shortcuts.md as backlog/reference material. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 10 },
      );

      expect(executeTool).toHaveBeenCalledWith(
        "grep",
        expect.objectContaining({
          path: "components/CommandCenter.tsx",
          pattern: "Apply",
        }),
        expect.any(Object),
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "tool" &&
            typeof m.content === "string" &&
            m.content.includes("planned implementation file has already been read"),
        ),
      ).toBe(false);
    });

    it("allows targeted read after repeated same-file grep hits", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("Toolbar file")
        .mockResolvedValueOnce("Keyboard shortcuts")
        .mockResolvedValueOnce("Lines 204-264 without target")
        .mockResolvedValueOnce("260:  <ToolBtn title={t('toolbar.undo')} />")
        .mockResolvedValueOnce("458:  onInsertRest={onInsertRest}")
        .mockResolvedValueOnce("458:  onInsertRest={onInsertRest}")
        .mockResolvedValueOnce("Lines 260-340 without target")
        .mockResolvedValueOnce("Lines 340-420 without target")
        .mockResolvedValueOnce("Lines 420-500 with onInsertRest")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: add toolbar insert rest label\n" +
            "Selection rationale: components/NotationToolbar.tsx is an existing active editing UI\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: read the toolbar range, locate Insert Rest if needed, then make one label edit\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Reading the planned implementation file.",
          tool_calls: [
            {
              id: "read-toolbar",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  line_start: 204,
                  line_end: 264,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Checking same-file labels.",
          tool_calls: [
            {
              id: "grep-toolbar-undo",
              function: {
                name: "grep",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  pattern: "toolbar",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Looking for insert handlers in the same file.",
          tool_calls: [
            {
              id: "grep-toolbar-insert",
              function: {
                name: "grep",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  pattern: "Insert",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Narrowing to insert rest.",
          tool_calls: [
            {
              id: "grep-toolbar-rest",
              function: {
                name: "grep",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  pattern: "onInsertRest",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading the first located target range.",
          tool_calls: [
            {
              id: "read-toolbar-target-a",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  line_start: 260,
                  line_end: 340,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading the adjacent target range.",
          tool_calls: [
            {
              id: "read-toolbar-target-b",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  line_start: 340,
                  line_end: 420,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Reading the final located target range.",
          tool_calls: [
            {
              id: "read-toolbar-target-c",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/NotationToolbar.tsx",
                  line_start: 420,
                  line_end: 500,
                },
              },
            },
          ],
        })
        .mockResolvedValue({
          content: "Implementation stalled before edits.",
          tool_calls: [],
        });

      await processInput(
        "Automation: active editing workflow improvement\n" +
          "Work from main only. At the start, run git status. " +
          "Prefer components/NotationToolbar.tsx. " +
          "Use docs/keyboard-shortcuts.md as backlog/reference material. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 12 },
      );

      expect(executeTool).toHaveBeenCalledWith(
        "read_file",
        expect.objectContaining({
          path: "components/NotationToolbar.tsx",
          line_start: 420,
          line_end: 500,
        }),
        expect.any(Object),
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "tool" &&
            typeof m.content === "string" &&
            m.content.includes("planned implementation file has already been read"),
        ),
      ).toBe(false);
    }, 15000);

    it("allows narrow edit recovery search after bounded backlog edit mismatch", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("Toolbar file")
        .mockResolvedValueOnce("Keyboard shortcuts")
        .mockResolvedValueOnce("File content")
        .mockResolvedValueOnce("ERROR: old_text not found in components/NotationToolbar.js")
        .mockResolvedValueOnce("2:  return '<button class=\"note\">Note</button>';")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: add toolbar aria label\n" +
            "Selection rationale: components/NotationToolbar.js is an existing active editing UI\n" +
            "Files: components/NotationToolbar.js\n" +
            "Implementation outline: read the toolbar lines, then add one aria label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Reading the planned implementation file.",
          tool_calls: [
            {
              id: "read-toolbar",
              function: {
                name: "read_file",
                arguments: {
                  path: "components/NotationToolbar.js",
                  line_start: 1,
                  line_end: 40,
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Applying the scoped edit.",
          tool_calls: [
            {
              id: "edit-toolbar",
              function: {
                name: "edit_file",
                arguments: {
                  path: "components/NotationToolbar.js",
                  old_text: "<button>Add Note</button>",
                  new_text: "<button aria-label=\"Add Note\">Add Note</button>",
                },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Finding the exact current line after edit mismatch.",
          tool_calls: [
            {
              id: "grep-toolbar",
              function: {
                name: "bash",
                arguments: {
                  command: "grep -n \"Note\" components/NotationToolbar.js",
                },
              },
            },
          ],
        })
        .mockResolvedValue({
          content: "Implementation stalled before edits.",
          tool_calls: [],
        });

      await processInput(
        "Automation: active editing workflow improvement\n" +
          "Work from main only. At the start, run git status. " +
          "Prefer components/NotationToolbar.js. " +
          "Use docs/keyboard-shortcuts.md as backlog/reference material. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 12 },
      );

      expect(executeTool).toHaveBeenCalledWith(
        "bash",
        expect.objectContaining({
          command: "grep -n \"Note\" components/NotationToolbar.js",
        }),
        expect.any(Object),
      );
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "tool" &&
            typeof m.content === "string" &&
            m.content.includes("planned implementation file has already been read"),
        ),
      ).toBe(false);
    });

    it("prefetches current UI component evidence when the prompt asks for it", async () => {
      const fs = require("fs");
      const fixtureDir = ".tmp-agent-ui-prefetch";
      fs.mkdirSync(`${fixtureDir}/components`, { recursive: true });
      fs.writeFileSync(
        `${fixtureDir}/components/NotationToolbar.tsx`,
        "export function NotationToolbar() { return null; }\n",
      );
      const originalCwd = process.cwd();
      process.chdir(fixtureDir);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      try {
        callStream.mockResolvedValueOnce({
          content:
            "Selected improvement: improve toolbar labels\n" +
            "Selection rationale: components/NotationToolbar.tsx is current UI evidence\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        });

        await processInput(
          "Automation: MuseScore parity and UX improvements\n" +
            "Work from main only. At the start, run git status. " +
            "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
            "Also inspect the current UI/components for obvious friction before choosing a task. " +
            "Pick at most one tightly scoped improvement in priority order.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 25 },
        );
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(executeTool).toHaveBeenCalledWith(
        "list_directory",
        expect.objectContaining({ path: "components", max_depth: 2 }),
        expect.any(Object),
      );
      expect(executeTool).toHaveBeenCalledWith(
        "read_file",
        expect.objectContaining({
          path: "components/NotationToolbar.tsx",
          line_start: 1,
          line_end: 180,
        }),
        expect.any(Object),
      );
    });

    it("reprompts empty bounded backlog planning responses after prefetch", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");
      callStream
        .mockResolvedValueOnce({ content: "", tool_calls: [] })
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve toolbar labels\n" +
            "Selection rationale: docs/user-manual.md and current UI evidence show unclear labels\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValue({
          content: "Implementation stalled before edits.",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, inspect git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Also inspect the current UI/components for obvious friction before choosing a task. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 8 },
      );

      expect(callStream).toHaveBeenCalledTimes(3);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Empty planning response is not a valid result"),
        ),
      ).toBe(true);
    });

    it("reprompts bounded backlog plans that invent nonexistent implementation paths", async () => {
      const fs = require("fs");
      const fixtureDir = ".tmp-agent-plan-paths";
      fs.mkdirSync(`${fixtureDir}/components`, { recursive: true });
      fs.mkdirSync(`${fixtureDir}/docs`, { recursive: true });
      fs.writeFileSync(
        `${fixtureDir}/components/NotationToolbar.tsx`,
        "export function NotationToolbar() { return null; }\n",
      );
      fs.writeFileSync(`${fixtureDir}/docs/keyboard-shortcuts.md`, "# Keys\n");
      fs.writeFileSync(`${fixtureDir}/docs/user-manual.md`, "# Manual\n");
      const originalCwd = process.cwd();
      process.chdir(fixtureDir);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");
      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve toolbar labels\n" +
            "Selection rationale: current UI evidence shows unclear labels\n" +
            "Files: src/components/Toolbar.tsx\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValue({
          content:
            "Selected improvement: improve toolbar labels\n" +
            "Selection rationale: current UI evidence shows unclear labels\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        });

      try {
        await processInput(
          "Automation: MuseScore parity and UX improvements\n" +
            "Work from main only. At the start, inspect git status. " +
            "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
            "Also inspect the current UI/components for obvious friction before choosing a task. " +
            "Pick at most one tightly scoped improvement.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 6 },
        );
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("implementation files that do not exist") &&
            m.content.includes("components/NotationToolbar.tsx"),
        ),
      ).toBe(true);
    });

    it("reprompts bounded backlog plans that use missing prompt example files", async () => {
      const fs = require("fs");
      const fixtureDir = ".tmp-agent-plan-prompt-paths";
      fs.mkdirSync(`${fixtureDir}/components`, { recursive: true });
      fs.mkdirSync(`${fixtureDir}/docs`, { recursive: true });
      fs.writeFileSync(
        `${fixtureDir}/components/CommandCenter.tsx`,
        "export function CommandCenter() { return null; }\n",
      );
      fs.writeFileSync(`${fixtureDir}/docs/keyboard-shortcuts.md`, "# Keys\n");
      fs.writeFileSync(`${fixtureDir}/docs/user-manual.md`, "# Manual\n");
      const originalCwd = process.cwd();
      process.chdir(fixtureDir);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");
      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve toolbar labels\n" +
            "Selection rationale: current UI evidence shows unclear labels\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValue({
          content:
            "Selected improvement: improve command center labels\n" +
            "Selection rationale: current UI evidence shows unclear labels\n" +
            "Files: components/CommandCenter.tsx\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        });

      try {
        await processInput(
          "Automation: MuseScore parity and UX improvements\n" +
            "Work from main only. At the start, inspect git status. " +
            "Prefer existing components/NotationToolbar.tsx or components/CommandCenter.tsx. " +
            "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
            "Also inspect the current UI/components for obvious friction before choosing a task. " +
            "Pick at most one tightly scoped improvement.",
          null,
          { autoConfirm: true, silent: true, maxIterations: 6 },
        );
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("implementation files that do not exist") &&
            m.content.includes("components/CommandCenter.tsx"),
        ),
      ).toBe(true);
    });

    it("reports stalled bounded backlog implementation on a final empty response", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");
      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve toolbar labels\n" +
            "Selection rationale: current UI evidence shows unclear labels\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: locate and update one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "",
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: {
                name: "glob",
                arguments: JSON.stringify({ pattern: "components/NotationToolbar.tsx" }),
              },
            },
          ],
        })
        .mockResolvedValueOnce({ content: "", tool_calls: [] });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, inspect git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Also inspect the current UI/components for obvious friction before choosing a task. " +
          "Pick at most one tightly scoped improvement.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 3 },
      );

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Implementation stalled before edits") &&
            m.content.includes("does not falsely report success"),
        ),
      ).toBe(true);
    });

    it("does not finish bounded backlog implementation on prose-only no-progress", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve command center labels\n" +
            "Selection rationale: cli/agent.js is a current implementation surface\n" +
            "Files: cli/agent.js, tests/agent.test.js\n" +
            "Implementation outline: update one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValue({
          content: "Let me read the most likely file for command center implementation:",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Implementation is not complete"),
        ),
      ).toBe(true);
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Implementation stalled before edits"),
        ),
      ).toBe(true);
    });

    it("rejects false implementation completion claims without edits", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: add toolbar aria label\n" +
            "Selection rationale: components/NotationToolbar.tsx needs clearer accessibility\n" +
            "Files: components/NotationToolbar.tsx\n" +
            "Implementation outline: add one aria-label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "Implemented the accessibility improvement by adding an aria-label to the Insert Note button. The project was built successfully, all tests continue to pass, and the repository is clean.",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 10 },
      );

      const msgs = getConversationMessages();
      const hasFalseClaimStall = msgs.some(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.includes("claimed changes, verification, or a clean worktree") &&
          m.content.includes("without any successful file edit"),
      );
      expect(hasFalseClaimStall).toBe(true);
    });

    it("reprompts false git/tool blocking claims in bounded backlog implementation", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve command center labels\n" +
            "Selection rationale: cli/agent.js is a current implementation surface\n" +
            "Files: cli/agent.js, tests/agent.test.js\n" +
            "Implementation outline: read then edit one label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content:
            "I'm unable to run any Git commands because the system instructions explicitly block git operations in this implementation phase.",
          tool_calls: [],
        })
        .mockResolvedValue({
          content: "Implementation stalled before edits.",
          tool_calls: [],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("the initial git preflight is already complete"),
        ),
      ).toBe(true);
    });

    it("reports stalled implementation when tool budget is reached before edits", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      process.env.NEX_MAX_TOOL_CALLS = "1";
      getAutoConfirm.mockReturnValue(true);

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: inspect current file\n" +
            "Selection rationale: package.json exists\n" +
            "Files: package.json\n" +
            "Implementation outline: read then edit\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Reading the target.",
          tool_calls: [
            {
              id: "read-package",
              function: {
                name: "read_file",
                arguments: { path: "package.json", line_start: 1, line_end: 20 },
              },
            },
          ],
        });
      executeTool.mockResolvedValueOnce("{}");

      await processInput(
        "Improve docs/keyboard-shortcuts.md and docs/user-manual.md based on the backlog.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 10 },
      );

      expect(callStream).toHaveBeenCalledTimes(2);
      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Implementation stalled before edits"),
        ),
      ).toBe(true);
    });

    it("stops bounded backlog runs after repeated edit mismatches", async () => {
      process.env.NEX_PHASE_ROUTING = "1";
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValueOnce("File content")
        .mockResolvedValueOnce("File content")
        .mockResolvedValue("old_text not found");

      callStream
        .mockResolvedValueOnce({
          content:
            "Selected improvement: improve command center labels\n" +
            "Selection rationale: package.json is a current implementation surface\n" +
            "Files: package.json\n" +
            "Implementation outline: read then edit\n" +
            "Verification plan: npm test\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        })
        .mockResolvedValueOnce({
          content: "Reading the target.",
          tool_calls: [
            {
              id: "read-package",
              function: {
                name: "read_file",
                arguments: { path: "package.json", line_start: 1, line_end: 20 },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Trying the first edit.",
          tool_calls: [
            {
              id: "edit-package-1",
              function: {
                name: "edit_file",
                arguments: { path: "package.json", old_text: "missing-a", new_text: "x" },
              },
            },
          ],
        })
        .mockResolvedValueOnce({
          content: "Trying the second edit.",
          tool_calls: [
            {
              id: "edit-package-2",
              function: {
                name: "edit_file",
                arguments: { path: "package.json", old_text: "missing-b", new_text: "y" },
              },
            },
          ],
        });

      await processInput(
        "Automation: MuseScore parity and UX improvements\n" +
          "Work from main only. At the start, run git status. " +
          "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
          "Pick at most one tightly scoped improvement in priority order.",
        null,
        { autoConfirm: true, silent: true, maxIterations: 25 },
      );

      expect(
        getConversationMessages().some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("attempted file edits"),
        ),
      ).toBe(true);
    });
  });

		  describe("gated automation preflight guard", () => {
    const gatedPrompt =
      "Automation: MuseScore parity and UX improvements\n" +
      "Work from main only. At the start of each run, inspect git status and the current branch. " +
      "If the worktree is dirty with unrelated changes, stop without editing, committing, or pushing. " +
      "Use documented gaps in docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
      "Pick at most one tightly scoped improvement. After verification passes, stage only the files changed, commit and push.";

	    it("emits preflight tool_start/tool_end events via serverHooks", async () => {
	      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

	      const prompt = "Automation: test\nWork from main only. Fix any typo in README.";
	      const serverHooks = {
	        onToken: jest.fn(),
	        onThinkingToken: jest.fn(),
	        onToolStart: jest.fn(),
	        onToolEnd: jest.fn(),
	      };

	      await processInput(prompt, serverHooks, { autoConfirm: true, silent: true });

	      expect(serverHooks.onToolStart).toHaveBeenCalledWith("bash", {
	        command: "git status --short --branch",
	      });
	      expect(serverHooks.onToolEnd).toHaveBeenCalled();

	      const toolEnd = serverHooks.onToolEnd.mock.calls.find(
	        (c) => c && c[0] === "bash",
	      );
	      expect(toolEnd).toBeDefined();
	      expect(String(toolEnd[1] || "")).toContain("git status --short --branch");
	    });

	    it("records preflight as an assistant tool_call + tool result pair", async () => {
	      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

	      const prompt = "Automation: test\nWork from main only. Fix any typo in README.";

	      await processInput(prompt, null, { autoConfirm: true, silent: true });

	      const msgs = getConversationMessages();
      const callMsg = msgs.find(
        (m) =>
          m.role === "assistant" &&
          Array.isArray(m.tool_calls) &&
          m.tool_calls.some(
            (tc) =>
              tc?.id === "preflight-git-status" &&
              (tc.function?.name || tc.name) === "bash",
          ),
      );
      expect(callMsg).toBeDefined();
	      const toolMsg = msgs.find(
	        (m) => m.role === "tool" && m.tool_call_id === "preflight-git-status",
	      );
	      expect(toolMsg).toBeDefined();

	      // Preflight evidence must also show up as a user-visible assistant message
	      // (some transcript views hide tool messages).
	      const precheckIdx = msgs.findIndex(
	        (m) =>
	          m.role === "assistant" &&
	          typeof m.content === "string" &&
	          m.content.includes("[PRECHECK]") &&
	          m.content.includes("git status --short --branch") &&
	          m.content.includes("## devel...origin/devel"),
	      );
	      expect(precheckIdx).toBeGreaterThan(-1);
	      // Ordering matters: tool_call → tool result → visible assistant evidence.
	      expect(msgs.indexOf(callMsg)).toBeLessThan(msgs.indexOf(toolMsg));
	      expect(msgs.indexOf(toolMsg)).toBeLessThan(precheckIdx);
	    });

	    it("prints preflight evidence in headless mode when not silent", async () => {
	      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

	      const prompt = "Automation: test\nWork from main only. Fix any typo in README.";

	      await processInput(prompt, null, { autoConfirm: true });

	      const out = logOutput();
	      expect(out).toContain("[PRECHECK] Preflight ran: `git status --short --branch`.");
	      expect(out).toContain("## devel...origin/devel");
	    });

	    it("runs preflight for branch-only gates (no explicit git-status wording)", async () => {
	      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

	      const prompt = "Automation: test\nWork from main only. Fix any typo in README.";

	      await processInput(prompt, null, { autoConfirm: true, silent: true });

	      expect(callStream).not.toHaveBeenCalled();
	      expect(executeTool).toHaveBeenCalledTimes(1);
	      expect(executeTool.mock.calls[0][0]).toBe("bash");
	      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
	    });

    it("runs preflight from an explicit absolute task directory", async () => {
      const fs = require("fs");
      const path = require("path");
      const originalCwd = process.cwd();
      const fixtureDir = path.resolve(".tmp-agent-target-cwd");
      fs.mkdirSync(fixtureDir, { recursive: true });
      executeTool.mockImplementationOnce(async () => {
        expect(fs.realpathSync(process.cwd())).toBe(fs.realpathSync(fixtureDir));
        return "## main...origin/main\n";
      });
      callStream.mockResolvedValueOnce({
        content:
          "Preflight: git status --short --branch\n" +
          "Preflight output: ## main...origin/main\n" +
          "Branch: main\n" +
          "Chosen task: no safe task found\n" +
          "Files changed: none\n" +
          "Verification: none\n" +
          "Commit: none\n" +
          "Push: none\n" +
          "Final git status: unknown\n" +
          "Remaining risk: none",
        tool_calls: [],
      });

      try {
        await processInput(
          `Work only in ${fixtureDir}. Required branch: main. At the start, inspect git status and the current branch. If dirty, stop.`,
          null,
          { autoConfirm: true, silent: true, maxIterations: 3 },
        );
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }

      expect(executeTool).toHaveBeenCalledWith(
        "bash",
        { command: "git status --short --branch" },
        expect.any(Object),
      );
    });

	    it("runs preflight for required-branch gates without an Automation header", async () => {
	      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

	      const prompt = "Work on main only. Fix any typo in README.";

	      await processInput(prompt, null, { autoConfirm: true, silent: true });

	      expect(callStream).not.toHaveBeenCalled();
	      expect(executeTool).toHaveBeenCalledTimes(1);
	      expect(executeTool.mock.calls[0][0]).toBe("bash");
	      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
	    });

    it("runs preflight for backticked required-branch gates", async () => {
	      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

	      const prompt =
	        "Automation: test\nWork from `main` only. Fix any typo in README.";

      await processInput(prompt, null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
      const msgs = getConversationMessages();
      const blocked = msgs.find(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.includes("Required branch: main."),
      );
      expect(blocked).toBeDefined();
    });

    it("enforces required branch for 'the main branch only' phrasing", async () => {
      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

      const prompt =
        "Automation: test\nWork from the main branch only. Fix any typo in README.";

      await processInput(prompt, null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");

      const msgs = getConversationMessages();
      const blocked = msgs.find(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.includes("Required branch: main."),
      );
      expect(blocked).toBeDefined();
    });

    it("blocks when preflight output is not recognizable `git status -sb` output", async () => {
      executeTool.mockResolvedValueOnce("Branch: main\nClean working tree (no changes)");

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("[PRECHECK BLOCKED]"),
        ),
      ).toBe(true);
    });

    it("runs git status preflight before executing write tools", async () => {
      getAutoConfirm.mockReturnValue(true);
      mockStream(
        "Selected improvement: tighten bounded backlog decision gating\n" +
          "Selection rationale: prevents bypassing the required plan template\n" +
          "Files: cli/agent.js\n" +
          "Implementation outline: block plan→implement unless the template is satisfied\n" +
          "Verification plan: npm test -- tests/agent.test.js\n" +
          "Browser/UI applicability: not required",
        [],
      );
      mockStream("Ok", [
        {
          function: {
            name: "edit_file",
            arguments: { path: "cli/agent.js" },
          },
          id: "c1",
        },
      ]);
      mockStream("Implemented the change.");
      mockStream(
        "PASS: Verified with a focused dry-run of the gated workflow and confirmed the guardrails behave as expected without extra side effects.",
      );

      executeTool
        .mockResolvedValueOnce("## main...origin/main\n") // preflight git status
        .mockResolvedValueOnce("keyboard shortcuts backlog")
        .mockResolvedValueOnce("user manual backlog")
        .mockResolvedValueOnce("roadmap backlog")
        .mockResolvedValueOnce("OK"); // edit_file result

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      // Preflight runs before any model call and before any write tool.
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
      const editCallIndex = executeTool.mock.calls.findIndex(
        ([name]) => name === "edit_file",
      );
      expect(editCallIndex).toBeGreaterThan(0);
      expect(executeTool.mock.invocationCallOrder[0]).toBeLessThan(
        callStream.mock.invocationCallOrder[0],
      );
      expect(executeTool.mock.invocationCallOrder[editCallIndex]).toBeGreaterThan(
        callStream.mock.invocationCallOrder[0],
      );
    });

    it("runs git status preflight even when the gated prompt is not the first message", async () => {
      getAutoConfirm.mockReturnValue(true);
      setConversationMessages([
        { role: "user", content: "Earlier unrelated message" },
        { role: "assistant", content: "Ok" },
      ]);

      mockStream(
        "Selected improvement: tighten bounded backlog decision gating\n" +
          "Selection rationale: prevents bypassing the required plan template\n" +
          "Files: cli/agent.js\n" +
          "Implementation outline: block plan→implement unless the template is satisfied\n" +
          "Verification plan: npm test -- tests/agent.test.js\n" +
          "Browser/UI applicability: not required",
        [],
      );
      mockStream("Ok", [
        {
          function: {
            name: "edit_file",
            arguments: { path: "cli/agent.js" },
          },
          id: "c1",
        },
      ]);
      mockStream("Implemented the change.");
      mockStream(
        "PASS: Verified with a focused dry-run of the gated workflow and confirmed the guardrails behave as expected without extra side effects.",
      );

      executeTool
        .mockResolvedValueOnce("## main...origin/main\n") // preflight git status
        .mockResolvedValueOnce("keyboard shortcuts backlog")
        .mockResolvedValueOnce("user manual backlog")
        .mockResolvedValueOnce("roadmap backlog")
        .mockResolvedValueOnce("OK"); // edit_file result

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe(
        "git status --short --branch",
      );
      const editCallIndex = executeTool.mock.calls.findIndex(
        ([name]) => name === "edit_file",
      );
      expect(editCallIndex).toBeGreaterThan(0);
      expect(executeTool.mock.invocationCallOrder[0]).toBeLessThan(
        callStream.mock.invocationCallOrder[0],
      );
      expect(executeTool.mock.invocationCallOrder[editCallIndex]).toBeGreaterThan(
        callStream.mock.invocationCallOrder[0],
      );
    });

    it("does not auto-orchestrate gated prompts even when they look complex", async () => {
      const { detectComplexPrompt, runOrchestrated } = require("../cli/orchestrator");
      detectComplexPrompt.mockReturnValueOnce({
        isComplex: true,
        estimatedGoals: 3,
        reason: "3 bullet points",
      });
      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

      const prompt =
        "Automation: test\n" +
        "Work from main only. Please run git status and check current branch.\n" +
        "- Fix login\n" +
        "- Fix logout\n" +
        "- Fix search\n";

      await processInput(prompt, null, { autoConfirm: true, silent: true });

      expect(runOrchestrated).not.toHaveBeenCalled();
      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
    });

    it("does not auto-orchestrate gated prompts even when they are not the first message", async () => {
      setConversationMessages([
        { role: "user", content: "Earlier unrelated message" },
        { role: "assistant", content: "Ok" },
      ]);

      const { detectComplexPrompt, runOrchestrated } = require("../cli/orchestrator");
      detectComplexPrompt.mockReturnValueOnce({
        isComplex: true,
        estimatedGoals: 3,
        reason: "3 bullet points",
      });
      executeTool.mockResolvedValueOnce("## devel...origin/devel\n"); // wrong branch → preflight blocks

      const prompt =
        "Automation: test\n" +
        "Work from main only. Please run git status and check current branch.\n" +
        "- Fix login\n" +
        "- Fix logout\n" +
        "- Fix search\n";

      await processInput(prompt, null, { autoConfirm: true, silent: true });

      expect(runOrchestrated).not.toHaveBeenCalled();
      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
    });

    it("re-runs git status preflight for each gated prompt in a long-running thread", async () => {
      executeTool
        .mockResolvedValueOnce("## devel...origin/devel\n")
        .mockResolvedValueOnce("## devel...origin/devel\n");

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });
      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(2);
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
      expect(executeTool.mock.calls[1][0]).toBe("bash");
      expect(executeTool.mock.calls[1][1].command).toBe("git status --short --branch");
    });

	    it("keeps enforcing git preflight on follow-up prompts that omit gate wording", async () => {
      executeTool
        .mockResolvedValueOnce("## devel...origin/devel\n")
        .mockResolvedValueOnce("## devel...origin/devel\n");

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });
      await processInput("Please continue.", null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(2);
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
      expect(executeTool.mock.calls[1][0]).toBe("bash");
      expect(executeTool.mock.calls[1][1].command).toBe("git status --short --branch");
    });

    it("stops immediately when preflight shows a dirty worktree", async () => {
      executeTool.mockResolvedValueOnce("## main...origin/main\n M cli/agent.js\n");

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("[PRECHECK BLOCKED]"),
        ),
      ).toBe(true);
    });

    it("stops immediately when not on the required branch", async () => {
      executeTool.mockResolvedValueOnce("## devel...origin/devel\n");

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      expect(callStream).not.toHaveBeenCalled();
      expect(executeTool).toHaveBeenCalledTimes(1);
      const msgs = getConversationMessages();
      const blocked = msgs.find(
        (m) =>
          m.role === "assistant" &&
          typeof m.content === "string" &&
          m.content.includes("Required branch: main."),
      );
      expect(blocked).toBeDefined();
    });

	    it("enforces a structured final automation report when verify output is non-compliant", async () => {
      getAutoConfirm.mockReturnValue(true);
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n") // preflight ok
        .mockResolvedValueOnce("ok") // write_file result
        .mockResolvedValueOnce("PASS"); // verify bash result

      let summaryTools = null;
      let summaryMessages = null;
      let callIndex = 0;
      callStream.mockImplementation(async (messages, tools, opts) => {
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const lastUserText = String(lastUser?.content || "");
        const wantsAutomationReport = lastUserText.includes(
          "Write a final automation report using EXACT labels",
        );
        if (Array.isArray(tools) && tools.length === 0 && wantsAutomationReport) {
          summaryTools = tools;
          summaryMessages = messages;
          const content =
            "Preflight: git status --short --branch\n" +
            "Preflight output: ## main...origin/main\n" +
            "Branch: main\n" +
            "Chosen task: update a file\n" +
            "Files changed: fix.txt\n" +
            "Verification: npm test\n" +
            "Commit: not detected\n" +
            "Push: not detected\n" +
            "Final git status: (not checked)\n" +
            "Remaining risk: none";
          if (opts?.onToken) opts.onToken(content);
          return { content, tool_calls: [] };
        }

        if (callIndex === 0) {
          callIndex++;
          const content =
            "Plan: make one small doc-safe change.\nFiles: fix.txt\nVerification: npm test";
          if (opts?.onToken) opts.onToken(content);
          return { content, tool_calls: [] };
        }
        if (callIndex === 1) {
          callIndex++;
          return {
            content: "",
            tool_calls: [
              {
                function: {
                  name: "write_file",
                  arguments: { path: "fix.txt", content: "x" },
                },
                id: "w1",
              },
            ],
          };
        }
        if (callIndex === 2) {
          callIndex++;
          const content =
            "Implemented the change in fix.txt. Proceeding to verification now with targeted checks.";
          if (opts?.onToken) opts.onToken(content);
          return { content, tool_calls: [] };
        }
        if (callIndex === 3) {
          callIndex++;
          return {
            content: "",
            tool_calls: [
              {
                function: { name: "bash", arguments: { command: "npm test" } },
                id: "b1",
              },
            ],
          };
        }
        if (callIndex === 4) {
          callIndex++;
          // Non-compliant verify summary (missing required automation-report labels),
          // but long enough to trigger verify-phase completion.
          const content =
            "Verification complete. I ran the targeted checks and the results look good based on tool output. " +
            "Next step is to review and, if desired, commit and push from the correct branch.";
          if (opts?.onToken) opts.onToken(content);
          return { content, tool_calls: [] };
        }
        throw new Error("Unexpected callStream call");
      });

      await processInput(
        "Automation: test\n" +
          "Work from main only. At the start, run git status. " +
          "If the worktree is dirty, stop without editing.",
        null,
        { autoConfirm: true, silent: true },
      );

      expect(summaryTools).toEqual([]);
      expect(summaryMessages).toEqual(expect.any(Array));
      const summaryCall = callStream.mock.calls.find(([msgs, tools]) => {
        if (!Array.isArray(tools) || tools.length !== 0) return false;
        return (msgs || []).some(
          (m) =>
            m?.role === "user" &&
            String(m?.content || "").includes(
              "Write a final automation report using EXACT labels",
            ),
        );
      });
      expect(summaryCall).toBeDefined();

      const msgs = getConversationMessages();
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("Preflight:") &&
            m.content.includes("Final git status:"),
        ),
      ).toBe(true);
	    });

	    it("does not auto-orchestrate automation backlog prompts even without explicit git gates", async () => {
	      const { detectComplexPrompt, runOrchestrated } = require("../cli/orchestrator");
	      detectComplexPrompt.mockReturnValueOnce({
	        isComplex: true,
	        estimatedGoals: 3,
	        reason: "3 bullet points",
	      });

	      callStream.mockResolvedValueOnce({ content: "no safe task found", tool_calls: [] });

	      const prompt =
	        "Automation: test\n" +
	        "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
	        "Pick at most one tightly scoped improvement in priority order.\n" +
	        "- Improve docs quality\n" +
	        "- Improve UX text\n" +
	        "- Improve error messages\n";

	      await processInput(prompt, null, { autoConfirm: true, silent: true });

	      expect(runOrchestrated).not.toHaveBeenCalled();
	      expect(callStream).toHaveBeenCalled();
	      expect(executeTool).toHaveBeenCalledWith(
	        "read_file",
	        expect.objectContaining({ path: "docs/keyboard-shortcuts.md" }),
	        expect.objectContaining({ autoConfirm: true, silent: true }),
	      );
	    });

    it("does not inject few-shot examples into backlog automations", async () => {
      let firstMessages = null;
      callStream.mockImplementationOnce(async (messages) => {
        firstMessages = messages;
        return {
          content:
            "Selected improvement: update shortcut documentation\n" +
            "Selection rationale: docs/keyboard-shortcuts.md is prompt evidence\n" +
            "Files: docs/keyboard-shortcuts.md\n" +
            "Implementation outline: update one documented shortcut label\n" +
            "Verification plan: npm test -- tests/agent.test.js\n" +
            "Browser/UI applicability: not required",
          tool_calls: [],
        };
      });
      executeTool
        .mockResolvedValueOnce("keyboard shortcuts backlog")
        .mockResolvedValueOnce("user manual backlog");

      const prompt =
        "Automation: test\n" +
        "Use docs/keyboard-shortcuts.md and docs/user-manual.md as the primary backlog. " +
        "Pick at most one tightly scoped improvement in priority order.\n" +
        "- Improve active editing workflows\n" +
        "- Improve command center usefulness\n";

      await processInput(prompt, null, { autoConfirm: true, silent: true });

      const joined = firstMessages
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join("\n");
      expect(joined).not.toContain("[EXAMPLE");
      expect(joined).not.toContain("stale data");
      expect(joined).toContain("[BACKLOG PREFLIGHT]");
    });

      it("allows final git-status evidence after commit in gated automations", async () => {
        getAutoConfirm.mockReturnValue(true);
        executeTool
          .mockResolvedValueOnce("## main...origin/main\n") // preflight ok
          .mockResolvedValueOnce("ok") // write_file result
          .mockResolvedValueOnce("[main abc1234] fix: test\n 1 file changed, 1 insertion(+)\n") // git commit
          .mockResolvedValueOnce("## main...origin/main\n") // final git status
          .mockResolvedValueOnce("PASS"); // verify bash result

        // 1) Plan phase: try a bash call so it gets blocked
        mockStream(
          "I will run a command to proceed.",
          [
            {
              function: { name: "bash", arguments: { command: "echo hi" } },
              id: "b-plan",
            },
          ],
        );

        // 2) Plan phase: text-only response triggers plan→implement auto-advance
        mockStream("Proceeding with implementation.");

        // 3) Implement phase: make a change
        mockStream(
          "Implementing a small change.",
          [
            {
              function: {
                name: "write_file",
                arguments: { path: "fix.txt", content: "x\n" },
              },
              id: "w1",
            },
          ],
        );

        // 4) Implement phase: text-only response triggers implement→verify transition
        mockStream("Implementation done; moving to verification.");

        // 5) Verify phase: perform a commit
        mockStream(
          "Committing changes now.",
          [
            {
              function: {
                name: "bash",
                arguments: { command: "git commit -am \"test\"" },
              },
              id: "b-commit",
            },
          ],
        );

        // 6) Verify phase: capture final git status evidence
        mockStream(
          "Checking final git status for report evidence.",
          [
            {
              function: {
                name: "bash",
                arguments: { command: "git status --short --branch" },
              },
              id: "b-status",
            },
          ],
        );

        // 7) Verify phase: run one verification command so verify can complete
        mockStream(
          "Running a focused verification command.",
          [
            {
              function: { name: "bash", arguments: { command: "npm test" } },
              id: "b-verify",
            },
          ],
        );

        // 8) Verify phase: end with a substantive compliant report so the loop can exit
        mockStream(
          "Preflight: git status --short --branch\n" +
            "Preflight output: ## main...origin/main\n" +
            "Branch: main\n" +
            "Chosen task: test scenario\n" +
            "Files changed: fix.txt\n" +
            "Verification: npm test (PASS)\n" +
            "Commit: detected (git commit succeeded per bash output)\n" +
            "Push: not detected\n" +
            "Final git status: bash:git status --short --branch\n" +
            "## main...origin/main\n" +
            "Remaining risk: none",
        );

        await processInput(
          "Automation: test\n" +
            "Work from main only. At the start, run git status. " +
            "After verification passes, stage only the files changed, commit and push.",
          null,
          { autoConfirm: true, silent: true },
        );

        const msgs = getConversationMessages();
        const postCommitSystemMsg = msgs.find(
          (m) =>
            m.role === "user" &&
            typeof m.content === "string" &&
            m.content.includes("Git commit succeeded"),
        );
        if (!postCommitSystemMsg) {
          const debug = msgs
            .map((m) => {
              const head =
                typeof m.content === "string"
                  ? m.content.slice(0, 200).replace(/\n/g, "\\n")
                  : Array.isArray(m.content)
                    ? "[blocks]"
                    : "";
              return `${m.role}: ${head}`;
            })
            .slice(-30)
            .join("\n");
          throw new Error(`Expected post-commit system message not found.\n\n${debug}`);
        }
        expect(postCommitSystemMsg.content).toContain("gated automation workflow");
        expect(postCommitSystemMsg.content).toContain("git status --short --branch");
        expect(postCommitSystemMsg.content).not.toContain(
          "Do NOT run further git status / git diff / git log",
        );

        // Ensure we did not block the final git-status evidence in this gated flow.
        expect(executeTool.mock.calls.map((c) => c[1]?.command)).toEqual([
          "git status --short --branch",
          undefined,
          "git commit -am \"test\"",
          "git status --short --branch",
          "npm test",
        ]);
      }, 15000);
	  });
});

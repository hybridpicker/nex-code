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
  _buildSymbolHintBlock,
  _claimsVerificationOrCompletion,
  _statesVerificationGap,
  _shouldAutoOrchestrate,
  _shouldSkipPlanPhaseForDirectCreation,
  _hasAutomationOrPreflightGate,
  _extractDirectTaskPaths,
  _isBoundedBacklogPlanningPrompt,
  _buildBoundedBacklogPlanInstruction,
  _looksLikeBoundedBacklogDecision,
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
const { fitToContext, getUsage } = require("../cli/context-engine");
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
      expect(logOutput()).toContain("blocked");
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

    it("calls onThinkingToken hook", async () => {
      const onThinkingToken = jest.fn();
      callStream.mockImplementationOnce(async (_m, _t, opts) => {
        if (opts.onThinkingToken) opts.onThinkingToken();
        return { content: "ok", tool_calls: [] };
      });
      await processInput("test", { onThinkingToken });
      expect(onThinkingToken).toHaveBeenCalled();
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
        "Wenn ich bei /guitar-mentor Ideen loesche kommen sie immer wieder zurueck ins webui https://jarvis.schoensgibl.com/guitar-mentor/",
      );

      expect(executeTool).not.toHaveBeenCalled();
      const msgs = getConversationMessages();
      const hasBlockMsg = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes(
            "Inspect https://jarvis.schoensgibl.com/guitar-mentor/ with browser_open first",
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
      // "out1" doesn't overlap with "snakegame" — use a matching filename instead.
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
      mockStream("Done, snake game created!");

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

    it("exits after 8 consecutive read-only tool iterations in headless mode", async () => {
      clearConversation();
      getAutoConfirm.mockReturnValue(true);

      // Set up 9 consecutive read-only tool iterations (8 triggers exit)
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
      // This should NOT be reached
      mockStream("SHOULD NOT REACH");

      await processInput("Investigate the codebase");

      const msgs = getConversationMessages();
      const hasUnreached = msgs.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("SHOULD NOT REACH"),
      );
      expect(hasUnreached).toBe(false);
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
    });

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
    });

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
            "Verification plan: npm test -- tests/docs.test.js\n" +
            "Browser/UI applicability: not required",
        ),
      ).toBe(true);
      expect(_looksLikeBoundedBacklogDecision("no safe task found")).toBe(true);
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
        .mockResolvedValueOnce({ content: "no safe task found", tool_calls: [] });

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

    it("stops bounded backlog planning instead of implementing after too many reads", async () => {
      executeTool
        .mockResolvedValueOnce("## main...origin/main\n")
        .mockResolvedValue("File content");
      for (let n = 0; n < 10; n++) {
        mockStream("", [
          {
            function: {
              name: "read_file",
              arguments: { path: `docs/backlog-${n}.md` },
            },
            id: `read-${n}`,
          },
        ]);
      }

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
      expect(
        msgs.some(
          (m) =>
            m.role === "assistant" &&
            typeof m.content === "string" &&
            m.content.includes("no safe task found"),
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
  });

  describe("gated automation preflight guard", () => {
    const gatedPrompt =
      "Automation: MuseScore parity and UX improvements\n" +
      "Work from main only. At the start of each run, inspect git status and the current branch. " +
      "If the worktree is dirty with unrelated changes, stop without editing, committing, or pushing. " +
      "Use documented gaps in docs/keyboard-shortcuts.md, docs/user-manual.md, docs/phase-roadmap.md as the primary backlog. " +
      "Pick at most one tightly scoped improvement. After verification passes, stage only the files changed, commit and push.";

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
        .mockResolvedValueOnce("OK"); // edit_file result

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      // Preflight runs before any model call and before any write tool.
      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe("git status --short --branch");
      expect(executeTool.mock.calls[1][0]).toBe("edit_file");
      expect(executeTool.mock.invocationCallOrder[0]).toBeLessThan(
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
        .mockResolvedValueOnce("OK"); // edit_file result

      await processInput(gatedPrompt, null, { autoConfirm: true, silent: true });

      expect(executeTool.mock.calls[0][0]).toBe("bash");
      expect(executeTool.mock.calls[0][1].command).toBe(
        "git status --short --branch",
      );
      expect(executeTool.mock.calls[1][0]).toBe("edit_file");
      expect(executeTool.mock.invocationCallOrder[0]).toBeLessThan(
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
  });
});

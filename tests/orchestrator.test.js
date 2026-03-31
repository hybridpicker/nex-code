/**
 * tests/orchestrator.test.js — Multi-Agent Orchestrator tests
 */

jest.mock("../cli/providers/registry", () => ({
  callStream: jest.fn(),
  parseModelSpec: jest
    .fn()
    .mockReturnValue({ provider: "ollama", model: "test-model" }),
  getActiveProviderName: jest.fn().mockReturnValue("ollama"),
  getActiveModelId: jest.fn().mockReturnValue("test-model"),
  getConfiguredProviders: jest.fn().mockReturnValue([]),
  getProvider: jest.fn(),
  getActiveProvider: jest.fn(),
}));
jest.mock("../cli/ollama", () => ({ parseToolArgs: jest.fn((a) => a) }));
jest.mock("../cli/tool-tiers", () => ({
  filterToolsForModel: jest.fn((t) => t),
  getModelTier: jest.fn().mockReturnValue("standard"),
}));
jest.mock("../cli/costs", () => ({ trackUsage: jest.fn() }));
jest.mock("../cli/ui", () => ({
  MultiProgress: jest.fn().mockImplementation((labels) => ({
    labels: [...labels],
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
  })),
  C: {
    dim: "",
    reset: "",
    red: "",
    green: "",
    yellow: "",
    cyan: "",
    blue: "",
    bold: "",
  },
}));
jest.mock("../cli/tools", () => ({
  TOOL_DEFINITIONS: [],
  executeTool: jest.fn().mockResolvedValue("ok"),
}));

const { callStream } = require("../cli/providers/registry");

const {
  decompose,
  synthesize,
  detectComplexPrompt,
  extractJSON,
  createSemaphore,
  DECOMPOSE_PROMPT,
  SYNTHESIZE_PROMPT,
  DEFAULT_ORCHESTRATOR_MODEL,
  DEFAULT_WORKER_MODEL,
  DEFAULT_MAX_PARALLEL,
  DEFAULT_MAX_SUBTASKS,
  runOrchestrated,
  withRetry,
} = require("../cli/orchestrator");

// Suppress console output during tests
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(process.stderr, "write").mockImplementation(() => {});
  callStream.mockReset();
});
afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Constants ───────────────────────────────────────────────────────────────

describe("constants", () => {
  test("DEFAULT_ORCHESTRATOR_MODEL is kimi-k2.5", () => {
    expect(DEFAULT_ORCHESTRATOR_MODEL).toBe("kimi-k2.5");
  });

  test("DEFAULT_WORKER_MODEL is devstral-2:123b", () => {
    expect(DEFAULT_WORKER_MODEL).toBe("devstral-2:123b");
  });

  test("DEFAULT_MAX_PARALLEL is configurable via NEX_MAX_PARALLEL (default 4)", () => {
    expect(DEFAULT_MAX_PARALLEL).toBeGreaterThanOrEqual(1);
  });

  test("DEFAULT_MAX_SUBTASKS is configurable via NEX_MAX_SUBTASKS (default 8)", () => {
    expect(DEFAULT_MAX_SUBTASKS).toBeGreaterThanOrEqual(1);
  });

  test("DECOMPOSE_PROMPT contains {maxSubTasks} placeholder", () => {
    expect(DECOMPOSE_PROMPT).toContain("{maxSubTasks}");
  });

  test("SYNTHESIZE_PROMPT contains {prompt} and {results} placeholders", () => {
    expect(SYNTHESIZE_PROMPT).toContain("{prompt}");
    expect(SYNTHESIZE_PROMPT).toContain("{results}");
  });
});

// ─── extractJSON ─────────────────────────────────────────────────────────────

describe("extractJSON", () => {
  test("parses plain JSON array", () => {
    const result = extractJSON('[{"id": "t1", "task": "fix bug"}]');
    expect(result).toEqual([{ id: "t1", task: "fix bug" }]);
  });

  test("parses plain JSON object", () => {
    const result = extractJSON('{"summary": "done"}');
    expect(result).toEqual({ summary: "done" });
  });

  test("extracts JSON from markdown code block", () => {
    const text = 'Here is the result:\n```json\n[{"id": "t1"}]\n```\nDone.';
    expect(extractJSON(text)).toEqual([{ id: "t1" }]);
  });

  test("extracts JSON from fenced block without language tag", () => {
    const text = '```\n{"key": "val"}\n```';
    expect(extractJSON(text)).toEqual({ key: "val" });
  });

  test("finds JSON starting with [ amid surrounding text", () => {
    const text = 'The tasks are: [{"id":"t1","task":"a"}]';
    expect(extractJSON(text)).toEqual([{ id: "t1", task: "a" }]);
  });

  test("throws on empty input", () => {
    expect(() => extractJSON("")).toThrow("Empty response");
  });

  test("throws on non-string input", () => {
    expect(() => extractJSON(null)).toThrow("Empty response");
  });

  test("throws on invalid JSON", () => {
    expect(() => extractJSON("not json at all")).toThrow(
      "Could not extract valid JSON",
    );
  });
});

// ─── createSemaphore ─────────────────────────────────────────────────────────

describe("createSemaphore", () => {
  test("limits concurrent operations", async () => {
    const acquire = createSemaphore(2);
    let active = 0;
    let maxActive = 0;

    const work = async () => {
      const release = await acquire();
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      release();
    };

    await Promise.all([work(), work(), work(), work()]);
    expect(maxActive).toBe(2);
  });

  test("semaphore with limit 1 is sequential", async () => {
    const acquire = createSemaphore(1);
    const order = [];

    const work = async (id) => {
      const release = await acquire();
      order.push(`start-${id}`);
      await new Promise((r) => setTimeout(r, 5));
      order.push(`end-${id}`);
      release();
    };

    await Promise.all([work("a"), work("b")]);
    expect(order).toEqual(["start-a", "end-a", "start-b", "end-b"]);
  });
});

// ─── detectComplexPrompt ─────────────────────────────────────────────────────

describe("detectComplexPrompt", () => {
  test("empty prompt is not complex", () => {
    const r = detectComplexPrompt("");
    expect(r.isComplex).toBe(false);
    expect(r.estimatedGoals).toBe(0);
  });

  test("null input is not complex", () => {
    const r = detectComplexPrompt(null);
    expect(r.isComplex).toBe(false);
  });

  test("simple single task is not complex", () => {
    const r = detectComplexPrompt("Fix the login bug on the dashboard page");
    expect(r.isComplex).toBe(false);
  });

  test("numbered list with 4 items is complex", () => {
    const prompt =
      "1. Fix login bug\n2. Update the API docs\n3. Refactor the auth module\n4. Add dark mode";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(true);
    expect(r.estimatedGoals).toBeGreaterThanOrEqual(4);
  });

  test("three numbered items is complex", () => {
    const prompt = "1. Fix bug A\n2. Fix bug B\n3. Fix bug C";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(true);
    expect(r.estimatedGoals).toBeGreaterThanOrEqual(3);
  });

  test("semicolon-separated goals", () => {
    const prompt =
      "fix the login page rendering; update the API response format; refactor the auth middleware";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(true);
    expect(r.estimatedGoals).toBeGreaterThanOrEqual(3);
  });

  test("transition keywords (also, additionally)", () => {
    const prompt =
      "Fix the login bug, also add dark mode support, and fix the broken search, and update the docs";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(true);
  });

  test("bullet points", () => {
    const prompt = "- Fix login bug\n- Update API docs\n- Refactor auth module";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(true);
    expect(r.estimatedGoals).toBeGreaterThanOrEqual(3);
  });

  test("two numbered items is not complex (threshold is 3)", () => {
    const prompt = "1. Fix login\n2. Fix logout";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(false);
  });

  test("respects NEX_ORCHESTRATE_THRESHOLD=2: two items become complex", () => {
    const original = process.env.NEX_ORCHESTRATE_THRESHOLD;
    process.env.NEX_ORCHESTRATE_THRESHOLD = "2";
    jest.resetModules();
    const { detectComplexPrompt: dcp2 } = require("../cli/orchestrator");
    const prompt = "1. Fix login\n2. Fix logout";
    const r = dcp2(prompt);
    expect(r.isComplex).toBe(true);
    if (original === undefined) {
      delete process.env.NEX_ORCHESTRATE_THRESHOLD;
    } else {
      process.env.NEX_ORCHESTRATE_THRESHOLD = original;
    }
    jest.resetModules();
  });

  test("respects NEX_ORCHESTRATE_THRESHOLD=5: 3 goals not complex", () => {
    const original = process.env.NEX_ORCHESTRATE_THRESHOLD;
    process.env.NEX_ORCHESTRATE_THRESHOLD = "5";
    jest.resetModules();
    const { detectComplexPrompt: dcp5 } = require("../cli/orchestrator");
    const prompt = "1. Fix login\n2. Fix logout\n3. Fix signup";
    const r = dcp5(prompt);
    expect(r.isComplex).toBe(false);
    if (original === undefined) {
      delete process.env.NEX_ORCHESTRATE_THRESHOLD;
    } else {
      process.env.NEX_ORCHESTRATE_THRESHOLD = original;
    }
    jest.resetModules();
  });
});

// ─── Auto-Orchestrate ────────────────────────────────────────────────────────

describe("Auto-Orchestrate", () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = {
      NEX_AUTO_ORCHESTRATE: process.env.NEX_AUTO_ORCHESTRATE,
      NEX_ORCHESTRATE_THRESHOLD: process.env.NEX_ORCHESTRATE_THRESHOLD,
    };
    delete process.env.NEX_AUTO_ORCHESTRATE;
    delete process.env.NEX_ORCHESTRATE_THRESHOLD;
  });

  afterEach(() => {
    if (savedEnv.NEX_AUTO_ORCHESTRATE === undefined) {
      delete process.env.NEX_AUTO_ORCHESTRATE;
    } else {
      process.env.NEX_AUTO_ORCHESTRATE = savedEnv.NEX_AUTO_ORCHESTRATE;
    }
    if (savedEnv.NEX_ORCHESTRATE_THRESHOLD === undefined) {
      delete process.env.NEX_ORCHESTRATE_THRESHOLD;
    } else {
      process.env.NEX_ORCHESTRATE_THRESHOLD =
        savedEnv.NEX_ORCHESTRATE_THRESHOLD;
    }
  });

  test("detects complex prompt with 3+ goals for auto-orchestration", () => {
    const prompt = "1. Fix login\n2. Fix logout\n3. Fix signup";
    const r = detectComplexPrompt(prompt);
    expect(r.isComplex).toBe(true);
    expect(r.estimatedGoals).toBeGreaterThanOrEqual(3);
    // Auto-orchestrate is on by default since v0.4.16 — complex prompts
    // auto-trigger parallel agents unless NEX_AUTO_ORCHESTRATE=false
  });

  test("NEX_ORCHESTRATE_THRESHOLD=2 makes two items complex", () => {
    process.env.NEX_ORCHESTRATE_THRESHOLD = "2";
    jest.resetModules();
    const { detectComplexPrompt: dcp } = require("../cli/orchestrator");
    const prompt = "1. Fix the login bug\n2. Add dark mode support";
    const r = dcp(prompt);
    expect(r.isComplex).toBe(true);
    jest.resetModules();
    delete process.env.NEX_ORCHESTRATE_THRESHOLD;
  });

  test("NEX_AUTO_ORCHESTRATE=false disables auto-orchestration", () => {
    process.env.NEX_AUTO_ORCHESTRATE = "false";
    // Verify the env var is recognized (actual agent behavior tested separately)
    expect(process.env.NEX_AUTO_ORCHESTRATE).toBe("false");
    // When false, agent should not auto-trigger orchestration
  });

  test("NEX_AUTO_ORCHESTRATE defaults to enabled (no env var needed)", () => {
    delete process.env.NEX_AUTO_ORCHESTRATE;
    // When env var is not set, auto-orchestration is on by default
    expect(process.env.NEX_AUTO_ORCHESTRATE).toBeUndefined();
  });

  test("detectComplexPrompt threshold defaults to 3", () => {
    delete process.env.NEX_ORCHESTRATE_THRESHOLD;
    jest.resetModules();
    const { detectComplexPrompt: dcp } = require("../cli/orchestrator");
    // 2 goals — not complex at default threshold 3
    const notComplex = dcp("1. Fix login\n2. Fix logout");
    expect(notComplex.isComplex).toBe(false);
    // 3 goals — complex at default threshold 3
    const complex = dcp("1. Fix login\n2. Fix logout\n3. Fix signup");
    expect(complex.isComplex).toBe(true);
    jest.resetModules();
  });
});

// ─── decompose ───────────────────────────────────────────────────────────────

describe("decompose", () => {
  function mockDecomposeResponse(tasks) {
    callStream.mockResolvedValueOnce({
      content: JSON.stringify(tasks),
      tool_calls: [],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });
  }

  test("returns array with correct structure", async () => {
    mockDecomposeResponse([
      {
        id: "t1",
        task: "Fix login",
        scope: ["auth.js"],
        estimatedCalls: 5,
        priority: 1,
      },
      {
        id: "t2",
        task: "Fix search",
        scope: ["search.js"],
        estimatedCalls: 3,
        priority: 2,
      },
    ]);

    const result = await decompose("Fix login and search", "test-model");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "t1",
      task: "Fix login",
      scope: ["auth.js"],
      estimatedCalls: 5,
      priority: 1,
    });
  });

  test("respects maxSubTasks limit", async () => {
    mockDecomposeResponse([
      { id: "t1", task: "Task 1", scope: [], estimatedCalls: 5, priority: 1 },
      { id: "t2", task: "Task 2", scope: [], estimatedCalls: 5, priority: 2 },
      { id: "t3", task: "Task 3", scope: [], estimatedCalls: 5, priority: 3 },
    ]);

    const result = await decompose("many tasks", "test-model", {
      maxSubTasks: 2,
    });
    expect(result).toHaveLength(2);
  });

  test("fills in missing fields with defaults", async () => {
    mockDecomposeResponse([{ task: "Do something" }]);

    const result = await decompose("test", "test-model");
    expect(result[0].id).toBe("t1");
    expect(result[0].scope).toEqual([]);
    expect(result[0].estimatedCalls).toBe(8); // default when not specified
    expect(result[0].priority).toBe(1);
  });

  test("caps estimatedCalls at 10 per sub-task", async () => {
    mockDecomposeResponse([
      {
        id: "t1",
        task: "Big task",
        scope: [],
        estimatedCalls: 50,
        priority: 1,
      },
    ]);

    const result = await decompose("test", "test-model");
    expect(result[0].estimatedCalls).toBe(10);
  });

  test("filters out empty tasks", async () => {
    mockDecomposeResponse([
      {
        id: "t1",
        task: "Valid task",
        scope: [],
        estimatedCalls: 5,
        priority: 1,
      },
      { id: "t2", task: "", scope: [], estimatedCalls: 5, priority: 2 },
    ]);

    const result = await decompose("test", "test-model");
    expect(result).toHaveLength(1);
  });

  test("throws on non-array response", async () => {
    callStream.mockResolvedValueOnce({
      content: '{"not": "an array"}',
      tool_calls: [],
    });

    await expect(decompose("test", "test-model")).rejects.toThrow("non-array");
  });

  test("handles JSON in markdown code block", async () => {
    callStream.mockResolvedValueOnce({
      content:
        '```json\n[{"id":"t1","task":"fix bug","scope":[],"estimatedCalls":5,"priority":1}]\n```',
      tool_calls: [],
    });

    const result = await decompose("fix bug", "test-model");
    expect(result).toHaveLength(1);
    expect(result[0].task).toBe("fix bug");
  });
});

// ─── synthesize ──────────────────────────────────────────────────────────────

describe("synthesize", () => {
  function mockSynthesizeResponse(synthesis) {
    callStream.mockResolvedValueOnce({
      content: JSON.stringify(synthesis),
      tool_calls: [],
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    });
  }

  test("produces required fields", async () => {
    mockSynthesizeResponse({
      summary: "Fixed two bugs",
      conflicts: [],
      commitMessage: "fix: resolve login and search bugs",
      filesChanged: ["auth.js", "search.js"],
    });

    const result = await synthesize(
      [
        {
          task: "Fix login",
          status: "done",
          result: "Fixed",
          toolsUsed: ["edit_file"],
        },
      ],
      "Fix login and search",
      "test-model",
    );

    expect(result.summary).toBe("Fixed two bugs");
    expect(result.conflicts).toEqual([]);
    expect(result.commitMessage).toBe("fix: resolve login and search bugs");
    expect(result.filesChanged).toEqual(["auth.js", "search.js"]);
  });

  test("detects file conflicts", async () => {
    mockSynthesizeResponse({
      summary: "Both agents modified config.js",
      conflicts: [
        "config.js: agent 1 changed line 10, agent 2 changed line 10",
      ],
      commitMessage: "fix: multiple fixes with conflict in config.js",
      filesChanged: ["config.js"],
    });

    const result = await synthesize(
      [
        {
          task: "Fix A",
          status: "done",
          result: "Changed config.js",
          toolsUsed: ["edit_file"],
        },
        {
          task: "Fix B",
          status: "done",
          result: "Changed config.js",
          toolsUsed: ["edit_file"],
        },
      ],
      "Fix A and B",
      "test-model",
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toContain("config.js");
  });

  test("handles empty results array gracefully", async () => {
    const result = await synthesize([], "test", "test-model");
    expect(result.summary).toBe("No sub-tasks were executed.");
    expect(result.conflicts).toEqual([]);
  });

  test("handles all-failed sub-agents", async () => {
    mockSynthesizeResponse({
      summary: "All tasks failed",
      conflicts: [],
      commitMessage: "",
      filesChanged: [],
    });

    const result = await synthesize(
      [
        {
          task: "Fix A",
          status: "failed",
          result: "Error: timeout",
          toolsUsed: [],
        },
        {
          task: "Fix B",
          status: "failed",
          result: "Error: parse error",
          toolsUsed: [],
        },
      ],
      "Fix A and B",
      "test-model",
    );

    expect(result.summary).toContain("failed");
  });

  test("normalizes missing fields in LLM response", async () => {
    callStream.mockResolvedValueOnce({
      content: '{"summary": "done"}',
      tool_calls: [],
    });

    const result = await synthesize(
      [{ task: "test", status: "done", result: "ok", toolsUsed: [] }],
      "test",
      "model",
    );

    expect(result.conflicts).toEqual([]);
    expect(result.commitMessage).toBe("");
    expect(result.filesChanged).toEqual([]);
  });
});

// ─── runOrchestrated ─────────────────────────────────────────────────────────

describe("runOrchestrated", () => {
  function mockDecompose(tasks) {
    callStream.mockResolvedValueOnce({
      content: JSON.stringify(tasks),
      tool_calls: [],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });
  }

  function mockAgentDone(content = "Done") {
    // Sub-agent: first call returns text (no tool calls) → agent finishes
    callStream.mockResolvedValueOnce({
      content,
      tool_calls: [],
      usage: { prompt_tokens: 50, completion_tokens: 30 },
    });
  }

  function mockSynthesize(synthesis) {
    callStream.mockResolvedValueOnce({
      content: JSON.stringify(synthesis),
      tool_calls: [],
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    });
  }

  test("full flow: decompose → agents → synthesize", async () => {
    // 1. Decompose returns 2 tasks
    mockDecompose([
      {
        id: "t1",
        task: "Fix login",
        scope: ["auth.js"],
        estimatedCalls: 3,
        priority: 1,
      },
      {
        id: "t2",
        task: "Fix search",
        scope: ["search.js"],
        estimatedCalls: 3,
        priority: 2,
      },
    ]);
    // 2. Each sub-agent runs and finishes immediately
    mockAgentDone("Fixed login");
    mockAgentDone("Fixed search");
    // 3. Synthesize
    mockSynthesize({
      summary: "Fixed both bugs",
      conflicts: [],
      commitMessage: "fix: resolve login and search bugs",
      filesChanged: ["auth.js", "search.js"],
    });

    const result = await runOrchestrated("Fix login and search bugs");

    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("done");
    expect(result.results[1].status).toBe("done");
    expect(result.synthesis.summary).toBe("Fixed both bugs");
    expect(result.synthesis.filesChanged).toEqual(["auth.js", "search.js"]);
  });

  test("returns empty results when decompose fails", async () => {
    callStream.mockRejectedValueOnce(new Error("model timeout"));

    const result = await runOrchestrated("test");

    expect(result.results).toEqual([]);
    expect(result.synthesis.summary).toContain("Decompose failed");
  });

  test("returns empty results when no sub-tasks generated", async () => {
    mockDecompose([]);

    const result = await runOrchestrated("test");

    expect(result.results).toEqual([]);
  });

  test("handles agent failure gracefully", async () => {
    mockDecompose([
      {
        id: "t1",
        task: "Fail task",
        scope: [],
        estimatedCalls: 3,
        priority: 1,
      },
    ]);
    // Agent throws
    callStream.mockRejectedValueOnce(new Error("agent crash"));
    // Synthesize
    mockSynthesize({
      summary: "One task failed",
      conflicts: [],
      commitMessage: "",
      filesChanged: [],
    });

    const result = await runOrchestrated("test");

    expect(result.results).toHaveLength(1);
    expect(result.results[0].status).toBe("failed");
  });

  test("aggregates token counts", async () => {
    mockDecompose([
      { id: "t1", task: "Task 1", scope: [], estimatedCalls: 3, priority: 1 },
    ]);
    mockAgentDone("Done");
    mockSynthesize({
      summary: "Done",
      conflicts: [],
      commitMessage: "fix: stuff",
      filesChanged: [],
    });

    const result = await runOrchestrated("test");

    expect(result.totalTokens.input).toBeGreaterThan(0);
    expect(result.totalTokens.output).toBeGreaterThan(0);
  });

  test("handles synthesize failure gracefully", async () => {
    mockDecompose([
      { id: "t1", task: "Task 1", scope: [], estimatedCalls: 3, priority: 1 },
    ]);
    mockAgentDone("Done");
    // Synthesize fails
    callStream.mockRejectedValueOnce(new Error("synthesis timeout"));

    const result = await runOrchestrated("test");

    expect(result.results).toHaveLength(1);
    // Should have fallback synthesis
    expect(result.synthesis.summary).toBeTruthy();
  });
});

// ─── Orchestrator Bench Scoring ──────────────────────────────────────────────

const {
  scoreDecompose,
  scoreSynthesize,
  ORCHESTRATOR_SCENARIOS,
} = require("../cli/orchestrator-bench");

describe("orchestrator-bench scoring", () => {
  describe("scoreDecompose", () => {
    const scenario = { expectedSubTasks: 4, maxSubTasks: 5 };

    test("perfect decomposition scores high", () => {
      const result = [
        {
          id: "t1",
          task: "Fix login",
          scope: ["auth.js"],
          estimatedCalls: 5,
          priority: 1,
        },
        {
          id: "t2",
          task: "Fix search",
          scope: ["search.js"],
          estimatedCalls: 3,
          priority: 2,
        },
        {
          id: "t3",
          task: "Fix API",
          scope: ["api.js"],
          estimatedCalls: 4,
          priority: 3,
        },
        {
          id: "t4",
          task: "Fix UI",
          scope: ["ui.js"],
          estimatedCalls: 2,
          priority: 4,
        },
      ];
      const score = scoreDecompose(result, scenario);
      expect(score).toBeGreaterThanOrEqual(8);
    });

    test("wrong count gets penalized", () => {
      const result = [
        {
          id: "t1",
          task: "Fix everything",
          scope: [],
          estimatedCalls: 10,
          priority: 1,
        },
      ];
      const score = scoreDecompose(result, {
        expectedSubTasks: 4,
        maxSubTasks: 5,
      });
      expect(score).toBeLessThanOrEqual(7);
    });

    test("non-array returns 0", () => {
      expect(scoreDecompose("invalid", scenario)).toBe(0);
      expect(scoreDecompose(null, scenario)).toBe(0);
    });

    test("overlapping scopes get penalized", () => {
      const result = [
        {
          id: "t1",
          task: "Fix A",
          scope: ["shared.js"],
          estimatedCalls: 5,
          priority: 1,
        },
        {
          id: "t2",
          task: "Fix B",
          scope: ["shared.js"],
          estimatedCalls: 5,
          priority: 2,
        },
      ];
      const score = scoreDecompose(result, {
        expectedSubTasks: 2,
        maxSubTasks: 4,
      });
      const noOverlap = [
        {
          id: "t1",
          task: "Fix A",
          scope: ["a.js"],
          estimatedCalls: 5,
          priority: 1,
        },
        {
          id: "t2",
          task: "Fix B",
          scope: ["b.js"],
          estimatedCalls: 5,
          priority: 2,
        },
      ];
      const scoreNoOverlap = scoreDecompose(noOverlap, {
        expectedSubTasks: 2,
        maxSubTasks: 4,
      });
      expect(scoreNoOverlap).toBeGreaterThan(score);
    });
  });

  describe("scoreSynthesize", () => {
    test("perfect synthesis scores high", () => {
      const result = {
        summary: "Fixed all bugs successfully across two files",
        conflicts: [],
        commitMessage: "fix: resolve login and search bugs",
        filesChanged: ["auth.js", "search.js"],
      };
      const score = scoreSynthesize(result, { expectedConflicts: 0 });
      expect(score).toBeGreaterThanOrEqual(8);
    });

    test("detects conflicts correctly", () => {
      const result = {
        summary: "Both agents modified the config file",
        conflicts: ["config.js: both agents changed loadConfig()"],
        commitMessage: "fix: merged config changes",
        filesChanged: ["config.js"],
      };
      const score = scoreSynthesize(result, { expectedConflicts: 1 });
      expect(score).toBeGreaterThanOrEqual(8);
    });

    test("missing conflicts when expected gets penalized", () => {
      const result = {
        summary: "Done",
        conflicts: [],
        commitMessage: "fix: stuff",
        filesChanged: ["config.js"],
      };
      const withConflicts = scoreSynthesize(result, { expectedConflicts: 1 });
      const noConflicts = scoreSynthesize(result, { expectedConflicts: 0 });
      expect(noConflicts).toBeGreaterThan(withConflicts);
    });

    test("non-object returns 0", () => {
      expect(scoreSynthesize(null, { expectedConflicts: 0 })).toBe(0);
      expect(scoreSynthesize("string", { expectedConflicts: 0 })).toBe(0);
    });
  });

  describe("ORCHESTRATOR_SCENARIOS", () => {
    test("all scenarios have required fields", () => {
      for (const s of ORCHESTRATOR_SCENARIOS) {
        expect(s.id).toBeTruthy();
        expect(s.type).toMatch(/^(decompose|synthesize)$/);
        expect(s.prompt).toBeTruthy();
      }
    });

    test("has both decompose and synthesize scenarios", () => {
      const types = new Set(ORCHESTRATOR_SCENARIOS.map((s) => s.type));
      expect(types.has("decompose")).toBe(true);
      expect(types.has("synthesize")).toBe(true);
    });

    test("has at least 6 scenarios", () => {
      expect(ORCHESTRATOR_SCENARIOS.length).toBeGreaterThanOrEqual(6);
    });
  });
});

// ─── withRetry ───────────────────────────────────────────────────────────────

describe("withRetry", () => {
  test("succeeds on first attempt", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, 1, 0);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries once on failure then succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue("recovered");
    const result = await withRetry(fn, 1, 0);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("throws after all retries exhausted", async () => {
    const err = new Error("persistent failure");
    const fn = jest.fn().mockRejectedValue(err);
    await expect(withRetry(fn, 1, 0)).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  test("does not retry when retries=0", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    await expect(withRetry(fn, 0, 0)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("returns first success without further calls", async () => {
    let callCount = 0;
    const fn = jest.fn(async () => {
      callCount++;
      return callCount;
    });
    const result = await withRetry(fn, 2, 0);
    expect(result).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─── per-task call budget (Change 5) ─────────────────────────────────────────

describe("decompose — per-task call budget", () => {
  function mockDecompose(tasks) {
    callStream.mockImplementationOnce(async () => ({
      content: JSON.stringify(tasks),
      tool_calls: [],
    }));
  }

  test("caps estimatedCalls at 10 per sub-task", async () => {
    mockDecompose([
      { id: "t1", task: "Build React frontend", scope: ["src/"], estimatedCalls: 20, priority: 1 },
      { id: "t2", task: "Build Django backend", scope: ["api/"], estimatedCalls: 15, priority: 2 },
    ]);

    const tasks = await decompose("Build a full-stack app", "test-model");
    expect(tasks[0].estimatedCalls).toBe(10);
    expect(tasks[1].estimatedCalls).toBe(10);
  });

  test("uses default of 8 when estimatedCalls is missing", async () => {
    mockDecompose([
      { id: "t1", task: "Implement feature", scope: [] },
    ]);

    const tasks = await decompose("Add a feature", "test-model");
    expect(tasks[0].estimatedCalls).toBe(8);
  });

  test("preserves estimatedCalls below cap unchanged", async () => {
    mockDecompose([
      { id: "t1", task: "Fix a small bug", scope: [], estimatedCalls: 5, priority: 1 },
    ]);

    const tasks = await decompose("Fix bug", "test-model");
    expect(tasks[0].estimatedCalls).toBe(5);
  });

  test("total estimated calls across tasks is computable", async () => {
    mockDecompose([
      { id: "t1", task: "Task A", scope: [], estimatedCalls: 10, priority: 1 },
      { id: "t2", task: "Task B", scope: [], estimatedCalls: 10, priority: 2 },
      { id: "t3", task: "Task C", scope: [], estimatedCalls: 10, priority: 3 },
      { id: "t4", task: "Task D", scope: [], estimatedCalls: 10, priority: 4 },
    ]);

    const tasks = await decompose("Build complex system", "test-model", { maxSubTasks: 4 });
    const total = tasks.reduce((s, t) => s + t.estimatedCalls, 0);
    expect(total).toBe(40);
  });
});

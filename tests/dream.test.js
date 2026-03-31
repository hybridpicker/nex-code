const fs = require("fs");
const path = require("path");
const os = require("os");

describe("dream.js", () => {
  let dream;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-dream-"));
    jest.resetModules();
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    dream = require("../cli/dream");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  // ─── Helper: build mock messages ──────────────────────────────

  function makeMessages(toolCallCount = 5, errorCount = 0) {
    const msgs = [
      { role: "user", content: "Fix the bug in server.js" },
    ];

    for (let i = 0; i < toolCallCount; i++) {
      msgs.push({
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: i % 2 === 0 ? "read_file" : "bash",
            input: i % 2 === 0 ? { path: "/src/server.js" } : { command: "ls" },
            id: `tool-${i}`,
          },
        ],
      });
      const isError = i < errorCount;
      msgs.push({
        role: "tool",
        name: i % 2 === 0 ? "read_file" : "bash",
        content: isError ? "Error: file not found" : "success",
        tool_use_id: `tool-${i}`,
      });
    }

    msgs.push({
      role: "assistant",
      content: "Done fixing the server.",
    });

    return msgs;
  }

  // ─── extractSessionStats ──────────────────────────────────────

  describe("extractSessionStats()", () => {
    it("returns null for empty messages", () => {
      expect(dream.extractSessionStats([])).toBeNull();
    });

    it("returns null for too few tool calls", () => {
      const msgs = [
        { role: "user", content: "hi" },
        {
          role: "assistant",
          content: [{ type: "tool_use", name: "bash", input: {}, id: "t1" }],
        },
        { role: "tool", name: "bash", content: "ok", tool_use_id: "t1" },
      ];
      expect(dream.extractSessionStats(msgs)).toBeNull();
    });

    it("extracts correct tool call counts", () => {
      const msgs = makeMessages(6);
      const stats = dream.extractSessionStats(msgs);
      expect(stats).not.toBeNull();
      expect(stats.totalToolCalls).toBe(6);
      expect(stats.toolCalls.read_file).toBe(3);
      expect(stats.toolCalls.bash).toBe(3);
    });

    it("tracks file access patterns", () => {
      const msgs = makeMessages(6);
      const stats = dream.extractSessionStats(msgs);
      expect(stats.filesAccessed["/src/server.js"]).toBeDefined();
    });

    it("counts errors correctly", () => {
      const msgs = makeMessages(6, 3);
      const stats = dream.extractSessionStats(msgs);
      expect(stats.totalErrors).toBe(3);
    });

    it("counts user and assistant messages", () => {
      const msgs = makeMessages(4);
      const stats = dream.extractSessionStats(msgs);
      expect(stats.userMessages).toBe(1);
      expect(stats.assistantMessages).toBe(5); // 4 tool + 1 final
    });

    it("handles OpenAI-style tool_calls", () => {
      const msgs = [
        { role: "user", content: "help" },
      ];
      for (let i = 0; i < 4; i++) {
        msgs.push({
          role: "assistant",
          tool_calls: [{ function: { name: "bash" }, id: `tc-${i}` }],
        });
        msgs.push({ role: "tool", name: "bash", content: "ok", tool_use_id: `tc-${i}` });
      }
      const stats = dream.extractSessionStats(msgs);
      expect(stats.totalToolCalls).toBe(4);
      expect(stats.toolCalls.bash).toBe(4);
    });

    it("includes timestamp", () => {
      const msgs = makeMessages(4);
      const stats = dream.extractSessionStats(msgs);
      expect(stats.timestamp).toBeDefined();
      expect(() => new Date(stats.timestamp)).not.toThrow();
    });
  });

  // ─── writeDreamLog ────────────────────────────────────────────

  describe("writeDreamLog()", () => {
    it("writes a log file and returns its path", () => {
      const msgs = makeMessages(6);
      const logPath = dream.writeDreamLog(msgs);
      expect(logPath).not.toBeNull();
      expect(fs.existsSync(logPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      expect(data.totalToolCalls).toBe(6);
    });

    it("returns null for empty messages", () => {
      expect(dream.writeDreamLog([])).toBeNull();
    });

    it("creates dream-logs directory", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      expect(fs.existsSync(dreamDir)).toBe(false);
      dream.writeDreamLog(makeMessages(6));
      expect(fs.existsSync(dreamDir)).toBe(true);
    });

    it("prunes logs beyond MAX_DREAM_LOGS", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      fs.mkdirSync(dreamDir, { recursive: true });

      // Pre-create 25 logs
      for (let i = 0; i < 25; i++) {
        fs.writeFileSync(
          path.join(dreamDir, `dream-${1000 + i}.json`),
          "{}",
        );
      }

      dream.writeDreamLog(makeMessages(6));

      const remaining = fs.readdirSync(dreamDir).filter(
        (f) => f.startsWith("dream-") && f.endsWith(".json"),
      );
      expect(remaining.length).toBeLessThanOrEqual(20);
    });
  });

  // ─── shouldConsolidate ────────────────────────────────────────

  describe("shouldConsolidate()", () => {
    it("returns true when no meta exists", () => {
      expect(dream.shouldConsolidate()).toBe(true);
    });

    it("returns false within cooldown period", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      fs.mkdirSync(dreamDir, { recursive: true });
      dream._writeMeta({
        lastConsolidation: new Date().toISOString(),
        processed: [],
      });
      expect(dream.shouldConsolidate()).toBe(false);
    });

    it("returns false when too few unprocessed logs", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      fs.mkdirSync(dreamDir, { recursive: true });

      // Old consolidation (beyond cooldown)
      dream._writeMeta({
        lastConsolidation: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        processed: [],
      });

      // Only 1 log
      fs.writeFileSync(path.join(dreamDir, "dream-1.json"), "{}");
      expect(dream.shouldConsolidate()).toBe(false);
    });
  });

  // ─── consolidate ──────────────────────────────────────────────

  describe("consolidate()", () => {
    it("returns empty when too few logs", () => {
      const result = dream.consolidate();
      expect(result.insights).toEqual([]);
      expect(result.memoriesWritten).toBe(0);
    });

    it("detects error-prone tools across sessions", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      fs.mkdirSync(dreamDir, { recursive: true });

      // Create 3 session logs with high ssh_exec errors
      for (let i = 0; i < 3; i++) {
        const log = {
          timestamp: new Date().toISOString(),
          userMessages: 2,
          assistantMessages: 5,
          totalToolCalls: 10,
          totalErrors: 5,
          toolCalls: { ssh_exec: 8, read_file: 2 },
          toolErrors: { ssh_exec: 5 },
          filesAccessed: {},
          filesModified: {},
        };
        fs.writeFileSync(
          path.join(dreamDir, `dream-${1000 + i}.json`),
          JSON.stringify(log),
        );
      }

      const result = dream.consolidate();
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.insights[0]).toContain("ssh_exec");
    });

    it("marks logs as processed after consolidation", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      fs.mkdirSync(dreamDir, { recursive: true });

      for (let i = 0; i < 3; i++) {
        fs.writeFileSync(
          path.join(dreamDir, `dream-${2000 + i}.json`),
          JSON.stringify({
            timestamp: new Date().toISOString(),
            userMessages: 1,
            assistantMessages: 3,
            totalToolCalls: 5,
            totalErrors: 0,
            toolCalls: { bash: 5 },
            toolErrors: {},
            filesAccessed: {},
            filesModified: {},
          }),
        );
      }

      dream.consolidate();

      const meta = dream._readMeta();
      expect(meta.processed).toBeDefined();
      expect(meta.processed.length).toBe(3);
      expect(meta.totalConsolidations).toBe(1);
    });

    it("detects hot files across sessions", () => {
      const dreamDir = path.join(tmpDir, ".nex", "dream-logs");
      fs.mkdirSync(dreamDir, { recursive: true });

      for (let i = 0; i < 4; i++) {
        fs.writeFileSync(
          path.join(dreamDir, `dream-${3000 + i}.json`),
          JSON.stringify({
            timestamp: new Date().toISOString(),
            userMessages: 1,
            assistantMessages: 5,
            totalToolCalls: 8,
            totalErrors: 0,
            toolCalls: { read_file: 6, bash: 2 },
            toolErrors: {},
            filesAccessed: { "/src/main.js": 3 },
            filesModified: {},
          }),
        );
      }

      const result = dream.consolidate();
      // /src/main.js accessed in 4/4 sessions with 12 total reads
      const hotFileInsight = result.insights.find((i) => i.includes("main.js"));
      expect(hotFileInsight).toBeDefined();
    });
  });
});

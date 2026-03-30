const fs = require("fs");
const path = require("path");
const os = require("os");

describe("autoresearch skill", () => {
  let skill;
  let tmpDir;
  let origCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-autoresearch-"));
    origCwd = process.cwd;
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir);

    // Fresh require to reset module state
    jest.resetModules();
    skill = require("../cli/skills/autoresearch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  describe("module exports", () => {
    it("exports required skill fields", () => {
      expect(skill.name).toBe("autoresearch");
      expect(skill.description).toBeDefined();
      expect(skill.instructions).toBeDefined();
    });

    it("exports commands", () => {
      expect(skill.commands).toHaveLength(3);
      const cmds = skill.commands.map((c) => c.cmd);
      expect(cmds).toContain("/autoresearch");
      expect(cmds).toContain("/ar-status");
      expect(cmds).toContain("/ar-clear");
    });

    it("exports tools", () => {
      expect(skill.tools).toHaveLength(5);
      const toolNames = skill.tools.map((t) => t.function.name);
      expect(toolNames).toContain("ar_checkpoint");
      expect(toolNames).toContain("ar_run_experiment");
      expect(toolNames).toContain("ar_log_experiment");
      expect(toolNames).toContain("ar_revert");
      expect(toolNames).toContain("ar_history");
    });

    it("all tools have execute functions", () => {
      for (const tool of skill.tools) {
        expect(typeof tool.execute).toBe("function");
      }
    });

    it("all tools have parameter schemas", () => {
      for (const tool of skill.tools) {
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe("object");
      }
    });
  });

  describe("/autoresearch command", () => {
    it("shows usage when called without args", () => {
      const spy = jest.spyOn(console, "log").mockImplementation();
      const handler = skill.commands.find((c) => c.cmd === "/autoresearch").handler;
      handler("");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Usage"));
      spy.mockRestore();
    });

    it("returns goal context when called with args", () => {
      const handler = skill.commands.find((c) => c.cmd === "/autoresearch").handler;
      const result = handler("reduce test runtime");
      expect(result).toContain("AUTORESEARCH_GOAL");
      expect(result).toContain("reduce test runtime");
    });
  });

  describe("/ar-status command", () => {
    it("shows empty message when no experiments", () => {
      const spy = jest.spyOn(console, "log").mockImplementation();
      const handler = skill.commands.find((c) => c.cmd === "/ar-status").handler;
      handler();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("No experiments"),
      );
      spy.mockRestore();
    });
  });

  describe("/ar-clear command", () => {
    it("clears experiment history", () => {
      const spy = jest.spyOn(console, "log").mockImplementation();
      const handler = skill.commands.find((c) => c.cmd === "/ar-clear").handler;
      handler();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("cleared"),
      );
      spy.mockRestore();
    });
  });

  describe("ar_log_experiment tool", () => {
    it("logs an experiment and creates file", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );

      const result = JSON.parse(
        await logTool.execute({
          description: "Replace forEach with for-of",
          metric: 2.5,
          metric_name: "runtime_seconds",
          kept: true,
          notes: "Faster iteration",
        }),
      );

      expect(result.status).toBe("logged");
      expect(result.experiment_number).toBe(1);
      expect(result.total_experiments).toBe(1);
      expect(result.kept_count).toBe(1);

      // Verify file was created
      const logPath = path.join(
        tmpDir,
        ".nex",
        "autoresearch",
        "experiments.json",
      );
      expect(fs.existsSync(logPath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      expect(data).toHaveLength(1);
      expect(data[0].description).toBe("Replace forEach with for-of");
    });

    it("tracks multiple experiments", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );

      await logTool.execute({
        description: "Experiment 1",
        metric: 3.0,
        kept: true,
      });

      const result = JSON.parse(
        await logTool.execute({
          description: "Experiment 2",
          metric: 2.5,
          kept: false,
        }),
      );

      expect(result.total_experiments).toBe(2);
      expect(result.kept_count).toBe(1);
      expect(result.reverted_count).toBe(1);
      expect(result.trend).toContain("3");
      expect(result.trend).toContain("2.5");
    });
  });

  describe("ar_history tool", () => {
    it("returns empty history", async () => {
      const historyTool = skill.tools.find(
        (t) => t.function.name === "ar_history",
      );
      const result = JSON.parse(await historyTool.execute({}));
      expect(result.total).toBe(0);
      expect(result.experiments).toEqual([]);
    });

    it("returns experiment summary", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );
      const historyTool = skill.tools.find(
        (t) => t.function.name === "ar_history",
      );

      await logTool.execute({ description: "test1", metric: 5.0, kept: true });
      await logTool.execute({ description: "test2", metric: 3.0, kept: false });
      await logTool.execute({ description: "test3", metric: 2.0, kept: true });

      const result = JSON.parse(await historyTool.execute({}));
      expect(result.total).toBe(3);
      expect(result.kept).toBe(2);
      expect(result.reverted).toBe(1);
      expect(result.best_metric).toBe(2.0);
      expect(result.worst_metric).toBe(5.0);
    });
  });

  describe("ar_run_experiment tool", () => {
    it("runs a command and returns result", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const result = JSON.parse(
        await runTool.execute({ command: "echo hello" }),
      );
      expect(result.status).toBe("success");
      expect(result.exit_code).toBe(0);
      expect(result.stdout).toContain("hello");
      expect(result.elapsed_seconds).toBeDefined();
    });

    it("handles command failure", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const result = JSON.parse(
        await runTool.execute({ command: "exit 1" }),
      );
      expect(result.status).toBe("failure");
      expect(result.exit_code).toBe(1);
    });

    it("handles timeout", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const result = JSON.parse(
        await runTool.execute({
          command: "sleep 10",
          timeout_seconds: 1,
        }),
      );
      // execSync may report killed or failure depending on platform
      expect(["timeout", "failure"]).toContain(result.status);
      expect(result.exit_code).not.toBe(0);
    });
  });

  describe("ar_checkpoint tool", () => {
    it("handles non-git directory gracefully", async () => {
      const cpTool = skill.tools.find(
        (t) => t.function.name === "ar_checkpoint",
      );
      const result = JSON.parse(
        await cpTool.execute({ message: "test checkpoint" }),
      );
      // Should skip gracefully since tmpDir is not a git repo
      expect(result.status).toBe("checkpoint_skipped");
      expect(result.note).toContain("Proceeding anyway");
    });
  });

  describe("ar_revert tool", () => {
    it("handles non-git directory gracefully", async () => {
      const revertTool = skill.tools.find(
        (t) => t.function.name === "ar_revert",
      );
      const result = JSON.parse(
        await revertTool.execute({ reason: "metric worsened" }),
      );
      expect(result.status).toBe("revert_failed");
      expect(result.error).toBeDefined();
    });
  });
});

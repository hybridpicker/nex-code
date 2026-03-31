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
      expect(skill.commands).toHaveLength(5);
      const cmds = skill.commands.map((c) => c.cmd);
      expect(cmds).toContain("/autoresearch");
      expect(cmds).toContain("/ar-self-improve");
      expect(cmds).toContain("/ar-status");
      expect(cmds).toContain("/ar-clear");
    });

    it("exports tools", () => {
      expect(skill.tools.length).toBeGreaterThanOrEqual(8);
      const toolNames = skill.tools.map((t) => t.function.name);
      expect(toolNames).toContain("ar_setup_branch");
      expect(toolNames).toContain("ar_checkpoint");
      expect(toolNames).toContain("ar_run_experiment");
      expect(toolNames).toContain("ar_extract_metric");
      expect(toolNames).toContain("ar_run_benchmark");
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

  describe("instructions", () => {
    it("includes simplicity criterion", () => {
      expect(skill.instructions).toContain("Simplicity Criterion");
      expect(skill.instructions).toContain("complexity cost");
    });

    it("includes crash triage guidance", () => {
      expect(skill.instructions).toContain("Crash Triage");
      expect(skill.instructions).toContain("Trivial bug");
      expect(skill.instructions).toContain("Fundamentally broken");
    });

    it("includes never-stop directive", () => {
      expect(skill.instructions).toContain("NEVER STOP");
    });

    it("includes output efficiency guidance", () => {
      expect(skill.instructions).toContain("Output Efficiency");
      expect(skill.instructions).toContain("output_file");
    });

    it("includes dedicated branch setup step", () => {
      expect(skill.instructions).toContain("ar_setup_branch");
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

    it("mentions indefinite running in the prompt", () => {
      const handler = skill.commands.find((c) => c.cmd === "/autoresearch").handler;
      const result = handler("optimize perf");
      expect(result).toContain("indefinitely");
    });

    it("mentions branch setup in the prompt", () => {
      const handler = skill.commands.find((c) => c.cmd === "/autoresearch").handler;
      const result = handler("optimize perf");
      expect(result).toContain("ar_setup_branch");
    });
  });

  describe("/ar-self-improve command", () => {
    it("returns self-improvement protocol", () => {
      const handler = skill.commands.find(
        (c) => c.cmd === "/ar-self-improve",
      ).handler;
      const result = handler("");
      expect(result).toContain("AUTORESEARCH_GOAL");
      expect(result).toContain("Self-Improvement Protocol");
      expect(result).toContain("ar_run_benchmark");
      expect(result).toContain("benchmark score");
    });

    it("includes guard rails against modifying benchmark", () => {
      const handler = skill.commands.find(
        (c) => c.cmd === "/ar-self-improve",
      ).handler;
      const result = handler("");
      expect(result).toContain("CANNOT modify");
      expect(result).toContain("cli/benchmark.js");
    });

    it("includes simplicity criterion", () => {
      const handler = skill.commands.find(
        (c) => c.cmd === "/ar-self-improve",
      ).handler;
      const result = handler("");
      expect(result).toContain("Simplicity criterion");
    });

    it("accepts optional focus area", () => {
      const handler = skill.commands.find(
        (c) => c.cmd === "/ar-self-improve",
      ).handler;
      const result = handler("sysadmin category");
      expect(result).toContain("sysadmin category");
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

    it("shows crash count in status", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );
      await logTool.execute({
        description: "OOM experiment",
        metric: 0,
        kept: false,
        status: "crash",
      });

      const spy = jest.spyOn(console, "log").mockImplementation();
      const handler = skill.commands.find((c) => c.cmd === "/ar-status").handler;
      handler();
      const output = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(output).toContain("CRASH");
      expect(output).toContain("Crashes: 1");
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

  describe("ar_setup_branch tool", () => {
    it("handles non-git directory gracefully", async () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_setup_branch",
      );
      const result = JSON.parse(await tool.execute({ tag: "test-run" }));
      expect(result.status).toBe("branch_failed");
      expect(result.note).toContain("Continuing on current branch");
    });

    it("sanitizes branch tag", async () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_setup_branch",
      );
      // Should not throw even with special characters
      const result = JSON.parse(await tool.execute({ tag: "foo bar!@#" }));
      // Will fail because no git, but the tag should be sanitized
      expect(result.status).toBe("branch_failed");
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

    it("tracks crash status", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );

      const result = JSON.parse(
        await logTool.execute({
          description: "OOM on large batch",
          metric: 0,
          kept: false,
          status: "crash",
          notes: "Out of memory — idea fundamentally broken",
        }),
      );

      expect(result.crash_count).toBe(1);
    });

    it("records memory and complexity fields", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );

      await logTool.execute({
        description: "Simplify parser",
        metric: 2.0,
        kept: true,
        peak_memory_mb: 512.5,
        complexity_impact: "simpler",
      });

      const logPath = path.join(
        tmpDir,
        ".nex",
        "autoresearch",
        "experiments.json",
      );
      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      expect(data[0].peak_memory_mb).toBe(512.5);
      expect(data[0].complexity_impact).toBe("simpler");
    });

    it("records git commit hash", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );

      await logTool.execute({
        description: "Test commit tracking",
        metric: 1.0,
        kept: true,
      });

      const logPath = path.join(
        tmpDir,
        ".nex",
        "autoresearch",
        "experiments.json",
      );
      const data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
      // commit will be null in tmpDir (not a git repo), but field must exist
      expect(data[0]).toHaveProperty("commit");
    });
  });

  describe("ar_extract_metric tool", () => {
    it("extracts metrics from a log file", async () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_extract_metric",
      );

      // Create a fake log file
      const logContent = [
        "Training started...",
        "epoch 1: loss=2.345",
        "epoch 2: loss=1.890",
        "---",
        "val_bpb:          0.997900",
        "peak_vram_mb:     45060.2",
        "training_seconds: 300.1",
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, "run.log"), logContent);

      const result = JSON.parse(
        await tool.execute({
          file: "run.log",
          patterns: {
            val_bpb: "val_bpb:\\s*([\\d.]+)",
            training_time: "training_seconds:\\s*([\\d.]+)",
          },
        }),
      );

      expect(result.status).toBe("extracted");
      expect(result.metrics.val_bpb).toBeCloseTo(0.9979);
      expect(result.metrics.training_time).toBeCloseTo(300.1);
      expect(result.resources.peak_memory_mb).toBeCloseTo(45060.2);
    });

    it("handles missing file", async () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_extract_metric",
      );

      const result = JSON.parse(
        await tool.execute({
          file: "nonexistent.log",
          patterns: { metric: "value:\\s*([\\d.]+)" },
        }),
      );

      expect(result.status).toBe("file_not_found");
    });

    it("respects tail_lines parameter", async () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_extract_metric",
      );

      const lines = [];
      for (let i = 0; i < 200; i++) lines.push(`line ${i}`);
      lines.push("val_bpb: 0.5");
      fs.writeFileSync(path.join(tmpDir, "big.log"), lines.join("\n"));

      const result = JSON.parse(
        await tool.execute({
          file: "big.log",
          patterns: { val_bpb: "val_bpb:\\s*([\\d.]+)" },
          tail_lines: 10,
        }),
      );

      expect(result.status).toBe("extracted");
      expect(result.metrics.val_bpb).toBeCloseTo(0.5);
      expect(result.lines_read).toBe(10);
    });

    it("reads full file when tail_lines is 0", async () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_extract_metric",
      );

      fs.writeFileSync(path.join(tmpDir, "small.log"), "val_bpb: 1.23\n");

      const result = JSON.parse(
        await tool.execute({
          file: "small.log",
          patterns: { val_bpb: "val_bpb:\\s*([\\d.]+)" },
          tail_lines: 0,
        }),
      );

      expect(result.status).toBe("extracted");
      expect(result.metrics.val_bpb).toBeCloseTo(1.23);
    });
  });

  describe("ar_run_benchmark tool", () => {
    it("has correct tool schema", () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_run_benchmark",
      );
      expect(tool).toBeDefined();
      expect(tool.function.description).toContain("benchmark");
      expect(tool.function.parameters.properties.quick).toBeDefined();
      expect(tool.function.parameters.properties.models).toBeDefined();
    });

    it("defaults to quick mode", () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_run_benchmark",
      );
      expect(tool.function.parameters.properties.quick.description).toContain(
        "Default: true",
      );
    });

    it("has an execute function", () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_run_benchmark",
      );
      expect(typeof tool.execute).toBe("function");
    });

    it("describes per-category scores and weakest category", () => {
      const tool = skill.tools.find(
        (t) => t.function.name === "ar_run_benchmark",
      );
      expect(tool.function.description).toContain("category");
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

    it("returns experiment summary with crash count", async () => {
      const logTool = skill.tools.find(
        (t) => t.function.name === "ar_log_experiment",
      );
      const historyTool = skill.tools.find(
        (t) => t.function.name === "ar_history",
      );

      await logTool.execute({ description: "test1", metric: 5.0, kept: true });
      await logTool.execute({ description: "test2", metric: 3.0, kept: false });
      await logTool.execute({
        description: "test3",
        metric: 0,
        kept: false,
        status: "crash",
      });
      await logTool.execute({ description: "test4", metric: 2.0, kept: true });

      const result = JSON.parse(await historyTool.execute({}));
      expect(result.total).toBe(4);
      expect(result.kept).toBe(2);
      expect(result.reverted).toBe(2);
      expect(result.crashes).toBe(1);
      // best/worst should exclude crashes
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
      expect(result).toHaveProperty("resources");
      expect(result).toHaveProperty("extracted_metric");
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
      expect(["timeout", "failure"]).toContain(result.status);
      expect(result.exit_code).not.toBe(0);
    });

    it("supports output_file redirection", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const result = JSON.parse(
        await runTool.execute({
          command: 'echo "val_bpb: 0.995"',
          output_file: "test-run.log",
        }),
      );
      expect(result.status).toBe("success");
      expect(result.stdout).toContain("redirected");
      // Verify the file was created
      expect(
        fs.existsSync(path.join(tmpDir, "test-run.log")),
      ).toBe(true);
    });

    it("extracts metric when pattern provided", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const result = JSON.parse(
        await runTool.execute({
          command: 'echo "val_bpb: 0.995"',
          output_file: "test-metric.log",
          metric_pattern: "val_bpb:\\s*([\\d.]+)",
        }),
      );
      expect(result.status).toBe("success");
      expect(result.extracted_metric).toBeCloseTo(0.995);
    });

    it("defaults to 300s timeout", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const params = runTool.function.parameters;
      expect(params.properties.timeout_seconds.description).toContain("300");
    });

    it("parses resource usage from output", async () => {
      const runTool = skill.tools.find(
        (t) => t.function.name === "ar_run_experiment",
      );
      const result = JSON.parse(
        await runTool.execute({
          command: 'echo "peak_vram_mb: 1234.5"',
          output_file: "res-test.log",
        }),
      );
      expect(result.resources.peak_memory_mb).toBeCloseTo(1234.5);
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

    it("mentions git reset in description", () => {
      const revertTool = skill.tools.find(
        (t) => t.function.name === "ar_revert",
      );
      expect(revertTool.function.description).toContain("git reset");
    });
  });

  // ─── Watch Mode ─────────────────────────────────────────────
  describe("ar-watch command", () => {
    it("registers ar-watch command", () => {
      const watchCmd = skill.commands.find((c) => c.cmd === "/ar-watch");
      expect(watchCmd).toBeDefined();
      expect(watchCmd.desc).toContain("watcher");
    });

    it("rejects when feature flag is disabled", () => {
      // Default: WATCH_MODE is disabled
      const watchCmd = skill.commands.find((c) => c.cmd === "/ar-watch");
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      watchCmd.handler("npm test");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("disabled"),
      );
      consoleSpy.mockRestore();
    });

    it("starts when feature flag is enabled via env", () => {
      process.env.NEX_FEATURE_WATCH_MODE = "1";
      jest.resetModules();
      const skill2 = require("../cli/skills/autoresearch");
      const watchCmd = skill2.commands.find((c) => c.cmd === "/ar-watch");
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      watchCmd.handler("echo test");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Watch mode started"),
      );
      consoleSpy.mockRestore();
      // Clean up
      watchCmd.handler("stop");
      delete process.env.NEX_FEATURE_WATCH_MODE;
    });

    it("stops cleanly", () => {
      process.env.NEX_FEATURE_WATCH_MODE = "1";
      jest.resetModules();
      const skill2 = require("../cli/skills/autoresearch");
      const watchCmd = skill2.commands.find((c) => c.cmd === "/ar-watch");
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      watchCmd.handler("echo test");
      watchCmd.handler("stop");
      expect(consoleSpy).toHaveBeenCalledWith("Watch mode stopped.");
      consoleSpy.mockRestore();
      delete process.env.NEX_FEATURE_WATCH_MODE;
    });
  });

  describe("ar_watch_status tool", () => {
    it("reports inactive when not watching", async () => {
      const statusTool = skill.tools.find(
        (t) => t.function.name === "ar_watch_status",
      );
      expect(statusTool).toBeDefined();
      const result = JSON.parse(await statusTool.execute());
      expect(result.active).toBe(false);
      expect(result.testCommand).toBeNull();
    });
  });
});

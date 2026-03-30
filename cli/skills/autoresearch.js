/**
 * cli/skills/autoresearch.js — Autoresearch Skill
 * Autonomous optimization loops: edit -> test -> log -> keep/revert
 * Inspired by Karpathy's autoresearch pattern and Pi's pi-autoresearch extension.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Track experiment history within the session
let experiments = [];
let loopActive = false;

function getLogPath() {
  const dir = path.join(process.cwd(), ".nex", "autoresearch");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "experiments.json");
}

function loadExperiments() {
  const logPath = getLogPath();
  if (fs.existsSync(logPath)) {
    try {
      experiments = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    } catch {
      experiments = [];
    }
  }
  return experiments;
}

function saveExperiments() {
  const logPath = getLogPath();
  fs.writeFileSync(logPath, JSON.stringify(experiments, null, 2));
}

module.exports = {
  name: "autoresearch",
  description:
    "Autonomous optimization loops: edit -> test -> log -> keep/revert. " +
    "Run experiments, track results, and automatically keep improvements or revert failures.",

  instructions: `You have access to autoresearch tools for running autonomous optimization loops.

## Workflow

When the user starts an autoresearch loop with /autoresearch <goal>, follow this cycle:

1. **Analyze** the current state (read code, run baseline test)
2. **Hypothesize** a specific change that could improve the target metric
3. **Commit checkpoint** using skill_ar_checkpoint before making changes
4. **Edit** the code to implement your hypothesis
5. **Run experiment** using skill_ar_run_experiment with the test command
6. **Log result** using skill_ar_log_experiment with the outcome
7. **Decide**: If improved, keep changes. If worse, revert using skill_ar_revert
8. **Repeat** from step 2 until the goal is met or no more improvements found

## Rules
- Always create a checkpoint before making changes
- Always run the experiment after editing
- Always log the result (even failures)
- Revert immediately if the metric worsens
- Stop after 10 iterations or when the user interrupts
- Show a summary table after each iteration`,

  commands: [
    {
      cmd: "/autoresearch",
      desc: "Start an autonomous optimization loop: /autoresearch <goal>",
      handler: (args) => {
        const goal = args.trim();
        if (!goal) {
          console.log("Usage: /autoresearch <optimization goal>");
          console.log(
            'Example: /autoresearch "reduce test runtime while maintaining correctness"',
          );
          console.log(
            'Example: /autoresearch "optimize bundle size under 500kb"',
          );
          return;
        }
        loopActive = true;
        loadExperiments();
        console.log(`Autoresearch started: ${goal}`);
        console.log(
          "The agent will now run autonomous optimization loops for this goal.",
        );
        console.log("Press Ctrl+C to stop the loop at any time.\n");
        // Return the goal as context for the agent to pick up
        return `AUTORESEARCH_GOAL: ${goal}\n\nStart the autoresearch loop. First, analyze the current state and establish a baseline metric. Then begin the edit->test->log->keep/revert cycle.`;
      },
    },
    {
      cmd: "/ar-status",
      desc: "Show autoresearch experiment history",
      handler: () => {
        const exps = loadExperiments();
        if (exps.length === 0) {
          console.log("No experiments recorded yet.");
          return;
        }
        console.log(`\nExperiment History (${exps.length} total):\n`);
        console.log(
          "  #  | Status  | Metric        | Description",
        );
        console.log(
          "  ---|---------|---------------|----------------------------------",
        );
        for (let i = 0; i < exps.length; i++) {
          const e = exps[i];
          const status = e.kept ? "KEPT   " : "REVERTED";
          const metric =
            e.metric != null ? String(e.metric).padEnd(13) : "N/A          ";
          const desc = (e.description || "").substring(0, 34);
          console.log(
            `  ${String(i + 1).padStart(2)} | ${status} | ${metric} | ${desc}`,
          );
        }
        // Show trend
        const kept = exps.filter((e) => e.kept);
        if (kept.length >= 2) {
          const first = kept[0].metric;
          const last = kept[kept.length - 1].metric;
          if (first != null && last != null) {
            const diff = last - first;
            const arrow = diff > 0 ? "+" : "";
            console.log(
              `\n  Trend: ${first} -> ${last} (${arrow}${diff.toFixed(2)})`,
            );
          }
        }
        console.log();
      },
    },
    {
      cmd: "/ar-clear",
      desc: "Clear autoresearch experiment history",
      handler: () => {
        experiments = [];
        saveExperiments();
        loopActive = false;
        console.log("Autoresearch history cleared.");
      },
    },
  ],

  tools: [
    {
      type: "function",
      function: {
        name: "ar_checkpoint",
        description:
          "Create a git checkpoint before making experimental changes. " +
          "This allows reverting if the experiment fails. " +
          "Call this BEFORE editing any files in an autoresearch loop.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description:
                "Short description of what you are about to try (e.g. 'replace forEach with for-of loop')",
            },
          },
          required: ["message"],
        },
      },
      execute: async (args) => {
        try {
          // Stage all current changes and create a checkpoint commit
          execSync("git add -A", { cwd: process.cwd(), stdio: "pipe" });
          const hasChanges = execSync("git diff --cached --stat", {
            cwd: process.cwd(),
            encoding: "utf-8",
          }).trim();

          if (hasChanges) {
            execSync(
              `git commit -m "autoresearch: checkpoint before: ${(args.message || "experiment").replace(/"/g, '\\"')}"`,
              { cwd: process.cwd(), stdio: "pipe" },
            );
          }

          const hash = execSync("git rev-parse --short HEAD", {
            cwd: process.cwd(),
            encoding: "utf-8",
          }).trim();

          return JSON.stringify({
            status: "checkpoint_created",
            commit: hash,
            message: args.message,
          });
        } catch (err) {
          return JSON.stringify({
            status: "checkpoint_skipped",
            reason: err.message,
            note: "Working tree may be clean or git unavailable. Proceeding anyway.",
          });
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_run_experiment",
        description:
          "Run a test/benchmark command to measure the effect of changes. " +
          "Returns stdout, stderr, exit code, and execution time. " +
          "Call this AFTER making changes to measure their impact.",
        parameters: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description:
                'The shell command to run (e.g. "npm test", "time npm run build", "node bench.js")',
            },
            timeout_seconds: {
              type: "number",
              description:
                "Max seconds to wait (default: 120). Kill the process if exceeded.",
            },
          },
          required: ["command"],
        },
      },
      execute: async (args) => {
        const timeout = (args.timeout_seconds || 120) * 1000;
        const start = Date.now();

        try {
          const output = execSync(args.command, {
            cwd: process.cwd(),
            encoding: "utf-8",
            timeout,
            maxBuffer: 1024 * 1024, // 1MB
            stdio: ["pipe", "pipe", "pipe"],
          });

          const elapsed = ((Date.now() - start) / 1000).toFixed(2);
          return JSON.stringify({
            status: "success",
            exit_code: 0,
            elapsed_seconds: parseFloat(elapsed),
            stdout: output.substring(0, 4000),
            stderr: "",
          });
        } catch (err) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(2);
          return JSON.stringify({
            status: err.killed ? "timeout" : "failure",
            exit_code: err.status || 1,
            elapsed_seconds: parseFloat(elapsed),
            stdout: (err.stdout || "").substring(0, 4000),
            stderr: (err.stderr || "").substring(0, 2000),
          });
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_log_experiment",
        description:
          "Log the result of an experiment. Call this after running the experiment " +
          "to record whether the change was an improvement. This builds the experiment history.",
        parameters: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description:
                "What was changed (e.g. 'replaced Array.map with for loop in parser')",
            },
            metric: {
              type: "number",
              description:
                "The measured metric value (e.g. test runtime in seconds, bundle size in KB, score)",
            },
            metric_name: {
              type: "string",
              description:
                'Name of the metric (e.g. "runtime_seconds", "bundle_size_kb", "test_pass_rate")',
            },
            kept: {
              type: "boolean",
              description:
                "Whether you decided to keep (true) or revert (false) this change",
            },
            notes: {
              type: "string",
              description: "Any additional observations about this experiment",
            },
          },
          required: ["description", "metric", "kept"],
        },
      },
      execute: async (args) => {
        loadExperiments();
        const entry = {
          id: experiments.length + 1,
          timestamp: new Date().toISOString(),
          description: args.description,
          metric: args.metric,
          metric_name: args.metric_name || "metric",
          kept: args.kept,
          notes: args.notes || "",
        };
        experiments.push(entry);
        saveExperiments();

        const trend =
          experiments.length >= 2
            ? `Previous: ${experiments[experiments.length - 2].metric}, Current: ${args.metric}`
            : "First experiment — baseline established";

        return JSON.stringify({
          status: "logged",
          experiment_number: entry.id,
          total_experiments: experiments.length,
          kept_count: experiments.filter((e) => e.kept).length,
          reverted_count: experiments.filter((e) => !e.kept).length,
          trend,
        });
      },
    },
    {
      type: "function",
      function: {
        name: "ar_revert",
        description:
          "Revert all changes since the last checkpoint. " +
          "Use this when an experiment made things worse. " +
          "Restores the working tree to the last git commit state.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description:
                "Why reverting (e.g. 'metric worsened from 2.3s to 4.1s')",
            },
          },
          required: ["reason"],
        },
      },
      execute: async (args) => {
        try {
          // Reset to last commit (the checkpoint)
          execSync("git checkout -- .", {
            cwd: process.cwd(),
            stdio: "pipe",
          });
          // Clean untracked files created during the experiment
          execSync("git clean -fd", {
            cwd: process.cwd(),
            stdio: "pipe",
          });

          const hash = execSync("git rev-parse --short HEAD", {
            cwd: process.cwd(),
            encoding: "utf-8",
          }).trim();

          return JSON.stringify({
            status: "reverted",
            reverted_to: hash,
            reason: args.reason,
          });
        } catch (err) {
          return JSON.stringify({
            status: "revert_failed",
            error: err.message,
            note: "Manual cleanup may be needed. Check git status.",
          });
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_history",
        description:
          "Get the full experiment history as JSON for analysis. " +
          "Use this to review past experiments and identify patterns.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      execute: async () => {
        loadExperiments();
        const kept = experiments.filter((e) => e.kept);
        const reverted = experiments.filter((e) => !e.kept);

        let bestMetric = null;
        let worstMetric = null;
        for (const e of experiments) {
          if (e.metric != null) {
            if (bestMetric === null || e.metric < bestMetric)
              bestMetric = e.metric;
            if (worstMetric === null || e.metric > worstMetric)
              worstMetric = e.metric;
          }
        }

        return JSON.stringify({
          total: experiments.length,
          kept: kept.length,
          reverted: reverted.length,
          best_metric: bestMetric,
          worst_metric: worstMetric,
          experiments: experiments.slice(-20), // Last 20
        });
      },
    },
  ],
};

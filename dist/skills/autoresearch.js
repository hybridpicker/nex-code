/**
 * cli/skills/autoresearch.js — Autoresearch Skill
 * Autonomous optimization loops: edit -> test -> log -> keep/revert
 * Inspired by Karpathy's autoresearch pattern.
 *
 * Key design choices (aligned with Karpathy's autoresearch):
 * - Dedicated branch per run (autoresearch/<tag>) for isolation
 * - Git reset (not checkout) for discards — only successes in history
 * - Fixed time budget per experiment for comparable results
 * - Output redirection + metric grep to protect context window
 * - Simplicity criterion: complexity cost weighed against metric gain
 * - Crash triage: trivial bugs retried, broken ideas skipped
 * - Resource tracking (memory/CPU alongside primary metric)
 * - No iteration cap by default — runs until stopped
 */

const { execSync, execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Lazy-load agent to reset read guards between experiments
function resetReadGuards() {
  try {
    const { resetSessionTracking } = require("../agent");
    resetSessionTracking();
  } catch {
    // agent not available (e.g. in tests) — no-op
  }
}

// Lazy-load benchmark to avoid circular deps and keep startup fast
let _benchmark = null;
function getBenchmark() {
  if (!_benchmark) {
    try {
      _benchmark = require("../benchmark");
    } catch {
      _benchmark = null;
    }
  }
  return _benchmark;
}

// Track experiment history within the session
let experiments = [];
let loopActive = false;
let sessionBaselineScore = null; // set on first ar_run_benchmark call

// ─── Watch Mode state ───────────────────────────────────────────
let _watchProcess = null;
let _watchCallbacks = { onFailure: null };
let _watchTestCommand = null;
let _watchDebounceTimer = null;
const WATCH_DEBOUNCE_MS = 2000;

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

/** Get short git hash for current HEAD */
function gitHash() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/** Get current git branch name */
function gitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: process.cwd(),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/** Extract metric values from output using grep patterns */
function extractMetrics(output, patterns) {
  const results = {};
  for (const [name, pattern] of Object.entries(patterns)) {
    const re = new RegExp(pattern);
    const match = output.match(re);
    if (match && match[1]) {
      results[name] = parseFloat(match[1]);
    }
  }
  return results;
}

/** Parse peak memory from process output (platform-aware) */
function parseResourceUsage(output) {
  const resources = {};
  // Common patterns: "peak_vram_mb: 1234", "MaxRSS: 1234", "memory: 1234MB"
  const vram = output.match(/peak_vram_mb:\s*([\d.]+)/);
  if (vram) resources.peak_memory_mb = parseFloat(vram[1]);
  const rss = output.match(/MaxRSS:\s*([\d.]+)/);
  if (rss) resources.peak_memory_mb = parseFloat(rss[1]) / 1024; // KB to MB
  const mem = output.match(/memory:\s*([\d.]+)\s*MB/i);
  if (mem) resources.peak_memory_mb = parseFloat(mem[1]);
  return resources;
}

module.exports = {
  name: "autoresearch",
  description:
    "Autonomous optimization loops: edit -> test -> log -> keep/revert. " +
    "Run experiments on a dedicated branch, track results, and automatically keep improvements or revert failures.",

  instructions: `You have access to autoresearch tools for running autonomous optimization loops.

## Workflow

When the user starts an autoresearch loop with /autoresearch <goal>, follow this cycle:

1. **Setup branch** using skill_ar_setup_branch to create a dedicated autoresearch/<tag> branch
2. **Baseline**: run the measurement command with skill_ar_run_experiment, then use skill_ar_extract_metric with the metric_pattern that matches the output (e.g. {"runtime_ms": "runtime_ms:\\\\s*([\\\\d.]+)"})
3. **Hypothesize** a specific, small change to ONE file
4. **Commit checkpoint** using skill_ar_checkpoint before making changes
5. **Edit** the code — make the change immediately, do not investigate further
6. **Run experiment** using skill_ar_run_experiment with the SAME measurement command and output_file
7. **Extract metric** using skill_ar_extract_metric with the SAME pattern as baseline
8. **Log result** using skill_ar_log_experiment with the measured metric value
9. **Decide**:
   - If metric IMPROVED: keep the change, move to next experiment
   - If metric SAME or WORSE: call skill_ar_revert IMMEDIATELY, then move to next experiment
   - You MUST call skill_ar_revert for every failed experiment — never skip the revert
10. **Repeat** from step 3 — do NOT stop unless the user interrupts

## CRITICAL: Move Fast, Investigate Less

You are a researcher running rapid experiments, NOT a code reviewer.
- **Baseline first**: measure the metric BEFORE reading any code
- **One file per experiment**: pick the most promising file, read it ONCE, make ONE targeted change
- **Never read all files** before making your first change — that wastes the entire context window
- **Max 3 reads before editing**: if you have read 3 files/ranges without making an edit, STOP reading and make a change based on what you know
- **Each experiment should take under 2 minutes**: read one file, edit it, measure, log, move on
- **Prefer bash for metrics**: use bash commands (wc -c, time, du) for measurements — they are fast and don't consume context
- **Use write_file for small files**: if a file is under 50 lines, use write_file to rewrite it entirely instead of struggling with edit_file old_text matching. This is faster and avoids repeated edit failures on minified/single-line code
- **If edit_file fails once, switch to write_file immediately** — do not retry edit_file more than once on the same file

## Simplicity Criterion

Not every metric improvement is worth keeping. Weigh complexity cost against improvement:
- A tiny improvement that adds 20 lines of hacky code? Probably not worth it.
- Deleting code and getting equal or better results? Definitely keep — that's a simplification win.
- An improvement of ~0 but much simpler code? Keep.
When logging experiments, note the complexity impact in the notes field.

## Crash Triage

When an experiment crashes:
- **Trivial bug** (typo, missing import, off-by-one): fix it and re-run the same experiment
- **Fundamentally broken idea** (OOM, architectural incompatibility): log as crash, revert, move on
- Use your judgment — if you can't fix a crash in 2 attempts, skip the idea

## Output Efficiency

When running experiments, redirect output to a log file and only grep for the target metric.
This protects the context window from being flooded with training output.
Use ar_run_experiment with output_file to redirect, then ar_extract_metric to read just the result.

## Rules
- Always create a checkpoint before making changes
- Always run the experiment after editing
- Always log the result (even failures and crashes)
- **ALWAYS call skill_ar_revert when metric does not improve** — this is mandatory, not optional. A "discard" without revert leaves broken code in the working tree
- NEVER STOP: keep running experiments until the user interrupts — they may be away. Do not print summary tables mid-loop. Do not say "I'll stop now". Just keep experimenting.
- If you run out of ideas, re-read the code for new angles, try combining previous near-misses, or try more radical changes
- Do NOT print summary tables during the loop — the user can check /ar-status anytime. Focus on running experiments, not reporting.`,

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
          "The agent will run autonomous optimization loops until you interrupt (Ctrl+C).",
        );
        console.log("Experiments run on a dedicated branch for isolation.\n");
        return `AUTORESEARCH_GOAL: ${goal}\n\nStart the autoresearch loop. First, set up a dedicated branch using ar_setup_branch. Then analyze the current state and establish a baseline metric. Then begin the edit->test->log->keep/revert cycle. Do NOT stop — keep running experiments indefinitely until I interrupt.`;
      },
    },
    {
      cmd: "/ar-self-improve",
      desc: "Self-improvement loop: optimize nex-code's own benchmark score",
      handler: (args) => {
        const focus = args.trim() || "overall benchmark score";
        loopActive = true;
        loadExperiments();
        console.log(`Self-improvement loop started.`);
        console.log(`Focus: ${focus}`);
        console.log(
          "The agent will optimize nex-code's benchmark score autonomously.",
        );
        console.log("Ctrl+C to stop.\n");
        return [
          `AUTORESEARCH_GOAL: Improve nex-code's ${focus}`,
          "",
          "## Self-Improvement Protocol",
          "",
          "You are optimizing nex-code itself. The benchmark suite is your eval harness — DO NOT modify it.",
          "",
          "### Setup (run ONCE)",
          "1. Call ar_setup_branch (tag: 'self-improve')",
          "2. Call ar_run_benchmark with quick=true — the result contains per-category scores",
          "3. From the benchmark JSON result, identify the weakest category. STOP. Do NOT read any source files yet.",
          "",
          "### Loop (repeat until stopped)",
          "",
          "**Step A — Hypothesize and checkpoint in ONE response**",
          "State your hypothesis in one sentence AND call ar_checkpoint in the SAME response — never output text alone.",
          "Default hypothesis if unsure: improve the `read_file` tool description in cli/tools/index.js.",
          "",
          "**Step B — Read ONE targeted location**",
          "Open ONLY the specific file and line range your hypothesis requires.",
          "Do NOT read multiple files. Do NOT read agent.js broadly. Do NOT investigate root causes further.",
          "If the edit target is not where you expected: make your best guess and proceed.",
          "",
          "**Step C — Checkpoint and edit**",
          "1. ar_checkpoint",
          "2. Make the ONE targeted edit",
          "3. npm test — if tests fail, ar_revert immediately and go back to Step A with a different hypothesis",
          "4. npm run build",
          "",
          "**Step D — Measure**",
          "1. ar_run_benchmark quick=true",
          "2. ar_log_experiment with the score as metric",
          "3. If score improved: keep, go to Step A",
          "4. If score same or worse: ar_revert, go to Step A with a different hypothesis",
          "",
          "### HARD RULES",
          "- EVERY response must end with a tool call — NEVER output text as your final message",
          "- After ar_revert: call ar_checkpoint immediately in the same response as your next hypothesis",
          "- After ar_run_benchmark: call ar_log_experiment immediately in the same response",
          "- NEVER read more than 2 files per experiment cycle",
          "- NEVER use bash to create branches or run benchmarks — use ar_ tools only",
          "- If you are blocked from reading a file, SKIP IT and make your edit based on what you already know",
          "- If 3 consecutive experiments fail to improve, change category focus",
          "- Simplicity criterion: prefer removing code over adding it — complexity cost must be justified by metric gain",
          "- cli/tools/index.js uses single-quoted JS strings — when editing descriptions, use ONLY single quotes inside the text, or escape double quotes as \\\\\" — NEVER put a raw double quote inside a JS string literal or tests will fail with SyntaxError",
          "- Before every Edit call, grep the EXACT old_text from the file first so it matches byte-for-byte",
          "",
          "### How the benchmark score works — READ THIS FIRST",
          "The benchmark sends nex-code's TOOL_DEFINITIONS (schemas) to external models and checks:",
          "  - Did the model call a tool? (tool call rate)",
          "  - Did it call the RIGHT tool? (name accuracy)",
          "  - Did it provide valid arguments? (args validity)",
          "  - Did it match the JSON schema? (schema compliance)",
          "The score reflects how CLEAR and DESCRIPTIVE nex-code's tool schemas are.",
          "Changes to agent.js, context-engine.js, sub-agent.js have NO EFFECT on this score.",
          "",
          "### What actually moves the score",
          "- cli/tools/index.js — tool `description` fields, parameter descriptions, examples",
          "  → Clearer descriptions = models pick the right tool more often",
          "  → Better parameter descriptions = models pass valid args more often",
          "  → Adding usage examples to descriptions = fewer wrong tool selections",
          "- The `name` field of tools (must be clear and unambiguous)",
          "- The `required` array in tool schemas (must match what models need to call it)",
          "",
          "### CANNOT modify",
          "- cli/benchmark.js — eval harness, hands off",
          "- tests/ — not the optimization target",
          "- Tool names (renaming breaks existing sessions)",
        ].join("\n");
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
          "  #  | Status   | Metric        | Memory MB | Commit  | Description",
        );
        console.log(
          "  ---|----------|---------------|-----------|---------|----------------------------------",
        );
        for (let i = 0; i < exps.length; i++) {
          const e = exps[i];
          const status =
            e.status === "crash"
              ? "CRASH   "
              : e.kept
                ? "KEPT    "
                : "REVERTED";
          const metric =
            e.metric != null ? String(e.metric).padEnd(13) : "N/A          ";
          const memory =
            e.peak_memory_mb != null
              ? String(e.peak_memory_mb.toFixed(1)).padEnd(9)
              : "N/A      ";
          const commit = (e.commit || "N/A").padEnd(7);
          const desc = (e.description || "").substring(0, 34);
          console.log(
            `  ${String(i + 1).padStart(2)} | ${status} | ${metric} | ${memory} | ${commit} | ${desc}`,
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
        const crashes = exps.filter((e) => e.status === "crash");
        if (crashes.length > 0) {
          console.log(`  Crashes: ${crashes.length}`);
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
    {
      cmd: "/ar-watch",
      desc: "Start/stop background file watcher that auto-runs tests on changes",
      handler: (args) => {
        // Check feature flag
        let watchEnabled = false;
        try {
          const { feature } = require("../feature-flags");
          watchEnabled = feature("WATCH_MODE");
        } catch {
          // feature-flags not available — check env
          watchEnabled =
            process.env.NEX_FEATURE_WATCH_MODE === "1" ||
            process.env.NEX_FEATURE_WATCH_MODE === "true";
        }
        if (!watchEnabled) {
          console.log(
            "Watch mode is disabled. Enable with NEX_FEATURE_WATCH_MODE=1",
          );
          return;
        }

        const cmd = args.trim();
        if (cmd === "stop" || cmd === "off") {
          stopWatch();
          console.log("Watch mode stopped.");
          return;
        }
        if (_watchProcess) {
          console.log(
            "Watch mode is already running. Use /ar-watch stop to stop it.",
          );
          return;
        }

        // Parse: /ar-watch <test command> [--watch-path <glob>]
        const testCommand = cmd || "npm test";
        const watchPath = process.cwd();
        _watchTestCommand = testCommand;

        startWatch(watchPath, testCommand);
        console.log(`Watch mode started. Monitoring ${watchPath} for changes.`);
        console.log(`Test command: ${testCommand}`);
        console.log("On test failure, the agent will auto-investigate.");
        console.log("Use /ar-watch stop to stop.\n");
      },
    },
  ],

  tools: [
    {
      type: "function",
      function: {
        name: "ar_setup_branch",
        description:
          "Create a dedicated autoresearch branch for this experiment run. " +
          "Creates 'autoresearch/<tag>' from the current branch. " +
          "Call this ONCE at the start of each autoresearch session.",
        parameters: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description:
                "Short tag for this run (e.g. 'mar31', 'perf-opt'). " +
                "Used as branch name: autoresearch/<tag>",
            },
          },
          required: ["tag"],
        },
      },
      execute: async (args) => {
        // Strip any date-like suffix the model may have hallucinated, then
        // append today's real date so the branch name is always accurate.
        const baseTag =
          (args.tag || "self-improve")
            .replace(/[^a-zA-Z0-9_-]/g, "-")
            .replace(/-?\d{4,8}$/, "") // strip trailing YYYYMMDD / YYYYMM / etc.
            .replace(/-[a-z]{3}\d{1,2}$/i, "") // strip trailing mon## (e.g. apr15)
            .replace(/-+$/, "") || "self-improve";
        const now = new Date();
        const dateStr =
          now.toLocaleString("en", { month: "short" }).toLowerCase() +
          now.getDate();
        const tag = `${baseTag}-${dateStr}`;
        const branchName = `autoresearch/${tag}`;

        try {
          const currentBranch = gitBranch();
          // If we're already on the target branch, nothing to do
          if (currentBranch === branchName) {
            return JSON.stringify({
              status: "resumed",
              branch: branchName,
              note: "Already on autoresearch branch — continuing experiments.",
            });
          }

          // Check if branch already exists
          let branchExists = false;
          try {
            execFileSync("git", ["rev-parse", "--verify", branchName], {
              cwd: process.cwd(),
              stdio: ["pipe", "pipe", "pipe"],
            });
            branchExists = true;
          } catch {
            // Branch doesn't exist
          }

          if (branchExists) {
            // Stash any uncommitted changes before switching
            try {
              execSync(`git stash`, {
                cwd: process.cwd(),
                stdio: ["pipe", "pipe", "pipe"],
              });
            } catch {
              // Ignore stash errors (nothing to stash)
            }
            execFileSync("git", ["checkout", branchName], {
              cwd: process.cwd(),
              stdio: ["pipe", "pipe", "pipe"],
            });
            return JSON.stringify({
              status: "resumed",
              branch: branchName,
              note: "Branch already existed — resuming experiments on it.",
            });
          }

          const sourceBranch = gitBranch() || "unknown";
          execFileSync("git", ["checkout", "-b", branchName], {
            cwd: process.cwd(),
            stdio: ["pipe", "pipe", "pipe"],
          });

          return JSON.stringify({
            status: "created",
            branch: branchName,
            source_branch: sourceBranch,
            note: `Experiment branch created. All experiments will be isolated here. Merge back to '${sourceBranch}' when done.`,
          });
        } catch (err) {
          return JSON.stringify({
            status: "branch_failed",
            error: err.message,
            note: "Could not create branch. Continuing on current branch.",
          });
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_checkpoint",
        description:
          "Create a git checkpoint before making experimental changes. " +
          "This allows reverting via git reset if the experiment fails. " +
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
            execFileSync("git", ["commit", "-m", `autoresearch: checkpoint before: ${args.message || "experiment"}`],
              { cwd: process.cwd(), stdio: "pipe" },
            );
          }

          const hash = gitHash();

          // Reset read guards so the agent can re-read files in the next experiment
          resetReadGuards();

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
          "Returns stdout, stderr, exit code, execution time, and resource usage. " +
          "Supports output redirection to a log file to protect context window. " +
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
                "Max seconds to wait (default: 300). Kill the process if exceeded.",
            },
            output_file: {
              type: "string",
              description:
                "Optional: redirect all output to this file instead of capturing in context. " +
                'Use with ar_extract_metric to read only the metric. (e.g. "run.log")',
            },
            metric_pattern: {
              type: "string",
              description:
                "Optional: regex pattern to extract the primary metric from output. " +
                "Must have one capture group for the numeric value. " +
                '(e.g. "val_bpb:\\\\s*([\\\\d.]+)")',
            },
          },
          required: ["command"],
        },
      },
      execute: async (args) => {
        const timeout = (args.timeout_seconds || 300) * 1000;
        const start = Date.now();
        const outputFile = args.output_file;

        // Build the actual command — redirect if output_file specified
        const cmd = outputFile
          ? `${args.command} > ${outputFile} 2>&1`
          : args.command;

        try {
          const output = execSync(cmd, {
            cwd: process.cwd(),
            encoding: "utf-8",
            timeout,
            maxBuffer: 2 * 1024 * 1024, // 2MB
            stdio: ["pipe", "pipe", "pipe"],
          });

          const elapsed = ((Date.now() - start) / 1000).toFixed(2);
          const rawOutput = outputFile
            ? fs.existsSync(path.resolve(process.cwd(), outputFile))
              ? fs.readFileSync(
                  path.resolve(process.cwd(), outputFile),
                  "utf-8",
                )
              : ""
            : output;

          // Extract resource usage from output
          const resources = parseResourceUsage(rawOutput);

          // Extract metric if pattern provided
          let extractedMetric = null;
          if (args.metric_pattern) {
            const metrics = extractMetrics(rawOutput, {
              primary: args.metric_pattern,
            });
            extractedMetric = metrics.primary ?? null;
          }

          // For redirected output, only return summary + metric
          const stdout = outputFile
            ? `[Output redirected to ${outputFile}]`
            : output.substring(0, 4000);

          return JSON.stringify({
            status: "success",
            exit_code: 0,
            elapsed_seconds: parseFloat(elapsed),
            stdout,
            stderr: "",
            extracted_metric: extractedMetric,
            resources,
          });
        } catch (err) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(2);

          // Try to read output file even on failure
          let resources = {};
          let extractedMetric = null;
          if (outputFile) {
            const outPath = path.resolve(process.cwd(), outputFile);
            if (fs.existsSync(outPath)) {
              const rawOutput = fs.readFileSync(outPath, "utf-8");
              resources = parseResourceUsage(rawOutput);
              if (args.metric_pattern) {
                const metrics = extractMetrics(rawOutput, {
                  primary: args.metric_pattern,
                });
                extractedMetric = metrics.primary ?? null;
              }
            }
          }

          return JSON.stringify({
            status: err.killed ? "timeout" : "failure",
            exit_code: err.status || 1,
            elapsed_seconds: parseFloat(elapsed),
            stdout: outputFile
              ? `[Output redirected to ${outputFile}]`
              : (err.stdout || "").substring(0, 4000),
            stderr: (err.stderr || "").substring(0, 2000),
            extracted_metric: extractedMetric,
            resources,
          });
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_extract_metric",
        description:
          "Extract specific metrics from an experiment log file using grep patterns. " +
          "Use this after ar_run_experiment with output_file to read only the metrics " +
          "without loading the entire output into context.",
        parameters: {
          type: "object",
          properties: {
            file: {
              type: "string",
              description: 'Path to the log file (e.g. "run.log")',
            },
            patterns: {
              type: "object",
              description:
                "Map of metric name to regex pattern with one capture group. " +
                'Example: {"val_bpb": "val_bpb:\\\\s*([\\\\d.]+)", "memory": "peak_vram_mb:\\\\s*([\\\\d.]+)"}',
              additionalProperties: { type: "string" },
            },
            tail_lines: {
              type: "number",
              description:
                "If the file is large, only read the last N lines (default: 100). " +
                "Set to 0 to read the entire file.",
            },
          },
          required: ["file", "patterns"],
        },
      },
      execute: async (args) => {
        try {
          const filePath = path.resolve(process.cwd(), args.file);
          if (!fs.existsSync(filePath)) {
            return JSON.stringify({
              status: "file_not_found",
              file: args.file,
            });
          }

          let content = fs.readFileSync(filePath, "utf-8");
          const tailLines =
            args.tail_lines !== undefined ? args.tail_lines : 100;
          if (tailLines > 0) {
            const lines = content.split("\n");
            content = lines.slice(-tailLines).join("\n");
          }

          const metrics = extractMetrics(content, args.patterns);
          const resources = parseResourceUsage(content);

          return JSON.stringify({
            status: "extracted",
            metrics,
            resources,
            lines_read: tailLines > 0 ? tailLines : content.split("\n").length,
          });
        } catch (err) {
          return JSON.stringify({
            status: "extract_failed",
            error: err.message,
          });
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_run_benchmark",
        description:
          "Run nex-code's built-in benchmark suite and return scores. " +
          "This is the primary metric for self-improvement loops. " +
          "Returns overall score (0-100), per-category scores, and model details. " +
          "Use quick=true for fast iteration (~1-2 min), full for comprehensive evaluation.",
        parameters: {
          type: "object",
          properties: {
            quick: {
              type: "boolean",
              description:
                "If true, run 7 tasks on 3 models (fast). If false, run all 59 tasks (thorough). Default: true.",
            },
            models: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional: specific models to benchmark. Default: top models from previous results.",
            },
          },
        },
      },
      execute: async (args) => {
        const benchmark = getBenchmark();
        if (!benchmark) {
          return JSON.stringify({
            status: "unavailable",
            error:
              "Benchmark module not found. Make sure cli/benchmark.js exists.",
          });
        }

        const quick = args.quick !== false; // default true
        const start = Date.now();

        try {
          const summary = await benchmark.runBenchmark({
            quick,
            models: args.models || undefined,
            onProgress: () => {}, // silent
          });

          const elapsed = ((Date.now() - start) / 1000).toFixed(1);

          // Extract the key metrics for autoresearch
          const results = summary.map((s) => ({
            model: s.model,
            score: s.score,
            categoryScores: s.categoryScores || {},
            toolCallRate: s.toolCallRate,
            correctRate: s.correctRate,
            validArgsRate: s.validArgsRate,
            avgLatency: s.avgLatency,
          }));

          // Compute aggregate score across all models
          const avgScore =
            results.length > 0
              ? Math.round(
                  (results.reduce((a, r) => a + r.score, 0) / results.length) *
                    10,
                ) / 10
              : 0;

          // Record baseline on first run
          if (sessionBaselineScore === null) {
            sessionBaselineScore = avgScore;
          }

          // Find weakest category across all models
          const categoryTotals = {};
          const categoryCounts = {};
          for (const r of results) {
            for (const [cat, score] of Object.entries(r.categoryScores)) {
              categoryTotals[cat] = (categoryTotals[cat] || 0) + score;
              categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            }
          }
          const categoryAvgs = {};
          for (const cat of Object.keys(categoryTotals)) {
            categoryAvgs[cat] =
              Math.round((categoryTotals[cat] / categoryCounts[cat]) * 10) / 10;
          }

          // Sort categories by score to find weakest
          const sortedCategories = Object.entries(categoryAvgs).sort(
            (a, b) => a[1] - b[1],
          );

          const weakestCategory =
            sortedCategories.length > 0 ? sortedCategories[0] : null;

          return JSON.stringify({
            status: "success",
            quick,
            elapsed_seconds: parseFloat(elapsed),
            models_tested: results.length,
            average_score: avgScore,
            category_averages: categoryAvgs,
            weakest_category: weakestCategory
              ? { name: weakestCategory[0], score: weakestCategory[1] }
              : null,
            per_model: results,
          });
        } catch (err) {
          return JSON.stringify({
            status: "benchmark_failed",
            error: err.message,
            elapsed_seconds: parseFloat(
              ((Date.now() - start) / 1000).toFixed(1),
            ),
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
                "The measured metric value (e.g. test runtime in seconds, bundle size in KB, score). Use 0 for crashes.",
            },
            metric_name: {
              type: "string",
              description:
                'Name of the metric (e.g. "runtime_seconds", "bundle_size_kb", "val_bpb")',
            },
            kept: {
              type: "boolean",
              description:
                "Whether you decided to keep (true) or revert (false) this change",
            },
            status: {
              type: "string",
              enum: ["keep", "discard", "crash"],
              description:
                "Experiment outcome: 'keep' if metric improved, 'discard' if worse, 'crash' if it failed to run",
            },
            peak_memory_mb: {
              type: "number",
              description:
                "Peak memory usage in MB during the experiment (if available)",
            },
            complexity_impact: {
              type: "string",
              enum: ["simpler", "neutral", "complex"],
              description:
                "How this change affects code complexity: 'simpler' (removed code), 'neutral', or 'complex' (added code)",
            },
            notes: {
              type: "string",
              description:
                "Additional observations — include complexity assessment and crash triage info",
            },
          },
          required: ["description", "metric", "kept"],
        },
      },
      execute: async (args) => {
        loadExperiments();

        // Enforce keep/revert decision against session baseline
        if (
          sessionBaselineScore !== null &&
          typeof args.metric === "number" &&
          args.kept === true &&
          args.metric < sessionBaselineScore
        ) {
          console.log(
            `\x1b[31m   ⚠ Score ${args.metric} < baseline ${sessionBaselineScore} — overriding kept=true to kept=false\x1b[0m`,
          );
          args.kept = false;
          args.status = "discard";
        }

        const commit = gitHash();
        const entry = {
          id: experiments.length + 1,
          timestamp: new Date().toISOString(),
          commit,
          description: args.description,
          metric: args.metric,
          metric_name: args.metric_name || "metric",
          kept: args.kept,
          status: args.status || (args.kept ? "keep" : "discard"),
          peak_memory_mb: args.peak_memory_mb ?? null,
          complexity_impact: args.complexity_impact || "neutral",
          notes: args.notes || "",
        };
        experiments.push(entry);
        saveExperiments();

        const prev =
          experiments.length >= 2
            ? experiments[experiments.length - 2].metric
            : null;
        const trend =
          prev != null
            ? `Previous: ${prev}, Current: ${args.metric}`
            : "First experiment — baseline established";

        const keptCount = experiments.filter((e) => e.kept).length;
        const revertedCount = experiments.filter((e) => !e.kept).length;
        const statusIcon = args.kept
          ? "\x1b[32m✔ KEPT\x1b[0m"
          : "\x1b[31m✘ REVERTED\x1b[0m";
        const delta =
          prev != null && typeof args.metric === "number"
            ? ` (${args.metric > prev ? "+" : ""}${(args.metric - prev).toFixed(1)} pts)`
            : "";
        console.log(
          `\n\x1b[1m── Experiment #${entry.id} ${statusIcon}\x1b[0m  score: ${args.metric}${delta}  │  total: ${experiments.length}  kept: ${keptCount}  reverted: ${revertedCount}`,
        );
        if (args.description) console.log(`   ${args.description}`);

        return JSON.stringify({
          status: "logged",
          experiment_number: entry.id,
          total_experiments: experiments.length,
          kept_count: keptCount,
          reverted_count: revertedCount,
          crash_count: experiments.filter((e) => e.status === "crash").length,
          trend,
        });
      },
    },
    {
      type: "function",
      function: {
        name: "ar_revert",
        description:
          "Revert to the last checkpoint using git reset. " +
          "Unlike git checkout, this moves the branch pointer back so only " +
          "successful experiments remain in git history. " +
          "Use this when an experiment made things worse or crashed.",
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
          // Use git reset --hard HEAD~1 to remove the failed experiment commit
          // and move the branch pointer back (clean history, only successes)
          const currentHash = gitHash();

          // Check if there's a commit to reset to
          try {
            execSync("git log --oneline -2", {
              cwd: process.cwd(),
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
          } catch {
            // Fallback: just clean working tree
            execSync("git checkout -- .", {
              cwd: process.cwd(),
              stdio: "pipe",
            });
            execSync("git clean -fd", {
              cwd: process.cwd(),
              stdio: "pipe",
            });
            return JSON.stringify({
              status: "reverted",
              method: "checkout",
              reason: args.reason,
            });
          }

          // Reset to before the experiment commit
          execSync("git reset --hard HEAD~1", {
            cwd: process.cwd(),
            stdio: "pipe",
          });
          // Also clean any untracked files
          execSync("git clean -fd", {
            cwd: process.cwd(),
            stdio: "pipe",
          });

          const newHash = gitHash();

          // Reset read guards — files changed after revert, agent needs fresh access
          resetReadGuards();

          const expNum = experiments.length + 1;
          console.log(
            `\x1b[33m   ↩ Reverted\x1b[0m  ${currentHash.slice(0, 7)} → ${newHash.slice(0, 7)}${args.reason ? `  (${args.reason})` : ""}`,
          );

          return JSON.stringify({
            status: "reverted",
            method: "reset",
            reverted_from: currentHash,
            reverted_to: newHash,
            reason: args.reason,
            note: "Branch pointer moved back — failed experiment removed from history. Read guards reset — you can re-read files.",
          });
        } catch (err) {
          // Fallback to checkout if reset fails
          try {
            execSync("git checkout -- .", {
              cwd: process.cwd(),
              stdio: "pipe",
            });
            execSync("git clean -fd", {
              cwd: process.cwd(),
              stdio: "pipe",
            });
            return JSON.stringify({
              status: "reverted",
              method: "checkout_fallback",
              reason: args.reason,
              note: "git reset failed, fell back to checkout. Commit may remain in history.",
            });
          } catch (fallbackErr) {
            return JSON.stringify({
              status: "revert_failed",
              error: fallbackErr.message,
              note: "Manual cleanup may be needed. Check git status.",
            });
          }
        }
      },
    },
    {
      type: "function",
      function: {
        name: "ar_watch_status",
        description:
          "Get the current status of the background file watcher (watch mode). " +
          "Returns whether watch mode is active, the test command, and recent failure count.",
        parameters: { type: "object", properties: {} },
      },
      execute: async () => {
        return JSON.stringify({
          active: !!_watchProcess,
          testCommand: _watchTestCommand,
          pid: _watchProcess ? _watchProcess.pid : null,
        });
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
        const crashes = experiments.filter((e) => e.status === "crash");

        let bestMetric = null;
        let worstMetric = null;
        for (const e of experiments) {
          if (e.metric != null && e.status !== "crash") {
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
          crashes: crashes.length,
          best_metric: bestMetric,
          worst_metric: worstMetric,
          branch: gitBranch(),
          experiments: experiments.slice(-20), // Last 20
        });
      },
    },
  ],
};

// ─── Watch Mode Implementation ──────────────────────────────────

/**
 * Start a background file watcher using fs.watch (recursive).
 * On file changes, debounces and runs the test command.
 * If tests fail, injects a mid-run note into the agent conversation.
 * @param {string} watchPath — directory to watch
 * @param {string} testCommand — shell command to run on changes
 */
function startWatch(watchPath, testCommand) {
  if (_watchProcess) stopWatch();

  const ignorePatterns = [
    /node_modules/,
    /\.git\//,
    /\.nex\//,
    /dist\//,
    /\.log$/,
    /\.tmp$/,
  ];

  try {
    const watcher = fs.watch(
      watchPath,
      { recursive: true },
      (eventType, filename) => {
        if (!filename) return;
        // Skip ignored paths
        if (ignorePatterns.some((p) => p.test(filename))) return;
        // Skip non-source files
        if (
          !/\.(js|ts|jsx|tsx|py|rb|go|rs|json|yaml|yml|toml|cfg|ini|sh|css|html)$/.test(
            filename,
          )
        )
          return;

        // Debounce: wait for changes to settle
        if (_watchDebounceTimer) clearTimeout(_watchDebounceTimer);
        _watchDebounceTimer = setTimeout(() => {
          _runWatchTest(testCommand, filename);
        }, WATCH_DEBOUNCE_MS);
      },
    );

    _watchProcess = watcher;

    // Clean up on process exit
    const cleanup = () => stopWatch();
    process.on("exit", cleanup);
    process.on("SIGINT", cleanup);
  } catch (err) {
    console.error(`Watch mode failed to start: ${err.message}`);
    _watchProcess = null;
  }
}

/**
 * Stop the background file watcher.
 */
function stopWatch() {
  if (_watchProcess) {
    try {
      _watchProcess.close();
    } catch {
      /* already closed */
    }
    _watchProcess = null;
  }
  if (_watchDebounceTimer) {
    clearTimeout(_watchDebounceTimer);
    _watchDebounceTimer = null;
  }
  _watchTestCommand = null;
}

/**
 * Run the test command and handle failures.
 * @param {string} testCommand
 * @param {string} changedFile — file that triggered the watch
 */
function _runWatchTest(testCommand, changedFile) {
  try {
    execSync(testCommand, {
      cwd: process.cwd(),
      stdio: "pipe",
      timeout: 120000, // 2 minute timeout
      encoding: "utf-8",
    });
    // Tests passed — no action needed
  } catch (err) {
    // Tests failed — notify the agent
    const output = (err.stdout || "") + (err.stderr || "");
    const truncatedOutput = output.slice(-500); // Last 500 chars of error
    const failureNote = `[WATCH MODE] Test failure detected after change to ${changedFile}:\n${truncatedOutput}`;

    // Try to inject a note into the agent conversation
    try {
      const { injectMidRunNote } = require("../agent");
      injectMidRunNote(failureNote);
    } catch {
      // Agent not in active conversation — just log
      process.stderr.write(
        `\n\x1b[33m⚠ Watch: tests failed after ${changedFile} changed\x1b[0m\n`,
      );
    }
  }
}

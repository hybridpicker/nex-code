/**
 * cli/orchestrator.js — Multi-Agent Orchestrator
 *
 * Decomposes complex multi-goal prompts into parallel sub-tasks,
 * runs them via sub-agent.js, and synthesizes results.
 *
 * Opt-in only: triggered via --orchestrate flag or /orchestrate command.
 */

"use strict";

const { callWithRetry, runSubAgent, clearAllLocks } = require("./sub-agent");
const {
  parseModelSpec,
  getActiveProviderName,
  getActiveModelId,
} = require("./providers/registry");
const { detectCategory, getModelForCategory } = require("./task-router");
const { MultiProgress, C } = require("./ui");

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_PARALLEL = 3; // SSH session limit
const DEFAULT_MAX_SUBTASKS = 4;
const DEFAULT_WORKER_MODEL = "devstral-2:123b";
const DEFAULT_ORCHESTRATOR_MODEL = "kimi-k2.5";

// ─── Prompts ─────────────────────────────────────────────────────────────────

const DECOMPOSE_PROMPT = `You are a task decomposition engine. Given a complex user request, split it into independent, atomic sub-tasks.

RULES:
- Output ONLY a JSON array, no markdown fences, no explanation.
- Each sub-task must be independently solvable by a coding agent.
- Maximum {maxSubTasks} sub-tasks. Merge closely related items.
- Each sub-task object must have these fields:
  { "id": "t1", "task": "description", "scope": ["file1.js", "dir/"], "estimatedCalls": 5, "priority": 1 }
- "scope" lists files/directories the agent should focus on.
- "estimatedCalls" is a rough count of tool invocations needed (max 15).
- "priority" is 1 (highest) to N (lowest) — controls execution order if sequential.
- No overlapping scopes: each file should appear in at most one sub-task.
- If the request is simple (single goal), return an array with exactly 1 item.

USER REQUEST:
{prompt}`;

const SYNTHESIZE_PROMPT = `You are a result synthesis engine. Given the results of multiple sub-agents that worked on parts of a larger task, produce a unified summary.

RULES:
- Output ONLY a JSON object with these fields:
  { "summary": "what was done", "conflicts": ["file.js: agent 1 and 2 both modified line 42"], "commitMessage": "fix: ...", "filesChanged": ["file1.js", "file2.js"] }
- "conflicts" is an array of file conflicts where multiple agents modified the same file. Empty array if none.
- "commitMessage" follows conventional commits (fix:, feat:, refactor:, etc.).
- "filesChanged" is a deduplicated list of all files modified across all agents.
- "summary" is a concise paragraph describing the overall result.

ORIGINAL REQUEST:
{prompt}

SUB-AGENT RESULTS:
{results}`;

// ─── Retry Helper ────────────────────────────────────────────────────────────

/**
 * Executes `fn` and retries once on failure after `delayMs` ms.
 * Throws the last error if all attempts fail.
 *
 * @template T
 * @param {() => Promise<T>} fn - Async function to call
 * @param {number} [retries=1] - Number of retries after initial attempt
 * @param {number} [delayMs=2000] - Delay between attempts in ms
 * @returns {Promise<T>}
 */
async function withRetry(fn, retries = 1, delayMs = 2000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ─── Concurrency Control ─────────────────────────────────────────────────────

/**
 * Creates a simple Promise-based semaphore for limiting concurrent operations.
 *
 * @param {number} limit - Maximum number of concurrent operations allowed
 * @returns {function(): Promise<function(): void>} A function that returns a promise resolving to a release callback
 *
 * @example
 * const acquire = createSemaphore(2);
 * const release = await acquire();
 * // Critical section
 * release();
 */
function createSemaphore(limit) {
  let active = 0;
  const queue = [];

  return function acquire() {
    return new Promise((resolve) => {
      const tryRun = () => {
        if (active < limit) {
          active++;
          resolve(() => {
            active--;
            if (queue.length > 0) queue.shift()();
          });
        } else {
          queue.push(tryRun);
        }
      };
      tryRun();
    });
  };
}

// ─── Complexity Detection ────────────────────────────────────────────────────

/**
 * Detects whether a prompt contains multiple distinct goals using heuristic analysis.
 *
 * @param {string} prompt - The user prompt to analyze
 * @returns {{ isComplex: boolean, estimatedGoals: number, reason: string }}
 *   - isComplex: true if prompt contains 3+ distinct goals
 *   - estimatedGoals: estimated number of goals detected
 *   - reason: explanation of detection criteria
 *
 * @example
 * const result = detectComplexPrompt("1. Fix bug A; 2. Add feature B; 3. Update docs");
 * // Returns: { isComplex: true, estimatedGoals: 3, reason: "3 numbered items" }
 */
function detectComplexPrompt(prompt) {
  if (!prompt || typeof prompt !== "string") {
    return { isComplex: false, estimatedGoals: 0, reason: "empty" };
  }

  let goals = 0;
  const reasons = [];

  // Numbered list items: "1.", "2.", "(1)", "(a)" — matches both inline and line-start
  const numberedItems = prompt.match(
    /(?:(?:^|\n)\s*|\s)(?:\d+[.)]\s|[(]\d+[)][\s,]|[(][a-z][)][\s,])/g,
  );
  if (numberedItems && numberedItems.length >= 2) {
    goals = Math.max(goals, numberedItems.length);
    reasons.push(`${numberedItems.length} numbered items`);
  }

  // Bullet points
  const bullets = prompt.match(/(?:^|\n)\s*[-*]\s+\S/g);
  if (bullets && bullets.length >= 3) {
    goals = Math.max(goals, bullets.length);
    reasons.push(`${bullets.length} bullet points`);
  }

  // Semicolons separating goals
  const semicolonParts = prompt
    .split(/;\s*/)
    .filter((p) => p.trim().length > 10);
  if (semicolonParts.length >= 3) {
    goals = Math.max(goals, semicolonParts.length);
    reasons.push(`${semicolonParts.length} semicolon-separated goals`);
  }

  // Goal keywords: "also", "additionally", "and fix", "and add", "and update"
  const alsoMatches = prompt.match(
    /\b(also|additionally|and\s+(?:fix|add|update|create|implement|remove|refactor))\b/gi,
  );
  if (alsoMatches && alsoMatches.length >= 2) {
    goals = Math.max(goals, alsoMatches.length + 1);
    reasons.push(`${alsoMatches.length} transition keywords`);
  }

  const threshold = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);
  const isComplex = goals >= threshold;
  return {
    isComplex,
    estimatedGoals: goals,
    reason: reasons.length > 0 ? reasons.join(", ") : "single goal",
  };
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Extracts JSON from an LLM response that may include markdown fences or surrounding text.
 *
 * @param {string} text - The LLM response text
 * @returns {any} Parsed JSON object or array
 * @throws {Error} If no valid JSON can be extracted
 *
 * @example
 * const json = extractJSON('```json\n{"key": "value"}\n```');
 * // Returns: { key: "value" }
 */
function extractJSON(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty response from orchestrator model");
  }

  // Try direct parse first
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }

  // Extract from markdown code block
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      /* continue */
    }
  }

  // Find first [ or { and try to parse from there
  const firstBracket = trimmed.search(/[[\{]/);
  if (firstBracket >= 0) {
    const candidate = trimmed.slice(firstBracket);
    try {
      return JSON.parse(candidate);
    } catch {
      /* continue */
    }
  }

  throw new Error(
    `Could not extract valid JSON from response:\n${trimmed.slice(0, 200)}`,
  );
}

// ─── Decompose ───────────────────────────────────────────────────────────────

/**
 * Decompose a complex prompt into independent sub-tasks via an LLM call.
 *
 * This function uses an LLM to break down a complex prompt into smaller,
 * independent tasks that can be executed in parallel by worker agents.
 *
 * @param {string} prompt - The user's complex prompt containing multiple goals
 * @param {string} model - Orchestrator model spec (e.g., 'kimi-k2.5')
 * @param {{ maxSubTasks?: number }} opts - Options for decomposition
 * @param {number} [opts.maxSubTasks] - Maximum number of sub-tasks to create (default: 4)
 * @returns {Promise<Array<{
 *   id: string,                     - Unique task identifier
 *   task: string,                   - Task description
 *   scope: string[],                - Files/directories to focus on
 *   estimatedCalls: number,        - Estimated number of tool calls needed
 *   priority: number                - Execution priority (1 = highest)
 * }>>}
 *
 * @example
 * const tasks = await decompose('Fix bug A, add feature B, update docs', 'kimi-k2.5', {
 *   maxSubTasks: 4
 * });
 */
/**
 * Decompose a complex prompt into smaller sub-tasks.
 * @param {string} prompt - The user's original prompt
 * @param {string} [model] - Orchestrator model spec (provider:model)
 * @param {Object} [opts] - Options
 * @param {number} [opts.maxSubTasks=4] - Maximum number of sub-tasks to generate
 * @returns {Promise<Array<{ id: string, task: string, scope: string[], estimatedCalls: number, priority: number }>>}
 */
async function decompose(prompt, model, opts = {}) {
  const maxSubTasks = opts.maxSubTasks || DEFAULT_MAX_SUBTASKS;

  const systemContent = DECOMPOSE_PROMPT.replace(
    "{maxSubTasks}",
    String(maxSubTasks),
  ).replace("{prompt}", prompt);

  const messages = [
    { role: "system", content: systemContent },
    { role: "user", content: prompt },
  ];

  // Build call options with model routing
  const callOpts = {};
  if (model) {
    const parsed = parseModelSpec(model);
    if (parsed.provider) callOpts.provider = parsed.provider;
    if (parsed.model) callOpts.model = parsed.model;
  }

  const result = await callWithRetry(messages, [], callOpts);
  const content = result.content || "";

  const tasks = extractJSON(content);

  if (!Array.isArray(tasks)) {
    throw new Error(`Decompose returned non-array: ${typeof tasks}`);
  }

  // Validate and cap — max 10 calls per sub-task (was 15).
  // Keeping estimatedCalls low prevents the decomposer from packaging
  // too much work into one sub-agent, which causes context overload.
  const PER_TASK_CALL_CAP = 10;
  const validated = tasks.slice(0, maxSubTasks).map((t, i) => ({
    id: t.id || `t${i + 1}`,
    task: String(t.task || ""),
    scope: Array.isArray(t.scope) ? t.scope : [],
    estimatedCalls:
      typeof t.estimatedCalls === "number"
        ? Math.min(t.estimatedCalls, PER_TASK_CALL_CAP)
        : 8,
    priority: typeof t.priority === "number" ? t.priority : i + 1,
  }));

  const filtered = validated.filter((t) => t.task.length > 0);

  // Guard: if total estimated calls exceed a reasonable session budget,
  // warn so the caller can decide to re-decompose with more sub-tasks.
  const totalEstimated = filtered.reduce((s, t) => s + t.estimatedCalls, 0);
  const SESSION_BUDGET = 40;
  if (totalEstimated > SESSION_BUDGET) {
    const { debugLog: _dl } = require("./debug");
    _dl(
      `\x1b[33m  ⚠ Orchestrator: total estimated calls ${totalEstimated} > ${SESSION_BUDGET} — consider raising maxSubTasks\x1b[0m`,
    );
  }

  return filtered;
}

// ─── Synthesize ──────────────────────────────────────────────────────────────

/**
 * Synthesize sub-agent results into a unified summary.
 * @param {Array<{ task: string, status: string, result: string, toolsUsed: string[] }>} subTaskResults
 * @param {string} originalPrompt
 * @param {string} model - Orchestrator model spec
 * @returns {Promise<{ summary: string, conflicts: string[], commitMessage: string, filesChanged: string[] }>}
 */
async function synthesize(subTaskResults, originalPrompt, model) {
  if (!subTaskResults || subTaskResults.length === 0) {
    return {
      summary: "No sub-tasks were executed.",
      conflicts: [],
      commitMessage: "",
      filesChanged: [],
    };
  }

  // Format results for the prompt
  const resultsText = subTaskResults
    .map((r, i) => {
      const status =
        r.status === "done"
          ? "SUCCESS"
          : r.status === "truncated"
            ? "PARTIAL"
            : "FAILED";
      return `--- Agent ${i + 1} [${status}] ---\nTask: ${r.task}\nResult: ${r.result}\nTools: ${(r.toolsUsed || []).join(", ") || "none"}`;
    })
    .join("\n\n");

  const systemContent = SYNTHESIZE_PROMPT.replace(
    "{prompt}",
    originalPrompt,
  ).replace("{results}", resultsText);

  const messages = [
    { role: "system", content: systemContent },
    { role: "user", content: "Synthesize the sub-agent results above." },
  ];

  const callOpts = {};
  if (model) {
    const parsed = parseModelSpec(model);
    if (parsed.provider) callOpts.provider = parsed.provider;
    if (parsed.model) callOpts.model = parsed.model;
  }

  const result = await callWithRetry(messages, [], callOpts);
  const content = result.content || "";

  const synthesis = extractJSON(content);

  return {
    summary: String(synthesis.summary || ""),
    conflicts: Array.isArray(synthesis.conflicts) ? synthesis.conflicts : [],
    commitMessage: String(synthesis.commitMessage || ""),
    filesChanged: Array.isArray(synthesis.filesChanged)
      ? synthesis.filesChanged
      : [],
  };
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

/**
 * Run a full orchestrated multi-agent flow.
 *
 * This function orchestrates the complete workflow:
 * 1. Decomposes a complex prompt into independent sub-tasks
 * 2. Executes sub-tasks in parallel using worker agents
 * 3. Synthesizes results into a unified summary
 *
 * @param {string} prompt - The user's complex prompt containing multiple goals
 * @param {{
 *   orchestratorModel?: string,     - Model for decomposition/synthesis (e.g., 'kimi-k2.5')
 *   workerModel?: string,           - Model for executing sub-tasks (e.g., 'devstral-2:123b')
 *   maxParallel?: number,          - Maximum parallel workers (default: 3)
 *   maxSubTasks?: number,          - Maximum sub-tasks to create (default: 4)
 *   onProgress?: (status: string) => void, - Progress callback
 * }} opts - Configuration options
 * @returns {Promise<{
 *   results: Array,                          - Array of sub-agent results
 *   synthesis: object,                      - Synthesized summary with conflicts, commit message, etc.
 *   totalTokens: { input: number, output: number } - Token usage statistics
 * }>}
 *
 * @example
 * const result = await runOrchestrated('Fix bug A, add feature B, update docs', {
 *   orchestratorModel: 'kimi-k2.5',
 *   workerModel: 'devstral-2:123b',
 *   maxParallel: 3
 * });
 */
async function runOrchestrated(prompt, opts = {}) {
  const orchestratorModel =
    opts.orchestratorModel ||
    process.env.NEX_ORCHESTRATOR_MODEL ||
    DEFAULT_ORCHESTRATOR_MODEL;
  const workerModel = opts.workerModel || DEFAULT_WORKER_MODEL;
  const maxParallel = opts.maxParallel || DEFAULT_MAX_PARALLEL;
  const maxSubTasks = opts.maxSubTasks || DEFAULT_MAX_SUBTASKS;
  const onProgress = opts.onProgress || (() => {});

  const totalTokens = { input: 0, output: 0 };

  console.log(
    `\n${C.bold}Orchestrator${C.reset}  ${C.dim}model: ${orchestratorModel} | workers: ${workerModel} | max parallel: ${maxParallel}${C.reset}\n`,
  );

  // ── Phase 1: Decompose ─────────────────────────────────────
  onProgress("decomposing");
  console.log(
    `${C.dim}Phase 1: Decomposing prompt into sub-tasks...${C.reset}`,
  );

  let subTasks;
  try {
    subTasks = await decompose(prompt, orchestratorModel, { maxSubTasks });
  } catch (err) {
    console.log(`${C.red}Decompose failed: ${err.message}${C.reset}`);
    return {
      results: [],
      synthesis: {
        summary: `Decompose failed: ${err.message}`,
        conflicts: [],
        commitMessage: "",
        filesChanged: [],
      },
      totalTokens,
    };
  }

  if (subTasks.length === 0) {
    console.log(
      `${C.yellow}No sub-tasks generated. Prompt may be too simple for orchestration.${C.reset}`,
    );
    return {
      results: [],
      synthesis: {
        summary: "No sub-tasks generated.",
        conflicts: [],
        commitMessage: "",
        filesChanged: [],
      },
      totalTokens,
    };
  }

  console.log(
    `${C.green}Decomposed into ${subTasks.length} sub-tasks:${C.reset}`,
  );
  for (const st of subTasks) {
    console.log(`  ${C.dim}${st.id}:${C.reset} ${st.task}`);
    const scopeDisplay = st.scope.filter(Boolean);
    if (scopeDisplay.length > 0)
      console.log(`     ${C.dim}scope: ${scopeDisplay.join(", ")}${C.reset}`);
  }
  console.log("");

  // ── Phase 2: Execute sub-agents ────────────────────────────
  onProgress("executing");
  console.log(
    `${C.dim}Phase 2: Running ${subTasks.length} sub-agents (max ${maxParallel} parallel)...${C.reset}\n`,
  );

  const startTime = Date.now();
  const acquire = createSemaphore(maxParallel);

  // Shared scratch-pad: agents that finish early contribute findings that
  // later-starting or retrying agents can use to avoid duplication.
  const sharedContext = {
    findings: [], // Array of { agentId, summary, files }
    _lock: false,
  };

  // Pre-compute the best model for each sub-task based on task-type routing.
  // Falls back to workerModel if no routing configured for that category.
  const subTaskModels = subTasks.map((st) => {
    const category = detectCategory(st.task);
    const routed = category ? getModelForCategory(category.id) : null;
    return routed || workerModel;
  });

  const labels = subTasks.map(
    (st, i) =>
      `Agent ${i + 1} [${subTaskModels[i]}]: ${st.task.substring(0, 40)}${st.task.length > 40 ? "..." : ""}`,
  );
  const progress = new MultiProgress(labels);
  progress.start();

  const WORKER_SYSTEM_PROMPT = `
You are a focused coding agent executing ONE specific sub-task.
Your scope is limited to the files listed in your task definition.

CRITICAL RULE: Do not search for whether something exists before acting.
- If your task says "ensure X is in file Y" → read Y, add X if missing, done.
- If your task says "document X" → write the documentation now.
- Searching is only allowed to find WHERE to insert content, not WHETHER to insert.
- After max 3 tool calls: you must write/edit something or you have failed.

RULES:
- NEVER use external CLI tools for analysis (aspell, jq, sed, awk, grep for reading).
  Use read_file + your own reasoning instead.
- Be PROACTIVE: if something is missing, ADD it. Do not just search and report.
- If your task says "fix typos" — read the file, find typos yourself, edit them.
- If your task says "add X to README" — add it, don't check if it exists first.
- Max 10 tool calls. If you need more, you are doing too much — narrow your scope.
- When done: stop calling tools and write a one-line summary of what you changed.
`;

  const agentPromises = subTasks.map(async (st, idx) => {
    const release = await acquire();
    try {
      // Inject any findings from agents that have already completed
      const priorFindings = sharedContext.findings
        .filter((f) => f.agentId !== st.id)
        .map((f) => `Agent ${f.agentId} found: ${f.summary}`)
        .join("\n");

      const contextParts = [
        priorFindings ? `Prior agent findings:\n${priorFindings}\n` : "",
        st.scope.length > 0 ? `Focus on files: ${st.scope.join(", ")}` : "",
      ].filter(Boolean);

      // Model for this specific sub-task (routed by category)
      const taskModel = subTaskModels[idx];
      // Fallback model used on server/timeout errors — prefer a fast model
      const fallbackModel =
        process.env.NEX_FALLBACK_MODEL ||
        getModelForCategory("agentic") ||
        workerModel;

      let _retryAttempt = 0;
      const result = await withRetry(
        async () => {
          const isRetry = _retryAttempt > 0;
          if (isRetry) {
            progress.update(idx, "retry");
            process.stderr.write(
              `  ${C.dim}[Agent ${idx + 1}] retrying after error...${C.reset}\n`,
            );
          }
          _retryAttempt++;
          // On first retry, switch to fallback model to avoid repeating a timeout
          const activeModel = isRetry && taskModel !== fallbackModel ? fallbackModel : taskModel;
          return runSubAgent(
            {
              task: st.task,
              context:
                contextParts.length > 0 ? contextParts.join("\n") : undefined,
              max_iterations: Math.min(st.estimatedCalls || 10, 15),
              model: activeModel,
              _skipLog: true,
              _systemPrompt: WORKER_SYSTEM_PROMPT,
            },
            {
              onUpdate: (event) => {
                // Stream live tool-call activity to stderr when running in a TTY.
                // Skipped in piped/non-TTY contexts to keep output clean.
                if (
                  event &&
                  event.type === "tool_call" &&
                  process.stderr.isTTY
                ) {
                  const label = `  ${C.dim}[Agent ${idx + 1}] ${event.tool}${C.reset}`;
                  process.stderr.write(label + "\n");
                }
              },
            },
          );
        },
        1,
        2000,
      );

      // Contribute this agent's findings to the shared scratch-pad
      const resultSummary =
        typeof result.result === "string"
          ? result.result.slice(0, 200)
          : String(result.result || "").slice(0, 200);
      sharedContext.findings.push({
        agentId: st.id,
        summary: resultSummary,
        files: Array.isArray(st.scope) ? st.scope : [],
      });

      progress.update(idx, result.status === "failed" ? "error" : "done");
      totalTokens.input += result.tokensUsed?.input || 0;
      totalTokens.output += result.tokensUsed?.output || 0;
      if (result.tokensUsed?._estimated) totalTokens._estimated = true;
      return { ...result, _scope: st.scope, _idx: idx };
    } catch (err) {
      progress.update(idx, "error");
      return {
        task: st.task,
        status: "failed",
        result: `Error: ${err.message}`,
        toolsUsed: [],
        tokensUsed: { input: 0, output: 0 },
      };
    } finally {
      release();
    }
  });

  let results;
  try {
    results = await Promise.all(agentPromises);
  } finally {
    progress.stop({ silent: true });
    clearAllLocks();
  }

  // Reprint agent lines with scope info — replaces the progress bar output cleanly
  console.log("");
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const dur =
    elapsed >= 60
      ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
      : `${elapsed}s`;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const isSuccess =
      r.status === "done" ||
      (r.status === "truncated" && r.result && !r.result.startsWith("Error"));
    const icon = isSuccess
      ? `${C.green}\u2713${C.reset}`
      : `${C.red}\u2717${C.reset}`;
    const scopeParts =
      r._scope && r._scope.length > 0
        ? r._scope
            .map((f) => f.replace(/^.*\//, "").replace(/\/$/, ""))
            .filter(Boolean)
        : [];
    const scope =
      scopeParts.length > 0
        ? scopeParts.join(", ")
        : r.task.substring(0, 35) + (r.task.length > 35 ? "..." : "");
    const isLast = i === results.length - 1;
    console.log(
      `  ${icon} Agent ${i + 1}  ${C.dim}${scope}${C.reset}${isLast ? `   ${C.dim}${dur}${C.reset}` : ""}`,
    );
  }
  console.log("");

  // ── Phase 3: Synthesize ────────────────────────────────────
  onProgress("synthesizing");
  console.log(`${C.dim}Phase 3: Synthesizing results...${C.reset}`);

  let synthesis;
  try {
    synthesis = await synthesize(results, prompt, orchestratorModel);
  } catch (err) {
    console.log(
      `${C.yellow}Synthesize failed: ${err.message} — using raw results.${C.reset}`,
    );
    synthesis = {
      summary: results.map((r) => r.result).join("\n"),
      conflicts: [],
      commitMessage: "",
      filesChanged: [],
    };
  }

  // Detect whether agents shared context (findings from multiple agents
  // reference overlapping files)
  const allFiles = sharedContext.findings.flatMap((f) => f.files);
  const fileCounts = new Map();
  for (const f of allFiles) fileCounts.set(f, (fileCounts.get(f) || 0) + 1);
  const hasOverlap = [...fileCounts.values()].some((c) => c > 1);
  const sharedContextNote =
    sharedContext.findings.length > 1 && hasOverlap
      ? ` ${C.dim}(agents shared context)${C.reset}`
      : "";

  // Show synthesis
  console.log(
    `\n${C.bold}Summary:${C.reset} ${synthesis.summary}${sharedContextNote}`,
  );
  if (synthesis.conflicts.length > 0) {
    console.log(`${C.yellow}Conflicts:${C.reset}`);
    for (const c of synthesis.conflicts) console.log(`  - ${c}`);
  }
  if (synthesis.commitMessage) {
    console.log(
      `${C.dim}Suggested commit: ${synthesis.commitMessage}${C.reset}`,
    );
  }
  const tokenDisplay =
    totalTokens.input === 0 && totalTokens.output === 0
      ? "n/a (provider does not report token counts)"
      : totalTokens._estimated
        ? `~${totalTokens.input} input / ~${totalTokens.output} output (est.)`
        : `${totalTokens.input} input + ${totalTokens.output} output`;
  console.log(`${C.dim}Tokens: ${tokenDisplay}${C.reset}\n`);

  return { results, synthesis, totalTokens };
}

module.exports = {
  runOrchestrated,
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
  withRetry,
};

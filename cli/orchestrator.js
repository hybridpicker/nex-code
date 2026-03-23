/**
 * cli/orchestrator.js — Multi-Agent Orchestrator
 *
 * Decomposes complex multi-goal prompts into parallel sub-tasks,
 * runs them via sub-agent.js, and synthesizes results.
 *
 * Opt-in only: triggered via --orchestrate flag or /orchestrate command.
 */

'use strict';

const { callWithRetry, runSubAgent, clearAllLocks } = require('./sub-agent');
const { parseModelSpec, getActiveProviderName, getActiveModelId } = require('./providers/registry');
const { MultiProgress, C } = require('./ui');

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_PARALLEL = 3;   // SSH session limit
const DEFAULT_MAX_SUBTASKS = 4;
const DEFAULT_WORKER_MODEL = 'devstral-2:123b';
const DEFAULT_ORCHESTRATOR_MODEL = 'kimi-k2.5';

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

// ─── Concurrency Control ─────────────────────────────────────────────────────

/**
 * Simple Promise-based semaphore for limiting concurrent operations.
 * @param {number} limit - Maximum concurrent operations
 * @returns {function(): Promise<function(): void>} acquire function that returns a release callback
 */
function createSemaphore(limit) {
  let active = 0;
  const queue = [];

  return function acquire() {
    return new Promise(resolve => {
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
 * Heuristic check whether a prompt contains multiple distinct goals.
 * @param {string} prompt
 * @returns {{ isComplex: boolean, estimatedGoals: number, reason: string }}
 */
function detectComplexPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { isComplex: false, estimatedGoals: 0, reason: 'empty' };
  }

  let goals = 0;
  const reasons = [];

  // Numbered list items: "1.", "2.", "(1)", "(a)"
  const numberedItems = prompt.match(/(?:^|\n)\s*(?:\d+[.)]\s|[(]\d+[)]\s|[(][a-z][)]\s)/g);
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
  const semicolonParts = prompt.split(/;\s*/).filter(p => p.trim().length > 10);
  if (semicolonParts.length >= 3) {
    goals = Math.max(goals, semicolonParts.length);
    reasons.push(`${semicolonParts.length} semicolon-separated goals`);
  }

  // Goal keywords: "also", "additionally", "and fix", "and add", "and update"
  const alsoMatches = prompt.match(/\b(also|additionally|and\s+(?:fix|add|update|create|implement|remove|refactor))\b/gi);
  if (alsoMatches && alsoMatches.length >= 2) {
    goals = Math.max(goals, alsoMatches.length + 1);
    reasons.push(`${alsoMatches.length} transition keywords`);
  }

  const isComplex = goals >= 3;
  return {
    isComplex,
    estimatedGoals: goals,
    reason: reasons.length > 0 ? reasons.join(', ') : 'single goal',
  };
}

// ─── JSON Extraction ─────────────────────────────────────────────────────────

/**
 * Extract JSON from an LLM response that may include markdown fences or text.
 * @param {string} text
 * @returns {any} parsed JSON
 * @throws {Error} if no valid JSON found
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response from orchestrator model');
  }

  // Try direct parse first
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch { /* continue */ }

  // Extract from markdown code block
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch { /* continue */ }
  }

  // Find first [ or { and try to parse from there
  const firstBracket = trimmed.search(/[[\{]/);
  if (firstBracket >= 0) {
    const candidate = trimmed.slice(firstBracket);
    try {
      return JSON.parse(candidate);
    } catch { /* continue */ }
  }

  throw new Error(`Could not extract valid JSON from response:\n${trimmed.slice(0, 200)}`);
}

// ─── Decompose ───────────────────────────────────────────────────────────────

/**
 * Decompose a complex prompt into independent sub-tasks via an LLM call.
 * @param {string} prompt - The user's complex prompt
 * @param {string} model - Orchestrator model spec (e.g. 'kimi-k2.5')
 * @param {{ maxSubTasks?: number }} opts
 * @returns {Promise<Array<{ id: string, task: string, scope: string[], estimatedCalls: number, priority: number }>>}
 */
async function decompose(prompt, model, opts = {}) {
  const maxSubTasks = opts.maxSubTasks || DEFAULT_MAX_SUBTASKS;

  const systemContent = DECOMPOSE_PROMPT
    .replace('{maxSubTasks}', String(maxSubTasks))
    .replace('{prompt}', prompt);

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: prompt },
  ];

  // Build call options with model routing
  const callOpts = {};
  if (model) {
    const parsed = parseModelSpec(model);
    if (parsed.provider) callOpts.provider = parsed.provider;
    if (parsed.model) callOpts.model = parsed.model;
  }

  const result = await callWithRetry(messages, [], callOpts);
  const content = result.content || '';

  const tasks = extractJSON(content);

  if (!Array.isArray(tasks)) {
    throw new Error(`Decompose returned non-array: ${typeof tasks}`);
  }

  // Validate and cap
  const validated = tasks.slice(0, maxSubTasks).map((t, i) => ({
    id: t.id || `t${i + 1}`,
    task: String(t.task || ''),
    scope: Array.isArray(t.scope) ? t.scope : [],
    estimatedCalls: typeof t.estimatedCalls === 'number' ? Math.min(t.estimatedCalls, 15) : 10,
    priority: typeof t.priority === 'number' ? t.priority : i + 1,
  }));

  // Filter out empty tasks
  return validated.filter(t => t.task.length > 0);
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
      summary: 'No sub-tasks were executed.',
      conflicts: [],
      commitMessage: '',
      filesChanged: [],
    };
  }

  // Format results for the prompt
  const resultsText = subTaskResults.map((r, i) => {
    const status = r.status === 'done' ? 'SUCCESS' : r.status === 'truncated' ? 'PARTIAL' : 'FAILED';
    return `--- Agent ${i + 1} [${status}] ---\nTask: ${r.task}\nResult: ${r.result}\nTools: ${(r.toolsUsed || []).join(', ') || 'none'}`;
  }).join('\n\n');

  const systemContent = SYNTHESIZE_PROMPT
    .replace('{prompt}', originalPrompt)
    .replace('{results}', resultsText);

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: 'Synthesize the sub-agent results above.' },
  ];

  const callOpts = {};
  if (model) {
    const parsed = parseModelSpec(model);
    if (parsed.provider) callOpts.provider = parsed.provider;
    if (parsed.model) callOpts.model = parsed.model;
  }

  const result = await callWithRetry(messages, [], callOpts);
  const content = result.content || '';

  const synthesis = extractJSON(content);

  return {
    summary: String(synthesis.summary || ''),
    conflicts: Array.isArray(synthesis.conflicts) ? synthesis.conflicts : [],
    commitMessage: String(synthesis.commitMessage || ''),
    filesChanged: Array.isArray(synthesis.filesChanged) ? synthesis.filesChanged : [],
  };
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

/**
 * Run a full orchestrated multi-agent flow.
 * @param {string} prompt
 * @param {{
 *   orchestratorModel?: string,
 *   workerModel?: string,
 *   maxParallel?: number,
 *   maxSubTasks?: number,
 *   onProgress?: (status: string) => void,
 * }} opts
 * @returns {Promise<{ results: Array, synthesis: object, totalTokens: { input: number, output: number } }>}
 */
async function runOrchestrated(prompt, opts = {}) {
  const orchestratorModel = opts.orchestratorModel
    || process.env.NEX_ORCHESTRATOR_MODEL
    || DEFAULT_ORCHESTRATOR_MODEL;
  const workerModel = opts.workerModel || DEFAULT_WORKER_MODEL;
  const maxParallel = opts.maxParallel || DEFAULT_MAX_PARALLEL;
  const maxSubTasks = opts.maxSubTasks || DEFAULT_MAX_SUBTASKS;
  const onProgress = opts.onProgress || (() => {});

  const totalTokens = { input: 0, output: 0 };

  console.log(`\n${C.bold}Orchestrator${C.reset}  ${C.dim}model: ${orchestratorModel} | workers: ${workerModel} | max parallel: ${maxParallel}${C.reset}\n`);

  // ── Phase 1: Decompose ─────────────────────────────────────
  onProgress('decomposing');
  console.log(`${C.dim}Phase 1: Decomposing prompt into sub-tasks...${C.reset}`);

  let subTasks;
  try {
    subTasks = await decompose(prompt, orchestratorModel, { maxSubTasks });
  } catch (err) {
    console.log(`${C.red}Decompose failed: ${err.message}${C.reset}`);
    return { results: [], synthesis: { summary: `Decompose failed: ${err.message}`, conflicts: [], commitMessage: '', filesChanged: [] }, totalTokens };
  }

  if (subTasks.length === 0) {
    console.log(`${C.yellow}No sub-tasks generated. Prompt may be too simple for orchestration.${C.reset}`);
    return { results: [], synthesis: { summary: 'No sub-tasks generated.', conflicts: [], commitMessage: '', filesChanged: [] }, totalTokens };
  }

  console.log(`${C.green}Decomposed into ${subTasks.length} sub-tasks:${C.reset}`);
  for (const st of subTasks) {
    console.log(`  ${C.dim}${st.id}:${C.reset} ${st.task}`);
    if (st.scope.length > 0) console.log(`     ${C.dim}scope: ${st.scope.join(', ')}${C.reset}`);
  }
  console.log('');

  // ── Phase 2: Execute sub-agents ────────────────────────────
  onProgress('executing');
  console.log(`${C.dim}Phase 2: Running ${subTasks.length} sub-agents (max ${maxParallel} parallel)...${C.reset}\n`);

  const acquire = createSemaphore(maxParallel);

  const labels = subTasks.map((st, i) =>
    `Agent ${i + 1} [${workerModel}]: ${st.task.substring(0, 40)}${st.task.length > 40 ? '...' : ''}`
  );
  const progress = new MultiProgress(labels);
  progress.start();

  const agentPromises = subTasks.map(async (st, idx) => {
    const release = await acquire();
    try {
      const result = await runSubAgent({
        task: st.task,
        context: st.scope.length > 0 ? `Focus on files: ${st.scope.join(', ')}` : undefined,
        max_iterations: Math.min(st.estimatedCalls || 10, 15),
        model: workerModel,
        _skipLog: true,
      }, {
        onUpdate: () => {},
      });

      progress.update(idx, result.status === 'failed' ? 'error' : 'done');
      totalTokens.input += result.tokensUsed.input;
      totalTokens.output += result.tokensUsed.output;
      return result;
    } catch (err) {
      progress.update(idx, 'error');
      return {
        task: st.task,
        status: 'failed',
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
    progress.stop();
    clearAllLocks();
  }

  // Show results summary
  console.log('');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const icon = r.status === 'done' ? `${C.green}\u2713${C.reset}` : r.status === 'truncated' ? `${C.yellow}\u26A0${C.reset}` : `${C.red}\u2717${C.reset}`;
    console.log(`${icon} Agent ${i + 1}: ${r.task.substring(0, 60)}`);
  }
  console.log('');

  // ── Phase 3: Synthesize ────────────────────────────────────
  onProgress('synthesizing');
  console.log(`${C.dim}Phase 3: Synthesizing results...${C.reset}`);

  let synthesis;
  try {
    synthesis = await synthesize(results, prompt, orchestratorModel);
  } catch (err) {
    console.log(`${C.yellow}Synthesize failed: ${err.message} — using raw results.${C.reset}`);
    synthesis = {
      summary: results.map(r => r.result).join('\n'),
      conflicts: [],
      commitMessage: '',
      filesChanged: [],
    };
  }

  // Show synthesis
  console.log(`\n${C.bold}Summary:${C.reset} ${synthesis.summary}`);
  if (synthesis.conflicts.length > 0) {
    console.log(`${C.yellow}Conflicts:${C.reset}`);
    for (const c of synthesis.conflicts) console.log(`  - ${c}`);
  }
  if (synthesis.commitMessage) {
    console.log(`${C.dim}Suggested commit: ${synthesis.commitMessage}${C.reset}`);
  }
  console.log(`${C.dim}Tokens: ${totalTokens.input} input + ${totalTokens.output} output${C.reset}\n`);

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
};

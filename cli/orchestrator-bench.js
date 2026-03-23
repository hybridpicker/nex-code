/**
 * cli/orchestrator-bench.js — Orchestrator Model Benchmark
 *
 * Tests how well models decompose complex prompts and synthesize results.
 * Does NOT spawn actual sub-agents — only evaluates LLM output quality.
 */

'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const { callWithRetry } = require('./sub-agent');
const { parseModelSpec } = require('./providers/registry');
const { extractJSON, DECOMPOSE_PROMPT, SYNTHESIZE_PROMPT } = require('./orchestrator');
const { C } = require('./ui');

const RESULTS_PATH = path.join(os.homedir(), '.nex-code', 'orchestrator-bench.json');

// ─── Scenarios ───────────────────────────────────────────────────────────────

const ORCHESTRATOR_SCENARIOS = [
  {
    id: 'decompose_multi_bug',
    type: 'decompose',
    prompt: 'Fix 4 bugs: (1) 500 error on SmartThings API call, (2) invalid time format on Sunday schedule, (3) Google Auth callback fails with CORS, (4) contact search returns empty',
    expectedSubTasks: 4,
    maxSubTasks: 5,
  },
  {
    id: 'decompose_feature_mix',
    type: 'decompose',
    prompt: 'Add dark mode toggle to settings page, fix the broken login redirect, improve search performance by adding an index, update API docs for the new endpoints',
    expectedSubTasks: 4,
    maxSubTasks: 5,
  },
  {
    id: 'decompose_overlapping',
    type: 'decompose',
    prompt: 'Refactor auth.js to use JWT instead of sessions, update all tests that import auth.js, and add rate limiting to the login endpoint in auth.js',
    expectedSubTasks: 3,
    maxSubTasks: 4,
  },
  {
    id: 'decompose_single',
    type: 'decompose',
    prompt: 'Fix the broken CSS on the login page — the submit button is not aligned',
    expectedSubTasks: 1,
    maxSubTasks: 4,
  },
  {
    id: 'synthesize_clean',
    type: 'synthesize',
    prompt: 'Fix login and search bugs',
    subResults: [
      { task: 'Fix login redirect', status: 'done', result: 'Changed auth.js line 42: fixed redirect URL to use req.originalUrl instead of hardcoded /', toolsUsed: ['read_file', 'edit_file'] },
      { task: 'Fix search index', status: 'done', result: 'Added index on users.email column in migration 20260323. Updated search.js to use indexed query.', toolsUsed: ['write_file', 'edit_file'] },
    ],
    expectedConflicts: 0,
  },
  {
    id: 'synthesize_conflicts',
    type: 'synthesize',
    prompt: 'Fix config loading and add env validation',
    subResults: [
      { task: 'Fix config loading', status: 'done', result: 'Modified config.js: changed loadConfig() to handle missing .env gracefully', toolsUsed: ['edit_file'] },
      { task: 'Add env validation', status: 'done', result: 'Modified config.js: added validateEnv() function that throws on missing required vars', toolsUsed: ['edit_file'] },
    ],
    expectedConflicts: 1,
  },
];

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Score a decompose result (0-10).
 * @param {Array} result - Parsed sub-tasks from the model
 * @param {object} scenario - The scenario definition
 * @returns {number} Score 0-10
 */
function scoreDecompose(result, scenario) {
  if (!Array.isArray(result)) return 0;

  let score = 0;

  // JSON validity (already parsed, so 1.5 points)
  score += 1.5;

  // Correct sub-task count (3 points)
  const countDiff = Math.abs(result.length - scenario.expectedSubTasks);
  if (countDiff === 0) score += 3;
  else if (countDiff === 1) score += 1.5;

  // Required fields present (2 points)
  const hasRequiredFields = result.every(t =>
    t.task && typeof t.task === 'string' && t.task.length > 0
  );
  if (hasRequiredFields) score += 2;

  // No overlapping scopes (2 points)
  const allScopes = result.flatMap(t => Array.isArray(t.scope) ? t.scope : []);
  const uniqueScopes = new Set(allScopes);
  if (allScopes.length === uniqueScopes.size) score += 2;

  // Reasonable estimatedCalls (1.5 points)
  const hasEstimates = result.every(t =>
    typeof t.estimatedCalls === 'number' || typeof t.estimatedSshCalls === 'number'
  );
  if (hasEstimates) score += 1.5;

  return Math.min(10, Math.round(score * 10) / 10);
}

/**
 * Score a synthesize result (0-10).
 * @param {object} result - Parsed synthesis from the model
 * @param {object} scenario - The scenario definition
 * @returns {number} Score 0-10
 */
function scoreSynthesize(result, scenario) {
  if (!result || typeof result !== 'object') return 0;

  let score = 0;

  // JSON validity (1.5 points)
  score += 1.5;

  // Has summary (2 points)
  if (result.summary && result.summary.length > 10) score += 2;

  // Has commitMessage (2 points)
  if (result.commitMessage && result.commitMessage.length > 5) score += 2;

  // Conflict detection accuracy (2.5 points)
  const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
  if (scenario.expectedConflicts === 0 && conflicts.length === 0) score += 2.5;
  else if (scenario.expectedConflicts > 0 && conflicts.length > 0) score += 2.5;
  else if (scenario.expectedConflicts > 0 && conflicts.length === 0) score += 0;

  // Has filesChanged (2 points)
  if (Array.isArray(result.filesChanged) && result.filesChanged.length > 0) score += 2;

  return Math.min(10, Math.round(score * 10) / 10);
}

// ─── Benchmark Runner ────────────────────────────────────────────────────────

/**
 * Run a single scenario against a model.
 * @param {object} scenario
 * @param {string} modelSpec
 * @returns {Promise<{ score: number, latencyMs: number, error?: string }>}
 */
async function runScenario(scenario, modelSpec) {
  const callOpts = {};
  if (modelSpec) {
    const parsed = parseModelSpec(modelSpec);
    if (parsed.provider) callOpts.provider = parsed.provider;
    if (parsed.model) callOpts.model = parsed.model;
  }

  const start = Date.now();

  try {
    if (scenario.type === 'decompose') {
      const systemContent = DECOMPOSE_PROMPT
        .replace('{maxSubTasks}', String(scenario.maxSubTasks))
        .replace('{prompt}', scenario.prompt);

      const result = await callWithRetry(
        [{ role: 'system', content: systemContent }, { role: 'user', content: scenario.prompt }],
        [],
        callOpts
      );

      const parsed = extractJSON(result.content || '');
      const latencyMs = Date.now() - start;
      const score = scoreDecompose(parsed, scenario);
      return { score, latencyMs };
    }

    if (scenario.type === 'synthesize') {
      const resultsText = scenario.subResults.map((r, i) => {
        const status = r.status === 'done' ? 'SUCCESS' : 'FAILED';
        return `--- Agent ${i + 1} [${status}] ---\nTask: ${r.task}\nResult: ${r.result}\nTools: ${r.toolsUsed.join(', ')}`;
      }).join('\n\n');

      const systemContent = SYNTHESIZE_PROMPT
        .replace('{prompt}', scenario.prompt)
        .replace('{results}', resultsText);

      const result = await callWithRetry(
        [{ role: 'system', content: systemContent }, { role: 'user', content: 'Synthesize the sub-agent results above.' }],
        [],
        callOpts
      );

      const parsed = extractJSON(result.content || '');
      const latencyMs = Date.now() - start;
      const score = scoreSynthesize(parsed, scenario);
      return { score, latencyMs };
    }

    return { score: 0, latencyMs: 0, error: `Unknown scenario type: ${scenario.type}` };
  } catch (err) {
    return { score: 0, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Run the full orchestrator benchmark across multiple models.
 * @param {{ models?: string[], onProgress?: function }} opts
 * @returns {Promise<Array<{ model: string, decompose: number, synthesize: number, avgLatency: number, overall: number }>>}
 */
async function runOrchestratorBenchmark(opts = {}) {
  const models = opts.models || ['kimi-k2.5', 'qwen3.5:397b', 'minimax-m2.7:cloud'];
  const onProgress = opts.onProgress || (() => {});
  const allResults = [];

  for (const model of models) {
    const modelResults = { model, scores: [], latencies: [] };
    const decomposeScores = [];
    const synthesizeScores = [];

    for (const scenario of ORCHESTRATOR_SCENARIOS) {
      onProgress({ model, scenario: scenario.id, done: false });
      const result = await runScenario(scenario, model);

      modelResults.scores.push(result.score);
      modelResults.latencies.push(result.latencyMs);

      if (scenario.type === 'decompose') decomposeScores.push(result.score);
      if (scenario.type === 'synthesize') synthesizeScores.push(result.score);

      onProgress({ model, scenario: scenario.id, done: true, score: result.score, error: result.error });
    }

    const avgDecompose = decomposeScores.length > 0
      ? decomposeScores.reduce((a, b) => a + b, 0) / decomposeScores.length
      : 0;
    const avgSynthesize = synthesizeScores.length > 0
      ? synthesizeScores.reduce((a, b) => a + b, 0) / synthesizeScores.length
      : 0;
    const avgLatency = modelResults.latencies.reduce((a, b) => a + b, 0) / modelResults.latencies.length;
    const overall = (avgDecompose * 0.6 + avgSynthesize * 0.4);

    allResults.push({
      model,
      decompose: Math.round(avgDecompose * 10) / 10,
      synthesize: Math.round(avgSynthesize * 10) / 10,
      avgLatency: Math.round(avgLatency),
      overall: Math.round(overall * 10) / 10,
    });
  }

  // Sort by overall score descending
  allResults.sort((a, b) => b.overall - a.overall);

  // Save results
  const dir = path.dirname(RESULTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify({
    date: new Date().toISOString().slice(0, 10),
    results: allResults,
  }, null, 2));

  return allResults;
}

/**
 * Print benchmark results as a formatted table.
 * @param {Array} results
 */
function printResults(results) {
  console.log(`\n${C.bold}${C.cyan}Orchestrator Model Benchmark${C.reset}\n`);

  const header = `  ${'Model'.padEnd(25)} ${'Decompose'.padEnd(10)} ${'Synthesize'.padEnd(11)} ${'Speed'.padEnd(8)} ${'Score'.padEnd(8)}`;
  console.log(`${C.dim}${header}${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(65)}${C.reset}`);

  for (const r of results) {
    const medal = results.indexOf(r) === 0 ? '\u{1F947}' : results.indexOf(r) === 1 ? '\u{1F948}' : results.indexOf(r) === 2 ? '\u{1F949}' : ' ';
    const latencyStr = `${(r.avgLatency / 1000).toFixed(1)}s`;
    console.log(`${medal} ${r.model.padEnd(25)} ${String(r.decompose + '/10').padEnd(10)} ${String(r.synthesize + '/10').padEnd(11)} ${latencyStr.padEnd(8)} ${C.bold}${r.overall}/10${C.reset}`);
  }

  if (results.length > 0) {
    console.log(`\n  ${C.green}Best orchestrator: ${results[0].model} (${results[0].overall}/10)${C.reset}`);
    console.log(`  ${C.dim}Saved to ${RESULTS_PATH}${C.reset}\n`);
  }
}

module.exports = {
  runOrchestratorBenchmark,
  ORCHESTRATOR_SCENARIOS,
  scoreDecompose,
  scoreSynthesize,
  runScenario,
  printResults,
  RESULTS_PATH,
};

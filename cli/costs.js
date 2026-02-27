/**
 * cli/costs.js — Token Cost Tracking + Dashboard
 * Tracks token usage per provider/model and estimates session costs.
 */

const PRICING = {
  'openai': {
    'gpt-4o':        { input: 2.50,  output: 10.00 },
    'gpt-4o-mini':   { input: 0.15,  output: 0.60 },
    'gpt-4.1':       { input: 2.00,  output: 8.00 },
    'gpt-4.1-mini':  { input: 0.40,  output: 1.60 },
    'gpt-4.1-nano':  { input: 0.10,  output: 0.40 },
    'o1':            { input: 15.00, output: 60.00 },
    'o3':            { input: 10.00, output: 40.00 },
    'o3-mini':       { input: 1.10,  output: 4.40 },
    'o4-mini':       { input: 1.10,  output: 4.40 },
  },
  'anthropic': {
    'claude-sonnet':     { input: 3.00,  output: 15.00 },
    'claude-sonnet-4-5': { input: 3.00,  output: 15.00 },
    'claude-opus':       { input: 15.00, output: 75.00 },
    'claude-haiku':      { input: 0.80,  output: 4.00 },
    'claude-3-5-sonnet': { input: 3.00,  output: 15.00 },
  },
  'gemini': {
    'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
    'gemini-2.5-flash':      { input: 0.15,  output: 0.60 },
    'gemini-2.0-flash':      { input: 0.10,  output: 0.40 },
    'gemini-2.0-flash-lite': { input: 0.075, output: 0.30 },
  },
  'ollama': {
    'kimi-k2.5':      { input: 0, output: 0 },
    'qwen3-coder':    { input: 0, output: 0 },
    'deepseek-r1':    { input: 0, output: 0 },
    'llama-4-scout':  { input: 0, output: 0 },
    'qwen3-30b-a3b':  { input: 0, output: 0 },
    'devstral':       { input: 0, output: 0 },
  },
  'local': {},
};

// Session usage accumulator
let usageLog = [];

/**
 * Track token usage for a single API call.
 * @param {string} provider
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 */
function trackUsage(provider, model, inputTokens, outputTokens) {
  usageLog.push({ provider, model, input: inputTokens, output: outputTokens });
}

/**
 * Get pricing for a provider/model pair.
 * Returns { input: 0, output: 0 } for unknown models.
 */
function getPricing(provider, model) {
  const providerPricing = PRICING[provider];
  if (!providerPricing) return { input: 0, output: 0 };
  return providerPricing[model] || { input: 0, output: 0 };
}

/**
 * Calculate cost for a single usage entry.
 */
function calcCost(entry) {
  const pricing = getPricing(entry.provider, entry.model);
  return (entry.input * pricing.input + entry.output * pricing.output) / 1_000_000;
}

/**
 * Get aggregated session costs.
 * @returns {{ totalCost: number, totalInput: number, totalOutput: number, breakdown: Array }}
 */
function getSessionCosts() {
  const byKey = {};

  for (const entry of usageLog) {
    const key = `${entry.provider}:${entry.model}`;
    if (!byKey[key]) {
      byKey[key] = { provider: entry.provider, model: entry.model, input: 0, output: 0 };
    }
    byKey[key].input += entry.input;
    byKey[key].output += entry.output;
  }

  const breakdown = Object.values(byKey).map((b) => ({
    ...b,
    cost: calcCost(b),
  }));

  const totalCost = breakdown.reduce((sum, b) => sum + b.cost, 0);
  const totalInput = breakdown.reduce((sum, b) => sum + b.input, 0);
  const totalOutput = breakdown.reduce((sum, b) => sum + b.output, 0);

  return { totalCost, totalInput, totalOutput, breakdown };
}

/**
 * Format costs for display (/costs command).
 * @returns {string}
 */
function formatCosts() {
  const { totalCost, totalInput, totalOutput, breakdown } = getSessionCosts();

  if (breakdown.length === 0) {
    return 'No token usage recorded this session.';
  }

  const lines = [];
  lines.push('Session Token Usage:');
  lines.push('');

  for (const b of breakdown) {
    const costStr = b.cost > 0 ? `$${b.cost.toFixed(4)}` : 'free';
    lines.push(`  ${b.provider}:${b.model}`);
    lines.push(`    Input:  ${b.input.toLocaleString()} tokens`);
    lines.push(`    Output: ${b.output.toLocaleString()} tokens`);
    lines.push(`    Cost:   ${costStr}`);
  }

  lines.push('');
  lines.push(`  Total: ${totalInput.toLocaleString()} in + ${totalOutput.toLocaleString()} out = $${totalCost.toFixed(4)}`);

  return lines.join('\n');
}

/**
 * Format a short cost hint for inline display after responses.
 * @returns {string} e.g. "[~$0.003]" or "" if free
 */
function formatCostHint(provider, model, inputTokens, outputTokens) {
  const pricing = getPricing(provider, model);
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  if (cost <= 0) return '';
  return `[~$${cost.toFixed(4)}]`;
}

/**
 * Reset all tracked usage (for testing or new sessions).
 */
function resetCosts() {
  usageLog = [];
}

module.exports = {
  PRICING,
  trackUsage,
  getSessionCosts,
  formatCosts,
  formatCostHint,
  resetCosts,
  getPricing,
};

/**
 * cli/model-profiles.js — Per-Model Guard Constants
 * Each model family gets tuned thresholds for stale detection,
 * investigation caps, and post-edit budgets.
 */

const PROFILES = {
  "devstral-2": {
    staleWarn: 30000,
    staleAbort: 90000,
    investigationCap: 12,
    postEditCap: 10,
    briefing: `You are devstral-2, a strong coding model optimized for agentic tasks.
Use tools confidently and without hesitation — tool use is the expected workflow.
You excel at sysadmin, frontend, and multi-step coding tasks.
Prefer action over narration — read, fix, verify, done.`,
  },
  "devstral-small": {
    staleWarn: 20000,
    staleAbort: 60000,
    investigationCap: 10,
    postEditCap: 8,
    briefing: `You are devstral-small, a fast and lightweight coding model.
Be decisive — read only what you need, then fix immediately.
Keep investigation short: identify the target file, edit it, move on.`,
  },
  "qwen3-coder": {
    staleWarn: 60000,
    staleAbort: 180000,
    investigationCap: 15,
    postEditCap: 12,
    briefing: `You are qwen3-coder, a top-ranked model for complex multi-step tasks.
Trust your reasoning and use tools thoroughly when the task demands it.
You handle large codebases and data tasks well — don't cut corners prematurely.`,
  },
  "kimi-k2": {
    staleWarn: 45000,
    staleAbort: 120000,
    investigationCap: 15,
    postEditCap: 12,
    briefing: `You are kimi-k2, a large-context model with strong reasoning.
Use your context window effectively — read broadly when needed, then act decisively.
Focus on correctness over speed.`,
  },
  "ministral-3": {
    staleWarn: 20000,
    staleAbort: 60000,
    investigationCap: 10,
    postEditCap: 8,
    briefing: `You are ministral-3, one of the fastest coding models available.
Prioritize decisive, targeted edits. Read only what you need, then fix.
Stay on-scope — your strength is focused, efficient coding tasks.`,
  },
  "qwen3-vl": {
    staleWarn: 60000,
    staleAbort: 180000,
    investigationCap: 15,
    postEditCap: 12,
    briefing: `You are qwen3-vl, the highest-ranked model for data, frontend, and agentic tasks.
Trust your reasoning. Use tools thoroughly when the task demands it.
You handle complex multi-step tasks well — don't cut corners prematurely.`,
  },
};

const DEFAULTS = {
  staleWarn: 60000,
  staleAbort: 120000,
  investigationCap: 12,
  postEditCap: 10,
};

/**
 * Get the guard profile for a model ID.
 * Fuzzy-matches on model family prefix (e.g. "devstral-2:123b" → "devstral-2").
 * ENV overrides (NEX_STALE_WARN_MS, NEX_STALE_ABORT_MS) always take precedence.
 * @param {string} modelId — full model identifier (e.g. "devstral-2:123b")
 * @returns {{ staleWarn: number, staleAbort: number, investigationCap: number, postEditCap: number }}
 */
function getModelProfile(modelId) {
  const id = (modelId || "").toLowerCase();

  // Find the longest matching profile key
  let match = null;
  let matchLen = 0;
  for (const key of Object.keys(PROFILES)) {
    if (id.startsWith(key) && key.length > matchLen) {
      match = key;
      matchLen = key.length;
    }
  }

  const base = match ? { ...PROFILES[match] } : { ...DEFAULTS };

  // ENV overrides always win (validated: must be integer in [1000, 300000])
  for (const [envKey, field] of [["NEX_STALE_WARN_MS", "staleWarn"], ["NEX_STALE_ABORT_MS", "staleAbort"]]) {
    if (process.env[envKey]) {
      const parsed = parseInt(process.env[envKey], 10);
      if (Number.isInteger(parsed) && parsed >= 1000 && parsed <= 300000) {
        base[field] = parsed;
      }
    }
  }

  return base;
}

/**
 * Get the briefing string for a model ID.
 * Returns an empty string if no briefing is defined.
 * @param {string} modelId
 * @returns {string}
 */
function getModelBriefing(modelId) {
  const id = (modelId || "").toLowerCase();

  let match = null;
  let matchLen = 0;
  for (const key of Object.keys(PROFILES)) {
    if (id.startsWith(key) && key.length > matchLen) {
      match = key;
      matchLen = key.length;
    }
  }

  return (match && PROFILES[match].briefing) || "";
}

module.exports = { getModelProfile, getModelBriefing, PROFILES, DEFAULTS };

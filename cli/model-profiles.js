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
  },
  "devstral-small": {
    staleWarn: 20000,
    staleAbort: 60000,
    investigationCap: 10,
    postEditCap: 8,
  },
  "qwen3-coder": {
    staleWarn: 60000,
    staleAbort: 180000,
    investigationCap: 15,
    postEditCap: 12,
  },
  "kimi-k2": {
    staleWarn: 45000,
    staleAbort: 120000,
    investigationCap: 15,
    postEditCap: 12,
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

module.exports = { getModelProfile, PROFILES, DEFAULTS };

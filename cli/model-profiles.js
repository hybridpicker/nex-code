/**
 * cli/model-profiles.js — Per-Model Guard Constants
 * Each model family gets tuned thresholds for stale detection,
 * investigation caps, and post-edit budgets.
 */

// Stale thresholds doubled for Ollama Cloud reliability.
// Ollama Cloud has variable latency — aggressive abort causes premature task termination.
// The model gets the time it needs; stale auto-switch falls back to a faster model instead.
const PROFILES = {
  "qwen3-coder:480b": {
    staleWarn: 150000,
    staleAbort: 300000,
    investigationCap: 18,
    postEditCap: 14,
    investigationGrace: 8,
    targetedReadHardCap: 12,
    phaseTargetedReadHardCap: 14,
    scrollWarnSections: 3,
    scrollBlockSections: 4,
    briefing: `You are qwen3-coder:480b, a frontier coding model for large and complex edits.
Read broadly only when it unlocks a real implementation decision, then switch to action.
Avoid repeated reads of the same file — once you have the file, use that context and edit decisively.`,
  },
  "devstral-2": {
    staleWarn: 60000,
    staleAbort: 180000,
    investigationCap: 14,
    postEditCap: 10,
    investigationGrace: 5,
    targetedReadHardCap: 9,
    phaseTargetedReadHardCap: 11,
    scrollWarnSections: 2,
    scrollBlockSections: 3,
    briefing: `You are devstral-2, a strong coding model optimized for agentic tasks.
Use tools confidently and without hesitation — tool use is the expected workflow.
You excel at sysadmin, frontend, and multi-step coding tasks.
Prefer action over narration — read, fix, verify, done.`,
  },
  "devstral-small": {
    staleWarn: 40000,
    staleAbort: 120000,
    investigationCap: 8,
    postEditCap: 6,
    investigationGrace: 3,
    targetedReadHardCap: 6,
    phaseTargetedReadHardCap: 7,
    scrollWarnSections: 1,
    scrollBlockSections: 2,
    briefing: `You are devstral-small, a fast and lightweight coding model.
Be decisive — read only what you need, then fix immediately.
Keep investigation short: identify the target file, read it once, edit it, move on.`,
  },
  "qwen3-coder": {
    staleWarn: 120000,
    staleAbort: 300000,
    investigationCap: 15,
    postEditCap: 12,
    investigationGrace: 7,
    targetedReadHardCap: 11,
    phaseTargetedReadHardCap: 13,
    scrollWarnSections: 3,
    scrollBlockSections: 4,
    briefing: `You are qwen3-coder, a top-ranked model for complex multi-step tasks.
Trust your reasoning and use tools thoroughly when the task demands it.
You handle large codebases and data tasks well — don't cut corners prematurely, but do not re-read the same file once it is in context.`,
  },
  "kimi-k2": {
    staleWarn: 120000,
    staleAbort: 300000,
    investigationCap: 17,
    postEditCap: 12,
    investigationGrace: 7,
    targetedReadHardCap: 11,
    phaseTargetedReadHardCap: 13,
    scrollWarnSections: 3,
    scrollBlockSections: 4,
    briefing: `You are kimi-k2, a large-context model with strong reasoning.
Use your context window effectively — read broadly when needed, then act decisively.
Focus on correctness over speed.`,
  },
  "kimi-k2-thinking": {
    staleWarn: 150000,
    staleAbort: 300000,
    investigationCap: 18,
    postEditCap: 12,
    investigationGrace: 8,
    targetedReadHardCap: 11,
    phaseTargetedReadHardCap: 13,
    scrollWarnSections: 3,
    scrollBlockSections: 4,
    briefing: `You are kimi-k2-thinking, a deliberate reasoning model.
It is fine to think carefully before emitting visible text, but once a file is read do not re-read it reflexively.
Use your broader investigation budget to compare modules, not to loop on the same file.`,
  },
  "kimi-k2.5": {
    staleWarn: 120000,
    staleAbort: 300000,
    investigationCap: 17,
    postEditCap: 12,
    investigationGrace: 7,
    targetedReadHardCap: 11,
    phaseTargetedReadHardCap: 13,
    scrollWarnSections: 3,
    scrollBlockSections: 4,
    briefing: `You are kimi-k2.5, a strong large-context reasoning model.
Use the extra context for comparing files and following cross-cutting behavior.
Once you have loaded a file, stop re-reading it and move to the edit or verification.`,
  },
  "deepseek-r1": {
    staleWarn: 150000,
    staleAbort: 300000,
    investigationCap: 16,
    postEditCap: 12,
    investigationGrace: 7,
    targetedReadHardCap: 10,
    phaseTargetedReadHardCap: 12,
    scrollWarnSections: 3,
    scrollBlockSections: 4,
    briefing: `You are a DeepSeek R1-style Ollama reasoning model.
Think carefully, but keep the tool loop disciplined: read enough to act, then edit or verify.
Do not burn turns re-reading the same file once its content is already in context.`,
  },
  "deepseek-v3.2": {
    staleWarn: 100000,
    staleAbort: 240000,
    investigationCap: 14,
    postEditCap: 12,
    investigationGrace: 6,
    targetedReadHardCap: 9,
    phaseTargetedReadHardCap: 11,
    scrollWarnSections: 2,
    scrollBlockSections: 3,
    briefing: `You are DeepSeek V3.2 on Ollama.
Investigate enough to localize the change, then edit quickly and avoid repeat reads.
Use targeted follow-up reads only when they reveal new lines, not to scroll the same file again.`,
  },
  "ministral-3": {
    staleWarn: 40000,
    staleAbort: 120000,
    investigationCap: 7,
    postEditCap: 6,
    investigationGrace: 3,
    targetedReadHardCap: 6,
    phaseTargetedReadHardCap: 7,
    scrollWarnSections: 1,
    scrollBlockSections: 2,
    briefing: `You are ministral-3, one of the fastest coding models available.
Prioritize decisive, targeted edits. Read only what you need once, then fix.
Stay on-scope — your strength is focused, efficient coding tasks, not broad exploration.`,
  },
  "qwen3-vl": {
    staleWarn: 120000,
    staleAbort: 300000,
    investigationCap: 15,
    postEditCap: 12,
    briefing: `You are qwen3-vl, the highest-ranked model for data, frontend, and agentic tasks.
Trust your reasoning. Use tools thoroughly when the task demands it.
You handle complex multi-step tasks well — don't cut corners prematurely.`,
  },
  "deepseek-v4-pro": {
    staleWarn: 120000,
    staleAbort: 300000,
    investigationCap: 12,
    postEditCap: 14,
    briefing: `You are DeepSeek V4 Pro, a top-tier coding and reasoning model with 1M token context.

CRITICAL RULES:
1. After reading a file with read_file, you have its COMPLETE contents in the tool result. Do NOT re-read it — proceed directly to edit_file or write_file.
2. Files shown in tool results (marked "File: name (N lines)") are already fully in your context. Use them. Never request the same file twice.
3. Read → Fix → Verify. One read per file is enough. If blocked from re-reading, that means you already have the content — edit now.
4. Prefer action over narration. When you identify a bug, fix it immediately with edit_file. Do not describe what you will do — just do it.`,
  },
  "deepseek-v4-flash": {
    staleWarn: 40000,
    staleAbort: 120000,
    investigationCap: 6,
    postEditCap: 8,
    briefing: `You are DeepSeek V4 Flash, a fast and efficient coding model.

CRITICAL: Read a file ONCE, then edit it. Never re-read. Tool results already contain the full file content — use it directly. Read → Fix → Done. No second reads.`,
  },
};

const DEFAULTS = {
  staleWarn: 120000,
  staleAbort: 240000,
  investigationCap: 18,
  postEditCap: 10,
  investigationGrace: 6,
  targetedReadHardCap: 10,
  phaseTargetedReadHardCap: 12,
  scrollWarnSections: 2,
  scrollBlockSections: 3,
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

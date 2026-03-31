/**
 * cli/feature-flags.js — Compile-Time Feature Flags
 *
 * Provides a build-time feature flag system using esbuild's `define` option.
 * Flags are replaced with literal true/false at build time, enabling dead-code
 * elimination — disabled features are completely removed from the bundle.
 *
 * Usage in source code:
 *   const { feature } = require('./feature-flags');
 *   if (feature('WATCH_MODE')) {
 *     // This entire block is removed when WATCH_MODE is disabled
 *   }
 *
 * At build time, esbuild replaces `__FEATURE_WATCH_MODE__` with `false`,
 * and the minifier removes the dead branch entirely.
 *
 * In development (unbundled), flags fall back to environment variables
 * or the defaults defined below.
 */

"use strict";

// ─── Flag Definitions ───────────────────────────────────────────
// Add new flags here. Set `default` to false for experimental features.

const FLAG_DEFINITIONS = {
  WATCH_MODE: {
    description: "Background file/test watcher for AutoResearch",
    default: false,
  },
  DREAM_CONSOLIDATION: {
    description: "Post-session memory consolidation via dream logs",
    default: true,
  },
  PRIORITY_WAVES: {
    description: "Priority-based wave execution in orchestrator",
    default: true,
  },
  PROMPT_CACHE_SPLIT: {
    description: "System prompt split into static/dynamic for cache control",
    default: true,
  },
};

// ─── Runtime feature() function ─────────────────────────────────

// Build-time defines replace these globals. When running unbundled (dev/test),
// we fall back to env vars or defaults.
const _runtimeFlags = {};

for (const [name, def] of Object.entries(FLAG_DEFINITIONS)) {
  const globalName = `__FEATURE_${name}__`;
  // Check if esbuild replaced the global (typeof check avoids ReferenceError)
  try {
    // eslint-disable-next-line no-eval
    const buildTimeValue = eval(`typeof ${globalName} !== 'undefined' ? ${globalName} : undefined`);
    if (buildTimeValue !== undefined) {
      _runtimeFlags[name] = !!buildTimeValue;
      continue;
    }
  } catch {
    // Not defined at build time — fall through to runtime check
  }
  // Runtime fallback: check env var NEX_FEATURE_<NAME>=1
  const envKey = `NEX_FEATURE_${name}`;
  if (process.env[envKey] !== undefined) {
    _runtimeFlags[name] = process.env[envKey] === "1" || process.env[envKey] === "true";
  } else {
    _runtimeFlags[name] = def.default;
  }
}

/**
 * Check if a feature flag is enabled.
 * @param {string} name — flag name (e.g. "WATCH_MODE")
 * @returns {boolean}
 */
function feature(name) {
  if (name in _runtimeFlags) return _runtimeFlags[name];
  // Unknown flag — always false
  return false;
}

/**
 * List all registered feature flags and their current state.
 * @returns {Array<{ name: string, enabled: boolean, description: string }>}
 */
function listFeatureFlags() {
  return Object.entries(FLAG_DEFINITIONS).map(([name, def]) => ({
    name,
    enabled: _runtimeFlags[name] ?? def.default,
    description: def.description,
  }));
}

/**
 * Generate esbuild `define` entries for build-time flag replacement.
 * Used by the build script to inject compile-time constants.
 * @param {Object} [overrides] — flag overrides (e.g. { WATCH_MODE: true })
 * @returns {Object} — esbuild define map (e.g. { "__FEATURE_WATCH_MODE__": "false" })
 */
function getBuildDefines(overrides = {}) {
  const defines = {};
  for (const [name, def] of Object.entries(FLAG_DEFINITIONS)) {
    const value = name in overrides ? !!overrides[name] : def.default;
    defines[`__FEATURE_${name}__`] = String(value);
  }
  return defines;
}

module.exports = {
  feature,
  listFeatureFlags,
  getBuildDefines,
  FLAG_DEFINITIONS,
  // Exported for testing
  _runtimeFlags,
};

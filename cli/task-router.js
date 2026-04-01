"use strict";

/**
 * cli/task-router.js — Task-type detection and model routing
 *
 * Detects the category of a user's first message and routes to the
 * best model for that task type based on benchmark results.
 * Includes phase-based routing (plan/implement/verify) for Ollama Cloud.
 *
 * Config: ~/.nex-code/model-routing.json
 * Env vars: NEX_ROUTE_FRONTEND, NEX_ROUTE_SYSADMIN, NEX_ROUTE_DATA, NEX_ROUTE_AGENTIC
 */

const os = require("os");
const path = require("path");
const fs = require("fs");

const ROUTING_CONFIG_PATH = path.join(
  os.homedir(),
  ".nex-code",
  "model-routing.json",
);

// ─── Category Definitions ─────────────────────────────────────────────────────

const CATEGORIES = {
  frontend: {
    id: "frontend",
    label: "Frontend",
    icon: "⬡",
    envVar: "NEX_ROUTE_FRONTEND",
    pattern:
      /\b(react|vue|angular|svelte|jsx|tsx|html|css|scss|sass|tailwind|bootstrap|component|dom\b|ui\s|button|modal|navbar|sidebar|stylesheet|responsive|flexbox|grid|animation|frontend|front.end|onclick|hover|transition|web\s+design|landing\s+page|browser\s+event)\b/i,
  },
  sysadmin: {
    id: "sysadmin",
    label: "Sysadmin",
    icon: "⚙",
    envVar: "NEX_ROUTE_SYSADMIN",
    pattern:
      /\b(nginx|apache|docker|kubernetes|k8s|systemd|systemctl|deploy(ment)?|server\s+config|firewall|iptables\b|ssh\s+key|cron(job)?|ansible|terraform|ci\/cd|pipeline|container\b|pod\b|apt\s+install|yum\s+install|daemon|pm2|supervisor|logrotate|ssl\s+cert|lets.encrypt|reverse\s+proxy|load\s+balanc|haproxy|vhost|virtual\s+host)\b/i,
  },
  data: {
    id: "data",
    label: "Data",
    icon: "⬡",
    envVar: "NEX_ROUTE_DATA",
    pattern:
      /\b(sql\b|mysql|postgres(ql)?|sqlite|mongodb|redis\b|query\b|database|db\s+migration|schema\s+change|table\s+join|aggregate\b|pandas\b|dataframe|\.csv\b|etl\b|data\s+transform|data\s+pipeline|analytics|data\s+warehouse|dbt\b|orm\b|knex|sequelize|prisma\s+schema)\b/i,
  },
  agentic: {
    id: "agentic",
    label: "Agentic",
    icon: "⬡",
    envVar: "NEX_ROUTE_AGENTIC",
    pattern:
      /\b(spawn\s+agent|agent\s+swarm|multi.?agent|parallel\s+agent|orchestrat|coordinate\s+multiple\s+agent|delegate.+agent|sub.?agent|architect.*coder)\b/i,
  },
  coding: {
    id: "coding",
    label: "Coding",
    icon: "⬡",
    envVar: "NEX_ROUTE_CODING",
    pattern: null, // fallback — matches everything not caught above
  },
};

// Priority order: more specific first, coding is the final fallback
const DETECTION_ORDER = ["agentic", "frontend", "sysadmin", "data", "coding"];

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Detect the task category from a user message.
 * Returns the category object, or null if input is too short to classify.
 */
function detectCategory(input) {
  if (!input || input.length < 8) return null;

  for (const id of DETECTION_ORDER) {
    const cat = CATEGORIES[id];
    if (!cat.pattern) return cat; // coding fallback
    if (cat.pattern.test(input)) return cat;
  }
  return CATEGORIES.coding;
}

// ─── Routing Config ───────────────────────────────────────────────────────────

function loadRoutingConfig() {
  try {
    if (fs.existsSync(ROUTING_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(ROUTING_CONFIG_PATH, "utf-8"));
    }
  } catch {
    /* ignore */
  }
  return {};
}

/**
 * Get the configured model for a category.
 * Priority: model-routing.json > NEX_ROUTE_* env var > null (use DEFAULT_MODEL)
 */
function getModelForCategory(categoryId) {
  // 1. Per-session env override
  const cat = CATEGORIES[categoryId];
  if (cat?.envVar && process.env[cat.envVar]) return process.env[cat.envVar];

  // 2. Persistent routing config
  const config = loadRoutingConfig();
  return config[categoryId] || null;
}

// ─── Phase-Based Routing ─────────────────────────────────────────────────────

const DEFAULT_PHASE_BUDGETS = { plan: 10, implement: 35, verify: 8 };

// Built-in phase defaults for Ollama Cloud users who haven't run a benchmark yet.
// These activate automatically when provider is "ollama". Users can override via
// config or by running /benchmark which auto-populates the phases section.
const BUILTIN_PHASE_DEFAULTS = {
  plan: "qwen3-coder:480b",       // 256K context, strong reasoning
  implement: null,                  // null = use active model (already best for coding)
  verify: "devstral-small-2:24b",  // fast, good enough for test/lint checks
};

/**
 * Get the effective phase config: explicit config > builtin defaults (ollama only).
 * Returns null if phase routing should not be active.
 * @returns {object|null}
 */
function _resolvePhaseConfig() {
  const config = loadRoutingConfig();
  // Explicit config always wins
  if (config.phases && Object.keys(config.phases).length > 0) {
    return config.phases;
  }
  // Auto-enable for Ollama Cloud users: check if active provider is ollama
  try {
    const { getActiveProviderName } = require("./providers/registry");
    if (getActiveProviderName() === "ollama") {
      return BUILTIN_PHASE_DEFAULTS;
    }
  } catch {
    /* registry not initialized yet — skip auto-enable */
  }
  // Env var opt-in: NEX_PHASE_ROUTING=1 forces phase routing with builtins
  if (process.env.NEX_PHASE_ROUTING === "1") {
    return BUILTIN_PHASE_DEFAULTS;
  }
  return null;
}

/**
 * Get the configured model for a task phase.
 * Priority: config.phases[phase] > builtin defaults (ollama) > category routing > null
 *
 * @param {'plan'|'implement'|'verify'} phase
 * @param {string} [categoryId] — fallback category if no phase config
 */
function getModelForPhase(phase, categoryId) {
  const phases = _resolvePhaseConfig();
  if (phases?.[phase]) return phases[phase];
  // null in builtin defaults means "use active model" — fall through to category
  return categoryId ? getModelForCategory(categoryId) : null;
}

/**
 * Get the iteration budget for a task phase.
 * Reads from config.phaseBudgets, falls back to defaults (plan:10, implement:35, verify:8).
 *
 * @param {'plan'|'implement'|'verify'} phase
 * @returns {number}
 */
function getPhaseBudget(phase) {
  const config = loadRoutingConfig();
  return config.phaseBudgets?.[phase] || DEFAULT_PHASE_BUDGETS[phase] || 20;
}

/**
 * Check whether phase-based routing is enabled.
 * True when: explicit config has phases, OR provider is ollama (auto-enable), OR env var set.
 * Disable with NEX_PHASE_ROUTING=0.
 * @returns {boolean}
 */
function isPhaseRoutingEnabled() {
  if (process.env.NEX_PHASE_ROUTING === "0") return false;
  return _resolvePhaseConfig() !== null;
}

// ─── Config Persistence ──────────────────────────────────────────────────────

/**
 * Save a complete routing config (all categories → best models).
 * Preserves nested keys (phases, phaseBudgets) when merging.
 * Called by model-watcher / benchmark after a run.
 */
function saveRoutingConfig(routing) {
  const dir = path.dirname(ROUTING_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Preserve existing nested keys that the caller didn't provide
  const existing = loadRoutingConfig();
  const merged = { ...existing, ...routing };
  if (!routing.phases && existing.phases) merged.phases = existing.phases;
  if (!routing.phaseBudgets && existing.phaseBudgets) merged.phaseBudgets = existing.phaseBudgets;
  fs.writeFileSync(ROUTING_CONFIG_PATH, JSON.stringify(merged, null, 2));

  // Sync to global .env for persistence and visibility
  try {
    const envPath = path.join(dir, ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf-8");
    }

    const lines = envContent.split(/\r?\n/);
    const updateEnv = (key, val) => {
      const idx = lines.findIndex(l => l.startsWith(key + "="));
      if (idx >= 0) {
        lines[idx] = `${key}=${val}`;
      } else {
        lines.push(`${key}=${val}`);
      }
    };

    if (merged.coding) updateEnv("NEX_ROUTE_CODING", merged.coding);
    if (merged.frontend) updateEnv("NEX_ROUTE_FRONTEND", merged.frontend);
    if (merged.sysadmin) updateEnv("NEX_ROUTE_SYSADMIN", merged.sysadmin);
    if (merged.data) updateEnv("NEX_ROUTE_DATA", merged.data);
    if (merged.agentic) updateEnv("NEX_ROUTE_AGENTIC", merged.agentic);

    if (merged.phases) {
      if (merged.phases.plan) updateEnv("NEX_PHASE_PLAN_MODEL", merged.phases.plan);
      if (merged.phases.implement) updateEnv("NEX_PHASE_IMPLEMENT_MODEL", merged.phases.implement);
      if (merged.phases.verify) updateEnv("NEX_PHASE_VERIFY_MODEL", merged.phases.verify);
    }

    fs.writeFileSync(envPath, lines.filter(l => l.trim() !== "").join("\n") + "\n");
  } catch (err) {
    /* ignore env sync errors */
  }
}

module.exports = {
  CATEGORIES,
  DETECTION_ORDER,
  detectCategory,
  getModelForCategory,
  getModelForPhase,
  getPhaseBudget,
  isPhaseRoutingEnabled,
  DEFAULT_PHASE_BUDGETS,
  BUILTIN_PHASE_DEFAULTS,
  saveRoutingConfig,
  loadRoutingConfig,
  ROUTING_CONFIG_PATH,
};

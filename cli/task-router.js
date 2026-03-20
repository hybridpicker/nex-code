'use strict';

/**
 * cli/task-router.js — Task-type detection and model routing
 *
 * Detects the category of a user's first message and routes to the
 * best model for that task type based on benchmark results.
 *
 * Config: ~/.nex-code/model-routing.json
 * Env vars: NEX_ROUTE_FRONTEND, NEX_ROUTE_SYSADMIN, NEX_ROUTE_DATA, NEX_ROUTE_AGENTIC
 */

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const ROUTING_CONFIG_PATH = path.join(os.homedir(), '.nex-code', 'model-routing.json');

// ─── Category Definitions ─────────────────────────────────────────────────────

const CATEGORIES = {
  frontend: {
    id:      'frontend',
    label:   'Frontend',
    icon:    '⬡',
    envVar:  'NEX_ROUTE_FRONTEND',
    pattern: /\b(react|vue|angular|svelte|jsx|tsx|html|css|scss|sass|tailwind|bootstrap|component|dom\b|ui\s|button|modal|navbar|sidebar|stylesheet|responsive|flexbox|grid|animation|frontend|front.end|onclick|hover|transition|web\s+design|landing\s+page|browser\s+event)\b/i,
  },
  sysadmin: {
    id:      'sysadmin',
    label:   'Sysadmin',
    icon:    '⚙',
    envVar:  'NEX_ROUTE_SYSADMIN',
    pattern: /\b(nginx|apache|docker|kubernetes|k8s|systemd|systemctl|deploy(ment)?|server\s+config|firewall|iptables\b|ssh\s+key|cron(job)?|ansible|terraform|ci\/cd|pipeline|container\b|pod\b|apt\s+install|yum\s+install|daemon|pm2|supervisor|logrotate|ssl\s+cert|lets.encrypt|reverse\s+proxy|load\s+balanc|haproxy|vhost|virtual\s+host)\b/i,
  },
  data: {
    id:      'data',
    label:   'Data',
    icon:    '⬡',
    envVar:  'NEX_ROUTE_DATA',
    pattern: /\b(sql\b|mysql|postgres(ql)?|sqlite|mongodb|redis\b|query\b|database|db\s+migration|schema\s+change|table\s+join|aggregate\b|pandas\b|dataframe|\.csv\b|etl\b|data\s+transform|data\s+pipeline|analytics|data\s+warehouse|dbt\b|orm\b|knex|sequelize|prisma\s+schema)\b/i,
  },
  agentic: {
    id:      'agentic',
    label:   'Agentic',
    icon:    '⬡',
    envVar:  'NEX_ROUTE_AGENTIC',
    pattern: /\b(spawn\s+agent|agent\s+swarm|multi.?agent|parallel\s+agent|orchestrat|coordinate\s+multiple\s+agent|delegate.+agent|sub.?agent|architect.*coder)\b/i,
  },
  coding: {
    id:      'coding',
    label:   'Coding',
    icon:    '⬡',
    envVar:  'NEX_ROUTE_CODING',
    pattern: null, // fallback — matches everything not caught above
  },
};

// Priority order: more specific first, coding is the final fallback
const DETECTION_ORDER = ['agentic', 'frontend', 'sysadmin', 'data', 'coding'];

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
      return JSON.parse(fs.readFileSync(ROUTING_CONFIG_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
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

/**
 * Save a complete routing config (all categories → best models).
 * Called by model-watcher after a benchmark run.
 */
function saveRoutingConfig(routing) {
  const dir = path.dirname(ROUTING_CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ROUTING_CONFIG_PATH, JSON.stringify(routing, null, 2));
}

module.exports = {
  CATEGORIES,
  DETECTION_ORDER,
  detectCategory,
  getModelForCategory,
  saveRoutingConfig,
  loadRoutingConfig,
  ROUTING_CONFIG_PATH,
};

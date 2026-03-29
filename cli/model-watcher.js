"use strict";

/**
 * cli/model-watcher.js — Ollama Cloud model discovery
 *
 * Tracks which models have been benchmarked. Compares the live Ollama Cloud
 * model list against the known-models store and returns new additions.
 *
 * Storage: ~/.nex-code/known-models.json
 */

const os = require("os");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const https = require("https");

const KNOWN_MODELS_PATH = path.join(
  os.homedir(),
  ".nex-code",
  "known-models.json",
);
const OLLAMA_API = "https://ollama.com/api/tags";

// Minimum benchmark score for a model to appear in the README table
const TABLE_MIN_SCORE = 60;

// Models already in OLLAMA_MODELS with known context windows (from ollama.js)
const KNOWN_CONTEXT = {
  "qwen3-coder:480b": 131072,
  "devstral-2:123b": 131072,
  "devstral-small-2:24b": 131072,
  "kimi-k2:1t": 262144,
  "kimi-k2.5": 262144,
  "kimi-k2-thinking": 262144,
  "minimax-m2.7:cloud": 200000,
  "minimax-m2.7": 200000,
  "minimax-m2.5": 131072,
  "minimax-m2.1": 200000,
  "minimax-m2": 200000,
  "qwen3.5:397b": 262144,
  "qwen3.5:35b-a3b": 262144,
  "deepseek-v3.2": 131072,
  "deepseek-v3.1:671b": 131072,
  "cogito-2.1:671b": 131072,
  "glm-5": 128000,
  "glm-5:cloud": 128000,
  "glm-4.7": 128000,
  "glm-4.6": 128000,
  "qwen3-vl:235b": 131072,
  "qwen3-vl:235b-instruct": 131072,
  "qwen3-coder-next": 262144,
  "qwen3-next:80b": 131072,
  "mistral-large-3:675b": 131072,
  "ministral-3:14b": 131072,
  "ministral-3:8b": 131072,
  "ministral-3:3b": 32768,
  "nemotron-3-nano:30b": 131072,
  "nemotron-3-super": 262144,
  "rnj-1:8b": 131072,
  "gpt-oss:120b": 131072,
  "gpt-oss:20b": 131072,
  "gemma3:4b": 131072,
  "gemma3:12b": 131072,
  "gemma3:27b": 131072,
  "gemini-3-flash-preview": 131072,
};

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadKnownModels() {
  try {
    if (fs.existsSync(KNOWN_MODELS_PATH)) {
      return JSON.parse(fs.readFileSync(KNOWN_MODELS_PATH, "utf-8"));
    }
  } catch {
    /* ignore */
  }
  return { benchmarked: [], lastChecked: null };
}

function saveKnownModels(data) {
  const dir = path.dirname(KNOWN_MODELS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KNOWN_MODELS_PATH, JSON.stringify(data, null, 2));
}

function markBenchmarked(modelIds) {
  const store = loadKnownModels();
  const set = new Set(store.benchmarked);
  for (const id of modelIds) set.add(id);
  store.benchmarked = [...set];
  store.lastChecked = new Date().toISOString();
  saveKnownModels(store);
}

// ─── Discovery ────────────────────────────────────────────────────────────────

async function fetchCloudModels() {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY not set");

  const agent = new https.Agent({ keepAlive: true });
  const resp = await axios.get(OLLAMA_API, {
    headers: { Authorization: `Bearer ${key}` },
    timeout: 15000,
    httpsAgent: agent,
  });

  return (resp.data?.models || [])
    .map((m) => (m.name || m.model || "").replace(/:latest$/, ""))
    .filter(Boolean);
}

/**
 * Returns models available on Ollama Cloud that have not yet been benchmarked.
 * Also returns the full cloud list for reference.
 */
async function findNewModels() {
  const allCloud = await fetchCloudModels();
  const store = loadKnownModels();
  const benchmarked = new Set(store.benchmarked);
  const newModels = allCloud.filter((m) => !benchmarked.has(m));
  return { allCloud, newModels, store };
}

// ─── README / config helpers ──────────────────────────────────────────────────

const SENTINEL_START = "<!-- nex-benchmark-start -->";
const SENTINEL_END = "<!-- nex-benchmark-end -->";

const BEST_FOR = {
  "qwen3-vl:235b": "Overall #1 — frontier tool selection, data + agentic tasks",
  "qwen3-vl:235b-instruct": "Best latency/score balance — recommended default",
  "devstral-2:123b": "Sysadmin + SSH tasks, reliable coding",
  "devstral-small-2:24b": "Fast sub-agents, simple lookups",
  "ministral-3:8b": "Fastest strong model — 2.2s latency, 70+ score",
  "qwen3-coder:480b": "Heavy coding sessions, large context",
  "kimi-k2:1t": "Large repos (>100K tokens)",
  "kimi-k2.5": "Large repos — faster than k2:1t",
  "minimax-m2.7:cloud": "Complex swarm / multi-agent sessions",
  "minimax-m2.5": "Multi-agent, large context",
  "qwen3.5:35b-a3b": "Fast MoE with 256K context",
  "gpt-oss:20b": "Fast small model, good overall score",
};

function ctxLabel(ctx) {
  if (!ctx) return "?";
  if (ctx >= 250000) return "256K";
  if (ctx >= 190000) return "200K";
  if (ctx >= 128000) return "131K";
  if (ctx >= 64000) return "64K";
  return `${Math.round(ctx / 1024)}K`;
}

/**
 * Generate the markdown benchmark table block (between sentinels).
 * @param {Array} summary  — output of benchmark.buildSummary()
 * @param {string} date    — ISO date string
 */
function generateBenchmarkBlock(summary, date) {
  const medals = ["🥇", "🥈", "🥉"];
  const today = (date || new Date().toISOString()).split("T")[0];

  const rows = summary
    .filter((r) => r.score >= TABLE_MIN_SCORE)
    .map((r, i) => {
      const medal = medals[i] || "—";
      const ctx = ctxLabel(KNOWN_CONTEXT[r.model]);
      const bestFor = BEST_FOR[r.model] || "—";
      const lat = `${(r.avgLatency / 1000).toFixed(1)}s`;
      const score = i === 0 ? `**${r.score}**` : String(r.score);
      return `| ${medal} | \`${r.model}\` | ${score} | ${lat} | ${ctx} | ${bestFor} |`;
    })
    .join("\n");

  return `${SENTINEL_START}
<!-- Updated: ${today} — run \`/benchmark --discover\` after new Ollama Cloud releases -->

| Rank | Model | Score | Avg Latency | Context | Best For |
|---|---|---|---|---|---|
${rows}

> Rankings are nex-code-specific: tool name accuracy, argument validity, schema compliance.
> Toolathon (Minimax SOTA) measures different task types — run \`/benchmark --discover\` after model releases.
${SENTINEL_END}`;
}

/**
 * Rewrite the README benchmark table between sentinel comments.
 * @param {Array}  summary — benchmark ranking
 * @param {string} readmePath
 */
function updateReadme(summary, readmePath) {
  if (!fs.existsSync(readmePath)) return false;
  const content = fs.readFileSync(readmePath, "utf-8");

  const start = content.indexOf(SENTINEL_START);
  const end = content.indexOf(SENTINEL_END);
  if (start === -1 || end === -1) return false;

  const before = content.slice(0, start);
  const after = content.slice(end + SENTINEL_END.length);
  const block = generateBenchmarkBlock(summary);

  fs.writeFileSync(readmePath, before + block + after);
  return true;
}

/**
 * Update DEFAULT_MODEL in models.env if a new winner emerges with ≥5pt margin.
 * Also updates the Last-reviewed comment line.
 * @returns {{ updated: boolean, previousModel?: string, newModel?: string, reason?: string }}
 */
function updateModelsEnv(summary) {
  const envPath = path.join(os.homedir(), ".nex-code", "models.env");
  if (!fs.existsSync(envPath) || summary.length === 0) {
    return { updated: false, reason: "models.env not found or empty summary" };
  }

  const winner = summary[0];
  let content = fs.readFileSync(envPath, "utf-8");

  const currentMatch = content.match(/^DEFAULT_MODEL=(\S+)/m);
  const current = currentMatch?.[1];

  if (current === winner.model)
    return { updated: false, reason: "winner unchanged" };

  const currentEntry = summary.find((r) => r.model === current);
  if (currentEntry && winner.score - currentEntry.score < 5) {
    return {
      updated: false,
      reason: `margin ${(winner.score - currentEntry.score).toFixed(1)}pts < 5pts threshold`,
    };
  }

  const today = new Date().toISOString().split("T")[0];
  content = content
    .replace(/^DEFAULT_MODEL=\S+/m, `DEFAULT_MODEL=${winner.model}`)
    .replace(
      /^# Last reviewed:.*$/m,
      `# Last reviewed: ${today} (after /benchmark, ${winner.model} wins nex-code tasks)`,
    );

  fs.writeFileSync(envPath, content);
  return { updated: true, previousModel: current, newModel: winner.model };
}

/**
 * Update model-routing.json and models.env NEX_ROUTE_* variables from
 * category winners produced by benchmark.buildCategoryWinners().
 *
 * @param {Object} categoryWinners  — { coding: { model, score }, frontend: {...}, ... }
 * @returns {{ saved: boolean, envUpdated: boolean, changes: string[] }}
 */
function updateRoutingConfig(categoryWinners) {
  const { saveRoutingConfig } = require("./task-router");
  const envPath = path.join(os.homedir(), ".nex-code", "models.env");
  const changes = [];

  // Guard: skip if no real benchmark data (all scores 0 means summary was empty)
  const validEntries = Object.entries(categoryWinners).filter(
    ([, e]) => e.score > 0,
  );
  if (validEntries.length === 0)
    return { saved: false, envUpdated: false, changes: [] };

  // Write model-routing.json
  const routing = {};
  for (const [cat, entry] of validEntries) {
    routing[cat] = entry.model;
    changes.push(`${cat}: ${entry.model} (${entry.score}/100)`);
  }
  saveRoutingConfig(routing);

  // Update NEX_ROUTE_* in models.env
  let envUpdated = false;
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf-8");

    const ROUTE_ENV_KEYS = {
      coding: "NEX_ROUTE_CODING",
      frontend: "NEX_ROUTE_FRONTEND",
      sysadmin: "NEX_ROUTE_SYSADMIN",
      data: "NEX_ROUTE_DATA",
      agentic: "NEX_ROUTE_AGENTIC",
    };

    // Build the routing block to insert/replace
    const routingLines = Object.entries(ROUTE_ENV_KEYS)
      .filter(([cat]) => categoryWinners[cat] && categoryWinners[cat].score > 0)
      .map(
        ([cat, key]) =>
          `${key}=${categoryWinners[cat].model}  # ${cat} score: ${categoryWinners[cat].score}/100`,
      )
      .join("\n");

    const ROUTING_BLOCK_START =
      "# ── Task-type routing (auto-updated by /benchmark) ──";
    const ROUTING_BLOCK_END = "# ── end routing ──";

    if (content.includes(ROUTING_BLOCK_START)) {
      // Replace existing block
      const startIdx = content.indexOf(ROUTING_BLOCK_START);
      const endIdx = content.indexOf(ROUTING_BLOCK_END);
      if (endIdx !== -1) {
        content =
          content.slice(0, startIdx) +
          `${ROUTING_BLOCK_START}\n${routingLines}\n${ROUTING_BLOCK_END}` +
          content.slice(endIdx + ROUTING_BLOCK_END.length);
      }
    } else {
      // Append routing block before the last comment block or at end
      content += `\n${ROUTING_BLOCK_START}\n${routingLines}\n${ROUTING_BLOCK_END}\n`;
    }

    fs.writeFileSync(envPath, content);
    envUpdated = true;
  }

  return { saved: true, envUpdated, changes };
}

// ─── Orchestrator Model Discovery ────────────────────────────────────────────

const REASONING_PATTERNS = /thinking|reasoning|instruct|planner|orchestrat/i;

/**
 * Check if a model name suggests orchestrator/reasoning capability.
 * @param {string} modelName
 * @returns {boolean}
 */
function checkOrchestratorCandidate(modelName) {
  return REASONING_PATTERNS.test(modelName);
}

/**
 * Update NEX_ORCHESTRATOR_MODEL in models.env if a new winner exceeds
 * the current best by more than 5%.
 * @param {Array<{ model: string, overall: number }>} benchResults
 * @returns {{ updated: boolean, previousModel?: string, newModel?: string }}
 */
function updateOrchestratorModel(benchResults) {
  if (!benchResults || benchResults.length === 0) return { updated: false };

  const envPath = path.join(os.homedir(), ".nex-code", "models.env");
  if (!fs.existsSync(envPath)) return { updated: false };

  let content = fs.readFileSync(envPath, "utf-8");
  const currentMatch = content.match(/^NEX_ORCHESTRATOR_MODEL=(.+)$/m);
  const currentModel = currentMatch ? currentMatch[1].trim() : null;

  // Find current model score and best model
  const sorted = [...benchResults].sort((a, b) => b.overall - a.overall);
  const best = sorted[0];
  const currentEntry = currentModel
    ? benchResults.find((r) => r.model === currentModel)
    : null;
  const currentScore = currentEntry ? currentEntry.overall : 0;

  // Promote only if new winner exceeds current by >5%
  if (best.model === currentModel) return { updated: false };
  if (currentScore > 0 && best.overall < currentScore * 1.05)
    return { updated: false };

  // Update models.env
  const line = `NEX_ORCHESTRATOR_MODEL=${best.model}`;
  if (currentMatch) {
    content = content.replace(/^NEX_ORCHESTRATOR_MODEL=.+$/m, line);
  } else {
    content += `\n${line}\n`;
  }
  fs.writeFileSync(envPath, content);

  return { updated: true, previousModel: currentModel, newModel: best.model };
}

module.exports = {
  findNewModels,
  fetchCloudModels,
  loadKnownModels,
  markBenchmarked,
  updateReadme,
  updateModelsEnv,
  updateRoutingConfig,
  generateBenchmarkBlock,
  checkOrchestratorCandidate,
  updateOrchestratorModel,
  SENTINEL_START,
  SENTINEL_END,
};

#!/usr/bin/env node
"use strict";

/**
 * scripts/extract-examples.js — Extract few-shot examples from high-scoring sessions
 *
 * Reads scored sessions from ~/.nex/sessions/ (or .nex/sessions/ in cwd),
 * finds the best first-turn exchange per category, sanitizes private data
 * (hostnames, IPs, real paths), and saves to ~/.nex-code/examples/<category>.md
 *
 * Usage:
 *   node scripts/extract-examples.js [--min-score 8] [--dry-run]
 *
 * The extracted examples are private (not committed to the repo).
 * Generic fallbacks ship with nex-code in examples/ for public benefit.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const { scoreMessages } = require("../cli/session-scorer");
const { detectCategory } = require("../cli/task-router");
const { savePrivateExample } = require("../cli/few-shot");

const args = process.argv.slice(2);
const minScoreIdx = args.indexOf("--min-score");
const MIN_SCORE = minScoreIdx !== -1 ? parseFloat(args[minScoreIdx + 1]) : 8;
const DRY_RUN = args.includes("--dry-run");

// Session search paths (in priority order)
const SESSION_DIRS = [
  path.join(process.cwd(), ".nex", "sessions"),
  path.join(os.homedir(), ".nex", "sessions"),
];

// ─── Sanitization ─────────────────────────────────────────────────────────────

const PRIVATE_PATTERNS = [
  // IPv4 addresses
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "your-server"],
  // SSH user@host patterns
  [/\b[\w.-]+@[\w.-]+\b/g, "user@your-server"],
  // /home/<username>/ paths
  [/\/home\/[^/\s]+\//g, "/home/user/"],
  // Domain names (2+ levels, not generic like localhost)
  [/\b(?!localhost)[\w-]+\.(?:com|net|org|io|dev|app|de|at|ch)\b/g, "your-domain.com"],
  // API keys / tokens (hex/base64 looking strings ≥20 chars)
  [/\b[A-Za-z0-9+/]{20,}={0,2}\b/g, "<redacted>"],
  // JWT tokens
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "<jwt-redacted>"],
];

function sanitize(text) {
  if (typeof text !== "string") return text;
  let out = text;
  for (const [pattern, replacement] of PRIVATE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

// ─── Session Loading ───────────────────────────────────────────────────────────

function loadSessionFiles() {
  const files = [];
  for (const dir of SESSION_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      files.push(path.join(dir, f));
    }
  }
  return files;
}

function loadSession(filePath) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return raw.messages || raw;
  } catch {
    return null;
  }
}

// ─── Example Extraction ────────────────────────────────────────────────────────

/**
 * Extract the first meaningful user message and the first assistant response
 * from a session's messages array.
 */
function extractFirstExchange(messages) {
  let userMsg = null;
  let assistantMsg = null;

  for (const m of messages) {
    if (!userMsg && m.role === "user") {
      const content = typeof m.content === "string"
        ? m.content
        : (m.content?.find?.((c) => c.type === "text")?.text || "");
      if (content.trim().length > 10) {
        userMsg = content.trim();
      }
    } else if (userMsg && !assistantMsg && m.role === "assistant") {
      const content = typeof m.content === "string"
        ? m.content
        : (m.content?.find?.((c) => c.type === "text")?.text || "");
      // Only use text responses (not pure tool-call turns)
      if (content.trim().length > 30) {
        assistantMsg = content.trim();
        break;
      }
    }
  }

  if (!userMsg || !assistantMsg) return null;
  return { user: userMsg, assistant: assistantMsg };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const sessionFiles = loadSessionFiles();
  if (sessionFiles.length === 0) {
    console.log("No session files found in:", SESSION_DIRS.join(", "));
    process.exit(0);
  }

  console.log(`Scanning ${sessionFiles.length} session(s), min score: ${MIN_SCORE}...`);

  // category → { score, exchange }
  const best = {};

  for (const filePath of sessionFiles) {
    const messages = loadSession(filePath);
    if (!messages || messages.length < 2) continue;

    const { score } = scoreMessages(messages);
    if (score < MIN_SCORE) continue;

    const exchange = extractFirstExchange(messages);
    if (!exchange) continue;

    const category = detectCategory(exchange.user);
    if (!category) continue;

    const existing = best[category.id];
    if (!existing || score > existing.score) {
      best[category.id] = { score, exchange, file: path.basename(filePath) };
    }
  }

  if (Object.keys(best).length === 0) {
    console.log(`No sessions with score ≥ ${MIN_SCORE} found.`);
    process.exit(0);
  }

  for (const [categoryId, { score, exchange, file }] of Object.entries(best)) {
    const sanitizedUser = sanitize(exchange.user);
    const sanitizedAssistant = sanitize(exchange.assistant);

    console.log(`\n[${categoryId}] score=${score}/10 — from ${file}`);
    console.log(`  User: ${sanitizedUser.slice(0, 80)}...`);

    if (DRY_RUN) {
      console.log("  (dry-run — not saved)");
      continue;
    }

    savePrivateExample(categoryId, {
      user: sanitizedUser,
      assistant: sanitizedAssistant,
    });
    console.log(`  → Saved to ~/.nex-code/examples/${categoryId}.md`);
  }

  if (!DRY_RUN) {
    console.log("\nDone. Examples will be used on the next nex-code session.");
  }
}

main();

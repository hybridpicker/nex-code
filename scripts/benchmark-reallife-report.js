#!/usr/bin/env node
/**
 * scripts/benchmark-reallife-report.js — Results Dashboard
 *
 * Reads reallife-history.jsonl and generates an ASCII trend report.
 *
 * Usage:
 *   node scripts/benchmark-reallife-report.js [--last <n>]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const HISTORY_FILE = path.join(__dirname, "benchmark-results", "reallife-history.jsonl");

function readHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  return fs.readFileSync(HISTORY_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function asciiBar(value, max, width = 40) {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function main() {
  const args = process.argv.slice(2);
  const lastIdx = args.indexOf("--last");
  const lastN = lastIdx !== -1 ? parseInt(args[lastIdx + 1], 10) : 20;

  const history = readHistory();
  if (history.length === 0) {
    console.log("\n  No benchmark history found. Run: npm run benchmark:reallife\n");
    return;
  }

  const recent = history.slice(-lastN);

  console.log("\n  ══════════════════════════════════════════════════");
  console.log("  Real-Life Benchmark Dashboard");
  console.log("  ══════════════════════════════════════════════════\n");

  // Score trend
  console.log("  Score Trend (last " + recent.length + " runs):");
  console.log("  " + "─".repeat(60));
  for (const entry of recent) {
    const date = entry.date ? entry.date.slice(0, 10) : "unknown";
    const model = (entry.model || "default").slice(0, 15).padEnd(15);
    const bar = asciiBar(entry.finalScore, 100, 30);
    console.log(`  ${date}  ${model}  ${bar} ${entry.finalScore}/100`);
  }
  console.log();

  // Latest run category breakdown
  const latest = recent[recent.length - 1];
  if (latest && latest.categoryScores) {
    console.log("  Latest Category Breakdown:");
    console.log("  " + "─".repeat(60));
    const categories = Object.entries(latest.categoryScores).sort((a, b) => b[1] - a[1]);
    for (const [cat, score] of categories) {
      const bar = asciiBar(score, 100, 30);
      const label = cat.padEnd(15);
      console.log(`  ${label}  ${bar} ${score}/100`);
    }
    console.log();
  }

  // Statistics
  const scores = recent.map(e => e.finalScore);
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const trend = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;

  console.log("  Statistics:");
  console.log("  " + "─".repeat(60));
  console.log(`  Average:  ${avg}/100`);
  console.log(`  Best:     ${max}/100`);
  console.log(`  Worst:    ${min}/100`);
  console.log(`  Trend:    ${trend >= 0 ? "+" : ""}${trend} points`);
  console.log(`  Runs:     ${history.length} total`);

  // Token usage
  const totalTokens = recent.reduce((s, e) => ({
    input: s.input + (e.totalTokens?.input || 0),
    output: s.output + (e.totalTokens?.output || 0),
  }), { input: 0, output: 0 });

  if (totalTokens.input > 0 || totalTokens.output > 0) {
    console.log(`  Tokens:   ${totalTokens.input.toLocaleString()} in / ${totalTokens.output.toLocaleString()} out (last ${recent.length} runs)`);
  }
  const latestMetrics = latest?.metrics;
  if (latestMetrics) {
    console.log(`  Avg tools: ${latestMetrics.avgToolCalls ?? 0}`);
    console.log(`  Timeout:   ${latestMetrics.timeoutRate ?? 0}%`);
    console.log(`  Error:     ${latestMetrics.errorRate ?? 0}%`);
  }

  console.log();

  // Weakest categories across recent runs
  if (recent.length >= 2) {
    const catTotals = {};
    const catCounts = {};
    for (const entry of recent) {
      if (!entry.categoryScores) continue;
      for (const [cat, score] of Object.entries(entry.categoryScores)) {
        catTotals[cat] = (catTotals[cat] || 0) + score;
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }
    }
    const catAvgs = Object.entries(catTotals)
      .map(([cat, total]) => [cat, Math.round(total / catCounts[cat])])
      .sort((a, b) => a[1] - b[1]);

    if (catAvgs.length > 0) {
      console.log("  Weakest Categories (improvement targets):");
      console.log("  " + "─".repeat(60));
      for (const [cat, avg] of catAvgs.slice(0, 3)) {
        console.log(`  ${avg < 50 ? "✗" : "~"} ${cat}: ${avg}/100 avg`);
      }
      console.log();
    }
  }
}

main();

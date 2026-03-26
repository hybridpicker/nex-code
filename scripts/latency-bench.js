#!/usr/bin/env node
/**
 * scripts/latency-bench.js — TTFT + Total latency measurement
 * Usage: node scripts/latency-bench.js [model1] [model2] ...
 * Default: glm-5 kimi-k2.5
 */

// Load .env — try project root first, then fallback to process.env already set
const dotenvPath = require("path").join(__dirname, "../.env");
require("dotenv").config({ path: dotenvPath, override: true });

const axios = require("axios");
const http = require("http");
const https = require("https");

const OLLAMA_BASE = "https://ollama.com";
const PROMPT =
  "Write a short JavaScript function that checks if a number is prime. Return only the code, no explanation.";
const RUNS = 2; // runs per model (averaged)
const TIMEOUT = 120000;

const _keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 4 });
const _keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 4 });

function getHeaders() {
  const key = process.env.OLLAMA_API_KEY;
  if (!key) throw new Error("OLLAMA_API_KEY not set");
  return { Authorization: `Bearer ${key}` };
}

async function measureLatency(model) {
  const start = Date.now();
  let ttft = null;

  const response = await axios.post(
    `${OLLAMA_BASE}/api/chat`,
    {
      model,
      messages: [{ role: "user", content: PROMPT }],
      stream: true,
      options: { temperature: 0.1, num_predict: 256 },
    },
    {
      timeout: TIMEOUT,
      headers: getHeaders(),
      responseType: "stream",
      httpsAgent: _keepAliveHttps,
      httpAgent: _keepAliveHttp,
    },
  );

  return new Promise((resolve, reject) => {
    let buffer = "";
    let content = "";

    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (parsed.message?.content && ttft === null) {
          ttft = Date.now() - start;
        }
        if (parsed.message?.content) {
          content += parsed.message.content;
        }
        if (parsed.done) {
          const total = Date.now() - start;
          resolve({ ttft: ttft ?? total, total, tokens: content.length });
        }
      }
    });

    response.data.on("error", reject);
    response.data.on("end", () => {
      if (ttft === null) reject(new Error("No tokens received"));
    });
  });
}

async function benchModel(model) {
  const results = [];
  process.stdout.write(`  Testing ${model}...`);
  for (let i = 0; i < RUNS; i++) {
    try {
      const r = await measureLatency(model);
      results.push(r);
      process.stdout.write(
        ` run${i + 1}: ${r.ttft}ms TTFT / ${r.total}ms total`,
      );
    } catch (err) {
      process.stdout.write(` run${i + 1}: ERROR (${err.message.slice(0, 60)})`);
    }
  }
  process.stdout.write("\n");

  if (results.length === 0) return null;
  const avgTTFT = Math.round(
    results.reduce((s, r) => s + r.ttft, 0) / results.length,
  );
  const avgTotal = Math.round(
    results.reduce((s, r) => s + r.total, 0) / results.length,
  );
  return { model, avgTTFT, avgTotal, runs: results.length };
}

async function main() {
  const models = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["glm-5", "kimi-k2.5"];

  console.log(`\nLatency Benchmark — ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Prompt: "${PROMPT.slice(0, 60)}..."`);
  console.log(`Runs per model: ${RUNS}\n`);

  const summaries = [];
  for (const model of models) {
    const result = await benchModel(model);
    if (result) summaries.push(result);
  }

  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ Model                         │  Avg TTFT  │  Avg Total │");
  console.log("├─────────────────────────────────────────────────────────┤");
  for (const s of summaries) {
    const name = s.model.padEnd(30);
    const ttft = `${s.avgTTFT}ms`.padStart(9);
    const total = `${s.avgTotal}ms`.padStart(9);
    console.log(`│ ${name} │ ${ttft}  │ ${total}  │`);
  }
  console.log("└─────────────────────────────────────────────────────────┘");

  // Recommendation
  console.log("\n--- Recommendation ---");
  const reference = {
    ttft: 22400,
    total: 80700,
    model: "qwen3-coder:480b (current Heavy)",
  };
  for (const s of summaries) {
    const fasterTTFT = s.avgTTFT < reference.ttft;
    const fasterTotal = s.avgTotal < reference.total;
    const status =
      fasterTTFT && fasterTotal
        ? "✅ FASTER than qwen3-coder:480b → Heavy candidate"
        : fasterTTFT
          ? "⚠️  TTFT faster, Total slower — borderline"
          : "❌ Slower than qwen3-coder:480b — skip";
    console.log(`${s.model}: ${status}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

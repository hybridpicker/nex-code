#!/usr/bin/env node
/**
 * Message Serialization Benchmark for Nex Code
 *
 * Tests the Message Serialization Caching optimization:
 * - Without cache: JSON.stringify on every call
 * - With cache: WeakMap + string cache lookup
 *
 * Run: node benchmark/message-serialization.js
 */

const { performance } = require("perf_hooks");

const C = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(0)}ms`;
}

// Sample conversation messages (typical multi-turn session)
const SAMPLE_MESSAGES = [
  {
    role: "system",
    content: "You are Nex Code, an expert coding assistant...",
  },
  { role: "user", content: "Can you help me refactor this function?" },
  {
    role: "assistant",
    content:
      "Sure! Let me first read the file to understand the current implementation.",
    tool_calls: [
      {
        id: "call_123",
        function: {
          name: "read_file",
          arguments: { path: "src/utils/helper.js" },
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_123",
    content: JSON.stringify({ success: true, data: "function code here..." }),
  },
  {
    role: "assistant",
    content:
      "I've reviewed the code. Here's my refactoring approach:\n\n1. Extract the validation logic\n2. Use async/await instead of promises\n3. Add error handling\n\nShall I proceed?",
  },
  { role: "user", content: "Yes, please go ahead!" },
  {
    role: "assistant",
    content: "Refactoring complete!",
    tool_calls: [
      {
        id: "call_456",
        function: {
          name: "edit_file",
          arguments: {
            path: "src/utils/helper.js",
            old_text: "function oldCode() {}",
            new_text: "async function newCode() {}",
          },
        },
      },
    ],
  },
  {
    role: "tool",
    tool_call_id: "call_456",
    content: "File updated successfully",
  },
];

// Simulate message formatting (like in providers)
function formatMessageWithoutCache(msg) {
  if (msg.role === "assistant" && msg.tool_calls) {
    return {
      role: "assistant",
      content: msg.content || null,
      tool_calls: msg.tool_calls.map((tc) => ({
        id: tc.id || `call-${Date.now()}`,
        type: "function",
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc.function.arguments),
        },
      })),
    };
  }
  if (msg.role === "tool") {
    return {
      role: "tool",
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
      tool_call_id: msg.tool_call_id,
    };
  }
  return { role: msg.role, content: msg.content };
}

// Message format cache (per provider instance)
class CachedFormatter {
  constructor() {
    this._messageFormatCache = new WeakMap();
    this._messageStringCache = new Map();
    this._maxCacheSize = 200;
  }

  _getMessageCacheKey(msg) {
    const role = msg.role || "";
    const content =
      typeof msg.content === "string" ? msg.content.substring(0, 100) : "";
    const toolCalls = msg.tool_calls ? msg.tool_calls.length : 0;
    return `${role}:${content.length}:${toolCalls}`;
  }

  formatMessage(msg) {
    // Check WeakMap cache first
    if (this._messageFormatCache.has(msg)) {
      return this._messageFormatCache.get(msg);
    }

    // Check string cache
    const cacheKey = this._getMessageCacheKey(msg);
    if (this._messageStringCache.has(cacheKey)) {
      const cached = this._messageStringCache.get(cacheKey);
      this._messageFormatCache.set(msg, cached);
      return cached;
    }

    // Format message
    const formatted = formatMessageWithoutCache(msg);

    // Cache (limit size)
    if (this._messageStringCache.size < this._maxCacheSize) {
      this._messageStringCache.set(cacheKey, formatted);
    }
    this._messageFormatCache.set(msg, formatted);

    return formatted;
  }
}

function benchmark(name, fn, iterations = 1000) {
  // Warmup
  for (let i = 0; i < 50; i++) fn();

  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();

  const avg = (end - start) / iterations;
  const total = end - start;

  return { avg, total, iterations };
}

async function runBenchmarks() {
  console.log(
    `${C.bold}${C.blue}Nex Code — Message Serialization Benchmark${C.reset}`,
  );
  console.log(
    `${C.gray}Comparing cached vs uncached message formatting...${C.reset}\n`,
  );

  const iterations = 1000;

  // Benchmark 1: Without cache (baseline)
  const baseline = benchmark(
    "Without Cache",
    () => {
      for (const msg of SAMPLE_MESSAGES) {
        formatMessageWithoutCache(msg);
      }
    },
    iterations,
  );

  // Benchmark 2: With cache (first run - cache miss)
  const formatter = new CachedFormatter();
  const cacheMiss = benchmark(
    "With Cache (miss)",
    () => {
      for (const msg of SAMPLE_MESSAGES) {
        formatter.formatMessage(msg);
      }
    },
    iterations,
  );

  // Benchmark 3: With cache (subsequent runs - cache hit)
  const cacheHit = benchmark(
    "With Cache (hit)",
    () => {
      for (const msg of SAMPLE_MESSAGES) {
        formatter.formatMessage(msg);
      }
    },
    iterations,
  );

  // Print results
  console.log(`${C.gray}${"─".repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.blue}SERIALIZATION PERFORMANCE${C.reset}`);
  console.log(`${C.gray}${"─".repeat(60)}${C.reset}\n`);

  console.log(
    `  ${C.bold}Messages per iteration:${C.reset} ${SAMPLE_MESSAGES.length}`,
  );
  console.log(`  ${C.bold}Total iterations:${C.reset} ${iterations}\n`);

  console.log(`  ${C.bold}Without Cache:${C.reset}`);
  console.log(`    Average: ${formatMs(baseline.avg)}`);
  console.log(`    Total:   ${formatMs(baseline.total)}\n`);

  console.log(`  ${C.bold}With Cache (miss - first run):${C.reset}`);
  console.log(`    Average: ${formatMs(cacheMiss.avg)}`);
  console.log(`    Total:   ${formatMs(cacheMiss.total)}`);
  const missImprovement = (
    ((baseline.avg - cacheMiss.avg) / baseline.avg) *
    100
  ).toFixed(1);
  console.log(
    `    ${missImprovement > 0 ? C.green : C.red}(${missImprovement > 0 ? "+" : ""}${missImprovement}% vs baseline)${C.reset}\n`,
  );

  console.log(`  ${C.bold}With Cache (hit - subsequent):${C.reset}`);
  console.log(`    Average: ${formatMs(cacheHit.avg)}`);
  console.log(`    Total:   ${formatMs(cacheHit.total)}`);
  const hitImprovement = (
    ((baseline.avg - cacheHit.avg) / baseline.avg) *
    100
  ).toFixed(1);
  console.log(
    `    ${hitImprovement > 0 ? C.green : C.red}(${hitImprovement > 0 ? "+" : ""}${hitImprovement}% vs baseline)${C.reset}\n`,
  );

  // Summary
  const savings = baseline.total - cacheHit.total;
  const savingsPercent = ((savings / baseline.total) * 100).toFixed(1);

  console.log(
    `${C.bold}${C.green}╔═══════════════════════════════════════════════════════════╗${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}║${C.reset}  ${C.bold}SERIALIZATION CACHING SUMMARY${C.reset}                        ${C.bold}${C.green}║${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}╠═══════════════════════════════════════════════════════════╣${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}║${C.reset}  Time saved per ${iterations} iterations: ${C.bold}${formatMs(savings).padStart(10)}${C.reset}  ${C.green}(-${savingsPercent}%)${C.reset}  ${C.bold}${C.green}║${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}║${C.reset}  Estimated savings per API call: ${C.bold}${formatMs((savings / iterations) * SAMPLE_MESSAGES.length).padStart(6)}${C.reset}          ${C.bold}${C.green}║${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}╚═══════════════════════════════════════════════════════════╝${C.reset}`,
  );

  console.log(`\n${C.bold}${C.yellow}Recommendation:${C.reset}`);
  if (savingsPercent > 50) {
    console.log(
      `  ${C.green}●${C.reset} Excellent! Caching provides significant speedup (${savingsPercent}%).`,
    );
  } else if (savingsPercent > 20) {
    console.log(
      `  ${C.yellow}●${C.reset} Good improvement (${savingsPercent}%). Worth implementing.`,
    );
  } else {
    console.log(
      `  ${C.gray}●${C.reset} Marginal improvement (${savingsPercent}%). Consider if complexity is worth it.`,
    );
  }

  console.log();
}

// Run
runBenchmarks().catch((err) => {
  console.error(`${C.red}Benchmark failed:${C.reset}`, err);
  process.exit(1);
});

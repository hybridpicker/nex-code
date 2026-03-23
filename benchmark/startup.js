#!/usr/bin/env node
/**
 * Startup Time Benchmark for Nex Code
 *
 * Measures time to:
 * 1. Module loading (require time)
 * 2. REPL initialization
 * 3. Context gathering
 * 4. First prompt render
 *
 * Run: node benchmark/startup.js
 */

const { performance } = require("perf_hooks");
const path = require("path");

// Color helpers
const C = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

// Metrics storage
const metrics = {
  moduleLoads: new Map(),
  phases: new Map(),
  total: 0,
};

let startTime;

function mark(phase) {
  const now = performance.now();
  const prev = metrics.phases.get(phase);

  if (prev) {
    const delta = now - prev.start;
    metrics.phases.set(phase, { start: now, delta });
  } else {
    metrics.phases.set(phase, { start: now, delta: 0 });
  }

  return now;
}

function measureModuleLoad(moduleName, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();

  metrics.moduleLoads.set(moduleName, {
    time: end - start,
    size: getResultSize(result),
  });

  return result;
}

function getResultSize(result) {
  if (!result) return 0;
  try {
    return JSON.stringify(result).length;
  } catch {
    return 0;
  }
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(0)}ms`;
}

function printTable(title, data, valueFn) {
  console.log(`\n${C.bold}${C.blue}${title}${C.reset}`);
  console.log(`${C.gray}${"─".repeat(60)}${C.reset}`);

  const sorted = [...data].sort((a, b) => valueFn(b) - valueFn(a));
  const max = valueFn(sorted[0]) || 1;

  for (const [name, value] of sorted) {
    const ms = valueFn(value);
    const barLen = Math.max(0, Math.min(30, Math.round((ms / max) * 30)));
    const bar = "█".repeat(barLen) + "░".repeat(Math.max(0, 30 - barLen));
    const color = ms > 50 ? C.red : ms > 20 ? C.yellow : C.green;

    console.log(
      `  ${name.padEnd(35)} ${color}${formatMs(ms).padStart(10)}${C.reset} ${C.gray}${bar}${C.reset}`,
    );
  }
}

function printSummary() {
  console.log(
    `\n${C.bold}${C.green}╔═══════════════════════════════════════════════════════════╗${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}║${C.reset}  ${C.bold}STARTUP BENCHMARK SUMMARY${C.reset}                                ${C.bold}${C.green}║${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}╠═══════════════════════════════════════════════════════════╣${C.reset}`,
  );

  const total = metrics.total;
  const target = 50;
  const status =
    total <= target ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`;

  console.log(
    `${C.bold}${C.green}║${C.reset}  Total Startup Time: ${C.bold}${formatMs(total).padStart(10)}${C.reset}  (Target: ${target}ms)  ${status}  ${C.bold}${C.green}║${C.reset}`,
  );
  console.log(
    `${C.bold}${C.green}╚═══════════════════════════════════════════════════════════╝${C.reset}`,
  );
}

async function runBenchmarks() {
  console.log(`${C.bold}${C.blue}Nex Code — Startup Benchmark${C.reset}`);
  console.log(
    `${C.gray}Measuring module load times and initialization phases...${C.reset}`,
  );

  startTime = performance.now();

  // Phase 1: Core module loading
  mark("core-modules");
  measureModuleLoad("ui.js", () => require("../cli/ui"));
  measureModuleLoad("tools.js", () => require("../cli/tools"));
  measureModuleLoad("agent.js", () => require("../cli/agent"));
  measureModuleLoad("context.js", () => require("../cli/context"));
  measureModuleLoad("context-engine.js", () =>
    require("../cli/context-engine"),
  );
  measureModuleLoad("session.js", () => require("../cli/session"));
  measureModuleLoad("memory.js", () => require("../cli/memory"));
  measureModuleLoad("permissions.js", () => require("../cli/permissions"));
  measureModuleLoad("tool-validator.js", () =>
    require("../cli/tool-validator"),
  );
  measureModuleLoad("tool-tiers.js", () => require("../cli/tool-tiers"));
  mark("core-modules");

  // Phase 2: Provider loading
  mark("providers");
  measureModuleLoad("providers/registry", () =>
    require("../cli/providers/registry"),
  );
  measureModuleLoad("providers/openai", () =>
    require("../cli/providers/openai"),
  );
  measureModuleLoad("providers/anthropic", () =>
    require("../cli/providers/anthropic"),
  );
  measureModuleLoad("providers/gemini", () =>
    require("../cli/providers/gemini"),
  );
  measureModuleLoad("providers/ollama", () =>
    require("../cli/providers/ollama"),
  );
  measureModuleLoad("providers/local", () => require("../cli/providers/local"));
  mark("providers");

  // Phase 3: Utilities
  mark("utilities");
  measureModuleLoad("render.js", () => require("../cli/render"));
  measureModuleLoad("git.js", () => require("../cli/git"));
  measureModuleLoad("tasks.js", () => require("../cli/tasks"));
  measureModuleLoad("sub-agent.js", () => require("../cli/sub-agent"));
  measureModuleLoad("mcp.js", () => require("../cli/mcp"));
  measureModuleLoad("hooks.js", () => require("../cli/hooks"));
  measureModuleLoad("diff.js", () => require("../cli/diff"));
  measureModuleLoad("file-history.js", () => require("../cli/file-history"));
  measureModuleLoad("skills.js", () => require("../cli/skills"));
  measureModuleLoad("picker.js", () => require("../cli/picker"));
  mark("utilities");

  // Phase 4: Context gathering simulation
  mark("context-gather");
  const { gatherProjectContext } = require("../cli/context");
  await gatherProjectContext(process.cwd());
  mark("context-gather");

  // Phase 5: System prompt build
  mark("system-prompt");
  const { buildSystemPrompt } = require("../cli/agent");
  await buildSystemPrompt();
  mark("system-prompt");

  metrics.total = performance.now() - startTime;

  // Print results
  console.log("\n" + C.gray + "─".repeat(60) + C.reset);

  printTable("MODULE LOAD TIMES", metrics.moduleLoads, (v) => v.time);

  // Phase summary
  const phaseSummary = new Map();
  for (const [name, data] of metrics.phases) {
    if (data.delta > 0) {
      phaseSummary.set(name, { time: data.delta });
    }
  }

  if (phaseSummary.size > 0) {
    printTable("INITIALIZATION PHASES", phaseSummary, (v) => v.time);
  }

  printSummary();

  // Recommendations
  console.log(`\n${C.bold}${C.yellow}Recommendations:${C.reset}`);

  const slowModules = [...metrics.moduleLoads]
    .filter(([, v]) => v.time > 20)
    .sort((a, b) => b[1].time - a[1].time);

  if (slowModules.length > 0) {
    console.log(
      `  ${C.red}●${C.reset} Slow modules (>20ms) — consider lazy loading:`,
    );
    for (const [name, data] of slowModules.slice(0, 5)) {
      console.log(`    - ${name} (${formatMs(data.time)})`);
    }
  }

  const slowPhases = [...metrics.phases]
    .filter(([, v]) => v.delta > 30)
    .sort((a, b) => b[1].delta - a[1].delta);

  if (slowPhases.length > 0) {
    console.log(
      `  ${C.yellow}●${C.reset} Slow phases (>30ms) — optimization potential:`,
    );
    for (const [name, data] of slowPhases) {
      console.log(`    - ${name} (${formatMs(data.delta)})`);
    }
  }

  if (metrics.total <= 50) {
    console.log(
      `  ${C.green}●${C.reset} Startup time is within target (<50ms) ✓`,
    );
  }

  console.log();
}

// Run
runBenchmarks().catch((err) => {
  console.error(`${C.red}Benchmark failed:${C.reset}`, err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Performance Benchmark for Nex Code Optimizations
 * 
 * Tests the key optimized areas:
 * 1. System Prompt Build-Time (cached vs uncached)
 * 2. Token Estimation (cached vs uncached)
 * 3. Context Gathering (cached vs uncached)
 * 4. Tool Validation (cached vs uncached)
 * 5. Tool Filtering (cached vs uncached)
 */

const { performance } = require('perf_hooks');

// Color helpers
const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(msg) {
  console.log(`${C.gray}${msg}${C.reset}`);
}

function benchmark(name, fn, iterations = 100) {
  // Warmup
  for (let i = 0; i < 10; i++) fn();
  
  // Measure
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  
  const avg = (end - start) / iterations;
  const total = end - start;
  
  return { avg, total, iterations };
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 100) return `${ms.toFixed(2)}ms`;
  return `${ms.toFixed(1)}ms`;
}

async function runBenchmarks() {
  console.log(`\n${C.bold}╔════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║   Nex Code Performance Benchmark                   ║${C.reset}`);
  console.log(`${C.bold}╚════════════════════════════════════════════════════╝${C.reset}\n`);

  const results = [];

  // ─────────────────────────────────────────────────────────
  // 1. System Prompt Build-Time
  // ─────────────────────────────────────────────────────────
  console.log(`${C.blue}1. System Prompt Build-Time${C.reset}`);
  log('   Testing: buildSystemPrompt() with caching\n');
  
  const { buildSystemPrompt, invalidateSystemPromptCache } = require('./cli/agent');
  
  // First call (cache miss)
  const firstCall = benchmark('First Call (cold)', async () => {
    invalidateSystemPromptCache();
    await buildSystemPrompt();
  }, 10);
  
  // Subsequent calls (cache hit)
  const cachedCall = benchmark('Cached (hot)', async () => {
    await buildSystemPrompt();
  }, 100);
  
  console.log(`   ${C.yellow}Cold:${C.reset}   ${formatMs(firstCall.avg)} (avg of ${firstCall.iterations})`);
  console.log(`   ${C.green}Cached:${C.reset} ${formatMs(cachedCall.avg)} (avg of ${cachedCall.iterations})`);
  const speedup1 = (firstCall.avg / cachedCall.avg).toFixed(1);
  console.log(`   ${C.bold}Speedup: ${speedup1}×${C.reset}\n`);
  
  results.push({ name: 'System Prompt', cold: firstCall.avg, cached: cachedCall.avg, speedup: speedup1 });

  // ─────────────────────────────────────────────────────────
  // 2. Token Estimation
  // ─────────────────────────────────────────────────────────
  console.log(`${C.blue}2. Token Estimation${C.reset}`);
  log('   Testing: estimateTokens() with string caching\n');
  
  const { estimateTokens } = require('./cli/context-engine');
  
  const testString = 'This is a test string for token estimation. '.repeat(100);
  
  // First call (cache miss)
  const tokenFirst = benchmark('First Call', () => {
    estimateTokens(testString);
  }, 1000);
  
  // Cached call
  const tokenCached = benchmark('Cached', () => {
    estimateTokens(testString);
  }, 10000);
  
  console.log(`   ${C.yellow}First:${C.reset}  ${formatMs(tokenFirst.avg)} (avg of ${tokenFirst.iterations})`);
  console.log(`   ${C.green}Cached:${C.reset} ${formatMs(tokenCached.avg)} (avg of ${tokenCached.iterations})`);
  const speedup2 = (tokenFirst.avg / tokenCached.avg).toFixed(1);
  console.log(`   ${C.bold}Speedup: ${speedup2}×${C.reset}\n`);
  
  results.push({ name: 'Token Estimation', cold: tokenFirst.avg, cached: tokenCached.avg, speedup: speedup2 });

  // ─────────────────────────────────────────────────────────
  // 3. Context Gathering
  // ─────────────────────────────────────────────────────────
  console.log(`${C.blue}3. Context Gathering${C.reset}`);
  log('   Testing: gatherProjectContext() with file caching\n');
  
  const { gatherProjectContext, _clearContextCache } = require('./cli/context');
  
  // First call (cache miss)
  const contextFirst = benchmark('First Call', async () => {
    _clearContextCache();
    await gatherProjectContext(process.cwd());
  }, 10);
  
  // Cached call
  const contextCached = benchmark('Cached', async () => {
    await gatherProjectContext(process.cwd());
  }, 100);
  
  console.log(`   ${C.yellow}Cold:${C.reset}   ${formatMs(contextFirst.avg)} (avg of ${contextFirst.iterations})`);
  console.log(`   ${C.green}Cached:${C.reset} ${formatMs(contextCached.avg)} (avg of ${contextCached.iterations})`);
  const speedup3 = (contextFirst.avg / contextCached.avg).toFixed(1);
  console.log(`   ${C.bold}Speedup: ${speedup3}×${C.reset}\n`);
  
  results.push({ name: 'Context Gathering', cold: contextFirst.avg, cached: contextCached.avg, speedup: speedup3 });

  // ─────────────────────────────────────────────────────────
  // 4. Tool Validation
  // ─────────────────────────────────────────────────────────
  console.log(`${C.blue}4. Tool Validation${C.reset}`);
  log('   Testing: validateToolArgs() with schema caching\n');
  
  const { validateToolArgs, clearSchemaCache } = require('./cli/tool-validator');
  
  const testArgs = { path: 'test.txt', content: 'Hello World' };
  
  // First call (cache miss)
  const validationFirst = benchmark('First Call', () => {
    clearSchemaCache();
    validateToolArgs('write_file', testArgs);
  }, 100);
  
  // Cached call
  const validationCached = benchmark('Cached', () => {
    validateToolArgs('write_file', testArgs);
  }, 1000);
  
  console.log(`   ${C.yellow}Cold:${C.reset}   ${formatMs(validationFirst.avg)} (avg of ${validationFirst.iterations})`);
  console.log(`   ${C.green}Cached:${C.reset} ${formatMs(validationCached.avg)} (avg of ${validationCached.iterations})`);
  const speedup4 = (validationFirst.avg / validationCached.avg).toFixed(1);
  console.log(`   ${C.bold}Speedup: ${speedup4}×${C.reset}\n`);
  
  results.push({ name: 'Tool Validation', cold: validationFirst.avg, cached: validationCached.avg, speedup: speedup4 });

  // ─────────────────────────────────────────────────────────
  // 5. Tool Filtering
  // ─────────────────────────────────────────────────────────
  console.log(`${C.blue}5. Tool Filtering${C.reset}`);
  log('   Testing: getCachedFilteredTools() with model caching\n');
  
  const { getCachedFilteredTools, clearToolFilterCache } = require('./cli/agent');
  const { TOOL_DEFINITIONS } = require('./cli/tools');
  const { getSkillToolDefinitions } = require('./cli/skills');
  const { getMCPToolDefinitions } = require('./cli/mcp');
  
  const allTools = [...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()];
  
  // First call (cache miss)
  const filterFirst = benchmark('First Call', () => {
    clearToolFilterCache();
    getCachedFilteredTools(allTools);
  }, 100);
  
  // Cached call
  const filterCached = benchmark('Cached', () => {
    getCachedFilteredTools(allTools);
  }, 1000);
  
  console.log(`   ${C.yellow}Cold:${C.reset}   ${formatMs(filterFirst.avg)} (avg of ${filterFirst.iterations})`);
  console.log(`   ${C.green}Cached:${C.reset} ${formatMs(filterCached.avg)} (avg of ${filterCached.iterations})`);
  const speedup5 = (filterFirst.avg / filterCached.avg).toFixed(1);
  console.log(`   ${C.bold}Speedup: ${speedup5}×${C.reset}\n`);
  
  results.push({ name: 'Tool Filtering', cold: filterFirst.avg, cached: filterCached.avg, speedup: speedup5 });

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  console.log(`${C.bold}╔════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║   Summary                                          ║${C.reset}`);
  console.log(`${C.bold}╚════════════════════════════════════════════════════╝${C.reset}\n`);
  
  console.log(`   ${C.bold}Optimization          Cold      Cached    Speedup${C.reset}`);
  console.log(`   ${C.gray}─────────────────────────────────────────────────${C.reset}`);
  
  for (const r of results) {
    const namePad = r.name.padEnd(20);
    const coldPad = formatMs(r.cold).padStart(10);
    const cachedPad = formatMs(r.cached).padStart(10);
    const speedupPad = `${r.speedup}×`.padStart(7);
    console.log(`   ${namePad} ${coldPad}  ${cachedPad}  ${C.green}${speedupPad}${C.reset}`);
  }
  
  const avgSpeedup = (results.reduce((sum, r) => sum + parseFloat(r.speedup), 0) / results.length).toFixed(1);
  console.log(`\n   ${C.bold}Average Speedup: ${C.green}${avgSpeedup}×${C.reset}\n`);
  
  console.log(`${C.gray}   Note: Actual performance gains depend on project size,${C.reset}`);
  console.log(`${C.gray}   conversation length, and tool usage patterns.${C.reset}\n`);
}

// Run benchmarks
runBenchmarks().catch(err => {
  console.error(`${C.red}Benchmark failed:${C.reset}`, err);
  process.exit(1);
});

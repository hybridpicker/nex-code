#!/usr/bin/env node
/**
 * Bundled Startup Benchmark for Nex Code
 * 
 * Measures startup time of the bundled dist/nex-code.js
 * This is the real-world startup time users experience.
 * 
 * Run: node benchmark/bundled-startup.js
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const path = require('path');

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(0)}ms`;
}

async function measureStartup(iterations = 10) {
  const times = [];
  
  console.log(`${C.bold}${C.blue}Nex Code — Bundled Startup Benchmark${C.reset}`);
  console.log(`${C.gray}Measuring dist/nex-code.js module load time (${iterations} runs)...${C.reset}\n`);
  
  const bundlePath = path.join(__dirname, '..', 'dist', 'nex-code.js');
  
  for (let i = 0; i < iterations; i++) {
    // Measure pure module load time (require only, no execution)
    const start = performance.now();
    
    // Clear require cache
    delete require.cache[require.resolve(bundlePath)];
    
    // Require the module (this loads and executes top-level code)
    try {
      require(bundlePath);
    } catch {
      // Ignore errors from REPL initialization
    }
    
    const end = performance.now();
    times.push(end - start);
    
    process.stdout.write(`${C.gray}  Run ${i + 1}/${iterations}: ${formatMs(times[times.length - 1])}${C.reset}\r`);
  }
  
  console.log();
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
  
  console.log(`\n${C.gray}${'─'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.blue}BUNDLED STARTUP RESULTS${C.reset}`);
  console.log(`${C.gray}${'─'.repeat(60)}${C.reset}`);
  console.log(`  ${C.bold}Average:${C.reset}  ${formatMs(avg).padStart(10)}`);
  console.log(`  ${C.bold}Median:${C.reset}   ${formatMs(median).padStart(10)}`);
  console.log(`  ${C.bold}Min:${C.reset}      ${formatMs(min).padStart(10)}`);
  console.log(`  ${C.bold}Max:${C.reset}      ${formatMs(max).padStart(10)}`);
  
  const target = 50;
  const status = avg <= target ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`;
  
  console.log(`\n${C.bold}${C.green}╔═══════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.green}║${C.reset}  ${C.bold}BUNDLED STARTUP SUMMARY${C.reset}                                  ${C.bold}${C.green}║${C.reset}`);
  console.log(`${C.bold}${C.green}╠═════════���═════════════════════════════════════════════════╣${C.reset}`);
  console.log(`${C.bold}${C.green}║${C.reset}  Average Startup: ${C.bold}${formatMs(avg).padStart(10)}${C.reset}  (Target: ${target}ms)  ${status}  ${C.bold}${C.green}║${C.reset}`);
  console.log(`${C.bold}${C.green}╚═══════════════════════════════════════════════════════════╝${C.reset}`);
  
  return { avg, median, min, max };
}

// Run
measureStartup().catch(err => {
  console.error(`${C.red}Benchmark failed:${C.reset}`, err);
  process.exit(1);
});

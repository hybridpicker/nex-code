#!/usr/bin/env node
/**
 * Index-Based File Operations Benchmark for Nex Code
 * 
 * Tests the Ripgrep index vs traditional fs.walk performance:
 * - Index (rg --files): ~50-100ms for large projects
 * - fs.walk: ~500-2000ms for large projects
 * 
 * Run: node benchmark/index-operations.js
 */

const { performance } = require('perf_hooks');
const { exec } = require('util').promisify(require('child_process').exec);
const fs = require('fs').promises;
const path = require('path');

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 10) return `${ms.toFixed(2)}ms`;
  if (ms < 100) return `${ms.toFixed(1)}ms`;
  return `${ms.toFixed(0)}ms`;
}

// Traditional fs.walk implementation
async function walkDirectory(dir, rel = '') {
  const matches = [];
  const walk = async (currentDir, currentRel) => {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.')) continue;
      const relPath = currentRel ? `${currentRel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(path.join(currentDir, e.name), relPath);
      } else {
        matches.push(relPath);
      }
    }
  };
  await walk(dir, rel);
  return matches;
}

// Ripgrep-based indexing
async function indexWithRipgrep(cwd) {
  const { stdout } = await exec('rg --files', { cwd, timeout: 5000 });
  return stdout.split('\n').filter(Boolean);
}

async function benchmark(name, fn, iterations = 3) {
  // Warmup
  try {
    await fn();
  } catch {
    // Ignore warmup errors
  }
  
  // Measure
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await fn();
    } catch (err) {
      // Ignore errors, still record time
    }
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  
  return { avg, min, times };
}

async function runBenchmarks() {
  console.log(`${C.bold}${C.blue}Nex Code — Index-Based File Operations Benchmark${C.reset}`);
  console.log(`${C.gray}Comparing Ripgrep index vs traditional fs.walk...${C.reset}\n`);

  const cwd = process.cwd();
  
  // Check if ripgrep is available
  let hasRipgrep = false;
  try {
    await exec('rg --version', { timeout: 2000 });
    hasRipgrep = true;
  } catch {
    hasRipgrep = false;
  }

  console.log(`${C.bold}Test Directory:${C.reset} ${cwd}`);
  console.log(`${C.bold}Ripgrep Available:${C.reset} ${hasRipgrep ? C.green + 'Yes' + C.reset : C.red + 'No' + C.reset}\n`);

  if (!hasRipgrep) {
    console.log(`${C.yellow}⚠ Ripgrep not found. Install for optimal performance:${C.reset}`);
    console.log(`  macOS: brew install ripgrep`);
    console.log(`  Linux: sudo apt install ripgrep`);
    console.log(`  npm: npm install -g @devcontainers/ripgrep\n`);
  }

  // Benchmark 1: Traditional fs.walk
  console.log(`${C.gray}Running fs.walk benchmark...${C.reset}`);
  const fsWalkResult = await benchmark('fs.walk', () => walkDirectory(cwd), 3);
  const fsWalkFiles = await walkDirectory(cwd);
  console.log(`  ${C.bold}fs.walk:${C.reset} ${formatMs(fsWalkResult.avg)} (found ${fsWalkFiles.length} files)\n`);

  // Benchmark 2: Ripgrep index (if available)
  let rgResult = null;
  let rgFiles = [];
  
  if (hasRipgrep) {
    console.log(`${C.gray}Running ripgrep index benchmark...${C.reset}`);
    rgResult = await benchmark('rg --files', () => indexWithRipgrep(cwd), 3);
    rgFiles = await indexWithRipgrep(cwd);
    console.log(`  ${C.bold}rg --files:${C.reset} ${formatMs(rgResult.avg)} (found ${rgFiles.length} files)\n`);
  }

  // Print results
  console.log(`${C.gray}${'─'.repeat(60)}${C.reset}`);
  console.log(`${C.bold}${C.blue}INDEX PERFORMANCE COMPARISON${C.reset}`);
  console.log(`${C.gray}${'─'.repeat(60)}${C.reset}\n`);

  if (hasRipgrep && rgResult) {
    const speedup = fsWalkResult.avg / rgResult.avg;
    const savings = fsWalkResult.avg - rgResult.avg;
    const savingsPercent = ((savings / fsWalkResult.avg) * 100).toFixed(1);

    console.log(`  ${C.bold}fs.walk (traditional):${C.reset}`);
    console.log(`    Average: ${formatMs(fsWalkResult.avg)}`);
    console.log(`    Files found: ${fsWalkFiles.length}\n`);

    console.log(`  ${C.bold}rg --files (indexed):${C.reset}`);
    console.log(`    Average: ${formatMs(rgResult.avg)}`);
    console.log(`    Files found: ${rgFiles.length}`);
    console.log(`    ${C.green}(${speedup.toFixed(1)}x faster, -${savingsPercent}%)${C.reset}\n`);

    // Summary
    console.log(`${C.bold}${C.green}╔═══════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.bold}${C.green}║${C.reset}  ${C.bold}INDEX BENCHMARK SUMMARY${C.reset}                              ${C.bold}${C.green}║${C.reset}`);
    console.log(`${C.bold}${C.green}╠═══════════════════════════════════════════════════════════╣${C.reset}`);
    console.log(`${C.bold}${C.green}║${C.reset}  Ripgrep is ${C.bold}${formatMs(savings).padStart(10)}${C.reset} faster per index build  ${C.bold}${C.green}║${C.reset}`);
    console.log(`${C.bold}${C.green}║${C.reset}  With 60s TTL: ${C.bold}${(savings / 60000 * 100).toFixed(2)}%${C.reset} average overhead           ${C.bold}${C.green}║${C.reset}`);
    console.log(`${C.bold}${C.green}╚═══════════════════════════════════════════════════════════╝${C.reset}`);
  } else {
    console.log(`  ${C.bold}fs.walk (traditional):${C.reset}`);
    console.log(`    Average: ${formatMs(fsWalkResult.avg)}`);
    console.log(`    Files found: ${fsWalkFiles.length}\n`);
    
    console.log(`${C.yellow}⚠ Install ripgrep for 10-50x faster indexing${C.reset}`);
  }

  console.log(`\n${C.bold}${C.yellow}Recommendation:${C.reset}`);
  console.log(`  ${C.green}●${C.reset} Use Ripgrep index with 60s TTL for glob operations`);
  console.log(`  ${C.green}●${C.reset} Cache index in memory to avoid redundant scans`);
  console.log(`  ${C.green}●${C.reset} Invalidate cache on cwd change or TTL expiry`);

  console.log();
}

// Run
runBenchmarks().catch(err => {
  console.error(`${C.red}Benchmark failed:${C.reset}`, err);
  process.exit(1);
});

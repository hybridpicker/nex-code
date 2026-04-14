#!/usr/bin/env node
/**
 * scripts/benchmark-realworld.js — Legacy alias for benchmark-reallife.js
 *
 * Kept for backwards compatibility with older docs, scripts, and local habits.
 * The canonical harness lives in scripts/benchmark-reallife.js.
 */

"use strict";

const benchmark = require("./benchmark-reallife");

if (require.main === module) {
  console.warn(
    "benchmark-realworld is deprecated; running benchmark-reallife instead.\n",
  );
  benchmark.main().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
  });
}

module.exports = benchmark;

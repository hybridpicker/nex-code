#!/usr/bin/env node
/**
 * scripts/build.js — esbuild bundler with feature flag injection
 *
 * Replaces the inline esbuild CLI commands in package.json.
 * Injects compile-time feature flag defines for dead-code elimination.
 *
 * Usage:
 *   node scripts/build.js                  # production build (minified, flags at defaults)
 *   node scripts/build.js --dev            # development build (no minify, watch mode)
 *   node scripts/build.js --flags.WATCH_MODE=true  # enable specific flag
 */

"use strict";

const esbuild = require("esbuild");
const { getBuildDefines } = require("../cli/feature-flags");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const isDev = args.includes("--dev");

// Parse --flags.NAME=value overrides
const flagOverrides = {};
for (const arg of args) {
  const match = arg.match(/^--flags\.(\w+)=(true|false|1|0)$/);
  if (match) {
    flagOverrides[match[1]] = match[2] === "true" || match[2] === "1";
  }
}

const defines = getBuildDefines(flagOverrides);
const external = ["axios", "dotenv", "playwright"];

const commonOpts = {
  platform: "node",
  target: "node18",
  external,
  define: defines,
  bundle: true,
};

async function build() {
  // Main CLI bundle
  await esbuild.build({
    ...commonOpts,
    entryPoints: ["bin/nex-code.js"],
    outfile: "dist/nex-code.js",
    minify: !isDev,
  });

  // Benchmark bundle
  await esbuild.build({
    ...commonOpts,
    entryPoints: ["cli/benchmark.js"],
    outfile: "dist/benchmark.js",
    minify: !isDev,
  });

  // Copy skills (not bundled — contain dynamic tool definitions)
  const skillsSrc = path.join(__dirname, "..", "cli", "skills");
  const skillsDst = path.join(__dirname, "..", "dist", "skills");
  if (fs.existsSync(skillsDst)) {
    fs.rmSync(skillsDst, { recursive: true });
  }
  fs.cpSync(skillsSrc, skillsDst, { recursive: true });

  // Report
  const flagSummary = Object.entries(defines)
    .map(([k, v]) => `  ${k} = ${v}`)
    .join("\n");
  if (!isDev) {
    console.log(`Feature flags:\n${flagSummary}`);
  }
}

if (isDev) {
  // Watch mode for development
  esbuild.context({
    ...commonOpts,
    entryPoints: ["bin/nex-code.js"],
    outfile: "dist/nex-code.js",
    minify: false,
  }).then((ctx) => {
    ctx.watch();
    console.log("Watching for changes...");
  });
} else {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

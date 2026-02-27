#!/usr/bin/env node
/**
 * Nex Code v0.1.0 — Agentic Coding CLI
 * Entrypoint: loads .env, starts REPL.
 */

const path = require('path');

// Load .env from CLI install dir (fallback) and project dir
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // Also check CWD

const { startREPL } = require('../cli/index');

startREPL();

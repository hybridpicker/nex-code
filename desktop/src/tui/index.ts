/**
 * src/tui/index.ts — TUI Entry Point
 *
 * Starts the Cyber-Obsidian Terminal UI. Loads configuration,
 * initializes mock providers/tools, wires up the agent loop,
 * and renders the dashboard.
 */

import * as blessed from 'blessed';
import { loadEnvConfig, validateConfig } from '../config/env';
import { createAgentLoop } from '../state/agent-loop';
import { createCostCalculator } from '../state/cost-calculator';
import { MockProvider } from '../providers/mock';
import { createProviderRouter } from '../state/routing';
import { MockFileSystem, MockGit, MockSSH, MockDocker, MockShell } from '../tools/mock';
import { EventBus, eventBus } from './event-bus';
import { createApp } from './app';
import { DEFAULT_CONFIG } from '../config/env';

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Load environment config
  const config = loadEnvConfig();
  const validation = validateConfig(config);

  if (!validation.valid) {
    console.error('Configuration errors:');
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:');
    for (const warn of validation.warnings) {
      console.warn(`  - ${ warn}`);
    }
  }

  // ─── Initialize state ───────────────────────────────────────────────────

  const agentLoop = createAgentLoop({ maxIterations: 3 });
  const costCalc = createCostCalculator({ budgetLimit: config.budgetLimit });

  // ─── Initialize mock providers ──────────────────────────────────────────

  const ollama = new MockProvider({
    id: 'ollama',
    name: 'Ollama Cloud',
    available: !!config.ollamaApiKey,
    responses: [{ content: 'Ollama Cloud response' }],
  });

  const openai = new MockProvider({
    id: 'openai',
    name: 'OpenAI',
    available: !!config.openaiApiKey,
    responses: [{ content: 'OpenAI response' }],
  });

  const anthropic = new MockProvider({
    id: 'anthropic',
    name: 'Anthropic',
    available: !!config.anthropicApiKey,
    responses: [{ content: 'Anthropic response' }],
  });

  const gemini = new MockProvider({
    id: 'gemini',
    name: 'Gemini',
    available: !!config.geminiApiKey,
    responses: [{ content: 'Gemini response' }],
  });

  const deepseek = new MockProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    available: !!config.deepseekApiKey,
    responses: [{ content: 'DeepSeek response' }],
  });

  // ─── Initialize router ──────────────────────────────────────────────────

  const router = createProviderRouter({
    providers: { ollama, openai, anthropic, gemini, deepseek },
    config,
    costCalculator: costCalc,
    phaseModels: {
      plan: 'qwen3-coder:480b',
      implement: null, // use default
      verify: 'devstral-small-2:24b',
    },
  });

  // ─── Initialize mock tools ──────────────────────────────────────────────

  const fs = new MockFileSystem();
  const git = new MockGit();
  const ssh = new MockSSH();
  const docker = new MockDocker();
  const shell = new MockShell();

  // Seed some demo files
  fs.addFile('/home/project/src/index.ts', 'export function main() { return "nex-code"; }');
  fs.addFile('/home/project/src/telemetry/collector.ts', 'export class Collector {}');
  fs.addFile('/home/project/package.json', '{"name": "nex-code"}');

  // ─── Build demo data ────────────────────────────────────────────────────

  const demoData = {
    project: 'nex-code',
    branch: 'feat/telemetry-refactor',
    model: router.getModelForPhase('plan'),
    provider: config.defaultProvider,
    health: 'Excellent',
    budget: { used: costCalc.getSnapshot().used, limit: config.budgetLimit },
    tests: { passed: 109, failed: 0, total: 109 },
    safety: { score: 98, status: 'Safe to merge' },
    tokens: { used: 312400, total: 1000000 },
    requests: 158,
    toolActions: [
      { tool: 'repo.scan', detail: 'Scanned 247 files', time: '2s ago' },
      { tool: 'file.read', detail: 'src/telemetry/collector.ts', time: '5s ago' },
      { tool: 'git.diff', detail: '3 files changed', time: '15s ago' },
    ],
    costHistory: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      tokens: Math.floor(Math.random() * 15000 + 5000),
    })),
    shortcutChips: ['/plan', '/impl', '/verify', '/bench', '/git', '/deploy'],
  };

  // ─── Create the TUI ─────────────────────────────────────────────────────

  const screen = blessed.screen({
    smartCSR: true,
    title: 'nex-code — Cyber-Obsidian',
    cursor: { artificial: true, shape: 'line' as const, blink: true, color: 'white' },
    terminal: 'xterm-256color',
    fullUnicode: true,
  });

  const app = createApp(screen, {
    config,
    agentLoop,
    router,
    costCalc,
    tools: { fs, git, ssh, docker, shell },
    demoData,
  });

  // ─── Handle exit ────────────────────────────────────────────────────────

  screen.key(['q', 'C-c'], () => {
    screen.destroy();
    process.exit(0);
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  screen.render();
}

// Run
main().catch((err) => {
  console.error('TUI failed to start:', err);
  process.exit(1);
});

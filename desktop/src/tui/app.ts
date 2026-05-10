/**
 * src/tui/app.ts — TUI Application Shell
 *
 * Creates the blessed screen layout with all panels:
 *   Header (top)
 *   Left Sidebar | Center | Right Sidebar
 *   Command Bar (bottom)
 *
 * Cyber-Obsidian theme: #0D1117 deep background, emerald/cyan accents.
 */

import * as blessed from 'blessed';
import { EventBus, eventBus, TuiEventType } from './event-bus';
import { C, STYLE, BORDER, LAYOUT, formatUSD, formatTokens, label, emerald, cyan, dim } from './theme';
import { AgentLoop, AgentState } from '../state/agent-loop';
import { ProviderRouter } from '../state/routing';
import { CostCalculator, CostSnapshot } from '../state/cost-calculator';
import { EnvConfig } from '../config/env';
import { MockFileSystem, MockGit, MockSSH, MockDocker, MockShell } from '../tools/mock';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppConfig {
  config: EnvConfig;
  agentLoop: AgentLoop;
  router: ProviderRouter;
  costCalc: CostCalculator;
  tools: {
    fs: MockFileSystem;
    git: MockGit;
    ssh: MockSSH;
    docker: MockDocker;
    shell: MockShell;
  };
  demoData: {
    project: string;
    branch: string;
    model: string;
    provider: string;
    health: string;
    budget: { used: number; limit: number };
    tests: { passed: number; failed: number; total: number };
    safety: { score: number; status: string };
    tokens: { used: number; total: number };
    requests: number;
    toolActions: Array<{ tool: string; detail: string; time: string }>;
    costHistory: Array<{ hour: number; tokens: number }>;
    shortcutChips: string[];
  };
}

// ─── Create App ───────────────────────────────────────────────────────────────

export function createApp(screen: blessed.Widgets.Screen, appConfig: AppConfig): void {
  const { config, agentLoop, router, costCalc, tools, demoData } = appConfig;

  // ─── Header ─────────────────────────────────────────────────────────────

  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: LAYOUT.HEADER_H,
    border: BORDER.glass,
    style: {
      bg: C.BG_PANEL,
      fg: C.TEXT_PRIMARY,
    },
    content: buildHeader(demoData),
    tags: true,
  });

  // ─── Left Sidebar ───────────────────────────────────────────────────────

  const sidebarL = blessed.box({
    parent: screen,
    top: LAYOUT.HEADER_H,
    left: 0,
    width: LAYOUT.SIDEBAR_L_W,
    height: `100%-${LAYOUT.HEADER_H + LAYOUT.CMD_H}`,
    border: BORDER.glass,
    style: {
      bg: C.BG_PANEL,
      fg: C.TEXT_PRIMARY,
    },
    content: buildSidebar(demoData, tools),
    tags: true,
    scrollable: true,
    scrollbar: { ch: ' ', style: { bg: C.BORDER } },
    mouse: true,
    keys: true,
    vi: true,
  });

  // ─── Center ─────────────────────────────────────────────────────────────

  const center = blessed.box({
    parent: screen,
    top: LAYOUT.HEADER_H,
    left: LAYOUT.SIDEBAR_L_W,
    width: `100%-${LAYOUT.SIDEBAR_L_W + LAYOUT.SIDEBAR_R_W}`,
    height: `100%-${LAYOUT.HEADER_H + LAYOUT.CMD_H}`,
    border: BORDER.glass,
    style: {
      bg: C.BG_DEEP,
      fg: C.TEXT_PRIMARY,
    },
    content: buildCenter(agentLoop, demoData),
    tags: true,
    scrollable: true,
    scrollbar: { ch: ' ', style: { bg: C.BORDER } },
    mouse: true,
    keys: true,
    vi: true,
  });

  // ─── Right Sidebar ──────────────────────────────────────────────────────

  const sidebarR = blessed.box({
    parent: screen,
    top: LAYOUT.HEADER_H,
    right: 0,
    width: LAYOUT.SIDEBAR_R_W,
    height: `100%-${LAYOUT.HEADER_H + LAYOUT.CMD_H}`,
    border: BORDER.glass,
    style: {
      bg: C.BG_PANEL,
      fg: C.TEXT_PRIMARY,
    },
    content: buildRightSidebar(demoData, costCalc),
    tags: true,
    scrollable: true,
    scrollbar: { ch: ' ', style: { bg: C.BORDER } },
    mouse: true,
    keys: true,
    vi: true,
  });

  // ─── Command Bar ────────────────────────────────────────────────────────

  const commandBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: LAYOUT.CMD_H,
    border: BORDER.glass,
    style: {
      bg: C.BG_SURFACE,
      fg: C.TEXT_PRIMARY,
    },
    tags: true,
  });

  // Command input
  let commandValue = '';
  const commandInput = blessed.textbox({
    parent: commandBar,
    top: 0,
    left: 1,
    width: `100%-${LAYOUT.SIDEBAR_R_W + 2}`,
    height: LAYOUT.CMD_H - 1,
    inputOnFocus: true,
    style: {
      fg: C.TEXT_PRIMARY,
      bg: C.BG_SURFACE,
    },
    border: { type: 'line' as const, fg: C.BG_SURFACE },
  });

  // Shortcut chips
  const chipsText = demoData.shortcutChips.map((c) => `{${C.ACCENT_EMERALD}-fg}${c}{/${C.ACCENT_EMERALD}-fg}`).join('  ');
  const chips = blessed.text({
    parent: commandBar,
    top: 0,
    right: 1,
    width: LAYOUT.SIDEBAR_R_W - 2,
    height: 1,
    content: chipsText,
    style: {
      fg: C.TEXT_SECONDARY,
      bg: C.BG_SURFACE,
    },
    tags: true,
  });

  commandInput.setContent(`{${C.ACCENT_EMERALD}-fg}>{/${C.ACCENT_EMERALD}-fg} `);
  commandInput.focus();

  // ─── Event wiring ───────────────────────────────────────────────────────

  // Agent loop → UI updates
  agentLoop.on('phaseChange', (event) => {
    center.setContent(buildCenter(agentLoop, demoData));
    updateHeader(header, demoData, agentLoop.getState());
    screen.render();
  });

  agentLoop.on('error', (event) => {
    center.setContent(buildCenter(agentLoop, demoData));
    screen.render();
  });

  agentLoop.on('complete', (event) => {
    center.setContent(buildCenter(agentLoop, demoData));
    updateHeader(header, demoData, agentLoop.getState());
    screen.render();
  });

  // Budget updates
  eventBus.on('budget:update', (event) => {
    const snapshot = costCalc.getSnapshot();
    demoData.budget.used = snapshot.used;
    updateHeader(header, demoData, agentLoop.getState());
    sidebarR.setContent(buildRightSidebar(demoData, costCalc));
    screen.render();
  });

  // Handle resize
  screen.on('resize', () => {
    eventBus.emit('resize', {
      width: screen.width as number,
      height: screen.height as number,
    });
  });

  // ─── Command handler ────────────────────────────────────────────────────

  commandInput.on('submit', (value: string) => {
    const cmd = value.replace(/^>\s*/, '').trim();
    if (!cmd) return;

    eventBus.emit('command:submit', { command: cmd, timestamp: Date.now() });

    // Route known commands
    if (cmd === '/plan') {
      agentLoop.start();
      agentLoop.setPhaseData({ action: 'plan', detail: 'Repository scan & analysis' });
    } else if (cmd === '/impl' || cmd === '/implement') {
      if (agentLoop.getState().phase === 'plan') {
        agentLoop.advancePhase('implement');
        agentLoop.setPhaseData({ action: 'implement', files: [] });
      }
    } else if (cmd === '/verify') {
      if (agentLoop.getState().phase === 'implement') {
        agentLoop.advancePhase('verify');
      }
    } else if (cmd === '/done') {
      if (agentLoop.getState().phase === 'verify') {
        agentLoop.complete({ passed: 10, failed: 0, total: 10 });
      }
    } else if (cmd === '/fail') {
      if (agentLoop.getState().phase === 'verify') {
        agentLoop.complete({ passed: 5, failed: 5, total: 10 });
      }
    } else if (cmd === '/abort') {
      agentLoop.abort('User abort');
    } else if (cmd === '/reset') {
      agentLoop.reset();
      center.setContent(buildCenter(agentLoop, demoData));
    } else if (cmd === '/budget') {
      const snapshot = costCalc.getSnapshot();
      eventBus.emit('budget:update', {
        used: snapshot.used,
        limit: snapshot.limit,
        warning: snapshot.warning,
        blocked: snapshot.blocked,
      });
    } else if (cmd === '/models') {
      const registered = router.getRegisteredProviders();
      const current = config.defaultProvider;
      center.setContent(
        `${emerald('MODELS')}\n\n` +
        `Current: ${cyan(current)} → ${cyan(config.defaultModel)}\n\n` +
        `Registered: ${registered.join(', ')}\n\n` +
        `${dim('Use /model <name> to switch')}`
      );
    } else if (cmd === '/git') {
      const status = tools.git.getStatus();
      center.setContent(
        `${emerald('GIT STATUS')}\n\n` +
        `Branch:   ${cyan(status.branch)}\n` +
        `Clean:    ${status.clean ? emerald('yes') : coral('no')}\n` +
        `Ahead:    ${status.ahead} | Behind: ${status.behind}\n` +
        `Staged:   ${status.staged.join(', ') || dim('none')}\n\n` +
        `${dim('Mock mode — no real git operations')}`
      );
    } else {
      center.setContent(
        `${emerald('COMMAND')}\n\n` +
        `${cyan(cmd)}\n\n` +
        `${dim('Known commands: /plan /impl /verify /done /fail /abort /reset /budget /models /git')}`
      );
    }

    commandInput.clearValue();
    commandInput.setContent(`{${C.ACCENT_EMERALD}-fg}>{/${C.ACCENT_EMERALD}-fg} `);
    screen.render();
  });

  // ─── Initial render ─────────────────────────────────────────────────────

  screen.render();
}

// ─── Build Header ─────────────────────────────────────────────────────────────

function buildHeader(data: AppConfig['demoData']): string {
  const used = formatUSD(data.budget.used);
  const limit = formatUSD(data.budget.limit);
  const pct = data.budget.limit > 0 ? Math.min(100, (data.budget.used / data.budget.limit) * 100) : 0;
  const barLen = 20;
  const filled = Math.round((pct / 100) * barLen);
  const budgetBar = `{${C.ACCENT_EMERALD}-fg}${'█'.repeat(filled)}{/${C.ACCENT_EMERALD}-fg}${dim('░'.repeat(barLen - filled))}`;

  return [
    `{bold}${emerald('◆')} ${cyan(data.project)} ${dim('/')} ${cyan(data.branch)}{/bold}`,
    '',
    `${dim('MODEL')}  ${cyan(data.provider)} ${dim('→')} ${cyan(data.model)}   ` +
    `${dim('BUDGET')}  ${used} / ${limit} ${budgetBar}   ` +
    `${dim('HEALTH')}  ${emerald(data.health)}`,
  ].join('\n');
}

function updateHeader(
  header: blessed.Widgets.BoxElement,
  data: AppConfig['demoData'],
  state: AgentState,
): void {
  const phaseLabel = state.phase.toUpperCase();
  const phaseColor = state.phase === 'plan' ? C.ACCENT_CYAN :
    state.phase === 'implement' ? C.ACCENT_EMERALD :
    state.phase === 'verify' ? C.ACCENT_TEAL :
    state.phase === 'done' ? C.ACCENT_EMERALD :
    state.phase === 'error' ? C.ACCENT_CORAL : C.TEXT_SECONDARY;

  const phaseStr = `{${phaseColor}-fg}● ${phaseLabel}{/${phaseColor}-fg}`;
  data.health = state.phase === 'error' ? 'Error' :
    state.phase === 'done' ? 'Complete' : 'Active';

  header.setContent(buildHeader(data) + `\n${dim('PHASE')}   ${phaseStr}  ${dim(`iter ${state.iteration}`)}`);
}

// ─── Build Left Sidebar ───────────────────────────────────────────────────────

function buildSidebar(
  data: AppConfig['demoData'],
  tools: AppConfig['tools'],
): string {
  const gitStatus = tools.git.getStatus();
  const files = tools.fs.listDir('/home/project/src');
  const cwd = tools.fs.getCwd();

  return [
    `${emerald('WORKSPACE')}`,
    `${dim(cwd)}`,
    `${files.map((f) => `  ${dim('└')} ${f.name}`).join('\n')}`,
    `${dim('─'.repeat(24))}`,
    ``,
    `${emerald('TASKS')}`,
    `${dim('Active')}    0`,
    `${dim('Queue')}     0`,
    ``,
    `${emerald('MEMORY')}`,
    `${dim('Index')}     ${tools.fs.getFileCount()} entries`,
    `${dim('Sessions')}  3 recent`,
    ``,
    `${emerald('TOOLS')}`,
    `${dim('Registry')}  5 providers`,
    `${dim('Mock mode')} active`,
    ``,
    `${emerald('GIT')}`,
    `${dim('Branch')}    ${cyan(gitStatus.branch)}`,
    `${dim('Status')}    ${gitStatus.clean ? emerald('clean') : coral('dirty')}`,
    `${dim('Diff')}      ${gitStatus.staged.length} staged`,
    ``,
    `${emerald('DEPLOY')}`,
    `${dim('PR')}        none`,
    ``,
    `${emerald('BENCHMARKS')}`,
    `${dim('Last run')}  2h ago`,
    `${dim('Score')}     ${emerald('87/100')}`,
  ].join('\n');
}

// ─── Build Center ─────────────────────────────────────────────────────────────

function buildCenter(agentLoop: AgentLoop, data: AppConfig['demoData']): string {
  const state = agentLoop.getState();
  const phase = state.phase;

  const phases = [
    { key: 'plan', label: 'PLAN', color: C.ACCENT_CYAN, desc: 'Repository scan & analysis' },
    { key: 'implement', label: 'IMPLEMENT', color: C.ACCENT_EMERALD, desc: 'Code changes & refactoring' },
    { key: 'verify', label: 'VERIFY', color: C.ACCENT_TEAL, desc: 'Tests, lint, benchmarks' },
  ];

  let phaseIndex = -1;
  if (phase === 'plan') phaseIndex = 0;
  else if (phase === 'implement') phaseIndex = 1;
  else if (phase === 'verify') phaseIndex = 2;
  else if (phase === 'done') phaseIndex = 3;

  const lines: string[] = [
    `{bold}${emerald('AGENTIC TIMELINE')}{/bold}`,
    `{${C.TEXT_SECONDARY}-fg}Plan → Implement → Verify loop{/${C.TEXT_SECONDARY}-fg}`,
    '',
  ];

  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const active = i === phaseIndex;
    const done = i < phaseIndex || phase === 'done';
    const icon = done ? '✓' : active ? '●' : '○';
    const color = done ? C.ACCENT_EMERALD : active ? p.color : C.TEXT_TERTIARY;

    lines.push(`{${color}-fg}${icon} ${p.label}{/${color}-fg}  ${dim(p.desc)}`);

    if (active) {
      lines.push(`  ${dim('└─')} ${dim('In progress...')}`);
      if (state.phaseData) {
        for (const [key, value] of Object.entries(state.phaseData)) {
          lines.push(`     ${dim(key)}: ${JSON.stringify(value).slice(0, 60)}`);
        }
      }
    }
    lines.push('');
  }

  if (phase === 'done') {
    lines.push(`{bold}${emerald('◆ SUCCESS — All phases complete')}{/bold}`);
    lines.push(`${dim(data.tests.passed)} tests passed, ${dim(data.tests.failed)} failed`);
  } else if (phase === 'error') {
    lines.push(`{bold}${coral('◆ ERROR')}{/bold}`);
    lines.push(`${coral(state.error || 'Unknown error')}`);
  } else if (phase === 'aborted') {
    lines.push(`{bold}${coral('◆ ABORTED')}{/bold}`);
    lines.push(`${dim(state.error || 'Task aborted')}`);
  } else if (phase === 'idle') {
    lines.push(`${dim('Waiting for command...')}`);
    lines.push('');
    lines.push(`${dim('Try:')} ${cyan('/plan')} ${dim('to start the agent loop')}`);
  }

  lines.push('');
  lines.push(`${dim('─'.repeat(40))}`);
  lines.push('');
  lines.push(`{bold}${emerald('FEATURES')}{/bold}`);
  lines.push('');

  const features = [
    { icon: '◆', label: 'Agentic Workflow', desc: 'Plan → Implement → Verify' },
    { icon: '⬡', label: 'Open-Model-First', desc: `Ollama Cloud default (${cyan('qwen3-coder:480b')})` },
    { icon: '$', label: 'Cost Awareness', desc: 'Budget tracking & provider routing' },
    { icon: '⎇', label: 'Git-Integrated', desc: 'Status, diff, branch safety' },
    { icon: '⚙', label: 'Multi-Tool', desc: 'Files, shell, SSH, Docker' },
    { icon: '⏱', label: 'Benchmark-Driven', desc: 'Model selection by task type' },
    { icon: '◈', label: 'Phase Routing', desc: 'Different models per execution phase' },
  ];

  for (const f of features) {
    lines.push(`  ${emerald(f.icon)} ${f.label}  ${dim(f.desc)}`);
  }

  return lines.join('\n');
}

// ─── Build Right Sidebar ──────────────────────────────────────────────────────

function buildRightSidebar(
  data: AppConfig['demoData'],
  costCalc: CostCalculator,
): string {
  const snapshot = costCalc.getSnapshot();
  const safety = data.safety;
  const tests = data.tests;

  const safetyColor = safety.score >= 90 ? C.ACCENT_EMERALD :
    safety.score >= 70 ? C.ACCENT_GOLD : C.ACCENT_CORAL;

  // Budget gauge bar
  const budgetPct = snapshot.limit > 0 ? Math.min(100, (snapshot.used / snapshot.limit) * 100) : 0;
  const barLen = 28;
  const filled = Math.round((budgetPct / 100) * barLen);
  const budgetColor = budgetPct >= 80 ? C.ACCENT_CORAL :
    budgetPct >= 50 ? C.ACCENT_GOLD : C.ACCENT_EMERALD;
  const budgetBar = `{${budgetColor}-fg}${'█'.repeat(filled)}{/${budgetColor}-fg}${dim('░'.repeat(barLen - filled))}`;

  const lines: string[] = [
    `{bold}${emerald('BRANCH SAFETY')}{/bold}`,
    `{${safetyColor}-fg}{bold}${safety.score}/100{/${safetyColor}-fg}{/bold}  ${dim(safety.status)}`,
    `[${'█'.repeat(Math.round(safety.score / 100 * barLen))}${dim('░'.repeat(barLen - Math.round(safety.score / 100 * barLen)))}]`,
    '',
    `${dim('─'.repeat(30))}`,
    '',
    `{bold}${emerald('TEST SUMMARY')}{/bold}`,
    `${emerald(tests.passed.toString())} passed  ${coral(tests.failed.toString())} failed  ${dim(`(${tests.total} total)`)}`,
    '',
    `${dim('─'.repeat(30))}`,
    '',
    `{bold}${emerald('COST & USAGE')}{/bold}`,
    `${dim('Budget')}   ${formatUSD(snapshot.used)} / ${formatUSD(snapshot.limit)}`,
    `${budgetBar}`,
    `${dim('Tokens')}   ${formatTokens(snapshot.totalInputTokens + snapshot.totalOutputTokens)}`,
    `${dim('Calls')}    ${snapshot.usageCount}`,
    ``,
    `${dim('─'.repeat(30))}`,
    '',
    `{bold}${emerald('TOOL ACTIONS')}{/bold}`,
    ...data.toolActions.map(
      (a) => `{${C.ACCENT_CYAN}-fg}${a.tool}{/${C.ACCENT_CYAN}-fg}  ${dim(a.detail)}`,
    ),
  ];

  return lines.join('\n');
}

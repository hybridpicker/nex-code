/**
 * cli/index.js — Main REPL + Command Handling
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { C, banner } = require('./ui');
const { processInput, clearConversation, getConversationLength, getConversationMessages, setConversationMessages } = require('./agent');
const { getActiveModel, setActiveModel, getModelNames } = require('./ollama');
const { listProviders, getActiveProviderName, listAllModels, setFallbackChain, getFallbackChain, getProvider } = require('./providers/registry');
const { printContext } = require('./context');
const { setAutoConfirm, getAutoConfirm, setReadlineInterface } = require('./safety');
const { getUsage } = require('./context-engine');
const { TOOL_DEFINITIONS } = require('./tools');
const { saveSession, loadSession, listSessions, getLastSession } = require('./session');
const { remember, forget, listMemories } = require('./memory');
const { listPermissions, setPermission, savePermissions } = require('./permissions');
const {
  createPlan, getActivePlan, setPlanMode, isPlanMode,
  approvePlan, startExecution, formatPlan, savePlan, listPlans, clearPlan,
  setAutonomyLevel, getAutonomyLevel, AUTONOMY_LEVELS,
} = require('./planner');
const { isGitRepo, getCurrentBranch, formatDiffSummary, analyzeDiff, commit, createBranch } = require('./git');
const { listServers, connectAll, disconnectAll } = require('./mcp');
const { listHooks, runHooks, HOOK_EVENTS } = require('./hooks');
const { undo, redo, getHistory, getUndoCount, getRedoCount, clearHistory } = require('./file-history');
const { formatCosts, resetCosts } = require('./costs');
const { loadAllSkills, listSkills, enableSkill, disableSkill, getSkillCommands, handleSkillCommand } = require('./skills');

const CWD = process.cwd();

// ─── Slash Command Registry ──────────────────────────────────
const SLASH_COMMANDS = [
  { cmd: '/help',        desc: 'Show full help' },
  { cmd: '/model',       desc: 'Show/switch model' },
  { cmd: '/providers',   desc: 'List providers and models' },
  { cmd: '/fallback',    desc: 'Show/set fallback chain' },
  { cmd: '/tokens',      desc: 'Token usage and context budget' },
  { cmd: '/costs',       desc: 'Session token costs' },
  { cmd: '/clear',       desc: 'Clear conversation' },
  { cmd: '/context',     desc: 'Show project context' },
  { cmd: '/autoconfirm', desc: 'Toggle auto-confirm' },
  { cmd: '/save',        desc: 'Save session' },
  { cmd: '/load',        desc: 'Load a saved session' },
  { cmd: '/sessions',    desc: 'List saved sessions' },
  { cmd: '/resume',      desc: 'Resume last session' },
  { cmd: '/remember',    desc: 'Save a memory' },
  { cmd: '/forget',      desc: 'Delete a memory' },
  { cmd: '/memory',      desc: 'Show all memories' },
  { cmd: '/permissions',  desc: 'Show tool permissions' },
  { cmd: '/allow',       desc: 'Auto-allow a tool' },
  { cmd: '/deny',        desc: 'Block a tool' },
  { cmd: '/plan',        desc: 'Plan mode (analyze before executing)' },
  { cmd: '/plans',       desc: 'List saved plans' },
  { cmd: '/auto',        desc: 'Set autonomy level' },
  { cmd: '/commit',      desc: 'Smart commit (diff + message)' },
  { cmd: '/diff',        desc: 'Show current diff' },
  { cmd: '/branch',      desc: 'Create feature branch' },
  { cmd: '/mcp',         desc: 'MCP servers and tools' },
  { cmd: '/hooks',       desc: 'Show configured hooks' },
  { cmd: '/skills',      desc: 'List, enable, disable skills' },
  { cmd: '/undo',        desc: 'Undo last file change' },
  { cmd: '/redo',        desc: 'Redo last undone change' },
  { cmd: '/history',     desc: 'Show file change history' },
  { cmd: '/exit',        desc: 'Quit' },
];

function showCommandList() {
  const skillCmds = getSkillCommands();
  const allCmds = [...SLASH_COMMANDS, ...skillCmds];
  const maxLen = Math.max(...allCmds.map((c) => c.cmd.length));
  console.log('');
  for (const { cmd, desc } of SLASH_COMMANDS) {
    console.log(`  ${C.cyan}${cmd.padEnd(maxLen + 2)}${C.reset}${C.dim}${desc}${C.reset}`);
  }
  for (const { cmd, desc } of skillCmds) {
    console.log(`  ${C.cyan}${cmd.padEnd(maxLen + 2)}${C.reset}${C.dim}${desc} ${C.yellow}[skill]${C.reset}`);
  }
  console.log(`\n${C.dim}Type /help for detailed usage${C.reset}\n`);
}

function completeFilePath(partial) {
  try {
    let dir, prefix;
    if (partial.endsWith('/') || partial.endsWith(path.sep)) {
      dir = partial;
      prefix = '';
    } else {
      dir = path.dirname(partial);
      prefix = path.basename(partial);
    }

    // Resolve ~ to home directory
    if (dir.startsWith('~')) {
      dir = path.join(require('os').homedir(), dir.slice(1));
    }

    const resolved = path.isAbsolute(dir) ? dir : path.resolve(CWD, dir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return [];

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const matches = [];
    for (const entry of entries) {
      // Skip hidden files and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (prefix && !entry.name.startsWith(prefix)) continue;

      const basePath = partial.endsWith('/') || partial.endsWith(path.sep)
        ? partial
        : path.dirname(partial) + '/';
      const completedPath = (basePath === './' && !partial.startsWith('./'))
        ? entry.name
        : basePath + entry.name;
      matches.push(entry.isDirectory() ? completedPath + '/' : completedPath);
    }
    return matches;
  } catch {
    return [];
  }
}

function completer(line) {
  // Slash commands
  if (line.startsWith('/')) {
    const allCmds = [...SLASH_COMMANDS, ...getSkillCommands()];
    const hits = allCmds.map((c) => c.cmd).filter((c) => c.startsWith(line));
    return [hits.length ? hits : allCmds.map((c) => c.cmd), line];
  }

  // File path completion: check last token
  const tokens = line.split(/\s+/);
  const lastToken = tokens[tokens.length - 1] || '';
  if (lastToken && (lastToken.includes('/') || lastToken.startsWith('./') || lastToken.startsWith('../') || lastToken.startsWith('~'))) {
    const matches = completeFilePath(lastToken);
    return [matches, lastToken];
  }

  return [[], line];
}

function showHelp() {
  console.log(`
${C.bold}${C.cyan}Commands:${C.reset}
  ${C.cyan}/help${C.reset}             ${C.dim}Show this help${C.reset}
  ${C.cyan}/model [spec]${C.reset}     ${C.dim}Show/switch model (e.g. openai:gpt-4o, claude-sonnet)${C.reset}
  ${C.cyan}/providers${C.reset}        ${C.dim}Show available providers and models${C.reset}
  ${C.cyan}/fallback [chain]${C.reset} ${C.dim}Show/set fallback chain (e.g. anthropic,openai,local)${C.reset}
  ${C.cyan}/tokens${C.reset}           ${C.dim}Show token usage and context budget${C.reset}
  ${C.cyan}/costs${C.reset}            ${C.dim}Show session token costs${C.reset}
  ${C.cyan}/clear${C.reset}            ${C.dim}Clear conversation context${C.reset}
  ${C.cyan}/context${C.reset}          ${C.dim}Show project context${C.reset}
  ${C.cyan}/autoconfirm${C.reset}      ${C.dim}Toggle auto-confirm for file changes${C.reset}

${C.bold}${C.cyan}Sessions:${C.reset}
  ${C.cyan}/save [name]${C.reset}      ${C.dim}Save current session${C.reset}
  ${C.cyan}/load <name>${C.reset}      ${C.dim}Load a saved session${C.reset}
  ${C.cyan}/sessions${C.reset}         ${C.dim}List all saved sessions${C.reset}
  ${C.cyan}/resume${C.reset}           ${C.dim}Resume last session${C.reset}

${C.bold}${C.cyan}Memory:${C.reset}
  ${C.cyan}/remember <text>${C.reset}  ${C.dim}Save a memory (key=value or freeform)${C.reset}
  ${C.cyan}/forget <key>${C.reset}     ${C.dim}Delete a memory${C.reset}
  ${C.cyan}/memory${C.reset}           ${C.dim}Show all memories${C.reset}

${C.bold}${C.cyan}Permissions:${C.reset}
  ${C.cyan}/permissions${C.reset}      ${C.dim}Show tool permissions${C.reset}
  ${C.cyan}/allow <tool>${C.reset}     ${C.dim}Auto-allow a tool${C.reset}
  ${C.cyan}/deny <tool>${C.reset}      ${C.dim}Block a tool${C.reset}

${C.bold}${C.cyan}Planning:${C.reset}
  ${C.cyan}/plan [task]${C.reset}      ${C.dim}Enter plan mode (analyze, don't execute)${C.reset}
  ${C.cyan}/plan status${C.reset}      ${C.dim}Show current plan progress${C.reset}
  ${C.cyan}/plan approve${C.reset}     ${C.dim}Approve current plan${C.reset}
  ${C.cyan}/plans${C.reset}            ${C.dim}List saved plans${C.reset}
  ${C.cyan}/auto [level]${C.reset}     ${C.dim}Set autonomy: interactive/semi-auto/autonomous${C.reset}

${C.bold}${C.cyan}Git:${C.reset}
  ${C.cyan}/commit [msg]${C.reset}    ${C.dim}Smart commit (analyze diff, suggest message)${C.reset}
  ${C.cyan}/diff${C.reset}             ${C.dim}Show current diff summary${C.reset}
  ${C.cyan}/branch [name]${C.reset}   ${C.dim}Create feature branch${C.reset}

${C.bold}${C.cyan}Extensibility:${C.reset}
  ${C.cyan}/mcp${C.reset}              ${C.dim}Show MCP servers and tools${C.reset}
  ${C.cyan}/mcp connect${C.reset}      ${C.dim}Connect all configured MCP servers${C.reset}
  ${C.cyan}/hooks${C.reset}            ${C.dim}Show configured hooks${C.reset}
  ${C.cyan}/skills${C.reset}           ${C.dim}List loaded skills${C.reset}
  ${C.cyan}/skills enable${C.reset}    ${C.dim}Enable a skill by name${C.reset}
  ${C.cyan}/skills disable${C.reset}   ${C.dim}Disable a skill by name${C.reset}

${C.bold}${C.cyan}Undo / Redo:${C.reset}
  ${C.cyan}/undo${C.reset}             ${C.dim}Undo last file change${C.reset}
  ${C.cyan}/redo${C.reset}             ${C.dim}Redo last undone change${C.reset}
  ${C.cyan}/history${C.reset}          ${C.dim}Show file change history${C.reset}

  ${C.cyan}/exit${C.reset}             ${C.dim}Quit${C.reset}
`);
}

function renderBar(percentage) {
  const width = 30;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const color = percentage > 80 ? C.red : percentage > 50 ? C.yellow : C.green;
  return `  ${color}${'█'.repeat(filled)}${C.dim}${'░'.repeat(empty)}${C.reset} ${percentage}%`;
}

function showProviders() {
  const providerList = listProviders();
  const activeProvider = getActiveProviderName();
  const activeModel = getActiveModel();

  console.log(`\n${C.bold}${C.cyan}Providers:${C.reset}`);
  for (const p of providerList) {
    const isActive = p.provider === activeProvider;
    const status = p.configured ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    const marker = isActive ? ` ${C.cyan}(active)${C.reset}` : '';
    console.log(`  ${status} ${C.bold}${p.provider}${C.reset}${marker}`);

    for (const m of p.models) {
      const modelMarker = m.id === activeModel.id && isActive ? ` ${C.yellow}◄${C.reset}` : '';
      console.log(`    ${C.dim}${m.id}${C.reset} — ${m.name}${modelMarker}`);
    }
  }
  console.log();
}

function handleSlashCommand(input) {
  const [cmd, ...rest] = input.split(/\s+/);

  switch (cmd) {
    case '/help':
      showHelp();
      return true;

    case '/model': {
      const name = rest.join(' ').trim();
      if (!name) {
        const model = getActiveModel();
        const providerName = getActiveProviderName();
        console.log(
          `${C.bold}${C.cyan}Active model:${C.reset} ${C.dim}${providerName}:${model.id} (${model.name})${C.reset}`
        );
        console.log(`${C.gray}Use /model <provider:model> to switch. /providers to see all.${C.reset}`);
        return true;
      }
      if (name === 'list') {
        showProviders();
        return true;
      }
      if (setActiveModel(name)) {
        const model = getActiveModel();
        const providerName = getActiveProviderName();
        console.log(`${C.green}Switched to ${providerName}:${model.id} (${model.name})${C.reset}`);
      } else {
        console.log(`${C.red}Unknown model: ${name}${C.reset}`);
        console.log(`${C.gray}Use /providers to see available models${C.reset}`);
      }
      return true;
    }

    case '/providers':
      showProviders();
      return true;

    case '/fallback': {
      const chainArg = rest.join(' ').trim();
      if (!chainArg) {
        const chain = getFallbackChain();
        if (chain.length === 0) {
          console.log(`${C.dim}No fallback chain configured${C.reset}`);
          console.log(`${C.dim}Use /fallback anthropic,openai,local to set${C.reset}`);
        } else {
          console.log(`${C.bold}${C.cyan}Fallback chain:${C.reset} ${chain.join(' → ')}`);
        }
        return true;
      }
      const chain = chainArg.split(',').map((s) => s.trim()).filter(Boolean);
      setFallbackChain(chain);
      console.log(`${C.green}Fallback chain: ${chain.join(' → ')}${C.reset}`);
      return true;
    }

    case '/tokens': {
      const messages = getConversationMessages();
      const usage = getUsage(messages, TOOL_DEFINITIONS);
      const model = getActiveModel();
      const providerName = getActiveProviderName();

      console.log(`\n${C.bold}${C.cyan}Token Usage:${C.reset}`);
      console.log(`  ${C.dim}Model:${C.reset} ${providerName}:${model.id} (${(usage.limit / 1000).toFixed(0)}k context)`);
      console.log(`  ${C.dim}Used:${C.reset}  ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} (${usage.percentage}%)`);

      const bar = renderBar(usage.percentage);
      console.log(`  ${bar}`);

      console.log(`\n  ${C.dim}Breakdown:${C.reset}`);
      console.log(`    System prompt:    ${usage.breakdown.system.toLocaleString()} tokens`);
      console.log(`    Conversation:     ${usage.breakdown.conversation.toLocaleString()} tokens`);
      console.log(`    Tool results:     ${usage.breakdown.toolResults.toLocaleString()} tokens`);
      console.log(`    Tool definitions: ${usage.breakdown.toolDefinitions.toLocaleString()} tokens`);
      console.log(`    Messages:         ${usage.messageCount}`);
      console.log();
      return true;
    }

    case '/costs': {
      const costArg = rest.join(' ').trim();
      if (costArg === 'reset') {
        resetCosts();
        console.log(`${C.green}Cost tracking reset${C.reset}`);
        return true;
      }
      console.log(`\n${formatCosts()}\n`);
      return true;
    }

    case '/clear':
      clearConversation();
      clearHistory();
      console.log(`${C.green}Conversation cleared${C.reset}`);
      return true;

    case '/context':
      printContext(CWD);
      return true;

    case '/autoconfirm': {
      const newVal = !getAutoConfirm();
      setAutoConfirm(newVal);
      console.log(`${C.green}Auto-confirm: ${newVal ? 'ON' : 'OFF'}${C.reset}`);
      if (newVal) {
        console.log(`${C.yellow}  ⚠ File changes will be applied without confirmation${C.reset}`);
      }
      return true;
    }

    case '/save': {
      const sessionName = rest.join(' ').trim() || `session-${Date.now()}`;
      const messages = getConversationMessages();
      if (messages.length === 0) {
        console.log(`${C.yellow}No conversation to save${C.reset}`);
        return true;
      }
      const model = getActiveModel();
      const providerName = getActiveProviderName();
      saveSession(sessionName, messages, { model: model.id, provider: providerName });
      console.log(`${C.green}Session saved: ${sessionName} (${messages.length} messages)${C.reset}`);
      return true;
    }

    case '/load': {
      const loadName = rest.join(' ').trim();
      if (!loadName) {
        console.log(`${C.red}Usage: /load <name>${C.reset}`);
        return true;
      }
      const session = loadSession(loadName);
      if (!session) {
        console.log(`${C.red}Session not found: ${loadName}${C.reset}`);
        return true;
      }
      setConversationMessages(session.messages);
      console.log(`${C.green}Loaded session: ${session.name} (${session.messageCount} messages)${C.reset}`);
      return true;
    }

    case '/sessions': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log(`${C.dim}No saved sessions${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}Sessions:${C.reset}`);
      for (const s of sessions) {
        const date = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '?';
        const auto = s.name === '_autosave' ? ` ${C.dim}(auto)${C.reset}` : '';
        console.log(`  ${C.cyan}${s.name}${C.reset}${auto} — ${s.messageCount} msgs, ${date}`);
      }
      console.log();
      return true;
    }

    case '/resume': {
      const last = getLastSession();
      if (!last) {
        console.log(`${C.yellow}No session to resume${C.reset}`);
        return true;
      }
      setConversationMessages(last.messages);
      console.log(`${C.green}Resumed: ${last.name} (${last.messageCount} messages)${C.reset}`);
      return true;
    }

    case '/remember': {
      const text = rest.join(' ').trim();
      if (!text) {
        console.log(`${C.red}Usage: /remember <key>=<value> or /remember <text>${C.reset}`);
        return true;
      }
      const eqIdx = text.indexOf('=');
      let key, value;
      if (eqIdx > 0) {
        key = text.substring(0, eqIdx).trim();
        value = text.substring(eqIdx + 1).trim();
      } else {
        key = text.substring(0, 40).replace(/\s+/g, '-');
        value = text;
      }
      remember(key, value);
      console.log(`${C.green}Remembered: ${key}${C.reset}`);
      return true;
    }

    case '/forget': {
      const forgetKey = rest.join(' ').trim();
      if (!forgetKey) {
        console.log(`${C.red}Usage: /forget <key>${C.reset}`);
        return true;
      }
      if (forget(forgetKey)) {
        console.log(`${C.green}Forgotten: ${forgetKey}${C.reset}`);
      } else {
        console.log(`${C.red}Memory not found: ${forgetKey}${C.reset}`);
      }
      return true;
    }

    case '/memory': {
      const memories = listMemories();
      if (memories.length === 0) {
        console.log(`${C.dim}No memories saved${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}Memory:${C.reset}`);
      for (const m of memories) {
        console.log(`  ${C.cyan}${m.key}${C.reset} = ${m.value}`);
      }
      console.log();
      return true;
    }

    case '/plan': {
      const arg = rest.join(' ').trim();
      if (arg === 'status') {
        const plan = getActivePlan();
        console.log(formatPlan(plan));
        return true;
      }
      if (arg === 'approve') {
        if (approvePlan()) {
          console.log(`${C.green}Plan approved! Starting execution...${C.reset}`);
          startExecution();
          setPlanMode(false);
        } else {
          console.log(`${C.red}No plan to approve${C.reset}`);
        }
        return true;
      }
      // Enter plan mode
      setPlanMode(true);
      console.log(`${C.cyan}${C.bold}Plan mode activated${C.reset}`);
      console.log(`${C.dim}Analysis only — no file changes until approved${C.reset}`);
      if (arg) {
        console.log(`${C.dim}Task: ${arg}${C.reset}`);
      }
      return true;
    }

    case '/plans': {
      const plans = listPlans();
      if (plans.length === 0) {
        console.log(`${C.dim}No saved plans${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}Plans:${C.reset}`);
      for (const p of plans) {
        const statusIcon = p.status === 'completed' ? `${C.green}✓` : p.status === 'executing' ? `${C.blue}→` : `${C.dim}○`;
        console.log(`  ${statusIcon} ${C.reset}${C.bold}${p.name}${C.reset} — ${p.task || '?'} (${p.steps} steps, ${p.status})`);
      }
      console.log();
      return true;
    }

    case '/auto': {
      const level = rest.join(' ').trim();
      if (!level) {
        console.log(`${C.bold}${C.cyan}Autonomy:${C.reset} ${getAutonomyLevel()}`);
        console.log(`${C.dim}Levels: ${AUTONOMY_LEVELS.join(', ')}${C.reset}`);
        return true;
      }
      if (setAutonomyLevel(level)) {
        console.log(`${C.green}Autonomy: ${level}${C.reset}`);
      } else {
        console.log(`${C.red}Unknown level: ${level}. Use: ${AUTONOMY_LEVELS.join(', ')}${C.reset}`);
      }
      return true;
    }

    case '/permissions': {
      const perms = listPermissions();
      console.log(`\n${C.bold}${C.cyan}Tool Permissions:${C.reset}`);
      for (const p of perms) {
        const icon = p.mode === 'allow' ? `${C.green}✓` : p.mode === 'deny' ? `${C.red}✗` : `${C.yellow}?`;
        console.log(`  ${icon} ${C.reset}${C.bold}${p.tool}${C.reset} ${C.dim}(${p.mode})${C.reset}`);
      }
      console.log(`\n${C.dim}Use /allow <tool> or /deny <tool> to change${C.reset}\n`);
      return true;
    }

    case '/allow': {
      const tool = rest.join(' ').trim();
      if (!tool) {
        console.log(`${C.red}Usage: /allow <tool>${C.reset}`);
        return true;
      }
      setPermission(tool, 'allow');
      savePermissions();
      console.log(`${C.green}${tool}: allow${C.reset}`);
      return true;
    }

    case '/deny': {
      const tool = rest.join(' ').trim();
      if (!tool) {
        console.log(`${C.red}Usage: /deny <tool>${C.reset}`);
        return true;
      }
      setPermission(tool, 'deny');
      savePermissions();
      console.log(`${C.red}${tool}: deny${C.reset}`);
      return true;
    }

    case '/commit': {
      if (!isGitRepo()) {
        console.log(`${C.red}Not a git repository${C.reset}`);
        return true;
      }
      const msg = rest.join(' ').trim();
      if (msg) {
        const hash = commit(msg);
        if (hash) {
          console.log(`${C.green}Committed: ${hash} — ${msg}${C.reset}`);
        } else {
          console.log(`${C.red}Commit failed${C.reset}`);
        }
        return true;
      }
      // Smart commit: analyze and suggest
      const analysis = analyzeDiff();
      if (!analysis) {
        console.log(`${C.yellow}No changes to commit${C.reset}`);
        return true;
      }
      console.log(formatDiffSummary());
      console.log(`${C.dim}Use /commit <message> to commit with a custom message${C.reset}`);
      return true;
    }

    case '/diff': {
      if (!isGitRepo()) {
        console.log(`${C.red}Not a git repository${C.reset}`);
        return true;
      }
      console.log(formatDiffSummary());
      return true;
    }

    case '/branch': {
      if (!isGitRepo()) {
        console.log(`${C.red}Not a git repository${C.reset}`);
        return true;
      }
      const branchArg = rest.join(' ').trim();
      if (!branchArg) {
        const current = getCurrentBranch();
        console.log(`${C.bold}${C.cyan}Branch:${C.reset} ${current || '(detached)'}`);
        return true;
      }
      const branchName = createBranch(branchArg);
      if (branchName) {
        console.log(`${C.green}Created and switched to: ${branchName}${C.reset}`);
      } else {
        console.log(`${C.red}Failed to create branch${C.reset}`);
      }
      return true;
    }

    case '/mcp': {
      const mcpArg = rest.join(' ').trim();
      if (mcpArg === 'connect') {
        console.log(`${C.dim}Connecting MCP servers...${C.reset}`);
        connectAll().then((results) => {
          for (const r of results) {
            if (r.error) {
              console.log(`  ${C.red}✗${C.reset} ${r.name}: ${r.error}`);
            } else {
              console.log(`  ${C.green}✓${C.reset} ${r.name}: ${r.tools} tools`);
            }
          }
          if (results.length === 0) {
            console.log(`${C.dim}No MCP servers configured in .nex/config.json${C.reset}`);
          }
        }).catch((err) => {
          console.log(`${C.red}MCP connection error: ${err.message}${C.reset}`);
        });
        return true;
      }
      if (mcpArg === 'disconnect') {
        disconnectAll();
        console.log(`${C.green}All MCP servers disconnected${C.reset}`);
        return true;
      }
      // Show status
      const servers = listServers();
      if (servers.length === 0) {
        console.log(`${C.dim}No MCP servers configured${C.reset}`);
        console.log(`${C.dim}Add servers to .nex/config.json under "mcpServers"${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}MCP Servers:${C.reset}`);
      for (const s of servers) {
        const status = s.connected ? `${C.green}✓ connected${C.reset}` : `${C.dim}○ disconnected${C.reset}`;
        console.log(`  ${status} ${C.bold}${s.name}${C.reset} (${s.command}) — ${s.toolCount} tools`);
      }
      console.log(`\n${C.dim}Use /mcp connect to connect all servers${C.reset}\n`);
      return true;
    }

    case '/hooks': {
      const hookList = listHooks();
      if (hookList.length === 0) {
        console.log(`${C.dim}No hooks configured${C.reset}`);
        console.log(`${C.dim}Add hooks to .nex/config.json or .nex/hooks/${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}Hooks:${C.reset}`);
      for (const h of hookList) {
        console.log(`  ${C.cyan}${h.event}${C.reset}`);
        for (const cmd of h.commands) {
          console.log(`    ${C.dim}→ ${cmd}${C.reset}`);
        }
      }
      console.log();
      return true;
    }

    case '/skills': {
      const skillArg = rest.join(' ').trim();
      if (skillArg.startsWith('enable ')) {
        const name = skillArg.substring(7).trim();
        if (enableSkill(name)) {
          console.log(`${C.green}Skill enabled: ${name}${C.reset}`);
        } else {
          console.log(`${C.red}Skill not found: ${name}${C.reset}`);
        }
        return true;
      }
      if (skillArg.startsWith('disable ')) {
        const name = skillArg.substring(8).trim();
        if (disableSkill(name)) {
          console.log(`${C.yellow}Skill disabled: ${name}${C.reset}`);
        } else {
          console.log(`${C.red}Skill not found: ${name}${C.reset}`);
        }
        return true;
      }
      const skills = listSkills();
      if (skills.length === 0) {
        console.log(`${C.dim}No skills loaded${C.reset}`);
        console.log(`${C.dim}Add .md or .js files to .nex/skills/${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}Skills:${C.reset}`);
      for (const s of skills) {
        const status = s.enabled ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
        const tag = s.type === 'prompt' ? `${C.dim}(prompt)${C.reset}` : `${C.dim}(script)${C.reset}`;
        const extras = [];
        if (s.commands > 0) extras.push(`${s.commands} cmd`);
        if (s.tools > 0) extras.push(`${s.tools} tools`);
        const info = extras.length > 0 ? ` — ${extras.join(', ')}` : '';
        console.log(`  ${status} ${C.bold}${s.name}${C.reset} ${tag}${info}`);
      }
      console.log(`\n${C.dim}Use /skills enable <name> or /skills disable <name>${C.reset}\n`);
      return true;
    }

    case '/undo': {
      const undone = undo();
      if (!undone) {
        console.log(`${C.yellow}Nothing to undo${C.reset}`);
        return true;
      }
      if (undone.wasCreated) {
        console.log(`${C.green}Undone: deleted ${undone.filePath} (was created by ${undone.tool})${C.reset}`);
      } else {
        console.log(`${C.green}Undone: restored ${undone.filePath} (${undone.tool})${C.reset}`);
      }
      const remaining = getUndoCount();
      if (remaining > 0) console.log(`${C.dim}${remaining} more change(s) to undo${C.reset}`);
      return true;
    }

    case '/redo': {
      const redone = redo();
      if (!redone) {
        console.log(`${C.yellow}Nothing to redo${C.reset}`);
        return true;
      }
      console.log(`${C.green}Redone: ${redone.filePath} (${redone.tool})${C.reset}`);
      const redoRemaining = getRedoCount();
      if (redoRemaining > 0) console.log(`${C.dim}${redoRemaining} more change(s) to redo${C.reset}`);
      return true;
    }

    case '/history': {
      const history = getHistory(20);
      if (history.length === 0) {
        console.log(`${C.dim}No file changes in this session${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}File Change History:${C.reset}`);
      for (const entry of history) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        console.log(`  ${C.dim}${time}${C.reset} ${C.yellow}${entry.tool}${C.reset} ${entry.filePath}`);
      }
      console.log(`\n${C.dim}${getUndoCount()} undo / ${getRedoCount()} redo available${C.reset}\n`);
      return true;
    }

    case '/exit':
    case '/quit':
      console.log(`\n${C.gray}Bye!${C.reset}`);
      process.exit(0);

    default:
      // Check if it's a skill command before reporting unknown
      if (handleSkillCommand(input)) return true;
      console.log(`${C.red}Unknown command: ${cmd}. Type /help${C.reset}`);
      return true;
  }
}

// ─── History Persistence ─────────────────────────────────────
const HISTORY_MAX = 1000;

function getHistoryPath() {
  return path.join(process.cwd(), '.nex', 'repl_history');
}

function loadHistory() {
  try {
    const histPath = getHistoryPath();
    if (fs.existsSync(histPath)) {
      const lines = fs.readFileSync(histPath, 'utf-8').split('\n').filter(Boolean);
      return lines.slice(-HISTORY_MAX);
    }
  } catch { /* ignore */ }
  return [];
}

function appendHistory(line) {
  try {
    const histPath = getHistoryPath();
    const dir = path.dirname(histPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(histPath, line + '\n');
  } catch { /* ignore */ }
}

// ─── Smart Prompt ────────────────────────────────────────────
function getPrompt() {
  const parts = [];

  if (isPlanMode()) parts.push('plan');

  const level = getAutonomyLevel();
  if (level !== 'interactive') parts.push(level);

  const providerName = getActiveProviderName();
  const model = getActiveModel();
  parts.push(`${providerName}:${model.id}`);

  const tag = parts.length > 0 ? `${C.dim}[${parts.join(' · ')}]${C.reset} ` : '';
  return `${tag}${C.bold}${C.cyan}>${C.reset} `;
}

// ─── Bracketed Paste Detection ──────────────────────────────
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

function hasPasteStart(data) {
  return typeof data === 'string' && data.includes(PASTE_START);
}

function hasPasteEnd(data) {
  return typeof data === 'string' && data.includes(PASTE_END);
}

function stripPasteSequences(data) {
  if (typeof data !== 'string') return data;
  return data.split(PASTE_START).join('').split(PASTE_END).join('');
}

function startREPL() {
  // Check that at least one provider is configured
  const providerList = listProviders();
  const hasConfigured = providerList.some((p) => p.configured);

  if (!hasConfigured) {
    // Check if local Ollama is running
    const localProvider = getProvider('local');
    let localDetected = false;
    if (localProvider) {
      try {
        const { execSync } = require('child_process');
        execSync('curl -s --max-time 2 http://localhost:11434/api/tags', { encoding: 'utf-8', stdio: 'pipe' });
        setActiveModel('local:llama3');
        console.log(`${C.green}Local Ollama detected — using local models${C.reset}`);
        console.log(`${C.dim}Set API keys for cloud providers: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY${C.reset}\n`);
        localDetected = true;
      } catch {
        // Local Ollama not available
      }
    }
    if (!localDetected) {
      console.error(`${C.red}No provider configured and no local Ollama running.${C.reset}`);
      console.error(`${C.gray}Options:${C.reset}`);
      console.error(`${C.gray}  1. Install Ollama: https://ollama.com/download${C.reset}`);
      console.error(`${C.gray}  2. Set an API key: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or OLLAMA_API_KEY${C.reset}`);
      process.exit(1);
    }
  }

  loadAllSkills();

  const model = getActiveModel();
  const providerName = getActiveProviderName();
  banner(`${providerName}:${model.id}`, CWD, { yolo: getAutoConfirm() });
  printContext(CWD);

  const history = loadHistory();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(),
    completer,
    history,
    historySize: HISTORY_MAX,
  });

  setReadlineInterface(rl);

  // ─── Bracketed Paste Mode ──────────────────────────────────
  let _pasteActive = false;
  let _pasteLines = [];

  if (process.stdin.isTTY) {
    process.stdout.write('\x1b[?2004h'); // enable bracketed paste

    const origEmit = process.stdin.emit.bind(process.stdin);
    process.stdin.emit = function (event, ...args) {
      if (event === 'data' && typeof args[0] === 'string') {
        let data = args[0];
        if (hasPasteStart(data)) {
          _pasteActive = true;
          data = stripPasteSequences(data);
          if (data) {
            const lines = data.split('\n');
            _pasteLines.push(...lines);
          }
          return true;
        }
        if (hasPasteEnd(data)) {
          _pasteActive = false;
          data = stripPasteSequences(data);
          if (data) {
            const lines = data.split('\n');
            _pasteLines.push(...lines);
          }
          // Emit the combined paste as a single input
          const combined = _pasteLines.join('\n').trim();
          _pasteLines = [];
          if (combined) {
            console.log(`${C.dim}[pasted ${combined.split('\n').length} lines]${C.reset}`);
            return origEmit.call(process.stdin, event, combined + '\n');
          }
          return true;
        }
        if (_pasteActive) {
          data = stripPasteSequences(data);
          if (data) {
            const lines = data.split('\n');
            _pasteLines.push(...lines);
          }
          return true;
        }
      }
      return origEmit.call(process.stdin, event, ...args);
    };
  }

  // ─── Inline slash-command suggestions (live while typing) ───
  let _sugN = 0;

  function _clearSug() {
    if (_sugN > 0) {
      // Use relative cursor movement (scroll-safe, unlike \x1b[s/\x1b[u])
      let s = '';
      for (let i = 0; i < _sugN; i++) s += '\x1b[1B\x1b[2K';
      s += `\x1b[${_sugN}A`;
      process.stdout.write(s);
      _sugN = 0;
    }
  }

  function _showSug(line) {
    const hits = [...SLASH_COMMANDS, ...getSkillCommands()].filter((c) => c.cmd.startsWith(line));
    if (!hits.length || (hits.length === 1 && hits[0].cmd === line)) return;
    const maxShow = 10;
    const show = hits.slice(0, maxShow);
    const padLen = Math.max(...show.map((c) => c.cmd.length));
    let buf = '';
    for (const { cmd, desc } of show) {
      const typed = cmd.substring(0, line.length);
      const rest = cmd.substring(line.length);
      const gap = ' '.repeat(Math.max(0, padLen - cmd.length + 2));
      buf += `\n\x1b[2K  ${C.cyan}${typed}${C.reset}${C.dim}${rest}${gap}${desc}${C.reset}`;
    }
    _sugN = show.length;
    if (hits.length > maxShow) {
      buf += `\n\x1b[2K  ${C.dim}… +${hits.length - maxShow} more${C.reset}`;
      _sugN++;
    }
    // Move back up using relative movement (scroll-safe)
    // Then restore cursor column (prompt length + cursor position)
    const promptVisible = rl._prompt.replace(/\x1b\[[0-9;]*m/g, '').length;
    buf += `\x1b[${_sugN}A\x1b[${promptVisible + rl.cursor + 1}G`;
    process.stdout.write(buf);
  }

  if (process.stdin.isTTY) {
    process.stdin.on('keypress', (str, key) => {
      _clearSug();
      if (key && (key.name === 'tab' || key.name === 'return')) return;
      setImmediate(() => {
        if (rl.line && rl.line.startsWith('/')) {
          _showSug(rl.line);
        }
      });
    });
  }

  // ─── Multi-line input state ──────────────────────────────────
  let multiLineBuffer = null; // null = not in multi-line mode
  const MULTI_LINE_PROMPT = `${C.dim}...${C.reset} `;

  rl.setPrompt(getPrompt());
  rl.prompt();

  rl.on('line', async (line) => {
    _clearSug();

    // Multi-line mode handling
    if (multiLineBuffer !== null) {
      // """ mode: wait for closing """
      if (multiLineBuffer._mode === 'triple') {
        if (line.trim() === '"""') {
          const input = multiLineBuffer.join('\n').trim();
          multiLineBuffer = null;
          if (input) {
            appendHistory(input.replace(/\n/g, '\\n'));
            try {
              await processInput(input);
            } catch (err) {
              console.log(`${C.red}Error: ${err.message}${C.reset}`);
            }
            const msgCount = getConversationLength();
            if (msgCount > 0) {
              process.stdout.write(`${C.gray}[${msgCount} messages] ${C.reset}`);
            }
          }
          rl.setPrompt(getPrompt());
          rl.prompt();
          return;
        }
        multiLineBuffer.push(line);
        rl.setPrompt(MULTI_LINE_PROMPT);
        rl.prompt();
        return;
      }

      // Backslash continuation mode
      if (line.endsWith('\\')) {
        multiLineBuffer.push(line.slice(0, -1));
      } else {
        multiLineBuffer.push(line);
        const input = multiLineBuffer.join('\n').trim();
        multiLineBuffer = null;
        if (input) {
          appendHistory(input.replace(/\n/g, '\\n'));
          try {
            await processInput(input);
          } catch (err) {
            console.log(`${C.red}Error: ${err.message}${C.reset}`);
          }
          const msgCount = getConversationLength();
          if (msgCount > 0) {
            process.stdout.write(`${C.gray}[${msgCount} messages] ${C.reset}`);
          }
        }
        rl.setPrompt(getPrompt());
        rl.prompt();
        return;
      }
      rl.setPrompt(MULTI_LINE_PROMPT);
      rl.prompt();
      return;
    }

    // Check for multi-line start with """
    if (line.trim() === '"""' || line.trim().startsWith('"""')) {
      const after = line.trim().substring(3);
      multiLineBuffer = after ? [after] : [];
      multiLineBuffer._mode = 'triple';
      rl.setPrompt(MULTI_LINE_PROMPT);
      rl.prompt();
      return;
    }

    // Backslash continuation
    if (line.endsWith('\\')) {
      multiLineBuffer = [line.slice(0, -1)];
      multiLineBuffer._mode = 'backslash';
      rl.setPrompt(MULTI_LINE_PROMPT);
      rl.prompt();
      return;
    }

    const input = line.trim();
    if (!input) {
      rl.setPrompt(getPrompt());
      rl.prompt();
      return;
    }

    // Persist history
    appendHistory(input);

    // Slash commands
    if (input === '/') {
      showCommandList();
      rl.setPrompt(getPrompt());
      rl.prompt();
      return;
    }
    if (input.startsWith('/')) {
      handleSlashCommand(input);
      rl.setPrompt(getPrompt());
      rl.prompt();
      return;
    }

    // Process through agent
    try {
      await processInput(input);
    } catch (err) {
      console.log(`${C.red}Error: ${err.message}${C.reset}`);
    }

    const msgCount = getConversationLength();
    if (msgCount > 0) {
      process.stdout.write(`${C.gray}[${msgCount} messages] ${C.reset}`);
    }
    rl.setPrompt(getPrompt());
    rl.prompt();
  });

  rl.on('close', () => {
    if (process.stdin.isTTY) process.stdout.write('\x1b[?2004l'); // disable bracketed paste
    console.log(`\n${C.gray}Bye!${C.reset}`);
    process.exit(0);
  });
}

module.exports = { startREPL, getPrompt, loadHistory, appendHistory, getHistoryPath, HISTORY_MAX, showCommandList, completer, completeFilePath, handleSlashCommand, showProviders, showHelp, renderBar, hasPasteStart, hasPasteEnd, stripPasteSequences };

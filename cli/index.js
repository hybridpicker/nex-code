/**
 * cli/index.js — Main REPL + Command Handling
 */

const readline = require('readline');
const { C, banner } = require('./ui');
const { processInput, clearConversation, getConversationLength, getConversationMessages, setConversationMessages } = require('./agent');
const { getActiveModel, setActiveModel, getModelNames } = require('./ollama');
const { listProviders, getActiveProviderName, listAllModels } = require('./providers/registry');
const { printContext } = require('./context');
const { setAutoConfirm, getAutoConfirm } = require('./safety');
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

const CWD = process.cwd();

function showHelp() {
  console.log(`
${C.bold}${C.white}Commands:${C.reset}
  ${C.cyan}/help${C.reset}             ${C.dim}Show this help${C.reset}
  ${C.cyan}/model [spec]${C.reset}     ${C.dim}Show/switch model (e.g. openai:gpt-4o, claude-sonnet)${C.reset}
  ${C.cyan}/providers${C.reset}        ${C.dim}Show available providers and models${C.reset}
  ${C.cyan}/tokens${C.reset}           ${C.dim}Show token usage and context budget${C.reset}
  ${C.cyan}/clear${C.reset}            ${C.dim}Clear conversation context${C.reset}
  ${C.cyan}/context${C.reset}          ${C.dim}Show project context${C.reset}
  ${C.cyan}/autoconfirm${C.reset}      ${C.dim}Toggle auto-confirm for file changes${C.reset}

${C.bold}${C.white}Sessions:${C.reset}
  ${C.cyan}/save [name]${C.reset}      ${C.dim}Save current session${C.reset}
  ${C.cyan}/load <name>${C.reset}      ${C.dim}Load a saved session${C.reset}
  ${C.cyan}/sessions${C.reset}         ${C.dim}List all saved sessions${C.reset}
  ${C.cyan}/resume${C.reset}           ${C.dim}Resume last session${C.reset}

${C.bold}${C.white}Memory:${C.reset}
  ${C.cyan}/remember <text>${C.reset}  ${C.dim}Save a memory (key=value or freeform)${C.reset}
  ${C.cyan}/forget <key>${C.reset}     ${C.dim}Delete a memory${C.reset}
  ${C.cyan}/memory${C.reset}           ${C.dim}Show all memories${C.reset}

${C.bold}${C.white}Permissions:${C.reset}
  ${C.cyan}/permissions${C.reset}      ${C.dim}Show tool permissions${C.reset}
  ${C.cyan}/allow <tool>${C.reset}     ${C.dim}Auto-allow a tool${C.reset}
  ${C.cyan}/deny <tool>${C.reset}      ${C.dim}Block a tool${C.reset}

${C.bold}${C.white}Planning:${C.reset}
  ${C.cyan}/plan [task]${C.reset}      ${C.dim}Enter plan mode (analyze, don't execute)${C.reset}
  ${C.cyan}/plan status${C.reset}      ${C.dim}Show current plan progress${C.reset}
  ${C.cyan}/plan approve${C.reset}     ${C.dim}Approve current plan${C.reset}
  ${C.cyan}/plans${C.reset}            ${C.dim}List saved plans${C.reset}
  ${C.cyan}/auto [level]${C.reset}     ${C.dim}Set autonomy: interactive/semi-auto/autonomous${C.reset}

${C.bold}${C.white}Git:${C.reset}
  ${C.cyan}/commit [msg]${C.reset}    ${C.dim}Smart commit (analyze diff, suggest message)${C.reset}
  ${C.cyan}/diff${C.reset}             ${C.dim}Show current diff summary${C.reset}
  ${C.cyan}/branch [name]${C.reset}   ${C.dim}Create feature branch${C.reset}

${C.bold}${C.white}Extensibility:${C.reset}
  ${C.cyan}/mcp${C.reset}              ${C.dim}Show MCP servers and tools${C.reset}
  ${C.cyan}/mcp connect${C.reset}      ${C.dim}Connect all configured MCP servers${C.reset}
  ${C.cyan}/hooks${C.reset}            ${C.dim}Show configured hooks${C.reset}

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

  console.log(`\n${C.bold}${C.white}Providers:${C.reset}`);
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
          `${C.bold}${C.white}Active model:${C.reset} ${C.dim}${providerName}:${model.id} (${model.name})${C.reset}`
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

    case '/tokens': {
      const messages = getConversationMessages();
      const usage = getUsage(messages, TOOL_DEFINITIONS);
      const model = getActiveModel();
      const providerName = getActiveProviderName();

      console.log(`\n${C.bold}${C.white}Token Usage:${C.reset}`);
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

    case '/clear':
      clearConversation();
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
      console.log(`\n${C.bold}${C.white}Sessions:${C.reset}`);
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
      console.log(`\n${C.bold}${C.white}Memory:${C.reset}`);
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
      console.log(`\n${C.bold}${C.white}Plans:${C.reset}`);
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
        console.log(`${C.bold}${C.white}Autonomy:${C.reset} ${getAutonomyLevel()}`);
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
      console.log(`\n${C.bold}${C.white}Tool Permissions:${C.reset}`);
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
        console.log(`${C.bold}${C.white}Branch:${C.reset} ${current || '(detached)'}`);
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
      console.log(`\n${C.bold}${C.white}MCP Servers:${C.reset}`);
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
      console.log(`\n${C.bold}${C.white}Hooks:${C.reset}`);
      for (const h of hookList) {
        console.log(`  ${C.cyan}${h.event}${C.reset}`);
        for (const cmd of h.commands) {
          console.log(`    ${C.dim}→ ${cmd}${C.reset}`);
        }
      }
      console.log();
      return true;
    }

    case '/exit':
    case '/quit':
      console.log(`\n${C.gray}Bye!${C.reset}`);
      process.exit(0);

    default:
      console.log(`${C.red}Unknown command: ${cmd}. Type /help${C.reset}`);
      return true;
  }
}

function startREPL() {
  // Check that at least one provider is configured
  const providerList = listProviders();
  const hasConfigured = providerList.some((p) => p.configured);

  if (!hasConfigured) {
    console.error(`${C.red}ERROR: No provider configured.${C.reset}`);
    console.error(`${C.gray}Set at least one API key:${C.reset}`);
    console.error(`${C.gray}  OLLAMA_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY${C.reset}`);
    process.exit(1);
  }

  const model = getActiveModel();
  const providerName = getActiveProviderName();
  banner(`${providerName}:${model.id}`, CWD);
  printContext(CWD);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.bold}${C.cyan}>${C.reset} `,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Slash commands
    if (input.startsWith('/')) {
      handleSlashCommand(input);
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
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${C.gray}Bye!${C.reset}`);
    process.exit(0);
  });
}

module.exports = { startREPL };

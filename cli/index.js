/**
 * cli/index.js — Main REPL + Command Handling
 */

// Essential imports only
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { C, banner, cleanupTerminal } = require('./ui');
const { listProviders, getActiveProviderName, listAllModels, setFallbackChain, getFallbackChain, getProvider } = require('./providers/registry');
const { flushAutoSave } = require('./session');
const { getActiveModel, setActiveModel } = require('./ollama');
const { printContext } = require('./context');
const { loadAllSkills, getSkillCommands, handleSkillCommand } = require('./skills');
const { setReadlineInterface, setAutoConfirm, getAutoConfirm } = require('./safety');
const { StickyFooter } = require('./footer');
// Lazy-loaded imports in startREPL or handlers

const CWD = process.cwd();

// ─── Abort Controller (for Ctrl+C cancellation) ─────────────
let _abortController = null;

function getAbortSignal() {
  return _abortController?.signal ?? null;
}

// ─── Slash Command Registry ──────────────────────────────────
const SLASH_COMMANDS = [
  { cmd: '/help', desc: 'Show full help' },
  { cmd: '/model', desc: 'Show/switch model' },
  { cmd: '/providers', desc: 'List providers and models' },
  { cmd: '/fallback', desc: 'Show/set fallback chain' },
  { cmd: '/tokens', desc: 'Token usage and context budget' },
  { cmd: '/costs', desc: 'Session token costs' },
  { cmd: '/budget', desc: 'Show/set cost limits per provider' },
  { cmd: '/clear', desc: 'Clear conversation' },
  { cmd: '/context', desc: 'Show project context' },
  { cmd: '/autoconfirm', desc: 'Toggle auto-confirm' },
  { cmd: '/save', desc: 'Save session' },
  { cmd: '/load', desc: 'Load a saved session' },
  { cmd: '/sessions', desc: 'List saved sessions' },
  { cmd: '/resume', desc: 'Resume last session' },
  { cmd: '/remember', desc: 'Save a memory' },
  { cmd: '/forget', desc: 'Delete a memory' },
  { cmd: '/memory', desc: 'Show all memories' },
  { cmd: '/brain', desc: 'Manage knowledge base' },
  { cmd: '/brain add', desc: 'Add document: /brain add <name> [content]' },
  { cmd: '/brain list', desc: 'List all brain documents' },
  { cmd: '/brain search', desc: 'Search brain: /brain search <query>' },
  { cmd: '/brain show', desc: 'Show document: /brain show <name>' },
  { cmd: '/brain remove', desc: 'Remove document: /brain remove <name>' },
  { cmd: '/brain rebuild', desc: 'Rebuild keyword index' },
  { cmd: '/brain embed', desc: 'Build/rebuild embedding index' },
  { cmd: '/brain status', desc: 'Show brain status (docs, index, embeddings)' },
  { cmd: '/brain review', desc: 'Review pending brain changes (git diff)' },
  { cmd: '/brain undo', desc: 'Undo last brain write' },
  { cmd: '/learn', desc: 'Reflect on session and update memory' },
  { cmd: '/optimize', desc: 'Show optimization opportunities' },
  { cmd: '/permissions', desc: 'Show tool permissions' },
  { cmd: '/allow', desc: 'Auto-allow a tool' },
  { cmd: '/deny', desc: 'Block a tool' },
  { cmd: '/plan', desc: 'Plan mode (analyze before executing)' },
  { cmd: '/plans', desc: 'List saved plans' },
  { cmd: '/auto', desc: 'Set autonomy level' },
  { cmd: '/commit', desc: 'Smart commit (diff + message)' },
  { cmd: '/diff', desc: 'Show current diff' },
  { cmd: '/review [--strict] [file]', desc: 'Deep code review with score table and diff suggestions (--strict: force ≥3 critical findings)' },
  { cmd: '/branch', desc: 'Create feature branch' },
  { cmd: '/mcp', desc: 'MCP servers and tools' },
  { cmd: '/hooks', desc: 'Show configured hooks' },
  { cmd: '/skills', desc: 'List, enable, disable skills' },
  { cmd: '/tasks', desc: 'Show task list' },
  { cmd: '/servers', desc: 'List server profiles / ping' },
  { cmd: '/docker', desc: 'List containers across all servers' },
  { cmd: '/deploy', desc: 'List deploy configs / run named deploy' },
  { cmd: '/init', desc: 'Interactive setup wizard (.nex/)' },
  { cmd: '/setup', desc: 'Configure provider and API keys' },
  { cmd: '/settings', desc: 'Configure provider and API keys' },
  { cmd: '/undo', desc: 'Undo last file change' },
  { cmd: '/redo', desc: 'Redo last undone change' },
  { cmd: '/history', desc: 'Show file change history' },
  { cmd: '/k8s', desc: 'Kubernetes overview: namespaces and pods' },
  { cmd: '/exit', desc: 'Quit' },
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
  ${C.cyan}/budget [prov] [n]${C.reset}${C.dim}Show/set cost limits per provider${C.reset}
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
  ${C.cyan}/learn${C.reset}            ${C.dim}Reflect on this session and auto-update memory + NEX.md${C.reset}
  ${C.cyan}/optimize${C.reset}         ${C.dim}Show context, memory health, and optimization tips${C.reset}

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

${C.bold}${C.cyan}Tasks:${C.reset}
  ${C.cyan}/tasks${C.reset}            ${C.dim}Show current task list${C.reset}
  ${C.cyan}/tasks clear${C.reset}      ${C.dim}Clear all tasks${C.reset}

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

async function handleSlashCommand(input, rl) {
  const [cmd, ...rest] = input.split(/\s+/);

  switch (cmd) {
    case '/help':
      showHelp();
      return true;

    case '/model': {
      const name = rest.join(' ').trim();
      if (!name) {
        if (rl) {
          const { showModelPicker } = require('./picker');
          await showModelPicker(rl);
        } else {
          const model = getActiveModel();
          const providerName = getActiveProviderName();
          console.log(
            `${C.bold}${C.cyan}Active model:${C.reset} ${C.dim}${providerName}:${model.id} (${model.name})${C.reset}`
          );
          console.log(`${C.gray}Use /model <provider:model> to switch. /providers to see all.${C.reset}`);
        }
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
      const { getConversationMessages } = require('./agent');
      const { getUsage } = require('./context-engine');
      const { TOOL_DEFINITIONS } = require('./tools');
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
      const { formatCosts, resetCosts } = require('./costs');
      const costArg = rest.join(' ').trim();
      if (costArg === 'reset') {
        resetCosts();
        console.log(`${C.green}Cost tracking reset${C.reset}`);
        return true;
      }
      console.log(`\n${formatCosts()}\n`);
      return true;
    }

    case '/budget': {
      const { getCostLimits, getProviderSpend, checkBudget, removeCostLimit, saveCostLimits, setCostLimit } = require('./costs');
      const budgetArg = rest[0];
      if (!budgetArg) {
        // Show all limits + current spend
        const limits = getCostLimits();
        const provList = listProviders();
        console.log(`\n${C.bold}${C.cyan}Cost Limits:${C.reset}`);
        let hasAny = false;
        for (const p of provList) {
          const spent = getProviderSpend(p.provider);
          const limit = limits[p.provider];
          if (limit !== undefined) {
            hasAny = true;
            const pct = Math.min(100, Math.round((spent / limit) * 100));
            const barWidth = 10;
            const filled = Math.round((pct / 100) * barWidth);
            const empty = barWidth - filled;
            const barColor = pct >= 100 ? C.red : pct >= 80 ? C.yellow : C.green;
            const bar = `${barColor}${'█'.repeat(filled)}${C.dim}${'░'.repeat(empty)}${C.reset}`;
            console.log(`  ${C.bold}${p.provider}:${C.reset}  $${spent.toFixed(2)} / $${limit.toFixed(2)}  (${pct}%)  ${bar}`);
          } else {
            const isFree = p.provider === 'ollama' || p.provider === 'local';
            if (isFree) {
              console.log(`  ${C.bold}${p.provider}:${C.reset}  ${C.dim}free (no limit)${C.reset}`);
            } else if (spent > 0) {
              console.log(`  ${C.bold}${p.provider}:${C.reset}  $${spent.toFixed(2)} ${C.dim}(no limit)${C.reset}`);
            }
          }
        }
        if (!hasAny) {
          console.log(`  ${C.dim}No limits set. Use /budget <provider> <amount> to set one.${C.reset}`);
        }
        console.log();
        return true;
      }
      const budgetVal = rest[1];
      if (!budgetVal) {
        // Show single provider budget
        const budget = checkBudget(budgetArg);
        if (budget.limit !== null) {
          console.log(`${C.bold}${budgetArg}:${C.reset} $${budget.spent.toFixed(2)} / $${budget.limit.toFixed(2)} ($${budget.remaining.toFixed(2)} remaining)`);
        } else {
          console.log(`${C.bold}${budgetArg}:${C.reset} $${budget.spent.toFixed(2)} ${C.dim}(no limit)${C.reset}`);
        }
        return true;
      }
      if (budgetVal === 'off' || budgetVal === 'remove' || budgetVal === 'clear') {
        removeCostLimit(budgetArg);
        saveCostLimits();
        console.log(`${C.green}Removed cost limit for ${budgetArg}${C.reset}`);
        return true;
      }
      const amount = parseFloat(budgetVal);
      if (isNaN(amount) || amount <= 0) {
        console.log(`${C.red}Invalid amount: ${budgetVal}. Use a positive number or 'off'.${C.reset}`);
        return true;
      }
      setCostLimit(budgetArg, amount);
      saveCostLimits();
      console.log(`${C.green}Set ${budgetArg} budget limit: $${amount.toFixed(2)}${C.reset}`);
      return true;
    }

    case '/clear': {
      const { clearConversation, getConversationMessages: _getMsgs } = require('./agent');
      const { clearHistory } = require('./file-history');
      // Auto-learn from session before clearing if substantial
      const _msgs = _getMsgs();
      const _userCount = _msgs.filter(m => m.role === 'user').length;
      if (_userCount >= 4) {
        process.stdout.write(`${C.dim}Reflecting on session...${C.reset} `);
        const { learnFromSession } = require('./learner');
        learnFromSession(_msgs).then(lr => {
          if (!lr.skipped && !lr.error && (lr.applied.length > 0 || lr.nexAdded.length > 0)) {
            const total = lr.applied.length + lr.nexAdded.length;
            process.stdout.write(`${C.green}${total} learning(s) saved${C.reset}\n`);
          } else {
            process.stdout.write(`${C.dim}nothing new${C.reset}\n`);
          }
        }).catch(() => process.stdout.write('\n'));
      }
      clearConversation();
      clearHistory();
      console.log(`${C.green}Conversation cleared${C.reset}`);
      return true;
    }

    case '/context':
      await printContext(CWD);
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
      const { saveSession } = require('./session');
      const { getConversationMessages } = require('./agent');
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
      const { loadSession } = require('./session');
      const { setConversationMessages } = require('./agent');
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
      const { listSessions } = require('./session');
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
      const { getLastSession } = require('./session');
      const { setConversationMessages } = require('./agent');
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
      const { remember } = require('./memory');
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
      const { forget } = require('./memory');
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
      const { listMemories } = require('./memory');
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

    case '/brain': {
      const {
        listDocuments, readDocument, writeDocument, removeDocument,
        buildIndex, buildEmbeddingIndex, isEmbeddingAvailable, query: brainQuery,
      } = require('./brain');
      const sub = rest[0];
      const arg = rest.slice(1).join(' ').trim();

      switch (sub) {
        case 'add': {
          if (!arg) {
            console.log(`${C.red}Usage: /brain add <name> [content]${C.reset}`);
            console.log(`${C.dim}  /brain add api-notes — creates empty file${C.reset}`);
            console.log(`${C.dim}  /brain add api-notes This is content — writes directly${C.reset}`);
            return true;
          }
          const spaceIdx = arg.indexOf(' ');
          if (spaceIdx < 0) {
            writeDocument(arg, `# ${arg}\n\n`);
            const brainPath = require('path').join(process.cwd(), '.nex', 'brain', `${arg}.md`);
            console.log(`${C.green}Created .nex/brain/${arg}.md${C.reset}`);
            console.log(`${C.dim}Edit it directly at: ${brainPath}${C.reset}`);
          } else {
            const docName = arg.substring(0, spaceIdx);
            const docContent = arg.substring(spaceIdx + 1);
            writeDocument(docName, docContent);
            console.log(`${C.green}Added to brain: ${docName}${C.reset}`);
          }
          return true;
        }

        case 'list': {
          const docs = listDocuments();
          if (docs.length === 0) {
            console.log(`${C.dim}No brain documents yet. Use /brain add <name> to create one.${C.reset}`);
            return true;
          }
          console.log(`\n${C.bold}${C.cyan}Brain Documents:${C.reset}`);
          const nameW = Math.max(8, ...docs.map(d => d.name.length));
          const tagW = 20;
          console.log(`  ${'Name'.padEnd(nameW + 2)}${'Tags'.padEnd(tagW)}${'Size'.padStart(7)}  Modified`);
          console.log(`  ${'-'.repeat(nameW + 2)}${'-'.repeat(tagW)}${'-'.repeat(7)}  --------`);
          for (const doc of docs) {
            const { frontmatter } = readDocument(doc.name);
            const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : '';
            const size = doc.size < 1024 ? `${doc.size}B` : `${(doc.size / 1024).toFixed(1)}K`;
            const mod = doc.modified.toLocaleDateString();
            console.log(`  ${C.cyan}${doc.name.padEnd(nameW + 2)}${C.reset}${C.dim}${tags.substring(0, tagW - 1).padEnd(tagW)}${size.padStart(7)}  ${mod}${C.reset}`);
          }
          console.log();
          return true;
        }

        case 'search': {
          if (!arg) {
            console.log(`${C.red}Usage: /brain search <query>${C.reset}`);
            return true;
          }
          const results = await brainQuery(arg, { topK: 5 });
          if (results.length === 0) {
            console.log(`${C.dim}No matching brain documents for: ${arg}${C.reset}`);
            return true;
          }
          console.log(`\n${C.bold}${C.cyan}Brain Search: "${arg}"${C.reset}`);
          for (const r of results) {
            const scoreStr = typeof r.score === 'number' ? r.score.toFixed(2) : r.score;
            console.log(`\n  ${C.cyan}${r.name}${C.reset} ${C.dim}(score: ${scoreStr})${C.reset}`);
            console.log(`  ${C.dim}${r.excerpt || ''}${C.reset}`);
          }
          console.log();
          return true;
        }

        case 'show': {
          if (!arg) {
            console.log(`${C.red}Usage: /brain show <name>${C.reset}`);
            return true;
          }
          const doc = readDocument(arg);
          if (!doc.content) {
            console.log(`${C.red}Document not found: ${arg}${C.reset}`);
            return true;
          }
          console.log(`\n${C.bold}${C.cyan}${arg}.md${C.reset}\n`);
          console.log(doc.content);
          return true;
        }

        case 'remove': {
          if (!arg) {
            console.log(`${C.red}Usage: /brain remove <name>${C.reset}`);
            return true;
          }
          const { confirm: brainConfirm } = require('./safety');
          const ok = await brainConfirm(`Remove brain document "${arg}"?`);
          if (!ok) {
            console.log(`${C.dim}Cancelled${C.reset}`);
            return true;
          }
          const removed = removeDocument(arg);
          if (removed) {
            console.log(`${C.green}Removed: ${arg}.md${C.reset}`);
          } else {
            console.log(`${C.red}Document not found: ${arg}${C.reset}`);
          }
          return true;
        }

        case 'rebuild': {
          const idx = buildIndex();
          const count = Object.keys(idx.documents).length;
          console.log(`${C.green}Index rebuilt: ${count} document(s)${C.reset}`);
          return true;
        }

        case 'embed': {
          const available = await isEmbeddingAvailable();
          if (!available) {
            console.log(`${C.yellow}Ollama embedding model not available.${C.reset}`);
            console.log(`${C.dim}Set NEX_EMBED_MODEL env var (default: nomic-embed-text) and ensure Ollama is running.${C.reset}`);
            return true;
          }
          console.log(`${C.dim}Building embedding index...${C.reset}`);
          try {
            const cache = await buildEmbeddingIndex();
            const count = Object.keys(cache.documents || {}).length;
            console.log(`${C.green}Embedding index built: ${count} document(s)${C.reset}`);
          } catch (err) {
            console.log(`${C.red}Embedding failed: ${err.message}${C.reset}`);
          }
          return true;
        }

        case 'status': {
          const docs = listDocuments();
          const fs2 = require('fs');
          const path2 = require('path');
          const indexPath = path2.join(process.cwd(), '.nex', 'brain', '.brain-index.json');
          const embPath = path2.join(process.cwd(), '.nex', 'brain', '.embeddings.json');
          console.log(`\n${C.bold}${C.cyan}Brain Status${C.reset}`);
          console.log(`  Documents:  ${docs.length}`);
          console.log(`  Index:      ${fs2.existsSync(indexPath) ? C.green + 'present' + C.reset : C.dim + 'not built' + C.reset}`);
          console.log(`  Embeddings: ${fs2.existsSync(embPath) ? C.green + 'present' + C.reset : C.dim + 'not built (run /brain embed)' + C.reset}`);
          if (docs.length > 0) {
            const totalSize = docs.reduce((s, d) => s + d.size, 0);
            console.log(`  Total size: ${totalSize < 1024 ? totalSize + 'B' : (totalSize / 1024).toFixed(1) + 'K'}`);
          }
          console.log();
          return true;
        }

        case 'review': {
          const { exec: execAsync } = require('child_process');
          const { promisify } = require('util');
          const execP = promisify(execAsync);
          try {
            const { stdout } = await execP('git diff .nex/brain/', { cwd: process.cwd() });
            if (!stdout.trim()) {
              console.log(`${C.dim}No pending brain changes (clean git state)${C.reset}`);
            } else {
              console.log(`\n${C.bold}${C.cyan}Brain Changes (git diff):${C.reset}\n`);
              console.log(stdout);
            }
          } catch {
            console.log(`${C.dim}Not a git repo or no brain dir${C.reset}`);
          }
          return true;
        }

        case 'undo': {
          const fs2 = require('fs');
          const path2 = require('path');
          const brainDir = path2.join(process.cwd(), '.nex', 'brain');
          if (!fs2.existsSync(brainDir)) {
            console.log(`${C.dim}No brain directory found${C.reset}`);
            return true;
          }
          // Find the most recently modified brain doc
          const docs2 = listDocuments();
          if (docs2.length === 0) {
            console.log(`${C.dim}No brain documents to undo${C.reset}`);
            return true;
          }
          const newest = docs2[0]; // sorted by modified desc
          const { exec: execAsync2 } = require('child_process');
          const { promisify: promisify2 } = require('util');
          const execP2 = promisify2(execAsync2);
          try {
            await execP2(`git checkout -- ".nex/brain/${newest.name}.md"`, { cwd: process.cwd() });
            buildIndex();
            console.log(`${C.green}Undone: restored ${newest.name}.md from git${C.reset}`);
          } catch {
            console.log(`${C.red}Could not undo — not tracked in git or no prior version${C.reset}`);
          }
          return true;
        }

        default: {
          // No sub-command or unknown: show list
          const docs = listDocuments();
          if (docs.length === 0) {
            console.log(`\n${C.bold}${C.cyan}Brain Knowledge Base${C.reset}`);
            console.log(`${C.dim}No documents yet. Create with /brain add <name>${C.reset}`);
            console.log(`\n${C.dim}Commands: add · list · search · show · remove · rebuild · embed · status · review · undo${C.reset}\n`);
          } else {
            console.log(`\n${C.bold}${C.cyan}Brain: ${docs.length} document(s)${C.reset}`);
            for (const doc of docs) {
              const { frontmatter } = readDocument(doc.name);
              const tags = Array.isArray(frontmatter.tags) ? ` [${frontmatter.tags.join(', ')}]` : '';
              console.log(`  ${C.cyan}${doc.name}${C.reset}${C.dim}${tags}${C.reset}`);
            }
            console.log(`\n${C.dim}Use /brain search <query> · /brain show <name> · /brain add <name>${C.reset}\n`);
          }
          return true;
        }
      }
    }

    case '/learn': {
      const { learnFromSession, learnBrainFromSession } = require('./learner');
      const { getConversationMessages: _learnMsgs } = require('./agent');
      const msgs = _learnMsgs();
      const userCount = msgs.filter(m => m.role === 'user').length;
      if (userCount < 4) {
        console.log(`${C.yellow}Session too short to learn from (need 4+ user messages, have ${userCount})${C.reset}`);
        return true;
      }
      console.log(`${C.dim}Analyzing session for learnings...${C.reset}`);
      try {
        // Run memory learning and brain learning in parallel
        const [lr, br] = await Promise.all([
          learnFromSession(msgs),
          learnBrainFromSession(msgs),
        ]);

        if (lr.skipped && (!br.written || br.written.length === 0)) {
          console.log(`${C.dim}Session too short${C.reset}`);
          return true;
        }
        if (lr.error) {
          console.log(`${C.red}Reflection error: ${lr.error}${C.reset}`);
        }

        console.log('');
        if (lr.summary) {
          console.log(`${C.bold}Session:${C.reset} ${C.dim}${lr.summary}${C.reset}`);
          console.log('');
        }

        const hasMemory = lr.applied && lr.applied.length > 0;
        const hasNex = lr.nexAdded && lr.nexAdded.length > 0;
        const hasBrain = br.written && br.written.length > 0;

        if (!hasMemory && !hasNex && !hasBrain) {
          console.log(`${C.dim}No new learnings extracted from this session${C.reset}`);
        } else {
          if (hasMemory) {
            console.log(`${C.bold}${C.cyan}Memory updates:${C.reset}`);
            for (const { key, value, action } of lr.applied) {
              const icon = action === 'updated' ? `${C.yellow}~${C.reset}` : `${C.green}+${C.reset}`;
              console.log(`  ${icon} ${C.bold}${key}${C.reset} = ${value}`);
            }
          }
          if (hasNex) {
            console.log(`${C.bold}${C.cyan}Added to NEX.md:${C.reset}`);
            for (const line of lr.nexAdded) {
              console.log(`  ${C.green}+${C.reset} ${line}`);
            }
          }
          if (hasBrain) {
            console.log(`${C.bold}${C.cyan}Brain documents:${C.reset}`);
            for (const { name, reason, action } of br.written) {
              const icon = action === 'updated' ? `${C.yellow}~${C.reset}` : `${C.green}+${C.reset}`;
              console.log(`  ${icon} ${C.bold}${name}.md${C.reset}${reason ? C.dim + ' — ' + reason + C.reset : ''}`);
            }
          }
        }
        console.log('');
      } catch (err) {
        console.log(`${C.red}Learn failed: ${err.message}${C.reset}`);
      }
      return true;
    }

    case '/optimize': {
      const { getConversationMessages: _optMsgs } = require('./agent');
      const { getUsage } = require('./context-engine');
      const { TOOL_DEFINITIONS } = require('./tools');
      const { listMemories: _listMem } = require('./memory');
      const optMsgs = _optMsgs();
      const usage = getUsage(optMsgs, TOOL_DEFINITIONS);
      const model = getActiveModel();
      const providerName = getActiveProviderName();
      const memories = _listMem();

      console.log(`\n${C.bold}${C.cyan}Optimization Report${C.reset}\n`);

      // Context window health
      const ctxColor = usage.percentage > 80 ? C.red : usage.percentage > 50 ? C.yellow : C.green;
      console.log(`${C.bold}Context Window:${C.reset} ${ctxColor}${usage.percentage}%${C.reset} used (${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} tokens)`);
      if (usage.percentage > 75) {
        console.log(`  ${C.yellow}→ Tip: Use /clear to free context (auto-learns first)${C.reset}`);
      } else if (usage.percentage > 50) {
        console.log(`  ${C.dim}→ Context is filling up, consider /clear soon${C.reset}`);
      } else {
        console.log(`  ${C.green}→ Context healthy${C.reset}`);
      }

      // Memory health
      console.log(`\n${C.bold}Memory:${C.reset} ${memories.length} entries`);
      if (memories.length === 0) {
        console.log(`  ${C.yellow}→ No memories yet. Use /learn after sessions or /remember key=value${C.reset}`);
      } else {
        const sorted = [...memories].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const latest = sorted[0];
        const age = latest ? Math.round((Date.now() - new Date(latest.updatedAt)) / 60000) : null;
        const ageStr = age !== null ? (age < 60 ? `${age}m ago` : `${Math.round(age/60)}h ago`) : '?';
        console.log(`  ${C.dim}Latest update: ${ageStr}${C.reset}`);
        if (memories.length > 30) {
          console.log(`  ${C.yellow}→ Many memories (${memories.length}) — consider pruning with /forget${C.reset}`);
        }
      }

      // Model suggestion
      console.log(`\n${C.bold}Active Model:${C.reset} ${providerName}:${model.id}`);
      const ctx = model.contextWindow || model.maxTokens || 0;
      if (ctx > 0 && ctx < 32000 && optMsgs.length > 10) {
        console.log(`  ${C.yellow}→ Small context window (${(ctx/1000).toFixed(0)}k). Consider /model for larger context${C.reset}`);
      } else if (ctx >= 128000) {
        console.log(`  ${C.green}→ Large context window (${(ctx/1000).toFixed(0)}k) — good for long sessions${C.reset}`);
      }

      // Session stats
      const userTurns = optMsgs.filter(m => m.role === 'user').length;
      console.log(`\n${C.bold}Session:${C.reset} ${userTurns} turns, ${optMsgs.length} messages total`);
      if (userTurns >= 4 && userTurns % 10 === 0) {
        console.log(`  ${C.cyan}→ Good time to /learn and capture session insights${C.reset}`);
      }

      // Quick wins
      const tips = [];
      const nexPath = require('path').join(process.cwd(), 'NEX.md');
      if (!require('fs').existsSync(nexPath)) {
        tips.push(`Create NEX.md in project root to give nex-code project-specific instructions`);
      }
      if (tips.length > 0) {
        console.log(`\n${C.bold}Quick Wins:${C.reset}`);
        for (const tip of tips) {
          console.log(`  ${C.cyan}→${C.reset} ${tip}`);
        }
      }

      console.log('');
      return true;
    }

    case '/plan': {
      const { getActivePlan, approvePlan, startExecution, setPlanMode, getPlanContent, formatPlan } = require('./planner');
      const { invalidateSystemPromptCache } = require('./agent');
      const arg = rest.join(' ').trim();
      if (arg === 'status') {
        const plan = getActivePlan();
        console.log(formatPlan(plan));
        return true;
      }
      if (arg === 'approve') {
        if (approvePlan()) {
          startExecution();
          setPlanMode(false);
          invalidateSystemPromptCache();
          const hasContent = !!getPlanContent();
          console.log(`${C.green}${C.bold}Plan approved!${C.reset} ${hasContent ? 'Executing the planned steps...' : 'Starting execution...'}`);
          console.log(`${C.dim}Plan mode disabled — all tools now available.${C.reset}`);
        } else {
          console.log(`${C.red}No plan to approve. Enter plan mode first with /plan${C.reset}`);
        }
        return true;
      }
      // Enter plan mode
      setPlanMode(true);
      invalidateSystemPromptCache();
      console.log(`
${C.cyan}${C.bold}┌─ PLAN MODE ─────────────────────────────────────┐${C.reset}
${C.cyan}${C.bold}│${C.reset}  Analysis only — no file changes until approved  ${C.cyan}${C.bold}│${C.reset}
${C.cyan}${C.bold}│${C.reset}  ${C.dim}Read-only tools only · /plan approve to execute${C.reset}  ${C.cyan}${C.bold}│${C.reset}
${C.cyan}${C.bold}└─────────────────────────────────────────────────┘${C.reset}`);
      if (arg) {
        console.log(`${C.dim}Task: ${arg}${C.reset}`);
      }
      return true;
    }

    case '/plans': {
      const { listPlans } = require('./planner');
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
      const { getAutonomyLevel, setAutonomyLevel, AUTONOMY_LEVELS } = require('./planner');
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
      const { listPermissions } = require('./permissions');
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
      const { setPermission, savePermissions } = require('./permissions');
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
      const { setPermission, savePermissions } = require('./permissions');
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
      const { isGitRepo, commit, analyzeDiff, formatDiffSummary } = require('./git');
      const { confirm } = require('./safety');
      if (!isGitRepo()) {
        console.log(`${C.red}Not a git repository${C.reset}`);
        return true;
      }
      const msg = rest.join(' ').trim();
      if (msg) {
        const hash = await commit(msg);
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
      const summary = await formatDiffSummary();
      console.log(summary);
      const isConfirmed = await confirm('  Commit changes?');
      if (!isConfirmed) return true;
      const hash = await commit('nex-code update');
      if (hash) console.log(`${C.green}  ✓ Committed: ${hash}${C.reset}`);
      return true;
    }

    case '/diff': {
      const { isGitRepo, formatDiffSummary } = require('./git');
      if (!isGitRepo()) {
        console.log(`${C.red}Not a git repository${C.reset}`);
        return true;
      }
      console.log(formatDiffSummary());
      return true;
    }

    case '/review': {
      const { isGitRepo: isGitRepo2, getDiff: getDiff2 } = require('./git');
      const { processInput: processInputFn } = require('./agent');
      const reviewArgs = rest.join(' ').trim();
      const strictMode = reviewArgs.includes('--strict');
      const fileArg = reviewArgs.replace('--strict', '').trim();

      const strictAddendum = strictMode
        ? `\n\n⚠ STRICT MODE: You MUST identify at least 3 critical weaknesses. If the code appears clean, dig deeper — look for subtle error-swallowing, race conditions, missing validation, or architecture risks. Do not give a passing score without identifying at least 3 critical issues.`
        : '';

      const reviewInstructions = `## Review Protocol

**Phase 1 — Broad Scan:** Read the target code and identify all issues at a high level.

**Phase 2 — Deep Dive:** Select the 2-3 files or sections you consider most critical (highest risk or complexity). For each, run a targeted grep for specific anti-patterns:
- Error swallowing: \`catch.*{\\s*}\` or \`catch.*console\`
- Missing awaits, unhandled promises
- Hardcoded secrets or credentials
- Input validation gaps
Briefly report what each grep found or confirmed.

**Phase 3 — Report:** Present findings in this format:

### Score

| Category | Score | Notes |
|---|---|---|
| Security | X/10 | ... |
| Error Handling | X/10 | ... |
| Code Quality | X/10 | ... |
| Correctness | X/10 | ... |
| **Overall** | **X/10** | ... |

### Findings

For each issue, include:
- **Severity**: 🔴 Critical / 🟡 Warning / 🔵 Suggestion
- **Location**: file:line
- **Issue**: description
- **Fix**:
\`\`\`diff
- old code
+ fixed code
\`\`\`${strictAddendum}`;

      let reviewPrompt;
      if (fileArg) {
        reviewPrompt = `Do a thorough code review of \`${fileArg}\`.\n\n${reviewInstructions}`;
      } else {
        if (!isGitRepo2()) {
          console.log(`${C.red}Not a git repository — try /review <file>${C.reset}`);
          return true;
        }
        const [diff, stagedDiff] = await Promise.all([getDiff2(false), getDiff2(true)]);
        const fullDiff = stagedDiff || diff;
        if (!fullDiff || !fullDiff.trim()) {
          console.log(`${C.yellow}No changes to review — commit something or specify a file: /review <file>${C.reset}`);
          return true;
        }
        reviewPrompt = `Review the following code diff.\n\n${reviewInstructions}\n\n\`\`\`diff\n${fullDiff.substring(0, 20000)}\n\`\`\``;
      }
      await processInputFn(reviewPrompt);
      return true;
    }

    case '/branch': {
      const { isGitRepo, getCurrentBranch, createBranch } = require('./git');
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
      const { listServers, connectAll, disconnectAll } = require('./mcp');
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
      const { listHooks } = require('./hooks');
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
      const { listSkills, enableSkill, disableSkill } = require('./skills');
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

    case '/tasks': {
      const { renderTaskList, clearTasks } = require('./tasks');
      const taskArg = rest.join(' ').trim();
      if (taskArg === 'clear') {
        clearTasks();
        console.log(`${C.green}Tasks cleared${C.reset}`);
        return true;
      }
      console.log('\n' + renderTaskList() + '\n');
      return true;
    }

    case '/undo': {
      const { undo, getUndoCount } = require('./file-history');
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
      const { redo, getRedoCount } = require('./file-history');
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
      const { getHistory, getUndoCount, getRedoCount } = require('./file-history');
      const history = getHistory(20);
      if (history.length === 0) {
        console.log(`${C.dim}No file changes in this session${C.reset}`);
        return true;
      }
      console.log(`\n${C.bold}File Change History${C.reset}\n`);
      for (const entry of history) {
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        console.log(`  ${C.dim}${time}${C.reset} ${C.yellow}${entry.tool}${C.reset} ${entry.filePath}`);
      }
      console.log(`\n${C.dim}${getUndoCount()} undo / ${getRedoCount()} redo available${C.reset}\n`);
      return true;
    }

    case '/k8s': {
      const k8sArg = rest.join(' ').trim();
      const { exec: k8sExec } = require('child_process');
      const { promisify: k8sPromisify } = require('util');
      const execAsync = k8sPromisify(k8sExec);
      const server = k8sArg || null;
      const sshPrefix = server ? `ssh -o ConnectTimeout=10 -o BatchMode=yes ${server.replace(/[^a-zA-Z0-9@._-]/g, '')} ` : '';
      const wrapCmd = (cmd) => server ? `${sshPrefix}"${cmd.replace(/"/g, '\\"')}"` : cmd;
      console.log(`\n${C.bold}${C.cyan}Kubernetes Overview${C.reset}${server ? C.dim + ' (remote: ' + server + ')' + C.reset : ''}\n`);
      // List namespaces
      try {
        const { stdout: ns } = await execAsync(wrapCmd('kubectl get namespaces --no-headers -o custom-columns=NAME:.metadata.name'), { timeout: 15000 });
        const namespaces = ns.trim().split('\n').filter(Boolean);
        console.log(`${C.bold}Namespaces (${namespaces.length}):${C.reset}`);
        for (const n of namespaces) console.log(`  ${C.cyan}${n}${C.reset}`);
        console.log();
      } catch {
        console.log(`${C.dim}Could not reach cluster — is kubectl configured?${C.reset}\n`);
        return true;
      }
      // List all pods
      try {
        const { stdout: pods } = await execAsync(wrapCmd('kubectl get pods -A --no-headers -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,READY:.status.containerStatuses[0].ready,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount'), { timeout: 20000 });
        const podLines = pods.trim().split('\n').filter(Boolean);
        const running = podLines.filter(l => l.includes('Running')).length;
        const pending = podLines.filter(l => l.includes('Pending')).length;
        const failed = podLines.filter(l => l.includes('Failed') || l.includes('Error') || l.includes('CrashLoop')).length;
        console.log(`${C.bold}Pods: ${podLines.length} total  ${C.green}${running} running${C.reset}  ${C.yellow}${pending} pending${C.reset}  ${C.red}${failed} unhealthy${C.reset}\n`);
        // Show unhealthy first
        const unhealthy = podLines.filter(l => !l.includes('Running') && !l.includes('<none>'));
        if (unhealthy.length > 0) {
          console.log(`${C.bold}${C.red}Unhealthy Pods:${C.reset}`);
          for (const l of unhealthy) console.log(`  ${C.red}${l}${C.reset}`);
          console.log();
        }
        console.log(`${C.dim}Use k8s_pods / k8s_logs / k8s_exec tools for details${C.reset}`);
        console.log(`${C.dim}Or: /k8s user@host to query a remote cluster${C.reset}\n`);
      } catch (e) {
        console.log(`${C.dim}Could not list pods: ${e.message}${C.reset}\n`);
      }
      return true;
    }

    case '/servers': {
      const { loadServerProfiles, resolveProfile: rp, sshExec: sx } = require('./ssh');
      const profiles = loadServerProfiles();
      const names = Object.keys(profiles);
      if (names.length === 0) {
        console.log(`\n${C.dim}No servers configured. Create .nex/servers.json:${C.reset}`);
        console.log(`${C.dim}  { "prod": { "host": "1.2.3.4", "user": "jarvis", "os": "almalinux9" } }${C.reset}\n`);
        return true;
      }

      const subcmd = rest[0];

      if (subcmd === 'ping') {
        // SSH connectivity check for all (or specified) servers
        const toCheck = rest[1] ? [rest[1]] : names;
        console.log(`\n${C.bold}${C.cyan}Server connectivity:${C.reset}`);
        await Promise.all(toCheck.map(async (name) => {
          if (!profiles[name]) {
            console.log(`  ${C.red}✗${C.reset} ${name} — unknown profile`);
            return;
          }
          try {
            const profile = { ...profiles[name], _name: name };
            const { exitCode } = await sx(profile, 'echo ok', { timeout: 8000 });
            if (exitCode === 0) {
              console.log(`  ${C.green}✓${C.reset} ${name} (${profile.user ? profile.user + '@' : ''}${profile.host})`);
            } else {
              console.log(`  ${C.red}✗${C.reset} ${name} (${profile.host}) — SSH failed (exit ${exitCode})`);
            }
          } catch (e) {
            console.log(`  ${C.red}✗${C.reset} ${name} — ${e.message}`);
          }
        }));
        console.log('');
        return true;
      }

      // Default: list all profiles
      const { formatProfile } = require('./ssh');
      console.log(`\n${C.bold}${C.cyan}Configured servers (${names.length}):${C.reset}`);
      for (const name of names) {
        console.log(`  ${C.green}${name}${C.reset}  ${C.dim}${formatProfile(name, profiles[name])}${C.reset}`);
      }
      console.log(`\n${C.dim}/servers ping          — check SSH connectivity for all servers${C.reset}`);
      console.log(`${C.dim}/servers ping <name>   — check a specific server${C.reset}\n`);
      return true;
    }

    case '/docker': {
      const { loadServerProfiles, sshExec: sshExecDocker } = require('./ssh');
      const { exec: execDocker } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(execDocker);
      const dockerCmd = rest[0] === '-a' || rest[0] === '--all'
        ? 'docker ps -a --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"'
        : 'docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"';

      const profiles = loadServerProfiles();
      const servers = [['local', null], ...Object.entries(profiles)];

      console.log(`\n${C.bold}${C.cyan}Docker Containers:${C.reset}`);
      for (const [name, profile] of servers) {
        const label = name === 'local' ? `${C.dim}local${C.reset}` : `${C.cyan}${name}${C.reset}`;
        try {
          let out;
          if (name === 'local') {
            const { stdout } = await execAsync(dockerCmd, { timeout: 8000 });
            out = (stdout || '').trim();
          } else {
            const r = await sshExecDocker(profile, dockerCmd, { timeout: 10000 });
            out = [r.stdout, r.stderr].filter(Boolean).join('').trim();
            if (r.exitCode !== 0) { console.log(`  ${label}: ${C.red}SSH error (${r.exitCode})${C.reset}`); continue; }
          }
          if (!out || out === 'NAMES\tIMAGE\tSTATUS\tPORTS') {
            console.log(`  ${label}: ${C.dim}(no containers)${C.reset}`);
          } else {
            console.log(`  ${label}:`);
            out.split('\n').forEach((line) => console.log(`    ${C.dim}${line}${C.reset}`));
          }
        } catch (e) {
          console.log(`  ${label}: ${C.red}${e.message}${C.reset}`);
        }
      }
      console.log('');
      return true;
    }

    case '/deploy': {
      const { loadDeployConfigs: ldc } = require('./deploy-config');
      const configs = ldc();
      const names = Object.keys(configs);
      const subcmd = rest[0];

      // /deploy <name> [--dry-run] — run a named deploy
      if (subcmd && names.includes(subcmd)) {
        const dryRun = rest.includes('--dry-run') || rest.includes('-n');
        const cfg = configs[subcmd];
        const { executeTool } = require('./tools');
        console.log(`\n${C.bold}Running deploy: ${subcmd}${dryRun ? ' (dry run)' : ''}${C.reset}`);
        const result = await executeTool('deploy', { ...cfg, dry_run: dryRun });
        console.log(result);
        return true;
      }

      // List all configs
      if (names.length === 0) {
        console.log(`\n${C.dim}No deploy configs. Run /init to create .nex/deploy.json${C.reset}\n`);
        return true;
      }
      console.log(`\n${C.bold}${C.cyan}Deploy configs (${names.length}):${C.reset}`);
      for (const [n, cfg] of Object.entries(configs)) {
        const local = cfg.local_path || '';
        const remote = `${cfg.server}:${cfg.remote_path}`;
        const script = cfg.deploy_script ? `  ${C.dim}→ ${cfg.deploy_script}${C.reset}` : '';
        console.log(`  ${C.green}${n}${C.reset}  ${C.dim}${local} → ${remote}${C.reset}${script}`);
      }
      console.log(`\n${C.dim}/deploy <name>          — run a named deploy${C.reset}`);
      console.log(`${C.dim}/deploy <name> --dry-run — preview without syncing${C.reset}\n`);
      return true;
    }

    case '/init': {
      const { runServerWizard, runDeployWizard, setWizardRL } = require('./wizard');
      setWizardRL(rl);
      const subcmd = rest[0];
      if (subcmd === 'deploy') {
        await runDeployWizard();
      } else {
        await runServerWizard();
      }
      return true;
    }

    case '/setup':
    case '/settings': {
      const { runSetupWizard } = require('./setup');
      await runSetupWizard({ rl, force: true });
      return true;
    }

    case '/exit':
    case '/quit':
      process.stdout.write('\x1b[r\x1b[H\x1b[2J\x1b[3J');
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
  const { isPlanMode, getAutonomyLevel } = require('./planner');
  const parts = [];

  if (isPlanMode()) parts.push('plan');

  const level = getAutonomyLevel();
  if (level !== 'interactive') parts.push(level);

  const providerName = getActiveProviderName();
  const model = getActiveModel();
  // Show short model label: strip provider prefix for well-known providers
  const modelLabel = providerName === 'ollama' ? model.id : `${providerName}:${model.id}`;
  parts.push(modelLabel);

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

async function checkLocalOllama() {
  const localProvider = getProvider('local');
  if (!localProvider) return false;
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    await execAsync('curl -s --max-time 1 http://localhost:11434/api/tags');
    setActiveModel('local:llama3');
    return true;
  } catch {
    return false;
  }
}

async function startREPL() {
  const { setAbortSignalGetter, getConversationLength, processInput } = require('./agent');
  // Wire abort signal into agent.js (avoids circular dependency)
  setAbortSignalGetter(getAbortSignal);

  // Check that at least one provider is configured
  const providerList = listProviders();
  const hasConfigured = providerList.some((p) => p.configured);

  // Parallelize initial checks and loading
  const loadPromise = (async () => {
    loadAllSkills();
    const model = getActiveModel();
    const providerName = getActiveProviderName();
    return { model, providerName };
  })();

  const ollamaPromise = (async () => {
    if (!hasConfigured) {
      const detected = await checkLocalOllama();
      if (detected) {
        console.log(`${C.green}✓ Local Ollama detected — using local models${C.reset}`);
        console.log(`${C.dim}Tip: Set API keys for cloud providers for more model options (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)${C.reset}\n`);
        return true;
      }
      return false;
    }
    return true;
  })();

  // Check for new version (non-blocking)
  const versionCheckPromise = (async () => {
    // Skip version check if disabled by environment variable
    if (process.env.NEX_DISABLE_UPDATE_CHECK === '1') {
      return { hasNewVersion: false };
    }
    
    try {
      const { checkForNewVersion } = require('./version-check');
      return await checkForNewVersion();
    } catch (error) {
      // Silently ignore version check errors
      return { hasNewVersion: false };
    }
  })();

  const [loadInfo, ollamaReady, versionInfo] = await Promise.all([loadPromise, ollamaPromise, versionCheckPromise]);

  if (!ollamaReady && !hasConfigured) {
    console.error(`\n${C.red}✗ No provider configured and no local Ollama detected.${C.reset}\n`);
    // ... (rest of error message)
    process.exit(1);
  }

  // Create readline + activate sticky footer BEFORE banner so all output
  // (including the banner) flows through wrappedLog and is tracked from row 1.
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

  // ─── ask_user handler — options-based clarification UI ──────
  const { setAskUserHandler } = require('./tools');
  setAskUserHandler(async (question, options) => {
    const C_reset = '\x1b[0m', C_bold = '\x1b[1m', C_dim = '\x1b[2m';
    const C_cyan = '\x1b[36m', C_yellow = '\x1b[33m';

    process.stdout.write(`\n  ${C_bold}${C_yellow}❓${C_reset}  ${C_bold}${question}${C_reset}\n\n`);
    options.forEach((opt, i) => {
      process.stdout.write(`  ${C_cyan}${i + 1}${C_reset}  ${opt}\n`);
    });
    process.stdout.write(`  ${C_dim}${options.length + 1}${C_reset}  ${C_dim}Eigene Antwort…${C_reset}\n`);
    process.stdout.write(`\n  ${C_cyan}[1-${options.length + 1}]${C_reset} › `);

    return new Promise((resolve) => {
      rl.pause();
      if (process.stdin.isTTY) process.stdin.setRawMode(true);

      const onData = (buf) => {
        const ch = buf.toString();

        // Ctrl+C
        if (ch === '\u0003') {
          process.stdout.write('\n');
          cleanup();
          resolve('');
          return;
        }

        const n = parseInt(ch);

        if (n >= 1 && n <= options.length) {
          process.stdout.write(`${C_bold}${options[n - 1]}${C_reset}\n\n`);
          cleanup();
          resolve(options[n - 1]);
        } else if (n === options.length + 1 || ch === '\r' || ch === '\n') {
          process.stdout.write('\n');
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write(`  ${C_cyan}›${C_reset} `);
          rl.resume();
          rl.once('line', (line) => {
            process.stdout.write('\n');
            resolve(line.trim() || '');
          });
        }
      };

      function cleanup() {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        rl.resume();
      }

      process.stdin.on('data', onData);
    });
  });

  const footer = new StickyFooter();
  footer.activate(rl);

  const bannerModel = loadInfo.providerName === 'ollama'
    ? loadInfo.model.id
    : `${loadInfo.providerName}:${loadInfo.model.id}`;
  banner(bannerModel, CWD, { yolo: getAutoConfirm() });

  // Display version update notification if available
  if (versionInfo.hasNewVersion) {
    console.log(`${C.yellow}💡 New version available!${C.reset} Run ${C.cyan}npm update -g nex-code${C.reset} to upgrade from ${C.dim}${versionInfo.currentVersion}${C.reset} to ${C.green}${versionInfo.latestVersion}${C.reset}\n`);
  }

  await printContext(CWD);

  // ─── SIGINT (Ctrl+C) Handler ────────────────────────────────
  let _processing = false;
  let _sigintCount = 0;
  let _exitPrompt = false;
  let _exitPromptTimer = null;

  // Graceful shutdown handler
  function gracefulShutdown() {
    // Flush any pending auto-save
    flushAutoSave();
    footer.deactivate();
    cleanupTerminal();
    if (process.stdin.isTTY) process.stdout.write('\x1b[?2004l');
    process.stdout.write('\x1b[r\x1b[H\x1b[2J\x1b[3J');
    process.exit(0);
  }

  // Register exit handlers
  process.on('SIGTERM', gracefulShutdown);

  // Also handle normal exit
  process.on('exit', () => {
    flushAutoSave();
  });

  // Handle Ctrl+C via readline (fires on TTY before process SIGINT)
  rl.on('SIGINT', () => {
    cleanupTerminal();
    _sigintCount++;

    // 2nd Ctrl+C always exits immediately — no more hanging
    if (_sigintCount >= 2) {
      gracefulShutdown();
      return;
    }

    if (_processing) {
      // 1st Ctrl+C during work: cancel task
      if (_abortController) _abortController.abort();
      const { cancelPendingAskUser } = require('./tools');
      cancelPendingAskUser();
      console.log(`\n${C.yellow}  Task cancelled. Press Ctrl+C again to exit.${C.reset}`);
      _processing = false;
      rl.setPrompt(getPrompt());
      rl.prompt();
    } else {
      // 1st Ctrl+C at prompt: warn, reset after 2s
      process.stdout.write(`\n${C.dim}  (Press Ctrl+C again to exit)${C.reset}\n`);
      rl.setPrompt(getPrompt());
      rl.prompt();
      if (_exitPromptTimer) clearTimeout(_exitPromptTimer);
      _exitPromptTimer = setTimeout(() => {
        _sigintCount = 0;
        _exitPromptTimer = null;
      }, 2000);
    }
  });

  // Fallback SIGINT handler for non-TTY (e.g. piped input or external signals)
  process.on('SIGINT', () => {
    if (!process.stdin.isTTY) {
      gracefulShutdown();
    } else {
      // Safety-net: rl.on('SIGINT') should handle TTY, but if readline is
      // in a broken state after cancel, this ensures 2nd Ctrl+C always exits
      _sigintCount++;
      if (_sigintCount >= 2) gracefulShutdown();
    }
  });

  // ─── Bracketed Paste Mode ──────────────────────────────────
  let _pasteActive = false;
  let _pasteLines = [];
  let _pasteCount = 0;
  let _pastes = {};   // { 1: "full content", 2: "full content", ... }
  let _hadPaste = false;

  /**
   * Complete a paste: append [Pasted content #N] label to existing rl.line so
   * the user can freely interleave typed text and pastes.  On Enter the labels
   * are resolved back to their actual content.
   */
  function _completePaste() {
    const combined = _pasteLines.join('\n').replace(/\r/g, '').trim();
    _pasteLines = [];
    _pasteActive = false;
    if (!combined) return true;

    _pasteCount++;
    _hadPaste = true;
    const n = _pasteCount;
    _pastes[n] = combined;

    const thisLines = combined.split('\n').length;
    const thisLabel = thisLines > 1 ? `[Pasted content #${n} — ${thisLines} lines]` : `[Pasted content #${n}]`;

    // Append label to whatever the user has already typed (preserve existing text)
    const currentLine = rl.line || '';
    const sep = currentLine && !currentLine.endsWith(' ') ? ' ' : '';
    const newLine = currentLine + sep + thisLabel;

    rl.setPrompt(getPrompt());

    // Inject into readline buffer without rl.write() (which splits on \n → spurious 'line' events)
    rl.prompt();
    rl.line = newLine;
    rl.cursor = newLine.length;
    rl._refreshLine();

    return true;
  }

  /** Replace [Pasted content #N ...] markers in a string with their stored content. */
  function _resolvePastes(text) {
    return text.replace(/\[Pasted content #(\d+)(?:[^\]]*)\]/g, (_, num) => {
      return _pastes[Number(num)] || '';
    });
  }

  function _resetPasteState() {
    _pasteCount = 0;
    _pastes = {};
    _hadPaste = false;
  }

  if (process.stdin.isTTY) {
    process.stdout.write('\x1b[?2004h'); // enable bracketed paste

    const origEmit = process.stdin.emit.bind(process.stdin);
    process.stdin.emit = function (event, ...args) {
      if (event !== 'data') return origEmit.call(process.stdin, event, ...args);

      // Normalize: Buffer → string
      let data = args[0];
      if (Buffer.isBuffer(data)) data = data.toString('utf8');
      if (typeof data !== 'string') return origEmit.call(process.stdin, event, ...args);

      const hasStart = data.includes(PASTE_START);
      const hasEnd = data.includes(PASTE_END);

      // Case 1: Complete paste in single chunk (most common for small/medium pastes)
      if (hasStart && hasEnd) {
        const clean = stripPasteSequences(data);
        if (clean) _pasteLines.push(...clean.split('\n'));
        return _completePaste();
      }

      // Case 2: Paste start (multi-chunk paste begins)
      if (hasStart) {
        _pasteActive = true;
        _pasteLines = [];
        const clean = stripPasteSequences(data);
        if (clean) _pasteLines.push(...clean.split('\n'));
        return true;
      }

      // Case 3: Paste end (multi-chunk paste completes)
      if (hasEnd) {
        const clean = stripPasteSequences(data);
        if (clean) _pasteLines.push(...clean.split('\n'));
        return _completePaste();
      }

      // Case 4: Middle of multi-chunk paste
      if (_pasteActive) {
        const clean = stripPasteSequences(data);
        if (clean) _pasteLines.push(...clean.split('\n'));
        return true;
      }

      // Normal data — pass through
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

    // Resolve any [Pasted content #N] labels to their actual content
    if (Object.keys(_pastes).length > 0) {
      line = _resolvePastes(line);
      _resetPasteState();
      rl.setPrompt(getPrompt());
    }

    // Mid-run input: buffer user notes instead of dropping them silently
    if (_processing) {
      const note = line.trim();
      if (note) {
        const { injectMidRunNote } = require('./agent');
        injectMidRunNote(note);
        process.stdout.write(`${C.cyan}  ✎ Wird im nächsten Schritt berücksichtigt${C.reset}\n`);
      }
      return;
    }

    // Multi-line mode handling
    if (multiLineBuffer !== null) {
      // """ mode: wait for closing """
      if (multiLineBuffer._mode === 'triple') {
        if (line.trim() === '"""') {
          const input = multiLineBuffer.join('\n').trim();
          multiLineBuffer = null;
          if (input) {
            appendHistory(input.replace(/\n/g, '\\n'));
            _processing = true;
            _sigintCount = 0;
            _exitPrompt = false;
            if (_exitPromptTimer) { clearTimeout(_exitPromptTimer); _exitPromptTimer = null; }
            _abortController = new AbortController();
            try {
              await processInput(input);
            } catch (err) {
              if (!_abortController?.signal?.aborted) {
                const userMessage = err.message?.split('\n')[0] || 'An unexpected error occurred';
                console.log(`${C.red}Error: ${userMessage}${C.reset}`);
              }
            }
            _processing = false;
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
          _processing = true;
          _sigintCount = 0;
          _exitPrompt = false;
          if (_exitPromptTimer) { clearTimeout(_exitPromptTimer); _exitPromptTimer = null; }
          _abortController = new AbortController();
          try {
            await processInput(input);
          } catch (err) {
            if (!_abortController?.signal?.aborted) {
              const userMessage = err.message?.split('\n')[0] || 'An unexpected error occurred';
              console.log(`${C.red}Error: ${userMessage}${C.reset}`);
            }
          }
          const { getConversationLength } = require('./agent');
          _processing = false;
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
      await handleSlashCommand(input, rl);
      rl.setPrompt(getPrompt());
      rl.prompt();
      return;
    }

    // Always echo the full resolved prompt with subtle background highlight
    {
      const BG = '\x1b[48;5;237m'; // subtle dark-gray background
      const cols = (process.stdout.columns || 80);
      const echoLines = input.split('\n');
      echoLines.forEach((l, i) => {
        // \x1b[22;39m resets bold+fg only — keeps background active
        const marker = i === 0 ? `\x1b[1;36m›\x1b[22;39m` : ' ';
        const visibleLen = 2 + l.length; // '› ' or '  ' prefix
        const pad = ' '.repeat(Math.max(0, cols - visibleLen));
        console.log(`${BG}${marker} ${l}${pad}\x1b[0m`);
      });
    }

    // Process through agent
    _processing = true;
    _sigintCount = 0;
    _exitPrompt = false;
    if (_exitPromptTimer) { clearTimeout(_exitPromptTimer); _exitPromptTimer = null; }
    _abortController = new AbortController();
    try {
      await processInput(input);
    } catch (err) {
      if (!_abortController?.signal?.aborted) {
        const userMessage = err.message?.split('\n')[0] || 'An unexpected error occurred';
        console.log(`${C.red}Error: ${userMessage}${C.reset}`);
      }
    }
    _processing = false;

    const { getConversationLength } = require('./agent');
    const msgCount = getConversationLength();
    if (msgCount > 0) {
      process.stdout.write(`${C.gray}[${msgCount} messages] ${C.reset}`);
    }
    rl.setPrompt(getPrompt());
    rl.prompt();
  });

  rl.on('close', () => {
    if (process.stdin.isTTY) process.stdout.write('\x1b[?2004l'); // disable bracketed paste
    process.stdout.write('\x1b[r\x1b[H\x1b[2J\x1b[3J');
    process.exit(0);
  });
}

module.exports = { startREPL, getPrompt, loadHistory, appendHistory, getHistoryPath, HISTORY_MAX, showCommandList, completer, completeFilePath, handleSlashCommand, showProviders, showHelp, renderBar, hasPasteStart, hasPasteEnd, stripPasteSequences, getAbortSignal };

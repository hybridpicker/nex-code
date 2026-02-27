/**
 * cli/agent.js — Agentic Loop + Conversation State
 * Hybrid: chat + tool-use in a single conversation.
 */

const { C, Spinner, formatToolCall, formatResult } = require('./ui');
const { callStream } = require('./providers/registry');
const { parseToolArgs } = require('./ollama');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');
const { gatherProjectContext } = require('./context');
const { fitToContext, getUsage } = require('./context-engine');
const { autoSave } = require('./session');
const { getMemoryContext } = require('./memory');
const { checkPermission, setPermission, savePermissions } = require('./permissions');
const { confirm, setAllowAlwaysHandler } = require('./safety');
const { isPlanMode, getPlanModePrompt } = require('./planner');
const { StreamRenderer } = require('./render');
const { runHooks } = require('./hooks');
const { routeMCPCall, getMCPToolDefinitions } = require('./mcp');
const { getSkillInstructions, getSkillToolDefinitions, routeSkillCall } = require('./skills');
const { trackUsage } = require('./costs');
const { validateToolArgs } = require('./tool-validator');
const { filterToolsForModel } = require('./tool-tiers');

const MAX_ITERATIONS = 30;
const MAX_RATE_LIMIT_RETRIES = 5;
const CWD = process.cwd();

// Wire up "a" (always allow) from confirm dialog → permission system
setAllowAlwaysHandler((toolName) => {
  setPermission(toolName, 'allow');
  savePermissions();
  console.log(`${C.green}  ✓ ${toolName}: always allow${C.reset}`);
});

// Persistent conversation state
let conversationMessages = [];

function buildSystemPrompt() {
  const projectContext = gatherProjectContext(CWD);

  const memoryContext = getMemoryContext();
  const skillInstructions = getSkillInstructions();
  const planPrompt = isPlanMode() ? getPlanModePrompt() : '';

  return `You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${CWD}
All relative paths resolve from this directory.

PROJECT CONTEXT:
${projectContext}
${memoryContext ? `\n${memoryContext}\n` : ''}${skillInstructions ? `\n${skillInstructions}\n` : ''}${planPrompt ? `\n${planPrompt}\n` : ''}
BEHAVIOR:
- You can use tools OR just respond with text — decide based on what's needed.
- For simple questions, answer directly without tools.
- For coding tasks, use tools to read files, make changes, run tests, etc.
- Be efficient: read only what you need, implement precisely.
- Prefer edit_file for targeted changes over write_file for full rewrites.
- Use relative paths when possible.

SAFETY:
- NEVER read .env files or credentials.
- NEVER run destructive commands (rm -rf /, etc.).
- Dangerous commands (git push, npm publish, sudo) require user confirmation.`;
}

function clearConversation() {
  conversationMessages = [];
}

function getConversationLength() {
  return conversationMessages.length;
}

function getConversationMessages() {
  return conversationMessages;
}

function setConversationMessages(messages) {
  conversationMessages = messages;
}

/**
 * Process a single user input through the agentic loop.
 * Maintains conversation state across calls.
 */
async function processInput(userInput) {
  conversationMessages.push({ role: 'user', content: userInput });

  const systemPrompt = buildSystemPrompt();
  const fullMessages = [{ role: 'system', content: systemPrompt }, ...conversationMessages];

  // Context-aware compression: fit messages into context window
  const { messages: fittedMessages, compressed, tokensRemoved } = fitToContext(
    fullMessages,
    TOOL_DEFINITIONS
  );

  if (compressed) {
    console.log(`${C.dim}  [context compressed, ~${tokensRemoved} tokens freed]${C.reset}`);
  }

  // Context budget warning
  const usage = getUsage(fullMessages, TOOL_DEFINITIONS);
  if (usage.percentage > 85) {
    console.log(`${C.yellow}  ⚠ Context ${Math.round(usage.percentage)}% full — consider /clear or /save + start fresh${C.reset}`);
  }

  // Use fitted messages for the API call, but keep fullMessages reference for appending
  let apiMessages = fittedMessages;
  let rateLimitRetries = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Step indicator for multi-step tasks
    if (i > 0) {
      console.log(`${C.dim}  ⟳ step ${i + 1}${C.reset}`);
    }

    const spinnerText = i > 0 ? `Thinking... (step ${i + 1})` : 'Thinking...';
    const spinner = new Spinner(spinnerText);
    spinner.start();
    let firstToken = true;
    let streamedText = '';
    const stream = new StreamRenderer();

    let result;
    try {
      const allTools = filterToolsForModel([...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()]);
      result = await callStream(apiMessages, allTools, {
        onToken: (text) => {
          if (firstToken) {
            spinner.stop();
            firstToken = false;
          }
          streamedText += text;
          stream.push(text);
        },
      });
    } catch (err) {
      spinner.stop();
      console.log(`${C.red}${err.message}${C.reset}`);

      if (err.message.includes('429')) {
        rateLimitRetries++;
        if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
          console.log(`${C.red}  Rate limit: max retries (${MAX_RATE_LIMIT_RETRIES}) exceeded${C.reset}`);
          autoSave(conversationMessages);
          break;
        }
        const delay = Math.min(10000 * Math.pow(2, rateLimitRetries - 1), 120000);
        console.log(`${C.yellow}  Rate limit — waiting ${Math.round(delay / 1000)}s (retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})...${C.reset}`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Auto-save on error so conversation isn't lost
      autoSave(conversationMessages);
      break;
    }

    if (firstToken) {
      spinner.stop();
    }

    // Flush remaining stream buffer
    if (streamedText) {
      stream.flush();
    }

    // Track token usage for cost dashboard
    if (result && result.usage) {
      const { getActiveProviderName, getActiveModelId } = require('./providers/registry');
      trackUsage(
        getActiveProviderName(),
        getActiveModelId(),
        result.usage.prompt_tokens || 0,
        result.usage.completion_tokens || 0
      );
    }

    const { content, tool_calls } = result;

    // Build assistant message for history
    const assistantMsg = { role: 'assistant', content: content || '' };
    if (tool_calls && tool_calls.length > 0) {
      assistantMsg.tool_calls = tool_calls;
    }
    conversationMessages.push(assistantMsg);
    apiMessages.push(assistantMsg);

    // No tool calls → response complete
    if (!tool_calls || tool_calls.length === 0) {
      autoSave(conversationMessages);
      return;
    }

    // Execute tool calls
    for (const tc of tool_calls) {
      const fnName = tc.function.name;
      const args = parseToolArgs(tc.function.arguments);
      const callId = tc.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (!args) {
        // Find the tool definition to show expected schema
        const allToolDefs = [...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()];
        const toolDef = allToolDefs.find(t => t.function.name === fnName);
        const schema = toolDef
          ? JSON.stringify(toolDef.function.parameters, null, 2)
          : 'unknown';

        console.log(`${C.yellow}  ⚠ ${fnName}: malformed arguments, sending schema hint${C.reset}`);
        const toolMsg = {
          role: 'tool',
          content: `ERROR: Malformed tool arguments. Could not parse your arguments as JSON.\n` +
            `Raw input: ${typeof tc.function.arguments === 'string' ? tc.function.arguments.substring(0, 200) : 'N/A'}\n\n` +
            `Expected JSON schema for "${fnName}":\n${schema}\n\n` +
            `Please retry the tool call with valid JSON arguments matching this schema.`,
          tool_call_id: callId,
        };
        conversationMessages.push(toolMsg);
        apiMessages.push(toolMsg);
        continue;
      }

      // Validate arguments against tool schema
      const validation = validateToolArgs(fnName, args);
      if (!validation.valid) {
        console.log(`${C.yellow}  ⚠ ${fnName}: ${validation.error.split('\n')[0]}${C.reset}`);
        const toolMsg = {
          role: 'tool',
          content: validation.error,
          tool_call_id: callId,
        };
        conversationMessages.push(toolMsg);
        apiMessages.push(toolMsg);
        continue;
      }

      // Use corrected args if auto-correction happened
      const finalArgs = validation.corrected || args;

      console.log(formatToolCall(fnName, finalArgs));

      // Permission check
      const perm = checkPermission(fnName);
      if (perm === 'deny') {
        console.log(`${C.red}  ✗ ${fnName}: denied by permissions${C.reset}`);
        const toolMsg = { role: 'tool', content: `DENIED: Tool '${fnName}' is blocked by permissions`, tool_call_id: callId };
        conversationMessages.push(toolMsg);
        apiMessages.push(toolMsg);
        continue;
      }
      if (perm === 'ask') {
        const ok = await confirm(`  Allow ${fnName}?`, { toolName: fnName });
        if (!ok) {
          const toolMsg = { role: 'tool', content: `CANCELLED: User declined ${fnName}`, tool_call_id: callId };
          conversationMessages.push(toolMsg);
          apiMessages.push(toolMsg);
          continue;
        }
      }

      // Pre-tool hook
      runHooks('pre-tool', { tool_name: fnName });

      // Execute: Skill tools, MCP tools, or built-in tools
      let toolResult;
      const skillResult = await routeSkillCall(fnName, finalArgs);
      if (skillResult !== null) {
        toolResult = skillResult;
      } else {
        const mcpResult = await routeMCPCall(fnName, finalArgs);
        if (mcpResult !== null) {
          toolResult = mcpResult;
        } else {
          toolResult = await executeTool(fnName, finalArgs);
        }
      }

      const safeResult = String(toolResult ?? '');
      const truncated =
        safeResult.length > 50000
          ? safeResult.substring(0, 50000) + `\n...(truncated ${safeResult.length - 50000} chars)`
          : safeResult;

      console.log(formatResult(truncated));

      // Post-tool hook
      runHooks('post-tool', { tool_name: fnName });

      const toolMsg = { role: 'tool', content: truncated, tool_call_id: callId };
      conversationMessages.push(toolMsg);
      apiMessages.push(toolMsg);
    }
  }

  autoSave(conversationMessages);
  console.log(`\n${C.yellow}⚠ Max iterations (${MAX_ITERATIONS}) reached.${C.reset}`);
}

module.exports = { processInput, clearConversation, getConversationLength, getConversationMessages, setConversationMessages };

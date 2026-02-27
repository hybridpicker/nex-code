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
const { checkPermission } = require('./permissions');
const { confirm } = require('./safety');
const { isPlanMode, getPlanModePrompt } = require('./planner');
const { renderMarkdown } = require('./render');
const { runHooks } = require('./hooks');
const { routeMCPCall, getMCPToolDefinitions } = require('./mcp');
const { getSkillInstructions, getSkillToolDefinitions, routeSkillCall } = require('./skills');
const { trackUsage } = require('./costs');

const MAX_ITERATIONS = 30;
const CWD = process.cwd();

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

  // Use fitted messages for the API call, but keep fullMessages reference for appending
  let apiMessages = fittedMessages;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const spinner = new Spinner('Connecting...');
    spinner.start();
    let firstToken = true;
    let streamedText = '';

    let result;
    try {
      const allTools = [...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()];
      result = await callStream(apiMessages, allTools, {
        onToken: (text) => {
          if (firstToken) {
            spinner.stop();
            firstToken = false;
          }
          streamedText += text;
        },
      });
    } catch (err) {
      spinner.stop();
      console.log(`${C.red}${err.message}${C.reset}`);

      if (err.message.includes('429')) {
        console.log(`${C.yellow}  Rate limit — waiting 10s...${C.reset}`);
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }
      break;
    }

    if (firstToken) {
      spinner.stop();
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

    // Render streamed text with markdown formatting
    if (streamedText) {
      console.log(renderMarkdown(streamedText));
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
        console.log(`${C.red}  ✗ ${fnName}: malformed arguments${C.reset}`);
        const toolMsg = { role: 'tool', content: 'ERROR: Malformed tool arguments', tool_call_id: callId };
        conversationMessages.push(toolMsg);
        apiMessages.push(toolMsg);
        continue;
      }

      console.log(formatToolCall(fnName, args));

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
        const ok = await confirm(`  Allow ${fnName}?`);
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
      const skillResult = await routeSkillCall(fnName, args);
      if (skillResult !== null) {
        toolResult = skillResult;
      } else {
        const mcpResult = await routeMCPCall(fnName, args);
        if (mcpResult !== null) {
          toolResult = mcpResult;
        } else {
          toolResult = await executeTool(fnName, args);
        }
      }

      const truncated =
        toolResult.length > 50000
          ? toolResult.substring(0, 50000) + `\n...(truncated ${toolResult.length - 50000} chars)`
          : toolResult;

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

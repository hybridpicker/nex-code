/**
 * cli/context-engine.js — Token Management + Context Compression
 *
 * Tracks token usage per model, auto-compresses conversation history
 * when approaching context window limits, and provides smart file truncation.
 */

const { getActiveModel } = require('./providers/registry');

// ─── Token Estimation ──────────────────────────────────────────

// Chars-per-token ratios vary by provider/model
const TOKEN_RATIOS = {
  anthropic: 3.5,
  openai: 4.0,
  gemini: 4.0,
  ollama: 4.0,
  local: 4.0,
};

/**
 * Get chars-per-token ratio for current provider.
 */
function getTokenRatio() {
  try {
    const model = getActiveModel();
    const provider = model?.provider || 'ollama';
    return TOKEN_RATIOS[provider] || 4.0;
  } catch {
    return 4.0;
  }
}

/**
 * Estimate token count for a string.
 * Uses provider-specific chars/token ratio for better accuracy.
 */
function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== 'string') text = JSON.stringify(text);
  return Math.ceil(text.length / getTokenRatio());
}

/**
 * Estimate token count for a single message (including role overhead).
 * Each message has ~4 tokens of overhead (role, formatting).
 */
function estimateMessageTokens(msg) {
  const MESSAGE_OVERHEAD = 4;
  let tokens = MESSAGE_OVERHEAD;

  if (msg.content) {
    tokens += estimateTokens(msg.content);
  }

  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      tokens += 4; // tool call overhead
      tokens += estimateTokens(tc.function?.name || '');
      const args = tc.function?.arguments;
      if (typeof args === 'string') {
        tokens += estimateTokens(args);
      } else if (args) {
        tokens += estimateTokens(JSON.stringify(args));
      }
    }
  }

  return tokens;
}

/**
 * Estimate total tokens for a message array.
 */
function estimateMessagesTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

/**
 * Estimate tokens for tool definitions.
 */
function estimateToolsTokens(tools) {
  if (!tools || tools.length === 0) return 0;
  return estimateTokens(JSON.stringify(tools));
}

// ─── Context Window ────────────────────────────────────────────

/**
 * Get the context window size for the active model.
 * Falls back to a conservative default if unknown.
 */
function getContextWindow() {
  const model = getActiveModel();
  return model?.contextWindow || 32768;
}

/**
 * Get current token usage breakdown.
 * @param {Array} messages - Current conversation messages
 * @param {Array} tools - Tool definitions
 * @returns {{ used: number, limit: number, percentage: number, breakdown: object }}
 */
function getUsage(messages, tools) {
  const messageTokens = estimateMessagesTokens(messages);
  const toolTokens = estimateToolsTokens(tools);
  const used = messageTokens + toolTokens;
  const limit = getContextWindow();
  const percentage = limit > 0 ? (used / limit) * 100 : 0;

  // Breakdown
  let systemTokens = 0;
  let conversationTokens = 0;
  let toolResultTokens = 0;

  for (const msg of messages) {
    const t = estimateMessageTokens(msg);
    if (msg.role === 'system') {
      systemTokens += t;
    } else if (msg.role === 'tool') {
      toolResultTokens += t;
    } else {
      conversationTokens += t;
    }
  }

  return {
    used,
    limit,
    percentage: Math.round(percentage * 10) / 10,
    breakdown: {
      system: systemTokens,
      conversation: conversationTokens,
      toolResults: toolResultTokens,
      toolDefinitions: toolTokens,
    },
    messageCount: messages.length,
  };
}

// ─── Auto-Compression ──────────────────────────────────────────

const COMPRESSION_THRESHOLD = 0.7; // Compress when >70% full
const KEEP_RECENT = 10; // Always keep last N messages intact
const TRUNCATE_TOOL_RESULT = 200; // Truncate old tool results to N chars
const TRUNCATE_ASSISTANT = 500; // Truncate old assistant content to N chars

/**
 * Compress a single message to reduce token usage.
 * @param {object} msg
 * @param {string} level - 'light' or 'aggressive'
 * @returns {object} compressed message
 */
function compressMessage(msg, level = 'light') {
  const maxContent = level === 'aggressive' ? 100 : TRUNCATE_ASSISTANT;
  const maxTool = level === 'aggressive' ? 50 : TRUNCATE_TOOL_RESULT;

  if (msg.role === 'tool') {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    if (content.length > maxTool) {
      return {
        ...msg,
        content: content.substring(0, maxTool) + `\n...(truncated, was ${content.length} chars)`,
      };
    }
    return msg;
  }

  if (msg.role === 'assistant') {
    const compressed = { ...msg };

    // Truncate long content
    if (compressed.content && compressed.content.length > maxContent) {
      compressed.content =
        compressed.content.substring(0, maxContent) + `\n...(truncated)`;
    }

    // Simplify tool_calls in old messages
    if (compressed.tool_calls && level === 'aggressive') {
      compressed.tool_calls = compressed.tool_calls.map((tc) => ({
        ...tc,
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? tc.function.arguments.substring(0, 50)
            : tc.function.arguments,
        },
      }));
    }

    return compressed;
  }

  // User and system messages: keep as-is (they're important context)
  return msg;
}

/**
 * Fit messages into the context window.
 * Compresses older messages if the conversation exceeds the threshold.
 *
 * Strategy:
 * 1. Always keep system prompt (first message) intact
 * 2. Always keep the most recent KEEP_RECENT messages intact
 * 3. Compress middle messages (light first, then aggressive)
 * 4. If still too large, remove oldest compressed messages
 *
 * @param {Array} messages - Full message array
 * @param {Array} tools - Tool definitions
 * @param {object} [options] - { threshold, keepRecent }
 * @returns {{ messages: Array, compressed: boolean, tokensRemoved: number }}
 */
function fitToContext(messages, tools, options = {}) {
  const threshold = options.threshold ?? COMPRESSION_THRESHOLD;
  const keepRecent = options.keepRecent ?? KEEP_RECENT;

  const limit = getContextWindow();
  const toolTokens = estimateToolsTokens(tools);
  const targetMax = Math.floor(limit * threshold);
  const available = targetMax - toolTokens;

  const currentTokens = estimateMessagesTokens(messages);
  const totalUsed = currentTokens + toolTokens;

  // Under threshold → no compression needed
  if (totalUsed <= targetMax) {
    return { messages, compressed: false, tokensRemoved: 0 };
  }

  const originalTokens = currentTokens;

  // Split: system + old messages + recent messages
  let system = null;
  let startIdx = 0;
  if (messages.length > 0 && messages[0].role === 'system') {
    system = messages[0];
    startIdx = 1;
  }

  const recentStart = Math.max(startIdx, messages.length - keepRecent);
  const oldMessages = messages.slice(startIdx, recentStart);
  const recentMessages = messages.slice(recentStart);

  // Phase 1: Light compression of old messages
  let compressed = oldMessages.map((msg) => compressMessage(msg, 'light'));
  let result = buildResult(system, compressed, recentMessages);
  let tokens = estimateMessagesTokens(result);

  if (tokens + toolTokens <= targetMax) {
    return {
      messages: result,
      compressed: true,
      tokensRemoved: originalTokens - tokens,
    };
  }

  // Phase 2: Aggressive compression
  compressed = oldMessages.map((msg) => compressMessage(msg, 'aggressive'));
  result = buildResult(system, compressed, recentMessages);
  tokens = estimateMessagesTokens(result);

  if (tokens + toolTokens <= targetMax) {
    return {
      messages: result,
      compressed: true,
      tokensRemoved: originalTokens - tokens,
    };
  }

  // Phase 3: Remove oldest messages until we fit
  while (compressed.length > 0 && tokens + toolTokens > available) {
    const removed = compressed.shift();
    tokens -= estimateMessageTokens(removed);
  }

  result = buildResult(system, compressed, recentMessages);
  tokens = estimateMessagesTokens(result);

  return {
    messages: result,
    compressed: true,
    tokensRemoved: originalTokens - tokens,
  };
}

function buildResult(system, oldMessages, recentMessages) {
  const result = [];
  if (system) result.push(system);
  result.push(...oldMessages, ...recentMessages);
  return result;
}

// ─── Smart File Truncation ─────────────────────────────────────

/**
 * Truncate file content to fit within a token budget.
 * Keeps the beginning and end of the file (most useful parts).
 *
 * @param {string} content - File content
 * @param {number} maxTokens - Maximum tokens to use
 * @returns {string} truncated content
 */
function truncateFileContent(content, maxTokens) {
  if (!content) return '';

  const currentTokens = estimateTokens(content);
  if (currentTokens <= maxTokens) return content;

  const maxChars = maxTokens * 4; // Reverse the estimation
  const lines = content.split('\n');

  // Keep first 60% and last 40%
  const headChars = Math.floor(maxChars * 0.6);
  const tailChars = Math.floor(maxChars * 0.4);

  let headContent = '';
  let headLines = 0;
  for (const line of lines) {
    if (headContent.length + line.length + 1 > headChars) break;
    headContent += (headContent ? '\n' : '') + line;
    headLines++;
  }

  let tailContent = '';
  let tailLines = 0;
  for (let i = lines.length - 1; i >= headLines; i--) {
    const candidate = lines[i] + (tailContent ? '\n' : '') + tailContent;
    if (candidate.length > tailChars) break;
    tailContent = candidate;
    tailLines++;
  }

  const skipped = lines.length - headLines - tailLines;
  const separator = `\n\n... (${skipped} lines omitted, ${lines.length} total) ...\n\n`;

  return headContent + separator + tailContent;
}

// ─── Exports ───────────────────────────────────────────────────

module.exports = {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateToolsTokens,
  getContextWindow,
  getUsage,
  compressMessage,
  fitToContext,
  truncateFileContent,
  COMPRESSION_THRESHOLD,
  KEEP_RECENT,
};

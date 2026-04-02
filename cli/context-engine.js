/**
 * cli/context-engine.js — Token Management + Context Compression
 *
 * Tracks token usage per model, auto-compresses conversation history
 * when approaching context window limits, and provides smart file truncation.
 */

const path = require("path");

function getActiveModel() {
  return require("./providers/registry").getActiveModel();
}

// ─── Token Estimation ──────────────────────────────────────────

// Chars-per-token ratios vary by provider/model
const TOKEN_RATIOS = {
  anthropic: 3.5,
  openai: 4.0,
  gemini: 4.0,
  ollama: 4.0,
  local: 4.0,
};

// Per-model-family token ratios (more accurate than provider-level)
// These override the provider ratio when the active model matches a prefix
const MODEL_TOKEN_RATIOS = {
  devstral: 3.8,
  mistral: 3.8,
  ministral: 3.8,
  codestral: 3.8,
  qwen: 3.5,
  deepseek: 3.6,
  kimi: 3.7,
  gemma: 4.0,
  llama: 3.8,
  cogito: 3.6,
  phi: 4.0,
};

// Token cache for strings (WeakMap prevents memory leaks)
const tokenCache = new WeakMap();
const stringTokenCache = new Map();
const MAX_STRING_CACHE_SIZE = 1000;

// Message serialization cache (for API calls)
// WeakMap keyed by object identity: collision-free and GC-safe.
const messageSerializationCache = new WeakMap();

// Cached token ratio — invalidated on model change via invalidateTokenRatioCache()
let _cachedTokenRatio = null;

/**
 * Get chars-per-token ratio for current provider.
 * Result is cached until model changes.
 */
function getTokenRatio() {
  if (_cachedTokenRatio !== null) return _cachedTokenRatio;
  try {
    const model = getActiveModel();
    const provider = model?.provider || "ollama";
    // Check model-family ratio first (more accurate than provider-level)
    const modelId = (model?.id || "").toLowerCase();
    for (const [prefix, ratio] of Object.entries(MODEL_TOKEN_RATIOS)) {
      if (modelId.startsWith(prefix)) {
        _cachedTokenRatio = ratio;
        return _cachedTokenRatio;
      }
    }
    _cachedTokenRatio = TOKEN_RATIOS[provider] || 4.0;
    return _cachedTokenRatio;
  } catch {
    return 4.0;
  }
}

/**
 * Invalidate cached token ratio (call when active model/provider changes).
 */
function invalidateTokenRatioCache() {
  _cachedTokenRatio = null;
}

/**
 * Estimate token count for a string.
 * Uses provider-specific chars/token ratio for better accuracy.
 * Implements caching to avoid redundant calculations.
 */
function estimateTokens(text) {
  if (!text) return 0;
  if (typeof text !== "string") text = JSON.stringify(text);

  // Check cache — key includes length + 3 spread samples for collision resistance.
  // Previous key (len + first60 + last20) collided on strings with same bookends.
  const cacheKey =
    text.length <= 120
      ? text
      : `${text.length}:${text.substring(0, 60)}:${text.substring(text.length >> 1, (text.length >> 1) + 30)}:${text.substring(text.length - 30)}`;
  const cached = stringTokenCache.get(cacheKey);
  if (cached !== undefined) {
    // LRU: move to end of insertion order
    stringTokenCache.delete(cacheKey);
    stringTokenCache.set(cacheKey, cached);
    return cached;
  }

  const tokens = Math.ceil(text.length / getTokenRatio());

  // Cache result — trim to half when full to prevent silent cache misses
  if (stringTokenCache.size >= MAX_STRING_CACHE_SIZE) {
    const trimCount = MAX_STRING_CACHE_SIZE >> 1;
    const keys = stringTokenCache.keys();
    for (let i = 0; i < trimCount; i++)
      stringTokenCache.delete(keys.next().value);
  }
  stringTokenCache.set(cacheKey, tokens);

  return tokens;
}

/**
 * Serialize a message for API calls (with caching).
 * Uses WeakMap keyed by object identity — collision-free and GC-safe.
 * The old two-cache scheme (WeakMap + string Map with a length-based key) had
 * hash collisions: any two messages with the same role, same content.length,
 * and same tool_calls.length got the same cache key and received each other's
 * serialized output, corrupting API payloads.
 *
 * @param {object} msg - Message object
 * @returns {string} Serialized message
 */
function serializeMessage(msg) {
  if (messageSerializationCache.has(msg))
    return messageSerializationCache.get(msg);
  const serialized = JSON.stringify(msg);
  messageSerializationCache.set(msg, serialized);
  return serialized;
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
      tokens += estimateTokens(tc.function?.name || "");
      const args = tc.function?.arguments;
      if (typeof args === "string") {
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
 * Estimate token delta between old and new message arrays.
 * Only calculates tokens for new/changed messages (optimization).
 */
function estimateDeltaTokens(oldMessages, newMessages) {
  // If arrays are same length, check if content changed
  if (oldMessages && oldMessages.length === newMessages.length) {
    let hasChanges = false;
    for (let i = 0; i < newMessages.length; i++) {
      if (oldMessages[i] !== newMessages[i]) {
        hasChanges = true;
        break;
      }
    }
    if (!hasChanges) return 0; // No changes, no delta
  }

  // Calculate tokens for new messages only
  const oldCount = oldMessages ? oldMessages.length : 0;
  const newCount = newMessages.length;
  let delta = 0;

  // Only count new messages (from oldCount to newCount)
  for (let i = oldCount; i < newCount; i++) {
    delta += estimateMessageTokens(newMessages[i]);
  }

  return delta;
}

/**
 * Estimate tokens for tool definitions.
 * Cached by array reference (WeakMap) — tool definitions don't change mid-session,
 * but this function is called 11+ times per loop iteration via getUsage()/forceCompress().
 */
const _toolTokensCache = new WeakMap();

function estimateToolsTokens(tools) {
  if (!tools || tools.length === 0) return 0;
  if (_toolTokensCache.has(tools)) return _toolTokensCache.get(tools);
  const tokens = estimateTokens(JSON.stringify(tools));
  _toolTokensCache.set(tools, tokens);
  return tokens;
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
 * Cached by message count + last message identity to avoid redundant recalculation
 * when called multiple times per loop iteration.
 * @param {Array} messages - Current conversation messages
 * @param {Array} tools - Tool definitions
 * @returns {{ used: number, limit: number, percentage: number, breakdown: object }}
 */
let _usageCache = {
  msgCount: -1, lastMsgRef: null, toolCount: -1, result: null,
  // Incremental tracking: avoid O(n) full recalculation when messages are only appended
  messagesRef: null,       // reference to the messages array itself
  messageTokens: 0,        // running total of message tokens
  systemTokens: 0,
  conversationTokens: 0,
  toolResultTokens: 0,
};

function getUsage(messages, tools) {
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const toolCount = tools ? tools.length : 0;

  // Fast path: exact same state as last call
  if (
    _usageCache.result &&
    messages.length === _usageCache.msgCount &&
    lastMsg === _usageCache.lastMsgRef &&
    toolCount === _usageCache.toolCount
  ) {
    return _usageCache.result;
  }

  let messageTokens, systemTokens, conversationTokens, toolResultTokens;

  // Incremental path: same array reference with only new messages appended
  if (
    _usageCache.messagesRef === messages &&
    messages.length > _usageCache.msgCount &&
    _usageCache.msgCount >= 0
  ) {
    // Start from cached totals and only compute the new messages
    messageTokens = _usageCache.messageTokens;
    systemTokens = _usageCache.systemTokens;
    conversationTokens = _usageCache.conversationTokens;
    toolResultTokens = _usageCache.toolResultTokens;

    for (let i = _usageCache.msgCount; i < messages.length; i++) {
      const t = estimateMessageTokens(messages[i]);
      messageTokens += t;
      if (messages[i].role === "system") {
        systemTokens += t;
      } else if (messages[i].role === "tool") {
        toolResultTokens += t;
      } else {
        conversationTokens += t;
      }
    }
  } else {
    // Full recalculation (array changed, messages removed/replaced, or first call)
    messageTokens = 0;
    systemTokens = 0;
    conversationTokens = 0;
    toolResultTokens = 0;

    for (const msg of messages) {
      const t = estimateMessageTokens(msg);
      messageTokens += t;
      if (msg.role === "system") {
        systemTokens += t;
      } else if (msg.role === "tool") {
        toolResultTokens += t;
      } else {
        conversationTokens += t;
      }
    }
  }

  const toolTokens = estimateToolsTokens(tools);
  const used = messageTokens + toolTokens;
  const limit = getContextWindow();
  const percentage = limit > 0 ? (used / limit) * 100 : 0;

  const result = {
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

  _usageCache = {
    msgCount: messages.length, lastMsgRef: lastMsg, toolCount, result,
    messagesRef: messages,
    messageTokens, systemTokens, conversationTokens, toolResultTokens,
  };
  return result;
}

// ─── Auto-Compression ──────────────────────────────────────────

const COMPRESSION_THRESHOLD =
  parseFloat(process.env.NEX_COMPRESSION_THRESHOLD) || 0.75;
const SAFETY_MARGIN = parseFloat(process.env.NEX_SAFETY_MARGIN) || 0.1;
const KEEP_RECENT = parseInt(process.env.NEX_KEEP_RECENT, 10) || 10;

// Per-tier compression thresholds: smaller models need earlier compression
// because they are more sensitive to noise in context.
// Full-tier raised to 0.75 — the 0.68 cap was triggering fitToContext too
// frequently, adding overhead that hurt task completion speed.
const TIER_COMPRESSION_THRESHOLDS = {
  essential: 0.60,
  standard: 0.65,
  full: Math.min(COMPRESSION_THRESHOLD, 0.75),
};

/**
 * Get the effective compression threshold for the active model tier.
 * Smaller models compress earlier to reduce noise sensitivity.
 * ENV override (NEX_COMPRESSION_THRESHOLD) takes priority.
 * @returns {number}
 */
function getEffectiveCompressionThreshold() {
  // Explicit ENV override always wins
  if (process.env.NEX_COMPRESSION_THRESHOLD) return COMPRESSION_THRESHOLD;
  try {
    const { getActiveTier } = require("./tool-tiers");
    const tier = getActiveTier();
    return TIER_COMPRESSION_THRESHOLDS[tier] ?? COMPRESSION_THRESHOLD;
  } catch {
    return COMPRESSION_THRESHOLD;
  }
}
const TRUNCATE_TOOL_RESULT = 200; // Truncate old tool results to N chars
const TRUNCATE_ASSISTANT = 1000; // Truncate old assistant content to N chars (was 500 — too aggressive, lost reasoning)

/**
 * Smart compression for tool result content.
 * Preserves error messages, test summaries, and error traces at end of output.
 *
 * @param {string} content - Tool result text
 * @param {number} maxChars - Character budget
 * @returns {string} compressed content
 */
function compressToolResult(content, maxChars) {
  if (!content || content.length <= maxChars) return content;

  // Error/status messages get 3x budget — highest value for LLM recovery
  const isError = /^(ERROR|EXIT|BLOCKED|CANCELLED)/i.test(content);
  const budget = isError ? maxChars * 3 : maxChars;
  if (content.length <= budget) return content;

  const lines = content.split("\n");

  // Short outputs (≤10 lines): character-based 60/40 head/tail split
  if (lines.length <= 10) {
    const headChars = Math.floor(budget * 0.6);
    const tailChars = Math.floor(budget * 0.4);
    const head = content.substring(0, headChars);
    const tail = content.substring(content.length - tailChars);
    return head + `\n...(${content.length} chars total)...\n` + tail;
  }

  // Long outputs (>10 lines): line-based 40/40 head/tail split
  // Try to preserve complete logical units (code blocks, function definitions, etc.)
  const headCount = Math.floor(lines.length * 0.4);
  const tailCount = Math.floor(lines.length * 0.4);

  // Build head and tail within budget, trying to keep complete logical units
  let headLines = [];
  let headLen = 0;
  const headBudget = Math.floor(budget * 0.4);
  for (let i = 0; i < headCount && headLen < headBudget; i++) {
    // If we're about to exceed budget and this line starts a code block, include it
    if (
      headLen + lines[i].length + 1 > headBudget &&
      lines[i].trim().startsWith("```")
    ) {
      // Force include code block start and try to include as much as possible
      headLines.push(lines[i]);
      headLen += lines[i].length + 1;
      // Try to include the next few lines of the code block
      let j = i + 1;
      while (
        j < lines.length &&
        headLen < headBudget * 1.5 &&
        !lines[j].trim().startsWith("```")
      ) {
        headLines.push(lines[j]);
        headLen += lines[j].length + 1;
        j++;
      }
      if (j < lines.length && lines[j].trim().startsWith("```")) {
        headLines.push(lines[j]);
        headLen += lines[j].length + 1;
      }
      i = j;
    } else {
      headLines.push(lines[i]);
      headLen += lines[i].length + 1;
    }
  }

  let tailLines = [];
  let tailLen = 0;
  const tailBudget = Math.floor(budget * 0.4);
  for (
    let i = lines.length - 1;
    i >= lines.length - tailCount && tailLen < tailBudget;
    i--
  ) {
    // If we're about to exceed budget and this line ends a code block, include it
    if (
      tailLen + lines[i].length + 1 > tailBudget &&
      lines[i].trim().startsWith("```")
    ) {
      // Force include code block end and try to include as much as possible
      tailLines.push(lines[i]); // push is O(1); unshift was O(k) per call → O(n²) total
      tailLen += lines[i].length + 1;
      // Try to include the previous few lines of the code block
      let j = i - 1;
      while (
        j >= 0 &&
        tailLen < tailBudget * 1.5 &&
        !lines[j].trim().startsWith("```")
      ) {
        tailLines.push(lines[j]);
        tailLen += lines[j].length + 1;
        j--;
      }
      if (j >= 0 && lines[j].trim().startsWith("```")) {
        tailLines.push(lines[j]);
        tailLen += lines[j].length + 1;
      }
      i = j;
    } else {
      tailLines.push(lines[i]); // push is O(1); unshift was O(k) per call → O(n²) total
      tailLen += lines[i].length + 1;
    }
  }
  tailLines.reverse(); // single O(k) pass to restore order

  const omitted = lines.length - headLines.length - tailLines.length;
  return (
    headLines.join("\n") +
    `\n...(${omitted} lines omitted, ${lines.length} total)...\n` +
    tailLines.join("\n")
  );
}

/**
 * Compress a single message to reduce token usage.
 * @param {object} msg
 * @param {string} level - 'light', 'medium', or 'aggressive'
 * @returns {object} compressed message
 */
function compressMessage(msg, level = "light") {
  const maxContent =
    level === "aggressive"
      ? 100
      : level === "medium"
        ? 200
        : TRUNCATE_ASSISTANT;
  const maxTool =
    level === "aggressive"
      ? 50
      : level === "medium"
        ? 100
        : TRUNCATE_TOOL_RESULT;

  if (msg.role === "tool") {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    if (content.length > maxTool) {
      return {
        ...msg,
        content: compressToolResult(content, maxTool),
      };
    }
    return msg;
  }

  if (msg.role === "assistant") {
    const compressed = { ...msg };

    // Truncate long content
    if (compressed.content && compressed.content.length > maxContent) {
      compressed.content =
        compressed.content.substring(0, maxContent) + `\n...(truncated)`;
    }

    // Simplify tool_calls in old messages
    if (compressed.tool_calls && level === "aggressive") {
      compressed.tool_calls = compressed.tool_calls.map((tc) => ({
        ...tc,
        function: {
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === "string"
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
 * Score a message's relevance to the current working context.
 * Higher score = more relevant = keep longer.
 *
 * Scoring factors:
 * - Message type: user messages > tool results with errors > tool results > assistant reasoning
 * - Recency: newer messages score higher (but this is secondary to type)
 * - File overlap: messages mentioning files in the active working set score higher
 *
 * @param {object} msg - Message object
 * @param {number} index - Position in the message array (0 = oldest)
 * @param {number} totalMessages - Total number of messages
 * @param {Set<string>} activeFiles - Set of recently mentioned file paths
 * @returns {number} Relevance score (0-100)
 */
function scoreMessageRelevance(msg, index, totalMessages, activeFiles) {
  let score = 0;

  // Type scoring (0-40)
  if (msg.role === "system") return 100; // never drop system
  if (msg.role === "user") score += 35;
  else if (msg.role === "tool") {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content || "");
    if (/^(ERROR|BLOCKED|CANCELLED)/i.test(content))
      score += 30; // errors are valuable
    else score += 15;
  } else if (msg.role === "assistant") {
    score += msg.tool_calls ? 20 : 10; // tool-calling responses > plain text
  }

  // Recency scoring (0-30)
  const recencyRatio = totalMessages > 1 ? index / (totalMessages - 1) : 1;
  score += Math.round(recencyRatio * 30);

  // File overlap scoring (0-30)
  if (activeFiles && activeFiles.size > 0) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content || "");
    let fileHits = 0;
    for (const f of activeFiles) {
      if (content.includes(f) || content.includes(path.basename(f))) fileHits++;
    }
    score += Math.min(30, fileHits * 10);
  }

  return Math.min(100, score);
}

/**
 * Extract file paths mentioned in recent messages to determine the active working set.
 * @param {Array} messages - All messages
 * @param {number} recentCount - How many recent messages to scan
 * @returns {Set<string>} File paths mentioned
 */
function extractActiveFiles(messages, recentCount = 10) {
  const files = new Set();
  const recent = messages.slice(-recentCount);
  const filePattern = /(?:\/[\w.-]+)+\.\w+/g;
  for (const msg of recent) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content || "");
    const matches = content.match(filePattern);
    if (matches) matches.forEach((m) => files.add(m));
  }
  return files;
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
/**
 * Build a structured progress snapshot to pin before compression.
 * The snapshot captures which files were modified, the current phase, and
 * recent assistant summaries so the model doesn't lose its place after
 * context is compressed away.
 *
 * Returns a message object with _pinned:true, or null if nothing worth pinning.
 * @param {Array} messages
 * @param {{ filesModified?: Set<string>, currentPhase?: string }} opts
 * @returns {object|null}
 */
function buildProgressSnapshot(messages, { filesModified = new Set(), currentPhase = null } = {}) {
  const parts = [];

  if (filesModified.size > 0) {
    const files = [...filesModified]
      .map((f) => f.split("/").slice(-2).join("/"))
      .join(", ");
    parts.push(`Files already modified: ${files} — do NOT rewrite these, use edit_file for additions only.`);
  }

  if (currentPhase) {
    parts.push(`Current phase: ${currentPhase}`);
  }

  // Last 3 assistant texts with actual content (skip pure tool-call turns)
  const assistantTexts = messages
    .filter(
      (m) =>
        m.role === "assistant" &&
        typeof m.content === "string" &&
        m.content.trim().length > 30,
    )
    .slice(-3)
    .map((m) => m.content.trim().slice(0, 200).replace(/\n+/g, " "));

  if (assistantTexts.length > 0) {
    parts.push("Recent progress:\n" + assistantTexts.map((t) => `- ${t}`).join("\n"));
  }

  if (parts.length === 0) return null;

  return {
    role: "system",
    content: `## Progress State (preserved through compression)\n${parts.join("\n")}`,
    _pinned: true,
    _progressSnapshot: true,
  };
}

// Skip-cache: if message count + last message identity haven't changed,
// the previous fitToContext result is still valid.
let _fitToContextCache = { msgCount: -1, lastMsgRef: null, result: null };

function invalidateFitToContextCache() {
  _fitToContextCache = { msgCount: -1, lastMsgRef: null, result: null };
  _usageCache = {
    msgCount: -1, lastMsgRef: null, toolCount: -1, result: null,
    messagesRef: null, messageTokens: 0, systemTokens: 0, conversationTokens: 0, toolResultTokens: 0,
  };
}

async function fitToContext(messages, tools, options = {}) {
  // Fast path: skip full recalculation when messages haven't changed
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  if (
    !options.force &&
    _fitToContextCache.result &&
    messages.length === _fitToContextCache.msgCount &&
    lastMsg === _fitToContextCache.lastMsgRef
  ) {
    return _fitToContextCache.result;
  }

  const threshold = options.threshold ?? getEffectiveCompressionThreshold();
  const safetyMargin = options.safetyMargin ?? SAFETY_MARGIN;
  const keepRecent = options.keepRecent ?? KEEP_RECENT;

  const limit = getContextWindow();
  const toolTokens = estimateToolsTokens(tools);
  const targetMax = Math.floor(limit * (threshold - safetyMargin));
  const available = targetMax - toolTokens;

  const currentTokens = estimateMessagesTokens(messages);
  const totalUsed = currentTokens + toolTokens;

  // Under threshold → no compression needed
  if (totalUsed <= targetMax) {
    const r = { messages, compressed: false, compacted: false, tokensRemoved: 0 };
    _fitToContextCache = { msgCount: messages.length, lastMsgRef: lastMsg, result: r };
    return r;
  }

  const originalTokens = currentTokens;

  // Split: system + old messages + recent messages
  let system = null;
  let startIdx = 0;
  if (messages.length > 0 && messages[0].role === "system") {
    system = messages[0];
    startIdx = 1;
  }

  const recentStart = Math.max(startIdx, messages.length - keepRecent);
  let oldMessages = messages.slice(startIdx, recentStart);
  const recentMessages = messages.slice(recentStart);

  // ── Cheap compression first (Phases 1-3) ────────────────────────────
  // Try string-based compression before the expensive LLM compactor.
  // This avoids the 100-500ms LLM round-trip when simple truncation suffices.

  // Phase 1: Light compression
  let compressed = oldMessages.map((msg) => compressMessage(msg, "light"));
  let result = buildResult(system, compressed, recentMessages);
  let tokens = estimateMessagesTokens(result);

  if (tokens + toolTokens <= targetMax) {
    return {
      messages: result,
      compressed: true,
      compacted: false,
      tokensRemoved: originalTokens - tokens,
    };
  }

  // Phase 2: Medium compression
  compressed = oldMessages.map((msg) => compressMessage(msg, "medium"));
  result = buildResult(system, compressed, recentMessages);
  tokens = estimateMessagesTokens(result);

  if (tokens + toolTokens <= targetMax) {
    return {
      messages: result,
      compressed: true,
      compacted: false,
      tokensRemoved: originalTokens - tokens,
    };
  }

  // Phase 3: Aggressive compression
  compressed = oldMessages.map((msg) => compressMessage(msg, "aggressive"));
  result = buildResult(system, compressed, recentMessages);
  tokens = estimateMessagesTokens(result);

  if (tokens + toolTokens <= targetMax) {
    return {
      messages: result,
      compressed: true,
      compacted: false,
      tokensRemoved: originalTokens - tokens,
    };
  }

  // ── Phase 4: LLM Compacting (only when cheap compression wasn't enough) ──
  // The LLM compactor fires an API call (100-500ms) to semantically summarize
  // old messages. Only use it when Phases 1-3 couldn't fit the context.
  // Pinned messages (progress snapshots) are excluded and re-added after.
  const skipCompactor = process.env.NEX_SKIP_COMPACTOR === "1";
  const pinnedMessages = oldMessages.filter((m) => m._pinned);
  const nonCompacted = oldMessages.filter((m) => !m._compacted && !m._pinned);
  if (!skipCompactor && nonCompacted.length >= 6) {
    try {
      const { compactMessages } = require("./compactor");
      const compactResult = await compactMessages(nonCompacted);
      if (compactResult) {
        const kept = oldMessages.filter((m) => m._compacted && !m._pinned);
        const compressedOld = [...pinnedMessages, ...kept, compactResult.message];
        const r = buildResult(system, compressedOld, recentMessages);
        const t = estimateMessagesTokens(r);
        if (t + toolTokens <= targetMax) {
          return {
            messages: r,
            compressed: true,
            compacted: true,
            tokensRemoved: originalTokens - t,
          };
        }
        // Compacted but still too large → continue to Phase 5 with compacted messages
        oldMessages = compressedOld;
      }
    } catch (err) {
      if (process.env.NEX_DEBUG)
        console.error("[context-engine] LLM compacting failed:", err.message);
    }
  }

  // Phase 5: Remove lowest-relevance messages until we fit.
  // Pinned messages (progress snapshots) are never removed.
  const activeFiles = extractActiveFiles([...compressed, ...recentMessages]);
  const scored = compressed.map((msg, i) => ({
    msg,
    score: msg._pinned ? Infinity : scoreMessageRelevance(msg, i, compressed.length, activeFiles),
    tokens: estimateMessageTokens(msg),
  }));

  while (scored.length > 0 && tokens > available) {
    // Find lowest-scoring non-pinned message
    let minIdx = -1;
    for (let i = 0; i < scored.length; i++) {
      if (scored[i].score === Infinity) continue; // skip pinned
      if (minIdx === -1 || scored[i].score < scored[minIdx].score) minIdx = i;
    }
    if (minIdx === -1) break; // only pinned messages left — can't compress further
    tokens -= scored[minIdx].tokens;
    scored.splice(minIdx, 1);
  }

  compressed = scored.map((s) => s.msg);

  result = buildResult(system, compressed, recentMessages);
  // Re-verify: recentMessages and system are not tracked by the running `tokens` subtraction above.
  tokens = estimateMessagesTokens(result);

  return {
    messages: result,
    compressed: true,
    compacted: false,
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
  if (!content) return "";

  const currentTokens = estimateTokens(content);
  if (currentTokens <= maxTokens) return content;

  const maxChars = maxTokens * 4; // Reverse the estimation
  const lines = content.split("\n");

  // Keep first 60% and last 40%
  const headChars = Math.floor(maxChars * 0.6);
  const tailChars = Math.floor(maxChars * 0.4);

  let headContent = "";
  let headLines = 0;
  for (const line of lines) {
    if (headContent.length + line.length + 1 > headChars) break;
    headContent += (headContent ? "\n" : "") + line;
    headLines++;
  }

  let tailContent = "";
  let tailLines = 0;
  for (let i = lines.length - 1; i >= headLines; i--) {
    const candidate = lines[i] + (tailContent ? "\n" : "") + tailContent;
    if (candidate.length > tailChars) break;
    tailContent = candidate;
    tailLines++;
  }

  const skipped = lines.length - headLines - tailLines;
  const separator = `\n\n... (${skipped} lines omitted, ${lines.length} total) ...\n\n`;

  return headContent + separator + tailContent;
}

// ─── Force Compression (Context-Too-Long Recovery) ─────────────

const FORCE_COMPRESS_KEEP_RECENT = 6;

/**
 * Emergency compression when the API rejects with "context too long".
 * More aggressive than fitToContext: targets 50% of context window
 * and keeps only 6 recent messages.
 *
 * @param {Array} messages - Full message array (including system prompt)
 * @param {Array} tools - Tool definitions
 * @param {boolean} nuclear - If true, also compress/drop recent messages (last resort)
 * @returns {{ messages: Array, tokensRemoved: number }}
 */
function forceCompress(messages, tools, nuclear = false) {
  const limit = getContextWindow();
  const toolTokens = estimateToolsTokens(tools);
  let targetMax = Math.floor(limit * (nuclear ? 0.35 : 0.5)) - toolTokens;
  const originalTokens = estimateMessagesTokens(messages);

  // CRITICAL FIX: Ensure targetMax is strictly less than what we just failed with.
  // If the API context window is actually smaller than our 32k fallback,
  // targetMax might be too large and completely bypass the message drop loop.
  const strictMax = Math.floor(originalTokens * (nuclear ? 0.5 : 0.8));
  if (targetMax > strictMax) {
    targetMax = strictMax;
  }

  // Split: system + old + recent
  let system = null;
  let startIdx = 0;
  if (messages.length > 0 && messages[0].role === "system") {
    system = messages[0];
    startIdx = 1;
  }

  const keepRecent = nuclear ? 2 : FORCE_COMPRESS_KEEP_RECENT;
  const recentStart = Math.max(startIdx, messages.length - keepRecent);
  let oldMessages = messages.slice(startIdx, recentStart);
  let recentMessages = messages.slice(recentStart);

  // Aggressive compression on all old messages
  let compressed = oldMessages.map((msg) => compressMessage(msg, "aggressive"));

  // Nuclear: also compress recent messages
  if (nuclear) {
    recentMessages = recentMessages.map((msg) =>
      compressMessage(msg, "aggressive"),
    );
  }

  // Remove oldest messages until we fit
  let result = buildResult(system, compressed, recentMessages);
  let tokens = estimateMessagesTokens(result);

  while (compressed.length > 0 && tokens > targetMax) {
    const removed = compressed.shift();
    tokens -= estimateMessageTokens(removed);
  }

  // Nuclear: if still over budget, keep only the last user message
  if (nuclear && tokens > targetMax) {
    const lastUser = recentMessages.filter((m) => m.role === "user").slice(-1);
    recentMessages = lastUser;
    result = buildResult(system, [], recentMessages);
    tokens = estimateMessagesTokens(result);
  }

  result = buildResult(system, compressed, recentMessages);

  // Preserve task context across nuclear compression.
  // The "last user message" is often a system-injected warning (BLOCKED:, SYSTEM WARNING:)
  // rather than the original task. We preserve the FIRST user message (original task)
  // so the LLM can resume work, not just respond to a warning injection.
  const userMessages = messages.filter((m) => m.role === "user");
  // First real user message = original task (skip if it looks like a system injection)
  const isSystemInjection = (m) => {
    const text = typeof m.content === "string" ? m.content : "";
    return (
      text.startsWith("[SYSTEM WARNING]") ||
      text.startsWith("[SYSTEM:") ||
      text.startsWith("BLOCKED:")
    );
  };
  const firstTaskMsg = userMessages.find((m) => !isSystemInjection(m));
  const lastUserMsg = [...userMessages]
    .reverse()
    .find((m) => !isSystemInjection(m));
  // Always include the first task message so the LLM knows what it was doing.
  // Insert AFTER the system prompt (index 1), never before it — system must stay first.
  if (firstTaskMsg && !result.find((m) => m === firstTaskMsg)) {
    const sysIdx = result.findIndex((m) => m.role === "system");
    const insertAt = sysIdx >= 0 ? sysIdx + 1 : 0;
    result.splice(insertAt, 0, firstTaskMsg);
  }
  // Also include the last real user message if different from first
  if (
    lastUserMsg &&
    lastUserMsg !== firstTaskMsg &&
    !result.find((m) => m === lastUserMsg)
  ) {
    result.push(lastUserMsg);
  }

  return {
    messages: result,
    tokensRemoved: originalTokens - estimateMessagesTokens(result),
  };
}

// ─── Exports ───────────────────────────────────────────────────

module.exports = {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateDeltaTokens,
  estimateToolsTokens,
  serializeMessage,
  getContextWindow,
  getUsage,
  compressMessage,
  compressToolResult,
  scoreMessageRelevance,
  extractActiveFiles,
  buildProgressSnapshot,
  fitToContext,
  forceCompress,
  truncateFileContent,
  invalidateTokenRatioCache,
  invalidateFitToContextCache,
  getEffectiveCompressionThreshold,
  COMPRESSION_THRESHOLD,
  TIER_COMPRESSION_THRESHOLDS,
  SAFETY_MARGIN,
  KEEP_RECENT,
};

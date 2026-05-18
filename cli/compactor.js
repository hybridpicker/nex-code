/**
 * cli/compactor.js — LLM-Based Conversation Compacting
 *
 * Replaces old messages with a semantic summary via callChat(),
 * preserving context while freeing tokens. Silent fallback on any error.
 */

const { callChat } = require("./providers/registry");
const { estimateTokens } = require("./context-engine");

const COMPACTION_ENABLED = process.env.NEX_COMPACTION !== "false";
const COMPACTION_MIN_MESSAGES = 6;
const COMPACTION_SUMMARY_BUDGET = 2000;
const TASK_ANCHOR_MAX_CHARS = 4000;

// Circuit breaker: stop retrying after this many consecutive failures
// (e.g., context irrecoverably over the limit)
const MAX_CONSECUTIVE_FAILURES = 3;

const COMPACT_PROMPT = `Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions.
This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing development work without losing context.

Before providing your final summary, wrap your analysis in <analysis> tags to organize your thoughts and ensure you've covered all necessary points. In your analysis process:
1. Chronologically analyze each message. For each section thoroughly identify:
   - The user's explicit requests and intents
   - Your approach to addressing the user's requests
   - Key decisions, technical concepts and code patterns
   - Specific details like file names, code snippets, function signatures, file edits
   - Errors that you ran into and how you fixed them
   - Specific user feedback and direction changes
2. Double-check for technical accuracy and completeness.

Your summary MUST include these sections:

1. Primary Request and Intent: Capture all of the user's explicit requests and intents in detail
2. Key Technical Concepts: List all important technical concepts, technologies, and frameworks discussed
3. Files and Code Sections: Enumerate specific files examined, modified, or created — include full code snippets where applicable and why each is important
4. Errors and Fixes: List all errors encountered and how they were resolved; note any user feedback that changed your approach
5. Problem Solving: Document problems solved and any ongoing troubleshooting
6. All User Messages: List ALL user messages that are not tool results — critical for understanding feedback and changing intent
7. Pending Tasks: Outline any pending tasks explicitly requested
8. Current Work: Describe precisely what was being worked on immediately before this summary, including file names and code snippets
9. Optional Next Step: The next step directly in line with the user's most recent explicit request. Include direct quotes from the conversation showing exactly what task you were working on.

Format your output as:
<analysis>
[Your thought process]
</analysis>

<summary>
[Sections 1-9 above]
</summary>`;

function messageText(message) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function isSyntheticUserMessage(message) {
  const text = messageText(message).trim();
  return (
    text.startsWith("[SYSTEM WARNING]") ||
    text.startsWith("[SYSTEM:") ||
    text.startsWith("[SYSTEM]") ||
    text.startsWith("[RESUME AFTER COMPRESSION]") ||
    text.startsWith("[FRAMEWORK") ||
    text.startsWith("BLOCKED:")
  );
}

function truncateAnchorText(text, maxChars = TASK_ANCHOR_MAX_CHARS) {
  const value = String(text || "").trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n[... original task truncated after ${maxChars} chars ...]`;
}

function buildTaskAnchor(messages) {
  const realUsers = messages.filter(
    (m) => m?.role === "user" && !isSyntheticUserMessage(m),
  );
  if (realUsers.length === 0) return "";

  const original = truncateAnchorText(messageText(realUsers[0]));
  const latest = realUsers[realUsers.length - 1];
  const latestText =
    latest === realUsers[0]
      ? ""
      : truncateAnchorText(messageText(latest), 2000);

  const parts = [
    "## Current Task Anchor (must survive compression)",
    "The active task is still the original user request below. Do not invent or switch to a different task after compression.",
    "",
    "Original user request:",
    original,
  ];
  if (latestText) {
    parts.push("", "Most recent real user direction:", latestText);
  }
  return parts.join("\n");
}

// Circuit breaker state: consecutive compact failures this session
let _consecutiveFailures = 0;

/**
 * Compact old messages into a single summary message via LLM.
 * @param {Array} messages - Old (non-compacted) messages to summarize
 * @returns {Promise<{ message: object, tokensRemoved: number } | null>}
 */
async function compactMessages(messages) {
  if (!COMPACTION_ENABLED || messages.length < COMPACTION_MIN_MESSAGES)
    return null;

  // Circuit breaker: stop retrying when compaction keeps failing
  if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return null;

  const taskAnchor = buildTaskAnchor(messages);
  const summaryMessages = [
    { role: "system", content: COMPACT_PROMPT },
    {
      role: "user",
      content: [taskAnchor, formatMessagesForSummary(messages)]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  try {
    const result = await callChat(summaryMessages, [], {
      temperature: 0,
      maxTokens: COMPACTION_SUMMARY_BUDGET,
    });
    let summary = (result.content || "").trim();
    if (!summary) {
      _consecutiveFailures++;
      return null;
    }

    // Strip <analysis> scratchpad — only keep the <summary> content
    const summaryMatch = summary.match(/<summary>([\s\S]*?)<\/summary>/);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    } else {
      // Fallback: strip any <analysis> block if no <summary> tags
      summary = summary.replace(/<analysis>[\s\S]*?<\/analysis>/g, "").trim();
    }

    if (!summary) {
      _consecutiveFailures++;
      return null;
    }

    const originalTokens = messages.reduce(
      (sum, m) =>
        sum +
        estimateTokens(m.content || "") +
        (m.tool_calls ? estimateTokens(JSON.stringify(m.tool_calls)) : 0),
      0,
    );
    const summaryTokens = estimateTokens(summary);

    if (summaryTokens >= originalTokens * 0.8) {
      _consecutiveFailures++;
      return null;
    }

    // Success — reset circuit breaker
    _consecutiveFailures = 0;

    return {
      message: {
        role: "system",
        content: `[Conversation Summary — ${messages.length} messages compacted]\n${[taskAnchor, summary].filter(Boolean).join("\n\n")}`,
        _compacted: true,
        _originalCount: messages.length,
      },
      tokensRemoved: originalTokens - summaryTokens,
    };
  } catch {
    _consecutiveFailures++;
    return null;
  }
}

/** Reset the circuit breaker (call on /clear or new session). */
function resetCompactionFailures() {
  _consecutiveFailures = 0;
}

/**
 * Format messages for the summary prompt input.
 * Each message is truncated to 500 chars to control input budget.
 */
function formatMessagesForSummary(messages) {
  return messages
    .map((m, index) => {
      const role = m.role === "tool" ? "tool_result" : m.role;
      const rawContent = messageText(m);
      const maxChars =
        m.role === "user" ? (index === 0 ? TASK_ANCHOR_MAX_CHARS : 2000) : 500;
      const content = rawContent.substring(0, maxChars);
      if (m.tool_calls) {
        const tools = m.tool_calls.map((tc) => tc.function?.name).join(", ");
        return `[${role}] ${content}\n  tools: ${tools}`;
      }
      return `[${role}] ${content}`;
    })
    .join("\n\n");
}

module.exports = {
  compactMessages,
  formatMessagesForSummary,
  resetCompactionFailures,
  buildTaskAnchor,
  COMPACTION_ENABLED,
  COMPACTION_MIN_MESSAGES,
  COMPACTION_SUMMARY_BUDGET,
  MAX_CONSECUTIVE_FAILURES,
};

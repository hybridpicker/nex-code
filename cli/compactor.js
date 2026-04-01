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

  const summaryMessages = [
    { role: "system", content: COMPACT_PROMPT },
    { role: "user", content: formatMessagesForSummary(messages) },
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
        content: `[Conversation Summary — ${messages.length} messages compacted]\n${summary}`,
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
    .map((m) => {
      const role = m.role === "tool" ? "tool_result" : m.role;
      const content = (m.content || "").substring(0, 500);
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
  COMPACTION_ENABLED,
  COMPACTION_MIN_MESSAGES,
  COMPACTION_SUMMARY_BUDGET,
  MAX_CONSECUTIVE_FAILURES,
};

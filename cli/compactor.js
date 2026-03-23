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
const COMPACTION_SUMMARY_BUDGET = 500;

const COMPACT_PROMPT = `Summarize this conversation history concisely. Focus on:
- What files were read, created, or modified
- Key decisions made and their rationale
- Current state of the task (what's done, what's pending)
- Any errors encountered and how they were resolved
Be factual and brief. Use bullet points. Max 300 words.`;

/**
 * Compact old messages into a single summary message via LLM.
 * @param {Array} messages - Old (non-compacted) messages to summarize
 * @returns {Promise<{ message: object, tokensRemoved: number } | null>}
 */
async function compactMessages(messages) {
  if (!COMPACTION_ENABLED || messages.length < COMPACTION_MIN_MESSAGES)
    return null;

  const summaryMessages = [
    { role: "system", content: COMPACT_PROMPT },
    { role: "user", content: formatMessagesForSummary(messages) },
  ];

  try {
    const result = await callChat(summaryMessages, [], {
      temperature: 0,
      maxTokens: COMPACTION_SUMMARY_BUDGET,
    });
    const summary = (result.content || "").trim();
    if (!summary) return null;

    const originalTokens = messages.reduce(
      (sum, m) =>
        sum +
        estimateTokens(m.content || "") +
        (m.tool_calls ? estimateTokens(JSON.stringify(m.tool_calls)) : 0),
      0,
    );
    const summaryTokens = estimateTokens(summary);

    if (summaryTokens >= originalTokens * 0.8) return null;

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
    return null;
  }
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
  COMPACTION_ENABLED,
  COMPACTION_MIN_MESSAGES,
  COMPACTION_SUMMARY_BUDGET,
};

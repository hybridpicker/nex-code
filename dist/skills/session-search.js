/**
 * cli/skills/session-search.js — Cross-Session Search
 * Search past sessions by keyword to recall previous approaches.
 * Inspired by Hermes Agent's FTS session search.
 */

const fs = require("fs");
const path = require("path");

function getSessionsDir() {
  return path.join(process.cwd(), ".nex", "sessions");
}

/**
 * Search sessions for keyword matches.
 * Returns matching sessions with context snippets around each match.
 *
 * @param {string} query — Search query (case-insensitive substring match)
 * @param {{ maxResults?: number, maxSnippets?: number }} opts
 * @returns {Array<{ name, updatedAt, model, matchCount, snippets: string[] }>}
 */
function searchSessions(query, opts = {}) {
  const dir = getSessionsDir();
  if (!fs.existsSync(dir)) return [];

  const maxResults = opts.maxResults || 5;
  const maxSnippets = opts.maxSnippets || 3;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  const queryLower = query.toLowerCase();
  const results = [];

  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const session = JSON.parse(raw);
      if (!session.messages || !Array.isArray(session.messages)) continue;

      // Search through user and assistant messages
      const snippets = [];
      let matchCount = 0;

      for (const msg of session.messages) {
        if (!msg.content || typeof msg.content !== "string") continue;
        const contentLower = msg.content.toLowerCase();
        let searchFrom = 0;

        while (searchFrom < contentLower.length) {
          const idx = contentLower.indexOf(queryLower, searchFrom);
          if (idx === -1) break;
          matchCount++;

          if (snippets.length < maxSnippets) {
            // Extract context around match (80 chars before, 120 after)
            const start = Math.max(0, idx - 80);
            const end = Math.min(msg.content.length, idx + query.length + 120);
            const prefix = start > 0 ? "..." : "";
            const suffix = end < msg.content.length ? "..." : "";
            const snippet =
              `[${msg.role}] ${prefix}${msg.content.slice(start, end)}${suffix}`;
            snippets.push(snippet.replace(/\n/g, " ").trim());
          }

          searchFrom = idx + query.length;
        }
      }

      if (matchCount > 0) {
        results.push({
          name: session.name || f.replace(".json", ""),
          updatedAt: session.updatedAt || null,
          model: session.model || null,
          messageCount: session.messageCount || session.messages.length,
          matchCount,
          snippets,
        });
      }
    } catch {
      // skip corrupt files
    }
  }

  // Sort by match count (most relevant first), then by date
  results.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  });

  return results.slice(0, maxResults);
}

module.exports = {
  name: "session-search",
  description:
    "Search past sessions by keyword to recall previous approaches, " +
    "solutions, and conversations.",

  instructions: `You have a session search tool for cross-session recall.

## When to use

- When the user asks about past work ("what did we do last time?", "how did we fix X?")
- When you need to recall a previous approach before starting similar work
- When the user references something from an earlier session

## Tips

- Search for specific keywords, error messages, or file names
- Combine results from multiple searches to build context
- Session search only covers saved sessions in .nex/sessions/`,

  tools: [
    {
      type: "function",
      function: {
        name: "search_sessions",
        description:
          "Search past sessions by keyword. Returns matching sessions with context " +
          "snippets showing where the keyword appears. Use this to recall previous " +
          "approaches, solutions, or conversations.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Search keyword or phrase (case-insensitive). Use specific terms " +
                "like error messages, file names, or tool names for best results.",
            },
            max_results: {
              type: "number",
              description:
                "Maximum number of sessions to return (default: 5)",
            },
          },
          required: ["query"],
        },
      },
      execute: async (args) => {
        const { query, max_results } = args;

        if (!query || typeof query !== "string" || query.trim().length < 2) {
          return JSON.stringify({
            status: "error",
            error: "Query must be at least 2 characters",
          });
        }

        const results = searchSessions(query.trim(), {
          maxResults: max_results || 5,
        });

        if (results.length === 0) {
          return JSON.stringify({
            status: "ok",
            message: `No sessions found matching "${query}"`,
            results: [],
          });
        }

        return JSON.stringify({
          status: "ok",
          query,
          total_matches: results.reduce((s, r) => s + r.matchCount, 0),
          sessions: results.map((r) => ({
            name: r.name,
            updated: r.updatedAt,
            model: r.model,
            messages: r.messageCount,
            matches: r.matchCount,
            snippets: r.snippets,
          })),
        });
      },
    },
  ],

  // Export searchSessions for direct use and testing
  _searchSessions: searchSessions,
};

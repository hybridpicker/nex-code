/**
 * cli/providers/mock.js — Deterministic Mock Provider (E2E)
 *
 * Enabled via: NEX_MOCK_PROVIDER=1
 *
 * Purpose:
 * - Run true CLI E2E tests without network/API keys.
 * - Deterministically simulate streaming responses + tool calls.
 *
 * Interface:
 * - Implements BaseProvider.stream() and BaseProvider.chat() returning:
 *   { content: string, tool_calls: Array<{ id, function: { name, arguments } }> }
 */

const { BaseProvider } = require("./base");

function toolCall(name, args, id) {
  return {
    id: id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    function: {
      name,
      arguments: typeof args === "string" ? args : JSON.stringify(args || {}),
    },
  };
}

function hasToolResult(messages, id) {
  return (
    Array.isArray(messages) &&
    messages.some((m) => m?.role === "tool" && m?.tool_call_id === id)
  );
}

function lastUserText(messages) {
  const lastUser = Array.isArray(messages)
    ? [...messages].reverse().find((m) => m?.role === "user")
    : null;
  return lastUser ? messageText(lastUser) : "";
}

function messageText(msg) {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((b) => (b?.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return String(msg.content || "");
}

function allUserText(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .filter((m) => m?.role === "user")
    .map((m) => messageText(m))
    .filter(Boolean)
    .join("\n\n");
}

// Process-local state for deterministic multi-turn flows.
// Headless CLI runs are single-task/single-session per process.
let _mockSessionState = null;
function getMockSessionState() {
  if (_mockSessionState) return _mockSessionState;
  _mockSessionState = {
    scenario: null,
    lastStep: 0,
  };
  return _mockSessionState;
}

const SCENARIO_A_ASYNC_VERSION = `// Scenario A fixture: refactor callback-based flow to async/await.

function fakeApiGet(path, cb) {
  setTimeout(() => {
    if (path === "/users/42") return cb(null, { id: 42, name: "Ada" });
    if (path === "/users/42/posts") return cb(null, [{ id: 1, title: "Hello" }]);
    return cb(new Error("Not found: " + path));
  }, 10);
}

function fakeApiGetAsync(path) {
  return new Promise((resolve, reject) => {
    fakeApiGet(path, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function getUserAndPosts(userId) {
  const user = await fakeApiGetAsync(\`/users/\${userId}\`);
  const posts = await fakeApiGetAsync(\`/users/\${userId}/posts\`);
  return { user, posts };
}

(async () => {
  try {
    const result = await getUserAndPosts(42);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error("ERROR", err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
})();
`;

const SCENARIO_B_FIXED_DISCOUNT = `// Applies a percentage discount to a price in cents.

function applyPercentDiscount(totalCents, percent) {
  // percent is a whole number (e.g. 10 for 10%).
  const fraction = Number(percent) / 100;
  const discount = Math.round(totalCents * fraction);
  return totalCents - discount;
}

module.exports = { applyPercentDiscount };
`;

function scenarioCFixedNginxConfig() {
  return [
    "# Scenario C fixture: nginx config with a deliberate syntax error.",
    "",
    "worker_processes  1;",
    "",
    "events {",
    "  worker_connections  1024;",
    "}",
    "",
    "http {",
    "  server {",
    "    listen 8080;",
    "",
    "    location / {",
    "      proxy_pass http://127.0.0.1:3000;",
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
}

function scenarioCRestartScript() {
  return [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "# Dry-run nginx restart helper for the sandbox mock environment.",
    "# This prepends the sandbox's fake binaries to PATH, validates the config,",
    "# then performs a fake systemctl restart.",
    "",
    'ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'export PATH="$ROOT/bin:$PATH"',
    "",
    "# Safety check: refuse to run unless we are using the sandboxed binaries.",
    'sysctl_path="$(command -v systemctl || true)"',
    'nginx_path="$(command -v nginx || true)"',
    'if [[ "$sysctl_path" != "$ROOT/bin/systemctl" ]]; then',
    '  echo "Refusing to run: systemctl is not sandboxed ($sysctl_path)" >&2',
    "  exit 2",
    "fi",
    'if [[ "$nginx_path" != "$ROOT/bin/nginx" ]]; then',
    '  echo "Refusing to run: nginx is not sandboxed ($nginx_path)" >&2',
    "  exit 2",
    "fi",
    "",
    'CONF="$ROOT/sandbox-local/etc/nginx/nginx.conf"',
    "",
    'nginx -t -c "$CONF"',
    "",
    "# Fake systemctl prints a dry-run message and exits 0.",
    "systemctl restart nginx",
    "",
  ].join("\n");
}

function detectScenario(promptText) {
  const text = String(promptText || "");
  if (/malformed tool call/i.test(text)) return "malformed";
  if (/mocked server environment|nginx/i.test(text)) return "c";
  if (/discount|node\s+src\/main\.js/i.test(text)) return "b";
  if (/async\s*\/\s*await|Refactor\s+app\.js/i.test(text)) return "a";
  if (/tool budget|budget stop/i.test(text)) return "d";
  return null;
}

function buildDeterministicResponse(messages) {
  // Important: the agent may inject additional "user" messages mid-run
  // (system nudges, guardrails, budget prompts). Use the full user-message
  // history so scenario selection remains stable across iterations.
  const userHistory = allUserText(messages);
  const scenario = detectScenario(userHistory || lastUserText(messages));

  // fitToContext() may compact away tool result messages, which would break a
  // purely message-derived state machine. Keep a minimal in-memory step
  // counter per process so E2E runs remain deterministic under compaction.
  const state = getMockSessionState();
  if (!state.scenario && scenario) state.scenario = scenario;
  const stableScenario = state.scenario || scenario;

  // Malformed tool call path (for CLI error-handling tests)
  if (
    process.env.NEX_MOCK_MALFORMED_TOOL_CALL === "1" ||
    stableScenario === "malformed"
  ) {
    const stepFromMessages = hasToolResult(messages, "m1") ? 1 : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Simulating a malformed tool call to test CLI error handling.",
        // Broken JSON (parseToolArgs should fail).
        tool_calls: [toolCall("read_file", "}{", "m1")],
      };
    }
    // After the tool error result is appended, stop cleanly with a final message.
    return {
      content:
        "Final report: the CLI handled a malformed tool call without hanging. " +
        "The tool arguments were not valid JSON, so execution was blocked and the session concluded safely.",
      tool_calls: [],
    };
  }

  if (stableScenario === "a") {
    const stepFromMessages = hasToolResult(messages, "a3")
      ? 3
      : hasToolResult(messages, "a2")
        ? 2
        : hasToolResult(messages, "a1")
          ? 1
          : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Inspecting current implementation.",
        tool_calls: [toolCall("read_file", { path: "app.js" }, "a1")],
      };
    }
    if (state.lastStep < 2) {
      state.lastStep = 2;
      return {
        content: "Applying async/await refactor.",
        tool_calls: [
          toolCall(
            "write_file",
            { path: "app.js", content: SCENARIO_A_ASYNC_VERSION },
            "a2",
          ),
        ],
      };
    }
    if (state.lastStep < 3) {
      state.lastStep = 3;
      return {
        content: "Verifying behavior.",
        tool_calls: [toolCall("bash", { command: "node app.js" }, "a3")],
      };
    }
    return {
      content:
        "Refactored the callback-based flow to Promises + async/await and verified the script still runs successfully.",
      tool_calls: [],
    };
  }

  if (stableScenario === "b") {
    const stepFromMessages = hasToolResult(messages, "b4")
      ? 4
      : hasToolResult(messages, "b3")
        ? 3
        : hasToolResult(messages, "b2")
          ? 2
          : hasToolResult(messages, "b1")
            ? 1
            : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Reading the failing entry point.",
        tool_calls: [toolCall("read_file", { path: "src/main.js" }, "b1")],
      };
    }
    if (state.lastStep < 2) {
      state.lastStep = 2;
      return {
        content: "Locating the bug in discount calculation.",
        tool_calls: [toolCall("read_file", { path: "src/discount.js" }, "b2")],
      };
    }
    if (state.lastStep < 3) {
      state.lastStep = 3;
      return {
        content: "Fixing discount logic.",
        tool_calls: [
          toolCall(
            "write_file",
            { path: "src/discount.js", content: SCENARIO_B_FIXED_DISCOUNT },
            "b3",
          ),
        ],
      };
    }
    if (state.lastStep < 4) {
      state.lastStep = 4;
      return {
        content: "Verifying the fix.",
        tool_calls: [toolCall("bash", { command: "node src/main.js" }, "b4")],
      };
    }
    return {
      content:
        "Fixed the percent discount bug (10 now correctly means 10%) and verified the script runs without throwing.",
      tool_calls: [],
    };
  }

  if (stableScenario === "c") {
    const stepFromMessages = hasToolResult(messages, "c5")
      ? 5
      : hasToolResult(messages, "c4")
        ? 4
        : hasToolResult(messages, "c3") || hasToolResult(messages, "c2")
          ? 3
          : hasToolResult(messages, "c1")
            ? 1
            : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Inspecting nginx configuration.",
        tool_calls: [
          toolCall(
            "read_file",
            { path: "sandbox-local/etc/nginx/nginx.conf" },
            "c1",
          ),
        ],
      };
    }
    if (state.lastStep < 3) {
      state.lastStep = 3;
      return {
        content:
          "Fixing nginx config syntax error and adding dry-run restart helper.",
        tool_calls: [
          toolCall(
            "write_file",
            {
              path: "sandbox-local/etc/nginx/nginx.conf",
              content: scenarioCFixedNginxConfig(),
            },
            "c2",
          ),
          toolCall(
            "write_file",
            { path: "restart-nginx-dry-run.sh", content: scenarioCRestartScript() },
            "c3",
          ),
        ],
      };
    }
    if (state.lastStep < 4) {
      state.lastStep = 4;
      return {
        content: "Making the restart helper executable.",
        tool_calls: [
          toolCall(
            "bash",
            { command: "chmod +x restart-nginx-dry-run.sh" },
            "c4",
          ),
        ],
      };
    }
    if (state.lastStep < 5) {
      state.lastStep = 5;
      return {
        content: "Verifying dry-run restart in the sandbox.",
        tool_calls: [
          toolCall("bash", { command: "./restart-nginx-dry-run.sh" }, "c5"),
        ],
      };
    }
    return {
      content:
        "Fixed the nginx syntax error (missing semicolon) and added a sandbox-only dry-run restart script that validates the config then performs a fake systemctl restart.",
      tool_calls: [],
    };
  }

  if (stableScenario === "d") {
    const stepFromMessages = hasToolResult(messages, "d1") ? 1 : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Investigating.",
        tool_calls: [
          toolCall("list_directory", { path: ".", max_depth: 2 }, "d1"),
          toolCall("glob", { pattern: "**/*.js" }, "d2"),
          toolCall("grep", { pattern: "fakeApiGet", path: "." }, "d3"),
          toolCall("read_file", { path: "README.md" }, "d4"),
          toolCall("read_file", { path: "app.js" }, "d5"),
          toolCall(
            "search_files",
            { path: ".", pattern: "getUserAndPosts" },
            "d6",
          ),
        ],
      };
    }
    return {
      content:
        "Final summary: tool budget enforcement worked; no further tool calls were executed.",
      tool_calls: [],
    };
  }

  // Fallback: no scenario matched — return a benign final answer.
  return {
    content:
      "No mock scenario matched this prompt. Set a Scenario A–D prompt (or enable malformed mode) to run deterministic E2E flows.",
    tool_calls: [],
  };
}

class MockProvider extends BaseProvider {
  constructor(config = {}) {
    super({
      name: "mock",
      baseUrl: "mock://",
      models: {
        "mock-model": {
          id: "mock-model",
          name: "Mock Model",
          maxTokens: 4096,
          contextWindow: 8192,
        },
      },
      defaultModel: "mock-model",
      ...config,
    });
  }

  isConfigured() {
    return process.env.NEX_MOCK_PROVIDER === "1";
  }

  async chat(messages, _tools, _options = {}) {
    return buildDeterministicResponse(messages);
  }

  async stream(messages, _tools, options = {}) {
    const onToken = typeof options.onToken === "function" ? options.onToken : () => {};
    const res = buildDeterministicResponse(messages);

    // Simulate streaming: emit content in a couple chunks for realism.
    const content = String(res.content || "");
    const mid = Math.min(content.length, Math.max(1, Math.floor(content.length / 2)));
    if (content) {
      onToken(content.slice(0, mid));
      onToken(content.slice(mid));
    }
    return res;
  }

  normalizeResponse(raw) {
    return raw;
  }
}

module.exports = { MockProvider };

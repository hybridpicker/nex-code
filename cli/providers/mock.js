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

const SCENARIO_E_ASYNC_PROCESSOR = `// Scenario E fixture: nested callback flow with a simulated missing dependency.

function loadJson(file, cb) {
  setTimeout(() => {
    if (file === "missing.json") return cb(new Error("missing dependency: missing.json"));
    cb(null, { users: [{ id: 1, active: true }, { id: 2, active: false }] });
  }, 5);
}

function transform(payload, cb) {
  setTimeout(() => {
    cb(null, payload.users.filter((user) => user.active).map((user) => user.id));
  }, 5);
}

function save(ids, cb) {
  setTimeout(() => cb(null, ids.join(',')), 5);
}

function loadJsonAsync(file) {
  return new Promise((resolve, reject) => loadJson(file, (err, value) => err ? reject(err) : resolve(value)));
}

function transformAsync(payload) {
  return new Promise((resolve, reject) => transform(payload, (err, value) => err ? reject(err) : resolve(value)));
}

function saveAsync(ids) {
  return new Promise((resolve, reject) => save(ids, (err, value) => err ? reject(err) : resolve(value)));
}

async function run() {
  const payload = await loadJsonAsync("data.json");
  const ids = await transformAsync(payload);
  return saveAsync(ids);
}

run()
  .then((output) => console.log(output))
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
`;

function scenarioFFixedNginxConfig() {
  return [
    "# Scenario F fixture: subtle nginx typo in a sandboxed mock root.",
    "events { worker_connections 128; }",
    "http {",
    "  upstream app_backend {",
    "    server 127.0.0.1:3000;",
    "  }",
    "  server {",
    "    listen 8081;",
    "    location /api {",
    "      proxy_pass http://app_backend;",
    "    }",
    "  }",
    "}",
    "",
  ].join("\n");
}

function detectScenario(promptText) {
  const text = String(promptText || "");
  if (/malformed tool call/i.test(text)) return "malformed";
  if (/Scenario G|merge conflicts/i.test(text)) return "g";
  if (/Scenario F|dummy systemctl|sandboxed nginx config typo/i.test(text))
    return "f";
  if (/Scenario E|legacy callback processor|nested callback/i.test(text))
    return "e";
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
            {
              path: "restart-nginx-dry-run.sh",
              content: scenarioCRestartScript(),
            },
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

  if (stableScenario === "e") {
    const stepFromMessages = hasToolResult(messages, "e3")
      ? 3
      : hasToolResult(messages, "e2")
        ? 2
        : hasToolResult(messages, "e1")
          ? 1
          : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Reading the legacy callback processor.",
        tool_calls: [toolCall("read_file", { path: "processor.js" }, "e1")],
      };
    }
    if (state.lastStep < 2) {
      state.lastStep = 2;
      return {
        content:
          "Refactoring nested callbacks to async helpers without adding dependencies.",
        tool_calls: [
          toolCall(
            "write_file",
            { path: "processor.js", content: SCENARIO_E_ASYNC_PROCESSOR },
            "e2",
          ),
        ],
      };
    }
    if (state.lastStep < 3) {
      state.lastStep = 3;
      return {
        content: "Verifying the refactored processor.",
        tool_calls: [toolCall("bash", { command: "node processor.js" }, "e3")],
      };
    }
    return {
      content:
        "Refactored the nested callback processor to async/await without adding dependencies and verified the output.",
      tool_calls: [],
    };
  }

  if (stableScenario === "f") {
    const stepFromMessages = hasToolResult(messages, "f3")
      ? 3
      : hasToolResult(messages, "f2")
        ? 2
        : hasToolResult(messages, "f1")
          ? 1
          : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Reading the sandboxed nginx config.",
        tool_calls: [
          toolCall(
            "read_file",
            { path: "mock-root/etc/nginx/nginx.conf" },
            "f1",
          ),
        ],
      };
    }
    if (state.lastStep < 2) {
      state.lastStep = 2;
      return {
        content: "Fixing the upstream name typo.",
        tool_calls: [
          toolCall(
            "write_file",
            {
              path: "mock-root/etc/nginx/nginx.conf",
              content: scenarioFFixedNginxConfig(),
            },
            "f2",
          ),
        ],
      };
    }
    if (state.lastStep < 3) {
      state.lastStep = 3;
      return {
        content: "Checking the dummy service command stays sandboxed.",
        tool_calls: [
          toolCall(
            "bash",
            { command: 'PATH="$PWD/bin:$PATH" systemctl reload nginx' },
            "f3",
          ),
        ],
      };
    }
    return {
      content:
        "Fixed the sandboxed nginx upstream typo and verified only the dummy systemctl executable was invoked.",
      tool_calls: [],
    };
  }

  if (stableScenario === "g") {
    const stepFromMessages = hasToolResult(messages, "g5")
      ? 5
      : hasToolResult(messages, "g4")
        ? 4
        : hasToolResult(messages, "g3") || hasToolResult(messages, "g2")
          ? 3
          : hasToolResult(messages, "g1")
            ? 1
            : 0;
    state.lastStep = Math.max(state.lastStep, stepFromMessages);
    if (state.lastStep < 1) {
      state.lastStep = 1;
      return {
        content: "Inspecting simulated conflict markers.",
        tool_calls: [
          toolCall(
            "grep",
            { pattern: "<<<<<<<|=======|>>>>>>>", path: "." },
            "g1",
          ),
        ],
      };
    }
    if (state.lastStep < 3) {
      state.lastStep = 3;
      return {
        content: "Reading conflicted files.",
        tool_calls: [
          toolCall("read_file", { path: "service.js" }, "g2"),
          toolCall("read_file", { path: "README.md" }, "g3"),
        ],
      };
    }
    if (state.lastStep < 5) {
      state.lastStep = 5;
      return {
        content: "Resolving conflicts by preserving configurable behavior.",
        tool_calls: [
          toolCall(
            "write_file",
            {
              path: "service.js",
              content:
                "function port() { return Number(process.env.PORT || 3000); }\n\nmodule.exports = { port };\n",
            },
            "g4",
          ),
          toolCall(
            "write_file",
            {
              path: "README.md",
              content: "Run the service with PORT=3001 node service.js.\n",
            },
            "g5",
          ),
        ],
      };
    }
    return {
      content:
        "Resolved the simulated multi-file git conflict while preserving the configurable port behavior.",
      tool_calls: [],
    };
  }

  // Fallback: no scenario matched — return a benign final answer.
  return {
    content:
      "No mock scenario matched this prompt. Set a Scenario A–G prompt (or enable malformed mode) to run deterministic E2E flows.",
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
    const onToken =
      typeof options.onToken === "function" ? options.onToken : () => {};
    const res = buildDeterministicResponse(messages);

    // Simulate streaming: emit content in a couple chunks for realism.
    const content = String(res.content || "");
    const mid = Math.min(
      content.length,
      Math.max(1, Math.floor(content.length / 2)),
    );
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

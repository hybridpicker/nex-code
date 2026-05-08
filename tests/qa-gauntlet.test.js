const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("../cli/providers/registry", () => ({
  callStream: jest.fn(),
  getActiveModel: jest.fn().mockReturnValue({
    id: "test-model",
    name: "Test Model",
    provider: "local",
  }),
  getActiveProviderName: jest.fn().mockReturnValue("local"),
  getActiveModelId: jest.fn().mockReturnValue("test-model"),
  getConfiguredProviders: jest.fn().mockReturnValue([]),
  setActiveModel: jest.fn(),
  MODEL_EQUIVALENTS: { fast: {}, strong: {}, top: {} },
}));

const {
  callStream,
  getActiveProviderName,
} = require("../cli/providers/registry");
const { setAutoConfirm } = require("../cli/safety");
const {
  clearConversation,
  processInput,
  getConversationMessages,
} = require("../cli/agent");

const SANDBOX_BASE = path.join(os.homedir(), "Coding", "nex-code-sandbox");
const SANDBOX_ROOT = path.join(SANDBOX_BASE, "qa-gauntlet");

function resetQaGauntletSandbox() {
  // Safety: only ever deletes within the dedicated sandbox subtree.
  const baseResolved = path.resolve(SANDBOX_BASE);
  const rootResolved = path.resolve(SANDBOX_ROOT);
  if (
    rootResolved === baseResolved ||
    !rootResolved.startsWith(baseResolved + path.sep)
  ) {
    throw new Error("Refusing to reset a sandbox outside nex-code-sandbox.");
  }
  fs.rmSync(rootResolved, { recursive: true, force: true });
  fs.mkdirSync(rootResolved, { recursive: true });
}

function toolCall(name, args, id) {
  return {
    id: id || `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    function: {
      name,
      arguments: JSON.stringify(args || {}),
    },
  };
}

function mockStreamOnce({ content, tool_calls = [] }) {
  callStream.mockImplementationOnce(async (_m, _t, opts) => {
    if (opts?.onToken && content) opts.onToken(content);
    return { content, tool_calls };
  });
}

function readFile(p) {
  return fs.readFileSync(p, "utf-8");
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

const describeGauntlet =
  process.env.NEX_QA_GAUNTLET === "1" ? describe : describe.skip;

describeGauntlet("QA gauntlet (sandbox-only)", () => {
  jest.setTimeout(60_000);

  const originalCwd = process.cwd();

  function ensureScenarioAFixture() {
    const dir = path.join(SANDBOX_ROOT, "projects", "scenario-a");
    fs.mkdirSync(dir, { recursive: true });
    const appPath = path.join(dir, "app.js");
    const readmePath = path.join(dir, "README.md");
    if (!fs.existsSync(appPath)) {
      writeFile(
        appPath,
        [
          "// Scenario A fixture: refactor callback-based flow to async/await.",
          "",
          "function fakeApiGet(path, cb) {",
          "  setTimeout(() => {",
          '    if (path === "/users/42") return cb(null, { id: 42, name: "Ada" });',
          '    if (path === "/users/42/posts") return cb(null, [{ id: 1, title: "Hello" }]);',
          '    return cb(new Error("Not found: " + path));',
          "  }, 10);",
          "}",
          "",
          "function getUserAndPosts(userId, cb) {",
          "  fakeApiGet(`/users/${userId}`, (err, user) => {",
          "    if (err) return cb(err);",
          "    fakeApiGet(`/users/${userId}/posts`, (err2, posts) => {",
          "      if (err2) return cb(err2);",
          "      cb(null, { user, posts });",
          "    });",
          "  });",
          "}",
          "",
          "getUserAndPosts(42, (err, result) => {",
          "  if (err) {",
          '    console.error("ERROR", err.message);',
          "    process.exitCode = 1;",
          "    return;",
          "  }",
          "  console.log(JSON.stringify(result));",
          "});",
          "",
        ].join("\n"),
      );
    }
    if (!fs.existsSync(readmePath)) {
      writeFile(
        readmePath,
        [
          "Scenario A",
          "",
          "Goal: Refactor app.js to use Promises + async/await instead of callbacks.",
          "",
          "Constraints:",
          "- Keep behavior identical.",
          "- Keep fakeApiGet as a callback-based function (wrap it in a Promise).",
          "",
        ].join("\n"),
      );
    }
  }

  function ensureScenarioBFixture() {
    const dir = path.join(SANDBOX_ROOT, "projects", "scenario-b", "src");
    fs.mkdirSync(dir, { recursive: true });
    const money = path.join(dir, "money.js");
    const discount = path.join(dir, "discount.js");
    const main = path.join(dir, "main.js");
    const readme = path.join(
      SANDBOX_ROOT,
      "projects",
      "scenario-b",
      "README.md",
    );
    if (!fs.existsSync(money)) {
      writeFile(
        money,
        [
          "// Shared money helpers.",
          "",
          "function dollarsToCents(dollars) {",
          "  return Math.round(Number(dollars) * 100);",
          "}",
          "",
          "function centsToDollarsString(cents) {",
          "  return `$${(cents / 100).toFixed(2)}`;",
          "}",
          "",
          "module.exports = { dollarsToCents, centsToDollarsString };",
          "",
        ].join("\n"),
      );
    }
    if (!fs.existsSync(discount)) {
      writeFile(
        discount,
        [
          "// Applies a percentage discount to a price in cents.",
          "",
          "function applyPercentDiscount(totalCents, percent) {",
          "  // BUG: percent is expected to be a whole number (e.g. 10 for 10%),",
          "  // but this function treats it like a fraction (0.10) instead.",
          "  const discount = Math.round(totalCents * percent);",
          "  return totalCents - discount;",
          "}",
          "",
          "module.exports = { applyPercentDiscount };",
          "",
        ].join("\n"),
      );
    }
    if (!fs.existsSync(main)) {
      writeFile(
        main,
        [
          'const { dollarsToCents, centsToDollarsString } = require("./money");',
          'const { applyPercentDiscount } = require("./discount");',
          "",
          "function run() {",
          "  const original = dollarsToCents(100);",
          "  const after = applyPercentDiscount(original, 10);",
          "",
          '  console.log("Original:", centsToDollarsString(original));',
          '  console.log("After 10%:", centsToDollarsString(after));',
          "",
          "  // Expected: $90.00",
          "  if (after !== 9000) {",
          "    throw new Error(",
          "      `Bug: expected 9000 cents after 10% discount, got ${after} cents`",
          "    );",
          "  }",
          "}",
          "",
          "run();",
          "",
        ].join("\n"),
      );
    }
    if (!fs.existsSync(readme)) {
      writeFile(
        readme,
        [
          "Scenario B",
          "",
          "Goal: Find and fix the bug causing the runtime error when running:",
          "",
          "  node src/main.js",
          "",
          "Constraints:",
          "- Keep module boundaries (3 files) intact.",
          "- Fix the root cause, not the symptom.",
          "",
        ].join("\n"),
      );
    }
  }

  function ensureServerMockFixture() {
    const dir = path.join(SANDBOX_ROOT, "server-mock");
    const binDir = path.join(dir, "bin");
    const confDir = path.join(dir, "sandbox-local", "etc", "nginx");
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(confDir, { recursive: true });
    const nginxConf = path.join(confDir, "nginx.conf");
    const fakeSystemctl = path.join(binDir, "systemctl");
    const fakeNginx = path.join(binDir, "nginx");
    if (!fs.existsSync(nginxConf)) {
      writeFile(
        nginxConf,
        [
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
          "      proxy_pass http://127.0.0.1:3000",
          "    }",
          "  }",
          "}",
          "",
        ].join("\n"),
      );
    }
    if (!fs.existsSync(fakeSystemctl)) {
      writeFile(
        fakeSystemctl,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "",
          "# Fake systemctl wrapper for sandbox-only testing.",
          "# Never touches the real host service manager.",
          "",
          'echo "[fake-systemctl] $*" >&2',
          "",
          'cmd="${1:-}"',
          'unit="${2:-}"',
          "",
          'case "$cmd" in',
          "  status|is-active|is-enabled|list-units|show)",
          '    echo "${unit:-unknown}.service is active (fake)"',
          "    exit 0",
          "    ;;",
          "  restart|reload|start|stop)",
          '    echo "dry-run: would $cmd ${unit:-unknown}.service"',
          "    exit 0",
          "    ;;",
          "  *)",
          '    echo "fake-systemctl: unsupported command: $cmd" >&2',
          "    exit 2",
          "    ;;",
          "esac",
          "",
        ].join("\n"),
      );
      fs.chmodSync(fakeSystemctl, 0o755);
    }
    if (!fs.existsSync(fakeNginx)) {
      writeFile(
        fakeNginx,
        [
          "#!/usr/bin/env bash",
          "set -euo pipefail",
          "",
          "# Fake nginx wrapper.",
          "# Supports: nginx -t -c <config>",
          "",
          'conf=""',
          "while [[ $# -gt 0 ]]; do",
          '  case "$1" in',
          "    -c)",
          '      conf="${2:-}"',
          "      shift 2",
          "      ;;",
          "    -t)",
          "      shift",
          "      ;;",
          "    *)",
          "      shift",
          "      ;;",
          "  esac",
          "done",
          "",
          'if [[ -z "$conf" ]]; then',
          '  echo "nginx: [emerg] no configuration file provided (fake)" >&2',
          "  exit 1",
          "fi",
          "",
          'if [[ ! -f "$conf" ]]; then',
          '  echo "nginx: [emerg] open() \\"$conf\\" failed (2: No such file or directory)" >&2',
          "  exit 1",
          "fi",
          "",
          "# Deliberately simplistic syntax check: proxy_pass line must end with ';'",
          "if grep -nE '^\\s*proxy_pass\\s+[^;]+$' \"$conf\" >/dev/null; then",
          "  line=$(grep -nE '^\\s*proxy_pass\\s+[^;]+$' \"$conf\" | head -n 1 | cut -d: -f1)",
          '  echo "nginx: [emerg] invalid number of arguments in \\"proxy_pass\\" directive in $conf:$line (fake)" >&2',
          "  exit 1",
          "fi",
          "",
          'echo "nginx: configuration file $conf test is successful (fake)" >&2',
          "exit 0",
          "",
        ].join("\n"),
      );
      fs.chmodSync(fakeNginx, 0o755);
    }
  }

  function ensureScenarioEFixture() {
    const dir = path.join(SANDBOX_ROOT, "projects", "scenario-e");
    fs.mkdirSync(dir, { recursive: true });
    writeFile(
      path.join(dir, "processor.js"),
      [
        "// Scenario E fixture: nested callback flow with a simulated missing dependency.",
        "",
        "function loadJson(file, cb) {",
        "  setTimeout(() => {",
        '    if (file === "missing.json") return cb(new Error("missing dependency: missing.json"));',
        "    cb(null, { users: [{ id: 1, active: true }, { id: 2, active: false }] });",
        "  }, 5);",
        "}",
        "",
        "function transform(payload, cb) {",
        "  setTimeout(() => {",
        "    cb(null, payload.users.filter((user) => user.active).map((user) => user.id));",
        "  }, 5);",
        "}",
        "",
        "function save(ids, cb) {",
        "  setTimeout(() => cb(null, ids.join(',')), 5);",
        "}",
        "",
        "function run(cb) {",
        '  loadJson("data.json", (err, payload) => {',
        "    if (err) return cb(err);",
        "    transform(payload, (err2, ids) => {",
        "      if (err2) return cb(err2);",
        "      save(ids, (err3, output) => {",
        "        if (err3) return cb(err3);",
        "        cb(null, output);",
        "      });",
        "    });",
        "  });",
        "}",
        "",
        "run((err, output) => {",
        "  if (err) throw err;",
        "  console.log(output);",
        "});",
        "",
      ].join("\n"),
    );
    writeFile(
      path.join(dir, "README.md"),
      [
        "Scenario E",
        "",
        "Goal: Refactor processor.js to async/await without adding dependencies.",
        "The missing dependency is simulated; keep the successful behavior intact.",
        "",
      ].join("\n"),
    );
  }

  function ensureScenarioFFixture() {
    const dir = path.join(SANDBOX_ROOT, "server-scenario-f");
    const binDir = path.join(dir, "bin");
    const confDir = path.join(dir, "mock-root", "etc", "nginx");
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(confDir, { recursive: true });
    writeFile(
      path.join(confDir, "nginx.conf"),
      [
        "# Scenario F fixture: subtle nginx typo in a sandboxed mock root.",
        "events { worker_connections 128; }",
        "http {",
        "  upstream app_backend {",
        "    server 127.0.0.1:3000;",
        "  }",
        "  server {",
        "    listen 8081;",
        "    location /api {",
        "      proxy_pass http://app-backend;",
        "    }",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    const fakeSystemctl = path.join(binDir, "systemctl");
    writeFile(
      fakeSystemctl,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'echo "[scenario-f-systemctl] $*"',
        "exit 0",
        "",
      ].join("\n"),
    );
    fs.chmodSync(fakeSystemctl, 0o755);
  }

  function ensureScenarioGFixture() {
    const dir = path.join(SANDBOX_ROOT, "projects", "scenario-g");
    fs.mkdirSync(dir, { recursive: true });
    writeFile(
      path.join(dir, "service.js"),
      [
        "<<<<<<< HEAD",
        "function port() { return 3000; }",
        "=======",
        "function port() { return Number(process.env.PORT || 3000); }",
        ">>>>>>> feature/server-config",
        "",
        "module.exports = { port };",
        "",
      ].join("\n"),
    );
    writeFile(
      path.join(dir, "README.md"),
      [
        "<<<<<<< HEAD",
        "Run the service with node service.js.",
        "=======",
        "Run the service with PORT=3001 node service.js.",
        ">>>>>>> feature/server-config",
        "",
      ].join("\n"),
    );
    fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
    writeFile(
      path.join(dir, ".git", "MERGE_HEAD"),
      "0000000000000000000000000000000000000000\n",
    );
  }

  beforeAll(() => {
    setAutoConfirm(true);
    process.env.NEX_NO_DOTENV = "1";
    process.env.NEX_PHASE_ROUTING = "0";
    process.env.NEX_DISABLE_TOOL_BUDGET = "0";
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  beforeEach(() => {
    clearConversation();
    callStream.mockReset();
    // Default to local provider for tight tool budget.
    getActiveProviderName.mockReturnValue("local");
    delete process.env.NEX_MAX_TOOL_CALLS;

    resetQaGauntletSandbox();
    ensureScenarioAFixture();
    ensureScenarioBFixture();
    ensureServerMockFixture();
    ensureScenarioEFixture();
    ensureScenarioFFixture();
    ensureScenarioGFixture();
  });

  it("Scenario A: refactor callback flow to async/await", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-a");
    process.chdir(cwd);

    const asyncVersion = `// Scenario A fixture: refactor callback-based flow to async/await.\n\nfunction fakeApiGet(path, cb) {\n  setTimeout(() => {\n    if (path === \"/users/42\") return cb(null, { id: 42, name: \"Ada\" });\n    if (path === \"/users/42/posts\") return cb(null, [{ id: 1, title: \"Hello\" }]);\n    return cb(new Error(\"Not found: \" + path));\n  }, 10);\n}\n\nfunction fakeApiGetAsync(path) {\n  return new Promise((resolve, reject) => {\n    fakeApiGet(path, (err, result) => {\n      if (err) reject(err);\n      else resolve(result);\n    });\n  });\n}\n\nasync function getUserAndPosts(userId) {\n  const user = await fakeApiGetAsync(\`/users/\${userId}\`);\n  const posts = await fakeApiGetAsync(\`/users/\${userId}/posts\`);\n  return { user, posts };\n}\n\n(async () => {\n  try {\n    const result = await getUserAndPosts(42);\n    console.log(JSON.stringify(result));\n  } catch (err) {\n    console.error(\"ERROR\", err && err.message ? err.message : String(err));\n    process.exitCode = 1;\n  }\n})();\n`;

    mockStreamOnce({
      content: "Inspecting current implementation.",
      tool_calls: [toolCall("read_file", { path: "app.js" }, "a1")],
    });
    mockStreamOnce({
      content: "Applying async/await refactor.",
      tool_calls: [
        toolCall("write_file", { path: "app.js", content: asyncVersion }, "a2"),
      ],
    });
    mockStreamOnce({
      content: "Verifying behavior.",
      tool_calls: [
        toolCall("bash", { command: "node app.js && echo check" }, "a3"),
      ],
    });
    mockStreamOnce({
      content:
        "Refactored the callback-based flow to Promises + async/await and verified the script still runs successfully.",
      tool_calls: [],
    });

    await processInput(
      "Refactor app.js to use async/await instead of callbacks. Keep behavior identical.",
    );

    const updated = readFile(path.join(cwd, "app.js"));
    expect(updated).toContain("async function getUserAndPosts");
    expect(updated).toContain("await fakeApiGetAsync");
  });

  it("Scenario B: find and fix a bug spanning three files", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-b");
    process.chdir(cwd);

    const fixedDiscount = `// Applies a percentage discount to a price in cents.\n\nfunction applyPercentDiscount(totalCents, percent) {\n  // percent is a whole number (e.g. 10 for 10%).\n  const fraction = Number(percent) / 100;\n  const discount = Math.round(totalCents * fraction);\n  return totalCents - discount;\n}\n\nmodule.exports = { applyPercentDiscount };\n`;

    mockStreamOnce({
      content: "Reading the failing entry point.",
      tool_calls: [toolCall("read_file", { path: "src/main.js" }, "b1")],
    });
    mockStreamOnce({
      content: "Locating the bug in discount calculation.",
      tool_calls: [toolCall("read_file", { path: "src/discount.js" }, "b2")],
    });
    mockStreamOnce({
      content: "Fixing discount logic.",
      tool_calls: [
        toolCall(
          "write_file",
          { path: "src/discount.js", content: fixedDiscount },
          "b3",
        ),
      ],
    });
    mockStreamOnce({
      content: "Verifying the fix.",
      tool_calls: [
        toolCall("bash", { command: "node src/main.js && echo check" }, "b4"),
      ],
    });
    mockStreamOnce({
      content:
        "Fixed the percent discount bug (10 now correctly means 10%) and verified the script runs without throwing.",
      tool_calls: [],
    });

    await processInput(
      "Fix the bug in this repo. Running node src/main.js should not throw.",
    );

    const updated = readFile(path.join(cwd, "src/discount.js"));
    expect(updated).toContain("/ 100");
  });

  it("Scenario C: mock nginx config + dry-run restart script", async () => {
    const cwd = path.join(SANDBOX_ROOT, "server-mock");
    process.chdir(cwd);

    const nginxFixed = [
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

    const restartScript = [
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

    mockStreamOnce({
      content: "Inspecting nginx configuration.",
      tool_calls: [
        toolCall(
          "read_file",
          { path: "sandbox-local/etc/nginx/nginx.conf" },
          "c1",
        ),
      ],
    });
    mockStreamOnce({
      content:
        "Fixing nginx config syntax error and adding dry-run restart helper.",
      tool_calls: [
        toolCall(
          "write_file",
          { path: "sandbox-local/etc/nginx/nginx.conf", content: nginxFixed },
          "c2",
        ),
        toolCall(
          "write_file",
          { path: "restart-nginx-dry-run.sh", content: restartScript },
          "c3",
        ),
      ],
    });
    mockStreamOnce({
      content: "Making the restart helper executable.",
      tool_calls: [
        toolCall(
          "bash",
          { command: "chmod +x restart-nginx-dry-run.sh" },
          "c4",
        ),
      ],
    });
    mockStreamOnce({
      content: "Verifying dry-run restart in the sandbox.",
      tool_calls: [
        toolCall(
          "bash",
          { command: "./restart-nginx-dry-run.sh && echo check" },
          "c5",
        ),
      ],
    });
    mockStreamOnce({
      content:
        "Fixed the nginx syntax error (missing semicolon) and added a sandbox-only dry-run restart script that validates the config then performs a fake systemctl restart.",
      tool_calls: [],
    });

    await processInput(
      "In this mocked server environment only, find the nginx syntax error and create a dry-run restart script.",
    );

    const updatedConf = readFile(
      path.join(cwd, "sandbox-local/etc/nginx/nginx.conf"),
    );
    expect(updatedConf).toContain("proxy_pass http://127.0.0.1:3000;");
    expect(fs.existsSync(path.join(cwd, "restart-nginx-dry-run.sh"))).toBe(
      true,
    );
  });

  it("Scenario D: trigger tool-call budget stop and get a final summary", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-a");
    expect(fs.existsSync(cwd)).toBe(true);
    process.chdir(cwd);

    process.env.NEX_MAX_TOOL_CALLS = "5";
    getActiveProviderName.mockReturnValue("local");

    // Return 6 tool calls in one batch; agent should trim to remaining budget (5).
    mockStreamOnce({
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
    });

    mockStreamOnce({
      content:
        "Tool budget hit; summarizing based on gathered evidence without further tool calls.",
      tool_calls: [],
    });

    mockStreamOnce({
      content:
        "Final summary: budget enforcement worked; no further tool calls were executed.",
      tool_calls: [],
    });

    await processInput(
      "Use tools to inspect the project, but keep going even if you feel stuck.",
    );

    const messages = getConversationMessages();
    const toolBatchMsg = messages.find(
      (m) => m?.role === "assistant" && Array.isArray(m.tool_calls),
    );
    expect(toolBatchMsg).toBeTruthy();
    expect(toolBatchMsg.tool_calls).toHaveLength(5);
    expect(toolBatchMsg.tool_calls.map((tc) => tc.id)).toEqual([
      "d1",
      "d2",
      "d3",
      "d4",
      "d5",
    ]);

    const toolBatchIndex = messages.indexOf(toolBatchMsg);
    const laterAssistantToolCalls = messages
      .slice(toolBatchIndex + 1)
      .filter((m) => m?.role === "assistant" && Array.isArray(m.tool_calls));
    expect(laterAssistantToolCalls).toHaveLength(0);
  });

  it("Scenario E: refactor nested callbacks with missing-dependency context", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-e");
    process.chdir(cwd);

    const fixed = `// Scenario E fixture: nested callback flow with a simulated missing dependency.\n\nfunction loadJson(file, cb) {\n  setTimeout(() => {\n    if (file === "missing.json") return cb(new Error("missing dependency: missing.json"));\n    cb(null, { users: [{ id: 1, active: true }, { id: 2, active: false }] });\n  }, 5);\n}\n\nfunction transform(payload, cb) {\n  setTimeout(() => {\n    cb(null, payload.users.filter((user) => user.active).map((user) => user.id));\n  }, 5);\n}\n\nfunction save(ids, cb) {\n  setTimeout(() => cb(null, ids.join(',')), 5);\n}\n\nfunction loadJsonAsync(file) {\n  return new Promise((resolve, reject) => loadJson(file, (err, value) => err ? reject(err) : resolve(value)));\n}\n\nfunction transformAsync(payload) {\n  return new Promise((resolve, reject) => transform(payload, (err, value) => err ? reject(err) : resolve(value)));\n}\n\nfunction saveAsync(ids) {\n  return new Promise((resolve, reject) => save(ids, (err, value) => err ? reject(err) : resolve(value)));\n}\n\nasync function run() {\n  const payload = await loadJsonAsync("data.json");\n  const ids = await transformAsync(payload);\n  return saveAsync(ids);\n}\n\nrun()\n  .then((output) => console.log(output))\n  .catch((err) => {\n    console.error(err.message);\n    process.exitCode = 1;\n  });\n`;

    mockStreamOnce({
      content: "Reading the legacy callback processor.",
      tool_calls: [toolCall("read_file", { path: "processor.js" }, "e1")],
    });
    mockStreamOnce({
      content:
        "Refactoring nested callbacks to async helpers without adding dependencies.",
      tool_calls: [
        toolCall("write_file", { path: "processor.js", content: fixed }, "e2"),
      ],
    });
    mockStreamOnce({
      content: "Verifying the refactored processor.",
      tool_calls: [toolCall("bash", { command: "node processor.js" }, "e3")],
    });
    mockStreamOnce({
      content:
        "Refactored the nested callback processor to async/await without adding dependencies and verified the output.",
      tool_calls: [],
    });
    mockStreamOnce({
      content:
        "Final summary: Scenario E completed with three tool calls and no dependency installation.",
      tool_calls: [],
    });

    await processInput(
      "Scenario E: refactor the legacy callback processor to async/await without adding dependencies.",
    );

    expect(readFile(path.join(cwd, "processor.js"))).toContain(
      "async function run",
    );
  });

  it("Scenario F: fix sandboxed nginx typo without host commands", async () => {
    const cwd = path.join(SANDBOX_ROOT, "server-scenario-f");
    process.chdir(cwd);

    const fixedConf = [
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

    mockStreamOnce({
      content: "Reading the sandboxed nginx config.",
      tool_calls: [
        toolCall("read_file", { path: "mock-root/etc/nginx/nginx.conf" }, "f1"),
      ],
    });
    mockStreamOnce({
      content: "Fixing the upstream name typo.",
      tool_calls: [
        toolCall(
          "write_file",
          { path: "mock-root/etc/nginx/nginx.conf", content: fixedConf },
          "f2",
        ),
      ],
    });
    mockStreamOnce({
      content: "Checking the dummy service command stays sandboxed.",
      tool_calls: [
        toolCall(
          "bash",
          { command: 'PATH="$PWD/bin:$PATH" systemctl reload nginx' },
          "f3",
        ),
      ],
    });
    mockStreamOnce({
      content:
        "Fixed the sandboxed nginx upstream typo and verified only the dummy systemctl executable was invoked.",
      tool_calls: [],
    });
    mockStreamOnce({
      content:
        "Final summary: Scenario F stayed inside the sandbox and used only the dummy systemctl wrapper.",
      tool_calls: [],
    });

    await processInput(
      "Scenario F: fix the sandboxed nginx config typo and use only the dummy systemctl.",
    );

    expect(
      readFile(path.join(cwd, "mock-root/etc/nginx/nginx.conf")),
    ).toContain("app_backend");
  });

  it("Scenario G: resolve simulated multi-file git conflicts", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-g");
    process.chdir(cwd);

    mockStreamOnce({
      content: "Inspecting simulated conflict markers.",
      tool_calls: [
        toolCall(
          "grep",
          { pattern: "<<<<<<<|=======|>>>>>>>", path: "." },
          "g1",
        ),
      ],
    });
    mockStreamOnce({
      content: "Reading conflicted files.",
      tool_calls: [
        toolCall("read_file", { path: "service.js" }, "g2"),
        toolCall("read_file", { path: "README.md" }, "g3"),
      ],
    });
    mockStreamOnce({
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
    });
    mockStreamOnce({
      content:
        "Resolved the simulated multi-file git conflict while preserving the configurable port behavior.",
      tool_calls: [],
    });
    mockStreamOnce({
      content:
        "Final summary: Scenario G resolved all conflict markers across the simulated repository.",
      tool_calls: [],
    });

    await processInput(
      "Scenario G: resolve the simulated git merge conflicts in multiple files.",
    );

    expect(readFile(path.join(cwd, "service.js"))).not.toContain("<<<<<<<");
    expect(readFile(path.join(cwd, "README.md"))).not.toContain(">>>>>>>");
  });
});

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const SANDBOX_BASE = path.join(os.homedir(), "Coding", "nex-code-sandbox");
const SANDBOX_ROOT = path.join(SANDBOX_BASE, "cli-e2e");

function resetSandbox() {
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

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

function ensureScenarioAFixture() {
  const dir = path.join(SANDBOX_ROOT, "projects", "scenario-a");
  fs.mkdirSync(dir, { recursive: true });
  writeFile(
    path.join(dir, "app.js"),
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
  writeFile(
    path.join(dir, "README.md"),
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

function ensureScenarioBFixture() {
  const dir = path.join(SANDBOX_ROOT, "projects", "scenario-b", "src");
  fs.mkdirSync(dir, { recursive: true });
  writeFile(
    path.join(dir, "money.js"),
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
  writeFile(
    path.join(dir, "discount.js"),
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
  writeFile(
    path.join(dir, "main.js"),
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

function ensureServerMockFixture() {
  const dir = path.join(SANDBOX_ROOT, "server-mock");
  const binDir = path.join(dir, "bin");
  const confDir = path.join(dir, "sandbox-local", "etc", "nginx");
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(confDir, { recursive: true });

  writeFile(
    path.join(confDir, "nginx.conf"),
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

  const fakeSystemctl = path.join(binDir, "systemctl");
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

  const fakeNginx = path.join(binDir, "nginx");
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
      'if grep -nE \'^\\s*proxy_pass\\s+[^;]+$\' "$conf" >/dev/null; then',
      '  line=$(grep -nE \'^\\s*proxy_pass\\s+[^;]+$\' "$conf" | head -n 1 | cut -d: -f1)',
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

function runCli({ cwd, env, args, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (d) => stdoutChunks.push(d));
    child.stderr.on("data", (d) => stderrChunks.push(d));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      });
    });
  });
}

describe("CLI E2E (bin/nex-code.js) with deterministic mock provider", () => {
  jest.setTimeout(60_000);

  beforeEach(() => {
    resetSandbox();
    ensureScenarioAFixture();
    ensureScenarioBFixture();
    ensureServerMockFixture();
  });

  test("Scenario A: stdout clean + exit 0 + file updated", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-a");
    const env = {
      ...process.env,
      NEX_NO_DOTENV: "1",
      NEX_MOCK_PROVIDER: "1",
      HEADLESS_MODEL: "mock:mock-model",
      NEX_NO_FLATRATE: "1",
      OLLAMA_API_KEY: "",
      NEX_PHASE_ROUTING: "0",
    };

    const { code, stdout, stderr } = await runCli({
      cwd,
      env,
      args: [
        path.join(process.cwd(), "bin", "nex-code.js"),
        "--auto",
        "--task",
        "Refactor app.js to use async/await instead of callbacks. Keep behavior identical.",
      ],
    });

    expect(code).toBe(0);
    expect(stderr.trim()).toBe("");
    expect(stdout).toContain("Refactored the callback-based flow");

    const updated = fs.readFileSync(path.join(cwd, "app.js"), "utf-8");
    expect(updated).toContain("async function getUserAndPosts");
    expect(updated).toContain("await fakeApiGetAsync");
  });

  test("Scenario C: mocked server environment stays sandboxed", async () => {
    const cwd = path.join(SANDBOX_ROOT, "server-mock");
    const env = {
      ...process.env,
      NEX_NO_DOTENV: "1",
      NEX_MOCK_PROVIDER: "1",
      HEADLESS_MODEL: "mock:mock-model",
      NEX_NO_FLATRATE: "1",
      OLLAMA_API_KEY: "",
      NEX_PHASE_ROUTING: "0",
    };

    const { code, stdout } = await runCli({
      cwd,
      env,
      args: [
        path.join(process.cwd(), "bin", "nex-code.js"),
        "--auto",
        "--task",
        "In this mocked server environment only, find the nginx syntax error and create a dry-run restart script.",
      ],
    });

    expect(code).toBe(0);
    expect(stdout).toContain("Fixed the nginx syntax error");

    const updatedConf = fs.readFileSync(
      path.join(cwd, "sandbox-local/etc/nginx/nginx.conf"),
      "utf-8",
    );
    expect(updatedConf).toContain("proxy_pass http://127.0.0.1:3000;");
    const restartPath = path.join(cwd, "restart-nginx-dry-run.sh");
    expect(fs.existsSync(restartPath)).toBe(true);
    expect(fs.readFileSync(restartPath, "utf-8")).toContain(
      "Refusing to run: systemctl is not sandboxed",
    );
  });

  test("Scenario B: stdout clean + exit 0 + bug fixed", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-b");
    const env = {
      ...process.env,
      NEX_NO_DOTENV: "1",
      NEX_MOCK_PROVIDER: "1",
      HEADLESS_MODEL: "mock:mock-model",
      NEX_NO_FLATRATE: "1",
      OLLAMA_API_KEY: "",
      NEX_PHASE_ROUTING: "0",
    };

    const { code, stdout, stderr } = await runCli({
      cwd,
      env,
      args: [
        path.join(process.cwd(), "bin", "nex-code.js"),
        "--auto",
        "--task",
        "Fix the bug in this repo. Running node src/main.js should not throw.",
      ],
    });

    expect(code).toBe(0);
    expect(stderr.trim()).toBe("");
    expect(stdout).toContain("Fixed the percent discount bug");

    const updated = fs.readFileSync(path.join(cwd, "src/discount.js"), "utf-8");
    expect(updated).toContain("/ 100");
  });

  test("Scenario D: tool budget trims to 5 and exits 0", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-a");
    const env = {
      ...process.env,
      NEX_NO_DOTENV: "1",
      NEX_MOCK_PROVIDER: "1",
      HEADLESS_MODEL: "mock:mock-model",
      NEX_NO_FLATRATE: "1",
      OLLAMA_API_KEY: "",
      NEX_PHASE_ROUTING: "0",
      NEX_MAX_TOOL_CALLS: "5",
    };

    const { code, stdout, stderr } = await runCli({
      cwd,
      env,
      args: [
        path.join(process.cwd(), "bin", "nex-code.js"),
        "--auto",
        "--json",
        "--task",
        "Scenario D: trigger tool budget stop and get a final summary (tool budget).",
      ],
      timeoutMs: 10000,
    });

    expect(code).toBe(0);
    expect(stderr.trim()).toBe("");

    const lines = stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const events = lines.map((l) => JSON.parse(l));
    const done = [...events].reverse().find((e) => e.type === "done");
    expect(done).toBeTruthy();
    expect(done.success).toBe(true);
    expect(done.toolCalls).toBe(5);
    const tokenText = events
      .filter((e) => e.type === "token")
      .map((e) => e.text || "")
      .join("");
    expect(tokenText).toContain("tool budget enforcement worked");
  });

  test("Malformed tool call: CLI does not hang and exits cleanly", async () => {
    const cwd = path.join(SANDBOX_ROOT, "projects", "scenario-a");
    const env = {
      ...process.env,
      NEX_NO_DOTENV: "1",
      NEX_MOCK_PROVIDER: "1",
      NEX_MOCK_MALFORMED_TOOL_CALL: "1",
      HEADLESS_MODEL: "mock:mock-model",
      // Tight budget to keep the failure path bounded.
      NEX_MAX_TOOL_CALLS: "5",
      NEX_NO_FLATRATE: "1",
      OLLAMA_API_KEY: "",
      NEX_PHASE_ROUTING: "0",
    };

    const { code, stdout } = await runCli({
      cwd,
      env,
      args: [
        path.join(process.cwd(), "bin", "nex-code.js"),
        "--auto",
        "--task",
        "Trigger a malformed tool call for testing.",
      ],
      timeoutMs: 10000,
    });

    expect(code).toBe(0);
    expect(stdout).toContain("handled a malformed tool call without hanging");
  });
});

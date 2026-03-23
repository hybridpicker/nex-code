/**
 * tests/k8s-tools.test.js — Kubernetes tools
 * Tests k8s_pods, k8s_logs, k8s_exec, k8s_apply, k8s_rollout
 */

// ─── Mocks ────────────────────────────────────────────────────
jest.mock("../cli/safety", () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  isCritical: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));

jest.mock("../cli/file-history", () => ({ recordChange: jest.fn() }));
jest.mock("../cli/diff", () => ({
  showClaudeDiff: jest.fn(),
  showClaudeNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

// Mock child_process.exec at util.promisify level
const mockExec = jest.fn();
jest.mock("child_process", () => ({
  ...jest.requireActual("child_process"),
  exec: (cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    mockExec(cmd, opts, resolve);
  },
  spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
}));

const { executeTool } = require("../cli/tools");
const { confirm } = require("../cli/safety");

// ─── Helpers ──────────────────────────────────────────────────
function mockExecResolve(stdout, stderr = "") {
  mockExec.mockImplementationOnce((cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    resolve(null, { stdout, stderr });
  });
}

function mockExecReject(stderr, code = 1) {
  mockExec.mockImplementationOnce((cmd, opts, cb) => {
    const resolve = typeof opts === "function" ? opts : cb;
    const err = new Error(stderr);
    err.stderr = stderr;
    err.code = code;
    resolve(err, null);
  });
}

// ─── k8s_pods ────────────────────────────────────────────────
describe("k8s_pods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it("runs kubectl get pods -A when no namespace given", async () => {
    mockExecResolve(
      "NAMESPACE  NAME       READY  STATUS   RESTARTS  AGE\ndefault    nginx-abc  1/1    Running  0         1d\n",
    );
    const result = await executeTool("k8s_pods", {}, { autoConfirm: true });
    expect(mockExec).toHaveBeenCalledTimes(1);
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/kubectl get pods -A/);
    expect(result).toContain("Running");
  });

  it("uses -n flag when namespace is provided", async () => {
    mockExecResolve(
      "NAME    READY  STATUS   RESTARTS  AGE\nnginx   1/1    Running  0         2h\n",
    );
    await executeTool(
      "k8s_pods",
      { namespace: "production" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/-n production/);
    expect(cmd).not.toMatch(/-A/);
  });

  it("adds label selector when label is given", async () => {
    mockExecResolve("(no output)");
    await executeTool(
      "k8s_pods",
      { label: "app=nginx" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/-l app=nginx/);
  });

  it("prefixes with ssh when server is given", async () => {
    mockExecResolve("NAMESPACE  NAME  READY  STATUS\n");
    await executeTool(
      "k8s_pods",
      { server: "deploy@10.0.0.1" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/^ssh .* deploy@10\.0\.0\.1/);
    expect(cmd).toContain("kubectl");
  });

  it("includes context flag when context is given", async () => {
    mockExecResolve("(no output)");
    await executeTool(
      "k8s_pods",
      { context: "prod-cluster" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/--context prod-cluster/);
  });

  it("returns helpful error when kubectl not found", async () => {
    mockExecReject("kubectl: command not found");
    const result = await executeTool("k8s_pods", {}, { autoConfirm: true });
    expect(result).toMatch(/kubectl not found/);
  });

  it("sanitizes server to prevent injection", async () => {
    mockExecResolve("ok");
    await executeTool(
      "k8s_pods",
      { server: "user@host; rm -rf /" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    // spaces and semicolons are stripped — shell injection characters removed
    expect(cmd).not.toContain("; rm");
    expect(cmd).toMatch(/user@host/);
  });
});

// ─── k8s_logs ────────────────────────────────────────────────
describe("k8s_logs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it("requires pod parameter", async () => {
    const result = await executeTool("k8s_logs", {}, { autoConfirm: true });
    expect(result).toMatch(/pod is required/);
  });

  it("fetches logs with default namespace and tail", async () => {
    mockExecResolve("log line 1\nlog line 2\n");
    const result = await executeTool(
      "k8s_logs",
      { pod: "nginx-abc" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/kubectl logs nginx-abc -n default --tail=100/);
    expect(result).toContain("log line 1");
  });

  it("applies since flag", async () => {
    mockExecResolve("recent logs");
    await executeTool(
      "k8s_logs",
      { pod: "api-pod", since: "30m" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/--since=30m/);
  });

  it("applies container flag", async () => {
    mockExecResolve("container logs");
    await executeTool(
      "k8s_logs",
      { pod: "api-pod", container: "sidecar" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/-c sidecar/);
  });

  it("truncates very long output", async () => {
    const longOutput = "x".repeat(25000);
    mockExecResolve(longOutput);
    const result = await executeTool(
      "k8s_logs",
      { pod: "api-pod" },
      { autoConfirm: true },
    );
    expect(result).toContain("truncated");
    expect(result.length).toBeLessThan(25000);
  });

  it("returns error on failure", async () => {
    mockExecReject('pods "nginx-abc" not found');
    const result = await executeTool(
      "k8s_logs",
      { pod: "nginx-abc" },
      { autoConfirm: true },
    );
    expect(result).toMatch(/ERROR/);
    expect(result).toContain("not found");
  });
});

// ─── k8s_exec ────────────────────────────────────────────────
describe("k8s_exec", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it("requires pod and command", async () => {
    expect(await executeTool("k8s_exec", {}, { autoConfirm: true })).toMatch(
      /pod is required/,
    );
    expect(
      await executeTool("k8s_exec", { pod: "nginx" }, { autoConfirm: true }),
    ).toMatch(/command is required/);
  });

  it("asks for confirmation", async () => {
    mockExecResolve("output");
    await executeTool(
      "k8s_exec",
      { pod: "nginx", command: "ls /app" },
      { autoConfirm: true },
    );
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("cancels when user declines", async () => {
    confirm.mockResolvedValueOnce(false);
    const result = await executeTool(
      "k8s_exec",
      { pod: "nginx", command: "rm -rf /" },
      { autoConfirm: true },
    );
    expect(result).toMatch(/CANCELLED/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("runs kubectl exec with -- sh -c", async () => {
    mockExecResolve("/app\n/etc\n");
    const result = await executeTool(
      "k8s_exec",
      { pod: "api-pod", command: "ls /", namespace: "prod" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/kubectl exec api-pod -n prod/);
    expect(cmd).toMatch(/-- sh -c/);
    expect(result).toContain("/app");
  });
});

// ─── k8s_apply ───────────────────────────────────────────────
describe("k8s_apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it("requires file parameter", async () => {
    const result = await executeTool("k8s_apply", {}, { autoConfirm: true });
    expect(result).toMatch(/file is required/);
  });

  it("asks for confirmation before applying", async () => {
    mockExecResolve("deployment.apps/nginx configured");
    await executeTool(
      "k8s_apply",
      { file: "deploy.yaml" },
      { autoConfirm: true },
    );
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("cancels when user declines", async () => {
    confirm.mockResolvedValueOnce(false);
    const result = await executeTool(
      "k8s_apply",
      { file: "deploy.yaml" },
      { autoConfirm: true },
    );
    expect(result).toMatch(/CANCELLED/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("uses --dry-run=client when dry_run=true (no confirmation)", async () => {
    mockExecResolve("deployment.apps/nginx configured (dry run)");
    await executeTool(
      "k8s_apply",
      { file: "deploy.yaml", dry_run: true },
      { autoConfirm: true },
    );
    expect(confirm).not.toHaveBeenCalled();
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/--dry-run=client/);
  });

  it("applies with namespace flag when namespace given", async () => {
    mockExecResolve("applied");
    await executeTool(
      "k8s_apply",
      { file: "svc.yaml", namespace: "staging" },
      { autoConfirm: true },
    );
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/-n staging/);
  });
});

// ─── k8s_rollout ─────────────────────────────────────────────
describe("k8s_rollout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    confirm.mockResolvedValue(true);
  });

  it("requires action and deployment", async () => {
    expect(await executeTool("k8s_rollout", {}, { autoConfirm: true })).toMatch(
      /action is required/,
    );
    expect(
      await executeTool(
        "k8s_rollout",
        { action: "status" },
        { autoConfirm: true },
      ),
    ).toMatch(/deployment is required/);
  });

  it("runs rollout status without confirmation", async () => {
    mockExecResolve('deployment "nginx" successfully rolled out');
    await executeTool(
      "k8s_rollout",
      { action: "status", deployment: "nginx" },
      { autoConfirm: true },
    );
    expect(confirm).not.toHaveBeenCalled();
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/kubectl rollout status deployment\/nginx/);
  });

  it("requires confirmation for restart", async () => {
    mockExecResolve("deployment.apps/nginx restarted");
    await executeTool(
      "k8s_rollout",
      { action: "restart", deployment: "nginx" },
      { autoConfirm: true },
    );
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("requires confirmation for undo", async () => {
    mockExecResolve("rolled back");
    await executeTool(
      "k8s_rollout",
      { action: "undo", deployment: "api" },
      { autoConfirm: true },
    );
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("cancels restart when user declines", async () => {
    confirm.mockResolvedValueOnce(false);
    const result = await executeTool(
      "k8s_rollout",
      { action: "restart", deployment: "nginx" },
      { autoConfirm: true },
    );
    expect(result).toMatch(/CANCELLED/);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it("runs history without confirmation", async () => {
    mockExecResolve(
      "REVISION  CHANGE-CAUSE\n1         <none>\n2         update image",
    );
    await executeTool(
      "k8s_rollout",
      { action: "history", deployment: "api", namespace: "prod" },
      { autoConfirm: true },
    );
    expect(confirm).not.toHaveBeenCalled();
    const cmd = mockExec.mock.calls[0][0];
    expect(cmd).toMatch(/rollout history deployment\/api -n prod/);
  });
});

// ─── TOOL_DEFINITIONS presence ───────────────────────────────
describe("k8s tool definitions", () => {
  const { TOOL_DEFINITIONS } = require("../cli/tools");
  const k8sTools = [
    "k8s_pods",
    "k8s_logs",
    "k8s_exec",
    "k8s_apply",
    "k8s_rollout",
  ];

  it.each(k8sTools)("defines %s tool", (name) => {
    expect(TOOL_DEFINITIONS.some((t) => t.function.name === name)).toBe(true);
  });

  it.each(k8sTools)("%s has proper structure", (name) => {
    const tool = TOOL_DEFINITIONS.find((t) => t.function.name === name);
    expect(tool.type).toBe("function");
    expect(tool.function.description.length).toBeGreaterThan(10);
    expect(tool.function.parameters.type).toBe("object");
  });
});

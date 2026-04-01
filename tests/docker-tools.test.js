/**
 * tests/docker-tools.test.js — container_list, container_logs, container_exec, container_manage, deploy
 *
 * Same mock strategy as ssh-tools.test.js:
 * - cli/ssh fully mocked (mockSshExec, mockResolveProfile, etc.)
 * - child_process exec mocked with [util.promisify.custom] for { stdout, stderr } support
 */

const path = require("path");
const os = require("os");
const fs = require("fs");

const mockSshExec = jest.fn();
const mockResolveProfile = jest.fn();
const mockExecImpl = jest.fn();

jest.mock("../cli/ssh", () => ({
  loadServerProfiles: jest.fn().mockReturnValue({}),
  resolveProfile: (...a) => mockResolveProfile(...a),
  sshExec: (...a) => mockSshExec(...a),
  scpUpload: jest.fn(),
  scpDownload: jest.fn(),
  enrichSSHError: (s) => s,
  formatProfile: (n) => n,
}));

jest.mock("child_process", () => {
  const realChild = jest.requireActual("child_process");
  const realUtil = jest.requireActual("util");

  function mockExecFn(cmd, opts, cb) {
    const resolve = typeof opts === "function" ? opts : cb;
    mockExecImpl(cmd, opts, resolve);
  }
  mockExecFn[realUtil.promisify.custom] = (cmd, opts) =>
    new Promise((resolve, reject) => {
      mockExecImpl(cmd, opts, (err, stdout, stderr) => {
        if (err) {
          Object.assign(err, { stdout: stdout || "", stderr: stderr || "" });
          reject(err);
        } else {
          resolve({ stdout: stdout || "", stderr: stderr || "" });
        }
      });
    });

  return {
    ...realChild,
    exec: mockExecFn,
    spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
  };
});

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
  showDiff: jest.fn(),
  showNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

let tmpDir;
let cwdSpy;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-docker-tools-"));
  cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
  mockSshExec.mockReset();
  mockResolveProfile.mockReset();
  mockExecImpl.mockReset();
  jest.resetModules();
});

afterEach(() => {
  cwdSpy.mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getTools() {
  return require("../cli/tools");
}

// ─── container_list ──────────────────────────────────────────

describe("container_list", () => {
  it("lists running containers locally", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(
        null,
        "CONTAINER ID   NAMES     IMAGE   STATUS   PORTS\nabc123   nginx   nginx:latest   Up 2 hours   80/tcp",
        "",
      ),
    );
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_list",
      {},
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("nginx");
  });

  it("lists all containers with all=true", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("-a");
      cb(null, "CONTAINER ID   NAMES   STATUS\nabc   app   Exited (0)", "");
    });
    const { executeTool } = getTools();
    await executeTool(
      "container_list",
      { all: true },
      { autoConfirm: true, silent: true },
    );
  });

  it("lists containers on remote server", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockSshExec.mockResolvedValue({
      stdout: "abc123   nginx   Up",
      stderr: "",
      exitCode: 0,
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_list",
      { server: "prod" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("nginx");
    expect(mockSshExec).toHaveBeenCalled();
  });

  it("returns no containers when output is empty", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => cb(null, "", ""));
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_list",
      {},
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("no containers");
  });
});

// ─── container_logs ──────────────────────────────────────────

describe("container_logs", () => {
  it("fetches logs locally", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(null, "2024-01-01 nginx: started", ""),
    );
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_logs",
      { container: "nginx" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("nginx: started");
  });

  it("returns error when container param is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_logs",
      {},
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*container/);
  });

  it("fetches logs remotely", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockSshExec.mockResolvedValue({
      stdout: "log line from server",
      stderr: "",
      exitCode: 0,
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_logs",
      { server: "prod", container: "app" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("log line from server");
    expect(mockSshExec).toHaveBeenCalled();
  });

  it("passes --since flag", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("--since");
      expect(cmd).toContain("1h");
      cb(null, "some log", "");
    });
    const { executeTool } = getTools();
    await executeTool(
      "container_logs",
      { container: "nginx", since: "1h" },
      { autoConfirm: true, silent: true },
    );
  });

  it("passes --tail with custom lines count", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("--tail 100");
      cb(null, "logs...", "");
    });
    const { executeTool } = getTools();
    await executeTool(
      "container_logs",
      { container: "nginx", lines: 100 },
      { autoConfirm: true, silent: true },
    );
  });
});

// ─── container_exec ──────────────────────────────────────────

describe("container_exec", () => {
  it("executes read-only command locally without confirmation", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(null, "/etc/nginx/nginx.conf content", ""),
    );
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_exec",
      { container: "nginx", command: "cat /etc/nginx/nginx.conf" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("nginx.conf");
  });

  it("returns error when container param is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_exec",
      { command: "ls" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*container/);
  });

  it("returns error when command param is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_exec",
      { container: "nginx" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*command/);
  });

  it("executes command on remote server via sshExec", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockSshExec.mockResolvedValue({
      stdout: "uid=0(root)",
      stderr: "",
      exitCode: 0,
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_exec",
      { server: "prod", container: "app", command: "id" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("uid=0");
    expect(mockSshExec).toHaveBeenCalled();
  });
});

// ─── container_manage ────────────────────────────────────────

describe("container_manage", () => {
  it("inspects a container locally (read-only, no confirm)", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(null, '[{"Id":"abc"}]', ""),
    );
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_manage",
      { container: "nginx", action: "inspect" },
      { autoConfirm: false, silent: true },
    );
    expect(result).toContain("abc");
  });

  it("stops a container locally", async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("docker stop nginx");
      cb(null, "nginx", "");
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_manage",
      { container: "nginx", action: "stop" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("nginx");
  });

  it("restarts a container remotely", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockSshExec.mockResolvedValue({ stdout: "app", stderr: "", exitCode: 0 });
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_manage",
      { server: "prod", container: "app", action: "restart" },
      { autoConfirm: true, silent: true },
    );
    expect(mockSshExec).toHaveBeenCalled();
  });

  it("returns error for invalid action", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_manage",
      { container: "nginx", action: "explode" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*invalid action/);
  });

  it("returns error when container param is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "container_manage",
      { action: "stop" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*container/);
  });

  it('uses "rm" command for remove action', async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("docker rm");
      cb(null, "old-container", "");
    });
    const { executeTool } = getTools();
    await executeTool(
      "container_manage",
      { container: "old-container", action: "remove" },
      { autoConfirm: true, silent: true },
    );
  });
});

// ─── deploy ──────────────────────────────────────────────────

describe("deploy", () => {
  it("rsyncs local path to remote server", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("rsync");
      expect(cmd).toContain("jarvis@1.2.3.4:/var/www/app");
      cb(null, "sent 1024 bytes  received 32 bytes", "");
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      { server: "prod", local_path: "dist/", remote_path: "/var/www/app" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("Deployed");
  });

  it("runs deploy_script after sync", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(null, "sent 512 bytes", ""),
    );
    mockSshExec.mockResolvedValue({
      stdout: "gunicorn restarted",
      stderr: "",
      exitCode: 0,
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      {
        server: "prod",
        local_path: "dist/",
        remote_path: "/var/www/app",
        deploy_script: "systemctl restart gunicorn",
      },
      { autoConfirm: true, silent: true },
    );
    expect(mockSshExec).toHaveBeenCalled();
    expect(result).toContain("gunicorn restarted");
  });

  it("returns dry run output without executing", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain("--dry-run");
      cb(null, "would send: dist/index.html", "");
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      {
        server: "prod",
        local_path: "dist/",
        remote_path: "/var/www/app",
        dry_run: true,
      },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("DRY RUN");
    expect(result).toContain("dist/index.html");
  });

  it("excludes specified paths", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      expect(cmd).toContain('--exclude="node_modules"');
      expect(cmd).toContain('--exclude=".env"');
      cb(null, "ok", "");
    });
    const { executeTool } = getTools();
    await executeTool(
      "deploy",
      {
        server: "prod",
        local_path: "dist/",
        remote_path: "/var/www/app",
        exclude: ["node_modules", ".env"],
      },
      { autoConfirm: true, silent: true },
    );
  });

  it("returns error when server param is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      { local_path: "dist/", remote_path: "/var/www" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*server/);
  });

  it("returns error when local_path is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      { server: "prod", remote_path: "/var/www" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*local_path/);
  });

  it("returns error when remote_path is missing", async () => {
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      { server: "prod", local_path: "dist/" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*remote_path/);
  });

  it("returns error on rsync failure", async () => {
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) => {
      const e = new Error("rsync error");
      e.stderr = "rsync: connection refused";
      cb(e, "", "rsync: connection refused");
    });
    const { executeTool } = getTools();
    const result = await executeTool(
      "deploy",
      { server: "prod", local_path: "dist/", remote_path: "/var/www" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*rsync/);
  });
});

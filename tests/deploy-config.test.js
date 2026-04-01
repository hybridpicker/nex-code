/**
 * tests/deploy-config.test.js — deploy-config module + deploy tool with named configs
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-deploy-config-"));
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

function writeDeployConfig(data) {
  const dir = path.join(tmpDir, ".nex");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "deploy.json"), JSON.stringify(data));
}

// ─── deploy-config module ─────────────────────────────────────

describe("loadDeployConfigs()", () => {
  it("returns empty object when no deploy.json exists", () => {
    const { loadDeployConfigs } = require("../cli/deploy-config");
    expect(loadDeployConfigs()).toEqual({});
  });

  it("loads configs from .nex/deploy.json", () => {
    writeDeployConfig({
      prod: { server: "prod", local_path: "dist/", remote_path: "/var/www" },
    });
    const { loadDeployConfigs } = require("../cli/deploy-config");
    const configs = loadDeployConfigs();
    expect(configs.prod).toBeDefined();
    expect(configs.prod.server).toBe("prod");
  });

  it("returns empty object on corrupt JSON", () => {
    const dir = path.join(tmpDir, ".nex");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "deploy.json"), "not json");
    const { loadDeployConfigs } = require("../cli/deploy-config");
    expect(loadDeployConfigs()).toEqual({});
  });
});

describe("resolveDeployConfig()", () => {
  it("resolves a named config", () => {
    writeDeployConfig({
      prod: { server: "prod", local_path: "dist/", remote_path: "/var/www" },
    });
    const { resolveDeployConfig } = require("../cli/deploy-config");
    const cfg = resolveDeployConfig("prod");
    expect(cfg.server).toBe("prod");
    expect(cfg._name).toBe("prod");
  });

  it("throws for unknown config", () => {
    writeDeployConfig({
      prod: { server: "prod", local_path: "dist/", remote_path: "/var/www" },
    });
    const { resolveDeployConfig } = require("../cli/deploy-config");
    expect(() => resolveDeployConfig("staging")).toThrow(
      /Unknown deploy config.*staging/,
    );
    expect(() => resolveDeployConfig("staging")).toThrow(/Available: prod/);
  });

  it('throws with "no configs" hint when deploy.json is empty', () => {
    const { resolveDeployConfig } = require("../cli/deploy-config");
    expect(() => resolveDeployConfig("prod")).toThrow(
      /No deploy configs found/,
    );
  });
});

describe("saveDeployConfigs()", () => {
  it("creates .nex/deploy.json with provided configs", () => {
    const {
      saveDeployConfigs,
      loadDeployConfigs,
    } = require("../cli/deploy-config");
    saveDeployConfigs({
      prod: { server: "prod", local_path: "dist/", remote_path: "/var/www" },
    });
    const loaded = loadDeployConfigs();
    expect(loaded.prod.server).toBe("prod");
  });

  it("creates .nex directory if it does not exist", () => {
    const { saveDeployConfigs } = require("../cli/deploy-config");
    saveDeployConfigs({
      test: { server: "test", local_path: "./", remote_path: "/tmp" },
    });
    expect(fs.existsSync(path.join(tmpDir, ".nex", "deploy.json"))).toBe(true);
  });
});

// ─── deploy tool with named config ───────────────────────────

describe("deploy tool with config param", () => {
  it("uses named config from deploy.json", async () => {
    writeDeployConfig({
      prod: {
        server: "prod",
        local_path: "dist/",
        remote_path: "/var/www/app",
      },
    });
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(null, "sent 1024 bytes", ""),
    );
    const { executeTool } = require("../cli/tools");
    const result = await executeTool(
      "deploy",
      { config: "prod" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("Deployed");
  });

  it("returns error for unknown config name", async () => {
    const { executeTool } = require("../cli/tools");
    const result = await executeTool(
      "deploy",
      { config: "nonexistent" },
      { autoConfirm: true, silent: true },
    );
    expect(result).toMatch(/ERROR.*Unknown deploy config/);
  });

  it("explicit params override config values", async () => {
    writeDeployConfig({
      prod: {
        server: "prod",
        local_path: "dist/",
        remote_path: "/var/www/app",
        deploy_script: "systemctl restart nginx",
      },
    });
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) => cb(null, "ok", ""));
    // Override remote_path
    const { executeTool } = require("../cli/tools");
    const result = await executeTool(
      "deploy",
      { config: "prod", remote_path: "/var/www/override", dry_run: true },
      { autoConfirm: true, silent: true },
    );
    expect(result).toContain("DRY RUN");
    // The rsync command should use the overridden remote_path
    const rsyncCmd = mockExecImpl.mock.calls[0][0];
    expect(rsyncCmd).toContain("/var/www/override");
  });

  it("runs deploy_script from config after sync", async () => {
    writeDeployConfig({
      prod: {
        server: "prod",
        local_path: "dist/",
        remote_path: "/var/www/app",
        deploy_script: "systemctl restart nginx",
      },
    });
    mockResolveProfile.mockReturnValue({ host: "1.2.3.4", user: "jarvis" });
    mockExecImpl.mockImplementation((cmd, opts, cb) =>
      cb(null, "sent 512 bytes", ""),
    );
    mockSshExec.mockResolvedValue({
      stdout: "nginx restarted",
      stderr: "",
      exitCode: 0,
    });
    const { executeTool } = require("../cli/tools");
    const result = await executeTool(
      "deploy",
      { config: "prod" },
      { autoConfirm: true, silent: true },
    );
    expect(mockSshExec).toHaveBeenCalled();
    expect(result).toContain("nginx restarted");
  });
});

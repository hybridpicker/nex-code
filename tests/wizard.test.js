/**
 * tests/wizard.test.js — Server and Deploy wizard flows
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock ui before requiring wizard
jest.mock("../cli/ui", () => ({
  C: {
    dim: "",
    reset: "",
    red: "",
    green: "",
    yellow: "",
    cyan: "",
    blue: "",
    bold: "",
  },
}));

// Mock readline — we use setWizardRL instead, but wizard.js may fall back to readline
jest.mock("readline", () => ({
  createInterface: jest.fn(() => ({
    question: jest.fn(),
    close: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  })),
}));

const {
  runServerWizard,
  runDeployWizard,
  setWizardRL,
} = require("../cli/wizard");

let tmpDir;

function mockRL(answers) {
  let idx = 0;
  return {
    question: jest.fn((_prompt, cb) => {
      const answer = answers[idx++] || "";
      cb(answer);
    }),
    close: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-wizard-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  setWizardRL(null);
});

beforeEach(() => {
  jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
  jest.spyOn(console, "log").mockImplementation();
  // Clean .nex directory between tests
  const nexDir = path.join(tmpDir, ".nex");
  if (fs.existsSync(nexDir))
    fs.rmSync(nexDir, { recursive: true, force: true });
});

afterEach(() => {
  process.cwd.mockRestore();
  console.log.mockRestore();
  setWizardRL(null);
});

describe("setWizardRL", () => {
  test("sets internal rl used by ask", () => {
    // Setting a mock RL should cause ask() to use it instead of creating a new one
    const rl = mockRL(["test-answer"]);
    setWizardRL(rl);
    // Verify by running a wizard that calls ask — covered by other tests
    expect(() => setWizardRL(rl)).not.toThrow();
    expect(() => setWizardRL(null)).not.toThrow();
  });
});

describe("runServerWizard", () => {
  test("creates servers.json with correct structure", async () => {
    // Answers: profile name, host, user, port, key path, OS choice (1=almalinux9), sudo (y), add another (n),
    // add to gitignore — no .gitignore exists so skipped, deploy config (n)
    const rl = mockRL([
      "myserver", // profile name
      "192.168.1.100", // host
      "admin", // user
      "2222", // port
      "", // SSH key path (empty = agent)
      "1", // OS choice: almalinux9
      "y", // allow sudo
      "n", // add another server? no
      "n", // set up deploy config? no
    ]);
    setWizardRL(rl);

    await runServerWizard();

    const serversPath = path.join(tmpDir, ".nex", "servers.json");
    expect(fs.existsSync(serversPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(serversPath, "utf-8"));
    expect(data.myserver).toBeDefined();
    expect(data.myserver.host).toBe("192.168.1.100");
    expect(data.myserver.user).toBe("admin");
    expect(data.myserver.port).toBe(2222);
    expect(data.myserver.os).toBe("almalinux9");
    expect(data.myserver.sudo).toBe(true);
  });

  test("skips port when default 22", async () => {
    const rl = mockRL([
      "defaultport", // profile name
      "example.com", // host
      "root", // user
      "22", // port (default)
      "", // SSH key path
      "1", // OS choice
      "n", // no sudo
      "n", // no more servers
      "n", // no deploy config
    ]);
    setWizardRL(rl);

    await runServerWizard();

    const data = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".nex", "servers.json"), "utf-8"),
    );
    expect(data.defaultport.port).toBeUndefined();
    expect(data.defaultport.sudo).toBeUndefined();
  });
});

describe("runDeployWizard", () => {
  test("creates deploy.json with rsync config", async () => {
    const serverProfiles = { prod: { host: "10.0.0.1", user: "deploy" } };
    const nexDir = path.join(tmpDir, ".nex");
    if (!fs.existsSync(nexDir)) fs.mkdirSync(nexDir, { recursive: true });

    // Answers: config name, server choice (1=prod), method choice (1=rsync),
    // local path, exclude, remote path, deploy script, health check, add another (n)
    const rl = mockRL([
      "production", // config name
      "1", // target server: prod
      "1", // method: rsync
      "dist/", // local path
      "node_modules,.env", // exclude
      "/var/www/app", // remote path
      "systemctl restart app", // deploy script
      "curl localhost:3000", // health check
      "n", // add another? no
    ]);
    setWizardRL(rl);

    await runDeployWizard(serverProfiles, nexDir);

    const deployPath = path.join(nexDir, "deploy.json");
    expect(fs.existsSync(deployPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(deployPath, "utf-8"));
    expect(data.production).toBeDefined();
    expect(data.production.server).toBe("prod");
    expect(data.production.method).toBe("rsync");
    expect(data.production.local_path).toBe("dist/");
    expect(data.production.remote_path).toBe("/var/www/app");
    expect(data.production.exclude).toEqual(["node_modules", ".env"]);
    expect(data.production.deploy_script).toBe("systemctl restart app");
    expect(data.production.health_check).toBe("curl localhost:3000");
  });

  test("creates deploy.json with git config", async () => {
    const serverProfiles = { staging: { host: "10.0.0.2", user: "git" } };
    const nexDir = path.join(tmpDir, ".nex");
    if (!fs.existsSync(nexDir)) fs.mkdirSync(nexDir, { recursive: true });

    const rl = mockRL([
      "staging", // config name
      "1", // target server: staging
      "2", // method: git
      "main", // branch
      "/home/app/repo", // remote path
      "", // no deploy script
      "", // no health check
      "n", // no more
    ]);
    setWizardRL(rl);

    await runDeployWizard(serverProfiles, nexDir);

    const data = JSON.parse(
      fs.readFileSync(path.join(nexDir, "deploy.json"), "utf-8"),
    );
    expect(data.staging.method).toBe("git");
    expect(data.staging.branch).toBe("main");
    expect(data.staging.remote_path).toBe("/home/app/repo");
    expect(data.staging.local_path).toBeUndefined();
    expect(data.staging.deploy_script).toBeUndefined();
  });
});

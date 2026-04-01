/**
 * tests/server-context.test.js — Unit tests for cli/server-context.js
 * Tests OS_HINTS structure, getServerContext, hasServerOS, getProfileNames.
 */

jest.mock("../cli/ssh", () => ({
  loadServerProfiles: jest.fn(),
}));

const { loadServerProfiles } = require("../cli/ssh");
const {
  getServerContext,
  hasServerOS,
  getProfileNames,
  OS_HINTS,
} = require("../cli/server-context");

beforeEach(() => {
  loadServerProfiles.mockReset();
});

describe("OS_HINTS", () => {
  test("has keys for almalinux9, ubuntu, debian, macos", () => {
    expect(OS_HINTS).toHaveProperty("almalinux9");
    expect(OS_HINTS).toHaveProperty("ubuntu");
    expect(OS_HINTS).toHaveProperty("debian");
    expect(OS_HINTS).toHaveProperty("macos");
  });

  test("each OS hint value is an array of strings", () => {
    for (const [key, hints] of Object.entries(OS_HINTS)) {
      expect(Array.isArray(hints)).toBe(true);
      for (const hint of hints) {
        expect(typeof hint).toBe("string");
      }
    }
  });
});

describe("getServerContext", () => {
  test("returns null when no profiles exist", () => {
    loadServerProfiles.mockReturnValue({});
    expect(getServerContext()).toBeNull();
  });

  test("returns string containing profile info for configured servers", () => {
    loadServerProfiles.mockReturnValue({
      webserver: { host: "10.0.0.1", user: "deploy", os: "ubuntu", sudo: true },
    });
    const ctx = getServerContext();
    expect(typeof ctx).toBe("string");
    expect(ctx).toContain("webserver");
    expect(ctx).toContain("deploy@10.0.0.1");
    expect(ctx).toContain("sudo available");
  });

  test("includes OS hints for matching profiles", () => {
    loadServerProfiles.mockReturnValue({
      prod: { host: "srv1.example.com", os: "almalinux9" },
    });
    const ctx = getServerContext();
    expect(ctx).toContain("AlmaLinux 9 Notes");
    expect(ctx).toContain("dnf");
  });

  test("includes non-standard port in output", () => {
    loadServerProfiles.mockReturnValue({
      dev: { host: "dev.local", port: 2222 },
    });
    const ctx = getServerContext();
    expect(ctx).toContain(":2222");
  });

  test("omits port when 22", () => {
    loadServerProfiles.mockReturnValue({
      dev: { host: "dev.local", port: 22 },
    });
    const ctx = getServerContext();
    expect(ctx).not.toContain(":22");
  });

  test("handles multiple profiles with different OS types", () => {
    loadServerProfiles.mockReturnValue({
      alma: { host: "a.com", os: "almalinux9" },
      mac: { host: "b.com", os: "macos" },
    });
    const ctx = getServerContext();
    expect(ctx).toContain("AlmaLinux 9 Notes");
    expect(ctx).toContain("macOS Notes");
  });
});

describe("hasServerOS", () => {
  test("returns true when a profile matches the OS prefix", () => {
    loadServerProfiles.mockReturnValue({
      prod: { host: "srv.com", os: "almalinux9" },
    });
    expect(hasServerOS("almalinux")).toBe(true);
  });

  test("returns false when no profile matches", () => {
    loadServerProfiles.mockReturnValue({
      prod: { host: "srv.com", os: "ubuntu" },
    });
    expect(hasServerOS("almalinux")).toBe(false);
  });

  test("returns false when no profiles exist", () => {
    loadServerProfiles.mockReturnValue({});
    expect(hasServerOS("ubuntu")).toBe(false);
  });
});

describe("getProfileNames", () => {
  test("returns array of profile names", () => {
    loadServerProfiles.mockReturnValue({
      web: { host: "w.com" },
      db: { host: "d.com" },
    });
    expect(getProfileNames()).toEqual(["web", "db"]);
  });

  test("returns empty array when no profiles", () => {
    loadServerProfiles.mockReturnValue({});
    expect(getProfileNames()).toEqual([]);
  });
});

describe("getDeploymentContextBlock — server rules", () => {
  const { getDeploymentContextBlock } = require("../cli/server-context");

  // Mock fs.readFileSync to simulate NEX.md with server keyword
  beforeEach(() => {
    jest.spyOn(require("fs"), "readFileSync").mockReturnValue("server deployment");
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("includes server rules when profile has host 94.130.37.43", () => {
    loadServerProfiles.mockReturnValue({
      prod: { host: "94.130.37.43", user: "root", os: "almalinux9" },
    });
    const block = getDeploymentContextBlock();
    expect(block).toBeDefined();
    expect(block).toContain("Server Debugging Rules");
    expect(block).toContain("ssh_exec");
    expect(block).toContain("/home/deploy/server-agent/logs/");
  });

  test("omits server rules when no profile has server host", () => {
    loadServerProfiles.mockReturnValue({
      web: { host: "example.com", user: "deploy", os: "ubuntu" },
    });
    const block = getDeploymentContextBlock();
    expect(block).toBeDefined();
    expect(block).not.toContain("Server Debugging Rules");
  });
});

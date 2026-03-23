/**
 * tests/mcp-client.test.js — Unit tests for cli/mcp-client.js
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { EventEmitter } = require("events");

// Mock spawn BEFORE requiring mcp-client
const mockSpawn = jest.fn();
jest.mock("child_process", () => {
  const actual = jest.requireActual("child_process");
  return { ...actual, spawn: (...args) => mockSpawn(...args) };
});

const {
  loadMcpServers,
  callMcpTool,
  getMcpTools,
  shutdownMcpServers,
  listMcpServers,
  _interpolateEnv,
  _readConfig,
  _sendRequest,
} = require("../cli/mcp-client");

// ─── Mock process factory ─────────────────────────────────────

function createMockProc(opts = {}) {
  const stdin = { write: jest.fn(), end: jest.fn() };
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = {
    stdin,
    stdout,
    stderr,
    kill: jest.fn(),
    on: jest.fn(),
    pid: 99999,
  };

  stdin.write.mockImplementation((data) => {
    const request = JSON.parse(data.trim());
    let response;

    if (request.method === "initialize") {
      if (opts.failInit) {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -1, message: "init failed" },
        };
      } else {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: { capabilities: {} },
        };
      }
    } else if (request.method === "tools/list") {
      response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: opts.tools || [
            {
              name: "search",
              description: "Search the web",
              inputSchema: {
                type: "object",
                properties: { query: { type: "string" } },
              },
            },
          ],
        },
      };
    } else if (request.method === "tools/call") {
      response = {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "text",
              text: `called: ${request.params.name}(${JSON.stringify(request.params.arguments)})`,
            },
          ],
        },
      };
    } else {
      response = { jsonrpc: "2.0", id: request.id, result: {} };
    }

    setImmediate(() =>
      stdout.emit("data", Buffer.from(JSON.stringify(response) + "\n")),
    );
  });

  return proc;
}

// ─── Test fixtures ────────────────────────────────────────────

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-mcp-client-"));
  jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
  shutdownMcpServers(); // reset state
  mockSpawn.mockReset();
  mockSpawn.mockImplementation(() => createMockProc());
});

afterEach(() => {
  shutdownMcpServers();
  jest.restoreAllMocks();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

// ─── _interpolateEnv ─────────────────────────────────────────

describe("_interpolateEnv()", () => {
  it("replaces ${VAR} with process.env value", () => {
    process.env._NEX_TEST_VAR_ = "hello";
    expect(_interpolateEnv("${_NEX_TEST_VAR_}")).toBe("hello");
    delete process.env._NEX_TEST_VAR_;
  });

  it("replaces missing vars with empty string", () => {
    delete process.env._NEX_MISSING_;
    expect(_interpolateEnv("${_NEX_MISSING_}")).toBe("");
  });

  it("leaves non-template strings unchanged", () => {
    expect(_interpolateEnv("plain-value")).toBe("plain-value");
  });

  it("handles multiple replacements in one string", () => {
    process.env._NEX_A_ = "foo";
    process.env._NEX_B_ = "bar";
    expect(_interpolateEnv("${_NEX_A_}/${_NEX_B_}")).toBe("foo/bar");
    delete process.env._NEX_A_;
    delete process.env._NEX_B_;
  });

  it("returns non-string values as-is", () => {
    expect(_interpolateEnv(42)).toBe(42);
    expect(_interpolateEnv(null)).toBe(null);
  });
});

// ─── _readConfig ─────────────────────────────────────────────

describe("_readConfig()", () => {
  it("returns empty servers when no config file exists", () => {
    const cfg = _readConfig();
    expect(cfg).toEqual({ servers: {} });
  });

  it("reads config from explicit path", () => {
    const cfgPath = path.join(tmpDir, "custom-mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        servers: { srv: { command: "node", args: ["x.js"] } },
      }),
    );
    const cfg = _readConfig(cfgPath);
    expect(cfg.servers.srv).toBeDefined();
    expect(cfg.servers.srv.command).toBe("node");
  });

  it("reads from .nex/mcp.json in cwd", () => {
    const nexDir = path.join(tmpDir, ".nex");
    fs.mkdirSync(nexDir, { recursive: true });
    fs.writeFileSync(
      path.join(nexDir, "mcp.json"),
      JSON.stringify({
        servers: { local: { command: "mock" } },
      }),
    );
    const cfg = _readConfig();
    expect(cfg.servers.local).toBeDefined();
  });

  it("returns empty servers for invalid JSON", () => {
    const cfgPath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(cfgPath, "not-json");
    const cfg = _readConfig(cfgPath);
    expect(cfg).toEqual({ servers: {} });
  });

  it("supports env var interpolation in env block", () => {
    process.env._NEX_KEY_ = "secret123";
    const cfgPath = path.join(tmpDir, "env-mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        servers: {
          s: {
            command: "node",
            env: { MY_KEY: "${_NEX_KEY_}" },
          },
        },
      }),
    );
    const cfg = _readConfig(cfgPath);
    // Config is read raw — interpolation happens at spawn time
    expect(cfg.servers.s.env.MY_KEY).toBe("${_NEX_KEY_}");
    delete process.env._NEX_KEY_;
  });
});

// ─── loadMcpServers ──────────────────────────────────────────

describe("loadMcpServers()", () => {
  it("returns empty array when no config found", async () => {
    const results = await loadMcpServers();
    expect(results).toEqual([]);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("spawns server and returns tool count", async () => {
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        servers: { brave: { command: "npx", args: ["-y", "brave-search"] } },
      }),
    );
    const results = await loadMcpServers(cfgPath);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("brave");
    expect(results[0].tools).toBe(1);
    expect(results[0].error).toBeUndefined();
  });

  it("gracefully handles server init failure", async () => {
    mockSpawn.mockImplementation(() => createMockProc({ failInit: true }));
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        servers: { broken: { command: "fail" } },
      }),
    );
    const results = await loadMcpServers(cfgPath);
    expect(results).toHaveLength(1);
    expect(results[0].error).toBeDefined();
    expect(results[0].tools).toBe(0);
  });

  it("does not re-spawn already connected server", async () => {
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ servers: { s: { command: "mock" } } }),
    );
    await loadMcpServers(cfgPath);
    await loadMcpServers(cfgPath);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("interpolates ${VAR} in env block when spawning", async () => {
    process.env._NEX_TEST_KEY_ = "injected";
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        servers: {
          s: { command: "mock", env: { MY_KEY: "${_NEX_TEST_KEY_}" } },
        },
      }),
    );
    await loadMcpServers(cfgPath);
    const spawnCall = mockSpawn.mock.calls[0];
    expect(spawnCall[2].env.MY_KEY).toBe("injected");
    delete process.env._NEX_TEST_KEY_;
  });
});

// ─── getMcpTools ─────────────────────────────────────────────

describe("getMcpTools()", () => {
  it("returns empty array before any servers are loaded", () => {
    expect(getMcpTools()).toEqual([]);
  });

  it("returns tool definitions after loading a server", async () => {
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ servers: { s: { command: "mock" } } }),
    );
    await loadMcpServers(cfgPath);
    const tools = getMcpTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe("function");
    expect(tools[0].function.name).toBe("mcp_s_search");
    expect(tools[0].function.description).toContain("MCP:s");
  });
});

// ─── callMcpTool ─────────────────────────────────────────────

describe("callMcpTool()", () => {
  it("throws when server is not connected", async () => {
    await expect(callMcpTool("no-server", "tool", {})).rejects.toThrow(
      "not connected",
    );
  });

  it("calls tool on connected server and returns text", async () => {
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ servers: { s: { command: "mock" } } }),
    );
    await loadMcpServers(cfgPath);
    const result = await callMcpTool("s", "search", { query: "hello" });
    expect(result).toContain("called:");
    expect(result).toContain("search");
    expect(result).toContain("hello");
  });
});

// ─── shutdownMcpServers ──────────────────────────────────────

describe("shutdownMcpServers()", () => {
  it("does not throw when no servers are running", () => {
    expect(() => shutdownMcpServers()).not.toThrow();
  });

  it("kills running server processes", async () => {
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ servers: { s: { command: "mock" } } }),
    );
    await loadMcpServers(cfgPath);
    expect(getMcpTools()).toHaveLength(1);
    shutdownMcpServers();
    expect(getMcpTools()).toHaveLength(0);
  });

  it("handles proc.kill() throwing without crashing", async () => {
    const brokenProc = createMockProc();
    brokenProc.kill.mockImplementation(() => {
      throw new Error("already dead");
    });
    mockSpawn.mockReturnValueOnce(brokenProc);

    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ servers: { s: { command: "mock" } } }),
    );
    await loadMcpServers(cfgPath);
    expect(() => shutdownMcpServers()).not.toThrow();
  });
});

// ─── listMcpServers ──────────────────────────────────────────

describe("listMcpServers()", () => {
  it("returns empty array when no servers connected", () => {
    expect(listMcpServers()).toEqual([]);
  });

  it("returns connected servers with tool count", async () => {
    const cfgPath = path.join(tmpDir, "mcp.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({ servers: { brave: { command: "mock" } } }),
    );
    await loadMcpServers(cfgPath);
    const list = listMcpServers();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("brave");
    expect(list[0].connected).toBe(true);
    expect(list[0].toolCount).toBe(1);
  });
});

// ─── _sendRequest ────────────────────────────────────────────

describe("_sendRequest()", () => {
  it("sends JSON-RPC and resolves on matching response", async () => {
    const mockProc = {
      stdin: { write: jest.fn() },
      stdout: { on: jest.fn(), removeListener: jest.fn() },
    };

    const promise = _sendRequest(mockProc, "test/method", { k: "v" }, 5000);
    const onData = mockProc.stdout.on.mock.calls[0][1];
    const written = mockProc.stdin.write.mock.calls[0][0];
    const req = JSON.parse(written.trim());

    onData(
      Buffer.from(
        JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { ok: true } }) +
          "\n",
      ),
    );

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it("rejects on error response", async () => {
    const mockProc = {
      stdin: { write: jest.fn() },
      stdout: { on: jest.fn(), removeListener: jest.fn() },
    };

    const promise = _sendRequest(mockProc, "test/fail", {}, 5000);
    const onData = mockProc.stdout.on.mock.calls[0][1];
    const written = mockProc.stdin.write.mock.calls[0][0];
    const req = JSON.parse(written.trim());

    onData(
      Buffer.from(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.id,
          error: { code: -1, message: "boom" },
        }) + "\n",
      ),
    );

    await expect(promise).rejects.toThrow("MCP error: boom");
  });

  it("rejects on timeout", async () => {
    const mockProc = {
      stdin: { write: jest.fn() },
      stdout: { on: jest.fn(), removeListener: jest.fn() },
    };
    await expect(
      _sendRequest(mockProc, "test/timeout", {}, 30),
    ).rejects.toThrow("MCP request timeout");
  });

  it("rejects when stdin.write throws", async () => {
    const mockProc = {
      stdin: {
        write: jest.fn().mockImplementation(() => {
          throw new Error("broken pipe");
        }),
      },
      stdout: { on: jest.fn(), removeListener: jest.fn() },
    };
    await expect(
      _sendRequest(mockProc, "test/write", {}, 5000),
    ).rejects.toThrow("MCP write failed");
  });
});

const path = require("path");
const fs = require("fs");
const os = require("os");

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-hooks-"));
  jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const {
  HOOK_EVENTS,
  loadHookConfig,
  getHooksForEvent,
  executeHook,
  runHooks,
  hasHooks,
  listHooks,
  initHooksDir,
} = require("../cli/hooks");

describe("hooks.js", () => {
  // ─── HOOK_EVENTS ──────────────────────────────────────────
  describe("HOOK_EVENTS", () => {
    it("contains expected events", () => {
      expect(HOOK_EVENTS).toContain("pre-tool");
      expect(HOOK_EVENTS).toContain("post-tool");
      expect(HOOK_EVENTS).toContain("pre-commit");
      expect(HOOK_EVENTS).toContain("post-response");
      expect(HOOK_EVENTS).toContain("session-start");
      expect(HOOK_EVENTS).toContain("session-end");
      expect(HOOK_EVENTS).toHaveLength(6);
    });
  });

  // ─── loadHookConfig ───────────────────────────────────────
  describe("loadHookConfig()", () => {
    it("returns empty object when no config file", () => {
      expect(loadHookConfig()).toEqual({});
    });

    it("returns empty object when config has no hooks", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ mcpServers: {} }),
      );
      expect(loadHookConfig()).toEqual({});
    });

    it("returns hooks from config", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      const config = {
        hooks: {
          "pre-tool": ["echo pre-tool"],
          "post-response": "echo done",
        },
      };
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify(config),
      );
      const result = loadHookConfig();
      expect(result["pre-tool"]).toEqual(["echo pre-tool"]);
      expect(result["post-response"]).toBe("echo done");
    });

    it("handles corrupt config", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, "config.json"), "{invalid");
      expect(loadHookConfig()).toEqual({});
    });
  });

  // ─── getHooksForEvent ─────────────────────────────────────
  describe("getHooksForEvent()", () => {
    it("returns empty array for invalid event", () => {
      expect(getHooksForEvent("invalid-event")).toEqual([]);
    });

    it("returns empty array when no hooks configured", () => {
      expect(getHooksForEvent("pre-tool")).toEqual([]);
    });

    it("finds hook script files in .nex/hooks/", () => {
      const hooksDir = path.join(tmpDir, ".nex", "hooks");
      fs.mkdirSync(hooksDir, { recursive: true });
      fs.writeFileSync(
        path.join(hooksDir, "pre-tool"),
        "#!/bin/bash\necho ok",
        { mode: 0o755 },
      );

      const hooks = getHooksForEvent("pre-tool");
      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toContain("pre-tool");
    });

    it("finds hooks from config.json", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ hooks: { "post-tool": ["echo done"] } }),
      );

      const hooks = getHooksForEvent("post-tool");
      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toBe("echo done");
    });

    it("combines script files and config hooks", () => {
      const hooksDir = path.join(tmpDir, ".nex", "hooks");
      fs.mkdirSync(hooksDir, { recursive: true });
      fs.writeFileSync(
        path.join(hooksDir, "pre-tool"),
        "#!/bin/bash\necho script",
      );
      fs.writeFileSync(
        path.join(tmpDir, ".nex", "config.json"),
        JSON.stringify({ hooks: { "pre-tool": ["echo config"] } }),
      );

      const hooks = getHooksForEvent("pre-tool");
      expect(hooks).toHaveLength(2);
    });

    it("handles config with single string command", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ hooks: { "session-start": "echo hello" } }),
      );

      const hooks = getHooksForEvent("session-start");
      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toBe("echo hello");
    });
  });

  // ─── executeHook ──────────────────────────────────────────
  describe("executeHook()", () => {
    it("executes a command and returns output", () => {
      const result = executeHook("echo hello");
      expect(result.success).toBe(true);
      expect(result.output).toBe("hello");
    });

    it("returns error on failed command", () => {
      const result = executeHook("false");
      expect(result.success).toBe(false);
    });

    it("passes environment variables", () => {
      const result = executeHook("echo $NEX_TEST_VAR", {
        NEX_TEST_VAR: "works",
      });
      expect(result.success).toBe(true);
      expect(result.output).toBe("works");
    });

    it("handles command not found", () => {
      const result = executeHook("nonexistent_command_xyz_12345");
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ─── runHooks ─────────────────────────────────────────────
  describe("runHooks()", () => {
    it("returns empty results and blocked:false when no hooks configured", () => {
      const r = runHooks("pre-tool");
      expect(r.results).toEqual([]);
      expect(r.blocked).toBe(false);
    });

    it("runs all hooks for an event", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          hooks: { "post-response": ["echo first", "echo second"] },
        }),
      );

      const { results, blocked } = runHooks("post-response");
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].output).toBe("first");
      expect(results[1].success).toBe(true);
      expect(results[1].output).toBe("second");
      expect(blocked).toBe(false);
    });

    it("passes context as NEX_ env vars", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ hooks: { "post-tool": ["echo $NEX_TOOL_NAME"] } }),
      );

      const { results } = runHooks("post-tool", { tool_name: "bash" });
      expect(results).toHaveLength(1);
      expect(results[0].output).toBe("bash");
    });

    it("stops on pre-* hook failure (non-blocking)", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          hooks: { "pre-tool": ["false", "echo should-not-run"] },
        }),
      );

      const { results, blocked } = runHooks("pre-tool");
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(blocked).toBe(false); // exit 1 warns but doesn't block
    });

    it("blocks tool call when pre-* hook exits with code 2", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      // Write a script that exits with code 2
      const scriptPath = path.join(configDir, "block-hook.sh");
      fs.writeFileSync(scriptPath, "#!/bin/sh\necho 'blocked by policy'\nexit 2\n", { mode: 0o755 });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ hooks: { "pre-tool": [scriptPath] } }),
      );

      const { results, blocked, blockReason } = runHooks("pre-tool");
      expect(blocked).toBe(true);
      expect(blockReason).toMatch(/blocked by policy/);
      expect(results[0].exitCode).toBe(2);
    });

    it("continues on post-* hook failure", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ hooks: { "post-tool": ["false", "echo continued"] } }),
      );

      const { results } = runHooks("post-tool");
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false);
      expect(results[1].success).toBe(true);
    });
  });

  // ─── hasHooks ─────────────────────────────────────────────
  describe("hasHooks()", () => {
    it("returns false when no hooks configured", () => {
      expect(hasHooks("pre-tool")).toBe(false);
    });

    it("returns true when hooks exist", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({ hooks: { "pre-tool": ["echo test"] } }),
      );
      expect(hasHooks("pre-tool")).toBe(true);
    });
  });

  // ─── listHooks ────────────────────────────────────────────
  describe("listHooks()", () => {
    it("returns empty array when no hooks", () => {
      expect(listHooks()).toEqual([]);
    });

    it("lists all configured hooks", () => {
      const configDir = path.join(tmpDir, ".nex");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.json"),
        JSON.stringify({
          hooks: {
            "pre-tool": ["echo pre"],
            "post-response": ["echo post"],
          },
        }),
      );

      const hooks = listHooks();
      expect(hooks).toHaveLength(2);
      expect(hooks.find((h) => h.event === "pre-tool")).toBeDefined();
      expect(hooks.find((h) => h.event === "post-response")).toBeDefined();
    });
  });

  // ─── initHooksDir ─────────────────────────────────────────
  describe("initHooksDir()", () => {
    it("creates .nex/hooks/ directory", () => {
      const dir = initHooksDir();
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toContain(".nex");
      expect(dir).toContain("hooks");
    });

    it("is idempotent", () => {
      initHooksDir();
      expect(() => initHooksDir()).not.toThrow();
    });
  });
});

const fs = require("fs");
const path = require("path");
const os = require("os");

const skill = require("../cli/skills/session-search");
const searchSessions = skill._searchSessions;

describe("session-search.js", () => {
  let tmpDir;
  let origCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-session-search-"));
    origCwd = process.cwd;
    process.cwd = () => tmpDir;

    // Create sessions directory with test data
    const sessDir = path.join(tmpDir, ".nex", "sessions");
    fs.mkdirSync(sessDir, { recursive: true });

    // Session 1: Docker debugging
    fs.writeFileSync(
      path.join(sessDir, "docker-debug.json"),
      JSON.stringify({
        name: "docker-debug",
        updatedAt: "2026-03-30T12:00:00Z",
        model: "devstral-2:123b",
        messageCount: 4,
        messages: [
          { role: "user", content: "The docker container keeps crashing with OOM error" },
          { role: "assistant", content: "Let me check the docker logs and memory limits." },
          { role: "user", content: "I set the memory limit to 512m" },
          { role: "assistant", content: "The OOM issue is caused by the Node.js heap exceeding 512MB. Increase to 1G." },
        ],
      }),
    );

    // Session 2: Deploy workflow
    fs.writeFileSync(
      path.join(sessDir, "deploy-v2.json"),
      JSON.stringify({
        name: "deploy-v2",
        updatedAt: "2026-03-29T08:00:00Z",
        model: "qwen3-vl:235b",
        messageCount: 3,
        messages: [
          { role: "user", content: "Deploy the app to production server" },
          { role: "assistant", content: "Running npm run build && scp dist/ server:/app/" },
          { role: "user", content: "The deploy failed with permission denied on docker socket" },
        ],
      }),
    );

    // Session 3: Unrelated
    fs.writeFileSync(
      path.join(sessDir, "refactor.json"),
      JSON.stringify({
        name: "refactor",
        updatedAt: "2026-03-28T10:00:00Z",
        model: "devstral-2:123b",
        messageCount: 2,
        messages: [
          { role: "user", content: "Refactor the auth module" },
          { role: "assistant", content: "I'll extract the JWT validation into a separate middleware." },
        ],
      }),
    );
  });

  afterEach(() => {
    process.cwd = origCwd;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("module structure", () => {
    it("exports name, description, instructions", () => {
      expect(skill.name).toBe("session-search");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.instructions).toBe("string");
    });

    it("exports search_sessions tool", () => {
      expect(skill.tools).toHaveLength(1);
      expect(skill.tools[0].function.name).toBe("search_sessions");
    });
  });

  describe("searchSessions()", () => {
    it("finds sessions by keyword", () => {
      const results = searchSessions("docker");
      expect(results.length).toBe(2); // docker-debug + deploy-v2 (mentions docker socket)
      // docker-debug has more matches
      expect(results[0].name).toBe("docker-debug");
    });

    it("is case-insensitive", () => {
      const results = searchSessions("OOM");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("docker-debug");
    });

    it("returns snippets with context", () => {
      const results = searchSessions("docker");
      expect(results[0].snippets.length).toBeGreaterThan(0);
      expect(results[0].snippets[0]).toContain("docker");
    });

    it("respects maxResults", () => {
      const results = searchSessions("the", { maxResults: 1 });
      expect(results.length).toBe(1);
    });

    it("returns empty array for no matches", () => {
      const results = searchSessions("xyznonexistent");
      expect(results).toEqual([]);
    });

    it("returns empty array when sessions dir does not exist", () => {
      fs.rmSync(path.join(tmpDir, ".nex"), { recursive: true, force: true });
      const results = searchSessions("anything");
      expect(results).toEqual([]);
    });

    it("includes match count", () => {
      const results = searchSessions("docker");
      expect(results[0].matchCount).toBeGreaterThan(0);
    });

    it("includes session metadata", () => {
      const results = searchSessions("docker");
      expect(results[0].updatedAt).toBe("2026-03-30T12:00:00Z");
      expect(results[0].model).toBe("devstral-2:123b");
    });

    it("limits snippets per session", () => {
      const results = searchSessions("the", { maxSnippets: 1 });
      for (const r of results) {
        expect(r.snippets.length).toBeLessThanOrEqual(1);
      }
    });

    it("sorts by match count then date", () => {
      // "deploy" appears in deploy-v2 only
      const results = searchSessions("deploy");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("deploy-v2");
    });

    it("skips corrupt session files", () => {
      const sessDir = path.join(tmpDir, ".nex", "sessions");
      fs.writeFileSync(path.join(sessDir, "corrupt.json"), "not valid json{{{");
      const results = searchSessions("docker");
      // Should still find docker-debug, not crash
      expect(results.length).toBeGreaterThan(0);
    });

    it("handles sessions with no messages array", () => {
      const sessDir = path.join(tmpDir, ".nex", "sessions");
      fs.writeFileSync(
        path.join(sessDir, "empty.json"),
        JSON.stringify({ name: "empty", messages: null }),
      );
      const results = searchSessions("docker");
      expect(results.length).toBeGreaterThan(0); // still finds docker-debug
    });
  });

  describe("search_sessions tool", () => {
    const exec = skill.tools[0].execute;

    it("returns matching sessions as JSON", async () => {
      const result = JSON.parse(await exec({ query: "docker" }));
      expect(result.status).toBe("ok");
      expect(result.sessions.length).toBeGreaterThan(0);
      expect(result.sessions[0].name).toBe("docker-debug");
    });

    it("returns message for no matches", async () => {
      const result = JSON.parse(await exec({ query: "nonexistent-thing" }));
      expect(result.status).toBe("ok");
      expect(result.results).toEqual([]);
    });

    it("rejects query too short", async () => {
      const result = JSON.parse(await exec({ query: "x" }));
      expect(result.status).toBe("error");
      expect(result.error).toContain("at least 2");
    });

    it("respects max_results parameter", async () => {
      const result = JSON.parse(
        await exec({ query: "the", max_results: 1 }),
      );
      expect(result.sessions.length).toBeLessThanOrEqual(1);
    });
  });
});

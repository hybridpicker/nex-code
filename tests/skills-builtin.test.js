/**
 * tests/skills-builtin.test.js — Built-in Skill Integration Tests
 * Verifies that built-in skills from cli/skills/ are loaded correctly
 * by the skill loader and produce valid tool definitions.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

let tmpDir;

// Do NOT set NEX_SKIP_BUILTIN_SKILLS — we want built-ins to load
beforeEach(() => {
  jest.resetModules();
  delete process.env.NEX_SKIP_BUILTIN_SKILLS;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-builtin-skills-"));
  jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getSkills() {
  return require("../cli/skills");
}

describe("built-in skill loading", () => {
  it("loads skill-learning from cli/skills/", () => {
    const skills = getSkills();
    const all = skills.loadAllSkills();
    const sl = all.find((s) => s.name === "skill-learning");

    expect(sl).toBeDefined();
    expect(sl.enabled).toBe(true);
    expect(sl.type).toBe("script");
    expect(typeof sl.instructions).toBe("string");
    expect(sl.instructions.length).toBeGreaterThan(0);
  });

  it("loads session-search from cli/skills/", () => {
    const skills = getSkills();
    const all = skills.loadAllSkills();
    const ss = all.find((s) => s.name === "session-search");

    expect(ss).toBeDefined();
    expect(ss.enabled).toBe(true);
    expect(ss.type).toBe("script");
    expect(typeof ss.instructions).toBe("string");
  });

  it("skill-learning registers tool definitions", () => {
    const skills = getSkills();
    skills.loadAllSkills();
    const toolDefs = skills.getSkillToolDefinitions();
    const names = toolDefs.map((t) => t.function.name);

    expect(names).toContain("skill_learn_create");
    expect(names).toContain("skill_learn_patch");
    expect(names).toContain("skill_learn_read");
  });

  it("session-search registers tool definitions", () => {
    const skills = getSkills();
    skills.loadAllSkills();
    const toolDefs = skills.getSkillToolDefinitions();
    const names = toolDefs.map((t) => t.function.name);

    expect(names).toContain("skill_search_sessions");
  });

  it("skill-learning registers /skills-learned command", () => {
    const skills = getSkills();
    skills.loadAllSkills();
    const cmds = skills.getSkillCommands();
    const cmdNames = cmds.map((c) => c.cmd);

    expect(cmdNames).toContain("/skills-learned");
  });

  it("skill_learn_create is routable", async () => {
    const skills = getSkills();
    skills.loadAllSkills();

    const result = await skills.routeSkillCall("skill_learn_create", {
      name: "test-integration",
      description: "Integration test skill creation",
      content: "Step 1: Do the integration test thing\nStep 2: Verify it works",
    });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("created");
    expect(
      fs.existsSync(path.join(tmpDir, ".nex", "skills", "test-integration.md")),
    ).toBe(true);
  });

  it("skill_search_sessions is routable", async () => {
    const skills = getSkills();
    skills.loadAllSkills();

    // No sessions exist, so should return empty
    const result = await skills.routeSkillCall("skill_search_sessions", {
      query: "docker",
    });

    const parsed = JSON.parse(result);
    expect(parsed.status).toBe("ok");
    expect(parsed.results || parsed.sessions).toEqual([]);
  });

  it("getSkillInstructions includes skill-learning guidance", () => {
    const skills = getSkills();
    skills.loadAllSkills();
    const instructions = skills.getSkillInstructions();

    expect(instructions).toContain("skill");
    expect(instructions).toContain("learn");
  });

  it("getSkillInstructions includes session-search guidance", () => {
    const skills = getSkills();
    skills.loadAllSkills();
    const instructions = skills.getSkillInstructions();

    expect(instructions).toContain("session");
    expect(instructions).toContain("search");
  });

  it("loads autoresearch built-in skill", () => {
    const skills = getSkills();
    const all = skills.loadAllSkills();
    const ar = all.find((s) => s.name === "autoresearch");

    expect(ar).toBeDefined();
    expect(ar.enabled).toBe(true);
  });
});

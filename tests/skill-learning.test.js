const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock skills.js to prevent circular dependency issues
jest.mock("../cli/skills", () => ({
  loadAllSkills: jest.fn(),
}));

const skill = require("../cli/skills/skill-learning");

describe("skill-learning.js", () => {
  let tmpDir;
  let origCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-skill-learn-"));
    origCwd = process.cwd;
    process.cwd = () => tmpDir;
  });

  afterEach(() => {
    process.cwd = origCwd;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("module structure", () => {
    it("exports name, description, instructions", () => {
      expect(skill.name).toBe("skill-learning");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.instructions).toBe("string");
    });

    it("exports commands array", () => {
      expect(Array.isArray(skill.commands)).toBe(true);
      expect(skill.commands.length).toBeGreaterThan(0);
      expect(skill.commands[0].cmd).toBe("/skills-learned");
    });

    it("exports 3 tools", () => {
      expect(skill.tools).toHaveLength(3);
      const names = skill.tools.map((t) => t.function.name);
      expect(names).toContain("learn_create");
      expect(names).toContain("learn_patch");
      expect(names).toContain("learn_read");
    });
  });

  describe("learn_create", () => {
    const exec = (args) =>
      skill.tools.find((t) => t.function.name === "learn_create").execute(args);

    it("creates a skill file", async () => {
      const result = JSON.parse(
        await exec({
          name: "deploy-app",
          description: "Deploy the application to production",
          triggers: ["deploy", "production", "release"],
          content: "## Steps\n\n1. Run tests\n2. Build\n3. Deploy to server",
        }),
      );

      expect(result.status).toBe("created");
      expect(result.name).toBe("deploy-app");

      const filePath = path.join(tmpDir, ".nex", "skills", "deploy-app.md");
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("name: deploy-app");
      expect(content).toContain("description: Deploy the application");
      expect(content).toContain('- "deploy"');
      expect(content).toContain("## Steps");
    });

    it("rejects invalid names", async () => {
      const result = JSON.parse(
        await exec({
          name: "INVALID NAME!",
          description: "Test skill",
          content: "Some content that is long enough to pass validation",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("lowercase");
    });

    it("rejects names too short", async () => {
      const result = JSON.parse(
        await exec({
          name: "x",
          description: "Test skill",
          content: "Some content that is long enough to pass validation",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("2-64");
    });

    it("rejects empty content", async () => {
      const result = JSON.parse(
        await exec({
          name: "test-skill",
          description: "Test skill",
          content: "short",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("at least 20");
    });

    it("rejects empty description", async () => {
      const result = JSON.parse(
        await exec({
          name: "test-skill",
          description: "hi",
          content: "Some content that is long enough to pass validation",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("at least 5");
    });

    it("rejects duplicate names", async () => {
      await exec({
        name: "my-skill",
        description: "First version of the skill",
        content: "Some content that is long enough to pass validation",
      });

      const result = JSON.parse(
        await exec({
          name: "my-skill",
          description: "Second version",
          content: "Different content that is also long enough",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("already exists");
    });

    it("works without triggers", async () => {
      const result = JSON.parse(
        await exec({
          name: "no-triggers",
          description: "A skill without triggers",
          content: "Some content that is long enough to pass validation",
        }),
      );
      expect(result.status).toBe("created");

      const content = fs.readFileSync(result.path, "utf-8");
      expect(content).not.toContain("trigger:");
    });
  });

  describe("learn_patch", () => {
    const create = (args) =>
      skill.tools.find((t) => t.function.name === "learn_create").execute(args);
    const patch = (args) =>
      skill.tools.find((t) => t.function.name === "learn_patch").execute(args);

    it("patches an existing skill", async () => {
      await create({
        name: "patchable",
        description: "A skill to be patched",
        content: "Step 1: Run old command\nStep 2: Verify",
      });

      const result = JSON.parse(
        await patch({
          name: "patchable",
          old_text: "Run old command",
          new_text: "Run new command",
        }),
      );

      expect(result.status).toBe("patched");

      const content = fs.readFileSync(result.path, "utf-8");
      expect(content).toContain("Run new command");
      expect(content).not.toContain("Run old command");
    });

    it("returns error for non-existent skill", async () => {
      const result = JSON.parse(
        await patch({
          name: "nonexistent",
          old_text: "foo",
          new_text: "bar",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("not found");
    });

    it("returns error when old_text not found", async () => {
      await create({
        name: "mismatch-skill",
        description: "A skill for mismatch testing",
        content: "Some content that is long enough to pass validation",
      });

      const result = JSON.parse(
        await patch({
          name: "mismatch-skill",
          old_text: "this text does not exist in the file",
          new_text: "replacement",
        }),
      );
      expect(result.status).toBe("error");
      expect(result.error).toContain("old_text not found");
    });
  });

  describe("learn_read", () => {
    const create = (args) =>
      skill.tools.find((t) => t.function.name === "learn_create").execute(args);
    const read = (args) =>
      skill.tools.find((t) => t.function.name === "learn_read").execute(args);

    it("reads an existing skill", async () => {
      await create({
        name: "readable",
        description: "A skill to be read back",
        content: "Step 1: Do the thing\nStep 2: Verify the thing",
      });

      const result = JSON.parse(await read({ name: "readable" }));
      expect(result.status).toBe("ok");
      expect(result.content).toContain("Do the thing");
    });

    it("returns error for non-existent skill", async () => {
      const result = JSON.parse(await read({ name: "nonexistent" }));
      expect(result.status).toBe("error");
      expect(result.error).toContain("not found");
    });

    it("returns error for empty name", async () => {
      const result = JSON.parse(await read({ name: "" }));
      expect(result.status).toBe("error");
    });
  });

  describe("/skills-learned command", () => {
    it("reports no skills when directory is empty", () => {
      const result = skill.commands[0].handler();
      expect(result).toContain("No learned skills");
    });

    it("lists created skills", async () => {
      const create = skill.tools.find(
        (t) => t.function.name === "learn_create",
      ).execute;
      await create({
        name: "skill-a",
        description: "First test skill for listing",
        content: "Content A that is long enough to pass validation",
      });
      await create({
        name: "skill-b",
        description: "Second test skill for listing",
        content: "Content B that is long enough to pass validation",
      });

      const result = skill.commands[0].handler();
      expect(result).toContain("skill-a");
      expect(result).toContain("skill-b");
    });
  });
});

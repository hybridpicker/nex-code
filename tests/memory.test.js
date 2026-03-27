const fs = require("fs");
const path = require("path");
const os = require("os");

describe("memory.js", () => {
  let memory;
  let tmpDir;
  let globalDir;
  let nexMdPath;
  let globalNexMdPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-memory-"));
    globalDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-global-"));
    nexMdPath = path.join(tmpDir, "NEX.md");
    globalNexMdPath = path.join(globalDir, ".nex", "NEX.md");

    jest.resetModules();
    jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    jest.spyOn(os, "homedir").mockReturnValue(globalDir);

    memory = require("../cli/memory");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    if (fs.existsSync(globalDir)) fs.rmSync(globalDir, { recursive: true });
  });

  describe("remember()", () => {
    it("stores a key-value pair", () => {
      memory.remember("test-key", "test-value");
      expect(memory.recall("test-key")).toBe("test-value");
    });

    it("overwrites existing key", () => {
      memory.remember("key", "first");
      memory.remember("key", "second");
      expect(memory.recall("key")).toBe("second");
    });

    it("stores multiple keys", () => {
      memory.remember("a", "1");
      memory.remember("b", "2");
      memory.remember("c", "3");
      const list = memory.listMemories();
      expect(list.length).toBe(3);
    });

    it("creates memory directory if not exists", () => {
      const memDir = path.join(tmpDir, ".nex", "memory");
      expect(fs.existsSync(memDir)).toBe(false);
      memory.remember("first", "value");
      expect(fs.existsSync(memDir)).toBe(true);
    });
  });

  describe("recall()", () => {
    it("returns null for non-existent key", () => {
      expect(memory.recall("nope")).toBeNull();
    });

    it("returns stored value", () => {
      memory.remember("greeting", "hello world");
      expect(memory.recall("greeting")).toBe("hello world");
    });

    it("returns null when memory file does not exist", () => {
      expect(memory.recall("anything")).toBeNull();
    });

    it("returns null for corrupt memory file", () => {
      const memDir = path.join(tmpDir, ".nex", "memory");
      fs.mkdirSync(memDir, { recursive: true });
      fs.writeFileSync(
        path.join(memDir, "memory.json"),
        "{not valid json",
        "utf-8",
      );
      expect(memory.recall("key")).toBeNull();
    });
  });

  describe("forget()", () => {
    it("returns false for non-existent key", () => {
      memory.remember("a", "1");
      expect(memory.forget("nonexistent")).toBe(false);
    });

    it("deletes existing key", () => {
      memory.remember("temp", "value");
      expect(memory.forget("temp")).toBe(true);
      expect(memory.recall("temp")).toBeNull();
    });

    it("preserves other keys", () => {
      memory.remember("keep", "yes");
      memory.remember("delete", "no");
      memory.forget("delete");
      expect(memory.recall("keep")).toBe("yes");
    });

    it("returns false when no memory file exists", () => {
      expect(memory.forget("anything")).toBe(false);
    });
  });

  describe("listMemories()", () => {
    it("returns empty array when no memories", () => {
      expect(memory.listMemories()).toEqual([]);
    });

    it("returns all memories", () => {
      memory.remember("one", "1");
      memory.remember("two", "2");
      const list = memory.listMemories();
      expect(list.length).toBe(2);
      expect(list.map((m) => m.key)).toContain("one");
      expect(list.map((m) => m.key)).toContain("two");
    });

    it("includes value and updatedAt", () => {
      memory.remember("test", "val");
      const list = memory.listMemories();
      expect(list[0]).toHaveProperty("key", "test");
      expect(list[0]).toHaveProperty("value", "val");
      expect(list[0]).toHaveProperty("updatedAt");
    });
  });

  describe("loadGlobalInstructions()", () => {
    it("returns empty string when ~/.nex/NEX.md does not exist", () => {
      expect(memory.loadGlobalInstructions()).toBe("");
    });

    it("returns global NEX.md contents", () => {
      fs.mkdirSync(path.dirname(globalNexMdPath), { recursive: true });
      fs.writeFileSync(
        globalNexMdPath,
        "# Global Rules\nNo force push\n",
        "utf-8",
      );
      expect(memory.loadGlobalInstructions()).toContain("Global Rules");
    });

    it("trims whitespace", () => {
      fs.mkdirSync(path.dirname(globalNexMdPath), { recursive: true });
      fs.writeFileSync(globalNexMdPath, "  global rule  \n\n", "utf-8");
      expect(memory.loadGlobalInstructions()).toBe("global rule");
    });
  });

  describe("loadProjectInstructions()", () => {
    it("returns empty string when NEX.md does not exist", () => {
      expect(memory.loadProjectInstructions()).toBe("");
    });

    it("returns NEX.md contents", () => {
      fs.writeFileSync(
        nexMdPath,
        "# My Project\nUse yarn instead of npm\n",
        "utf-8",
      );
      expect(memory.loadProjectInstructions()).toContain("My Project");
    });

    it("trims whitespace", () => {
      fs.writeFileSync(nexMdPath, "  hello  \n\n", "utf-8");
      expect(memory.loadProjectInstructions()).toBe("hello");
    });
  });

  describe("getMemoryContext()", () => {
    it("returns empty string when no memories and no NEX.md", () => {
      expect(memory.getMemoryContext()).toBe("");
    });

    it("includes NEX.md content", () => {
      fs.writeFileSync(nexMdPath, "# Instructions\nBe helpful", "utf-8");
      const ctx = memory.getMemoryContext();
      expect(ctx).toContain("PROJECT INSTRUCTIONS");
      expect(ctx).toContain("Be helpful");
    });

    it("includes memories", () => {
      memory.remember("framework", "React");
      memory.remember("style", "functional");
      const ctx = memory.getMemoryContext();
      // After migration, memories appear in the MEMORY.md index
      expect(ctx).toContain("Project Memory Index");
      expect(ctx).toContain("framework");
      expect(ctx).toContain("style");
    });

    it("includes both NEX.md and memories", () => {
      fs.writeFileSync(nexMdPath, "Project rules here", "utf-8");
      memory.remember("lang", "TypeScript");
      const ctx = memory.getMemoryContext();
      expect(ctx).toContain("PROJECT INSTRUCTIONS");
      expect(ctx).toContain("Project Memory Index");
    });

    it("includes global NEX.md content", () => {
      fs.mkdirSync(path.dirname(globalNexMdPath), { recursive: true });
      fs.writeFileSync(globalNexMdPath, "# Global\nNo AI attribution", "utf-8");
      const ctx = memory.getMemoryContext();
      expect(ctx).toContain("GLOBAL INSTRUCTIONS");
      expect(ctx).toContain("No AI attribution");
    });

    it("includes global, project, and memories together", () => {
      fs.mkdirSync(path.dirname(globalNexMdPath), { recursive: true });
      fs.writeFileSync(globalNexMdPath, "Global rules", "utf-8");
      fs.writeFileSync(nexMdPath, "Project rules", "utf-8");
      memory.remember("lang", "JS");
      const ctx = memory.getMemoryContext();
      expect(ctx).toContain("GLOBAL INSTRUCTIONS");
      expect(ctx).toContain("PROJECT INSTRUCTIONS");
      expect(ctx).toContain("Project Memory Index");
    });

    it("global instructions appear before project instructions", () => {
      fs.mkdirSync(path.dirname(globalNexMdPath), { recursive: true });
      fs.writeFileSync(globalNexMdPath, "Global rules", "utf-8");
      fs.writeFileSync(nexMdPath, "Project rules", "utf-8");
      const ctx = memory.getMemoryContext();
      const globalIdx = ctx.indexOf("GLOBAL INSTRUCTIONS");
      const projectIdx = ctx.indexOf("PROJECT INSTRUCTIONS");
      expect(globalIdx).toBeLessThan(projectIdx);
    });
  });
});

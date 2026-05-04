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
      expect(ctx).toContain("ACTIVE MEMORY EXCERPTS");
      expect(ctx).toContain("React");
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

    it("never truncates NEX.md instructions", () => {
      // Write a large NEX.md (6000 chars) + memories
      const bigContent = "X".repeat(6000);
      fs.writeFileSync(nexMdPath, bigContent, "utf-8");
      memory.saveMemory(
        "project",
        "test-mem",
        "This is a test memory entry for truncation testing",
      );
      const ctx = memory.getMemoryContext();
      // NEX.md must be fully present
      expect(ctx).toContain(bigContent);
      // Memory hint must still appear
      expect(ctx).toContain("save_memory");
    });

    it("includes typed memory excerpts, not only the index", () => {
      memory.saveMemory(
        "project",
        "verification-rule",
        "After editing code, run the narrowest available test before claiming the task is complete.",
        "Coding completion rule",
      );

      const ctx = memory.getMemoryContext();

      expect(ctx).toContain("Project Memory Index");
      expect(ctx).toContain("ACTIVE MEMORY EXCERPTS");
      expect(ctx).toContain("verification-rule");
      expect(ctx).toContain("run the narrowest available test");
    });

    it("keeps memory excerpts inside the provided budget", () => {
      memory.saveMemory("project", "large-a", "A".repeat(900), "Large A");
      memory.saveMemory("project", "large-b", "B".repeat(900), "Large B");

      const section = memory._buildMemoryPromptSection(700);

      expect(section.length).toBeLessThanOrEqual(700);
      expect(section).toContain("Project Memory Index");
    });
  });

  describe("saveMemory()", () => {
    it("creates typed .md file with frontmatter", () => {
      const result = memory.saveMemory(
        "user",
        "test-pref",
        "Prefers dark mode",
      );
      expect(result.ok).toBe(true);
      expect(fs.existsSync(result.path)).toBe(true);
      const content = fs.readFileSync(result.path, "utf-8");
      expect(content).toContain("type: user");
      expect(content).toContain("Prefers dark mode");
    });

    it("rejects invalid type", () => {
      const result = memory.saveMemory("invalid", "x", "content here");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid type");
    });

    it("rejects content shorter than 5 chars", () => {
      const result = memory.saveMemory("user", "x", "ab");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("5 characters");
    });

    it("deduplicates identical content", () => {
      memory.saveMemory("project", "dup-test", "Exactly the same content here");
      const result = memory.saveMemory(
        "project",
        "dup-test",
        "Exactly the same content here",
      );
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(false);
    });

    it("updates when content changes", () => {
      memory.saveMemory("project", "change-test", "Original content value");
      const result = memory.saveMemory(
        "project",
        "change-test",
        "Updated content value now",
      );
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(true);
    });

    it("sanitizes name to safe slug", () => {
      const result = memory.saveMemory(
        "user",
        "My Cool Pref!",
        "Content for testing",
      );
      expect(result.ok).toBe(true);
      expect(result.path).toContain("my-cool-pref");
    });

    it("rebuilds MEMORY.md index after save", () => {
      memory.saveMemory("feedback", "idx-test", "Index rebuild test content");
      const index = memory.loadMemoryIndex();
      expect(index).toContain("idx-test");
    });
  });

  describe("deleteMemory()", () => {
    it("deletes existing memory", () => {
      memory.saveMemory("user", "del-target", "To be deleted soon enough");
      expect(memory.deleteMemory("user", "del-target")).toBe(true);
    });

    it("returns false for non-existent memory", () => {
      expect(memory.deleteMemory("user", "ghost-entry")).toBe(false);
    });

    it("updates index after deletion", () => {
      memory.saveMemory(
        "project",
        "will-delete",
        "Temporary memory for deletion test",
      );
      expect(memory.loadMemoryIndex()).toContain("will-delete");
      memory.deleteMemory("project", "will-delete");
      expect(memory.loadMemoryIndex()).not.toContain("will-delete");
    });
  });
});

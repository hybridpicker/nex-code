const {
  extractDefinitions,
  isIndexValid,
  searchIndex,
  getFileIndex,
  findFileInIndex,
  smartSearch,
  scorePathMatch,
  pathLevenshtein,
} = require("../cli/index-engine");

describe("Content Index", () => {
  describe("extractDefinitions", () => {
    test("extracts JS function declarations", () => {
      const code = "function hello() {}\nasync function world() {}";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({ type: "function", name: "hello", line: 1 });
      expect(defs).toContainEqual({ type: "function", name: "world", line: 2 });
    });

    test("extracts JS class declarations", () => {
      const code = "class Foo extends Bar {}";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({ type: "class", name: "Foo", line: 1 });
    });

    test("extracts arrow functions", () => {
      const code = "const greet = (name) => name;";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({ type: "function", name: "greet", line: 1 });
    });

    test("extracts Python functions", () => {
      const code = "def hello():\n    pass\nasync def world():\n    pass";
      const defs = extractDefinitions(code, ".py");
      expect(defs).toContainEqual({ type: "function", name: "hello", line: 1 });
      expect(defs).toContainEqual({ type: "function", name: "world", line: 3 });
    });

    test("extracts Go functions", () => {
      const code = "func main() {\n}\nfunc (s *Server) Start() {";
      const defs = extractDefinitions(code, ".go");
      expect(defs).toContainEqual({ type: "function", name: "main", line: 1 });
      expect(defs).toContainEqual({ type: "function", name: "Start", line: 3 });
    });

    test("extracts imports", () => {
      const code =
        "const fs = require('fs');\nconst { foo } = require('./bar');";
      const defs = extractDefinitions(code, ".js");
      expect(defs.filter((d) => d.type === "import")).toHaveLength(2);
    });

    test("returns empty for non-code files", () => {
      const defs = extractDefinitions("hello world", ".txt");
      expect(defs).toEqual([]);
    });

    // ─── Additional extractDefinitions patterns ─────────────
    test("extracts exported function declarations", () => {
      const code = "export function fetchData() {}";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({
        type: "function",
        name: "fetchData",
        line: 1,
      });
    });

    test("extracts exported async function declarations", () => {
      const code = "export async function loadData() {}";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({
        type: "function",
        name: "loadData",
        line: 1,
      });
    });

    test("extracts exported class declarations", () => {
      const code = "export class MyComponent {}";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({
        type: "class",
        name: "MyComponent",
        line: 1,
      });
    });

    test("extracts module.exports with multiple keys", () => {
      const code = "module.exports = { foo, bar, baz }";
      const defs = extractDefinitions(code, ".js");
      const exports = defs.filter((d) => d.type === "export");
      expect(exports).toHaveLength(3);
      expect(exports.map((e) => e.name)).toEqual(["foo", "bar", "baz"]);
    });

    test("extracts ES import from syntax", () => {
      const code = "import { useState } from 'react';";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({ type: "import", name: "react", line: 1 });
    });

    test("extracts let/var arrow functions", () => {
      const code = "let handler = (e) => e;\nvar process = async (x) => x;";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({
        type: "function",
        name: "handler",
        line: 1,
      });
      expect(defs).toContainEqual({
        type: "function",
        name: "process",
        line: 2,
      });
    });

    test("extracts async arrow functions", () => {
      const code = "const fetchItem = async (id) => { return id; };";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({
        type: "function",
        name: "fetchItem",
        line: 1,
      });
    });

    test("extracts Python class declarations", () => {
      const code = "class MyModel:\n    pass";
      const defs = extractDefinitions(code, ".py");
      expect(defs).toContainEqual({ type: "class", name: "MyModel", line: 1 });
    });

    test("extracts Python imports", () => {
      const code = "import os\nfrom pathlib import Path";
      const defs = extractDefinitions(code, ".py");
      expect(defs.filter((d) => d.type === "import")).toHaveLength(2);
    });

    test("extracts Go struct types", () => {
      const code = "type Config struct {";
      const defs = extractDefinitions(code, ".go");
      expect(defs).toContainEqual({ type: "class", name: "Config", line: 1 });
    });

    test("works with .tsx extension", () => {
      const code = "function App() {}\nclass Widget {}";
      const defs = extractDefinitions(code, ".tsx");
      expect(defs).toContainEqual({ type: "function", name: "App", line: 1 });
      expect(defs).toContainEqual({ type: "class", name: "Widget", line: 2 });
    });

    test("works with .mjs and .cjs extensions", () => {
      const code = "function helper() {}";
      expect(extractDefinitions(code, ".mjs")).toContainEqual({
        type: "function",
        name: "helper",
        line: 1,
      });
      expect(extractDefinitions(code, ".cjs")).toContainEqual({
        type: "function",
        name: "helper",
        line: 1,
      });
    });

    test("extracts module.exports with key:value pairs", () => {
      const code = "module.exports = { foo: bar, baz: qux }";
      const defs = extractDefinitions(code, ".js");
      const exports = defs.filter((d) => d.type === "export");
      expect(exports.map((e) => e.name)).toEqual(["foo", "baz"]);
    });

    test("extracts Python from-import", () => {
      const code = "from os.path import join";
      const defs = extractDefinitions(code, ".py");
      expect(defs).toContainEqual({ type: "import", name: "os.path", line: 1 });
    });

    test("extracts Go method receiver functions", () => {
      const code = "func (s *Server) Listen() {";
      const defs = extractDefinitions(code, ".go");
      expect(defs).toContainEqual({
        type: "function",
        name: "Listen",
        line: 1,
      });
    });

    test("handles empty content", () => {
      expect(extractDefinitions("", ".js")).toEqual([]);
    });

    test("ignores unsupported extensions like .rb, .java, .rs", () => {
      const code = "function hello() {}";
      expect(extractDefinitions(code, ".rb")).toEqual([]);
      expect(extractDefinitions(code, ".java")).toEqual([]);
      expect(extractDefinitions(code, ".rs")).toEqual([]);
    });

    test("works with .ts extension", () => {
      const code = "function greet(): void {}\nclass Service {}";
      const defs = extractDefinitions(code, ".ts");
      expect(defs).toContainEqual({ type: "function", name: "greet", line: 1 });
      expect(defs).toContainEqual({ type: "class", name: "Service", line: 2 });
    });

    test("works with .jsx extension", () => {
      const code = "function Component() {}";
      const defs = extractDefinitions(code, ".jsx");
      expect(defs).toContainEqual({
        type: "function",
        name: "Component",
        line: 1,
      });
    });

    test("extracts exported arrow with single param", () => {
      const code = "export const handler = x => x + 1;";
      const defs = extractDefinitions(code, ".js");
      expect(defs).toContainEqual({
        type: "function",
        name: "handler",
        line: 1,
      });
    });

    test("extracts Python async def", () => {
      const code = "async def fetch_data():\n    pass";
      const defs = extractDefinitions(code, ".py");
      expect(defs).toContainEqual({
        type: "function",
        name: "fetch_data",
        line: 1,
      });
    });

    test("extracts multiple definitions from multiline code", () => {
      const code = [
        "function alpha() {}",
        "class Beta {}",
        "const gamma = (x) => x;",
        "const path = require('path');",
        "module.exports = { alpha, gamma }",
      ].join("\n");
      const defs = extractDefinitions(code, ".js");
      expect(defs.filter((d) => d.type === "function")).toHaveLength(2);
      expect(defs.filter((d) => d.type === "class")).toHaveLength(1);
      expect(defs.filter((d) => d.type === "import")).toHaveLength(1);
      expect(defs.filter((d) => d.type === "export")).toHaveLength(2);
    });
  });

  // ─── isIndexValid ───────────────────────────────────────────
  describe("isIndexValid", () => {
    test("returns false when index is empty", () => {
      expect(isIndexValid("/some/path")).toBe(false);
    });
  });

  // ─── searchIndex ────────────────────────────────────────────
  describe("searchIndex", () => {
    test("returns empty array when index is empty", () => {
      expect(searchIndex("test")).toEqual([]);
    });
  });

  // ─── getFileIndex ───────────────────────────────────────────
  describe("getFileIndex", () => {
    test("returns an array", () => {
      expect(Array.isArray(getFileIndex())).toBe(true);
    });
  });

  // ─── findFileInIndex ────────────────────────────────────────
  describe("findFileInIndex", () => {
    test("returns empty when index is empty", () => {
      expect(findFileInIndex("nothere.js")).toEqual([]);
    });
  });

  // ─── buildContentIndex + searchContentIndex ────────────────
  describe("buildContentIndex + searchContentIndex", () => {
    const fs = require("fs");
    const path = require("path");
    const os = require("os");

    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-idx-"));
      jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
    });

    afterEach(() => {
      jest.restoreAllMocks();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test("buildContentIndex indexes JS files and searchContentIndex finds them", async () => {
      // Reset module to clear cached index state
      jest.resetModules();
      const ie = require("../cli/index-engine");

      // Create a JS file
      fs.writeFileSync(
        path.join(tmpDir, "app.js"),
        "function myFunction() {}\nclass MyClass {}",
      );
      // Build the file index first
      await ie.refreshIndex(tmpDir);
      // Build content index
      const index = await ie.buildContentIndex(tmpDir);
      expect(index.files["app.js"]).toBeDefined();
      expect(index.files["app.js"].defs).toContainEqual(
        expect.objectContaining({ type: "function", name: "myFunction" }),
      );

      // Search the content index
      const results = await ie.searchContentIndex("myFunction");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("myFunction");
    });

    test("searchContentIndex filters by type", async () => {
      jest.resetModules();
      const ie = require("../cli/index-engine");

      fs.writeFileSync(
        path.join(tmpDir, "lib.js"),
        "function foo() {}\nclass Foo {}",
      );
      await ie.refreshIndex(tmpDir);
      await ie.buildContentIndex(tmpDir);

      const funcs = await ie.searchContentIndex("foo", "function");
      expect(funcs.every((r) => r.type === "function")).toBe(true);
    });

    test("searchContentIndex sorts exact matches first", async () => {
      jest.resetModules();
      const ie = require("../cli/index-engine");

      fs.writeFileSync(
        path.join(tmpDir, "sort.js"),
        "function fooBar() {}\nfunction foo() {}",
      );
      await ie.refreshIndex(tmpDir);
      await ie.buildContentIndex(tmpDir);

      const results = await ie.searchContentIndex("foo");
      // Exact match 'foo' should come before 'fooBar'
      const fooIdx = results.findIndex((r) => r.name === "foo");
      const fooBarIdx = results.findIndex((r) => r.name === "fooBar");
      if (fooIdx >= 0 && fooBarIdx >= 0) {
        expect(fooIdx).toBeLessThan(fooBarIdx);
      }
    });
  });

  // ─── pathLevenshtein ──────────────────────────────────────────
  describe("pathLevenshtein", () => {
    test("returns 0 for identical strings", () => {
      expect(pathLevenshtein("hello", "hello")).toBe(0);
    });

    test("returns length of other string when one is empty", () => {
      expect(pathLevenshtein("", "abc")).toBe(3);
      expect(pathLevenshtein("abc", "")).toBe(3);
    });

    test("returns correct distance for single edits", () => {
      expect(pathLevenshtein("cat", "bat")).toBe(1); // substitution
      expect(pathLevenshtein("cat", "cats")).toBe(1); // insertion
      expect(pathLevenshtein("cats", "cat")).toBe(1); // deletion
    });

    test("returns correct distance for multiple edits", () => {
      expect(pathLevenshtein("kitten", "sitting")).toBe(3);
    });
  });

  // ─── scorePathMatch ─────────────────────────────────────────
  describe("scorePathMatch", () => {
    test("exact match returns 1000", () => {
      expect(scorePathMatch("src/app.js", "src/app.js")).toBe(1000);
    });

    test("case-insensitive exact match returns 1000", () => {
      expect(scorePathMatch("src/App.js", "src/app.js")).toBe(1000);
    });

    test("trailing segment match scores high", () => {
      // Query "components/Button.tsx" should strongly match "src/components/Button.tsx"
      const score = scorePathMatch("src/components/Button.tsx", "components/Button.tsx");
      expect(score).toBeGreaterThanOrEqual(500);
    });

    test("basename exact match scores well", () => {
      const score = scorePathMatch("app/views/index.html", "templates/index.html");
      expect(score).toBeGreaterThanOrEqual(80);
    });

    test("similar basename scores via Levenshtein", () => {
      // "Button.tsx" vs "Buttn.tsx" — typo
      const score = scorePathMatch("src/Button.tsx", "src/Buttn.tsx");
      expect(score).toBeGreaterThan(0);
    });

    test("completely different paths return 0", () => {
      const score = scorePathMatch("src/utils/math.js", "templates/layout.html");
      expect(score).toBe(0);
    });

    test("path segment overlap adds bonus", () => {
      const a = scorePathMatch("src/components/Button.tsx", "src/views/Button.tsx");
      const b = scorePathMatch("lib/widgets/Button.tsx", "src/views/Button.tsx");
      // "src" overlap should boost score of a
      expect(a).toBeGreaterThan(b);
    });

    test("substring containment adds bonus", () => {
      const score = scorePathMatch("src/components/Button.tsx", "Button.tsx");
      // "Button.tsx" is contained as basename
      expect(score).toBeGreaterThanOrEqual(80);
    });
  });

  // ─── smartSearch ──────────────────────────────────────────────
  describe("smartSearch", () => {
    test("returns empty when index is empty", () => {
      expect(smartSearch("test")).toEqual([]);
    });

    test("finds files with populated index", async () => {
      jest.resetModules();
      const ie = require("../cli/index-engine");
      const fs = require("fs");
      const path = require("path");
      const os = require("os");

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-smart-"));
      jest.spyOn(process, "cwd").mockReturnValue(tmpDir);

      // Create test files
      fs.mkdirSync(path.join(tmpDir, "src", "components"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "app", "views"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "components", "Button.tsx"), "");
      fs.writeFileSync(path.join(tmpDir, "src", "components", "Modal.tsx"), "");
      fs.writeFileSync(path.join(tmpDir, "app", "views", "index.html"), "");
      fs.writeFileSync(path.join(tmpDir, "app", "views", "Button.tsx"), "");

      await ie.refreshIndex(tmpDir);

      // Trailing segment match: "components/Button.tsx" → src/components/Button.tsx
      const res1 = ie.smartSearch("components/Button.tsx");
      expect(res1.length).toBeGreaterThan(0);
      expect(res1[0].file).toBe("src/components/Button.tsx");
      expect(res1[0].score).toBeGreaterThanOrEqual(500);

      // Basename match: "Button.tsx" → finds both Buttons
      const res2 = ie.smartSearch("Button.tsx");
      expect(res2.length).toBe(2);

      // Wrong parent: "views/Button.tsx" → app/views/Button.tsx
      const res3 = ie.smartSearch("views/Button.tsx");
      expect(res3.length).toBeGreaterThan(0);
      expect(res3[0].file).toBe("app/views/Button.tsx");

      jest.restoreAllMocks();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test("respects minScore threshold", async () => {
      jest.resetModules();
      const ie = require("../cli/index-engine");
      const fs = require("fs");
      const path = require("path");
      const os = require("os");

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-smart2-"));
      jest.spyOn(process, "cwd").mockReturnValue(tmpDir);

      fs.writeFileSync(path.join(tmpDir, "readme.md"), "");
      await ie.refreshIndex(tmpDir);

      // Completely unrelated search should return nothing with high minScore
      const results = ie.smartSearch("xyzzy_nonexistent.java", { minScore: 100 });
      expect(results).toEqual([]);

      jest.restoreAllMocks();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test("limits results", () => {
      const results = smartSearch("test", { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
});

const {
  extractDefinitions,
  isIndexValid,
  searchIndex,
  getFileIndex,
  findFileInIndex,
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
});

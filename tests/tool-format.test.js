/**
 * tests/tool-format.test.js — Tool Definition Format Validation
 * Verifies all TOOL_DEFINITIONS have valid JSON Schema structure.
 */

const { TOOL_DEFINITIONS } = require("../cli/tools");

describe("Tool Format Validation", () => {
  test("all tools have required structure", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.type).toBe("function");
      expect(tool.function).toBeDefined();
      expect(tool.function.name).toBeTruthy();
      expect(typeof tool.function.name).toBe("string");
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe("object");
      expect(tool.function.parameters.properties).toBeDefined();
      expect(tool.function.parameters.required).toBeDefined();
      expect(Array.isArray(tool.function.parameters.required)).toBe(true);
    }
  });

  test("all required fields exist in properties", () => {
    for (const tool of TOOL_DEFINITIONS) {
      const props = Object.keys(tool.function.parameters.properties);
      for (const req of tool.function.parameters.required) {
        expect(props).toContain(req);
      }
    }
  });

  test("no duplicate tool names", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.function.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test("tool names are valid identifiers (snake_case)", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.function.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  test("property types are valid JSON Schema types", () => {
    const validTypes = [
      "string",
      "number",
      "boolean",
      "object",
      "array",
      "integer",
      "null",
    ];
    for (const tool of TOOL_DEFINITIONS) {
      for (const [key, prop] of Object.entries(
        tool.function.parameters.properties,
      )) {
        if (prop.type) {
          expect(validTypes).toContain(prop.type);
        }
        // enum values should be arrays
        if (prop.enum) {
          expect(Array.isArray(prop.enum)).toBe(true);
        }
      }
    }
  });
});

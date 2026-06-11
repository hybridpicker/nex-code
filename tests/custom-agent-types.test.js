/**
 * tests/custom-agent-types.test.js — user-defined subagent types
 * loaded from .nex/agents/*.md
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  loadCustomAgentTypes,
  validateAgentTypes,
  _resetCustomAgentTypes,
  SUB_AGENT_TYPES,
} = require("../cli/sub-agent");

describe("custom agent types", () => {
  let tmpDir;

  function writeAgent(file, content) {
    fs.writeFileSync(path.join(tmpDir, ".nex", "agents", file), content);
  }

  beforeEach(() => {
    _resetCustomAgentTypes();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-agents-"));
    fs.mkdirSync(path.join(tmpDir, ".nex", "agents"), { recursive: true });
  });

  afterEach(() => {
    _resetCustomAgentTypes();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("loads a custom type with tool allowlist, suffix, and model", () => {
    writeAgent(
      "docs-writer.md",
      `---
name: docs-writer
description: Writes documentation only
tools: read_file, glob, grep, write_file
model: ollama:qwen3-vl:235b
---
You are a documentation agent. Only touch markdown files.`,
    );

    const types = loadCustomAgentTypes(tmpDir);
    expect(types["docs-writer"]).toBeDefined();
    expect(types["docs-writer"].custom).toBe(true);
    expect(types["docs-writer"].description).toBe("Writes documentation only");
    expect(types["docs-writer"].model).toBe("ollama:qwen3-vl:235b");
    expect(types["docs-writer"].systemSuffix).toContain("documentation agent");
    expect([...types["docs-writer"].allowedTools]).toEqual([
      "read_file",
      "glob",
      "grep",
      "write_file",
    ]);
  });

  test("tools: all grants full tool access (allowedTools null)", () => {
    writeAgent(
      "fixer.md",
      `---
name: fixer
tools: all
---
Fix bugs.`,
    );
    const types = loadCustomAgentTypes(tmpDir);
    expect(types.fixer.allowedTools).toBeNull();
  });

  test("name defaults to the file basename", () => {
    writeAgent(
      "security-auditor.md",
      `---
description: Security review
tools: read_file, grep
---
Audit for vulnerabilities.`,
    );
    const types = loadCustomAgentTypes(tmpDir);
    expect(types["security-auditor"]).toBeDefined();
  });

  test("built-in types cannot be overridden", () => {
    writeAgent(
      "evil.md",
      `---
name: review
tools: all
---
Now with write access.`,
    );
    const types = loadCustomAgentTypes(tmpDir);
    // The built-in review type stays read-only
    expect(types.review.custom).toBeUndefined();
    expect(types.review.allowedTools.has("write_file")).toBe(false);
  });

  test("missing .nex/agents directory is fine", () => {
    const types = loadCustomAgentTypes(
      fs.mkdtempSync(path.join(os.tmpdir(), "nex-empty-")),
    );
    expect(Object.keys(types)).toEqual(
      expect.arrayContaining(["explore", "review", "implement"]),
    );
  });

  test("validateAgentTypes accepts built-in and custom, rejects unknown", () => {
    writeAgent(
      "docs-writer.md",
      `---
name: docs-writer
tools: read_file
---
Docs.`,
    );
    loadCustomAgentTypes(tmpDir);

    expect(validateAgentTypes([{ task: "x", type: "explore" }])).toBeNull();
    expect(validateAgentTypes([{ task: "x", type: "docs-writer" }])).toBeNull();
    expect(validateAgentTypes([{ task: "x" }])).toBeNull(); // no type is fine

    const err = validateAgentTypes([{ task: "x", type: "nonexistent" }]);
    expect(err).toMatch(/^ERROR: Unknown agent type "nonexistent"/);
    expect(err).toContain("explore");
    expect(err).toContain("docs-writer");
  });

  test("_resetCustomAgentTypes removes custom types but keeps built-ins", () => {
    writeAgent("temp.md", `---\nname: temp\ntools: all\n---\nTemp.`);
    loadCustomAgentTypes(tmpDir);
    expect(SUB_AGENT_TYPES.temp).toBeDefined();
    _resetCustomAgentTypes();
    expect(SUB_AGENT_TYPES.temp).toBeUndefined();
    expect(SUB_AGENT_TYPES.explore).toBeDefined();
  });
});

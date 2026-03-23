/**
 * tests/file-tree.test.js
 * Tests for generateFileTree in context.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// generateFileTree uses sync fs directly — no need to mock child_process here
// But context.js also imports git/server-context — mock those deps
jest.mock("child_process", () => ({
  execSync: jest.fn(() => ""),
  exec: jest.fn(),
  execFile: jest.fn(),
  spawn: jest.fn(),
}));

const { generateFileTree } = require("../cli/context");

describe("generateFileTree()", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-tree-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("renders root directory name with trailing slash", () => {
    const tree = generateFileTree(tmpDir);
    const firstLine = tree.split("\n")[0];
    expect(firstLine).toMatch(/\/$/);
  });

  it("lists files at top level", () => {
    fs.writeFileSync(path.join(tmpDir, "index.js"), "");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "");
    const tree = generateFileTree(tmpDir);
    expect(tree).toContain("index.js");
    expect(tree).toContain("README.md");
  });

  it("lists subdirectories with trailing slash", () => {
    fs.mkdirSync(path.join(tmpDir, "cli"));
    fs.writeFileSync(path.join(tmpDir, "cli", "agent.js"), "");
    const tree = generateFileTree(tmpDir);
    expect(tree).toContain("cli/");
    expect(tree).toContain("agent.js");
  });

  it("excludes node_modules", () => {
    fs.mkdirSync(path.join(tmpDir, "node_modules"));
    fs.writeFileSync(path.join(tmpDir, "node_modules", "secret.js"), "");
    const tree = generateFileTree(tmpDir);
    expect(tree).not.toContain("node_modules");
    expect(tree).not.toContain("secret.js");
  });

  it("excludes .git directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".git"));
    const tree = generateFileTree(tmpDir);
    expect(tree).not.toContain(".git");
  });

  it("excludes hidden files (starting with dot)", () => {
    fs.writeFileSync(path.join(tmpDir, ".env"), "SECRET=123");
    const tree = generateFileTree(tmpDir);
    expect(tree).not.toContain(".env");
  });

  it("respects maxDepth", () => {
    fs.mkdirSync(path.join(tmpDir, "a"));
    fs.mkdirSync(path.join(tmpDir, "a", "b"));
    fs.mkdirSync(path.join(tmpDir, "a", "b", "c"));
    fs.writeFileSync(path.join(tmpDir, "a", "b", "c", "deep.js"), "");
    const tree = generateFileTree(tmpDir, { maxDepth: 2 });
    // depth 2 means only root → a → b; c and deep.js should not appear
    expect(tree).toContain("a/");
    expect(tree).toContain("b/");
    expect(tree).not.toContain("deep.js");
  });

  it("respects maxFiles cap", () => {
    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(path.join(tmpDir, `file${i}.js`), "");
    }
    const tree = generateFileTree(tmpDir, { maxFiles: 3 });
    // Should truncate after 3 entries
    expect(tree).toContain("truncated");
  });

  it("sorts directories before files", () => {
    fs.writeFileSync(path.join(tmpDir, "z-file.js"), "");
    fs.mkdirSync(path.join(tmpDir, "a-dir"));
    const tree = generateFileTree(tmpDir);
    const aIdx = tree.indexOf("a-dir/");
    const zIdx = tree.indexOf("z-file.js");
    expect(aIdx).toBeLessThan(zIdx);
  });

  it("respects .gitignore patterns", () => {
    fs.writeFileSync(path.join(tmpDir, ".gitignore"), "ignored.js\n");
    fs.writeFileSync(path.join(tmpDir, "ignored.js"), "");
    fs.writeFileSync(path.join(tmpDir, "kept.js"), "");
    const tree = generateFileTree(tmpDir);
    expect(tree).not.toContain("ignored.js");
    expect(tree).toContain("kept.js");
  });

  it("returns at least root line for empty directory", () => {
    const tree = generateFileTree(tmpDir);
    expect(tree.trim().length).toBeGreaterThan(0);
  });
});

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  getFixtureRootCandidates,
  resolveFixtureProjectRoot,
} = require("../scripts/benchmark-reallife-tasks");

describe("benchmark real-life task fixtures", () => {
  const originalFixturesDir = process.env.NEX_BENCHMARK_FIXTURES_DIR;

  afterEach(() => {
    if (originalFixturesDir === undefined) {
      delete process.env.NEX_BENCHMARK_FIXTURES_DIR;
    } else {
      process.env.NEX_BENCHMARK_FIXTURES_DIR = originalFixturesDir;
    }
  });

  it("prefers an explicit fixture directory override", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nex-bench-fixtures-"));
    const projectRoot = path.join(tempRoot, "demo-project");
    fs.mkdirSync(projectRoot, { recursive: true });
    process.env.NEX_BENCHMARK_FIXTURES_DIR = tempRoot;

    expect(resolveFixtureProjectRoot("demo-project")).toBe(projectRoot);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("includes repo fixtures before the live Coding fallback", () => {
    delete process.env.NEX_BENCHMARK_FIXTURES_DIR;
    const candidates = getFixtureRootCandidates();

    expect(candidates[0]).toContain(path.join("benchmark", "fixtures"));
    expect(candidates[candidates.length - 1]).toContain(path.join("Coding"));
  });

  it("resolves committed repo fixtures without relying on the Coding fallback", () => {
    delete process.env.NEX_BENCHMARK_FIXTURES_DIR;

    const resolved = resolveFixtureProjectRoot("practice-wizard");

    expect(resolved).toContain(path.join("benchmark", "fixtures", "practice-wizard"));
    expect(fs.existsSync(path.join(resolved, "DATABASE_README.md"))).toBe(true);
  });

  it("throws a clear error when a fixture project is missing", () => {
    process.env.NEX_BENCHMARK_FIXTURES_DIR = path.join(os.tmpdir(), "nex-missing-fixtures");

    expect(() => resolveFixtureProjectRoot("does-not-exist")).toThrow(
      /Missing benchmark fixture "does-not-exist"/,
    );
  });
});

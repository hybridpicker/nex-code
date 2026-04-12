const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  refreshIndex,
  buildContentIndex,
  getRelatedFiles,
  summarizeModuleHubs,
  findSymbolReferences,
} = require("../cli/index-engine");

describe("index-engine import graph helpers", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-index-"));
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "src", "util.js"),
      "function sharedUtil() {}\nmodule.exports = { sharedUtil };\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "src", "app.js"),
      "const { sharedUtil } = require('./util');\nfunction runApp() { return sharedUtil(); }\nmodule.exports = { runApp };\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "src", "feature.js"),
      "import { sharedUtil } from './util';\nexport function runFeature() { return sharedUtil(); }\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns imported and importing neighbors for a file", async () => {
    await refreshIndex(tmpDir);
    await buildContentIndex(tmpDir);

    const related = await getRelatedFiles("src/util.js", tmpDir, 4);
    expect(related).toContain("src/app.js");
    expect(related).toContain("src/feature.js");
  });

  it("summarizes the most connected module hubs", async () => {
    await refreshIndex(tmpDir);
    await buildContentIndex(tmpDir);

    const hubs = await summarizeModuleHubs(tmpDir, 3);
    expect(hubs[0]).toContain("src/util.js");
    expect(hubs[0]).toContain("links");
  });

  it("keeps content graph caches scoped per cwd", async () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-index-other-"));
    try {
      fs.mkdirSync(path.join(otherDir, "lib"), { recursive: true });
      fs.writeFileSync(
        path.join(otherDir, "lib", "core.js"),
        "export function core() {}\n",
      );

      await refreshIndex(tmpDir);
      await buildContentIndex(tmpDir);
      await refreshIndex(otherDir);
      await buildContentIndex(otherDir);

      const related = await getRelatedFiles("lib/core.js", otherDir, 3);
      expect(related).toEqual([]);
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });

  it("finds likely callers/usages for a symbol outside its definition file", async () => {
    await refreshIndex(tmpDir);
    await buildContentIndex(tmpDir);

    const refs = await findSymbolReferences("sharedUtil", tmpDir, {
      excludeFile: "src/util.js",
      limit: 4,
    });

    expect(refs.some((ref) => ref.file === "src/app.js")).toBe(true);
    expect(refs.some((ref) => ref.file === "src/feature.js")).toBe(true);
    expect(refs.every((ref) => ref.file !== "src/util.js")).toBe(true);
  });
});

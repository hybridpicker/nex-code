"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "nex-mw-"));
let homeSpy;

beforeAll(() => {
  homeSpy = jest.spyOn(os, "homedir").mockReturnValue(tmpHome);
});

afterAll(() => {
  homeSpy.mockRestore();
});

jest.mock("axios");
jest.mock("../cli/task-router", () => ({
  saveRoutingConfig: jest.fn(),
}));

const axios = require("axios");

// Require lazily so homedir mock is in place
let loadKnownModels, markBenchmarked, fetchCloudModels, findNewModels;
let generateBenchmarkBlock, updateReadme, updateModelsEnv, updateRoutingConfig;
let checkOrchestratorCandidate, updateOrchestratorModel, SENTINEL_START, SENTINEL_END;
let saveRoutingConfig;

beforeAll(() => {
  const mod = require("../cli/model-watcher");
  loadKnownModels = mod.loadKnownModels;
  markBenchmarked = mod.markBenchmarked;
  fetchCloudModels = mod.fetchCloudModels;
  findNewModels = mod.findNewModels;
  generateBenchmarkBlock = mod.generateBenchmarkBlock;
  updateReadme = mod.updateReadme;
  updateModelsEnv = mod.updateModelsEnv;
  updateRoutingConfig = mod.updateRoutingConfig;
  checkOrchestratorCandidate = mod.checkOrchestratorCandidate;
  updateOrchestratorModel = mod.updateOrchestratorModel;
  SENTINEL_START = mod.SENTINEL_START;
  SENTINEL_END = mod.SENTINEL_END;
  saveRoutingConfig = require("../cli/task-router").saveRoutingConfig;
});

const nexCodeDir = path.join(tmpHome, ".nex-code");

beforeEach(() => {
  // Ensure clean state
  if (fs.existsSync(nexCodeDir)) fs.rmSync(nexCodeDir, { recursive: true });
  fs.mkdirSync(nexCodeDir, { recursive: true });
  delete process.env.OLLAMA_API_KEY;
  saveRoutingConfig.mockClear();
});

afterAll(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("model-watcher.js", () => {
  // ─── Storage ────────────────────────────────────────────────────────
  describe("loadKnownModels()", () => {
    it("returns default when no file exists", () => {
      const result = loadKnownModels();
      expect(result).toEqual({ benchmarked: [], lastChecked: null });
    });

    it("reads existing known-models.json", () => {
      const data = { benchmarked: ["model-a"], lastChecked: "2026-01-01" };
      fs.writeFileSync(
        path.join(nexCodeDir, "known-models.json"),
        JSON.stringify(data),
      );
      expect(loadKnownModels()).toEqual(data);
    });

    it("returns default on corrupt JSON", () => {
      fs.writeFileSync(
        path.join(nexCodeDir, "known-models.json"),
        "bad json{{",
      );
      expect(loadKnownModels()).toEqual({ benchmarked: [], lastChecked: null });
    });
  });

  describe("markBenchmarked()", () => {
    it("adds models to benchmarked set", () => {
      markBenchmarked(["model-a", "model-b"]);
      const store = loadKnownModels();
      expect(store.benchmarked).toContain("model-a");
      expect(store.benchmarked).toContain("model-b");
      expect(store.lastChecked).toBeTruthy();
    });

    it("does not duplicate existing models", () => {
      markBenchmarked(["model-a"]);
      markBenchmarked(["model-a", "model-b"]);
      const store = loadKnownModels();
      expect(store.benchmarked.filter((m) => m === "model-a")).toHaveLength(1);
    });
  });

  // ─── Discovery ──────────────────────────────────────────────────────
  describe("fetchCloudModels()", () => {
    it("throws when OLLAMA_API_KEY is not set", async () => {
      await expect(fetchCloudModels()).rejects.toThrow("OLLAMA_API_KEY not set");
    });

    it("fetches and returns model names", async () => {
      process.env.OLLAMA_API_KEY = "test_dummy_not_real";
      axios.get.mockResolvedValue({
        data: {
          models: [
            { name: "model-a:latest" },
            { name: "model-b" },
            { model: "model-c" },
          ],
        },
      });
      const models = await fetchCloudModels();
      expect(models).toContain("model-a");
      expect(models).toContain("model-b");
      expect(models).toContain("model-c");
    });

    it("strips :latest suffix", async () => {
      process.env.OLLAMA_API_KEY = "test_dummy_not_real";
      axios.get.mockResolvedValue({
        data: { models: [{ name: "my-model:latest" }] },
      });
      const models = await fetchCloudModels();
      expect(models).toContain("my-model");
      expect(models).not.toContain("my-model:latest");
    });
  });

  describe("findNewModels()", () => {
    it("returns only unbenchmarked models", async () => {
      process.env.OLLAMA_API_KEY = "test_dummy_not_real";
      axios.get.mockResolvedValue({
        data: { models: [{ name: "model-a" }, { name: "model-b" }, { name: "model-c" }] },
      });
      markBenchmarked(["model-a"]);
      const { newModels, allCloud } = await findNewModels();
      expect(allCloud).toHaveLength(3);
      expect(newModels).toEqual(["model-b", "model-c"]);
    });
  });

  // ─── generateBenchmarkBlock ─────────────────────────────────────────
  describe("generateBenchmarkBlock()", () => {
    it("generates valid markdown with sentinels", () => {
      const summary = [
        { model: "devstral-2:123b", score: 85, avgLatency: 3000 },
        { model: "kimi-k2.5", score: 80, avgLatency: 5000 },
      ];
      const block = generateBenchmarkBlock(summary, "2026-03-26");
      expect(block).toContain(SENTINEL_START);
      expect(block).toContain(SENTINEL_END);
      expect(block).toContain("devstral-2:123b");
      expect(block).toContain("kimi-k2.5");
      expect(block).toContain("3.0s");
      expect(block).toContain("5.0s");
    });

    it("assigns medals to top 3", () => {
      const summary = [
        { model: "a", score: 90, avgLatency: 1000 },
        { model: "b", score: 85, avgLatency: 2000 },
        { model: "c", score: 80, avgLatency: 3000 },
        { model: "d", score: 75, avgLatency: 4000 },
      ];
      const block = generateBenchmarkBlock(summary);
      expect(block).toContain("\u{1F947}"); // gold
      expect(block).toContain("\u{1F948}"); // silver
      expect(block).toContain("\u{1F949}"); // bronze
    });

    it("filters models below TABLE_MIN_SCORE (60)", () => {
      const summary = [
        { model: "good", score: 70, avgLatency: 1000 },
        { model: "bad", score: 50, avgLatency: 1000 },
      ];
      const block = generateBenchmarkBlock(summary);
      expect(block).toContain("good");
      expect(block).not.toContain("bad");
    });

    it("bolds the winner score", () => {
      const summary = [{ model: "winner", score: 90, avgLatency: 1000 }];
      const block = generateBenchmarkBlock(summary);
      expect(block).toContain("**90**");
    });
  });

  // ─── updateReadme ──────────────────────────────────────────────────
  describe("updateReadme()", () => {
    it("replaces benchmark block between sentinels", () => {
      const readmePath = path.join(tmpHome, "README.md");
      fs.writeFileSync(
        readmePath,
        `# Title\n\n${SENTINEL_START}\nold content\n${SENTINEL_END}\n\n# Footer`,
      );
      const summary = [{ model: "new-model", score: 90, avgLatency: 2000 }];
      const result = updateReadme(summary, readmePath);
      expect(result).toBe(true);
      const content = fs.readFileSync(readmePath, "utf-8");
      expect(content).toContain("new-model");
      expect(content).not.toContain("old content");
      expect(content).toContain("# Footer");
    });

    it("returns false when sentinels missing", () => {
      const readmePath = path.join(tmpHome, "README-no-sentinel.md");
      fs.writeFileSync(readmePath, "# No sentinels here\n");
      expect(updateReadme([], readmePath)).toBe(false);
    });

    it("returns false when file does not exist", () => {
      expect(updateReadme([], "/nonexistent/path.md")).toBe(false);
    });
  });

  // ─── updateModelsEnv ───────────────────────────────────────────────
  describe("updateModelsEnv()", () => {
    const envPath = path.join(tmpHome, ".nex-code", "models.env");

    it("returns not updated when no models.env", () => {
      const result = updateModelsEnv([{ model: "winner", score: 90 }]);
      expect(result.updated).toBe(false);
    });

    it("returns not updated when winner unchanged", () => {
      fs.writeFileSync(
        envPath,
        "DEFAULT_MODEL=winner\n# Last reviewed: 2026-03-01",
      );
      const result = updateModelsEnv([
        { model: "winner", score: 90 },
        { model: "loser", score: 80 },
      ]);
      expect(result.updated).toBe(false);
      expect(result.reason).toContain("unchanged");
    });

    it("returns not updated when margin < 5pts", () => {
      fs.writeFileSync(
        envPath,
        "DEFAULT_MODEL=current\n# Last reviewed: 2026-03-01",
      );
      const result = updateModelsEnv([
        { model: "new-winner", score: 83 },
        { model: "current", score: 80 },
      ]);
      expect(result.updated).toBe(false);
      expect(result.reason).toContain("margin");
    });

    it("updates when margin >= 5pts", () => {
      fs.writeFileSync(
        envPath,
        "DEFAULT_MODEL=old-model\n# Last reviewed: 2026-03-01",
      );
      const result = updateModelsEnv([
        { model: "new-winner", score: 90 },
        { model: "old-model", score: 80 },
      ]);
      expect(result.updated).toBe(true);
      expect(result.newModel).toBe("new-winner");
      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("DEFAULT_MODEL=new-winner");
    });
  });

  // ─── updateRoutingConfig ───────────────────────────────────────────
  describe("updateRoutingConfig()", () => {
    it("skips when all scores are 0", () => {
      const result = updateRoutingConfig({ coding: { model: "a", score: 0 } });
      expect(result.saved).toBe(false);
    });

    it("saves routing config and updates models.env", () => {
      const envPath = path.join(tmpHome, ".nex-code", "models.env");
      fs.writeFileSync(envPath, "# routing config\n");

      const winners = {
        coding: { model: "code-model", score: 85 },
        frontend: { model: "frontend-model", score: 80 },
      };
      const result = updateRoutingConfig(winners);
      expect(result.saved).toBe(true);
      expect(result.envUpdated).toBe(true);
      expect(saveRoutingConfig).toHaveBeenCalledWith({
        coding: "code-model",
        frontend: "frontend-model",
      });
    });

    it("appends routing block when not present", () => {
      const envPath = path.join(tmpHome, ".nex-code", "models.env");
      fs.writeFileSync(envPath, "DEFAULT_MODEL=test\n");

      updateRoutingConfig({ coding: { model: "x", score: 90 } });
      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("NEX_ROUTE_CODING=x");
      expect(content).toContain("# ── Task-type routing");
    });

    it("replaces existing routing block", () => {
      const envPath = path.join(tmpHome, ".nex-code", "models.env");
      fs.writeFileSync(
        envPath,
        "DEFAULT_MODEL=test\n# ── Task-type routing (auto-updated by /benchmark) ──\nNEX_ROUTE_CODING=old\n# ── end routing ──\n",
      );

      updateRoutingConfig({ coding: { model: "new", score: 90 } });
      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("NEX_ROUTE_CODING=new");
      expect(content).not.toContain("NEX_ROUTE_CODING=old");
    });
  });

  // ─── checkOrchestratorCandidate ────────────────────────────────────
  describe("checkOrchestratorCandidate()", () => {
    it.each(["kimi-thinking", "reasoning-v2", "planner-3b", "orchestrator-xl"])(
      "detects reasoning model: %s",
      (name) => {
        expect(checkOrchestratorCandidate(name)).toBe(true);
      },
    );

    it.each(["devstral-2:123b", "qwen3-coder:480b", "minimax-m2.7:cloud"])(
      "rejects non-reasoning model: %s",
      (name) => {
        expect(checkOrchestratorCandidate(name)).toBe(false);
      },
    );
  });

  // ─── updateOrchestratorModel ───────────────────────────────────────
  describe("updateOrchestratorModel()", () => {
    const envPath = path.join(tmpHome, ".nex-code", "models.env");

    it("returns not updated for empty results", () => {
      expect(updateOrchestratorModel([])).toEqual({ updated: false });
      expect(updateOrchestratorModel(null)).toEqual({ updated: false });
    });

    it("returns not updated when no models.env", () => {
      if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
      expect(
        updateOrchestratorModel([{ model: "a", overall: 9 }]),
      ).toEqual({ updated: false });
    });

    it("promotes new winner with >5% margin", () => {
      fs.writeFileSync(envPath, "NEX_ORCHESTRATOR_MODEL=old-model\n");
      const result = updateOrchestratorModel([
        { model: "new-model", overall: 9 },
        { model: "old-model", overall: 7 },
      ]);
      expect(result.updated).toBe(true);
      expect(result.newModel).toBe("new-model");
      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("NEX_ORCHESTRATOR_MODEL=new-model");
    });

    it("does not promote when margin < 5%", () => {
      fs.writeFileSync(envPath, "NEX_ORCHESTRATOR_MODEL=current\n");
      const result = updateOrchestratorModel([
        { model: "new-model", overall: 8.3 },
        { model: "current", overall: 8.0 },
      ]);
      expect(result.updated).toBe(false);
    });

    it("does not update when same model is best", () => {
      fs.writeFileSync(envPath, "NEX_ORCHESTRATOR_MODEL=same\n");
      const result = updateOrchestratorModel([
        { model: "same", overall: 9 },
      ]);
      expect(result.updated).toBe(false);
    });

    it("appends line when NEX_ORCHESTRATOR_MODEL is absent", () => {
      fs.writeFileSync(envPath, "DEFAULT_MODEL=test\n");
      const result = updateOrchestratorModel([
        { model: "new-orch", overall: 9 },
      ]);
      expect(result.updated).toBe(true);
      const content = fs.readFileSync(envPath, "utf-8");
      expect(content).toContain("NEX_ORCHESTRATOR_MODEL=new-orch");
    });
  });
});

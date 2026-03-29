"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "nex-tr-"));
let homeSpy;

beforeAll(() => {
  homeSpy = jest.spyOn(os, "homedir").mockReturnValue(tmpHome);
});

afterAll(() => {
  homeSpy.mockRestore();
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

// Require AFTER spy is set up (module reads homedir at load time)
let CATEGORIES, DETECTION_ORDER, detectCategory, getModelForCategory;
let saveRoutingConfig, loadRoutingConfig, ROUTING_CONFIG_PATH;
let getModelForPhase, getPhaseBudget, isPhaseRoutingEnabled, DEFAULT_PHASE_BUDGETS;

beforeAll(() => {
  const mod = require("../cli/task-router");
  CATEGORIES = mod.CATEGORIES;
  DETECTION_ORDER = mod.DETECTION_ORDER;
  detectCategory = mod.detectCategory;
  getModelForCategory = mod.getModelForCategory;
  saveRoutingConfig = mod.saveRoutingConfig;
  loadRoutingConfig = mod.loadRoutingConfig;
  ROUTING_CONFIG_PATH = mod.ROUTING_CONFIG_PATH;
  getModelForPhase = mod.getModelForPhase;
  getPhaseBudget = mod.getPhaseBudget;
  isPhaseRoutingEnabled = mod.isPhaseRoutingEnabled;
  DEFAULT_PHASE_BUDGETS = mod.DEFAULT_PHASE_BUDGETS;
});

describe("task-router.js", () => {
  // ─── CATEGORIES structure ─────────────────────────────────────────
  describe("CATEGORIES", () => {
    it("has all expected categories", () => {
      expect(Object.keys(CATEGORIES)).toEqual(
        expect.arrayContaining([
          "frontend",
          "sysadmin",
          "data",
          "agentic",
          "coding",
        ]),
      );
    });

    it("each category has id, label, icon, envVar", () => {
      for (const [key, cat] of Object.entries(CATEGORIES)) {
        expect(cat.id).toBe(key);
        expect(typeof cat.label).toBe("string");
        expect(typeof cat.icon).toBe("string");
        expect(typeof cat.envVar).toBe("string");
      }
    });

    it("coding has null pattern (fallback)", () => {
      expect(CATEGORIES.coding.pattern).toBeNull();
    });
  });

  // ─── DETECTION_ORDER ──────────────────────────────────────────────
  describe("DETECTION_ORDER", () => {
    it("ends with coding", () => {
      expect(DETECTION_ORDER[DETECTION_ORDER.length - 1]).toBe("coding");
    });

    it("agentic is checked before frontend", () => {
      expect(DETECTION_ORDER.indexOf("agentic")).toBeLessThan(
        DETECTION_ORDER.indexOf("frontend"),
      );
    });
  });

  // ─── detectCategory ───────────────────────────────────────────────
  describe("detectCategory()", () => {
    it("returns null for short input (<8 chars)", () => {
      expect(detectCategory("hi")).toBeNull();
      expect(detectCategory("")).toBeNull();
      expect(detectCategory(null)).toBeNull();
    });

    // Frontend
    it.each([
      "Add a React component for the sidebar",
      "Fix the CSS animation on the navbar",
      "Create a new Vue component",
      "Update the Tailwind styles",
      "Fix the JSX rendering issue",
      "Build a responsive landing page",
    ])("detects frontend: %s", (input) => {
      expect(detectCategory(input).id).toBe("frontend");
    });

    // Sysadmin
    it.each([
      "Configure nginx reverse proxy",
      "Fix the Docker container startup",
      "Update the Kubernetes deployment",
      "Set up the CI/CD pipeline",
      "Configure the firewall rules",
      "Fix the systemd daemon",
    ])("detects sysadmin: %s", (input) => {
      expect(detectCategory(input).id).toBe("sysadmin");
    });

    // Data
    it.each([
      "Write a SQL query to join users and orders",
      "Fix the PostgreSQL migration",
      "Update the MongoDB schema",
      "Create a new database migration",
      "Fix the Redis cache invalidation",
      "Optimize the aggregate query",
    ])("detects data: %s", (input) => {
      expect(detectCategory(input).id).toBe("data");
    });

    // Agentic
    it.each([
      "Spawn agent swarm to fix all bugs",
      "Use multi-agent approach for this refactor",
      "Use a multi-agent approach to fix both modules",
      "Delegate to sub-agent for code review",
    ])("detects agentic: %s", (input) => {
      expect(detectCategory(input).id).toBe("agentic");
    });

    // Coding fallback
    it.each([
      "Refactor the auth module",
      "Add unit tests for the parser",
      "Fix the memory leak in worker.js",
    ])("falls back to coding: %s", (input) => {
      expect(detectCategory(input).id).toBe("coding");
    });
  });

  // ─── loadRoutingConfig / saveRoutingConfig ────────────────────────
  describe("routing config persistence", () => {
    it("returns empty object when no config exists", () => {
      expect(loadRoutingConfig()).toEqual({});
    });

    it("saves and loads routing config", () => {
      const config = { frontend: "model-a", coding: "model-b" };
      saveRoutingConfig(config);
      expect(loadRoutingConfig()).toEqual(config);
    });

    it("creates directory if it does not exist", () => {
      const dir = path.dirname(ROUTING_CONFIG_PATH);
      fs.rmSync(dir, { recursive: true, force: true });
      saveRoutingConfig({ test: "model-x" });
      expect(fs.existsSync(ROUTING_CONFIG_PATH)).toBe(true);
    });

    it("returns empty object on corrupt JSON", () => {
      fs.writeFileSync(ROUTING_CONFIG_PATH, "not json{{{");
      expect(loadRoutingConfig()).toEqual({});
    });
  });

  // ─── getModelForCategory ──────────────────────────────────────────
  describe("getModelForCategory()", () => {
    beforeEach(() => {
      // Clean env and config
      delete process.env.NEX_ROUTE_FRONTEND;
      delete process.env.NEX_ROUTE_SYSADMIN;
      delete process.env.NEX_ROUTE_CODING;
      const dir = path.dirname(ROUTING_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ROUTING_CONFIG_PATH, "{}");
    });

    it("returns null when no config or env var", () => {
      expect(getModelForCategory("frontend")).toBeNull();
    });

    it("returns env var over config", () => {
      saveRoutingConfig({ frontend: "config-model" });
      process.env.NEX_ROUTE_FRONTEND = "env-model";
      expect(getModelForCategory("frontend")).toBe("env-model");
      delete process.env.NEX_ROUTE_FRONTEND;
    });

    it("returns config value when no env var", () => {
      saveRoutingConfig({ sysadmin: "sysadmin-model" });
      expect(getModelForCategory("sysadmin")).toBe("sysadmin-model");
    });

    it("returns null for unknown category", () => {
      expect(getModelForCategory("unknown")).toBeNull();
    });
  });

  // ─── getModelForPhase ─────────────────────────────────────────────
  describe("getModelForPhase()", () => {
    let registryMock;

    beforeEach(() => {
      delete process.env.NEX_PHASE_ROUTING;
      const dir = path.dirname(ROUTING_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ROUTING_CONFIG_PATH, "{}");
      try {
        registryMock = jest.spyOn(
          require("../cli/providers/registry"),
          "getActiveProviderName",
        );
        registryMock.mockReturnValue("openai");
      } catch {
        registryMock = null;
      }
    });

    afterEach(() => {
      delete process.env.NEX_PHASE_ROUTING;
      if (registryMock) registryMock.mockRestore();
    });

    it("returns phase model when phases config exists", () => {
      saveRoutingConfig({
        coding: "default-model",
        phases: { plan: "plan-model", implement: "impl-model", verify: "verify-model" },
      });
      expect(getModelForPhase("plan", "coding")).toBe("plan-model");
      expect(getModelForPhase("implement", "coding")).toBe("impl-model");
      expect(getModelForPhase("verify", "coding")).toBe("verify-model");
    });

    it("falls back to category model when phase not configured", () => {
      saveRoutingConfig({ coding: "category-model" });
      expect(getModelForPhase("plan", "coding")).toBe("category-model");
    });

    it("returns null when neither phase nor category configured", () => {
      expect(getModelForPhase("plan", "coding")).toBeNull();
    });

    it("returns null when no categoryId and no phase config", () => {
      expect(getModelForPhase("plan")).toBeNull();
    });

    it("uses builtin defaults when provider is ollama", () => {
      if (registryMock) registryMock.mockReturnValue("ollama");
      expect(getModelForPhase("plan", "coding")).toBe("qwen3-coder:480b");
      expect(getModelForPhase("verify", "coding")).toBe("devstral-small-2:24b");
    });

    it("uses builtin defaults when NEX_PHASE_ROUTING=1", () => {
      process.env.NEX_PHASE_ROUTING = "1";
      expect(getModelForPhase("plan", "coding")).toBe("qwen3-coder:480b");
      expect(getModelForPhase("verify", "coding")).toBe("devstral-small-2:24b");
      delete process.env.NEX_PHASE_ROUTING;
    });

    it("explicit config overrides builtin defaults", () => {
      if (registryMock) registryMock.mockReturnValue("ollama");
      saveRoutingConfig({ phases: { plan: "custom-plan-model" } });
      expect(getModelForPhase("plan", "coding")).toBe("custom-plan-model");
    });
  });

  // ─── getPhaseBudget ───────────────────────────────────────────────
  describe("getPhaseBudget()", () => {
    beforeEach(() => {
      const dir = path.dirname(ROUTING_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ROUTING_CONFIG_PATH, "{}");
    });

    it("returns default budgets when not configured", () => {
      expect(getPhaseBudget("plan")).toBe(DEFAULT_PHASE_BUDGETS.plan);
      expect(getPhaseBudget("implement")).toBe(DEFAULT_PHASE_BUDGETS.implement);
      expect(getPhaseBudget("verify")).toBe(DEFAULT_PHASE_BUDGETS.verify);
    });

    it("returns custom budgets from config", () => {
      saveRoutingConfig({ phaseBudgets: { plan: 5, implement: 50, verify: 12 } });
      expect(getPhaseBudget("plan")).toBe(5);
      expect(getPhaseBudget("implement")).toBe(50);
      expect(getPhaseBudget("verify")).toBe(12);
    });

    it("returns 20 for unknown phase", () => {
      expect(getPhaseBudget("unknown")).toBe(20);
    });
  });

  // ─── isPhaseRoutingEnabled ────────────────────────────────────────
  describe("isPhaseRoutingEnabled()", () => {
    let registryMock;

    beforeEach(() => {
      delete process.env.NEX_PHASE_ROUTING;
      const dir = path.dirname(ROUTING_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ROUTING_CONFIG_PATH, "{}");
      try {
        registryMock = jest.spyOn(
          require("../cli/providers/registry"),
          "getActiveProviderName",
        );
      } catch {
        registryMock = null;
      }
    });

    afterEach(() => {
      delete process.env.NEX_PHASE_ROUTING;
      if (registryMock) registryMock.mockRestore();
    });

    it("returns false when no phases config and provider is not ollama", () => {
      if (registryMock) registryMock.mockReturnValue("openai");
      expect(isPhaseRoutingEnabled()).toBe(false);
    });

    it("returns false when phases is empty object and provider is not ollama", () => {
      if (registryMock) registryMock.mockReturnValue("openai");
      saveRoutingConfig({ phases: {} });
      expect(isPhaseRoutingEnabled()).toBe(false);
    });

    it("returns true when phases has entries", () => {
      if (registryMock) registryMock.mockReturnValue("openai");
      saveRoutingConfig({ phases: { plan: "model-a" } });
      expect(isPhaseRoutingEnabled()).toBe(true);
    });

    it("auto-enables when provider is ollama", () => {
      if (registryMock) registryMock.mockReturnValue("ollama");
      expect(isPhaseRoutingEnabled()).toBe(true);
    });

    it("returns true when NEX_PHASE_ROUTING=1", () => {
      if (registryMock) registryMock.mockReturnValue("openai");
      process.env.NEX_PHASE_ROUTING = "1";
      expect(isPhaseRoutingEnabled()).toBe(true);
    });

    it("returns false when NEX_PHASE_ROUTING=0 even with phases config", () => {
      process.env.NEX_PHASE_ROUTING = "0";
      saveRoutingConfig({ phases: { plan: "model-a" } });
      expect(isPhaseRoutingEnabled()).toBe(false);
    });

    it("returns false when NEX_PHASE_ROUTING=0 even with ollama provider", () => {
      if (registryMock) registryMock.mockReturnValue("ollama");
      process.env.NEX_PHASE_ROUTING = "0";
      expect(isPhaseRoutingEnabled()).toBe(false);
    });
  });

  // ─── saveRoutingConfig preserves nested keys ──────────────────────
  describe("saveRoutingConfig() nested key preservation", () => {
    beforeEach(() => {
      const dir = path.dirname(ROUTING_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(ROUTING_CONFIG_PATH, "{}");
    });

    it("preserves existing phases when saving category-only update", () => {
      saveRoutingConfig({
        coding: "model-a",
        phases: { plan: "plan-model" },
      });
      saveRoutingConfig({ coding: "model-b" });
      const config = loadRoutingConfig();
      expect(config.coding).toBe("model-b");
      expect(config.phases.plan).toBe("plan-model");
    });

    it("preserves existing phaseBudgets when saving category-only update", () => {
      saveRoutingConfig({
        coding: "model-a",
        phaseBudgets: { plan: 15 },
      });
      saveRoutingConfig({ coding: "model-c" });
      const config = loadRoutingConfig();
      expect(config.coding).toBe("model-c");
      expect(config.phaseBudgets.plan).toBe(15);
    });

    it("overwrites phases when explicitly provided", () => {
      saveRoutingConfig({
        phases: { plan: "old-model" },
      });
      saveRoutingConfig({
        phases: { plan: "new-model", verify: "verify-model" },
      });
      const config = loadRoutingConfig();
      expect(config.phases.plan).toBe("new-model");
      expect(config.phases.verify).toBe("verify-model");
    });
  });
});

const path = require("path");

describe("feature-flags.js", () => {
  let ff;

  beforeEach(() => {
    jest.resetModules();
    // Clean env vars before each test
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("NEX_FEATURE_")) delete process.env[key];
    }
    ff = require("../cli/feature-flags");
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("NEX_FEATURE_")) delete process.env[key];
    }
  });

  describe("feature()", () => {
    it("returns default value for known flags", () => {
      // DREAM_CONSOLIDATION defaults to true
      expect(ff.feature("DREAM_CONSOLIDATION")).toBe(true);
      // WATCH_MODE defaults to false
      expect(ff.feature("WATCH_MODE")).toBe(false);
    });

    it("returns false for unknown flags", () => {
      expect(ff.feature("NONEXISTENT_FLAG")).toBe(false);
    });
  });

  describe("environment variable override", () => {
    it("enables a flag via env var", () => {
      process.env.NEX_FEATURE_WATCH_MODE = "1";
      jest.resetModules();
      const ff2 = require("../cli/feature-flags");
      expect(ff2.feature("WATCH_MODE")).toBe(true);
    });

    it("disables a flag via env var", () => {
      process.env.NEX_FEATURE_DREAM_CONSOLIDATION = "0";
      jest.resetModules();
      const ff2 = require("../cli/feature-flags");
      expect(ff2.feature("DREAM_CONSOLIDATION")).toBe(false);
    });

    it("supports string true/false", () => {
      process.env.NEX_FEATURE_WATCH_MODE = "true";
      jest.resetModules();
      const ff2 = require("../cli/feature-flags");
      expect(ff2.feature("WATCH_MODE")).toBe(true);
    });
  });

  describe("listFeatureFlags()", () => {
    it("returns all registered flags", () => {
      const flags = ff.listFeatureFlags();
      expect(flags.length).toBeGreaterThan(0);
      expect(flags.every((f) => f.name && typeof f.enabled === "boolean" && f.description)).toBe(true);
    });

    it("includes known flags", () => {
      const flags = ff.listFeatureFlags();
      const names = flags.map((f) => f.name);
      expect(names).toContain("WATCH_MODE");
      expect(names).toContain("DREAM_CONSOLIDATION");
      expect(names).toContain("PRIORITY_WAVES");
      expect(names).toContain("PROMPT_CACHE_SPLIT");
    });
  });

  describe("getBuildDefines()", () => {
    it("generates esbuild define entries", () => {
      const defines = ff.getBuildDefines();
      expect(defines.__FEATURE_WATCH_MODE__).toBe("false");
      expect(defines.__FEATURE_DREAM_CONSOLIDATION__).toBe("true");
    });

    it("accepts overrides", () => {
      const defines = ff.getBuildDefines({ WATCH_MODE: true });
      expect(defines.__FEATURE_WATCH_MODE__).toBe("true");
    });

    it("generates entries for all flags", () => {
      const defines = ff.getBuildDefines();
      const keys = Object.keys(defines);
      expect(keys.length).toBe(Object.keys(ff.FLAG_DEFINITIONS).length);
      expect(keys.every((k) => k.startsWith("__FEATURE_") && k.endsWith("__"))).toBe(true);
    });
  });

  describe("FLAG_DEFINITIONS", () => {
    it("all flags have description and default", () => {
      for (const [name, def] of Object.entries(ff.FLAG_DEFINITIONS)) {
        expect(typeof def.description).toBe("string");
        expect(def.description.length).toBeGreaterThan(0);
        expect(typeof def.default).toBe("boolean");
      }
    });
  });
});

const { getModelProfile, PROFILES, DEFAULTS } = require("../cli/model-profiles");

describe("model-profiles.js", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    // Clear stale ENV overrides so profile defaults are tested
    delete process.env.NEX_STALE_WARN_MS;
    delete process.env.NEX_STALE_ABORT_MS;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe("getModelProfile()", () => {
    it("returns devstral-2 profile for full model ID", () => {
      const p = getModelProfile("devstral-2:123b");
      expect(p.staleWarn).toBe(30000);
      expect(p.staleAbort).toBe(90000);
      expect(p.investigationCap).toBe(12);
      expect(p.postEditCap).toBe(10);
    });

    it("returns devstral-small profile", () => {
      const p = getModelProfile("devstral-small-2:24b");
      expect(p.staleWarn).toBe(20000);
      expect(p.investigationCap).toBe(10);
    });

    it("returns qwen3-coder profile", () => {
      const p = getModelProfile("qwen3-coder:480b");
      expect(p.staleWarn).toBe(60000);
      expect(p.investigationCap).toBe(15);
    });

    it("returns kimi-k2 profile", () => {
      const p = getModelProfile("kimi-k2:1t");
      expect(p.staleWarn).toBe(45000);
    });

    it("returns defaults for unknown model", () => {
      const p = getModelProfile("llama-3:70b");
      expect(p).toEqual(DEFAULTS);
    });

    it("returns defaults for null/empty model", () => {
      expect(getModelProfile(null)).toEqual(DEFAULTS);
      expect(getModelProfile("")).toEqual(DEFAULTS);
      expect(getModelProfile(undefined)).toEqual(DEFAULTS);
    });

    it("prefers longest prefix match", () => {
      // "devstral-small" should match over "devstral-"
      const p = getModelProfile("devstral-small-2:24b");
      expect(p.staleWarn).toBe(20000); // devstral-small, not devstral-2
    });

    it("ENV override takes precedence", () => {
      process.env.NEX_STALE_WARN_MS = "5000";
      process.env.NEX_STALE_ABORT_MS = "15000";
      const p = getModelProfile("devstral-2:123b");
      expect(p.staleWarn).toBe(5000);
      expect(p.staleAbort).toBe(15000);
      // Non-stale values still come from profile
      expect(p.investigationCap).toBe(12);
    });

    it("rejects invalid ENV values (NaN)", () => {
      process.env.NEX_STALE_WARN_MS = "not-a-number";
      const p = getModelProfile("devstral-2:123b");
      expect(p.staleWarn).toBe(30000); // profile default, not NaN
    });

    it("rejects out-of-range ENV values", () => {
      process.env.NEX_STALE_WARN_MS = "500"; // below 1000 min
      const p = getModelProfile("devstral-2:123b");
      expect(p.staleWarn).toBe(30000); // profile default
    });

    it("rejects ENV values above 300000", () => {
      process.env.NEX_STALE_ABORT_MS = "999999";
      const p = getModelProfile("devstral-2:123b");
      expect(p.staleAbort).toBe(90000); // profile default
    });

    it("is case-insensitive", () => {
      const p = getModelProfile("Devstral-2:123B");
      expect(p.staleWarn).toBe(30000);
    });
  });
});

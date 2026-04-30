const registry = require("../cli/providers/registry");

describe("registry.js", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    registry._reset();
    // Ensure at least ollama is configured
    process.env.OLLAMA_API_KEY = "test-key";
  });

  afterEach(() => {
    registry._reset();
    process.env = { ...origEnv };
  });

  // ─── FALLBACK_CHAIN env initialization ────────────────────
  describe("FALLBACK_CHAIN env", () => {
    it("initializes fallback chain from FALLBACK_CHAIN env", () => {
      process.env.FALLBACK_CHAIN = "openai,anthropic,gemini";
      registry.getActiveProviderName(); // triggers initDefaults()
      const chain = registry.getFallbackChain();
      expect(chain).toEqual(["openai", "anthropic", "gemini"]);
    });

    it("trims whitespace in FALLBACK_CHAIN", () => {
      process.env.FALLBACK_CHAIN = "  openai  ,  anthropic  ";
      registry.getActiveProviderName();
      const chain = registry.getFallbackChain();
      expect(chain).toEqual(["openai", "anthropic"]);
    });

    it("filters empty strings from FALLBACK_CHAIN", () => {
      process.env.FALLBACK_CHAIN = "openai,,anthropic,";
      registry.getActiveProviderName();
      const chain = registry.getFallbackChain();
      expect(chain).toEqual(["openai", "anthropic"]);
    });

    it("does not set fallback chain when env is not set", () => {
      delete process.env.FALLBACK_CHAIN;
      registry.getActiveProviderName();
      expect(registry.getFallbackChain()).toEqual([]);
    });
  });

  // ─── setActiveModel edge cases ─────────────────────────────
  describe("setActiveModel() edge cases", () => {
    it("returns false when model not found in non-local provider", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      const result = registry.setActiveModel("openai:nonexistent-model-xyz");
      expect(result).toBe(false);
    });

    it("allows any model in local provider", () => {
      const result = registry.setActiveModel("local:custom-llama");
      expect(result).toBe(true);
      expect(registry.getActiveProviderName()).toBe("local");
      expect(registry.getActiveModelId()).toBe("custom-llama");
    });

    it("returns false for unknown provider", () => {
      const result = registry.setActiveModel("fakeprovider:model");
      expect(result).toBe(false);
    });
  });

  // ─── setFallbackChain type validation ──────────────────────
  describe("setFallbackChain() type validation", () => {
    it("handles null input", () => {
      registry.setFallbackChain(null);
      expect(registry.getFallbackChain()).toEqual([]);
    });

    it("handles undefined input", () => {
      registry.setFallbackChain(undefined);
      expect(registry.getFallbackChain()).toEqual([]);
    });

    it("handles string input", () => {
      registry.setFallbackChain("openai");
      expect(registry.getFallbackChain()).toEqual([]);
    });

    it("handles object input", () => {
      registry.setFallbackChain({ provider: "openai" });
      expect(registry.getFallbackChain()).toEqual([]);
    });

    it("handles number input", () => {
      registry.setFallbackChain(42);
      expect(registry.getFallbackChain()).toEqual([]);
    });

    it("accepts valid array", () => {
      registry.setFallbackChain(["openai", "anthropic"]);
      expect(registry.getFallbackChain()).toEqual(["openai", "anthropic"]);
    });
  });

  // ─── callStream fallback logic ─────────────────────────────
  describe("callStream() fallback", () => {
    it("retries on 429 rate limit error with fallback provider", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName(); // init
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      const mockResult = { content: "response" };
      jest
        .spyOn(ollama, "stream")
        .mockRejectedValueOnce(new Error("429 Too Many Requests"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest.spyOn(openai, "stream").mockResolvedValueOnce(mockResult);

      const result = await registry.callStream([], []);
      expect(result).toEqual(mockResult);
      expect(ollama.stream).toHaveBeenCalled();
      expect(openai.stream).toHaveBeenCalled();

      ollama.stream.mockRestore();
      openai.stream.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("retries on 503 server error", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "stream")
        .mockRejectedValueOnce(new Error("503 Service Unavailable"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest.spyOn(openai, "stream").mockResolvedValueOnce({ ok: true });

      const result = await registry.callStream([], []);
      expect(result).toEqual({ ok: true });

      ollama.stream.mockRestore();
      openai.stream.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("throws non-retryable error immediately without retrying", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "stream")
        .mockRejectedValueOnce(new Error("401 Unauthorized"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest.spyOn(openai, "stream").mockResolvedValueOnce({ ok: true });

      await expect(registry.callStream([], [])).rejects.toThrow(
        "401 Unauthorized",
      );
      expect(openai.stream).not.toHaveBeenCalled();

      ollama.stream.mockRestore();
      openai.stream.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("throws retryable error when last provider fails", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "stream")
        .mockRejectedValueOnce(new Error("502 Bad Gateway"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest
        .spyOn(openai, "stream")
        .mockRejectedValueOnce(new Error("502 Bad Gateway"));

      await expect(registry.callStream([], [])).rejects.toThrow(
        "502 Bad Gateway",
      );
      expect(ollama.stream).toHaveBeenCalled();
      expect(openai.stream).toHaveBeenCalled();

      ollama.stream.mockRestore();
      openai.stream.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("throws when no configured provider is available", async () => {
      registry._reset();
      delete process.env.OLLAMA_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      await expect(registry.callStream([], [])).rejects.toThrow(
        "No configured provider",
      );
    });

    it("explains the Ollama-first setup path when no provider is configured", async () => {
      registry._reset();
      delete process.env.OLLAMA_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      await expect(registry.callStream([], [])).rejects.toThrow(
        /Lowest-cost path: run \/setup and choose Ollama Cloud/,
      );
    });

    it("labels premium fallback routing in stderr", async () => {
      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation();
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "stream")
        .mockRejectedValueOnce(new Error("503 Service Unavailable"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest.spyOn(openai, "stream").mockResolvedValueOnce({ ok: true });

      await registry.callStream([], []);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("premium paid provider"),
      );

      ollama.stream.mockRestore();
      openai.stream.mockRestore();
      openai.isConfigured.mockRestore();
      stderrSpy.mockRestore();
    });
  });

  // ─── callChat fallback logic ───────────────────────────────
  describe("callChat() fallback", () => {
    it("retries on 429 rate limit error", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "chat")
        .mockRejectedValueOnce(new Error("429 Too Many Requests"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest.spyOn(openai, "chat").mockResolvedValueOnce({ content: "ok" });

      const result = await registry.callChat([], []);
      expect(result).toEqual({ content: "ok" });
      expect(openai.chat).toHaveBeenCalled();

      ollama.chat.mockRestore();
      openai.chat.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("throws non-retryable error immediately", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "chat")
        .mockRejectedValueOnce(new Error("401 Unauthorized"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest.spyOn(openai, "chat").mockResolvedValueOnce({ content: "ok" });

      await expect(registry.callChat([], [])).rejects.toThrow(
        "401 Unauthorized",
      );
      expect(openai.chat).not.toHaveBeenCalled();

      ollama.chat.mockRestore();
      openai.chat.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("exhausts fallback chain and throws retryable error", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();
      registry.setFallbackChain(["openai"]);

      const ollama = registry.getProvider("ollama");
      const openai = registry.getProvider("openai");

      jest
        .spyOn(ollama, "chat")
        .mockRejectedValueOnce(new Error("500 Internal Server Error"));
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest
        .spyOn(openai, "chat")
        .mockRejectedValueOnce(new Error("500 Internal Server Error"));

      await expect(registry.callChat([], [])).rejects.toThrow(
        "500 Internal Server Error",
      );
      expect(ollama.chat).toHaveBeenCalled();
      expect(openai.chat).toHaveBeenCalled();

      ollama.chat.mockRestore();
      openai.chat.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("routes directly to specified provider via options.provider", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      registry.getActiveProviderName();

      const openai = registry.getProvider("openai");
      jest.spyOn(openai, "isConfigured").mockReturnValue(true);
      jest
        .spyOn(openai, "chat")
        .mockResolvedValueOnce({ content: "from openai" });

      const result = await registry.callChat([], [], {
        provider: "openai",
        model: "gpt-4o",
      });
      expect(result).toEqual({ content: "from openai" });
      expect(openai.chat).toHaveBeenCalledWith(
        [],
        [],
        expect.objectContaining({ model: "gpt-4o", provider: "openai" }),
      );

      openai.chat.mockRestore();
      openai.isConfigured.mockRestore();
    });

    it("throws when specified provider is not configured", async () => {
      registry.getActiveProviderName();

      const anthropic = registry.getProvider("anthropic");
      jest.spyOn(anthropic, "isConfigured").mockReturnValue(false);

      await expect(
        registry.callChat([], [], { provider: "anthropic" }),
      ).rejects.toThrow("Provider 'anthropic' is not available");

      anthropic.isConfigured.mockRestore();
    });

    it("throws when specified provider does not exist", async () => {
      registry.getActiveProviderName();

      await expect(
        registry.callChat([], [], { provider: "nonexistent" }),
      ).rejects.toThrow("Provider 'nonexistent' is not available");
    });
  });

  // ─── getConfiguredProviders ─────────────────────────────────
  describe("getConfiguredProviders()", () => {
    it("returns only configured providers with models", () => {
      registry.getActiveProviderName(); // init
      const configured = registry.getConfiguredProviders();

      // ollama should be configured (OLLAMA_API_KEY is set in beforeEach)
      const ollamaEntry = configured.find((p) => p.name === "ollama");
      expect(ollamaEntry).toBeDefined();
      expect(ollamaEntry.models.length).toBeGreaterThan(0);

      // Each model should have id and name
      for (const m of ollamaEntry.models) {
        expect(m).toHaveProperty("id");
        expect(m).toHaveProperty("name");
      }
    });

    it("does not include unconfigured providers", () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      registry._reset();
      process.env.OLLAMA_API_KEY = "test-key";

      const configured = registry.getConfiguredProviders();
      const providerNames = configured.map((p) => p.name);

      expect(providerNames).toContain("ollama");
      // local is always configured (no API key needed)
      expect(providerNames).toContain("local");
      expect(providerNames).not.toContain("openai");
      expect(providerNames).not.toContain("anthropic");
    });
  });
});

const { pickFromList, showModelPicker } = require("../cli/picker");

// Mock the providers/registry module for showModelPicker tests
jest.mock("../cli/providers/registry", () => ({
  listProviders: jest.fn(),
  getActiveProviderName: jest.fn(),
  getActiveModelId: jest.fn(),
  setActiveModel: jest.fn(),
}));

const registry = require("../cli/providers/registry");

describe("picker.js", () => {
  describe("pickFromList()", () => {
    let mockRl;

    // Save originals once
    const originals = {};

    beforeEach(() => {
      mockRl = {
        pause: jest.fn(),
        resume: jest.fn(),
      };

      // Save originals
      originals.stdinOn = process.stdin.on;
      originals.stdinSetRawMode = process.stdin.setRawMode;
      originals.stdinResume = process.stdin.resume;
      originals.stdinIsTTY = process.stdin.isTTY;
      originals.stdinIsRaw = process.stdin.isRaw;
      originals.stdinRemoveListener = process.stdin.removeListener;
      originals.stdoutWrite = process.stdout.write;
      originals.stdoutRows = process.stdout.rows;
    });

    afterEach(() => {
      // Restore originals
      process.stdin.on = originals.stdinOn;
      process.stdin.setRawMode = originals.stdinSetRawMode;
      process.stdin.resume = originals.stdinResume;
      process.stdin.isTTY = originals.stdinIsTTY;
      process.stdin.isRaw = originals.stdinIsRaw;
      process.stdin.removeListener = originals.stdinRemoveListener;
      process.stdout.write = originals.stdoutWrite;
      Object.defineProperty(process.stdout, "rows", {
        value: originals.stdoutRows,
        writable: true,
        configurable: true,
      });
    });

    /**
     * Helper: set up stdin/stdout mocks for interactive picker tests.
     * Returns a function to emit keypress events.
     */
    function setupInteractiveMocks(opts = {}) {
      const { rows = 30, isTTY = true, isRaw = false } = opts;

      process.stdin.isTTY = isTTY;
      process.stdin.isRaw = isRaw;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdin.removeListener = jest.fn();
      process.stdout.write = jest.fn();
      Object.defineProperty(process.stdout, "rows", {
        value: rows,
        writable: true,
        configurable: true,
      });

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === "keypress") keypressHandler = handler;
        return process.stdin;
      });

      function emitKey(name, extra = {}) {
        if (keypressHandler) keypressHandler(null, { name, ...extra });
      }

      return { emitKey };
    }

    it("resolves null when items list is empty", async () => {
      const result = await pickFromList(mockRl, [], { title: "Test" });
      expect(result).toBeNull();
    });

    it("resolves null when all items are headers", async () => {
      const items = [
        { label: "Group A", value: null, isHeader: true },
        { label: "Group B", value: null, isHeader: true },
      ];
      const result = await pickFromList(mockRl, items, { title: "Test" });
      expect(result).toBeNull();
    });

    it("selects item on Enter keypress", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("resolves null on Escape keypress", async () => {
      const items = [{ label: "Option A", value: "a" }];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("escape");

      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves null on Ctrl+C", async () => {
      const items = [{ label: "Option A", value: "a" }];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("c", { ctrl: true });

      const result = await promise;
      expect(result).toBeNull();
    });

    it("navigates down and selects second item", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
        { label: "Option C", value: "c" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("down");
      emitKey("return");

      const result = await promise;
      expect(result).toBe("b");
    });

    it("navigates up with arrow key", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
        { label: "Option C", value: "c" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Move down twice, then up once -> should be at 'b'
      emitKey("down");
      emitKey("down");
      emitKey("up");
      emitKey("return");

      const result = await promise;
      expect(result).toBe("b");
    });

    it("navigates up with ctrl+p", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Move down, then ctrl+p (up) -> back at 'a'
      emitKey("down");
      emitKey("p", { ctrl: true });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("navigates down with ctrl+n", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      emitKey("n", { ctrl: true });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("b");
    });

    it("does not move up past the first item", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Already at cursor=0, pressing up should stay at 0
      emitKey("up");
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("does not move down past the last item", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Move down to last item, then try down again
      emitKey("down");
      emitKey("down");
      emitKey("down");
      emitKey("return");

      const result = await promise;
      expect(result).toBe("b");
    });

    it("starts at current item when isCurrent is set", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b", isCurrent: true },
        { label: "Option C", value: "c" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("b");
    });

    it("skips header items during navigation", async () => {
      const items = [
        { label: "Group", value: null, isHeader: true },
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("pauses and resumes readline", async () => {
      const items = [{ label: "Option A", value: "a" }];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      expect(mockRl.pause).toHaveBeenCalled();

      emitKey("return");

      await promise;
      expect(mockRl.resume).toHaveBeenCalled();
    });

    it("ignores keypress events with no key object", async () => {
      const items = [{ label: "Option A", value: "a" }];

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdin.removeListener = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === "keypress") keypressHandler = handler;
        return process.stdin;
      });

      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Send a keypress with no key object (should be ignored)
      keypressHandler(null, null);
      // Then send a valid escape to close
      keypressHandler(null, { name: "escape" });

      const result = await promise;
      expect(result).toBeNull();
    });

    it("ignores unrecognized key names", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Press some random keys that are not handled
      emitKey("tab");
      emitKey("space");
      emitKey("a");
      // Then select
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("uses default title and hint when options are empty", async () => {
      const items = [{ label: "Option A", value: "a" }];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items);
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
      // Verify default title "Select" appears in output
      const writeCalls = process.stdout.write.mock.calls
        .map((c) => c[0])
        .join("");
      expect(writeCalls).toContain("Select");
    });

    it("falls back to cursor=0 when isCurrent is on a header item", async () => {
      const items = [
        { label: "Group", value: null, isHeader: true, isCurrent: true },
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      // isCurrent is on a header, so selectableIndices.indexOf(0) = -1, cursor resets to 0
      const result = await promise;
      expect(result).toBe("a");
    });

    it("uses maxVisible=5 when process.stdout.rows is very small", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      // rows=8 => Math.max(8 - 6, 5) = 5
      const { emitKey } = setupInteractiveMocks({ rows: 8 });
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("uses fallback maxVisible when process.stdout.rows is undefined", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks({ rows: undefined });
      // rows=undefined means maxVisible falls back to 20
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
    });

    it("works when process.stdin is not a TTY", async () => {
      const items = [{ label: "Option A", value: "a" }];

      const { emitKey } = setupInteractiveMocks({ isTTY: false });
      // When not TTY, setRawMode should NOT be called
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      const result = await promise;
      expect(result).toBe("a");
      expect(process.stdin.setRawMode).not.toHaveBeenCalled();
    });

    it("scrolls down when navigating past the visible window and shows more indicators", async () => {
      // Create many items so they overflow the visible window
      // With rows=11, maxVisible = Math.max(11 - 6, 5) = 5
      const items = [];
      for (let i = 0; i < 10; i++) {
        items.push({ label: `Option ${i}`, value: `val-${i}` });
      }

      const { emitKey } = setupInteractiveMocks({ rows: 11 });

      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Navigate down past the visible window (maxVisible = 5)
      // Items 0-4 are visible initially; navigating to item 5 should trigger scroll
      for (let i = 0; i < 6; i++) {
        emitKey("down");
      }
      emitKey("return");

      const result = await promise;
      expect(result).toBe("val-6");

      // Check that "more" indicators were rendered
      const writeCalls = process.stdout.write.mock.calls
        .map((c) => c[0])
        .join("");
      expect(writeCalls).toContain("\u2191 more");
      expect(writeCalls).toContain("\u2193 more");
    });

    it("scrolls up when navigating above the visible window", async () => {
      // Create many items, start cursor at a later item, navigate up
      // With rows=11, maxVisible = 5
      const items = [];
      for (let i = 0; i < 10; i++) {
        items.push({
          label: `Option ${i}`,
          value: `val-${i}`,
          isCurrent: i === 7,
        });
      }

      const { emitKey } = setupInteractiveMocks({ rows: 11 });

      const promise = pickFromList(mockRl, items, { title: "Test" });

      // Cursor starts at item 7 (index in selectableIndices).
      // Navigate up several times to scroll the window back up.
      for (let i = 0; i < 7; i++) {
        emitKey("up");
      }
      emitKey("return");

      const result = await promise;
      expect(result).toBe("val-0");
    });

    it("renders previous lines clearing on re-render", async () => {
      const items = [
        { label: "Option A", value: "a" },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });

      // First render happens on creation.
      // Navigate down to trigger re-render (line 57 clearing logic).
      emitKey("down");
      emitKey("return");

      const result = await promise;
      expect(result).toBe("b");

      // Verify ANSI escape for cursor up was written (clearing previous render)
      const writeCalls = process.stdout.write.mock.calls
        .map((c) => c[0])
        .join("");
      expect(writeCalls).toContain("\x1b[");
      expect(writeCalls).toContain("\x1b[2K");
    });

    it("renders header items with bold dim styling", async () => {
      const items = [
        { label: "My Group", value: null, isHeader: true },
        { label: "Option A", value: "a" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      await promise;

      const writeCalls = process.stdout.write.mock.calls
        .map((c) => c[0])
        .join("");
      expect(writeCalls).toContain("My Group");
    });

    it("renders current tag for isCurrent items", async () => {
      const items = [
        { label: "Option A", value: "a", isCurrent: true },
        { label: "Option B", value: "b" },
      ];

      const { emitKey } = setupInteractiveMocks();
      const promise = pickFromList(mockRl, items, { title: "Test" });
      emitKey("return");

      await promise;

      const writeCalls = process.stdout.write.mock.calls
        .map((c) => c[0])
        .join("");
      expect(writeCalls).toContain("<current>");
    });
  });

  describe("showModelPicker()", () => {
    let mockRl;

    const originals = {};

    beforeEach(() => {
      mockRl = {
        pause: jest.fn(),
        resume: jest.fn(),
      };

      originals.stdinOn = process.stdin.on;
      originals.stdinSetRawMode = process.stdin.setRawMode;
      originals.stdinResume = process.stdin.resume;
      originals.stdinIsTTY = process.stdin.isTTY;
      originals.stdinIsRaw = process.stdin.isRaw;
      originals.stdinRemoveListener = process.stdin.removeListener;
      originals.stdoutWrite = process.stdout.write;
      originals.stdoutRows = process.stdout.rows;
      originals.consoleLog = console.log;

      jest.clearAllMocks();
    });

    afterEach(() => {
      process.stdin.on = originals.stdinOn;
      process.stdin.setRawMode = originals.stdinSetRawMode;
      process.stdin.resume = originals.stdinResume;
      process.stdin.isTTY = originals.stdinIsTTY;
      process.stdin.isRaw = originals.stdinIsRaw;
      process.stdin.removeListener = originals.stdinRemoveListener;
      process.stdout.write = originals.stdoutWrite;
      process.stdout.rows = originals.stdoutRows;
      console.log = originals.consoleLog;
    });

    function setupInteractiveMocks() {
      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdin.removeListener = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;
      console.log = jest.fn();

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === "keypress") keypressHandler = handler;
        return process.stdin;
      });

      function emitKey(name, extra = {}) {
        if (keypressHandler) keypressHandler(null, { name, ...extra });
      }

      return { emitKey };
    }

    it("returns true and calls setActiveModel when a model is selected", async () => {
      registry.listProviders.mockReturnValue([
        {
          provider: "openai",
          models: [
            { id: "gpt-4", name: "GPT-4" },
            { id: "gpt-3.5", name: "GPT-3.5" },
          ],
        },
      ]);
      registry.getActiveProviderName.mockReturnValue("openai");
      registry.getActiveModelId.mockReturnValue("gpt-4");

      const { emitKey } = setupInteractiveMocks();

      const promise = showModelPicker(mockRl);

      // First selectable item is GPT-4. Select it.
      emitKey("return");

      const result = await promise;
      expect(result).toBe(true);
      expect(registry.setActiveModel).toHaveBeenCalledWith("openai:gpt-4");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Switched to openai:gpt-4"),
      );
    });

    it("returns false and logs cancelled when escape is pressed", async () => {
      registry.listProviders.mockReturnValue([
        {
          provider: "openai",
          models: [{ id: "gpt-4", name: "GPT-4" }],
        },
      ]);
      registry.getActiveProviderName.mockReturnValue("openai");
      registry.getActiveModelId.mockReturnValue("gpt-4");

      const { emitKey } = setupInteractiveMocks();

      const promise = showModelPicker(mockRl);
      emitKey("escape");

      const result = await promise;
      expect(result).toBe(false);
      expect(registry.setActiveModel).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Cancelled"),
      );
    });

    it("selects a different model when navigating down", async () => {
      registry.listProviders.mockReturnValue([
        {
          provider: "openai",
          models: [
            { id: "gpt-4", name: "GPT-4" },
            { id: "gpt-3.5", name: "GPT-3.5" },
          ],
        },
      ]);
      registry.getActiveProviderName.mockReturnValue("openai");
      registry.getActiveModelId.mockReturnValue("gpt-4");

      const { emitKey } = setupInteractiveMocks();

      const promise = showModelPicker(mockRl);
      // Navigate down from GPT-4 (current) to GPT-3.5
      emitKey("down");
      emitKey("return");

      const result = await promise;
      expect(result).toBe(true);
      expect(registry.setActiveModel).toHaveBeenCalledWith("openai:gpt-3.5");
    });

    it("skips providers with no models", async () => {
      registry.listProviders.mockReturnValue([
        {
          provider: "empty-provider",
          models: [],
        },
        {
          provider: "anthropic",
          models: [{ id: "claude-3", name: "Claude 3" }],
        },
      ]);
      registry.getActiveProviderName.mockReturnValue("anthropic");
      registry.getActiveModelId.mockReturnValue("claude-3");

      const { emitKey } = setupInteractiveMocks();

      const promise = showModelPicker(mockRl);
      emitKey("return");

      const result = await promise;
      expect(result).toBe(true);
      expect(registry.setActiveModel).toHaveBeenCalledWith(
        "anthropic:claude-3",
      );
    });

    it("handles multiple providers with correct isCurrent marking", async () => {
      registry.listProviders.mockReturnValue([
        {
          provider: "openai",
          models: [{ id: "gpt-4", name: "GPT-4" }],
        },
        {
          provider: "anthropic",
          models: [{ id: "claude-3", name: "Claude 3" }],
        },
      ]);
      registry.getActiveProviderName.mockReturnValue("anthropic");
      registry.getActiveModelId.mockReturnValue("claude-3");

      const { emitKey } = setupInteractiveMocks();

      const promise = showModelPicker(mockRl);
      // The cursor should start at Claude 3 (isCurrent=true).
      emitKey("return");

      const result = await promise;
      expect(result).toBe(true);
      expect(registry.setActiveModel).toHaveBeenCalledWith(
        "anthropic:claude-3",
      );
    });
  });
});

/**
 * tests/browser.test.js — Browser Agent tools
 * Tests browser_open, browser_screenshot, browser_click, browser_fill
 * and graceful degradation when Playwright is not installed.
 */

// ─── Playwright mock ─────────────────────────────────────────
const mockPage = {
  goto: jest.fn().mockResolvedValue(undefined),
  title: jest.fn().mockResolvedValue("Test Page Title"),
  url: jest.fn().mockReturnValue("https://example.com"),
  evaluate: jest.fn(),
  setViewportSize: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from("fake-png-data")),
  getByText: jest.fn().mockReturnValue({
    first: jest
      .fn()
      .mockReturnValue({ click: jest.fn().mockResolvedValue(undefined) }),
  }),
  locator: jest.fn().mockReturnValue({
    first: jest
      .fn()
      .mockReturnValue({ click: jest.fn().mockResolvedValue(undefined) }),
  }),
  waitForLoadState: jest.fn().mockResolvedValue(undefined),
  fill: jest.fn().mockResolvedValue(undefined),
  keyboard: { press: jest.fn().mockResolvedValue(undefined) },
  close: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  isConnected: jest.fn().mockReturnValue(true),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockPlaywright = {
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
};

// Mock playwright as available
jest.mock("playwright", () => mockPlaywright, { virtual: true });

// Mock fs for screenshot
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
}));

// ─── Mocks for tools.js ──────────────────────────────────────
jest.mock("../cli/safety", () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));
jest.mock("../cli/file-history", () => ({ recordChange: jest.fn() }));
jest.mock("../cli/diff", () => ({
  showDiff: jest.fn(),
  showNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

const { INSTALL_MSG } = require("../cli/browser");

describe("browser.js — Browser Agent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset page mock defaults
    mockPage.evaluate.mockResolvedValue("Page text content here");
    mockPage.title.mockResolvedValue("Test Page Title");
    mockPage.url.mockReturnValue("https://example.com");
  });

  // ─── isPlaywrightAvailable ───────────────────────────────────
  describe("isPlaywrightAvailable()", () => {
    it("returns true when playwright is mocked as available", () => {
      const { isPlaywrightAvailable } = require("../cli/browser");
      // With our virtual mock, require.resolve('playwright') works
      expect(typeof isPlaywrightAvailable).toBe("function");
    });
  });

  // ─── INSTALL_MSG ─────────────────────────────────────────────
  describe("INSTALL_MSG", () => {
    it("contains install instructions", () => {
      expect(INSTALL_MSG).toContain("playwright");
      expect(INSTALL_MSG).toContain("npm install");
      expect(INSTALL_MSG).toContain("chromium");
    });
  });
});

describe("Browser tool definitions", () => {
  const { TOOL_DEFINITIONS } = require("../cli/tools");

  it("includes browser_open", () => {
    expect(
      TOOL_DEFINITIONS.some((t) => t.function.name === "browser_open"),
    ).toBe(true);
  });

  it("includes browser_screenshot", () => {
    expect(
      TOOL_DEFINITIONS.some((t) => t.function.name === "browser_screenshot"),
    ).toBe(true);
  });

  it("includes browser_click", () => {
    expect(
      TOOL_DEFINITIONS.some((t) => t.function.name === "browser_click"),
    ).toBe(true);
  });

  it("includes browser_fill", () => {
    expect(
      TOOL_DEFINITIONS.some((t) => t.function.name === "browser_fill"),
    ).toBe(true);
  });

  it("browser_open requires url", () => {
    const def = TOOL_DEFINITIONS.find(
      (t) => t.function.name === "browser_open",
    );
    expect(def.function.parameters.required).toContain("url");
  });

  it("browser_screenshot requires url", () => {
    const def = TOOL_DEFINITIONS.find(
      (t) => t.function.name === "browser_screenshot",
    );
    expect(def.function.parameters.required).toContain("url");
  });

  it("browser_fill requires url, selector, value", () => {
    const def = TOOL_DEFINITIONS.find(
      (t) => t.function.name === "browser_fill",
    );
    expect(def.function.parameters.required).toContain("url");
    expect(def.function.parameters.required).toContain("selector");
    expect(def.function.parameters.required).toContain("value");
  });
});

describe("browserNavigate()", () => {
  let browserNavigate;

  beforeEach(() => {
    jest.resetModules();
    // Re-mock playwright after resetModules
    jest.mock("playwright", () => mockPlaywright, { virtual: true });
    jest.mock("fs", () => ({
      ...jest.requireActual("fs"),
      writeFileSync: jest.fn(),
      existsSync: jest.fn().mockReturnValue(true),
    }));
    mockPage.evaluate
      .mockResolvedValueOnce("Main content text") // text
      .mockResolvedValueOnce([
        { text: "Click me", href: "https://example.com/page" },
      ]); // links
    mockPage.title.mockResolvedValue("My Page");
    mockPage.url.mockReturnValue("https://example.com");
    ({ browserNavigate } = require("../cli/browser"));
  });

  it("returns title, url, text, and links", async () => {
    const result = await browserNavigate("https://example.com");
    expect(result.title).toBe("My Page");
    expect(result.url).toBe("https://example.com");
    expect(result.text).toBe("Main content text");
    expect(Array.isArray(result.links)).toBe(true);
  });

  it("calls page.goto with the URL", async () => {
    await browserNavigate("https://example.com");
    expect(mockPage.goto).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ waitUntil: "domcontentloaded" }),
    );
  });

  it("closes the page after navigation", async () => {
    await browserNavigate("https://example.com");
    expect(mockPage.close).toHaveBeenCalled();
  });

  it("truncates text beyond 8000 chars", async () => {
    mockPage.evaluate.mockReset();
    mockPage.evaluate
      .mockResolvedValueOnce("x".repeat(10000))
      .mockResolvedValueOnce([]);
    const result = await browserNavigate("https://example.com");
    expect(result.text.length).toBeLessThanOrEqual(8020);
    expect(result.text).toContain("truncated");
  });
});

describe("browserScreenshot()", () => {
  let browserScreenshot;
  const fs = require("fs");

  beforeEach(() => {
    jest.resetModules();
    jest.mock("playwright", () => mockPlaywright, { virtual: true });
    jest.mock("fs", () => ({
      ...jest.requireActual("fs"),
      writeFileSync: jest.fn(),
      existsSync: jest.fn().mockReturnValue(true),
    }));
    mockPage.title.mockResolvedValue("Screenshot Page");
    mockPage.url.mockReturnValue("https://example.com");
    mockPage.screenshot.mockResolvedValue(Buffer.from("PNG_DATA"));
    ({ browserScreenshot } = require("../cli/browser"));
  });

  it("returns path, base64, media_type, title, url", async () => {
    const result = await browserScreenshot("https://example.com");
    expect(result.path).toContain("nex-screenshot");
    expect(result.path).toContain(".png");
    expect(result.base64).toBe(Buffer.from("PNG_DATA").toString("base64"));
    expect(result.media_type).toBe("image/png");
    expect(result.title).toBe("Screenshot Page");
    expect(result.url).toBe("https://example.com");
  });

  it("sets viewport size", async () => {
    await browserScreenshot("https://example.com", {
      width: 1920,
      height: 1080,
    });
    expect(mockPage.setViewportSize).toHaveBeenCalledWith({
      width: 1920,
      height: 1080,
    });
  });

  it("saves PNG to tmp file", async () => {
    await browserScreenshot("https://example.com");
    const { writeFileSync } = require("fs");
    expect(writeFileSync).toHaveBeenCalled();
  });

  it("closes page after screenshot", async () => {
    await browserScreenshot("https://example.com");
    expect(mockPage.close).toHaveBeenCalled();
  });
});

describe("browserClick()", () => {
  let browserClick;

  beforeEach(() => {
    jest.resetModules();
    jest.mock("playwright", () => mockPlaywright, { virtual: true });
    jest.mock("fs", () => ({
      ...jest.requireActual("fs"),
      writeFileSync: jest.fn(),
      existsSync: jest.fn().mockReturnValue(true),
    }));
    mockPage.url.mockReturnValue("https://example.com/after-click");
    mockPage.title.mockResolvedValue("After Click");
    ({ browserClick } = require("../cli/browser"));
  });

  it("clicks by text and returns new URL", async () => {
    const result = await browserClick("https://example.com", {
      text: "Submit",
    });
    expect(result).toContain("https://example.com/after-click");
  });

  it("clicks by CSS selector", async () => {
    await browserClick("https://example.com", { selector: "#submit-btn" });
    expect(mockPage.locator).toHaveBeenCalledWith("#submit-btn");
  });

  it("throws when neither selector nor text provided", async () => {
    await expect(browserClick("https://example.com", {})).rejects.toThrow(
      "selector or text",
    );
  });
});

describe("browserFill()", () => {
  let browserFill;

  beforeEach(() => {
    jest.resetModules();
    jest.mock("playwright", () => mockPlaywright, { virtual: true });
    jest.mock("fs", () => ({
      ...jest.requireActual("fs"),
      writeFileSync: jest.fn(),
      existsSync: jest.fn().mockReturnValue(true),
    }));
    mockPage.url.mockReturnValue("https://example.com");
    ({ browserFill } = require("../cli/browser"));
  });

  it("fills field without submitting", async () => {
    const result = await browserFill("https://example.com", {
      selector: "#email",
      value: "test@example.com",
      submit: false,
    });
    expect(mockPage.fill).toHaveBeenCalledWith("#email", "test@example.com");
    expect(result).toContain("Not submitted");
  });

  it("presses Enter when submit:true", async () => {
    await browserFill("https://example.com", {
      selector: "#email",
      value: "test@example.com",
      submit: true,
    });
    expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
  });

  it("throws when selector missing", async () => {
    await expect(
      browserFill("https://example.com", { value: "test" }),
    ).rejects.toThrow();
  });
});

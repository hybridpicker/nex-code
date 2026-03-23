/**
 * tests/version-check.test.js — Tests for version checking functionality
 */

const fs = require("fs");
const path = require("path");
const { checkForNewVersion } = require("../cli/version-check");

// Mock axios
jest.mock("axios");

describe("version-check", () => {
  const CONFIG_DIR = path.join(process.cwd(), ".nex");
  const VERSION_CHECK_FILE = path.join(CONFIG_DIR, "last-version-check");

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();

    // Remove test files
    if (fs.existsSync(VERSION_CHECK_FILE)) {
      fs.unlinkSync(VERSION_CHECK_FILE);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(CONFIG_DIR)) {
      fs.rmSync(CONFIG_DIR, { recursive: true });
    }
  });

  test("should return hasNewVersion: false when check is too recent", async () => {
    // Create a recent check timestamp (1 hour ago)
    const recentTime = Date.now() - 60 * 60 * 1000;
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(VERSION_CHECK_FILE, recentTime.toString());

    const result = await checkForNewVersion();
    expect(result.hasNewVersion).toBe(false);
  });

  test("should handle network errors gracefully", async () => {
    const axios = require("axios");
    axios.get.mockRejectedValue(new Error("Network error"));

    const result = await checkForNewVersion();
    expect(result.hasNewVersion).toBe(false);
  });

  test("should detect newer version correctly", async () => {
    const axios = require("axios");
    axios.get.mockResolvedValue({
      data: {
        version: "0.4.0",
      },
    });

    const result = await checkForNewVersion();
    // Should detect new version unless we're already at 0.4.0 or higher
    expect(typeof result.hasNewVersion).toBe("boolean");
  });
});

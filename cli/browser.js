/**
 * cli/browser.js — Browser Agent (Playwright-based)
 *
 * Playwright is an OPTIONAL dependency. nex-code will work without it.
 * Install with: npm install playwright && npx playwright install chromium
 *
 * Provides: navigate, screenshot, click, fill, extract tools.
 */

let _playwright = null;
let _browser = null;
let _isAvailable = null;

const INSTALL_MSG =
  "Playwright is not installed. Install with:\n  npm install playwright && npx playwright install chromium\nThen restart nex-code.";

function isPlaywrightAvailable() {
  if (_isAvailable !== null) return _isAvailable;
  try {
    require("playwright");
    _isAvailable = true;
  } catch {
    _isAvailable = false;
  }
  return _isAvailable;
}

async function getBrowser() {
  if (!isPlaywrightAvailable()) throw new Error(INSTALL_MSG);
  if (!_playwright) _playwright = require("playwright");
  if (!_browser || !_browser.isConnected()) {
    _browser = await _playwright.chromium.launch({ headless: true });
  }
  return _browser;
}

async function closeBrowser() {
  if (_browser) {
    try {
      await _browser.close();
    } catch (e) { console.error("closeBrowser failed:", e.message); }
    _browser = null;
  }
}

// Register cleanup on exit
process.on("exit", () => {
  if (_browser) {
    try {
      _browser.close();
    } catch (err) {
      // Log error on exit but don't throw — process is already terminating
      console.error("Error closing browser on exit:", err.message);
    }
  }
});

/**
 * Navigate to URL and return page content (title, text, links).
 */
async function browserNavigate(
  url,
  { timeout = 30000, waitFor = "domcontentloaded" } = {},
) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: waitFor, timeout });
    const title = await page.title();
    const text = await page.evaluate(() => {
      // Remove scripts, styles, nav, footer for cleaner text
      const remove = document.querySelectorAll(
        "script,style,nav,footer,header,aside,[role=navigation]",
      );
      remove.forEach((el) => el.remove());
      return document.body?.innerText || "";
    });
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]"))
        .slice(0, 30)
        .map((a) => ({
          text: (a.innerText || a.textContent || "").trim().substring(0, 80),
          href: a.href,
        }))
        .filter((l) => l.text && l.href && !l.href.startsWith("javascript:")),
    );
    return {
      title,
      url: page.url(),
      text:
        text.substring(0, 8000) +
        (text.length > 8000 ? "\n...(truncated)" : ""),
      links: links.slice(0, 20),
    };
  } finally {
    await page.close();
  }
}

/**
 * Take a screenshot of a URL. Returns { path, base64, media_type }.
 */
async function browserScreenshot(
  url,
  { width = 1280, height = 800, fullPage = false, timeout = 30000 } = {},
) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: "networkidle", timeout });
    const buf = await page.screenshot({ type: "png", fullPage });
    // Save to temp file so user can inspect it
    const os = require("os");
    const pathMod = require("path");
    const fs = require("fs");
    const tmpPath = pathMod.join(
      os.tmpdir(),
      `nex-screenshot-${Date.now()}.png`,
    );
    fs.writeFileSync(tmpPath, buf, { mode: 0o600 });
    return {
      path: tmpPath,
      base64: buf.toString("base64"),
      media_type: "image/png",
      title: await page.title(),
      url: page.url(),
    };
  } finally {
    await page.close();
  }
}

/**
 * Click an element on a page (by CSS selector or visible text).
 */
async function browserClick(url, { selector, text, timeout = 30000 } = {}) {
  if (!selector && !text) throw new Error("selector or text is required");
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    if (text) {
      await page
        .getByText(text, { exact: false })
        .first()
        .click({ timeout: 10000 });
    } else {
      await page.locator(selector).first().click({ timeout: 10000 });
    }
    await page.waitForLoadState("domcontentloaded");
    const title = await page.title();
    const newUrl = page.url();
    return `Clicked — now at: ${newUrl} (${title})`;
  } finally {
    await page.close();
  }
}

/**
 * Fill a form field and optionally submit.
 */
async function browserFill(
  url,
  { selector, value, submit = false, timeout = 30000 } = {},
) {
  if (!selector || value === undefined)
    throw new Error("selector and value are required");
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    await page.fill(selector, String(value));
    if (submit) {
      await page.keyboard.press("Enter");
      await page.waitForLoadState("domcontentloaded");
    }
    return `Filled "${selector}" with value. ${submit ? `Submitted → ${page.url()}` : "Not submitted."}`;
  } finally {
    await page.close();
  }
}

module.exports = {
  isPlaywrightAvailable,
  browserNavigate,
  browserScreenshot,
  browserClick,
  browserFill,
  closeBrowser,
  INSTALL_MSG,
};

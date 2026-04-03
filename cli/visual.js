/**
 * cli/visual.js — Visual Development Tools
 *
 * Pixel-level diffing, responsive sweeps, image annotation,
 * hot-reload watch loops, design token extraction, and design comparison.
 *
 * Dependencies: pixelmatch, pngjs (installed), playwright (optional).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const TMP_PREFIX = "nex-visual-";

function tmpPath(suffix) {
  return path.join(os.tmpdir(), `${TMP_PREFIX}${Date.now()}-${suffix}`);
}

// ─── Lazy imports (fail gracefully) ──────────────────────────

let _PNG = null;
function getPNG() {
  if (!_PNG) _PNG = require("pngjs").PNG;
  return _PNG;
}

let _pixelmatch = null;
function getPixelmatch() {
  if (!_pixelmatch) {
    const mod = require("pixelmatch");
    _pixelmatch = mod.default || mod;
  }
  return _pixelmatch;
}

// ─── 1. Pixel Diff ──────────────────────────────────────────

/**
 * Compare two PNG images pixel-by-pixel.
 * Returns { diffPath, diffPercent, totalPixels, changedPixels, regionSummary, beforePath, afterPath }
 */
function pixelDiff(beforePath, afterPath, { threshold = 0.1 } = {}) {
  const PNG = getPNG();
  const pixelmatch = getPixelmatch();

  const imgBefore = PNG.sync.read(fs.readFileSync(beforePath));
  const imgAfter = PNG.sync.read(fs.readFileSync(afterPath));

  // Handle size mismatches by using the larger canvas
  const width = Math.max(imgBefore.width, imgAfter.width);
  const height = Math.max(imgBefore.height, imgAfter.height);

  // Resize both images to common canvas if needed
  const bufBefore = padToSize(imgBefore, width, height);
  const bufAfter = padToSize(imgAfter, width, height);

  const diff = new PNG({ width, height });
  const changedPixels = pixelmatch(
    bufBefore,
    bufAfter,
    diff.data,
    width,
    height,
    { threshold, includeAA: false },
  );

  const totalPixels = width * height;
  const diffPercent = ((changedPixels / totalPixels) * 100).toFixed(1);

  // Analyze which regions changed (divide into 3x3 grid)
  const regionSummary = analyzeRegions(diff.data, width, height, 3, 3);

  const diffPath = tmpPath("diff.png");
  fs.writeFileSync(diffPath, PNG.sync.write(diff), { mode: 0o600 });

  return {
    diffPath,
    diffPercent: parseFloat(diffPercent),
    totalPixels,
    changedPixels,
    regionSummary,
    beforePath,
    afterPath,
    width,
    height,
  };
}

/**
 * Pad a PNG image to a target size (fills extra space with transparent pixels).
 */
function padToSize(img, targetW, targetH) {
  if (img.width === targetW && img.height === targetH) return img.data;
  const buf = Buffer.alloc(targetW * targetH * 4, 0);
  for (let y = 0; y < img.height; y++) {
    const srcOff = y * img.width * 4;
    const dstOff = y * targetW * 4;
    img.data.copy(buf, dstOff, srcOff, srcOff + img.width * 4);
  }
  return buf;
}

/**
 * Divide diff image into grid regions and report which regions have changes.
 */
function analyzeRegions(diffData, width, height, cols, rows) {
  const regionNames = [
    ["top-left", "top-center", "top-right"],
    ["middle-left", "center", "middle-right"],
    ["bottom-left", "bottom-center", "bottom-right"],
  ];
  const cellW = Math.ceil(width / cols);
  const cellH = Math.ceil(height / rows);
  const regions = [];

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      let changed = 0;
      let total = 0;
      const x0 = rx * cellW;
      const y0 = ry * cellH;
      const x1 = Math.min(x0 + cellW, width);
      const y1 = Math.min(y0 + cellH, height);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          total++;
          const idx = (y * width + x) * 4;
          // pixelmatch marks changed pixels in red (R=255)
          if (diffData[idx] > 0 || diffData[idx + 1] > 0) changed++;
        }
      }
      if (changed > 0) {
        const pct = ((changed / total) * 100).toFixed(1);
        const name =
          regionNames[ry] && regionNames[ry][rx]
            ? regionNames[ry][rx]
            : `row${ry}-col${rx}`;
        regions.push({ name, changedPercent: parseFloat(pct), changed, total });
      }
    }
  }

  // Sort by most changed first
  regions.sort((a, b) => b.changedPercent - a.changedPercent);
  return regions;
}

// ─── 2. Responsive Sweep ────────────────────────────────────

const DEFAULT_VIEWPORTS = [
  { width: 320, label: "mobile-sm" },
  { width: 768, label: "tablet" },
  { width: 1024, label: "desktop-sm" },
  { width: 1440, label: "desktop" },
  { width: 1920, label: "desktop-lg" },
];

/**
 * Screenshot a URL at multiple viewport widths.
 * Returns array of { label, width, path, base64, media_type }
 */
async function responsiveSweep(
  url,
  { viewports = DEFAULT_VIEWPORTS, height = 800, fullPage = false, timeout = 30000 } = {},
) {
  const { browserScreenshot } = require("./browser");
  const results = [];

  for (const vp of viewports) {
    const result = await browserScreenshot(url, {
      width: vp.width,
      height,
      fullPage,
      timeout,
    });
    results.push({
      label: vp.label,
      width: vp.width,
      path: result.path,
      base64: result.base64,
      media_type: result.media_type,
    });
  }

  return results;
}

// ─── 3. Image Annotation ────────────────────────────────────

/**
 * Draw annotation overlays (boxes, arrows) on a PNG image.
 * annotations: [{ type: "box"|"arrow", x, y, width, height, label, color }]
 * Returns { path, base64, media_type }
 */
function annotateImage(imagePath, annotations = []) {
  const PNG = getPNG();
  const img = PNG.sync.read(fs.readFileSync(imagePath));

  for (const ann of annotations) {
    const color = parseColor(ann.color || "#FF0000");
    if (ann.type === "box") {
      drawRect(img, ann.x || 0, ann.y || 0, ann.width || 50, ann.height || 50, color, ann.thickness || 3);
      if (ann.label) {
        drawLabel(img, ann.x || 0, (ann.y || 0) - 14, ann.label, color);
      }
    } else if (ann.type === "arrow") {
      drawArrow(img, ann.x || 0, ann.y || 0, ann.toX || ann.x + 50, ann.toY || ann.y, color, ann.thickness || 3);
      if (ann.label) {
        drawLabel(img, ann.x || 0, (ann.y || 0) - 14, ann.label, color);
      }
    } else if (ann.type === "circle") {
      drawCircle(img, ann.x || 0, ann.y || 0, ann.radius || 20, color, ann.thickness || 3);
      if (ann.label) {
        drawLabel(img, (ann.x || 0) - (ann.radius || 20), (ann.y || 0) - (ann.radius || 20) - 14, ann.label, color);
      }
    }
  }

  const outPath = tmpPath("annotated.png");
  fs.writeFileSync(outPath, PNG.sync.write(img), { mode: 0o600 });
  const base64 = fs.readFileSync(outPath).toString("base64");
  return { path: outPath, base64, media_type: "image/png" };
}

function parseColor(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
    a: 255,
  };
}

function setPixel(img, x, y, color) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const idx = (y * img.width + x) * 4;
  // Semi-transparent overlay blending
  img.data[idx] = color.r;
  img.data[idx + 1] = color.g;
  img.data[idx + 2] = color.b;
  img.data[idx + 3] = color.a;
}

function drawRect(img, x, y, w, h, color, thickness = 3) {
  for (let t = 0; t < thickness; t++) {
    // Top and bottom edges
    for (let dx = 0; dx < w; dx++) {
      setPixel(img, x + dx, y + t, color);
      setPixel(img, x + dx, y + h - 1 - t, color);
    }
    // Left and right edges
    for (let dy = 0; dy < h; dy++) {
      setPixel(img, x + t, y + dy, color);
      setPixel(img, x + w - 1 - t, y + dy, color);
    }
  }
}

function drawLine(img, x0, y0, x1, y1, color, thickness = 3) {
  // Bresenham's line algorithm with thickness
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0,
    cy = y0;

  while (true) {
    // Draw thick point
    const half = Math.floor(thickness / 2);
    for (let tx = -half; tx <= half; tx++) {
      for (let ty = -half; ty <= half; ty++) {
        setPixel(img, cx + tx, cy + ty, color);
      }
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

function drawArrow(img, x0, y0, x1, y1, color, thickness = 3) {
  drawLine(img, x0, y0, x1, y1, color, thickness);
  // Arrowhead
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const headLen = 15;
  const a1 = angle + Math.PI * 0.8;
  const a2 = angle - Math.PI * 0.8;
  drawLine(
    img,
    x1,
    y1,
    Math.round(x1 + headLen * Math.cos(a1)),
    Math.round(y1 + headLen * Math.sin(a1)),
    color,
    thickness,
  );
  drawLine(
    img,
    x1,
    y1,
    Math.round(x1 + headLen * Math.cos(a2)),
    Math.round(y1 + headLen * Math.sin(a2)),
    color,
    thickness,
  );
}

function drawCircle(img, cx, cy, radius, color, thickness = 3) {
  for (let t = 0; t < thickness; t++) {
    const r = radius - t;
    for (let angle = 0; angle < 360; angle += 0.5) {
      const rad = (angle * Math.PI) / 180;
      const px = Math.round(cx + r * Math.cos(rad));
      const py = Math.round(cy + r * Math.sin(rad));
      setPixel(img, px, py, color);
    }
  }
}

/**
 * Draw a simple bitmap label (5x7 pixel font for basic ASCII).
 * Falls back to drawing a colored bar with dots for each character.
 */
function drawLabel(img, x, y, text, color) {
  // Simple: draw a background bar + colored dots to indicate text presence
  const charW = 6;
  const labelW = text.length * charW + 4;
  const labelH = 12;
  // Draw background (dark semi-transparent)
  for (let dy = 0; dy < labelH; dy++) {
    for (let dx = 0; dx < labelW; dx++) {
      setPixel(img, x + dx, y + dy, { r: 0, g: 0, b: 0, a: 200 });
    }
  }
  // Draw a colored underline to indicate the annotation
  for (let dx = 0; dx < labelW; dx++) {
    setPixel(img, x + dx, y + labelH - 1, color);
    setPixel(img, x + dx, y + labelH - 2, color);
  }
  // Draw simple block characters
  for (let i = 0; i < text.length; i++) {
    const cx = x + 2 + i * charW;
    // Fill a small block per character (3x7 pixels)
    for (let dy = 2; dy < 9; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        setPixel(img, cx + dx, y + dy, color);
      }
    }
  }
}

// ─── 4. Hot-Reload Visual Watch ─────────────────────────────

/**
 * Watch files, wait for changes + HMR, screenshot, analyze.
 * Returns an async generator yielding { iteration, path, analysis } for each change.
 *
 * @param {string} url - URL to screenshot
 * @param {string[]} watchPaths - File paths/dirs to watch
 * @param {object} opts - { maxIterations, hmrDelay, width, height, onScreenshot }
 */
async function* visualWatch(
  url,
  watchPaths,
  { maxIterations = 20, hmrDelay = 1500, width = 1280, height = 800, timeout = 30000 } = {},
) {
  const { browserScreenshot } = require("./browser");
  const chokidar = tryRequire("chokidar");

  // Take initial baseline screenshot
  let prevShot = await browserScreenshot(url, { width, height, timeout });
  yield {
    iteration: 0,
    type: "baseline",
    path: prevShot.path,
    base64: prevShot.base64,
    media_type: prevShot.media_type,
  };

  if (!chokidar) {
    yield {
      iteration: -1,
      type: "error",
      message:
        "chokidar not installed — watch mode requires it. Install with: npm install chokidar",
    };
    return;
  }

  let iteration = 0;
  let changeDetected = false;

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    ignored: /(node_modules|\.git|dist)/,
  });

  watcher.on("change", () => {
    changeDetected = true;
  });

  try {
    while (iteration < maxIterations) {
      // Wait for a file change
      await waitFor(() => changeDetected, 300000); // 5 min max wait
      changeDetected = false;
      iteration++;

      // Wait for HMR to settle
      await sleep(hmrDelay);

      // Take new screenshot
      const newShot = await browserScreenshot(url, { width, height, timeout });

      // Diff against previous
      let diff = null;
      try {
        diff = pixelDiff(prevShot.path, newShot.path);
      } catch {
        // If diff fails (size mismatch etc.), just report the new screenshot
      }

      prevShot = newShot;

      yield {
        iteration,
        type: "change",
        path: newShot.path,
        base64: newShot.base64,
        media_type: newShot.media_type,
        diff: diff
          ? {
              diffPath: diff.diffPath,
              diffPercent: diff.diffPercent,
              changedPixels: diff.changedPixels,
              regions: diff.regionSummary,
            }
          : null,
      };
    }
  } finally {
    await watcher.close();
  }
}

function tryRequire(mod) {
  try {
    return require(mod);
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitFor(fn, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (fn()) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve();
      }
    }, 200);
    const timer = setTimeout(() => {
      clearInterval(interval);
      reject(new Error("Watch timeout — no file changes detected"));
    }, timeoutMs);
  });
}

// ─── 5. Design Token Extraction ─────────────────────────────

/**
 * Extract design tokens (colors, approximate spacing) from a PNG screenshot.
 * Uses pixel sampling to identify dominant colors and spacing patterns.
 * Returns { colors, spacing, dimensions }
 */
function extractDesignTokens(imagePath, { sampleRate = 4 } = {}) {
  const PNG = getPNG();
  const img = PNG.sync.read(fs.readFileSync(imagePath));

  // Extract dominant colors via frequency counting
  const colorMap = new Map();
  for (let y = 0; y < img.height; y += sampleRate) {
    for (let x = 0; x < img.width; x += sampleRate) {
      const idx = (y * img.width + x) * 4;
      const r = img.data[idx];
      const g = img.data[idx + 1];
      const b = img.data[idx + 2];
      const a = img.data[idx + 3];
      if (a < 128) continue; // Skip transparent
      // Quantize to reduce noise (round to nearest 8)
      const qr = Math.round(r / 8) * 8;
      const qg = Math.round(g / 8) * 8;
      const qb = Math.round(b / 8) * 8;
      const key = `${qr},${qg},${qb}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
  }

  // Sort by frequency, take top 20
  const sortedColors = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const totalSamples = sortedColors.reduce((s, c) => s + c[1], 0);
  const colors = sortedColors.map(([key, count]) => {
    const [r, g, b] = key.split(",").map(Number);
    return {
      hex: rgbToHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      frequency: parseFloat(((count / totalSamples) * 100).toFixed(1)),
      category: categorizeColor(r, g, b),
    };
  });

  // Detect horizontal spacing patterns (gaps between content blocks)
  const spacing = detectSpacing(img);

  return {
    colors,
    spacing,
    dimensions: { width: img.width, height: img.height },
    imagePath,
  };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, "0")).join("")
  );
}

function categorizeColor(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 240) return "white/background";
  if (brightness < 30) return "black/text";
  if (brightness < 80) return "dark";
  if (r > 200 && g < 100 && b < 100) return "red/danger";
  if (r < 100 && g > 150 && b < 100) return "green/success";
  if (r < 100 && g < 100 && b > 200) return "blue/primary";
  if (r > 200 && g > 200 && b < 100) return "yellow/warning";
  if (r > 200 && g > 100 && b < 50) return "orange/accent";
  if (brightness > 200) return "light/subtle";
  return "midtone";
}

/**
 * Detect common spacing values by scanning for horizontal/vertical gaps.
 */
function detectSpacing(img) {
  const gaps = [];

  // Scan horizontal lines for content boundaries (significant color changes)
  let inContent = false;
  let gapStart = 0;
  const bgColor = detectBackgroundColor(img);

  for (let y = 0; y < img.height; y++) {
    let isBlank = true;
    for (let x = 0; x < img.width; x += 4) {
      const idx = (y * img.width + x) * 4;
      if (
        Math.abs(img.data[idx] - bgColor.r) > 20 ||
        Math.abs(img.data[idx + 1] - bgColor.g) > 20 ||
        Math.abs(img.data[idx + 2] - bgColor.b) > 20
      ) {
        isBlank = false;
        break;
      }
    }

    if (isBlank && inContent) {
      inContent = false;
      gapStart = y;
    } else if (!isBlank && !inContent) {
      inContent = true;
      if (gapStart > 0) {
        const gap = y - gapStart;
        if (gap >= 4 && gap <= 200) gaps.push(gap);
      }
    }
  }

  // Find common spacing values
  const gapFreq = new Map();
  for (const g of gaps) {
    // Round to nearest 4px (common CSS increments)
    const rounded = Math.round(g / 4) * 4;
    gapFreq.set(rounded, (gapFreq.get(rounded) || 0) + 1);
  }

  return [...gapFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([px, count]) => ({ px, occurrences: count }));
}

function detectBackgroundColor(img) {
  // Sample corners to determine background color
  const corners = [
    [0, 0],
    [img.width - 1, 0],
    [0, img.height - 1],
    [img.width - 1, img.height - 1],
  ];
  let rSum = 0,
    gSum = 0,
    bSum = 0;
  for (const [x, y] of corners) {
    const idx = (y * img.width + x) * 4;
    rSum += img.data[idx];
    gSum += img.data[idx + 1];
    bSum += img.data[idx + 2];
  }
  return { r: Math.round(rSum / 4), g: Math.round(gSum / 4), b: Math.round(bSum / 4) };
}

// ─── 6. Design Comparison (Figma/Reference) ─────────────────

/**
 * Compare a live screenshot against a reference design image.
 * Returns pixel diff result plus a structured comparison object.
 */
async function designCompare(
  url,
  referencePath,
  { width, height = 800, fullPage = false, threshold = 0.1, timeout = 30000 } = {},
) {
  const { browserScreenshot } = require("./browser");
  const PNG = getPNG();

  // Read reference to determine width if not specified
  const refImg = PNG.sync.read(fs.readFileSync(referencePath));
  const vWidth = width || refImg.width;
  const vHeight = height || refImg.height;

  // Take live screenshot at the reference dimensions
  const liveShot = await browserScreenshot(url, {
    width: vWidth,
    height: vHeight,
    fullPage,
    timeout,
  });

  // Pixel diff
  const diff = pixelDiff(referencePath, liveShot.path, { threshold });

  // Generate annotated reference showing problem areas
  const annotated = annotateImage(liveShot.path, diff.regionSummary
    .filter((r) => r.changedPercent > 1)
    .map((r, i) => {
      const cols = 3, rows = 3;
      const cellW = Math.ceil(diff.width / cols);
      const cellH = Math.ceil(diff.height / rows);
      const regionNames = [
        ["top-left", "top-center", "top-right"],
        ["middle-left", "center", "middle-right"],
        ["bottom-left", "bottom-center", "bottom-right"],
      ];
      // Find grid position from region name
      let rx = 0, ry = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (regionNames[row][col] === r.name) {
            rx = col;
            ry = row;
          }
        }
      }
      return {
        type: "box",
        x: rx * cellW + 2,
        y: ry * cellH + 2,
        width: cellW - 4,
        height: cellH - 4,
        label: `${r.name}: ${r.changedPercent}%`,
        color: r.changedPercent > 10 ? "#FF0000" : "#FFAA00",
      };
    }),
  );

  return {
    livePath: liveShot.path,
    referencePath,
    diffPath: diff.diffPath,
    annotatedPath: annotated.path,
    diffPercent: diff.diffPercent,
    changedPixels: diff.changedPixels,
    totalPixels: diff.totalPixels,
    regions: diff.regionSummary,
    liveBase64: liveShot.base64,
    diffBase64: fs.readFileSync(diff.diffPath).toString("base64"),
    annotatedBase64: annotated.base64,
  };
}

module.exports = {
  pixelDiff,
  responsiveSweep,
  annotateImage,
  visualWatch,
  extractDesignTokens,
  designCompare,
  DEFAULT_VIEWPORTS,
};

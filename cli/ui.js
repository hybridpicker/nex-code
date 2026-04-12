/**
 * cli/ui.js — ANSI Colors, Banner, and Terminal Utilities
 * Rich terminal output with markdown rendering support
 */

const { T } = require("./theme");
const C = T;
const path = require("path");

function colorLine(text, rgb) {
  return (
    [...text]
      .map((ch) => {
        if (ch === " ") return ch;
        return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${ch}`;
      })
      .join("") + C.reset
  );
}

function lerpColor(stops, t) {
  const seg = (stops.length - 1) * t;
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const f = seg - i;
  return [
    Math.round(stops[i][0] + (stops[i + 1][0] - stops[i][0]) * f),
    Math.round(stops[i][1] + (stops[i + 1][1] - stops[i][1]) * f),
    Math.round(stops[i][2] + (stops[i + 1][2] - stops[i][2]) * f),
  ];
}

// Dog mascot — minimal 8×6 pixel art (1 = filled, 0 = background)
const DOG_MATRIX = [
  "01100110",
  "01111110",
  "01111110",
  "01011010",
  "01111110",
  "00111100",
];

function renderDog(matrix, color) {
  const lines = [];
  for (let r = 0; r < matrix.length; r += 2) {
    let line = "";
    for (let c = 0; c < matrix[0].length; c++) {
      const top = matrix[r][c] === "1";
      const bot = r + 1 < matrix.length && matrix[r + 1][c] === "1";
      if (top && bot) line += `${color}█\x1b[0m`;
      else if (top && !bot) line += `${color}▀\x1b[0m`;
      else if (!top && bot) line += `${color}▄\x1b[0m`;
      else line += " ";
    }
    lines.push(line);
  }
  return lines;
}

function banner(modelName, cwd, opts = {}) {
  const B = C.bold;
  const r = C.reset;

  const dogLines = renderDog(DOG_MATRIX, T.banner_logo);
  const yoloTag = opts.yolo ? `  ${B}${T.banner_yolo}⚡ YOLO${r}` : "";
  const geminiTag = opts.gemini ? `  ${B}${T.banner_gemini}✦ GEMINI${r}` : "";
  const version = require("../package.json").version;
  const project = cwd ? path.basename(cwd) : null;
  const modelChip = `${T.banner_model}[${modelName || "model"}]${r}`;
  const projectChip = `${T.banner_version}[${project || "workspace"}]${r}`;

  const subtitles = [
    `  ${T.banner_name}${B}nex-code${r}  ${T.banner_version}v${version}${r}`,
    `  ${modelChip} ${projectChip}`,
    `  ${T.banner_logo}${B}terminal workbench${r}  ${T.muted}·  /help${r}${geminiTag}${yoloTag}`,
    "",
  ];

  const total = Math.max(dogLines.length, subtitles.length);
  const dogOff = Math.floor((total - dogLines.length) / 2);
  const textOff = Math.floor((total - subtitles.length) / 2);
  const dogWidth = DOG_MATRIX[0].length;

  const lines = [];
  for (let i = 0; i < total; i++) {
    const dog = dogLines[i - dogOff] ?? " ".repeat(dogWidth);
    const text = subtitles[i - textOff] ?? "";
    lines.push(dog + text);
  }

  console.log("\n" + lines.join("\n") + "\n");
}

// Re-exports from spinner.js and format.js for backward compatibility
const {
  Spinner,
  MultiProgress,
  TaskProgress,
  ToolProgress,
  setActiveTaskProgress,
  getActiveTaskProgress,
  cleanupTerminal,
} = require("./spinner");
const {
  formatToolCall,
  formatResult,
  getToolSpinnerText,
  formatToolSummary,
  formatSectionHeader,
  formatMilestone,
  getThinkingVerb,
  setActiveModelForSpinner,
} = require("./format");

module.exports = {
  C,
  banner,
  // Re-exported from spinner.js
  Spinner,
  MultiProgress,
  TaskProgress,
  ToolProgress,
  setActiveTaskProgress,
  getActiveTaskProgress,
  cleanupTerminal,
  // Re-exported from format.js
  formatToolCall,
  formatResult,
  getToolSpinnerText,
  formatToolSummary,
  formatSectionHeader,
  formatMilestone,
  getThinkingVerb,
  setActiveModelForSpinner,
};

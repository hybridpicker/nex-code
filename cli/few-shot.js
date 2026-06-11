"use strict";

/**
 * cli/few-shot.js — Dynamic few-shot example injection
 *
 * Selects a short "correct approach" example based on the detected task category
 * or active model and injects it as a synthetic user/assistant exchange before
 * the first LLM turn.
 *
 * Load priority:
 *   1. ~/.nex-code/examples/models/<model>.md - private model-specific
 *   2. <package>/examples/models/<model>.md   - bundled model-specific
 *   3. ~/.nex-code/examples/<category>.md      - private category-specific
 *   4. <package>/examples/<category>.md        - bundled category-specific
 *
 * Private examples can be promoted from high-scoring sessions via:
 *   nex-code --extract-examples  (or scripts/extract-examples.js)
 *
 * Format of example files (YAML-ish, see examples/ dir):
 *   user: <user message>
 *   A: |
 *     <assistant response showing correct tool sequence>
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { detectCategory } = require("./task-router");

// Where user-private examples live (outside the repo, not committed)
const PRIVATE_EXAMPLES_DIR = path.join(os.homedir(), ".nex-code", "examples");

// Bundled generic examples shipped with nex-code (safe for public repo)
const BUNDLED_EXAMPLES_DIR = path.join(__dirname, "..", "examples");
const MODEL_EXAMPLES_SUBDIR = "models";

const WRITE_INTENT_RE =
  /\b(add|create|implement|fix|patch|update|change|modify|edit|refactor|write|build|remove|rename|replace|migrate|wire|integrate)\b/i;

function _hasWriteIntent(userInput) {
  const stripped = String(userInput || "").replace(
    /\b(?:do not|don't|without|no)\s+(?:edit|change|modify|write|fix|update|create|add)(?:s|ing)?\b/gi,
    "",
  );
  return WRITE_INTENT_RE.test(stripped);
}

function _isReadOnlyInput(userInput) {
  const text = String(userInput || "");
  if (_hasWriteIntent(text)) return false;
  return /\b(read|inspect|summari[sz]e|describe|explain|tell me|review)\b/i.test(
    text,
  );
}

function _modelExampleKeys(modelId) {
  const raw = String(modelId || "").trim().toLowerCase();
  if (!raw) return [];

  const keys = new Set();
  const addKey = (value) => {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/(?:-cloud|:cloud)\b/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (normalized) keys.add(normalized);
  };

  addKey(raw);
  addKey(raw.replace(/^[a-z0-9_-]+:/, ""));
  addKey(raw.split(":")[0]);
  addKey(raw.replace(/:.*$/, ""));
  return [...keys];
}

/**
 * Parse a simple YAML-ish example file.
 * Returns { user, assistant } or null on parse failure.
 * @param {string} filePath
 * @returns {{ user: string, assistant: string } | null}
 */
function _parseExampleFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    // Strip HTML comments
    const content = raw.replace(/<!--[\s\S]*?-->/g, "").trim();

    // Extract user line
    const userMatch = content.match(/^user:\s*(.+)$/m);
    if (!userMatch) return null;
    const user = userMatch[1].trim();

    // Extract assistant block (A: | followed by indented lines)
    const aIdx = content.indexOf("\nA: |");
    if (aIdx === -1) return null;
    const afterA = content.slice(aIdx + 5); // skip "\nA: |"
    const assistantLines = [];
    let pendingBlanks = 0;
    for (const line of afterA.split("\n")) {
      // Collect indented lines (2+ spaces); allow blank lines within the block
      if (line.startsWith("  ")) {
        // Flush any buffered blank lines before adding real content
        while (pendingBlanks > 0) {
          assistantLines.push("");
          pendingBlanks--;
        }
        assistantLines.push(line.slice(2)); // strip leading 2 spaces
      } else if (line.trim() === "") {
        // Buffer blank lines — only include them if more indented content follows
        if (assistantLines.length > 0) pendingBlanks++;
      } else {
        break;
      }
    }
    if (assistantLines.length === 0) return null;
    const assistant = assistantLines.join("\n").trim();
    return { user, assistant };
  } catch {
    return null;
  }
}

/**
 * Load the example for a given category.
 * Tries private dir first, falls back to bundled.
 * @param {string} categoryId
 * @returns {{ user: string, assistant: string } | null}
 */
function loadExampleForCategory(categoryId) {
  const filename = `${categoryId}.md`;

  // 1. Private user example (highest priority — may be extracted from real sessions)
  const privatePath = path.join(PRIVATE_EXAMPLES_DIR, filename);
  if (fs.existsSync(privatePath)) {
    const parsed = _parseExampleFile(privatePath);
    if (parsed) return parsed;
  }

  // 2. Bundled generic example
  const bundledPath = path.join(BUNDLED_EXAMPLES_DIR, filename);
  if (fs.existsSync(bundledPath)) {
    return _parseExampleFile(bundledPath);
  }

  return null;
}

/**
 * Load the example for a given model.
 * Tries private dir first, falls back to bundled.
 * @param {string} modelId
 * @returns {{ user: string, assistant: string } | null}
 */
function loadExampleForModel(modelId) {
  for (const key of _modelExampleKeys(modelId)) {
    const filename = `${key}.md`;
    for (const root of [PRIVATE_EXAMPLES_DIR, BUNDLED_EXAMPLES_DIR]) {
      const examplePath = path.join(root, MODEL_EXAMPLES_SUBDIR, filename);
      if (!fs.existsSync(examplePath)) continue;
      const parsed = _parseExampleFile(examplePath);
      if (parsed) return parsed;
    }
  }
  return null;
}

/**
 * Get the few-shot example pair for a user's input message.
 * Returns null if no example exists, input is too short, or NEX_FEW_SHOT=0.
 *
 * @param {string} userInput
 * @param {string} [modelId]
 * @returns {{ user: string, assistant: string } | null}
 */
function getFewShotForInput(userInput, modelId = null) {
  if (process.env.NEX_FEW_SHOT === "0") return null;
  if (!userInput || userInput.length < 8) return null;
  if (_isReadOnlyInput(userInput)) return null;

  const category = detectCategory(userInput);
  if (!category) return null;

  const modelExample = loadExampleForModel(modelId);
  if (modelExample) return modelExample;

  // The "coding" category is a catch-all fallback. It can match short or
  // non-English implementation prompts where a generic example is more likely
  // to distract than help, so only specific categories get few-shot examples.
  if (category.id === "coding") {
    return null;
  }

  return loadExampleForCategory(category.id);
}

/**
 * List available example categories (both private and bundled).
 * @returns {string[]}
 */
function listAvailableExamples() {
  const seen = new Set();
  for (const dir of [PRIVATE_EXAMPLES_DIR, BUNDLED_EXAMPLES_DIR]) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".md")) seen.add(f.replace(".md", ""));
      }
      const modelDir = path.join(dir, MODEL_EXAMPLES_SUBDIR);
      for (const f of fs.readdirSync(modelDir)) {
        if (f.endsWith(".md")) seen.add(`models/${f.replace(".md", "")}`);
      }
    } catch {
      /* dir may not exist */
    }
  }
  return [...seen].sort();
}

/**
 * Save an example for a category to the private directory.
 * Used by extract-examples.js to promote high-scoring session turns.
 *
 * @param {string} categoryId
 * @param {{ user: string, assistant: string }} example
 */
function savePrivateExample(categoryId, example) {
  if (!fs.existsSync(PRIVATE_EXAMPLES_DIR)) {
    fs.mkdirSync(PRIVATE_EXAMPLES_DIR, { recursive: true });
  }
  const content = `<!-- Auto-extracted from high-scoring session — edit as needed -->

user: ${example.user}

A: |
${example.assistant
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n")}
`;
  fs.writeFileSync(
    path.join(PRIVATE_EXAMPLES_DIR, `${categoryId}.md`),
    content,
    "utf-8",
  );
}

module.exports = {
  getFewShotForInput,
  loadExampleForCategory,
  loadExampleForModel,
  listAvailableExamples,
  savePrivateExample,
  PRIVATE_EXAMPLES_DIR,
  BUNDLED_EXAMPLES_DIR,
  MODEL_EXAMPLES_SUBDIR,
};

/**
 * cli/agent.js — Agentic Loop + Conversation State
 * Hybrid: chat + tool-use in a single conversation.
 */

const {
  C,
  Spinner,
  TaskProgress,
  formatToolCall,
  formatToolSummary,
  formatSectionHeader,
  formatMilestone,
  setActiveTaskProgress,
  getThinkingVerb,
  setActiveModelForSpinner,
} = require("./ui");
const { debugLog, warnLog } = require("./debug");
const { MilestoneTracker } = require("./milestone");
const { callStream } = require("./providers/registry");
const { parseToolArgs } = require("./ollama");
const { executeTool } = require("./tools");
const { gatherProjectContext } = require("./context");
const {
  fitToContext,
  forceCompress,
  getUsage,
  estimateTokens,
  buildProgressSnapshot,
} = require("./context-engine");
const { autoSave, flushAutoSave } = require("./session");
const {
  scoreMessages,
  formatScore,
  appendScoreHistory,
} = require("./session-scorer");
const {
  detectCategory,
  getModelForPhase,
  getPhaseBudget,
  isPhaseRoutingEnabled,
} = require("./task-router");

// Save session immediately — used on all terminal paths (break/return) so the
// debounced timeout doesn't race against process exit.
function saveNow(messages) {
  autoSave(messages);
  flushAutoSave();
}

/**
 * Returns true when a final assistant message is too terse to be useful —
 * e.g. "Done.", "Analysis complete", or any text under 80 chars.
 * Used by the post-turn enforcement hook to trigger a summary request.
 */
function isTooShort(text) {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (trimmed.length < 80) return true;
  const terse =
    /^(done|complete|finished|all done|analysis complete|finally done)[.!]*$/i;
  if (terse.test(trimmed)) return true;
  // Bare question with no prior context — matches session-scorer penalty pattern
  if (/^[^.!]{0,40}\?$/.test(trimmed)) return true;
  return false;
}

function _claimsVerificationOrCompletion(text) {
  if (!text || typeof text !== "string") return false;
  const sample = text.slice(-1200);
  return /\b(done|complete|completed|fixed|implemented|ready|verified|verification complete|tests? pass(?:ed)?|build pass(?:ed)?|all checks pass(?:ed)?|all good)\b/i.test(
    sample,
  );
}

function _statesVerificationGap(text) {
  if (!text || typeof text !== "string") return false;
  return /\b(not verified|verification (?:was )?not run|tests? (?:were )?not run|build (?:was )?not run|unchecked|unverified)\b/i.test(
    text,
  );
}

function _looksLikeUserDirectedQuestion(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const tail = trimmed.slice(-300);
  if (!tail.includes("?")) return false;
  return /(?:would you like|do you want|should i|shall i|can you clarify|could you clarify|what would you like me to|which (?:one|option|area|approach)|how would you like me to)\b/i.test(
    tail,
  );
}

function isTextDeliverablePath(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  return /\.(?:md|mdx|txt|rst|adoc)$/i.test(filePath);
}

/**
 * Score the current session and print the result, then persist score into
 * the autosave metadata.  Only runs when there were actual tool calls.
 */
function _scoreAndPrint(messages) {
  try {
    // Only score sessions that had meaningful agent activity
    const hasToolCalls = messages.some((m) => {
      if (m.role !== "assistant") return false;
      if (
        Array.isArray(m.content) &&
        m.content.some((b) => b && b.type === "tool_use")
      )
        return true;
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) return true;
      return false;
    });
    if (!hasToolCalls) return;

    const result = scoreMessages(messages);
    if (!result) return;

    console.log(formatScore(result, C));

    // Write score into the autosave file metadata
    try {
      const { _getSessionsDir } = require("./session");
      const fs = require("fs");
      const p = require("path").join(_getSessionsDir(), "_autosave.json");
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        data.score = result.score;
        data.scoreGrade = result.grade;
        data.scoreIssues = result.issues;
        fs.writeFileSync(p, JSON.stringify(data, null, 2));
      }
    } catch {
      /* non-critical — ignore */
    }

    // Persist score to benchmark history
    try {
      const { getActiveModel } = require("./ollama");
      const pkg = require("../package.json");
      appendScoreHistory(result.score, {
        version: pkg.version,
        model: getActiveModel ? getActiveModel() : null,
        sessionName: "_autosave",
        issues: result.issues,
      });
    } catch {
      /* non-critical — ignore */
    }
  } catch {
    /* scorer must never crash the agent */
  }
}
const { getMemoryContext } = require("./memory");
const {
  getDeploymentContextBlock,
  probeUrlServer,
  detectRuntimeDebugTarget,
} = require("./server-context");
const { getFewShotForInput } = require("./few-shot");
const {
  checkPermission,
  setPermission,
  savePermissions,
} = require("./permissions");
const { confirm, setAllowAlwaysHandler, getAutoConfirm } = require("./safety");
const {
  isPlanMode,
  getPlanModePrompt,
  PLAN_MODE_ALLOWED_TOOLS,
  setPlanContent,
  extractStepsFromText,
  createPlan,
  getActivePlan,
  startExecution,
  advancePlanStep,
  getPlanStepInfo,
} = require("./planner");
const { StreamRenderer } = require("./render");
const { runHooks } = require("./hooks");
const { routeMCPCall, getMCPToolDefinitions } = require("./mcp");
const {
  getSkillInstructions,
  getSkillToolDefinitions,
  routeSkillCall,
  matchSkillTriggers,
} = require("./skills");
const {
  trackUsage,
  estimateTokens: _estimateTokens,
  getSessionCosts,
  getProviderCostMode,
} = require("./costs");
/** Fallback token estimator (~4 chars per token). Works even when costs mock omits estimateTokens. */
function _estTok(text) {
  if (!text || typeof text !== "string") return 0;
  if (typeof _estimateTokens === "function") return _estimateTokens(text);
  return Math.ceil(text.length / 4);
}
const { validateToolArgs } = require("./tool-validator");
const {
  filterToolsForModel,
  getModelTier,
  PROVIDER_DEFAULT_TIER,
} = require("./tool-tiers");
const {
  getConfiguredProviders,
  getActiveProviderName,
  getActiveModelId,
  setActiveModel,
  MODEL_EQUIVALENTS,
} = require("./providers/registry");
const { getModelProfile, getModelBriefing } = require("./model-profiles");
const fsSync = require("fs");
const path = require("path");

// ─── Milestone compression ───────────────────────────────────
const MILESTONE_N = (() => {
  const v = parseInt(process.env.NEX_MILESTONE_STEPS ?? "5", 10);
  return Number.isFinite(v) && v >= 0 ? v : 5;
})();

function _emitMilestone(ms) {
  const banner = formatMilestone(
    ms.phaseName,
    ms.stepCount,
    ms.toolCounts,
    ms.elapsed,
    ms.filesRead,
    ms.filesModified,
  );
  // Append-only: no cursor-up-and-erase. The cursor-up/\x1b[J approach left
  // blank lines in terminal scrollback (copy-paste artifact) and caused visible
  // gaps when linesBack was off by even one line. Append is simpler and correct.
  process.stdout.write(`${banner}\n`);
}

// ─── Vision / Image Helpers ──────────────────────────────────
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|bmp|tiff?)$/i;
const IMAGE_PATH_RE =
  /(?:^|\s)((?:~|\.{1,2})?(?:\/[\w.\-@() ]+)+\.(?:png|jpe?g|gif|webp|bmp|tiff?))(?:\s|$)/gi;
const IMAGE_URL_RE =
  /(?:^|\s)(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?)(?:\s|$)/gi;
const CLIPBOARD_RE = /\b(?:clipboard|pasteboard|clipboard screenshot)\b/i;

function _detectImagePaths(text) {
  const paths = [];
  let m;
  IMAGE_PATH_RE.lastIndex = 0;
  while ((m = IMAGE_PATH_RE.exec(text)) !== null) {
    const raw = m[1].trim();
    const abs = raw.startsWith("~")
      ? raw.replace("~", process.env.HOME || "")
      : path.resolve(raw);
    if (fsSync.existsSync(abs)) paths.push({ raw, abs });
  }
  return paths;
}

function _detectImageURLs(text) {
  const urls = [];
  let m;
  IMAGE_URL_RE.lastIndex = 0;
  while ((m = IMAGE_URL_RE.exec(text)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

async function _downloadImageURL(url) {
  try {
    const axios = require("axios");
    const resp = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024, // 10 MB cap
      headers: { "User-Agent": "nex-code/vision" },
    });
    const contentType = resp.headers["content-type"] || "";
    const mediaType = contentType.startsWith("image/")
      ? contentType.split(";")[0]
      : _guessMediaType(url);
    return {
      data: Buffer.from(resp.data).toString("base64"),
      media_type: mediaType,
    };
  } catch {
    return null; // download failed — skip silently
  }
}

function _guessMediaType(urlOrPath) {
  const lower = urlOrPath.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".webp")) return "image/webp";
  return "image/png";
}

function _grabClipboardImage() {
  if (process.platform !== "darwin") return null;
  const { spawnSync } = require("child_process");
  // Try pngpaste first (brew install pngpaste) — best for image data
  const tmpPath = path.join(
    require("os").tmpdir(),
    `nex-clipboard-${Date.now()}.png`,
  );
  const pngpaste = spawnSync("pngpaste", [tmpPath], { timeout: 3000 });
  if (pngpaste.status === 0 && fsSync.existsSync(tmpPath)) {
    const buf = fsSync.readFileSync(tmpPath);
    if (buf.length > 100) {
      // valid image (not empty/error)
      return {
        data: buf.toString("base64"),
        media_type: "image/png",
        path: tmpPath,
      };
    }
    try {
      fsSync.unlinkSync(tmpPath);
    } catch (err) {
      console.error("Failed to unlink temp file:", err);
    }
  }
  // Fallback: osascript clipboard check
  const osascript = spawnSync(
    "osascript",
    [
      "-e",
      'try\nset imgData to the clipboard as «class PNGf»\nreturn "has_image"\non error\nreturn "no_image"\nend try',
    ],
    { timeout: 3000 },
  );
  if (osascript.stdout && osascript.stdout.toString().trim() === "has_image") {
    // Use osascript to write clipboard image to file
    const script = `
      set imgData to the clipboard as «class PNGf»
      set filePath to POSIX file "${tmpPath}"
      set fRef to open for access filePath with write permission
      write imgData to fRef
      close access fRef
    `;
    const writeResult = spawnSync("osascript", ["-e", script], {
      timeout: 5000,
    });
    if (writeResult.status === 0 && fsSync.existsSync(tmpPath)) {
      const buf = fsSync.readFileSync(tmpPath);
      if (buf.length > 100) {
        return {
          data: buf.toString("base64"),
          media_type: "image/png",
          path: tmpPath,
        };
      }
    }
  }
  return null;
}

function _imageToBase64(absPath) {
  const buf = fsSync.readFileSync(absPath);
  const ext = path.extname(absPath).toLowerCase().replace(".", "");
  const mediaType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
  return { data: buf.toString("base64"), media_type: mediaType };
}

function buildUserContent(text) {
  const imagePaths = _detectImagePaths(text);
  const imageURLs = _detectImageURLs(text);
  const wantsClipboard = CLIPBOARD_RE.test(text);
  const hasAsync = imageURLs.length > 0 || wantsClipboard;

  // Fast path: no images at all
  if (imagePaths.length === 0 && !hasAsync) return text;

  // Sync-only path (local files, no URLs, no clipboard)
  if (!hasAsync) {
    const blocks = [{ type: "text", text }];
    for (const img of imagePaths) {
      try {
        const { data, media_type } = _imageToBase64(img.abs);
        blocks.push({ type: "image", media_type, data });
      } catch {
        // File unreadable — skip silently
      }
    }
    return blocks.length > 1 ? blocks : text;
  }

  // Async path: return a Promise (caller must await)
  return (async () => {
    const blocks = [{ type: "text", text }];

    // Local files
    for (const img of imagePaths) {
      try {
        const { data, media_type } = _imageToBase64(img.abs);
        blocks.push({ type: "image", media_type, data });
      } catch (err) {
        debugLog(
          `${C.yellow}  ⚠ Path resolution failed: ${err.message}${C.reset}`,
        );
      }
    }

    // Remote URLs (parallel download)
    if (imageURLs.length > 0) {
      const results = await Promise.all(imageURLs.map(_downloadImageURL));
      for (const r of results) {
        if (r)
          blocks.push({
            type: "image",
            media_type: r.media_type,
            data: r.data,
          });
      }
    }

    // Clipboard image
    if (wantsClipboard) {
      const clip = _grabClipboardImage();
      if (clip) {
        blocks.push({
          type: "image",
          media_type: clip.media_type,
          data: clip.data,
        });
        // Append note so the model knows the image source
        blocks[0].text += `\n[Clipboard image attached: ${clip.path}]`;
      } else {
        blocks[0].text += "\n[No image found in clipboard]";
      }
    }

    return blocks.length > 1 ? blocks : text;
  })();
}

// ─── Frustration Detector ────────────────────────────────────

/**
 * Patterns that indicate user frustration.
 * Detected via regex (not LLM inference) for cost efficiency.
 */
const FRUSTRATION_PATTERNS = [
  /\bwtf\b/i,
  /\buff\b/i,
  /\bugh\b/i,
  /\bffs\b/i,
  /\bargh\b/i,
  /why (?:isn'?t|doesn'?t|won'?t|can'?t|don'?t)/i,
  /(?:still|again) (?:broken|not working|failing|wrong)/i,
  /already told you/i,
  /come on[!.]/i,
  /seriously\?/i,
  /how (?:many|much) (?:times|more)/i,
  /nothing (?:works?|is working)/i,
];

/**
 * Returns true if the input text shows signs of user frustration.
 * @param {string} text
 * @returns {boolean}
 */
function detectFrustration(text) {
  if (typeof text !== "string" || !text) return false;
  return FRUSTRATION_PATTERNS.some((p) => p.test(text));
}

// ─── LLM Output Repetition Detector ─────────────────────────

/**
 * Detect and truncate repeated paragraph/sentence patterns in LLM output.
 *
 * Strategy: split text into sentences (". " delimiter), build sliding windows
 * of 3 sentences, count occurrences. If any 3-sentence window appears 3+
 * times, the content is considered a repetition loop.
 *
 * Truncation rules:
 *  - Keep first 2 occurrences of the repeated block, then append a system note.
 *  - Additionally, if text is >8000 chars AND has a repetition pattern,
 *    hard-truncate to 3000 chars.
 *
 * @param {string} text — raw LLM response content
 * @returns {{ text: string, truncated: boolean, repeatCount: number }}
 */
function detectAndTruncateRepetition(text) {
  if (!text || text.length < 200)
    return { text, truncated: false, repeatCount: 0 };

  // Split into sentences using ". " as delimiter, keep delimiter attached
  const raw = text.split(/(?<=\. )/);
  const sentences = raw.filter((s) => s.trim().length > 0);

  if (sentences.length < 6) return { text, truncated: false, repeatCount: 0 };

  // Build sliding windows of 3 sentences and count occurrences
  const windowCounts = new Map();
  for (let i = 0; i <= sentences.length - 3; i++) {
    const window = sentences
      .slice(i, i + 3)
      .join("")
      .trim();
    // Only track non-trivial windows (>30 chars)
    if (window.length > 30) {
      windowCounts.set(window, (windowCounts.get(window) || 0) + 1);
    }
  }

  // Find the most-repeated window
  let maxCount = 0;
  let repeatedWindow = "";
  for (const [window, count] of windowCounts) {
    if (count > maxCount) {
      maxCount = count;
      repeatedWindow = window;
    }
  }

  if (maxCount < 3) return { text, truncated: false, repeatCount: maxCount };

  // Repetition detected — truncate to first 2 occurrences
  const SYSTEM_NOTE = `\n\n[SYSTEM: Output repetition detected — response truncated (${maxCount}× repeated paragraph)]`;

  let truncated;
  if (text.length > 8000) {
    // Hard truncate for very long outputs
    truncated = text.slice(0, 3000) + SYSTEM_NOTE;
  } else {
    // Find the position of the 3rd occurrence and cut there
    let occurrences = 0;
    let cutPos = -1;
    let searchFrom = 0;
    while (occurrences < 2) {
      const pos = text.indexOf(repeatedWindow, searchFrom);
      if (pos === -1) break;
      occurrences++;
      cutPos = pos + repeatedWindow.length;
      searchFrom = pos + 1;
    }
    truncated =
      cutPos > 0
        ? text.slice(0, cutPos) + SYSTEM_NOTE
        : text.slice(0, 3000) + SYSTEM_NOTE;
  }

  return { text: truncated, truncated: true, repeatCount: maxCount };
}

/**
 * Detect and truncate LLM output loops caused by repeated paragraphs.
 *
 * Strategy: split text by newlines, identify paragraphs ≥20 chars,
 * count occurrences. If any paragraph repeats more than maxRepeats times,
 * truncate the text after the maxRepeats-th occurrence and append a warning.
 *
 * This catches tight loops like a single sentence repeated 661× which may
 * not be caught by the sentence-window approach in detectAndTruncateRepetition.
 *
 * @param {string} text — raw LLM response content
 * @param {number} maxRepeats — max allowed repetitions before truncating (default 5)
 * @returns {{ text: string, truncated: boolean, repeatCount: number }}
 */
function detectAndTruncateLoop(text, maxRepeats = 5) {
  if (!text || text.length < 40)
    return { text, truncated: false, repeatCount: 0 };

  // Split by newlines and collect non-trivial paragraphs (≥20 chars)
  const lines = text.split("\n");
  const paragraphCounts = new Map();
  for (const line of lines) {
    const p = line.trim();
    if (p.length >= 20) {
      paragraphCounts.set(p, (paragraphCounts.get(p) || 0) + 1);
    }
  }

  // Find the most-repeated paragraph
  let maxCount = 0;
  let worstParagraph = "";
  for (const [para, count] of paragraphCounts) {
    if (count > maxCount) {
      maxCount = count;
      worstParagraph = para;
    }
  }

  // Dynamic threshold for file reading patterns to prevent timeout loops
  const isFileReadingPattern =
    worstParagraph.toLowerCase().includes("read_file") ||
    worstParagraph.toLowerCase().includes("reading");
  const effectiveMaxRepeats = isFileReadingPattern ? 2 : maxRepeats;

  if (maxCount <= effectiveMaxRepeats)
    return { text, truncated: false, repeatCount: maxCount };

  // Truncate after the maxRepeats-th occurrence of the repeated paragraph
  const WARNING = `\n\n⚠ [Response truncated: repeated paragraph detected (${maxCount}×)]`;

  let occurrences = 0;
  let cutPos = -1;
  let searchFrom = 0;
  while (occurrences < maxRepeats) {
    const pos = text.indexOf(worstParagraph, searchFrom);
    if (pos === -1) break;
    occurrences++;
    cutPos = pos + worstParagraph.length;
    searchFrom = pos + 1;
  }

  const truncatedText =
    cutPos > 0
      ? text.slice(0, cutPos) + WARNING
      : text.slice(0, 2000) + WARNING;

  return { text: truncatedText, truncated: true, repeatCount: maxCount };
}

// ─── Lazy Tool Loading ───────────────────────────────────────
// Cache tool definitions to avoid loading on every call
let cachedToolDefinitions = null;
let cachedSkillToolDefinitions = null;
let cachedMCPToolDefinitions = null;

/**
 * Get all tool definitions with lazy loading and caching.
 * Reduces startup time by ~50-100ms.
 */
function getAllToolDefinitions() {
  if (cachedToolDefinitions === null) {
    const { TOOL_DEFINITIONS } = require("./tools");
    cachedToolDefinitions = TOOL_DEFINITIONS;
  }

  if (cachedSkillToolDefinitions === null) {
    cachedSkillToolDefinitions = getSkillToolDefinitions();
  }

  if (cachedMCPToolDefinitions === null) {
    cachedMCPToolDefinitions = getMCPToolDefinitions();
  }

  return [
    ...cachedToolDefinitions,
    ...cachedSkillToolDefinitions,
    ...cachedMCPToolDefinitions,
  ];
}

/**
 * Clear tool definition cache (for testing or when tools change)
 */
function clearToolDefinitionsCache() {
  cachedToolDefinitions = null;
  cachedSkillToolDefinitions = null;
  cachedMCPToolDefinitions = null;
}

let MAX_ITERATIONS = 50;
function setMaxIterations(n) {
  if (Number.isFinite(n) && n > 0) MAX_ITERATIONS = n;
}

// Abort signal getter — set by cli/index.js to avoid circular dependency
let _getAbortSignal = () => null;
function setAbortSignalGetter(fn) {
  _getAbortSignal = fn;
}

// ─── System Prompt Cache ─────────────────────────────────────
// Cache system prompt to avoid rebuilding on every turn (saves 100-1000ms)
let cachedSystemPrompt = null;
let cachedContextHash = null;
let cachedModelRoutingGuide = null;
let _lastRenderedHeaderLine = "";
let _lastRenderedHeaderAt = 0;
let _lastRenderedSummaryLine = "";
let _lastRenderedSummaryAt = 0;

// ─── Tool Filter Cache ───────────────────────────────────────
// Cache filtered tool definitions per model (saves 5-10ms per iteration)
const toolFilterCache = new Map();

// ─── Early Tool Result Compression ───────────────────────────
// Compress large tool results to save context tokens
// Threshold raised from 5000 to 10000 — avoids compression overhead on medium outputs
const TOOL_RESULT_TOKEN_THRESHOLD = 10000;
const TOOL_RESULT_COMPRESS_TARGET = 6000;

// ─── Secret Scrubbing ─────────────────────────────────────────
// Redact common secret patterns from tool results before they enter the conversation.
// Matches env-style assignments for well-known secret prefixes (API_KEY, TOKEN, etc.)
const SECRET_SCRUB_RE =
  /\b((?:API|ACCESS|AUTH|BEARER|CLIENT|GITHUB|GITLAB|SLACK|STRIPE|TWILIO|SENDGRID|AWS|GCP|AZURE|OPENAI|ANTHROPIC|GEMINI|OLLAMA)[_A-Z0-9]*(?:KEY|TOKEN|SECRET|PASS(?:WORD)?|CREDENTIAL)[_A-Z0-9]*)\s*=\s*["']?([A-Za-z0-9\-_.+/=]{10,})["']?/g;

function scrubSecrets(content) {
  if (!content || typeof content !== "string") return content;
  return content.replace(
    SECRET_SCRUB_RE,
    (_, varName) => `${varName}=***REDACTED***`,
  );
}

// read_file results use tighter thresholds — large files flood context quickly
const READ_FILE_TOKEN_THRESHOLD = 7000;
const READ_FILE_COMPRESS_TARGET = 4000;

/**
 * Scrub secrets and compress tool result if it exceeds token threshold.
 * read_file results use tighter limits to prevent large-file context flood.
 * @param {string} content
 * @param {string} [fnName] - tool name for per-tool threshold selection
 */
function compressToolResultIfNeeded(content, fnName = null) {
  const scrubbed = scrubSecrets(content);
  const tokens = estimateTokens(scrubbed);
  const threshold =
    fnName === "read_file"
      ? READ_FILE_TOKEN_THRESHOLD
      : TOOL_RESULT_TOKEN_THRESHOLD;
  const target =
    fnName === "read_file"
      ? READ_FILE_COMPRESS_TARGET
      : TOOL_RESULT_COMPRESS_TARGET;
  if (tokens > threshold) {
    try {
      const { compressToolResult } = require("./context-engine");
      const compressed = compressToolResult(scrubbed, target);
      return compressed;
    } catch {
      // Fallback: return scrubbed original if compression fails
      return scrubbed;
    }
  }
  return scrubbed;
}

/**
 * Get cached filtered tools for current model.
 * Invalidated when model changes.
 */
function getCachedFilteredTools(allTools) {
  try {
    const { getActiveModel } = require("./providers/registry");
    const model = getActiveModel();
    const modelId = model ? `${model.provider}:${model.id}` : "default";

    if (toolFilterCache.has(modelId)) {
      return toolFilterCache.get(modelId);
    }

    const filtered = filterToolsForModel(allTools);
    toolFilterCache.set(modelId, filtered);
    return filtered;
  } catch {
    // Fallback: no caching on error
    return filterToolsForModel(allTools);
  }
}

/**
 * Clear tool filter cache (called on model change)
 */
function clearToolFilterCache() {
  toolFilterCache.clear();
}

function hasConversationToolCall(messages, toolNames) {
  const wanted = new Set(toolNames);
  return (messages || []).some((message) => {
    if (message.role !== "assistant") return false;
    if (Array.isArray(message.tool_calls)) {
      return message.tool_calls.some((tc) =>
        wanted.has(tc?.function?.name || tc?.name),
      );
    }
    if (Array.isArray(message.content)) {
      return message.content.some(
        (block) => block?.type === "tool_use" && wanted.has(block?.name),
      );
    }
    return false;
  });
}

/**
 * Quick hash of project context to detect changes.
 * Uses mtime of key files + git HEAD ref.
 */
// Debounced project context hash — reuse cached value within TTL to avoid
// async file-stat calls on every turn (saves 20-100ms per iteration).
let _contextHashCache = { hash: null, ts: 0 };
const CONTEXT_HASH_TTL_MS = 30_000; // 30 seconds

async function getProjectContextHash() {
  // Return cached hash if within TTL
  if (
    _contextHashCache.hash &&
    Date.now() - _contextHashCache.ts < CONTEXT_HASH_TTL_MS
  ) {
    return _contextHashCache.hash;
  }

  try {
    const fs = require("fs").promises;
    const path = require("path");
    const files = [
      path.join(process.cwd(), "package.json"),
      path.join(process.cwd(), ".git", "HEAD"),
      path.join(process.cwd(), "README.md"),
      path.join(process.cwd(), "NEX.md"),
    ];
    // Run all stat calls in parallel
    const statResults = await Promise.allSettled(
      files.map((f) => fs.stat(f).then((s) => `${f}:${s.mtimeMs}`)),
    );
    const hashes = statResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);
    // Also include memory context hash
    try {
      const { getMemoryContextHash } = require("./memory");
      const memHash = getMemoryContextHash();
      if (memHash) hashes.push(`memory:${memHash}`);
    } catch {
      /* ignore */
    }
    // Include brain dir mtime so cache invalidates when brain docs change
    try {
      const brainDir = path.join(process.cwd(), ".nex", "brain");
      if (fsSync.existsSync(brainDir)) {
        const brainStat = await fs.stat(brainDir);
        hashes.push(`brain:${brainStat.mtimeMs}`);
      }
    } catch {
      /* ignore */
    }
    const hash = hashes.join("|");
    _contextHashCache = { hash, ts: Date.now() };
    return hash;
  } catch {
    return `fallback:${Date.now()}`;
  }
}

/**
 * Invalidate system prompt cache (called on model/provider change)
 */
function invalidateSystemPromptCache() {
  cachedSystemPrompt = null;
  cachedContextHash = null;
  _contextHashCache = { hash: null, ts: 0 };
  cachedModelRoutingGuide = null;
}

// Tools that can safely run in parallel (read-only, no side effects)
// Kept for reference; execution now uses SEQUENTIAL_ONLY logic instead.
const PARALLEL_SAFE = new Set([
  "read_file",
  "list_directory",
  "search_files",
  "glob",
  "grep",
  "web_fetch",
  "web_search",
  "git_status",
  "git_diff",
  "git_log",
  "task_list",
  "gh_run_list",
  "gh_run_view",
  // Read-only container/service queries safe to run in parallel
  "container_list",
  "container_logs",
  "service_logs",
  // Browser read-only operations (NOT click/fill — those mutate state)
  "browser_open",
  "browser_screenshot",
]);
// Tools that MUST run one-at-a-time: manage their own terminal display
// or require strict ordering. ALL other tools run in parallel when the
// LLM returns them in the same response (parallel_tool_calls convention).
const SEQUENTIAL_ONLY = new Set(["spawn_agents"]);
const MAX_RATE_LIMIT_RETRIES = 10;
const MAX_NETWORK_RETRIES = 10;
const MAX_STALE_RETRIES = 5;
// Stale thresholds: resolved per-session from model profile (ENV overrides via getModelProfile)
let STALE_WARN_MS = 60000;
let STALE_ABORT_MS = 120000;
const STALE_AUTO_SWITCH = process.env.NEX_STALE_AUTO_SWITCH !== "0"; // Auto-switch to fast model on 2nd stale retry (disable: NEX_STALE_AUTO_SWITCH=0)
// Use process.cwd() dynamically

/**
 * Save plan text to .nex/plans/current-plan.md
 */
function _savePlanToFile(text) {
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.join(process.cwd(), ".nex", "plans");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, "current-plan.md");
    fs.writeFileSync(filePath, text, "utf-8");
  } catch {
    /* non-fatal */
  }
}

// Wire up "a" (always allow) from confirm dialog → permission system
setAllowAlwaysHandler((toolName) => {
  setPermission(toolName, "allow");
  savePermissions();
  console.log(`${C.green}  ✓ ${toolName}: always allow${C.reset}`);
});

// ─── Tool Call Helpers ────────────────────────────────────────

/**
 * Prepare a tool call: parse args, validate, check permissions.
 * Returns an object ready for execution.
 */
async function prepareToolCall(tc) {
  const fnName = tc.function.name;
  const args = parseToolArgs(tc.function.arguments);
  const callId =
    tc.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Malformed args
  if (!args) {
    const allToolDefs = getAllToolDefinitions();
    const toolDef = allToolDefs.find((t) => t.function.name === fnName);
    const schema = toolDef
      ? JSON.stringify(toolDef.function.parameters, null, 2)
      : "unknown";
    debugLog(
      `${C.yellow}  ⚠ ${fnName}: malformed arguments, sending schema hint${C.reset}`,
    );
    return {
      callId,
      fnName,
      args: null,
      canExecute: false,
      errorResult: {
        role: "tool",
        content:
          `ERROR: Malformed tool arguments. Could not parse your arguments as JSON.\n` +
          `Raw input: ${typeof tc.function.arguments === "string" ? tc.function.arguments.substring(0, 200) : "N/A"}\n\n` +
          `Expected JSON schema for "${fnName}":\n${schema}\n\n` +
          `Please retry the tool call with valid JSON arguments matching this schema.`,
        tool_call_id: callId,
      },
    };
  }

  // Normalize path if present so that duplicate detection works accurately.
  // Keep the original for display (_originalPath) so section headers remain readable.
  if (args && typeof args.path === "string") {
    try {
      const os = require("os");
      const resolved = path.resolve(
        process.cwd(),
        args.path.replace(/^~/, os.homedir()),
      );
      const originalPath = args.path;
      args.path = path.relative(process.cwd(), resolved) || ".";
      Object.defineProperty(args, "_originalPath", {
        value: originalPath,
        enumerable: false,
      });
    } catch (e) {
      console.error("path resolution failed:", e.message);
    }
  }

  // Validate
  const validation = validateToolArgs(fnName, args);
  if (!validation.valid) {
    debugLog(
      `${C.yellow}  ⚠ ${fnName}: ${validation.error.split("\n")[0]}${C.reset}`,
    );
    // Track repeated arg errors per tool. After 2+ errors on the same tool,
    // append an escalating nudge so the model knows it's repeating the mistake.
    const argErrCount = (_sessionToolArgErrorCounts.get(fnName) || 0) + 1;
    _sessionToolArgErrorCounts.set(fnName, argErrCount);
    const errorContent =
      argErrCount >= 2
        ? `${validation.error}\n\n[SYSTEM: This is argument error #${argErrCount} for "${fnName}". Study the "Expected parameters" schema above and correct your call — do not repeat the same mistake.]`
        : validation.error;
    return {
      callId,
      fnName,
      args,
      canExecute: false,
      errorResult: {
        role: "tool",
        content: errorContent,
        tool_call_id: callId,
      },
    };
  }

  const finalArgs = validation.corrected || args;

  // Log validator corrections so user/LLM can see auto-fixes
  if (validation.corrected) {
    const orig = Object.keys(args);
    const fixed = Object.keys(validation.corrected);
    const renamed = orig.filter((k) => !fixed.includes(k));
    if (renamed.length) {
      console.log(
        `${C.dim}  ✓ ${fnName}: corrected args (${renamed.join(", ")})${C.reset}`,
      );
    }
  }

  // Plan mode hard enforcement — block all non-read-only tools
  if (isPlanMode() && !PLAN_MODE_ALLOWED_TOOLS.has(fnName)) {
    console.log(`${C.yellow}  ✗ ${fnName}: blocked in plan mode${C.reset}`);
    return {
      callId,
      fnName,
      args: finalArgs,
      canExecute: false,
      errorResult: {
        role: "tool",
        content: `PLAN MODE: '${fnName}' is blocked. Only read-only tools are allowed. Present your plan as text output instead of making changes.`,
        tool_call_id: callId,
      },
    };
  }

  // Phase-based tool enforcement: block write/edit during plan, block write during verify.
  const _PHASE_PLAN_ALLOWED = new Set([
    "read_file",
    "list_directory",
    "search_files",
    "glob",
    "grep",
    "git_status",
    "git_diff",
    "git_log",
    "git_show",
    "ssh_exec",
  ]);
  const _PHASE_VERIFY_ALLOWED = new Set([
    "read_file",
    "list_directory",
    "glob",
    "grep",
    "bash",
    "git_status",
    "git_diff",
    "git_log",
    "ssh_exec",
  ]);
  // spawn_agents with all-background agents is allowed in plan phase — they run non-blocking
  // and don't interfere with the read-only analysis.
  const _isAllBackgroundSpawn =
    fnName === "spawn_agents" &&
    Array.isArray(finalArgs?.agents) &&
    finalArgs.agents.length > 0 &&
    finalArgs.agents.every((a) => a.background === true);
  if (
    _phaseEnabled &&
    _currentPhase === "plan" &&
    !_PHASE_PLAN_ALLOWED.has(fnName) &&
    !fnName.startsWith("skill_") &&
    !_isAllBackgroundSpawn
  ) {
    _planPhaseBlockedCount++;
    _lastPlanBlockedTool = fnName;
    debugLog(
      `${C.yellow}  ✗ ${fnName}: blocked in plan phase (read-only, block #${_planPhaseBlockedCount})${C.reset}`,
    );
    return {
      callId,
      fnName,
      args: finalArgs,
      canExecute: false,
      errorResult: {
        role: "tool",
        content: `PLAN PHASE: '${fnName}' is blocked. Analyze the codebase using read-only tools, then present your findings as text. Edits happen in the next phase.`,
        tool_call_id: callId,
      },
    };
  }
  if (
    _phaseEnabled &&
    _currentPhase === "verify" &&
    !_PHASE_VERIFY_ALLOWED.has(fnName) &&
    !fnName.startsWith("skill_")
  ) {
    debugLog(
      `${C.yellow}  ✗ ${fnName}: blocked in verify phase (read + bash only)${C.reset}`,
    );
    return {
      callId,
      fnName,
      args: finalArgs,
      canExecute: false,
      errorResult: {
        role: "tool",
        content: `VERIFY PHASE: '${fnName}' is blocked. Use read_file and bash (for tests/linters) to verify changes. Report PASS or FAIL.`,
        tool_call_id: callId,
      },
    };
  }

  // Permission check
  const perm = checkPermission(fnName);
  if (perm === "deny") {
    console.log(`${C.red}  ✗ ${fnName}: denied by permissions${C.reset}`);
    return {
      callId,
      fnName,
      args: finalArgs,
      canExecute: false,
      errorResult: {
        role: "tool",
        content: `DENIED: Tool '${fnName}' is blocked by permissions`,
        tool_call_id: callId,
      },
    };
  }
  if (perm === "ask") {
    let promptText = `  Allow ${fnName}?`;
    if (fnName === "bash" && finalArgs.command) {
      const preview = finalArgs.command.substring(0, 80);
      promptText = `  bash: \`${preview}${finalArgs.command.length > 80 ? "…" : ""}\`?`;
    }
    const ok = await confirm(promptText, { toolName: fnName });
    if (!ok) {
      return {
        callId,
        fnName,
        args: finalArgs,
        canExecute: false,
        confirmedByUser: false,
        errorResult: {
          role: "tool",
          content: `CANCELLED: User declined ${fnName}`,
          tool_call_id: callId,
        },
      };
    }
    return {
      callId,
      fnName,
      args: finalArgs,
      canExecute: true,
      confirmedByUser: true,
      errorResult: null,
    };
  }

  return {
    callId,
    fnName,
    args: finalArgs,
    canExecute: true,
    confirmedByUser: true,
    errorResult: null,
  };
}

/**
 * Execute a single prepared tool call through the routing chain.
 */
async function executeToolRouted(fnName, args, options = {}) {
  const skillResult = await routeSkillCall(fnName, args);
  if (skillResult !== null) return skillResult;
  const mcpResult = await routeMCPCall(fnName, args);
  if (mcpResult !== null) return mcpResult;
  return executeTool(fnName, args, options);
}

/**
 * Short arg preview for spinner labels.
 */
function _argPreview(name, args) {
  switch (name) {
    case "read_file":
    case "write_file":
    case "edit_file":
    case "patch_file":
    case "list_directory":
      return args._originalPath || args.path || "";
    case "bash":
      return (args.command || "").substring(0, 60);
    case "grep":
    case "search_files":
    case "glob":
      return args.pattern || "";
    case "web_fetch":
      return (args.url || "").substring(0, 50);
    case "web_search":
      return (args.query || "").substring(0, 40);
    default:
      return "";
  }
}

/**
 * Execute a single prepared tool and return { msg, summary }.
 * @param {boolean} quiet - suppress formatToolCall/formatResult output
 */
async function executeSingleTool(prep, quiet = false) {
  if (!quiet) {
    console.log(formatToolCall(prep.fnName, prep.args));
  }

  const preHook = runHooks("pre-tool", { tool_name: prep.fnName });
  const preHookResults = preHook.results;
  // exit code 2 from a pre-tool hook hard-blocks the tool call
  if (preHook.blocked) {
    const blockMsg = `BLOCKED: pre-tool hook rejected ${prep.fnName}: ${preHook.blockReason}`;
    if (!quiet)
      console.log(
        `${C.yellow}  [hook pre-tool] BLOCKED: ${preHook.blockReason}${C.reset}`,
      );
    const blockSummary = formatToolSummary(
      prep.fnName,
      prep.args,
      blockMsg,
      true,
    );
    if (!quiet) console.log(blockSummary);
    return {
      msg: { role: "tool", content: blockMsg, tool_call_id: prep.callId },
      summary: blockSummary,
    };
  }
  if (!quiet && preHookResults.length > 0) {
    for (const result of preHookResults) {
      if (result.success) {
        console.log(
          `${C.dim}  [hook pre-tool] ${result.command} → ${result.output || "ok"}${C.reset}`,
        );
      } else {
        console.log(
          `${C.yellow}  [hook pre-tool] ${result.command} → ERROR: ${result.error}${C.reset}`,
        );
      }
    }
  }

  if (_serverHooks?.onToolStart) {
    _serverHooks.onToolStart(prep.fnName, prep.args);
  }

  const toolResult = await executeToolRouted(prep.fnName, prep.args, {
    silent: true,
    autoConfirm: prep.confirmedByUser === true,
  });

  // Vision tools (visual_review, clipboard_image) return { text, images }
  let _visionImages = null;
  let safeResult;
  if (toolResult && typeof toolResult === "object" && toolResult.text) {
    safeResult = String(toolResult.text);
    if (Array.isArray(toolResult.images) && toolResult.images.length > 0) {
      _visionImages = toolResult.images;
    }
  } else {
    safeResult = String(toolResult ?? "");
  }
  const truncated =
    safeResult.length > 50000
      ? safeResult.substring(0, 50000) +
        `\n...(truncated ${safeResult.length - 50000} chars)`
      : safeResult;

  const firstLine = truncated.split("\n")[0];
  const isError =
    firstLine.startsWith("ERROR") ||
    firstLine.includes("CANCELLED") ||
    firstLine.includes("BLOCKED") ||
    (prep.fnName === "spawn_agents" &&
      !/✓ Agent/.test(truncated) &&
      /✗ Agent/.test(truncated));
  const summary = formatToolSummary(prep.fnName, prep.args, truncated, isError);

  if (!quiet) {
    console.log(summary);
  }

  if (_serverHooks?.onToolEnd) {
    _serverHooks.onToolEnd(prep.fnName, summary, !isError);
  }

  const postHook = runHooks("post-tool", { tool_name: prep.fnName });
  const postHookResults = postHook.results;
  if (!quiet && postHookResults.length > 0) {
    for (const result of postHookResults) {
      if (result.success) {
        console.log(
          `${C.dim}  [hook post-tool] ${result.command} → ${result.output || "ok"}${C.reset}`,
        );
      } else {
        console.log(
          `${C.yellow}  [hook post-tool] ${result.command} → ERROR: ${result.error}${C.reset}`,
        );
      }
    }
  }

  // Compress large tool results early to save context tokens
  const compressedContent = compressToolResultIfNeeded(truncated, prep.fnName);

  // ── Bash-instead-of-dedicated-tool hint ──────────────────────────────────
  // When the model runs `cat <file>` or plain `ls`, append a one-line HINT so
  // the LLM sees the correction in its very next context window and can course-
  // correct for subsequent steps. We never block these — just nudge.
  let finalContent = compressedContent;
  if (prep.fnName === "bash" && prep.args?.command) {
    const cmd = prep.args.command.trim();
    const isWrite = /cat\s*>|<</.test(cmd);
    if (!isWrite && /\bcat\s+\S/.test(cmd)) {
      finalContent +=
        "\nHINT: use read_file instead of bash cat — it is faster, context-efficient, and the preferred tool for reading files.";
    } else if (
      /^\s*ls(\s|$)/.test(cmd) &&
      !/npm|yarn|pnpm|make|git\b/.test(cmd)
    ) {
      finalContent +=
        "\nHINT: use list_directory instead of bash ls — it is the preferred tool for listing directory contents.";
    } else if (
      /\bfind\s+\S/.test(cmd) &&
      !/git\b|npm\b|-exec\b|-delete\b|-print0\b/.test(cmd)
    ) {
      finalContent +=
        "\nHINT: use glob instead of bash find for file discovery — it is faster and the preferred tool (e.g. glob('**/*.jsx')).";
    }
  }

  const msg = {
    role: "tool",
    content: _visionImages
      ? [
          { type: "text", text: finalContent },
          ..._visionImages.map((img) => ({
            type: "image",
            media_type: img.media_type,
            data: img.base64,
          })),
        ]
      : finalContent,
    tool_call_id: prep.callId,
  };
  return { msg, summary };
}

// ─── Root-cause detection patterns ──────────────────────────────────────────
// These match unambiguous error signatures in SSH/bash output so the state
// machine can transition from "investigation" to "fix" immediately on first hit.
const ROOT_CAUSE_PATTERNS = [
  { re: /TypeError:\s*([^\n]{0,120})/i, label: "TypeError" },
  { re: /SyntaxError:\s*([^\n]{0,120})/i, label: "SyntaxError" },
  { re: /ReferenceError:\s*([^\n]{0,120})/i, label: "ReferenceError" },
  { re: /Cannot find module\s*'([^']+)'/i, label: "Cannot find module" },
  { re: /Error:\s*ENOENT[^\n]{0,120}/i, label: "ENOENT" },
  { re: /Error:\s*EACCES[^\n]{0,120}/i, label: "EACCES" },
  { re: /Error:\s*EADDRINUSE[^\n]{0,120}/i, label: "EADDRINUSE" },
  { re: /ImportError:\s*([^\n]{0,120})/i, label: "ImportError" },
  {
    re: /ModuleNotFoundError:\s*([^\n]{0,120})/i,
    label: "ModuleNotFoundError",
  },
  { re: /NameError:\s*([^\n]{0,120})/i, label: "NameError" },
  { re: /AttributeError:\s*([^\n]{0,120})/i, label: "AttributeError" },
  { re: /KeyError:\s*([^\n]{0,120})/i, label: "KeyError" },
  { re: /ValueError:\s*([^\n]{0,120})/i, label: "ValueError" },
  { re: /panic:\s*([^\n]{0,120})/i, label: "Go panic" },
  { re: /java\.lang\.\w+Exception[^\n]{0,80}/i, label: "Java exception" },
];

/**
 * Scan a string for unambiguous error signatures that indicate a root cause.
 * Returns a short label+detail string, or null if no pattern matched.
 */
function detectRootCause(text) {
  for (const { re, label } of ROOT_CAUSE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const detail = (m[1] || "").trim();
      return detail ? `${label}: ${detail}` : label;
    }
  }
  return null;
}

/**
 * Execute prepared tool calls with parallel batching.
 * Consecutive PARALLEL_SAFE tools run via Promise.all.
 * @param {boolean} quiet - use spinner + compact summaries instead of verbose output
 */
async function executeBatch(prepared, quiet = false, options = {}) {
  const results = new Array(prepared.length);
  const summaries = [];
  let batch = [];

  // Quiet mode: show a single spinner for all tools
  let spinner = null;
  if (quiet && !options.skipSpinner) {
    const execTools = prepared.filter((p) => p.canExecute);
    if (execTools.length > 0) {
      let label;
      if (execTools.length === 1) {
        const p = execTools[0];
        const preview = _argPreview(p.fnName, p.args);
        label = `⏺ ${p.fnName}${preview ? `(${preview})` : ""}`;
      } else {
        const names = execTools.map((p) => p.fnName).join(", ");
        label = `⏺ ${execTools.length} tools: ${names.length > 60 ? names.substring(0, 57) + "…" : names}`;
      }
      spinner = new Spinner(label);
      spinner.start();
    }
  }

  async function flushBatch() {
    if (batch.length === 0) return;
    if (batch.length === 1) {
      const idx = batch[0];
      const { msg, summary } = await executeSingleTool(prepared[idx], quiet);
      results[idx] = msg;
      summaries.push(summary);
    } else {
      const promises = batch.map((idx) =>
        executeSingleTool(prepared[idx], quiet),
      );
      const batchResults = await Promise.all(promises);
      for (let j = 0; j < batch.length; j++) {
        results[batch[j]] = batchResults[j].msg;
        summaries.push(batchResults[j].summary);
      }
    }
    batch = [];
  }

  for (let i = 0; i < prepared.length; i++) {
    const prep = prepared[i];

    if (!prep.canExecute) {
      await flushBatch();
      results[i] = prep.errorResult;
      summaries.push(
        formatToolSummary(
          prep.fnName,
          prep.args || {},
          prep.errorResult.content,
          true,
        ),
      );
      continue;
    }

    if (SEQUENTIAL_ONLY.has(prep.fnName)) {
      await flushBatch();
      // spawn_agents manages its own display (MultiProgress) — stop outer spinner
      if (prep.fnName === "spawn_agents" && spinner) {
        spinner.stop();
        spinner = null;
      }
      const { msg, summary } = await executeSingleTool(prep, quiet);
      results[i] = msg;
      summaries.push(summary);
    } else {
      // All other tools batch together: when the LLM returns them in the same
      // response, they are presumed independent (parallel_tool_calls convention).
      batch.push(i);
    }
  }

  await flushBatch();

  // Stop spinner
  if (spinner) spinner.stop();
  // Print summaries only when not collecting them at the call site
  if (quiet && summaries.length > 0 && !options.skipSummaries) {
    for (const s of summaries) console.log(s);
  }

  return { results, summaries };
}

// Persistent conversation state
let conversationMessages = [];
// Sliding window: oldest messages trimmed beyond this limit to prevent unbounded RAM growth.
// fitToContext() still handles what gets sent to the API — this caps the in-memory store only.
const MAX_CONVERSATION_HISTORY = 300;

// ─── Session-scoped loop detection counters ──────────────────────────────────
// These live at module level so they persist across multi-turn REPL conversations.
// Without this, each processInput() call resets the counters, allowing the agent
// to run e.g. 7 sed calls per turn indefinitely across many turns.
// Reset in clearConversation() so /clear starts fresh.
// Session loop counters — each entry stores { count, ts }.
// Entries older than LOOP_COUNTER_TTL_MS are treated as expired (count 0)
// so valid work isn't blocked by stale counters from 10+ turns ago.
const LOOP_COUNTER_TTL_MS = 15 * 60 * 1000; // 15 minutes

function _getLoopCount(map, key) {
  const entry = map.get(key);
  if (!entry) return 0;
  if (Date.now() - entry.ts > LOOP_COUNTER_TTL_MS) {
    map.delete(key);
    return 0;
  }
  return entry.count;
}

function _incLoopCount(map, key) {
  const entry = map.get(key);
  const count =
    entry && Date.now() - entry.ts <= LOOP_COUNTER_TTL_MS ? entry.count + 1 : 1;
  map.set(key, { count, ts: Date.now() });
  return count;
}

function _setLoopCount(map, key, count) {
  map.set(key, { count, ts: Date.now() });
}

const _sessionBashCmdCounts = new Map();
const _sessionGrepPatternCounts = new Map();
const _sessionGrepFileCounts = new Map(); // per-file grep count (different patterns on same file)
const _sessionGrepFoundFiles = new Set(); // files that appeared in grep results (not just searched)
const _sessionGlobSearchCounts = new Map(); // glob/search_files pattern loop detection
const _sessionGlobCoreTerms = new Map(); // coreToken → Set<pattern> — detect varied patterns targeting the same term
const _sessionGlobFoundFiles = new Set(); // files that appeared in glob results
const _sessionFileReadCounts = new Map();
const _sessionFileReadRanges = new Map(); // path → Array<[start, end]> of targeted reads so far
const _sessionFileEditCounts = new Map();
const _sessionLastEditFailed = new Map(); // path → number of consecutive edit failures (old_text not found) for that file
const _sessionReReadBlockShown = new Map(); // track how many times block message was shown per file
const _sessionToolArgErrorCounts = new Map(); // tool name → cumulative arg-validation error count this session
const _sessionRangeBlockCounts = new Map(); // "path:start-end" → count of times that exact range was blocked
const _sessionDupeToolCounts = new Map(); // "toolName|argsJSON" → { count, ts } — dedup identical tool calls
let _sessionConsecutiveSshCalls = 0;
let _superNuclearFires = 0; // total super-nuclear compressions this session (cap at 2)
let _planRejectionCount = 0; // times plan-without-reads was rejected this session (cap: 2)
let _lastCompressionMsg = ""; // deduplicate consecutive identical compression messages
let _compressionMsgCount = 0; // count consecutive identical compression messages
let _sshBlockedAfterStorm = false; // blocks SSH calls after storm warning fires
let _sshStormCount = 0; // how many times the SSH storm warning has fired this session
let _sshDeadlockRelaxCount = 0; // how many times the dual-block deadlock relaxer has fired (hard-cap: 1)
let _postWipeToolBudget = -1; // remaining tool calls after a context wipe (-1 = no active budget)
let _postWipeEverFired = false; // true once a context wipe has occurred this session
let _filesModifiedAtWipe = 0; // filesModified.size at time of last context wipe (progress baseline)
let _postWipeBudgetExtended = false; // true after the one-time progress extension has been granted
let _readOnlyCallsSinceEdit = 0; // read-only tool calls (reads, greps, finds, SSH) since last file edit
let _investigationCapFired = false; // true once the investigation cap warning has been injected
let _readsSinceCapFired = 0; // read-only calls after the investigation cap warning was injected
let _editsMadeThisSession = 0; // count of successful file edits this session (used to tighten post-edit caps)
let _rootCauseDetected = false; // true when SSH output matched a clear error pattern
let _rootCauseSummary = ""; // brief label for the detected root cause (e.g. "TypeError: x is not a function")
let _sshBlockedPreCallNudgeCount = 0; // how many times the pre-call SSH-blocked nudge has fired this storm block
let _consecutiveFileNotFound = 0; // consecutive read_file/edit_file calls that returned "File not found"
let _sshLastErrorFingerprint = ""; // first error line of the most recent failed SSH result
let _sshConsecutiveSameErrors = 0; // count of consecutive SSH results with the same error (reset on success or different error)
let _bashConsecutiveSameErrors = 0; // same, but for local bash commands
let _bashLastErrorFingerprint = ""; // fingerprint of the last bash error line
let _timeNudgeCount = 0; // how many time-based "stop reading" nudges have fired
let _isCreationTask = false; // true when initial prompt is a build/create task — tighter investigation cap applies
let _verificationInjected = false; // prevents re-triggering post-creation bootstrap check
const _taskRegistry = new Map(); // taskId → description, populated from create_task tool calls
const _autoCompletedTasks = new Set(); // taskIds auto-completed by file-write matching
let _lastCreationSummary = null; // persists across turns: brief note of what the last creation task produced
let _commitDetected = false; // true once a successful git commit is detected in bash output
let _postCommitGitCalls = 0; // count of git status/diff/log calls after commit detected
let _toolBudgetWarningInjected = false; // true after the 30-call budget warning has been injected

// ─── Phase-based routing state ──────────────────────────────────────────────
let _currentPhase = "plan"; // 'plan' | 'implement' | 'verify'
let _phaseIterations = 0; // iterations consumed in current phase
let _phaseEnabled = false; // true when config has 'phases' key
let _planPhaseBlockedCount = 0; // consecutive non-allowed tool calls blocked in plan phase
let _lastPlanBlockedTool = null; // last tool blocked during plan phase
let _phaseModelOverride = null; // model ID string for current phase (null = use default)
let _planSummary = null; // compressed summary from plan phase
let _implementSummary = null; // summary of changes from implement phase
let _verifyLoopBack = 0; // max 1 loop-back from verify → implement
let _verifyToolCalls = 0; // successful verification-phase tool calls in the current verify pass
let _verifyCompletionNudges = 0; // nudges sent when verify tries to finish without enough evidence
let _postEditVerifyPending = false; // require a narrow verification step after successful writes
let _postEditVerifyNudges = 0;
let _detectedCategoryId = null; // task category detected on first user message
let _planTodos = []; // structured action items from plan phase [{file, action, done}]
const _freshlyWrittenFiles = new Set(); // files just written — allow one immediate read/edit follow-up

function _shouldFastTrackPlanBlock(fnName) {
  return (
    fnName === "write_file" ||
    fnName === "edit_file" ||
    fnName === "patch_file" ||
    fnName === "bash"
  );
}

function _shouldSkipPlanPhaseForDirectCreation(prompt) {
  const text = String(prompt || "");
  if (!text) return false;
  const hasExplicitPath =
    /(?:^|\s)(?:\.{1,2}\/)?[\w./-]+\.(?:js|ts|tsx|jsx|py|md|json|yml|yaml|sh|css|html)\b/i.test(
      text,
    );
  const directCreateRefactor =
    /\b(create|write|add|make|build|scaffold)\b[\s\S]{0,160}\b(refactor|rename|improve|update|change|edit)\b/i.test(
      text,
    ) ||
    /\b(refactor|update|change|edit)\b[\s\S]{0,160}\b(create|write|add|make|build|scaffold)\b/i.test(
      text,
    );
  const directFileTask =
    /\b(create|write|add|make|build|refactor|update|change|edit)\b[\s\S]{0,160}\bfile\b/i.test(
      text,
    );
  return hasExplicitPath && (directCreateRefactor || directFileTask);
}

function _isConversationalPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return false;
  return (
    /^(hi|hello|hey|yo)\b/i.test(text) ||
    /\b(introduce yourself|who are you|what can you do|tell me about yourself)\b/i.test(
      text,
    )
  );
}

function _normalizePromptPathMatch(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

function _extractDirectTaskPaths(prompt) {
  const text = String(prompt || "");
  const matches = text.match(
    /(?:^|\s)((?:\.{1,2}\/)?[\w./-]+\.(?:js|ts|tsx|jsx|py|md|json|yml|yaml|sh|css|html))\b/gi,
  );
  if (!matches) return [];
  return [...new Set(matches.map((m) => _normalizePromptPathMatch(m)))];
}

// Helper: deduplicate consecutive identical compression messages for cleaner output.
// Shows the first occurrence normally, then updates with a counter on repeats.
function _logCompression(msg, color) {
  if (msg === _lastCompressionMsg) {
    _compressionMsgCount++;
    // Overwrite the previous line with updated counter
    if (debug && debug.DEBUG) {
      process.stdout.write(
        `\x1b[1A\x1b[2K${color}  ⚠ ${msg} (×${_compressionMsgCount})${C.reset}\n`,
      );
    }
  } else {
    _lastCompressionMsg = msg;
    _compressionMsgCount = 1;
    debugLog(`${color}  ⚠ ${msg}${C.reset}`);
  }
}

// Mid-run user input buffer: notes injected by the user while the agent is running
const _midRunBuffer = [];

/**
 * Inject a user note into the running agent loop.
 * Called by the REPL when input arrives during processing.
 * @param {string} text
 */
function injectMidRunNote(text) {
  _midRunBuffer.push(text.trim());
}

/**
 * Drain and return buffered mid-run notes as a single string, or null if empty.
 */
function _drainMidRunBuffer() {
  if (_midRunBuffer.length === 0) return null;
  const notes = _midRunBuffer.splice(0, _midRunBuffer.length);
  return notes.join("\n");
}

/**
 * Format a completed background job result for injection into the conversation.
 * @param {{ jobId: string, agentDef: object, result: object, finishedAt: number, _startedAt?: number }} job
 * @returns {string}
 */
function _formatBackgroundJobResult(job) {
  const durationSec = job._startedAt
    ? Math.round((job.finishedAt - job._startedAt) / 1000)
    : null;
  const durationStr = durationSec !== null ? `\nDuration: ${durationSec}s` : "";
  const resultText =
    typeof job.result.result === "string"
      ? job.result.result.slice(0, 4000)
      : JSON.stringify(job.result.result || "").slice(0, 4000);
  const filesStr =
    job.result.filesModified && job.result.filesModified.length > 0
      ? `\nFiles modified: ${job.result.filesModified.join(", ")}`
      : "";
  return (
    `[BACKGROUND AGENT COMPLETED]\n` +
    `Job: ${job.jobId}\n` +
    `Task: "${job.agentDef.task}"` +
    durationStr +
    `\nStatus: ${job.result.status || "done"}` +
    filesStr +
    `\nResult: ${resultText}`
  );
}

/**
 * Check for completed background agents and inject their results as user messages.
 * Called at two points in the main loop: top of each iteration and after tool results.
 * @param {Array} conversationMessages
 * @param {Array} apiMessages
 */
function _drainCompletedBackgroundJobs(conversationMessages, apiMessages) {
  const { getCompletedJobs } = require("./background-jobs");
  const completed = getCompletedJobs();
  for (const job of completed) {
    const msg = {
      role: "user",
      content: _formatBackgroundJobResult(job),
    };
    conversationMessages.push(msg);
    apiMessages.push(msg);
    const _bgStatus = job.result?.status || "done";
    const _bgIcon = _bgStatus === "failed" ? C.red + "  ✗" : C.cyan + "  ✓";
    process.stderr.write(
      `${_bgIcon} Background agent ${_bgStatus}: ${job.agentDef.task.slice(0, 50)} — ${String(job.result?.result || "").slice(0, 80)}${C.reset}\n`,
    );
  }
}

/**
 * Extract structured TODO items from the plan text by matching file paths
 * that were read OR found via grep during the plan phase. Returns an array
 * of {file, action, done} objects for the implement phase to work through.
 */
function _extractPlanTodos(planText, filesReadMap) {
  const todos = [];
  // Combine files from read_file, glob and grep results
  const knownFiles = new Set([
    ...filesReadMap.keys(),
    ..._sessionGrepFoundFiles,
    ..._sessionGlobFoundFiles,
  ]);
  if (!knownFiles.size || !planText) return todos;

  // For each file that was read or found via grep, check if the plan mentions it
  for (const filePath of knownFiles) {
    const basename = filePath.split("/").pop();
    if (!basename) continue;
    // Check if plan text references this file (by basename or full path)
    if (planText.includes(basename) || planText.includes(filePath)) {
      // Extract the sentence/line that mentions this file as the action
      const lines = planText.split("\n");
      const actionLine = lines.find(
        (l) => l.includes(basename) || l.includes(filePath),
      );
      todos.push({
        file: filePath,
        action: (actionLine || "edit this file").trim().slice(0, 200),
        done: false,
      });
    }
  }
  return todos;
}

function _extractTaskKeywords(text) {
  if (!text || typeof text !== "string") return [];
  const tokens = text.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) || [];
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "that",
    "this",
    "when",
    "then",
    "have",
    "your",
    "just",
    "read",
    "write",
    "edit",
    "file",
    "files",
    "test",
    "tests",
    "verify",
    "phase",
    "implement",
    "summary",
    "report",
    "pass",
    "fail",
    "changes",
    "change",
    "address",
    "original",
    "task",
    "user",
    "request",
    "code",
    "module",
    "function",
    "class",
  ]);
  const seen = new Set();
  const ranked = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (stop.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    ranked.push(token);
  }
  ranked.sort((a, b) => b.length - a.length);
  return ranked.slice(0, 6);
}

function _detectPackageManager() {
  if (fsSync.existsSync(path.join(process.cwd(), "pnpm-lock.yaml")))
    return "pnpm";
  if (fsSync.existsSync(path.join(process.cwd(), "yarn.lock"))) return "yarn";
  return "npm";
}

function _commandForScript(scriptName) {
  const pm = _detectPackageManager();
  if (scriptName === "test") {
    if (pm === "yarn") return "yarn test";
    if (pm === "pnpm") return "pnpm test";
    return "npm test";
  }
  if (pm === "yarn") return `yarn ${scriptName}`;
  if (pm === "pnpm") return `pnpm run ${scriptName}`;
  return `npm run ${scriptName}`;
}

function _buildPostEditVerifyPrompt(filesModified, commands, relatedTests) {
  const modifiedList =
    [...(filesModified || [])].slice(0, 6).join(", ") ||
    "recently modified files";
  const checks = (commands || []).slice(0, 3);
  const tests = (relatedTests || []).slice(0, 3);
  const lines = [
    `[SYSTEM] You already changed code in: ${modifiedList}.`,
    "Run one narrow verification step next before more exploration.",
  ];
  if (checks.length > 0) {
    lines.push(`Suggested verification commands: ${checks.join(" | ")}`);
  }
  if (tests.length > 0) {
    lines.push(`Likely related tests: ${tests.join(", ")}`);
  }
  lines.push(
    "Do not continue broad read/search loops until the latest edit has been checked.",
  );
  return lines.join("\n");
}

function _isVerificationCommandCall(prep) {
  if (!prep || !prep.fnName) return false;
  if (!["bash", "ssh_exec"].includes(prep.fnName)) return false;
  const cmd = String(prep.args?.command || "").toLowerCase();
  return /\b(test|jest|vitest|pytest|mocha|rspec|phpunit|cargo test|go test|tsc|build|lint|eslint|check)\b/.test(
    cmd,
  );
}

async function _inferSymbolTargets(taskText) {
  const keywords = _extractTaskKeywords(taskText);
  if (keywords.length === 0) return [];
  const { searchContentIndex } = require("./index-engine");
  const hits = [];
  const seen = new Set();
  for (const keyword of keywords) {
    try {
      const results = await searchContentIndex(
        keyword,
        undefined,
        process.cwd(),
      );
      for (const hit of results.slice(0, 3)) {
        const key = `${hit.file}:${hit.name}:${hit.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push(hit);
        if (hits.length >= 5) return hits;
      }
    } catch {
      /* optional hint only */
    }
  }
  return hits;
}

async function _buildSymbolHintBlock(taskText) {
  const hits = await _inferSymbolTargets(taskText);
  if (hits.length === 0) return "";
  const { getRelatedFiles, findSymbolReferences } = require("./index-engine");
  const lines = ["Likely symbol targets:"];

  for (let idx = 0; idx < hits.length; idx++) {
    const hit = hits[idx];
    const start = Math.max(1, hit.line - 20);
    const end = hit.line + 40;
    lines.push(
      `${idx + 1}. ${hit.name} (${hit.type}) in ${hit.file}:${hit.line} -> read_file(path='${hit.file}', line_start=${start}, line_end=${end})`,
    );

    try {
      const related = await getRelatedFiles(hit.file, process.cwd(), 3);
      if (related.length > 0) {
        lines.push(
          `   Follow-up files: ${related.join(", ")} (read only if the primary symbol points into one of these modules)`,
        );
      }
    } catch {
      /* optional hint only */
    }

    try {
      const refs = await findSymbolReferences(hit.name, process.cwd(), {
        excludeFile: hit.file,
        excludeLine: hit.line,
        limit: 2,
      });
      if (refs.length > 0) {
        lines.push(
          `   Likely callers/usages: ${refs.map((ref) => `${ref.file}:${ref.line}`).join(", ")} (read these next if behavior depends on where ${hit.name} is invoked)`,
        );
      }
    } catch {
      /* optional hint only */
    }
  }
  return `${lines.join("\n")}\nUse these exact targeted reads before broader searching.\n\n`;
}

async function _inferRelevantTests(filesModified) {
  const { getFileIndex } = require("./index-engine");
  const {
    buildContentIndex,
    findSymbolReferences,
    getRelatedFiles,
  } = require("./index-engine");
  const files = getFileIndex();
  const testFiles = files.filter(
    (f) => /^tests?\//.test(f) || /\.test\./.test(f) || /\.spec\./.test(f),
  );
  if (testFiles.length === 0) return [];

  const related = new Set();
  const contentIndex = await buildContentIndex(process.cwd());
  for (const modifiedFile of filesModified || []) {
    const relFile = String(modifiedFile);
    const base = path.basename(relFile).replace(/\.[^.]+$/, "");
    if (base.length < 3) continue;
    for (const testFile of testFiles) {
      if (testFile.includes(base)) related.add(testFile);
      if (related.size >= 4) return [...related];
    }

    try {
      const neighbors = await getRelatedFiles(relFile, process.cwd(), 4);
      for (const neighbor of neighbors) {
        const neighborBase = path.basename(neighbor).replace(/\.[^.]+$/, "");
        if (neighborBase.length < 3) continue;
        for (const testFile of testFiles) {
          if (testFile.includes(neighborBase)) related.add(testFile);
          if (related.size >= 4) return [...related];
        }
      }
    } catch {
      /* optional heuristic only */
    }

    const defs = Array.isArray(contentIndex.files?.[relFile]?.defs)
      ? contentIndex.files[relFile].defs
      : [];
    const symbolNames = defs
      .filter((def) => ["function", "class", "export"].includes(def.type))
      .map((def) => def.name)
      .filter((name, index, arr) => name && arr.indexOf(name) === index)
      .slice(0, 3);

    for (const symbolName of symbolNames) {
      try {
        const refs = await findSymbolReferences(symbolName, process.cwd(), {
          excludeFile: relFile,
          limit: 8,
        });
        for (const ref of refs) {
          if (testFiles.includes(ref.file)) related.add(ref.file);
          if (related.size >= 4) return [...related];
        }
      } catch {
        /* optional heuristic only */
      }
    }
  }
  return [...related];
}

function _inferTargetedTestCommands(relatedTests, scripts = {}) {
  if (!Array.isArray(relatedTests) || relatedTests.length === 0) return [];
  const joined = relatedTests.slice(0, 4).join(" ");
  const commands = [];
  const testScript = String(scripts.test || "");

  if (
    /vitest/.test(testScript) ||
    fsSync.existsSync(path.join(process.cwd(), "vitest.config.ts")) ||
    fsSync.existsSync(path.join(process.cwd(), "vitest.config.js"))
  ) {
    commands.push(`npx vitest run ${joined}`);
  } else if (
    /jest/.test(testScript) ||
    fsSync.existsSync(path.join(process.cwd(), "jest.config.js")) ||
    fsSync.existsSync(path.join(process.cwd(), "jest.config.cjs")) ||
    fsSync.existsSync(path.join(process.cwd(), "jest.config.mjs"))
  ) {
    commands.push(`npx jest --runInBand ${joined}`);
  }

  if (
    (fsSync.existsSync(path.join(process.cwd(), "pytest.ini")) ||
      fsSync.existsSync(path.join(process.cwd(), "pyproject.toml"))) &&
    relatedTests.some((f) => /\.py$/i.test(f))
  ) {
    commands.push(
      `pytest ${relatedTests
        .filter((f) => /\.py$/i.test(f))
        .slice(0, 4)
        .join(" ")}`,
    );
  }

  return commands;
}

/**
 * Transition to the next phase in the plan → implement → verify pipeline.
 * Preserves read-tracking counters across phases to prevent re-investigation.
 */
async function _transitionPhase(
  targetPhase,
  summary,
  filesModified,
  originalTask,
) {
  if (!_phaseEnabled) return null;

  const prevPhase = _currentPhase;
  _currentPhase = targetPhase;
  _phaseIterations = 0;
  _phaseModelOverride = getModelForPhase(targetPhase, _detectedCategoryId);
  if (targetPhase === "verify") {
    _verifyToolCalls = 0;
    _verifyCompletionNudges = 0;
    _postEditVerifyPending = false;
    _postEditVerifyNudges = 0;
  }

  // Reset investigation/edit guards but PRESERVE read-tracking counters.
  // Clearing read/grep/glob counters causes the model to re-investigate files
  // it already found in the plan phase, wasting the entire implement budget.
  _readOnlyCallsSinceEdit = 0;
  _investigationCapFired = false;
  _readsSinceCapFired = 0;
  _editsMadeThisSession = 0;
  // Keep: _sessionFileReadCounts, _sessionFileReadRanges (prevent re-reads)
  // Keep: _sessionDupeToolCounts (prevent duplicate tool calls)
  // Keep: _sessionGrepPatternCounts, _sessionGrepFileCounts (prevent re-greps)
  // Keep: _sessionGlobSearchCounts, _sessionGlobCoreTerms (prevent re-globs)
  _sessionReReadBlockShown.clear();
  _sessionRangeBlockCounts.clear();
  _sessionBashCmdCounts.clear();
  _sessionFileEditCounts.clear();

  // Extract structured TODOs from plan findings + files already read.
  if (targetPhase === "implement") {
    _planTodos = _extractPlanTodos(summary || "", _sessionFileReadCounts);
  }

  // Generate ordered action items from extracted plan todos for implementation phase
  const _todoChecklist =
    _planTodos.length > 0
      ? `\n\nACTION ITEMS (execute these in order, do NOT re-read these files):\n` +
        _planTodos.map((t, i) => `${i + 1}. ${t.file} — ${t.action}`).join("\n")
      : "";

  const symbolHints = await _buildSymbolHintBlock(
    targetPhase === "verify" ? originalTask : summary || originalTask || "",
  );
  let content;
  if (targetPhase === "implement") {
    _planSummary = summary?.slice(0, 2000) || "";
    content =
      `[PHASE: IMPLEMENTATION] Analysis complete. Based on the analysis:\n${_planSummary}\n\n` +
      `${symbolHints}` +
      `Now implement the fix/changes. Do not investigate further — edit files directly.` +
      _todoChecklist;
  } else if (targetPhase === "verify") {
    _implementSummary = summary?.slice(0, 500) || "";
    const fileList = filesModified ? [...filesModified].join(", ") : "none";
    const suggestedChecks = await _inferVerificationCommands(filesModified);
    const relatedTests = await _inferRelevantTests(filesModified);
    const checksBlock =
      suggestedChecks.length > 0
        ? `Suggested checks (run the narrowest ones that fit the change):\n${suggestedChecks.map((cmd, i) => `${i + 1}. ${cmd}`).join("\n")}\n\n`
        : "";
    const relatedTestsBlock =
      relatedTests.length > 0
        ? `Likely related tests:\n${relatedTests.map((file, i) => `${i + 1}. ${file}`).join("\n")}\nPrefer these before broader suites when a targeted run is possible.\n\n`
        : "";
    content =
      `[PHASE: VERIFICATION] Implementation complete. Verify the changes:\n` +
      `1. Read only the modified sections/files and confirm the final code matches intent\n` +
      `2. Run the smallest relevant verification command(s)\n` +
      `3. If one check fails, explain the failure precisely and loop back with a focused fix\n` +
      `4. Does the implementation address: "${(originalTask || "").slice(0, 200)}"?\n` +
      `Report PASS (all good) or FAIL (list specific issues).\n\n` +
      `Files modified: ${fileList}\n` +
      `${symbolHints}` +
      `${checksBlock}` +
      `${relatedTestsBlock}` +
      `Summary: ${_implementSummary}`;
  }

  debugLog(
    `${C.cyan}  ↳ Phase transition: ${prevPhase} → ${targetPhase} (model: ${_phaseModelOverride || "default"})${C.reset}`,
  );

  return content ? { role: "user", content } : null;
}

async function _inferVerificationCommands(filesModified) {
  const commands = [];
  const modified = [...(filesModified || [])];
  const lowerFiles = modified.map((f) => String(f).toLowerCase());
  let scripts = {};

  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fsSync.existsSync(pkgPath)) {
      const pkg = JSON.parse(fsSync.readFileSync(pkgPath, "utf-8"));
      scripts = pkg.scripts || {};
      const preferredScripts = [
        ["test", _commandForScript("test")],
        ["lint", _commandForScript("lint")],
        ["typecheck", _commandForScript("typecheck")],
        ["check", _commandForScript("check")],
        ["build", _commandForScript("build")],
      ];
      for (const [name, cmd] of preferredScripts) {
        if (scripts[name]) commands.push(cmd);
      }
    }
  } catch {
    /* package.json absent or invalid */
  }

  if (commands.length === 0) {
    if (fsSync.existsSync(path.join(process.cwd(), "package.json")))
      commands.push(_commandForScript("test"));
    if (
      fsSync.existsSync(path.join(process.cwd(), "pytest.ini")) ||
      fsSync.existsSync(path.join(process.cwd(), "pyproject.toml"))
    ) {
      commands.push("pytest");
    }
  }

  const targetedTests = await _inferRelevantTests(filesModified);
  commands.unshift(..._inferTargetedTestCommands(targetedTests, scripts));

  const hasTsEdits = lowerFiles.some((f) => /\.(ts|tsx)$/.test(f));
  const hasJsEdits = lowerFiles.some((f) => /\.(js|jsx|ts|tsx)$/.test(f));
  if (hasTsEdits && !commands.includes(_commandForScript("typecheck")))
    commands.push(_commandForScript("typecheck"));
  if (hasJsEdits && !commands.includes(_commandForScript("lint")))
    commands.push(_commandForScript("lint"));

  return [...new Set(commands)].slice(0, 4);
}

/**
 * Build dynamic model routing guide for spawn_agents.
 * Only shown when 2+ models are available across configured providers.
 */
/**
 * Detect the response language for the current user turn.
 * In auto mode we infer the language from the current prompt and fall back to English.
 * This keeps response language stable even when project context contains instructions
 * in a different language.
 * @param {string} userInput
 * @returns {string}
 */
function _detectResponseLanguage(userInput) {
  const uiLangRaw = process.env.NEX_LANGUAGE;
  if (uiLangRaw && uiLangRaw !== "auto") return uiLangRaw;
  if (_isProjectEnglishOnly()) return "English";

  const text = String(userInput || "").trim();
  if (!text) return "English";

  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .toLowerCase();
  const words = stripped.match(/[a-zäöüß]+/gi) || [];
  const englishWords = new Set([
    "the",
    "and",
    "or",
    "for",
    "with",
    "without",
    "write",
    "create",
    "explain",
    "refactor",
    "query",
    "function",
    "makefile",
    "dockerfile",
    "healthcheck",
    "preserve",
    "return",
    "input",
    "output",
    "using",
    "should",
    "must",
    "please",
  ]);
  const germanWords = new Set([
    "der",
    "die",
    "das",
    "und",
    "oder",
    "ist",
    "sind",
    "nicht",
    "bitte",
    "erstelle",
    "schreibe",
    "erkläre",
    "funktion",
    "abfrage",
    "datei",
    "zurück",
    "mit",
    "ohne",
    "danke",
  ]);
  let english = 0;
  let german = 0;
  for (const word of words) {
    if (englishWords.has(word)) english++;
    if (germanWords.has(word)) german++;
  }
  if (german >= 3 && german > english * 1.4) return "German";
  return "English";
}

function _isSimpleDirectAnswerPrompt(userInput) {
  const text = String(userInput || "").trim();
  if (!text || text.length > 2500) return false;
  const lower = text.toLowerCase();

  if (
    /\b(?:repo|repository|project|codebase|existing|current workspace|this workspace)\b/.test(
      lower,
    ) ||
    /\b(?:create|write|save)\s+(?:a\s+)?file\b/.test(lower) ||
    /\b(?:read|search|inspect|look through|find in|run|install)\b/.test(lower)
  ) {
    return false;
  }

  return [
    /\b(?:reply|respond|answer)\b.*\bexactly\b/i,
    /\b(?:sql\s+query|select\s+.+\s+from)\b/i,
    /\b(?:cron(?:\s+expression)?|crontab)\b/i,
    /\bregex\b.*\b(?:explain|refactor|rewrite|readable)\b/i,
    /\b(?:small|simple|minimal)?\s*makefile\b/i,
    /\b(?:small|simple|minimal)?\s*dockerfile\b/i,
    /\b(?:docker\s+healthcheck|healthcheck)\b/i,
    // Snippet-only refactors and quick scripts should be tool-free.
    /\brefactor\b.*\bcallbacks?\b.*\basync\s*\/\s*await\b/i,
    /\bcallbacks?\b.*\basync\s*\/\s*await\b/i,
    /\btypescript\b.*\binterface\b/i,
    /\b(?:debug|fix)\b.*\bbash\b.*\bscript\b/i,
    /\bpre-commit\s+hook\b/i,
    /\bbash\s+one-?liner\b/i,
    /\bdataclass\b/i,
    /\bexpress\b.*\broute\b/i,
    /\beventemitter\b/i,
    /\b(?:javascript|js|python)\s+function\b/i,
    /\bfunction\s+\w+\s*\(/i,
  ].some((re) => re.test(text));
}

/**
 * Build language enforcement block for the cached system prompt.
 * Reads NEX_LANGUAGE, NEX_CODE_LANGUAGE, NEX_COMMIT_LANGUAGE from env.
 * If NEX_LANGUAGE is unset or "auto", turn-specific response language is injected later.
 * Code comments and commits default to English unless explicitly overridden.
 */
function _buildLanguagePrompt() {
  const uiLangRaw = process.env.NEX_LANGUAGE;
  const codeLang = process.env.NEX_CODE_LANGUAGE;
  const commitLang = process.env.NEX_COMMIT_LANGUAGE;
  const projectEnglishOnly = _isProjectEnglishOnly();

  // Default: mirror user's language (auto). Set NEX_LANGUAGE=English (or any language) to hard-enforce.
  const uiLang = !uiLangRaw || uiLangRaw === "auto" ? null : uiLangRaw;

  const lines = ["# Language Rules (CRITICAL — enforce strictly)\n"];

  if (projectEnglishOnly) {
    lines.push(
      "RESPONSE LANGUAGE: This project requires English. Always respond in English, even if the user writes in another language.",
    );
  } else if (uiLang) {
    lines.push(
      `RESPONSE LANGUAGE: You MUST always respond in ${uiLang}. This overrides any language defaults from your training. Never output Chinese, Japanese, or any other language in your responses — even when summarizing or thinking. ${uiLang} only.`,
    );
  } else {
    // Auto mode: mirror the user's language
    lines.push(
      "RESPONSE LANGUAGE: Always respond in the same language as the user's message. If the user writes in German, respond in German; if in English, respond in English; etc.",
    );
  }

  // Always enforce real code examples
  lines.push(
    "CODE EXAMPLES: Always show actual, working code examples — never pseudocode or placeholder snippets.",
  );
  lines.push("COMPLETENESS RULES:");
  lines.push(
    "  • ALWAYS show actual code when explaining implementations — never describe without showing",
  );
  if (getAutoConfirm()) {
    // Headless/auto mode: files are deliverables only when explicitly requested.
    lines.push(
      "  • FILE CREATION TASKS (Makefile, Dockerfile, config files, documentation): create or edit files only when the user explicitly asks for files or the existing workflow clearly requires files. For self-contained snippet requests, answer in text only.",
    );
  } else {
    lines.push(
      "  • FILE CREATION TASKS (Makefile, Dockerfile, config files): paste the COMPLETE file content in a fenced code block in your TEXT RESPONSE — writing a file with a tool does NOT make it visible. The fenced code block MUST appear in your response, not just via write_file.",
    );
  }
  lines.push(
    "  • Include complete examples with full context (imports, function signatures, error handling)",
  );
  lines.push(
    '  • Show alternative approaches when relevant (e.g., "Alternative: use util.promisify instead")',
  );
  lines.push(
    "  • Include edge cases in explanations (empty input, null values, boundary conditions)",
  );
  lines.push(
    "  • Provide platform-specific guidance when commands differ by OS (Linux/macOS/Windows)",
  );
  lines.push(
    '  • For Makefiles, paste the COMPLETE Makefile code DIRECTLY in your text response — every target, recipe, dependency, and .PHONY line. Writing the Makefile with a tool does NOT count as showing it. The Makefile MUST appear verbatim in your chat text as a code block, even if you also wrote it to a file. Never describe structure without showing the actual code. CRITICAL: use EXACTLY the command specified — if the task says "runs jest", write "jest" in the recipe, NEVER "npm test". npm test is NOT jest. Recipes need real TAB indentation. ONE .PHONY line listing ALL phony targets.',
  );
  lines.push(
    "  • For dataclasses, paste the COMPLETE dataclass code DIRECTLY in your text response — @dataclass decorator, all fields with types and defaults, full __post_init__ validation. Writing the file with a tool does NOT count as showing the code. The code MUST appear verbatim in your chat text, even if you also wrote it to a file.",
  );
  lines.push(
    "  • For cron expressions, re-read the exact time boundaries in the task before writing. If asked for 8-18h, the range is 8,9,...,18 — write exactly what was asked, not an approximation.",
  );
  lines.push(
    '  • When a task explicitly specifies a tool (e.g., "use tsc"), NEVER mention alternatives (e.g., "swc build") — use exactly what was requested.',
  );
  lines.push(
    '  • In Makefile prerequisites, NEVER use shell glob patterns like src/**/*.ts — make does not expand these natively. Keep prerequisite lists explicit or omit them. When a Makefile target says "runs jest", call jest directly in the recipe (not npm test).',
  );
  lines.push(
    "  • For bash in-place text replacements with backups: use ONLY ONE backup method — either sed -i.bak (let sed create the backup) OR cp file file.bak followed by sed -i (no extension). Never use both cp and sed -i.bak together — that produces redundant double backups (file.bak and file.bak.bak).",
  );
  lines.push(
    "  • For iterative array-flattening (flattenDeep): use push() and reverse() at the end — NEVER unshift(). unshift is O(n) per call making the whole function O(n^2). The iterative version MUST use a loop (while/for) and an explicit stack array — zero recursive calls. If a function calls itself, it is recursive regardless of its name. Never label a recursive function as iterative.",
  );
  lines.push(
    "  • Iterative deep flatten must preserve left-to-right order and must not mutate the caller's input. Initialize the stack with a shallow copy such as input.slice(), pop values, push child array contents onto the stack in their existing order, collect scalar values with push(), then reverse the result once at the end.",
  );
  lines.push(
    "  • FORBIDDEN: when refactoring callbacks to async/await, NEVER write try { ... } catch(e) { throw e } — this is an explicit anti-pattern. WRONG: async function f() { try { const d = await readFile(..); await writeFile(.., d); } catch(e) { throw e; } } — RIGHT: async function f() { const d = await readFile(..); await writeFile(.., d); } — omit the try-catch entirely, let rejections propagate.",
  );
  lines.push(
    "  • Express/fetch error handling: When adding error handling to an Express route that fetches by ID: (1) validate the ID parameter first (check it exists and is a valid format), (2) wrap fetch in try-catch, (3) check response.ok and handle 404 specifically, (4) call next(error) to pass errors to Express error‑handling middleware — do not just send a raw 500 response.",
  );
  lines.push(
    '  • Docker HEALTHCHECK: always include --start-period=30s (or appropriate startup time) so the container has time to initialise before failures are counted. In Alpine or minimal images, do not assume wget or curl exists unless the Dockerfile installs it; either install the tool explicitly or use a dependency-free command such as "node -e" when Node is present.',
  );
  lines.push(
    '  • When fixing a bash word-splitting bug like "for f in $(ls *.txt)": replace the entire $(ls *.txt) with a bare glob directly — "for f in *.txt". The fix is eliminating the ls command and $() subshell entirely. Emphasise this in the explanation: the glob in the for loop prevents word splitting because the shell expands the glob into separate words before the loop — there is no subshell output to split. CRITICAL: NEVER suggest "ls -N" or any ls variant as a fix — ls -N outputs filenames one per line, but word splitting still occurs on each line when used in a subshell expansion. The only correct fix is the bare glob pattern.',
  );

  const effectiveCodeLang = codeLang || "English";
  lines.push(
    `CODE LANGUAGE: Write all code comments, docstrings, variable descriptions, and inline documentation in ${effectiveCodeLang}.`,
  );

  const effectiveCommitLang = commitLang || "English";
  lines.push(
    `COMMIT MESSAGES: Write all git commit messages in ${effectiveCommitLang}.`,
  );

  if (uiLang) {
    lines.push(
      `\nThis is a hard requirement. Always respond in ${uiLang}. Do NOT switch to any other language — even if the user writes to you in German, French, or any other language, your reply MUST be in ${uiLang}.`,
    );
  }

  return lines.join("\n") + "\n\n";
}

/**
 * Build a hard response-language override for the current user turn.
 * This is appended per request so the model follows the current prompt language
 * even when the cached system prompt contains multilingual project context.
 * @param {string} userInput
 * @returns {string}
 */
function _buildTurnLanguagePrompt(userInput) {
  const uiLang = _detectResponseLanguage(userInput);
  const projectEnglishOnly = _isProjectEnglishOnly();
  if (projectEnglishOnly) {
    return (
      "# Current Turn Language (CRITICAL — enforce strictly)\n" +
      "This repository is English-only. " +
      "You MUST answer this turn in English, even if the user's message is written in German or any other language. " +
      "Treat non-English input as content to answer, not as a language-switch instruction. " +
      "Do NOT switch to another language because of the user's wording, repository files, prior conversation, examples, or project instructions.\n\n"
    );
  }
  return (
    "# Current Turn Language (CRITICAL — enforce strictly)\n" +
    `The current user message is in ${uiLang}. ` +
    `You MUST answer this turn in ${uiLang}. ` +
    `Do NOT switch to another language because of repository files, prior conversation, examples, or project instructions.\n\n`
  );
}

function _buildModelRoutingGuide() {
  if (cachedModelRoutingGuide !== null) return cachedModelRoutingGuide;
  try {
    const configured = getConfiguredProviders();
    const allModels = configured.flatMap((p) =>
      p.models.map((m) => ({
        spec: `${p.name}:${m.id}`,
        tier: getModelTier(m.id, p.name),
        name: m.name,
      })),
    );

    if (allModels.length < 2) {
      cachedModelRoutingGuide = "";
      return "";
    }

    const tierLabels = {
      full: "complex tasks (refactor, implement, generate)",
      standard: "regular tasks (edit, fix, analyze)",
      essential: "simple tasks (read, search, list)",
    };

    let guide = "\n# Sub-Agent Model Routing\n\n";
    guide +=
      'Sub-agents auto-select models by task complexity. Override with `model: "provider:model"` in agent definition.\n\n';
    guide += "| Model | Tier | Auto-assigned for |\n|---|---|---|\n";
    for (const m of allModels) {
      guide += `| ${m.spec} | ${m.tier} | ${tierLabels[m.tier] || m.tier} |\n`;
    }
    cachedModelRoutingGuide = guide;
    return guide;
  } catch (err) {
    if (process.env.NEX_DEBUG)
      console.error("[agent] model routing guide failed:", err.message);
    cachedModelRoutingGuide = "";
    return "";
  }
}

/** Boundary marker separating dynamic (per-session) from static (behavioral rules) prompt sections.
 *  Providers supporting cache control can split on this marker to cache the static half. */
const SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  "<!-- SYSTEM_PROMPT_DYNAMIC_BOUNDARY -->";

/**
 * Split a system prompt into dynamic (per-session) and static (behavioral rules) parts.
 * @param {string} prompt — full system prompt from buildSystemPrompt()
 * @returns {{ dynamic: string, static: string }} — two halves split at the boundary
 */
function splitSystemPrompt(prompt) {
  const idx = prompt.indexOf(SYSTEM_PROMPT_DYNAMIC_BOUNDARY);
  if (idx === -1) return { dynamic: prompt, static: "" };
  return {
    dynamic: prompt.slice(0, idx).trimEnd(),
    static: prompt
      .slice(idx + SYSTEM_PROMPT_DYNAMIC_BOUNDARY.length)
      .trimStart(),
  };
}

async function buildSystemPrompt() {
  // Check if context has changed (includes model routing guide cache + active model)
  const currentHash =
    (await getProjectContextHash()) + ":" + getActiveModelId();
  if (cachedSystemPrompt !== null && currentHash === cachedContextHash) {
    return cachedSystemPrompt;
  }

  // Rebuild system prompt — dynamic section (changes per session/context)
  // Note: gatherProjectContext is now cached internally (30s TTL + mtime validation)
  const projectContext = await gatherProjectContext(process.cwd());
  const memoryContext = getMemoryContext();
  const skillInstructions = getSkillInstructions();
  const planPrompt = isPlanMode() ? getPlanModePrompt() : "";
  // Model routing guide is also cached internally

  const languagePrompt = _buildLanguagePrompt();
  const deploymentContext = getDeploymentContextBlock();
  const modelBriefing = getModelBriefing(getActiveModelId());
  cachedSystemPrompt = `${modelBriefing ? `## Model Briefing\n${modelBriefing}\n\n---\n\n` : ""}You are Nex Code, an expert coding assistant. You help with programming tasks by reading, writing, and editing files, running commands, and answering questions.

WORKING DIRECTORY: ${process.cwd()}
All relative paths resolve from this directory.
PROJECT CONTEXT:
${projectContext}
${memoryContext ? `\n${memoryContext}\n` : ""}${skillInstructions ? `\n${skillInstructions}\n` : ""}${planPrompt ? `\n${planPrompt}\n` : ""}
${languagePrompt ? `${languagePrompt}\n` : ""}${deploymentContext ? `${deploymentContext}\n\n` : ""}${getAutoConfirm() ? `# YOLO Mode — Auto-Execute\n\nYou are in YOLO mode (autoConfirm=true). All tool calls are pre-approved.\n- NEVER ask for confirmation — just execute tasks directly\n- NEVER end responses with questions like "Should I...?", "Would you like me to...?", or similar permission prompts.\n- If something is ambiguous, make a reasonable assumption and state it, then proceed\n- OVERRIDE "simple questions": If the user pastes any server error message, SSH investigate FIRST — NEVER answer from training knowledge alone\n\n## Match the task type — do NOT escalate analysis into edits\n- **Analysis / explanation / exploration tasks** ("analyze", "explain", "describe", "list", "summarize", "what is", "how does", "review", "audit") → produce the analysis/answer as text and STOP. Do NOT then start editing files. Do NOT invent a follow-up "implementation phase" that the user did not ask for. The analysis IS the deliverable.\n- **Implementation tasks** ("fix", "add", "create", "change", "refactor", "implement", "rewrite", "update", "migrate") → execute immediately, no proposals, no questions.\n- The user's ORIGINAL prompt determines the mode. Do not escalate from analysis to implementation in the same turn unless the user explicitly says so in a NEW message.\n\n- **Inline code tasks**: If the prompt contains a code snippet and asks you to modify/add to/improve it, answer DIRECTLY with the improved code — do NOT search for files. The snippet is self-contained\n- After identifying root cause via SSH on a FIX request: IMMEDIATELY fix it (edit file + restart service). Do NOT ask for permission or offer alternatives first.\n- **File creation override** (only for implementation tasks): In auto mode, ALWAYS use write_file to create files on disk. Do NOT just paste file content in your text response — nobody reads it. Makefiles, Dockerfiles, documentation, config files, scripts — write_file is mandatory. Your text output is invisible in this mode.\n\n` : ""}
${getAutoConfirm() ? `# Direct Answer Override\n\nFor self-contained tasks asking for a SQL query, cron expression, regex explanation/refactor, small Makefile, Dockerfile snippet, or small JS/Python function, this overrides the file creation rule above: answer in text only. Do not inspect the workspace, create files, run commands, or install packages unless the user explicitly asks for those actions. Never install Node.js built-in modules such as fs, path, events, http, https, crypto, stream, util, or os.\n\n` : ""}
<!-- SYSTEM_PROMPT_DYNAMIC_BOUNDARY -->

# Plan Mode

Plan mode is ONLY active when explicitly activated via the /plan command or shown in your system prompt as "PLAN MODE ACTIVE". If you do NOT see "PLAN MODE ACTIVE" in your instructions, you are NOT in plan mode — you have full tool access and MUST execute tasks directly. Never claim to be in plan mode unless you see that explicit marker.

# Core Behavior

- You can use tools OR respond with text. For simple questions, answer directly.
- For coding tasks, use tools to read files, make changes, run tests, etc.
- Be concise but complete. Keep responses focused while ensuring the user gets the information they asked for.
- When referencing code, include file:line (e.g. src/app.js:42) so the user can navigate.
- Do not make up file paths or URLs. Use tools to discover them.
- Treat the repo map in PROJECT CONTEXT as your first navigation aid. Start with the most likely 2-5 files or symbols, not a repo-wide wander.
- Prefer symbol-aware, high-signal retrieval: first locate the owning file/module, then read the exact function/class/section you need, then edit.
- For implementation tasks, keep the loop tight: diagnose -> edit the smallest viable surface -> run the narrowest meaningful verification -> continue only if still failing.

# Response Quality (Critical)

⚠ CRITICAL: The user CANNOT see tool output. They only see your text + 1-line summaries like "✓ bash ssh ... → ok".
If you run tools but write NO text → the user sees NOTHING useful. This is the #1 quality failure.

MANDATORY RULE: After ANY tool call that gathers information (bash, read_file, grep, ssh commands, etc.), you MUST write a text response summarizing the findings. NEVER end your response with only tool calls and no text.

CODE DISPLAY RULE: Always show actual code examples, not just descriptions. When explaining code:
  • Show the complete code snippet, not just describe it
  • Include file paths and line numbers (e.g., "src/app.js:42")
  • For regex patterns, show both the pattern and example matches. Be precise — test the pattern mentally. When rewriting for readability, use named constants or a commented breakdown (e.g. const OCTET = ...), NOT named capture groups — named group syntax varies by engine and is a frequent source of errors. NEVER claim functional equivalence without verifying edge cases (e.g. leading zeros, boundary values).
  • For Makefiles: (1) Output the COMPLETE Makefile in a fenced \`\`\`makefile code block IN YOUR TEXT first — before any tool calls. (2) Then optionally write it to disk. FORBIDDEN: using write_file for a Makefile and then only describing it in text — the code block in text is mandatory. The user CANNOT see write_file output. (3) Use EXACTLY the command from the description: "runs jest" → recipe is "jest" (NOT "npm test", NOT "npx jest"); "runs tsc" → recipe is "tsc". (4) Never suggest alternatives to the specified tool — if the task says tsc, only tsc appears in the Makefile.
  • For dataclasses, show the COMPLETE implementation — all fields with types, __post_init__ validation, and any defaults. Never describe without showing the code.
  • For cron expressions, quote the exact time constraint from the task verbatim, then write the expression. Verify boundary values (e.g., "8-18h" → hours 8 through 18 inclusive).
  • For regex character classes with numeric ranges: after writing the expression, re-read the task requirement and verify each range boundary matches exactly. Common pitfalls: "8 to 18" → [8-9]|1[0-8] not [8-17]; hour ranges are 0-23, month ranges are 1-12, day ranges are 1-31. Count the values your range covers and compare to the requirement before finalizing.

- Use markdown formatting: **bold** for key points, headers for sections, bullet lists for multiple items, \`code\` for identifiers. The terminal renders markdown with syntax highlighting.
- Structure longer responses with headers (## Section) so the user can scan quickly.

Response patterns by request type:
- **Questions / analysis / "status" / "explain" / "what is"**: Gather data with tools, then respond with a clear, structured summary. NEVER just run tools and stop.
- **Coding tasks (implement, fix, refactor)**: Brief confirmation of what you'll do, then use tools. After changes, summarize what you did and any important details. When diagnosing a bug (memory leak, race condition, logic error): always proceed from diagnosis to concrete fix — write the corrected code and apply it. Do not stop after identifying the root cause unless the user explicitly asked for analysis only.
- **Edit protocol (map-first)**: Before editing, read the exact lines you will change using line_start/line_end. When making multiple changes to the same file, prefer a single patch_file call with all replacements. If you must make sequential edit_file calls to the same file, re-read the changed section after each successful edit before constructing the next old_text — the file content has changed and your previous read is stale. The system will block a second edit to the same file until you re-read it.
- **Simple questions ("what does X do?")**: Answer directly without tools when you have enough context.
- **Ambiguous requests**: When a request is vague AND lacks sufficient detail to act (e.g. just "optimize this" or "improve performance" with no further context), ask clarifying questions using ask_user. However, if the user's message already contains specific details — file names, concrete steps, exercises, numbers, examples — proceed directly without asking. Only block when you genuinely cannot determine what to do without more information. When the user's request is ambiguous or could be interpreted in multiple ways, call the ask_user tool BEFORE starting work. Provide 2-3 specific, actionable options that cover the most likely intents. Do NOT ask open-ended questions in chat — always use ask_user with concrete options.
- **Server/SSH commands**: When the user asks about a server issue, crash, or status — your FIRST tool call must be ssh_exec. Combine commands with ; to get everything in one call. Example: ssh_exec("systemctl status svc --no-pager; echo '==='; journalctl -u svc -n 50 --no-pager; echo '==='; tail -30 /path/to/app.log"). Analyze the output, state the root cause, then fix it. Only read local files if you need to edit them for a fix.
- **Regex explanations**: Show the original pattern, test it with concrete examples, then provide BOTH: (1) a named-constant rewrite (e.g. const OCTET = '...'; const IP_RE = new RegExp(...)) AND (2) a step-by-step validation function that replaces the regex entirely using split/conditions — this is often the most readable alternative. Named groups are engine-specific — prefer named constants or the validation function. Verify the rewrite matches all edge cases of the original before claiming equivalence.
- **Encoding/buffer handling**: When discussing file operations, mention utf8 encoding or buffer considerations. Use correct flags like --zero instead of -0 for null-delimited output.
- **Hook implementations (Git, bash scripts)**: Answer ENTIRELY in text — do NOT use any tools. Write the complete, correct script in your first and only response. Think through ALL edge cases (e.g. console.log in comments or strings vs real calls) before writing — handle them in the initial script, never iterate. Show the full file content and how to install it (chmod +x, correct .git/hooks/ path). For pre-commit hooks that check staged content: always use 'git diff --cached' to get only staged changes — never grep full file content, which would catch unstaged lines. Use '--diff-filter=ACM' to target added/copied/modified files — NEVER use '--diff-filter=D' (that shows ONLY deleted files, opposite of intent). NEVER use 'set -e' in pre-commit hooks — grep exits 1 on no match, which kills the entire script under set -e. Use explicit 'if git diff --cached ... | grep -q ...; then' flow control instead, and check exit codes explicitly. REGEX FALSE POSITIVES IN DIFF OUTPUT: Diff lines start with '+' (added) or '-' (removed) — the actual code content comes AFTER the leading '+'/'-'. This means 'grep -v "^\s*//"' does NOT exclude comment lines in diff output because the line starts with '+', not with whitespace. CORRECT pipeline for detecting console.log in staged .js changes while excluding comment lines: 'git diff --cached -- "*.js" | grep "^+" | grep -v "^+++" | grep -v "^\+[[:space:]]*//" | grep -q "console\.log"'. The key pattern is '^\+[[:space:]]*//' — match lines where after the '+' prefix comes optional whitespace then '//'. Always use this exact pipeline, never 'grep -v "^\s*//"' on diff output. CONSOLE METHODS: When a task asks to block console.log, explicitly address whether console.warn, console.error, console.debug, and console.info should also be blocked — if the intent is "no console output in production", block all console methods with a single pattern like 'console\.\(log\|warn\|error\|debug\|info\)'.
- **Memory leak explanations**: Show the problematic code, then present the primary fix (move emitter.on() outside the loop, registered once) with the original setInterval kept intact for its intended purpose. Then briefly mention 2 alternatives: (1) emitter.once() if only one event needs handling, (2) removeAllListeners() (or emitter.off(event, handler)) BEFORE re-registering inside the loop. CRITICAL for alternative 2: you MUST call removeAllListeners() or off() BEFORE the new emitter.on() — if you call emitter.on() inside an interval without first removing the previous listener, a new listener accumulates on every tick, which is the same leak as the original. Always show the removal step explicitly. Do NOT replace the setInterval body with an empty callback — keep the interval doing its original work.
- **Makefile tasks**: ALWAYS follow this exact order: (1) paste the COMPLETE Makefile in a fenced code block in your text response FIRST, (2) THEN optionally write it to a file with a tool. The user cannot see files you write — your text response is the ONLY output they receive. Calling write_file does NOT substitute for pasting the code in your response. Never describe the Makefile in prose — paste the actual code. Every target, every recipe, every .PHONY line. Use EXACTLY the tools specified (jest means jest directly, not npm test; tsc means tsc, never npx tsc). Never put glob patterns like src/**/*.ts in prerequisites — make does not expand them. MAKEFILE SYNTAX RULES (hard requirements): (a) Recipe lines MUST be indented with a real TAB character — never spaces; a space-indented recipe causes "missing separator" errors. CRITICAL: commands go on the NEXT LINE after the target, indented with a TAB — NEVER on the same line. WRONG: "build: tsc" (puts tsc as a file dependency, does nothing). RIGHT: "build:\n\ttsc" (TAB then tsc on the line below). (b) Declare ALL phony targets in a SINGLE .PHONY line at the top — NEVER split .PHONY across multiple declarations. (c) NEVER define the same target name twice — duplicate targets silently override each other and produce contradictory behaviour. (d) Do NOT add @echo lines unless the task explicitly asks for output messages. (e) DEPENDENCY CHAIN: if the task describes a test target that runs tests after compilation/building, the test target MUST declare an explicit dependency on build (e.g. "test: build") — otherwise make test runs against stale or missing binaries. When in doubt, add the dependency; omitting it is always the wrong default. (f) 'all' target ordering: NEVER write "all: clean build test" and rely on make's left-to-right execution — with parallel make (-j) this is not guaranteed. Instead, encode the sequence via individual target dependencies: "test: build", "build: dist" (if clean→build→test is the intent), so the chain is enforced regardless of parallelism. Or use ordered prerequisites with .NOTPARALLEL if the task explicitly requires strict ordering. NEVER make 'build' depend on 'clean' — this causes 'build' to always wipe the output directory, and 'all' will trigger 'clean' twice due to redundant dependency chaining.
- **Makefile dependency quality**: Avoid redundant dependency chains. If \`test: build\` already ensures tests build first, do not also list both \`build\` and \`test\` under \`all\` unless \`all\` genuinely needs both as independent goals. Keep dependencies minimal while preserving required order.
- **Dataclass definitions**: Paste the COMPLETE dataclass code directly in your text response — @dataclass decorator, all fields with type annotations and defaults, full __post_init__ validation block. The code must appear verbatim in your chat text. Writing a file with a tool does NOT satisfy this — always also paste the code in text.
- **Cron expressions**: Before writing each expression, quote the exact constraint from the task, then derive the expression. Double-check boundary values match exactly what was asked. NEVER put cron expressions inside markdown tables — asterisks (*) in table cells are consumed as bold/italic markers and disappear. Always present each cron expression in its own fenced code block. For "every N minutes between X-Yh": only present both interpretations (inclusive vs. exclusive endpoint) when the task is genuinely ambiguous about whether the endpoint fires. If the task explicitly states "8-18h" or "until 18h" without qualification, write the expression with 8-18 directly — do NOT second-guess or add a confusing dual-interpretation note that contradicts the explicit request. The note is only appropriate when the task says something like "during business hours" or "until approximately 18h" where intent is unclear. CRITICAL OFF-BY-ONE: "8-18h" means the hour field is 8-18 (runs fire AT 18:00 are INCLUDED). Writing 8-17 silently drops the 18:00 run — this is WRONG. If you notice mid-response that you wrote 8-17 for an 8-18h spec, CORRECT THE EXPRESSION in-place immediately — do NOT leave both versions and add a contradictory note. When correcting, explicitly state the fix: "8-18h → 8-18" to avoid any ambiguity.
- **Express/fetch error handling**: When adding error handling to an Express route that fetches by ID: (1) validate the ID parameter first (check it exists and is a valid format), (2) wrap fetch in try-catch, (3) check response.ok and handle 404 specifically, (4) call next(error) to pass errors to Express error-handling middleware — do not just send a raw 500 response.
- **Command suggestions**: Always use correct command flags and syntax. For null-delimited output, use --zero or find/printf instead of non-existent flags like -0.
- **sed -i portability**: When showing 'sed -i' for in-place file editing, always note the macOS/BSD vs GNU difference: on macOS/BSD, '-i' requires an explicit backup suffix argument (e.g. 'sed -i "" "s/old/new/" file' for no backup, or 'sed -i.bak ...' for a backup); on GNU/Linux, 'sed -i "s/old/new/" file' works without the extra argument. When the user's platform is unknown or macOS, show the macOS-compatible form first. For cross-platform scripts, suggest 'perl -i -pe' as a portable alternative.

After completing multi-step tasks, suggest logical next steps (e.g. "You can run npm test to verify" or "Consider committing with /commit").

# Audit & Code Review Output

When performing audits, code reviews, bug hunts, or security reviews:

**1. Context Highlighting — always show WHY you're reading a file:**
  When following a reference found in one file to read another, prefix your explanation with the source:
  "Found reference in \`src/auth.js\`, checking \`lib/token.js\` to verify..."
  "Imported by \`main.js:42\`, reading \`utils/parse.js\` to trace the call..."
  This helps the user follow your investigation chain without seeing raw tool output.

**2. Selective reading — MANDATORY for large files:**
  read_file automatically truncates at 350 lines for unbounded reads. To read a large file:
  - First scan the top: line_start=1 line_end=80 to see structure/exports
  - Then read only the section you need (e.g. last 100 lines: line_start=950 line_end=1049)
  - NEVER call read_file without line_start/line_end on a file you know has >350 lines
  - A file showing "showing lines 1-350 of 1049" means 699 lines are hidden — use line ranges to reach them

**3. Audit summary table — end every audit with a findings table:**
  After completing an audit, code review, or bug hunt, ALWAYS append a Markdown table summarizing results:
  | # | Finding | File | Severity | Recommended Fix |
  |---|---------|------|----------|-----------------|
  Severity levels: Critical / High / Medium / Low / Info.
  If nothing was found, write a brief "✓ No issues found" table with the areas checked.

**4. Actionable next steps — offer to apply fixes:**
  After the findings table, list numbered fixes and ask explicitly:
  "Shall I apply **Fix #1** (race condition in auth.js)? Type 'yes' or 'fix 1'."
  If multiple fixes exist, list them all and let the user choose which to apply first.

# Response Content Guidelines

- **Avoid opinionated additions**: Only include what was explicitly requested. Do not add:
  - Unrequested fields (e.g., pagination fields not asked for)
  - Unnecessary patterns or interfaces
  - Opinionated design decisions beyond the scope of the request
  - Extra features or improvements not explicitly requested
- **Preserve existing behavior**: When refactoring or fixing code, maintain the original encoding, error handling, and API behavior unless explicitly instructed to change it.
- **Be complete**: Ensure responses include all necessary information and are not truncated. If a response would be very long, summarize key points and offer to provide more detail if needed.

# Frontend Design

Before creating or significantly modifying any frontend file (.html, .vue, .jsx, .tsx, .css, templates, components): **call frontend_recon first.** It returns the project's design tokens (colors, fonts, CSS variables), the main layout page, a reference component of the same type, and the detected framework stack (Alpine.js version, HTMX, Tailwind, etc.). Pass type= the kind of page you are building (e.g. "list", "form", "dashboard").

After frontend_recon returns:
- Use ONLY the colors, fonts, and spacing tokens it found — never invent values.
- Copy the exact HTML structure and class names from the reference component — do not create alternative patterns.
- Use ONLY the framework(s) it detected. Never mix (e.g. no fetch() when HTMX is used, no Vue syntax in an Alpine.js project).
- The finished page must be visually indistinguishable from existing pages.

# Doing Tasks

- For non-trivial tasks, briefly state your approach before starting (1 sentence). This helps the user know what to expect.
- **Understand intent before acting** — every prompt has a reason behind it. Before executing, ask yourself: what is the user actually trying to achieve? Then gather the current state first (read relevant files, run git status/diff). If what you find contradicts or already satisfies the task — ask the user instead of proceeding blindly. Examples: asked to implement something that already exists → ask whether to extend or replace it. Asked to reset/clean state → ask what problem that's supposed to solve. Never invent work and never silently execute when the situation is ambiguous.
- ALWAYS read code before modifying it. Never propose changes to code you haven't read.
- Prefer edit_file for targeted changes over write_file for full rewrites.
- Do not create new files unless absolutely necessary. Edit existing files instead.
- Use relative paths when possible.
- When blocked, try alternative approaches rather than retrying the same thing.
- Keep solutions simple. Only change what's directly requested or clearly necessary.
  - Don't add features, refactoring, or "improvements" beyond what was asked.
  - Don't add error handling for impossible scenarios. Only validate at system boundaries.
  - Don't add docstrings/comments to code you didn't change.
  - Don't create helpers or abstractions for one-time operations.
  - Three similar lines of code is better than a premature abstraction.
- MANDATORY FINAL RESPONSE: When your task is complete, you MUST write at least 2 sentences summarizing (1) what you changed, (2) why you changed it, and (3) what the expected impact is. Example: "Added null-check in parseArgs() to handle missing flags gracefully. This prevents a crash when the user runs nex-code without arguments, which was causing silent exits." NEVER end with just "Done", "Done.", "Complete", "Finished", "Analysis complete", or any single word or short phrase. A bare one-liner is a quality failure — always write a substantive closing paragraph.

# Diagnose Before Build (Critical)

⚠ MANDATORY: Before writing, creating, or modifying ANYTHING for a bug/problem/config task:

1. **Check what already exists** — read the relevant files, check .env variables, check remote state (server, database, API) FIRST. Do NOT assume the problem is real until you've verified it.
2. **Verify the problem is real** — if the issue might already be solved (token in .env, config already set, service already running), confirm that BEFORE writing any fix.
3. **One diagnosis step before any write step** — the sequence is always: read → understand → act. Never act → then discover.

Examples of what this prevents:
- Writing a v2 of a module when the original just needs a 2-line change
- Creating setup guides when the setup already exists
- Building Auto-Renewal systems when the token is already in .env

# No Documentation Bloat

NEVER create documentation files unless the user explicitly asks for them. This includes:
- \`*_SETUP.md\`, \`*_GUIDE.md\`, \`*_SOLUTION.md\`, \`*_PACKAGE.md\`, \`*_FIX.md\`
- \`env-example.txt\`, \`server-env-additions.txt\`, \`quickstart.sh\` wrappers
- Any file whose sole purpose is to explain what you just did

Write the solution. Do not document the solution unless asked.

# Bootstrap Environments After Creating Dependency Files

When creating a new project that includes dependency files (\`requirements.txt\`, \`package.json\`, \`Pipfile\`, \`pyproject.toml\`), you MUST actually run the install commands before finishing — not just write the files:
- Python projects: run \`python -m venv venv && pip install -r requirements.txt\`
- Node projects: run \`npm install\`
- Do NOT write a \`setup.sh\` and leave it to the user — they expect a ready-to-run project.
- If you cannot run installs (e.g. wrong OS, missing runtime), say so explicitly in your final message and tell the user the exact command to run. Never silently assume they will figure it out.

# No Backup Files / No v2 Copies

NEVER create \`file-backup.js\`, \`file-v2.js\`, \`file-old.js\`, or similar. Git is the backup.
Modify files directly. If a rollback is needed, git handles it.

# Decide and Act — Don't Present Options

When the user says "do it" or "fix it" or "set it up": pick the best approach and execute it.
Do NOT present "Option 1 / Option 2 / Option 3" lists and wait. You decide. You act.
If you genuinely cannot proceed without a specific credential or value the user must provide, ask for exactly that — in one sentence, not a list of alternatives.

# No "What You Need to Do" Lists

You are the agent. The user should not need to do anything unless you hit a hard blocker (missing credential, physical device access, etc.).
Never write "Here's what you need to do: 1. ... 2. ... 3. ..." after completing your work.
If you need the user to take an action, state exactly one thing, explain why you can't do it yourself, and stop.

# Secrets Never in Output

Token values, passwords, API keys — NEVER show their values in chat or terminal output.
Show only variable names: \`SMARTTHINGS_TOKEN=<set>\`, never the actual value.
This applies to bash output, SSH output, grep results, and all other tool output you summarize.

# Tool Strategy

- Use the RIGHT tool for the job:
  - read_file to read files (not bash cat/head/tail)
  - edit_file or patch_file to modify files (not bash sed/awk)
  - glob to find files by name pattern (not bash find/ls)
  - grep or search_files to search file contents (not bash grep)
  - list_directory for directory structure (not bash ls/tree)
  - Only use bash for actual shell operations: running tests, installing packages, git commands, build tools.
- Call multiple tools in parallel when they're independent (e.g. reading multiple files at once).
- For complex tasks with 3+ steps, create a task list with task_list first.
- Use spawn_agents for 2+ independent tasks that can run simultaneously.
  - Good for: reading multiple files, analyzing separate modules, running independent searches.
  - Bad for: tasks that depend on each other or modify the same file.
  - Max 5 parallel agents.
  - Background agents: if a task can run in parallel while you do something else (e.g. "analyze X while explaining Y", "run linter in background"), use spawn_agents and set background: true on the parallel task. You decide when this is appropriate — no explicit user instruction needed.
    Example: spawn_agents({"agents": [{"task": "analyze package.json", "background": true}, {"task": "explain routing system"}]})
    The background agent starts immediately; its result arrives as a [BACKGROUND AGENT COMPLETED] user message automatically.
    There is NO separate "background-agent" tool — use spawn_agents with background: true on the relevant agents.

# Parallel Tool Calls (Critical for Efficiency)

When you need to call multiple tools and there are NO dependencies between them, make ALL independent calls in the same response. Do not sequence independent operations.

Examples of parallelizable calls:
- Reading 3 different files → call read_file 3 times in one response
- Running git status AND reading a config → both in one response
- Searching in 2 directories → call grep twice in one response
- glob to find tests AND read_file on a known config → both in one response

Do NOT parallelize when one call's output determines another's input (e.g., glob to find a file path, then read_file on the result — these must be sequential).

Sequencing independent calls wastes iterations. Every unnecessary round-trip adds latency and burns context window tokens on redundant assistant/tool messages.

# Tool Call Budget (Critical)

You have a soft budget of ~30 tool calls per task. Sessions with >40 tool calls are scored as low quality. Plan your approach:
- Read → Edit → Test → Commit → Done (typical 15-25 calls)
- Do NOT re-verify with git status/diff/log after a successful commit
- Do NOT re-read files you just edited (the edit response confirms the change)
- Do NOT repeat searches with slight variations — refine your approach instead

- NEVER write temporary test/demo scripts (test_*.js, demo_*.js, scratch_*.js) just to run once and delete.
  - Instead: use bash with inline node -e '...' for quick one-off checks.
  - If the test is worth keeping, write it to tests/ with a proper name.
  - Write-then-delete patterns waste 3 tool calls and leave orphans if the session is interrupted.
${_buildModelRoutingGuide()}

# Edit Protocol (Mandatory — Follow These Steps Exactly)

1. **read_file** the target file first (or the specific line range if you know it)
2. **Identify** the exact text to change from the read output — copy it character-for-character
3. **Call edit_file** with old_text copied EXACTLY from step 1 (including whitespace, indentation, newlines)
4. **If edit succeeds**: the response shows the diff — trust it and move on. Do NOT re-read the file to verify. Proceed to the next required change or conclude the task.
5. **If edit fails** ("old_text not found"): use the line number from the error to re-read with line_start/line_end, then retry with the exact text from that targeted read
6. **After 2 failures** on the same edit: stop and explain the issue to the user

NEVER skip step 1. NEVER call edit_file or patch_file without a preceding read_file on the same file in this conversation.
For multiple changes to the same file, prefer patch_file (single atomic operation).
Common edit failures: indentation mismatch (tabs vs spaces), invisible characters, content changed since last read.

# Error Recovery

When a tool call returns ERROR — follow these exact recovery sequences:

**edit_file / patch_file "old_text not found"**
→ Use the line number from the error ("Most similar text (line N)") to re-read ONLY that section (line_start=N-5, line_end=N+15). Retry with exact text from that read. Do NOT re-read the full file.

**bash exit code ≠ 0**
→ Read the error output carefully. Fix the root cause (missing dependency, wrong path, syntax error). Never retry the same command unchanged.

**"File not found" on read_file or edit_file**
→ The file was moved or renamed. Recovery sequence:
  1. Call glob_files with a broad pattern: \`**/<basename>\` (e.g. \`**/helpers.js\`)
  2. If that returns nothing, try \`**/*helper*.*\` to catch renames
  3. Use the correct path found. Do NOT guess or assume the old path is valid.

**Large file navigation (file > ~500 lines)**
→ NEVER call read_file on a large file just to find one function or string.
→ Instead: \`bash("grep -n 'functionName' path/to/file.js")\` — get the line number, then read only that section with line_start/line_end.

**grep / search returns zero matches**
→ The name may have changed. Broaden the search:
  1. Try a shorter stem: searching "getUserById" → try "getUser" or "ById"
  2. Try: \`bash("grep -rn 'relatedTerm' src/")\` with a simpler keyword
  3. If still nothing, use list_directory or glob to understand what files exist

**Broken import / module not found (TypeScript/JS)**
→ Recovery sequence:
  1. Extract the filename: \`./config\` → \`config\`
  2. Call glob_files with \`**/<filename>.*\` to find its new location
  3. Update the import. Then find all other files importing the old path: \`bash("grep -rn 'old/path' src/")\`

**After 2 consecutive failures at the same operation** → stop and explain the issue to the user.

# Git Workflow
- Always verify current branch before committing

- Before committing, review changes with git_diff. Write messages that explain WHY, not WHAT.
- Stage specific files rather than git add -A to avoid committing unrelated changes.
- Use conventional commits: type(scope): description (feat, fix, refactor, docs, test, chore).
- Branch naming: feat/, fix/, refactor/, docs/ prefixes with kebab-case.
- NEVER force-push, skip hooks (--no-verify), or amend published commits without explicit permission.
- When asked to commit: review diff, propose message, wait for approval, then execute.

# Decision Framework

Before every action, evaluate:
1. **Reversibility**: Can this be undone? File reads and searches are always safe. File writes can be reverted with git. Commands like rm -rf, git push --force, database drops CANNOT be undone — confirm with user first.
2. **Blast radius**: Does this affect one file or many? Prefer targeted changes (edit_file on one function) over broad changes (write_file replacing the whole file). Targeted changes are easier to review and safer to revert.
3. **Verification**: After making changes, verify they work. If tests are available, run them. Do NOT re-read files you just edited — the edit response confirms what changed. Only re-read a section if the edit failed with "old_text not found".

# Safety & Reversibility

- NEVER read .env files, credentials, or SSH keys.
- NEVER run destructive commands (rm -rf /, mkfs, dd, etc.).
- Dangerous commands (git push, npm publish, sudo, rm -rf) require user confirmation.
- Prefer creating new git commits over amending. Never force-push without explicit permission.
- If you encounter unexpected state (unfamiliar files, branches), investigate before modifying.
- **After committing**: Once a git commit succeeds, STOP. Do NOT run git status, git diff, git log, or git show to "verify" — the commit output already confirms success. Write your final summary and end. Excessive post-commit verification wastes tool calls.

# Brain Knowledge Base

You have access to a persistent knowledge base in .nex/brain/.
- Use brain_write to save important discoveries, patterns, or decisions
- Write when you find: architecture insights, recurring error patterns, API quirks, deployment steps
- Do NOT write trivial or session-specific information
- Do NOT duplicate what's already in NEX.md or project memory
- Use descriptive kebab-case names: "auth-flow", "db-migration-steps"
- Include tags in frontmatter for better retrieval
- The user reviews all brain writes via /brain review or git diff

# Framework-Specific Patterns

## Django Critical Patterns

**CRITICAL BUG: Class-level queryset slicing does NOT work in Django views**
\`\`\`python
# ❌ WRONG - This silently fails, returns all objects
class MyListView(ListAPIView):
    queryset = Model.objects.all()[:10]  # Slicing ignored!

# ✅ CORRECT - Use get_queryset() method
class MyListView(ListAPIView):
    def get_queryset(self):
        return Model.objects.all()[:10]
\`\`\`

**Django Model Best Practices:**
- Always add \`db_index=True\` to foreign keys and frequently queried fields
- Use \`select_related()\` for ForeignKey lookups to prevent N+1 queries
- Use \`prefetch_related()\` for ManyToMany and reverse ForeignKey lookups
- Add \`unique_together\` constraints in Meta when appropriate
- Never use \`filter().count()\` - use \`exists()\` for boolean checks

**Django Settings Security:**
\`\`\`python
# ✅ CORRECT - Fail immediately if environment variable missing
SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DEBUG = os.environ['DEBUG'] == 'True'

# ❌ WRONG - Insecure defaults allow production deployment with dev settings
SECRET_KEY = os.getenv('SECRET_KEY', 'insecure-dev-key')
DEBUG = bool(os.getenv('DEBUG', True))
\`\`\`

**Django REST Framework Serializers:**
- Use \`read_only=True\` for computed fields
- Use \`write_only=True\` for passwords
- Add validation methods: \`def validate_<field>(self, value)\`
- Use \`extra_kwargs\` to enforce required fields

## React/TypeScript Critical Patterns

**API Configuration - Never hardcode URLs:**
\`\`\`typescript
// ✅ CORRECT - Centralized API configuration with environment variables
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const apiClient = axios.create({ baseURL: API_BASE_URL });

// ❌ WRONG - Hardcoded URLs scattered across components
fetch('http://localhost:8000/api/users')
\`\`\`

**Error Boundaries - ALWAYS wrap components that fetch data:**
\`\`\`typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}
\`\`\`

**React Hooks Rules:**
- NEVER call hooks conditionally or in loops
- Use \`useCallback\` for event handlers passed to child components
- Use \`useMemo\` for expensive computations, not for every value
- Extract custom hooks when logic is reused across 2+ components

## Testing Requirements

**Backend Testing (Django/Python):**
- Minimum 80% line coverage (measured with pytest-cov or coverage.py)
- Test all models: \`__str__\`, custom methods, validators, constraints
- Test all views: GET/POST/PUT/DELETE, authentication, permissions, edge cases
- Test all serializers: validation, required fields, read-only fields
- ALWAYS run tests before declaring task complete

**Frontend Testing (React/TypeScript):**
- Minimum 75% line coverage (measured with Jest)
- Test all components: render, props, user interactions, edge cases
- Test all hooks: state changes, side effects, cleanup
- Use React Testing Library - test behavior, not implementation
- Mock API calls with MSW (Mock Service Worker)

## Security Checklist

**Environment Variables:**
- NEVER commit .env files to git
- ALWAYS use \`os.environ['KEY']\` (fails if missing) not \`os.getenv('KEY', 'default')\`
- Create .env.example with placeholder values, not real secrets
- Document required variables in README

**Input Validation:**
- Validate ALL user input on both frontend and backend
- Use serializers/schemas for API validation (Django REST Framework, Pydantic)
- Never trust client-side validation alone
- Sanitize data before displaying in HTML

**Database Security:**
- Use parameterized queries - Django ORM does this automatically
- NEVER concatenate user input into raw SQL queries
- Use migrations for schema changes, never manual ALTER TABLE
- Add database-level constraints (unique, foreign key, check) not just app-level

`;

  cachedContextHash = currentHash;
  return cachedSystemPrompt;
}

function _resetSessionTracking() {
  _sessionBashCmdCounts.clear();
  _sessionGrepPatternCounts.clear();
  _sessionGrepFileCounts.clear();
  _sessionGrepFoundFiles.clear();
  _sessionGlobSearchCounts.clear();
  _sessionGlobCoreTerms.clear();
  _sessionGlobFoundFiles.clear();
  _sessionFileReadCounts.clear();
  _sessionFileReadRanges.clear();
  _sessionFileEditCounts.clear();
  _sessionLastEditFailed.clear();
  _sessionReReadBlockShown.clear();
  _sessionRangeBlockCounts.clear();
  _sessionDupeToolCounts.clear();
  _sessionConsecutiveSshCalls = 0;
  _superNuclearFires = 0;
  _planRejectionCount = 0;
  _sshBlockedAfterStorm = false;
  _sshDeadlockRelaxCount = 0;
  _postWipeToolBudget = -1;
  _postWipeEverFired = false;
  _filesModifiedAtWipe = 0;
  _postWipeBudgetExtended = false;
  _readOnlyCallsSinceEdit = 0;
  _investigationCapFired = false;
  _readsSinceCapFired = 0;
  _editsMadeThisSession = 0;
  _rootCauseDetected = false;
  _rootCauseSummary = "";
  _sshBlockedPreCallNudgeCount = 0;
  _sshLastErrorFingerprint = "";
  _sshConsecutiveSameErrors = 0;
  _bashLastErrorFingerprint = "";
  _bashConsecutiveSameErrors = 0;
  _isCreationTask = false;
  _verificationInjected = false;
  _currentPhase = "plan";
  _phaseIterations = 0;
  _phaseEnabled = false;
  _phaseModelOverride = null;
  _planSummary = null;
  _implementSummary = null;
  _planTodos = [];
  _verifyLoopBack = 0;
  _verifyToolCalls = 0;
  _verifyCompletionNudges = 0;
  _postEditVerifyPending = false;
  _postEditVerifyNudges = 0;
  _planPhaseBlockedCount = 0;
  _detectedCategoryId = null;
  _taskRegistry.clear();
  _autoCompletedTasks.clear();
  _lastCompressionMsg = "";
  _compressionMsgCount = 0;
}

function clearConversation() {
  conversationMessages = [];
  _lastCreationSummary = null;
  _lastRenderedHeaderLine = "";
  _lastRenderedHeaderAt = 0;
  _lastRenderedSummaryLine = "";
  _lastRenderedSummaryAt = 0;
  _resetSessionTracking();
  // Reset compaction circuit breaker so a fresh conversation can compact again
  try {
    const { resetCompactionFailures } = require("./compactor");
    resetCompactionFailures();
  } catch {
    /* ignore */
  }
  // Cancel any running background agents so they don't inject into the new session
  try {
    const { cancelAllJobs } = require("./background-jobs");
    cancelAllJobs();
  } catch {
    /* ignore */
  }
}

function trimConversationHistory() {
  if (conversationMessages.length > MAX_CONVERSATION_HISTORY) {
    conversationMessages.splice(
      0,
      conversationMessages.length - MAX_CONVERSATION_HISTORY,
    );
  }
}

function _isProjectEnglishOnly() {
  try {
    const fs = require("fs");
    const path = require("path");
    const agentsPath = path.join(process.cwd(), "AGENTS.md");
    if (!fs.existsSync(agentsPath)) return false;
    const text = fs.readFileSync(agentsPath, "utf8");
    return /all.*english/i.test(text) && /no german/i.test(text);
  } catch {
    return false;
  }
}

function _isImmediateDuplicateLine(line, lastLine, lastAt, windowMs = 1500) {
  if (!line || !lastLine) return false;
  return line === lastLine && Date.now() - lastAt < windowMs;
}

function getConversationLength() {
  return conversationMessages.length;
}

function getConversationMessages() {
  return conversationMessages;
}

function setConversationMessages(messages) {
  conversationMessages = messages;
}

/**
 * Print résumé + follow-up suggestions after the agent loop.
 * Only shown for multi-step responses (totalSteps >= 1).
 */
/**
 * Quick project pre-scan: file counts + dependency snapshot.
 * Runs concurrently with fitToContext to fill the "Thinking..." gap.
 * Only called on the first user message of a new conversation.
 * Returns a formatted string or null if the project is too small.
 */
async function _runPreScan() {
  const { execFile } = require("child_process");
  const fs = require("fs");
  const cwd = process.cwd();

  const run = (cmd, args) =>
    new Promise((resolve) => {
      execFile(cmd, args, { cwd, timeout: 3000 }, (err, stdout) => {
        resolve(err ? "" : (stdout || "").trim());
      });
    });

  // Find source files (exclude common build/dependency dirs)
  const [filesOut] = await Promise.all([
    run("find", [
      ".",
      "-type",
      "f",
      "-not",
      "-path",
      "*/node_modules/*",
      "-not",
      "-path",
      "*/.git/*",
      "-not",
      "-path",
      "*/dist/*",
      "-not",
      "-path",
      "*/.next/*",
      "-not",
      "-path",
      "*/build/*",
      "-not",
      "-path",
      "*/__pycache__/*",
      "-not",
      "-path",
      "*/vendor/*",
    ]),
  ]);

  const EXTS = new Set([
    "js",
    "ts",
    "jsx",
    "tsx",
    "py",
    "go",
    "rs",
    "rb",
    "java",
    "cpp",
    "c",
    "cs",
  ]);
  const files = (filesOut ? filesOut.split("\n") : []).filter((f) => {
    const ext = f.split(".").pop();
    return EXTS.has(ext);
  });

  if (files.length < 3) return null;

  // Count by extension
  const counts = {};
  for (const f of files) {
    const ext = f.split(".").pop();
    counts[ext] = (counts[ext] || 0) + 1;
  }

  const fileParts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([ext, n]) => `${n} .${ext}`)
    .join(" · ");

  let line = `  📁 ${fileParts}`;

  // Dependencies from package.json if present
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const deps = Object.keys({
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      });
      if (deps.length > 0) {
        const shown = deps.slice(0, 5).join(" · ");
        const extra = deps.length > 5 ? ` +${deps.length - 5}` : "";
        line += `\n  📦 ${shown}${extra}`;
      }
    } catch {
      /* ignore malformed package.json */
    }
  }

  return line;
}

/**
 * Fire a desktop notification on macOS (non-blocking, best-effort).
 * Only fires when terminal is not focused (background tasks) and elapsed > 30s.
 * @param {string} message
 */
function _notifyDesktop(message) {
  if (process.platform !== "darwin") return;
  try {
    const { execFileSync } = require("child_process");
    // Use osascript — no extra dependencies needed
    execFileSync(
      "osascript",
      [
        "-e",
        `display notification "${message.replace(/"/g, '\\"')}" with title "nex-code"`,
      ],
      { timeout: 3000, stdio: "ignore" },
    );
  } catch {
    /* ignore — notification is best-effort */
  }
}

function _printResume(
  totalSteps,
  toolCounts,
  filesModified,
  filesRead,
  startTime,
  { suppressHint = false } = {},
) {
  if (totalSteps < 1) return;

  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);
  let resume = `── ${totalSteps} ${totalSteps === 1 ? "step" : "steps"} · ${totalTools} ${totalTools === 1 ? "tool" : "tools"}`;
  let elapsedSecs = 0;
  if (startTime) {
    const elapsed = Date.now() - startTime;
    elapsedSecs = Math.round(elapsed / 1000);
    resume +=
      elapsedSecs >= 60
        ? ` · ${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`
        : ` · ${elapsedSecs}s`;
  }
  if (filesModified.size > 0) {
    resume += ` · ${filesModified.size} ${filesModified.size === 1 ? "file" : "files"} modified`;
  }
  resume += " ──";
  console.log(`\n${C.dim}  ${resume}${C.reset}`);

  try {
    const {
      getActiveProviderName: _getActiveProviderName,
      getActiveModelId: _getActiveModelId,
    } = require("./providers/registry");
    const provider = _getActiveProviderName();
    const model = _getActiveModelId();
    const mode =
      typeof getProviderCostMode === "function"
        ? getProviderCostMode(provider).label
        : "cost unknown";
    const costs =
      typeof getSessionCosts === "function" ? getSessionCosts() : null;
    if (provider && model && costs) {
      const costText =
        costs.totalCost > 0 ? `$${costs.totalCost.toFixed(4)}` : "free";
      console.log(
        `${C.dim}  model ${provider}:${model} · ${mode} · ${costs.totalInput.toLocaleString()} in / ${costs.totalOutput.toLocaleString()} out · ${costText}${C.reset}`,
      );
    }
  } catch {
    /* cost visibility is best-effort */
  }

  // Desktop notification for long-running tasks (> 30s)
  if (elapsedSecs >= 30 && process.stdout.isTTY) {
    const summary =
      filesModified.size > 0
        ? `Done — ${filesModified.size} ${filesModified.size === 1 ? "file" : "files"} modified in ${elapsedSecs}s`
        : `Done — ${totalSteps} ${totalSteps === 1 ? "step" : "steps"} in ${elapsedSecs}s`;
    _notifyDesktop(summary);
  }

  // Show auto-completed tasks (file write matched task description)
  if (_autoCompletedTasks.size > 0 && _taskRegistry.size > 0) {
    for (const _tid of _autoCompletedTasks) {
      const _desc = _taskRegistry.get(_tid);
      if (_desc)
        console.log(
          `${C.dim}  ✔ task #${_tid} auto-matched: ${_desc.slice(0, 60)}${C.reset}`,
        );
    }
  }

  // Follow-up suggestions based on what happened
  if (filesModified.size > 0) {
    console.log(`${C.dim}  💡 /diff · /commit · /undo${C.reset}`);
  } else if (
    !suppressHint &&
    filesRead.size >= 5 &&
    filesModified.size === 0 &&
    totalSteps >= 3
  ) {
    // Audit / read-heavy session — prompt for applying fixes
    console.log(
      `${C.dim}  💡 Found issues? Say "fix 1" or "apply all fixes"${C.reset}`,
    );
  } else if (filesRead.size > 0 && totalSteps >= 2) {
    console.log(`${C.dim}  💡 /save · /clear${C.reset}`);
  }
}

/**
 * Interactive recovery prompt shown when stale-stream retries are exhausted.
 * Offers: retry / switch to fast model / switch to reliable model / quit.
 * Returns { action: 'retry' | 'switch' | 'quit', model?: string, provider?: string }
 */
async function _staleRecoveryPrompt() {
  if (!process.stdout.isTTY) return { action: "quit" };

  const providerName = getActiveProviderName();
  const currentModelId = getActiveModelId();
  const fastModel = MODEL_EQUIVALENTS.fast?.[providerName];
  const reliableModel = MODEL_EQUIVALENTS.strong?.[providerName];

  const hasFastAlt = fastModel && fastModel !== currentModelId;
  const hasReliableAlt =
    reliableModel &&
    reliableModel !== currentModelId &&
    reliableModel !== fastModel;

  const options = [];
  options.push({
    key: "r",
    label: `Retry with current model ${C.dim}(${currentModelId})${C.reset}`,
  });
  if (hasFastAlt) {
    options.push({
      key: "f",
      label: `Switch to ${C.bold}${fastModel}${C.reset} ${C.dim}— fast, low latency${C.reset}`,
      model: fastModel,
    });
  }
  if (hasReliableAlt) {
    options.push({
      key: "s",
      label: `Switch to ${C.bold}${reliableModel}${C.reset} ${C.dim}— reliable tool-calling, medium speed${C.reset}`,
      model: reliableModel,
    });
  }
  options.push({ key: "q", label: `${C.dim}Quit${C.reset}` });

  console.log();
  console.log(
    `${C.yellow}  Stream stale — all retries exhausted.${C.reset} What would you like to do?`,
  );
  for (const opt of options) {
    console.log(`  ${C.cyan}[${opt.key}]${C.reset} ${opt.label}`);
  }

  process.stdout.write(`  ${C.yellow}> ${C.reset}`);

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let handled = false;
    const onKey = (key) => {
      if (handled) return;
      handled = true;
      stdin.removeListener("data", onKey);
      stdin.setRawMode(wasRaw || false);
      stdin.pause();

      const a = key.toLowerCase().trim();
      process.stdout.write(`${a}\n`); // echo the chosen key

      // Ctrl+C → quit
      if (key === "\u0003") return resolve({ action: "quit" });

      const match = options.find((o) => o.key === a);
      if (!match || match.key === "q" || (!match.model && match.key !== "r")) {
        resolve({ action: "quit" });
      } else if (match.key === "r") {
        resolve({ action: "retry" });
      } else {
        resolve({
          action: "switch",
          model: match.model,
          provider: providerName,
        });
      }
    };

    stdin.on("data", onKey);
  });
}

function _extractUrlPaths(text) {
  const URL_RE = /https?:\/\/[^\s/]+(\/[^\s?#]+)/g;
  const paths = new Set();
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    const p = m[1].replace(/\/$/, ""); // strip trailing slash
    if (p.length > 1) {
      // Split path segments, filter out short ones
      const segments = p.split("/").filter((s) => s.length > 2);
      segments.forEach((s) => paths.add(s));
    }
  }
  return Array.from(paths);
}

function _extractTechHints(text) {
  const hints = [];
  if (
    text.includes("@click") ||
    text.includes("x-data") ||
    text.includes("v-if") ||
    text.includes("v-model")
  ) {
    hints.push(
      "Snippet contains Vue/Alpine.js directives (e.g., @click, v-model). Do not restrict your search to just .js/.ts/.vue files; also search .html and .py (templates) if appropriate.",
    );
  }
  if (text.includes("className=") || text.includes("useEffect")) {
    hints.push(
      "Snippet appears to be React. Look in .jsx, .tsx, .js, .ts files.",
    );
  }
  return hints;
}

// Module-level server hooks — set by processInput in server mode, null in normal CLI mode.
let _serverHooks = null;

/**
 * Process a single user input through the agentic loop.
 * Maintains conversation state across calls.
 * @param {string} userInput
 * @param {{ onToken?: Function, onThinkingToken?: Function, onToolStart?: Function, onToolEnd?: Function } | null} [serverHooks]
 */
async function processInput(userInput, serverHooks = null, opts = {}) {
  // Resolve per-model guard profile at session start
  const _profile = getModelProfile(getActiveModelId());
  STALE_WARN_MS = _profile.staleWarn;
  STALE_ABORT_MS = _profile.staleAbort;

  _serverHooks = serverHooks;

  // Prepend creation-task context note from the previous turn so the model
  // can answer follow-up questions without re-investigating the codebase.
  let _resolvedInput = userInput;
  if (_lastCreationSummary && typeof userInput === "string") {
    _resolvedInput = `${_lastCreationSummary}\n\n${userInput}`;
    _lastCreationSummary = null; // consume once
  }

  // Inject heuristic hints for URLs and tech stack to guide the model's search
  if (typeof _resolvedInput === "string") {
    const urlPaths = _extractUrlPaths(_resolvedInput);
    const techHints = _extractTechHints(_resolvedInput);
    if (urlPaths.length > 0 || techHints.length > 0) {
      _resolvedInput +=
        "\n\n[System Note for Assistant: To resolve this task faster, consider these hints:\n";
      if (urlPaths.length > 0) {
        _resolvedInput += `- The user mentioned URLs containing the paths/folders: ${urlPaths.join(", ")}. Prioritize searching these folder names using glob or grep first.\n`;
      }
      if (techHints.length > 0) {
        techHints.forEach((h) => {
          _resolvedInput += `- ${h}\n`;
        });
      }
      _resolvedInput += "Always prefer parallel search execution if unsure.]";
    }
  }

  // Inject a soft empathy note when the user appears frustrated so the model
  // acknowledges the difficulty before proceeding with the task.
  if (typeof _resolvedInput === "string" && detectFrustration(_resolvedInput)) {
    _resolvedInput +=
      "\n\n[Note for assistant: the user appears frustrated — acknowledge their concern briefly and empathetically before proceeding]";
  }
  const runtimeDebugTarget =
    typeof userInput === "string" ? detectRuntimeDebugTarget(userInput) : null;
  const directAnswerMode =
    typeof userInput === "string" && _isSimpleDirectAnswerPrompt(userInput);
  let userContent = buildUserContent(_resolvedInput);
  // buildUserContent may return a Promise when remote URLs or clipboard are involved
  if (userContent && typeof userContent.then === "function") {
    userContent = await userContent;
  }
  conversationMessages.push({ role: "user", content: userContent });
  trimConversationHistory();

  // Auto-orchestrate for complex multi-goal prompts (default: on).
  // Disable with NEX_AUTO_ORCHESTRATE=false or --no-auto-orchestrate.
  const autoOrch =
    opts.autoOrchestrate !== false &&
    process.env.NEX_AUTO_ORCHESTRATE !== "false";
  const orchThreshold = parseInt(
    process.env.NEX_ORCHESTRATE_THRESHOLD || "3",
    10,
  );

  try {
    const { detectComplexPrompt, runOrchestrated } = require("./orchestrator");
    const complexity = detectComplexPrompt(
      typeof userInput === "string" ? userInput : "",
    );

    if (
      autoOrch &&
      complexity.isComplex &&
      complexity.estimatedGoals >= orchThreshold
    ) {
      console.log(
        `${C.yellow}⚡ Auto-orchestrate: ${complexity.estimatedGoals} goals → parallel agents${C.reset}`,
      );
      const orchResult = await runOrchestrated(userInput, {
        orchestratorModel:
          opts.orchestratorModel || process.env.NEX_ORCHESTRATOR_MODEL,
        workerModel: opts.model,
      });

      // Persist synthesis into conversationMessages so autosave captures
      // the actual result (benchmark reads _autosave.json for scoring)
      if (orchResult && orchResult.synthesis) {
        const synthText = orchResult.synthesis.summary || "";
        const filesInfo = orchResult.synthesis.filesChanged?.length
          ? `\n\nFiles changed: ${orchResult.synthesis.filesChanged.join(", ")}`
          : "";
        const conflictInfo = orchResult.synthesis.conflicts?.length
          ? `\n\nConflicts:\n${orchResult.synthesis.conflicts.map((c) => `- ${c}`).join("\n")}`
          : "";
        conversationMessages.push({
          role: "assistant",
          content: synthText + filesInfo + conflictInfo,
        });
        saveNow(conversationMessages);
        _scoreAndPrint(conversationMessages);
      }
      return orchResult;
    }

    if (complexity.isComplex && process.stdout.isTTY) {
      console.log(
        `${C.dim}Hint: ~${complexity.estimatedGoals} goals detected. Disable with NEX_AUTO_ORCHESTRATE=false${C.reset}`,
      );
    }
  } catch {
    /* orchestrator not available */
  }

  const { setOnChange } = require("./tasks");
  let taskProgress = null;
  let cumulativeTokens = 0;

  // Wire task onChange to create/update live task display
  setOnChange((event, data) => {
    if (event === "create") {
      if (taskProgress) taskProgress.stop();
      taskProgress = new TaskProgress(data.name, data.tasks);
      taskProgress.setStats({ tokens: cumulativeTokens });
      taskProgress.start();
    } else if (event === "update" && taskProgress) {
      taskProgress.updateTask(data.id, data.status);
    } else if (event === "clear") {
      if (taskProgress) {
        taskProgress.stop();
        taskProgress = null;
      }
    }
  });

  const systemPrompt = await buildSystemPrompt();

  // Append brain context (query-dependent, not part of cached system prompt)
  let effectiveSystemPrompt = systemPrompt;
  try {
    const { getBrainContext } = require("./brain");
    const brainContext = await getBrainContext(userInput);
    if (brainContext) {
      effectiveSystemPrompt = systemPrompt + "\n" + brainContext + "\n";
    }
  } catch (err) {
    /* brain is optional */
    if (process.env.NEX_DEBUG)
      console.error("[agent] brain context failed:", err.message);
  }

  // Trigger-based skill activation: match user message against skill triggers
  const triggerInput = typeof userInput === "string" ? userInput : "";
  const triggered = matchSkillTriggers(triggerInput);
  if (triggered.length > 0) {
    const triggerBlock = triggered
      .map((s) => `[Triggered: ${s.name}]\n${s.instructions}`)
      .join("\n");
    effectiveSystemPrompt += "\n" + triggerBlock + "\n";
  }

  effectiveSystemPrompt += "\n" + _buildTurnLanguagePrompt(userInput);
  if (directAnswerMode) {
    effectiveSystemPrompt +=
      "\n# Current Turn Direct Answer Mode\n" +
      "This request is self-contained. Answer directly with the requested content. " +
      "Do not inspect the workspace, create files, run commands, install packages, or mention internal process unless the user explicitly asked for that.\n";
  }

  const fullMessages = [
    { role: "system", content: effectiveSystemPrompt },
    ...conversationMessages,
  ];

  // Keep spinner model label in sync with whatever model is active right now
  setActiveModelForSpinner(getActiveModelId());

  // Pre-spinner: visible activity during fitToContext + getUsage (can take 50–5000ms with LLM compacting)
  const preSpinner = new Spinner(getThinkingVerb());
  preSpinner.start();

  // Start pre-scan concurrently on the FIRST message of a new conversation.
  // Results fill the "Thinking..." dead time with useful project context.
  const isFirstMessage = conversationMessages.length === 1;
  const preScanPromise = isFirstMessage && !directAnswerMode
    ? _runPreScan().catch(() => null)
    : Promise.resolve(null);
  const urlProbePromise = isFirstMessage
    ? probeUrlServer(typeof userInput === "string" ? userInput : "").catch(
        () => null,
      )
    : Promise.resolve(null);

  // Context-aware compression: fit messages into context window
  const allTools = directAnswerMode ? [] : getAllToolDefinitions();
  const [
    { messages: fittedMessages, compressed, compacted, tokensRemoved },
    preScanResult,
    urlProbeResult,
  ] = await Promise.all([
    fitToContext(fullMessages, allTools),
    preScanPromise,
    urlProbePromise,
  ]);

  // Context budget warning
  const usage = getUsage(fullMessages, allTools);

  preSpinner.stop();

  // Show pre-scan snapshot (first message only, non-empty projects)
  if (preScanResult) {
    console.log(`${C.dim}${preScanResult}${C.reset}`);
  }

  if (compacted) {
    console.log(
      `${C.dim}  [context compacted — summary (~${tokensRemoved} tokens freed)]${C.reset}`,
    );
  } else if (compressed) {
    const pct =
      usage.limit > 0 ? Math.round((tokensRemoved / usage.limit) * 100) : 0;
    debugLog(
      `${C.dim}  [context compressed — ~${tokensRemoved} tokens freed (${pct}%)]${C.reset}`,
    );
  }
  if (usage.percentage > 85) {
    debugLog(
      `${C.yellow}  ⚠ Context ${Math.round(usage.percentage)}% used (${Math.round(100 - usage.percentage)}% remaining) — consider /clear or /save + start fresh${C.reset}`,
    );
  }

  // Use fitted messages for the API call, but keep fullMessages reference for appending
  let apiMessages = fittedMessages;

  // Inject URL-probe server context as first user message (before system/human messages)
  // so the model knows port/service topology before its first response.
  if (urlProbeResult && isFirstMessage) {
    apiMessages = [
      apiMessages[0], // system prompt
      {
        role: "user",
        content: `[Server probe at task start]\n${urlProbeResult}`,
      },
      {
        role: "assistant",
        content:
          "Understood — I have the server context. Proceeding with the task.",
      },
      ...apiMessages.slice(1),
    ];
  }

  if (runtimeDebugTarget && isFirstMessage) {
    const runtimeGuidance = runtimeDebugTarget.shouldPreferSsh
      ? `[Runtime URL detected]\nThe user linked a live app URL (${runtimeDebugTarget.url}) and described broken behavior. Treat this as a runtime/deployed-instance issue first. Reproduce it with browser_open or browser_screenshot on the URL before reading local files. Because this URL matches server profile "${runtimeDebugTarget.matchedName}", prefer ssh_exec/service_logs on that server for investigation before local repo inspection.`
      : `[Runtime URL detected]\nThe user linked a live app URL (${runtimeDebugTarget.url}) and described broken behavior. Treat this as a runtime issue first. Reproduce it with browser_open or browser_screenshot before reading local files. Only inspect the local repo after you have confirmed the live behavior.`;
    apiMessages = [
      apiMessages[0],
      { role: "user", content: runtimeGuidance },
      {
        role: "assistant",
        content: "Understood — I will inspect the live app/runtime first.",
      },
      ...apiMessages.slice(1),
    ];
  }

  // Inject few-shot example: 1 synthetic user/assistant exchange showing correct approach.
  // Category is detected from the user's prompt (sysadmin, coding, frontend, data).
  // Private examples from ~/.nex-code/examples/ take priority over bundled generics.
  // Each example is wrapped with explicit "EXAMPLE START/END" markers so small
  // plan models (e.g. ministral-3:3b) don't mistake the example task for the
  // user's actual request.
  if (isFirstMessage) {
    const fewShot = getFewShotForInput(
      typeof userInput === "string" ? userInput : "",
    );
    if (fewShot) {
      apiMessages = [
        apiMessages[0], // system prompt
        {
          role: "user",
          content:
            "[EXAMPLE — illustrative only, not the real task]\n" + fewShot.user,
        },
        {
          role: "assistant",
          content:
            fewShot.assistant +
            "\n[END EXAMPLE — wait for the real user request below]",
        },
        ...apiMessages.slice(1),
      ];
    }
  }

  // Pre-flight context check — compress immediately if already over threshold
  {
    const _preCtx = getUsage(apiMessages, allTools);
    if (_preCtx.percentage >= 65) {
      const { messages: _compressed, tokensRemoved: _freed } = forceCompress(
        apiMessages,
        allTools,
      );
      if (_freed > 0) {
        apiMessages = _compressed;
        console.log(
          `${C.dim}  [pre-flight compress — ${_freed} tokens freed, now ${Math.round(getUsage(apiMessages, allTools).percentage)}% used]${C.reset}`,
        );
      }
    }
  }

  let rateLimitRetries = 0;
  let networkRetries = 0;
  let staleRetries = 0;
  let contextRetries = 0; // budget for 400-error context-overflow recovery (per inner loop)
  let totalContextRetries = 0; // lifetime cap across all auto-extend cycles
  const MAX_TOTAL_CONTEXT_RETRIES = 9; // 3 retries × 3 auto-extensions max
  let staleCompressUsed = 0; // separate budget for stale-retry compress (doesn't consume contextRetries)
  const _unavailableModels = new Set(); // models that returned 404 — skip on fallback

  // ─── Server-local guard: detect if this task is server debugging ───
  // If the first user message mentions server error keywords, flag so we can
  // intercept local tool calls and redirect to ssh_exec.
  const _firstUserText = (() => {
    const m = conversationMessages.find((r) => r.role === "user");
    return typeof m?.content === "string" ? m.content : "";
  })();
  const _runtimeDebugTarget =
    typeof _firstUserText === "string"
      ? detectRuntimeDebugTarget(_firstUserText)
      : null;
  const _directTaskPaths = _extractDirectTaskPaths(_firstUserText);
  // Only trigger for actual server debugging, not for feature development tasks.
  const _isServerDebugging =
    /set_reminder|google.?auth|cron:|api\.log|swarm.{0,30}(agent|crash|fail)|agent.{0,30}(crashed|crash|fail)|server.{0,30}(error|crash|problem)|on.server/i.test(
      _firstUserText,
    ) || Boolean(_runtimeDebugTarget?.shouldPreferSsh);
  const _isRuntimeUrlDebugging = Boolean(_runtimeDebugTarget);
  let _serverLocalWarnFired = 0; // count firings — reset after each super-nuclear context reset

  // ─── Pre-loop root-cause scan: briefing / initial context ────────────────
  // The user's message may already contain error output from a prior run or
  // a server briefing. Scan it once so fix-phase kicks in from iteration 0.
  if (!_rootCauseDetected) {
    const _allInitial = conversationMessages
      .filter((m) => m.role === "user" || m.role === "tool")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
    const _initCause = detectRootCause(_allInitial);
    if (_initCause) {
      _rootCauseDetected = true;
      _rootCauseSummary = _initCause.slice(0, 120);
      debugLog(
        `${C.yellow}  ⚡ Root cause in briefing: ${_rootCauseSummary} — fix phase active from start (read budget: 3)${C.reset}`,
      );
    }
  }

  // ─── Pre-loop creation-task detection ────────────────────────────────────
  // Build/create tasks have nothing to debug — the agent should start writing
  // files almost immediately. A tight read cap prevents the re-investigation
  // loop where context pressure causes the model to restart from scratch.
  if (!_rootCauseDetected && !_isCreationTask) {
    const _CREATION_RE =
      /\b(create|build|generate|implement|write|make|develop|set\s*up|scaffold|add)\b.{0,80}\b(app|component|page|game|api|backend|frontend|server|service|module|class|function|feature|project|system|bot|script|tool)\b/i;
    if (_CREATION_RE.test(_firstUserText)) {
      _isCreationTask = true;
      debugLog(
        `${C.cyan}  ⚡ Creation task detected — tight investigation cap (4 pre-edit, 2 post-edit)${C.reset}`,
      );
    }
  }

  // ─── Phase-based routing initialization ──────────────────────────────────
  // Skip phase routing when opts.skipPhaseRouting is set (skill command prompts
  // like /autoresearch need immediate tool access, not a plan phase)
  if (
    conversationMessages.length <= 1 &&
    !opts.skipPhaseRouting &&
    !_isConversationalPrompt(_firstUserText)
  ) {
    _phaseEnabled = isPhaseRoutingEnabled();
    if (_phaseEnabled) {
      const _cat = detectCategory(_firstUserText);
      _detectedCategoryId = _cat?.id || "coding";
      const _skipPlanForDirectCreation =
        _shouldSkipPlanPhaseForDirectCreation(_firstUserText);
      _currentPhase = _skipPlanForDirectCreation ? "implement" : "plan";
      _phaseModelOverride = getModelForPhase(
        _currentPhase,
        _detectedCategoryId,
      );
      _phaseIterations = 0;
      _verifyLoopBack = 0;
      _planPhaseBlockedCount = 0;
      _lastPlanBlockedTool = null;
      _freshlyWrittenFiles.clear();
      if (process.stdout.isTTY) {
        console.log(
          _skipPlanForDirectCreation
            ? `${C.dim}  ↳ Phase routing: implement(${_phaseModelOverride || "default"}) → verify ${C.yellow}[plan skipped: direct file task]${C.reset}`
            : `${C.dim}  ↳ Phase routing: plan(${_phaseModelOverride || "default"}) → implement → verify${C.reset}`,
        );
      }
      debugLog(
        _skipPlanForDirectCreation
          ? `${C.cyan}  ⚡ Phase routing enabled — skipping plan phase for direct file task, starting in implement with ${_phaseModelOverride || "default model"} (category: ${_detectedCategoryId})${C.reset}`
          : `${C.cyan}  ⚡ Phase routing enabled — plan phase with ${_phaseModelOverride || "default model"} (category: ${_detectedCategoryId})${C.reset}`,
      );
      if (_skipPlanForDirectCreation && _directTaskPaths.length > 0) {
        const _targetList = _directTaskPaths.slice(0, 3).join(", ");
        const _directTaskGuardrail = {
          role: "user",
          content:
            `[SYSTEM] This is a direct file task targeting: ${_targetList}. ` +
            `Modify only the explicitly requested file(s) unless the user asks for more. ` +
            `Do NOT create extra helper or test files for verification. ` +
            `Prefer inline verification with bash or by reading the edited file.`,
        };
        conversationMessages.push(_directTaskGuardrail);
        apiMessages.push(_directTaskGuardrail);
      }
    }
  }

  // ─── Stats tracking for résumé ───
  let totalSteps = 0;
  const toolCounts = new Map();
  const filesModified = new Set();
  const filesRead = new Set();
  const verificationCommandsRun = [];
  const verificationReadsRun = [];
  const _editedFilesNotReread = new Set(); // files edited but not re-read — block second edit until re-read
  let _readOnlyToolStreak = 0; // consecutive read-only tool iterations (no file writes)
  let _filesModifiedAtStreakStart = 0; // snapshot of filesModified.size when streak begins
  let _consecutiveEmptySearches = 0; // consecutive grep/search/glob calls that returned no results
  let _bashModifiedFiles = 0; // successful bash/ssh_exec commands that likely wrote files
  const startTime = Date.now();
  const _milestone = new MilestoneTracker(MILESTONE_N);
  const _hasPostEditVerificationEvidence = () =>
    verificationCommandsRun.length > 0 || verificationReadsRun.length > 0;
  // Loop detection: use session-level Maps so counters persist across REPL turns.
  // If they were declared locally here they would reset on every processInput() call,
  // allowing the agent to bypass abort thresholds by running N-1 bad calls per turn.
  const fileEditCounts = _sessionFileEditCounts;
  // Skill loops (autoresearch) intentionally repeat tools — relax all thresholds 10x
  const _sk = opts.skillLoop ? 10 : 1;
  const LOOP_WARN_EDITS = 3 * _sk;
  const LOOP_ABORT_EDITS = 5 * _sk;
  const bashCmdCounts = _sessionBashCmdCounts;
  const LOOP_WARN_BASH = 5 * _sk;
  const LOOP_ABORT_BASH = 8 * _sk;
  const grepPatternCounts = _sessionGrepPatternCounts;
  const LOOP_WARN_GREP = (_phaseEnabled ? 6 : 4) * _sk;
  const LOOP_ABORT_GREP = (_phaseEnabled ? 10 : 7) * _sk;
  const grepFileCounts = _sessionGrepFileCounts;
  const LOOP_WARN_GREP_FILE = (_phaseEnabled ? 5 : 3) * _sk;
  const LOOP_ABORT_GREP_FILE = (_phaseEnabled ? 8 : 5) * _sk;
  const globSearchCounts = _sessionGlobSearchCounts;
  const LOOP_WARN_GLOB = (_phaseEnabled ? 4 : 3) * _sk;
  const LOOP_ABORT_GLOB = (_phaseEnabled ? 6 : 4) * _sk;
  const GLOB_CORE_WARN = 3 * _sk;
  const GLOB_CORE_BLOCK = 4 * _sk;
  const fileReadCounts = _sessionFileReadCounts;
  const LOOP_WARN_READS = (_phaseEnabled ? 6 : 4) * _sk;
  const LOOP_ABORT_READS = (_phaseEnabled ? 10 : 8) * _sk;
  const TARGETED_READ_HARD_CAP = (_phaseEnabled ? 12 : 10) * _sk;
  const NARROW_READ_PASS_THROUGH = 25;
  let consecutiveErrors = 0;
  const LOOP_WARN_ERRORS = 10 * _sk;
  const LOOP_ABORT_ERRORS = 15 * _sk;
  let consecutiveBlocks = 0;
  const LOOP_ABORT_BLOCKS = 5 * _sk;
  let truncatedSwarmCount = 0;
  const LOOP_WARN_SWARM = 2 * _sk;
  const LOOP_ABORT_SWARM = 3; // abort after 3 all-truncated swarm calls in a row
  let contextPressureWarnedAt = 0; // last context % at which we injected a pressure warning
  const SSH_STORM_WARN = 10; // warn after 10 consecutive ssh_exec calls
  const SSH_STORM_ABORT = 16; // hard abort after 16 consecutive ssh_exec calls
  const INVESTIGATION_CAP = opts.skillLoop ? 999 : _profile.investigationCap;

  // ─── Background job drain helper (closure over conversationMessages/apiMessages) ─
  // Called from every exit point of processInput so results are never lost.
  const _awaitAndDrainBackgroundJobs = async () => {
    const {
      hasPendingOrCompletedJobs,
      getPendingJobSummary,
    } = require("./background-jobs");
    if (!hasPendingOrCompletedJobs()) return;
    if (getPendingJobSummary()) {
      const _bgEnd = Date.now() + 45000;
      process.stderr.write(
        `${C.cyan}  ⏳ Waiting for background agents to finish…${C.reset}\n`,
      );
      while (getPendingJobSummary() && Date.now() < _bgEnd) {
        await new Promise((r) => setTimeout(r, 500).unref());
        _drainCompletedBackgroundJobs(conversationMessages, apiMessages);
      }
    }
    _drainCompletedBackgroundJobs(conversationMessages, apiMessages);
    if (conversationMessages.length > 0) saveNow(conversationMessages);
  };

  // ─── Detect analysis-only prompts ──────────────────────────────────────────
  // For pure analysis/explanation tasks the model should produce ONE substantive
  // text response and stop. Without a hard cap, big models (qwen3-vl, deepseek)
  // tend to loop: re-list directories, re-read files, re-summarize. Detect and
  // limit aggressively. Implementation tasks ("fix", "add", "create", etc.) are
  // unaffected.
  const _rawUserText = typeof userInput === "string" ? userInput.trim() : "";
  const _isAnalysisOnlyPrompt =
    _rawUserText.length > 0 &&
    /^\s*(analyze|analyse|explain|describe|review|audit|summari[sz]e|list|understand|document|documentation|docs|what is|what does|how does|show me|show the|show all|tell me about)/i.test(
      _rawUserText,
    ) &&
    !/\b(fix|bug|crash|error|implement|add|create|change|update|refactor|rewrite|broken|fail|patch|migrate|port|build|edit|write|delete|remove|install|setup|deploy|run)\b/i.test(
      _rawUserText,
    );
  const _isSynthesisHeavyPrompt =
    _rawUserText.length > 0 &&
    /\b(analyze|analyse|explain|describe|review|audit|summari[sz]e|understand|document|scan|count|inventory|map|list|identify)\b/i.test(
      _rawUserText,
    ) &&
    /\b(create|write|generate|produce|output)\b/i.test(_rawUserText) &&
    /\b([A-Z0-9_-]+\.md|markdown|report|summary|overview|architecture|audit|table|documentation|docs|inventory|catalog)\b/i.test(
      _rawUserText,
    ) &&
    !/\b(fix|bug|crash|error|implement|add(?!\s+(?:to|into)\b)|change|update|refactor|rewrite|broken|fail|patch|migrate|port|build|delete|remove|install|setup|deploy|run)\b/i.test(
      _rawUserText,
    );

  let i;
  let iterLimit =
    opts.maxIterations ||
    (_phaseEnabled ? getPhaseBudget(_currentPhase) : MAX_ITERATIONS);
  if (_isAnalysisOnlyPrompt) {
    // Analysis: max 4 iterations — 1 to read context, 1 for analysis, 2 buffer
    iterLimit = Math.min(iterLimit, 4);
    debugLog(
      `${C.dim}  ↳ Analysis-only prompt detected — iter cap=${iterLimit}${C.reset}`,
    );
  }
  let autoExtensions = 0;
  const MAX_AUTO_EXTENSIONS = 3; // hard cap: max 3×20 = 60 extra turns (50+60=110 total)
  let progressMadeThisPass = false; // progress gate for auto-extend
  let _skillLoopNudges = 0; // cap continuation nudges to prevent infinite nudge loops
  let _synthesisEvidenceReady = false; // enough evidence gathered to finalize a text deliverable
  // eslint-disable-next-line no-constant-condition
  outer: while (true) {
    progressMadeThisPass = false;
    for (i = 0; i < iterLimit; i++) {
      // Check if aborted (Ctrl+C) at start of each iteration
      const loopSignal = _getAbortSignal();
      if (loopSignal?.aborted) break;

      // ─── Background agent results: drain completed jobs before LLM call ──────
      _drainCompletedBackgroundJobs(conversationMessages, apiMessages);

      // ─── Proactive auto-compress before LLM call ─────────────────────────────
      // Compress proactively to avoid 400 errors. Use a lower threshold on the first
      // call (65%) because token estimation is imprecise and models may have a lower
      // actual context limit than configured. After the first call, use 78%.
      {
        const _allTools = getAllToolDefinitions();
        const _autoCtx = getUsage(apiMessages, _allTools);
        const _threshold = totalSteps === 0 ? 65 : 78;
        if (_autoCtx.percentage >= _threshold) {
          // Inject a fresh progress snapshot before compression so the model
          // retains its place after old messages are dropped. The snapshot is
          // pinned (_pinned:true) and will survive Phase 4 relevance removal.
          // Always refresh the snapshot so it reflects the latest state.
          if (
            filesModified.size > 0 ||
            (_phaseEnabled && _currentPhase !== "plan")
          ) {
            const _snap = buildProgressSnapshot(conversationMessages, {
              filesModified,
              currentPhase: _phaseEnabled ? _currentPhase : null,
            });
            if (_snap) {
              // Replace any existing snapshot, then insert after system message
              const _existingIdx = apiMessages.findIndex(
                (m) => m._progressSnapshot,
              );
              if (_existingIdx !== -1) {
                apiMessages.splice(_existingIdx, 1);
              }
              const _sysIdx = apiMessages.findIndex((m) => m.role === "system");
              apiMessages.splice(_sysIdx + 1, 0, _snap);
            }
          }

          const { messages: _compressed, tokensRemoved: _freed } =
            forceCompress(apiMessages, _allTools, totalSteps === 0);
          if (_freed > 0) {
            apiMessages = _compressed;
            if (_freed > 50)
              console.log(
                `${C.dim}  [auto-compressed — ~${_freed} tokens freed, now ${Math.round(getUsage(apiMessages, _allTools).percentage)}%]${C.reset}`,
              );
            // ── Post-compress state anchor for creation tasks ─────────────────
            // After compression the model may lose track of what was already
            // built and restart from scratch. Inject a compact progress note so
            // it continues rather than re-investigating.
            if (_isCreationTask && filesModified.size >= 3) {
              const _doneFiles = [...filesModified]
                .map((f) => f.split("/").pop())
                .slice(0, 10)
                .join(", ");
              const _anchor = {
                role: "user",
                content:
                  `[FRAMEWORK — context compressed] Task is IN PROGRESS. Already created ${filesModified.size} files: ${_doneFiles}. ` +
                  `DO NOT restart or re-investigate what was already done. Continue from where you left off.`,
              };
              apiMessages.push(_anchor);
            }
          }
        }
      }

      // ─── Pre-call SSH-blocked nudge ──────────────────────────────────────────
      // When SSH is blocked after a storm and no root cause has been found,
      // inject a system message BEFORE the LLM generates its response so it
      // synthesizes findings before continuing. SSH will be unblocked after
      // the model produces a text-only response (synthesis).
      // Fire at most 2 times per storm block to prevent context flooding while
      // still reinforcing the message if the model ignores the first nudge.
      if (
        _sshBlockedAfterStorm &&
        !_rootCauseDetected &&
        _sshBlockedPreCallNudgeCount < 2
      ) {
        _sshBlockedPreCallNudgeCount++;
        const sshBlockedNudge = {
          role: "user",
          content:
            "[SYSTEM] SSH paused — you have made many consecutive SSH calls. Synthesize your findings so far: summarize what you learned and what the likely issue is. After your synthesis, SSH will be available again for targeted follow-up commands.",
        };
        apiMessages.push(sshBlockedNudge);
        conversationMessages.push(sshBlockedNudge);
        debugLog(
          `${C.yellow}  ⚠ Pre-call SSH-blocked nudge #${_sshBlockedPreCallNudgeCount} injected — model told to synthesize${C.reset}`,
        );
      }
      // Reset the nudge counter when SSH becomes available again so future storms
      // can fire the nudge again.
      if (!_sshBlockedAfterStorm) {
        _sshBlockedPreCallNudgeCount = 0;
      }

      // Step indicator — deferred, only shown for tool iterations (matches résumé count)
      let stepPrinted = true; // default: no marker (text-only iterations stay silent)

      // Advance plan step cursor when a new tool iteration starts
      if (totalSteps > 0) advancePlanStep();

      let spinner = null;
      if (taskProgress && taskProgress.isActive()) {
        // Resume the live task display instead of a plain spinner
        if (taskProgress._paused) taskProgress.resume();
      } else if (!taskProgress) {
        let spinnerText;
        const planInfo = getPlanStepInfo();
        if (planInfo && planInfo.total > 1) {
          const label =
            planInfo.description.length > 40
              ? planInfo.description.slice(0, 37) + "…"
              : planInfo.description;
          spinnerText = `Plan step ${planInfo.current}/${planInfo.total}: ${label}`;
        } else {
          spinnerText =
            totalSteps > 0
              ? `${getThinkingVerb()} (step ${totalSteps + 1})`
              : getThinkingVerb();
        }
        const { getPendingJobSummary } = require("./background-jobs");
        const _bgSummary = getPendingJobSummary();
        if (_bgSummary) spinnerText += `  [${_bgSummary}]`;
        spinner = new Spinner(spinnerText);
        spinner.start();
      }
      let firstToken = true;
      let streamedText = "";
      let _streamLoopSuppressed = false; // suppress display once loop detected mid-stream
      const stream = new StreamRenderer();

      let result;
      // Stale-stream detection: warn/abort if provider stops sending tokens
      let lastTokenTime = Date.now();
      let staleWarned = false;
      const staleAbort = new AbortController();
      const staleTimer = setInterval(() => {
        const elapsed = Date.now() - lastTokenTime;
        if (elapsed >= STALE_ABORT_MS) {
          stream._clearCursorLine();
          debugLog(
            `${C.yellow}  ⚠ Stream stale for ${Math.round(elapsed / 1000)}s — aborting and retrying${C.reset}`,
          );
          staleAbort.abort();
        } else if (elapsed >= STALE_WARN_MS && !staleWarned) {
          staleWarned = true;
          stream._clearCursorLine();
          const fastModel = MODEL_EQUIVALENTS.fast?.[getActiveProviderName()];
          const retryLabel =
            staleRetries > 0
              ? ` (retry ${staleRetries + 1}/${MAX_STALE_RETRIES})`
              : "";
          const abortInSec = Math.round((STALE_ABORT_MS - elapsed) / 1000);
          debugLog(
            `${C.yellow}  ⚠ No tokens received for ${Math.round(elapsed / 1000)}s — waiting...${retryLabel}${C.reset}`,
          );
          if (fastModel && fastModel !== getActiveModelId()) {
            console.log(
              `${C.dim}  💡 Will auto-switch to ${fastModel} in ~${abortInSec}s if no tokens arrive${C.reset}`,
            );
          } else {
            console.log(
              `${C.dim}  💡 Ctrl+C to abort · auto-abort in ~${abortInSec}s${C.reset}`,
            );
          }
        }
      }, 5000);
      staleTimer.unref?.();

      // Token batching for streaming optimization
      let tokenBuffer = "";
      let flushTimeout = null;

      try {
        const baseTools = directAnswerMode
          ? []
          : getCachedFilteredTools(getAllToolDefinitions());
        const PHASE_PLAN_TOOLS = new Set([
          "read_file",
          "list_directory",
          "search_files",
          "glob",
          "grep",
          "git_status",
          "git_diff",
          "git_log",
          "git_show",
          "ssh_exec",
        ]);
        const PHASE_VERIFY_TOOLS = new Set([
          "read_file",
          "list_directory",
          "glob",
          "grep",
          "bash",
          "git_status",
          "git_diff",
          "git_log",
          "ssh_exec",
        ]);
        let allTools;
        if (isPlanMode()) {
          allTools = baseTools.filter((t) =>
            PLAN_MODE_ALLOWED_TOOLS.has(t.function.name),
          );
        } else if (_phaseEnabled && _currentPhase === "plan") {
          allTools = baseTools.filter((t) =>
            PHASE_PLAN_TOOLS.has(t.function.name),
          );
        } else if (_phaseEnabled && _currentPhase === "verify") {
          allTools = baseTools.filter((t) =>
            PHASE_VERIFY_TOOLS.has(t.function.name),
          );
        } else {
          allTools = baseTools;
        }
        const userSignal = _getAbortSignal();
        // Combine user abort (Ctrl+C) and stale abort into one signal
        const combinedAbort = new AbortController();
        if (userSignal)
          userSignal.addEventListener("abort", () => combinedAbort.abort(), {
            once: true,
          });
        staleAbort.signal.addEventListener(
          "abort",
          () => combinedAbort.abort(),
          { once: true },
        );

        result = await callStream(apiMessages, allTools, {
          signal: combinedAbort.signal,
          ...(_phaseModelOverride ? { model: _phaseModelOverride } : {}),
          onThinkingToken: () => {
            // Thinking-model reasoning tokens: reset stale timer but don't display
            lastTokenTime = Date.now();
            staleWarned = false;
            if (_serverHooks?.onThinkingToken) {
              _serverHooks.onThinkingToken();
            }
          },
          onToken: (text) => {
            lastTokenTime = Date.now();
            staleWarned = false;

            // In server mode: forward token to hook, skip all TTY handling
            if (_serverHooks?.onToken) {
              _serverHooks.onToken(text);
              streamedText += text;
              return;
            }

            // Mid-stream loop detection: suppress display once repetition is detected.
            // The post-stream detectAndTruncateLoop will truncate before storing to history.
            streamedText += text;
            if (
              !_streamLoopSuppressed &&
              streamedText.length > 400 &&
              streamedText.length % 250 < text.length + 1
            ) {
              const q = detectAndTruncateLoop(streamedText, 3);
              if (q.truncated) {
                _streamLoopSuppressed = true;
                stream._clearCursorLine?.();
                debugLog(
                  `${C.yellow}  ⚠ LLM stream loop detected (${q.repeatCount}× repeated) — suppressing display${C.reset}`,
                );
              }
            }
            if (_streamLoopSuppressed) return;

            // In non-TTY (headless) mode: flush immediately — no buffering needed
            // In TTY mode: batch tokens for 100ms to reduce cursor flicker
            tokenBuffer += text;

            if (process.stdout.isTTY) {
              if (!flushTimeout) {
                flushTimeout = setTimeout(() => {
                  if (tokenBuffer && stream) {
                    stream.push(tokenBuffer);
                  }
                  tokenBuffer = "";
                  flushTimeout = null;
                }, 50);
                flushTimeout.unref?.();
              }
            } else {
              stream.push(tokenBuffer);
              tokenBuffer = "";
            }

            if (firstToken) {
              if (taskProgress && !taskProgress._paused) {
                taskProgress.pause();
              } else if (spinner) {
                spinner.stop();
              }
              if (!stepPrinted) {
                stepPrinted = true;
              }
              stream.startCursor();
              firstToken = false;
            }
          },
        });
      } catch (err) {
        clearInterval(staleTimer);
        if (flushTimeout) {
          clearTimeout(flushTimeout);
          flushTimeout = null;
        }
        if (tokenBuffer && stream) {
          stream.push(tokenBuffer);
          tokenBuffer = "";
        }
        if (taskProgress && !taskProgress._paused) taskProgress.pause();
        if (spinner) spinner.stop();
        stream.stopCursor();

        // Stale abort → progressive retry: 1st=resend, 2nd=compress+resend, exhausted=last-resort compress
        if (staleAbort.signal.aborted && !_getAbortSignal()?.aborted) {
          staleRetries++;
          if (staleRetries > MAX_STALE_RETRIES) {
            // Last-resort: force-compress once, then reset for fresh attempts
            if (contextRetries < 1) {
              contextRetries++;
              _logCompression(
                "Stale retries exhausted — last-resort force-compress...",
                C.yellow,
              );
              const allTools = getAllToolDefinitions();
              const { messages: compressedMsgs, tokensRemoved } = forceCompress(
                apiMessages,
                allTools,
              );
              apiMessages = compressedMsgs;
              if (tokensRemoved > 50)
                debugLog(
                  `${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`,
                );
              staleRetries = 0; // Reset so compressed context gets full retry attempts
              i--;
              continue;
            }
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            const recovery = await _staleRecoveryPrompt();
            if (recovery.action === "quit") {
              setOnChange(null);
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
              );
              saveNow(conversationMessages);
              break;
            }
            if (recovery.action === "switch") {
              setActiveModel(`${recovery.provider}:${recovery.model}`);
              console.log(
                `${C.green}  ✓ Switched to ${recovery.provider}:${recovery.model}${C.reset}`,
              );
            }
            // 'retry' or 'switch': reset counters and retry
            // NOTE: do NOT reset contextRetries here — the stale-retry and 400-error
            // budgets are independent. Resetting contextRetries here would allow the
            // 400-compress path to loop indefinitely after a stale recovery.
            staleRetries = 0;
            i--;
            continue;
          }
          // Progressive delay: 3s on first retry, 5s on subsequent
          const delay = staleRetries === 1 ? 3000 : 5000;
          // Auto-switch to fast model on first stale retry (don't waste another 120s on the same model)
          // Uses staleCompressUsed (not contextRetries) so 400-error recovery budget stays intact.
          // Nuclear compression on stale switch: context is already large enough to cause a timeout,
          // so aggressively trim to 35% to give the (possibly smaller) fast model headroom.
          if (staleRetries >= 1 && staleCompressUsed < 1) {
            staleCompressUsed++;
            _logCompression(
              `Stale retry ${staleRetries}/${MAX_STALE_RETRIES} — force-compressing before retry...`,
              C.yellow,
            );
            const allTools = getAllToolDefinitions();
            const { messages: compressedMsgs, tokensRemoved } = forceCompress(
              apiMessages,
              allTools,
              true,
            ); // nuclear: 35% target
            apiMessages = compressedMsgs;
            if (tokensRemoved > 0) {
              if (tokensRemoved > 50)
                debugLog(
                  `${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`,
                );
            }
            if (STALE_AUTO_SWITCH) {
              const fastModel =
                MODEL_EQUIVALENTS.fast?.[getActiveProviderName()];
              if (fastModel && fastModel !== getActiveModelId()) {
                setActiveModel(`${getActiveProviderName()}:${fastModel}`);
                console.log(
                  `${C.cyan}  ⚡ Auto-switched to ${fastModel} to avoid further stale timeouts${C.reset}`,
                );
                console.log(
                  `${C.dim}  (disable with NEX_STALE_AUTO_SWITCH=0)${C.reset}`,
                );
              }
            }
          } else {
            debugLog(
              `${C.yellow}  ⚠ Stale retry ${staleRetries}/${MAX_STALE_RETRIES} — retrying in ${delay / 1000}s...${C.reset}`,
            );
          }
          const delaySpinner = new Spinner(
            `Waiting ${delay / 1000}s before retry...`,
          );
          delaySpinner.start();
          await new Promise((r) => setTimeout(r, delay));
          delaySpinner.stop();
          i--; // Don't count stale timeouts as iterations
          continue;
        }

        // Abort errors (Ctrl+C) — break silently
        if (
          err.name === "AbortError" ||
          err.name === "CanceledError" ||
          err.message?.includes("canceled") ||
          err.message?.includes("aborted")
        ) {
          if (taskProgress) {
            taskProgress.stop();
            taskProgress = null;
          }
          setOnChange(null);
          _printResume(
            totalSteps,
            toolCounts,
            filesModified,
            filesRead,
            startTime,
          );
          saveNow(conversationMessages);
          break;
        }

        // User-friendly error message (avoid raw stack traces/cryptic codes)
        let userMessage = err.message;
        if (
          err.code === "ECONNREFUSED" ||
          err.message.includes("ECONNREFUSED")
        ) {
          userMessage =
            "Connection refused — please check your internet connection or API endpoint";
        } else if (
          err.code === "ENOTFOUND" ||
          err.message.includes("ENOTFOUND")
        ) {
          userMessage =
            "Network error — could not reach the API server. Please check your connection";
        } else if (
          err.code === "ETIMEDOUT" ||
          err.message.includes("timeout")
        ) {
          userMessage =
            "Request timed out — the API server took too long to respond. Please try again";
        } else if (
          err.message.includes("401") ||
          err.message.includes("Unauthorized")
        ) {
          userMessage =
            "Authentication failed — please check your API key in the .env file";
        } else if (
          err.message.includes("403") ||
          err.message.includes("Forbidden")
        ) {
          userMessage =
            "Access denied — your API key may not have permission for this model";
        } else if (err.message.includes("404")) {
          // 404 = model not found — walk a fallback chain before giving up.
          // Chain: NEX_FALLBACK_MODEL → all unique models in routing config (agentic first).
          const unavailableModel = getActiveModelId
            ? getActiveModelId()
            : "unknown";
          // Track by model ID only (strip optional provider prefix for dedup)
          const _modelIdOnly = (spec) =>
            spec.includes(":") &&
            spec.split(":")[0].match(/^[a-z]+$/) &&
            !spec.split(":")[1].includes(":")
              ? spec.split(":").slice(1).join(":")
              : spec;
          _unavailableModels.add(_modelIdOnly(unavailableModel));
          const _getFallbackChain = () => {
            const chain = [];
            if (process.env.NEX_FALLBACK_MODEL)
              chain.push(process.env.NEX_FALLBACK_MODEL);
            try {
              const { getModelForCategory } = require("./task-router");
              const categories = [
                "agentic",
                "coding",
                "plan",
                "verify",
                "sysadmin",
                "data",
                "frontend",
              ];
              for (const cat of categories) {
                const m = getModelForCategory(cat);
                if (m && !chain.includes(m)) chain.push(m);
              }
            } catch {
              /* ignore */
            }
            // Filter out unavailable models (compare by model ID part only)
            return chain.filter(
              (m) => !_unavailableModels.has(_modelIdOnly(m)),
            );
          };
          const _nextModelSpec = _getFallbackChain()[0]; // already has provider:model format from routing config
          if (_nextModelSpec) {
            console.log(
              `${C.yellow}  ⚠ Model ${unavailableModel} unavailable (404) — switching to ${_nextModelSpec}${C.reset}`,
            );
            setActiveModel(_nextModelSpec);
            setActiveModelForSpinner(_nextModelSpec);
            i--; // retry this iteration with the new model
            continue;
          }
          // Exhausted all fallbacks — stop with a clear message
          userMessage = `Model not found (404): ${unavailableModel} — no fallback available. Set NEX_FALLBACK_MODEL or run /models to list available models`;
          console.log(`${C.red}  ✗ ${userMessage}${C.reset}`);
          if (taskProgress) {
            taskProgress.stop();
            taskProgress = null;
          }
          setOnChange(null);
          _printResume(
            totalSteps,
            toolCounts,
            filesModified,
            filesRead,
            startTime,
          );
          saveNow(conversationMessages);
          break;
        } else if (err.message.includes("400")) {
          // On any 400, always try force-compress first — the most common cause is a context
          // overflow where Ollama returns a bare 400 with no useful message. Token-count
          // heuristics are too unreliable to gate this: just try and retry.
          // If a stale switch already happened (staleCompressUsed > 0), we already did nuclear
          // compression — jump straight to nuclear for 400s too to avoid wasting light attempts.
          if (
            contextRetries < 3 &&
            totalContextRetries < MAX_TOTAL_CONTEXT_RETRIES
          ) {
            contextRetries++;
            totalContextRetries++;
            // On the very first call (no tool steps yet), skip gentle compression — there are
            // no old messages to trim. Go straight to nuclear to avoid 3 noisy failed attempts.
            const isFirstCall = totalSteps === 0 && contextRetries === 1;
            const nuclear =
              isFirstCall || contextRetries === 3 || staleCompressUsed > 0;
            if (isFirstCall) {
              // First-call 400: system prompt too large for model. Skip to attempt 3.
              contextRetries = 3;
              const _errDetail = err.message
                .replace(/^API Error(\s*\[HTTP \d+\])?:\s*/i, "")
                .slice(0, 150);
              _logCompression(
                `Bad request (400) — ${_errDetail || "system prompt too large"}, compressing...`,
                C.yellow,
              );
            } else if (nuclear) {
              _logCompression(
                `Bad request (400) — nuclear compression (attempt ${contextRetries}/3, dropping history)...`,
                C.yellow,
              );
            } else {
              _logCompression(
                `Bad request (400) — force-compressing and retrying... (attempt ${contextRetries}/3)`,
                C.yellow,
              );
            }
            const allTools = getAllToolDefinitions();
            const { messages: compressedMsgs, tokensRemoved } = forceCompress(
              apiMessages,
              allTools,
              nuclear,
            );
            apiMessages = compressedMsgs;
            if (tokensRemoved > 50) {
              debugLog(
                `${C.dim}  [force-compressed — ~${tokensRemoved} tokens freed]${C.reset}`,
              );
            }
            i--;
            continue;
          }
          // All compress retries exhausted — last resort: keep only system + first task message.
          // This is more aggressive than nuclear (which keeps ~35% of context) — it drops
          // everything except the origin user message so the agent can at least continue.
          {
            const _sys = apiMessages.find((m) => m.role === "system");
            const _firstTask = apiMessages.find(
              (m) =>
                m.role === "user" &&
                !String(m.content).startsWith("[SYSTEM") &&
                !String(m.content).startsWith("BLOCKED:"),
            );
            const _superNuclear = [_sys, _firstTask].filter(Boolean);
            const { getUsage: _gu } = require("./context-engine");
            const _afterTokens =
              require("./context-engine").estimateMessagesTokens(_superNuclear);
            const _beforeTokens =
              require("./context-engine").estimateMessagesTokens(apiMessages);
            if (_afterTokens < _beforeTokens) {
              // Extract investigation findings before wiping history so the agent
              // can continue implementing fixes instead of re-investigating from scratch.
              const _findingParts = [];
              // Last 5 assistant messages with actual text content (skip pure tool-call turns)
              const _assistantTexts = conversationMessages
                .filter(
                  (m) =>
                    m.role === "assistant" &&
                    typeof m.content === "string" &&
                    m.content.trim().length > 30,
                )
                .slice(-5)
                .map((m) =>
                  m.content.trim().slice(0, 300).replace(/\n+/g, " "),
                );
              if (_assistantTexts.length > 0) {
                _findingParts.push(
                  "Key findings:\n" +
                    _assistantTexts.map((t) => `- ${t}`).join("\n"),
                );
              }
              // Last 5 tool result messages with meaningful output (skip BLOCKED: messages)
              const _toolResults = conversationMessages
                .filter(
                  (m) =>
                    m.role === "tool" &&
                    typeof m.content === "string" &&
                    !m.content.startsWith("BLOCKED:") &&
                    m.content.trim().length > 10,
                )
                .slice(-5)
                .map((m) =>
                  m.content
                    .trim()
                    .split("\n")
                    .slice(0, 8)
                    .join("\n")
                    .slice(0, 500),
                );
              if (_toolResults.length > 0) {
                _findingParts.push(
                  "Tool results summary:\n" +
                    _toolResults.map((t) => `- ${t}`).join("\n"),
                );
              }
              // Prepend already-modified files so LLM knows what it already did
              if (filesModified.size > 0) {
                const _modifiedList = [...filesModified]
                  .map((f) => f.split("/").slice(-2).join("/"))
                  .join(", ");
                _findingParts.unshift(
                  `Already modified: ${_modifiedList} — use edit_file to add missing pieces only, DO NOT use write_file on these files.`,
                );
              }
              // Include files already read so the model knows what it investigated
              if (filesRead.size > 0) {
                const _readList = [...filesRead]
                  .map((f) => f.split("/").slice(-2).join("/"))
                  .join(", ");
                _findingParts.push(`Files already investigated: ${_readList}`);
              }
              // Write structured checkpoint so the agent can read precise state
              // after the wipe instead of re-investigating from scratch.
              const _checkpointPath =
                require("os").tmpdir() + "/nex-session-checkpoint.json";
              try {
                require("fs").writeFileSync(
                  _checkpointPath,
                  JSON.stringify(
                    {
                      filesWritten: [...filesModified].map((f) =>
                        f.split("/").slice(-2).join("/"),
                      ),
                      filesRead: [...filesRead].map((f) =>
                        f.split("/").slice(-2).join("/"),
                      ),
                      isCreationTask: _isCreationTask,
                      wipeNumber: _superNuclearFires + 1,
                      timestamp: Date.now(),
                    },
                    null,
                    2,
                  ),
                );
                _findingParts.push(
                  `Session checkpoint: ${_checkpointPath} — read it for exact file list`,
                );
              } catch (_e) {
                /* non-fatal */
              }

              // Build structured pending-work manifest: what's done vs. what's left.
              // Extract file paths mentioned in the original task that haven't been
              // modified yet — gives the post-wipe model an unambiguous "next file" list.
              let _pendingFileCount = 0;
              {
                const _originalTaskText =
                  typeof _firstTask?.content === "string"
                    ? _firstTask.content
                    : Array.isArray(_firstTask?.content)
                      ? _firstTask.content
                          .filter((b) => b.type === "text")
                          .map((b) => b.text)
                          .join(" ")
                      : "";
                const _mentionedPaths = (
                  _originalTaskText.match(
                    /(?:^|\s)([\w./\-]+\.(?:js|ts|jsx|tsx|py|json|yml|yaml|sh|css|scss|html|md|go|rs|java|rb|php))/gm,
                  ) || []
                )
                  .map((m) => m.trim())
                  .filter(Boolean);
                const _completedPaths = [...filesModified];
                const _pendingPaths = _mentionedPaths.filter(
                  (p) =>
                    !_completedPaths.some(
                      (c) => c.endsWith(p) || p.endsWith(c.split("/").pop()),
                    ),
                );
                _pendingFileCount = _pendingPaths.length;
                // Find the last edit/write/patch tool result for lastEdit field
                const _lastEditResult = [...conversationMessages]
                  .reverse()
                  .find(
                    (m) =>
                      m.role === "tool" &&
                      typeof m.content === "string" &&
                      !m.content.startsWith("BLOCKED:") &&
                      m.content.length > 5,
                  );
                const _manifest = {
                  completed: _completedPaths.map((f) =>
                    f.split("/").slice(-2).join("/"),
                  ),
                  pending:
                    _pendingPaths.length > 0
                      ? _pendingPaths
                      : _completedPaths.length === 0
                        ? ["(task files not yet identified)"]
                        : [],
                  lastEdit: _lastEditResult
                    ? _lastEditResult.content.trim().slice(0, 120)
                    : null,
                };
                if (
                  _manifest.completed.length > 0 ||
                  _manifest.pending.length > 0
                ) {
                  _findingParts.unshift(
                    `Work manifest:\n${JSON.stringify(_manifest, null, 2)}`,
                  );
                }
              }

              if (_findingParts.length > 0) {
                const _findingsMsg = {
                  role: "user",
                  content: `[SYSTEM: Findings from investigation before context wipe]\n${_findingParts.join("\n")}\nContinue implementing the fixes based on these findings.`,
                };
                _superNuclear.push(_findingsMsg);
              }
              // Hard cap: after 3 super-nuclear wipes, abort — repeated context collapse
              // is a sign the task is too large for the current context window.
              if (_superNuclearFires >= 3) {
                const modList =
                  filesModified.size > 0
                    ? `\nFiles modified so far: ${[...filesModified].map((f) => f.split("/").slice(-1)[0]).join(", ")}`
                    : "";
                debugLog(
                  `${C.red}  ✗ Super-nuclear limit reached (3×) — aborting to prevent runaway context loop${C.reset}`,
                );
                console.log(
                  `${C.yellow}  💡 Task may exceed model context. Try /clear and break it into smaller steps.${modList ? C.dim + modList : ""}${C.reset}`,
                );
                if (taskProgress) {
                  taskProgress.stop();
                  taskProgress = null;
                }
                setOnChange(null);
                _printResume(
                  totalSteps,
                  toolCounts,
                  filesModified,
                  filesRead,
                  startTime,
                  { suppressHint: true },
                );
                saveNow(conversationMessages);
                break;
              }

              apiMessages = _superNuclear;
              _superNuclearFires++;
              // Scale budget with pending work: 3 extra calls per pending file, capped at +15.
              // Ensures a 5-file task has enough budget to read + edit remaining files post-wipe.
              _postWipeToolBudget = 10 + Math.min(_pendingFileCount * 3, 7); // within safety bounds [10,17]
              _postWipeEverFired = true; // track that a wipe occurred (distinguishes exhausted from initial -1)
              _filesModifiedAtWipe = filesModified.size; // track progress baseline for budget extension
              _postWipeBudgetExtended = false; // one-time extension flag
              _sessionConsecutiveSshCalls = 0; // fresh SSH budget after context wipe
              // NOTE: intentionally do NOT reset _sshBlockedAfterStorm here.
              // If the SSH storm triggered the context overflow, we must keep SSH blocked
              // so the agent can't immediately repeat the same storm after context wipe.
              // SSH unblocks naturally when the agent sends a text-only response.
              _serverLocalWarnFired = 0; // re-arm local guard for fresh start
              // Preserve read counts for any file read ≥2× so it can't restart a
              // flood cycle after a wipe. Files read once reset to 1 (unbounded
              // re-reads stay blocked, one targeted section still allowed).
              // Files read ≥2× keep their exact count — the agent is already near
              // or past cap and gets at most a couple targeted reads left.
              // Previously: only files read ≥4× were preserved; files read 2-3×
              // reset to 1, allowing 5 more reads per wipe — causing 16× read
              // loops across 3 context wipes (observed in agent session).
              for (const [p, entry] of _sessionFileReadCounts) {
                const c = entry?.count ?? entry ?? 0;
                _setLoopCount(_sessionFileReadCounts, p, c >= 2 ? c : 1);
              }
              // Preserve ranges for any file whose count was kept (≥2 reads) so
              // scroll/overlap detection stays active post-wipe. Files read only
              // once still get fresh ranges for legitimate single-section reads.
              for (const [p] of _sessionFileReadRanges) {
                if (_getLoopCount(_sessionFileReadCounts, p) < 2)
                  _sessionFileReadRanges.delete(p);
              }
              _sessionLastEditFailed.clear();
              _sessionReReadBlockShown.clear();
              // For creation tasks where files are already written, fire the
              // investigation cap immediately after the wipe — the model should
              // continue writing, not re-explore what was already done.
              if (_isCreationTask && _editsMadeThisSession > 0) {
                _investigationCapFired = true;
                debugLog(
                  `${C.cyan}  ⚡ Post-wipe creation guard: cap pre-fired (${_editsMadeThisSession} edits already made)${C.reset}`,
                );
              }
              // Allow only 1 re-grep per file after wipe (abort-1 = 3), not 2 (warn-1 = 2).
              // Previously: LOOP_WARN_GREP_FILE-1 let the agent grep 2 more times post-wipe,
              // causing 6-total grep floods across a single wipe cycle (observed).
              for (const [p] of _sessionGrepFileCounts)
                _setLoopCount(
                  _sessionGrepFileCounts,
                  p,
                  LOOP_ABORT_GREP_FILE - 1,
                );

              _logCompression(
                `Super-nuclear compression — dropped all history, keeping original task only (${_beforeTokens - _afterTokens} tokens freed)`,
                C.yellow,
              );
              // After 1st super-nuclear, inject a skip-investigation hint (_superNuclearFires already incremented)
              if (_superNuclearFires >= 1) {
                // List files already at or near the read hard cap so the model
                // knows not to attempt reading them — prevents the most common
                // post-wipe retry loop where the model re-reads a capped file.
                const _cappedFiles = [..._sessionFileReadCounts.entries()]
                  .filter(([, count]) => count >= TARGETED_READ_HARD_CAP)
                  .map(([p]) => p.split("/").slice(-1)[0]);
                const _cappedNote =
                  _cappedFiles.length > 0
                    ? `\n\nFiles already at read cap — use grep_search instead: ${_cappedFiles.join(", ")}`
                    : "";
                const _skipBase =
                  _sshBlockedAfterStorm && !_rootCauseDetected
                    ? "[SYSTEM] Context was compressed. SSH is currently unavailable — do not read more local files. Summarize what you found and ask the user for the server output you need."
                    : `[SYSTEM] Context was compressed. Use the findings above to implement your fix. If you need to re-read a file, use line_start/line_end for the specific section.${_cappedNote}`;
                const skipMsg = {
                  role: "user",
                  content: _skipBase,
                };
                conversationMessages.push(skipMsg);
                apiMessages.push(skipMsg);
              }
              contextRetries = 0; // reset so we get 3 fresh retries with the stripped context
              i--;
              continue;
            }
          }
          userMessage =
            "Context too large to compress — use /clear to start fresh";
        } else if (
          err.message.includes("500") ||
          err.message.includes("502") ||
          err.message.includes("503") ||
          err.message.includes("504")
        ) {
          userMessage =
            "API server error — the provider is experiencing issues. Please try again in a moment";
        } else if (
          err.message.includes("fetch failed") ||
          err.message.includes("fetch")
        ) {
          userMessage =
            "Network request failed — please check your internet connection";
        }
        console.log(`${C.red}  ✗ ${userMessage}${C.reset}`);

        if (err.message.includes("429")) {
          rateLimitRetries++;
          if (rateLimitRetries > MAX_RATE_LIMIT_RETRIES) {
            console.log(
              `${C.red}  Rate limit: max retries (${MAX_RATE_LIMIT_RETRIES}) exceeded. Try again later or use /budget to check your limits.${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
            );
            saveNow(conversationMessages);
            break outer;
          }
          const delay = Math.min(
            10000 * Math.pow(2, rateLimitRetries - 1),
            120000,
          );
          const waitSpinner = new Spinner(
            `Rate limit — waiting ${Math.round(delay / 1000)}s (retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES})`,
          );
          waitSpinner.start();
          await new Promise((r) => setTimeout(r, delay));
          waitSpinner.stop();
          continue;
        }

        // Network/TLS/server errors — retry with backoff (don't burn iterations)
        // Ollama Cloud has transient 5xx and 401 errors — retry those too.
        // Gated on provider check + not disabled by NEX_PHASE_ROUTING=0 (unit tests).
        const _isOllamaProvider =
          process.env.NEX_PHASE_ROUTING !== "0" &&
          (() => {
            try {
              return (
                require("./providers/registry").getActiveProviderName() ===
                "ollama"
              );
            } catch {
              return false;
            }
          })();
        const isNetworkError =
          err.message.includes("socket disconnected") ||
          err.message.includes("TLS") ||
          err.message.includes("ECONNRESET") ||
          err.message.includes("ECONNABORTED") ||
          err.message.includes("ETIMEDOUT") ||
          (_isOllamaProvider &&
            (err.message.includes("500") ||
              err.message.includes("502") ||
              err.message.includes("503") ||
              err.message.includes("504") ||
              err.message.includes("401") ||
              err.message.includes("Unauthorized"))) ||
          err.code === "ECONNRESET" ||
          err.code === "ECONNABORTED";
        if (isNetworkError) {
          networkRetries++;
          if (networkRetries > MAX_NETWORK_RETRIES) {
            console.log(
              `${C.red}  Network error: max retries (${MAX_NETWORK_RETRIES}) exceeded. Check your connection and try again.\n  Use /undo to revert changes made during this session.${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
            );
            saveNow(conversationMessages);
            break outer;
          }
          const delay = Math.min(2000 * Math.pow(2, networkRetries - 1), 30000);
          const waitSpinner = new Spinner(
            `API temporarily unavailable — retrying in ${Math.round(delay / 1000)}s (${networkRetries}/${MAX_NETWORK_RETRIES}). Your changes are safe.`,
          );
          waitSpinner.start();
          await new Promise((r) => setTimeout(r, delay));
          waitSpinner.stop();
          i--; // Don't count network errors as iterations
          continue;
        }

        // Auto-save on error so conversation isn't lost
        if (taskProgress) {
          taskProgress.stop();
          taskProgress = null;
        }
        setOnChange(null);
        _printResume(
          totalSteps,
          toolCounts,
          filesModified,
          filesRead,
          startTime,
        );
        saveNow(conversationMessages);
        break;
      }

      clearInterval(staleTimer);
      // Successful API response — reset per-call retry counters so transient
      // rate-limit or network errors earlier in the session don't eat future retry budget.
      rateLimitRetries = 0;
      networkRetries = 0;

      if (firstToken) {
        if (taskProgress && !taskProgress._paused) taskProgress.pause();
        if (spinner) spinner.stop();
      }

      // Flush remaining token buffer (from batching)
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
      if (tokenBuffer && stream) {
        stream.push(tokenBuffer);
        tokenBuffer = "";
      }

      // Flush remaining stream buffer
      if (streamedText) {
        stream.flush();
      }
      // Reset retry counters on success
      networkRetries = 0;
      staleRetries = 0;

      // Track token usage for cost dashboard
      // When provider returns usage data: use it directly (even if zero).
      // When provider omits usage entirely (e.g. Ollama Cloud): estimate from text.
      if (result && result.usage) {
        const inputT = result.usage.prompt_tokens || 0;
        const outputT = result.usage.completion_tokens || 0;
        trackUsage(
          getActiveProviderName(),
          getActiveModelId(),
          inputT,
          outputT,
        );
        cumulativeTokens += inputT + outputT;
        if (taskProgress) taskProgress.setStats({ tokens: cumulativeTokens });
      } else if (result && !result.usage) {
        // No usage data — estimate from message context and response content
        const ctxText = apiMessages
          .map((m) => {
            if (typeof m.content === "string") return m.content;
            if (Array.isArray(m.content))
              return m.content
                .map((b) => (typeof b === "string" ? b : b.text || ""))
                .join("");
            return "";
          })
          .join(" ");
        const inputEst = _estTok(ctxText);
        const outputEst = _estTok(result.content || streamedText || "");
        trackUsage(
          getActiveProviderName(),
          getActiveModelId(),
          inputEst,
          outputEst,
        );
        cumulativeTokens += inputEst + outputEst;
        if (taskProgress) taskProgress.setStats({ tokens: cumulativeTokens });
      }

      const { content: rawContent, tool_calls: rawToolCalls } = result;
      let tool_calls = rawToolCalls;
      let askUserBatchTrimmed = false;
      if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
        const askUserCalls = rawToolCalls.filter(
          (tc) => tc?.function?.name === "ask_user",
        );
        if (askUserCalls.length > 0) {
          tool_calls = [askUserCalls[0]];
          askUserBatchTrimmed = rawToolCalls.length !== 1;
          if (askUserBatchTrimmed) {
            debugLog(
              `${C.yellow}  ⚠ ask_user must run alone — deferring ${rawToolCalls.length - 1} other tool call(s) until the user replies${C.reset}`,
            );
          }
        }
      }

      // ── Repetition guard: truncate looping LLM output before storing ──────
      // First apply paragraph-level loop detection (catches tight single-line loops)
      const loopCheck = detectAndTruncateLoop(rawContent || "");
      const afterLoopCheck = loopCheck.truncated ? loopCheck.text : rawContent;
      if (loopCheck.truncated) {
        debugLog(
          `${C.yellow}  ⚠ LLM output loop detected (${loopCheck.repeatCount}× repeated paragraph) — response truncated${C.reset}`,
        );
      }
      // Then apply sentence-window repetition detection (catches multi-sentence loops)
      const repCheck = detectAndTruncateRepetition(afterLoopCheck || "");
      const content = repCheck.truncated ? repCheck.text : afterLoopCheck;
      if (repCheck.truncated) {
        debugLog(
          `${C.yellow}  ⚠ LLM output loop detected (${repCheck.repeatCount}× repeated window) — response truncated${C.reset}`,
        );
      }

      // Build assistant message for history
      if (
        Array.isArray(tool_calls) &&
        tool_calls.length > 0 &&
        _looksLikeUserDirectedQuestion(content || "")
      ) {
        debugLog(
          `${C.yellow}  ⚠ Assistant asked the user a direct question in text — dropping tool calls and waiting for user input${C.reset}`,
        );
        tool_calls = [];
      }

      const assistantMsg = { role: "assistant", content: content || "" };
      if (tool_calls && tool_calls.length > 0) {
        assistantMsg.tool_calls = tool_calls;
      }
      conversationMessages.push(assistantMsg);
      apiMessages.push(assistantMsg);

      // ─── Analysis-only hard exit ─────────────────────────────────────────
      // For pure analysis prompts, after the first substantive text response
      // with no file modifications anywhere, end the loop. Some models ignore
      // the system-prompt "STOP" instruction and keep iterating with redundant
      // re-reads. This is a hard backstop for read-only deliverables.
      if (
        _isAnalysisOnlyPrompt &&
        !isTooShort(content || streamedText || "") &&
        filesModified.size === 0 &&
        _bashModifiedFiles === 0
      ) {
        debugLog(
          `${C.green}  ✓ Analysis-only early exit: ${(content || "").length} chars produced, no file changes${C.reset}`,
        );
        // Drop any planned tool calls — they'd just trigger another analysis loop.
        if (assistantMsg.tool_calls) delete assistantMsg.tool_calls;
        _printResume(
          totalSteps,
          toolCounts,
          filesModified,
          filesRead,
          startTime,
        );
        saveNow(conversationMessages);
        break outer;
      }

      // ─── Root-cause scan: model's own analysis text ──────────────────────
      // When the model identifies a root cause in its reasoning (e.g. writes
      // "TypeError: checkAllAppsWithRetry is not a function"), treat that as a
      // confirmed detection and switch to fix phase immediately.
      if (
        !_rootCauseDetected &&
        content &&
        tool_calls &&
        tool_calls.length > 0
      ) {
        const _textCause = detectRootCause(content);
        if (_textCause) {
          _rootCauseDetected = true;
          _rootCauseSummary = _textCause.slice(0, 120);
          _readOnlyCallsSinceEdit = 0;
          _investigationCapFired = false;
          _readsSinceCapFired = 0;
          debugLog(
            `${C.yellow}  ⚡ Root cause in model analysis: ${_rootCauseSummary} — fix phase (read budget: 3)${C.reset}`,
          );
          const rcTextMsg = {
            role: "user",
            content: `[SYSTEM] Root cause identified: ${_rootCauseSummary}. Read only the file that needs fixing, then edit it. Do not read other files.`,
          };
          conversationMessages.push(rcTextMsg);
          apiMessages.push(rcTextMsg);
        }
      }

      // No tool calls → response complete (or nudge if empty after tools)
      if (!tool_calls || tool_calls.length === 0) {
        const hasText =
          (content || "").trim().length > 0 || streamedText.trim().length > 0;
        // Text-only response after SSH storm: agent synthesized, unblock SSH for follow-up.
        // After the 2nd storm, SSH stays permanently blocked — no more unblocking.
        // After the 1st storm, give a reduced budget (SSH_STORM_WARN - 3) instead of full reset.
        let _justUnblockedSsh = false;
        if (_sshBlockedAfterStorm && hasText) {
          if (_sshStormCount >= 2) {
            // 2+ storms: SSH stays permanently blocked — agent must work with what it has
            debugLog(
              `${C.yellow}  ⚠ SSH permanently blocked after ${_sshStormCount} storm warnings — no further SSH calls allowed${C.reset}`,
            );
          } else {
            _sshBlockedAfterStorm = false;
            // Give reduced budget (4 calls) instead of full reset — enough for targeted follow-up
            _sessionConsecutiveSshCalls = SSH_STORM_WARN - 4;
            _justUnblockedSsh = true;
          }
        }
        // If the agent just got unblocked but responded with a question instead of acting,
        // nudge it to continue implementing the fix without asking.
        if (_justUnblockedSsh && hasText) {
          const synthText = (content || "").trim();
          const endsWithQuestion =
            synthText.endsWith("?") ||
            /\b(Where |Please |Can you|Should I)\b/.test(synthText.slice(-200));
          if (endsWithQuestion) {
            const continueNudge = {
              role: "user",
              content:
                "[SYSTEM] Continue. Do not ask questions — implement the fix yourself using SSH. The server is at 94.130.37.43.",
            };
            apiMessages.push(continueNudge);
            conversationMessages.push(continueNudge);
            continue; // let the loop proceed without counting as a new step
          }
        }
        // If we just ran tools but the LLM produced no text → nudge it to summarize
        if (!hasText && totalSteps > 0 && i < MAX_ITERATIONS - 1) {
          const nudge = {
            role: "user",
            content:
              "[SYSTEM] You ran tools but produced no visible output. The user CANNOT see tool results — only your text. Please summarize your findings now.",
          };
          apiMessages.push(nudge);
          conversationMessages.push(nudge); // keep both arrays in sync (turn-alternation invariant)
          continue; // retry — don't count as a new step
        }
        // Tool avoidance nudge: if the model says it cannot use tools but it
        // actually can, nudge it to use them. Two cases:
        //   A) Post-wipe budget exhausted — model is correct that tools are
        //      blocked; tell it to summarize findings and ask the user for any
        //      information it still needs (don't push SSH which is also blocked).
        //   B) No active budget constraint — model is hallucinating; nudge it
        //      to use tools normally.
        // Cap at 3 nudges (i < 3) to prevent infinite loops.
        const _toolAvoidancePattern =
          /can.?t use.*tool|Tool.?Budget|cannot.*access|no.*tool.*access/i;
        if (
          hasText &&
          i < 3 &&
          _toolAvoidancePattern.test((content || "").slice(0, 600))
        ) {
          // Determine whether the model's claim of no tools is correct or hallucinatory.
          // Budget exhausted: wipe fired AND budget is now ≤ 0.
          const _budgetExhausted =
            _postWipeEverFired && _postWipeToolBudget <= 0;
          if (_budgetExhausted || _sshBlockedAfterStorm) {
            // Model is correct — tools/SSH are constrained. Tell it to ask user.
            debugLog(
              `${C.yellow}  ⚠ Tool avoidance (constrained context) — telling model to ask user${C.reset}`,
            );
            const askNudge = {
              role: "user",
              content:
                "[SYSTEM] Correct — remote access is currently limited. Summarize what you have found so far and tell the user exactly what specific information (logs, process list, error output) you need from the server to continue.",
            };
            apiMessages.push(askNudge);
            conversationMessages.push(askNudge);
            continue;
          } else {
            // Model is hallucinating tool unavailability — nudge it to use tools.
            debugLog(
              `${C.yellow}  ⚠ Tool avoidance detected — nudging model to use tools${C.reset}`,
            );
            const toolNudge = {
              role: "user",
              content:
                "[SYSTEM] You have full tool access. Use your tools to investigate and implement the fix directly — do not say you cannot use tools. If SSH is needed, use a single targeted command that captures the most relevant information rather than multiple sequential calls.",
            };
            apiMessages.push(toolNudge);
            conversationMessages.push(toolNudge);
            continue; // retry without counting as a step
          }
        }
        // ─── Autoresearch continuation nudge ───────────────────────────────────
        // When running a skill-initiated loop (e.g. /autoresearch), the model
        // sometimes decides to stop ("I will now stop", "summary of findings")
        // even though the instructions say NEVER STOP. Detect this and nudge
        // the model to continue the experiment loop.
        if (
          opts.skillLoop &&
          hasText &&
          totalSteps > 3 &&
          _skillLoopNudges < 5
        ) {
          const text = (content || streamedText || "").toLowerCase();
          // No trailing \b — these are prefixes (e.g. "completed", "summary", "finaliz")
          const stoppingPattern =
            /\b(i.ll stop|stop the|stopped|done with|complet|summar|conclud|no more|finish|end of|that.s all|final|wrapped up|no further|mindful of|reached.*limit|tool call limit|at this point|recommend keep)/;
          if (stoppingPattern.test(text.slice(-600))) {
            _skillLoopNudges = (_skillLoopNudges || 0) + 1;
            debugLog(
              `${C.yellow}  ⚠ Skill loop: model tried to stop — continuation nudge #${_skillLoopNudges}${C.reset}`,
            );
            const continueNudge = {
              role: "user",
              content:
                "[SYSTEM] Do NOT stop. You are in an autonomous experiment loop. The user is away and expects you to keep running experiments indefinitely until they interrupt with Ctrl+C. Start the next experiment NOW: hypothesize a new change, checkpoint, edit, run, measure, keep or revert. Think harder — try a completely different optimization approach.",
            };
            apiMessages.push(continueNudge);
            conversationMessages.push(continueNudge);
            continue; // retry without counting as a step
          }
        }

        if (
          getAutoConfirm() &&
          !opts.skillLoop &&
          filesModified.size === 0 &&
          _bashModifiedFiles === 0 &&
          filesRead.size === 0 &&
          totalSteps === 0 &&
          hasText &&
          !_phaseEnabled
        ) {
          debugLog(
            `${C.green}  ✓ Headless direct response exit: text-only response received${C.reset}`,
          );
          saveNow(conversationMessages);
          break outer;
        }

        if (
          getAutoConfirm() &&
          !opts.skillLoop &&
          !_phaseEnabled &&
          (filesModified.size > 0 || _bashModifiedFiles > 0) &&
          _postEditVerifyPending &&
          !_hasPostEditVerificationEvidence() &&
          _postEditVerifyNudges < 2
        ) {
          _postEditVerifyNudges++;
          const suggestedChecks =
            await _inferVerificationCommands(filesModified);
          const relatedTests = await _inferRelevantTests(filesModified);
          const verifyMsg = {
            role: "user",
            content:
              _buildPostEditVerifyPrompt(
                filesModified,
                suggestedChecks,
                relatedTests,
              ) +
              "\nDo not write a final completion summary until this verification evidence exists.",
          };
          conversationMessages.push(verifyMsg);
          apiMessages.push(verifyMsg);
          debugLog(
            `${C.yellow}  ⚠ Headless completion blocked — verification required (${_postEditVerifyNudges}/2)${C.reset}`,
          );
          continue;
        }

        // ─── Early exit in headless mode ──────────────────────────────────────
        // When running in auto/headless mode (benchmarks, improvement loop), once
        // the model has edited files and produces a substantive text-only response,
        // the task is usually done only after at least one verification signal.
        // This preserves benchmark efficiency while blocking cheap false-success
        // endings where code changed but no check or post-edit read happened.
        const _canHeadlessEarlyExit =
          getAutoConfirm() &&
          !opts.skillLoop &&
          (filesModified.size > 0 || _bashModifiedFiles > 0) &&
          hasText &&
          !isTooShort(content || streamedText || "") &&
          totalSteps >= 1 &&
          (!_postEditVerifyPending || _hasPostEditVerificationEvidence()) &&
          !_phaseEnabled;
        if (_canHeadlessEarlyExit) {
          debugLog(
            `${C.green}  ✓ Headless early exit: ${filesModified.size} file(s) modified (+ ${_bashModifiedFiles} bash writes), substantive text response received${C.reset}`,
          );
          _printResume(
            totalSteps,
            toolCounts,
            filesModified,
            filesRead,
            startTime,
          );
          saveNow(conversationMessages);
          break outer;
        }
        // ─── Phase transitions (plan → implement → verify) ────────────────────
        // Auto-advance if model keeps hitting the plan-phase bash block without
        // producing text. This happens for simple tasks (e.g. "compress a video")
        // where bash is the only sensible action — model never produces a text turn.
        const _planBlockThreshold = _shouldFastTrackPlanBlock(
          _lastPlanBlockedTool,
        )
          ? 1
          : 2;
        if (
          _phaseEnabled &&
          _currentPhase === "plan" &&
          _planPhaseBlockedCount >= _planBlockThreshold
        ) {
          debugLog(
            `${C.cyan}  ↳ Plan phase: ${_planPhaseBlockedCount} consecutive blocks (last: ${_lastPlanBlockedTool || "unknown"}) — auto-advancing to implement${C.reset}`,
          );
          _planPhaseBlockedCount = 0;
          _lastPlanBlockedTool = null;
          const phaseMsg = await _transitionPhase(
            "implement",
            "[auto-advance: task only requires direct action]",
          );
          if (phaseMsg) {
            conversationMessages.push(phaseMsg);
            apiMessages.push(phaseMsg);
            i = 0;
            iterLimit = getPhaseBudget("implement");
            continue;
          }
        }
        if (_phaseEnabled && hasText) {
          const _assistantText = (content || streamedText || "").trim();

          if (_currentPhase === "plan") {
            // If the plan found nothing actionable, exit gracefully instead of
            // blindly entering implement phase where the model will just loop.
            // But don't exit if grep found files — the model discovered targets
            // even if the assistant text says "not found" about something else.
            // Use specific phrases only so incidental analysis wording does not match.
            const _notFoundSignals =
              /\b(no match(es)?|not found|couldn'?t find|does not exist|no results|nothing found|no files)\b/i;
            const _hasNoTodos =
              _extractPlanTodos(_assistantText, _sessionFileReadCounts)
                .length === 0;
            const _grepFoundTargets = _sessionGrepFoundFiles.size > 0;
            const _globFoundTargets = _sessionGlobFoundFiles.size > 0;
            // Long structured output is clearly a successful response — never
            // surface a "nothing found" warning for it, even if a stray match
            // hits the regex.
            const _looksLikeRealOutput = _assistantText.length > 1500;
            if (
              getAutoConfirm() &&
              _hasNoTodos &&
              !_grepFoundTargets &&
              !_globFoundTargets &&
              !_looksLikeRealOutput &&
              _notFoundSignals.test(_assistantText)
            ) {
              debugLog(
                `${C.yellow}  ⚠ Plan phase: nothing actionable found — exiting gracefully${C.reset}`,
              );
              if (process.stdout.isTTY) {
                process.stderr.write(
                  `${C.yellow}  ⚠ Could not find the target in this project. The plan phase found no actionable items.${C.reset}\n`,
                );
              }
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
              );
              saveNow(conversationMessages);
              break outer;
            }
            const phaseMsg = await _transitionPhase(
              "implement",
              _assistantText,
            );
            if (phaseMsg) {
              conversationMessages.push(phaseMsg);
              apiMessages.push(phaseMsg);
              i = 0;
              iterLimit = getPhaseBudget("implement");
              continue;
            }
          } else if (
            _currentPhase === "implement" &&
            (filesModified.size > 0 || _bashModifiedFiles > 0)
          ) {
            const _firstUser = conversationMessages.find(
              (m) => m.role === "user",
            );
            const _origTask =
              typeof _firstUser?.content === "string" ? _firstUser.content : "";
            const phaseMsg = await _transitionPhase(
              "verify",
              _assistantText,
              filesModified,
              _origTask,
            );
            if (phaseMsg) {
              conversationMessages.push(phaseMsg);
              apiMessages.push(phaseMsg);
              i = 0;
              iterLimit = Math.min(
                getPhaseBudget("verify") +
                  Math.max(0, (filesModified.size - 2) * 2),
                20,
              );
              continue;
            }
          } else if (_currentPhase === "verify") {
            const _hasPass = /\bPASS\b/i.test(_assistantText.slice(0, 500));
            const _failPattern =
              /\bFAIL\b|test.*fail|error|broken|missing|incorrect/i;
            const _hasFailed = _failPattern.test(_assistantText.slice(0, 500));
            const _verifyEvidenceSeen =
              _verifyToolCalls > 0 ||
              apiMessages.some(
                (m) =>
                  m.role === "assistant" &&
                  typeof m.content === "string" &&
                  /\bPASS\b/i.test(m.content.slice(0, 500)),
              );

            if (
              getAutoConfirm() &&
              !opts.skillLoop &&
              _verifyEvidenceSeen &&
              !_hasFailed &&
              !isTooShort(_assistantText)
            ) {
              debugLog(
                `${C.green}  ✓ Verification phase complete (headless substantive summary)${C.reset}`,
              );
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
              );
              saveNow(conversationMessages);
              _scoreAndPrint(conversationMessages);
              break outer;
            }

            if (_hasFailed && _verifyLoopBack < 3) {
              _verifyLoopBack++;
              const loopMsg = {
                role: "user",
                content:
                  `[PHASE: RE-IMPLEMENTATION] Verification found issues:\n${_assistantText.slice(0, 400)}\n\n` +
                  `Fix the identified issues. This is attempt ${_verifyLoopBack}/3.`,
              };
              _currentPhase = "implement";
              _phaseModelOverride = getModelForPhase(
                "implement",
                _detectedCategoryId,
              );
              conversationMessages.push(loopMsg);
              apiMessages.push(loopMsg);
              i = 0;
              iterLimit = getPhaseBudget("implement");
              debugLog(
                `${C.yellow}  ↳ Verify → implement loop-back #${_verifyLoopBack} (issues found)${C.reset}`,
              );
              continue;
            }
            if (!_hasFailed && (!_hasPass || _verifyToolCalls === 0)) {
              if (_verifyCompletionNudges < 2) {
                _verifyCompletionNudges++;
                const need = [];
                if (_verifyToolCalls === 0)
                  need.push("run at least one verification tool");
                if (!_hasPass) need.push("end your report with PASS or FAIL");
                const verifyNudge = {
                  role: "user",
                  content:
                    `[SYSTEM] Verification is incomplete: ${need.join(" and ")}. ` +
                    "Do not stop yet. Re-read the modified files and/or run tests or linters, then respond with PASS or FAIL.",
                };
                conversationMessages.push(verifyNudge);
                apiMessages.push(verifyNudge);
                debugLog(
                  `${C.yellow}  ⚠ Verify phase incomplete — nudging for evidence (${_verifyCompletionNudges}/2)${C.reset}`,
                );
                continue;
              }
              debugLog(
                `${C.yellow}  ⚠ Verify phase completion accepted without full markers after ${_verifyCompletionNudges} nudges${C.reset}`,
              );
            }
            debugLog(
              `${C.green}  ✓ Verification phase complete${_hasFailed ? " (loop-back exhausted)" : " (PASS)"}${C.reset}`,
            );
            // Clean task completion: verify passed without failure → break immediately.
            // This prevents the model from looping after it has already finished.
            if (!_hasFailed) {
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
              );
              saveNow(conversationMessages);
              _scoreAndPrint(conversationMessages);
              break outer;
            }
          }
        }
        // In plan mode: if the LLM presented a plan without reading ANY files first,
        // reject it and force investigation. A plan based on zero tool calls is pure
        // hallucination — the LLM invented data structures, file locations, etc.
        // Cap at 2 rejections — on the 3rd attempt accept the plan to prevent an
        // infinite investigation loop (LLM may be unable to read relevant files).
        if (isPlanMode() && hasText && totalSteps === 0) {
          _planRejectionCount++;
          if (_planRejectionCount > 2) {
            debugLog(
              `${C.yellow}  ⚠ Plan accepted despite no file reads (rejection loop cap reached)${C.reset}`,
            );
            // Fall through to normal plan handling below
          } else {
            const investigateNudge = {
              role: "user",
              content: `[SYSTEM] You wrote a plan without reading any files. This plan may be based on incorrect assumptions (wrong database type, wrong file structure, etc.).\n\nMANDATORY: Use read_file, glob, or grep to investigate the actual codebase first. Read at least the relevant module file and route file before writing the plan.`,
            };
            conversationMessages.push(investigateNudge);
            apiMessages.push(investigateNudge);
            debugLog(
              `${C.yellow}  ⚠ Plan rejected (${_planRejectionCount}/2): no files read — forcing investigation${C.reset}`,
            );
            continue;
          }
        }

        // In plan mode: save the plan text output to disk and extract structured steps
        if (isPlanMode() && hasText) {
          const planText = (content || streamedText || "").trim();
          setPlanContent(planText);
          _savePlanToFile(planText);
          // Extract structured steps from LLM output so they can be tracked during execution
          const extractedSteps = extractStepsFromText(planText);
          if (extractedSteps.length > 0) {
            // Determine task description from first user message in this session
            const taskMsg = conversationMessages.find((m) => m.role === "user");
            const taskDesc =
              typeof taskMsg?.content === "string"
                ? taskMsg.content.slice(0, 120)
                : "Task";
            createPlan(taskDesc, extractedSteps);
            const stepWord = extractedSteps.length === 1 ? "step" : "steps";
            // Interactive approval prompt (TTY only).
            // We read stdin directly without creating a new readline interface —
            // the main REPL readline is paused while processInput() runs, so
            // direct stdin access is safe here and avoids stream conflicts.
            let _autoApproved = false;
            const _allowInteractivePlanPrompt =
              process.stdout.isTTY &&
              process.stdin.isTTY &&
              !process.env.JEST_WORKER_ID;
            if (_allowInteractivePlanPrompt) {
              const {
                approvePlan,
                startExecution,
                setPlanMode,
              } = require("./planner");
              process.stdout.write(
                `\n${C.cyan}${C.bold}Plan ready${C.reset} ${C.dim}(${extractedSteps.length} ${stepWord})${C.reset}  ${C.green}[A]${C.reset}${C.dim}pprove${C.reset}  ${C.yellow}[E]${C.reset}${C.dim}dit${C.reset}  ${C.red}[R]${C.reset}${C.dim}eject${C.reset}  ${C.dim}[↵ = approve]:${C.reset} `,
              );
              const wasRaw = process.stdin.isRaw;
              const choice = await new Promise((resolve) => {
                try {
                  process.stdin.setRawMode(true);
                } catch (_) {
                  /* no tty */
                }
                process.stdin.resume();
                process.stdin.once("data", (ch) => {
                  try {
                    process.stdin.setRawMode(wasRaw || false);
                  } catch (_) {
                    /* ignore */
                  }
                  // Do NOT pause stdin — the main readline needs it flowing after we return
                  const k = ch.toString().toLowerCase()[0] || "\r";
                  resolve(k);
                });
              });
              process.stdout.write("\n");
              if (choice === "r") {
                console.log(
                  `${C.red}Plan rejected.${C.reset} Ask follow-up questions to refine.`,
                );
              } else if (choice === "e") {
                console.log(
                  `${C.yellow}Type /plan edit to open in editor, or give feedback.${C.reset}`,
                );
              } else {
                // 'a', Enter (\r), space, or anything else → approve
                if (approvePlan()) {
                  startExecution();
                  setPlanMode(false);
                  invalidateSystemPromptCache();
                  console.log(
                    `${C.green}${C.bold}Approved!${C.reset} Executing ${extractedSteps.length} ${stepWord}...`,
                  );
                  const execPrompt = `[PLAN APPROVED — EXECUTE NOW]\n\nImplement the following plan step by step. All tools are now available.\n\n${planText}`;
                  conversationMessages.push({
                    role: "user",
                    content: execPrompt,
                  });
                  apiMessages.push({ role: "user", content: execPrompt });
                  _autoApproved = true;
                }
              }
            } else {
              console.log(
                `\n${C.cyan}${C.bold}Plan ready${C.reset} ${C.dim}(${extractedSteps.length} ${stepWord} extracted).${C.reset} Type ${C.cyan}/plan approve${C.reset}${C.dim} to execute, or ${C.reset}${C.cyan}/plan edit${C.reset}${C.dim} to review.${C.reset}`,
              );
            }
            if (_autoApproved) {
              // Clean up progress state before re-entering the loop
              if (taskProgress) {
                taskProgress.stop();
                taskProgress = null;
              }
              i--; // don't count the plan turn as a step
              continue;
            }
          } else {
            // Prose plan with no extractable numbered steps — still offer A-key approval
            let _prosePlanApproved = false;
            const _allowInteractivePlanPrompt =
              process.stdout.isTTY &&
              process.stdin.isTTY &&
              !process.env.JEST_WORKER_ID;
            if (_allowInteractivePlanPrompt) {
              const {
                approvePlan,
                startExecution,
                setPlanMode,
              } = require("./planner");
              process.stdout.write(
                `\n${C.cyan}${C.bold}Plan ready.${C.reset}  ${C.green}[A]${C.reset}${C.dim}pprove${C.reset}  ${C.red}[R]${C.reset}${C.dim}eject${C.reset}  ${C.dim}[↵ = approve]:${C.reset} `,
              );
              const wasRaw2 = process.stdin.isRaw;
              const choice2 = await new Promise((resolve) => {
                try {
                  process.stdin.setRawMode(true);
                } catch (_) {
                  /* no tty */
                }
                process.stdin.resume();
                process.stdin.once("data", (ch) => {
                  try {
                    process.stdin.setRawMode(wasRaw2 || false);
                  } catch (_) {
                    /* ignore */
                  }
                  resolve(ch.toString().toLowerCase()[0] || "\r");
                });
              });
              process.stdout.write("\n");
              if (choice2 === "r") {
                console.log(
                  `${C.red}Plan rejected.${C.reset} Ask follow-up questions to refine.`,
                );
              } else {
                if (approvePlan()) {
                  startExecution();
                  setPlanMode(false);
                  invalidateSystemPromptCache();
                  console.log(
                    `${C.green}${C.bold}Approved!${C.reset} Executing...`,
                  );
                  const planText2 = getPlanContent() || result.content;
                  const execPrompt2 = `[PLAN APPROVED — EXECUTE NOW]\n\nImplement the following plan step by step. All tools are now available.\n\n${planText2}`;
                  conversationMessages.push({
                    role: "user",
                    content: execPrompt2,
                  });
                  apiMessages.push({ role: "user", content: execPrompt2 });
                  _prosePlanApproved = true;
                }
              }
            } else {
              console.log(
                `\n${C.cyan}${C.bold}Plan ready.${C.reset} ${C.dim}Type ${C.reset}${C.cyan}/plan approve${C.reset}${C.dim} to execute, or ask follow-up questions to refine.${C.reset}`,
              );
            }
            if (_prosePlanApproved) {
              if (taskProgress) {
                taskProgress.stop();
                taskProgress = null;
              }
              i--;
              continue;
            }
          }
        }
        if (taskProgress) {
          taskProgress.stop();
          taskProgress = null;
        }
        setOnChange(null);
        _printResume(
          totalSteps,
          toolCounts,
          filesModified,
          filesRead,
          startTime,
        );
        // ─── Persist creation-task context for next turn ───────────────────────
        // When a creation task produced files, store a one-line context note so
        // the next user message can reference what was built without the model
        // re-investigating from scratch (especially after follow-up questions
        // like "the app won't start").
        if (_isCreationTask && filesModified.size >= 3) {
          const _shortNames = [...filesModified]
            .map((f) => f.split("/").pop())
            .slice(0, 8)
            .join(", ");
          const _hasPkg = [...filesModified].some((f) =>
            f.endsWith("package.json"),
          );
          const _hasReqs = [...filesModified].some((f) =>
            f.endsWith("requirements.txt"),
          );
          const _hasLock = [...filesModified].some(
            (f) =>
              f.endsWith("package-lock.json") ||
              f.endsWith("yarn.lock") ||
              f.endsWith("pnpm-lock.yaml"),
          );
          // Note: if npm/pip install wasn't run, _verificationInjected will have
          // triggered a continuation to bootstrap the env. This summary is stored
          // for the NEXT user turn (follow-up questions after the session ends).
          const _pendingCmds =
            _hasPkg && !_hasLock
              ? "npm install not yet run"
              : _hasReqs
                ? "pip install not yet run"
                : null;
          _lastCreationSummary =
            `[Previous session created ${filesModified.size} files: ${_shortNames}` +
            (_pendingCmds ? ` — ${_pendingCmds}` : "") +
            `. Use this context to answer follow-up questions without re-reading files.]`;
        }
        // ─── Post-creation verification: bootstrap unprepared environments ──────
        // When a creation task wrote dependency files but never ran the installs,
        // inject a continuation and loop back — the model must bootstrap before
        // the session ends. One-shot: _verificationInjected prevents re-triggering.
        if (_isCreationTask && !_verificationInjected && totalSteps > 0) {
          const _hasPkgV = [...filesModified].some((f) =>
            f.endsWith("package.json"),
          );
          const _hasReqsV = [...filesModified].some(
            (f) =>
              f.endsWith("requirements.txt") ||
              f.endsWith("Pipfile") ||
              f.endsWith("pyproject.toml"),
          );
          const _hasLockV = [...filesModified].some(
            (f) =>
              f.endsWith("package-lock.json") ||
              f.endsWith("yarn.lock") ||
              f.endsWith("pnpm-lock.yaml"),
          );
          // Extract bash commands from conversation to check what already ran
          const _allBashCmds = conversationMessages
            .flatMap((m) => {
              const tcs = Array.isArray(m.tool_calls) ? m.tool_calls : [];
              const blocks = Array.isArray(m.content)
                ? m.content.filter((b) => b?.type === "tool_use")
                : [];
              return [...tcs, ...blocks];
            })
            .filter((tc) => {
              const n = tc.function?.name || tc.name || "";
              return n === "bash" || n === "Bash";
            })
            .map((tc) => {
              try {
                const args = tc.function?.arguments ?? tc.input ?? {};
                return (
                  (typeof args === "string" ? JSON.parse(args) : args)
                    ?.command || ""
                );
              } catch {
                return "";
              }
            });
          const _ranPipV = _allBashCmds.some((cmd) =>
            /pip\s+install|python\s+-m\s+venv/.test(cmd),
          );
          const _ranNpmV = _allBashCmds.some((cmd) =>
            /npm\s+install/.test(cmd),
          );

          // Also detect React projects where source files exist but package.json
          // was never written (model creates App.js etc. without the manifest).
          // Require App.js/tsx specifically (root-level React entry point) to
          // avoid false-positives on plain JS or single-file projects.
          const _hasReactSrc = [...filesModified].some((f) =>
            /\/App\.(js|ts|jsx|tsx)$/.test(f),
          );
          const _missingPkg = _hasReactSrc && !_hasPkgV && !_ranNpmV;

          const _needsBootstrap =
            (_hasReqsV && !_ranPipV) ||
            (_hasPkgV && !_hasLockV && !_ranNpmV) ||
            _missingPkg;

          if (_needsBootstrap) {
            _verificationInjected = true;
            const steps = [];
            if (_hasReqsV && !_ranPipV)
              steps.push(
                "python -m venv venv && source venv/bin/activate && pip install -r requirements.txt",
              );
            if (_missingPkg)
              steps.push(
                "create package.json for the React frontend (with react, react-dom, react-scripts dependencies), then run npm install",
              );
            else if (_hasPkgV && !_hasLockV && !_ranNpmV)
              steps.push("npm install");
            const verifyMsg =
              `[FRAMEWORK — post-creation check] You wrote dependency files but never ran the installer. ` +
              `Run now: ${steps.join(" && ")}. Verify it succeeds, fix any errors, then write a closing summary.`;
            debugLog(
              `${C.dim}  [post-creation] bootstrapping environment (${steps.join(", ")})${C.reset}`,
            );
            conversationMessages.push({ role: "user", content: verifyMsg });
            apiMessages.push({ role: "user", content: verifyMsg });
            continue; // re-enter the loop with full tool access
          }
        }

        // ─── Post-turn enforcement: session summary ────────────────────────────
        // If the model ran tool calls (totalSteps > 0) but ended with a terse
        // or bare-question response, make one direct LLM call for a proper
        // closing diagnosis. Applies even when no files were modified — an
        // investigation session that ends without diagnosis scores -2.0.
        // Runs in both interactive and auto-confirm mode; devstral-2 consistently
        // ignores the MANDATORY FINAL RESPONSE system-prompt rule.
        // Does NOT use processInput() to avoid touching conversationMessages.
        const _needsVerificationDisclosure =
          (filesModified.size > 0 || _bashModifiedFiles > 0) &&
          !_hasPostEditVerificationEvidence() &&
          _claimsVerificationOrCompletion(content || streamedText || "") &&
          !_statesVerificationGap(content || streamedText || "");
        if (
          totalSteps > 0 &&
          !opts._isSummaryTurn &&
          (isTooShort(content) || _needsVerificationDisclosure)
        ) {
          try {
            debugLog(
              `${C.dim}  [post-turn] terse ending — requesting diagnosis/summary${C.reset}`,
            );
            const summaryPrompt =
              filesModified.size > 0 || _bashModifiedFiles > 0
                ? [
                    "Write a closing summary (3+ sentences) with:",
                    `- changed files: ${[...filesModified].slice(0, 8).join(", ") || "files changed by shell commands"}`,
                    `- verification: ${
                      verificationCommandsRun.length > 0
                        ? verificationCommandsRun.join(" | ")
                        : verificationReadsRun.length > 0
                          ? `post-edit read: ${verificationReadsRun.slice(0, 4).join(", ")}`
                          : "not run; state this explicitly and do not claim tests/build/checks passed"
                    }`,
                    "- remaining risk or follow-up, if any.",
                  ].join("\n")
                : "Write a closing diagnosis (3+ sentences): what you investigated, what you found, and what the user should do next or what the root cause is.";
            const summaryMessages = [
              ...apiMessages,
              { role: "user", content: summaryPrompt },
            ];
            const summaryRes = await callStream(summaryMessages, [], {});
            const summaryText = (summaryRes?.content || "").trim();
            if (summaryText) {
              console.log(`\n${summaryText}`);
              // Save to conversationMessages so scorer sees the summary
              conversationMessages.push(
                { role: "user", content: summaryPrompt },
                { role: "assistant", content: summaryText },
              );
            }
          } catch {
            /* summary enforcement is non-critical — ignore errors */
          }
        }
        saveNow(conversationMessages);
        _scoreAndPrint(conversationMessages);
        await _awaitAndDrainBackgroundJobs();
        return;
      }

      // ─── Update stats ───
      totalSteps++;
      _phaseIterations++;
      if (totalSteps >= 1) stepPrinted = false; // show step header from first tool call onward
      for (const tc of tool_calls) {
        const name = tc.function.name;
        toolCounts.set(name, (toolCounts.get(name) || 0) + 1);
      }

      // ─── Proactive tool-call budget warning ──────────────────────────────────
      // At 30 tool calls, inject a warning to wrap up. This prevents runaway
      // verification loops that tank session scores.
      if (totalSteps >= 30 && !_toolBudgetWarningInjected) {
        _toolBudgetWarningInjected = true;
        debugLog(
          `${C.yellow}  ⚠ Tool budget warning: ${totalSteps} tool calls used — nudging model to wrap up${C.reset}`,
        );
        const budgetWarn = {
          role: "user",
          content:
            "[SYSTEM] ⚠ You have used " +
            totalSteps +
            " tool calls. This is approaching the quality threshold (40). " +
            "Wrap up NOW: write your final summary and stop. Do NOT run additional verification commands (git status, git diff, git log) — " +
            "your changes are already committed and verified. Further tool calls will hurt session quality.",
        };
        conversationMessages.push(budgetWarn);
        apiMessages.push(budgetWarn);
      }

      // ─── Prepare all tool calls (parse, validate, permissions) ───
      // Run all preparations concurrently. Each call is independent: permission
      // checks and validation are synchronous; only user-confirmation prompts
      // are async, but readline serialises them through stdin automatically.
      const prepared = await Promise.all(
        tool_calls.map((tc) => prepareToolCall(tc)),
      );

      // ─── Synthesis finalization guard (pre-execution) ─────────────────────
      // Once a docs/understanding task has already crossed the evidence threshold,
      // any new read-only call is renewed exploration. Block it before execution
      // so the model has to switch into deliverable generation immediately.
      if (_synthesisEvidenceReady) {
        const SYNTHESIS_READ_ONLY_TOOLS = new Set([
          "read_file",
          "grep",
          "search_files",
          "glob",
          "list_directory",
          "ssh_exec",
          "find_files",
        ]);
        for (const prep of prepared) {
          if (!prep.canExecute || !SYNTHESIS_READ_ONLY_TOOLS.has(prep.fnName))
            continue;
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content:
              "BLOCKED: You already have enough evidence to produce the requested summary/document. Write the deliverable now and stop reading more files.",
            tool_call_id: prep.callId,
          };
        }
      }

      // ─── Pre-batch context pressure check ───────────────────────────────────
      // Warn the LLM before it executes tool calls that could overflow context.
      // Uses apiMessages only (no tools) — slight undercount, fine for thresholds.
      {
        const ctxUsage = getUsage(apiMessages, getAllToolDefinitions());
        const ctxPct = ctxUsage.percentage;
        const hasUnboundedRead = prepared.some(
          (p) => p.canExecute && p.fnName === "read_file" && !p.args?.line_end,
        );
        // Detect unbounded re-reads: read_file without line_start for a file already read.
        // Targeted re-reads (with line_start) are now allowed (reading new sections after 350-line cap).
        const reReadFiles = prepared
          .filter(
            (p) =>
              p.canExecute &&
              p.fnName === "read_file" &&
              p.args?.path &&
              _getLoopCount(fileReadCounts, p.args.path) >= 1 &&
              !p.args?.line_start,
          )
          .map((p) => p.args.path.split("/").slice(-2).join("/"));
        const hasReRead = reReadFiles.length > 0;
        // Warn at 70% if about to do a full (unbounded) file read; urgently at 85% always;
        // also warn unconditionally on unbounded re-reads of files already in context.
        const warnNow =
          (ctxPct >= 70 && hasUnboundedRead && contextPressureWarnedAt < 70) ||
          (ctxPct >= 85 && contextPressureWarnedAt < 85) ||
          hasReRead;
        if (warnNow) {
          contextPressureWarnedAt = ctxPct;
          let urgency = ctxPct >= 85 ? "URGENT" : "WARNING";
          let advice;
          if (hasReRead) {
            urgency = "WARNING";
            advice = `Full-file read of ${reReadFiles.join(", ")} already done — use line_start/line_end for specific sections instead.`;
          } else if (hasUnboundedRead) {
            advice = `Unbounded read at ${Math.round(ctxPct)}% context — use line_start/line_end to avoid overflow.`;
          } else {
            advice = `Use targeted reads (line_start/line_end) to save space.`;
          }
          const pressureMsg = {
            role: "user",
            content: `[SYSTEM ${urgency}] Context ${Math.round(ctxPct)}% used (${ctxUsage.used}/${ctxUsage.limit} tokens). ${advice}`,
          };
          conversationMessages.push(pressureMsg);
          apiMessages.push(pressureMsg);
          if (ctxPct >= 85) {
            const reReadLabel = hasReRead
              ? ` (re-read of: ${reReadFiles.join(", ")})`
              : "";
            debugLog(
              `${C.yellow}  ⚠ Context ${Math.round(ctxPct)}% used — agent warned to use targeted reads${reReadLabel}${C.reset}`,
            );
          }
          // For re-reads at low context usage, don't show misleading "Context X% used" — the
          // hard-block message (below) already handles display for the user.
          // The system warning is still injected into the LLM conversation above.
        }
      }

      // ─── Block re-reads after warning threshold ──────────────────────────────
      // A SYSTEM WARNING is injected (pre-batch) whenever the LLM attempts to
      // re-read a file that already has fileReadCounts >= 1.  The warning and the
      // hard-block are evaluated in the same batch, so the threshold must be
      // identical: block at >= 1 to deny the very same read that triggers the
      // warning.  Using >= 2 was off-by-one — the second read (count=1) executed
      // despite the warning; only the third attempt (count=2) was blocked.
      //
      // IMPORTANT: count is NOT incremented until post-execution.  If the model
      // batches multiple read_file calls in a single turn, all of them would see
      // the same pre-execution count — allowing all of them to pass the hard-cap
      // check even though their combined total would exceed it.  Track pending
      // reads per path in a local accumulator so each call in the batch accounts
      // for reads already approved earlier in the same loop iteration.
      const _pendingReadCounts = new Map();
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (prep.fnName !== "read_file") continue;
        const path = prep.args?.path;
        if (!path) continue;
        const committed = _getLoopCount(fileReadCounts, path);
        const pending = _pendingReadCounts.get(path) || 0;
        const alreadyRead = committed + pending;
        const allowFreshWriteFollowUp = _freshlyWrittenFiles.has(path);
        // Targeted re-reads (line_start provided) are allowed — the 350-line cap means the model
        // legitimately needs multiple reads to cover a large file. Only block unbounded re-reads
        // (no line_start) since those re-flood the context with the same content.
        const isTargetedReRead = prep.args?.line_start != null;
        const editFailCount = _sessionLastEditFailed.get(path) || 0;
        const lastEditFailed = editFailCount > 0;
        const EDIT_RECOVERY_MAX = 2; // max times we allow unconditional edit-recovery reads per file

        // Hard cap: block if total reads (unbounded + targeted) >= TARGETED_READ_HARD_CAP.
        // Between 1 and cap-1: unbounded re-reads are blocked immediately; targeted reads are
        // allowed since the model may need to navigate a large file in multiple sections.

        if (!allowFreshWriteFollowUp && alreadyRead >= TARGETED_READ_HARD_CAP) {
          // Hard cap exceeded — block regardless of targeted/unbounded
          const shortPath = path.split("/").slice(-2).join("/");
          const blockShownCount = (_sessionReReadBlockShown.get(path) || 0) + 1;
          _sessionReReadBlockShown.set(path, blockShownCount);
          if (blockShownCount === 1) {
            debugLog(
              `${C.red}  ✖ Blocked: "${shortPath}" read ${alreadyRead}× — hard cap (${TARGETED_READ_HARD_CAP}) reached${C.reset}`,
            );
          } else if (blockShownCount === 2) {
            // Model ignored the first BLOCKED tool result and tried again — escalate to a
            // system-level warning injected into the conversation. Tool results are easy to
            // ignore; user-role system messages break the retry loop more reliably.
            debugLog(
              `${C.red}  ✖ Escalated block: "${shortPath}" — model ignored BLOCKED, injecting system warning${C.reset}`,
            );
            const escalateMsg = {
              role: "user",
              content: `[SYSTEM WARNING] You already received a BLOCKED error for read_file("${path}") and tried again anyway. This file has reached its read cap (${TARGETED_READ_HARD_CAP}×). Do NOT attempt to read it again. Use grep_search to find specific content, or proceed with what you already know.`,
            };
            conversationMessages.push(escalateMsg);
            apiMessages.push(escalateMsg);
          }
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: `BLOCKED: read_file("${path}") denied — file already read ${alreadyRead}× (hard cap: ${TARGETED_READ_HARD_CAP}). You have seen enough of this file. Use grep to find specific content or proceed with what you know.`,
            tool_call_id: prep.callId,
          };
        } else if (
          !allowFreshWriteFollowUp &&
          alreadyRead >= 1 &&
          isTargetedReRead
        ) {
          // Targeted re-read within cap — allow. Clear edit-failure flag when used.
          // Edit recovery: allow up to EDIT_RECOVERY_MAX unconditional re-reads per file after
          // a failed edit. Beyond that, the model must use existing context instead of re-reading.
          if (lastEditFailed && editFailCount <= EDIT_RECOVERY_MAX) {
            const shortPath = path.split("/").slice(-2).join("/");
            console.log(
              `${C.cyan}  ↩ Targeted re-read: "${shortPath}" (line_start=${prep.args.line_start}) — edit recovery #${editFailCount}${C.reset}`,
            );
            // Decrement the fail count (don't delete — preserve remaining recovery budget)
            _sessionLastEditFailed.set(path, editFailCount - 1);
          } else if (lastEditFailed && editFailCount > EDIT_RECOVERY_MAX) {
            // Edit recovery budget exhausted — block and guide model to use grep instead.
            const shortPath = path.split("/").slice(-2).join("/");
            debugLog(
              `${C.red}  ✖ Edit recovery blocked: "${shortPath}" — ${EDIT_RECOVERY_MAX} recovery reads already used. Use grep to find the exact line numbers, then retry.${C.reset}`,
            );
            prep.canExecute = false;
            prep.errorResult = {
              role: "tool",
              content: `BLOCKED: read_file("${path}") denied — edit recovery budget exhausted (${EDIT_RECOVERY_MAX} recovery reads used). You already have the file content. Use grep_search to find the exact line numbers of the text you want to change, then retry edit_file with the exact text shown.`,
              tool_call_id: prep.callId,
            };
          } else {
            // Check if this targeted re-read overlaps significantly with a range already read.
            // ≥70% overlap (from either direction) means the model is re-reading context it
            // already has. Two cases:
            //   • overlapLen/newLen ≥ 0.7 — new range is mostly covered by the old range
            //   • overlapLen/oldLen ≥ 0.7 — old range is subsumed by the new (e.g. reading
            //     [1,350] after [1,50]: 14% from new perspective but 100% from old). Blocking
            //     this prevents large-range "superread" that re-floods content already in context
            //     and wastes read budget. Block message guides model to skip the already-read part.
            const newStart = parseInt(prep.args.line_start, 10) || 1;
            const newEnd = parseInt(prep.args.line_end, 10) || newStart + 350;
            const prevRanges = _sessionFileReadRanges.get(path) || [];
            let blocked = false;
            for (const [ps, pe] of prevRanges) {
              const overlapStart = Math.max(newStart, ps);
              const overlapEnd = Math.min(newEnd, pe);
              if (overlapEnd > overlapStart) {
                const overlapLen = overlapEnd - overlapStart;
                const newLen = newEnd - newStart || 1;
                const oldLen = pe - ps || 1;
                const superreads =
                  overlapLen / oldLen >= 0.7 && overlapLen / newLen < 0.7;
                const isNarrowRead =
                  newEnd - newStart <= NARROW_READ_PASS_THROUGH;
                // Narrow reads bypass the 70% overlap threshold — but only when the
                // narrow section is NOT fully contained within the already-read range.
                // A narrow read that is 100% inside a known range re-reads content
                // already in context and must be blocked regardless of its size.
                const fullyContained = overlapLen >= newLen;
                if (
                  fullyContained ||
                  (!isNarrowRead &&
                    (overlapLen / newLen >= 0.7 || overlapLen / oldLen >= 0.7))
                ) {
                  const shortPath = path.split("/").slice(-2).join("/");
                  const rangeKey = `${path}:${newStart}-${newEnd}`;
                  const rangeBlockCount =
                    (_sessionRangeBlockCounts.get(rangeKey) || 0) + 1;
                  _sessionRangeBlockCounts.set(rangeKey, rangeBlockCount);
                  if (superreads) {
                    debugLog(
                      `${C.red}  ✖ Blocked superread: "${shortPath}" lines ${newStart}-${newEnd} subsumes already-read ${ps}-${pe} — use line_start=${pe + 1} to skip known content (block #${rangeBlockCount})${C.reset}`,
                    );
                  } else {
                    debugLog(
                      `${C.red}  ✖ Blocked duplicate read: "${shortPath}" lines ${newStart}-${newEnd} (≥70% overlap with lines ${ps}-${pe} already in context, block #${rangeBlockCount})${C.reset}`,
                    );
                  }
                  if (rangeBlockCount >= 2) {
                    // Model ignored the BLOCKED result and requested the same range again.
                    // Inject a strong system-level stop into the conversation — tool results
                    // are easy to overlook; user-role messages are harder to ignore.
                    debugLog(
                      `${C.red}  ✖ Escalated range-block: "${shortPath}" lines ${newStart}-${newEnd} — model ignored BLOCKED, injecting system warning${C.reset}`,
                    );
                    const escalateMsg = {
                      role: "user",
                      content: superreads
                        ? `[SYSTEM] Read blocked ${rangeBlockCount}× for read_file("${path}", lines ${newStart}-${newEnd}). Lines ${ps}-${pe} were already read. Use line_start=${pe + 1} to read only new content, or use grep_search for specific lines.`
                        : `[SYSTEM] Read blocked ${rangeBlockCount}× for read_file("${path}", lines ${newStart}-${newEnd}). Lines ${ps}-${pe} were already read and will NOT change. Use grep_search to find specific content instead.`,
                    };
                    conversationMessages.push(escalateMsg);
                    apiMessages.push(escalateMsg);
                  }
                  prep.canExecute = false;
                  prep.errorResult = {
                    role: "tool",
                    content: superreads
                      ? `BLOCKED: read_file("${path}", lines ${newStart}-${newEnd}) re-reads lines ${ps}-${pe} already in context. Use line_start=${pe + 1} to read only the new content beyond line ${pe}.`
                      : `BLOCKED: read_file("${path}", lines ${newStart}-${newEnd}) is a duplicate — lines ${ps}-${pe} are already in your context (≥70% overlap). Use grep to find specific content instead of re-reading.`,
                    tool_call_id: prep.callId,
                  };
                  blocked = true;
                  break;
                }
              }
            }
            if (!blocked) {
              // No significant overlap with any single previous range — but check for scroll pattern.
              // If the agent has read 3+ non-overlapping sections of the same file without an edit
              // in between, it is scrolling through the file chunk-by-chunk. Scrolling accumulates
              // context faster than grep and usually means the agent lost track of what it already read.
              // Warn at section 3, hard-block at section 4.
              const sectionCount = prevRanges.length; // sections already committed
              const SCROLL_WARN_SECTIONS = 2; // after 2 prior sections (3rd read) — warn
              const SCROLL_BLOCK_SECTIONS = 3; // after 3 prior sections (4th read) — hard block
              if (sectionCount >= SCROLL_BLOCK_SECTIONS) {
                const shortPath = path.split("/").slice(-2).join("/");
                debugLog(
                  `${C.red}  ✖ Blocked file-scroll: "${shortPath}" — ${sectionCount} sections already read. Use grep to find specific content.${C.reset}`,
                );
                const grepAlsoExhausted =
                  _getLoopCount(grepFileCounts, path) >= LOOP_ABORT_GREP_FILE;
                prep.canExecute = false;
                prep.errorResult = {
                  role: "tool",
                  content: grepAlsoExhausted
                    ? `BLOCKED: read_file("${path}") denied — you have already read ${sectionCount} different sections of this file (file-scroll pattern). Grep is also exhausted. The content you need is already in your context — work with what you have.`
                    : `BLOCKED: read_file("${path}") denied — you have already read ${sectionCount} different sections of this file (file-scroll pattern). You have seen most of this file. Use grep_search to find the exact lines you need instead of continuing to scroll.`,
                  tool_call_id: prep.callId,
                };
              } else if (sectionCount >= SCROLL_WARN_SECTIONS) {
                // Allow but inject a warning into the result (done post-execution via flag)
                prep._scrollWarn = { sectionCount: sectionCount + 1, path };
              }
            }
          }
          // else: normal targeted section read of a large file — let through silently
        } else if (!allowFreshWriteFollowUp && alreadyRead >= 1) {
          // Test-failure recovery: allow one full re-read if a test command just
          // failed while this file was recently edited. Without this bypass, the model
          // cannot inspect the broken output it produced and invents ghost problems.
          const _recoveryCount = _sessionLastEditFailed.get(path) || 0;
          if (_recoveryCount > 0) {
            const shortPath = path.split("/").slice(-2).join("/");
            console.log(
              `${C.cyan}  ↩ Full re-read: "${shortPath}" — test-failure recovery (${_recoveryCount} remaining)${C.reset}`,
            );
            const newRecovery = _recoveryCount - 1;
            if (newRecovery <= 0) {
              _sessionLastEditFailed.delete(path);
            } else {
              _sessionLastEditFailed.set(path, newRecovery);
            }
            // fall through — read is allowed
          } else {
            // Unbounded re-read — block immediately to prevent context flood
            const shortPath = path.split("/").slice(-2).join("/");
            const blockShownCount =
              (_sessionReReadBlockShown.get(path) || 0) + 1;
            _sessionReReadBlockShown.set(path, blockShownCount);
            if (blockShownCount === 1) {
              debugLog(
                `${C.red}  ✖ Blocked unbounded re-read: "${shortPath}" — already in context. Use line_start/line_end for specific sections.${C.reset}`,
              );
            } else if (blockShownCount === 2) {
              // Model retried a blocked unbounded re-read — escalate to system-level warning.
              debugLog(
                `${C.red}  ✖ Escalated block: "${shortPath}" — model ignored unbounded re-read block, injecting system warning${C.reset}`,
              );
              const escalateMsg = {
                role: "user",
                content: `[SYSTEM] read_file("${path}") was blocked again — full-file reads are disabled after the first read. Use line_start/line_end for a specific section, or use grep_search to find what you need.`,
              };
              conversationMessages.push(escalateMsg);
              apiMessages.push(escalateMsg);
            }
            prep.canExecute = false;
            prep.errorResult = {
              role: "tool",
              content: `BLOCKED: read_file("${path}") denied — file already in context (read ${alreadyRead}×). Use line_start/line_end to read a specific section instead of the full file.`,
              tool_call_id: prep.callId,
            };
          } // end else (no recovery budget)
        }
        // If this read was approved, count it as pending so subsequent reads in
        // the same batch see an accurate cumulative count and can't all slip
        // through the hard-cap check simultaneously.
        if (prep.canExecute) {
          _pendingReadCounts.set(path, (_pendingReadCounts.get(path) || 0) + 1);
        }
      }

      // ─── file-not-found streak: block guessed reads, force search ───────────
      // After 3+ consecutive file-not-found errors, block read_file/edit_file
      // unless the path was returned by a recent search_files/glob_files call.
      if (_consecutiveFileNotFound >= 3) {
        for (const prep of prepared) {
          if (!prep.canExecute) continue;
          if (prep.fnName !== "read_file" && prep.fnName !== "edit_file")
            continue;
          debugLog(
            `${C.red}  ✖ Blocked ${prep.fnName} — ${_consecutiveFileNotFound} consecutive file-not-found errors, must search first${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content:
              `BLOCKED: ${_consecutiveFileNotFound} consecutive "File not found" errors. ` +
              `You must call search_files or glob_files to locate the correct path before reading or editing. ` +
              `Do not guess file paths.`,
            tool_call_id: prep.callId,
          };
        }
      }

      // ─── bash find / ls pre-execution redirect ──────────────────────────────
      // Block bash calls that use find or ls when dedicated tools exist.
      // find <path> → use glob; ls → use list_directory.
      // Exclusions: complex pipelines, git/npm/make find, -exec patterns.
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (prep.fnName !== "bash") continue;
        const _bcmd = (prep.args?.command || "").trim();

        // ls — simple directory listing, no pipeline
        if (
          /^\s*ls(\s+-[a-zA-Z]+)*(\s+\S+)?\s*$/.test(_bcmd) &&
          !/npm|yarn|pnpm|make|git/.test(_bcmd)
        ) {
          debugLog(
            `${C.red}  ✖ Blocked bash ls — use list_directory tool instead${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: `BLOCKED: bash("ls ...") denied — use the list_directory tool instead. It returns structured output and does not penalize the session score.`,
            tool_call_id: prep.callId,
          };
          continue;
        }

        // find <path> — file search, no complex pipeline / -exec
        if (
          /\bfind\s+[\S.]/.test(_bcmd) &&
          !/git\s|npm\s|yarn\s|-exec\s+\S|-execdir/.test(_bcmd)
        ) {
          debugLog(
            `${C.red}  ✖ Blocked bash find — use glob tool with a pattern instead${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: `BLOCKED: bash("find ...") denied — use the glob tool with a pattern like "**/*.py" or "src/**/*.js" instead. It is faster and does not penalize the session score.`,
            tool_call_id: prep.callId,
          };
        }
      }

      // ─── sed -n pre-execution block ──────────────────────────────────────────
      // Block sed -n line-range commands BEFORE they execute. Previously only a
      // post-execution warning was injected — the command still ran and flooded context.
      // Now block it outright so the model is forced to use grep instead.
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (prep.fnName !== "ssh_exec" && prep.fnName !== "bash") continue;
        if (!/\bsed\s+-n\b/.test(prep.args?.command || "")) continue;
        debugLog(
          `${C.red}  ✖ Blocked sed -n: use grep -n "pattern" <file> | head -30 instead${C.reset}`,
        );
        prep.canExecute = false;
        prep.errorResult = {
          role: "tool",
          content: `BLOCKED: sed -n is forbidden — it floods context with line ranges. Use grep -n "pattern" <file> | head -30 to read a specific section, or cat <file> for the full file.`,
          tool_call_id: prep.callId,
        };
      }

      // ─── write_file shrink guard ─────────────────────────────────────────────
      // If write_file would replace an existing file with content <60% of the original
      // length, it likely lost context and is overwriting with a skeleton. Block it.
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (prep.fnName !== "write_file") continue;
        const wfPath = prep.args?.path;
        const newContent = prep.args?.content || "";
        if (!wfPath) continue;
        try {
          const fs_ = require("fs");
          const resolvedWf = require("path").resolve(process.cwd(), wfPath);
          if (fs_.existsSync(resolvedWf)) {
            const oldLen = fs_.statSync(resolvedWf).size;
            const newLen = Buffer.byteLength(newContent, "utf8");
            const ratio = oldLen > 0 ? newLen / oldLen : 1;
            const normalizedPrompt = _normalizePromptPathMatch(_firstUserText);
            const normalizedWfPath = _normalizePromptPathMatch(wfPath);
            const allowDirectTaskOverwrite =
              _shouldSkipPlanPhaseForDirectCreation(_firstUserText) &&
              (normalizedPrompt.includes(normalizedWfPath) ||
                normalizedPrompt.includes(`./${normalizedWfPath}`));
            if (allowDirectTaskOverwrite) {
              continue;
            }
            if (ratio < 0.6 && oldLen > 200) {
              const shortPath = wfPath.split("/").slice(-2).join("/");
              console.log(
                `${C.red}  ✖ write_file shrink guard: "${shortPath}" would shrink to ${Math.round(ratio * 100)}% of original — likely context loss${C.reset}`,
              );
              prep.canExecute = false;
              prep.errorResult = {
                role: "tool",
                content: `BLOCKED: write_file("${wfPath}") denied — new content is only ${Math.round(ratio * 100)}% of current file size (${oldLen} → ${newLen} bytes). This looks like a partial rewrite after context loss. Use edit_file/patch_file to add only the new code, or read the file first to see full content before replacing.`,
                tool_call_id: prep.callId,
              };
            }
          }
        } catch (_) {
          /* ignore stat errors */
        }
      }

      // ─── Block grep flood after abort threshold ──────────────────────────────
      // After LOOP_ABORT_GREP_FILE different-pattern greps on the same file, hard-block
      // further greps on that file. The file content is already in context — searching
      // it again only wastes tokens and scores worse on the session scorer.
      // Batch-level dedup: track pending greps so multiple greps on the same file
      // in a single batch don't all slip through the threshold check.
      const _pendingGrepFileCounts = new Map();
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (prep.fnName !== "grep") continue;
        const grepPath = prep.args?.path;
        if (!grepPath) continue;
        const pending = _pendingGrepFileCounts.get(grepPath) || 0;
        const alreadyGrepped =
          _getLoopCount(grepFileCounts, grepPath) + pending;
        // When the file has already been read, its content is in context — greps
        // on it are almost always redundant. Use a tighter abort threshold (3)
        // so the model is forced to use context after at most 3 grep attempts
        // rather than the default 8. This was the root cause of the "grep flood
        // on single file" pattern observed in session scoring.
        const fileAlreadyReadForGrep =
          _getLoopCount(fileReadCounts, grepPath) >= 1;
        const effectiveGrepAbort = fileAlreadyReadForGrep
          ? Math.min(3, LOOP_ABORT_GREP_FILE)
          : LOOP_ABORT_GREP_FILE;
        if (alreadyGrepped >= effectiveGrepAbort) {
          const shortPath = grepPath.split("/").slice(-2).join("/");
          debugLog(
            `${C.red}  ✖ Blocked grep: "${shortPath}" grepped ${alreadyGrepped}× with different patterns — flood threshold exceeded${C.reset}`,
          );
          // Check if reads are also exhausted for this file — if so, inject a deadlock-break
          // message so the model doesn't bounce between "use grep" and "read the file" forever.
          const readsForFile = _getLoopCount(fileReadCounts, grepPath);
          const readsAlsoBlocked = readsForFile >= TARGETED_READ_HARD_CAP;
          if (readsAlsoBlocked) {
            const deadlockMsg = {
              role: "user",
              content: `[SYSTEM] Both read_file and grep are now blocked for "${grepPath}". You have already read ${readsForFile} sections and tried ${alreadyGrepped} grep patterns. Do NOT attempt to read or grep this file again. The content you need is already in your conversation context — scroll back to find it, or proceed with what you know.`,
            };
            conversationMessages.push(deadlockMsg);
            apiMessages.push(deadlockMsg);
            debugLog(
              `${C.red}  ✖ Deadlock detected: "${shortPath}" — both read and grep blocked, injecting deadlock-break${C.reset}`,
            );
          }
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: readsAlsoBlocked
              ? `BLOCKED: grep("${grepPath}") denied — ${alreadyGrepped} patterns already tried AND reads are also exhausted. The content is already in your context. Do not attempt to read or grep this file again.`
              : fileAlreadyReadForGrep
                ? `BLOCKED: grep("${grepPath}") denied — file was already read and ${alreadyGrepped} grep patterns tried. The content is already in your context; use it instead of searching again.`
                : `BLOCKED: grep("${grepPath}") denied — ${alreadyGrepped} patterns already tried. Work with the grep results already in your context.`,
            tool_call_id: prep.callId,
          };
        }
        if (prep.canExecute) {
          _pendingGrepFileCounts.set(grepPath, pending + 1);
        }
      }

      // ─── Block repeated ssh_exec commands ───────────────────────────────────────
      // If the same normalized SSH command has already run ≥3× this session, the
      // output is already in context — running it again wastes tokens and locks the
      // agent into an investigation loop. Block before execution so the model is
      // forced to reason from existing results.
      const SSH_EXEC_REPEAT_BLOCK = 5;
      const _pendingSshCmdCounts = new Map();
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (prep.fnName !== "ssh_exec") continue;
        const rawSshCmd = prep.args?.command || "";
        const sshCmdKey = rawSshCmd
          .replace(/\d+/g, "N")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 100);
        const pendingSsh = _pendingSshCmdCounts.get(sshCmdKey) || 0;
        const alreadyRanSsh =
          _getLoopCount(bashCmdCounts, sshCmdKey) + pendingSsh;
        if (alreadyRanSsh >= SSH_EXEC_REPEAT_BLOCK) {
          debugLog(
            `${C.yellow}  ⚠ Blocked ssh_exec: same command run ${alreadyRanSsh}× — result already in context${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: `BLOCKED: ssh_exec denied — this command has already run ${alreadyRanSsh} times and the output is in your context. Use existing results, try a different command, or run it as a local bash call: bash("ssh user@host 'your command'").`,
            tool_call_id: prep.callId,
          };
        }
        if (prep.canExecute) {
          _pendingSshCmdCounts.set(sshCmdKey, pendingSsh + 1);
        }
      }

      // ─── SSH block after storm warning ──────────────────────────────────────────
      // After SSH storm warning fires, block all further ssh_exec calls. The agent
      // MUST synthesize with what it already has. Unblocked when the agent produces
      // a text-only LLM response (no tool calls) — see below in the LLM response handler.
      //
      // Dual-block deadlock prevention: if SSH storm AND Server-local guard are BOTH
      // active, the LLM has no information source at all and will hallucinate bad code.
      // In that case, relax the SSH storm block and give the LLM one more SSH call.
      if (_sshBlockedAfterStorm) {
        const _allSsh = prepared.filter(
          (p) => p.canExecute && p.fnName === "ssh_exec",
        );
        const _anyNonSsh = prepared.some(
          (p) => p.canExecute && p.fnName !== "ssh_exec",
        );
        const _serverGuardActive =
          _isServerDebugging && _serverLocalWarnFired < 3;
        if (
          _allSsh.length > 0 &&
          !_anyNonSsh &&
          _serverGuardActive &&
          _sshDeadlockRelaxCount < 1
        ) {
          // Only SSH calls in this batch and local guard would also block — deadlock.
          // Relax SSH storm to allow ONE call so the agent can proceed.
          // Hard-cap: relaxer only fires ONCE per session to prevent repeated storm bypass.
          _sshBlockedAfterStorm = false;
          _sshDeadlockRelaxCount++;
          _sessionConsecutiveSshCalls = Math.max(0, SSH_STORM_WARN - 2); // partial reset
          debugLog(
            `${C.dim}  [dual-block deadlock: SSH storm relaxed — allowing 1 SSH call (relax ${_sshDeadlockRelaxCount}/1)]${C.reset}`,
          );
        } else {
          for (const prep of _allSsh) {
            prep.canExecute = false;
            prep.errorResult = {
              role: "tool",
              content: _rootCauseDetected
                ? `BLOCKED: ssh_exec denied — SSH paused (${SSH_STORM_WARN}+ calls). Root cause is known (${_rootCauseSummary}). Edit the file now. You can still use bash("ssh user@host 'cmd'") for a single targeted lookup if essential.`
                : `BLOCKED: ssh_exec denied — SSH temporarily paused (${SSH_STORM_WARN}+ calls). Provide a text summary of your findings first. Do NOT ask the user to run commands. SSH re-enables after your summary. For one-off lookups use bash("ssh user@host 'cmd'") instead.`,
              tool_call_id: prep.callId,
            };
          }
        }
      }

      // ─── Server-local guard (pre-execution) ─────────────────────────────────────
      // If this is a server-debugging task (first user message contains server error
      // keywords), block the first local bash/read_file/find_files call and set an
      // errorResult so the LLM gets a clear "use ssh_exec" message instead of running
      // locally. Fires once per session. Must be pre-execution (before executeBatch)
      // — post-execution warnings can't prevent the tool from running.
      // SKIP when SSH is blocked after storm — local tools are the only fallback.
      const _hasRuntimeInspection = hasConversationToolCall(
        conversationMessages,
        [
          "browser_open",
          "browser_screenshot",
          "ssh_exec",
          "service_logs",
          "remote_agent",
        ],
      );
      if (
        (_isServerDebugging || _isRuntimeUrlDebugging) &&
        !_hasRuntimeInspection &&
        _serverLocalWarnFired < 3 &&
        !_sshBlockedAfterStorm
      ) {
        for (const prep of prepared) {
          if (!prep.canExecute) continue;
          if (
            ![
              "bash",
              "read_file",
              "find_files",
              "list_directory",
              "search_files",
              "glob",
              "grep",
            ].includes(prep.fnName)
          )
            continue;
          _serverLocalWarnFired++;
          {
            const _allTools = getAllToolDefinitions();
            const { messages: _c } = forceCompress(apiMessages, _allTools);
            apiMessages = _c;
          }
          const runtimeTargetLabel = _runtimeDebugTarget?.matchedName
            ? `${_runtimeDebugTarget.matchedName} (${_runtimeDebugTarget.matchedProfile?.host || "server"})`
            : _runtimeDebugTarget?.url;
          const blockMessage = _runtimeDebugTarget?.shouldPreferSsh
            ? `BLOCKED: ${prep.fnName} denied — this looks like a live app/server issue. Inspect ${_runtimeDebugTarget?.url} with browser_open or use ssh_exec on ${runtimeTargetLabel} first, then return to local code if needed.`
            : `BLOCKED: ${prep.fnName} denied — this looks like a live app issue. Inspect ${_runtimeDebugTarget?.url} with browser_open first, then return to local code if needed.`;
          debugLog(
            `${C.yellow}  ⚠ Runtime guard: blocking local ${prep.fnName} — inspect the live app first${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: blockMessage,
            tool_call_id: prep.callId,
          };
          break; // one block per batch is enough to redirect the agent
        }
      }

      // ─── Creation-task hard block: prevent reads after cap fired + edit made ──
      // For creation tasks the cap fires fast (4 pre-edit, 2 post-edit). Once it
      // has fired AND the agent has written at least one file, any further read is
      // blocked pre-execution — the agent has enough context to keep building.
      if (
        !_phaseEnabled &&
        _investigationCapFired &&
        _isCreationTask &&
        _editsMadeThisSession >= 1
      ) {
        const READ_ONLY_PRE_BLOCK = [
          "read_file",
          "grep",
          "search_files",
          "glob",
          "list_directory",
          "find_files",
        ];
        for (const prep of prepared) {
          if (!prep.canExecute) continue;
          if (!READ_ONLY_PRE_BLOCK.includes(prep.fnName)) continue;
          debugLog(
            `${C.red}  ✖ Creation hard-block: ${prep.fnName} denied — cap fired, files already written${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: `BLOCKED: files already written — continue with write_file or edit_file to finish the remaining tasks. Do not read more files.`,
            tool_call_id: prep.callId,
          };
        }
      }

      // ─── Enforce post-wipe tool call budget ─────────────────────────────────
      // After a context wipe the model gets 10 tool calls (extendable to 15 on progress).
      // Count only calls that would actually execute; blocked ones don't spend budget.
      // When exhausted: check for progress (new file edits since wipe) and grant 5 bonus
      // calls once. If still exhausted after extension, block and inject a stop instruction.
      if (_postWipeToolBudget >= 0) {
        const executableNow = prepared.filter((p) => p.canExecute).length;
        if (executableNow > 0) {
          _postWipeToolBudget -= executableNow;
          if (_postWipeToolBudget < 0) {
            // Progress extension: if the model made file edits since the wipe, grant 5 bonus calls (once)
            if (
              !_postWipeBudgetExtended &&
              filesModified.size > _filesModifiedAtWipe
            ) {
              _postWipeBudgetExtended = true;
              _postWipeToolBudget = 5; // grant 5 bonus calls (total cap: 15)
              debugLog(
                `${C.green}  ✓ Post-wipe progress detected (${filesModified.size - _filesModifiedAtWipe} files modified) — granting 5 bonus tool calls${C.reset}`,
              );
              const progressMsg = {
                role: "user",
                content:
                  "[SYSTEM] Progress detected — 5 bonus tool calls granted. Budget: 5 remaining.",
              };
              conversationMessages.push(progressMsg);
              apiMessages.push(progressMsg);
            } else {
              debugLog(
                `${C.red}  ✖ Post-wipe tool budget exhausted — blocking all tool calls${C.reset}`,
              );
              for (const prep of prepared) {
                if (!prep.canExecute) continue;
                prep.canExecute = false;
                prep.errorResult = {
                  role: "tool",
                  content:
                    "BLOCKED: post-wipe tool budget exhausted. No further tool calls are allowed. Summarise what was accomplished and stop.",
                  tool_call_id: prep.callId,
                };
              }
              const budgetMsg = {
                role: "user",
                content:
                  "[SYSTEM] Post-wipe tool budget exhausted. All tool calls are now blocked. Respond with a final summary of what was done and stop — do not attempt any more tool calls.",
              };
              conversationMessages.push(budgetMsg);
              apiMessages.push(budgetMsg);
            }
          }
        }
      }

      // ─── Block identical duplicate tool calls ──────────────────────────────────
      // If the exact same tool+args combination has been called before this session,
      // warn on 2nd occurrence and hard-block on 3rd+. Only applies to read-only/query
      // tools where repeating identical args is never useful (result is already in context).
      // Mutating tools (edit, write, bash, ssh) are exempt — repeated calls can be intentional.
      const DUPE_TOOL_EXEMPT = new Set([
        "edit_file",
        "write_file",
        "bash",
        "ssh_exec",
        "ask_user",
        "spawn_agents",
        "browser_click",
        "browser_fill",
        "browser_open",
        // Autoresearch tools are designed to be called repeatedly with the same args
        // (e.g. running the same benchmark command after each code edit)
        "skill_ar_run_experiment",
        "skill_ar_run_benchmark",
        "skill_ar_checkpoint",
        "skill_ar_revert",
        "skill_ar_log_experiment",
        "skill_ar_extract_metric",
      ]);
      for (const prep of prepared) {
        if (!prep.canExecute) continue;
        if (DUPE_TOOL_EXEMPT.has(prep.fnName)) continue;
        const argsKey = JSON.stringify(prep.args || {});
        const fingerprint = `${prep.fnName}|${argsKey}`;
        const count = _getLoopCount(_sessionDupeToolCounts, fingerprint);
        if (count >= 2) {
          // 3rd+ identical call — hard block
          debugLog(
            `${C.red}  ✖ Blocked duplicate: ${prep.fnName}(${argsKey.substring(0, 80)}) — called ${count + 1}× with identical args${C.reset}`,
          );
          prep.canExecute = false;
          prep.errorResult = {
            role: "tool",
            content: `BLOCKED: ${prep.fnName}() with these exact arguments has already been called ${count}× — the result is already in your context. Use the existing output instead of repeating the same call.`,
            tool_call_id: prep.callId,
          };
        } else if (count === 1) {
          // 2nd identical call — warn but allow (some legitimate cases exist)
          debugLog(
            `${C.yellow}  ⚠ Duplicate tool call: ${prep.fnName}(${argsKey.substring(0, 80)}) — 2nd call with identical args${C.reset}`,
          );
        }
        // Increment after check so batch-mates don't all see count=0
        _incLoopCount(_sessionDupeToolCounts, fingerprint);
      }

      // ─── Map-first gate: block second edit to same file without re-read ──────────
      // After any successful edit, the file content changes. Constructing old_text
      // for a second edit from the pre-edit read state produces "old_text not found".
      // Block the edit and require the model to re-read the changed section first.
      // Also catches multiple edits to the same file within a single batch.
      {
        const _batchEditPaths = new Set();
        for (const prep of prepared) {
          if (!prep.canExecute) continue;
          if (!["edit_file", "patch_file"].includes(prep.fnName)) continue;
          const _mfPath = prep.args?.path;
          if (!_mfPath) continue;
          if (_batchEditPaths.has(_mfPath)) {
            prep.canExecute = false;
            prep.errorResult = {
              role: "tool",
              content: `BLOCKED: "${_mfPath}" is already being edited in this batch. Finish one edit first, then re-read the changed section before the next one.`,
              tool_call_id: prep.callId,
            };
            debugLog(
              `${C.yellow}  ⚠ Map-first gate: blocked duplicate same-batch edit of "${_mfPath.split("/").slice(-1)[0]}"${C.reset}`,
            );
          } else if (
            _editedFilesNotReread.has(_mfPath) &&
            !_freshlyWrittenFiles.has(_mfPath)
          ) {
            prep.canExecute = false;
            prep.errorResult = {
              role: "tool",
              content: `BLOCKED: "${_mfPath}" was already edited — re-read the changed section first (read_file with line_start/line_end) before making another edit. The file content has changed and your previous read is stale.`,
              tool_call_id: prep.callId,
            };
            debugLog(
              `${C.yellow}  ⚠ Map-first gate: blocked re-edit of "${_mfPath.split("/").slice(-1)[0]}" — re-read required${C.reset}`,
            );
          } else {
            _batchEditPaths.add(_mfPath);
          }
        }
      }

      // ─── Execute with parallel batching (quiet mode: spinner + compact summaries) ───
      const batchOpts = taskProgress
        ? { skipSpinner: true, skipSummaries: true }
        : {};
      // ask_user renders its own UI — skip the normal section header for it
      const hasAskUser = prepared.some((p) => p.fnName === "ask_user");
      // Print bullet header immediately (before execution) so it appears while working
      const _showStepHeader = !batchOpts.skipSummaries && !stepPrinted;
      let _spinAnim = null;
      let _blinkHeaderRow = null; // absolute row of blink header for reliable cleanup
      if (_showStepHeader && !hasAskUser) {
        stepPrinted = true;
        batchOpts.skipSpinner = true;
        if (process.stdout.isTTY) {
          // Capture the row where the blink header will land BEFORE writing, so
          // the cleanup can use absolute positioning even if a confirm dialog moves
          // the cursor to a different row during tool execution.
          if (global._nexFooter) {
            _blinkHeaderRow = Math.min(
              global._nexFooter._lastOutputRow + 1,
              global._nexFooter._scrollEnd,
            );
          }
          const _animatedHeader = formatSectionHeader(
            prepared,
            totalSteps,
            false,
            0,
          );
          const _staticHeader = formatSectionHeader(
            prepared,
            totalSteps,
            false,
          );
          process.stdout.write(
            `${totalSteps > 1 ? "\n" : ""}${_animatedHeader}`,
          );
          _lastRenderedHeaderLine = _staticHeader;
          _lastRenderedHeaderAt = Date.now();
          _spinAnim = {
            start: Date.now(),
            frame: 0,
            timer: null,
          };
        } else if (!_serverHooks) {
          // Non-TTY headless mode: plain section header (skip in server mode to avoid stdout pollution)
          const _header = formatSectionHeader(prepared, totalSteps, false);
          if (
            !_isImmediateDuplicateLine(
              _header,
              _lastRenderedHeaderLine,
              _lastRenderedHeaderAt,
            )
          ) {
            process.stdout.write(`${totalSteps > 1 ? "\n" : ""}${_header}\n`);
            _lastRenderedHeaderLine = _header;
            _lastRenderedHeaderAt = Date.now();
          }
        }
      } else if (_showStepHeader) {
        stepPrinted = true;
        batchOpts.skipSpinner = true;
      }
      // Resume TaskProgress animation during tool execution so the UI never looks frozen
      if (taskProgress && taskProgress._paused) taskProgress.resume();

      if (_spinAnim && process.stdout.isTTY) {
        _spinAnim.timer = setInterval(() => {
          _spinAnim.frame++;
          const _elapsed = Math.round((Date.now() - _spinAnim.start) / 1000);
          const _elapsedSuffix =
            _elapsed >= 1 ? ` ${C.dim}[${_elapsed}s]${C.reset}` : "";
          const _hdr = `${formatSectionHeader(
            prepared,
            totalSteps,
            false,
            _spinAnim.frame,
          )}${_elapsedSuffix}`;
          if (_blinkHeaderRow !== null) {
            process.stdout.write(`\x1b[${_blinkHeaderRow};1H\x1b[2K${_hdr}`);
          } else {
            process.stdout.write(`\r\x1b[2K${_hdr}`);
          }
        }, 120);
        _spinAnim.timer.unref?.();
      }

      const { results: toolMessages, summaries: batchSummaries } =
        await executeBatch(prepared, true, {
          ...batchOpts,
          skipSummaries: true,
        });

      if (askUserBatchTrimmed) {
        const askUserWaitMsg = {
          role: "user",
          content:
            "[SYSTEM] ask_user is exclusive. Wait for the user's answer before making any other tool calls.",
        };
        conversationMessages.push(askUserWaitMsg);
        apiMessages.push(askUserWaitMsg);
      }

      // Stop header animation, finalize header with static dot.
      // Use absolute row positioning when available — a confirm dialog during tool
      // execution moves the cursor away from the animated header row, so \r\x1b[2K
      // would clear the wrong row and trigger an unwanted scroll.
      if (_spinAnim) {
        if (_spinAnim.timer) {
          clearInterval(_spinAnim.timer);
          _spinAnim.timer = null;
        }
        const _staticHeader = formatSectionHeader(prepared, totalSteps, false);
        if (
          !_isImmediateDuplicateLine(
            _staticHeader,
            _lastRenderedHeaderLine,
            _lastRenderedHeaderAt,
          )
        ) {
          if (_blinkHeaderRow !== null) {
            process.stdout.write(
              `\x1b[${_blinkHeaderRow};1H\x1b[2K${_staticHeader}\n`,
            );
          } else {
            process.stdout.write(`\r\x1b[2K${_staticHeader}\n`);
          }
          _lastRenderedHeaderLine = _staticHeader;
          _lastRenderedHeaderAt = Date.now();
        }
        _blinkHeaderRow = null;
        _spinAnim = null;
      }

      // Print summaries below the header (skip ask_user — it renders its own UI)
      if (!batchOpts.skipSummaries) {
        const shownSummaries = batchSummaries.filter(
          (_, si) => !(prepared[si] && prepared[si].fnName === "ask_user"),
        );
        for (const s of shownSummaries) {
          if (
            _isImmediateDuplicateLine(
              s,
              _lastRenderedSummaryLine,
              _lastRenderedSummaryAt,
            )
          )
            continue;
          console.log(s);
          _lastRenderedSummaryLine = s;
          _lastRenderedSummaryAt = Date.now();
        }

        // Milestone tracking — linesBack no longer needed (append-only emit)
        const toolNames = prepared
          .filter((p) => p && p.fnName !== "ask_user")
          .map((p) => p.fnName);
        const ms = _milestone.record(0, toolNames, filesRead, filesModified);
        if (ms) _emitMilestone(ms);
      }

      // Count pre-execution blocks (canExecute=false with errorResult) toward consecutiveBlocks.
      // These are calls blocked BEFORE executeBatch by guards like SSH storm, plan mode, etc.
      // They're skipped in the main post-execution loop below, so without this count they never
      // contribute to the abort threshold — letting the model send infinite blocked batches.
      for (const prep of prepared) {
        if (prep.canExecute) continue; // executed — handled below
        if (!prep.errorResult) continue; // truly skipped (no errorResult) — don't count
        const preBlockContent =
          typeof prep.errorResult.content === "string"
            ? prep.errorResult.content
            : "";
        if (
          preBlockContent.startsWith("BLOCKED:") ||
          preBlockContent.startsWith("PLAN MODE:") ||
          preBlockContent.startsWith("PLAN PHASE:")
        ) {
          consecutiveBlocks++;
          if (consecutiveBlocks >= LOOP_ABORT_BLOCKS) {
            debugLog(
              `${C.red}  ✖ Loop abort: ${consecutiveBlocks} consecutive blocked calls (pre-execution) — model not heeding BLOCKED messages${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          }
        }
      }

      let _needsPostEditVerifyPrompt = false;
      // Track modified and read files
      for (let j = 0; j < prepared.length; j++) {
        const prep = prepared[j];
        if (!prep.canExecute) continue;
        const res = toolMessages[j].content;
        // Only inspect the first line — tool output may legitimately contain
        // "ERROR" or "CANCELLED" in matched content (e.g. grep finding log lines).
        // "EXIT" is the prefix used for non-zero bash exit codes (EXIT 1, EXIT ENOENT, etc.)
        // and must also be treated as an error for consecutive-error counting.
        const firstLine = res.split("\n")[0];
        const isOk =
          !firstLine.startsWith("ERROR") &&
          !firstLine.startsWith("CANCELLED") &&
          !firstLine.startsWith("Command failed") &&
          !firstLine.startsWith("EXIT");
        // Track edit_file failures (old_text not found) so re-read block can exempt targeted re-reads
        if (
          !isOk &&
          (prep.fnName === "edit_file" || prep.fnName === "patch_file") &&
          prep.args?.path
        ) {
          if (firstLine.includes("old_text not found")) {
            const prevCount = _sessionLastEditFailed.get(prep.args.path) || 0;
            _sessionLastEditFailed.set(prep.args.path, prevCount + 1);
          }
        }
        // Test-failure recovery: when a test/build command fails after edits, allow one
        // full re-read of each recently edited file so the model can diagnose broken output.
        // Without this, the model cannot see its own broken edit and invents ghost problems.
        if (
          !isOk &&
          prep.fnName === "bash" &&
          _sessionFileEditCounts.size > 0
        ) {
          const cmd = (prep.args?.command || "").toLowerCase();
          const isTestLike =
            /\b(test|jest|vitest|pytest|mocha|tsc|build|lint|eslint|check)\b/.test(
              cmd,
            );
          if (isTestLike) {
            for (const [editedPath] of _sessionFileEditCounts) {
              if (!_sessionLastEditFailed.has(editedPath)) {
                _sessionLastEditFailed.set(editedPath, 1);
                debugLog(
                  `${C.cyan}  ↩ Test failure — queuing recovery re-read: "${editedPath.split("/").pop()}"${C.reset}`,
                );
              }
            }
          }
        }
        // Track consecutive file-not-found errors — after 2+ misses, force search instead of guessing
        if (
          !isOk &&
          (prep.fnName === "read_file" || prep.fnName === "edit_file") &&
          /file not found|does not exist|ENOENT/i.test(firstLine)
        ) {
          _consecutiveFileNotFound++;
          if (_consecutiveFileNotFound >= 2) {
            debugLog(
              `${C.yellow}  ⚠ File-not-found streak: ${_consecutiveFileNotFound} consecutive misses — forcing search${C.reset}`,
            );
            const fnfHint = {
              role: "user",
              content:
                `[SYSTEM] ${_consecutiveFileNotFound} consecutive "File not found" errors. ` +
                `STOP guessing paths. Use search_files or glob_files to locate the correct file first, ` +
                `then read/edit the path returned by the search.`,
            };
            conversationMessages.push(fnfHint);
            apiMessages.push(fnfHint);
          }
        } else if (
          isOk &&
          (prep.fnName === "read_file" ||
            prep.fnName === "edit_file" ||
            prep.fnName === "search_files" ||
            prep.fnName === "glob_files")
        ) {
          _consecutiveFileNotFound = 0; // reset on successful file access or search
        }
        if (isOk && prep.fnName === "write_file" && prep.args?.path) {
          // Warn when a temp/test/demo file is created outside the tests/ directory.
          // These files are typically written, run once, then deleted — wasting tool calls
          // and leaving orphans if the session is interrupted.
          const wfBase = prep.args.path.split("/").pop();
          const wfInTestsDir =
            prep.args.path.includes("/tests/") ||
            prep.args.path.includes("\\tests\\");
          const isTempPattern = /^(test_|demo_|temp_|tmp_|scratch_)/.test(
            wfBase,
          );
          if (isTempPattern && !wfInTestsDir) {
            debugLog(
              `${C.yellow}  ⚠ Temp file: "${wfBase}" — delete with bash rm when done to keep the workspace clean${C.reset}`,
            );
            const tempHint = {
              role: "user",
              content: `[HINT] "${prep.args.path}" looks like a temporary test/demo file. Delete it with bash("rm ${prep.args.path}") as soon as you're done — orphaned temp files count against session quality.`,
            };
            conversationMessages.push(tempHint);
            apiMessages.push(tempHint);
          }
        }
        if (
          isOk &&
          ["write_file", "edit_file", "patch_file"].includes(prep.fnName)
        ) {
          if (prep.args && prep.args.path) {
            _sessionLastEditFailed.delete(prep.args.path); // clear failure flag on success
            filesModified.add(prep.args.path);
            // TODO observer: mark plan items as done when their file gets edited
            for (const todo of _planTodos) {
              if (
                !todo.done &&
                prep.args.path.endsWith(todo.file.split("/").pop())
              ) {
                todo.done = true;
                debugLog(`${C.green}  ✓ TODO done: ${todo.file}${C.reset}`);
              }
            }
            const count = _incLoopCount(fileEditCounts, prep.args.path);
            const shortPath = prep.args.path.split("/").slice(-2).join("/");
            if (count === LOOP_WARN_EDITS) {
              debugLog(
                `${C.yellow}  ⚠ Loop warning: "${shortPath}" edited ${count}× — possible edit loop${C.reset}`,
              );
              const loopWarning = {
                role: "user",
                content: `[SYSTEM WARNING] "${prep.args.path}" edited ${count}×. One more edit max, then move on.`,
              };
              conversationMessages.push(loopWarning);
              apiMessages.push(loopWarning);
            } else if (count >= LOOP_ABORT_EDITS) {
              debugLog(
                `${C.red}  ✖ Loop abort: "${shortPath}" edited ${count}× — aborting to prevent runaway loop${C.reset}`,
              );
              if (taskProgress) {
                taskProgress.stop();
                taskProgress = null;
              }
              setOnChange(null);
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
                { suppressHint: true },
              );
              saveNow(conversationMessages);
              return;
            }
            if (!(_phaseEnabled && _currentPhase === "verify")) {
              _postEditVerifyPending = true;
              _postEditVerifyNudges = 0;
              _needsPostEditVerifyPrompt = true;
            }
          }
        }
        // ─── Investigation cap: force implementation after too many read-only calls ───
        // When the model reads files, searches, and SSHes without ever editing, it's
        // stuck in an investigation loop. After INVESTIGATION_CAP calls, inject a hard
        // "stop investigating, implement now" message.
        // Reset plan-phase block counter when a tool actually executes
        if (isOk && prep.canExecute && _phaseEnabled) {
          _planPhaseBlockedCount = 0;
        }
        if (
          isOk &&
          prep.canExecute &&
          !(_phaseEnabled && _currentPhase === "plan")
        ) {
          const READ_ONLY_TOOLS = [
            "read_file",
            "grep",
            "search_files",
            "glob",
            "list_directory",
            "ssh_exec",
            "find_files",
          ];
          const EDIT_TOOLS = ["write_file", "edit_file", "patch_file"];
          if (EDIT_TOOLS.includes(prep.fnName)) {
            _readOnlyCallsSinceEdit = 0; // reset on successful edit
            _investigationCapFired = false; // allow re-investigation after an edit
            _readsSinceCapFired = 0;
            _editsMadeThisSession++; // track how many edits have been made
            // Reset re-read guard for the edited file so the model can verify
            // the edit once without hitting the "already read" block.
            const _editedPath = prep.args?.path || prep.args?.file_path;
            if (_editedPath) {
              if (prep.fnName === "write_file") {
                _freshlyWrittenFiles.add(_editedPath);
                _sessionFileReadCounts.delete(_editedPath);
                _sessionFileReadRanges.delete(_editedPath);
                _editedFilesNotReread.delete(_editedPath);
              } else {
                _freshlyWrittenFiles.delete(_editedPath);
                _setLoopCount(_sessionFileReadCounts, _editedPath, 1);
                _sessionFileReadRanges.delete(_editedPath);
                _editedFilesNotReread.add(_editedPath); // map-first: flag file as stale until re-read
              }
            }
          } else if (READ_ONLY_TOOLS.includes(prep.fnName)) {
            _readOnlyCallsSinceEdit++;
            if (_investigationCapFired) _readsSinceCapFired++;
            if (
              _phaseEnabled &&
              _currentPhase === "implement" &&
              prep.fnName === "read_file"
            ) {
              const _readPath = prep.args?.path || prep.args?.file_path || "";
              if (_readPath && _freshlyWrittenFiles.has(_readPath)) {
                const creationNudge = {
                  role: "user",
                  content:
                    `[SYSTEM] You just created and re-read "${_readPath}". ` +
                    `Do NOT analyze further. Apply the requested refactor now with edit_file.`,
                };
                conversationMessages.push(creationNudge);
                apiMessages.push(creationNudge);
                debugLog(
                  `${C.yellow}  ⚠ Fresh-write nudge: ${_readPath} — refactor directly after re-read${C.reset}`,
                );
              }
            }
            // TODO observer: nudge model to edit (not re-read) files from the plan
            if (
              _phaseEnabled &&
              _currentPhase === "implement" &&
              prep.fnName === "read_file" &&
              _planTodos.length > 0
            ) {
              const _readPath = prep.args?.path || prep.args?.file_path || "";
              const _matchingTodo = _planTodos.find(
                (t) => !t.done && _readPath.endsWith(t.file.split("/").pop()),
              );
              if (_matchingTodo) {
                const nudge = {
                  role: "user",
                  content:
                    `[TODO OBSERVER] You already analyzed "${_matchingTodo.file}" in the plan phase. ` +
                    `Action: ${_matchingTodo.action}\n` +
                    `Do NOT re-read — apply the edit directly with edit_file.`,
                };
                conversationMessages.push(nudge);
                apiMessages.push(nudge);
                debugLog(
                  `${C.yellow}  ⚠ TODO nudge: ${_matchingTodo.file} — already analyzed, edit directly${C.reset}`,
                );
              }
            }
            if (
              _phaseEnabled &&
              _currentPhase === "implement" &&
              _postEditVerifyPending &&
              _postEditVerifyNudges < 1
            ) {
              _postEditVerifyNudges++;
              _needsPostEditVerifyPrompt = true;
            }
          }
          if (_phaseEnabled && _currentPhase === "verify") {
            _verifyToolCalls++;
          }
          if (isOk && _isVerificationCommandCall(prep)) {
            const cmd = String(prep.args?.command || "").trim();
            if (cmd) verificationCommandsRun.push(cmd.slice(0, 160));
            _postEditVerifyPending = false;
            _postEditVerifyNudges = 0;
          }
          // After the first file edit, tighten the post-edit investigation cap to
          // POST_EDIT_CAP (5 calls). This prevents the model from re-investigating
          // after already making changes — it should verify the edit and move on.
          // Before any edit, use the full INVESTIGATION_CAP (12 calls).
          // In fix phase (root cause already found) use a tight cap of 3 reads.
          const POST_EDIT_CAP = _profile.postEditCap;
          // Creation tasks: no debugging needed, agent should write almost immediately.
          // Cap: 4 reads before first edit (just enough to check existing structure),
          // then 2 reads after any edit (verify once, then keep building).
          // In implement phase the model already has a plan — cap pre-edit reads
          // to 6 (instead of 12) to prevent broad re-investigation.
          const _phaseAwareCap =
            _phaseEnabled && _currentPhase === "implement"
              ? Math.min(INVESTIGATION_CAP, 10)
              : INVESTIGATION_CAP;
          const _effectiveCap = _rootCauseDetected
            ? 8
            : _isSynthesisHeavyPrompt
              ? _editsMadeThisSession > 0
                ? 4
                : 6
              : _isCreationTask
                ? _editsMadeThisSession > 0
                  ? 6
                  : 10
                : _editsMadeThisSession > 0
                  ? POST_EDIT_CAP
                  : _phaseAwareCap;
          // After the cap has already fired, hard-block further reads when:
          // 1. Root cause detected — one nudge is not enough when the issue is already pinpointed
          // 2. Creation task with edits already made — agent should be building, not reading
          // 3. Grace period exhausted (6 reads after cap) — prevents infinite investigation spirals
          //    where the model ignores the soft cap warning and reads until context/timeout
          const INVESTIGATION_GRACE = 6; // reads allowed after cap fires before hard-block
          const _hardBlockActive =
            !_phaseEnabled &&
            _investigationCapFired &&
            ((_rootCauseDetected &&
              _readsSinceCapFired >= INVESTIGATION_GRACE) ||
              (_isCreationTask &&
                _editsMadeThisSession >= 3 &&
                _readsSinceCapFired >= INVESTIGATION_GRACE) ||
              _readsSinceCapFired >= INVESTIGATION_GRACE);
          // Two-stage time-based nudge: soft at 40%, hard at 65% of task timeout
          if (
            _timeNudgeCount < 2 &&
            !_investigationCapFired &&
            _readOnlyCallsSinceEdit >= 3 &&
            filesModified.size === 0
          ) {
            const _taskTimeout =
              parseInt(process.env.NEX_TASK_TIMEOUT_MS, 10) || 0;
            const _elapsed = Date.now() - startTime;
            const _threshold = _timeNudgeCount === 0 ? 0.4 : 0.65;
            if (_taskTimeout > 0 && _elapsed > _taskTimeout * _threshold) {
              _timeNudgeCount++;
              const _mins = Math.round(_elapsed / 60000);
              const _pct = Math.round((_elapsed / _taskTimeout) * 100);
              debugLog(
                `${C.yellow}  ⚠ Time nudge #${_timeNudgeCount}: ${_mins}m elapsed (${_pct}%), ${_readOnlyCallsSinceEdit} reads, 0 edits${C.reset}`,
              );
              const _timeMsg = {
                role: "user",
                content:
                  _timeNudgeCount === 1
                    ? `[SYSTEM] ${_pct}% of available time used and no files edited yet. Start implementing now using edit_file or write_file — you have enough context.`
                    : `[SYSTEM] ${_pct}% of time used, still no edits. You MUST write code NOW. Use edit_file or write_file immediately — any further reading will be blocked.`,
              };
              conversationMessages.push(_timeMsg);
              apiMessages.push(_timeMsg);
            }
          }
          if (_hardBlockActive && READ_ONLY_TOOLS.includes(prep.fnName)) {
            const _blockReason = _rootCauseDetected
              ? `root cause already identified (${_rootCauseSummary})`
              : _readsSinceCapFired >= INVESTIGATION_GRACE
                ? `${_readOnlyCallsSinceEdit} consecutive reads without an edit`
                : `${_editsMadeThisSession} file edit(s) already made`;
            debugLog(
              `${C.red}  ✖ Blocked read-only tool: cap fired, ${_blockReason}${C.reset}`,
            );
            prep.canExecute = false;
            prep.errorResult = {
              role: "tool",
              content: _rootCauseDetected
                ? `BLOCKED: root cause already identified (${_rootCauseSummary}). Use edit_file to fix the issue — do not read more files.`
                : _isCreationTask
                  ? `BLOCKED: files already written — continue with write_file or edit_file to finish the remaining tasks. Do not read more files.`
                  : _readsSinceCapFired >= INVESTIGATION_GRACE
                    ? `BLOCKED: You have read ${_readOnlyCallsSinceEdit} files without making any edits. Stop investigating and either implement a fix with edit_file/write_file, or write your diagnosis as text output. Do not read more files.`
                    : `BLOCKED: ${_editsMadeThisSession} file edit(s) already made and post-edit investigation cap reached. The fix is in place. Do not read more files — proceed with the task.`,
              tool_call_id: prep.callId,
            };
          } else if (
            _readOnlyCallsSinceEdit >= _effectiveCap &&
            !_investigationCapFired
          ) {
            _investigationCapFired = true;
            if (_isSynthesisHeavyPrompt) _synthesisEvidenceReady = true;
            debugLog(
              `${C.yellow}  ⚠ Investigation cap: ${_readOnlyCallsSinceEdit} read-only calls without an edit — forcing implementation${C.reset}`,
            );
            // Phase transition: plan → implement (model switch)
            if (_phaseEnabled && _currentPhase === "plan") {
              const _lastAssistant = [...apiMessages]
                .reverse()
                .find((m) => m.role === "assistant");
              const _summary =
                typeof _lastAssistant?.content === "string"
                  ? _lastAssistant.content
                  : "";
              const phaseMsg = await _transitionPhase("implement", _summary);
              if (phaseMsg) {
                conversationMessages.push(phaseMsg);
                apiMessages.push(phaseMsg);
                i = 0;
                iterLimit = getPhaseBudget("implement");
              }
            }
            let _capContent;
            if (_rootCauseDetected) {
              _capContent = `[SYSTEM] Root cause was already identified (${_rootCauseSummary}). Edit the file now — do not read more files.`;
            } else if (_isSynthesisHeavyPrompt) {
              _capContent =
                "[SYSTEM] You have enough evidence to write the requested summary/document now. Use write_file or edit_file to produce the deliverable, and stop reading more files unless a required section is still unsupported.";
            } else if (_sshBlockedAfterStorm) {
              _capContent =
                "[SYSTEM] SSH temporarily paused. Summarize your findings and state the likely diagnosis. Do NOT ask the user to run commands — SSH re-enables after your summary.";
            } else {
              _capContent =
                "[SYSTEM] You have read enough files. Now implement your fix using edit_file.";
            }
            const capMsg = {
              role: "user",
              content: _capContent,
            };
            conversationMessages.push(capMsg);
            apiMessages.push(capMsg);
          }
        }
        // sed -n is now blocked in the pre-batch phase — no post-execution action needed here
        // Bash/SSH command loop detection — tool is named 'bash', not 'bash_exec'
        if (
          (prep.fnName === "bash" || prep.fnName === "ssh_exec") &&
          prep.args &&
          prep.args.command
        ) {
          const cmdKey = prep.args.command
            .replace(/\d+/g, "N")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 100);
          const bashCount = _incLoopCount(bashCmdCounts, cmdKey);
          if (bashCount === LOOP_WARN_BASH) {
            debugLog(
              `${C.yellow}  ⚠ Loop warning: same bash command run ${bashCount}× — possible debug loop${C.reset}`,
            );
            const bashWarning = {
              role: "user",
              content: `[SYSTEM WARNING] Same bash command ${bashCount}×. Debug loop detected — try a different approach.`,
            };
            conversationMessages.push(bashWarning);
            apiMessages.push(bashWarning);
          } else if (bashCount >= LOOP_ABORT_BASH) {
            debugLog(
              `${C.red}  ✖ Loop abort: same bash command run ${bashCount}× — aborting runaway debug loop${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          }
        }
        // SSH storm detection — cap consecutive ssh_exec calls regardless of command uniqueness.
        // The existing bash-loop detector only fires on *similar* commands; an agent running 16
        // different grep/cat patterns via ssh_exec bypasses it while still burning context.
        // ALL SSH calls count toward storm limit — failed calls (grep EXIT 1, connection
        // errors) still waste tool calls and indicate grep archaeology / search loops.
        // Previously only successful calls counted, which let the agent bypass the storm
        // cap by running greps that return no matches (EXIT 1 → not counted).
        if (prep.fnName === "ssh_exec") {
          _sessionConsecutiveSshCalls++;
          // Repeated-error early warning — fires before the 10-call storm threshold.
          // When the model retries variations of a failing command (e.g. grep regex
          // not supported by the remote shell), every result carries the same error
          // message. Detect this by fingerprinting the first non-empty, non-warning
          // line of the SSH result that looks like an error. After 3 consecutive SSH
          // calls returning the same error, inject a warning to change approach.
          {
            const SSH_SAME_ERROR_WARN = 3; // warn after 3 calls with identical error
            const _sshResultContent = toolMessages[j]?.content ?? "";
            // Extract the first line that looks like an error (skip SSH banner lines
            // starting with "**" which are connection warnings, not command errors).
            const _errorLine =
              _sshResultContent
                .split("\n")
                .map((l) => l.trim())
                .find(
                  (l) =>
                    l.length > 0 &&
                    !l.startsWith("**") &&
                    (l.startsWith("EXIT") ||
                      /^[\w./-]+:\s/.test(l) || // tool error: "grep: ..." / "sed: ..."
                      l.startsWith("bash:") ||
                      l.startsWith("sh:")),
                ) ?? "";
            if (_errorLine) {
              if (_errorLine === _sshLastErrorFingerprint) {
                _sshConsecutiveSameErrors++;
              } else {
                _sshLastErrorFingerprint = _errorLine;
                _sshConsecutiveSameErrors = 1;
              }
              if (
                _sshConsecutiveSameErrors === SSH_SAME_ERROR_WARN &&
                !_sshBlockedAfterStorm
              ) {
                debugLog(
                  `${C.yellow}  ⚠ SSH repeated-error: "${_errorLine.slice(0, 60)}" returned ${_sshConsecutiveSameErrors}× — nudging to change approach${C.reset}`,
                );
                const _repeatErrMsg = {
                  role: "user",
                  content: `[SYSTEM WARNING] The last ${_sshConsecutiveSameErrors} SSH commands all failed with the same error: "${_errorLine}". Retrying variants of the same command will not help. Switch to a different approach to accomplish the task (e.g. use a different tool, read a local file, or change the command syntax entirely).`,
                };
                conversationMessages.push(_repeatErrMsg);
                apiMessages.push(_repeatErrMsg);
              }
            } else {
              // Successful result (no error line) — reset the same-error streak
              _sshLastErrorFingerprint = "";
              _sshConsecutiveSameErrors = 0;
            }
          }
          if (_sessionConsecutiveSshCalls >= SSH_STORM_ABORT) {
            debugLog(
              `${C.red}  ✖ SSH storm abort: ${_sessionConsecutiveSshCalls} consecutive ssh_exec calls — aborting${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          } else if (_sessionConsecutiveSshCalls === SSH_STORM_WARN) {
            // Pre-compress before injecting warning — 5 SSH results fill context fast,
            // and adding the warning on top can tip a full context into a 400 cascade.
            {
              const _allTools = getAllToolDefinitions();
              const { messages: _c } = forceCompress(apiMessages, _allTools);
              apiMessages = _c;
            }
            _sshBlockedAfterStorm = true; // block all further SSH calls until agent synthesizes
            _sshStormCount++;
            debugLog(
              `${C.yellow}  ⚠ SSH storm warning (#${_sshStormCount}): ${_sessionConsecutiveSshCalls} consecutive ssh_exec calls — blocking further SSH${C.reset}`,
            );
            const _stormMsg = _rootCauseDetected
              ? `[SYSTEM WARNING] ${_sessionConsecutiveSshCalls} consecutive SSH calls. Root cause identified (${_rootCauseSummary}). Read the file that needs fixing, then edit it.`
              : `[SYSTEM WARNING] ${_sessionConsecutiveSshCalls} consecutive SSH calls — SSH temporarily paused for synthesis. Summarize what you found and state the likely diagnosis. Do NOT ask the user to run commands or provide logs. SSH will be re-enabled after your summary so you can continue.`;
            const sshStormWarning = {
              role: "user",
              content: _stormMsg,
            };
            conversationMessages.push(sshStormWarning);
            apiMessages.push(sshStormWarning);
          }
        } else if (prep.canExecute) {
          // Only reset on tools that actually executed — blocked tools (canExecute=false)
          // don't constitute real work and shouldn't reset the consecutive SSH counter.
          // Without this, a blocked bash/read_file lets the agent bypass the storm cap
          // by doing nothing and then immediately issuing another 7 SSH calls.
          _sessionConsecutiveSshCalls = 0;
        }
        // Consecutive same-error detection for local bash — mirrors the ssh_exec block above.
        // Fires when the model retries variants of a failing pipe (e.g. curl | grep -oP with
        // a regex the local shell rejects) and every attempt returns the same error line.
        if (prep.fnName === "bash" && prep.canExecute) {
          const BASH_SAME_ERROR_WARN = 3;
          const _bashResult = toolMessages[j]?.content ?? "";
          const _bashErrorLine =
            _bashResult
              .split("\n")
              .map((l) => l.trim())
              .find(
                (l) =>
                  l.length > 0 &&
                  (l.startsWith("EXIT") ||
                    /^[\w./-]+:\s/.test(l) || // tool error: "grep: ..." / "sed: ..."
                    l.startsWith("bash:") ||
                    l.startsWith("sh:")),
              ) ?? "";
          if (_bashErrorLine) {
            if (_bashErrorLine === _bashLastErrorFingerprint) {
              _bashConsecutiveSameErrors++;
            } else {
              _bashLastErrorFingerprint = _bashErrorLine;
              _bashConsecutiveSameErrors = 1;
            }
            if (_bashConsecutiveSameErrors === BASH_SAME_ERROR_WARN) {
              debugLog(
                `${C.yellow}  ⚠ Bash repeated-error: "${_bashErrorLine.slice(0, 60)}" returned ${_bashConsecutiveSameErrors}× — nudging to change approach${C.reset}`,
              );
              const _bashRepeatMsg = {
                role: "user",
                content: `[SYSTEM WARNING] The last ${_bashConsecutiveSameErrors} bash commands all failed with the same error: "${_bashErrorLine}". Retrying variants of the same command will not help. Switch to a completely different approach (e.g. use a different tool, change the command syntax, or use ssh_exec to run the command on the remote server instead).`,
              };
              conversationMessages.push(_bashRepeatMsg);
              apiMessages.push(_bashRepeatMsg);
            }
          } else {
            // Success — reset streak
            _bashLastErrorFingerprint = "";
            _bashConsecutiveSameErrors = 0;
          }
        }
        // ─── Post-commit detection ──────────────────────────────────────────────
        // When a bash command successfully runs `git commit`, set a flag so we can
        // block redundant post-commit verification (git status/diff/log).
        if (
          prep.fnName === "bash" &&
          prep.canExecute &&
          !_commitDetected &&
          prep.args?.command
        ) {
          const _bashOut = toolMessages[j]?.content ?? "";
          const isCommitCmd = /git\s+commit\b/.test(prep.args.command);
          const commitSucceeded =
            isCommitCmd &&
            !_bashOut.startsWith("EXIT") &&
            !_bashOut.startsWith("ERROR") &&
            (/\[\S+\s+[a-f0-9]+\]/.test(_bashOut) ||
              _bashOut.includes("files changed") ||
              _bashOut.includes("file changed") ||
              _bashOut.includes("insertions(+)") ||
              _bashOut.includes("create mode"));
          if (commitSucceeded) {
            _commitDetected = true;
            _postCommitGitCalls = 0;
            debugLog(
              `${C.green}  ✓ Git commit detected — post-commit verification cap active (max 2 git status/diff/log)${C.reset}`,
            );
            const commitMsg = {
              role: "user",
              content:
                "[SYSTEM] ✓ Git commit succeeded. Your changes are committed. " +
                "Do NOT run further git status / git diff / git log calls — the commit is done. " +
                "Write your final summary and stop. Running extra verification commands wastes tool calls and hurts session quality.",
            };
            conversationMessages.push(commitMsg);
            apiMessages.push(commitMsg);
          }
        }
        // ─── Post-commit git verification blocking ──────────────────────────────
        // After a commit is detected, block git status/diff/log after 2 calls.
        if (_commitDetected && prep.fnName === "bash" && prep.args?.command) {
          const gitVerifyPattern = /git\s+(status|diff|log|show)\b/;
          if (gitVerifyPattern.test(prep.args.command)) {
            _postCommitGitCalls++;
            if (_postCommitGitCalls > 2) {
              debugLog(
                `${C.yellow}  ⚠ Post-commit git verification blocked (call ${_postCommitGitCalls})${C.reset}`,
              );
              const gitBlockMsg = {
                role: "user",
                content:
                  "[SYSTEM] ⚠ STOP: You already ran " +
                  (_postCommitGitCalls - 1) +
                  " git verification commands after committing. " +
                  "The commit is confirmed. Write your final summary NOW and do not make any more tool calls.",
              };
              conversationMessages.push(gitBlockMsg);
              apiMessages.push(gitBlockMsg);
            }
          }
        }
        // Track files found in grep results for cross-project awareness.
        // When grep finds matches, extract file paths so _extractPlanTodos and
        // the graceful-exit check know that actionable targets were discovered.
        if (
          isOk &&
          prep.fnName === "grep" &&
          res &&
          !res.startsWith("(no matches)")
        ) {
          const lines = res.split("\n");
          for (const line of lines) {
            // Grep output format: "filepath:linenum:content" or just "filepath"
            const colonIdx = line.indexOf(":");
            if (colonIdx > 0) {
              const fp = line.substring(0, colonIdx);
              if (fp.startsWith("/") && !fp.includes(" "))
                _sessionGrepFoundFiles.add(fp);
            } else if (line.startsWith("/") && !line.includes(" ")) {
              _sessionGrepFoundFiles.add(line.trim());
            }
          }
        }
        // Consecutive empty-search nudge — if all local searches return no results,
        // the target may be on a remote server; suggest SSH before stagnation kills the run.
        {
          const _isSearchTool = [
            "grep",
            "search_files",
            "glob",
            "glob_files",
          ].includes(prep.fnName);
          const _isEmpty =
            _isSearchTool &&
            isOk &&
            res &&
            (res.startsWith("(no matches)") ||
              res.trim() === "" ||
              /^No matches found/.test(res.trim()) ||
              /^\(0 results\)/.test(res.trim()));
          if (_isEmpty) {
            _consecutiveEmptySearches++;
            if (_consecutiveEmptySearches === 3) {
              debugLog(
                `${C.yellow}  ⚠ 3 consecutive empty local searches — injecting SSH pivot hint${C.reset}`,
              );
              const sshHint = {
                role: "user",
                content:
                  "[SYSTEM NOTE] 3 consecutive local searches returned no results. " +
                  "The target files may be on a remote server. " +
                  "If you have an SSH profile configured for this project's server, use ssh_exec to search there (e.g. ssh_exec with grep). " +
                  "Do not keep searching locally if the code does not exist on this machine.",
              };
              conversationMessages.push(sshHint);
              apiMessages.push(sshHint);
            }
          } else if (_isSearchTool && isOk && res && res.trim().length > 0) {
            _consecutiveEmptySearches = 0; // reset on any non-empty result
          }
        }
        // Grep pattern loop detection — repeated identical patterns waste context
        if (isOk && prep.fnName === "grep" && prep.args && prep.args.pattern) {
          const patKey = `${prep.args.pattern}|${prep.args.path || ""}`;
          const grepCount = _incLoopCount(grepPatternCounts, patKey);
          if (grepCount === LOOP_WARN_GREP) {
            debugLog(
              `${C.yellow}  ⚠ Loop warning: grep pattern "${prep.args.pattern.slice(0, 40)}" run ${grepCount}× — possible search loop${C.reset}`,
            );
            const grepWarning = {
              role: "user",
              content: `[SYSTEM WARNING] Same grep pattern ${grepCount}×. Results unchanged — use existing data or try different pattern.`,
            };
            conversationMessages.push(grepWarning);
            apiMessages.push(grepWarning);
          } else if (grepCount >= LOOP_ABORT_GREP) {
            debugLog(
              `${C.red}  ✖ Loop abort: grep pattern run ${grepCount}× — aborting runaway search loop${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          }
          // Per-file grep loop detection — multiple different patterns on same file
          // This catches "search flood" where the agent greps the same file repeatedly
          // with varying patterns instead of reading it once and using the context.
          // If the file was already fully read (unbounded), warn on the very first grep
          // since all its content is already in context — searching it again is redundant.
          if (prep.args.path) {
            const fileGrepCount = _incLoopCount(grepFileCounts, prep.args.path);
            const fileAlreadyRead =
              _getLoopCount(fileReadCounts, prep.args.path) >= 1;
            const warnThreshold = fileAlreadyRead ? 1 : LOOP_WARN_GREP_FILE;
            if (fileGrepCount === warnThreshold) {
              const shortPath = prep.args.path.split("/").slice(-2).join("/");
              debugLog(
                `${C.yellow}  ⚠ Loop warning: "${shortPath}" grepped ${fileGrepCount}× with different patterns — context flood risk${C.reset}`,
              );
              const fileGrepWarning = {
                role: "user",
                content: fileAlreadyRead
                  ? `[SYSTEM NOTE] "${prep.args.path}" was already fully read — its content is in context. Grepping it again is redundant; use the context you already have.`
                  : `[SYSTEM NOTE] "${prep.args.path}" grepped ${fileGrepCount}× — use the search results already in context instead of searching again.`,
              };
              conversationMessages.push(fileGrepWarning);
              apiMessages.push(fileGrepWarning);
            }
          }
        }
        // Glob/search_files loop detection — repeated identical patterns waste context
        if (
          isOk &&
          (prep.fnName === "glob" ||
            prep.fnName === "glob_files" ||
            prep.fnName === "search_files") &&
          prep.args
        ) {
          if (res && !res.startsWith("(no matches)")) {
            const lines = res.split("\n");
            for (const line of lines) {
              if (line.startsWith("/") && !line.includes(" ")) {
                _sessionGlobFoundFiles.add(line.trim());
              } else if (!line.includes(":") && !line.startsWith("[")) {
                // handles relative paths returned by glob
                _sessionGlobFoundFiles.add(line.trim());
              }
            }
          }

          const patKey =
            prep.args.pattern || prep.args.query || prep.args.path || "";
          const globCount = _incLoopCount(globSearchCounts, patKey);
          if (globCount === LOOP_WARN_GLOB) {
            debugLog(
              `${C.yellow}  ⚠ Loop warning: glob pattern "${patKey.slice(0, 40)}" run ${globCount}× — possible search loop${C.reset}`,
            );
            const globWarning = {
              role: "user",
              content: `[SYSTEM WARNING] Same glob/search pattern ${globCount}×. Results unchanged — use existing data or try different pattern.`,
            };
            conversationMessages.push(globWarning);
            apiMessages.push(globWarning);
          } else if (globCount >= LOOP_ABORT_GLOB) {
            debugLog(
              `${C.red}  ✖ Loop abort: glob pattern run ${globCount}× — aborting runaway search loop${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          }
          // Core-term similarity detection — catch varied glob patterns targeting the same thing
          // e.g. "**/guitar-mentor-skill.js", "**/guitar-mentor-skill*", "skills/guitar-mentor/**/*"
          // all share "guitar-mentor" as core term. 3+ different patterns → warn, 4+ → block.
          const coreTokens = patKey
            .replace(/\*+/g, " ")
            .replace(/[{}()\[\],.\/\\]/g, " ")
            .split(/\s+/)
            .filter(
              (t) =>
                t.length >= 4 &&
                !/^\.(js|ts|py|json|md|yaml|yml|txt|css|html|sh)$/.test(t),
            );
          for (const token of coreTokens) {
            const lc = token.toLowerCase();
            if (!_sessionGlobCoreTerms.has(lc))
              _sessionGlobCoreTerms.set(lc, new Set());
            const patternSet = _sessionGlobCoreTerms.get(lc);
            patternSet.add(patKey);
            if (patternSet.size === GLOB_CORE_BLOCK) {
              debugLog(
                `${C.red}  ✖ Glob core-term block: ${patternSet.size} different patterns all searching for "${lc}" — search loop${C.reset}`,
              );
              const coreBlockMsg = {
                role: "user",
                content: `[SYSTEM WARNING] You have searched for "${lc}" using ${patternSet.size} different glob patterns. This is a search loop — the file you are looking for likely does not exist. Stop searching and work with the files you have already found, or ask the user for clarification.`,
              };
              conversationMessages.push(coreBlockMsg);
              apiMessages.push(coreBlockMsg);
            } else if (patternSet.size === GLOB_CORE_WARN) {
              debugLog(
                `${C.yellow}  ⚠ Glob core-term warning: ${patternSet.size} different patterns searching for "${lc}"${C.reset}`,
              );
              const coreWarnMsg = {
                role: "user",
                content: `[SYSTEM WARNING] ${patternSet.size} different glob patterns all target "${lc}". If previous searches returned no results, the file probably does not exist — stop searching and proceed with available information.`,
              };
              conversationMessages.push(coreWarnMsg);
              apiMessages.push(coreWarnMsg);
            }
          }
        }
        // Health-check stop signal — inject strong stop instruction when a dedicated
        // health/status check command returns {"valid":true}. Only fires when the
        // command itself is a health-check (contains health, status, check, ping,
        // validate, or /health / /status patterns) to avoid false positives from
        // log tails and greps that happen to contain "valid":true in their output.
        const _cmdStr = (
          prep.args?.command ||
          prep.args?.cmd ||
          prep.args?.script ||
          ""
        ).toLowerCase();
        const _isHealthCheckCmd =
          /\b(health|healthcheck|health-check|status|check|ping|validate|alive|ready)\b/.test(
            _cmdStr,
          ) || /\/(health|status|ping|ready|alive)\b/.test(_cmdStr);
        if (
          isOk &&
          (prep.fnName === "bash" || prep.fnName === "ssh_exec") &&
          _isHealthCheckCmd &&
          res.includes('"valid":true')
        ) {
          // Pre-compress before injecting the STOP message: if context is already at
          // ≥60% after the tool result was appended, adding another message would push
          // it over the limit and trigger a 400 cascade on the next LLM call.
          {
            const _allToolsStop = getAllToolDefinitions();
            const _stopCtx = getUsage(apiMessages, _allToolsStop);
            if (_stopCtx.percentage >= 60) {
              const { messages: _compressed, tokensRemoved: _freed } =
                forceCompress(apiMessages, _allToolsStop);
              if (_freed > 0) {
                apiMessages = _compressed;
                console.log(
                  `${C.dim}  [pre-stop-compress — ~${_freed} tokens freed before STOP injection, now ${Math.round(getUsage(apiMessages, _allToolsStop).percentage)}%]${C.reset}`,
                );
              }
            }
          }
          const stopMsg = {
            role: "user",
            content:
              '[SYSTEM STOP] Tool result contains {"valid":true}. The token/service is valid and reachable. STOP all further investigation immediately. Report to the user that the token is valid, the service is healthy, and no fix is needed. Do NOT read any more log files.',
          };
          conversationMessages.push(stopMsg);
          apiMessages.push(stopMsg);
          console.log(
            `${C.cyan}  ✓ Health-check stop signal detected — injecting STOP instruction${C.reset}`,
          );
        }
        // Bash/ssh_exec file-write detection — track when shell commands modify files
        // so phase transitions (implement→verify) and early exit work even when the
        // model uses bash/sed/tee/cp instead of write_file/edit_file.
        if (
          isOk &&
          (prep.fnName === "bash" || prep.fnName === "ssh_exec") &&
          _cmdStr
        ) {
          const _bashWritePattern =
            /\bsed\s+-[ie]\b|\btee\b|\bcp\b|\bmv\b|\bpatch\b|\bdd\b|>\s*\S|\becho\b.*>|\bcat\b.*>|\bprintf\b.*>|\bpython[23]?\b.*open\b.*['"'w]|\bnpm\b.*run\b|\byarn\b.*run\b/;
          if (_bashWritePattern.test(_cmdStr)) {
            _bashModifiedFiles++;
            debugLog(
              `${C.dim}  [bash write detected: _bashModifiedFiles=${_bashModifiedFiles}]${C.reset}`,
            );
          }
        }
        // Consecutive BLOCKED tool call detection — model ignoring block messages
        const wasBlocked = res.startsWith("BLOCKED:");
        if (wasBlocked) {
          consecutiveBlocks++;
          if (consecutiveBlocks >= LOOP_ABORT_BLOCKS) {
            debugLog(
              `${C.red}  ✖ Loop abort: ${consecutiveBlocks} consecutive blocked calls — model not heeding BLOCKED messages${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          }
        } else {
          consecutiveBlocks = 0; // reset on any non-blocked result
        }
        // Consecutive error detection
        if (!isOk) {
          consecutiveErrors++;
          if (consecutiveErrors === LOOP_WARN_ERRORS) {
            debugLog(
              `${C.yellow}  ⚠ Loop warning: ${consecutiveErrors} consecutive tool errors — possible stuck loop${C.reset}`,
            );
            const errWarning = {
              role: "user",
              content: `[SYSTEM WARNING] ${consecutiveErrors} consecutive errors. Stuck loop — try fundamentally different approach or declare done.`,
            };
            conversationMessages.push(errWarning);
            apiMessages.push(errWarning);
          } else if (consecutiveErrors >= LOOP_ABORT_ERRORS) {
            debugLog(
              `${C.red}  ✖ Loop abort: ${consecutiveErrors} consecutive errors — aborting stuck loop${C.reset}`,
            );
            if (taskProgress) {
              taskProgress.stop();
              taskProgress = null;
            }
            setOnChange(null);
            _printResume(
              totalSteps,
              toolCounts,
              filesModified,
              filesRead,
              startTime,
              { suppressHint: true },
            );
            saveNow(conversationMessages);
            return;
          }
        } else {
          consecutiveErrors = 0; // reset on success
          progressMadeThisPass = true;
        }
        if (isOk && prep.fnName === "read_file") {
          if (prep.args && prep.args.path) {
            filesRead.add(prep.args.path);
            if (
              filesModified.has(prep.args.path) ||
              _freshlyWrittenFiles.has(prep.args.path) ||
              _editedFilesNotReread.has(prep.args.path)
            ) {
              verificationReadsRun.push(prep.args.path);
              _postEditVerifyPending = false;
              _postEditVerifyNudges = 0;
            }
            _freshlyWrittenFiles.delete(prep.args.path);
            _editedFilesNotReread.delete(prep.args.path); // map-first: re-read clears stale flag
            const readCount = _incLoopCount(fileReadCounts, prep.args.path);
            // Record the read range so overlap detection can catch duplicate reads.
            // Unbounded reads (no line_start) are stored as [1, 350] — the tool
            // truncates at 350 lines, so that is the slice now in context. Without
            // this, narrow targeted re-reads that fall within the first 350 lines
            // bypass overlap detection entirely because prevRanges is empty.
            {
              const rs =
                prep.args.line_start != null
                  ? parseInt(prep.args.line_start, 10) || 1
                  : 1;
              const re =
                prep.args.line_start != null
                  ? parseInt(prep.args.line_end, 10) || rs + 350
                  : 350; // unbounded read — first 350 lines are now in context
              if (!_sessionFileReadRanges.has(prep.args.path))
                _sessionFileReadRanges.set(prep.args.path, []);
              _sessionFileReadRanges.get(prep.args.path).push([rs, re]);
            }
            // Inject scroll warning if flagged during pre-execution check
            if (prep._scrollWarn) {
              const { sectionCount, path: warnPath } = prep._scrollWarn;
              const scrollWarning = {
                role: "user",
                content: `[SYSTEM WARNING] "${warnPath}" — you have now read ${sectionCount} different sections of this file. This is a file-scroll pattern. Stop reading sections and use grep_search to find the specific lines you need instead.`,
              };
              conversationMessages.push(scrollWarning);
              apiMessages.push(scrollWarning);
              debugLog(
                `${C.yellow}  ⚠ Scroll warning: "${warnPath.split("/").slice(-2).join("/")}" — ${sectionCount} sections read — use grep instead${C.reset}`,
              );
            }
            const shortPath = prep.args.path.split("/").slice(-2).join("/");
            // Only apply loop detection to unbounded reads — targeted reads (line_start provided)
            // are legitimate when navigating a large file beyond the 350-line cap.
            const wasUnbounded = !prep.args?.line_start && !prep.args?.line_end;
            const _skipReadLoop = _phaseEnabled && _currentPhase === "plan";
            if (
              !_skipReadLoop &&
              wasUnbounded &&
              readCount === LOOP_WARN_READS
            ) {
              // Pre-compress before injecting warning — prevents the warning itself from
              // triggering a 400-cascade when context is already near capacity.
              {
                const _allToolsRead = getAllToolDefinitions();
                const _readCtx = getUsage(apiMessages, _allToolsRead);
                if (_readCtx.percentage >= 60) {
                  const { messages: _c } = forceCompress(
                    apiMessages,
                    _allToolsRead,
                  );
                  apiMessages = _c;
                }
              }
              debugLog(
                `${C.yellow}  ⚠ Loop warning: "${shortPath}" read unbounded ${readCount}× — use line_start/line_end${C.reset}`,
              );
              const readWarning = {
                role: "user",
                content: `[SYSTEM WARNING] "${prep.args.path}" read ${readCount}× without line ranges. Use line_start/line_end to read specific sections — do not re-read the full file.`,
              };
              conversationMessages.push(readWarning);
              apiMessages.push(readWarning);
            } else if (
              !_skipReadLoop &&
              wasUnbounded &&
              readCount >= LOOP_ABORT_READS
            ) {
              debugLog(
                `${C.red}  ✖ Loop abort: "${shortPath}" read unbounded ${readCount}× — aborting runaway read loop${C.reset}`,
              );
              if (taskProgress) {
                taskProgress.stop();
                taskProgress = null;
              }
              setOnChange(null);
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
                { suppressHint: true },
              );
              saveNow(conversationMessages);
              return;
            }
          }
        }
        // Spawn-agents truncation stuck detection
        if (prep.fnName === "spawn_agents") {
          const doneCount = (res.match(/\bStatus: done\b/g) || []).length;
          const truncCount = (res.match(/\bStatus: truncated\b/g) || []).length;
          if (truncCount > 0 && doneCount === 0) {
            truncatedSwarmCount++;
            if (truncatedSwarmCount === LOOP_WARN_SWARM) {
              debugLog(
                `${C.yellow}  ⚠ Swarm warning: all sub-agents hit iteration limit ${truncatedSwarmCount}× in a row${C.reset}`,
              );
              const swarmWarning = {
                role: "user",
                content: `[SYSTEM WARNING] Sub-agents truncated ${truncatedSwarmCount}× in a row. Stop spawning — try different approach or report findings.`,
              };
              conversationMessages.push(swarmWarning);
              apiMessages.push(swarmWarning);
            } else if (truncatedSwarmCount >= LOOP_ABORT_SWARM) {
              console.log(
                `${C.red}  ✖ Swarm abort: all sub-agents hit iteration limit ${truncatedSwarmCount}× — aborting stuck swarm${C.reset}`,
              );
              if (taskProgress) {
                taskProgress.stop();
                taskProgress = null;
              }
              setOnChange(null);
              _printResume(
                totalSteps,
                toolCounts,
                filesModified,
                filesRead,
                startTime,
                { suppressHint: true },
              );
              saveNow(conversationMessages);
              return;
            }
          } else if (doneCount > 0) {
            truncatedSwarmCount = 0;
          }
        }
      }

      if (
        _needsPostEditVerifyPrompt &&
        _postEditVerifyPending &&
        !(_phaseEnabled && _currentPhase === "verify")
      ) {
        const suggestedChecks = await _inferVerificationCommands(filesModified);
        const relatedTests = await _inferRelevantTests(filesModified);
        const verifyMsg = {
          role: "user",
          content: _buildPostEditVerifyPrompt(
            filesModified,
            suggestedChecks,
            relatedTests,
          ),
        };
        conversationMessages.push(verifyMsg);
        apiMessages.push(verifyMsg);
        debugLog(
          `${C.cyan}  ↳ Post-edit verify prompt injected (${suggestedChecks.length} checks, ${relatedTests.length} tests)${C.reset}`,
        );
      }

      // ─── Per-message tool result budget ─────────────────────────────────────
      // When N tools run in parallel their results land in one API "user" turn.
      // Cap the aggregate size so a batch of large reads doesn't flood context.
      // Claude Code uses 200K chars; we apply the same guard here.
      {
        const PER_MSG_BUDGET = 200_000;
        let totalChars = toolMessages.reduce(
          (s, m) => s + (typeof m.content === "string" ? m.content.length : 0),
          0,
        );
        if (totalChars > PER_MSG_BUDGET) {
          // Trim the largest results first until we're under budget
          const sorted = toolMessages
            .map((m, i) => ({
              i,
              len: typeof m.content === "string" ? m.content.length : 0,
            }))
            .sort((a, b) => b.len - a.len);
          for (const { i, len } of sorted) {
            if (totalChars <= PER_MSG_BUDGET) break;
            const excess = totalChars - PER_MSG_BUDGET;
            const keep = Math.max(len - excess, 500);
            if (keep < len && typeof toolMessages[i].content === "string") {
              toolMessages[i] = {
                ...toolMessages[i],
                content:
                  toolMessages[i].content.substring(0, keep) +
                  `\n...(truncated ${len - keep} chars — per-message budget)`,
              };
              totalChars -= len - keep;
            }
          }
        }
      }

      for (const toolMsg of toolMessages) {
        conversationMessages.push(toolMsg);
        apiMessages.push(toolMsg);
      }

      const _wroteTextDeliverableThisBatch =
        _isSynthesisHeavyPrompt &&
        prepared.some((prep, idx) => {
          if (
            !prep ||
            !["write_file", "edit_file", "patch_file"].includes(prep.fnName)
          ) {
            return false;
          }
          const pathArg = prep.args?.path || prep.args?.file_path;
          return (
            isTextDeliverablePath(pathArg) &&
            typeof toolMessages[idx]?.content === "string" &&
            !toolMessages[idx].content.startsWith("ERROR") &&
            !toolMessages[idx].content.startsWith("BLOCKED:")
          );
        });

      // ─── Synthesis deliverable exit (headless mode) ───────────────────────
      // For analysis/doc tasks in auto mode, once the investigation cap has
      // already established that we have enough evidence and the requested text
      // deliverable has been written to disk, treat that as completion. Waiting
      // for another LLM turn often leads to avoidable "polish" loops and
      // timeouts, while the benchmark/user only needs the file on disk.
      if (
        getAutoConfirm() &&
        !opts.skillLoop &&
        _synthesisEvidenceReady &&
        _wroteTextDeliverableThisBatch
      ) {
        debugLog(
          `${C.green}  ✓ Synthesis deliverable exit: text deliverable written after evidence threshold reached${C.reset}`,
        );
        _printResume(
          totalSteps,
          toolCounts,
          filesModified,
          filesRead,
          startTime,
        );
        saveNow(conversationMessages);
        break outer;
      }

      // ─── Background agent results: drain completed jobs after tool execution ──
      _drainCompletedBackgroundJobs(conversationMessages, apiMessages);

      // ─── Root-cause detection: investigation → fix phase transition ──────────
      // Scan SSH output for unambiguous error signatures. On first match, inject
      // a focus message and tighten the read-only budget so the model goes straight
      // to the relevant file instead of continuing to investigate.
      if (!_rootCauseDetected) {
        for (let _rci = 0; _rci < toolMessages.length; _rci++) {
          if (!prepared[_rci] || prepared[_rci].fnName !== "ssh_exec") continue;
          const _tm = toolMessages[_rci];
          if (!_tm || typeof _tm.content !== "string") continue;
          const _cause = detectRootCause(_tm.content);
          if (_cause) {
            _rootCauseDetected = true;
            _rootCauseSummary = _cause.slice(0, 120);
            _readOnlyCallsSinceEdit = 0; // start fix-phase budget fresh
            _investigationCapFired = false;
            _readsSinceCapFired = 0;
            debugLog(
              `${C.yellow}  ⚡ Root cause detected: ${_rootCauseSummary} — fix phase (read budget: 3)${C.reset}`,
            );
            const rcMsg = {
              role: "user",
              content: `[SYSTEM] Root cause identified: ${_rootCauseSummary}. Read only the file that needs fixing, then edit it. Do not read other files.`,
            };
            conversationMessages.push(rcMsg);
            apiMessages.push(rcMsg);
            break;
          }
        }
      }

      // ─── Task registry + auto-completion tracking ────────────────────────────
      // Intercept create_task results to build an internal registry so we can
      // log auto-completions when a file write matches a task description.
      for (let _tri = 0; _tri < toolMessages.length; _tri++) {
        const _tp = prepared[_tri];
        if (!_tp) continue;
        const _tmContent =
          typeof toolMessages[_tri]?.content === "string"
            ? toolMessages[_tri].content
            : "";
        if (_tp.fnName === "create_task") {
          // Result format: "Task #N created successfully: <subject>"
          const _taskIdMatch = _tmContent.match(/Task #(\d+) created/);
          const _subject =
            typeof _tp.args?.subject === "string" ? _tp.args.subject : "";
          if (_taskIdMatch && _subject) {
            _taskRegistry.set(_taskIdMatch[1], _subject);
          }
        } else if (
          (_tp.fnName === "write_file" || _tp.fnName === "edit_file") &&
          !_tmContent.startsWith("BLOCKED:") &&
          _tmContent.trim().length > 0
        ) {
          // On any successful file write, check if filename tokens overlap with
          // a pending task description to log auto-completions.
          const _filePath =
            typeof _tp.args?.path === "string"
              ? _tp.args.path
              : typeof _tp.args?.file_path === "string"
                ? _tp.args.file_path
                : "";
          const _baseName = _filePath.split("/").pop().toLowerCase();
          const _fileTokens = _baseName
            .split(/[._\-/]/)
            .filter((t) => t.length > 2);
          for (const [_tid, _tdesc] of _taskRegistry) {
            if (_autoCompletedTasks.has(_tid)) continue;
            const _descTokens = _tdesc
              .toLowerCase()
              .split(/\W+/)
              .filter((t) => t.length > 3);
            const _overlap = _fileTokens.filter((ft) =>
              _descTokens.some((dt) => dt.includes(ft) || ft.includes(dt)),
            );
            if (_overlap.length >= 1) {
              _autoCompletedTasks.add(_tid);
              debugLog(
                `${C.green}  ✔ Auto-matched task #${_tid} to ${_baseName}: ${_tdesc.slice(0, 60)}${C.reset}`,
              );
            }
          }
        }
      }

      // ─── Post-tool auto-compress ─────────────────────────────────────────────
      // Tool results (especially large SSH/grep outputs) can push context over the
      // limit between iterations. Compress immediately after appending so the next
      // LLM call never hits a 400 context-overflow error.
      {
        const _allToolsPost = getAllToolDefinitions();
        const _postCtx = getUsage(apiMessages, _allToolsPost);
        if (_postCtx.percentage >= 78) {
          const { messages: _compressed, tokensRemoved: _freed } =
            forceCompress(apiMessages, _allToolsPost);
          if (_freed > 0) {
            apiMessages = _compressed;
            console.log(
              `${C.dim}  [auto-compressed — ~${_freed} tokens freed, now ${Math.round(getUsage(apiMessages, _allToolsPost).percentage)}%]${C.reset}`,
            );
          }
        }
      }

      // ─── Stagnation detection (headless mode) ────────────────────────────
      // In headless/auto-confirm mode, track consecutive iterations where only
      // read-only tools (read_file, grep, glob, list_directory, bash) run with
      // no file modifications. If the model keeps investigating without acting
      // for too many iterations, it's stagnating — force early exit.
      if (getAutoConfirm() && !opts.skillLoop) {
        const _batchHasWrite = prepared.some(
          (p) =>
            p && ["write_file", "edit_file", "patch_file"].includes(p.fnName),
        );
        if (_batchHasWrite) {
          _readOnlyToolStreak = 0;
        } else {
          if (_readOnlyToolStreak === 0)
            _filesModifiedAtStreakStart = filesModified.size;
          _readOnlyToolStreak++;
        }
        // After 9+ read-only iterations with no new file writes, force exit
        if (
          _readOnlyToolStreak >= 9 &&
          totalSteps >= 4 &&
          filesModified.size === _filesModifiedAtStreakStart
        ) {
          debugLog(
            `${C.green}  ✓ Stagnation exit: ${_readOnlyToolStreak} read-only iterations, no new file changes${C.reset}`,
          );
          if (process.stdout.isTTY) {
            process.stderr.write(
              `${C.yellow}  ⚠ Stagnation detected: ${_readOnlyToolStreak} iterations without edits — exiting. ` +
                `The model investigated but did not apply changes.${C.reset}\n`,
            );
          }
          if (taskProgress) {
            taskProgress.stop();
            taskProgress = null;
          }
          setOnChange(null);
          _printResume(
            totalSteps,
            toolCounts,
            filesModified,
            filesRead,
            startTime,
          );
          saveNow(conversationMessages);
          break outer;
        }
      }

      // ─── Mid-run user notes ───
      // If the user typed something while the agent was running, inject it now
      // before the next API call so the model can take it into account.
      const midRunNote = _drainMidRunBuffer();
      if (midRunNote) {
        const noteMsg = {
          role: "user",
          content: `[User note mid-run]: ${midRunNote}`,
        };
        conversationMessages.push(noteMsg);
        apiMessages.push(noteMsg);
        console.log(`${C.cyan}  ✎ Context added${C.reset}`);
      }
    }

    // Only print résumé + max-iterations warning if the loop actually exhausted (not on break)
    if (i >= iterLimit) {
      if (taskProgress) {
        taskProgress.stop();
        taskProgress = null;
      }
      setOnChange(null);
      _printResume(totalSteps, toolCounts, filesModified, filesRead, startTime);
      saveNow(conversationMessages);
      _scoreAndPrint(conversationMessages);

      // Phase budget exhaustion: auto-transition to next phase instead of stopping
      if (_phaseEnabled && _currentPhase === "plan") {
        const _lastAssistant = [...conversationMessages]
          .reverse()
          .find((m) => m.role === "assistant");
        const _summary =
          typeof _lastAssistant?.content === "string"
            ? _lastAssistant.content
            : "";
        const phaseMsg = await _transitionPhase("implement", _summary);
        if (phaseMsg) {
          conversationMessages.push(phaseMsg);
          const sysPrompt = await buildSystemPrompt();
          apiMessages = [
            { role: "system", content: sysPrompt },
            ...conversationMessages,
          ];
          iterLimit = getPhaseBudget("implement");
          debugLog(
            `${C.yellow}  ⚠ Plan budget exhausted — auto-transitioning to implement${C.reset}`,
          );
          continue outer;
        }
      } else if (_phaseEnabled && _currentPhase === "verify") {
        debugLog(
          `${C.yellow}  ⚠ Verify budget exhausted — completing session${C.reset}`,
        );
        break outer;
      }

      const {
        getActiveProviderName: _getProviderName,
      } = require("./providers/registry");
      const provider = _getProviderName();
      if (provider === "ollama" && autoExtensions < MAX_AUTO_EXTENSIONS) {
        // Skip auto-extend if no meaningful progress was made in this pass
        if (filesModified.size === 0 && !progressMadeThisPass) {
          console.log(
            `${C.yellow}  ⚠ Max iterations reached with no progress. Stopping.${C.reset}`,
          );
          break outer;
        }
        // Free provider — auto-extend silently.
        // iterLimit is reset to 20 (not += 20) because continue outer resets i to 0,
        // so the next pass runs exactly 20 more iterations, not the full cumulative sum
        // (which would give 70+90+...+250 = 1650 total instead of the intended 250).
        autoExtensions++;
        iterLimit = 20;
        console.log(
          `${C.dim}  ── auto-extending (+20 turns, ext ${autoExtensions}/${MAX_AUTO_EXTENSIONS}) ──${C.reset}`,
        );
        continue outer;
      }

      // Paid provider (or hard cap reached) — ask before spending more
      console.log(`\n${C.yellow}⚠ Max iterations reached.${C.reset}`);
      const keepGoing = await confirm(`  Continue for 20 more turns?`);
      if (keepGoing) {
        iterLimit = 20; // continue outer resets i to 0, so set exactly 20 new turns
        continue outer;
      }

      console.log(
        `${C.dim}  Tip: set "maxIterations" in .nex/config.json or use --max-turns${C.reset}`,
      );
    }
    break outer;
  } // end outer while

  // ─── Background job drain (post-loop) ───────────────────────────────────────
  // break outer always falls through here; the early return at the no-tool-calls
  // path also calls this helper before returning.
  await _awaitAndDrainBackgroundJobs();
}

module.exports = {
  processInput,
  clearConversation,
  getConversationLength,
  getConversationMessages,
  setConversationMessages,
  setAbortSignalGetter,
  setMaxIterations,
  // Export cache invalidation functions for registry.js
  invalidateSystemPromptCache,
  clearToolFilterCache,
  // Export for benchmarking
  getCachedFilteredTools,
  buildSystemPrompt,
  splitSystemPrompt,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  getProjectContextHash,
  _inferVerificationCommands,
  _inferRelevantTests,
  _inferSymbolTargets,
  _buildSymbolHintBlock,
  _detectResponseLanguage,
  _isSimpleDirectAnswerPrompt,
  _claimsVerificationOrCompletion,
  _statesVerificationGap,
  // Export for testing
  buildUserContent,
  _detectImageURLs,
  _downloadImageURL,
  _grabClipboardImage,
  detectFrustration,
  // Export loop detection for testing and external use
  detectAndTruncateLoop,
  // Mid-run input injection
  injectMidRunNote,
  // Reset loop/read tracking without clearing messages (used by /retry)
  resetSessionTracking: _resetSessionTracking,
};

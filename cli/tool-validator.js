/**
 * cli/tool-validator.js — Tool Argument Validation
 * Validates tool call arguments against their JSON Schema definitions.
 * Returns helpful error messages for open-source models.
 */

const { getSkillToolDefinitions } = require("./skills");
const { getMCPToolDefinitions } = require("./mcp");
const { getPluginToolDefinitions } = require("./plugins");

// Schema cache to avoid repeated lookups (saves 5-20ms per tool call)
const schemaCache = new Map();
const toolDefsCache = { value: null };

/**
 * Get cached tool definitions (lazy-loaded)
 */
function getAllToolDefinitions() {
  const { TOOL_DEFINITIONS } = require("./tools");
  // Always get fresh skill and MCP definitions as they can change
  return [
    ...TOOL_DEFINITIONS,
    ...getSkillToolDefinitions(),
    ...getMCPToolDefinitions(),
    ...getPluginToolDefinitions(),
  ];
}

/**
 * Get cached schema for a tool
 */
function getCachedSchema(toolName) {
  if (schemaCache.has(toolName)) {
    return schemaCache.get(toolName);
  }

  const allTools = getAllToolDefinitions();
  const toolDef = allTools.find((t) => t.function.name === toolName);

  if (!toolDef) {
    return null; // Tool not found
  }

  // Tool exists - return schema (may be undefined if no parameters)
  const schema = toolDef.function.parameters;
  schemaCache.set(toolName, schema);
  return schema;
}

/**
 * Clear schema cache (e.g. when tools change)
 */
function clearSchemaCache() {
  schemaCache.clear();
}

/**
 * Find the closest matching string from a list (Levenshtein distance).
 */
function closestMatch(input, candidates) {
  if (!input || candidates.length === 0) return null;

  let best = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    const dist = levenshtein(input.toLowerCase(), c.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }

  // Only suggest if reasonably close (within half the length)
  return bestDist <= Math.ceil(input.length / 2) ? best : null;
}

function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Validate tool arguments against schema.
 * @param {string} toolName - Name of the tool
 * @param {object} args - Parsed arguments
 * @returns {{ valid: boolean, error?: string, corrected?: object }}
 */
function validateToolArgs(toolName, args) {
  // Use cached schema
  const schema = getCachedSchema(toolName);

  if (schema === null) {
    // Tool not found — check for close matches
    const allTools = getAllToolDefinitions();
    const allNames = allTools.map((t) => t.function.name);
    const suggestion = closestMatch(toolName, allNames);
    return {
      valid: false,
      error: `Unknown tool "${toolName}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}\nAvailable tools: ${allNames.join(", ")}`,
    };
  }

  // Tool exists but has no schema (or empty schema) - allow any arguments
  if (!schema || !schema.properties) return { valid: true };

  const required = schema.required || [];
  const expectedKeys = Object.keys(schema.properties);
  const providedKeys = Object.keys(args);
  const errors = [];
  const corrected = { ...args };
  let wasCorrected = false;

  // Check for required fields
  for (const key of required) {
    if (!(key in args) || args[key] === undefined || args[key] === null) {
      // Check if a similar key was provided (e.g. "file" instead of "path")
      const suggestion = closestMatch(key, providedKeys);
      if (suggestion && !expectedKeys.includes(suggestion)) {
        // Auto-correct: use the similar key's value
        corrected[key] = args[suggestion];
        delete corrected[suggestion];
        wasCorrected = true;
      } else {
        errors.push(
          `Missing required parameter "${key}" (${schema.properties[key]?.description || schema.properties[key]?.type || "unknown"})`,
        );
      }
    }
  }

  // Auto-correct common shell-flag hallucinations for grep-type tools
  const GREP_TOOLS = new Set(["grep", "grep_search", "search_files"]);
  if (GREP_TOOLS.has(toolName)) {
    // -n: line numbers are implicit in output_mode:'content' — just drop the flag
    if (("-n" in corrected || "n" in corrected) && !expectedKeys.includes("-n")) {
      delete corrected["-n"];
      delete corrected["n"];
      wasCorrected = true;
    }
    // -i / --ignore-case: map to ignore_case boolean
    if (("-i" in corrected || "--ignore-case" in corrected) && "ignore_case" in (schema.properties || {})) {
      corrected["ignore_case"] = true;
      delete corrected["-i"];
      delete corrected["--ignore-case"];
      wasCorrected = true;
    }
    // -r / --recursive: recursive is default behaviour — drop the flag
    if ("-r" in corrected || "--recursive" in corrected) {
      delete corrected["-r"];
      delete corrected["--recursive"];
      wasCorrected = true;
    }
  }

  // Auto-correct common parameter name confusions for read_file
  // Models frequently use "offset" or "start_line" instead of "line_start",
  // and "end_line" instead of "line_end". These are too far from their targets
  // for Levenshtein to catch, so we handle them explicitly.
  if (toolName === "read_file") {
    if ("offset" in corrected && !("line_start" in corrected)) {
      corrected["line_start"] = corrected["offset"];
      delete corrected["offset"];
      wasCorrected = true;
    }
    if ("start_line" in corrected && !("line_start" in corrected)) {
      corrected["line_start"] = corrected["start_line"];
      delete corrected["start_line"];
      wasCorrected = true;
    }
    if ("end_line" in corrected && !("line_end" in corrected)) {
      corrected["line_end"] = corrected["end_line"];
      delete corrected["end_line"];
      wasCorrected = true;
    }
  }

  // Check for unknown keys and suggest corrections
  for (const key of Object.keys(corrected)) {
    if (!expectedKeys.includes(key)) {
      const suggestion = closestMatch(key, expectedKeys);
      if (suggestion && !(suggestion in corrected)) {
        corrected[suggestion] = corrected[key];
        delete corrected[key];
        wasCorrected = true;
      } else if (!wasCorrected) {
        // Provide targeted hints for common shell-flag hallucinations
        const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
        errors.push(`Unknown parameter "${key}".${hint}`);
      }
    }
  }

  // Type checking for provided values
  for (const key of Object.keys(corrected)) {
    if (!schema.properties[key]) continue;
    const expected = schema.properties[key].type;
    const actual = typeof corrected[key];

    if (expected === "string" && actual === "number") {
      corrected[key] = String(corrected[key]);
      wasCorrected = true;
    } else if (
      expected === "number" &&
      actual === "string" &&
      !isNaN(corrected[key])
    ) {
      corrected[key] = Number(corrected[key]);
      wasCorrected = true;
    } else if (expected === "boolean" && actual === "string") {
      corrected[key] = corrected[key] === "true";
      wasCorrected = true;
    }
  }

  if (errors.length > 0 && !wasCorrected) {
    return {
      valid: false,
      error:
        `Tool "${toolName}" argument errors:\n` +
        errors.map((e) => `  - ${e}`).join("\n") +
        `\n\nExpected parameters: ${JSON.stringify(schema.properties, null, 2)}`,
    };
  }

  return { valid: true, corrected: wasCorrected ? corrected : null };
}

/**
 * Validate and normalize a raw tool call object from any provider.
 * Handles provider-specific quirks:
 *   - OpenAI/Ollama: arguments may be a JSON string instead of an object
 *   - Gemini: uses "args" instead of "arguments"
 *   - Missing arguments: defaults to {}
 *
 * @param {object} toolCall - Raw tool call from provider
 * @param {string} [providerName] - Provider name for context in error messages
 * @returns {{ valid: boolean, normalized: object, errors: string[] }}
 */
function validateToolCallFormat(toolCall, providerName) {
  const errors = [];
  const normalized = { ...toolCall };

  // Ensure we have a function name
  if (!normalized.function && !normalized.name) {
    errors.push('Tool call missing both "function" and "name" fields');
    return { valid: false, normalized, errors };
  }

  // Normalize flat format (name + args/arguments) into nested function format
  if (!normalized.function && normalized.name) {
    normalized.function = {
      name: normalized.name,
      arguments: normalized.arguments || normalized.args || {},
    };
    delete normalized.name;
    delete normalized.args;
  }

  // Gemini: normalize "args" to "arguments" at function level
  if (
    normalized.function &&
    normalized.function.args !== undefined &&
    normalized.function.arguments === undefined
  ) {
    normalized.function.arguments = normalized.function.args;
    delete normalized.function.args;
  }

  // Handle missing arguments — default to empty object
  if (
    normalized.function &&
    (normalized.function.arguments === undefined ||
      normalized.function.arguments === null)
  ) {
    normalized.function.arguments = {};
  }

  // OpenAI/Ollama: parse JSON string arguments
  if (
    normalized.function &&
    typeof normalized.function.arguments === "string"
  ) {
    const raw = normalized.function.arguments;
    if (raw.trim() === "") {
      normalized.function.arguments = {};
    } else {
      try {
        normalized.function.arguments = JSON.parse(raw);
      } catch (e) {
        errors.push(
          `Invalid JSON in arguments${providerName ? ` (${providerName})` : ""}: ${e.message}`,
        );
        return { valid: false, normalized, errors };
      }
    }
  }

  // Ensure arguments is a plain object
  if (
    normalized.function &&
    typeof normalized.function.arguments !== "object"
  ) {
    errors.push(
      `Arguments must be an object, got ${typeof normalized.function.arguments}`,
    );
    return { valid: false, normalized, errors };
  }

  // Ensure function name is a non-empty string
  if (
    !normalized.function.name ||
    typeof normalized.function.name !== "string"
  ) {
    errors.push("Tool call function name must be a non-empty string");
    return { valid: false, normalized, errors };
  }

  return { valid: errors.length === 0, normalized, errors };
}

module.exports = {
  validateToolArgs,
  validateToolCallFormat,
  closestMatch,
  levenshtein,
  getCachedSchema,
  clearSchemaCache,
};

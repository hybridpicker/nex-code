/**
 * cli/tool-validator.js — Tool Argument Validation
 * Validates tool call arguments against their JSON Schema definitions.
 * Returns helpful error messages for open-source models.
 */

const { getSkillToolDefinitions } = require('./skills');
const { getMCPToolDefinitions } = require('./mcp');

// Schema cache to avoid repeated lookups (saves 5-20ms per tool call)
const schemaCache = new Map();
const toolDefsCache = { value: null };

/**
 * Get cached tool definitions (lazy-loaded)
 */
function getAllToolDefinitions() {
  const { TOOL_DEFINITIONS } = require('./tools');
  // Always get fresh skill and MCP definitions as they can change
  return [...TOOL_DEFINITIONS, ...getSkillToolDefinitions(), ...getMCPToolDefinitions()];
}

/**
 * Get cached schema for a tool
 */
function getCachedSchema(toolName) {
  if (schemaCache.has(toolName)) {
    return schemaCache.get(toolName);
  }
  
  const allTools = getAllToolDefinitions();
  const toolDef = allTools.find(t => t.function.name === toolName);
  
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
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
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
    const allNames = allTools.map(t => t.function.name);
    const suggestion = closestMatch(toolName, allNames);
    return {
      valid: false,
      error: `Unknown tool "${toolName}".${suggestion ? ` Did you mean "${suggestion}"?` : ''}\nAvailable tools: ${allNames.join(', ')}`,
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
        errors.push(`Missing required parameter "${key}" (${schema.properties[key]?.description || schema.properties[key]?.type || 'unknown'})`);
      }
    }
  }

  // Check for unknown keys and suggest corrections
  for (const key of providedKeys) {
    if (!expectedKeys.includes(key)) {
      const suggestion = closestMatch(key, expectedKeys);
      if (suggestion && !(suggestion in corrected)) {
        corrected[suggestion] = args[key];
        delete corrected[key];
        wasCorrected = true;
      } else if (!wasCorrected) {
        errors.push(`Unknown parameter "${key}".${suggestion ? ` Did you mean "${suggestion}"?` : ''}`);
      }
    }
  }

  // Type checking for provided values
  for (const key of Object.keys(corrected)) {
    if (!schema.properties[key]) continue;
    const expected = schema.properties[key].type;
    const actual = typeof corrected[key];

    if (expected === 'string' && actual === 'number') {
      corrected[key] = String(corrected[key]);
      wasCorrected = true;
    } else if (expected === 'number' && actual === 'string' && !isNaN(corrected[key])) {
      corrected[key] = Number(corrected[key]);
      wasCorrected = true;
    } else if (expected === 'boolean' && actual === 'string') {
      corrected[key] = corrected[key] === 'true';
      wasCorrected = true;
    }
  }

  if (errors.length > 0 && !wasCorrected) {
    return {
      valid: false,
      error: `Tool "${toolName}" argument errors:\n` +
        errors.map(e => `  - ${e}`).join('\n') +
        `\n\nExpected parameters: ${JSON.stringify(schema.properties, null, 2)}`,
    };
  }

  return { valid: true, corrected: wasCorrected ? corrected : null };
}

module.exports = { validateToolArgs, closestMatch, levenshtein, getCachedSchema, clearSchemaCache };

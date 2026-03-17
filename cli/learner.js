/**
 * cli/learner.js — Session Reflection & Memory Optimization Agent
 *
 * Analyzes conversations to extract user preferences, corrections, and patterns.
 * Updates memory.json and NEX.md with learned knowledge.
 */

const fs = require('fs');
const path = require('path');
const { atomicWrite, withFileLockSync } = require('./filelock');
const { callChat } = require('./providers/registry');
const { remember, listMemories, recall } = require('./memory');

const LEARN_MIN_MESSAGES = 4; // Minimum user turns to bother

const REFLECTION_PROMPT = `You are a memory optimization agent for an AI coding assistant called nex-code.
Analyze this conversation history and extract actionable learnings the assistant should remember.

Return ONLY valid JSON in this exact format:
{
  "memories": [
    { "key": "snake_case_key", "value": "concise actionable value" }
  ],
  "nex_additions": [
    "- Instruction line to add to project NEX.md"
  ],
  "summary": "1-2 sentence description of what was done this session"
}

Focus on extracting:
1. CORRECTIONS: User corrected the AI ("no, not like that", "always use X", "never do Y", "stop doing Z")
2. PREFERENCES: Explicit style/tool/workflow preferences stated ("I prefer X", "use Y for Z", "always do W")
3. PROJECT CONVENTIONS: Discovered project-specific rules, file patterns, naming conventions
4. TECH STACK FACTS: Specific versions, frameworks, patterns used in this project

Rules:
- ONLY extract HIGH-CONFIDENCE learnings (user was explicit, not guessed)
- key: snake_case, max 30 chars, unique and descriptive
- value: concise actionable instruction, max 120 chars
- nex_additions: project-level instructions/conventions only (not personal preferences)
- If nothing significant to learn, return {"memories": [], "nex_additions": [], "summary": "..."}
- Return ONLY the JSON, no markdown, no explanation`;

/**
 * Format messages for reflection — only user/assistant turns, last 40, truncated.
 */
function formatForReflection(messages) {
  return messages
    .filter(m =>
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.trim().length > 10
    )
    .slice(-40)
    .map(m => `[${m.role.toUpperCase()}]: ${m.content.substring(0, 700)}`)
    .join('\n\n');
}

/**
 * Run session reflection and extract learnings.
 * @param {Array} messages - Conversation messages
 * @returns {Promise<{ memories, nex_additions, summary, skipped?, error? }>}
 */
async function reflectOnSession(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length < LEARN_MIN_MESSAGES) {
    return { memories: [], nex_additions: [], summary: null, skipped: true };
  }

  const formatted = formatForReflection(messages);
  if (!formatted.trim()) {
    return { memories: [], nex_additions: [], summary: null, skipped: true };
  }

  const reflectMessages = [
    { role: 'system', content: REFLECTION_PROMPT },
    { role: 'user', content: `Conversation to analyze:\n\n${formatted}` },
  ];

  try {
    const result = await callChat(reflectMessages, [], {
      temperature: 0,
      maxTokens: 800,
    });

    const content = (result.content || '').trim();

    // Extract JSON — may be wrapped in markdown code block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { memories: [], nex_additions: [], summary: null, error: 'No JSON in response' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      nex_additions: Array.isArray(parsed.nex_additions) ? parsed.nex_additions : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    };
  } catch (err) {
    return { memories: [], nex_additions: [], summary: null, error: err.message };
  }
}

/**
 * Apply extracted memories to the memory store.
 * @param {Array<{key, value}>} memories
 * @returns {Array<{key, value, action}>} Applied changes
 */
function applyMemories(memories) {
  const applied = [];
  for (const { key, value } of (memories || [])) {
    if (!key || !value || typeof key !== 'string' || typeof value !== 'string') continue;
    const cleanKey = key.trim().replace(/\s+/g, '-').substring(0, 60);
    const cleanVal = value.trim().substring(0, 200);
    if (!cleanKey || !cleanVal) continue;

    const existing = recall(cleanKey);
    if (existing === cleanVal) continue; // No change

    remember(cleanKey, cleanVal);
    applied.push({ key: cleanKey, value: cleanVal, action: existing ? 'updated' : 'added' });
  }
  return applied;
}

/**
 * Append new instructions to NEX.md without duplicating existing ones.
 * @param {Array<string>} additions
 * @returns {Array<string>} Lines actually added
 */
function applyNexAdditions(additions) {
  if (!additions || additions.length === 0) return [];

  const nexPath = path.join(process.cwd(), 'NEX.md');

  return withFileLockSync(nexPath, () => {
    let existing = '';
    try {
      if (fs.existsSync(nexPath)) existing = fs.readFileSync(nexPath, 'utf-8');
    } catch { /* ignore */ }

    const added = [];
    let newContent = existing;

    for (const line of additions) {
      if (!line || typeof line !== 'string') continue;
      const clean = line.trim();
      if (!clean) continue;

      // Fuzzy deduplicate: skip if first 35 chars already appear in file
      const snippet = clean.substring(0, 35).toLowerCase();
      if (existing.toLowerCase().includes(snippet)) continue;

      added.push(clean);
      newContent = newContent
        ? (newContent.endsWith('\n') ? newContent + clean : newContent + '\n' + clean)
        : clean;
    }

    if (added.length > 0) {
      if (!newContent.endsWith('\n')) newContent += '\n';
      atomicWrite(nexPath, newContent);
    }

    return added;
  });
}

/**
 * Full learn cycle: reflect → apply memories → apply NEX.md additions.
 * @param {Array} messages
 * @returns {Promise<{ applied, nexAdded, summary, skipped?, error? }>}
 */
async function learnFromSession(messages) {
  const result = await reflectOnSession(messages);
  if (result.skipped) return { applied: [], nexAdded: [], summary: null, skipped: true };
  if (result.error) return { applied: [], nexAdded: [], summary: null, error: result.error };

  const applied = applyMemories(result.memories);
  const nexAdded = applyNexAdditions(result.nex_additions);

  return {
    applied,
    nexAdded,
    summary: result.summary,
  };
}

// ─── Brain Learning ───────────────────────────────────────────

const BRAIN_REFLECTION_PROMPT = `You are a knowledge base agent for an AI coding assistant called nex-code.
Analyze this conversation and extract knowledge worth persisting in the project knowledge base (.nex/brain/).

Return ONLY valid JSON in this exact format:
{
  "documents": [
    {
      "name": "kebab-case-name",
      "content": "# Title\\n\\nMarkdown content with details...",
      "reason": "one sentence: why this is worth persisting"
    }
  ],
  "skip_reason": "why nothing was extracted (only if documents is empty)"
}

Extract documents ONLY for these categories:
1. ARCHITECTURE DECISIONS — How the system is structured, why certain choices were made
2. DEBUGGING INSIGHTS — Non-obvious bugs, error patterns, tricky workarounds discovered this session
3. API QUIRKS — Undocumented behaviors, edge cases of libraries/frameworks/services used
4. DEPLOYMENT PATTERNS — Steps, configs, sequences required to deploy/run the system
5. CODE CONVENTIONS — Project-specific patterns beyond what's obviously in the codebase

Rules:
- ONLY extract if the information is genuinely reusable in future sessions
- Do NOT extract session-specific context ("we decided today...") — only durable facts and patterns
- Do NOT extract trivial information (e.g. "the project uses React")
- Do NOT duplicate what's clearly in README, package.json, or NEX.md
- name: kebab-case, max 40 chars, descriptive (e.g. "jwt-redis-caching", "docker-deploy-sequence")
- content: proper Markdown — use headings (#), lists (-), code blocks (\`\`\`). Include YAML frontmatter with tags if helpful:
  ---
  tags: [auth, redis, caching]
  ---
- Maximum 3 documents per session. Quality over quantity.
- If nothing worth persisting: return {"documents": [], "skip_reason": "..."}
- Return ONLY the JSON, no markdown fences, no explanation`;

/**
 * Analyze conversation and extract knowledge worth persisting in the brain.
 * @param {Array} messages - Conversation messages
 * @returns {Promise<{ documents: Array<{name, content, reason}>, skip_reason?: string, error?: string }>}
 */
async function reflectBrain(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length < LEARN_MIN_MESSAGES) {
    return { documents: [], skip_reason: 'Session too short' };
  }

  const formatted = formatForReflection(messages);
  if (!formatted.trim()) {
    return { documents: [], skip_reason: 'No usable content' };
  }

  const reflectMessages = [
    { role: 'system', content: BRAIN_REFLECTION_PROMPT },
    { role: 'user', content: `Conversation to analyze:\n\n${formatted}` },
  ];

  try {
    const result = await callChat(reflectMessages, [], { temperature: 0, maxTokens: 2000 });
    const content = (result.content || '').trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { documents: [], error: 'No JSON in response' };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      skip_reason: parsed.skip_reason,
    };
  } catch (err) {
    return { documents: [], error: err.message };
  }
}

/**
 * Full brain learn cycle: reflect → write documents to .nex/brain/.
 * Only writes documents that don't already exist (no overwrite without user intent).
 * @param {Array} messages
 * @returns {Promise<{ written: Array<{name, reason}>, skipped: Array<string>, skip_reason?: string, error?: string }>}
 */
async function learnBrainFromSession(messages) {
  const result = await reflectBrain(messages);
  if (result.error) return { written: [], skipped: [], error: result.error };
  if (!result.documents || result.documents.length === 0) {
    return { written: [], skipped: [], skip_reason: result.skip_reason };
  }

  const { writeDocument, readDocument } = require('./brain');
  const written = [];
  const skipped = [];

  for (const doc of result.documents) {
    if (!doc.name || !doc.content) continue;
    const cleanName = doc.name.trim().replace(/\.md$/, '').replace(/[^a-z0-9-]/g, '-').substring(0, 60);
    if (!cleanName) continue;

    // Don't overwrite existing documents — append a dated section instead
    const existing = readDocument(cleanName);
    if (existing.content) {
      const date = new Date().toISOString().split('T')[0];
      const appendContent = `\n\n## Update ${date}\n\n${doc.content}`;
      writeDocument(cleanName, existing.content + appendContent);
      written.push({ name: cleanName, reason: doc.reason || '', action: 'updated' });
    } else {
      writeDocument(cleanName, doc.content);
      written.push({ name: cleanName, reason: doc.reason || '', action: 'created' });
    }
  }

  return { written, skipped };
}

module.exports = {
  learnFromSession,
  learnBrainFromSession,
  reflectOnSession,
  reflectBrain,
  applyMemories,
  applyNexAdditions,
  LEARN_MIN_MESSAGES,
};

/**
 * cli/skills.js — Skills System
 * Load .md and .js skill files from .nex/skills/ to extend the system.
 * - Prompt Skills (.md): inject instructions into system prompt
 * - Script Skills (.js): provide instructions, commands, and tools
 */

const fs = require("fs");
const path = require("path");
const { atomicWrite, withFileLockSync } = require("./filelock");

// Loaded skills registry
let loadedSkills = [];

function getSkillsDir() {
  return path.join(process.cwd(), ".nex", "skills");
}

function getConfigPath() {
  return path.join(process.cwd(), ".nex", "config.json");
}

/**
 * Initialize the skills directory
 * @returns {string} path to .nex/skills/
 */
function initSkillsDir() {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Load disabled list from .nex/config.json
 * @returns {string[]}
 */
function getDisabledSkills() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return [];
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return config.skills && Array.isArray(config.skills.disabled)
      ? config.skills.disabled
      : [];
  } catch {
    return [];
  }
}

/**
 * Save disabled list to .nex/config.json
 * @param {string[]} disabled
 */
function saveDisabledSkills(disabled) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  withFileLockSync(configPath, () => {
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch {
        config = {};
      }
    }
    if (!config.skills) config.skills = {};
    config.skills.disabled = disabled;
    atomicWrite(configPath, JSON.stringify(config, null, 2));
  });
}

/**
 * Validate a script skill module
 * @param {Object} mod - require()'d module
 * @param {string} filePath - for error messages
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateScriptSkill(mod, filePath) {
  const errors = [];

  if (typeof mod !== "object" || mod === null) {
    return { valid: false, errors: ["Module must export an object"] };
  }

  if (mod.name !== undefined && typeof mod.name !== "string") {
    errors.push("name must be a string");
  }

  if (mod.description !== undefined && typeof mod.description !== "string") {
    errors.push("description must be a string");
  }

  if (mod.instructions !== undefined && typeof mod.instructions !== "string") {
    errors.push("instructions must be a string");
  }

  if (mod.commands !== undefined) {
    if (!Array.isArray(mod.commands)) {
      errors.push("commands must be an array");
    } else {
      for (let i = 0; i < mod.commands.length; i++) {
        const c = mod.commands[i];
        if (!c.cmd || typeof c.cmd !== "string") {
          errors.push(`commands[${i}].cmd must be a non-empty string`);
        }
        if (c.handler !== undefined && typeof c.handler !== "function") {
          errors.push(`commands[${i}].handler must be a function`);
        }
      }
    }
  }

  if (mod.tools !== undefined) {
    if (!Array.isArray(mod.tools)) {
      errors.push("tools must be an array");
    } else {
      for (let i = 0; i < mod.tools.length; i++) {
        const t = mod.tools[i];
        if (
          !t.function ||
          !t.function.name ||
          typeof t.function.name !== "string"
        ) {
          errors.push(`tools[${i}].function.name must be a non-empty string`);
        }
        if (t.execute !== undefined && typeof t.execute !== "function") {
          errors.push(`tools[${i}].execute must be a function`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse optional YAML-like frontmatter from a markdown string.
 * Extracts `trigger:` list entries. No yaml dependency needed.
 * @param {string} raw
 * @returns {{ triggers: string[], body: string }}
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { triggers: [], body: raw };
  const fm = match[1];
  const body = match[2].trim();
  const triggers = [];
  let inTrigger = false;
  for (const line of fm.split("\n")) {
    const trimmed = line.trim();
    if (/^trigger:\s*$/i.test(trimmed)) { inTrigger = true; continue; }
    if (inTrigger && trimmed.startsWith("- ")) {
      triggers.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
    } else if (inTrigger && trimmed && !trimmed.startsWith("#")) {
      inTrigger = false;
    }
  }
  return { triggers, body };
}

/**
 * Load a single .md skill
 * @param {string} filePath
 * @returns {Object|null}
 */
function loadMarkdownSkill(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (!content) return null;
    const name = path.basename(filePath, ".md");
    const { triggers, body } = parseFrontmatter(content);
    return {
      name,
      type: "prompt",
      filePath,
      instructions: body || content,
      triggers,
      commands: [],
      tools: [],
    };
  } catch {
    return null;
  }
}

/**
 * Load a single .js skill
 * @param {string} filePath
 * @returns {Object|null}
 */
function loadScriptSkill(filePath) {
  try {
    const mod = require(filePath);
    const { valid, errors } = validateScriptSkill(mod, filePath);
    if (!valid) {
      console.error(
        `Skill validation failed: ${filePath}\n  ${errors.join("\n  ")}`,
      );
      return null;
    }
    const name = mod.name || path.basename(filePath, ".js");
    return {
      name,
      type: "script",
      filePath,
      description: mod.description || "",
      instructions: mod.instructions || "",
      commands: (mod.commands || []).map((c) => ({
        cmd: c.cmd.startsWith("/") ? c.cmd : `/${c.cmd}`,
        desc: c.desc || c.description || "",
        handler: c.handler || null,
      })),
      tools: (mod.tools || []).map((t) => ({
        type: t.type || "function",
        function: {
          name: t.function.name,
          description: t.function.description || "",
          parameters: t.function.parameters || {
            type: "object",
            properties: {},
          },
        },
        execute: t.execute || null,
      })),
    };
  } catch (err) {
    console.error(`Failed to load skill: ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Load all skills from .nex/skills/
 * @returns {Object[]} array of loaded skills
 */
function loadAllSkills() {
  loadedSkills = [];
  const disabled = getDisabledSkills();
  const dir = getSkillsDir();

  let entries = [];
  if (fs.existsSync(dir)) {
    try {
      entries = fs.readdirSync(dir);
    } catch {
      entries = [];
    }
  }

  for (const entry of entries) {
    const filePath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    let skill = null;
    if (entry.endsWith(".md")) {
      skill = loadMarkdownSkill(filePath);
    } else if (entry.endsWith(".js")) {
      skill = loadScriptSkill(filePath);
    }

    if (skill) {
      skill.enabled = !disabled.includes(skill.name);
      loadedSkills.push(skill);
    }
  }

  // Load built-in skills from cli/skills/ (skip in test environments)
  const builtinDir = path.join(__dirname, "skills");
  if (!process.env.NEX_SKIP_BUILTIN_SKILLS && fs.existsSync(builtinDir)) {
    let builtinFiles;
    try {
      builtinFiles = fs
        .readdirSync(builtinDir)
        .filter((f) => f.endsWith(".md") || f.endsWith(".js"));
    } catch {
      builtinFiles = [];
    }
    for (const file of builtinFiles) {
      const filePath = path.join(builtinDir, file);
      // Don't load if user has a skill with the same name (user overrides built-in)
      const name = path.basename(file, path.extname(file));
      if (loadedSkills.some((s) => s.name === name)) continue;

      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;

      const skill = file.endsWith(".md")
        ? loadMarkdownSkill(filePath)
        : loadScriptSkill(filePath);
      if (skill) {
        skill._builtin = true;
        skill.enabled = !disabled.includes(skill.name);
        loadedSkills.push(skill);
      }
    }
  }

  return loadedSkills;
}

/**
 * Get combined instructions from all enabled skills
 * @returns {string}
 */
function getSkillInstructions() {
  const parts = [];
  for (const skill of loadedSkills) {
    if (!skill.enabled || !skill.instructions) continue;
    parts.push(`[Skill: ${skill.name}]\n${skill.instructions}`);
  }
  if (parts.length === 0) return "";
  return `SKILL INSTRUCTIONS:\n${parts.join("\n\n")}`;
}

/**
 * Get all commands from enabled skills
 * @returns {Array<{cmd: string, desc: string}>}
 */
function getSkillCommands() {
  const cmds = [];
  for (const skill of loadedSkills) {
    if (!skill.enabled) continue;
    for (const c of skill.commands) {
      cmds.push({ cmd: c.cmd, desc: c.desc || `[skill: ${skill.name}]` });
    }
  }
  return cmds;
}

/**
 * Get tool definitions from enabled skills (OpenAI format with skill_ prefix)
 * @returns {Array}
 */
function getSkillToolDefinitions() {
  const defs = [];
  for (const skill of loadedSkills) {
    if (!skill.enabled) continue;
    for (const t of skill.tools) {
      defs.push({
        type: "function",
        function: {
          name: `skill_${t.function.name}`,
          description: `[Skill:${skill.name}] ${t.function.description}`,
          parameters: t.function.parameters,
        },
      });
    }
  }
  return defs;
}

/**
 * Route a skill_ tool call to its execute function
 * @param {string} fnName
 * @param {Object} args
 * @returns {Promise<string|null>} null if not a skill tool
 */
async function routeSkillCall(fnName, args) {
  if (!fnName.startsWith("skill_")) return null;
  const toolName = fnName.substring(6);

  for (const skill of loadedSkills) {
    if (!skill.enabled) continue;
    for (const t of skill.tools) {
      if (t.function.name === toolName && t.execute) {
        try {
          const result = await t.execute(args);
          return typeof result === "string" ? result : JSON.stringify(result);
        } catch (err) {
          return `ERROR: Skill tool '${toolName}' failed: ${err.message}`;
        }
      }
    }
  }

  return `ERROR: Skill tool '${toolName}' not found`;
}

/**
 * Check if input matches a skill command and run its handler
 * @param {string} input - full user input (e.g. "/deploy staging")
 * @returns {boolean} true if handled
 */
/**
 * Check if input matches a skill command and run its handler.
 * If the handler returns a string, that string is an agent prompt
 * that should be fed into processInput() by the caller.
 * @param {string} input - full user input (e.g. "/autoresearch optimize X")
 * @returns {false|{handled: true, agentPrompt?: string}}
 */
function handleSkillCommand(input) {
  const [cmd, ...rest] = input.split(/\s+/);
  const args = rest.join(" ").trim();

  for (const skill of loadedSkills) {
    if (!skill.enabled) continue;
    for (const c of skill.commands) {
      if (c.cmd === cmd && c.handler) {
        try {
          const result = c.handler(args);
          // If handler returns a string, pass it to the agent as a prompt
          if (typeof result === "string" && result.length > 0) {
            return { handled: true, agentPrompt: result };
          }
        } catch (err) {
          console.error(`Skill command error (${cmd}): ${err.message}`);
        }
        return { handled: true };
      }
    }
  }
  return false;
}

/**
 * List all loaded skills with their status
 * @returns {Array<{name: string, type: string, enabled: boolean, commands: number, tools: number}>}
 */
function listSkills() {
  return loadedSkills.map((s) => ({
    name: s.name,
    type: s.type,
    enabled: s.enabled,
    description: s.description || "",
    commands: s.commands.length,
    tools: s.tools.length,
    filePath: s.filePath,
  }));
}

/**
 * Enable a skill by name
 * @param {string} name
 * @returns {boolean}
 */
function enableSkill(name) {
  const skill = loadedSkills.find((s) => s.name === name);
  if (!skill) return false;
  skill.enabled = true;
  const disabled = getDisabledSkills().filter((n) => n !== name);
  saveDisabledSkills(disabled);
  return true;
}

/**
 * Disable a skill by name
 * @param {string} name
 * @returns {boolean}
 */
function disableSkill(name) {
  const skill = loadedSkills.find((s) => s.name === name);
  if (!skill) return false;
  skill.enabled = false;
  const disabled = getDisabledSkills();
  if (!disabled.includes(name)) {
    disabled.push(name);
    saveDisabledSkills(disabled);
  }
  return true;
}

/**
 * Get loaded skills array (for testing)
 * @returns {Object[]}
 */
function getLoadedSkills() {
  return loadedSkills;
}

/**
 * Install a skill from a git URL.
 * Clones into .nex/skills/{name}/ and validates the skill manifest.
 *
 * @param {string} url - Git URL or shorthand (user/repo)
 * @param {object} [options] - { name: string }
 * @returns {Promise<{ ok: boolean, name: string, error?: string }>}
 */
async function installSkill(url, options = {}) {
  const { execFileSync } = require("child_process");
  const dir = initSkillsDir();

  // Normalize URL: support shorthand "user/repo" → GitHub URL
  let gitUrl = url;
  if (/^[\w-]+\/[\w.-]+$/.test(url)) {
    gitUrl = `https://github.com/${url}.git`;
  }

  // Determine skill name from URL or options
  const name =
    options.name || path.basename(gitUrl, ".git").replace(/^nex-skill-/, "");
  const targetDir = path.join(dir, name);

  // Check if already installed
  if (fs.existsSync(targetDir)) {
    return {
      ok: false,
      name,
      error: `Skill "${name}" is already installed at ${targetDir}. Remove it first to reinstall.`,
    };
  }

  // Clone
  try {
    if (!/^https?:\/\/[a-zA-Z0-9._\-/:.@]+$/.test(gitUrl))
      throw new Error(`Invalid git URL: ${gitUrl}`);
    execFileSync("git", ["clone", "--depth", "1", gitUrl, targetDir], {
      timeout: 30000,
      stdio: "pipe",
    });
  } catch (err) {
    return {
      ok: false,
      name,
      error: `Git clone failed: ${err.stderr?.toString().trim() || err.message}`,
    };
  }

  // Validate: check for skill.json manifest or .md/.js skill file
  const manifestPath = path.join(targetDir, "skill.json");
  const hasManifest = fs.existsSync(manifestPath);
  const hasSkillFile = fs
    .readdirSync(targetDir)
    .some(
      (f) => (f.endsWith(".md") || f.endsWith(".js")) && !f.startsWith("."),
    );

  if (!hasManifest && !hasSkillFile) {
    // Clean up invalid skill
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
    } catch (e) { console.error("skills.js line 562 failed:", e.message); }
    return {
      ok: false,
      name,
      error: "No skill.json manifest or .md/.js skill file found in repository",
    };
  }

  // If manifest exists, validate it
  if (hasManifest) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (!manifest.name) manifest.name = name;
    } catch {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } catch {}
      return { ok: false, name, error: "Invalid skill.json — not valid JSON" };
    }
  }

  // Reload skills
  loadAllSkills();

  return { ok: true, name };
}

/**
 * Search for skills in the registry (GitHub-based).
 * Searches GitHub for repositories matching "nex-skill-{query}" or tagged "nex-code-skill".
 *
 * @param {string} query - Search term
 * @returns {Promise<Array<{ name: string, description: string, url: string, stars: number }>>}
 */
async function searchSkills(query) {
  const axios = require("axios");
  try {
    const searchQuery = encodeURIComponent(
      `nex-skill ${query} OR nex-code-skill ${query}`,
    );
    const resp = await axios.get(
      `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&per_page=10`,
      {
        timeout: 10000,
        headers: { Accept: "application/vnd.github.v3+json" },
      },
    );

    return (resp.data.items || []).map((repo) => ({
      name: repo.name.replace(/^nex-skill-/, ""),
      description: repo.description || "(no description)",
      url: repo.clone_url,
      stars: repo.stargazers_count,
      owner: repo.owner.login,
    }));
  } catch (err) {
    return [
      {
        name: "error",
        description: `Search failed: ${err.message}`,
        url: "",
        stars: 0,
        owner: "",
      },
    ];
  }
}

/**
 * Remove an installed skill.
 * @param {string} name - Skill name
 * @returns {{ ok: boolean, error?: string }}
 */
function removeSkill(name) {
  const dir = path.join(getSkillsDir(), name);
  if (!fs.existsSync(dir)) {
    return {
      ok: false,
      error: `Skill "${name}" not found in ${getSkillsDir()}`,
    };
  }
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    loadAllSkills(); // Reload
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Match a task description against skill triggers.
 * Returns skills whose trigger patterns match (case-insensitive substring).
 * Each matched skill's instructions are truncated to 3 lines max.
 * @param {string} taskDescription — the user's first message
 * @returns {Array<{ name: string, instructions: string }>}
 */
function matchSkillTriggers(taskDescription) {
  if (!taskDescription) return [];
  const lower = taskDescription.toLowerCase();
  const matched = [];
  for (const skill of loadedSkills) {
    if (!skill.enabled || !skill.triggers || skill.triggers.length === 0)
      continue;
    const hit = skill.triggers.some((t) => lower.includes(t.toLowerCase()));
    if (hit) {
      const lines = (skill.instructions || "").split("\n").slice(0, 3).join("\n");
      matched.push({ name: skill.name, instructions: lines });
    }
  }
  return matched;
}

module.exports = {
  initSkillsDir,
  loadAllSkills,
  getSkillInstructions,
  getSkillCommands,
  getSkillToolDefinitions,
  routeSkillCall,
  handleSkillCommand,
  listSkills,
  enableSkill,
  disableSkill,
  getLoadedSkills,
  installSkill,
  searchSkills,
  removeSkill,
  matchSkillTriggers,
  // exported for testing
  _getSkillsDir: getSkillsDir,
  _validateScriptSkill: validateScriptSkill,
  _loadMarkdownSkill: loadMarkdownSkill,
  _loadScriptSkill: loadScriptSkill,
  _parseFrontmatter: parseFrontmatter,
};

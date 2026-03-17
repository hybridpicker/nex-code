/**
 * cli/skills.js — Skills System
 * Load .md and .js skill files from .nex/skills/ to extend the system.
 * - Prompt Skills (.md): inject instructions into system prompt
 * - Script Skills (.js): provide instructions, commands, and tools
 */

const fs = require('fs');
const path = require('path');
const { atomicWrite, withFileLockSync } = require('./filelock');

// Loaded skills registry
let loadedSkills = [];

function getSkillsDir() {
  return path.join(process.cwd(), '.nex', 'skills');
}

function getConfigPath() {
  return path.join(process.cwd(), '.nex', 'config.json');
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
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return (config.skills && Array.isArray(config.skills.disabled)) ? config.skills.disabled : [];
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
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { config = {}; }
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

  if (typeof mod !== 'object' || mod === null) {
    return { valid: false, errors: ['Module must export an object'] };
  }

  if (mod.name !== undefined && typeof mod.name !== 'string') {
    errors.push('name must be a string');
  }

  if (mod.description !== undefined && typeof mod.description !== 'string') {
    errors.push('description must be a string');
  }

  if (mod.instructions !== undefined && typeof mod.instructions !== 'string') {
    errors.push('instructions must be a string');
  }

  if (mod.commands !== undefined) {
    if (!Array.isArray(mod.commands)) {
      errors.push('commands must be an array');
    } else {
      for (let i = 0; i < mod.commands.length; i++) {
        const c = mod.commands[i];
        if (!c.cmd || typeof c.cmd !== 'string') {
          errors.push(`commands[${i}].cmd must be a non-empty string`);
        }
        if (c.handler !== undefined && typeof c.handler !== 'function') {
          errors.push(`commands[${i}].handler must be a function`);
        }
      }
    }
  }

  if (mod.tools !== undefined) {
    if (!Array.isArray(mod.tools)) {
      errors.push('tools must be an array');
    } else {
      for (let i = 0; i < mod.tools.length; i++) {
        const t = mod.tools[i];
        if (!t.function || !t.function.name || typeof t.function.name !== 'string') {
          errors.push(`tools[${i}].function.name must be a non-empty string`);
        }
        if (t.execute !== undefined && typeof t.execute !== 'function') {
          errors.push(`tools[${i}].execute must be a function`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Load a single .md skill
 * @param {string} filePath
 * @returns {Object|null}
 */
function loadMarkdownSkill(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return null;
    const name = path.basename(filePath, '.md');
    return {
      name,
      type: 'prompt',
      filePath,
      instructions: content,
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
      console.error(`Skill validation failed: ${filePath}\n  ${errors.join('\n  ')}`);
      return null;
    }
    const name = mod.name || path.basename(filePath, '.js');
    return {
      name,
      type: 'script',
      filePath,
      description: mod.description || '',
      instructions: mod.instructions || '',
      commands: (mod.commands || []).map((c) => ({
        cmd: c.cmd.startsWith('/') ? c.cmd : `/${c.cmd}`,
        desc: c.desc || c.description || '',
        handler: c.handler || null,
      })),
      tools: (mod.tools || []).map((t) => ({
        type: t.type || 'function',
        function: {
          name: t.function.name,
          description: t.function.description || '',
          parameters: t.function.parameters || { type: 'object', properties: {} },
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
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) return loadedSkills;

  const disabled = getDisabledSkills();
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return loadedSkills;
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
    if (entry.endsWith('.md')) {
      skill = loadMarkdownSkill(filePath);
    } else if (entry.endsWith('.js')) {
      skill = loadScriptSkill(filePath);
    }

    if (skill) {
      skill.enabled = !disabled.includes(skill.name);
      loadedSkills.push(skill);
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
  if (parts.length === 0) return '';
  return `SKILL INSTRUCTIONS:\n${parts.join('\n\n')}`;
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
        type: 'function',
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
  if (!fnName.startsWith('skill_')) return null;
  const toolName = fnName.substring(6);

  for (const skill of loadedSkills) {
    if (!skill.enabled) continue;
    for (const t of skill.tools) {
      if (t.function.name === toolName && t.execute) {
        try {
          const result = await t.execute(args);
          return typeof result === 'string' ? result : JSON.stringify(result);
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
function handleSkillCommand(input) {
  const [cmd, ...rest] = input.split(/\s+/);
  const args = rest.join(' ').trim();

  for (const skill of loadedSkills) {
    if (!skill.enabled) continue;
    for (const c of skill.commands) {
      if (c.cmd === cmd && c.handler) {
        try {
          c.handler(args);
        } catch (err) {
          console.error(`Skill command error (${cmd}): ${err.message}`);
        }
        return true;
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
    description: s.description || '',
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
  // exported for testing
  _getSkillsDir: getSkillsDir,
  _validateScriptSkill: validateScriptSkill,
  _loadMarkdownSkill: loadMarkdownSkill,
  _loadScriptSkill: loadScriptSkill,
};

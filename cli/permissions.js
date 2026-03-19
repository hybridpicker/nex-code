/**
 * cli/permissions.js — Tool Permission System
 * Three modes per tool: 'allow' (auto), 'ask' (confirm), 'deny' (blocked)
 * Team permission presets: readonly, developer, admin
 */

const fs = require('fs');
const path = require('path');
const { C } = require('./ui');
const { atomicWrite, withFileLockSync } = require('./filelock');

// Default permissions: read ops auto, write/bash ask
const DEFAULT_PERMISSIONS = {
  bash: 'ask',
  read_file: 'allow',
  write_file: 'ask',
  edit_file: 'ask',
  list_directory: 'allow',
  search_files: 'allow',
  glob: 'allow',
  grep: 'allow',
  patch_file: 'ask',
  web_fetch: 'allow',
  web_search: 'allow',
  ask_user: 'allow',
  task_list: 'allow',
  spawn_agents: 'ask',
};

let permissions = { ...DEFAULT_PERMISSIONS };

/**
 * Load permissions from .nex/config.json if it exists
 */
function loadPermissions() {
  const configPath = path.join(process.cwd(), '.nex', 'config.json');
  if (!fs.existsSync(configPath)) return;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.permissions) {
      permissions = { ...DEFAULT_PERMISSIONS, ...config.permissions };
    }
  } catch {
    // ignore corrupt config
  }
}

/**
 * Save current permissions to .nex/config.json
 */
function savePermissions() {
  const configDir = path.join(process.cwd(), '.nex');
  const configPath = path.join(configDir, 'config.json');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  withFileLockSync(configPath, () => {
    let config = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { config = {}; }
    }
    config.permissions = permissions;
    atomicWrite(configPath, JSON.stringify(config, null, 2));
  });
}

/**
 * Get permission for a tool
 * @param {string} toolName
 * @returns {'allow'|'ask'|'deny'}
 */
function getPermission(toolName) {
  return permissions[toolName] || 'ask';
}

/**
 * Set permission for a tool
 * @param {string} toolName
 * @param {'allow'|'ask'|'deny'} mode
 * @returns {boolean} true if valid
 */
function setPermission(toolName, mode) {
  if (!['allow', 'ask', 'deny'].includes(mode)) return false;
  permissions[toolName] = mode;
  return true;
}

/**
 * Check if a tool execution is allowed
 * @param {string} toolName
 * @returns {'allow'|'ask'|'deny'}
 */
function checkPermission(toolName) {
  return getPermission(toolName);
}

/**
 * List all permissions
 * @returns {Array<{ tool, mode }>}
 */
function listPermissions() {
  return Object.entries(permissions).map(([tool, mode]) => ({ tool, mode }));
}

/**
 * Reset permissions to defaults
 */
function resetPermissions() {
  permissions = { ...DEFAULT_PERMISSIONS };
}

// ─── Team Permission Presets ──────────────────────────────────

/**
 * Permission presets for team roles.
 */
const PERMISSION_PRESETS = {
  readonly: {
    description: 'Read-only access — can search and read but not modify',
    allowedTools: [
      'read_file', 'list_directory', 'search_files', 'glob', 'grep',
      'git_status', 'git_diff', 'git_log', 'ask_user',
      'web_fetch', 'web_search',
      'browser_open', 'browser_screenshot',
      'task_list',
    ],
    blockedTools: ['bash', 'write_file', 'edit_file', 'patch_file', 'deploy',
      'ssh_exec', 'service_manage', 'container_manage', 'container_exec',
      'remote_agent'],
    autoConfirm: false,
    allowDangerous: false,
  },

  developer: {
    description: 'Standard developer access — can read, write, and run commands',
    allowedTools: null, // null = all tools allowed
    blockedTools: ['deploy', 'service_manage', 'container_manage', 'remote_agent'],
    autoConfirm: false,
    allowDangerous: false,
  },

  admin: {
    description: 'Full access — all tools, including deployment and infrastructure',
    allowedTools: null,
    blockedTools: [],
    autoConfirm: false,
    allowDangerous: true,
  },
};

/**
 * Load team permission preset config from .nex/config.json.
 * @returns {{ role: string, overrides: object } | null}
 */
function loadPresetConfig() {
  const configPath = path.join(process.cwd(), '.nex', 'config.json');
  try {
    if (!fs.existsSync(configPath)) return null;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.teamPermissions || null;
  } catch {
    return null;
  }
}

/**
 * Save team permission preset config to .nex/config.json.
 * @param {object} teamPermissions
 */
function savePresetConfig(teamPermissions) {
  const configDir = path.join(process.cwd(), '.nex');
  const configPath = path.join(configDir, 'config.json');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    config = {};
  }

  config.teamPermissions = teamPermissions;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get the effective team permission set for the current project.
 * @returns {object} Merged permissions (preset + overrides)
 */
function getEffectivePreset() {
  const config = loadPresetConfig();
  if (!config) return PERMISSION_PRESETS.admin; // Default: full access

  const role = config.role || 'admin';
  const preset = PERMISSION_PRESETS[role] || PERMISSION_PRESETS.admin;

  // Merge overrides
  return {
    ...preset,
    ...config.overrides,
    // Merge tool lists (don't replace)
    blockedTools: [
      ...(preset.blockedTools || []),
      ...(config.overrides?.blockedTools || []),
    ],
  };
}

/**
 * Check if a tool is allowed under current team preset.
 * @param {string} toolName
 * @returns {{ allowed: boolean, reason?: string }}
 */
function isToolAllowed(toolName) {
  const perms = getEffectivePreset();

  // Check blocked list first
  if (perms.blockedTools && perms.blockedTools.includes(toolName)) {
    return { allowed: false, reason: `Tool "${toolName}" is blocked by permission preset "${perms.description || 'custom'}"` };
  }

  // Check allowed list (if set)
  if (perms.allowedTools && !perms.allowedTools.includes(toolName)) {
    return { allowed: false, reason: `Tool "${toolName}" is not in the allowed list for this permission level` };
  }

  return { allowed: true };
}

/**
 * List available permission presets.
 * @returns {Array<{ name: string, description: string, toolCount: string, blockedCount: number }>}
 */
function listPresets() {
  return Object.entries(PERMISSION_PRESETS).map(([name, preset]) => ({
    name,
    description: preset.description,
    toolCount: preset.allowedTools ? `${preset.allowedTools.length} allowed` : 'all allowed',
    blockedCount: preset.blockedTools.length,
  }));
}

// Load on init
loadPermissions();

module.exports = {
  getPermission,
  setPermission,
  checkPermission,
  listPermissions,
  loadPermissions,
  savePermissions,
  resetPermissions,
  DEFAULT_PERMISSIONS,
  PERMISSION_PRESETS,
  loadPresetConfig,
  savePresetConfig,
  getEffectivePreset,
  isToolAllowed,
  listPresets,
};

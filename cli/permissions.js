/**
 * cli/permissions.js — Tool Permission System
 * Three modes per tool: 'allow' (auto), 'ask' (confirm), 'deny' (blocked)
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
};

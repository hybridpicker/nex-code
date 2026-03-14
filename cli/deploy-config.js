/**
 * cli/deploy-config.js — Named Deploy Configuration
 *
 * Loads named deployment configs from .nex/deploy.json.
 *
 * Format (.nex/deploy.json):
 * {
 *   "prod": {
 *     "server": "prod",
 *     "local_path": "dist/",
 *     "remote_path": "/var/www/app",
 *     "exclude": ["node_modules", ".env"],
 *     "deploy_script": "systemctl restart gunicorn"
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');

const DEPLOY_FILE = path.join('.nex', 'deploy.json');

function getDeployConfigPath() {
  return path.join(process.cwd(), DEPLOY_FILE);
}

/**
 * Load all named deploy configs from .nex/deploy.json
 * @returns {Object.<string, DeployConfig>}
 */
function loadDeployConfigs() {
  const p = getDeployConfigPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Resolve a deploy config by name.
 * @param {string} name
 * @returns {DeployConfig}
 * @throws {Error} if not found
 */
function resolveDeployConfig(name) {
  const configs = loadDeployConfigs();
  if (configs[name]) return { ...configs[name], _name: name };
  const available = Object.keys(configs);
  const hint = available.length
    ? `Available: ${available.join(', ')}`
    : 'No deploy configs found. Create .nex/deploy.json or use explicit params.';
  throw new Error(`Unknown deploy config: "${name}". ${hint}`);
}

/**
 * Save deploy configs to .nex/deploy.json
 * @param {Object} configs
 */
function saveDeployConfigs(configs) {
  const nexDir = path.join(process.cwd(), '.nex');
  if (!fs.existsSync(nexDir)) fs.mkdirSync(nexDir, { recursive: true });
  fs.writeFileSync(getDeployConfigPath(), JSON.stringify(configs, null, 2) + '\n', 'utf-8');
}

module.exports = { loadDeployConfigs, resolveDeployConfig, saveDeployConfigs, getDeployConfigPath };

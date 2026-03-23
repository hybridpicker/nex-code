/**
 * cli/deploy-config.js — Named Deploy Configuration
 *
 * Loads named deployment configs from .nex/deploy.json.
 *
 * Format (.nex/deploy.json):
 * {
 *   "prod": {
 *     "server": "prod",              // server profile from .nex/servers.json
 *     "method": "rsync",             // "rsync" (default) or "git"
 *     "local_path": "dist/",         // rsync only: local dir to sync
 *     "remote_path": "/var/www/app", // destination (or git repo dir for git method)
 *     "branch": "main",              // git only: branch to pull (optional)
 *     "exclude": ["node_modules"],   // rsync only: paths to exclude
 *     "deploy_script": "systemctl restart gunicorn", // remote command after sync
 *     "health_check": "https://myapp.example.com/health" // URL or remote shell command
 *   }
 * }
 */

const fs = require("fs");
const path = require("path");

const DEPLOY_FILE = path.join(".nex", "deploy.json");

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
    return JSON.parse(fs.readFileSync(p, "utf-8"));
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
    ? `Available: ${available.join(", ")}`
    : "No deploy configs found. Create .nex/deploy.json or use explicit params.";
  throw new Error(`Unknown deploy config: "${name}". ${hint}`);
}

/**
 * Save deploy configs to .nex/deploy.json
 * @param {Object} configs
 */
function saveDeployConfigs(configs) {
  const nexDir = path.join(process.cwd(), ".nex");
  if (!fs.existsSync(nexDir)) fs.mkdirSync(nexDir, { recursive: true });
  fs.writeFileSync(
    getDeployConfigPath(),
    JSON.stringify(configs, null, 2) + "\n",
    "utf-8",
  );
}

module.exports = {
  loadDeployConfigs,
  resolveDeployConfig,
  saveDeployConfigs,
  getDeployConfigPath,
};

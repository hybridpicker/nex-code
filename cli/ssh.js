/**
 * cli/ssh.js — SSH Profile Manager + Executor
 *
 * Loads server profiles from .nex/servers.json
 * Executes commands via SSH with ControlMaster socket reuse (fast, no TLS overhead per call).
 * Handles SCP upload/download and SSH error enrichment.
 *
 * Profile format (.nex/servers.json):
 * {
 *   "prod": {
 *     "host": "94.130.37.43",
 *     "user": "jarvis",
 *     "port": 22,            // optional, default 22
 *     "key": "~/.ssh/id_rsa", // optional, falls back to SSH agent
 *     "os": "almalinux9",    // optional: almalinux9 | macos | ubuntu | debian
 *     "sudo": true           // optional: whether to allow sudo commands
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const SERVERS_FILE = path.join(process.cwd(), '.nex', 'servers.json');
const GLOBAL_SERVERS_FILE = path.join(os.homedir(), '.nex', 'servers.json');
const SSH_SOCKET_DIR = path.join(os.tmpdir(), 'nex-ssh-sockets');

// ─── Profile Management ───────────────────────────────────────

function getServersPath() {
  return path.join(process.cwd(), SERVERS_FILE);
}

/**
 * Load all server profiles.
 * Merges global (~/.nex/servers.json) with project-local (.nex/servers.json).
 * Project-local profiles override global ones with the same name.
 * @returns {Object.<string, ServerProfile>}
 */
function loadServerProfiles() {
  const readJson = (p) => {
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return {}; }
  };
  const global = readJson(GLOBAL_SERVERS_FILE);
  const local  = readJson(getServersPath());
  return { ...global, ...local };
}

/**
 * Resolve a profile by name or treat as direct host spec.
 * @param {string} nameOrHost - Profile name or "user@host" / "host"
 * @returns {ServerProfile}
 * @throws {Error} if profile not found and not a valid host
 */
function resolveProfile(nameOrHost) {
  const profiles = loadServerProfiles();

  // Named profile
  if (profiles[nameOrHost]) return { ...profiles[nameOrHost], _name: nameOrHost };

  // user@host or host.with.dots or localhost
  if (/^[\w.-]+@[\w.-]+$/.test(nameOrHost) || /[\w-]+\.[\w.-]+/.test(nameOrHost) || nameOrHost === 'localhost') {
    const [user, host] = nameOrHost.includes('@') ? nameOrHost.split('@') : [undefined, nameOrHost];
    return { host, user };
  }

  const available = Object.keys(profiles);
  const hint = available.length
    ? `Available profiles: ${available.join(', ')}`
    : 'No profiles configured. Create .nex/servers.json (project) or ~/.nex/servers.json (global)';
  throw new Error(`Unknown server: "${nameOrHost}". ${hint}`);
}

// ─── SSH Execution ────────────────────────────────────────────

/**
 * Ensure the ControlMaster socket directory exists.
 */
function ensureSocketDir() {
  if (!fs.existsSync(SSH_SOCKET_DIR)) {
    fs.mkdirSync(SSH_SOCKET_DIR, { recursive: true });
  }
}

/**
 * Build SSH CLI args for a profile.
 * Includes ControlMaster for connection reuse (big speed win on repeated calls).
 * @param {ServerProfile} profile
 * @returns {{ args: string[], target: string }}
 */
function buildSSHArgs(profile) {
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ServerAliveInterval=30',
  ];

  if (profile.key) {
    args.push('-i', profile.key.replace(/^~/, os.homedir()));
  }

  if (profile.port && Number(profile.port) !== 22) {
    args.push('-p', String(profile.port));
  }

  // ControlMaster: reuse existing connection if available
  ensureSocketDir();
  const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
  const socketPath = path.join(SSH_SOCKET_DIR, target.replace(/[@.:]/g, '_'));
  args.push(
    '-o', 'ControlMaster=auto',
    '-o', `ControlPath=${socketPath}`,
    '-o', 'ControlPersist=120',
  );

  args.push(target);
  return { args, target };
}

/**
 * Build SCP CLI args for a profile.
 * @param {ServerProfile} profile
 * @returns {string[]}
 */
function buildSCPArgs(profile) {
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-r', // recursive by default (handles files + dirs)
  ];

  if (profile.key) {
    args.push('-i', profile.key.replace(/^~/, os.homedir()));
  }

  if (profile.port && Number(profile.port) !== 22) {
    args.push('-P', String(profile.port));
  }

  return args;
}

/**
 * Execute a command on a remote server via SSH.
 * @param {ServerProfile} profile
 * @param {string} command - Shell command to run on the remote
 * @param {Object} opts
 * @param {number} [opts.timeout=30000]
 * @param {boolean} [opts.sudo=false] - Wrap in sudo if profile.sudo=true
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, error?: string}>}
 */
async function sshExec(profile, command, { timeout = 30000, sudo = false } = {}) {
  const { args } = buildSSHArgs(profile);
  const remoteCmd = (sudo && profile.sudo) ? `sudo sh -c ${JSON.stringify(command)}` : command;

  try {
    const { stdout, stderr } = await execFileAsync('ssh', [...args, remoteCmd], {
      timeout,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 };
  } catch (e) {
    const exitCode = typeof e.code === 'number' ? e.code : 1;
    const stderr = (e.stderr || e.message || '').toString();
    const stdout = (e.stdout || '').toString();
    return {
      stdout,
      stderr,
      exitCode,
      error: enrichSSHError(stderr, profile),
    };
  }
}

/**
 * Upload a local file or directory to a remote server via SCP.
 * @param {ServerProfile} profile
 * @param {string} localPath
 * @param {string} remotePath
 * @param {Object} [opts]
 * @param {number} [opts.timeout=120000]
 * @returns {Promise<string>} Result message
 */
async function scpUpload(profile, localPath, remotePath, { timeout = 120000 } = {}) {
  const args = buildSCPArgs(profile);
  const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
  args.push(localPath, `${target}:${remotePath}`);

  try {
    const { stdout, stderr } = await execFileAsync('scp', args, { timeout, maxBuffer: 1024 * 1024 });
    return stdout || stderr || `Uploaded ${localPath} → ${target}:${remotePath}`;
  } catch (e) {
    const err = (e.stderr || e.message || '').toString();
    throw new Error(enrichSSHError(err, profile) || err);
  }
}

/**
 * Download a file or directory from a remote server via SCP.
 * @param {ServerProfile} profile
 * @param {string} remotePath
 * @param {string} localPath
 * @param {Object} [opts]
 * @param {number} [opts.timeout=120000]
 * @returns {Promise<string>} Result message
 */
async function scpDownload(profile, remotePath, localPath, { timeout = 120000 } = {}) {
  const args = buildSCPArgs(profile);
  const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
  args.push(`${target}:${remotePath}`, localPath);

  try {
    const { stdout, stderr } = await execFileAsync('scp', args, { timeout, maxBuffer: 1024 * 1024 });
    return stdout || stderr || `Downloaded ${target}:${remotePath} → ${localPath}`;
  } catch (e) {
    const err = (e.stderr || e.message || '').toString();
    throw new Error(enrichSSHError(err, profile) || err);
  }
}

// ─── Error Enrichment ─────────────────────────────────────────

/**
 * Enrich SSH error messages with actionable hints.
 * @param {string} stderr
 * @param {ServerProfile} profile
 * @returns {string} Enriched error message
 */
function enrichSSHError(stderr, profile) {
  if (!stderr) return '';

  if (/connection refused/i.test(stderr)) {
    const port = profile.port || 22;
    return `${stderr}\nHINT: Connection refused on ${profile.host}:${port}. Check: server is running, SSH service is active (systemctl status sshd), firewall allows port ${port} (firewall-cmd --list-ports).`;
  }

  if (/permission denied/i.test(stderr)) {
    const keyInfo = profile.key ? `key: ${profile.key}` : 'SSH agent';
    return `${stderr}\nHINT: Auth failed using ${keyInfo} as user "${profile.user || 'root'}". Check: authorized_keys on server, correct username, key passphrase.`;
  }

  if (/no route to host|network unreachable|name or service not known/i.test(stderr)) {
    return `${stderr}\nHINT: Cannot reach ${profile.host}. Check: network connection, correct hostname/IP, DNS resolution.`;
  }

  if (/host key verification failed/i.test(stderr)) {
    return `${stderr}\nHINT: Host key changed for ${profile.host}. To reset: ssh-keygen -R ${profile.host}`;
  }

  if (/timed out/i.test(stderr)) {
    return `${stderr}\nHINT: Connection timed out to ${profile.host}. Check firewall rules and network connectivity.`;
  }

  if (/too many authentication failures/i.test(stderr)) {
    return `${stderr}\nHINT: Too many auth attempts. Add "-o IdentitiesOnly=yes -i ${profile.key || '~/.ssh/id_rsa'}" or clear your SSH agent keys.`;
  }

  return stderr;
}

// ─── Profile Info ─────────────────────────────────────────────

/**
 * Format a profile for display.
 * @param {string} name
 * @param {ServerProfile} profile
 * @returns {string}
 */
function formatProfile(name, profile) {
  const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
  const portStr = profile.port && Number(profile.port) !== 22 ? `:${profile.port}` : '';
  const osStr = profile.os ? ` [${profile.os}]` : '';
  const keyStr = profile.key ? ` key:${profile.key}` : '';
  const sudoStr = profile.sudo ? ' sudo:yes' : '';
  return `${name}: ${target}${portStr}${osStr}${keyStr}${sudoStr}`;
}

module.exports = {
  loadServerProfiles,
  resolveProfile,
  buildSSHArgs,
  sshExec,
  scpUpload,
  scpDownload,
  enrichSSHError,
  formatProfile,
  SSH_SOCKET_DIR,
};

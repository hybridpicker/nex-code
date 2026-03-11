/**
 * cli/server-context.js — Server-Aware System Prompt Context
 *
 * Reads .nex/servers.json and injects OS-specific knowledge into the system prompt.
 * The agent gets context about available servers, OS-specific commands, and platform hints.
 */

const { loadServerProfiles } = require('./ssh');

// OS-specific knowledge injected into the system prompt
const OS_HINTS = {
  almalinux9: [
    'Package manager: dnf (NOT apt). Install: dnf install <pkg>. Update: dnf update.',
    'Service manager: systemctl. Logs: journalctl -u <service> -n 50.',
    'Firewall: firewalld. Check: firewall-cmd --list-all. Open port: firewall-cmd --permanent --add-port=PORT/tcp && firewall-cmd --reload.',
    'SELinux is active by default. Check: getenforce. Diagnose: ausearch -m avc -ts recent | audit2why. Fix context: restorecon -Rv /path.',
    'Nginx config: /etc/nginx/. Test: nginx -t. Reload: systemctl reload nginx.',
    'Process list: ps aux. Ports: ss -tuln.',
    'Python: python3. Pip: pip3. Virtualenv: python3 -m venv.',
  ],
  almalinux8: [
    'Package manager: dnf (NOT apt). Install: dnf install <pkg>. Update: dnf update.',
    'Service manager: systemctl. Logs: journalctl -u <service> -n 50.',
    'Firewall: firewalld. Check: firewall-cmd --list-all.',
    'SELinux is active by default. Check: getenforce. Diagnose: ausearch -m avc -ts recent.',
  ],
  ubuntu: [
    'Package manager: apt. Install: apt install <pkg>. Update: apt update && apt upgrade.',
    'Service manager: systemctl. Logs: journalctl -u <service> -n 50.',
    'Firewall: ufw. Status: ufw status. Allow port: ufw allow PORT/tcp.',
    'SELinux NOT active by default (AppArmor instead). Check: aa-status.',
  ],
  debian: [
    'Package manager: apt. Install: apt install <pkg>. Update: apt update && apt upgrade.',
    'Service manager: systemctl. Logs: journalctl -u <service> -n 50.',
    'Firewall: ufw or iptables.',
  ],
  macos: [
    'Package manager: Homebrew (brew). Install: brew install <pkg>. Update: brew update && brew upgrade.',
    'Service manager: launchctl (NOT systemctl). Start: brew services start <name>. List: brew services list.',
    'No systemd. No journalctl. Use: log show --predicate \'process == "nginx"\' --last 1h instead.',
    'Firewall: macOS built-in (pfctl or System Settings). Check: pfctl -s rules.',
    'Process list: ps aux. Ports: lsof -i -n -P | grep LISTEN.',
  ],
};

/**
 * Build the server context section for the system prompt.
 * Returns null if no servers are configured.
 * @returns {string|null}
 */
function getServerContext() {
  const profiles = loadServerProfiles();
  const names = Object.keys(profiles);
  if (names.length === 0) return null;

  const lines = ['## Remote Servers (.nex/servers.json)'];
  lines.push('');
  lines.push('Available server profiles (use with ssh_exec, ssh_upload, ssh_download, service_manage, service_logs, container_list, container_logs, container_exec, container_manage, deploy):');

  for (const [name, profile] of Object.entries(profiles)) {
    const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
    const portStr = profile.port && Number(profile.port) !== 22 ? `:${profile.port}` : '';
    const osStr = profile.os ? ` — OS: ${profile.os}` : '';
    const sudoStr = profile.sudo ? ', sudo available' : '';
    lines.push(`- **${name}**: ${target}${portStr}${osStr}${sudoStr}`);
  }

  // Collect unique OS types and inject their hints
  const osSeen = new Set();
  for (const profile of Object.values(profiles)) {
    if (profile.os && OS_HINTS[profile.os]) osSeen.add(profile.os);
  }

  if (osSeen.size > 0) {
    lines.push('');
    for (const os of osSeen) {
      const label = {
        almalinux9: 'AlmaLinux 9',
        almalinux8: 'AlmaLinux 8',
        ubuntu: 'Ubuntu',
        debian: 'Debian',
        macos: 'macOS',
      }[os] || os;
      lines.push(`### ${label} Notes`);
      for (const hint of OS_HINTS[os]) lines.push(`- ${hint}`);
    }
  }

  return lines.join('\n');
}

/**
 * Check if any configured server has a given OS type prefix.
 * @param {string} osPrefix - e.g. 'almalinux', 'macos', 'ubuntu'
 * @returns {boolean}
 */
function hasServerOS(osPrefix) {
  const profiles = loadServerProfiles();
  return Object.values(profiles).some(p => p.os && p.os.startsWith(osPrefix));
}

/**
 * Get list of all configured profile names.
 * @returns {string[]}
 */
function getProfileNames() {
  return Object.keys(loadServerProfiles());
}

module.exports = { getServerContext, hasServerOS, getProfileNames, OS_HINTS };

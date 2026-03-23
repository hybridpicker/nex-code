/**
 * cli/server-context.js — Server-Aware System Prompt Context
 *
 * Reads .nex/servers.json and injects OS-specific knowledge into the system prompt.
 * The agent gets context about available servers, OS-specific commands, and platform hints.
 */

const { loadServerProfiles } = require("./ssh");

// OS-specific knowledge injected into the system prompt
const OS_HINTS = {
  almalinux9: [
    "Package manager: dnf (NOT apt). Install: dnf install <pkg>. Update: dnf update.",
    "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
    "Firewall: firewalld. Check: firewall-cmd --list-all. Open port: firewall-cmd --permanent --add-port=PORT/tcp && firewall-cmd --reload.",
    "SELinux is active by default. Check: getenforce. Diagnose: ausearch -m avc -ts recent | audit2why. Fix context: restorecon -Rv /path.",
    "Nginx config: /etc/nginx/. Test: nginx -t. Reload: systemctl reload nginx.",
    "Process list: ps aux. Ports: ss -tuln.",
    "Python: python3. Pip: pip3. Virtualenv: python3 -m venv.",
  ],
  almalinux8: [
    "Package manager: dnf (NOT apt). Install: dnf install <pkg>. Update: dnf update.",
    "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
    "Firewall: firewalld. Check: firewall-cmd --list-all.",
    "SELinux is active by default. Check: getenforce. Diagnose: ausearch -m avc -ts recent.",
  ],
  ubuntu: [
    "Package manager: apt. Install: apt install <pkg>. Update: apt update && apt upgrade.",
    "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
    "Firewall: ufw. Status: ufw status. Allow port: ufw allow PORT/tcp.",
    "SELinux NOT active by default (AppArmor instead). Check: aa-status.",
  ],
  debian: [
    "Package manager: apt. Install: apt install <pkg>. Update: apt update && apt upgrade.",
    "Service manager: systemctl. Logs: journalctl -u <service> -n 50.",
    "Firewall: ufw or iptables.",
  ],
  macos: [
    "Package manager: Homebrew (brew). Install: brew install <pkg>. Update: brew update && brew upgrade.",
    "Service manager: launchctl (NOT systemctl). Start: brew services start <name>. List: brew services list.",
    "No systemd. No journalctl. Use: log show --predicate 'process == \"nginx\"' --last 1h instead.",
    "Firewall: macOS built-in (pfctl or System Settings). Check: pfctl -s rules.",
    "Process list: ps aux. Ports: lsof -i -n -P | grep LISTEN.",
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

  const lines = ["## Remote Servers (.nex/servers.json)"];
  lines.push("");
  lines.push(
    "Available server profiles (use with ssh_exec, ssh_upload, ssh_download, service_manage, service_logs, container_list, container_logs, container_exec, container_manage, deploy):",
  );

  for (const [name, profile] of Object.entries(profiles)) {
    const target = profile.user
      ? `${profile.user}@${profile.host}`
      : profile.host;
    const portStr =
      profile.port && Number(profile.port) !== 22 ? `:${profile.port}` : "";
    const osStr = profile.os ? ` — OS: ${profile.os}` : "";
    const sudoStr = profile.sudo ? ", sudo available" : "";
    lines.push(`- **${name}**: ${target}${portStr}${osStr}${sudoStr}`);
  }

  // Collect unique OS types and inject their hints
  const osSeen = new Set();
  for (const profile of Object.values(profiles)) {
    if (profile.os && OS_HINTS[profile.os]) osSeen.add(profile.os);
  }

  if (osSeen.size > 0) {
    lines.push("");
    for (const os of osSeen) {
      const label =
        {
          almalinux9: "AlmaLinux 9",
          almalinux8: "AlmaLinux 8",
          ubuntu: "Ubuntu",
          debian: "Debian",
          macos: "macOS",
        }[os] || os;
      lines.push(`### ${label} Notes`);
      for (const hint of OS_HINTS[os]) lines.push(`- ${hint}`);
    }
  }

  return lines.join("\n");
}

/**
 * Check if any configured server has a given OS type prefix.
 * @param {string} osPrefix - e.g. 'almalinux', 'macos', 'ubuntu'
 * @returns {boolean}
 */
function hasServerOS(osPrefix) {
  const profiles = loadServerProfiles();
  return Object.values(profiles).some((p) => p.os && p.os.startsWith(osPrefix));
}

/**
 * Get list of all configured profile names.
 * @returns {string[]}
 */
function getProfileNames() {
  return Object.keys(loadServerProfiles());
}

/**
 * Build a deployment context block for the system prompt.
 * Activates when server profiles are configured AND NEX.md contains deployment indicators.
 * This block is injected prominently so the model understands remote vs local context
 * before attempting any file reads or debugging actions.
 *
 * Reads NEX.md from the project root automatically.
 * @returns {string|null} - Formatted block, or null if not a deployed project
 */
function getDeploymentContextBlock() {
  const fs = require("fs");
  const path = require("path");
  const nexMdPath = path.join(process.cwd(), "NEX.md");
  let nexMdContent = "";
  try {
    nexMdContent = fs.readFileSync(nexMdPath, "utf-8");
  } catch {
    /* no NEX.md */
  }
  const profiles = loadServerProfiles();
  const profileNames = Object.keys(profiles);
  if (profileNames.length === 0) return null;

  // Only activate if NEX.md signals this is a deployed/remote application
  const deploymentKeywords = [
    "server",
    "deploy",
    "remote",
    "ssh",
    "service",
    "systemctl",
    "production",
    "linux",
    "almalinux",
    "ubuntu",
    "debian",
  ];
  const nexLower = nexMdContent.toLowerCase();
  const isDeployedProject = deploymentKeywords.some((kw) =>
    nexLower.includes(kw),
  );
  if (!isDeployedProject) return null;

  const serverList = profileNames
    .map((name) => {
      const p = profiles[name];
      const target = p.user ? `${p.user}@${p.host}` : p.host;
      const portStr = p.port && Number(p.port) !== 22 ? `:${p.port}` : "";
      return `  - **${name}**: ${target}${portStr}${p.os ? ` (${p.os})` : ""}`;
    })
    .join("\n");

  // Collect server log paths from profiles if specified
  const logPaths = profileNames
    .map((n) => profiles[n].log_path)
    .filter(Boolean);
  const logHint =
    logPaths.length > 0 ? `\n- Server log paths: ${logPaths.join(", ")}` : "";

  return `# Deployment Context (Auto-detected)

This project is deployed on a **remote server**. The application runs as a service there — NOT locally.

## Configured Servers
${serverList}

## Critical Debugging Rules

**When you receive an error or warning from the running application** (e.g. "500 ERR_BAD_RESPONSE", "⚠️ service error", health check failures, service alerts):
- ✅ Use \`ssh_exec\` or \`service_logs\` to investigate on the remote server
- ✅ \`ssh_exec\` example: \`tail -50 /path/to/logs/api.log\`
- ✅ \`service_logs\` or \`bash\` with \`ssh\` to check \`systemctl status <service>\`${logHint}
- ❌ Do NOT \`read_file\` on paths like \`logs/\` — these files do not exist locally
- ❌ Do NOT \`list_directory\` on server paths — the local project is the source, not the running instance

**When in doubt:** If a path contains \`logs/\`, \`/var/log/\`, or \`/home/<user>/\` — it is on the server. SSH there.`;
}

module.exports = {
  getServerContext,
  getDeploymentContextBlock,
  hasServerOS,
  getProfileNames,
  OS_HINTS,
};

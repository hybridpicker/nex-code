const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DIFF_EXCLUDES = [
  "--",
  ".",
  ":!*.lock",
  ":!*.min.js",
  ":!*.min.css",
  ":!package-lock.json",
  ":!yarn.lock",
  ":!dist/",
  ":!tests/hooks-pre-push.test.js",
];

const TEST_FILE_PATTERN =
  /(^|\/)(tests\/.*\.test\.(js|ts|jsx|tsx)|__tests__\/.*\.(js|ts|jsx|tsx))$/i;

const SECRET_PATTERNS = [
  { category: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/i },
  {
    category: "Anthropic API Key",
    regex: /sk-ant-api03-[a-zA-Z0-9-]{90,}/i,
  },
  {
    category: "Google Gemini API Key",
    regex: /AIzaSy[a-zA-Z0-9_-]{30,45}/i,
  },
  { category: "AWS Access Key", regex: /AKIA[A-Z0-9]{16}/i },
  { category: "GitHub Token (ghp_)", regex: /ghp_[a-zA-Z0-9]{36}/i },
  { category: "GitHub OAuth (gho_)", regex: /gho_[a-zA-Z0-9]{36}/i },
  { category: "GitHub App Token (ghs_)", regex: /ghs_[a-zA-Z0-9]{36}/i },
  {
    category: "GitHub Fine-Grained Token",
    regex: /github_pat_[a-zA-Z0-9_]{20,}/i,
  },
  { category: "Slack Token", regex: /xox[bpors]-[a-zA-Z0-9-]+/i },
  {
    category: "Private Key",
    regex: /BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY/i,
  },
  {
    category: "Database URL",
    regex: /\b(postgres|mongodb|mysql|redis):\/\/[^"'\s]+/i,
  },
  {
    category: "Credential URL",
    regex: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@[^/\s]+/i,
  },
  {
    category: "Hardcoded Secret",
    regex:
      /(password|secret|token|api_key|apikey|api_secret|access_token|auth_token|credentials)\s*[:=]\s*['"][^'"]{8,}/i,
  },
  {
    category: "SSH + IP",
    regex: /\bssh\s+.*@[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\b/i,
  },
  {
    category: "SSH Config HostName",
    regex: /\bHostName\s+[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\b/i,
  },
  {
    category: "Server IP Assignment",
    regex:
      /\b(host|hostname|server|server_ip|public_ip|private_ip|vps_ip|ssh_host|remote_host|db_host)\b\s*[:=]\s*['"]?[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+['"]?/i,
  },
  {
    category: ".env Secret Assignment",
    regex:
      /\b(API_KEY|SECRET_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|ACCESS_KEY|AUTH_TOKEN|DB_PASSWORD|DATABASE_URL)\s*=/i,
  },
];

const SAFE_ENV_FILE_PATTERN =
  /(^|\/)\.env(?:\.[^/]+)?\.(example|sample|template)$/i;

const SENSITIVE_FILE_RULES = [
  { category: "Sensitive Env File", regex: /(^|\/)\.env(?:\.[^/]+)?$/i },
  { category: "Private Key File", regex: /(^|\/)(id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|.*\.key)$/i },
  { category: "Certificate Bundle", regex: /(^|\/).*\.(p12|pfx|mobileprovision)$/i },
  { category: "Terraform Secrets", regex: /(^|\/).*\.(tfvars|tfstate)(\..+)?$/i },
  { category: "Credential File", regex: /(^|\/)(\.npmrc|\.netrc)$/i },
  { category: "Cloud Credentials", regex: /(^|\/)\.(aws\/credentials|kube\/config)$/i },
];

function runGit(args, cwd = process.cwd()) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function getRepoRoot(cwd = process.cwd()) {
  return runGit(["rev-parse", "--show-toplevel"], cwd).trim();
}

function loadAllowlist(repoRoot) {
  const filePath = path.join(repoRoot, ".nex", "push-allowlist");
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function isAllowlisted(candidate, allowlist) {
  return allowlist.some((allowed) => candidate.includes(allowed));
}

function isSafeExampleFile(filePath) {
  return SAFE_ENV_FILE_PATTERN.test(filePath);
}

function scanFileNames(filePaths, allowlist) {
  const violations = [];

  for (const filePath of filePaths) {
    if (isSafeExampleFile(filePath)) continue;

    for (const rule of SENSITIVE_FILE_RULES) {
      if (!rule.regex.test(filePath)) continue;
      if (isAllowlisted(filePath, allowlist)) continue;
      violations.push({
        category: rule.category,
        location: filePath,
        preview: filePath,
      });
    }
  }

  return violations;
}

function extractAddedLines(diffText) {
  const lines = diffText.split("\n");
  const addedLines = [];
  let currentFile = "";

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];

    if (raw.startsWith("+++ b/")) {
      currentFile = raw.slice(6);
      continue;
    }

    if (!raw.startsWith("+") || raw.startsWith("+++")) continue;

    addedLines.push({
      filePath: currentFile,
      lineNumber: index + 1,
      text: raw.slice(1),
      raw,
    });
  }

  return addedLines;
}

function scanDiffText(diffText, allowlist) {
  const violations = [];

  for (const line of extractAddedLines(diffText)) {
    if (TEST_FILE_PATTERN.test(line.filePath || "")) continue;

    for (const pattern of SECRET_PATTERNS) {
      if (!pattern.regex.test(line.text)) continue;
      if (isAllowlisted(line.raw, allowlist) || isAllowlisted(line.text, allowlist)) {
        continue;
      }
      violations.push({
        category: pattern.category,
        location: `${line.lineNumber}:${line.raw}`,
        preview: line.raw,
      });
    }
  }

  return violations;
}

function getStagedFiles(repoRoot) {
  const output = runGit(
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    repoRoot,
  );
  return output.split("\0").filter(Boolean);
}

function getDiffForRange(repoRoot, range) {
  return runGit(["diff", range, ...DIFF_EXCLUDES], repoRoot);
}

function getStagedDiff(repoRoot) {
  return runGit(["diff", "--cached", ...DIFF_EXCLUDES], repoRoot);
}

function scanRepo({ repoRoot, mode, range }) {
  const allowlist = loadAllowlist(repoRoot);
  const filePaths = mode === "staged" ? getStagedFiles(repoRoot) : [];
  const fileViolations = scanFileNames(filePaths, allowlist);
  const diffText = mode === "range" ? getDiffForRange(repoRoot, range) : getStagedDiff(repoRoot);
  const diffViolations = scanDiffText(diffText, allowlist);

  return [...fileViolations, ...diffViolations];
}

function formatViolations(violations) {
  return violations
    .map((violation) => `  [${violation.category}]\n${violation.location}`)
    .join("\n");
}

function parseArgs(argv) {
  const args = { mode: "staged", range: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--staged") args.mode = "staged";
    if (argv[i] === "--range") {
      args.mode = "range";
      args.range = argv[i + 1] || "";
      i++;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = getRepoRoot();
  const violations = scanRepo({ repoRoot, mode: args.mode, range: args.range });

  if (violations.length === 0) return;

  const scope = args.mode === "range" ? "pushed commits" : "staged changes";
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  SECRET DETECTED — operation blocked                   ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(
    `║  Found ${violations.length} potential secret(s) in ${scope}:`,
  );
  console.log(formatViolations(violations));
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  Remove secrets or move them to local-only config.     ║");
  console.log("║  To allowlist: add a specific pattern to .nex/push-allowlist");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  SECRET_PATTERNS,
  SENSITIVE_FILE_RULES,
  scanDiffText,
  scanFileNames,
  scanRepo,
  isSafeExampleFile,
};

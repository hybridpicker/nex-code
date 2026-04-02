/**
 * cli/tools.js — Tool Definitions + Implementations
 */

const fs = require("fs").promises;
const fsSync = require("fs"); // Keep sync version for binary check and simple checks if needed
const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const execFile = require("util").promisify(require("child_process").execFile);
const { spawnSync } = require("child_process");
const axios = require("axios");
const {
  isForbidden,
  isSSHForbidden,
  isDangerous,
  isCritical,
  isBashPathForbidden,
  confirm,
} = require("../safety");
const {
  showDiff,
  showNewFile,
  showEditDiff,
  confirmFileChange,
} = require("../diff");
const { C, Spinner, getToolSpinnerText } = require("../ui");
const { isGitRepo, getCurrentBranch, getStatus, getDiff } = require("../git");
const { recordChange } = require("../file-history");
const { fuzzyFindText, findMostSimilar } = require("../fuzzy-match");
const { runDiagnostics } = require("../diagnostics");
const { findFileInIndex, getFileIndex } = require("../index-engine");
const { resolveProfile, sshExec, scpUpload, scpDownload } = require("../ssh");
const { resolveDeployConfig, loadDeployConfigs } = require("../deploy-config");
const { getEditMode } = require("../tool-tiers");

// Use process.cwd() dynamically to support tests mocking it

// ─── Interactive Command Detection ────────────────────────────
// Commands that require a PTY / raw terminal (spawned with stdio:inherit)
const INTERACTIVE_CMDS =
  /^(vim?|nano|emacs|pico|less|more|top|htop|iftop|iotop|glances|telnet\s|screen|tmux|fzf|gum|dialog|whiptail|man\s|node\s*$|python3?\s*$|irb\s*$|rails\s*c|psql\s|mysql\s|redis-cli|mongosh?|sqlite3)\b/;
// SSH is interactive only when logging in without a remote command.
// `ssh host "cmd"` / `ssh host cmd` are non-interactive — output must be captured.
const SSH_INTERACTIVE_RE = /^ssh\s/;
const SSH_HAS_REMOTE_CMD_RE = /^ssh(?:\s+-\S+)*\s+\S+@?\S+\s+["']?[^-]/;

/** Check if a file exists (async). */
async function fileExists(fp) {
  return fs
    .access(fp)
    .then(() => true)
    .catch(() => false);
}

// ─── Auto-Fix Helpers ─────────────────────────────────────────

/**
 * Auto-fix file path: try to find the correct file when path doesn't exist.
 * Strategies:
 * 1. Normalize path (remove double slashes, expand ~)
 * 2. Try basename glob (e.g. "src/comp/Button.tsx" → glob for "Button.tsx")
 * 3. Try with/without common extensions (.js, .ts, .jsx, .tsx, .mjs)
 * @param {string} originalPath - The path that wasn't found
 * @returns {{ fixedPath: string|null, message: string }}
 */
async function autoFixPath(originalPath) {
  if (!originalPath) return { fixedPath: null, message: "" };

  // Strategy 1: normalize path issues
  let normalized = originalPath
    .replace(/\/+/g, "/") // double slashes
    .replace(/^~\//, `${require("os").homedir()}/`); // expand ~
  const np = resolvePath(normalized);
  if (np && (await fileExists(np))) {
    return {
      fixedPath: np,
      message: `(auto-fixed path: ${originalPath} → ${normalized})`,
    };
  }

  // Strategy 2: try with/without extensions
  const extVariants = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".json"];
  const hasExt = path.extname(originalPath);
  if (!hasExt) {
    for (const ext of extVariants) {
      const withExt = resolvePath(originalPath + ext);
      if (withExt && (await fileExists(withExt))) {
        return {
          fixedPath: withExt,
          message: `(auto-fixed: added ${ext} extension)`,
        };
      }
    }
  }
  // Try stripping extension and trying others
  if (hasExt) {
    const base = originalPath.replace(/\.[^.]+$/, "");
    for (const ext of extVariants) {
      if (ext === hasExt) continue;
      const alt = resolvePath(base + ext);
      if (alt && (await fileExists(alt))) {
        return { fixedPath: alt, message: `(auto-fixed: ${hasExt} → ${ext})` };
      }
    }
  }

  // Strategy 3: search for basename in index
  const basename = path.basename(originalPath);
  if (basename && basename.length > 2) {
    try {
      const found = findFileInIndex(basename).map((f) => resolvePath(f));
      if (found.length === 1) {
        return {
          fixedPath: found[0],
          message: `(auto-fixed: found ${basename} at ${path.relative(process.cwd(), found[0])})`,
        };
      }
      if (found.length > 1 && found.length <= 5) {
        const relative = found.map((f) => path.relative(process.cwd(), f));
        return {
          fixedPath: null,
          message: `File not found. Did you mean one of:\n${relative.map((r) => `  - ${r}`).join("\n")}`,
        };
      }
    } catch {
      /* index search failed, skip */
    }
  }

  return { fixedPath: null, message: "" };
}

/**
 * Return a recovery hint when a command is blocked, suggesting safe alternatives.
 * @param {string} cmd
 * @returns {string}
 */
function getBlockedHint(cmd) {
  if (/\bprintenv\b/.test(cmd)) {
    return "printenv exposes all secrets. Use `echo $VAR_NAME` for a single variable, or `env | grep PATTERN` for filtered output.";
  }
  if (/cat\s+.*\.env\b/.test(cmd)) {
    return 'Reading .env directly is blocked. Use `grep -v "KEY=" .env` to inspect non-secret entries, or ask the user to share specific values.';
  }
  if (/cat\s+.*credentials/i.test(cmd)) {
    return "Credentials files are blocked. Reference the variable name from the application config instead.";
  }
  if (/python3?\s+-c\s/.test(cmd)) {
    return "Inline python -c is blocked. Write a temporary script file and run it with `python3 script.py` instead.";
  }
  if (/node\s+-e\s/.test(cmd)) {
    return "Inline node -e is blocked. Write a temporary script file and run it with `node script.js` instead.";
  }
  if (/curl.*-X\s*POST|curl.*--data/.test(cmd)) {
    return "curl POST is blocked to prevent data exfiltration. Use the application's own API client or ask the user to run the request.";
  }
  if (/base64.*\|.*bash/.test(cmd)) {
    return "Piping base64-decoded content to bash is blocked. Decode the content first, inspect it, then run explicitly.";
  }
  if (/\beval\s*\(/.test(cmd)) {
    return "eval is blocked. Execute the command directly without eval.";
  }
  if (/(?:^|[;&|]\s*)history(?:\s|$)/.test(cmd)) {
    return "Shell history is blocked. Look at git log or project files for context instead.";
  }
  if (/\bsed\s+-n\s+['"]?\d+,\d+p/.test(cmd)) {
    return 'sed -n line-range scrolling floods context with irrelevant lines. Use targeted grep instead: grep -n "ERROR\\|pattern" <logfile> | tail -20';
  }
  return "";
}

/**
 * Enrich bash error output with actionable hints.
 * @param {string} errorOutput - Raw stderr/stdout from bash
 * @param {string} command - The command that was run
 * @returns {string} Enriched error message
 */
function enrichBashError(errorOutput, command) {
  const hints = [];

  // Command not found
  if (/command not found|: not found|not recognized/i.test(errorOutput)) {
    const cmdMatch = command.match(/^(\S+)/);
    const cmd = cmdMatch ? cmdMatch[1] : "";
    if (/^(npx|npm|node|yarn|pnpm|bun)$/.test(cmd)) {
      hints.push(
        "HINT: Node.js/npm may not be in PATH. Check your Node.js installation.",
      );
    } else if (/^(python|python3|pip|pip3)$/.test(cmd)) {
      hints.push(
        "HINT: Python may not be installed. Try: brew install python3 (macOS) or apt install python3 (Linux)",
      );
    } else {
      hints.push(
        `HINT: "${cmd}" is not installed. Try installing it with your package manager.`,
      );
    }
  }

  // Module not found (Node.js)
  if (/Cannot find module|MODULE_NOT_FOUND/i.test(errorOutput)) {
    const modMatch = errorOutput.match(/Cannot find module '([^']+)'/);
    const mod = modMatch ? modMatch[1] : "";
    if (mod && !mod.startsWith(".") && !mod.startsWith("/")) {
      hints.push(`HINT: Missing npm package "${mod}". Run: npm install ${mod}`);
    } else {
      hints.push(
        "HINT: Module not found. Check the import path or run npm install.",
      );
    }
  }

  // Permission denied
  if (/permission denied|EACCES/i.test(errorOutput)) {
    hints.push(
      "HINT: Permission denied. Check file permissions or try a different approach.",
    );
  }

  // Port already in use
  if (/EADDRINUSE|address already in use/i.test(errorOutput)) {
    const portMatch = errorOutput.match(/port (\d+)|:(\d+)/);
    const port = portMatch ? portMatch[1] || portMatch[2] : "";
    hints.push(
      `HINT: Port ${port || ""} is already in use. Kill the process or use a different port.`,
    );
  }

  // Syntax error
  if (/SyntaxError|Unexpected token/i.test(errorOutput)) {
    hints.push(
      "HINT: Syntax error in the code. Check the file at the line number shown above.",
    );
  }

  // TypeScript errors
  if (/TS\d{4}:/i.test(errorOutput)) {
    hints.push(
      "HINT: TypeScript compilation error. Fix the type issue at the indicated line.",
    );
  }

  // Jest/test failures
  if (/Test Suites:.*failed|Tests:.*failed/i.test(errorOutput)) {
    hints.push(
      "HINT: Test failures detected. Read the error output above to identify failing tests.",
    );
  }

  // Git errors
  if (/fatal: not a git repository/i.test(errorOutput)) {
    hints.push(
      "HINT: Not inside a git repository. Run git init or cd to a git project.",
    );
  }

  // curl exit codes
  if (/^curl\b/.test(command)) {
    const exitMatch = errorOutput.match(/curl:\s*\((\d+)\)/);
    const curlCode = exitMatch ? parseInt(exitMatch[1], 10) : null;
    if (curlCode === 6 || /Could not resolve host/i.test(errorOutput)) {
      hints.push(
        "HINT: Hostname could not be resolved. Check DNS or use an IP address directly.",
      );
    } else if (
      curlCode === 7 ||
      /Failed to connect|Connection refused/i.test(errorOutput)
    ) {
      hints.push(
        "HINT: Service not running or port wrong. Check if the service is up and the port is correct.",
      );
    } else if (curlCode === 22 || /HTTP error/i.test(errorOutput)) {
      hints.push(
        "HINT: HTTP 4xx/5xx response. The endpoint exists but returned an error status.",
      );
    } else if (curlCode === 28 || /timed out/i.test(errorOutput)) {
      hints.push(
        "HINT: Request timed out. The host may be unreachable or the service is slow.",
      );
    } else if (curlCode === 35 || /SSL.*error/i.test(errorOutput)) {
      hints.push(
        "HINT: SSL/TLS handshake failed. Try with --insecure to bypass, or check the certificate.",
      );
    }
  }

  // SSH tunnel errors
  if (/remote port forwarding failed/i.test(errorOutput)) {
    const portMatch = errorOutput.match(/port (\d+)/);
    const port = portMatch ? portMatch[1] : "";
    hints.push(
      `HINT: SSH remote port forwarding failed for port ${port}. The port may already be bound on the server. ` +
        `Check with: ssh server "ss -tuln | grep ${port}" and kill any lingering process with that port.`,
    );
  }
  if (
    /bind.*Cannot assign requested address|Address already in use/i.test(
      errorOutput,
    )
  ) {
    hints.push(
      "HINT: Port is already in use. Find the process with: ss -tuln | grep <port> and kill it, then retry.",
    );
  }
  if (
    /Connection.*timed out|ssh.*timeout/i.test(errorOutput) &&
    /^ssh\b/.test(command)
  ) {
    hints.push(
      "HINT: SSH connection timed out. Check if the host is reachable: ping <host> and verify the port with: nc -zv <host> 22",
    );
  }

  // Working directory deleted — bash cannot spawn a shell when cwd no longer exists
  if (/spawn \/bin\/sh ENOENT|spawn sh ENOENT/i.test(errorOutput)) {
    hints.push(
      "HINT: The working directory was deleted during this session — bash cannot execute commands in a non-existent cwd. Previous rm/delete commands succeeded. Use list_directory or glob to verify the state instead of retrying bash.",
    );
  }

  // Backup pattern warnings
  if (
    /cp.*\$f.*\$f\.bak.*sed.*-i\.bak|sed.*-i\.bak.*cp.*\$f.*\$f\.bak/i.test(
      command,
    )
  ) {
    hints.push(
      'HINT: Using both cp with .bak and sed -i.bak creates double backups (.bak.bak). Choose one method: either cp "$f" "$f.bak" OR sed -i.bak, not both.',
    );
  }

  if (hints.length === 0) return errorOutput;
  return errorOutput + "\n\n" + hints.join("\n");
}

/**
 * Auto-apply a close edit match instead of erroring.
 * If findMostSimilar returns a match with distance ≤ AUTO_APPLY_THRESHOLD,
 * use the similar text as the old_text.
 *
 * @param {string} content - File content
 * @param {string} oldText - The old_text that wasn't found
 * @param {string} newText - The new_text replacement
 * @returns {{ autoFixed: boolean, matchText: string, content: string, distance: number, line: number }|null}
 */
function autoFixEdit(content, oldText, newText) {
  const similar = findMostSimilar(content, oldText);
  if (!similar) return null;

  // Auto-apply threshold: ≤ 3% of target length or ≤ 2 chars difference
  // More conservative to prevent edit loops
  const threshold = Math.max(2, Math.ceil(oldText.length * 0.03));
  if (similar.distance > threshold) return null;

  return {
    autoFixed: true,
    matchText: similar.text,
    content: content.split(similar.text).join(newText),
    distance: similar.distance,
    line: similar.line,
  };
}

// Auto-checkpoint: tag last known state before first agent edit
let _checkpointCreated = false;

// Cancellable ask_user support
let _cancelAskUser = null;
function cancelPendingAskUser() {
  if (_cancelAskUser) {
    _cancelAskUser();
    _cancelAskUser = null;
  }
}

// ask_user handler — set by cli/index.js to render options UI
let _askUserFn = null;
function setAskUserHandler(fn) {
  _askUserFn = fn;
}
async function ensureCheckpoint() {
  if (_checkpointCreated) return;
  _checkpointCreated = true;
  try {
    // Only in git repos with changes
    const { stdout } = await exec("git rev-parse --is-inside-work-tree", {
      cwd: process.cwd(),
      timeout: 5000,
    });
    const isGit = stdout.trim() === "true";
    if (!isGit) return;
    await exec('git stash push -m "nex-code-checkpoint" --include-untracked', {
      cwd: process.cwd(),
      timeout: 10000,
    });
    await exec("git stash pop", { cwd: process.cwd(), timeout: 10000 });
    await exec("git tag -f nex-checkpoint", {
      cwd: process.cwd(),
      timeout: 5000,
    });
  } catch {
    /* not critical */
  }
}

// Sensitive paths that should never be accessed by file tools
const SENSITIVE_PATHS = [
  /\.ssh\//i,
  /\.gnupg\//i,
  /\.aws\//i,
  /\.config\/gcloud/i,
  /\/etc\/shadow/,
  /\/etc\/passwd/,
  /\/etc\/sudoers/,
  /\.env(?:\.|$)/,
  /credentials/i,
  /\.npmrc$/,
  /\.docker\/config\.json/,
  /\.kube\/config/,
];

function resolvePath(p) {
  const resolved = path.isAbsolute(p)
    ? path.resolve(p)
    : path.resolve(process.cwd(), p);
  // Block access to sensitive paths
  for (const pat of SENSITIVE_PATHS) {
    if (pat.test(resolved)) return null;
  }
  return resolved;
}

// ─── Tool Definitions (Ollama format) ─────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Execute a bash command in the project directory. Timeout: 90s (commands that exceed this are killed). Use for: running tests, installing packages, git commands, build tools, starting servers, compiling code. Example: use bash for \"npm install\" or \"git status\", but NOT for \"cat config.json\" (use read_file instead) or \"grep -r 'error' src/\" (use grep tool instead). AVOID using bash for: cat/head/tail (use read_file), sed/awk (use edit_file), find/ls (use glob or list_directory), grep/rg (use grep tool). Using dedicated tools is faster and produces better-formatted output. Always quote file paths containing spaces with double quotes. Check the exit code in output — non-zero means the command failed. For long-running commands (large builds, full test suites), warn the user if they may exceed 90s. Destructive or dangerous commands (rm -rf, git push, npm publish, sudo) require user confirmation.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read a file's contents with line numbers. ALWAYS read a file before editing it to ensure exact content matching — edit_file requires the EXACT text including whitespace and newlines. Example: read_file path=src/app.js line_start=10 line_end=20. Auto-truncates at 350 lines for unbounded reads. For large files (>350 lines), use line_start/line_end to read specific sections. Concrete example: read_file(path='src/app.js', line_start=10, line_end=20) reads lines 10-20 of src/app.js. Prefer this over bash cat/head/tail — dedicated tools produce better-formatted output. Files are read with UTF-8 encoding. IMPORTANT: If you need more than 350 lines, specify line_start and line_end explicitly — omitting them will truncate the output.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "File path (relative or absolute)",
          },
          line_start: {
            type: "number",
            description: "Start line (1-based, optional)",
          },
          line_end: {
            type: "number",
            description: "End line (1-based, optional)",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create a new file or completely overwrite an existing file. Example: use write_file for creating a new config file like .env.example, but NOT for changing one line in an existing file (use edit_file instead). For targeted changes to existing files, prefer edit_file or patch_file instead — they only send the diff and are safer. Only use write_file when creating new files or when the entire content needs to be replaced.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Replace specific text in a file. ALWAYS call read_file first to get the exact content — edit_file requires the EXACT text including whitespace, indentation, and newlines. Example: edit_file(path='src/config.js', old_text='debug: false', new_text='debug: true'). IMPORTANT: old_text must match byte-for-byte — even a single space or newline difference will cause failure. If the edit fails with 'old_text not found', re-read that region with line_start/line_end then retry. For multiple replacements in one file, prefer patch_file (atomic). For new files, use write_file instead.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          old_text: {
            type: "string",
            description:
              "Exact text to find (must match file content precisely)",
          },
          new_text: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List files and directories in a tree view. Use this to understand project structure. Example: use list_directory to see the overall layout of the src/ directory, but NOT for finding all .js files (use glob instead). For finding specific files by pattern, prefer glob instead.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path" },
          max_depth: { type: "number", description: "Max depth (default: 2)" },
          pattern: {
            type: "string",
            description: "File filter glob (e.g. '*.js')",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description:
        "Search for a text pattern across files (regex). Returns matching lines with file paths. Example: use search_files for finding all occurrences of 'error' in .js files, but NOT for finding all .js files (use glob instead). For simple content search, grep is equivalent. For finding files by name, use glob instead.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to search" },
          pattern: { type: "string", description: "Search pattern (regex)" },
          file_pattern: {
            type: "string",
            description: "File filter (e.g. '*.js')",
          },
        },
        required: ["path", "pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "glob",
      description:
        "Find files matching a glob pattern by name or extension. Returns paths sorted by modification time. ALWAYS use this to locate files BEFORE reading them — never guess file paths. Example: glob(pattern='src/**/*.test.js') finds all test files in src directory. DO NOT use for content search (e.g. finding 'error' in files) — use grep tool instead. Examples: '**/*.test.js' (all test files), 'src/**/*.ts' (all TypeScript in src), 'package.json' (find config). Prefer this over bash find/ls. When you need file contents, glob first to get the exact path, then read_file to read it.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.test.js')",
          },
          path: {
            type: "string",
            description: "Base directory (default: project root)",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description:
        "Search file CONTENTS with regex — use this when you need to find text inside files. Example: grep(pattern='callStream') finds files containing the text 'callStream'. Do NOT use glob for this — glob finds files by NAME pattern, grep searches file CONTENTS. Use output_mode='files_with_matches' for just file paths, output_mode='content' (default) for matching lines. Use include to filter by file type (e.g. '*.js'). Supports context lines, offset pagination, and multiline patterns.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Regex pattern to search for",
          },
          path: {
            type: "string",
            description: "Directory or file to search (default: project root)",
          },
          include: {
            type: "string",
            description: "File filter glob (e.g. '*.js', '*.ts')",
          },
          ignore_case: {
            type: "boolean",
            description: "Case-insensitive search",
          },
          output_mode: {
            type: "string",
            enum: ["content", "files_with_matches", "count"],
            description:
              "Output mode: content (matching lines), files_with_matches (file paths only), count (match counts). Default: content",
          },
          context: {
            type: "number",
            description: "Lines of context around each match (like grep -C)",
          },
          before_context: {
            type: "number",
            description: "Lines before each match (like grep -B)",
          },
          after_context: {
            type: "number",
            description: "Lines after each match (like grep -A)",
          },
          head_limit: {
            type: "number",
            description: "Limit output to first N results",
          },
          offset: { type: "number", description: "Skip first N results" },
          type: {
            type: "string",
            description:
              "File type filter (e.g. 'js', 'py', 'ts') — maps to --include='*.ext'",
          },
          multiline: {
            type: "boolean",
            description: "Enable multiline matching (grep -Pz)",
          },
          staged: {
            type: "boolean",
            description:
              "Search only staged content (git diff --cached). Default: false",
          },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch_file",
      description:
        "Apply multiple text replacements to a file atomically. All patches are validated before any are applied — if one fails, none are written. Example: when changing 3 different variables in the same function, use patch_file with an array of 3 { old_text, new_text } objects instead of 3 separate edit_file calls. This ensures either all changes are applied or none are, preventing partial edits. Like edit_file, all old_text values must match exactly.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path" },
          patches: {
            type: "array",
            description:
              "Array of { old_text, new_text } replacements to apply in order",
            items: {
              type: "object",
              properties: {
                old_text: { type: "string", description: "Text to find" },
                new_text: { type: "string", description: "Replacement text" },
              },
              required: ["old_text", "new_text"],
            },
          },
        },
        required: ["path", "patches"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_fetch",
      description:
        "Fetch content from a URL and return text. HTML tags are stripped. Use for reading documentation, API responses, or web pages. Will not work with authenticated/private URLs.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to fetch" },
          max_length: {
            type: "number",
            description: "Max response length in chars (default: 10000)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web. Uses Perplexity (grounded, AI-summarized) if PERPLEXITY_API_KEY is set, otherwise DuckDuckGo. Returns titles, URLs, and summaries. Use to find documentation, solutions, or current information beyond your knowledge cutoff.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          max_results: {
            type: "number",
            description: "Max results (default: 5)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_open",
      description:
        "Open a URL in a headless browser and return the page title, text content, and links. More reliable than web_fetch for JavaScript-heavy pages. Requires playwright (npm install playwright && npx playwright install chromium).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to open" },
          wait_for: {
            type: "string",
            enum: ["domcontentloaded", "networkidle", "load"],
            description:
              "When to consider page loaded (default: domcontentloaded)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_screenshot",
      description:
        "Take a screenshot of a URL in a headless browser. Returns the screenshot file path. The path can be pasted into the next message for visual analysis. Requires playwright.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to screenshot" },
          full_page: {
            type: "boolean",
            description: "Capture full page (default: false — viewport only)",
          },
          width: {
            type: "number",
            description: "Viewport width in px (default: 1280)",
          },
          height: {
            type: "number",
            description: "Viewport height in px (default: 800)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description:
        "Click an element on a web page (by CSS selector or visible text). Returns the new URL after navigation. Requires playwright.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to first" },
          selector: {
            type: "string",
            description:
              "CSS selector of element to click (mutually exclusive with text)",
          },
          text: {
            type: "string",
            description:
              "Visible text of element to click (mutually exclusive with selector)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_fill",
      description:
        "Fill a form field on a web page and optionally submit. Requires playwright.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to first" },
          selector: {
            type: "string",
            description: "CSS selector of the input field",
          },
          value: { type: "string", description: "Value to fill in" },
          submit: {
            type: "boolean",
            description: "Press Enter to submit after filling (default: false)",
          },
        },
        required: ["url", "selector", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description:
        "Ask the user a clarifying question with 2-3 specific options. Use when the user's intent is ambiguous. Always provide concrete, actionable options. The user can select an option or type a custom answer.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The clarifying question to ask",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "2-3 specific, actionable answer options for the user to choose from",
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ["question", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_status",
      description:
        "Get git status: current branch, changed files, staged/unstaged state. Use before git operations to understand the current state.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description:
        "Get git diff for changed files. Shows additions and deletions.",
      parameters: {
        type: "object",
        properties: {
          staged: {
            type: "boolean",
            description: "Show only staged changes (default: false)",
          },
          file: {
            type: "string",
            description: "Diff specific file only (optional)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_log",
      description: "Show recent git commits (short format).",
      parameters: {
        type: "object",
        properties: {
          count: {
            type: "number",
            description: "Number of commits to show (default: 10)",
          },
          file: {
            type: "string",
            description: "Show commits for specific file (optional)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_list",
      description:
        "Create and manage a task list for complex multi-step tasks. Use for tasks with 3+ steps to track progress. Actions: create (new list with tasks), update (mark task in_progress/done/failed), get (view current list). Always update task status as you work.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "update", "get"],
            description: "Action to perform",
          },
          name: { type: "string", description: "Task list name (for create)" },
          tasks: {
            type: "array",
            description: "Array of tasks to create (for create)",
            items: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "Task description",
                },
                depends_on: {
                  type: "array",
                  items: { type: "string" },
                  description: "IDs of prerequisite tasks",
                },
              },
              required: ["description"],
            },
          },
          task_id: {
            type: "string",
            description: "Task ID to update (for update)",
          },
          status: {
            type: "string",
            enum: ["in_progress", "done", "failed"],
            description: "New status (for update)",
          },
          result: {
            type: "string",
            description: "Result summary (for update, optional)",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gh_run_list",
      description:
        "List recent GitHub Actions workflow runs for this repository. Shows run status, conclusion, branch, and timing. Use to check CI/CD status or find a run ID.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Number of runs to show (default: 10, max: 30)",
          },
          workflow: {
            type: "string",
            description: "Filter by workflow name or filename (optional)",
          },
          branch: {
            type: "string",
            description: "Filter by branch name (optional)",
          },
          status: {
            type: "string",
            enum: ["completed", "in_progress", "queued", "failure", "success"],
            description: "Filter by status (optional)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gh_run_view",
      description:
        "View details of a specific GitHub Actions workflow run: steps, logs, errors. Use gh_run_list first to get the run ID.",
      parameters: {
        type: "object",
        properties: {
          run_id: {
            type: "string",
            description: "The run ID (from gh_run_list)",
          },
          log: {
            type: "boolean",
            description:
              "Include full log output (default: false — shows step summary only)",
          },
        },
        required: ["run_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gh_workflow_trigger",
      description:
        "Trigger a GitHub Actions workflow dispatch event. Only works for workflows with workflow_dispatch trigger. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          workflow: {
            type: "string",
            description: "Workflow filename (e.g. ci.yml) or name",
          },
          branch: {
            type: "string",
            description: "Branch to run on (default: current branch)",
          },
          inputs: {
            type: "object",
            description:
              "Workflow input parameters as key-value pairs (optional)",
          },
        },
        required: ["workflow"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spawn_agents",
      description:
        "Run multiple independent sub-agents in parallel (max 5 at top level, max 2 when called from within a sub-agent). Each agent has its own conversation context. Use when 2+ tasks can run simultaneously — e.g. reading multiple files, analyzing separate modules, independent research. Do NOT use for tasks that depend on each other or modify the same file. Keep task descriptions specific and self-contained. SWARM PATTERN: Sub-agents can call spawn_agents once (max nesting depth 2) to enable Architect→Coder→Reviewer pipelines: a coder agent spawns 1-2 reviewer agents that validate and fix its own output before returning results to the parent.",
      parameters: {
        type: "object",
        properties: {
          agents: {
            type: "array",
            description:
              "Array of agent definitions to run in parallel (max 5)",
            items: {
              type: "object",
              properties: {
                task: {
                  type: "string",
                  description: "Task description for the agent",
                },
                context: {
                  type: "string",
                  description: "Additional context (optional)",
                },
                max_iterations: {
                  type: "number",
                  description: "Max iterations (default: 10, max: 15)",
                },
                model: {
                  type: "string",
                  description:
                    'Override model for this agent (provider:model, e.g. "anthropic:claude-haiku"). Auto-selected if omitted.',
                },
              },
              required: ["task"],
            },
          },
        },
        required: ["agents"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "switch_model",
      description:
        "Switch the active AI model mid-conversation. Use when a different model is better for the next steps — e.g. switch to a fast model for simple lookups, or a more capable model for complex refactoring. The switch persists for all subsequent turns.",
      parameters: {
        type: "object",
        properties: {
          model: {
            type: "string",
            description:
              'Model spec: "provider:model" (e.g. "ollama:devstral-small-2:24b") or just model name',
          },
        },
        required: ["model"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "k8s_pods",
      description:
        "List Kubernetes pods. Shows pod name, status, restarts, and age. Runs kubectl locally or via SSH on a remote server. Use namespace to filter, or omit for all namespaces.",
      parameters: {
        type: "object",
        properties: {
          namespace: {
            type: "string",
            description: "Namespace to list pods in (default: all namespaces)",
          },
          label: {
            type: "string",
            description: 'Label selector filter (e.g. "app=nginx")',
          },
          context: {
            type: "string",
            description: "kubectl context to use (optional)",
          },
          server: {
            type: "string",
            description:
              "Remote server as user@host to run kubectl via SSH (optional, local kubectl if omitted)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "k8s_logs",
      description:
        'Fetch logs from a Kubernetes pod. Use tail to limit output, since for time-based filtering (e.g. "1h", "30m").',
      parameters: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod name" },
          namespace: {
            type: "string",
            description: "Namespace (default: default)",
          },
          container: {
            type: "string",
            description:
              "Container name (required if pod has multiple containers)",
          },
          tail: {
            type: "number",
            description: "Number of recent lines to show (default: 100)",
          },
          since: {
            type: "string",
            description: 'Show logs since duration (e.g. "1h", "30m", "5s")',
          },
          context: {
            type: "string",
            description: "kubectl context (optional)",
          },
          server: {
            type: "string",
            description: "Remote server user@host (optional)",
          },
        },
        required: ["pod"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "k8s_exec",
      description:
        "Execute a command inside a running Kubernetes pod (kubectl exec). Requires user confirmation. Use for inspecting container state, reading configs, or debugging.",
      parameters: {
        type: "object",
        properties: {
          pod: { type: "string", description: "Pod name" },
          command: {
            type: "string",
            description:
              'Command to run in the pod (e.g. "env", "ls /app", "cat /etc/config.yaml")',
          },
          namespace: {
            type: "string",
            description: "Namespace (default: default)",
          },
          container: {
            type: "string",
            description: "Container name (optional)",
          },
          context: {
            type: "string",
            description: "kubectl context (optional)",
          },
          server: {
            type: "string",
            description: "Remote server user@host (optional)",
          },
        },
        required: ["pod", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "k8s_apply",
      description:
        "Apply a Kubernetes manifest file (kubectl apply -f). Requires confirmation before applying to the cluster. Use dry_run=true to validate without applying.",
      parameters: {
        type: "object",
        properties: {
          file: {
            type: "string",
            description: "Path to manifest YAML file (relative or absolute)",
          },
          namespace: {
            type: "string",
            description: "Override namespace (optional)",
          },
          dry_run: {
            type: "boolean",
            description: "Validate only without applying (default: false)",
          },
          context: {
            type: "string",
            description: "kubectl context (optional)",
          },
          server: {
            type: "string",
            description: "Remote server user@host (optional)",
          },
        },
        required: ["file"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "k8s_rollout",
      description:
        "Manage Kubernetes deployment rollouts: check status, restart (rolling update), view history, or undo (rollback). Restart and undo require confirmation.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["status", "restart", "history", "undo"],
            description:
              "Action: status (check rollout progress), restart (rolling restart), history (show revision history), undo (rollback to previous revision)",
          },
          deployment: { type: "string", description: "Deployment name" },
          namespace: {
            type: "string",
            description: "Namespace (default: default)",
          },
          context: {
            type: "string",
            description: "kubectl context (optional)",
          },
          server: {
            type: "string",
            description: "Remote server user@host (optional)",
          },
        },
        required: ["action", "deployment"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "brain_write",
      description:
        "Write or update a knowledge document in the project brain (.nex/brain/). Use this to persist important findings, architecture decisions, debugging insights, or conventions discovered during the session. The user can review changes via /brain review or git diff.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              'Document name (without .md extension). Use kebab-case. Examples: "api-auth-flow", "db-schema-notes", "deployment-checklist"',
          },
          content: {
            type: "string",
            description:
              "Full Markdown content. Use headings (#), lists (-), and code blocks. Include optional YAML frontmatter with tags.",
          },
          mode: {
            type: "string",
            enum: ["create", "update", "append"],
            description:
              "create: new document (fails if exists). update: overwrite existing. append: add to end of existing document.",
          },
        },
        required: ["name", "content", "mode"],
      },
    },
  },
  // ─── SSH Tools ────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "ssh_exec",
      description:
        'Execute a command on a remote server via SSH. Server is a profile name from .nex/servers.json (e.g. "prod") or "user@host". Use for: checking status, reading logs, running deployments. Destructive commands (restart, delete, modify config) require confirmation. For service management prefer service_manage; for logs prefer service_logs.',
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description: 'Profile name (from .nex/servers.json) or "user@host"',
          },
          command: {
            type: "string",
            description: "Shell command to run on the remote server",
          },
          sudo: {
            type: "boolean",
            description:
              "Run command with sudo (only if profile has sudo:true). Default: false",
          },
          timeout: {
            type: "number",
            description: "Timeout in seconds. Default: 30",
          },
        },
        required: ["server", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_upload",
      description:
        "Upload a local file or directory to a remote server via SCP. Recursive for directories. Requires confirmation before upload.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description: 'Profile name or "user@host"',
          },
          local_path: {
            type: "string",
            description: "Local path to upload (file or directory)",
          },
          remote_path: {
            type: "string",
            description:
              "Destination path on the remote server (absolute preferred)",
          },
        },
        required: ["server", "local_path", "remote_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_download",
      description:
        "Download a file or directory from a remote server via SCP. Recursive for directories.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description: 'Profile name or "user@host"',
          },
          remote_path: {
            type: "string",
            description: "Path on the remote server to download",
          },
          local_path: { type: "string", description: "Local destination path" },
        },
        required: ["server", "remote_path", "local_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remote_agent",
      description:
        'Delegate a coding task to nex-code running on a remote server. Use this when the task involves server-side projects (musikschule, stadtkapelle, cahill, schoensgibl) that live on almalinux9. Runs nex-code --auto on the server and streams output. Server is a profile name from .nex/servers.json or "user@host".',
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name from .nex/servers.json (e.g. "almalinux9") or "user@host"',
          },
          task: {
            type: "string",
            description:
              "The full task description to run on the remote nex-code",
          },
          project_path: {
            type: "string",
            description:
              "Working directory on the remote server (e.g. /home/deploy/app). Defaults to home directory.",
          },
          model: {
            type: "string",
            description:
              "Model to use on remote nex-code (e.g. qwen3-coder:480b). Defaults to server default.",
          },
        },
        required: ["server", "task"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "service_manage",
      description:
        "Manage a systemd service on a remote (or local) server. Uses systemctl. Status is read-only; start/stop/restart/reload/enable/disable require confirmation. For AlmaLinux 9: runs via SSH with sudo if configured.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          service: {
            type: "string",
            description:
              'Service name (e.g. "nginx", "gunicorn", "postgresql")',
          },
          action: {
            type: "string",
            enum: [
              "status",
              "start",
              "stop",
              "restart",
              "reload",
              "enable",
              "disable",
            ],
            description: "systemctl action to perform",
          },
        },
        required: ["service", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "service_logs",
      description:
        "Fetch systemd service logs via journalctl. Works on AlmaLinux 9 and any systemd Linux. Read-only, no confirmation needed.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          service: {
            type: "string",
            description: 'Service name (e.g. "nginx", "gunicorn")',
          },
          lines: {
            type: "number",
            description: "Number of recent log lines to fetch. Default: 50",
          },
          since: {
            type: "string",
            description:
              'Time filter, e.g. "1 hour ago", "today", "2024-01-01 12:00". Optional.',
          },
          follow: {
            type: "boolean",
            description: "Tail logs in real-time (follow mode). Default: false",
          },
        },
        required: ["service"],
      },
    },
  },
  // ─── Docker Tools ─────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "container_list",
      description:
        "List Docker containers on a server (or locally). Shows container ID, name, image, status, and ports. Read-only, no confirmation needed.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          all: {
            type: "boolean",
            description:
              "Show all containers including stopped ones. Default: false (running only).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "container_logs",
      description:
        "Fetch logs from a Docker container on a server (or locally). Read-only, no confirmation needed.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          container: { type: "string", description: "Container name or ID." },
          lines: {
            type: "number",
            description: "Number of recent log lines. Default: 50.",
          },
          since: {
            type: "string",
            description:
              'Time filter, e.g. "1h", "30m", "2024-01-01T12:00:00". Optional.',
          },
        },
        required: ["container"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "container_exec",
      description:
        "Execute a command inside a running Docker container. Destructive or state-changing commands require confirmation.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          container: { type: "string", description: "Container name or ID." },
          command: {
            type: "string",
            description:
              'Command to run inside the container (e.g. "cat /etc/nginx/nginx.conf").',
          },
        },
        required: ["container", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "container_manage",
      description:
        'Start, stop, restart, or remove a Docker container. All actions except "inspect" require confirmation.',
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          container: { type: "string", description: "Container name or ID." },
          action: {
            type: "string",
            enum: ["start", "stop", "restart", "remove", "inspect"],
            description: "Action to perform on the container.",
          },
        },
        required: ["container", "action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "frontend_recon",
      description:
        "MANDATORY first step before creating or significantly modifying any frontend file (HTML template, Vue/React component, CSS). Scans the project and returns: (1) design tokens — CSS variables, Tailwind theme colors/fonts, (2) main layout/index page structure, (3) a reference component of the same type, (4) detected JS/CSS framework stack. Call this BEFORE writing any markup or styles. Never skip it for frontend tasks.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description:
              'Type of frontend file you are about to create. Used to find a relevant reference component. Examples: "list", "form", "detail", "dashboard", "modal", "component". Optional but improves reference quality.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deploy",
      description:
        'Deploy to a remote server. Supports two methods: "rsync" (sync local files) and "git" (git pull on remote). Can use a named config from .nex/deploy.json. Requires confirmation before executing.',
      parameters: {
        type: "object",
        properties: {
          config: {
            type: "string",
            description:
              'Named deploy config from .nex/deploy.json (e.g. "prod"). Overrides all other params if provided.',
          },
          method: {
            type: "string",
            enum: ["rsync", "git"],
            description:
              'Deploy method: "rsync" syncs local files (default), "git" runs git pull on the remote.',
          },
          server: {
            type: "string",
            description: 'Profile name or "user@host". Required if no config.',
          },
          remote_path: {
            type: "string",
            description:
              "Remote project directory. Required for git method; destination path for rsync.",
          },
          local_path: {
            type: "string",
            description:
              "Local directory or file to sync. Required for rsync method.",
          },
          branch: {
            type: "string",
            description:
              "Branch to pull (git method only). Defaults to current remote branch.",
          },
          deploy_script: {
            type: "string",
            description:
              'Shell command(s) to run on the remote after sync/pull (e.g. "npm ci && systemctl restart myapp"). Optional.',
          },
          health_check: {
            type: "string",
            description:
              "URL (HTTP GET) or shell command to verify the service is healthy after deploy. If it fails, the deploy is marked as failed. Optional.",
          },
          exclude: {
            type: "array",
            items: { type: "string" },
            description: "Paths to exclude from rsync. Optional.",
          },
          dry_run: {
            type: "boolean",
            description:
              "Show what would happen without executing. Default: false.",
          },
        },
        required: [],
      },
    },
  },
  // ─── Deployment Status Tool ──────────────────────────────────────
  {
    type: "function",
    function: {
      name: "deployment_status",
      description:
        "Check deployment status across all configured servers. Reads .nex/deploy.json configs and checks service health on each server. Returns a status summary table.",
      parameters: {
        type: "object",
        properties: {
          config: {
            type: "string",
            description:
              "Specific deploy config name to check (optional — checks all if omitted)",
          },
        },
        required: [],
      },
    },
  },
  // ─── Sysadmin Tool ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "sysadmin",
      description:
        "Senior sysadmin operations on a remote (or local) Linux server. Covers: system audit, disk_usage, process_list, network_status, package management (dnf/apt), user management, firewall (firewalld/ufw/iptables), cron, SSL cert checks, log tailing, large file discovery, systemd service management, process kill, journalctl log querying. Read-only actions run without confirmation; state-changing actions require user approval.",
      parameters: {
        type: "object",
        properties: {
          server: {
            type: "string",
            description:
              'Profile name or "user@host". Omit or use "local" for local machine.',
          },
          action: {
            type: "string",
            enum: [
              "audit",
              "disk_usage",
              "process_list",
              "network_status",
              "package",
              "user_manage",
              "firewall",
              "cron",
              "ssl_check",
              "log_tail",
              "find_large",
              "service",
              "kill_process",
              "journalctl",
            ],
            description:
              "Sysadmin operation. audit=full health overview; disk_usage=df+du; process_list=top procs; network_status=open ports; package=dnf/apt (package_action: check|list|install|remove|update|upgrade); user_manage=users/keys; firewall=rules; cron=crontab; ssl_check=cert expiry+days; log_tail=tail any log; find_large=big files; service=systemd unit management; kill_process=kill by PID or name; journalctl=query system journal.",
          },
          path: {
            type: "string",
            description:
              "File or directory path. For disk_usage (default /), log_tail (required), find_large (default /).",
          },
          lines: {
            type: "number",
            description:
              "Lines to tail for log_tail or journalctl. Default: 100.",
          },
          limit: {
            type: "number",
            description:
              "Result count for process_list (default 20) or find_large (default 20).",
          },
          sort_by: {
            type: "string",
            enum: ["cpu", "mem"],
            description: "Sort order for process_list. Default: cpu.",
          },
          min_size: {
            type: "string",
            description:
              'Minimum file size for find_large. Default: "100M". Examples: "50M", "1G".',
          },
          package_action: {
            type: "string",
            enum: ["install", "remove", "update", "list", "upgrade"],
            description: "Package sub-action for action=package.",
          },
          packages: {
            type: "array",
            items: { type: "string" },
            description: "Package name(s) for install/remove/update.",
          },
          user_action: {
            type: "string",
            enum: ["list", "create", "delete", "add_ssh_key", "info"],
            description: "User sub-action for action=user_manage.",
          },
          user: {
            type: "string",
            description: "Linux username for user_manage or cron.",
          },
          groups: {
            type: "array",
            items: { type: "string" },
            description:
              'Groups to assign on user create (e.g. ["sudo", "docker"]).',
          },
          ssh_key: {
            type: "string",
            description:
              "SSH public key string to add for user_action=add_ssh_key.",
          },
          firewall_action: {
            type: "string",
            enum: ["status", "allow", "deny", "remove", "reload"],
            description: "Firewall sub-action for action=firewall.",
          },
          port: {
            type: "string",
            description:
              'Port/protocol for firewall rules, e.g. "80/tcp", "443", "8080/udp".',
          },
          cron_action: {
            type: "string",
            enum: ["list", "add", "remove"],
            description: "Cron sub-action for action=cron.",
          },
          schedule: {
            type: "string",
            description:
              'Cron schedule expression for cron add, e.g. "0 2 * * *".',
          },
          command: {
            type: "string",
            description:
              "Command for cron add, or substring to match for cron remove.",
          },
          domain: {
            type: "string",
            description:
              'Domain for ssl_check (e.g. "example.com"). Auto-detects Let\'s Encrypt cert on server; falls back to live TLS probe.',
          },
          cert_path: {
            type: "string",
            description:
              'Explicit path to cert file on server for ssl_check (e.g. "/etc/letsencrypt/live/x/cert.pem").',
          },
          service_name: {
            type: "string",
            description:
              'Systemd unit name for action=service (e.g. "nginx", "my-api", "gunicorn"). .service suffix optional.',
          },
          service_action: {
            type: "string",
            enum: [
              "status",
              "start",
              "stop",
              "restart",
              "reload",
              "enable",
              "disable",
              "list_failed",
            ],
            description:
              "Sub-action for action=service. list_failed shows all failed units.",
          },
          pid: {
            type: "number",
            description: "Process ID to kill for action=kill_process.",
          },
          process_name: {
            type: "string",
            description:
              "Process name to kill (uses pkill) for action=kill_process. Use with pid for safety.",
          },
          signal: {
            type: "string",
            enum: ["SIGTERM", "SIGKILL", "SIGHUP", "SIGINT"],
            description: "Signal for kill_process. Default: SIGTERM.",
          },
          unit: {
            type: "string",
            description:
              'Systemd unit to filter for journalctl (e.g. "nginx", "my-api"). Omit for system-wide.',
          },
          since: {
            type: "string",
            description:
              'Time filter for journalctl, e.g. "1 hour ago", "today", "2026-03-17 10:00". Default: last 200 lines.',
          },
          priority: {
            type: "string",
            enum: [
              "emerg",
              "alert",
              "crit",
              "err",
              "warning",
              "notice",
              "info",
              "debug",
            ],
            description:
              "Minimum log priority for journalctl. Default: no filter.",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Save a typed memory for cross-session persistence. Use this to remember user preferences, feedback, project context, or external references.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["user", "feedback", "project", "reference"],
            description:
              "Memory type: user (role/prefs), feedback (approach guidance), project (ongoing work), reference (external pointers)",
          },
          name: {
            type: "string",
            description:
              "Short slug identifier for this memory (e.g. 'testing-preference', 'deploy-workflow')",
          },
          content: {
            type: "string",
            description: "Markdown content of the memory",
          },
          description: {
            type: "string",
            description:
              "One-line description for the memory index (optional, defaults to first line of content)",
          },
        },
        required: ["type", "name", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description:
        "Delete a typed memory entry. Use this to prune outdated or incorrect memories.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["user", "feedback", "project", "reference"],
            description: "Memory type to delete from",
          },
          name: {
            type: "string",
            description: "Slug identifier of the memory to delete",
          },
        },
        required: ["type", "name"],
      },
    },
  },
];

// ─── Kubernetes Helper ────────────────────────────────────────
/**
 * Build a kubectl command string, optionally tunnelled over SSH.
 * @param {string} kubectlArgs - Everything after `kubectl`, e.g. "get pods -A"
 * @param {{ server?: string, context?: string }} opts
 * @returns {string} Shell command string
 */
function buildKubectlCmd(kubectlArgs, { server, context } = {}) {
  // Sanitize: only allow safe characters for server (user@host) and context names
  const safeServer = server ? server.replace(/[^a-zA-Z0-9@._-]/g, "") : null;
  const safeContext = context ? context.replace(/[^a-zA-Z0-9._/-]/g, "") : null;

  let kubectl = "kubectl";
  if (safeContext) kubectl += ` --context ${safeContext}`;
  kubectl += ` ${kubectlArgs}`;

  if (safeServer) {
    // Escape double-quotes inside the remote command
    const escaped = kubectl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `ssh -o ConnectTimeout=10 -o BatchMode=yes ${safeServer} "${escaped}"`;
  }
  return kubectl;
}

// ─── Tool Implementations ─────────────────────────────────────
async function _executeToolInner(name, args, options = {}) {
  switch (name) {
    case "bash": {
      const cmd = args.command;
      const forbidden = isForbidden(cmd);
      if (forbidden) {
        const hint = getBlockedHint(cmd);
        return `BLOCKED: Command matches forbidden pattern: ${forbidden}${hint ? `\nHINT: ${hint}` : ""}`;
      }

      // Block destructive operations on protected paths (even in --auto mode)
      const pathViolation = isBashPathForbidden(cmd);
      if (pathViolation) {
        return `BLOCKED: Destructive operation on protected path: ${pathViolation}\nHINT: Protected files (.env, credentials, venv, .ssh, etc.) cannot be deleted or moved via bash. Override with NEX_UNPROTECT=1 if intentional.`;
      }

      const needsPrompt = options.autoConfirm
        ? isCritical(cmd)
        : isDangerous(cmd);
      if (needsPrompt) {
        const icon = isCritical(cmd) ? "⛔" : "⚠";
        const ok = await confirm(`  ${icon} bash: \`${cmd}\``, {
          toolName: "bash",
        });
        if (!ok) return "CANCELLED: User declined to execute this command.";
      }

      // Resolve a safe working directory: if the current directory was deleted during the session,
      // exec() would fail with a confusing "spawn /bin/sh ENOENT" error. Fall back to $HOME.
      // process.cwd() itself throws ENOENT when the directory has been deleted, so wrap both calls.
      let safeCwd;
      try {
        safeCwd = process.cwd();
        fsSync.accessSync(safeCwd);
      } catch {
        safeCwd = require("os").homedir();
        if (!options.silent)
          console.log(
            `${C.yellow}  ⚠ Working directory no longer exists — running in ${safeCwd}${C.reset}`,
          );
      }

      // Interactive commands (vim, top, etc.) need a real TTY — spawn with stdio:inherit.
      // SSH with a remote command (e.g. ssh host "cmd") is non-interactive: capture output normally.
      const isSSHLogin =
        SSH_INTERACTIVE_RE.test(cmd.trim()) &&
        !SSH_HAS_REMOTE_CMD_RE.test(cmd.trim());
      if (INTERACTIVE_CMDS.test(cmd.trim()) || isSSHLogin) {
        if (!options.silent)
          console.log(`${C.dim}  ▶ interactive: ${cmd}${C.reset}`);
        const result = spawnSync("sh", ["-c", cmd], {
          stdio: "inherit",
          cwd: safeCwd,
        });
        if (result.error) return `ERROR: ${result.error.message}`;
        return result.status === 0
          ? `(interactive command completed successfully)`
          : `(interactive command exited with code ${result.status})`;
      }

      const { ToolProgress: BashProgress } = require("../spinner");
      const bProgress = options.silent
        ? null
        : new BashProgress("bash", cmd.substring(0, 40));
      if (bProgress) bProgress.start();
      try {
        const { stdout, stderr } = await exec(cmd, {
          cwd: safeCwd,
          timeout: 90000,
          maxBuffer: 5 * 1024 * 1024,
        });
        if (bProgress) bProgress.stop();
        return stdout || stderr || "(no output)";
      } catch (e) {
        if (bProgress) bProgress.stop();
        const rawError = (e.stderr || e.stdout || e.message || "")
          .toString()
          .substring(0, 5000);
        const enriched = enrichBashError(rawError, cmd);
        return `EXIT ${e.code || 1}\n${enriched}`;
      }
    }

    case "read_file": {
      let fp = resolvePath(args.path);
      if (!fp)
        return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fileExists(fp);
      if (!exists) {
        // Auto-fix: try to find the file
        const fix = await autoFixPath(args.path);
        if (fix.fixedPath) {
          fp = fix.fixedPath;
          console.log(
            `${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(process.cwd(), fp)}${C.reset}`,
          );
        } else {
          return `ERROR: File not found: ${args.path}${fix.message ? "\n" + fix.message : ""}`;
        }
      }

      // Binary file detection: check first 8KB for null bytes
      const buf = Buffer.alloc(8192);
      const fd = await fsSync.promises.open(fp, "r");
      const { bytesRead } = await fd.read(buf, 0, 8192, 0);
      await fd.close();
      for (let b = 0; b < bytesRead; b++) {
        if (buf[b] === 0)
          return `ERROR: ${fp} is a binary file (not readable as text)`;
      }

      const content = await fs.readFile(fp, "utf-8");
      if (!content && (await fs.stat(fp)).size > 0)
        return `WARNING: ${fp} is empty or unreadable`;
      const lines = content.split("\n");
      const stats = await fs.stat(fp);
      const lineCount = lines.length;

      // Hard cap: unbounded reads are limited to 350 lines to protect context window.
      // This prevents large files from flooding the context window and causing 400 errors.
      // The model must use line_start/line_end to read specific sections of large files.
      const FULL_READ_CAP = 350;
      const isFullRead = !args.line_start && !args.line_end;
      const isTruncated = isFullRead && lineCount > FULL_READ_CAP;

      const start = (args.line_start || 1) - 1;
      const end = isTruncated ? FULL_READ_CAP : args.line_end || lines.length;

      const shortPath = path.relative(process.cwd(), fp);
      const rangeLabel = isTruncated
        ? `showing lines 1-${FULL_READ_CAP} of ${lineCount}`
        : args.line_start || args.line_end
          ? `lines ${start + 1}-${end} of ${lineCount}`
          : `${lineCount} lines`;
      const summary = `File: ${shortPath} (${rangeLabel}, ${stats.size} bytes)`;

      const numberedLines = lines
        .slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join("\n");

      const truncationNote = isTruncated
        ? `\n\n[File truncated: showing lines 1-${FULL_READ_CAP} of ${lineCount} total. Use line_start/line_end to read other sections, e.g. line_start=${FULL_READ_CAP + 1} line_end=${Math.min(FULL_READ_CAP * 2, lineCount)}]`
        : !isFullRead && lineCount > FULL_READ_CAP
          ? `\n[Large file (${lineCount} lines total) — use line_start/line_end for other sections]`
          : "";
      return `${summary}\n${numberedLines}${truncationNote}`;
    }

    case "write_file": {
      await ensureCheckpoint();
      const fp = resolvePath(args.path);
      if (!fp)
        return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fileExists(fp);
      let oldContent = null;

      if (!options.autoConfirm) {
        if (exists) {
          oldContent = await fs.readFile(fp, "utf-8");
          const annotations = await runDiagnostics(fp, args.content);
          showDiff(fp, oldContent, args.content, { annotations });
          const ok = await confirmFileChange("Overwrite");
          if (!ok) return "CANCELLED: User declined to overwrite file.";
        } else {
          const annotations = await runDiagnostics(fp, args.content);
          showNewFile(fp, args.content, { annotations });
          const ok = await confirmFileChange("Create");
          if (!ok) return "CANCELLED: User declined to create file.";
        }
      } else if (exists) {
        oldContent = await fs.readFile(fp, "utf-8");
      }

      const dir = path.dirname(fp);
      const dirExists = await fileExists(dir);
      if (!dirExists) await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fp, args.content, "utf-8");
      const needsExec =
        /[/\\]\.git[/\\]hooks[/\\]/.test(fp) ||
        fp.endsWith(".sh") ||
        args.content.startsWith("#!");
      if (needsExec) await fs.chmod(fp, 0o755);
      recordChange("write_file", fp, oldContent, args.content);
      const execNote = needsExec ? " [chmod +x applied]" : "";
      return `Written: ${fp} (${args.content.length} chars)${execNote}`;
    }

    case "edit_file": {
      await ensureCheckpoint();
      let fp = resolvePath(args.path);
      if (!fp)
        return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fileExists(fp);
      if (!exists) {
        // Auto-fix: try to find the file
        const fix = await autoFixPath(args.path);
        if (fix.fixedPath) {
          fp = fix.fixedPath;
          console.log(
            `${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(process.cwd(), fp)}${C.reset}`,
          );
        } else {
          return `ERROR: File not found: ${args.path}${fix.message ? "\n" + fix.message : ""}`;
        }
      }
      const content = await fs.readFile(fp, "utf-8");

      let matchText = args.old_text;
      let fuzzyMatched = false;
      let autoFixed = false;

      if (!content.includes(args.old_text)) {
        const {
          getActiveModelId,
          getActiveProviderName,
        } = require("../providers/registry");
        const editMode = getEditMode(
          getActiveModelId(),
          getActiveProviderName(),
        );

        if (editMode === "strict") {
          // Strict mode: exact match only, no fuzzy fallback
          const similar = findMostSimilar(content, args.old_text);
          if (similar) {
            return `ERROR: old_text not found in ${fp} (strict mode — exact match required)\nMost similar text (line ${similar.line}, distance ${similar.distance}):\n${similar.text}`;
          }
          return `ERROR: old_text not found in ${fp} (strict mode — exact match required)`;
        }

        // Fuzzy mode: try whitespace-normalized match → auto-fix → error
        const fuzzyResult = fuzzyFindText(content, args.old_text);
        if (fuzzyResult) {
          matchText = fuzzyResult;
          fuzzyMatched = true;
          console.log(`${C.dim}  ✓ fuzzy whitespace match applied${C.reset}`);
        } else {
          // Try auto-fix: apply close matches automatically (≤5% distance)
          const fix = autoFixEdit(content, args.old_text, args.new_text);
          if (fix) {
            if (!options.autoConfirm) {
              const annotations = await runDiagnostics(fp, fix.content);
              showDiff(fp, content, fix.content, { annotations });
              const ok = await confirmFileChange(
                `Apply (auto-fix, line ${fix.line}, distance ${fix.distance})`,
              );
              if (!ok) return "CANCELLED: User declined to apply edit.";
            }
            await fs.writeFile(fp, fix.content, "utf-8");
            if (
              /[/\\]\.git[/\\]hooks[/\\]/.test(fp) ||
              fp.endsWith(".sh") ||
              fix.content.startsWith("#!")
            )
              await fs.chmod(fp, 0o755);
            recordChange("edit_file", fp, content, fix.content);
            const matchPreview =
              fix.matchText.length > 80
                ? fix.matchText.substring(0, 77) + "..."
                : fix.matchText;
            console.log(
              `${C.dim}  ✓ auto-fixed edit: line ${fix.line}, distance ${fix.distance}${C.reset}`,
            );
            return `Edited: ${fp} (auto-fixed, line ${fix.line}, distance ${fix.distance}, matched: "${matchPreview}")`;
          }
          // Provide helpful error with surrounding context so LLM can fix old_text without re-reading.
          // Include ±10 lines around the most similar match — this is often enough to correct the edit
          // directly without needing another read_file call (which may be blocked or flood context).
          const similar = findMostSimilar(content, args.old_text);
          if (similar) {
            const allFileLines = content.split("\n");
            const ctxStart = Math.max(0, similar.line - 6);
            const ctxEnd = Math.min(allFileLines.length, similar.line + 10);
            const surroundingCtx = allFileLines
              .slice(ctxStart, ctxEnd)
              .map((l, i) => `${ctxStart + i + 1}: ${l}`)
              .join("\n");
            const reReadHint = `line_start=${Math.max(1, similar.line - 5)} line_end=${Math.min(allFileLines.length, similar.line + 15)}`;
            return `ERROR: old_text not found in ${fp} (most similar at line ${similar.line}, distance ${similar.distance})\n\nActual file content around line ${similar.line} — use this to correct old_text:\n${surroundingCtx}\n\nFix: update old_text to match the exact lines above, then retry. If you need more context: read_file with ${reReadHint}`;
          }
          const firstLine = (args.old_text || "")
            .trim()
            .split("\n")[0]
            .slice(0, 60);
          const grepHint = firstLine
            ? `\nRecovery: grep -n "${firstLine.replace(/"/g, '\\"')}" <file> to find the line, then re-read that section with line_start/line_end.`
            : "\nRecovery: use grep -n to locate the text, then re-read that section with line_start/line_end.";
          return `ERROR: old_text not found in ${fp}${grepHint}`;
        }
      }

      if (!options.autoConfirm) {
        const preview = content.split(matchText).join(args.new_text);
        const annotations = await runDiagnostics(fp, preview);
        showDiff(fp, content, preview, { annotations });
        const label = fuzzyMatched ? "Apply (fuzzy match)" : "Apply";
        const ok = await confirmFileChange(label);
        if (!ok) return "CANCELLED: User declined to apply edit.";
      }

      // Use split/join for literal replacement (no regex interpretation)
      const updated = content.split(matchText).join(args.new_text);
      await fs.writeFile(fp, updated, "utf-8");
      if (
        /[/\\]\.git[/\\]hooks[/\\]/.test(fp) ||
        fp.endsWith(".sh") ||
        updated.startsWith("#!")
      )
        await fs.chmod(fp, 0o755);
      recordChange("edit_file", fp, content, updated);
      return fuzzyMatched ? `Edited: ${fp} (fuzzy match)` : `Edited: ${fp}`;
    }

    case "list_directory": {
      let dp = resolvePath(args.path);
      if (!dp)
        return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fileExists(dp);
      if (!exists) {
        // Auto-fix: normalize path
        const normalized = args.path
          .replace(/\/+/g, "/")
          .replace(/^~\//, `${require("os").homedir()}/`);
        const np = resolvePath(normalized);
        const npExists = await fileExists(np);
        if (np && npExists) {
          dp = np;
        } else {
          return `ERROR: Directory not found: ${args.path}`;
        }
      }
      const depth = args.max_depth || 2;
      let pattern = null;
      if (args.pattern) {
        try {
          // Escape regex specials, convert glob * to .*
          const safe = args.pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*");
          pattern = new RegExp(`^${safe}$`);
        } catch {
          return `ERROR: Invalid pattern: ${args.pattern}`;
        }
      }
      const result = [];

      const walk = async (dir, level, prefix) => {
        if (level > depth) return;
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        entries = entries.filter(
          (e) => !e.name.startsWith(".") && e.name !== "node_modules",
        );
        for (const entry of entries) {
          if (pattern && !entry.isDirectory() && !pattern.test(entry.name))
            continue;
          const marker = entry.isDirectory() ? "/" : "";
          result.push(`${prefix}${entry.name}${marker}`);
          if (entry.isDirectory())
            await walk(path.join(dir, entry.name), level + 1, prefix + "  ");
        }
      };

      await walk(dp, 1, "");
      return result.join("\n") || "(empty)";
    }

    case "search_files": {
      const dp = resolvePath(args.path);
      if (!dp)
        return `ERROR: Access denied — path outside project: ${args.path}`;
      const grepArgs = ["-rn", "--null", "-H"];
      if (args.file_pattern) grepArgs.push(`--include=${args.file_pattern}`);
      grepArgs.push(args.pattern, dp);
      try {
        const { stdout } = await execFile("grep", grepArgs, {
          cwd: process.cwd(),
          timeout: 30000,
          maxBuffer: 2 * 1024 * 1024,
        });
        // Parse null-delimited output to handle filenames with spaces
        const parts = stdout.split("\0");
        const results = [];
        for (let i = 0; i < parts.length; i += 2) {
          const file = parts[i];
          const content = parts[i + 1];
          if (file && content) {
            const lines = content.split("\n").filter((l) => l.trim());
            for (const line of lines) {
              results.push(`${file}:${line}`);
              if (results.length >= 50) break;
            }
          }
          if (results.length >= 50) break;
        }
        return results.join("\n") || "(no matches)";
      } catch {
        return "(no matches)";
      }
    }

    case "glob": {
      const GLOB_LIMIT = 200;
      const currentCwd = process.cwd();
      const basePath = args.path ? resolvePath(args.path) : currentCwd;
      const pattern = args.pattern;

      const globToRegex = (g) => {
        const escaped = g
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*\//g, "(.*\/)?")
          .replace(/\*\*/g, ".*")
          .replace(/\*/g, "[^/]*")
          .replace(/\?/g, ".");
        return new RegExp(`^${escaped}$`);
      };

      const fullRegex = globToRegex(pattern);
      const namePattern = pattern.split("/").pop();
      const nameRegex = globToRegex(namePattern);

      const { ToolProgress: GlobProgress } = require("../spinner");
      const gProgress = new GlobProgress("glob", "Finding files...");
      gProgress.start();

      let {
        getFileIndex: getIndex,
        getIndexedCwd,
        refreshIndex,
        isIndexValid,
      } = require("../index-engine");
      let allFiles = getIndex();
      let indexedCwd = getIndexedCwd();

      // Refresh if index is invalid (empty, wrong cwd, or expired)
      if (!isIndexValid(basePath)) {
        await refreshIndex(basePath);
        allFiles = getIndex();
      }

      const matches = allFiles
        .filter((f) => fullRegex.test(f) || nameRegex.test(path.basename(f)))
        .map((f) => path.join(basePath, f));

      if (matches.length === 0) {
        gProgress.stop();
        return "(no matches)";
      }

      // Sort by modification time (most recent first)
      const withStats = await Promise.all(
        matches.slice(0, GLOB_LIMIT + 10).map(async (f) => {
          try {
            const stat = await fs.stat(f);
            return { path: f, mtime: stat.mtimeMs };
          } catch {
            return { path: f, mtime: 0 };
          }
        }),
      );
      withStats.sort((a, b) => b.mtime - a.mtime);
      const sortedMatches = withStats.map((s) => s.path);

      const truncated = matches.length > GLOB_LIMIT;
      const result = sortedMatches.slice(0, GLOB_LIMIT).join("\n");

      gProgress.update({ count: matches.length, detail: args.pattern });
      gProgress.stop();
      return truncated
        ? `${result}\n\n⚠ Results truncated at ${GLOB_LIMIT}. Use a more specific pattern.`
        : result;
    }

    case "grep": {
      const searchPath = args.path ? resolvePath(args.path) : process.cwd();

      // Handle staged content search
      if (args.staged) {
        const { getDiff } = require("../git");
        const stagedDiff = await getDiff(true);
        if (!stagedDiff.trim()) {
          return "(no staged changes)";
        }

        // Extract files from staged diff
        const stagedFiles = new Set();
        const diffLines = stagedDiff.split("\n");
        for (const line of diffLines) {
          if (line.startsWith("diff --git")) {
            const match = line.match(/diff --git a\/(.+) b\/(.+)/);
            if (match) {
              stagedFiles.add(match[2]);
            }
          }
        }

        // Search only staged files, excluding comments
        const grepArgs2 = [
          "-rn",
          "-E",
          "--null",
          "-H",
          "--exclude=*.md",
          "--exclude=*.txt",
          "--exclude=*.json",
          "--exclude=*.yaml",
          "--exclude=*.yml",
        ];
        if (args.ignore_case) grepArgs2.push("-i");
        if (args.include) grepArgs2.push(`--include=${args.include}`);
        if (args.type) grepArgs2.push(`--include=*.${args.type}`);
        if (args.context) grepArgs2.push(`-C`, String(args.context));
        else {
          if (args.before_context)
            grepArgs2.push(`-B`, String(args.before_context));
          if (args.after_context)
            grepArgs2.push(`-A`, String(args.after_context));
        }
        if (args.output_mode === "files_with_matches") grepArgs2.push("-l");
        else if (args.output_mode === "count") grepArgs2.push("-c");
        grepArgs2.push(
          "--exclude-dir=node_modules",
          "--exclude-dir=.git",
          "--exclude-dir=coverage",
        );

        const { ToolProgress } = require("../spinner");
        const grepProgress = new ToolProgress(
          "grep",
          "Searching staged content...",
        );
        grepProgress.start();

        let results = [];
        for (const file of stagedFiles) {
          try {
            const filePath = path.join(process.cwd(), file);
            if (await fileExists(filePath)) {
              const fileGrepArgs = [...grepArgs2];
              fileGrepArgs.push(args.pattern, filePath);
              const { stdout } = await execFile("grep", fileGrepArgs, {
                cwd: process.cwd(),
                timeout: 30000,
                maxBuffer: 2 * 1024 * 1024,
              });

              if (
                args.output_mode === "files_with_matches" ||
                args.output_mode === "count"
              ) {
                const fileResults = stdout
                  .trim()
                  .split("\n")
                  .filter((l) => l.trim());
                results = results.concat(fileResults);
              } else {
                const parts = stdout.split("\0");
                for (let i = 0; i < parts.length; i += 2) {
                  const content = parts[i + 1];
                  if (content) {
                    const lines = content.split("\n").filter((l) => l.trim());
                    for (const line of lines) {
                      results.push(`${file}:${line}`);
                    }
                  }
                }
              }
            }
          } catch (e) {
            // Ignore errors for individual files
          }
        }

        grepProgress.update({
          count: results.length,
          detail: `in staged files`,
        });
        grepProgress.stop();
        return results.join("\n").trim() || "(no matches in staged files)";
      }

      // Original non-staged search logic
      const grepArgs2 = ["-rn", "-E", "--null", "-H"];
      if (args.ignore_case) grepArgs2.push("-i");
      if (args.include) grepArgs2.push(`--include=${args.include}`);
      // type filter maps to --include
      if (args.type) grepArgs2.push(`--include=*.${args.type}`);
      // Context lines — cap at 20 to prevent flooding LLM context
      const MAX_CTX = 20;
      if (args.context)
        grepArgs2.push(`-C`, String(Math.min(Number(args.context), MAX_CTX)));
      else {
        if (args.before_context)
          grepArgs2.push(
            `-B`,
            String(Math.min(Number(args.before_context), MAX_CTX)),
          );
        if (args.after_context)
          grepArgs2.push(
            `-A`,
            String(Math.min(Number(args.after_context), MAX_CTX)),
          );
      }
      // Output mode
      if (args.output_mode === "files_with_matches") grepArgs2.push("-l");
      else if (args.output_mode === "count") grepArgs2.push("-c");
      grepArgs2.push(
        "--exclude-dir=node_modules",
        "--exclude-dir=.git",
        "--exclude-dir=coverage",
      );
      grepArgs2.push(args.pattern, searchPath);
      const { ToolProgress } = require("../spinner");
      const grepProgress = new ToolProgress("grep", "Searching...");
      grepProgress.start();
      try {
        const { stdout } = await execFile("grep", grepArgs2, {
          cwd: process.cwd(),
          timeout: 30000,
          maxBuffer: 2 * 1024 * 1024,
        });

        let results;
        if (
          args.output_mode === "files_with_matches" ||
          args.output_mode === "count"
        ) {
          // These modes output one line per file, no null-delimited parsing needed
          results = stdout
            .trim()
            .split("\n")
            .filter((l) => l.trim());
        } else {
          // Parse null-delimited output for content mode
          const parts = stdout.split("\0");
          results = [];
          for (let i = 0; i < parts.length; i += 2) {
            const file = parts[i];
            const content = parts[i + 1];
            if (file && content) {
              const lines = content.split("\n").filter((l) => l.trim());
              for (const line of lines) {
                results.push(`${file}:${line}`);
              }
            }
          }
        }

        // Apply offset and head_limit
        const offset = args.offset || 0;
        const limit =
          args.head_limit ||
          (args.output_mode === "files_with_matches" ? 200 : 100);
        results = results.slice(offset, offset + limit);

        grepProgress.update({
          count: results.length,
          detail: `in ${searchPath}`,
        });
        grepProgress.stop();
        return results.join("\n").trim() || "(no matches)";
      } catch (e) {
        grepProgress.stop();
        if (e.code === 2) {
          return `ERROR: Invalid regex pattern: ${args.pattern}`;
        }
        return "(no matches)";
      }
    }

    case "patch_file": {
      await ensureCheckpoint();
      let fp = resolvePath(args.path);
      if (!fp)
        return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fileExists(fp);
      if (!exists) {
        // Auto-fix: try to find the file
        const fix = await autoFixPath(args.path);
        if (fix.fixedPath) {
          fp = fix.fixedPath;
          console.log(
            `${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(process.cwd(), fp)}${C.reset}`,
          );
        } else {
          return `ERROR: File not found: ${args.path}${fix.message ? "\n" + fix.message : ""}`;
        }
      }

      const patches = args.patches;
      if (!Array.isArray(patches) || patches.length === 0)
        return "ERROR: No patches provided";

      let content = await fs.readFile(fp, "utf-8");

      // Determine edit mode for current model
      const {
        getActiveModelId: getPatchModelId,
        getActiveProviderName: getPatchProviderName,
      } = require("../providers/registry");
      const patchEditMode = getEditMode(
        getPatchModelId(),
        getPatchProviderName(),
      );

      // Validate all patches first (exact → fuzzy → auto-fix → error)
      const resolvedPatches = [];
      let anyFuzzy = false;
      let anyAutoFixed = false;
      for (let i = 0; i < patches.length; i++) {
        const { old_text, new_text } = patches[i];
        if (content.includes(old_text)) {
          resolvedPatches.push({ old_text, new_text });
        } else if (patchEditMode === "strict") {
          // Strict mode: exact match only, no fuzzy fallback
          const similar = findMostSimilar(content, old_text);
          if (similar) {
            return `ERROR: Patch ${i + 1} old_text not found in ${fp} (strict mode — exact match required)\nMost similar text (line ${similar.line}, distance ${similar.distance}):\n${similar.text}`;
          }
          return `ERROR: Patch ${i + 1} old_text not found in ${fp} (strict mode — exact match required)`;
        } else {
          const fuzzyResult = fuzzyFindText(content, old_text);
          if (fuzzyResult) {
            resolvedPatches.push({ old_text: fuzzyResult, new_text });
            anyFuzzy = true;
          } else {
            // Auto-fix: try close match (≤5% distance)
            const similar = findMostSimilar(content, old_text);
            if (similar) {
              const threshold = Math.max(3, Math.ceil(old_text.length * 0.05));
              if (similar.distance <= threshold) {
                resolvedPatches.push({ old_text: similar.text, new_text });
                anyAutoFixed = true;
              } else {
                return `ERROR: Patch ${i + 1} old_text not found in ${fp}\nMost similar text (line ${similar.line}, distance ${similar.distance}):\n${similar.text}`;
              }
            } else {
              return `ERROR: Patch ${i + 1} old_text not found in ${fp}`;
            }
          }
        }
      }

      // Apply to a copy first (atomic — validate all patches succeed before writing)
      let preview = content;
      for (const { old_text, new_text } of resolvedPatches) {
        preview = preview.split(old_text).join(new_text);
      }
      if (!options.autoConfirm) {
        const annotations = await runDiagnostics(fp, preview);
        showDiff(fp, content, preview, { annotations });
        const label = anyFuzzy
          ? "Apply patches (fuzzy match)"
          : "Apply patches";
        const ok = await confirmFileChange(label);
        if (!ok) return "CANCELLED: User declined to apply patches.";
      }

      // Write the fully-validated preview (atomic — no partial application)
      await fs.writeFile(fp, preview, "utf-8");
      const needsExecP =
        /[/\\]\.git[/\\]hooks[/\\]/.test(fp) ||
        fp.endsWith(".sh") ||
        preview.startsWith("#!");
      if (needsExecP) await fs.chmod(fp, 0o755);
      recordChange("patch_file", fp, content, preview);
      const suffix = anyAutoFixed
        ? " (auto-fixed)"
        : anyFuzzy
          ? " (fuzzy match)"
          : "";
      const execNoteP = needsExecP ? " [chmod +x applied]" : "";
      return `Patched: ${fp} (${patches.length} replacements)${suffix}${execNoteP}`;
    }

    case "web_fetch": {
      const url = args.url;
      const maxLen = args.max_length || 10000;
      try {
        // SSRF protection: block private/internal IP ranges
        const parsedUrl = new URL(url);
        const host = parsedUrl.hostname;
        if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|localhost$|\[::1?\]|\[fd|fc)/i.test(host)) {
          return "ERROR: Fetching private/internal addresses is not allowed.";
        }
        const resp = await axios.get(url, {
          timeout: 15000,
          maxContentLength: 1048576,
          responseType: "text",
          headers: { "User-Agent": "nex-code/0.2.0" },
        });
        const out =
          typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);
        // Strip HTML tags for cleaner output
        const text = out
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return text.substring(0, maxLen) || "(empty response)";
      } catch (e) {
        return `ERROR: Failed to fetch ${url}: ${e.message}`;
      }
    }

    case "web_search": {
      const maxResults = args.max_results || 5;
      // Perplexity grounded search (if API key available)
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          const resp = await axios.post(
            "https://api.perplexity.ai/chat/completions",
            {
              model: "sonar",
              messages: [{ role: "user", content: args.query }],
              max_tokens: 1024,
              search_recency_filter: "month",
              return_citations: true,
            },
            {
              timeout: 20000,
              headers: {
                Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                "Content-Type": "application/json",
              },
            },
          );
          const answer = resp.data?.choices?.[0]?.message?.content || "";
          const citations = resp.data?.citations || [];
          let out = `[Perplexity grounded search]\n\n${answer}`;
          if (citations.length > 0) {
            out +=
              "\n\nSources:\n" +
              citations
                .slice(0, maxResults)
                .map((c, i) => `${i + 1}. ${c}`)
                .join("\n");
          }
          return out;
        } catch (e) {
          // Fall through to DuckDuckGo on error
          console.error(
            `${C.dim}  Perplexity search failed (${e.message}), falling back to DuckDuckGo${C.reset}`,
          );
        }
      }
      // DuckDuckGo fallback
      try {
        const resp = await axios.get("https://html.duckduckgo.com/html/", {
          params: { q: args.query },
          timeout: 10000,
          responseType: "text",
          headers: { "User-Agent": "nex-code/0.2.0" },
        });
        const out = resp.data;
        // Parse results from DuckDuckGo HTML
        const results = [];
        const regex =
          /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while (
          (match = regex.exec(out)) !== null &&
          results.length < maxResults
        ) {
          const href = match[1].replace(/.*uddg=/, "").split("&")[0];
          const title = match[2].replace(/<[^>]+>/g, "").trim();
          try {
            results.push({ title, url: decodeURIComponent(href) });
          } catch {
            results.push({ title, url: href });
          }
        }
        if (results.length === 0) return "(no results)";
        return results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`)
          .join("\n\n");
      } catch {
        return "ERROR: Web search failed";
      }
    }

    case "browser_open": {
      const { browserNavigate } = require("../browser");
      try {
        const result = await browserNavigate(args.url, {
          waitFor: args.wait_for,
        });
        const linkStr =
          result.links.length > 0
            ? "\n\nLinks:\n" +
              result.links.map((l) => `  ${l.text} → ${l.href}`).join("\n")
            : "";
        return `Title: ${result.title}\nURL: ${result.url}\n\n${result.text}${linkStr}`;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case "browser_screenshot": {
      const { browserScreenshot } = require("../browser");
      try {
        const result = await browserScreenshot(args.url, {
          width: args.width,
          height: args.height,
          fullPage: args.full_page,
        });
        return `Screenshot saved: ${result.path}\nTitle: ${result.title}\nURL: ${result.url}\n\nTo analyze visually, paste the path into your next message: ${result.path}`;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case "browser_click": {
      const { browserClick } = require("../browser");
      try {
        return await browserClick(args.url, {
          selector: args.selector,
          text: args.text,
        });
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case "browser_fill": {
      const { browserFill } = require("../browser");
      try {
        return await browserFill(args.url, {
          selector: args.selector,
          value: args.value,
          submit: args.submit,
        });
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case "ask_user": {
      const { question, options = [] } = args;
      if (_askUserFn) {
        return new Promise((resolve) => {
          _cancelAskUser = () => resolve("CANCELLED");
          _askUserFn(question, options).then((answer) => {
            _cancelAskUser = null;
            resolve(answer || "User did not answer");
          });
        });
      }
      // Fallback: plain readline prompt (non-TTY / no handler registered)
      return new Promise((resolve) => {
        const rl = require("readline").createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        _cancelAskUser = () => {
          rl.close();
          resolve("CANCELLED");
        };
        const optText =
          options.length > 0
            ? `\n${options.map((o, i) => `  ${i + 1}. ${o}`).join("\n")}\n`
            : "";
        console.log(`\n${C.cyan}${C.bold}  ? ${question}${C.reset}${optText}`);
        rl.question(`${C.cyan}  > ${C.reset}`, (answer) => {
          _cancelAskUser = null;
          rl.close();
          resolve(answer.trim() || "(no response)");
        });
      });
    }

    case "git_status": {
      if (!(await isGitRepo())) return "ERROR: Not a git repository";
      const branch = (await getCurrentBranch()) || "(detached)";
      const status = await getStatus();
      if (status.length === 0)
        return `Branch: ${branch}\nClean working tree (no changes)`;
      const lines = [`Branch: ${branch}`, `Changed files (${status.length}):`];
      for (const s of status) {
        const label =
          s.status === "M"
            ? "modified"
            : s.status === "A"
              ? "added"
              : s.status === "D"
                ? "deleted"
                : s.status === "??"
                  ? "untracked"
                  : s.status;
        lines.push(`  ${label}: ${s.file}`);
      }
      return lines.join("\n");
    }

    case "git_diff": {
      if (!(await isGitRepo())) return "ERROR: Not a git repository";
      let diff;
      if (args.file) {
        const gitArgs = ["diff"];
        if (args.staged) gitArgs.push("--cached");
        gitArgs.push("--", args.file);
        try {
          diff = execFileSync("git", gitArgs, {
            cwd: process.cwd(),
            encoding: "utf-8",
            timeout: 15000,
            stdio: "pipe",
          }).trim();
        } catch {
          diff = "";
        }
      } else {
        diff = await getDiff(!!args.staged);
      }
      return diff || "(no diff)";
    }

    case "git_log": {
      if (!(await isGitRepo())) return "ERROR: Not a git repository";
      const count = Math.min(args.count || 10, 50);
      const gitLogArgs = ["log", "--oneline", `-${count}`];
      if (args.file) gitLogArgs.push("--", args.file);
      try {
        const out = execFileSync("git", gitLogArgs, {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 15000,
          stdio: "pipe",
        }).trim();
        return out || "(no commits)";
      } catch {
        return "(no commits)";
      }
    }

    case "task_list": {
      const {
        createTasks,
        updateTask,
        getTaskList,
        renderTaskList,
        hasActiveTasks,
      } = require("../tasks");
      const { getActiveTaskProgress } = require("../ui");
      const liveDisplay = getActiveTaskProgress();
      switch (args.action) {
        case "create": {
          if (!args.name || !args.tasks)
            return "ERROR: task_list create requires name and tasks";
          const created = createTasks(args.name, args.tasks);
          if (!liveDisplay) console.log("\n" + renderTaskList());
          return (
            `Created task list "${args.name}" with ${created.length} tasks:\n` +
            created.map((t) => `  ${t.id}: ${t.description}`).join("\n")
          );
        }
        case "update": {
          if (!args.task_id || !args.status)
            return "ERROR: task_list update requires task_id and status";
          const updated = updateTask(args.task_id, args.status, args.result);
          if (!updated) return `ERROR: Task not found: ${args.task_id}`;
          if (!liveDisplay) console.log("\n" + renderTaskList());
          return `Updated ${args.task_id}: ${args.status}${args.result ? " — " + args.result : ""}`;
        }
        case "get": {
          const list = getTaskList();
          if (list.tasks.length === 0) return "No active tasks";
          if (!liveDisplay) console.log("\n" + renderTaskList());
          return JSON.stringify(list, null, 2);
        }
        default:
          return `ERROR: Unknown task_list action: ${args.action}. Use: create, update, get`;
      }
    }

    case "spawn_agents": {
      const { executeSpawnAgents } = require("../sub-agent");
      return executeSpawnAgents(args);
    }

    case "switch_model": {
      const {
        setActiveModel,
        getActiveProviderName,
        getActiveModelId,
      } = require("../providers/registry");
      if (setActiveModel(args.model)) {
        return `Switched to ${getActiveProviderName()}:${getActiveModelId()}`;
      }
      return `ERROR: Unknown model: ${args.model}. Use /providers to see available models.`;
    }

    case "gh_run_list": {
      const limit = Math.min(args.limit || 10, 30);
      const ghArgs = [
        "run",
        "list",
        "--limit",
        String(limit),
        "--json",
        "databaseId,status,conclusion,name,headBranch,createdAt,updatedAt,event",
      ];
      if (args.workflow) ghArgs.push("--workflow", args.workflow);
      if (args.branch) ghArgs.push("--branch", args.branch);
      if (args.status) ghArgs.push("--status", args.status);
      try {
        const { stdout } = await execFile("gh", ghArgs, {
          cwd: process.cwd(),
          timeout: 30000,
        });
        const runs = JSON.parse(stdout || "[]");
        if (runs.length === 0) return "No workflow runs found.";
        const lines = runs.map((r) => {
          const status = r.conclusion || r.status || "unknown";
          const icon =
            status === "success"
              ? "✓"
              : status === "failure"
                ? "✗"
                : status === "in_progress"
                  ? "⠿"
                  : "○";
          const age = r.updatedAt
            ? new Date(r.updatedAt).toISOString().slice(0, 16).replace("T", " ")
            : "";
          return `${icon} [${r.databaseId}] ${r.name} · ${r.headBranch} · ${status} · ${age}`;
        });
        return lines.join("\n");
      } catch (e) {
        const msg = (e.stderr || e.message || "").toString();
        if (msg.includes("not found") || msg.includes("not logged"))
          return "ERROR: gh CLI not found or not authenticated. Run: gh auth login";
        return `ERROR: ${msg.split("\n")[0]}`;
      }
    }

    case "gh_run_view": {
      if (!args.run_id) return "ERROR: run_id is required";
      if (!/^\d+$/.test(String(args.run_id))) return "ERROR: run_id must be numeric";
      try {
        if (args.log) {
          const { stdout } = await execFile("gh", ["run", "view", String(args.run_id), "--log"], {
            cwd: process.cwd(),
            timeout: 60000,
            maxBuffer: 5 * 1024 * 1024,
          });
          return (
            stdout.substring(0, 8000) +
            (stdout.length > 8000 ? "\n...(truncated)" : "")
          );
        }
        const { stdout } = await execFile(
          "gh", ["run", "view", String(args.run_id), "--json", "status,conclusion,name,headBranch,createdAt,updatedAt,jobs"],
          { cwd: process.cwd(), timeout: 30000 },
        );
        const run = JSON.parse(stdout);
        const lines = [
          `Run: ${run.name} [${args.run_id}]`,
          `Branch: ${run.headBranch}  Status: ${run.conclusion || run.status}`,
          `Started: ${run.createdAt}  Finished: ${run.updatedAt || "—"}`,
          "",
          "Jobs:",
        ];
        for (const job of run.jobs || []) {
          const icon =
            job.conclusion === "success"
              ? "✓"
              : job.conclusion === "failure"
                ? "✗"
                : "○";
          lines.push(`  ${icon} ${job.name} (${job.conclusion || job.status})`);
          for (const step of job.steps || []) {
            if (step.conclusion === "failure" || step.conclusion === "skipped")
              continue;
            const sIcon =
              step.conclusion === "success"
                ? "  ✓"
                : step.conclusion === "failure"
                  ? "  ✗"
                  : "  ○";
            lines.push(`    ${sIcon} ${step.name}`);
          }
        }
        return lines.join("\n");
      } catch (e) {
        return `ERROR: ${(e.stderr || e.message || "").toString().split("\n")[0]}`;
      }
    }

    case "gh_workflow_trigger": {
      if (!args.workflow) return "ERROR: workflow is required";
      if (!/^[\w./-]+$/.test(args.workflow)) return "ERROR: invalid workflow name";
      const { confirm: confirmTrigger } = require("../safety");
      const branch = args.branch || (await getCurrentBranch()) || "main";
      if (!/^[\w./-]+$/.test(branch)) return "ERROR: invalid branch name";
      const ghArgs = ["workflow", "run", args.workflow, "--ref", branch];
      if (args.inputs) {
        for (const [k, v] of Object.entries(args.inputs)) {
          if (!/^[\w-]+$/.test(k)) return `ERROR: invalid input key: ${k}`;
          ghArgs.push("-f", `${k}=${v}`);
        }
      }
      console.log(
        `\n${C.yellow}  ⚠ Trigger workflow: ${args.workflow} on ${branch}${C.reset}`,
      );
      const ok = await confirmTrigger("  Trigger?");
      if (!ok) return "CANCELLED: User declined to trigger workflow.";
      try {
        await execFile("gh", ghArgs, { cwd: process.cwd(), timeout: 30000 });
        return `Workflow "${args.workflow}" triggered on branch "${branch}". Check status with gh_run_list.`;
      } catch (e) {
        return `ERROR: ${(e.stderr || e.message || "").toString().split("\n")[0]}`;
      }
    }

    case "k8s_pods": {
      const nsFlag = args.namespace ? `-n ${args.namespace}` : "-A";
      const labelFlag = args.label ? `-l ${args.label}` : "";
      const cmd = buildKubectlCmd(
        `get pods ${nsFlag} ${labelFlag} -o wide`.trim(),
        args,
      );
      try {
        const { stdout, stderr } = await exec(cmd, {
          timeout: 30000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return (stdout || stderr || "(no pods)").trim();
      } catch (e) {
        const msg = (e.stderr || e.message || "").toString().split("\n")[0];
        if (msg.includes("command not found"))
          return "ERROR: kubectl not found. Install kubectl or provide a server with kubectl.";
        return `ERROR: ${msg}`;
      }
    }

    case "k8s_logs": {
      if (!args.pod) return "ERROR: pod is required";
      const ns = args.namespace || "default";
      const tail = args.tail || 100;
      let kubectlArgs = `logs ${args.pod} -n ${ns} --tail=${tail}`;
      if (args.since) kubectlArgs += ` --since=${args.since}`;
      if (args.container) kubectlArgs += ` -c ${args.container}`;
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, {
          timeout: 60000,
          maxBuffer: 5 * 1024 * 1024,
        });
        const out = (stdout || stderr || "(no logs)").trim();
        return (
          out.substring(0, 20000) +
          (out.length > 20000 ? "\n...(truncated)" : "")
        );
      } catch (e) {
        const msg = (e.stderr || e.message || "").toString().split("\n")[0];
        return `ERROR: ${msg}`;
      }
    }

    case "k8s_exec": {
      if (!args.pod) return "ERROR: pod is required";
      if (!args.command) return "ERROR: command is required";
      const ns = args.namespace || "default";
      console.log(
        `\n${C.yellow}  ⚠ kubectl exec into pod: ${args.pod} (ns: ${ns})${C.reset}`,
      );
      console.log(`${C.dim}  Command: ${args.command}${C.reset}`);
      const ok = await confirm("  Execute in pod?");
      if (!ok) return "CANCELLED: User declined.";
      let kubectlArgs = `exec ${args.pod} -n ${ns}`;
      if (args.container) kubectlArgs += ` -c ${args.container}`;
      kubectlArgs += ` -- sh -c ${JSON.stringify(args.command)}`;
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, {
          timeout: 60000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return (stdout || stderr || "(no output)").trim();
      } catch (e) {
        const msg = (e.stderr || e.message || "").toString().split("\n")[0];
        return `ERROR: ${msg}`;
      }
    }

    case "k8s_apply": {
      if (!args.file) return "ERROR: file is required";
      const isDryRun = !!args.dry_run;
      if (!isDryRun) {
        const manifestPath = args.file;
        console.log(
          `\n${C.yellow}  ⚠ kubectl apply: ${manifestPath}${args.namespace ? ` (ns: ${args.namespace})` : ""}${C.reset}`,
        );
        const ok = await confirm("  Apply to cluster?");
        if (!ok) return "CANCELLED: User declined.";
      }
      let kubectlArgs = `apply -f ${args.file}`;
      if (args.namespace) kubectlArgs += ` -n ${args.namespace}`;
      if (isDryRun) kubectlArgs += " --dry-run=client";
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, {
          timeout: 120000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return (stdout || stderr || "(no output)").trim();
      } catch (e) {
        const msg = (e.stderr || e.message || "").toString();
        return `ERROR: ${msg.split("\n")[0]}`;
      }
    }

    case "k8s_rollout": {
      if (!args.action) return "ERROR: action is required";
      if (!args.deployment) return "ERROR: deployment is required";
      const ns = args.namespace || "default";
      const needsConfirm = args.action === "restart" || args.action === "undo";
      if (needsConfirm) {
        const label =
          args.action === "restart" ? "Rolling restart" : "Rollback (undo)";
        console.log(
          `\n${C.yellow}  ⚠ ${label}: deployment/${args.deployment} (ns: ${ns})${C.reset}`,
        );
        const ok = await confirm(`  ${label}?`);
        if (!ok) return "CANCELLED: User declined.";
      }
      const kubectlArgs = `rollout ${args.action} deployment/${args.deployment} -n ${ns}`;
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, {
          timeout: 120000,
          maxBuffer: 2 * 1024 * 1024,
        });
        return (stdout || stderr || "(no output)").trim();
      } catch (e) {
        const msg = (e.stderr || e.message || "").toString().split("\n")[0];
        return `ERROR: ${msg}`;
      }
    }

    case "brain_write": {
      if (!args.name) return "ERROR: name is required";
      if (!args.content) return "ERROR: content is required";
      if (!args.mode) return "ERROR: mode is required (create, update, append)";
      const {
        writeDocument: brainWrite,
        readDocument: brainRead,
      } = require("../brain");
      const { name: docName, content: docContent, mode: docMode } = args;

      if (docMode === "create") {
        const existing = brainRead(docName);
        if (existing.content) {
          return `ERROR: Document "${docName}" already exists. Use mode "update" to overwrite.`;
        }
      }

      if (docMode === "append") {
        const existing = brainRead(docName);
        const combined = existing.content
          ? existing.content + "\n\n" + docContent
          : docContent;
        brainWrite(docName, combined);
        return `Appended to brain document: ${docName}.md`;
      }

      brainWrite(docName, docContent);
      return `${docMode === "create" ? "Created" : "Updated"} brain document: ${docName}.md`;
    }

    case "ssh_exec": {
      if (!args.server) return "ERROR: server is required";
      if (!args.command) return "ERROR: command is required";

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      let cmd = args.command;
      const useSudo = Boolean(args.sudo);
      const timeoutMs = (args.timeout || 30) * 1000;

      // Block secret-exposure commands on remote hosts.
      // cat/grep of .env, credentials, private keys, etc. dump secrets directly into
      // LLM tool-result context — equivalent to printing them in the chat.
      const sshForbidden = isSSHForbidden(cmd);
      if (sshForbidden) {
        // Give a specific, actionable hint based on which pattern matched
        const isSedN = /\bsed\s+-n\s+['"]?\d+,\d+p/.test(cmd);
        const hint = isSedN
          ? `BLOCKED: sed -n line-range is blocked (floods context). To read specific lines from a remote file use:\n  grep -n "pattern" /path/to/file -A 50\nor to read the whole file:\n  cat /path/to/file\nNEVER use sed -n again — it will always be blocked.`
          : `BLOCKED: Remote command matches SSH secret-exposure pattern: ${sshForbidden}\nHINT: Do not read .env, credentials, or private key files via ssh_exec — secrets would appear in tool output. Reference variable names or file paths instead.`;
        return hint;
      }

      // Cap grep context flags in ssh_exec commands — mirrors the grep tool's own 20-line cap.
      // Without this an agent can bypass the cap by using ssh_exec with grep -B100.
      cmd = cmd.replace(/(-[BAC])\s*(\d+)/g, (_, flag, n) => {
        const capped = Math.min(Number(n), 20);
        return `${flag} ${capped}`;
      });
      cmd = cmd.replace(/(--(?:before|after|context)=)(\d+)/g, (_, flag, n) => {
        return flag + Math.min(Number(n), 20);
      });

      // Require confirmation for destructive/modifying remote commands
      const isDestructive =
        /\b(rm|rmdir|mv|cp|chmod|chown|dd|mkfs|systemctl\s+(start|stop|restart|reload|enable|disable)|dnf\s+(install|remove|update|upgrade)|yum\s+(install|remove)|apt(-get)?\s+(install|remove|purge)|pip\s+install|pip3\s+install|firewall-cmd\s+--permanent|semanage|setsebool|passwd|userdel|useradd|nginx\s+-s\s+(reload|stop)|service\s+\w+\s+(start|stop|restart))\b/.test(
          cmd,
        );

      if (isDestructive) {
        const target = profile.user
          ? `${profile.user}@${profile.host}`
          : profile.host;
        console.log(
          `\n${C.yellow}  ⚠ Remote command on ${target}: ${cmd}${C.reset}`,
        );
        const ok = await confirm("  Execute on remote server?");
        if (!ok) return "CANCELLED: User declined to execute remote command.";
      }

      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, {
        timeout: timeoutMs,
        sudo: useSudo,
      });

      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (exitCode !== 0) {
        return `EXIT ${exitCode}\n${error || output || "(no output)"}`;
      }
      // For grep commands with large -B or -A context: remove '--' separator lines (they
      // waste context without adding information) and enforce a tighter line cap.
      const isGrepCmd = /\bgrep\b/.test(cmd);
      let processedOutput = output;
      if (isGrepCmd) {
        // Strip grep '--' context separator lines entirely
        processedOutput = processedOutput
          .split("\n")
          .filter((line) => line !== "--")
          .join("\n");
      }

      // Cap SSH output to save context — keeps last N lines (most relevant for log commands).
      // Grep commands with -B or -A get a tighter cap because context blocks multiply quickly.
      // Previously 200/100 — reduced to 100/60 to prevent context overflow on multi-SSH tasks.
      const SSH_MAX_LINES = isGrepCmd ? 60 : 100;
      const outputLines = processedOutput.split("\n");
      if (outputLines.length > SSH_MAX_LINES) {
        const dropped = outputLines.length - SSH_MAX_LINES;
        processedOutput =
          `(${dropped} earlier lines omitted — showing last ${SSH_MAX_LINES})\n` +
          outputLines.slice(-SSH_MAX_LINES).join("\n");
      }

      // Deduplicate repeated lines — log files often have 100+ identical error lines
      // (e.g., "Cannot find module" firing every minute). These flood the LLM context
      // with zero additional information. Collapse runs of >4 identical lines.
      const SSH_DEDUP_THRESHOLD = 4;
      const dedupLines = processedOutput.split("\n");
      const deduped = [];
      let i = 0;
      while (i < dedupLines.length) {
        let j = i + 1;
        while (j < dedupLines.length && dedupLines[j] === dedupLines[i]) j++;
        const count = j - i;
        deduped.push(dedupLines[i]);
        if (count > SSH_DEDUP_THRESHOLD) {
          deduped.push(`... (${count - 1} identical lines omitted)`);
        } else {
          for (let k = 1; k < count; k++) deduped.push(dedupLines[i]);
        }
        i = j;
      }
      return deduped.join("\n") || "(command completed, no output)";
    }

    case "ssh_upload": {
      if (!args.server || !args.local_path || !args.remote_path) {
        return "ERROR: server, local_path, and remote_path are required";
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      const target = profile.user
        ? `${profile.user}@${profile.host}`
        : profile.host;
      console.log(
        `\n${C.yellow}  ⚠ Upload: ${args.local_path} → ${target}:${args.remote_path}${C.reset}`,
      );
      const ok = await confirm("  Upload to remote server?");
      if (!ok) return "CANCELLED: User declined upload.";

      try {
        const result = await scpUpload(
          profile,
          args.local_path,
          args.remote_path,
        );
        return result;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case "ssh_download": {
      if (!args.server || !args.remote_path || !args.local_path) {
        return "ERROR: server, remote_path, and local_path are required";
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      try {
        const result = await scpDownload(
          profile,
          args.remote_path,
          args.local_path,
        );
        return result;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case "remote_agent": {
      // Read SSH profile from servers.json
      const serversPath = require("path").join(
        process.cwd(),
        ".nex",
        "servers.json",
      );
      let profile = null;
      try {
        const servers = JSON.parse(
          require("fs").readFileSync(serversPath, "utf-8"),
        );
        profile = servers[args.server] || null;
      } catch {
        /* file not found */
      }

      // Support "user@host" format directly
      const target = profile
        ? `${profile.user || "root"}@${profile.host}`
        : args.server;
      const sshKey = profile?.key ? ["-i", profile.key] : [];
      const workDir = (args.project_path || profile?.home || "~").replace(/[^a-zA-Z0-9_/~.-]/g, "");
      const model = (args.model || "").replace(/[^a-zA-Z0-9_:.-]/g, "");

      // Write task to temp file on remote, run nex-code, stream output
      const taskB64 = Buffer.from(args.task).toString("base64");
      const remoteScript = [
        `TMPFILE=$(mktemp /tmp/nexcode-XXXXXX.txt) && chmod 600 "$TMPFILE"`,
        `echo "${taskB64}" | base64 -d > "$TMPFILE"`,
        `cd "${workDir}" 2>/dev/null || true`,
        model
          ? `nex-code --prompt-file "$TMPFILE" --auto --model "${model}" 2>&1`
          : `nex-code --prompt-file "$TMPFILE" --auto 2>&1`,
        `EXIT_CODE=$?`,
        `rm -f "$TMPFILE"`,
        `exit $EXIT_CODE`,
      ].join(" && ");

      const { spawnSync } = require("child_process");
      const result = spawnSync(
        "ssh",
        [
          ...sshKey,
          "-o",
          "StrictHostKeyChecking=accept-new",
          "-o",
          "ConnectTimeout=10",
          target,
          `bash -c '${remoteScript}'`,
        ],
        { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 300000 },
      );

      if (result.error)
        return `ERROR: SSH connection failed: ${result.error.message}`;
      const output = (result.stdout || "") + (result.stderr || "");
      if (result.status !== 0)
        return `Remote nex-code exited with code ${result.status}.\n${output.slice(-2000)}`;
      return output.slice(-5000) || "Remote nex-code completed (no output)";
    }

    case "service_manage": {
      if (!args.service) return "ERROR: service is required";
      if (!args.action) return "ERROR: action is required";

      const validActions = [
        "status",
        "start",
        "stop",
        "restart",
        "reload",
        "enable",
        "disable",
      ];
      if (!validActions.includes(args.action)) {
        return `ERROR: invalid action "${args.action}". Valid: ${validActions.join(", ")}`;
      }

      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";
      const isReadOnly = args.action === "status";

      let profile = null;
      if (!isLocal) {
        try {
          profile = resolveProfile(args.server);
        } catch (e) {
          return `ERROR: ${e.message}`;
        }
      }

      // Confirmation for non-status actions
      if (!isReadOnly) {
        const location = isLocal
          ? "local machine"
          : profile.user
            ? `${profile.user}@${profile.host}`
            : profile.host;
        console.log(
          `\n${C.yellow}  ⚠ Service: systemctl ${args.action} ${args.service} on ${location}${C.reset}`,
        );
        const ok = await confirm("  Execute?");
        if (!ok) return "CANCELLED: User declined service action.";
      }

      const cmd = `systemctl ${args.action} ${args.service}`;

      if (isLocal) {
        // Local execution
        const needsSudo = args.action !== "status";
        const localCmd = needsSudo ? `sudo ${cmd}` : cmd;
        try {
          const { stdout, stderr } = await exec(localCmd, { timeout: 15000 });
          return (
            stdout ||
            stderr ||
            `systemctl ${args.action} ${args.service}: OK`
          ).trim();
        } catch (e) {
          const errMsg = (e.stderr || e.message || "").toString().trim();
          if (/not found|loaded.*not-found/i.test(errMsg)) {
            return `ERROR: Service "${args.service}" not found. Check: systemctl list-units --type=service`;
          }
          return `EXIT ${e.code || 1}\n${errMsg}`;
        }
      } else {
        const { stdout, stderr, exitCode, error } = await sshExec(
          profile,
          cmd,
          { timeout: 15000, sudo: true },
        );
        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (exitCode !== 0) {
          if (/not found|loaded.*not-found/i.test(output)) {
            return `ERROR: Service "${args.service}" not found on ${profile.host}. Check: ssh_exec to run "systemctl list-units --type=service"`;
          }
          return `EXIT ${exitCode}\n${error || output || "(no output)"}`;
        }
        return output || `systemctl ${args.action} ${args.service}: OK`;
      }
    }

    case "service_logs": {
      if (!args.service) return "ERROR: service is required";

      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";
      const lines = args.lines || 50;
      const sinceFlag = args.since ? `--since "${args.since}"` : "";
      const followFlag = args.follow ? "-f" : "";
      const cmd =
        `journalctl -u ${args.service} -n ${lines} ${sinceFlag} ${followFlag} --no-pager`
          .trim()
          .replace(/\s+/g, " ");

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 15000 });
          return (stdout || stderr || "(no log output)").trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || "").toString().trim()}`;
        }
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, {
        timeout: 20000,
      });
      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (exitCode !== 0)
        return `EXIT ${exitCode}\n${error || output || "(no output)"}`;
      return output || "(no log output)";
    }

    // ─── Docker Tools ─────────────────────────────────────────

    case "container_list": {
      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";
      const allFlag = args.all ? "-a" : "";
      const cmd =
        `docker ps ${allFlag} --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"`
          .trim()
          .replace(/\s+/g, " ");

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 10000 });
          return (stdout || stderr || "(no containers)").trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || "").toString().trim()}`;
        }
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, {
        timeout: 15000,
      });
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || "(no containers)";
    }

    case "container_logs": {
      if (!args.container) return "ERROR: container is required";
      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";
      const lines = args.lines || 50;
      const sinceFlag = args.since ? `--since "${args.since}"` : "";
      const cmd =
        `docker logs --tail ${lines} ${sinceFlag} ${args.container} 2>&1`
          .trim()
          .replace(/\s+/g, " ");

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 15000 });
          return (stdout || stderr || "(no log output)").trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || "").toString().trim()}`;
        }
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, {
        timeout: 20000,
      });
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || "(no log output)";
    }

    case "container_exec": {
      if (!args.container) return "ERROR: container is required";
      if (!args.command) return "ERROR: command is required";
      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";

      // Confirm non-trivial / state-changing commands
      const DOCKER_SAFE_RE =
        /^(cat|ls|echo|env|printenv|df|du|ps|id|whoami|uname|hostname|date|pwd|which|find\s|head\s|tail\s|grep\s|curl\s+-[A-Za-z]*G|curl\s+https?:\/\/[^\s]+$)/;
      const needsConfirm =
        !options.autoConfirm && !DOCKER_SAFE_RE.test(args.command.trim());
      if (needsConfirm) {
        const where = isLocal ? "local" : args.server;
        console.log(
          `\n${C.yellow}  ⚠ docker exec in ${args.container} on ${where}: ${args.command}${C.reset}`,
        );
        const ok = await confirm("  Execute?");
        if (!ok) return "CANCELLED: User declined.";
      }

      const safeContainer = (args.container || "").replace(
        /[^a-zA-Z0-9._\/-]/g,
        "",
      );
      if (!safeContainer) return "ERROR: Invalid container name";
      const cmd = `docker exec ${safeContainer} sh -c ${JSON.stringify(args.command)}`;

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 30000 });
          return (stdout || stderr || "(no output)").trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || "").toString().trim()}`;
        }
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, {
        timeout: 35000,
      });
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || "(no output)";
    }

    case "container_manage": {
      if (!args.container) return "ERROR: container is required";
      if (!args.action) return "ERROR: action is required";
      const VALID_ACTIONS = ["start", "stop", "restart", "remove", "inspect"];
      if (!VALID_ACTIONS.includes(args.action))
        return `ERROR: invalid action "${args.action}". Valid: ${VALID_ACTIONS.join(", ")}`;

      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";
      const isReadOnly = args.action === "inspect";

      if (!isReadOnly && !options.autoConfirm) {
        const where = isLocal ? "local" : args.server;
        console.log(
          `\n${C.yellow}  ⚠ docker ${args.action} ${args.container} on ${where}${C.reset}`,
        );
        const ok = await confirm("  Execute?");
        if (!ok) return "CANCELLED: User declined.";
      }

      const dockerAction = args.action === "remove" ? "rm" : args.action;
      const cmd =
        args.action === "inspect"
          ? `docker inspect ${args.container}`
          : `docker ${dockerAction} ${args.container}`;

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 30000 });
          return (
            stdout ||
            stderr ||
            `docker ${args.action} ${args.container}: OK`
          ).trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || "").toString().trim()}`;
        }
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, {
        timeout: 35000,
      });
      const out = [stdout, stderr].filter(Boolean).join("\n").trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || `docker ${args.action} ${args.container}: OK`;
    }

    // ─── Deploy Tool ──────────────────────────────────────────

    case "deploy": {
      // Resolve named config from .nex/deploy.json if provided
      if (args.config) {
        try {
          const cfg = resolveDeployConfig(args.config);
          // Merge: explicit args override config values (except config itself)
          args = { ...cfg, ...args };
          delete args.config;
          delete args._name;
        } catch (e) {
          return `ERROR: ${e.message}`;
        }
      }

      if (!args.server)
        return 'ERROR: server is required (or use config: "<name>")';
      if (!args.remote_path) return "ERROR: remote_path is required";

      const method = args.method || "rsync";
      if (method === "rsync" && !args.local_path)
        return "ERROR: local_path is required for rsync method";

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      const target = profile.user
        ? `${profile.user}@${profile.host}`
        : profile.host;

      // ── Confirmation ──────────────────────────────────────────
      if (!args.dry_run && !options.autoConfirm) {
        if (method === "git") {
          const branchLabel = args.branch ? ` (branch: ${args.branch})` : "";
          console.log(
            `\n${C.yellow}  ⚠ Deploy [git pull]: ${target}:${args.remote_path}${branchLabel}${C.reset}`,
          );
        } else {
          const localPath = args.local_path.endsWith("/")
            ? args.local_path
            : `${args.local_path}/`;
          console.log(
            `\n${C.yellow}  ⚠ Deploy [rsync]: ${localPath} → ${target}:${args.remote_path}${C.reset}`,
          );
        }
        if (args.deploy_script)
          console.log(`${C.yellow}  Then run: ${args.deploy_script}${C.reset}`);
        if (args.health_check)
          console.log(
            `${C.yellow}  Health check: ${args.health_check}${C.reset}`,
          );
        const ok = await confirm("  Proceed with deployment?");
        if (!ok) return "CANCELLED: User declined.";
      }

      let syncOutput = "";

      // ── Sync step ─────────────────────────────────────────────
      if (method === "git") {
        const safeBranch = (args.branch || "").replace(
          /[^a-zA-Z0-9._\/-]/g,
          "",
        );
        if (args.branch && safeBranch !== args.branch)
          return `ERROR: Invalid branch name: ${args.branch}`;
        const safeRemotePath = (args.remote_path || "").replace(/'/g, "'\\''");
        const pullCmd = safeBranch
          ? `cd '${safeRemotePath}' && git fetch origin && git checkout '${safeBranch}' && git pull origin '${safeBranch}'`
          : `cd '${safeRemotePath}' && git pull`;
        if (args.dry_run) {
          return `DRY RUN [git]: would run on ${target}:\n  ${pullCmd}${args.deploy_script ? `\n  ${args.deploy_script}` : ""}`;
        }
        const { stdout, stderr, exitCode, error } = await sshExec(
          profile,
          pullCmd,
          { timeout: 120000 },
        );
        syncOutput = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (exitCode !== 0) {
          return `ERROR (git pull, exit ${exitCode}):\n${error || syncOutput}`;
        }
      } else {
        const sshFlags = profile.key
          ? `-e "ssh -i ${profile.key.replace(/^~/, require("os").homedir())}${profile.port && Number(profile.port) !== 22 ? ` -p ${profile.port}` : ""}"`
          : profile.port && Number(profile.port) !== 22
            ? `-e "ssh -p ${profile.port}"`
            : "";
        const excludeFlags = (args.exclude || [])
          .map((e) => `--exclude="${e}"`)
          .join(" ");
        const dryRunFlag = args.dry_run ? "--dry-run" : "";
        const localPath = args.local_path.endsWith("/")
          ? args.local_path
          : `${args.local_path}/`;
        const rsyncCmd =
          `rsync -avz --delete ${dryRunFlag} ${excludeFlags} ${sshFlags} ${localPath} ${target}:${args.remote_path}`
            .trim()
            .replace(/\s+/g, " ");
        try {
          const { stdout, stderr } = await exec(rsyncCmd, { timeout: 120000 });
          syncOutput = (stdout || stderr || "").trim();
        } catch (e) {
          return `ERROR (rsync): ${(e.stderr || e.message || "").toString().trim()}`;
        }
        if (args.dry_run)
          return `DRY RUN [rsync]:\n${syncOutput || "(nothing to sync)"}`;
      }

      // ── Post-deploy script ────────────────────────────────────
      let scriptOutput = "";
      if (args.deploy_script) {
        const { stdout, stderr, exitCode, error } = await sshExec(
          profile,
          args.deploy_script,
          { timeout: 120000 },
        );
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        if (exitCode !== 0) {
          return `${method === "git" ? "git pull" : "rsync"} OK\n\nERROR (deploy_script, exit ${exitCode}):\n${error || out}`;
        }
        scriptOutput = `\n\nDeploy script output:\n${out || "(no output)"}`;
      }

      // ── Health check ──────────────────────────────────────────
      let healthOutput = "";
      if (args.health_check) {
        const hc = args.health_check.trim();
        const isUrl = /^https?:\/\//.test(hc);
        if (isUrl) {
          try {
            const fetch = require("node-fetch");
            const res = await Promise.race([
              fetch(hc),
              new Promise((_, rej) =>
                setTimeout(() => rej(new Error("timeout")), 15000),
              ),
            ]);
            if (res.ok) {
              healthOutput = `\n\nHealth check: ✓ ${hc} → ${res.status}`;
            } else {
              healthOutput = `\n\nHealth check FAILED: ${hc} → HTTP ${res.status}`;
              return (
                (method === "git" ? `git pull OK` : `rsync OK`) +
                syncOutput +
                scriptOutput +
                healthOutput
              );
            }
          } catch (e) {
            healthOutput = `\n\nHealth check FAILED: ${hc} → ${e.message}`;
            return (
              (method === "git" ? `git pull OK` : `rsync OK`) +
              syncOutput +
              scriptOutput +
              healthOutput
            );
          }
        } else {
          // Treat as remote shell command
          const { stdout, stderr, exitCode } = await sshExec(profile, hc, {
            timeout: 15000,
          });
          const out = [stdout, stderr].filter(Boolean).join("\n").trim();
          if (exitCode !== 0) {
            healthOutput = `\n\nHealth check FAILED (exit ${exitCode}): ${out}`;
            return (
              (method === "git" ? `git pull OK` : `rsync OK`) +
              syncOutput +
              scriptOutput +
              healthOutput
            );
          }
          healthOutput = `\n\nHealth check: ✓ ${out || "(exit 0)"}`;
        }
      }

      const methodLabel =
        method === "git"
          ? `${target}:${args.remote_path}`
          : `${args.local_path} → ${target}:${args.remote_path}`;
      return `Deployed [${method}] ${methodLabel}\n${syncOutput}${scriptOutput}${healthOutput}`.trim();
    }

    case "deployment_status": {
      const configs = loadDeployConfigs();
      const names = args.config ? [args.config] : Object.keys(configs);

      if (names.length === 0)
        return "No deploy configs found. Create .nex/deploy.json to configure deployments.";

      const results = [];
      for (const name of names) {
        const cfg = configs[name];
        if (!cfg) {
          results.push(`${name}: NOT FOUND`);
          continue;
        }

        try {
          const profile = resolveProfile(cfg.server || name);
          // Check if server is reachable
          const pingResult = await sshExec(profile, "echo OK", {
            timeout: 10000,
          });
          const reachable = pingResult.stdout.trim() === "OK";

          let serviceStatus = "unknown";
          if (reachable && cfg.deploy_script) {
            // Extract service name from deploy_script if it's a systemctl command
            const svcMatch = cfg.deploy_script.match(/systemctl\s+\w+\s+(\S+)/);
            if (svcMatch) {
              try {
                const svcResult = await sshExec(
                  profile,
                  `systemctl is-active ${svcMatch[1]}`,
                  { timeout: 10000 },
                );
                serviceStatus = svcResult.stdout.trim();
              } catch {
                serviceStatus = "inactive";
              }
            }
          }

          let healthStatus = "N/A";
          if (cfg.health_check) {
            const hc = cfg.health_check.trim();
            if (/^https?:\/\//.test(hc)) {
              try {
                const fetch = require("node-fetch");
                const res = await Promise.race([
                  fetch(hc),
                  new Promise((_, rej) =>
                    setTimeout(() => rej(new Error("timeout")), 10000),
                  ),
                ]);
                healthStatus = res.ok ? "healthy" : `HTTP ${res.status}`;
              } catch (e) {
                healthStatus = `unhealthy: ${e.message.substring(0, 50)}`;
              }
            } else {
              // Treat as remote shell command
              try {
                const hcResult = await sshExec(profile, hc, { timeout: 10000 });
                healthStatus =
                  hcResult.exitCode === 0 ? "healthy" : "unhealthy";
              } catch {
                healthStatus = "unhealthy";
              }
            }
          }

          results.push(
            `${name}: server=${reachable ? "reachable" : "unreachable"} service=${serviceStatus} health=${healthStatus}`,
          );
        } catch (e) {
          results.push(`${name}: ERROR — ${e.message}`);
        }
      }

      return `Deployment Status:\n${results.join("\n")}`;
    }

    case "frontend_recon": {
      const cwd = process.cwd();
      const targetType = (args.type || "").toLowerCase();
      const sections = [];

      // Helper: read first N lines of a file, return null on error
      const tryRead = async (fp, maxLines = 120) => {
        try {
          const abs = path.isAbsolute(fp) ? fp : path.join(cwd, fp);
          const content = await fs.readFile(abs, "utf8");
          const lines = content.split("\n");
          const preview = lines.slice(0, maxLines).join("\n");
          return lines.length > maxLines
            ? preview +
                `\n... (${lines.length - maxLines} more lines — use read_file for full content)`
            : preview;
        } catch {
          return null;
        }
      };

      // Helper: find files by name pattern, skip noisy dirs
      // Each dir needs its own -not -path clause; alternation (|) is not valid in find glob patterns.
      const SKIP_DIRS = [
        "node_modules",
        ".git",
        "dist",
        "build",
        "vendor",
        ".next",
        "__pycache__",
        "venv",
        ".venv",
      ];
      const skipFlags = SKIP_DIRS.map((d) => `-not -path "*/${d}/*"`).join(" ");
      const findByName = async (name) => {
        try {
          const { stdout } = await exec(
            `find "${cwd}" -type f -name "${name}" ${skipFlags} 2>/dev/null | head -10`,
            { timeout: 8000 },
          );
          return stdout.trim().split("\n").filter(Boolean);
        } catch {
          return [];
        }
      };

      // Helper: grep for pattern across file type
      const grepForPattern = async (pattern, include) => {
        try {
          const { stdout } = await exec(
            `grep -rl "${pattern}" "${cwd}" --include="${include}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build 2>/dev/null | head -5`,
            { timeout: 8000 },
          );
          return stdout.trim().split("\n").filter(Boolean);
        } catch {
          return [];
        }
      };

      // ── STEP 1: Design Tokens ──────────────────────────────────
      sections.push("## STEP 1: Design Tokens\n");

      // Tailwind config
      const tailwindFiles = [
        ...(await findByName("tailwind.config.js")),
        ...(await findByName("tailwind.config.ts")),
        ...(await findByName("tailwind.config.mjs")),
      ];
      if (tailwindFiles.length > 0) {
        const content = await tryRead(tailwindFiles[0], 80);
        if (content)
          sections.push(
            `### Tailwind config (${path.relative(cwd, tailwindFiles[0])})\n\`\`\`js\n${content}\n\`\`\``,
          );
      } else {
        sections.push("(no tailwind.config found)");
      }

      // CSS custom properties (:root)
      const cssCandidates = [
        "variables.css",
        "_variables.scss",
        "tokens.css",
        "base.css",
        "global.css",
        "main.css",
        "index.css",
        "app.css",
        "style.css",
        "styles.css",
      ];
      let foundCssVars = false;
      for (const name of cssCandidates) {
        const files = await findByName(name);
        for (const fp of files) {
          const content = await tryRead(fp, 100);
          if (content && content.includes(":root")) {
            sections.push(
              `### CSS Variables (${path.relative(cwd, fp)})\n\`\`\`css\n${content}\n\`\`\``,
            );
            foundCssVars = true;
            break;
          }
        }
        if (foundCssVars) break;
      }
      if (!foundCssVars) {
        const rootFiles = await grepForPattern(":root", "*.css");
        if (rootFiles.length > 0) {
          const content = await tryRead(rootFiles[0], 100);
          if (content)
            sections.push(
              `### CSS Variables (${path.relative(cwd, rootFiles[0])})\n\`\`\`css\n${content}\n\`\`\``,
            );
          foundCssVars = true;
        }
      }
      if (!foundCssVars)
        sections.push("(no CSS custom properties / :root found)");

      // ── STEP 2: Main Layout / Index Page ──────────────────────
      sections.push("\n## STEP 2: Main Layout / Index Page\n");

      const indexCandidates = [
        "base.html",
        "_base.html",
        "layout.html",
        "base.jinja",
        "App.vue",
        "App.jsx",
        "App.tsx",
        "_app.jsx",
        "_app.tsx",
        "_app.js",
        "layout.vue",
        "index.html",
      ];
      let foundIndex = false;
      for (const name of indexCandidates) {
        const files = await findByName(name);
        if (files.length > 0) {
          const content = await tryRead(files[0], 150);
          if (content) {
            sections.push(
              `### Main layout: ${path.relative(cwd, files[0])}\n\`\`\`html\n${content}\n\`\`\``,
            );
            foundIndex = true;
            break;
          }
        }
      }
      if (!foundIndex)
        sections.push(
          "(no main layout/index file found — try read_file on your root template manually)",
        );

      // ── STEP 3: Reference Component ────────────────────────────
      sections.push("\n## STEP 3: Reference Component (same type)\n");

      let refFiles = [];
      // Try to find files matching the type hint
      if (targetType) {
        for (const ext of ["*.html", "*.vue", "*.jsx", "*.tsx"]) {
          refFiles = await grepForPattern(targetType, ext);
          if (refFiles.length > 0) break;
        }
      }
      // Fallback: find recently modified frontend files, excluding layout/base files
      if (refFiles.length === 0) {
        try {
          const { stdout } = await exec(
            `find "${cwd}" -type f \\( -name "*.html" -o -name "*.vue" -o -name "*.jsx" -o -name "*.tsx" \\) ` +
              `-not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" ` +
              `-not -name "base.html" -not -name "_base.html" -not -name "layout.html" -not -name "App.vue" -not -name "App.jsx" ` +
              `2>/dev/null | head -20`,
            { timeout: 8000 },
          );
          refFiles = stdout.trim().split("\n").filter(Boolean);
        } catch {
          refFiles = [];
        }
      }

      if (refFiles.length > 0) {
        const fp = refFiles[0];
        const content = await tryRead(fp, 150);
        if (content)
          sections.push(
            `### Reference: ${path.relative(cwd, fp)}\n\`\`\`html\n${content}\n\`\`\``,
          );
        else sections.push("(reference file found but could not be read)");
      } else {
        sections.push(
          "(no reference component found — check manually with glob or list_directory)",
        );
      }

      // ── STEP 4: Framework Stack Detection ─────────────────────
      sections.push("\n## STEP 4: Framework Stack\n");

      const stackParts = [];

      // package.json
      const pkgContent = await tryRead(path.join(cwd, "package.json"), 999);
      if (pkgContent) {
        if (pkgContent.includes('"react"') || pkgContent.includes("'react'"))
          stackParts.push("React");
        if (pkgContent.includes('"vue"') || pkgContent.includes("'vue'")) {
          const vueVer = pkgContent.match(/"vue":\s*"[\^~]?(\d+)/);
          stackParts.push(vueVer ? `Vue.js v${vueVer[1]}` : "Vue.js");
        }
        const alpineVer = pkgContent.match(/"alpinejs":\s*"[\^~]?(\d+)/);
        if (alpineVer)
          stackParts.push(
            `Alpine.js v${alpineVer[1]} (⚠ v2 vs v3 API differs!)`,
          );
        if (pkgContent.includes('"htmx') || pkgContent.includes("'htmx"))
          stackParts.push("HTMX");
        if (pkgContent.includes('"tailwindcss"'))
          stackParts.push("Tailwind CSS");
        if (pkgContent.includes('"bootstrap"')) stackParts.push("Bootstrap");
      }

      // Django / Python detection (manage.py or requirements.txt)
      const hasDjango =
        (await fileExists(path.join(cwd, "manage.py"))) ||
        (
          (await tryRead(path.join(cwd, "requirements.txt"), 50)) || ""
        ).includes("Django");
      if (hasDjango) stackParts.push("Django (server-rendered templates)");

      // Alpine.js / HTMX via CDN (not in package.json)
      if (!stackParts.some((s) => s.includes("Alpine"))) {
        const alpineCdn = await grepForPattern("alpinejs", "*.html");
        if (alpineCdn.length > 0) {
          // Try to detect version from CDN URL
          const sampleContent = (await tryRead(alpineCdn[0], 30)) || "";
          const v = sampleContent.match(/alpinejs[@/]v?(\d)/);
          stackParts.push(
            v
              ? `Alpine.js v${v[1]} (via CDN — ⚠ v2 vs v3 API differs!)`
              : "Alpine.js (via CDN — check version!)",
          );
        }
      }
      if (!stackParts.some((s) => s.includes("HTMX"))) {
        const htmxCdn = await grepForPattern("htmx", "*.html");
        if (htmxCdn.length > 0) stackParts.push("HTMX (via CDN)");
      }

      if (stackParts.length > 0) {
        sections.push(stackParts.map((s) => `- ${s}`).join("\n"));
        sections.push(
          "\n⚠ Use ONLY the frameworks listed above. Do NOT mix (e.g. no fetch() when HTMX is used for the same action).",
        );
      } else {
        sections.push(
          "(framework not detected — check package.json or script tags manually)",
        );
      }

      sections.push(
        "\n---\n✅ Design recon complete. Now build consistently with the patterns above.",
      );
      return sections.join("\n");
    }

    // ─── Sysadmin Tool ────────────────────────────────────────
    case "sysadmin": {
      if (!args.action) return "ERROR: action is required";

      const isLocal =
        !args.server || args.server === "local" || args.server === "localhost";
      let sysProfile;
      if (!isLocal) {
        try {
          sysProfile = resolveProfile(args.server);
        } catch (e) {
          return `ERROR: ${e.message}`;
        }
      }

      // Helper: run command locally or via SSH
      const sysRun = async (cmd, timeout = 30000) => {
        if (isLocal) {
          try {
            const { stdout, stderr } = await exec(cmd, { timeout });
            return { out: (stdout || stderr || "").trim(), exitCode: 0 };
          } catch (e) {
            return {
              out: (e.stderr || e.message || "").toString().trim(),
              exitCode: e.code || 1,
            };
          }
        } else {
          const { stdout, stderr, exitCode, error } = await sshExec(
            sysProfile,
            cmd,
            { timeout },
          );
          const out = [stdout, stderr].filter(Boolean).join("\n").trim();
          // Only prepend the SSH error when stdout is empty — if stdout has content,
          // the command produced useful output despite a non-zero exit (e.g. openssl
          // s_client pipeline in ssl_check exits 1 even when cert data was extracted).
          // Prepending the full SSH error+script in that case floods the tool result
          // with multi-KB noise and causes the script to appear twice in context.
          return {
            out:
              error && exitCode !== 0 && !stdout.trim()
                ? (error + "\n" + out).trim()
                : out,
            exitCode,
          };
        }
      };

      const READ_ONLY_ACTIONS = [
        "audit",
        "disk_usage",
        "process_list",
        "network_status",
        "ssl_check",
        "log_tail",
        "find_large",
        "journalctl",
      ];
      const isReadOnly =
        READ_ONLY_ACTIONS.includes(args.action) ||
        (args.action === "package" && args.package_action === "list") ||
        (args.action === "user_manage" &&
          ["list", "info"].includes(args.user_action)) ||
        (args.action === "firewall" && args.firewall_action === "status") ||
        (args.action === "cron" && args.cron_action === "list") ||
        (args.action === "service" &&
          ["status", "list_failed"].includes(args.service_action));

      if (!isReadOnly && !options.autoConfirm) {
        const target = isLocal ? "local" : args.server;
        const ok = await confirm(
          `sysadmin [${args.action}] on ${target} — proceed?`,
        );
        if (!ok) return "Cancelled.";
      }

      switch (args.action) {
        case "audit": {
          const cmd = [
            "echo '=== OS / KERNEL ==='",
            "cat /etc/os-release 2>/dev/null | grep -E '^(NAME|VERSION)=' || uname -a",
            "echo '=== UPTIME / LOAD ==='",
            "uptime",
            "echo '=== MEMORY / SWAP ==='",
            "free -h",
            "echo '=== DISK ==='",
            "df -h --output=target,size,used,avail,pcent 2>/dev/null || df -h",
            "echo '=== TOP 10 PROCESSES (CPU) ==='",
            "ps aux --sort=-%cpu | head -11",
            "echo '=== FAILED SYSTEMD UNITS ==='",
            "systemctl list-units --state=failed --no-legend 2>/dev/null || echo '(systemctl not available)'",
            "echo '=== RECENT ERRORS (journalctl) ==='",
            "journalctl -p err --no-pager -n 15 2>/dev/null || echo '(journalctl not available)'",
            "echo '=== LISTENING PORTS ==='",
            "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo '(ss/netstat not available)'",
          ].join(" && ");
          const { out, exitCode } = await sysRun(cmd, 45000);
          return out || `EXIT ${exitCode}\n(no output)`;
        }

        case "disk_usage": {
          const p = args.path || "/";
          // Use --max-depth=1 via du -d1 for safety on large filesystems; -x to stay on same fs
          const cmd = `df -h ${p}; echo '--- Top subdirs ---'; du -d1 -x -h ${p} 2>/dev/null | sort -rh | head -20`;
          const { out, exitCode } = await sysRun(cmd, 30000);
          return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
        }

        case "process_list": {
          const sortCol = args.sort_by === "mem" ? "4" : "3"; // ps aux col 3=CPU%, 4=MEM%
          const limit = (args.limit || 20) + 1;
          // Try GNU ps --sort first (Linux), fall back to awk sort (BSD/BusyBox)
          const cmd = `ps aux --sort=-${args.sort_by === "mem" ? "%mem" : "%cpu"} 2>/dev/null | head -${limit} || ps aux | awk 'NR==1{print; next} {print | "sort -k${sortCol} -rn"}' | head -${limit}`;
          const { out, exitCode } = await sysRun(cmd, 15000);
          return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
        }

        case "network_status": {
          const cmd = `ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null; echo '--- Active connections ---'; ss -tnp 2>/dev/null | head -30`;
          const { out, exitCode } = await sysRun(cmd, 15000);
          return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
        }

        case "package": {
          if (!args.package_action)
            return "ERROR: package_action is required for action=package";
          const { out: pmOut } = await sysRun(
            "which dnf 2>/dev/null && echo dnf || (which apt-get 2>/dev/null && echo apt) || echo unknown",
            10000,
          );
          const pm = pmOut.includes("dnf")
            ? "dnf"
            : pmOut.includes("apt")
              ? "apt"
              : null;
          if (!pm) return "ERROR: No supported package manager found (dnf/apt)";
          const pkgList = (args.packages || []).join(" ");
          let pkgCmd;
          switch (args.package_action) {
            case "list":
              pkgCmd =
                pm === "dnf"
                  ? "dnf list installed 2>/dev/null | head -60"
                  : "dpkg -l | head -60";
              break;
            case "check": {
              // dnf check-update exits 100 (updates available), 0 (up to date), or other on error.
              // apt-get -s upgrade exits 0 always; we parse output for "upgraded" count.
              const checkCmd =
                pm === "dnf"
                  ? 'dnf check-update 2>/dev/null; EC=$?; [ $EC -eq 100 ] && echo "EXIT_STATUS: updates_available" || ([ $EC -eq 0 ] && echo "EXIT_STATUS: up_to_date" || echo "EXIT_STATUS: error $EC")'
                  : "apt-get -s upgrade 2>/dev/null | tail -5";
              const { out: checkOut } = await sysRun(checkCmd, 60000);
              return checkOut || "(no output from package check)";
            }
            case "install":
              if (!pkgList) return "ERROR: packages required for install";
              pkgCmd =
                pm === "dnf"
                  ? `dnf install -y ${pkgList}`
                  : `apt-get install -y ${pkgList}`;
              break;
            case "remove":
              if (!pkgList) return "ERROR: packages required for remove";
              pkgCmd =
                pm === "dnf"
                  ? `dnf remove -y ${pkgList}`
                  : `apt-get remove -y ${pkgList}`;
              break;
            case "update":
              if (!pkgList)
                return "ERROR: packages required for update (use upgrade for full system upgrade)";
              pkgCmd =
                pm === "dnf"
                  ? `dnf update -y ${pkgList}`
                  : `apt-get install -y --only-upgrade ${pkgList}`;
              break;
            case "upgrade":
              pkgCmd =
                pm === "dnf"
                  ? "dnf upgrade -y"
                  : "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y";
              break;
            default:
              return `ERROR: Unknown package_action: ${args.package_action}`;
          }
          const { out, exitCode } = await sysRun(pkgCmd, 120000);
          return exitCode !== 0
            ? `EXIT ${exitCode}\n${out}`
            : out || `${args.package_action} OK`;
        }

        case "user_manage": {
          if (!args.user_action)
            return "ERROR: user_action is required for action=user_manage";
          switch (args.user_action) {
            case "list": {
              const cmd =
                'awk -F: \'$3 >= 1000 && $1 != "nobody" {print $1, "uid="$3, "gid="$4, "shell="$7}\' /etc/passwd';
              const { out, exitCode } = await sysRun(cmd, 10000);
              return exitCode !== 0
                ? `EXIT ${exitCode}\n${out}`
                : out || "(no regular users)";
            }
            case "info": {
              if (!args.user)
                return "ERROR: user is required for user_action=info";
              const cmd = `id ${args.user} && echo '--- Groups ---' && groups ${args.user} && echo '--- Last login ---' && lastlog -u ${args.user} 2>/dev/null`;
              const { out, exitCode } = await sysRun(cmd, 10000);
              return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
            }
            case "create": {
              if (!args.user)
                return "ERROR: user is required for user_action=create";
              const groupFlags = (args.groups || [])
                .map((g) => `-G ${g}`)
                .join(" ");
              const cmd = `useradd -m ${groupFlags} ${args.user} && echo "User ${args.user} created"`;
              const { out, exitCode } = await sysRun(cmd, 15000);
              return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
            }
            case "delete": {
              if (!args.user)
                return "ERROR: user is required for user_action=delete";
              const cmd = `userdel -r ${args.user} && echo "User ${args.user} deleted"`;
              const { out, exitCode } = await sysRun(cmd, 15000);
              return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
            }
            case "add_ssh_key": {
              if (!args.user)
                return "ERROR: user is required for user_action=add_ssh_key";
              if (!args.ssh_key)
                return "ERROR: ssh_key is required for user_action=add_ssh_key";
              const escapedKey = args.ssh_key.replace(/'/g, "'\\''");
              const cmd = `mkdir -p /home/${args.user}/.ssh && chmod 700 /home/${args.user}/.ssh && echo '${escapedKey}' >> /home/${args.user}/.ssh/authorized_keys && chmod 600 /home/${args.user}/.ssh/authorized_keys && chown -R ${args.user}:${args.user} /home/${args.user}/.ssh && echo "SSH key added for ${args.user}"`;
              const { out, exitCode } = await sysRun(cmd, 15000);
              return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
            }
            default:
              return `ERROR: Unknown user_action: ${args.user_action}`;
          }
        }

        case "firewall": {
          if (!args.firewall_action)
            return "ERROR: firewall_action is required for action=firewall";
          const { out: fwDetect } = await sysRun(
            "which firewall-cmd 2>/dev/null && echo firewalld || (which ufw 2>/dev/null && echo ufw) || echo iptables",
            10000,
          );
          const fw = fwDetect.includes("firewalld")
            ? "firewalld"
            : fwDetect.includes("ufw")
              ? "ufw"
              : "iptables";
          let fwCmd;
          switch (args.firewall_action) {
            case "status":
              fwCmd =
                fw === "firewalld"
                  ? "firewall-cmd --state && firewall-cmd --list-all"
                  : fw === "ufw"
                    ? "ufw status verbose"
                    : "iptables -L -n --line-numbers | head -60";
              break;
            case "allow":
              if (!args.port)
                return 'ERROR: port is required for firewall allow (e.g. "80/tcp")';
              fwCmd =
                fw === "firewalld"
                  ? `firewall-cmd --permanent --add-port=${args.port} && firewall-cmd --reload`
                  : fw === "ufw"
                    ? `ufw allow ${args.port}`
                    : `iptables -A INPUT -p ${args.port.includes("/") ? args.port.split("/")[1] : "tcp"} --dport ${args.port.split("/")[0]} -j ACCEPT`;
              break;
            case "deny":
              if (!args.port)
                return "ERROR: port is required for firewall deny";
              fwCmd =
                fw === "firewalld"
                  ? `firewall-cmd --permanent --remove-port=${args.port} && firewall-cmd --reload`
                  : fw === "ufw"
                    ? `ufw deny ${args.port}`
                    : `iptables -A INPUT -p ${args.port.includes("/") ? args.port.split("/")[1] : "tcp"} --dport ${args.port.split("/")[0]} -j DROP`;
              break;
            case "remove":
              if (!args.port)
                return "ERROR: port is required for firewall remove";
              fwCmd =
                fw === "firewalld"
                  ? `firewall-cmd --permanent --remove-port=${args.port} && firewall-cmd --reload`
                  : fw === "ufw"
                    ? `ufw delete allow ${args.port}`
                    : `iptables -D INPUT -p ${args.port.includes("/") ? args.port.split("/")[1] : "tcp"} --dport ${args.port.split("/")[0]} -j ACCEPT 2>/dev/null || true`;
              break;
            case "reload":
              fwCmd =
                fw === "firewalld"
                  ? "firewall-cmd --reload"
                  : fw === "ufw"
                    ? "ufw reload"
                    : 'iptables-restore < /etc/iptables/rules.v4 2>/dev/null || echo "iptables: manual reload not available"';
              break;
            default:
              return `ERROR: Unknown firewall_action: ${args.firewall_action}`;
          }
          const { out, exitCode } = await sysRun(fwCmd, 30000);
          return exitCode !== 0
            ? `EXIT ${exitCode}\n${out}`
            : out || `firewall ${args.firewall_action} OK`;
        }

        case "cron": {
          if (!args.cron_action)
            return "ERROR: cron_action is required for action=cron";
          const cronFlag = args.user ? `-u ${args.user}` : "";
          switch (args.cron_action) {
            case "list": {
              const cmd = `crontab ${cronFlag} -l 2>/dev/null || echo '(no crontab for ${args.user || "current user"})'`;
              const { out } = await sysRun(cmd, 10000);
              return out || "(empty crontab)";
            }
            case "add": {
              if (!args.schedule)
                return "ERROR: schedule is required for cron add";
              if (!args.command)
                return "ERROR: command is required for cron add";
              const entry = `${args.schedule} ${args.command}`;
              const cmd = `(crontab ${cronFlag} -l 2>/dev/null; echo "${entry}") | crontab ${cronFlag} - && echo "Cron entry added: ${entry}"`;
              const { out, exitCode } = await sysRun(cmd, 15000);
              return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
            }
            case "remove": {
              if (!args.command)
                return "ERROR: command (substring to match) is required for cron remove";
              const escaped = args.command.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&",
              );
              const cmd = `crontab ${cronFlag} -l 2>/dev/null | grep -v "${escaped}" | crontab ${cronFlag} - && echo "Matching cron entries removed"`;
              const { out, exitCode } = await sysRun(cmd, 15000);
              return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
            }
            default:
              return `ERROR: Unknown cron_action: ${args.cron_action}`;
          }
        }

        case "ssl_check": {
          if (!args.domain && !args.cert_path)
            return "ERROR: domain or cert_path is required for ssl_check";
          // Build a script that: 1) reads the cert (file or live TLS), 2) extracts dates, 3) calculates days remaining
          let sslCmd;
          if (args.cert_path) {
            sslCmd = `
CERT="${args.cert_path}"
openssl x509 -in "$CERT" -noout -subject -issuer -startdate -enddate -ext subjectAltName 2>&1 && \
EXPIRY=$(openssl x509 -in "$CERT" -noout -enddate 2>/dev/null | cut -d= -f2) && \
DAYS=$(( ( $(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null) - $(date +%s) ) / 86400 )) && \
echo "Days until expiry: $DAYS"
`.trim();
          } else {
            const domain = args.domain;
            // 1st try: read cert directly from Let's Encrypt path on server
            // 2nd try: live TLS probe via openssl s_client
            sslCmd = `
DOMAIN="${domain}"
LECP="/etc/letsencrypt/live/$DOMAIN/cert.pem"
if [ -f "$LECP" ]; then
  echo "Source: Let's Encrypt $LECP"
  openssl x509 -in "$LECP" -noout -subject -issuer -startdate -enddate -ext subjectAltName 2>&1
  EXPIRY=$(openssl x509 -in "$LECP" -noout -enddate 2>/dev/null | cut -d= -f2)
else
  echo "Source: live TLS probe"
  CERT=$(echo | openssl s_client -connect "$DOMAIN":443 -servername "$DOMAIN" 2>/dev/null)
  if [ -z "$CERT" ]; then echo "ERROR: Could not connect to $DOMAIN:443 (port closed or DNS unresolvable)"; exit 1; fi
  echo "$CERT" | openssl x509 -noout -subject -issuer -startdate -enddate -ext subjectAltName 2>&1
  EXPIRY=$(echo "$CERT" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
fi
if [ -n "$EXPIRY" ]; then
  DAYS=$(( ( $(date -d "$EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$EXPIRY" +%s 2>/dev/null) - $(date +%s) ) / 86400 ))
  echo "Days until expiry: $DAYS"
  [ "$DAYS" -lt 14 ] && echo "WARNING: Certificate expires in less than 14 days!"
  [ "$DAYS" -lt 0 ] && echo "CRITICAL: Certificate has EXPIRED!"
fi
`.trim();
          }
          const { out, exitCode } = await sysRun(sslCmd, 25000);
          // openssl s_client pipelines often exit non-zero even when cert data was
          // successfully extracted (e.g. the pipe to openssl x509 exits 1 because
          // s_client wrote extra text).  If the output contains actual cert fields
          // (notAfter= or "Days until expiry:") treat it as success regardless.
          const hasCertData = /notAfter=|Days until expiry:/i.test(out);
          return exitCode !== 0 && !hasCertData
            ? `EXIT ${exitCode}\n${out}`
            : out || "(no cert info returned)";
        }

        case "log_tail": {
          if (!args.path) return "ERROR: path is required for log_tail";
          const lines = args.lines || 100;
          const cmd = `tail -n ${lines} ${args.path} 2>&1`;
          const { out, exitCode } = await sysRun(cmd, 15000);
          return exitCode !== 0
            ? `EXIT ${exitCode}\n${out}`
            : out || "(empty log)";
        }

        case "find_large": {
          const p = args.path || "/";
          const limit = args.limit || 20;
          const minSize = args.min_size || "100M";
          const cmd = `find ${p} -xdev -type f -size +${minSize} 2>/dev/null | xargs du -sh 2>/dev/null | sort -rh | head -${limit}`;
          const { out, exitCode } = await sysRun(cmd, 60000);
          return exitCode !== 0
            ? `EXIT ${exitCode}\n${out}`
            : out || `(no files larger than ${minSize} in ${p})`;
        }

        case "service": {
          if (!args.service_action)
            return "ERROR: service_action is required for action=service";
          if (args.service_action !== "list_failed" && !args.service_name)
            return "ERROR: service_name is required (except for list_failed)";
          const unit = args.service_name
            ? args.service_name.includes(".")
              ? args.service_name
              : `${args.service_name}.service`
            : "";
          let svcCmd;
          switch (args.service_action) {
            case "status":
              svcCmd = `systemctl status ${unit} --no-pager -l 2>&1 | head -40`;
              break;
            case "list_failed":
              svcCmd =
                "systemctl list-units --state=failed --no-legend 2>/dev/null";
              break;
            case "start":
              svcCmd = `systemctl start ${unit} && systemctl status ${unit} --no-pager -l 2>&1 | head -20`;
              break;
            case "stop":
              svcCmd = `systemctl stop ${unit} && echo "${unit} stopped"`;
              break;
            case "restart":
              svcCmd = `systemctl restart ${unit} && systemctl status ${unit} --no-pager -l 2>&1 | head -20`;
              break;
            case "reload":
              svcCmd = `systemctl reload ${unit} 2>&1 || systemctl reload-or-restart ${unit} 2>&1`;
              break;
            case "enable":
              svcCmd = `systemctl enable ${unit} && echo "${unit} enabled"`;
              break;
            case "disable":
              svcCmd = `systemctl disable ${unit} && echo "${unit} disabled"`;
              break;
            default:
              return `ERROR: Unknown service_action: ${args.service_action}`;
          }
          const { out, exitCode } = await sysRun(svcCmd, 30000);
          // systemctl status exits 3 for inactive/dead units and 4 for "not found" —
          // exit 3 is still useful output (the status block), not a tool error.
          // exit 4 means the unit genuinely doesn't exist.
          const svcIsOk =
            exitCode === 0 ||
            (args.service_action === "status" && exitCode === 3);
          return !svcIsOk
            ? `EXIT ${exitCode}\n${out}`
            : out || `service ${args.service_action} OK`;
        }

        case "kill_process": {
          if (!args.pid && !args.process_name)
            return "ERROR: pid or process_name is required for kill_process";
          const sig = args.signal || "SIGTERM";
          let killCmd;
          if (args.pid) {
            // Kill by PID — show process info first for context
            killCmd = `ps -p ${args.pid} -o pid,user,%cpu,%mem,etime,cmd 2>/dev/null && kill -${sig} ${args.pid} && echo "Sent ${sig} to PID ${args.pid}"`;
          } else {
            // Kill by name via pkill
            killCmd = `pgrep -a "${args.process_name}" 2>/dev/null | head -5 && pkill -${sig} "${args.process_name}" && echo "Sent ${sig} to all '${args.process_name}' processes"`;
          }
          const { out, exitCode } = await sysRun(killCmd, 15000);
          return exitCode !== 0 ? `EXIT ${exitCode}\n${out}` : out;
        }

        case "journalctl": {
          const lines = args.lines || 100;
          const parts = ["journalctl", "--no-pager", "-n", String(lines)];
          if (args.unit)
            parts.push(
              "-u",
              args.unit.includes(".") ? args.unit : `${args.unit}.service`,
            );
          if (args.priority) parts.push("-p", args.priority);
          if (args.since) parts.push(`--since="${args.since}"`);
          parts.push('2>/dev/null || echo "(journalctl not available)"');
          const { out, exitCode } = await sysRun(parts.join(" "), 20000);
          return exitCode !== 0
            ? `EXIT ${exitCode}\n${out}`
            : out || "(no log entries)";
        }

        default:
          return `ERROR: Unknown sysadmin action: ${args.action}`;
      }
    }

    case "save_memory": {
      const { saveMemory } = require("../memory");
      const result = saveMemory(args.type, args.name, args.content, args.description);
      if (result.ok) {
        return result.updated === false
          ? `Memory unchanged (duplicate): ${args.type}/${args.name}`
          : `Memory saved: ${args.type}/${args.name} → ${result.path}`;
      }
      return `ERROR: ${result.error}`;
    }

    case "delete_memory": {
      const { deleteMemory } = require("../memory");
      const deleted = deleteMemory(args.type, args.name);
      return deleted
        ? `Memory deleted: ${args.type}/${args.name}`
        : `Memory not found: ${args.type}/${args.name}`;
    }

    default: {
      // Check if it's a plugin tool
      const { executePluginTool } = require("../plugins");
      const pluginResult = await executePluginTool(name, args, options);
      if (pluginResult !== null) return pluginResult;

      return `ERROR: Unknown tool: ${name}`;
    }
  }
}

// ─── Spinner Wrapper ──────────────────────────────────────────
async function executeTool(name, args, options = {}) {
  const { emit } = require("../plugins");
  const { logToolExecution } = require("../audit");
  const startTime = Date.now();
  const spinnerText = options.silent ? null : getToolSpinnerText(name, args);
  if (!spinnerText) {
    const result = await _executeToolInner(name, args, options);
    logToolExecution({
      tool: name,
      args,
      result,
      duration: Date.now() - startTime,
      success: !result.startsWith?.("ERROR"),
    });
    await emit("onToolResult", { tool: name, args, result });
    return result;
  }

  const spinner = new Spinner(spinnerText);
  spinner.start();
  try {
    const result = await _executeToolInner(name, args, options);
    spinner.stop();
    logToolExecution({
      tool: name,
      args,
      result,
      duration: Date.now() - startTime,
      success: !result.startsWith?.("ERROR"),
    });
    await emit("onToolResult", { tool: name, args, result });
    return result;
  } catch (err) {
    spinner.stop();
    logToolExecution({
      tool: name,
      args,
      result: err.message,
      duration: Date.now() - startTime,
      success: false,
    });
    throw err;
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  executeTool,
  resolvePath,
  autoFixPath,
  autoFixEdit,
  enrichBashError,
  cancelPendingAskUser,
  setAskUserHandler,
  fileExists,
};

/**
 * cli/tools.js — Tool Definitions + Implementations
 */

const fs = require('fs').promises;
const fsSync = require('fs'); // Keep sync version for binary check and simple checks if needed
const path = require('path');
const exec = require('util').promisify(require('child_process').exec);
const execFile = require('util').promisify(require('child_process').execFile);
const { spawnSync } = require('child_process');
const axios = require('axios');
const { isForbidden, isDangerous, isCritical, confirm } = require('./safety');
const { showClaudeDiff, showClaudeNewFile, showEditDiff, confirmFileChange } = require('./diff');
const { C, Spinner, getToolSpinnerText } = require('./ui');
const { isGitRepo, getCurrentBranch, getStatus, getDiff } = require('./git');
const { recordChange } = require('./file-history');
const { fuzzyFindText, findMostSimilar } = require('./fuzzy-match');
const { runDiagnostics } = require('./diagnostics');
const { findFileInIndex, getFileIndex } = require('./index-engine');
const { resolveProfile, sshExec, scpUpload, scpDownload } = require('./ssh');
const { resolveDeployConfig, loadDeployConfigs } = require('./deploy-config');

// Use process.cwd() dynamically to support tests mocking it

// ─── Interactive Command Detection ────────────────────────────
// Commands that require a PTY / raw terminal (spawned with stdio:inherit)
const INTERACTIVE_CMDS = /^(vim?|nano|emacs|pico|less|more|top|htop|iftop|iotop|glances|telnet\s|screen|tmux|fzf|gum|dialog|whiptail|man\s|node\s*$|python3?\s*$|irb\s*$|rails\s*c|psql\s|mysql\s|redis-cli|mongosh?|sqlite3)\b/;
// SSH is interactive only when logging in without a remote command.
// `ssh host "cmd"` / `ssh host cmd` are non-interactive — output must be captured.
const SSH_INTERACTIVE_RE = /^ssh\s/;
const SSH_HAS_REMOTE_CMD_RE = /^ssh(?:\s+-\S+)*\s+\S+@?\S+\s+["']?[^-]/;

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
  if (!originalPath) return { fixedPath: null, message: '' };

  // Strategy 1: normalize path issues
  let normalized = originalPath
    .replace(/\/+/g, '/')           // double slashes
    .replace(/^~\//, `${require('os').homedir()}/`); // expand ~
  const np = resolvePath(normalized);
  if (np && (await fs.access(np).then(() => true).catch(() => false))) {
    return { fixedPath: np, message: `(auto-fixed path: ${originalPath} → ${normalized})` };
  }

  // Strategy 2: try with/without extensions
  const extVariants = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json'];
  const hasExt = path.extname(originalPath);
  if (!hasExt) {
    for (const ext of extVariants) {
      const withExt = resolvePath(originalPath + ext);
      if (withExt && (await fs.access(withExt).then(() => true).catch(() => false))) {
        return { fixedPath: withExt, message: `(auto-fixed: added ${ext} extension)` };
      }
    }
  }
  // Try stripping extension and trying others
  if (hasExt) {
    const base = originalPath.replace(/\.[^.]+$/, '');
    for (const ext of extVariants) {
      if (ext === hasExt) continue;
      const alt = resolvePath(base + ext);
      if (alt && (await fs.access(alt).then(() => true).catch(() => false))) {
        return { fixedPath: alt, message: `(auto-fixed: ${hasExt} → ${ext})` };
      }
    }
  }

  // Strategy 3: search for basename in index
  const basename = path.basename(originalPath);
  if (basename && basename.length > 2) {
    try {
      const found = findFileInIndex(basename).map(f => resolvePath(f));
      if (found.length === 1) {
        return { fixedPath: found[0], message: `(auto-fixed: found ${basename} at ${path.relative(process.cwd(), found[0])})` };
      }
      if (found.length > 1 && found.length <= 5) {
        const relative = found.map(f => path.relative(process.cwd(), f));
        return { fixedPath: null, message: `File not found. Did you mean one of:\n${relative.map(r => `  - ${r}`).join('\n')}` };
      }
    } catch { /* index search failed, skip */ }
  }

  return { fixedPath: null, message: '' };
}

/**
 * Return a recovery hint when a command is blocked, suggesting safe alternatives.
 * @param {string} cmd
 * @returns {string}
 */
function getBlockedHint(cmd) {
  if (/\bprintenv\b/.test(cmd)) {
    return 'printenv exposes all secrets. Use `echo $VAR_NAME` for a single variable, or `env | grep PATTERN` for filtered output.';
  }
  if (/cat\s+.*\.env\b/.test(cmd)) {
    return 'Reading .env directly is blocked. Use `grep -v "KEY=" .env` to inspect non-secret entries, or ask the user to share specific values.';
  }
  if (/cat\s+.*credentials/i.test(cmd)) {
    return 'Credentials files are blocked. Reference the variable name from the application config instead.';
  }
  if (/python3?\s+-c\s/.test(cmd)) {
    return 'Inline python -c is blocked. Write a temporary script file and run it with `python3 script.py` instead.';
  }
  if (/node\s+-e\s/.test(cmd)) {
    return 'Inline node -e is blocked. Write a temporary script file and run it with `node script.js` instead.';
  }
  if (/curl.*-X\s*POST|curl.*--data/.test(cmd)) {
    return 'curl POST is blocked to prevent data exfiltration. Use the application\'s own API client or ask the user to run the request.';
  }
  if (/base64.*\|.*bash/.test(cmd)) {
    return 'Piping base64-decoded content to bash is blocked. Decode the content first, inspect it, then run explicitly.';
  }
  if (/\beval\s*\(/.test(cmd)) {
    return 'eval is blocked. Execute the command directly without eval.';
  }
  if (/(?:^|[;&|]\s*)history(?:\s|$)/.test(cmd)) {
    return 'Shell history is blocked. Look at git log or project files for context instead.';
  }
  return '';
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
  if (/command not found|not recognized/i.test(errorOutput)) {
    const cmdMatch = command.match(/^(\S+)/);
    const cmd = cmdMatch ? cmdMatch[1] : '';
    if (/^(npx|npm|node|yarn|pnpm|bun)$/.test(cmd)) {
      hints.push('HINT: Node.js/npm may not be in PATH. Check your Node.js installation.');
    } else if (/^(python|python3|pip|pip3)$/.test(cmd)) {
      hints.push('HINT: Python may not be installed. Try: brew install python3 (macOS) or apt install python3 (Linux)');
    } else {
      hints.push(`HINT: "${cmd}" is not installed. Try installing it with your package manager.`);
    }
  }

  // Module not found (Node.js)
  if (/Cannot find module|MODULE_NOT_FOUND/i.test(errorOutput)) {
    const modMatch = errorOutput.match(/Cannot find module '([^']+)'/);
    const mod = modMatch ? modMatch[1] : '';
    if (mod && !mod.startsWith('.') && !mod.startsWith('/')) {
      hints.push(`HINT: Missing npm package "${mod}". Run: npm install ${mod}`);
    } else {
      hints.push('HINT: Module not found. Check the import path or run npm install.');
    }
  }

  // Permission denied
  if (/permission denied|EACCES/i.test(errorOutput)) {
    hints.push('HINT: Permission denied. Check file permissions or try a different approach.');
  }

  // Port already in use
  if (/EADDRINUSE|address already in use/i.test(errorOutput)) {
    const portMatch = errorOutput.match(/port (\d+)|:(\d+)/);
    const port = portMatch ? (portMatch[1] || portMatch[2]) : '';
    hints.push(`HINT: Port ${port || ''} is already in use. Kill the process or use a different port.`);
  }

  // Syntax error
  if (/SyntaxError|Unexpected token/i.test(errorOutput)) {
    hints.push('HINT: Syntax error in the code. Check the file at the line number shown above.');
  }

  // TypeScript errors
  if (/TS\d{4}:/i.test(errorOutput)) {
    hints.push('HINT: TypeScript compilation error. Fix the type issue at the indicated line.');
  }

  // Jest/test failures
  if (/Test Suites:.*failed|Tests:.*failed/i.test(errorOutput)) {
    hints.push('HINT: Test failures detected. Read the error output above to identify failing tests.');
  }

  // Git errors
  if (/fatal: not a git repository/i.test(errorOutput)) {
    hints.push('HINT: Not inside a git repository. Run git init or cd to a git project.');
  }

  // curl exit codes
  if (/^curl\b/.test(command)) {
    const exitMatch = errorOutput.match(/curl:\s*\((\d+)\)/);
    const curlCode = exitMatch ? parseInt(exitMatch[1], 10) : null;
    if (curlCode === 6 || /Could not resolve host/i.test(errorOutput)) {
      hints.push('HINT: Hostname could not be resolved. Check DNS or use an IP address directly.');
    } else if (curlCode === 7 || /Failed to connect|Connection refused/i.test(errorOutput)) {
      hints.push('HINT: Service not running or port wrong. Check if the service is up and the port is correct.');
    } else if (curlCode === 22 || /HTTP error/i.test(errorOutput)) {
      hints.push('HINT: HTTP 4xx/5xx response. The endpoint exists but returned an error status.');
    } else if (curlCode === 28 || /timed out/i.test(errorOutput)) {
      hints.push('HINT: Request timed out. The host may be unreachable or the service is slow.');
    } else if (curlCode === 35 || /SSL.*error/i.test(errorOutput)) {
      hints.push('HINT: SSL/TLS handshake failed. Try with --insecure to bypass, or check the certificate.');
    }
  }

  // SSH tunnel errors
  if (/remote port forwarding failed/i.test(errorOutput)) {
    const portMatch = errorOutput.match(/port (\d+)/);
    const port = portMatch ? portMatch[1] : '';
    hints.push(`HINT: SSH remote port forwarding failed for port ${port}. The port may already be bound on the server. ` +
      `Check with: ssh server "ss -tuln | grep ${port}" and kill any lingering process with that port.`);
  }
  if (/bind.*Cannot assign requested address|Address already in use/i.test(errorOutput)) {
    hints.push('HINT: Port is already in use. Find the process with: ss -tuln | grep <port> and kill it, then retry.');
  }
  if (/Connection.*timed out|ssh.*timeout/i.test(errorOutput) && /^ssh\b/.test(command)) {
    hints.push('HINT: SSH connection timed out. Check if the host is reachable: ping <host> and verify the port with: nc -zv <host> 22');
  }

  if (hints.length === 0) return errorOutput;
  return errorOutput + '\n\n' + hints.join('\n');
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
function setAskUserHandler(fn) { _askUserFn = fn; }
async function ensureCheckpoint() {
  if (_checkpointCreated) return;
  _checkpointCreated = true;
  try {
    // Only in git repos with changes
    const { stdout } = await exec('git rev-parse --is-inside-work-tree', { cwd: process.cwd(), timeout: 5000 });
    const isGit = stdout.trim() === 'true';
    if (!isGit) return;
    await exec('git stash push -m "nex-code-checkpoint" --include-untracked', { cwd: process.cwd(), timeout: 10000 });
    await exec('git stash pop', { cwd: process.cwd(), timeout: 10000 });
    await exec('git tag -f nex-checkpoint', { cwd: process.cwd(), timeout: 5000 });
  } catch { /* not critical */ }
}

// Sensitive paths that should never be accessed by file tools
const SENSITIVE_PATHS = [
  /\.ssh\//i, /\.gnupg\//i, /\.aws\//i, /\.config\/gcloud/i,
  /\/etc\/shadow/, /\/etc\/passwd/, /\/etc\/sudoers/,
  /\.env(?:\.|$)/, /credentials/i, /\.npmrc$/,
  /\.docker\/config\.json/, /\.kube\/config/,
];

function resolvePath(p) {
  const resolved = path.isAbsolute(p) ? path.resolve(p) : path.resolve(process.cwd(), p);
  // Block access to sensitive paths
  for (const pat of SENSITIVE_PATHS) {
    if (pat.test(resolved)) return null;
  }
  return resolved;
}

// ─── Tool Definitions (Ollama format) ─────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description:
        'Execute a bash command in the project directory. Timeout: 90s. Use for: running tests, installing packages, git commands, build tools, starting servers. Do NOT use bash for file operations when a dedicated tool exists — use read_file instead of cat, edit_file instead of sed, glob instead of find, grep instead of grep/rg. Always quote paths with spaces. Prefer specific commands over rm -rf. Destructive or dangerous commands require user confirmation.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'The bash command to execute' } },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: "Read a file's contents with line numbers. Always read a file BEFORE editing it to see exact content. Use line_start/line_end for large files to read specific sections. Prefer this over bash cat/head/tail. Files are read with UTF-8 encoding. For binary files, use bash with appropriate flags. Alternative: use util.promisify(fs.readFile) for programmatic access.",
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative or absolute)' },
          line_start: { type: 'number', description: 'Start line (1-based, optional)' },
          line_end: { type: 'number', description: 'End line (1-based, optional)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file. For targeted changes to existing files, prefer edit_file or patch_file instead — they only send the diff and are safer. Only use write_file when creating new files or when the entire content needs to be replaced.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Full file content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace specific text in a file. IMPORTANT: old_text must match the file content EXACTLY — including all whitespace, indentation (tabs vs spaces), and newlines. Always read_file first to see the exact content before editing. If old_text is not found, the edit fails. For multiple changes to the same file, prefer patch_file instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          old_text: { type: 'string', description: 'Exact text to find (must match file content precisely)' },
          new_text: { type: 'string', description: 'Replacement text' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and directories in a tree view. Use this to understand project structure. For finding specific files by pattern, prefer glob instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
          max_depth: { type: 'number', description: 'Max depth (default: 2)' },
          pattern: { type: 'string', description: "File filter glob (e.g. '*.js')" },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for a text pattern across files (regex). Returns matching lines with file paths. For simple content search, grep is equivalent. For finding files by name, use glob instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory to search' },
          pattern: { type: 'string', description: 'Search pattern (regex)' },
          file_pattern: { type: 'string', description: "File filter (e.g. '*.js')" },
        },
        required: ['path', 'pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: "Find files matching a glob pattern. Fast file search by name/extension. Use this to find files before reading them. Examples: '**/*.test.js' (all test files), 'src/**/*.ts' (all TypeScript in src). Prefer this over bash find/ls.",
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: "Glob pattern (e.g. '**/*.ts', 'src/**/*.test.js')" },
          path: { type: 'string', description: 'Base directory (default: project root)' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search file contents with regex. Returns matching lines with file paths and line numbers. Use this to find where functions/variables/classes are defined or used. Prefer this over bash grep/rg.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern to search for' },
          path: { type: 'string', description: 'Directory or file to search (default: project root)' },
          include: { type: 'string', description: "File filter (e.g. '*.js', '*.ts')" },
          ignore_case: { type: 'boolean', description: 'Case-insensitive search' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'patch_file',
      description: 'Apply multiple text replacements to a file atomically. All patches are validated before any are applied — if one fails, none are written. Prefer this over multiple edit_file calls when making several changes to the same file. Like edit_file, all old_text values must match exactly.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          patches: {
            type: 'array',
            description: 'Array of { old_text, new_text } replacements to apply in order',
            items: {
              type: 'object',
              properties: {
                old_text: { type: 'string', description: 'Text to find' },
                new_text: { type: 'string', description: 'Replacement text' },
              },
              required: ['old_text', 'new_text'],
            },
          },
        },
        required: ['path', 'patches'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL and return text. HTML tags are stripped. Use for reading documentation, API responses, or web pages. Will not work with authenticated/private URLs.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          max_length: { type: 'number', description: 'Max response length in chars (default: 10000)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web. Uses Perplexity (grounded, AI-summarized) if PERPLEXITY_API_KEY is set, otherwise DuckDuckGo. Returns titles, URLs, and summaries. Use to find documentation, solutions, or current information beyond your knowledge cutoff.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          max_results: { type: 'number', description: 'Max results (default: 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_open',
      description: 'Open a URL in a headless browser and return the page title, text content, and links. More reliable than web_fetch for JavaScript-heavy pages. Requires playwright (npm install playwright && npx playwright install chromium).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to open' },
          wait_for: { type: 'string', enum: ['domcontentloaded', 'networkidle', 'load'], description: 'When to consider page loaded (default: domcontentloaded)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of a URL in a headless browser. Returns the screenshot file path. The path can be pasted into the next message for visual analysis. Requires playwright.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to screenshot' },
          full_page: { type: 'boolean', description: 'Capture full page (default: false — viewport only)' },
          width: { type: 'number', description: 'Viewport width in px (default: 1280)' },
          height: { type: 'number', description: 'Viewport height in px (default: 800)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element on a web page (by CSS selector or visible text). Returns the new URL after navigation. Requires playwright.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to first' },
          selector: { type: 'string', description: 'CSS selector of element to click (mutually exclusive with text)' },
          text: { type: 'string', description: 'Visible text of element to click (mutually exclusive with selector)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_fill',
      description: 'Fill a form field on a web page and optionally submit. Requires playwright.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to first' },
          selector: { type: 'string', description: 'CSS selector of the input field' },
          value: { type: 'string', description: 'Value to fill in' },
          submit: { type: 'boolean', description: 'Press Enter to submit after filling (default: false)' },
        },
        required: ['url', 'selector', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_user',
      description: "Ask the user a clarifying question with 2-3 specific options. Use when the user's intent is ambiguous. Always provide concrete, actionable options. The user can select an option or type a custom answer.",
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The clarifying question to ask' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: '2-3 specific, actionable answer options for the user to choose from',
            minItems: 1,
            maxItems: 3,
          },
        },
        required: ['question', 'options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Get git status: current branch, changed files, staged/unstaged state. Use before git operations to understand the current state.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Get git diff for changed files. Shows additions and deletions.',
      parameters: {
        type: 'object',
        properties: {
          staged: { type: 'boolean', description: 'Show only staged changes (default: false)' },
          file: { type: 'string', description: 'Diff specific file only (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent git commits (short format).',
      parameters: {
        type: 'object',
        properties: {
          count: { type: 'number', description: 'Number of commits to show (default: 10)' },
          file: { type: 'string', description: 'Show commits for specific file (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_list',
      description: 'Create and manage a task list for complex multi-step tasks. Use for tasks with 3+ steps to track progress. Actions: create (new list with tasks), update (mark task in_progress/done/failed), get (view current list). Always update task status as you work.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'get'], description: 'Action to perform' },
          name: { type: 'string', description: 'Task list name (for create)' },
          tasks: {
            type: 'array',
            description: 'Array of tasks to create (for create)',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string', description: 'Task description' },
                depends_on: { type: 'array', items: { type: 'string' }, description: 'IDs of prerequisite tasks' },
              },
              required: ['description'],
            },
          },
          task_id: { type: 'string', description: 'Task ID to update (for update)' },
          status: { type: 'string', enum: ['in_progress', 'done', 'failed'], description: 'New status (for update)' },
          result: { type: 'string', description: 'Result summary (for update, optional)' },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gh_run_list',
      description: 'List recent GitHub Actions workflow runs for this repository. Shows run status, conclusion, branch, and timing. Use to check CI/CD status or find a run ID.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of runs to show (default: 10, max: 30)' },
          workflow: { type: 'string', description: 'Filter by workflow name or filename (optional)' },
          branch: { type: 'string', description: 'Filter by branch name (optional)' },
          status: { type: 'string', enum: ['completed', 'in_progress', 'queued', 'failure', 'success'], description: 'Filter by status (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gh_run_view',
      description: 'View details of a specific GitHub Actions workflow run: steps, logs, errors. Use gh_run_list first to get the run ID.',
      parameters: {
        type: 'object',
        properties: {
          run_id: { type: 'string', description: 'The run ID (from gh_run_list)' },
          log: { type: 'boolean', description: 'Include full log output (default: false — shows step summary only)' },
        },
        required: ['run_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gh_workflow_trigger',
      description: 'Trigger a GitHub Actions workflow dispatch event. Only works for workflows with workflow_dispatch trigger. Requires user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          workflow: { type: 'string', description: 'Workflow filename (e.g. ci.yml) or name' },
          branch: { type: 'string', description: 'Branch to run on (default: current branch)' },
          inputs: { type: 'object', description: 'Workflow input parameters as key-value pairs (optional)' },
        },
        required: ['workflow'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'spawn_agents',
      description: 'Run multiple independent sub-agents in parallel (max 5). Each agent has its own conversation context. Use when 2+ tasks can run simultaneously — e.g. reading multiple files, analyzing separate modules, independent research. Do NOT use for tasks that depend on each other or modify the same file. Keep task descriptions specific and self-contained.',
      parameters: {
        type: 'object',
        properties: {
          agents: {
            type: 'array',
            description: 'Array of agent definitions to run in parallel (max 5)',
            items: {
              type: 'object',
              properties: {
                task: { type: 'string', description: 'Task description for the agent' },
                context: { type: 'string', description: 'Additional context (optional)' },
                max_iterations: { type: 'number', description: 'Max iterations (default: 10, max: 15)' },
                model: { type: 'string', description: 'Override model for this agent (provider:model, e.g. "anthropic:claude-haiku"). Auto-selected if omitted.' },
              },
              required: ['task'],
            },
          },
        },
        required: ['agents'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'switch_model',
      description: 'Switch the active AI model mid-conversation. Use when a different model is better for the next steps — e.g. switch to a fast model for simple lookups, or a more capable model for complex refactoring. The switch persists for all subsequent turns.',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Model spec: "provider:model" (e.g. "ollama:devstral-small-2:24b") or just model name' },
        },
        required: ['model'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'k8s_pods',
      description: 'List Kubernetes pods. Shows pod name, status, restarts, and age. Runs kubectl locally or via SSH on a remote server. Use namespace to filter, or omit for all namespaces.',
      parameters: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace to list pods in (default: all namespaces)' },
          label: { type: 'string', description: 'Label selector filter (e.g. "app=nginx")' },
          context: { type: 'string', description: 'kubectl context to use (optional)' },
          server: { type: 'string', description: 'Remote server as user@host to run kubectl via SSH (optional, local kubectl if omitted)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'k8s_logs',
      description: 'Fetch logs from a Kubernetes pod. Use tail to limit output, since for time-based filtering (e.g. "1h", "30m").',
      parameters: {
        type: 'object',
        properties: {
          pod: { type: 'string', description: 'Pod name' },
          namespace: { type: 'string', description: 'Namespace (default: default)' },
          container: { type: 'string', description: 'Container name (required if pod has multiple containers)' },
          tail: { type: 'number', description: 'Number of recent lines to show (default: 100)' },
          since: { type: 'string', description: 'Show logs since duration (e.g. "1h", "30m", "5s")' },
          context: { type: 'string', description: 'kubectl context (optional)' },
          server: { type: 'string', description: 'Remote server user@host (optional)' },
        },
        required: ['pod'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'k8s_exec',
      description: 'Execute a command inside a running Kubernetes pod (kubectl exec). Requires user confirmation. Use for inspecting container state, reading configs, or debugging.',
      parameters: {
        type: 'object',
        properties: {
          pod: { type: 'string', description: 'Pod name' },
          command: { type: 'string', description: 'Command to run in the pod (e.g. "env", "ls /app", "cat /etc/config.yaml")' },
          namespace: { type: 'string', description: 'Namespace (default: default)' },
          container: { type: 'string', description: 'Container name (optional)' },
          context: { type: 'string', description: 'kubectl context (optional)' },
          server: { type: 'string', description: 'Remote server user@host (optional)' },
        },
        required: ['pod', 'command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'k8s_apply',
      description: 'Apply a Kubernetes manifest file (kubectl apply -f). Requires confirmation before applying to the cluster. Use dry_run=true to validate without applying.',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Path to manifest YAML file (relative or absolute)' },
          namespace: { type: 'string', description: 'Override namespace (optional)' },
          dry_run: { type: 'boolean', description: 'Validate only without applying (default: false)' },
          context: { type: 'string', description: 'kubectl context (optional)' },
          server: { type: 'string', description: 'Remote server user@host (optional)' },
        },
        required: ['file'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'k8s_rollout',
      description: 'Manage Kubernetes deployment rollouts: check status, restart (rolling update), view history, or undo (rollback). Restart and undo require confirmation.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['status', 'restart', 'history', 'undo'], description: 'Action: status (check rollout progress), restart (rolling restart), history (show revision history), undo (rollback to previous revision)' },
          deployment: { type: 'string', description: 'Deployment name' },
          namespace: { type: 'string', description: 'Namespace (default: default)' },
          context: { type: 'string', description: 'kubectl context (optional)' },
          server: { type: 'string', description: 'Remote server user@host (optional)' },
        },
        required: ['action', 'deployment'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'brain_write',
      description: 'Write or update a knowledge document in the project brain (.nex/brain/). Use this to persist important findings, architecture decisions, debugging insights, or conventions discovered during the session. The user can review changes via /brain review or git diff.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Document name (without .md extension). Use kebab-case. Examples: "api-auth-flow", "db-schema-notes", "deployment-checklist"',
          },
          content: {
            type: 'string',
            description: 'Full Markdown content. Use headings (#), lists (-), and code blocks. Include optional YAML frontmatter with tags.',
          },
          mode: {
            type: 'string',
            enum: ['create', 'update', 'append'],
            description: 'create: new document (fails if exists). update: overwrite existing. append: add to end of existing document.',
          },
        },
        required: ['name', 'content', 'mode'],
      },
    },
  },
  // ─── SSH Tools ────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'ssh_exec',
      description: 'Execute a command on a remote server via SSH. Server is a profile name from .nex/servers.json (e.g. "prod") or "user@host". Use for: checking status, reading logs, running deployments. Destructive commands (restart, delete, modify config) require confirmation. For service management prefer service_manage; for logs prefer service_logs.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name (from .nex/servers.json) or "user@host"' },
          command: { type: 'string', description: 'Shell command to run on the remote server' },
          sudo: { type: 'boolean', description: 'Run command with sudo (only if profile has sudo:true). Default: false' },
          timeout: { type: 'number', description: 'Timeout in seconds. Default: 30' },
        },
        required: ['server', 'command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ssh_upload',
      description: 'Upload a local file or directory to a remote server via SCP. Recursive for directories. Requires confirmation before upload.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host"' },
          local_path: { type: 'string', description: 'Local path to upload (file or directory)' },
          remote_path: { type: 'string', description: 'Destination path on the remote server (absolute preferred)' },
        },
        required: ['server', 'local_path', 'remote_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ssh_download',
      description: 'Download a file or directory from a remote server via SCP. Recursive for directories.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host"' },
          remote_path: { type: 'string', description: 'Path on the remote server to download' },
          local_path: { type: 'string', description: 'Local destination path' },
        },
        required: ['server', 'remote_path', 'local_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'service_manage',
      description: 'Manage a systemd service on a remote (or local) server. Uses systemctl. Status is read-only; start/stop/restart/reload/enable/disable require confirmation. For AlmaLinux 9: runs via SSH with sudo if configured.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host". Omit or use "local" for local machine.' },
          service: { type: 'string', description: 'Service name (e.g. "nginx", "gunicorn", "postgresql")' },
          action: {
            type: 'string',
            enum: ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable'],
            description: 'systemctl action to perform',
          },
        },
        required: ['service', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'service_logs',
      description: 'Fetch systemd service logs via journalctl. Works on AlmaLinux 9 and any systemd Linux. Read-only, no confirmation needed.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host". Omit or use "local" for local machine.' },
          service: { type: 'string', description: 'Service name (e.g. "nginx", "gunicorn")' },
          lines: { type: 'number', description: 'Number of recent log lines to fetch. Default: 50' },
          since: { type: 'string', description: 'Time filter, e.g. "1 hour ago", "today", "2024-01-01 12:00". Optional.' },
          follow: { type: 'boolean', description: 'Tail logs in real-time (follow mode). Default: false' },
        },
        required: ['service'],
      },
    },
  },
  // ─── Docker Tools ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'container_list',
      description: 'List Docker containers on a server (or locally). Shows container ID, name, image, status, and ports. Read-only, no confirmation needed.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host". Omit or use "local" for local machine.' },
          all: { type: 'boolean', description: 'Show all containers including stopped ones. Default: false (running only).' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'container_logs',
      description: 'Fetch logs from a Docker container on a server (or locally). Read-only, no confirmation needed.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host". Omit or use "local" for local machine.' },
          container: { type: 'string', description: 'Container name or ID.' },
          lines: { type: 'number', description: 'Number of recent log lines. Default: 50.' },
          since: { type: 'string', description: 'Time filter, e.g. "1h", "30m", "2024-01-01T12:00:00". Optional.' },
        },
        required: ['container'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'container_exec',
      description: 'Execute a command inside a running Docker container. Destructive or state-changing commands require confirmation.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host". Omit or use "local" for local machine.' },
          container: { type: 'string', description: 'Container name or ID.' },
          command: { type: 'string', description: 'Command to run inside the container (e.g. "cat /etc/nginx/nginx.conf").' },
        },
        required: ['container', 'command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'container_manage',
      description: 'Start, stop, restart, or remove a Docker container. All actions except "inspect" require confirmation.',
      parameters: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'Profile name or "user@host". Omit or use "local" for local machine.' },
          container: { type: 'string', description: 'Container name or ID.' },
          action: {
            type: 'string',
            enum: ['start', 'stop', 'restart', 'remove', 'inspect'],
            description: 'Action to perform on the container.',
          },
        },
        required: ['container', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'deploy',
      description: 'Deploy files to a remote server via rsync + optional remote script. Can use a named config from .nex/deploy.json (e.g. deploy("prod")) or explicit params. Requires confirmation before executing.',
      parameters: {
        type: 'object',
        properties: {
          config: { type: 'string', description: 'Named deploy config from .nex/deploy.json (e.g. "prod"). Overrides all other params if provided.' },
          server: { type: 'string', description: 'Profile name or "user@host". Required if no config.' },
          local_path: { type: 'string', description: 'Local directory or file to sync (e.g. "dist/", "./build"). Required if no config.' },
          remote_path: { type: 'string', description: 'Remote destination path (e.g. "/var/www/app"). Required if no config.' },
          deploy_script: { type: 'string', description: 'Shell command to run on the remote after sync. Optional.' },
          exclude: { type: 'array', items: { type: 'string' }, description: 'Paths to exclude from sync. Optional.' },
          dry_run: { type: 'boolean', description: 'Show what would be synced without actually syncing. Default: false.' },
        },
        required: [],
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
  const safeServer = server ? server.replace(/[^a-zA-Z0-9@._-]/g, '') : null;
  const safeContext = context ? context.replace(/[^a-zA-Z0-9._/-]/g, '') : null;

  let kubectl = 'kubectl';
  if (safeContext) kubectl += ` --context ${safeContext}`;
  kubectl += ` ${kubectlArgs}`;

  if (safeServer) {
    // Escape double-quotes inside the remote command
    const escaped = kubectl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `ssh -o ConnectTimeout=10 -o BatchMode=yes ${safeServer} "${escaped}"`;
  }
  return kubectl;
}

// ─── Tool Implementations ─────────────────────────────────────
async function _executeToolInner(name, args, options = {}) {
  switch (name) {
    case 'bash': {
      const cmd = args.command;
      const forbidden = isForbidden(cmd);
      if (forbidden) {
        const hint = getBlockedHint(cmd);
        return `BLOCKED: Command matches forbidden pattern: ${forbidden}${hint ? `\nHINT: ${hint}` : ''}`;
      }

      const needsPrompt = options.autoConfirm ? isCritical(cmd) : isDangerous(cmd);
      if (needsPrompt) {
        const label = isCritical(cmd) ? '  ⛔ Critical command' : '  ⚠ Dangerous command';
        console.log(`\n${C.yellow}${label}: ${cmd}${C.reset}`);
        const ok = await confirm('  Execute?');
        if (!ok) return 'CANCELLED: User declined to execute this command.';
      }

      // Resolve a safe working directory: if the current directory was deleted during the session,
      // exec() would fail with a confusing "spawn /bin/sh ENOENT" error. Fall back to $HOME.
      let safeCwd = process.cwd();
      try { fsSync.accessSync(safeCwd); } catch {
        safeCwd = require('os').homedir();
        if (!options.silent) console.log(`${C.yellow}  ⚠ Working directory no longer exists — running in ${safeCwd}${C.reset}`);
      }

      // Interactive commands (vim, top, etc.) need a real TTY — spawn with stdio:inherit.
      // SSH with a remote command (e.g. ssh host "cmd") is non-interactive: capture output normally.
      const isSSHLogin = SSH_INTERACTIVE_RE.test(cmd.trim()) && !SSH_HAS_REMOTE_CMD_RE.test(cmd.trim());
      if (INTERACTIVE_CMDS.test(cmd.trim()) || isSSHLogin) {
        if (!options.silent) console.log(`${C.dim}  ▶ interactive: ${cmd}${C.reset}`);
        const result = spawnSync('sh', ['-c', cmd], { stdio: 'inherit', cwd: safeCwd });
        if (result.error) return `ERROR: ${result.error.message}`;
        return result.status === 0
          ? `(interactive command completed successfully)`
          : `(interactive command exited with code ${result.status})`;
      }

      const bashSpinner = options.silent ? null : new Spinner(`Running: ${cmd.substring(0, 60)}${cmd.length > 60 ? '...' : ''}`);
      if (bashSpinner) bashSpinner.start();
      try {
        const { stdout, stderr } = await exec(cmd, {
          cwd: safeCwd,
          timeout: 90000,
          maxBuffer: 5 * 1024 * 1024,
        });
        if (bashSpinner) bashSpinner.stop();
        return stdout || stderr || '(no output)';
      } catch (e) {
        if (bashSpinner) bashSpinner.stop();
        const rawError = (e.stderr || e.stdout || e.message || '').toString().substring(0, 5000);
        const enriched = enrichBashError(rawError, cmd);
        return `EXIT ${e.code || 1}\n${enriched}`;
      }
    }

    case 'read_file': {
      let fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fs.access(fp).then(() => true).catch(() => false);
      if (!exists) {
        // Auto-fix: try to find the file
        const fix = await autoFixPath(args.path);
        if (fix.fixedPath) {
          fp = fix.fixedPath;
          console.log(`${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(process.cwd(), fp)}${C.reset}`);
        } else {
          return `ERROR: File not found: ${args.path}${fix.message ? '\n' + fix.message : ''}`;
        }
      }

      // Binary file detection: check first 8KB for null bytes
      const buf = Buffer.alloc(8192);
      const fd = await fsSync.promises.open(fp, 'r');
      const { bytesRead } = await fd.read(buf, 0, 8192, 0);
      await fd.close();
      for (let b = 0; b < bytesRead; b++) {
        if (buf[b] === 0) return `ERROR: ${fp} is a binary file (not readable as text)`;
      }

      const content = await fs.readFile(fp, 'utf-8');
      if (!content && (await fs.stat(fp)).size > 0) return `WARNING: ${fp} is empty or unreadable`;
      const lines = content.split('\n');
      const start = (args.line_start || 1) - 1;
      const end = args.line_end || lines.length;
      return lines
        .slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n');
    }

    case 'write_file': {
      await ensureCheckpoint();
      const fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fs.access(fp).then(() => true).catch(() => false);
      let oldContent = null;

      if (!options.autoConfirm) {
        if (exists) {
          oldContent = await fs.readFile(fp, 'utf-8');
          const annotations = await runDiagnostics(fp, args.content);
          showClaudeDiff(fp, oldContent, args.content, { annotations });
          const ok = await confirmFileChange('Overwrite');
          if (!ok) return 'CANCELLED: User declined to overwrite file.';
        } else {
          const annotations = await runDiagnostics(fp, args.content);
          showClaudeNewFile(fp, args.content, { annotations });
          const ok = await confirmFileChange('Create');
          if (!ok) return 'CANCELLED: User declined to create file.';
        }
      } else if (exists) {
        oldContent = await fs.readFile(fp, 'utf-8');
      }

      const dir = path.dirname(fp);
      const dirExists = await fs.access(dir).then(() => true).catch(() => false);
      if (!dirExists) await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fp, args.content, 'utf-8');
      recordChange('write_file', fp, oldContent, args.content);
      return `Written: ${fp} (${args.content.length} chars)`;
    }

    case 'edit_file': {
      await ensureCheckpoint();
      let fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fs.access(fp).then(() => true).catch(() => false);
      if (!exists) {
        // Auto-fix: try to find the file
        const fix = await autoFixPath(args.path);
        if (fix.fixedPath) {
          fp = fix.fixedPath;
          console.log(`${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(process.cwd(), fp)}${C.reset}`);
        } else {
          return `ERROR: File not found: ${args.path}${fix.message ? '\n' + fix.message : ''}`;
        }
      }
      const content = await fs.readFile(fp, 'utf-8');

      let matchText = args.old_text;
      let fuzzyMatched = false;
      let autoFixed = false;

      if (!content.includes(args.old_text)) {
        // Try fuzzy whitespace-normalized match
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
              showClaudeDiff(fp, content, fix.content, { annotations });
              const ok = await confirmFileChange(`Apply (auto-fix, line ${fix.line}, distance ${fix.distance})`);
              if (!ok) return 'CANCELLED: User declined to apply edit.';
            }
            await fs.writeFile(fp, fix.content, 'utf-8');
            recordChange('edit_file', fp, content, fix.content);
            const matchPreview = fix.matchText.length > 80
              ? fix.matchText.substring(0, 77) + '...'
              : fix.matchText;
            console.log(`${C.dim}  ✓ auto-fixed edit: line ${fix.line}, distance ${fix.distance}${C.reset}`);
            return `Edited: ${fp} (auto-fixed, line ${fix.line}, distance ${fix.distance}, matched: "${matchPreview}")`;
          }
          // Provide helpful error with most similar text
          const similar = findMostSimilar(content, args.old_text);
          if (similar) {
            return `ERROR: old_text not found in ${fp}\nMost similar text (line ${similar.line}, distance ${similar.distance}):\n${similar.text}`;
          }
          return `ERROR: old_text not found in ${fp}`;
        }
      }

      if (!options.autoConfirm) {
        const preview = content.split(matchText).join(args.new_text);
        const annotations = await runDiagnostics(fp, preview);
        showClaudeDiff(fp, content, preview, { annotations });
        const label = fuzzyMatched ? 'Apply (fuzzy match)' : 'Apply';
        const ok = await confirmFileChange(label);
        if (!ok) return 'CANCELLED: User declined to apply edit.';
      }

      // Use split/join for literal replacement (no regex interpretation)
      const updated = content.split(matchText).join(args.new_text);
      await fs.writeFile(fp, updated, 'utf-8');
      recordChange('edit_file', fp, content, updated);
      return fuzzyMatched ? `Edited: ${fp} (fuzzy match)` : `Edited: ${fp}`;
    }

    case 'list_directory': {
      let dp = resolvePath(args.path);
      if (!dp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fs.access(dp).then(() => true).catch(() => false);
      if (!exists) {
        // Auto-fix: normalize path
        const normalized = args.path.replace(/\/+/g, '/').replace(/^~\//, `${require('os').homedir()}/`);
        const np = resolvePath(normalized);
        const npExists = await fs.access(np).then(() => true).catch(() => false);
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
          const safe = args.pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
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
        entries = entries.filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules');
        for (const entry of entries) {
          if (pattern && !entry.isDirectory() && !pattern.test(entry.name)) continue;
          const marker = entry.isDirectory() ? '/' : '';
          result.push(`${prefix}${entry.name}${marker}`);
          if (entry.isDirectory()) await walk(path.join(dir, entry.name), level + 1, prefix + '  ');
        }
      };

      await walk(dp, 1, '');
      return result.join('\n') || '(empty)';
    }

    case 'search_files': {
      const dp = resolvePath(args.path);
      if (!dp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const grepArgs = ['-rn', '--null', '-H'];
      if (args.file_pattern) grepArgs.push(`--include=${args.file_pattern}`);
      grepArgs.push(args.pattern, dp);
      try {
        const { stdout } = await execFile('grep', grepArgs, {
          cwd: process.cwd(), timeout: 30000, maxBuffer: 2 * 1024 * 1024,
        });
        // Parse null-delimited output to handle filenames with spaces
        const parts = stdout.split('\0');
        const results = [];
        for (let i = 0; i < parts.length; i += 2) {
          const file = parts[i];
          const content = parts[i + 1];
          if (file && content) {
            const lines = content.split('\n').filter(l => l.trim());
            for (const line of lines) {
              results.push(`${file}:${line}`);
              if (results.length >= 50) break;
            }
          }
          if (results.length >= 50) break;
        }
        return results.join('\n') || '(no matches)';
      } catch {
        return '(no matches)';
      }
    }

    case 'glob': {
      const GLOB_LIMIT = 200;
      const currentCwd = process.cwd();
      const basePath = args.path ? resolvePath(args.path) : currentCwd;
      const pattern = args.pattern;

      const globToRegex = (g) => {
        const escaped = g
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*\//g, '(.*\/)?')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.');
        return new RegExp(`^${escaped}$`);
      };

      const fullRegex = globToRegex(pattern);
      const namePattern = pattern.split('/').pop();
      const nameRegex = globToRegex(namePattern);

      let { getFileIndex: getIndex, getIndexedCwd, refreshIndex, isIndexValid } = require('./index-engine');
      let allFiles = getIndex();
      let indexedCwd = getIndexedCwd();

      // Refresh if index is invalid (empty, wrong cwd, or expired)
      if (!isIndexValid(basePath)) {
        await refreshIndex(basePath);
        allFiles = getIndex();
      }

      const matches = allFiles
        .filter(f => fullRegex.test(f) || nameRegex.test(path.basename(f)))
        .map(f => path.join(basePath, f));

      if (matches.length === 0) return '(no matches)';

      const truncated = matches.length > GLOB_LIMIT;
      const result = matches.slice(0, GLOB_LIMIT).join('\n');

      return truncated
        ? `${result}\n\n⚠ Results truncated at ${GLOB_LIMIT}. Use a more specific pattern.`
        : result;
    }

    case 'grep': {
      const searchPath = args.path ? resolvePath(args.path) : process.cwd();
      const grepArgs2 = ['-rn', '-E', '--null', '-H']; // Extended regex (supports |, +, etc.) + null-delimited for spaces
      if (args.ignore_case) grepArgs2.push('-i');
      if (args.include) grepArgs2.push(`--include=${args.include}`);
      grepArgs2.push('--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=coverage');
      grepArgs2.push(args.pattern, searchPath);
      try {
        const { stdout } = await execFile('grep', grepArgs2, {
          cwd: process.cwd(), timeout: 30000, maxBuffer: 2 * 1024 * 1024,
        });
        // Parse null-delimited output to handle filenames with spaces
        const parts = stdout.split('\0');
        const results = [];
        for (let i = 0; i < parts.length; i += 2) {
          const file = parts[i];
          const content = parts[i + 1];
          if (file && content) {
            const lines = content.split('\n').filter(l => l.trim());
            for (const line of lines) {
              results.push(`${file}:${line}`);
              if (results.length >= 100) break;
            }
          }
          if (results.length >= 100) break;
        }
        return results.join('\n').trim() || '(no matches)';
      } catch (e) {
        // exit 1 = no matches (normal), exit 2 = regex error
        if (e.code === 2) {
          return `ERROR: Invalid regex pattern: ${args.pattern}`;
        }
        return '(no matches)';
      }
    }

    case 'patch_file': {
      await ensureCheckpoint();
      let fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = await fs.access(fp).then(() => true).catch(() => false);
      if (!exists) {
        // Auto-fix: try to find the file
        const fix = await autoFixPath(args.path);
        if (fix.fixedPath) {
          fp = fix.fixedPath;
          console.log(`${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(process.cwd(), fp)}${C.reset}`);
        } else {
          return `ERROR: File not found: ${args.path}${fix.message ? '\n' + fix.message : ''}`;
        }
      }

      const patches = args.patches;
      if (!Array.isArray(patches) || patches.length === 0) return 'ERROR: No patches provided';

      let content = await fs.readFile(fp, 'utf-8');

      // Validate all patches first (exact → fuzzy → auto-fix → error)
      const resolvedPatches = [];
      let anyFuzzy = false;
      let anyAutoFixed = false;
      for (let i = 0; i < patches.length; i++) {
        const { old_text, new_text } = patches[i];
        if (content.includes(old_text)) {
          resolvedPatches.push({ old_text, new_text });
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
        showClaudeDiff(fp, content, preview, { annotations });
        const label = anyFuzzy ? 'Apply patches (fuzzy match)' : 'Apply patches';
        const ok = await confirmFileChange(label);
        if (!ok) return 'CANCELLED: User declined to apply patches.';
      }

      // Write the fully-validated preview (atomic — no partial application)
      await fs.writeFile(fp, preview, 'utf-8');
      recordChange('patch_file', fp, content, preview);
      const suffix = anyAutoFixed ? ' (auto-fixed)' : anyFuzzy ? ' (fuzzy match)' : '';
      return `Patched: ${fp} (${patches.length} replacements)${suffix}`;
    }

    case 'web_fetch': {
      const url = args.url;
      const maxLen = args.max_length || 10000;
      try {
        const resp = await axios.get(url, {
          timeout: 15000,
          maxContentLength: 1048576,
          responseType: 'text',
          headers: { 'User-Agent': 'nex-code/0.2.0' },
        });
        const out = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        // Strip HTML tags for cleaner output
        const text = out.replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return text.substring(0, maxLen) || '(empty response)';
      } catch (e) {
        return `ERROR: Failed to fetch ${url}: ${e.message}`;
      }
    }

    case 'web_search': {
      const maxResults = args.max_results || 5;
      // Perplexity grounded search (if API key available)
      if (process.env.PERPLEXITY_API_KEY) {
        try {
          const resp = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
              model: 'sonar',
              messages: [{ role: 'user', content: args.query }],
              max_tokens: 1024,
              search_recency_filter: 'month',
              return_citations: true,
            },
            {
              timeout: 20000,
              headers: {
                Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );
          const answer = resp.data?.choices?.[0]?.message?.content || '';
          const citations = resp.data?.citations || [];
          let out = `[Perplexity grounded search]\n\n${answer}`;
          if (citations.length > 0) {
            out += '\n\nSources:\n' + citations.slice(0, maxResults).map((c, i) => `${i + 1}. ${c}`).join('\n');
          }
          return out;
        } catch (e) {
          // Fall through to DuckDuckGo on error
          console.error(`${C.dim}  Perplexity search failed (${e.message}), falling back to DuckDuckGo${C.reset}`);
        }
      }
      // DuckDuckGo fallback
      try {
        const resp = await axios.get('https://html.duckduckgo.com/html/', {
          params: { q: args.query },
          timeout: 10000,
          responseType: 'text',
          headers: { 'User-Agent': 'nex-code/0.2.0' },
        });
        const out = resp.data;
        // Parse results from DuckDuckGo HTML
        const results = [];
        const regex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = regex.exec(out)) !== null && results.length < maxResults) {
          const href = match[1].replace(/.*uddg=/, '').split('&')[0];
          const title = match[2].replace(/<[^>]+>/g, '').trim();
          try {
            results.push({ title, url: decodeURIComponent(href) });
          } catch {
            results.push({ title, url: href });
          }
        }
        if (results.length === 0) return '(no results)';
        return results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`).join('\n\n');
      } catch {
        return 'ERROR: Web search failed';
      }
    }

    case 'browser_open': {
      const { browserNavigate } = require('./browser');
      try {
        const result = await browserNavigate(args.url, { waitFor: args.wait_for });
        const linkStr = result.links.length > 0
          ? '\n\nLinks:\n' + result.links.map(l => `  ${l.text} → ${l.href}`).join('\n')
          : '';
        return `Title: ${result.title}\nURL: ${result.url}\n\n${result.text}${linkStr}`;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case 'browser_screenshot': {
      const { browserScreenshot } = require('./browser');
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

    case 'browser_click': {
      const { browserClick } = require('./browser');
      try {
        return await browserClick(args.url, { selector: args.selector, text: args.text });
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case 'browser_fill': {
      const { browserFill } = require('./browser');
      try {
        return await browserFill(args.url, { selector: args.selector, value: args.value, submit: args.submit });
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case 'ask_user': {
      const { question, options = [] } = args;
      if (_askUserFn) {
        return new Promise((resolve) => {
          _cancelAskUser = () => resolve('CANCELLED');
          _askUserFn(question, options).then((answer) => {
            _cancelAskUser = null;
            resolve(answer || 'User did not answer');
          });
        });
      }
      // Fallback: plain readline prompt (non-TTY / no handler registered)
      return new Promise((resolve) => {
        const rl = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        _cancelAskUser = () => {
          rl.close();
          resolve('CANCELLED');
        };
        const optText = options.length > 0 ? `\n${options.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}\n` : '';
        console.log(`\n${C.cyan}${C.bold}  ? ${question}${C.reset}${optText}`);
        rl.question(`${C.cyan}  > ${C.reset}`, (answer) => {
          _cancelAskUser = null;
          rl.close();
          resolve(answer.trim() || '(no response)');
        });
      });
    }

    case 'git_status': {
      if (!(await isGitRepo())) return 'ERROR: Not a git repository';
      const branch = (await getCurrentBranch()) || '(detached)';
      const status = await getStatus();
      if (status.length === 0) return `Branch: ${branch}\nClean working tree (no changes)`;
      const lines = [`Branch: ${branch}`, `Changed files (${status.length}):`];
      for (const s of status) {
        const label = s.status === 'M' ? 'modified' : s.status === 'A' ? 'added' : s.status === 'D' ? 'deleted' : s.status === '??' ? 'untracked' : s.status;
        lines.push(`  ${label}: ${s.file}`);
      }
      return lines.join('\n');
    }

    case 'git_diff': {
      if (!(await isGitRepo())) return 'ERROR: Not a git repository';
      let diff;
      if (args.file) {
        const gitArgs = ['diff'];
        if (args.staged) gitArgs.push('--cached');
        gitArgs.push('--', args.file);
        try {
          diff = execFileSync('git', gitArgs, { cwd: process.cwd(), encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }).trim();
        } catch { diff = ''; }
      } else {
        diff = await getDiff(!!args.staged);
      }
      return diff || '(no diff)';
    }

    case 'git_log': {
      if (!(await isGitRepo())) return 'ERROR: Not a git repository';
      const count = Math.min(args.count || 10, 50);
      const gitLogArgs = ['log', '--oneline', `-${count}`];
      if (args.file) gitLogArgs.push('--', args.file);
      try {
        const out = execFileSync('git', gitLogArgs, { cwd: process.cwd(), encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }).trim();
        return out || '(no commits)';
      } catch {
        return '(no commits)';
      }
    }

    case 'task_list': {
      const { createTasks, updateTask, getTaskList, renderTaskList, hasActiveTasks } = require('./tasks');
      const { getActiveTaskProgress } = require('./ui');
      const liveDisplay = getActiveTaskProgress();
      switch (args.action) {
        case 'create': {
          if (!args.name || !args.tasks) return 'ERROR: task_list create requires name and tasks';
          const created = createTasks(args.name, args.tasks);
          if (!liveDisplay) console.log('\n' + renderTaskList());
          return `Created task list "${args.name}" with ${created.length} tasks:\n` +
            created.map(t => `  ${t.id}: ${t.description}`).join('\n');
        }
        case 'update': {
          if (!args.task_id || !args.status) return 'ERROR: task_list update requires task_id and status';
          const updated = updateTask(args.task_id, args.status, args.result);
          if (!updated) return `ERROR: Task not found: ${args.task_id}`;
          if (!liveDisplay) console.log('\n' + renderTaskList());
          return `Updated ${args.task_id}: ${args.status}${args.result ? ' — ' + args.result : ''}`;
        }
        case 'get': {
          const list = getTaskList();
          if (list.tasks.length === 0) return 'No active tasks';
          if (!liveDisplay) console.log('\n' + renderTaskList());
          return JSON.stringify(list, null, 2);
        }
        default:
          return `ERROR: Unknown task_list action: ${args.action}. Use: create, update, get`;
      }
    }

    case 'spawn_agents': {
      const { executeSpawnAgents } = require('./sub-agent');
      return executeSpawnAgents(args);
    }

    case 'switch_model': {
      const { setActiveModel, getActiveProviderName, getActiveModelId } = require('./providers/registry');
      if (setActiveModel(args.model)) {
        return `Switched to ${getActiveProviderName()}:${getActiveModelId()}`;
      }
      return `ERROR: Unknown model: ${args.model}. Use /providers to see available models.`;
    }

    case 'gh_run_list': {
      const limit = Math.min(args.limit || 10, 30);
      const ghArgs = ['run', 'list', '--limit', String(limit), '--json', 'databaseId,status,conclusion,name,headBranch,createdAt,updatedAt,event'];
      if (args.workflow) ghArgs.push('--workflow', args.workflow);
      if (args.branch) ghArgs.push('--branch', args.branch);
      if (args.status) ghArgs.push('--status', args.status);
      try {
        const { stdout } = await exec(`gh ${ghArgs.join(' ')}`, { cwd: process.cwd(), timeout: 30000 });
        const runs = JSON.parse(stdout || '[]');
        if (runs.length === 0) return 'No workflow runs found.';
        const lines = runs.map((r) => {
          const status = r.conclusion || r.status || 'unknown';
          const icon = status === 'success' ? '✓' : status === 'failure' ? '✗' : status === 'in_progress' ? '⠿' : '○';
          const age = r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 16).replace('T', ' ') : '';
          return `${icon} [${r.databaseId}] ${r.name} · ${r.headBranch} · ${status} · ${age}`;
        });
        return lines.join('\n');
      } catch (e) {
        const msg = (e.stderr || e.message || '').toString();
        if (msg.includes('not found') || msg.includes('not logged')) return 'ERROR: gh CLI not found or not authenticated. Run: gh auth login';
        return `ERROR: ${msg.split('\n')[0]}`;
      }
    }

    case 'gh_run_view': {
      if (!args.run_id) return 'ERROR: run_id is required';
      try {
        if (args.log) {
          const { stdout } = await exec(`gh run view ${args.run_id} --log`, { cwd: process.cwd(), timeout: 60000, maxBuffer: 5 * 1024 * 1024 });
          return stdout.substring(0, 8000) + (stdout.length > 8000 ? '\n...(truncated)' : '');
        }
        const { stdout } = await exec(`gh run view ${args.run_id} --json status,conclusion,name,headBranch,createdAt,updatedAt,jobs`, { cwd: process.cwd(), timeout: 30000 });
        const run = JSON.parse(stdout);
        const lines = [
          `Run: ${run.name} [${args.run_id}]`,
          `Branch: ${run.headBranch}  Status: ${run.conclusion || run.status}`,
          `Started: ${run.createdAt}  Finished: ${run.updatedAt || '—'}`,
          '',
          'Jobs:',
        ];
        for (const job of run.jobs || []) {
          const icon = job.conclusion === 'success' ? '✓' : job.conclusion === 'failure' ? '✗' : '○';
          lines.push(`  ${icon} ${job.name} (${job.conclusion || job.status})`);
          for (const step of job.steps || []) {
            if (step.conclusion === 'failure' || step.conclusion === 'skipped') continue;
            const sIcon = step.conclusion === 'success' ? '  ✓' : step.conclusion === 'failure' ? '  ✗' : '  ○';
            lines.push(`    ${sIcon} ${step.name}`);
          }
        }
        return lines.join('\n');
      } catch (e) {
        return `ERROR: ${(e.stderr || e.message || '').toString().split('\n')[0]}`;
      }
    }

    case 'gh_workflow_trigger': {
      if (!args.workflow) return 'ERROR: workflow is required';
      const { confirm: confirmTrigger } = require('./safety');
      const branch = args.branch || (await getCurrentBranch()) || 'main';
      const inputStr = args.inputs ? Object.entries(args.inputs).map(([k, v]) => `-f ${k}=${v}`).join(' ') : '';
      const cmd = `gh workflow run ${args.workflow} --ref ${branch} ${inputStr}`.trim();
      console.log(`\n${C.yellow}  ⚠ Trigger workflow: ${args.workflow} on ${branch}${C.reset}`);
      const ok = await confirmTrigger('  Trigger?');
      if (!ok) return 'CANCELLED: User declined to trigger workflow.';
      try {
        await exec(cmd, { cwd: process.cwd(), timeout: 30000 });
        return `Workflow "${args.workflow}" triggered on branch "${branch}". Check status with gh_run_list.`;
      } catch (e) {
        return `ERROR: ${(e.stderr || e.message || '').toString().split('\n')[0]}`;
      }
    }

    case 'k8s_pods': {
      const nsFlag = args.namespace ? `-n ${args.namespace}` : '-A';
      const labelFlag = args.label ? `-l ${args.label}` : '';
      const cmd = buildKubectlCmd(`get pods ${nsFlag} ${labelFlag} -o wide`.trim(), args);
      try {
        const { stdout, stderr } = await exec(cmd, { timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
        return (stdout || stderr || '(no pods)').trim();
      } catch (e) {
        const msg = (e.stderr || e.message || '').toString().split('\n')[0];
        if (msg.includes('command not found')) return 'ERROR: kubectl not found. Install kubectl or provide a server with kubectl.';
        return `ERROR: ${msg}`;
      }
    }

    case 'k8s_logs': {
      if (!args.pod) return 'ERROR: pod is required';
      const ns = args.namespace || 'default';
      const tail = args.tail || 100;
      let kubectlArgs = `logs ${args.pod} -n ${ns} --tail=${tail}`;
      if (args.since) kubectlArgs += ` --since=${args.since}`;
      if (args.container) kubectlArgs += ` -c ${args.container}`;
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, { timeout: 60000, maxBuffer: 5 * 1024 * 1024 });
        const out = (stdout || stderr || '(no logs)').trim();
        return out.substring(0, 20000) + (out.length > 20000 ? '\n...(truncated)' : '');
      } catch (e) {
        const msg = (e.stderr || e.message || '').toString().split('\n')[0];
        return `ERROR: ${msg}`;
      }
    }

    case 'k8s_exec': {
      if (!args.pod) return 'ERROR: pod is required';
      if (!args.command) return 'ERROR: command is required';
      const ns = args.namespace || 'default';
      console.log(`\n${C.yellow}  ⚠ kubectl exec into pod: ${args.pod} (ns: ${ns})${C.reset}`);
      console.log(`${C.dim}  Command: ${args.command}${C.reset}`);
      const ok = await confirm('  Execute in pod?');
      if (!ok) return 'CANCELLED: User declined.';
      let kubectlArgs = `exec ${args.pod} -n ${ns}`;
      if (args.container) kubectlArgs += ` -c ${args.container}`;
      kubectlArgs += ` -- sh -c ${JSON.stringify(args.command)}`;
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, { timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
        return (stdout || stderr || '(no output)').trim();
      } catch (e) {
        const msg = (e.stderr || e.message || '').toString().split('\n')[0];
        return `ERROR: ${msg}`;
      }
    }

    case 'k8s_apply': {
      if (!args.file) return 'ERROR: file is required';
      const isDryRun = !!args.dry_run;
      if (!isDryRun) {
        const manifestPath = args.file;
        console.log(`\n${C.yellow}  ⚠ kubectl apply: ${manifestPath}${args.namespace ? ` (ns: ${args.namespace})` : ''}${C.reset}`);
        const ok = await confirm('  Apply to cluster?');
        if (!ok) return 'CANCELLED: User declined.';
      }
      let kubectlArgs = `apply -f ${args.file}`;
      if (args.namespace) kubectlArgs += ` -n ${args.namespace}`;
      if (isDryRun) kubectlArgs += ' --dry-run=client';
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, { timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
        return (stdout || stderr || '(no output)').trim();
      } catch (e) {
        const msg = (e.stderr || e.message || '').toString();
        return `ERROR: ${msg.split('\n')[0]}`;
      }
    }

    case 'k8s_rollout': {
      if (!args.action) return 'ERROR: action is required';
      if (!args.deployment) return 'ERROR: deployment is required';
      const ns = args.namespace || 'default';
      const needsConfirm = args.action === 'restart' || args.action === 'undo';
      if (needsConfirm) {
        const label = args.action === 'restart' ? 'Rolling restart' : 'Rollback (undo)';
        console.log(`\n${C.yellow}  ⚠ ${label}: deployment/${args.deployment} (ns: ${ns})${C.reset}`);
        const ok = await confirm(`  ${label}?`);
        if (!ok) return 'CANCELLED: User declined.';
      }
      const kubectlArgs = `rollout ${args.action} deployment/${args.deployment} -n ${ns}`;
      const cmd = buildKubectlCmd(kubectlArgs, args);
      try {
        const { stdout, stderr } = await exec(cmd, { timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
        return (stdout || stderr || '(no output)').trim();
      } catch (e) {
        const msg = (e.stderr || e.message || '').toString().split('\n')[0];
        return `ERROR: ${msg}`;
      }
    }

    case 'brain_write': {
      if (!args.name) return 'ERROR: name is required';
      if (!args.content) return 'ERROR: content is required';
      if (!args.mode) return 'ERROR: mode is required (create, update, append)';
      const { writeDocument: brainWrite, readDocument: brainRead } = require('./brain');
      const { name: docName, content: docContent, mode: docMode } = args;

      if (docMode === 'create') {
        const existing = brainRead(docName);
        if (existing.content) {
          return `ERROR: Document "${docName}" already exists. Use mode "update" to overwrite.`;
        }
      }

      if (docMode === 'append') {
        const existing = brainRead(docName);
        const combined = existing.content ? existing.content + '\n\n' + docContent : docContent;
        brainWrite(docName, combined);
        return `Appended to brain document: ${docName}.md`;
      }

      brainWrite(docName, docContent);
      return `${docMode === 'create' ? 'Created' : 'Updated'} brain document: ${docName}.md`;
    }

    case 'ssh_exec': {
      if (!args.server) return 'ERROR: server is required';
      if (!args.command) return 'ERROR: command is required';

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      const cmd = args.command;
      const useSudo = Boolean(args.sudo);
      const timeoutMs = (args.timeout || 30) * 1000;

      // Require confirmation for destructive/modifying remote commands
      const isDestructive = /\b(rm|rmdir|mv|cp|chmod|chown|dd|mkfs|systemctl\s+(start|stop|restart|reload|enable|disable)|dnf\s+(install|remove|update|upgrade)|yum\s+(install|remove)|apt(-get)?\s+(install|remove|purge)|pip\s+install|pip3\s+install|firewall-cmd\s+--permanent|semanage|setsebool|passwd|userdel|useradd|nginx\s+-s\s+(reload|stop)|service\s+\w+\s+(start|stop|restart))\b/.test(cmd);

      if (isDestructive) {
        const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
        console.log(`\n${C.yellow}  ⚠ Remote command on ${target}: ${cmd}${C.reset}`);
        const ok = await confirm('  Execute on remote server?');
        if (!ok) return 'CANCELLED: User declined to execute remote command.';
      }

      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: timeoutMs, sudo: useSudo });

      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (exitCode !== 0) {
        return `EXIT ${exitCode}\n${error || output || '(no output)'}`;
      }
      return output || '(command completed, no output)';
    }

    case 'ssh_upload': {
      if (!args.server || !args.local_path || !args.remote_path) {
        return 'ERROR: server, local_path, and remote_path are required';
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
      console.log(`\n${C.yellow}  ⚠ Upload: ${args.local_path} → ${target}:${args.remote_path}${C.reset}`);
      const ok = await confirm('  Upload to remote server?');
      if (!ok) return 'CANCELLED: User declined upload.';

      try {
        const result = await scpUpload(profile, args.local_path, args.remote_path);
        return result;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case 'ssh_download': {
      if (!args.server || !args.remote_path || !args.local_path) {
        return 'ERROR: server, remote_path, and local_path are required';
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      try {
        const result = await scpDownload(profile, args.remote_path, args.local_path);
        return result;
      } catch (e) {
        return `ERROR: ${e.message}`;
      }
    }

    case 'service_manage': {
      if (!args.service) return 'ERROR: service is required';
      if (!args.action) return 'ERROR: action is required';

      const validActions = ['status', 'start', 'stop', 'restart', 'reload', 'enable', 'disable'];
      if (!validActions.includes(args.action)) {
        return `ERROR: invalid action "${args.action}". Valid: ${validActions.join(', ')}`;
      }

      const isLocal = !args.server || args.server === 'local' || args.server === 'localhost';
      const isReadOnly = args.action === 'status';

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
        const location = isLocal ? 'local machine' : (profile.user ? `${profile.user}@${profile.host}` : profile.host);
        console.log(`\n${C.yellow}  ⚠ Service: systemctl ${args.action} ${args.service} on ${location}${C.reset}`);
        const ok = await confirm('  Execute?');
        if (!ok) return 'CANCELLED: User declined service action.';
      }

      const cmd = `systemctl ${args.action} ${args.service}`;

      if (isLocal) {
        // Local execution
        const needsSudo = args.action !== 'status';
        const localCmd = needsSudo ? `sudo ${cmd}` : cmd;
        try {
          const { stdout, stderr } = await exec(localCmd, { timeout: 15000 });
          return (stdout || stderr || `systemctl ${args.action} ${args.service}: OK`).trim();
        } catch (e) {
          const errMsg = (e.stderr || e.message || '').toString().trim();
          if (/not found|loaded.*not-found/i.test(errMsg)) {
            return `ERROR: Service "${args.service}" not found. Check: systemctl list-units --type=service`;
          }
          return `EXIT ${e.code || 1}\n${errMsg}`;
        }
      } else {
        const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: 15000, sudo: true });
        const output = [stdout, stderr].filter(Boolean).join('\n').trim();
        if (exitCode !== 0) {
          if (/not found|loaded.*not-found/i.test(output)) {
            return `ERROR: Service "${args.service}" not found on ${profile.host}. Check: ssh_exec to run "systemctl list-units --type=service"`;
          }
          return `EXIT ${exitCode}\n${error || output || '(no output)'}`;
        }
        return output || `systemctl ${args.action} ${args.service}: OK`;
      }
    }

    case 'service_logs': {
      if (!args.service) return 'ERROR: service is required';

      const isLocal = !args.server || args.server === 'local' || args.server === 'localhost';
      const lines = args.lines || 50;
      const sinceFlag = args.since ? `--since "${args.since}"` : '';
      const followFlag = args.follow ? '-f' : '';
      const cmd = `journalctl -u ${args.service} -n ${lines} ${sinceFlag} ${followFlag} --no-pager`.trim().replace(/\s+/g, ' ');

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 15000 });
          return (stdout || stderr || '(no log output)').trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || '').toString().trim()}`;
        }
      }

      let profile;
      try {
        profile = resolveProfile(args.server);
      } catch (e) {
        return `ERROR: ${e.message}`;
      }

      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: 20000 });
      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || output || '(no output)'}`;
      return output || '(no log output)';
    }

    // ─── Docker Tools ─────────────────────────────────────────

    case 'container_list': {
      const isLocal = !args.server || args.server === 'local' || args.server === 'localhost';
      const allFlag = args.all ? '-a' : '';
      const cmd = `docker ps ${allFlag} --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"`.trim().replace(/\s+/g, ' ');

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 10000 });
          return (stdout || stderr || '(no containers)').trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || '').toString().trim()}`;
        }
      }

      let profile;
      try { profile = resolveProfile(args.server); } catch (e) { return `ERROR: ${e.message}`; }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: 15000 });
      const out = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || '(no containers)';
    }

    case 'container_logs': {
      if (!args.container) return 'ERROR: container is required';
      const isLocal = !args.server || args.server === 'local' || args.server === 'localhost';
      const lines = args.lines || 50;
      const sinceFlag = args.since ? `--since "${args.since}"` : '';
      const cmd = `docker logs --tail ${lines} ${sinceFlag} ${args.container} 2>&1`.trim().replace(/\s+/g, ' ');

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 15000 });
          return (stdout || stderr || '(no log output)').trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || '').toString().trim()}`;
        }
      }

      let profile;
      try { profile = resolveProfile(args.server); } catch (e) { return `ERROR: ${e.message}`; }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: 20000 });
      const out = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || '(no log output)';
    }

    case 'container_exec': {
      if (!args.container) return 'ERROR: container is required';
      if (!args.command) return 'ERROR: command is required';
      const isLocal = !args.server || args.server === 'local' || args.server === 'localhost';

      // Confirm non-trivial / state-changing commands
      const DOCKER_SAFE_RE = /^(cat|ls|echo|env|printenv|df|du|ps|id|whoami|uname|hostname|date|pwd|which|find\s|head\s|tail\s|grep\s|curl\s+-[A-Za-z]*G|curl\s+https?:\/\/[^\s]+$)/;
      const needsConfirm = !options.autoConfirm && !DOCKER_SAFE_RE.test(args.command.trim());
      if (needsConfirm) {
        const where = isLocal ? 'local' : args.server;
        console.log(`\n${C.yellow}  ⚠ docker exec in ${args.container} on ${where}: ${args.command}${C.reset}`);
        const ok = await confirm('  Execute?');
        if (!ok) return 'CANCELLED: User declined.';
      }

      const cmd = `docker exec ${args.container} sh -c ${JSON.stringify(args.command)}`;

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 30000 });
          return (stdout || stderr || '(no output)').trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || '').toString().trim()}`;
        }
      }

      let profile;
      try { profile = resolveProfile(args.server); } catch (e) { return `ERROR: ${e.message}`; }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: 35000 });
      const out = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || '(no output)';
    }

    case 'container_manage': {
      if (!args.container) return 'ERROR: container is required';
      if (!args.action) return 'ERROR: action is required';
      const VALID_ACTIONS = ['start', 'stop', 'restart', 'remove', 'inspect'];
      if (!VALID_ACTIONS.includes(args.action)) return `ERROR: invalid action "${args.action}". Valid: ${VALID_ACTIONS.join(', ')}`;

      const isLocal = !args.server || args.server === 'local' || args.server === 'localhost';
      const isReadOnly = args.action === 'inspect';

      if (!isReadOnly && !options.autoConfirm) {
        const where = isLocal ? 'local' : args.server;
        console.log(`\n${C.yellow}  ⚠ docker ${args.action} ${args.container} on ${where}${C.reset}`);
        const ok = await confirm('  Execute?');
        if (!ok) return 'CANCELLED: User declined.';
      }

      const dockerAction = args.action === 'remove' ? 'rm' : args.action;
      const cmd = args.action === 'inspect'
        ? `docker inspect ${args.container}`
        : `docker ${dockerAction} ${args.container}`;

      if (isLocal) {
        try {
          const { stdout, stderr } = await exec(cmd, { timeout: 30000 });
          return (stdout || stderr || `docker ${args.action} ${args.container}: OK`).trim();
        } catch (e) {
          return `EXIT ${e.code || 1}\n${(e.stderr || e.message || '').toString().trim()}`;
        }
      }

      let profile;
      try { profile = resolveProfile(args.server); } catch (e) { return `ERROR: ${e.message}`; }
      const { stdout, stderr, exitCode, error } = await sshExec(profile, cmd, { timeout: 35000 });
      const out = [stdout, stderr].filter(Boolean).join('\n').trim();
      if (exitCode !== 0) return `EXIT ${exitCode}\n${error || out}`;
      return out || `docker ${args.action} ${args.container}: OK`;
    }

    // ─── Deploy Tool ──────────────────────────────────────────

    case 'deploy': {
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

      if (!args.server) return 'ERROR: server is required (or use config: "<name>")';
      if (!args.local_path) return 'ERROR: local_path is required';
      if (!args.remote_path) return 'ERROR: remote_path is required';

      let profile;
      try { profile = resolveProfile(args.server); } catch (e) { return `ERROR: ${e.message}`; }

      const target = profile.user ? `${profile.user}@${profile.host}` : profile.host;
      const portFlag = profile.port && Number(profile.port) !== 22 ? `-e "ssh -p ${profile.port}"` : '';
      const keyFlag = profile.key ? `-e "ssh -i ${profile.key.replace(/^~/, require('os').homedir())}"` : '';
      const sshFlags = profile.key ? `-e "ssh -i ${profile.key.replace(/^~/, require('os').homedir())}${profile.port && Number(profile.port) !== 22 ? ` -p ${profile.port}` : ''}"` : portFlag;
      const excludeFlags = (args.exclude || []).map(e => `--exclude="${e}"`).join(' ');
      const dryRun = args.dry_run ? '--dry-run' : '';

      const localPath = args.local_path.endsWith('/') ? args.local_path : `${args.local_path}/`;
      const rsyncCmd = `rsync -avz --delete ${dryRun} ${excludeFlags} ${sshFlags} ${localPath} ${target}:${args.remote_path}`.trim().replace(/\s+/g, ' ');

      if (!args.dry_run && !options.autoConfirm) {
        console.log(`\n${C.yellow}  ⚠ Deploy: ${localPath} → ${target}:${args.remote_path}${C.reset}`);
        if (args.deploy_script) console.log(`${C.yellow}  Then run: ${args.deploy_script}${C.reset}`);
        const ok = await confirm('  Proceed with deployment?');
        if (!ok) return 'CANCELLED: User declined.';
      }

      let output = '';
      try {
        const { stdout, stderr } = await exec(rsyncCmd, { timeout: 120000 });
        output = (stdout || stderr || '').trim();
      } catch (e) {
        return `ERROR (rsync): ${(e.stderr || e.message || '').toString().trim()}`;
      }

      if (args.dry_run) return `DRY RUN:\n${output || '(nothing to sync)'}`;

      let remoteResult = '';
      if (args.deploy_script) {
        const { stdout, stderr, exitCode, error } = await sshExec(profile, args.deploy_script, { timeout: 60000 });
        const remoteOut = [stdout, stderr].filter(Boolean).join('\n').trim();
        if (exitCode !== 0) {
          return `rsync OK\n\nERROR (deploy_script, exit ${exitCode}):\n${error || remoteOut}`;
        }
        remoteResult = `\n\nRemote script output:\n${remoteOut || '(no output)'}`;
      }

      return `Deployed ${localPath} → ${target}:${args.remote_path}\n${output}${remoteResult}`.trim();
    }

    default:
      return `ERROR: Unknown tool: ${name}`;
  }
}

// ─── Spinner Wrapper ──────────────────────────────────────────
async function executeTool(name, args, options = {}) {
  const spinnerText = options.silent ? null : getToolSpinnerText(name, args);
  if (!spinnerText) return _executeToolInner(name, args, options);

  const spinner = new Spinner(spinnerText);
  spinner.start();
  try {
    const result = await _executeToolInner(name, args, options);
    spinner.stop();
    return result;
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool, resolvePath, autoFixPath, autoFixEdit, enrichBashError, cancelPendingAskUser, setAskUserHandler };

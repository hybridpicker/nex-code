/**
 * cli/tools.js — Tool Definitions + Implementations
 */

const fs = require('fs').promises;
const fsSync = require('fs'); // Keep sync version for binary check and simple checks if needed
const path = require('path');
const exec = require('util').promisify(require('child_process').exec);
const execFile = require('util').promisify(require('child_process').execFile);
const axios = require('axios');
const { isForbidden, isDangerous, confirm } = require('./safety');
const { showClaudeDiff, showClaudeNewFile, showEditDiff, confirmFileChange } = require('./diff');
const { C, Spinner, getToolSpinnerText } = require('./ui');
const { isGitRepo, getCurrentBranch, getStatus, getDiff } = require('./git');
const { recordChange } = require('./file-history');
const { fuzzyFindText, findMostSimilar } = require('./fuzzy-match');
const { runDiagnostics } = require('./diagnostics');
const { findFileInIndex, getFileIndex } = require('./index-engine');

const CWD = process.cwd();

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
        return { fixedPath: found[0], message: `(auto-fixed: found ${basename} at ${path.relative(CWD, found[0])})` };
      }
      if (found.length > 1 && found.length <= 5) {
        const relative = found.map(f => path.relative(CWD, f));
        return { fixedPath: null, message: `File not found. Did you mean one of:\n${relative.map(r => `  - ${r}`).join('\n')}` };
      }
    } catch { /* index search failed, skip */ }
  }

  return { fixedPath: null, message: '' };
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

  // Auto-apply threshold: ≤ 5% of target length or ≤ 3 chars difference
  const threshold = Math.max(3, Math.ceil(oldText.length * 0.05));
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
async function ensureCheckpoint() {
  if (_checkpointCreated) return;
  _checkpointCreated = true;
  try {
    // Only in git repos with changes
    const { stdout } = await exec('git rev-parse --is-inside-work-tree', { cwd: CWD, timeout: 5000 });
    const isGit = stdout.trim() === 'true';
    if (!isGit) return;
    await exec('git stash push -m "nex-code-checkpoint" --include-untracked', { cwd: CWD, timeout: 10000 });
    await exec('git stash pop', { cwd: CWD, timeout: 10000 });
    await exec('git tag -f nex-checkpoint', { cwd: CWD, timeout: 5000 });
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
  const resolved = path.isAbsolute(p) ? path.resolve(p) : path.resolve(CWD, p);
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
      description: "Read a file's contents with line numbers. Always read a file BEFORE editing it to see exact content. Use line_start/line_end for large files to read specific sections. Prefer this over bash cat/head/tail.",
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
      description: 'Search the web using DuckDuckGo. Returns titles and URLs. Use to find documentation, solutions, or current information beyond your knowledge cutoff.',
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
      name: 'ask_user',
      description: 'Ask the user a question and wait for their response. Use when requirements are ambiguous, you need to choose between approaches, or a decision has significant impact. Do not ask unnecessary questions — proceed if the intent is clear.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to ask the user' },
        },
        required: ['question'],
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
];

// ─── Tool Implementations ─────────────────────────────────────
async function _executeToolInner(name, args, options = {}) {
  switch (name) {
    case 'bash': {
      const cmd = args.command;
      const forbidden = isForbidden(cmd);
      if (forbidden) return `BLOCKED: Command matches forbidden pattern: ${forbidden}`;

      if (isDangerous(cmd) && !options.autoConfirm) {
        console.log(`\n${C.yellow}  ⚠ Dangerous command: ${cmd}${C.reset}`);
        const ok = await confirm('  Execute?');
        if (!ok) return 'CANCELLED: User declined to execute this command.';
      }

      const bashSpinner = options.silent ? null : new Spinner(`Running: ${cmd.substring(0, 60)}${cmd.length > 60 ? '...' : ''}`);
      if (bashSpinner) bashSpinner.start();
      try {
        const { stdout, stderr } = await exec(cmd, {
          cwd: CWD,
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
          console.log(`${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(CWD, fp)}${C.reset}`);
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
          console.log(`${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(CWD, fp)}${C.reset}`);
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
      const grepArgs = ['-rn'];
      if (args.file_pattern) grepArgs.push(`--include=${args.file_pattern}`);
      grepArgs.push(args.pattern, dp);
      try {
        const { stdout } = await execFile('grep', grepArgs, {
          cwd: CWD, timeout: 30000, maxBuffer: 2 * 1024 * 1024,
        });
        const lines = stdout.split('\n').slice(0, 50).join('\n');
        return lines || '(no matches)';
      } catch {
        return '(no matches)';
      }
    }

    case 'glob': {
      const GLOB_LIMIT = 200;
      const basePath = args.path ? resolvePath(args.path) : CWD;
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

      const allFiles = getFileIndex();
      const matches = allFiles
        .filter(f => fullRegex.test(f) || nameRegex.test(path.basename(f)))
        .slice(0, GLOB_LIMIT + 1)
        .map(f => path.join(basePath, f));

      if (matches.length === 0) return '(no matches)';

      const truncated = matches.length > GLOB_LIMIT;
      const result = matches.slice(0, GLOB_LIMIT).join('\n');

      return truncated
        ? `${result}\n\n⚠ Results truncated at ${GLOB_LIMIT}. Use a more specific pattern.`
        : result;
    }

    case 'grep': {
      const searchPath = args.path ? resolvePath(args.path) : CWD;
      const grepArgs2 = ['-rn', '-E']; // Extended regex (supports |, +, etc.)
      if (args.ignore_case) grepArgs2.push('-i');
      if (args.include) grepArgs2.push(`--include=${args.include}`);
      grepArgs2.push('--exclude-dir=node_modules', '--exclude-dir=.git', '--exclude-dir=coverage');
      grepArgs2.push(args.pattern, searchPath);
      try {
        const { stdout } = await execFile('grep', grepArgs2, {
          cwd: CWD, timeout: 30000, maxBuffer: 2 * 1024 * 1024,
        });
        const lines = stdout.split('\n').slice(0, 100).join('\n');
        return lines.trim() || '(no matches)';
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
          console.log(`${C.dim}  ✓ auto-fixed path: ${args.path} → ${path.relative(CWD, fp)}${C.reset}`);
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

    case 'ask_user': {
      const question = args.question;
      return new Promise((resolve) => {
        const rl = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        console.log(`\n${C.cyan}${C.bold}  ? ${question}${C.reset}`);
        rl.question(`${C.cyan}  > ${C.reset}`, (answer) => {
          rl.close();
          resolve(answer.trim() || '(no response)');
        });
      });
    }

    case 'git_status': {
      if (!isGitRepo()) return 'ERROR: Not a git repository';
      const branch = getCurrentBranch() || '(detached)';
      const status = getStatus();
      if (status.length === 0) return `Branch: ${branch}\nClean working tree (no changes)`;
      const lines = [`Branch: ${branch}`, `Changed files (${status.length}):`];
      for (const s of status) {
        const label = s.status === 'M' ? 'modified' : s.status === 'A' ? 'added' : s.status === 'D' ? 'deleted' : s.status === '??' ? 'untracked' : s.status;
        lines.push(`  ${label}: ${s.file}`);
      }
      return lines.join('\n');
    }

    case 'git_diff': {
      if (!isGitRepo()) return 'ERROR: Not a git repository';
      let diff;
      if (args.file) {
        const gitArgs = ['diff'];
        if (args.staged) gitArgs.push('--cached');
        gitArgs.push('--', args.file);
        try {
          diff = execFileSync('git', gitArgs, { cwd: CWD, encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }).trim();
        } catch { diff = ''; }
      } else {
        diff = getDiff(!!args.staged);
      }
      return diff || '(no diff)';
    }

    case 'git_log': {
      if (!isGitRepo()) return 'ERROR: Not a git repository';
      const count = Math.min(args.count || 10, 50);
      const gitLogArgs = ['log', '--oneline', `-${count}`];
      if (args.file) gitLogArgs.push('--', args.file);
      try {
        const out = execFileSync('git', gitLogArgs, { cwd: CWD, encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }).trim();
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

module.exports = { TOOL_DEFINITIONS, executeTool, resolvePath, autoFixPath, autoFixEdit, enrichBashError };

/**
 * cli/tools.js — Tool Definitions + Implementations
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const axios = require('axios');
const { isForbidden, isDangerous, confirm } = require('./safety');
const { showEditDiff, showWriteDiff, showNewFilePreview, confirmFileChange } = require('./diff');
const { C, Spinner, getToolSpinnerText } = require('./ui');
const { isGitRepo, getCurrentBranch, getStatus, getDiff } = require('./git');
const { recordChange } = require('./file-history');

const CWD = process.cwd();

// Auto-checkpoint: tag last known state before first agent edit
let _checkpointCreated = false;
function ensureCheckpoint() {
  if (_checkpointCreated) return;
  _checkpointCreated = true;
  try {
    // Only in git repos with changes
    const isGit = execSync('git rev-parse --is-inside-work-tree', { cwd: CWD, encoding: 'utf-8', stdio: 'pipe' }).trim() === 'true';
    if (!isGit) return;
    execSync('git stash push -m "nex-code-checkpoint" --include-untracked', { cwd: CWD, encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
    execSync('git stash pop', { cwd: CWD, encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
    execSync('git tag -f nex-checkpoint', { cwd: CWD, encoding: 'utf-8', stdio: 'pipe', timeout: 5000 });
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
        const out = execSync(cmd, {
          cwd: CWD,
          timeout: 90000,
          encoding: 'utf-8',
          maxBuffer: 5 * 1024 * 1024,
        });
        if (bashSpinner) bashSpinner.stop();
        return out || '(no output)';
      } catch (e) {
        if (bashSpinner) bashSpinner.stop();
        return `EXIT ${e.status || 1}\n${(e.stderr || e.stdout || e.message || '').toString().substring(0, 5000)}`;
      }
    }

    case 'read_file': {
      const fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      if (!fs.existsSync(fp)) return `ERROR: File not found: ${fp}`;

      // Binary file detection: check first 8KB for null bytes
      const buf = Buffer.alloc(8192);
      const fd = fs.openSync(fp, 'r');
      const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
      fs.closeSync(fd);
      for (let b = 0; b < bytesRead; b++) {
        if (buf[b] === 0) return `ERROR: ${fp} is a binary file (not readable as text)`;
      }

      const content = fs.readFileSync(fp, 'utf-8');
      if (!content && fs.statSync(fp).size > 0) return `WARNING: ${fp} is empty or unreadable`;
      const lines = content.split('\n');
      const start = (args.line_start || 1) - 1;
      const end = args.line_end || lines.length;
      return lines
        .slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n');
    }

    case 'write_file': {
      ensureCheckpoint();
      const fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const exists = fs.existsSync(fp);
      let oldContent = null;

      if (!options.autoConfirm) {
        if (exists) {
          oldContent = fs.readFileSync(fp, 'utf-8');
          showWriteDiff(fp, oldContent, args.content);
          const ok = await confirmFileChange('Overwrite');
          if (!ok) return 'CANCELLED: User declined to overwrite file.';
        } else {
          showNewFilePreview(fp, args.content);
          const ok = await confirmFileChange('Create');
          if (!ok) return 'CANCELLED: User declined to create file.';
        }
      } else if (exists) {
        oldContent = fs.readFileSync(fp, 'utf-8');
      }

      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, args.content, 'utf-8');
      recordChange('write_file', fp, oldContent, args.content);
      return `Written: ${fp} (${args.content.length} chars)`;
    }

    case 'edit_file': {
      ensureCheckpoint();
      const fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      if (!fs.existsSync(fp)) return `ERROR: File not found: ${fp}`;
      const content = fs.readFileSync(fp, 'utf-8');
      if (!content.includes(args.old_text)) return `ERROR: old_text not found in ${fp}`;

      if (!options.autoConfirm) {
        showEditDiff(fp, args.old_text, args.new_text);
        const ok = await confirmFileChange('Apply');
        if (!ok) return 'CANCELLED: User declined to apply edit.';
      }

      // Use split/join for literal replacement (no regex interpretation)
      const updated = content.split(args.old_text).join(args.new_text);
      fs.writeFileSync(fp, updated, 'utf-8');
      recordChange('edit_file', fp, content, updated);
      return `Edited: ${fp}`;
    }

    case 'list_directory': {
      const dp = resolvePath(args.path);
      if (!dp) return `ERROR: Access denied — path outside project: ${args.path}`;
      if (!fs.existsSync(dp)) return `ERROR: Directory not found: ${dp}`;
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

      const walk = (dir, level, prefix) => {
        if (level > depth) return;
        let entries;
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        entries = entries.filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules');
        for (const entry of entries) {
          if (pattern && !entry.isDirectory() && !pattern.test(entry.name)) continue;
          const marker = entry.isDirectory() ? '/' : '';
          result.push(`${prefix}${entry.name}${marker}`);
          if (entry.isDirectory()) walk(path.join(dir, entry.name), level + 1, prefix + '  ');
        }
      };

      walk(dp, 1, '');
      return result.join('\n') || '(empty)';
    }

    case 'search_files': {
      const dp = resolvePath(args.path);
      if (!dp) return `ERROR: Access denied — path outside project: ${args.path}`;
      const grepArgs = ['-rn'];
      if (args.file_pattern) grepArgs.push(`--include=${args.file_pattern}`);
      grepArgs.push(args.pattern, dp);
      try {
        const out = execFileSync('grep', grepArgs, {
          cwd: CWD, timeout: 30000, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024,
        });
        const lines = out.split('\n').slice(0, 50).join('\n');
        return lines || '(no matches)';
      } catch {
        return '(no matches)';
      }
    }

    case 'glob': {
      const GLOB_LIMIT = 200;
      const basePath = args.path ? resolvePath(args.path) : CWD;
      const pattern = args.pattern;
      // Pure Node.js glob: convert glob pattern to regex and walk directory
      const globToRegex = (g) => {
        const escaped = g
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*/g, '__DOUBLESTAR__')
          .replace(/\*/g, '[^/]*')
          .replace(/__DOUBLESTAR__/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(`^${escaped}$`);
      };
      const namePattern = pattern.replace(/\*\*\//g, '').replace(/\//g, '');
      const nameRegex = globToRegex(namePattern);
      const fullRegex = globToRegex(pattern);
      const matches = [];
      let truncated = false;
      const walkGlob = (dir, rel) => {
        if (matches.length >= GLOB_LIMIT) { truncated = true; return; }
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
          if (e.name === 'node_modules' || e.name === '.git') continue;
          const relPath = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) {
            walkGlob(path.join(dir, e.name), relPath);
          } else if (fullRegex.test(relPath) || nameRegex.test(e.name)) {
            matches.push(path.join(basePath, relPath));
          }
          if (matches.length >= GLOB_LIMIT) { truncated = true; return; }
        }
      };
      walkGlob(basePath, '');
      if (matches.length === 0) return '(no matches)';
      const result = matches.join('\n');
      return truncated ? `${result}\n\n⚠ Results truncated at ${GLOB_LIMIT}. Use a more specific pattern to narrow results.` : result;
    }

    case 'grep': {
      const searchPath = args.path ? resolvePath(args.path) : CWD;
      const grepArgs2 = ['-rn'];
      if (args.ignore_case) grepArgs2.push('-i');
      if (args.include) grepArgs2.push(`--include=${args.include}`);
      grepArgs2.push(args.pattern, searchPath);
      try {
        const out = execFileSync('grep', grepArgs2, {
          cwd: CWD, timeout: 30000, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024,
        });
        const lines = out.split('\n').slice(0, 100).join('\n');
        return lines.trim() || '(no matches)';
      } catch {
        return '(no matches)';
      }
    }

    case 'patch_file': {
      ensureCheckpoint();
      const fp = resolvePath(args.path);
      if (!fp) return `ERROR: Access denied — path outside project: ${args.path}`;
      if (!fs.existsSync(fp)) return `ERROR: File not found: ${fp}`;

      const patches = args.patches;
      if (!Array.isArray(patches) || patches.length === 0) return 'ERROR: No patches provided';

      let content = fs.readFileSync(fp, 'utf-8');

      // Validate all patches first
      for (let i = 0; i < patches.length; i++) {
        const { old_text } = patches[i];
        if (!content.includes(old_text)) {
          return `ERROR: Patch ${i + 1} old_text not found in ${fp}`;
        }
      }

      // Apply to a copy first (atomic — validate all patches succeed before writing)
      let preview = content;
      for (const { old_text, new_text } of patches) {
        preview = preview.split(old_text).join(new_text);
      }
      if (!options.autoConfirm) {
        showEditDiff(fp, content, preview);
        const ok = await confirmFileChange('Apply patches');
        if (!ok) return 'CANCELLED: User declined to apply patches.';
      }

      // Write the fully-validated preview (atomic — no partial application)
      fs.writeFileSync(fp, preview, 'utf-8');
      recordChange('patch_file', fp, content, preview);
      return `Patched: ${fp} (${patches.length} replacements)`;
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
      const { createTasks, updateTask, getTaskList, renderTaskList } = require('./tasks');
      switch (args.action) {
        case 'create': {
          if (!args.name || !args.tasks) return 'ERROR: task_list create requires name and tasks';
          const created = createTasks(args.name, args.tasks);
          console.log('\n' + renderTaskList());
          return `Created task list "${args.name}" with ${created.length} tasks:\n` +
            created.map(t => `  ${t.id}: ${t.description}`).join('\n');
        }
        case 'update': {
          if (!args.task_id || !args.status) return 'ERROR: task_list update requires task_id and status';
          const updated = updateTask(args.task_id, args.status, args.result);
          if (!updated) return `ERROR: Task not found: ${args.task_id}`;
          console.log('\n' + renderTaskList());
          return `Updated ${args.task_id}: ${args.status}${args.result ? ' — ' + args.result : ''}`;
        }
        case 'get': {
          const list = getTaskList();
          if (list.tasks.length === 0) return 'No active tasks';
          console.log('\n' + renderTaskList());
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

module.exports = { TOOL_DEFINITIONS, executeTool, resolvePath };

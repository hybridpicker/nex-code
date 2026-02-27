/**
 * cli/tools.js — Tool Definitions + Implementations
 */

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const axios = require('axios');
const { isForbidden, isDangerous, confirm } = require('./safety');
const { showEditDiff, showWriteDiff, showNewFilePreview, confirmFileChange } = require('./diff');
const { C } = require('./ui');

const CWD = process.cwd();

function resolvePath(p) {
  if (path.isAbsolute(p)) return p;
  return path.resolve(CWD, p);
}

// ─── Tool Definitions (Ollama format) ─────────────────────────
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'bash',
      description:
        'Execute a bash command in the project directory. Max timeout 90s. Use for running tests, installing packages, git commands, etc.',
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
      description: "Read a file's contents. Supports optional line range.",
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
      description: 'Create or overwrite a file with the given content.',
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
      description: 'Replace specific text in a file. old_text must match exactly (including whitespace).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          old_text: { type: 'string', description: 'Exact text to find' },
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
      description: 'List files and directories in a tree view.',
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
      description: 'Search for a text pattern in files (like grep). Returns matching lines with file paths.',
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
      description: 'Find files matching a glob pattern. Fast file search by name/extension.',
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
      description: 'Search file contents with regex. Returns matching lines with file paths and line numbers.',
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
      description: 'Apply multiple text replacements to a file in a single operation. Each replacement has old_text and new_text.',
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
      description: 'Fetch content from a URL. Returns the text content of the page.',
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
      description: 'Search the web using DuckDuckGo. Returns search results with titles and snippets.',
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
      description: 'Ask the user a question and wait for their response. Use when you need clarification or confirmation.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to ask the user' },
        },
        required: ['question'],
      },
    },
  },
];

// ─── Tool Implementations ─────────────────────────────────────
async function executeTool(name, args) {
  switch (name) {
    case 'bash': {
      const cmd = args.command;
      const forbidden = isForbidden(cmd);
      if (forbidden) return `BLOCKED: Command matches forbidden pattern: ${forbidden}`;

      if (isDangerous(cmd)) {
        console.log(`\n${C.yellow}  ⚠ Dangerous command: ${cmd}${C.reset}`);
        const ok = await confirm('  Execute?');
        if (!ok) return 'CANCELLED: User declined to execute this command.';
      }

      try {
        const out = execSync(cmd, {
          cwd: CWD,
          timeout: 90000,
          encoding: 'utf-8',
          maxBuffer: 5 * 1024 * 1024,
        });
        return out || '(no output)';
      } catch (e) {
        return `EXIT ${e.status || 1}\n${(e.stderr || e.stdout || e.message || '').toString().substring(0, 5000)}`;
      }
    }

    case 'read_file': {
      const fp = resolvePath(args.path);
      if (!fs.existsSync(fp)) return `ERROR: File not found: ${fp}`;
      const content = fs.readFileSync(fp, 'utf-8');
      const lines = content.split('\n');
      const start = (args.line_start || 1) - 1;
      const end = args.line_end || lines.length;
      return lines
        .slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n');
    }

    case 'write_file': {
      const fp = resolvePath(args.path);
      const exists = fs.existsSync(fp);

      if (exists) {
        const oldContent = fs.readFileSync(fp, 'utf-8');
        showWriteDiff(fp, oldContent, args.content);
        const ok = await confirmFileChange('Overwrite');
        if (!ok) return 'CANCELLED: User declined to overwrite file.';
      } else {
        showNewFilePreview(fp, args.content);
        const ok = await confirmFileChange('Create');
        if (!ok) return 'CANCELLED: User declined to create file.';
      }

      const dir = path.dirname(fp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(fp, args.content, 'utf-8');
      return `Written: ${fp} (${args.content.length} chars)`;
    }

    case 'edit_file': {
      const fp = resolvePath(args.path);
      if (!fs.existsSync(fp)) return `ERROR: File not found: ${fp}`;
      const content = fs.readFileSync(fp, 'utf-8');
      if (!content.includes(args.old_text)) return `ERROR: old_text not found in ${fp}`;

      showEditDiff(fp, args.old_text, args.new_text);
      const ok = await confirmFileChange('Apply');
      if (!ok) return 'CANCELLED: User declined to apply edit.';

      const updated = content.replace(args.old_text, args.new_text);
      fs.writeFileSync(fp, updated, 'utf-8');
      return `Edited: ${fp}`;
    }

    case 'list_directory': {
      const dp = resolvePath(args.path);
      if (!fs.existsSync(dp)) return `ERROR: Directory not found: ${dp}`;
      const depth = args.max_depth || 2;
      const pattern = args.pattern ? new RegExp(args.pattern.replace(/\*/g, '.*')) : null;
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
      const walkGlob = (dir, rel) => {
        if (matches.length >= 100) return;
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
          if (matches.length >= 100) return;
        }
      };
      walkGlob(basePath, '');
      return matches.join('\n') || '(no matches)';
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
      const fp = resolvePath(args.path);
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

      // Show combined diff
      let preview = content;
      for (const { old_text, new_text } of patches) {
        preview = preview.replace(old_text, new_text);
      }
      showEditDiff(fp, content, preview);
      const ok = await confirmFileChange('Apply patches');
      if (!ok) return 'CANCELLED: User declined to apply patches.';

      // Apply all patches
      for (const { old_text, new_text } of patches) {
        content = content.replace(old_text, new_text);
      }
      fs.writeFileSync(fp, content, 'utf-8');
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

    default:
      return `ERROR: Unknown tool: ${name}`;
  }
}

module.exports = { TOOL_DEFINITIONS, executeTool, resolvePath };

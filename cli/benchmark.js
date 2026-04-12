"use strict";

/**
 * cli/benchmark.js — nex-code Model Benchmark
 *
 * Tests Ollama Cloud models against nex-code's real tool schemas.
 * Metrics: tool-call rate, tool name accuracy, argument validity, schema compliance.
 *
 * Usage:
 *   const { runBenchmark } = require('./benchmark');
 *   const ranking = await runBenchmark({ quick: true, onProgress: cb });
 */

const { C } = require("./ui");
const registry = require("./providers/registry");
const { TOOL_DEFINITIONS } = require("./tools");
const { saveRoutingConfig } = require("./task-router");

// ─── Task Definitions ─────────────────────────────────────────────────────────
// Each task mirrors a real nex-code workflow.
// expectedTool: null → model should NOT call a tool (pure reasoning).

function searchNeedle(args) {
  return [
    args?.pattern,
    args?.query,
    args?.regex,
    args?.file_pattern,
    args?.include,
    args?.path,
    args?.command,
  ]
    .filter((v) => typeof v === "string")
    .join(" ");
}

function matchesEditArgs(args, { pathIncludes = [], oldTexts = [], newTexts = [] } = {}) {
  if (typeof args?.path !== "string") return false;

  const pathOk =
    pathIncludes.length === 0 ||
    pathIncludes.some((needle) => args.path.toLowerCase().includes(needle.toLowerCase()));
  if (!pathOk) return false;

  const patchTexts = Array.isArray(args.patches)
    ? args.patches.flatMap((p) => [p.old_text, p.new_text]).filter((v) => typeof v === "string")
    : [];
  const oldText = typeof args.old_text === "string" ? args.old_text : "";
  const newText = typeof args.new_text === "string" ? args.new_text : "";
  const allTexts = [oldText, newText, ...patchTexts];

  const oldOk =
    oldTexts.length === 0 ||
    oldTexts.some((needle) => allTexts.some((text) => text.includes(needle)));
  const newOk =
    newTexts.length === 0 ||
    newTexts.some((needle) => allTexts.some((text) => text.includes(needle)));

  if (!oldOk || !newOk) return false;

  if (oldText && newText) return true;
  return Array.isArray(args.patches) && args.patches.length > 0;
}

function matchesWriteArgs(args, { pathIncludes = [], contentIncludes = [] } = {}) {
  if (typeof args?.path !== "string" || typeof args?.content !== "string") {
    return false;
  }

  const pathOk =
    pathIncludes.length === 0 ||
    pathIncludes.some((needle) => args.path.toLowerCase().includes(needle.toLowerCase()));
  if (!pathOk) return false;

  return (
    contentIncludes.length === 0 ||
    contentIncludes.every((needle) => args.content.includes(needle))
  );
}

const TASKS = [
  // ── File operations ─────────────────────────────────────────────────────
  {
    id: "read-package",
    category: "file-ops",
    prompt: "Read the file package.json and show me its contents.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("package.json"),
  },
  {
    id: "write-file",
    category: "file-ops",
    prompt:
      'Create a file at /tmp/nex-bench-test.txt with the content "benchmark run".',
    expectedTool: "write_file",
    validateArgs: (args) =>
      matchesWriteArgs(args, {
        pathIncludes: ["nex-bench-test.txt"],
        contentIncludes: ["benchmark run"],
      }),
  },
  {
    id: "edit-file",
    category: "file-ops",
    prompt:
      'You already read src/config.js and confirmed it contains the exact text "debug: false". Replace that exact text with "debug: true".',
    expectedTool: ["edit_file", "patch_file"],
    validateArgs: (args) =>
      matchesEditArgs(args, {
        pathIncludes: ["config"],
        oldTexts: ["debug: false"],
        newTexts: ["debug: true"],
      }),
  },
  {
    id: "list-directory",
    category: "file-ops",
    prompt: "Show me all files and folders in the cli/ directory.",
    expectedTool: ["list_directory", "glob"],
    validateArgs: (args) => {
      if (typeof args.path === "string" && args.path.includes("cli"))
        return true;
      if (typeof args.pattern === "string" && args.pattern.includes("cli"))
        return true;
      return false;
    },
  },
  {
    id: "glob-js-files",
    category: "file-ops",
    prompt:
      "Find all JavaScript files (*.js) recursively in the cli/ directory.",
    expectedTool: "glob",
    validateArgs: (args) =>
      typeof args.pattern === "string" && args.pattern.includes(".js"),
  },

  // ── Targeted file-ops (arg accuracy) ────────────────────────────────────
  {
    id: "read-partial",
    category: "file-ops",
    prompt:
      "Read only lines 20 to 40 of src/index.js — I need to see that specific range.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" &&
      args.path.includes("index") &&
      typeof args.line_start === "number" &&
      typeof args.line_end === "number",
  },
  {
    id: "glob-ts-defs",
    category: "file-ops",
    prompt:
      "Find all TypeScript type definition files (*.d.ts) anywhere in the project.",
    expectedTool: "glob",
    validateArgs: (args) =>
      typeof args.pattern === "string" && args.pattern.includes(".d.ts"),
  },
  {
    id: "write-gitignore",
    category: "file-ops",
    prompt:
      "Create a .gitignore file at the project root that ignores node_modules/ and dist/.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      matchesWriteArgs(args, {
        pathIncludes: [".gitignore"],
        contentIncludes: ["node_modules", "dist"],
      }),
  },
  {
    id: "edit-version-bump",
    category: "file-ops",
    prompt:
      'You already read package.json and confirmed it contains the exact snippet `"version": "1.0.0"`. Update it to `"version": "1.1.0"`.',
    expectedTool: ["edit_file", "patch_file"],
    validateArgs: (args) =>
      matchesEditArgs(args, {
        pathIncludes: ["package"],
        oldTexts: ['"version": "1.0.0"'],
        newTexts: ['"version": "1.1.0"'],
      }),
  },

  // ── Search ───────────────────────────────────────────────────────────────
  {
    id: "grep-with-filter",
    category: "search",
    prompt:
      "Search for all calls to require() but only inside .js files in the cli/ directory.",
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("require");
    },
  },
  {
    id: "no-tool-http-port",
    category: "reasoning",
    prompt: "What is the default port used by the HTTP protocol?",
    expectedTool: null,
    validateArgs: () => true,
  },
  {
    id: "bash-node-version",
    category: "shell",
    prompt: "Check which version of Node.js is currently installed on this system.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      args.command.includes("node") &&
      (args.command.includes("--version") || args.command.includes("-v")),
  },

  // ── Search ───────────────────────────────────────────────────────────────
  {
    id: "search-constant",
    category: "search",
    prompt:
      'Search for the string "DEFAULT_MODEL" across all files in the project.',
    expectedTool: ["search_files", "grep"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("DEFAULT_MODEL");
    },
  },
  {
    id: "grep-function-def",
    category: "search",
    prompt: 'Find where the function "callStream" is defined in the codebase.',
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("callStream");
    },
  },
  {
    id: "search-todos",
    category: "search",
    prompt: "Find all TODO comments in the source code.",
    expectedTool: ["grep", "search_files", "bash"],
    validateArgs: (args) => JSON.stringify(args).toUpperCase().includes("TODO"),
  },

  // ── Shell / bash ─────────────────────────────────────────────────────────
  {
    id: "git-branch",
    category: "shell",
    prompt: "What git branch am I currently on?",
    expectedTool: ["bash", "git_status"],
    validateArgs: (args) => {
      if (typeof args.command === "string" && args.command.includes("git")) return true;
      // git_status tool returns branch info
      return true;
    },
  },
  {
    id: "git-status",
    category: "shell",
    prompt: "Show me the current git status of the repository.",
    expectedTool: ["bash", "git_status"],
    validateArgs: (args) => {
      if (typeof args.command === "string" && args.command.includes("git status")) return true;
      // git_status tool is the native equivalent
      return true;
    },
  },
  {
    id: "npm-install",
    category: "shell",
    prompt: "Run npm install to install project dependencies.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" && args.command.includes("npm"),
  },

  // ── Schema compliance ─────────────────────────────────────────────────────
  {
    id: "schema-strict",
    category: "schema",
    prompt: "Read the file README.md",
    expectedTool: "read_file",
    validateArgs: (args, toolDef) => {
      const schema = toolDef?.function?.parameters || {};
      const required = schema.required || [];
      const known = Object.keys(schema.properties || {});
      return (
        required.every((r) => args[r] !== undefined) &&
        Object.keys(args).every((k) => known.includes(k))
      );
    },
  },

  // ── Multi-step coherence ──────────────────────────────────────────────────
  {
    id: "multi-step-version",
    category: "multi-step",
    prompt:
      "You need to determine the current project version. What tool do you call first to inspect the most likely source file?",
    expectedTool: ["read_file", "glob", "list_directory"],
    validateArgs: (args) => {
      if (typeof args.path === "string" && /package|version/i.test(args.path))
        return true;
      if (typeof args.pattern === "string" && /package\.json|package|version/i.test(args.pattern))
        return true;
      return false;
    },
  },
  {
    id: "multi-step-count",
    category: "multi-step",
    prompt: "How many JavaScript files are in the cli/ directory? Count them.",
    expectedTool: ["bash", "glob", "list_directory"],
    validateArgs: (args) => {
      if (typeof args.command === "string" && args.command.includes("cli"))
        return true;
      if (typeof args.pattern === "string" && args.pattern.includes("cli"))
        return true;
      if (typeof args.path === "string" && args.path.includes("cli"))
        return true;
      return false;
    },
  },

  // ── Negative: should NOT call a tool ──────────────────────────────────────
  {
    id: "no-tool-reasoning",
    category: "reasoning",
    prompt: 'What does the acronym "API" stand for?',
    expectedTool: null,
    validateArgs: () => true,
  },

  // ── Frontend ──────────────────────────────────────────────────────────────
  {
    id: "frontend-find-hook",
    category: "frontend",
    prompt: "Find all files that import useState from React.",
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("useState");
    },
  },
  {
    id: "frontend-create-component",
    category: "frontend",
    prompt:
      "There is no existing Button component and no need to inspect other files first. What tool call do you use first to create src/components/Button.jsx with a React functional Button component that accepts a label prop and renders a styled button element?",
    expectedTool: "write_file",
    validateArgs: (args) =>
      matchesWriteArgs(args, {
        pathIncludes: ["button.", "src/components"],
        contentIncludes: ["Button", "label", "button"],
      }),
  },
  {
    id: "frontend-edit-css",
    category: "frontend",
    prompt:
      'You already read src/styles.css and confirmed it contains the exact text `background-color: blue`. Change that exact value to `background-color: red`.',
    expectedTool: ["edit_file", "patch_file"],
    validateArgs: (args) =>
      matchesEditArgs(args, {
        pathIncludes: [".css", "styles"],
        oldTexts: ["background-color: blue"],
        newTexts: ["background-color: red"],
      }),
  },
  {
    id: "frontend-glob-components",
    category: "frontend",
    prompt:
      "Find all JSX and TSX component files in the components/ directory.",
    expectedTool: "glob",
    validateArgs: (args) =>
      typeof args.pattern === "string" &&
      (args.pattern.includes(".jsx") ||
        args.pattern.includes(".tsx") ||
        args.pattern.includes("{jsx,tsx}")),
  },
  {
    id: "frontend-list-assets",
    category: "frontend",
    prompt: "List all files in the src/assets/ directory.",
    expectedTool: ["list_directory", "glob"],
    validateArgs: (args) => {
      if (typeof args.path === "string" && args.path.includes("assets"))
        return true;
      if (typeof args.pattern === "string" && args.pattern.includes("assets"))
        return true;
      return false;
    },
  },

  // ── Sysadmin ──────────────────────────────────────────────────────────────
  {
    id: "sysadmin-port-check",
    category: "sysadmin",
    prompt: "Which process is currently listening on port 3000?",
    expectedTool: ["bash", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          args.command.includes("lsof") ||
          args.command.includes("ss") ||
          args.command.includes("netstat") ||
          args.command.includes("3000")
        );
      }
      return args.action === "network_status";
    },
  },
  {
    id: "sysadmin-nginx-config",
    category: "sysadmin",
    prompt:
      "Create an nginx server block that proxies requests to localhost:3000. Save it to /etc/nginx/sites-available/myapp.",
    expectedTool: ["write_file", "bash"],
    validateArgs: (args) => {
      if (
        args.path &&
        (args.path.includes("nginx") || args.path.includes("sites-available"))
      )
        return true;
      if (args.command && args.command.includes("nginx")) return true;
      return false;
    },
  },
  {
    id: "sysadmin-service-status",
    category: "sysadmin",
    prompt: "Check the status of the nginx service and show if it is running.",
    expectedTool: ["bash", "service_manage", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          args.command.includes("systemctl") ||
          args.command.includes("service") ||
          args.command.includes("nginx")
        );
      }
      if (args.action === "status" && typeof args.service === "string") {
        return args.service.includes("nginx");
      }
      return (
        args.action === "service" &&
        args.service_action === "status" &&
        typeof args.service_name === "string" &&
        args.service_name.includes("nginx")
      );
    },
  },
  {
    id: "sysadmin-error-log",
    category: "sysadmin",
    prompt: "Show the last 100 lines of the nginx error log.",
    expectedTool: ["bash", "service_logs", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          args.command.includes("tail") ||
          args.command.includes("journalctl") ||
          args.command.includes("nginx")
        );
      }
      if (typeof args.service === "string") return args.service.includes("nginx");
      return (
        (args.action === "journalctl" && typeof args.unit === "string" && args.unit.includes("nginx")) ||
        (args.action === "log_tail" && typeof args.path === "string" && /nginx|error/i.test(args.path))
      );
    },
  },
  {
    id: "sysadmin-docker-compose",
    category: "sysadmin",
    prompt:
      "Create a docker-compose.yml file for a Node.js application with a PostgreSQL database.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      typeof args.path === "string" &&
      args.path.includes("docker-compose") &&
      typeof args.content === "string",
  },

  // ── Data ──────────────────────────────────────────────────────────────────
  {
    id: "data-sql-query",
    category: "data",
    prompt:
      "Write a SQL query to find all users who have not logged in for more than 30 days. Save it to queries/inactive-users.sql.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      matchesWriteArgs(args, {
        pathIncludes: ["inactive-users.sql", "queries"],
        contentIncludes: ["select", "users"],
      }),
  },
  {
    id: "data-find-json-key",
    category: "data",
    prompt: 'Find all JSON files in the project that contain the key "userId".',
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return pat.includes("userId");
    },
  },
  {
    id: "data-python-csv",
    category: "data",
    prompt:
      'There is no need to inspect the repo first. What tool call do you use first to create scripts/average_price.py with a Python script that reads data.csv and calculates the average of the "price" column?',
    expectedTool: "write_file",
    validateArgs: (args) =>
      matchesWriteArgs(args, {
        pathIncludes: ["average_price.py", "scripts"],
        contentIncludes: ["data.csv", "price"],
      }),
  },
  {
    id: "data-find-migrations",
    category: "data",
    prompt: "Find all database migration files in this project.",
    expectedTool: ["glob", "search_files", "grep"],
    validateArgs: (args) => {
      const hay = JSON.stringify(args).toLowerCase();
      return hay.includes("migrat");
    },
  },
  {
    id: "data-find-schema",
    category: "data",
    prompt: "Find where the database schema or models are defined in this project.",
    expectedTool: ["grep", "glob", "search_files"],
    validateArgs: (args) => {
      return /schema|model|migration|prisma|dbml/i.test(searchNeedle(args));
    },
  },
  {
    id: "data-write-query",
    category: "data",
    prompt: "Write a SQL query to find all users who registered in the last 30 days and save it to queries/recent-users.sql.",
    expectedTool: "write_file",
    validateArgs: (args) =>
      matchesWriteArgs(args, {
        pathIncludes: ["recent-users.sql", "queries"],
        contentIncludes: ["select", "users"],
      }),
  },
  {
    id: "data-read-env",
    category: "data",
    prompt: "Read the .env file to find the database connection string.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && /\.env|env\./i.test(args.path),
  },

  // ── Resilience — error recovery & robustness ──────────────────────────────
  // These tasks simulate real failure scenarios that nex-code encounters in
  // production. The correct response is always a targeted recovery action.
  {
    id: "resilience-edit-failed",
    category: "resilience",
    prompt:
      "Your edit_file call on server.js failed: old_string 'const PORT = 3000' was not found in the file. What do you do next to recover?",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("server"),
  },
  {
    id: "resilience-file-not-found",
    category: "resilience",
    prompt:
      "read_file returned 'file not found' for src/utils/helpers.js. You need to find where the helper functions are now. What tool do you use?",
    expectedTool: ["glob", "bash", "search_files"],
    validateArgs: (args) => {
      const s = JSON.stringify(args).toLowerCase();
      return s.includes("src") || s.includes("helper") || s.includes("util") || s.includes("*.js");
    },
  },
  {
    id: "resilience-large-file-nav",
    category: "resilience",
    prompt:
      "The file src/api.js is 2800 lines. You need to locate the authenticateUser function. What is the most efficient tool to use — read_file or bash with grep?",
    expectedTool: ["bash", "grep", "search_files"],
    validateArgs: (args) => {
      if (typeof args.command === "string" &&
        (args.command.includes("grep") || args.command.includes("rg") || args.command.includes("awk")))
        return true;
      const pat = args.pattern || args.query || args.regex || "";
      if (/authenticateUser/i.test(pat)) return true;
      return false;
    },
  },
  {
    id: "resilience-broken-import",
    category: "resilience",
    prompt:
      "TypeScript reports: Cannot find module './config'. The file was recently renamed. What tool do you use to find the new location?",
    expectedTool: ["glob", "bash", "search_files"],
    validateArgs: (args) => {
      const s = JSON.stringify(args).toLowerCase();
      return s.includes("config") || s.includes("*.ts") || s.includes("*.js") || s.includes("find");
    },
  },
  {
    id: "resilience-bash-error-recover",
    category: "resilience",
    prompt:
      "The command 'npm test' failed with exit code 1. The output contains 'SyntaxError: Unexpected token' in src/parser.js:45. What is your next action?",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("parser"),
  },
  {
    id: "resilience-grep-no-match",
    category: "resilience",
    prompt:
      "grep returned zero matches for 'getUserById' in src/. The function exists but may have been renamed. What bash command finds all exported function names in src/ to identify the current name?",
    expectedTool: ["bash", "grep", "search_files"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          args.command.includes("grep") ||
          args.command.includes("rg") ||
          args.command.includes("src")
        );
      }
      return /getUserById|export|function|src/i.test(searchNeedle(args));
    },
  },

  // ── SSH ───────────────────────────────────────────────────────────────────
  {
    id: "ssh-exec-log",
    category: "ssh",
    prompt:
      'Show the last 50 lines of /var/log/nginx/error.log on server "prod-1".',
    expectedTool: ["ssh_exec", "service_logs", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          (args.command.includes("tail") || args.command.includes("log")) &&
          typeof args.server === "string"
        );
      }
      if (typeof args.service === "string") return args.service.includes("nginx");
      return (
        typeof args.server === "string" &&
        ((args.action === "journalctl" && typeof args.unit === "string" && args.unit.includes("nginx")) ||
          (args.action === "log_tail" && typeof args.path === "string" && /nginx|error/i.test(args.path)))
      );
    },
  },
  {
    id: "ssh-exec-service",
    category: "ssh",
    prompt: 'Restart the nginx service on server "prod-1".',
    expectedTool: ["ssh_exec", "service_manage", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          (args.command.includes("nginx") ||
            args.command.includes("systemctl") ||
            args.command.includes("restart")) &&
          typeof args.server === "string"
        );
      }
      if (
        args.action === "restart" &&
        typeof args.service === "string" &&
        args.service.includes("nginx")
      ) {
        return true;
      }
      return (
        args.action === "service" &&
        args.service_action === "restart" &&
        typeof args.service_name === "string" &&
        args.service_name.includes("nginx") &&
        typeof args.server === "string"
      );
    },
  },
  {
    id: "ssh-exec-port",
    category: "ssh",
    prompt: 'Check if port 8080 is listening on server "prod-1".',
    expectedTool: ["ssh_exec", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          (args.command.includes("8080") ||
            args.command.includes("ss") ||
            args.command.includes("netstat") ||
            args.command.includes("lsof")) &&
          typeof args.server === "string"
        );
      }
      return args.action === "network_status" && typeof args.server === "string";
    },
  },
  {
    id: "ssh-exec-processes",
    category: "ssh",
    prompt: 'Show the top CPU-consuming processes on server "prod-1".',
    expectedTool: ["ssh_exec", "sysadmin"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          (args.command.includes("top") ||
            args.command.includes("ps") ||
            args.command.includes("htop")) &&
          typeof args.server === "string"
        );
      }
      return args.action === "process_list" && typeof args.server === "string";
    },
  },

  // ── Git (native tools) ────────────────────────────────────────────────────
  {
    id: "git-diff-staged",
    category: "git",
    prompt: "Show all staged changes before committing.",
    expectedTool: ["git_diff", "bash"],
    validateArgs: (args) => {
      if (args.staged === true || args.staged === "true") return true;
      if (typeof args.command === "string" && args.command.includes("diff"))
        return true;
      return false;
    },
  },
  {
    id: "git-log-recent",
    category: "git",
    prompt: "Show the last 5 commit messages with their hashes.",
    expectedTool: ["git_log", "bash"],
    validateArgs: (args) => {
      if (
        typeof args.count === "number" ||
        typeof args.limit === "number" ||
        typeof args.n === "number"
      )
        return true;
      if (typeof args.command === "string" && args.command.includes("log"))
        return true;
      return false;
    },
  },
  {
    id: "git-status-check",
    category: "git",
    prompt: "Check if there are any uncommitted changes in the repository.",
    expectedTool: ["git_status", "bash"],
    validateArgs: (args) => {
      if (Object.keys(args || {}).length === 0) return true;
      if (typeof args.command === "string" && args.command.includes("status"))
        return true;
      return true; // git_status takes no required args
    },
  },

  // ── Agentic ───────────────────────────────────────────────────────────────
  {
    id: "agentic-test-first",
    category: "agentic",
    prompt:
      "Run the full test suite. If any tests fail, identify the failing test file and read it to understand the issue.",
    expectedTool: ["bash", "task_list"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return (
          args.command.includes("test") ||
          args.command.includes("jest") ||
          args.command.includes("npm")
        );
      }
      const hay = searchNeedle(args);
      return args.action === "create" && /test|failing|read/i.test(hay);
    },
  },
  {
    id: "agentic-read-then-act",
    category: "agentic",
    prompt:
      "Read the project README.md, find the TODO section, and list which items are completed.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && args.path.includes("README"),
  },
  {
    id: "agentic-build-deploy",
    category: "agentic",
    prompt:
      "Build the project with npm run build, then verify the output exists in the dist/ directory.",
    expectedTool: ["bash", "task_list"],
    validateArgs: (args) => {
      if (typeof args.command === "string") {
        return args.command.includes("build") || args.command.includes("npm");
      }
      const hay = searchNeedle(args);
      return args.action === "create" && /build|dist/i.test(hay);
    },
  },
  {
    id: "agentic-spawn-parallel",
    category: "agentic",
    prompt:
      "Search for all TODO comments and all FIXME comments across the codebase in parallel using multiple agents.",
    expectedTool: "spawn_agents",
    validateArgs: (args) =>
      Array.isArray(args.agents) && args.agents.length >= 2,
  },
  {
    id: "agentic-multi-investigate",
    category: "agentic",
    prompt:
      "The app is crashing on startup. Spawn parallel agents to check: (1) recent git changes, (2) npm dependency issues, (3) the main entry file for syntax errors.",
    expectedTool: "spawn_agents",
    validateArgs: (args) =>
      Array.isArray(args.agents) && args.agents.length >= 2,
  },
];

// ─── Phase-specific tasks: measure model suitability for plan/verify phases ──
const PHASE_TASKS = [
  {
    id: "phase-plan-diagnosis",
    category: "phase-plan",
    prompt:
      "The server returns 500 on /api/users. The error log shows: TypeError: Cannot read property 'map' of undefined at routes/users.js:42. Read the relevant file to diagnose the root cause.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && /users/i.test(args.path),
  },
  {
    id: "phase-plan-search",
    category: "phase-plan",
    prompt:
      "We're getting CORS errors in production. Search the codebase for where CORS middleware is configured.",
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return /cors/i.test(pat);
    },
  },
  {
    id: "phase-plan-context",
    category: "phase-plan",
    prompt:
      "The login page shows a blank screen after the last deploy. Check git log for recent changes that might have broken it.",
    expectedTool: ["git_log", "bash"],
    validateArgs: (args) => {
      if (typeof args.command === "string" && args.command.includes("log")) return true;
      return true; // git_log tool is always valid here
    },
  },
  {
    id: "phase-verify-test",
    category: "phase-verify",
    prompt:
      "You are explicitly in the verify phase. What tool call do you use first to run tests for a fix in src/utils.js?",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      /test|jest|npm\s+test|pytest|mocha/.test(args.command),
  },
  {
    id: "phase-verify-read",
    category: "phase-verify",
    prompt:
      "A patch was applied to config/database.js to fix the connection pool. Read the file to verify the changes look correct.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && /database/i.test(args.path),
  },
  {
    id: "phase-verify-lint",
    category: "phase-verify",
    prompt:
      "You are explicitly in the verify phase. What tool call do you use first to run linting after changes in src/components/Header.tsx?",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      /lint|eslint|prettier|tsc/.test(args.command),
  },
  {
    id: "phase-plan-git-blame",
    category: "phase-plan",
    prompt: "A production bug was introduced 2 days ago. Use git log to find commits from the last 2 days to identify what changed.",
    expectedTool: ["git_log", "bash"],
    validateArgs: (args) => {
      if (typeof args.command === "string" && args.command.includes("log")) return true;
      return true; // git_log tool is always valid here
    },
  },
  {
    id: "phase-plan-error-trace",
    category: "phase-plan",
    prompt: "The error stack trace mentions src/middleware/auth.js line 87. Read the file around that line to understand the bug.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && /auth/i.test(args.path),
  },
  {
    id: "phase-plan-grep-config",
    category: "phase-plan",
    prompt: "Users report the app is using wrong API keys in staging. Search for where API_KEY is loaded from environment.",
    expectedTool: ["grep", "search_files"],
    validateArgs: (args) => {
      const pat = args.pattern || args.query || args.regex || "";
      return /api.?key|env/i.test(pat);
    },
  },
  {
    id: "phase-verify-build",
    category: "phase-verify",
    prompt: "The TypeScript source was modified. Run the build command to verify there are no compilation errors.",
    expectedTool: "bash",
    validateArgs: (args) =>
      typeof args.command === "string" &&
      /build|tsc|compile/.test(args.command),
  },
  {
    id: "phase-verify-git-diff",
    category: "phase-verify",
    prompt: "Changes were just committed. Show the git diff of the last commit to verify only the intended files were modified.",
    expectedTool: ["git_diff", "bash"],
    validateArgs: (args) => {
      if (args.command && /git.*diff|diff.*HEAD/.test(args.command)) return true;
      return true; // git_diff tool is always valid here
    },
  },
  {
    id: "phase-verify-read-config",
    category: "phase-verify",
    prompt: "The deployment config was updated. Read config/production.json to verify the changes are correct before deploying.",
    expectedTool: "read_file",
    validateArgs: (args) =>
      typeof args.path === "string" && /config|production|deploy/i.test(args.path),
  },
];

const ALL_TASKS = [...TASKS, ...PHASE_TASKS];

// Hardcoded seed list — used only when no benchmark-results.json exists yet.
// After the first /benchmark --all run this list is superseded by saved results.
const _DEFAULT_MODELS_SEED = [
  "devstral-2:123b",
  "kimi-k2.5",
  "glm-5:cloud",
  "qwen3-coder:480b",
  "qwen3-coder-next",
  "ministral-3:14b",
  "minimax-m2.7:cloud",
  "kimi-k2:1t",
];

/**
 * Build DEFAULT_MODELS dynamically from saved benchmark results.
 * Returns models that scored ≥ MIN_SCORE, capped at MAX_MODELS, sorted by score.
 * Falls back to the hardcoded seed list if no results file exists.
 */
function _loadDefaultModels() {
  const MIN_SCORE = 60;
  const MAX_MODELS = 12;
  try {
    const p = require("path").join(
      require("os").homedir(),
      ".nex-code",
      "benchmark-results.json",
    );
    if (!require("fs").existsSync(p)) return _DEFAULT_MODELS_SEED;
    const saved = JSON.parse(require("fs").readFileSync(p, "utf-8"));
    if (!Array.isArray(saved) || saved.length === 0) return _DEFAULT_MODELS_SEED;
    return saved
      .filter((r) => typeof r.score === "number" && r.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MODELS)
      .map((r) => r.model);
  } catch {
    return _DEFAULT_MODELS_SEED;
  }
}

const DEFAULT_MODELS = _loadDefaultModels();

// QUICK_MODELS: top 3 from DEFAULT_MODELS (fastest well-known models first)
const _QUICK_SEED = ["minimax-m2.7:cloud", "qwen3-coder:480b", "devstral-2:123b"];
const QUICK_MODELS = (() => {
  // Pick top 3 from DEFAULT_MODELS that overlap with seed, else use full top-3
  const top3 = DEFAULT_MODELS.slice(0, 3);
  return top3.length >= 3 ? top3 : _QUICK_SEED;
})();

const QUICK_TASK_COUNT = 14;

// Score weights — tool name accuracy matters most for nex-code reliability
const WEIGHTS = {
  producedToolCall: 0.2,
  correctTool: 0.35,
  validArgs: 0.3,
  schemaCompliant: 0.15,
};

const SYSTEM_PROMPT =
  "You are a coding assistant. Use the provided tools to help with file operations, " +
  "search, and development tasks. Only call a tool when one is clearly needed to answer " +
  "the request. Do not call a tool for questions you can answer from general knowledge.";

// ─── Task Runner ──────────────────────────────────────────────────────────────

async function runTask(task, modelId) {
  const result = {
    taskId: task.id,
    category: task.category,
    model: modelId,
    producedToolCall: false,
    correctTool: false,
    validArgs: false,
    schemaCompliant: false,
    toolCalled: null,
    error: null,
    latencyMs: 0,
  };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task.prompt },
  ];

  const t0 = Date.now();
  try {
    const response = await registry.callChat(messages, TOOL_DEFINITIONS, {
      provider: "ollama",
      model: modelId,
      temperature: 0,
      timeout: 90000,
    });
    result.latencyMs = Date.now() - t0;

    const toolCalls = response.tool_calls || [];

    if (task.expectedTool === null) {
      // Model should answer without calling a tool
      const noCall = toolCalls.length === 0;
      result.producedToolCall = noCall;
      result.correctTool = noCall;
      result.validArgs = true;
      result.schemaCompliant = true;
    } else if (toolCalls.length > 0) {
      result.producedToolCall = true;

      const expected = Array.isArray(task.expectedTool)
        ? task.expectedTool
        : [task.expectedTool];

      // Find the best matching tool call — models may read before editing,
      // so scoring only the first call penalizes correct multi-step behavior.
      let bestScore = -1;
      let bestName = toolCalls[0].function?.name || "unknown";
      let bestCorrect = false;
      let bestValid = false;
      let bestSchema = false;

      for (const tc of toolCalls) {
        const name = tc.function?.name || "unknown";
        const args = tc.function?.arguments || {};
        const correct = expected.includes(name);
        let valid = false;
        let schema = false;
        let tcScore = 0;

        if (correct) {
          const toolDef = TOOL_DEFINITIONS.find((t) => t.function?.name === name);
          valid = !!task.validateArgs(args, toolDef);

          if (toolDef) {
            const s = toolDef.function?.parameters || {};
            const required = s.required || [];
            const known = Object.keys(s.properties || {});
            schema =
              required.every((r) => args[r] !== undefined) &&
              Object.keys(args).every((k) => known.includes(k));
          }

          tcScore = (correct ? 2 : 0) + (valid ? 1 : 0) + (schema ? 0.5 : 0);
        }

        if (tcScore > bestScore) {
          bestScore = tcScore;
          bestName = name;
          bestCorrect = correct;
          bestValid = valid;
          bestSchema = schema;
        }
      }

      // If no call matched the expected tool, record the first call for diagnostics
      result.toolCalled = bestCorrect ? bestName : (toolCalls[0].function?.name || "unknown");
      result.correctTool = bestCorrect;
      result.validArgs = bestValid;
      result.schemaCompliant = bestSchema;
    }
    // No tool call but one was expected → all flags remain false
  } catch (err) {
    result.latencyMs = Date.now() - t0;
    result.error = err.message.slice(0, 120);
  }

  return result;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreResult(r) {
  if (r.error) return 0;
  return (
    ((r.producedToolCall ? WEIGHTS.producedToolCall : 0) +
      (r.correctTool ? WEIGHTS.correctTool : 0) +
      (r.validArgs ? WEIGHTS.validArgs : 0) +
      (r.schemaCompliant ? WEIGHTS.schemaCompliant : 0)) *
    100
  );
}

// All task categories that have dedicated tasks in the TASKS array
const TASK_CATEGORIES = [
  "coding",
  "search",
  "shell",
  "schema",
  "multi-step",
  "reasoning",
  "frontend",
  "sysadmin",
  "data",
  "agentic",
  "resilience",
];

// Map each category to the broader routing key (for task-router.js)
const CATEGORY_ROUTE_KEY = {
  coding: "coding",
  search: "coding",
  shell: "coding",
  schema: "coding",
  "multi-step": "coding",
  reasoning: "coding",
  frontend: "frontend",
  sysadmin: "sysadmin",
  data: "data",
  agentic: "agentic",
  resilience: "coding", // resilience is a core coding-agent skill
  ssh: "sysadmin",      // SSH tasks route to sysadmin model
  git: "coding",        // git workflow is a coding-category skill
  "phase-plan": "plan",
  "phase-verify": "verify",
};

function buildSummary(modelResults) {
  return Object.entries(modelResults)
    .map(([model, results]) => {
      const scores = results.map(scoreResult);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

      const pct = (fn) =>
        Math.round((results.filter(fn).length / results.length) * 100);

      // Per-route-category average score
      const categoryScores = {};
      for (const routeKey of [
        "coding",
        "frontend",
        "sysadmin",
        "data",
        "agentic",
        "plan",
        "verify",
      ]) {
        const catResults = results.filter(
          (r) => CATEGORY_ROUTE_KEY[r.category] === routeKey,
        );
        if (catResults.length === 0) continue;
        const catAvg =
          catResults.map(scoreResult).reduce((a, b) => a + b, 0) /
          catResults.length;
        categoryScores[routeKey] = Math.round(catAvg * 10) / 10;
      }

      return {
        model,
        score: Math.round(avg * 10) / 10,
        toolCallRate: pct(
          (r) => !r.error && (r.producedToolCall || r.category === "reasoning"),
        ),
        correctRate: pct((r) => r.correctTool),
        validArgsRate: pct((r) => r.validArgs),
        schemaRate: pct((r) => r.schemaCompliant),
        avgLatency: Math.round(
          results.reduce((a, r) => a + r.latencyMs, 0) / results.length,
        ),
        errorCount: results.filter((r) => r.error).length,
        categoryScores,
        results,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Given a full summary, return the best model per route category.
 * Only counts models where categoryScores[cat] is available.
 */
function buildCategoryWinners(summary) {
  const winners = {};
  const LATENCY_TIEBREAK_BAND = 5;
  // Scores this high on a small sample are likely flukes — require a clear gap
  const SUSPICIOUS_SCORE = 95;
  const SUSPICIOUS_MIN_GAP = 15; // 2nd place must be ≥15 pts behind to trust a near-100 score
  // Minimum number of tasks in a category before trusting routing updates
  const MIN_TASKS_FOR_ROUTING = 4;
  // Minimum overall score — prevents weak models that got lucky on one category
  // from hijacking routing (e.g. nemotron rank #21 overall winning coding routing)
  const MIN_OVERALL_SCORE = 65;

  for (const routeKey of [
    "coding",
    "frontend",
    "sysadmin",
    "data",
    "agentic",
    "plan",
    "verify",
  ]) {
    const candidates = summary
      .filter(
        (r) =>
          r.categoryScores[routeKey] !== undefined &&
          r.score >= MIN_OVERALL_SCORE,
      )
      .sort((a, b) => b.categoryScores[routeKey] - a.categoryScores[routeKey]);
    if (candidates.length === 0) continue;

    // Count how many tasks belong to this route category (use first model's results)
    const refResults = candidates[0]?.results || [];
    const catTaskCount = refResults.filter(
      (r) => CATEGORY_ROUTE_KEY[r.category] === routeKey,
    ).length;

    if (catTaskCount < MIN_TASKS_FOR_ROUTING) continue; // too few tasks — skip

    const best = candidates[0];
    const second = candidates[1];

    // Suspicion check: near-100 score on a small sample requires a large gap
    if (
      best.categoryScores[routeKey] >= SUSPICIOUS_SCORE &&
      catTaskCount < 8 &&
      second
    ) {
      const gap =
        best.categoryScores[routeKey] - second.categoryScores[routeKey];
      if (gap < SUSPICIOUS_MIN_GAP) {
        // Fluke — fall back to the highest overall-scoring model that has category data
        const reliable = summary
          .filter((r) => r.categoryScores[routeKey] !== undefined)
          .find((r) => r.categoryScores[routeKey] < SUSPICIOUS_SCORE);
        if (reliable) {
          winners[routeKey] = {
            model: reliable.model,
            score: reliable.categoryScores[routeKey],
            avgLatency: reliable.avgLatency,
            _flukePrevented: true,
          };
        }
        continue;
      }
    }

    // Standard: within tiebreak band, prefer lowest latency
    const inBand = candidates.filter(
      (r) =>
        best.categoryScores[routeKey] - r.categoryScores[routeKey] <=
        LATENCY_TIEBREAK_BAND,
    );
    const winner = inBand.sort((a, b) => a.avgLatency - b.avgLatency)[0];

    winners[routeKey] = {
      model: winner.model,
      score: winner.categoryScores[routeKey],
      avgLatency: winner.avgLatency,
    };
  }
  return winners;
}

// ─── Display ──────────────────────────────────────────────────────────────────

function printResults(summary, taskCount) {
  const title = `nex-code Model Benchmark  (${taskCount} tasks · ollama cloud)`;
  const cols = [
    { label: "#", width: 3 },
    { label: "Model", width: 26 },
    { label: "Score", width: 7 },
    { label: "Tool✓", width: 7 },
    { label: "Name✓", width: 7 },
    { label: "Args✓", width: 7 },
    { label: "Schema✓", width: 8 },
    { label: "Latency", width: 8 },
    { label: "Err", width: 4 },
  ];

  const totalWidth = cols.reduce((a, c) => a + c.width + 1, 0) + 1;
  const bar = "─".repeat(totalWidth);

  console.log(`\n${C.bold}${title}${C.reset}`);
  console.log(bar);

  // Header
  const header = cols.map((c) => c.label.padEnd(c.width)).join(" ");
  console.log(`${C.dim}${header}${C.reset}`);
  console.log(bar);

  summary.forEach((row, i) => {
    const rank = String(i + 1).padEnd(cols[0].width);
    const model = row.model.slice(0, cols[1].width).padEnd(cols[1].width);
    const score = String(row.score).padEnd(cols[2].width);
    const tc = `${row.toolCallRate}%`.padEnd(cols[3].width);
    const nm = `${row.correctRate}%`.padEnd(cols[4].width);
    const av = `${row.validArgsRate}%`.padEnd(cols[5].width);
    const sc = `${row.schemaRate}%`.padEnd(cols[6].width);
    const lat = `${(row.avgLatency / 1000).toFixed(1)}s`.padEnd(cols[7].width);
    const err =
      row.errorCount > 0
        ? `${C.red}${row.errorCount}${C.reset}`
        : `${C.dim}0${C.reset}`;

    // Color score
    const scoreColor =
      row.score >= 80 ? C.green : row.score >= 60 ? C.yellow : C.red;
    const rankLabel =
      i === 0 ? `${C.yellow}${rank}${C.reset}` : `${C.dim}${rank}${C.reset}`;

    console.log(
      `${rankLabel} ${scoreColor}${model}${C.reset} ${C.bold}${scoreColor}${score}${C.reset} ` +
        `${tc} ${nm} ${av} ${sc} ${C.dim}${lat}${C.reset} ${err}`,
    );
  });

  console.log(bar);

  // Top model callout
  if (summary.length > 0) {
    const top = summary[0];
    console.log(
      `\n${C.bold}${C.green}Winner: ${top.model}${C.reset}  score ${top.score}/100`,
    );
    if (summary.length > 1) {
      const delta = (top.score - summary[1].score).toFixed(1);
      console.log(`${C.dim}+${delta} pts over ${summary[1].model}${C.reset}`);
    }
  }

  // Per-model task failures (compact — only printed when models have failures)
  const failingModels = summary.filter((r) =>
    r.results.some((t) => !t.error && (!t.correctTool || !t.validArgs)),
  );
  if (failingModels.length > 0) {
    console.log(`${C.bold}Failing tasks:${C.reset}`);
    for (const row of failingModels) {
      const failures = row.results.filter(
        (t) => !t.error && (!t.correctTool || !t.validArgs),
      );
      if (failures.length === 0) continue;
      const modelShort = row.model.slice(0, 22);
      const items = failures.map((t) => {
        if (!t.correctTool) {
          const called = t.toolCalled || "(none)";
          return `${C.dim}${t.taskId}${C.reset} ${C.red}→${called}${C.reset}`;
        }
        return `${C.dim}${t.taskId}${C.reset} ${C.yellow}bad-args${C.reset}`;
      });
      console.log(`  ${C.dim}${modelShort.padEnd(22)}${C.reset}  ${items.join("  ")}`);
    }
    console.log();
  }

  // Systemic failures — tasks that fail across most models indicate benchmark issues
  if (summary.length >= 3) {
    const taskFailCounts = {};
    const taskModelCounts = {};
    for (const row of summary) {
      for (const t of row.results) {
        if (t.error) continue;
        taskModelCounts[t.taskId] = (taskModelCounts[t.taskId] || 0) + 1;
        if (!t.correctTool || !t.validArgs) {
          taskFailCounts[t.taskId] = (taskFailCounts[t.taskId] || 0) + 1;
        }
      }
    }
    const threshold = Math.ceil(summary.length * 0.5);
    const systemic = Object.entries(taskFailCounts)
      .filter(([id, count]) => count >= threshold && taskModelCounts[id] >= 3)
      .sort((a, b) => b[1] - a[1]);

    if (systemic.length > 0) {
      console.log(`\n${C.bold}Systemic failures${C.reset} ${C.dim}(>50% of models fail — may indicate benchmark design issues)${C.reset}`);
      for (const [taskId, count] of systemic) {
        const total = taskModelCounts[taskId];
        const pct = Math.round((count / total) * 100);
        const color = pct >= 80 ? C.red : C.yellow;
        console.log(`  ${color}${pct}%${C.reset} ${C.dim}fail${C.reset}  ${taskId}`);
      }
      console.log();
    }
  }

  // Per-category winners (only shown if category tasks were included)
  const catRoutes = ["coding", "frontend", "sysadmin", "data", "agentic", "plan", "verify"];
  const hasCatData = summary.some(
    (r) => Object.keys(r.categoryScores).length > 1,
  );
  if (hasCatData) {
    console.log(`\n${C.bold}Best model per task type:${C.reset}`);
    for (const cat of catRoutes) {
      const ranked = summary
        .filter((r) => r.categoryScores[cat] !== undefined)
        .sort((a, b) => b.categoryScores[cat] - a.categoryScores[cat]);
      if (ranked.length === 0) continue;
      const winner = ranked[0];
      const sc = winner.categoryScores[cat];
      const color = sc >= 80 ? C.green : sc >= 60 ? C.yellow : C.red;
      console.log(
        `  ${C.dim}${cat.padEnd(10)}${C.reset} ${color}${winner.model}${C.reset}  ${C.dim}${sc}/100${C.reset}`,
      );
    }
  }
  console.log();
}

// ─── Routing Auto-Update ──────────────────────────────────────────────────────

/**
 * Given a benchmark summary, save the per-category winners to model-routing.json.
 * Only updates categories where at least one model was tested — leaves others untouched.
 * Skips if the summary covers fewer than 2 models (single-model run = no comparison).
 */
function autoUpdateRouting(summary) {
  if (!summary || summary.length < 2) return;
  try {
    const winners = buildCategoryWinners(summary);
    const { loadRoutingConfig } = require("./task-router");
    const existing = loadRoutingConfig();
    const updated = { ...existing };
    const changed = [];
    const PHASE_KEYS = new Set(["plan", "verify"]);

    for (const [cat, { model, score }] of Object.entries(winners)) {
      const isPhase = PHASE_KEYS.has(cat);
      const currentModel = isPhase
        ? (existing.phases && existing.phases[cat])
        : existing[cat];

      // If the currently-routed model was also tested in this run, only update
      // if the new winner genuinely beats it (buildCategoryWinners already handles
      // this for full runs). For partial runs (subset of models), skip update if
      // the current routing model was NOT in this benchmark — we can't compare.
      if (currentModel && currentModel !== model) {
        const currentInRun = summary.find((r) => r.model === currentModel);
        if (!currentInRun) {
          // Current routing model wasn't tested — don't overwrite blindly.
          // It may still be the global best; we just don't know from this run.
          continue;
        }
      }

      if (isPhase) {
        if (!updated.phases) updated.phases = {};
        if (updated.phases[cat] !== model) {
          updated.phases[cat] = model;
          changed.push(`phase:${cat}→${model}`);
        }
      } else {
        if (updated[cat] !== model) {
          updated[cat] = model;
          changed.push(`${cat}→${model}`);
        }
      }
    }

    if (changed.length > 0) {
      saveRoutingConfig(updated);
      console.log(
        `\n${C.dim}  Routing updated: ${changed.join(", ")}${C.reset}`,
      );
      console.log(
        `\n${C.green}💡 The best models have been saved to ~/.nex-code/.env and will be automatically used by nex-code from now on.${C.reset}`,
      );
    }
  } catch {
    /* non-fatal — routing update failure must not break benchmark output */
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function runBenchmark({
  models,
  quick = false,
  onProgress,
  parallelModels = 1,
} = {}) {
  const tasks = quick ? TASKS.slice(0, QUICK_TASK_COUNT) : ALL_TASKS;
  const modelList =
    models?.length > 0 ? models : quick ? QUICK_MODELS : DEFAULT_MODELS;

  const modelResults = {};
  for (const m of modelList) modelResults[m] = [];

  if (parallelModels <= 1) {
    // Sequential: original behaviour
    for (const model of modelList) {
      for (const task of tasks) {
        onProgress?.({ model, task: task.id, done: false });
        const r = await runTask(task, model);
        modelResults[model].push(r);
        onProgress?.({
          model,
          task: task.id,
          done: true,
          score: scoreResult(r),
          error: r.error,
        });
      }
    }
  } else {
    // Parallel: run up to parallelModels models concurrently.
    // Tasks within each model still run sequentially (avoids hammering one endpoint).
    const concurrency = Math.min(parallelModels, modelList.length);
    const queue = [...modelList];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const model = queue.shift();
        if (!model) break;
        for (const task of tasks) {
          onProgress?.({ model, task: task.id, done: false });
          const r = await runTask(task, model);
          modelResults[model].push(r);
          onProgress?.({
            model,
            task: task.id,
            done: true,
            score: scoreResult(r),
            error: r.error,
          });
        }
      }
    });
    await Promise.all(workers);
  }

  const summary = buildSummary(modelResults);
  printResults(summary, tasks.length);
  autoUpdateRouting(summary);
  return summary;
}

/**
 * Benchmark new models discovered by model-watcher, then merge results with an
 * existing full ranking so the README table always shows all known models.
 *
 * @param {string[]} newModels        — models to test (from model-watcher.findNewModels)
 * @param {Array}    existingRanking  — previous buildSummary() output (may be empty)
 * @param {Function} onProgress
 */
async function runDiscoverBenchmark({
  newModels,
  existingRanking = [],
  onProgress,
} = {}) {
  if (!newModels || newModels.length === 0) return existingRanking;

  const modelResults = {};

  for (const model of newModels) {
    modelResults[model] = [];
    for (const task of ALL_TASKS) {
      onProgress?.({ model, task: task.id, done: false });
      const r = await runTask(task, model);
      modelResults[model].push(r);
      onProgress?.({
        model,
        task: task.id,
        done: true,
        score: scoreResult(r),
        error: r.error,
      });
    }
  }

  // Merge new results with existing ranking (existing rows that aren't re-tested stay as-is)
  const newEntries = buildSummary(modelResults);
  const merged = [...newEntries];
  for (const row of existingRanking) {
    if (!merged.find((r) => r.model === row.model)) merged.push(row);
  }
  merged.sort((a, b) => b.score - a.score);

  printResults(merged, ALL_TASKS.length);
  autoUpdateRouting(merged);
  return merged;
}

// ─── Scenario Benchmark ───────────────────────────────────────────────────────

/**
 * Generic fallback scenarios — no server IPs or internal paths.
 * Used when .nex/benchmark-config.json does not exist.
 */
const DEFAULT_SCENARIOS = [
  {
    id: "simple_question",
    name: "Simple Convergence",
    prompt: "What is 2+2?",
    maxTurns: 3,
    successCriteria: ["4"],
  },
];

/**
 * Load scenarios from .nex/benchmark-config.json if it exists.
 * Falls back to DEFAULT_SCENARIOS and prints a setup hint.
 *
 * @param {string} [cwd]
 * @returns {Array}
 */
function loadScenarios(cwd) {
  const fs = require("fs");
  const path = require("path");
  const configPath = path.join(
    cwd || process.cwd(),
    ".nex",
    "benchmark-config.json",
  );

  if (!fs.existsSync(configPath)) {
    console.log(
      `${C.yellow}No scenarios configured.${C.reset} ` +
        `Create ${C.dim}.nex/benchmark-config.json${C.reset} to define your benchmark scenarios.\n` +
        `  Example:\n` +
        `  {\n` +
        `    "scenarios": [\n` +
        `      {\n` +
        `        "id": "health_check",\n` +
        `        "name": "Service Health Check",\n` +
        `        "prompt": "Check if my-api is running on <your-server> and report status",\n` +
        `        "maxTurns": 10,\n` +
        `        "successCriteria": ["running", "healthy", "OK"]\n` +
        `      }\n` +
        `    ]\n` +
        `  }\n`,
    );
    return DEFAULT_SCENARIOS;
  }

  try {
    const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
      console.log(
        `${C.yellow}benchmark-config.json has no scenarios — using defaults.${C.reset}\n`,
      );
      return DEFAULT_SCENARIOS;
    }
    return data.scenarios;
  } catch (err) {
    console.log(
      `${C.yellow}Failed to parse benchmark-config.json: ${err.message}${C.reset}\n`,
    );
    return DEFAULT_SCENARIOS;
  }
}

/**
 * Score a completed scenario session.
 * Base score from session-scorer, with bonuses for:
 *   +1.0 if all successCriteria appear in last assistant turn
 *   +0.5 if tool calls < maxTurns / 2
 * Capped at 10.
 *
 * @param {Array}  messages   — conversation messages from the completed run
 * @param {object} scenario   — scenario definition (successCriteria, maxTurns)
 * @returns {{ score, grade, issues, summary, bonuses }}
 */
function scoreScenario(messages, scenario) {
  const {
    scoreMessages,
    _extractToolCalls,
    _getLastAssistantText,
  } = require("./session-scorer");
  const base = scoreMessages(messages);
  let score = base.score;
  const bonuses = [];

  // Bonus: all successCriteria present in last assistant turn
  const lastText = _getLastAssistantText(messages).toLowerCase();
  const allCriteriaMet = scenario.successCriteria.every((kw) =>
    lastText.includes(kw.toLowerCase()),
  );
  if (allCriteriaMet) {
    score = Math.min(10, score + 1.0);
    bonuses.push("+1.0 all success criteria met");
  }

  // Bonus: tool calls under maxTurns/2
  const toolCalls = _extractToolCalls(messages);
  if (toolCalls.length < scenario.maxTurns / 2) {
    score = Math.min(10, score + 0.5);
    bonuses.push(
      `+0.5 efficient (${toolCalls.length} tool calls < ${scenario.maxTurns / 2})`,
    );
  }

  score = Math.round(score * 10) / 10;

  const grade =
    score >= 9.0
      ? "A"
      : score >= 8.0
        ? "B"
        : score >= 7.0
          ? "C"
          : score >= 6.0
            ? "D"
            : "F";

  return { score, grade, issues: base.issues, summary: base.summary, bonuses };
}

/**
 * Run a single scenario as a child process.
 * Returns the path to the autosave session file written by the child.
 *
 * @param {object} scenario
 * @param {object} opts
 * @param {string} [opts.model]
 * @param {boolean} [opts.dryRun]
 * @param {string}  [opts.cwd]
 * @returns {Promise<{ messages: Array, exitCode: number, timedOut: boolean }>}
 */
async function _runScenarioProcess(scenario, opts = {}) {
  const { spawn } = require("child_process");
  const fs = require("fs");
  const path = require("path");
  const os = require("os");

  // Write prompt to a temp file (avoids shell escaping issues)
  const promptFile = path.join(
    os.tmpdir(),
    `nex-bench-${scenario.id}-${Date.now()}.txt`,
  );
  fs.writeFileSync(promptFile, scenario.prompt, "utf-8");

  // Find the nex-code binary relative to this file
  const nexBin = path.resolve(__dirname, "..", "bin", "nex-code.js");
  const cwd = opts.cwd || process.cwd();

  const spawnArgs = [
    nexBin,
    "--prompt-file",
    promptFile,
    "--delete-prompt-file",
    "--auto",
    "--max-turns",
    String(scenario.maxTurns),
  ];
  if (opts.model) {
    spawnArgs.push("--model", opts.model);
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, spawnArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    const TIMEOUT_MS = scenario.maxTurns * 60 * 1000; // maxTurns minutes max
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* already exited */
      }
    }, TIMEOUT_MS);

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      try {
        fs.unlinkSync(promptFile);
      } catch {
        /* already deleted */
      }

      // Load the autosave session the child wrote
      const sessionPath = path.join(cwd, ".nex", "sessions", "_autosave.json");
      let messages = [];
      if (fs.existsSync(sessionPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
          messages = data.messages || [];
        } catch {
          /* corrupt — leave empty */
        }
      }

      resolve({ messages, exitCode: exitCode || 0, timedOut });
    });

    // Suppress child stdout/stderr to not pollute the benchmark output
    child.stdout.resume();
    child.stderr.resume();
  });
}

/**
 * Print a formatted benchmark results box.
 *
 * @param {Array<{ id, name, score, grade }>} results
 * @param {string} version
 * @param {string} model
 */
function _printBenchmarkResults(results, version, model) {
  const overallScore =
    results.length > 0
      ? Math.round(
          (results.reduce((s, r) => s + r.score, 0) / results.length) * 10,
        ) / 10
      : 0;
  const overallGrade =
    overallScore >= 9.0
      ? "A"
      : overallScore >= 8.0
        ? "B"
        : overallScore >= 7.0
          ? "C"
          : overallScore >= 6.0
            ? "D"
            : "F";

  const W = 57;
  const line = "─".repeat(W);

  console.log(`\n┌─ Benchmark Results ${"─".repeat(W - 19)}┐`);
  for (const r of results) {
    const id = r.id.padEnd(20);
    const name = r.name.substring(0, 26).padEnd(26);
    const sc = `${r.score}/10`.padStart(6);
    const gd = r.grade.padStart(2);
    console.log(`│  ${id} ${name} ${sc}  ${gd} │`);
  }
  console.log(`│  ${" ".repeat(W - 2)} │`);
  const footer = `Overall: ${overallScore}/10 (${overallGrade})  ·  v${version}  ·  ${model}`;
  console.log(`│  ${footer.substring(0, W - 4).padEnd(W - 4)} │`);
  console.log(`└${"─".repeat(W + 1)}┘\n`);
}

/**
 * Show the last N sessions from benchmark history with a trend line.
 *
 * @param {number} [n=10]
 */
function showScoreTrend(n = 10) {
  const fs = require("fs");
  const path = require("path");
  const historyPath = path.join(
    process.cwd(),
    ".nex",
    "benchmark-history.json",
  );
  if (!fs.existsSync(historyPath)) {
    console.log(
      `${C.yellow}No score history yet. Run a session first.${C.reset}\n`,
    );
    return;
  }

  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
  } catch {
    history = [];
  }
  if (!Array.isArray(history) || history.length === 0) {
    console.log(`${C.yellow}Score history is empty.${C.reset}\n`);
    return;
  }

  const recent = history.slice(-n);
  console.log(
    `\n${C.bold}Score History (last ${recent.length} session${recent.length === 1 ? "" : "s"}):${C.reset}`,
  );

  for (const entry of recent) {
    const date = (entry.date || "").replace("T", " ").substring(0, 16);
    const ver = (entry.version || "?").padEnd(8);
    const model = (entry.model || "?").substring(0, 12).padEnd(12);
    const sc = `${entry.score}/10`.padStart(6);
    const grade = entry.grade || "?";
    const issueStr =
      entry.issues && entry.issues.length > 0
        ? `${C.yellow}⚠ ${entry.issues
            .slice(0, 2)
            .map((i) => i.substring(0, 30))
            .join(", ")}${C.reset}`
        : `${C.green}✓${C.reset}`;

    const color =
      entry.score >= 8 ? C.green : entry.score >= 6 ? C.yellow : C.red;
    console.log(
      `  ${C.dim}${date}${C.reset}  ${C.dim}v${ver}${C.reset}  ${C.dim}${model}${C.reset}` +
        `  ${color}${sc}  ${grade}${C.reset}  ${issueStr}`,
    );
  }
  console.log();
}

/**
 * Main entry point for the scenario benchmark.
 *
 * @param {object} opts
 * @param {boolean} [opts.dryRun=false]   — list scenarios without running
 * @param {string}  [opts.model]          — override model
 * @param {string}  [opts.cwd]            — working directory for child processes
 * @param {Function} [opts.onProgress]    — callback({ id, name, done, score, grade })
 * @returns {Promise<Array<{ id, name, score, grade, issues, bonuses }>>}
 */
async function runScenarioBenchmark({
  dryRun = false,
  model,
  cwd,
  onProgress,
} = {}) {
  const pkg = require("../package.json");

  const scenarios = loadScenarios(cwd);

  if (dryRun) {
    console.log(
      `\n${C.bold}Scenario Benchmark — Scenarios (dry-run):${C.reset}\n`,
    );
    for (const s of scenarios) {
      console.log(
        `  ${C.cyan}${s.id.padEnd(20)}${C.reset} ${C.dim}${s.name}${C.reset}  maxTurns=${s.maxTurns}`,
      );
      console.log(`    ${C.dim}${s.prompt.substring(0, 80)}${C.reset}`);
    }
    console.log();
    return [];
  }

  const activeModel = (() => {
    if (model) return typeof model === "object" ? (model.id || "unknown") : model;
    try {
      const { getActiveModel } = require("./ollama");
      const m = getActiveModel ? getActiveModel() : null;
      if (!m) return "unknown";
      return typeof m === "object" ? (m.id || "unknown") : m;
    } catch {
      return "unknown";
    }
  })();

  const results = [];

  for (const scenario of scenarios) {
    onProgress?.({ id: scenario.id, name: scenario.name, done: false });

    console.log(`\n${C.dim}Running scenario: ${scenario.name}...${C.reset}`);
    const { messages, timedOut } = await _runScenarioProcess(scenario, {
      model: activeModel,
      cwd,
    });

    let scored;
    if (timedOut || messages.length === 0) {
      scored = {
        score: 0,
        grade: "F",
        issues: [timedOut ? "Scenario timed out" : "No messages produced"],
        summary: "No output",
        bonuses: [],
      };
    } else {
      scored = scoreScenario(messages, scenario);
    }

    const result = {
      id: scenario.id,
      name: scenario.name,
      score: scored.score,
      grade: scored.grade,
      issues: scored.issues,
      bonuses: scored.bonuses,
    };

    results.push(result);

    onProgress?.({
      id: scenario.id,
      name: scenario.name,
      done: true,
      score: scored.score,
      grade: scored.grade,
    });

    // Persist each scenario score to history as we go
    try {
      const { appendScoreHistory } = require("./session-scorer");
      appendScoreHistory(scored.score, {
        version: pkg.version,
        model: activeModel,
        sessionName: `bench:${scenario.id}`,
        issues: scored.issues,
      });
    } catch {
      /* non-critical */
    }
  }

  _printBenchmarkResults(results, pkg.version, activeModel);
  return results;
}

module.exports = {
  runBenchmark,
  runDiscoverBenchmark,
  buildSummary,
  buildCategoryWinners,
  TASKS,
  PHASE_TASKS,
  ALL_TASKS,
  scoreResult,
  DEFAULT_MODELS,
  QUICK_MODELS,
  // Scenario benchmark
  runScenarioBenchmark,
  showScoreTrend,
  loadScenarios,
  DEFAULT_SCENARIOS,
  scoreScenario,
};

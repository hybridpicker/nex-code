/**
 * cli/format.js — Terminal Formatting Functions
 * Tool summaries, result formatting, and color utilities
 */

const { T } = require("./theme");
const C = T;
const path = require("path");

// Last 1-2 path segments for compact display: "src/utils/helper.js"
function _shortPath(p) {
  if (!p) return "";
  const parts = p.replace(/^\.\//, "").split("/");
  return parts.length > 1 ? parts.slice(-2).join("/") : parts[0];
}

// Bullet color per tool category — uses theme RGB values for terminal-bg independence
const TOOL_DOT_COLOR = {
  read_file: T.tool_read,
  list_directory: T.tool_read,
  write_file: T.tool_write,
  edit_file: T.tool_write,
  patch_file: T.tool_write,
  bash: T.tool_exec,
  grep: T.tool_search,
  search_files: T.tool_search,
  glob: T.tool_search,
  git_commit: T.tool_git,
  git_push: T.tool_git,
  git_pull: T.tool_git,
  git_status: T.tool_git,
  git_diff: T.tool_git,
  git_log: T.tool_git,
  git_branch: T.tool_git,
  git_stash: T.tool_git,
  web_fetch: T.tool_web,
  web_search: T.tool_web,
  sysadmin: T.tool_sysadmin,
  ssh_exec: T.tool_sysadmin,
  ssh_upload: T.tool_sysadmin,
  ssh_download: T.tool_sysadmin,
  deploy: T.tool_sysadmin,
};

// Human-readable labels for tool names (short, capitalized)
const TOOL_LABELS = {
  read_file: "Read",
  write_file: "Write",
  edit_file: "Edit",
  patch_file: "Edit",
  list_directory: "List",
  bash: "Bash",
  grep: "Grep",
  search_files: "Search",
  glob: "Glob",
  web_fetch: "WebFetch",
  web_search: "WebSearch",
  git_status: "Bash",
  git_diff: "Bash",
  git_log: "Bash",
  git_commit: "Bash",
  git_push: "Bash",
  git_pull: "Bash",
  git_branch: "Bash",
  git_stash: "Bash",
  task_list: "TaskList",
  spawn_agents: "Agent",
  ask_user: "AskUser",
  switch_model: "SwitchModel",
  gh_run_list: "Bash",
  gh_run_view: "Bash",
  gh_workflow_trigger: "Bash",
  browser_open: "Browser",
  browser_screenshot: "Browser",
  browser_click: "Browser",
  browser_fill: "Browser",
  ssh_exec: "Bash",
  ssh_upload: "Upload",
  ssh_download: "Download",
  service_manage: "Bash",
  service_logs: "Bash",
  container_list: "Bash",
  container_logs: "Bash",
  container_exec: "Bash",
  brain_write: "Write",
  deploy: "Bash",
  frontend_recon: "Search",
};

// Section descriptions used in step headers (grouped action phrases)
const STEP_DESCRIPTIONS = {
  read_file: "Reading file",
  write_file: "Writing file",
  edit_file: "Editing file",
  patch_file: "Patching file",
  list_directory: "Listing directory",
  bash: "Running command",
  grep: "Searching code",
  search_files: "Searching files",
  glob: "Finding files",
  web_fetch: "Fetching content",
  web_search: "Searching the web",
  git_status: "Checking repository",
  git_diff: "Analyzing changes",
  git_log: "Reading git history",
  git_commit: "Creating commit",
  git_push: "Pushing changes",
  git_pull: "Pulling changes",
  git_branch: "Managing branches",
  git_stash: "Stashing changes",
  task_list: "Managing tasks",
  spawn_agents: "Delegating to agents",
  ask_user: "Awaiting input",
  switch_model: "Switching model",
  gh_run_list: "GitHub Actions",
  gh_run_view: "GitHub Actions",
  gh_workflow_trigger: "Triggering workflow",
  browser_open: "Opening browser",
  browser_screenshot: "Taking screenshot",
  browser_click: "Clicking element",
  browser_fill: "Filling form",
  ssh_exec: "Running on server",
  ssh_upload: "Uploading to server",
  ssh_download: "Downloading from server",
  service_manage: "Managing service",
  service_logs: "Reading service logs",
  container_list: "Listing containers",
  container_logs: "Reading container logs",
  container_exec: "Running in container",
  brain_write: "Saving to memory",
  deploy: "Deploying",
  frontend_recon: "Scanning design system",
};

const TOOL_STAGES = {
  read_file: { label: "Inspect", accent: T.tool_read, icon: "◌" },
  list_directory: { label: "Inspect", accent: T.tool_read, icon: "◌" },
  grep: { label: "Inspect", accent: T.tool_search, icon: "◌" },
  search_files: { label: "Inspect", accent: T.tool_search, icon: "◌" },
  glob: { label: "Inspect", accent: T.tool_search, icon: "◌" },
  web_fetch: { label: "Explore", accent: T.tool_web, icon: "◌" },
  web_search: { label: "Explore", accent: T.tool_web, icon: "◌" },
  browser_open: { label: "Explore", accent: T.tool_web, icon: "◌" },
  browser_screenshot: { label: "Capture", accent: T.tool_web, icon: "◌" },
  browser_click: { label: "Interact", accent: T.tool_web, icon: "◌" },
  browser_fill: { label: "Interact", accent: T.tool_web, icon: "◌" },
  write_file: { label: "Shape", accent: T.tool_write, icon: "✦" },
  edit_file: { label: "Shape", accent: T.tool_write, icon: "✦" },
  patch_file: { label: "Shape", accent: T.tool_write, icon: "✦" },
  bash: { label: "Execute", accent: T.tool_exec, icon: "▣" },
  sysadmin: { label: "Operate", accent: T.tool_sysadmin, icon: "▣" },
  ssh_exec: { label: "Operate", accent: T.tool_sysadmin, icon: "▣" },
  ssh_upload: { label: "Ship", accent: T.tool_sysadmin, icon: "▣" },
  ssh_download: { label: "Collect", accent: T.tool_sysadmin, icon: "▣" },
  deploy: { label: "Ship", accent: T.tool_sysadmin, icon: "▣" },
  git_status: { label: "Verify", accent: T.tool_git, icon: "✓" },
  git_diff: { label: "Verify", accent: T.tool_git, icon: "✓" },
  git_log: { label: "Verify", accent: T.tool_git, icon: "✓" },
  git_commit: { label: "Commit", accent: T.tool_git, icon: "✓" },
  git_push: { label: "Ship", accent: T.tool_git, icon: "✓" },
  git_pull: { label: "Sync", accent: T.tool_git, icon: "✓" },
  git_branch: { label: "Sync", accent: T.tool_git, icon: "✓" },
  git_stash: { label: "Sync", accent: T.tool_git, icon: "✓" },
};

function getToolStage(fnName) {
  return TOOL_STAGES[fnName] || {
    label: "Run",
    accent: T.tool_default,
    icon: "•",
  };
}

function formatStageBadge(fnName) {
  const stage = getToolStage(fnName);
  return `${stage.accent}${C.bold}${stage.icon} ${stage.label.toUpperCase()}${T.reset}`;
}

function _humanizeLabel(name) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function _compactPrimaryArg(fnName, args = {}) {
  if (args.path) return _shortPath(args.path);
  if (args.file) return _shortPath(args.file);
  if (args.query) return String(args.query).substring(0, 44);
  if (args.pattern) return String(args.pattern).substring(0, 44);
  if (args.url) return String(args.url).substring(0, 44);
  if (args.command) return String(args.command).substring(0, 44);
  return TOOL_LABELS[fnName] || _humanizeLabel(fnName);
}

function _extractNumberedLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const match = line.match(/^(\d+):\s?(.*)$/s);
      if (!match) return null;
      return { lineNumber: match[1], content: match[2] || "" };
    })
    .filter(Boolean);
}

function _formatCodePreviewLines(filePath, numberedLines, options = {}) {
  const {
    maxLines = 4,
    indent = "    ",
    maxContent = 110,
    includeOverflow = true,
  } = options;
  if (!Array.isArray(numberedLines) || numberedLines.length === 0) return "";

  const { highlightLine: _hlLine, detectLang: _dl } = require("./syntax");
  const lang = _dl(filePath || null);
  const shown = numberedLines.slice(0, maxLines);
  const preview = shown.map(({ lineNumber, content }) => {
    const clipped = content.length > maxContent
      ? content.substring(0, maxContent - 1) + "…"
      : content;
    return `${indent}${T.subtle}${lineNumber}:${T.reset} ${_hlLine(clipped, lang)}${T.reset}`;
  });

  if (includeOverflow && numberedLines.length > shown.length) {
    preview.push(
      `${indent}${T.subtle}… +${numberedLines.length - shown.length} more line${numberedLines.length - shown.length !== 1 ? "s" : ""}${T.reset}`,
    );
  }

  return preview.join("\n");
}

function _buildFlowTitle(tools) {
  const seen = new Set();
  const stages = [];
  for (const tool of tools) {
    const label = getToolStage(tool.fnName).label;
    if (!seen.has(label)) {
      seen.add(label);
      stages.push(label);
    }
  }
  if (stages.length === 0) return "";
  if (stages.length <= 3) return stages.join(`${C.dim} → ${C.reset}`);
  return `${stages.slice(0, 3).join(`${C.dim} → ${C.reset}`)}${C.dim} → +${stages.length - 3}${C.reset}`;
}

/**
 * Build a meaningful section header from a list of prepared tool calls.
 * Falls back to "Step N" if no tools or no mapping found.
 */
function _dot(fnName, isError = false, frame = null) {
  if (isError) return `${T.error}⏺${T.reset}`;
  const col = TOOL_DOT_COLOR[fnName] || T.tool_default;
  if (frame === "blink") return `${col}\x1b[5m⏺\x1b[25m${T.reset}`;
  const char = frame !== null ? frame : "⏺";
  return `${col}${char}${T.reset}`;
}

function formatSectionHeader(prepared, stepNum, isError = false, frame = null) {
  const tools = (prepared || []).filter((p) => p && p.canExecute !== false);

  if (tools.length === 0) {
    return `${_dot("", isError, frame)} Step ${stepNum}`;
  }

  if (tools.length === 1) {
    const t = tools[0];
    const a = t.args || {};
    const target = _compactPrimaryArg(t.fnName, {
      ...a,
      path: a._originalPath || a.path,
    });
    return `${_dot(t.fnName, isError, frame)} ${formatStageBadge(t.fnName)} ${C.bold}${target}${C.reset}`;
  }

  // Multi-tool: show the semantic flow instead of a plain tool list
  const firstFn = tools[0].fnName;
  const title = _buildFlowTitle(tools) || `${tools.length} tools`;
  const focus = tools
    .slice(0, 2)
    .map((t) => _compactPrimaryArg(t.fnName, t.args || {}))
    .filter(Boolean)
    .join(`${C.dim} · ${C.reset}`);
  const focusStr = focus ? ` ${T.subtle}·${T.reset} ${C.dim}${focus}${C.reset}` : "";
  return `${_dot(firstFn, isError, frame)} ${formatStageBadge(firstFn)} ${C.bold}${title}${C.reset}${focusStr}`;
}

function formatToolCall(name, args) {
  let primary;
  switch (name) {
    case "write_file":
    case "edit_file":
    case "patch_file":
    case "read_file":
    case "list_directory":
      primary = args.path || "";
      break;
    case "bash":
    case "ssh_exec":
      primary = (args.command || "").substring(0, 80);
      break;
    case "grep":
    case "search_files":
      primary = args.pattern
        ? `"${args.pattern}"${args.path ? ` in ${args.path}` : ""}`
        : "";
      break;
    case "glob":
      primary = args.pattern || "";
      break;
    case "web_fetch":
      primary = (args.url || "").substring(0, 60);
      break;
    case "web_search":
      primary = (args.query || "").substring(0, 50);
      break;
    default:
      primary = JSON.stringify(args).substring(0, 80);
  }
  const label = TOOL_LABELS[name] || name.replace(/_/g, " ");
  const argStr = primary ? `(${C.dim}${primary}${C.reset})` : "";
  return `${_dot(name)} ${C.bold}${label}${C.reset}${argStr}`;
}

function formatResult(text, maxLines = 8) {
  const lines = text.split("\n");
  const shown = lines.slice(0, maxLines);
  const more = lines.length - maxLines;
  const prefix0 = `${T.muted}  ⎿  ${T.reset}`;
  const prefixN = `     `;
  let out = shown
    .map((l, i) => `${i === 0 ? prefix0 : prefixN}${T.success}${l}${T.reset}`)
    .join("\n");
  if (more > 0) out += `\n${T.subtle}     … +${more} lines${T.reset}`;
  return out;
}

// LLM inference verbs — what's actually happening inside the model
const THINKING_VERBS = [
  "Sampling",
  "Decoding",
  "Attending",
  "Inferring",
  "Generating",
  "Routing",
  "Embedding",
  "Reasoning",
  "Tokenizing",
  "Predicting",
];

let _thinkingVerbIdx = Math.floor(Math.random() * THINKING_VERBS.length);

// Injected by agent.js so the spinner can show which model is active
let _activeModelId = null;
function setActiveModelForSpinner(modelId) {
  _activeModelId = modelId;
}

/**
 * Returns a spinner label combining the current inference verb and active model.
 * Example: "Sampling · devstral-2:123b"
 */
function getThinkingVerb() {
  const verb = THINKING_VERBS[_thinkingVerbIdx % THINKING_VERBS.length];
  _thinkingVerbIdx++;
  return verb;
}

/**
 * Returns spinner text for a tool execution, or null if the tool
 * should not show a spinner (interactive or has its own spinner).
 */
function getToolSpinnerText(name, args) {
  switch (name) {
    // Tools with their own spinner or interactive UI — skip
    case "bash":
    case "ask_user":
    case "write_file":
    case "edit_file":
    case "patch_file":
    case "task_list":
    case "spawn_agents":
      return null;

    case "read_file":
      return `Reading ${args.path || "file"}`;
    case "list_directory":
      return `Listing ${args.path || "."}`;
    case "search_files":
      return `Searching ${args.pattern || "..."}`;
    case "glob":
      return `Searching ${args.pattern || "..."}`;
    case "grep":
      return `Searching ${args.pattern || "..."}`;
    case "web_fetch":
      return `Fetching ${(args.url || "").substring(0, 60)}`;
    case "web_search":
      return `Searching web: ${(args.query || "").substring(0, 50)}`;
    case "git_status":
      return "Analyzing repository status";
    case "git_diff":
      return `Diffing${args.file ? ` ${args.file}` : ""}`;
    case "git_log":
      return `Reading git log${args.file ? ` (${args.file})` : ""}`;
    case "gh_run_list":
      return `GitHub Actions: listing runs${args.workflow ? ` (${args.workflow})` : ""}...`;
    case "gh_run_view":
      return `GitHub Actions: run ${args.run_id}...`;
    case "gh_workflow_trigger":
      return `GitHub Actions: trigger ${args.workflow}...`;
    case "browser_open":
      return `Browser: opening ${(args.url || "").substring(0, 60)}...`;
    case "browser_screenshot":
      return `Browser: screenshot ${(args.url || "").substring(0, 60)}...`;
    case "browser_click":
      return `Browser: clicking ${args.text || args.selector || "element"}...`;
    case "browser_fill":
      return `Browser: filling ${args.selector || "field"}...`;
    case "sysadmin": {
      const srv =
        args.server && args.server !== "local" ? ` [${args.server}]` : "";
      switch (args.action) {
        case "audit":
          return `Sysadmin${srv}: full audit...`;
        case "disk_usage":
          return `Sysadmin${srv}: disk usage ${args.path || "/"}...`;
        case "process_list":
          return `Sysadmin${srv}: top processes (${args.sort_by || "cpu"})...`;
        case "network_status":
          return `Sysadmin${srv}: network status...`;
        case "ssl_check":
          return `Sysadmin${srv}: SSL check ${args.domain || args.cert_path || ""}...`;
        case "log_tail":
          return `Sysadmin${srv}: tail ${args.path || "log"}...`;
        case "find_large":
          return `Sysadmin${srv}: find large files in ${args.path || "/"}...`;
        case "service":
          return `Sysadmin${srv}: service ${args.service_action || ""} ${args.service_name || ""}...`;
        case "kill_process":
          return `Sysadmin${srv}: kill PID ${args.pid || args.process_name || "?"}...`;
        case "journalctl":
          return `Sysadmin${srv}: journal ${args.unit ? `[${args.unit}]` : ""}${args.since ? ` since ${args.since}` : ""}...`;
        case "package":
          return `Sysadmin${srv}: package ${args.package_action || ""} ${(args.packages || []).join(" ")}...`;
        case "firewall":
          return `Sysadmin${srv}: firewall ${args.firewall_action || ""}...`;
        case "user_manage":
          return `Sysadmin${srv}: user ${args.user_action || ""} ${args.user || ""}...`;
        case "cron":
          return `Sysadmin${srv}: cron ${args.cron_action || ""}...`;
        default:
          return `Sysadmin${srv}: ${args.action}...`;
      }
    }
    case "visual_diff":
      return "Comparing screenshots (pixel diff)...";
    case "responsive_sweep":
      return `Responsive sweep: ${(args.url || "").substring(0, 50)}...`;
    case "visual_annotate":
      return `Annotating screenshot (${(args.annotations || []).length} markers)...`;
    case "visual_watch":
      return `Visual watch: ${(args.url || "").substring(0, 50)}...`;
    case "design_tokens":
      return "Extracting design tokens...";
    case "design_compare":
      return `Comparing against reference design...`;
    default:
      return `Running: ${name}`;
  }
}

/**
 * Compact 1-line summary for a tool execution result.
 * Displayed below the tool-call header as:  ⎿  Human-readable summary
 */
function formatToolSummary(name, args, result, isError) {
  const r = String(result || "");
  const stage = getToolStage(name);
  const cardPrefix = `  ${T.subtle}│${T.reset} ${stage.accent}${C.bold}${stage.label}${T.reset} ${T.subtle}·${T.reset} `;

  if (isError) {
    const firstLine = r.split("\n")[0];
    // BLOCKED messages: show compact one-liner, skip the verbose guidance text
    if (firstLine.startsWith("BLOCKED:")) {
      const reason = firstLine
        .replace(/^BLOCKED:\s*/, "")
        .replace(/\s*—.*$/, "")   // strip everything after the em-dash
        .replace(/\s*\(hard cap:.*?\)/, "")
        .trim()
        .substring(0, 70);
      return `${cardPrefix}${T.muted}blocked: ${reason}${T.reset}`;
    }
    const errMsg = firstLine
      .replace(/^ERROR:\s*/i, "")
      .substring(0, 80);
    const hintMatch = r.match(/\nHINT: (.+)/);
    const hintStr = hintMatch
      ? `\n     ${T.muted}${hintMatch[1].substring(0, 100)}${T.reset}`
      : "";
    return `${cardPrefix}${T.error}${errMsg}${T.reset}${hintStr}`;
  }

  let summary;
  switch (name) {
    case "read_file": {
      const numberedLines = _extractNumberedLines(r);
      const count = numberedLines.length;
      const lastLine = numberedLines[numberedLines.length - 1];
      const lastLineNum = lastLine
        ? parseInt(lastLine.lineNumber || "0")
        : 0;
      const isPartial = args.line_start || args.line_end;
      const fname = args.path ? path.basename(args.path) : null;
      const fileHint = fname ? ` ${T.muted}from ${fname}${T.reset}` : "";
      if (isPartial && lastLineNum > count) {
        summary = `Read lines ${args.line_start || 1}–${lastLineNum}${fileHint}`;
      } else {
        summary = `Read ${count} line${count !== 1 ? "s" : ""}${fileHint}`;
      }
      const preview = _formatCodePreviewLines(args.path, numberedLines, {
        maxLines: 4,
        maxContent: 120,
      });
      if (preview) summary += `\n${preview}`;
      break;
    }
    case "write_file": {
      const contentLines = (args.content || "").split("\n");
      const lineCount = contentLines.length;
      const fname = args.path ? path.basename(args.path) : null;
      const header = fname
        ? `Wrote ${fname} · ${lineCount} line${lineCount !== 1 ? "s" : ""}`
        : `Wrote ${lineCount} line${lineCount !== 1 ? "s" : ""}`;
      // Syntax-highlight content when a language can be detected
      const { highlightLines: _hl } = require("./syntax");
      const hlLines = _hl(args.content || "", args.path || null);
      // For small files show the full content; for larger files show a preview
      const WRITE_SHOW = 40;
      const WRITE_PREVIEW = 8;
      if (lineCount <= WRITE_SHOW) {
        const block = hlLines
          .map((l) => `     ${l}`)
          .join("\n");
        summary = `${header}\n${block}`;
      } else {
        const shown = hlLines
          .slice(0, WRITE_PREVIEW)
          .map((l) => `     ${l}`)
          .join("\n");
        summary = `${header}\n${shown}\n     ${T.subtle}… +${lineCount - WRITE_PREVIEW} lines${T.reset}`;
      }
      break;
    }
    case "edit_file": {
      const oldLines = (args.old_text || "").split("\n");
      const newLines = (args.new_text || "").split("\n");
      const removed = oldLines.length;
      const added = newLines.length;
      const fname = args.path ? path.basename(args.path) : null;
      const fnameStr = fname ? `  ${T.muted}${fname}${T.reset}` : "";
      // Highlight the diff preview lines
      const { highlightLine: _hlLine, detectLang: _dl } = require("./syntax");
      const _lang = _dl(args.path || null);
      const diffLines = [];
      const oldPreview = oldLines
        .filter((line, idx, arr) => line.trim() || arr.length === 1 || idx === 0)
        .slice(0, 3);
      const newPreview = newLines
        .filter((line, idx, arr) => line.trim() || arr.length === 1 || idx === 0)
        .slice(0, 3);
      oldPreview.forEach((line) => {
        diffLines.push(
          `    ${T.diff_rem}- ${T.reset}${_hlLine(line.trimEnd().substring(0, 96), _lang)}${T.reset}`,
        );
      });
      if (oldLines.length > oldPreview.length) {
        diffLines.push(
          `    ${T.subtle}… ${oldLines.length - oldPreview.length} more removed line${oldLines.length - oldPreview.length !== 1 ? "s" : ""}${T.reset}`,
        );
      }
      newPreview.forEach((line) => {
        diffLines.push(
          `    ${T.diff_add}+ ${T.reset}${_hlLine(line.trimEnd().substring(0, 96), _lang)}${T.reset}`,
        );
      });
      if (newLines.length > newPreview.length) {
        diffLines.push(
          `    ${T.subtle}… ${newLines.length - newPreview.length} more added line${newLines.length - newPreview.length !== 1 ? "s" : ""}${T.reset}`,
        );
      }
      summary =
        `${T.diff_rem}−${removed}${T.reset}  ${T.diff_add}+${added}${T.reset}${fnameStr}` +
        (diffLines.length > 0 ? "\n" + diffLines.join("\n") : "");
      break;
    }
    case "patch_file": {
      const patches = args.patches || [];
      const totalRemoved = patches.reduce(
        (s, p) => s + (p.old_text || "").split("\n").length,
        0,
      );
      const totalAdded = patches.reduce(
        (s, p) => s + (p.new_text || "").split("\n").length,
        0,
      );
      const fname = args.path ? path.basename(args.path) : null;
      const fnameStr = fname ? `  ${T.muted}${fname}${T.reset}` : "";
      summary = `${patches.length} patch${patches.length !== 1 ? "es" : ""}  ${T.diff_rem}−${totalRemoved}${T.reset}  ${T.diff_add}+${totalAdded}${T.reset}${fnameStr}`;
      const patchPreview = [];
      const { highlightLine: _hlLine, detectLang: _dl } = require("./syntax");
      const _lang = _dl(args.path || null);
      patches.slice(0, 2).forEach((patch, index) => {
        const oldFirst = String(patch.old_text || "").split("\n").find(Boolean);
        const newFirst = String(patch.new_text || "").split("\n").find(Boolean);
        patchPreview.push(`    ${T.subtle}patch ${index + 1}${T.reset}`);
        if (oldFirst) {
          patchPreview.push(
            `    ${T.diff_rem}- ${T.reset}${_hlLine(oldFirst.trimEnd().substring(0, 92), _lang)}${T.reset}`,
          );
        }
        if (newFirst) {
          patchPreview.push(
            `    ${T.diff_add}+ ${T.reset}${_hlLine(newFirst.trimEnd().substring(0, 92), _lang)}${T.reset}`,
          );
        }
      });
      if (patches.length > 2) {
        patchPreview.push(
          `    ${T.subtle}… +${patches.length - 2} more patches${T.reset}`,
        );
      }
      if (patchPreview.length > 0) summary += `\n${patchPreview.join("\n")}`;
      break;
    }
    case "bash": {
      const BASH_PREVIEW = 3;
      const exitMatch = r.match(/^EXIT (\d+)/);
      const outputLines = r
        .split("\n")
        .filter(
          (l) =>
            l && !l.startsWith("EXIT ") && !l.startsWith("HINT:") && l.trim(),
        );
      const icon = exitMatch
        ? exitMatch[1] === "0"
          ? `${T.success}✓${T.reset}`
          : `${T.error}✗ Exit ${exitMatch[1]}${T.reset}`
        : `${T.success}✓${T.reset}`;
      const hintMatch = r.match(/\nHINT: (.+)/);
      if (hintMatch) {
        summary = `${icon} ${T.muted}— ${hintMatch[1].substring(0, 100)}${T.reset}`;
      } else if (outputLines.length === 0) {
        summary = icon;
      } else {
        // On failure show last N lines (error is at the end); on success show first N
        const failed = exitMatch && exitMatch[1] !== "0";
        const shown = failed
          ? outputLines.slice(-BASH_PREVIEW)
          : outputLines.slice(0, BASH_PREVIEW);
        const more = outputLines.length - BASH_PREVIEW;
        const lines = shown.map((l, i) =>
          i === 0
            ? `${icon} ${T.muted}${l.substring(0, 120)}${T.reset}`
            : `    ${T.muted}${l.substring(0, 120)}${T.reset}`,
        );
        if (more > 0) {
          const ellipsis = failed
            ? `    ${T.subtle}${more} lines above…${T.reset}`
            : `    ${T.subtle}… +${more} lines${T.reset}`;
          failed ? lines.unshift(ellipsis) : lines.push(ellipsis);
        }
        summary = lines.join("\n");
      }
      break;
    }
    case "grep":
    case "search_files": {
      if (r.includes("(no matches)") || r === "no matches") {
        const patternHint = args.pattern
          ? ` ${T.muted}"${String(args.pattern).substring(0, 40)}"${T.reset}`
          : "";
        summary = `No matches${patternHint}`;
      } else {
        const path = require("path");
        const lines = r.split("\n").filter(Boolean);
        const matchCount = lines.length;
        const files = new Set(
          lines.map((l) => l.split(":")[0]).filter(Boolean),
        );
        const fileCount = files.size;
        const patternHint = args.pattern
          ? ` ${T.muted}"${String(args.pattern).substring(0, 40)}"${T.reset}`
          : "";
        const header =
          fileCount > 1
            ? `${matchCount} match${matchCount !== 1 ? "es" : ""} in ${fileCount} files${patternHint}`
            : `${matchCount} match${matchCount !== 1 ? "es" : ""}${patternHint}`;
        // Format: "basename:linenum content" — avoids doubled-path visual confusion
        // Grep output: "file:linenum:content" (match) or "file:linenum-content" (context line)
        function fmtGrepLine(l) {
          const colonIdx = l.indexOf(":");
          if (colonIdx === -1)
            return `${T.muted}${l.substring(0, 90)}${T.reset}`;
          const file = l.substring(0, colonIdx);
          const rest = l.substring(colonIdx + 1); // "linenum:content" or "linenum-content"
          const lineNumM = rest.match(/^(\d+)[:-](.*)/s);
          const lineNum = lineNumM ? `:${lineNumM[1]}` : "";
          const content = (lineNumM ? lineNumM[2] : rest).trim();
          const label = `${T.subtle}${path.basename(file)}${lineNum}${T.reset}`;
          const snippet = `${T.muted}${content.substring(0, 80)}${content.length > 80 ? "…" : ""}${T.reset}`;
          return `${label}  ${snippet}`;
        }
        const searchRoot = args.path
          ? `\n    ${T.subtle}path:${T.reset} ${T.muted}${String(args.path).substring(0, 70)}${T.reset}`
          : "";
        const preview = lines
          .slice(0, 5)
          .map((l, i) =>
            i === 0
              ? `${header}${searchRoot}\n    ${fmtGrepLine(l)}`
              : `    ${fmtGrepLine(l)}`,
          );
        const more = lines.length - 5;
        if (more > 0) preview.push(`    ${T.subtle}… +${more} more matches${T.reset}`);
        summary = preview.join("\n");
      }
      break;
    }
    case "glob": {
      const globPatternHint = args.pattern
        ? ` ${T.muted}${String(args.pattern).substring(0, 50)}${T.reset}`
        : "";
      if (r === "(no matches)") {
        summary = `No files found${globPatternHint}`;
      } else {
        const path = require("path");
        const allFiles = r.split("\n").filter(Boolean);
        const count = allFiles.length;
        const shown = allFiles.slice(0, 8);
        const more = count - shown.length;
        const lines = shown.map((f) => `    ${T.muted}${f}${T.reset}`);
        if (more > 0) lines.push(`    ${T.subtle}… +${more} more files${T.reset}`);
        const rootHint = args.path
          ? `\n    ${T.subtle}path:${T.reset} ${T.muted}${String(args.path).substring(0, 70)}${T.reset}`
          : "";
        summary =
          `${count} file${count !== 1 ? "s" : ""}${globPatternHint}${rootHint}` +
          (lines.length > 0 ? `\n${lines.join("\n")}` : "");
      }
      break;
    }
    case "list_directory": {
      if (r === "(empty)") {
        summary = "0 entries";
      } else {
        const entries = r.split("\n").filter(Boolean);
        const count = entries.length;
        const shown = entries.slice(0, 6).join(", ");
        const more = count - 6;
        summary =
          more > 0
            ? `${count} entries — ${T.muted}${shown}, +${more} more${T.reset}`
            : `${count} entr${count !== 1 ? "ies" : "y"} — ${T.muted}${shown}${T.reset}`;
      }
      break;
    }
    case "git_status": {
      const branchMatch = r.match(/Branch:\s*(\S+)/);
      const changes = r
        .split("\n")
        .filter((l) => /^\s*[MADRCU?!]/.test(l)).length;
      summary = branchMatch
        ? `${branchMatch[1]} · ${changes} change${changes !== 1 ? "s" : ""}`
        : "Done";
      break;
    }
    case "git_diff": {
      const addLines = (r.match(/^\+[^+]/gm) || []).length;
      const delLines = (r.match(/^-[^-]/gm) || []).length;
      summary =
        addLines || delLines ? `+${addLines} −${delLines} lines` : "No diff";
      break;
    }
    case "git_log": {
      const commitLines = r
        .split("\n")
        .filter((l) => /^commit\s+[0-9a-f]{7}/.test(l));
      const commits = commitLines.length;
      const firstHash = commitLines[0]
        ? commitLines[0].replace(/^commit\s+/, "").substring(0, 7)
        : null;
      // Find the subject line of the first commit (first non-empty line after "commit <hash>")
      const firstSubject = (() => {
        const idx = r.indexOf(commitLines[0] || "\0");
        if (idx === -1) return null;
        const after = r.substring(idx).split("\n");
        return after.find(
          (l, i) =>
            i > 0 &&
            l.trim() &&
            !l.startsWith("Author:") &&
            !l.startsWith("Date:") &&
            !l.startsWith("Merge:"),
        );
      })();
      if (commits === 0) {
        summary = "Log retrieved";
      } else if (firstHash && firstSubject) {
        const more =
          commits > 1 ? ` ${T.muted}+${commits - 1} more${T.reset}` : "";
        summary = `${firstHash} ${T.muted}${firstSubject.trim().substring(0, 60)}${T.reset}${more}`;
      } else {
        summary = `${commits} commit${commits !== 1 ? "s" : ""}`;
      }
      break;
    }
    case "git_commit": {
      const hashMatch = r.match(/\[[\w./\-]+ ([0-9a-f]{7,})\]/);
      const msgMatch = r.match(/\[[\w./\-]+ [0-9a-f]+\]\s+(.+)/);
      summary = hashMatch
        ? `${hashMatch[1]}${msgMatch ? ` — ${msgMatch[1].substring(0, 55)}` : ""}`
        : "Committed";
      break;
    }
    case "git_push": {
      const branchMatch = r.match(/(?:->|→)\s*(\S+)/);
      summary = branchMatch ? `→ ${branchMatch[1]}` : "Pushed";
      break;
    }
    case "git_pull": {
      if (/Already up.to.date/i.test(r)) {
        summary = "Already up to date";
      } else {
        const addLines = (r.match(/^\+/gm) || []).length;
        summary = addLines > 0 ? `Pulled · +${addLines} lines` : "Pulled";
      }
      break;
    }
    case "web_fetch": {
      const titleMatch = r.match(/<title[^>]*>([^<]{1,80})<\/title>/i);
      const h1Match = r.match(/^#\s+(.{1,80})/m);
      const url = args.url || "";
      let fetchDesc = "";
      try {
        fetchDesc = new URL(url).hostname;
      } catch (_) {
        fetchDesc = url.substring(0, 60);
      }
      const pageTitle = titleMatch
        ? titleMatch[1].trim()
        : h1Match
          ? h1Match[1].trim()
          : null;
      summary = pageTitle
        ? `${fetchDesc} — ${T.muted}${pageTitle.substring(0, 70)}${T.reset}`
        : `Fetched ${fetchDesc}`;
      break;
    }
    case "web_search": {
      const blocks = r.split("\n\n").filter(Boolean);
      const count = blocks.length;
      const firstTitle = blocks[0]
        ? blocks[0]
            .split("\n")[0]
            .replace(/^\d+\.\s*/, "")
            .trim()
        : null;
      const titleHint = firstTitle
        ? ` ${T.muted}— ${firstTitle.substring(0, 70)}${T.reset}`
        : "";
      summary = `${count} result${count !== 1 ? "s" : ""}${titleHint}`;
      break;
    }
    case "task_list":
      summary = "Done";
      break;
    case "spawn_agents": {
      // Background agents: result is a "started" confirmation, not a completion summary
      if (r.includes("Background agents started")) {
        const bgMatch = r.match(/\bbg-[\w-]+/g);
        const bgCount = bgMatch ? bgMatch.length : 0;
        summary = `${bgCount} bg agent${bgCount !== 1 ? "s" : ""} started`;
        break;
      }
      const doneCount = (r.match(/✓ Agent/g) || []).length;
      const failCount = (r.match(/✗ Agent/g) || []).length;
      summary =
        failCount > 0
          ? `${doneCount} done, ${failCount} failed`
          : `${doneCount} agent${doneCount !== 1 ? "s" : ""} done`;
      break;
    }
    case "switch_model": {
      const switchMatch = r.match(/Switched to (.+)/);
      summary = switchMatch ? `→ ${switchMatch[1]}` : "Done";
      break;
    }
    case "ssh_exec": {
      const SSH_PREVIEW = 3;
      const failed = r.startsWith("EXIT ") || r.startsWith("Command failed");
      const outputLines = r
        .split("\n")
        .filter((l) => l.trim() && !l.startsWith("EXIT "));
      const icon = failed ? `${T.error}✗${T.reset}` : `${T.success}✓${T.reset}`;
      if (outputLines.length === 0) {
        summary = icon;
      } else {
        const isLogOutput =
          outputLines.length > 2 &&
          outputLines.every((l) => /^\[/.test(l.trim()));
        if (isLogOutput) {
          summary = `${icon} ${outputLines.length} log lines`;
          break;
        }
        const shown = failed
          ? outputLines.slice(-SSH_PREVIEW)
          : outputLines.slice(0, SSH_PREVIEW);
        const more = outputLines.length - SSH_PREVIEW;
        const lines = shown.map((l, i) =>
          i === 0
            ? `${icon} ${T.muted}${l.substring(0, 120)}${T.reset}`
            : `    ${T.muted}${l.substring(0, 120)}${T.reset}`,
        );
        if (more > 0) {
          const ellipsis = failed
            ? `    ${T.subtle}${more} lines above…${T.reset}`
            : `    ${T.subtle}… +${more} lines${T.reset}`;
          failed ? lines.unshift(ellipsis) : lines.push(ellipsis);
        }
        summary = lines.join("\n");
      }
      break;
    }
    default: {
      // Show first meaningful output line instead of generic "Done"
      const meaningfulLines = r
        .split("\n")
        .filter(
          (l) => l.trim() && !l.startsWith("EXIT ") && !l.startsWith("HINT:"),
        );
      if (meaningfulLines.length > 0) {
        const first = meaningfulLines[0].trim().substring(0, 90);
        const more =
          meaningfulLines.length > 1
            ? ` ${T.subtle}… +${meaningfulLines.length - 1} lines${T.reset}`
            : "";
        summary = `${T.muted}${first}${T.reset}${more}`;
      } else {
        summary = `${stage.label} complete`;
      }
    }
  }

  return `${cardPrefix}${summary}${T.reset}`;
}

function formatMilestone(
  phaseName,
  stepCount,
  toolCounts,
  elapsedMs,
  filesRead,
  filesModified,
) {
  const elapsedSecs = Math.round(elapsedMs / 1000);
  const timeStr =
    elapsedSecs >= 60
      ? `${Math.floor(elapsedSecs / 60)}m ${elapsedSecs % 60}s`
      : `${elapsedSecs}s`;

  let line = `\n${T.success}◆${C.reset} ${C.bold}${phaseName}${C.reset}`;
  line += ` ${T.subtle}━━${T.reset} ${C.dim}${timeStr}`;
  if (filesModified.size > 0)
    line += ` · ${filesModified.size} file${filesModified.size !== 1 ? "s" : ""} modified`;
  if (filesRead.size > 0)
    line += ` · ${filesRead.size} scanned`;
  line += C.reset;
  return line;
}

module.exports = {
  C,
  formatToolCall,
  formatResult,
  getToolSpinnerText,
  formatToolSummary,
  formatSectionHeader,
  formatMilestone,
  getThinkingVerb,
  setActiveModelForSpinner,
  THINKING_VERBS,
};

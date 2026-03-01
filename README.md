<p align="center">
  <img src="assets/nex-code-logo.jpg" alt="Nex Code Logo" width="280">
</p>

<h1 align="center">Nex Code</h1>

<p align="center">
  Standalone agentic coding CLI with multi-provider support.<br>
  Streaming output, persistent conversations, colored diff previews, automatic project context.
</p>

<p align="center">
  Supports <b>OpenAI</b>, <b>Anthropic</b>, <b>Google Gemini</b>, <b>Ollama Cloud</b>, and <b>local Ollama</b> servers.
</p>

---

## Setup

### Prerequisites
- Node.js 18+
- At least one API key **or** a local [Ollama](https://ollama.com/download) server

### Installation

```bash
git clone git@github.com:hybridpicker/nex-code.git
cd nex-code
npm install
cp .env.example .env
npm link
```

### Configure a Provider

Add one or more API keys to `.env`:

```bash
# Pick any — only one is required
OLLAMA_API_KEY=your-key       # Ollama Cloud (Kimi K2.5, Qwen3, DeepSeek R1, Llama 4, Devstral)
OPENAI_API_KEY=your-key       # OpenAI (GPT-4o, GPT-4.1, o1, o3, o4-mini)
ANTHROPIC_API_KEY=your-key    # Anthropic (Claude Sonnet, Opus, Haiku)
GEMINI_API_KEY=your-key       # Google Gemini (2.5 Pro/Flash, 2.0 Flash)
# No key needed for local Ollama — just have it running
```

### Verify

```bash
cd ~/any-project
nex-code
```

You should see the banner, your project context, and the `>` prompt.

---

## Usage

```
> explain the main function in index.js
> add input validation to the createUser handler
> run the tests and fix any failures
> refactor this to use async/await instead of callbacks
```

### YOLO Mode

Skip all confirmation prompts — file changes, dangerous commands, and tool permissions are auto-approved:

```bash
nex-code -yolo
```

The banner shows a `⚡ YOLO` indicator. You can also toggle auto-confirm at runtime with `/autoconfirm`.

The agent decides autonomously whether to use tools or just respond with text. Simple questions get direct answers. Coding tasks trigger the agentic tool loop.

---

## Providers & Models

Switch providers and models at runtime:

```
/model                         # interactive model picker (arrow keys + Enter)
/model openai:gpt-4o           # switch directly
/model anthropic:claude-sonnet
/model gemini:gemini-2.5-pro
/model local:llama3
/providers                     # see all available providers & models
```

| Provider | Models | Env Variable |
|----------|--------|-------------|
| **ollama** | Kimi K2.5, Qwen3 Coder, DeepSeek R1, Llama 4 Scout, Devstral | `OLLAMA_API_KEY` |
| **openai** | GPT-4o, GPT-4.1, o1, o3, o4-mini | `OPENAI_API_KEY` |
| **anthropic** | Claude Sonnet, Opus, Haiku, 4.5 Sonnet, 3.5 Sonnet | `ANTHROPIC_API_KEY` |
| **gemini** | Gemini 2.5 Pro/Flash, 2.0 Flash/Lite | `GEMINI_API_KEY` |
| **local** | Any model on your local Ollama server | (none) |

Fallback chains let you auto-switch when a provider fails:
```
/fallback anthropic,openai,local
```

---

## Commands

Type `/` to see inline suggestions as you type. Tab completion is supported for slash commands and file paths (type a path containing `/` and press Tab).

| Command | Description |
|---------|-------------|
| `/help` | Full help |
| `/model [spec]` | Show/switch model (e.g. `openai:gpt-4o`) |
| `/providers` | List all providers and models |
| `/fallback [chain]` | Show/set fallback chain |
| `/tokens` | Token usage and context budget |
| `/costs` | Session token costs |
| `/budget` | Show/set per-provider cost limits |
| `/clear` | Clear conversation |
| `/context` | Show project context |
| `/autoconfirm` | Toggle auto-confirm for file changes |
| `/save [name]` | Save current session |
| `/load <name>` | Load a saved session |
| `/sessions` | List saved sessions |
| `/resume` | Resume last session |
| `/remember <text>` | Save a memory (persists across sessions) |
| `/forget <key>` | Delete a memory |
| `/memory` | Show all memories |
| `/permissions` | Show tool permissions |
| `/allow <tool>` | Auto-allow a tool |
| `/deny <tool>` | Block a tool |
| `/plan [task]` | Plan mode (analyze before executing) |
| `/plans` | List saved plans |
| `/auto [level]` | Set autonomy: interactive/semi-auto/autonomous |
| `/commit [msg]` | Smart commit (analyze diff, suggest message) |
| `/diff` | Show current diff |
| `/branch [name]` | Create feature branch |
| `/mcp` | MCP servers and tools |
| `/hooks` | Show configured hooks |
| `/skills` | List, enable, disable skills |
| `/undo` | Undo last file change |
| `/redo` | Redo last undone change |
| `/history` | Show file change history |
| `/exit` | Quit |

---

## Tools

The agent has 17 built-in tools:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands (90s timeout, 5MB buffer) |
| `read_file` | Read files with optional line range (binary detection) |
| `write_file` | Create or overwrite files (with diff preview + confirmation) |
| `edit_file` | Targeted text replacement (with diff preview + confirmation) |
| `patch_file` | Atomic multi-replacement in a single operation |
| `list_directory` | Tree view with depth control and glob filtering |
| `search_files` | Regex search across files (like grep) |
| `glob` | Fast file search by name/extension pattern |
| `grep` | Content search with regex and line numbers |
| `git_status` | Git working tree status |
| `git_diff` | Git diff with optional path filter |
| `git_log` | Git commit history with configurable count |
| `web_fetch` | Fetch content from a URL |
| `web_search` | Search the web via DuckDuckGo |
| `ask_user` | Ask the user a question and wait for input |
| `task_list` | Create and manage task lists for multi-step operations |
| `spawn_agents` | Run parallel sub-agents with auto model routing |

Additional tools can be added via [MCP servers](#mcp) or [Skills](#skills).

---

## Features

### Compact Output
The agent loop uses a single spinner during tool execution, then prints compact 1-line summaries:
```
  ⠋ ▸ 3 tools: read_file, grep, edit_file
  ✓ read_file src/app.js (45 lines)
  ✓ grep TODO → 12 matches
  ✗ edit_file src/x.js → old_text not found
```

After multi-step tasks, a résumé and context-aware follow-up suggestions are shown:
```
  ── 3 steps · 8 tools · 2 files modified ──
  💡 /diff · /commit · /undo
```
Read-heavy sessions (analysis, status checks) suggest `/save · /clear` instead.

### Response Quality
The system prompt enforces substantive responses: the model always presents findings as formatted text after using tools (users only see 1-line tool summaries). Responses use markdown with headers, bullet lists, and code blocks. The model states its approach before non-trivial tasks and summarizes results after completing work.

### Streaming Output
Tokens appear live as the model generates them. Braille spinner during connection, then real-time line-by-line rendering via `StreamRenderer` with markdown formatting and syntax highlighting (JS, TS, Python, Go, Rust, CSS, HTML, and more).

### Paste Detection
Automatic bracketed paste mode: pasting multi-line text into the prompt is detected and combined into a single input instead of firing line-by-line. A `[pasted X lines]` indicator is shown.

### Diff Preview
Every file change is shown as a colored diff before being applied:
- **edit_file**: Red/green diff with 3 lines of context
- **write_file** (overwrite): Line-by-line comparison (or side-by-side view)
- **write_file** (new): Preview of the first 20 lines
- OOM-safe: large diffs (>2000 lines) fall back to add/remove instead of LCS
- All changes require `[y/n]` confirmation (toggle with `/autoconfirm` or start with `-yolo`)

### Auto-Context
On startup, the CLI reads your project and injects context into the system prompt:
- `package.json` — name, version, scripts, dependencies
- `README.md` — first 50 lines
- Git info — branch, status, recent commits
- `.gitignore` content

### Context Engine
Automatic token management with compression when the context window gets full. Tracks token usage across system prompt, conversation, tool results, and tool definitions.

### Safety Layer
Three tiers of protection:
- **Forbidden** (blocked): `rm -rf /`, `rm -rf .`, `mkfs`, `dd if=`, fork bombs, `curl|sh`, `cat .env`, `chmod 777`, reverse shells — 30+ patterns
- **Dangerous** (requires confirmation): `git push`, `npm publish`, `rm -rf`, `docker rm`, `sudo`, `ssh` — 14 patterns
- **Path protection**: Sensitive paths (`.ssh/`, `.aws/`, `.env`, credentials) are blocked from file operations

### Sessions
Save and restore conversations:
```
/save my-feature
/load my-feature
/resume              # resume last session
```
Auto-save after every turn.

### Memory
Persistent project memory that survives across sessions:
```
/remember lang=TypeScript
/remember always use yarn instead of npm
/memory
/forget lang
```

Also loads `NEX.md` from project root for project-level instructions.

### Plan Mode
Analyze before executing — the agent creates a plan, you review and approve:
```
/plan refactor the auth module
/plan status
/plan approve
/auto semi-auto      # set autonomy level
```

### Undo / Redo
In-session undo/redo for all file changes (write, edit, patch):
```
/undo                # undo last file change
/redo                # redo last undone change
/history             # show file change history
```
Undo stack holds up to 50 changes. `/clear` resets the history.

### Task Management
Create structured task lists for complex multi-step operations:
```
/tasks                # show current task list
/tasks clear          # clear all tasks
```
The agent uses `task_list` to create, update, and track progress on tasks with dependency support.

When the agent creates a task list, a **live animated display** replaces the static output:
```
✽ Adding cost limit functions… (1m 35s · ↓ 2.6k tokens)
  ⎿  ✔ Create cli/picker.js — Interactive Terminal Picker
     ◼ Add cost limits to cli/costs.js
     ◻ Add budget gate to cli/providers/registry.js
     ◻ Update cli/index.js
     ◻ Run tests
```
- Animated spinner header with elapsed time and cumulative token count
- Per-task status icons: `✔` done, `◼` in progress, `◻` pending, `✗` failed
- Automatically pauses during text streaming and resumes during tool execution
- Falls back to the static `/tasks` view when no live display is active

### Sub-Agents
Spawn parallel sub-agents for independent tasks:
- Up to 5 agents run simultaneously with their own conversation contexts
- File locking prevents concurrent writes to the same file
- Multi-progress display shows real-time status of each agent
- Good for: reading multiple files, analyzing separate modules, independent research

**Multi-Model Routing** — Sub-agents auto-select the best model per task based on complexity:
- **Read/search/list** tasks → fast models (essential tier)
- **Edit/fix/analyze** tasks → capable models (standard tier)
- **Refactor/implement/generate** tasks → most powerful models (full tier)

The LLM can also explicitly override with `model: "provider:model"` in the agent definition. When multiple providers are configured, the system prompt includes a routing table showing all available models and their tiers.

### Git Intelligence
```
/commit              # analyze diff, suggest commit message
/commit feat: add login
/diff                # show current diff summary
/branch my-feature   # create and switch to branch
```

### Permissions
Control which tools the agent can use:
```
/permissions         # show current settings
/allow read_file     # auto-allow without asking
/deny bash           # block completely
```

Persisted in `.nex/config.json`.

### Cost Tracking
Track token usage and costs per provider:
```
/costs
/costs reset
```

### Cost Limits
Set per-provider spending limits. When a provider exceeds its budget, calls automatically fall back to the next provider in the fallback chain:
```
/budget                    # show all limits + current spend
/budget anthropic 5        # set $5 limit for Anthropic
/budget openai 10          # set $10 limit for OpenAI
/budget anthropic off      # remove limit
```

Limits are persisted in `.nex/config.json`. You can also set them directly:
```json
// .nex/config.json
{
  "costLimits": {
    "anthropic": 5,
    "openai": 10
  }
}
```

### Open-Source Model Robustness

Four features that make Nex Code significantly more reliable with open-source models:

**Tool Call Retry with Schema Hints** — When a model sends malformed tool arguments, instead of a bare error, the agent sends back the expected JSON schema so the model can self-correct on the next loop iteration.

**Smart Argument Parsing** — 5 fallback strategies for parsing tool arguments: direct JSON, trailing comma/quote fixes, JSON extraction from surrounding text, unquoted key repair, and markdown code fence stripping (common with DeepSeek R1, Llama).

**Tool Argument Validation** — Validates arguments against tool schemas before execution. Auto-corrects similar parameter names (Levenshtein distance), fixes type mismatches (string↔number↔boolean), and provides "did you mean?" suggestions.

**Auto-Fix Engine** — Three layers of automatic error recovery that silently fix common tool failures:
- **Path auto-fix**: Wrong extension? Finds the right one (`.js` → `.ts`). File moved? Globs for it by basename. Double slashes, missing extensions — all auto-resolved.
- **Edit auto-fix**: Close match (≤5% Levenshtein distance) in `edit_file`/`patch_file` is auto-applied instead of erroring. Stacks with fuzzy whitespace matching.
- **Bash error hints**: Enriches error output with actionable hints — "command not found" → install suggestion, `MODULE_NOT_FOUND` → `npm install <pkg>`, port in use, syntax errors, TypeScript errors, test failures, and more.

**Tool Tiers** — Dynamically reduces the tool set based on model capability:
- **essential** (5 tools): bash, read_file, write_file, edit_file, list_directory
- **standard** (13 tools): + search_files, glob, grep, ask_user, git_status, git_diff, git_log, task_list
- **full** (17 tools): all tools

Models are auto-classified, or override per-model in `.nex/config.json`:
```json
{
  "toolTiers": {
    "deepseek-r1": "essential",
    "local:*": "essential",
    "qwen3-coder": "full"
  }
}
```

Tiers are also used by sub-agent routing — when a sub-agent auto-selects a model, its tool set is filtered to match that model's tier.

---

## Skills

Extend Nex Code with project-specific knowledge, commands, and tools via `.nex/skills/`.

### Prompt Skills (`.md`)
Drop a Markdown file and its content is injected into the system prompt:

```markdown
<!-- .nex/skills/code-style.md -->
# Code Style
- Always use semicolons
- Prefer const over let
- Use TypeScript strict mode
```

### Script Skills (`.js`)
CommonJS modules that can provide instructions, slash commands, and tools:

```javascript
// .nex/skills/deploy.js
module.exports = {
  name: 'deploy',
  description: 'Deployment helper',
  instructions: 'When deploying, always run tests first...',
  commands: [
    { cmd: '/deploy', desc: 'Run deployment', handler: (args) => { /* ... */ } }
  ],
  tools: [
    {
      type: 'function',
      function: { name: 'deploy_status', description: 'Check status', parameters: { type: 'object', properties: {} } },
      execute: async (args) => 'deployed'
    }
  ]
};
```

### Management

```
/skills                    # list loaded skills
/skills enable code-style  # enable a skill
/skills disable code-style # disable a skill
```

Skills are loaded on startup. All enabled by default. Disabled skills tracked in `.nex/config.json`.

---

## MCP

Connect external tool servers via the [Model Context Protocol](https://modelcontextprotocol.io):

```json
// .nex/config.json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
```

```
/mcp              # show servers and tools
/mcp connect      # connect all configured servers
/mcp disconnect   # disconnect all
```

MCP tools appear with the `mcp_` prefix and are available to the agent alongside built-in tools.

---

## Hooks

Run custom scripts on CLI events:

```json
// .nex/config.json
{
  "hooks": {
    "pre-tool": ["echo 'before tool'"],
    "post-tool": ["echo 'after tool'"],
    "pre-commit": ["npm test"]
  }
}
```

Events: `pre-tool`, `post-tool`, `pre-commit`, `post-response`, `session-start`, `session-end`.

Or place executable scripts in `.nex/hooks/`:
```
.nex/hooks/pre-tool
.nex/hooks/post-tool
```

---

## Architecture

```
bin/nex-code.js          # Entrypoint (shebang, .env, startREPL)
cli/
├── index.js             # REPL + ~38 slash commands + history persistence
├── agent.js             # Agentic loop + conversation state + compact output + résumé
├── providers/           # Multi-provider abstraction
│   ├── base.js          # Abstract provider interface
│   ├── ollama.js        # Ollama Cloud provider
│   ├── openai.js        # OpenAI provider
│   ├── anthropic.js     # Anthropic provider
│   ├── gemini.js        # Google Gemini provider
│   ├── local.js         # Local Ollama server
│   └── registry.js      # Provider registry + model resolution + provider routing
├── tools.js             # 17 tool definitions + implementations + auto-fix engine
├── sub-agent.js         # Parallel sub-agent runner with file locking + model routing
├── tasks.js             # Task list management (create, update, render, onChange callbacks)
├── skills.js            # Skills system (prompt + script skills)
├── mcp.js               # MCP client (JSON-RPC over stdio)
├── hooks.js             # Hook system (pre/post events)
├── context.js           # Auto-context (package.json, git, README)
├── context-engine.js    # Token management + context compression
├── session.js           # Session persistence (.nex/sessions/)
├── memory.js            # Project memory (.nex/memory/ + NEX.md)
├── permissions.js       # Tool permission system
├── planner.js           # Plan mode + autonomy levels
├── git.js               # Git intelligence (commit, diff, branch)
├── render.js            # Markdown + syntax highlighting + StreamRenderer
├── diff.js              # LCS diff + colored output + side-by-side view
├── file-history.js      # In-session undo/redo for file changes
├── picker.js            # Interactive terminal picker (model selection)
├── costs.js             # Token cost tracking + per-provider budget limits
├── safety.js            # Forbidden/dangerous pattern detection
├── tool-validator.js    # Tool argument validation + auto-correction
├── tool-tiers.js        # Dynamic tool set selection per model + model tier lookup
├── ui.js                # ANSI colors, spinner, TaskProgress, formatting, compact summaries
└── ollama.js            # Backward-compatible wrapper
```

### Agentic Loop

```
User Input
    |
[System Prompt + Context + Memory + Skills + Conversation]
    |
[Filter tools by model tier (essential/standard/full)]
    |
Provider API (streaming) --> Text tokens --> rendered to terminal
    |                   \--> Tool calls --> parse args (5 strategies)
    |                                       |
    |                              [Validate against schema + auto-correct]
    |                                       |
    |                              Execute (skill / MCP / built-in)
    |                                       |
    |                              [Auto-fix: path resolution, edit matching, bash hints]
    |
[Tool results added to history]
    |
Loop until: no more tool calls OR 30 iterations
```

---

## .nex/ Directory

Project-local configuration and state (gitignored):

```
.nex/
├── config.json        # Permissions, MCP servers, hooks, skills, cost limits
├── sessions/          # Saved conversations
├── memory/            # Persistent project knowledge
├── plans/             # Saved plans
├── hooks/             # Custom hook scripts
└── skills/            # Skill files (.md and .js)
```

---

## Testing

```bash
npm test              # Run all tests with coverage
npm run test:watch    # Watch mode
```

39 test suites, 1264 tests, 87% statement coverage.

CI runs on GitHub Actions (Node 18/20/22).

---

## Dependencies

2 runtime dependencies:

```json
{
  "axios": "^1.7.0",
  "dotenv": "^16.4.0"
}
```

Everything else is Node.js built-in.

## License

MIT

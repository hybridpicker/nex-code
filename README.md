```
 ██▄▄██   nex-code  v0.3.54
 █▀██▀█   devstral-2:123b  ·  /help
 ▀████▀
```

<p align="center">
  <b>The open-source agentic coding assistant for Ollama Cloud — and every other provider.</b><br>
  Use it in the terminal or install the built-in <b>VS Code extension</b> for a sidebar chat panel.<br>
  Free by default with Ollama. Switch to OpenAI, Anthropic, or Gemini anytime.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/nex-code"><img src="https://img.shields.io/npm/v/nex-code.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/nex-code"><img src="https://img.shields.io/npm/dm/nex-code.svg" alt="npm downloads"></a>
  <a href="https://github.com/hybridpicker/nex-code/stargazers"><img src="https://img.shields.io/github/stars/hybridpicker/nex-code.svg" alt="GitHub Stars"></a>
  <a href="https://github.com/hybridpicker/nex-code/actions/workflows/ci.yml"><img src="https://github.com/hybridpicker/nex-code/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Ollama_Cloud-supported-brightgreen.svg" alt="Ollama Cloud: supported">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node >= 18">
  <img src="https://img.shields.io/badge/dependencies-2-green.svg" alt="Dependencies: 2">
  <img src="https://img.shields.io/badge/tests-3074-blue.svg" alt="Tests: 3074">
  <img src="https://img.shields.io/badge/VS_Code-extension-007ACC.svg" alt="VS Code extension">
</p>

---
## Demo

https://github.com/user-attachments/assets/6a70525c-a1a4-4c6f-9784-176cb1becc15


---

## Quickstart

```bash
npx nex-code
```

Or install globally:

```bash
npm install -g nex-code
cd ~/your-project
nex-code
```

That's it. You'll see the banner, your project context, and the `>` prompt. Start typing.

---

## Automatic Updates

Nex Code automatically checks for new versions when you start it. If a newer version is available, you'll see a notification with instructions on how to update:

```
💡 New version available! Run npm update -g nex-code to upgrade from x.x.x to x.x.x
```

To update to the latest version:
```bash
npm update -g nex-code
```

---

## Why nex-code?

**Provider-agnostic by design.** Run fully free with a local Ollama server, use Ollama Cloud's 47+ models on a flat-rate plan, or connect OpenAI, Anthropic, or Gemini — switch at runtime with `/model`, no restart needed. The fallback chain automatically retries failed requests on the next configured provider.

**Open-model first.** nex-code was built around open models, not locked to any single vendor. Tool tiers (`essential / standard / full`) adapt automatically to the model's capability level, so smaller models don't receive tool schemas they can't handle. A 5-layer auto-fix loop catches and retries malformed tool calls without user intervention.

**Smart model routing.** The built-in `/benchmark` system tests all configured models against 33 real nex-code tool-calling tasks across 5 task categories. The results feed a routing table so nex-code can automatically switch to the best model for the detected task type:

| Detected task | Routed model (example) |
|---|---|
| Frontend / CSS / React | `qwen3-coder:480b` |
| Sysadmin / Docker / nginx | `devstral-2:123b` |
| Data / SQL / migrations | `devstral-2:123b` |
| Agentic swarms | `minimax-m2.7:cloud` |
| General coding | `devstral-2:123b` (default) |

**Built-in VS Code extension.** A sidebar chat panel with streaming output, collapsible tool cards, and native VS Code theme support — shipped in the same repo, no separate install.

**Lightweight.** 2 runtime dependencies (`axios`, `dotenv`). Starts in ~100ms. No Python, no heavy runtime, no daemon process.

**Infrastructure tools built in:**
- SSH server management (AlmaLinux, macOS, any Linux)
- Docker tools — local and remote via SSH
- Kubernetes overview (`/k8s`)
- GitHub Actions tools (trigger, monitor runs)
- Named deploy configs (`rsync`-based, `/deploy`)
- Browser agent via Playwright (optional, not bundled)
- Grounded web search via Perplexity or DuckDuckGo

**Developer safety:**
- Pre-push secret detection — blocks commits that contain API keys or tokens
- Full audit log (JSONL + sanitization)
- Undo/Redo with persistence across restarts
- Cost tracking and per-provider budget limits
- Plan mode — analysis-only pass before any file changes

**Extensible.** Plugin API (`registerTool` + lifecycle hooks), skill system (install from any git URL), MCP server support.

**Tested.** 3074 tests, 85% coverage, CI on every push.

---

## Ollama Cloud — Recommended Model Setup

nex-code was built with Ollama Cloud as its primary provider. No subscription, no billing surprises.
Rankings are based on nex-code's own `/benchmark` — 15 tool-calling tasks against real nex-code schemas.

### Flat-Rate / Pay-as-you-go

<!-- nex-benchmark-start -->
<!-- Updated: 2026-03-20 — run `/benchmark --discover` after new Ollama Cloud releases -->

| Rank | Model | Score | Avg Latency | Context | Best For |
|---|---|---|---|---|---|
| 🥇 | `devstral-2:123b` | **84** | 1.5s | 131K | Default — fastest + most reliable tool selection |
| 🥈 | `qwen3-coder:480b` | 79 | 2.9s | 131K | Coding-heavy sessions, heavy sub-agents |
| 🥉 | `kimi-k2:1t` | 79 | 2.7s | 256K | Large repos (>100K tokens) |
| — | `minimax-m2.7:cloud` | 73 | 3.5s | 200K | Complex swarm / multi-agent sessions (Toolathon SOTA) |
| — | `devstral-small-2:24b` | 73 | 1.0s | 131K | Fast sub-agents, simple lookups |

> Rankings are nex-code-specific: tool name accuracy, argument validity, schema compliance.
> Toolathon (Minimax SOTA) measures different task types — run `/benchmark --discover` after model releases.
<!-- nex-benchmark-end -->

### Recommended `.env` for Ollama Cloud (Flat-Rate)

```env
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=devstral-2:123b         # nex-code benchmark winner (84/100, 1.5s)

# Sub-agent routing
NEX_HEAVY_MODEL=qwen3-coder:480b      # complex multi-step coding
NEX_STANDARD_MODEL=devstral-2:123b    # routine tasks
NEX_FAST_MODEL=devstral-small-2:24b   # quick lookups, fast sub-agents
```

### Run the benchmark yourself

```bash
/benchmark             # full run: 15 tasks × 5 models
/benchmark --quick     # fast run: 7 tasks × 3 models
/benchmark --discover  # detect new Ollama Cloud models, benchmark + auto-update README
/benchmark --models=minimax-m2.7:cloud,qwen3-coder:480b
/benchmark --history   # show OpenClaw nightly trend
```

Switch anytime: `/model devstral-2:123b` or update `DEFAULT_MODEL` in `.env`.
Auto-discovery runs weekly via the scheduled improvement task and updates this table automatically.

---

## Setup

### Prerequisites
- Node.js 18+
- At least one API key **or** a local [Ollama](https://ollama.com/download) server

### Install from npm

```bash
npm install -g nex-code
```

Or run directly without installing:

```bash
npx nex-code
```

### Install from source (for contributors)

```bash
git clone https://github.com/hybridpicker/nex-code.git
cd nex-code
npm install
npm run build         # Build the high-performance bundle
cp .env.example .env
npm link
npm run install-hooks
```

### Configure a Provider

Create a `.env` file in your project directory (or set environment variables):

```bash
# Pick any — only one is required
OLLAMA_API_KEY=your-key       # Ollama Cloud (Qwen3 Coder, Qwen3.5, DeepSeek R1, Devstral, Kimi K2.5, Llama 4, MiniMax M2.5, GLM 4.7)
OPENAI_API_KEY=your-key       # OpenAI (GPT-4o, GPT-4.1, o1, o3, o4-mini)
ANTHROPIC_API_KEY=your-key    # Anthropic (Claude Sonnet 4.6, Opus 4.6, Haiku 4.5)
GEMINI_API_KEY=your-key       # Google Gemini (3.1 Pro Preview, 2.5 Pro/Flash, 2.0 Flash)
PERPLEXITY_API_KEY=your-key   # Perplexity (optional — enables grounded web search)
# No key needed for local Ollama — just have it running

# Optional tuning
DEFAULT_PROVIDER=ollama        # Active provider on startup
DEFAULT_MODEL=devstral-2:123b  # Active model on startup (see /benchmark for ranking)
FALLBACK_CHAIN=anthropic,openai # Providers tried on failure (comma-separated)
NEX_STALE_WARN_MS=60000        # Warn if no tokens received for N ms (default: 60000)
NEX_STALE_ABORT_MS=120000      # Abort and retry stream after N ms of silence (default: 120000)
NEX_LANGUAGE=auto              # Response language: "auto" (mirrors user's language, default) or e.g. "English", "Deutsch"
NEX_THEME=dark                 # Force dark/light theme (overrides auto-detection). Use if colours look wrong for your terminal profile.
FOOTER_DEBUG=1                 # Write terminal layout debug log to /tmp/footer-debug.log
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

### Try These Scenarios

**Understand an unfamiliar codebase:**
```
> give me an overview of this project — architecture, key files, tech stack
> how does authentication work here? trace the flow from login to session
> find all API endpoints and list them with their HTTP methods
```

**Fix bugs with context:**
```
> the /users endpoint returns 500 — find the bug and fix it
> tests are failing in auth.test.js — figure out why and fix it
> there's a memory leak somewhere — profile the app and find it
```

**Add features end-to-end:**
```
> add rate limiting to all API routes (100 req/min per IP)
> add a /health endpoint that checks DB connectivity
> implement pagination for the GET /products endpoint
```

**Refactor and improve:**
```
> refactor the database queries to use a connection pool
> this function is 200 lines — break it into smaller functions
> migrate these callbacks to async/await
```

**DevOps and CI:**
```
> write a Dockerfile for this project
> set up GitHub Actions CI that runs tests on push
> add a pre-commit hook that runs linting
```

**Multi-step autonomous work (YOLO mode):**
```bash
nex-code -yolo
```
```
> read the entire src/ directory, run the tests, fix all failures, then commit
> add input validation to every POST endpoint, add tests, run them
> upgrade all dependencies to latest, fix any breaking changes, run tests
```

The agent decides autonomously whether to use tools or just respond with text. Simple questions get direct answers. Coding tasks trigger the agentic tool loop.

**Vision / Screenshot → Code** — drop an image path anywhere in your message and nex-code will send it to a vision-capable model automatically:
```
> /path/to/screenshot.png implement this UI in React
> describe the layout in mockup.png and generate the CSS
```
Supported formats: PNG, JPG, GIF, WebP, BMP. Works with Anthropic, OpenAI, Gemini, and Ollama vision models (llava, qwen2-vl, etc.).

### YOLO Mode

Skip all confirmation prompts — file changes, dangerous commands, and tool permissions are auto-approved. The banner shows a `⚡ YOLO` indicator. Toggle at runtime with `/autoconfirm`.

On macOS, nex-code automatically runs `caffeinate` for the duration of the session (idle sleep and disk sleep are suppressed), so long autonomous tasks won't be interrupted by the system going to sleep. This applies to all modes, not just YOLO.

You can also enable YOLO mode permanently for a project via `.nex/config.json`:
```json
{ "yolo": true }
```

### Headless / Programmatic Mode

Run nex-code non-interactively from scripts, CI pipelines, or other processes:

```bash
# Inline prompt
nex-code --task "refactor src/index.js to use async/await" --yolo

# Prompt from file (avoids shell-escaping issues with special characters)
nex-code --prompt-file /tmp/task.txt --yolo

# Delete the file after reading
nex-code --prompt-file /tmp/task.txt --delete-prompt-file --yolo

# JSON output for programmatic parsing
nex-code --prompt-file /tmp/task.txt --yolo --json
# → {"success":true,"response":"..."}
```

| Flag | Description |
|------|-------------|
| `--task <prompt>` | Run a single prompt and exit |
| `--prompt-file <path>` | Read prompt from a UTF-8 file and run headless |
| `--delete-prompt-file` | Delete the prompt file after reading (use with `--prompt-file`) |
| `--auto` | Skip confirmations (non-interactive, no REPL banner) |
| `--yolo` | Skip all confirmations including dangerous commands (also configurable via `.nex/config.json` `"yolo": true`) |
| `--server` | Start JSON-lines IPC server (used by the VS Code extension) |
| `--json` | Output `{"success":true,"response":"..."}` to stdout |
| `--max-turns <n>` | Override the agentic loop iteration limit |
| `--model <spec>` | Use a specific model (e.g. `anthropic:claude-sonnet-4-6`) |

---

## VS Code Extension

nex-code ships with a built-in VS Code extension (`vscode/`) — no separate repo needed. It adds a sidebar chat panel with streaming output, collapsible tool cards, and confirmation dialogs, all styled with VS Code's native theme variables.

**Architecture:** The extension spawns `nex-code --server` as a child process and communicates over a JSON-lines protocol on stdin/stdout. No agent logic is duplicated — the CLI is the single source of truth.

**Requirements:** nex-code must be in `$PATH` — either `npm install -g nex-code` or `npm link` for local development.

**Install:**
```bash
cd vscode
npm install
npm run package        # syncs version, builds, and creates .vsix
# Cmd+Shift+P → Extensions: Install from VSIX...
```

**Settings** (`Settings → Extensions → Nex Code`):

| Setting | Default | Description |
|---------|---------|-------------|
| `nexCode.executablePath` | `nex-code` | Path to the nex-code binary |
| `nexCode.defaultProvider` | `ollama` | LLM provider |
| `nexCode.defaultModel` | `devstral-2:123b` | Model name |
| `nexCode.anthropicApiKey` | — | Anthropic API key |
| `nexCode.openaiApiKey` | — | OpenAI API key |
| `nexCode.ollamaApiKey` | — | Ollama Cloud API key |
| `nexCode.geminiApiKey` | — | Google Gemini API key |
| `nexCode.maxTurns` | `50` | Max agentic loop iterations |

**Commands** (`Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `Nex Code: Clear Chat` | Clear conversation history |
| `Nex Code: Switch Model` | Pick a different model |
| `Nex Code: Restart Agent` | Restart the child process (e.g. after source changes) |

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
| **ollama** | Qwen3 Coder, Qwen3.5 (397B, 122B-A10B, 35B-A3B, 27B, 9B, 4B, 2B, 0.8B), DeepSeek R1, Devstral, Kimi K2.5, MiniMax M2.5, GLM 4.7, Llama 4 | `OLLAMA_API_KEY` |
| **openai** | GPT-4o, GPT-4.1, o1, o3, o4-mini | `OPENAI_API_KEY` |
| **anthropic** | Claude Sonnet 4.6, Opus 4.6, Haiku 4.5, Sonnet 4.5, Sonnet 4 | `ANTHROPIC_API_KEY` |
| **gemini** | Gemini 3.1 Pro Preview, 2.5 Pro/Flash, 1.5 Pro/Flash | `GEMINI_API_KEY` |
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
| `/brain add <name>` | Add a document to the knowledge base |
| `/brain list` | List all brain documents |
| `/brain search <query>` | Search the knowledge base |
| `/brain show <name>` | Show a brain document |
| `/brain remove <name>` | Remove a brain document |
| `/brain rebuild` | Rebuild keyword index |
| `/brain embed` | Build/rebuild embedding index |
| `/brain status` | Show brain status (docs, index, embeddings) |
| `/brain review` | Review pending brain changes (git diff) |
| `/brain undo` | Undo last brain write |
| `/learn` | Reflect on session and auto-update memory + NEX.md |
| `/permissions` | Show tool permissions |
| `/allow <tool>` | Auto-allow a tool |
| `/deny <tool>` | Block a tool |
| `/plan [task]` | Plan mode (analyze before executing) |
| `/plan edit` | Open current plan in `$EDITOR` for review/modification |
| `/plans` | List saved plans |
| `/auto [level]` | Set autonomy: interactive/semi-auto/autonomous |
| `/commit [msg]` | Smart commit (analyze diff, suggest message) |
| `/diff` | Show current diff |
| `/branch [name]` | Create feature branch |
| `/mcp` | MCP servers and tools |
| `/hooks` | Show configured hooks |
| `/skills` | List, enable, disable skills |
| `/tree [depth]` | Show project file tree (default depth 3) |
| `/undo` | Undo last file change |
| `/redo` | Redo last undone change |
| `/history` | Show file change history |
| `/snapshot [name]` | Create a named git snapshot of current changes |
| `/restore [name\|last]` | Restore a previously created snapshot |
| `/review [--strict] [file]` | Deep code review: 3-phase protocol (broad scan → grep deep-dive → report), score table, diff fix snippets. `--strict` forces ≥3 critical findings. |
| `/k8s [user@host]` | Kubernetes overview: namespaces + pod health (remote via SSH optional) |
| `/setup` | Interactive setup wizard — configure provider, API keys, web search |
| `/benchmark [--quick\|--discover\|--history]` | Rank models on nex-code tool-calling tasks, auto-update routing |
| `/install-skill <url>` | Install a skill from a git repo |
| `/search-skill <query>` | Search GitHub for nex-code skills |
| `/remove-skill <name>` | Remove an installed skill |
| `/audit` | Show tool execution audit summary |
| `/exit` | Quit |

---

## Tools

The agent has 45 built-in tools:

### Core & File System
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

### Git & Web
| Tool | Description |
|------|-------------|
| `git_status` | Git working tree status |
| `git_diff` | Git diff with optional path filter |
| `git_log` | Git commit history with configurable count |
| `web_fetch` | Fetch content from a URL |
| `web_search` | Grounded search via Perplexity (if `PERPLEXITY_API_KEY` set) or DuckDuckGo |

### Interaction & Agents
| Tool | Description |
|------|-------------|
| `ask_user` | Ask the user a question and wait for input |
| `task_list` | Create and manage task lists for multi-step operations |
| `spawn_agents` | Run parallel sub-agents with auto model routing |
| `switch_model` | Switch active model mid-conversation |

### Browser (optional — requires Playwright)
| Tool | Description |
|------|-------------|
| `browser_open` | Open URL in headless browser, return text + links (JS-heavy pages) |
| `browser_screenshot` | Screenshot a URL → saved file + vision-ready path |
| `browser_click` | Click element by CSS selector or visible text |
| `browser_fill` | Fill form field and optionally submit |

### GitHub Actions
| Tool | Description |
|------|-------------|
| `gh_run_list` | List GitHub Actions workflow runs |
| `gh_run_view` | View run details and step logs |
| `gh_workflow_trigger` | Trigger a workflow dispatch event |
| `k8s_pods` | List Kubernetes pods (local kubectl or remote via SSH) |
| `k8s_logs` | Fetch pod logs with `--tail` / `--since` filtering |
| `k8s_exec` | Run a command inside a pod (with confirmation) |
| `k8s_apply` | Apply a manifest file — `dry_run` mode supported (with confirmation) |
| `k8s_rollout` | Rollout status / restart / history / undo for deployments |

### SSH & Server Management
Requires `.nex/servers.json` — run `/init` to configure. See [Server Management](#server-management).

| Tool | Description |
|------|-------------|
| `ssh_exec` | Execute a command on a remote server via SSH |
| `ssh_upload` | Upload a file or directory via SCP |
| `ssh_download` | Download a file or directory via SCP |
| `service_manage` | Start/stop/restart/reload/enable/disable a systemd service (local or remote) |
| `service_logs` | Fetch journalctl logs (local or remote, with `--since` support) |
| `sysadmin` | Senior sysadmin operations on any Linux server (local or SSH). Actions: `audit` (full health overview), `disk_usage`, `process_list`, `network_status`, `package` (dnf/apt auto-detect), `user_manage` (list/create/delete/add\_ssh\_key), `firewall` (firewalld/ufw/iptables auto-detect), `cron` (list/add/remove), `ssl_check` (domain or cert file), `log_tail` (any log), `find_large` (big files by size). Read-only actions run without confirmation; state-changing actions require approval. |
| `remote_agent` | Delegate a full coding task to a **nex-code instance running on a remote server** via SSH. Writes the task to a temp file, executes `nex-code --prompt-file ... --auto` on the remote, and streams back the result. Requires `.nex/servers.json`. Optional `project_path` (defaults to remote home dir) and `model` override. Timeout: 5 minutes. |

### Docker
| Tool | Description |
|------|-------------|
| `container_list` | List Docker containers (local or remote via SSH) |
| `container_logs` | Fetch Docker container logs (`--tail`, `--since`) |
| `container_exec` | Execute a command inside a running container |
| `container_manage` | Start/stop/restart/remove/inspect a container |

### Deploy
| Tool | Description |
|------|-------------|
| `deploy` | Deploy to a remote server via **rsync** (sync local files) or **git** (git pull on remote) + optional post-deploy script + optional health check. Supports named configs from `.nex/deploy.json`. |
| `deployment_status` | Check deployment health across all configured servers — server reachability, service status, health checks. Reads `.nex/deploy.json`. |

### Frontend Design
| Tool | Description |
|------|-------------|
| `frontend_recon` | **Mandatory first step before any frontend work.** Scans the project and returns: (1) design tokens — CSS custom properties (`:root`), Tailwind theme colors/fonts, (2) main layout/index page structure, (3) a reference component of the same type (`type=` hint), (4) detected JS/CSS framework stack — Vue/React, Alpine.js v2 vs v3, HTMX, Tailwind, Django. Call this before writing any markup or styles so the agent uses the project's actual design system instead of inventing one. |

**Interactive commands** (vim, top, htop, ssh, tmux, fzf, etc.) are automatically detected and spawned with full TTY passthrough — no separate handling required.

**Browser tools** require Playwright (`npm install playwright && npx playwright install chromium`). nex-code works without it — browser tools return a helpful install message if missing.

Additional tools can be added via [MCP servers](#mcp) or [Skills](#skills).

---

## Server Management

nex-code has first-class support for remote server management via SSH, optimised for **AlmaLinux 9** and **macOS**.

### Setup

Run `/init` inside nex-code to interactively configure your servers:

```
> /init
```

Or create `.nex/servers.json` manually:

```json
{
  "prod": {
    "host": "94.130.37.43",
    "user": "jarvis",
    "port": 22,
    "key": "~/.ssh/id_rsa",
    "os": "almalinux9",
    "sudo": true
  },
  "macbook": {
    "host": "192.168.1.10",
    "user": "lukas",
    "os": "macos"
  }
}
```

**OS values**: `almalinux9`, `almalinux8`, `ubuntu`, `debian`, `macos`

When `.nex/servers.json` exists, the agent automatically receives OS-aware context:
- **AlmaLinux 9**: `dnf`, `firewalld`, `systemctl`, SELinux hints
- **macOS**: `brew`, `launchctl`, `log show` instead of `journalctl`

### Slash Commands

| Command | Description |
|---------|-------------|
| `/servers` | List all configured server profiles |
| `/servers ping` | Check SSH connectivity for all servers in parallel |
| `/servers ping <name>` | Check a specific server |
| `/docker` | List running containers across all servers + local |
| `/docker -a` | Include stopped containers |
| `/deploy` | List all named deploy configs |
| `/deploy <name>` | Run a named deploy (with confirmation) |
| `/deploy <name> --dry-run` | Preview without syncing |
| `/init` | Interactive wizard: create `.nex/servers.json` |
| `/init deploy` | Interactive wizard: create `.nex/deploy.json` |

### Named Deploy Configs

Create `.nex/deploy.json` (or use `/init deploy`):

```json
{
  "prod": {
    "server": "prod",
    "method": "rsync",
    "local_path": "dist/",
    "remote_path": "/var/www/app",
    "exclude": ["node_modules", ".env"],
    "deploy_script": "systemctl restart gunicorn",
    "health_check": "https://myapp.example.com/health"
  },
  "api": {
    "server": "prod",
    "method": "git",
    "remote_path": "/home/jarvis/my-api",
    "branch": "main",
    "deploy_script": "npm ci --omit=dev && sudo systemctl restart my-api",
    "health_check": "systemctl is-active my-api"
  }
}
```

Then deploy with:
```
> /deploy prod
```

Or from within a conversation:
```
deploy the latest build to prod
```

---

## Features

### Compact Output
The agent loop uses a bouncing-ball spinner (`● · · · ·` → `· ● · · ·` → …) during tool execution, then prints compact 1-line summaries:
```
  ●     ▸ 3 tools: read_file, grep, edit_file
  ✓ read_file src/app.js (45 lines)
  ✓ grep TODO → 12 matches
  ✗ edit_file src/x.js → old_text not found
```

After multi-step tasks, a résumé and context-aware follow-up suggestions are shown:
```
  ── 3 steps · 8 tools · 2 files modified · 37s ──
  💡 /diff · /commit · /undo
```
Step counts match between inline `── step N ──` markers and the résumé. Elapsed time is included. Read-heavy sessions (analysis, status checks) suggest `/save · /clear` instead.

When the model runs tools but produces no visible text, an automatic nudge forces it to summarize findings — preventing silent completions where the user sees nothing.

### Response Quality
The system prompt enforces substantive responses: the model always presents findings as formatted text after using tools (users only see 1-line tool summaries). Responses use markdown with headers, bullet lists, and code blocks. The model states its approach before non-trivial tasks and summarizes results after completing work.

**Language:** By default (`NEX_LANGUAGE=auto`), the model mirrors the language of the user's message — write in German, get a German response; write in English, get an English response. Set `NEX_LANGUAGE=English` (or any language) to force a fixed response language.

**Code examples:** The model is instructed to always show actual, working code — never pseudocode or placeholder snippets.

### Performance
- **Asynchronous I/O**: The entire CLI is built on non-blocking I/O. File reads, writes, and git operations never block the main thread, keeping the UI responsive even during heavy tasks.
- **Fast Startup**: Pre-bundled with `esbuild` to minimize module loading overhead, achieving sub-100ms startup times.
- **In-Memory Indexing**: A background indexing engine (using `ripgrep` or a fast fallback) keeps project file paths in RAM for instant file discovery, path auto-fixing, and glob searches.

### Streaming Output
Tokens appear live as the model generates them. Bouncing-ball spinner during connection, then real-time line-by-line rendering via `StreamRenderer` with terminal width-aware word wrapping, markdown formatting, and syntax highlighting (JS, TS, Python, Go, Rust, CSS, HTML, and more).

### Paste Detection
Automatic bracketed paste mode: pasting multi-line text into the prompt is detected and combined into a single input. A `[Pasted content — N lines]` indicator is shown with a preview of the first line. The user must press Enter to send — pasted content never auto-fires. The paste handler stores the combined text and waits for explicit submission.

### Ctrl+C Cancellation
Pressing Ctrl+C during a running request immediately cancels the active HTTP stream and returns to the prompt:
- An `AbortController` signal flows from the readline SIGINT handler through the agent loop to the provider's HTTP request
- All providers (Ollama, OpenAI, Anthropic, Gemini, local) destroy the response stream on abort
- No EPIPE errors after cancellation (stdout writes are EPIPE-guarded)
- During processing: first Ctrl+C aborts the task and returns to prompt; second Ctrl+C force-exits
- At the idle prompt: first Ctrl+C shows `(Press Ctrl+C again to exit)`, second Ctrl+C exits (hint resets after 2 s)
- readline intercepts Ctrl+C on TTY (`rl.on('SIGINT')`) to prevent readline close → `process.exit(0)` race

### Diff Preview
Every file change is shown in a diff-style format before being applied:
- **Header**: `⏺ Update(file)` or `⏺ Create(file)` with relative path
- **Summary**: `⎿  Added N lines, removed M lines`
- **Numbered lines**: right-justified line numbers with red `-` / green `+` markers
- **Context**: 3 lines of surrounding context per change, multiple hunks separated by `···`
- OOM-safe: large diffs (>2000 lines) fall back to add/remove instead of LCS
- All changes require `[y/n]` confirmation (toggle with `/autoconfirm` or start with `-yolo`)

### Terminal Theme Detection
Nex Code automatically adapts all colours to your terminal's background:

- **Dark terminals** — bright, saturated palette with `\x1b[2m` dim for muted text
- **Light/white terminals** — darker, high-contrast palette; dim replaced with explicit grey to stay visible on white backgrounds; command echo uses a light blue-grey highlight instead of dark grey

Detection priority:
1. `NEX_THEME=light|dark` env var — explicit override, useful if auto-detection is wrong
2. `COLORFGBG` env var — set by iTerm2 and other terminals
3. **OSC 11 query** — asks the terminal emulator directly for its background colour (works with Apple Terminal, iTerm2, WezTerm, Ghostty, and most xterm-compatible terminals). Result is cached per terminal session in `~/.nex-code/.theme_cache.json`, so the one-time ~100 ms startup cost only occurs on first launch in each terminal window.
4. Default → dark

If you use multiple Apple Terminal profiles (e.g. white, dark teal, dark green), each window is detected independently — no manual configuration needed.

### Auto-Context
On startup, the CLI reads your project and injects context into the system prompt:
- `package.json` — name, version, scripts, dependencies
- `README.md` — first 50 lines
- Git info — branch, status, recent commits
- `.gitignore` content
- **Merge conflicts** — detected and shown as a red warning; included in LLM context so the agent avoids editing conflicted files

### Context Engine
Automatic token management with compression when the context window gets full. Tracks token usage across system prompt, conversation, tool results, and tool definitions.

### Safety Layer
Three tiers of protection:
- **Forbidden** (blocked): `rm -rf /`, `rm -rf .`, `mkfs`, `dd if=`, fork bombs, `curl|sh`, `cat .env`, `chmod 777`, reverse shells — 30+ patterns
- **Critical** (always re-prompted, even in YOLO mode): `rm -rf`, `sudo`, `--no-verify` (hook bypass), `git reset --hard`, `git clean -f`, `git checkout --`, `git push --force` — every run requires explicit confirmation, no exceptions
- **Notable** (confirmation on first use): `git push`, `npm publish`, `ssh`, `HUSKY=0`, `SKIP_HUSKY=1` — first-time prompt, then respects "always allow"
- **SSH read-only safe list**: Common read-only SSH commands (`systemctl status`, `journalctl`, `tail`, `cat`, `git pull`, etc.) skip the dangerous-command confirmation
- **Path protection**: Sensitive paths (`.ssh/`, `.aws/`, `.env`, credentials) are blocked from file operations
- **Loop detection**: Edit-loop abort after 4 edits to the same file (warn at 2); bash-command loop abort after 8 identical commands (warn at 5); consecutive-error abort after 10 failures (warn at 6)
- **Stale-stream detection**: Warns after 60 s without tokens (shows retry count + seconds until auto-abort); auto-switches to the fast model on retry 1 and offers interactive recovery when all retries are exhausted
- **Auto Plan Mode**: Implementation tasks (`implement`, `refactor`, `create`, `build`, `add`, `write`, …) automatically activate plan mode — read-only analysis first, approve before any writes. Disable with `NEX_AUTO_PLAN=0`
- **Intent-first behavior**: Before executing, the agent understands why you asked. If it finds something that contradicts or already satisfies the task, it asks instead of proceeding blindly
- **Pre-push secret detection**: Git hook scans diffs for API keys, private keys, hardcoded secrets, SSH+IP patterns, and `.env` leaks before allowing push
- **Post-merge automation**: Auto-bumps patch version on `devel→main` merge; runs `npm install` when `package.json` changes

### Sessions
nex-code automatically saves your conversation after every turn. If the process crashes or is closed unexpectedly, the next startup will detect the autosave and offer to restore it:

```
Previous session found. Resume? (y/n)
```

Only sessions from the last 24 hours are offered for auto-resume. Older autosaves are silently skipped.

**Session commands:**

| Command | Description |
|---------|-------------|
| `/save <name>` | Save current conversation under a named slot |
| `/load <name>` | Restore a previously saved session |
| `/sessions` | List all saved sessions with message count and timestamp |
| `/resume` | Resume the most recently saved session |

```
/save my-feature        # save with name
/load my-feature        # restore by name
/sessions               # list all saved sessions
/resume                 # restore the latest session
```

Sessions are stored in `.nex/sessions/` as JSON files. Auto-saves always write to `_autosave` (overwritten each turn). Writes are atomic — a temp file is written and renamed, so a crash mid-write never corrupts the saved state.

### Memory
Persistent project memory that survives across sessions:
```
/remember lang=TypeScript
/remember always use yarn instead of npm
/memory
/forget lang
```

Also loads `NEX.md` from project root for project-level instructions.

### Brain — Persistent Knowledge Base
A project-scoped knowledge base stored in `.nex/brain/`. The agent automatically retrieves relevant documents for each query and can write new entries as it discovers useful patterns, decisions, or context:
```
/brain add auth-flow         # add a document (prompted for content)
/brain search "jwt token"    # keyword + semantic search
/brain list                  # list all documents
/brain show auth-flow        # display a document
/brain remove auth-flow      # delete a document
/brain status                # index health (docs, keywords, embeddings)
/brain review                # git diff of recent brain writes
/brain undo                  # undo last brain write
```
The agent uses the `brain_write` tool to save discoveries automatically. All writes are tracked in git so you can review, revert, or audit what the agent has stored.

### Plan Mode
Analyze before executing — the agent explores the codebase with read-only tools, produces a structured plan, then you approve before any changes are made.

**Auto Plan Mode** — nex-code automatically activates plan mode when it detects an implementation task (prompts containing `implement`, `refactor`, `create`, `build`, `add`, `write`, etc.). No manual `/plan` needed:
```
> implement a search endpoint    # → Auto Plan Mode activates immediately
> refactor the auth module       # → Auto Plan Mode activates immediately
> how does auth work?            # → normal mode (question, not implementation)
```
Disable with `NEX_AUTO_PLAN=0` if you prefer manual control.

```
/plan refactor the auth module   # manual: enter plan mode with optional task
/plan status                     # show extracted steps with status icons
/plan edit                       # open plan in $EDITOR (nano/vim/code) to modify
/plan approve                    # approve and exit plan mode (all tools re-enabled)
/auto semi-auto                  # set autonomy level
```
Plan mode is **hard-enforced**: only read-only tools (`read_file`, `list_directory`, `search_files`, `glob`, `grep`, `web_search`, `web_fetch`, `git_status`, `git_diff`, `git_log`, `git_show`, `ask_user`) are available. Any attempt to call a write tool is blocked at the API level.

**Step extraction**: when the LLM outputs a numbered plan, steps are automatically parsed into a structured list. During execution the spinner shows `Plan step 2/4: Implement tests` and `/plan status` shows per-step progress (○ pending → → in progress → ✓ done). The plan text is saved to `.nex/plans/current-plan.md`.

### Snapshots
Named git snapshots — save and restore working-tree state at any point:
```
/snapshot before-refactor   # create snapshot named "before-refactor"
/snapshot list               # list all saved snapshots
/restore last                # restore most recent snapshot
/restore before-refactor     # restore by name
/restore list                # show all available snapshots
```
Snapshots use `git stash` internally — no extra state files. The working tree is restored immediately after stashing so your changes are preserved. Use `/restore` when you want to roll back to a known-good state.

### File Tree
Visualize the project structure:
```
/tree          # show tree at depth 3
/tree 2        # shallower view
/tree 5        # deeper view (max 8)
```
Automatically excludes `node_modules`, `.git`, `dist`, `build`, `coverage`, and all entries listed in `.gitignore`. Directories are sorted before files.

### Undo / Redo (Persistent)
Undo/redo for all file changes (write, edit, patch) — **survives restart**:
```
/undo                # undo last file change
/redo                # redo last undone change
/history             # show file change history
```
Undo stack holds up to 50 changes, persisted to `.nex/history/`. Large files (>100KB) are deduplicated via SHA-256 blob storage. History is auto-pruned after 7 days. `/clear` resets the in-memory stack.

> **Snapshots vs Undo**: `/undo` operates on the persistent change stack for fine-grained per-file rollback across sessions. `/snapshot` + `/restore` use git stash for broader checkpoints across multiple files.

### Desktop Notifications
On macOS, nex-code fires a system notification when a task completes after ≥ 30 seconds — useful when running long autonomous tasks in the background. No configuration needed; requires macOS Notification Center access.

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
- Bouncing-ball spinner (`●` ping-pong across 5 positions) with elapsed time display
- Per-task status icons: `✔` done, `◼` in progress, `◻` pending, `✗` failed
- Automatically pauses during text streaming and resumes during tool execution
- Falls back to the static `/tasks` view when no live display is active

### Sub-Agents
Spawn parallel sub-agents for independent tasks:
- Up to 5 agents run simultaneously with their own conversation contexts
- File locking prevents concurrent writes to the same file (intra-process sub-agents)
- Multi-progress display shows real-time status of each agent
- Good for: reading multiple files, analyzing separate modules, independent research

### Parallel Sessions
Running multiple nex-code instances in the same project directory is safe. All shared state files (`.nex/memory/memory.json`, `.nex/config.json`, `NEX.md`, brain index) use advisory inter-process locking (`O_EXCL` lock files with stale-lock reclaim) and atomic writes (temp file + `rename`). A session in Terminal A and a session in Terminal B can both call `/remember`, `/allow`, or `/learn` simultaneously without data corruption.

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

**Stale Stream Recovery** — Progressive retry strategy when streams stall (common with large Ollama models after many agent steps):
- 1st retry: 3s backoff delay, resend same context (handles transient stalls)
- 2nd retry: force-compress conversation (~80k tokens freed), 5s delay, retry with smaller context
- Last resort: if retries exhausted, one final force-compress + reset for fresh attempts
- Broader context-too-long detection catches Ollama-specific error formats (`num_ctx`, `prompt`, `size`, `exceeds`)

**Tool Tiers** — Dynamically reduces the tool set based on model capability:
- **essential** (5 tools): bash, read_file, write_file, edit_file, list_directory
- **standard** (21 tools): + search_files, glob, grep, ask_user, git_status, git_diff, git_log, task_list, ssh_exec, service_manage, service_logs, container_list, container_logs, container_exec, container_manage, deploy
- **full** (45 tools): all tools

Models are auto-classified, or override per-model in `.nex/config.json`:
```json
{
  "toolTiers": {
    "deepseek-r1": "essential",
    "local:*": "essential",
    "qwen3-coder": "full"
  },
  "maxIterations": 100
}
```

`maxIterations` sets the agentic loop limit project-wide (default: 50). The `--max-turns <n>` CLI flag overrides it per run.

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

### Global Skills (`~/.nex-code/skills/`)

Skills placed in `~/.nex-code/skills/` are loaded globally across all projects. Useful for cross-project workflows.

**Example: `server-agent.md`** — instructs nex-code on your Mac to delegate tasks to a nex-code instance on a remote server using the `remote_agent` tool. Define a project→server mapping table in the skill so the agent knows which path to use for each project name.

### Skill Marketplace

Install community skills directly from git:

```
/install-skill https://github.com/user/nex-skill-deploy
/install-skill user/nex-skill-deploy       # shorthand
/search-skill kubernetes                    # search GitHub
/remove-skill deploy                        # uninstall
```

Skills are cloned to `.nex/skills/{name}/` and validated (must contain `skill.json`, `.md`, or `.js` files).

### Built-in Skills

nex-code ships with built-in skills in `cli/skills/`:
- **devops** — DevOps agent instructions for SSH, Docker, deploy, and infrastructure tools

Built-in skills are loaded automatically. Project skills with the same name override built-ins.

---

## Plugins

Extend nex-code with custom tools and lifecycle hooks via `.nex/plugins/`:

```javascript
// .nex/plugins/my-plugin.js
module.exports = function setup(api) {
  api.registerTool({
    type: 'function',
    function: { name: 'my_tool', description: 'Custom tool', parameters: { type: 'object', properties: {} } }
  }, async (args) => {
    return 'result';
  });

  api.registerHook('onToolResult', (data) => {
    console.log(`Tool ${data.tool} completed`);
    return data;
  });
};
```

**Events:** `onToolResult`, `onModelResponse`, `onSessionStart`, `onSessionEnd`, `onFileChange`, `beforeToolExec`, `afterToolExec`

Plugins are loaded automatically on startup. Hook handlers can modify event data (return the modified object).

---

## Audit Logging

When `NEX_AUDIT=1` is set, all tool executions are logged to `.nex/audit/YYYY-MM-DD.jsonl`:

```
/audit                # show summary (total calls, success rate, per-tool breakdown)
```

Arguments are automatically sanitized — keys matching `key`, `token`, `password`, `secret`, or `credential` are masked. Long values (>500 chars) are truncated.

---

## Safety

nex-code includes multi-layer protections to prevent accidental damage — even in `--auto` and `--yolo` mode:

| Layer | What it guards | Bypass possible? |
|---|---|---|
| **Forbidden patterns** | `rm -rf /`, fork bombs, reverse shells, `cat .env` | No |
| **Protected paths** | Destructive bash ops (`rm`, `mv`, `truncate`, …) on `.env`, `credentials/`, `venv/`, `.ssh/`, `.aws/`, `.sqlite3`, `.git/` internals | Only via `NEX_UNPROTECT=1` |
| **Sensitive file tools** | `read_file` / `write_file` / `edit_file` on `.env`, `.ssh/`, `.npmrc`, `.kube/config`, etc. | No |
| **Critical commands** | `rm -rf`, `sudo`, `git push --force`, `git reset --hard` | Requires explicit confirmation |

**Override:** If you intentionally need to modify a protected path via bash (e.g. rotating credentials in a deploy script), set `NEX_UNPROTECT=1`:

```bash
NEX_UNPROTECT=1 nex-code
```

This disables the protected-path check only — forbidden patterns and critical-command prompts remain active.

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

- **Do not** open a public GitHub issue
- Email: **security@schoensgibl.com**
- Include: description, reproduction steps, and potential impact
- Allow up to 72 hours for initial response

---

## Team Permissions

Permission presets for team environments:

| Preset | Description |
|--------|-------------|
| `readonly` | Search and read tools only — no writes, no deploys |
| `developer` | All tools except deploy, ssh_exec, service_manage |
| `admin` | Full access to all tools |

Configure in `.nex/config.json`:
```json
{
  "permissionPreset": "developer"
}
```

Works alongside the existing per-tool `/allow` and `/deny` system.

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
├── index.js             # REPL + ~45 slash commands + history persistence + AbortController
├── agent.js             # Agentic loop + conversation state + compact output + résumé + abort handling
├── providers/           # Multi-provider abstraction
│   ├── base.js          # Abstract provider interface
│   ├── ollama.js        # Ollama Cloud provider
│   ├── openai.js        # OpenAI provider
│   ├── anthropic.js     # Anthropic provider
│   ├── gemini.js        # Google Gemini provider
│   ├── local.js         # Local Ollama server
│   └── registry.js      # Provider registry + model resolution + provider routing
├── tools.js             # 45 tool definitions + implementations + auto-fix engine
├── sub-agent.js         # Parallel sub-agent runner with file locking + model routing
├── tasks.js             # Task list management (create, update, render, onChange callbacks)
├── skills.js            # Skills system (prompt + script + marketplace)
├── plugins.js           # Plugin API (registerTool, registerHook, event system)
├── audit.js             # Tool execution audit logging (JSONL + sanitization)
├── mcp.js               # MCP client (JSON-RPC over stdio)
├── hooks.js             # Hook system (pre/post events)
├── context.js           # Auto-context (package.json, git, README) + generateFileTree()
├── context-engine.js    # Token management + relevance-based context compression
├── session.js           # Session persistence (.nex/sessions/)
├── memory.js            # Project memory (.nex/memory/ + NEX.md)
├── filelock.js          # Inter-process file locking (atomicWrite + withFileLockSync)
├── permissions.js       # Tool permission system + team presets (readonly/developer/admin)
├── planner.js           # Plan mode, step extraction, step cursor, autonomy levels
├── git.js               # Git intelligence (commit, diff, branch)
├── render.js            # Markdown + syntax highlighting + StreamRenderer + EPIPE guard
├── format.js            # Tool call formatting, result formatting, compact summaries
├── spinner.js           # Spinner, MultiProgress, TaskProgress, ToolProgress display components
├── diff.js              # LCS diff (Myers + Hirschberg) + colored output + side-by-side view
├── fuzzy-match.js       # Fuzzy text matching for edit auto-fix (Levenshtein, whitespace normalization)
├── file-history.js      # Persistent undo/redo + named git snapshots + blob storage
├── picker.js            # Interactive terminal picker (model selection)
├── costs.js             # Token cost tracking + per-provider budget limits
├── safety.js            # Forbidden/dangerous pattern detection
├── tool-validator.js    # Tool argument validation + auto-correction
├── tool-tiers.js        # Dynamic tool set selection per model + model tier lookup + edit mode
├── footer.js            # Sticky footer (scroll region, status bar, input row, resize, FOOTER_DEBUG)
├── ui.js                # ANSI colors, banner + re-exports from format.js/spinner.js
├── index-engine.js      # In-memory file index (ripgrep/fallback) + semantic content index
├── skills/devops.md     # Built-in DevOps agent skill
├── auto-fix.js          # Path resolution, edit matching, bash error hints
├── tool-retry.js        # Malformed argument retry with schema hints
└── ollama.js            # Backward-compatible wrapper
```

### Agentic Loop

```
User Input --> [AbortController created]
    |
[System Prompt + Context + Memory + Skills + Conversation]
    |
[Filter tools by model tier (essential/standard/full)]
    |
Provider API (streaming + abort signal) --> Text tokens --> rendered to terminal
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
Loop until: no more tool calls OR 50 iterations OR Ctrl+C abort
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
├── skills/            # Skill files (.md and .js)
└── push-allowlist     # False-positive allowlist for pre-push secret detection
```

---

## Performance

Nex Code v0.3.45+ includes comprehensive performance optimizations:

| Optimization | Improvement | Impact |
|--------------|-------------|--------|
| **System Prompt Caching** | 4.3× faster | 77µs → 18µs |
| **Token Estimation Caching** | 3.5× faster | Cached after first call |
| **Context File Caching** | 10-20× faster | 50-200ms → 5-10ms |
| **Debounced Auto-Save** | 0ms in hot path | Saves after 5s inactivity |
| **Tool Filter Caching** | 1.7× faster | Cached per model |
| **Schema Cache** | 3.4× faster | 2.51µs → 0.73µs |

**Average speedup:** 2.7× (micro-benchmarks)  
**Real-world improvement:** ~10× faster per turn

Run benchmarks yourself:
```bash
node benchmark.js
```

---

## Testing

```bash
npm test              # Run all tests with coverage
npm run test:watch    # Watch mode
```

57 test suites, 2059 tests, 84% statement / 77% branch coverage.

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

## Installation

```bash
npm install -g nex-code    # global install
npx nex-code               # or run without installing
```

On first launch with no API keys configured, nex-code starts an **interactive setup wizard** that guides you through choosing a provider and entering credentials. You can re-run it anytime with `/setup`.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features — VS Code extension, browser agent, PTY support, and more.
Community contributions are welcome on all roadmap items.

---

## License

MIT

<!-- Keywords: ollama cli, ollama coding assistant, claude code alternative, gemini cli alternative,
     agentic coding cli, open source ai terminal, free coding ai, qwen3 coder cli, devstral terminal,
     kimi k2 cli, multi-provider ai cli, local llm coding tool -->

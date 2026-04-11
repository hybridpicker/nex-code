<h1 align="center">nex-code</h1>

<p align="center">
  <b>Run 400B+ open coding models on your codebase — without the hardware bill.</b><br>
  Ollama Cloud first. OpenAI, Anthropic, and Gemini when you need them.
</p>

<p align="center">
  <code>npx nex-code</code>
</p>

<p align="center">
  <a href="https://github.com/hybridpicker/nex-code/stargazers">If this saves you time, a star helps others find it.</a>
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
  <img src="https://img.shields.io/badge/tests-3929-blue.svg" alt="Tests: 3920">
  <img src="https://img.shields.io/badge/VS_Code-extension-007ACC.svg" alt="VS Code extension">
</p>

---

## Demo

https://github.com/user-attachments/assets/68a6c134-2d13-4d66-bc5e-befea3acb794

---

## Quickstart

```bash
npx nex-code
# or install globally:
npm install -g nex-code && cd ~/your-project && nex-code
```

On first launch, an interactive setup wizard guides you through provider and credential configuration. Re-run anytime with `/setup`.

---

## Why nex-code?

**Ollama Cloud first.** Built and optimized for [Ollama Cloud](https://ollama.com) — the flat-rate platform running devstral, Kimi K2, Qwen3-Coder, and 47+ models. Other providers (OpenAI, Anthropic, Gemini) work via the same interface.

| Feature | nex-code | Closed-source alternatives |
|---|---|---|
| Free tier | Ollama Cloud flat-rate | subscription or limited quota |
| Open models | devstral, Kimi K2, Qwen3 | vendor-locked |
| Local Ollama | yes | no |
| Multi-provider | swap with one env var | no |
| VS Code sidebar | built-in | partial |
| Startup time | ~100ms | 1-4s |
| Runtime deps | 2 | heavy |
| Infra tools | SSH, Docker, K8s built-in | no |

**Smart model routing.** The built-in `/benchmark` tests all configured models across 62 tool-calling tasks in 5 categories and auto-routes to the best model per task type.

**Phase-based execution.** Tasks run through Plan (analyze) -> Implement (code) -> Verify (test) phases, each with the optimal model. Auto-loops back on test failures.

**45 built-in tools** across file ops, git, SSH, Docker, Kubernetes, deploy, browser, GitHub Actions, and visual review. See [Tools](#tools) for the full list.

**2 runtime dependencies** (`axios`, `dotenv`). Starts in ~100ms. No Python, no heavy runtime.

---

## Ollama Cloud Model Rankings

Rankings from nex-code's own `/benchmark` — 62 tasks testing tool selection, argument validity, and schema compliance.

<!-- nex-benchmark-start -->
<!-- Updated: 2026-04-09 — run `/benchmark --discover` after new Ollama Cloud releases -->

| Rank | Model | Score | Avg Latency | Context | Best For |
|---|---|---|---|---|---|
| 🥇 | `qwen3-vl:235b` | **80.1** | 12.9s | 131K | Overall #1 — frontier tool selection, data + agentic tasks |
| 🥈 | `rnj-1:8b` | 78.6 | 2.7s | 131K | — |
| 🥉 | `qwen3-vl:235b-instruct` | 78.4 | 7.3s | 131K | Best latency/score balance — recommended default |
| — | `nemotron-3-super` | 76.2 | 2.8s | 256K | — |
| — | `deepseek-v3.1:671b` | 74.8 | 5.6s | 131K | — |
| — | `qwen3-coder-next` | 74.5 | 2.9s | 256K | — |
| — | `ministral-3:3b` | 73.6 | 2.4s | 32K | — |
| — | `ministral-3:8b` | 72.6 | 1.9s | 131K | Fastest strong model — 2.2s latency, 70+ score |
| — | `qwen3-next:80b` | 72.2 | 11.5s | 131K | — |
| — | `mistral-large-3:675b` | 70.9 | 5.7s | 131K | — |
| — | `devstral-small-2:24b` | 70.9 | 2.8s | 131K | Fast sub-agents, simple lookups |
| — | `devstral-2:123b` | 70.9 | 4.0s | 131K | Sysadmin + SSH tasks, reliable coding |
| — | `minimax-m2.1` | 70.7 | 4.3s | 200K | — |
| — | `gpt-oss:20b` | 70.2 | 3.9s | 131K | Fast small model, good overall score |
| — | `kimi-k2:1t` | 69.9 | 5.0s | 256K | Large repos (>100K tokens) |
| — | `kimi-k2.5` | 69 | 5.8s | 256K | Large repos — faster than k2:1t |
| — | `kimi-k2-thinking` | 69 | 4.0s | 256K | — |
| — | `glm-5` | 69 | 7.2s | 131K | — |
| — | `glm-5.1` | 68.8 | 9.7s | ? | — |
| — | `gemma4:31b` | 68.7 | 3.3s | ? | — |
| — | `minimax-m2.7` | 68.6 | 5.1s | 200K | — |
| — | `nemotron-3-nano:30b` | 67.8 | 2.9s | 131K | — |
| — | `ministral-3:14b` | 67.7 | 2.3s | 131K | — |
| — | `qwen3-coder:480b` | 67.2 | 7.7s | 131K | Heavy coding sessions, large context |
| — | `qwen3.5:397b` | 67.1 | 7.2s | 256K | — |
| — | `glm-4.6` | 65.2 | 7.5s | 131K | — |
| — | `gpt-oss:120b` | 64.6 | 3.7s | 131K | — |

> Rankings are nex-code-specific: tool name accuracy, argument validity, schema compliance.
> Toolathon (Minimax SOTA) measures different task types — run `/benchmark --discover` after model releases.
<!-- nex-benchmark-end -->

**Recommended `.env`:**

```env
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=devstral-2:123b
NEX_HEAVY_MODEL=qwen3-coder:480b
NEX_STANDARD_MODEL=devstral-2:123b
NEX_FAST_MODEL=devstral-small-2:24b
```

---

## Setup

**Prerequisites:** Node.js 18+ and at least one API key (or local Ollama).

```bash
# .env (or set environment variables)
OLLAMA_API_KEY=your-key       # Ollama Cloud
OPENAI_API_KEY=your-key       # OpenAI
ANTHROPIC_API_KEY=your-key    # Anthropic
GEMINI_API_KEY=your-key       # Gemini
PERPLEXITY_API_KEY=your-key   # optional — enables grounded web search

DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=devstral-2:123b
```

**Env file precedence.** nex-code loads `.env` from three places in this order:

1. Install directory `.env` — non-override, fills blanks only
2. `~/.nex-code/.env` — **override**, wins over ambient `process.env`
3. Current working directory `.env` — non-override, cannot clobber the global config

`~/.nex-code/.env` is the authoritative location for long-lived config like `OLLAMA_API_KEY`. The `override:true` on that file exists so that a rotated key written there takes effect on the next `nex-code` launch, even when nex-code is spawned by a long-running parent process (systemd daemon, supervisor agent, test runner) whose own environment was captured earlier and is now stale. If you rotate an API key, update `~/.nex-code/.env` **and** restart any long-running daemon that spawns nex-code — the `override:true` fixes subprocess launches but cannot refresh the parent's own captured `process.env`.

**Install from source:**

```bash
git clone https://github.com/hybridpicker/nex-code.git
cd nex-code && npm install && npm run build
cp .env.example .env && npm link && npm run install-hooks
```

---

## Usage

```
> explain the main function in index.js
> add input validation to the createUser handler
> run the tests and fix any failures
> the /users endpoint returns 500 — find the bug and fix it
```

### YOLO Mode

Skip all confirmations — file changes, dangerous commands, and tool permissions are auto-approved. Auto-runs `caffeinate` on macOS.

```bash
nex-code -yolo
```

### Headless / Programmatic Mode

```bash
nex-code --task "refactor src/index.js to async/await" --yolo
nex-code --prompt-file /tmp/task.txt --yolo --json
nex-code --daemon          # watch mode: fires tasks on file changes, git commits, or cron
```

| Flag | Description |
|---|---|
| `--task <prompt>` | Run a single prompt and exit |
| `--prompt-file <path>` | Read prompt from file |
| `--yolo` | Skip all confirmations |
| `--server` | JSON-lines IPC server (VS Code extension) |
| `--daemon` | Background watcher (reads `.nex/daemon.json`) |
| `--flatrate` | 100 turns, 6 parallel agents, 5 retries |
| `--json` | JSON output to stdout |
| `--max-turns <n>` | Override agentic loop limit |
| `--model <spec>` | Use specific model (e.g. `anthropic:claude-sonnet-4-6`) |
| `--debug` | Show diagnostic messages |
| `--gemini` | Local Gemini test mode (`gemini-3.1-pro-preview` by default, requires `GEMINI_API_KEY`) |
| `--gemini-model <id>` | Pin a specific Gemini model (implies `--gemini`) |

### Vision / Screenshot

```
> /path/to/screenshot.png implement this UI in React
> analyze https://example.com/mockup.png and implement it
> what's wrong with the layout in my clipboard    # macOS clipboard capture
> screenshot localhost:3000 and review the navbar spacing
```

Works with Anthropic, OpenAI, Gemini, and Ollama vision models. Formats: PNG, JPG, GIF, WebP, BMP.

---

## Providers & Models

```
/model                         # interactive picker
/model openai:gpt-4o           # switch directly
/providers                     # list all
/fallback anthropic,openai     # auto-switch on failure
```

| Provider | Models | Env Variable |
|---|---|---|
| **ollama** | Qwen3, DeepSeek R1, Devstral, Kimi K2, MiniMax, GLM, Llama 4 | `OLLAMA_API_KEY` |
| **openai** | GPT-4o, GPT-4.1, o1, o3, o4-mini | `OPENAI_API_KEY` |
| **anthropic** | Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 | `ANTHROPIC_API_KEY` |
| **gemini** | Gemini 3.1 Pro, 2.5 Pro/Flash | `GEMINI_API_KEY` |
| **local** | Any local Ollama model | (none) |

---

## Commands

Type `/` to see inline suggestions. Tab completion for slash commands and file paths.

| Command | Description |
|---|---|
| `/help` | Full help |
| `/model [spec]` | Show/switch model |
| `/providers` | List providers |
| `/clear` | Clear conversation |
| `/save` / `/load` / `/sessions` / `/resume` | Session management |
| `/branches` / `/fork` / `/switch-branch` / `/goto` | Session tree navigation |
| `/remember` / `/forget` / `/memory` | Persistent memory |
| `/brain add\|list\|search\|show\|remove` | Knowledge base |
| `/plan [task]` / `/plan edit` / `/plan approve` | Plan mode |
| `/commit [msg]` / `/diff` / `/branch` | Git intelligence |
| `/undo` / `/redo` / `/history` | Persistent undo/redo |
| `/snapshot [name]` / `/restore` | Git snapshots |
| `/permissions` / `/allow` / `/deny` | Tool permissions |
| `/costs` / `/budget` | Cost tracking and limits |
| `/review [--strict]` | Deep code review |
| `/benchmark` | Model ranking (62 tasks) |
| `/autoresearch` / `/ar-self-improve` | Autonomous optimization loops |
| `/servers` / `/docker` / `/deploy` / `/k8s` | Infrastructure management |
| `/skills` / `/install-skill` / `/mcp` / `/hooks` | Extensibility |
| `/tree [depth]` | Project file tree |
| `/audit` | Tool execution audit |
| `/setup` | Interactive setup wizard |

---

## Tools

45 built-in tools organized by category:

**Core:** `bash`, `read_file`, `write_file`, `edit_file`, `patch_file`, `list_directory`, `search_files`, `glob`, `grep`

**Git & Web:** `git_status`, `git_diff`, `git_log`, `web_fetch`, `web_search`

**Agents:** `ask_user`, `task_list`, `spawn_agents`, `switch_model`

**Browser** (optional, requires Playwright): `browser_open`, `browser_screenshot`, `browser_click`, `browser_fill`

**GitHub Actions & K8s:** `gh_run_list`, `gh_run_view`, `gh_workflow_trigger`, `k8s_pods`, `k8s_logs`, `k8s_exec`, `k8s_apply`, `k8s_rollout`

**SSH & Server:** `ssh_exec`, `ssh_upload`, `ssh_download`, `service_manage`, `service_logs`, `sysadmin`, `remote_agent`

**Docker:** `container_list`, `container_logs`, `container_exec`, `container_manage`

**Deploy:** `deploy`, `deployment_status`

**Frontend:** `frontend_recon` — scans design tokens, layout, framework stack before any frontend work

**Visual:** `visual_diff`, `responsive_sweep`, `visual_annotate`, `visual_watch`, `design_tokens`, `design_compare`

Additional tools via [MCP servers](#mcp) or [Skills](#skills).

---

## Key Features

### Multi-Agent Orchestrator

Multi-goal prompts auto-decompose into parallel sub-agents. Up to 5 agents run simultaneously with file locking.

```bash
nex-code --task "fix type errors in src/, add JSDoc to utils/, update CHANGELOG"
```

### Background Agents

Sub-agents can run non-blocking in isolated forked processes. The main agent continues working while background workers complete, then results are automatically injected into the conversation.

```
# The model decides when to use background:true — no extra syntax needed.
# Example: the model might run the linter in background while explaining code.
spawn_agents([
  { task: "run the linter and report errors", background: true },
  { task: "explain the auth module" }   ← main agent answers this immediately
])
```

Background agents are shown in the spinner: `● Thinking [1 bg agent running]`. Results appear as `✓ Background agent done: …` when workers finish.

### Autoresearch

Autonomous optimization loops: edit -> experiment -> keep/revert, on a dedicated branch.

```
/autoresearch reduce test runtime while maintaining correctness
/ar-self-improve          # self-improvement using nex-code's benchmark
```

### Plan Mode

Auto-activates for implementation tasks. Read-only analysis first, approve before writes. Hard-enforced tool restrictions.

### Daemon / Watch Mode

Background process that fires tasks on file changes, git commits, or cron schedule. Configured via `.nex/daemon.json`. Desktop and Matrix notifications.

### Session Trees

Navigate conversation history like git branches — fork, switch, goto, delete branches.

### Safety

| Layer | What it guards | Bypass? |
|---|---|---|
| **Forbidden patterns** | `rm -rf /`, fork bombs, reverse shells, `cat .env` | No |
| **Protected paths** | Destructive ops on `.env`, `.ssh/`, `.aws/`, `.git/` | `NEX_UNPROTECT=1` |
| **Sensitive file tools** | read/write/edit on `.env`, `.ssh/`, `.npmrc`, `.kube/` | No |
| **Critical commands** | `rm -rf`, `sudo`, `git push --force`, `git reset --hard` | Explicit confirmation |

Pre-push secret detection, audit logging (JSONL), persistent undo/redo, cost limits, auto plan mode.

### Open-Source Model Robustness

- **5-layer argument parsing** — JSON, trailing fix, extraction, key repair, fence stripping
- **Tool call retry with schema hints** — malformed args get the expected schema for self-correction
- **Auto-fix engine** — path resolution, edit fuzzy matching (Levenshtein), bash error hints
- **Tool tiers** — essential (5) / standard (21) / full (45), auto-selected per model capability
- **Stale stream recovery** — progressive retry with context compression on stall

### Visual Development Tools

Pixel-level before/after comparison, responsive sweeps (320-1920px), annotation overlays, design token extraction, and live-reload diff watching. Pure image tools work standalone; browser-based tools need Playwright.

---

## Extensibility

### Skills

Drop `.md` or `.js` files in `.nex/skills/` for project-specific knowledge, commands, and tools. Global skills in `~/.nex-code/skills/`. Install from git: `/install-skill user/repo`.

### Plugins

Custom tools and lifecycle hooks via `.nex/plugins/`. Events: `onToolResult`, `onModelResponse`, `onSessionStart`, `onSessionEnd`, `onFileChange`, `beforeToolExec`, `afterToolExec`.

### MCP

Connect external tool servers via [Model Context Protocol](https://modelcontextprotocol.io). Configure in `.nex/mcp.json` with env var interpolation.

### Hooks

Run custom scripts on CLI events (`pre-tool`, `post-tool`, `pre-commit`, `post-response`, `session-start`, `session-end`). Configure in `.nex/config.json` or `.nex/hooks/`.

---

## VS Code Extension

Built-in sidebar chat panel (`vscode/`) with streaming output, collapsible tool cards, and native theme support. Spawns `nex-code --server` over JSON-lines IPC.

```bash
cd vscode && npm install && npm run package
# Cmd+Shift+P -> Extensions: Install from VSIX...
```

---

## Architecture

```
bin/nex-code.js          # Entrypoint
cli/
  agent.js               # Agentic loop + conversation state + guards
  providers/             # Ollama, OpenAI, Anthropic, Gemini, Local + wire protocols
  tools/index.js         # 45 tool definitions + auto-fix engine
  context-engine.js      # Token management + 5-phase compression
  sub-agent.js           # Parallel sub-agents with file locking
  orchestrator.js        # Multi-agent decompose -> execute -> synthesize
  session-tree.js        # Session branching
  visual.js              # Visual dev tools (pixelmatch-based)
  browser.js             # Playwright browser agent
  skills/                # Built-in + user skills
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for full architecture details.

---

## Testing

```bash
npm test              # 97 suites, 3920 tests
npm run typecheck     # TypeScript noEmit check
npm run benchmark:gate        # 7-task smoke test (blocks push on regression)
npm run benchmark:reallife    # 35 real-world tasks across 7 categories
```

---

## Security

- Pre-push secret detection (API keys, private keys, hardcoded credentials)
- Audit logging with automatic argument sanitization
- Sensitive path blocking (`.ssh/`, `.aws/`, `.env`, credentials)
- Shell injection protection via `execFileSync` with argument arrays
- SSRF protection on `web_fetch`
- MCP environment isolation

**Reporting vulnerabilities:** Email **security@schoensgibl.com** (not a public issue). Allow 72h for initial response.

---

## License

MIT

<!-- Keywords: ollama cli, ollama coding assistant, claude code alternative, gemini cli alternative,
     agentic coding cli, open source ai terminal, free coding ai, qwen3 coder cli, devstral terminal,
     kimi k2 cli, multi-provider ai cli, local llm coding tool -->

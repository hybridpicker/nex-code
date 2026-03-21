# Nex Code — Project Instructions

## Project Overview

Standalone agentic coding CLI. Provider-agnostic, lightweight, open-source.
Repo: `github.com/hybridpicker/nex-code`

## Architecture

```
bin/nex-code.js       → Entrypoint (shebang, .env, startREPL)
cli/index.js             → REPL + ~38 Slash Commands + AbortController
cli/agent.js             → Agentic Loop + Conversation State + Compact Output + Résumé + Abort handling
cli/providers/           → Multi-Provider Abstraction Layer
cli/index-engine.js      → In-memory File Index (ripgrep/fallback)
  base.js                → Abstract Provider Interface
  ollama.js              → Ollama Cloud Provider (Kimi K2.5, Qwen3 Coder, DeepSeek R1, Llama 4 Scout, Devstral)
  openai.js              → OpenAI Provider (GPT-4o, GPT-4.1, o1, o3, o4-mini)
  anthropic.js           → Anthropic Provider (Claude Sonnet, Opus, Haiku, 4.5 Sonnet, 3.5 Sonnet)
  gemini.js              → Google Gemini Provider (Gemini 3.1 Pro, 2.5 Pro/Flash, 1.5 Pro/Flash)
  local.js               → Local Ollama Server Provider
  registry.js            → Provider Registry + Model Resolution + Provider Routing (5 providers)
cli/ollama.js            → Backward-compatible wrapper (delegates to providers/)
cli/tools.js             → 44 Tool Definitions + Implementations (Async I/O) + Auto-Fix (path, edit, bash hints)
cli/sub-agent.js         → Parallel Sub-Agent Runner (file locking, multi-progress, model routing)
cli/tasks.js             → Task List Management (create, update, render, dependencies, onChange callbacks)
cli/context-engine.js    → Token Management + Context Compression
cli/session.js           → Session Persistence (.nex/sessions/)
cli/memory.js            → Project Memory (.nex/memory/ + NEX.md)
cli/permissions.js       → Tool Permission System (allow/ask/deny)
cli/planner.js           → Plan Mode + Autonomy Levels
cli/git.js               → Git Intelligence (Async) (smart commit, diff, branch)
cli/render.js            → Rich Terminal Rendering (Markdown, Syntax Highlighting)
cli/mcp.js               → MCP Client (JSON-RPC over stdio)
cli/hooks.js             → Hook System (pre-tool, post-tool, etc.)
cli/diff.js              → LCS Diff + Claude Code-Style Display + Confirmations
cli/context.js           → Auto-Context (package.json, git, README)
cli/file-history.js      → In-session Undo/Redo for file changes
cli/ui.js                → ANSI Colors, Spinner, TaskProgress (live animated display), Formatting, Compact Summaries
cli/safety.js            → Forbidden/Dangerous Pattern Detection
cli/tool-validator.js    → Tool Argument Validation + Auto-Correction
cli/tool-tiers.js        → Dynamic Tool Set Selection (essential/standard/full) + Model Tier Lookup
cli/picker.js            → Interactive Terminal Picker (model selection, generic cursor-based list)
cli/footer.js            → Sticky Footer (scroll region, status bar, input row, resize handling, FOOTER_DEBUG)
cli/skills.js            → Skills System (prompt + script skills)
dist/                    → Final Bundled CLI scripts (esbuild)
tests/                   → Jest, 73 Suites, 3150+ Tests
```

## Commit Message Convention

All commit messages must be written in **English**. No exceptions.

```
feat: <short description of the new feature>
fix: <what was fixed>
test: <what is being tested>
chore: <maintenance task>
refactor: <what was restructured>
docs: <what was documented>
```

No `Co-Authored-By: Claude` or other AI attributions. NEVER.

## Security — Secrets & Credentials

- **NEVER** display passwords, tokens, API keys or other secrets in chat output
- Secrets are generated and written **directly to a local file** (chmod 600)
- Subsequent commands read secrets **from the file** — never from the chat history
- Credentials files ALWAYS added to `.gitignore`

## Git Rules

- **NEVER** add `Co-Authored-By: Claude` or other Claude/Anthropic signatures
- **NEVER** use `--no-verify` with git commit or push
- Commits are pushed WITHOUT any AI attribution

## Release Workflow

- Development on **`devel`** branch only — never commit directly to `main`
- To release: **`npm run merge-to-main`** from `devel` (clean working tree required)
  - Polls GitHub CI for current devel HEAD — waits if running, aborts if failed
  - Merges into main only when CI is green
  - post-merge hook bumps patch version, pushes main, syncs devel
  - GitHub Actions Release workflow (`release.yml`) publishes to npm automatically
- **NEVER** merge devel → main manually
- **NEVER** run `npm publish` locally — GitHub Actions is the sole publisher

## Testing

- Framework: Jest (73 suites, 3150+ tests)
- Coverage thresholds: 45% lines / 30% functions / 35% branches (global); sub-agent.js 70%/65%/55%
- Run: `npm test`
- Watch: `npm run test:watch`
- CI: GitHub Actions on push/PR (Node 20 LTS only)
- Tests needing network/TTY/CLI tools are skipped in CI via `process.env.CI ? it.skip : it`

## Provider System

### Supported Providers:
- **ollama** — Ollama Cloud (`OLLAMA_API_KEY`)
- **openai** — OpenAI API (`OPENAI_API_KEY`)
- **anthropic** — Anthropic API (`ANTHROPIC_API_KEY`)
- **gemini** — Google Gemini API (`GEMINI_API_KEY` or `GOOGLE_API_KEY`)
- **local** — Local Ollama Server (no key required)

### Model-Spec Format:
`provider:model` (e.g. `openai:gpt-4o`, `anthropic:claude-sonnet`, `gemini:gemini-2.5-flash`, `local:llama3`)

### Env Variables:
- `OLLAMA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `DEFAULT_PROVIDER` (default: `ollama`)
- `DEFAULT_MODEL` (default: provider-dependent)
- `FALLBACK_CHAIN` (comma-separated, e.g. `anthropic,openai`)
- `NEX_STALE_WARN_MS` (default: `60000`) — Warn if no tokens received for N ms
- `NEX_STALE_ABORT_MS` (default: `120000`) — Abort and retry stream after N ms without tokens

## Key Patterns

- Provider Abstraction: Each provider implements `chat()`, `stream()`, `isConfigured()`
- `registry.js` manages active provider + model, resolving model specs; shared `_tryProviders()` helper eliminates code duplication between `callStream` and `callChat`
- `agent.js` uses `registry.callStream()` with `onToken` callback for streaming, spinner during rate-limit/network retry waits
- `callChat()` has stream fallback: on chat error, `provider.stream()` is tried with no-op onToken
- Stale stream thresholds configurable via `NEX_STALE_WARN_MS` / `NEX_STALE_ABORT_MS` (default: 60s/120s)
- Streaming output is piped through `renderMarkdown()` (rich terminal rendering)
- `ollama.js` is a backward-compatible wrapper (delegates to registry)
- 44 Tools including: bash, read_file, write_file, edit_file, list_directory, search_files, glob, grep, patch_file, web_fetch, web_search, ask_user, git_status, git_diff, git_log, task_list, spawn_agents, sysadmin, remote_agent, k8s_pods, and more
- Permission system: allow/ask/deny per tool (configurable in `.nex/config.json`)
- Context Engine: token counting, auto-compression above 70% window
- Session persistence: auto-save after each turn in `.nex/sessions/`
- Project Memory: key-value + NEX.md
- Plan Mode: Analyze → Plan → Approve → Execute
- Git Intelligence: smart commit, diff analysis, branch creation
- MCP Client: JSON-RPC over stdio, tool discovery, routing via `mcp_` prefix
- Hook System: pre-tool, post-tool, pre-commit, post-response, session-start, session-end
- YOLO Mode: `nex-code -yolo` sets autoConfirm=true, skips all confirmation prompts
- Lazy `process.cwd()` evaluation in modules (for Jest mocking)
- Tool output truncated at 50KB
- Max 30 iterations per user input in the agentic loop
- Tool call retry: malformed args → schema hint with expected JSON schema
- parseToolArgs: 5 fallback strategies (JSON, trailing commas, JSON-extract, unquoted keys, code fences)
- Tool Validator: schema validation + Levenshtein-based auto-correct + did-you-mean
- Auto-Fix: path resolution (extension swap, basename glob, double-slash fix), edit auto-fix (≤5% distance auto-apply), bash error hints (command not found, MODULE_NOT_FOUND, port in use, etc.)
- Tool Tiers: essential (5) / standard (13) / full (17) — dynamic per model/provider, getModelTier() for arbitrary models, overrideTier in filterToolsForModel()
- Task List: create/update/get with dependencies, renderTaskList() for terminal display, onChange callbacks for live display integration
- TaskProgress: live animated multi-line display (✔/◼/◻/✗), spinner header with elapsed/tokens, pause/resume for clean text streaming, auto-resume before tool execution
- MultiProgress: elapsed timer on last line, spinner per agent line, batch spinner stopped before spawn_agents
- Sub-Agents: max 5 parallel, own conversation context, file locking via Map<path,agentId>, callStream-based (stream:true for reliability), retry with exponential backoff (max 3 retries)
- Sub-Agent Routing: always uses active model, keyword-based task classification only for tool tier filtering (FAST_PATTERNS→essential, HEAVY_PATTERNS→full, default→standard), LLM-hallucinated model names are ignored
- Sub-Agent Defensive: argument normalization (task/prompt/description/name fallback), model stripping (prevents 404 from hallucinated models like "llama3"), null response guard, skip 'local' provider
- Local Provider: dynamic context window detection via /api/show
- File History: in-session undo/redo stack (max 50), recordChange after write/edit/patch
- Progress Indicators: getToolSpinnerText() → spinner wrapper around executeTool()
- Compact Output: executeBatch(quiet=true) → single spinner + formatToolSummary() 1-line summaries
- Response Quality: system prompt enforces substantive text responses after tool use, markdown formatting, approach statement before tasks, completion summary
- Résumé: _printResume() shows steps/tools/files-modified/files-read after multi-step tasks
- Follow-Up: context-based suggestions — 💡 /diff · /commit · /undo after edits, 💡 /save · /clear after read sessions
- Tab Completion: completeFilePath() for file path completion alongside slash commands
- Bracketed Paste Mode: \x1b[200~/201~ detection, multi-line paste as single input
- Interactive Picker: pickFromList() generic cursor-based list picker, showModelPicker() for `/model`
- Cost Limits: setCostLimit/removeCostLimit/checkBudget per provider, budget gate in callStream/callChat, auto-fallback on budget exceeded, persistence in .nex/config.json
- Performance: non-blocking I/O for all file and git operations, <100ms startup via bundling, instant search results via in-memory index (rg-compatible)

## .nex/ Directory

```
.nex/
├── sessions/          # Saved conversations
├── memory/            # Persistent project knowledge
├── plans/             # Saved plans
├── hooks/             # Custom hook scripts
└── config.json        # Permissions, MCP servers, hooks, aliases, maxIterations
```

# Nex Code — Project Instructions

## Project Overview

Standalone agentic coding CLI. Provider-agnostisch, leichtgewichtig, open-source.
Repo: `github.com/hybridpicker/nex-code`

## Architecture

```
bin/nex-code.js       → Entrypoint (shebang, .env, startREPL)
cli/index.js             → REPL + ~38 Slash Commands
cli/agent.js             → Agentic Loop + Conversation State + MCP routing
cli/providers/           → Multi-Provider Abstraction Layer
  base.js                → Abstract Provider Interface
  ollama.js              → Ollama Cloud Provider (Kimi K2.5, Qwen3 Coder, DeepSeek R1, Llama 4 Scout, Devstral)
  openai.js              → OpenAI Provider (GPT-4o, GPT-4.1, o1, o3, o4-mini)
  anthropic.js           → Anthropic Provider (Claude Sonnet, Opus, Haiku, 4.5 Sonnet, 3.5 Sonnet)
  gemini.js              → Google Gemini Provider (Gemini 2.5 Pro/Flash, 2.0 Flash/Lite)
  local.js               → Local Ollama Server Provider
  registry.js            → Provider Registry + Model Resolution (5 providers)
cli/ollama.js            → Backward-compatible wrapper (delegates to providers/)
cli/tools.js             → 15 Tool Definitions + Implementations
cli/context-engine.js    → Token Management + Context Compression
cli/session.js           → Session Persistence (.nex/sessions/)
cli/memory.js            → Project Memory (.nex/memory/ + NEX.md)
cli/permissions.js       → Tool Permission System (allow/ask/deny)
cli/planner.js           → Plan Mode + Autonomy Levels
cli/git.js               → Git Intelligence (smart commit, diff, branch)
cli/render.js            → Rich Terminal Rendering (Markdown, Syntax Highlighting)
cli/mcp.js               → MCP Client (JSON-RPC over stdio)
cli/hooks.js             → Hook System (pre-tool, post-tool, etc.)
cli/diff.js              → LCS Diff + Colored Output + Confirmations
cli/context.js           → Auto-Context (package.json, git, README)
cli/file-history.js      → In-session Undo/Redo for file changes
cli/ui.js                → ANSI Colors, Spinner, Formatting
cli/safety.js            → Forbidden/Dangerous Pattern Detection
cli/tool-validator.js    → Tool Argument Validation + Auto-Correction
cli/tool-tiers.js        → Dynamic Tool Set Selection (essential/standard/full)
cli/skills.js            → Skills System (prompt + script skills)
tests/                   → Jest, 34 Suites, 1102 Tests, 92%+ Coverage
```

## Commit Message Convention

```
feat: <kurze Beschreibung>
fix: <was gefixt wurde>
test: <Test-Beschreibung>
chore: <Maintenance>
```

Kein `Co-Authored-By: Claude` oder andere AI-Attributionen. NIEMALS.

## Git Rules

- **NIEMALS** `Co-Authored-By: Claude` oder andere Claude/Anthropic-Signaturen einfügen
- **NIEMALS** `--no-verify` bei git commit oder push
- Commits werden OHNE jegliche AI-Attribution gepusht

## Testing

- Framework: Jest
- Coverage-Ziel: 90%+ Statements, 80%+ Branches
- Run: `npm test` (jest --coverage)
- Watch: `npm run test:watch`
- CI: GitHub Actions on push/PR (Node 18/20/22)

## Provider System

### Unterstützte Provider:
- **ollama** — Ollama Cloud (`OLLAMA_API_KEY`)
- **openai** — OpenAI API (`OPENAI_API_KEY`)
- **anthropic** — Anthropic API (`ANTHROPIC_API_KEY`)
- **gemini** — Google Gemini API (`GEMINI_API_KEY` oder `GOOGLE_API_KEY`)
- **local** — Lokaler Ollama Server (kein Key nötig)

### Model-Spec-Format:
`provider:model` (z.B. `openai:gpt-4o`, `anthropic:claude-sonnet`, `gemini:gemini-2.5-flash`, `local:llama3`)

### Env-Variablen:
- `OLLAMA_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `DEFAULT_PROVIDER` (default: `ollama`)
- `DEFAULT_MODEL` (default: provider-abhängig)

## Key Patterns

- Provider-Abstraction: Jeder Provider implementiert `chat()`, `stream()`, `isConfigured()`
- `registry.js` verwaltet aktiven Provider + Model, resolving von Model-Specs
- `agent.js` nutzt `registry.callStream()` mit `onToken` Callback für Streaming
- Streaming-Output wird durch `renderMarkdown()` gepiped (rich terminal rendering)
- `ollama.js` ist Backward-compatible Wrapper (delegiert an Registry)
- 15 Tools: bash, read_file, write_file, edit_file, list_directory, search_files, glob, grep, patch_file, web_fetch, web_search, ask_user, git_status, git_diff, git_log
- Permission-System: allow/ask/deny pro Tool (konfigurierbar in `.nex/config.json`)
- Context Engine: Token-Counting, Auto-Compression bei >70% Window
- Session-Persistenz: Auto-Save nach jedem Turn in `.nex/sessions/`
- Project Memory: Key-Value + NEX.md
- Plan Mode: Analyse → Plan → Approve → Execute
- Git Intelligence: Smart Commit, Diff-Analyse, Branch-Erstellung
- MCP Client: JSON-RPC over stdio, Tool-Discovery, Routing über `mcp_` Prefix
- Hook System: pre-tool, post-tool, pre-commit, post-response, session-start, session-end
- Lazy `process.cwd()` Evaluation in Modulen (für Jest-Mocking)
- Tool-Output wird bei 50KB abgeschnitten
- Max 30 Iterationen pro User-Input im Agentic Loop
- Tool-Call-Retry: Malformed Args → Schema-Hint mit erwartetem JSON-Schema
- parseToolArgs: 5 Fallback-Strategien (JSON, trailing commas, JSON-Extract, unquoted keys, code fences)
- Tool-Validator: Schema-Validation + Levenshtein-basiertes Auto-Correct + Did-you-mean
- Tool-Tiers: essential (5) / standard (12) / full (15) — dynamisch pro Model/Provider
- Local Provider: Dynamische Context-Window-Erkennung via /api/show
- File-History: In-session Undo/Redo Stack (max 50), recordChange nach write/edit/patch
- Progress Indicators: getToolSpinnerText() → Spinner-Wrapper um executeTool()
- Tab-Completion: completeFilePath() für Dateipfad-Vervollständigung neben Slash-Commands
- Bracketed Paste Mode: \x1b[200~/201~ Erkennung, Multi-Line-Paste als einzelner Input

## .nex/ Verzeichnis

```
.nex/
├── sessions/          # Gespeicherte Conversations
├── memory/            # Persistentes Projekt-Wissen
├── plans/             # Gespeicherte Plans
├── hooks/             # Custom Hook-Scripts
└── config.json        # Permissions, MCP-Server, Hooks, Aliases
```

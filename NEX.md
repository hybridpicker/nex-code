# Nex Code — Project Instructions

## Project Overview

Standalone agentic coding CLI. Provider-agnostisch, leichtgewichtig, open-source.
Repo: `github.com/hybridpicker/nex-code`

## Architecture

```
bin/nex-code.js       → Entrypoint (shebang, .env, startREPL)
cli/index.js             → REPL + ~38 Slash Commands
cli/agent.js             → Agentic Loop + Conversation State + Compact Output + Résumé
cli/providers/           → Multi-Provider Abstraction Layer
  base.js                → Abstract Provider Interface
  ollama.js              → Ollama Cloud Provider (Kimi K2.5, Qwen3 Coder, DeepSeek R1, Llama 4 Scout, Devstral)
  openai.js              → OpenAI Provider (GPT-4o, GPT-4.1, o1, o3, o4-mini)
  anthropic.js           → Anthropic Provider (Claude Sonnet, Opus, Haiku, 4.5 Sonnet, 3.5 Sonnet)
  gemini.js              → Google Gemini Provider (Gemini 2.5 Pro/Flash, 2.0 Flash/Lite)
  local.js               → Local Ollama Server Provider
  registry.js            → Provider Registry + Model Resolution + Provider Routing (5 providers)
cli/ollama.js            → Backward-compatible wrapper (delegates to providers/)
cli/tools.js             → 17 Tool Definitions + Implementations + Auto-Fix (path, edit, bash hints)
cli/sub-agent.js         → Parallel Sub-Agent Runner (file locking, multi-progress, model routing)
cli/tasks.js             → Task List Management (create, update, render, dependencies, onChange callbacks)
cli/context-engine.js    → Token Management + Context Compression
cli/session.js           → Session Persistence (.nex/sessions/)
cli/memory.js            → Project Memory (.nex/memory/ + NEX.md)
cli/permissions.js       → Tool Permission System (allow/ask/deny)
cli/planner.js           → Plan Mode + Autonomy Levels
cli/git.js               → Git Intelligence (smart commit, diff, branch)
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
cli/skills.js            → Skills System (prompt + script skills)
tests/                   → Jest, 41 Suites, 1564 Tests, 88%+ Stmts / 81%+ Branch Coverage
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
- `agent.js` nutzt `registry.callStream()` mit `onToken` Callback für Streaming, Spinner bei Rate-Limit/Network-Retry-Waits
- `callChat()` hat Stream-Fallback: bei chat-Fehler wird `provider.stream()` mit no-op onToken versucht
- Streaming-Output wird durch `renderMarkdown()` gepiped (rich terminal rendering)
- `ollama.js` ist Backward-compatible Wrapper (delegiert an Registry)
- 17 Tools: bash, read_file, write_file, edit_file, list_directory, search_files, glob, grep, patch_file, web_fetch, web_search, ask_user, git_status, git_diff, git_log, task_list, spawn_agents
- Permission-System: allow/ask/deny pro Tool (konfigurierbar in `.nex/config.json`)
- Context Engine: Token-Counting, Auto-Compression bei >70% Window
- Session-Persistenz: Auto-Save nach jedem Turn in `.nex/sessions/`
- Project Memory: Key-Value + NEX.md
- Plan Mode: Analyse → Plan → Approve → Execute
- Git Intelligence: Smart Commit, Diff-Analyse, Branch-Erstellung
- MCP Client: JSON-RPC over stdio, Tool-Discovery, Routing über `mcp_` Prefix
- Hook System: pre-tool, post-tool, pre-commit, post-response, session-start, session-end
- YOLO Mode: `nex-code -yolo` setzt autoConfirm=true, überspringt alle Bestätigungsprompts
- Lazy `process.cwd()` Evaluation in Modulen (für Jest-Mocking)
- Tool-Output wird bei 50KB abgeschnitten
- Max 30 Iterationen pro User-Input im Agentic Loop
- Tool-Call-Retry: Malformed Args → Schema-Hint mit erwartetem JSON-Schema
- parseToolArgs: 5 Fallback-Strategien (JSON, trailing commas, JSON-Extract, unquoted keys, code fences)
- Tool-Validator: Schema-Validation + Levenshtein-basiertes Auto-Correct + Did-you-mean
- Auto-Fix: Path-Resolution (extension swap, basename glob, double-slash fix), Edit Auto-Fix (≤5% distance auto-apply), Bash Error Hints (command not found, MODULE_NOT_FOUND, port in use, etc.)
- Tool-Tiers: essential (5) / standard (13) / full (17) — dynamisch pro Model/Provider, getModelTier() für beliebige Models, overrideTier in filterToolsForModel()
- Task-List: create/update/get mit Dependencies, renderTaskList() für Terminal-Display, onChange-Callbacks für Live-Display-Integration
- TaskProgress: Live animated multi-line display (✔/◼/◻/✗), Spinner-Header mit elapsed/tokens, pause/resume für sauberes Text-Streaming, auto-resume vor Tool-Execution
- MultiProgress: Elapsed-Timer auf letzter Zeile, Spinner pro Agent-Zeile, Batch-Spinner wird vor spawn_agents gestoppt
- Sub-Agents: Max 5 parallel, eigener Conversation-Context, File-Locking via Map<path,agentId>, callStream-basiert (stream:true für Zuverlässigkeit), Retry mit Exponential Backoff (max 3 Retries)
- Sub-Agent Routing: Immer aktives Model, Keyword-basierte Task-Klassifizierung nur für Tool-Tier-Filterung (FAST_PATTERNS→essential, HEAVY_PATTERNS→full, default→standard), LLM-halluzinierte Model-Namen werden ignoriert
- Sub-Agent Defensive: Argument-Normalisierung (task/prompt/description/name Fallback), Model-Stripping (verhindert 404 durch halluzinierte Modelle wie "llama3"), Null-Response-Guard, Skip 'local' Provider
- Local Provider: Dynamische Context-Window-Erkennung via /api/show
- File-History: In-session Undo/Redo Stack (max 50), recordChange nach write/edit/patch
- Progress Indicators: getToolSpinnerText() → Spinner-Wrapper um executeTool()
- Compact Output: executeBatch(quiet=true) → single spinner + formatToolSummary() 1-line summaries
- Response Quality: System-Prompt erzwingt substantive Text-Antworten nach Tool-Use, Markdown-Formatierung, Approach-Statement vor Tasks, Completion-Summary
- Résumé: _printResume() zeigt Steps/Tools/Files-Modified/Files-Read nach Multi-Step-Tasks
- Follow-Up: Kontext-basierte Vorschläge — 💡 /diff · /commit · /undo nach Edits, 💡 /save · /clear nach Read-Sessions
- Tab-Completion: completeFilePath() für Dateipfad-Vervollständigung neben Slash-Commands
- Bracketed Paste Mode: \x1b[200~/201~ Erkennung, Multi-Line-Paste als einzelner Input
- Interactive Picker: pickFromList() generic cursor-based list picker, showModelPicker() for `/model`
- Cost Limits: setCostLimit/removeCostLimit/checkBudget pro Provider, Budget-Gate in callStream/callChat, Auto-Fallback bei Budget-Überschreitung, Persistenz in .nex/config.json

## .nex/ Verzeichnis

```
.nex/
├── sessions/          # Gespeicherte Conversations
├── memory/            # Persistentes Projekt-Wissen
├── plans/             # Gespeicherte Plans
├── hooks/             # Custom Hook-Scripts
└── config.json        # Permissions, MCP-Server, Hooks, Aliases
```

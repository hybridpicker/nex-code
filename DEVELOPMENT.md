# Development Workflow for Nex-Code

## Branch Strategy

- **main**: Production-ready code (stable releases)
- **devel**: Development branch for ongoing work and testing
- **feature branches**: Optional, for complex features (branched off devel)

## Workflow Process

1. Create feature branches from `devel` for significant changes
2. Develop and test in feature branches or directly in `devel`
3. Merge completed features into `devel`
4. Thoroughly test in `devel` environment
5. Run the build process: `npm run build` to ensure the bundle is updated
6. When ready for release, merge `devel` into `main`
7. Tag releases and publish to npm from `main`

## Version Management

- Use semantic versioning (MAJOR.MINOR.PATCH)
- **Auto-bump**: When merging `devel` into `main`, the `post-merge` hook automatically runs `npm version patch` and commits the bump
- Manual version changes are only needed for minor/major bumps
- Document changes in commit messages

## Testing Process

1. Run unit tests: `npm test`
2. Ensure coverage remains high (>90% statements)
3. Manual testing of CLI functionality
4. Integration testing with different providers

## Release Process

1. Ensure all tests pass in `devel`
2. Merge `devel` into `main`: `git checkout main && git merge devel`
3. Version is automatically bumped (patch) by the `post-merge` hook
4. For minor/major bumps: manually run `npm version minor` or `npm version major`
5. Create git tag: `git tag -a vX.Y.Z -m "Release X.Y.Z"`
6. Push to repository: `git push origin main --tags`
7. Publish to npm: `npm publish`
8. Return to development: `git checkout devel && git merge main`

## Improvement Loop

The proactive improvement loop benchmarks nex-code against real-world tasks and auto-fixes regressions:

```bash
npm run improve              # full loop: benchmark → fix → validate → commit
npm run improve -- --dry-run # benchmark once, show failure clusters
npm run benchmark:realworld  # run 20-task benchmark only
```

**How it works:**
1. `scripts/benchmark-realworld.js` runs 20 commit-sized tasks (simple edits, multi-file, investigation, creation) in temp directories using nex-code headless mode
2. Results are scored: taskCompletion (30%) + editPrecision (40%) + efficiency (30%)
3. `scripts/improve.js` clusters failures, picks the top pattern, runs nex-code to implement ONE fix
4. Rebuilds dist, re-benchmarks, commits if improved, reverts if regressed
5. Stops after 3 plateaus, score >= 95, or 8 passes

**Safety bounds** are enforced before every commit:
- SSH_STORM_WARN: [6, 12], SSH_STORM_ABORT: [8, 18]
- INVESTIGATION_CAP: [10, 18], POST_WIPE_BUDGET: [10, 17]

## Model Profiles

`cli/model-profiles.js` provides per-model guard thresholds. Each model family gets tuned stale timeouts and investigation caps:

| Model | staleWarn | staleAbort | investigationCap | postEditCap |
|-------|-----------|------------|------------------|-------------|
| devstral-2 | 30s | 90s | 12 | 10 |
| devstral-small | 20s | 60s | 10 | 8 |
| qwen3-coder | 60s | 180s | 15 | 12 |
| kimi-k2 | 45s | 120s | 15 | 12 |

ENV overrides (`NEX_STALE_WARN_MS`, `NEX_STALE_ABORT_MS`) always take precedence.

## Memory System

`cli/memory.js` provides typed persistent memory stored in `.nex/memory/{type}/`:

- **Types:** user, feedback, project, reference
- **Storage:** Individual .md files with YAML frontmatter
- **Index:** Auto-generated `MEMORY.md` (max 50 entries) injected into system prompt
- **Tool:** `save_memory(type, name, content)` registered in tools/index.js
- **Dedup:** Skips save if existing file has identical first 200 chars
- **Context guard:** Truncates at ~2000 tokens to prevent context pressure

Legacy `remember(key, value)` / `recall(key)` API remains for backward compatibility.

## Trigger-Based Skills

`.nex/skills/*.md` files support YAML frontmatter with trigger patterns:

```markdown
---
trigger:
  - drums
  - drumcomputer
  - beat sequencer
---

Instructions injected when any trigger matches the user's first message.
```

`cli/skills.js` matches task descriptions against triggers at session start. Matched skills inject max 3 lines of instructions into the system prompt.

## Handling Merge Conflicts

If merge conflicts occur during the merge from `devel` to `main`:

1. Checkout to main: `git checkout main`
2. Attempt merge: `git merge devel`
3. Resolve conflicts manually in conflicted files
4. **Important**: Stage resolved files with `git add <resolved-files>` — forgetting this causes the merge to stay incomplete
5. Complete merge: `git commit`
6. Push changes: `git push origin main`

**Startup detection**: nex-code detects unresolved merge conflicts at startup and displays a red warning listing affected files. The LLM context also includes conflict info so the agent won't attempt edits on conflicted files.

**Project Structure & Indexing**

- `bin/nex-code.js`: CLI entrypoint (wrapper)
- `cli/`: All source code
- `cli/agent.js`: Core agentic loop (`processInput`)
- `cli/server-mode.js`: JSON-lines IPC server for the VS Code extension
- `cli/safety.js`: Confirmation logic (`confirm`, `setConfirmHook`)
- `cli/index-engine.js`: Fast file indexing (ripgrep/fallback)
- `cli/providers/`: Provider implementations
- `dist/`: Final bundled CLI scripts
- `tests/`: Jest test files

## VS Code Extension IPC (`--server` mode)

The VS Code extension at `~/Coding/nex-code-vscode/` spawns nex-code as `nex-code --server`. Communication uses newline-delimited JSON over stdin/stdout. stderr is forwarded to VS Code's Output channel.

### Protocol

**Extension → nex-code (stdin):**

```json
{ "type": "chat",    "id": "msg-001", "text": "fix the bug" }
{ "type": "confirm", "id": "cfm-001", "answer": true }
{ "type": "cancel" }
{ "type": "clear" }
```

**nex-code → Extension (stdout):**

```json
{ "type": "ready" }
{ "type": "token",           "id": "msg-001", "text": "Here is" }
{ "type": "tool_start",      "id": "msg-001", "tool": "read_file", "args": {"path": "src/auth.js"} }
{ "type": "tool_end",        "id": "msg-001", "tool": "read_file", "summary": "✓ 142 lines", "ok": true }
{ "type": "confirm_request", "id": "cfm-001", "question": "Run git push?", "tool": "bash", "critical": true }
{ "type": "done",            "id": "msg-001" }
{ "type": "error",           "id": "msg-001", "message": "Provider not configured" }
```

### Key implementation points

- `cli/server-mode.js` redirects `console.log`/`warn`/`info` to stderr to keep stdout clean for JSON
- `cli/agent.js` `processInput(input, serverHooks)` accepts hooks for `onToken`, `onToolStart`, `onToolEnd`
- `cli/safety.js` `setConfirmHook(fn)` overrides `confirm()` so critical tool confirmations are routed through the extension's Yes/No dialog instead of blocking on TTY input
- `setAutoConfirm(true)` is called before `startServerMode()` so non-critical tools run without interruption
- The `--server` branch in `bin/nex-code.js` uses `return` after `startServerMode()` to prevent the REPL from starting

## Remote Agent (`remote_agent` tool)

The `remote_agent` tool (in `cli/tools.js`) delegates a coding task to a nex-code instance running on a remote server via SSH:

1. Reads server config from `.nex/servers.json` (same file used by `ssh_exec`)
2. Base64-encodes the task to avoid shell-escaping issues
3. SSH-executes: `nex-code --prompt-file /tmp/nexcode-XXXX.txt --auto` on the remote
4. Returns the last 5000 characters of stdout
5. 5-minute timeout; temp file is cleaned up on the remote after execution

**Server-side requirement:** nex-code must be installed globally on the target server (`npm install -g nex-code`) and the server must have an Ollama-compatible `.env` at `~/.nex-code/.env` (or use `~/.nex-code/models.env`).

**Mac↔Server workflow:** Use the global skill `~/.nex-code/skills/server-agent.md` to teach the Mac agent which project names map to which server paths. The skill instructs the agent to use `remote_agent` for server-side project work automatically.

## Git Hooks

Install all hooks with:

```bash
10. npm install
11. npm run build    # Build the high-performance bundle
12. cp .env.example .env
13. npm run install-hooks
```

| Hook         | Purpose                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pre-push`   | Scans pushed commits for secrets (API keys, tokens, private keys) and blocks the push if found                            |
| `post-merge` | On `devel→main` merge: auto-bumps patch version and commits. On any merge with `package.json` changes: runs `npm install` |

## Known Logic Patterns & Past Bug Fixes

### Sub-agent File Locking (`cli/sub-agent.js`)

Write-tool file locking uses `lockedFiles` (module-level Map) guarded by `acquireLock`/`releaseLock`.
Two rules enforced since v0.3.26:

1. **No concurrent same-agent locks**: `locksHeld` (per-run Set) is checked _before_ calling `acquireLock`.
   Even though `acquireLock` allows re-locking by the same `agentId`, parallel tool calls within one
   `Promise.all` batch would both pass — `locksHeld` prevents this.
2. **Lock released on tool completion**: Each promise's `.then()` / `.catch()` calls `releaseLock` and
   removes from `locksHeld` immediately, rather than waiting until end-of-iteration.

### Rate Limit / Network Retry Counters (`cli/agent.js`)

`rateLimitRetries` and `networkRetries` are reset to `0` after every successful API response.
Without this reset, transient errors early in a session would eat into the retry budget (`MAX_RATE_LIMIT_RETRIES = 5`,
`MAX_NETWORK_RETRIES = 3`) for all subsequent calls, causing premature hard-stop errors.

### Context Compression Phase 4 (`cli/context-engine.js` — `fitToContext`)

In Phase 4 (message removal), `tokens` tracks message-only token counts.
`available = targetMax - toolTokens`, so the correct loop condition is `tokens > available`
(not `tokens + toolTokens > available`, which would over-remove messages by targeting `targetMax - 2*toolTokens`).

### Auto-Extension Loop (`cli/agent.js` — `processInput`)

`continue outer` resets `i = 0`. Therefore `iterLimit` must be set to **exactly 20** (not `+= 20`)
when auto-extending. Using `iterLimit += 20` causes the next pass to run `iterLimit` iterations
from scratch (70, then 90, then 110…), producing up to 1 650 total iterations instead of the
intended 250 (50 initial + 10 × 20). Fixed in v0.3.26.

### Nudge Message Sync (`cli/agent.js` — `processInput`)

When the LLM returns an empty assistant message after using tools, a nudge is pushed into
`apiMessages` to prompt a summary. This nudge **must also be appended to `conversationMessages`**
to keep the two arrays in sync. Without this, subsequent turns have two consecutive assistant
messages in `conversationMessages`, violating the strict user/assistant alternation required by
Anthropic's API (→ 400 Bad Request) and causing context confusion on other providers.

### `serializeMessage` Hash Collision (`cli/context-engine.js`)

The old two-cache implementation keyed messages by `role:content.length:tool_calls.length`.
Any two messages with the same role, same content length, and same number of tool calls would
collide — returning the serialized form of the first message for all subsequent ones, silently
corrupting API payloads. Replaced with a single WeakMap keyed by object identity, which is
collision-free by definition and GC-safe (entries are freed when the message object is released
from the conversation array).

### O(n²) `unshift` in `compressToolResult` (`cli/context-engine.js`)

Building the tail-window of a large log by calling `Array.unshift` in a loop is O(k) per call
and O(k²) overall. On a 100 k-line log this caused a UI freeze. Fixed by using `push` (O(1))
followed by a single `reverse()` call (O(k)).

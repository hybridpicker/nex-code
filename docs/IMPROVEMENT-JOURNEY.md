# nex-code Improvement Journey

A living document tracking the quality evolution of the nex-code agentic loop —
from runaway log-reading sessions to reliable, self-terminating task execution.

---

## 1. The Problem

When nex-code was first deployed as the backend for Jarvis self-improvement
(via `self-improving.js` on the Jarvis server), sessions on real-world tasks
exhibited a consistent failure pattern:

- **110+ steps** on Jarvis debug scenarios that should take 5-10 steps
- **Expanding-range log reads** — `sed -n '1,50p'`, then `sed -n '51,100p'`,
  then `sed -n '101,150p'`… filling the entire context window with log noise
- **Context floods** leading to HTTP 400 errors on the next API call
- **Stop signals ignored** — the agent received `[STOP]` injections but kept
  executing tool calls because the token was not recognized as authoritative
- **Loop detection completely silent** — `bash` tool calls were tracked under
  the key `bash_exec`, which never matched the actual tool name `bash`,
  so the counter never incremented and no warnings were ever fired

The net result: sessions ran until the context window was exhausted or the
iteration cap (30) was hit, without making useful progress.

---

## 2. Fix History

Fixes are listed chronologically as merged to `devel`. Each entry references
the git commit hash for full diff context.

### 2026-03-21

#### `d252800` — Stop expanding-range log loops, improve ssh_exec display

**Problem:** Agent incremented line ranges (`sed -n '1,50p'`, `51,100p'`, …)
to scroll through logs. The commands differed by digits only, so the existing
loop-detection hash counted them as distinct.

**Fix:** Normalize all digit sequences to `'N'` before hashing bash/ssh
commands. `sed -n 'N,Np'` now always collides with the previous call.
Also added a system-prompt rule: once the root cause is identified, stop
reading and pivot to the fix immediately.

#### `71daae0` — Extend loop detection to ssh_exec, treat "Command failed" as error

**Problem:** Loop detection only covered bash commands. SSH commands looped
freely. Also, `"Command failed"` in output was not counted as a consecutive
error, so `consecutiveErrors` stayed low.

**Fix:** Added `ssh_exec` to the bash-command loop-detection branch.
Treat `"Command failed"` output lines as tool failures for the consecutive-
error counter.

#### `5a1f58e` — Proactive mid-loop auto-compress at 78% context

**Problem:** The agent only compressed context reactively (after hitting ~90%).
By then the context was already too large for a clean next call.

**Fix:** Added a proactive compression trigger at 78% of the context window.
This keeps the context lean throughout a long session and prevents the
"compress then immediately overflow" cascade.

#### `86f8e18` — Explicit stop-triggers and investigation order in server rule

**Problem:** The system prompt's server-debugging rule was vague about when
to stop. Agents continued reading logs even after finding the root cause.

**Fix:** Added an ordered investigation protocol and an explicit stop condition:
read logs once, identify the cause, then immediately pivot to the fix. Do not
re-read logs to "confirm".

#### `4f30763` — Cap SSH output at 200 lines, grep context at 20

**Problem:** A single `ssh_exec` call could return thousands of lines, flooding
context and causing the next API call to return HTTP 400.

**Fix:** Hard-cap SSH tool output at 200 lines (with an ellipsis marker for
truncated output). Cap `-C` context lines in grep results at 20.

#### `e535274` — sed-n detection, valid-token stop-signal, grep separator filter

**Problem:** The `[STOP]` token injected into the conversation was sometimes
embedded in longer strings and not recognized. Grep `--` separator lines
accumulated as context noise.

**Fix:** Made the stop-signal a standalone `[SYSTEM STOP]` block. Added
filtering to strip grep `--` separator lines from tool output. Added immediate
sed-n detection for SSH commands (warning injected before the tool call
executes).

#### `d4f2b5e` — Correct bash loop detection and add grep/health-check guards

**Root cause of the original 110-step problem:**

The bash command loop-detection block checked `prep.fnName === 'bash_exec'`.
The actual tool name is `'bash'`. This single typo meant the `bashCmdCounts`
map was never populated — loop detection was completely inoperative for all
bash commands.

**Fix:** Changed `'bash_exec'` → `'bash'`. Also:

- Extended sed-n detection to `bash` (not just `ssh_exec`)
- Added grep-pattern loop detection (warn at 4×, abort at 7×) to catch
  agents re-running the same search query with no new information
- Added a programmatic health-check stop: when bash/ssh_exec returns
  `{"valid":true}`, inject `[SYSTEM STOP]` so the agent does not continue
  reading logs after a successful check

#### `461cf53` — Pre-compress before stop-signal injection to prevent 400 cascade

**Problem:** When the stop-signal injection itself pushed context over the
limit, the next API call returned 400.

**Fix:** Run context compression before injecting any system-level message.

#### `a333fd5` — Session scorer: automatic quality scoring 0-10 per session

**Feature:** Added `cli/session-scorer.js` — a static analyzer that scores
a saved session on a 0-10 scale, detecting anti-patterns (sed-n usage, grep
loops, excessive steps, context floods, stop-signal violations). Integrated
as `/score` slash command and as the foundation for the benchmark suite.

#### `329df2d` — Cap grep context in ssh_exec, pre-compress before sed-n warning, SSH storm cap

**Problem:** Even after the 200-line SSH cap, a grep inside an SSH command
could return thousands of lines via `-C` context. Multiple SSH commands in
rapid succession ("SSH storm") still caused 400 cascades.

**Fix:** Cap grep `-C` to 20 lines even inside ssh_exec output. Pre-compress
context before injecting the sed-n warning message. Added an SSH-storm cap:
if more than 5 SSH commands fire within 10 seconds, inject a cooling warning.

#### `6be9ef1` — Treat EXIT-prefix bash errors as failures in loop detection

**Problem:** Bash errors prefixed with `EXIT` (e.g. sysadmin false-positives
for ssl/service/package commands) were not counted as consecutive tool failures.

**Fix:** Normalize `EXIT` prefixes before checking error patterns, ensuring
sysadmin commands that legitimately return non-zero exit codes do not trigger
false-positive failure escalation while real failures are still counted.

#### `c1b4eb5` — Pre-compress before read_file loop warning to prevent 400 cascade

**Problem:** The read_file loop-warning injection (fired when the same file
is read repeatedly) could itself push context over the limit.

**Fix:** Pre-compress before injecting the read_file loop warning, mirroring
the pattern established for stop-signal and sed-n injections.

### 2026-03-23

#### `e854b99` — SSH storm deadlock hard-cap; auto-plan disabled in YOLO mode; --prompt alias

**Problem:** Three issues from a 1.5/10 session:

1. The dual-block deadlock relaxer (SSH storm + Jarvis-local guard both active)
   had no usage cap — it fired every batch, letting the agent bypass the SSH
   storm block repeatedly and accumulate 34+ tool calls.
2. Auto-plan mode activated when `--auto` was passed (YOLO mode), causing the
   agent to claim it was "in plan mode" and refuse to execute — defeating the
   purpose of the YOLO flag entirely.
3. `--prompt` was not recognized as a flag (only `--task` existed), so
   `nex-code --prompt "..." --auto` fell through to interactive REPL mode
   instead of headless execution.

**Fix:** Added `_sshDeadlockRelaxCount` counter — deadlock relaxer now fires at
most once per session (`_sshDeadlockRelaxCount < 1`). Auto-plan detection now
skips when `getAutoConfirm()` is true. `--prompt` added as alias for `--task`
in `bin/nex-code.js`. System prompt gains an explicit rule: plan mode is only
active when "PLAN MODE ACTIVE" appears in instructions.

#### `986636a` — Count pre-execution BLOCKED calls toward consecutive-block abort

**Root cause of the 0/10 infinite-loop problem:**

Pre-execution guards (SSH storm, plan mode) set `canExecute = false` on a tool
call before `executeBatch`, which made the tool's `errorResult` a BLOCKED:
message. But the post-execution loop that counts `consecutiveBlocks` skipped
these calls with `if (!prep.canExecute) continue`. Neither `consecutiveBlocks`
nor `_sessionConsecutiveSshCalls` ever incremented for those blocked calls, so
neither the 5-block abort nor the 12-SSH-storm abort could fire. The model
could send infinite batches of blocked ssh_exec calls and run to the 50-turn
max every time.

**Fix:** Added a pre-execution pass that counts `BLOCKED:` / `PLAN MODE:`
errorResults toward `consecutiveBlocks` with the same `LOOP_ABORT_BLOCKS = 5`
threshold. Sessions now abort within 5 blocked batches instead of running 50+
turns.

---

## 3. How the Benchmark System Works

### Session Scorer (`cli/session-scorer.js`)

A static analyzer that inspects a saved session file and returns a 0-10 score.

**Scoring factors (deductions):**

- `sed -n` usage in any bash/ssh command (−1.5 per occurrence)
- Grep pattern repeated 4+ times (−1 per pattern over threshold)
- More than 30 steps in a single user turn (−0.5 per 5 extra steps)
- Context compression triggered more than once (−0.5 per extra compression)
- Stop signal injected (−0.25 per injection, the signal worked but a loop occurred)
- HTTP 400 errors in tool results (−1 per error)

**Usage:**

```js
const { scoreSession, scoreMessages } = require("./cli/session-scorer");
const result = scoreSession("my-session-name");
// => { score: 8.5, issues: ['sed -n used (step 42)'], summary: '...' }
```

The scorer can also operate directly on a messages array without loading from
disk, which is how the benchmark suite uses it.

### Benchmark Suite (`cli/benchmark.js`)

Five Jarvis-style scenarios that exercise the full agentic loop against a live
model. Each scenario has:

- A realistic multi-step prompt (e.g. "Debug why the API service is failing")
- An expected tool-call sequence
- A pass/fail validator per tool call
- Session scoring applied to the resulting conversation

**Running the benchmark:**

```
/bench          — run full suite (5 scenarios)
/bench quick    — run first 2 scenarios only
/trend          — show score history from .nex/benchmark-history.json
```

**Score history:** Results are appended to `.nex/benchmark-history.json` after
each run. Each entry contains timestamp, model used, per-scenario scores, and
overall average.

---

## 4. Score Baseline

| Date                        | Score   | Notes                                                  |
| --------------------------- | ------- | ------------------------------------------------------ |
| Pre-fix (estimated)         | ~3/10   | 110+ steps, sed loops, 400 cascades, no loop detection |
| 2026-03-15 (OpenClaw bench) | 7.5/10  | Response truncation still present                      |
| 2026-03-17 (OpenClaw bench) | 8.13/10 | Makefile task still broken                             |
| 2026-03-19 (OpenClaw bench) | 8.13/10 | Same weak task, bench branch missing                   |
| 2026-03-21 (post-fixes)     | 10/10   | All loop-detection fixes merged                        |

The jump from ~3 to 10 on the session scorer was driven almost entirely by the
`bash_exec` typo fix (`d4f2b5e`) — once loop detection was actually running,
the existing thresholds were sufficient to catch the remaining anti-patterns.

---

## 5. How to Keep Improving

### Regular benchmark runs

```
/bench
```

Run after any change to `cli/agent.js`, `cli/tools.js`, or the system prompt.
The benchmark is fast (< 2 min for the quick suite) and catches regressions
before they reach production.

### Watch the trend

```
/trend
```

A score drop of 0.5+ on any single scenario warrants investigation. Check the
scenario's session file under `.nex/sessions/` and look at which tool calls
triggered deductions.

### Automated Cron loop

A cron job fires every 20 minutes on the Jarvis server. It:

1. Reads the last saved session from `.nex/sessions/`
2. Scores it via `session-scorer.js`
3. If score < 8, runs `self-improving.js` to generate a targeted fix prompt
4. Applies the fix, runs the test suite, and commits if tests pass

This means regressions introduced by upstream model changes are typically
caught and fixed within one cron cycle.

### Improvement checklist

When adding a new tool or modifying the agentic loop:

- [ ] Does the new tool produce output that could flood context? Add a line cap.
- [ ] Does the tool indicate success/failure clearly? Ensure the failure path
      increments `consecutiveErrors`.
- [ ] Could the tool be called in a loop? Add it to the loop-detection map
      (bash-style normalized key or a dedicated counter).
- [ ] Does the tool inject messages into the conversation? Pre-compress first.
- [ ] Run `/bench` and verify no score regression.

### 2026-03-22 — v0.3.72: Terminal Noise Reduction & Deadlock Fix

**Context:** Session analysis showed 3/10 and 5/10 scores on Jarvis debug
scenarios. Root causes: read_file loops (13× same file), cascading compression
messages, and a deadlock where files couldn't be re-read after context wipe.

#### `7738538` — Cleaner terminal output

- Re-read block message shown only once per file (was: every attempt)
- Removed misleading "Context 7% used" warning on re-reads at low context
- Compression messages deduplicated with `×N` counter via `_logCompression()`

#### `3a27080` — Deadlock fix + noise reduction

- **Critical:** Reset `_sessionFileReadCounts` and `_sessionGrepFileCounts`
  after super-nuclear compression — file content is gone from context after
  wipe, so blocking re-reads caused a deadlock
- Suppress `[force-compressed — ~X tokens freed]` when X < 50
- Shorten all BLOCKED error messages from 200-400 to ~60-100 chars

#### `366d3eb` — System warning shortening + scorer rule #14

- Shortened 9 verbose `[SYSTEM WARNING]` messages (saves ~2000 tokens/session)
- Session scorer rule #14: penalize BLOCKED tool calls (-0.5 each, max -1.5)

#### `d6a2cb0` — First-call 400 fix

- On first LLM call 400 (system prompt too large): skip gentle compression,
  go straight to nuclear. Shows 1 clean message instead of 3-step cascade.
- Lower proactive auto-compress threshold from 78% to 65% for first call
  to catch oversized system prompts before they hit 400.

**Impact:** ~3000-4000 fewer tokens wasted per problematic session.
Session output is significantly cleaner — no more message spam on re-reads
or compression cascades.

---

### v0.3.78 — Multi-Agent Orchestrator

#### Architecture upgrade: orchestrated multi-agent execution

Complex multi-goal prompts (e.g. "fix 4 bugs") previously caused context
collapse — a single agent trying to solve everything in one context window.

**New modules:**

- `cli/orchestrator.js` — Decomposes prompts into sub-tasks, runs them via
  parallel sub-agents (max 3 concurrent, SSH limit), synthesizes results
- `cli/orchestrator-bench.js` — Benchmarks models on decompose/synthesize
  quality (6 scenarios, separate from tool-calling benchmark)

**Two-tier model architecture:**

- Orchestrator model (default `kimi-k2.5`): reasoning + 262K context for
  task decomposition and result synthesis (only 2 LLM calls)
- Worker model (default `devstral-2:123b`): fast tool calling for parallel
  sub-agent execution (5-15 calls per agent)

**CLI integration:**

- `/orchestrate <prompt>` slash command for interactive use
- `--orchestrate` flag with `--task` for headless mode
- `--orchestrator-model` flag for model override
- Complexity hint in `processInput()` suggests orchestration for 3+ goals

**Model discovery:**

- `model-watcher.js` extended with orchestrator candidate detection
- Auto-promotes new orchestrator model if benchmark score > current + 5%
- See `docs/MODEL-SELECTION.md` for full model selection strategy

---

### v0.3.79–0.3.87 — Orchestrator Polish + Debug Mode

#### v0.3.79 — Worker prompt hardening

- `WORKER_SYSTEM_PROMPT` now explicitly forbids external CLI tools (`aspell`,
  `jq`, `grep` for reading) — agents must use `read_file` + reasoning instead
- Worker rule: "Be PROACTIVE — if your task says fix typos, read and fix them;
  don't just search and report"

#### v0.3.80 — Debug mode + auto-orchestrate

- `cli/debug.js` — `debugLog()` / `warnLog()` gated on `NEX_DEBUG=true` or
  `--debug` flag. ~30 internal `⚠ BLOCKED`, compression, SSH storm, deadlock
  messages now hidden from normal output
- `--auto-orchestrate` flag (+ `NEX_AUTO_ORCHESTRATE=true` env var): triggers
  orchestrator automatically when ≥3 goals detected in prompt
- `NEX_ORCHESTRATE_THRESHOLD` env var to tune the goal threshold
- `--prompt` added as alias for `--task` in `bin/nex-code.js`

#### v0.3.81–0.3.84 — Orchestrator reliability fixes

- Fixed inline goal detection regex (was only matching line-start `(1)` not
  `fix (1) this (2) that`)
- Removed invalid `{"valid": true}` tool instruction from worker prompt —
  caused `ERROR: Unknown tool: valid` on every sub-agent completion
- Synthesizer now uses ✓ green / ⚠ yellow / ✗ red icons for agent status
  instead of uniform `⚠` for all results
- Token accumulation: safe `||` fallback prevents NaN when provider omits counts

#### v0.3.85–0.3.87 — Clean terminal output

- `MultiProgress.stop({ silent: true })` — clears progress block without
  reprinting agent lines, eliminating the duplicate agent list that appeared
  after Phase 2
- Orchestrator now prints one clean summary block: scope files + duration
- Empty/non-existent scope entries filtered out (fixes `, ,` in Agent display)
- Phase 1 decompose output also filters empty scope strings

---

## 0.4.x — Multi-Agent Era

Starting with v0.4.0, nex-code graduates from a single-agent loop to a
**multi-agent orchestrated system**. The architecture is stable and battle-tested:

- Kimi K2.5 as orchestrator (262K context, reasoning-grade decomposition)
- devstral-2:123b as worker pool (fast, tool-calling optimised)
- Max 3 parallel agents (SSH limit respected)
- Auto-orchestrate for 3+ goal prompts (`--auto-orchestrate` or env var)
- Debug mode hides all internal noise (`--debug` or `NEX_DEBUG=true`)
- Clean terminal output: no duplicate lists, no empty scope fields

---

### 2026-03-26 — Server Investigation State Machine

**Problem:** On Jarvis server debug tasks the model investigated too broadly —
reading 5+ unrelated files instead of fixing after root cause was identified.
SSH storm (6 calls, no error found) caused the model to fall back to local file
reads instead of asking the user for missing information. False-positive
`{"valid":true}` stop signal fired on `tail logs/api.log` when app logs
happened to contain that JSON fragment.

#### Root-cause detection (investigation → fix phase)

`detectRootCause(text)` scans SSH output (and initial briefing context) for 16
error patterns: `TypeError`, `SyntaxError`, `ReferenceError`, `ENOENT`,
`EACCES`, `EADDRINUSE`, `Cannot find module`, Python exceptions, Go panic, Java
exceptions. On first match:

- Sets `_rootCauseDetected = true`, stores `_rootCauseSummary`
- Resets `_readOnlyCallsSinceEdit` (fix-phase budget starts fresh)
- Injects: `[SYSTEM] Root cause identified: <summary>. Read only the file that needs fixing, then edit it.`
- Investigation cap drops from 12 → **3 reads** in fix phase

Also scans the model's own analysis text — if the model writes
`"TypeError: foo is not a function"` in its response, that counts as a
confirmed detection.

#### SSH storm differentiation

When SSH storm fires, the message is now context-aware:

- **Root cause known:** `Root cause is known (X). Edit the file now.`
- **No root cause yet:** `Do NOT read local files. State what specific crash info is still missing and ask the user.`

Previously the model received `"Synthesize findings now"` in both cases and
interpreted it as permission to switch to local file archaeology.

#### False-positive stop-signal fix

The `{"valid":true}` health-check stop trigger now only fires when the SSH
command itself matches a health/status/check/ping/validate pattern. Prevents
false stops when `tail logs/api.log` returns app logs that happen to contain
that JSON fragment.

#### Jarvis-local guard: German crash vocabulary

Extended `_isJarvisDebugging` regex to cover German crash terms (`gecrasht`,
`abgestürzt`) and Swarm-agent crash patterns. Previously `"Swarm: 2 Agents
gecrasht"` did not activate the guard.

#### Output: compact warnings

- **BLOCKED messages in terminal** — truncated to one short line
  (`└ blocked: read_file("file.js") denied`); full guidance text still sent
  to the model
- **Session score issues** — for scores ≥ 7, issues shown inline as a dim
  compact summary instead of one `⚠` line per issue

**Outcome:** Session score on Jarvis server investigation task: 3.5 → **9.5/10**.

---

### 2026-03-29 — v0.4.21: Scorer Hardening, Guard Fixes, Server Auto-Probe, Few-Shot Examples

#### Session scorer: 5 new quality rules (17a–17e)

Real sessions were scoring 10/10 despite visible failures — the scorer had no
rules for three common open-model failure modes.

- **Rule 17a (−1.5):** Arithmetic non-sequitur at start of first response
  (e.g. `"2 + 2 = 4."` leaking from model thinking chain)
- **Rule 17b (−1.0):** SSH invocations or absolute server paths in first text
  response before any tool call has been made — model revealing it planned to
  act on a remote server without actually doing it
- **Rule 17c (−0.75):** Truncated last assistant message (unclosed code fence,
  trailing `"key":`, or unmatched bracket) indicating the model hit a token
  limit mid-response
- **Rule 17d (−0.75):** `read_file` returning fewer than 5 lines on a `.json`
  that starts with `[` but has no closing `]` — classic partial-read anti-pattern
- **Rule 17e (−0.75 / −0.25):** Three or more tool calls returning argument
  validation errors — model failed to learn from the schema error feedback

#### Agent guards: arg-error escalation, bash same-error detection

- **Tool arg error escalation:** New `_sessionToolArgErrorCounts` map (module
  level). From the 2nd repeated argument error on the same tool, the error
  message is prefixed with `[SYSTEM: This is argument error #N for "tool". Study
  the Expected parameters schema above and correct your call.]`
- **Bash same-error detection:** New `_bashConsecutiveSameErrors` counter. When
  the same bash error fingerprint fires 3× in a row, a `[SYSTEM WARNING]` is
  injected prompting the model to switch approach instead of retrying.
- **Tool validator auto-corrections:** `read_file` offset/start_line/end_line
  param aliases auto-corrected; grep shell-flag hallucinations (`-n`, `-i`, `-r`)
  silently normalized before execution.
- **`ssh_exec` permission:** Changed default from `ask` → `allow` in
  `DEFAULT_PERMISSIONS`. The `ask` gate was blocking SSH investigation at step
  7–8 in fresh sessions, defeating the remote-first strategy.
- **`TARGETED_READ_HARD_CAP`:** Lowered from 8/6 → 6/4 turns.
- **`SSH_EXEC_REPEAT_BLOCK`:** Raised from 3 → 5 calls before dedup block.
  The old threshold was too aggressive for legitimate investigation sequences.

#### Server auto-probe on URL match (`probeUrlServer`)

When the user's first message contains an `https://` URL whose domain segments
match a configured SSH profile name (e.g. `jarvis` in `jarvis.schoensgibl.com`),
nex-code runs a 4-second SSH probe concurrently with context fitting:

- Listening ports (`ss -tlnp`)
- Running web-service processes (`ps aux | grep node/python/...`)
- Data directories under `/home`

The result is injected as a synthetic `user`/`assistant` exchange before the
first real turn. The model knows the server's running topology before it types
its first character — mirroring how Claude Code auto-detects server context.

This is the primary fix for the "model looks at local files when URL points to
remote server" failure mode.

#### Few-shot example injection (`cli/few-shot.js`)

On the first message of each session, nex-code detects the task category
(`sysadmin`, `coding`, `frontend`, `data`) and injects a short synthetic
conversation turn showing the correct tool sequence for that category.

**Why this works across all models:** Open-weight models imitate patterns
reliably. A 3-step concrete example (`ssh_exec → logs → fix → restart`) is
more effective than a 10-line rule list, especially for devstral/ministral which
over-react to negative/constraint language.

**Privacy design:**
- `examples/` (repo, public): generic examples with `user@your-server`
  placeholders, shipped in the npm package
- `~/.nex-code/examples/` (private, never committed): user-specific examples
  extracted from high-scoring real sessions via `npm run extract-examples`

The extraction script sanitizes IPs, hostnames, `/home/<user>/` paths, and
API keys/JWTs before saving — nothing private reaches the repo.

Disable with `NEX_FEW_SHOT=0`.

**Impact:** Model-agnostic improvement that works immediately on all Ollama
Cloud models without fine-tuning or system-prompt changes.

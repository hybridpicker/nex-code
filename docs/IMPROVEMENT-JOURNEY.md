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
const { scoreSession, scoreMessages } = require('./cli/session-scorer');
const result = scoreSession('my-session-name');
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

| Date | Score | Notes |
|------|-------|-------|
| Pre-fix (estimated) | ~3/10 | 110+ steps, sed loops, 400 cascades, no loop detection |
| 2026-03-15 (OpenClaw bench) | 7.5/10 | Response truncation still present |
| 2026-03-17 (OpenClaw bench) | 8.13/10 | Makefile task still broken |
| 2026-03-19 (OpenClaw bench) | 8.13/10 | Same weak task, bench branch missing |
| 2026-03-21 (post-fixes) | 10/10 | All loop-detection fixes merged |

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

### 2026-03-22 — v0.3.73–0.3.75: Read-Loop Fixes, File-Scroll Detection & Auto-Daemon

**Context:** Session analysis (Jarvis device-status debug, 7/10) revealed two
remaining loop patterns not caught by existing detection, plus the manual
improvement loop workflow was replaced with a fully automated daemon.

#### `e234556` — Targeted re-read overlap: warn → hard block

Session showed `modules/query-processor.js` read at line 420 three times in a
row (turns 56, 60, 84). The overlap check was warn-only — LLM ignored it.
Changed to hard BLOCKED (matching the unbounded re-read behavior).

#### `93ee645` — Temp-file pattern prevention

Sessions repeatedly created `test_*.js` / `demo_*.js` scripts, ran them, then
deleted them. Added proactive system prompt rule forbidding this pattern.
Scorer rule 16: penalize write-then-delete temp files (-0.25 each, max -0.5).

#### `7b4462e` — File-scroll detection (new pattern)

**Root cause:** Agent read `modules/system-prompt.js` in 4 sequential windows
(lines 1-150, 150-250, 250-350, 350-420). Each adjacent window shares only a
boundary point (0% actual overlap) — the 70%-overlap block never fired.
The agent effectively read the entire file in chunks without any friction.

**Fix in `agent.js`:**
- After allowing a targeted read (no overlap), count total unique sections
  read for this file in the current session
- Warn at 3rd section: inject `[SYSTEM WARNING]` nudging toward `grep_search`
- Hard-block at 4th section: `BLOCKED — file-scroll pattern`

**Fix in `session-scorer.js` (rule 10b):**
- After the overlap-loop check, second pass detects 4+ non-overlapping sections
- Penalty: -0.5 per file with scroll pattern
- Retroactive score for that session: 6.5/10 (was 7/10 before this rule)

#### `85a26ef` + `f3f0de1` — Auto-improvement daemon

Replaced the manual `/loop 20m` cron with a persistent file-watcher daemon
(`scripts/improve-daemon.js`) that triggers automatically when nex-code
sessions complete.

**Flow:**
```
nex-code session ends → _autosave.json changes
→ 90s debounce (waits for session to fully settle)
→ Score session via session-scorer.js
→ Run one improvement pass: claude --print --dangerously-skip-permissions
→ Commit fixes to devel → CI → npm publish (auto via post-merge hook)
```

**Stop conditions (automatic):**
- Score plateau: same score 2× in a row → stop
- Max passes: 8 passes reached → stop
- Excellent score: ≥ 9.5/10 → stop

**Notification:** Matrix message via Jarvis (`/matrix/notify`) when loop ends,
showing final score and "run `/nex-improve stop` to merge".

**LaunchAgent:** `com.nex-code.improve-daemon` starts daemon at login.
Server address via `JARVIS_SSH_HOST` env var (not hardcoded).

**State file:** `~/Coding/jarvis-agent/.nex/loop-state.json`
```json
{ "pass": 3, "scores": [7.0, 7.5, 7.5], "lastHash": "...", "startedAt": "..." }
```

**Impact:** Zero manual steps for improvement cycles. Lukas uses nex-code
normally; fixes commit automatically; Matrix notification signals when done.

# nex-code 24/7 Self-Improvement System

Automated continuous improvement pipeline that makes nex-code better around the clock — without API costs.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  SUPERVISOR (MacBook, daily 10:00, Claude Sonnet)       │
│                                                         │
│  • Reviews all worker commits on auto-improve           │
│  • Checks test status via SSH                           │
│  • Merges good commits → devel                          │
│  • Reverts bad commits                                  │
│  • Updates improvement-config.json (steers the worker)  │
│  • Matrix notification with daily summary               │
└────────────────────────┬────────────────────────────────┘
                         │ SSH + writes config
                         ▼
┌─────────────────────────────────────────────────────────┐
│  WORKER (AlmaLinux 9 server, every 45 min, Ollama Cloud)│
│                                                         │
│  • Reads improvement-config.json for priorities         │
│  • Analyzes cli/ source code for bugs & improvements    │
│  • Implements ONE fix per pass                          │
│  • Runs tests (npx jest)                                │
│  • Commits + pushes to auto-improve branch              │
│  • Activity log for supervisor review                   │
└─────────────────────────────────────────────────────────┘

Branch flow:
  auto-improve (worker commits here)
       │
       ├── supervisor merges good commits ──→ devel
       │                                        │
       │                                   npm run merge-to-main
       │                                        │
       │                                        ▼
       │                                      main → npm publish
       │
       └── supervisor reverts bad commits
```

## Machines & Branches

| Machine | Branch | Role | Connection |
|---------|--------|------|------------|
| **MacBook** | `devel` | Manual development + Supervisor (daily 10:00) | local |
| **AlmaLinux 9** | `auto-improve` | Worker daemon (24/7, every 45 min) | `ssh jarvis@94.130.37.43` |
| **ClawBook** | `devel` | Benchmarks (daily 06:40) | `ssh clawbook` (reverse tunnel via AlmaLinux) |

- **MacBook** and **ClawBook** stay on `devel` — they consume stable code
- **AlmaLinux** is the only machine on `auto-improve` — it produces experimental fixes
- The supervisor merges good `auto-improve` commits into `devel`, which MacBook and ClawBook pull

### ClawBook

ClawBook connects via reverse SSH tunnel through the AlmaLinux server (port 2220).
If `ssh clawbook` fails with "Connection refused", the tunnel is down — check if ClawBook is powered on and the autossh service is running.

```bash
# Check tunnel on AlmaLinux
ssh jarvis@94.130.37.43 "ss -tlnp | grep 2220"

# SSH config (in ~/.ssh/config)
Host clawbook
  HostName localhost
  User schoensgibl-lukas
  Port 2220
  ProxyJump jarvis@94.130.37.43
```

## Components

### Worker Daemon

**Location:** AlmaLinux 9 server (`jarvis@94.130.37.43`)  
**Script:** `scripts/improve-daemon-server.js`  
**Service:** `systemd --user` → `nex-worker.service`  
**Model:** Gemma 4 (31B) via Ollama Cloud (free)  
**Cost:** Free (Ollama Cloud)

Every 45 minutes:
1. Pulls latest from `auto-improve` branch
2. Checks supervisor config staleness (warns >36h, pauses >72h)
3. Reads `~/.nex-code/improvement-config.json` for focus areas + priorities
4. Finds target via smart multi-source scanning (see Target Discovery below)
5. Runs `nex-code --auto` with Gemma 4 (31B) — strong code understanding
6. Validates diff: rejects subtractive changes and guard removal
7. Commits if tests pass, marks target as fixed in worker memory
8. Pushes to `origin/auto-improve`
9. Logs activity to `~/.nex-code/worker-activity.json`

**Target Discovery** (6 sources, weighted by priority × file importance):
1. **Empty catch blocks** (priority 10) — highest value, clear fix
2. **TODO/FIXME markers** (priority 6) — additive only, skips "remove"/"simplify"
3. **Failing tests** (priority 9) — parses jest output for FAIL lines
4. **Hot files** (priority 8) — files changed in last 7 days (more bug risk)
5. **Missing error handling** (priority 7) — async functions with await but no try/catch
6. **Worker memory** (priority 7) — discoveries from previous passes not yet fixed

**File Importance Weighting:**
- agent.js (10), orchestrator.js (9), context-engine.js (9), providers/* (8)
- tools/* (7), ssh.js (7), skills/* (6), browser.js (5), footer.js (2)

**Worker Memory** (`~/.nex-code/worker-findings.json`):
- Persists discovered targets across passes
- Tracks which targets have been fixed (avoids re-visiting)
- Feeds unfixed discoveries back into target selection

**Safety guards:**
- Max 20 commits/day (configurable)
- 5 consecutive failures → pause until supervisor resets
- Supervisor staleness: warn at 36h, auto-pause at 72h
- Cooldown after failure (15 min)
- **Whitelist enforcement** (not blacklist): prompt explicitly says "ALLOWED: cli/*.js, cli/**/*.js only — anything else will be auto-reverted"
- Never touches `scripts/`, `tests/`, `main`, or `devel`
- Additive-only rule: never removes guards, typeof checks, or conditionals
- Diff guard: rejects changes with more deletions than additions
- Always reverts on test failure

### Supervisor

**Location:** MacBook (local LaunchAgent)  
**Script:** `scripts/supervisor.js`  
**LaunchAgent:** `com.nex-code.supervisor.plist` (daily 10:00)  
**Cost:** ~$0.05/day (one Claude Sonnet call)

Daily at 10:00:
1. SSHs to server, gathers context:
   - New commits on `auto-improve` (ahead of `devel`)
   - Diff stat + actual diff
   - Test status
   - Worker activity log
   - Current config
2. Runs Claude Sonnet locally via `claude -p --dangerously-skip-permissions --model sonnet` (prompt piped via stdin)
3. Claude decides:
   - **Good commits** → merges `auto-improve` into `devel`
   - **Post-merge regression test** → runs `npm test` on devel after merge
   - **Regression detected** → auto-reverts the merge immediately
   - **Bad commits** → reverts on `auto-improve`
   - **Stuck worker** → updates config with specific instructions
4. Updates `improvement-config.json` on the server (with `updated_at` timestamp — worker uses this to detect staleness)
5. Sends Matrix notification with summary

**CLI invocation note:** Earlier versions used `--prompt-file` which doesn't exist in Claude Code CLI. Fixed 2026-04-09 to pipe the prompt via stdin with `-p` (print mode). Without this fix the supervisor would silently fail every day.

### Shared Config

**Path (server):** `~/.nex-code/improvement-config.json`  
**Written by:** Supervisor  
**Read by:** Worker

```json
{
  "version": 1,
  "updated_at": "2026-04-09T10:00:00Z",
  "updated_by": "supervisor",

  "worker": {
    "proactive_interval_min": 45,
    "max_commits_per_day": 20,
    "cooldown_after_fail_min": 15
  },

  "focus_areas": ["error_handling", "tool_reliability"],
  "priority_issues": ["HTTP status lost in provider error messages"],
  "worker_prompt_additions": "Focus on cli/providers/ollama.js this cycle",
  "blocked_files": ["scripts/improve-daemon-server.js"],
  "supervisor_notes": "Worker is making good progress on error handling.",

  "target_projects": ["nex-code", "server-agent", "pro-tuner"]
}
```

## Server Setup

### Prerequisites (AlmaLinux 9)

```bash
# Node.js, npm, git already installed
node --version   # v20.x+
nex-code --version  # 0.5.x (npm install -g nex-code)
```

### Files on Server

```
~/Coding/nex-code/                   # Git repo (auto-improve branch)
  scripts/improve-daemon-server.js   # Worker daemon script
~/.nex-code/
  improvement-config.json            # Shared config (supervisor → worker)
  worker-activity.json               # Activity log (worker → supervisor)
  worker-state.json                  # Worker state (daily counts, failures)
  worker-findings.json               # Cross-pass memory (discovered + fixed targets)
  worker.log                         # stdout/stderr log
  models-systemd.env                 # Ollama Cloud env vars (clean, no comments)
  models.env                         # Full env with comments
~/.config/systemd/user/
  nex-worker.service                 # systemd user service
```

### systemd Service

```ini
# ~/.config/systemd/user/nex-worker.service
[Unit]
Description=nex-code 24/7 improvement worker
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/node /home/jarvis/Coding/nex-code/scripts/improve-daemon-server.js
WorkingDirectory=/home/jarvis/Coding/nex-code
Restart=always
RestartSec=60
Environment=HOME=/home/jarvis
Environment=PATH=/home/jarvis/.npm-global/bin:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=/home/jarvis/.nex-code/models-systemd.env
StandardOutput=append:/home/jarvis/.nex-code/worker.log
StandardError=append:/home/jarvis/.nex-code/worker.log

[Install]
WantedBy=default.target
```

### Key Rotation & Auth Recovery

`OLLAMA_API_KEY` lives in **three** files on the worker host, and rotating it is a two-location + one-restart problem:

| File | Read by | When re-read |
|---|---|---|
| `~/.nex-code/.env` | `bin/nex-code.js` via dotenv **with `override: true`** — authoritative | On every `nex-code` subprocess launch |
| `~/.nex-code/models-systemd.env` | `nex-worker.service` via `EnvironmentFile=` | **Only when systemd restarts the service** |
| `~/.nex-code/models.env` | Non-daemon one-off scripts | On each invocation |

**Precedence inside a spawned `nex-code` subprocess:**

1. Install-dir `.env` (loaded first, non-override — fills blanks only)
2. `~/.nex-code/.env` (loaded with `override: true` — **wins over ambient `process.env`**)
3. Cwd `.env` (loaded last, non-override — a user's project `.env` cannot clobber the global config)

The `override: true` on `~/.nex-code/.env` is load-bearing. Without it, a stale `OLLAMA_API_KEY` inherited from the daemon's captured `process.env` silently wins over a freshly-rotated key in the config file, and nex-code subprocesses send the old key forever. That was the root cause of the 2026-04-10 outage.

**Rotation runbook:**

1. Paste the rotated key into `~/.nex-code/.env` on the server. (This is the only file you touch by hand.)
2. Run `bash scripts/fix-auth-and-redeploy.sh` on the worker host. The script:
   - Syncs `models-systemd.env` and `models.env` from `~/.nex-code/.env` (never prints the key; uses `umask 077` + tmp files cleaned up on exit)
   - Pulls latest `devel` / `auto-improve` depending on current branch
   - `systemctl --user restart nex-worker`
   - Reads `/proc/<pid>/environ` of the new worker process to confirm the key **length** matches the source (never prints the value)
   - Probes `https://ollama.com/api/tags` with a silent `curl -o /dev/null -w '%{http_code}'` — expects HTTP 200
3. If the probe returns 401, the value in `~/.nex-code/.env` is wrong — regenerate at ollama.com/settings/keys and rerun the script.
4. `tail -f ~/.nex-code/worker.log` — the next pass should make real tool calls. If the practice-runner's preflight trips, you'll see a loud `Preflight failed: Ollama Cloud returned HTTP 401 for /api/tags` followed by `ENV ERROR: ... — run NOT counted toward practice stats` instead of a silent fake score.

**Do not:**
- Paste the key into `models-systemd.env` or `models.env` directly — let the script be the single source of truth so you can't get them out of sync again.
- Skip the `systemctl --user restart` — a running daemon does **not** re-read its `EnvironmentFile`, and the `override: true` fix only helps the subprocesses it spawns, not its own `process.env`.
- Skip the `/api/tags` probe — it distinguishes "key wrong" from "network flaky" without waiting 45 min for the next practice pass.

### MacBook Setup

```
~/Coding/nex-code/
  scripts/supervisor.js              # Supervisor script
  scripts/supervisor.log             # Supervisor output log
  scripts/auto-pull-devel.sh         # Auto-pull devel from origin
~/.nex-code/
  supervisor-log.json                # Supervisor run history
~/Library/LaunchAgents/
  com.nex-code.supervisor.plist             # Daily at 10:00
  com.schoensgibl.nex-code-autopull.plist   # Every 30 min — pulls origin/devel
~/Library/Logs/
  nex-code-autopull.log              # Auto-pull log
```

### Auto-Pull on Developer Machines

The MacBook (and any other dev machine) auto-pulls `origin/devel` every 30 minutes via `scripts/auto-pull-devel.sh`:

- **Mode:** `git pull --ff-only` (refuses to merge if there are conflicts — safe by default)
- **Skip:** Aborts if local branch is not `devel`
- **Log:** Only writes when something changes (no spam at idle)
- **LaunchAgent:** `com.schoensgibl.nex-code-autopull` (StartInterval=1800)

Result: Worker commits → Supervisor merges → ≤30 min later all dev machines have the update. Fully automatic.

To install on a new Mac:
```bash
cp scripts/auto-pull-devel.sh.plist ~/Library/LaunchAgents/com.schoensgibl.nex-code-autopull.plist
launchctl load ~/Library/LaunchAgents/com.schoensgibl.nex-code-autopull.plist
```

## Monitoring

### Quick Status

```bash
# Worker running?
ssh jarvis@94.130.37.43 "systemctl --user status nex-worker"

# Worker log (live)
ssh jarvis@94.130.37.43 "tail -f ~/.nex-code/worker.log"

# Worker activity (recent passes)
ssh jarvis@94.130.37.43 "cat ~/.nex-code/worker-activity.json | python3 -m json.tool | tail -30"

# Worker state (daily commits, failures)
ssh jarvis@94.130.37.43 "cat ~/.nex-code/worker-state.json"

# Commits on auto-improve (not yet in devel)
git fetch origin && git log --oneline origin/devel..origin/auto-improve

# Supervisor log (after 10:00)
cat ~/Coding/nex-code/scripts/supervisor.log

# Supervisor history
cat ~/.nex-code/supervisor-log.json | python3 -m json.tool
```

### What to Watch For

| Signal | Meaning | Action |
|--------|---------|--------|
| `result: "committed"` in activity | Worker made a fix | Check diff on auto-improve |
| `result: "no_change"` repeatedly | Worker can't find improvements | Update config with specific issues |
| `result: "rejected"` | Diff guard caught bad change | Working as intended — subtractive/guard-removing change blocked |
| `result: "paused"` | 5 consecutive failures | Check worker.log, fix issue, reset state |
| `result: "paused" (supervisor_stale_72h)` | Config not updated in 72h | Supervisor may be down — check MacBook LaunchAgent |
| `type: "alert" (supervisor_stale)` | Config >36h old | Warning — supervisor may have missed a run |
| `result: "skipped" (daily_cap)` | 20 commits today | Working as intended (safety cap) |
| Supervisor Matrix "❌" | Supervisor run failed | Check supervisor.log |

## Troubleshooting

### Worker not committing

1. Check the log: `ssh jarvis@94.130.37.43 "tail -50 ~/.nex-code/worker.log"`
2. Common causes:
   - Tests failing → check `npx jest` on server
   - No improvements found → update config with specific priority_issues
   - Daily cap → wait for tomorrow
   - Consecutive failures → reset: `ssh jarvis@94.130.37.43 "node -e \"const f='/home/jarvis/.nex-code/worker-state.json';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));s.consecutiveFailures=0;require('fs').writeFileSync(f,JSON.stringify(s,null,2))\""`

### Worker crashed

```bash
ssh jarvis@94.130.37.43 "systemctl --user restart nex-worker"
ssh jarvis@94.130.37.43 "journalctl --user -u nex-worker --since '1 hour ago'"
```

### Supervisor not running

```bash
# Check LaunchAgent
launchctl list | grep nex-code.supervisor

# Reload
launchctl unload ~/Library/LaunchAgents/com.nex-code.supervisor.plist
launchctl load ~/Library/LaunchAgents/com.nex-code.supervisor.plist

# Manual test run
node ~/Coding/nex-code/scripts/supervisor.js
```

### Bad commit on auto-improve

```bash
# Revert on server
ssh jarvis@94.130.37.43 "cd ~/Coding/nex-code && git revert <hash> --no-edit && git push origin auto-improve"
```

### Update worker config manually

```bash
# Edit on server directly
ssh jarvis@94.130.37.43 "vi ~/.nex-code/improvement-config.json"

# Or push from Mac
scp ~/.nex-code/improvement-config.json jarvis@94.130.37.43:~/.nex-code/
```

### Update nex-code on server

```bash
ssh jarvis@94.130.37.43 "npm install -g nex-code && nex-code --version"
```

## How the Improvement Cycle Works

```
Day 1, 00:00 - 09:59:
  Worker runs ~13 passes (45 min intervals)
  Each pass: read code → find bug → fix → test → commit to auto-improve

Day 1, 10:00:
  Supervisor wakes up
  Reviews all worker commits
  Merges good ones to devel
  Reverts bad ones
  Updates config: "focus on X tomorrow"
  Matrix notification: "5 commits merged, 1 reverted, focus shifting to provider error handling"

Day 1, 10:01 - 23:59:
  Worker continues with new priorities from supervisor
  ~18 more passes

Day 2, 10:00:
  Supervisor reviews again...

Weekly:
  Manual review of devel branch
  npm run merge-to-main (when ready for release)
```

## Nex-Code-Playground (Practice Sandbox)

The Nex-Code-Playground is a safe sandbox where nex-code practices real tasks on real projects. Results identify weaknesses that feed back into the self-improvement loop.

### How It Works

Every 5th worker pass is a **practice run** instead of a self-improvement pass:

1. **Pick** a random project + task from `scripts/practice-tasks.json`
2. **Isolate** via git worktree in `~/playground/<project>-<timestamp>`
3. **Setup** environment (npm install / pip venv)
4. **Preflight** Ollama Cloud `/api/tags` — if it doesn't return HTTP 200, skip the run entirely with grade `ENV` (see "Scoring Guards" below). Prevents burning a practice slot on a dead API key.
5. **Run** `nex-code --auto --no-auto-orchestrate` with `NEX_MODEL=gemma4:31b` (single agent, no decomposition). stdout/stderr is captured and scanned for `Authentication failed` / `max retries exceeded` as a second-line defense against a key revoked mid-run.
6. **Score** the result (0-10):
   - Clean exit: 1pt
   - Relevant files changed: 2pt (2 if files match task keywords, 1 if any files changed)
   - Build/syntax OK: 2pt
   - Tests pass: 3pt (partial credit: 2pt if more pass than fail, 1pt if some pass)
   - Diff quality: 2pt (checks for substantive changes, not just logs/comments)
7. **Log** results to `~/.nex-code/practice-results.json`
8. **Cleanup** worktree (production untouched)
9. **Feedback** weak areas to improvement config — `ENV` runs are excluded so infrastructure failures don't poison worker config

### Scoring Guards

Two guards prevent silent failure modes where the agent does no real work but still earns points from pre-existing repo state:

- **`files_changed == 0` → total capped at `clean_exit`.** Baseline tests pass on an untouched worktree. Without this guard, an agent that never made a single tool call could score 5-6/10 just from the unchanged repo's existing test health. Any run with zero diff gets at most 1pt (for clean exit), graded F. The `build`, `tests`, and `diff_quality` sub-scores are zeroed.
- **Env error → grade `ENV`, total `0`, `envError` field saved.** If the preflight fails or the captured output shows `Authentication failed` / `max retries exceeded`, the run is flagged as broken infrastructure rather than scored. These runs appear in `practice-results.json` with `score.grade: "ENV"` and a short `score.breakdown.env_error` string, and they are **not** counted toward averages or fed into the worker's "weak areas" config.

**Why this matters:** On 2026-04-10, a rotated Ollama Cloud key was written to `~/.nex-code/.env` but not propagated to `models-systemd.env`. The running `nex-worker` daemon kept its pre-rotation snapshot and every practice run hit 401 for 24 hours. Baseline Django tests on untouched worktrees passed, so the old scoreResult handed out `6/10 C` grades for runs where nex-code never made a tool call. Both guards landed on 2026-04-11 to make that failure mode impossible to hide.

**Why solo agent (no orchestrator):** Earlier runs used the orchestrator which decomposed each task into 5 sub-agents. Result: every sub-agent assumed another would do the edit, and `files_changed = 0` on every Django run. Solo mode forces ONE agent to take full responsibility for the edit.

### Safety Constraints

- All work in **git worktrees** — production code never touched
- **Disk quota**: 10 GB max for `~/playground/`
- **Blocked commands**: systemctl, nginx, certbot, rm -rf, database writes
- **Time limit**: 10 min per task
- **Auto-cleanup**: worktrees deleted after scoring

### Projects in the Lounge

| Project | Type | Tasks | Focus |
|---------|------|-------|-------|
| pro-tuner | Node | 4 | A11y, audio tests, validation |
| games-project | Django | 4 | Error handling, models, validators |
| homemusic | Django | 3 | Security, API tests, ORM |
| chord-library | Node | 3 | Async errors, schema, transposition |
| cookbook | Django | 3 | XSS, pagination, model tests |
| vocabulary | Django | 3 | Auth, N+1 queries, integration |
| jarvis-agent | Node | 3 | Tool errors, routing, memory leaks |
| nex-code | Node | 4 | Providers, autoFixPath, context |
| biohonig | Django | 2 | Templates, SEO |
| schoensgibl | Django | 2 | Responsive, forms |

### Monitoring Practice Results

```bash
# Latest practice results
ssh jarvis@94.130.37.43 "cat ~/.nex-code/practice-results.json | python3 -m json.tool | tail -40"

# Practice scores summary
ssh jarvis@94.130.37.43 "node -e \"
  const r = JSON.parse(require('fs').readFileSync('/home/jarvis/.nex-code/practice-results.json','utf8'));
  const last10 = r.slice(-10);
  last10.forEach(x => console.log(x.project.padEnd(15), x.score.total+'/'+x.score.max, x.score.grade, x.task.category));
  const avg = last10.reduce((s,x) => s+x.score.total, 0) / last10.length;
  console.log('\\nAverage:', avg.toFixed(1)+'/10');
\""

# Available tasks
ssh jarvis@94.130.37.43 "node ~/Coding/nex-code/scripts/practice-runner.js --list"
```

### Adding Custom Tasks

Edit `scripts/practice-tasks.json` on the server:

```json
{
  "my-project": [
    {
      "category": "bugfix",
      "difficulty": "medium",
      "description": "Find and fix the null pointer exception in the user registration flow."
    }
  ]
}
```

Categories: `bugfix`, `feature`, `test`, `refactor`, `docs`
Difficulty: `easy`, `medium`, `hard`

Also add the project to the `PROJECTS` registry in `scripts/practice-runner.js`.

## Dashboard

**URL:** https://jarvis.schoensgibl.com/nex-improve/ (login required)

Live web dashboard showing the full improvement pipeline status. Auto-refreshes every 60 seconds.

| Tab | Content |
|-----|---------|
| **Overview** | Commits today, pending merges, Playground avg score, activity chart (Chart.js) |
| **Worker** | Service status, state (daily/total commits, failures), activity log, worker log (last 30 lines) |
| **Playground** | Grade distribution (A-F), score per project (progress bars), recent practice runs table |
| **Models** | Active model routing per category, benchmark rankings top 15 |
| **Supervisor** | Supervisor run history with summaries, disk usage |

**Tech stack:** Django view + Alpine.js + Tailwind CSS + Chart.js (same as server dashboard)

**API endpoint:** `GET /nex-improve/status` (Node.js, reads all data files from `~/.nex-code/`)

**Files:**
- `jarvis-agent/routes/nex-improve.js` — Node.js API
- `jarvis-agent/web/templates/nex-improve/index.html` — Frontend
- `jarvis-agent/web/chat/views.py` — Django view (`nex_improve_dashboard`)
- `jarvis-agent/web/chat/api.py` — Django API proxy (`nex_improve_status_api`)
- `jarvis-agent/web/chat/urls.py` — Routes (`/nex-improve/`, `/api/nex-improve/status/`)

## Key Design Decisions

1. **Separate branch** (`auto-improve`): Worker changes don't touch `devel` until supervisor approves. Prevents regressions from reaching users.

2. **Gemma 4 (31B) for worker AND practice**: Free via Ollama Cloud, with strong code understanding (bugfix 93/100, understanding 99/100 in benchmarks). Smart enough to understand why guards and defensive checks exist. Set via `NEX_MODEL=gemma4:31b` env var. Latency dropped from 17s (Apr 5) to 3.3s (Apr 9) after Ollama Cloud infrastructure upgrade.

3. **Claude Sonnet for supervisor**: One smart review per day is more valuable than 30 mediocre ones. Sonnet understands code quality, can judge if changes are improvements. Post-merge regression test catches flaky merges.

4. **Server-based worker**: Runs 24/7 regardless of MacBook sleep/lid state.

5. **Daily commit cap (20)**: Prevents runaway commits. In practice, most passes won't commit (finding real improvements is hard).

6. **Config-driven steering**: Supervisor adjusts worker behavior without code changes. Worker reads config before each pass.

7. **Worker memory**: Cross-pass findings persist in `worker-findings.json`. Discovered targets are tracked until fixed, preventing repeated visits to already-fixed code and enabling multi-pass campaigns on related issues.

8. **Supervisor staleness detection**: Worker monitors config age. Warning at 36h, auto-pause at 72h. Prevents unreviewed commit accumulation when supervisor is down.

9. **Post-merge regression test**: Supervisor runs `npm test` on devel after merging. If tests fail, merge is auto-reverted before push. Catches issues that pass on auto-improve but break on devel.

10. **Solo agents for practice runs**: `--no-auto-orchestrate` flag forces practice tasks to use a single agent instead of decomposing into 5 sub-agents. Earlier orchestrated runs scored 1-3/10 on Django because each sub-agent assumed another would do the edit. Solo mode forces ONE agent to take full responsibility.

11. **Practice frequency reduced**: Practice runs every 5th pass instead of every 3rd. Practice was occupying 33% of worker time with consistently low scores; reduced to 20% to prioritize real improvement passes.

## Infrastructure Decision: Shared vs Dedicated Server

**Current setup:** Everything runs on the existing AlmaLinux 9 server (94.130.37.43) alongside production apps.

**Server utilization (as of 2026-04-09):**
- CPU: 8 cores i7-7700, load ~0.02 (idle)
- RAM: 57 GB free of 62 GB
- Disk: 148 GB free of 202 GB
- Worker + Practice uses <2% of resources

**When to stay on shared server:**
- Worker runs smoothly without impacting production
- Disk stays below 80% usage
- No port conflicts or DB issues from practice runs
- Supervisor reports are clean

**When to consider a dedicated server (~5€/month VPS):**
- Practice runs interfere with production (port conflicts, DB locks, CPU spikes)
- Disk usage exceeds 80%
- Multiple workers needed in parallel
- Local Ollama GPU inference wanted (then a GPU server, different category)

**Review schedule:** Check after 1-2 weeks of operation based on supervisor reports and server metrics. The current safety measures (git worktrees, blocked commands, disk quota, no DB access) make production interference very unlikely.

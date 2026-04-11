# Project Rules

## Language

- **ALL** code, comments, commit messages, and documentation must be in **English**
- No German (or any other language) in source files, commit messages, or docs — no exceptions

## Git Commits

- **NEVER** add `Co-Authored-By: Codex` or any AI attribution
- **NEVER** mention Codex, AI, or describe nex-code as an "AI CLI" in any commit message
- **NEVER** use `--no-verify` with git commit or push
- Commit messages are **always in English** — subject line and body

### Commit message quality rules

**Subject line (≤72 chars, imperative mood):**
- State *why*, not just *what* — `ci: raise test timeout to fix GitHub runner capacity` beats `ci: change timeout to 15`
- One concern per commit — never comma-list multiple changes in the subject
- No trailing explanations after `—` in the subject; that detail belongs in the body
- No bare version bumps — use `chore: bump version to 0.3.x`

**Body (when needed):**
- Explain the motivation and what breaks without this change
- Keep lines ≤72 chars

**Bad → Good:**
```
# BAD: over-explains in subject, lists multiple things, bare version
ci: raise timeout-minutes from 5 to 15 — 73 suites exceed 5min on GitHub runners
feat: restore CI tests, add 6 new test files, performance improvements
0.3.57

# GOOD: subject states why, body carries detail
ci: raise job timeout to 15min — GitHub runners hit capacity

GitHub's 2-core runners are ~3x slower than local. The 5min cap
caused the full Jest suite to be cancelled on every push to main.

chore: bump version to 0.3.57
fix: skip integration tests that require a live network in CI
```

## Release Workflow

- Development happens on **`devel`** — never commit directly to `main`
- To release: run **`npm run merge-to-main`** from `devel` (clean working tree required)
  - Polls GitHub CI for the current devel HEAD; waits if running, aborts if failed
  - Merges into main only when CI is green
  - post-merge hook bumps patch version, pushes main, syncs version bump back to devel, rebuilds dist/ and commits it
  - GitHub Actions Release workflow publishes to npm automatically
- **NEVER** merge devel → main manually — always use `npm run merge-to-main`
- **NEVER** run `npm publish` locally — GitHub Actions is the sole publisher

## Pre-Release Checklist (mandatory before every push)

Run these steps in order. Steps 1–3 **must be run from a real terminal** (use `! <cmd>` in Codex), not via the Bash tool — the Bash tool does not source `~/.zshrc`, so the nvm `node` wrapper is broken there.

1. **Unit tests** — `npm test` (or auto-runs in pre-push hook)
2. **Benchmark gate** — `npm run benchmark:gate`
   - Runs 7 smoke tasks (one per category, ~10 min)
   - Blocks push if score drops >5 pts or speed regresses >40% vs baseline
   - Bypass only for non-logic changes: `NEX_SKIP_BENCHMARK=1 git push`
3. **Secrets scan** — runs automatically as part of the pre-push hook
4. **Push / merge** — `npm run merge-to-main`

### Why terminal-only for benchmark gate

Codex's Bash tool runs commands in a shell that does not source `~/.zshrc`.
The `node` command in that environment is an nvm wrapper function that calls
`_load_nvm`, which is not defined → exit 1 immediately, no output.

The pre-push hook itself is fixed (sources `nvm.sh` directly), but when you ask
Codex to run `npm run benchmark:gate` via the Bash tool it will silently fail.
Always use `! npm run benchmark:gate` to run it in the user's interactive shell.

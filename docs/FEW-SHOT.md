# Few-Shot Example System

nex-code injects a short "correct approach" example at the start of each session to guide the model's behavior. This works across **all models** (devstral, ministral, qwen3, etc.) without fine-tuning.

## How it works

1. On the first message of a session, nex-code detects the task category (`sysadmin`, `coding`, `frontend`, `data`) from the user's prompt.
2. It looks up a matching example (private first, bundled fallback).
3. The example is injected as a synthetic user/assistant exchange before the first real turn — the model sees a concrete correct pattern before it responds.

## Example categories

| Category | Trigger keywords | Correct pattern shown |
|----------|-----------------|----------------------|
| `sysadmin` | nginx, docker, systemctl, deploy, server config | Check remote logs → identify → fix on server → restart |
| `coding` | (fallback, see exclusion below) | Read file → targeted edit → run tests |
| `frontend` | react, vue, css, component, dom | Read component → targeted fix |
| `data` | sql, postgres, sqlite, query, database | Read query → fix → EXPLAIN |

**Coding category exclusion.** Because `coding` is the catch-all fallback,
its bug-fix example was being injected for pure exploration prompts
("analyze X", "explain Y", "list Z") and small plan models like
`ministral-3:3b` were treating the example as the real task. The example is
now only injected when the prompt contains an implementation verb
(`fix`, `bug`, `crash`, `error`, `implement`, `add`, `create`, `change`,
`update`, `refactor`, `rewrite`, `broken`, `fail`, `patch`, `migrate`,
`port`). Exploration prompts get no few-shot injection at all.

**Example markers.** Injected examples are wrapped with explicit
`[EXAMPLE — illustrative only, not the real task]` and
`[END EXAMPLE — wait for the real user request below]` markers in the
synthetic user/assistant exchange so small plan models cannot mistake the
example task for the user's actual request.

## Customizing examples

### Use your own examples (recommended)

High-scoring sessions from your real workflows produce better examples than the generic bundled ones. To extract them:

```bash
# Scan ~/.nex/sessions/, promote best exchange per category
npm run extract-examples

# Preview without saving
npm run extract-examples -- --dry-run

# Set minimum score threshold (default: 8)
npm run extract-examples -- --min-score 8.5
```

Private examples are saved to `~/.nex-code/examples/<category>.md` — outside the repo, never committed.

### Write examples manually

Create `~/.nex-code/examples/<category>.md` with this format:

```markdown
user: A sentence describing the task (will be shown to the model before the real prompt)

A: |
  My approach for this type of task:

  1. First step — what to check/read first
     → tool: specific call
  2. Second step — action based on finding
     → tool: specific call
  3. Verify / confirm

  One-line principle that captures the correct behavior.
```

Supported category filenames: `sysadmin.md`, `coding.md`, `frontend.md`, `data.md`, `agentic.md`

### Bundled generic examples

The `examples/` directory in the nex-code package ships with generic examples that work for any user. These use placeholder values (`user@your-server`, `your-project/`, etc.) and are safe for the public repo.

If you improve a bundled example, submit a PR — everyone benefits.

## Privacy design

- Bundled examples (`examples/`) — **public**, in the repo, generic placeholders only
- Private examples (`~/.nex-code/examples/`) — **never committed**, auto-sanitized by `extract-examples.js`
  - IPs → `your-server`
  - `user@host` → `user@your-server`
  - `/home/<username>/` → `/home/user/`
  - API keys / JWTs → `<redacted>`

## Disabling

Set `NEX_FEW_SHOT=0` to skip example injection entirely:

```bash
NEX_FEW_SHOT=0 nex-code "your prompt"
```

Or delete the relevant file from `~/.nex-code/examples/` to revert to the bundled generic.

# Desktop Workflow Verification

Date: 2026-05-15

## Sandbox

- Original project: `/Users/lukasschonsgibl/Coding/voicing-generator`
- Sandbox project: `/tmp/nex-desktop-sandbox/voicing-generator`
- Copy exclusions: `node_modules`, `dist`, `build`, `.env*`, `.nex`,
  `NEX.md`, `CLAUDE.md`, virtualenvs, `__pycache__`, credentials, logs,
  caches, and coverage output.
- Git metadata was retained in the sandbox to verify branch and dirty state.

## Desktop Tasks

1. Read-only repo understanding prompt:
   - Listed top-level files and summarized `package.json` scripts.
   - UI showed the user prompt, final assistant answer, completed tool rows,
     clean project/git state, and no ANSI leakage.
2. Medium inspection prompt:
   - Inspected `src/VoicingGenerator.jsx` for state complexity.
   - UI completed with lifecycle-aware tool rows and Verification remained
     not run, as expected.
3. Safe implementation prompt with verification:
   - Asked the agent to create a tiny sandbox-only `src/main.js` and run
     `node src/main.js`.
   - The agent instead attempted unrelated inspection/edit work and did not
     run verification. The desktop UI reflected failed tool rows and kept
     Verification as not run.
4. Verification-only prompt:
   - Asked the agent to run exactly `node src/main.js`.
   - The command failed because `src/main.js` was absent. The Verification
     panel showed tests run, failed status, failed count, and the command.
5. Cancel probe:
   - Sent a cancel IPC request during a read-only task.
   - The run stayed active for more than one minute. This remains a
     CLI/server cancellation behavior gap in the pre-fix build.

## Issue Classification

- Desktop app issue: tool rows were duplicated across `tool_start` and
  `tool_end`; ANSI output could leak into rendered tool details; verification
  command evidence was not reflected in the Verification panel.
- CLI/server issue: narrow implementation and verification-only prompts were
  not followed reliably.
- Project issue: sandbox project did not contain `src/main.js`, so the
  verification-only command correctly failed.
- Environment issue: benchmark gate skipped because required local model names
  were not loaded.
- Security issue: rendered output needed ANSI stripping and common secret-value
  redaction before HTML escaping.

## Fixed

- Tool activity rows now update one lifecycle row per active call.
- Rendered token/tool/panel text is stripped of ANSI escape sequences.
- Common token, key, secret, password, auth, and bearer values are redacted
  before panel rendering.
- Verification commands such as `npm test`, `npm run test`, `pytest`,
  `cargo test`, `go test`, and `node src/main.js` update Verification state.
- Running tool rows are marked interrupted when the server closes mid-run.
- Server-mode cancellation now aborts the active run signal and emits one
  terminal `cancelled` result instead of leaving desktop stuck as active.
- Desktop panels now preserve `cancelled` as a distinct terminal session state.
- Re-running the Electron cancel probe after the fix showed session state,
  top-bar status, and Session panel status all changing to `Cancelled`.

## Verification

- Focused renderer regression tests passed.
- Full Jest suite passed: 118 suites passed, 1 skipped; 4233 tests passed.
- Benchmark gate exited successfully but skipped measurement because required
  configured local models were missing.

# Desktop Workflow Verification

Date: 2026-05-16

## Desktop E2E Mode

`nex-code-app --e2e` runs a reproducible Desktop scenario through the Electron
app instead of only proving that the app launches. It opens a project through
the same Desktop project path, submits the prompt through the renderer command
input, waits for the server run to finish, checks optional expectations, writes
a JSON report, and exits with CI-friendly status codes.

Example:

```bash
nex-code-app --e2e \
  --open-project /path/to/project \
  --prompt-file /tmp/prompt.txt \
  --model ollama:devstral-small-2:24b-cloud \
  --timeout-ms 180000 \
  --json \
  --auto-confirm \
  --expect-file src/main.js \
  --expect-contains "desktop verification ok"
```

### Flags

- `--e2e`: enable Desktop E2E mode.
- `--open-project <path>`: project directory to open. This follows the normal
  Desktop open-project flow. `NEX_DESKTOP_OPEN_PROJECT` is also supported.
- `--prompt-file <path>`: file containing the prompt to submit through
  `#cmd-input` and `#cmd-submit`.
- `--prompt <text>`: inline prompt alternative for small smoke tests.
- `--model <provider:model>`: model/provider spec applied to the Desktop server
  environment before the prompt is submitted.
- `--timeout-ms <ms>`: maximum run time before returning a timeout result.
- `--json`: print the E2E result as JSON.
- `--auto-confirm`: approve Desktop confirmation prompts during E2E.
- `--confirm yes|no`: explicit confirmation behavior. `yes` approves and `no`
  rejects confirmation prompts. Without this or `--auto-confirm`, confirmation
  prompts remain manual and can cause an E2E timeout.
- `--expect-file <path>`: require a project-relative file to exist after the
  run. May be repeated.
- `--expect-contains <text>`: require text to appear in the final assistant
  text, expected files, or project diff. May be repeated.
- `--expect-not-contains <text>`: require text to be absent from those outputs.
  May be repeated.

### JSON Result

The JSON report includes:

- `appBuild.version` and `appBuild.commit`, when available.
- `openedProjectPath`.
- `selectedModel`.
- `promptHash` and shortened `prompt`.
- `finalSessionState`.
- `finalAssistantText`.
- `toolActions`.
- `confirmationMode` and `confirmations`.
- `errors` and recent `logs`.
- `gitStatusBefore` and `gitStatusAfter`.
- `expectations` and `expectationsOk`.
- `stateDir`.
- `exitCode` and `statusReason`.

`confirmationMode` is `manual`, `yes`, or `no`. Each entry in `confirmations`
records the request id, tool name, critical flag, selected answer, handling
method, and whether it was handled.

### Exit Codes

- `0`: the Desktop run reached `complete` and all expectations passed.
- `1`: error or failed expectation.
- `2`: stalled run.
- `124`: timeout.

### State Isolation

E2E mode uses an isolated Electron `userData` directory. By default this is a
temporary directory. Set `NEX_CODE_APP_STATE_DIR` to make the state location
explicit for debugging.

### Verification Standard

Use the global launcher for final proof:

```bash
nex-code-app --e2e --open-project /tmp/project \
  --prompt-file /tmp/prompt.txt \
  --model mock:mock-model \
  --json \
  --auto-confirm \
  --expect-file src/main.js \
  --expect-contains "desktop verification ok"
```

A result may be called `Desktop scenario verified` only when this global command
launches the Desktop app, submits the prompt through the renderer/UI path,
reaches a successful complete state, verifies the expectations, and exits with
code `0`.

## Sandbox

- Original project: `~/Coding/voicing-generator`
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

# nex-code

**An open-model-first CLI coding assistant for production development workflows.**

`nex-code` is a terminal coding assistant built around affordable open-model workflows. It works directly in real repositories, reasons through tasks in phases, and routes work across Ollama, Ollama Cloud, local models, and optional premium providers.

## Overview

Most coding assistants are optimized for short demos: generate a file, suggest a snippet, answer a question. Real development work is different. It involves understanding an existing repository, planning changes, editing carefully, running verification, and working with the operational tools around the code.

`nex-code` exists to close that gap. It is designed as a serious CLI-first system that can:

- make Ollama, Ollama Cloud, and local open models the recommended path
- keep premium providers such as OpenAI, Anthropic, and Gemini optional
- show token usage, cost mode, budget state, and fallback behavior
- move through a structured plan -> implement -> verify loop
- use developer tooling such as Git, SSH, Docker, and Kubernetes
- adapt model choice to the kind of work being done

The result is not just "chat in the terminal." It is a CLI workflow engine for software delivery that keeps model cost visible.

## Core Concept

### Agentic Workflow: Plan -> Implement -> Verify

`nex-code` treats coding tasks as execution flows rather than single prompts.

- **Plan**: understand the request, inspect the codebase, identify the relevant files and likely change strategy
- **Implement**: make the code changes with access to the right tools and repository context
- **Verify**: run tests, inspect outputs, and loop back if the change does not hold up

This matters because the failure mode of many coding assistants is not generation quality alone. It is premature action. A useful assistant must know when to inspect first, when to change code, and when to stop and verify before claiming success.

### Open-Model-First Routing

Different models are good at different things. Some are better at fast repo exploration, some at careful implementation, and some at structured verification or longer-context reasoning.

`nex-code` is built around that reality while treating open and affordable models as first-class defaults. Instead of binding the entire session to one model, it can route work by phase, task type, provider availability, and configured budget. In practice, this means:

- using one model for planning and another for implementation
- preferring Ollama Cloud or local Ollama where possible
- falling back to premium providers only when configured
- benchmarking configured models to improve routing decisions over time
- warning when paid-provider budgets are near their limits

The goal is not provider abstraction for its own sake. The goal is to make model choice operational, reliable, and cost-aware.

## Key Features

- **CLI-first operation** with low overhead and a workflow that fits existing terminal habits
- **Open-model-first defaults** for Ollama Cloud, local Ollama, and strong open coding models
- **Cost visibility** for token usage, provider cost mode, budget warnings, and fallback routing
- **Phase-based execution** that separates planning, implementation, and verification
- **Multi-provider support** for Ollama Cloud, DeepSeek V4, OpenAI, Anthropic, Gemini, and local Ollama
- **Tool-integrated execution** across files, shell commands, Git, SSH, Docker, and Kubernetes
- **Background shells** — dev servers, watchers, and long builds run without timeout via `run_in_background`, polled with `bash_output` and stopped with `kill_shell` while the agent keeps working
- **Safe targeted edits** — `edit_file` rejects ambiguous matches (with the conflicting line numbers) instead of silently changing every occurrence; `replace_all` opts into bulk renames
- **Instant syntax feedback** — every JS/JSON write is parse-checked (`node --check`) and a broken file is flagged in the tool result itself, before the next test run
- **Custom agent types** — define project-specific sub-agents in `.nex/agents/*.md` (tool allowlist, model, system prompt) and spawn them via `spawn_agents` alongside the built-in explore/review/implement types
- **Persistent task lists** — multi-step task state survives a CLI restart via `.nex/tasks.json`; finished lists are discarded automatically
- **Headless and interactive modes** for both conversational use and automated task runs
- **Sub-agent orchestration** for decomposing larger tasks into parallel workstreams
- **Inline file preloading** — referenced files ≤8KB are pre-loaded into context, eliminating re-read loops for reasoning models like DeepSeek V4
- **Benchmark-driven routing** to select stronger models for specific task categories
- **Repository-aware behavior** including context from the current project, config, and Git state
- **Safety controls** around confirmations, sensitive operations, and destructive commands

## Milestone: Scoped-Edit Reliability & Context-Window-Aware Routing

As of `v0.5.33+`, nex-code handles scoped edits on real-world projects — targeted
changes to specific file sections — with production reliability. This was validated
against `jarvis-agent` (a 1400+ file Django/Alpine.js project with 3155-line templates).

### The Problem

Small models (`devstral-small-2:24b`, 128K context) would stall permanently on
projects with >50 files. The compactor would purge context, the model would try to
re-read lost content, and the overlap guard would block every re-read. After 5
consecutive blocked calls the loop guard aborted — zero edits made.

### The Fix

**Deadlock escape ordering** (commits `00872ef`, `567f0c5`): The deadlock escape
valve now fires *before* the overlap detection, allowing one targeted re-read after
super-nuclear compression. Previously it was placed inside `if (!blocked)` — unreachable
because the overlap check always blocked first.

**Context-window-aware routing** (commits `c525151`, `5a0ef70`, `207bfdd` and follow-ups):

- New `scoped-edit` task category detected via patterns like "add a field to", "inside the X div"
- `getOllamaRecommendations()` applies context-window bonus: +8pts for ≥256K, +12pts for ≥1M
- Benchmark scoring includes context-window bonus to prevent 128K models from winning categories
- `autoUpdateRouting` guards scoped-edit: rejects 128K winners with a warning
- Missing or stale scoped-edit routes fall back to a ≥256K model even when old env/config values exist
- Quality scores recalibrated: `devstral-small-2:24b` 82→74, `deepseek-v4-flash:cloud` 90→92, `qwen3.5:35b-a3b` 84→88

### Verified

- **CLI**: `deepseek-v4-flash:cloud` (1M context) — 2/2 full successes on test fixture, 1/1 on real `jarvis-agent`
- **CLI**: `devstral-small-2:24b-cloud` (128K) — now produces scoped edits instead of stalling (was 0/1 before fix)
- **Desktop E2E**: Clean completion, no loop abort
- **Test suite**: 3637 tests passing, 5 new regression tests for the deadlock escape

### Recommended Models for Scoped Edits

| Model | Context | Speed | Cost |
|---|---|---|---|
| `qwen3.5:35b-a3b` | 262K | fast | free (local) |
| `deepseek-v4-flash:cloud` | 1M | fast | cloud |
| `qwen3-coder-next` | 262K | balanced | cloud |

## Architecture

At a high level, `nex-code` is organized as an orchestration layer on top of model providers and developer tools.

1. **CLI and session layer**
   Accepts prompts, commands, flags, and session state from the terminal or editor integration.

2. **Agent loop**
   Runs the task through a controlled execution cycle: inspect, plan, act, verify, and retry when needed.

3. **Routing and provider layer**
   Resolves which provider and model should handle the next step, based on configuration, task type, and fallback logic.

4. **Tool execution layer**
   Exposes filesystem, shell, Git, browser, SSH, Docker, Kubernetes, and related capabilities to the agent.

5. **Verification layer**
   Runs tests, evaluates outcomes, and decides whether the task is complete or needs another pass.

In practice, this makes `nex-code` closer to a local orchestration system than a thin wrapper around an LLM API.

## Example Workflow

A typical developer flow with `nex-code` looks like this:

1. Start in a repository and describe the task in plain English.
2. `nex-code` inspects the project structure, relevant files, and surrounding context.
3. It forms a plan or enters a planning phase before editing.
4. It makes the implementation changes with tool access.
5. It runs tests or other verification steps.
6. If verification fails, it loops back, adjusts the implementation, and re-runs checks.
7. When the task is complete, it leaves the repository in a verifiable state rather than stopping at code generation.

Example prompts:

```text
explain why the user creation flow is failing in production
add input validation to the createUser handler and update the tests
refactor this module to async/await and verify the endpoint behavior
review the recent changes and look for regressions before I push
```

## Desktop App E2E Verification

The global Desktop launcher can run reproducible headless Desktop scenarios:

```bash
nex-code-app --e2e \
  --open-project /path/to/project \
  --prompt-file /tmp/prompt.txt \
  --model ollama:deepseek-v4-flash:cloud \
  --timeout-ms 180000 \
  --json \
  --auto-confirm \
  --expect-file src/main.js \
  --expect-contains "expected output"
```

This launches the Electron app with isolated E2E state, opens the project via
the normal Desktop project path, submits the prompt through the renderer command
input, waits for a terminal session state, verifies optional expectations, and
exits non-zero on stalled, error, timeout, or failed expectation results.

See [Desktop Workflow Verification](docs/DESKTOP-WORKFLOW-VERIFICATION.md) for
the full flag reference and JSON result shape.

## Design Philosophy

### CLI-first

The terminal remains the most capable interface for real development work. `nex-code` is designed to operate where developers already inspect code, run tests, check diffs, and manage environments.

### Developer-centric

The product assumes a professional engineering workflow: existing repositories, mixed tooling, imperfect environments, partial context, and the need to verify outcomes. It is meant to assist a developer, not replace the surrounding engineering discipline.

### Real-world workflows

A credible coding assistant must handle more than code generation. It needs to interact with source control, infrastructure, shells, CI-like verification, and operational context. `nex-code` is built around those constraints instead of treating them as edge cases.

## Installation / Getting Started

Quick start:

```bash
npx nex-code
```

Or install globally:

```bash
npm install -g nex-code
nex-code
```

Basic requirements:

- Node.js 18+
- Ollama Cloud key, or a local Ollama setup
- optional premium provider keys for fallback or specialized use

Typical environment configuration:

```env
OLLAMA_API_KEY=your-key
DEFAULT_PROVIDER=ollama
DEFAULT_MODEL=qwen3-coder:480b

# Optional premium fallbacks:
DEEPSEEK_API_KEY=your-key
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
GEMINI_API_KEY=your-key
```

On first launch, `nex-code` guides setup interactively and recommends Ollama Cloud or local Ollama first. Use `/models coding` for cost-aware model recommendations, `/budget` to cap premium spend, and `/fallback` to decide when paid providers may be used.

## Future Direction

The long-term value of `nex-code` is not only broader model support. It is better orchestration.

Likely areas of continued investment include:

- stronger benchmark-based routing across task categories
- deeper editor and automation integrations
- more robust multi-agent coordination for larger changes
- tighter verification loops for tests, diffs, and deployment workflows
- better support for persistent project knowledge and reusable team workflows

The direction is clear: make model-assisted development behave more like a disciplined engineering system and less like an isolated chat interface, while keeping costs controllable.

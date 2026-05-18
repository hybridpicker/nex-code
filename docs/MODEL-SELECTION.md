# Model Selection Strategy

## Architecture

nex-code uses a two-tier model architecture for multi-agent orchestration:

- **Orchestrator**: Decomposes complex prompts into sub-tasks, synthesizes results. Needs strong reasoning, instruction following, and large context window.
- **Worker**: Executes code changes via tool calls. Needs fast, reliable tool calling and coding ability.

## Current Best Models

| Role         | Model                  | Score  | Context | Latency |
| ------------ | ---------------------- | ------ | ------- | ------- |
| Orchestrator | `kimi-k2.5`            | --     | 262K    | 2.8s    |
| Worker       | `devstral-2:123b`      | 84/100 | 131K    | 1.5s    |
| Worker Heavy | `qwen3-coder:480b`     | 79/100 | 131K    | 2.9s    |
| Worker Fast  | `devstral-small-2:24b` | 73/100 | 131K    | 1.0s    |

Run `/bench-orchestrator` to get up-to-date orchestrator scores.
Run `/benchmark` to get up-to-date worker (tool calling) scores.

## How Models Are Selected

### Orchestrator

Priority order:

1. `--orchestrator-model` CLI flag
2. `NEX_ORCHESTRATOR_MODEL` environment variable
3. Default: `kimi-k2.5`

### Workers (sub-agents)

Priority order:

1. Explicit `model` field in agent definition (e.g. `"provider:model"`)
2. `NEX_HEAVY_MODEL` / `NEX_STANDARD_MODEL` / `NEX_FAST_MODEL` env vars (tier-based)
3. Auto-routing via `classifyTask()` + `pickModelForTier()`
4. Active model (fallback)

Task classification:

- **Heavy** (`full` tier): refactor, rewrite, implement, create, architect, design, generate, migrate
- **Fast** (`essential` tier): read, summarize, search, find, list, check, count, inspect, scan
- **Standard**: everything else

## Phase-Based Routing

On Ollama Cloud, nex-code automatically runs each task through plan → implement → verify, each with a different model optimized for that phase:

| Phase         | Budget | Tools           | Default model           | Strength needed            |
| ------------- | ------ | --------------- | ----------------------- | -------------------------- |
| **Plan**      | 10     | read-only       | `qwen3-coder:480b`     | Large context, reasoning   |
| **Implement** | 35     | full            | active model (default)  | Precise tool-calling       |
| **Verify**    | 8      | read + bash     | `devstral-small-2:24b` | Fast test/lint execution   |

### Phase Transitions

- **Plan → Implement**: Triggers when investigation cap fires or model produces a text-only analysis
- **Implement → Verify**: Triggers when model finishes with files modified
- **Verify → Done**: Only after at least one verification tool call and an explicit `PASS`
- **Verify → Implement**: On `FAIL`, loops back to implement once, then completes

### Configuration

Phase routing activates automatically on Ollama Cloud. Override via `~/.nex-code/model-routing.json`:

```json
{
  "phases": {
    "plan": "kimi-k2:1t",
    "implement": "devstral-2:123b",
    "verify": "qwen3-coder-next"
  },
  "phaseBudgets": {
    "plan": 10,
    "implement": 35,
    "verify": 8
  }
}
```

Or via environment:
- `NEX_PHASE_ROUTING=0` — disable phase routing entirely
- `NEX_PHASE_ROUTING=1` — force-enable on non-Ollama providers

## Scoped-Edit Routing

For tasks that target specific file sections (detected via patterns like "add a field to",
"inside the X div", "around line N"), nex-code routes to a dedicated `scoped-edit` category.

### Context-Window Awareness

Scoped-edit tasks on real projects (>50 files, >1000-line templates) require models with
at least 256K context. The router applies two layers of protection:

1. **USE_CASES fallback** (`task-router.js`): When scoped-edit has no route, or the
   env/config route has a 128K model, `getModelForCategory()` automatically falls
   back to `getOllamaRecommendations()` which ranks models by quality score +
   context-window bonus (+8 for ≥256K, +12 for ≥1M).

2. **Benchmark guard** (`benchmark.js`): `autoUpdateRouting()` rejects 128K scoped-edit winners
   with a warning, preventing a synthetic benchmark from routing a small-context model to a
   real-project category it cannot handle.

### Defaults

| Category | Default (no config) | Fallback (env/config has 128K model) |
|---|---|---|
| `scoped-edit` | `qwen3-coder-next` (262K) | `qwen3-coder-next` (262K) |
| `quick-fix` | `qwen3.5:35b-a3b` | `deepseek-v4-flash:cloud` |
| `coding` | `qwen3-coder-next` (262K) | `deepseek-v4-flash:cloud` |

### Quality Score Recalibration (v0.5.33+)

| Model | Old | New | Reason |
|---|---|---|---|
| `devstral-small-2:24b` | 82 | **74** | 128K stalls on >50-file projects |
| `qwen3.5:35b-a3b` | 84 | **88** | 262K context, free local |
| `deepseek-v4-flash:cloud` | 90 | **92** | 1M context, proven 3/3 scoped-edit passes |

## Environment Variables

```bash
# In ~/.nex-code/models.env
NEX_ORCHESTRATOR_MODEL=kimi-k2.5
NEX_HEAVY_MODEL=qwen3-coder:480b
NEX_STANDARD_MODEL=devstral-2:123b
NEX_FAST_MODEL=qwen3.5:35b-a3b
NEX_ROUTE_SCOPED_EDIT=deepseek-v4-flash:cloud
NEX_PHASE_ROUTING=1    # force-enable (auto on Ollama Cloud)
```

## Per-Model Briefings

Each model profile in `cli/model-profiles.js` includes an optional `briefing` field — a short (3-5 sentence) behavioral guide that is prepended to the system prompt. This gives each model targeted guidance before it reads any project context or tool rules.

Briefings are injected at three levels:

1. **Main agent** (`cli/agent.js`): Prepended to `buildSystemPrompt()` output. Cache key includes the active model ID so model switches trigger a prompt rebuild.
2. **Sub-agents** (`cli/sub-agent.js`): Prepended after model resolution, so each sub-agent gets guidance matched to its resolved model.
3. **Orchestrator workers**: Inherit briefing injection from sub-agent.js (orchestrator passes `_systemPrompt` which gets the briefing prepended).

Models without a profile entry receive no briefing (graceful fallback). Token overhead is ~50-80 tokens per call.

## Adding a New Model

1. The model must be available on your configured provider (Ollama, OpenAI, etc.)
2. Run `/benchmark` to test tool-calling quality (worker role)
3. Run `/bench-orchestrator` to test decompose/synthesize quality (orchestrator role)
4. If the model scores > 5% above the current best, `model-watcher.js` will auto-promote it
5. Models matching `/thinking|reasoning|instruct|planner|orchestrat/i` are flagged as orchestrator candidates during discovery

## Benchmark Methodology

### Worker Benchmark (`/benchmark`)

- 56 tasks across 13 categories (file-ops, search, shell, schema, multi-step, frontend, sysadmin, data, agentic, resilience, ssh, git, plus 6 phase-specific tasks)
- Scoring: tool call produced (20%), correct tool (35%), valid args (30%), schema compliance (15%)
- Results saved to `~/.nex-code/known-models.json`

### Orchestrator Benchmark (`/bench-orchestrator`)

- 6 scenarios: 4 decompose tasks + 2 synthesize tasks
- Decompose scoring: correct count (30%), no overlap (20%), JSON validity (15%), scope quality (20%), speed (15%)
- Synthesize scoring: summary quality, conflict detection, commit message, files changed
- Results saved to `~/.nex-code/orchestrator-bench.json`

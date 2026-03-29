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
- **Verify → Done**: On PASS. On FAIL, loops back to implement once, then completes

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

## Environment Variables

```bash
# In ~/.nex-code/models.env
NEX_ORCHESTRATOR_MODEL=kimi-k2.5
NEX_HEAVY_MODEL=qwen3-coder:480b
NEX_STANDARD_MODEL=devstral-2:123b
NEX_FAST_MODEL=devstral-small-2:24b
NEX_PHASE_ROUTING=1    # force-enable (auto on Ollama Cloud)
```

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

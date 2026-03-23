# nex-code Architektur-Upgrade: Multi-Agent Orchestrator + Model Benchmark Loop

## Kontext

nex-code hat bereits `cli/sub-agent.js` (Parallel-Agent-Runner mit File-Locking) und
`cli/model-watcher.js` (Ollama Cloud Model-Discovery). Diese Infrastruktur soll zu einem
vollständigen Multi-Agent-Orchestrator mit automatischem Model-Benchmarking ausgebaut werden.

**Kernproblem das gelöst werden soll:**
Komplexe Multi-Bug-Tasks führen zu Context Collapse weil ein einzelner Agent versucht,
alles in einem Context-Fenster zu lösen. Claude Code löst das mit spezialisierten
Sub-Agents pro Task. nex-code soll dasselbe können.

**Ollama Cloud Modelle verfügbar:**
- `minimax-m2.7:cloud` — SWE-Pro, Complex Reasoning → Orchestrator-Kandidat
- `kimi-k2.5` — Reasoning, Tool-Use, 262k Context → Orchestrator-Kandidat
- `qwen3.5:397b` — General, Instruction-Following → Orchestrator-Kandidat
- `devstral-2:123b` — Code Execution, File Editing → Worker-Agent (bleibt)

---

## Task 1: Multi-Agent Orchestrator (`cli/orchestrator.js`)

Erstelle `cli/orchestrator.js` als neues Modul. Schaue dir zuerst `cli/sub-agent.js`
vollständig an — baue darauf auf, nicht daran vorbei.

### Orchestrator-Flow

```
User Prompt (komplex, multi-bug)
    ↓
orchestrator.decompose(prompt, model=ORCHESTRATOR_MODEL)
→ LLM-Call (1×): "Zerlege diesen Task in max. 4 atomare Sub-Tasks.
                  Jeder Sub-Task muss in <15 SSH-Calls lösbar sein.
                  Output: JSON Array [{task, scope, files}]"
    ↓
Für jeden Sub-Task: spawn sub-agent (aus sub-agent.js) mit:
  - eigenem frischen Context
  - Worker-Model (devstral-2:123b)
  - max_iterations: 15
  - scope: nur die relevanten Dateien/Pfade
    ↓
Agents laufen parallel (max 3 gleichzeitig — SSH-Limit)
    ↓
orchestrator.synthesize(results, model=ORCHESTRATOR_MODEL)
→ LLM-Call (1×): "Merge diese Sub-Agent-Ergebnisse. Löse Konflikte.
                  Erstelle einen finalen Commit-Plan."
    ↓
Ein sauberer Commit mit allen Fixes
```

### Technische Anforderungen

**`orchestrator.js` API:**
```js
// Haupteinstiegspunkt
async function runOrchestrated(prompt, opts = {})
  // opts.orchestratorModel: 'minimax-m2.7:cloud' | 'kimi-k2.5' | 'qwen3.5:397b'
  // opts.workerModel: default 'devstral-2:123b'
  // opts.maxParallel: default 3
  // opts.maxSubTasks: default 4
  // Returns: { results, commit, score }

// Task-Zerlegung
async function decompose(prompt, model)
  // Returns: Array<{ id, task, scope, estimatedSshCalls, priority }>

// Ergebnis-Synthese
async function synthesize(subTaskResults, originalPrompt, model)
  // Returns: { summary, conflicts, commitMessage, filesChanged }
```

**Trigger-Logik in `cli/agent.js`:**
- Wenn der User-Prompt >3 verschiedene Bugs/Ziele enthält → automatisch Orchestrator vorschlagen
- Explizit via Flag: `nex-code --orchestrate "..."` oder `/orchestrate` Slash-Command
- Orchestrator-Model via `NEX_ORCHESTRATOR_MODEL` env var oder `--orchestrator-model` Flag

**Parallel-Limit:**
- Max 3 Sub-Agents gleichzeitig (SSH-Sessions auf Server)
- Sub-Agents teilen sich den SSH-Storm-Counter NICHT (jeder hat eigenen)
- File-Locking aus sub-agent.js verwenden um Schreib-Konflikte zu verhindern

---

## Task 2: Orchestrator-Model Benchmark (`cli/orchestrator-bench.js`)

Erstelle `cli/orchestrator-bench.js`. Schaue dir zuerst `cli/benchmark.js` vollständig
an — erweitere es, ersetze es nicht.

### Benchmark-Szenarien für Orchestrator-Modelle

Teste wie gut ein Modell Tasks zerlegt (nicht wie gut es Code schreibt):

```js
const ORCHESTRATOR_SCENARIOS = [
  {
    id: 'decompose_multi_bug',
    prompt: 'Fix 4 bugs: (1) 500 error SmartThings, (2) invalid time format Sunday, (3) Google Auth failed, (4) contact not found',
    expectedSubTasks: 4,
    maxSubTasks: 5,
    scoreDecompose: (result) => {
      // Korrekte Anzahl Sub-Tasks? +3
      // Keine Überlappungen? +2
      // Scope korrekt abgegrenzt? +2
      // JSON valide? +1
    }
  },
  {
    id: 'decompose_feature',
    prompt: 'Add dark mode, fix login bug, improve performance of search, update docs',
    expectedSubTasks: 4,
  },
  {
    id: 'synthesize_conflicts',
    // Zwei Sub-Agents haben dieselbe Datei unterschiedlich geändert
    // Orchestrator soll Konflikt erkennen und lösen
    subResults: [/* fixture */],
  }
];
```

### Model-Benchmark-Runner

```bash
# Manuell starten
nex-code --bench-orchestrator

# Output:
# ┌─────────────────────────┬──────────┬──────────┬──────────┬─────────┐
# │ Model                   │ Decompose│ Synthesize│ Speed   │ Score   │
# ├─────────────────────────┼──────────┼──────────┼──────────┼─────────┤
# │ minimax-m2.7:cloud      │  9.2/10  │  8.8/10  │  2.1s   │  9.0/10 │
# │ kimi-k2.5               │  8.7/10  │  8.5/10  │  3.4s   │  8.6/10 │
# │ qwen3.5:397b            │  7.8/10  │  7.2/10  │  1.8s   │  7.5/10 │
# └─────────────────────────┴──────────┴──────────┴──────────┴─────────┘
# → Best orchestrator: minimax-m2.7:cloud (9.0/10)
# → Saved to ~/.nex-code/orchestrator-bench.json
```

---

## Task 3: Automatisches Model-Discovery & Benchmark-Loop

Erweitere `cli/model-watcher.js` um Orchestrator-Benchmark-Integration.

### Neues Modell erkannt → automatisch benchmarken

```
model-watcher.checkForNewModels()
→ Findet: 'new-model-x:70b' (nicht in known-models.json)
→ Prüft: Reasoning-Modell? (name enthält 'thinking'/'reasoning'/'instruct')
→ Ja → füge zu orchestrator-bench Queue
→ Führt orchestrator-bench für neues Modell aus
→ Vergleicht Score mit aktuellem Best-Orchestrator
→ Wenn Score > aktuell + 5%: Update NEX_ORCHESTRATOR_MODEL default
→ Commit: "chore: promote {model} to default orchestrator ({score}/10)"
→ Update docs/MODEL-SELECTION.md
```

### Wann läuft der Discovery-Check?
- Bei jedem `nex-code` Start (einmal täglich, gecacht in `known-models.json`)
- Via `/bench-models` Slash-Command manuell
- Via `nex-code --check-models` Flag

---

## Task 4: Dokumentation (`docs/MODEL-SELECTION.md`)

Erstelle `docs/MODEL-SELECTION.md` mit:

```markdown
# Model Selection Strategy

## Architecture
- **Orchestrator**: Zerlegt Tasks, synthetisiert Ergebnisse — braucht Reasoning
- **Worker**: Führt Code-Änderungen aus — braucht Coding-Fähigkeit

## Current Best Models (auto-updated by benchmark)
| Role        | Model              | Score  | Last Benchmarked |
|-------------|-------------------|--------|-----------------|
| Orchestrator| minimax-m2.7:cloud | 9.0/10 | 2026-03-23      |
| Worker      | devstral-2:123b    | 7.8/10 | 2026-03-23      |

## How Models Are Selected
[automatisch generiert aus benchmark history]

## Adding a New Model
[Anleitung für Contributors]
```

Auch `docs/IMPROVEMENT-JOURNEY.md` updaten mit diesem Architektur-Upgrade.

---

## Task 5: CI (`ci/orchestrator.yml` + Tests)

### GitHub Actions Workflow (`.github/workflows/orchestrator.yml`)

```yaml
name: Orchestrator Tests
on: [push, pull_request]
jobs:
  test-orchestrator:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:orchestrator
      # Kein echter LLM-Call in CI — Mock-Provider
```

### Tests (`tests/orchestrator.test.js`)

```js
// Mock-Provider der decompose/synthesize simuliert
describe('Orchestrator', () => {
  test('decompose: returns max maxSubTasks items', async () => { ... })
  test('decompose: each sub-task has required fields', async () => { ... })
  test('decompose: no overlapping scopes', async () => { ... })
  test('parallel limit: max 3 agents run simultaneously', async () => { ... })
  test('synthesize: detects file conflicts', async () => { ... })
  test('synthesize: produces valid commit message', async () => { ... })
  test('file locking: two agents on same file → second waits', async () => { ... })
})

describe('OrchestratorBench', () => {
  test('scores decompose quality correctly', async () => { ... })
  test('saves results to ~/.nex-code/orchestrator-bench.json', async () => { ... })
})

describe('ModelWatcher', () => {
  test('detects new models not in known-models.json', async () => { ... })
  test('does not re-benchmark already known models', async () => { ... })
  test('promotes model when score > current + 5%', async () => { ... })
})
```

### Bestehende CI nicht brechen

- `npm test` muss weiterhin grün sein
- `npm run build` (esbuild bundle) muss funktionieren
- Neues `npm run test:orchestrator` für die neuen Tests

---

## Reihenfolge der Implementierung

1. `cli/orchestrator.js` — Kern-Modul (decompose + synthesize)
2. `tests/orchestrator.test.js` — Tests schreiben (TDD)
3. Integration in `cli/agent.js` — `--orchestrate` Flag + Auto-Trigger
4. `cli/orchestrator-bench.js` — Benchmark-Runner
5. `cli/model-watcher.js` — Discovery-Loop erweitern
6. `docs/MODEL-SELECTION.md` — Dokumentation
7. `.github/workflows/orchestrator.yml` — CI
8. `docs/IMPROVEMENT-JOURNEY.md` — Update

## Wichtige Constraints

- **NIEMALS** `git add -A` — nur `modules/ cli/ tests/ docs/ .github/` stagen
- **Kein Breaking Change** an bestehender `sub-agent.js` API
- `model-watcher.js` erweitern, nicht ersetzen
- Orchestrator ist **opt-in** — default bleibt single-agent für einfache Tasks
- Alle neuen LLM-Calls in Tests durch Mock-Provider ersetzen (kein echter API-Call in CI)
- Version bumpen via `npm version patch` nach erfolgreichem Commit

## Definition of Done

- [ ] `npm test` grün (inkl. neue orchestrator tests)
- [ ] `npm run build` erfolgreich
- [ ] `nex-code --orchestrate "fix 3 bugs: ..."` startet Orchestrator-Flow
- [ ] `/bench-orchestrator` zeigt Modell-Vergleichstabelle
- [ ] `docs/MODEL-SELECTION.md` existiert und ist korrekt befüllt
- [ ] CI workflow läuft durch auf GitHub
- [ ] `docs/IMPROVEMENT-JOURNEY.md` dokumentiert das Upgrade

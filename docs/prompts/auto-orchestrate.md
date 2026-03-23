# nex-code v0.3.79 — Auto-Orchestrate

## Kontext

In v0.3.78 wurde der Multi-Agent Orchestrator implementiert. Er funktioniert nur via
explizitem `--orchestrate` Flag oder `/orchestrate` Slash-Command. Der nächste Schritt
ist Auto-Orchestration: wenn der Prompt komplex genug ist, startet der Orchestrator
automatisch — ohne dass der User explizit opt-in muss.

Relevante Dateien:

- `cli/agent.js` — Zeile ~1476: bereits `detectComplexPrompt()` Hint eingebaut
- `cli/orchestrator.js` — `detectComplexPrompt()`, `runOrchestrated()`
- `bin/nex-code.js` — `--orchestrate` und `--orchestrator-model` Flags bereits vorhanden

## Task: Auto-Orchestrate implementieren

### 1. `--auto-orchestrate` Flag in `bin/nex-code.js`

Füge Flag hinzu:

```
--auto-orchestrate    Automatically use orchestrator when ≥3 goals detected
                      (default: false, opt-in)
```

Auch als env var: `NEX_AUTO_ORCHESTRATE=true`

### 2. Auto-Trigger Logik in `cli/agent.js`

Ersetze den bestehenden Hint (Zeile ~1476-1483) durch echte Auto-Trigger-Logik:

```js
// Auto-orchestrate wenn Flag gesetzt und Prompt komplex
if (opts.autoOrchestrate || process.env.NEX_AUTO_ORCHESTRATE === "true") {
  const { detectComplexPrompt, runOrchestrated } = require("./orchestrator");
  const complexity = detectComplexPrompt(userInput);

  if (complexity.isComplex && complexity.estimatedGoals >= 3) {
    console.log(
      `${C.yellow}⚡ Auto-orchestrate: ${complexity.estimatedGoals} goals detected — using parallel agents${C.reset}`,
    );
    const result = await runOrchestrated(userInput, {
      orchestratorModel:
        opts.orchestratorModel || process.env.NEX_ORCHESTRATOR_MODEL,
      workerModel: opts.model,
    });
    return result;
  }
}

// Hint für User ohne --auto-orchestrate
const { detectComplexPrompt } = require("./orchestrator");
const complexity = detectComplexPrompt(userInput);
if (complexity.isComplex) {
  console.log(
    `${C.dim}Hint: ~${complexity.estimatedGoals} goals detected. Use --auto-orchestrate or /orchestrate for parallel execution.${C.reset}`,
  );
}
```

### 3. Threshold konfigurierbar machen

In `cli/orchestrator.js`, `detectComplexPrompt()`:

- Aktueller Threshold: hardcoded
- Neu: `NEX_ORCHESTRATE_THRESHOLD=3` env var (default: 3)
- Werte: 2 = aggressiv, 3 = balanced (default), 4 = konservativ

### 4. Session-Scorer Update (`cli/session-scorer.js`)

Neue Regel: wenn Auto-Orchestrate gefeuert hat und Score des Orchestrators >7 → +0.5 Bonus.
Wenn Auto-Orchestrate gefeuert aber Single-Agent wäre besser gewesen → -0.25.

### 5. Tests (`tests/orchestrator.test.js` erweitern)

```js
describe('Auto-Orchestrate', () => {
  test('triggers when estimatedGoals >= 3 and flag set', async () => { ... })
  test('does NOT trigger when estimatedGoals < 3', async () => { ... })
  test('does NOT trigger without --auto-orchestrate flag', async () => { ... })
  test('respects NEX_ORCHESTRATE_THRESHOLD env var', async () => { ... })
  test('shows hint when complex but flag not set', async () => { ... })
})
```

### 6. Docs updaten

- `docs/MODEL-SELECTION.md`: Auto-Orchestrate Sektion hinzufügen
- `docs/IMPROVEMENT-JOURNEY.md`: v0.3.79 Entry

## Reihenfolge

1. `bin/nex-code.js` — Flag + env var
2. `cli/orchestrator.js` — Threshold konfigurierbar
3. `cli/agent.js` — Auto-Trigger ersetzen
4. `cli/session-scorer.js` — Neue Regel
5. `tests/orchestrator.test.js` — Tests
6. Docs

## Definition of Done

- [ ] `npm test` grün
- [ ] `nex-code --auto-orchestrate "fix 3 bugs: ..."` startet Orchestrator automatisch
- [ ] `nex-code "fix 3 bugs: ..."` (ohne Flag) zeigt nur Hint
- [ ] `NEX_AUTO_ORCHESTRATE=true nex-code "..."` funktioniert auch
- [ ] `NEX_ORCHESTRATE_THRESHOLD=2` funktioniert
- [ ] CI grün auf devel

# nex-code v0.3.79 — Orchestrator Worker Fixes

## Kontext

Der Multi-Agent Orchestrator (v0.3.78) läuft. Erster Smoke-Test ergab:

- ✅ Decompose/Synthesize funktioniert
- ✅ 3 Parallel-Agents in 28s
- ⚠ Worker-Agent 2: versuchte `aspell` (EXIT 127) statt read_file + manuelle Analyse
- ⚠ Worker-Agent 3: hat gesucht aber nicht geschrieben — zu passiv
- ⚠ Token-Tracking: 0 input + 0 output (Bug)

## Task 1: Worker System-Prompt härten (`cli/orchestrator.js`)

In `runOrchestrated()` wird für jeden Sub-Agent ein System-Prompt gebaut. Erweitere ihn:

```js
const WORKER_SYSTEM_PROMPT = `
You are a focused coding agent executing ONE specific sub-task.
Your scope is limited to the files listed in your task definition.

RULES:
- NEVER use external CLI tools for analysis (aspell, jq, sed, awk, grep for reading).
  Use read_file + your own reasoning instead.
- Be PROACTIVE: if something is missing, ADD it. Do not just search and report.
- If your task says "fix typos" — read the file, find typos yourself, edit them.
- If your task says "add X to README" — add it, don't check if it exists first.
- Max 10 tool calls. If you need more, you are doing too much — narrow your scope.
- When done: call {"valid": true} to signal completion.
`;
```

## Task 2: Token-Tracking für Sub-Agent Sessions fixen (`cli/orchestrator.js`)

Nach `runOrchestrated()`: Tokens werden mit 0/0 geloggt.
Finde wo `trackUsage()` oder Token-Counting aufgerufen wird in `sub-agent.js` und
stelle sicher dass Orchestrator-Sessions die Tokens korrekt akkumulieren.

Suche in `cli/sub-agent.js` und `cli/costs.js` wie Token-Tracking funktioniert,
dann in `cli/orchestrator.js` den gleichen Mechanismus verwenden.

## Task 3: Synthesizer verbessern (`cli/orchestrator.js`)

Aktuell zeigt der Synthesizer `⚠` für alle Agents auch wenn Agent 1 erfolgreich war.
Das ist verwirrend. Fix:

```js
// Statt alle mit ⚠ markieren:
// ✓ grün = erfolgreich
// ⚠ gelb = partial (etwas gemacht aber nicht alles)
// ✗ rot = komplett fehlgeschlagen (EXIT != 0, nichts geändert)

// Im Output:
//   ✓ Agent 1 [devstral-2:123b]: Add JSDoc... (3 functions documented)
//   ✗ Agent 2 [devstral-2:123b]: Fix typos... (aspell not found — use read_file)
//   ⚠ Agent 3 [devstral-2:123b]: Add env var to README... (searched, no changes made)
```

## Task 4: Auto-Orchestrate Flag (`bin/nex-code.js` + `cli/agent.js`)

Das ist der eigentliche nächste Feature-Step. Implementiere:

**`bin/nex-code.js`:**

```
--auto-orchestrate    Automatically use orchestrator when ≥N goals detected
```

Auch: `NEX_AUTO_ORCHESTRATE=true` env var.

**`cli/agent.js`** — ersetze den Hint (Zeile ~1476) durch echten Auto-Trigger:

```js
const autoOrch =
  opts.autoOrchestrate || process.env.NEX_AUTO_ORCHESTRATE === "true";
const threshold = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);

const { detectComplexPrompt } = require("./orchestrator");
const complexity = detectComplexPrompt(userInput);

if (
  autoOrch &&
  complexity.isComplex &&
  complexity.estimatedGoals >= threshold
) {
  console.log(
    `${C.yellow}⚡ Auto-orchestrate: ${complexity.estimatedGoals} goals → parallel agents${C.reset}`,
  );
  return runOrchestrated(userInput, {
    orchestratorModel: opts.orchestratorModel,
    workerModel: opts.model,
  });
}
if (complexity.isComplex) {
  console.log(
    `${C.dim}Hint: ~${complexity.estimatedGoals} goals. Use --auto-orchestrate or /orchestrate.${C.reset}`,
  );
}
```

**`cli/orchestrator.js`** — `detectComplexPrompt()` Threshold konfigurierbar:

```js
const threshold = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);
```

## Task 5: Tests erweitern (`tests/orchestrator.test.js`)

```js
describe('Worker behavior', () => {
  test('worker system prompt contains no-external-tools rule', () => {
    const prompt = buildWorkerSystemPrompt();
    expect(prompt).toContain('NEVER use external CLI tools');
  });
  test('worker system prompt contains proactive rule', () => {
    expect(buildWorkerSystemPrompt()).toContain('Be PROACTIVE');
  });
});

describe('Token tracking', () => {
  test('runOrchestrated returns non-zero token counts', async () => {
    // Mock sub-agents that return token usage
    const result = await runOrchestrated('fix 3 things', { mock: true });
    expect(result.tokens.input).toBeGreaterThan(0);
  });
});

describe('Auto-Orchestrate', () => {
  test('triggers when estimatedGoals >= threshold and flag set', () => { ... });
  test('does NOT trigger without flag', () => { ... });
  test('respects NEX_ORCHESTRATE_THRESHOLD=2', () => { ... });
});
```

## Reihenfolge

1. Worker System-Prompt (Task 1) — sofort messbare Verbesserung
2. Token-Tracking Fix (Task 2)
3. Synthesizer Output Fix (Task 3)
4. Auto-Orchestrate Flag (Task 4) — wichtigstes Feature
5. Tests (Task 5)
6. Version bump + commit auf devel + push

## Definition of Done

- [ ] `npm test` grün
- [ ] Smoke-Test: Agent 2 verwendet nicht mehr `aspell`
- [ ] Token-Output zeigt echte Zahlen statt 0/0
- [ ] `--auto-orchestrate` Flag funktioniert
- [ ] `NEX_AUTO_ORCHESTRATE=true` funktioniert
- [ ] CI grün auf devel

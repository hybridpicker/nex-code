# nex-code v0.3.80 — Debug Mode + Auto-Orchestrate

## Task 1: Debug-Mode für interne Warnungen (PRIORITÄT)

Aktuell werden interne System-Meldungen immer ausgegeben und machen den Output unlesbar:

```
⚠ Super-nuclear compression — dropped all history, keeping original task only (179 tokens freed)
⚠ Loop warning: "cli/orchestrator.js" edited 2× — possible edit loop
✖ Blocked file-scroll: "cli/orchestrator.js" — 5 sections already read
⚠ SSH storm warning: 8 consecutive ssh_exec calls — blocking further SSH
[force-compressed — ~253 tokens freed]
[dual-block deadlock: SSH storm relaxed — allowing 1 SSH call (relax 1/1)]
⚠ Bad request (400) — force-compressing and retrying... (attempt 1/3)
⚠ Jarvis-local guard: blocking local bash
BLOCKED: read_file("cli/orchestrator.js") denied — file already in context
```

**Ziel:** Diese Meldungen nur bei `--debug` oder `NEX_DEBUG=true` anzeigen.
Normaler Output soll nur Fortschritt und Ergebnisse zeigen.

### Implementierung

**`cli/ui.js` oder neues `cli/debug.js`** — zentrales Debug-Flag:

```js
const DEBUG =
  process.env.NEX_DEBUG === "true" || process.argv.includes("--debug");

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

function warnLog(...args) {
  if (DEBUG) console.warn(...args);
}

module.exports = { DEBUG, debugLog, warnLog };
```

**Alle Stellen im Code suchen und ersetzen** wo folgende Patterns vorkommen:

- `console.log(` + Text enthält: `compression`, `BLOCKED`, `storm`, `deadlock`, `force-compress`, `nuclear`, `Loop warning`, `Scroll warning`, `guard`, `⚠`, `✖`
- `process.stdout.write(` für interne Status-Messages

Relevante Dateien (suche mit grep):

```bash
grep -rn "Super-nuclear\|force-compress\|SSH storm\|deadlock\|Loop warning\|Scroll warning\|BLOCKED\|Jarvis-local guard" cli/ --include="*.js" -l
```

**Was NICHT versteckt werden soll** (immer sichtbar):

- Tool-Calls und ihre Ergebnisse (✓/✗)
- Phase-Header (◆ Phase 1 · ...)
- Session Score am Ende
- Finale Zusammenfassung
- Echte Fehler die den User betreffen (z.B. "API Key nicht gesetzt")
- Hint-Messages (z.B. "~3 goals detected. Use --auto-orchestrate")

**`bin/nex-code.js`** — Flag hinzufügen:

```
--debug    Show internal diagnostic messages (compression, loop detection, guards)
```

### Tests (`tests/debug-mode.test.js`)

```js
describe('Debug Mode', () => {
  test('⚠ warnings are hidden by default', () => {
    // Spawn nex-code ohne --debug, prüfe stdout/stderr hat keine ⚠ system messages
  });
  test('⚠ warnings appear with --debug flag', () => {
    // Spawn nex-code mit --debug, prüfe dass Warnungen sichtbar sind
  });
  test('NEX_DEBUG=true shows warnings', () => { ... });
});
```

---

## Task 2: Auto-Orchestrate Flag

**`bin/nex-code.js`** — Flag hinzufügen:

```
--auto-orchestrate    Automatically use orchestrator when ≥3 goals detected
```

Auch: `NEX_AUTO_ORCHESTRATE=true` env var.

**`cli/agent.js`** — Zeile ~1476, ersetze den bestehenden Hint-Block:

```js
const autoOrch =
  opts.autoOrchestrate || process.env.NEX_AUTO_ORCHESTRATE === "true";
const threshold = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);

try {
  const { detectComplexPrompt, runOrchestrated } = require("./orchestrator");
  const complexity = detectComplexPrompt(
    typeof userInput === "string" ? userInput : "",
  );

  if (
    autoOrch &&
    complexity.isComplex &&
    complexity.estimatedGoals >= threshold
  ) {
    console.log(
      `${C.yellow}⚡ Auto-orchestrate: ${complexity.estimatedGoals} goals → parallel agents${C.reset}`,
    );
    return await runOrchestrated(userInput, {
      orchestratorModel:
        opts.orchestratorModel || process.env.NEX_ORCHESTRATOR_MODEL,
      workerModel: opts.model,
    });
  }

  if (complexity.isComplex) {
    console.log(
      `${C.dim}Hint: ~${complexity.estimatedGoals} goals. Try --auto-orchestrate for parallel execution.${C.reset}`,
    );
  }
} catch {
  /* orchestrator not available */
}
```

**`cli/orchestrator.js`** — Threshold konfigurierbar:

```js
// In detectComplexPrompt():
const threshold = parseInt(process.env.NEX_ORCHESTRATE_THRESHOLD || "3", 10);
if (goalCount >= threshold) {
  isComplex = true;
}
```

### Tests

```js
describe('Auto-Orchestrate', () => {
  test('triggers when goals >= threshold and --auto-orchestrate set', () => { ... });
  test('shows hint without flag', () => { ... });
  test('respects NEX_ORCHESTRATE_THRESHOLD=2', () => { ... });
  test('NEX_AUTO_ORCHESTRATE=true works', () => { ... });
});
```

---

## Reihenfolge

1. `cli/debug.js` erstellen (debugLog/warnLog)
2. Alle ⚠/BLOCKED Messages in cli/ auf debugLog umstellen
3. `bin/nex-code.js` — `--debug` Flag
4. `tests/debug-mode.test.js`
5. `bin/nex-code.js` — `--auto-orchestrate` Flag
6. `cli/agent.js` — Auto-Trigger
7. `cli/orchestrator.js` — Threshold konfigurierbar
8. Tests erweitern
9. Version bump + commit devel

## Definition of Done

- [ ] `npm test` grün
- [ ] Normaler Output: keine ⚠/BLOCKED/compression Messages sichtbar
- [ ] `--debug` zeigt alle internen Meldungen
- [ ] `--auto-orchestrate "fix 3 bugs: ..."` startet Orchestrator automatisch
- [ ] `NEX_AUTO_ORCHESTRATE=true` funktioniert
- [ ] CI grün

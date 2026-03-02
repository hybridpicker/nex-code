# TODO & FIXME Übersicht

**Projekt:** nex-code  
**Generiert:** Auto-generiert aus Code-Analyse  
**Enthält:** TODO/FIXME-Kommentare, technische Schulden, Refactoring-Vorschläge

---

## 🔴 Kritisch (Sofortige Aufmerksamkeit erforderlich)

| Datei | Zeile | Beschreibung | Priorität |
|-------|-------|--------------|-----------|
| *Keine kritischen TODOs gefunden* | - | - | - |

---

## 🟡 Mittel (Geplante Verbesserungen)

| Datei | Zeile | Beschreibung | Priorität |
|-------|-------|--------------|-----------|
| `cli/sub-agent.js` | 34 | Kommentar: "Tools that sub-agents should NOT have access to" – Berechtigungskonzept prüfen | Mittel |
| `cli/tools.js` | 209 | Kommentar: "Sensitive paths that should never be accessed by file tools" – Sicherheitsprüfung | Mittel |

---

## 🟢 Niedrig (Code-Qualität & Dokumentation)

| Datei | Zeile | Beschreibung | Priorität |
|-------|-------|--------------|-----------|
| `cli/providers/base.js` | 28, 72, 83, 112 | Abstrakte Methoden (Design-Pattern, keine echten TODOs) | Niedrig |

---

## 📊 Große Dateien (>500 Zeilen) – Refactoring-Vorschläge

Die folgenden Dateien überschreiten 500 Zeilen und sollten refactored werden:

| Datei | Zeilen | Komplexität | Refactoring-Vorschlag |
|-------|--------|-------------|----------------------|
| `tests/index.test.js` | 1,544 | 🔴 Hoch | **Modularisierung:** In separate Test-Dateien pro Feature aufteilen (z.B. `commands.test.js`, `providers.test.js`, `sessions.test.js`) |
| `cli/index.js` | 1,281 | 🔴 Hoch | **Command-Pattern:** Slash-Commands in einzelne Handler-Module auslagern (`cli/commands/*.js`) |
| `cli/tools.js` | 1,038 | 🔴 Hoch | **Tool-Registry:** Tools in einzelne Dateien pro Kategorie aufteilen (`cli/tools/file-tools.js`, `cli/tools/git-tools.js`, etc.) |
| `tests/tools.test.js` | 829 | 🟡 Mittel | **Test-Suites:** Nach Tool-Kategorien gruppieren, Fixtures extrahieren |
| `tests/skills.test.js` | 776 | 🟡 Mittel | **Test-Struktur:** Skill-spezifische Tests in Unterverzeichnis |
| `cli/agent.js` | 706 | 🟡 Mittel | **State-Machine:** Agent-Loop in Phasen/States aufteilen, Event-Handler extrahieren |
| `tests/render.test.js` | 648 | 🟡 Mittel | **Snapshot-Tests:** Rendering-Tests mit Snapshots vereinfachen |
| `cli/ui.js` | 554 | 🟢 Niedrig | **UI-Komponenten:** Spinner, Progress, Formatting in separate Module |
| `tests/error-messages.test.js` | 549 | 🟢 Niedrig | **Test-Daten:** Error-Cases in JSON-Dateien auslagern |

---

## 🎯 Empfohlene Refactoring-Priorität

### Phase 1: CLI-Architektur (Hoher Impact)
1. **`cli/index.js`** → Command-Router + Handler-Module
2. **`cli/tools.js`** → Tool-Registry mit dynamischem Loading
3. **`cli/agent.js`** → State-Machine Pattern

### Phase 2: Test-Suite (Mittlerer Impact)
4. **`tests/index.test.js`** → Feature-basierte Aufteilung
5. **`tests/tools.test.js`** → Kategorie-basierte Organisation

### Phase 3: UI & Utilities (Niedriger Impact)
6. **`cli/ui.js`** → Komponenten-basierte Struktur
7. **Kleine Test-Dateien** → Daten-Extraktion

---

## 📝 Statistik

| Kategorie | Anzahl |
|-----------|--------|
| Kritische TODOs | 0 |
| Mittlere TODOs | 2 |
| Niedrige TODOs | 4 (Design-Patterns) |
| Dateien >500 Zeilen | 9 |
| Dateien >1000 Zeilen | 3 |

---

## 💡 Hinweise

- **TODO/FIXME Kommentare:** Das Projekt verwendet überwiegend sauberen Code ohne explizite TODO-Kommentare. Stattdessen werden Issues wahrscheinlich im Issue-Tracker verwaltet.
- **Abstrakte Methoden:** Die `not implemented` Fehler in `cli/providers/base.js` sind beabsichtigt – sie definieren das Interface für Provider-Implementierungen.
- **Große Dateien:** Die Hauptkomplexität liegt in der CLI-Interaktion und dem Test-Coverage, was für ein Tool dieser Größe erwartbar ist.

---

*Letzte Aktualisierung: Automatisch generiert*

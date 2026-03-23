# TODO & FIXME Overview

**Project:** nex-code
**Generated:** Auto-generated from code analysis
**Contains:** TODO/FIXME comments, technical debt, refactoring suggestions

---

## 🔴 Critical (Immediate attention required)

| File                      | Line | Description | Priority |
| ------------------------- | ---- | ----------- | -------- |
| _No critical TODOs found_ | -    | -           | -        |

---

## 🟡 Medium (Planned improvements)

| File               | Line | Description                                                                              | Priority |
| ------------------ | ---- | ---------------------------------------------------------------------------------------- | -------- |
| `cli/sub-agent.js` | 34   | Comment: "Tools that sub-agents should NOT have access to" — review permission concept   | Medium   |
| `cli/tools.js`     | 209  | Comment: "Sensitive paths that should never be accessed by file tools" — security review | Medium   |

---

## 🟢 Low (Code quality & documentation)

| File                    | Line            | Description                                       | Priority |
| ----------------------- | --------------- | ------------------------------------------------- | -------- |
| `cli/providers/base.js` | 28, 72, 83, 112 | Abstract methods (design pattern, not real TODOs) | Low      |

---

## 📊 Large Files (>500 lines) — Refactoring suggestions

The following files exceed 500 lines and should be refactored:

| File                           | Lines | Complexity | Refactoring suggestion                                                                                                            |
| ------------------------------ | ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `tests/index.test.js`          | 1,544 | 🔴 High    | **Modularization:** Split into separate test files per feature (e.g. `commands.test.js`, `providers.test.js`, `sessions.test.js`) |
| `cli/index.js`                 | 1,281 | 🔴 High    | **Command pattern:** Extract slash commands into individual handler modules (`cli/commands/*.js`)                                 |
| `cli/tools.js`                 | 1,038 | 🔴 High    | **Tool registry:** Split tools into individual files per category (`cli/tools/file-tools.js`, `cli/tools/git-tools.js`, etc.)     |
| `tests/tools.test.js`          | 829   | 🟡 Medium  | **Test suites:** Group by tool category, extract fixtures                                                                         |
| `tests/skills.test.js`         | 776   | 🟡 Medium  | **Test structure:** Move skill-specific tests into subdirectory                                                                   |
| `cli/agent.js`                 | 706   | 🟡 Medium  | **State machine:** Split agent loop into phases/states, extract event handlers                                                    |
| `tests/render.test.js`         | 648   | 🟡 Medium  | **Snapshot tests:** Simplify rendering tests with snapshots                                                                       |
| `cli/ui.js`                    | 554   | 🟢 Low     | **UI components:** Split spinner, progress, formatting into separate modules                                                      |
| `tests/error-messages.test.js` | 549   | 🟢 Low     | **Test data:** Extract error cases into JSON files                                                                                |

---

## 🎯 Recommended Refactoring Priority

### Phase 1: CLI Architecture (High impact)

1. **`cli/index.js`** → Command router + handler modules
2. **`cli/tools.js`** → Tool registry with dynamic loading
3. **`cli/agent.js`** → State machine pattern

### Phase 2: Test Suite (Medium impact)

4. **`tests/index.test.js`** → Feature-based split
5. **`tests/tools.test.js`** → Category-based organization

### Phase 3: UI & Utilities (Low impact)

6. **`cli/ui.js`** → Component-based structure
7. **Small test files** → Data extraction

---

## 📝 Statistics

| Category          | Count               |
| ----------------- | ------------------- |
| Critical TODOs    | 0                   |
| Medium TODOs      | 2                   |
| Low TODOs         | 4 (design patterns) |
| Files >500 lines  | 9                   |
| Files >1000 lines | 3                   |

---

## 💡 Notes

- **TODO/FIXME comments:** The project mostly uses clean code without explicit TODO comments. Issues are likely tracked in the issue tracker instead.
- **Abstract methods:** The `not implemented` errors in `cli/providers/base.js` are intentional — they define the interface for provider implementations.
- **Large files:** The main complexity lies in the CLI interaction and test coverage, which is expected for a tool of this size.

---

_Last updated: Auto-generated_

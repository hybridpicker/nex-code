# Refactoring Skill
<!-- trigger: refactor, rewrite, restructure, clean up, cleanup -->
<!-- trigger: simplify, extract function, extract method, extract class -->
<!-- trigger: rename, move to, split into, consolidate, modernize -->

## Instructions

When activated for refactoring, follow this tool sequence:

1. **Map all usages first** — never change a signature without finding callers:
   - `grep(<function_name>, "src/")` to find all call sites
   - `grep(<class_name>, "src/")` for class references
   - `grep("import.*<module>", "src/")` for import statements

2. **Understand the current structure**:
   - `read_file` the core file being refactored
   - `read_file` 2-3 representative callers (not all of them yet)
   - For large refactors, use `task_list` to track sub-tasks

3. **Make the core change**:
   - Edit the primary file first with `edit_file` or `write_file`
   - Keep the change minimal — one concern per edit
   - Verify the core change compiles: `bash("npx tsc --noEmit")` or similar

4. **Update callers** (parallel where possible):
   - For each caller: `read_file` (targeted lines) → `edit_file` → next
   - Batch independent edits into a single turn
   - For many callers (>3), consider `spawn_agents` for parallel updates

5. **Verify completeness**:
   - `grep(<old_name>)` to check no stale references remain
   - `bash("npm test")` to run the full suite
   - `git_diff` to review the full change set

## Safety rules

- **Never refactor without tests**: if tests don't exist, write at least a smoke test first
- **One refactor per session**: don't mix refactoring with feature addition
- **Check git status first**: ensure a clean starting point
- **Commit small, logical units**: refactor → test → commit, then next refactor

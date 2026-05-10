# Code Review Skill
<!-- trigger: code review, review code, review the, review these, review my, review this -->
<!-- trigger: pull request, PR review, check the code, audit code -->
<!-- trigger: code quality, code smell -->

## Instructions

When activated for code review, follow this tool sequence:

1. **Scope the review** — identify which files were changed:
   - Use `git_diff` to see staged or recent changes
   - If reviewing a specific file, narrow with `read_file` on that file
   - For multi-file changes, `grep` for key symbols to understand scope

2. **Read the changes** — focus on the delta, not the whole file:
   - Use `read_file` with `line_start`/`line_end` for targeted sections
   - Prefer `git_diff` output over reading entire files
   - Read only what changed plus relevant context lines

3. **Check for common issues** (run these in parallel when possible):
   - **Logic errors**: off-by-one, null/undefined access, incorrect conditions
   - **Security**: unsanitized input, hardcoded secrets, missing auth checks
   - **Performance**: N+1 queries, unnecessary loops, missing memoization
   - **Style**: naming conventions, consistency with existing patterns
   - **Tests**: do the changed functions have test coverage?

4. **Verify** — run relevant tests and lints:
   - `bash("npm test -- --testPathPattern=<related>")` for affected tests
   - `bash("npm run lint")` if lint script exists

5. **Deliver findings** as structured text:
   - Severity: 🔴 Critical / 🟡 Warning / 🔵 Suggestion
   - File path and line reference for each finding
   - Specific recommendation for each issue

## Anti-patterns to avoid
- Don't re-read entire files that haven't changed
- Don't list style issues that the formatter would catch
- Don't make edits during review — review is read-only by default

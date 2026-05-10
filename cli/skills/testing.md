# Testing Skill
<!-- trigger: test, testing, write test, add test, create test, test coverage -->
<!-- trigger: unit test, integration test, e2e test, test suite -->
<!-- trigger: failing test, broken test, test failure -->

## Instructions

When activated for testing, follow this tool sequence:

1. **Understand what to test**:
   - `read_file` the source file that needs tests
   - `grep` for existing test files: `grep(<source_filename>, "tests/")`
   - If a test file exists, read it to match patterns

2. **Determine the test framework** (check package.json or config files):
   - Jest: `jest.config.*`, `"jest"` in package.json → `npm test -- --testPathPattern=...`
   - Vitest: `vitest.config.*` → `npx vitest run`
   - Mocha: `.mocharc.*`, `"mocha"` in package.json → `npx mocha`
   - If unsure, check `package.json scripts.test` for the command

3. **Write the test**:
   - Follow existing test patterns (read a similar test file first)
   - Cover: happy path, edge cases, error conditions
   - Use `write_file` for new test files, `edit_file` for adding to existing ones
   - Name pattern: `<source_name>.test.<ext>` or `<source_name>.spec.<ext>`

4. **Run the test**:
   - `bash("npm test -- --testPathPattern=<test_file>")` for Jest/Vitest
   - Check output for pass/fail
   - If it fails, read the error, fix the test or source, re-run

5. **Verify coverage** (if available):
   - `bash("npm test -- --coverage")` and check the report

## Quick patterns

- **Add test to existing suite**: read_test → edit_file (add test case) → bash(test)
- **Create new test file**: read_source → read_similar_test → write_file → bash(test)
- **Fix failing test**: read_test → read_source → edit_file (fix) → bash(test)

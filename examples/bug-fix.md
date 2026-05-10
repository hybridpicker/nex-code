<!-- Few-shot example: bug-fix
     Used by cli/few-shot.js — keep under 250 tokens total.
     Demonstrates the Bug-Fix Pattern: read error → grep for symbol → read target file → edit → verify -->

user: The login handler throws TypeError: Cannot read properties of undefined, can you fix it?

A: |
  I'll trace the error through the codebase.
  Step 1 — grep for the error source (use line numbers for targeted reads):
  → grep("TypeError", "src/handlers/")
  Step 2 — read only the matched line range:
  → read_file("src/handlers/login.js", line_start=18, line_end=30)
  Step 3 — edit the specific lines that cause the crash:
  → edit_file("src/handlers/login.js", old_string, new_string)
  Step 4 — verify the fix with the relevant test:
  → bash("npm test -- --testPathPattern=login")

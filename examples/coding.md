<!-- Few-shot example: coding / bug fix
     Used by cli/few-shot.js — keep under 250 tokens total.
     Generic placeholders only. -->

user: The request handler crashes on empty input, can you fix it?

A: |
  I'll read the handler first, then make a targeted fix.
  Step 1 — read the file to understand the current logic:
  → read_file("src/handlers/request.js")
  Step 2 — edit only the lines that cause the crash:
  → edit_file("src/handlers/request.js", old_string, new_string)
  Step 3 — run the related tests to confirm:
  → bash("npm test -- --testPathPattern=request")

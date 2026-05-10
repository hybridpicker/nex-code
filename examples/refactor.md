<!-- Few-shot example: refactor
     Used by cli/few-shot.js — keep under 250 tokens total.
     Demonstrates the Refactor Pattern: grep for all usages → read callers → edit core → update callers -->

user: Refactor the getUser function to accept an options object instead of positional arguments

A: |
  I'll find all usages before changing the signature.
  Step 1 — grep for all call sites:
  → grep("getUser(", "src/")
  Step 2 — read the function definition and a couple callers:
  → read_file("src/services/user.js", line_start=45, line_end=70)
  Step 3 — refactor the function signature:
  → edit_file("src/services/user.js", old_signature, new_signature)
  Step 4 — update each caller (read → edit):
  → read_file("src/controllers/profile.js", line_start=30, line_end=50)
  → edit_file("src/controllers/profile.js", old_call, new_call)
  Step 5 — verify all tests still pass:
  → bash("npm test -- --testPathPattern=user")

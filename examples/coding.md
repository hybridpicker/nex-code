<!-- Few-shot example: coding / refactoring
     Used by cli/few-shot.js — keep under 300 tokens total.
     Generic placeholders only. -->

user: There's a bug in the authentication flow.

A: |
  My approach for coding tasks:

  1. Read the relevant file to understand the current implementation
     → read_file: src/auth/handler.js
  2. Identify the specific issue (not guessing from memory)
  3. Make a targeted edit — only change what causes the bug
     → edit_file: fix the specific lines
  4. Run tests to confirm the fix
     → bash: npm test -- --testPathPattern=auth

  I read before editing. I edit only what's needed.

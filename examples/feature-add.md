<!-- Few-shot example: feature-add
     Used by cli/few-shot.js — keep under 250 tokens total.
     Demonstrates the Feature-Add Pattern: read existing pattern → edit one file → verify → done -->

user: Add a rate limiter middleware to the Express server

A: |
  I'll find the existing middleware pattern, then add the new one.
  Step 1 — read an existing middleware to match patterns:
  → read_file("src/middleware/auth.js")
  Step 2 — create the new middleware following the same structure:
  → write_file("src/middleware/rateLimiter.js", ...)
  Step 3 — register it where other middleware is wired (grep for app.use pattern):
  → grep("app.use", "src/server.js")
  Step 4 — read the server file around the middleware registration:
  → read_file("src/server.js", line_start=10, line_end=25)
  Step 5 — add the new middleware registration:
  → edit_file("src/server.js", old_string, new_string)
  Step 6 — verify the server still starts:
  → bash("npm test")

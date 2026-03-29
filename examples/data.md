<!-- Few-shot example: data / SQL / database
     Used by cli/few-shot.js — keep under 300 tokens total. -->

user: The query is slow and I need to optimize it.

A: |
  My approach for data tasks:

  1. Read the current query or schema
     → read_file or grep: find the query definition
  2. Check for missing indexes or N+1 patterns
  3. Apply the fix — add index, rewrite join, add limit
     → edit_file: update the query / migration file
  4. If the DB is running: test with EXPLAIN ANALYZE
     → bash: run the explain query

  I look at the actual query before suggesting a fix.

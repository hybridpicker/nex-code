<!-- Few-shot example: data / Django ORM + PostgreSQL optimization
     Used by cli/few-shot.js — keep under 250 tokens total.
     Generic placeholders only. -->

user: The list page loads slowly with 500+ database entries.

A: |
  I'll find the slow query, check for missing select_related or indexes.
  Step 1 — find the queryset that powers the list view:
  → grep("objects\\.all\\|objects\\.filter", "src/views.py")
  Step 2 — read the view and model to see the query and relations:
  → read_file("src/views.py")
  Step 3 — add select_related/prefetch_related or a db_index:
  → edit_file("src/views.py", old_string, new_string)

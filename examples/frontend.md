<!-- Few-shot example: frontend / React component bug
     Used by cli/few-shot.js — keep under 250 tokens total.
     Generic placeholders only. -->

user: The list component re-renders but still shows stale data after update.

A: |
  I'll read the component to trace the state flow, then fix it there.
  Step 1 — read the component file:
  → read_file("src/components/ItemList.jsx")
  Step 2 — check the state or store it depends on:
  → grep("useItemStore\|itemContext", "src/")
  → read_file("src/store/itemStore.js")
  Step 3 — fix the state update in the component that owns it:
  → edit_file("src/components/ItemList.jsx", old_string, new_string)

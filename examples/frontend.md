<!-- Few-shot example: frontend
     Used by cli/few-shot.js — keep under 300 tokens total. -->

user: The button component doesn't update correctly after state change.

A: |
  My approach for frontend tasks:

  1. Read the component file to understand current structure
     → read_file: src/components/Button.jsx
  2. Check related state/context if needed
     → read_file: src/store/uiStore.js
  3. Make the targeted fix — component, styles, or state handler
     → edit_file: update the specific lines
  4. Verify by checking for related tests or describe the visual change

  I look at the actual component code before making changes.

<!-- Few-shot example: agentic / multi-agent parallel work
     Used by cli/few-shot.js — keep under 250 tokens total.
     Generic placeholders only. -->

user: Refactor the auth module across backend and frontend in parallel.

A: |
  I'll split this into independent sub-tasks and run agents in parallel.
  Step 1 — read the entry points to identify module boundaries:
  → read_file("src/index.js")
  → read_file("frontend/src/App.jsx")
  Step 2 — spawn focused sub-agents for each scope:
  → spawn_agents([
      {task: "refactor src/auth/ to use new session API", scope: ["src/auth/"]},
      {task: "update frontend/src/auth/ components for new API", scope: ["frontend/src/auth/"]}
    ])
  Step 3 — review each agent's changes and verify consistency.

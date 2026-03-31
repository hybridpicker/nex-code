# Skills System

nex-code includes a skill system that extends the agent's capabilities with reusable instructions, commands, and tools.

## Built-in Skills

### autoresearch

Autonomous optimization loops: edit → test → log → keep/revert. Start with `/autoresearch <goal>`.

### skill-learning

Lets the agent create and update reusable skills from experience. After complex tasks (5+ tool calls), the agent is nudged to save its approach as a skill for future reuse.

**Tools:**

- `skill_learn_create` — Create a new skill with name, description, triggers, and markdown instructions
- `skill_learn_patch` — Update an existing skill via find-and-replace
- `skill_learn_read` — Read the full content of a skill for review

**Command:** `/skills-learned` — List all user-created skills

**How it works:**

1. The system prompt includes guidance that nudges the agent to create skills after complex multi-step tasks
2. The agent calls `skill_learn_create` with a name, trigger keywords, and step-by-step instructions
3. The skill is saved to `.nex/skills/{name}.md` and loaded automatically in future sessions
4. When a skill becomes outdated, the agent can patch it with `skill_learn_patch`

**Skill file format:**

```markdown
---
name: deploy-app
description: Deploy the application to production
trigger:
  - "deploy"
  - "production"
---

## Steps

1. Run the test suite
2. Build the production bundle
3. Upload to the server
```

### session-search

Cross-session keyword search to recall previous approaches and solutions.

**Tool:** `skill_search_sessions` — Search past sessions by keyword, returns matching sessions with context snippets

**When it activates:**

- User asks about past work ("what did we do last time?", "how did we fix X?")
- Agent needs to recall a previous approach before starting similar work

**How it works:**

1. Searches all `.nex/sessions/*.json` files for keyword matches
2. Returns up to 5 most relevant sessions, sorted by match count
3. Each result includes context snippets (80 chars before, 120 chars after each match)
4. Case-insensitive substring matching

## User-Installed Skills

Install skills from GitHub:

```bash
# Inside nex-code
/install-skill user/repo
```

Or place `.md` / `.js` files directly in `.nex/skills/`.

### Markdown Skills (.md)

Inject instructions into the system prompt. Support optional trigger patterns:

```markdown
---
trigger:
  - "docker"
  - "container"
---

# Docker Workflow

When working with Docker, always check...
```

### Script Skills (.js)

Full module with optional commands and tools:

```javascript
module.exports = {
  name: "my-skill",
  description: "What this skill does",
  instructions: "Injected into system prompt",

  commands: [
    { cmd: "/my-cmd", desc: "Help text", handler: (args) => "result" }
  ],

  tools: [
    {
      type: "function",
      function: {
        name: "my_tool",
        description: "Tool description",
        parameters: { type: "object", properties: { ... } }
      },
      execute: async (args) => "result"
    }
  ]
};
```

## Managing Skills

```bash
/list-skills        # Show all loaded skills
/enable-skill name  # Re-enable a disabled skill
/disable-skill name # Disable a skill
/remove-skill name  # Delete an installed skill
/skills-learned     # List agent-created skills
```

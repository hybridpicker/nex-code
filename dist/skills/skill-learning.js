/**
 * cli/skills/skill-learning.js — Skill Auto-Learning
 * Lets the agent create and update reusable skills from experience.
 * Inspired by Hermes Agent's closed learning loop.
 */

const fs = require("fs");
const path = require("path");

function getSkillsDir() {
  return path.join(process.cwd(), ".nex", "skills");
}

function ensureSkillsDir() {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Validate a skill name: lowercase, alphanumeric + hyphens, 2-64 chars
 */
function validateName(name) {
  if (!name || typeof name !== "string") return "name is required";
  if (name.length < 2 || name.length > 64) return "name must be 2-64 characters";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name) && name.length > 1)
    return "name must be lowercase alphanumeric with hyphens (e.g. deploy-workflow)";
  return null;
}

/**
 * Build a .md skill file with YAML frontmatter
 */
function buildSkillContent(name, description, triggers, content) {
  const triggerBlock =
    triggers && triggers.length > 0
      ? `trigger:\n${triggers.map((t) => `  - "${t}"`).join("\n")}\n`
      : "";
  return `---
name: ${name}
description: ${description}
${triggerBlock}---

${content}
`;
}

module.exports = {
  name: "skill-learning",
  description:
    "Create and update reusable skills from experience. " +
    "After complex tasks, the agent can save its approach as a skill for future reuse.",

  instructions: `You have tools to create and improve reusable skills.

## When to create a skill

After completing a complex task (5+ tool calls), fixing a tricky multi-step issue,
or discovering a non-obvious workflow, save the approach as a reusable skill using
skill_learn_create. Good candidates:

- Deployment procedures with specific steps
- Debugging workflows for recurring issues
- Project-specific patterns (build, test, release)
- Recurring maintenance or migration tasks

Do NOT create skills for trivial one-off tasks or generic knowledge.

## When to update a skill

When using a skill and finding it outdated, incomplete, or wrong, patch it immediately
with skill_learn_patch. Skills that are not maintained become liabilities.

## Skill quality

- Instructions should be actionable step-by-step guides
- Include the WHY behind non-obvious steps
- Add trigger keywords so the skill activates automatically on relevant prompts
- Keep skills focused — one workflow per skill, not a knowledge dump`,

  commands: [
    {
      cmd: "/skills-learned",
      desc: "List all user-created skills in .nex/skills/",
      handler: () => {
        const dir = getSkillsDir();
        if (!fs.existsSync(dir)) return "No learned skills yet.";
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith(".md") || f.endsWith(".js"));
        if (files.length === 0) return "No learned skills yet.";
        return (
          "Learned skills:\n" +
          files.map((f) => `  - ${f.replace(/\.(md|js)$/, "")}`).join("\n")
        );
      },
    },
  ],

  tools: [
    {
      type: "function",
      function: {
        name: "learn_create",
        description:
          "Create a new reusable skill from the current task's approach. " +
          "The skill will be saved to .nex/skills/ and loaded automatically in future sessions.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Skill name: lowercase, hyphens allowed, 2-64 chars (e.g. deploy-nextjs, fix-docker-dns)",
            },
            description: {
              type: "string",
              description: "One-line description of what this skill does",
            },
            triggers: {
              type: "array",
              items: { type: "string" },
              description:
                "Keywords that should activate this skill (e.g. [\"deploy\", \"nextjs\", \"vercel\"])",
            },
            content: {
              type: "string",
              description:
                "Skill instructions in markdown. Should be a step-by-step guide the agent can follow.",
            },
          },
          required: ["name", "description", "content"],
        },
      },
      execute: async (args) => {
        const { name, description, content, triggers } = args;

        // Validate name
        const nameErr = validateName(name);
        if (nameErr) return JSON.stringify({ status: "error", error: nameErr });

        // Validate content
        if (!content || content.trim().length < 20) {
          return JSON.stringify({
            status: "error",
            error: "Content must be at least 20 characters",
          });
        }
        if (!description || description.trim().length < 5) {
          return JSON.stringify({
            status: "error",
            error: "Description must be at least 5 characters",
          });
        }

        const dir = ensureSkillsDir();
        const filePath = path.join(dir, `${name}.md`);

        // Check if skill already exists
        if (fs.existsSync(filePath)) {
          return JSON.stringify({
            status: "error",
            error: `Skill "${name}" already exists. Use skill_learn_patch to update it.`,
          });
        }

        // Write skill file
        const skillContent = buildSkillContent(
          name,
          description,
          triggers || [],
          content.trim(),
        );
        fs.writeFileSync(filePath, skillContent, "utf-8");

        // Reload skills if the loader is available
        try {
          const { loadAllSkills } = require("../skills");
          loadAllSkills();
        } catch {
          // skills.js may not be loadable in all contexts
        }

        return JSON.stringify({
          status: "created",
          name,
          path: filePath,
          triggers: triggers || [],
          note: "Skill will be active in the next session (or after /reload-skills).",
        });
      },
    },
    {
      type: "function",
      function: {
        name: "learn_patch",
        description:
          "Update an existing skill by replacing a section of its content. " +
          "Use this when a skill is outdated, incomplete, or wrong.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the skill to patch",
            },
            old_text: {
              type: "string",
              description: "Exact text to find in the skill file",
            },
            new_text: {
              type: "string",
              description: "Replacement text",
            },
          },
          required: ["name", "old_text", "new_text"],
        },
      },
      execute: async (args) => {
        const { name, old_text, new_text } = args;

        if (!name) {
          return JSON.stringify({ status: "error", error: "name is required" });
        }

        const dir = getSkillsDir();
        // Try both .md and .js extensions
        let filePath = path.join(dir, `${name}.md`);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(dir, `${name}.js`);
        }
        if (!fs.existsSync(filePath)) {
          return JSON.stringify({
            status: "error",
            error: `Skill "${name}" not found in ${dir}`,
          });
        }

        const content = fs.readFileSync(filePath, "utf-8");
        if (!content.includes(old_text)) {
          return JSON.stringify({
            status: "error",
            error: "old_text not found in skill file. Read the skill first to get the exact text.",
          });
        }

        const updated = content.replace(old_text, new_text);
        fs.writeFileSync(filePath, updated, "utf-8");

        // Reload skills
        try {
          const { loadAllSkills } = require("../skills");
          loadAllSkills();
        } catch {
          // skills.js may not be loadable in all contexts
        }

        return JSON.stringify({
          status: "patched",
          name,
          path: filePath,
        });
      },
    },
    {
      type: "function",
      function: {
        name: "learn_read",
        description: "Read the full content of an existing skill to review or patch it.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the skill to read",
            },
          },
          required: ["name"],
        },
      },
      execute: async (args) => {
        const { name } = args;
        if (!name) {
          return JSON.stringify({ status: "error", error: "name is required" });
        }

        const dir = getSkillsDir();
        let filePath = path.join(dir, `${name}.md`);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(dir, `${name}.js`);
        }
        if (!fs.existsSync(filePath)) {
          return JSON.stringify({
            status: "error",
            error: `Skill "${name}" not found in ${dir}`,
          });
        }

        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.stringify({ status: "ok", name, content });
      },
    },
  ],
};

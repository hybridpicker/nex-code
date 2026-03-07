/**
 * cli/planner.js — Plan Mode
 * Structured planning workflow: analyze → plan → approve → execute
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { C } = require('./ui');

// Plan state
let activePlan = null;
let planMode = false;
let planContent = null;

// Tools allowed in plan mode (read-only operations only)
const PLAN_MODE_ALLOWED_TOOLS = new Set([
  'read_file', 'list_directory', 'search_files', 'glob', 'grep',
  'web_search', 'web_fetch',
  'git_status', 'git_diff', 'git_log', 'git_show',
  'ask_user',
]);

function getPlanDir() {
  return path.join(process.cwd(), '.nex', 'plans');
}

function ensureDir() {
  const dir = getPlanDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * @typedef {object} PlanStep
 * @property {string} description
 * @property {string[]} files — affected files
 * @property {'pending'|'in_progress'|'done'|'skipped'} status
 */

/**
 * @typedef {object} Plan
 * @property {string} name
 * @property {string} task — original task description
 * @property {PlanStep[]} steps
 * @property {'draft'|'approved'|'executing'|'completed'} status
 * @property {string} createdAt
 * @property {string} [updatedAt]
 */

/**
 * Create a new plan
 * @param {string} task
 * @param {PlanStep[]} steps
 * @returns {Plan}
 */
function createPlan(task, steps = []) {
  activePlan = {
    name: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    task,
    steps: steps.map((s) => ({
      description: s.description || s,
      files: s.files || [],
      status: 'pending',
    })),
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
  return activePlan;
}

/**
 * Get the active plan
 * @returns {Plan|null}
 */
function getActivePlan() {
  return activePlan;
}

/**
 * Set plan mode on/off
 */
function setPlanMode(enabled) {
  planMode = enabled;
}

/**
 * Check if plan mode is active
 */
function isPlanMode() {
  return planMode;
}

/**
 * Approve the current plan
 * @returns {boolean}
 */
function approvePlan() {
  if (!activePlan || activePlan.status !== 'draft') return false;
  activePlan.status = 'approved';
  activePlan.updatedAt = new Date().toISOString();
  return true;
}

/**
 * Start executing the plan
 */
function startExecution() {
  if (!activePlan || activePlan.status !== 'approved') return false;
  activePlan.status = 'executing';
  return true;
}

/**
 * Update step status
 * @param {number} index
 * @param {'pending'|'in_progress'|'done'|'skipped'} status
 */
function updateStep(index, status) {
  if (!activePlan || index < 0 || index >= activePlan.steps.length) return false;
  activePlan.steps[index].status = status;
  activePlan.updatedAt = new Date().toISOString();

  // Check if all steps are done
  if (activePlan.steps.every((s) => s.status === 'done' || s.status === 'skipped')) {
    activePlan.status = 'completed';
  }
  return true;
}

/**
 * Format plan for display
 * @param {Plan} plan
 * @returns {string}
 */
function formatPlan(plan) {
  if (!plan) return `${C.dim}No active plan${C.reset}`;

  const statusIcon = {
    draft: `${C.yellow}DRAFT${C.reset}`,
    approved: `${C.green}APPROVED${C.reset}`,
    executing: `${C.blue}EXECUTING${C.reset}`,
    completed: `${C.green}COMPLETED${C.reset}`,
  };

  const lines = [];
  lines.push(`\n${C.bold}${C.cyan}Plan: ${plan.task}${C.reset}`);
  lines.push(`${C.dim}Status: ${statusIcon[plan.status] || plan.status}${C.reset}\n`);

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    let icon;
    switch (step.status) {
      case 'done': icon = `${C.green}✓${C.reset}`; break;
      case 'in_progress': icon = `${C.blue}→${C.reset}`; break;
      case 'skipped': icon = `${C.dim}○${C.reset}`; break;
      default: icon = `${C.dim} ${C.reset}`;
    }
    lines.push(`  ${icon} ${C.bold}Step ${i + 1}:${C.reset} ${step.description}`);
    if (step.files.length > 0) {
      lines.push(`    ${C.dim}Files: ${step.files.join(', ')}${C.reset}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Save plan to .nex/plans/
 */
function savePlan(plan) {
  if (!plan) plan = activePlan;
  if (!plan) return null;
  ensureDir();
  const filePath = path.join(getPlanDir(), `${plan.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(plan, null, 2), 'utf-8');
  return filePath;
}

/**
 * Load a plan from disk
 */
function loadPlan(name) {
  const filePath = path.join(getPlanDir(), `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const plan = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    activePlan = plan;
    return plan;
  } catch {
    return null;
  }
}

/**
 * List all saved plans
 */
function listPlans() {
  ensureDir();
  const dir = getPlanDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const plans = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      plans.push({
        name: data.name,
        task: data.task,
        status: data.status,
        steps: data.steps ? data.steps.length : 0,
        createdAt: data.createdAt,
      });
    } catch {
      // skip corrupt
    }
  }
  return plans.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Store the LLM's plan text output
 */
function setPlanContent(text) { planContent = text; }
function getPlanContent() { return planContent; }

/**
 * Clear the active plan
 */
function clearPlan() {
  activePlan = null;
  planMode = false;
  planContent = null;
}

/**
 * Get plan-mode system prompt addition
 * Instructs the LLM to only analyze and plan, not execute
 */
function getPlanModePrompt() {
  const allowedList = [...PLAN_MODE_ALLOWED_TOOLS].join(', ');
  return `
PLAN MODE ACTIVE: You are in analysis-only mode. You MUST NOT execute any changes.

# Allowed Tools (read-only)
You may ONLY use these tools: ${allowedList}
Any other tool call will be blocked and returned with an error.

# Analysis Phase
Thoroughly investigate before writing a plan:
- Scope: What files and modules are affected?
- Architecture: How does the current code work? What patterns does it follow?
- Dependencies: What depends on the code being changed? What might break?
- Tests: What test coverage exists? What new tests are needed?

# Required Plan Format
After analysis, output a plan in this exact markdown format:

## Summary
One paragraph describing the overall goal.

## Steps
Numbered list. Each step:
- **What**: Clear description of the change
- **Where**: Specific file(s) and line ranges
- **How**: Implementation approach (edit, create, delete)

## Files Affected
Bullet list of all files that will be modified or created.

## Risks
Bullet list of potential issues and mitigations.

# Important
- Order steps by dependency (later steps may depend on earlier ones).
- After presenting the plan, tell the user to type \`/plan approve\` to proceed.
- Do NOT make any file changes — your role is analysis and planning only.`;
}

// Autonomy levels
const AUTONOMY_LEVELS = ['interactive', 'semi-auto', 'autonomous'];
let autonomyLevel = 'interactive';

function setAutonomyLevel(level) {
  if (!AUTONOMY_LEVELS.includes(level)) return false;
  autonomyLevel = level;
  return true;
}

function getAutonomyLevel() {
  return autonomyLevel;
}

module.exports = {
  createPlan,
  getActivePlan,
  setPlanMode,
  isPlanMode,
  approvePlan,
  startExecution,
  updateStep,
  formatPlan,
  savePlan,
  loadPlan,
  listPlans,
  clearPlan,
  getPlanModePrompt,
  setPlanContent,
  getPlanContent,
  PLAN_MODE_ALLOWED_TOOLS,
  setAutonomyLevel,
  getAutonomyLevel,
  AUTONOMY_LEVELS,
};

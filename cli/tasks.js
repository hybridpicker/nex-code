/**
 * cli/tasks.js — Task List Management
 * Create, update, and render task lists for complex multi-step operations.
 */

const { C } = require('./ui');

// Active task list state
let taskListName = '';
let tasks = [];
let taskIdCounter = 0;

// onChange callback for live display integration
let _onChange = null;

/**
 * Register a callback fired on task list changes.
 * @param {function|null} fn - Callback: fn(event, data) where event is 'create'|'update'|'clear'
 */
function setOnChange(fn) {
  _onChange = fn;
}

/**
 * Create a new task list with a name and array of task descriptions.
 * @param {string} name - Name/title for the task list
 * @param {Array<{description: string, depends_on?: string[]}>} taskDefs
 * @returns {Array<object>} Created tasks
 */
function createTasks(name, taskDefs) {
  taskListName = name;
  tasks = [];
  taskIdCounter = 0;

  for (const def of taskDefs) {
    taskIdCounter++;
    const id = `t${taskIdCounter}`;
    tasks.push({
      id,
      description: def.description || def.title || def.name || def.task || `Task ${taskIdCounter}`,
      status: 'pending',
      dependsOn: def.depends_on || [],
      result: null,
    });
  }

  const snapshot = tasks.map(t => ({ ...t }));
  if (_onChange) _onChange('create', { name, tasks: snapshot });
  return snapshot;
}

/**
 * Update a task's status and optionally set its result.
 * @param {string} id - Task ID (e.g. 't1')
 * @param {string} status - 'in_progress' | 'done' | 'failed'
 * @param {string} [result] - Summary of the result
 * @returns {object|null} Updated task or null if not found
 */
function updateTask(id, status, result) {
  const task = tasks.find(t => t.id === id);
  if (!task) return null;

  task.status = status;
  if (result !== undefined) task.result = result;

  if (_onChange) _onChange('update', { id, status, result });
  return { ...task };
}

/**
 * Get the current task list.
 * @returns {{ name: string, tasks: Array<object> }}
 */
function getTaskList() {
  return {
    name: taskListName,
    tasks: tasks.map(t => ({ ...t })),
  };
}

/**
 * Clear all tasks.
 */
function clearTasks() {
  taskListName = '';
  tasks = [];
  taskIdCounter = 0;
  if (_onChange) _onChange('clear', {});
}

/**
 * Get tasks that are ready to run (pending + all dependencies done).
 * @returns {Array<object>}
 */
function getReadyTasks() {
  return tasks.filter(t => {
    if (t.status !== 'pending') return false;
    if (t.dependsOn.length === 0) return true;
    return t.dependsOn.every(depId => {
      const dep = tasks.find(d => d.id === depId);
      return dep && dep.status === 'done';
    });
  });
}

/**
 * Render the task list for terminal display.
 * @returns {string}
 */
function renderTaskList() {
  if (tasks.length === 0) return `${C.dim}No active tasks${C.reset}`;

  const lines = [];

  if (taskListName) {
    lines.push(`  ${C.bold}${C.cyan}Tasks: ${taskListName}${C.reset}`);
    lines.push(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
  }

  for (const t of tasks) {
    let icon, color;
    switch (t.status) {
      case 'done':
        icon = '✓';
        color = C.green;
        break;
      case 'in_progress':
        icon = '→';
        color = C.cyan;
        break;
      case 'failed':
        icon = '✗';
        color = C.red;
        break;
      default:
        icon = '·';
        color = C.dim;
    }

    const deps = t.dependsOn.length > 0 ? ` ${C.dim}(after: ${t.dependsOn.join(', ')})${C.reset}` : '';
    const status = `[${t.status}]`;
    const desc = t.description.length > 50 ? t.description.substring(0, 47) + '...' : t.description;

    lines.push(`  ${color}${icon}${C.reset} ${C.bold}${t.id}${C.reset}  ${desc.padEnd(40)} ${color}${status}${C.reset}${deps}`);

    if (t.result && t.status === 'done') {
      const shortResult = t.result.length > 60 ? t.result.substring(0, 57) + '...' : t.result;
      lines.push(`       ${C.dim}→ ${shortResult}${C.reset}`);
    }
  }

  // Summary
  const done = tasks.filter(t => t.status === 'done').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const total = tasks.length;
  lines.push(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
  lines.push(`  ${C.dim}${done}/${total} done${failed > 0 ? `, ${failed} failed` : ''}${C.reset}`);

  return lines.join('\n');
}

/**
 * Check if there are active (non-done/failed) tasks.
 * @returns {boolean}
 */
function hasActiveTasks() {
  return tasks.length > 0 && tasks.some(t => t.status === 'pending' || t.status === 'in_progress');
}

module.exports = {
  createTasks,
  updateTask,
  getTaskList,
  clearTasks,
  getReadyTasks,
  renderTaskList,
  setOnChange,
  hasActiveTasks,
};

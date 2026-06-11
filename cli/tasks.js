/**
 * cli/tasks.js — Task List Management
 * Create, update, and render task lists for complex multi-step operations.
 * The active list is persisted to .nex/tasks.json so an interrupted
 * multi-step task survives a CLI restart.
 */

const fs = require("fs");
const path = require("path");
const { C } = require("./ui");

// Active task list state
let taskListName = "";
let tasks = [];
let taskIdCounter = 0;
let _loadedFromDisk = false;

// onChange callback for live display integration
let _onChange = null;

/**
 * Resolve the persistence file. Inside Jest, persistence is opt-in via
 * NEX_TASKS_FILE so parallel suites stay isolated from each other.
 * @returns {string|null}
 */
function _tasksFile() {
  if (process.env.NEX_TASKS_FILE) return process.env.NEX_TASKS_FILE;
  if (process.env.JEST_WORKER_ID) return null;
  return path.join(process.cwd(), ".nex", "tasks.json");
}

/** Best-effort save of the active task list. */
function _persist() {
  const file = _tasksFile();
  if (!file) return;
  try {
    const { atomicWrite } = require("./filelock");
    atomicWrite(
      file,
      JSON.stringify(
        { name: taskListName, counter: taskIdCounter, tasks },
        null,
        2,
      ),
    );
  } catch {
    /* persistence is best-effort */
  }
}

/** Remove the persisted task file (list cleared or finished). */
function _removePersisted() {
  const file = _tasksFile();
  if (!file) return;
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Load a previously persisted task list once per process. A fully
 * finished list (all done/failed) is discarded instead of resurrected.
 */
function _ensureLoaded() {
  if (_loadedFromDisk || tasks.length > 0) return;
  _loadedFromDisk = true;
  const file = _tasksFile();
  if (!file) return;
  try {
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!Array.isArray(data.tasks) || data.tasks.length === 0) return;
    const allFinished = data.tasks.every(
      (t) => t.status === "done" || t.status === "failed",
    );
    if (allFinished) {
      _removePersisted();
      return;
    }
    taskListName = data.name || "";
    tasks = data.tasks;
    taskIdCounter = data.counter || data.tasks.length;
  } catch {
    /* corrupt file — start fresh */
  }
}

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
  _loadedFromDisk = true; // a new list supersedes anything persisted
  taskListName = name;
  tasks = [];
  taskIdCounter = 0;

  for (const def of taskDefs) {
    taskIdCounter++;
    const id = `t${taskIdCounter}`;
    tasks.push({
      id,
      description:
        def.description ||
        def.title ||
        def.name ||
        def.task ||
        `Task ${taskIdCounter}`,
      status: "pending",
      dependsOn: def.depends_on || [],
      result: null,
    });
  }

  const snapshot = tasks.map((t) => ({ ...t }));
  _persist();
  if (_onChange) _onChange("create", { name, tasks: snapshot });
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
  _ensureLoaded();
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;

  task.status = status;
  if (result !== undefined) task.result = result;

  _persist();
  if (_onChange) _onChange("update", { id, status, result });
  return { ...task };
}

/**
 * Get the current task list.
 * @returns {{ name: string, tasks: Array<object> }}
 */
function getTaskList() {
  _ensureLoaded();
  return {
    name: taskListName,
    tasks: tasks.map((t) => ({ ...t })),
  };
}

/**
 * Clear all tasks.
 */
function clearTasks() {
  _loadedFromDisk = true;
  taskListName = "";
  tasks = [];
  taskIdCounter = 0;
  _removePersisted();
  if (_onChange) _onChange("clear", {});
}

/**
 * Get tasks that are ready to run (pending + all dependencies done).
 * @returns {Array<object>}
 */
function getReadyTasks() {
  _ensureLoaded();
  return tasks.filter((t) => {
    if (t.status !== "pending") return false;
    if (t.dependsOn.length === 0) return true;
    return t.dependsOn.every((depId) => {
      const dep = tasks.find((d) => d.id === depId);
      return dep && dep.status === "done";
    });
  });
}

/**
 * Render the task list for terminal display.
 * @returns {string}
 */
function renderTaskList() {
  _ensureLoaded();
  if (tasks.length === 0) return `${C.dim}No active tasks${C.reset}`;

  const lines = [];

  if (taskListName) {
    lines.push(`  ${C.bold}${C.cyan}Tasks: ${taskListName}${C.reset}`);
    lines.push(`  ${C.dim}${"─".repeat(40)}${C.reset}`);
  }

  for (const t of tasks) {
    let icon, color;
    switch (t.status) {
      case "done":
        icon = "✓";
        color = C.green;
        break;
      case "in_progress":
        icon = "→";
        color = C.cyan;
        break;
      case "failed":
        icon = "✗";
        color = C.red;
        break;
      default:
        icon = "·";
        color = C.dim;
    }

    const deps =
      t.dependsOn.length > 0
        ? ` ${C.dim}(after: ${t.dependsOn.join(", ")})${C.reset}`
        : "";
    const status = `[${t.status}]`;
    const desc =
      t.description.length > 50
        ? t.description.substring(0, 47) + "..."
        : t.description;

    lines.push(
      `  ${color}${icon}${C.reset} ${C.bold}${t.id}${C.reset}  ${desc.padEnd(40)} ${color}${status}${C.reset}${deps}`,
    );

    if (t.result && t.status === "done") {
      const shortResult =
        t.result.length > 60 ? t.result.substring(0, 57) + "..." : t.result;
      lines.push(`       ${C.dim}→ ${shortResult}${C.reset}`);
    }
  }

  // Summary
  const done = tasks.filter((t) => t.status === "done").length;
  const failed = tasks.filter((t) => t.status === "failed").length;
  const total = tasks.length;
  lines.push(`  ${C.dim}${"─".repeat(40)}${C.reset}`);
  lines.push(
    `  ${C.dim}${done}/${total} done${failed > 0 ? `, ${failed} failed` : ""}${C.reset}`,
  );

  return lines.join("\n");
}

/**
 * Check if there are active (non-done/failed) tasks.
 * @returns {boolean}
 */
function hasActiveTasks() {
  _ensureLoaded();
  return (
    tasks.length > 0 &&
    tasks.some((t) => t.status === "pending" || t.status === "in_progress")
  );
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

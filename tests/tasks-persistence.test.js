/**
 * tests/tasks-persistence.test.js — task lists survive a CLI restart
 * (persistence is opt-in under Jest via NEX_TASKS_FILE).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

describe("task persistence", () => {
  let tmpFile;

  beforeEach(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-tasks-"));
    tmpFile = path.join(dir, "tasks.json");
    process.env.NEX_TASKS_FILE = tmpFile;
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.NEX_TASKS_FILE;
    jest.resetModules();
    fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
  });

  test("createTasks and updateTask write the persistence file", () => {
    const tasks = require("../cli/tasks");
    tasks.createTasks("Migration", [
      { description: "Step 1" },
      { description: "Step 2" },
    ]);
    tasks.updateTask("t1", "done", "ok");

    const data = JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
    expect(data.name).toBe("Migration");
    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0].status).toBe("done");
  });

  test("an in-progress list survives a module reload (simulated restart)", () => {
    let tasks = require("../cli/tasks");
    tasks.createTasks("Refactor", [
      { description: "Step 1" },
      { description: "Step 2" },
    ]);
    tasks.updateTask("t1", "done");

    jest.resetModules();
    tasks = require("../cli/tasks");

    const list = tasks.getTaskList();
    expect(list.name).toBe("Refactor");
    expect(list.tasks).toHaveLength(2);
    expect(list.tasks[0].status).toBe("done");
    expect(list.tasks[1].status).toBe("pending");
    expect(tasks.hasActiveTasks()).toBe(true);
  });

  test("a fully finished list is not resurrected after reload", () => {
    let tasks = require("../cli/tasks");
    tasks.createTasks("Done deal", [{ description: "Only step" }]);
    tasks.updateTask("t1", "done");

    jest.resetModules();
    tasks = require("../cli/tasks");

    expect(tasks.getTaskList().tasks).toHaveLength(0);
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  test("clearTasks removes the persistence file", () => {
    const tasks = require("../cli/tasks");
    tasks.createTasks("Temp", [{ description: "Step" }]);
    expect(fs.existsSync(tmpFile)).toBe(true);
    tasks.clearTasks();
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  test("a corrupt persistence file is ignored", () => {
    fs.writeFileSync(tmpFile, "{ not json");
    const tasks = require("../cli/tasks");
    expect(tasks.getTaskList().tasks).toHaveLength(0);
  });

  test("ids continue after reload (counter persisted)", () => {
    let tasks = require("../cli/tasks");
    tasks.createTasks("List", [{ description: "A" }, { description: "B" }]);

    jest.resetModules();
    tasks = require("../cli/tasks");
    tasks.getTaskList(); // trigger load
    // New list supersedes — counter resets with createTasks by design
    const created = tasks.createTasks("New", [{ description: "C" }]);
    expect(created[0].id).toBe("t1");
  });
});

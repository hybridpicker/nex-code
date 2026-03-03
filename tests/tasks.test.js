const { createTasks, updateTask, getTaskList, clearTasks, getReadyTasks, renderTaskList, setOnChange, hasActiveTasks } = require('../cli/tasks');

describe('tasks.js', () => {
  afterEach(() => {
    clearTasks();
    setOnChange(null);
  });

  describe('createTasks()', () => {
    it('creates tasks with ids and pending status', () => {
      const tasks = createTasks('Test Plan', [
        { description: 'Step 1' },
        { description: 'Step 2' },
      ]);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('t1');
      expect(tasks[0].status).toBe('pending');
      expect(tasks[1].id).toBe('t2');
    });

    it('preserves depends_on', () => {
      const tasks = createTasks('Plan', [
        { description: 'A' },
        { description: 'B', depends_on: ['t1'] },
      ]);
      expect(tasks[1].dependsOn).toEqual(['t1']);
    });

    it('falls back when description is missing', () => {
      const tasks = createTasks('Plan', [
        { title: 'From title' },
        { name: 'From name' },
        { task: 'From task' },
        {},
      ]);
      expect(tasks[0].description).toBe('From title');
      expect(tasks[1].description).toBe('From name');
      expect(tasks[2].description).toBe('From task');
      expect(tasks[3].description).toBe('Task 4');
    });
  });

  describe('updateTask()', () => {
    it('updates status and result', () => {
      createTasks('Plan', [{ description: 'A' }]);
      const updated = updateTask('t1', 'done', 'Completed successfully');
      expect(updated.status).toBe('done');
      expect(updated.result).toBe('Completed successfully');
    });

    it('returns null for unknown id', () => {
      createTasks('Plan', [{ description: 'A' }]);
      expect(updateTask('t99', 'done')).toBeNull();
    });
  });

  describe('hasActiveTasks()', () => {
    it('returns false with no tasks', () => {
      expect(hasActiveTasks()).toBe(false);
    });

    it('returns true with pending tasks', () => {
      createTasks('Plan', [{ description: 'A' }]);
      expect(hasActiveTasks()).toBe(true);
    });

    it('returns true with in_progress tasks', () => {
      createTasks('Plan', [{ description: 'A' }]);
      updateTask('t1', 'in_progress');
      expect(hasActiveTasks()).toBe(true);
    });

    it('returns false when all tasks done', () => {
      createTasks('Plan', [{ description: 'A' }]);
      updateTask('t1', 'done');
      expect(hasActiveTasks()).toBe(false);
    });

    it('returns false when all tasks done or failed', () => {
      createTasks('Plan', [{ description: 'A' }, { description: 'B' }]);
      updateTask('t1', 'done');
      updateTask('t2', 'failed');
      expect(hasActiveTasks()).toBe(false);
    });
  });

  describe('onChange callbacks', () => {
    it('fires create event', () => {
      const calls = [];
      setOnChange((event, data) => calls.push({ event, data }));
      createTasks('Plan', [{ description: 'A' }]);
      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe('create');
      expect(calls[0].data.name).toBe('Plan');
      expect(calls[0].data.tasks).toHaveLength(1);
    });

    it('fires update event', () => {
      const calls = [];
      createTasks('Plan', [{ description: 'A' }]);
      setOnChange((event, data) => calls.push({ event, data }));
      updateTask('t1', 'in_progress');
      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe('update');
      expect(calls[0].data.id).toBe('t1');
      expect(calls[0].data.status).toBe('in_progress');
    });

    it('fires clear event', () => {
      const calls = [];
      createTasks('Plan', [{ description: 'A' }]);
      setOnChange((event, data) => calls.push({ event, data }));
      clearTasks();
      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe('clear');
    });

    it('does not fire when no callback set', () => {
      // Should not throw
      expect(() => {
        createTasks('Plan', [{ description: 'A' }]);
        updateTask('t1', 'done');
        clearTasks();
      }).not.toThrow();
    });
  });

  describe('getTaskList()', () => {
    it('returns name and task snapshots', () => {
      createTasks('Build Plan', [
        { description: 'Step A' },
        { description: 'Step B' },
      ]);
      const list = getTaskList();
      expect(list.name).toBe('Build Plan');
      expect(list.tasks).toHaveLength(2);
      expect(list.tasks[0].id).toBe('t1');
      expect(list.tasks[0].status).toBe('pending');
      expect(list.tasks[1].id).toBe('t2');
    });

    it('returns empty state when no tasks created', () => {
      const list = getTaskList();
      expect(list.name).toBe('');
      expect(list.tasks).toHaveLength(0);
    });

    it('returns snapshot copies not references', () => {
      createTasks('Plan', [{ description: 'A' }]);
      const list1 = getTaskList();
      updateTask('t1', 'done');
      const list2 = getTaskList();
      expect(list1.tasks[0].status).toBe('pending');
      expect(list2.tasks[0].status).toBe('done');
    });
  });

  describe('getReadyTasks()', () => {
    it('returns pending tasks with no dependencies', () => {
      createTasks('Plan', [
        { description: 'A' },
        { description: 'B', depends_on: ['t1'] },
      ]);
      const ready = getReadyTasks();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('t1');
    });

    it('returns dependent task when dependency is done', () => {
      createTasks('Plan', [
        { description: 'A' },
        { description: 'B', depends_on: ['t1'] },
      ]);
      updateTask('t1', 'done');
      const ready = getReadyTasks();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe('t2');
    });

    it('does not return task whose dependency is not done', () => {
      createTasks('Plan', [
        { description: 'A' },
        { description: 'B', depends_on: ['t1'] },
      ]);
      updateTask('t1', 'in_progress');
      const ready = getReadyTasks();
      expect(ready).toHaveLength(0);
    });

    it('does not return task with a nonexistent dependency', () => {
      createTasks('Plan', [
        { description: 'A', depends_on: ['t999'] },
      ]);
      const ready = getReadyTasks();
      expect(ready).toHaveLength(0);
    });
  });

  describe('renderTaskList()', () => {
    it('renders no active tasks when empty', () => {
      expect(renderTaskList()).toContain('No active tasks');
    });

    it('renders task list with name and tasks', () => {
      createTasks('My Plan', [{ description: 'Do thing' }]);
      const output = renderTaskList();
      expect(output).toContain('My Plan');
      expect(output).toContain('Do thing');
      expect(output).toContain('0/1 done');
    });
  });
});

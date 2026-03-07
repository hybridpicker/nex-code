const fs = require('fs');
const path = require('path');
const os = require('os');

describe('planner.js', () => {
  let planner;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-plan-'));
    jest.resetModules();
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    planner = require('../cli/planner');
    planner.clearPlan();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  describe('createPlan()', () => {
    it('creates a plan with task and steps', () => {
      const plan = planner.createPlan('Refactor auth', [
        { description: 'Read current code', files: ['auth.js'] },
        { description: 'Implement changes', files: ['auth.js', 'test.js'] },
      ]);
      expect(plan.task).toBe('Refactor auth');
      expect(plan.steps).toHaveLength(2);
      expect(plan.status).toBe('draft');
      expect(plan.createdAt).toBeDefined();
    });

    it('accepts string steps', () => {
      const plan = planner.createPlan('Test', ['Step 1', 'Step 2']);
      expect(plan.steps[0].description).toBe('Step 1');
      expect(plan.steps[0].status).toBe('pending');
    });

    it('creates plan with empty steps', () => {
      const plan = planner.createPlan('Empty plan');
      expect(plan.steps).toHaveLength(0);
    });

    it('sets plan as active', () => {
      planner.createPlan('Test');
      expect(planner.getActivePlan()).not.toBeNull();
    });
  });

  describe('getActivePlan()', () => {
    it('returns null when no plan', () => {
      expect(planner.getActivePlan()).toBeNull();
    });

    it('returns active plan', () => {
      planner.createPlan('Test');
      expect(planner.getActivePlan().task).toBe('Test');
    });
  });

  describe('plan mode', () => {
    it('starts as inactive', () => {
      expect(planner.isPlanMode()).toBe(false);
    });

    it('can be toggled', () => {
      planner.setPlanMode(true);
      expect(planner.isPlanMode()).toBe(true);
      planner.setPlanMode(false);
      expect(planner.isPlanMode()).toBe(false);
    });
  });

  describe('approvePlan()', () => {
    it('approves draft plan', () => {
      planner.createPlan('Test', ['Step 1']);
      expect(planner.approvePlan()).toBe(true);
      expect(planner.getActivePlan().status).toBe('approved');
    });

    it('returns false when no plan', () => {
      expect(planner.approvePlan()).toBe(false);
    });

    it('returns false for non-draft plan', () => {
      planner.createPlan('Test', ['Step 1']);
      planner.approvePlan();
      expect(planner.approvePlan()).toBe(false); // already approved
    });
  });

  describe('startExecution()', () => {
    it('starts execution of approved plan', () => {
      planner.createPlan('Test', ['Step 1']);
      planner.approvePlan();
      expect(planner.startExecution()).toBe(true);
      expect(planner.getActivePlan().status).toBe('executing');
    });

    it('returns false for non-approved plan', () => {
      planner.createPlan('Test', ['Step 1']);
      expect(planner.startExecution()).toBe(false);
    });
  });

  describe('updateStep()', () => {
    it('updates step status', () => {
      planner.createPlan('Test', ['Step 1', 'Step 2']);
      expect(planner.updateStep(0, 'done')).toBe(true);
      expect(planner.getActivePlan().steps[0].status).toBe('done');
    });

    it('returns false for invalid index', () => {
      planner.createPlan('Test', ['Step 1']);
      expect(planner.updateStep(5, 'done')).toBe(false);
      expect(planner.updateStep(-1, 'done')).toBe(false);
    });

    it('completes plan when all steps done', () => {
      planner.createPlan('Test', ['Step 1', 'Step 2']);
      planner.approvePlan();
      planner.startExecution();
      planner.updateStep(0, 'done');
      planner.updateStep(1, 'done');
      expect(planner.getActivePlan().status).toBe('completed');
    });

    it('completes plan with mix of done and skipped', () => {
      planner.createPlan('Test', ['Step 1', 'Step 2']);
      planner.approvePlan();
      planner.startExecution();
      planner.updateStep(0, 'done');
      planner.updateStep(1, 'skipped');
      expect(planner.getActivePlan().status).toBe('completed');
    });

    it('returns false when no plan', () => {
      expect(planner.updateStep(0, 'done')).toBe(false);
    });
  });

  describe('formatPlan()', () => {
    it('formats null plan', () => {
      expect(planner.formatPlan(null)).toContain('No active plan');
    });

    it('formats plan with steps', () => {
      const plan = planner.createPlan('Test task', [
        { description: 'Read files', files: ['a.js'] },
        { description: 'Edit code', files: ['b.js', 'c.js'] },
      ]);
      const output = planner.formatPlan(plan);
      expect(output).toContain('Test task');
      expect(output).toContain('Step 1');
      expect(output).toContain('Read files');
      expect(output).toContain('a.js');
    });

    it('shows status icons', () => {
      const plan = planner.createPlan('Test', ['Step 1', 'Step 2', 'Step 3']);
      plan.steps[0].status = 'done';
      plan.steps[1].status = 'in_progress';
      const output = planner.formatPlan(plan);
      expect(output).toContain('✓');
      expect(output).toContain('→');
    });
  });

  describe('savePlan() + loadPlan()', () => {
    it('saves and loads plan', () => {
      const plan = planner.createPlan('Saved plan', ['Step 1']);
      planner.savePlan(plan);

      planner.clearPlan();
      const loaded = planner.loadPlan(plan.name);
      expect(loaded).not.toBeNull();
      expect(loaded.task).toBe('Saved plan');
    });

    it('returns null for non-existent plan', () => {
      expect(planner.loadPlan('nonexistent')).toBeNull();
    });

    it('saves active plan when no arg', () => {
      planner.createPlan('Active plan', ['Step 1']);
      planner.savePlan();
      const plans = planner.listPlans();
      expect(plans.length).toBe(1);
    });

    it('returns null when no active plan and no arg', () => {
      expect(planner.savePlan()).toBeNull();
    });
  });

  describe('listPlans()', () => {
    it('returns empty array when no plans', () => {
      expect(planner.listPlans()).toEqual([]);
    });

    it('lists saved plans', () => {
      planner.createPlan('Plan 1', ['Step 1']);
      planner.savePlan();
      planner.createPlan('Plan 2', ['Step 1', 'Step 2']);
      planner.savePlan();
      const list = planner.listPlans();
      expect(list.length).toBe(2);
    });

    it('includes plan metadata', () => {
      planner.createPlan('Detailed', ['Step 1', 'Step 2']);
      planner.savePlan();
      const list = planner.listPlans();
      expect(list[0]).toHaveProperty('name');
      expect(list[0]).toHaveProperty('task', 'Detailed');
      expect(list[0]).toHaveProperty('steps', 2);
      expect(list[0]).toHaveProperty('status', 'draft');
    });
  });

  describe('clearPlan()', () => {
    it('clears active plan and plan mode', () => {
      planner.createPlan('Test');
      planner.setPlanMode(true);
      planner.clearPlan();
      expect(planner.getActivePlan()).toBeNull();
      expect(planner.isPlanMode()).toBe(false);
    });
  });

  describe('getPlanModePrompt()', () => {
    it('returns plan mode instructions', () => {
      const prompt = planner.getPlanModePrompt();
      expect(prompt).toContain('PLAN MODE');
      expect(prompt).toContain('read');
      expect(prompt).toContain('Do NOT make any file changes');
    });
  });

  describe('autonomy levels', () => {
    it('defaults to interactive', () => {
      expect(planner.getAutonomyLevel()).toBe('interactive');
    });

    it('sets valid levels', () => {
      expect(planner.setAutonomyLevel('semi-auto')).toBe(true);
      expect(planner.getAutonomyLevel()).toBe('semi-auto');
      expect(planner.setAutonomyLevel('autonomous')).toBe(true);
      expect(planner.getAutonomyLevel()).toBe('autonomous');
    });

    it('rejects invalid level', () => {
      expect(planner.setAutonomyLevel('invalid')).toBe(false);
      expect(planner.getAutonomyLevel()).toBe('interactive');
    });

    it('exports AUTONOMY_LEVELS', () => {
      expect(planner.AUTONOMY_LEVELS).toEqual(['interactive', 'semi-auto', 'autonomous']);
    });
  });
});

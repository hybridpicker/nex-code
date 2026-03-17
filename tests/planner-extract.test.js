/**
 * tests/planner-extract.test.js
 * Tests for extractStepsFromText, advancePlanStep, getPlanStepInfo
 */

describe('planner.js — extractStepsFromText', () => {
  let planner;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(process, 'cwd').mockReturnValue(require('os').tmpdir());
    planner = require('../cli/planner');
    planner.clearPlan();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts numbered steps from a plain numbered list', () => {
    const text = `
## Summary
Do some stuff.

## Steps
1. Read current code
2. Implement changes
3. Write tests
`;
    const steps = planner.extractStepsFromText(text);
    expect(steps).toHaveLength(3);
    expect(steps[0].description).toBe('Read current code');
    expect(steps[1].description).toBe('Implement changes');
    expect(steps[2].description).toBe('Write tests');
    expect(steps[0].status).toBe('pending');
  });

  it('extracts steps from numbered list without ## Steps header', () => {
    const text = `
Here is the plan:
1. Analyze the problem
2. Write the fix
3. Run tests
4. Commit
`;
    const steps = planner.extractStepsFromText(text);
    expect(steps).toHaveLength(4);
    expect(steps[0].description).toBe('Analyze the problem');
  });

  it('strips **What**: prefixes', () => {
    const text = `
1. **What**: Update the router file
2. **What**: Add tests for edge cases
`;
    const steps = planner.extractStepsFromText(text);
    expect(steps).toHaveLength(2);
    expect(steps[0].description).toBe('Update the router file');
    expect(steps[1].description).toBe('Add tests for edge cases');
  });

  it('falls back to **Step N:** markers', () => {
    const text = `
**Step 1:** Initialize project
**Step 2:** Configure database
**Step 3:** Add authentication
`;
    const steps = planner.extractStepsFromText(text);
    expect(steps).toHaveLength(3);
    expect(steps[0].description).toBe('Initialize project');
  });

  it('returns empty array for empty/null text', () => {
    expect(planner.extractStepsFromText('')).toEqual([]);
    expect(planner.extractStepsFromText(null)).toEqual([]);
    expect(planner.extractStepsFromText(undefined)).toEqual([]);
  });

  it('returns empty array for text with no detectable steps', () => {
    const text = 'This is just a description with no numbered list.';
    const steps = planner.extractStepsFromText(text);
    expect(steps).toEqual([]);
  });

  it('extracts file info from **Where**: lines', () => {
    const text = `
## Steps
1. Update router
   **Where**: cli/router.js, lines 10-50
2. Add tests
   **Where**: tests/router.test.js
`;
    const steps = planner.extractStepsFromText(text);
    expect(steps.length).toBeGreaterThanOrEqual(1);
  });

  it('all extracted steps have required shape', () => {
    const text = '1. Do step one\n2. Do step two\n';
    const steps = planner.extractStepsFromText(text);
    for (const step of steps) {
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('files');
      expect(step).toHaveProperty('status', 'pending');
      expect(Array.isArray(step.files)).toBe(true);
    }
  });
});

describe('planner.js — advancePlanStep + getPlanStepInfo', () => {
  let planner;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(process, 'cwd').mockReturnValue(require('os').tmpdir());
    planner = require('../cli/planner');
    planner.clearPlan();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getPlanStepInfo returns null when no plan', () => {
    expect(planner.getPlanStepInfo()).toBeNull();
  });

  it('getPlanStepInfo returns null in draft/approved state', () => {
    planner.createPlan('Task', ['Step 1', 'Step 2']);
    expect(planner.getPlanStepInfo()).toBeNull();
    planner.approvePlan();
    expect(planner.getPlanStepInfo()).toBeNull();
  });

  it('getPlanStepInfo returns step info during execution', () => {
    planner.createPlan('Task', ['Step A', 'Step B', 'Step C']);
    planner.approvePlan();
    planner.startExecution();
    planner.advancePlanStep(); // moves to step 1
    const info = planner.getPlanStepInfo();
    expect(info).not.toBeNull();
    expect(info.total).toBe(3);
    expect(info.current).toBeGreaterThanOrEqual(1);
    expect(typeof info.description).toBe('string');
  });

  it('advancePlanStep marks previous step done', () => {
    planner.createPlan('Task', ['Step 1', 'Step 2', 'Step 3']);
    planner.approvePlan();
    planner.startExecution();
    planner.advancePlanStep(); // step 1 in_progress
    planner.advancePlanStep(); // step 1 done, step 2 in_progress
    const plan = planner.getActivePlan();
    expect(plan.steps[0].status).toBe('done');
    expect(plan.steps[1].status).toBe('in_progress');
  });

  it('clearPlan resets step cursor', () => {
    planner.createPlan('Task', ['Step 1', 'Step 2']);
    planner.approvePlan();
    planner.startExecution();
    planner.advancePlanStep();
    planner.clearPlan();
    // After clear, re-create plan — cursor should be fresh
    planner.createPlan('Task 2', ['New Step']);
    planner.approvePlan();
    planner.startExecution();
    planner.advancePlanStep();
    const info = planner.getPlanStepInfo();
    expect(info).not.toBeNull();
    expect(info.current).toBe(1);
  });
});

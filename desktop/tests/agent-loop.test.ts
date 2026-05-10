/**
 * tests/agent-loop.test.ts — Agent Loop State Machine Tests
 *
 * Tests the Plan→Implement→Verify state machine:
 * - Phase transitions and guards
 * - Retry and abort logic
 * - Iteration tracking
 * - Event emission
 */

import {
  AgentLoop,
  AgentPhase,
  AgentState,
  AgentEvent,
  PhaseTransition,
  createAgentLoop,
} from '../src/state/agent-loop';

describe('AgentLoop — Phase transitions', () => {
  let loop: AgentLoop;

  beforeEach(() => {
    loop = createAgentLoop({ maxIterations: 3 });
  });

  // ─── Initial state ─────────────────────────────────────────────────────

  it('should start in IDLE phase', () => {
    expect(loop.getState().phase).toBe('idle');
  });

  it('should have iteration count at 0', () => {
    expect(loop.getState().iteration).toBe(0);
  });

  it('should not be running initially', () => {
    expect(loop.getState().running).toBe(false);
  });

  // ─── IDLE → PLAN ──────────────────────────────────────────────────────

  it('should transition from IDLE to PLAN on start', () => {
    const result = loop.start();
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('plan');
    expect(loop.getState().running).toBe(true);
  });

  it('should not start if already running', () => {
    loop.start();
    const result = loop.start();
    expect(result.success).toBe(false);
    expect(result.error).toContain('already running');
  });

  // ─── PLAN → IMPLEMENT ──────────────────────────────────────────────────

  it('should transition from PLAN to IMPLEMENT', () => {
    loop.start();
    const result = loop.advancePhase('implement');
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('implement');
  });

  it('should not transition to IMPLEMENT from IDLE', () => {
    const result = loop.advancePhase('implement');
    expect(result.success).toBe(false);
    expect(loop.getState().phase).toBe('idle');
  });

  it('should not skip to VERIFY from PLAN', () => {
    loop.start();
    const result = loop.advancePhase('verify');
    expect(result.success).toBe(false);
    expect(loop.getState().phase).toBe('plan');
  });

  // ─── IMPLEMENT → VERIFY ────────────────────────────────────────────────

  it('should transition from IMPLEMENT to VERIFY', () => {
    loop.start();
    loop.advancePhase('implement');
    const result = loop.advancePhase('verify');
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('verify');
  });

  // ─── VERIFY → DONE (or RETRY) ──────────────────────────────────────────

  it('should complete when verify passes', () => {
    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    const result = loop.complete({ passed: 10, failed: 0, total: 10 });
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('done');
    expect(loop.getState().running).toBe(false);
  });

  it('should retry when verify fails and iterations remain', () => {
    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    const result = loop.complete({ passed: 5, failed: 5, total: 10 });
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('plan'); // retries from plan
    expect(loop.getState().iteration).toBe(1);
  });

  it('should abort when max iterations reached', () => {
    // Iteration 0
    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    loop.complete({ passed: 0, failed: 10, total: 10 });
    // Iteration 1
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    loop.complete({ passed: 0, failed: 10, total: 10 });
    // Iteration 2
    loop.advancePhase('implement');
    loop.advancePhase('verify');

    const result = loop.complete({ passed: 0, failed: 10, total: 10 });
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('aborted');
    expect(loop.getState().iteration).toBe(2);
  });

  // ─── ABORT ─────────────────────────────────────────────────────────────

  it('should abort on explicit abort call', () => {
    loop.start();
    const result = loop.abort('User cancelled');
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('aborted');
    expect(loop.getState().running).toBe(false);
    expect(loop.getState().error).toBe('User cancelled');
  });

  it('should abort from any active phase', () => {
    loop.start();
    loop.advancePhase('implement');
    loop.abort('Timeout');
    expect(loop.getState().phase).toBe('aborted');
  });

  // ─── Error handling ────────────────────────────────────────────────────

  it('should transition to ERROR on unrecoverable failure', () => {
    loop.start();
    const result = loop.error('Provider unreachable');
    expect(result.success).toBe(true);
    expect(loop.getState().phase).toBe('error');
    expect(loop.getState().running).toBe(false);
    expect(loop.getState().error).toBe('Provider unreachable');
  });

  // ─── Custom iteration budgets ──────────────────────────────────────────

  it('should respect custom max iterations', () => {
    const customLoop = createAgentLoop({ maxIterations: 1 });
    customLoop.start();
    customLoop.advancePhase('implement');
    customLoop.advancePhase('verify');
    customLoop.complete({ passed: 0, failed: 1, total: 1 });
    // Should be aborted since maxIterations = 1 (iteration 0 was the first)
    expect(customLoop.getState().phase).toBe('aborted');
  });

  it('should allow unlimited iterations when maxIterations is 0', () => {
    const infiniteLoop = createAgentLoop({ maxIterations: 0 });
    infiniteLoop.start();
    infiniteLoop.advancePhase('implement');
    infiniteLoop.advancePhase('verify');
    infiniteLoop.complete({ passed: 0, failed: 10, total: 10 });
    expect(infiniteLoop.getState().phase).toBe('plan'); // retries
    infiniteLoop.advancePhase('implement');
    infiniteLoop.advancePhase('verify');
    infiniteLoop.complete({ passed: 0, failed: 10, total: 10 });
    expect(infiniteLoop.getState().phase).toBe('plan'); // still retrying
  });
});

describe('AgentLoop — Events', () => {
  it('should emit phase transition events', () => {
    const events: AgentEvent[] = [];
    const loop = createAgentLoop({ maxIterations: 3 });

    loop.on('phaseChange', (event) => {
      events.push(event);
    });

    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    loop.complete({ passed: 10, failed: 0, total: 10 });

    expect(events).toHaveLength(4);
    expect(events[0].phase).toBe('plan');
    expect(events[1].phase).toBe('implement');
    expect(events[2].phase).toBe('verify');
    expect(events[3].phase).toBe('done');
  });

  it('should emit error events', () => {
    const errors: AgentEvent[] = [];
    const loop = createAgentLoop({ maxIterations: 3 });

    loop.on('error', (event) => {
      errors.push(event);
    });

    loop.start();
    loop.error('Something broke');

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe('Something broke');
  });

  it('should emit retry events', () => {
    const retries: AgentEvent[] = [];
    const loop = createAgentLoop({ maxIterations: 3 });

    loop.on('retry', (event) => {
      retries.push(event);
    });

    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    loop.complete({ passed: 0, failed: 10, total: 10 });

    expect(retries).toHaveLength(1);
    expect(retries[0].iteration).toBe(1);
  });
});

describe('AgentLoop — Phase data', () => {
  it('should store phase-specific data', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.start();
    loop.setPhaseData({ filesScanned: 42, diff: { added: 10, modified: 5, removed: 2 } });

    expect(loop.getState().phaseData).toEqual({
      filesScanned: 42,
      diff: { added: 10, modified: 5, removed: 2 },
    });

    loop.advancePhase('implement');
    expect(loop.getState().phaseData).toBeNull();

    loop.setPhaseData({ files: [{ name: 'a.ts', progress: 50 }] });
    expect(loop.getState().phaseData).toEqual({
      files: [{ name: 'a.ts', progress: 50 }],
    });
  });

  it('should carry test results in verify phase', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    loop.complete({ passed: 8, failed: 2, total: 10 });

    expect(loop.getState().testResults).toEqual({
      passed: 8,
      failed: 2,
      total: 10,
    });
  });
});

describe('AgentLoop — Reset', () => {
  it('should reset to IDLE', () => {
    const loop = createAgentLoop({ maxIterations: 3 });
    loop.start();
    loop.advancePhase('implement');
    loop.advancePhase('verify');
    loop.complete({ passed: 10, failed: 0, total: 10 });

    loop.reset();
    expect(loop.getState().phase).toBe('idle');
    expect(loop.getState().iteration).toBe(0);
    expect(loop.getState().running).toBe(false);
    expect(loop.getState().error).toBeNull();
    expect(loop.getState().testResults).toBeNull();
    expect(loop.getState().phaseData).toBeNull();
  });
});

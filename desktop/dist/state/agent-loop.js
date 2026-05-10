"use strict";
/**
 * src/state/agent-loop.ts — Agent Loop State Machine
 *
 * Implements the Plan → Implement → Verify execution cycle.
 * Tracks phase transitions, iteration counts, retry logic,
 * and emits events for UI wiring.
 *
 * State machine:
 *   IDLE → PLAN → IMPLEMENT → VERIFY → DONE
 *                              ↓ (fail)  ↓ (max iter)
 *                           PLAN (retry)  ABORTED
 *   Any active → ERROR
 *   Any active → ABORTED
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentLoop = void 0;
exports.createAgentLoop = createAgentLoop;
/** Allowed transitions map: current → [valid next phases] */
const ALLOWED_TRANSITIONS = {
    idle: ['plan'],
    plan: ['implement', 'error', 'aborted', 'done'], // done = skip-to-end for trivial tasks
    implement: ['verify', 'error', 'aborted'],
    verify: ['done', 'plan', 'aborted', 'error'], // plan = retry
    done: [],
    aborted: ['idle'], // only via reset
    error: ['idle'], // only via reset
};
// ─── AgentLoop Class ──────────────────────────────────────────────────────────
class AgentLoop {
    state;
    config;
    listeners;
    constructor(config) {
        this.config = { autoRetry: true, ...config };
        this.listeners = new Map();
        this.state = {
            phase: 'idle',
            iteration: 0,
            running: false,
            error: null,
            testResults: null,
            phaseData: null,
            startedAt: null,
        };
    }
    // ─── Public API ─────────────────────────────────────────────────────────
    /** Get current state snapshot */
    getState() {
        return { ...this.state };
    }
    /** Start the loop: IDLE → PLAN */
    start() {
        if (this.state.running) {
            return { success: false, error: 'Agent loop is already running' };
        }
        return this.transition('plan');
    }
    /** Advance to the next phase: caller specifies target */
    advancePhase(target) {
        const allowed = ALLOWED_TRANSITIONS[this.state.phase];
        if (!allowed.includes(target)) {
            return {
                success: false,
                error: `Cannot transition from ${this.state.phase} to ${target}. Allowed: ${allowed.join(', ')}`,
            };
        }
        const result = this.transition(target);
        // Clear phase data on transition
        if (result.success) {
            this.state.phaseData = null;
        }
        return result;
    }
    /** Complete the verify phase: DONE if pass, retry if fail */
    complete(results) {
        if (this.state.phase !== 'verify') {
            return {
                success: false,
                error: `complete() called from ${this.state.phase}, expected verify`,
            };
        }
        this.state.testResults = results;
        if (results.failed === 0) {
            // All tests pass → DONE
            const result = this.transition('done');
            if (result.success) {
                this.emit('complete', {
                    type: 'complete',
                    phase: 'done',
                    iteration: this.state.iteration,
                    testResults: results,
                    timestamp: Date.now(),
                });
            }
            return result;
        }
        // Tests failed → retry or abort
        const nextIteration = this.state.iteration + 1;
        if (this.config.maxIterations > 0 && nextIteration >= this.config.maxIterations) {
            // Max iterations exhausted
            const result = this.transition('aborted');
            this.state.error = `Max iterations (${this.config.maxIterations}) reached with failing tests`;
            this.state.running = false;
            this.emit('abort', {
                type: 'abort',
                phase: 'aborted',
                iteration: nextIteration,
                testResults: results,
                timestamp: Date.now(),
            });
            return result;
        }
        // Retry: back to plan
        const result = this.transition('plan');
        if (result.success) {
            this.state.iteration = nextIteration;
            this.emit('retry', {
                type: 'retry',
                phase: 'plan',
                iteration: nextIteration,
                testResults: results,
                timestamp: Date.now(),
            });
        }
        return result;
    }
    /** Abort from any active phase */
    abort(reason) {
        if (!this.state.running && this.state.phase === 'idle') {
            return { success: false, error: 'Nothing to abort — loop is idle' };
        }
        const result = this.transition('aborted');
        if (result.success && reason) {
            this.state.error = reason;
        }
        this.emit('abort', {
            type: 'abort',
            phase: 'aborted',
            iteration: this.state.iteration,
            error: reason,
            timestamp: Date.now(),
        });
        return result;
    }
    /** Transition to error state (unrecoverable) */
    error(message) {
        if (!this.state.running && this.state.phase === 'idle') {
            // Allow error from idle (e.g., config validation failure)
            this.state.error = message;
            this.state.phase = 'error';
            return { success: true };
        }
        const result = this.transition('error');
        if (result.success) {
            this.state.error = message;
        }
        this.emit('error', {
            type: 'error',
            phase: 'error',
            iteration: this.state.iteration,
            error: message,
            timestamp: Date.now(),
        });
        return result;
    }
    /** Store phase-specific data (cleared on phase transition) */
    setPhaseData(data) {
        this.state.phaseData = data;
    }
    /** Reset to IDLE */
    reset() {
        this.state = {
            phase: 'idle',
            iteration: 0,
            running: false,
            error: null,
            testResults: null,
            phaseData: null,
            startedAt: null,
        };
    }
    // ─── Event system ───────────────────────────────────────────────────────
    /** Register an event listener */
    on(event, handler) {
        const handlers = this.listeners.get(event) || [];
        handlers.push(handler);
        this.listeners.set(event, handlers);
    }
    /** Remove an event listener */
    off(event, handler) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            this.listeners.set(event, handlers.filter((h) => h !== handler));
        }
    }
    // ─── Private ────────────────────────────────────────────────────────────
    transition(target) {
        const allowed = ALLOWED_TRANSITIONS[this.state.phase];
        if (allowed.length > 0 && !allowed.includes(target)) {
            return {
                success: false,
                error: `Invalid transition: ${this.state.phase} → ${target}`,
            };
        }
        const prevPhase = this.state.phase;
        this.state.phase = target;
        // Running state management
        if (target === 'idle' || target === 'done' || target === 'aborted' || target === 'error') {
            this.state.running = false;
        }
        else {
            this.state.running = true;
        }
        // Track start time on first entry to plan
        if (target === 'plan' && prevPhase === 'idle') {
            this.state.startedAt = Date.now();
        }
        // Emit phase change event (except idle → idle, error → error)
        if (prevPhase !== target || target === 'error') {
            this.emit('phaseChange', {
                type: 'phaseChange',
                phase: target,
                iteration: this.state.iteration,
                timestamp: Date.now(),
            });
        }
        return { success: true };
    }
    emit(eventName, event) {
        const handlers = this.listeners.get(eventName);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(event);
                }
                catch {
                    // Swallow handler errors to prevent cascading
                }
            }
        }
    }
}
exports.AgentLoop = AgentLoop;
// ─── Factory ──────────────────────────────────────────────────────────────────
/** Create a new AgentLoop instance */
function createAgentLoop(config) {
    return new AgentLoop({ maxIterations: 3, ...config });
}
//# sourceMappingURL=agent-loop.js.map
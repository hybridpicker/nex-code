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
/** All valid agent phases */
export type AgentPhase = 'idle' | 'plan' | 'implement' | 'verify' | 'done' | 'aborted' | 'error';
/** Test result shape passed to complete() */
export interface TestResults {
    passed: number;
    failed: number;
    total: number;
}
/** Agent loop configuration */
export interface AgentLoopConfig {
    /** Maximum retry iterations (0 = unlimited) */
    maxIterations: number;
    /** Whether to auto-retry on verify failure */
    autoRetry?: boolean;
}
/** Current agent state snapshot */
export interface AgentState {
    phase: AgentPhase;
    iteration: number;
    running: boolean;
    error: string | null;
    testResults: TestResults | null;
    phaseData: Record<string, unknown> | null;
    startedAt: number | null;
}
/** Event emitted on phase changes */
export interface AgentEvent {
    type: 'phaseChange' | 'retry' | 'error' | 'complete' | 'abort';
    phase: AgentPhase;
    iteration: number;
    error?: string;
    testResults?: TestResults;
    timestamp: number;
}
/** Result of a transition attempt */
export interface PhaseTransition {
    success: boolean;
    error?: string;
}
/** Event handler callback */
export type EventHandler = (event: AgentEvent) => void;
export declare class AgentLoop {
    private state;
    private config;
    private listeners;
    constructor(config: AgentLoopConfig);
    /** Get current state snapshot */
    getState(): Readonly<AgentState>;
    /** Start the loop: IDLE → PLAN */
    start(): PhaseTransition;
    /** Advance to the next phase: caller specifies target */
    advancePhase(target: AgentPhase): PhaseTransition;
    /** Complete the verify phase: DONE if pass, retry if fail */
    complete(results: TestResults): PhaseTransition;
    /** Abort from any active phase */
    abort(reason?: string): PhaseTransition;
    /** Transition to error state (unrecoverable) */
    error(message: string): PhaseTransition;
    /** Store phase-specific data (cleared on phase transition) */
    setPhaseData(data: Record<string, unknown>): void;
    /** Reset to IDLE */
    reset(): void;
    /** Register an event listener */
    on(event: 'phaseChange' | 'retry' | 'error' | 'complete' | 'abort', handler: EventHandler): void;
    /** Remove an event listener */
    off(event: string, handler: EventHandler): void;
    private transition;
    private emit;
}
/** Create a new AgentLoop instance */
export declare function createAgentLoop(config?: Partial<AgentLoopConfig>): AgentLoop;

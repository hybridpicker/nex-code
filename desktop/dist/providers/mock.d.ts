/**
 * src/providers/mock.ts — Mock Provider for Testing
 *
 * Provides a fully controllable LLMProvider implementation for
 * TDD and safe terminal testing. Supports:
 * - Predefined responses per call index
 * - Simulated latency
 * - Simulated errors
 * - Token counting
 * - Call recording for assertions
 */
import type { ProviderId } from '../config/env';
import { LLMProvider, LLMRequest, LLMResponse, LLMStreamChunk, ChatMessage } from './base';
/** Configuration for a single mock response */
export interface MockResponseConfig {
    content: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    finishReason?: 'stop' | 'length' | 'error';
}
/** Error simulation config */
export interface MockErrorConfig {
    message: string;
    code?: string;
    retryable?: boolean;
}
/** Call record for assertion */
export interface MockCallRecord {
    request: LLMRequest;
    timestamp: number;
}
/** MockProvider configuration */
export interface MockProviderConfig {
    id?: ProviderId;
    name?: string;
    /** Predefined responses in order */
    responses?: MockResponseConfig[];
    /** Simulate an error on a specific call index */
    errorOnCall?: Map<number, MockErrorConfig>;
    /** Base latency to add to each call */
    baseLatencyMs?: number;
    /** Whether the provider is available */
    available?: boolean;
}
/**
 * Mock LLM provider for testing.
 * Returns predefined responses and records all calls.
 */
export declare class MockProvider implements LLMProvider {
    readonly id: ProviderId;
    readonly name: string;
    private responses;
    private errorOnCall;
    private baseLatencyMs;
    private _available;
    private callCount;
    private _calls;
    constructor(config?: MockProviderConfig);
    /** Check if the provider is currently available */
    isAvailable(): Promise<boolean>;
    /** Set availability (for testing fallback chains) */
    setAvailable(available: boolean): void;
    /** Non-streaming completion */
    complete(request: LLMRequest): Promise<LLMResponse>;
    /** Streaming completion */
    streamComplete(request: LLMRequest, onChunk: (chunk: LLMStreamChunk) => void): Promise<LLMResponse>;
    /** Rough token estimation (4 chars ≈ 1 token) */
    estimateTokens(messages: ChatMessage[]): number;
    /** Get all recorded calls for assertions */
    get calls(): readonly MockCallRecord[];
    /** Get number of calls made */
    getCallCount(): number;
    /** Reset call history */
    resetCalls(): void;
    /** Add a response to the queue */
    addResponse(response: MockResponseConfig): void;
    /** Set an error for a specific call index */
    setErrorOnCall(callIndex: number, error: MockErrorConfig): void;
    private processCall;
    private delay;
}

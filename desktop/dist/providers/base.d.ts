/**
 * src/providers/base.ts — Base Provider Interface
 *
 * Defines the contract all LLM providers must implement.
 * Used by the routing layer to abstract provider selection.
 */
import type { ProviderId } from '../config/env';
/** A single message in a conversation */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
/** Request to an LLM provider */
export interface LLMRequest {
    messages: ChatMessage[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}
/** Response from an LLM provider */
export interface LLMResponse {
    content: string;
    model: string;
    provider: ProviderId;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    finishReason: 'stop' | 'length' | 'error';
    latencyMs: number;
}
/** Streaming chunk from an LLM provider */
export interface LLMStreamChunk {
    content: string;
    done: boolean;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}
/** Error from a provider call */
export interface ProviderError {
    provider: ProviderId;
    message: string;
    code?: string;
    retryable: boolean;
}
/** Abstract base for all LLM providers */
export interface LLMProvider {
    /** Unique provider identifier */
    readonly id: ProviderId;
    /** Human-readable provider name */
    readonly name: string;
    /** Whether this provider is currently available */
    isAvailable(): Promise<boolean>;
    /** Send a completion request (non-streaming) */
    complete(request: LLMRequest): Promise<LLMResponse>;
    /** Send a completion request (streaming) */
    streamComplete(request: LLMRequest, onChunk: (chunk: LLMStreamChunk) => void): Promise<LLMResponse>;
    /** Estimate token count for messages (rough approximation) */
    estimateTokens(messages: ChatMessage[]): number;
}
/** Result shape from the routing layer */
export interface ProviderCallResult {
    success: boolean;
    response?: LLMResponse;
    error?: ProviderError;
    provider: ProviderId;
    fallbackUsed: boolean;
}

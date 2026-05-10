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
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
  ChatMessage,
} from './base';

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
export class MockProvider implements LLMProvider {
  readonly id: ProviderId;
  readonly name: string;

  private responses: MockResponseConfig[];
  private errorOnCall: Map<number, MockErrorConfig>;
  private baseLatencyMs: number;
  private _available: boolean;
  private callCount: number;
  private _calls: MockCallRecord[];

  constructor(config: MockProviderConfig = {}) {
    this.id = config.id || 'ollama';
    this.name = config.name || 'Mock Provider';
    this.responses = config.responses || [];
    this.errorOnCall = config.errorOnCall || new Map();
    this.baseLatencyMs = config.baseLatencyMs || 10;
    this._available = config.available ?? true;
    this.callCount = 0;
    this._calls = [];
  }

  /** Check if the provider is currently available */
  async isAvailable(): Promise<boolean> {
    return this._available;
  }

  /** Set availability (for testing fallback chains) */
  setAvailable(available: boolean): void {
    this._available = available;
  }

  /** Non-streaming completion */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    return this.processCall(request);
  }

  /** Streaming completion */
  async streamComplete(
    request: LLMRequest,
    onChunk: (chunk: LLMStreamChunk) => void,
  ): Promise<LLMResponse> {
    const response = await this.processCall(request);

    // Simulate streaming by sending the content in chunks
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk: LLMStreamChunk = {
        content: words[i] + (i < words.length - 1 ? ' ' : ''),
        done: i === words.length - 1,
      };
      if (chunk.done) {
        chunk.usage = response.usage;
      }
      onChunk(chunk);
      await this.delay(5);
    }

    return response;
  }

  /** Rough token estimation (4 chars ≈ 1 token) */
  estimateTokens(messages: ChatMessage[]): number {
    return messages.reduce(
      (total, m) => total + Math.ceil(m.content.length / 4),
      0,
    );
  }

  /** Get all recorded calls for assertions */
  get calls(): readonly MockCallRecord[] {
    return this._calls;
  }

  /** Get number of calls made */
  getCallCount(): number {
    return this.callCount;
  }

  /** Reset call history */
  resetCalls(): void {
    this._calls = [];
    this.callCount = 0;
  }

  /** Add a response to the queue */
  addResponse(response: MockResponseConfig): void {
    this.responses.push(response);
  }

  /** Set an error for a specific call index */
  setErrorOnCall(callIndex: number, error: MockErrorConfig): void {
    this.errorOnCall.set(callIndex, error);
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async processCall(request: LLMRequest): Promise<LLMResponse> {
    const callIndex = this.callCount;
    this._calls.push({ request, timestamp: Date.now() });

    // Check for simulated error
    const errorConfig = this.errorOnCall.get(callIndex);
    if (errorConfig) {
      this.callCount++;
      throw Object.assign(new Error(errorConfig.message), {
        provider: this.id,
        code: errorConfig.code,
        retryable: errorConfig.retryable ?? true,
      });
    }

    // Get response config
    const responseConfig = this.responses[callIndex] || this.responses[this.responses.length - 1];

    if (!responseConfig) {
      // Default fallback response
      const content = `Mock response for: "${request.messages[request.messages.length - 1]?.content.slice(0, 100)}"`;
      this.callCount++;
      await this.delay(this.baseLatencyMs);
      return {
        content,
        model: request.model || 'mock-model',
        provider: this.id,
        usage: {
          inputTokens: this.estimateTokens(request.messages),
          outputTokens: Math.ceil(content.length / 4),
        },
        finishReason: 'stop',
        latencyMs: this.baseLatencyMs,
      };
    }

    this.callCount++;
    await this.delay(responseConfig.latencyMs || this.baseLatencyMs);

    return {
      content: responseConfig.content,
      model: responseConfig.model || request.model || 'mock-model',
      provider: this.id,
      usage: {
        inputTokens: responseConfig.inputTokens || this.estimateTokens(request.messages),
        outputTokens: responseConfig.outputTokens || Math.ceil(responseConfig.content.length / 4),
      },
      finishReason: responseConfig.finishReason || 'stop',
      latencyMs: responseConfig.latencyMs || this.baseLatencyMs,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

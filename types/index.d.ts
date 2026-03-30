/**
 * types/index.d.ts — Core Type Definitions for nex-code
 * Shared interfaces used across the codebase.
 */

// ─── Messages ───────────────────────────────────────────────

/** Normalized message format (provider-agnostic). */
export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentBlock {
  type: "text" | "image" | "tool_result";
  text?: string;
  data?: string;
  media_type?: string;
  tool_use_id?: string;
  content?: string;
}

// ─── Tool Calls ─────────────────────────────────────────────

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

/** Normalized response from any provider. */
export interface ChatResponse {
  content: string;
  tool_calls: ToolCall[];
}

// ─── Tool Definitions ───────────────────────────────────────

/** OpenAI/Ollama-format tool definition (normalized format). */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

/** Anthropic-format tool definition. */
export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
}

// ─── Provider ───────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  maxTokens: number;
  contextWindow: number;
}

export interface ProviderConfig {
  name: string;
  baseUrl?: string;
  models?: Record<string, ModelInfo>;
  defaultModel?: string;
  timeout?: number;
  temperature?: number;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  onThinkingToken?: (token: string) => void;
  repeat_penalty?: number;
}

/** Abstract provider interface. */
export interface IProvider {
  name: string;
  baseUrl: string;
  models: Record<string, ModelInfo>;
  defaultModel: string | null;

  isConfigured(): boolean;
  getApiKey(): string | null;
  getModels(): Record<string, ModelInfo>;
  getModelNames(): string[];
  getModel(modelId: string): ModelInfo | null;
  chat(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;
  stream(
    messages: Message[],
    tools: ToolDefinition[],
    options?: ChatOptions,
  ): Promise<ChatResponse>;
  formatMessages(messages: Message[]): {
    messages: unknown[];
    system?: string;
  };
  formatTools(tools: ToolDefinition[]): unknown[];
  normalizeResponse(raw: unknown): ChatResponse;
}

// ─── Wire Protocol ──────────────────────────────────────────

export interface RequestBodyParams {
  model: string;
  messages: unknown[];
  tools: unknown[];
  maxTokens: number;
  temperature: number;
  stream: boolean;
  extra?: Record<string, unknown>;
}

export interface StreamParseResult {
  done: boolean;
  result?: ChatResponse;
}

export interface IWireProtocol {
  getEndpoint(): string;
  buildRequestBody(params: RequestBodyParams): Record<string, unknown>;
  formatTools(tools: ToolDefinition[]): unknown[];
  normalizeResponse(raw: unknown): ChatResponse;
  createStreamParser(
    onToken: (token: string) => void,
    callbacks?: Record<string, Function>,
  ): IStreamParser;
}

export interface IStreamParser {
  feed(chunk: string): StreamParseResult;
  flush(): ChatResponse;
}

// ─── Session ────────────────────────────────────────────────

export interface Session {
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: string | null;
  provider: string | null;
  messages: Message[];
  score?: number;
  scoreGrade?: string;
  scoreIssues?: string[];
  tree?: SessionTree;
}

export interface SessionTree {
  branches: Record<string, SessionBranch>;
  activeBranch: string;
}

export interface SessionBranch {
  messages: Message[];
  parentBranch: string | null;
  forkIndex: number;
}

// ─── Skills ─────────────────────────────────────────────────

export interface SkillCommand {
  cmd: string;
  desc?: string;
  description?: string;
  handler?: (args: string) => unknown;
}

export interface SkillTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
  execute?: (args: Record<string, unknown>) => Promise<string | unknown>;
}

export interface ScriptSkill {
  name: string;
  description?: string;
  instructions?: string;
  commands?: SkillCommand[];
  tools?: SkillTool[];
}

export interface LoadedSkill {
  name: string;
  type: "prompt" | "script";
  filePath: string;
  description?: string;
  instructions?: string;
  triggers?: string[];
  enabled: boolean;
  commands: SkillCommand[];
  tools: SkillTool[];
}

// ─── Memory ─────────────────────────────────────────────────

export interface MemoryEntry {
  key: string;
  value: string;
  type?: "user" | "feedback" | "project" | "reference";
  timestamp?: string;
}

// ─── Benchmark ──────────────────────────────────────────────

export interface BenchmarkResult {
  model: string;
  score: number;
  latency: number;
  category: string;
  tasks: number;
}

export interface ModelRouting {
  coding?: string;
  frontend?: string;
  sysadmin?: string;
  data?: string;
  agentic?: string;
  phases?: {
    plan?: string;
    implement?: string;
    verify?: string;
  };
}

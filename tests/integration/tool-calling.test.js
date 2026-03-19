/**
 * tests/integration/tool-calling.test.js — Tool Calling Integration Tests
 * Verifies tool call format normalization across different provider formats.
 */

jest.mock('../../cli/tools', () => ({
  TOOL_DEFINITIONS: [
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'bash',
        description: 'Execute a bash command',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The bash command' },
          },
          required: ['command'],
        },
      },
    },
  ],
}));

jest.mock('../../cli/skills', () => ({
  getSkillToolDefinitions: jest.fn().mockReturnValue([]),
}));

jest.mock('../../cli/mcp', () => ({
  getMCPToolDefinitions: jest.fn().mockReturnValue([]),
}));

const { validateToolCallFormat, validateToolArgs } = require('../../cli/tool-validator');

describe('Tool Calling Integration', () => {
  test('OpenAI string arguments are parsed', () => {
    const toolCall = {
      function: {
        name: 'read_file',
        arguments: '{"path": "/tmp/test.js"}',
      },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall, 'openai');
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(normalized.function.arguments).toEqual({ path: '/tmp/test.js' });

    // Verify parsed args also pass schema validation
    const validation = validateToolArgs('read_file', normalized.function.arguments);
    expect(validation.valid).toBe(true);
  });

  test('Gemini args field is normalized to arguments', () => {
    const toolCall = {
      function: {
        name: 'bash',
        args: { command: 'ls -la' },
      },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall, 'gemini');
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(normalized.function.arguments).toEqual({ command: 'ls -la' });
    expect(normalized.function.args).toBeUndefined();

    // Verify normalized args pass schema validation
    const validation = validateToolArgs('bash', normalized.function.arguments);
    expect(validation.valid).toBe(true);
  });

  test('missing arguments defaults to empty object', () => {
    const toolCall = {
      function: {
        name: 'read_file',
      },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(normalized.function.arguments).toEqual({});
  });

  test('invalid JSON arguments returns error', () => {
    const toolCall = {
      function: {
        name: 'read_file',
        arguments: '{path: /tmp/test.js}',
      },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall, 'ollama');
    expect(valid).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Invalid JSON');
    expect(errors[0]).toContain('ollama');
  });

  test('flat format (name + args) is normalized to nested function format', () => {
    const toolCall = {
      name: 'read_file',
      args: { path: '/tmp/test.js' },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall, 'gemini');
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(normalized.function.name).toBe('read_file');
    expect(normalized.function.arguments).toEqual({ path: '/tmp/test.js' });
  });

  test('empty string arguments are normalized to empty object', () => {
    const toolCall = {
      function: {
        name: 'bash',
        arguments: '  ',
      },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall);
    expect(valid).toBe(true);
    expect(normalized.function.arguments).toEqual({});
  });

  test('null arguments are normalized to empty object', () => {
    const toolCall = {
      function: {
        name: 'bash',
        arguments: null,
      },
    };

    const { valid, normalized, errors } = validateToolCallFormat(toolCall);
    expect(valid).toBe(true);
    expect(normalized.function.arguments).toEqual({});
  });

  test('tool call with no function or name field fails', () => {
    const toolCall = { id: 'call_123' };

    const { valid, errors } = validateToolCallFormat(toolCall);
    expect(valid).toBe(false);
    expect(errors[0]).toContain('missing both');
  });

  test('full pipeline: OpenAI string args -> normalize -> validate schema', () => {
    const toolCall = {
      id: 'call_abc',
      type: 'function',
      function: {
        name: 'bash',
        arguments: '{"command": "echo hello"}',
      },
    };

    // Step 1: Normalize format
    const { valid, normalized } = validateToolCallFormat(toolCall, 'openai');
    expect(valid).toBe(true);

    // Step 2: Validate against schema
    const validation = validateToolArgs(
      normalized.function.name,
      normalized.function.arguments,
    );
    expect(validation.valid).toBe(true);
  });
});

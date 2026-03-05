/**
 * tests/tool-validator.test.js — Tool Argument Validation
 */

jest.mock('../cli/tools', () => ({
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
            line_start: { type: 'number', description: 'Start line' },
            line_end: { type: 'number', description: 'End line' },
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
    {
      type: 'function',
      function: {
        name: 'edit_file',
        description: 'Edit a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            old_text: { type: 'string', description: 'Text to find' },
            new_text: { type: 'string', description: 'Replacement text' },
          },
          required: ['path', 'old_text', 'new_text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'grep',
        description: 'Search files',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'Search path' },
            ignore_case: { type: 'boolean', description: 'Case insensitive' },
          },
          required: ['pattern'],
        },
      },
    },
  ],
}));

jest.mock('../cli/skills', () => ({
  getSkillToolDefinitions: jest.fn().mockReturnValue([]),
}));

jest.mock('../cli/mcp', () => ({
  getMCPToolDefinitions: jest.fn().mockReturnValue([]),
}));

const { validateToolArgs, closestMatch, levenshtein } = require('../cli/tool-validator');

describe('levenshtein()', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns correct distance for substitution', () => {
    expect(levenshtein('cat', 'bat')).toBe(1);
  });

  it('returns correct distance for insertion/deletion', () => {
    expect(levenshtein('path', 'paths')).toBe(1);
    expect(levenshtein('file', 'fil')).toBe(1);
  });

  it('handles complex cases', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('closestMatch()', () => {
  const candidates = ['path', 'command', 'pattern', 'content', 'old_text'];

  it('finds exact match (distance 0)', () => {
    expect(closestMatch('path', candidates)).toBe('path');
  });

  it('finds close match', () => {
    expect(closestMatch('pth', candidates)).toBe('path');
  });

  it('finds "file" → "path" is too far, returns null', () => {
    // "file" is length 4, max distance = 2, levenshtein("file","path") = 4
    expect(closestMatch('file', candidates)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(closestMatch(null, candidates)).toBeNull();
  });

  it('returns null for empty candidates', () => {
    expect(closestMatch('test', [])).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(closestMatch('PATH', candidates)).toBe('path');
  });
});

describe('validateToolArgs()', () => {
  describe('valid arguments', () => {
    it('accepts correct arguments', () => {
      const result = validateToolArgs('read_file', { path: 'test.js' });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeNull();
    });

    it('accepts arguments with optional fields', () => {
      const result = validateToolArgs('read_file', { path: 'test.js', line_start: 1, line_end: 10 });
      expect(result.valid).toBe(true);
    });

    it('returns valid for tool without schema', () => {
      // Temporarily add a tool with no parameters schema (push/pop to keep same array ref)
      const tools = require('../cli/tools');
      const validator = require('../cli/tool-validator');
      
      tools.TOOL_DEFINITIONS.push({
        type: 'function',
        function: { name: 'no_schema', description: 'test' },
      });
      // Clear schema cache so new tool is picked up
      validator.clearSchemaCache();

      const result = validator.validateToolArgs('no_schema', { anything: true });
      expect(result.valid).toBe(true);

      tools.TOOL_DEFINITIONS.pop();
      validator.clearSchemaCache();
    });
  });

  describe('unknown tool', () => {
    it('rejects unknown tool with suggestion', () => {
      const result = validateToolArgs('read_fle', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown tool');
      expect(result.error).toContain('Did you mean "read_file"');
    });

    it('rejects unknown tool without suggestion for distant names', () => {
      const result = validateToolArgs('xxxxxxxx', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown tool');
      expect(result.error).toContain('Available tools');
    });
  });

  describe('missing required parameters', () => {
    it('reports missing required parameter', () => {
      const result = validateToolArgs('bash', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required parameter "command"');
    });

    it('reports multiple missing params', () => {
      const result = validateToolArgs('edit_file', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required parameter "path"');
      expect(result.error).toContain('Missing required parameter "old_text"');
      expect(result.error).toContain('Missing required parameter "new_text"');
    });
  });

  describe('auto-correction', () => {
    it('auto-corrects similar key names for required params', () => {
      // "pth" → "path"
      const result = validateToolArgs('read_file', { pth: 'test.js' });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeDefined();
      expect(result.corrected.path).toBe('test.js');
      expect(result.corrected.pth).toBeUndefined();
    });

    it('auto-corrects unknown keys to expected keys', () => {
      const result = validateToolArgs('bash', { cmd: 'ls' });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeDefined();
      expect(result.corrected.command).toBe('ls');
    });

    it('converts number to string when schema expects string', () => {
      const result = validateToolArgs('read_file', { path: 123 });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeDefined();
      expect(result.corrected.path).toBe('123');
    });

    it('converts string number to number when schema expects number', () => {
      const result = validateToolArgs('read_file', { path: 'test.js', line_start: '5' });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeDefined();
      expect(result.corrected.line_start).toBe(5);
    });

    it('converts string boolean to boolean', () => {
      const result = validateToolArgs('grep', { pattern: 'test', ignore_case: 'true' });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeDefined();
      expect(result.corrected.ignore_case).toBe(true);
    });

    it('converts "false" string to boolean false', () => {
      const result = validateToolArgs('grep', { pattern: 'test', ignore_case: 'false' });
      expect(result.valid).toBe(true);
      expect(result.corrected).toBeDefined();
      expect(result.corrected.ignore_case).toBe(false);
    });
  });

  describe('error messages', () => {
    it('includes expected parameters in error', () => {
      const result = validateToolArgs('bash', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected parameters');
    });

    it('suggests correct parameter name for unknown key', () => {
      // "commnd" → "command" (close enough for suggestion)
      const result = validateToolArgs('bash', { commnd: 'ls' });
      // Should auto-correct since it's close enough
      expect(result.valid).toBe(true);
      expect(result.corrected.command).toBe('ls');
    });
  });
});

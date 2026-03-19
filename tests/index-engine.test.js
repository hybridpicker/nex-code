const { extractDefinitions } = require('../cli/index-engine');

describe('Content Index', () => {
  describe('extractDefinitions', () => {
    test('extracts JS function declarations', () => {
      const code = 'function hello() {}\nasync function world() {}';
      const defs = extractDefinitions(code, '.js');
      expect(defs).toContainEqual({ type: 'function', name: 'hello', line: 1 });
      expect(defs).toContainEqual({ type: 'function', name: 'world', line: 2 });
    });

    test('extracts JS class declarations', () => {
      const code = 'class Foo extends Bar {}';
      const defs = extractDefinitions(code, '.js');
      expect(defs).toContainEqual({ type: 'class', name: 'Foo', line: 1 });
    });

    test('extracts arrow functions', () => {
      const code = 'const greet = (name) => name;';
      const defs = extractDefinitions(code, '.js');
      expect(defs).toContainEqual({ type: 'function', name: 'greet', line: 1 });
    });

    test('extracts Python functions', () => {
      const code = 'def hello():\n    pass\nasync def world():\n    pass';
      const defs = extractDefinitions(code, '.py');
      expect(defs).toContainEqual({ type: 'function', name: 'hello', line: 1 });
      expect(defs).toContainEqual({ type: 'function', name: 'world', line: 3 });
    });

    test('extracts Go functions', () => {
      const code = 'func main() {\n}\nfunc (s *Server) Start() {';
      const defs = extractDefinitions(code, '.go');
      expect(defs).toContainEqual({ type: 'function', name: 'main', line: 1 });
      expect(defs).toContainEqual({ type: 'function', name: 'Start', line: 3 });
    });

    test('extracts imports', () => {
      const code = "const fs = require('fs');\nconst { foo } = require('./bar');";
      const defs = extractDefinitions(code, '.js');
      expect(defs.filter(d => d.type === 'import')).toHaveLength(2);
    });

    test('returns empty for non-code files', () => {
      const defs = extractDefinitions('hello world', '.txt');
      expect(defs).toEqual([]);
    });
  });
});

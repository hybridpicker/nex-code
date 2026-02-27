/**
 * tests/skills.test.js — Skills System Tests
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;

beforeEach(() => {
  jest.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-skills-'));
  jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
});

afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getSkills() {
  return require('../cli/skills');
}

function mkSkillsDir() {
  const dir = path.join(tmpDir, '.nex', 'skills');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function mkConfig(config) {
  const dir = path.join(tmpDir, '.nex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2));
}

describe('skills.js', () => {
  // ─── initSkillsDir ─────────────────────────────────────
  describe('initSkillsDir()', () => {
    it('creates .nex/skills/ directory', () => {
      const skills = getSkills();
      const dir = skills.initSkillsDir();
      expect(fs.existsSync(dir)).toBe(true);
      expect(dir).toBe(path.join(tmpDir, '.nex', 'skills'));
    });

    it('is idempotent (no error if dir exists)', () => {
      const skills = getSkills();
      skills.initSkillsDir();
      skills.initSkillsDir();
      expect(fs.existsSync(path.join(tmpDir, '.nex', 'skills'))).toBe(true);
    });
  });

  // ─── loadAllSkills ─────────────────────────────────────
  describe('loadAllSkills()', () => {
    it('returns empty array when .nex/skills/ does not exist', () => {
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toEqual([]);
    });

    it('returns empty array when .nex/skills/ is empty', () => {
      mkSkillsDir();
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toEqual([]);
    });

    it('loads .md files as prompt skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'code-style.md'), '# Code Style\nAlways use semicolons.');
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('code-style');
      expect(result[0].type).toBe('prompt');
      expect(result[0].instructions).toContain('Always use semicolons');
      expect(result[0].enabled).toBe(true);
    });

    it('loads .js files as script skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          description: 'Deployment helper',
          instructions: 'Always run tests before deploying.',
          commands: [
            { cmd: '/deploy', desc: 'Run deployment', handler: () => {} }
          ],
          tools: [
            {
              type: 'function',
              function: { name: 'deploy_status', description: 'Check deploy status', parameters: { type: 'object', properties: {} } },
              execute: async () => 'deployed'
            }
          ]
        };
      `);
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('deploy');
      expect(result[0].type).toBe('script');
      expect(result[0].commands).toHaveLength(1);
      expect(result[0].tools).toHaveLength(1);
      expect(result[0].enabled).toBe(true);
    });

    it('ignores non .md/.js files', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'readme.txt'), 'ignore me');
      fs.writeFileSync(path.join(dir, 'data.json'), '{}');
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toEqual([]);
    });

    it('ignores empty .md files', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'empty.md'), '');
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toEqual([]);
    });

    it('ignores directories', () => {
      const dir = mkSkillsDir();
      fs.mkdirSync(path.join(dir, 'subdir'));
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toEqual([]);
    });

    it('loads multiple skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'a-style.md'), 'Style rules');
      fs.writeFileSync(path.join(dir, 'b-deploy.md'), 'Deploy rules');
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toHaveLength(2);
    });

    it('respects disabled list from config', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'code-style.md'), 'Style rules');
      mkConfig({ skills: { disabled: ['code-style'] } });
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toHaveLength(1);
      expect(result[0].enabled).toBe(false);
    });

    it('handles malformed .js skills gracefully', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'broken.js'), 'this is not valid JS {{{{');
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const skills = getSkills();
      const result = skills.loadAllSkills();
      expect(result).toEqual([]);
      errSpy.mockRestore();
    });

    it('clears previous skills on reload', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'first.md'), 'First');
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getLoadedSkills()).toHaveLength(1);

      // Remove the file and reload
      fs.unlinkSync(path.join(dir, 'first.md'));
      skills.loadAllSkills();
      expect(skills.getLoadedSkills()).toHaveLength(0);
    });
  });

  // ─── getSkillInstructions ──────────────────────────────
  describe('getSkillInstructions()', () => {
    it('returns empty string when no skills', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getSkillInstructions()).toBe('');
    });

    it('returns formatted instructions from prompt skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Use tabs not spaces');
      const skills = getSkills();
      skills.loadAllSkills();
      const result = skills.getSkillInstructions();
      expect(result).toContain('SKILL INSTRUCTIONS:');
      expect(result).toContain('[Skill: style]');
      expect(result).toContain('Use tabs not spaces');
    });

    it('combines instructions from multiple skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'a.md'), 'Rule A');
      fs.writeFileSync(path.join(dir, 'b.md'), 'Rule B');
      const skills = getSkills();
      skills.loadAllSkills();
      const result = skills.getSkillInstructions();
      expect(result).toContain('Rule A');
      expect(result).toContain('Rule B');
    });

    it('excludes disabled skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Disabled content');
      mkConfig({ skills: { disabled: ['style'] } });
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getSkillInstructions()).toBe('');
    });

    it('includes instructions from script skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'helper.js'), `
        module.exports = {
          name: 'helper',
          instructions: 'Always use helper patterns'
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const result = skills.getSkillInstructions();
      expect(result).toContain('Always use helper patterns');
    });
  });

  // ─── getSkillCommands ──────────────────────────────────
  describe('getSkillCommands()', () => {
    it('returns empty array when no skills', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getSkillCommands()).toEqual([]);
    });

    it('returns commands from script skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          commands: [
            { cmd: '/deploy', desc: 'Run deploy', handler: () => {} },
            { cmd: '/rollback', desc: 'Rollback', handler: () => {} }
          ]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const cmds = skills.getSkillCommands();
      expect(cmds).toHaveLength(2);
      expect(cmds[0].cmd).toBe('/deploy');
      expect(cmds[1].cmd).toBe('/rollback');
    });

    it('excludes commands from disabled skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          commands: [{ cmd: '/deploy', desc: 'Deploy', handler: () => {} }]
        };
      `);
      mkConfig({ skills: { disabled: ['deploy'] } });
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getSkillCommands()).toEqual([]);
    });

    it('auto-prefixes / to commands without it', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'test.js'), `
        module.exports = {
          name: 'test',
          commands: [{ cmd: 'mytest', desc: 'Run test', handler: () => {} }]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const cmds = skills.getSkillCommands();
      expect(cmds[0].cmd).toBe('/mytest');
    });
  });

  // ─── getSkillToolDefinitions ───────────────────────────
  describe('getSkillToolDefinitions()', () => {
    it('returns empty array when no skills', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getSkillToolDefinitions()).toEqual([]);
    });

    it('returns tool definitions with skill_ prefix', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          tools: [{
            type: 'function',
            function: { name: 'deploy_status', description: 'Check status', parameters: { type: 'object', properties: {} } },
            execute: async () => 'ok'
          }]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const defs = skills.getSkillToolDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].type).toBe('function');
      expect(defs[0].function.name).toBe('skill_deploy_status');
      expect(defs[0].function.description).toContain('[Skill:deploy]');
    });

    it('excludes tools from disabled skills', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          tools: [{
            type: 'function',
            function: { name: 'deploy_status', description: 'Check status', parameters: { type: 'object', properties: {} } },
            execute: async () => 'ok'
          }]
        };
      `);
      mkConfig({ skills: { disabled: ['deploy'] } });
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getSkillToolDefinitions()).toEqual([]);
    });
  });

  // ─── routeSkillCall ────────────────────────────────────
  describe('routeSkillCall()', () => {
    it('returns null for non-skill_ function names', async () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(await skills.routeSkillCall('bash', {})).toBeNull();
      expect(await skills.routeSkillCall('mcp_server_tool', {})).toBeNull();
    });

    it('routes skill_ calls to correct execute function', async () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          tools: [{
            type: 'function',
            function: { name: 'check', description: 'Check', parameters: { type: 'object', properties: {} } },
            execute: async (args) => 'status: ' + (args.env || 'prod')
          }]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const result = await skills.routeSkillCall('skill_check', { env: 'staging' });
      expect(result).toBe('status: staging');
    });

    it('returns error string when tool not found', async () => {
      const skills = getSkills();
      skills.loadAllSkills();
      const result = await skills.routeSkillCall('skill_nonexistent', {});
      expect(result).toContain('ERROR');
      expect(result).toContain('not found');
    });

    it('handles execute errors gracefully', async () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'broken.js'), `
        module.exports = {
          name: 'broken',
          tools: [{
            type: 'function',
            function: { name: 'fail', description: 'Fail', parameters: { type: 'object', properties: {} } },
            execute: async () => { throw new Error('kaboom'); }
          }]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const result = await skills.routeSkillCall('skill_fail', {});
      expect(result).toContain('ERROR');
      expect(result).toContain('kaboom');
    });

    it('converts non-string results to JSON', async () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'json.js'), `
        module.exports = {
          name: 'json',
          tools: [{
            type: 'function',
            function: { name: 'data', description: 'Data', parameters: { type: 'object', properties: {} } },
            execute: async () => ({ key: 'value' })
          }]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const result = await skills.routeSkillCall('skill_data', {});
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('skips disabled skill tools', async () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          tools: [{
            type: 'function',
            function: { name: 'check', description: 'Check', parameters: { type: 'object', properties: {} } },
            execute: async () => 'ok'
          }]
        };
      `);
      mkConfig({ skills: { disabled: ['deploy'] } });
      const skills = getSkills();
      skills.loadAllSkills();
      const result = await skills.routeSkillCall('skill_check', {});
      expect(result).toContain('not found');
    });
  });

  // ─── handleSkillCommand ────────────────────────────────
  describe('handleSkillCommand()', () => {
    it('returns false when no matching command', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.handleSkillCommand('/unknown')).toBe(false);
    });

    it('executes matching command handler', () => {
      const dir = mkSkillsDir();
      const handlerResult = [];
      // We need to write a skill that has a handler.
      // Since the handler is a function, we need to test this differently.
      fs.writeFileSync(path.join(dir, 'test-cmd.js'), `
        const results = [];
        module.exports = {
          name: 'test-cmd',
          commands: [{
            cmd: '/testcmd',
            desc: 'Test command',
            handler: (args) => { console.log('SKILL_CMD:' + args); }
          }]
        };
      `);
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const skills = getSkills();
      skills.loadAllSkills();
      const result = skills.handleSkillCommand('/testcmd hello world');
      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('SKILL_CMD:hello world');
      logSpy.mockRestore();
    });

    it('handles command handler errors', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'err-cmd.js'), `
        module.exports = {
          name: 'err-cmd',
          commands: [{
            cmd: '/errcmd',
            desc: 'Error command',
            handler: () => { throw new Error('handler failed'); }
          }]
        };
      `);
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const skills = getSkills();
      skills.loadAllSkills();
      const result = skills.handleSkillCommand('/errcmd');
      expect(result).toBe(true);
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it('skips disabled skill commands', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'disabled-cmd.js'), `
        module.exports = {
          name: 'disabled-cmd',
          commands: [{
            cmd: '/disabled',
            desc: 'Disabled',
            handler: () => console.log('should not run')
          }]
        };
      `);
      mkConfig({ skills: { disabled: ['disabled-cmd'] } });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const skills = getSkills();
      skills.loadAllSkills();
      const result = skills.handleSkillCommand('/disabled');
      expect(result).toBe(false);
      logSpy.mockRestore();
    });
  });

  // ─── listSkills ────────────────────────────────────────
  describe('listSkills()', () => {
    it('returns empty array when no skills', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.listSkills()).toEqual([]);
    });

    it('returns skill info objects', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Use tabs');
      fs.writeFileSync(path.join(dir, 'deploy.js'), `
        module.exports = {
          name: 'deploy',
          description: 'Deploy helper',
          commands: [{ cmd: '/deploy', desc: 'Deploy', handler: () => {} }],
          tools: [{
            type: 'function',
            function: { name: 'status', description: 'Status', parameters: { type: 'object', properties: {} } },
            execute: async () => 'ok'
          }]
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      const list = skills.listSkills();
      expect(list).toHaveLength(2);

      const style = list.find((s) => s.name === 'style');
      expect(style.type).toBe('prompt');
      expect(style.enabled).toBe(true);
      expect(style.commands).toBe(0);
      expect(style.tools).toBe(0);

      const deploy = list.find((s) => s.name === 'deploy');
      expect(deploy.type).toBe('script');
      expect(deploy.enabled).toBe(true);
      expect(deploy.commands).toBe(1);
      expect(deploy.tools).toBe(1);
    });
  });

  // ─── enableSkill / disableSkill ────────────────────────
  describe('enableSkill() / disableSkill()', () => {
    it('disableSkill returns false for unknown skill', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.disableSkill('nonexistent')).toBe(false);
    });

    it('enableSkill returns false for unknown skill', () => {
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.enableSkill('nonexistent')).toBe(false);
    });

    it('disableSkill disables a loaded skill', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Rules');
      const nexDir = path.join(tmpDir, '.nex');
      fs.writeFileSync(path.join(nexDir, 'config.json'), '{}');
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getLoadedSkills()[0].enabled).toBe(true);

      const result = skills.disableSkill('style');
      expect(result).toBe(true);
      expect(skills.getLoadedSkills()[0].enabled).toBe(false);

      // Verify persisted to config
      const config = JSON.parse(fs.readFileSync(path.join(nexDir, 'config.json'), 'utf-8'));
      expect(config.skills.disabled).toContain('style');
    });

    it('enableSkill enables a disabled skill', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Rules');
      mkConfig({ skills: { disabled: ['style'] } });
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getLoadedSkills()[0].enabled).toBe(false);

      const result = skills.enableSkill('style');
      expect(result).toBe(true);
      expect(skills.getLoadedSkills()[0].enabled).toBe(true);

      // Verify persisted to config
      const nexDir = path.join(tmpDir, '.nex');
      const config = JSON.parse(fs.readFileSync(path.join(nexDir, 'config.json'), 'utf-8'));
      expect(config.skills.disabled).not.toContain('style');
    });

    it('disableSkill is idempotent', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Rules');
      mkConfig({});
      const skills = getSkills();
      skills.loadAllSkills();
      skills.disableSkill('style');
      skills.disableSkill('style');
      const nexDir = path.join(tmpDir, '.nex');
      const config = JSON.parse(fs.readFileSync(path.join(nexDir, 'config.json'), 'utf-8'));
      expect(config.skills.disabled.filter((n) => n === 'style')).toHaveLength(1);
    });
  });

  // ─── Validation ────────────────────────────────────────
  describe('_validateScriptSkill()', () => {
    it('accepts minimal valid skill', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({}, 'test.js');
      expect(valid).toBe(true);
      expect(errors).toEqual([]);
    });

    it('accepts full valid skill', () => {
      const skills = getSkills();
      const { valid } = skills._validateScriptSkill({
        name: 'test',
        description: 'Test',
        instructions: 'Do stuff',
        commands: [{ cmd: '/test', handler: () => {} }],
        tools: [{
          function: { name: 'test_tool', description: 'Test tool' },
          execute: async () => 'ok',
        }],
      }, 'test.js');
      expect(valid).toBe(true);
    });

    it('rejects non-object module', () => {
      const skills = getSkills();
      const { valid } = skills._validateScriptSkill(null, 'test.js');
      expect(valid).toBe(false);
    });

    it('rejects non-string name', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({ name: 123 }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('name');
    });

    it('rejects non-array commands', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({ commands: 'not-array' }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('commands');
    });

    it('rejects command without cmd', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({ commands: [{ handler: () => {} }] }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('cmd');
    });

    it('rejects non-function handler', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({
        commands: [{ cmd: '/test', handler: 'not a function' }],
      }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('handler');
    });

    it('rejects non-array tools', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({ tools: 'not-array' }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('tools');
    });

    it('rejects tool without function.name', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({
        tools: [{ function: {} }],
      }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('function.name');
    });

    it('rejects non-function execute', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({
        tools: [{ function: { name: 'test' }, execute: 'not a function' }],
      }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('execute');
    });

    it('rejects non-string instructions', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({ instructions: 42 }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('instructions');
    });

    it('rejects non-string description', () => {
      const skills = getSkills();
      const { valid, errors } = skills._validateScriptSkill({ description: [] }, 'test.js');
      expect(valid).toBe(false);
      expect(errors[0]).toContain('description');
    });
  });

  // ─── Edge cases ────────────────────────────────────────
  describe('edge cases', () => {
    it('handles config with no skills key', () => {
      mkSkillsDir();
      mkConfig({ permissions: {} });
      const skills = getSkills();
      skills.loadAllSkills();
      // Should not throw
      expect(skills.listSkills()).toEqual([]);
    });

    it('handles corrupt config.json', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'test.md'), 'content');
      const nexDir = path.join(tmpDir, '.nex');
      fs.writeFileSync(path.join(nexDir, 'config.json'), 'not json!');
      const skills = getSkills();
      const result = skills.loadAllSkills();
      // Should load skills even with broken config (all enabled)
      expect(result).toHaveLength(1);
      expect(result[0].enabled).toBe(true);
    });

    it('script skill defaults name from filename', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'my-tool.js'), `
        module.exports = {
          description: 'No name provided'
        };
      `);
      const skills = getSkills();
      skills.loadAllSkills();
      expect(skills.getLoadedSkills()[0].name).toBe('my-tool');
    });

    it('saves disabled config when .nex dir does not exist yet', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Rules');
      // Don't create config.json
      const skills = getSkills();
      skills.loadAllSkills();
      skills.disableSkill('style');

      const configPath = path.join(tmpDir, '.nex', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills.disabled).toContain('style');
    });

    it('preserves other config keys when saving disabled list', () => {
      const dir = mkSkillsDir();
      fs.writeFileSync(path.join(dir, 'style.md'), 'Rules');
      mkConfig({ permissions: { bash: 'allow' }, mcpServers: {} });
      const skills = getSkills();
      skills.loadAllSkills();
      skills.disableSkill('style');

      const configPath = path.join(tmpDir, '.nex', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.permissions).toEqual({ bash: 'allow' });
      expect(config.mcpServers).toEqual({});
      expect(config.skills.disabled).toContain('style');
    });
  });
});

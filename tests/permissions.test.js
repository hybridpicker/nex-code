const fs = require('fs');
const path = require('path');
const os = require('os');

describe('permissions.js', () => {
  let permissions;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-perms-'));
    jest.resetModules();
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    permissions = require('../cli/permissions');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  describe('DEFAULT_PERMISSIONS', () => {
    it('has read tools as allow', () => {
      expect(permissions.DEFAULT_PERMISSIONS.read_file).toBe('allow');
      expect(permissions.DEFAULT_PERMISSIONS.list_directory).toBe('allow');
      expect(permissions.DEFAULT_PERMISSIONS.glob).toBe('allow');
      expect(permissions.DEFAULT_PERMISSIONS.grep).toBe('allow');
    });

    it('has write tools as ask', () => {
      expect(permissions.DEFAULT_PERMISSIONS.bash).toBe('ask');
      expect(permissions.DEFAULT_PERMISSIONS.write_file).toBe('ask');
      expect(permissions.DEFAULT_PERMISSIONS.edit_file).toBe('ask');
      expect(permissions.DEFAULT_PERMISSIONS.patch_file).toBe('ask');
    });
  });

  describe('getPermission()', () => {
    it('returns default permission for known tool', () => {
      expect(permissions.getPermission('bash')).toBe('ask');
      expect(permissions.getPermission('read_file')).toBe('allow');
    });

    it('returns ask for unknown tool', () => {
      expect(permissions.getPermission('unknown_tool')).toBe('ask');
    });
  });

  describe('setPermission()', () => {
    it('changes permission for a tool', () => {
      permissions.setPermission('bash', 'allow');
      expect(permissions.getPermission('bash')).toBe('allow');
    });

    it('returns true for valid mode', () => {
      expect(permissions.setPermission('bash', 'allow')).toBe(true);
      expect(permissions.setPermission('bash', 'ask')).toBe(true);
      expect(permissions.setPermission('bash', 'deny')).toBe(true);
    });

    it('returns false for invalid mode', () => {
      expect(permissions.setPermission('bash', 'invalid')).toBe(false);
    });

    it('can set permissions for new tools', () => {
      permissions.setPermission('custom_tool', 'deny');
      expect(permissions.getPermission('custom_tool')).toBe('deny');
    });
  });

  describe('checkPermission()', () => {
    it('returns permission mode', () => {
      expect(permissions.checkPermission('read_file')).toBe('allow');
      expect(permissions.checkPermission('bash')).toBe('ask');
    });

    it('reflects changes from setPermission', () => {
      permissions.setPermission('bash', 'deny');
      expect(permissions.checkPermission('bash')).toBe('deny');
    });
  });

  describe('listPermissions()', () => {
    it('returns all permissions', () => {
      const list = permissions.listPermissions();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]).toHaveProperty('tool');
      expect(list[0]).toHaveProperty('mode');
    });

    it('includes all default tools', () => {
      const list = permissions.listPermissions();
      const tools = list.map((p) => p.tool);
      expect(tools).toContain('bash');
      expect(tools).toContain('read_file');
      expect(tools).toContain('glob');
      expect(tools).toContain('grep');
    });
  });

  describe('resetPermissions()', () => {
    it('resets to defaults', () => {
      permissions.setPermission('bash', 'deny');
      permissions.resetPermissions();
      expect(permissions.getPermission('bash')).toBe('ask');
    });
  });

  describe('savePermissions() + loadPermissions()', () => {
    it('saves and loads permissions from config', () => {
      permissions.setPermission('bash', 'allow');
      permissions.savePermissions();

      // Verify file was created
      const configPath = path.join(tmpDir, '.nex', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      // Reset and reload
      permissions.resetPermissions();
      expect(permissions.getPermission('bash')).toBe('ask');

      permissions.loadPermissions();
      expect(permissions.getPermission('bash')).toBe('allow');
    });

    it('handles missing config file', () => {
      permissions.loadPermissions(); // should not throw
      expect(permissions.getPermission('bash')).toBe('ask');
    });

    it('handles corrupt config file', () => {
      const configDir = path.join(tmpDir, '.nex');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'config.json'), '{invalid', 'utf-8');
      permissions.loadPermissions(); // should not throw
      expect(permissions.getPermission('bash')).toBe('ask');
    });

    it('preserves other config keys when saving', () => {
      const configDir = path.join(tmpDir, '.nex');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({ theme: 'dark', other: true }),
        'utf-8'
      );

      permissions.setPermission('bash', 'allow');
      permissions.savePermissions();

      const config = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf-8'));
      expect(config.theme).toBe('dark');
      expect(config.other).toBe(true);
      expect(config.permissions.bash).toBe('allow');
    });
  });

  describe('PERMISSION_PRESETS', () => {
    it('readonly blocks write operations', () => {
      const preset = permissions.PERMISSION_PRESETS.readonly;
      expect(preset.blockedTools).toContain('bash');
      expect(preset.blockedTools).toContain('write_file');
      expect(preset.allowedTools).toContain('read_file');
      expect(preset.allowedTools).toContain('grep');
    });

    it('developer blocks deployment tools', () => {
      const preset = permissions.PERMISSION_PRESETS.developer;
      expect(preset.blockedTools).toContain('deploy');
      expect(preset.allowedTools).toBeNull(); // all allowed except blocked
    });

    it('admin has no blocked tools', () => {
      const preset = permissions.PERMISSION_PRESETS.admin;
      expect(preset.blockedTools).toHaveLength(0);
    });
  });

  describe('listPresets()', () => {
    it('returns all presets', () => {
      const presets = permissions.listPresets();
      expect(presets).toHaveLength(3);
      expect(presets.map(p => p.name)).toEqual(['readonly', 'developer', 'admin']);
    });
  });

  describe('isToolAllowed()', () => {
    it('allows tools by default (admin preset)', () => {
      const result = permissions.isToolAllowed('bash');
      expect(result.allowed).toBe(true);
    });
  });
});

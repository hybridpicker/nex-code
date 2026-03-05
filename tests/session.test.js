const fs = require('fs');
const path = require('path');
const os = require('os');

describe('session.js', () => {
  let session;
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-session-'));
    jest.resetModules();

    // Mock process.cwd to point to our temp dir
    const origCwd = process.cwd;
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);

    session = require('../cli/session');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  });

  const sampleMessages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];

  describe('saveSession()', () => {
    it('creates session file', () => {
      const result = session.saveSession('test-session', sampleMessages);
      expect(result.name).toBe('test-session');
      expect(fs.existsSync(result.path)).toBe(true);
    });

    it('saves message data correctly', () => {
      session.saveSession('test-session', sampleMessages, {
        model: 'kimi-k2.5',
        provider: 'ollama',
      });
      const sessDir = path.join(tmpDir, '.nex', 'sessions');
      const data = JSON.parse(fs.readFileSync(path.join(sessDir, 'test-session.json'), 'utf-8'));
      expect(data.name).toBe('test-session');
      expect(data.messages).toEqual(sampleMessages);
      expect(data.messageCount).toBe(2);
      expect(data.model).toBe('kimi-k2.5');
      expect(data.provider).toBe('ollama');
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it('sanitizes unsafe file names', () => {
      const result = session.saveSession('../../etc/passwd', sampleMessages);
      // Should not contain path traversal
      expect(result.path).toContain('.nex');
      expect(result.name).toBe('../../etc/passwd');
    });

    it('preserves createdAt from meta', () => {
      const created = '2025-01-01T00:00:00.000Z';
      session.saveSession('with-date', sampleMessages, { createdAt: created });
      const sessDir = path.join(tmpDir, '.nex', 'sessions');
      const data = JSON.parse(fs.readFileSync(path.join(sessDir, 'with-date.json'), 'utf-8'));
      expect(data.createdAt).toBe(created);
    });

    it('handles default meta values', () => {
      session.saveSession('defaults', sampleMessages);
      const sessDir = path.join(tmpDir, '.nex', 'sessions');
      const data = JSON.parse(fs.readFileSync(path.join(sessDir, 'defaults.json'), 'utf-8'));
      expect(data.model).toBeNull();
      expect(data.provider).toBeNull();
    });
  });

  describe('loadSession()', () => {
    it('returns null for non-existent session', () => {
      expect(session.loadSession('nonexistent')).toBeNull();
    });

    it('loads saved session', () => {
      session.saveSession('my-session', sampleMessages);
      const loaded = session.loadSession('my-session');
      expect(loaded).not.toBeNull();
      expect(loaded.name).toBe('my-session');
      expect(loaded.messages).toEqual(sampleMessages);
    });

    it('returns null for corrupt JSON', () => {
      const sessDir = path.join(tmpDir, '.nex', 'sessions');
      fs.mkdirSync(sessDir, { recursive: true });
      fs.writeFileSync(path.join(sessDir, 'corrupt.json'), 'not json', 'utf-8');
      expect(session.loadSession('corrupt')).toBeNull();
    });
  });

  describe('listSessions()', () => {
    it('returns empty array when no sessions', () => {
      expect(session.listSessions()).toEqual([]);
    });

    it('lists saved sessions', () => {
      session.saveSession('older', sampleMessages);
      session.saveSession('newer', sampleMessages);
      const list = session.listSessions();
      expect(list.length).toBe(2);
      expect(list.map((s) => s.name)).toContain('older');
      expect(list.map((s) => s.name)).toContain('newer');
    });

    it('skips corrupt files', () => {
      session.saveSession('good', sampleMessages);
      const sessDir = path.join(tmpDir, '.nex', 'sessions');
      fs.writeFileSync(path.join(sessDir, 'bad.json'), '{invalid', 'utf-8');
      const list = session.listSessions();
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('good');
    });

    it('includes metadata in listing', () => {
      session.saveSession('detailed', sampleMessages, { model: 'gpt-4o', provider: 'openai' });
      const list = session.listSessions();
      expect(list[0].model).toBe('gpt-4o');
      expect(list[0].provider).toBe('openai');
      expect(list[0].messageCount).toBe(2);
    });

    it('skips non-json files', () => {
      session.saveSession('valid', sampleMessages);
      const sessDir = path.join(tmpDir, '.nex', 'sessions');
      fs.writeFileSync(path.join(sessDir, 'notes.txt'), 'not a session', 'utf-8');
      const list = session.listSessions();
      expect(list.length).toBe(1);
    });
  });

  describe('deleteSession()', () => {
    it('returns false for non-existent session', () => {
      expect(session.deleteSession('nope')).toBe(false);
    });

    it('deletes existing session', () => {
      session.saveSession('doomed', sampleMessages);
      expect(session.deleteSession('doomed')).toBe(true);
      expect(session.loadSession('doomed')).toBeNull();
    });
  });

  describe('getLastSession()', () => {
    it('returns null when no sessions exist', () => {
      expect(session.getLastSession()).toBeNull();
    });

    it('returns most recent session', () => {
      session.saveSession('first', [{ role: 'user', content: 'First' }]);
      session.saveSession('second', [{ role: 'user', content: 'Second' }]);
      const last = session.getLastSession();
      expect(last).not.toBeNull();
      expect(['first', 'second']).toContain(last.name);
    });
  });

  describe('autoSave()', () => {
    it('does nothing for empty messages', () => {
      session.autoSave([]);
      session.flushAutoSave();
      const list = session.listSessions();
      expect(list.length).toBe(0);
    });

    it('saves as _autosave', () => {
      session.autoSave(sampleMessages);
      session.flushAutoSave();
      const list = session.listSessions();
      expect(list.some((s) => s.name === '_autosave')).toBe(true);
    });

    it('overwrites previous autosave', () => {
      session.autoSave([{ role: 'user', content: 'First' }]);
      session.flushAutoSave();
      session.autoSave(sampleMessages);
      session.flushAutoSave();
      const loaded = session.loadSession('_autosave');
      expect(loaded.messages).toEqual(sampleMessages);
      expect(loaded.messageCount).toBe(2);
    });

    it('accepts metadata', () => {
      session.autoSave(sampleMessages, { model: 'gpt-4o', provider: 'openai' });
      session.flushAutoSave();
      const loaded = session.loadSession('_autosave');
      expect(loaded.model).toBe('gpt-4o');
    });
  });
});

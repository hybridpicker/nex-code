/**
 * tests/ssh.test.js — SSH profile manager + executor (unit tests)
 * Tests loadServerProfiles, resolveProfile, buildSSHArgs, enrichSSHError, formatProfile.
 * sshExec/scpUpload/scpDownload are integration-tested via ssh-tools.test.js.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// No child_process mock needed — we test non-network functions only.
// sshExec/scpUpload/scpDownload integration is covered in ssh-tools.test.js.

let tmpDir;
let cwdSpy;
let homeSpy;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-ssh-test-'));
  cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  homeSpy = jest.spyOn(os, 'homedir').mockReturnValue(tmpDir);
  jest.resetModules();
});

afterEach(() => {
  cwdSpy.mockRestore();
  homeSpy.mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeServers(data) {
  const dir = path.join(tmpDir, '.nex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'servers.json'), JSON.stringify(data));
}

// ─── loadServerProfiles ───────────────────────────────────────

describe('loadServerProfiles', () => {
  it('returns empty object when no file', () => {
    const { loadServerProfiles } = require('../cli/ssh');
    expect(loadServerProfiles()).toEqual({});
  });

  it('loads profiles from .nex/servers.json', () => {
    writeServers({ prod: { host: '1.2.3.4', user: 'jarvis', os: 'almalinux9' } });
    const { loadServerProfiles } = require('../cli/ssh');
    const p = loadServerProfiles();
    expect(p.prod.host).toBe('1.2.3.4');
    expect(p.prod.os).toBe('almalinux9');
  });

  it('returns empty object on malformed JSON', () => {
    const dir = path.join(tmpDir, '.nex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'servers.json'), 'NOT_JSON');
    const { loadServerProfiles } = require('../cli/ssh');
    expect(loadServerProfiles()).toEqual({});
  });
});

// ─── resolveProfile ───────────────────────────────────────────

describe('resolveProfile', () => {
  it('resolves named profile', () => {
    writeServers({ prod: { host: '1.2.3.4', user: 'jarvis' } });
    const { resolveProfile } = require('../cli/ssh');
    const p = resolveProfile('prod');
    expect(p.host).toBe('1.2.3.4');
    expect(p._name).toBe('prod');
  });

  it('resolves user@host directly', () => {
    const { resolveProfile } = require('../cli/ssh');
    const p = resolveProfile('root@10.0.0.1');
    expect(p.host).toBe('10.0.0.1');
    expect(p.user).toBe('root');
  });

  it('resolves hostname with dots', () => {
    const { resolveProfile } = require('../cli/ssh');
    const p = resolveProfile('my.server.com');
    expect(p.host).toBe('my.server.com');
  });

  it('throws on unknown name with no profiles', () => {
    const { resolveProfile } = require('../cli/ssh');
    expect(() => resolveProfile('unknown')).toThrow(/Unknown server/);
  });

  it('throws on unknown name and shows available profiles', () => {
    writeServers({ prod: { host: '1.2.3.4' }, staging: { host: '1.2.3.5' } });
    const { resolveProfile } = require('../cli/ssh');
    expect(() => resolveProfile('dev')).toThrow(/prod.*staging|staging.*prod/);
  });
});

// ─── buildSSHArgs ─────────────────────────────────────────────

describe('buildSSHArgs', () => {
  it('includes BatchMode, ConnectTimeout, StrictHostKeyChecking', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4', user: 'jarvis' });
    expect(args).toContain('BatchMode=yes');
    expect(args.some(a => a.includes('ConnectTimeout'))).toBe(true);
    expect(args.some(a => a.includes('StrictHostKeyChecking'))).toBe(true);
  });

  it('includes identity file when key is set', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4', user: 'jarvis', key: '~/.ssh/id_rsa' });
    const iIdx = args.indexOf('-i');
    expect(iIdx).toBeGreaterThan(-1);
    expect(args[iIdx + 1]).toContain('id_rsa');
    expect(args[iIdx + 1]).not.toContain('~');
  });

  it('includes port flag when non-default port', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4', port: 2222 });
    expect(args).toContain('-p');
    expect(args).toContain('2222');
  });

  it('omits port flag for default port 22', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4', port: 22 });
    expect(args).not.toContain('-p');
  });

  it('includes ControlMaster args', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4', user: 'jarvis' });
    expect(args.some(a => a.includes('ControlMaster'))).toBe(true);
    expect(args.some(a => a.includes('ControlPath'))).toBe(true);
    expect(args.some(a => a.includes('ControlPersist'))).toBe(true);
  });

  it('returns correct target user@host', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { target } = buildSSHArgs({ host: '1.2.3.4', user: 'jarvis' });
    expect(target).toBe('jarvis@1.2.3.4');
  });

  it('returns host-only target when no user', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { target } = buildSSHArgs({ host: '1.2.3.4' });
    expect(target).toBe('1.2.3.4');
  });
});

// ─── enrichSSHError ───────────────────────────────────────────

describe('enrichSSHError', () => {
  const profile = { host: '1.2.3.4', user: 'jarvis', key: '~/.ssh/id_rsa' };

  it('enriches connection refused', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('ssh: connect to host 1.2.3.4 port 22: Connection refused', profile);
    expect(msg).toContain('HINT');
    expect(msg).toContain('firewall');
  });

  it('enriches permission denied', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Permission denied (publickey)', profile);
    expect(msg).toContain('HINT');
    expect(msg).toContain('authorized_keys');
  });

  it('enriches host key mismatch', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Host key verification failed.', profile);
    expect(msg).toContain('HINT');
    expect(msg).toContain('ssh-keygen -R');
  });

  it('enriches no route to host', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('No route to host', profile);
    expect(msg).toContain('HINT');
    expect(msg).toContain('network');
  });

  it('returns stderr unchanged when no known pattern', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('some unknown error', profile);
    expect(msg).toBe('some unknown error');
  });

  it('returns empty string for empty stderr', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('', profile);
    expect(msg).toBe('');
  });
});

// ─── formatProfile ────────────────────────────────────────────

describe('formatProfile', () => {
  it('formats basic profile', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('prod', { host: '1.2.3.4', user: 'jarvis' });
    expect(str).toContain('prod');
    expect(str).toContain('jarvis@1.2.3.4');
  });

  it('includes OS when set', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('prod', { host: '1.2.3.4', user: 'jarvis', os: 'almalinux9' });
    expect(str).toContain('almalinux9');
  });

  it('includes non-default port', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('dev', { host: '1.2.3.4', port: 2222 });
    expect(str).toContain(':2222');
  });

  it('omits port for default port 22', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('prod', { host: '1.2.3.4', port: 22 });
    expect(str).not.toContain(':22');
  });

  it('includes key when set', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('prod', { host: '1.2.3.4', user: 'jarvis', key: '~/.ssh/id_ed25519' });
    expect(str).toContain('key:~/.ssh/id_ed25519');
  });

  it('includes sudo flag when set', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('prod', { host: '1.2.3.4', user: 'jarvis', sudo: true });
    expect(str).toContain('sudo:yes');
  });

  it('omits sudo when false', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('prod', { host: '1.2.3.4', user: 'jarvis', sudo: false });
    expect(str).not.toContain('sudo');
  });

  it('handles host-only (no user)', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('dev', { host: '10.0.0.1' });
    expect(str).toContain('10.0.0.1');
    expect(str).not.toContain('@');
  });
});

// ─── enrichSSHError - additional patterns ─────────────────────
describe('enrichSSHError - additional', () => {
  it('enriches timed out error', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Connection timed out', { host: '1.2.3.4' });
    expect(msg).toContain('HINT');
    expect(msg).toContain('timed out');
  });

  it('enriches too many auth failures', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Too many authentication failures', { host: '1.2.3.4', key: '~/.ssh/id_rsa' });
    expect(msg).toContain('HINT');
    expect(msg).toContain('IdentitiesOnly');
  });

  it('enriches network unreachable', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Network unreachable', { host: '1.2.3.4' });
    expect(msg).toContain('HINT');
    expect(msg).toContain('network');
  });

  it('enriches name or service not known', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Name or service not known', { host: 'bad.host' });
    expect(msg).toContain('HINT');
    expect(msg).toContain('DNS');
  });

  it('enriches permission denied without key (SSH agent)', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Permission denied', { host: '1.2.3.4', user: 'admin' });
    expect(msg).toContain('SSH agent');
  });
});

// ─── resolveProfile - localhost ───────────────────────────────
describe('resolveProfile - localhost', () => {
  it('resolves localhost directly', () => {
    const { resolveProfile } = require('../cli/ssh');
    const p = resolveProfile('localhost');
    expect(p.host).toBe('localhost');
  });
});

// ─── buildSSHArgs - additional ─────────────────────────────────
describe('buildSSHArgs - additional', () => {
  it('does not include -i when no key set', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4' });
    expect(args).not.toContain('-i');
  });

  it('handles absolute key path without tilde expansion', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4', key: '/root/.ssh/id_rsa' });
    const iIdx = args.indexOf('-i');
    expect(args[iIdx + 1]).toBe('/root/.ssh/id_rsa');
  });

  it('includes ServerAliveInterval', () => {
    const { buildSSHArgs } = require('../cli/ssh');
    const { args } = buildSSHArgs({ host: '1.2.3.4' });
    expect(args.some(a => a.includes('ServerAliveInterval'))).toBe(true);
  });
});

// ─── enrichSSHError - additional ───────────────────────────────
describe('enrichSSHError - additional patterns', () => {
  it('suggests default key in too-many-auth hint when no key configured', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Too many authentication failures', { host: '1.2.3.4' });
    expect(msg).toContain('~/.ssh/id_rsa');
  });

  it('enriches connection refused with custom port', () => {
    const { enrichSSHError } = require('../cli/ssh');
    const msg = enrichSSHError('Connection refused', { host: '1.2.3.4', port: 2222 });
    expect(msg).toContain('2222');
  });
});

// ─── formatProfile - combined ──────────────────────────────────
describe('formatProfile - combined', () => {
  it('shows all fields when all set', () => {
    const { formatProfile } = require('../cli/ssh');
    const str = formatProfile('full', {
      host: '10.0.0.1', user: 'admin', port: 2222,
      os: 'ubuntu', key: '~/.ssh/id_ed25519', sudo: true,
    });
    expect(str).toContain('admin@10.0.0.1');
    expect(str).toContain(':2222');
    expect(str).toContain('[ubuntu]');
    expect(str).toContain('key:');
    expect(str).toContain('sudo:yes');
  });
});

// ─── resolveProfile - additional ───────────────────────────────
describe('resolveProfile - additional', () => {
  it('resolves IP with user', () => {
    const { resolveProfile } = require('../cli/ssh');
    const p = resolveProfile('deploy@192.168.1.100');
    expect(p.host).toBe('192.168.1.100');
    expect(p.user).toBe('deploy');
  });

  it('resolves subdomain hostname', () => {
    const { resolveProfile } = require('../cli/ssh');
    const p = resolveProfile('staging.example.com');
    expect(p.host).toBe('staging.example.com');
  });

  it('throws Unknown server for non-existent profile', () => {
    const { resolveProfile } = require('../cli/ssh');
    expect(() => resolveProfile('nonexistentserver12345')).toThrow(/Unknown server/);
  });
});

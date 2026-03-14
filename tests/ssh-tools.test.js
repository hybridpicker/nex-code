/**
 * tests/ssh-tools.test.js — ssh_exec, ssh_upload, ssh_download, service_manage, service_logs
 *
 * Mocks cli/ssh.js for SSH tools.
 * child_process.exec mock uses util.promisify.custom so it returns { stdout, stderr }.
 *
 * Note: variables referenced inside jest.mock factories must start with "mock"
 * so Babel's jest-hoist plugin allows them in the hoisted factory scope.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Variables used inside jest.mock factories MUST start with "mock"
const mockSshExec = jest.fn();
const mockScpUpload = jest.fn();
const mockScpDownload = jest.fn();
const mockResolveProfile = jest.fn();
const mockExecImpl = jest.fn();

// ─── cli/ssh mock ─────────────────────────────────────────────

jest.mock('../cli/ssh', () => ({
  loadServerProfiles: jest.fn().mockReturnValue({}),
  resolveProfile: (...a) => mockResolveProfile(...a),
  sshExec: (...a) => mockSshExec(...a),
  scpUpload: (...a) => mockScpUpload(...a),
  scpDownload: (...a) => mockScpDownload(...a),
  enrichSSHError: (s) => s,
  formatProfile: (n) => n,
}));

// ─── child_process mock with promisify.custom ─────────────────
// Without promisify.custom, util.promisify(exec) resolves to a plain string.
// With it, promisify resolves to { stdout, stderr }, matching Node's real exec.

jest.mock('child_process', () => {
  const realChild = jest.requireActual('child_process');
  const realUtil = jest.requireActual('util');

  function mockExecFn(cmd, opts, cb) {
    const resolve = typeof opts === 'function' ? opts : cb;
    mockExecImpl(cmd, opts, resolve);
  }
  mockExecFn[realUtil.promisify.custom] = (cmd, opts) =>
    new Promise((resolve, reject) => {
      mockExecImpl(cmd, opts, (err, stdout, stderr) => {
        if (err) {
          Object.assign(err, { stdout: stdout || '', stderr: stderr || '' });
          reject(err);
        } else {
          resolve({ stdout: stdout || '', stderr: stderr || '' });
        }
      });
    });

  return {
    ...realChild,
    exec: mockExecFn,
    spawnSync: jest.fn().mockReturnValue({ status: 0, error: null }),
  };
});

// ─── Other mocks ──────────────────────────────────────────────

jest.mock('../cli/safety', () => ({
  isForbidden: jest.fn().mockReturnValue(null),
  isDangerous: jest.fn().mockReturnValue(false),
  isCritical: jest.fn().mockReturnValue(false),
  confirm: jest.fn().mockResolvedValue(true),
  getAutoConfirm: jest.fn().mockReturnValue(true),
  setAutoConfirm: jest.fn(),
}));

jest.mock('../cli/file-history', () => ({ recordChange: jest.fn() }));
jest.mock('../cli/diff', () => ({
  showClaudeDiff: jest.fn(),
  showClaudeNewFile: jest.fn(),
  showEditDiff: jest.fn(),
  confirmFileChange: jest.fn().mockResolvedValue(true),
}));

// ─── Setup ────────────────────────────────────────────────────

let tmpDir;
let cwdSpy;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-ssh-tools-'));
  cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  mockSshExec.mockReset();
  mockScpUpload.mockReset();
  mockScpDownload.mockReset();
  mockResolveProfile.mockReset();
  mockExecImpl.mockReset();
  jest.resetModules();
});

afterEach(() => {
  cwdSpy.mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeServers(data) {
  const dir = path.join(tmpDir, '.nex');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'servers.json'), JSON.stringify(data));
}

function getTools() { return require('../cli/tools'); }

// ─── ssh_exec ────────────────────────────────────────────────

describe('ssh_exec', () => {
  it('executes command and returns stdout', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis' });
    mockSshExec.mockResolvedValue({ stdout: 'active\n', stderr: '', exitCode: 0 });
    const { executeTool } = getTools();
    const result = await executeTool('ssh_exec', { server: 'prod', command: 'systemctl is-active nginx' }, { autoConfirm: true, silent: true });
    expect(result).toContain('active');
  });

  it('returns error on resolveProfile failure', async () => {
    mockResolveProfile.mockImplementation(() => { throw new Error('Unknown server: "nope". No profiles'); });
    const { executeTool } = getTools();
    const result = await executeTool('ssh_exec', { server: 'nope', command: 'ls' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*Unknown server/);
  });

  it('returns error when server param is missing', async () => {
    const { executeTool } = getTools();
    const result = await executeTool('ssh_exec', { command: 'ls' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*server/);
  });

  it('returns error when command param is missing', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4' });
    const { executeTool } = getTools();
    const result = await executeTool('ssh_exec', { server: 'prod' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*command/);
  });

  it('shows exit code on SSH failure', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis' });
    mockSshExec.mockResolvedValue({ stdout: '', stderr: 'Permission denied', exitCode: 1, error: 'Permission denied' });
    const { executeTool } = getTools();
    const result = await executeTool('ssh_exec', { server: 'prod', command: 'whoami' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/EXIT 1/);
    expect(result).toContain('Permission denied');
  });

  it('accepts user@host as server', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis' });
    mockSshExec.mockResolvedValue({ stdout: 'jarvis\n', stderr: '', exitCode: 0 });
    const { executeTool } = getTools();
    const result = await executeTool('ssh_exec', { server: 'jarvis@1.2.3.4', command: 'whoami' }, { autoConfirm: true, silent: true });
    expect(result).toContain('jarvis');
  });
});

// ─── ssh_upload ──────────────────────────────────────────────

describe('ssh_upload', () => {
  it('uploads file and calls scpUpload', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis' });
    mockScpUpload.mockResolvedValue('Uploaded /tmp/test.txt → jarvis@1.2.3.4:/tmp/test.txt');
    const { executeTool } = getTools();
    const result = await executeTool('ssh_upload', { server: 'prod', local_path: '/tmp/test.txt', remote_path: '/tmp/test.txt' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/[Uu]pload/);
    expect(mockScpUpload).toHaveBeenCalled();
  });

  it('returns error on missing params', async () => {
    const { executeTool } = getTools();
    const result = await executeTool('ssh_upload', { server: 'prod' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR/);
  });
});

// ─── ssh_download ────────────────────────────────────────────

describe('ssh_download', () => {
  it('downloads file and calls scpDownload', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis' });
    mockScpDownload.mockResolvedValue('Downloaded jarvis@1.2.3.4:/var/log/error.log → /tmp/error.log');
    const { executeTool } = getTools();
    const result = await executeTool('ssh_download', { server: 'prod', remote_path: '/var/log/error.log', local_path: '/tmp/error.log' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/[Dd]ownload/);
    expect(mockScpDownload).toHaveBeenCalled();
  });

  it('returns error on missing params', async () => {
    const { executeTool } = getTools();
    const result = await executeTool('ssh_download', { server: 'prod' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR/);
  });
});

// ─── service_manage ──────────────────────────────────────────

describe('service_manage', () => {
  it('returns service status locally', async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => cb(null, '● nginx.service - active', ''));
    const { executeTool } = getTools();
    const result = await executeTool('service_manage', { service: 'nginx', action: 'status' }, { autoConfirm: true, silent: true });
    expect(result).toContain('nginx');
  });

  it('runs status remotely via sshExec', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis', sudo: true });
    mockSshExec.mockResolvedValue({ stdout: '● nginx.service - active', stderr: '', exitCode: 0 });
    const { executeTool } = getTools();
    const result = await executeTool('service_manage', { server: 'prod', service: 'nginx', action: 'status' }, { autoConfirm: true, silent: true });
    expect(result).toContain('nginx');
    expect(mockSshExec).toHaveBeenCalled();
  });

  it('returns error for invalid action', async () => {
    const { executeTool } = getTools();
    const result = await executeTool('service_manage', { service: 'nginx', action: 'destroy' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*invalid action/);
  });

  it('returns error when service param is missing', async () => {
    const { executeTool } = getTools();
    const result = await executeTool('service_manage', { action: 'status' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*service/);
  });

  it('returns error on unknown remote server', async () => {
    mockResolveProfile.mockImplementation(() => { throw new Error('Unknown server: "unknown". No profiles'); });
    const { executeTool } = getTools();
    const result = await executeTool('service_manage', { server: 'unknown', service: 'nginx', action: 'restart' }, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*Unknown server/);
  });
});

// ─── service_logs ────────────────────────────────────────────

describe('service_logs', () => {
  it('fetches logs locally', async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => cb(null, 'Mar 11 10:00:00 nginx[123]: started', ''));
    const { executeTool } = getTools();
    const result = await executeTool('service_logs', { service: 'nginx' }, { autoConfirm: true, silent: true });
    expect(result).toContain('nginx');
  });

  it('fetches logs remotely via sshExec', async () => {
    mockResolveProfile.mockReturnValue({ host: '1.2.3.4', user: 'jarvis' });
    mockSshExec.mockResolvedValue({ stdout: 'Mar 11 10:00:00 nginx: started', stderr: '', exitCode: 0 });
    const { executeTool } = getTools();
    const result = await executeTool('service_logs', { server: 'prod', service: 'nginx', lines: 20 }, { autoConfirm: true, silent: true });
    expect(result).toContain('nginx');
    expect(mockSshExec).toHaveBeenCalled();
  });

  it('returns error when service param is missing', async () => {
    const { executeTool } = getTools();
    const result = await executeTool('service_logs', {}, { autoConfirm: true, silent: true });
    expect(result).toMatch(/ERROR.*service/);
  });

  it('passes --since flag when specified', async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => cb(null, 'log line', ''));
    const { executeTool } = getTools();
    await executeTool('service_logs', { service: 'nginx', since: '1 hour ago' }, { autoConfirm: true, silent: true });
    const cmd = mockExecImpl.mock.calls[0][0];
    expect(cmd).toContain('--since');
    expect(cmd).toContain('1 hour ago');
  });

  it('returns no log output message when empty', async () => {
    mockExecImpl.mockImplementation((cmd, opts, cb) => cb(null, '', ''));
    const { executeTool } = getTools();
    const result = await executeTool('service_logs', { service: 'nginx' }, { autoConfirm: true, silent: true });
    expect(result).toContain('no log output');
  });
});

// ─── server-context ──────────────────────────────────────────

describe('server-context', () => {
  it('returns null when no servers configured', () => {
    const { getServerContext } = require('../cli/server-context');
    expect(getServerContext()).toBeNull();
  });

  it('includes server profiles in context', () => {
    // server-context.js uses loadServerProfiles() from cli/ssh — configure the mock
    require('../cli/ssh').loadServerProfiles.mockReturnValue({ prod: { host: '1.2.3.4', user: 'jarvis', os: 'almalinux9' } });
    const { getServerContext } = require('../cli/server-context');
    const ctx = getServerContext();
    expect(ctx).toContain('prod');
    expect(ctx).toContain('1.2.3.4');
    expect(ctx).toContain('almalinux9');
  });

  it('includes AlmaLinux OS hints when os is almalinux9', () => {
    require('../cli/ssh').loadServerProfiles.mockReturnValue({ prod: { host: '1.2.3.4', os: 'almalinux9' } });
    const { getServerContext } = require('../cli/server-context');
    const ctx = getServerContext();
    expect(ctx).toContain('dnf');
    expect(ctx).toContain('firewalld');
    expect(ctx).toContain('SELinux');
  });

  it('includes macOS hints when os is macos', () => {
    require('../cli/ssh').loadServerProfiles.mockReturnValue({ local: { host: 'localhost', os: 'macos' } });
    const { getServerContext } = require('../cli/server-context');
    const ctx = getServerContext();
    expect(ctx).toContain('brew');
    expect(ctx).toContain('launchctl');
  });

  it('handles multiple servers with different OS', () => {
    require('../cli/ssh').loadServerProfiles.mockReturnValue({
      prod: { host: '1.2.3.4', os: 'almalinux9' },
      dev: { host: 'localhost', os: 'macos' },
    });
    const { getServerContext } = require('../cli/server-context');
    const ctx = getServerContext();
    expect(ctx).toContain('dnf');
    expect(ctx).toContain('brew');
  });
});

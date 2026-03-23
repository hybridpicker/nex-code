/**
 * tests/debug-mode.test.js — Debug Mode tests
 *
 * Verifies that internal diagnostic messages (⚠ compression, BLOCKED, storm, etc.)
 * are hidden by default and shown only with --debug flag or NEX_DEBUG=true.
 */

// ─── Unit tests for cli/debug.js ────────────────────────────────────────────

describe('Debug Mode — cli/debug.js', () => {
  let originalArgv;
  let originalEnv;

  beforeEach(() => {
    // Reset module cache so DEBUG is re-evaluated
    jest.resetModules();
    originalArgv = process.argv.slice();
    originalEnv = process.env.NEX_DEBUG;
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalEnv === undefined) {
      delete process.env.NEX_DEBUG;
    } else {
      process.env.NEX_DEBUG = originalEnv;
    }
    jest.resetModules();
  });

  test('DEBUG is false by default (no --debug flag, no NEX_DEBUG)', () => {
    process.argv = ['node', 'nex-code'];
    delete process.env.NEX_DEBUG;
    const { DEBUG } = require('../cli/debug');
    expect(DEBUG).toBe(false);
  });

  test('DEBUG is true when --debug flag is present', () => {
    process.argv = ['node', 'nex-code', '--debug'];
    delete process.env.NEX_DEBUG;
    const { DEBUG } = require('../cli/debug');
    expect(DEBUG).toBe(true);
  });

  test('DEBUG is true when NEX_DEBUG=true', () => {
    process.argv = ['node', 'nex-code'];
    process.env.NEX_DEBUG = 'true';
    const { DEBUG } = require('../cli/debug');
    expect(DEBUG).toBe(true);
  });

  test('DEBUG is false when NEX_DEBUG=false', () => {
    process.argv = ['node', 'nex-code'];
    process.env.NEX_DEBUG = 'false';
    const { DEBUG } = require('../cli/debug');
    expect(DEBUG).toBe(false);
  });

  test('debugLog does not call console.log when DEBUG is false', () => {
    process.argv = ['node', 'nex-code'];
    delete process.env.NEX_DEBUG;
    const { debugLog } = require('../cli/debug');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('⚠ internal warning message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('debugLog calls console.log when DEBUG is true (--debug)', () => {
    process.argv = ['node', 'nex-code', '--debug'];
    delete process.env.NEX_DEBUG;
    const { debugLog } = require('../cli/debug');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('⚠ internal warning message');
    expect(spy).toHaveBeenCalledWith('⚠ internal warning message');
    spy.mockRestore();
  });

  test('warnLog does not call console.warn when DEBUG is false', () => {
    process.argv = ['node', 'nex-code'];
    delete process.env.NEX_DEBUG;
    const { warnLog } = require('../cli/debug');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warnLog('⚠ internal warn message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('warnLog calls console.warn when NEX_DEBUG=true', () => {
    process.argv = ['node', 'nex-code'];
    process.env.NEX_DEBUG = 'true';
    const { warnLog } = require('../cli/debug');
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warnLog('⚠ internal warn message');
    expect(spy).toHaveBeenCalledWith('⚠ internal warn message');
    spy.mockRestore();
  });

  test('debugLog suppresses ⚠ system messages by default', () => {
    process.argv = ['node', 'nex-code'];
    delete process.env.NEX_DEBUG;
    const { debugLog } = require('../cli/debug');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('⚠ Super-nuclear compression — dropped all history');
    debugLog('BLOCKED: read_file denied — file already in context');
    debugLog('[force-compressed — ~253 tokens freed]');
    debugLog('⚠ SSH storm warning: 8 consecutive ssh_exec calls');
    debugLog('[dual-block deadlock: SSH storm relaxed]');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('debugLog shows ⚠ system messages with --debug flag', () => {
    process.argv = ['node', 'nex-code', '--debug'];
    delete process.env.NEX_DEBUG;
    const { debugLog } = require('../cli/debug');
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('⚠ Loop warning: file edited 3×');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

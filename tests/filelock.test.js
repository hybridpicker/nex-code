/**
 * tests/filelock.test.js — Inter-process file locking tests
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;
let filelock;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-filelock-'));
  jest.resetModules();
  filelock = require('../cli/filelock');
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── atomicWrite ─────────────────────────────────────────────

describe('atomicWrite()', () => {
  it('creates a new file with the given content', () => {
    const filePath = path.join(tmpDir, 'out.json');
    filelock.atomicWrite(filePath, '{"ok":true}');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('{"ok":true}');
  });

  it('overwrites existing file', () => {
    const filePath = path.join(tmpDir, 'out.txt');
    fs.writeFileSync(filePath, 'old', 'utf-8');
    filelock.atomicWrite(filePath, 'new');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new');
  });

  it('creates parent directory if missing', () => {
    const filePath = path.join(tmpDir, 'sub', 'dir', 'out.txt');
    filelock.atomicWrite(filePath, 'hello');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello');
  });

  it('leaves no temp file on success', () => {
    const filePath = path.join(tmpDir, 'clean.txt');
    filelock.atomicWrite(filePath, 'data');
    const files = fs.readdirSync(tmpDir);
    const temps = files.filter(f => f.startsWith('.nex-tmp.'));
    expect(temps).toHaveLength(0);
  });

  it('handles empty string content', () => {
    const filePath = path.join(tmpDir, 'empty.txt');
    filelock.atomicWrite(filePath, '');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('');
  });

  it('handles unicode content', () => {
    const filePath = path.join(tmpDir, 'unicode.txt');
    const content = 'ä ö ü ß 日本語 🎸';
    filelock.atomicWrite(filePath, content);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(content);
  });

  it('multiple sequential writes produce correct final content', () => {
    const filePath = path.join(tmpDir, 'seq.txt');
    for (let i = 0; i < 10; i++) {
      filelock.atomicWrite(filePath, `round-${i}`);
    }
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('round-9');
  });
});

// ─── withFileLockSync ─────────────────────────────────────────

describe('withFileLockSync()', () => {
  it('runs the critical section and returns its value', () => {
    const filePath = path.join(tmpDir, 'target.txt');
    const result = filelock.withFileLockSync(filePath, () => 42);
    expect(result).toBe(42);
  });

  it('releases the lock after normal completion', () => {
    const filePath = path.join(tmpDir, 'target.txt');
    filelock.withFileLockSync(filePath, () => {});
    expect(fs.existsSync(filePath + '.lock')).toBe(false);
  });

  it('releases the lock even if fn() throws', () => {
    const filePath = path.join(tmpDir, 'target.txt');
    expect(() => {
      filelock.withFileLockSync(filePath, () => { throw new Error('boom'); });
    }).toThrow('boom');
    expect(fs.existsSync(filePath + '.lock')).toBe(false);
  });

  it('allows sequential re-locking of the same file', () => {
    const filePath = path.join(tmpDir, 'seq.txt');
    filelock.withFileLockSync(filePath, () => {});
    filelock.withFileLockSync(filePath, () => {});
    expect(fs.existsSync(filePath + '.lock')).toBe(false);
  });

  it('reclaims a stale lock from a dead PID', () => {
    const filePath = path.join(tmpDir, 'stale.txt');
    const lockPath = filePath + '.lock';
    // Write a lock file with a definitely-dead PID (1 is init, we can't kill it;
    // use a very large PID that is almost certainly not running)
    fs.writeFileSync(lockPath, '999999999', 'utf-8');
    let ran = false;
    filelock.withFileLockSync(filePath, () => { ran = true; });
    expect(ran).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('propagates non-EEXIST errors from openSync', () => {
    // Create the lock file as a directory so openSync fails with EISDIR
    const filePath = path.join(tmpDir, 'dir-conflict.txt');
    const lockPath = filePath + '.lock';
    fs.mkdirSync(lockPath);
    expect(() => filelock.withFileLockSync(filePath, () => {})).toThrow();
  });

  it('performs isolated read-modify-write without data loss', () => {
    const filePath = path.join(tmpDir, 'counter.json');
    fs.writeFileSync(filePath, JSON.stringify({ n: 0 }), 'utf-8');

    // Simulate sequential read-modify-write (intra-process — same process, no actual contention)
    for (let i = 0; i < 5; i++) {
      filelock.withFileLockSync(filePath, () => {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        data.n += 1;
        filelock.atomicWrite(filePath, JSON.stringify(data));
      });
    }

    const result = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(result.n).toBe(5);
  });

  it('passes options through (retryMs, timeout)', () => {
    const filePath = path.join(tmpDir, 'opts.txt');
    const result = filelock.withFileLockSync(filePath, () => 'done', { timeout: 1000, retryMs: 10 });
    expect(result).toBe('done');
  });
});

// ─── Integration: memory-like usage ──────────────────────────

describe('integration: read-modify-write pattern', () => {
  it('accumulates values correctly across sequential lock calls', () => {
    const filePath = path.join(tmpDir, 'mem.json');
    filelock.atomicWrite(filePath, JSON.stringify({}));

    const keys = ['alpha', 'beta', 'gamma', 'delta'];
    for (const key of keys) {
      filelock.withFileLockSync(filePath, () => {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        data[key] = true;
        filelock.atomicWrite(filePath, JSON.stringify(data));
      });
    }

    const final = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(Object.keys(final)).toHaveLength(4);
    for (const key of keys) expect(final[key]).toBe(true);
  });
});

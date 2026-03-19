const fs = require('fs');
const path = require('path');
const os = require('os');

describe('audit.js', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-audit-'));
    jest.resetModules();
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function getAudit() {
    return require('../cli/audit');
  }

  test('logToolExecution creates JSONL file', () => {
    const audit = getAudit();
    audit.setAuditEnabled(true);
    audit.logToolExecution({ tool: 'read_file', args: { path: 'test.js' }, result: 'ok', duration: 50, success: true });
    const logPath = audit.getAuditLogPath();
    expect(fs.existsSync(logPath)).toBe(true);
    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.tool).toBe('read_file');
    expect(entry.duration).toBe(50);
  });

  test('sanitizeArgs masks sensitive keys', () => {
    const audit = getAudit();
    const result = audit.sanitizeArgs({ api_key: 'secret123', path: 'test.js' });
    expect(result.api_key).toBe('***');
    expect(result.path).toBe('test.js');
  });

  test('sanitizeArgs truncates long values', () => {
    const audit = getAudit();
    const result = audit.sanitizeArgs({ content: 'x'.repeat(1000) });
    expect(result.content.length).toBeLessThan(600);
  });

  test('getAuditSummary returns correct stats', () => {
    const audit = getAudit();
    audit.setAuditEnabled(true);
    audit.logToolExecution({ tool: 'bash', args: {}, result: 'ok', duration: 100, success: true });
    audit.logToolExecution({ tool: 'bash', args: {}, result: 'ok', duration: 200, success: true });
    audit.logToolExecution({ tool: 'read_file', args: {}, result: 'ERROR', duration: 50, success: false });
    const summary = audit.getAuditSummary(1);
    expect(summary.totalCalls).toBe(3);
    expect(summary.byTool.bash).toBe(2);
    expect(summary.byTool.read_file).toBe(1);
  });
});

const { ToolProgress } = require('../cli/spinner');

describe('ToolProgress', () => {
  let origIsTTY;

  beforeEach(() => {
    // Save and override stderr.isTTY to prevent actual writes
    origIsTTY = process.stderr.isTTY;
    Object.defineProperty(process.stderr, 'isTTY', { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    // Restore original value
    if (origIsTTY !== undefined) {
      Object.defineProperty(process.stderr, 'isTTY', { value: origIsTTY, writable: true, configurable: true });
    } else {
      delete process.stderr.isTTY;
    }
    jest.restoreAllMocks();
  });

  test('creates with default message', () => {
    const p = new ToolProgress('grep');
    expect(p.toolName).toBe('grep');
    expect(p.message).toBe('Running grep...');
    expect(p.count).toBe(0);
  });

  test('creates with custom message', () => {
    const p = new ToolProgress('grep', 'Searching...');
    expect(p.message).toBe('Searching...');
  });

  test('start and stop lifecycle', () => {
    const p = new ToolProgress('grep', 'Searching...');
    p.start();
    expect(p._stopped).toBe(false);
    expect(p.startTime).toBeTruthy();
    p.stop();
    expect(p._stopped).toBe(true);
  });

  test('update changes state', () => {
    const p = new ToolProgress('grep');
    p.update({ count: 42, total: 100, detail: 'in src/' });
    expect(p.count).toBe(42);
    expect(p.total).toBe(100);
    expect(p.detail).toBe('in src/');
  });

  test('update message', () => {
    const p = new ToolProgress('grep');
    p.update({ message: 'Processing...' });
    expect(p.message).toBe('Processing...');
  });
});

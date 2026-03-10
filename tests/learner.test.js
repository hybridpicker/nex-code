jest.mock('../cli/providers/registry', () => ({
  callChat: jest.fn(),
}));

jest.mock('../cli/memory', () => ({
  remember: jest.fn(),
  recall: jest.fn().mockReturnValue(null),
  listMemories: jest.fn().mockReturnValue([]),
}));

const fs = require('fs');
const path = require('path');
const os = require('os');

const { callChat } = require('../cli/providers/registry');
const { remember, recall } = require('../cli/memory');
const {
  reflectOnSession,
  applyMemories,
  applyNexAdditions,
  learnFromSession,
  LEARN_MIN_MESSAGES,
} = require('../cli/learner');

// ─── Helpers ─────────────────────────────────────────────────
function makeMessages(n = 6) {
  return Array.from({ length: n * 2 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${Math.floor(i / 2) + 1} content here`,
  }));
}

// ─── reflectOnSession ─────────────────────────────────────────
describe('reflectOnSession()', () => {
  beforeEach(() => {
    callChat.mockReset();
    recall.mockReturnValue(null);
  });

  it('skips when fewer than LEARN_MIN_MESSAGES user messages', async () => {
    const msgs = makeMessages(LEARN_MIN_MESSAGES - 1);
    const result = await reflectOnSession(msgs);
    expect(result.skipped).toBe(true);
    expect(callChat).not.toHaveBeenCalled();
  });

  it('returns memories and nex_additions on success', async () => {
    callChat.mockResolvedValueOnce({
      content: JSON.stringify({
        memories: [{ key: 'prefer_yarn', value: 'always use yarn not npm' }],
        nex_additions: ['- Use yarn for package management'],
        summary: 'Set up project preferences',
      }),
    });

    const result = await reflectOnSession(makeMessages(5));
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].key).toBe('prefer_yarn');
    expect(result.nex_additions).toHaveLength(1);
    expect(result.summary).toBe('Set up project preferences');
  });

  it('handles JSON wrapped in markdown code block', async () => {
    callChat.mockResolvedValueOnce({
      content: '```json\n{"memories": [], "nex_additions": [], "summary": "test"}\n```',
    });

    const result = await reflectOnSession(makeMessages(5));
    expect(result.memories).toEqual([]);
    expect(result.summary).toBe('test');
  });

  it('returns error when callChat throws', async () => {
    callChat.mockRejectedValueOnce(new Error('API down'));
    const result = await reflectOnSession(makeMessages(5));
    expect(result.error).toMatch('API down');
    expect(result.memories).toEqual([]);
  });

  it('returns error when no JSON in response', async () => {
    callChat.mockResolvedValueOnce({ content: 'Sorry, I cannot help with that.' });
    const result = await reflectOnSession(makeMessages(5));
    expect(result.error).toBeDefined();
  });

  it('handles missing fields gracefully', async () => {
    callChat.mockResolvedValueOnce({
      content: '{"summary": "done"}',
    });
    const result = await reflectOnSession(makeMessages(5));
    expect(result.memories).toEqual([]);
    expect(result.nex_additions).toEqual([]);
  });

  it('passes temperature: 0 and maxTokens: 800 to callChat', async () => {
    callChat.mockResolvedValueOnce({
      content: '{"memories": [], "nex_additions": [], "summary": "test"}',
    });
    await reflectOnSession(makeMessages(5));
    const [, , opts] = callChat.mock.calls[0];
    expect(opts.temperature).toBe(0);
    expect(opts.maxTokens).toBe(800);
  });
});

// ─── applyMemories ────────────────────────────────────────────
describe('applyMemories()', () => {
  beforeEach(() => {
    remember.mockClear();
    recall.mockReturnValue(null);
  });

  it('calls remember for each valid memory', () => {
    applyMemories([
      { key: 'pref_tabs', value: 'use tabs not spaces' },
      { key: 'pref_quotes', value: 'single quotes' },
    ]);
    expect(remember).toHaveBeenCalledTimes(2);
  });

  it('marks existing memory as updated', () => {
    recall.mockReturnValue('old value');
    const result = applyMemories([{ key: 'pref_tabs', value: 'new value' }]);
    expect(result[0].action).toBe('updated');
  });

  it('marks new memory as added', () => {
    recall.mockReturnValue(null);
    const result = applyMemories([{ key: 'pref_tabs', value: 'new value' }]);
    expect(result[0].action).toBe('added');
  });

  it('skips memories with identical values', () => {
    recall.mockReturnValue('same value');
    const result = applyMemories([{ key: 'pref_tabs', value: 'same value' }]);
    expect(result).toHaveLength(0);
    expect(remember).not.toHaveBeenCalled();
  });

  it('skips entries with missing key or value', () => {
    applyMemories([
      { key: '', value: 'value' },
      { key: 'key', value: '' },
      { key: null, value: 'value' },
      {},
    ]);
    expect(remember).not.toHaveBeenCalled();
  });

  it('handles empty array', () => {
    const result = applyMemories([]);
    expect(result).toEqual([]);
  });
});

// ─── applyNexAdditions ────────────────────────────────────────
describe('applyNexAdditions()', () => {
  let tmpDir;
  let nexPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-learner-test-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    nexPath = path.join(tmpDir, 'NEX.md');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates NEX.md if it does not exist', () => {
    applyNexAdditions(['- Use yarn for installs']);
    expect(fs.existsSync(nexPath)).toBe(true);
    expect(fs.readFileSync(nexPath, 'utf-8')).toContain('Use yarn for installs');
  });

  it('appends to existing NEX.md', () => {
    fs.writeFileSync(nexPath, '# Existing rules\n', 'utf-8');
    applyNexAdditions(['- New rule here']);
    const content = fs.readFileSync(nexPath, 'utf-8');
    expect(content).toContain('Existing rules');
    expect(content).toContain('New rule here');
  });

  it('does not duplicate lines already present', () => {
    fs.writeFileSync(nexPath, '- Use yarn for installs\n', 'utf-8');
    const added = applyNexAdditions(['- Use yarn for installs']);
    expect(added).toHaveLength(0);
    const content = fs.readFileSync(nexPath, 'utf-8');
    expect(content.match(/Use yarn/g)).toHaveLength(1);
  });

  it('returns array of actually added lines', () => {
    const added = applyNexAdditions(['- Line A', '- Line B']);
    expect(added).toEqual(['- Line A', '- Line B']);
  });

  it('returns empty array when nothing to add', () => {
    const added = applyNexAdditions([]);
    expect(added).toEqual([]);
  });

  it('skips falsy entries', () => {
    const added = applyNexAdditions([null, '', undefined, '- Valid line']);
    expect(added).toEqual(['- Valid line']);
  });

  it('ends file with newline', () => {
    applyNexAdditions(['- Some instruction']);
    const content = fs.readFileSync(nexPath, 'utf-8');
    expect(content.endsWith('\n')).toBe(true);
  });
});

// ─── learnFromSession ─────────────────────────────────────────
describe('learnFromSession()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nex-learn-session-'));
    jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    callChat.mockReset();
    remember.mockClear();
    recall.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns skipped for short sessions', async () => {
    const result = await learnFromSession(makeMessages(2));
    expect(result.skipped).toBe(true);
  });

  it('full round-trip: reflects, applies memories, applies nex', async () => {
    callChat.mockResolvedValueOnce({
      content: JSON.stringify({
        memories: [{ key: 'use_bun', value: 'always use bun not npm' }],
        nex_additions: ['- Always use bun as package manager'],
        summary: 'Learned bun preference',
      }),
    });

    const result = await learnFromSession(makeMessages(5));
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].key).toBe('use_bun');
    expect(result.nexAdded).toHaveLength(1);
    expect(result.summary).toBe('Learned bun preference');
    expect(remember).toHaveBeenCalledWith('use_bun', 'always use bun not npm');
  });

  it('propagates error from reflection', async () => {
    callChat.mockRejectedValueOnce(new Error('timeout'));
    const result = await learnFromSession(makeMessages(5));
    expect(result.error).toMatch('timeout');
  });
});

// ─── LEARN_MIN_MESSAGES export ────────────────────────────────
describe('LEARN_MIN_MESSAGES', () => {
  it('is a positive number', () => {
    expect(typeof LEARN_MIN_MESSAGES).toBe('number');
    expect(LEARN_MIN_MESSAGES).toBeGreaterThan(0);
  });
});

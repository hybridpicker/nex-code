'use strict';

const { MilestoneTracker, _phaseName } = require('../cli/milestone');

// ─── _phaseName ───────────────────────────────────────────────

describe('_phaseName', () => {
  function counts(obj) {
    return new Map(Object.entries(obj));
  }

  test('returns Phase N when toolCounts is empty', () => {
    expect(_phaseName(new Map(), 3)).toBe('Phase 3');
  });

  test('classifies >50% web tools as Research', () => {
    expect(_phaseName(counts({ web_search: 3, read_file: 1 }), 1)).toBe('Research');
  });

  test('classifies >50% explore tools as Exploration', () => {
    expect(_phaseName(counts({ read_file: 4, bash: 1 }), 1)).toBe('Exploration');
  });

  test('classifies >30% write tools as Implementation', () => {
    // write_file: 2/5 = 40% > 30%, explore = 0% — Implementation wins
    expect(_phaseName(counts({ write_file: 2, bash: 3 }), 2)).toBe('Implementation');
  });

  test('classifies >30% exec + <15% write as Verification', () => {
    expect(_phaseName(counts({ bash: 4, read_file: 3 }), 2)).toBe('Verification');
  });

  test('falls back to Phase N when no dominant type', () => {
    expect(_phaseName(counts({ bash: 1, write_file: 1, read_file: 1, web_search: 1 }), 5)).toBe('Phase 5');
  });
});

// ─── MilestoneTracker ─────────────────────────────────────────

describe('MilestoneTracker', () => {
  const emptySet = new Set();

  test('returns null before N steps', () => {
    const t = new MilestoneTracker(3);
    expect(t.record(4, ['read_file'], emptySet, emptySet)).toBeNull();
    expect(t.record(4, ['read_file'], emptySet, emptySet)).toBeNull();
  });

  test('fires on exactly the Nth step', () => {
    const t = new MilestoneTracker(3);
    t.record(4, ['read_file'], emptySet, emptySet);
    t.record(4, ['read_file'], emptySet, emptySet);
    const ms = t.record(4, ['read_file'], emptySet, emptySet);
    expect(ms).not.toBeNull();
    expect(ms.fire).toBe(true);
  });

  test('snapshot has correct stepCount and phaseNum', () => {
    const t = new MilestoneTracker(2);
    t.record(3, ['bash'], emptySet, emptySet);
    const ms = t.record(3, ['bash'], emptySet, emptySet);
    expect(ms.stepCount).toBe(2);
    expect(ms.phaseNum).toBe(1);
  });

  test('linesBack accumulates correctly across steps', () => {
    const t = new MilestoneTracker(3);
    t.record(4, ['read_file'], emptySet, emptySet);
    t.record(6, ['read_file'], emptySet, emptySet);
    const ms = t.record(5, ['read_file'], emptySet, emptySet);
    expect(ms.linesBack).toBe(15);
  });

  test('toolCounts in snapshot reflects only current phase', () => {
    const t = new MilestoneTracker(2);
    t.record(3, ['bash'], emptySet, emptySet);
    t.record(3, ['bash'], emptySet, emptySet);
    // Phase 1 fired — now track phase 2
    t.record(3, ['write_file'], emptySet, emptySet);
    const ms = t.record(3, ['write_file'], emptySet, emptySet);
    expect(ms.toolCounts.has('bash')).toBe(false);
    expect(ms.toolCounts.get('write_file')).toBe(2);
  });

  test('phase state resets after milestone fires', () => {
    const t = new MilestoneTracker(2);
    t.record(3, ['bash'], emptySet, emptySet);
    t.record(3, ['bash'], emptySet, emptySet); // fires phase 1
    // Fresh phase 2
    expect(t.record(5, ['read_file'], emptySet, emptySet)).toBeNull();
    const ms = t.record(5, ['read_file'], emptySet, emptySet);
    expect(ms).not.toBeNull();
    expect(ms.linesBack).toBe(10);
    expect(ms.phaseNum).toBe(2);
  });

  test('disabled when N=0 — always returns null', () => {
    const t = new MilestoneTracker(0);
    for (let i = 0; i < 20; i++) {
      expect(t.record(4, ['bash'], emptySet, emptySet)).toBeNull();
    }
  });

  test('snapshot filesRead and filesModified are copies', () => {
    const t = new MilestoneTracker(1);
    const fr = new Set(['a.js']);
    const fm = new Set(['b.js']);
    const ms = t.record(3, ['write_file'], fr, fm);
    // Mutate originals — snapshot should be unaffected
    fr.add('c.js');
    fm.add('d.js');
    expect(ms.filesRead.size).toBe(1);
    expect(ms.filesModified.size).toBe(1);
  });

  test('phaseName inferred from dominant tool type', () => {
    const t = new MilestoneTracker(3);
    t.record(3, ['read_file', 'read_file'], emptySet, emptySet);
    t.record(3, ['glob', 'grep'], emptySet, emptySet);
    const ms = t.record(3, ['read_file'], emptySet, emptySet);
    expect(ms.phaseName).toBe('Exploration');
  });
});

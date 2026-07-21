import { describe, expect, it } from 'vitest';
import { mergeQuotaStates, preferQuotaState, upsertQuotaState } from './merge.js';
import type { QuotaState } from './types.js';

function state(partial: Partial<QuotaState> & Pick<QuotaState, 'service' | 'lastUpdated'>): QuotaState {
  return { ...partial };
}

describe('preferQuotaState', () => {
  it('keeps the reading with the newer lastUpdated', () => {
    const older = state({ service: 'claude', lastUpdated: 100, weeklyPct: 50 });
    const newer = state({ service: 'claude', lastUpdated: 200, weeklyPct: 10 });
    expect(preferQuotaState(older, newer)).toBe(newer);
    expect(preferQuotaState(newer, older)).toBe(newer);
  });

  it('on equal lastUpdated prefers the richer state', () => {
    const sparse = state({ service: 'claude', lastUpdated: 100, weeklyPct: 40 });
    const rich = state({
      service: 'claude',
      lastUpdated: 100,
      sessionPct: 80,
      weeklyPct: 40,
      sessionResetsAt: 1,
      weeklyResetsAt: 2,
      subcategories: [{ name: 'Sonnet', usedPct: 10, label: '90% left' }],
    });
    expect(preferQuotaState(sparse, rich)).toBe(rich);
    expect(preferQuotaState(rich, sparse)).toBe(rich);
  });

  it('on equal lastUpdated and equal richness prefers incoming', () => {
    const a = state({ service: 'codex', lastUpdated: 50, weeklyPct: 20 });
    const b = state({ service: 'codex', lastUpdated: 50, weeklyPct: 99 });
    expect(preferQuotaState(a, b)).toBe(b);
  });
});

describe('upsertQuotaState', () => {
  it('appends when the service is new', () => {
    const base = [state({ service: 'claude', lastUpdated: 1, weeklyPct: 50 })];
    const incoming = state({ service: 'codex', lastUpdated: 2, weeklyPct: 30 });
    const result = upsertQuotaState(base, incoming);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.service)).toEqual(['claude', 'codex']);
    expect(base).toHaveLength(1);
  });

  it('replaces with fresher reading for the same service', () => {
    const base = [state({ service: 'claude', lastUpdated: 1, weeklyPct: 50 })];
    const incoming = state({ service: 'claude', lastUpdated: 9, weeklyPct: 12 });
    const result = upsertQuotaState(base, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]?.weeklyPct).toBe(12);
    expect(result[0]?.lastUpdated).toBe(9);
  });

  it('prefers fresher sparse reading over older rich reading', () => {
    const olderRich = state({
      service: 'claude',
      lastUpdated: 1,
      sessionPct: 90,
      weeklyPct: 80,
      sessionResetsAt: 1,
      weeklyResetsAt: 2,
    });
    const fresherSparse = state({ service: 'claude', lastUpdated: 9, weeklyPct: 5 });
    const result = upsertQuotaState([olderRich], fresherSparse);
    expect(result[0]?.lastUpdated).toBe(9);
    expect(result[0]?.weeklyPct).toBe(5);
    expect(result[0]?.sessionPct).toBeUndefined();
  });

  it('keeps existing when incoming is older', () => {
    const base = [state({ service: 'copilot', lastUpdated: 100, weeklyPct: 70 })];
    const incoming = state({ service: 'copilot', lastUpdated: 10, weeklyPct: 1 });
    const result = upsertQuotaState(base, incoming);
    expect(result[0]?.weeklyPct).toBe(70);
  });
});

describe('mergeQuotaStates', () => {
  it('returns empty when both lists are empty', () => {
    expect(mergeQuotaStates([], [])).toEqual([]);
  });

  it('returns a copy of the non-empty side when the other is empty', () => {
    const only = [state({ service: 'claude', lastUpdated: 1, sessionPct: 90 })];
    expect(mergeQuotaStates(only, [])).toEqual(only);
    expect(mergeQuotaStates([], only)).toEqual(only);
    expect(mergeQuotaStates(only, [])).not.toBe(only);
  });

  it('keeps services present on only one side (partial merge)', () => {
    const base = [
      state({ service: 'claude', lastUpdated: 5, weeklyPct: 40 }),
      state({ service: 'copilot', lastUpdated: 5 }),
    ];
    const incoming = [state({ service: 'claude', lastUpdated: 6, weeklyPct: 30 })];
    const result = mergeQuotaStates(base, incoming);
    expect(result.map((s) => s.service).sort()).toEqual(['claude', 'copilot']);
    expect(result.find((s) => s.service === 'claude')?.weeklyPct).toBe(30);
    expect(result.find((s) => s.service === 'copilot')?.lastUpdated).toBe(5);
  });

  it('prefers fresher per service across full lists', () => {
    const base = [
      state({ service: 'claude', lastUpdated: 10, weeklyPct: 80 }),
      state({ service: 'codex', lastUpdated: 20, weeklyPct: 50 }),
    ];
    const incoming = [
      state({ service: 'claude', lastUpdated: 5, weeklyPct: 10 }),
      state({ service: 'codex', lastUpdated: 30, weeklyPct: 15 }),
    ];
    const result = mergeQuotaStates(base, incoming);
    expect(result.find((s) => s.service === 'claude')?.weeklyPct).toBe(80);
    expect(result.find((s) => s.service === 'codex')?.weeklyPct).toBe(15);
  });

  it('on equal lastUpdated prefers richer reading', () => {
    const base = [state({ service: 'claude', lastUpdated: 1, weeklyPct: 50 })];
    const incoming = [
      state({
        service: 'claude',
        lastUpdated: 1,
        weeklyPct: 50,
        sessionPct: 20,
        sessionResetsAt: 99,
      }),
    ];
    const result = mergeQuotaStates(base, incoming);
    expect(result[0]?.sessionPct).toBe(20);
  });
});

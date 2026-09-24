import { describe, expect, it } from 'vitest';
import { mapCursorUsageSummary } from './cursor.js';

const END = '2026-10-15T00:00:00.000Z';

function summary(plan: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    billingCycleStart: '2026-09-15T00:00:00.000Z',
    billingCycleEnd: END,
    membershipType: 'pro',
    isUnlimited: false,
    individualUsage: { plan: { enabled: true, ...plan } },
    ...extra,
  };
}

describe('mapCursorUsageSummary', () => {
  it('uses the pool with the least remaining as the monthly percent', () => {
    const state = mapCursorUsageSummary(
      summary({ used: 900, limit: 2000, autoPercentUsed: 39.9, apiPercentUsed: 97.2, totalPercentUsed: 44.7 }),
      7,
    );
    expect(state).toEqual({
      service: 'cursor',
      monthlyPct: 3,
      monthlyResetsAt: Date.parse(END),
      lastUpdated: 7,
    });
  });

  it('falls back to used and limit when percent fields are absent', () => {
    const state = mapCursorUsageSummary(summary({ used: 500, limit: 2000 }), 1);
    expect(state.monthlyPct).toBe(75);
  });

  it('reports usage unknown for an unlimited plan', () => {
    const state = mapCursorUsageSummary(summary({ used: 1, limit: 0 }, { isUnlimited: true }), 1);
    expect(state).toEqual({ service: 'cursor', honesty: 'usage_unknown', lastUpdated: 1 });
  });

  it('never invents 100% when the shape is unknown', () => {
    for (const body of [null, 'x', {}, summary({ limit: 0 }), { individualUsage: {} }]) {
      const state = mapCursorUsageSummary(body, 1);
      expect(state.monthlyPct).toBeUndefined();
      expect(state.honesty).toBe('usage_unknown');
    }
  });

  it('omits the reset time when the cycle end is not a date', () => {
    const state = mapCursorUsageSummary(
      summary({ totalPercentUsed: 10 }, { billingCycleEnd: 'soon' }),
      1,
    );
    expect(state.monthlyPct).toBe(90);
    expect(state.monthlyResetsAt).toBeUndefined();
  });
});

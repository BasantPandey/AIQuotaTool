import { describe, expect, it } from 'vitest';
import {
  combineGrokQuotaState,
  extractGrokWeeklyUsage,
  grokBrowserSessionRequired,
  grokNotConnected,
  grokUsageUnknown,
  mapGrokRateLimits,
  mapGrokWeeklyUsage,
} from './grok.js';

describe('grok honest builders', () => {
  it('usage_unknown has no remaining percentages', () => {
    const s = grokUsageUnknown(1_700_000_000_000);
    expect(s).toEqual({
      service: 'grok',
      honesty: 'usage_unknown',
      lastUpdated: 1_700_000_000_000,
    });
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
  });

  it('not_connected has no remaining percentages', () => {
    const s = grokNotConnected(42);
    expect(s.service).toBe('grok');
    expect(s.honesty).toBe('not_connected');
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
    expect(s.lastUpdated).toBe(42);
  });

  it('browser_session_required has no remaining percentages (VS Code path)', () => {
    const s = grokBrowserSessionRequired(99);
    expect(s.honesty).toBe('browser_session_required');
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
  });

  it('never fabricates 100% remaining', () => {
    const states = [
      grokUsageUnknown(1),
      grokNotConnected(1),
      grokBrowserSessionRequired(1),
    ];
    for (const s of states) {
      expect(s.weeklyPct).not.toBe(100);
      expect(s.sessionPct).not.toBe(100);
    }
  });
});

describe('mapGrokRateLimits', () => {
  it('maps remainingTokens/totalTokens to session remaining %', () => {
    const s = mapGrokRateLimits(
      { remainingTokens: 70, totalTokens: 100, windowSizeSeconds: 7200 },
      1_000,
    );
    expect(s.service).toBe('grok');
    expect(s.sessionPct).toBe(70);
    expect(s.sessionResetsAt).toBe(1_000 + 7200 * 1000);
    expect(s.weeklyPct).toBeUndefined();
    expect(s.honesty).toBeUndefined();
  });

  it('falls back to remainingQueries/totalQueries', () => {
    const s = mapGrokRateLimits({ remainingQueries: 3, totalQueries: 10 }, 50);
    expect(s.sessionPct).toBe(30);
    expect(s.lastUpdated).toBe(50);
  });

  it('uses lowEffortRateLimits when top-level counters missing', () => {
    const s = mapGrokRateLimits(
      {
        lowEffortRateLimits: { remainingQueries: 5, totalQueries: 20, waitTimeSeconds: 60 },
      },
      10,
    );
    expect(s.sessionPct).toBe(25);
    expect(s.sessionResetsAt).toBe(10 + 60_000);
  });

  it('fails closed to usage_unknown without inventing 100', () => {
    expect(mapGrokRateLimits({}, 1)).toEqual(grokUsageUnknown(1));
    expect(mapGrokRateLimits({ remainingTokens: 5 }, 2)).toEqual(grokUsageUnknown(2));
    expect(mapGrokRateLimits({ remainingQueries: 1, totalQueries: 0 }, 3)).toEqual(
      grokUsageUnknown(3),
    );
  });
});

describe('mapGrokWeeklyUsage', () => {
  it('maps first-party used % to weekly remaining %', () => {
    const s = mapGrokWeeklyUsage({ usedPct: 30 }, 10);
    expect(s).toEqual({
      service: 'grok',
      weeklyPct: 70,
      lastUpdated: 10,
    });
    expect(s.honesty).toBeUndefined();
    expect(s.sessionPct).toBeUndefined();
  });

  it('includes weekly reset when provided', () => {
    const reset = 1_800_000_000_000;
    const s = mapGrokWeeklyUsage({ usedPct: 0, weeklyResetsAt: reset }, 11);
    expect(s.weeklyPct).toBe(100);
    expect(s.weeklyResetsAt).toBe(reset);
  });

  it('never invents session remaining on valid weekly map', () => {
    expect(mapGrokWeeklyUsage({ usedPct: 50 }, 1).sessionPct).toBeUndefined();
  });

  it('rejects out-of-range or non-finite used % with usage_unknown (no invented ring)', () => {
    expect(mapGrokWeeklyUsage({ usedPct: Number.NaN }, 12)).toEqual(grokUsageUnknown(12));
    expect(mapGrokWeeklyUsage({ usedPct: -5 }, 1)).toEqual(grokUsageUnknown(1));
    expect(mapGrokWeeklyUsage({ usedPct: 150 }, 1)).toEqual(grokUsageUnknown(1));
  });
});

describe('extractGrokWeeklyUsage', () => {
  it('reads used percentage from root and nested usage objects', () => {
    expect(extractGrokWeeklyUsage({ usedPct: 25 })).toEqual({ usedPct: 25 });
    expect(extractGrokWeeklyUsage({ usage: { usage_percentage: 40 } })).toEqual({
      usedPct: 40,
    });
  });

  it('reads first-party GetGrokCreditsConfig creditUsagePercent + period end', () => {
    const endSec = 1_800_000_000;
    expect(
      extractGrokWeeklyUsage({
        config: {
          creditUsagePercent: 33,
          currentPeriod: { type: 20, end: { seconds: endSec, nanos: 0 } },
          productUsage: [{ product: 'CHAT', usagePercent: 10 }],
        },
      }),
    ).toEqual({ usedPct: 33, weeklyResetsAt: endSec * 1000 });
  });

  it('ignores short-window rate-limit bags without used%', () => {
    expect(
      extractGrokWeeklyUsage({ remainingQueries: 5, totalQueries: 10, windowSizeSeconds: 7200 }),
    ).toBeNull();
  });

  it('rejects absolute counts outside 0–100 and non-objects', () => {
    expect(extractGrokWeeklyUsage({ usedPct: 250 })).toBeNull();
    expect(extractGrokWeeklyUsage({ remainingMessages: 10 })).toBeNull();
    expect(extractGrokWeeklyUsage(null)).toBeNull();
    expect(extractGrokWeeklyUsage('nope')).toBeNull();
  });
});

describe('combineGrokQuotaState', () => {
  it('merges session from rate-limits with weekly from SuperGrok pool', () => {
    const session = mapGrokRateLimits({ remainingTokens: 50, totalTokens: 100 }, 1);
    const weekly = mapGrokWeeklyUsage({ usedPct: 20, weeklyResetsAt: 9_000 }, 2);
    const combined = combineGrokQuotaState(session, weekly, 3);
    expect(combined).toEqual({
      service: 'grok',
      sessionPct: 50,
      weeklyPct: 80,
      weeklyResetsAt: 9_000,
      lastUpdated: 3,
    });
  });

  it('keeps only weekly when session is honesty-only', () => {
    const combined = combineGrokQuotaState(
      grokUsageUnknown(1),
      mapGrokWeeklyUsage({ usedPct: 10 }, 2),
      5,
    );
    expect(combined.sessionPct).toBeUndefined();
    expect(combined.weeklyPct).toBe(90);
    expect(combined.honesty).toBeUndefined();
  });

  it('fails closed to usage_unknown when both sides lack rings', () => {
    expect(combineGrokQuotaState(grokUsageUnknown(1), null, 7)).toEqual(grokUsageUnknown(7));
  });
});

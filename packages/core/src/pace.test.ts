import { describe, expect, it } from 'vitest';
import { appendPollHistory, mergeQuotaStates, upsertQuotaState } from './merge.js';
import { paceWarning, QUOTA_HISTORY_CAP } from './pace.js';
import type { QuotaSample, QuotaState } from './types.js';

const MIN = 60_000;
const RESET = 9_000_000;

function reading(lastUpdated: number, sessionPct: number, sessionResetsAt = RESET): QuotaState {
  return { service: 'claude', lastUpdated, sessionPct, sessionResetsAt };
}

describe('appendPollHistory', () => {
  it('stores the first successful poll', () => {
    const result = appendPollHistory(undefined, reading(1_000, 80));
    expect(result.history).toEqual([{ at: 1_000, remaining: 80, limit: 100, resetAt: RESET }]);
  });

  it('appends a newer poll and keeps the older sample', () => {
    const first = appendPollHistory(undefined, reading(1_000, 80));
    const second = appendPollHistory(first, reading(2_000, 70));
    expect(second.history).toEqual([
      { at: 1_000, remaining: 80, limit: 100, resetAt: RESET },
      { at: 2_000, remaining: 70, limit: 100, resetAt: RESET },
    ]);
    expect(second.sessionPct).toBe(70);
  });

  it('does not append an older poll', () => {
    const current = appendPollHistory(undefined, reading(2_000, 70));
    const result = appendPollHistory(current, reading(1_000, 90));
    expect(result).toBe(current);
    expect(result.sessionPct).toBe(70);
  });

  it('does not append the same poll twice', () => {
    const current = appendPollHistory(undefined, reading(2_000, 70));
    const again = appendPollHistory(current, reading(2_000, 70));
    expect(again.history).toHaveLength(1);
  });

  it('stores each window that has a reset time', () => {
    const state: QuotaState = {
      service: 'claude',
      lastUpdated: 5,
      sessionPct: 80,
      sessionResetsAt: 10,
      weeklyPct: 40,
      weeklyResetsAt: 20,
      monthlyPct: 10,
    };
    expect(appendPollHistory(undefined, state).history).toEqual([
      { at: 5, remaining: 80, limit: 100, resetAt: 10 },
      { at: 5, remaining: 40, limit: 100, resetAt: 20 },
    ]);
  });

  it('does not invent a sample when the reset time is absent', () => {
    const state: QuotaState = { service: 'claude', lastUpdated: 1_000, weeklyPct: 40 };
    expect(appendPollHistory(undefined, state).history).toBeUndefined();
  });

  it('keeps only the last 48 samples', () => {
    let state = appendPollHistory(undefined, reading(0, 100));
    for (let i = 1; i <= QUOTA_HISTORY_CAP; i += 1) {
      state = appendPollHistory(state, reading(i * 1_000, 100 - i));
    }
    expect(state.history).toHaveLength(QUOTA_HISTORY_CAP);
    expect(state.history?.[0]?.at).toBe(1_000);
    expect(state.history?.[QUOTA_HISTORY_CAP - 1]?.at).toBe(QUOTA_HISTORY_CAP * 1_000);
  });

  it('merge keeps samples across polls', () => {
    const first = mergeQuotaStates([], [reading(1_000, 80)]);
    const second = mergeQuotaStates(first, [reading(2_000, 60)]);
    expect(second[0]?.history).toHaveLength(2);
    expect(second[0]?.sessionPct).toBe(60);
  });

  it('upsert keeps two connections apart', () => {
    const claude = upsertQuotaState([], reading(1_000, 80));
    const both = upsertQuotaState(claude, {
      service: 'codex',
      lastUpdated: 1_000,
      weeklyPct: 50,
      weeklyResetsAt: 30,
    });
    expect(both).toHaveLength(2);
    expect(both[0]?.history).toHaveLength(1);
    expect(both[1]?.history).toEqual([{ at: 1_000, remaining: 50, limit: 100, resetAt: 30 }]);
  });
});

function series(points: Array<[number, number]>, resetAt = RESET): QuotaState {
  const history: QuotaSample[] = points.map(([at, remaining]) => ({
    at,
    remaining,
    limit: 100,
    resetAt,
  }));
  const last = points[points.length - 1];
  return {
    service: 'claude',
    lastUpdated: last?.[0] ?? 0,
    sessionPct: last?.[1] ?? 0,
    sessionResetsAt: resetAt,
    history,
  };
}

describe('paceWarning', () => {
  it('warns when three samples fall across 10 minutes', () => {
    const state = series([
      [0, 90],
      [10 * MIN, 80],
      [20 * MIN, 70],
    ]);
    expect(paceWarning(state)).toBe('At this pace, the session runs out in 1h 10m.');
  });

  it('stays quiet when the samples are flat', () => {
    const state = series([
      [0, 80],
      [10 * MIN, 80],
      [20 * MIN, 80],
    ]);
    expect(paceWarning(state)).toBeNull();
  });

  it('stays quiet when the samples rise', () => {
    const state = series([
      [0, 60],
      [10 * MIN, 70],
      [20 * MIN, 80],
    ]);
    expect(paceWarning(state)).toBeNull();
  });

  it('stays quiet when there are fewer than three samples', () => {
    expect(
      paceWarning(
        series([
          [0, 90],
          [20 * MIN, 70],
        ]),
      ),
    ).toBeNull();
  });

  it('stays quiet when the span is under 10 minutes', () => {
    expect(
      paceWarning(
        series([
          [0, 90],
          [4 * MIN, 80],
          [9 * MIN, 70],
        ]),
      ),
    ).toBeNull();
  });

  it('uses the window that runs out first', () => {
    const sessionReset = 11;
    const weeklyReset = 22;
    const history: QuotaSample[] = [
      { at: 0, remaining: 50, limit: 100, resetAt: sessionReset },
      { at: 10 * MIN, remaining: 40, limit: 100, resetAt: sessionReset },
      { at: 20 * MIN, remaining: 30, limit: 100, resetAt: sessionReset },
      { at: 0, remaining: 90, limit: 100, resetAt: weeklyReset },
      { at: 10 * MIN, remaining: 80, limit: 100, resetAt: weeklyReset },
      { at: 20 * MIN, remaining: 70, limit: 100, resetAt: weeklyReset },
    ];
    const state: QuotaState = {
      service: 'claude',
      lastUpdated: 20 * MIN,
      sessionPct: 30,
      sessionResetsAt: sessionReset,
      weeklyPct: 70,
      weeklyResetsAt: weeklyReset,
      history,
    };
    expect(paceWarning(state)).toBe('At this pace, the session runs out in 30m.');
  });

  it('ignores samples from an old reset time', () => {
    const state = series(
      [
        [0, 90],
        [10 * MIN, 80],
        [20 * MIN, 70],
      ],
      111,
    );
    state.sessionResetsAt = 222;
    expect(paceWarning(state)).toBeNull();
  });

  it('says the window runs out now when nothing is left', () => {
    const state = series([
      [0, 20],
      [10 * MIN, 10],
      [20 * MIN, 0],
    ]);
    expect(paceWarning(state)).toBe('At this pace, the session runs out now.');
  });

  it('uses the monthly label when that window runs out first', () => {
    const resetAt = 77;
    const history: QuotaSample[] = [0, 1, 2].map((step) => ({
      at: step * 10 * MIN,
      remaining: 30 - step * 10,
      limit: 100,
      resetAt,
    }));
    const state: QuotaState = {
      service: 'claude',
      lastUpdated: 20 * MIN,
      monthlyPct: 10,
      monthlyResetsAt: resetAt,
      monthlyLabel: 'Premium requests',
      history,
    };
    expect(paceWarning(state)).toBe('At this pace, Premium requests runs out in 10m.');
  });
});

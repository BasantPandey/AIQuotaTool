import { describe, expect, it } from 'vitest';
import { lowestPressureAmong, pressureRemaining } from './pressure.js';
import type { QuotaState } from './types.js';

function claude(sessionPct?: number, weeklyPct?: number): QuotaState {
  return {
    service: 'claude',
    sessionPct,
    weeklyPct,
    lastUpdated: 1,
  };
}

function copilotHonesty(): QuotaState {
  return {
    service: 'copilot',
    honesty: 'seat_active_usage_unknown',
    lastUpdated: 1,
  };
}

describe('pressureRemaining', () => {
  it('returns the min of session and weekly when both are set', () => {
    expect(pressureRemaining(claude(40, 10))).toBe(10);
    expect(pressureRemaining(claude(5, 80))).toBe(5);
  });

  it('returns the only defined remaining field', () => {
    expect(pressureRemaining(claude(33, undefined))).toBe(33);
    expect(pressureRemaining(claude(undefined, 12))).toBe(12);
  });

  it('returns undefined for honesty-only states (never invents 100)', () => {
    expect(pressureRemaining(copilotHonesty())).toBeUndefined();
    expect(pressureRemaining({ service: 'codex', lastUpdated: 1 })).toBeUndefined();
  });
});

describe('lowestPressureAmong', () => {
  it('ignores honesty-only services so they do not invent full remaining', () => {
    expect(lowestPressureAmong([copilotHonesty()])).toBeUndefined();
    expect(lowestPressureAmong([copilotHonesty(), claude(7, 50)])).toBe(7);
  });

  it('returns the global min across services with real percentages', () => {
    expect(lowestPressureAmong([claude(40, 20), claude(15, 90)])).toBe(15);
  });

  it('returns undefined for an empty list', () => {
    expect(lowestPressureAmong([])).toBeUndefined();
  });
});

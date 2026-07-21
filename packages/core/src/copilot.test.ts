import { describe, expect, it } from 'vitest';
import {
  copilotAuthUnavailable,
  copilotNoPlan,
  copilotSeatActiveUsageUnknown,
} from './copilot.js';

describe('copilot honest builders', () => {
  it('seat_active_usage_unknown has no remaining percentages', () => {
    const s = copilotSeatActiveUsageUnknown(1_700_000_000_000);
    expect(s).toEqual({
      service: 'copilot',
      honesty: 'seat_active_usage_unknown',
      lastUpdated: 1_700_000_000_000,
    });
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
  });

  it('no_plan has no remaining percentages', () => {
    const s = copilotNoPlan(42);
    expect(s.service).toBe('copilot');
    expect(s.honesty).toBe('no_plan');
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
    expect(s.lastUpdated).toBe(42);
  });

  it('auth_unavailable has no remaining percentages', () => {
    const s = copilotAuthUnavailable(99);
    expect(s.honesty).toBe('auth_unavailable');
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
  });

  it('never fabricates 100% remaining', () => {
    const states = [
      copilotSeatActiveUsageUnknown(1),
      copilotNoPlan(1),
      copilotAuthUnavailable(1),
    ];
    for (const s of states) {
      expect(s.weeklyPct).not.toBe(100);
      expect(s.sessionPct).not.toBe(100);
    }
  });
});

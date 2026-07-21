import { describe, expect, it } from 'vitest';
import {
  copilotAuthUnavailable,
  copilotNoPlan,
  copilotSeatActiveUsageUnknown,
  mapCopilotSeatStatus,
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

describe('mapCopilotSeatStatus', () => {
  it('maps 404 to no_plan', () => {
    expect(mapCopilotSeatStatus(404, 10)).toEqual(copilotNoPlan(10));
  });

  it('maps 2xx to seat_active_usage_unknown (never invents remaining %)', () => {
    const s = mapCopilotSeatStatus(200, 11);
    expect(s).toEqual(copilotSeatActiveUsageUnknown(11));
    expect(s.sessionPct).toBeUndefined();
    expect(s.weeklyPct).toBeUndefined();
  });

  it('maps 401/403/5xx to auth_unavailable', () => {
    expect(mapCopilotSeatStatus(401, 12).honesty).toBe('auth_unavailable');
    expect(mapCopilotSeatStatus(403, 12).honesty).toBe('auth_unavailable');
    expect(mapCopilotSeatStatus(500, 12).honesty).toBe('auth_unavailable');
  });
});

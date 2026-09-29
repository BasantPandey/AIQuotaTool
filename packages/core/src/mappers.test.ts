import { describe, expect, it } from 'vitest';
import { mapClaudeUsage, mapCodexUsage, type ClaudeUsageResponse, type WhamUsageResponse } from './mappers.js';

describe('mapClaudeUsage', () => {
  const fixture: ClaudeUsageResponse = {
    five_hour: { utilization: 25, resets_at: '2026-07-21T12:00:00.000Z' },
    seven_day: { utilization: 40, resets_at: '2026-07-28T00:00:00.000Z' },
    seven_day_sonnet: { utilization: 10, resets_at: '2026-07-28T00:00:00.000Z' },
    seven_day_opus: null,
    seven_day_cowork: { utilization: 50, resets_at: '2026-07-28T00:00:00.000Z' },
    seven_day_omelette: null,
  };

  it('maps remaining % and resets from utilization buckets', () => {
    const state = mapClaudeUsage(fixture, 1_700_000_000_000);
    expect(state.service).toBe('claude');
    expect(state.sessionPct).toBe(75);
    expect(state.weeklyPct).toBe(60);
    expect(state.sessionResetsAt).toBe(Date.parse('2026-07-21T12:00:00.000Z'));
    expect(state.weeklyResetsAt).toBe(Date.parse('2026-07-28T00:00:00.000Z'));
    expect(state.lastUpdated).toBe(1_700_000_000_000);
  });

  it('includes only non-null subcategory buckets with remaining labels', () => {
    const state = mapClaudeUsage(fixture, 1);
    expect(state.subcategories?.map((s) => s.name)).toEqual(['Sonnet', 'Daily Routines']);
    expect(state.subcategories?.[0]?.usedPct).toBe(10);
    expect(state.subcategories?.[0]?.label).toBe('90% left');
  });

  it('omits subcategories when no optional buckets are present', () => {
    const bare: ClaudeUsageResponse = {
      ...fixture,
      seven_day_sonnet: null,
      seven_day_cowork: null,
      seven_day_omelette: null,
    };
    const state = mapClaudeUsage(bare, 1);
    expect(state.subcategories).toBeUndefined();
  });
  it('uses the weekly bucket when five_hour is null', () => {
    const state = mapClaudeUsage({ ...fixture, five_hour: null }, 1);
    expect(state.sessionPct).toBeUndefined();
    expect(state.sessionResetsAt).toBeUndefined();
    expect(state.weeklyPct).toBe(60);
  });

  it('omits the reset time when resets_at is null', () => {
    const state = mapClaudeUsage(
      { ...fixture, five_hour: { utilization: 0, resets_at: null } },
      1,
    );
    expect(state.sessionPct).toBe(100);
    expect(state.sessionResetsAt).toBeUndefined();
  });

  it('marks usage unknown when no bucket has a number', () => {
    const state = mapClaudeUsage({ ...fixture, five_hour: null, seven_day: null }, 1);
    expect(state.sessionPct).toBeUndefined();
    expect(state.weeklyPct).toBeUndefined();
    expect(state.honesty).toBe('usage_unknown');
  });
});

describe('mapCodexUsage', () => {
  const H = 3600;
  const fixture: WhamUsageResponse = {
    plan_type: 'plus',
    rate_limit: {
      primary_window: { used_percent: 30, limit_window_seconds: 5 * H, reset_after_seconds: 3600, reset_at: 1_784_000_000 },
      secondary_window: { used_percent: 70, limit_window_seconds: 168 * H, reset_after_seconds: 86_400, reset_at: 1_784_500_000 },
    },
  };

  it('maps primary/secondary used_percent to remaining session/weekly', () => {
    const state = mapCodexUsage(fixture, 99);
    expect(state.service).toBe('codex');
    expect(state.sessionPct).toBe(70);
    expect(state.weeklyPct).toBe(30);
    expect(state.lastUpdated).toBe(99);
  });

  it('reads reset_at as Unix seconds', () => {
    const state = mapCodexUsage(fixture, 99);
    expect(state.sessionResetsAt).toBe(1_784_000_000_000);
    expect(state.weeklyResetsAt).toBe(1_784_500_000_000);
  });

  it('accepts top-level windows without rate_limit wrapper', () => {
    const flat: WhamUsageResponse = {
      primary_window: { used_percent: 0, limit_window_seconds: 5 * H, reset_at: 1_784_000_000 },
      secondary_window: { used_percent: 100, limit_window_seconds: 168 * H, reset_at: 1_784_500_000 },
    };
    const state = mapCodexUsage(flat, 1);
    expect(state.sessionPct).toBe(100);
    expect(state.weeklyPct).toBe(0);
  });

  it('uses reset_after_seconds when reset_at is absent', () => {
    const state = mapCodexUsage(
      { primary_window: { used_percent: 10, limit_window_seconds: 5 * H, reset_after_seconds: 60 } },
      1_000_000,
    );
    expect(state.sessionResetsAt).toBe(1_060_000);
  });

  it('omits the reset time when the payload has none', () => {
    const state = mapCodexUsage({ primary_window: { used_percent: 10, limit_window_seconds: 5 * H } }, 1);
    expect(state.sessionResetsAt).toBeUndefined();
  });

  it('does not invent a window that the plan does not have', () => {
    const state = mapCodexUsage(
      { rate_limit: { primary_window: { used_percent: 40, limit_window_seconds: 5 * H, reset_at: 1_784_000_000 } } },
      1,
    );
    expect(state.sessionPct).toBe(60);
    expect(state.weeklyPct).toBeUndefined();
    expect(state.weeklyResetsAt).toBeUndefined();
  });

  it('labels a lone weekly window as weekly, not session', () => {
    const state = mapCodexUsage(
      { rate_limit: { primary_window: { used_percent: 25, limit_window_seconds: 168 * H, reset_at: 1_784_500_000 } } },
      1,
    );
    expect(state.sessionPct).toBeUndefined();
    expect(state.weeklyPct).toBe(75);
    expect(state.weeklyResetsAt).toBe(1_784_500_000_000);
  });

  it('marks usage unknown when no window is present', () => {
    const state = mapCodexUsage({ plan_type: 'free' }, 1);
    expect(state.sessionPct).toBeUndefined();
    expect(state.weeklyPct).toBeUndefined();
    expect(state.honesty).toBe('usage_unknown');
  });
});

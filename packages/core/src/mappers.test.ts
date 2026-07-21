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
});

describe('mapCodexUsage', () => {
  const fixture: WhamUsageResponse = {
    rate_limit: {
      primary_window: { used_percent: 30, reset_at: '2026-07-21T18:00:00.000Z' },
      secondary_window: { used_percent: 70, reset_at: '2026-07-27T00:00:00.000Z' },
    },
  };

  it('maps primary/secondary used_percent to remaining session/weekly', () => {
    const state = mapCodexUsage(fixture, 99);
    expect(state.service).toBe('codex');
    expect(state.sessionPct).toBe(70);
    expect(state.weeklyPct).toBe(30);
    expect(state.sessionResetsAt).toBe(Date.parse('2026-07-21T18:00:00.000Z'));
    expect(state.weeklyResetsAt).toBe(Date.parse('2026-07-27T00:00:00.000Z'));
    expect(state.lastUpdated).toBe(99);
  });

  it('accepts top-level windows without rate_limit wrapper', () => {
    const flat: WhamUsageResponse = {
      primary_window: { used_percent: 0, reset_at: '2026-07-21T18:00:00.000Z' },
      secondary_window: { used_percent: 100, reset_at: '2026-07-27T00:00:00.000Z' },
    };
    const state = mapCodexUsage(flat, 1);
    expect(state.sessionPct).toBe(100);
    expect(state.weeklyPct).toBe(0);
  });

  it('falls back when reset_at is missing or invalid', () => {
    const broken: WhamUsageResponse = {
      primary_window: { used_percent: 10, reset_at: 'not-a-date' },
      secondary_window: { used_percent: 10, reset_at: '' },
    };
    const t = 1_000_000;
    const state = mapCodexUsage(broken, t);
    expect(state.sessionResetsAt).toBe(t + 5 * 3600_000);
    expect(state.weeklyResetsAt).toBe(t + 5 * 3600_000);
  });
});

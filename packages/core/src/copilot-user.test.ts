import { describe, expect, it } from 'vitest';
import { mapCopilotUser } from './copilot-user.js';
import { pressureRemaining } from './pressure.js';

const NOW = 1_700_000_000_000;

describe('mapCopilotUser', () => {
  it('Pro plan: premium requests give the monthly percent left and the reset time', () => {
    const state = mapCopilotUser(
      {
        copilot_plan: 'individual_pro',
        quota_reset_date_utc: '2026-10-01T00:00:00.000Z',
        quota_snapshots: {
          chat: { unlimited: true, percent_remaining: 100, overage_permitted: false, overage_count: 0 },
          completions: { unlimited: true, percent_remaining: 100, overage_permitted: false, overage_count: 0 },
          premium_interactions: { unlimited: false, entitlement: '300', percent_remaining: 54.3, quota_reset_at: 1_790_000_000 },
        },
      },
      NOW,
    )!;
    expect(state.monthlyPct).toBe(54);
    expect(state.monthlyResetsAt).toBe(1_790_000_000_000);
    expect(state.monthlyLabel).toBe('Premium requests');
    expect(state.subcategories).toBeUndefined();
    expect(state.honesty).toBeUndefined();
  });

  it('accepts entitlement as a number or a string', () => {
    for (const entitlement of [300, '300']) {
      const state = mapCopilotUser({ quota_snapshots: { premium_interactions: { unlimited: false, entitlement, percent_remaining: 20 } } }, NOW);
      expect(state?.monthlyPct).toBe(20);
    }
  });

  it('Free plan: chat and completions each get a bar, and the lowest is the monthly percent', () => {
    const state = mapCopilotUser(
      {
        access_type_sku: 'free_limited_copilot',
        limited_user_reset_date: '2026-10-15',
        quota_snapshots: {
          chat: { unlimited: false, entitlement: '50', percent_remaining: 80 },
          completions: { unlimited: false, entitlement: '2000', percent_remaining: 7.6 },
          premium_interactions: { unlimited: false, entitlement: '0', percent_remaining: 0 },
        },
      },
      NOW,
    )!;
    expect(state.monthlyPct).toBe(8);
    expect(state.monthlyLabel).toBe('Completions (lowest)');
    expect(state.monthlyResetsAt).toBe(Date.parse('2026-10-15'));
    expect(state.subcategories?.map((s) => [s.name, s.label])).toEqual([
      ['Chat', '80% left'],
      ['Completions', '8% left'],
    ]);
  });

  it('an unlimited quota shows credits used, never a percent', () => {
    const state = mapCopilotUser(
      { quota_snapshots: { premium_interactions: { unlimited: true, credits_used: 412, percent_remaining: 100 } } },
      NOW,
    )!;
    expect(state.creditsUsed).toBe(412);
    expect(state.monthlyPct).toBeUndefined();
    expect(pressureRemaining(state)).toBeUndefined();
  });

  it('unlimited with no count says usage unknown, never 100%', () => {
    const state = mapCopilotUser({ quota_snapshots: { chat: { unlimited: true, percent_remaining: 100 } } }, NOW)!;
    expect(state.honesty).toBe('seat_active_usage_unknown');
    expect(state.monthlyPct).toBeUndefined();
  });

  it('clamps the percent to 0..100', () => {
    const state = mapCopilotUser({ quota_snapshots: { premium_interactions: { unlimited: false, entitlement: 5, percent_remaining: -3 } } }, NOW);
    expect(state?.monthlyPct).toBe(0);
  });

  it('an unknown shape returns null, so the host falls back to the seat check', () => {
    for (const body of [
      null,
      'Not Found',
      {},
      { quota_snapshots: {} },
      { quota_snapshots: { chat: { unlimited: 'no' } } },
      { quota_snapshots: { premium_interactions: { unlimited: false, entitlement: '300', percent_remaining: 'half' } } },
    ]) {
      expect(mapCopilotUser(body, NOW)).toBeNull();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { mapPerplexityCredits } from './perplexity.js';

const NOW = 1_700_000_000_000;

describe('mapPerplexityCredits', () => {
  it('gives the monthly percent from the recurring grant and the usage', () => {
    const state = mapPerplexityCredits(
      {
        balance_cents: 7500,
        total_usage_cents: 2500,
        renewal_date_ts: 1_790_000_000,
        credit_grants: [{ type: 'recurring', amount_cents: 10000, expires_at_ts: 1_790_000_000 }],
      },
      NOW,
    );
    expect(state.monthlyPct).toBe(75);
    expect(state.monthlyResetsAt).toBe(1_790_000_000_000);
    expect(state.monthlyLabel).toBe('Monthly credits');
    expect(state.honesty).toBeUndefined();
  });

  it('spends the recurring grant first, so extra grants do not lift the monthly percent', () => {
    const state = mapPerplexityCredits(
      {
        total_usage_cents: 12000,
        credit_grants: [
          { type: 'recurring', amount_cents: 10000 },
          { type: 'purchased', amount_cents: 5000 },
          { type: 'promotional', amount_cents: 500 },
        ],
      },
      NOW,
    );
    expect(state.monthlyPct).toBe(0);
  });

  it('a response with no recurring grant gives no percent', () => {
    const state = mapPerplexityCredits({ total_usage_cents: 0, credit_grants: [{ type: 'promotional', amount_cents: 500 }] }, NOW);
    expect(state.monthlyPct).toBeUndefined();
    expect(state.honesty).toBe('usage_unknown');
  });

  it('an unknown shape never gives 100%', () => {
    for (const body of [null, {}, { credit_grants: [] }, { total_usage_cents: 1, credit_grants: [{ type: 'recurring', amount_cents: '100' }] }]) {
      const state = mapPerplexityCredits(body, NOW);
      expect(state.monthlyPct).toBeUndefined();
      expect(state.honesty).toBe('usage_unknown');
    }
  });
});

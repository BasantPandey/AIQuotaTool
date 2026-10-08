import { describe, expect, it } from 'vitest';
import { describeKey } from './key-card.js';
import { mapCopilotPremiumUsage, mapCursorTeamSpend, mapXaiPrepaidBalance } from './key-providers.js';

describe('mapXaiPrepaidBalance', () => {
  it('reads the inverted ledger total in cents as the credit left', () => {
    const state = mapXaiPrepaidBalance({ changes: [], total: { val: '-1000' } }, 5);
    expect(state.service).toBe('xai');
    expect(state.lastUpdated).toBe(5);
    expect(state.balance).toEqual({ available: true, infos: [{ currency: 'USD', total: '10.00' }] });
    expect(state.honesty).toBeUndefined();
  });

  it('marks a zero ledger as an empty balance', () => {
    const state = mapXaiPrepaidBalance({ total: { val: '0' } }, 1);
    expect(state.balance).toEqual({ available: false, infos: [{ currency: 'USD', total: '0.00' }] });
    expect(state.honesty).toBe('balance_empty');
  });

  it('never shows a negative balance', () => {
    const state = mapXaiPrepaidBalance({ total: { val: '250' } }, 1);
    expect(state.balance?.infos[0]?.total).toBe('0.00');
    expect(state.honesty).toBe('balance_empty');
  });

  it('gives an honest state for an unknown shape', () => {
    expect(mapXaiPrepaidBalance({ total: { val: 'abc' } }, 1).honesty).toBe('balance_unreadable');
    expect(mapXaiPrepaidBalance(null, 1).honesty).toBe('balance_unreadable');
  });
});

describe('mapCursorTeamSpend', () => {
  it('adds the spend of each member on each page in cents', () => {
    const state = mapCursorTeamSpend(
      [
        { teamMemberSpend: [{ spendCents: 1250 }, { spendCents: 50 }], subscriptionCycleStart: 1, totalPages: 2 },
        { teamMemberSpend: [{ spendCents: 700 }], totalPages: 2 },
      ],
      9,
    );
    expect(state).toEqual({ service: 'cursor-team', spend: { amount: 20, currency: 'USD', scope: 'org' }, lastUpdated: 9 });
  });

  it('reads a team with no spend as zero', () => {
    expect(mapCursorTeamSpend([{ teamMemberSpend: [] }], 1).spend?.amount).toBe(0);
  });

  it('gives an honest state for an unknown shape', () => {
    expect(mapCursorTeamSpend([{ teamMemberSpend: [{ spendCents: 'x' }] }], 1).honesty).toBe('usage_unknown');
    expect(mapCursorTeamSpend([{}], 1).honesty).toBe('usage_unknown');
  });
});

describe('mapCopilotPremiumUsage', () => {
  const body = {
    timePeriod: { year: 2026, month: 10 },
    user: 'octocat',
    usageItems: [
      { product: 'Copilot', sku: 'Copilot Premium Request', model: 'Claude Sonnet', unitType: 'requests', grossQuantity: 120, netQuantity: 0, netAmount: 0 },
      { product: 'Copilot', sku: 'Copilot Premium Request', model: 'GPT-5', unitType: 'requests', grossQuantity: 300.5, netQuantity: 20.5, netAmount: 0.82 },
    ],
  };

  it('counts the premium requests used and the amount billed this month', () => {
    const state = mapCopilotPremiumUsage(body, 3);
    expect(state.service).toBe('copilot-premium');
    expect(state.creditsUsed).toBe(420.5);
    expect(state.spend).toEqual({ amount: 0.82, currency: 'USD', scope: 'account' });
    expect(state.lastUpdated).toBe(3);
  });

  it('reads a month with no usage as zero', () => {
    const state = mapCopilotPremiumUsage({ usageItems: [] }, 1);
    expect(state.creditsUsed).toBe(0);
    expect(state.spend?.amount).toBe(0);
  });

  it('gives an honest state for an unknown shape', () => {
    expect(mapCopilotPremiumUsage({ usageItems: [{ grossQuantity: 'x' }] }, 1).honesty).toBe('usage_unknown');
    expect(mapCopilotPremiumUsage({}, 1).honesty).toBe('usage_unknown');
  });

  it('describes the card with the request count, not a percent', () => {
    const view = describeKey({ ...mapCopilotPremiumUsage(body, 3), kind: 'key' });
    expect(view.headline).toBe('420.5 requests');
    expect(view.detail).toBe('this month - $0.82 billed');
    expect(view.pct).toBeUndefined();
  });
});

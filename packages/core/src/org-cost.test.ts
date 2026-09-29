import { describe, expect, it } from 'vitest';
import { mapAnthropicCost, mapOpenAICost, monthStartUtc } from './org-cost.js';
import { describeKey, keyPercent } from './key-card.js';

const NOW = Date.UTC(2026, 8, 30, 15, 0, 0);

describe('monthStartUtc', () => {
  it('is the first day of the month at 00:00 UTC', () => {
    expect(monthStartUtc(NOW).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('mapAnthropicCost', () => {
  it('sums cents from every bucket on every page, in dollars', () => {
    const page1 = {
      data: [
        { starting_at: '2026-09-01T00:00:00Z', ending_at: '2026-09-02T00:00:00Z', results: [{ amount: '123.45', currency: 'USD' }] },
        { starting_at: '2026-09-02T00:00:00Z', ending_at: '2026-09-03T00:00:00Z', results: [{ amount: '1000', currency: 'USD' }, { amount: '76.55', currency: 'USD' }] },
      ],
      has_more: true,
      next_page: 'page_x',
    };
    const page2 = { data: [{ results: [{ amount: '100', currency: 'USD' }] }], has_more: false, next_page: null };
    const state = mapAnthropicCost([page1, page2], NOW);
    expect(state.spend).toEqual({ amount: 13, currency: 'USD', scope: 'org' });
    expect(describeKey(state)).toMatchObject({ headline: '$13.00', detail: 'org spend' });
    expect(keyPercent(state)).toBeUndefined();
  });

  it('an empty month is $0, not unknown', () => {
    const state = mapAnthropicCost([{ data: [{ results: [] }, { results: [] }], has_more: false }], NOW);
    expect(state.spend?.amount).toBe(0);
    expect(state.honesty).toBeUndefined();
  });

  it('an unknown shape is usage unknown, never a spend', () => {
    for (const page of [null, {}, { data: [{ results: [{ amount: 12 }] }] }]) {
      const state = mapAnthropicCost([page], NOW);
      expect(state.honesty).toBe('usage_unknown');
      expect(state.spend).toBeUndefined();
    }
  });
});

describe('mapOpenAICost', () => {
  it('sums dollar values from every bucket', () => {
    const page = {
      object: 'page',
      data: [
        { object: 'bucket', start_time: 1, end_time: 2, results: [{ amount: { value: 0.06, currency: 'usd' } }] },
        { object: 'bucket', start_time: 2, end_time: 3, results: [{ amount: { value: 41.94, currency: 'usd' } }] },
      ],
      has_more: false,
      next_page: null,
    };
    const state = mapOpenAICost([page], NOW);
    expect(state.spend?.amount).toBeCloseTo(42);
    expect(state.spend?.currency).toBe('USD');
    expect(state.spend?.scope).toBe('org');
  });

  it('an empty month is $0', () => {
    expect(mapOpenAICost([{ object: 'page', data: [], has_more: false }], NOW).spend?.amount).toBe(0);
  });

  it('an unknown shape is usage unknown', () => {
    expect(mapOpenAICost([{ data: [{ results: [{ amount: { value: '1' } }] }] }], NOW).honesty).toBe('usage_unknown');
  });
});

import { describe, expect, it } from 'vitest';
import { mapOpenRouterKey } from './openrouter.js';
import { keyCardType, keyPercent } from './key-card.js';

const NOW = 1_700_000_000_000;

describe('mapOpenRouterKey', () => {
  it('a key with a limit gives spend against the limit and the real percent left', () => {
    const state = mapOpenRouterKey(
      { data: { usage: 40, usage_monthly: 12.5, limit: 10, limit_remaining: 6.8, limit_reset: 'monthly' } },
      NOW,
    );
    expect(state.spend?.limit).toBe(10);
    expect(state.spend?.amount).toBeCloseTo(3.2);
    expect(state.spend?.scope).toBe('key');
    expect(keyCardType(state)).toBe('limit');
    expect(keyPercent(state)).toBe(68);
    expect(state.honesty).toBeUndefined();
  });

  it('a key with no limit gives spend this month and no percent', () => {
    const state = mapOpenRouterKey({ data: { usage_monthly: 42.1, limit: null, limit_remaining: null } }, NOW);
    expect(state.spend).toEqual({ amount: 42.1, currency: 'USD', scope: 'key' });
    expect(keyCardType(state)).toBe('spend');
    expect(keyPercent(state)).toBeUndefined();
  });

  it('a used-up limit gives 0% left, not a negative spend', () => {
    const state = mapOpenRouterKey({ data: { limit: 5, limit_remaining: 0 } }, NOW);
    expect(keyPercent(state)).toBe(0);
    expect(state.spend?.amount).toBe(5);
  });

  it('an unknown shape never gives 100%', () => {
    for (const body of [null, {}, { data: null }, { data: { usage_monthly: 'lots', limit: '10' } }]) {
      const state = mapOpenRouterKey(body, NOW);
      expect(state.honesty).toBe('usage_unknown');
      expect(state.spend).toBeUndefined();
      expect(keyPercent(state)).toBeUndefined();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { mapDeepSeekBalance } from './deepseek.js';

const funded = {
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '110.00',
      granted_balance: '10.00',
      topped_up_balance: '100.00',
    },
  ],
};

describe('mapDeepSeekBalance', () => {
  it('maps a funded balance without inventing a remaining percent', () => {
    const state = mapDeepSeekBalance(funded, 50);
    expect(state).toEqual({
      service: 'deepseek',
      lastUpdated: 50,
      balance: {
        available: true,
        infos: [
          {
            currency: 'CNY',
            total: '110.00',
            granted: '10.00',
            toppedUp: '100.00',
          },
        ],
      },
    });
    expect(state.sessionPct).toBeUndefined();
    expect(state.weeklyPct).toBeUndefined();
    expect(state.honesty).toBeUndefined();
  });

  it('keeps every currency bucket the provider returns', () => {
    const state = mapDeepSeekBalance(
      {
        is_available: true,
        balance_infos: [
          {
            currency: 'CNY',
            total_balance: '0.00',
            granted_balance: '0.00',
            topped_up_balance: '0.00',
          },
          {
            currency: 'USD',
            total_balance: '12.40',
            granted_balance: '2.00',
            topped_up_balance: '10.40',
          },
        ],
      },
      1,
    );
    expect(state.honesty).toBeUndefined();
    expect(state.balance?.infos.map((info) => info.currency)).toEqual(['CNY', 'USD']);
  });

  it('marks an unavailable balance empty and still shows the amounts', () => {
    const state = mapDeepSeekBalance({ ...funded, is_available: false }, 7);
    expect(state.honesty).toBe('balance_empty');
    expect(state.balance?.infos[0]?.total).toBe('110.00');
    expect(state.sessionPct).toBeUndefined();
  });

  it('marks a zero total empty even when the provider says available', () => {
    const state = mapDeepSeekBalance(
      {
        is_available: true,
        balance_infos: [
          {
            currency: 'USD',
            total_balance: '0.00',
            granted_balance: '0.00',
            topped_up_balance: '0.00',
          },
        ],
      },
      1,
    );
    expect(state.honesty).toBe('balance_empty');
    expect(state.balance?.available).toBe(true);
  });

  it('returns an unreadable honesty state for a broken payload', () => {
    expect(mapDeepSeekBalance(null, 1).honesty).toBe('balance_unreadable');
    expect(mapDeepSeekBalance({ is_available: true, balance_infos: [] }, 1).honesty).toBe(
      'balance_unreadable',
    );
    expect(
      mapDeepSeekBalance(
        {
          is_available: 'yes',
          balance_infos: [
            {
              currency: 'USD',
              total_balance: '1.00',
              granted_balance: '0.00',
              topped_up_balance: '1.00',
            },
          ],
        },
        1,
      ).honesty,
    ).toBe('balance_unreadable');
    const broken = mapDeepSeekBalance({ is_available: true }, 1);
    expect(broken.balance).toBeUndefined();
    expect(broken.sessionPct).toBeUndefined();
  });

  it('skips a malformed currency row when another row is usable', () => {
    const state = mapDeepSeekBalance(
      {
        is_available: true,
        balance_infos: [
          { currency: 'USD', total_balance: 'nope' },
          {
            currency: 'USD',
            total_balance: '3.50',
            granted_balance: '0.50',
            topped_up_balance: '3.00',
          },
        ],
      },
      1,
    );
    expect(state.balance?.infos).toEqual([
      { currency: 'USD', total: '3.50', granted: '0.50', toppedUp: '3.00' },
    ]);
  });
});

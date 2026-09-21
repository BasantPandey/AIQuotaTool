import { describe, expect, it } from 'vitest';
import { mapKimiBalance } from './kimi.js';

const funded = {
  code: 0,
  data: {
    available_balance: 49.58894,
    voucher_balance: 46.58893,
    cash_balance: 3.00001,
  },
  scode: '0x0',
  status: true,
};

describe('mapKimiBalance', () => {
  it('maps a funded balance without inventing a remaining percent', () => {
    const state = mapKimiBalance(funded, 50);
    expect(state).toEqual({
      service: 'kimi',
      lastUpdated: 50,
      balance: {
        available: true,
        infos: [
          {
            currency: 'USD',
            total: '49.58894',
            granted: '46.58893',
            toppedUp: '3.00001',
          },
        ],
      },
    });
    expect(state.sessionPct).toBeUndefined();
    expect(state.weeklyPct).toBeUndefined();
    expect(state.honesty).toBeUndefined();
  });

  it('formats whole-number amounts without trailing zeros', () => {
    const state = mapKimiBalance(
      { code: 0, status: true, data: { available_balance: 10, voucher_balance: 0, cash_balance: 10 } },
      1,
    );
    expect(state.balance?.infos[0]).toEqual({
      currency: 'USD',
      total: '10',
      granted: '0',
      toppedUp: '10',
    });
  });

  it('marks a zero or negative available balance empty and still shows the amounts', () => {
    const zero = mapKimiBalance(
      { code: 0, status: true, data: { available_balance: 0, voucher_balance: 0, cash_balance: 0 } },
      7,
    );
    expect(zero.honesty).toBe('balance_empty');
    expect(zero.balance?.infos[0]?.total).toBe('0');

    const negative = mapKimiBalance(
      { code: 0, status: true, data: { available_balance: -1.5, voucher_balance: 0, cash_balance: -1.5 } },
      8,
    );
    expect(negative.honesty).toBe('balance_empty');
    expect(negative.balance?.available).toBe(false);
  });

  it('returns an unreadable honesty state for a broken payload', () => {
    expect(mapKimiBalance(null, 1).honesty).toBe('balance_unreadable');
    expect(mapKimiBalance({ code: 1, status: false }, 1).honesty).toBe('balance_unreadable');
    expect(
      mapKimiBalance({ code: 0, status: true, data: { available_balance: '10' } }, 1).honesty,
    ).toBe('balance_unreadable');
    const broken = mapKimiBalance({ code: 0, status: true }, 1);
    expect(broken.balance).toBeUndefined();
    expect(broken.sessionPct).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { applyKeyBudgets, describeKey, keyPercent } from './key-card.js';
import { lowestPressureAmong, pressureRemaining } from './pressure.js';
import { deriveBadge } from './badge.js';
import type { KeyRecord } from './keys.js';
import type { QuotaState } from './types.js';

const spendKey = (id: string, amount: number, extra: Partial<QuotaState['spend']> = {}): QuotaState => ({
  service: 'openrouter',
  connectionId: id,
  kind: 'key',
  spend: { amount, currency: 'USD', scope: 'key', ...extra },
  lastUpdated: 1,
});
const record = (id: string, budget?: number): KeyRecord => ({
  id,
  service: 'openrouter',
  name: id,
  last4: 'abcd',
  ...(budget != null ? { budget } : {}),
});

describe('keyPercent', () => {
  it('uses the provider cap first', () => {
    expect(keyPercent(spendKey('a', 3.2, { limit: 10, budget: 4 }))).toBe(68);
  });

  it('uses the user budget on a Spend only Key', () => {
    expect(keyPercent(spendKey('a', 42.1, { budget: 100 }))).toBe(58);
  });

  it('gives no percent for spend with no cap and no budget', () => {
    expect(keyPercent(spendKey('a', 42.1))).toBeUndefined();
  });

  it('gives no percent for a balance', () => {
    const balance: QuotaState = {
      service: 'deepseek',
      kind: 'key',
      balance: { available: true, infos: [{ currency: 'USD', total: '1.00', granted: '0', toppedUp: '1.00' }] },
      lastUpdated: 1,
    };
    expect(keyPercent(balance)).toBeUndefined();
  });
});

describe('applyKeyBudgets', () => {
  it('copies the budget to the Spend only reading of the same Key', () => {
    const [a, b] = applyKeyBudgets([spendKey('a', 10), spendKey('b', 10)], [record('a', 50), record('b')]);
    expect(a?.spend?.budget).toBe(50);
    expect(b?.spend?.budget).toBeUndefined();
  });

  it('removes a budget that the user cleared', () => {
    const [a] = applyKeyBudgets([spendKey('a', 10, { budget: 50 })], [record('a')]);
    expect(a?.spend?.budget).toBeUndefined();
  });

  it('never adds a budget to a reading with a provider cap', () => {
    const [a] = applyKeyBudgets([spendKey('a', 1, { limit: 10 })], [record('a', 2)]);
    expect(a?.spend?.budget).toBeUndefined();
    expect(keyPercent(a!)).toBe(90);
  });
});

describe('status bar pressure with Keys', () => {
  const claude: QuotaState = { service: 'claude', sessionPct: 40, weeklyPct: 30, lastUpdated: 1 };

  it('a Key with a real percent joins the lowest-percent check', () => {
    const low = spendKey('a', 95, { budget: 100 });
    expect(pressureRemaining(low)).toBe(5);
    expect(lowestPressureAmong([claude, low])).toBe(5);
    expect(deriveBadge([claude, low]).text).toBe('5');
  });

  it('a Spend only Key with no budget never changes the pressure', () => {
    expect(lowestPressureAmong([claude, spendKey('a', 1_000_000)])).toBe(30);
    expect(lowestPressureAmong([spendKey('a', 1_000_000)])).toBeUndefined();
  });
});

describe('describeKey', () => {
  it('a budget shows spend against the budget and the percent left', () => {
    expect(describeKey(spendKey('a', 42.1, { budget: 100 }))).toMatchObject({
      headline: '58% left',
      detail: '$42.10 of $100.00 budget',
      shows: 'Spend vs budget',
      pct: 58,
    });
  });

  it('spend with no budget shows only the spend, never a percent', () => {
    const view = describeKey(spendKey('a', 42.1));
    expect(view).toMatchObject({ headline: '$42.10', detail: 'this month', shows: 'Spend only' });
    expect(view.pct).toBeUndefined();
  });

  it('org spend says org spend', () => {
    expect(describeKey(spendKey('a', 5, { scope: 'org' })).detail).toBe('org spend');
    expect(describeKey(spendKey('a', 5, { scope: 'org', budget: 10 })).detail).toBe('$5.00 of $10.00 budget - org spend');
  });
});

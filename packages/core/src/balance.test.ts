import { describe, expect, it } from 'vitest';
import { formatAccountBalance } from './balance.js';

describe('formatAccountBalance', () => {
  it('formats a known currency as money', () => {
    expect(formatAccountBalance('12.40', 'USD')).toBe('$12.40');
  });

  it('falls back to the raw amount when the currency code is unknown', () => {
    expect(formatAccountBalance('110.00', 'XYZ')).toBe('110.00 XYZ');
  });
});

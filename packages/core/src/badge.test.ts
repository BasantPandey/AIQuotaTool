import { describe, expect, it } from 'vitest';
import { BADGE_COLORS, deriveBadge } from './badge.js';
import type { QuotaState } from './types.js';

function claude(sessionPct?: number, weeklyPct?: number): QuotaState {
  return { service: 'claude', sessionPct, weeklyPct, lastUpdated: 1 };
}

function copilotHonesty(): QuotaState {
  return {
    service: 'copilot',
    honesty: 'seat_active_usage_unknown',
    lastUpdated: 1,
  };
}

describe('deriveBadge', () => {
  it('shows the lowest remaining percentage rounded to a whole number', () => {
    expect(deriveBadge([claude(42.4, 90)])).toEqual({
      text: '42',
      color: BADGE_COLORS.normal,
    });
    expect(deriveBadge([claude(80, 42.6)])).toEqual({
      text: '43',
      color: BADGE_COLORS.normal,
    });
  });

  it('shows nothing when no service has a real remaining percentage', () => {
    expect(deriveBadge([]).text).toBe('');
    expect(deriveBadge([copilotHonesty()]).text).toBe('');
  });

  it('turns amber below 10% remaining', () => {
    expect(deriveBadge([claude(9)])).toEqual({
      text: '9',
      color: BADGE_COLORS.low,
    });
    expect(deriveBadge([claude(10)]).color).toBe(BADGE_COLORS.normal);
  });

  it('turns red below 5% remaining', () => {
    expect(deriveBadge([claude(4)])).toEqual({
      text: '4',
      color: BADGE_COLORS.critical,
    });
    expect(deriveBadge([claude(5)]).color).toBe(BADGE_COLORS.low);
  });

  it('honesty-only services never hide real low pressure from another service', () => {
    const badge = deriveBadge([copilotHonesty(), claude(3, 50)]);
    expect(badge).toEqual({ text: '3', color: BADGE_COLORS.critical });
  });

  it('ignores a funded prepaid balance so dollars never become a percent', () => {
    const funded = {
      service: 'deepseek' as const,
      lastUpdated: 1,
      balance: {
        available: true,
        infos: [{ currency: 'USD', total: '50.00', granted: '0.00', toppedUp: '50.00' }],
      },
    };
    expect(deriveBadge([funded]).text).toBe('');
    expect(deriveBadge([funded, claude(40)]).text).toBe('40');
  });

  it('turns the badge critical when a prepaid balance is empty', () => {
    const empty = {
      service: 'deepseek' as const,
      honesty: 'balance_empty' as const,
      lastUpdated: 1,
      balance: {
        available: false,
        infos: [{ currency: 'USD', total: '0.00', granted: '0.00', toppedUp: '0.00' }],
      },
    };
    expect(deriveBadge([empty])).toEqual({ text: '0', color: BADGE_COLORS.critical });
    expect(deriveBadge([empty, claude(80)])).toEqual({
      text: '0',
      color: BADGE_COLORS.critical,
    });
  });
});

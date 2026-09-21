import { describe, expect, it } from 'vitest';
import {
  LOW_QUOTA_THRESHOLD,
  decideLowQuotaAlerts,
  initialLowQuotaArmed,
} from './low-quota.js';
import type { QuotaState } from './types.js';

function claude(pct: number): QuotaState {
  return { service: 'claude', sessionPct: pct, lastUpdated: 1 };
}

function codex(pct: number): QuotaState {
  return { service: 'codex', weeklyPct: pct, lastUpdated: 1 };
}

function copilotHonesty(): QuotaState {
  return {
    service: 'copilot',
    honesty: 'seat_active_usage_unknown',
    lastUpdated: 1,
  };
}

describe('decideLowQuotaAlerts', () => {
  it('alerts when a service drops below the threshold', () => {
    const { alerts } = decideLowQuotaAlerts([claude(8)], initialLowQuotaArmed());
    expect(alerts).toEqual([{ service: 'claude', pct: 8 }]);
  });

  it('does not alert at or above the threshold', () => {
    const { alerts } = decideLowQuotaAlerts(
      [claude(LOW_QUOTA_THRESHOLD)],
      initialLowQuotaArmed(),
    );
    expect(alerts).toEqual([]);
  });

  it('alerts once, then stays quiet while the service stays low', () => {
    const first = decideLowQuotaAlerts([claude(8)], initialLowQuotaArmed());
    const second = decideLowQuotaAlerts([claude(7)], first.armed);
    expect(first.alerts).toHaveLength(1);
    expect(second.alerts).toEqual([]);
  });

  it('re-arms after the service recovers (e.g. quota reset), so the next drop alerts again', () => {
    const low = decideLowQuotaAlerts([claude(8)], initialLowQuotaArmed());
    const recovered = decideLowQuotaAlerts([claude(95)], low.armed);
    expect(recovered.alerts).toEqual([]);
    const droppedAgain = decideLowQuotaAlerts([claude(6)], recovered.armed);
    expect(droppedAgain.alerts).toEqual([{ service: 'claude', pct: 6 }]);
  });

  it('never alerts on honesty-only states (no real remaining %)', () => {
    const { alerts } = decideLowQuotaAlerts(
      [copilotHonesty()],
      initialLowQuotaArmed(),
    );
    expect(alerts).toEqual([]);
  });

  it('alerts once when a prepaid balance is empty, then re-arms after a top-up', () => {
    const empty = {
      service: 'deepseek' as const,
      honesty: 'balance_empty' as const,
      lastUpdated: 1,
      balance: {
        available: false,
        infos: [{ currency: 'USD', total: '0.00', granted: '0.00', toppedUp: '0.00' }],
      },
    };
    const funded = {
      service: 'deepseek' as const,
      lastUpdated: 2,
      balance: {
        available: true,
        infos: [{ currency: 'USD', total: '12.00', granted: '0.00', toppedUp: '12.00' }],
      },
    };
    const first = decideLowQuotaAlerts([empty], initialLowQuotaArmed());
    expect(first.alerts).toEqual([{ service: 'deepseek', pct: 0, kind: 'balance' }]);
    const stillEmpty = decideLowQuotaAlerts([empty], first.armed);
    expect(stillEmpty.alerts).toEqual([]);
    const toppedUp = decideLowQuotaAlerts([funded], stillEmpty.armed);
    expect(toppedUp.alerts).toEqual([]);
    const emptiedAgain = decideLowQuotaAlerts([empty], toppedUp.armed);
    expect(emptiedAgain.alerts).toEqual([{ service: 'deepseek', pct: 0, kind: 'balance' }]);
  });

  it('does not alert on a funded prepaid balance', () => {
    const { alerts } = decideLowQuotaAlerts(
      [
        {
          service: 'deepseek',
          lastUpdated: 1,
          balance: {
            available: true,
            infos: [{ currency: 'CNY', total: '110.00', granted: '10.00', toppedUp: '100.00' }],
          },
        },
      ],
      initialLowQuotaArmed(),
    );
    expect(alerts).toEqual([]);
  });

  it('tracks services independently', () => {
    const first = decideLowQuotaAlerts(
      [claude(8), codex(50)],
      initialLowQuotaArmed(),
    );
    expect(first.alerts).toEqual([{ service: 'claude', pct: 8 }]);
    const second = decideLowQuotaAlerts([claude(6), codex(4)], first.armed);
    expect(second.alerts).toEqual([{ service: 'codex', pct: 4 }]);
  });
});

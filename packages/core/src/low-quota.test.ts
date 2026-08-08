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

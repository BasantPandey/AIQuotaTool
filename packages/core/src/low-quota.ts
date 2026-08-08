import type { QuotaState, ServiceId } from './types.js';
import { pressureRemaining } from './pressure.js';

/** Remaining % below which a low-quota alert fires. */
export const LOW_QUOTA_THRESHOLD = 10;

export interface LowQuotaAlert {
  service: ServiceId;
  /** Lowest remaining % that triggered the alert. */
  pct: number;
}

/** Per-service latch: true means the service may alert on the next low reading. */
export type LowQuotaArmed = Partial<Record<ServiceId, boolean>>;

export interface LowQuotaDecision {
  alerts: LowQuotaAlert[];
  armed: LowQuotaArmed;
}

export function initialLowQuotaArmed(): LowQuotaArmed {
  return {};
}

/**
 * Decide low-quota alerts from a fresh poll. Each service alerts once per drop
 * below the threshold, then stays quiet until its remaining % recovers to at
 * least the threshold (e.g. after a quota reset), which re-arms it.
 * Honesty-only states (no real remaining %) never alert.
 */
export function decideLowQuotaAlerts(
  states: QuotaState[],
  armed: LowQuotaArmed,
): LowQuotaDecision {
  const next: LowQuotaArmed = { ...armed };
  const alerts: LowQuotaAlert[] = [];

  for (const state of states) {
    const pct = pressureRemaining(state);
    if (pct == null) continue;
    if (pct >= LOW_QUOTA_THRESHOLD) {
      next[state.service] = true;
    } else if (next[state.service] !== false) {
      alerts.push({ service: state.service, pct });
      next[state.service] = false;
    }
  }

  return { alerts, armed: next };
}

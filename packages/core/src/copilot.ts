import type { QuotaState } from './types.js';

/**
 * Pure Copilot QuotaState builders for honest non-percentage outcomes.
 * Hosts call these instead of inventing weeklyPct: 100.
 */

export function copilotSeatActiveUsageUnknown(lastUpdated: number = Date.now()): QuotaState {
  return {
    service: 'copilot',
    honesty: 'seat_active_usage_unknown',
    lastUpdated,
  };
}

export function copilotNoPlan(lastUpdated: number = Date.now()): QuotaState {
  return {
    service: 'copilot',
    honesty: 'no_plan',
    lastUpdated,
  };
}

export function copilotAuthUnavailable(lastUpdated: number = Date.now()): QuotaState {
  return {
    service: 'copilot',
    honesty: 'auth_unavailable',
    lastUpdated,
  };
}

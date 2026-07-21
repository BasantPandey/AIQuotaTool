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

/**
 * Map a GitHub `GET /user/copilot` HTTP status to an honest QuotaState.
 * There is no public individual remaining-% API — never invent percentages here.
 *
 * - 404 → no plan
 * - 2xx → seat/plan present, usage % unknown
 * - anything else (401/403/5xx/network-shaped codes) → auth/access unavailable
 */
export function mapCopilotSeatStatus(
  httpStatus: number,
  lastUpdated: number = Date.now(),
): QuotaState {
  if (httpStatus === 404) return copilotNoPlan(lastUpdated);
  if (httpStatus >= 200 && httpStatus < 300) {
    return copilotSeatActiveUsageUnknown(lastUpdated);
  }
  return copilotAuthUnavailable(lastUpdated);
}

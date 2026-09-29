import type { QuotaState } from './types.js';
import { CHROME_SERVICES, type ChromeServiceId } from './services.js';

/**
 * Does this reading prove an account is connected? Real remaining percentages
 * or a verified honesty state (seat active, no plan, usage unknown) count;
 * sign-in-required honesty and empty readings do not.
 */
export function isConnectedReading(state: QuotaState): boolean {
  if (
    state.honesty === 'not_connected' ||
    state.honesty === 'auth_unavailable' ||
    state.honesty === 'browser_session_required' ||
    state.honesty === 'api_key_required' ||
    state.honesty === 'api_key_invalid'
  ) {
    return false;
  }
  return (
    state.sessionPct != null ||
    state.weeklyPct != null ||
    state.monthlyPct != null ||
    (state.balance != null && state.balance.infos.length > 0) ||
    state.spend != null ||
    state.honesty === 'usage_unknown' ||
    state.honesty === 'seat_active_usage_unknown' ||
    state.honesty === 'no_plan' ||
    state.honesty === 'balance_empty' ||
    state.honesty === 'balance_unreadable'
  );
}

/** Connection flag for each Chrome service, from stored quota readings. */
export function deriveConnections(
  states: QuotaState[],
): Record<ChromeServiceId, boolean> {
  const connections = {} as Record<ChromeServiceId, boolean>;
  for (const { id } of CHROME_SERVICES) {
    connections[id] = states.some(
      (s) => s.service === id && isConnectedReading(s),
    );
  }
  return connections;
}

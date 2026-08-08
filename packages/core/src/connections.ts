import type { QuotaState, ServiceId } from './types.js';

const SERVICE_IDS: ServiceId[] = ['claude', 'copilot', 'codex', 'grok'];

/**
 * Does this reading prove an account is connected? Real remaining percentages
 * or a verified honesty state (seat active, no plan, usage unknown) count;
 * sign-in-required honesty and empty readings do not.
 */
export function isConnectedReading(state: QuotaState): boolean {
  if (
    state.honesty === 'not_connected' ||
    state.honesty === 'auth_unavailable' ||
    state.honesty === 'browser_session_required'
  ) {
    return false;
  }
  return (
    state.sessionPct != null ||
    state.weeklyPct != null ||
    state.honesty === 'usage_unknown' ||
    state.honesty === 'seat_active_usage_unknown' ||
    state.honesty === 'no_plan'
  );
}

/** Connection flag per service, derived from stored quota readings. */
export function deriveConnections(
  states: QuotaState[],
): Record<ServiceId, boolean> {
  const connections = {} as Record<ServiceId, boolean>;
  for (const id of SERVICE_IDS) {
    connections[id] = states.some(
      (s) => s.service === id && isConnectedReading(s),
    );
  }
  return connections;
}

import type { QuotaState, ServiceId } from './types.js';

/** Optional quota fields that contribute to "richer" on equal lastUpdated. */
function richness(state: QuotaState): number {
  let score = 0;
  if (state.sessionPct !== undefined) score += 1;
  if (state.weeklyPct !== undefined) score += 1;
  if (state.sessionResetsAt !== undefined) score += 1;
  if (state.weeklyResetsAt !== undefined) score += 1;
  if (state.subcategories !== undefined && state.subcategories.length > 0) score += 1;
  return score;
}

/**
 * Choose which of two readings for the same service to keep.
 * Fresher `lastUpdated` wins. On equal timestamps, prefer the richer state
 * (more defined optional fields). On equal richness, prefer `incoming`.
 */
export function preferQuotaState(existing: QuotaState, incoming: QuotaState): QuotaState {
  if (incoming.lastUpdated > existing.lastUpdated) return incoming;
  if (incoming.lastUpdated < existing.lastUpdated) return existing;
  return richness(incoming) >= richness(existing) ? incoming : existing;
}

/**
 * Insert or replace a single service reading in a list using freshest-wins.
 * Returns a new array; does not mutate `states`.
 */
export function upsertQuotaState(states: readonly QuotaState[], incoming: QuotaState): QuotaState[] {
  const index = states.findIndex((s) => s.service === incoming.service);
  if (index === -1) return [...states, incoming];

  const preferred = preferQuotaState(states[index]!, incoming);
  if (preferred === states[index]) return [...states];

  const next = states.slice();
  next[index] = preferred;
  return next;
}

/**
 * Merge two QuotaState lists keyed by service using freshest-wins.
 * Services only present on one side are kept. Empty inputs are valid.
 * Returns a new array; does not mutate either argument.
 * Order: services from `base` first (in base order), then any services only in `incoming` (incoming order).
 *
 * Precondition: each list should have at most one row per service. Duplicate
 * services within a single list are reduced with preferQuotaState as well.
 */
export function mergeQuotaStates(
  base: readonly QuotaState[],
  incoming: readonly QuotaState[],
): QuotaState[] {
  if (base.length === 0) return [...incoming];
  if (incoming.length === 0) return [...base];

  const byService = new Map<ServiceId, QuotaState>();
  for (const s of base) {
    const prev = byService.get(s.service);
    byService.set(s.service, prev ? preferQuotaState(prev, s) : s);
  }
  for (const s of incoming) {
    const prev = byService.get(s.service);
    byService.set(s.service, prev ? preferQuotaState(prev, s) : s);
  }

  const seen = new Set<ServiceId>();
  const result: QuotaState[] = [];
  for (const s of base) {
    if (seen.has(s.service)) continue;
    seen.add(s.service);
    result.push(byService.get(s.service)!);
  }
  for (const s of incoming) {
    if (seen.has(s.service)) continue;
    seen.add(s.service);
    result.push(byService.get(s.service)!);
  }
  return result;
}

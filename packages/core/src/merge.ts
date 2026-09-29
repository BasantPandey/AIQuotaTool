import type { ConnectionKind, QuotaState } from './types.js';

/** The connection id of a reading. Readings with no id are the Account of their provider. */
export function connectionIdOf(state: QuotaState): string {
  return state.connectionId ?? state.service;
}

export function connectionKindOf(state: QuotaState): ConnectionKind {
  return state.kind ?? 'account';
}

/** Optional quota fields that contribute to "richer" on equal lastUpdated. */
function richness(state: QuotaState): number {
  let score = 0;
  if (state.sessionPct !== undefined) score += 1;
  if (state.weeklyPct !== undefined) score += 1;
  if (state.monthlyPct !== undefined) score += 1;
  if (state.sessionResetsAt !== undefined) score += 1;
  if (state.weeklyResetsAt !== undefined) score += 1;
  if (state.subcategories !== undefined && state.subcategories.length > 0) score += 1;
  if (state.balance !== undefined && state.balance.infos.length > 0) score += 1;
  if (state.spend !== undefined) score += 1;
  if (state.creditsUsed !== undefined) score += 1;
  if (state.honesty !== undefined) score += 1;
  return score;
}

/**
 * Choose which of two readings for the same connection to keep.
 * Fresher `lastUpdated` wins. On equal timestamps, prefer the richer state
 * (more defined optional fields). On equal richness, prefer `incoming`.
 */
export function preferQuotaState(existing: QuotaState, incoming: QuotaState): QuotaState {
  if (incoming.lastUpdated > existing.lastUpdated) return incoming;
  if (incoming.lastUpdated < existing.lastUpdated) return existing;
  return richness(incoming) >= richness(existing) ? incoming : existing;
}

/**
 * Insert or replace a single connection reading in a list using freshest-wins.
 * Returns a new array; does not mutate `states`.
 */
export function upsertQuotaState(states: readonly QuotaState[], incoming: QuotaState): QuotaState[] {
  const id = connectionIdOf(incoming);
  const index = states.findIndex((s) => connectionIdOf(s) === id);
  if (index === -1) return [...states, incoming];

  const preferred = preferQuotaState(states[index]!, incoming);
  if (preferred === states[index]) return [...states];

  const next = states.slice();
  next[index] = preferred;
  return next;
}

/**
 * Merge two QuotaState lists keyed by connection id using freshest-wins.
 * Connections only present on one side are kept. Empty inputs are valid.
 * Returns a new array; does not mutate either argument.
 * Order: connections from `base` first (in base order), then any only in `incoming` (incoming order).
 *
 * Duplicate connections within a single list are reduced with preferQuotaState as well.
 */
export function mergeQuotaStates(
  base: readonly QuotaState[],
  incoming: readonly QuotaState[],
): QuotaState[] {
  if (base.length === 0) return [...incoming];
  if (incoming.length === 0) return [...base];

  const byConnection = new Map<string, QuotaState>();
  for (const s of [...base, ...incoming]) {
    const id = connectionIdOf(s);
    const prev = byConnection.get(id);
    byConnection.set(id, prev ? preferQuotaState(prev, s) : s);
  }
  // Map keeps first-insertion order: base connections first, then incoming-only ones.
  return [...byConnection.values()];
}

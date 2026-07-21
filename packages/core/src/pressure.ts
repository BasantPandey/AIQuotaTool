import type { QuotaState } from './types.js';

/**
 * Lowest defined remaining % on a single state (session or weekly).
 * Returns undefined when no remaining percentages exist (e.g. honesty-only Copilot).
 * Never invents 100 for missing fields.
 */
export function pressureRemaining(state: QuotaState): number | undefined {
  const vals: number[] = [];
  if (state.sessionPct != null) vals.push(state.sessionPct);
  if (state.weeklyPct != null) vals.push(state.weeklyPct);
  if (vals.length === 0) return undefined;
  return Math.min(...vals);
}

/**
 * Lowest pressure across states that have real remaining percentages.
 * Honesty-only / percentage-less states are ignored (not treated as 100%).
 */
export function lowestPressureAmong(states: QuotaState[]): number | undefined {
  let lowest: number | undefined;
  for (const s of states) {
    const p = pressureRemaining(s);
    if (p == null) continue;
    lowest = lowest == null ? p : Math.min(lowest, p);
  }
  return lowest;
}

import type { QuotaState } from './types.js';
import { keyPercent } from './key-card.js';

/**
 * Lowest defined remaining % on a single state (session, weekly or monthly),
 * or the Key percent from a provider cap or a user budget.
 * Returns undefined when no remaining percentages exist (e.g. honesty-only Copilot).
 * Never invents 100 for missing fields.
 */
export function pressureRemaining(state: QuotaState): number | undefined {
  const vals: number[] = [];
  if (state.sessionPct != null) vals.push(state.sessionPct);
  if (state.weeklyPct != null) vals.push(state.weeklyPct);
  if (state.monthlyPct != null) vals.push(state.monthlyPct);
  const key = keyPercent(state);
  if (key != null) vals.push(key);
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

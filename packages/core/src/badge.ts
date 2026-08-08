import type { QuotaState } from './types.js';
import { lowestPressureAmong } from './pressure.js';

/** Badge color ramp for the toolbar action. */
export const BADGE_COLORS = {
  normal: '#6e7681',
  low: '#e3b341',
  critical: '#d73a49',
} as const;

export interface BadgeSpec {
  /** Whole-number lowest remaining %, or '' when nothing real to show. */
  text: string;
  color: string;
}

const LOW_THRESHOLD = 10;
const CRITICAL_THRESHOLD = 5;

/**
 * Toolbar badge from the lowest remaining % across services.
 * Honesty-only states (no remaining %) are ignored - never treated as 100.
 * Amber below 10%, red below 5%; empty badge when no real percentages exist.
 */
export function deriveBadge(states: QuotaState[]): BadgeSpec {
  const lowest = lowestPressureAmong(states);
  if (lowest == null) return { text: '', color: BADGE_COLORS.normal };
  const color =
    lowest < CRITICAL_THRESHOLD
      ? BADGE_COLORS.critical
      : lowest < LOW_THRESHOLD
        ? BADGE_COLORS.low
        : BADGE_COLORS.normal;
  return { text: String(Math.round(lowest)), color };
}

export type Level = 'ok' | 'low' | 'critical';

/** Same thresholds as the toolbar badge: amber below 10%, red below 5%. */
export function level(pct: number): Level {
  if (pct < 5) return 'critical';
  if (pct < 10) return 'low';
  return 'ok';
}

/**
 * Returns a human-readable countdown string from a duration in milliseconds.
 * e.g. 6300000 → "1h 45m"
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'now';

  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

/**
 * Returns percentage remaining (0–100), clamped.
 */
export function calcPct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const remaining = limit - used;
  return Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
}

/**
 * Returns a CSS hsl color string interpolated from red (0%) to green (100%).
 */
export function pctToColor(pct: number): string {
  const hue = Math.round((pct / 100) * 120); // 0=red, 120=green
  return `hsl(${hue}, 70%, 45%)`;
}

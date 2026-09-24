/**
 * Design tokens as CSS variables with dark defaults. A host page can set the
 * --aq-* variables (for example a light theme) without touching components.
 */
export const tokens = {
  bg: 'var(--aq-bg, #0b0d12)',
  surface: 'var(--aq-surface, #13161d)',
  surfaceRaised: 'var(--aq-surface-raised, #1a1e27)',
  border: 'var(--aq-border, rgba(255,255,255,0.07))',
  text: 'var(--aq-text, #eef1f6)',
  muted: 'var(--aq-muted, #8b93a5)',
  faint: 'var(--aq-faint, #5d6577)',
  track: 'var(--aq-track, rgba(255,255,255,0.07))',
  accent: 'var(--aq-accent, #7b9bff)',
  good: 'var(--aq-good, #3ecf8e)',
  low: 'var(--aq-low, #f2b33d)',
  critical: 'var(--aq-critical, #f0665a)',
  radius: 14,
} as const;

/** Same thresholds as the toolbar badge: amber below 10%, red below 5%. */
export function levelColor(pct: number): string {
  if (pct < 5) return tokens.critical;
  if (pct < 10) return tokens.low;
  return tokens.accent;
}

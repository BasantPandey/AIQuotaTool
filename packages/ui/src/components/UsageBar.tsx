import { formatTimeRemaining } from '@ai-quota-tool/core';
import { levelColor, tokens } from '../theme.js';

interface Props {
  label: string;
  /** 0-100, percentage REMAINING. */
  pct: number;
  resetsAt?: number | undefined;
  /** Smaller variant for sub-buckets. */
  compact?: boolean;
}

export function UsageBar({ label, pct, resetsAt, compact = false }: Props) {
  const color = levelColor(pct);
  const resetMs = resetsAt != null ? resetsAt - Date.now() : undefined;
  return (
    <div style={{ marginTop: compact ? 8 : 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: compact ? 11 : 12,
        }}
      >
        <span style={{ color: tokens.muted, fontWeight: 500 }}>{label}</span>
        <span style={{ color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
          <strong style={{ color: pct < 10 ? color : tokens.text, fontWeight: 650 }}>{pct}%</strong>
          {' left'}
          {resetMs != null && (
            <span style={{ color: tokens.faint }}> · resets in {formatTimeRemaining(resetMs)}</span>
          )}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} remaining`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{
          marginTop: 6,
          height: compact ? 4 : 6,
          borderRadius: 99,
          background: tokens.track,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 99,
            background: color,
            transition: 'width 0.6s ease, background 0.6s ease',
          }}
        />
      </div>
    </div>
  );
}

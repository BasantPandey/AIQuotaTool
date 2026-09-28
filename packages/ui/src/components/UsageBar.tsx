import type React from 'react';
import { formatTimeRemaining } from '@ai-quota-tool/core';
import { level } from '../theme.js';

/** Segmented gauge. Any quota left lights at least one cell, so 3% never looks empty. */
export function Meter({ pct, label, cells = 20, thin = false }: { pct: number; label: string; cells?: number; thin?: boolean }) {
  const lit = (Math.ceil((pct / 100) * cells) / cells) * 100;
  return (
    <div
      className={thin ? 'meter thin' : 'meter'}
      role="meter"
      aria-label={`${label} remaining`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      style={{ '--cells': cells, '--w': `${lit}%` } as React.CSSProperties}
    />
  );
}

interface Props {
  label: string;
  /** 0-100, percentage REMAINING. */
  pct: number;
  resetsAt?: number | undefined;
  /** Smaller variant for sub-buckets. */
  compact?: boolean;
}

export function UsageBar({ label, pct, resetsAt, compact = false }: Props) {
  return (
    <div className={compact ? 'win compact' : 'win'} data-level={level(pct)}>
      <div className="win-head">
        <span className="win-label">{label}</span>
        {resetsAt != null && <span className="win-reset">resets in {formatTimeRemaining(resetsAt - Date.now())}</span>}
      </div>
      <div className="win-body">
        <span className="win-pct num">
          {pct}
          <small>%</small>
        </span>
        <Meter pct={pct} label={label} thin={compact} />
      </div>
    </div>
  );
}

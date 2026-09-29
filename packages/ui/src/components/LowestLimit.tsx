import type { QuotaState } from '@ai-quota-tool/core';
import { formatTimeRemaining, SERVICE_LABELS } from '@ai-quota-tool/core';
import { level } from '../theme.js';
import { ProviderLogo } from './ProviderLogo.js';
import { Meter } from './UsageBar.js';

interface Tightest {
  state: QuotaState;
  label: string;
  pct: number;
  resetsAt: number | undefined;
}

function tightest(states: QuotaState[]): Tightest | undefined {
  let best: Tightest | undefined;
  for (const state of states) {
    for (const w of [
      { label: 'Session', pct: state.sessionPct, resetsAt: state.sessionResetsAt },
      { label: 'Weekly', pct: state.weeklyPct, resetsAt: state.weeklyResetsAt },
      { label: state.monthlyLabel ?? 'Monthly', pct: state.monthlyPct, resetsAt: state.monthlyResetsAt },
    ]) {
      if (w.pct != null && (best == null || w.pct < best.pct)) best = { state, label: w.label, pct: w.pct, resetsAt: w.resetsAt };
    }
  }
  return best;
}

/** The one quota window with the least left. Renders nothing when no provider has a percent. */
export function LowestLimit({ states }: { states: QuotaState[] }) {
  const t = tightest(states);
  if (t == null) return null;
  const name = SERVICE_LABELS[t.state.service];
  return (
    <section className="hero" data-level={level(t.pct)} aria-label="Lowest remaining quota">
      <div className="hero-kicker">Lowest remaining</div>
      <div className="hero-row">
        <div className="hero-who">
          <ProviderLogo service={t.state.service} size={24} />
          <span>
            {name} <span className="hero-window">· {t.label}</span>
          </span>
        </div>
        <span className="hero-pct num">
          {t.pct}
          <small>%</small>
        </span>
      </div>
      <Meter pct={t.pct} label={`${name} ${t.label}`} cells={30} />
      {t.resetsAt != null && <div className="hero-reset">Resets in {formatTimeRemaining(t.resetsAt - Date.now())}</div>}
    </section>
  );
}

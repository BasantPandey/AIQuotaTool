import type React from 'react';
import type { QuotaHonesty, QuotaState, ServiceId } from '@ai-quota-tool/core';
import { formatAccountBalance, QUOTA_HONESTY_LABELS, SERVICE_LABELS } from '@ai-quota-tool/core';
import { ProviderLogo } from './ProviderLogo.js';
import { UsageBar } from './UsageBar.js';

/** Honesty states that mean the user must act before a reading can appear. */
const NEEDS_ACTION: ReadonlySet<QuotaHonesty> = new Set([
  'not_connected',
  'session_expired',
  'auth_unavailable',
  'browser_session_required',
  'api_key_required',
  'api_key_invalid',
]);

const STATUS_TEXT: Partial<Record<QuotaHonesty, string>> = {
  session_expired: 'Session ended',
  api_key_invalid: 'Key rejected',
  auth_unavailable: 'Sign in needed',
};

interface Props {
  service: ServiceId;
  state?: QuotaState;
  /** What the user does to connect. Shown when there is no usable reading. */
  hint: string;
  /** Pill text when there is no reading yet. Default: "Not connected". */
  pendingText?: string;
  /** Host-owned control (link or button) shown under the hint. */
  action?: React.ReactNode;
}

function freshness(lastUpdated: number): string {
  const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
  if (seconds < 90) return 'Updated just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'idle'; children: React.ReactNode }) {
  return (
    <span className="pill">
      <span className={tone === 'idle' ? 'dot' : `dot ${tone}`} />
      {children}
    </span>
  );
}

/** Pure display card for one provider. Wrap the list in Suspense and ErrorBoundary at the call site. */
export function ProviderCard({ service, state, hint, pendingText, action }: Props) {
  const needsAction = state == null || (state.honesty != null && NEEDS_ACTION.has(state.honesty));
  const bars = state == null
    ? []
    : [
        { label: 'Session', pct: state.sessionPct, resetsAt: state.sessionResetsAt },
        { label: 'Weekly', pct: state.weeklyPct, resetsAt: state.weeklyResetsAt },
        { label: state.monthlyLabel ?? 'Monthly', pct: state.monthlyPct, resetsAt: state.monthlyResetsAt },
      ].filter((bar): bar is { label: string; pct: number; resetsAt: number | undefined } => bar.pct != null);
  const infos = state?.balance?.infos ?? [];
  const info =
    !needsAction && bars.length === 0 && state?.honesty != null ? QUOTA_HONESTY_LABELS[state.honesty] : null;

  const pill =
    state == null ? (
      <StatusPill tone="idle">{pendingText ?? 'Not connected'}</StatusPill>
    ) : needsAction ? (
      <StatusPill tone="warn">{(state.honesty && STATUS_TEXT[state.honesty]) ?? 'Not connected'}</StatusPill>
    ) : (
      <StatusPill tone="ok">{freshness(state.lastUpdated)}</StatusPill>
    );

  return (
    <section className="card" aria-label={SERVICE_LABELS[service]}>
      <header className="card-head">
        <ProviderLogo service={service} size={30} />
        <span className="card-title">{SERVICE_LABELS[service]}</span>
        {pill}
      </header>

      {bars.map((bar) => (
        <UsageBar key={bar.label} label={bar.label} pct={bar.pct} resetsAt={bar.resetsAt} />
      ))}

      {state?.subcategories && state.subcategories.length > 0 && (
        <div className="card-subs">
          {state.subcategories.map((sub) => (
            <UsageBar key={sub.name} label={sub.name} pct={100 - sub.usedPct} compact />
          ))}
        </div>
      )}

      {!needsAction &&
        infos.map((row) => (
          <div key={row.currency} className="balance">
            <div className={state?.honesty === 'balance_empty' ? 'balance-total num zero' : 'balance-total num'}>
              {formatAccountBalance(row.total, row.currency)}
            </div>
            <div className="balance-sub">
              Granted {formatAccountBalance(row.granted, row.currency)} · Topped up{' '}
              {formatAccountBalance(row.toppedUp, row.currency)}
            </div>
          </div>
        ))}

      {!needsAction && state?.creditsUsed != null && (
        <p className="card-note">
          <span className="num">{state.creditsUsed.toLocaleString('en-US')}</span> AI credits used. This pool has no limit.
        </p>
      )}

      {info != null && <p className="card-note">{info}</p>}

      {needsAction && (
        <>
          <p className="card-note">{hint}</p>
          {action != null && <div className="card-action">{action}</div>}
        </>
      )}
    </section>
  );
}

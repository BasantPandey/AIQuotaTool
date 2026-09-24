import type React from 'react';
import type { QuotaHonesty, QuotaState, ServiceId } from '@ai-quota-tool/core';
import { formatAccountBalance, QUOTA_HONESTY_LABELS, SERVICE_LABELS } from '@ai-quota-tool/core';
import { tokens } from '../theme.js';
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
  session_expired: 'Session expired',
  api_key_invalid: 'Key rejected',
  auth_unavailable: 'Sign in needed',
};

interface Props {
  service: ServiceId;
  state?: QuotaState;
  /** What the user does to connect. Shown when there is no usable reading. */
  hint: string;
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

function StatusPill({ tone, children }: { tone: 'live' | 'warn' | 'idle'; children: React.ReactNode }) {
  const color = tone === 'live' ? tokens.good : tone === 'warn' ? tokens.low : tokens.faint;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: tokens.muted, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      {children}
    </span>
  );
}

/** Pure display card for one provider. Wrap the list in Suspense and ErrorBoundary at the call site. */
export function ProviderCard({ service, state, hint, action }: Props) {
  const needsAction = state == null || (state.honesty != null && NEEDS_ACTION.has(state.honesty));
  const bars = state == null
    ? []
    : [
        { label: 'Session', pct: state.sessionPct, resetsAt: state.sessionResetsAt },
        { label: 'Weekly', pct: state.weeklyPct, resetsAt: state.weeklyResetsAt },
        { label: 'Monthly', pct: state.monthlyPct, resetsAt: state.monthlyResetsAt },
      ].filter((bar): bar is { label: string; pct: number; resetsAt: number | undefined } => bar.pct != null);
  const infos = state?.balance?.infos ?? [];
  const info =
    !needsAction && bars.length === 0 && state?.honesty != null ? QUOTA_HONESTY_LABELS[state.honesty] : null;

  const pill =
    state == null ? (
      <StatusPill tone="idle">Not connected</StatusPill>
    ) : needsAction ? (
      <StatusPill tone="warn">{(state.honesty && STATUS_TEXT[state.honesty]) ?? 'Not connected'}</StatusPill>
    ) : (
      <StatusPill tone="live">{freshness(state.lastUpdated)}</StatusPill>
    );

  return (
    <section
      aria-label={SERVICE_LABELS[service]}
      style={{
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radius,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ProviderLogo service={service} size={30} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 650, color: tokens.text, letterSpacing: '-0.01em' }}>
          {SERVICE_LABELS[service]}
        </span>
        {pill}
      </header>

      {bars.map((bar) => (
        <UsageBar key={bar.label} label={bar.label} pct={bar.pct} resetsAt={bar.resetsAt} />
      ))}

      {state?.subcategories && state.subcategories.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 2, borderTop: `1px dashed ${tokens.border}` }}>
          {state.subcategories.map((sub) => (
            <UsageBar key={sub.name} label={sub.name} pct={100 - sub.usedPct} compact />
          ))}
        </div>
      )}

      {!needsAction &&
        infos.map((row) => (
          <div key={row.currency} style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums',
                color: state?.honesty === 'balance_empty' ? tokens.critical : tokens.text,
              }}
            >
              {formatAccountBalance(row.total, row.currency)}
            </div>
            <div style={{ fontSize: 11, color: tokens.muted, marginTop: 2 }}>
              Granted {formatAccountBalance(row.granted, row.currency)} · Topped up{' '}
              {formatAccountBalance(row.toppedUp, row.currency)}
            </div>
          </div>
        ))}

      {info != null && <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: tokens.muted }}>{info}</p>}

      {needsAction && (
        <div style={{ marginTop: 10 }}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: tokens.muted }}>{hint}</p>
          {action != null && <div style={{ marginTop: 10 }}>{action}</div>}
        </div>
      )}
    </section>
  );
}

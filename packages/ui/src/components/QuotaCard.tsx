import type { ProviderBalance, QuotaState } from '@ai-quota-tool/core';
import {
  formatAccountBalance,
  formatTimeRemaining,
  QUOTA_HONESTY_LABELS,
  SERVICE_COLORS,
  SERVICE_URLS,
} from '@ai-quota-tool/core';
import { ProgressRing } from './ProgressRing.js';
import { ServiceHeader } from './ServiceHeader.js';
import { SubcategoryRow } from './SubcategoryRow.js';

interface Props {
  state: QuotaState;
}

function BalanceFigures({ balance, empty }: { balance: ProviderBalance; empty: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
      {balance.infos.map((info) => (
        <div key={info.currency}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: empty ? '#ffb4a8' : '#fff',
            }}
          >
            {formatAccountBalance(info.total, info.currency)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', marginTop: 2 }}>
            Granted {formatAccountBalance(info.granted, info.currency)}
            {' · '}
            Topped up {formatAccountBalance(info.toppedUp, info.currency)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuotaCard({ state }: Props) {
  const bgColor = SERVICE_COLORS[state.service];
  const sessionMs = state.sessionResetsAt != null ? state.sessionResetsAt - Date.now() : 0;
  const weeklyMs = state.weeklyResetsAt != null ? state.weeklyResetsAt - Date.now() : 0;
  const hasRings = state.sessionPct != null || state.weeklyPct != null;
  const honestyLabel = state.honesty != null ? QUOTA_HONESTY_LABELS[state.honesty] : null;
  const deepLinkHost =
    state.honesty != null &&
    (state.service === 'grok' || state.service === 'deepseek' || state.service === 'kimi')
      ? SERVICE_URLS[state.service]
      : null;
  const hasBalance = state.balance != null && state.balance.infos.length > 0;

  const isGrok = state.service === 'grok';

  return (
    <div
      style={{
        background: bgColor,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        // Grok is near-black; a light edge keeps it peer-visible on dark panels
        outline: isGrok ? '1px solid rgba(255,255,255,0.14)' : undefined,
      }}
    >
      <ServiceHeader service={state.service} lastUpdated={state.lastUpdated} />

      {hasBalance && state.balance != null && (
        <BalanceFigures balance={state.balance} empty={state.honesty === 'balance_empty'} />
      )}

      {hasRings ? (
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {state.sessionPct != null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ProgressRing pct={state.sessionPct} size={64} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                Session · resets {formatTimeRemaining(sessionMs)}
              </span>
            </div>
          )}

          {state.weeklyPct != null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ProgressRing pct={state.weeklyPct} size={64} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                Weekly · resets {formatTimeRemaining(weeklyMs)}
              </span>
            </div>
          )}
        </div>
      ) : null}

      {!hasRings && honestyLabel != null ? (
        <div
          style={{
            textAlign: hasBalance ? 'left' : 'center',
            padding: hasBalance ? '4px 0 0' : '12px 8px 4px',
            color: 'rgba(255,255,255,0.75)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {honestyLabel}
          {deepLinkHost != null && (
            <div style={{ marginTop: 8 }}>
              <a
                href={`https://${deepLinkHost}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'rgba(130, 180, 255, 0.95)', fontSize: 11, textDecoration: 'none' }}
              >
                Open {deepLinkHost} ↗
              </a>
            </div>
          )}
        </div>
      ) : null}

      {state.subcategories && state.subcategories.length > 0 && (
        <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
          {state.subcategories.map((sub) => (
            <SubcategoryRow key={sub.name} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

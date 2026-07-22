import type { QuotaState } from '@ai-quota-tool/core';
import {
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

export function QuotaCard({ state }: Props) {
  const bgColor = SERVICE_COLORS[state.service];
  const sessionMs = state.sessionResetsAt != null ? state.sessionResetsAt - Date.now() : 0;
  const weeklyMs = state.weeklyResetsAt != null ? state.weeklyResetsAt - Date.now() : 0;
  const hasRings = state.sessionPct != null || state.weeklyPct != null;
  const honestyLabel = state.honesty != null ? QUOTA_HONESTY_LABELS[state.honesty] : null;
  const deepLinkHost =
    state.service === 'grok' && state.honesty != null ? SERVICE_URLS.grok : null;

  return (
    <div
      style={{
        background: bgColor,
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      <ServiceHeader service={state.service} lastUpdated={state.lastUpdated} />

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
      ) : honestyLabel != null ? (
        <div
          style={{
            textAlign: 'center',
            padding: '12px 8px 4px',
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

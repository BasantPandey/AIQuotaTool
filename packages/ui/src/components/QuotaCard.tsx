import type { QuotaState } from '@ai-quota-tool/core';
import { formatTimeRemaining, SERVICE_COLORS } from '@ai-quota-tool/core';
import { ProgressRing } from './ProgressRing.js';
import { ServiceHeader } from './ServiceHeader.js';
import { SubcategoryRow } from './SubcategoryRow.js';

interface Props {
  state: QuotaState;
}

export function QuotaCard({ state }: Props) {
  const bgColor = SERVICE_COLORS[state.service];
  const sessionMs = state.sessionResetsAt - Date.now();
  const weeklyMs = state.weeklyResetsAt - Date.now();

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

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <ProgressRing pct={state.sessionPct} size={64} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            Session · resets {formatTimeRemaining(sessionMs)}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <ProgressRing pct={state.weeklyPct} size={64} />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            Weekly · resets {formatTimeRemaining(weeklyMs)}
          </span>
        </div>
      </div>

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

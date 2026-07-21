import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { QuotaCard } from './components/QuotaCard.js';
import { QuotaPendingCard } from './components/QuotaPendingCard.js';

const ALL_SERVICES: ServiceId[] = ['claude', 'copilot', 'codex'];

interface Props {
  states: QuotaState[];
  /** Show when no quota data is available yet (credentials not set up) */
  disconnected?: boolean;
  /** Services whose saved session failed auth (secret may still be stored). */
  reauthServices?: ServiceId[];
}

/** Pure display component. Wrap with <Suspense> and <ErrorBoundary> at the call site. */
export function QuotaDashboard({
  states,
  disconnected = false,
  reauthServices = [],
}: Props) {
  const reauthSet = new Set(reauthServices);

  if (disconnected && reauthSet.size === 0) {
    return (
      <div style={{ padding: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 13, lineHeight: 1.55 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
        No quota data yet.
        <br />
        <span style={{ color: 'rgba(255,255,255,0.7)' }}>
          VS Code: run <strong>AI Quota Tool: Set Up Accounts</strong>
        </span>
        <br />
        <span style={{ fontSize: 12 }}>
          or use the Chrome extension while signed into each service.
        </span>
      </div>
    );
  }

  const stateMap = new Map(states.map((s) => [s.service, s]));

  return (
    <div style={{ padding: '8px 10px' }}>
      {ALL_SERVICES.map((serviceId) => {
        const state = stateMap.get(serviceId);
        const needsReauth = reauthSet.has(serviceId);
        const hasData =
          !needsReauth &&
          state != null &&
          (state.sessionPct != null || state.weeklyPct != null || state.honesty != null);
        return hasData
          ? <QuotaCard key={serviceId} state={state} />
          : <QuotaPendingCard key={serviceId} service={serviceId} needsReauth={needsReauth} />;
      })}
    </div>
  );
}

/** Fallback rendered by <ErrorBoundary> if the quota fetch throws. */
export function QuotaErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: 20, color: '#ff6b6b', textAlign: 'center', fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      Failed to load quota data.
      <br />
      <span style={{ fontSize: 11, color: 'rgba(255,100,100,0.7)' }}>{error.message}</span>
    </div>
  );
}

/** Fallback rendered by <Suspense> while the first load is in-flight. */
export function QuotaLoadingFallback() {
  return (
    <div style={{ padding: 20, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8, animation: 'spin 1s linear infinite' }}>⟳</div>
      Loading…
    </div>
  );
}

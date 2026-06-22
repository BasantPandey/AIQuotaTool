import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { QuotaCard } from './components/QuotaCard.js';
import { QuotaPendingCard } from './components/QuotaPendingCard.js';

const ALL_SERVICES: ServiceId[] = ['claude', 'copilot', 'codex'];

interface Props {
  states: QuotaState[];
  /** VS Code only: show when Chrome extension is not connected */
  disconnected?: boolean;
}

/** Pure display component. Wrap with <Suspense> and <ErrorBoundary> at the call site. */
export function QuotaDashboard({ states, disconnected = false }: Props) {
  if (disconnected) {
    return (
      <div style={{ padding: 20, color: 'rgba(255,255,255,0.5)', textAlign: 'center', fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
        Chrome extension not connected.
        <br />
        Install and enable the AI Quota Tool Chrome extension.
      </div>
    );
  }

  const stateMap = new Map(states.map((s) => [s.service, s]));

  return (
    <div style={{ padding: '8px 10px' }}>
      {ALL_SERVICES.map((serviceId) => {
        const state = stateMap.get(serviceId);
        return state
          ? <QuotaCard key={serviceId} state={state} />
          : <QuotaPendingCard key={serviceId} service={serviceId} />;
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

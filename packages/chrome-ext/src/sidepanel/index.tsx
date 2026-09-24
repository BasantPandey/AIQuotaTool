import { StrictMode, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import {
  DEFAULT_ENABLED_SERVICES,
  deriveConnections,
  ENABLED_SERVICES_KEY,
  filterEnabled,
  lowestPressureAmong,
  resolveEnabledServices,
  SERVICES,
  SERVICE_URLS,
} from '@ai-quota-tool/core';
import { levelColor, ProviderCard, ProviderLogo, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import { API_KEYS_STORAGE_KEY, type StoredApiKeys } from '../background/api-keys.js';
import { GITHUB_TOKEN_STORAGE_KEY } from '../background/github-auth.js';
import { CopilotConnectButton, ProvidersView } from './ProvidersView.js';
import { BrandMark, SERVICE_HINTS } from './shared.js';

const CONSENT_KEY = 'privacyConsent';
const SITE_URL = 'https://basantpandey.github.io/AIQuotaTool/';

function readStorage<T>(key: string, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve((result[key] as T | undefined) ?? fallback);
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
});

function apiKeyTails(keys: StoredApiKeys): Partial<Record<ServiceId, string>> {
  const tails: Partial<Record<ServiceId, string>> = {};
  for (const service of SERVICES) {
    if (service.auth !== 'api_key') continue;
    const key = keys[service.id];
    if (typeof key === 'string' && key.length >= 4) tails[service.id] = key.slice(-4);
  }
  return tails;
}

function Welcome() {
  const [picked, setPicked] = useState<ServiceId[]>(DEFAULT_ENABLED_SERVICES);
  return (
    <div className="welcome">
      <BrandMark size={44} />
      <h1>See every AI limit in one place</h1>
      <p className="lead">Pick the tools you use. You can change this at any time.</p>
      {SERVICES.map((service) => (
        <label className="row" key={service.id} style={{ alignItems: 'center', cursor: 'pointer' }}>
          <ProviderLogo service={service.id} size={28} />
          <span className="row-main row-title">
            {service.label}
            {service.auth === 'api_key' && <span className="row-hint"> · API balance</span>}
          </span>
          <input
            className="switch"
            style={{ marginTop: 0 }}
            type="checkbox"
            role="switch"
            checked={picked.includes(service.id)}
            onChange={(event) =>
              setPicked((prev) =>
                event.target.checked ? [...prev, service.id] : prev.filter((id) => id !== service.id),
              )
            }
          />
        </label>
      ))}
      <div className="privacy">
        <strong>Private by design.</strong> The extension reads your quota with the sessions you already
        have in this browser. Your data stays on this device. There is no server and no account.
      </div>
      <button
        className="btn btn-primary"
        style={{ width: '100%', height: 38, fontSize: 13 }}
        onClick={() => {
          chrome.storage.local.set({
            [ENABLED_SERVICES_KEY]: resolveEnabledServices(picked),
            [CONSENT_KEY]: true,
          });
        }}
      >
        Get started
      </button>
    </div>
  );
}

function CardAction({
  service,
  githubConnected,
  onProviders,
}: {
  service: (typeof SERVICES)[number];
  githubConnected: boolean;
  onProviders: () => void;
}) {
  if (service.auth === 'oauth') return <CopilotConnectButton connected={githubConnected} />;
  if (service.auth === 'api_key') {
    return (
      <button className="btn btn-primary" onClick={onProviders}>
        Add API key
      </button>
    );
  }
  return (
    <a className="btn" href={`https://${SERVICE_URLS[service.id]}`} target="_blank" rel="noreferrer">
      Open {SERVICE_URLS[service.id]}
    </a>
  );
}

function Panel() {
  const { data: allStates } = useSuspenseQuery({
    queryKey: ['quota-states'],
    queryFn: () => readStorage<QuotaState[]>('quotaStates', []),
  });
  const { data: githubConnected } = useSuspenseQuery({
    queryKey: ['github-connected'],
    queryFn: () => readStorage<string>(GITHUB_TOKEN_STORAGE_KEY, '').then((t) => t.length > 0),
  });
  const { data: keyTails } = useSuspenseQuery({
    queryKey: ['api-key-tails'],
    queryFn: () => readStorage<StoredApiKeys>(API_KEYS_STORAGE_KEY, {}).then(apiKeyTails),
  });
  const { data: consent } = useSuspenseQuery({
    queryKey: ['privacy-consent'],
    queryFn: () => readStorage(CONSENT_KEY, false),
  });
  const { data: enabled } = useSuspenseQuery({
    queryKey: ['enabled-services'],
    queryFn: () => readStorage<unknown>(ENABLED_SERVICES_KEY, undefined).then(resolveEnabledServices),
  });
  const [view, setView] = useState<'dashboard' | 'providers'>('dashboard');

  if (!consent) return <Welcome />;

  const states = filterEnabled(allStates, enabled);
  const lowest = lowestPressureAmong(states);
  const visible = SERVICES.filter((service) => enabled.includes(service.id));

  return (
    <div className="shell">
      <header className="topbar">
        {view === 'providers' ? (
          <>
            <button className="btn btn-ghost btn-icon" aria-label="Back" onClick={() => setView('dashboard')}>
              ←
            </button>
            <span className="brand-name" style={{ flex: 1 }}>
              Providers
            </span>
            <button className="btn btn-primary" onClick={() => setView('dashboard')}>
              Done
            </button>
          </>
        ) : (
          <>
            <div className="brand">
              <BrandMark />
              <span className="brand-name">AI Quota</span>
            </div>
            {lowest != null && (
              <span className="summary" title="Lowest remaining quota across your providers">
                <span className="dot" style={{ background: levelColor(lowest) }} />
                Lowest <strong>{lowest}%</strong>
              </span>
            )}
            <button className="btn" onClick={() => setView('providers')}>
              Providers
            </button>
          </>
        )}
      </header>

      {view === 'providers' ? (
        <ProvidersView
          enabled={enabled}
          connections={deriveConnections(states)}
          githubConnected={githubConnected}
          apiKeyTails={keyTails}
          states={states}
        />
      ) : visible.length === 0 ? (
        <div className="empty">
          <BrandMark size={40} />
          <h2>No providers yet</h2>
          <p>Add the AI tools you use to see their limits here.</p>
          <button className="btn btn-primary" onClick={() => setView('providers')}>
            Add providers
          </button>
        </div>
      ) : (
        <main className="content">
          {visible.map((service) => {
            const state = states.find((s) => s.service === service.id);
            return (
              <ProviderCard
                key={service.id}
                service={service.id}
                {...(state != null ? { state } : {})}
                hint={SERVICE_HINTS[service.id]}
                action={
                  <CardAction
                    service={service}
                    githubConnected={githubConnected}
                    onProviders={() => setView('providers')}
                  />
                }
              />
            );
          })}
        </main>
      )}

      <footer className="footer">
        Free · Private · No account ·{' '}
        <a href={SITE_URL} target="_blank" rel="noreferrer">
          Help
        </a>
      </footer>
    </div>
  );
}

// Push freshness: the worker writes merged readings to storage; the panel
// re-renders on change. No panel-side polling.
const QUERY_BY_KEY: Record<string, string> = {
  quotaStates: 'quota-states',
  [GITHUB_TOKEN_STORAGE_KEY]: 'github-connected',
  [API_KEYS_STORAGE_KEY]: 'api-key-tails',
  [CONSENT_KEY]: 'privacy-consent',
  [ENABLED_SERVICES_KEY]: 'enabled-services',
};
chrome.storage.local.onChanged.addListener((changes) => {
  for (const key of Object.keys(changes)) {
    const queryKey = QUERY_BY_KEY[key];
    if (queryKey) queryClient.invalidateQueries({ queryKey: [queryKey] });
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
        <Suspense fallback={<QuotaLoadingFallback />}>
          <Panel />
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);

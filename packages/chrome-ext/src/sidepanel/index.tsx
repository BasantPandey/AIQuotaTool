import { StrictMode, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { ChromeServiceId, KeyRecord, QuotaState } from '@ai-quota-tool/core';
import {
  connectionKindOf,
  DEFAULT_ENABLED_SERVICES,
  deriveConnections,
  ENABLED_SERVICES_KEY,
  filterEnabled,
  parseKeyRecords,
  resolveEnabledServices,
  CHROME_SERVICES,
  SERVICE_URLS,
} from '@ai-quota-tool/core';
import { KeyGroupCard, LowestLimit, ProviderCard, ProviderLogo, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import '@ai-quota-tool/ui/styles.css';
import './styles.css';
import { KEY_LIST_STORAGE_KEY } from '../background/api-keys.js';
import { GITHUB_TOKEN_STORAGE_KEY } from '../background/github-auth.js';
import { groupKeys, keyCaption, PLUS } from './KeysView.js';
import { CopilotConnectButton, ProvidersView, type ProvidersTab } from './ProvidersView.js';
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

function Welcome() {
  const [picked, setPicked] = useState<ChromeServiceId[]>(DEFAULT_ENABLED_SERVICES);
  return (
    <div className="welcome">
      <BrandMark size={44} />
      <h1>See every AI limit in one place</h1>
      <p className="lead">Pick the tools you use. You can change this at any time.</p>
      {CHROME_SERVICES.filter((service) => service.auth !== 'api_key').map((service) => (
        <label className="row" key={service.id} style={{ alignItems: 'center', cursor: 'pointer' }}>
          <ProviderLogo service={service.id} size={28} />
          <span className="row-main row-title">{service.label}</span>
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
      <p className="row-hint" style={{ margin: '4px 2px 0' }}>
        You can add API keys on the Providers screen later.
      </p>
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
}: {
  service: (typeof CHROME_SERVICES)[number];
  githubConnected: boolean;
}) {
  if (service.auth === 'oauth') return <CopilotConnectButton connected={githubConnected} />;
  return (
    <a className="btn" href={`https://${SERVICE_URLS[service.id]}`} target="_blank" rel="noreferrer">
      Open {SERVICE_URLS[service.id]}
    </a>
  );
}

function KeyIcon() {
  return (
    <span className="keys-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="15" r="4" />
        <path d="M10.8 12.2 20 3M16 7l3 3M18 5l2 2" />
      </svg>
    </span>
  );
}

/** Shown in the plan grid when there is no API key yet. */
function NoKeysCard({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="card" aria-label="API keys">
      <header className="card-head">
        <KeyIcon />
        <span className="card-title">API keys</span>
      </header>
      <p className="card-note">See the balance or spend of your API keys. You can add many keys for one provider.</p>
      <div className="card-action">
        <button className="btn btn-primary" onClick={onAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d={PLUS} />
          </svg>{' '}
          Add a key
        </button>
      </div>
    </section>
  );
}

/** One card for each key provider, under its own heading. */
function KeysSection({ keys, states, onManage }: { keys: KeyRecord[]; states: QuotaState[]; onManage: () => void }) {
  return (
    <section aria-label="API keys">
      <div className="section-head">
        <span className="hero-kicker">API keys</span>
        <button className="btn btn-ghost keys-manage" onClick={onManage}>
          Manage keys
        </button>
      </div>
      <div className="cards">
        {groupKeys(keys, states).map(({ service, items }) => (
          <KeyGroupCard key={service} service={service} caption={keyCaption(service)} items={items} />
        ))}
      </div>
    </section>
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
  const { data: keys } = useSuspenseQuery({
    queryKey: ['api-keys'],
    queryFn: () => readStorage<unknown>(KEY_LIST_STORAGE_KEY, []).then(parseKeyRecords),
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
  const [tab, setTab] = useState<ProvidersTab>('plans');
  const [startAdding, setStartAdding] = useState(false);

  function openProviders(next: ProvidersTab, adding = false) {
    setTab(next);
    setStartAdding(adding);
    setView('providers');
  }

  if (!consent) return <Welcome />;

  // Plan readings follow the provider switches. A key reading shows while its key exists.
  const states = [
    ...filterEnabled(allStates, enabled).filter((s) => connectionKindOf(s) === 'account'),
    ...allStates.filter((s) => connectionKindOf(s) === 'key'),
  ];
  const visible = CHROME_SERVICES.filter((service) => service.auth !== 'api_key' && enabled.includes(service.id));

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
            <button className="btn" onClick={() => openProviders('plans')}>
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
          keys={keys}
          states={states}
          tab={tab}
          onTab={(next) => {
            setTab(next);
            setStartAdding(false);
          }}
          startAdding={startAdding}
        />
      ) : visible.length === 0 && keys.length === 0 ? (
        <div className="empty">
          <BrandMark size={40} />
          <h2>No providers yet</h2>
          <p>Add the AI tools you use to see their limits here.</p>
          <button className="btn btn-primary" onClick={() => openProviders('plans')}>
            Add providers
          </button>
        </div>
      ) : (
        <main className="content">
          <LowestLimit states={states.filter((s) => connectionKindOf(s) === 'account')} />
          <div className="cards">
            {visible.map((service) => {
              const state = states.find((s) => s.service === service.id && connectionKindOf(s) === 'account');
              return (
                <ProviderCard
                  key={service.id}
                  service={service.id}
                  {...(state != null ? { state } : {})}
                  hint={SERVICE_HINTS[service.id]}
                  action={<CardAction service={service} githubConnected={githubConnected} />}
                />
              );
            })}
            {keys.length === 0 && <NoKeysCard onAdd={() => openProviders('keys', true)} />}
          </div>
          {keys.length > 0 && <KeysSection keys={keys} states={states} onManage={() => openProviders('keys')} />}
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
  [KEY_LIST_STORAGE_KEY]: 'api-keys',
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

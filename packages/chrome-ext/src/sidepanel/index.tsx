import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { deriveConnections, SERVICES } from '@ai-quota-tool/core';
import { QuotaDashboard, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import { AccountsSection } from './AccountsSection.js';
import { API_KEYS_STORAGE_KEY, type StoredApiKeys } from '../background/api-keys.js';
import { GITHUB_TOKEN_STORAGE_KEY } from '../background/github-auth.js';

const GITHUB_TOKEN_KEY = GITHUB_TOKEN_STORAGE_KEY;
const CONSENT_KEY = 'privacyConsent';

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

function ConsentView({ onAccept }: { onAccept: () => void }) {
  return (
    <div style={{ padding: '16px 14px', fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Welcome to AI Quota Tool
      </div>
      <p style={{ color: '#8b949e' }}>
        See your remaining quota for Claude, Codex, Copilot, and Grok, plus your DeepSeek
        API balance, in one place.
      </p>
      <p
        style={{
          color: '#8b949e',
          padding: '10px 12px',
          border: '1px solid #3d3d00',
          borderRadius: 4,
          background: 'rgba(184,149,0,0.08)',
        }}
      >
        <strong>Privacy:</strong> this extension reads your own AI quota through your{' '}
        <em>logged-in browser sessions</em> (Claude, Codex, Grok), an optional GitHub
        sign-in (Copilot seat status), and an optional DeepSeek API key (balance only).
        The key stays on this device and is sent only to api.deepseek.com. Disconnect
        removes it. The extension never stores session keys and does not send your data
        to a server of ours.
      </p>
      <button
        onClick={onAccept}
        style={{
          background: '#238636',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '8px 14px',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        I understand - get started
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ padding: '16px 14px', fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', marginBottom: 6 }}>
        No quota data yet
      </div>
      <p>
        Sign in to a service below (Claude, Codex, or Grok in their own tabs, Copilot via
        GitHub, DeepSeek with an API key). Readings appear here automatically within a
        minute.
      </p>
    </div>
  );
}

function apiKeyTails(keys: StoredApiKeys): Partial<Record<ServiceId, string>> {
  const tails: Partial<Record<ServiceId, string>> = {};
  for (const service of SERVICES) {
    if (service.auth !== 'api_key') continue;
    const key = keys[service.id];
    if (typeof key === 'string' && key.length >= 4) tails[service.id] = key.slice(-4);
  }
  return tails;
}

function Panel() {
  const { data: states } = useSuspenseQuery({
    queryKey: ['quota-states'],
    queryFn: () => readStorage<QuotaState[]>('quotaStates', []),
  });
  const { data: githubConnected } = useSuspenseQuery({
    queryKey: ['github-connected'],
    queryFn: () => readStorage<string>(GITHUB_TOKEN_KEY, '').then((t) => t.length > 0),
  });
  const { data: keyTails } = useSuspenseQuery({
    queryKey: ['api-key-tails'],
    queryFn: () => readStorage<StoredApiKeys>(API_KEYS_STORAGE_KEY, {}).then(apiKeyTails),
  });
  const { data: consent } = useSuspenseQuery({
    queryKey: ['privacy-consent'],
    queryFn: () => readStorage(CONSENT_KEY, false),
  });

  if (!consent) {
    return (
      <ConsentView
        onAccept={() => {
          chrome.storage.local.set({ [CONSENT_KEY]: true });
        }}
      />
    );
  }

  const connections = deriveConnections(states);

  return (
    <div>
      {states.length === 0 ? (
        <EmptyState />
      ) : (
        <QuotaDashboard states={states} services={SERVICES.map((service) => service.id)} />
      )}
      <AccountsSection
        connections={connections}
        githubConnected={githubConnected}
        apiKeyTails={keyTails}
        states={states}
      />
    </div>
  );
}

// Push freshness: the worker writes merged readings to storage; the panel
// re-renders on change. No panel-side polling.
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes['quotaStates']) {
    queryClient.invalidateQueries({ queryKey: ['quota-states'] });
  }
  if (changes[GITHUB_TOKEN_KEY]) {
    queryClient.invalidateQueries({ queryKey: ['github-connected'] });
  }
  if (changes[API_KEYS_STORAGE_KEY]) {
    queryClient.invalidateQueries({ queryKey: ['api-key-tails'] });
  }
  if (changes[CONSENT_KEY]) {
    queryClient.invalidateQueries({ queryKey: ['privacy-consent'] });
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div
        style={{
          background: '#0d1117',
          minHeight: '100vh',
          color: '#e6edf3',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
          <Suspense fallback={<QuotaLoadingFallback />}>
            <Panel />
          </Suspense>
        </ErrorBoundary>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);

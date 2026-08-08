import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState } from '@ai-quota-tool/core';
import { deriveConnections } from '@ai-quota-tool/core';
import { QuotaDashboard, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import { AccountsSection } from './AccountsSection.js';
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
        See your remaining quota for Claude, Codex, Copilot, and Grok in one place.
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
        <em>logged-in browser sessions</em> (Claude, Codex, Grok) and an optional GitHub
        sign-in (Copilot seat status). It never stores session keys, never sends your
        data anywhere, and everything stays on this device.
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
        GitHub). Readings appear here automatically within a minute.
      </p>
    </div>
  );
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
      {states.length === 0 ? <EmptyState /> : <QuotaDashboard states={states} />}
      <AccountsSection connections={connections} githubConnected={githubConnected} />
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

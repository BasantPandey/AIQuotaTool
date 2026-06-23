import { StrictMode, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState } from '@ai-quota-tool/core';
import { QuotaDashboard, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import { SettingsTab } from './SettingsTab.js';

type Tab = 'dashboard' | 'settings';

function readStorageStates(): Promise<QuotaState[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['quotaStates'], (result) => {
      resolve((result['quotaStates'] as QuotaState[] | undefined) ?? []);
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
});

function QuotaView() {
  const { data: states } = useSuspenseQuery({
    queryKey: ['quota-states'],
    queryFn: readStorageStates,
    refetchInterval: 5_000,
  });

  return <QuotaDashboard states={states} />;
}

const tabBtnBase: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '8px 0',
  cursor: 'pointer',
  fontSize: 12,
  color: '#8b949e',
};

function Popup() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ background: '#0d1117', minWidth: 320, minHeight: 200, fontFamily: 'system-ui, sans-serif' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #21262d' }}>
          <button
            style={{
              ...tabBtnBase,
              color: tab === 'dashboard' ? '#e6edf3' : '#8b949e',
              borderBottomColor: tab === 'dashboard' ? '#58a6ff' : 'transparent',
            }}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            style={{
              ...tabBtnBase,
              color: tab === 'settings' ? '#e6edf3' : '#8b949e',
              borderBottomColor: tab === 'settings' ? '#58a6ff' : 'transparent',
            }}
            onClick={() => setTab('settings')}
          >
            Accounts
          </button>
        </div>

        {tab === 'dashboard' ? (
          <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
            <Suspense fallback={<QuotaLoadingFallback />}>
              <QuotaView />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
            <Suspense fallback={<QuotaLoadingFallback />}>
              <SettingsTabView />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </QueryClientProvider>
  );
}

function SettingsTabView() {
  const { data: states } = useSuspenseQuery({
    queryKey: ['quota-states'],
    queryFn: readStorageStates,
    refetchInterval: 5_000,
  });
  return <SettingsTab states={states} />;
}

// Invalidate TanStack Query cache whenever chrome.storage updates
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes['quotaStates']) {
    queryClient.invalidateQueries({ queryKey: ['quota-states'] });
  }
});

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);

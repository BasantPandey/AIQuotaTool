import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState } from '@ai-quota-tool/core';
import { QuotaDashboard, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';

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

function Popup() {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ background: '#0d1117', minWidth: 320, minHeight: 200, fontFamily: 'system-ui, sans-serif' }}>
        <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
          <Suspense fallback={<QuotaLoadingFallback />}>
            <QuotaView />
          </Suspense>
        </ErrorBoundary>
      </div>
    </QueryClientProvider>
  );
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

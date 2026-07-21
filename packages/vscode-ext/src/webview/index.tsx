import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { QuotaDashboard, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
  },
});

/** Extension host pushes { type: 'quota_update', payload, disconnected, reauthServices } */
window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    payload?: QuotaState[];
    disconnected?: boolean;
    reauthServices?: ServiceId[];
  };
  if (msg.type === 'quota_update') {
    queryClient.setQueryData(['quota-states'], msg.payload ?? []);
    queryClient.setQueryData(['disconnected'], msg.disconnected ?? false);
    queryClient.setQueryData(['reauth-services'], msg.reauthServices ?? []);
  }
});

function QuotaView() {
  const { data: states = [] } = useQuery<QuotaState[]>({
    queryKey: ['quota-states'],
    queryFn: () => [],
    initialData: [],
  });

  const { data: disconnected = false } = useQuery<boolean>({
    queryKey: ['disconnected'],
    queryFn: () => false,
    initialData: false,
  });

  const { data: reauthServices = [] } = useQuery<ServiceId[]>({
    queryKey: ['reauth-services'],
    queryFn: () => [],
    initialData: [],
  });

  useEffect(() => {
    // Signal to extension host that the webview is ready for data
    vscode?.postMessage({ type: 'webview_ready' });
  }, []);

  return (
    <QuotaDashboard
      states={states}
      disconnected={disconnected}
      reauthServices={reauthServices}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ background: '#0d1117', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
          <Suspense fallback={<QuotaLoadingFallback />}>
            <QuotaView />
          </Suspense>
        </ErrorBoundary>
      </div>
    </QueryClientProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { SERVICE_IDS } from '@ai-quota-tool/core';
import { LowestLimit, ProviderCard, QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import '@ai-quota-tool/ui/styles.css';
import '@ai-quota-tool/ui/vscode.css';

/** Services the VS Code poller reads. Others show only when Chrome pushes a reading. */
const POLLED: ReadonlySet<ServiceId> = new Set(['claude', 'copilot', 'codex', 'grok', 'deepseek', 'kimi']);

const HINTS: Partial<Record<ServiceId, string>> = {
  claude: 'Add your claude.ai session key in Set Up Accounts.',
  copilot: 'Sign in to GitHub in Set Up Accounts to check your Copilot plan.',
  codex: 'Add your ChatGPT session token in Set Up Accounts.',
  grok: 'Add your grok.com sso cookie in Set Up Accounts.',
  deepseek: 'Add an API key from platform.deepseek.com in Set Up Accounts.',
  kimi: 'Add an API key from platform.kimi.ai in Set Up Accounts.',
};
const DEFAULT_HINT = 'Open the site in Chrome with the AI Quota extension.';
const EXPIRED_HINT = 'Your saved session expired. Paste a new one in Set Up Accounts, or clear it.';

declare const acquireVsCodeApi: () => { postMessage: (msg: unknown) => void };
const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;
const openSetup = () => vscode?.postMessage({ type: 'open_setup' });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
  },
});

/** Extension host pushes { type: 'quota_update', payload, reauthServices } */
window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as { type: string; payload?: QuotaState[]; reauthServices?: ServiceId[] };
  if (msg.type === 'quota_update') {
    queryClient.setQueryData(['quota-states'], msg.payload ?? []);
    queryClient.setQueryData(['reauth-services'], msg.reauthServices ?? []);
  }
});

function QuotaView() {
  const { data: polled } = useQuery<QuotaState[]>({
    queryKey: ['quota-states'],
    queryFn: () => [],
    initialData: [],
  });
  const { data: reauth } = useQuery<ServiceId[]>({
    queryKey: ['reauth-services'],
    queryFn: () => [],
    initialData: [],
  });

  useEffect(() => {
    vscode?.postMessage({ type: 'webview_ready' });
  }, []);

  // The poller drops a reading when its session fails. Show that as an expired session, not as "never set up".
  const states = [
    ...polled.filter((s) => !reauth.includes(s.service)),
    ...reauth.map((service): QuotaState => ({ service, honesty: 'session_expired', lastUpdated: Date.now() })),
  ];
  const visible = SERVICE_IDS.filter((id) => POLLED.has(id) || states.some((s) => s.service === id));

  return (
    <main className="page">
      <header className="page-head">
        <h1>AI Quota</h1>
        <button className="btn" onClick={openSetup}>
          Set Up Accounts
        </button>
      </header>
      <LowestLimit states={states} />
      <div className="cards">
        {visible.map((service) => {
          const state = states.find((s) => s.service === service);
          return (
            <ProviderCard
              key={service}
              service={service}
              {...(state != null ? { state } : {})}
              hint={reauth.includes(service) ? EXPIRED_HINT : (HINTS[service] ?? DEFAULT_HINT)}
              {...(POLLED.has(service)
                ? { action: <button className="btn btn-primary" onClick={openSetup}>Set up</button> }
                : {})}
            />
          );
        })}
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
        <Suspense fallback={<QuotaLoadingFallback />}>
          <QuotaView />
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
);

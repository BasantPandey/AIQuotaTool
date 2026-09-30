import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { QuotaErrorFallback, QuotaLoadingFallback } from '@ai-quota-tool/ui';
import '@ai-quota-tool/ui/styles.css';
import '@ai-quota-tool/ui/vscode.css';
import './panel.css';
import type { PanelTab } from './protocol.js';
import { queryClient, send, useSnapshot, useTab } from './store.js';
import { UsageTab } from './UsageTab.js';
import { AccountsTab } from './AccountsTab.js';
import { KeysTab } from './KeysTab.js';

function Panel() {
  const snapshot = useSnapshot();
  const [tab, setTab] = useTab();
  const signedIn = snapshot.accounts.filter((a) => a.status !== 'none').length;
  const tabs: [PanelTab, string][] = [
    ['usage', 'Usage'],
    ['accounts', `Accounts (${signedIn})`],
    ['keys', `Keys (${snapshot.keys.length})`],
  ];

  return (
    <main className="page">
      <nav className="tabs" role="tablist" aria-label="AI Quota Tool">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls="tab-panel"
            className={tab === id ? 'tab on' : 'tab'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'usage' && <UsageTab snapshot={snapshot} onTab={setTab} />}
        {tab === 'accounts' && <AccountsTab accounts={snapshot.accounts} />}
        {tab === 'keys' && <KeysTab keys={snapshot.keys} readings={snapshot.readings} />}
      </section>
    </main>
  );
}

function App() {
  useEffect(() => {
    send({ type: 'ready' });
  }, []);
  return (
    <ErrorBoundary FallbackComponent={QuotaErrorFallback}>
      <Suspense fallback={<QuotaLoadingFallback />}>
        <Panel />
      </Suspense>
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

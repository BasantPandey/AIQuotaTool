import type React from 'react';
import { useEffect, useState } from 'react';
import type { ChromeServiceId, KeyRecord, QuotaState } from '@ai-quota-tool/core';
import { CHROME_SERVICES, ENABLED_SERVICES_KEY, SERVICE_URLS } from '@ai-quota-tool/core';
import { ProviderLogo } from '@ai-quota-tool/ui';
import { type DeviceCode, requestDeviceCode, waitForDeviceToken } from '../background/github-auth.js';
import { KeysView } from './KeysView.js';
import { SERVICE_HINTS, sendPanelMessage, useAction } from './shared.js';

export type ProvidersTab = 'plans' | 'keys';

interface Props {
  enabled: ChromeServiceId[];
  connections: Record<ChromeServiceId, boolean>;
  githubConnected: boolean;
  /** Named API keys. No secrets. */
  keys: KeyRecord[];
  states: QuotaState[];
  tab: ProvidersTab;
  onTab: (tab: ProvidersTab) => void;
  /** Open the add form on the API keys tab. */
  startAdding: boolean;
}

export function setEnabled(enabled: ChromeServiceId[], service: ChromeServiceId, on: boolean): Promise<void> {
  const next = on ? [...enabled, service] : enabled.filter((id) => id !== service);
  return chrome.storage.local.set({ [ENABLED_SERVICES_KEY]: next });
}

function Status({ tone, children }: { tone: 'ok' | 'warn' | 'idle'; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={tone === 'idle' ? 'dot' : `dot ${tone}`} />
      {children}
    </span>
  );
}

/** GitHub device flow: show a code, the user approves on GitHub, the panel stores the token. */
export function CopilotConnectButton({ connected }: { connected: boolean }) {
  const { pending, error, run } = useAction();
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [flowError, setFlowError] = useState<string | undefined>();

  // Poll while the code shows. Closing the panel or Cancel stops the poll.
  useEffect(() => {
    if (code == null) return;
    const abort = new AbortController();
    waitForDeviceToken(code, abort.signal)
      .then((stored) => {
        if (stored) setCode(null);
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        setCode(null);
        setFlowError(err instanceof Error ? err.message : 'GitHub sign-in failed. Try again.');
      });
    return () => abort.abort();
  }, [code]);

  async function start() {
    setFlowError(undefined);
    setCopied(false);
    setStarting(true);
    try {
      setCode(await requestDeviceCode());
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : 'GitHub sign-in failed. Try again.');
    } finally {
      setStarting(false);
    }
  }

  function copyAndOpen(device: DeviceCode) {
    navigator.clipboard.writeText(device.userCode).then(() => setCopied(true), () => setCopied(false));
    window.open(device.verificationUri, '_blank', 'noreferrer');
  }

  if (connected) {
    return (
      <>
        <button className="btn btn-ghost" disabled={pending} onClick={() => void run(() => sendPanelMessage({ type: 'github_disconnect' }))}>
          {pending ? 'Working…' : 'Disconnect'}
        </button>
        {error && <div className="error">{error}</div>}
      </>
    );
  }

  if (code != null) {
    return (
      <div className="device" role="status">
        <div className="device-label">Enter this code on GitHub</div>
        <div className="device-code num">{code.userCode}</div>
        <div className="device-actions">
          <button className="btn btn-primary" onClick={() => copyAndOpen(code)}>
            {copied ? 'Code copied - open GitHub again' : 'Copy code and open GitHub'}
          </button>
          <button className="btn btn-ghost" onClick={() => setCode(null)}>
            Cancel
          </button>
        </div>
        <div className="device-wait">
          <span className="dot warn" />
          Waiting for you to approve on GitHub
        </div>
      </div>
    );
  }

  return (
    <>
      <button className="btn btn-primary" disabled={starting} onClick={() => void start()}>
        {starting ? 'Working…' : 'Connect GitHub'}
      </button>
      {flowError && <div className="error">{flowError}</div>}
    </>
  );
}

function SessionControls({ service, connected }: { service: ChromeServiceId; connected: boolean }) {
  return (
    <div className="row-status">
      <Status tone={connected ? 'ok' : 'idle'}>{connected ? 'Signed in' : 'Not signed in'}</Status>
      {!connected && (
        <a className="btn" href={`https://${SERVICE_URLS[service]}`} target="_blank" rel="noreferrer">
          Open {SERVICE_URLS[service]}
        </a>
      )}
    </div>
  );
}

function Tabs({ tab, onTab, keyCount }: { tab: ProvidersTab; onTab: (tab: ProvidersTab) => void; keyCount: number }) {
  const tabs: { id: ProvidersTab; label: string }[] = [
    { id: 'plans', label: 'Plans' },
    { id: 'keys', label: 'API keys' },
  ];
  return (
    <div className="tabs" role="tablist" aria-label="Provider type">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          id={`tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`panel-${t.id}`}
          className={tab === t.id ? 'tab active' : 'tab'}
          onClick={() => onTab(t.id)}
        >
          {t.label}
          {t.id === 'keys' && keyCount > 0 && <span className="count num">{keyCount}</span>}
        </button>
      ))}
    </div>
  );
}

export function ProvidersView({ enabled, connections, githubConnected, keys, states, tab, onTab, startAdding }: Props) {
  return (
    <>
      <Tabs tab={tab} onTab={onTab} keyCount={keys.length} />
      {tab === 'keys' ? (
        <div role="tabpanel" id="panel-keys" aria-labelledby="tab-keys">
          <KeysView keys={keys} states={states} startAdding={startAdding} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-plans" aria-labelledby="tab-plans" className="content">
          <p className="row-hint" style={{ margin: '4px 2px 10px' }}>
            Plan limits come from the sessions that you already have in this browser.
          </p>
          {CHROME_SERVICES.filter((service) => service.auth !== 'api_key').map((service) => {
            const on = enabled.includes(service.id);
            return (
              <div className="row" key={service.id}>
                <ProviderLogo service={service.id} size={30} />
                <div className="row-main">
                  <div className="row-title">{service.label}</div>
                  <div className="row-hint">{SERVICE_HINTS[service.id]}</div>
                  {on && service.auth === 'oauth' && (
                    <div className="row-status">
                      <Status tone={githubConnected ? 'ok' : 'idle'}>
                        {githubConnected ? 'GitHub connected' : 'Not connected'}
                      </Status>
                      <CopilotConnectButton connected={githubConnected} />
                    </div>
                  )}
                  {on && service.auth === 'session' && (
                    <SessionControls service={service.id} connected={connections[service.id]} />
                  )}
                </div>
                <input
                  className="switch"
                  type="checkbox"
                  role="switch"
                  checked={on}
                  aria-label={`Show ${service.label}`}
                  onChange={(event) => void setEnabled(enabled, service.id, event.target.checked)}
                />
              </div>
            );
          })}
          <p className="row-hint" style={{ margin: '12px 2px 0' }}>
            A provider that you turn off is not checked. It does not show in the badge or in alerts.
          </p>
        </div>
      )}
    </>
  );
}

import type React from 'react';
import { useState } from 'react';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { ENABLED_SERVICES_KEY, SERVICES, SERVICE_LABELS, SERVICE_URLS } from '@ai-quota-tool/core';
import { ProviderLogo } from '@ai-quota-tool/ui';
import { SERVICE_HINTS, sendPanelMessage } from './shared.js';

interface Props {
  enabled: ServiceId[];
  connections: Record<ServiceId, boolean>;
  githubConnected: boolean;
  /** Last 4 characters of a stored API key, keyed by service. */
  apiKeyTails: Partial<Record<ServiceId, string>>;
  states: QuotaState[];
}

export function setEnabled(enabled: ServiceId[], service: ServiceId, on: boolean): Promise<void> {
  const next = on ? [...enabled, service] : enabled.filter((id) => id !== service);
  return chrome.storage.local.set({ [ENABLED_SERVICES_KEY]: next });
}

function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  async function run(send: () => Promise<{ ok: boolean; error?: string }>): Promise<boolean> {
    setPending(true);
    setError(undefined);
    try {
      const res = await send();
      if (!res.ok) setError(res.error ?? 'Something went wrong. Try again.');
      return res.ok;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, run };
}

function Status({ tone, children }: { tone: 'ok' | 'warn' | 'idle'; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span className={tone === 'idle' ? 'dot' : `dot ${tone}`} />
      {children}
    </span>
  );
}

export function CopilotConnectButton({ connected }: { connected: boolean }) {
  const { pending, error, run } = useAction();
  const type = connected ? 'github_disconnect' : 'github_connect';
  return (
    <>
      <button
        className={connected ? 'btn btn-ghost' : 'btn btn-primary'}
        disabled={pending}
        onClick={() => void run(() => sendPanelMessage({ type }))}
      >
        {pending ? 'Working…' : connected ? 'Disconnect' : 'Connect GitHub'}
      </button>
      {error && <div className="error">{error}</div>}
    </>
  );
}

function ApiKeyControls({
  service,
  tail,
  rejected,
}: {
  service: ServiceId;
  tail: string | undefined;
  rejected: boolean;
}) {
  const [value, setValue] = useState('');
  const { pending, error, run } = useAction();
  const saved = tail != null;

  async function save() {
    const ok = await run(() => sendPanelMessage({ type: 'api_key_connect', service, apiKey: value }));
    if (ok) setValue('');
  }

  return (
    <>
      {saved && (
        <div className="row-status">
          <Status tone={rejected ? 'warn' : 'ok'}>{rejected ? 'Key rejected' : `Key ····${tail}`}</Status>
          <button
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => void run(() => sendPanelMessage({ type: 'api_key_disconnect', service }))}
          >
            Remove key
          </button>
        </div>
      )}
      {(!saved || rejected) && (
        <form
          className="key-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim() !== '' && !pending) void save();
          }}
        >
          <input
            className="input"
            type="password"
            value={value}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste API key"
            aria-label={`${SERVICE_LABELS[service]} API key`}
            onChange={(event) => setValue(event.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={pending || value.trim() === ''}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
      {error && <div className="error">{error}</div>}
    </>
  );
}

function SessionControls({ service, connected }: { service: ServiceId; connected: boolean }) {
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

export function ProvidersView({ enabled, connections, githubConnected, apiKeyTails, states }: Props) {
  const groups = [
    { title: 'Plan quota', items: SERVICES.filter((s) => s.auth !== 'api_key') },
    { title: 'API balance', items: SERVICES.filter((s) => s.auth === 'api_key') },
  ];
  return (
    <div className="content">
      {groups.map((group) => (
        <div key={group.title}>
          <div className="section-title">{group.title}</div>
          {group.items.map((service) => {
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
                  {on && service.auth === 'api_key' && (
                    <ApiKeyControls
                      service={service.id}
                      tail={apiKeyTails[service.id]}
                      rejected={states.some(
                        (s) => s.service === service.id && s.honesty === 'api_key_invalid',
                      )}
                    />
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
        </div>
      ))}
      <p className="row-hint" style={{ margin: '12px 2px 0' }}>
        A provider that you turn off is not checked. It does not show in the badge or in alerts. Saved keys
        stay on this device until you remove them.
      </p>
    </div>
  );
}

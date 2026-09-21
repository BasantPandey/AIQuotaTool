import { useState } from 'react';
import type { PanelMessage, QuotaState, ServiceId } from '@ai-quota-tool/core';
import { SERVICES, SERVICE_LABELS, SERVICE_URLS } from '@ai-quota-tool/core';

interface AccountsSectionProps {
  connections: Record<ServiceId, boolean>;
  githubConnected: boolean;
  /** Last 4 characters of a stored API key, keyed by service. Absent when no key is saved. */
  apiKeyTails: Partial<Record<ServiceId, string>>;
  states: QuotaState[];
}

const SERVICE_HINTS: Record<ServiceId, string> = {
  claude: 'Sign in at claude.ai - quota flows automatically',
  codex: 'Sign in at chatgpt.com - quota flows automatically',
  grok: 'Sign in at grok.com - live session only, no keys stored',
  copilot: 'GitHub sign-in - seat status only (GitHub exposes no remaining %)',
  deepseek: 'API key from platform.deepseek.com - balance only, stored on this device',
};

function sendPanelMessage(
  message: PanelMessage,
): Promise<{ ok: boolean; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

function CopilotRow({ githubConnected }: { githubConnected: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function act(type: 'github_connect' | 'github_disconnect') {
    setPending(true);
    setError(undefined);
    try {
      const res = await sendPanelMessage({ type });
      if (!res.ok) setError(res.error ?? 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={rowStyle}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{SERVICE_LABELS.copilot}</div>
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
          {SERVICE_HINTS.copilot}
        </div>
        {error && (
          <div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>{error}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: githubConnected ? '#3fb950' : '#8b949e', fontSize: 12 }}>
          {githubConnected ? '● Connected' : '○ Not connected'}
        </span>
        <button
          disabled={pending}
          onClick={() => act(githubConnected ? 'github_disconnect' : 'github_connect')}
          style={buttonStyle}
        >
          {pending ? '…' : githubConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

function SessionServiceRow({
  serviceId,
  connected,
}: {
  serviceId: ServiceId;
  connected: boolean;
}) {
  return (
    <div style={rowStyle}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{SERVICE_LABELS[serviceId]}</div>
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
          {SERVICE_HINTS[serviceId]}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {connected ? (
          <span style={{ color: '#3fb950', fontSize: 12 }}>● Connected</span>
        ) : (
          <>
            <span style={{ color: '#8b949e', fontSize: 12 }}>○ Not connected</span>
            <a
              href={`https://${SERVICE_URLS[serviceId]}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#58a6ff', fontSize: 11, textDecoration: 'none' }}
            >
              Open ↗
            </a>
          </>
        )}
      </div>
    </div>
  );
}

function ApiKeyRow({
  serviceId,
  tail,
  rejected,
}: {
  serviceId: ServiceId;
  tail: string | undefined;
  rejected: boolean;
}) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const saved = tail != null;

  async function connect() {
    setPending(true);
    setError(undefined);
    try {
      const res = await sendPanelMessage({
        type: 'api_key_connect',
        service: serviceId,
        apiKey: value,
      });
      if (!res.ok) setError(res.error ?? 'Something went wrong');
      else setValue('');
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    setPending(true);
    setError(undefined);
    try {
      const res = await sendPanelMessage({ type: 'api_key_disconnect', service: serviceId });
      if (!res.ok) setError(res.error ?? 'Something went wrong');
    } finally {
      setPending(false);
    }
  }

  const status = !saved
    ? '○ Not connected'
    : rejected
      ? '● Key rejected'
      : `● Connected ····${tail}`;

  return (
    <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{SERVICE_LABELS[serviceId]}</div>
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
          {SERVICE_HINTS[serviceId]}
        </div>
        {(!saved || rejected) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              type="password"
              value={value}
              spellCheck={false}
              autoComplete="off"
              placeholder="sk-..."
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && value.trim() !== '' && !pending) void connect();
              }}
              style={inputStyle}
            />
            <button
              disabled={pending || value.trim() === ''}
              onClick={() => void connect()}
              style={buttonStyle}
            >
              {pending ? '…' : 'Save'}
            </button>
          </div>
        )}
        {error && (
          <div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>{error}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
        <span style={{ color: saved && !rejected ? '#3fb950' : rejected ? '#f85149' : '#8b949e', fontSize: 12 }}>
          {status}
        </span>
        {saved && (
          <button disabled={pending} onClick={() => void disconnect()} style={buttonStyle}>
            {pending ? '…' : 'Disconnect'}
          </button>
        )}
      </div>
    </div>
  );
}

export function AccountsSection({
  connections,
  githubConnected,
  apiKeyTails,
  states,
}: AccountsSectionProps) {
  return (
    <div style={{ padding: '4px 14px 16px' }}>
      <div style={{ fontSize: 11, color: '#8b949e', margin: '8px 0' }}>Accounts</div>
      {SERVICES.map((service) => {
        if (service.auth === 'oauth') {
          return <CopilotRow key={service.id} githubConnected={githubConnected} />;
        }
        if (service.auth === 'api_key') {
          const reading = states.find((state) => state.service === service.id);
          return (
            <ApiKeyRow
              key={service.id}
              serviceId={service.id}
              tail={apiKeyTails[service.id]}
              rejected={reading?.honesty === 'api_key_invalid'}
            />
          );
        }
        return (
          <SessionServiceRow
            key={service.id}
            serviceId={service.id}
            connected={connections[service.id]}
          />
        );
      })}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid #21262d',
};

const buttonStyle: React.CSSProperties = {
  background: '#21262d',
  color: '#e6edf3',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: '#0d1117',
  color: '#e6edf3',
  border: '1px solid #30363d',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
};

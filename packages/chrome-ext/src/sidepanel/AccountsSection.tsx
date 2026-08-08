import { useState } from 'react';
import type { PanelMessage, ServiceId } from '@ai-quota-tool/core';
import { SERVICE_LABELS, SERVICE_URLS } from '@ai-quota-tool/core';

interface AccountsSectionProps {
  connections: Record<ServiceId, boolean>;
  githubConnected: boolean;
}

const SESSION_SERVICES: ServiceId[] = ['claude', 'codex', 'grok'];

const SERVICE_HINTS: Record<ServiceId, string> = {
  claude: 'Sign in at claude.ai - quota flows automatically',
  codex: 'Sign in at chatgpt.com - quota flows automatically',
  grok: 'Sign in at grok.com - live session only, no keys stored',
  copilot: 'GitHub sign-in - seat status only (GitHub exposes no remaining %)',
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

export function AccountsSection({
  connections,
  githubConnected,
}: AccountsSectionProps) {
  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid #21262d' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Accounts</div>
      {SESSION_SERVICES.map((id) => (
        <SessionServiceRow key={id} serviceId={id} connected={connections[id]} />
      ))}
      <CopilotRow githubConnected={githubConnected} />
      <p style={{ fontSize: 11, color: '#8b949e', marginTop: 12, lineHeight: 1.5 }}>
        Claude, Codex, and Grok read your live browser session - to disconnect them,
        sign out on their sites. Copilot disconnect removes the stored GitHub token.
      </p>
    </div>
  );
}

import type { QuotaState } from '@ai-quota-tool/core';
import { SERVICE_LABELS, SERVICE_URLS } from '@ai-quota-tool/core';

const SERVICES = ['claude', 'copilot', 'codex', 'grok'] as const;
type ServiceId = (typeof SERVICES)[number];

interface SettingsTabProps {
  states: QuotaState[];
}

function isConnectedReading(state: QuotaState): boolean {
  if (state.honesty === 'not_connected' || state.honesty === 'auth_unavailable') {
    return false;
  }
  if (state.honesty === 'browser_session_required') return false;
  return (
    state.sessionPct != null ||
    state.weeklyPct != null ||
    state.honesty === 'usage_unknown' ||
    state.honesty === 'seat_active_usage_unknown' ||
    state.honesty === 'no_plan'
  );
}

function ServiceRow({ serviceId, states }: { serviceId: ServiceId; states: QuotaState[] }) {
  const connected = states.some((s) => s.service === serviceId && isConnectedReading(s));
  const url = SERVICE_URLS[serviceId];
  const label = SERVICE_LABELS[serviceId];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid #21262d',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
          {serviceId === 'copilot'
            ? 'Sign in at github.com — seat status only (no remaining % yet)'
            : serviceId === 'grok'
              ? 'Sign in at grok.com — live session only; no keys stored'
              : url}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {connected ? (
          <span style={{ color: '#3fb950', fontSize: 12 }}>● Connected</span>
        ) : (
          <>
            <span style={{ color: '#8b949e', fontSize: 12 }}>○ Not connected</span>
            <a
              href={`https://${url}`}
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

export function SettingsTab({ states }: SettingsTabProps) {
  return (
    <div style={{ padding: '12px 14px' }}>
      <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 14, lineHeight: 1.5 }}>
        Sign in to each service in Chrome — quota data flows automatically.
        Copilot shows seat status only; remaining usage % is not available from GitHub.
        Grok uses your live <strong>grok.com</strong> session only (no stored keys).
      </p>
      <p
        style={{
          fontSize: 11,
          color: '#8b949e',
          marginBottom: 14,
          lineHeight: 1.5,
          padding: '10px 12px',
          border: '1px solid #3d3d00',
          borderRadius: 4,
          background: 'rgba(184,149,0,0.08)',
        }}
      >
        <strong>Privacy:</strong> This extension uses your <em>logged-in browser sessions</em> (cookies)
        only to read your own AI quota (Claude, Codex, Copilot seat, Grok on grok.com). It does{' '}
        <strong>not</strong> store session keys as secrets. Local storage holds quota readings for the
        popup. Optional push to VS Code uses <code style={{ fontSize: 10 }}>ws://127.0.0.1</code> on
        this machine only (any local process could spoof that channel).
      </p>
      {SERVICES.map((id) => (
        <ServiceRow key={id} serviceId={id} states={states} />
      ))}
      <p style={{ fontSize: 11, color: '#8b949e', marginTop: 14, lineHeight: 1.5 }}>
        For VS Code standalone mode, open the Command Palette and run{' '}
        <strong>AI Quota Tool: Set Up Accounts</strong>. VS Code stores Claude/Codex session cookies in
        SecretStorage when you paste them — treat them like passwords. VS Code does{' '}
        <strong>not</strong> store Grok secrets; Grok comes from this extension via WebSocket or shows
        an honest “use Chrome on grok.com” state.
      </p>
    </div>
  );
}

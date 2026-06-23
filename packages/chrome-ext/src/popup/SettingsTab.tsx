import type { QuotaState } from '@ai-quota-tool/core';
import { SERVICE_LABELS, SERVICE_URLS } from '@ai-quota-tool/core';

const SERVICES = ['claude', 'copilot', 'codex'] as const;
type ServiceId = (typeof SERVICES)[number];

interface SettingsTabProps {
  states: QuotaState[];
}

function ServiceRow({ serviceId, states }: { serviceId: ServiceId; states: QuotaState[] }) {
  const connected = states.some((s) => s.service === serviceId);
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
            ? 'Sign in via VS Code AI Quota extension'
            : url}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {connected ? (
          <span style={{ color: '#3fb950', fontSize: 12 }}>● Connected</span>
        ) : (
          <>
            <span style={{ color: '#8b949e', fontSize: 12 }}>○ Not connected</span>
            {serviceId !== 'copilot' && (
              <a
                href={`https://${url}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#58a6ff', fontSize: 11, textDecoration: 'none' }}
              >
                Open ↗
              </a>
            )}
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
        GitHub Copilot is connected via the VS Code extension.
      </p>
      {SERVICES.map((id) => (
        <ServiceRow key={id} serviceId={id} states={states} />
      ))}
      <p style={{ fontSize: 11, color: '#8b949e', marginTop: 14, lineHeight: 1.5 }}>
        For VS Code standalone mode, open the Command Palette and run{' '}
        <strong>AI Quota Tool: Set Up Accounts</strong>.
      </p>
    </div>
  );
}

import type React from 'react';
import type { ServiceId } from '@ai-quota-tool/core';
import { SERVICE_COLORS, SERVICE_LABELS, SERVICE_URLS } from '@ai-quota-tool/core';
import { ClaudeLogo, CopilotLogo, CodexLogo } from './logos.js';

const LOGOS: Record<ServiceId, React.ReactNode> = {
  claude: <ClaudeLogo size={20} />,
  copilot: <CopilotLogo size={20} />,
  codex: <CodexLogo size={20} />,
};

interface Props {
  service: ServiceId;
}

export function QuotaPendingCard({ service }: Props) {
  return (
    <div
      style={{
        background: SERVICE_COLORS[service],
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        opacity: 0.55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {LOGOS[service]}
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{SERVICE_LABELS[service]}</span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>No data yet</span>
      </div>

      <div style={{ textAlign: 'center', padding: '10px 0', color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
        Open{' '}
        <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{SERVICE_URLS[service]}</span>
        {' '}to load quota
      </div>
    </div>
  );
}

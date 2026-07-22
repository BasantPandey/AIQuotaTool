import type React from 'react';
import type { ServiceId } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';
import { ClaudeLogo, CopilotLogo, CodexLogo, GrokLogo } from './logos.js';

const LOGOS: Record<ServiceId, React.ReactNode> = {
  claude: <ClaudeLogo size={20} />,
  copilot: <CopilotLogo size={20} />,
  codex: <CodexLogo size={20} />,
  grok: <GrokLogo size={20} />,
};

interface Props {
  service: ServiceId;
  lastUpdated: number;
}

export function ServiceHeader({ service, lastUpdated }: Props) {
  const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);
  const freshness = secondsAgo < 90 ? 'just now' : `${Math.floor(secondsAgo / 60)}m ago`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {LOGOS[service]}
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{SERVICE_LABELS[service]}</span>
      </div>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Updated {freshness}</span>
    </div>
  );
}

import type React from 'react';
import type { ServiceId } from '@ai-quota-tool/core';
import { SERVICE_COLORS, SERVICE_LABELS } from '@ai-quota-tool/core';
import { ClaudeLogo, CopilotLogo, CodexLogo, GrokLogo } from './logos.js';

const LOGOS: Record<ServiceId, React.ReactNode> = {
  claude: <ClaudeLogo size={20} />,
  copilot: <CopilotLogo size={20} />,
  codex: <CodexLogo size={20} />,
  grok: <GrokLogo size={20} />,
};

/** Dual-mode friendly hints (VS Code setup and/or browser session). */
const PENDING_HINTS: Record<ServiceId, string> = {
  claude: 'Set up a Claude session key, or open claude.ai while signed in',
  copilot: 'Sign in to GitHub for seat status (remaining % often unavailable)',
  codex: 'Set up a ChatGPT session token, or open chatgpt.com while signed in',
  grok: 'Open grok.com in Chrome with the extension — VS Code does not store Grok secrets',
};

const REAUTH_HINTS: Partial<Record<ServiceId, string>> = {
  claude: 'Session invalid or expired — open Set Up Accounts to replace or clear the key',
  codex: 'Session invalid or expired — open Set Up Accounts to replace or clear the token',
};

interface Props {
  service: ServiceId;
  /** Saved session failed auth; secret may still be stored. */
  needsReauth?: boolean;
}

export function QuotaPendingCard({ service, needsReauth = false }: Props) {
  const reauth = needsReauth && REAUTH_HINTS[service] != null;
  return (
    <div
      style={{
        background: SERVICE_COLORS[service],
        borderRadius: 14,
        padding: '16px 18px',
        marginBottom: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        opacity: reauth ? 0.85 : 0.55,
        outline: reauth ? '1px solid rgba(227, 179, 65, 0.55)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {LOGOS[service]}
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{SERVICE_LABELS[service]}</span>
        </div>
        <span style={{ fontSize: 10, color: reauth ? 'rgba(227, 179, 65, 0.95)' : 'rgba(255,255,255,0.4)' }}>
          {reauth ? 'Session expired' : 'No data yet'}
        </span>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '10px 0',
          color: reauth ? 'rgba(255,230,160,0.9)' : 'rgba(255,255,255,0.55)',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {reauth ? REAUTH_HINTS[service] : PENDING_HINTS[service]}
      </div>
    </div>
  );
}

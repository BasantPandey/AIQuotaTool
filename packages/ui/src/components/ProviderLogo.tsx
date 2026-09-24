import type React from 'react';
import type { ServiceId } from '@ai-quota-tool/core';
import { SERVICE_COLORS } from '@ai-quota-tool/core';
import {
  ClaudeLogo,
  CodexLogo,
  CopilotLogo,
  CursorLogo,
  DeepSeekLogo,
  GrokLogo,
  KimiLogo,
} from './logos.js';

const MARKS: Record<ServiceId, (props: { size?: number }) => React.ReactNode> = {
  claude: ClaudeLogo,
  copilot: CopilotLogo,
  codex: CodexLogo,
  grok: GrokLogo,
  cursor: CursorLogo,
  deepseek: DeepSeekLogo,
  kimi: KimiLogo,
};

/** Tile colors where the catalog card color clashes with the mark. */
const TILE_OVERRIDES: Partial<Record<ServiceId, string>> = {
  copilot: '#1d1830',
};

/** Brand mark on a brand-color tile, so white marks read in light and dark themes. */
export function ProviderLogo({ service, size = 32 }: { service: ServiceId; size?: number }) {
  const Mark = MARKS[service];
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: size * 0.28,
        background: TILE_OVERRIDES[service] ?? SERVICE_COLORS[service],
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      <Mark size={Math.round(size * 0.58)} />
    </span>
  );
}

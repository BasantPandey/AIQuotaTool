import type { PanelMessage, ServiceId } from '@ai-quota-tool/core';

export const SERVICE_HINTS: Record<ServiceId, string> = {
  claude: 'Sign in at claude.ai in this browser. Your quota shows here within a minute.',
  codex: 'Sign in at chatgpt.com in this browser. Your Codex quota shows here within a minute.',
  copilot: 'Connect GitHub to check your Copilot plan. GitHub does not share a remaining %.',
  grok: 'Sign in at grok.com in this browser. Your quota shows here within a minute.',
  gemini: 'Sign in at gemini.google.com in this browser. Your quota shows here within a minute.',
  cursor: 'Sign in at cursor.com in this browser. Your monthly usage shows here within a minute.',
  deepseek: 'Add an API key from platform.deepseek.com to see your balance.',
  kimi: 'Add an API key from platform.kimi.ai to see your balance.',
};

export function sendPanelMessage(message: PanelMessage): Promise<{ ok: boolean; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="aq-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d7dff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#12152a" />
      <rect x="13" y="17" width="38" height="7" rx="3.5" fill="url(#aq-mark)" />
      <rect x="13" y="29" width="27" height="7" rx="3.5" fill="url(#aq-mark)" />
      <rect x="13" y="41" width="14" height="7" rx="3.5" fill="#f2b33d" />
    </svg>
  );
}

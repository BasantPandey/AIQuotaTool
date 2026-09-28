/// <reference types="vite/client" />
// Dev preview with mock data. Query: ?host=chrome|vscode&theme=dark|light&width=380
// Chrome follows the OS color scheme. Emulate it in DevTools to see light mode.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { SERVICE_IDS } from '@ai-quota-tool/core';
import { LowestLimit, ProviderCard, QuotaLoadingFallback } from './index.js';
import './styles.css';

const H = 60 * 60 * 1000;
const now = Date.now();

const MOCK_STATES: QuotaState[] = [
  {
    service: 'claude',
    sessionPct: 100,
    weeklyPct: 3,
    sessionResetsAt: now + 4.5 * H,
    weeklyResetsAt: now + 4.5 * H,
    subcategories: [
      { name: 'Sonnet', usedPct: 97, label: '3% left' },
      { name: 'Designs', usedPct: 60, label: '40% left' },
      { name: 'Daily Routines', usedPct: 10, label: '90% left' },
    ],
    lastUpdated: now - 30_000,
  },
  { service: 'codex', sessionPct: 70, weeklyPct: 8, sessionResetsAt: now + 1.7 * H, weeklyResetsAt: now + 22 * H, lastUpdated: now - 45_000 },
  { service: 'copilot', honesty: 'seat_active_usage_unknown', lastUpdated: now - 15_000 },
  { service: 'grok', sessionPct: 55, weeklyPct: 84, sessionResetsAt: now + 1.8 * H, weeklyResetsAt: now + 84 * H, lastUpdated: now - 20 * 60_000 },
  { service: 'cursor', monthlyPct: 41, monthlyResetsAt: now + 12 * 24 * H, lastUpdated: now - 3 * H },
  {
    service: 'deepseek',
    balance: { available: true, infos: [{ currency: 'USD', total: '12.40', granted: '2.40', toppedUp: '10.00' }] },
    lastUpdated: now - 60_000,
  },
  { service: 'kimi', honesty: 'api_key_invalid', lastUpdated: now - 60_000 },
];

const VSCODE_THEMES: Record<string, Record<string, string>> = {
  dark: {
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", sans-serif',
    'font-size': '13px',
    'editor-font-family': 'Consolas, "Courier New", monospace',
    'editor-background': '#1f1f1f',
    'sideBar-background': '#181818',
    'foreground': '#cccccc',
    'descriptionForeground': '#9d9d9d',
    'disabledForeground': '#cccccc80',
    'widget-border': '#313131',
    'input-background': '#313131',
    'button-background': '#0078d4',
    'button-foreground': '#ffffff',
    'button-hoverBackground': '#026ec1',
    'button-secondaryBackground': '#313131',
    'button-secondaryForeground': '#cccccc',
    'button-secondaryHoverBackground': '#3c3c3c',
    'focusBorder': '#0078d4',
    'charts-green': '#89d185',
    'charts-yellow': '#cca700',
    'charts-red': '#f14c4c',
    'charts-blue': '#3794ff',
    'textLink-foreground': '#4daafc',
  },
  light: {
    'font-family': '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", sans-serif',
    'font-size': '13px',
    'editor-font-family': 'Consolas, "Courier New", monospace',
    'editor-background': '#ffffff',
    'sideBar-background': '#f8f8f8',
    'foreground': '#3b3b3b',
    'descriptionForeground': '#3b3b3b',
    'disabledForeground': '#61616180',
    'widget-border': '#e5e5e5',
    'input-background': '#ffffff',
    'button-background': '#005fb8',
    'button-foreground': '#ffffff',
    'button-hoverBackground': '#0258a8',
    'button-secondaryBackground': '#e5e5e5',
    'button-secondaryForeground': '#3b3b3b',
    'button-secondaryHoverBackground': '#cccccc',
    'focusBorder': '#005fb8',
    'charts-green': '#388a34',
    'charts-yellow': '#bf8803',
    'charts-red': '#e51400',
    'charts-blue': '#1a85ff',
    'textLink-foreground': '#005fb8',
  },
};

const params = new URLSearchParams(location.search);
const host = params.get('host') ?? 'chrome';
const theme = params.get('theme') ?? 'dark';
const width = params.get('width');

if (host === 'vscode') {
  await import('./vscode.css');
  document.body.classList.add(`vscode-${theme}`);
  for (const [name, value] of Object.entries(VSCODE_THEMES[theme] ?? {})) {
    document.documentElement.style.setProperty(`--vscode-${name}`, value);
  }
}

const stateOf = (id: ServiceId) => MOCK_STATES.find((s) => s.service === id);

function Preview() {
  if (params.has('loading')) return <QuotaLoadingFallback />;
  return (
    <main className="page" style={width ? { maxWidth: Number(width), margin: 0 } : undefined}>
      <LowestLimit states={MOCK_STATES} />
      <div className="cards">
        {SERVICE_IDS.map((id) => {
          const state = stateOf(id);
          return (
            <ProviderCard
              key={id}
              service={id}
              {...(state != null ? { state } : {})}
              hint="Sign in on the website in this browser. Your quota shows here within a minute."
              action={<button className="btn btn-primary">Connect</button>}
            />
          );
        })}
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);

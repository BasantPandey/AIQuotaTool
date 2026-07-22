import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { QuotaState } from '@ai-quota-tool/core';
import { QuotaDashboard } from './QuotaDashboard.js';

const MOCK_STATES: QuotaState[] = [
  {
    service: 'claude',
    sessionPct: 100,
    weeklyPct: 3,
    sessionResetsAt: Date.now() + 4 * 60 * 60 * 1000 + 32 * 60 * 1000,
    weeklyResetsAt: Date.now() + 4 * 60 * 60 * 1000 + 32 * 60 * 1000,
    subcategories: [
      { name: 'Sonnet', usedPct: 97, label: '3% left' },
      { name: 'Designs', usedPct: 60, label: '40% left' },
      { name: 'Daily Routines', usedPct: 10, label: '90% left' },
    ],
    lastUpdated: Date.now() - 30_000,
  },
  {
    service: 'codex',
    sessionPct: 70,
    weeklyPct: 24,
    sessionResetsAt: Date.now() + 1 * 60 * 60 * 1000 + 43 * 60 * 1000,
    weeklyResetsAt: Date.now() + 22 * 60 * 60 * 1000,
    lastUpdated: Date.now() - 45_000,
  },
  {
    service: 'copilot',
    honesty: 'seat_active_usage_unknown',
    lastUpdated: Date.now() - 15_000,
  },
  {
    service: 'grok',
    weeklyPct: 62,
    weeklyResetsAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
    lastUpdated: Date.now() - 20_000,
  },
];

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <div style={{ background: '#0d1117', minHeight: '100vh', padding: 8, fontFamily: 'system-ui, sans-serif' }}>
      <QuotaDashboard states={MOCK_STATES} />
    </div>
  </StrictMode>,
);

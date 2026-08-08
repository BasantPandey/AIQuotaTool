// PROTOTYPE - throwaway. Question: what should the V2 side panel look like?
// Three variants of the side panel dashboard, switchable via ?variant= on the
// ui dev preview route (pnpm --filter @ai-quota-tool/ui dev, localhost:5173).
// Ticket: #33. Winner gets rewritten properly in chrome-ext; losers stay here.
import { useEffect, useState } from 'react';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import {
  SERVICE_COLORS,
  SERVICE_LABELS,
  formatTimeRemaining,
  lowestPressureAmong,
  pctToColor,
  pressureRemaining,
} from '@ai-quota-tool/core';
import { QuotaDashboard } from './QuotaDashboard.js';
import { ProgressRing } from './components/ProgressRing.js';

// ---------------------------------------------------------------------------
// Shared mock shell pieces (small bits only - variants own their layout)
// ---------------------------------------------------------------------------

const PANEL_WIDTH = 360;

const text = {
  dim: { color: '#8b949e' } as const,
  main: { color: '#e6edf3' } as const,
};

function honestyLabel(state: QuotaState): string {
  switch (state.honesty) {
    case 'seat_active_usage_unknown':
      return 'Seat active - usage % unknown';
    case 'no_plan':
      return 'No active plan';
    case 'auth_unavailable':
      return 'Sign in needed';
    case 'usage_unknown':
      return 'Usage % unknown';
    case 'not_connected':
      return 'Not signed in';
    case 'browser_session_required':
      return 'Browser session needed';
    default:
      return 'No data';
  }
}

function resetLabel(state: QuotaState): string {
  const resets: number[] = [];
  if (state.sessionResetsAt != null) resets.push(state.sessionResetsAt);
  if (state.weeklyResetsAt != null) resets.push(state.weeklyResetsAt);
  if (resets.length === 0) return '';
  const soonest = Math.min(...resets);
  return `resets in ${formatTimeRemaining(soonest - Date.now())}`;
}

function AccountsMock({ style }: { style: 'list' | 'chips' | 'footer' }) {
  const services: ServiceId[] = ['claude', 'copilot', 'codex', 'grok'];
  if (style === 'chips') {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 12px' }}>
        {services.map((s) => (
          <span
            key={s}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 999,
              border: '1px solid #30363d',
              ...text.dim,
            }}
          >
            {SERVICE_LABELS[s]}
          </span>
        ))}
        <span style={{ fontSize: 11, padding: '3px 10px', color: '#58a6ff' }}>
          Manage accounts
        </span>
      </div>
    );
  }
  if (style === 'footer') {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #21262d',
          fontSize: 11,
          display: 'flex',
          justifyContent: 'space-between',
          ...text.dim,
        }}
      >
        <span>3 of 4 services connected</span>
        <span style={{ color: '#58a6ff' }}>Accounts</span>
      </div>
    );
  }
  return (
    <div style={{ padding: '10px 12px', borderTop: '1px solid #21262d' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, ...text.main }}>
        Accounts
      </div>
      {services.map((s) => (
        <div
          key={s}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            padding: '5px 0',
            ...text.dim,
          }}
        >
          <span>{SERVICE_LABELS[s]}</span>
          <span style={{ color: s === 'copilot' ? '#8b949e' : '#3fb950' }}>
            {s === 'copilot' ? '○ Connect' : '● Connected'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant A - "Card grid" (the shipped baseline): QuotaDashboard + accounts list
// ---------------------------------------------------------------------------

export function VariantA({ states }: { states: QuotaState[] }) {
  return (
    <div style={{ width: PANEL_WIDTH }}>
      <QuotaDashboard states={states} />
      <AccountsMock style="list" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant B - "Dense rows": one compact line per service, bars not rings,
// accounts as connection chips. Optimized for a narrow always-open panel.
// ---------------------------------------------------------------------------

function DenseRow({ state }: { state: QuotaState }) {
  const pressure = pressureRemaining(state);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderBottom: '1px solid #21262d',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          background: SERVICE_COLORS[state.service],
          border: '1px solid #30363d',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={text.main}>{SERVICE_LABELS[state.service]}</span>
          <span style={pressure != null ? { color: pctToColor(pressure) } : text.dim}>
            {pressure != null ? `${Math.round(pressure)}%` : honestyLabel(state)}
          </span>
        </div>
        {pressure != null && (
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: '#21262d',
              marginTop: 5,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pressure}%`,
                height: '100%',
                background: pctToColor(pressure),
              }}
            />
          </div>
        )}
        <div style={{ fontSize: 10, marginTop: 3, ...text.dim }}>{resetLabel(state)}</div>
      </div>
    </div>
  );
}

export function VariantB({ states }: { states: QuotaState[] }) {
  return (
    <div style={{ width: PANEL_WIDTH }}>
      <div
        style={{
          padding: '10px 12px',
          fontSize: 11,
          borderBottom: '1px solid #21262d',
          ...text.dim,
        }}
      >
        AI QUOTA
      </div>
      {states.map((s) => (
        <DenseRow key={s.service} state={s} />
      ))}
      <AccountsMock style="chips" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant C - "Attention hero": the lowest-quota service dominates the top;
// everything else is a quiet list. Accounts collapse to a footer line.
// ---------------------------------------------------------------------------

export function VariantC({ states }: { states: QuotaState[] }) {
  const withPressure = states
    .map((s) => ({ s, p: pressureRemaining(s) }))
    .filter((x): x is { s: QuotaState; p: number } => x.p != null);
  const lowest = lowestPressureAmong(states);
  const hero = withPressure.find((x) => x.p === lowest)?.s ?? states[0];
  const rest = states.filter((s) => s !== hero);

  if (!hero) return null;
  const heroPct = pressureRemaining(hero);

  return (
    <div style={{ width: PANEL_WIDTH }}>
      <div
        style={{
          padding: '18px 12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderBottom: '1px solid #21262d',
        }}
      >
        {heroPct != null && <ProgressRing pct={heroPct} size={72} />}
        <div>
          <div style={{ fontSize: 11, ...text.dim }}>LOWEST REMAINING</div>
          <div style={{ fontSize: 16, fontWeight: 600, ...text.main }}>
            {SERVICE_LABELS[hero.service]}
          </div>
          <div style={{ fontSize: 11, ...text.dim }}>{resetLabel(hero)}</div>
        </div>
      </div>
      {rest.map((s) => {
        const p = pressureRemaining(s);
        return (
          <div
            key={s.service}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              fontSize: 12,
              borderBottom: '1px solid #161b22',
            }}
          >
            <span style={text.dim}>{SERVICE_LABELS[s.service]}</span>
            <span style={p != null ? { color: pctToColor(p) } : text.dim}>
              {p != null ? `${Math.round(p)}%` : honestyLabel(s)}
            </span>
          </div>
        );
      })}
      <AccountsMock style="footer" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switcher + host
// ---------------------------------------------------------------------------

const VARIANTS = [
  { key: 'A', name: 'Card grid (baseline)', Component: VariantA },
  { key: 'B', name: 'Dense rows', Component: VariantB },
  { key: 'C', name: 'Attention hero', Component: VariantC },
] as const;

function readVariant(): string {
  return new URLSearchParams(window.location.search).get('variant') ?? 'A';
}

function PrototypeSwitcher({ current }: { current: string }) {
  const [, force] = useState(0);
  const active = VARIANTS.find((v) => v.key === current) ?? VARIANTS[0]!;
  const index = VARIANTS.indexOf(active);

  const go = (next: number) => {
    const wrapped = (next + VARIANTS.length) % VARIANTS.length;
    const params = new URLSearchParams(window.location.search);
    params.set('variant', VARIANTS[wrapped]!.key);
    window.history.replaceState(null, '', `?${params.toString()}`);
    force((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'ArrowRight') go(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: '#1c2128',
        border: '1px solid #444c56',
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 12,
        color: '#adbac7',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 9999,
      }}
    >
      <button onClick={() => go(index - 1)} style={arrowStyle}>
        ◀
      </button>
      <span>
        {active.key} - {active.name}
      </span>
      <button onClick={() => go(index + 1)} style={arrowStyle}>
        ▶
      </button>
    </div>
  );
}

const arrowStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#58a6ff',
  cursor: 'pointer',
  fontSize: 12,
};

export function SidePanelPrototype({ states }: { states: QuotaState[] }) {
  const variant = readVariant();
  const active = VARIANTS.find((v) => v.key === variant) ?? VARIANTS[0];
  return (
    <div
      style={{
        background: '#0d1117',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 12,
      }}
    >
      <div style={{ border: '1px solid #21262d', height: 'fit-content' }}>
        <active.Component states={states} />
      </div>
      <PrototypeSwitcher current={active.key} />
    </div>
  );
}

// PROTOTYPE - throwaway. Answers wayfinder ticket #90 "Accounts and Keys screen".
// Three variants of the VS Code set-up screen plus dashboard, switched with ?variant=A|B|C.
// Open: pnpm --filter @ai-quota-tool/ui dev, then /?host=vscode&screen=accounts-keys&variant=A
import { useEffect, useState } from 'react';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { ProviderCard, ProviderLogo, UsageBar } from './index.js';

const H = 3_600_000;
const now = Date.now();

type AccountStatus = 'connected' | 'expired' | 'none';
interface Account {
  id: string;
  label: string;
  service?: ServiceId;
  how: 'browser' | 'github';
  status: AccountStatus;
  who?: string;
  state?: QuotaState;
}

type KeyReading =
  | { kind: 'balance'; amount: string; scope: 'account balance' }
  | { kind: 'limit'; spent: number; limit: number; resetsAt?: number }
  | { kind: 'spend'; spent: number; budget?: number; scope: 'this month' | 'org spend' };
interface ApiKey {
  id: string;
  provider: string;
  service?: ServiceId;
  name: string;
  last4: string;
  admin?: boolean;
  reading: KeyReading;
}

const ACCOUNTS: Account[] = [
  {
    id: 'claude', label: 'Claude', service: 'claude', how: 'browser', status: 'connected', who: 'Max plan',
    state: { service: 'claude', sessionPct: 62, weeklyPct: 31, sessionResetsAt: now + 2.1 * H, weeklyResetsAt: now + 70 * H, lastUpdated: now - 40_000 },
  },
  {
    id: 'codex', label: 'ChatGPT / Codex', service: 'codex', how: 'browser', status: 'connected', who: 'Plus plan',
    state: { service: 'codex', sessionPct: 88, weeklyPct: 7, sessionResetsAt: now + 1.2 * H, weeklyResetsAt: now + 30 * H, lastUpdated: now - 70_000 },
  },
  {
    id: 'copilot', label: 'Copilot', service: 'copilot', how: 'github', status: 'connected', who: 'Pro',
    state: { service: 'copilot', monthlyPct: 54, monthlyResetsAt: now + 9 * 24 * H, lastUpdated: now - 4 * 60_000 },
  },
  { id: 'grok', label: 'Grok', service: 'grok', how: 'browser', status: 'expired' },
  { id: 'gemini', label: 'Gemini', service: 'gemini', how: 'browser', status: 'none' },
  { id: 'cursor', label: 'Cursor', service: 'cursor', how: 'browser', status: 'none' },
  { id: 'perplexity', label: 'Perplexity', how: 'browser', status: 'none' },
  { id: 'windsurf', label: 'Windsurf', how: 'browser', status: 'none' },
];

const INITIAL_KEYS: ApiKey[] = [
  { id: 'k1', provider: 'OpenRouter', name: 'Side project', last4: '9f2c', reading: { kind: 'limit', spent: 3.2, limit: 10, resetsAt: now + 11 * 24 * H } },
  { id: 'k2', provider: 'OpenRouter', name: 'Agents', last4: 'a01b', reading: { kind: 'spend', spent: 18.75, scope: 'this month' } },
  { id: 'k3', provider: 'DeepSeek', service: 'deepseek', name: 'DeepSeek key 1', last4: '77de', reading: { kind: 'balance', amount: '$12.40', scope: 'account balance' } },
  { id: 'k4', provider: 'Anthropic', name: 'Work org', last4: 'x3k9', admin: true, reading: { kind: 'spend', spent: 42.1, budget: 100, scope: 'org spend' } },
  { id: 'k5', provider: 'Kimi', service: 'kimi', name: 'Kimi key 1', last4: '0c4e', reading: { kind: 'balance', amount: '$0.00', scope: 'account balance' } },
];

const KEY_PROVIDERS = ['OpenRouter', 'DeepSeek', 'Kimi', 'Anthropic (Admin key)', 'OpenAI (Admin key)', 'xAI (Admin key)', 'Mistral (Admin key)'];

const money = (n: number) => `$${n.toFixed(2)}`;

function Logo({ service, label, size = 24 }: { service?: ServiceId | undefined; label: string; size?: number }) {
  if (service) return <ProviderLogo service={service} size={size} />;
  return (
    <span className="pa-letter" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {label.slice(0, 1)}
    </span>
  );
}

function StatusText({ a }: { a: Account }) {
  if (a.status === 'connected') return <span className="pill"><span className="dot ok" />Connected{a.who ? ` - ${a.who}` : ''}</span>;
  if (a.status === 'expired') return <span className="pill"><span className="dot warn" />Session ended</span>;
  return <span className="pill"><span className="dot" />Not signed in</span>;
}

function AccountAction({ a }: { a: Account }) {
  if (a.status === 'connected') return <button className="btn btn-ghost">Sign out</button>;
  const text = a.how === 'github' ? 'Sign in with GitHub' : a.status === 'expired' ? 'Sign in again' : 'Sign in';
  return <button className="btn btn-primary">{text}</button>;
}

function KeyHeadline({ r }: { r: KeyReading }) {
  if (r.kind === 'balance') {
    return (
      <div className="balance">
        <div className={r.amount === '$0.00' ? 'balance-total num zero' : 'balance-total num'}>{r.amount}</div>
        <div className="balance-sub">{r.scope}</div>
      </div>
    );
  }
  if (r.kind === 'limit') {
    const pct = Math.round(100 * (1 - r.spent / r.limit));
    return <UsageBar label={`${money(r.spent)} of ${money(r.limit)} key limit`} pct={pct} resetsAt={r.resetsAt} />;
  }
  if (r.budget != null) {
    const pct = Math.max(0, Math.round(100 * (1 - r.spent / r.budget)));
    return <UsageBar label={`${money(r.spent)} of ${money(r.budget)} budget - ${r.scope}`} pct={pct} />;
  }
  return (
    <div className="balance">
      <div className="balance-total num">{money(r.spent)}</div>
      <div className="balance-sub">{r.scope} - no budget set</div>
    </div>
  );
}

function KeyCard({ k, onRemove }: { k: ApiKey; onRemove: () => void }) {
  return (
    <section className="card" aria-label={k.name}>
      <header className="card-head">
        <Logo service={k.service} label={k.provider} size={30} />
        <span className="card-title">
          {k.name}
          <span className="pa-sub">{k.provider} - ends {k.last4}{k.admin ? ' - Admin key' : ''}</span>
        </span>
        <button className="btn btn-ghost btn-icon" title="Edit name and budget">✎</button>
        <button className="btn btn-ghost btn-icon" title="Remove key" onClick={onRemove}>✕</button>
      </header>
      <KeyHeadline r={k.reading} />
    </section>
  );
}

function AddKeyForm({ onAdd, onCancel }: { onAdd: (k: ApiKey) => void; onCancel: () => void }) {
  const [provider, setProvider] = useState(KEY_PROVIDERS[0]!);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [adminOk, setAdminOk] = useState(false);
  const isAdmin = provider.includes('Admin');
  const canSave = secret.length > 4 && (!isAdmin || adminOk);
  return (
    <section className="card pa-form">
      <div className="pa-form-title">Add a key</div>
      <label>Provider
        <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
          {KEY_PROVIDERS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <label>Name
        <input className="input" placeholder={`${provider.split(' ')[0]} key 1`} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>API key
        <input className="input" type="password" placeholder="Paste the key" value={secret} onChange={(e) => setSecret(e.target.value)} />
      </label>
      {isAdmin && (
        <label className="pa-check">
          <input type="checkbox" checked={adminOk} onChange={(e) => setAdminOk(e.target.checked)} />
          This is an Admin key. It can manage your whole org.
        </label>
      )}
      <div className="pa-row">
        <button
          className="btn btn-primary"
          disabled={!canSave}
          onClick={() =>
            onAdd({
              id: `k${Math.random()}`,
              provider: provider.split(' ')[0]!,
              name: name || `${provider.split(' ')[0]} key 1`,
              last4: secret.slice(-4),
              admin: isAdmin,
              reading: { kind: 'spend', spent: 0, scope: isAdmin ? 'org spend' : 'this month' },
            })
          }
        >
          Test and save
        </button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      <p className="card-note">The extension makes one free call to test the key. It saves the key only if the call works.</p>
    </section>
  );
}

function useKeys() {
  const [keys, setKeys] = useState(INITIAL_KEYS);
  const [adding, setAdding] = useState(false);
  return {
    keys,
    adding,
    startAdd: () => setAdding(true),
    cancelAdd: () => setAdding(false),
    add: (k: ApiKey) => { setKeys([...keys, k]); setAdding(false); },
    remove: (id: string) => setKeys(keys.filter((k) => k.id !== id)),
  };
}

// ── Variant A: one page, two stacked sections ───────────────────────────────
function VariantA() {
  const k = useKeys();
  return (
    <main className="page">
      <div className="page-head"><h1>AI Quota</h1><button className="btn btn-ghost">Refresh</button></div>
      <h2 className="pa-h2">Accounts <span>Plan limits. Sign in on the real site.</span></h2>
      <div className="cards">
        {ACCOUNTS.filter((a) => a.state).map((a) => <ProviderCard key={a.id} service={a.service!} state={a.state!} hint="" />)}
      </div>
      <div className="pa-list">
        {ACCOUNTS.filter((a) => !a.state).map((a) => (
          <div key={a.id} className="pa-list-row">
            <Logo service={a.service} label={a.label} />
            <span className="pa-grow">{a.label}</span>
            <StatusText a={a} />
            <AccountAction a={a} />
          </div>
        ))}
      </div>
      <h2 className="pa-h2">Keys <span>API spend and balance. You add each key.</span>
        <button className="btn btn-primary pa-right" onClick={k.startAdd}>Add key</button>
      </h2>
      {k.adding && <AddKeyForm onAdd={k.add} onCancel={k.cancelAdd} />}
      <div className="cards">
        {k.keys.map((key) => <KeyCard key={key.id} k={key} onRemove={() => k.remove(key.id)} />)}
      </div>
    </main>
  );
}

// ── Variant B: tabs, set-up is a separate screen ────────────────────────────
function VariantB() {
  const k = useKeys();
  const [tab, setTab] = useState<'dash' | 'accounts' | 'keys'>('dash');
  return (
    <main className="page">
      <nav className="pa-tabs">
        {([['dash', 'Usage'], ['accounts', `Accounts (${ACCOUNTS.filter((a) => a.status === 'connected').length})`], ['keys', `Keys (${k.keys.length})`]] as const).map(([id, label]) => (
          <button key={id} className={tab === id ? 'pa-tab on' : 'pa-tab'} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      {tab === 'dash' && (
        <>
          <div className="pa-kicker">Accounts</div>
          <div className="cards">
            {ACCOUNTS.filter((a) => a.state).map((a) => <ProviderCard key={a.id} service={a.service!} state={a.state!} hint="" />)}
          </div>
          <div className="pa-kicker">Keys</div>
          <div className="pa-strip">
            {k.keys.map((key) => (
              <div key={key.id} className="pa-chip">
                <Logo service={key.service} label={key.provider} size={18} />
                <span className="pa-grow">{key.name}</span>
                <span className="num">
                  {key.reading.kind === 'balance' ? key.reading.amount
                    : key.reading.kind === 'limit' ? `${Math.round(100 * (1 - key.reading.spent / key.reading.limit))}% left`
                    : money(key.reading.spent)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'accounts' && (
        <div className="pa-list">
          {ACCOUNTS.map((a) => (
            <div key={a.id} className="pa-list-row">
              <Logo service={a.service} label={a.label} />
              <span className="pa-grow">{a.label}<span className="pa-sub">{a.how === 'github' ? 'VS Code GitHub sign-in' : 'Opens Chrome or Edge'}</span></span>
              <StatusText a={a} />
              <AccountAction a={a} />
            </div>
          ))}
        </div>
      )}
      {tab === 'keys' && (
        <>
          {k.adding ? <AddKeyForm onAdd={k.add} onCancel={k.cancelAdd} /> : <button className="btn btn-primary" onClick={k.startAdd}>Add key</button>}
          <table className="pa-table">
            <thead><tr><th>Name</th><th>Provider</th><th>Key</th><th>Shows</th><th /></tr></thead>
            <tbody>
              {k.keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>{key.provider}{key.admin ? ' (Admin)' : ''}</td>
                  <td className="num">...{key.last4}</td>
                  <td>{key.reading.kind === 'balance' ? 'Account balance' : key.reading.kind === 'limit' ? 'Spend vs key limit' : key.reading.budget ? 'Spend vs budget' : 'Spend only'}</td>
                  <td><button className="btn btn-ghost btn-icon">✎</button><button className="btn btn-ghost btn-icon" onClick={() => k.remove(key.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

// ── Variant C: one group per provider, Account and Keys together ───────────
function VariantC() {
  const k = useKeys();
  const providers = [...new Set([...ACCOUNTS.map((a) => a.label), ...k.keys.map((key) => key.provider)])];
  return (
    <main className="page">
      <div className="page-head"><h1>AI Quota</h1><button className="btn btn-primary" onClick={k.startAdd}>Add key</button></div>
      {k.adding && <AddKeyForm onAdd={k.add} onCancel={k.cancelAdd} />}
      <div className="pa-groups">
        {providers.map((p) => {
          const a = ACCOUNTS.find((x) => x.label === p);
          const keys = k.keys.filter((key) => key.provider === p || (p === 'Claude' && key.provider === 'Anthropic'));
          if (p === 'Anthropic') return null;
          return (
            <section key={p} className="pa-group">
              <header className="pa-group-head">
                <Logo service={a?.service ?? keys[0]?.service} label={p} size={26} />
                <span className="pa-grow">{p}</span>
                {a && <StatusText a={a} />}
                {a && !a.state && <AccountAction a={a} />}
              </header>
              {a?.state && (
                <div className="pa-slot">
                  <div className="pa-slot-tag">Account</div>
                  <UsageBar label={a.state.sessionPct != null ? 'Session' : 'Monthly'} pct={a.state.sessionPct ?? a.state.monthlyPct ?? 0} resetsAt={a.state.sessionResetsAt ?? a.state.monthlyResetsAt} compact />
                  {a.state.weeklyPct != null && <UsageBar label="Weekly" pct={a.state.weeklyPct} resetsAt={a.state.weeklyResetsAt} compact />}
                </div>
              )}
              {keys.map((key) => (
                <div key={key.id} className="pa-slot">
                  <div className="pa-slot-tag">Key - {key.name} - ...{key.last4}{key.admin ? ' - Admin' : ''}</div>
                  <KeyHeadline r={key.reading} />
                </div>
              ))}
              {!a && keys.length === 0 && <p className="card-note">No account or key.</p>}
            </section>
          );
        })}
      </div>
    </main>
  );
}

const VARIANTS = {
  A: { name: 'Two sections on one page', C: VariantA },
  B: { name: 'Tabs: Usage, Accounts, Keys', C: VariantB },
  C: { name: 'One group per provider', C: VariantC },
} as const;
type Key = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as Key[];

function Switcher({ current, onChange }: { current: Key; onChange: (v: Key) => void }) {
  const step = (d: number) => onChange(KEYS[(KEYS.indexOf(current) + d + KEYS.length) % KEYS.length]!);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="pa-switcher">
      <button onClick={() => step(-1)}>←</button>
      <span>{current} - {VARIANTS[current].name}</span>
      <button onClick={() => step(1)}>→</button>
    </div>
  );
}

export function AccountsKeysPrototype() {
  const initial = new URLSearchParams(location.search).get('variant')?.toUpperCase();
  const [variant, setVariant] = useState<Key>(KEYS.includes(initial as Key) ? (initial as Key) : 'A');
  const change = (v: Key) => {
    const url = new URL(location.href);
    url.searchParams.set('variant', v);
    history.replaceState(null, '', url);
    setVariant(v);
  };
  const View = VARIANTS[variant].C;
  return (
    <>
      <style>{CSS}</style>
      <View key={variant} />
      {import.meta.env.DEV && <Switcher current={variant} onChange={change} />}
    </>
  );
}

const CSS = `
.pa-h2 { display: flex; align-items: baseline; gap: 10px; margin: 22px 0 10px; font-size: 13px; font-weight: 650; }
.pa-h2 span { font-size: 11.5px; font-weight: 400; color: var(--aq-muted); }
.pa-right { margin-left: auto; }
.pa-sub { display: block; font-size: 11px; font-weight: 400; color: var(--aq-muted); }
.pa-grow { flex: 1; min-width: 0; }
.pa-letter { display: inline-grid; place-items: center; border-radius: 7px; background: var(--aq-surface-raised); color: var(--aq-text); font-weight: 700; flex-shrink: 0; }
.pa-list { margin-top: 10px; border: 1px solid var(--aq-border); border-radius: 10px; overflow: hidden; }
.pa-list-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--aq-surface); }
.pa-list-row + .pa-list-row { border-top: 1px solid var(--aq-border); }
.pa-form { display: grid; gap: 8px; margin-bottom: 12px; max-width: 460px; }
.pa-form-title { font-weight: 650; }
.pa-form label { display: grid; gap: 3px; font-size: 11.5px; color: var(--aq-muted); }
.pa-form .pa-check { display: flex; gap: 6px; align-items: center; color: var(--aq-low); }
.pa-form .input, .pa-form select { height: 28px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--aq-border); background: var(--aq-surface-raised); color: var(--aq-text); font: inherit; }
.pa-row { display: flex; gap: 8px; }
.pa-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--aq-border); margin-bottom: 14px; }
.pa-tab { background: none; border: 0; border-bottom: 2px solid transparent; color: var(--aq-muted); padding: 8px 12px; font: inherit; cursor: pointer; }
.pa-tab.on { color: var(--aq-text); border-bottom-color: var(--aq-accent); }
.pa-kicker { margin: 16px 0 8px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--aq-faint); }
.pa-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
.pa-chip { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--aq-border); border-radius: 8px; background: var(--aq-surface); font-size: 12px; }
.pa-table { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: 12px; }
.pa-table th { text-align: left; font-weight: 550; color: var(--aq-muted); padding: 6px 8px; border-bottom: 1px solid var(--aq-border); }
.pa-table td { padding: 6px 8px; border-bottom: 1px solid var(--aq-border); }
.pa-groups { display: grid; align-items: start; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.pa-group { border: 1px solid var(--aq-border); border-radius: 12px; background: var(--aq-surface); padding: 12px; }
.pa-group-head { display: flex; align-items: center; gap: 10px; font-weight: 650; }
.pa-slot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--aq-border); }
.pa-slot-tag { font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--aq-faint); }
.pa-switcher { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 99px; background: #ff3d7f; color: #fff; font: 600 12px system-ui; box-shadow: 0 6px 24px rgba(0,0,0,.4); z-index: 99; }
.pa-switcher button { background: rgba(255,255,255,.2); border: 0; color: #fff; border-radius: 99px; width: 26px; height: 26px; cursor: pointer; }
`;

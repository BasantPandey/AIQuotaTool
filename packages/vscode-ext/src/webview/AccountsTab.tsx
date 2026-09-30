import { useState } from 'react';
import { SERVICE_LABELS } from '@ai-quota-tool/core';
import { ProviderLogo } from '@ai-quota-tool/ui';
import type { AccountRow, AccountService, FormStatus } from './protocol.js';
import { send, useForm } from './store.js';

type PasteService = Exclude<AccountService, 'copilot'>;

const METHOD: Record<AccountService, string> = {
  claude: 'Paste the claude.ai session cookie',
  copilot: 'VS Code GitHub sign-in',
  codex: 'Paste the chatgpt.com session cookie',
  grok: 'Paste the grok.com session cookie',
};

function StatusPill({ row }: { row: AccountRow }) {
  if (row.status === 'connected') {
    return (
      <span className="pill">
        <span className="dot ok" />
        {row.detail ?? 'Connected'}
      </span>
    );
  }
  if (row.status === 'ended') {
    return (
      <span className="pill">
        <span className="dot warn" />
        Session ended
      </span>
    );
  }
  return (
    <span className="pill">
      <span className="dot" />
      Not signed in
    </span>
  );
}

function FormNote({ form }: { form: FormStatus }) {
  if (form.status === 'testing') return <p className="form-note">Testing…</p>;
  if (form.status === 'error') return <p className="form-note error" role="alert">{form.detail}</p>;
  return null;
}

function OpenSite({ host }: { host: string }) {
  return (
    <button className="btn" onClick={() => send({ type: 'open_external', url: `https://${host}` })}>
      Open {host}
    </button>
  );
}

function PasteForm({ service, onClose }: { service: PasteService; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [second, setSecond] = useState('');
  const [form, setForm] = useForm(service);
  const testing = form.status === 'testing';
  const save = () => {
    const joined = service === 'codex' && second.trim() ? `${value.trim()}\n${second.trim()}` : value.trim();
    setForm({ target: service, status: 'testing' });
    send({ type: 'account_save', service, value: joined });
  };

  return (
    <div className="row-form">
      {service === 'claude' && (
        <ol className="steps">
          <li>Open <strong>claude.ai</strong> in your browser and sign in.</li>
          <li>Press <code>F12</code>. Open <strong>Application</strong>, then <strong>Cookies</strong>, then <code>https://claude.ai</code>.</li>
          <li>Copy the value of <code>sessionKey</code>. It starts with <code>sk-ant-sid</code>.</li>
        </ol>
      )}
      {service === 'grok' && (
        <ol className="steps">
          <li>Open <strong>grok.com</strong> in your browser and sign in.</li>
          <li>Press <code>F12</code>. Open <strong>Application</strong>, then <strong>Cookies</strong>, then <code>https://grok.com</code>.</li>
          <li>Copy the value of <code>sso</code>. It often starts with <code>eyJ</code>.</li>
        </ol>
      )}
      {service === 'codex' && (
        <ol className="steps">
          <li>Open <strong>chatgpt.com</strong> in your browser and sign in.</li>
          <li>Press <code>F12</code>. Open <strong>Application</strong>, then <strong>Cookies</strong>, then <code>https://chatgpt.com</code>.</li>
          <li>Double-click the value of <code>__Secure-next-auth.session-token.0</code> to select all of it. Paste it in line 1.</li>
          <li>Do the same for <code>__Secure-next-auth.session-token.1</code>. Paste it in line 2.</li>
        </ol>
      )}
      {service === 'codex' && (
        <p className="form-help">
          Is there only one cookie, with no <code>.0</code> or <code>.1</code>? Paste it in line 1 and keep line 2 empty.
          You can also paste the full <strong>Cookie</strong> request header in line 1.
        </p>
      )}

      {service === 'codex' ? (
        <>
          <label className="field">
            <span>
              Line 1 - <code>.0</code> value, or the full Cookie header
            </span>
            <textarea className="input mono" rows={2} spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label className="field">
            <span>
              Line 2 - <code>.1</code> value (keep empty if there is only one cookie)
            </span>
            <textarea className="input mono" rows={2} spellCheck={false} value={second} onChange={(e) => setSecond(e.target.value)} />
          </label>
        </>
      ) : (
        <label className="field">
          {service === 'claude' ? 'Session key' : 'sso cookie'}
          <input
            className="input mono"
            type="password"
            placeholder={service === 'claude' ? 'sk-ant-sid02-…' : 'eyJ…'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" disabled={!value.trim() || testing} onClick={save}>
          Test and save
        </button>
        <OpenSite host={service === 'codex' ? 'chatgpt.com' : service === 'claude' ? 'claude.ai' : 'grok.com'} />
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
      <FormNote form={form} />
      <p className="form-help">Treat this value like a password. It stays in VS Code SecretStorage on this computer.</p>
    </div>
  );
}

function AccountItem({ row, open, onOpen }: { row: AccountRow; open: boolean; onOpen: (open: boolean) => void }) {
  const [form, setForm] = useForm(row.service);
  const label = SERVICE_LABELS[row.service];

  let action;
  if (row.status === 'connected') {
    action = (
      <button className="btn btn-ghost" onClick={() => send({ type: 'account_sign_out', service: row.service })}>
        Sign out
      </button>
    );
  } else if (row.service === 'copilot') {
    action = (
      <button
        className="btn btn-primary"
        disabled={form.status === 'testing'}
        onClick={() => {
          setForm({ target: 'copilot', status: 'testing' });
          send({ type: 'github_sign_in' });
        }}
      >
        {row.status === 'ended' ? 'Sign in again' : 'Sign in with GitHub'}
      </button>
    );
  } else if (!open) {
    action = (
      <button className="btn btn-primary" aria-expanded={false} onClick={() => onOpen(true)}>
        {row.status === 'ended' ? 'Sign in again' : 'Sign in'}
      </button>
    );
  }

  return (
    <li className="list-item">
      <div className="list-row">
        <ProviderLogo service={row.service} size={26} />
        <span className="grow">
          {label}
          <span className="sub">{METHOD[row.service]}</span>
        </span>
        <StatusPill row={row} />
        {action}
      </div>
      {row.service !== 'copilot' && open && row.status !== 'connected' && (
        <PasteForm service={row.service} onClose={() => onOpen(false)} />
      )}
      {row.service === 'copilot' && form.status === 'error' && (
        <div className="row-form">
          <FormNote form={form} />
        </div>
      )}
    </li>
  );
}

export function AccountsTab({ accounts }: { accounts: AccountRow[] }) {
  const [open, setOpen] = useState<AccountService | null>(null);
  return (
    <>
      <p className="tab-intro">
        An Account is a plan on the provider website, for example Claude Max. It shows plan limits. The extension keeps
        each secret only in VS Code SecretStorage on this computer. It sends the secret only to the same provider, to
        read your usage.
      </p>
      <ul className="list">
        {accounts.map((row) => (
          <AccountItem
            key={row.service}
            row={row}
            open={open === row.service}
            onOpen={(next) => setOpen(next ? row.service : null)}
          />
        ))}
      </ul>
    </>
  );
}

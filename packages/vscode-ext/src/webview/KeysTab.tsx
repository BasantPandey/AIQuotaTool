import { useEffect, useState } from 'react';
import type { ServiceId } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';
import { ProviderLogo } from '@ai-quota-tool/ui';
import type { KeyRow } from './protocol.js';
import { send, useForm } from './store.js';

const KEY_PROVIDERS: readonly ServiceId[] = ['deepseek', 'kimi'];

function AddKeyForm({ onClose }: { onClose: () => void }) {
  const [service, setService] = useState<ServiceId>(KEY_PROVIDERS[0]!);
  const [value, setValue] = useState('');
  const [form, setForm] = useForm('add_key');
  const testing = form.status === 'testing';

  // Close the form when the host confirms the save.
  useEffect(() => {
    if (form.status !== 'ok') return;
    setForm({ target: 'add_key', status: 'idle' });
    onClose();
  }, [form.status]);

  return (
    <section className="card key-form" aria-label="Add a key">
      <div className="form-title">Add a key</div>
      <label className="field">
        Provider
        <select className="input" value={service} onChange={(e) => setService(e.target.value as ServiceId)}>
          {KEY_PROVIDERS.map((id) => (
            <option key={id} value={id}>
              {SERVICE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        API key
        <input
          className="input"
          type="password"
          placeholder="Paste the key"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <button
          className="btn btn-primary"
          disabled={!value.trim() || testing}
          onClick={() => {
            setForm({ target: 'add_key', status: 'testing' });
            send({ type: 'key_add', service, value: value.trim() });
          }}
        >
          Test and save
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
      {form.status === 'testing' && <p className="form-note">Testing…</p>}
      {form.status === 'error' && (
        <p className="form-note error" role="alert">
          {form.detail}
        </p>
      )}
      <p className="form-help">The extension makes one free call to test the key. It saves the key only if the call works.</p>
    </section>
  );
}

export function KeysTab({ keys }: { keys: KeyRow[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <p className="tab-intro">A Key is an API key that you add. It shows the balance or the spend of that key.</p>
      {adding ? (
        <AddKeyForm onClose={() => setAdding(false)} />
      ) : (
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          Add key
        </button>
      )}
      {keys.length === 0 ? (
        <p className="tab-empty">No keys yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Key</th>
              <th>Shows</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {keys.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>
                  <span className="cell-provider">
                    <ProviderLogo service={row.service} size={18} />
                    {SERVICE_LABELS[row.service]}
                  </span>
                </td>
                <td className="num">…{row.last4}</td>
                <td>Account balance</td>
                <td className="cell-actions">
                  <button
                    className="btn btn-ghost"
                    aria-label={`Remove ${row.name}`}
                    onClick={() => send({ type: 'key_remove', id: row.id })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

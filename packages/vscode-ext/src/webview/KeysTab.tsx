import type React from 'react';
import { useEffect, useState } from 'react';
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { defaultKeyName, KEY_SERVICES, keyCardType, SERVICE_LABELS } from '@ai-quota-tool/core';
import { ProviderLogo } from '@ai-quota-tool/ui';
import type { FormStatus, KeyRow } from './protocol.js';
import { send, useForm } from './store.js';
import { keyReading, keyView } from './key-view.js';

function FormNote({ form }: { form: FormStatus }) {
  if (form.status === 'testing') return <p className="form-note">Testing…</p>;
  if (form.status === 'error') {
    return (
      <p className="form-note error" role="alert">
        {form.detail}
      </p>
    );
  }
  return null;
}

/** Closes a form when the host confirms the save. */
function useCloseOnOk(target: string, onClose: () => void): FormStatus {
  const [form, setForm] = useForm(target);
  useEffect(() => {
    if (form.status !== 'ok') return;
    setForm({ target, status: 'idle' });
    onClose();
  }, [form.status]);
  return form;
}

function AddKeyForm({ keys, onClose }: { keys: KeyRow[]; onClose: () => void }) {
  const [service, setService] = useState<ServiceId>(KEY_SERVICES[0]!);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [, setForm] = useForm('add_key');
  const form = useCloseOnOk('add_key', onClose);
  const placeholder = defaultKeyName(
    SERVICE_LABELS[service],
    keys.filter((k) => k.service === service).map((k) => k.name),
  );

  return (
    <section className="card key-form" aria-label="Add a key">
      <div className="form-title">Add a key</div>
      <label className="field">
        Provider
        <select className="input" value={service} onChange={(e) => setService(e.target.value as ServiceId)}>
          {KEY_SERVICES.map((id) => (
            <option key={id} value={id}>
              {SERVICE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Name
        <input className="input" placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        API key
        <input
          className="input mono"
          type="password"
          placeholder="Paste the key"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="form-actions">
        <button
          className="btn btn-primary"
          disabled={!value.trim() || form.status === 'testing'}
          onClick={() => {
            setForm({ target: 'add_key', status: 'testing' });
            send({ type: 'key_add', service, name: name.trim(), value: value.trim() });
          }}
        >
          Test and save
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
      <FormNote form={form} />
      <p className="form-help">
        The extension makes one free call to test the key. It saves the key only if the call works. After that, it
        shows only the last 4 characters.
      </p>
    </section>
  );
}

function KeyTableRow({ row, reading }: { row: KeyRow; reading: QuotaState | undefined }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [budget, setBudget] = useState(row.budget != null ? String(row.budget) : '');
  const target = `edit:${row.id}`;
  const form = useCloseOnOk(target, () => setEditing(false));
  const [, setForm] = useForm(target);
  // Only a Spend only Key has a budget. A cap or a balance already gives a real number.
  const canBudget = reading != null && keyCardType(reading) === 'spend';
  const currency = reading?.spend?.currency ?? 'USD';
  const save = () =>
    send({ type: 'key_update', id: row.id, name: name.trim(), budget: canBudget && budget.trim() ? Number(budget) : null });
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <tr>
      <td>
        {editing ? (
          <>
            <input
              className="input"
              aria-label="Key name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={keys}
            />
            <FormNote form={form} />
          </>
        ) : (
          row.name
        )}
      </td>
      <td>
        <span className="cell-provider">
          <ProviderLogo service={row.service} size={18} />
          {SERVICE_LABELS[row.service]}
        </span>
      </td>
      <td className="num">…{row.last4}</td>
      <td>
        {editing && canBudget ? (
          <label className="field field-inline">
            Monthly budget ({currency})
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="No budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              onKeyDown={keys}
            />
          </label>
        ) : (
          keyView(reading).shows
        )}
      </td>
      <td className="cell-actions">
        {editing ? (
          <>
            <button className="btn btn-primary" disabled={!name.trim()} onClick={save}>
              Save
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-ghost"
              aria-label={`Edit ${row.name}`}
              title={canBudget ? 'Change the name or the budget' : 'Change the name'}
              onClick={() => {
                setName(row.name);
                setBudget(row.budget != null ? String(row.budget) : '');
                setForm({ target, status: 'idle' });
                setEditing(true);
              }}
            >
              Edit
            </button>
            <button
              className="btn btn-ghost"
              aria-label={`Remove ${row.name}`}
              onClick={() => send({ type: 'key_remove', id: row.id })}
            >
              Remove
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export function KeysTab({ keys, readings }: { keys: KeyRow[]; readings: QuotaState[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <p className="tab-intro">
        A Key is an API key that you add and name. It shows the balance or the spend of that key. You can add many
        Keys for one provider.
      </p>
      {adding ? (
        <AddKeyForm keys={keys} onClose={() => setAdding(false)} />
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
              <KeyTableRow key={row.id} row={row} reading={keyReading(readings, row.id)} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

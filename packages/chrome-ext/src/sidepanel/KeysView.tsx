import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ChromeServiceId, KeyRecord, QuotaState } from '@ai-quota-tool/core';
import {
  CHROME_SERVICES,
  connectionIdOf,
  connectionKindOf,
  defaultKeyName,
  isAdminKeyService,
  needsTeamId,
  SERVICE_LABELS,
  SERVICE_URLS,
} from '@ai-quota-tool/core';
import { KeyGroupCard, type KeyItem, ProviderLogo } from '@ai-quota-tool/ui';
import { KEY_ORIGINS } from '../background/api-keys.js';
import { SERVICE_HINTS, sendPanelMessage, useAction } from './shared.js';

const KEY_PROVIDERS = CHROME_SERVICES.filter((service) => service.auth === 'api_key');

/** What each provider's key shows, so the user can pick the right one. */
const KEY_SHOWS: Partial<Record<ChromeServiceId, string>> = {
  deepseek: 'Account balance',
  kimi: 'Account balance',
  anthropic: 'Org spend this month · Admin key',
  openai: 'Org spend this month · Admin key',
  xai: 'Prepaid credit · Management key',
  'cursor-team': 'Team spend · Admin key',
  'copilot-premium': 'Premium requests this month',
};

/** The short caption of a provider card, for example "Account balance". */
export function keyCaption(service: ChromeServiceId): string {
  return (KEY_SHOWS[service] ?? '').split(' · ')[0]!;
}

/** Keys grouped by provider, in catalog order. The panel and the dashboard use the same groups. */
export function groupKeys(keys: KeyRecord[], states: QuotaState[]): { service: ChromeServiceId; items: KeyItem[] }[] {
  return KEY_PROVIDERS.flatMap((service) => {
    const items = keys
      .filter((key) => key.service === service.id)
      .map((key): KeyItem => {
        const state = keyReading(states, key.id);
        return { id: key.id, name: key.name, last4: key.last4, ...(state != null ? { state } : {}) };
      });
    return items.length > 0 ? [{ service: service.id, items }] : [];
  });
}

export function keyReading(states: QuotaState[], id: string): QuotaState | undefined {
  return states.find((s) => connectionIdOf(s) === id && connectionKindOf(s) === 'key');
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}
const CHEVRON = 'M6 9l6 6 6-6';
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const TRASH = 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3';
const PENCIL = 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4';
const EYE = 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EYE_OFF = 'M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2';
export const PLUS = 'M12 5v14M5 12h14';

/** A select-only combobox with provider logos. Keyboard: arrows, Home, End, Enter, Space, Escape. */
function ProviderPicker({ value, onChange, labelId }: { value: ChromeServiceId; onChange: (id: ChromeServiceId) => void; labelId: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = KEY_PROVIDERS.find((service) => service.id === value)!;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function show() {
    setActive(Math.max(0, KEY_PROVIDERS.findIndex((service) => service.id === value)));
    setOpen(true);
  }
  function pick(index: number) {
    onChange(KEY_PROVIDERS[index]!.id);
    setOpen(false);
    box.current?.focus();
  }
  function onKeyDown(event: React.KeyboardEvent) {
    const last = KEY_PROVIDERS.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    const moves: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(last, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => setOpen(false),
    };
    if (event.key === 'Tab') return setOpen(false);
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      move();
    }
  }

  return (
    <div className="picker" ref={root}>
      <div
        ref={box}
        className="picker-button"
        role="combobox"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        {...(open ? { 'aria-activedescendant': `${listId}-${KEY_PROVIDERS[active]!.id}` } : {})}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <ProviderLogo service={value} size={26} />
        <span className="picker-text">
          <span className="picker-label">{current.label}</span>
          <span className="picker-caption">{KEY_SHOWS[value]}</span>
        </span>
        <span className={open ? 'picker-chevron open' : 'picker-chevron'}>
          <Icon d={CHEVRON} />
        </span>
      </div>
      {open && (
        <ul className="picker-list" role="listbox" id={listId} aria-labelledby={labelId}>
          {KEY_PROVIDERS.map((service, index) => (
            <li
              key={service.id}
              id={`${listId}-${service.id}`}
              role="option"
              aria-selected={service.id === value}
              className={index === active ? 'picker-option active' : 'picker-option'}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
            >
              <ProviderLogo service={service.id} size={24} />
              <span className="picker-text">
                <span className="picker-label">{service.label}</span>
                <span className="picker-caption">{KEY_SHOWS[service.id]}</span>
              </span>
              {service.id === value && (
                <span className="picker-check">
                  <Icon d={CHECK} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The key input, with a button that shows or hides the key. */
function SecretInput({ id, value, placeholder, onChange }: { id: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="secret">
      <input
        id={id}
        className="input num"
        type={visible ? 'text' : 'password'}
        value={value}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="secret-toggle"
        aria-label={visible ? 'Hide key' : 'Show key'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon d={visible ? EYE_OFF : EYE} />
      </button>
    </div>
  );
}

function AddKeyForm({ keys, initial, onClose }: { keys: KeyRecord[]; initial: ChromeServiceId; onClose?: () => void }) {
  const [service, setService] = useState<ChromeServiceId>(initial);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [teamId, setTeamId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const { pending, error, run } = useAction();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const label = SERVICE_LABELS[service];
  const team = needsTeamId(service);
  const admin = isAdminKeyService(service);

  useEffect(() => {
    form.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  const ready = secret.trim() !== '' && (!team || teamId.trim() !== '') && (!admin || confirmed) && !pending;
  const placeholder = defaultKeyName(label, keys.filter((key) => key.service === service).map((key) => key.name));

  function choose(next: ChromeServiceId) {
    setService(next);
    setConfirmed(false);
    setTeamId('');
  }

  function submit() {
    // Chrome asks for site access only inside the click, so the request starts before any await.
    const origin = KEY_ORIGINS[service];
    const access = origin ? chrome.permissions.request({ origins: [origin] }).catch(() => false) : Promise.resolve(true);
    void run(async () => {
      if (!(await access)) return { ok: false, error: `Allow access to ${new URL(origin!).host} to read this key.` };
      return sendPanelMessage({ type: 'api_key_add', service, name, apiKey: secret, ...(team ? { teamId } : {}) });
    }).then((ok) => {
      if (!ok) return;
      setName('');
      setSecret('');
      setTeamId('');
      setConfirmed(false);
      onClose?.();
    });
  }

  return (
    <form
      ref={form}
      className="card key-form"
      aria-label="Add an API key"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit();
      }}
    >
      <div className="key-form-title">Add an API key</div>

      <div className="field">
        <span className="field-label" id={`${id}-provider`}>
          Provider
        </span>
        <ProviderPicker value={service} onChange={choose} labelId={`${id}-provider`} />
        <p className="field-help">
          {SERVICE_HINTS[service]}{' '}
          <a href={`https://${SERVICE_URLS[service]}`} target="_blank" rel="noreferrer">
            Get a key
          </a>
        </p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${id}-name`}>
          Key name
        </label>
        <input
          id={`${id}-name`}
          className="input"
          value={name}
          maxLength={60}
          placeholder={placeholder}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${id}-secret`}>
          {admin ? 'Admin key' : 'API key'}
        </label>
        <SecretInput id={`${id}-secret`} value={secret} placeholder="Paste the key" onChange={setSecret} />
      </div>

      {team && (
        <div className="field">
          <label className="field-label" htmlFor={`${id}-team`}>
            Team ID
          </label>
          <input
            id={`${id}-team`}
            className="input num"
            value={teamId}
            spellCheck={false}
            autoComplete="off"
            placeholder="From console.x.ai team settings"
            onChange={(event) => setTeamId(event.target.value)}
          />
        </div>
      )}

      {admin && (
        <label className="check">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>This key can read and change the whole account. I want to use it here.</span>
        </label>
      )}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <p className="field-help">The extension makes one free call to test the key. The key stays on this device.</p>
      <div className="key-form-actions">
        {onClose && (
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="btn btn-primary" type="submit" disabled={!ready}>
          {pending ? 'Testing key…' : 'Test and save'}
        </button>
      </div>
    </form>
  );
}

/** Edit one saved key in its row: the name, the team ID, or a new key value. */
function EditKeyForm({ apiKey, onClose }: { apiKey: KeyRecord; onClose: () => void }) {
  const [name, setName] = useState(apiKey.name);
  const [teamId, setTeamId] = useState(apiKey.teamId ?? '');
  const [secret, setSecret] = useState('');
  const { pending, error, run } = useAction();
  const id = useId();
  const team = needsTeamId(apiKey.service);
  const tests = secret.trim() !== '' || (team && teamId.trim() !== (apiKey.teamId ?? ''));
  const ready = name.trim() !== '' && (!team || teamId.trim() !== '') && !pending;

  function submit() {
    void run(() =>
      sendPanelMessage({
        type: 'api_key_update',
        id: apiKey.id,
        name,
        ...(secret.trim() ? { apiKey: secret } : {}),
        ...(team ? { teamId } : {}),
      }),
    ).then((ok) => {
      if (ok) onClose();
    });
  }

  return (
    <li className="key-edit">
      <form
        className="key-edit-form"
        aria-label={`Edit ${apiKey.name}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) submit();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="key-edit-head">
          <div className="key-form-title">Edit key</div>
          <span className="key-tail num">····{apiKey.last4}</span>
        </div>

        <div className="field">
          <label className="field-label" htmlFor={`${id}-name`}>
            Key name
          </label>
          <input
            id={`${id}-name`}
            className="input"
            value={name}
            maxLength={60}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {team && (
          <div className="field">
            <label className="field-label" htmlFor={`${id}-team`}>
              Team ID
            </label>
            <input
              id={`${id}-team`}
              className="input num"
              value={teamId}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setTeamId(event.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor={`${id}-secret`}>
            New key (optional)
          </label>
          <SecretInput id={`${id}-secret`} value={secret} placeholder={`Leave empty to keep ····${apiKey.last4}`} onChange={setSecret} />
        </div>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <div className="key-form-actions">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={!ready}>
            {pending ? (tests ? 'Testing key…' : 'Saving…') : tests ? 'Test and save' : 'Save'}
          </button>
        </div>
      </form>
    </li>
  );
}

function RemoveKey({ apiKey }: { apiKey: KeyRecord }) {
  const [sure, setSure] = useState(false);
  const { pending, error, run } = useAction();

  useEffect(() => {
    if (!sure) return;
    const timer = setTimeout(() => setSure(false), 4000);
    return () => clearTimeout(timer);
  }, [sure]);

  if (!sure) {
    return (
      <button className="btn btn-ghost btn-icon key-remove" aria-label={`Remove ${apiKey.name}`} title={error ?? 'Remove'} onClick={() => setSure(true)}>
        <Icon d={TRASH} size={15} />
      </button>
    );
  }
  return (
    <button
      className="btn btn-danger key-remove"
      disabled={pending}
      aria-label={`Confirm remove ${apiKey.name}`}
      onClick={() => void run(() => sendPanelMessage({ type: 'api_key_remove', id: apiKey.id })).then(() => setSure(false))}
    >
      {pending ? 'Removing…' : 'Remove'}
    </button>
  );
}

/** The API keys tab: one card for each provider, and one form to add a key. */
export function KeysView({ keys, states, startAdding }: { keys: KeyRecord[]; states: QuotaState[]; startAdding: boolean }) {
  const first = KEY_PROVIDERS[0]!.id;
  const [adding, setAdding] = useState<ChromeServiceId | null>(startAdding || keys.length === 0 ? first : null);
  const [editing, setEditing] = useState<string | null>(null);
  const byId = new Map(keys.map((key) => [key.id, key]));

  return (
    <div className="content">
      <div className="keys-head">
        <p className="row-hint">Each key shows its balance or spend. You can add many keys for one provider.</p>
        {adding == null && (
          <button className="btn btn-primary" onClick={() => setAdding(first)}>
            <Icon d={PLUS} size={14} /> Add key
          </button>
        )}
      </div>

      {adding != null && (
        <AddKeyForm key={adding} keys={keys} initial={adding} {...(keys.length > 0 ? { onClose: () => setAdding(null) } : {})} />
      )}

      <div className="key-groups">
        {groupKeys(keys, states).map(({ service, items }) => (
          <KeyGroupCard
            key={service}
            service={service}
            caption={keyCaption(service)}
            items={items}
            action={
              <button className="btn btn-ghost key-group-add" aria-label={`Add a ${SERVICE_LABELS[service]} key`} onClick={() => setAdding(service)}>
                <Icon d={PLUS} size={13} /> Add
              </button>
            }
            renderRow={(item) =>
              editing === item.id ? <EditKeyForm key={item.id} apiKey={byId.get(item.id)!} onClose={() => setEditing(null)} /> : undefined
            }
            rowAction={(item) => (
              <span className="key-actions">
                <button className="btn btn-ghost btn-icon key-edit-button" aria-label={`Edit ${item.name}`} title="Edit" onClick={() => setEditing(item.id)}>
                  <Icon d={PENCIL} size={15} />
                </button>
                <RemoveKey apiKey={byId.get(item.id)!} />
              </span>
            )}
          />
        ))}
      </div>
    </div>
  );
}

import type { KeyRecord, ServiceId } from '@ai-quota-tool/core';
import { defaultKeyName, normalizeApiKey, parseKeyRecords, SERVICE_LABELS, serviceById } from '@ai-quota-tool/core';

/** Named keys without secrets. The panel reads this list. Local only: never chrome.storage.sync. */
export const KEY_LIST_STORAGE_KEY = 'apiKeyList';
/** Each secret under its key id. Only the worker reads it. */
const SECRETS_STORAGE_KEY = 'apiKeySecrets';
/** One key for each provider, from 3.2 and before. It moves to named keys on install. */
const LEGACY_STORAGE_KEY = 'apiKeys';

/** API hosts that are optional permissions. The panel asks for one when the user adds a key. */
export const KEY_ORIGINS: Partial<Record<ServiceId, string>> = {
  anthropic: 'https://api.anthropic.com/*',
  openai: 'https://api.openai.com/*',
  xai: 'https://management-api.x.ai/*',
  'cursor-team': 'https://api.cursor.com/*',
};

export interface KeyWithSecret {
  key: KeyRecord;
  secret: string;
}

type Secrets = Record<string, string>;

async function read(): Promise<{ keys: KeyRecord[]; secrets: Secrets }> {
  const stored = await chrome.storage.local.get([KEY_LIST_STORAGE_KEY, SECRETS_STORAGE_KEY]);
  const secrets = stored[SECRETS_STORAGE_KEY];
  return {
    keys: parseKeyRecords(stored[KEY_LIST_STORAGE_KEY]),
    secrets: secrets != null && typeof secrets === 'object' ? (secrets as Secrets) : {},
  };
}

export async function listKeys(): Promise<KeyRecord[]> {
  return (await read()).keys;
}

/** Keys that have a secret. A list row without one is skipped, never polled. */
export async function keysWithSecrets(): Promise<KeyWithSecret[]> {
  const { keys, secrets } = await read();
  return keys.flatMap((key) => (secrets[key.id] ? [{ key, secret: secrets[key.id]! }] : []));
}

/** Check the input before any network call. Returns a clean secret or throws a message for the user. */
export function cleanSecret(service: ServiceId, raw: string): string {
  if (serviceById(service).auth !== 'api_key') throw new Error('This provider does not take an API key.');
  const secret = normalizeApiKey(raw);
  if (!secret) throw new Error('Paste a single-line API key.');
  return secret;
}

/** Stores the secret first, so a list row never points to a missing secret. */
export async function addKey(service: ServiceId, name: string, secret: string, teamId?: string): Promise<KeyRecord> {
  const { keys, secrets } = await read();
  const key: KeyRecord = {
    id: crypto.randomUUID(),
    service,
    name: name.trim() || defaultKeyName(SERVICE_LABELS[service], keys.filter((k) => k.service === service).map((k) => k.name)),
    last4: secret.slice(-4),
    ...(teamId ? { teamId } : {}),
  };
  await chrome.storage.local.set({ [SECRETS_STORAGE_KEY]: { ...secrets, [key.id]: secret } });
  await chrome.storage.local.set({ [KEY_LIST_STORAGE_KEY]: [...keys, key] });
  return key;
}

/** Changes the name, the team ID, or the secret of one key. The id stays, so its reading stays matched. */
export async function updateKey(id: string, change: { name: string; secret?: string; teamId?: string }): Promise<void> {
  const { keys, secrets } = await read();
  if (change.secret) await chrome.storage.local.set({ [SECRETS_STORAGE_KEY]: { ...secrets, [id]: change.secret } });
  await chrome.storage.local.set({
    [KEY_LIST_STORAGE_KEY]: keys.map((key) => {
      if (key.id !== id) return key;
      const { teamId: _old, ...rest } = key;
      const teamId = change.teamId ?? key.teamId;
      return {
        ...rest,
        name: change.name,
        ...(change.secret ? { last4: change.secret.slice(-4) } : {}),
        ...(teamId ? { teamId } : {}),
      };
    }),
  });
}

/** Removes the list row first, so the panel never shows a key that has no secret. */
export async function removeKey(id: string): Promise<void> {
  const { keys, secrets } = await read();
  await chrome.storage.local.set({ [KEY_LIST_STORAGE_KEY]: keys.filter((k) => k.id !== id) });
  const { [id]: _removed, ...rest } = secrets;
  await chrome.storage.local.set({ [SECRETS_STORAGE_KEY]: rest });
}

/** Moves the 3.2 single keys to named keys. Safe to run again: the old map is removed last. */
export async function migrateLegacyKeys(): Promise<void> {
  const stored = await chrome.storage.local.get([LEGACY_STORAGE_KEY]);
  const legacy = stored[LEGACY_STORAGE_KEY];
  if (legacy == null || typeof legacy !== 'object') return;
  const existing = await keysWithSecrets();
  for (const [service, secret] of Object.entries(legacy as Record<string, unknown>)) {
    if (service !== 'deepseek' && service !== 'kimi') continue;
    if (typeof secret !== 'string' || !secret) continue;
    if (existing.some((row) => row.key.service === service && row.secret === secret)) continue;
    await addKey(service, '', secret);
  }
  await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
}

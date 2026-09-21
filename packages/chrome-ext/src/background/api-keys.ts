import type { ServiceId } from '@ai-quota-tool/core';
import { normalizeApiKey, serviceById } from '@ai-quota-tool/core';

/** Local-only map of API keys. Never use chrome.storage.sync. */
export const API_KEYS_STORAGE_KEY = 'apiKeys';

export type StoredApiKeys = Partial<Record<ServiceId, string>>;

async function readAll(): Promise<StoredApiKeys> {
  const stored = await chrome.storage.local.get([API_KEYS_STORAGE_KEY]);
  const value = stored[API_KEYS_STORAGE_KEY];
  if (value == null || typeof value !== 'object') return {};
  return value as StoredApiKeys;
}

export async function readApiKey(service: ServiceId): Promise<string | undefined> {
  const key = (await readAll())[service];
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

export async function saveServiceApiKey(service: ServiceId, raw: string): Promise<void> {
  if (serviceById(service).auth !== 'api_key') {
    throw new Error('This service does not take an API key.');
  }
  const apiKey = normalizeApiKey(raw);
  if (!apiKey) throw new Error('Paste a single-line API key.');
  const existing = await readAll();
  await chrome.storage.local.set({
    [API_KEYS_STORAGE_KEY]: { ...existing, [service]: apiKey },
  });
}

export async function clearServiceApiKey(service: ServiceId): Promise<void> {
  if (serviceById(service).auth !== 'api_key') {
    throw new Error('This service does not take an API key.');
  }
  const existing = await readAll();
  const next = { ...existing };
  delete next[service];
  await chrome.storage.local.set({ [API_KEYS_STORAGE_KEY]: next });
}

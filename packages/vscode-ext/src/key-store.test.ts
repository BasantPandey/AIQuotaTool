import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import { KeyStore } from './key-store.js';

function fakeStorage() {
  const state = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  const memento = {
    get: (key: string) => state.get(key),
    update: async (key: string, value: unknown) => void state.set(key, value),
  } as unknown as vscode.Memento;
  const secretStorage = {
    get: async (key: string) => secrets.get(key),
    store: async (key: string, value: string) => void secrets.set(key, value),
    delete: async (key: string) => void secrets.delete(key),
  } as unknown as vscode.SecretStorage;
  return { state, secrets, store: new KeyStore(memento, secretStorage) };
}

describe('KeyStore', () => {
  it('keeps the value only in secret storage, and the list holds the last 4 characters', async () => {
    const { state, secrets, store } = fakeStorage();
    const key = await store.add('deepseek', 'Work', 'sk-secret-value-1234');
    expect(state.get('aiQuotaTool.keys')).toEqual([{ id: key.id, service: 'deepseek', name: 'Work', last4: '1234' }]);
    expect(JSON.stringify(state.get('aiQuotaTool.keys'))).not.toContain('secret-value');
    expect(secrets.get(`aiQuotaTool.key.${key.id}`)).toBe('sk-secret-value-1234');
  });

  it('renames a Key and keeps its value', async () => {
    const { store } = fakeStorage();
    const key = await store.add('kimi', 'Old', 'sk-kimi-abcd');
    await store.rename(key.id, 'New');
    expect(await store.withSecrets()).toEqual([{ key: { ...key, name: 'New' }, secret: 'sk-kimi-abcd' }]);
  });

  it('removes the list row and the secret', async () => {
    const { secrets, store } = fakeStorage();
    const key = await store.add('kimi', 'Home', 'sk-kimi-abcd');
    await store.remove(key.id);
    expect(store.list()).toEqual([]);
    expect(secrets.size).toBe(0);
  });

  it('moves the 0.9.x secrets to named Keys, and is safe to run again', async () => {
    const { secrets, store } = fakeStorage();
    secrets.set('aiQuotaTool.deepseekApiKey', 'sk-deep-1111');
    secrets.set('aiQuotaTool.kimiApiKey', 'sk-kimi-2222');
    await store.moveLegacy();
    await store.moveLegacy();
    expect(store.list().map((k) => [k.service, k.name, k.last4])).toEqual([
      ['deepseek', 'DeepSeek key 1', '1111'],
      ['kimi', 'Kimi key 1', '2222'],
    ]);
    expect(secrets.has('aiQuotaTool.deepseekApiKey')).toBe(false);
    expect(secrets.has('aiQuotaTool.kimiApiKey')).toBe(false);
  });

  it('does not add a Key twice when a move stopped before the old secret was deleted', async () => {
    const { secrets, store } = fakeStorage();
    await store.add('deepseek', 'DeepSeek key 1', 'sk-deep-1111');
    secrets.set('aiQuotaTool.deepseekApiKey', 'sk-deep-1111');
    await store.moveLegacy();
    expect(store.list()).toHaveLength(1);
    expect(secrets.has('aiQuotaTool.deepseekApiKey')).toBe(false);
  });
});

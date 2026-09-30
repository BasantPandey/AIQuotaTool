import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { CredentialManager } from './credentials.js';

vi.mock('vscode', () => ({}));

function fakeSecrets(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  const secrets = {
    get: async (k: string) => map.get(k),
    store: async (k: string, v: string) => void map.set(k, v),
    delete: async (k: string) => void map.delete(k),
  } as unknown as vscode.SecretStorage;
  return { map, manager: new CredentialManager(secrets) };
}

describe('CredentialManager.moveLegacy', () => {
  it('moves the 0.9.x Claude secret to the new name, and is safe to run again', async () => {
    const { map, manager } = fakeSecrets({ 'aiQuotaTool.claudeSessionKey': 'sk-ant-old' });
    await manager.moveLegacy();
    await manager.moveLegacy();
    expect([...map]).toEqual([['aiQuotaTool.account.claude', 'sk-ant-old']]);
    expect((await manager.get()).claudeSessionKey).toBe('sk-ant-old');
  });

  it('keeps a newer value at the new name', async () => {
    const { map, manager } = fakeSecrets({ 'aiQuotaTool.claudeSessionKey': 'old', 'aiQuotaTool.account.claude': 'new' });
    await manager.moveLegacy();
    expect([...map]).toEqual([['aiQuotaTool.account.claude', 'new']]);
  });
});

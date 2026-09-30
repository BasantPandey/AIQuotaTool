import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import { CredentialManager } from './credentials.js';

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
  it('moves the 0.9.x Claude, Codex, and Grok secrets to the new names, and is safe to run again', async () => {
    const { map, manager } = fakeSecrets({
      'aiQuotaTool.claudeSessionKey': 'sk-ant-old',
      'aiQuotaTool.codexSessionToken': 'part0\npart1',
      'aiQuotaTool.grokSsoCookie': 'eyJ-old',
    });
    await manager.moveLegacy();
    await manager.moveLegacy();
    expect(Object.fromEntries(map)).toEqual({
      'aiQuotaTool.account.claude': 'sk-ant-old',
      'aiQuotaTool.account.codex': 'part0\npart1',
      'aiQuotaTool.account.grok': 'eyJ-old',
    });
    expect(await manager.get()).toEqual({ claude: 'sk-ant-old', codex: 'part0\npart1', grok: 'eyJ-old', gemini: undefined, cursor: undefined });
  });

  it('keeps a newer value at the new name', async () => {
    const { map, manager } = fakeSecrets({ 'aiQuotaTool.claudeSessionKey': 'old', 'aiQuotaTool.account.claude': 'new' });
    await manager.moveLegacy();
    expect([...map]).toEqual([['aiQuotaTool.account.claude', 'new']]);
  });
});

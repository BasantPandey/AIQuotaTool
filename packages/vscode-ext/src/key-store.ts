import { randomUUID } from 'node:crypto';
import type * as vscode from 'vscode';
import { type KeyRecord, parseKeyRecords, type ServiceId } from '@ai-quota-tool/core';

const LIST_KEY = 'aiQuotaTool.keys';
const secretName = (id: string) => `aiQuotaTool.key.${id}`;

/** Single-key secrets from 0.9.x. They move to named Keys on first start. */
const LEGACY_SECRETS: readonly { service: ServiceId; name: string; secret: string }[] = [
  { service: 'deepseek', name: 'DeepSeek key 1', secret: 'aiQuotaTool.deepseekApiKey' },
  { service: 'kimi', name: 'Kimi key 1', secret: 'aiQuotaTool.kimiApiKey' },
];

export interface KeyWithSecret {
  key: KeyRecord;
  secret: string;
}

/** Named Keys: the list (no secrets) in globalState, each value in SecretStorage under its Key id. */
export class KeyStore {
  constructor(
    private readonly state: vscode.Memento,
    private readonly secrets: vscode.SecretStorage,
  ) {}

  list(): KeyRecord[] {
    return parseKeyRecords(this.state.get(LIST_KEY));
  }

  async withSecrets(): Promise<KeyWithSecret[]> {
    const rows = await Promise.all(
      this.list().map(async (key) => ({ key, secret: await this.secrets.get(secretName(key.id)) })),
    );
    return rows.filter((row): row is KeyWithSecret => row.secret != null);
  }

  /** Stores the secret first, so a list row never points to a missing secret. */
  async add(service: ServiceId, name: string, secret: string): Promise<KeyRecord> {
    const key: KeyRecord = { id: randomUUID(), service, name, last4: secret.slice(-4) };
    await this.secrets.store(secretName(key.id), secret);
    await this.state.update(LIST_KEY, [...this.list(), key]);
    return key;
  }

  async rename(id: string, name: string): Promise<void> {
    await this.state.update(
      LIST_KEY,
      this.list().map((k) => (k.id === id ? { ...k, name } : k)),
    );
  }

  async remove(id: string): Promise<void> {
    await this.state.update(
      LIST_KEY,
      this.list().filter((k) => k.id !== id),
    );
    await this.secrets.delete(secretName(id));
  }

  /**
   * Moves the 0.9.x DeepSeek and Kimi secrets to named Keys. Safe to run again:
   * the old secret is deleted last, and a Key with the same value is not added twice.
   */
  async moveLegacy(): Promise<void> {
    for (const legacy of LEGACY_SECRETS) {
      const secret = await this.secrets.get(legacy.secret);
      if (!secret) continue;
      const existing = await this.withSecrets();
      if (!existing.some((row) => row.key.service === legacy.service && row.secret === secret)) {
        await this.add(legacy.service, legacy.name, secret);
      }
      await this.secrets.delete(legacy.secret);
    }
  }
}

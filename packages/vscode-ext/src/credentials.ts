import * as vscode from 'vscode';

const KEY_CLAUDE_COOKIE = 'aiQuotaTool.claudeSessionKey';
const KEY_CODEX_COOKIE = 'aiQuotaTool.codexSessionToken';

export interface Credentials {
  claudeSessionKey: string | undefined;
  codexSessionToken: string | undefined;
}

export class CredentialManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(): Promise<Credentials> {
    const [claudeSessionKey, codexSessionToken] = await Promise.all([
      this.secrets.get(KEY_CLAUDE_COOKIE),
      this.secrets.get(KEY_CODEX_COOKIE),
    ]);
    return { claudeSessionKey, codexSessionToken };
  }

  async hasAny(): Promise<boolean> {
    const creds = await this.get();
    return !!(creds.claudeSessionKey || creds.codexSessionToken);
  }

  async setClaudeKey(key: string): Promise<void> {
    await this.secrets.store(KEY_CLAUDE_COOKIE, key);
  }

  async setCodexToken(token: string): Promise<void> {
    await this.secrets.store(KEY_CODEX_COOKIE, token);
  }
}

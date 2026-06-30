import * as vscode from 'vscode';

const KEY_CLAUDE_API_KEY = 'aiQuotaTool.claudeApiKey';
const KEY_CODEX_COOKIE = 'aiQuotaTool.codexSessionToken';
// ponytail: migrate old session-cookie key on first read, then drop it
const KEY_CLAUDE_LEGACY = 'aiQuotaTool.claudeSessionKey';

export interface Credentials {
  claudeApiKey: string | undefined;
  codexSessionToken: string | undefined;
}

export class CredentialManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(): Promise<Credentials> {
    const [claudeApiKey, codexSessionToken] = await Promise.all([
      this.secrets.get(KEY_CLAUDE_API_KEY),
      this.secrets.get(KEY_CODEX_COOKIE),
    ]);
    // silently drop legacy cookie — it no longer works
    Promise.resolve(this.secrets.delete(KEY_CLAUDE_LEGACY)).catch(() => { /* ignore */ });
    return { claudeApiKey, codexSessionToken };
  }

  async hasAny(): Promise<boolean> {
    const creds = await this.get();
    return !!(creds.claudeApiKey || creds.codexSessionToken);
  }

  async setClaudeApiKey(key: string): Promise<void> {
    await this.secrets.store(KEY_CLAUDE_API_KEY, key);
  }

  async setCodexToken(token: string): Promise<void> {
    await this.secrets.store(KEY_CODEX_COOKIE, token);
  }
}

import * as vscode from 'vscode';

const KEY_CLAUDE_COOKIE = 'aiQuotaTool.claudeSessionKey';
const KEY_CODEX_COOKIE = 'aiQuotaTool.codexSessionToken';
// Accidentally stored Anthropic API keys in 0.5.x — not used for claude.ai usage.
const KEY_CLAUDE_API_LEGACY = 'aiQuotaTool.claudeApiKey';

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
    // Drop the unused API-key secret if present (0.5.x regression leftover).
    Promise.resolve(this.secrets.delete(KEY_CLAUDE_API_LEGACY)).catch(() => {
      /* ignore */
    });
    return { claudeSessionKey, codexSessionToken };
  }

  async hasAny(): Promise<boolean> {
    const creds = await this.get();
    if (creds.claudeSessionKey || creds.codexSessionToken) return true;
    try {
      const session = await vscode.authentication.getSession('github', ['read:user'], {
        createIfNone: false,
      });
      return !!session;
    } catch {
      return false;
    }
  }

  async setClaudeKey(key: string): Promise<void> {
    await this.secrets.store(KEY_CLAUDE_COOKIE, key);
  }

  async setCodexToken(token: string): Promise<void> {
    await this.secrets.store(KEY_CODEX_COOKIE, token);
  }

  async clearClaudeKey(): Promise<void> {
    await this.secrets.delete(KEY_CLAUDE_COOKIE);
  }

  async clearCodexToken(): Promise<void> {
    await this.secrets.delete(KEY_CODEX_COOKIE);
  }
}

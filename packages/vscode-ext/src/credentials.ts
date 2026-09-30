import type * as vscode from 'vscode';

/** Accounts that sign in with a session cookie. Copilot uses the VS Code GitHub sign-in instead. */
export type CookieAccount = 'claude' | 'codex' | 'grok' | 'gemini' | 'cursor';

const secretName = (service: CookieAccount) => `aiQuotaTool.account.${service}`;

/** Old storage names of Account secrets (0.9.x). `moveLegacy` moves them to the new names. */
const LEGACY_ACCOUNT_SECRETS: readonly [CookieAccount, string][] = [
  ['claude', 'aiQuotaTool.claudeSessionKey'],
  ['codex', 'aiQuotaTool.codexSessionToken'],
  ['grok', 'aiQuotaTool.grokSsoCookie'],
];
/** GitHub token from the 0.9.x device flow. Copilot now uses the VS Code GitHub sign-in. */
const KEY_GITHUB_TOKEN_LEGACY = 'aiQuotaTool.githubToken';
// Accidentally stored Anthropic API keys in 0.5.x — not used for claude.ai usage.
const KEY_CLAUDE_API_LEGACY = 'aiQuotaTool.claudeApiKey';

/** Account secrets: one session cookie value for each cookie Account. API keys live in `KeyStore`. */
export type Credentials = Record<CookieAccount, string | undefined>;

const COOKIE_ACCOUNTS: readonly CookieAccount[] = ['claude', 'codex', 'grok', 'gemini', 'cursor'];

export class CredentialManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(): Promise<Credentials> {
    const values = await Promise.all(COOKIE_ACCOUNTS.map((service) => this.secrets.get(secretName(service))));
    // Drop the unused API-key secret if present (0.5.x regression leftover).
    Promise.resolve(this.secrets.delete(KEY_CLAUDE_API_LEGACY)).catch(() => {
      /* ignore */
    });
    return Object.fromEntries(COOKIE_ACCOUNTS.map((service, i) => [service, values[i]])) as Credentials;
  }

  async hasAny(): Promise<boolean> {
    return Object.values(await this.get()).some(Boolean);
  }

  async set(service: CookieAccount, value: string): Promise<void> {
    await this.secrets.store(secretName(service), value);
  }

  async clear(service: CookieAccount): Promise<void> {
    await this.secrets.delete(secretName(service));
  }

  /** Move 0.9.x Account secrets to the new names. A value at the new name wins. Safe to run again. */
  async moveLegacy(): Promise<void> {
    for (const [service, oldName] of LEGACY_ACCOUNT_SECRETS) {
      const old = await this.secrets.get(oldName);
      if (!old) continue;
      if (!(await this.secrets.get(secretName(service)))) await this.secrets.store(secretName(service), old);
      await this.secrets.delete(oldName);
    }
  }

  /** Delete the 0.9.x device-flow token. Safe to run on each start. */
  async deleteLegacyGithubToken(): Promise<void> {
    await this.secrets.delete(KEY_GITHUB_TOKEN_LEGACY);
  }
}

// Account providers with browser sign-in: where to start, which cookies to read, and the stored secret.
import type { CookieTarget } from './browser-signin.js';
import type { AccountService } from './webview/protocol.js';

export interface BrowserProvider {
  startUrl: string;
  target: CookieTarget;
  /** The provider terms, shown before the first sign-in (decision on #99). */
  terms: string;
  /** The stored secret, built from the named cookies. Undefined when a needed cookie is missing. */
  toSecret: (cookies: Record<string, string>) => string | undefined;
}

export const CODEX_COOKIES = [
  '__Secure-next-auth.session-token',
  '__Secure-next-auth.session-token.0',
  '__Secure-next-auth.session-token.1',
] as const;

/** Account providers with browser sign-in. Each value goes only to its own host (spec section 4). */
export const BROWSER_PROVIDERS: Partial<Record<AccountService, BrowserProvider>> = {
  claude: {
    startUrl: 'https://claude.ai/login',
    target: { host: 'claude.ai', names: ['sessionKey'] },
    terms: 'https://www.anthropic.com/legal/consumer-terms',
    toSecret: (c) => c.sessionKey,
  },
  codex: {
    startUrl: 'https://chatgpt.com/auth/login',
    target: { host: 'chatgpt.com', names: CODEX_COOKIES },
    terms: 'https://openai.com/policies/terms-of-use/',
    // A large session is split into .0 and .1. Keep each part under its own name (codexCookieHeader).
    toSecret: (c) => {
      const parts = CODEX_COOKIES.filter((name) => c[name]).map((name) => `${name}=${c[name]}`);
      return parts.length > 0 ? parts.join('; ') : undefined;
    },
  },
  grok: {
    startUrl: 'https://grok.com/sign-in',
    target: { host: 'grok.com', names: ['sso', 'sso-rw'] },
    terms: 'https://x.ai/legal/terms-of-service',
    // The poller sends the same value as sso and sso-rw.
    toSecret: (c) => c.sso ?? c['sso-rw'],
  },
  cursor: {
    // The sign-in page goes through accounts.x.ai, then back to cursor.com. The cookie is on cursor.com.
    startUrl: 'https://cursor.com/dashboard',
    target: { host: 'cursor.com', names: ['WorkosCursorSessionToken'] },
    terms: 'https://cursor.com/terms-of-service',
    toSecret: (c) => c.WorkosCursorSessionToken,
  },
};

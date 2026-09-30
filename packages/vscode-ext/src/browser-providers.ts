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

/** Perplexity uses Auth.js or NextAuth. The session cookie can have one of four names, and can be split. */
export const PERPLEXITY_COOKIES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
].flatMap((name) => [name, `${name}.0`, `${name}.1`]);

/** Keep each present cookie under its own name, as a Cookie header. */
function cookieHeader(names: readonly string[], cookies: Record<string, string>): string | undefined {
  const parts = names.filter((name) => cookies[name]).map((name) => `${name}=${cookies[name]}`);
  return parts.length > 0 ? parts.join('; ') : undefined;
}

/**
 * A pasted Cookie header keeps only the named cookies, so no other cookie from the paste is stored or sent.
 * `bareName` names a single value with no "name=" part.
 */
export function cookiesFromPaste(names: readonly string[], raw: string, bareName?: string): string | undefined {
  const text = raw.trim().replace(/^cookie:\s*/i, '');
  if (!text) return undefined;
  if (!text.includes('=')) return bareName ? `${bareName}=${text}` : undefined;
  const cookies: Record<string, string> = {};
  for (const part of text.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0) cookies[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return cookieHeader(names, cookies);
}

export function perplexityFromPaste(raw: string): string | undefined {
  return cookiesFromPaste(PERPLEXITY_COOKIES, raw, '__Secure-next-auth.session-token');
}

/**
 * Google session cookies for Gemini. High risk: Chrome DBSC can bind them to the browser, so a copy can
 * end within hours (spec section 12).
 */
export const GEMINI_COOKIES = ['__Secure-1PSID', '__Secure-1PSIDTS', '__Secure-1PSIDCC'] as const;

/** Gemini needs at least __Secure-1PSID. */
export function geminiSecret(cookies: Record<string, string>): string | undefined {
  return cookies['__Secure-1PSID'] ? cookieHeader(GEMINI_COOKIES, cookies) : undefined;
}

export function geminiFromPaste(raw: string): string | undefined {
  const header = cookiesFromPaste(GEMINI_COOKIES, raw);
  return header?.includes('__Secure-1PSID=') ? header : undefined;
}

/** Windsurf keeps its session in these localStorage values, not in a cookie. */
export const WINDSURF_KEYS = ['devin_session_token', 'devin_auth1_token', 'devin_account_id', 'devin_primary_org_id'] as const;

/** The Windsurf secret is JSON with all four values. Undefined when one is missing or empty. */
export function windsurfSecret(values: Record<string, unknown>): string | undefined {
  const picked = WINDSURF_KEYS.map((key) => [key, values[key]] as const);
  if (!picked.every(([, v]) => typeof v === 'string' && v.length > 0)) return undefined;
  return JSON.stringify(Object.fromEntries(picked));
}

/** A pasted Windsurf value: the JSON that the console snippet copies. */
export function windsurfFromPaste(raw: string): string | undefined {
  try {
    return windsurfSecret(JSON.parse(raw.trim()) as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

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
    toSecret: (c) => cookieHeader(CODEX_COOKIES, c),
  },
  grok: {
    startUrl: 'https://grok.com/sign-in',
    target: { host: 'grok.com', names: ['sso', 'sso-rw'] },
    terms: 'https://x.ai/legal/terms-of-service',
    // The poller sends the same value as sso and sso-rw.
    toSecret: (c) => c.sso ?? c['sso-rw'],
  },
  gemini: {
    startUrl: 'https://gemini.google.com/app',
    target: { host: 'google.com', names: GEMINI_COOKIES },
    terms: 'https://policies.google.com/terms',
    toSecret: (c) => geminiSecret(c),
  },
  cursor: {
    // The sign-in page goes through accounts.x.ai, then back to cursor.com. The cookie is on cursor.com.
    startUrl: 'https://cursor.com/dashboard',
    target: { host: 'cursor.com', names: ['WorkosCursorSessionToken'] },
    terms: 'https://cursor.com/terms-of-service',
    toSecret: (c) => c.WorkosCursorSessionToken,
  },
  perplexity: {
    startUrl: 'https://www.perplexity.ai/',
    target: { host: 'perplexity.ai', names: PERPLEXITY_COOKIES },
    terms: 'https://www.perplexity.ai/hub/legal/terms-of-service',
    toSecret: (c) => cookieHeader(PERPLEXITY_COOKIES, c),
  },
  windsurf: {
    startUrl: 'https://windsurf.com/profile',
    target: { host: 'windsurf.com', names: [], localStorage: { origin: 'https://windsurf.com', keys: WINDSURF_KEYS } },
    terms: 'https://windsurf.com/terms-of-service-individual',
    toSecret: (values) => windsurfSecret(values),
  },
};

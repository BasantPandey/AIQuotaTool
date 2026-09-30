import { describe, expect, it } from 'vitest';
import { BROWSER_PROVIDERS, geminiFromPaste } from './browser-providers.js';
import { codexCookieHeader } from './session-fetch.js';

describe('BROWSER_PROVIDERS', () => {
  it('Codex keeps a split session as two named cookies', () => {
    const secret = BROWSER_PROVIDERS.codex!.toSecret({
      '__Secure-next-auth.session-token.0': 'part-a',
      '__Secure-next-auth.session-token.1': 'part-b',
    });
    expect(secret).toBe('__Secure-next-auth.session-token.0=part-a; __Secure-next-auth.session-token.1=part-b');
    expect(codexCookieHeader(secret!)).toBe(secret);
  });

  it('Codex keeps one unsplit session cookie', () => {
    const secret = BROWSER_PROVIDERS.codex!.toSecret({ '__Secure-next-auth.session-token': 'whole' });
    expect(codexCookieHeader(secret!)).toBe('__Secure-next-auth.session-token=whole');
  });

  it('Grok stores the sso value, and uses sso-rw only when sso is missing', () => {
    expect(BROWSER_PROVIDERS.grok!.toSecret({ sso: 'a', 'sso-rw': 'b' })).toBe('a');
    expect(BROWSER_PROVIDERS.grok!.toSecret({ 'sso-rw': 'b' })).toBe('b');
  });

  it('Gemini needs __Secure-1PSID and keeps only the named Google cookies', () => {
    expect(BROWSER_PROVIDERS.gemini!.toSecret({ '__Secure-1PSID': 'a', '__Secure-1PSIDTS': 'b', SID: 'x' })).toBe('__Secure-1PSID=a; __Secure-1PSIDTS=b');
    expect(BROWSER_PROVIDERS.gemini!.toSecret({ '__Secure-1PSIDTS': 'b' })).toBeUndefined();
    expect(geminiFromPaste('SID=x; __Secure-1PSID=a; NID=n')).toBe('__Secure-1PSID=a');
    expect(geminiFromPaste('NID=n')).toBeUndefined();
  });

  it('a missing cookie gives no secret', () => {
    for (const provider of Object.values(BROWSER_PROVIDERS)) expect(provider.toSecret({})).toBeUndefined();
  });

  it('each provider reads cookies only on its own host', () => {
    expect(Object.fromEntries(Object.entries(BROWSER_PROVIDERS).map(([k, p]) => [k, p.target.host]))).toEqual({
      claude: 'claude.ai',
      codex: 'chatgpt.com',
      grok: 'grok.com',
      gemini: 'google.com',
      cursor: 'cursor.com',
    });
  });
});

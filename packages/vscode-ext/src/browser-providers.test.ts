import { describe, expect, it } from 'vitest';
import { BROWSER_PROVIDERS, geminiFromPaste, perplexityFromPaste, windsurfFromPaste } from './browser-providers.js';
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

  it('Perplexity keeps any of its session cookie names, also split', () => {
    expect(
      BROWSER_PROVIDERS.perplexity!.toSecret({ '__Secure-authjs.session-token.0': 'a', '__Secure-authjs.session-token.1': 'b', other: 'x' }),
    ).toBe('__Secure-authjs.session-token.0=a; __Secure-authjs.session-token.1=b');
  });

  it('a pasted Perplexity Cookie header keeps only the session cookie', () => {
    expect(perplexityFromPaste('Cookie: pplx.visitor=1; __Secure-next-auth.session-token=tok; _ga=2')).toBe('__Secure-next-auth.session-token=tok');
    expect(perplexityFromPaste('baretoken')).toBe('__Secure-next-auth.session-token=baretoken');
    expect(perplexityFromPaste('pplx.visitor=1')).toBeUndefined();
    expect(perplexityFromPaste('  ')).toBeUndefined();
  });

  it('Windsurf needs all four localStorage values', () => {
    const all = { devin_session_token: 's', devin_auth1_token: 'a', devin_account_id: 'i', devin_primary_org_id: 'o', other: 'x' };
    expect(JSON.parse(BROWSER_PROVIDERS.windsurf!.toSecret(all)!)).toEqual({
      devin_session_token: 's',
      devin_auth1_token: 'a',
      devin_account_id: 'i',
      devin_primary_org_id: 'o',
    });
    expect(BROWSER_PROVIDERS.windsurf!.toSecret({ devin_session_token: 's' })).toBeUndefined();
    expect(BROWSER_PROVIDERS.windsurf!.target.localStorage?.origin).toBe('https://windsurf.com');
    expect(windsurfFromPaste(JSON.stringify(all))).toBeDefined();
    expect(windsurfFromPaste('not json')).toBeUndefined();
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
      perplexity: 'perplexity.ai',
      windsurf: 'windsurf.com',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildGitHubAuthorizeUrl,
  extractAuthorizationCode,
} from './github-oauth.js';

const BASE = {
  clientId: 'Iv1.testclient',
  redirectUri: 'https://abcdefghijklmnop.chromiumapp.org/',
  state: 'state-123',
  codeChallenge: 'challenge-abc',
};

describe('buildGitHubAuthorizeUrl', () => {
  it('builds the GitHub web-flow URL with PKCE S256', () => {
    const url = new URL(buildGitHubAuthorizeUrl(BASE));
    expect(url.origin + url.pathname).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('Iv1.testclient');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://abcdefghijklmnop.chromiumapp.org/',
    );
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-abc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('includes scopes space-joined when given', () => {
    const url = new URL(
      buildGitHubAuthorizeUrl({ ...BASE, scopes: ['read:user', 'read:org'] }),
    );
    expect(url.searchParams.get('scope')).toBe('read:user read:org');
  });

  it('omits the scope param when no scopes are requested', () => {
    const url = new URL(buildGitHubAuthorizeUrl(BASE));
    expect(url.searchParams.has('scope')).toBe(false);
  });
});

describe('extractAuthorizationCode', () => {
  it('returns the code when the state matches', () => {
    const redirect =
      'https://abcdefghijklmnop.chromiumapp.org/?code=abc123&state=state-123';
    expect(extractAuthorizationCode(redirect, 'state-123')).toBe('abc123');
  });

  it('rejects the code when the state does not match (CSRF guard)', () => {
    const redirect =
      'https://abcdefghijklmnop.chromiumapp.org/?code=abc123&state=evil';
    expect(extractAuthorizationCode(redirect, 'state-123')).toBeUndefined();
  });

  it('returns undefined when the user denied access', () => {
    const redirect =
      'https://abcdefghijklmnop.chromiumapp.org/?error=access_denied&state=state-123';
    expect(extractAuthorizationCode(redirect, 'state-123')).toBeUndefined();
  });

  it('returns undefined for a malformed URL', () => {
    expect(extractAuthorizationCode('not a url', 'state-123')).toBeUndefined();
  });
});

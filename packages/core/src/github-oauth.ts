/**
 * Pure pieces of the GitHub OAuth web flow (PKCE) used by hosts that drive
 * chrome.identity.launchWebAuthFlow. No I/O here - hosts own the network.
 */

const AUTHORIZE_ENDPOINT = 'https://github.com/login/oauth/authorize';

export interface GitHubAuthorizeParams {
  clientId: string;
  redirectUri: string;
  /** CSRF token the host generates and re-checks on the redirect. */
  state: string;
  /** Base64url(SHA-256(verifier)) - the host keeps the verifier. */
  codeChallenge: string;
  /** OAuth scopes, space-joined into the standard `scope` param. */
  scopes?: string[];
}

export function buildGitHubAuthorizeUrl(params: GitHubAuthorizeParams): string {
  const url = new URL(AUTHORIZE_ENDPOINT);
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (params.scopes && params.scopes.length > 0) {
    url.searchParams.set('scope', params.scopes.join(' '));
  }
  return url.toString();
}

/**
 * Pull the authorization code out of the redirect URL, but only when the
 * state matches the one the host generated. Returns undefined on denial,
 * state mismatch, or a malformed URL.
 */
export function extractAuthorizationCode(
  redirectUrl: string,
  expectedState: string,
): string | undefined {
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    return undefined;
  }
  if (url.searchParams.get('state') !== expectedState) return undefined;
  return url.searchParams.get('code') ?? undefined;
}

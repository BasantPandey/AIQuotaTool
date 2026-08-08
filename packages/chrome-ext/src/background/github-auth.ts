import {
  buildGitHubAuthorizeUrl,
  extractAuthorizationCode,
} from '@ai-quota-tool/core';

/**
 * GitHub OAuth (PKCE) for the Copilot seat check, driven by
 * chrome.identity.launchWebAuthFlow from the service worker.
 *
 * The extension is a public client: no client_secret ships in the bundle.
 * PKCE carries the exchange (see docs/research/chrome-identity-github-oauth.md).
 *
 * Known platform risk (research, community-reported): Chrome may suspend the
 * service worker during a long interactive flow. If that happens the user
 * simply retries Connect - no state is corrupted.
 */

// TODO(store): register the GitHub OAuth App and paste its client id here.
// Callback URL to register: https://<extension-id>.chromiumapp.org/
export const GITHUB_OAUTH_CLIENT_ID = '';

export const GITHUB_TOKEN_STORAGE_KEY = 'githubToken';

const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const SCOPES = ['read:user'];

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64Url(digest) };
}

/**
 * Run the GitHub authorization flow and store the resulting token in
 * chrome.storage.local. Interactive runs show the consent UI; non-interactive
 * runs only succeed when the user has already authorized the app (GitHub then
 * auto-completes the flow) - that is the silent re-auth path.
 * Throws with a user-readable message on cancel/failure.
 */
async function runGitHubAuthFlow(interactive: boolean): Promise<void> {
  if (!GITHUB_OAUTH_CLIENT_ID) {
    throw new Error('GitHub sign-in is not configured in this build yet.');
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const state = crypto.randomUUID();
  const { verifier, challenge } = await generatePkce();

  const url = buildGitHubAuthorizeUrl({
    clientId: GITHUB_OAUTH_CLIENT_ID,
    redirectUri,
    state,
    codeChallenge: challenge,
    scopes: SCOPES,
  });

  const redirect = await chrome.identity.launchWebAuthFlow({
    url,
    interactive,
  });
  if (!redirect) throw new Error('GitHub sign-in was cancelled.');

  const code = extractAuthorizationCode(redirect, state);
  if (!code) throw new Error('GitHub sign-in did not complete.');

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_OAUTH_CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new Error(data.error_description ?? 'GitHub token exchange failed.');
  }

  await chrome.storage.local.set({
    [GITHUB_TOKEN_STORAGE_KEY]: data.access_token,
  });
}

/** Interactive connect, driven by the side panel's Connect button. */
export async function connectGitHub(): Promise<void> {
  await runGitHubAuthFlow(true);
}

/**
 * Silent re-auth after a stored token stops working (401). Only attempted
 * when a token existed before; resolves true when a fresh token was stored.
 * Never loop this: GitHub rate-limits token creation (10/hour per user/app).
 */
export async function trySilentGitHubReauth(): Promise<boolean> {
  const stored = await chrome.storage.local.get([GITHUB_TOKEN_STORAGE_KEY]);
  if (!stored[GITHUB_TOKEN_STORAGE_KEY]) return false;
  try {
    await runGitHubAuthFlow(false);
    return true;
  } catch {
    return false;
  }
}

/** Remove the stored GitHub OAuth token (disconnect). */
export async function disconnectGitHub(): Promise<void> {
  await chrome.storage.local.remove(GITHUB_TOKEN_STORAGE_KEY);
}

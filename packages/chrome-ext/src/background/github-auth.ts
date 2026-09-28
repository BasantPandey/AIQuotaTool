import { type DeviceTokenResponse, nextDevicePollStep } from '@ai-quota-tool/core';

/**
 * GitHub sign-in for the Copilot seat check, with the OAuth device flow.
 * The device flow needs no client secret, so nothing secret ships in the bundle.
 * The side panel runs the flow: it shows the code and polls while the user approves on GitHub.
 * OAuth App tokens do not expire on a schedule. After a revoke, the user connects again.
 */

/** Public id of the "AI Quota Tool" GitHub OAuth App. Device flow is on in its settings. */
export const GITHUB_OAUTH_CLIENT_ID = 'Ov23liNRlhzedfjImsrQ';

export const GITHUB_TOKEN_STORAGE_KEY = 'githubToken';

const DEVICE_CODE_ENDPOINT = 'https://github.com/login/device/code';
const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const SCOPE = 'read:user';

export interface DeviceCode {
  deviceCode: string;
  /** The code the user types on GitHub, for example "9FC0-4591". */
  userCode: string;
  verificationUri: string;
  intervalSec: number;
  expiresAt: number;
}

async function postJson(url: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });
}

/** Step 1: ask GitHub for a code that the user types on github.com/login/device. */
export async function requestDeviceCode(): Promise<DeviceCode> {
  const data = (await postJson(DEVICE_CODE_ENDPOINT, { client_id: GITHUB_OAUTH_CLIENT_ID, scope: SCOPE })) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    interval?: number;
    expires_in?: number;
    error_description?: string;
  };
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(data.error_description ?? 'GitHub did not return a sign-in code. Try again.');
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    intervalSec: data.interval ?? 5,
    expiresAt: Date.now() + (data.expires_in ?? 900) * 1000,
  };
}

/**
 * Step 2: poll until the user approves on GitHub, then store the token.
 * Resolves true when a token is stored, false when the signal aborts. Throws on denial or expiry.
 */
export async function waitForDeviceToken(code: DeviceCode, signal: AbortSignal): Promise<boolean> {
  let intervalSec = code.intervalSec;
  for (;;) {
    await sleep(intervalSec * 1000, signal);
    if (signal.aborted) return false;
    if (Date.now() > code.expiresAt) throw new Error('The code expired. Connect again to get a new code.');
    const res = (await postJson(TOKEN_ENDPOINT, {
      client_id: GITHUB_OAUTH_CLIENT_ID,
      device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })) as DeviceTokenResponse;
    const step = nextDevicePollStep(res, intervalSec);
    if (step.kind === 'fail') throw new Error(step.message);
    if (step.kind === 'done') {
      await chrome.storage.local.set({ [GITHUB_TOKEN_STORAGE_KEY]: step.token });
      return true;
    }
    intervalSec = step.intervalSec;
  }
}

/** Remove the stored GitHub OAuth token (disconnect). */
export async function disconnectGitHub(): Promise<void> {
  await chrome.storage.local.remove(GITHUB_TOKEN_STORAGE_KEY);
}

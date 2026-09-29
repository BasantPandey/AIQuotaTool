import { type DeviceCode, pollDeviceToken, requestDeviceCode as requestCode } from '@ai-quota-tool/core';

/**
 * Chrome glue for the shared GitHub device flow in @ai-quota-tool/core.
 * The side panel runs the flow: it shows the code and polls while the user approves on GitHub.
 * OAuth App tokens do not expire on a schedule. After a revoke, the user connects again.
 */

export type { DeviceCode };

export const GITHUB_TOKEN_STORAGE_KEY = 'githubToken';

async function postJson(url: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Step 1: ask GitHub for a code that the user types on github.com/login/device. */
export function requestDeviceCode(): Promise<DeviceCode> {
  return requestCode(postJson);
}

/** Step 2: poll until the user approves, then store the token. Resolves false when the signal aborts. */
export async function waitForDeviceToken(code: DeviceCode, signal: AbortSignal): Promise<boolean> {
  const token = await pollDeviceToken(code, {
    post: postJson,
    sleep: (ms) =>
      new Promise((resolve) => {
        if (signal.aborted) return resolve(false);
        const timer = setTimeout(() => resolve(!signal.aborted), ms);
        signal.addEventListener('abort', () => (clearTimeout(timer), resolve(false)), { once: true });
      }),
    now: Date.now,
  });
  if (token == null) return false;
  await chrome.storage.local.set({ [GITHUB_TOKEN_STORAGE_KEY]: token });
  return true;
}

/** Remove the stored GitHub OAuth token (disconnect). */
export async function disconnectGitHub(): Promise<void> {
  await chrome.storage.local.remove(GITHUB_TOKEN_STORAGE_KEY);
}

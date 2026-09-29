/**
 * GitHub OAuth device flow, shared by the Chrome and VS Code extensions.
 * The device flow needs no client secret, so an extension can use it safely.
 * No I/O here: each host passes its own post, sleep and clock functions.
 */

/** Public id of the "AI Quota Tool" GitHub OAuth App. Device flow is on in its settings. */
export const GITHUB_OAUTH_CLIENT_ID = 'Ov23liNRlhzedfjImsrQ';

const DEVICE_CODE_ENDPOINT = 'https://github.com/login/device/code';
const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const SCOPE = 'read:user';
const EXPIRED = 'The code expired. Connect again to get a new code.';

/** POST a JSON body and return the parsed JSON answer. */
export type PostJson = (url: string, body: Record<string, string>) => Promise<unknown>;

export interface DeviceCode {
  deviceCode: string;
  /** The code the user types on GitHub, for example "9FC0-4591". */
  userCode: string;
  verificationUri: string;
  intervalSec: number;
  expiresAt: number;
}

/** One answer from the token endpoint while the host polls. */
export interface DeviceTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
  /** New minimum poll interval in seconds, sent with slow_down. */
  interval?: number;
}

export type DevicePollStep =
  | { kind: 'wait'; intervalSec: number }
  | { kind: 'done'; token: string }
  | { kind: 'fail'; message: string };

/** What the host does after one poll answer. */
export function nextDevicePollStep(res: DeviceTokenResponse, intervalSec: number): DevicePollStep {
  if (typeof res.access_token === 'string' && res.access_token !== '') {
    return { kind: 'done', token: res.access_token };
  }
  switch (res.error) {
    case 'authorization_pending':
      return { kind: 'wait', intervalSec };
    case 'slow_down':
      return { kind: 'wait', intervalSec: res.interval ?? intervalSec + 5 };
    case 'expired_token':
      return { kind: 'fail', message: EXPIRED };
    case 'access_denied':
      return { kind: 'fail', message: 'GitHub sign-in was cancelled.' };
    default:
      return { kind: 'fail', message: res.error_description ?? 'GitHub sign-in failed. Try again.' };
  }
}

/** Step 1: ask GitHub for a code that the user types on github.com/login/device. */
export async function requestDeviceCode(post: PostJson, now = Date.now()): Promise<DeviceCode> {
  const data = (await post(DEVICE_CODE_ENDPOINT, { client_id: GITHUB_OAUTH_CLIENT_ID, scope: SCOPE })) as {
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
    expiresAt: now + (data.expires_in ?? 900) * 1000,
  };
}

export interface PollDeps {
  post: PostJson;
  /** Wait ms. Resolve false when the host stops the wait (Cancel, panel closed). */
  sleep: (ms: number) => Promise<boolean>;
  now: () => number;
}

/**
 * Step 2: poll until the user approves on GitHub.
 * Returns the token, or undefined when the host stops the wait. Throws on denial or expiry.
 */
export async function pollDeviceToken(code: DeviceCode, deps: PollDeps): Promise<string | undefined> {
  let intervalSec = code.intervalSec;
  for (;;) {
    if (!(await deps.sleep(intervalSec * 1000))) return undefined;
    if (deps.now() > code.expiresAt) throw new Error(EXPIRED);
    const res = (await deps.post(TOKEN_ENDPOINT, {
      client_id: GITHUB_OAUTH_CLIENT_ID,
      device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })) as DeviceTokenResponse;
    const step = nextDevicePollStep(res, intervalSec);
    if (step.kind === 'done') return step.token;
    if (step.kind === 'fail') throw new Error(step.message);
    intervalSec = step.intervalSec;
  }
}

/**
 * Pure step logic for the GitHub OAuth device flow. No I/O here - hosts own the network.
 * The device flow needs no client secret, so a browser extension can use it safely.
 */

/** One answer from POST https://github.com/login/oauth/access_token while the host polls. */
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
      return { kind: 'fail', message: 'The code expired. Connect again to get a new code.' };
    case 'access_denied':
      return { kind: 'fail', message: 'GitHub sign-in was cancelled.' };
    default:
      return { kind: 'fail', message: res.error_description ?? 'GitHub sign-in failed. Try again.' };
  }
}

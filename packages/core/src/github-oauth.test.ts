import { describe, expect, it } from 'vitest';
import {
  type DeviceCode,
  GITHUB_OAUTH_CLIENT_ID,
  nextDevicePollStep,
  pollDeviceToken,
  requestDeviceCode,
} from './github-oauth.js';

describe('nextDevicePollStep', () => {
  it('finishes with the token', () => {
    expect(nextDevicePollStep({ access_token: 'gho_abc' }, 5)).toEqual({ kind: 'done', token: 'gho_abc' });
  });

  it('keeps the interval while the user has not approved yet', () => {
    expect(nextDevicePollStep({ error: 'authorization_pending' }, 5)).toEqual({ kind: 'wait', intervalSec: 5 });
  });

  it('uses the new interval from slow_down', () => {
    expect(nextDevicePollStep({ error: 'slow_down', interval: 10 }, 5)).toEqual({ kind: 'wait', intervalSec: 10 });
  });

  it('adds 5 seconds when slow_down has no interval', () => {
    expect(nextDevicePollStep({ error: 'slow_down' }, 5)).toEqual({ kind: 'wait', intervalSec: 10 });
  });

  it('fails when the code expires', () => {
    expect(nextDevicePollStep({ error: 'expired_token' }, 5)).toEqual({
      kind: 'fail',
      message: 'The code expired. Connect again to get a new code.',
    });
  });

  it('fails when the user denies access', () => {
    expect(nextDevicePollStep({ error: 'access_denied' }, 5)).toEqual({
      kind: 'fail',
      message: 'GitHub sign-in was cancelled.',
    });
  });

  it('fails with the GitHub text for an unknown error', () => {
    expect(nextDevicePollStep({ error: 'device_flow_disabled', error_description: 'Device flow is off' }, 5)).toEqual({
      kind: 'fail',
      message: 'Device flow is off',
    });
  });

  it('never treats an empty token as success', () => {
    expect(nextDevicePollStep({ access_token: '' }, 5).kind).toBe('fail');
  });
});

describe('requestDeviceCode', () => {
  it('asks GitHub for a code with the shared client id and read:user', async () => {
    const calls: [string, Record<string, string>][] = [];
    const code = await requestDeviceCode(async (url, body) => {
      calls.push([url, body]);
      return { device_code: 'dev1', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', interval: 5, expires_in: 900 };
    }, 1_000);
    expect(calls).toEqual([
      ['https://github.com/login/device/code', { client_id: GITHUB_OAUTH_CLIENT_ID, scope: 'read:user' }],
    ]);
    expect(code).toEqual({
      deviceCode: 'dev1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      intervalSec: 5,
      expiresAt: 901_000,
    });
  });

  it('throws the GitHub text when no code comes back', async () => {
    await expect(requestDeviceCode(async () => ({ error_description: 'Device flow is off' }))).rejects.toThrow(
      'Device flow is off',
    );
  });
});

describe('pollDeviceToken', () => {
  const CODE: DeviceCode = {
    deviceCode: 'dev1',
    userCode: 'ABCD-1234',
    verificationUri: 'https://github.com/login/device',
    intervalSec: 5,
    expiresAt: 100_000,
  };

  function fakes(answers: unknown[]) {
    const slept: number[] = [];
    const bodies: Record<string, string>[] = [];
    return {
      slept,
      bodies,
      deps: {
        post: async (_url: string, body: Record<string, string>) => {
          bodies.push(body);
          return answers.shift();
        },
        sleep: async (ms: number) => {
          slept.push(ms);
          return true;
        },
        now: () => 0,
      },
    };
  }

  it('waits, obeys slow_down, and returns the token', async () => {
    const f = fakes([{ error: 'authorization_pending' }, { error: 'slow_down', interval: 10 }, { access_token: 'gho_x' }]);
    await expect(pollDeviceToken(CODE, f.deps)).resolves.toBe('gho_x');
    expect(f.slept).toEqual([5000, 5000, 10000]);
    expect(f.bodies[0]).toEqual({
      client_id: GITHUB_OAUTH_CLIENT_ID,
      device_code: 'dev1',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });

  it('returns undefined when the host stops the wait', async () => {
    const f = fakes([]);
    await expect(pollDeviceToken(CODE, { ...f.deps, sleep: async () => false })).resolves.toBeUndefined();
    expect(f.bodies).toEqual([]);
  });

  it('throws when the code expired before the next poll', async () => {
    const f = fakes([]);
    await expect(pollDeviceToken(CODE, { ...f.deps, now: () => 200_000 })).rejects.toThrow('The code expired');
  });

  it('throws when the user denies access', async () => {
    const f = fakes([{ error: 'access_denied' }]);
    await expect(pollDeviceToken(CODE, f.deps)).rejects.toThrow('GitHub sign-in was cancelled.');
  });
});

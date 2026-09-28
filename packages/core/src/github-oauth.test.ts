import { describe, expect, it } from 'vitest';
import { nextDevicePollStep } from './github-oauth.js';

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

import { describe, expect, it } from 'vitest';
import {
  isSessionAuthFailure,
  isSessionCookieService,
  sessionAuthFailureAction,
} from './session-auth.js';

describe('isSessionCookieService', () => {
  it('is true for Claude and Codex only', () => {
    expect(isSessionCookieService('claude')).toBe(true);
    expect(isSessionCookieService('codex')).toBe(true);
    expect(isSessionCookieService('copilot')).toBe(false);
  });
});

describe('isSessionAuthFailure', () => {
  it('detects HTTP 401/403 and known session phrases', () => {
    expect(isSessionAuthFailure(new Error('Claude orgs API: 401 invalid or expired session key'))).toBe(
      true,
    );
    expect(isSessionAuthFailure(new Error('Codex usage API: 403 invalid or expired session token'))).toBe(
      true,
    );
    expect(isSessionAuthFailure('No Claude org found')).toBe(true);
    expect(isSessionAuthFailure(new Error('Claude orgs API: 500'))).toBe(false);
    expect(isSessionAuthFailure('no credential')).toBe(false);
  });
});

describe('sessionAuthFailureAction', () => {
  it('returns drop-ring keep-secret reauth for Claude/Codex auth failures', () => {
    const action = sessionAuthFailureAction(
      'claude',
      new Error('Claude usage API: 401 invalid or expired session key'),
    );
    expect(action).toEqual({
      dropRing: true,
      keepSecret: true,
      requireReauthSignal: true,
    });
  });

  it('returns the same policy for Codex 403', () => {
    expect(sessionAuthFailureAction('codex', new Error('Codex usage API: 403'))).toEqual({
      dropRing: true,
      keepSecret: true,
      requireReauthSignal: true,
    });
  });

  it('returns null for Copilot even on 401-looking messages', () => {
    expect(sessionAuthFailureAction('copilot', new Error('401 unauthorized'))).toBeNull();
  });

  it('returns null for non-auth network failures', () => {
    expect(sessionAuthFailureAction('claude', new Error('Claude usage API: 502'))).toBeNull();
  });

  it('never implies inventing remaining percentage or auto-clearing secrets', () => {
    const action = sessionAuthFailureAction('claude', new Error('401 invalid or expired'));
    expect(action).not.toBeNull();
    expect(action!.keepSecret).toBe(true);
    expect(action!.dropRing).toBe(true);
    // Policy object has no remainingPct / inventFull fields by design.
    expect('remainingPct' in action!).toBe(false);
    expect('clearSecret' in action!).toBe(false);
  });
});

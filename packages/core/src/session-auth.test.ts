import { describe, expect, it } from 'vitest';
import {
  isSessionAuthFailure,
  isSessionCookieService,
  sessionAuthFailureAction,
  sessionExpired,
} from './session-auth.js';

describe('isSessionCookieService', () => {
  it('is true for Claude, Codex, and Grok (session cookies)', () => {
    expect(isSessionCookieService('claude')).toBe(true);
    expect(isSessionCookieService('codex')).toBe(true);
    expect(isSessionCookieService('grok')).toBe(true);
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

  it('returns drop-ring keep-secret reauth for Grok 401', () => {
    expect(sessionAuthFailureAction('grok', new Error('Grok rate-limits API: 401 invalid or expired'))).toEqual({
      dropRing: true,
      keepSecret: true,
      requireReauthSignal: true,
    });
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

describe('sessionExpired', () => {
  it('returns a session_expired honesty state with a fresh timestamp', () => {
    const state = sessionExpired('claude', 123);
    expect(state).toEqual({
      service: 'claude',
      honesty: 'session_expired',
      lastUpdated: 123,
    });
  });

  it('never carries remaining percentages (drop the ring)', () => {
    const state = sessionExpired('codex', 1);
    expect(state.sessionPct).toBeUndefined();
    expect(state.weeklyPct).toBeUndefined();
  });
});

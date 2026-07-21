import type { ServiceId } from './types.js';

/**
 * Pure policy for Claude/Codex session-cookie poll failures.
 * Hosts apply this instead of inventing remaining % or auto-deleting secrets.
 */
export interface SessionAuthFailureAction {
  /** Remove this service's QuotaState so stale healthy rings never linger. */
  dropRing: true;
  /** Keep SecretStorage (or equivalent) — do not auto-delete on 401/403. */
  keepSecret: true;
  /** Host must surface an explicit invalid/expired re-auth cue. */
  requireReauthSignal: true;
}

/** Services that use pasted/stored session cookies in VS Code standalone mode. */
export function isSessionCookieService(service: ServiceId): boolean {
  return service === 'claude' || service === 'codex';
}

/**
 * True when a failure message indicates invalid/expired session credentials
 * (HTTP 401/403 or known auth phrases from our fetchers).
 */
export function isSessionAuthFailure(reason: unknown): boolean {
  const msg = reason instanceof Error ? reason.message : String(reason);
  return /\b401\b|\b403\b|invalid or expired|No Claude org/i.test(msg);
}

/**
 * If this poll failure is a session-cookie auth failure for Claude/Codex,
 * return the V1 action (drop ring, keep secret, re-auth signal).
 * Otherwise return null (ignore for credential policy).
 */
export function sessionAuthFailureAction(
  service: ServiceId,
  reason: unknown,
): SessionAuthFailureAction | null {
  if (!isSessionCookieService(service)) return null;
  if (!isSessionAuthFailure(reason)) return null;
  return {
    dropRing: true,
    keepSecret: true,
    requireReauthSignal: true,
  };
}
